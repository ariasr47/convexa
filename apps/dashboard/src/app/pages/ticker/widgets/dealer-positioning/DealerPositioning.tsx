/**
 * DealerPositioning — the STATIC StatTile grid (Call wall · Put wall · Net GEX · Net DEX · Max pain ·
 * IV/HV · Vol/OI · IV skew · Term structure · [Off-exchange %] · Opportunity). These are snapshot
 * reads off the REST bundle: they carry NO live degradation and **stay rendered on an SSE drop**
 * (`[live-vs-static-isolation]`). Each nullable metric independently shows its own "unavailable"
 * (`[best-effort-isolated-or-null]`). Re-skin/componentize only — values + copy preserved byte-for-byte.
 */
import { OPPORTUNITY_TIER_INFO } from '@/pages/ticker/widgets/opportunity-tier';
import { Widget } from '@/shared/ui/Widget';
import type { MarketState, OffExchange, Signals } from '@convexa/api';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { memo, useState } from 'react';
import {
  dealerPositioningSubtitle,
  fmtUsdCompact,
  netDexTip,
  skewState,
  skewTip,
  termTip,
  volOiTip,
} from '../_kit/copy';
import { distanceToLevel, levelSpot } from '../_kit/distanceToLevel';
import { StatTile } from '../_kit/StatTile';
import { WallMagnetView } from './WallMagnetView';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 2,
} as const;

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
  /** REST-bundle age (seconds) — product spine #4; never from the live stream. */
  structureAgeSeconds?: number | null;
}

type ViewMode = 'levels' | 'magnet';

export const DealerPositioning = memo(function DealerPositioning({
  m,
  offExchange,
  volOiThreshold,
  unusualCount,
  tierWord,
  tierColor,
  opportunityScore,
  structureAgeSeconds = null,
}: Props) {
  const [view, setView] = useState<ViewMode>('levels');
  // Structure anchor for distance secondary lines (display-only; prefers gex_spot).
  const spot = levelSpot(m);

  return (
    <Widget
      id="dealer-positioning"
      title="Dealer positioning"
      subtitle={dealerPositioningSubtitle(structureAgeSeconds)}
      span={2}
      bodyVariant="inset"
      actions={
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, v: ViewMode | null) => {
            if (v) setView(v);
          }}
          aria-label="Dealer positioning view"
          data-testid="dealer-view-toggle"
        >
          <ToggleButton value="levels" data-testid="dealer-view-levels">
            Levels
          </ToggleButton>
          <ToggleButton value="magnet" data-testid="dealer-view-magnet">
            Magnet
          </ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {view === 'magnet' ? (
        <Box data-testid="dealer-positioning">
          <WallMagnetView
            putWall={m.put_wall}
            callWall={m.call_wall}
            gammaFlip={m.gamma_flip}
            spot={m.gex_spot ?? m.price}
          />
        </Box>
      ) : (
        <Box sx={GRID} data-testid="dealer-positioning">
          <StatTile
            label="Call wall"
            value={`$${m.call_wall}`}
            accent="up"
            secondary={distanceToLevel(m.call_wall, spot)}
            info="Strike with the most positive dealer gamma (vendor gamma × dealer-sign OI). Tends to act as resistance. Not the same object as the analytic gamma flip — see Methodology. Secondary line is distance from gex_spot (or mid)."
          />
          <StatTile
            label="Put wall"
            value={`$${m.put_wall}`}
            accent="down"
            secondary={distanceToLevel(m.put_wall, spot)}
            info="Strike with the most negative dealer gamma (vendor gamma × dealer-sign OI). Tends to act as support. OI sign is a convention, not measured inventory. Secondary line is distance from gex_spot (or mid)."
          />
          <StatTile
            label="Vol-norm GEX"
            value={
              m.vol_normalized_gex == null
                ? 'unavailable'
                : fmtUsdCompact(m.vol_normalized_gex.net_gex)
            }
            accent={
              m.vol_normalized_gex == null
                ? 'neutral'
                : m.vol_normalized_gex.net_gex >= 0
                  ? 'up'
                  : 'down'
            }
            info={
              m.vol_normalized_gex == null
                ? 'Primary magnitude read — unavailable until ATM IV or 30d HV lands on this snapshot.'
                : `Primary magnitude (vol-normalized). ${m.vol_normalized_gex.basis_note}`
            }
          />
          <StatTile
            label="Raw GEX (1% shock)"
            value={fmtUsdCompact(m.net_gex)}
            accent={m.net_gex >= 0 ? 'up' : 'down'}
            info="Secondary: raw dollar dealer gamma for a fixed 1% shock. Prefer Vol-norm GEX above for cross-regime magnitude."
          />
          <StatTile
            label="Net DEX"
            value={m.net_dex == null ? 'unavailable' : fmtUsdCompact(m.net_dex)}
            accent="neutral"
            info={netDexTip(m.call_dex, m.put_dex)}
          />
          <StatTile
            label="Max pain"
            value={`$${m.max_pain ?? '—'}`}
            accent="neutral"
            secondary={distanceToLevel(m.max_pain, spot)}
            info="Price at the nearest monthly expiration where the most option value expires worthless — a mild magnet into expiry. Secondary line is distance from gex_spot (or mid)."
          />
          <StatTile
            label="IV / HV"
            value={m.iv_hv_ratio.toFixed(2)}
            accent="neutral"
            info="Implied volatility ÷ recent realized volatility. >1 = options look expensive (favor selling); <1 = cheap (favor buying)."
          />
          <StatTile
            label="Vol/OI"
            value={
              m.chain_vol_oi_ratio == null ? 'unavailable' : `${m.chain_vol_oi_ratio.toFixed(2)}×`
            }
            accent="neutral"
            info={volOiTip(volOiThreshold, unusualCount)}
          />
          <StatTile
            label="IV skew"
            value={
              m.iv_skew == null
                ? 'unavailable'
                : `${m.iv_skew.slope >= 0 ? '+' : '−'}${Math.abs(m.iv_skew.slope).toFixed(1)} pts · ${skewState(m.iv_skew.slope)}`
            }
            accent="neutral"
            info={m.iv_skew == null ? 'IV skew unavailable this cycle.' : skewTip(m.iv_skew)}
          />
          <StatTile
            label="Term structure"
            value={
              m.term_structure == null
                ? 'unavailable'
                : m.term_structure.points.length < 2
                  ? '—'
                  : m.term_structure.state
            }
            accent="neutral"
            info={
              m.term_structure == null
                ? 'Term structure unavailable this cycle.'
                : termTip(m.term_structure)
            }
          />
          {offExchange?.ratio_pct != null && (
            <StatTile
              label="Off-exchange %"
              value={`${offExchange.ratio_pct}%`}
              accent="neutral"
              info={`Share of recent volume printed off-lit (dark pools/ATS + internalized retail). Top levels: ${
                offExchange.levels
                  .slice(0, 3)
                  .map((l) => `$${l.price} (${l.share_of_offex_pct}%)`)
                  .join(', ') || '—'
              }. Side/intent unknown — context only, not a directional signal.`}
            />
          )}
          <StatTile
            label="Opportunity"
            value={`${opportunityScore} · ${tierWord}`}
            accent="neutral"
            accentColor={tierColor}
            info={
              '0–100 triage score (proximity + IV/HV stretch + setups + flip transition + optional dark pool). Does not use vol-norm GEX or IV-rank — those stay advisory. Not a trade signal.' +
              OPPORTUNITY_TIER_INFO
            }
          />
        </Box>
      )}
    </Widget>
  );
});

export default DealerPositioning;
