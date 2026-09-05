/**
 * GexStrikeProfile — Structure Field + embedded Structure path strip.
 * Live mid from liveTapeStore; path is slow-lane session history (not live ticks).
 *
 * This widget is a STANDALONE consumer of the tape store — not one of `structure-hero/`'s four
 * presentational children (SPEC §2.1's single-store-read invariant is scoped to that directory), so
 * it legitimately keeps its own `useLiveTape()` read. What it no longer does is compute its own
 * liveness a SECOND way: the old chain reading the store's own `isLive` flag off `tape` directly
 * (SPEC §2.1's "third fabrication site") is replaced by the canon `isDeliveringLive`/`andPresent`
 * composers, the same ones every other desk figure uses.
 */
import { andPresent, isDeliveringLive } from '@/shared/liveness/liveClaim';
import { Widget } from '@/shared/ui/Widget';
import type { StrikeRow, StructureSample } from '@convexa/api';
import { memo } from 'react';
import { useLiveTape } from '../../liveTapeStore';
import { gexProfileSubtitle } from '../_kit/copy';
import { StructurePathStrip } from '../structure-history/StructurePathStrip';
import { GexLegend, GexProfileChart, windowedStrikes } from './chart';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  expLabel?: string;
  structureAgeSeconds?: number | null;
  symbol?: string;
  /** Session structure path (slow lane) — embedded strip, not a peer card. */
  pathSamples?: StructureSample[] | null;
  pathLoading?: boolean;
  pathError?: string | null;
  pathBasis?: string | null;
}

const GEX_INFO =
  'Net dealer gamma by strike as a dual-clock Structure Field. Green = call-dominated ' +
  '(resistance above); red = put-dominated (support below). The amber flip and walls are ' +
  'structure (REST as-of). The pulsing mid is tape when the stream is live. The strip above ' +
  'is session structure path (slow lane), never live ticks.';

export const GexStrikeProfile = memo(function GexStrikeProfile({
  expLabel = 'selected window',
  structureAgeSeconds = null,
  symbol = '',
  pathSamples = null,
  pathLoading = false,
  pathError = null,
  pathBasis = null,
  ...props
}: Props) {
  const tape = useLiveTape();
  const claim = isDeliveringLive(tape.live, tape.streamOffline);
  const tapeLive = andPresent(claim, tape.live?.mid);
  const liveSpot = tapeLive ? (tape.live?.mid ?? null) : null;

  if (!windowedStrikes(props.strikes, props.spot, props.callWall, props.putWall).length)
    return null;
  return (
    <Widget
      id="gex-strike-profile"
      title="GEX strike profile"
      subtitle={gexProfileSubtitle(props.spot, expLabel, structureAgeSeconds)}
      info={GEX_INFO}
      span={2}
      bodyPad="none"
      actions={<GexLegend />}
    >
      <StructurePathStrip
        symbol={symbol || '—'}
        samples={pathSamples}
        loading={pathLoading}
        error={pathError}
        basis={pathBasis}
      />
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
