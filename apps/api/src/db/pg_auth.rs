//! Postgres-backed auth stores (users / sessions / settings / credentials).

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::auth::{
    CredentialRecord, GrokLinkRecord, SessionRecord, SettingsPatch, SettingsRecord, UserRecord,
};
use sqlx::Row;
use tracing::warn;

#[derive(Clone)]
pub struct PgAuthStore {
    pg: Pg,
}

impl PgAuthStore {
    pub fn new(pg: Pg) -> Self {
        Self { pg }
    }

    fn block<T, Fut>(&self, f: impl FnOnce(Pg) -> Fut + Send) -> AppResult<T>
    where
        Fut: std::future::Future<Output = AppResult<T>> + Send,
        T: Send,
    {
        let handle = tokio::runtime::Handle::current();
        let pg = self.pg.clone();
        tokio::task::block_in_place(|| handle.block_on(f(pg)))
    }

    pub fn get_user_by_id(&self, user_id: &str) -> AppResult<Option<UserRecord>> {
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT id, email, display_name, password_hash, google_sub,
                              created_at, last_login_at FROM users WHERE id = $1"#,
            )
            .bind(&uid)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(map_user))
        })
    }

    pub fn get_user_by_email(&self, email: &str) -> AppResult<Option<UserRecord>> {
        let lower = email.trim().to_ascii_lowercase();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT id, email, display_name, password_hash, google_sub,
                              created_at, last_login_at FROM users WHERE email_lower = $1"#,
            )
            .bind(&lower)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(map_user))
        })
    }

    pub fn create_user(
        &self,
        email: &str,
        password_hash: Option<&str>,
        display_name: Option<&str>,
    ) -> AppResult<UserRecord> {
        let email = email.trim().to_string();
        let email_lower = email.to_ascii_lowercase();
        let id = new_id();
        let now = now_secs();
        let ph = password_hash.map(|s| s.to_string());
        let dn = display_name.map(|s| s.to_string());
        let user = UserRecord {
            id: id.clone(),
            email: email.clone(),
            display_name: dn.clone(),
            password_hash: ph.clone(),
            google_sub: None,
            created_at: now,
            last_login_at: None,
        };
        self.block(move |pg| async move {
            let res = sqlx::query(
                r#"INSERT INTO users (id, email, email_lower, display_name, password_hash,
                        google_sub, created_at, last_login_at)
                       VALUES ($1,$2,$3,$4,$5,NULL,$6,NULL)"#,
            )
            .bind(&id)
            .bind(&email)
            .bind(&email_lower)
            .bind(&dn)
            .bind(&ph)
            .bind(now)
            .execute(&pg.pool)
            .await;
            match res {
                Ok(_) => Ok(()),
                Err(e) if is_unique(&e) => Err(AppError::Other(anyhow::anyhow!("email_taken"))),
                Err(e) => Err(pg_err(e)),
            }
        })?;
        Ok(user)
    }

    pub fn mark_login(&self, user_id: &str, when: f64) -> AppResult<()> {
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            sqlx::query("UPDATE users SET last_login_at = $1 WHERE id = $2")
                .bind(when)
                .bind(&uid)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn get_by_google_sub(&self, sub: &str) -> AppResult<Option<UserRecord>> {
        let s = sub.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT id, email, display_name, password_hash, google_sub,
                              created_at, last_login_at FROM users WHERE google_sub = $1"#,
            )
            .bind(&s)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(map_user))
        })
    }

    pub fn attach_google(&self, user_id: &str, google_sub: &str) -> AppResult<Option<UserRecord>> {
        let uid = user_id.to_string();
        let sub = google_sub.to_string();
        self.block(move |pg| async move {
            sqlx::query("UPDATE users SET google_sub = $1 WHERE id = $2")
                .bind(&sub)
                .bind(&uid)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
            let row = sqlx::query(
                r#"SELECT id, email, display_name, password_hash, google_sub,
                              created_at, last_login_at FROM users WHERE id = $1"#,
            )
            .bind(&uid)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(map_user))
        })
    }

    pub fn create_google_user(
        &self,
        email: &str,
        display_name: Option<&str>,
        google_sub: &str,
    ) -> AppResult<UserRecord> {
        let email = email.trim().to_string();
        let email_lower = email.to_ascii_lowercase();
        let id = new_id();
        let now = now_secs();
        let dn = display_name.map(|s| s.to_string());
        let sub = google_sub.to_string();
        let user = UserRecord {
            id: id.clone(),
            email: email.clone(),
            display_name: dn.clone(),
            password_hash: None,
            google_sub: Some(sub.clone()),
            created_at: now,
            last_login_at: None,
        };
        self.block(move |pg| async move {
            sqlx::query(
                r#"INSERT INTO users (id, email, email_lower, display_name, password_hash,
                        google_sub, created_at, last_login_at)
                       VALUES ($1,$2,$3,$4,NULL,$5,$6,NULL)"#,
            )
            .bind(&id)
            .bind(&email)
            .bind(&email_lower)
            .bind(&dn)
            .bind(&sub)
            .bind(now)
            .execute(&pg.pool)
            .await
            .map_err(|e| {
                if is_unique(&e) {
                    AppError::Other(anyhow::anyhow!("email_taken"))
                } else {
                    pg_err(e)
                }
            })?;
            Ok(())
        })?;
        Ok(user)
    }

    pub fn create_session(&self, s: &SessionRecord) -> AppResult<()> {
        let s = s.clone();
        self.block(move |pg| async move {
            sqlx::query(
                r#"INSERT INTO sessions (id, user_id, created_at, expires_at,
                        absolute_expires_at, revoked)
                       VALUES ($1,$2,$3,$4,$5,$6)"#,
            )
            .bind(&s.id)
            .bind(&s.user_id)
            .bind(s.created_at)
            .bind(s.expires_at)
            .bind(s.absolute_expires_at)
            .bind(s.revoked)
            .execute(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn get_session(&self, session_id: &str) -> AppResult<Option<SessionRecord>> {
        let sid = session_id.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT id, user_id, created_at, expires_at, absolute_expires_at, revoked
                       FROM sessions WHERE id = $1"#,
            )
            .bind(&sid)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(|r| SessionRecord {
                id: r.get("id"),
                user_id: r.get("user_id"),
                created_at: r.get("created_at"),
                expires_at: r.get("expires_at"),
                absolute_expires_at: r.get("absolute_expires_at"),
                revoked: r.get("revoked"),
            }))
        })
    }

    pub fn touch_session(&self, session_id: &str, new_expires_at: f64) -> AppResult<()> {
        let sid = session_id.to_string();
        self.block(move |pg| async move {
            sqlx::query("UPDATE sessions SET expires_at = $1 WHERE id = $2")
                .bind(new_expires_at)
                .bind(&sid)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn revoke_session(&self, session_id: &str) -> AppResult<()> {
        let sid = session_id.to_string();
        self.block(move |pg| async move {
            sqlx::query("UPDATE sessions SET revoked = TRUE WHERE id = $1")
                .bind(&sid)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn get_settings(&self, user_id: &str) -> AppResult<Option<SettingsRecord>> {
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT user_id, active_persona_id, default_ticker, theme, scan_view,
                              risk_account_size, risk_cap_value, risk_cap_unit, risk_updated_at,
                              ai_power_path, ai_provider, ai_model
                       FROM user_settings WHERE user_id = $1"#,
            )
            .bind(&uid)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(|r| SettingsRecord {
                user_id: r.get("user_id"),
                active_persona_id: r.get("active_persona_id"),
                default_ticker: r.get("default_ticker"),
                theme: r.get("theme"),
                scan_view: r.get("scan_view"),
                risk_account_size: r.get("risk_account_size"),
                risk_cap_value: r.get("risk_cap_value"),
                risk_cap_unit: r.get("risk_cap_unit"),
                risk_updated_at: r.get("risk_updated_at"),
                ai_power_path: r.get("ai_power_path"),
                ai_provider: r.get("ai_provider"),
                ai_model: r.get("ai_model"),
            }))
        })
    }

    pub fn upsert_settings_defaults(&self, user_id: &str) -> AppResult<SettingsRecord> {
        if let Some(s) = self.get_settings(user_id)? {
            return Ok(s);
        }
        let rec = SettingsRecord::defaults(user_id);
        let r = rec.clone();
        self.block(move |pg| async move {
                sqlx::query(
                    r#"INSERT INTO user_settings (user_id, active_persona_id, default_ticker, theme, scan_view)
                       VALUES ($1,NULL,NULL,'dark',NULL)
                       ON CONFLICT (user_id) DO NOTHING"#,
                )
                .bind(&r.user_id)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
                Ok(())
        })?;
        Ok(rec)
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
            cur.default_ticker = if v.is_empty() { None } else { Some(v.clone()) };
        }
        if let Some(ref v) = patch.theme {
            cur.theme = v.clone();
        }
        if let Some(ref v) = patch.scan_view {
            cur.scan_view = Some(v.clone());
        }
        if let Some(v) = patch.risk_account_size {
            cur.risk_account_size = v;
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
        let r = cur.clone();
        self.block(move |pg| async move {
                sqlx::query(
                    r#"INSERT INTO user_settings (user_id, active_persona_id, default_ticker, theme, scan_view,
                        risk_account_size, risk_cap_value, risk_cap_unit, risk_updated_at,
                        ai_power_path, ai_provider, ai_model)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                       ON CONFLICT (user_id) DO UPDATE SET
                         active_persona_id = EXCLUDED.active_persona_id,
                         default_ticker = EXCLUDED.default_ticker,
                         theme = EXCLUDED.theme,
                         scan_view = EXCLUDED.scan_view,
                         risk_account_size = EXCLUDED.risk_account_size,
                         risk_cap_value = EXCLUDED.risk_cap_value,
                         risk_cap_unit = EXCLUDED.risk_cap_unit,
                         risk_updated_at = EXCLUDED.risk_updated_at,
                         ai_power_path = EXCLUDED.ai_power_path,
                         ai_provider = EXCLUDED.ai_provider,
                         ai_model = EXCLUDED.ai_model"#,
                )
                .bind(&r.user_id)
                .bind(&r.active_persona_id)
                .bind(&r.default_ticker)
                .bind(&r.theme)
                .bind(&r.scan_view)
                .bind(r.risk_account_size)
                .bind(r.risk_cap_value)
                .bind(&r.risk_cap_unit)
                .bind(r.risk_updated_at)
                .bind(&r.ai_power_path)
                .bind(&r.ai_provider)
                .bind(&r.ai_model)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
                Ok(())
        })?;
        Ok(cur)
    }

    pub fn promote_legacy_ai(&self, user_id: &str) -> AppResult<()> {
        // v9 already folds the row into (user_id, kind, provider). Backfill preference
        // so existing BYO users are not AC-13-bricked.
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            let rows = sqlx::query(
                r#"SELECT provider FROM credentials WHERE user_id = $1 AND kind = 'ai'"#,
            )
            .bind(&uid)
            .fetch_all(&pg.pool)
            .await
            .map_err(pg_err)?;
            let trader = rows.iter().find_map(|r| {
                let p: String = r.get("provider");
                if crate::services::llm_catalog::is_trader_byo(&p) {
                    Some(p)
                } else {
                    None
                }
            });
            let Some(provider) = trader else {
                return Ok(());
            };
            sqlx::query(
                r#"INSERT INTO user_settings (user_id, theme, ai_power_path, ai_provider)
                   VALUES ($1, 'dark', 'own_key', $2)
                   ON CONFLICT (user_id) DO UPDATE SET
                     ai_power_path = COALESCE(user_settings.ai_power_path, EXCLUDED.ai_power_path),
                     ai_provider   = CASE
                       WHEN user_settings.ai_power_path IS NULL THEN EXCLUDED.ai_provider
                       ELSE user_settings.ai_provider
                     END"#,
            )
            .bind(&uid)
            .bind(&provider)
            .execute(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn get_credential(
        &self,
        user_id: &str,
        kind: &str,
        provider: &str,
    ) -> AppResult<Option<CredentialRecord>> {
        let uid = user_id.to_string();
        let k = kind.to_string();
        let p = provider.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT user_id, kind, ciphertext, last4, provider, created_at, updated_at
                       FROM credentials WHERE user_id = $1 AND kind = $2 AND provider = $3"#,
            )
            .bind(&uid)
            .bind(&k)
            .bind(&p)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(map_credential))
        })
    }

    pub fn list_credentials(&self, user_id: &str, kind: &str) -> AppResult<Vec<CredentialRecord>> {
        if kind == "ai" {
            let _ = self.promote_legacy_ai(user_id);
        }
        let uid = user_id.to_string();
        let k = kind.to_string();
        self.block(move |pg| async move {
            let rows = sqlx::query(
                r#"SELECT user_id, kind, ciphertext, last4, provider, created_at, updated_at
                       FROM credentials WHERE user_id = $1 AND kind = $2"#,
            )
            .bind(&uid)
            .bind(&k)
            .fetch_all(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(rows.into_iter().map(map_credential).collect())
        })
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
        let uid = user_id.to_string();
        let k = kind.to_string();
        let ct = ciphertext.to_string();
        let l4 = last4.to_string();
        let prov = provider.to_string();
        self.block(move |pg| async move {
                sqlx::query(
                    r#"INSERT INTO credentials (user_id, kind, ciphertext, last4, provider, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$6)
                       ON CONFLICT (user_id, kind, provider) DO UPDATE SET
                         ciphertext = EXCLUDED.ciphertext,
                         last4 = EXCLUDED.last4,
                         updated_at = EXCLUDED.updated_at"#,
                )
                .bind(&uid)
                .bind(&k)
                .bind(&ct)
                .bind(&l4)
                .bind(&prov)
                .bind(now)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
                Ok(())
        })
    }

    pub fn delete_credential(&self, user_id: &str, kind: &str, provider: &str) -> AppResult<()> {
        let uid = user_id.to_string();
        let k = kind.to_string();
        let p = provider.to_string();
        self.block(move |pg| async move {
            sqlx::query(
                "DELETE FROM credentials WHERE user_id = $1 AND kind = $2 AND provider = $3",
            )
            .bind(&uid)
            .bind(&k)
            .bind(&p)
            .execute(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn get_grok_link(&self, user_id: &str) -> AppResult<Option<GrokLinkRecord>> {
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            let row = sqlx::query(
                r#"SELECT user_id, status, encrypted_material, updated_at
                   FROM grok_links WHERE user_id = $1"#,
            )
            .bind(&uid)
            .fetch_optional(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(row.map(|r| GrokLinkRecord {
                user_id: r.get("user_id"),
                status: r.get("status"),
                encrypted_material: r.get("encrypted_material"),
                updated_at: r.get("updated_at"),
            }))
        })
    }

    pub fn set_grok_link(&self, rec: &GrokLinkRecord) -> AppResult<()> {
        let rec = rec.clone();
        self.block(move |pg| async move {
            sqlx::query(
                r#"INSERT INTO grok_links (user_id, status, encrypted_material, updated_at)
                   VALUES ($1,$2,$3,$4)
                   ON CONFLICT (user_id) DO UPDATE SET
                     status = EXCLUDED.status,
                     encrypted_material = EXCLUDED.encrypted_material,
                     updated_at = EXCLUDED.updated_at"#,
            )
            .bind(&rec.user_id)
            .bind(&rec.status)
            .bind(&rec.encrypted_material)
            .bind(rec.updated_at)
            .execute(&pg.pool)
            .await
            .map_err(pg_err)?;
            Ok(())
        })
    }

    pub fn delete_grok_link(&self, user_id: &str) -> AppResult<()> {
        let uid = user_id.to_string();
        self.block(move |pg| async move {
            sqlx::query("DELETE FROM grok_links WHERE user_id = $1")
                .bind(&uid)
                .execute(&pg.pool)
                .await
                .map_err(pg_err)?;
            Ok(())
        })
    }
}

fn map_credential(r: sqlx::postgres::PgRow) -> CredentialRecord {
    CredentialRecord {
        user_id: r.get("user_id"),
        kind: r.get("kind"),
        ciphertext: r.get("ciphertext"),
        last4: r.get("last4"),
        provider: r.get("provider"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

fn map_user(r: sqlx::postgres::PgRow) -> UserRecord {
    UserRecord {
        id: r.get("id"),
        email: r.get("email"),
        display_name: r.get("display_name"),
        password_hash: r.get("password_hash"),
        google_sub: r.get("google_sub"),
        created_at: r.get("created_at"),
        last_login_at: r.get("last_login_at"),
    }
}

fn pg_err(e: sqlx::Error) -> AppError {
    warn!(error = %e, "postgres auth op failed");
    AppError::Config(format!("postgres: {e}"))
}

fn is_unique(e: &sqlx::Error) -> bool {
    match e {
        sqlx::Error::Database(db) => db.code().as_deref() == Some("23505"),
        _ => false,
    }
}

fn new_id() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
}
