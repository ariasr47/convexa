//! Massive files.massive.com client (SigV4 GET) — not under `infrastructure/massive/`.
//!
//! Credentials are Access Key + Secret only. Never built from the REST apiKey.

pub mod client;
pub mod credentials;
pub mod sigv4;

pub use client::{FilesHttpOutcome, MassiveFilesClient};
pub use credentials::{classify_files_credentials, CredentialClass, FilesCredentials};
pub use sigv4::{empty_body_sha256, object_key, safe_files_url, FilesClass};
