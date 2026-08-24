/**
 * `/scanner` — the per-datum presentational atoms, shared by the table (≥sm) and the card (<sm), so a
 * datum is rendered exactly ONE way on this surface and the two layouts can never drift.
 *
 * The colour rules live here and nowhere else (convexa-design):
 *   - `ChgCell` is the ONLY green/red on the page — PRICE DIRECTION.
 *   - `ScoreCell`, `LevelDistCell`, `LabelCell` are NEUTRAL. A score is a rate and a distance is a
 *     signed proximity; tinting either manufactures a verdict the datum cannot support (the exact
 *     class the Stage-3 sweep caught on a proximity chip).
 *   - `TierCell` is the row's SINGLE amber spend (`TintChip tone="emphasis"` ⇒ the text-grade
 *     `textAmber` resolved through `extrasFor` inside TintChip). Nothing else on a row is amber.
 *   - `StatusCell` warning tones carry a ⚠ GLYPH in the label — hue never carries "warning" alone.
 * Every nullable value renders the em-dash, never `0`. All colour is a theme token; zero hex.
 */
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { typographyTokens } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui/TintChip';
import type { ScanRow } from '@convexa/api';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  dash,
  directionColor,
  EM_DASH,
  fmtDelta,
  fmtPrice,
  fmtScore,
  fmtSignedPct,
  relAge,
  updatedText,
  type PollDelta,
} from './format';
import {
  regimeLabel,
  SCAN_COPY,
  statusMeta,
  tierLabel,
  volRegimeLabel,
  whyThisRow,
} from './labels';

/** Figures are mono + tabular by construction — numerals are the personality (skill rule 6). */
export const MONO = {
  fontFamily: typographyTokens.monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0,
} as const;

/** Honestly-missing. */
export function Dash({ testid }: { testid?: string }) {
  return (
    <Typography
      component="span"
      data-testid={testid}
      sx={{ ...MONO, fontSize: 'inherit', color: 'text.secondary' }}
    >
      {EM_DASH}
    </Typography>
  );
}

/**
 * Price — the page's ONE motion cue: a paint-only colour pulse on change via the shared
 * `useFlashOnChange` (which is inert under `prefers-reduced-motion` and declares no new keyframe
 * family). It is a polled data signal, NOT a stream, and is never labelled as one.
 */
export function PriceCell({ row, active }: { row: ScanRow; active: boolean }) {
  const flash = useFlashOnChange(row.price, { active });
  return (
    <Typography
      component="span"
      data-testid="cell-price"
      sx={[{ ...MONO, fontSize: 'inherit', color: 'text.primary' }, flashColorSx(flash)]}
    >
      {dash(row.price, fmtPrice)}
    </Typography>
  );
}

/** Chg % — THE only direction colour on this surface. */
export function ChgCell({ row }: { row: ScanRow }) {
  return (
    <Typography
      component="span"
      data-testid="cell-chg"
      sx={{ ...MONO, fontSize: 'inherit', color: directionColor(row.chg_pct) }}
    >
      {dash(row.chg_pct, fmtSignedPct)}
    </Typography>
  );
}

/** Score — the headline rate. NEVER green/red, NEVER amber.
 *  Tooltip carries 1–2 plain-language drivers from closed wire fields ("why this row").
 *  Optional poll-to-poll delta is NEUTRAL (structure change, not P/L direction).
 *  tabIndex=0 so keyboard users can focus and open the tip (spine #6). */
export function ScoreCell({
  row,
  delta,
  focusableHelp = true,
}: {
  row: ScanRow;
  delta?: PollDelta | null;
  focusableHelp?: boolean;
}) {
  const why = whyThisRow(row);
  const d =
    delta?.scoreDelta != null && Number.isFinite(delta.scoreDelta)
      ? fmtDelta(delta.scoreDelta, 0)
      : '';
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
      <Tooltip arrow title={why} describeChild={focusableHelp}>
        <Typography
          component="span"
          {...(focusableHelp ? { tabIndex: 0 } : {})}
          data-testid="cell-score"
          {...(focusableHelp ? { 'aria-label': SCAN_COPY.whyScoreAria } : {})}
          sx={{
            ...MONO,
            fontSize: 'inherit',
            fontWeight: 600,
            color: 'text.primary',
            cursor: 'help',
            borderBottom: '1px dotted',
            borderColor: 'divider',
            borderRadius: '2px',
          }}
        >
          {dash(row.score, fmtScore)}
        </Typography>
      </Tooltip>
      {d ? (
        <Typography
          component="span"
          data-testid="cell-score-delta"
          sx={{ ...MONO, fontSize: '0.7rem', color: 'text.secondary' }}
        >
          {d}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Tier — the row's single amber spend, via the closed lookup. A miss renders nothing but a dash. */
export function TierCell({ row }: { row: ScanRow }) {
  const label = tierLabel(row.tier);
  return label ? <TintChip tone="emphasis" label={label} /> : <Dash testid="cell-tier" />;
}

/** Regime / Vol — closed-lookup labels, neutral. A lookup miss renders the dash, never the raw enum. */
export function LabelCell({ text, testid }: { text: string | null; testid: string }) {
  return (
    <Typography
      component="span"
      data-testid={testid}
      sx={{ fontSize: 'inherit', color: 'text.secondary' }}
    >
      {text ?? EM_DASH}
    </Typography>
  );
}

export const regimeTextOf = (row: ScanRow) => regimeLabel(row.regime);
export const volTextOf = (row: ScanRow) => volRegimeLabel(row.vol_regime);

/** A consumed level + its consumed signed distance. Both arrive pre-computed on the wire; the
 *  distance is a NO-SIDE datum and stays neutral. Optional poll delta is also neutral. */
export function LevelDistCell({
  level,
  distPct,
  testid,
  distDelta,
}: {
  level: number | null;
  distPct: number | null;
  testid: string;
  /** Change in dist% since last poll (structure only). */
  distDelta?: number | null;
}) {
  const d = distDelta != null && Number.isFinite(distDelta) ? fmtDelta(distDelta, 1) : '';
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
      <Box component="span" sx={{ ...MONO, fontSize: 'inherit', color: 'text.primary' }}>
        {dash(level, fmtPrice)}
      </Box>
      <Box
        component="span"
        data-testid={testid}
        sx={{ ...MONO, fontSize: '0.6875rem', color: 'text.secondary' }}
      >
        {dash(distPct, fmtSignedPct)}
      </Box>
      {d ? (
        <Box
          component="span"
          data-testid={`${testid}-delta`}
          sx={{ ...MONO, fontSize: '0.6875rem', color: 'text.secondary' }}
        >
          {d}
        </Box>
      ) : null}
    </Box>
  );
}

/** "Structure as-of {rel}" — or the dash when there is no honest claim (`building`, or a
 *  non-positive `as_of`). `updatedText` branches on status BEFORE it reads `as_of`. */
export function UpdatedCell({ row, nowS }: { row: ScanRow; nowS: number }) {
  const text = updatedText(row, nowS);
  return (
    <Typography
      component="span"
      data-testid="cell-updated"
      sx={{ ...MONO, fontSize: '0.7rem', color: 'text.secondary' }}
    >
      {text ?? EM_DASH}
    </Typography>
  );
}

/** The closed-lookup status chip. `ok` is QUIET (no chip — freshness is the only cue). */
export function StatusCell({ row, nowS }: { row: ScanRow; nowS: number }) {
  const meta = statusMeta(row.status);
  if (meta.label == null || meta.tone == null) return null;
  const rel = Number.isFinite(row.as_of) && row.as_of > 0 ? relAge(nowS - row.as_of) : 'a while';
  return (
    <Tooltip arrow title={meta.tip(rel)}>
      <Box component="span" data-testid="cell-status" data-tone={meta.tone}>
        <TintChip tone={meta.tone} label={meta.label} />
      </Box>
    </Tooltip>
  );
}
