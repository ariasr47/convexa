use axum::http::HeaderValue;
use std::collections::HashSet;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AllowedBrowserOrigins {
    values: Vec<HeaderValue>,
    normalized: Vec<String>,
}

impl AllowedBrowserOrigins {
    pub fn parse(raw: &str) -> Result<Self, OriginError> {
        let mut seen = HashSet::new();
        let mut values = Vec::new();
        let mut normalized = Vec::new();
        let entries: Vec<_> = raw
            .split(',')
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .collect();
        if entries.is_empty() {
            return Err(OriginError::Missing);
        }
        for entry in entries {
            if entry == "*" {
                return Err(OriginError::Wildcard);
            }
            let u = Url::parse(entry).map_err(|_| OriginError::Malformed)?;
            if u.scheme() != "https" {
                return Err(OriginError::Transport);
            }
            if u.host_str().is_none()
                || u.username() != ""
                || u.password().is_some()
                || u.path() != "/" && !u.path().is_empty()
                || u.query().is_some()
                || u.fragment().is_some()
            {
                return Err(OriginError::Malformed);
            }
            let host = u
                .host_str()
                .ok_or(OriginError::Malformed)?
                .to_ascii_lowercase();
            let port = match u.port() {
                Some(443) | None => None,
                Some(p) => Some(p),
            };
            let canonical = match port {
                Some(p) => format!("https://{host}:{p}"),
                None => format!("https://{host}"),
            };
            if seen.insert(canonical.clone()) {
                values.push(HeaderValue::from_str(&canonical).map_err(|_| OriginError::Malformed)?);
                normalized.push(canonical);
            }
        }
        Ok(Self { values, normalized })
    }
    pub fn values(&self) -> &[HeaderValue] {
        &self.values
    }
    pub fn normalized(&self) -> &[String] {
        &self.normalized
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OriginError {
    Missing,
    Wildcard,
    Malformed,
    Transport,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_origin_rejection_and_normalization_matrix() {
        for rejected in [
            "",
            "   ",
            "*",
            "null",
            "not an origin",
            "https://user@example.com",
            "https://user:pass@example.com",
            "https://example.com/path",
            "https://example.com?query=1",
            "https://example.com#fragment",
            "http://example.com",
            "file:///tmp/example",
            "https://ok.example,https://bad.example/path",
        ] {
            assert!(
                AllowedBrowserOrigins::parse(rejected).is_err(),
                "{rejected}"
            );
        }

        let parsed = AllowedBrowserOrigins::parse(
            "https://Example.COM:443, https://example.com,https://example.com:8443",
        )
        .unwrap();
        assert_eq!(
            parsed.normalized(),
            ["https://example.com", "https://example.com:8443"]
        );
    }
}
