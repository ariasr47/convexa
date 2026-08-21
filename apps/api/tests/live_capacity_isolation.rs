//! S5c: capacity is off the score path; 503 + Retry-After is the refuse surface.

#[test]
fn live_capacity_module_does_not_touch_score() {
    let src = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/live_capacity.rs"
    ))
    .unwrap();
    for forbid in [
        "opportunity_score",
        "state_fingerprint",
        "generate_signals",
        "evaluate_gate",
    ] {
        assert!(!src.contains(forbid), "live_capacity imported {forbid}");
    }
}

#[test]
fn stream_refuse_is_503_with_retry_after_not_429() {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/routes/stream.rs"))
        .unwrap();
    assert!(src.contains("SERVICE_UNAVAILABLE"));
    assert!(src.contains("Retry-After"));
    assert!(src.contains("admit_sse"));
    assert!(
        !src.contains("TOO_MANY_REQUESTS"),
        "capacity is 503, not 429"
    );
}

#[test]
fn config_reads_the_two_env_dials() {
    let cfg =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"MAX_LIVE_SESSIONS\", 50)"));
    assert!(cfg.contains("env_u64(\"MAX_LIVE_SUBSCRIBERS\", 500)"));
}
