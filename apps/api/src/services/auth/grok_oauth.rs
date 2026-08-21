//! Grok / SuperGrok **user subscription** OAuth — present-but-unavailable until
//! primary xAI user-OAuth docs/scopes are verified in-lane (SPEC §9 / AC-27).
//!
//! Do **not** invent protocol URLs or treat a Convexa `XAI_API_KEY` as enablement.

/// True only when verified docs + env creds exist. v1 ship: always false.
pub fn available() -> bool {
    // Intentionally false until primary xAI user-OAuth endpoints/scopes are verified
    // in-lane. Do not read invented env vars as a fake enablement.
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grok_oauth_arm_is_unavailable_until_docs_verify() {
        assert!(!available());
    }
}
