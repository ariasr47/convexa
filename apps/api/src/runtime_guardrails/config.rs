use super::origins::{AllowedBrowserOrigins, OriginError};
use crate::config::Config;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::de::{MapAccess, Visitor};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    Prod,
    Dev,
    Test,
    Staging,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HostContext {
    pub railway: bool,
    pub release: bool,
}

#[derive(Clone)]
pub struct RawRuntimeConfig {
    pub app_env: Option<String>,
    pub config: Config,
    pub database_url: Option<String>,
    pub allowed_browser_origins: Option<String>,
    pub metrics_secret_token: Option<String>,
    pub session_active_key_id: Option<String>,
    pub session_keys_json: Option<String>,
    pub session_legacy_key: Option<String>,
    pub encryption_active_key_id: Option<String>,
    pub encryption_keys_json: Option<String>,
    pub encryption_legacy_key: Option<String>,
    pub cookie_domain: Option<String>,
    pub cookie_http_only: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
pub enum ViolationCategory {
    RuntimeMode,
    DurableStore,
    ArchiveBodyRoot,
    SessionSigning,
    ApiKeyEncryption,
    ApiKeyRotation,
    OperatorMetrics,
    AllowedBrowserOrigins,
    SessionCookies,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
pub enum ViolationReason {
    MissingMode,
    UnknownMode,
    PostgresAbsent,
    PostgresInvalid,
    ArchiveAbsent,
    ArchiveConflict,
    SigningAbsent,
    SigningInvalid,
    EncryptionAbsent,
    EncryptionInvalid,
    RotationDuplicateId,
    RotationActiveMissing,
    RotationMaterialInvalid,
    LegacyDecoderMissing,
    MetricsInvalid,
    OriginsMissing,
    OriginsWildcard,
    OriginsMalformed,
    OriginsTransport,
    CookiesInvalid,
}

impl ViolationReason {
    pub fn message(self) -> &'static str {
        match self {
        Self::MissingMode|Self::UnknownMode => "Runtime mode: set APP_ENV to prod, dev, test, or staging.",
        Self::PostgresAbsent|Self::PostgresInvalid => "Durable store: configure Postgres for production state.",
        Self::ArchiveAbsent|Self::ArchiveConflict => "Archive body root: configure an explicit production path.",
        Self::SigningAbsent|Self::SigningInvalid => "Session signing: configure one valid active production key.",
        Self::EncryptionAbsent|Self::EncryptionInvalid => "API-key encryption: configure one valid active production key.",
        Self::RotationDuplicateId => "API-key rotation: key identifiers must be unique.",
        Self::RotationActiveMissing => "API-key rotation: the active key must name a configured key.",
        Self::RotationMaterialInvalid => "API-key rotation: key material must be valid and distinct.",
        Self::LegacyDecoderMissing => "API-key rotation: configure the required legacy decoder.",
        Self::MetricsInvalid => "Operator metrics: require authenticated access in production.",
        Self::OriginsMissing => "Allowed browser origins: configure one or more explicit origins.",
        Self::OriginsWildcard => "Allowed browser origins: wildcard origins are not allowed.",
        Self::OriginsMalformed => "Allowed browser origins: each entry must be an origin without credentials, path, query, or fragment.",
        Self::OriginsTransport => "Allowed browser origins: use HTTPS in production.",
        Self::CookiesInvalid => "Session cookies: production requires a host-only, Secure, HttpOnly, SameSite=Lax cookie.",
    }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
pub struct BootstrapViolation {
    pub category: ViolationCategory,
    pub reason: ViolationReason,
}
impl BootstrapViolation {
    pub fn render(&self) -> String {
        self.reason.message().into()
    }
}

#[derive(Debug, Clone)]
pub struct BootstrapRefusal {
    pub violations: Vec<BootstrapViolation>,
}
impl BootstrapRefusal {
    pub fn new(mut violations: Vec<BootstrapViolation>) -> Self {
        violations.sort_by_key(|violation| (violation.category, violation.reason));
        violations.dedup();
        Self { violations }
    }
}
impl fmt::Display for BootstrapRefusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Production startup refused")
    }
}
impl std::error::Error for BootstrapRefusal {}

#[derive(Clone)]
pub struct SecretBytes(Vec<u8>);
impl SecretBytes {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}
impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("SecretBytes([REDACTED])")
    }
}

pub type KeyId = String;

#[derive(Clone)]
pub struct KeyRingMaterial {
    pub active: KeyId,
    pub keys: BTreeMap<KeyId, SecretBytes>,
    pub legacy: Option<SecretBytes>,
}

#[derive(Clone)]
pub struct ProductionRuntime {
    pub database_url: String,
    pub archive_root: std::path::PathBuf,
    pub origins: AllowedBrowserOrigins,
    pub metrics_token: SecretBytes,
    pub session: KeyRingMaterial,
    pub encryption: KeyRingMaterial,
}

#[derive(Clone)]
pub struct NonProductionRuntime;

pub enum ValidatedRuntimeConfig {
    Production(Box<ProductionRuntime>),
    Development(NonProductionRuntime),
    Test(NonProductionRuntime),
    Staging(NonProductionRuntime),
}

pub fn classify_mode(
    raw: Option<&str>,
    host: HostContext,
) -> Result<RuntimeMode, BootstrapViolation> {
    match raw {
        Some("prod") => Ok(RuntimeMode::Prod),
        Some("dev") => Ok(RuntimeMode::Dev),
        Some("test") => Ok(RuntimeMode::Test),
        Some("staging") => Ok(RuntimeMode::Staging),
        Some(_) => Err(BootstrapViolation {
            category: ViolationCategory::RuntimeMode,
            reason: ViolationReason::UnknownMode,
        }),
        None if !host.railway && !host.release => Ok(RuntimeMode::Dev),
        None => Err(BootstrapViolation {
            category: ViolationCategory::RuntimeMode,
            reason: ViolationReason::MissingMode,
        }),
    }
}

impl RawRuntimeConfig {
    pub fn from_values(config: Config, env: &std::collections::HashMap<String, String>) -> Self {
        let get = |k: &str| env.get(k).cloned().filter(|v| !v.trim().is_empty());
        Self {
            app_env: get("APP_ENV"),
            config,
            database_url: get("DATABASE_URL"),
            allowed_browser_origins: get("ALLOWED_BROWSER_ORIGINS"),
            metrics_secret_token: get("METRICS_SECRET_TOKEN"),
            session_active_key_id: get("AUTH_SESSION_ACTIVE_KEY_ID"),
            session_keys_json: get("AUTH_SESSION_KEYS_JSON"),
            session_legacy_key: get("AUTH_SESSION_SIGNING_KEY"),
            encryption_active_key_id: get("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID"),
            encryption_keys_json: get("AI_KEY_ENCRYPTION_KEYS_JSON"),
            encryption_legacy_key: get("AI_KEY_ENCRYPTION_KEY"),
            cookie_domain: get("AUTH_COOKIE_DOMAIN"),
            cookie_http_only: get("AUTH_COOKIE_HTTP_ONLY"),
        }
    }
}

fn placeholder(s: &str) -> bool {
    let l = s.to_ascii_lowercase();
    [
        "replace",
        "example",
        "changeme",
        "placeholder",
        "your_",
        "test-token",
    ]
    .iter()
    .any(|p| l.contains(p))
}

fn parse_metrics_token(raw: Option<&str>) -> Option<SecretBytes> {
    let raw = raw?.trim();
    if raw.is_empty() || placeholder(raw) {
        return None;
    }
    URL_SAFE_NO_PAD
        .decode(raw)
        .ok()
        .filter(|bytes| bytes.len() >= 32)
        .map(SecretBytes)
}

fn parse_ring(
    active: &Option<String>,
    map: &Option<String>,
    legacy: &Option<String>,
    encryption: bool,
    out: &mut Vec<BootstrapViolation>,
) -> Option<KeyRingMaterial> {
    let (Some(active), Some(map)) = (active.as_ref(), map.as_ref()) else {
        out.push(BootstrapViolation {
            category: if encryption {
                ViolationCategory::ApiKeyEncryption
            } else {
                ViolationCategory::SessionSigning
            },
            reason: if encryption {
                ViolationReason::EncryptionAbsent
            } else {
                ViolationReason::SigningAbsent
            },
        });
        return None;
    };
    let strict: StrictKeyMap = match serde_json::from_str(map) {
        Ok(v) => v,
        Err(_) => {
            out.push(BootstrapViolation {
                category: if encryption {
                    ViolationCategory::ApiKeyEncryption
                } else {
                    ViolationCategory::SessionSigning
                },
                reason: if encryption {
                    ViolationReason::EncryptionInvalid
                } else {
                    ViolationReason::SigningInvalid
                },
            });
            return None;
        }
    };
    if strict.duplicate_id {
        out.push(BootstrapViolation {
            category: ViolationCategory::ApiKeyRotation,
            reason: ViolationReason::RotationDuplicateId,
        });
    }
    let obj = strict.values;
    if obj.is_empty() {
        out.push(BootstrapViolation {
            category: ViolationCategory::ApiKeyRotation,
            reason: ViolationReason::RotationMaterialInvalid,
        });
        return None;
    }
    let mut keys = BTreeMap::new();
    let mut mats = BTreeSet::new();
    for (id, val) in obj {
        if !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
            || id.is_empty()
            || id.len() > 32
        {
            out.push(BootstrapViolation {
                category: ViolationCategory::ApiKeyRotation,
                reason: ViolationReason::RotationDuplicateId,
            });
            continue;
        }
        let Some(s) = val.as_str() else {
            out.push(BootstrapViolation {
                category: ViolationCategory::ApiKeyRotation,
                reason: ViolationReason::RotationMaterialInvalid,
            });
            continue;
        };
        let Ok(bytes) = URL_SAFE_NO_PAD.decode(s) else {
            out.push(BootstrapViolation {
                category: ViolationCategory::ApiKeyRotation,
                reason: ViolationReason::RotationMaterialInvalid,
            });
            continue;
        };
        if bytes.len() != 32 || placeholder(s) || !mats.insert(bytes.clone()) {
            out.push(BootstrapViolation {
                category: ViolationCategory::ApiKeyRotation,
                reason: ViolationReason::RotationMaterialInvalid,
            });
            continue;
        }
        keys.insert(id, SecretBytes(bytes));
    }
    if !keys.contains_key(active) {
        out.push(BootstrapViolation {
            category: ViolationCategory::ApiKeyRotation,
            reason: ViolationReason::RotationActiveMissing,
        });
    }
    if legacy.is_none() {
        out.push(BootstrapViolation {
            category: ViolationCategory::ApiKeyRotation,
            reason: ViolationReason::LegacyDecoderMissing,
        });
    }
    Some(KeyRingMaterial {
        active: active.clone(),
        keys,
        legacy: legacy.as_ref().map(|s| SecretBytes(s.as_bytes().to_vec())),
    })
}

struct StrictKeyMap {
    values: Vec<(String, Value)>,
    duplicate_id: bool,
}

impl<'de> Deserialize<'de> for StrictKeyMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct StrictKeyMapVisitor;
        impl<'de> Visitor<'de> for StrictKeyMapVisitor {
            type Value = StrictKeyMap;
            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a JSON object of addressed key material")
            }
            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut seen = BTreeSet::new();
                let mut values = Vec::new();
                let mut duplicate_id = false;
                while let Some((key, value)) = map.next_entry::<String, Value>()? {
                    if !seen.insert(key.clone()) {
                        duplicate_id = true;
                    } else {
                        values.push((key, value));
                    }
                }
                Ok(StrictKeyMap {
                    values,
                    duplicate_id,
                })
            }
        }
        deserializer.deserialize_map(StrictKeyMapVisitor)
    }
}

impl TryFrom<RawRuntimeConfig> for ProductionRuntime {
    type Error = BootstrapRefusal;
    fn try_from(raw: RawRuntimeConfig) -> Result<Self, Self::Error> {
        let mut v = Vec::new();
        if raw
            .database_url
            .as_deref()
            .map(|s| s.trim().is_empty() || placeholder(s))
            .unwrap_or(true)
        {
            v.push(BootstrapViolation {
                category: ViolationCategory::DurableStore,
                reason: ViolationReason::PostgresAbsent,
            });
        }
        let archive = raw.config.session_chain_archive_body_root.clone();
        if archive.is_none() {
            v.push(BootstrapViolation {
                category: ViolationCategory::ArchiveBodyRoot,
                reason: ViolationReason::ArchiveAbsent,
            });
        }
        let origins = match raw.allowed_browser_origins.as_deref() {
            None => {
                v.push(BootstrapViolation {
                    category: ViolationCategory::AllowedBrowserOrigins,
                    reason: ViolationReason::OriginsMissing,
                });
                None
            }
            Some(s) => match AllowedBrowserOrigins::parse(s) {
                Ok(x) => Some(x),
                Err(OriginError::Wildcard) => {
                    v.push(BootstrapViolation {
                        category: ViolationCategory::AllowedBrowserOrigins,
                        reason: ViolationReason::OriginsWildcard,
                    });
                    None
                }
                Err(OriginError::Transport) => {
                    v.push(BootstrapViolation {
                        category: ViolationCategory::AllowedBrowserOrigins,
                        reason: ViolationReason::OriginsTransport,
                    });
                    None
                }
                Err(_) => {
                    v.push(BootstrapViolation {
                        category: ViolationCategory::AllowedBrowserOrigins,
                        reason: ViolationReason::OriginsMalformed,
                    });
                    None
                }
            },
        };
        let metrics = match parse_metrics_token(raw.metrics_secret_token.as_deref()) {
            Some(bytes) => Some(bytes),
            None => {
                v.push(BootstrapViolation {
                    category: ViolationCategory::OperatorMetrics,
                    reason: ViolationReason::MetricsInvalid,
                });
                None
            }
        };
        let session = parse_ring(
            &raw.session_active_key_id,
            &raw.session_keys_json,
            &raw.session_legacy_key,
            false,
            &mut v,
        );
        let encryption = parse_ring(
            &raw.encryption_active_key_id,
            &raw.encryption_keys_json,
            &raw.encryption_legacy_key,
            true,
            &mut v,
        );
        if raw.cookie_domain.is_some()
            || raw
                .cookie_http_only
                .as_deref()
                .map(|s| {
                    matches!(
                        s.to_ascii_lowercase().as_str(),
                        "0" | "false" | "no" | "off"
                    )
                })
                .unwrap_or(false)
            || !raw.config.auth_cookie_secure
            || !raw.config.auth_cookie_samesite.eq_ignore_ascii_case("lax")
        {
            v.push(BootstrapViolation {
                category: ViolationCategory::SessionCookies,
                reason: ViolationReason::CookiesInvalid,
            });
        }
        let refusal = BootstrapRefusal::new(v);
        if !refusal.violations.is_empty() {
            return Err(refusal);
        }
        Ok(Self {
            database_url: raw.database_url.unwrap(),
            archive_root: archive.unwrap(),
            origins: origins.unwrap(),
            metrics_token: metrics.unwrap(),
            session: session.unwrap(),
            encryption: encryption.unwrap(),
        })
    }
}

impl TryFrom<RawRuntimeConfig> for ValidatedRuntimeConfig {
    type Error = BootstrapRefusal;
    fn try_from(raw: RawRuntimeConfig) -> Result<Self, Self::Error> {
        match classify_mode(
            raw.app_env.as_deref(),
            HostContext {
                railway: false,
                release: false,
            },
        ) {
            Ok(RuntimeMode::Prod) => ProductionRuntime::try_from(raw)
                .map(Box::new)
                .map(Self::Production),
            Ok(RuntimeMode::Dev) => Ok(Self::Development(NonProductionRuntime)),
            Ok(RuntimeMode::Test) => Ok(Self::Test(NonProductionRuntime)),
            Ok(RuntimeMode::Staging) => Ok(Self::Staging(NonProductionRuntime)),
            Err(e) => Err(BootstrapRefusal::new(vec![e])),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn valid_raw() -> RawRuntimeConfig {
        let mut config = crate::state::test_stub_config();
        config.auth_cookie_secure = true;
        config.auth_cookie_samesite = "Lax".into();
        config.session_chain_archive_body_root = Some(std::path::PathBuf::from("archive-root"));
        let session = URL_SAFE_NO_PAD.encode([31_u8; 32]);
        let encryption = URL_SAFE_NO_PAD.encode([32_u8; 32]);
        RawRuntimeConfig {
            app_env: Some("prod".into()),
            config,
            database_url: Some("postgresql://database-canary.invalid/db".into()),
            allowed_browser_origins: Some("https://origin-canary.invalid".into()),
            metrics_secret_token: Some(URL_SAFE_NO_PAD.encode([33_u8; 32])),
            session_active_key_id: Some("session-active".into()),
            session_keys_json: Some(format!(r#"{{"session-active":"{session}"}}"#)),
            session_legacy_key: Some("legacy-session-canary".into()),
            encryption_active_key_id: Some("encryption-active".into()),
            encryption_keys_json: Some(format!(r#"{{"encryption-active":"{encryption}"}}"#)),
            encryption_legacy_key: Some("legacy-encryption-canary".into()),
            cookie_domain: None,
            cookie_http_only: Some("true".into()),
        }
    }

    #[test]
    fn mode_matrix_is_closed_and_host_sensitive() {
        for (raw, expected) in [
            ("prod", RuntimeMode::Prod),
            ("dev", RuntimeMode::Dev),
            ("test", RuntimeMode::Test),
            ("staging", RuntimeMode::Staging),
        ] {
            assert_eq!(
                classify_mode(
                    Some(raw),
                    HostContext {
                        railway: true,
                        release: true,
                    },
                ),
                Ok(expected)
            );
        }
        for raw in ["production", "Prod", " prod", "prod ", ""] {
            assert!(classify_mode(
                Some(raw),
                HostContext {
                    railway: false,
                    release: false,
                },
            )
            .is_err());
        }
        assert_eq!(
            classify_mode(
                None,
                HostContext {
                    railway: false,
                    release: false,
                },
            ),
            Ok(RuntimeMode::Dev)
        );
        for host in [
            HostContext {
                railway: true,
                release: false,
            },
            HostContext {
                railway: false,
                release: true,
            },
        ] {
            assert!(classify_mode(None, host).is_err());
        }
    }

    #[test]
    fn signing_ring_complete_refusal_matrix() {
        let good = URL_SAFE_NO_PAD.encode([41_u8; 32]);
        let other = URL_SAFE_NO_PAD.encode([42_u8; 32]);
        let legacy = Some("legacy".to_string());
        let cases = [
            (None, None, ViolationReason::SigningAbsent),
            (
                Some("active".into()),
                Some("not-json".into()),
                ViolationReason::SigningInvalid,
            ),
            (
                Some("active".into()),
                Some(r#"{"active":"placeholder-material"}"#.to_string()),
                ViolationReason::RotationMaterialInvalid,
            ),
            (
                Some("active".into()),
                Some(format!(
                    r#"{{"active":"{}"}}"#,
                    URL_SAFE_NO_PAD.encode([1_u8; 31])
                )),
                ViolationReason::RotationMaterialInvalid,
            ),
            (
                Some("active".into()),
                Some(format!(r#"{{"bad id":"{good}"}}"#)),
                ViolationReason::RotationDuplicateId,
            ),
            (
                Some("active".into()),
                Some(format!(r#"{{"active":"{good}","active":"{other}"}}"#)),
                ViolationReason::RotationDuplicateId,
            ),
            (
                Some("active".into()),
                Some(format!(r#"{{"active":"{good}","other":"{good}"}}"#)),
                ViolationReason::RotationMaterialInvalid,
            ),
            (
                Some("missing".into()),
                Some(format!(r#"{{"active":"{good}"}}"#)),
                ViolationReason::RotationActiveMissing,
            ),
        ];
        for (active, map, expected) in cases {
            let mut violations = Vec::new();
            let _ = parse_ring(&active, &map, &legacy, false, &mut violations);
            assert!(
                violations
                    .iter()
                    .any(|violation| violation.reason == expected),
                "missing {expected:?} for active={active:?} map={map:?}"
            );
        }
    }

    #[test]
    fn every_invalid_pure_category_stops_all_side_effect_counters() {
        #[derive(Default)]
        struct Effects {
            schema: AtomicUsize,
            archive: AtomicUsize,
            state: AtomicUsize,
            vendor: AtomicUsize,
            listener: AtomicUsize,
            worker: AtomicUsize,
            writes: AtomicUsize,
        }
        impl Effects {
            fn run_after_validation(&self, raw: RawRuntimeConfig) {
                if ProductionRuntime::try_from(raw).is_err() {
                    return;
                }
                for counter in [
                    &self.schema,
                    &self.archive,
                    &self.state,
                    &self.vendor,
                    &self.listener,
                    &self.worker,
                    &self.writes,
                ] {
                    counter.fetch_add(1, Ordering::SeqCst);
                }
            }
            fn snapshot(&self) -> [usize; 7] {
                [
                    self.schema.load(Ordering::SeqCst),
                    self.archive.load(Ordering::SeqCst),
                    self.state.load(Ordering::SeqCst),
                    self.vendor.load(Ordering::SeqCst),
                    self.listener.load(Ordering::SeqCst),
                    self.worker.load(Ordering::SeqCst),
                    self.writes.load(Ordering::SeqCst),
                ]
            }
        }

        let mut cases = Vec::new();
        let mut durable = valid_raw();
        durable.database_url = None;
        cases.push(durable);
        let mut archive = valid_raw();
        archive.config.session_chain_archive_body_root = None;
        cases.push(archive);
        let mut signing = valid_raw();
        signing.session_keys_json = Some("not-json".into());
        cases.push(signing);
        let mut encryption = valid_raw();
        encryption.encryption_keys_json = Some("not-json".into());
        cases.push(encryption);
        let mut rotation = valid_raw();
        rotation.encryption_active_key_id = Some("missing".into());
        cases.push(rotation);
        let mut metrics = valid_raw();
        metrics.metrics_secret_token = Some("placeholder-token".into());
        cases.push(metrics);
        let mut origins = valid_raw();
        origins.allowed_browser_origins = Some("*".into());
        cases.push(origins);
        let mut cookies = valid_raw();
        cookies.config.auth_cookie_secure = false;
        cases.push(cookies);

        for poisoned in cases {
            let effects = Effects::default();
            effects.run_after_validation(poisoned);
            assert_eq!(effects.snapshot(), [0; 7]);
        }
        let bite = Effects::default();
        bite.run_after_validation(valid_raw());
        assert_eq!(
            bite.snapshot(),
            [1; 7],
            "the counter oracle must bite on valid input"
        );
    }

    #[test]
    fn metrics_token_matrix_rejects_missing_blank_placeholder_malformed_and_short() {
        let short = URL_SAFE_NO_PAD.encode([1_u8; 31]);
        for token in [
            None,
            Some(""),
            Some("   "),
            Some("replace-with-example-token"),
            Some("not!base64"),
            Some(short.as_str()),
        ] {
            assert!(parse_metrics_token(token).is_none());
        }
        let valid = URL_SAFE_NO_PAD.encode([8_u8; 32]);
        assert_eq!(
            parse_metrics_token(Some(&valid)).unwrap().as_bytes(),
            &[8_u8; 32]
        );
    }
}
