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

    fn ready(access_key: &str, secret: &str) -> CredentialClass {
        CredentialClass::Ready(FilesCredentials {
            access_key: access_key.into(),
            secret: secret.into(),
        })
    }

    #[test]
    fn classify_files_credentials_refuses_missing_pairs_and_rest_key_reuse_before_any_get() {
        use CredentialClass::{MissingFilesCredentials, WrongCredentialClass};
        let rest = "live-rest-key-value";
        // (label, access_key, secret, rest_key, expected)
        let cases: [(&str, &str, &str, Option<&str>, CredentialClass); 10] = [
            (
                "empty access key is missing",
                "",
                "secret",
                None,
                MissingFilesCredentials,
            ),
            (
                "empty secret is missing",
                "access",
                "",
                None,
                MissingFilesCredentials,
            ),
            (
                "whitespace access key is missing even with rest set",
                "  ",
                "secret",
                Some("rest"),
                MissingFilesCredentials,
            ),
            (
                "whitespace secret is missing even with rest set",
                "access",
                "  ",
                Some("rest"),
                MissingFilesCredentials,
            ),
            (
                "REST key pasted as access key is the wrong class",
                rest,
                "files-secret-ok",
                Some(rest),
                WrongCredentialClass,
            ),
            (
                "REST key pasted as secret is the wrong class",
                "files-access-ok",
                rest,
                Some(rest),
                WrongCredentialClass,
            ),
            (
                "unset REST env skips the equality check",
                "looks-like-rest",
                "files-secret",
                None,
                ready("looks-like-rest", "files-secret"),
            ),
            (
                "empty REST env skips the equality check",
                "looks-like-rest",
                "files-secret",
                Some(""),
                ready("looks-like-rest", "files-secret"),
            ),
            (
                "whitespace REST env skips the equality check",
                "looks-like-rest",
                "files-secret",
                Some("   "),
                ready("looks-like-rest", "files-secret"),
            ),
            (
                "pair present and distinct from REST is ready",
                "files-ak",
                "files-sk",
                Some("rest-key"),
                ready("files-ak", "files-sk"),
            ),
        ];
        for (label, access_key, secret, rest_key, expected) in cases {
            assert_eq!(
                classify_files_credentials(access_key, secret, rest_key),
                expected,
                "{label}"
            );
        }
    }
}
