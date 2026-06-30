/**
 * GexStrikeProfile — the Ticker section wrapper around the existing recharts net-GEX chart
 * (`gex-profile-chart.tsx`). Per the contract this **keeps the chart logic and re-skins the frame**:
 * the underlying `GexProfileChart` owns the card chrome + legend + recharts bars (its frame radius is
 * re-skinned in place); this component is the composition seam so `TickerDashboard` reads cleanly and
 * the section has a stable home. No chart logic changes here.
 */
import type { StrikeRow } from '@org/api';
import { GexProfileChart } from '../../gex-profile-chart';

interface Props {
  strikes: StrikeRow[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  liveSpot?: number | null;
}

export function GexStrikeProfile(props: Props) {
  return <GexProfileChart {...props} />;
}

export default GexStrikeProfile;
