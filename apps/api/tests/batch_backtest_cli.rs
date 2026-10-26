//! Hermetic integration harness for batch-backtest-cli (SPEC §7 / PLAN B9).

use api_rust::config::ChainSnapshotBackend;
use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::{
    as_of_string, fixture_probe_bundle, serialize_capture, to_wire, CONFORMANCE_SEED_AS_OF,
};
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::services::research::batch_backtest::{
    emit_run, hermetic_params, measurement_identity_value, open_chain_store_for_cli, parse_symbols,
    parse_train_frac, run_batch_backtest, validate_flags, BatchBacktestOpts, EmitOpts, RawFlags,
    ReplayHooks, RowDisposition, RunResult, SelectMode, SplitRule, CLOSING_LINE, EMPTY_CORPUS_LINE,
    SPLIT_REFUSE_LINE, STANDING_TITLE,
};
use chrono::{DateTime, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::collections::HashSet;
use std::path::PathBuf;

fn ts(nanos: u32) -> DateTime<Utc> {
    DateTime::<Utc>::from_timestamp(0, nanos).unwrap()
}

fn unique_tempdir() -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "batch-bt-cli-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&p).unwrap();
    p
}

fn dummy_config(store: PathBuf) -> api_rust::Config {
    api_rust::Config {
        massive_api_key: String::new(),
        data_feed: api_rust::DataFeed::Delayed,
        rest_base: "https://api.massive.com".into(),
        redis_url: None,
        http_bind: "127.0.0.1:0".into(),
        gex_cache_ttl_secs: 10,
        gex_cache_ttl_liquid_secs: 20,
        sse_occupancy_keepalive_ms: 5_000,
        warm_symbols: vec![],
        liquid_symbols: HashSet::new(),
        warm_interval_secs: 25,
        warm_concurrency: 2,
        warm_enabled: false,
        scan_enabled: false,
        scan_universe_path: PathBuf::from("."),
        scan_fast_interval_secs: 30,
        scan_slow_batch_size: 4,
        scan_promotion_cap: 2,
        scan_stale_after_secs: 180,
        scan_market_hours_only: false,
        scan_store_path: PathBuf::from("."),
        scan_database_url: None,
        auth_store_path: PathBuf::from("."),
        auth_session_signing_key: "test".into(),
        auth_cookie_secure: false,
        auth_cookie_samesite: "lax".into(),
        auth_session_idle_secs: 3600,
        auth_session_absolute_secs: 86400,
        auth_registration_open: true,
        auth_demo_seed: None,
        owner_emails: Default::default(),
        include_dark_pool: false,
        darkpool_lookback_secs: 3600,
        block_min_shares: 5000,
        iv_store_path: PathBuf::from("data/iv_timeseries.json"),
        database_url: None,
        public_rate_limit_per_min: 0,
        auth_rate_limit_per_min: 0,
        metrics_secret_token: None,
        chain_snapshot_max_age_secs: 1_209_600,
        chain_snapshot_max_per_symbol: 48,
        chain_snapshot_store_path: store,
        chain_snapshot_enabled: false,
        chain_snapshot_backend: ChainSnapshotBackend::Disabled,
        chain_snapshot_backend_explicit: false,
        session_chain_archive_enabled: false,
        session_chain_archive_store_path: PathBuf::from("data/session_chain_archive"),
        session_chain_archive_body_root: None,
        session_day_tape_body_root: None,
        massive_flat_files_body_root: None,
        massive_files_access_key: String::new(),
        massive_files_secret: String::new(),
        liquid_session_ensure_enabled: false,
        max_live_sessions: 0,
        max_live_subscribers: 0,
        workspace_root: PathBuf::from("."),
        market_data_mode: api_rust::config::MarketDataMode::Live,
        public_data: api_rust::config::PublicDataMode::Off,
        sec_user_agent: None,
    }
}

async fn plant(store: &ChainSnapshotStore, symbol: &str, as_of: DateTime<Utc>, empty: bool) {
    let mut b = fixture_probe_bundle(symbol, as_of);
    if empty {
        b.market.contracts.clear();
    }
    let wire = to_wire(&b);
    let bytes = serialize_capture(&wire).unwrap();
    store.append(&wire, &bytes).await.unwrap();
}

fn silent(_phase: &str) {}

fn opts(symbols: &[&str], mode: SelectMode, split: Option<SplitRule>) -> BatchBacktestOpts {
    BatchBacktestOpts {
        symbols: symbols.iter().map(|s| (*s).to_string()).collect(),
        mode,
        split,
        params: hermetic_params(None, None),
        run_stamp: "pin".into(),
    }
}

async fn score_triple() -> (i32, String, String) {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
    let port = MarketDataPort::fixture(load_fixture_dir(&dir).unwrap());
    let snap = compute_from_port(&port, "SYN", None, &AnalyticsComputeParams::default(), None)
        .await
        .expect("hermetic compute");
    let g = &snap.gex;
    let ms_in = market_state_from_gex(
        &snap.ticker,
        snap.display_spot,
        snap.gex_spot,
        g.net_gex,
        g.call_wall,
        g.put_wall,
        g.peak_gex_strike,
        g.gamma_flip,
        if g.max_pain > 0.0 {
            Some(g.max_pain)
        } else {
            None
        },
        snap.iv_hv_ratio,
        snap.vwap.map(|b| b.vwap_upper_2),
        snap.vwap.map(|b| b.vwap_lower_2),
    );
    let ox_in = snap.off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = snap
        .signals
        .clone()
        .unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()));
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    (signals.opportunity_score, tier, gate.state_fingerprint)
}

fn emit_text(
    result: &RunResult,
    json: bool,
    as_of_mode: bool,
    out: Option<PathBuf>,
) -> (String, String) {
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let emit = emit_run(
        result,
        &EmitOpts {
            json,
            out,
            as_of_mode,
        },
        &mut stdout,
        &mut stderr,
    );
    let out_s = String::from_utf8(stdout).unwrap();
    let err_s = String::from_utf8(stderr).unwrap();
    if let Err(e) = emit {
        return (out_s, format!("{err_s}{e}"));
    }
    (out_s, err_s)
}

#[tokio::test]
async fn batch_backtest_harness_happy_split_refuse_empty_identity() {
    let store = ChainSnapshotStore::memory();
    plant(&store, "SPY", ts(1), false).await;
    plant(&store, "SPY", ts(2), false).await;
    plant(&store, "SPY", ts(3), false).await;
    plant(&store, "QQQ", ts(2), false).await;

    // AC-1, AC-2, AC-3, AC-25 — unsplit multi-symbol + D-metrics + standing.
    let result = run_batch_backtest(
        &store,
        &opts(
            &["SPY", "QQQ"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            None,
        ),
        None,
        &mut silent,
    )
    .await;
    let RunResult::Measurement(run) = &result else {
        panic!("expected measurement, got {result:?}");
    };
    assert_eq!(run.artifact.authorizes, "nothing");
    assert_eq!(run.artifact.standing.authorizes, "nothing");
    assert!(run.artifact.standing.not_live);
    assert_eq!(run.artifact.standing.massive_calls, 0);
    assert_eq!(run.artifact.corpus_status.as_str(), "ok");
    let c = &run.artifact.counts;
    assert_eq!(c.selected, c.replayed + c.skipped);
    assert_eq!(c.selected, 4);
    assert_eq!(c.replayed, 4);
    for row in &run.artifact.rows {
        assert_eq!(row.disposition, RowDisposition::Replayed);
        let m = row.measurement.as_ref().expect("replayed has metrics");
        assert!(m.contract_count >= 1);
        let _ = (
            m.opportunity_score,
            &m.opportunity_tier,
            m.net_gex,
            m.call_wall,
            m.put_wall,
            m.gamma_flip,
        );
    }
    let serialized = serde_json::to_string(&run.artifact).unwrap();
    assert!(!serialized.contains("compute_ms"));
    assert!(!serialized.contains("adopt"));
    assert!(!serialized.contains("update the live score"));
    let (stdout, _) = emit_text(&result, false, false, None);
    assert!(stdout.starts_with(STANDING_TITLE));
    assert!(stdout.contains(CLOSING_LINE));
    assert!(stdout.contains("Authorizes:  nothing"));

    // AC-4, AC-5 — two different cuts differ in membership.
    let split_a = run_batch_backtest(
        &store,
        &opts(
            &["SPY"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            Some(SplitRule::At(ts(2))),
        ),
        None,
        &mut silent,
    )
    .await;
    let split_b = run_batch_backtest(
        &store,
        &opts(
            &["SPY"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            Some(SplitRule::At(ts(3))),
        ),
        None,
        &mut silent,
    )
    .await;
    let RunResult::Measurement(a) = &split_a else {
        panic!("split a");
    };
    let RunResult::Measurement(b) = &split_b else {
        panic!("split b");
    };
    let sa = a.artifact.split.as_ref().unwrap();
    let sb = b.artifact.split.as_ref().unwrap();
    assert_ne!(sa.rule, sb.rule);
    assert_eq!(sa.train.len(), 1);
    assert_eq!(sa.holdout.len(), 2);
    assert_eq!(sb.train.len(), 2);
    assert_eq!(sb.holdout.len(), 1);
    assert_eq!(sa.train[0].symbol, "SPY");
    assert!(sa.train[0].as_of.contains("1970-01-01"));

    // AC-6 + S2 pin 4 — skipped-only side refuse; --as-of + split refuse.
    let refuse_store = ChainSnapshotStore::memory();
    plant(&refuse_store, "SPY", ts(1), true).await;
    plant(&refuse_store, "SPY", ts(3), false).await;
    let refused = run_batch_backtest(
        &refuse_store,
        &opts(
            &["SPY"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            Some(SplitRule::At(ts(2))),
        ),
        None,
        &mut silent,
    )
    .await;
    assert!(matches!(refused, RunResult::SplitRefused));
    let dir = unique_tempdir();
    let refuse_out = dir.join("refused.json");
    let (so, se) = emit_text(&refused, false, false, Some(refuse_out.clone()));
    assert!(se.contains(SPLIT_REFUSE_LINE) || so.contains(SPLIT_REFUSE_LINE));
    assert!(!refuse_out.exists());

    let asof_split = run_batch_backtest(
        &store,
        &opts(
            &["SPY"],
            SelectMode::AsOf(ts(2)),
            Some(SplitRule::TrainFrac(0.5)),
        ),
        None,
        &mut silent,
    )
    .await;
    assert!(matches!(asof_split, RunResult::SplitRefused));

    // AC-7, AC-8 — zero vendor calls (hooks compute is Path-B, not Massive).
    let hooks = ReplayHooks::default();
    let _ = run_batch_backtest(
        &store,
        &opts(
            &["SPY", "QQQ"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            None,
        ),
        Some(&hooks),
        &mut silent,
    )
    .await;
    // compute is invoked only for non-empty books; never a vendor client.
    assert!(hooks.compute_call_count() >= 1);

    // AC-9 — second run byte-identical measurement body (strip run_stamp).
    let r1 = run_batch_backtest(
        &store,
        &opts(
            &["SPY", "QQQ"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            None,
        ),
        None,
        &mut silent,
    )
    .await;
    let r2 = run_batch_backtest(
        &store,
        &opts(
            &["SPY", "QQQ"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            None,
        ),
        None,
        &mut silent,
    )
    .await;
    let RunResult::Measurement(m1) = &r1 else {
        panic!("r1");
    };
    let RunResult::Measurement(m2) = &r2 else {
        panic!("r2");
    };
    assert_eq!(
        measurement_identity_value(&m1.artifact),
        measurement_identity_value(&m2.artifact)
    );

    // AC-10, AC-11 — empty corpus console-only + per-symbol miss.
    let empty = ChainSnapshotStore::memory();
    let empty_out = dir.join("empty_corpus.json");
    let empty_run = run_batch_backtest(
        &empty,
        &opts(
            &["SPY"],
            SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            None,
        ),
        None,
        &mut silent,
    )
    .await;
    let (eso, _) = emit_text(&empty_run, false, false, Some(empty_out.clone()));
    assert!(eso.contains(EMPTY_CORPUS_LINE));
    assert!(eso.contains("no stored snapshot for SPY"));
    assert!(!eso.contains(STANDING_TITLE));
    assert!(!empty_out.exists());

    // AC-12 — --as-of miss no substitute; disposition in artifact (S2 pin 1).
    let miss_out = dir.join("asof_miss.json");
    let miss = run_batch_backtest(
        &store,
        &opts(&["SPY"], SelectMode::AsOf(ts(9)), None),
        None,
        &mut silent,
    )
    .await;
    let (mso, _) = emit_text(&miss, false, true, Some(miss_out.clone()));
    assert!(miss_out.exists());
    assert!(mso.contains(&format!(
        "no stored snapshot for SPY at {}",
        as_of_string(ts(9))
    )));
    let mv: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&miss_out).unwrap()).unwrap();
    assert_eq!(mv["rows"][0]["disposition"], "missing");
    assert_eq!(mv["corpus_status"], "none_replayed");
    assert!(mv["rows"][0].get("opportunity_score").is_none());

    // AC-13 — empty book literal + no score figure.
    let eb = run_batch_backtest(
        &refuse_store,
        &opts(&["SPY"], SelectMode::AsOf(ts(1)), None),
        None,
        &mut silent,
    )
    .await;
    let RunResult::Measurement(ebrun) = &eb else {
        panic!("empty book measurement");
    };
    assert_eq!(
        ebrun.artifact.rows[0].disposition,
        RowDisposition::EmptyBook
    );
    assert!(ebrun.artifact.rows[0].measurement.is_none());
    let (ebo, _) = emit_text(&eb, false, true, None);
    assert!(ebo.contains("empty stored book for SPY"));
    assert!(!ebo.contains("no stored snapshot for SPY"));

    // AC-14 — compute failure isolated.
    let iso = ChainSnapshotStore::memory();
    plant(&iso, "SPY", ts(1), false).await;
    plant(&iso, "QQQ", ts(1), false).await;
    let fail_hooks = ReplayHooks {
        fail_symbols: vec!["QQQ".into()],
        ..ReplayHooks::default()
    };
    let iso_run = run_batch_backtest(
        &iso,
        &opts(&["SPY", "QQQ"], SelectMode::AsOf(ts(1)), None),
        Some(&fail_hooks),
        &mut silent,
    )
    .await;
    let RunResult::Measurement(iso_m) = &iso_run else {
        panic!("iso");
    };
    assert_eq!(iso_m.artifact.corpus_status.as_str(), "partial");
    let qqq = iso_m
        .artifact
        .rows
        .iter()
        .find(|r| r.symbol == "QQQ")
        .unwrap();
    let spy = iso_m
        .artifact
        .rows
        .iter()
        .find(|r| r.symbol == "SPY")
        .unwrap();
    assert_eq!(qqq.disposition, RowDisposition::ComputeFailed);
    assert_eq!(spy.disposition, RowDisposition::Replayed);
    let (iso_out, _) = emit_text(&iso_run, false, true, None);
    assert!(iso_out.contains("replay error for QQQ"));

    // AC-15 — partial multi-symbol (replayed + skipped).
    assert_eq!(iso_m.artifact.counts.replayed, 1);
    assert_eq!(iso_m.artifact.counts.skipped, 1);
    assert_eq!(
        iso_m.artifact.counts.selected,
        iso_m.artifact.counts.replayed + iso_m.artifact.counts.skipped
    );

    // AC-16 — store open hard fail (file used as dir).
    let not_dir = dir.join("not-a-dir");
    std::fs::write(&not_dir, b"nope").unwrap();
    let cfg = dummy_config(dir.clone());
    let open_err = open_chain_store_for_cli(Some(not_dir), &cfg).await;
    let msg = match open_err {
        Ok(_) => panic!("expected unreadable store path"),
        Err(e) => e.to_string(),
    };
    assert!(msg.contains("stored snapshot unreadable"));

    // AC-17 — capture write off (chain_snapshot_enabled=false) still opens json.
    let json_dir = unique_tempdir();
    let cfg_off = dummy_config(json_dir.clone());
    assert!(!cfg_off.chain_snapshot_enabled);
    let json_store = open_chain_store_for_cli(Some(json_dir.clone()), &cfg_off)
        .await
        .unwrap();
    assert!(json_store.is_enabled());
    plant(&json_store, "SPY", ts(1), false).await;
    let replay_off = run_batch_backtest(
        &json_store,
        &opts(&["SPY"], SelectMode::AsOf(ts(1)), None),
        None,
        &mut silent,
    )
    .await;
    assert!(matches!(replay_off, RunResult::Measurement(_)));

    // AC-18, AC-19 — authorizes nothing; no adoption verbs.
    let RunResult::Measurement(ok) = &result else {
        unreachable!();
    };
    assert_eq!(ok.artifact.authorizes, "nothing");
    let dumped = serde_json::to_string(&ok.artifact)
        .unwrap()
        .to_ascii_lowercase();
    assert!(!dumped.contains("adopt"));
    assert!(!dumped.contains("ship this weight"));
    assert!(!dumped.contains("winner ready for production"));

    // AC-20 — live score/tier/fingerprint byte-identical after a run.
    let before = score_triple().await;
    let _ = run_batch_backtest(
        &store,
        &opts(&["SPY"], SelectMode::AsOf(ts(1)), None),
        None,
        &mut silent,
    )
    .await;
    let after = score_triple().await;
    assert_eq!(before, after);

    // --train-frac 0 / 1 usage error.
    assert!(parse_train_frac(0.0).is_err());
    assert!(parse_train_frac(1.0).is_err());
    assert!(validate_flags(&RawFlags {
        train_frac: Some(0.0),
        ..RawFlags::default()
    })
    .is_err());

    // AC-25 --json standing on stderr.
    let (jout, jerr) = emit_text(&result, true, false, None);
    assert_eq!(jout.as_bytes().first().copied(), Some(b'{'));
    assert!(jerr.contains(STANDING_TITLE));
    let jv: serde_json::Value = serde_json::from_str(&jout).unwrap();
    assert!(jv.get("standing").is_some());

    // Full as_of string identity (S2 minor — do not truncate).
    let seed: DateTime<Utc> = chrono::DateTime::parse_from_rfc3339(CONFORMANCE_SEED_AS_OF)
        .unwrap()
        .with_timezone(&Utc);
    assert_eq!(as_of_string(seed), CONFORMANCE_SEED_AS_OF);
    let _ = parse_symbols("SPY,QQQ").unwrap();
}
