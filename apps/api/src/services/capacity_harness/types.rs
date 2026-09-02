//! Closed vocabulary and locked profile constants for the capacity harness.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Named command axis (distinct from evidence).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Command {
    Load,
    Soak,
}

impl Command {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Load => "load",
            Self::Soak => "soak",
        }
    }

    pub const fn locked_span(self) -> &'static str {
        match self {
            Self::Load => LOAD_LOCKED_SPAN,
            Self::Soak => SOAK_LOCKED_SPAN,
        }
    }
}

impl std::fmt::Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Evidence axis (distinct from command). Not clap-relabelable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Evidence {
    Local,
    Ci,
}

impl Evidence {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::Ci => "ci",
        }
    }
}

impl std::fmt::Display for Evidence {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Terminal / short-record verdict class.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Verdict {
    Pass,
    Fail,
    Blocked,
    Incomplete,
    Error,
    Vacuous,
    Partial,
}

impl Verdict {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::Fail => "FAIL",
            Self::Blocked => "BLOCKED",
            Self::Incomplete => "INCOMPLETE",
            Self::Error => "ERROR",
            Self::Vacuous => "VACUOUS",
            Self::Partial => "PARTIAL",
        }
    }
}

impl std::fmt::Display for Verdict {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Closed outcome class literals (exact on measurement receipts).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OutcomeClass {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "subscriber-ceiling refusal")]
    SubscriberCeilingRefusal,
    #[serde(rename = "session-ceiling refusal")]
    SessionCeilingRefusal,
    #[serde(rename = "rate-limit refusal")]
    RateLimitRefusal,
    #[serde(rename = "unexpected error")]
    UnexpectedError,
    #[serde(rename = "unexpected stream-hold drops")]
    UnexpectedStreamHoldDrops,
    #[serde(rename = "client timeout")]
    ClientTimeout,
}

impl OutcomeClass {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::SubscriberCeilingRefusal => "subscriber-ceiling refusal",
            Self::SessionCeilingRefusal => "session-ceiling refusal",
            Self::RateLimitRefusal => "rate-limit refusal",
            Self::UnexpectedError => "unexpected error",
            Self::UnexpectedStreamHoldDrops => "unexpected stream-hold drops",
            Self::ClientTimeout => "client timeout",
        }
    }

    pub const ALL: &[OutcomeClass] = &[
        Self::Ok,
        Self::SubscriberCeilingRefusal,
        Self::SessionCeilingRefusal,
        Self::RateLimitRefusal,
        Self::UnexpectedError,
        Self::UnexpectedStreamHoldDrops,
        Self::ClientTimeout,
    ];
}

impl std::fmt::Display for OutcomeClass {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Score / tier / fingerprint triple used for identity (not full envelope).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IdentityTriple {
    pub opportunity_score: i32,
    pub opportunity_tier: String,
    pub state_fingerprint: String,
}

/// Named p95 scenario bases (exact strings).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ScenarioName {
    WarmCacheHitBundleGetWall,
    ColdCoalescedBundleGetWall,
    PerTickerSseTtfb,
    PerTickerSseEmitAfterInject,
    PricesSseTtfb,
    PricesSseEmitAfterInject,
}

impl ScenarioName {
    pub const BASIS_WARM: &'static str = "warm cache-hit bundle GET wall";
    pub const BASIS_COLD: &'static str = "cold coalesced bundle GET wall";
    pub const BASIS_PER_TICKER_TTFB: &'static str = "per-ticker SSE time-to-first-byte";
    pub const BASIS_PER_TICKER_EMIT: &'static str = "per-ticker SSE emit after inject";
    pub const BASIS_PRICES_TTFB: &'static str = "prices SSE time-to-first-byte";
    pub const BASIS_PRICES_EMIT: &'static str = "prices SSE emit after inject";

    pub const fn basis(self) -> &'static str {
        match self {
            Self::WarmCacheHitBundleGetWall => Self::BASIS_WARM,
            Self::ColdCoalescedBundleGetWall => Self::BASIS_COLD,
            Self::PerTickerSseTtfb => Self::BASIS_PER_TICKER_TTFB,
            Self::PerTickerSseEmitAfterInject => Self::BASIS_PER_TICKER_EMIT,
            Self::PricesSseTtfb => Self::BASIS_PRICES_TTFB,
            Self::PricesSseEmitAfterInject => Self::BASIS_PRICES_EMIT,
        }
    }

    pub const fn lock_ms(self) -> f64 {
        match self {
            Self::WarmCacheHitBundleGetWall => WARM_P95_MS,
            Self::ColdCoalescedBundleGetWall => COLD_P95_MS,
            Self::PerTickerSseTtfb | Self::PricesSseTtfb => SSE_TTFB_P95_MS,
            Self::PerTickerSseEmitAfterInject | Self::PricesSseEmitAfterInject => SSE_EMIT_P95_MS,
        }
    }

    pub const ALL: &[ScenarioName] = &[
        Self::WarmCacheHitBundleGetWall,
        Self::ColdCoalescedBundleGetWall,
        Self::PerTickerSseTtfb,
        Self::PerTickerSseEmitAfterInject,
        Self::PricesSseTtfb,
        Self::PricesSseEmitAfterInject,
    ];
}

/// Locked load / soak / probe profile numbers.
pub const LOAD_WARM_HTTP: usize = 16;
pub const LOAD_PER_TICKER_SSE: usize = 8;
pub const LOAD_PRICES_SSE: usize = 1;
pub const LOAD_HOLD_SUBSCRIBERS: usize = 9;
pub const LOAD_HOLD_SESSIONS: usize = 4;
pub const LOAD_HTTP_HOLD: Duration = Duration::from_secs(20);
pub const LOAD_SSE_HOLD: Duration = Duration::from_secs(5);
pub const SOAK_HTTP: usize = 8;
pub const SOAK_PER_TICKER_SSE: usize = 32;
pub const SOAK_PRICES_SSE: usize = 1;
pub const SOAK_HOLD_SUBSCRIBERS: usize = 500;
pub const SOAK_HOLD_SESSIONS: usize = 50;
pub const SOAK_HOLD: Duration = Duration::from_secs(600);
pub const PROBE_SESSIONS: usize = 1;
pub const PROBE_SUBSCRIBERS: usize = 3;
pub const CONTRACT_FLOOR: usize = 1000;
pub const WARM_P95_MS: f64 = 150.0;
pub const COLD_P95_MS: f64 = 4000.0;
pub const SSE_TTFB_P95_MS: f64 = 200.0;
pub const SSE_EMIT_P95_MS: f64 = 500.0;

pub const LOAD_LOCKED_SPAN: &str = "20s warm HTTP + 5s SSE hold + refusal probe";
pub const SOAK_LOCKED_SPAN: &str = "600s";

pub const SURFACE_TICKER_ANALYSIS_HTTP: &str = "ticker-analysis HTTP";
pub const SURFACE_PER_TICKER_SSE: &str = "per-ticker SSE";
pub const SURFACE_PRICES_SSE: &str = "prices SSE";

pub const CLOSING_LINE: &str =
    "CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT · Authorizes: nothing";

pub const PASS_VERDICT_SUFFIX: &str = "harness p95 within locks · unexpected errors 0 · unexpected stream-hold drops 0 · client timeout 0 · overflow probe 503 + Retry-After 30 · vendor I/O stayed in-process · not a production measurement";

/// Strings banned from harness stdout / receipt emissions.
pub const BANNED_EMIT_NEEDLES: &[&str] = &[
    "production test",
    "live load test",
    "Massive soak",
    "SLO",
    "SLA",
    "benchmark of production",
    "production ready",
    "verified",
    "certified",
    "can handle",
    "Railway",
    "the live site",
    "our capacity",
    "Massive latency",
    "paid feed",
    "live Options",
    "vendor p95",
    "/api/_metrics",
    "Massive p95",
    "RESEARCH READ",
    "RESEARCH REPLAY",
    "● Live",
    "WCAG",
    "pixel perfect",
    "raise MAX_LIVE_SUBSCRIBERS",
    "ship this p95",
    "hosted production evidence",
    "results dashboard",
    "metrics snapshot",
    "production report",
    "production ceiling",
    "certified limit",
];
