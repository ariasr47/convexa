//! Replay player: Δt/k sleeper walk of Path-A + Path-B timeline (B2).

use std::future::Future;
use std::pin::Pin;

pub use super::clocks::{et_hms_to_ts_ns, ts_ns_to_tape_time_et};
pub use super::replay_occupancy::{
    first_playing_voucher, ReplayConsumeOccupancy, ReplayOccupancySlot, ReplayPhase,
};
pub use super::replay_timeline::{build_timeline, decode_path_b_body, ReplayStep};
use super::store::{DayContainer, PathAKind, PathARecord};

/// Object-safe sleeper (boxed future — `async-trait` is not a direct api-rust dep).
pub trait ReplaySleeper: Send + Sync {
    fn sleep_for<'a>(
        &'a self,
        delta: std::time::Duration,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>>;
}

pub struct TokioSleeper;

impl ReplaySleeper for TokioSleeper {
    fn sleep_for<'a>(
        &'a self,
        delta: std::time::Duration,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
        Box::pin(async move {
            if !delta.is_zero() {
                tokio::time::sleep(delta).await;
            }
        })
    }
}

pub struct RecordingSleeper {
    pub sleeps: std::sync::Mutex<Vec<std::time::Duration>>,
}

impl ReplaySleeper for RecordingSleeper {
    fn sleep_for<'a>(
        &'a self,
        delta: std::time::Duration,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
        Box::pin(async move {
            self.sleeps.lock().unwrap().push(delta);
        })
    }
}

pub fn wall_delay(prev_ts_ns: i64, next_ts_ns: i64, k: u32) -> std::time::Duration {
    let dt = next_ts_ns.saturating_sub(prev_ts_ns).max(0);
    let k = k.max(1) as u128;
    std::time::Duration::from_nanos((dt as u128 / k) as u64)
}

/// Ports the player needs until B3 owns `ReplayHold` on `AppState`.
pub struct PlayerPorts {
    pub hub: crate::infrastructure::massive::StockStreamHub,
    pub occupancy: ReplayOccupancySlot,
    pub hold: std::sync::Arc<dyn ReplayHoldSink>,
    pub sleeper: std::sync::Arc<dyn ReplaySleeper>,
}

/// Object-safe Path-B structure sink (boxed future — same reason as [`ReplaySleeper`]).
pub trait ReplayHoldSink: Send + Sync {
    fn replace<'a>(
        &'a self,
        symbol: &'a str,
        et_date: &'a str,
        snap: crate::state::AnalyticsSnapshot,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>>;
}

impl ReplayHoldSink for crate::state::ReplayHold {
    fn replace<'a>(
        &'a self,
        symbol: &'a str,
        et_date: &'a str,
        snap: crate::state::AnalyticsSnapshot,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
        Box::pin(async move {
            crate::state::ReplayHold::replace(self, symbol, et_date, snap).await;
        })
    }
}

/// Walk the stored day: Path-A Trade/Quote → hub; PathAGap → occupancy pulse;
/// Path-B marks → `compute_analytics_from_vendor` → hold. Ends after last occupant.
pub async fn run_player(
    symbol: &str,
    et_date: &str,
    pace: u32,
    day: DayContainer,
    ports: PlayerPorts,
) {
    let steps = build_timeline(&day, et_date);
    if steps.is_empty() {
        let mut ended = ports
            .occupancy
            .snapshot()
            .await
            .unwrap_or_else(|| first_playing_voucher(symbol, et_date, pace));
        ended.phase = ReplayPhase::Ended;
        ports.occupancy.write(ended).await;
        return;
    }

    let mut prev_ts: Option<i64> = None;
    for step in steps {
        match step {
            ReplayStep::PulseGap { .. } => {
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Gap;
                    // keep occ.tape_time_et — do not null it
                    ports.occupancy.write(occ).await;
                }
            }
            ReplayStep::EmitPathA(rec) => {
                // PathAGap never becomes a StreamEvent (filtered by timeline).
                let ts = rec.ts_ns.unwrap_or(0);
                if let Some(prev) = prev_ts {
                    ports.sleeper.sleep_for(wall_delay(prev, ts, pace)).await;
                }
                prev_ts = Some(ts);
                ports
                    .hub
                    .publish_event(stream_event_from_path_a(symbol, &rec));
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Playing;
                    occ.tape_time_et = ts_ns_to_tape_time_et(ts);
                    ports.occupancy.write(occ).await;
                }
            }
            ReplayStep::ApplyPathB {
                mark: _,
                ts_ns,
                body,
            } => {
                if let Some(prev) = prev_ts {
                    ports.sleeper.sleep_for(wall_delay(prev, ts_ns, pace)).await;
                }
                prev_ts = Some(ts_ns);
                match decode_path_b_body(&body) {
                    Ok(vendor) => {
                        match crate::services::analytics::compute_analytics_from_vendor(
                            &vendor,
                            &crate::services::analytics::AnalyticsComputeParams::default(),
                            None,
                        )
                        .await
                        {
                            Ok(snap) => {
                                ports.hold.replace(symbol, et_date, snap).await;
                            }
                            Err(_) => {
                                // Skip mark; Path-A continues (desk isolation).
                            }
                        }
                    }
                    Err(_) => {
                        // Unreadable Path-B body: skip mark; do not stop Path-A.
                    }
                }
                if let Some(mut occ) = ports.occupancy.snapshot().await {
                    occ.phase = ReplayPhase::Playing;
                    occ.tape_time_et = ts_ns_to_tape_time_et(ts_ns);
                    ports.occupancy.write(occ).await;
                }
            }
        }
    }

    if let Some(mut occ) = ports.occupancy.snapshot().await {
        occ.phase = ReplayPhase::Ended;
        ports.occupancy.write(occ).await;
    }
}

fn stream_event_from_path_a(symbol: &str, rec: &PathARecord) -> crate::domain::StreamEvent {
    crate::domain::StreamEvent {
        symbol: symbol.to_ascii_uppercase(),
        kind: match rec.kind {
            PathAKind::Quote => crate::domain::StreamKind::Quote,
            // Trade (and any non-quote stamped kind) — PathAGap never reaches here.
            _ => crate::domain::StreamKind::Trade,
        },
        ts_ns: rec.ts_ns.unwrap_or(0),
        price: rec.price,
        size: rec.size,
        bid: rec.bid,
        ask: rec.ask,
        bid_size: rec.bid_size,
        ask_size: rec.ask_size,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::StreamKind;
    use crate::services::chain_snapshot::{fixture_probe_bundle, serialize_capture, to_wire};
    use crate::services::day_tape::fs::prepare_path_b_body;
    use crate::services::day_tape::store::PathBSnapshot;
    use chrono::{TimeZone, Utc};
    use chrono_tz::America::New_York;
    use std::sync::{Arc, Mutex};

    const ET: &str = "2026-08-10";
    const SYM: &str = "SPY";

    fn ts(h: u32, m: u32, s: u32) -> i64 {
        et_hms_to_ts_ns(ET, h, m, s).expect("et stamp")
    }

    fn path_b_body(mark: (u32, u32)) -> Vec<u8> {
        let as_of = New_York
            .with_ymd_and_hms(2026, 8, 10, mark.0, mark.1, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let bundle = fixture_probe_bundle(SYM, as_of);
        let raw = serialize_capture(&to_wire(&bundle)).unwrap();
        prepare_path_b_body(&raw).unwrap()
    }

    struct RecordingHold {
        replaces: Mutex<Vec<(String, String, String)>>,
    }

    impl ReplayHoldSink for RecordingHold {
        fn replace<'a>(
            &'a self,
            symbol: &'a str,
            et_date: &'a str,
            snap: crate::state::AnalyticsSnapshot,
        ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
            Box::pin(async move {
                self.replaces.lock().unwrap().push((
                    symbol.to_ascii_uppercase(),
                    et_date.to_string(),
                    snap.ticker.clone(),
                ));
            })
        }
    }

    /// Records occupancy snapshots at each sleep (observes gap pulse mid-walk).
    struct SnapshottingSleeper {
        sleeps: Mutex<Vec<std::time::Duration>>,
        occupancy: ReplayOccupancySlot,
        at_sleep: Mutex<Vec<ReplayConsumeOccupancy>>,
    }

    impl ReplaySleeper for SnapshottingSleeper {
        fn sleep_for<'a>(
            &'a self,
            delta: std::time::Duration,
        ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
            Box::pin(async move {
                if let Some(occ) = self.occupancy.snapshot().await {
                    self.at_sleep.lock().unwrap().push(occ);
                }
                self.sleeps.lock().unwrap().push(delta);
            })
        }
    }

    async fn drain_hub(
        rx: &mut tokio::sync::broadcast::Receiver<crate::domain::StreamEvent>,
    ) -> Vec<crate::domain::StreamEvent> {
        let mut out = Vec::new();
        loop {
            match rx.try_recv() {
                Ok(ev) => out.push(ev),
                Err(_) => break,
            }
        }
        out
    }

    async fn vouch(occupancy: &ReplayOccupancySlot, pace: u32) {
        occupancy.write(first_playing_voucher(SYM, ET, pace)).await;
    }

    fn make_ports(
        occupancy: ReplayOccupancySlot,
        sleeper: Arc<dyn ReplaySleeper>,
        hold: Arc<dyn ReplayHoldSink>,
    ) -> (
        PlayerPorts,
        tokio::sync::broadcast::Receiver<crate::domain::StreamEvent>,
    ) {
        let hub = crate::infrastructure::massive::StockStreamHub::harness_local();
        let rx = hub.subscribe_events();
        (
            PlayerPorts {
                hub,
                occupancy,
                hold,
                sleeper,
            },
            rx,
        )
    }

    #[test]
    fn wall_delay_compresses_by_k() {
        let one_s_ns = 1_000_000_000i64;
        assert_eq!(
            wall_delay(0, one_s_ns, 1),
            std::time::Duration::from_secs(1)
        );
        assert_eq!(
            wall_delay(0, one_s_ns, 4),
            std::time::Duration::from_millis(250)
        );
        assert_eq!(
            wall_delay(0, one_s_ns, 10),
            std::time::Duration::from_millis(100)
        );
        assert_eq!(wall_delay(5, 3, 1), std::time::Duration::from_nanos(0));
    }

    #[tokio::test]
    async fn four_x_and_ten_x_compress_waits_without_reorder() {
        let t0 = ts(10, 0, 0);
        let t1 = ts(10, 0, 1);

        for (pace, expect) in [
            (4u32, std::time::Duration::from_millis(250)),
            (10u32, std::time::Duration::from_millis(100)),
        ] {
            let occupancy = ReplayOccupancySlot::unset();
            vouch(&occupancy, pace).await;
            let sleeper = Arc::new(RecordingSleeper {
                sleeps: Mutex::new(Vec::new()),
            });
            let hold = Arc::new(RecordingHold {
                replaces: Mutex::new(Vec::new()),
            });
            let (ports, mut rx) = make_ports(occupancy, sleeper.clone(), hold);

            let mut day = DayContainer::default();
            day.path_a.push(PathARecord::trade(t0, 100.0, None));
            day.path_a.push(PathARecord::trade(t1, 101.0, None));

            run_player(SYM, ET, pace, day, ports).await;

            let sleeps = sleeper.sleeps.lock().unwrap().clone();
            assert_eq!(sleeps, vec![expect], "pace={pace}");
            let evs = drain_hub(&mut rx).await;
            assert_eq!(evs.len(), 2);
            assert_eq!(evs[0].ts_ns, t0);
            assert_eq!(evs[1].ts_ns, t1);
        }
    }

    #[tokio::test]
    async fn emits_path_a_in_stored_order_with_stored_ts_ns() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy, sleeper, hold);

        let mut day = DayContainer::default();
        let t_trade = ts(10, 0, 0);
        let t_quote = ts(10, 0, 2);
        day.path_a
            .push(PathARecord::trade(t_trade, 100.0, Some(10.0)));
        day.path_a.push(PathARecord::quote(
            t_quote,
            Some(99.9),
            Some(100.1),
            Some(1.0),
            Some(2.0),
        ));

        run_player(SYM, ET, 1, day, ports).await;

        let evs = drain_hub(&mut rx).await;
        assert_eq!(evs.len(), 2);
        assert_eq!(evs[0].kind, StreamKind::Trade);
        assert_eq!(evs[0].ts_ns, t_trade);
        assert_eq!(evs[0].price, Some(100.0));
        assert_eq!(evs[0].symbol, "SPY");
        assert_eq!(evs[1].kind, StreamKind::Quote);
        assert_eq!(evs[1].ts_ns, t_quote);
        assert_eq!(evs[1].bid, Some(99.9));
        assert_eq!(evs[1].ask, Some(100.1));
    }

    #[tokio::test]
    async fn path_b_applied_only_when_reached() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy, sleeper.clone(), hold.clone());

        let mut day = DayContainer::default();
        // Order by time: Path-B 09:30 → Path-A 09:35 → Path-B 09:40
        day.path_a
            .push(PathARecord::trade(ts(9, 35, 0), 101.0, None));
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: Utc::now(),
            body: path_b_body((9, 30)),
        });
        day.path_b.push(PathBSnapshot {
            mark: (9, 40),
            as_of: Utc::now(),
            body: path_b_body((9, 40)),
        });

        run_player(SYM, ET, 1, day, ports).await;

        let replaces = hold.replaces.lock().unwrap().clone();
        assert_eq!(replaces.len(), 2, "both marks applied");
        assert_eq!(replaces[0].0, "SPY");
        assert_eq!(replaces[0].1, ET);

        let sleeps = sleeper.sleeps.lock().unwrap().clone();
        // 09:30 → 09:35 = 5min; 09:35 → 09:40 = 5min
        assert_eq!(sleeps.len(), 2);
        assert_eq!(sleeps[0], std::time::Duration::from_secs(5 * 60));
        assert_eq!(sleeps[1], std::time::Duration::from_secs(5 * 60));

        let evs = drain_hub(&mut rx).await;
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].ts_ns, ts(9, 35, 0));
    }

    #[tokio::test]
    async fn path_a_gap_pulses_holding_last_tape_time_then_sleeps_to_next_stamp() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(SnapshottingSleeper {
            sleeps: Mutex::new(Vec::new()),
            occupancy: occupancy.clone(),
            at_sleep: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy, sleeper.clone(), hold);

        let mut day = DayContainer::default();
        let t0 = ts(10, 0, 0);
        let t1 = ts(10, 0, 5);
        day.path_a.push(PathARecord::trade(t0, 100.0, None));
        day.path_a.push(PathARecord::gap(3));
        day.path_a.push(PathARecord::trade(t1, 100.5, None));

        run_player(SYM, ET, 1, day, ports).await;

        let sleeps = sleeper.sleeps.lock().unwrap().clone();
        assert_eq!(sleeps, vec![std::time::Duration::from_secs(5)]);

        let at_sleep = sleeper.at_sleep.lock().unwrap().clone();
        assert_eq!(at_sleep.len(), 1);
        assert_eq!(
            at_sleep[0].phase,
            ReplayPhase::Gap,
            "gap occupancy must be visible before sleep to next stamp"
        );
        assert_eq!(
            at_sleep[0].tape_time_et,
            ts_ns_to_tape_time_et(t0),
            "gap must not null the last vouched tape_time_et"
        );

        let evs = drain_hub(&mut rx).await;
        assert_eq!(evs.len(), 2, "PathAGap must not become a StreamEvent");
        assert_eq!(evs[0].ts_ns, t0);
        assert_eq!(evs[1].ts_ns, t1);
    }

    #[tokio::test]
    async fn empty_path_a_occupied_path_b_starts_with_zero_apply_event() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy, sleeper, hold.clone());

        let mut day = DayContainer::default();
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: Utc::now(),
            body: path_b_body((9, 30)),
        });
        day.path_b.push(PathBSnapshot {
            mark: (9, 35),
            as_of: Utc::now(),
            body: path_b_body((9, 35)),
        });

        run_player(SYM, ET, 1, day, ports).await;

        let evs = drain_hub(&mut rx).await;
        assert!(
            evs.is_empty(),
            "empty Path-A must not fabricate prints; got {}",
            evs.len()
        );
        let replaces = hold.replaces.lock().unwrap().clone();
        assert_eq!(replaces.len(), 2, "Path-B marks still fire");
    }

    #[tokio::test]
    async fn both_empty_ends_after_first_playing_voucher() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 4).await;
        assert_eq!(
            occupancy.snapshot().await.unwrap().phase,
            ReplayPhase::Playing
        );
        assert!(occupancy.snapshot().await.unwrap().tape_time_et.is_none());

        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy.clone(), sleeper.clone(), hold.clone());

        run_player(SYM, ET, 4, DayContainer::default(), ports).await;

        let occ = occupancy.snapshot().await.expect("occupancy remains");
        assert_eq!(occ.phase, ReplayPhase::Ended);
        assert!(occ.tape_time_et.is_none());
        assert_eq!(occ.pace, 4);
        assert!(drain_hub(&mut rx).await.is_empty());
        assert!(hold.replaces.lock().unwrap().is_empty());
        assert!(sleeper.sleeps.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn after_last_occupant_no_further_path_a_and_no_loop() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy.clone(), sleeper.clone(), hold);

        let mut day = DayContainer::default();
        let t0 = ts(10, 0, 0);
        day.path_a.push(PathARecord::trade(t0, 100.0, None));

        run_player(SYM, ET, 1, day, ports).await;

        let evs = drain_hub(&mut rx).await;
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].ts_ns, t0);
        assert!(sleeper.sleeps.lock().unwrap().is_empty());

        let occ = occupancy.snapshot().await.unwrap();
        assert_eq!(occ.phase, ReplayPhase::Ended);
        assert_eq!(occ.tape_time_et, ts_ns_to_tape_time_et(t0));

        // No second pass: hub stays quiet after ended.
        assert!(drain_hub(&mut rx).await.is_empty());
    }

    #[tokio::test]
    async fn unreadable_path_b_mark_is_skipped_path_a_continues() {
        let occupancy = ReplayOccupancySlot::unset();
        vouch(&occupancy, 1).await;
        let sleeper = Arc::new(RecordingSleeper {
            sleeps: Mutex::new(Vec::new()),
        });
        let hold = Arc::new(RecordingHold {
            replaces: Mutex::new(Vec::new()),
        });
        let (ports, mut rx) = make_ports(occupancy, sleeper, hold.clone());

        let mut day = DayContainer::default();
        let t0 = ts(9, 32, 0);
        let t1 = ts(9, 36, 0);
        day.path_a.push(PathARecord::trade(t0, 100.0, None));
        day.path_a.push(PathARecord::trade(t1, 101.0, None));
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: Utc::now(),
            body: b"not-json".to_vec(),
        });
        day.path_b.push(PathBSnapshot {
            mark: (9, 35),
            as_of: Utc::now(),
            body: path_b_body((9, 35)),
        });

        run_player(SYM, ET, 1, day, ports).await;

        let evs = drain_hub(&mut rx).await;
        assert_eq!(evs.len(), 2, "Path-A must continue past unreadable mark");
        assert_eq!(evs[0].ts_ns, t0);
        assert_eq!(evs[1].ts_ns, t1);

        let replaces = hold.replaces.lock().unwrap().clone();
        assert_eq!(replaces.len(), 1, "only the readable mark applies");
    }

    #[test]
    fn player_does_not_call_massive() {
        let src = include_str!("player.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(
            prod.contains("compute_analytics_from_vendor("),
            "Path-B must call compute_analytics_from_vendor"
        );
        assert!(
            !prod.contains("refresh_analytics"),
            "player must not call refresh_analytics"
        );
        assert!(
            !prod.contains("MassiveClient") && !prod.contains("four_fetch"),
            "player must not vendor-fetch"
        );
        assert!(
            !prod.contains(&format!("insert_if_{}", "absent")),
            "player must not persist into archive"
        );
        assert!(
            !prod.contains(&format!("spawn_{}", "capture")),
            "player must not spawn capture"
        );
    }
}
