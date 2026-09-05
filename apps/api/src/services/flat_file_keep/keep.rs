//! Per-class keep: skip-GET on content-hit, extract locked names, discard gzip.
//! Talks to a local `UniverseGet` trait (B6 adapts `MassiveFilesClient`).

use super::clocks::{is_due, today_et_date};
use super::extract::{extract_locked_from_path, ExtractError};
use super::occupancy::{is_content_hit, Occupancy};
use super::store::{ExtractClass, FlatFilesStore};
use super::watchlist::{in_flat_files_watchlist, normalize_symbol, FLAT_FILES_WATCHLIST};
use crate::domain::{is_et_weekend as domain_weekend, is_nyse_full_day_holiday};
use chrono::{DateTime, NaiveDate, Utc};
use futures_util::future::BoxFuture;
use rand::RngCore;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

/// Outcome of one universe GET attempt (client is HTTP-only; keep classifies).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GetOutcome {
    Status { code: u16 },
    Transport { sanitized: String },
}

/// Files client seam — no `async_trait`; B6 adapts infrastructure client here.
pub trait UniverseGet: Send + Sync {
    fn get_to_temp(
        &self,
        class: ExtractClass,
        et_date: &str,
        dest: &Path,
    ) -> BoxFuture<'_, GetOutcome>;

    fn send_count(&self, class: ExtractClass) -> u64;
}

/// Per-class keep verdict. Research-token HTTP 401 is not a keep class (S2 residual).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClassVerdict {
    SkipGet {
        sibling: Occupancy,
        named: Occupancy,
    },
    /// Successful GET store: `Kept` or `EmptyExtract`.
    Stored(Occupancy),
    Miss,
    DownloadFailed,
    Unreadable {
        reason: String,
    },
    /// Pre-GET refuse (NotElapsed / Ineligible / NotInWatchlist / NotStoring /
    /// RefuseToMix / MissingFilesCredentials / WrongCredentialClass).
    Gate(Occupancy),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeepReport {
    pub trades: ClassVerdict,
    pub quotes: ClassVerdict,
}

/// Mixed-class keep process exit (SPEC §5 / AC-54). No research-token gate arm.
pub fn keep_process_exit(report: &KeepReport) -> ExitCode {
    let bad = |v: &ClassVerdict| {
        matches!(
            v,
            ClassVerdict::Miss
                | ClassVerdict::DownloadFailed
                | ClassVerdict::Unreadable { .. }
                | ClassVerdict::Gate(Occupancy::NotStoring)
                | ClassVerdict::Gate(Occupancy::RefuseToMix)
                | ClassVerdict::Gate(Occupancy::MissingFilesCredentials)
                | ClassVerdict::Gate(Occupancy::WrongCredentialClass)
        )
    };
    if bad(&report.trades) || bad(&report.quotes) {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    }
}

/// Whole-command files-call is 0 only when both classes are SkipGet (or pre-GET refuse).
pub fn both_classes_skipped(report: &KeepReport) -> bool {
    matches!(report.trades, ClassVerdict::SkipGet { .. })
        && matches!(report.quotes, ClassVerdict::SkipGet { .. })
}

/// Optional credential refuse already classified by the caller (B3/B6). Keep does not
/// import `infrastructure::flatfiles`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeepCredentialGate {
    Ready,
    MissingFilesCredentials,
    WrongCredentialClass,
}

/// Operator keep for named ET date `D` and a locked (or foreign) symbol.
pub async fn run_keep<C: UniverseGet + ?Sized>(
    client: &C,
    store: &FlatFilesStore,
    et_date: &str,
    named_symbol: &str,
    now: DateTime<Utc>,
    credential: KeepCredentialGate,
    temp_dir: &Path,
) -> KeepReport {
    let named = normalize_symbol(named_symbol);

    // Pre-GET whole-command refuses (files-call 0, no miss). Keep does not sleep.
    if let Some(gate) = pre_get_refuse(store, &named, et_date, now, credential) {
        return KeepReport {
            trades: ClassVerdict::Gate(gate.clone()),
            quotes: ClassVerdict::Gate(gate),
        };
    }

    let trades = keep_one_class(
        client,
        store,
        ExtractClass::Trades,
        et_date,
        &named,
        now,
        temp_dir,
    )
    .await;
    let quotes = keep_one_class(
        client,
        store,
        ExtractClass::Quotes,
        et_date,
        &named,
        now,
        temp_dir,
    )
    .await;

    KeepReport { trades, quotes }
}

fn pre_get_refuse(
    store: &FlatFilesStore,
    named: &str,
    et_date: &str,
    now: DateTime<Utc>,
    credential: KeepCredentialGate,
) -> Option<Occupancy> {
    if !in_flat_files_watchlist(named) {
        return Some(Occupancy::NotInWatchlist);
    }
    match store {
        FlatFilesStore::NotStoring => return Some(Occupancy::NotStoring),
        FlatFilesStore::RefuseToMix => return Some(Occupancy::RefuseToMix),
        FlatFilesStore::Failing | FlatFilesStore::Memory(_) | FlatFilesStore::Json(_) => {}
    }
    match credential {
        KeepCredentialGate::MissingFilesCredentials => {
            return Some(Occupancy::MissingFilesCredentials);
        }
        KeepCredentialGate::WrongCredentialClass => {
            return Some(Occupancy::WrongCredentialClass);
        }
        KeepCredentialGate::Ready => {}
    }
    let naive = |d: &str| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok();
    if naive(et_date).is_some_and(domain_weekend) {
        return Some(Occupancy::IneligibleWeekend);
    }
    if naive(et_date).is_some_and(is_nyse_full_day_holiday) {
        return Some(Occupancy::IneligibleHoliday);
    }
    let today = today_et_date(now);
    if et_date > today.as_str() || !is_due(et_date, now) {
        return Some(Occupancy::NotElapsed);
    }
    None
}

async fn keep_one_class<C: UniverseGet + ?Sized>(
    client: &C,
    store: &FlatFilesStore,
    class: ExtractClass,
    et_date: &str,
    named: &str,
    now: DateTime<Utc>,
    temp_dir: &Path,
) -> ClassVerdict {
    // 1. Content-hit → skip GET this class.
    if store.any_content_hit(et_date, class).await {
        let sibling = content_hit_sibling(store, et_date, class, named, now).await;
        let named_occ = store.load(named, et_date, class, now).await;
        return ClassVerdict::SkipGet {
            sibling,
            named: named_occ,
        };
    }

    // 2. GET to temp.
    let dest = alloc_temp(temp_dir, et_date, class);
    let outcome = client.get_to_temp(class, et_date, &dest).await;

    let verdict = match outcome {
        GetOutcome::Transport { .. } => {
            discard_temp(&dest);
            ClassVerdict::DownloadFailed
        }
        GetOutcome::Status { code } if code == 404 => {
            discard_temp(&dest);
            if store.any_locked_extract(et_date, class).await {
                // Never persist miss beside a locked extract.
                ClassVerdict::DownloadFailed
            } else {
                let _ = store.put_miss(et_date, class).await;
                ClassVerdict::Miss
            }
        }
        GetOutcome::Status { code } if code == 401 || code == 403 || (500..600).contains(&code) => {
            discard_temp(&dest);
            ClassVerdict::DownloadFailed
        }
        GetOutcome::Status { code } if (200..300).contains(&code) => {
            let extracted = extract_locked_from_path(&dest);
            discard_temp(&dest);
            match extracted {
                Err(ExtractError::Unreadable { reason }) => {
                    for sym in FLAT_FILES_WATCHLIST {
                        let _ = store
                            .put_unreadable_pointer(sym, et_date, class, reason.clone())
                            .await;
                    }
                    ClassVerdict::Unreadable { reason }
                }
                Ok(locked) => {
                    // Store all three locked names from this GET (first-wins).
                    for sym in FLAT_FILES_WATCHLIST {
                        if let Some(sc) = locked.by_symbol.get(*sym) {
                            let _ = store
                                .put_extract(sym, et_date, class, sc.csv.clone(), sc.row_count)
                                .await;
                        }
                    }
                    let named_csv = locked.by_symbol.get(named);
                    let occ = match named_csv {
                        Some(sc) if sc.row_count == 0 => Occupancy::EmptyExtract,
                        Some(sc) => Occupancy::Kept {
                            row_count: sc.row_count,
                        },
                        None => Occupancy::EmptyExtract,
                    };
                    ClassVerdict::Stored(occ)
                }
            }
        }
        GetOutcome::Status { .. } => {
            // Non-404, non-2xx, non-auth, non-5xx (e.g. 400/409) → download-failed.
            discard_temp(&dest);
            ClassVerdict::DownloadFailed
        }
    };

    verdict
}

async fn content_hit_sibling(
    store: &FlatFilesStore,
    et_date: &str,
    class: ExtractClass,
    named: &str,
    now: DateTime<Utc>,
) -> Occupancy {
    let mut named_hit: Option<Occupancy> = None;
    for sym in FLAT_FILES_WATCHLIST {
        let o = store.load(sym, et_date, class, now).await;
        if is_content_hit(&o) {
            if *sym != named {
                return o;
            }
            named_hit = Some(o);
        }
    }
    named_hit.unwrap_or(Occupancy::NoStoredExtract)
}

fn alloc_temp(temp_dir: &Path, et_date: &str, class: ExtractClass) -> PathBuf {
    let mut nonce = [0u8; 4];
    rand::thread_rng().fill_bytes(&mut nonce);
    let name = format!(
        "keep-{}-{}-{}.csv.gz",
        et_date,
        class.as_file_token(),
        hex::encode(nonce)
    );
    let path = temp_dir.join(name);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    path
}

fn discard_temp(path: &Path) {
    let _ = std::fs::remove_file(path);
}

// ─── Test stubs ─────────────────────────────────────────────────────────────

#[cfg(test)]
pub mod test_stub {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Arc, Mutex};

    pub fn plant_gzip(csv: &str) -> Vec<u8> {
        let mut enc = GzEncoder::new(Vec::new(), Compression::default());
        enc.write_all(csv.as_bytes()).unwrap();
        enc.finish().unwrap()
    }

    #[derive(Clone)]
    pub enum StubResp {
        NotFound,
        Gzip(Vec<u8>),
        Status(u16),
        Transport,
        AssertNotCalled,
    }

    #[derive(Clone)]
    pub struct StubClient {
        trades: Arc<Mutex<StubResp>>,
        quotes: Arc<Mutex<StubResp>>,
        trades_sends: Arc<AtomicU64>,
        quotes_sends: Arc<AtomicU64>,
    }

    impl StubClient {
        pub fn new(trades: StubResp, quotes: StubResp) -> Self {
            Self {
                trades: Arc::new(Mutex::new(trades)),
                quotes: Arc::new(Mutex::new(quotes)),
                trades_sends: Arc::new(AtomicU64::new(0)),
                quotes_sends: Arc::new(AtomicU64::new(0)),
            }
        }

        pub fn both(resp: StubResp) -> Self {
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
}

#[cfg(test)]
mod tests {
    use super::test_stub::{plant_gzip, StubClient, StubResp};
    use super::*;
    // Used only by these tests; keeps the lib build free of unused imports.
    use super::super::clocks::is_et_weekend;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;
    use std::time::Instant;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    /// Monday D=2026-08-10 due as of Tuesday 12:00 ET.
    fn due_now() -> DateTime<Utc> {
        et_hm(2026, 8, 11, 12, 0)
    }

    const D: &str = "2026-08-10";

    fn trio_csv() -> &'static str {
        "ticker,price\nSPY,1.0\nQQQ,2.0\nIWM,3.0\n"
    }

    fn temp_dir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "ff_keep_b4_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    async fn run(client: &StubClient, store: &FlatFilesStore, named: &str) -> KeepReport {
        let tmp = temp_dir();
        let report = run_keep(
            client,
            store,
            D,
            named,
            due_now(),
            KeepCredentialGate::Ready,
            &tmp,
        )
        .await;
        let _ = std::fs::remove_dir_all(&tmp);
        report
    }

    #[tokio::test]
    async fn successful_get_stores_trio_for_that_class() {
        let gz = plant_gzip(trio_csv());
        let client = StubClient::new(StubResp::Gzip(gz.clone()), StubResp::Gzip(gz));
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "SPY").await;
        assert!(matches!(
            report.trades,
            ClassVerdict::Stored(Occupancy::Kept { .. })
        ));
        assert!(matches!(
            report.quotes,
            ClassVerdict::Stored(Occupancy::Kept { .. })
        ));
        for sym in ["SPY", "QQQ", "IWM"] {
            let t = store.load(sym, D, ExtractClass::Trades, due_now()).await;
            let q = store.load(sym, D, ExtractClass::Quotes, due_now()).await;
            assert!(is_content_hit(&t), "{sym} trades={t:?}");
            assert!(is_content_hit(&q), "{sym} quotes={q:?}");
        }
        assert_eq!(client.send_count(ExtractClass::Trades), 1);
        assert_eq!(client.send_count(ExtractClass::Quotes), 1);
    }

    #[tokio::test]
    async fn trades_kept_does_not_classify_quotes_kept() {
        let gz = plant_gzip(trio_csv());
        // Only trades GET succeeds; quotes 404 with zero locked extracts → miss.
        let client = StubClient::new(StubResp::Gzip(gz), StubResp::NotFound);
        let store = FlatFilesStore::memory();
        let _ = run(&client, &store, "SPY").await;
        let t = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        let q = store.load("SPY", D, ExtractClass::Quotes, due_now()).await;
        assert!(matches!(t, Occupancy::Kept { .. }));
        assert_eq!(q, Occupancy::Miss);
        assert!(!is_content_hit(&q));
    }

    #[tokio::test]
    async fn skip_get_when_spy_trades_kept_qqq_trades_no_stored_extract() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        // Quotes still need a GET; trades must not be called.
        let gz = plant_gzip(trio_csv());
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gz));
        let report = run(&client, &store, "QQQ").await;
        assert!(matches!(report.trades, ClassVerdict::SkipGet { .. }));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        let qqq_t = store.load("QQQ", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(qqq_t, Occupancy::NoStoredExtract);
        assert_ne!(qqq_t, Occupancy::Miss);
        let spy_t = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert!(matches!(spy_t, Occupancy::Kept { .. }));
        // Quotes still GET.
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
    }

    #[tokio::test]
    async fn skip_get_does_not_print_download_failed_or_miss_for_that_class() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let gz = plant_gzip(trio_csv());
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gz));
        let report = run(&client, &store, "QQQ").await;
        assert!(
            !matches!(
                report.trades,
                ClassVerdict::DownloadFailed | ClassVerdict::Miss
            ),
            "trades={:?}",
            report.trades
        );
        assert!(matches!(report.trades, ClassVerdict::SkipGet { .. }));
        // No miss sidecar for trades.
        let qqq = store.load("QQQ", D, ExtractClass::Trades, due_now()).await;
        assert_ne!(qqq, Occupancy::Miss);
        assert_eq!(qqq, Occupancy::NoStoredExtract);
    }

    #[tokio::test]
    async fn quotes_still_get_when_only_trades_content_hit() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let gz = plant_gzip(trio_csv());
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gz));
        let report = run(&client, &store, "QQQ").await;
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
        // Mixed-class: do NOT require whole-command files-call 0.
        assert!(!both_classes_skipped(&report));
        assert!(matches!(
            report.quotes,
            ClassVerdict::Stored(Occupancy::Kept { .. })
        ));
    }

    #[tokio::test]
    async fn both_classes_content_hit_whole_command_files_call_0() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        store
            .put_extract("SPY", D, ExtractClass::Quotes, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let report = run(&client, &store, "QQQ").await;
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(client.send_count(ExtractClass::Quotes), 0);
        assert!(both_classes_skipped(&report));
        assert_eq!(keep_process_exit(&report), ExitCode::SUCCESS);
        let qqq_t = store.load("QQQ", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(qqq_t, Occupancy::NoStoredExtract);
    }

    #[tokio::test]
    async fn get_404_zero_locked_extracts_persists_miss_process_nonzero() {
        let client = StubClient::both(StubResp::NotFound);
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "SPY").await;
        assert_eq!(report.trades, ClassVerdict::Miss);
        assert_eq!(report.quotes, ClassVerdict::Miss);
        assert_ne!(keep_process_exit(&report), ExitCode::SUCCESS);
        let o = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(o, Occupancy::Miss);
    }

    #[tokio::test]
    async fn get_404_with_sibling_extract_is_download_failed_no_miss_sidecar() {
        let store = FlatFilesStore::memory();
        // Locked extract (unreadable counts) for trades; force a GET by having no content-hit.
        // Content-hit = Kept|EmptyExtract only — unreadable is locked but NOT content-hit,
        // so GET still runs; 404 → DownloadFailed, no miss.
        store
            .put_unreadable_pointer("SPY", D, ExtractClass::Trades, "corrupt".into())
            .await
            .unwrap();
        let client = StubClient::new(StubResp::NotFound, StubResp::NotFound);
        let report = run(&client, &store, "QQQ").await;
        assert_eq!(report.trades, ClassVerdict::DownloadFailed);
        assert!(client.send_count(ExtractClass::Trades) >= 1);
        let qqq = store.load("QQQ", D, ExtractClass::Trades, due_now()).await;
        assert_ne!(qqq, Occupancy::Miss);
        // Miss put refused — QQQ stays no stored extract (unreadable sibling blocks miss).
        assert_eq!(qqq, Occupancy::NoStoredExtract);
    }

    #[tokio::test]
    async fn transport_401_403_is_download_failed_not_miss() {
        for code in [401u16, 403, 500, 503] {
            let client = StubClient::both(StubResp::Status(code));
            let store = FlatFilesStore::memory();
            let report = run(&client, &store, "SPY").await;
            assert_eq!(report.trades, ClassVerdict::DownloadFailed, "code={code}");
            assert_eq!(report.quotes, ClassVerdict::DownloadFailed);
            let o = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
            assert_ne!(o, Occupancy::Miss, "code={code}");
            assert_eq!(o, Occupancy::NoStoredExtract);
        }
        let client = StubClient::both(StubResp::Transport);
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "SPY").await;
        assert_eq!(report.trades, ClassVerdict::DownloadFailed);
        assert_ne!(
            store.load("SPY", D, ExtractClass::Trades, due_now()).await,
            Occupancy::Miss
        );
    }

    #[tokio::test]
    async fn first_wins_kept_not_overwritten_by_empty_or_unreadable() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                D,
                ExtractClass::Trades,
                "ticker,price\nSPY,99.0\n".into(),
                1,
            )
            .await
            .unwrap();
        // Content-hit → skip GET entirely (first-wins by not re-fetching).
        let empty_gz = plant_gzip("ticker,price\nQQQ,1.0\nIWM,2.0\n"); // SPY zero rows
        let client = StubClient::new(
            StubResp::AssertNotCalled,
            StubResp::Gzip(plant_gzip(trio_csv())),
        );
        let _ = run(&client, &store, "SPY").await;
        let spy = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(spy, Occupancy::Kept { row_count: 1 });
        // Also: if somehow GET ran with empty SPY, put_extract first-wins — plant without content-hit.
        let store2 = FlatFilesStore::memory();
        store2
            .put_extract(
                "SPY",
                D,
                ExtractClass::Trades,
                "ticker,price\nSPY,99.0\n".into(),
                1,
            )
            .await
            .unwrap();
        // Remove content-hit skip by… can't; content-hit skips. Direct put_extract first-wins:
        store2
            .put_extract("SPY", D, ExtractClass::Trades, "ticker,price\n".into(), 0)
            .await
            .unwrap();
        store2
            .put_unreadable_pointer("SPY", D, ExtractClass::Trades, "nope".into())
            .await
            .unwrap();
        let spy2 = store2.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(spy2, Occupancy::Kept { row_count: 1 });
        let _ = empty_gz;
    }

    #[tokio::test]
    async fn partial_trio_spy_promoted_skips_later_get_qqq_no_stored_extract() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let client = StubClient::new(
            StubResp::AssertNotCalled,
            StubResp::Gzip(plant_gzip(trio_csv())),
        );
        let report = run(&client, &store, "QQQ").await;
        assert!(matches!(report.trades, ClassVerdict::SkipGet { .. }));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(
            store.load("QQQ", D, ExtractClass::Trades, due_now()).await,
            Occupancy::NoStoredExtract
        );
        assert_eq!(
            store.load("IWM", D, ExtractClass::Trades, due_now()).await,
            Occupancy::NoStoredExtract
        );
        assert!(matches!(
            store.load("SPY", D, ExtractClass::Trades, due_now()).await,
            Occupancy::Kept { .. }
        ));
    }

    #[tokio::test]
    async fn keep_does_not_sleep_on_not_elapsed() {
        let client = StubClient::both(StubResp::AssertNotCalled);
        let store = FlatFilesStore::memory();
        let tmp = temp_dir();
        let start = Instant::now();
        // Clock before Tuesday 11:00 ET → not elapsed. Keep must not sleep.
        let report = run_keep(
            &client,
            &store,
            D,
            "SPY",
            et_hm(2026, 8, 11, 10, 59),
            KeepCredentialGate::Ready,
            &tmp,
        )
        .await;
        let elapsed = start.elapsed();
        let _ = std::fs::remove_dir_all(&tmp);
        assert!(
            elapsed.as_millis() < 500,
            "keep slept or blocked: {elapsed:?}"
        );
        assert!(matches!(
            report.trades,
            ClassVerdict::Gate(Occupancy::NotElapsed)
        ));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(client.send_count(ExtractClass::Quotes), 0);
    }

    #[tokio::test]
    async fn nvda_named_keep_files_call_0() {
        let client = StubClient::both(StubResp::AssertNotCalled);
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "NVDA").await;
        assert!(matches!(
            report.trades,
            ClassVerdict::Gate(Occupancy::NotInWatchlist)
        ));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(client.send_count(ExtractClass::Quotes), 0);
        assert_eq!(keep_process_exit(&report), ExitCode::SUCCESS);
    }

    #[tokio::test]
    async fn holiday_weekday_zero_rows_is_empty_extract_not_weekend() {
        // Weekday with zero data rows for locked names → empty extract (content-hit), not weekend.
        let gz = plant_gzip("ticker,price\n");
        let client = StubClient::both(StubResp::Gzip(gz));
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "SPY").await;
        assert_eq!(report.trades, ClassVerdict::Stored(Occupancy::EmptyExtract));
        assert_eq!(report.quotes, ClassVerdict::Stored(Occupancy::EmptyExtract));
        assert!(!is_et_weekend(D));
        let o = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert_eq!(o, Occupancy::EmptyExtract);
        assert_ne!(o, Occupancy::IneligibleWeekend);
        assert_ne!(o, Occupancy::Miss);
        assert!(is_content_hit(&o));
        assert_eq!(keep_process_exit(&report), ExitCode::SUCCESS);
    }

    #[tokio::test]
    async fn thanksgiving_2026_11_26_is_ineligible_holiday_files_call_0() {
        use super::super::occupancy::occupancy_token;

        let client = StubClient::both(StubResp::AssertNotCalled);
        let store = FlatFilesStore::memory();
        let tmp = temp_dir();
        let now = et_hm(2026, 11, 27, 12, 0); // due clock would have elapsed if it were a session day
        let report = run_keep(
            &client,
            &store,
            "2026-11-26",
            "SPY",
            now,
            KeepCredentialGate::Ready,
            &tmp,
        )
        .await;
        assert_eq!(
            report.trades,
            ClassVerdict::Gate(Occupancy::IneligibleHoliday)
        );
        assert_eq!(
            report.quotes,
            ClassVerdict::Gate(Occupancy::IneligibleHoliday)
        );
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(client.send_count(ExtractClass::Quotes), 0);
        assert_ne!(report.trades, ClassVerdict::Stored(Occupancy::EmptyExtract));
        assert_ne!(
            occupancy_token(&Occupancy::IneligibleHoliday),
            "ineligible weekend"
        );
        assert_eq!(
            occupancy_token(&Occupancy::IneligibleHoliday),
            "ineligible holiday"
        );
    }

    #[tokio::test]
    async fn mixed_exit_trades_skip_quotes_miss_is_nonzero() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::NotFound);
        let report = run(&client, &store, "QQQ").await;
        assert!(matches!(report.trades, ClassVerdict::SkipGet { .. }));
        assert_eq!(report.quotes, ClassVerdict::Miss);
        assert_ne!(keep_process_exit(&report), ExitCode::SUCCESS);
        // Do not require whole-command files-call 0.
        assert!(!both_classes_skipped(&report));
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
    }

    #[tokio::test]
    async fn mixed_exit_trades_skip_quotes_kept_is_zero() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let gz = plant_gzip(trio_csv());
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gz));
        let report = run(&client, &store, "QQQ").await;
        assert!(matches!(report.trades, ClassVerdict::SkipGet { .. }));
        assert!(matches!(
            report.quotes,
            ClassVerdict::Stored(Occupancy::Kept { .. })
        ));
        assert_eq!(keep_process_exit(&report), ExitCode::SUCCESS);
        // Quotes GET ran — not whole-command zero I/O.
        assert!(!both_classes_skipped(&report));
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
    }

    #[tokio::test]
    async fn keep_exit_has_no_unauthorized_arm() {
        // Source + type-level: ClassVerdict / keep_process_exit have no research-token arm.
        let src = include_str!("keep.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let banned = format!("{}authorized", "Un");
        assert!(
            !prod.contains(&banned),
            "keep production source must not name {banned}"
        );
        assert!(!prod.contains(&format!("Occupancy::{}", banned)));
        // Gate arms that are non-zero do not include a ghost research-token occupancy.
        let report = KeepReport {
            trades: ClassVerdict::Gate(Occupancy::MissingFilesCredentials),
            quotes: ClassVerdict::SkipGet {
                sibling: Occupancy::Kept { row_count: 1 },
                named: Occupancy::NoStoredExtract,
            },
        };
        assert_ne!(keep_process_exit(&report), ExitCode::SUCCESS);
        let ok = KeepReport {
            trades: ClassVerdict::SkipGet {
                sibling: Occupancy::EmptyExtract,
                named: Occupancy::NoStoredExtract,
            },
            quotes: ClassVerdict::Stored(Occupancy::EmptyExtract),
        };
        assert_eq!(keep_process_exit(&ok), ExitCode::SUCCESS);
        // NotElapsed / NotInWatchlist / IneligibleWeekend / IneligibleHoliday are exit 0.
        for gate in [
            Occupancy::NotElapsed,
            Occupancy::NotInWatchlist,
            Occupancy::IneligibleWeekend,
            Occupancy::IneligibleHoliday,
        ] {
            let r = KeepReport {
                trades: ClassVerdict::Gate(gate.clone()),
                quotes: ClassVerdict::Gate(gate),
            };
            assert_eq!(keep_process_exit(&r), ExitCode::SUCCESS);
        }
    }

    #[tokio::test]
    async fn csv_header_fault_is_unreadable_promoted_pointer() {
        let bad = plant_gzip("price,volume\n1,2\n");
        let client = StubClient::new(StubResp::Gzip(bad), StubResp::NotFound);
        let store = FlatFilesStore::memory();
        let report = run(&client, &store, "SPY").await;
        assert!(matches!(report.trades, ClassVerdict::Unreadable { .. }));
        let o = store.load("SPY", D, ExtractClass::Trades, due_now()).await;
        assert!(matches!(o, Occupancy::Unreadable { .. }));
        assert_ne!(keep_process_exit(&report), ExitCode::SUCCESS);
    }

    #[tokio::test]
    async fn naming_one_symbol_fills_siblings_when_get_runs() {
        let gz = plant_gzip(trio_csv());
        let client = StubClient::both(StubResp::Gzip(gz));
        let store = FlatFilesStore::memory();
        let _ = run(&client, &store, "QQQ").await;
        // GET named QQQ still fills SPY and IWM.
        assert!(is_content_hit(
            &store.load("SPY", D, ExtractClass::Trades, due_now()).await
        ));
        assert!(is_content_hit(
            &store.load("IWM", D, ExtractClass::Trades, due_now()).await
        ));
        assert!(is_content_hit(
            &store.load("QQQ", D, ExtractClass::Trades, due_now()).await
        ));
    }

    #[tokio::test]
    async fn skip_get_does_not_invent_qqq() {
        let store = FlatFilesStore::memory();
        store
            .put_extract("SPY", D, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        store
            .put_extract("SPY", D, ExtractClass::Quotes, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let _ = run(&client, &store, "QQQ").await;
        assert_eq!(
            store.load("QQQ", D, ExtractClass::Trades, due_now()).await,
            Occupancy::NoStoredExtract
        );
        assert_eq!(
            store.load("QQQ", D, ExtractClass::Quotes, due_now()).await,
            Occupancy::NoStoredExtract
        );
    }
}
