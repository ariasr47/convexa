//! Closed pre-bind production construction contract.
pub mod archive;
pub mod config;
pub mod diagnostics;
pub mod origins;
pub mod preflight;
pub mod receipts;

pub use config::{
    classify_mode, BootstrapRefusal, BootstrapViolation, HostContext, KeyId, RawRuntimeConfig,
    RuntimeMode, ValidatedRuntimeConfig,
};

/// The owner gate's boot posture, logged on every `serve` (production included) and never a
/// refusal: the owner sets `OWNER_EMAILS` on the host, and until then every owner-only route
/// refuses every session (fail closed), which is safe. Only the count is logged, never an address.
pub fn log_owner_gate(config: &crate::config::Config) {
    let owner_count = config.owner_emails.len();
    if owner_count == 0 {
        tracing::warn!(
            owner_count,
            "owner gate: OWNER_EMAILS names no owner, so every owner-only route refuses every \
             session"
        );
        return;
    }
    tracing::info!(
        owner_count,
        "owner gate: OWNER_EMAILS configured; owner-only routes answer those accounts alone"
    );
    if config.auth_registration_open {
        tracing::warn!(
            owner_count,
            "owner gate: sign-ups are open, so an owner address nobody has registered yet could \
             be claimed by whoever signs up with it first"
        );
    }
}
