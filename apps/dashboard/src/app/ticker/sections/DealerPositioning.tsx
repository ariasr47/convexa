/**
 * DealerPositioning — the STATIC StatTile grid (Call wall · Put wall · Net GEX · Net DEX · Max pain ·
 * IV/HV · Vol/OI · IV skew · Term structure · [Off-exchange %] · Opportunity). These are snapshot
 * reads off the REST bundle: they carry NO live degradation and **stay rendered on an SSE drop**
 * (`[live-vs-static-isolation]`). Each nullable metric independently shows its own "unavailable"
 * (`[best-effort-isolated-or-null]`). Re-skin/componentize only — values + copy preserved byte-for-byte.
 */
import { Box, Stack, Typography } from '@mui/material';
import type { OffExchange, Signals, MarketState } from '@org/api';
import { StatTile } from './StatTile';
import { netDexTip, skewState, skewTip, termTip, volOiTip } from './copy';
import { OPPORTUNITY_TIER_INFO } from '../../ghost-trade/OpportunityTier';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 } as const;

interface Props {
  m: MarketState;
  sig: Signals | undefined;
  offExchange: OffExchange | null | undefined;
  volOiThreshold: number;
  unusualCount: number;
  /** Opportunity tier emphasis (word + accent color), computed in TickerDashboard via tierMeta. */
  tierWord: string;
  tierColor: string;
  opportunityScore: number;
}

export function DealerPositioning({
  m, offExchange, volOiThreshold, unusualCount, tierWord, tierColor, opportunityScore,
}: Props) {
  return (
    <Box data-testid="dealer-positioning">
      <Stack direction="row" sx={{ alignItems: 'baseline', columnGap: 1.5, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
          DEALER POSITIONING
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          Snapshot, never live — these stay current on a stream drop and refresh with the data load.
        </Typography>
      </Stack>
      <Box sx={GRID}>
        <StatTile label="Call wall" value={`$${m.call_wall}`} accent="up"
          info="Strike with the most positive dealer gamma — tends to act as resistance (dealers sell into rallies here)." />
        <StatTile label="Put wall" value={`$${m.put_wall}`} accent="down"
          info="Strike with the most negative dealer gamma — tends to act as support (dealers buy dips here)." />
        <StatTile label="Net GEX" value={`$${(m.net_gex / 1e6).toFixed(1)}M`} accent={m.net_gex >= 0 ? 'up' : 'down'}
          info="Total dealer gamma across the chain. Positive = dealers dampen moves (range-bound); negative = they amplify moves (trending)." />
        <StatTile label="Net DEX"
          value={m.net_dex == null ? 'unavailable' : `$${(m.net_dex / 1e6).toFixed(1)}M`} accent="neutral"
          info={netDexTip(m.call_dex, m.put_dex)} />
        <StatTile label="Max pain" value={`$${m.max_pain ?? '—'}`} accent="neutral"
          info="Price at the nearest monthly expiration where the most option value expires worthless — a mild magnet into expiry." />
        <StatTile label="IV / HV" value={m.iv_hv_ratio.toFixed(2)} accent="neutral"
          info="Implied volatility ÷ recent realized volatility. >1 = options look expensive (favor selling); <1 = cheap (favor buying)." />
        <StatTile label="Vol/OI"
          value={m.chain_vol_oi_ratio == null ? 'unavailable' : `${m.chain_vol_oi_ratio.toFixed(2)}×`}
          accent="neutral" info={volOiTip(volOiThreshold, unusualCount)} />
        <StatTile label="IV skew"
          value={m.iv_skew == null ? 'unavailable'
            : `${m.iv_skew.slope >= 0 ? '+' : '−'}${Math.abs(m.iv_skew.slope).toFixed(1)} pts · ${skewState(m.iv_skew.slope)}`}
          accent="neutral"
          info={m.iv_skew == null ? 'IV skew unavailable this cycle.' : skewTip(m.iv_skew)} />
        <StatTile label="Term structure"
          value={m.term_structure == null ? 'unavailable'
            : m.term_structure.points.length < 2 ? '—' : m.term_structure.state}
          accent="neutral"
          info={m.term_structure == null ? 'Term structure unavailable this cycle.' : termTip(m.term_structure)} />
        {offExchange?.ratio_pct != null && (
          <StatTile label="Off-exchange %" value={`${offExchange.ratio_pct}%`} accent="neutral"
            info={`Share of recent volume printed off-lit (dark pools/ATS + internalized retail). Top levels: ${
              offExchange.levels.slice(0, 3).map((l) => `$${l.price} (${l.share_of_offex_pct}%)`).join(', ') || '—'
            }. Side/intent unknown — context only, not a directional signal.`} />
        )}
        <StatTile label="Opportunity" value={`${opportunityScore} · ${tierWord}`} accent="neutral" accentColor={tierColor}
          info={"0–100 triage score for how actionable the setup is now (closeness to a key level + volatility extremity + confluence). Not a trade signal." + OPPORTUNITY_TIER_INFO} />
      </Box>
    </Box>
  );
}

export default DealerPositioning;
