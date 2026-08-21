//! Signed HTTP-only session cookie (`gf_session` = `<sid>.<hmac>`).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

pub const COOKIE_NAME: &str = "gf_session";

type HmacSha256 = Hmac<Sha256>;

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
}
