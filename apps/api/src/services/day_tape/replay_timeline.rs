//! Merge Path-A stamped records + Path-B marks into a walkable replay timeline.

use super::clocks::et_hms_to_ts_ns;
use super::store::{DayContainer, PathAKind, PathARecord};

#[derive(Debug, Clone)]
pub enum ReplayStep {
    EmitPathA(PathARecord),
    PulseGap {
        dropped: u64,
    },
    ApplyPathB {
        mark: (u32, u32),
        ts_ns: i64,
        body: Vec<u8>,
    },
}

#[derive(Clone)]
enum Stamped {
    PathA {
        rec: PathARecord,
        /// PathAGap records that immediately follow this stamp in Path-A vec order
        /// and sit before the next stamped Path-A neighbor.
        trailing_gaps: Vec<u64>,
    },
    PathB {
        mark: (u32, u32),
        ts_ns: i64,
        body: Vec<u8>,
    },
}

impl Stamped {
    fn ts_ns(&self) -> i64 {
        match self {
            Self::PathA { rec, .. } => rec.ts_ns.unwrap_or(0),
            Self::PathB { ts_ns, .. } => *ts_ns,
        }
    }
}

pub fn build_timeline(day: &DayContainer, et_date: &str) -> Vec<ReplayStep> {
    let mut path_a_stamped: Vec<(PathARecord, Vec<u64>)> = Vec::new();
    let mut i = 0;
    while i < day.path_a.len() {
        let rec = &day.path_a[i];
        match rec.kind {
            PathAKind::Trade | PathAKind::Quote if rec.ts_ns.is_some() => {
                let stamped = rec.clone();
                i += 1;
                let mut gaps = Vec::new();
                while i < day.path_a.len() && day.path_a[i].kind == PathAKind::PathAGap {
                    gaps.push(day.path_a[i].dropped.unwrap_or(0));
                    i += 1;
                }
                path_a_stamped.push((stamped, gaps));
            }
            _ => {
                // Leading / unstamped / orphan gaps are not timeline occupants.
                i += 1;
            }
        }
    }
    // Gaps pulse only between stamped Path-A neighbors.
    if let Some((_, gaps)) = path_a_stamped.last_mut() {
        gaps.clear();
    }

    let mut stamped: Vec<Stamped> = path_a_stamped
        .into_iter()
        .map(|(rec, trailing_gaps)| Stamped::PathA { rec, trailing_gaps })
        .collect();

    for snap in &day.path_b {
        let Some(ts_ns) = et_hms_to_ts_ns(et_date, snap.mark.0, snap.mark.1, 0) else {
            continue;
        };
        stamped.push(Stamped::PathB {
            mark: snap.mark,
            ts_ns,
            body: snap.body.clone(),
        });
    }

    stamped.sort_by_key(|s| s.ts_ns());

    let mut out = Vec::with_capacity(stamped.len());
    for item in stamped {
        match item {
            Stamped::PathA { rec, trailing_gaps } => {
                out.push(ReplayStep::EmitPathA(rec));
                for dropped in trailing_gaps {
                    out.push(ReplayStep::PulseGap { dropped });
                }
            }
            Stamped::PathB { mark, ts_ns, body } => {
                out.push(ReplayStep::ApplyPathB { mark, ts_ns, body });
            }
        }
    }
    out
}

pub fn decode_path_b_body(
    body: &[u8],
) -> Result<crate::services::market_data::VendorBundle, String> {
    if crate::services::day_tape::body_carries_live_massive(body) {
        return Err("path-b body carries LiveMassive".into());
    }
    let mut v: serde_json::Value = serde_json::from_slice(body).map_err(|e| e.to_string())?;
    if let Some(obj) = v.as_object_mut() {
        obj.insert("source".into(), serde_json::json!("session_tape"));
    }
    let wire: crate::services::chain_snapshot::ChainSnapshotWire =
        serde_json::from_value(v).map_err(|e| e.to_string())?;
    let mut bundle = crate::services::chain_snapshot::to_vendor_bundle(wire);
    bundle.source = crate::services::market_data::MarketDataSourceKind::SessionTape;
    Ok(bundle)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::{fixture_probe_bundle, serialize_capture, to_wire};
    use crate::services::day_tape::clocks::{et_hms_to_ts_ns, path_b_marks};
    use crate::services::day_tape::fs::prepare_path_b_body;
    use crate::services::day_tape::store::{PathAKind, PathARecord, PathBSnapshot};
    use crate::services::market_data::MarketDataSourceKind;
    use chrono::{TimeZone, Utc};
    use chrono_tz::America::New_York;

    const ET: &str = "2026-08-10";

    fn ts(h: u32, m: u32, s: u32) -> i64 {
        et_hms_to_ts_ns(ET, h, m, s).expect("et stamp")
    }

    fn empty_day() -> DayContainer {
        DayContainer::default()
    }

    #[test]
    fn both_empty_timeline_has_no_occupant() {
        let steps = build_timeline(&empty_day(), ET);
        assert!(steps.is_empty());
    }

    #[test]
    fn timeline_starts_at_earliest_occupant_and_does_not_invent_0400() {
        let mut day = empty_day();
        day.path_a
            .push(PathARecord::trade(ts(10, 0, 0), 100.0, None));
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: New_York
                .with_ymd_and_hms(2026, 8, 10, 9, 30, 0)
                .single()
                .unwrap()
                .with_timezone(&Utc),
            body: b"{}".to_vec(),
        });
        let steps = build_timeline(&day, ET);
        assert!(!steps.is_empty());
        match &steps[0] {
            ReplayStep::ApplyPathB { mark, ts_ns, .. } => {
                assert_eq!(*mark, (9, 30));
                assert_eq!(*ts_ns, ts(9, 30, 0));
            }
            other => panic!("earliest occupant must be Path-B 09:30, got {other:?}"),
        }
        let invented_0400 = ts(4, 0, 0);
        assert!(
            steps.iter().all(|s| match s {
                ReplayStep::EmitPathA(r) => r.ts_ns != Some(invented_0400),
                ReplayStep::ApplyPathB { ts_ns, .. } => *ts_ns != invented_0400,
                ReplayStep::PulseGap { .. } => true,
            }),
            "must not invent 04:00"
        );
    }

    #[test]
    fn timeline_merges_path_b_marks_onto_et_date_and_sorts_stamped() {
        let mut day = empty_day();
        day.path_a
            .push(PathARecord::trade(ts(9, 35, 0), 101.0, None));
        day.path_a.push(PathARecord::quote(
            ts(9, 40, 0),
            Some(100.0),
            Some(100.1),
            None,
            None,
        ));
        day.path_b.push(PathBSnapshot {
            mark: (9, 40),
            as_of: Utc::now(),
            body: b"{\"m\":40}".to_vec(),
        });
        day.path_b.push(PathBSnapshot {
            mark: (9, 30),
            as_of: Utc::now(),
            body: b"{\"m\":30}".to_vec(),
        });
        let steps = build_timeline(&day, ET);
        let stamped: Vec<_> = steps
            .iter()
            .filter_map(|s| match s {
                ReplayStep::EmitPathA(r) => r.ts_ns,
                ReplayStep::ApplyPathB { ts_ns, .. } => Some(*ts_ns),
                ReplayStep::PulseGap { .. } => None,
            })
            .collect();
        assert_eq!(
            stamped,
            vec![ts(9, 30, 0), ts(9, 35, 0), ts(9, 40, 0), ts(9, 40, 0)]
        );
        assert!(path_b_marks().contains(&(9, 30)));
        assert!(path_b_marks().contains(&(9, 40)));
    }

    #[test]
    fn path_a_gap_stays_in_vec_order_between_stamped_neighbors() {
        let mut day = empty_day();
        day.path_a
            .push(PathARecord::trade(ts(10, 0, 0), 100.0, None));
        day.path_a.push(PathARecord::gap(3));
        day.path_a
            .push(PathARecord::trade(ts(10, 0, 5), 100.5, None));
        let steps = build_timeline(&day, ET);
        assert_eq!(steps.len(), 3);
        match &steps[0] {
            ReplayStep::EmitPathA(r) => {
                assert_eq!(r.kind, PathAKind::Trade);
                assert_eq!(r.ts_ns, Some(ts(10, 0, 0)));
            }
            other => panic!("expected first trade, got {other:?}"),
        }
        match &steps[1] {
            ReplayStep::PulseGap { dropped } => assert_eq!(*dropped, 3),
            other => panic!("gap must sit between stamped neighbors, got {other:?}"),
        }
        match &steps[2] {
            ReplayStep::EmitPathA(r) => {
                assert_eq!(r.ts_ns, Some(ts(10, 0, 5)));
            }
            other => panic!("expected second trade, got {other:?}"),
        }
    }

    #[test]
    fn decode_path_b_body_sets_session_tape_never_live_massive_or_fixture() {
        let as_of = New_York
            .with_ymd_and_hms(2026, 8, 10, 9, 30, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let mut bundle = fixture_probe_bundle("SPY", as_of);
        bundle.source = MarketDataSourceKind::LiveMassive;
        let wire = to_wire(&bundle);
        let raw = serialize_capture(&wire).unwrap();
        let stripped = prepare_path_b_body(&raw).unwrap();
        assert!(!crate::services::day_tape::body_carries_live_massive(
            &stripped
        ));
        let decoded = decode_path_b_body(&stripped).expect("decode stripped path-b");
        assert_eq!(decoded.source, MarketDataSourceKind::SessionTape);
        assert_ne!(decoded.source, MarketDataSourceKind::LiveMassive);
        assert_ne!(decoded.source, MarketDataSourceKind::Fixture);

        let poisoned = serde_json::to_vec(&serde_json::json!({
            "symbol": "SPY",
            "as_of": "2026-08-10T13:30:00.000000000Z",
            "source": "live_massive",
            "market": wire.market,
            "daily_bars": [],
            "minutes": [],
            "trades": []
        }))
        .unwrap();
        let err = decode_path_b_body(&poisoned).unwrap_err();
        assert!(
            err.contains("LiveMassive") || err.to_ascii_lowercase().contains("live_massive"),
            "{err}"
        );
    }
}
