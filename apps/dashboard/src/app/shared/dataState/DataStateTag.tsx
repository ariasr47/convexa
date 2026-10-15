/**
 * One data-state word with its glyph (canon P-2): "Updated Oct 13", "Source down", "Not live".
 * The glyph carries the state with the word, so colour is never the only cue; failures add the
 * warning colour (burnt orange) and nothing uses green or red. `detail` follows the word in the same
 * tag ("Updated Oct 13", "Delayed · 9 days").
 */
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

/** `label` replaces the word where the design names the state in context ("Private testing" for
 *  Sign in, "Read-only sample" for Sample); the glyph and the drawing still come from `state`. */
export function DataStateTag({
  state,
  detail,
  label,
}: {
  state: DataStateKey;
  detail?: string | null;
  label?: string;
}) {
  const { kind } = DATA_STATES[state];
  const word = label ?? DATA_STATES[state].word;
  const Glyph = GLYPH[state];
  return (
    <Box
      component="span"
      data-state={state}
      sx={(t) => {
        const quiet = kind === 'quiet' || kind === 'dashed' || kind === 'dotted';
        const ink =
          kind === 'warn'
            ? t.palette.warning.main
            : quiet
              ? t.palette.text.secondary
              : t.palette.text.primary;
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          maxWidth: '100%',
          minHeight: 24,
          px: 1,
          py: '2px',
          borderRadius: '12px',
          border: `1px ${kind === 'dashed' ? 'dashed' : kind === 'dotted' ? 'dotted' : 'solid'} ${
            kind === 'warn'
              ? alpha(t.palette.warning.main, 0.6)
              : alpha(t.palette.text.secondary, quiet ? 0.55 : 0.32)
          }`,
          color: ink,
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.35,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        };
      }}
    >
      <Glyph aria-hidden sx={{ fontSize: 14, flex: 'none' }} />
      <span>{detail ? `${word} · ${detail}` : word}</span>
    </Box>
  );
}
