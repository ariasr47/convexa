//! Spot selection by market phase (GEX vs display).

use crate::domain::MarketPhase;

/// Choose the synchronized (GEX) spot given live snapshot price and session closes.
///
/// Mirrors Python `MassiveProvider.fetch_options_market_state` spot logic:
/// - **RTH** → live snapshot underlying
/// - **after_close** → today's close, else prior close, else live
/// - **closed_pre** → prior close, else today's close, else live
pub fn resolve_gex_spot(
    phase: MarketPhase,
    live_spot: f64,
    day_close: Option<f64>,
    prev_close: Option<f64>,
) -> (f64, &'static str) {
    if phase == MarketPhase::Rth || live_spot <= 0.0 {
        return (live_spot, "live_snapshot");
    }

    let candidates: &[(&str, Option<f64>)] = match phase {
        MarketPhase::AfterClose => &[("today_close", day_close), ("prior_close", prev_close)],
        MarketPhase::ClosedPre => &[("prior_close", prev_close), ("today_close", day_close)],
        MarketPhase::Rth => unreachable!(),
    };

    for (label, c) in candidates {
        if let Some(px) = c {
            if *px > 0.0 {
                return (*px, *label);
            }
        }
    }
    (live_spot, "live_snapshot_fallback")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rth_uses_live() {
        let (px, src) = resolve_gex_spot(MarketPhase::Rth, 100.0, Some(99.0), Some(98.0));
        assert_eq!(px, 100.0);
        assert_eq!(src, "live_snapshot");
    }

    #[test]
    fn after_close_prefers_today() {
        let (px, src) = resolve_gex_spot(MarketPhase::AfterClose, 100.0, Some(99.0), Some(98.0));
        assert_eq!(px, 99.0);
        assert_eq!(src, "today_close");
    }

    #[test]
    fn closed_pre_prefers_prior() {
        let (px, src) = resolve_gex_spot(MarketPhase::ClosedPre, 100.0, Some(99.0), Some(98.0));
        assert_eq!(px, 98.0);
        assert_eq!(src, "prior_close");
    }
}
