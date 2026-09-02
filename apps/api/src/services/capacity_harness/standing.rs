//! Standing / framing blocks (SPEC §4) — vouched vs blocked titles.

use super::types::{
    Command, Evidence, SURFACE_PER_TICKER_SSE, SURFACE_PRICES_SSE, SURFACE_TICKER_ANALYSIS_HTTP,
};

/// Inputs needed to render a standing block.
#[derive(Debug, Clone)]
pub struct StandingIds {
    pub command: Command,
    pub evidence: Evidence,
    pub hold_subscribers: usize,
    pub hold_sessions: usize,
    pub probe_sessions: usize,
    pub probe_subscribers: usize,
    pub surfaces: Vec<&'static str>,
}

impl StandingIds {
    pub fn with_surfaces(mut self, surfaces: Vec<&'static str>) -> Self {
        self.surfaces = surfaces;
        self
    }
}

/// Build standing ids for tests / short records.
pub fn sample_ids(
    command: Command,
    evidence: Evidence,
    hold_subscribers: usize,
    hold_sessions: usize,
    probe_sessions: usize,
    probe_subscribers: usize,
) -> StandingIds {
    StandingIds {
        command,
        evidence,
        hold_subscribers,
        hold_sessions,
        probe_sessions,
        probe_subscribers,
        surfaces: vec![
            SURFACE_TICKER_ANALYSIS_HTTP,
            SURFACE_PER_TICKER_SSE,
            SURFACE_PRICES_SSE,
        ],
    }
}

fn surfaces_line(surfaces: &[&str]) -> String {
    if surfaces.is_empty() {
        "(none)".to_string()
    } else {
        surfaces.join(" · ")
    }
}

/// Vouched standing (pass / threshold-fail / FAIL-with-mock-still-held).
pub fn render_standing_vouched(ids: &StandingIds) -> String {
    format!(
        "CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT\n\
           Command:     {command}\n\
           Evidence:    {evidence}\n\
           Surfaces:    {surfaces}\n\
           Vendor I/O:  in-process mock · 0 outbound vendor calls\n\
           This process (not production defaults):\n\
                        MAX_LIVE_SESSIONS={hold_sessions} · MAX_LIVE_SUBSCRIBERS={hold_subscribers} · PUBLIC_RATE_LIMIT_PER_MIN=0\n\
                        probe MAX_LIVE_SESSIONS={probe_sessions} · MAX_LIVE_SUBSCRIBERS={probe_subscribers} (dedicated LiveCapacity::new)\n\
           Thresholds:  harness p95 cold coalesced bundle GET wall ≤ 4000 ms\n\
                        harness p95 warm cache-hit bundle GET wall ≤ 150 ms\n\
                        harness p95 per-ticker SSE time-to-first-byte ≤ 200 ms\n\
                        harness p95 per-ticker SSE emit after inject ≤ 500 ms\n\
                        harness p95 prices SSE time-to-first-byte ≤ 200 ms\n\
                        harness p95 prices SSE emit after inject ≤ 500 ms\n\
                        unexpected errors = 0\n\
                        unexpected stream-hold drops = 0\n\
                        client timeout = 0\n\
                        hold phase: subscriber-ceiling refusals = 0 · session-ceiling refusals = 0\n\
                        overflow probe: every overflow attempt 503 + Retry-After 30\n\
                        (harness locks — not production SLOs)\n\
           Authorizes:  nothing. No trader-visible change, no score/tier/gate/fingerprint change,\n\
                        no production runtime default change.",
        command = ids.command,
        evidence = ids.evidence,
        surfaces = surfaces_line(&ids.surfaces),
        hold_sessions = ids.hold_sessions,
        hold_subscribers = ids.hold_subscribers,
        probe_sessions = ids.probe_sessions,
        probe_subscribers = ids.probe_subscribers,
    )
}

/// Blocked standing (vendor leak / unverifiable / paid-feed) — no MOCKED VENDORS.
pub fn render_standing_blocked(ids: &StandingIds) -> String {
    format!(
        "CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT\n\
           Command:     {command}\n\
           Evidence:    {evidence}\n\
           Surfaces:    {surfaces}\n\
           Vendor I/O:  unverifiable / left the process / paid Options feed would be used\n\
           Authorizes:  nothing.",
        command = ids.command,
        evidence = ids.evidence,
        surfaces = surfaces_line(&ids.surfaces),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::capacity_harness::receipt::{load_pass_record, render_measurement};

    #[test]
    fn vouched_standing_starts_with_capacity_harness_mocked_vendors() {
        let s = render_standing_vouched(&sample_ids(Command::Load, Evidence::Local, 9, 4, 1, 3));
        assert!(s.starts_with("CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT"));
        assert!(s
            .to_ascii_lowercase()
            .contains("this process (not production defaults)"));
        assert!(s.contains("harness locks — not production SLOs"));
        assert!(s.contains("client timeout = 0"));
        assert!(s.contains("unexpected stream-hold drops = 0"));
        assert!(s.contains("Authorizes:  nothing"));
        assert!(s.contains("MAX_LIVE_SESSIONS=4"));
        assert!(s.contains("MAX_LIVE_SUBSCRIBERS=9"));
        assert!(s.contains("probe MAX_LIVE_SESSIONS=1"));
        assert!(s.contains("MAX_LIVE_SUBSCRIBERS=3"));
    }

    #[test]
    fn blocked_standing_must_not_claim_mocked_vendors() {
        let s = render_standing_blocked(&sample_ids(Command::Load, Evidence::Local, 9, 4, 1, 3));
        assert!(s.starts_with("CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT"));
        assert!(!s.contains("MOCKED VENDORS"));
        assert!(!s.contains("in-process mock · 0 outbound vendor calls"));
    }

    #[test]
    fn load_receipt_cannot_print_command_soak() {
        let rec = render_measurement(&load_pass_record());
        assert!(rec.contains("Command:     load"));
        assert!(!rec.contains("Command:     soak"));
    }
}
