//! Micro-bench: full `process_gex_profile` + isolated gamma-flip on golden fixtures.
//!
//! ```text
//! cargo bench -p quant-engine --bench gex_bench --release
//! ```

use quant_engine::gamma_flip::{find_gamma_flip_legs, FlipLegSoA};
use quant_engine::greeks::time_to_expiry_years;
use quant_engine::{gex_kernel_name, process_gex_profile, Contract, GexOptions};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Deserialize)]
struct FixtureOptions {
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

#[derive(Deserialize)]
struct GoldenFixture {
    as_of: String,
    spot: f64,
    #[serde(default)]
    options: Option<FixtureOptions>,
    contracts: Vec<Contract>,
    #[serde(default)]
    expected: Option<serde_json::Value>,
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn load(name: &str) -> GoldenFixture {
    let path = fixtures_dir().join(name);
    let raw = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()))
}

fn build_flip_legs(fix: &GoldenFixture) -> (FlipLegSoA, f64, f64) {
    let as_of = fix.as_of.parse().unwrap();
    let r = fix
        .options
        .as_ref()
        .map(|o| o.risk_free_rate)
        .unwrap_or(0.045);
    let q = fix
        .options
        .as_ref()
        .map(|o| o.dividend_yield)
        .unwrap_or(0.0);
    let mut legs = FlipLegSoA::with_capacity(fix.contracts.len());
    for c in &fix.contracts {
        if c.implied_volatility <= 0.0 {
            continue;
        }
        let Some(exp) = c.expiration_date_only() else {
            continue;
        };
        // Only non-expired (same spirit as process_gex_profile)
        let t = time_to_expiry_years(exp, as_of);
        if t * 365.0 <= 0.0 && exp < as_of.date_naive() {
            continue;
        }
        legs.push(
            c.strike_price,
            t,
            c.implied_volatility,
            c.open_interest,
            c.contract_type,
        );
    }
    (legs, r, q)
}

fn time_fixture(name: &str, iters: u32) {
    let fix = load(name);
    let as_of = fix.as_of.parse().unwrap();
    let mut opts = GexOptions::default().with_as_of(as_of);
    if let Some(o) = &fix.options {
        opts = opts
            .with_dte_window(o.min_days_to_expiry, o.max_days_to_expiry)
            .with_dividend_yield(o.dividend_yield)
            .with_risk_free_rate(o.risk_free_rate);
    }

    let (legs, r, q) = build_flip_legs(&fix);

    // Warmup
    for _ in 0..3 {
        let _ = process_gex_profile(&fix.contracts, fix.spot, &opts);
        let _ = find_gamma_flip_legs(&legs, fix.spot, r, q);
    }

    // Full profile
    let t0 = Instant::now();
    let mut last_flip = 0.0;
    let mut last_net = 0.0;
    for _ in 0..iters {
        let res = process_gex_profile(&fix.contracts, fix.spot, &opts);
        last_net = res.net_gex;
        last_flip = res.gamma_flip;
    }
    let full_ms = t0.elapsed().as_secs_f64() * 1000.0 / f64::from(iters);

    // Flip only
    let t1 = Instant::now();
    let mut flip_only = 0.0;
    for _ in 0..iters {
        flip_only = find_gamma_flip_legs(&legs, fix.spot, r, q);
    }
    let flip_ms = t1.elapsed().as_secs_f64() * 1000.0 / f64::from(iters);

    let exp_flip = fix
        .expected
        .as_ref()
        .and_then(|e| e.get("gamma_flip"))
        .and_then(|v| v.as_f64());

    println!(
        "{name}: contracts={} legs={}  full={full_ms:.2} ms  flip_only={flip_ms:.2} ms  \
         flip={last_flip} (exp={exp_flip:?}) net_gex={last_net}  kernel={}",
        fix.contracts.len(),
        legs.len(),
        gex_kernel_name()
    );
    assert_eq!(
        round2(flip_only),
        round2(last_flip),
        "isolated flip must match process_gex_profile flip"
    );
    if let Some(e) = exp_flip {
        assert!(
            (last_flip - e).abs() < 1e-9,
            "golden flip parity: got {last_flip} exp {e}"
        );
    }
}

fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

fn main() {
    println!("quant-engine bench  kernel={}", gex_kernel_name());
    for name in ["gex_SPY.json", "gex_QQQ.json", "gex_NVDA.json"] {
        let path = fixtures_dir().join(name);
        if !path.is_file() {
            println!("{name}: SKIP (missing)");
            continue;
        }
        time_fixture(name, 15);
    }
}
