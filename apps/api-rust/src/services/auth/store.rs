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

#[derive(Default, Serialize, Deserialize)]
struct DiskAuth {
    users: HashMap<String, UserRecord>,
    /// email_lower → user_id
    by_email: HashMap<String, String>,
    sessions: HashMap<String, SessionRecord>,
    settings: HashMap<String, SettingsRecord>,
    /// (user_id, kind) → credential
    #[serde(default)]
    credentials: HashMap<String, CredentialRecord>,
}

#[derive(Clone)]
pub struct JsonAuthStore {
    state: Arc<Mutex<DiskAuth>>,
    path: Option<PathBuf>,
}

impl JsonAuthStore {
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
        let rec = SettingsRecord {
            user_id: user_id.into(),
            active_persona_id: None,
            default_ticker: None,
            theme: "dark".into(),
            scan_view: None,
        };
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.settings.insert(user_id.into(), rec.clone());
        self.persist_locked(&g);
        Ok(rec)
    }

    fn cred_key(user_id: &str, kind: &str) -> String {
        format!("{user_id}::{kind}")
    }

    pub fn get_credential(
        &self,
        user_id: &str,
        kind: &str,
    ) -> AppResult<Option<CredentialRecord>> {
        let g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        Ok(g.credentials.get(&Self::cred_key(user_id, kind)).cloned())
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
        let k = Self::cred_key(user_id, kind);
        let created = g
            .credentials
            .get(&k)
            .map(|c| c.created_at)
            .unwrap_or(now);
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

    pub fn delete_credential(&self, user_id: &str, kind: &str) -> AppResult<()> {
        let mut g = self.state.lock().unwrap_or_else(|e| e.into_inner());
        g.credentials.remove(&Self::cred_key(user_id, kind));
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
            cur.active_persona_id = if v.is_empty() {
                None
            } else {
                Some(v.clone())
            };
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
    ) -> AppResult<Option<CredentialRecord>> {
        match self {
            Self::Json(s) => s.get_credential(user_id, kind),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.get_credential(user_id, kind),
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
    pub fn delete_credential(&self, user_id: &str, kind: &str) -> AppResult<()> {
        match self {
            Self::Json(s) => s.delete_credential(user_id, kind),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.delete_credential(user_id, kind),
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
        assert!(store.get_user_by_email("test@example.com").unwrap().is_some());
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
        let rec = store.get_credential(&u.id, "ai").unwrap().unwrap();
        assert_eq!(rec.last4, "abcd");
        assert_eq!(rec.provider, "openai");
        store.delete_credential(&u.id, "ai").unwrap();
        assert!(store.get_credential(&u.id, "ai").unwrap().is_none());
    }
}
