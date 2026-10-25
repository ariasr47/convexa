//! The canonical JSON form of a context package, and its id (spec 06, "Canonical JSON and the id").
//!
//! - Object keys sorted by byte order (every key is ASCII), the same sort as the API contract
//!   exporter in `src/bin/`; no whitespace; `serde_json`'s string escaping.
//! - **Numbers:** an integral value below 2^53 is written as an integer; any other finite value in
//!   Rust's shortest round-trip form (which never uses an exponent); `-0` is written `0`; a value
//!   that isn't finite is refused. `serde_json` would write an integral `f64` as `46700000000.0`,
//!   so these bytes are written here rather than through its float printer.
//! - **The id:** the lowercase hex sha256 of the canonical JSON with `package_id` and every
//!   `checked_at` removed. `jq` 1.7.1 keeps number literals as written, so it can recompute the id
//!   outside Rust: `jq -jcS 'del(.package_id) | walk(if type=="object" then del(.checked_at) else .
//!   end)' package.json | shasum -a 256`.

use sha2::{Digest, Sha256};
use std::fmt::Write as _;

/// A JSON value as the package writes it. Objects keep their pairs as built; the writer sorts them.
#[derive(Debug, Clone, PartialEq)]
pub enum Canon {
    Null,
    Bool(bool),
    Int(i64),
    Num(f64),
    Str(String),
    Arr(Vec<Canon>),
    Obj(Vec<(String, Canon)>),
}

impl Canon {
    pub fn str(text: impl Into<String>) -> Self {
        Canon::Str(text.into())
    }

    pub fn obj<const N: usize>(pairs: [(&str, Canon); N]) -> Self {
        Canon::Obj(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
    }
}

/// A value the canonical form can't hold (a NaN or an infinity), or an object with a key twice.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CanonError {
    NotFinite,
    DuplicateKey(String),
}

impl std::fmt::Display for CanonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CanonError::NotFinite => f.write_str("a value isn't a finite number"),
            CanonError::DuplicateKey(key) => write!(f, "an object holds the key {key} twice"),
        }
    }
}

/// 2^53: below it every integer is exact in an `f64`.
const EXACT_INTEGERS: f64 = 9_007_199_254_740_992.0;

/// One number, by the package's rule.
pub fn number(value: f64) -> Result<String, CanonError> {
    if !value.is_finite() {
        return Err(CanonError::NotFinite);
    }
    if value == 0.0 {
        // Both zeros, so `-0` is written `0`.
        return Ok("0".to_string());
    }
    if value.fract() == 0.0 && value.abs() < EXACT_INTEGERS {
        return Ok(format!("{}", value as i64));
    }
    Ok(format!("{value}"))
}

/// Computed values are rounded to 4 decimal places before they are stored, so none needs an
/// exponent.
pub fn round4(value: f64) -> f64 {
    let rounded = (value * 10_000.0).round() / 10_000.0;
    if rounded == 0.0 {
        0.0
    } else {
        rounded
    }
}

fn quoted(text: &str, out: &mut String) {
    // serde_json's escaping: `"`, `\` and control characters; nothing else.
    out.push_str(&serde_json::to_string(text).expect("a string always serialises"));
}

fn write(value: &Canon, out: &mut String) -> Result<(), CanonError> {
    match value {
        Canon::Null => out.push_str("null"),
        Canon::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Canon::Int(i) => {
            let _ = write!(out, "{i}");
        }
        Canon::Num(n) => out.push_str(&number(*n)?),
        Canon::Str(s) => quoted(s, out),
        Canon::Arr(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write(item, out)?;
            }
            out.push(']');
        }
        Canon::Obj(pairs) => {
            let mut sorted: Vec<&(String, Canon)> = pairs.iter().collect();
            sorted.sort_by(|a, b| a.0.as_bytes().cmp(b.0.as_bytes()));
            if let Some(twice) = sorted.windows(2).find(|w| w[0].0 == w[1].0) {
                return Err(CanonError::DuplicateKey(twice[0].0.clone()));
            }
            out.push('{');
            for (i, (key, item)) in sorted.into_iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                quoted(key, out);
                out.push(':');
                write(item, out)?;
            }
            out.push('}');
        }
    }
    Ok(())
}

/// The canonical bytes of `value`, with no trailing newline.
pub fn to_bytes(value: &Canon) -> Result<Vec<u8>, CanonError> {
    let mut out = String::new();
    write(value, &mut out)?;
    Ok(out.into_bytes())
}

/// `value` with every object key named `checked_at` removed, at any depth.
fn without_checked_at(value: &Canon) -> Canon {
    match value {
        Canon::Arr(items) => Canon::Arr(items.iter().map(without_checked_at).collect()),
        Canon::Obj(pairs) => Canon::Obj(
            pairs
                .iter()
                .filter(|(k, _)| k != "checked_at")
                .map(|(k, v)| (k.clone(), without_checked_at(v)))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// The package id: lowercase hex sha256 of the canonical JSON of `package` without its top-level
/// `package_id` and without every `checked_at`.
pub fn package_id(package: &Canon) -> Result<String, CanonError> {
    let stripped = match without_checked_at(package) {
        Canon::Obj(pairs) => Canon::Obj(
            pairs
                .into_iter()
                .filter(|(k, _)| k != "package_id")
                .collect(),
        ),
        other => other,
    };
    Ok(hex::encode(Sha256::digest(to_bytes(&stripped)?)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Spec 06 test (vi): a golden string pins the serialiser: keys out of insertion order, nested
    /// objects, the number rule on 0, -0, 0.0001, 1.08, 178.2, 46700000000 and 24300000000, and a
    /// refused NaN.
    #[test]
    fn the_canonical_serialiser_matches_its_golden_string() {
        let value = Canon::Obj(vec![
            ("zeta".into(), Canon::Num(0.0)),
            (
                "alpha".into(),
                Canon::Obj(vec![
                    ("b".into(), Canon::Num(-0.0)),
                    ("a".into(), Canon::Num(0.0001)),
                    (
                        "nested".into(),
                        Canon::Obj(vec![
                            ("y".into(), Canon::Null),
                            ("x".into(), Canon::Bool(true)),
                        ]),
                    ),
                ]),
            ),
            (
                "Mid".into(),
                Canon::Arr(vec![
                    Canon::Num(1.08),
                    Canon::Num(178.2),
                    Canon::Num(46_700_000_000.0),
                    Canon::Num(24_300_000_000.0),
                    Canon::Int(-3),
                ]),
            ),
            ("text".into(), Canon::str("say \"hi\"\n10b5-1 / \u{e9}")),
        ]);
        let bytes = to_bytes(&value).unwrap();
        assert_eq!(
            String::from_utf8(bytes).unwrap(),
            "{\"Mid\":[1.08,178.2,46700000000,24300000000,-3],\
             \"alpha\":{\"a\":0.0001,\"b\":0,\"nested\":{\"x\":true,\"y\":null}},\
             \"text\":\"say \\\"hi\\\"\\n10b5-1 / \u{e9}\",\"zeta\":0}"
        );
        assert_eq!(number(round4(1.0 / 3.0)).unwrap(), "0.3333");
        assert_eq!(number(round4(-0.00001)).unwrap(), "0");
        assert_eq!(
            to_bytes(&Canon::Arr(vec![Canon::Num(f64::NAN)])),
            Err(CanonError::NotFinite)
        );
        assert_eq!(number(f64::INFINITY), Err(CanonError::NotFinite));
    }
}
