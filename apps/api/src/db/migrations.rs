//! Numbered Postgres migrations (idempotent baseline + forward-only versions).
//!
//! Applied once at boot and recorded in `schema_migrations`. Each migration body
//! may contain multiple statements — they are split and executed one-by-one
//! (sqlx extended protocol = one statement per call).

use std::sync::OnceLock;

/// (version, name, sql body). Versions must be unique and strictly increasing.
const MIGRATIONS_RAW: &[(i64, &str, &str)] = &[
    (
        1,
        "baseline_core",
        r#"
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    email_lower   TEXT NOT NULL UNIQUE,
    display_name  TEXT,
    password_hash TEXT,
    google_sub    TEXT UNIQUE,
    created_at    DOUBLE PRECISION NOT NULL,
    last_login_at DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at          DOUBLE PRECISION NOT NULL,
    expires_at          DOUBLE PRECISION NOT NULL,
    absolute_expires_at DOUBLE PRECISION NOT NULL,
    revoked             BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    active_persona_id TEXT,
    default_ticker    TEXT,
    theme             TEXT NOT NULL DEFAULT 'dark',
    scan_view         TEXT
);

CREATE TABLE IF NOT EXISTS credentials (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    ciphertext  TEXT NOT NULL,
    last4       TEXT NOT NULL,
    provider    TEXT NOT NULL DEFAULT 'anthropic',
    created_at  DOUBLE PRECISION NOT NULL,
    updated_at  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, kind)
);

CREATE TABLE IF NOT EXISTS iv_samples (
    ticker       TEXT NOT NULL,
    session_date TEXT NOT NULL,
    iv_value     DOUBLE PRECISION NOT NULL,
    iv_basis     TEXT NOT NULL,
    basis_dte    DOUBLE PRECISION NOT NULL,
    captured_at  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (ticker, session_date)
);
CREATE INDEX IF NOT EXISTS iv_samples_ticker_date_idx
    ON iv_samples (ticker, session_date DESC);
"#,
    ),
    (
        2,
        "scan_store",
        r#"
CREATE TABLE IF NOT EXISTS scan_rows (
    symbol           TEXT PRIMARY KEY,
    price            DOUBLE PRECISION,
    chg_pct          DOUBLE PRECISION,
    score            DOUBLE PRECISION,
    tier             TEXT,
    regime           TEXT,
    vol_regime       TEXT,
    flip             DOUBLE PRECISION,
    dist_to_flip_pct DOUBLE PRECISION,
    call_wall        DOUBLE PRECISION,
    put_wall         DOUBLE PRECISION,
    dist_to_wall_pct DOUBLE PRECISION,
    as_of            DOUBLE PRECISION NOT NULL,
    status           TEXT NOT NULL,
    score_drivers    TEXT
);

ALTER TABLE scan_rows ADD COLUMN IF NOT EXISTS score_drivers TEXT;

CREATE TABLE IF NOT EXISTS scan_heartbeat (
    id                    INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at            DOUBLE PRECISION NOT NULL,
    sweep_last_completed  DOUBLE PRECISION,
    universe_size         INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scan_bundles (
    symbol       TEXT PRIMARY KEY,
    as_of        DOUBLE PRECISION NOT NULL,
    bundle_json  TEXT NOT NULL
);
"#,
    ),
    (
        3,
        "scan_structure_history",
        r#"
CREATE TABLE IF NOT EXISTS scan_structure_history (
    symbol           TEXT NOT NULL,
    as_of            DOUBLE PRECISION NOT NULL,
    price            DOUBLE PRECISION,
    score            DOUBLE PRECISION,
    tier             TEXT,
    regime           TEXT,
    vol_regime       TEXT,
    flip             DOUBLE PRECISION,
    dist_to_flip_pct DOUBLE PRECISION,
    call_wall        DOUBLE PRECISION,
    put_wall         DOUBLE PRECISION,
    dist_to_wall_pct DOUBLE PRECISION,
    PRIMARY KEY (symbol, as_of)
);
CREATE INDEX IF NOT EXISTS scan_structure_history_symbol_as_of_idx
    ON scan_structure_history (symbol, as_of DESC);
"#,
    ),
    (
        4,
        "ai_rec_metering",
        r#"
-- Shared AI-rec daily counters (multi-replica). Keyed by ET calendar day + identity
-- ('shared' for process/shared-admin path, or user id for own-key metering).
CREATE TABLE IF NOT EXISTS ai_rec_daily (
    day_et     TEXT NOT NULL,
    identity   TEXT NOT NULL,
    count      INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (day_et, identity)
);
"#,
    ),
    (
        5,
        "user_book_blob",
        r#"
-- Server-side durable book (positions/orders v3 JSON blob per user).
-- FE still keeps a local cache; signed-in clients sync via GET/PUT /api/book.
CREATE TABLE IF NOT EXISTS user_book (
    user_id        TEXT PRIMARY KEY,
    schema_version INT NOT NULL DEFAULT 3,
    blob_json      TEXT NOT NULL,
    updated_at     DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS user_book_updated_at_idx ON user_book (updated_at DESC);
"#,
    ),
    (
        6,
        "structure_capture_spine",
        r#"
-- P0 research capture: extend live structure samples with score drivers + vol/GEX
-- features, and durable forward-outcome rows (not pruned with the sample ring).
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS score_drivers TEXT;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS net_gex DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS iv_hv_ratio DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS atm_iv DOUBLE PRECISION;
ALTER TABLE scan_structure_history ADD COLUMN IF NOT EXISTS hv_30d DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS structure_outcomes (
    symbol         TEXT NOT NULL,
    as_of          DOUBLE PRECISION NOT NULL,
    horizon        TEXT NOT NULL,
    ret_simple     DOUBLE PRECISION,
    ret_log        DOUBLE PRECISION,
    abs_move       DOUBLE PRECISION,
    hit_call_wall  BOOLEAN,
    hit_put_wall   BOOLEAN,
    crossed_flip   BOOLEAN,
    label_version  TEXT NOT NULL,
    bars_source    TEXT NOT NULL,
    joined_at      DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (symbol, as_of, horizon)
);
CREATE INDEX IF NOT EXISTS structure_outcomes_symbol_as_of_idx
    ON structure_outcomes (symbol, as_of DESC);
"#,
    ),
    (
        7,
        "structure_history_symbol_normalize",
        r#"
-- Research capture durability: normalize symbols so history reads are case-stable.
-- Drop mixed-case duplicates first (keep already-upper rows when as_of collides).
DELETE FROM scan_structure_history a
 USING scan_structure_history b
 WHERE a.ctid <> b.ctid
   AND upper(btrim(a.symbol)) = upper(btrim(b.symbol))
   AND a.as_of = b.as_of
   AND a.symbol IS DISTINCT FROM upper(btrim(a.symbol));

UPDATE scan_structure_history
   SET symbol = upper(btrim(symbol))
 WHERE symbol IS DISTINCT FROM upper(btrim(symbol));

DELETE FROM structure_outcomes a
 USING structure_outcomes b
 WHERE a.ctid <> b.ctid
   AND upper(btrim(a.symbol)) = upper(btrim(b.symbol))
   AND a.as_of = b.as_of
   AND a.horizon = b.horizon
   AND a.symbol IS DISTINCT FROM upper(btrim(a.symbol));

UPDATE structure_outcomes
   SET symbol = upper(btrim(symbol))
 WHERE symbol IS DISTINCT FROM upper(btrim(symbol));

-- Expression index for case-insensitive history lookups (matches read path).
CREATE INDEX IF NOT EXISTS scan_structure_history_symbol_upper_as_of_idx
    ON scan_structure_history (upper(btrim(symbol)), as_of DESC);
"#,
    ),
    (
        8,
        "user_settings_risk_block",
        r#"
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_account_size DOUBLE PRECISION;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_cap_value     DOUBLE PRECISION;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_cap_unit      TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS risk_updated_at    DOUBLE PRECISION;
"#,
    ),
    (
        9,
        "ai_providers_slots",
        r#"
-- Per-provider BYO identity: (user_id, kind, provider)
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'anthropic';

-- Rebuild PK (Postgres): promote legacy rows first (provider already column-defaulted).
ALTER TABLE credentials DROP CONSTRAINT IF EXISTS credentials_pkey;
ALTER TABLE credentials ADD PRIMARY KEY (user_id, kind, provider);

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_power_path TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_provider   TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_model      TEXT;

-- Opaque Grok subscription link metadata (no secrets on wire). Unused while grok.available=false.
CREATE TABLE IF NOT EXISTS grok_links (
    user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'unlinked',
    encrypted_material TEXT,
    updated_at         DOUBLE PRECISION NOT NULL
);
"#,
    ),
    (
        10,
        "chain_snapshots",
        r#"
-- Append-only research chain snapshots. Identity is TEXT as_of (RFC3339 nanos),
-- never timestamptz — GATE Q seed 1970-01-01T00:00:00.000000001Z must round-trip.
CREATE TABLE IF NOT EXISTS chain_snapshots (
    symbol      TEXT NOT NULL,
    as_of       TEXT NOT NULL,
    as_of_ns    BIGINT NOT NULL,
    source      TEXT NOT NULL,
    body        BYTEA NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, as_of)
);
CREATE INDEX IF NOT EXISTS chain_snapshots_symbol_as_of_idx
    ON chain_snapshots (symbol, as_of DESC);
CREATE INDEX IF NOT EXISTS chain_snapshots_symbol_as_of_ns_idx
    ON chain_snapshots (symbol, as_of_ns ASC);
"#,
    ),
    (
        11,
        "session_chain_archive",
        r#"
-- Sibling prune-proof session archive. Identity is (symbol, et_date TEXT).
-- No FK / ON DELETE CASCADE from chain_snapshots — ring DELETE cannot name this table.
CREATE TABLE IF NOT EXISTS session_chain_archive (
    symbol         TEXT NOT NULL,
    et_date        TEXT NOT NULL,
    source_as_of   TEXT NOT NULL,
    source_as_of_ns BIGINT NOT NULL,
    source         TEXT NOT NULL,
    body           BYTEA NOT NULL,
    archived_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol, et_date)
);
CREATE INDEX IF NOT EXISTS session_chain_archive_symbol_et_date_idx
    ON session_chain_archive (symbol, et_date ASC);
"#,
    ),
    (
        12,
        "session_chain_archive_body_locator",
        r#"
ALTER TABLE session_chain_archive
  ADD COLUMN IF NOT EXISTS body_locator TEXT;
ALTER TABLE session_chain_archive
  ALTER COLUMN body DROP NOT NULL;
"#,
    ),
    (
        13,
        "session_day_tape",
        r#"
-- Session day tape index. Bodies live on SESSION_DAY_TAPE_BODY_ROOT (filesystem only).
CREATE TABLE IF NOT EXISTS session_day_tape (
    symbol              TEXT NOT NULL,
    et_date             TEXT NOT NULL,
    path_a_armed_from   TEXT,
    path_a_armed_until  TEXT,
    path_b_armed_from   TEXT,
    path_b_armed_until  TEXT,
    path_b_capturing    BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (symbol, et_date)
);
CREATE INDEX IF NOT EXISTS session_day_tape_symbol_et_date_idx
    ON session_day_tape (symbol, et_date ASC);
"#,
    ),
];
// Kept private for the SQL splitter tests; the authority boundary is `compiled_manifest()`.
#[cfg(test)]
const MIGRATIONS: &[(i64, &str, &str)] = MIGRATIONS_RAW;

#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

#[derive(Debug, Clone)]
pub struct ValidatedMigration {
    pub version: i64,
    pub name: &'static str,
    pub statements: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ValidatedManifest {
    pub entries: Vec<ValidatedMigration>,
    pub target_version: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ManifestError {
    Empty,
    NonPositiveVersion(i64),
    DuplicateVersion(i64),
    NonIncreasing(i64),
    EmptyName,
    DuplicateName(String),
    EmptyBody(i64),
    InvalidSql(i64),
}

static COMPILED: OnceLock<Vec<Migration>> = OnceLock::new();

/// Compiled migration truth used by production preflight and evidence tooling.
pub fn compiled_manifest() -> &'static [Migration] {
    COMPILED.get_or_init(|| {
        MIGRATIONS_RAW
            .iter()
            .map(|(version, name, sql)| Migration {
                version: *version,
                name,
                sql,
            })
            .collect()
    })
}

/// Compatibility view for existing research/test consumers; writers and verifiers use the typed manifest.
pub fn compiled_migrations() -> &'static [(i64, &'static str, &'static str)] {
    MIGRATIONS_RAW
}

pub fn validate_manifest(entries: &[Migration]) -> Result<ValidatedManifest, ManifestError> {
    if entries.is_empty() {
        return Err(ManifestError::Empty);
    }
    let mut names = std::collections::HashSet::new();
    let mut previous = None;
    let mut validated = Vec::with_capacity(entries.len());
    for entry in entries {
        if entry.version <= 0 {
            return Err(ManifestError::NonPositiveVersion(entry.version));
        }
        if entry.name.trim().is_empty() {
            return Err(ManifestError::EmptyName);
        }
        if !names.insert(entry.name) {
            return Err(ManifestError::DuplicateName(entry.name.to_string()));
        }
        if entry.sql.trim().is_empty() {
            return Err(ManifestError::EmptyBody(entry.version));
        }
        if let Some(prev) = previous {
            if entry.version == prev {
                return Err(ManifestError::DuplicateVersion(entry.version));
            }
            if entry.version < prev {
                return Err(ManifestError::NonIncreasing(entry.version));
            }
        }
        let statements = split_sql_statements(entry.sql)
            .map_err(|_| ManifestError::InvalidSql(entry.version))?;
        if statements.is_empty() {
            return Err(ManifestError::EmptyBody(entry.version));
        }
        validated.push(ValidatedMigration {
            version: entry.version,
            name: entry.name,
            statements,
        });
        previous = Some(entry.version);
    }
    Ok(ValidatedManifest {
        target_version: validated
            .last()
            .map(|entry| entry.version)
            .unwrap_or_default(),
        entries: validated,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SqlSplitError {
    offset: usize,
    construct: &'static str,
}

impl std::fmt::Display for SqlSplitError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "unterminated {} at byte {}",
            self.construct, self.offset
        )
    }
}

impl std::error::Error for SqlSplitError {}

#[derive(Clone, Copy)]
enum SqlLexState {
    Normal,
    SingleQuoted { backslash_escapes: bool },
    DoubleQuoted,
    DollarQuoted { delimiter: usize, length: usize },
    LineComment,
    BlockComment { depth: usize },
}

fn starts_escape_string(bytes: &[u8], quote: usize) -> bool {
    let identifier_byte = |byte: u8| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$');
    let e_prefix = quote >= 1
        && matches!(bytes[quote - 1], b'e' | b'E')
        && (quote == 1 || !identifier_byte(bytes[quote - 2]));
    let unicode_prefix = quote >= 2
        && bytes[quote - 1] == b'&'
        && matches!(bytes[quote - 2], b'u' | b'U')
        && (quote == 2 || !identifier_byte(bytes[quote - 3]));
    e_prefix || unicode_prefix
}

fn dollar_delimiter_length(bytes: &[u8], start: usize) -> Option<usize> {
    if bytes.get(start) != Some(&b'$') {
        return None;
    }
    if bytes.get(start + 1) == Some(&b'$') {
        return Some(2);
    }
    let first = *bytes.get(start + 1)?;
    if !(first.is_ascii_alphabetic() || first == b'_') {
        return None;
    }
    let mut cursor = start + 2;
    while bytes
        .get(cursor)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        cursor += 1;
    }
    (bytes.get(cursor) == Some(&b'$')).then_some(cursor - start + 1)
}

/// Split a Postgres script only on semicolons outside comments and quoted SQL.
pub fn split_sql_statements(script: &str) -> Result<Vec<String>, SqlSplitError> {
    let bytes = script.as_bytes();
    let mut statements = Vec::new();
    let mut state = SqlLexState::Normal;
    let mut statement_start = 0;
    let mut statement_has_sql = false;
    let mut cursor = 0;

    while cursor < bytes.len() {
        match state {
            SqlLexState::Normal => match bytes[cursor] {
                b'-' if bytes.get(cursor + 1) == Some(&b'-') => {
                    state = SqlLexState::LineComment;
                    cursor += 2;
                }
                b'/' if bytes.get(cursor + 1) == Some(&b'*') => {
                    state = SqlLexState::BlockComment { depth: 1 };
                    cursor += 2;
                }
                b'\'' => {
                    statement_has_sql = true;
                    state = SqlLexState::SingleQuoted {
                        backslash_escapes: starts_escape_string(bytes, cursor),
                    };
                    cursor += 1;
                }
                b'"' => {
                    statement_has_sql = true;
                    state = SqlLexState::DoubleQuoted;
                    cursor += 1;
                }
                b'$' => {
                    statement_has_sql = true;
                    if let Some(length) = dollar_delimiter_length(bytes, cursor) {
                        state = SqlLexState::DollarQuoted {
                            delimiter: cursor,
                            length,
                        };
                        cursor += length;
                    } else {
                        cursor += 1;
                    }
                }
                b';' => {
                    if statement_has_sql {
                        statements.push(script[statement_start..cursor].trim().to_string());
                    }
                    statement_start = cursor + 1;
                    statement_has_sql = false;
                    cursor += 1;
                }
                byte => {
                    statement_has_sql |= !byte.is_ascii_whitespace();
                    cursor += 1;
                }
            },
            SqlLexState::SingleQuoted { backslash_escapes } => match bytes[cursor] {
                b'\\' if backslash_escapes && cursor + 1 < bytes.len() => cursor += 2,
                b'\'' if bytes.get(cursor + 1) == Some(&b'\'') => cursor += 2,
                b'\'' => {
                    state = SqlLexState::Normal;
                    cursor += 1;
                }
                _ => cursor += 1,
            },
            SqlLexState::DoubleQuoted => {
                if bytes[cursor] == b'"' && bytes.get(cursor + 1) == Some(&b'"') {
                    cursor += 2;
                } else if bytes[cursor] == b'"' {
                    state = SqlLexState::Normal;
                    cursor += 1;
                } else {
                    cursor += 1;
                }
            }
            SqlLexState::DollarQuoted { delimiter, length } => {
                if bytes[cursor..].starts_with(&bytes[delimiter..delimiter + length]) {
                    state = SqlLexState::Normal;
                    cursor += length;
                } else {
                    cursor += 1;
                }
            }
            SqlLexState::LineComment => {
                if matches!(bytes[cursor], b'\r' | b'\n') {
                    state = SqlLexState::Normal;
                }
                cursor += 1;
            }
            SqlLexState::BlockComment { depth } => {
                if bytes[cursor..].starts_with(b"/*") {
                    state = SqlLexState::BlockComment { depth: depth + 1 };
                    cursor += 2;
                } else if bytes[cursor..].starts_with(b"*/") {
                    cursor += 2;
                    state = if depth == 1 {
                        SqlLexState::Normal
                    } else {
                        SqlLexState::BlockComment { depth: depth - 1 }
                    };
                } else {
                    cursor += 1;
                }
            }
        }
    }

    let construct = match state {
        SqlLexState::Normal | SqlLexState::LineComment => None,
        SqlLexState::SingleQuoted { .. } => Some("single-quoted string"),
        SqlLexState::DoubleQuoted => Some("double-quoted identifier"),
        SqlLexState::DollarQuoted { .. } => Some("dollar-quoted body"),
        SqlLexState::BlockComment { .. } => Some("block comment"),
    };
    if let Some(construct) = construct {
        return Err(SqlSplitError {
            offset: bytes.len(),
            construct,
        });
    }
    if statement_has_sql {
        statements.push(script[statement_start..].trim().to_string());
    }
    Ok(statements)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_ordered_and_unique() {
        let mut prev = 0i64;
        let mut seen = std::collections::HashSet::new();
        for &(v, name, body) in MIGRATIONS {
            assert!(v > prev, "versions must increase ({name})");
            assert!(seen.insert(v), "duplicate version {v}");
            assert!(!name.is_empty());
            assert!(
                !split_sql_statements(body)
                    .expect("compiled migration SQL must split")
                    .is_empty(),
                "{name} empty"
            );
            prev = v;
        }
    }

    #[test]
    fn invalid_manifest_rejects_non_positive_versions() {
        for version in [0, -1] {
            let entries = [Migration {
                version,
                name: "non_positive",
                sql: "CREATE TABLE non_positive(id INT);",
            }];
            assert!(
                validate_manifest(&entries).is_err(),
                "manifest version {version} must be rejected"
            );
        }
    }

    #[test]
    fn splitter_keeps_the_v5_comment_attached_to_its_statement() {
        let (_, _, body) = MIGRATIONS
            .iter()
            .find(|(version, _, _)| *version == 5)
            .expect("v5 migration must exist");

        let statements = split_sql_statements(body).expect("v5 migration SQL must split");

        assert_eq!(statements.len(), 2);
        assert!(statements[0].contains("local cache; signed-in clients"));
        assert!(statements[0].contains("CREATE TABLE IF NOT EXISTS user_book"));
        assert!(!statements[0].trim_start().starts_with("signed-in clients"));
    }

    #[test]
    fn splitter_ignores_semicolons_in_comments_and_quoted_sql() {
        let script = r#"
-- line comment; its tail must never become SQL
CREATE TABLE "semi;colon" (value TEXT DEFAULT 'one;two');
/* outer comment; /* nested comment; */ still comment; */
DO $body$
BEGIN
    PERFORM 'inside;body';
END;
$body$;
SELECT 'it''s;quoted', "also;quoted";
"#;

        let statements = split_sql_statements(script).expect("quoted SQL must split");

        assert_eq!(statements.len(), 3, "{statements:#?}");
        assert!(statements[0].contains("CREATE TABLE"));
        assert!(statements[1].contains("PERFORM 'inside;body';"));
        assert!(statements[2].contains("'it''s;quoted'"));
        assert!(statements
            .iter()
            .all(|statement| !statement.trim_start().starts_with("its tail")));
    }

    #[test]
    fn splitter_refuses_unterminated_quoted_or_commented_sql() {
        for script in ["SELECT 'unterminated;", "SELECT $$unterminated;", "/* open"] {
            assert!(split_sql_statements(script).is_err(), "{script}");
        }
    }

    #[test]
    fn structure_history_migration_present() {
        assert!(MIGRATIONS.iter().any(
            |(_, n, b)| *n == "scan_structure_history" && b.contains("scan_structure_history")
        ));
    }

    #[test]
    fn capture_spine_migration_present() {
        assert!(MIGRATIONS
            .iter()
            .any(|(_, n, b)| *n == "structure_capture_spine"
                && b.contains("structure_outcomes")
                && b.contains("score_drivers")
                && b.contains("net_gex")));
    }

    #[test]
    fn structure_history_normalize_migration_present() {
        assert!(MIGRATIONS
            .iter()
            .any(|(_, n, b)| *n == "structure_history_symbol_normalize"
                && b.contains("upper(btrim(symbol))")));
    }

    #[test]
    fn ai_providers_slots_migration_is_v9() {
        let (v, _name, body) = MIGRATIONS
            .iter()
            .find(|(_, n, _)| *n == "ai_providers_slots")
            .expect("v9 ai_providers_slots must exist");
        assert_eq!(*v, 9);
        assert!(body.contains("PRIMARY KEY (user_id, kind, provider)"));
        assert!(body.contains("ai_power_path"));
        assert!(body.contains("ai_provider"));
        assert!(body.contains("ai_model"));
        assert!(body.contains("grok_links"));
    }

    #[test]
    fn chain_snapshots_migration_is_v10() {
        let (v, name, body) = MIGRATIONS
            .iter()
            .find(|(_, n, _)| *n == "chain_snapshots")
            .expect("v10 chain_snapshots must exist");
        assert_eq!(*v, 10);
        assert_eq!(*name, "chain_snapshots");
        assert!(body.contains("as_of       TEXT NOT NULL"));
        assert!(body.contains("as_of_ns    BIGINT NOT NULL"));
        assert!(body.contains("PRIMARY KEY (symbol, as_of)"));
        assert!(!body.contains("as_of       TIMESTAMPTZ"));
    }

    #[test]
    fn session_chain_archive_migration_is_v11() {
        let (v, name, body) = MIGRATIONS
            .iter()
            .find(|(_, n, _)| *n == "session_chain_archive")
            .expect("v11 session_chain_archive must exist");
        assert_eq!(*v, 11);
        assert_eq!(*name, "session_chain_archive");
        assert!(body.contains("PRIMARY KEY (symbol, et_date)"));
        assert!(!body.contains("REFERENCES chain_snapshots"));
        assert!(!body.contains("REFERENCES chain_snapshots"));
    }

    #[test]
    fn session_archive_body_locator_migration_is_v12() {
        let (v, name, sql) = MIGRATIONS
            .iter()
            .find(|(_, n, _)| *n == "session_chain_archive_body_locator")
            .expect("v12 body_locator migration");
        assert_eq!(*v, 12);
        assert_eq!(*name, "session_chain_archive_body_locator");
        assert!(sql.contains("body_locator"));
        assert!(sql.contains("DROP NOT NULL") || (sql.contains("body") && sql.contains("NULL")));
        assert!(!name.contains("chain_snapshots"));
    }

    #[test]
    fn session_day_tape_migration_is_v13_no_bytea() {
        let (v, name, sql) = MIGRATIONS
            .iter()
            .find(|(_, n, _)| *n == "session_day_tape")
            .expect("v13 session_day_tape must exist");
        assert_eq!(*v, 13);
        assert_eq!(*name, "session_day_tape");
        assert!(sql.contains("PRIMARY KEY (symbol, et_date)"));
        assert!(sql.contains("path_a_armed_from"));
        assert!(sql.contains("path_b_capturing"));
        let create = sql
            .lines()
            .filter(|l| !l.trim_start().starts_with("--"))
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            !create.to_ascii_uppercase().contains("BYTEA"),
            "tape index must not use BYTEA"
        );
    }
}
