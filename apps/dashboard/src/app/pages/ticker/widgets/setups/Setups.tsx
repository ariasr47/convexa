/**
 * Setups — the rule-based setup cards with conviction tags (Figma `Ticker · Setups`, node 149:687),
 * or the calm "no clean setup" info. Each card: setup name + a tinted conviction chip (HIGH amber /
 * MEDIUM blue / LOW grey) over the plain-language rationale. Static bundle read off `signals.setups`.
 *
 * Ticker fidelity repair, change 2 (F2) — the widget spans 2 of the context band's 3 columns
 * (`span={2}` below); its setup cards lay out as a 2-column grid inside that span, not a vertical
 * stack (the pre-repair app rendered "three full-width rows" — `FIDELITY_AUDIT.md` F2).
 *
 * Owner decision NO-1 A (2026-10-25, fidelity lane L5): in the quiet band the card is the board's
 * summary (`design/src/screens/final/ticker-desk.mjs:232`): the first setup and its conviction as one
 * Sans figure ("Balanced structure · medium"), its basis and rationale as the one line, and on the
 * demo the sample source chip; on the live build the foot states the structure's as-of. The setup
 * cards with their conviction chips render in the expand overlay.
 */
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import { useWidgetProvenance } from '@/shared/ui/Widget/WidgetProvenanceContext';
import type { Setup } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { memo, type ReactNode } from 'react';
import { setupsSubtitle } from '../_kit/copy';
import {
  ContextSummary,
  OverlayFoot,
  OverlayLead,
  QUIET_BODY_SX,
  structureAsOf,
  SummaryFoot,
  SummaryOrFull,
} from '../market-context/ContextSummary';

/** The board's sample source chip for this card (`ticker-desk.mjs:232`). */
const SAMPLE_SOURCE = 'Sample · shaped like scanner setups';

// Two states collapsed to one sentence (SPEC §4.6 criterion 56a): `undefined` — never delivered,
// a ticker nobody scored, no market fact to state — reads "Setups unavailable this cycle."; `[]`
// — checked and genuinely empty — keeps the shipped sentence byte-for-byte. The band summary and the
// overlay say the same two sentences.
const UNAVAILABLE = 'Setups unavailable this cycle.';
const NONE = 'No clean setup right now.';

interface Props {
  setups: Setup[] | undefined;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

// Stage-3 §5.3: HIGH binds the new brand-amber `emphasis` tone — a high-conviction setup is the
// "one line that matters" spend, NOT a warning (the old mechanical burnt-orange inheritance).
const convictionTone = (c: string): 'emphasis' | 'info' | 'neutral' => {
  const v = c.toLowerCase();
  return v === 'high' ? 'emphasis' : v === 'medium' ? 'info' : 'neutral';
};

/**
 * The quiet-band summary: "Balanced structure · medium", then "Rule-based · the same structure
 * snapshot · <rationale>", and how many more setups the overlay holds when there are more.
 */
function SetupsSummary({ setups, foot }: { setups: Setup[] | undefined; foot: ReactNode }) {
  if (setups === undefined) return <ContextSummary line={UNAVAILABLE} foot={foot} />;
  if (setups.length === 0) return <ContextSummary line={NONE} foot={foot} />;
  const [first] = setups;
  const more = setups.length - 1;
  return (
    <ContextSummary
      face="sans"
      figure={`${first.name} · ${first.conviction.toLowerCase()}`}
      line={[
        'Rule-based · the same structure snapshot',
        // A trailing full stop would sit before the next " · "; the overlay keeps the sentence whole.
        first.rationale.replace(/\.$/, ''),
        ...(more > 0 ? [`${more} more ${more === 1 ? 'setup' : 'setups'}`] : []),
      ].join(' · ')}
      foot={foot}
    />
  );
}

/** The setup cards, in the expand overlay: the subtitle, then every setup with its conviction chip. */
function SetupsFull({
  setups,
  subtitle,
  foot,
}: {
  setups: Setup[] | undefined;
  subtitle: string;
  foot: ReactNode;
}) {
  return (
    <Box>
      <OverlayLead>{subtitle}</OverlayLead>
      {setups === undefined ? (
        <Alert severity="info">{UNAVAILABLE}</Alert>
      ) : setups.length ? (
        <Box
          data-testid="setups-grid"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}
        >
          {/* Ticker fidelity repair, change 2 (F2) close-out: a plain `Box`, not a bordered `Card`/
              `CardContent` — the design's compact setup card (`design/src/screens/desk.mjs`'s
              `ctx-2` setups block: `padding: 12px 14px`, `background: var(--ink-2)`, one hairline
              border, no elevation) rather than MUI Card's default ≈16px padding + shadow. */}
          {setups.map((s, i) => (
            <Box
              key={i}
              sx={(t) => ({
                borderRadius: '10px',
                border: `1px solid ${t.palette.divider}`,
                bgcolor: 'background.paper',
                p: 1.5,
                minWidth: 0,
              })}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                <TintChip tone={convictionTone(s.conviction)} label={s.conviction.toUpperCase()} />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {s.rationale}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">{NONE}</Alert>
      )}
      {foot != null && <OverlayFoot>{foot}</OverlayFoot>}
    </Box>
  );
}

export const Setups = memo(function Setups({ setups, structureAgeSeconds = null }: Props) {
  // The foot: the sample source chip on the demo (so the head carries no Sample tag, owner D1), the
  // structure's as-of on the live build. The overlay repeats only the chip; its caption already
  // states the as-of.
  const sample = useWidgetProvenance() === 'sample';
  const foot = (
    <SummaryFoot
      sample={sample}
      sampleSource={SAMPLE_SOURCE}
      basis={structureAsOf(structureAgeSeconds)}
    />
  );
  return (
    // NO-1 A: the subtitle moved into the overlay body (`SetupsFull`), since the Widget header is
    // shared by the band card and the overlay.
    <Widget id="setups" title="Setups" span={2} sampleTag={false} bodySx={QUIET_BODY_SX}>
      <SummaryOrFull
        summary={<SetupsSummary setups={setups} foot={foot} />}
        full={
          <SetupsFull
            setups={setups}
            subtitle={setupsSubtitle(structureAgeSeconds)}
            foot={sample ? foot : null}
          />
        }
      />
    </Widget>
  );
});

export default Setups;
