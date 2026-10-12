//! Value-pinned money math (batch 101, "R2 money and vendor parsers"): exact 30-day HV, exact
//! session VWAP ±σ bands, and the signals layer's dark-pool bonus and VWAP-band setups.
//!
//! Every expected value is derived by hand from the documented formula (module docs +
//! PROJECT_CONTEXT §3), not captured from a run. The arithmetic sits next to each assertion.

use quant_engine::signals::OffExchangeLevel;
use quant_engine::{
    calculate_historical_volatility_30d, calculate_vwap_bands_default, generate_signals,
    IntradayBar, MarketStateInput, OffExchangeInput, VwapBands,
};

// ---------------------------------------------------------------------------
// 30-day historical volatility
// ---------------------------------------------------------------------------

/// Closes alternating 100, 101, 100, ... so every log return is exactly +/- ln(1.01).
fn alternating_closes(n: usize) -> Vec<f64> {
    (0..n)
        .map(|i| if i % 2 == 0 { 100.0 } else { 101.0 })
        .collect()
}

#[test]
fn hv_30d_is_sample_stdev_of_log_returns_annualized_by_sqrt_252_in_percent() {
    // 31 closes -> 30 returns: 15 x +ln(1.01), 15 x -ln(1.01); mean 0.
    // ln(1.01) = 0.009950330853168
    // sample var (ddof=1) = 30 * ln(1.01)^2 / 29 -> sd = 0.009950330853168 * sqrt(30/29)
    //                                               = 0.010120434300728
    // x sqrt(252) (15.874507866388) x 100 = 16.065691391817 -> round 4dp = 16.0657
    // (population ddof=0 would give 15.7957; sqrt(365) would give 19.3351.)
    assert_eq!(
        calculate_historical_volatility_30d(&alternating_closes(31)),
        16.0657
    );
}

#[test]
fn hv_30d_with_fewer_than_31_closes_is_zero() {
    // 30 closes = 29 returns: the 30-return window cannot be filled, so no partial-window
    // estimate is emitted (the same alternating series has a clearly non-zero sample sd).
    assert_eq!(
        calculate_historical_volatility_30d(&alternating_closes(30)),
        0.0
    );
}

// ---------------------------------------------------------------------------
// Session VWAP and +/- sigma bands
// ---------------------------------------------------------------------------

fn rth_bar(minute: u32, vw: f64, v: f64) -> IntradayBar {
    IntradayBar::from_et(2026, 8, 7, 10, minute, vw, v)
}

#[test]
fn vwap_bands_are_volume_weighted_mean_and_volume_weighted_population_sigma_of_bar_vw() {
    // 10 RTH bars (= VWAP_MIN_BARS): 5 x (vw 99, 100 sh), 5 x (vw 101, 300 sh).
    // VWAP  = (5*99*100 + 5*101*300) / 2000 = (49500 + 151500) / 2000 = 100.5
    // sigma^2 = (500*(99-100.5)^2 + 1500*(101-100.5)^2) / 2000 = (1125 + 375) / 2000 = 0.75
    // sigma = 0.866025403784
    // +2s = 102.232050808 -> 102.23   -2s = 98.767949192 -> 98.77
    // +3s = 103.098076211 -> 103.10   -3s = 97.901923789 -> 97.90
    // Round-to-2dp then compare exactly: x/100 is correctly rounded, so it equals the literal.
    let mut bars: Vec<IntradayBar> = (0..5).map(|m| rth_bar(m, 99.0, 100.0)).collect();
    bars.extend((5..10).map(|m| rth_bar(m, 101.0, 300.0)));
    assert_eq!(
        calculate_vwap_bands_default(&bars),
        Some(VwapBands {
            vwap: 100.5,
            vwap_upper_2: 102.23,
            vwap_upper_3: 103.1,
            vwap_lower_2: 98.77,
            vwap_lower_3: 97.9,
        })
    );
}

// ---------------------------------------------------------------------------
// Signals: dark-pool bonus (context-only, capped) and VWAP-band setups
// ---------------------------------------------------------------------------

/// Positive gamma, every level >= 5% from price 100: proximity 0 (nearest 5% > 3% decay),
/// no wall setups (> 0.75%), no flip transition (> 1%), no pin (max pain absent),
/// IV/HV absent -> vol 0 and neutral. Opportunity score 0.
fn calm_positive_gamma() -> MarketStateInput {
    MarketStateInput {
        ticker: Some("TEST".into()),
        price: Some(100.0),
        gamma_flip: Some(95.0),
        net_gex: Some(1.0e9),
        call_wall: Some(110.0),
        put_wall: Some(90.0),
        peak_gex_strike: Some(105.0),
        ..MarketStateInput::default()
    }
}

/// calm_positive_gamma + IV/HV 1.5 (IV rich): vol = min(|1.5-1|*50, 25) = 25, plus one
/// "Range premium sell" setup = 8 -> base opportunity score 33.
fn rich_range_state() -> MarketStateInput {
    MarketStateInput {
        iv_hv_ratio: Some(1.5),
        ..calm_positive_gamma()
    }
}

fn off_exchange(prices: &[Option<f64>]) -> OffExchangeInput {
    OffExchangeInput {
        levels: Some(
            prices
                .iter()
                .map(|&price| OffExchangeLevel { price })
                .collect(),
        ),
    }
}

#[test]
fn dark_pool_bonus_is_three_points_per_matched_level_capped_at_six() {
    let state = rich_range_state();
    // Off-exchange prices sitting exactly on call wall 110, put wall 90, flip 95, peak 105.
    let cases: [(&[Option<f64>], i32, i32); 4] = [
        (&[Some(110.0)], 3, 36),                         // 1 match: 33 + 3
        (&[Some(110.0), Some(90.0)], 6, 39),             // 2 matches: 33 + 6
        (&[Some(110.0), Some(90.0), Some(95.0)], 6, 39), // 9 -> capped at 6
        (&[Some(110.0), Some(90.0), Some(95.0), Some(105.0)], 6, 39), // 12 -> capped at 6
    ];
    for (prices, bonus, score) in cases {
        let s = generate_signals(&state, Some(&off_exchange(prices)));
        let drivers = s.score_drivers.as_ref().expect("score drivers present");
        assert_eq!(
            (drivers.dark_pool, s.opportunity_score),
            (bonus, score),
            "off-exchange levels {prices:?}"
        );
    }
}

#[test]
fn signals_are_byte_identical_when_off_exchange_is_absent_empty_or_unmatched() {
    let state = rich_range_state();
    let baseline = serde_json::to_string(&generate_signals(&state, None)).expect("serialize");
    let no_levels = OffExchangeInput { levels: None };
    let empty = off_exchange(&[]);
    // 200 is > 0.5% from every gamma level; a None or 0.0 price is skipped.
    let unmatched = off_exchange(&[Some(200.0), None, Some(0.0)]);
    for (label, ox) in [
        ("levels: None", &no_levels),
        ("levels: []", &empty),
        ("no level matches", &unmatched),
    ] {
        let with = serde_json::to_string(&generate_signals(&state, Some(ox))).expect("serialize");
        assert_eq!(with, baseline, "{label}");
    }
}

#[test]
fn vwap_two_sigma_band_touch_adds_a_reversion_setup_only_in_positive_gamma() {
    let calm = calm_positive_gamma();
    let cases: [(&str, MarketStateInput, &[(&str, &str)], i32); 7] = [
        (
            "price exactly at +2s (inclusive)",
            MarketStateInput {
                vwap_upper_2: Some(100.0),
                ..calm.clone()
            },
            &[("VWAP band reversion", "short")],
            8,
        ),
        (
            "price above +2s",
            MarketStateInput {
                vwap_upper_2: Some(99.5),
                ..calm.clone()
            },
            &[("VWAP band reversion", "short")],
            8,
        ),
        (
            "price just below +2s",
            MarketStateInput {
                vwap_upper_2: Some(100.01),
                ..calm.clone()
            },
            &[],
            0,
        ),
        (
            "price exactly at -2s (inclusive)",
            MarketStateInput {
                vwap_lower_2: Some(100.0),
                ..calm.clone()
            },
            &[("VWAP band reversion", "long")],
            8,
        ),
        (
            "price just above -2s",
            MarketStateInput {
                vwap_lower_2: Some(99.99),
                ..calm.clone()
            },
            &[],
            0,
        ),
        (
            "+2s of 0.0 means no band",
            MarketStateInput {
                vwap_upper_2: Some(0.0),
                ..calm.clone()
            },
            &[],
            0,
        ),
        (
            "negative gamma ignores the band",
            MarketStateInput {
                net_gex: Some(-1.0e9),
                vwap_upper_2: Some(100.0),
                ..calm.clone()
            },
            &[("Trend regime", "directional")],
            8,
        ),
    ];
    // Score = setups x 8 (proximity, vol and transition are all 0 for this state).
    for (label, state, want_setups, want_score) in cases {
        let s = generate_signals(&state, None);
        let got: Vec<(&str, &str)> = s
            .setups
            .iter()
            .map(|x| (x.name.as_str(), x.bias.as_str()))
            .collect();
        assert_eq!(
            (got.as_slice(), s.opportunity_score),
            (want_setups, want_score),
            "{label}"
        );
    }
}
