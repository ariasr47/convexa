//! The responses a package is built from, by URL. The pure builder (`package::build`) reads only
//! these, so a live run and a replay run the same function on the same bytes.
//!
//! **Saved inputs** (`--save-inputs D` writes them, `--inputs D` replays them):
//! - `D/manifest.json`: `{"format":1,"entries":[{url, status, fetched_at, sha256, bytes}]}`, sorted
//!   by URL. A hand-built fixture adds `"illustrative": true`; a live save never writes it.
//! - `D/blobs/<sha256>`: each body as received after gzip decoding. A 404 is an entry with
//!   `status: 404` and no blob.
//! - **No request header is stored**: the User-Agent holds the owner's email.

use super::package::{build, did_not_answer, ContextPackage, Need, Request};
use crate::services::public_data::edgar::{self, AcceptanceFit};
use crate::services::public_data::fetch::{Http, SecGate};
use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// One response's body as the builder sees it.
#[derive(Debug, Clone, PartialEq)]
pub enum Body {
    /// HTTP 200, the body as received after gzip decoding.
    Bytes(Arc<Vec<u8>>),
    /// HTTP 404, recorded with no body. Fatal or a coverage gap, by URL kind.
    NotFound,
    /// A saved body that can't be used (its blob is missing or changed): the error line to print.
    Broken(String),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Response {
    /// When the response was read; facts read from it carry this as `checked_at`.
    pub fetched_at: DateTime<Utc>,
    pub body: Body,
}

/// Every response one package needs, by URL.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Inputs {
    pub responses: BTreeMap<String, Response>,
    /// Hand-built inputs (a fixture's manifest says so); never set by a live save.
    pub illustrative: bool,
}

impl Inputs {
    pub fn get(&self, url: &str) -> Option<&Response> {
        self.responses.get(url)
    }

    /// The earliest `fetched_at`: a cutoff must be at least an hour before it.
    pub fn earliest_fetch(&self) -> Option<DateTime<Utc>> {
        self.responses.values().map(|r| r.fetched_at).min()
    }
}

pub const MANIFEST: &str = "manifest.json";
pub const BLOBS: &str = "blobs";
/// A live build settles in at most 4 rounds; more means something keeps naming new URLs.
const MAX_ROUNDS: usize = 6;

#[derive(Debug, Serialize, Deserialize)]
struct Manifest {
    format: u32,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    illustrative: bool,
    entries: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Entry {
    url: String,
    status: u16,
    fetched_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    sha256: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    bytes: Option<u64>,
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn is_sha256(text: &str) -> bool {
    text.len() == 64 && text.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// Read saved inputs from `dir`. A blob that is missing or whose bytes no longer match the
/// manifest is kept as [`Body::Broken`], so the build fails only if it uses that response.
pub fn load(dir: &Path) -> Result<Inputs, String> {
    let path = dir.join(MANIFEST);
    let raw = std::fs::read(&path)
        .map_err(|_| format!("The saved inputs have no {MANIFEST} in {}.", dir.display()))?;
    let manifest: Manifest = serde_json::from_slice(&raw)
        .map_err(|_| format!("{} is not a saved-inputs manifest.", path.display()))?;
    if manifest.format != 1 {
        return Err(format!(
            "{} has format {}; this build reads format 1.",
            path.display(),
            manifest.format
        ));
    }
    let mut inputs = Inputs {
        responses: BTreeMap::new(),
        illustrative: manifest.illustrative,
    };
    for entry in manifest.entries {
        let fetched_at = DateTime::parse_from_rfc3339(&entry.fetched_at)
            .map(|t| t.with_timezone(&Utc))
            .map_err(|_| {
                format!(
                    "The manifest's fetched_at for {} isn't an RFC 3339 time.",
                    entry.url
                )
            })?;
        let body = match entry.status {
            404 => Body::NotFound,
            200 => {
                let Some(sha) = entry.sha256.as_deref().filter(|s| is_sha256(s)) else {
                    return Err(format!(
                        "The manifest lists {} without a valid sha256.",
                        entry.url
                    ));
                };
                match std::fs::read(dir.join(BLOBS).join(sha)) {
                    Err(_) => Body::Broken(format!(
                        "The manifest lists {}, but its saved body {BLOBS}/{sha} is missing.",
                        entry.url
                    )),
                    Ok(bytes) if sha256_hex(&bytes) != sha => Body::Broken(format!(
                        "The saved response for {} has changed on disk (its sha256 differs from the manifest).",
                        entry.url
                    )),
                    Ok(bytes) => Body::Bytes(Arc::new(bytes)),
                }
            }
            other => Body::Broken(did_not_answer(&entry.url, &format!("HTTP {other}"))),
        };
        inputs
            .responses
            .insert(entry.url, Response { fetched_at, body });
    }
    Ok(inputs)
}

/// Writes every response of a live run to a directory as it arrives.
pub struct Saver {
    dir: PathBuf,
    entries: BTreeMap<String, Entry>,
    bytes: u64,
}

impl Saver {
    /// Refuses a directory that already holds a manifest.
    pub fn create(dir: &Path) -> Result<Self, String> {
        if dir.join(MANIFEST).exists() {
            return Err(format!(
                "{} already holds a {MANIFEST}; --save-inputs needs a new directory.",
                dir.display()
            ));
        }
        std::fs::create_dir_all(dir.join(BLOBS))
            .map_err(|e| format!("Couldn't create {}: {e}", dir.join(BLOBS).display()))?;
        Ok(Self {
            dir: dir.to_path_buf(),
            entries: BTreeMap::new(),
            bytes: 0,
        })
    }

    fn record(&mut self, url: &str, response: &Response) -> Result<(), String> {
        let fetched_at = super::package::stamp(response.fetched_at);
        let entry = match &response.body {
            Body::Bytes(bytes) => {
                let sha = sha256_hex(bytes);
                let path = self.dir.join(BLOBS).join(&sha);
                std::fs::write(&path, bytes.as_slice())
                    .map_err(|e| format!("Couldn't write {}: {e}", path.display()))?;
                self.bytes += bytes.len() as u64;
                Entry {
                    url: url.to_string(),
                    status: 200,
                    fetched_at,
                    sha256: Some(sha),
                    bytes: Some(bytes.len() as u64),
                }
            }
            Body::NotFound => Entry {
                url: url.to_string(),
                status: 404,
                fetched_at,
                sha256: None,
                bytes: None,
            },
            Body::Broken(_) => return Ok(()),
        };
        self.entries.insert(url.to_string(), entry);
        Ok(())
    }

    /// The manifest, sorted by URL, written to a temporary file and renamed.
    fn write_manifest(&self) -> Result<(), String> {
        let manifest = Manifest {
            format: 1,
            illustrative: false,
            entries: self.entries.values().cloned().collect(),
        };
        let mut bytes = serde_json::to_vec_pretty(&manifest)
            .map_err(|e| format!("Couldn't write the manifest: {e}"))?;
        bytes.push(b'\n');
        let path = self.dir.join(MANIFEST);
        let temp = self
            .dir
            .join(format!(".{MANIFEST}.tmp-{}", std::process::id()));
        std::fs::write(&temp, &bytes)
            .and_then(|_| std::fs::rename(&temp, &path))
            .map_err(|e| format!("Couldn't write {}: {e}", path.display()))
    }

    /// (responses saved, bytes saved).
    pub fn summary(&self) -> (usize, u64) {
        (self.entries.len(), self.bytes)
    }
}

/// The timezone guard over the issuer's submissions index, once the inputs hold it.
fn acceptance_check(request: &Request, inputs: &Inputs) -> Option<AcceptanceFit> {
    let map = match &inputs.get(edgar::TICKERS_URL)?.body {
        Body::Bytes(bytes) => edgar::parse_company_tickers(bytes).ok()?,
        _ => return None,
    };
    let cik = *map.get(&edgar::ticker_key(&request.ticker))?;
    let Body::Bytes(bytes) = &inputs.get(&edgar::submissions_url(cik))?.body else {
        return None;
    };
    let rows = edgar::parse_submissions(bytes).ok()?;
    Some(edgar::acceptance_fit(&rows))
}

/// Build live: build, fetch what is missing through the SEC gate, build again. Every response is
/// saved through `saver` as it arrives. Progress goes to stderr; the User-Agent is never printed.
pub(crate) async fn build_live(
    request: &Request,
    http: &Http,
    gate: &SecGate,
    mut saver: Option<&mut Saver>,
) -> Result<ContextPackage, String> {
    let mut inputs = Inputs::default();
    let mut guarded = false;
    for round in 1..=MAX_ROUNDS {
        let wanted = match build(request, &inputs) {
            Ok(package) => return Ok(package),
            Err(Need::Fail(line)) => return Err(line),
            Err(Need::Fetch(wanted)) => wanted,
        };
        eprintln!("SEC EDGAR, round {round}: {} requests.", wanted.len());
        for fetch in wanted {
            gate.wait().await;
            let fetched_at = Utc::now().with_nanosecond(0).unwrap_or_else(Utc::now);
            let body = match http
                .get(edgar::SOURCE, &fetch.url, fetch.max_bytes, &[404])
                .await
            {
                Ok(Some(bytes)) => Body::Bytes(Arc::new(bytes)),
                Ok(None) => Body::NotFound,
                Err(error) => {
                    if let Some(saver) = saver.as_deref_mut() {
                        saver.write_manifest()?;
                    }
                    return Err(did_not_answer(&fetch.url, &error.kind));
                }
            };
            let response = Response { fetched_at, body };
            if let Some(saver) = saver.as_deref_mut() {
                saver.record(&fetch.url, &response)?;
            }
            inputs.responses.insert(fetch.url, response);
        }
        if let Some(saver) = saver.as_deref_mut() {
            saver.write_manifest()?;
        }
        if !guarded {
            if let Some(fit) = acceptance_check(request, &inputs) {
                guarded = true;
                if fit.trips() {
                    return Err(format!(
                        "Acceptance times don't fit EDGAR's hours: {} of {} rows fall outside 06:00–22:00 Eastern or after their filing date. The timezone rule needs checking. Nothing was written.",
                        fit.outside, fit.of
                    ));
                }
                eprintln!(
                    "Acceptance times: {} of {} rows outside EDGAR's hours or after their filing date.",
                    fit.outside, fit.of
                );
            }
        }
    }
    Err(format!(
        "SEC EDGAR answers kept naming new requests after {MAX_ROUNDS} rounds. Nothing was written."
    ))
}
