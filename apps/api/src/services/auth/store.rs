//! Auth persistence — pure-Rust JSON-on-disk (survives restart; no C toolchain).

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub password_hash: Option<String>,
    pub google_sub: Option<String>,
    pub created_at: f64,
    pub last_login_at: Option<f64>,
}

impl UserRecord {
    pub fn auth_methods(&self) -> Vec<&'static str> {
        let mut m = Vec::new();
        if self.password_hash.as_ref().is_some_and(|h| !h.is_empty()) {
            m.push("password");
        }
        if self.google_sub.is_some() {
            m.push("google");
        }
        m
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub id: String,
    pub user_id: String,
    pub created_at: f64,
    pub expires_at: f64,
    pub absolute_expires_at: f64,
    pub revoked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsRecord {
    pub user_id: String,
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: String,
    pub scan_view: Option<String>,
    /// tradeable-rec-inputs B8: the owner's risk-input record. `#[serde(default)]` on all four is
    /// the whole disk-JSON forward-migration — a record written before this feature reads forward.
    #[serde(default)]
    pub risk_account_size: Option<f64>,
    #[serde(default)]
    pub risk_cap_value: Option<f64>,
    /// "usd" | "percent". Stored WITH its value — never two independent truths.
    #[serde(default)]
    pub risk_cap_unit: Option<String>,
    #[serde(default)]
    pub risk_updated_at: Option<f64>,
    /// Standing Ask-AI preference (ai-providers). `#[serde(default)]` is the disk-JSON
    /// forward-migration for records written before this feature.
    #[serde(default)]
    pub ai_power_path: Option<String>,
    #[serde(default)]
    pub ai_provider: Option<String>,
    #[serde(default)]
    pub ai_model: Option<String>,
}

impl SettingsRecord {
    pub fn defaults(user_id: &str) -> Self {
        Self {
            user_id: user_id.into(),
            active_persona_id: None,
            default_ticker: None,
            theme: "dark".into(),
            scan_view: None,
            risk_account_size: None,
            risk_cap_value: None,
            risk_cap_unit: None,
            risk_updated_at: None,
            ai_power_path: None,
            ai_provider: None,
            ai_model: None,
        }
    }
}

/// Encrypted BYO AI credential (kind = "ai"). Never expose ciphertext on the wire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialRecord {
    pub user_id: String,
    pub kind: String,
    pub ciphertext: String,
    pub last4: String,
    /// anthropic | openai | xai | gemini | openai_compatible
    #[serde(default = "default_provider")]
    pub provider: String,
    pub created_at: f64,
    pub updated_at: f64,
}

fn default_provider() -> String {
    "anthropic".into()
}

/// Opaque Grok subscription link (no secrets on the wire).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrokLinkRecord {
    pub user_id: String,
    /// unlinked | linked | expired
    pub status: String,
    pub encrypted_material: Option<String>,
    pub updated_at: f64,
}

#[derive(Default, Serialize, Deserialize)]
struct DiskAuth {
    users: HashMap<String, UserRecord>,
    /// email_lower → user_id
    by_email: HashMap<String, String>,
    sessions: HashMap<String, SessionRecord>,
    settings: HashMap<String, SettingsRecord>,
    /// (user_id, kind, provider) → credential. Legacy keys are `{user}::{kind}`.
    #[serde(default)]
    credentials: HashMap<String, CredentialRecord>,
    /// user_id → grok subscription link
    #[serde(default)]
    grok_links: HashMap<String, GrokLinkRecord>,
}

#[derive(Clone)]
pub struct JsonAuthStore {
    state: Arc<Mutex<DiskAuth>>,
    path: Option<PathBuf>,
}

impl JsonAuthStore {
    /// Opens the JSON-file auth store. The name predates the move off SQLite: a `.sqlite3`,
    /// `.sqlite` or `.db` path from the environment is rewritten to `.json`.
    pub fn open_sqlite(path: &Path) -> AppResult<Self> {
        // Path may be `.sqlite3` from env; we persist JSON.
        let path = normalize_json_path(path);
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        let state = if path.exists() {
            let raw = std::fs::read_to_string(&path)?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DiskAuth::default()
        };
        info!(path = %path.display(), "auth store: durable json");
        Ok(Self {
            state: Arc::new(Mutex::new(state)),
            path: Some(path),
        })
    }

    pub fn open_memory() -> AppResult<Self> {
        Ok(Self {
            state: Arc::new(Mutex::new(DiskAuth::default())),
            path: None,
        })
    }

    fn persist_locked(&self, st: &DiskAuth) {
        let Some(path) = &self.path else {
            return;
        };
        match serde_json::to_string_pretty(st) {
            Ok(json) => {
                let tmp = path.with_extension("json.tmp");
                if std::fs::write(&tmp, json).is_ok() {
                    let _ = std::fs::remove_file(path);
                    let _ = std::fs::rename(&tmp, path);
                }
            }
            Err(_) => {}
        }
    }

    pub fn get_user_by_id(&self, user_id: &str) -> AppResult<Option<UserRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.users.get(user_id).cloned())
    }

    pub fn get_user_by_email(&self, email: &str) -> AppResult<Option<UserRecord>> {
        let lower = email.trim().to_ascii_lowercase();
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.by_email
            .get(&lower)
            .and_then(|id| g.users.get(id))
            .cloned())
    }

    pub fn create_user(
        &self,
        email: &str,
        password_hash: Option<&str>,
        display_name: Option<&str>,
    ) -> AppResult<UserRecord> {
        let email = email.trim().to_string();
        let email_lower = email.to_ascii_lowercase();
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if g.by_email.contains_key(&email_lower) {
            return Err(AppError::Other(anyhow::anyhow!("email_taken")));
        }
        let id = {
            use rand::RngCore;
            let mut b = [0u8; 16];
            rand::thread_rng().fill_bytes(&mut b);
            hex::encode(b)
        };
        let now = now_secs();
        let user = UserRecord {
            id: id.clone(),
            email,
            display_name: display_name.map(|s| s.to_string()),
            password_hash: password_hash.map(|s| s.to_string()),
            google_sub: None,
            created_at: now,
            last_login_at: None,
        };
        g.by_email.insert(email_lower, id.clone());
        g.users.insert(id, user.clone());
        self.persist_locked(&g);
        Ok(user)
    }

    pub fn mark_login(&self, user_id: &str, when: f64) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(u) = g.users.get_mut(user_id) {
            u.last_login_at = Some(when);
            self.persist_locked(&g);
        }
        Ok(())
    }

    pub fn get_by_google_sub(&self, sub: &str) -> AppResult<Option<UserRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.users
            .values()
            .find(|u| u.google_sub.as_deref() == Some(sub))
            .cloned())
    }

    pub fn attach_google(&self, user_id: &str, google_sub: &str) -> AppResult<Option<UserRecord>> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(u) = g.users.get_mut(user_id) {
            u.google_sub = Some(google_sub.to_string());
            let out = u.clone();
            self.persist_locked(&g);
            return Ok(Some(out));
        }
        Ok(None)
    }

    pub fn create_google_user(
        &self,
        email: &str,
        display_name: Option<&str>,
        google_sub: &str,
    ) -> AppResult<UserRecord> {
        let email = email.trim().to_string();
        let email_lower = email.to_ascii_lowercase();
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if g.by_email.contains_key(&email_lower) {
            return Err(AppError::Other(anyhow::anyhow!("email_taken")));
        }
        let id = {
            use rand::RngCore;
            let mut b = [0u8; 16];
            rand::thread_rng().fill_bytes(&mut b);
            hex::encode(b)
        };
        let now = now_secs();
        let user = UserRecord {
            id: id.clone(),
            email,
            display_name: display_name.map(|s| s.to_string()),
            password_hash: None,
            google_sub: Some(google_sub.to_string()),
            created_at: now,
            last_login_at: None,
        };
        g.by_email.insert(email_lower, id.clone());
        g.users.insert(id, user.clone());
        self.persist_locked(&g);
        Ok(user)
    }

    pub fn create_session(&self, s: &SessionRecord) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.sessions.insert(s.id.clone(), s.clone());
        self.persist_locked(&g);
        Ok(())
    }

    pub fn get_session(&self, session_id: &str) -> AppResult<Option<SessionRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.sessions.get(session_id).cloned())
    }

    pub fn touch_session(&self, session_id: &str, new_expires_at: f64) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(s) = g.sessions.get_mut(session_id) {
            s.expires_at = new_expires_at;
            self.persist_locked(&g);
        }
        Ok(())
    }

    pub fn revoke_session(&self, session_id: &str) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(s) = g.sessions.get_mut(session_id) {
            s.revoked = true;
            self.persist_locked(&g);
        }
        Ok(())
    }

    pub fn get_settings(&self, user_id: &str) -> AppResult<Option<SettingsRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.settings.get(user_id).cloned())
    }

    pub fn upsert_settings_defaults(&self, user_id: &str) -> AppResult<SettingsRecord> {
        if let Some(s) = self.get_settings(user_id)? {
            return Ok(s);
        }
        let rec = SettingsRecord::defaults(user_id);
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.settings.insert(user_id.into(), rec.clone());
        self.persist_locked(&g);
        Ok(rec)
    }

    fn cred_key(user_id: &str, kind: &str, provider: &str) -> String {
        format!("{user_id}::{kind}::{provider}")
    }

    fn legacy_cred_key(user_id: &str, kind: &str) -> String {
        format!("{user_id}::{kind}")
    }

    fn promote_legacy_ai_locked(st: &mut DiskAuth, user_id: &str) {
        let legacy = Self::legacy_cred_key(user_id, "ai");
        let Some(rec) = st.credentials.get(&legacy).cloned() else {
            return;
        };
        let provider = if rec.provider.trim().is_empty() {
            "anthropic".to_string()
        } else {
            rec.provider.clone()
        };
        let dest = Self::cred_key(user_id, "ai", &provider);
        if !st.credentials.contains_key(&dest) {
            let mut moved = rec;
            moved.provider = provider.clone();
            st.credentials.insert(dest, moved);
        }
        st.credentials.remove(&legacy);

        if crate::services::llm_catalog::is_trader_byo(&provider) {
            let settings = st
                .settings
                .entry(user_id.to_string())
                .or_insert_with(|| SettingsRecord::defaults(user_id));
            if settings.ai_power_path.is_none() {
                settings.ai_power_path = Some("own_key".into());
                settings.ai_provider = Some(provider);
            }
        }
    }

    fn promote_legacy_kind_locked(st: &mut DiskAuth, user_id: &str, kind: &str, provider: &str) {
        if kind == "ai" {
            Self::promote_legacy_ai_locked(st, user_id);
            return;
        }
        let legacy = Self::legacy_cred_key(user_id, kind);
        let dest = Self::cred_key(user_id, kind, provider);
        if st.credentials.contains_key(&dest) {
            st.credentials.remove(&legacy);
            return;
        }
        if let Some(mut rec) = st.credentials.remove(&legacy) {
            if rec.provider.trim().is_empty() {
                rec.provider = provider.to_string();
            }
            let slot = rec.provider.clone();
            st.credentials
                .insert(Self::cred_key(user_id, kind, &slot), rec);
        }
    }

    pub fn promote_legacy_ai(&self, user_id: &str) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Self::promote_legacy_ai_locked(&mut g, user_id);
        self.persist_locked(&g);
        Ok(())
    }

    pub fn get_credential(
        &self,
        user_id: &str,
        kind: &str,
        provider: &str,
    ) -> AppResult<Option<CredentialRecord>> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Self::promote_legacy_kind_locked(&mut g, user_id, kind, provider);
        self.persist_locked(&g);
        Ok(g.credentials
            .get(&Self::cred_key(user_id, kind, provider))
            .cloned())
    }

    pub fn list_credentials(&self, user_id: &str, kind: &str) -> AppResult<Vec<CredentialRecord>> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if kind == "ai" {
            Self::promote_legacy_ai_locked(&mut g, user_id);
            self.persist_locked(&g);
        }
        Ok(g.credentials
            .values()
            .filter(|c| c.user_id == user_id && c.kind == kind)
            .cloned()
            .collect())
    }

    pub fn set_credential(
        &self,
        user_id: &str,
        kind: &str,
        ciphertext: &str,
        last4: &str,
        provider: &str,
    ) -> AppResult<()> {
        let now = now_secs();
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if kind == "ai" {
            Self::promote_legacy_ai_locked(&mut g, user_id);
        } else {
            Self::promote_legacy_kind_locked(&mut g, user_id, kind, provider);
        }
        let k = Self::cred_key(user_id, kind, provider);
        let created = g.credentials.get(&k).map(|c| c.created_at).unwrap_or(now);
        g.credentials.insert(
            k,
            CredentialRecord {
                user_id: user_id.into(),
                kind: kind.into(),
                ciphertext: ciphertext.into(),
                last4: last4.into(),
                provider: provider.into(),
                created_at: created,
                updated_at: now,
            },
        );
        self.persist_locked(&g);
        Ok(())
    }

    pub fn delete_credential(&self, user_id: &str, kind: &str, provider: &str) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if kind == "ai" {
            Self::promote_legacy_ai_locked(&mut g, user_id);
        } else {
            Self::promote_legacy_kind_locked(&mut g, user_id, kind, provider);
        }
        g.credentials
            .remove(&Self::cred_key(user_id, kind, provider));
        // Drop a leftover legacy row only when it belonged to this slot.
        let legacy = Self::legacy_cred_key(user_id, kind);
        if let Some(rec) = g.credentials.get(&legacy) {
            let lp = if rec.provider.trim().is_empty() {
                "anthropic"
            } else {
                rec.provider.as_str()
            };
            if lp == provider {
                g.credentials.remove(&legacy);
            }
        }
        self.persist_locked(&g);
        Ok(())
    }

    pub fn get_grok_link(&self, user_id: &str) -> AppResult<Option<GrokLinkRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.grok_links.get(user_id).cloned())
    }

    pub fn set_grok_link(&self, rec: &GrokLinkRecord) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.grok_links.insert(rec.user_id.clone(), rec.clone());
        self.persist_locked(&g);
        Ok(())
    }

    pub fn delete_grok_link(&self, user_id: &str) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.grok_links.remove(user_id);
        self.persist_locked(&g);
        Ok(())
    }

    pub fn update_settings(
        &self,
        user_id: &str,
        patch: &SettingsPatch,
    ) -> AppResult<SettingsRecord> {
        let mut cur = self.upsert_settings_defaults(user_id)?;
        if let Some(ref v) = patch.active_persona_id {
            cur.active_persona_id = if v.is_empty() { None } else { Some(v.clone()) };
        }
        if let Some(ref v) = patch.default_ticker {
            cur.default_ticker = if v.is_empty() {
                None
            } else {
                Some(v.to_ascii_uppercase())
            };
        }
        if let Some(ref v) = patch.theme {
            cur.theme = v.clone();
        }
        if let Some(ref v) = patch.scan_view {
            cur.scan_view = Some(v.clone());
        }
        if let Some(v) = patch.risk_account_size {
            cur.risk_account_size = v; // Some(x) sets, None clears
            cur.risk_updated_at = Some(now_secs());
        }
        if let Some(v) = patch.per_trade_cap.clone() {
            match v {
                Some((value, unit)) => {
                    cur.risk_cap_value = Some(value);
                    cur.risk_cap_unit = Some(unit);
                }
                None => {
                    cur.risk_cap_value = None;
                    cur.risk_cap_unit = None;
                }
            }
            cur.risk_updated_at = Some(now_secs());
        }
        if let Some(v) = patch.ai_power_path.clone() {
            cur.ai_power_path = v;
        }
        if let Some(v) = patch.ai_provider.clone() {
            cur.ai_provider = v;
        }
        if let Some(v) = patch.ai_model.clone() {
            cur.ai_model = v;
        }
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.settings.insert(user_id.into(), cur.clone());
        self.persist_locked(&g);
        Ok(cur)
    }
}

#[derive(Debug, Default, Clone)]
pub struct SettingsPatch {
    pub active_persona_id: Option<String>,
    pub default_ticker: Option<String>,
    pub theme: Option<String>,
    pub scan_view: Option<String>,
    /// Outer `Option` = "field present in the request"; inner `Option<f64>` = "clear it" (`None`)
    /// vs "set it" (`Some`). `0` is a legal entered value, never a sentinel for unset.
    pub risk_account_size: Option<Option<f64>>,
    /// `(value, unit)` where `unit` is `"usd" | "percent"`. Outer `Option` = present-in-request.
    pub per_trade_cap: Option<Option<(f64, String)>>,
    /// Outer `Option` = field present; inner `None` = clear (server-internal for path/provider).
    pub ai_power_path: Option<Option<String>>,
    pub ai_provider: Option<Option<String>>,
    pub ai_model: Option<Option<String>>,
}

fn normalize_json_path(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.ends_with(".sqlite3") || s.ends_with(".sqlite") || s.ends_with(".db") {
        PathBuf::from(
            s.replace(".sqlite3", ".json")
                .replace(".sqlite", ".json")
                .replace(".db", ".json"),
        )
    } else if s.ends_with(".json") {
        path.to_path_buf()
    } else {
        path.with_extension("json")
    }
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
}

/// Durable auth backend: JSON (local) or Postgres (multi-instance / Railway).
#[derive(Clone)]
pub enum AuthStore {
    Json(JsonAuthStore),
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_auth::PgAuthStore),
}

impl AuthStore {
    /// The file-backed store (JSON; see [`JsonAuthStore::open_sqlite`]).
    pub fn open_sqlite(path: &Path) -> AppResult<Self> {
        Ok(Self::Json(JsonAuthStore::open_sqlite(path)?))
    }

    pub fn open_memory() -> AppResult<Self> {
        Ok(Self::Json(JsonAuthStore::open_memory()?))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg) -> Self {
        Self::Postgres(crate::db::pg_auth::PgAuthStore::new(pg))
    }

    pub fn get_user_by_id(&self, user_id: &str) -> AppResult<Option<UserRecord>> {
        match self {
            Self::Json(s) => s.get_user_by_id(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_user_by_id(user_id),
        }
    }
    pub fn get_user_by_email(&self, email: &str) -> AppResult<Option<UserRecord>> {
        match self {
            Self::Json(s) => s.get_user_by_email(email),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_user_by_email(email),
        }
    }
    pub fn create_user(
        &self,
        email: &str,
        password_hash: Option<&str>,
        display_name: Option<&str>,
    ) -> AppResult<UserRecord> {
        match self {
            Self::Json(s) => s.create_user(email, password_hash, display_name),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.create_user(email, password_hash, display_name),
        }
    }
    pub fn mark_login(&self, user_id: &str, when: f64) -> AppResult<()> {
        match self {
            Self::Json(s) => s.mark_login(user_id, when),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.mark_login(user_id, when),
        }
    }
    pub fn get_by_google_sub(&self, sub: &str) -> AppResult<Option<UserRecord>> {
        match self {
            Self::Json(s) => s.get_by_google_sub(sub),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_by_google_sub(sub),
        }
    }
    pub fn attach_google(&self, user_id: &str, google_sub: &str) -> AppResult<Option<UserRecord>> {
        match self {
            Self::Json(s) => s.attach_google(user_id, google_sub),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.attach_google(user_id, google_sub),
        }
    }
    pub fn create_google_user(
        &self,
        email: &str,
        display_name: Option<&str>,
        google_sub: &str,
    ) -> AppResult<UserRecord> {
        match self {
            Self::Json(s) => s.create_google_user(email, display_name, google_sub),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.create_google_user(email, display_name, google_sub),
        }
    }
    pub fn create_session(&self, s: &SessionRecord) -> AppResult<()> {
        match self {
            Self::Json(j) => j.create_session(s),
            #[cfg(feature = "postgres")]
            Self::Postgres(j) => j.create_session(s),
        }
    }
    pub fn get_session(&self, session_id: &str) -> AppResult<Option<SessionRecord>> {
        match self {
            Self::Json(s) => s.get_session(session_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_session(session_id),
        }
    }
    pub fn touch_session(&self, session_id: &str, new_expires_at: f64) -> AppResult<()> {
        match self {
            Self::Json(s) => s.touch_session(session_id, new_expires_at),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.touch_session(session_id, new_expires_at),
        }
    }
    pub fn revoke_session(&self, session_id: &str) -> AppResult<()> {
        match self {
            Self::Json(s) => s.revoke_session(session_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.revoke_session(session_id),
        }
    }
    pub fn get_settings(&self, user_id: &str) -> AppResult<Option<SettingsRecord>> {
        match self {
            Self::Json(s) => s.get_settings(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_settings(user_id),
        }
    }
    pub fn upsert_settings_defaults(&self, user_id: &str) -> AppResult<SettingsRecord> {
        match self {
            Self::Json(s) => s.upsert_settings_defaults(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.upsert_settings_defaults(user_id),
        }
    }
    pub fn update_settings(
        &self,
        user_id: &str,
        patch: &SettingsPatch,
    ) -> AppResult<SettingsRecord> {
        match self {
            Self::Json(s) => s.update_settings(user_id, patch),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.update_settings(user_id, patch),
        }
    }
    pub fn get_credential(
        &self,
        user_id: &str,
        kind: &str,
        provider: &str,
    ) -> AppResult<Option<CredentialRecord>> {
        match self {
            Self::Json(s) => s.get_credential(user_id, kind, provider),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_credential(user_id, kind, provider),
        }
    }
    pub fn list_credentials(&self, user_id: &str, kind: &str) -> AppResult<Vec<CredentialRecord>> {
        match self {
            Self::Json(s) => s.list_credentials(user_id, kind),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.list_credentials(user_id, kind),
        }
    }
    pub fn set_credential(
        &self,
        user_id: &str,
        kind: &str,
        ciphertext: &str,
        last4: &str,
        provider: &str,
    ) -> AppResult<()> {
        match self {
            Self::Json(s) => s.set_credential(user_id, kind, ciphertext, last4, provider),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.set_credential(user_id, kind, ciphertext, last4, provider),
        }
    }
    pub fn delete_credential(&self, user_id: &str, kind: &str, provider: &str) -> AppResult<()> {
        match self {
            Self::Json(s) => s.delete_credential(user_id, kind, provider),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.delete_credential(user_id, kind, provider),
        }
    }
    pub fn promote_legacy_ai(&self, user_id: &str) -> AppResult<()> {
        match self {
            Self::Json(s) => s.promote_legacy_ai(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.promote_legacy_ai(user_id),
        }
    }
    pub fn get_grok_link(&self, user_id: &str) -> AppResult<Option<GrokLinkRecord>> {
        match self {
            Self::Json(s) => s.get_grok_link(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_grok_link(user_id),
        }
    }
    pub fn set_grok_link(&self, rec: &GrokLinkRecord) -> AppResult<()> {
        match self {
            Self::Json(s) => s.set_grok_link(rec),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.set_grok_link(rec),
        }
    }
    pub fn delete_grok_link(&self, user_id: &str) -> AppResult<()> {
        match self {
            Self::Json(s) => s.delete_grok_link(user_id),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.delete_grok_link(user_id),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_session_settings() {
        let store = AuthStore::open_memory().unwrap();
        let u = store
            .create_user("Test@Example.com", Some("hash"), Some("T"))
            .unwrap();
        assert!(store
            .get_user_by_email("test@example.com")
            .unwrap()
            .is_some());
        store
            .create_session(&SessionRecord {
                id: "sid1".into(),
                user_id: u.id.clone(),
                created_at: 1.0,
                expires_at: 100.0,
                absolute_expires_at: 200.0,
                revoked: false,
            })
            .unwrap();
        assert_eq!(store.get_session("sid1").unwrap().unwrap().user_id, u.id);
        let patched = store
            .update_settings(
                &u.id,
                &SettingsPatch {
                    theme: Some("light".into()),
                    scan_view: Some(r#"{"symbols":["SPY"]}"#.into()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(patched.theme, "light");
    }

    #[test]
    fn ai_credential_roundtrip() {
        let store = AuthStore::open_memory().unwrap();
        let u = store.create_user("k@ex.com", Some("h"), None).unwrap();
        store
            .set_credential(&u.id, "ai", "cipher", "abcd", "openai")
            .unwrap();
        let rec = store
            .get_credential(&u.id, "ai", "openai")
            .unwrap()
            .unwrap();
        assert_eq!(rec.last4, "abcd");
        assert_eq!(rec.provider, "openai");
        store.delete_credential(&u.id, "ai", "openai").unwrap();
        assert!(store
            .get_credential(&u.id, "ai", "openai")
            .unwrap()
            .is_none());
    }

    #[test]
    fn two_provider_slots_are_independent() {
        let store = AuthStore::open_memory().unwrap();
        let u = store.create_user("slots@ex.com", Some("h"), None).unwrap();
        store
            .set_credential(&u.id, "ai", "cipher-a", "aaa1", "anthropic")
            .unwrap();
        store
            .set_credential(&u.id, "ai", "cipher-o", "ooo2", "openai")
            .unwrap();
        let a = store
            .get_credential(&u.id, "ai", "anthropic")
            .unwrap()
            .unwrap();
        let o = store
            .get_credential(&u.id, "ai", "openai")
            .unwrap()
            .unwrap();
        assert_eq!(a.last4, "aaa1");
        assert_eq!(o.last4, "ooo2");
        store.delete_credential(&u.id, "ai", "openai").unwrap();
        assert!(store
            .get_credential(&u.id, "ai", "openai")
            .unwrap()
            .is_none());
        assert!(store
            .get_credential(&u.id, "ai", "anthropic")
            .unwrap()
            .is_some());
    }

    #[test]
    fn legacy_ai_row_promotes_to_provider_slot_and_backfills_own_key() {
        let store = JsonAuthStore::open_memory().unwrap();
        let u = store.create_user("legacy@ex.com", Some("h"), None).unwrap();
        let now = now_secs();
        {
            let mut g = store.state.lock().unwrap();
            g.credentials.insert(
                format!("{}::ai", u.id),
                CredentialRecord {
                    user_id: u.id.clone(),
                    kind: "ai".into(),
                    ciphertext: "legacy-ct".into(),
                    last4: "leg4".into(),
                    provider: "openai".into(),
                    created_at: now,
                    updated_at: now,
                },
            );
        }
        let rec = store
            .get_credential(&u.id, "ai", "openai")
            .unwrap()
            .unwrap();
        assert_eq!(rec.last4, "leg4");
        assert!(store
            .state
            .lock()
            .unwrap()
            .credentials
            .get(&format!("{}::ai", u.id))
            .is_none());
        let s = store.get_settings(&u.id).unwrap().unwrap();
        assert_eq!(s.ai_power_path.as_deref(), Some("own_key"));
        assert_eq!(s.ai_provider.as_deref(), Some("openai"));
        assert!(s.ai_model.is_none());
    }

    #[test]
    fn openai_compatible_legacy_is_not_a_trader_slot() {
        let store = JsonAuthStore::open_memory().unwrap();
        let u = store.create_user("compat@ex.com", Some("h"), None).unwrap();
        let now = now_secs();
        {
            let mut g = store.state.lock().unwrap();
            g.credentials.insert(
                format!("{}::ai", u.id),
                CredentialRecord {
                    user_id: u.id.clone(),
                    kind: "ai".into(),
                    ciphertext: "compat-ct".into(),
                    last4: "cmp4".into(),
                    provider: "openai_compatible".into(),
                    created_at: now,
                    updated_at: now,
                },
            );
        }
        let listed = store.list_credentials(&u.id, "ai").unwrap();
        assert!(listed.iter().all(|c| c.provider == "openai_compatible"));
        assert!(store
            .get_credential(&u.id, "ai", "anthropic")
            .unwrap()
            .is_none());
        let s = store.get_settings(&u.id).unwrap();
        assert!(s.is_none() || s.unwrap().ai_power_path.is_none());
    }

    #[test]
    fn an_old_settings_record_without_risk_fields_reads_forward_unchanged() {
        // A record shape written before this feature: no risk_* keys at all.
        let json = r#"{
            "users": {}, "by_email": {}, "sessions": {},
            "settings": { "u1": { "user_id": "u1", "active_persona_id": null,
                "default_ticker": "SPY", "theme": "dark", "scan_view": null } }
        }"#;
        let dir = std::env::temp_dir().join(format!("auth_store_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("old_settings.json");
        std::fs::write(&path, json).unwrap();

        let store = JsonAuthStore::open_sqlite(&path).unwrap();
        let s = store.get_settings("u1").unwrap().unwrap();
        assert_eq!(s.default_ticker.as_deref(), Some("SPY"));
        assert!(s.risk_account_size.is_none());
        assert!(s.risk_cap_value.is_none());
        assert!(s.risk_cap_unit.is_none());
        assert!(s.risk_updated_at.is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_corrupt_settings_blob_degrades_to_defaults_without_overwriting_the_original() {
        let dir =
            std::env::temp_dir().join(format!("auth_store_test_corrupt_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("corrupt.json");
        let malformed = b"{ not valid json at all";
        std::fs::write(&path, malformed).unwrap();

        let store = JsonAuthStore::open_sqlite(&path).unwrap();
        // Degrades to defaults: no settings for an unknown user, no panic.
        assert!(store.get_settings("nobody").unwrap().is_none());

        // The ORIGINAL bytes on disk are untouched — a read-only open must not overwrite a
        // corrupt file just because it failed to parse.
        let bytes_after = std::fs::read(&path).unwrap();
        assert_eq!(bytes_after.as_slice(), malformed);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn zero_is_storable_as_a_value_and_absent_is_a_distinct_state() {
        let store = AuthStore::open_memory().unwrap();
        let u = store.create_user("risk@ex.com", Some("h"), None).unwrap();

        // Absent: never set.
        let s0 = store.get_settings(&u.id).unwrap();
        assert!(s0.is_none() || s0.unwrap().risk_account_size.is_none());

        // Zero IS a legal stored value — never coerced to "unset".
        let s1 = store
            .update_settings(
                &u.id,
                &SettingsPatch {
                    risk_account_size: Some(Some(0.0)),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(s1.risk_account_size, Some(0.0));

        // Clearing (inner None) is a DIFFERENT, distinct state from "set to zero".
        let s2 = store
            .update_settings(
                &u.id,
                &SettingsPatch {
                    risk_account_size: Some(None),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(s2.risk_account_size, None);
    }
}
