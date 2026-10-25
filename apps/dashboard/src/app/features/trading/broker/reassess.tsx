/**
 * F6 — reassessment referencing a REAL holding (SPEC flow 3, AC-18/19).
 *
 * The request assembly CALLS the existing machinery, never reimplements it: the subject leg is
 * the projection's `eval_subject` (the existing `evalSubjectOf` selection, untouched), and the
 * contract-reference shape is EXACTLY the shipped `pos_*` position-context shape
 * (`TickerQuery.position` — expiration/strike/right/plPct) the app already assembles for sim
 * holdings. What broker adds is the AS-OF BASIS CARRY: the AI is never handed a real position
 * without its staleness disclosed — the basis line rides the request AND the visible export.
 *
 * ADVISORY ONLY (AC-19): the surface renders the assembled request for copy/hand-off and offers
 * NO Accept-into-store or any other write action. The sim reassessment Accept flow is untouched.
 *
 * The dialog is drawn as the Final reassessment board (`design/src/screens/final/deep-overlays.mjs`,
 * `reassessDlg`; fidelity audit 2026-10-25, DESK-17): 760 wide, a ruled header with close, the basis
 * line, a four-cell holding strip, "The request" with its explanation, the advisory callout, and a
 * read-only footer. Under 600px it is the shared bottom sheet (`shared/ui/bottomSheet.ts`).
 */
import { money } from '@/features/trading/positions/labels';
import { isNotANumber } from '@/shared/copy/notANumber';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { faceFor, MONO_FACE } from '@/shared/figure';
import { downText, extrasFor, upText } from '@/shared/theme/tokens';
import { bottomSheetActionsSx, bottomSheetDialogSx, grabHandleSx } from '@/shared/ui/bottomSheet';
import { dataMode, type BrokerBook, type OptionRight } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useState } from 'react';
import { NOT_PROVIDED, UNAVAILABLE, type BrokerPositionView } from './brokerView';
import { BROKER_COPY, stampTime } from './copy';

/** The existing position-context reference shape (`TickerQuery.position`), reused verbatim. */
export interface PositionContextRef {
  expiration: string;
  strike: number;
  right: OptionRight;
  plPct: number | null;
}

export interface BrokerReassessmentRequest {
  /** `demo_sample` on the demo build: its one holding is authored, so it never claims a broker. */
  source: 'broker_webull' | 'demo_sample';
  ticker: string;
  /** The HUMAN-READABLE basis carry (AC-18) — always present, staleness always disclosed. */
  as_of_basis: string;
  /** The machine stamp beside it (null only if the envelope somehow lacked one — never faked). */
  as_of: string | null;
  structure: string;
  structure_line: string;
  qty: string;
  /** The existing `pos_*` reference — null for a holding with no option subject (shares-only). */
  position: PositionContextRef | null;
  /** The modeled figure NEVER travels without its named basis. */
  modeled_pl_dollar: number | null;
  modeled_pl_basis: string;
}

/** "Oct 7, 2026 · 2:30 PM ET" — the scenario's own clock, in New York time. */
export function demoAsOfText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tz = { timeZone: 'America/New_York' } as const;
  const day = d.toLocaleDateString('en-US', {
    ...tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time} ET`;
}

export function buildBrokerReassessment(
  view: BrokerPositionView,
  book: Pick<BrokerBook, 'as_of'> | null,
  { demo = dataMode === 'demo' }: { demo?: boolean } = {},
): BrokerReassessmentRequest {
  const asOf = book?.as_of ?? null;
  // The EXISTING subject selection (evalSubjectOf, called by the projection — one authority).
  const subject = view.eval_subject;
  const subjectLeg =
    subject.kind === 'none'
      ? null
      : (view.position.legs.find((l) => l.id === subject.leg_id) ?? null);
  const position: PositionContextRef | null =
    subjectLeg != null &&
    subjectLeg.expiration != null &&
    subjectLeg.strike != null &&
    subjectLeg.right != null
      ? {
          expiration: subjectLeg.expiration,
          strike: subjectLeg.strike,
          right: subjectLeg.right,
          plPct: view.pl_pct.kind === 'value' ? view.pl_pct.value : null,
        }
      : null;

  // The demo's holding is authored (canon: public demo data is synthetic): a demo source and a
  // synthetic basis, never a broker's name (Final More overlays, reassessment board).
  const as_of_basis = demo
    ? asOf != null
      ? `on the demo book as of ${demoAsOfText(asOf)} · synthetic · a snapshot, never live.`
      : 'demo book as-of unknown · synthetic · a snapshot, never live.'
    : asOf != null
      ? `on your book as of ${asOf} (${stampTime(asOf)}) · Webull · read-only · read on demand — a snapshot, never live.`
      : 'book as-of unknown — Webull · read-only · read on demand — a snapshot, never live.';
  return {
    source: demo ? 'demo_sample' : 'broker_webull',
    ticker: view.ticker,
    as_of_basis,
    as_of: asOf,
    structure: view.structure_label,
    structure_line: view.structure_line_full,
    qty: view.qty_text,
    position,
    // Dollars to the cent: the leg arithmetic leaves float noise (607.2500000000005) that a reader
    // would copy into a read of their own.
    modeled_pl_dollar: view.pl_dollar == null ? null : Math.round(view.pl_dollar * 100) / 100,
    modeled_pl_basis: BROKER_COPY.modeled.label,
  };
}

/** One cell of the holding strip (the board's `.hd-fig > div`): a caps label over its value, with
 *  an optional basis line under it. A closed not-a-number literal keeps the text face. */
function HoldingCell({
  label,
  value,
  basis,
  tone,
}: {
  label: string;
  value: string;
  basis?: string;
  tone?: 'up' | 'down';
}) {
  return (
    <Box
      sx={(t) => ({
        bgcolor: extrasFor(t).well,
        p: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: 0,
      })}
    >
      <Typography
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.3,
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography
        component="span"
        sx={(t) => ({
          ...faceFor(!isNotANumber(value)),
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.2,
          overflowWrap: 'anywhere',
          color: tone === 'up' ? upText(t) : tone === 'down' ? downText(t) : 'text.primary',
        })}
      >
        {value}
      </Typography>
      {basis && (
        <Typography
          component="span"
          sx={{ fontSize: 11, lineHeight: 1.3, color: 'text.secondary' }}
        >
          {basis}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The four holding facts the request carries, as the row already reads them: the holding, its cost
 * basis (one leg) or net entry (a structure), its mark, and Convexa's modeled P/L, which never
 * travels without its basis label (AC-21). Nothing is computed here; every value is the projection's.
 */
function holdingCells(view: BrokerPositionView, asOf: string | null) {
  const single = view.legs.length === 1;
  const leg = view.legs[0];
  const read = view.leg_reads[0];
  const modeledBasis =
    view.modeled_label === 'dual' && asOf != null
      ? BROKER_COPY.modeled.dualLabel(stampTime(asOf))
      : BROKER_COPY.modeled.label;
  const permanent = !view.entry_known || view.unpriceable;
  return [
    { label: 'Holding', value: `${view.ticker} · ${view.qty_text}` },
    single
      ? { label: 'Cost basis', value: read?.cost_basis_text ?? NOT_PROVIDED }
      : { label: 'Net entry', value: view.net_entry_text },
    single
      ? {
          // The leg's modeled mark — the one the modeled P/L beside it is computed from, so the
          // four cells agree with each other and with the request (never the broker's own figure).
          label: 'Modeled mark',
          value: leg?.mark != null ? `$${leg.mark.toFixed(2)}` : UNAVAILABLE,
        }
      : { label: 'Legs', value: String(view.legs.length) },
    {
      label: 'Modeled P/L',
      value:
        view.pl_dollar != null ? money(view.pl_dollar) : permanent ? NOT_PROVIDED : UNAVAILABLE,
      basis: modeledBasis,
      tone:
        view.pl_dollar == null
          ? undefined
          : view.pl_dollar >= 0
            ? ('up' as const)
            : ('down' as const),
    },
  ];
}

/** Write text to the clipboard; true only when the write resolved. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The row affordance + advisory export dialog. Never a write; never an accept. */
export function BrokerReassessAction({
  view,
  book,
}: {
  view: BrokerPositionView;
  book: Pick<BrokerBook, 'as_of'> | null;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const requestLabelId = useId();
  // The button says what the clipboard actually did: a denied or missing clipboard reads
  // "Couldn't copy", never "Copied" (review W1-58).
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (copied === 'idle') return;
    const id = setTimeout(() => setCopied('idle'), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  if (view.fidelity === 'unrecognized') return null; // nothing faithful to reference
  const req = buildBrokerReassessment(view, book);
  const json = JSON.stringify(req, null, 2);

  return (
    <>
      <Button
        size="small"
        variant="text"
        data-testid="broker-reassess"
        onClick={() => setOpen(true)}
        sx={{ minHeight: 44 }}
      >
        Build reassessment
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth={false}
        fullWidth
        aria-labelledby={titleId}
        // The board's 760 (DESK-17) on the theme's flat overlay panel; a bottom sheet under 600px.
        sx={bottomSheetDialogSx}
        slotProps={{ paper: { sx: { maxWidth: 760 } } }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box aria-hidden sx={grabHandleSx} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: '18px',
              py: '14px',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <Typography
                id={titleId}
                component="h2"
                sx={{
                  flex: '1 1 160px',
                  minWidth: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {`Reassessment request · ${view.ticker}`}
              </Typography>
              {dataMode === 'demo' && <DataStateTag state="sample" />}
            </Box>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close"
              sx={{ color: 'text.secondary', mr: -0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{ px: '18px', py: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* The visible basis carry (AC-18) — foregrounded, not buried in the JSON. */}
            <Typography
              data-testid="broker-reassess-basis"
              sx={{
                ...MONO_FACE,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.5,
                color: 'text.secondary',
              }}
            >
              {req.as_of_basis}
            </Typography>

            {/* The holding the request references, as the row reads it (the board's strip). */}
            <Box
              data-testid="broker-reassess-holding"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(4, minmax(0, 1fr))',
                },
                gap: '1px',
                bgcolor: 'divider',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {holdingCells(view, book?.as_of ?? null).map((c) => (
                <HoldingCell key={c.label} {...c} />
              ))}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Typography
                component="span"
                id={requestLabelId}
                sx={{ fontSize: 12.5, fontWeight: 600 }}
              >
                The request
              </Typography>
              <Box
                component="pre"
                data-testid="broker-reassess-json"
                aria-labelledby={requestLabelId}
                sx={{
                  ...MONO_FACE,
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  color: 'text.secondary',
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px',
                  p: '10px 12px',
                  m: 0,
                  overflow: 'auto',
                  maxHeight: 320,
                  // Wrap long values (the basis line) inside the box, never past its edge.
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {json}
              </Box>
              <Typography
                component="span"
                sx={{ fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}
              >
                Exactly the position-context shape a read takes for a simulated holding, plus the
                as-of basis: a real holding never travels without its age.
              </Typography>
            </Box>

            <Box
              data-testid="broker-reassess-advisory"
              sx={(t) => ({
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                p: '10px 12px',
                borderRadius: '8px',
                bgcolor: extrasFor(t).panelRaised,
                fontSize: 12.5,
                lineHeight: 1.45,
                color: 'text.secondary',
              })}
            >
              <ShieldOutlined aria-hidden sx={{ fontSize: 14, mt: '2px', flex: '0 0 auto' }} />
              <Typography component="span" sx={{ fontSize: 12.5, lineHeight: 1.45 }}>
                <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  Advisory only.
                </Box>{' '}
                Copy it into a read of your own. Nothing here places, changes or cancels an order,
                and nothing is added to your book.
                {dataMode === 'demo' ? ' On the demo nothing is sent.' : ''}
              </Typography>
            </Box>
          </Box>

          {/* Advisory display only: copy + close. NO accept, NO write, NO order path (AC-19). */}
          <Box
            sx={[
              {
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                px: '18px',
                py: '12px',
                borderTop: 1,
                borderColor: 'divider',
              },
              bottomSheetActionsSx,
            ]}
          >
            <Typography
              component="span"
              sx={{ flex: '1 1 260px', fontSize: 12, lineHeight: 1.45, color: 'text.secondary' }}
            >
              Read-only brokerage: Convexa never writes to it.
            </Typography>
            <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
              Close
            </Button>
            <Button
              variant="outlined"
              data-testid="broker-reassess-copy"
              aria-live="polite"
              startIcon={<ContentCopyOutlined />}
              sx={{ '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: 14 } }}
              onClick={() => {
                void copyText(json).then((ok) => setCopied(ok ? 'copied' : 'failed'));
              }}
            >
              {copied === 'copied'
                ? 'Copied'
                : copied === 'failed'
                  ? 'Couldn’t copy'
                  : 'Copy request'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
