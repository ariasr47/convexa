//! Hermetic gate for massive-flat-file-keep (PLAN B7 / SPEC §3 method notes / AC-54).
//!
//! One injected Monday-clock pass: occupancy matrix, per-class skip-GET, mixed-class
//! exit, HTTP twins, credential refuses, coverage/tape non-regression, score identity,
//! hub/SSE isolation. Stub UniverseGet + Memory/Json — no network.
//!
//! AC-54 trades-only plant does **not** require whole-command files-call 0 or keep exit 0.

use api_rust::domain::{StreamEvent, StreamKind};
use api_rust::infrastructure::flatfiles::{classify_files_credentials, CredentialClass};
use api_rust::infrastructure::massive::ws::StockStreamHub;
use api_rust::routes;
use api_rust::services::analytics::{compute_from_port, refresh_analytics, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::fixture_probe_bundle;
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::day_tape::SessionDayTape;
use api_rust::services::flat_file_keep::cli::{evaluate_cli, evaluate_keep};
use api_rust::services::flat_file_keep::keep::{
    both_classes_skipped, keep_process_exit, run_keep, ClassVerdict, GetOutcome,
    KeepCredentialGate, UniverseGet,
};
use api_rust::services::flat_file_keep::{
    is_content_hit, is_due, is_et_weekend, load_envelope, occupancy_token, ExtractClass,
    FlatFilesStore, Occupancy, EVIDENCE_CLI, FRAMING_HIT, MISSING_CREDENTIALS,
    WRONG_CREDENTIAL_CLASS,
};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::services::session_chain_archive::{
    derive as coverage_derive, ensure_one, EnsureOutcome, SessionChainArchive,
};
use api_rust::state::AppState;
use axum::body::to_bytes;
use axum::http::{HeaderValue, Request, StatusCode};
use chrono::{DateTime, TimeZone, Utc};
use chrono_tz::America::New_York;
use flate2::write::GzEncoder;
use flate2::Compression;
use futures_util::future::BoxFuture;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use serde_json::Value;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::time::{timeout, Duration};
use tower::ServiceExt;

const D: &str = "2026-08-10"; // Monday
const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";

fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

fn due_now() -> DateTime<Utc> {
    et_hm(2026, 8, 11, 12, 0) // Tuesday after 11:00 ET
}

fn trio_csv() -> &'static str {
    "ticker,price\nSPY,1.0\nQQQ,2.0\nIWM,3.0\n"
}

fn plant_gzip(csv: &str) -> Vec<u8> {
    let mut enc = GzEncoder::new(Vec::new(), Compression::default());
    enc.write_all(csv.as_bytes()).unwrap();
    enc.finish().unwrap()
}

fn temp_dir(tag: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "ff_keep_b7_{tag}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&p).unwrap();
    p
}

/// Mirror of keep::test_stub::StubClient (cfg(test) is unavailable to integration tests).
#[derive(Clone)]
enum StubResp {
    NotFound,
    Gzip(Vec<u8>),
    Status(u16),
    Transport,
    AssertNotCalled,
}

#[derive(Clone)]
struct StubClient {
    trades: Arc<Mutex<StubResp>>,
    quotes: Arc<Mutex<StubResp>>,
    trades_sends: Arc<AtomicU64>,
    quotes_sends: Arc<AtomicU64>,
}

impl StubClient {
    fn new(trades: StubResp, quotes: StubResp) -> Self {
        Self {
            trades: Arc::new(Mutex::new(trades)),
            quotes: Arc::new(Mutex::new(quotes)),
            trades_sends: Arc::new(AtomicU64::new(0)),
            quotes_sends: Arc::new(AtomicU64::new(0)),
        }
    }

    fn both(resp: StubResp) -> Self {
        Self::new(resp.clone(), resp)
    }
}

impl UniverseGet for StubClient {
    fn get_to_temp(
        &self,
        class: ExtractClass,
        _et_date: &str,
        dest: &Path,
    ) -> BoxFuture<'_, GetOutcome> {
        let (slot, counter) = match class {
            ExtractClass::Trades => (&self.trades, &self.trades_sends),
            ExtractClass::Quotes => (&self.quotes, &self.quotes_sends),
        };
        let resp = slot.lock().unwrap().clone();
        let dest = dest.to_path_buf();
        Box::pin(async move {
            match resp {
                StubResp::AssertNotCalled => {
                    panic!("UniverseGet::get_to_temp must not be called for {class:?}");
                }
                StubResp::NotFound => {
                    counter.fetch_add(1, Ordering::SeqCst);
                    GetOutcome::Status { code: 404 }
                }
                StubResp::Status(code) => {
                    counter.fetch_add(1, Ordering::SeqCst);
                    GetOutcome::Status { code }
                }
                StubResp::Transport => {
                    counter.fetch_add(1, Ordering::SeqCst);
                    GetOutcome::Transport {
                        sanitized: "files.massive.com/…".into(),
                    }
                }
                StubResp::Gzip(bytes) => {
                    counter.fetch_add(1, Ordering::SeqCst);
                    if let Some(parent) = dest.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    std::fs::write(&dest, &bytes).expect("write gzip temp");
                    GetOutcome::Status { code: 200 }
                }
            }
        })
    }

    fn send_count(&self, class: ExtractClass) -> u64 {
        match class {
            ExtractClass::Trades => self.trades_sends.load(Ordering::SeqCst),
            ExtractClass::Quotes => self.quotes_sends.load(Ordering::SeqCst),
        }
    }
}

async fn keep(
    client: &StubClient,
    store: &FlatFilesStore,
    named: &str,
) -> api_rust::services::flat_file_keep::keep::KeepReport {
    keep_at(client, store, named, due_now(), KeepCredentialGate::Ready).await
}

async fn keep_at(
    client: &StubClient,
    store: &FlatFilesStore,
    named: &str,
    now: DateTime<Utc>,
    credential: KeepCredentialGate,
) -> api_rust::services::flat_file_keep::keep::KeepReport {
    let tmp = temp_dir("run");
    let report = run_keep(client, store, D, named, now, credential, &tmp).await;
    let _ = std::fs::remove_dir_all(&tmp);
    report
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
}

async fn harness_state(flat_files: FlatFilesStore) -> AppState {
    let book = api_rust::services::capacity_harness::fixture::load_capacity_book(&golden_path())
        .expect("golden");
    let mut state = AppState::for_capacity_harness(book.catalog, 4, 9)
        .await
        .expect("harness");
    state.flat_files = flat_files;
    state.chain_snapshots = ChainSnapshotStore::memory();
    state.session_archive = SessionChainArchive::memory();
    state.day_tape = SessionDayTape::memory();
    state
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

async fn http_json(state: AppState, method_uri: &str, token: Option<&str>) -> (StatusCode, Value) {
    let router = routes::router(state).expect("router");
    let mut req = Request::builder()
        .method("GET")
        .uri(method_uri)
        .body(axum::body::Body::empty())
        .unwrap();
    if let Some(t) = token {
        req.headers_mut().insert(
            "authorization",
            HeaderValue::from_str(&format!("Bearer {t}")).unwrap(),
        );
    }
    let resp = router.oneshot(req).await.unwrap();
    let status = resp.status();
    let body = to_bytes(response_body(resp), 1024 * 1024).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    (status, json)
}

fn response_body(resp: axum::response::Response) -> axum::body::Body {
    resp.into_body()
}

#[tokio::test]
async fn hermetic_monday_occupancy_matrix_ac54_score_sse() {
    // ── 1. Due keep, no sibling content-hit → both classes stored for trio (AC-1–3) ──
    let gz = plant_gzip(trio_csv());
    let client = StubClient::new(StubResp::Gzip(gz.clone()), StubResp::Gzip(gz.clone()));
    let store = FlatFilesStore::memory();
    let report = keep(&client, &store, "SPY").await;
    assert!(matches!(
        report.trades,
        ClassVerdict::Stored(Occupancy::Kept { .. })
    ));
    assert!(matches!(
        report.quotes,
        ClassVerdict::Stored(Occupancy::Kept { .. })
    ));
    for sym in ["SPY", "QQQ", "IWM"] {
        assert!(is_content_hit(
            &store.load(sym, D, ExtractClass::Trades, due_now()).await
        ));
        assert!(is_content_hit(
            &store.load(sym, D, ExtractClass::Quotes, due_now()).await
        ));
    }
    assert_eq!(client.send_count(ExtractClass::Trades), 1);
    assert_eq!(client.send_count(ExtractClass::Quotes), 1);

    // ── 2. Mixed trades-kept + quotes-miss load twin (AC-4) ──
    let mixed = FlatFilesStore::memory();
    mixed
        .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    mixed.put_miss(D, ExtractClass::Quotes).await.unwrap();
    let env = load_envelope(
        "SPY",
        D,
        mixed.load("SPY", D, ExtractClass::Trades, due_now()).await,
        mixed.load("SPY", D, ExtractClass::Quotes, due_now()).await,
    );
    assert_eq!(env.http_status, 200);
    assert_eq!(env.framing, FRAMING_HIT);
    assert!(env.detail.is_none(), "content-hit ⇒ detail null");
    assert!(matches!(env.trades, Occupancy::Kept { .. }));
    assert_eq!(env.quotes, Occupancy::Miss);

    // HTTP twin
    let mut state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("state");
    state.flat_files = mixed.clone();
    let (st, body) = http_json(
        state.clone(),
        &format!("/api/_research/flat-files/SPY/extract?et_date={D}"),
        Some(OPERATOR_TOKEN),
    )
    .await;
    assert_eq!(st, StatusCode::OK);
    assert_eq!(body["detail"], Value::Null);
    assert_eq!(body["trades_occupancy"], "kept");
    assert_eq!(body["quotes_occupancy"], "miss");
    assert_eq!(body["vendor_called"], false);
    assert_eq!(body["evidence"], "this process");

    // ── 3. AC-54 plant: SPY trades kept, keep names QQQ ──
    // Do NOT assert whole-command files-call 0 or keep CLI exit 0 on this plant.
    let plant = FlatFilesStore::memory();
    plant
        .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let gz_q = plant_gzip(trio_csv());
    let client_ac54 = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gz_q));
    let report_ac54 = keep(&client_ac54, &plant, "QQQ").await;
    assert!(matches!(report_ac54.trades, ClassVerdict::SkipGet { .. }));
    assert_eq!(client_ac54.send_count(ExtractClass::Trades), 0);
    assert!(client_ac54.send_count(ExtractClass::Quotes) >= 1);
    assert!(!both_classes_skipped(&report_ac54));
    assert_eq!(
        plant.load("QQQ", D, ExtractClass::Trades, due_now()).await,
        Occupancy::NoStoredExtract
    );
    assert_ne!(
        plant.load("QQQ", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Miss
    );
    assert!(matches!(
        plant.load("SPY", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Kept { .. }
    ));
    assert!(!matches!(
        report_ac54.trades,
        ClassVerdict::DownloadFailed | ClassVerdict::Miss
    ));
    // Quotes still GET / store; exit may be 0 here because quotes kept — still not whole-command 0.
    let (_stdout_ac54, _, code_ac54) = {
        let tmp = temp_dir("cli_ac54");
        let out = evaluate_keep(
            &plant,
            &StubClient::new(StubResp::AssertNotCalled, StubResp::AssertNotCalled),
            due_now(),
            "QQQ",
            D,
            KeepCredentialGate::Ready,
            &tmp,
        )
        .await;
        let _ = std::fs::remove_dir_all(&tmp);
        out
    };
    // After quotes stored above, both? trades skip + quotes already content-hit from prior keep.
    // Re-plant for CLI print on a fresh trades-skip + quotes-miss (non-zero exit).
    let plant_miss = FlatFilesStore::memory();
    plant_miss
        .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let client_miss = StubClient::new(StubResp::AssertNotCalled, StubResp::NotFound);
    let tmp = temp_dir("cli_ac54_miss");
    let (stdout_miss, _, code_miss) = evaluate_keep(
        &plant_miss,
        &client_miss,
        due_now(),
        "QQQ",
        D,
        KeepCredentialGate::Ready,
        &tmp,
    )
    .await;
    let _ = std::fs::remove_dir_all(&tmp);
    assert_ne!(code_miss, ExitCode::SUCCESS);
    assert!(!stdout_miss.contains("Vendor I/O: 0"));
    assert!(client_miss.send_count(ExtractClass::Quotes) >= 1);
    assert_eq!(client_miss.send_count(ExtractClass::Trades), 0);
    let _ = code_ac54;

    // ── 4. Both-classes content-hit → whole-command files-call 0, skip-GET [OK] exit 0 ──
    let both = FlatFilesStore::memory();
    both.put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    both.put_extract("SPY", D, ExtractClass::Quotes, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let client_both = StubClient::both(StubResp::AssertNotCalled);
    let report_both = keep(&client_both, &both, "QQQ").await;
    assert!(both_classes_skipped(&report_both));
    assert_eq!(client_both.send_count(ExtractClass::Trades), 0);
    assert_eq!(client_both.send_count(ExtractClass::Quotes), 0);
    assert_eq!(keep_process_exit(&report_both), ExitCode::SUCCESS);
    let tmp = temp_dir("cli_both");
    let (stdout_both, _, code_both) = evaluate_keep(
        &both,
        &client_both,
        due_now(),
        "QQQ",
        D,
        KeepCredentialGate::Ready,
        &tmp,
    )
    .await;
    let _ = std::fs::remove_dir_all(&tmp);
    assert_eq!(code_both, ExitCode::SUCCESS);
    assert!(stdout_both.contains("[OK]"));
    assert!(stdout_both.contains("Vendor I/O: 0") || stdout_both.contains("0 files GET"));

    // ── 5. Trades skip + quotes miss → process non-zero ──
    let t5 = FlatFilesStore::memory();
    t5.put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let r5 = keep(
        &StubClient::new(StubResp::AssertNotCalled, StubResp::NotFound),
        &t5,
        "QQQ",
    )
    .await;
    assert_ne!(keep_process_exit(&r5), ExitCode::SUCCESS);

    // ── 6. Trades skip + quotes GET stored → process 0 ──
    let t6 = FlatFilesStore::memory();
    t6.put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let r6 = keep(
        &StubClient::new(
            StubResp::AssertNotCalled,
            StubResp::Gzip(plant_gzip(trio_csv())),
        ),
        &t6,
        "QQQ",
    )
    .await;
    assert_eq!(keep_process_exit(&r6), ExitCode::SUCCESS);
    assert!(!both_classes_skipped(&r6));

    // ── 7. 404 after GET while sibling locked extract → download-failed, no miss sidecar ──
    let t7 = FlatFilesStore::memory();
    t7.put_unreadable_pointer("SPY", D, ExtractClass::Trades, "corrupt".into())
        .await
        .unwrap();
    let r7 = keep(
        &StubClient::new(StubResp::NotFound, StubResp::NotFound),
        &t7,
        "QQQ",
    )
    .await;
    assert_eq!(r7.trades, ClassVerdict::DownloadFailed);
    assert_eq!(
        t7.load("QQQ", D, ExtractClass::Trades, due_now()).await,
        Occupancy::NoStoredExtract
    );
    assert_ne!(
        t7.load("QQQ", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Miss
    );

    // ── 8. NVDA not-in-watchlist files-call 0 (AC-5) ──
    let r8 = keep(&StubClient::both(StubResp::AssertNotCalled), &store, "NVDA").await;
    assert!(matches!(
        r8.trades,
        ClassVerdict::Gate(Occupancy::NotInWatchlist)
    ));
    assert_eq!(keep_process_exit(&r8), ExitCode::SUCCESS);

    // ── 9. 10:59 not-elapsed; 11:00 due; Friday→Saturday; keep does not sleep (AC-10–13) ──
    assert!(!is_due(D, et_hm(2026, 8, 11, 10, 59)));
    assert!(is_due(D, et_hm(2026, 8, 11, 11, 0)));
    assert!(is_due("2026-08-14", et_hm(2026, 8, 15, 11, 0))); // Friday due Saturday
    assert!(!is_due("2026-08-14", et_hm(2026, 8, 15, 10, 59)));
    let start = Instant::now();
    let r9 = keep_at(
        &StubClient::both(StubResp::AssertNotCalled),
        &FlatFilesStore::memory(),
        "SPY",
        et_hm(2026, 8, 11, 10, 59),
        KeepCredentialGate::Ready,
    )
    .await;
    assert!(start.elapsed().as_millis() < 500, "keep must not sleep");
    assert!(matches!(
        r9.trades,
        ClassVerdict::Gate(Occupancy::NotElapsed)
    ));
    assert!(is_et_weekend("2026-08-08"));
    assert!(!is_et_weekend(D));

    // ── 10. Keep 404 zero locked → miss + sidecar + non-zero (AC-14) ──
    let t10 = FlatFilesStore::memory();
    let r10 = keep(&StubClient::both(StubResp::NotFound), &t10, "SPY").await;
    assert_eq!(r10.trades, ClassVerdict::Miss);
    assert_ne!(keep_process_exit(&r10), ExitCode::SUCCESS);
    assert_eq!(
        t10.load("SPY", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Miss
    );

    // ── 11. Dated inspect empty due → no stored extract; undated empty list → hit framing (AC-15) ──
    let empty = FlatFilesStore::memory();
    let (stdout11, _, code11) = evaluate_cli(&empty, due_now(), Some("SPY"), Some(D)).await;
    assert_eq!(code11, ExitCode::SUCCESS);
    assert!(stdout11.contains("flat files no stored extract"));
    assert!(!stdout11.contains("flat files miss:"));
    assert!(stdout11.contains(EVIDENCE_CLI));
    let (stdout_list, _, code_list) = evaluate_cli(&empty, due_now(), Some("SPY"), None).await;
    assert_eq!(code_list, ExitCode::SUCCESS);
    assert!(stdout_list.contains(FRAMING_HIT) || stdout_list.contains("Framing:"));
    assert!(stdout_list.contains("occupancy") || stdout_list.contains("ET date"));

    // ── 12. Inspect persisted miss; CLI list miss vs empty extract; mixed inspect (AC-17/25/56) ──
    let miss_store = FlatFilesStore::memory();
    miss_store.put_miss(D, ExtractClass::Trades).await.unwrap();
    miss_store.put_miss(D, ExtractClass::Quotes).await.unwrap();
    let (stdout12, _, code12) = evaluate_cli(&miss_store, due_now(), Some("SPY"), Some(D)).await;
    assert_ne!(code12, ExitCode::SUCCESS);
    assert!(stdout12.contains("flat files miss:"));
    // Empty extract vs miss at 0 rows
    let ee = FlatFilesStore::memory();
    ee.put_extract("SPY", D, ExtractClass::Trades, "ticker\n".into(), 0)
        .await
        .unwrap();
    ee.put_extract("SPY", D, ExtractClass::Quotes, "ticker\n".into(), 0)
        .await
        .unwrap();
    let listed = ee.list("SPY", due_now()).await;
    let trade_row = listed
        .iter()
        .find(|r| r.class == ExtractClass::Trades)
        .expect("trades row");
    assert_eq!(trade_row.occupancy, Occupancy::EmptyExtract);
    assert_eq!(occupancy_token(&trade_row.occupancy), "empty extract");
    assert_eq!(trade_row.row_count, 0);
    let (stdout_ee, _, code_ee) = evaluate_cli(&ee, due_now(), Some("SPY"), Some(D)).await;
    assert_eq!(code_ee, ExitCode::SUCCESS);
    assert!(stdout_ee.contains("empty extract") || stdout_ee.contains("flat files empty extract"));
    // Mixed inspect AC-56: trades kept + quotes miss
    let (stdout_mix, _, _) = evaluate_cli(&mixed, due_now(), Some("SPY"), Some(D)).await;
    assert!(stdout_mix.contains("trades:") || stdout_mix.contains("kept"));
    assert!(stdout_mix.contains("quotes:") || stdout_mix.contains("miss"));

    // ── 13. Transport/401/403 → download failed on keep CLI, not on list/load DTO (AC-16) ──
    for code in [401u16, 403, 500] {
        let s = FlatFilesStore::memory();
        let c = StubClient::both(StubResp::Status(code));
        let tmp = temp_dir("dl");
        let (stdout, _, exit) =
            evaluate_keep(&s, &c, due_now(), "SPY", D, KeepCredentialGate::Ready, &tmp).await;
        let _ = std::fs::remove_dir_all(&tmp);
        assert_ne!(exit, ExitCode::SUCCESS);
        assert!(stdout.contains("download failed"));
        assert_ne!(
            s.load("SPY", D, ExtractClass::Trades, due_now()).await,
            Occupancy::Miss
        );
    }
    // List/load DTO must not carry download-failed token for a miss plant.
    let mut state_dto = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .unwrap();
    state_dto.flat_files = miss_store.clone();
    let (_, list_body) = http_json(
        state_dto.clone(),
        "/api/_research/flat-files/SPY",
        Some(OPERATOR_TOKEN),
    )
    .await;
    let list_s = list_body.to_string();
    assert!(!list_s.contains("download failed"));

    // ── 14. Leftover crash temp → dated inspect no stored extract (AC-19) ──
    let root = temp_dir("json_root");
    let json_store = FlatFilesStore::open_json(&root).expect("json open");
    if let FlatFilesStore::Json(ref inner) = json_store {
        let _temp = inner.plant_keep_temp_for_tests(D, ExtractClass::Trades);
    }
    let (stdout14, _, code14) = evaluate_cli(&json_store, due_now(), Some("SPY"), Some(D)).await;
    assert_eq!(code14, ExitCode::SUCCESS);
    assert!(stdout14.contains("flat files no stored extract"));
    assert!(!stdout14.contains("flat files miss:"));
    let _ = std::fs::remove_dir_all(&root);

    // ── 15. Partial-trio → SPY kept, QQQ no stored extract, skip GET that class ──
    let partial = FlatFilesStore::memory();
    partial
        .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    let r15 = keep(
        &StubClient::new(
            StubResp::AssertNotCalled,
            StubResp::Gzip(plant_gzip(trio_csv())),
        ),
        &partial,
        "QQQ",
    )
    .await;
    assert!(matches!(r15.trades, ClassVerdict::SkipGet { .. }));
    assert_eq!(
        partial
            .load("QQQ", D, ExtractClass::Trades, due_now())
            .await,
        Occupancy::NoStoredExtract
    );

    // ── 16. Unreadable trades + quotes miss → HTTP 500 (AC-55); both unreadable → 500;
    //     content-hit + unreadable sibling → 200, empty body for unread class ──
    let u1 = FlatFilesStore::memory();
    u1.put_unreadable_pointer("SPY", D, ExtractClass::Trades, "bad header".into())
        .await
        .unwrap();
    u1.put_miss(D, ExtractClass::Quotes).await.unwrap();
    // miss beside locked extract is refused — quotes may stay no-stored or miss depending.
    let env_u1 = u1.load_both("SPY", D, due_now()).await;
    assert_eq!(env_u1.http_status, 500);

    let u2 = FlatFilesStore::memory();
    u2.put_unreadable_pointer("SPY", D, ExtractClass::Trades, "a".into())
        .await
        .unwrap();
    u2.put_unreadable_pointer("SPY", D, ExtractClass::Quotes, "b".into())
        .await
        .unwrap();
    assert_eq!(u2.load_both("SPY", D, due_now()).await.http_status, 500);

    let u3 = FlatFilesStore::memory();
    u3.put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
        .await
        .unwrap();
    u3.put_unreadable_pointer("SPY", D, ExtractClass::Quotes, "q".into())
        .await
        .unwrap();
    let env_u3 = u3.load_both("SPY", D, due_now()).await;
    assert_eq!(env_u3.http_status, 200);
    assert!(env_u3.detail.is_none());
    let mut state_u = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .unwrap();
    state_u.flat_files = u3.clone();
    let (st_u, body_u) = http_json(
        state_u,
        &format!("/api/_research/flat-files/SPY/extract?et_date={D}"),
        Some(OPERATOR_TOKEN),
    )
    .await;
    assert_eq!(st_u, StatusCode::OK);
    assert_eq!(body_u["quotes_extract"], "");
    assert!(body_u["trades_extract"]
        .as_str()
        .unwrap_or("")
        .contains("SPY"));

    // ── 17. Already-kept not overwritten (AC-27); credential refuses (AC-21/22) ──
    let fw = FlatFilesStore::memory();
    fw.put_extract(
        "SPY",
        D,
        ExtractClass::Trades,
        "ticker,price\nSPY,99.0\n".into(),
        1,
    )
    .await
    .unwrap();
    let _ = keep(
        &StubClient::new(
            StubResp::AssertNotCalled,
            StubResp::Gzip(plant_gzip(trio_csv())),
        ),
        &fw,
        "SPY",
    )
    .await;
    assert_eq!(
        fw.load("SPY", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Kept { row_count: 1 }
    );

    assert_eq!(
        classify_files_credentials("", "secret", None),
        CredentialClass::MissingFilesCredentials
    );
    assert_eq!(
        classify_files_credentials("AKIA", "", None),
        CredentialClass::MissingFilesCredentials
    );
    assert_eq!(
        classify_files_credentials("live-rest-key", "secret", Some("live-rest-key")),
        CredentialClass::WrongCredentialClass
    );
    assert_eq!(
        classify_files_credentials("access", "live-rest-key", Some("live-rest-key")),
        CredentialClass::WrongCredentialClass
    );
    let tmp = temp_dir("cred");
    let (stdout_miss_cred, _, code_mc) = evaluate_keep(
        &FlatFilesStore::memory(),
        &StubClient::both(StubResp::AssertNotCalled),
        due_now(),
        "SPY",
        D,
        KeepCredentialGate::MissingFilesCredentials,
        &tmp,
    )
    .await;
    assert_ne!(code_mc, ExitCode::SUCCESS);
    assert!(stdout_miss_cred.contains(MISSING_CREDENTIALS));
    assert!(!stdout_miss_cred.contains("REST apiKey"));
    let (stdout_wrong, _, code_w) = evaluate_keep(
        &FlatFilesStore::memory(),
        &StubClient::both(StubResp::AssertNotCalled),
        due_now(),
        "SPY",
        D,
        KeepCredentialGate::WrongCredentialClass,
        &tmp,
    )
    .await;
    let _ = std::fs::remove_dir_all(&tmp);
    assert_ne!(code_w, ExitCode::SUCCESS);
    // CLI hardcodes period form (not the · literal); REST clause must still appear.
    assert!(stdout_wrong.contains("flat files wrong credential class"));
    assert!(stdout_wrong.contains("REST apiKey is not the files secret"));
    assert!(WRONG_CREDENTIAL_CLASS.contains("REST apiKey"));

    // ── 18. Unset root not-storing desk up; collision refuse-to-mix (AC-20/32/34) ──
    let r_ns = keep(
        &StubClient::both(StubResp::AssertNotCalled),
        &FlatFilesStore::not_storing(),
        "SPY",
    )
    .await;
    assert!(matches!(
        r_ns.trades,
        ClassVerdict::Gate(Occupancy::NotStoring)
    ));
    let r_refuse = keep(
        &StubClient::both(StubResp::AssertNotCalled),
        &FlatFilesStore::refuse_to_mix(),
        "SPY",
    )
    .await;
    assert!(matches!(
        r_refuse.trades,
        ClassVerdict::Gate(Occupancy::RefuseToMix)
    ));
    assert_ne!(r_ns.trades, r_refuse.trades);

    // ── 19. Coverage missing stays missing; tape occupancy unchanged (AC-35–38) ──
    let archive = SessionChainArchive::memory();
    let evening = et_hm(2026, 8, 10, 20, 0);
    let cov_before = coverage_derive(&archive, evening, D).await.expect("cov");
    let missing_before = cov_before.missing;
    let tape = SessionDayTape::memory();
    assert!(tape.load("SPY", D).await.unwrap().is_none());
    // Keep / load must not insert_if_absent or flip coverage.
    let _ = keep(
        &StubClient::both(StubResp::Gzip(plant_gzip(trio_csv()))),
        &FlatFilesStore::memory(),
        "SPY",
    )
    .await;
    let cov_after = coverage_derive(&archive, evening, D).await.expect("cov");
    assert_eq!(cov_after.missing, missing_before);
    assert_eq!(cov_after.present, cov_before.present);
    assert!(tape.load("SPY", D).await.unwrap().is_none());

    // ── 20. Load with vendor stub down; gzip discarded; no aggregates (AC-8/9/51/52) ──
    let load_store = FlatFilesStore::memory();
    load_store
        .put_extract(
            "SPY",
            D,
            ExtractClass::Trades,
            "ticker,price\nSPY,1.0\n".into(),
            1,
        )
        .await
        .unwrap();
    load_store
        .put_extract(
            "SPY",
            D,
            ExtractClass::Quotes,
            "ticker,bid\nSPY,0.9\n".into(),
            1,
        )
        .await
        .unwrap();
    let mut state_load = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .unwrap();
    let before_vendor = state_load.massive.request_count();
    state_load.flat_files = load_store.clone();
    let (st_l, body_l) = http_json(
        state_load.clone(),
        &format!("/api/_research/flat-files/SPY/extract?et_date={D}"),
        Some(OPERATOR_TOKEN),
    )
    .await;
    assert_eq!(st_l, StatusCode::OK);
    assert_eq!(state_load.massive.request_count(), before_vendor);
    let trades_csv = body_l["trades_extract"].as_str().unwrap_or("");
    assert!(trades_csv.contains("SPY"));
    assert!(!trades_csv.contains("\u{1f}")); // not gzip binary
    assert!(!body_l.to_string().contains("aggregates"));
    assert!(!body_l.to_string().contains("0 aggregates"));

    // ── 21. Score/tier/fingerprint byte-identical construct on vs off (AC-31) ──
    let (s0, t0, f0) = score_triple().await;
    let _on = FlatFilesStore::memory();
    let (s1, t1, f1) = score_triple().await;
    assert_eq!((s0, t0.clone(), f0.clone()), (s1, t1, f1));
    let _fail = FlatFilesStore::failing();
    let (s2, t2, f2) = score_triple().await;
    assert_eq!((s0, t0.clone(), f0.clone()), (s2, t2.clone(), f2.clone()));
    let _off = FlatFilesStore::not_storing();
    let (s3, t3, f3) = score_triple().await;
    assert_eq!((s0, t0, f0), (s3, t3, f3));

    // ── 22. Hub/SSE still emit during keep success and keep fault (AC-30) ──
    let hub = StockStreamHub::harness_local();
    let mut sse_rx = hub.subscribe_events();
    let keep_store = FlatFilesStore::memory();
    let keep_client = StubClient::both(StubResp::Gzip(plant_gzip(trio_csv())));
    let keep_fut = keep(&keep_client, &keep_store, "SPY");
    hub.publish_event(StreamEvent {
        symbol: "SPY".into(),
        kind: StreamKind::Quote,
        ts_ns: due_now().timestamp_nanos_opt().unwrap_or(0),
        price: None,
        size: None,
        bid: Some(1.0),
        ask: Some(1.1),
        bid_size: Some(1.0),
        ask_size: Some(1.0),
    });
    let got = timeout(Duration::from_millis(500), sse_rx.recv())
        .await
        .expect("sse timed out")
        .expect("sse closed");
    assert_eq!(got.symbol, "SPY");
    let _ = keep_fut.await;

    // Keep fault must not 5xx bundle / ensure (AC-28)
    for store_arm in [
        FlatFilesStore::failing(),
        FlatFilesStore::not_storing(),
        FlatFilesStore::refuse_to_mix(),
    ] {
        let state = harness_state(store_arm).await;
        let snap = refresh_analytics(&state, "SPY")
            .await
            .expect("desk refresh Ok when flat_files Failing/NotStoring/RefuseToMix");
        assert_eq!(snap.ticker, "SPY");
        let weekday = et_hm(2026, 8, 10, 14, 30);
        let outcome = ensure_one(
            &state.session_archive,
            &state.chain_snapshots,
            "SPY",
            D,
            true,
            true,
            |_| async { Ok(fixture_probe_bundle("SPY", weekday)) },
        )
        .await;
        assert!(
            matches!(
                outcome,
                EnsureOutcome::Present | EnsureOutcome::Promoted | EnsureOutcome::ForceArchived
            ),
            "ensure must succeed with flat_files degraded, got {outcome:?}"
        );
    }

    // Fault keep + SSE still flows
    let hub2 = StockStreamHub::harness_local();
    let mut rx2 = hub2.subscribe_events();
    let _ = keep(
        &StubClient::both(StubResp::Transport),
        &FlatFilesStore::memory(),
        "SPY",
    )
    .await;
    hub2.publish_event(StreamEvent {
        symbol: "QQQ".into(),
        kind: StreamKind::Trade,
        ts_ns: due_now().timestamp_nanos_opt().unwrap_or(0),
        price: Some(100.0),
        size: Some(1.0),
        bid: None,
        ask: None,
        bid_size: None,
        ask_size: None,
    });
    let got2 = timeout(Duration::from_millis(500), rx2.recv())
        .await
        .expect("sse2")
        .expect("closed");
    assert_eq!(got2.symbol, "QQQ");

    // ── 23. Canary secrets absent; evidence local; poison tokens (AC-49/50/25) ──
    let canary = "CANARY_FILES_SECRET_do_not_print";
    let tmp = temp_dir("canary");
    let (stdout_c, _, _) = evaluate_keep(
        &FlatFilesStore::memory(),
        &StubClient::both(StubResp::Transport),
        due_now(),
        "SPY",
        D,
        KeepCredentialGate::Ready,
        &tmp,
    )
    .await;
    let _ = std::fs::remove_dir_all(&tmp);
    assert!(!stdout_c.contains(canary));
    assert!(stdout_c.contains("Evidence:") && stdout_c.contains("local"));
    // Standing / Is-not blocks may *negate* live_massive / Path-A; occupancy lines must not
    // claim those as this corpus's class. Strip known allowed negation prose first.
    let mut occupancy_view = stdout_c.clone();
    for allowed in [
        "never live_massive",
        "not live_massive",
        "not Path-A / Path-B",
        "no Path-A conversion",
        "never coverage present",
        "never session day tape",
    ] {
        occupancy_view = occupancy_view.replace(allowed, "");
    }
    for banned in [
        "Unattempted",
        "Live tape",
        "live-paid-present",
        "0 aggregates",
        "complete_rth",
        "\"Stored\"",
    ] {
        assert!(
            !occupancy_view.contains(banned),
            "poison token `{banned}` must be absent from operator output"
        );
    }
    // Miss-beside-keep poison: QQQ trades must not be miss while SPY kept.
    assert_ne!(
        plant.load("QQQ", D, ExtractClass::Trades, due_now()).await,
        Occupancy::Miss
    );

    // ── 24. Keep process-exit has no unauthorized arm; HTTP 401 is metrics_unauthorized ──
    let (_, unauth) = http_json(
        AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
            .await
            .unwrap(),
        "/api/_research/flat-files/SPY",
        None,
    )
    .await;
    // Without token → 401 metrics_unauthorized (when token configured).
    let state_auth = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .unwrap();
    let router = routes::router(state_auth).unwrap();
    let req = Request::builder()
        .method("GET")
        .uri("/api/_research/flat-files/SPY")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = router.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    let body = to_bytes(resp.into_body(), 64 * 1024).await.unwrap();
    let v: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["error"], "metrics_unauthorized");
    assert_ne!(v["error"], "unauthorized");
    let _ = unauth;

    // Future weekday is not-elapsed, not no-stored-extract (AC-11)
    let (stdout_fut, _, code_fut) = evaluate_cli(
        &FlatFilesStore::memory(),
        due_now(),
        Some("SPY"),
        Some("2026-08-11"),
    )
    .await;
    assert_eq!(code_fut, ExitCode::SUCCESS);
    assert!(stdout_fut.contains("not elapsed") || stdout_fut.contains("not-elapsed"));
    assert!(!stdout_fut.contains("no stored extract"));
}
