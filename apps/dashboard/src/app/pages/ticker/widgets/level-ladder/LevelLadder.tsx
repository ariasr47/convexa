/**
 * `LevelLadder` — the level ladder (SPEC §2.3, §4.1, §4.6; design source `design/src/components/
 * ladder.mjs`). PRESENTATIONAL ONLY — PLAN's FE-6 illustrative host code
 * (`<LevelLadder rows={rows} anchorText={anchorText} />`) computes `rows` (`buildLadder`) and
 * `anchorText` (`formatAnchorText`) ONCE at the hero's single store read and hands them down as
 * props, the same reason `StructureHeroPanel`'s other three children are presentational (SPEC §2.5:
 * "derives the branded claim once and passes it … DOWN AS PROPS"). This component does not import
 * `LadderInput` or call `buildLadder`/`formatAnchorText` itself.
 *
 * Five rows through `FigureCell` (`register="traced"`), each with a tick beside it drawn from the
 * SAME `LevelPalette` object `StructureFieldCanvas` receives (criterion 7) — never a second colour
 * table, never a theme read of its own. The anchor is named once in the header (criterion 4), never
 * per row.
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
import { FigureCell } from '../_kit/FigureCell';
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

function LadderTick({ id, palette }: { id: LadderRowId; palette: LevelPalette }) {
  return (
    <Box
      aria-hidden
      data-testid={`ladder-tick-${id}`}
      sx={{
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 999,
        backgroundColor: tickColor(id, palette),
        flex: '0 0 auto',
      }}
    />
  );
}

function LadderLine({ row, palette }: { row: LadderRow; palette: LevelPalette }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'stretch' }}>
      <LadderTick id={row.id} palette={palette} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <FigureCell
          register="traced"
          label={row.label}
          value={row.price}
          live={row.live}
          caption={row.distance}
        />
      </Box>
    </Stack>
  );
}

export function LevelLadder({ rows, anchorText, palette }: LevelLadderProps) {
  return (
    <Box data-testid="level-ladder">
      <Typography
        component="p"
        data-testid="level-ladder-anchor"
        sx={{
          fontFamily: typographyTokens.monoFontFamily,
          fontSize: 11,
          color: 'text.secondary',
          mb: 1,
        }}
      >
        {`distance from levels @ ${anchorText}`}
      </Typography>
      <Stack spacing={1}>
        {rows.map((row) => (
          <LadderLine key={row.id} row={row} palette={palette} />
        ))}
      </Stack>
    </Box>
  );
}

export default LevelLadder;
