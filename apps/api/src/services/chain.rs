//! Fetch a live chain from Massive and run quant-engine GEX (Path B seed).

use crate::config::Config;
use crate::error::AppResult;
use crate::infrastructure::massive::MassiveRestClient;
use chrono::Utc;
use quant_engine::{process_gex_profile, GexOptions, GexResult};
use tracing::info;

/// Fetch options chain for `ticker`, run `process_gex_profile`, return result + meta.
pub async fn run_gex_on_chain(
    cfg: &Config,
    ticker: &str,
) -> AppResult<(crate::domain::OptionsMarketState, GexResult, std::time::Duration)> {
    let client = MassiveRestClient::new(cfg)?;
    let state = client.fetch_options_market_state(ticker).await?;

    let as_of = Utc::now();
    let opts = GexOptions::default()
        .with_as_of(as_of)
        .with_risk_free_rate(0.045);

    let t0 = std::time::Instant::now();
    let gex = process_gex_profile(&state.contracts, state.synchronized_spot, &opts);
    let elapsed = t0.elapsed();

    info!(
        ticker = %state.ticker,
        phase = state.market_phase.as_str(),
        spot = state.synchronized_spot,
        n = state.contracts.len(),
        net_gex = gex.net_gex,
        elapsed_ms = elapsed.as_secs_f64() * 1000.0,
        "gex computed from live chain"
    );

    Ok((state, gex, elapsed))
}
