//! Golden-fixture harness for Python ↔ Rust quant parity.
//!
//! Canonical exact-parity set: `gex_SPY.json`, `gex_QQQ.json`, `gex_NVDA.json`
//! captured with a **fixed** `as_of` via:
//!
//! ```text
//! apps/api/.venv/Scripts/python.exe apps/api/tests/capture_gex_fixtures.py \
//!     --as-of 2026-08-09T23:00:00Z SPY QQQ NVDA
//! ```

use chrono::{DateTime, Utc};
use quant_engine::{
    process_gex_profile, Contract, GexOptions, GexResult, ParityTolerances, RegimeTag,
};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct GoldenOptions {
    min_days_to_expiry: Option<f64>,
    max_days_to_expiry: Option<f64>,
    #[serde(default)]
    dividend_yield: f64,
    #[serde(default = "default_r")]
    risk_free_rate: f64,
}

fn default_r() -> f64 {
    0.045
}

#[derive(Debug, Deserialize, Default)]
struct ParityMeta {
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    aggregate_abs: Option<f64>,
    #[serde(default)]
    flip_abs: Option<f64>,
    #[serde(default)]
    strike_abs: Option<f64>,
}

impl ParityMeta {
    fn tolerances(&self) -> ParityTolerances {
        let exact = self.mode.as_deref() == Some("exact");
        let mut tol = if exact {
            ParityTolerances {
                aggregate_abs: 0.0,
                aggregate_rel: 0.0,
                flip_abs: 0.0,
                strike_abs: 0.0,
            }
        } else {
            ParityTolerances::default()
        };
        if let Some(v) = self.aggregate_abs {
            tol.aggregate_abs = v;
        }
        if let Some(v) = self.flip_abs {
            tol.flip_abs = v;
        }
        if let Some(v) = self.strike_abs {
            tol.strike_abs = v;
        }
        // Exact mode: still allow a hair of float noise on aggregates that were
        // rounded to 2dp independently on both sides (same printed value).
        if exact && tol.aggregate_abs == 0.0 {
            tol.aggregate_abs = 1e-9;
        }
        if exact && tol.flip_abs == 0.0 {
            tol.flip_abs = 1e-9;
        }
        if exact && tol.strike_abs == 0.0 {
            tol.strike_abs = 1e-9;
        }
        tol
    }
}

/// Subset-or-full expected block. Every field optional so mini fixtures stay small.
#[derive(Debug, Deserialize)]
struct GoldenExpected {
    net_gex: Option<f64>,
    call_gex: Option<f64>,
    put_gex: Option<f64>,
    total_gex: Option<f64>,
    call_wall: Option<f64>,
    put_wall: Option<f64>,
    peak_gex_strike: Option<f64>,
    gamma_flip: Option<f64>,
    max_pain: Option<f64>,
    max_pain_expiration: Option<String>,
    net_vanna: Option<f64>,
    net_charm: Option<f64>,
    net_volga: Option<f64>,
    put_call_ratio: Option<f64>,
    net_dex: Option<Option<f64>>,
    call_dex: Option<Option<f64>>,
    put_dex: Option<Option<f64>>,
    total_volume: Option<Option<f64>>,
    chain_vol_oi_ratio: Option<Option<f64>>,
    regime: Option<String>,
    #[serde(default)]
    strike_profile: Option<Vec<GoldenStrikeRow>>,
}

#[derive(Debug, Deserialize)]
struct GoldenStrikeRow {
    strike: f64,
    net_gex: f64,
    call_gex: f64,
    put_gex: f64,
    call_oi: f64,
    put_oi: f64,
    #[serde(default)]
    #[allow(dead_code)]
    total_oi: Option<f64>,
    #[serde(default)]
    #[allow(dead_code)]
    net_dex: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct GoldenFixture {
    as_of: String,
    spot: f64,
    #[serde(default)]
    options: Option<GoldenOptions>,
    #[serde(default)]
    parity: Option<ParityMeta>,
    contracts: Vec<Contract>,
    expected: GoldenExpected,
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn load_golden_paths() -> Vec<PathBuf> {
    let dir = fixtures_dir();
    if !dir.is_dir() {
        return Vec::new();
    }
    let mut paths: Vec<PathBuf> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|x| x.to_str()) == Some("json")
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.starts_with("gex_"))
        })
        .collect();
    paths.sort();
    paths
}

fn nearly_equal(a: f64, b: f64, abs: f64, rel: f64) -> bool {
    let diff = (a - b).abs();
    if diff <= abs {
        return true;
    }
    if rel > 0.0 {
        let scale = a.abs().max(b.abs()).max(1.0);
        return diff <= rel * scale;
    }
    false
}

fn assert_aggregate(name: &str, got: f64, exp: f64, tol: &ParityTolerances) {
    assert!(
        nearly_equal(got, exp, tol.aggregate_abs, tol.aggregate_rel),
        "{name}: got {got}, expected {exp} (abs={}, rel={})",
        tol.aggregate_abs,
        tol.aggregate_rel
    );
}

fn assert_strike(name: &str, got: f64, exp: f64, tol: &ParityTolerances) {
    assert!(
        (got - exp).abs() <= tol.strike_abs,
        "{name}: got {got}, expected {exp}"
    );
}

fn assert_opt_aggregate(
    name: &str,
    got: Option<f64>,
    exp: Option<f64>,
    tol: &ParityTolerances,
) {
    match (got, exp) {
        (None, None) => {}
        (Some(g), Some(e)) => assert_aggregate(name, g, e, tol),
        (g, e) => panic!("{name}: got {g:?}, expected {e:?}"),
    }
}

fn run_fixture(path: &std::path::Path) {
    let raw = fs::read_to_string(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let fix: GoldenFixture =
        serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()));

    let as_of: DateTime<Utc> = fix
        .as_of
        .parse()
        .unwrap_or_else(|e| panic!("{}: bad as_of: {e}", path.display()));

    let mut opts = GexOptions::default().with_as_of(as_of);
    if let Some(o) = fix.options {
        opts = opts
            .with_dte_window(o.min_days_to_expiry, o.max_days_to_expiry)
            .with_dividend_yield(o.dividend_yield)
            .with_risk_free_rate(o.risk_free_rate);
    }

    let got: GexResult = process_gex_profile(&fix.contracts, fix.spot, &opts);
    let exp = fix.expected;
    let tol = fix.parity.unwrap_or_default().tolerances();
    let label = path.file_name().unwrap().to_string_lossy();

    if let Some(v) = exp.net_gex {
        assert_aggregate(&format!("{label} net_gex"), got.net_gex, v, &tol);
    }
    if let Some(v) = exp.call_gex {
        assert_aggregate(&format!("{label} call_gex"), got.call_gex, v, &tol);
    }
    if let Some(v) = exp.put_gex {
        assert_aggregate(&format!("{label} put_gex"), got.put_gex, v, &tol);
    }
    if let Some(v) = exp.total_gex {
        assert_aggregate(&format!("{label} total_gex"), got.total_gex, v, &tol);
    }
    if let Some(v) = exp.call_wall {
        assert_strike(&format!("{label} call_wall"), got.call_wall, v, &tol);
    }
    if let Some(v) = exp.put_wall {
        assert_strike(&format!("{label} put_wall"), got.put_wall, v, &tol);
    }
    if let Some(v) = exp.peak_gex_strike {
        assert_strike(
            &format!("{label} peak_gex_strike"),
            got.peak_gex_strike,
            v,
            &tol,
        );
    }
    if let Some(v) = exp.gamma_flip {
        assert!(
            (got.gamma_flip - v).abs() <= tol.flip_abs,
            "{label} gamma_flip: got {}, expected {v} (tol={})",
            got.gamma_flip,
            tol.flip_abs
        );
    }
    if let Some(v) = exp.max_pain {
        assert_strike(&format!("{label} max_pain"), got.max_pain, v, &tol);
    }
    if let Some(ref v) = exp.max_pain_expiration {
        assert_eq!(
            got.max_pain_expiration.as_deref(),
            Some(v.as_str()),
            "{label} max_pain_expiration"
        );
    }
    if let Some(v) = exp.net_vanna {
        assert_aggregate(&format!("{label} net_vanna"), got.net_vanna, v, &tol);
    }
    if let Some(v) = exp.net_charm {
        assert_aggregate(&format!("{label} net_charm"), got.net_charm, v, &tol);
    }
    if let Some(v) = exp.net_volga {
        assert_aggregate(&format!("{label} net_volga"), got.net_volga, v, &tol);
    }
    if let Some(v) = exp.put_call_ratio {
        assert_aggregate(
            &format!("{label} put_call_ratio"),
            got.put_call_ratio,
            v,
            &tol,
        );
    }
    if let Some(v) = exp.net_dex {
        assert_opt_aggregate(&format!("{label} net_dex"), got.net_dex, v, &tol);
    }
    if let Some(v) = exp.call_dex {
        assert_opt_aggregate(&format!("{label} call_dex"), got.call_dex, v, &tol);
    }
    if let Some(v) = exp.put_dex {
        assert_opt_aggregate(&format!("{label} put_dex"), got.put_dex, v, &tol);
    }
    if let Some(v) = exp.total_volume {
        assert_opt_aggregate(&format!("{label} total_volume"), got.total_volume, v, &tol);
    }
    if let Some(v) = exp.chain_vol_oi_ratio {
        assert_opt_aggregate(
            &format!("{label} chain_vol_oi_ratio"),
            got.chain_vol_oi_ratio,
            v,
            &tol,
        );
    }
    if let Some(ref reg) = exp.regime {
        let expected = match reg.as_str() {
            "positive" | "positive_gamma" => RegimeTag::Positive,
            "negative" | "negative_gamma" => RegimeTag::Negative,
            "neutral" => RegimeTag::Neutral,
            other => panic!("{label}: unknown regime {other}"),
        };
        assert_eq!(got.regime, expected, "{label} regime");
    }

    if let Some(ref rows) = exp.strike_profile {
        assert_eq!(
            got.strike_profile.len(),
            rows.len(),
            "{label} strike_profile length"
        );
        for (i, (g, e)) in got.strike_profile.iter().zip(rows.iter()).enumerate() {
            assert_strike(
                &format!("{label} strike_profile[{i}].strike"),
                g.strike,
                e.strike,
                &tol,
            );
            assert_aggregate(
                &format!("{label} strike_profile[{i}].net_gex"),
                g.net_gex,
                e.net_gex,
                &tol,
            );
            assert_aggregate(
                &format!("{label} strike_profile[{i}].call_gex"),
                g.call_gex,
                e.call_gex,
                &tol,
            );
            assert_aggregate(
                &format!("{label} strike_profile[{i}].put_gex"),
                g.put_gex,
                e.put_gex,
                &tol,
            );
            assert!(
                (g.call_oi - e.call_oi).abs() < 0.5,
                "{label} strike_profile[{i}].call_oi: got {} exp {}",
                g.call_oi,
                e.call_oi
            );
            assert!(
                (g.put_oi - e.put_oi).abs() < 0.5,
                "{label} strike_profile[{i}].put_oi: got {} exp {}",
                g.put_oi,
                e.put_oi
            );
        }
    }
}

#[test]
fn golden_fixtures_if_present() {
    let paths = load_golden_paths();
    if paths.is_empty() {
        eprintln!(
            "quant-engine golden: no tests/fixtures/gex_*.json yet — skipping parity checks"
        );
        return;
    }
    for p in &paths {
        eprintln!("golden: {}", p.file_name().unwrap().to_string_lossy());
        run_fixture(p);
    }
}

/// Canonical exact-parity set must exist and share one as_of.
#[test]
fn exact_parity_set_spy_qqq_nvda() {
    let names = ["gex_SPY.json", "gex_QQQ.json", "gex_NVDA.json"];
    let mut as_ofs = Vec::new();
    for name in names {
        let path = fixtures_dir().join(name);
        if !path.is_file() {
            eprintln!("exact-parity fixture missing: {name} (run capture_gex_fixtures.py)");
            // Soft-skip when not yet captured in a fresh clone.
            return;
        }
        let raw = fs::read_to_string(&path).unwrap();
        let fix: GoldenFixture = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            fix.parity.as_ref().and_then(|p| p.mode.as_deref()),
            Some("exact"),
            "{name} should declare parity.mode=exact"
        );
        as_ofs.push(fix.as_of.clone());
        run_fixture(&path);
    }
    // All three captured at the same fixed clock.
    assert!(
        as_ofs.iter().all(|a| a == &as_ofs[0]),
        "SPY/QQQ/NVDA as_of must match for exact parity set: {as_ofs:?}"
    );
}

/// Synthetic miniature golden embedded so the harness is always exercised.
#[test]
fn embedded_mini_golden() {
    let raw = r#"{
        "as_of": "2026-08-01T16:00:00Z",
        "spot": 100.0,
        "options": {
            "min_days_to_expiry": null,
            "max_days_to_expiry": null,
            "dividend_yield": 0.0,
            "risk_free_rate": 0.045
        },
        "parity": { "mode": "exact" },
        "contracts": [
            {
                "strike_price": 100.0,
                "contract_type": "call",
                "open_interest": 100,
                "expiration_date": "2026-08-21",
                "implied_volatility": 0.25,
                "greeks": { "gamma": 0.01, "delta": 0.5 },
                "volume": 10
            }
        ],
        "expected": {
            "net_gex": 10000.0,
            "call_gex": 10000.0,
            "put_gex": 0.0,
            "call_wall": 100.0,
            "put_wall": 100.0,
            "regime": "positive"
        }
    }"#;
    let fix: GoldenFixture = serde_json::from_str(raw).unwrap();
    let as_of: DateTime<Utc> = fix.as_of.parse().unwrap();
    let opts = GexOptions::default().with_as_of(as_of);
    let got = process_gex_profile(&fix.contracts, fix.spot, &opts);
    assert!((got.net_gex - 10_000.0).abs() < 1e-9);
    assert_eq!(got.regime, RegimeTag::Positive);
}
