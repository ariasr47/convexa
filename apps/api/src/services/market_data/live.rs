//! Live Massive-backed market data.

use super::{MarketDataSourceKind, VendorBundle};
use crate::error::AppResult;
use crate::infrastructure::massive::MassiveRestClient;
use chrono::Utc;
use quant_engine::DailyBar;

#[derive(Clone)]
pub struct LiveMarketData {
    client: MassiveRestClient,
}

impl LiveMarketData {
    pub fn new(client: MassiveRestClient) -> Self {
        Self { client }
    }

    pub async fn resolve(&self, symbol: &str) -> AppResult<VendorBundle> {
        let sym = symbol.trim().to_ascii_uppercase();
        let (market_res, daily_res, minutes_res, trades_res) = tokio::join!(
            self.client.fetch_options_market_state(&sym),
            self.client.fetch_daily_bars(&sym, 400),
            self.client.fetch_intraday_bars(&sym),
            self.client.fetch_recent_trades(&sym, 3600),
        );
        let market = market_res?;
        let daily_bars = daily_res.unwrap_or_default();
        let minutes = minutes_res.unwrap_or_default();
        let trades = trades_res.unwrap_or_default();

        Ok(VendorBundle {
            symbol: market.ticker.clone(),
            as_of: Utc::now(),
            market,
            daily_bars,
            minutes,
            trades,
            source: MarketDataSourceKind::LiveMassive,
        })
    }

    pub async fn daily_bars(&self, symbol: &str, lookback_days: i64) -> AppResult<Vec<DailyBar>> {
        self.client.fetch_daily_bars(symbol, lookback_days).await
    }
}
