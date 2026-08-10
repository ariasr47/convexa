/**
 * GexStrikeProfile — the Ticker widget wrapping the Canvas2D Structure Field.
 * Live mid for the tape reference is read from liveTapeStore so the parent can pass only
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
  /** Ticker symbol (field label). */
  symbol?: string;
}

const GEX_INFO =
  'Net dealer gamma by strike as a dual-clock Structure Field. Green = call-dominated ' +
  '(resistance above); red = put-dominated (support below). The amber flip and walls are ' +
  'structure (REST as-of). The pulsing mid is tape when the stream is live. Probe a strike ' +
  'for net GEX · DEX · Vol/OI.';

export const GexStrikeProfile = memo(function GexStrikeProfile({
  expLabel = 'selected window',
  structureAgeSeconds = null,
  liveSpot: liveSpotProp,
  symbol = '',
  ...props
}: Props) {
  const tape = useLiveTape();
  const liveSpot =
    liveSpotProp !== undefined
      ? liveSpotProp
      : tape.isLive && tape.live
        ? tape.live.mid
        : null;
  const tapeLive = liveSpotProp !== undefined ? liveSpotProp != null : tape.isLive && !!tape.live;

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
      <GexProfileChart
        {...props}
        liveSpot={liveSpot}
        structureAgeSeconds={structureAgeSeconds}
        symbol={symbol}
        tapeLive={tapeLive}
      />
    </Widget>
  );
});

export default GexStrikeProfile;
