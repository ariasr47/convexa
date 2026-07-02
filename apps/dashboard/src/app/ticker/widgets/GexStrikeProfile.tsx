/**
 * GexStrikeProfile — the Ticker widget wrapping the net-GEX chart (`gex-profile-chart.tsx`). The chart
 * logic is UNCHANGED (vertical diverging bars + mount-grow); this component provides the uniform
 * `<Widget>` frame: the title + `info` lift into the widget header, the color legend into the header
 * `actions` slot. Returns null (no throw) when no strikes fall in the spot window, so the widget never
 * renders an empty frame.
 */
import type { StrikeRow } from '@org/api';
import { GexProfileChart, GexLegend, windowedStrikes } from '../../gex-profile-chart';
import { Widget } from './Widget';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  liveSpot?: number | null;
  revealIndex?: number;
}

const GEX_INFO =
  'Net dealer gamma at each strike. Green = call-dominated (resistance above price); red = put-dominated (support below). Dashed lines mark the spot, the gamma flip, and the live price.';

export function GexStrikeProfile({ revealIndex, ...props }: Props) {
  // Mirror the chart's own windowing so the widget frame is omitted (not left empty) when there is
  // nothing in-window — matching the chart's `return null`.
  if (!windowedStrikes(props.strikes, props.spot, props.callWall, props.putWall).length) return null;
  return (
    <Widget
      id="gex-strike-profile" title="GEX strike profile" info={GEX_INFO} span={2}
      actions={<GexLegend />} revealIndex={revealIndex}
    >
      <GexProfileChart {...props} />
    </Widget>
  );
}

export default GexStrikeProfile;
