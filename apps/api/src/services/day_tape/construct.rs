//! Session-day-replay exclusive construct: prepare → vouch → bind.

use super::clocks::parse_et_date;
use super::literals;
use super::occupancy::{derive_axis_a, derive_path_a, derive_path_b, AxisA, DeriveInput};
use super::player::first_playing_voucher;
use super::store::{is_not_storing_err, DayContainer, PathAKind, SessionDayTape};
use super::watchlist::normalize_symbol;
use crate::error::AppResult;
use crate::state::AppState;
use chrono::{DateTime, Utc};

pub fn parse_pace(raw: Option<u32>) -> Result<u32, String> {
    match raw.unwrap_or(1) {
        1 | 4 | 10 => Ok(raw.unwrap_or(1)),
        other => Err(format!("illegal pace {other}")),
    }
}

pub fn production_profile_refuses(app_env: Option<&str>) -> bool {
    app_env == Some("prod")
}

pub enum Prepare {
    Play {
        state: AppState,
        symbol: String,
        et_date: String,
        pace: u32,
        day: DayContainer,
        /// Empty-Path-A / empty-Path-B standing lines (not refuse).
        empty_standing: Vec<String>,
    },
    Refuse {
        literal: String,
    },
}

impl std::fmt::Debug for Prepare {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Play {
                symbol,
                et_date,
                pace,
                empty_standing,
                ..
            } => f
                .debug_struct("Play")
                .field("symbol", symbol)
                .field("et_date", et_date)
                .field("pace", pace)
                .field("empty_standing", empty_standing)
                .finish_non_exhaustive(),
            Self::Refuse { literal } => f.debug_struct("Refuse").field("literal", literal).finish(),
        }
    }
}

fn count_path_a(day: &DayContainer) -> (usize, usize, usize) {
    let mut trades = 0usize;
    let mut quotes = 0usize;
    let mut gaps = 0usize;
    for rec in &day.path_a {
        match rec.kind {
            PathAKind::Trade => trades += 1,
            PathAKind::Quote => quotes += 1,
            PathAKind::PathAGap => gaps += 1,
        }
    }
    (trades, quotes, gaps)
}

fn path_b_marks_of(day: &DayContainer) -> Vec<(u32, u32)> {
    day.path_b.iter().map(|s| s.mark).collect()
}

/// Prepare identity + vouch first playing occupancy. Never binds HTTP.
pub async fn prepare_replay(
    symbol: &str,
    et_date: &str,
    pace_raw: Option<u32>,
    tape: SessionDayTape,
    now: DateTime<Utc>,
    app_env: Option<&str>,
) -> Prepare {
    if production_profile_refuses(app_env) {
        return Prepare::Refuse {
            literal: "session-day-replay refuses APP_ENV=prod".into(),
        };
    }
    let pace = match parse_pace(pace_raw) {
        Ok(k) => k,
        Err(e) => return Prepare::Refuse { literal: e },
    };
    let symbol = normalize_symbol(symbol);
    let Some(et_date) = parse_et_date(et_date) else {
        return Prepare::Refuse {
            literal: "et_date must be YYYY-MM-DD".into(),
        };
    };

    let storing = tape.is_enabled();
    // Gate before store I/O when possible (NVDA works without a root).
    let early = derive_axis_a(&symbol, &et_date, now, storing, false, false);
    match early {
        AxisA::NotInWatchlist => {
            return Prepare::Refuse {
                literal: literals::not_in_watchlist(&symbol),
            };
        }
        AxisA::NotStoring => {
            return Prepare::Refuse {
                literal: literals::NOT_STORING.to_string(),
            };
        }
        AxisA::IneligibleWeekend => {
            return Prepare::Refuse {
                literal: literals::ineligible_weekend(&symbol, &et_date),
            };
        }
        AxisA::IneligibleHoliday => {
            return Prepare::Refuse {
                literal: literals::ineligible_holiday(&symbol, &et_date),
            };
        }
        AxisA::NotElapsed => {
            return Prepare::Refuse {
                literal: literals::not_elapsed(&symbol, &et_date),
            };
        }
        AxisA::NoIdentity
        | AxisA::Unreadable
        | AxisA::StoringReady
        | AxisA::NotExpectedPreStore => {}
    }

    let loaded = match tape.load(&symbol, &et_date).await {
        Ok(v) => v,
        Err(e) if is_not_storing_err(&e) => {
            return Prepare::Refuse {
                literal: literals::NOT_STORING.to_string(),
            };
        }
        Err(e) => {
            return Prepare::Refuse {
                literal: literals::unreadable(&e.to_string()),
            };
        }
    };
    let has_container = loaded.is_some();
    let unreadable_reason = loaded
        .as_ref()
        .and_then(|d| d.unreadable_reason.clone())
        .unwrap_or_default();
    let unreadable = !unreadable_reason.is_empty();
    let axis_a = derive_axis_a(&symbol, &et_date, now, storing, has_container, unreadable);

    match axis_a {
        AxisA::NotInWatchlist => {
            return Prepare::Refuse {
                literal: literals::not_in_watchlist(&symbol),
            };
        }
        AxisA::NotStoring => {
            return Prepare::Refuse {
                literal: literals::NOT_STORING.to_string(),
            };
        }
        AxisA::IneligibleWeekend => {
            return Prepare::Refuse {
                literal: literals::ineligible_weekend(&symbol, &et_date),
            };
        }
        AxisA::IneligibleHoliday => {
            return Prepare::Refuse {
                literal: literals::ineligible_holiday(&symbol, &et_date),
            };
        }
        AxisA::NotElapsed => {
            return Prepare::Refuse {
                literal: literals::not_elapsed(&symbol, &et_date),
            };
        }
        AxisA::NoIdentity | AxisA::NotExpectedPreStore => {
            return Prepare::Refuse {
                literal: literals::no_identity(&symbol, &et_date),
            };
        }
        AxisA::Unreadable => {
            return Prepare::Refuse {
                literal: literals::unreadable(&unreadable_reason),
            };
        }
        AxisA::StoringReady => {}
    }

    let day = match loaded {
        Some(d) if d.unreadable_reason.as_ref().is_some_and(|r| !r.is_empty()) => {
            return Prepare::Refuse {
                literal: literals::unreadable(d.unreadable_reason.as_deref().unwrap_or("")),
            };
        }
        Some(d) => d,
        None => {
            return Prepare::Refuse {
                literal: literals::no_identity(&symbol, &et_date),
            };
        }
    };

    let (trades, quotes, gaps) = count_path_a(&day);
    let marks = path_b_marks_of(&day);
    let path_b_capturing = day.path_b_armed_from.is_some();
    let input = DeriveInput {
        symbol: &symbol,
        et_date: &et_date,
        now,
        storing: true,
        has_container: true,
        unreadable: false,
        path_a_trade_count: trades,
        path_a_quote_count: quotes,
        path_a_gap_count: gaps,
        path_b_capturing,
        path_b_snapshot_marks: &marks,
        path_a_armed_from: day.path_a_armed_from,
        path_a_armed_until: day.path_a_armed_until,
        path_b_armed_from: day.path_b_armed_from,
        path_b_armed_until: day.path_b_armed_until,
    };
    let path_a = derive_path_a(&input);
    let path_b = derive_path_b(&input);

    let mut empty_standing = Vec::new();
    match path_a.content {
        super::occupancy::AxisBPathA::EmptyWhileStoring => {
            empty_standing.push(literals::no_path_a_ticks(&symbol, &et_date));
        }
        _ => {}
    }
    match path_b.content {
        super::occupancy::AxisBPathB::EmptyWhileStoring
        | super::occupancy::AxisBPathB::PathBNotCapturing => {
            empty_standing.push(literals::no_path_b_snapshots(&symbol, &et_date));
        }
        _ => {}
    }

    let occupancy = crate::services::day_tape::replay_occupancy::ReplayOccupancySlot::unset();
    // Vouch BEFORE AppState is advertised / before any bind.
    occupancy
        .write(first_playing_voucher(&symbol, &et_date, pace))
        .await;

    let state = match AppState::for_session_day_replay_with_env(tape, occupancy, app_env).await {
        Ok(s) => s,
        Err(e) => {
            return Prepare::Refuse {
                literal: e.to_string().replacen("config: ", "", 1),
            };
        }
    };

    Prepare::Play {
        state,
        symbol,
        et_date,
        pace,
        day,
        empty_standing,
    }
}

/// On Play, invoke `bind` (sets a test AtomicBool or real listener). Refuse never calls it.
pub async fn prepare_then_bind<F, Fut>(
    symbol: &str,
    et_date: &str,
    pace_raw: Option<u32>,
    tape: SessionDayTape,
    now: DateTime<Utc>,
    app_env: Option<&str>,
    bind: F,
) -> Result<Prepare, String>
where
    F: FnOnce(AppState) -> Fut,
    Fut: std::future::Future<Output = AppResult<()>>,
{
    let prep = prepare_replay(symbol, et_date, pace_raw, tape, now, app_env).await;
    match prep {
        Prepare::Refuse { literal } => Err(literal),
        Prepare::Play {
            state,
            symbol,
            et_date,
            pace,
            day,
            empty_standing,
        } => {
            bind(state.clone()).await.map_err(|e| e.to_string())?;
            Ok(Prepare::Play {
                state,
                symbol,
                et_date,
                pace,
                day,
                empty_standing,
            })
        }
    }
}

pub fn standing_block(symbol: &str, et_date: &str, pace: u32) -> String {
    let clock = if pace == 1 {
        "tape time ET".to_string()
    } else {
        format!("tape time ET · {pace}×")
    };
    format!(
        "SESSION TAPE — RESEARCH PLAYBACK · NOT A LIVE VENDOR FEED\n\
         Identity:    {symbol} · {et_date} America/New_York\n\
         Source:      session day tape · Path-A ticks · Path-B 5-minute structure when present\n\
         Provenance:  research tape · never live_massive · never coverage present\n\
         Clock:       {clock}\n\
         Vendor I/O:  0 Massive calls on this playback\n\
         Authorizes:  nothing on the score formula. Not a live paid session book.\n\
                      Not coverage present. Not redistributed as a live vendor feed.\n"
    )
}

pub fn running_line(symbol: &str, et_date: &str) -> String {
    format!(
        "[RUNNING] session-day-replay — {symbol} {et_date} · session day tape · not a live feed"
    )
}

pub fn ended_line(symbol: &str, et_date: &str) -> String {
    format!("[OK] session-day-replay — session tape ended · {symbol} on {et_date}")
}

pub fn stopped_line() -> String {
    "[OK] session-day-replay — stopped · not live Massive".into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::day_tape::player::ReplayPhase;
    use crate::services::day_tape::store::{DayContainer, PathARecord, SessionDayTape};
    use chrono::{NaiveTime, TimeZone};
    use chrono_tz::America::New_York;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    async fn plant(tape: &SessionDayTape, symbol: &str, et_date: &str, day: DayContainer) {
        let SessionDayTape::Memory(inner) = tape else {
            panic!("plant requires Memory tape");
        };
        let mut g = inner.write().await;
        g.by_symbol
            .entry(symbol.to_string())
            .or_default()
            .insert(et_date.to_string(), day);
    }

    fn playable_day() -> DayContainer {
        DayContainer {
            path_a: vec![PathARecord::trade(1_000_000_000, 100.0, Some(1.0))],
            path_b: vec![],
            path_a_armed_from: Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap()),
            path_a_armed_until: Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap()),
            path_b_armed_from: None,
            path_b_armed_until: None,
            unreadable_reason: None,
        }
    }

    #[test]
    fn parse_pace_accepts_1_4_10_and_omitted_is_1() {
        assert_eq!(parse_pace(None).unwrap(), 1);
        assert_eq!(parse_pace(Some(1)).unwrap(), 1);
        assert_eq!(parse_pace(Some(4)).unwrap(), 4);
        assert_eq!(parse_pace(Some(10)).unwrap(), 10);
    }

    #[test]
    fn parse_pace_rejects_2_60_and_zero_before_bind() {
        assert!(parse_pace(Some(2)).is_err());
        assert!(parse_pace(Some(60)).is_err());
        assert!(parse_pace(Some(0)).is_err());
        assert!(parse_pace(Some(3)).is_err());
    }

    #[test]
    fn production_profile_refuses_only_prod() {
        assert!(production_profile_refuses(Some("prod")));
        assert!(!production_profile_refuses(Some("dev")));
        assert!(!production_profile_refuses(None));
    }

    #[tokio::test]
    async fn missing_identity_refuses_before_bind() {
        let tape = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let did_bind = Arc::new(AtomicBool::new(false));
        let did_bind_c = did_bind.clone();
        let err = prepare_then_bind(
            "SPY",
            "2026-08-03",
            None,
            tape,
            now,
            Some("dev"),
            |_state| async move {
                did_bind_c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("missing identity must refuse");
        assert_eq!(err, literals::no_identity("SPY", "2026-08-03"));
        assert!(
            !did_bind.load(Ordering::SeqCst),
            "refuse must not invoke bind thunk"
        );
    }

    #[tokio::test]
    async fn holiday_et_date_refuses_before_bind_with_holiday_literal() {
        let now = et_hm(2026, 11, 27, 12, 0);
        let tape = SessionDayTape::memory();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(
            "SPY",
            "2026-11-26",
            None,
            tape,
            now,
            None,
            |_| async move {
                c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("holiday");
        assert_eq!(err, literals::ineligible_holiday("SPY", "2026-11-26"));
        assert_ne!(err, literals::ineligible_weekend("SPY", "2026-11-26"));
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn unreadable_weekend_not_elapsed_nvda_not_storing_refuse_before_bind() {
        let now = et_hm(2026, 8, 10, 12, 0);

        // weekend
        {
            let tape = SessionDayTape::memory();
            let did_bind = Arc::new(AtomicBool::new(false));
            let c = did_bind.clone();
            let err =
                prepare_then_bind("SPY", "2026-08-15", None, tape, now, None, |_| async move {
                    c.store(true, Ordering::SeqCst);
                    Ok(())
                })
                .await
                .expect_err("weekend");
            assert_eq!(err, literals::ineligible_weekend("SPY", "2026-08-15"));
            assert!(!did_bind.load(Ordering::SeqCst));
        }

        // not elapsed
        {
            let tape = SessionDayTape::memory();
            let did_bind = Arc::new(AtomicBool::new(false));
            let c = did_bind.clone();
            let err =
                prepare_then_bind("SPY", "2026-08-11", None, tape, now, None, |_| async move {
                    c.store(true, Ordering::SeqCst);
                    Ok(())
                })
                .await
                .expect_err("not elapsed");
            assert_eq!(err, literals::not_elapsed("SPY", "2026-08-11"));
            assert!(!did_bind.load(Ordering::SeqCst));
        }

        // NVDA not in watchlist
        {
            let tape = SessionDayTape::disabled();
            let did_bind = Arc::new(AtomicBool::new(false));
            let c = did_bind.clone();
            let err = prepare_then_bind(
                "NVDA",
                "2020-01-02",
                None,
                tape,
                now,
                None,
                |_| async move {
                    c.store(true, Ordering::SeqCst);
                    Ok(())
                },
            )
            .await
            .expect_err("nvda");
            assert_eq!(err, literals::not_in_watchlist("NVDA"));
            assert!(!did_bind.load(Ordering::SeqCst));
        }

        // not storing
        {
            let tape = SessionDayTape::disabled();
            let did_bind = Arc::new(AtomicBool::new(false));
            let c = did_bind.clone();
            let err =
                prepare_then_bind("SPY", "2026-08-10", None, tape, now, None, |_| async move {
                    c.store(true, Ordering::SeqCst);
                    Ok(())
                })
                .await
                .expect_err("not storing");
            assert_eq!(err, literals::NOT_STORING);
            assert!(!did_bind.load(Ordering::SeqCst));
        }

        // unreadable
        {
            let tape = SessionDayTape::memory();
            let mut day = playable_day();
            day.unreadable_reason = Some("planted".into());
            plant(&tape, "SPY", "2026-08-10", day).await;
            let did_bind = Arc::new(AtomicBool::new(false));
            let c = did_bind.clone();
            let err =
                prepare_then_bind("SPY", "2026-08-10", None, tape, now, None, |_| async move {
                    c.store(true, Ordering::SeqCst);
                    Ok(())
                })
                .await
                .expect_err("unreadable");
            assert_eq!(err, literals::unreadable("planted"));
            assert!(!did_bind.load(Ordering::SeqCst));
        }
    }

    #[tokio::test]
    async fn illegal_pace_refuses_before_bind() {
        let tape = SessionDayTape::memory();
        plant(&tape, "SPY", "2026-08-10", playable_day()).await;
        let now = et_hm(2026, 8, 10, 12, 0);
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(
            "SPY",
            "2026-08-10",
            Some(60),
            tape,
            now,
            None,
            |_| async move {
                c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("illegal pace");
        assert!(err.contains("illegal pace"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn production_profile_plus_arm_refuses_before_bind() {
        let tape = SessionDayTape::memory();
        plant(&tape, "SPY", "2026-08-10", playable_day()).await;
        let now = et_hm(2026, 8, 10, 12, 0);
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(
            "SPY",
            "2026-08-10",
            None,
            tape,
            now,
            Some("prod"),
            |_| async move {
                c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("prod+arm");
        assert!(
            err.contains("session-day-replay refuses APP_ENV=prod"),
            "{err}"
        );
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn playable_vouches_playing_before_listener_bind() {
        let tape = SessionDayTape::memory();
        plant(&tape, "SPY", "2026-08-10", playable_day()).await;
        let now = et_hm(2026, 8, 10, 12, 0);
        let prep = prepare_replay("SPY", "2026-08-10", Some(4), tape, now, Some("dev")).await;
        let Prepare::Play {
            state,
            symbol,
            et_date,
            pace,
            ..
        } = prep
        else {
            panic!("expected Play, got refuse");
        };
        assert_eq!(symbol, "SPY");
        assert_eq!(et_date, "2026-08-10");
        assert_eq!(pace, 4);
        let occ = state
            .replay_occupancy
            .snapshot()
            .await
            .expect("occupancy vouched before bind");
        assert_eq!(occ.phase, ReplayPhase::Playing);
        assert!(occ.tape_time_et.is_none(), "first voucher has null cursor");
        assert_eq!(occ.symbol, "SPY");
        assert_eq!(occ.et_date, "2026-08-10");
        assert_eq!(occ.pace, 4);
        // prepare never binds — listener thunk not invoked.
        let did_bind = AtomicBool::new(false);
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn replay_construct_vendor_fixture_is_none_and_stock_worker_not_started() {
        let tape = SessionDayTape::memory();
        plant(&tape, "SPY", "2026-08-10", playable_day()).await;
        let now = et_hm(2026, 8, 10, 12, 0);
        let prep = prepare_replay("SPY", "2026-08-10", None, tape, now, None).await;
        let Prepare::Play { state, .. } = prep else {
            panic!("expected Play");
        };
        assert!(state.vendor_fixture.is_none());
        assert!(!state.config.warm_enabled);
        assert!(!state.config.scan_enabled);
        // stock_worker exists but must not have been started (harness_local hub; no vendor WS).
        let src = include_str!("../../state.rs");
        let replay_ctor = src
            .split("for_session_day_replay_with_env")
            .nth(1)
            .expect("replay ctor")
            .split("/// Fixture-aware")
            .next()
            .unwrap_or("");
        assert!(
            replay_ctor.contains("Intentionally never call stock_worker.start()")
                || !replay_ctor.contains("stock_worker.start()"),
            "replay construct must not start stock_worker"
        );
    }

    #[test]
    fn standing_block_matches_spec() {
        let block = standing_block("SPY", "2026-08-10", 1);
        assert!(block.contains("SESSION TAPE — RESEARCH PLAYBACK · NOT A LIVE VENDOR FEED"));
        assert!(block.contains("Identity:    SPY · 2026-08-10 America/New_York"));
        assert!(block.contains("never live_massive"));
        assert!(block.contains("tape time ET\n") || block.contains("Clock:       tape time ET"));
        let block4 = standing_block("QQQ", "2026-08-10", 4);
        assert!(block4.contains("tape time ET · 4×"));
    }
}
