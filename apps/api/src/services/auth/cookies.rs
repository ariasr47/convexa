//! Signed HTTP-only session cookie (`gf_session` = `<sid>.<hmac>`).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::collections::BTreeMap;

pub const COOKIE_NAME: &str = "gf_session";
static EPHEMERAL_WARNING: std::sync::OnceLock<()> = std::sync::OnceLock::new();

pub fn warn_if_ephemeral() {
    if fallback_warning_required(
        std::env::var("APP_ENV").ok().as_deref(),
        std::env::var("AUTH_SESSION_ACTIVE_KEY_ID").ok().as_deref(),
        std::env::var("AUTH_SESSION_SIGNING_KEY").ok().as_deref(),
    ) {
        EPHEMERAL_WARNING.get_or_init(|| tracing::warn!("Development fallback: the session-signing key is temporary and changes when this process restarts."));
    }
}

fn fallback_warning_required(
    mode: Option<&str>,
    active: Option<&str>,
    stable: Option<&str>,
) -> bool {
    mode != Some("prod")
        && active.is_none_or(|value| value.trim().is_empty())
        && stable.is_none_or(|value| value.trim().is_empty())
}

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct KeyId(pub String);

#[derive(Clone)]
pub struct SigningKeyRing {
    pub active: KeyId,
    pub keys: BTreeMap<KeyId, [u8; 32]>,
    pub legacy: Option<Vec<u8>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CookieVerification {
    Valid { session_id: String },
    Anonymous,
}

impl SigningKeyRing {
    pub fn from_env() -> Option<Self> {
        let active = std::env::var("AUTH_SESSION_ACTIVE_KEY_ID").ok()?;
        let raw = std::env::var("AUTH_SESSION_KEYS_JSON").ok()?;
        let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
        let obj = value.as_object()?;
        let mut keys = BTreeMap::new();
        for (id, value) in obj {
            let bytes = URL_SAFE_NO_PAD.decode(value.as_str()?).ok()?;
            let key: [u8; 32] = bytes.try_into().ok()?;
            keys.insert(KeyId(id.clone()), key);
        }
        Some(Self {
            active: KeyId(active),
            keys,
            legacy: std::env::var("AUTH_SESSION_SIGNING_KEY")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .map(String::into_bytes),
        })
    }
    pub fn sign(&self, session_id: &str) -> String {
        let kid = &self.active.0;
        let mut mac = HmacSha256::new_from_slice(self.keys.get(&self.active).expect("active key"))
            .expect("hmac");
        mac.update(format!("v1.{kid}.{session_id}").as_bytes());
        format!(
            "v1.{kid}.{session_id}.{}",
            URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
        )
    }
    pub fn verify(&self, value: Option<&str>) -> CookieVerification {
        let Some(value) = value else {
            return CookieVerification::Anonymous;
        };
        let p: Vec<_> = value.split('.').collect();
        if p.len() == 4 && p[0] == "v1" {
            let Some(key) = self.keys.get(&KeyId(p[1].to_string())) else {
                return CookieVerification::Anonymous;
            };
            let mut mac = HmacSha256::new_from_slice(key).expect("hmac");
            mac.update(format!("v1.{}.{}", p[1], p[2]).as_bytes());
            let Ok(sig) = URL_SAFE_NO_PAD.decode(p[3]) else {
                return CookieVerification::Anonymous;
            };
            if mac.verify_slice(&sig).is_ok() && !p[2].is_empty() {
                return CookieVerification::Valid {
                    session_id: p[2].to_string(),
                };
            }
            return CookieVerification::Anonymous;
        }
        let (sid, sig) = value.rsplit_once('.').unwrap_or(("", ""));
        let Some(key) = self.legacy.as_ref() else {
            return CookieVerification::Anonymous;
        };
        let mut mac = HmacSha256::new_from_slice(key).expect("hmac");
        mac.update(sid.as_bytes());
        let Ok(sig) = URL_SAFE_NO_PAD.decode(sig) else {
            return CookieVerification::Anonymous;
        };
        if !sid.is_empty() && mac.verify_slice(&sig).is_ok() {
            CookieVerification::Valid {
                session_id: sid.to_string(),
            }
        } else {
            CookieVerification::Anonymous
        }
    }
}

pub fn new_session_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn sign(session_id: &str, signing_key: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(signing_key.as_bytes()).expect("HMAC accepts any key length");
    mac.update(session_id.as_bytes());
    URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
}

pub fn sign_cookie(session_id: &str, signing_key: &str) -> String {
    format!("{session_id}.{}", sign(session_id, signing_key))
}

/// Verify signature; return session id or None on tamper/format failure.
pub fn unsign_cookie(value: Option<&str>, signing_key: &str) -> Option<String> {
    let value = value?;
    let (sid, sig) = value.rsplit_once('.')?;
    if sid.is_empty() || sig.is_empty() {
        return None;
    }
    let expected = sign(sid, signing_key);
    // Constant-time compare via hmac's subtle path: re-verify digest equality on decoded bytes.
    if !constant_time_eq(sig.as_bytes(), expected.as_bytes()) {
        return None;
    }
    Some(sid.to_string())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_sign() {
        let sid = new_session_id();
        let cookie = sign_cookie(&sid, "test-key");
        assert_eq!(
            unsign_cookie(Some(&cookie), "test-key").as_deref(),
            Some(sid.as_str())
        );
        assert!(unsign_cookie(Some(&cookie), "wrong").is_none());
        assert!(unsign_cookie(Some("garbage"), "test-key").is_none());
    }

    #[test]
    fn addressed_ring_does_not_try_a_different_key() {
        let mut keys = BTreeMap::new();
        keys.insert(KeyId("active".into()), [1u8; 32]);
        keys.insert(KeyId("retired".into()), [2u8; 32]);
        let ring = SigningKeyRing {
            active: KeyId("active".into()),
            keys,
            legacy: None,
        };
        let cookie = ring.sign("sid");
        assert_eq!(
            ring.verify(Some(&cookie)),
            CookieVerification::Valid {
                session_id: "sid".into()
            }
        );
        let poisoned = cookie.replacen("active", "retired", 1);
        assert_eq!(ring.verify(Some(&poisoned)), CookieVerification::Anonymous);
    }

    #[test]
    fn signing_rotation_matrix_keeps_retained_and_legacy_only_when_addressed() {
        let old_id = KeyId("old".into());
        let new_id = KeyId("new".into());
        let keys = BTreeMap::from([(old_id.clone(), [1_u8; 32]), (new_id.clone(), [2_u8; 32])]);
        let old_writer = SigningKeyRing {
            active: old_id.clone(),
            keys: keys.clone(),
            legacy: Some(b"legacy-signing".to_vec()),
        };
        let retained_cookie = old_writer.sign("retained-session");
        let legacy_cookie = sign_cookie("legacy-session", "legacy-signing");

        let overlap = SigningKeyRing {
            active: new_id.clone(),
            keys: keys.clone(),
            legacy: Some(b"legacy-signing".to_vec()),
        };
        assert!(overlap.sign("new-session").starts_with("v1.new."));
        assert!(matches!(
            overlap.verify(Some(&retained_cookie)),
            CookieVerification::Valid { session_id } if session_id == "retained-session"
        ));
        assert!(matches!(
            overlap.verify(Some(&legacy_cookie)),
            CookieVerification::Valid { session_id } if session_id == "legacy-session"
        ));

        let removed = SigningKeyRing {
            active: new_id.clone(),
            keys: BTreeMap::from([(new_id, [2_u8; 32])]),
            legacy: None,
        };
        assert_eq!(
            removed.verify(Some(&retained_cookie)),
            CookieVerification::Anonymous
        );
        assert_eq!(
            removed.verify(Some(&legacy_cookie)),
            CookieVerification::Anonymous
        );
        for malformed in [
            "v1.unknown.sid.signature",
            "v1.new.sid.not-base64!",
            "v1.new..AAAA",
            "v2.new.sid.AAAA",
        ] {
            assert_eq!(
                removed.verify(Some(malformed)),
                CookieVerification::Anonymous
            );
        }
    }
}
