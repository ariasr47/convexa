/**
 * `LevelLadder` — the level ladder (SPEC §2.3, §4.1, §4.6; design source `design/src/components/
 * ladder.mjs`). PRESENTATIONAL ONLY — PLAN's FE-6 illustrative host code
 * (`<LevelLadder rows={rows} anchorText={anchorText} />`) computes `rows` (`buildLadder`) and
 * `anchorText` (`formatAnchorText`) ONCE at the hero's single store read and hands them down as
 * props, the same reason `StructureHeroPanel`'s other three children are presentational (SPEC §2.5:
 * "derives the branded claim once and passes it … DOWN AS PROPS"). This component does not import
 * `LadderInput` or call `buildLadder`/`formatAnchorText` itself.
 *
 * REPAIR TASK item 2 (`STRUCTURE_HERO_REPAIR_TASK.md`) — the five rows are now ONE LINE each
 * (`FigureRow`, `direction="row"`), not a `FigureCell` card: tick · label 12px steel · value Mono
 * 14px 500 (18px 600 on the mid row, with a `tape` badge when the claim is live) · distance Mono
 * 11px steel, right-aligned. `FigureRow` reuses the SAME `figureStateOf`/`FigureMarks` state
 * machinery `FigureCell` does — this is a chrome change, not a hand-rolled state branch. The tick
 * is drawn from the SAME `LevelPalette` object `StructureFieldCanvas` receives (criterion 7) — never
 * a second colour table, never a theme read of its own. The anchor is named once in the header
 * (criterion 4), never per row.
 *
 * A sixth row is a compile error at TWO places: `buildLadder`'s `LadderRows` return type
 * (`ladderModel.ts`) and the exhaustive `tickColor` switch below (`never` default arm), so adding a
 * `LadderRowId` member without updating both is caught by the compiler, not a runtime length check.
 */
import type { LadderRowId, LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import type { NotANumber } from '@/shared/copy/notANumber';
import { typographyTokens } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { FigureRow } from '../_kit/FigureCell';
import type { LadderRow, LadderRows } from './ladderModel';

export interface LevelLadderProps {
  /** The closed five-tuple, already built (`buildLadder`) by the single-store-read host. */
  rows: LadderRows;
  /** The header's one anchor statement's value half, already formatted (`formatAnchorText`). */
  anchorText: string | NotANumber;
  /** The SAME resolved object `StructureFieldCanvas` receives — by identity, not a second table. */
  palette: LevelPalette;
}

/** The exhaustive switch (SPEC §2.3 invariant) — a sixth `LadderRowId` fails to compile here. */
function tickColor(id: LadderRowId, palette: LevelPalette): string {
  switch (id) {
    case 'callWall':
      return palette.callWall;
    case 'putWall':
      return palette.putWall;
    case 'maxPain':
      return palette.maxPain;
    case 'gammaFlip':
      return palette.gammaFlip;
    case 'mid':
      return palette.mid;
    default: {
      const neverId: never = id;
      return neverId;
    }
  }
}

/**
 * The ladder's own stroke tick — a 14px horizontal line, the level's stroke, dashed for max pain
 * (repair task item 2; `design/src/components/ladder.mjs:13`). Dashed ticks paint via `borderTop`
 * (a solid `backgroundColor` bar cannot dash); `LevelLadder.spec.tsx`'s colour-identity assertions
 * are edited accordingly for the one dashed row — see that file's own note.
 */
function LadderTick({ id, palette }: { id: LadderRowId; palette: LevelPalette }) {
  const color = tickColor(id, palette);
  const dashed = id === 'maxPain';
  return (
    <Box
      aria-hidden
      data-testid={`ladder-tick-${id}`}
      sx={{
        width: 14,
        height: dashed ? 0 : 2,
        flexShrink: 0,
        alignSelf: 'center',
        borderRadius: dashed ? 0 : 1,
        ...(dashed ? { borderTop: `1px dashed ${color}` } : { backgroundColor: color }),
      }}
    />
  );
}

function LadderLine({ row, palette }: { row: LadderRow; palette: LevelPalette }) {
  const big = row.id === 'mid';
  return (
    <FigureRow
      register="traced"
      label={row.label}
      value={row.price}
      live={row.live}
      offline={row.offline}
      replay={row.replay}
      caption={row.distance}
      captionTitle={row.distanceTitle}
      direction="row"
      valueSize={big ? 18 : 14}
      liveBadge={big ? 'tape' : undefined}
      leading={<LadderTick id={row.id} palette={palette} />}
      // Fidelity repair 2, N4 — the five-up band (< 1000px container) has no room for a full label
      // on one line; wrap instead of the shared row layout's default ellipsis (`crops/ladder-834.png`
      // — "Gamma flip" clipped to "Gamma f…"). The ≥1000px two-column-beside-field layout is
      // untouched — this is a label-chrome change, not a column-count change.
      labelWrap
    />
  );
}

export function LevelLadder({ rows, anchorText, palette }: LevelLadderProps) {
  return (
    <Box data-testid="level-ladder">
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
          }}
        >
          Levels
        </Typography>
        <Typography
          component="p"
          data-testid="level-ladder-anchor"
          sx={{
            fontFamily: typographyTokens.monoFontFamily,
            fontSize: 11,
            color: 'text.secondary',
            m: 0,
          }}
        >
          {`distance from levels @ ${anchorText}`}
        </Typography>
      </Stack>
      <Box
        sx={(theme) => ({
          mt: '6px',
          display: 'flex',
          flexDirection: 'column',
          [theme.containerQueries('panel').down(1000)]: {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: '8px',
          },
          [theme.containerQueries('panel').down(768)]: {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
        })}
      >
        {rows.map((row) => (
          <LadderLine key={row.id} row={row} palette={palette} />
        ))}
      </Box>
    </Box>
  );
}

export default LevelLadder;
