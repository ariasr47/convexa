/**
 * StateExportDrawer — the always-available export floor (UX_BLUEPRINT §4 + egress honesty).
 * Opened from `View what's sent` in the rec panel (the SAME export feeds both the in-app call and
 * the manual hand-off). It triggers NO in-app LLM call and
 * costs nothing — it works in EVERY rec-panel state (key_not_configured / daily_cap_reached /
 * unavailable). Egress invariant: it shows ONLY {context, persona prompt, glossary} for the current
 * ticker — no key, no other ticker, no identity, no order data.
 */
import { useSettings } from '@/features/auth/useSettings';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import { useScrollRegion } from '@/shared/ui/useScrollRegion';
import { dataMode, fetchRecExport, RecExport, RiskInputs, scenarioProvenance } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useEffect, useId, useRef, useState } from 'react';
import {
  COPY,
  DRAWER_NOT_SENT,
  DRAWER_NOT_SENT_DEMO,
  DRAWER_RISK_AS_NEXT,
  DRAWER_RISK_AS_SENT,
  EXPORT_EGRESS_FALLBACK,
  EXPORT_HEADER,
  NONE_OMITTED,
  SUPERSEDED_STRIP_DRAWER,
} from './copy';
import { riskInputsSuperseded } from './literals';

/** The scenario's clock, as the read panel prints it (demo/catalog/shared.ts AS_OF, 18:30 UTC). */
const SCENARIO_AS_OF = 'Oct 7, 2026 · 2:30 PM ET';

function sectionText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

const DROP_REASON_ORDER = [
  'outside_window',
  'outside_band',
  'no_interest',
  'expiration_cap',
  'strike_cap',
] as const;

/** `{N} contracts across {M} expirations · {K} omitted ({REASON})` (AC-91) — the wire counts only,
 *  PLUS the AC-3 disclosure: when the tenor cap actually bound, name how many expirations were
 *  omitted BY THE CAP specifically (distinct from the headline omitted-total's first-applicable
 *  reason), and how many strikes were dropped and why. Each extra clause renders ONLY when its own
 *  count is non-zero — a cap that never bound adds no clause. */
function candidatesLine(candidates: RecExport['context']['candidates'] | undefined): string {
  if (!candidates) return 'Candidate set unavailable this cycle.';
  if (candidates.state === 'unavailable') return 'Candidate set unavailable this cycle.';
  if (candidates.state === 'none_in_band') return 'No candidates in band this cycle.';
  const total = candidates.omitted.total;
  const topReason = DROP_REASON_ORDER.find((k) => candidates.omitted.by_reason[k] > 0);
  const omittedText =
    total === 0 ? NONE_OMITTED : `${total} omitted (${topReason ?? 'outside_window'})`;
  const capClauses: string[] = [];
  if (candidates.omitted.expirations_omitted_by_cap > 0) {
    capClauses.push(
      `${candidates.omitted.expirations_omitted_by_cap} expirations omitted by the cap`,
    );
  }
  if (candidates.omitted.by_reason.strike_cap > 0) {
    capClauses.push(`${candidates.omitted.by_reason.strike_cap} strikes dropped (strike cap)`);
  }
  const capText = capClauses.length ? ` · ${capClauses.join(' · ')}` : '';
  return (
    `${candidates.included.contracts} contracts across ${candidates.included.expiration_count} ` +
    `expirations · ${omittedText}${capText}`
  );
}

function isSent(categories: RecExport['egress_categories'], key: string): boolean {
  if (!categories) return true; // older backend — no categorization, assume shown content was sent
  const found = categories.find((c) => c.key === key);
  return found ? found.sent : true;
}

export function StateExportDrawer({
  open,
  ticker,
  personaId,
  sampleFingerprint,
  onClose,
  /** AC-65: with a rec on screen the risk section is labelled AS-SENT; with none on screen it is
   *  labelled AS-NEXT. Never both, never unlabelled. */
  hasRecOnScreen = false,
  /** AC-95: the on-screen rec's OWN `sent.candidates` (the exact prompt-budget set it was produced
   *  with) — preferred over the freshly-assembled export context when present, so the drawer never
   *  shows a set the displayed rec did not receive. `undefined` ⇒ the as-sent set cannot be
   *  recovered; the drawer states that rather than listing a re-assembled one. */
  asSentCandidates,
  /** AC-64: the on-screen rec's OWN `sent.risk_inputs` — compared against the currently stored block
   *  to drive the superseded-inputs strip in the drawer's risk-inputs section. */
  asSentRiskInputs,
}: {
  open: boolean;
  ticker: string;
  personaId: string | null;
  /** Demo-only identity for the selected authored ticker projection. */
  sampleFingerprint?: string | null;
  onClose: () => void;
  hasRecOnScreen?: boolean;
  asSentCandidates?: RecExport['context']['candidates'] | null;
  asSentRiskInputs?: RiskInputs | null;
}) {
  const [data, setData] = useState<RecExport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [toast, setToast] = useState(false);
  // The drawer's name is its title (spec 2026-10-21/02, (a)). MUI's Drawer puts `role=dialog` on
  // the paper but does not forward `aria-labelledby` to it, so the id goes on the paper slot.
  const titleId = useId();
  // AC-64 — the superseded-inputs detector: compares the pinned as-sent block against the currently
  // stored block via a local signature (SPEC §2.4(a)) — never a raw-value display, never a re-fetch.
  const currentRiskInputs = useSettings().riskInputs;
  const supersededDrawer = riskInputsSuperseded(asSentRiskInputs, currentRiskInputs);
  const provenance = dataMode === 'demo' ? scenarioProvenance() : null;

  // Fetch the export each time the drawer opens (or the read-persona changes). No in-app LLM call.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState('loading');
    setData(null);
    fetchRecExport(ticker, {
      personaId,
      ...(dataMode === 'demo' && sampleFingerprint ? { sampleFingerprint } : {}),
    })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setState('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, ticker, personaId, sampleFingerprint]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setToast(true);
  };
  const allText = data
    ? [
        dataMode === 'demo' ? `# Sample analysis export · ${ticker}` : `# ${EXPORT_HEADER(ticker)}`,
        ...(provenance
          ? [
              `Scenario: ${provenance.scenarioId}`,
              `As of: ${provenance.asOf}`,
              'Sample analysis · authored for this scenario',
            ]
          : []),
        data.egress_note,
        '\n## Computed snapshot (context)\n' + sectionText(data.context),
        '\n## Candidate contracts\n' + candidatesLine(data.context.candidates),
        `\n## ${hasRecOnScreen ? DRAWER_RISK_AS_SENT : DRAWER_RISK_AS_NEXT}\n` +
          sectionText(data.context.risk_inputs),
        '\n## Open positions\n' + sectionText(data.context.open_positions),
        '\n## Persona prompt\n' + sectionText(data.persona_prompt),
        '\n## Field glossary\n' + sectionText(data.glossary),
      ].join('\n')
    : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-labelledby': titleId,
          sx: {
            width: { xs: '100%', sm: 420 },
            p: 2.5,
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography
            id={titleId}
            sx={{ fontWeight: 600, fontSize: 15, color: 'text.primary', flex: 1 }}
          >
            {dataMode === 'demo' ? `Sample analysis export · ${ticker}` : EXPORT_HEADER(ticker)}
          </Typography>
          {dataMode === 'demo' && <DataStateTag state="sample" />}
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close export"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Egress-honesty banner (binding copy) — the complete, reviewable list of what leaves. */}
        <Box
          role="status"
          sx={{
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.14),
            color: (theme) => theme.palette.info.light ?? theme.palette.info.main,
            borderRadius: '8px',
            px: 1.5,
            py: 1.25,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {data?.egress_note ?? EXPORT_EGRESS_FALLBACK(ticker)}
        </Box>
        {provenance && (
          <Typography
            sx={{
              fontFamily: typographyTokens.monoFontFamily,
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            {`Scenario · ${SCENARIO_AS_OF} · ${COPY.demo.provenance}`}
          </Typography>
        )}

        {state === 'loading' && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading the export…
            </Typography>
          </Stack>
        )}
        {state === 'error' && (
          <Alert severity="warning">Couldn't load the export right now — try reopening.</Alert>
        )}

        {data && state === 'idle' && (
          <>
            <Button
              variant="contained"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
              onClick={() => copy(allText)}
            >
              {COPY.export.copyAll}
            </Button>

            <ExportSection
              title="Computed snapshot (context)"
              caption="A serialization of what Convexa already computed — no recompute, no new fetch. Null stays null."
              text={sectionText(data.context)}
              onCopy={copy}
            />

            {/* Candidate contracts (AC-91/94/95/96) — the exact count Convexa carried. When a rec is
                on screen, the AS-SENT set it was produced with wins over a freshly-assembled one
                (AC-95); `asSentCandidates === undefined` (host passed nothing) states that the
                as-sent set could not be recovered rather than silently re-assembling one. */}
            {isSent(data.egress_categories, 'candidates') ? (
              hasRecOnScreen && asSentCandidates === undefined ? (
                <ExportSection
                  title="Candidate contracts"
                  caption="This is the in-app recommendation's own consumer — the as-sent set could not be recovered."
                  text="The as-sent candidate set for this recommendation could not be recovered."
                  onCopy={copy}
                />
              ) : (
                <ExportSection
                  title="Candidate contracts"
                  caption={
                    hasRecOnScreen
                      ? 'The in-app recommendation request — the set the displayed rec was produced with.'
                      : 'The hand-off export — one computation, two renderings with the rec panel strip.'
                  }
                  text={candidatesLine(
                    hasRecOnScreen && asSentCandidates ? asSentCandidates : data.context.candidates,
                  )}
                  onCopy={copy}
                />
              )
            ) : (
              <NotSentSection title="Candidate contracts" />
            )}

            {/* Your risk inputs (AC-65/91) — labelled AS-SENT or AS-NEXT, never both, never unlabelled.
                AC-64: when a rec is on screen and the stored block has since changed, the superseded
                caption fires — the pinned as-sent signature compared against the current one. */}
            {isSent(data.egress_categories, 'risk_inputs') ? (
              <ExportSection
                title={hasRecOnScreen ? DRAWER_RISK_AS_SENT : DRAWER_RISK_AS_NEXT}
                caption={hasRecOnScreen && supersededDrawer ? SUPERSEDED_STRIP_DRAWER : undefined}
                text={sectionText(data.context.risk_inputs)}
                onCopy={copy}
              />
            ) : (
              <NotSentSection title={hasRecOnScreen ? DRAWER_RISK_AS_SENT : DRAWER_RISK_AS_NEXT} />
            )}

            {/* Open positions — simulated only, labelled at every surface (AC-40). */}
            {isSent(data.egress_categories, 'open_positions') ? (
              <ExportSection
                title="Open positions"
                caption="Your SIMULATED positions in this browser only — never a broker."
                text={sectionText(data.context.open_positions)}
                onCopy={copy}
              />
            ) : (
              <NotSentSection title="Open positions" />
            )}

            <ExportSection
              title="Persona prompt"
              caption={
                dataMode === 'demo'
                  ? 'The demo builds no persona prompt; the sample read is authored.'
                  : undefined
              }
              text={sectionText(data.persona_prompt)}
              onCopy={copy}
            />
            <ExportSection title="Field glossary" text={sectionText(data.glossary)} onCopy={copy} />
          </>
        )}
      </Stack>

      <Snackbar
        open={toast}
        autoHideDuration={2000}
        onClose={() => setToast(false)}
        message={COPY.export.copied}
      />
    </Drawer>
  );
}

/** AC-92 — a category the wire marks `sent: false` renders this explicit line, never an omitted
 *  section: the reader must be able to tell "not applicable to this ticker" from "silently missing".
 *  On the demo nothing is sent because no model is called, so the line says that instead. */
function NotSentSection({ title }: { title: string }) {
  return (
    <Box data-testid="export-not-sent">
      <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'text.primary' }}>{title}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
        {dataMode === 'demo' ? DRAWER_NOT_SENT_DEMO : DRAWER_NOT_SENT}
      </Typography>
    </Box>
  );
}

function ExportSection({
  title,
  caption,
  text,
  onCopy,
}: {
  title: string;
  caption?: string;
  text: string;
  onCopy: (t: string) => void;
}) {
  // A keyboard user can scroll the 220px box only if it takes focus, so it is a named tab stop
  // while its text overflows, and none when the text fits (spec 2026-10-21/02, (a) and (d)).
  // The section titles are distinct, so the region names are too.
  const preRef = useRef<HTMLPreElement>(null);
  const region = useScrollRegion(preRef, `${title} export text`);
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13, color: 'text.primary' }}>
          {title}
        </Typography>
        {/* KEEP amber (stage-3 §4.1: brand-flavored action affordance), but TEXT-GRADE — 11px
            amber text binds `textAmber` via extrasFor (light-mode contrast gate §5.2). */}
        <Button
          onClick={() => onCopy(text)}
          sx={(t) => ({ minWidth: 0, p: 0.25, fontSize: 11, color: extrasFor(t).textAmber })}
        >
          COPY
        </Button>
      </Stack>
      {caption && (
        <Typography
          sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.4, display: 'block', mb: 0.75 }}
        >
          {caption}
        </Typography>
      )}
      <Box
        component="pre"
        ref={preRef}
        {...region}
        sx={{
          m: 0,
          mt: caption ? 0 : 0.75,
          px: 1.5,
          py: 1.25,
          borderRadius: '8px',
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          fontFamily: typographyTokens.monoFontFamily,
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 220,
          overflow: 'auto',
        }}
      >
        {text || '—'}
      </Box>
    </Box>
  );
}
