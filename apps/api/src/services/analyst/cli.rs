//! `api-rust package q1 <TICKER> --cutoff <RFC3339> [--save-inputs D | --inputs D] [--out F]`.
//!
//! stdout carries only the 64-character `package_id` and a newline, so scripts can capture it;
//! everything else goes to stderr. Errors return to `main`, which prints `error: <line>` and exits 1.
//! The command opens no database and, in replay, builds no HTTP client and never reads
//! `SEC_USER_AGENT`.

use super::inputs::{self, Saver};
use super::package::{build, compact, stamp, ContextPackage, Need, Request, MAX_TOKENS};
use crate::config::SecUserAgent;
use crate::services::public_data::edgar;
use crate::services::public_data::fetch::{Http, SecGate};
use crate::services::public_data::{normalize_ticker, SEC_SPACING};
use chrono::{DateTime, Utc};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

/// The usage line for a bad `--cutoff` (clap prints it and exits 2).
pub const CUTOFF_USAGE: &str =
    "--cutoff must be an RFC 3339 time in whole seconds, such as 2026-10-16T20:00:00Z.";

/// `--cutoff`: RFC 3339 in whole seconds, any offset, kept as UTC.
pub fn parse_cutoff(raw: &str) -> Result<DateTime<Utc>, String> {
    let parsed = DateTime::parse_from_rfc3339(raw.trim()).map_err(|_| CUTOFF_USAGE.to_string())?;
    if parsed.timestamp_subsec_nanos() != 0 {
        return Err(CUTOFF_USAGE.to_string());
    }
    Ok(parsed.with_timezone(&Utc))
}

/// The margin between a cutoff and the read: EDGAR's JSON shows a filing after it is disseminated,
/// not at acceptance, so a read just after the cutoff could miss one accepted just before it.
const READ_MARGIN: chrono::Duration = chrono::Duration::hours(1);

/// A cutoff in the future is refused.
pub fn check_future(cutoff: DateTime<Utc>, now: DateTime<Utc>) -> Result<(), String> {
    if cutoff > now {
        return Err(format!(
            "The cutoff {} is in the future. A package can only hold facts accepted by then.",
            stamp(cutoff)
        ));
    }
    Ok(())
}

/// A cutoff less than an hour before the inputs were read (now, live; the earliest `fetched_at`,
/// replay) is refused.
pub fn check_margin(cutoff: DateTime<Utc>, read_at: DateTime<Utc>) -> Result<(), String> {
    if cutoff + READ_MARGIN > read_at {
        return Err(format!(
            "The cutoff {} is less than an hour before these inputs were read ({}). A filing accepted just before it may not have reached EDGAR's JSON yet.",
            stamp(cutoff),
            stamp(read_at)
        ));
    }
    Ok(())
}

pub struct Q1Args {
    pub ticker: String,
    pub cutoff: DateTime<Utc>,
    pub save_inputs: Option<PathBuf>,
    pub inputs: Option<PathBuf>,
    pub out: Option<PathBuf>,
}

fn write_atomically(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Couldn't create {}: {e}", parent.display()))?;
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "package.json".into());
    let temp = path.with_file_name(format!(".{name}.tmp-{}", std::process::id()));
    std::fs::write(&temp, bytes)
        .and_then(|_| std::fs::rename(&temp, path))
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp);
            format!("Couldn't write {}: {e}", path.display())
        })
}

fn report(package: &ContextPackage) -> Result<u64, String> {
    eprintln!(
        "Q1 package for {}. Cutoff {}, since {}.",
        package.ticker,
        stamp(package.cutoff),
        stamp(package.since)
    );
    eprintln!(
        "Facts: filings {}, insider_trades {}, holders {}, fundamentals {}. Omitted: research_note (not built until slice 0e).",
        package.filings.facts.len(),
        package.insider_trades.facts.len(),
        package.holders.facts.len(),
        package.fundamentals.facts.len()
    );
    let form4_unread = package.insider_trades.coverage.unread.len();
    let managers_unread = package
        .holders
        .coverage
        .unread
        .iter()
        .map(|u| u.cik)
        .collect::<BTreeSet<_>>()
        .len();
    let unjoined = package.fundamentals.coverage.points_unjoined;
    let no_time = package.filings.coverage.no_acceptance_time.len();
    if form4_unread + managers_unread + unjoined as usize + no_time > 0 {
        eprintln!(
            "Gaps: {form4_unread} Form 4s unread, {managers_unread} managers unread, {unjoined} company-facts points unjoined, {no_time} filings without an acceptance time."
        );
    }
    let used = package.tokens_used().map_err(|e| e.to_string())?;
    eprintln!("Tokens: {used} of {MAX_TOKENS} (estimate: canonical bytes / 4).");
    if used > MAX_TOKENS {
        eprintln!("Over the core budget. This slice cuts nothing; Phase 1 decides what goes.");
    }
    Ok(used)
}

/// Run the command. Returns the error line on failure (nothing written).
pub async fn run_q1(args: Q1Args) -> Result<(), String> {
    let typed = args.ticker.trim().to_ascii_uppercase();
    let Some(ticker) = normalize_ticker(&typed) else {
        return Err(format!("{} lists no company under {typed}.", edgar::SOURCE));
    };
    let request = Request {
        ticker: ticker.clone(),
        cutoff: args.cutoff,
    };
    let now = Utc::now();
    let mut saver = None;
    let package = match &args.inputs {
        Some(dir) => {
            if args.save_inputs.is_some() {
                return Err("--inputs and --save-inputs can't be used together.".into());
            }
            check_future(args.cutoff, now)?;
            let inputs = inputs::load(dir)?;
            if let Some(read_at) = inputs.earliest_fetch() {
                check_margin(args.cutoff, read_at)?;
            }
            if inputs.illustrative {
                eprintln!("These inputs are illustrative: hand-built SEC answers whose accession numbers and values don't match real filings.");
            }
            match build(&request, &inputs) {
                Ok(package) => package,
                Err(Need::Fail(line)) => return Err(line),
                Err(Need::Fetch(wanted)) => {
                    let url = wanted.first().map(|f| f.url.clone()).unwrap_or_default();
                    return Err(format!(
                        "The saved inputs have no response for {url}. Run live with --save-inputs to capture it."
                    ));
                }
            }
        }
        None => {
            // The cutoff first, so a bad one fails before any client exists.
            check_future(args.cutoff, now)?;
            check_margin(args.cutoff, now)?;
            let user_agent = SecUserAgent::from_raw(std::env::var("SEC_USER_AGENT").ok().as_deref())
                .ok_or_else(|| {
                    "SEC_USER_AGENT is not set. A live read needs it, because sec.gov asks every client to identify itself. A replay with --inputs does not.".to_string()
                })?;
            if reqwest::header::HeaderValue::from_str(user_agent.expose()).is_err() {
                return Err(edgar::INVALID_USER_AGENT.to_string());
            }
            let http = Http::new(user_agent.expose())
                .map_err(|_| edgar::INVALID_USER_AGENT.to_string())?;
            drop(user_agent);
            if let Some(dir) = &args.save_inputs {
                saver = Some(Saver::create(dir)?);
            }
            let gate = SecGate::new(SEC_SPACING);
            inputs::build_live(&request, &http, &gate, saver.as_mut()).await?
        }
    };
    report(&package)?;
    let (id, bytes) = package.file_bytes().map_err(|e| e.to_string())?;
    let out = args.out.clone().unwrap_or_else(|| {
        PathBuf::from(format!(
            "data/research/analyst/q1_{ticker}_{}.json",
            compact(args.cutoff)
        ))
    });
    write_atomically(&out, &bytes)?;
    eprintln!("Written to {}.", out.display());
    if let (Some(saver), Some(dir)) = (&saver, &args.save_inputs) {
        let (count, bytes) = saver.summary();
        eprintln!(
            "Inputs saved to {}: {count} responses, {:.1} MB.",
            dir.display(),
            bytes as f64 / 1_000_000.0
        );
    }
    println!("{id}");
    Ok(())
}
