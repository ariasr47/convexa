//! Closed operator literals (SPEC §4). Internal type names are not copy.

pub const COMMAND: &str = "flat-files";
pub const AUTHORIZES: &str = "nothing";
pub const EVIDENCE_HTTP: &str = "this process";
pub const EVIDENCE_CLI: &str = "local";

pub const FRAMING_HIT: &str = "RESEARCH READ — MASSIVE FLAT FILES";
pub const FRAMING_MISS: &str = "RESEARCH READ — NO MASSIVE FLAT FILES";
pub const FRAMING_NOT_ELAPSED: &str = "RESEARCH READ — MASSIVE FLAT FILES NOT ELAPSED";
pub const FRAMING_WEEKEND: &str = "RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND";
pub const FRAMING_HOLIDAY: &str = "RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY";
pub const FRAMING_NOT_IN_WATCHLIST: &str = "RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST";
pub const FRAMING_NOT_STORING: &str = "RESEARCH READ — MASSIVE FLAT FILES NOT STORING";
pub const FRAMING_UNREADABLE: &str = "RESEARCH READ — MASSIVE FLAT FILES UNREADABLE";
pub const FRAMING_REFUSE_TO_MIX: &str = "RESEARCH READ — MASSIVE FLAT FILES REFUSE TO MIX";

pub const HIT_PROVENANCE: &str = "loaded from Massive flat files · no REST/WS call";
pub const MISS_PROVENANCE: &str = "no vendor call";
pub const STANDING_PROVENANCE: &str =
    "reconstructed flat file · never live_massive · never coverage present · never session day tape";
pub const LICENSE: &str = "Our research · not redistributed as a live vendor feed.";
pub const CLOSING: &str = "MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing";

pub const NOT_STORING: &str = "flat files not storing";
pub const REFUSE_TO_MIX: &str = "flat files refuse to mix";
pub const KEPT: &str = "kept from Massive flat files";
pub const MISSING_CREDENTIALS: &str = "flat files missing credentials";
pub const WRONG_CREDENTIAL_CLASS: &str =
    "flat files wrong credential class · REST apiKey is not the files secret";
pub const UNAUTHORIZED_DETAIL: &str =
    "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token";
pub const BAD_DATE: &str = "et_date must be YYYY-MM-DD";
pub const INVALID_LIMIT: &str = "limit must be >= 1";
pub const UNREADABLE_ERROR: &str = "massive_flat_files_unreadable";

pub fn not_in_watchlist(symbol: &str) -> String {
    format!("not in flat-files watchlist: {symbol}")
}

pub fn ineligible_weekend(et_date: &str) -> String {
    format!("flat files ineligible weekend: {et_date}")
}

pub fn ineligible_holiday(et_date: &str) -> String {
    format!("flat files ineligible holiday: {et_date}")
}

pub fn not_elapsed(et_date: &str) -> String {
    format!("flat files not elapsed: vendor file for {et_date} not yet published")
}

pub fn miss(et_date: &str) -> String {
    format!("flat files miss: vendor file for {et_date} due and absent")
}

pub fn no_stored_extract(et_date: &str) -> String {
    format!("flat files no stored extract: {et_date}")
}

pub fn empty_extract(symbol: &str, et_date: &str) -> String {
    format!("flat files empty extract: {symbol} on {et_date}")
}

pub fn unreadable(reason: &str) -> String {
    format!("flat files unreadable: {reason}")
}

pub fn download_failed(et_date: &str) -> String {
    format!("flat files download failed: vendor file for {et_date} not confirmed")
}
