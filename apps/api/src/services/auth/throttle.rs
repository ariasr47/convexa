//! Per-account login throttle: slow repeated guessing down without ever locking the owner out.
//!
//! The first `FREE_ATTEMPTS` attempts for an email inside `WINDOW_SECS` go through. After that the
//! account takes at most one attempt per `SLOW_INTERVAL_SECS` until `WINDOW_SECS` pass with no
//! failure. A successful login clears the record. Every attempt is charged *before* the password is
//! checked, under one lock, so concurrent requests cannot slip extra guesses into the same instant,
//! and a refused attempt costs no password hashing.
//!
//! Keyed by the normalized email, not the client IP: the client IP arrives in a header the caller
//! can set, so only the account being attacked is a key an attacker cannot rotate. Unknown emails
//! are throttled exactly like real ones, so the response never reveals whether an account exists.
//! Process-local (per replica), like the public rate limiter.

use std::collections::HashMap;
use std::sync::Mutex;

pub const FREE_ATTEMPTS: u32 = 5;
pub const WINDOW_SECS: f64 = 15.0 * 60.0;
pub const SLOW_INTERVAL_SECS: f64 = 60.0;
const PRUNE_ABOVE: usize = 10_000;

#[derive(Debug)]
struct Charged {
    /// Attempts charged since the window opened (successes are refunded by clearing the record).
    attempts: u32,
    /// When the latest attempt was charged.
    last: f64,
}

#[derive(Debug, Default)]
pub struct LoginThrottle {
    inner: Mutex<HashMap<String, Charged>>,
}

impl LoginThrottle {
    /// Charge one attempt for `email` at `now` (seconds). `Err(seconds)` means refuse it and
    /// retry after that many whole seconds.
    pub fn begin(&self, email: &str, now: f64) -> Result<(), u64> {
        let key = email.trim().to_ascii_lowercase();
        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        if guard.len() > PRUNE_ABOVE {
            guard.retain(|_, c| now - c.last < WINDOW_SECS);
        }
        let charged = guard.entry(key).or_insert(Charged {
            attempts: 0,
            last: now,
        });
        if now - charged.last >= WINDOW_SECS {
            charged.attempts = 0;
        }
        if charged.attempts >= FREE_ATTEMPTS {
            let wait = SLOW_INTERVAL_SECS - (now - charged.last);
            if wait > 0.0 {
                return Err(wait.ceil().max(1.0) as u64);
            }
        }
        charged.attempts += 1;
        charged.last = now;
        Ok(())
    }

    /// A correct password: forget this account's charged attempts.
    pub fn succeed(&self, email: &str) {
        let key = email.trim().to_ascii_lowercase();
        let mut guard = self.inner.lock().unwrap_or_else(|p| p.into_inner());
        guard.remove(&key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn after_five_failures_the_account_gets_one_attempt_per_minute() {
        let t = LoginThrottle::default();
        for i in 0..FREE_ATTEMPTS {
            assert_eq!(
                t.begin("a@b.co", 1000.0 + f64::from(i)),
                Ok(()),
                "free attempt {i}"
            );
        }
        // Last free attempt was charged at t=1004.
        assert_eq!(t.begin("a@b.co", 1005.0), Err(59));
        assert_eq!(t.begin("A@B.co ", 1063.5), Err(1), "email is normalized");
        assert_eq!(
            t.begin("a@b.co", 1064.0),
            Ok(()),
            "one attempt after the interval"
        );
        assert_eq!(t.begin("a@b.co", 1064.0), Err(60), "and only one");
        assert_eq!(
            t.begin("other@b.co", 1064.0),
            Ok(()),
            "other accounts are unaffected"
        );
    }

    #[test]
    fn a_quiet_window_or_a_success_resets_the_account() {
        let t = LoginThrottle::default();
        for i in 0..FREE_ATTEMPTS {
            t.begin("a@b.co", f64::from(i)).unwrap();
        }
        assert!(t.begin("a@b.co", 10.0).is_err());
        // 15 minutes after the last charged attempt, the free attempts are back.
        for i in 0..FREE_ATTEMPTS {
            assert_eq!(t.begin("a@b.co", 4.0 + WINDOW_SECS + f64::from(i)), Ok(()));
        }
        t.succeed("a@b.co");
        assert_eq!(
            t.begin("a@b.co", 4.0 + WINDOW_SECS + 5.0),
            Ok(()),
            "success clears"
        );
    }
}
