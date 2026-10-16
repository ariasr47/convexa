/**
 * The SEC tools in a note's public-record band: insider trades over twelve months with buying
 * clusters, the note's figures checked against the filing, the largest 13F holders and the
 * company against its peers. Mounted once in NotePublicPanels,
 * which has already handled loading, a failed read and PUBLIC_DATA=off for the whole band.
 */
import type { PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import { FiledFiguresSection } from './FiledFigures';
import { FundHoldingsSection } from './FundHoldings';
import { InsiderClustersSection } from './InsiderClusters';
import { PeersSection } from './Peers';

export function SecRecordSections({ d }: { d: PublicTicker }) {
  if (d.state === 'off') return null;
  return (
    <Box sx={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <InsiderClustersSection d={d} />
      <FiledFiguresSection d={d} />
      <FundHoldingsSection d={d} />
      <PeersSection d={d} />
    </Box>
  );
}
