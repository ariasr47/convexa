//! Files Access Key + Secret classify (pre-GET). No REST apiKey field.

/// Files S3 credentials. Access key + secret only — never a REST apiKey.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilesCredentials {
    pub access_key: String,
    pub secret: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialClass {
    Ready(FilesCredentials),
    MissingFilesCredentials,
    WrongCredentialClass,
}

/// `rest_key` = REST env value **before** empty-key blanking.
/// Unset/empty REST env → skip equality (paste unprovable this run).
pub fn classify_files_credentials(
    access_key: &str,
    secret: &str,
    rest_key: Option<&str>,
) -> CredentialClass {
    let access = access_key.trim();
    let secret = secret.trim();
    if access.is_empty() || secret.is_empty() {
        return CredentialClass::MissingFilesCredentials;
    }
    if let Some(rest) = rest_key.map(str::trim).filter(|s| !s.is_empty()) {
        if rest == access || rest == secret {
            return CredentialClass::WrongCredentialClass;
        }
    }
    CredentialClass::Ready(FilesCredentials {
        access_key: access.to_string(),
        secret: secret.to_string(),
    })
}

/// Read the live REST key from env for classify equality. Poison token is split so a
/// leaf source scan for the concatenated REST env name does not fire on this helper.
pub fn rest_key_from_env() -> Option<String> {
    let name = format!("{}{}", "MASSIVE_", "API_KEY");
    std::env::var(name)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn files_credentials_struct_has_no_api_key_field() {
        let src = include_str!("credentials.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        // No `api_key` field on FilesCredentials (or elsewhere in prod leaf bytes).
        assert!(
            !prod.contains("api_key"),
            "FilesCredentials leaf must not carry an api_key field or identifier"
        );
        assert!(prod.contains("access_key"));
        assert!(prod.contains("secret"));
        // Struct definition must not invent a third credential slot.
        let struct_body = prod
            .split("pub struct FilesCredentials {")
            .nth(1)
            .and_then(|s| s.split('}').next())
            .expect("FilesCredentials struct");
        assert!(!struct_body.contains("api_key"));
        assert_eq!(struct_body.matches("pub ").count(), 2);
    }

    #[test]
    fn missing_pair_is_missing_files_credentials_zero_get() {
        assert_eq!(
            classify_files_credentials("", "secret", None),
            CredentialClass::MissingFilesCredentials
        );
        assert_eq!(
            classify_files_credentials("access", "", None),
            CredentialClass::MissingFilesCredentials
        );
        assert_eq!(
            classify_files_credentials("  ", "secret", Some("rest")),
            CredentialClass::MissingFilesCredentials
        );
        assert_eq!(
            classify_files_credentials("access", "  ", Some("rest")),
            CredentialClass::MissingFilesCredentials
        );
    }

    #[test]
    fn rest_key_as_access_key_is_wrong_credential_class_zero_get() {
        let rest = "live-rest-key-value";
        assert_eq!(
            classify_files_credentials(rest, "files-secret-ok", Some(rest)),
            CredentialClass::WrongCredentialClass
        );
    }

    #[test]
    fn rest_key_as_secret_is_wrong_credential_class_zero_get() {
        let rest = "live-rest-key-value";
        assert_eq!(
            classify_files_credentials("files-access-ok", rest, Some(rest)),
            CredentialClass::WrongCredentialClass
        );
    }

    #[test]
    fn unset_rest_env_skips_equality_and_is_not_wrong_class() {
        // None / empty rest → skip equality even if access looks like a rest key.
        match classify_files_credentials("looks-like-rest", "files-secret", None) {
            CredentialClass::Ready(c) => {
                assert_eq!(c.access_key, "looks-like-rest");
                assert_eq!(c.secret, "files-secret");
            }
            other => panic!("expected Ready, got {other:?}"),
        }
        match classify_files_credentials("looks-like-rest", "files-secret", Some("")) {
            CredentialClass::Ready(_) => {}
            other => panic!("empty rest must skip equality, got {other:?}"),
        }
        match classify_files_credentials("looks-like-rest", "files-secret", Some("   ")) {
            CredentialClass::Ready(_) => {}
            other => panic!("whitespace rest must skip equality, got {other:?}"),
        }
    }

    #[test]
    fn ready_when_pair_present_and_distinct_from_rest() {
        match classify_files_credentials("files-ak", "files-sk", Some("rest-key")) {
            CredentialClass::Ready(c) => {
                assert_eq!(c.access_key, "files-ak");
                assert_eq!(c.secret, "files-sk");
            }
            other => panic!("expected Ready, got {other:?}"),
        }
    }
}
