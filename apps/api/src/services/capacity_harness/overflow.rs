//! Dedicated-probe overflow waves (HTTP on the second loopback bind only).

use crate::error::AppResult;
use crate::state::AppState;
use std::net::SocketAddr;
use std::time::Duration;

use super::clients::SseClient;
use super::types::{PROBE_SESSIONS, PROBE_SUBSCRIBERS};

/// Observation from the two overflow waves.
#[derive(Debug, Clone, Default)]
pub struct OverflowObservation {
    pub subscriber_503: u64,
    pub session_503: u64,
    pub subscriber_admitted: u64,
    pub session_admitted: u64,
    /// Host:port actually contacted for overflow samples (must equal probe, not hold).
    pub probe_bind: String,
    pub samples_hit_hold: bool,
}

#[derive(Debug, Clone)]
pub struct OverflowReport {
    pub ok: bool,
    pub observation: OverflowObservation,
    pub detail: Option<String>,
}

/// Vacuous when both refusal classes are zero (AC-23).
pub fn evaluate_overflow(obs: &OverflowObservation) -> OverflowReport {
    if obs.samples_hit_hold {
        return OverflowReport {
            ok: false,
            observation: obs.clone(),
            detail: Some("overflow samples contacted hold bind; probe-only required".into()),
        };
    }
    if obs.subscriber_503 == 0 && obs.session_503 == 0 {
        return OverflowReport {
            ok: false,
            observation: obs.clone(),
            detail: Some(
                "overflow probe vacuous: zero subscriber-ceiling and zero session-ceiling refusals"
                    .into(),
            ),
        };
    }
    if obs.subscriber_503 == 0 {
        return OverflowReport {
            ok: false,
            observation: obs.clone(),
            detail: Some("overflow probe missing subscriber-ceiling 503".into()),
        };
    }
    if obs.session_503 == 0 {
        return OverflowReport {
            ok: false,
            observation: obs.clone(),
            detail: Some("overflow probe missing session-ceiling 503".into()),
        };
    }
    OverflowReport {
        ok: true,
        observation: obs.clone(),
        detail: None,
    }
}

fn is_503_retry_after_30(client: &SseClient) -> bool {
    client.status == 503 && client.retry_after.as_deref() == Some("30")
}

/// Run subscriber then session overflow waves against `probe_addr` only.
pub async fn run_overflow_waves(
    probe: &AppState,
    probe_addr: SocketAddr,
    hold_addr: SocketAddr,
) -> AppResult<OverflowObservation> {
    let mut obs = OverflowObservation {
        probe_bind: format!("127.0.0.1:{}", probe_addr.port()),
        ..OverflowObservation::default()
    };
    let hold_hp = format!("127.0.0.1:{}", hold_addr.port());
    let timeout = Duration::from_secs(5);

    // --- Subscriber wave: max_subscribers+1 on one ticker ---
    let sub_ceiling = probe.live_capacity.max_subscribers().max(1);
    let mut holders: Vec<SseClient> = Vec::new();
    for _ in 0..sub_ceiling {
        let mut c = SseClient::connect(probe_addr, "/api/stream/SPY", timeout).await?;
        if c.url_host_port() == hold_hp {
            obs.samples_hit_hold = true;
        }
        if c.status == 200 {
            obs.subscriber_admitted += 1;
            let _ = c.wait_connected_comment(timeout).await;
            holders.push(c);
        } else if is_503_retry_after_30(&c) {
            obs.subscriber_503 += 1;
        }
    }
    // One more — expect 503
    let refused = SseClient::connect(probe_addr, "/api/stream/SPY", timeout).await?;
    if refused.url_host_port() == hold_hp {
        obs.samples_hit_hold = true;
    }
    if is_503_retry_after_30(&refused) {
        obs.subscriber_503 += 1;
    }
    drop(refused);
    drop(holders);

    // Wait for disconnect-release on probe.
    let release_deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    while probe.live_capacity.subscriber_count() > 0
        && tokio::time::Instant::now() < release_deadline
    {
        tokio::time::sleep(Duration::from_millis(20)).await;
    }

    // --- Session wave: sessions=1; two on SPY admit; QQQ refuses ---
    let mut session_holders: Vec<SseClient> = Vec::new();
    for _ in 0..2 {
        let mut c = SseClient::connect(probe_addr, "/api/stream/SPY", timeout).await?;
        if c.url_host_port() == hold_hp {
            obs.samples_hit_hold = true;
        }
        if c.status == 200 {
            obs.session_admitted += 1;
            let _ = c.wait_connected_comment(timeout).await;
            session_holders.push(c);
        } else if is_503_retry_after_30(&c) {
            // Under session ceiling on same ticker should admit; count anyway.
            obs.session_503 += 1;
        }
    }
    let qqq = SseClient::connect(probe_addr, "/api/stream/QQQ", timeout).await?;
    if qqq.url_host_port() == hold_hp {
        obs.samples_hit_hold = true;
    }
    if is_503_retry_after_30(&qqq) {
        obs.session_503 += 1;
    }
    drop(qqq);
    drop(session_holders);

    let release_deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    while probe.live_capacity.subscriber_count() > 0
        && tokio::time::Instant::now() < release_deadline
    {
        tokio::time::sleep(Duration::from_millis(20)).await;
    }

    let _ = (PROBE_SESSIONS, PROBE_SUBSCRIBERS);
    Ok(obs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::capacity_harness::clients::{bind_loopback, harness_router};
    use crate::services::capacity_harness::fixture::load_capacity_book;
    use crate::services::capacity_harness::types::{PROBE_SESSIONS, PROBE_SUBSCRIBERS};
    use crate::state::AppState;
    use std::path::PathBuf;

    fn golden_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    #[tokio::test]
    async fn overflow_all_admit_is_vacuous_fail() {
        let report = evaluate_overflow(&OverflowObservation {
            subscriber_503: 0,
            session_503: 0,
            ..OverflowObservation::default()
        });
        assert!(!report.ok);
    }

    #[tokio::test]
    async fn overflow_is_http_503_retry_after_30_on_the_probe_listener_not_oneshot() {
        let book = load_capacity_book(&golden_path()).unwrap();
        // Hold: roomy ceilings so it is not the overflow target.
        let hold = AppState::for_capacity_harness(book.catalog.clone(), 4, 9)
            .await
            .unwrap();
        let probe = AppState::for_capacity_harness(book.catalog, PROBE_SESSIONS, PROBE_SUBSCRIBERS)
            .await
            .unwrap();
        assert_eq!(probe.live_capacity.max_subscribers(), 3);
        assert_eq!(probe.live_capacity.max_sessions(), 1);

        let hold_app = harness_router(hold.clone()).unwrap();
        let probe_app = harness_router(probe.clone()).unwrap();
        let (hold_addr, hold_h) = bind_loopback(hold_app).await.unwrap();
        let (probe_addr, probe_h) = bind_loopback(probe_app).await.unwrap();
        assert_ne!(hold_addr.port(), probe_addr.port());

        let obs = run_overflow_waves(&probe, probe_addr, hold_addr)
            .await
            .unwrap();
        assert!(!obs.samples_hit_hold);
        assert_eq!(obs.probe_bind, format!("127.0.0.1:{}", probe_addr.port()));
        assert!(
            obs.subscriber_503 >= 1,
            "expected subscriber 503, got {obs:?}"
        );
        assert!(obs.session_503 >= 1, "expected session 503, got {obs:?}");
        assert!(obs.subscriber_admitted >= 3 || obs.subscriber_admitted + obs.subscriber_503 >= 4);

        let report = evaluate_overflow(&obs);
        assert!(report.ok, "{:?}", report.detail);

        hold_h.abort();
        probe_h.abort();
    }

    #[tokio::test]
    async fn session_ceiling_one_admits_many_on_one_ticker_and_refuses_a_second_ticker() {
        let book = load_capacity_book(&golden_path()).unwrap();
        let probe = AppState::for_capacity_harness(book.catalog, 1, 3)
            .await
            .unwrap();
        let hold = AppState::for_capacity_harness(
            // separate catalog clone via reload
            load_capacity_book(&golden_path()).unwrap().catalog,
            4,
            9,
        )
        .await
        .unwrap();
        let hold_app = harness_router(hold).unwrap();
        let probe_app = harness_router(probe.clone()).unwrap();
        let (hold_addr, hold_h) = bind_loopback(hold_app).await.unwrap();
        let (probe_addr, probe_h) = bind_loopback(probe_app).await.unwrap();

        let timeout = Duration::from_secs(5);
        let a = SseClient::connect(probe_addr, "/api/stream/SPY", timeout)
            .await
            .unwrap();
        let b = SseClient::connect(probe_addr, "/api/stream/SPY", timeout)
            .await
            .unwrap();
        assert_eq!(a.status, 200);
        assert_eq!(b.status, 200);
        let qqq = SseClient::connect(probe_addr, "/api/stream/QQQ", timeout)
            .await
            .unwrap();
        assert_eq!(qqq.status, 503);
        assert_eq!(qqq.retry_after.as_deref(), Some("30"));
        assert_eq!(
            qqq.url_host_port(),
            format!("127.0.0.1:{}", probe_addr.port())
        );
        assert_ne!(
            qqq.url_host_port(),
            format!("127.0.0.1:{}", hold_addr.port())
        );

        drop(a);
        drop(b);
        drop(qqq);
        hold_h.abort();
        probe_h.abort();
    }
}
