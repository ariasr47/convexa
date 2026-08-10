/**
 * GexStrikeProfile — the Ticker widget wrapping the net-GEX chart (`gex-profile-chart.tsx`). The chart
 * logic is UNCHANGED (vertical diverging bars); this component provides the uniform `<Widget>` frame.
 * Live mid for the "live" reference line is read from liveTapeStore so the parent can pass only
 * REST structure props (§3.8 Phase C).
 */
import { Widget } from '@/shared/ui/Widget';
import type { StrikeRow } from '@convexa/api';
import { memo } from 'react';
import { useLiveTape } from '../../liveTapeStore';
import { gexProfileSubtitle } from '../_kit/copy';
import { GexLegend, GexProfileChart, windowedStrikes } from './chart';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  /** Structure gamma flip (REST). Live flip is not used for the flip line — structure owns it. */
  gammaFlip: number;
  /** Optional override; default = live mid from liveTapeStore when isLive. */
  liveSpot?: number | null;
  /** Expiration window label (e.g. "all expirations" / "2 expirations"). */
  expLabel?: string;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

const GEX_INFO =
  'Net dealer gamma at each strike. Green = call-dominated (resistance above price); red = put-dominated (support below). Dashed lines mark the spot, the gamma flip, and the live price.';

export const GexStrikeProfile = memo(function GexStrikeProfile({
  expLabel = 'selected window',
  structureAgeSeconds = null,
  liveSpot: liveSpotProp,
  ...props
}: Props) {
  const tape = useLiveTape();
  const liveSpot =
    liveSpotProp !== undefined
      ? liveSpotProp
      : tape.isLive && tape.live
        ? tape.live.mid
        : null;

  // Mirror the chart's own windowing so the widget frame is omitted (not left empty) when there is
  // nothing in-window — matching the chart's `return null`.
  if (!windowedStrikes(props.strikes, props.spot, props.callWall, props.putWall).length)
    return null;
  return (
    <Widget
      id="gex-strike-profile"
      title="GEX strike profile"
      // Spine #4: GEX spot basis + expiration window + structure age (never "live").
      subtitle={gexProfileSubtitle(props.spot, expLabel, structureAgeSeconds)}
      info={GEX_INFO}
      span={2}
      actions={<GexLegend />}
    >
      <GexProfileChart {...props} liveSpot={liveSpot} />
    </Widget>
  );
});

export default GexStrikeProfile;
