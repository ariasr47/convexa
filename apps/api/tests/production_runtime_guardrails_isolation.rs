use std::fs;
use std::path::PathBuf;

fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn production_runtime_guardrails_receipt(root: &std::path::Path) -> PathBuf {
    let active = root.join(
        ".spire/clusters/tech/contracts/production-runtime-guardrails/conformance-receipt.json",
    );
    if active.is_file() {
        return active;
    }

    root.join(
        ".spire/clusters/tech/contracts/_archive/production-runtime-guardrails/conformance-receipt.json",
    )
}

fn production_uses_unbounded_cors(source: &str) -> bool {
    let start = source.find("fn production_cors_layer").unwrap_or(0);
    let tail = &source[start..];
    let end = tail
        .find("fn non_production_cors_layer")
        .unwrap_or(tail.len());
    tail[..end].contains("Any")
}

#[test]
fn production_cors_has_no_any_arm_and_guard_is_non_vacuous() {
    let source = fs::read_to_string(workspace().join("apps/api/src/server.rs")).unwrap();
    assert!(!production_uses_unbounded_cors(&source));
    let poisoned = "fn production_cors_layer() { CorsLayer::new().allow_origin(Any); }\nfn non_production_cors_layer() {}";
    assert!(production_uses_unbounded_cors(poisoned));
}

#[test]
fn app_state_cannot_spawn_the_stock_worker_before_bind() {
    let source = fs::read_to_string(workspace().join("apps/api/src/state.rs")).unwrap();
    assert!(!source.contains("StockStreamHub::spawn"));
    assert!("StockStreamHub::spawn(cfg)".contains("StockStreamHub::spawn"));
}

#[test]
fn release_mode_is_checked_before_repository_dotenv_is_loaded() {
    let source = fs::read_to_string(workspace().join("apps/api/src/main.rs")).unwrap();
    let main = source.find("async fn main()").expect("main function");
    let source = &source[main..];
    let guard = source
        .find("guard_host_mode_before_dotenv()")
        .expect("host mode guard");
    let dotenv = source.find("load_dotenv();").expect("dotenv call");
    assert!(
        guard < dotenv,
        "release/Railway host mode must be checked before dotenv"
    );
}

#[test]
fn schema_and_archive_preflights_precede_state_listener_and_workers() {
    let source = fs::read_to_string(workspace().join("apps/api/src/server.rs")).unwrap();
    let schema = source
        .find("SchemaPreflight::run")
        .expect("schema preflight");
    let archive = source
        .find("ArchiveRootProbe::run")
        .expect("archive preflight");
    let state = source
        .find("AppState::new_production")
        .expect("production state");
    let bind = source.find("TcpListener::bind").expect("listener bind");
    let worker = source.find("stock_worker.start").expect("worker start");
    assert!(schema < archive && archive < state && state < bind && bind < worker);
}

fn forbidden_production_factory(source: &str) -> bool {
    [
        "open_memory",
        "open_sqlite",
        "open_json",
        "SigningKeyRing::ephemeral",
        "EncryptionKeyRing::ephemeral",
        "::disabled",
    ]
    .iter()
    .any(|forbidden| source.contains(forbidden))
}

#[test]
fn production_entry_constructor_cannot_name_local_or_ephemeral_fallbacks() {
    let source = fs::read_to_string(workspace().join("apps/api/src/state.rs")).unwrap();
    let start = source
        .find("pub async fn new_production")
        .expect("production constructor");
    let tail = &source[start..];
    let end = tail
        .find("#[cfg(not(feature = \"postgres\"))]")
        .unwrap_or(tail.len());
    assert!(!forbidden_production_factory(&tail[..end]));
    assert!(forbidden_production_factory(
        "pub async fn new_production() { AuthStore::open_sqlite(path); }"
    ));
}

fn contains_secret_build_input(source: &str) -> bool {
    source.lines().any(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            return false;
        }
        let lower = line.to_ascii_lowercase();
        lower.contains("copy .env")
            || [
                "database_url=postgres",
                "metrics_secret_token=ey",
                "auth_session_keys_json={",
                "ai_key_encryption_keys_json={",
            ]
            .iter()
            .any(|needle| lower.contains(needle))
    })
}

#[test]
fn image_and_examples_are_secret_free_and_guard_is_non_vacuous() {
    let root = workspace();
    for relative in [
        "apps/api/Dockerfile",
        "apps/api/.env.example",
        "docs/ENVIRONMENTS.md",
        "docs/production-runtime-guardrails.md",
    ] {
        let source = fs::read_to_string(root.join(relative)).unwrap();
        assert!(!contains_secret_build_input(&source), "{relative}");
    }
    let ignore = fs::read_to_string(root.join(".dockerignore")).unwrap();
    assert!(ignore.contains("**/.env"));
    assert!(ignore.contains("**/.env.*"));
    assert!(contains_secret_build_input("COPY .env /app/.env"));
    assert!(contains_secret_build_input(
        "METRICS_SECRET_TOKEN=eySecretCanary"
    ));
}

#[test]
fn railway_volume_permissions_are_repaired_before_the_api_drops_privileges() {
    let root = workspace();
    let dockerfile = fs::read_to_string(root.join("apps/api/Dockerfile")).unwrap();
    let entrypoint_path = root.join("apps/api/docker-entrypoint.c");
    assert!(
        entrypoint_path.is_file(),
        "scratch image needs a static post-mount ownership bootstrap"
    );
    let entrypoint = fs::read_to_string(entrypoint_path).unwrap();

    assert!(
        dockerfile.contains("musl-gcc -static"),
        "bootstrap must remain executable in the shell-free scratch image"
    );
    assert!(
        dockerfile.contains("ENTRYPOINT [\"/usr/local/bin/convexa-entrypoint\"]"),
        "Railway must run the post-mount bootstrap before every command"
    );
    assert!(
        dockerfile.contains("USER 10001:10001"),
        "the image must remain non-root outside Railway's explicit startup override"
    );
    assert!(
        dockerfile.contains(
            "CMD [\"/usr/local/bin/convexa-entrypoint\", \"/usr/local/bin/api-rust\", \"healthcheck\"]"
        ),
        "container healthcheck must also drop privileges"
    );

    let validate = entrypoint
        .find("\"/data/\"")
        .expect("archive root must be restricted to the Railway volume");
    let no_symlink_walk = entrypoint
        .find("FTW_PHYS")
        .expect("recursive repair must not follow symlinks");
    let repair = entrypoint
        .find("lchown")
        .expect("mounted archive ownership must be repaired recursively");
    let drop = entrypoint
        .find("setuid(APP_UID)")
        .expect("API command must drop to appuser uid");
    assert!(
        entrypoint.contains("geteuid() == 0") && entrypoint.contains("is_app_user()"),
        "bootstrap must accept normal non-root starts and repair only when Railway starts it as root"
    );
    let exec = entrypoint
        .find("execvp")
        .expect("bootstrap must replace itself with the requested command");
    assert!(
        validate < no_symlink_walk && no_symlink_walk < repair && repair < drop && drop < exec,
        "validate path, repair ownership, drop privileges, then exec"
    );
}

fn contains_any(value: &str, canaries: &[&str]) -> bool {
    canaries.iter().any(|canary| value.contains(canary))
}

#[test]
fn comprehensive_secret_egress_canary_scan_is_non_vacuous() {
    use api_rust::runtime_guardrails::config::{ViolationCategory, ViolationReason};
    use api_rust::runtime_guardrails::{BootstrapRefusal, BootstrapViolation};

    let canaries = [
        "postgresql://database-user:database-canary@db.invalid/secret",
        "https://origin-canary.invalid:8443",
        "metrics-token-canary-0123456789",
        "session-key-material-canary",
        "encryption-key-material-canary",
        "legacy-key-canary",
        "gf_session=cookie-canary",
        "ciphertext-canary-never-egress",
        "plaintext-canary-never-egress",
    ];
    let refusal = BootstrapRefusal::new(vec![
        BootstrapViolation {
            category: ViolationCategory::DurableStore,
            reason: ViolationReason::PostgresInvalid,
        },
        BootstrapViolation {
            category: ViolationCategory::AllowedBrowserOrigins,
            reason: ViolationReason::OriginsMalformed,
        },
        BootstrapViolation {
            category: ViolationCategory::OperatorMetrics,
            reason: ViolationReason::MetricsInvalid,
        },
        BootstrapViolation {
            category: ViolationCategory::SessionSigning,
            reason: ViolationReason::SigningInvalid,
        },
        BootstrapViolation {
            category: ViolationCategory::ApiKeyEncryption,
            reason: ViolationReason::EncryptionInvalid,
        },
        BootstrapViolation {
            category: ViolationCategory::SessionCookies,
            reason: ViolationReason::CookiesInvalid,
        },
    ]);
    let diagnostic = api_rust::runtime_guardrails::diagnostics::render(&refusal);
    assert!(!contains_any(&diagnostic, &canaries));

    let root = workspace();
    let tracked_paths = String::from_utf8(
        std::process::Command::new("git")
            .args(["ls-files"])
            .current_dir(&root)
            .output()
            .expect("list build-context paths")
            .stdout,
    )
    .unwrap();
    assert!(!contains_any(&tracked_paths, &canaries));
    assert!(!tracked_paths.lines().any(|path| {
        let name = std::path::Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        name == ".env" || (name.starts_with(".env.") && name != ".env.example")
    }));

    for path in [
        production_runtime_guardrails_receipt(&root),
        root.join(
            ".spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json",
        ),
        root.join("apps/api/Dockerfile"),
        root.join("apps/api/.env.example"),
    ] {
        let contents = fs::read_to_string(&path).unwrap();
        assert!(!contains_any(&contents, &canaries), "{}", path.display());
    }

    let auth_source =
        fs::read_to_string(root.join("apps/api/src/services/auth/service.rs")).unwrap();
    let event_start = auth_source.find("fn decrypt_credential").unwrap();
    let event_tail = &auth_source[event_start..];
    let event_end = event_tail.find("fn invalidate_broker_cache").unwrap();
    let event_source = &event_tail[..event_end];
    assert!(event_source.contains("credential_decrypt_failed"));
    assert!(event_source.contains("envelope_key_id"));
    assert!(!event_source.contains("error = %"));
    assert!(!event_source.contains("ciphertext ="));
    assert!(!event_source.contains("plaintext ="));

    let poisoned = format!("{diagnostic}\n{}", canaries[8]);
    assert!(
        contains_any(&poisoned, &canaries),
        "canary oracle must bite"
    );
}
