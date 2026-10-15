/**
 * `ReadStrip` — the read strip (SPEC §2.4, §2.5, §4.1, §4.6; DESIGN_SYSTEM.md rule 15). EIGHT
 * FIXED SLOTS, always, each rendered through `FigureRow` — the whole desk's honest liveness state
 * for this widget is eight dotless cells (criterion 8): every slot passes `live={NOT_LIVE}` from
 * the model, so a stray live claim here would be a compile error.
 *
 * Ticker fidelity repair, change 4 (F4) — re-composed to `design/src/screens/desk.mjs:29`'s
 * `.strip` (`1.35fr repeat(7, minmax(0,1fr))`, hairline-split, no per-cell card):
 *   - `hideHeader` on the `Widget` (`Widget.tsx`'s own new opt-in prop, F4) — "no Widget title/
 *     subtitle, the strip IS the frame." `title` still names the group accessibly
 *     (`aria-label`), just never rendered.
 *   - Cells render through `FigureRow` (`direction="column"`), the SAME chrome-less sibling the
 *     structure-hero repair built for the ladder — not `FigureCell`: that component's `CellCard`
 *     bakes in a bordered/rounded StatTile look with no opt-out, which is exactly the per-cell card
 *     chrome the design does NOT have here (hairlines only, from the rail's own `border-right`).
 *     Canon 13's 20/17/15 container-step is `FigureCell`-card-only by the SAME exemption the hero
 *     repair recorded for the ladder ("this compact layout does not step with its container") —
 *     `FigureRow`'s fixed `valueSize` applies here for the identical reason.
 *   - The opportunity cell carries a score ring (`RingGauge`) beside its `FigureRow`.
 *   - Every cell carries a sub-caption from the model (`readStripModel.ts`'s new `sub` field) via
 *     `FigureRow`'s existing `caption` prop — no new rendering path, `—` where the model has
 *     nothing to say this cycle.
 *   - The rail is `display:flex` (a true scrolling rail) below a 1000px `panel` CONTAINER (queries
 *     the Widget body's own named container — never a viewport media query) and `display:grid`
 *     (`1.35fr repeat(7, minmax(0,1fr))`, fluid, no fixed `minWidth` forcing overflow) at/above it —
 *     "never clip" (canon 15/17).
 *
 * THE CONTAINER-QUERY HAZARD (SPEC §2.5). `FigureCell.tsx` queries `theme.containerQueries('panel')`
 * against the NEAREST ancestor named `panel`. `Widget.tsx` and `PanelContainer.tsx` are the only two
 * declarations in the app. Declaring the name at THIS widget's own body (which `Widget` already
 * does) would make the ~1280px panel body the nearest named ancestor for every ~140px cell, so the
 * 20→17→15px step would never fire at any viewport. Each cell is therefore wrapped in its OWN
 * `PanelContainer` (same name, NESTED — the nearest-ancestor rule does the work), never a second
 * container name and never `containerName: 'panel'` on the rail itself. The rail's OWN grid/rail
 * switch safely queries the SAME `panel` name (the Widget body, an ANCESTOR of the rail) — the rail
 * itself never establishes that name, so there is no self-query and no collision with the per-cell
 * declarations (which are further DESCENDANTS of the rail, not ancestors of it).
 *
 * THE RAIL, NOT THE PAGE (criterion 50, SB). `overflowX: 'auto'` + `minWidth: 0` on the rail
 * unconditionally (harmless/dormant in grid mode, where fluid columns never overflow); the page
 * never scrolls sideways. The scrolling BEHAVIOUR itself is FE-12's browser row — `[lane-check]`:
 * jsdom cannot evaluate container queries or real scroll overflow, so this file's own tests assert
 * the DECLARATIONS only.
 *
 * PRESENTATIONAL — the caller builds the closed eight-tuple (`buildReadStrip`) and hands it down.
 */
import { PanelContainer } from '@/shared/ui/PanelContainer';
import { Widget } from '@/shared/ui/Widget';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { FigureRow } from '../_kit/FigureCell';
import type { ReadStripCells } from './readStripModel';

export interface ReadStripProps {
  /** The closed eight-tuple, already built (`buildReadStrip`) by the caller. */
  cells: ReadStripCells;
  /** The raw 0–100 opportunity score for the ring gauge (the SAME number `cells[0].value` already
   *  states in text — `TickerDashboard.tsx` passes `sig?.opportunity_score ?? null`, the same input
   *  `buildReadStrip` takes). `null` (not scored this cycle) draws the empty track only, never a
   *  zero-length arc that reads as a score of 0 (TD-07). Kept off `ReadStripCell` itself: only one
   *  of eight slots needs it. */
  ringScore: number | null;
}

/** The opportunity cell's score ring (`design/src/screens/desk.mjs:336`'s `ring(score, {size:48})`)
 *  — a track + an arc scaled to `score/100`. Decorative (`aria-hidden`): the score is already
 *  stated as text by the adjacent `FigureRow`. Token-only via the theme's own CSS custom
 *  properties (the SAME `var(--mui-palette-*)` convention `Widget.tsx`'s selection ring already
 *  uses) — zero hardcoded hex. The arc is steel (`text.secondary`), not amber: amber is spent on
 *  the focus ring, and a score is a neutral reading (canon P-9; design v5 desk family, TD-07). */
function RingGauge({ score, size = 48 }: { score: number | null; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const offset = c * (1 - clamped / 100);
  return (
    <Box
      component="svg"
      data-testid="read-strip-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      sx={{ flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--mui-palette-divider)"
        strokeWidth={stroke}
      />
      {score != null && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--mui-palette-text-secondary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </Box>
  );
}

export function ReadStrip({ cells, ringScore }: ReadStripProps) {
  const theme = useTheme();

  return (
    // `span={2}` — the SAME full-bento-row placement the strip carried before this repair (and
    // `StructureHeroPanel` above it still carries): without it the strip sits in ONE bento column
    // (≈568px at 1280), which never reaches the rail's own `panel` container's 1000px grid
    // threshold — a measured composition-gate regression this repair's own gate caught and fixed
    // before landing, not a residual.
    <Widget
      id="read-strip"
      title="Read strip"
      hideHeader
      span={2}
      bodyVariant="inset"
      bodyPad="none"
    >
      <Box
        data-testid="read-strip-rail"
        sx={{
          display: 'flex',
          overflowX: 'auto',
          minWidth: 0,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > *': {
            flex: '0 0 170px',
            borderRight: '1px solid',
            borderColor: 'divider',
            minWidth: 0,
          },
          '& > *:first-of-type': { flex: '0 0 220px' },
          [theme.containerQueries('panel').up(1000)]: {
            display: 'grid',
            gridTemplateColumns: '1.35fr repeat(7, minmax(0, 1fr))',
            overflowX: 'visible',
            '& > *': { flex: 'unset' },
            '& > *:last-child': { borderRight: 0 },
          },
        }}
      >
        {cells.map((cell) => (
          <PanelContainer
            key={cell.slot}
            data-testid={`read-strip-cell-${cell.slot}`}
            sx={{ py: 1.5, px: 1.5 }}
          >
            {cell.slot === 'opportunity' ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <RingGauge score={ringScore} />
                <FigureRow
                  direction="column"
                  register={cell.register}
                  label={cell.label}
                  value={cell.value}
                  live={cell.live}
                  info={cell.info}
                  caption={cell.sub}
                  valueSize={18}
                />
              </Box>
            ) : (
              <FigureRow
                direction="column"
                register={cell.register}
                label={cell.label}
                value={cell.value}
                live={cell.live}
                info={cell.info}
                caption={cell.sub}
                valueSize={18}
              />
            )}
          </PanelContainer>
        ))}
      </Box>
    </Widget>
  );
}

export default ReadStrip;
