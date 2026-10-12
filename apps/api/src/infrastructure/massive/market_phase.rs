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
    fn resolve_gex_spot_picks_live_in_rth_and_session_close_otherwise() {
        use MarketPhase::{AfterClose, ClosedPre, Rth};
        // (label, phase, live, today_close, prior_close, expected spot, expected source)
        let cases: [(&str, MarketPhase, f64, Option<f64>, Option<f64>, f64, &str); 9] = [
            (
                "RTH uses the live print",
                Rth,
                100.0,
                Some(99.0),
                Some(98.0),
                100.0,
                "live_snapshot",
            ),
            (
                "after close prefers today's close",
                AfterClose,
                100.0,
                Some(99.0),
                Some(98.0),
                99.0,
                "today_close",
            ),
            (
                "closed pre prefers the prior close",
                ClosedPre,
                100.0,
                Some(99.0),
                Some(98.0),
                98.0,
                "prior_close",
            ),
            (
                "after close without today's close falls back to the prior close",
                AfterClose,
                100.0,
                None,
                Some(98.0),
                98.0,
                "prior_close",
            ),
            (
                "after close skips a non-positive today's close",
                AfterClose,
                100.0,
                Some(0.0),
                Some(98.0),
                98.0,
                "prior_close",
            ),
            (
                "closed pre without a prior close falls back to today's close",
                ClosedPre,
                100.0,
                Some(99.0),
                None,
                99.0,
                "today_close",
            ),
            (
                "after close with no closes falls back to live",
                AfterClose,
                100.0,
                None,
                None,
                100.0,
                "live_snapshot_fallback",
            ),
            (
                "closed pre with no closes falls back to live",
                ClosedPre,
                100.0,
                None,
                None,
                100.0,
                "live_snapshot_fallback",
            ),
            (
                "non-positive live short-circuits to live even after hours",
                ClosedPre,
                0.0,
                Some(99.0),
                Some(98.0),
                0.0,
                "live_snapshot",
            ),
        ];
        for (label, phase, live, today, prior, want_px, want_src) in cases {
            let (px, src) = resolve_gex_spot(phase, live, today, prior);
            assert_eq!(px, want_px, "{label}: spot");
            assert_eq!(src, want_src, "{label}: source");
        }
    }
}
