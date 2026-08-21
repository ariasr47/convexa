//! Google OAuth — Authorization-Code flow, **config-gated off** when creds absent.
//!
//! Env (all required for `available()`):
//! - `GOOGLE_CLIENT_ID`
//! - `GOOGLE_CLIENT_SECRET`
//! - `GOOGLE_REDIRECT_URI`
//!
//! Absent creds ⇒ `available() == false`, no crash; FE keeps Google button disabled.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::warn;
use url::form_urlencoded;

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPE: &str = "openid email profile";
const STATE_TTL_SECS: f64 = 600.0;

static OAUTH_STATES: Mutex<Option<HashMap<String, f64>>> = Mutex::new(None);

fn now_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn client_id() -> Option<String> {
    std::env::var("GOOGLE_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
fn client_secret() -> Option<String> {
    std::env::var("GOOGLE_CLIENT_SECRET")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
fn redirect_uri() -> Option<String> {
    std::env::var("GOOGLE_REDIRECT_URI")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// True iff all three Google creds are configured (drives `google_available`).
pub fn available() -> bool {
    client_id().is_some() && client_secret().is_some() && redirect_uri().is_some()
}

/// Issue anti-CSRF state and build the Google consent URL.
pub fn authorization_url(state: &str) -> Option<String> {
    let cid = client_id()?;
    let redir = redirect_uri()?;
    let qs = form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", &cid)
        .append_pair("redirect_uri", &redir)
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPE)
        .append_pair("state", state)
        .append_pair("access_type", "online")
        .append_pair("prompt", "select_account")
        .finish();
    Some(format!("{AUTH_ENDPOINT}?{qs}"))
}

pub fn remember_state(state: &str) {
    let mut g = OAUTH_STATES.lock().unwrap_or_else(|e| e.into_inner());
    let map = g.get_or_insert_with(HashMap::new);
    let cutoff = now_secs() - STATE_TTL_SECS;
    map.retain(|_, t| *t >= cutoff);
    map.insert(state.to_string(), now_secs());
}

pub fn consume_state(state: Option<&str>) -> bool {
    let Some(state) = state.filter(|s| !s.is_empty()) else {
        return false;
    };
    let mut g = OAUTH_STATES.lock().unwrap_or_else(|e| e.into_inner());
    let map = g.get_or_insert_with(HashMap::new);
    match map.remove(state) {
        Some(t) => (now_secs() - t) <= STATE_TTL_SECS,
        None => false,
    }
}

#[derive(Debug, Clone)]
pub struct GoogleIdentity {
    pub sub: String,
    pub email: String,
    pub email_verified: bool,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserInfo {
    sub: Option<String>,
    email: Option<String>,
    email_verified: Option<bool>,
    name: Option<String>,
}

/// Server-side code → token → userinfo. Tokens never leave this process.
pub async fn exchange(code: &str) -> Result<GoogleIdentity, String> {
    let cid = client_id().ok_or_else(|| "google unconfigured".to_string())?;
    let secret = client_secret().ok_or_else(|| "google unconfigured".to_string())?;
    let redir = redirect_uri().ok_or_else(|| "google unconfigured".to_string())?;

    let client = reqwest::Client::new();
    let token_res = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("code", code),
            ("client_id", cid.as_str()),
            ("client_secret", secret.as_str()),
            ("redirect_uri", redir.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| {
            warn!(error = %e, "google token exchange HTTP failed");
            "token exchange failed".to_string()
        })?;
    if !token_res.status().is_success() {
        return Err("token exchange rejected".into());
    }
    let token: TokenResponse = token_res
        .json()
        .await
        .map_err(|_| "token parse failed".to_string())?;
    let access = token
        .access_token
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "no access_token".to_string())?;

    let info_res = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(access)
        .send()
        .await
        .map_err(|_| "userinfo failed".to_string())?;
    if !info_res.status().is_success() {
        return Err("userinfo rejected".into());
    }
    let info: UserInfo = info_res
        .json()
        .await
        .map_err(|_| "userinfo parse failed".to_string())?;
    let sub = info
        .sub
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "no sub".to_string())?;
    let email = info.email.unwrap_or_default().trim().to_string();
    Ok(GoogleIdentity {
        sub,
        email,
        email_verified: info.email_verified.unwrap_or(false),
        name: info.name.filter(|s| !s.trim().is_empty()),
    })
}
