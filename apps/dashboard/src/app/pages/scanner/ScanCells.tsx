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
 * Every nullable value renders one of the closed nine, never `0` (curvature-v2-surfaces criteria 3,
 * 4, 17). All colour is a theme token; zero hex.
 *
 * REGISTER (curvature-v2-surfaces SPEC §2.1). Every atom below resolves its type register through
 * `shared/figure`'s `figureStateOf` + `faceFor` — the ONE figure-state decision FE-1 extracted from
 * `FigureCell`. This file no longer binds a font family of its own (criterion N-1, needle 2): the
 * mono constant this file used to declare is gone, replaced everywhere by a call to `faceFor`. The
 * absent-value arm of every atom below now renders through the module's literal branch instead —
 * always the Sans face, never stepped, never a unit, and — the defect this closes (criterion 17) —
 * never sharing a typeface with the traced numeric figures beside it.
 *
 * `data-figure-state` and `data-figure-register` sit on the atom's OWN node (never assume
 * co-location elsewhere on the surface, SPEC §2.1) — no scanner figure ever carries a `live` claim
 * (criteria 10, 11A: the price included), so every call below either omits `live` entirely or the
 * type system rejects anything but the branded `NOT_LIVE`.
 */
import { faceFor, figureStateOf, PauseMark } from '@/shared/figure';
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
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
import { SCAN_COPY, statusMeta, tierLookup, whyThisRow, type ClosedLookupResult } from './labels';

/**
 * Honestly-missing (U-6 + criterion 17). `value` is a member of the closed nine (`unavailable` on a
 * closed-lookup MISS, the bare `—` on a genuine absence) — always Sans, register ignored (AC-19),
 * never the mono run the shipped em-dash used to sit inside.
 */
export function Dash({ testid, value = EM_DASH }: { testid?: string; value?: string }) {
  const { figureState, mono } = figureStateOf({ value, register: 'traced' });
  return (
    <Typography
      component="span"
      data-testid={testid}
      data-figure-state={figureState}
      data-figure-register={mono ? 'mono' : 'sans'}
      sx={{ ...faceFor(mono), fontSize: 'inherit', color: 'text.secondary' }}
    >
      {value}
    </Typography>
  );
}

/**
 * Price — the page's ONE motion cue: a paint-only colour pulse on change via the shared
 * `useFlashOnChange` (which is inert under `prefers-reduced-motion` and declares no new keyframe
 * family). It is a polled data signal, NOT a stream, and is never labelled as one — no `live` claim
 * is ever passed here (criterion 11A: no scanner figure, the price included, carries a live mark in
 * any connection state).
 */
export function PriceCell({
  row,
  active,
  offline,
}: {
  row: ScanRow;
  active: boolean;
  /** SPEC §2.2 — `null`/`undefined` outside a drop; `{ retained: true }` only when the displayed
   *  price came from the now-dead stream. `retained: false` cannot occur on this surface (criterion
   *  13) because the caller only ever produces it when a live price already exists. */
  offline?: { retained: boolean } | null;
}) {
  const flash = useFlashOnChange(row.price, { active });
  const value = dash(row.price, fmtPrice);
  const { figureState, mono, dim, showPause, caption } = figureStateOf({
    value,
    register: 'traced',
    offline: offline ?? null,
  });
  const glyph = (
    <Typography
      component="span"
      data-testid="cell-price"
      data-figure-state={figureState}
      data-figure-register={mono ? 'mono' : 'sans'}
      sx={[
        {
          ...faceFor(mono),
          fontSize: 'inherit',
          color: 'text.primary',
          ...(dim ? { opacity: 0.5 } : {}),
        },
        flashColorSx(flash),
      ]}
    >
      {value}
    </Typography>
  );
  if (!showPause) return glyph;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
      <PauseMark />
      {glyph}
      {caption ? (
        <Typography
          component="span"
          data-testid="cell-price-caption"
          sx={{ ...faceFor(true), fontSize: '0.6875rem', color: 'text.secondary' }}
        >
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Chg % — THE only direction colour on this surface. */
export function ChgCell({ row }: { row: ScanRow }) {
  const value = dash(row.chg_pct, fmtSignedPct);
  const { figureState, mono } = figureStateOf({ value, register: 'traced' });
  return (
    <Typography
      component="span"
      data-testid="cell-chg"
      data-figure-state={figureState}
      data-figure-register={mono ? 'mono' : 'sans'}
      sx={{ ...faceFor(mono), fontSize: 'inherit', color: directionColor(row.chg_pct) }}
    >
      {value}
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
  const value = dash(row.score, fmtScore);
  const { figureState, mono } = figureStateOf({ value, register: 'traced' });
  // The bar (design/src/screens/scanner.mjs:35, `score bar + number`) — present on every row that
  // has a real numeric score. NEUTRAL fill (`text.secondary`), never conditionally amber like the
  // design's own mock: the shipped invariant is "the scan surface's ONE amber spend is the per-row
  // tier chip" (`stage3-amber.spec.ts:328`) — a second amber-bearing element here would break it.
  const hasScore = typeof row.score === 'number' && Number.isFinite(row.score);
  const pct = hasScore ? Math.max(0, Math.min(100, row.score as number)) : 0;
  const score = (
    <Typography
      component="span"
      {...(focusableHelp ? { tabIndex: 0 } : {})}
      data-testid="cell-score"
      data-figure-state={figureState}
      data-figure-register={mono ? 'mono' : 'sans'}
      aria-label={SCAN_COPY.whyScoreAria}
      sx={{
        ...faceFor(mono),
        fontSize: 'inherit',
        fontWeight: 600,
        color: 'text.primary',
        cursor: 'help',
        borderBottom: '1px dotted',
        borderColor: 'divider',
        borderRadius: '2px',
      }}
    >
      {value}
    </Typography>
  );
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {focusableHelp ? (
        <Tooltip arrow title={why}>
          {score}
        </Tooltip>
      ) : (
        score
      )}
      {hasScore && (
        <Box
          data-testid="cell-score-bar"
          aria-hidden
          sx={{
            width: 36,
            height: 5,
            borderRadius: '3px',
            // `action.disabledBackground` — the shipped "quiet track" token (already spent on
            // AlertsPage.tsx's refused-control chrome); the OTHER raised-panel-adjacent token one
            // reach away is reserved unconsumed by a live contrast guard in `shared/theme`, so it
            // is not a candidate here.
            bgcolor: 'action.disabledBackground',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box
            sx={{ display: 'block', height: '100%', width: `${pct}%`, bgcolor: 'text.secondary' }}
          />
        </Box>
      )}
      {d ? (
        <Typography
          component="span"
          data-testid="cell-score-delta"
          sx={{ ...faceFor(true), fontSize: '0.7rem', color: 'text.secondary' }}
        >
          {d}
        </Typography>
      ) : null}
    </Box>
  );
}

/** Tier — the row's single amber spend, via the closed lookup, reserved for `Prime`
 *  (design/src/screens/scanner.mjs's `tierChip`, "amber Prime" — surfaces fidelity repair, change
 *  4/F8). Every other resolved tier renders the SAME chip shape in the neutral tone — still a real
 *  chip, still closed-lookup text, just not a second amber spend on the row. A MISS renders
 *  `unavailable`, a genuine absence renders `—` (U-6) — never the raw enum, never conflated. */
export function TierCell({ row }: { row: ScanRow }) {
  const result = tierLookup(row.tier);
  return result.kind === 'value' ? (
    <TintChip tone={row.tier === 'prime' ? 'emphasis' : 'neutral'} label={result.text} />
  ) : (
    <Dash testid="cell-tier" value={result.kind === 'miss' ? 'unavailable' : EM_DASH} />
  );
}

/** Regime / Vol — closed-lookup labels, neutral. A MISS renders `unavailable`, a genuine absence
 *  renders `—` (U-6) — never the raw enum. The lookup HIT keeps its shipped byte-identical render
 *  (plain Sans secondary text; CF-1 touches no scanner sentence, and this is not one). */
export function LabelCell({ result, testid }: { result: ClosedLookupResult; testid: string }) {
  if (result.kind === 'value') {
    return (
      <Typography
        component="span"
        data-testid={testid}
        data-figure-register="sans"
        sx={{ fontSize: 'inherit', color: 'text.secondary' }}
      >
        {result.text}
      </Typography>
    );
  }
  return <Dash testid={testid} value={result.kind === 'miss' ? 'unavailable' : EM_DASH} />;
}

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
  const levelValue = dash(level, fmtPrice);
  const levelState = figureStateOf({ value: levelValue, register: 'traced' });
  const distValue = dash(distPct, fmtSignedPct);
  const distState = figureStateOf({ value: distValue, register: 'traced' });
  const d = distDelta != null && Number.isFinite(distDelta) ? fmtDelta(distDelta, 1) : '';
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
      <Box
        component="span"
        data-testid={`${testid}-level`}
        data-figure-state={levelState.figureState}
        data-figure-register={levelState.mono ? 'mono' : 'sans'}
        sx={{ ...faceFor(levelState.mono), fontSize: 'inherit', color: 'text.primary' }}
      >
        {levelValue}
      </Box>
      <Box
        component="span"
        data-testid={testid}
        data-figure-state={distState.figureState}
        data-figure-register={distState.mono ? 'mono' : 'sans'}
        sx={{ ...faceFor(distState.mono), fontSize: '0.6875rem', color: 'text.secondary' }}
      >
        {distValue}
      </Box>
      {d ? (
        <Box
          component="span"
          data-testid={`${testid}-delta`}
          sx={{ ...faceFor(true), fontSize: '0.6875rem', color: 'text.secondary' }}
        >
          {d}
        </Box>
      ) : null}
    </Box>
  );
}

/** "Structure as-of {rel}" — or a closed-nine member when there is no honest claim (`building`, or a
 *  non-positive `as_of`). `updatedText` branches on status BEFORE it reads `as_of`. */
export function UpdatedCell({ row, nowS }: { row: ScanRow; nowS: number }) {
  const value = updatedText(row, nowS) ?? EM_DASH;
  const { figureState, mono } = figureStateOf({ value, register: 'traced' });
  return (
    <Typography
      component="span"
      data-testid="cell-updated"
      data-figure-state={figureState}
      data-figure-register={mono ? 'mono' : 'sans'}
      sx={{ ...faceFor(mono), fontSize: '0.7rem', color: 'text.secondary' }}
    >
      {value}
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
