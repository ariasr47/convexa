/**
 * One data-state word with its glyph (canon P-2): "Updated Oct 13", "Source down", "Not live".
 * The glyph carries the state with the word, so colour is never the only cue; failures add the
 * warning colour (burnt orange) and nothing uses green or red. `detail` follows the word in the same
 * tag ("Updated Oct 13", "Delayed · 9 days").
 */
import { extrasFor } from '@/shared/theme/tokens';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CropFreeOutlined from '@mui/icons-material/CropFreeOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import FunctionsOutlined from '@mui/icons-material/FunctionsOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PauseCircleOutlineOutlined from '@mui/icons-material/PauseCircleOutlineOutlined';
import PowerSettingsNewOutlined from '@mui/icons-material/PowerSettingsNewOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SensorsOffOutlined from '@mui/icons-material/SensorsOffOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import type { ComponentType } from 'react';
import { DATA_STATES, type DataStateKey } from './vocabulary';

const GLYPH: Record<DataStateKey, ComponentType<{ sx?: object; 'aria-hidden'?: boolean }>> = {
  updated: EventOutlined,
  delayed: ScheduleOutlined,
  computed: FunctionsOutlined,
  lastGood: WarningAmberOutlined,
  sourceDown: WarningAmberOutlined,
  couldntLoad: WarningAmberOutlined,
  notSetUp: TuneOutlined,
  off: PowerSettingsNewOutlined,
  paused: PauseCircleOutlineOutlined,
  notLive: SensorsOffOutlined,
  sample: CropFreeOutlined,
  demo: CropFreeOutlined,
  signIn: LockOutlined,
  thirdParty: OpenInNewOutlined,
  local: CheckOutlined,
};

/** `word` (or its alias `label`) replaces the state's word where the canon or the design names the
 *  state in context (P-15: the landing's "Illustrative sample"; "Private testing" for Sign in,
 *  "Read-only sample" for Sample); the glyph and the drawing still come from `state`. */
export function DataStateTag({
  state,
  detail,
  word: wordOverride,
  label,
}: {
  state: DataStateKey;
  detail?: string | null;
  word?: string;
  label?: string;
}) {
  const { word: stateWord, kind } = DATA_STATES[state];
  const word = wordOverride ?? label ?? stateWord;
  const Glyph = GLYPH[state];
  return (
    <Box
      component="span"
      data-state={state}
      sx={(t) => {
        const x = extrasFor(t);
        // The library's `.stag` (design/src/lib.mjs:18-25, :116, :125). Text is phosphor in every
        // kind but sample, which is steel; the glyph is steel, or the warning colour on a failure.
        const look = {
          solid: { border: `1px solid ${x.lineStrong}`, glyph: t.palette.text.secondary },
          warn: {
            border: `1px solid ${t.palette.warning.main}`,
            bg: alpha(t.palette.warning.main, 0.14),
            glyph: t.palette.warning.main,
          },
          quiet: { bg: alpha(t.palette.text.secondary, 0.16), glyph: t.palette.text.secondary },
          dashed: {
            border: `1px dashed ${x.textTertiary}`,
            ink: t.palette.text.secondary,
            glyph: t.palette.text.secondary,
          },
          dotted: { border: `1px dotted ${x.textTertiary}`, glyph: t.palette.text.secondary },
        }[kind] as { border?: string; bg?: string; ink?: string; glyph: string };
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '100%',
          minHeight: 22,
          px: 1,
          py: '2px',
          // A full pill at one line (the board's 999px); a tag that wraps keeps soft corners.
          borderRadius: '11px',
          border: look.border ?? 'none',
          bgcolor: look.bg ?? 'transparent',
          color: look.ink ?? t.palette.text.primary,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.35,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          '& > svg': { color: look.glyph },
          '@media (pointer: coarse)': { minHeight: 24 },
        };
      }}
    >
      <Glyph aria-hidden sx={{ fontSize: 12, flex: 'none' }} />
      <span>{detail ? `${word} · ${detail}` : word}</span>
    </Box>
  );
}
