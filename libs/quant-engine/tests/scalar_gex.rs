//! Integration tests for the scalar GEX path.
//!
//! These use hand-built chains (no network). Golden fixture parity lives in `golden.rs`.

use chrono::{TimeZone, Utc};
use quant_engine::{
    process_gex_profile, process_gex_profile_at, Contract, ContractType, GexOptions, Greeks,
    RegimeTag,
};

fn contract(
    strike: f64,
    side: ContractType,
    oi: f64,
    gamma: f64,
    delta: f64,
    iv: f64,
    exp: &str,
    volume: Option<f64>,
) -> Contract {
    Contract {
        strike_price: strike,
        contract_type: side,
        open_interest: oi,
        expiration_date: exp.into(),
        implied_volatility: iv,
        greeks: Some(Greeks {
            gamma: Some(gamma),
            delta: Some(delta),
            ..Default::default()
        }),
        volume,
        bid: None,
        ask: None,
    }
}

#[test]
fn spot_gamma_formula_single_call() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    // dollar_gex = gamma * oi * 100 * spot^2 * 0.01
    //           = 0.01 * 100 * 100 * 10000 * 0.01 = 10_000
    let c = contract(
        100.0,
        ContractType::Call,
        100.0,
        0.01,
        0.5,
        0.2,
        "2026-08-21",
        Some(1.0),
    );
    let r = process_gex_profile_at(&[c], 100.0, as_of);
    assert!((r.net_gex - 10_000.0).abs() < 0.02);
    assert!((r.call_gex - 10_000.0).abs() < 0.02);
    assert!((r.put_gex - 0.0).abs() < 0.02);
    assert!((r.total_gex - 10_000.0).abs() < 0.02);
    assert_eq!(r.regime, RegimeTag::Positive);
}

#[test]
fn put_sign_flips_gex() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    let c = contract(
        100.0,
        ContractType::Put,
        100.0,
        0.01,
        -0.5,
        0.2,
        "2026-08-21",
        None,
    );
    let r = process_gex_profile_at(&[c], 100.0, as_of);
    assert!((r.net_gex - (-10_000.0)).abs() < 0.02);
    assert_eq!(r.regime, RegimeTag::Negative);
}

#[test]
fn walls_and_peak_from_net_profile() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    let exp = "2026-08-21";
    let chain = vec![
        contract(
            110.0,
            ContractType::Call,
            5000.0,
            0.03,
            0.3,
            0.25,
            exp,
            Some(100.0),
        ),
        contract(
            90.0,
            ContractType::Put,
            5000.0,
            0.03,
            -0.3,
            0.25,
            exp,
            Some(100.0),
        ),
        contract(
            100.0,
            ContractType::Call,
            100.0,
            0.05,
            0.5,
            0.22,
            exp,
            Some(50.0),
        ),
        contract(
            100.0,
            ContractType::Put,
            100.0,
            0.05,
            -0.5,
            0.22,
            exp,
            Some(50.0),
        ),
    ];
    let r = process_gex_profile_at(&chain, 100.0, as_of);
    assert_eq!(r.call_wall, 110.0);
    assert_eq!(r.put_wall, 90.0);
    // Peak is the strike with largest |call_gex|+|put_gex| — 110 or 90 dominate ATM netting
    assert!(r.peak_gex_strike == 110.0 || r.peak_gex_strike == 90.0);
}

#[test]
fn max_pain_prefers_monthly_opex() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    // Weekly 2026-08-14 (2nd Friday) + monthly 2026-08-21 (3rd Friday)
    let chain = vec![
        contract(
            100.0,
            ContractType::Call,
            10.0,
            0.01,
            0.5,
            0.2,
            "2026-08-14",
            None,
        ),
        contract(
            100.0,
            ContractType::Put,
            10.0,
            0.01,
            -0.5,
            0.2,
            "2026-08-14",
            None,
        ),
        contract(
            105.0,
            ContractType::Call,
            1000.0,
            0.01,
            0.4,
            0.2,
            "2026-08-21",
            None,
        ),
        contract(
            95.0,
            ContractType::Put,
            1000.0,
            0.01,
            -0.4,
            0.2,
            "2026-08-21",
            None,
        ),
        contract(
            100.0,
            ContractType::Call,
            500.0,
            0.02,
            0.5,
            0.2,
            "2026-08-21",
            None,
        ),
        contract(
            100.0,
            ContractType::Put,
            500.0,
            0.02,
            -0.5,
            0.2,
            "2026-08-21",
            None,
        ),
    ];
    let r = process_gex_profile_at(&chain, 100.0, as_of);
    assert_eq!(r.max_pain_expiration.as_deref(), Some("2026-08-21"));
    assert!((r.max_pain - 100.0).abs() < 1e-9);
}

#[test]
fn zero_dte_contribution_detected() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 21, 10, 0, 0).unwrap(); // same day as monthly
    let chain = vec![
        // 0DTE-ish: expires today
        contract(
            100.0,
            ContractType::Call,
            1000.0,
            0.05,
            0.5,
            0.3,
            "2026-08-21",
            Some(200.0),
        ),
        // farther
        contract(
            100.0,
            ContractType::Call,
            100.0,
            0.02,
            0.5,
            0.25,
            "2026-09-18",
            Some(10.0),
        ),
    ];
    let r = process_gex_profile_at(&chain, 100.0, as_of);
    assert!(
        r.zero_dte_contribution_pct > 50.0,
        "expected majority 0DTE share, got {}",
        r.zero_dte_contribution_pct
    );
}

#[test]
fn dte_window_shapes_gex_only() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    let chain = vec![
        contract(
            100.0,
            ContractType::Call,
            100.0,
            0.05,
            0.5,
            0.2,
            "2026-08-21",
            Some(5.0),
        ),
        contract(
            100.0,
            ContractType::Put,
            500.0,
            0.05,
            -0.5,
            0.2,
            "2027-01-15",
            Some(5.0),
        ),
    ];
    let opts = GexOptions::default()
        .with_as_of(as_of)
        .with_dte_window(Some(0.0), Some(30.0));
    let r = process_gex_profile(&chain, 100.0, &opts);
    // Only call in window → positive net GEX
    assert!(r.net_gex > 0.0);
    // PCR still full chain
    assert!((r.put_call_ratio - 5.0).abs() < 0.01);
    // Volume full chain
    assert_eq!(r.total_volume, Some(10.0));
}

#[test]
fn invalid_spot_returns_empty() {
    let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 16, 0, 0).unwrap();
    let c = contract(
        100.0,
        ContractType::Call,
        10.0,
        0.01,
        0.5,
        0.2,
        "2026-08-21",
        None,
    );
    let r = process_gex_profile_at(&[c], 0.0, as_of);
    assert_eq!(r.net_gex, 0.0);
    assert!(r.strike_profile.is_empty());
}

#[test]
fn contract_type_deser_accepts_c_and_p() {
    let json = r#"{
        "strike_price": 100.0,
        "contract_type": "c",
        "open_interest": 10,
        "expiration_date": "2026-08-21",
        "implied_volatility": 0.25,
        "greeks": { "gamma": 0.01, "delta": 0.5 }
    }"#;
    let c: Contract = serde_json::from_str(json).unwrap();
    assert_eq!(c.contract_type, ContractType::Call);
    assert_eq!(c.gamma(), Some(0.01));
}
