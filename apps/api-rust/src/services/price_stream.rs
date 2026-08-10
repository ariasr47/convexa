//! Path A: stocks WebSocket → price cache (Redis / memory).
//!
//! Completely independent of the GEX / analytics path.

use crate::config::Config;
use crate::domain::LivePrice;
use crate::error::AppResult;
use crate::infrastructure::massive::MassiveStockStream;
use crate::infrastructure::redis::PriceCache;
use chrono::Utc;
use tracing::{info, warn};

/// Stream live prices for `symbols`, writing every update to `cache`.
///
/// Runs until Ctrl-C or the websocket ends. Prints a short line per update when
/// `verbose` is true.
pub async fn run_price_stream(
    cfg: &Config,
    cache: &PriceCache,
    symbols: &[String],
    verbose: bool,
    max_events: Option<u64>,
) -> AppResult<()> {
    let mut stream = MassiveStockStream::connect(cfg, symbols).await?;
    info!(
        symbols = ?symbols,
        backend = cache.backend_name(),
        "price stream started (Path A)"
    );

    let mut n = 0_u64;
    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {
                info!("ctrl-c; stopping price stream");
                stream.hub().shutdown();
                break;
            }
            ev = stream.next_event() => {
                match ev? {
                    None => {
                        warn!("price stream ended");
                        break;
                    }
                    Some(ev) => {
                        let received_at = Utc::now().timestamp();
                        let Some(live) = LivePrice::from_event(&ev, received_at) else {
                            continue;
                        };
                        cache.set_price(&live).await?;
                        n += 1;
                        if verbose {
                            println!(
                                "{:>6}  {:>10.4}  bid={:?} ask={:?}  kind={:?}  cache={}",
                                live.symbol,
                                live.price,
                                live.bid,
                                live.ask,
                                ev.kind,
                                cache.backend_name()
                            );
                        }
                        if let Some(max) = max_events {
                            if n >= max {
                                info!(n, "reached max events; stopping");
                                stream.hub().shutdown();
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
