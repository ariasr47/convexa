//! Per-user broker book cache + attempt/throttle semantics (Python `BrokerBookService`).

use super::{
    BrokerBook, BrokerCredential, BrokerPosition, PositionsProvider, REASON_NO_CREDENTIAL,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_TTL: f64 = 60.0;
const DEFAULT_STALE_AFTER: i64 = 300;
const DEFAULT_MIN_INTERVAL: f64 = 15.0;

fn now() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn iso(ts: f64) -> String {
    chrono::DateTime::from_timestamp(ts as i64, 0)
        .map(|d| d.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".into())
}

#[derive(Clone)]
struct Snapshot {
    state: String,
    positions: Vec<BrokerPosition>,
    account_ref: Option<String>,
    as_of: String,
    fetched_at: f64,
}

#[derive(Default)]
struct UserState {
    snapshot: Option<Snapshot>,
    last_attempt_ts: Option<f64>,
    last_attempt_outcome: Option<String>,
    in_flight: bool,
    invalidated: bool,
}

impl UserState {
    fn has_anything(&self) -> bool {
        self.snapshot.is_some() || self.last_attempt_ts.is_some()
    }
}

/// Credential resolution from the auth leaf.
pub enum CredResolution {
    Ok(BrokerCredential),
    None,
    Unreadable,
}

#[derive(Clone)]
pub struct BrokerBookService {
    provider: Arc<dyn PositionsProvider>,
    ttl: f64,
    stale_after: i64,
    min_interval: f64,
    users: Arc<Mutex<HashMap<String, UserState>>>,
}

impl BrokerBookService {
    pub fn new(provider: Arc<dyn PositionsProvider>) -> Self {
        let ttl = std::env::var("BROKER_BOOK_TTL_SECONDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_TTL);
        let stale_after = std::env::var("BROKER_STALE_AFTER_SECONDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_STALE_AFTER);
        let min_interval = std::env::var("BROKER_REFRESH_MIN_INTERVAL_SECONDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_MIN_INTERVAL);
        Self {
            provider,
            ttl,
            stale_after,
            min_interval,
            users: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn invalidate(&self, user_id: &str) {
        let mut g = self.users.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(st) = g.get_mut(user_id) {
            st.invalidated = true;
            st.snapshot = None;
            st.last_attempt_ts = None;
            st.last_attempt_outcome = None;
            st.in_flight = false;
        }
        g.remove(user_id);
    }

    pub fn get_book(&self, user_id: &str, resolution: CredResolution) -> BrokerBook {
        self.serve(user_id, resolution, false)
    }

    pub fn refresh_book(&self, user_id: &str, resolution: CredResolution) -> BrokerBook {
        self.serve(user_id, resolution, true)
    }

    fn serve(&self, user_id: &str, resolution: CredResolution, force: bool) -> BrokerBook {
        match resolution {
            CredResolution::None => {
                return BrokerBook {
                    state: "unknown".into(),
                    reason: Some(REASON_NO_CREDENTIAL.into()),
                    as_of: None,
                    basis: None,
                    stale_after_seconds: None,
                    account_ref: None,
                    positions: vec![],
                    last_attempt_at: None,
                    last_attempt_outcome: None,
                };
            }
            CredResolution::Unreadable => {
                let mut g = self.users.lock().unwrap_or_else(|e| e.into_inner());
                let st = g.entry(user_id.to_string()).or_default();
                st.last_attempt_ts = Some(now());
                st.last_attempt_outcome = Some("credential_unreadable".into());
                return self.assemble(st, "cache", Some("credential_unreadable"));
            }
            CredResolution::Ok(cred) => {
                // Decision under lock
                let (should_fetch, prior_ref) = {
                    let mut g = self.users.lock().unwrap_or_else(|e| e.into_inner());
                    let st = g.entry(user_id.to_string()).or_default();
                    let t = now();
                    if !force {
                        if let Some(snap) = &st.snapshot {
                            if (t - snap.fetched_at) < self.ttl {
                                return self.assemble(st, "cache", None);
                            }
                        }
                    }
                    if let Some(last) = st.last_attempt_ts {
                        if (t - last) < self.min_interval {
                            return self.assemble(st, "cache", None);
                        }
                    }
                    if st.in_flight {
                        if st.has_anything() {
                            return self.assemble(st, "cache", None);
                        }
                        // Cold: fall through and still try (simple vs Python wait)
                    }
                    st.in_flight = true;
                    let pref = st.snapshot.as_ref().and_then(|s| s.account_ref.clone());
                    (true, pref)
                };

                if !should_fetch {
                    return BrokerBook {
                        state: "unknown".into(),
                        reason: Some("adapter_fault".into()),
                        as_of: None,
                        basis: None,
                        stale_after_seconds: None,
                        account_ref: None,
                        positions: vec![],
                        last_attempt_at: None,
                        last_attempt_outcome: None,
                    };
                }

                let fetched = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    self.provider.fetch_book(&cred, prior_ref.as_deref())
                }))
                .ok();

                let mut g = self.users.lock().unwrap_or_else(|e| e.into_inner());
                let st = g.entry(user_id.to_string()).or_default();
                st.in_flight = false;
                if st.invalidated {
                    return BrokerBook {
                        state: "unknown".into(),
                        reason: Some(REASON_NO_CREDENTIAL.into()),
                        as_of: None,
                        basis: None,
                        stale_after_seconds: None,
                        account_ref: None,
                        positions: vec![],
                        last_attempt_at: None,
                        last_attempt_outcome: None,
                    };
                }
                let t = now();
                st.last_attempt_ts = Some(t);
                match fetched {
                    Some(book) if book.state == "ok" || book.state == "empty" => {
                        st.last_attempt_outcome = Some("ok".into());
                        st.snapshot = Some(Snapshot {
                            state: book.state.clone(),
                            positions: book.positions.clone(),
                            account_ref: book.account_ref.clone(),
                            as_of: iso(t),
                            fetched_at: t,
                        });
                        self.assemble(st, "fresh", None)
                    }
                    Some(book) => {
                        let cause = book
                            .reason
                            .filter(|r| {
                                matches!(
                                    r.as_str(),
                                    "broker_unreachable"
                                        | "rate_limited"
                                        | "credential_rejected"
                                        | "credential_unreadable"
                                        | "adapter_fault"
                                )
                            })
                            .unwrap_or_else(|| "adapter_fault".into());
                        st.last_attempt_outcome = Some(cause.clone());
                        self.assemble(st, "cache", Some(&cause))
                    }
                    None => {
                        st.last_attempt_outcome = Some("adapter_fault".into());
                        self.assemble(st, "cache", Some("adapter_fault"))
                    }
                }
            }
        }
    }

    fn assemble(&self, st: &UserState, basis: &str, fallback_reason: Option<&str>) -> BrokerBook {
        let last_at = st.last_attempt_ts.map(iso);
        let outcome = if last_at.is_some() {
            st.last_attempt_outcome.clone()
        } else {
            None
        };
        if let Some(snap) = &st.snapshot {
            return BrokerBook {
                state: snap.state.clone(),
                reason: None,
                as_of: Some(snap.as_of.clone()),
                basis: Some(basis.into()),
                stale_after_seconds: Some(self.stale_after),
                account_ref: snap.account_ref.clone(),
                positions: snap.positions.clone(),
                last_attempt_at: last_at,
                last_attempt_outcome: outcome,
            };
        }
        let reason = fallback_reason
            .map(|s| s.to_string())
            .or_else(|| outcome.clone())
            .unwrap_or_else(|| "adapter_fault".into());
        BrokerBook {
            state: "unknown".into(),
            reason: Some(reason),
            as_of: None,
            basis: None,
            stale_after_seconds: None,
            account_ref: None,
            positions: vec![],
            last_attempt_at: last_at,
            last_attempt_outcome: outcome,
        }
    }
}
