//! Optional clap `flat-files` research CLI (Evidence: local).
//! Keep is the only files.massive.com GET. Off the trader request path.

use super::clocks::{parse_et_date, today_et_date};
use super::keep::{
    both_classes_skipped, keep_process_exit, run_keep, ClassVerdict, GetOutcome,
    KeepCredentialGate, KeepReport, UniverseGet,
};
use super::literals::{
    self, AUTHORIZES, COMMAND, EVIDENCE_CLI, HIT_PROVENANCE, KEPT, LICENSE, MISS_PROVENANCE,
    STANDING_PROVENANCE,
};
use super::occupancy::{
    is_content_hit, occupancy_token, operator_print, EnvelopeDecision, Occupancy,
};
use super::store::{ExtractClass, ExtractRecord, FlatFilesStore};
use super::watchlist::{in_flat_files_watchlist, normalize_symbol, FLAT_FILES_WATCHLIST};
use crate::config::{keep_root_conflicts, Config};
use crate::infrastructure::flatfiles::credentials::rest_key_from_env;
use crate::infrastructure::flatfiles::{
    classify_files_credentials, CredentialClass, FilesClass, FilesHttpOutcome, MassiveFilesClient,
};
use chrono::{DateTime, Utc};
use futures_util::future::BoxFuture;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const RUNNING: &str = "[RUNNING] flat-files — no verdict yet\n";
const NOT_A_MISS: &str = "Not a miss.";
const CLI_CLOSING: &str = "MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage";

fn standing_block() -> String {
    format!(
        "MASSIVE FLAT FILES — RESEARCH CORPUS · NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK\n\
           Command:     {COMMAND}\n\
           Evidence:    {EVIDENCE_CLI}\n\
           Watchlist:   SPY, QQQ, IWM\n\
           Identity:    (symbol, et_date) America/New_York · vendor file is universe-per-day\n\
           Payload:     stocks SIP trades · quotes · compressed CSV · not OPRA · not hist-chain\n\
           Extract:     watchlist rows only · not a full-universe redistribution · not a full open-to-close claim\n\
           Provenance:  {STANDING_PROVENANCE}\n\
           Publish:     ~11:00 ET the next America/New_York day · before that a day is not-elapsed, not a miss\n\
           Vendor I/O:  inspect = 0 REST/WS and 0 S3 · keep = files.massive.com (S3), not api.massive.com\n\
           Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,\n\
                        no ticker playback, no session-archive fill, no Path-A conversion this gate.\n"
    )
}

fn is_is_not_block() -> &'static str {
    "Is: a research corpus of entitled stocks SIP trades and quotes downloaded from files.massive.com as next-day compressed CSVs and extracted to locked watchlist SPY / QQQ / IWM.\n\
Is not: a live paid session book; not coverage present; not live_massive; not the session day tape; not Path-A / Path-B; not ticker playback; not OPRA; not S3 hist-chain we newly bought; not a scoring input; not a full-universe redistribution; not a full open-to-close session claim from a filtered extract.\n"
}

fn wrap_ok(body: &str, verdict: &str) -> (String, String, ExitCode) {
    wrap_with_code(body, verdict, ExitCode::SUCCESS)
}

fn wrap_err(verdict: &str) -> (String, String, ExitCode) {
    let mut out = standing_block();
    out.push_str(verdict);
    if !verdict.is_empty() && !verdict.ends_with('\n') {
        out.push('\n');
    }
    (out, RUNNING.to_string(), ExitCode::from(1))
}

fn wrap_with_code(body: &str, verdict: &str, code: ExitCode) -> (String, String, ExitCode) {
    let mut out = standing_block();
    out.push_str(body);
    if !body.is_empty() && !body.ends_with('\n') {
        out.push('\n');
    }
    out.push_str(LICENSE);
    out.push('\n');
    out.push_str(CLI_CLOSING);
    out.push('\n');
    out.push_str(verdict);
    if !verdict.is_empty() && !verdict.ends_with('\n') {
        out.push('\n');
    }
    (out, RUNNING.to_string(), code)
}

/// Open flat-files store for CLI. Unset/unwritable → NotStoring. Collision → RefuseToMix.
pub fn open_flat_files_for_cli(cfg: &Config) -> FlatFilesStore {
    let Some(root) = cfg.massive_flat_files_body_root.as_ref() else {
        return FlatFilesStore::NotStoring;
    };
    if root.as_os_str().is_empty() {
        return FlatFilesStore::NotStoring;
    }
    if keep_root_conflicts(
        root,
        &cfg.chain_snapshot_store_path,
        &cfg.session_chain_archive_store_path,
        cfg.session_chain_archive_body_root.as_deref(),
        cfg.session_day_tape_body_root.as_deref(),
    ) {
        return FlatFilesStore::RefuseToMix;
    }
    if !super::root_is_writable(root) {
        return FlatFilesStore::NotStoring;
    }
    match FlatFilesStore::open_json(root) {
        Ok(store) => store,
        Err(_) => FlatFilesStore::NotStoring,
    }
}

/// Adapter: infrastructure files client → keep `UniverseGet` (no `async_trait`).
struct ClientAdapter<'a>(&'a MassiveFilesClient);

impl UniverseGet for ClientAdapter<'_> {
    fn get_to_temp(
        &self,
        class: ExtractClass,
        et_date: &str,
        dest: &Path,
    ) -> BoxFuture<'_, GetOutcome> {
        let files_class = match class {
            ExtractClass::Trades => FilesClass::Trades,
            ExtractClass::Quotes => FilesClass::Quotes,
        };
        let dest = dest.to_path_buf();
        let et_date = et_date.to_string();
        Box::pin(async move {
            match self.0.get_object(files_class, &et_date, &dest).await {
                FilesHttpOutcome::Status { code, .. } => GetOutcome::Status { code },
                FilesHttpOutcome::Transport { sanitized } => GetOutcome::Transport { sanitized },
            }
        })
    }

    fn send_count(&self, class: ExtractClass) -> u64 {
        match class {
            ExtractClass::Trades => self.0.trades_gets(),
            ExtractClass::Quotes => self.0.quotes_gets(),
        }
    }
}

/// Pre-GET refuse path — never sends.
struct NeverGet;

impl UniverseGet for NeverGet {
    fn get_to_temp(
        &self,
        _class: ExtractClass,
        _et_date: &str,
        _dest: &Path,
    ) -> BoxFuture<'_, GetOutcome> {
        Box::pin(async {
            GetOutcome::Transport {
                sanitized: "files.massive.com/…".into(),
            }
        })
    }

    fn send_count(&self, _class: ExtractClass) -> u64 {
        0
    }
}

fn map_credential(c: CredentialClass) -> (KeepCredentialGate, Option<MassiveFilesClient>) {
    match c {
        CredentialClass::MissingFilesCredentials => {
            (KeepCredentialGate::MissingFilesCredentials, None)
        }
        CredentialClass::WrongCredentialClass => (KeepCredentialGate::WrongCredentialClass, None),
        CredentialClass::Ready(creds) => match MassiveFilesClient::new(creds) {
            Ok(client) => (KeepCredentialGate::Ready, Some(client)),
            Err(_) => (KeepCredentialGate::MissingFilesCredentials, None),
        },
    }
}

fn store_level_gate(store: &FlatFilesStore) -> Option<Occupancy> {
    match store {
        FlatFilesStore::NotStoring => Some(Occupancy::NotStoring),
        FlatFilesStore::RefuseToMix => Some(Occupancy::RefuseToMix),
        _ => None,
    }
}

fn ok_not_miss(detail: &str) -> String {
    format!("[OK] flat-files — {detail}. {NOT_A_MISS}\n")
}

fn error_line(detail: &str) -> String {
    format!("[ERROR] flat-files — {detail}\n")
}

fn inspect_exit_code(trades: &Occupancy, quotes: &Occupancy) -> ExitCode {
    if matches!(trades, Occupancy::NotStoring)
        || matches!(quotes, Occupancy::NotStoring)
        || matches!(trades, Occupancy::RefuseToMix)
        || matches!(quotes, Occupancy::RefuseToMix)
    {
        return ExitCode::from(1);
    }
    if matches!(trades, Occupancy::Unreadable { .. })
        || matches!(quotes, Occupancy::Unreadable { .. })
    {
        return ExitCode::from(1);
    }
    if matches!(
        trades,
        Occupancy::NotInWatchlist
            | Occupancy::IneligibleWeekend
            | Occupancy::IneligibleHoliday
            | Occupancy::NotElapsed
    ) || matches!(
        quotes,
        Occupancy::NotInWatchlist
            | Occupancy::IneligibleWeekend
            | Occupancy::IneligibleHoliday
            | Occupancy::NotElapsed
    ) {
        return ExitCode::SUCCESS;
    }
    if is_content_hit(trades) || is_content_hit(quotes) {
        return ExitCode::SUCCESS;
    }
    if matches!(trades, Occupancy::NoStoredExtract) && matches!(quotes, Occupancy::NoStoredExtract)
    {
        return ExitCode::SUCCESS;
    }
    // Miss-only (both miss, or miss + no stored extract, no content hit).
    ExitCode::from(1)
}

fn class_line(class: ExtractClass, o: &Occupancy, symbol: &str, et_date: &str) -> String {
    format!(
        "  {class}: {line}\n",
        class = class.as_file_token(),
        line = operator_print(o, symbol, et_date)
    )
}

fn provenance_for(env: &EnvelopeDecision) -> &'static str {
    if is_content_hit(&env.trades) || is_content_hit(&env.quotes) {
        HIT_PROVENANCE
    } else {
        MISS_PROVENANCE
    }
}

/// Dated inspect of one `(symbol, et_date)`.
pub async fn evaluate_load(
    store: &FlatFilesStore,
    now: DateTime<Utc>,
    symbol_raw: &str,
    et_date_raw: &str,
) -> (String, String, ExitCode) {
    let symbol = normalize_symbol(symbol_raw);
    let Some(et_date) = parse_et_date(et_date_raw) else {
        return wrap_err(&error_line("et_date unparseable. No load recorded."));
    };

    // Axis A: not-in-watchlist before not-storing.
    if !in_flat_files_watchlist(&symbol) {
        let detail = literals::not_in_watchlist(&symbol);
        return wrap_ok("", &ok_not_miss(&detail));
    }

    if let Some(gate) = store_level_gate(store) {
        let detail = operator_print(&gate, &symbol, &et_date);
        return match gate {
            Occupancy::RefuseToMix => wrap_err(&format!(
                "[ERROR] flat-files — {detail}. No keep recorded.\n"
            )),
            Occupancy::NotStoring => wrap_err(&error_line(&format!("{detail}."))),
            _ => wrap_err(&error_line(&format!("{detail}."))),
        };
    }

    let env = store.load_both(&symbol, &et_date, now).await;
    let code = inspect_exit_code(&env.trades, &env.quotes);

    let mut body = String::new();
    body.push_str(is_is_not_block());
    body.push_str(&format!("  Framing:    {}\n", env.framing));
    if let Some(detail) = &env.detail {
        body.push_str(&format!("  Detail:     {detail}\n"));
    }
    body.push_str(&format!("  Provenance: {}\n", provenance_for(&env)));
    body.push_str(&format!("  Authorizes: {AUTHORIZES}\n"));
    body.push_str(&class_line(
        ExtractClass::Trades,
        &env.trades,
        &symbol,
        &et_date,
    ));
    body.push_str(&class_line(
        ExtractClass::Quotes,
        &env.quotes,
        &symbol,
        &et_date,
    ));

    let verdict = if code == ExitCode::SUCCESS {
        match (&env.trades, &env.quotes) {
            (Occupancy::NoStoredExtract, Occupancy::NoStoredExtract) => {
                format!(
                    "[OK] flat-files — {}. {NOT_A_MISS}\n",
                    literals::no_stored_extract(&et_date)
                )
            }
            (Occupancy::NotElapsed, _) | (_, Occupancy::NotElapsed) => {
                ok_not_miss(&literals::not_elapsed(&et_date))
            }
            (Occupancy::IneligibleWeekend, _) | (_, Occupancy::IneligibleWeekend) => {
                ok_not_miss(&literals::ineligible_weekend(&et_date))
            }
            (Occupancy::IneligibleHoliday, _) | (_, Occupancy::IneligibleHoliday) => {
                ok_not_miss(&literals::ineligible_holiday(&et_date))
            }
            _ if is_content_hit(&env.trades) || is_content_hit(&env.quotes) => {
                format!("[OK] flat-files — {HIT_PROVENANCE} · {NOT_A_MISS}\n")
            }
            _ => ok_not_miss("inspect complete"),
        }
    } else if matches!(env.trades, Occupancy::Unreadable { .. })
        || matches!(env.quotes, Occupancy::Unreadable { .. })
    {
        let reason = match (&env.trades, &env.quotes) {
            (Occupancy::Unreadable { reason }, _) | (_, Occupancy::Unreadable { reason }) => {
                reason.as_str()
            }
            _ => "",
        };
        format!(
            "[ERROR] flat-files — {}. No load recorded.\n",
            literals::unreadable(reason)
        )
    } else {
        // Miss-only family.
        format!(
            "[ERROR] flat-files — {}. No load recorded.\n",
            literals::miss(&et_date)
        )
    };

    wrap_with_code(&body, &verdict, code)
}

/// Undated list. Occupancy column required; bare `0` without occupancy forbidden.
pub async fn evaluate_list(
    store: &FlatFilesStore,
    now: DateTime<Utc>,
    symbol_raw: Option<&str>,
) -> (String, String, ExitCode) {
    let _ = now;
    if let Some(raw) = symbol_raw {
        let symbol = normalize_symbol(raw);
        if !in_flat_files_watchlist(&symbol) {
            let detail = literals::not_in_watchlist(&symbol);
            return wrap_ok("", &ok_not_miss(&detail));
        }
    }

    if let Some(gate) = store_level_gate(store) {
        let detail = operator_print(&gate, "SPY", "");
        return match gate {
            Occupancy::RefuseToMix => wrap_err(&format!(
                "[ERROR] flat-files — {detail}. No keep recorded.\n"
            )),
            _ => wrap_err(&error_line(&format!("{detail}."))),
        };
    }

    let symbols: Vec<String> = match symbol_raw {
        Some(raw) => vec![normalize_symbol(raw)],
        None => FLAT_FILES_WATCHLIST
            .iter()
            .map(|s| (*s).to_string())
            .collect(),
    };

    let mut rows: Vec<ExtractRecord> = Vec::new();
    for sym in &symbols {
        rows.extend(store.list(sym, now).await);
    }
    // Watchlist order SPY, QQQ, IWM; within a date, trades before quotes.
    rows.sort_by(|a, b| {
        let ai = FLAT_FILES_WATCHLIST
            .iter()
            .position(|s| *s == a.symbol.as_str())
            .unwrap_or(99);
        let bi = FLAT_FILES_WATCHLIST
            .iter()
            .position(|s| *s == b.symbol.as_str())
            .unwrap_or(99);
        (a.et_date.as_str(), ai, a.class.as_file_token()).cmp(&(
            b.et_date.as_str(),
            bi,
            b.class.as_file_token(),
        ))
    });

    let mut body = String::from("  ET date      Symbol  class    occupancy       rows\n");
    for r in &rows {
        body.push_str(&format!(
            "  {:<12} {:<6} {:<8} {:<15} {}\n",
            r.et_date,
            r.symbol,
            r.class.as_file_token(),
            occupancy_token(&r.occupancy),
            r.row_count
        ));
    }

    let mut meta = String::new();
    meta.push_str(&format!("  Framing:    {}\n", literals::FRAMING_HIT));
    meta.push_str("  Detail:     null\n");
    meta.push_str(&format!("  Provenance: {MISS_PROVENANCE}\n"));
    meta.push_str(&format!("  Authorizes: {AUTHORIZES}\n"));
    meta.push_str(&body);

    let verdict = format!(
        "[OK] flat-files — loaded from Massive flat files · 0 files GET · not a live paid session book · local audit is not production coverage\n"
    );
    wrap_ok(&meta, &verdict)
}

/// Top-level inspect/list evaluate.
pub async fn evaluate_cli(
    store: &FlatFilesStore,
    now: DateTime<Utc>,
    symbol: Option<&str>,
    et_date: Option<&str>,
) -> (String, String, ExitCode) {
    match (symbol, et_date) {
        (Some(sym), Some(d)) => evaluate_load(store, now, sym, d).await,
        (sym, None) => evaluate_list(store, now, sym).await,
        (None, Some(d)) => {
            let mut combined = standing_block();
            let mut any_err = false;
            let mut last_code = ExitCode::SUCCESS;
            for sym in FLAT_FILES_WATCHLIST {
                let (stdout, _stderr, code) = evaluate_load(store, now, sym, d).await;
                let rest = stdout
                    .strip_prefix(&standing_block())
                    .unwrap_or(stdout.as_str());
                combined.push_str(&format!("--- {sym} ---\n"));
                combined.push_str(rest);
                if code != ExitCode::SUCCESS {
                    any_err = true;
                    last_code = code;
                }
            }
            let code = if any_err {
                last_code
            } else {
                ExitCode::SUCCESS
            };
            (combined, RUNNING.to_string(), code)
        }
    }
}

fn content_hit_phrase(o: &Occupancy) -> &'static str {
    match o {
        Occupancy::EmptyExtract => "empty extract",
        _ => KEPT,
    }
}

async fn sibling_symbol_and_occ(
    store: &FlatFilesStore,
    et_date: &str,
    class: ExtractClass,
    named: &str,
    now: DateTime<Utc>,
) -> (String, Occupancy) {
    let mut named_hit: Option<(String, Occupancy)> = None;
    for sym in FLAT_FILES_WATCHLIST {
        let o = store.load(sym, et_date, class, now).await;
        if is_content_hit(&o) {
            if *sym != named {
                return ((*sym).to_string(), o);
            }
            named_hit = Some(((*sym).to_string(), o));
        }
    }
    named_hit.unwrap_or_else(|| (named.to_string(), Occupancy::NoStoredExtract))
}

fn render_skip_class_line(
    class: ExtractClass,
    sibling_sym: &str,
    sibling: &Occupancy,
    named: &str,
    named_occ: &Occupancy,
) -> String {
    let sib_phrase = content_hit_phrase(sibling);
    let named_phrase = match named_occ {
        Occupancy::NoStoredExtract => format!("{named} no stored extract"),
        Occupancy::Kept { .. } => format!("{named} {KEPT}"),
        Occupancy::EmptyExtract => format!("{named} empty extract"),
        other => format!("{named} {}", occupancy_token(other)),
    };
    format!(
        "  {}: {sibling_sym} {sib_phrase} · {named_phrase} · this class files GET: 0 · {NOT_A_MISS}\n",
        class.as_file_token()
    )
}

fn render_class_verdict(
    class: ExtractClass,
    v: &ClassVerdict,
    symbol: &str,
    et_date: &str,
    sibling_sym: &str,
) -> String {
    match v {
        ClassVerdict::SkipGet { sibling, named } => {
            render_skip_class_line(class, sibling_sym, sibling, symbol, named)
        }
        ClassVerdict::Stored(Occupancy::Kept { .. }) => {
            format!("  {}: {KEPT}\n", class.as_file_token())
        }
        ClassVerdict::Stored(Occupancy::EmptyExtract) => {
            format!(
                "  {}: {}\n",
                class.as_file_token(),
                literals::empty_extract(symbol, et_date)
            )
        }
        ClassVerdict::Stored(other) => {
            format!(
                "  {}: {}\n",
                class.as_file_token(),
                operator_print(other, symbol, et_date)
            )
        }
        ClassVerdict::Miss => {
            format!("  {}: {}\n", class.as_file_token(), literals::miss(et_date))
        }
        ClassVerdict::DownloadFailed => {
            format!(
                "  {}: {}\n",
                class.as_file_token(),
                literals::download_failed(et_date)
            )
        }
        ClassVerdict::Unreadable { reason } => {
            format!(
                "  {}: {}\n",
                class.as_file_token(),
                literals::unreadable(reason)
            )
        }
        ClassVerdict::Gate(o) => {
            format!(
                "  {}: {}\n",
                class.as_file_token(),
                operator_print(o, symbol, et_date)
            )
        }
    }
}

async fn render_keep_report(
    report: &KeepReport,
    store: &FlatFilesStore,
    symbol: &str,
    et_date: &str,
    now: DateTime<Utc>,
    trades_gets: u64,
    quotes_gets: u64,
) -> (String, ExitCode) {
    // Whole-command pre-GET gate (both classes Gate with same occupancy).
    if let (ClassVerdict::Gate(t), ClassVerdict::Gate(q)) = (&report.trades, &report.quotes) {
        if t == q {
            let detail = operator_print(t, symbol, et_date);
            let (verdict, code) = match t {
                Occupancy::NotInWatchlist
                | Occupancy::IneligibleWeekend
                | Occupancy::IneligibleHoliday
                | Occupancy::NotElapsed => (ok_not_miss(&detail), ExitCode::SUCCESS),
                Occupancy::MissingFilesCredentials => (
                    format!("[ERROR] flat-files — {detail}. No keep recorded.\n"),
                    ExitCode::from(1),
                ),
                Occupancy::WrongCredentialClass => (
                    "[ERROR] flat-files — flat files wrong credential class. REST apiKey is not the files secret. No keep recorded.\n".to_string(),
                    ExitCode::from(1),
                ),
                Occupancy::RefuseToMix => (
                    format!("[ERROR] flat-files — {detail}. No keep recorded.\n"),
                    ExitCode::from(1),
                ),
                Occupancy::NotStoring => (
                    format!("[ERROR] flat-files — {detail}.\n"),
                    ExitCode::from(1),
                ),
                _ => (
                    format!("[ERROR] flat-files — {detail}.\n"),
                    ExitCode::from(1),
                ),
            };
            return (verdict, code);
        }
    }

    let code = keep_process_exit(report);

    // Both-classes skip-GET [OK] with Vendor I/O: 0 — only when both skipped.
    if both_classes_skipped(report) {
        let (sib_sym, sib_occ) =
            sibling_symbol_and_occ(store, et_date, ExtractClass::Trades, symbol, now).await;
        let named_occ = match &report.trades {
            ClassVerdict::SkipGet { named, .. } => named.clone(),
            _ => Occupancy::NoStoredExtract,
        };
        let sib_phrase = content_hit_phrase(&sib_occ);
        let named_phrase = match &named_occ {
            Occupancy::NoStoredExtract => format!("{symbol} no stored extract"),
            Occupancy::Kept { .. } => format!("{symbol} {KEPT}"),
            Occupancy::EmptyExtract => format!("{symbol} empty extract"),
            other => format!("{symbol} {}", occupancy_token(other)),
        };
        let verdict = format!(
            "[OK] flat-files — {sib_sym} {sib_phrase} · {named_phrase} · Vendor I/O: 0 files GET\n{NOT_A_MISS}\n"
        );
        return (verdict, ExitCode::SUCCESS);
    }

    // Mixed-class / GET path: per-class lines; do NOT print whole-command Vendor I/O: 0.
    let (trades_sib, _) =
        sibling_symbol_and_occ(store, et_date, ExtractClass::Trades, symbol, now).await;
    let (quotes_sib, _) =
        sibling_symbol_and_occ(store, et_date, ExtractClass::Quotes, symbol, now).await;

    let mut body = String::new();
    body.push_str(&render_class_verdict(
        ExtractClass::Trades,
        &report.trades,
        symbol,
        et_date,
        &trades_sib,
    ));
    body.push_str(&render_class_verdict(
        ExtractClass::Quotes,
        &report.quotes,
        symbol,
        et_date,
        &quotes_sib,
    ));
    body.push_str(&format!(
        "  files GET: trades={trades_gets} quotes={quotes_gets}\n"
    ));

    let verdict = if code == ExitCode::SUCCESS {
        match (&report.trades, &report.quotes) {
            (ClassVerdict::Stored(Occupancy::Kept { .. }), _)
            | (_, ClassVerdict::Stored(Occupancy::Kept { .. }))
            | (ClassVerdict::Stored(Occupancy::EmptyExtract), _)
            | (_, ClassVerdict::Stored(Occupancy::EmptyExtract))
            | (ClassVerdict::SkipGet { .. }, _)
            | (_, ClassVerdict::SkipGet { .. }) => {
                format!(
                    "[OK] flat-files — {KEPT} · not a live paid session book · not a session day tape · local audit is not production coverage\n"
                )
            }
            _ => format!("[OK] flat-files — keep complete. {NOT_A_MISS}\n"),
        }
    } else if matches!(report.trades, ClassVerdict::Miss)
        || matches!(report.quotes, ClassVerdict::Miss)
    {
        format!(
            "[ERROR] flat-files — {}. No keep recorded.\n",
            literals::miss(et_date)
        )
    } else if matches!(report.trades, ClassVerdict::DownloadFailed)
        || matches!(report.quotes, ClassVerdict::DownloadFailed)
    {
        format!(
            "[ERROR] flat-files — {}. No keep recorded.\n",
            literals::download_failed(et_date)
        )
    } else if matches!(report.trades, ClassVerdict::Unreadable { .. })
        || matches!(report.quotes, ClassVerdict::Unreadable { .. })
    {
        let reason = match (&report.trades, &report.quotes) {
            (ClassVerdict::Unreadable { reason }, _) | (_, ClassVerdict::Unreadable { reason }) => {
                reason.as_str()
            }
            _ => "",
        };
        format!(
            "[ERROR] flat-files — {}. No keep recorded.\n",
            literals::unreadable(reason)
        )
    } else {
        "[ERROR] flat-files — keep failed. No keep recorded.\n".to_string()
    };

    let mut out = body;
    out.push_str(&verdict);
    (out, code)
}

/// Hermetic / production keep evaluate with injected `UniverseGet`.
pub async fn evaluate_keep(
    store: &FlatFilesStore,
    client: &impl UniverseGet,
    now: DateTime<Utc>,
    symbol_raw: &str,
    et_date_raw: &str,
    credential: KeepCredentialGate,
    temp_dir: &Path,
) -> (String, String, ExitCode) {
    let symbol = normalize_symbol(symbol_raw);
    let Some(et_date) = parse_et_date(et_date_raw) else {
        return wrap_err(&error_line("et_date unparseable. No keep recorded."));
    };

    let report = run_keep(client, store, &et_date, &symbol, now, credential, temp_dir).await;

    let trades_gets = client.send_count(ExtractClass::Trades);
    let quotes_gets = client.send_count(ExtractClass::Quotes);

    let (verdict_body, code) = render_keep_report(
        &report,
        store,
        &symbol,
        &et_date,
        now,
        trades_gets,
        quotes_gets,
    )
    .await;

    // Gate-only verdicts already include [OK]/[ERROR]; mixed path may include body + verdict.
    if matches!(
        (&report.trades, &report.quotes),
        (ClassVerdict::Gate(_), ClassVerdict::Gate(_))
    ) {
        if code == ExitCode::SUCCESS {
            wrap_ok("", &verdict_body)
        } else {
            wrap_err(&verdict_body)
        }
    } else if both_classes_skipped(&report) {
        wrap_ok("", &verdict_body)
    } else {
        // Split body/verdict: last line(s) starting with [OK]/[ERROR] are verdict.
        let (body, verdict) = split_keep_body_verdict(&verdict_body);
        wrap_with_code(&body, &verdict, code)
    }
}

fn split_keep_body_verdict(combined: &str) -> (String, String) {
    if let Some(idx) = combined.find("[OK] flat-files") {
        return (combined[..idx].to_string(), combined[idx..].to_string());
    }
    if let Some(idx) = combined.find("[ERROR] flat-files") {
        return (combined[..idx].to_string(), combined[idx..].to_string());
    }
    (combined.to_string(), String::new())
}

/// Production keep: classify credentials via env, adapt files client, run keep.
pub async fn evaluate_keep_from_config(
    cfg: &Config,
    store: &FlatFilesStore,
    now: DateTime<Utc>,
    symbol: Option<&str>,
    et_date: Option<&str>,
) -> (String, String, ExitCode) {
    let named = symbol
        .map(normalize_symbol)
        .unwrap_or_else(|| "SPY".to_string());
    let date = match et_date {
        Some(d) => match parse_et_date(d) {
            Some(d) => d,
            None => {
                return wrap_err(&error_line("et_date unparseable. No keep recorded."));
            }
        },
        None => today_et_date(now),
    };

    let classified = classify_files_credentials(
        &cfg.massive_files_access_key,
        &cfg.massive_files_secret,
        rest_key_from_env().as_deref(),
    );
    let (gate, client) = map_credential(classified);

    let temp_dir: PathBuf = cfg
        .massive_flat_files_body_root
        .clone()
        .unwrap_or_else(|| std::env::temp_dir().join("convexa-flat-files-keep"));
    let _ = std::fs::create_dir_all(&temp_dir);

    match client {
        Some(c) => {
            let adapter = ClientAdapter(&c);
            evaluate_keep(store, &adapter, now, &named, &date, gate, &temp_dir).await
        }
        None => evaluate_keep(store, &NeverGet, now, &named, &date, gate, &temp_dir).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::flat_file_keep::keep::test_stub::{plant_gzip, StubClient, StubResp};
    use chrono::TimeZone;
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    fn due_now() -> DateTime<Utc> {
        et_hm(2026, 8, 11, 12, 0) // Tuesday — Monday 2026-08-10 is due
    }

    fn exit_ok(code: ExitCode) -> bool {
        code == ExitCode::SUCCESS
    }

    fn temp() -> PathBuf {
        std::env::temp_dir().join("convexa-flat-files-cli-test")
    }

    #[tokio::test]
    async fn standing_block_first_evidence_local_closing_and_payload() {
        let store = FlatFilesStore::memory();
        let (stdout, stderr, _) =
            evaluate_cli(&store, due_now(), Some("SPY"), Some("2026-08-15")).await;
        assert!(stderr.contains(RUNNING.trim()));
        assert!(stdout.starts_with("MASSIVE FLAT FILES — RESEARCH CORPUS"));
        assert!(stdout.contains("Command:     flat-files"));
        assert!(stdout.contains("Evidence:    local"));
        assert!(!stdout.contains("Evidence:    this process"));
        assert!(stdout.contains("Payload:     stocks SIP trades · quotes · compressed CSV"));
        assert!(!stdout.contains("· aggregates"));
        assert!(stdout.contains("local audit is not production coverage"));
        assert!(stdout.contains(LICENSE));
        assert!(stdout.contains(STANDING_PROVENANCE));
        assert!(stdout.contains("Authorizes:  nothing"));
        // [RUNNING] is not a verdict on stdout.
        assert!(!stdout.contains("[RUNNING] flat-files — no verdict yet"));
    }

    #[tokio::test]
    async fn weekend_exits_0_with_not_a_miss() {
        let store = FlatFilesStore::memory();
        let (stdout, _, code) =
            evaluate_cli(&store, due_now(), Some("SPY"), Some("2026-08-15")).await;
        assert!(exit_ok(code));
        assert!(stdout.contains("flat files ineligible weekend: 2026-08-15"));
        assert!(stdout.contains(NOT_A_MISS));
        assert!(!stdout.contains("[ERROR]"));
    }

    #[tokio::test]
    async fn not_elapsed_exits_0_with_not_a_miss() {
        let store = FlatFilesStore::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _, code) = evaluate_cli(&store, now, Some("SPY"), Some("2026-08-10")).await; // due Sat 11:00; Mon 12:00 not yet
                                                                                                  // Monday 12:00 — Friday would be due Sat; Monday D not due until Tue 11:00.
        assert!(exit_ok(code));
        assert!(stdout.contains("flat files not elapsed:"));
        assert!(stdout.contains(NOT_A_MISS));
    }

    #[tokio::test]
    async fn both_classes_no_stored_extract_exits_0() {
        let store = FlatFilesStore::memory();
        let (stdout, _, code) =
            evaluate_cli(&store, due_now(), Some("SPY"), Some("2026-08-10")).await;
        assert!(exit_ok(code));
        assert!(stdout.contains("flat files no stored extract: 2026-08-10"));
        assert!(stdout.contains(NOT_A_MISS));
        assert!(!stdout.contains("flat files miss:"));
    }

    #[tokio::test]
    async fn not_in_watchlist_exits_0_without_root() {
        let store = FlatFilesStore::not_storing();
        let (stdout, _, code) =
            evaluate_cli(&store, due_now(), Some("NVDA"), Some("2020-01-02")).await;
        assert!(exit_ok(code));
        assert!(stdout.contains("not in flat-files watchlist: NVDA"));
        assert!(stdout.contains(NOT_A_MISS));
        assert!(!stdout.contains("[ERROR]"));
        assert!(!stdout.contains("flat files not storing"));
    }

    #[tokio::test]
    async fn empty_extract_inspect_exits_0() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\n".into(),
                0,
            )
            .await
            .unwrap();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Quotes,
                "ticker\n".into(),
                0,
            )
            .await
            .unwrap();
        let (stdout, _, code) =
            evaluate_cli(&store, due_now(), Some("SPY"), Some("2026-08-10")).await;
        assert!(exit_ok(code));
        assert!(stdout.contains("empty extract"));
        assert!(stdout.contains(NOT_A_MISS) || stdout.contains("[OK]"));
    }

    #[tokio::test]
    async fn keep_miss_is_nonzero_error() {
        let store = FlatFilesStore::memory();
        let client = StubClient::both(StubResp::NotFound);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR]"));
        assert!(stdout.contains("flat files miss:"));
    }

    #[tokio::test]
    async fn keep_download_failed_is_nonzero_error() {
        let store = FlatFilesStore::memory();
        let client = StubClient::both(StubResp::Transport);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR]"));
        assert!(stdout.contains("download failed"));
    }

    #[tokio::test]
    async fn keep_not_storing_is_nonzero_error() {
        let store = FlatFilesStore::not_storing();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR] flat-files — flat files not storing"));
    }

    #[tokio::test]
    async fn keep_refuse_to_mix_is_nonzero_error() {
        let store = FlatFilesStore::refuse_to_mix();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR] flat-files — flat files refuse to mix. No keep recorded."));
        assert!(!stdout.contains("flat files not storing"));
    }

    #[tokio::test]
    async fn keep_missing_credentials_no_rest_clause() {
        let store = FlatFilesStore::memory();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::MissingFilesCredentials,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout
            .contains("[ERROR] flat-files — flat files missing credentials. No keep recorded."));
        assert!(!stdout.contains("REST apiKey"));
    }

    #[tokio::test]
    async fn keep_wrong_credential_class_prints_rest_clause() {
        let store = FlatFilesStore::memory();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::WrongCredentialClass,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR] flat-files — flat files wrong credential class. REST apiKey is not the files secret. No keep recorded."));
    }

    #[tokio::test]
    async fn list_occupancy_column_miss_vs_empty_extract() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Quotes,
                "ticker\n".into(),
                0,
            )
            .await
            .unwrap();
        store
            .put_miss("2026-08-03", ExtractClass::Quotes)
            .await
            .unwrap();

        let (stdout, _, code) = evaluate_cli(&store, due_now(), Some("SPY"), None).await;
        assert!(exit_ok(code));
        assert!(stdout.contains("occupancy"));
        assert!(stdout.contains("kept"));
        assert!(stdout.contains("empty extract"));
        assert!(stdout.contains("miss"));
        // Bare 0 without occupancy forbidden — miss and empty extract both show token.
        assert!(stdout.contains("empty extract") && stdout.contains("miss"));
        // No QQQ trades miss beside SPY trades kept.
        assert!(!stdout.contains("QQQ     trades   miss"));
    }

    #[tokio::test]
    async fn dated_inspect_mixed_table_ac56() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        store
            .put_miss("2026-08-10", ExtractClass::Quotes)
            .await
            .unwrap();

        let (stdout, _, code) =
            evaluate_cli(&store, due_now(), Some("SPY"), Some("2026-08-10")).await;
        assert!(exit_ok(code), "content-hit + miss → inspect exit 0");
        assert!(stdout.contains("trades:"));
        assert!(stdout.contains("quotes:"));
        assert!(stdout.contains(KEPT) || stdout.contains("kept"));
        assert!(stdout.contains("miss"));

        // Unreadable + miss → non-zero.
        let store2 = FlatFilesStore::memory();
        store2
            .put_unreadable_pointer("SPY", "2026-08-10", ExtractClass::Trades, "corrupt".into())
            .await
            .unwrap();
        store2
            .put_miss("2026-08-10", ExtractClass::Quotes)
            .await
            .unwrap();
        let (stdout2, _, code2) =
            evaluate_cli(&store2, due_now(), Some("SPY"), Some("2026-08-10")).await;
        assert!(!exit_ok(code2));
        assert!(stdout2.contains("[ERROR]"));
        assert!(stdout2.contains("unreadable"));
    }

    #[tokio::test]
    async fn both_classes_skip_get_vendor_io_0_exit_0() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Quotes,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        let client = StubClient::both(StubResp::AssertNotCalled);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "QQQ",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(exit_ok(code));
        assert!(stdout.contains("Vendor I/O: 0 files GET"));
        assert!(stdout.contains(NOT_A_MISS));
        assert!(stdout.contains("[OK] flat-files —"));
        assert!(!stdout.contains("[ERROR] download failed"));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert_eq!(client.send_count(ExtractClass::Quotes), 0);
    }

    #[tokio::test]
    async fn mixed_class_keep_no_whole_command_vendor_io_0() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        // Quotes miss on GET.
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::NotFound);
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "QQQ",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        // trades files-call 0; quotes GET ≥1; no whole-command Vendor I/O: 0; exit follows keep_process_exit (non-zero on quotes miss).
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
        assert!(
            !stdout.contains("Vendor I/O: 0 files GET"),
            "mixed-class must not print whole-command Vendor I/O: 0"
        );
        assert!(!exit_ok(code), "quotes miss → process non-zero");
        // Never print trades miss beside SPY keep (Not a miss. on the skip line is fine).
        assert!(
            !stdout
                .lines()
                .any(|l| l.contains("trades:") && l.contains("flat files miss:")),
            "must not print trades miss beside SPY keep; stdout={stdout}"
        );
        assert!(stdout.contains("quotes:") && stdout.contains("flat files miss:"));
    }

    #[tokio::test]
    async fn mixed_class_keep_quotes_stored_exits_0_still_no_vendor_io_0() {
        let store = FlatFilesStore::memory();
        store
            .put_extract(
                "SPY",
                "2026-08-10",
                ExtractClass::Trades,
                "ticker\nSPY\n".into(),
                1,
            )
            .await
            .unwrap();
        let gzip = plant_gzip("ticker\nSPY\nQQQ\nIWM\n");
        let client = StubClient::new(StubResp::AssertNotCalled, StubResp::Gzip(gzip));
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "QQQ",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(exit_ok(code));
        assert_eq!(client.send_count(ExtractClass::Trades), 0);
        assert!(client.send_count(ExtractClass::Quotes) >= 1);
        assert!(!stdout.contains("Vendor I/O: 0 files GET"));
    }

    #[tokio::test]
    async fn keep_unreadable_is_nonzero_error() {
        let store = FlatFilesStore::memory();
        // Corrupt gzip → unreadable after 200.
        let client = StubClient::both(StubResp::Gzip(b"not-a-gzip".to_vec()));
        let (stdout, _, code) = evaluate_keep(
            &store,
            &client,
            due_now(),
            "SPY",
            "2026-08-10",
            KeepCredentialGate::Ready,
            &temp(),
        )
        .await;
        assert!(!exit_ok(code));
        assert!(stdout.contains("[ERROR]"));
        assert!(stdout.contains("unreadable"));
    }
}
