//! AWS4-HMAC-SHA256 signing for files.massive.com GET (empty-body hash only).

use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

/// SHA-256 of the empty payload (SigV4 `x-amz-content-sha256` for GET).
pub const EMPTY_BODY_SHA256: &str =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

pub fn empty_body_sha256() -> &'static str {
    EMPTY_BODY_SHA256
}

/// Entitled files class (vendor object prefix). Trades + quotes only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FilesClass {
    Trades,
    Quotes,
}

impl FilesClass {
    pub fn vendor_prefix(self) -> &'static str {
        match self {
            Self::Trades => "trades_v1",
            Self::Quotes => "quotes_v1",
        }
    }
}

/// Path-style object key: `us_stocks_sip/{trades_v1|quotes_v1}/YYYY/MM/YYYY-MM-DD.csv.gz`.
pub fn object_key(class: FilesClass, et_date: &str) -> String {
    let parts: Vec<&str> = et_date.split('-').collect();
    let (y, m) = match parts.as_slice() {
        [y, m, _d] => (*y, m.parse::<u32>().unwrap_or(0)),
        _ => ("0000", 0),
    };
    format!(
        "us_stocks_sip/{}/{}/{:02}/{}.csv.gz",
        class.vendor_prefix(),
        y,
        m,
        et_date
    )
}

/// Strip `Authorization` and any `X-Amz-*` query material. Never emit the files secret.
pub fn safe_files_url(raw: &str) -> String {
    let Some((prefix, query)) = raw.split_once('?') else {
        return raw.to_owned();
    };
    let safe_query: Vec<&str> = query
        .split('&')
        .filter(|part| {
            let key = part.split_once('=').map_or(*part, |(key, _)| key);
            let lower = key.to_ascii_lowercase();
            lower != "authorization" && !lower.starts_with("x-amz-")
        })
        .collect();
    if safe_query.is_empty() {
        prefix.to_owned()
    } else {
        format!("{prefix}?{}", safe_query.join("&"))
    }
}

/// Sign a path-style GET. Returns `(authorization, amz_date, payload_hash)`.
pub fn sign_get(
    access_key: &str,
    secret: &str,
    region: &str,
    host: &str,
    canonical_uri: &str,
    amz_date: &str,
) -> (String, String) {
    let payload_hash = EMPTY_BODY_SHA256;
    let date_stamp = &amz_date[..8]; // YYYYMMDD
    let signed_headers = "host;x-amz-content-sha256;x-amz-date";

    let canonical_headers =
        format!("host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n");
    let canonical_request =
        format!("GET\n{canonical_uri}\n\n{canonical_headers}\n{signed_headers}\n{payload_hash}");
    let canonical_hash = hex::encode(Sha256::digest(canonical_request.as_bytes()));

    let scope = format!("{date_stamp}/{region}/s3/aws4_request");
    let string_to_sign = format!("AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{canonical_hash}");

    let signing_key = derive_signing_key(secret, date_stamp, region, "s3");
    let mut mac = HmacSha256::new_from_slice(&signing_key).expect("hmac key");
    mac.update(string_to_sign.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={signed_headers}, Signature={signature}"
    );
    (authorization, payload_hash.to_string())
}

fn derive_signing_key(secret: &str, date_stamp: &str, region: &str, service: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("hmac key");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn object_key_trades_quotes_only_no_aggregates() {
        assert_eq!(
            object_key(FilesClass::Trades, "2026-08-10"),
            "us_stocks_sip/trades_v1/2026/08/2026-08-10.csv.gz"
        );
        assert_eq!(
            object_key(FilesClass::Quotes, "2026-08-10"),
            "us_stocks_sip/quotes_v1/2026/08/2026-08-10.csv.gz"
        );
        let src = include_str!("sigv4.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        // No aggregates object-key helper / vendor prefix in prod bytes.
        assert!(!prod.contains("aggregat"));
        assert!(!prod.contains("aggs_v1"));
        assert!(!prod.to_ascii_lowercase().contains("ohlc"));
        // Closed enum: only Trades + Quotes arms.
        assert!(prod.contains("Self::Trades => \"trades_v1\""));
        assert!(prod.contains("Self::Quotes => \"quotes_v1\""));
    }

    #[test]
    fn safe_files_url_strips_authorization_and_x_amz() {
        let raw = "https://files.massive.com/flatfiles/key.csv.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA%2F20260810%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=deadbeef&Authorization=AWS4-HMAC-SHA256&keep=1";
        let safe = safe_files_url(raw);
        assert!(!safe.to_ascii_lowercase().contains("x-amz-"));
        assert!(!safe.to_ascii_lowercase().contains("authorization"));
        assert!(safe.contains("keep=1"));
        assert!(safe.starts_with("https://files.massive.com/flatfiles/key.csv.gz"));
        // No-query path is unchanged.
        assert_eq!(
            safe_files_url("https://files.massive.com/flatfiles/key.csv.gz"),
            "https://files.massive.com/flatfiles/key.csv.gz"
        );
    }

    #[test]
    fn empty_body_sha256_is_canonical_empty() {
        let digest = hex::encode(Sha256::digest(b""));
        assert_eq!(digest, EMPTY_BODY_SHA256);
        assert_eq!(empty_body_sha256(), EMPTY_BODY_SHA256);
        let src = include_str!("sigv4.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        // Payload hash must be the empty-body digest, never the unsigned token.
        let unsigned = format!("{}-{}", "UNSIGNED", "PAYLOAD");
        assert!(!prod.contains(&unsigned));
        assert!(prod.contains(EMPTY_BODY_SHA256));
    }

    #[test]
    fn signed_headers_are_alphabetical_host_content_date() {
        let (auth, hash) = sign_get(
            "AKIAEXAMPLE",
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "us-east-1",
            "files.massive.com",
            "/flatfiles/us_stocks_sip/trades_v1/2026/08/2026-08-10.csv.gz",
            "20260810T150000Z",
        );
        assert_eq!(hash, EMPTY_BODY_SHA256);
        assert!(auth.contains("SignedHeaders=host;x-amz-content-sha256;x-amz-date"));
        assert!(auth.starts_with("AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/"));
        let unsigned = format!("{}-{}", "UNSIGNED", "PAYLOAD");
        assert!(!auth.contains(&unsigned));
    }
}
