//! Argon2 password hashing (never store/log plaintext).

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::rngs::OsRng;

/// Hash plaintext with argon2 (salt embedded).
pub fn hash_password(plaintext: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon = Argon2::default();
    argon
        .hash_password(plaintext.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

/// Verify password. When `stored_hash` is None, still run a dummy verify (non-enumerating timing).
pub fn verify_password(plaintext: &str, stored_hash: Option<&str>) -> bool {
    static DUMMY: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let dummy = DUMMY.get_or_init(|| {
        hash_password("argon2-dummy-verify-target-not-a-real-password")
            .expect("dummy hash")
    });
    let target = stored_hash.unwrap_or(dummy.as_str());
    let parsed = match PasswordHash::new(target) {
        Ok(p) => p,
        Err(_) => return false,
    };
    let ok = Argon2::default()
        .verify_password(plaintext.as_bytes(), &parsed)
        .is_ok();
    ok && stored_hash.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify() {
        let h = hash_password("s3cret-pass").unwrap();
        assert!(verify_password("s3cret-pass", Some(&h)));
        assert!(!verify_password("wrong", Some(&h)));
        assert!(!verify_password("s3cret-pass", None));
    }
}
