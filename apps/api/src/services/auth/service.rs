//! Auth orchestration: signup / login / logout / session / settings.

use super::cookies::{self, COOKIE_NAME};
use super::passwords;
use super::store::{AuthStore, SessionRecord, SettingsPatch, SettingsRecord, UserRecord};
use base64::Engine;
use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;
use tracing::warn;

pub const PASSWORD_MIN_LENGTH: usize = 8;

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub signing_key: String,
    pub session_idle_secs: f64,
    pub session_absolute_secs: f64,
    pub cookie_secure: bool,
    pub cookie_samesite: String,
    /// When false, signup returns signups_closed (private testing lockdown).
    pub registration_open: bool,
    pub password_min_length: usize,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            signing_key: String::new(),
            session_idle_secs: 7.0 * 24.0 * 3600.0,
            session_absolute_secs: 30.0 * 24.0 * 3600.0,
            cookie_secure: true,
            cookie_samesite: "lax".into(),
            registration_open: false,
            password_min_length: PASSWORD_MIN_LENGTH,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedSession {
    pub user: Option<UserRecord>,
    pub session_id: Option<String>,
}

impl ResolvedSession {
    pub fn authenticated(&self) -> bool {
        self.user.is_some()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SettingsWire {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: String,
    /// tradeable-rec-inputs B9: always present for a resolved session (INTERFACE §4).
    pub risk_inputs: super::risk::RiskInputsWire,
}

impl SettingsWire {
    fn from_record(s: &SettingsRecord, storage_available: bool) -> Self {
        Self {
            active_persona_id: s.active_persona_id.clone(),
            default_ticker: s.default_ticker.clone(),
            theme: s.theme.clone(),
            risk_inputs: super::risk::risk_inputs_wire(
                s.risk_account_size,
                s.risk_cap_value,
                s.risk_cap_unit.as_deref(),
                s.risk_updated_at,
                storage_available,
            ),
        }
    }
}

impl From<&SettingsRecord> for SettingsWire {
    fn from(s: &SettingsRecord) -> Self {
        // `storage_available` mirrors the store's health; a successful read off either adapter
        // means storage IS available (a JSON adapter with a writable path, or a live PG pool).
        Self::from_record(s, true)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct IdentityUser {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub auth_methods: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IdentityShape {
    pub authenticated: bool,
    pub user: Option<IdentityUser>,
    pub google_available: bool,
    pub settings: Option<SettingsWire>,
    pub demo_seed: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct AuthError {
    pub status: u16,
    pub code: &'static str,
    pub message: String,
}

impl AuthError {
    pub fn envelope(&self) -> serde_json::Value {
        serde_json::json!({ "error": self.code, "message": self.message })
    }
}

fn email_taken() -> AuthError {
    AuthError {
        status: 409,
        code: "email_taken",
        message: "An account with that email already exists.".into(),
    }
}
pub fn validation(msg: impl Into<String>) -> AuthError {
    AuthError {
        status: 422,
        code: "validation",
        message: msg.into(),
    }
}
fn bad_credentials() -> AuthError {
    AuthError {
        status: 401,
        code: "bad_credentials",
        message: "Incorrect email or password.".into(),
    }
}
pub fn auth_required() -> AuthError {
    AuthError {
        status: 403,
        code: "auth_required",
        message: "Sign in to do this.".into(),
    }
}
pub fn settings_auth_required() -> AuthError {
    AuthError {
        status: 401,
        code: "auth_required",
        message: "Sign in to access settings.".into(),
    }
}
fn signups_closed() -> AuthError {
    AuthError {
        status: 403,
        code: "signups_closed",
        message: "New sign-ups are closed right now.".into(),
    }
}
fn auth_unavailable() -> AuthError {
    AuthError {
        status: 503,
        code: "auth_unavailable",
        message: "Sign-in is temporarily unavailable.".into(),
    }
}
fn google_unavailable() -> AuthError {
    AuthError {
        status: 409,
        code: "google_unavailable",
        message: "Google sign-in is not configured on this server.".into(),
    }
}

pub const CREDENTIAL_KIND_BROKER: &str = "broker_webull";

#[derive(Clone)]
pub struct AuthService {
    store: AuthStore,
    cfg: AuthConfig,
    demo_seed_email: Option<String>,
    /// Best-effort: drop broker book cache when credential rotates/deletes.
    broker_cache_invalidator: Option<std::sync::Arc<dyn Fn(&str) + Send + Sync>>,
}

impl AuthService {
    pub fn new(store: AuthStore, cfg: AuthConfig) -> Self {
        Self {
            store,
            cfg,
            demo_seed_email: None,
            broker_cache_invalidator: None,
        }
    }

    pub fn set_broker_cache_invalidator(
        &mut self,
        f: std::sync::Arc<dyn Fn(&str) + Send + Sync>,
    ) {
        self.broker_cache_invalidator = Some(f);
    }

    fn invalidate_broker_cache(&self, user_id: &str) {
        if let Some(f) = &self.broker_cache_invalidator {
            f(user_id);
        }
    }

    fn google_available_flag(&self) -> bool {
        super::google_oauth::available()
    }

    pub fn cookie_name(&self) -> &'static str {
        COOKIE_NAME
    }

    pub fn cookie_secure(&self) -> bool {
        self.cfg.cookie_secure
    }

    pub fn cookie_samesite(&self) -> &str {
        &self.cfg.cookie_samesite
    }

    pub fn set_demo_seed_hint(&mut self, email: impl Into<String>) {
        let e = email.into();
        self.demo_seed_email = if e.trim().is_empty() {
            None
        } else {
            Some(e)
        };
    }

    pub fn signed_cookie_value(&self, session_id: &str) -> String {
        cookies::sign_cookie(session_id, &self.cfg.signing_key)
    }

    fn identity(&self, user: Option<&UserRecord>) -> IdentityShape {
        let demo_seed = self
            .demo_seed_email
            .as_ref()
            .map(|e| serde_json::json!({ "email": e }));
        match user {
            None => IdentityShape {
                authenticated: false,
                user: None,
                google_available: self.google_available_flag(),
                settings: None,
                demo_seed,
            },
            Some(u) => {
                let settings = self
                    .store
                    .get_settings(&u.id)
                    .ok()
                    .flatten()
                    .map(|s| SettingsWire::from(&s));
                IdentityShape {
                    authenticated: true,
                    user: Some(IdentityUser {
                        id: u.id.clone(),
                        email: u.email.clone(),
                        display_name: u.display_name.clone(),
                        auth_methods: u.auth_methods().into_iter().map(str::to_string).collect(),
                    }),
                    google_available: self.google_available_flag(),
                    settings,
                    demo_seed,
                }
            }
        }
    }

    pub fn resolve_session(&self, cookie_value: Option<&str>) -> ResolvedSession {
        match self.resolve_session_inner(cookie_value) {
            Ok(r) => r,
            Err(_) => ResolvedSession {
                user: None,
                session_id: None,
            },
        }
    }

    fn resolve_session_inner(&self, cookie_value: Option<&str>) -> Result<ResolvedSession, ()> {
        let sid = cookies::unsign_cookie(cookie_value, &self.cfg.signing_key).ok_or(())?;
        let sess = self.store.get_session(&sid).map_err(|_| ())?.ok_or(())?;
        let now = now_secs();
        if sess.revoked || now >= sess.expires_at || now >= sess.absolute_expires_at {
            return Ok(ResolvedSession {
                user: None,
                session_id: None,
            });
        }
        let user = self
            .store
            .get_user_by_id(&sess.user_id)
            .map_err(|_| ())?
            .ok_or(())?;
        let new_expiry = (now + self.cfg.session_idle_secs).min(sess.absolute_expires_at);
        if new_expiry > sess.expires_at {
            let _ = self.store.touch_session(&sid, new_expiry);
        }
        Ok(ResolvedSession {
            user: Some(user),
            session_id: Some(sid),
        })
    }

    pub fn session_status(&self, cookie_value: Option<&str>) -> IdentityShape {
        let resolved = self.resolve_session(cookie_value);
        self.identity(resolved.user.as_ref())
    }

    fn validate_credentials(&self, email: &str, password: &str) -> Result<(), AuthError> {
        static RE: OnceLock<Regex> = OnceLock::new();
        let re = RE.get_or_init(|| Regex::new(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").unwrap());
        if email.trim().is_empty() || !re.is_match(email.trim()) {
            return Err(validation("Enter a valid email address."));
        }
        if password.len() < self.cfg.password_min_length {
            return Err(validation(format!(
                "Password must be at least {} characters.",
                self.cfg.password_min_length
            )));
        }
        Ok(())
    }

    pub fn signup(
        &self,
        email: &str,
        password: &str,
        display_name: Option<&str>,
    ) -> Result<(IdentityShape, String), AuthError> {
        if !self.cfg.registration_open {
            return Err(signups_closed());
        }
        self.validate_credentials(email, password)?;
        let hash = passwords::hash_password(password).map_err(|_| auth_unavailable())?;
        let user = match self.store.create_user(email, Some(&hash), display_name) {
            Ok(u) => u,
            Err(e) if e.to_string().contains("email_taken") => return Err(email_taken()),
            Err(e) => {
                warn!(error = %e, "auth signup store fault");
                return Err(auth_unavailable());
            }
        };
        let _ = self.store.upsert_settings_defaults(&user.id);
        let _ = self.store.mark_login(&user.id, now_secs());
        let sid = self.new_session(&user.id)?;
        Ok((self.identity(Some(&user)), sid))
    }

    pub fn login(&self, email: &str, password: &str) -> Result<(IdentityShape, String), AuthError> {
        static RE: OnceLock<Regex> = OnceLock::new();
        let re = RE.get_or_init(|| Regex::new(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").unwrap());
        if email.trim().is_empty() || !re.is_match(email.trim()) {
            return Err(validation("Enter a valid email address."));
        }
        if password.is_empty() {
            return Err(validation("Enter your password."));
        }
        let user = self.store.get_user_by_email(email).ok().flatten();
        let stored = user.as_ref().and_then(|u| u.password_hash.as_deref());
        if !passwords::verify_password(password, stored) {
            return Err(bad_credentials());
        }
        let user = user.unwrap();
        let _ = self.store.mark_login(&user.id, now_secs());
        let sid = self.new_session(&user.id)?;
        Ok((self.identity(Some(&user)), sid))
    }

    pub fn ensure_account(
        &self,
        email: &str,
        password: &str,
        display_name: Option<&str>,
    ) -> Result<bool, AuthError> {
        if self
            .store
            .get_user_by_email(email)
            .ok()
            .flatten()
            .is_some()
        {
            return Ok(false);
        }
        let hash = passwords::hash_password(password).map_err(|_| auth_unavailable())?;
        match self.store.create_user(email, Some(&hash), display_name) {
            Ok(u) => {
                let _ = self.store.upsert_settings_defaults(&u.id);
                Ok(true)
            }
            Err(e) if e.to_string().contains("email_taken") => Ok(false),
            Err(e) => {
                warn!(error = %e, "ensure_account fault");
                Err(auth_unavailable())
            }
        }
    }

    pub fn logout(&self, cookie_value: Option<&str>) {
        if let Some(sid) = cookies::unsign_cookie(cookie_value, &self.cfg.signing_key) {
            let _ = self.store.revoke_session(&sid);
        }
    }

    pub fn get_settings(&self, user: &UserRecord) -> Result<SettingsWire, AuthError> {
        self.store
            .upsert_settings_defaults(&user.id)
            .map(|s| SettingsWire::from(&s))
            .map_err(|e| {
                warn!(error = %e, "settings read fault");
                auth_unavailable()
            })
    }

    pub fn write_settings(
        &self,
        user: &UserRecord,
        patch: SettingsPatch,
    ) -> Result<SettingsWire, AuthError> {
        if let Some(ref theme) = patch.theme {
            if !matches!(theme.as_str(), "dark" | "light" | "system") {
                return Err(validation("theme must be dark, light, or system."));
            }
        }
        // Server-side refusals are authoritative (`[server-side-gate-enforcement]`): validated
        // BEFORE `update_settings`, against the account size AS IT WILL BE after this patch.
        let stored_account = self
            .store
            .get_settings(&user.id)
            .ok()
            .flatten()
            .and_then(|s| s.risk_account_size);
        if let Err(msg) = super::risk::validate(patch.risk_account_size, patch.per_trade_cap.clone(), stored_account) {
            return Err(validation(msg));
        }
        self.store
            .update_settings(&user.id, &patch)
            .map(|s| SettingsWire::from(&s))
            .map_err(|e| {
                warn!(error = %e, "settings write fault");
                auth_unavailable()
            })
    }

    pub fn get_scan_view_json(&self, user: &UserRecord) -> Option<String> {
        self.store
            .get_settings(&user.id)
            .ok()
            .flatten()
            .and_then(|s| s.scan_view)
    }

    pub fn save_scan_view_json(&self, user: &UserRecord, view_json: &str) -> Result<(), AuthError> {
        self.store
            .update_settings(
                &user.id,
                &SettingsPatch {
                    scan_view: Some(view_json.to_string()),
                    ..Default::default()
                },
            )
            .map(|_| ())
            .map_err(|e| {
                warn!(error = %e, "scan-view write fault");
                auth_unavailable()
            })
    }

    // ------------------------------------------------------------------ BYO AI key

    /// Masked-hint read: `{set, last4, storage_available, provider?}`. Never decrypts.
    pub fn ai_key_hint(&self, user: &UserRecord) -> serde_json::Value {
        match self.store.get_credential(&user.id, "ai") {
            Ok(None) => serde_json::json!({
                "set": false,
                "last4": null,
                "storage_available": true,
                "provider": null,
            }),
            Ok(Some(rec)) => serde_json::json!({
                "set": true,
                "last4": rec.last4,
                "storage_available": true,
                "provider": rec.provider,
            }),
            Err(e) => {
                warn!(error = %e, "ai-key hint fault");
                serde_json::json!({
                    "set": false,
                    "last4": null,
                    "storage_available": false,
                    "provider": null,
                })
            }
        }
    }

    /// Encrypt + store. `provider` optional (auto-detected from key prefix when None).
    /// Returns masked status; on store fault → 200 set:false storage_available:false.
    pub fn set_ai_key(
        &self,
        user: &UserRecord,
        raw_key: &str,
        provider: Option<&str>,
    ) -> serde_json::Value {
        let raw = raw_key.trim();
        if raw.len() < 8 {
            // Caller maps this; we still return a soft storage shape for AC-18 path when empty
            // reaches here. Prefer validation at the router.
        }
        let last4 = if raw.len() >= 4 {
            raw[raw.len() - 4..].to_string()
        } else {
            raw.to_string()
        };
        let prov = provider
            .and_then(crate::services::llm::LlmProvider::parse)
            .unwrap_or_else(|| crate::services::llm::LlmProvider::detect_from_key(raw));
        match crate::services::auth::crypto::encrypt(raw) {
            Ok(ct) => {
                if let Err(e) =
                    self.store
                        .set_credential(&user.id, "ai", &ct, &last4, prov.as_str())
                {
                    warn!(error = %e, "ai-key store fault");
                    return serde_json::json!({
                        "set": false,
                        "last4": null,
                        "storage_available": false,
                        "provider": null,
                    });
                }
                serde_json::json!({
                    "set": true,
                    "last4": last4,
                    "storage_available": true,
                    "provider": prov.as_str(),
                })
            }
            Err(e) => {
                warn!(error = %e, "ai-key encrypt fault");
                serde_json::json!({
                    "set": false,
                    "last4": null,
                    "storage_available": false,
                    "provider": null,
                })
            }
        }
    }

    pub fn delete_ai_key(&self, user: &UserRecord) -> serde_json::Value {
        match self.store.delete_credential(&user.id, "ai") {
            Ok(()) => serde_json::json!({
                "set": false,
                "last4": null,
                "storage_available": true,
                "provider": null,
            }),
            Err(e) => {
                warn!(error = %e, "ai-key delete fault");
                serde_json::json!({
                    "set": false,
                    "last4": null,
                    "storage_available": false,
                    "provider": null,
                })
            }
        }
    }

    /// Decrypt stored key for one server-side call. Never log the result.
    pub fn get_decrypted_ai_key(
        &self,
        user_id: &str,
    ) -> Option<(String, crate::services::llm::LlmProvider)> {
        let rec = self.store.get_credential(user_id, "ai").ok().flatten()?;
        let pt = crate::services::auth::crypto::decrypt(&rec.ciphertext)?;
        let prov = crate::services::llm::LlmProvider::parse(&rec.provider)
            .unwrap_or_else(|| crate::services::llm::LlmProvider::detect_from_key(&pt));
        Some((pt, prov))
    }

    // ------------------------------------------------------------------ Google OAuth

    pub fn google_start_url(&self) -> Result<String, AuthError> {
        if !self.google_available_flag() {
            return Err(google_unavailable());
        }
        use rand::RngCore;
        let mut b = [0u8; 18];
        rand::thread_rng().fill_bytes(&mut b);
        let state = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b);
        super::google_oauth::remember_state(&state);
        super::google_oauth::authorization_url(&state).ok_or_else(google_unavailable)
    }

    /// Resolve Google callback → new session id. Async for token HTTP.
    pub async fn google_callback(
        &self,
        code: Option<&str>,
        state: Option<&str>,
    ) -> Result<String, AuthError> {
        if !self.google_available_flag() {
            return Err(google_unavailable());
        }
        if !super::google_oauth::consume_state(state) {
            return Err(validation("Invalid or expired sign-in state."));
        }
        let code = code.filter(|c| !c.is_empty()).ok_or_else(|| {
            validation("Missing authorization code.")
        })?;
        let identity = super::google_oauth::exchange(code)
            .await
            .map_err(|_| auth_unavailable())?;

        // 1. Known Google identity
        let mut user = self
            .store
            .get_by_google_sub(&identity.sub)
            .map_err(|_| auth_unavailable())?;

        // 2. Verified-email match → auto-link
        if user.is_none() && identity.email_verified && !identity.email.is_empty() {
            if let Ok(Some(existing)) = self.store.get_user_by_email(&identity.email) {
                user = self
                    .store
                    .attach_google(&existing.id, &identity.sub)
                    .map_err(|_| auth_unavailable())?;
            }
        }

        // 3. New registration — same lockdown as signup
        if user.is_none() {
            if !self.cfg.registration_open {
                return Err(signups_closed());
            }
            if identity.email.is_empty() {
                return Err(validation("Google account has no email."));
            }
            let created = self
                .store
                .create_google_user(
                    &identity.email,
                    identity.name.as_deref(),
                    &identity.sub,
                )
                .map_err(|_| auth_unavailable())?;
            let _ = self.store.upsert_settings_defaults(&created.id);
            user = Some(created);
        }

        let user = user.ok_or_else(auth_unavailable)?;
        let _ = self.store.mark_login(&user.id, now_secs());
        self.new_session(&user.id)
    }

    // ------------------------------------------------------------------ Broker credential (kind=broker_webull)

    pub fn broker_credential_hint(&self, user: &UserRecord) -> serde_json::Value {
        match self.store.get_credential(&user.id, CREDENTIAL_KIND_BROKER) {
            Ok(None) => serde_json::json!({
                "set": false, "last4": null, "storage_available": true
            }),
            Ok(Some(rec)) => serde_json::json!({
                "set": true, "last4": rec.last4, "storage_available": true
            }),
            Err(e) => {
                warn!(error = %e, "broker-credential hint fault");
                serde_json::json!({
                    "set": false, "last4": null, "storage_available": false
                })
            }
        }
    }

    pub fn set_broker_credential(
        &self,
        user: &UserRecord,
        app_key: &str,
        app_secret: &str,
    ) -> Result<serde_json::Value, AuthError> {
        let key = app_key.trim();
        let secret = app_secret.trim();
        if key.is_empty() || secret.is_empty() {
            return Err(validation("Both App Key and App Secret are required."));
        }
        let last4 = if key.len() >= 4 {
            key[key.len() - 4..].to_string()
        } else {
            key.to_string()
        };
        let blob = serde_json::json!({ "app_key": key, "app_secret": secret }).to_string();
        match crate::services::auth::crypto::encrypt(&blob) {
            Ok(ct) => {
                if let Err(e) = self.store.set_credential(
                    &user.id,
                    CREDENTIAL_KIND_BROKER,
                    &ct,
                    &last4,
                    "webull",
                ) {
                    warn!(error = %e, "broker-credential store fault");
                    return Ok(serde_json::json!({
                        "set": false, "last4": null, "storage_available": false
                    }));
                }
                self.invalidate_broker_cache(&user.id);
                Ok(serde_json::json!({
                    "set": true, "last4": last4, "storage_available": true
                }))
            }
            Err(e) => {
                warn!(error = %e, "broker-credential encrypt fault");
                Ok(serde_json::json!({
                    "set": false, "last4": null, "storage_available": false
                }))
            }
        }
    }

    pub fn delete_broker_credential(&self, user: &UserRecord) -> serde_json::Value {
        let out = match self.store.delete_credential(&user.id, CREDENTIAL_KIND_BROKER) {
            Ok(()) => serde_json::json!({
                "set": false, "last4": null, "storage_available": true
            }),
            Err(e) => {
                warn!(error = %e, "broker-credential delete fault");
                serde_json::json!({
                    "set": false, "last4": null, "storage_available": false
                })
            }
        };
        self.invalidate_broker_cache(&user.id);
        out
    }

    /// Decrypt broker pair for server-side fetch. Never log.
    pub fn get_decrypted_broker_credential(
        &self,
        user_id: &str,
    ) -> Option<(String, String)> {
        let rec = self
            .store
            .get_credential(user_id, CREDENTIAL_KIND_BROKER)
            .ok()
            .flatten()?;
        let pt = crate::services::auth::crypto::decrypt(&rec.ciphertext)?;
        let v: serde_json::Value = serde_json::from_str(&pt).ok()?;
        let key = v.get("app_key")?.as_str()?.to_string();
        let secret = v.get("app_secret")?.as_str()?.to_string();
        if key.is_empty() || secret.is_empty() {
            return None;
        }
        Some((key, secret))
    }

    fn new_session(&self, user_id: &str) -> Result<String, AuthError> {
        let now = now_secs();
        let sid = cookies::new_session_id();
        self.store
            .create_session(&SessionRecord {
                id: sid.clone(),
                user_id: user_id.into(),
                created_at: now,
                expires_at: now + self.cfg.session_idle_secs,
                absolute_expires_at: now + self.cfg.session_absolute_secs,
                revoked: false,
            })
            .map_err(|e| {
                warn!(error = %e, "session create fault");
                auth_unavailable()
            })?;
        Ok(sid)
    }
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
        + chrono::Utc::now().timestamp_subsec_millis() as f64 / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::auth::store::AuthStore;

    fn svc(open_reg: bool) -> AuthService {
        let store = AuthStore::open_memory().unwrap();
        AuthService::new(
            store,
            AuthConfig {
                signing_key: "test-signing-key".into(),
                registration_open: open_reg,
                cookie_secure: false,
                ..Default::default()
            },
        )
    }

    #[test]
    fn signup_login_session() {
        let s = svc(true);
        let (id, sid) = s.signup("a@b.co", "password1", Some("A")).unwrap();
        assert!(id.authenticated);
        let cookie = s.signed_cookie_value(&sid);
        let st = s.session_status(Some(&cookie));
        assert!(st.authenticated);
        assert_eq!(st.user.as_ref().unwrap().email, "a@b.co");
        let (id2, _) = s.login("a@b.co", "password1").unwrap();
        assert!(id2.authenticated);
        assert!(s.login("a@b.co", "wrong-pass").is_err());
    }

    #[test]
    fn signups_closed_when_locked() {
        let s = svc(false);
        let err = s.signup("a@b.co", "password1", None).unwrap_err();
        assert_eq!(err.code, "signups_closed");
    }
}
