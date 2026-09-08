/**
 * outcome-ledger — the Track record readout (UX_BLUEPRINT §3 tree, §5 copy, §7 state selection).
 *
 * This is an HONESTY INSTRUMENT, not a stats dashboard. Its whole value is that it refuses to give a
 * number it cannot support. Four of the five families start with no number at all, on purpose.
 *
 * Binding postures, restated where they can actually be broken:
 *
 *  - `[live-vs-static-isolation]` (AC-E17) — **a component-signature rule, not a promise.** This
 *    component and every component beneath it accept NO `live` / `isLive` / `streamOffline` /
 *    `offline` / `data` prop and import nothing from the SSE/live path. No offline chip, no dimming,
 *    no `opacity` bound to any stream state, no "as of" line, no Refresh, no freshness treatment, no
 *    poll. ⚠ `PositionsPage.tsx`'s Net P/L header — the block directly above this one, in the same
 *    file — does `opacity: streamOffline ? 0.5 : 1` and `color: netPl >= 0 ? 'success.main' :
 *    'error.main'`. That is a LIVE P&L. **Neither pattern may cross into this section.** The iv-rank
 *    widget is the reference implementation of the correct posture.
 *  - **AC-14 — no semantic tint. Ever.** No `success.main`/`error.main`/red/green/arrow/icon/
 *    sparkline/bar/gauge on any rate or return. `text.primary`/`text.secondary`/`text.disabled`
 *    only. **The range is the verdict, not the hue.**
 *  - **The counted read is ONE STRING** from ONE builder in ONE <Typography>, with no internal
 *    typographic hierarchy — the rate renders at the same size and weight as its mean and its N. A
 *    big rate over a small caption IS a hero, and a hero for the rate is forbidden. **The read is the
 *    headline; the rate is not.** Any decomposition into spans/columns/chips is one `&&` away from a
 *    rate-only render.
 *  - **No loading state** — the read is computed synchronously in a `useMemo` on mount. Deferring it
 *    into a `useEffect` would flash "Nothing has closed yet" at a user with 400 trades. That is a lie.
 *  - **No error state** — corrupt history renders empty / unreadable / partial with a stated reason.
 *    Never a throw, never `severity="error"`, never a Retry, never a repair or a write-back.
 *  - **No control, anywhere.** No include/exclude toggle, no override, no filter, no sort, no column
 *    customization, no saved view, no score/threshold/weight suggestion. This feature is
 *    `[score-change-is-deliberate-and-measured]`'s enabler, never its exerciser.
 *  - `[theme-token-discipline]` — MUI theme tokens only; zero hardcoded hex; dark/light parity.
 */
import { MONO_FACE } from '@/shared/figure';
import { ArcDivider } from '@/shared/ui/ArcDivider';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo, useState } from 'react';
import { ArchiveBlock } from './ArchiveBlock';
import {
  cellLines,
  TR_ADJACENT_LABEL,
  TR_ADVISORY,
  TR_AIREC_PATH_NOTE,
  TR_BADGE,
  TR_BASIS_DEF,
  TR_BREAKDOWN_G2,
  TR_BREAKDOWN_NONE,
  TR_BREAKDOWN_SUMMARY,
  TR_COVERAGE_PARTIAL_BANNER,
  TR_EMPTY_TITLE,
  TR_EPOCH_NONE,
  TR_FAMILY_HEADING,
  TR_HIT_DEF,
  TR_MULTIPLICITY,
  TR_OVERLAP,
  TR_RANGE_DEF,
  TR_REASON_LABEL,
  TR_RETURN_DEF,
  TR_SIM_DISCLOSURE,
  TR_STORAGE,
  TR_SUBTITLE,
  TR_TIP_COVERAGE,
  TR_TIP_EPOCH,
  TR_TIP_FAMILY,
  TR_TITLE,
  TR_UNREADABLE_BODY,
  TR_UNREADABLE_TITLE,
  trBalance,
  trBreakdownG1,
  trBreakdownG2Note,
  trCoverage,
  trCoveragePartial,
  trDate,
  trEmptyBody,
  trEpoch,
  trFamilyCoverage,
  trFamilyEmpty,
  trLeadExplainer,
} from './copy';
import { computeLedgerRead } from './ledger';
import { Cell, CellFamily, EXCLUSION_PRECEDENCE, LedgerRead, N_MIN } from './types';

/** The house ⓘ idiom, reimplemented locally (`features/` may not import `pages/ticker/widgets/_kit`).
 *  A tooltip EXPLAINS; it never INFORMS — none of these carries a number, a rate or a count. */
function InfoTip({ title, testid }: { title: string; testid?: string }) {
  return (
    <Tooltip title={title} arrow placement="top">
      <InfoOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} data-testid={testid} />
    </Tooltip>
  );
}

function Line({
  children,
  testid,
  secondary = true,
}: {
  children: React.ReactNode;
  testid?: string;
  secondary?: boolean;
}) {
  return (
    <Typography
      variant="body2"
      data-testid={testid}
      sx={{ color: secondary ? 'text.secondary' : 'text.primary', mb: 0.75 }}
    >
      {children}
    </Typography>
  );
}

/** The `building` cell: a count, and NOTHING numeric beside it.
 *  ⚠ AC-E3 — three counted outcomes, all winners, renders EXACTLY this string: no "100%", no
 *  "3 of 3 won", no rate, no range, no mean, no window, and NO PROGRESS BAR. "7 of 20" invites a
 *  meter, and a meter beside a hit-rate-shaped cell reads as 35%. Text only. The type has no rate
 *  field — there is nothing to compute. */
function CellView({ cell, sourcesComplete }: { cell: Cell; sourcesComplete: boolean }) {
  const lines = cellLines(cell.cohort, sourcesComplete);
  return (
    <Box sx={{ mb: 1.5 }} data-testid={`tr-cell-${cell.key}`}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
        {cell.label}
      </Typography>
      {/* ONE builder → ONE string → ONE <Typography>. No internal hierarchy, no tint, no decomposition. */}
      <Typography
        variant="body2"
        data-testid={`tr-read-${cell.key}`}
        sx={{ color: 'text.primary', ...MONO_FACE }}
      >
        {lines.read}
      </Typography>
      {lines.qualifier && (
        <Typography
          variant="caption"
          data-testid={`tr-wide-${cell.key}`}
          sx={{ display: 'block', color: 'text.secondary' }}
        >
          {lines.qualifier}
        </Typography>
      )}
      {lines.basis && (
        <Typography
          variant="caption"
          data-testid={`tr-basis-${cell.key}`}
          sx={{ display: 'block', color: 'text.secondary' }}
        >
          {lines.basis}
        </Typography>
      )}
    </Box>
  );
}

/** A quiet card (design/src/screens/positions.mjs:88-89, `.panel.quiet`) — no lift, no sheen (canon
 *  rule 21). Purely a frame around the UNCHANGED `FamilyView` content below; carries no tint. */
const familyCardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '10px',
  padding: '14px 16px',
  minWidth: 0,
};

function FamilyView({ family, sourcesComplete }: { family: CellFamily; sourcesComplete: boolean }) {
  const c = family.coverage;
  return (
    <Box sx={familyCardSx} data-testid={`tr-family-${family.key}`}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {TR_FAMILY_HEADING[family.key]}
        </Typography>
        <InfoTip title={TR_TIP_FAMILY[family.key]} testid={`tr-family-info-${family.key}`} />
      </Stack>
      {/* The honest answer to "is this cut NEW, or STARVED?" — a date alone cannot say. */}
      <Typography
        variant="caption"
        data-testid={`tr-family-coverage-${family.key}`}
        sx={{ display: 'block', color: 'text.secondary', mb: 1 }}
      >
        {trFamilyCoverage(
          family.key,
          c.counted_total,
          c.attributed,
          c.pre_capture,
          c.unavailable_at_capture,
          c.not_attributable_by_path,
        )}
      </Typography>
      {/* Renders IFF the count is > 0 — it self-cancels. One data-driven rule, both directions. */}
      {(c.not_attributable_by_path ?? 0) > 0 && (
        <Typography
          variant="caption"
          data-testid="tr-airec-path-note"
          sx={{ display: 'block', color: 'text.secondary', mb: 1 }}
        >
          {TR_AIREC_PATH_NOTE}
        </Typography>
      )}
      {family.cells.length === 0 ? (
        <Typography
          variant="body2"
          data-testid={`tr-family-empty-${family.key}`}
          sx={{ color: 'text.secondary' }}
        >
          {trFamilyEmpty(family.key)}
        </Typography>
      ) : (
        family.cells.map((cell) => (
          <CellView key={cell.key} cell={cell} sourcesComplete={sourcesComplete} />
        ))
      )}
    </Box>
  );
}

/** The exclusion breakdown — the ONLY on-demand content in the readout.
 *  ⚠ Integers and reasons, full stop: no record ids, no P&L, no per-record list, no drill-through,
 *  no "count it anyway", no toggle, no filter. The demo seed gets no special case — it lands in
 *  `no_decision_record` like any other record with no decision. */
function ExclusionBreakdown({ read }: { read: LedgerRead }) {
  const { coverage } = read;
  const m = coverage.recorded_closed;
  const reasons = EXCLUSION_PRECEDENCE.filter((r) => coverage.excluded_by_reason[r] > 0);
  const excludedTotal = EXCLUSION_PRECEDENCE.reduce(
    (sum, r) => sum + coverage.excluded_by_reason[r],
    0,
  );
  return (
    <Box component="details" data-testid="tr-breakdown" sx={{ mb: 1.5 }}>
      <Box
        component="summary"
        sx={{
          cursor: 'pointer',
          color: 'text.secondary',
          fontSize: '0.8125rem',
          // GATE Z (criterion 66, pass 3): a native `<summary>` matches none of `theme.ts`'s
          // coarse-pointer selector list (`button, [role="button"], a, input`) — the SAME escape
          // mechanism as MUI `Select`'s self-duplicated `.MuiSelect-select` class, just via a
          // different element instead of a specificity fight. Floored LOCALLY, coarse-pointer only,
          // so the desktop/fine-pointer row height (measured unchanged at 1280) never moves.
          //
          // GATE Z (criterion 66, pass 4 — QA pass 3 finding): the pass-3 fix used
          // `display: flex`, which computes the UA default `summary { display: list-item }` away —
          // Chromium then generates no `::marker`, so the native disclosure triangle disappeared on
          // a coarse pointer (confirmed: at 393/fine, `display` stays `list-item` and the triangle
          // renders; at 393/coarse it was `flex` and the triangle was gone — same width, so the
          // fix, not the pointer, was the cause). `line-height` reaches the 44px floor without
          // touching `display` at all, so `list-item` (and its `::marker`) is never overridden —
          // verified in isolation with a real Chromium instance: coarse renders the box at
          // 393x44 with the triangle visible; fine (393 and 1280) is untouched, still list-item.
          '@media (pointer: coarse)': {
            minHeight: 44,
            lineHeight: '44px',
          },
        }}
      >
        {TR_BREAKDOWN_SUMMARY}
      </Box>
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
          {trBreakdownG1(m)}
        </Typography>
        {reasons.length === 0 ? (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            {TR_BREAKDOWN_NONE}
          </Typography>
        ) : (
          reasons.map((r) => (
            <Typography
              key={r}
              variant="caption"
              data-testid={`tr-reason-${r}`}
              sx={{ display: 'block', color: 'text.secondary' }}
            >
              {TR_REASON_LABEL[r]} · {coverage.excluded_by_reason[r]}
            </Typography>
          ))
        )}
        {/* Makes `M == counted + Σ excluded` user-checkable — the whole reason the roll-up exists. */}
        <Typography
          variant="caption"
          data-testid="tr-balance"
          sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}
        >
          {trBalance(coverage.counted, excludedTotal, m)}
        </Typography>

        {/* Group 2 — counted BESIDE the total, never inside it. The two "unreadable record" rows
            share one concept; the group headings do the differentiating work. They are NEVER summed:
            summing across the balance boundary would break the visible identity above. */}
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mt: 1 }}>
          {TR_BREAKDOWN_G2}
        </Typography>
        {(['open_not_counted', 'never_filled', 'unreadable_records'] as const).map((k) => (
          <Typography
            key={k}
            variant="caption"
            data-testid={`tr-adjacent-${k}`}
            sx={{ display: 'block', color: 'text.secondary' }}
          >
            {TR_ADJACENT_LABEL[k]} · {coverage.adjacent[k]}
          </Typography>
        ))}
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
          {trBreakdownG2Note(m)}
        </Typography>
      </Box>
    </Box>
  );
}

export type TrackRecordBodyState = 'unreadable' | 'empty' | 'partial' | 'default';

/** Wire-driven, FIRST MATCH WINS (§7) — selected from the read's own fields, never re-derived.
 *  ⚠ empty ≠ unreadable. Telling a user with 400 trades "Nothing has closed yet" because a store
 *  failed to read is a lie. Two states, two copies. */
export function selectBodyState(read: LedgerRead): TrackRecordBodyState {
  const { counted, recorded_closed: m, adjacent } = read.coverage;
  const complete = read.basis.sources_complete;
  if (counted === 0 && m === 0 && (!complete || adjacent.unreadable_records > 0)) {
    return 'unreadable';
  }
  if (
    complete &&
    counted === 0 &&
    m === 0 &&
    adjacent.open_not_counted === 0 &&
    adjacent.never_filled === 0 &&
    adjacent.unreadable_records === 0
  ) {
    return 'empty';
  }
  if (!complete) return 'partial';
  return 'default';
}

export interface TrackRecordSectionProps {
  /** Injected by the page shell — `features/trading/outcomes` may not import `features/personas`.
   *  ⚠ This is the ONLY prop. There is no `live`, no `isLive`, no `streamOffline`, no `offline` and
   *  no `data` prop, by rule (AC-E17). */
  personaLabel?: (id: string) => string | null;
}

export function TrackRecordSection({ personaLabel }: TrackRecordSectionProps) {
  // A re-import recomputes the read FROM THE STORES, never patches it — a patched count would drift
  // from the stores and break the balance identity, the one thing the roll-up exists to guarantee.
  const [readVersion, setReadVersion] = useState(0);
  const recompute = useCallback(() => setReadVersion((v) => v + 1), []);

  // Synchronous, on mount. NOT in a useEffect: a one-frame flash of the empty state is a lie.
  const read = useMemo(
    () => computeLedgerRead({ personaLabel }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personaLabel, readVersion],
  );

  const body = selectBodyState(read);
  const { coverage, basis } = read;
  const noComputedCell = read.families.every((f) =>
    f.cells.every((c) => c.cohort.state === 'building'),
  );

  return (
    <Box component="section" data-testid="track-record" sx={{ mt: 4 }}>
      {/* The book ↔ "Track record" section seam — the shared ArcDivider (redesign-stage-2 §5.2
          seam #2, a named seam pin in arc.spec.ts). */}
      <ArcDivider sx={{ mb: 3 }} />

      {/* ---- Header ---- */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: '4px' }}>
        <Typography component="h2" sx={{ fontSize: '1.25rem', fontWeight: 700, m: 0 }}>
          {TR_TITLE}
        </Typography>
        {/* SIMULATED is part of the read, not a footnote (`[no-real-order-path]`). */}
        <Chip label={TR_BADGE} size="small" variant="outlined" data-testid="tr-badge" />
      </Stack>
      <Line testid="tr-subtitle">{TR_SUBTITLE}</Line>

      {/* "How this is counted" — ONE disclosure holding the honesty copy and the definitions
          (design/src/screens/positions.mjs has no equivalent of this content at all; the compact
          cards below are the design's whole surface, so everything the design does not show —
          `Counted N of M…`, `What wasn't counted — and why`, the definitions — moves BEHIND this
          one toggle, per the repair task's own must-not-change instruction: it "stays reachable —
          behind a disclosure the design's compact cards do not show, never deleted". Nothing inside
          is removed, renamed or reworded — `tr-how-to-read` stays, same testids, same strings. */}
      <Box component="details" data-testid="tr-how-counted" sx={{ mb: 2 }}>
        <Box
          component="summary"
          sx={{
            cursor: 'pointer',
            color: 'text.secondary',
            fontSize: '0.8125rem',
            fontWeight: 600,
            // Same coarse-pointer floor idiom as `tr-breakdown` below (criterion 66) — floored
            // locally so the desktop/fine-pointer row height never moves.
            '@media (pointer: coarse)': { minHeight: 44, lineHeight: '44px' },
          }}
        >
          How this is counted
        </Box>
        <Box sx={{ mt: 1 }}>
          {/* ---- The read frame: always reachable, never deleted (AC-2/3/4/5) ---- */}
          <Line testid="tr-advisory">{TR_ADVISORY}</Line>
          <Line testid="tr-sim-disclosure">{TR_SIM_DISCLOSURE}</Line>
          <Line testid="tr-storage">{TR_STORAGE}</Line>

          {body === 'unreadable' ? (
            <Box data-testid="tr-unreadable" sx={{ my: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {TR_UNREADABLE_TITLE}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {TR_UNREADABLE_BODY}
              </Typography>
            </Box>
          ) : body === 'empty' ? (
            <Box data-testid="tr-empty" sx={{ my: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {TR_EMPTY_TITLE}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {trEmptyBody(N_MIN)}
              </Typography>
            </Box>
          ) : (
            <>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', mt: 1.5 }}>
                <Typography
                  variant="body2"
                  data-testid="tr-coverage"
                  sx={{ color: 'text.primary' }}
                >
                  {body === 'partial'
                    ? // ⚠ M is WITHHELD, not caveated: a partial roll-up must never present its
                      // smaller M as the whole population. The open / never-filled counts are
                      // withheld with it — they are read from the same understated indices.
                      trCoveragePartial(coverage.counted)
                    : trCoverage(
                        coverage.counted,
                        coverage.recorded_closed,
                        coverage.adjacent.open_not_counted,
                        coverage.adjacent.never_filled,
                      )}
                </Typography>
                <InfoTip title={TR_TIP_COVERAGE} testid="tr-coverage-info" />
              </Stack>
            </>
          )}

          {/* The partial banner — un-dismissable. */}
          {!basis.sources_complete && (
            <Typography
              variant="body2"
              data-testid="tr-partial-banner"
              sx={{ color: 'text.primary', fontWeight: 600, mb: 1 }}
            >
              {TR_COVERAGE_PARTIAL_BANNER}
            </Typography>
          )}

          {/* The capture epoch — DERIVED FROM THE DATA (never a hardcoded ship date). */}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="body2" data-testid="tr-epoch" sx={{ color: 'text.secondary' }}>
              {basis.capture_epoch ? trEpoch(trDate(basis.capture_epoch)) : TR_EPOCH_NONE}
            </Typography>
            <InfoTip title={TR_TIP_EPOCH} testid="tr-epoch-info" />
          </Stack>

          {/* "How to read this" — the definitions. Same testids, same strings, never deleted. */}
          <Box data-testid="tr-how-to-read" sx={{ mb: 1 }}>
            <Line testid="tr-hit-def">{TR_HIT_DEF}</Line>
            <Line testid="tr-range-def">{TR_RANGE_DEF}</Line>
            <Line testid="tr-return-def">{TR_RETURN_DEF}</Line>
            <Line testid="tr-basis-def">{TR_BASIS_DEF}</Line>
            <Line testid="tr-overlap">{TR_OVERLAP}</Line>
          </Box>

          {/* The lead explainer — rendered iff NO cell anywhere is computed (empty · day one · a
              partial that reached no floor). One rule, three cases. */}
          {noComputedCell && <Line testid="tr-lead-explainer">{trLeadExplainer(N_MIN)}</Line>}

          {/* The multiplicity caution — the last line of the frame. */}
          <Line testid="tr-multiplicity">{TR_MULTIPLICITY}</Line>
        </Box>
      </Box>

      {/* `tr-breakdown` stays a TOP-LEVEL, always-directly-clickable disclosure — it shipped before
          this repair and its own `<summary>` must stay reachable without first expanding "How this
          is counted" above (nesting one native <details> inside a closed one collapses the inner
          summary to zero size, which is exactly what GATE Z criterion 66's coarse/fine-pointer
          passes on this element caught). `tr-coverage` (above, inside the new disclosure) still
          never sits INSIDE `tr-breakdown` — the two are independent, matching the shipped
          non-containment assertion. */}
      {body !== 'unreadable' && body !== 'empty' && (
        <Box sx={{ mb: 1 }}>
          <ExclusionBreakdown read={read} />
        </Box>
      )}

      {/* ---- The families: four-plus quiet cards (design/src/screens/positions.mjs:87-90,
              `repeat(4, minmax(0,1fr))`), ALWAYS rendered — including the empty/unreadable states,
              each family's own `tr-family-empty-*` message standing in for a `—` cell (the shipped
              per-family empty-cohort honesty this component already carries; §2.7/canon 4: never a
              blank space where a fact used to be). Five, in a FIXED order. Never sorted by rate —
              that builds a leaderboard the sample cannot support. ---- */}
      <Box
        data-testid="tr-families"
        sx={{
          mt: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
            // Five families (the design's mock shows four) — one row at ≥ lg so the fifth never
            // wraps alone under a 4-column grid (conductor fixup after the surfaces repair; the
            // 1192 px content column gives ~229 px cards, the design's own card width).
            lg: 'repeat(5, minmax(0, 1fr))',
          },
          gap: '12px',
        }}
      >
        {read.families.map((f) => (
          <FamilyView key={f.key} family={f} sourcesComplete={basis.sources_complete} />
        ))}
      </Box>

      {/* ---- The archive: present in EVERY state, including empty and unreadable (on an empty
              surface it is the only useful thing here). ---- */}
      <ArchiveBlock onImported={recompute} />
    </Box>
  );
}

export default TrackRecordSection;
