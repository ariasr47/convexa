//! Symmetric encrypt-at-rest for BYO API keys (AES-256-GCM).
//!
//! Secret: `AI_KEY_ENCRYPTION_KEY` (any passphrase → SHA-256 → key). Absent ⇒ ephemeral
//! per-process key (ciphertext resets on restart). Never logs plaintext or ciphertext.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;
use tracing::info;

static EPHEMERAL: OnceLock<[u8; 32]> = OnceLock::new();

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
}
