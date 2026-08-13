//! Auth leaf: sessions, password signup/login, settings, scan-view persistence.
//!
//! Never imported by quant scoring paths — score byte-identity stays intact.

mod cookies;
pub mod crypto;
pub mod google_oauth;
mod passwords;
pub mod risk;
mod service;
mod store;

pub use cookies::COOKIE_NAME;
pub use risk::{
    effective_dollar_cap, risk_inputs_wire, CapState, CapUnit, EffectiveDollarCap, PerTradeCap,
    RiskInputsState, RiskInputsWire,
};
pub use service::{
    auth_required, settings_auth_required, AuthConfig, AuthError, AuthService, IdentityShape,
    ResolvedSession, SettingsWire, CREDENTIAL_KIND_BROKER,
};
pub use store::{
    AuthStore, CredentialRecord, SessionRecord, SettingsPatch, SettingsRecord, UserRecord,
};
