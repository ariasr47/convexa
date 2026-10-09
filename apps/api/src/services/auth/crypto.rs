//! Symmetric encrypt-at-rest for BYO API keys (AES-256-GCM).
//!
//! Secret: `AI_KEY_ENCRYPTION_KEY` (any passphrase → SHA-256 → key). Absent ⇒ ephemeral
//! per-process key (ciphertext resets on restart). Never logs plaintext or ciphertext.

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::OnceLock;
use tracing::info;

static EPHEMERAL: OnceLock<[u8; 32]> = OnceLock::new();
static EPHEMERAL_WARNING: OnceLock<()> = OnceLock::new();

pub fn warn_if_ephemeral() {
    if fallback_warning_required(
        std::env::var("APP_ENV").ok().as_deref(),
        std::env::var("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID")
            .ok()
            .as_deref(),
        std::env::var("AI_KEY_ENCRYPTION_KEY").ok().as_deref(),
    ) {
        EPHEMERAL_WARNING.get_or_init(|| tracing::warn!("Development fallback: the API-key encryption key is temporary; credentials encrypted with it may be unreadable after restart."));
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

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct KeyId(pub String);

#[derive(Clone)]
pub struct EncryptionKeyRing {
    pub active: KeyId,
    pub keys: BTreeMap<KeyId, [u8; 32]>,
    pub legacy: Option<[u8; 32]>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Decryption {
    Active(String),
    RewrapRequired {
        plaintext: String,
        source: RewrapSource,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RewrapSource {
    Retired,
    Legacy,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CryptoFailure {
    Malformed,
    UnknownKey,
    Authentication,
    Utf8,
    Encrypt,
}

impl CryptoFailure {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Malformed => "malformed",
            Self::UnknownKey => "unknown_key",
            Self::Authentication => "authentication",
            Self::Utf8 => "utf8",
            Self::Encrypt => "encrypt",
        }
    }
}

/// Extract only the non-secret addressed key id for value-free operational events.
pub fn envelope_key_id(envelope: &str) -> Option<&str> {
    let mut parts = envelope.split('.');
    match (parts.next(), parts.next()) {
        (Some("v1"), Some(id)) if !id.is_empty() && id.len() <= 32 => Some(id),
        _ => None,
    }
}

impl EncryptionKeyRing {
    pub fn from_env() -> Option<Self> {
        let active = std::env::var("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID").ok()?;
        let raw = std::env::var("AI_KEY_ENCRYPTION_KEYS_JSON").ok()?;
        let obj = serde_json::from_str::<serde_json::Value>(&raw)
            .ok()?
            .as_object()?
            .clone();
        let mut keys = BTreeMap::new();
        for (id, value) in obj {
            let bytes: [u8; 32] = URL_SAFE_NO_PAD
                .decode(value.as_str()?)
                .ok()?
                .try_into()
                .ok()?;
            keys.insert(KeyId(id), bytes);
        }
        let legacy = std::env::var("AI_KEY_ENCRYPTION_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .map(|s| {
                let mut out = [0u8; 32];
                out.copy_from_slice(&Sha256::digest(s.as_bytes()));
                out
            });
        Some(Self {
            active: KeyId(active),
            keys,
            legacy,
        })
    }
    pub fn encrypt(&self, plaintext: &str) -> Result<String, CryptoFailure> {
        use rand::RngCore;
        let key = self
            .keys
            .get(&self.active)
            .ok_or(CryptoFailure::UnknownKey)?;
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoFailure::Encrypt)?;
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        let aad = format!("v1.{}", self.active.0);
        let ct = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: plaintext.as_bytes(),
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| CryptoFailure::Encrypt)?;
        Ok(format!(
            "v1.{}.{}.{}",
            self.active.0,
            URL_SAFE_NO_PAD.encode(nonce),
            URL_SAFE_NO_PAD.encode(ct)
        ))
    }
    pub fn decrypt(&self, envelope: &str) -> Result<Decryption, CryptoFailure> {
        let p: Vec<_> = envelope.split('.').collect();
        if p.len() == 4 && p[0] == "v1" {
            let id = KeyId(p[1].into());
            let key = self.keys.get(&id).ok_or(CryptoFailure::UnknownKey)?;
            let nonce = URL_SAFE_NO_PAD
                .decode(p[2])
                .map_err(|_| CryptoFailure::Malformed)?;
            let ct = URL_SAFE_NO_PAD
                .decode(p[3])
                .map_err(|_| CryptoFailure::Malformed)?;
            if nonce.len() != 12 {
                return Err(CryptoFailure::Malformed);
            };
            let c = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoFailure::Authentication)?;
            let aad = format!("v1.{}", p[1]);
            let pt = c
                .decrypt(
                    Nonce::from_slice(&nonce),
                    Payload {
                        msg: &ct,
                        aad: aad.as_bytes(),
                    },
                )
                .map_err(|_| CryptoFailure::Authentication)?;
            let text = String::from_utf8(pt).map_err(|_| CryptoFailure::Utf8)?;
            return if id == self.active {
                Ok(Decryption::Active(text))
            } else {
                Ok(Decryption::RewrapRequired {
                    plaintext: text,
                    source: RewrapSource::Retired,
                })
            };
        }
        let key = self.legacy.as_ref().ok_or(CryptoFailure::UnknownKey)?;
        let packed = B64.decode(envelope).map_err(|_| CryptoFailure::Malformed)?;
        if packed.len() < 13 {
            return Err(CryptoFailure::Malformed);
        };
        let (n, ct) = packed.split_at(12);
        let c = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoFailure::Authentication)?;
        let pt = c
            .decrypt(Nonce::from_slice(n), ct)
            .map_err(|_| CryptoFailure::Authentication)?;
        Ok(Decryption::RewrapRequired {
            plaintext: String::from_utf8(pt).map_err(|_| CryptoFailure::Utf8)?,
            source: RewrapSource::Legacy,
        })
    }
}

fn key_bytes() -> [u8; 32] {
    if let Ok(secret) = std::env::var("AI_KEY_ENCRYPTION_KEY") {
        if !secret.trim().is_empty() {
            let mut out = [0u8; 32];
            out.copy_from_slice(&Sha256::digest(secret.as_bytes()));
            return out;
        }
    }
    *EPHEMERAL.get_or_init(|| {
        use rand::RngCore;
        let mut k = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut k);
        info!(
            "auth/crypto: no AI_KEY_ENCRYPTION_KEY; ephemeral per-process key \
             (encrypted AI keys reset on restart)"
        );
        k
    })
}

/// Encrypt plaintext → opaque base64 token (`nonce || ciphertext`).
pub fn encrypt(plaintext: &str) -> Result<String, String> {
    use rand::RngCore;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes()).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| "encrypt failed".to_string())?;
    let mut packed = Vec::with_capacity(12 + ct.len());
    packed.extend_from_slice(&nonce_bytes);
    packed.extend_from_slice(&ct);
    Ok(B64.encode(packed))
}

/// Decrypt token → plaintext, or None on any failure (treat as no usable key).
pub fn decrypt(token: &str) -> Option<String> {
    let packed = B64.decode(token).ok()?;
    if packed.len() < 13 {
        return None;
    }
    let (nonce_bytes, ct) = packed.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(&key_bytes()).ok()?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let pt = cipher.decrypt(nonce, ct).ok()?;
    String::from_utf8(pt).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        // Isolate test from env secret variance by using encrypt/decrypt same process.
        let tok = encrypt("sk-ant-test-secret-key").unwrap();
        assert_ne!(tok, "sk-ant-test-secret-key");
        assert_eq!(decrypt(&tok).as_deref(), Some("sk-ant-test-secret-key"));
        assert!(decrypt("not-valid").is_none());
    }

    #[test]
    fn versioned_envelope_authenticates_key_id_and_supports_rewrap() {
        let mut keys = BTreeMap::new();
        keys.insert(KeyId("active".into()), [1u8; 32]);
        keys.insert(KeyId("retired".into()), [2u8; 32]);
        let active = EncryptionKeyRing {
            active: KeyId("active".into()),
            keys: keys.clone(),
            legacy: None,
        };
        let envelope = active.encrypt("secret").unwrap();
        assert_eq!(
            active.decrypt(&envelope),
            Ok(Decryption::Active("secret".into()))
        );
        let retired = EncryptionKeyRing {
            active: KeyId("retired".into()),
            keys,
            legacy: None,
        };
        assert!(
            matches!(retired.decrypt(&envelope), Ok(Decryption::RewrapRequired { plaintext, .. }) if plaintext == "secret")
        );
        let tampered = envelope.replacen("active", "retired", 1);
        assert!(retired.decrypt(&tampered).is_err());
    }

    #[test]
    fn encryption_confidentiality_and_addressed_failure_matrix() {
        let active_id = KeyId("active".into());
        let other_id = KeyId("other".into());
        let ring = EncryptionKeyRing {
            active: active_id.clone(),
            keys: BTreeMap::from([(active_id, [21_u8; 32]), (other_id, [22_u8; 32])]),
            legacy: None,
        };
        let plaintext = "plaintext-canary-never-persist";
        let envelope = ring.encrypt(plaintext).unwrap();
        assert!(envelope.starts_with("v1.active."));
        assert_ne!(envelope, plaintext);
        assert!(!envelope.contains(plaintext));

        let parts: Vec<_> = envelope.split('.').collect();
        let tampered = [
            "not-an-envelope".to_string(),
            envelope.replacen("v1", "v2", 1),
            envelope.replacen("active", "unknown", 1),
            format!("v1.active.AA.{}", parts[3]),
            format!("v1.active.{}.AA", parts[2]),
        ];
        for value in tampered {
            assert!(ring.decrypt(&value).is_err(), "{value}");
        }
        assert_eq!(envelope_key_id(&envelope), Some("active"));
        assert_eq!(envelope_key_id(plaintext), None);
    }
}
