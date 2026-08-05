/**
 * BrokerPositionRow — one real holding, desktop grammar. A NEW component sharing the sim book's
 * RENDER grammar through the `PositionView` projection — deliberately NOT the sim row with writes
 * propped off (the SPEC's rejected list): READ-ONLY here is ABSENCE. No Close, no Trim, no Roll,
 * no entry affordance, not even disabled ones.
 *
 * Two degradation axes, independent (SPEC §4 grid):
 *  - market-data axis (`streamOffline`): dims ONLY the modeled P/L to ⏸ last-known — never blanks;
 *  - book-snapshot axis (`isStale`): the S6 treatment on ONLY the snapshot fields (legs,
 *    quantities, broker facts); the modeled figure keeps updating under its DUAL-basis label.
 *
 * FIDELITY (G1, corrected post-capture). Only `unrecognized` — a position with NO mapped legs —
 * gets the bare cannot-fully-display entry. `partial` renders the FULL row grammar plus its
 * fidelity notes: under the real Webull feed 9 of 14 positions are `partial` (the feed carries no
 * strike/expiry/right for a held option), and routing them all into the bare state discarded the
 * quantity, cost and mark Webull DID supply. Reporting less than we honestly know is its own
 * dishonesty. Nothing is invented in the gap — the missing facts render `not provided` and each
 * omission is named in the notes.
 */
import { money } from '@/features/trading/positions/labels';
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { BrokerPositionView } from './brokerView';
import { NOT_PROVIDED, UNAVAILABLE } from './brokerView';
import { BROKER_COPY, stampTime } from './copy';

export interface BrokerRowProps {
  view: BrokerPositionView;
  /** Market-data axis (SSE) — governs the modeled P/L ONLY. */
  streamOffline: boolean;
  /** Book-snapshot axis — governs the snapshot fields ONLY. */
  isStale: boolean;
  /** The book's as_of ISO (for the dual-basis label). */
  asOf: string | null;
  /** F6 slot — the advisory reassessment affordance (never a write). */
  actions?: ReactNode;
}

/** The S6 stale treatment for snapshot-family cells: dimmed, marked, never blanked. */
export const STALE_SNAPSHOT_SX = { opacity: 0.62 } as const;

/**
 * The tri-state literal with its honest tooltip (the fifth not-a-number literal's tip).
 * `tip` overrides the default `not provided` explanation where the slot has a more specific one
 * (G3: the modeled figure's "we can't identify this contract" case).
 */
export function FactText({ text, testid, tip }: { text: string; testid?: string; tip?: string }) {
  if (text === NOT_PROVIDED) {
    return (
      <Tooltip title={tip ?? BROKER_COPY.notProvidedTip}>
        <Box
          component="span"
          data-testid={testid}
          sx={{ color: 'text.disabled', fontStyle: 'italic' }}
        >
          {NOT_PROVIDED}
        </Box>
      </Tooltip>
    );
  }
  if (text === UNAVAILABLE) {
    return (
      <Box component="span" data-testid={testid} sx={{ color: 'text.disabled' }}>
        {UNAVAILABLE}
      </Box>
    );
  }
  return (
    <Box component="span" data-testid={testid}>
      {text}
    </Box>
  );
}

/** The modeled P/L block — figure + its basis label (AC-21: the figure NEVER renders unlabeled). */
export function ModeledPl({
  view,
  streamOffline,
  asOf,
}: {
  view: BrokerPositionView;
  streamOffline: boolean;
  asOf: string | null;
}) {
  const dual = view.modeled_label === 'dual' && asOf != null;
  const label = dual ? BROKER_COPY.modeled.dualLabel(stampTime(asOf)) : BROKER_COPY.modeled.label;
  const tip = dual
    ? `${BROKER_COPY.modeled.tip} ${BROKER_COPY.modeled.dualTipAppend(stampTime(asOf as string))}`
    : BROKER_COPY.modeled.tip;

  let figure: ReactNode;
  if (view.pl_dollar != null) {
    figure = (
      <Typography
        component="span"
        data-testid="broker-pl"
        sx={{
          fontFamily: typographyTokens.monoFontFamily,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: view.pl_dollar >= 0 ? 'success.main' : 'error.main',
          opacity: streamOffline ? 0.5 : 1,
        }}
      >
        {streamOffline ? '⏸ ' : ''}
        {money(view.pl_dollar)}
      </Typography>
    );
  } else {
    // G3 — PERMANENT vs THIS-CYCLE. `unavailable` is a this-cycle framing: it promises a refresh
    // might fix it. A contract the feed never identified (`unpriceable`), or a cost basis it never
    // sent, will still be missing next cycle — that is the FEED literal, `not provided`. Only a
    // genuinely transient unresolved mark keeps `unavailable`.
    const permanent = !view.entry_known || view.unpriceable;
    figure = (
      <Typography component="span" data-testid="broker-pl" sx={{ color: 'text.disabled' }}>
        <FactText
          text={permanent ? NOT_PROVIDED : UNAVAILABLE}
          tip={view.unpriceable ? BROKER_COPY.modeled.unpriceableTip : undefined}
        />
      </Typography>
    );
  }

  return (
    <Box sx={{ textAlign: 'right', minWidth: 0 }}>
      {figure}
      <Tooltip title={tip}>
        <Typography
          component="div"
          data-testid="broker-pl-label"
          sx={{
            fontSize: '0.6875rem',
            color: 'text.secondary',
            fontFamily: typographyTokens.monoFontFamily,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </Tooltip>
    </Box>
  );
}

/** The leg lines — side WORD, size, instrument, expiry, and the broker cost-basis fact. */
export function LegLines({ view }: { view: BrokerPositionView }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', mt: '6px' }}>
      {view.legs.map((leg, i) => {
        const read = view.leg_reads[i];
        return (
          <Typography
            key={leg.leg_id}
            component="div"
            data-testid="broker-leg-line"
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              fontFamily: typographyTokens.monoFontFamily,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {leg.side_word} {leg.size_text} <FactText text={leg.instrument_text} />
            {leg.expiry_text !== '—' && (
              <>
                {' · '}
                <FactText text={leg.expiry_text} />
              </>
            )}
            {' · cost '}
            <FactText text={read?.cost_basis_text ?? NOT_PROVIDED} />
          </Typography>
        );
      })}
    </Box>
  );
}

/**
 * The named omissions, shared by the FULL `partial` row and the bare `unrecognized` entry (G1).
 * ONE component so the two states can never disagree about how an omission is surfaced — and the
 * `broker-fidelity-note` testid stays the single hook for "every omission is named".
 */
export function FidelityNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <>
      {notes.map((n) => (
        <Typography
          key={n}
          component="div"
          data-testid="broker-fidelity-note"
          sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: '2px' }}
        >
          {n}
        </Typography>
      ))}
    </>
  );
}

/**
 * The explicit cannot-fully-display entry — `unrecognized` ONLY (a position with no mapped legs).
 * Counted, named, honest: surfaced rather than dropped, and never flattened into a plausible-looking
 * wrong position (AC-14).
 */
export function UnfaithfulEntry({ view }: { view: BrokerPositionView }) {
  return (
    <Box data-testid="broker-row-unfaithful" sx={{ minWidth: 0 }}>
      <Typography component="div" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
        {view.ticker || view.broker.broker_position_id}
      </Typography>
      <Typography component="div" sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: '2px' }}>
        {BROKER_COPY.cannotFullyDisplay}
      </Typography>
      <FidelityNotes notes={view.fidelity_notes} />
    </Box>
  );
}

/** The structure name chip; `custom` carries its no-diagnosis tip. */
export function StructureChip({ view }: { view: BrokerPositionView }) {
  const chip = (
    <Box
      component="span"
      data-testid="broker-structure-chip"
      sx={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'text.secondary',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        padding: '1px 6px',
        whiteSpace: 'nowrap',
      }}
    >
      {view.structure_label}
    </Box>
  );
  return view.structure === 'custom' ? (
    <Tooltip title={BROKER_COPY.customTip}>{chip}</Tooltip>
  ) : (
    chip
  );
}

export function BrokerPositionRow({ view, streamOffline, isStale, asOf, actions }: BrokerRowProps) {
  // G1 — ONLY `unrecognized` (no mapped legs) gets the bare entry. `partial` keeps the full grammar.
  const unfaithful = view.fidelity === 'unrecognized';
  return (
    <Box
      data-testid="broker-row"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1.6fr) minmax(120px, 1fr) minmax(110px, 1fr) auto',
        alignItems: 'start',
        gap: '12px',
        padding: '12px 14px',
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      {unfaithful ? (
        <Box sx={{ gridColumn: '1 / span 3', ...(isStale ? STALE_SNAPSHOT_SX : {}) }}>
          <UnfaithfulEntry view={view} />
        </Box>
      ) : (
        <>
          {/* Snapshot family: ticker · structure · legs (book-snapshot axis ONLY). */}
          <Box data-testid="broker-snapshot-fields" sx={isStale ? STALE_SNAPSHOT_SX : undefined}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {view.ticker}
              </Typography>
              <StructureChip view={view} />
              <Typography
                component="span"
                sx={{
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  fontFamily: typographyTokens.monoFontFamily,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {view.structure_line_collapsed}
              </Typography>
            </Box>
            <LegLines view={view} />
            {/* `partial`: the full row above, plus every omission named underneath it. */}
            <FidelityNotes notes={view.fidelity_notes} />
          </Box>

          <Box sx={isStale ? STALE_SNAPSHOT_SX : undefined}>
            <CellLabel>Qty</CellLabel>
            <Mono data-testid="broker-qty">{view.qty_text}</Mono>
          </Box>

          <Box sx={isStale ? STALE_SNAPSHOT_SX : undefined}>
            <CellLabel>Net entry</CellLabel>
            <Mono data-testid="broker-net-entry">
              <FactText text={view.net_entry_text} />
            </Mono>
          </Box>
        </>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        {/* The modeled figure — market-data axis ONLY; renders even on unfaithful entries when
            enough legs mapped (partial keeps its mapped legs; unrecognized withholds). */}
        <ModeledPl view={view} streamOffline={streamOffline} asOf={asOf} />
        {actions}
      </Box>
    </Box>
  );
}

function CellLabel({ children }: { children: ReactNode }) {
  return (
    <Typography component="div" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

function Mono({ children, ...rest }: { children: ReactNode; 'data-testid'?: string }) {
  return (
    <Typography
      component="div"
      {...rest}
      sx={{
        fontFamily: typographyTokens.monoFontFamily,
        fontVariantNumeric: 'tabular-nums',
        fontSize: '0.85rem',
      }}
    >
      {children}
    </Typography>
  );
}
