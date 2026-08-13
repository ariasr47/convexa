//! AI recommendation leaf — wire-compatible with Python `ai_recommendation`.
//!
//! Pure consumer of cached bundles. Never feeds score/fingerprint.
//! Key resolution order (BYO multi-provider):
//!   1. User's encrypted own key (any provider) → `own_key`
//!   2. Else shared server keys (ANTHROPIC / OPENAI / XAI / GEMINI env) for admin emails → `shared_admin`
//!   3. Else `none` / `no_key`
//!
//! LLM calls use `services::llm` (Anthropic / OpenAI-compatible / Gemini).

use crate::routes::market::build_bundle;
use crate::services::analytics::load_analytics;
use crate::services::llm::{
    build_rec_prompts, complete_strategy, LlmProvider, RecPromptContext, ResolvedLlmKey,
};
use crate::services::rec_inputs::cap_check::cap_verdict;
use crate::services::rec_inputs::cited::resolve_cited;
use crate::services::rec_inputs::digest::parse_digest;
use crate::services::rec_inputs::field_reasons::{field_reason, FieldReason, InputPresence, RecField};
use crate::services::rec_inputs::max_risk::{parse_max_risk_dollars, ParsedRisk};
use crate::state::AppState;
use quant_engine::{
    restrict_move_to_tenors, CandidateBudget, CandidateSet, ContractType, DteWindow,
    SnapshotMeta, StraddleMove, StraddleMoveState, DEFAULT_GATE_SCORE,
};
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::Instant;
use tracing::warn;

const COOLDOWN_SECS: u64 = 60;
const DAILY_CAP: i32 = 50;

static RATE: Mutex<RateState> = Mutex::new(RateState {
    last_query: None,
    day: String::new(),
    count: 0,
});

struct RateState {
    last_query: Option<Instant>,
    day: String,
    count: i32,
}

/// Operator label for health/metrics: process-local caps (replica-unsafe) unless
/// a future durable meter is wired. Documented as the single-instance hard limit
/// when Railway runs one `api` replica (current topology).
pub fn meter_scope_label() -> &'static str {
    if std::env::var("DATABASE_URL")
        .ok()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
    {
        // Durable store present: still process-local meter today; multi-replica
        // operators must set AI_REC_METER_SCOPE=process and run one replica, or
        // raise the issue when scaling out.
        "process_local_with_postgres"
    } else {
        "process_local"
    }
}

fn today_et() -> String {
    use chrono::Utc;
    use chrono_tz::America::New_York;
    Utc::now()
        .with_timezone(&New_York)
        .format("%Y-%m-%d")
        .to_string()
}

fn resets_at_iso() -> String {
    use chrono::{Duration as Cd, Utc};
    use chrono_tz::America::New_York;
    let now = Utc::now().with_timezone(&New_York);
    let next = (now + Cd::days(1))
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let next = next
        .and_local_timezone(New_York)
        .single()
        .unwrap_or_else(|| now.naive_utc().and_utc().with_timezone(&New_York));
    next.with_timezone(&Utc).to_rfc3339()
}

fn feature_flag_on() -> bool {
    std::env::var("AI_REC_IN_APP_ENABLED")
        .map(|v| !matches!(v.to_ascii_lowercase().as_str(), "0" | "false" | "no" | "off"))
        .unwrap_or(true)
}

fn shared_env_key(provider: LlmProvider) -> Option<String> {
    let env_name = match provider {
        LlmProvider::Anthropic => "ANTHROPIC_API_KEY",
        LlmProvider::OpenAi => "OPENAI_API_KEY",
        LlmProvider::Xai => "XAI_API_KEY",
        LlmProvider::Gemini => "GEMINI_API_KEY",
        LlmProvider::OpenAiCompatible => "OPENAI_COMPAT_API_KEY",
    };
    std::env::var(env_name)
        .ok()
        .filter(|s| !s.trim().is_empty())
}

/// Any shared server key configured (for anonymous status "in_app" advertising).
fn any_shared_key() -> bool {
    [
        LlmProvider::Anthropic,
        LlmProvider::OpenAi,
        LlmProvider::Xai,
        LlmProvider::Gemini,
        LlmProvider::OpenAiCompatible,
    ]
    .into_iter()
    .any(|p| shared_env_key(p).is_some())
}

fn is_admin_email(email: &str) -> bool {
    let list = std::env::var("AUTH_ADMIN_EMAILS").unwrap_or_default();
    if list.trim().is_empty() {
        // Demo seed email counts as admin for local shared-key path.
        if let Ok(seed) = std::env::var("AUTH_DEMO_SEED") {
            if let Some((e, _)) = seed.split_once(':') {
                return email.eq_ignore_ascii_case(e.trim());
            }
        }
        return false;
    }
    list.split(&[',', ';'][..])
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .any(|a| a.eq_ignore_ascii_case(email))
}

/// Resolve key for a signed-in user (or none when anonymous status probe).
pub fn resolve_llm_key(
    state: &AppState,
    user: Option<&crate::services::auth::UserRecord>,
) -> ResolvedLlmKey {
    if !feature_flag_on() {
        return ResolvedLlmKey::none("no_key");
    }

    // (1) Own BYO key first — any provider.
    if let Some(u) = user {
        if let Some((material, provider)) = state.auth.get_decrypted_ai_key(&u.id) {
            // Prefer provider-specific override, then global AI_REC_MODEL (Anthropic),
            // then the provider default (matches Python AI_REC_MODEL default).
            let model = std::env::var(format!(
                "AI_REC_MODEL_{}",
                provider.as_str().to_ascii_uppercase()
            ))
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                if provider == LlmProvider::Anthropic {
                    std::env::var("AI_REC_MODEL")
                        .ok()
                        .filter(|s| !s.is_empty())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| provider.default_model().into());
            let base_url = std::env::var(format!(
                "AI_REC_BASE_URL_{}",
                provider.as_str().to_ascii_uppercase()
            ))
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| provider.default_base_url().map(|s| s.to_string()));
            return ResolvedLlmKey {
                key_source: "own_key",
                provider,
                key_material: Some(material),
                model,
                base_url,
                unavailable_reason: None,
                metering_identity: Some(u.id.clone()),
            };
        }

        // (2) Shared admin pool — prefer Anthropic, then others.
        if is_admin_email(&u.email) {
            for p in [
                LlmProvider::Anthropic,
                LlmProvider::OpenAi,
                LlmProvider::Xai,
                LlmProvider::Gemini,
            ] {
                if let Some(material) = shared_env_key(p) {
                    return ResolvedLlmKey {
                        key_source: "shared_admin",
                        provider: p,
                        key_material: Some(material),
                        model: p.default_model().into(),
                        base_url: p.default_base_url().map(|s| s.to_string()),
                        unavailable_reason: None,
                        metering_identity: Some(u.id.clone()),
                    };
                }
            }
            // Admin but no shared key configured
            return ResolvedLlmKey {
                key_source: "none",
                provider: LlmProvider::Anthropic,
                key_material: None,
                model: LlmProvider::Anthropic.default_model().into(),
                base_url: None,
                unavailable_reason: Some("shared_key_unconfigured"),
                metering_identity: Some(u.id.clone()),
            };
        }

        // Regular user, no own key
        return ResolvedLlmKey {
            key_source: "none",
            provider: LlmProvider::Anthropic,
            key_material: None,
            model: LlmProvider::Anthropic.default_model().into(),
            base_url: None,
            unavailable_reason: Some("no_key"),
            metering_identity: Some(u.id.clone()),
        };
    }

    // Anonymous status probe
    if any_shared_key() {
        ResolvedLlmKey {
            key_source: "shared_admin",
            provider: LlmProvider::Anthropic,
            key_material: None, // never expose shared material without a session
            model: LlmProvider::Anthropic.default_model().into(),
            base_url: None,
            unavailable_reason: None,
            metering_identity: None,
        }
    } else {
        ResolvedLlmKey::none("no_key")
    }
}

fn rate_snapshot() -> (i32, bool, String) {
    // Process-local daily cap (TECH_DEBT #17 / backlog 1.8). Correct under a single
    // Railway `api` replica. Multi-replica deploys must either pin one replica or
    // accept N× DAILY_CAP until a durable shared counter ships.
    let mut g = RATE.lock().unwrap_or_else(|e| e.into_inner());
    let today = today_et();
    if g.day != today {
        g.day = today;
        g.count = 0;
    }
    let remaining = (DAILY_CAP - g.count).max(0);
    let over = g.count >= DAILY_CAP;
    (remaining, over, resets_at_iso())
}

fn cooldown_remaining() -> u64 {
    let g = RATE.lock().unwrap_or_else(|e| e.into_inner());
    match g.last_query {
        Some(t) => {
            let elapsed = t.elapsed().as_secs();
            COOLDOWN_SECS.saturating_sub(elapsed)
        }
        None => 0,
    }
}

fn commit_query() {
    let mut g = RATE.lock().unwrap_or_else(|e| e.into_inner());
    let today = today_et();
    if g.day != today {
        g.day = today;
        g.count = 0;
    }
    g.count += 1;
    g.last_query = Some(Instant::now());
}

fn derive_gate(ai_eval: &Value) -> Value {
    let ready = ai_eval
        .get("ready")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let reasons = ai_eval
        .get("reasons")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let cd = cooldown_remaining();
    if !ready {
        json!({
            "state": "no_fresh_edge",
            "cooldown_remaining_seconds": cd,
            "reasons": reasons,
        })
    } else if cd > 0 {
        json!({
            "state": "cooldown",
            "cooldown_remaining_seconds": cd,
            "reasons": [],
        })
    } else {
        json!({
            "state": "ready",
            "cooldown_remaining_seconds": 0,
            "reasons": [],
        })
    }
}

fn persona_name(id: Option<&str>) -> (Option<String>, String) {
    let id = id.unwrap_or("default");
    let name = match id {
        "income_keeper" => "Income Keeper",
        "premium_hunter" => "Premium Hunter",
        "steady_swinger" => "Steady Swinger",
        "balanced_swinger" => "Balanced Swinger",
        "momentum_rider" => "Momentum Rider",
        "the_protector" => "The Protector",
        _ => "Default (no persona)",
    };
    let out_id = if id == "default" {
        None
    } else {
        Some(id.to_string())
    };
    (out_id, name.into())
}

fn assemble_persona_prompt(persona_id: Option<&str>) -> String {
    let (_, name) = persona_name(persona_id);
    format!(
        "# Convexa strategy hand-off\n\nPersona: {name}\n\n\
         Use the attached context (market_state, signals, strike_profile). \
         Risk-first; cite concrete levels (walls, flip, magnets, IV/HV)."
    )
}

/// GET status — side-effect-free.
pub fn status_payload(ai_eval: Option<&Value>, resolved: &ResolvedLlmKey) -> Value {
    let (remaining, over, resets) = rate_snapshot();
    let gate = derive_gate(ai_eval.unwrap_or(&json!({})));
    // In-app available when feature on AND (shared configured OR user has usable own/shared key).
    let user_has = resolved.key_source == "own_key" || resolved.key_source == "shared_admin";
    let in_app = feature_flag_on() && (any_shared_key() || user_has);
    json!({
        "availability": { "in_app_enabled": in_app },
        "gate": gate,
        "cap": {
            "over_limit": over,
            "remaining_today": remaining,
            "resets_at": resets,
        },
        "remaining_free_uses": null,
        "free_uses_total": null,
        "scenarios": { "enabled": false, "catalog": [] },
    })
}

/// `context.risk_inputs`'s anonymous / failed-read fallback — present, never omitted (INTERFACE
/// §3: "Anonymous always `not_set`").
pub fn not_set_risk_inputs() -> Value {
    json!({
        "state": "not_set",
        "account_size": null,
        "per_trade_cap": null,
        "effective_dollar_cap": {
            "state": "not_set",
            "value": null,
            "not_derivable_reason": null,
            "derived_from": { "account_size": null, "cap_value": null, "cap_unit": null },
        },
        "storage_available": true,
        "updated_at": null,
    })
}

/// GET export — no LLM. `candidates` (the §1 handoff envelope) and `risk_inputs` (the §4 shape)
/// are pre-assembled by the caller (`routes/recommendation.rs`, which resolves the session
/// optionally) so this stays a pure, synchronously-testable function.
pub fn build_export(ticker: &str, bundle: &Value, persona_id: Option<&str>, candidates: Value, risk_inputs: Value) -> Value {
    let as_of = bundle
        .pointer("/meta/freshness/snapshot_iso")
        .or_else(|| bundle.pointer("/meta/as_of"))
        .cloned()
        .unwrap_or(Value::Null);
    // A GET export carries no client digest, so this path always emits `not_sent`.
    let open_positions = json!({
        "source": "simulated",
        "state": "not_sent",
        "this_underlying": null,
        "portfolio": null,
    });
    let risk_sent = risk_inputs.get("state").and_then(|v| v.as_str()) == Some("set");
    let context = json!({
        "market_state": bundle.get("market_state"),
        "signals": bundle.get("signals"),
        "strike_profile": bundle.get("strike_profile"),
        "ai_eval": bundle.get("ai_eval"),
        "meta": bundle.get("meta"),
        "candidates": candidates,
        "risk_inputs": risk_inputs,
        "open_positions": open_positions,
    });
    // ONE composition: the note is BUILT FROM the categories, never hand-written beside them
    // (AC-90 — a hand-written note is how the claim goes false).
    let categories: [(&str, bool, &str); 6] = [
        ("context", true, "context"),
        ("candidates", true, "candidate contracts"),
        ("risk_inputs", risk_sent, "your risk inputs"),
        ("open_positions", false, "open positions"),
        ("persona_prompt", true, "the persona prompt"),
        ("glossary", true, "the glossary"),
    ];
    let egress_categories: Vec<Value> =
        categories.iter().map(|(k, sent, _)| json!({ "key": k, "sent": sent })).collect();
    let sent_labels: Vec<&str> = categories.iter().filter(|(_, sent, _)| *sent).map(|(_, _, l)| *l).collect();
    let egress_note = format!(
        "Complete list of what leaves the machine for {ticker}: {}.",
        sent_labels.join(", ")
    );
    json!({
        "ticker": ticker,
        "as_of": as_of,
        "context": context,
        "persona_prompt": assemble_persona_prompt(persona_id),
        "glossary": "See market_state_glossary.md for field definitions (walls, flip, IV/HV, scores).",
        "egress_note": egress_note,
        "egress_categories": egress_categories,
    })
}

/// The `cap_check` / `field_reasons` / `cited_contract` triple — computed ONCE per `base()` call
/// from whatever `strategy` is (a real parsed rec, or `Value::Null` on an early-return branch, in
/// which case every field reads as absent and the cap check reads `not_applicable`).
fn envelope_extras(
    strategy: &Value,
    set: &CandidateSet,
    effective_cap: Option<f64>,
    cap_not_derivable_reason: Option<&str>,
    risk_block_present: bool,
    pruned_move: Option<&StraddleMove>,
) -> (Value, Value, Value) {
    let states_entry = strategy.get("decision").and_then(|v| v.as_str()) == Some("trade");
    let max_risk_text = strategy.get("max_risk").and_then(|v| v.as_str());
    let parsed = parse_max_risk_dollars(max_risk_text);
    let verdict = cap_verdict(states_entry, effective_cap, parsed);
    let parsed_dollars = match parsed {
        ParsedRisk::Dollars(v) => Some(v),
        ParsedRisk::NotParseable => None,
    };

    let candidate_quotes_present = set.has_quoted_contract();
    let straddle_move_present = pruned_move
        .map(|m| m.state == StraddleMoveState::Ok && !m.tenors.is_empty())
        .unwrap_or(false);
    let presence = InputPresence {
        risk_block: risk_block_present,
        candidate_quotes: candidate_quotes_present,
        straddle_move: straddle_move_present,
    };

    let present = |v: Option<&Value>| v.map(|x| !x.is_null()).unwrap_or(false);
    let fr = |field: RecField, is_present: bool| -> Value {
        match field_reason(field, is_present, presence) {
            Some(r) => serde_json::to_value(FieldReason { reason: r.reason, missing_input: r.missing_input })
                .unwrap_or(Value::Null),
            None => Value::Null,
        }
    };
    let field_reasons = json!({
        "max_risk": fr(RecField::MaxRisk, present(strategy.get("max_risk"))),
        "position_size": fr(RecField::PositionSize, present(strategy.get("position_size"))),
        "exit_target": fr(RecField::ExitTarget, present(strategy.pointer("/exit_plan/target"))),
        "exit_stop": fr(RecField::ExitStop, present(strategy.pointer("/exit_plan/stop"))),
    });

    let strikes: Vec<f64> = strategy
        .get("strikes")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_f64()).collect())
        .unwrap_or_default();
    let expiration = strategy.get("expiration").and_then(|v| v.as_str());
    let right = strategy.get("right").and_then(|v| v.as_str()).and_then(|s| match s {
        "call" => Some(ContractType::Call),
        "put" => Some(ContractType::Put),
        _ => None,
    });
    let outcome = resolve_cited(set, &strikes, expiration, right);
    let cited_contract = json!({
        "state": outcome.state,
        "contract": outcome.contract,
        "legs": outcome.legs,
    });

    let cap_check = json!({
        "verdict": verdict,
        "effective_dollar_cap": effective_cap,
        "cap_not_derivable_reason": cap_not_derivable_reason,
        "parsed_risk_dollars": parsed_dollars,
        "model_max_risk_text": max_risk_text,
    });

    (cap_check, field_reasons, cited_contract)
}

/// POST rec — auth already checked; pass resolved user for key resolution.
pub async fn generate_recommendation(
    state: &AppState,
    ticker: &str,
    body: &RecRequestBody,
    user: &crate::services::auth::UserRecord,
) -> Value {
    let resolved = resolve_llm_key(state, Some(user));
    let min_dte = body.dte_min.map(|x| x as f64);
    let max_dte = body.dte_max.map(|x| x as f64);
    let bundle = match build_bundle(state, ticker, min_dte, max_dte, false, body.dark_pool).await {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "rec: bundle unavailable");
            return unavailable_envelope(
                body,
                None,
                "llm_error",
                &json!({}),
                &json!({"over_limit": false, "remaining_today": DAILY_CAP, "resets_at": resets_at_iso()}),
            );
        }
    };

    let ai_eval = bundle.get("ai_eval").cloned().unwrap_or(json!({}));
    let gate = derive_gate(&ai_eval);
    let (remaining, over, resets) = rate_snapshot();
    let cap = json!({
        "over_limit": over,
        "remaining_today": remaining,
        "resets_at": resets,
    });
    let (pid, pname) = persona_name(body.persona_id.as_deref());
    let persona = json!({ "id": pid, "name": pname });
    let as_of = bundle
        .pointer("/meta/freshness/snapshot_iso")
        .cloned()
        .unwrap_or(Value::Null);
    let pinned = ai_eval
        .get("state_fingerprint")
        .and_then(|v| v.as_str())
        .unwrap_or(body.snapshot_fingerprint.as_str())
        .to_string();
    let key_source = resolved.key_source;

    // --- B15/B16: candidate block (prompt budget), pruned move, risk block, positions digest —
    // assembled ONCE, used both in the prompt (when the model is actually called) and echoed back
    // on the response envelope (`sent.*`) regardless of outcome.
    let (snap_opt, _) = load_analytics(state, ticker, None, None, false)
        .await
        .unwrap_or((None, String::new()));
    let empty_meta = SnapshotMeta::default();
    let candidate_set = match &snap_opt {
        Some(snap) => CandidateSet::build(
            &snap.contracts,
            snap.gex_spot,
            chrono::Utc::now(),
            DteWindow { min: min_dte, max: max_dte },
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta {
                as_of_iso: chrono::DateTime::from_timestamp(snap.cached_at, 0).map(|d| d.to_rfc3339()),
                session_basis: Some(snap.market_phase.as_str().to_string()),
            },
        ),
        None => CandidateSet::unavailable(CandidateBudget::Prompt, true, &empty_meta, None),
    };
    let sent_candidates = crate::services::rec_inputs::candidate_envelope(ticker, &candidate_set, None);

    // Pruned market_state: the FULL straddle_move already on the bundle, restricted to the tenors
    // actually present in the candidate block — ONE restriction function, never a local filter.
    let raw_move: Option<StraddleMove> =
        bundle.pointer("/market_state/straddle_move").and_then(|v| serde_json::from_value(v.clone()).ok());
    let pruned_move = raw_move.as_ref().map(|mv| restrict_move_to_tenors(mv, candidate_set.included_expirations()));
    let sent_tenors: Vec<String> = pruned_move
        .as_ref()
        .map(|mv| mv.tenors.iter().map(|t| t.expiration.clone()).collect())
        .unwrap_or_default();
    let mut pruned_market_state = bundle.get("market_state").cloned().unwrap_or(json!({}));
    if let Some(mv) = &pruned_move {
        if let Some(o) = pruned_market_state.as_object_mut() {
            o.insert("straddle_move".into(), serde_json::to_value(mv).unwrap_or(Value::Null));
        }
    }

    // Risk inputs — the as-sent block (§4 shape). A settings-read failure degrades to
    // {state:"not_set"} with a warn! — the rec never fails on a settings read (SPEC §5).
    let risk_wire = state.auth.get_settings(user).ok().map(|s| s.risk_inputs);
    if risk_wire.is_none() {
        warn!(user_id = %user.id, "rec: risk-inputs read failed; degrading to not_set");
    }
    let sent_risk_inputs = risk_wire
        .map(|r| serde_json::to_value(r).unwrap_or_else(|_| not_set_risk_inputs()))
        .unwrap_or_else(not_set_risk_inputs);
    let risk_block_present = sent_risk_inputs.get("state").and_then(|v| v.as_str()) == Some("set");
    let account_size = sent_risk_inputs.get("account_size").and_then(|v| v.as_f64());
    let cap_value = sent_risk_inputs.pointer("/per_trade_cap/value").and_then(|v| v.as_f64());
    let cap_unit = sent_risk_inputs.pointer("/per_trade_cap/unit").and_then(|v| v.as_str());
    let sent_digest = crate::services::rec_inputs::digest::risk_inputs_digest(account_size, cap_value, cap_unit);
    let effective_cap = sent_risk_inputs.pointer("/effective_dollar_cap/value").and_then(|v| v.as_f64());
    let cap_not_derivable_reason = sent_risk_inputs
        .pointer("/effective_dollar_cap/not_derivable_reason")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Open positions digest — the client-supplied artifact. NEVER persisted server-side.
    let sent_positions = parse_digest(body.open_positions.as_ref());

    let base = |status: &str, strategy: Value, reason: Option<&str>| {
        let (cap_check, field_reasons, cited_contract) = envelope_extras(
            &strategy,
            &candidate_set,
            effective_cap,
            cap_not_derivable_reason.as_deref(),
            risk_block_present,
            pruned_move.as_ref(),
        );
        json!({
            "status": status,
            "persona": persona,
            "as_of": as_of,
            "pinned_fingerprint": pinned,
            "stale_born": false,
            "strategy": strategy,
            "unavailable_reason": reason,
            "gate": gate,
            "cap": cap,
            "key_source": key_source,
            "remaining_free_uses": null,
            "free_uses_total": null,
            "scenario": null,
            "sent": {
                "budget": "prompt",
                "candidates": sent_candidates,
                "straddle_move_tenors": sent_tenors,
                "risk_inputs": sent_risk_inputs,
                "risk_inputs_digest": sent_digest,
                "open_positions": sent_positions,
            },
            "cap_check": cap_check,
            "field_reasons": field_reasons,
            "cited_contract": cited_contract,
        })
    };

    // No usable key material for this user.
    if !resolved.usable() {
        let reason = resolved.unavailable_reason.unwrap_or("no_key");
        return base("unavailable", Value::Null, Some(reason));
    }

    let gate_state = gate.get("state").and_then(|v| v.as_str()).unwrap_or("");
    if gate_state == "no_fresh_edge" && !body.override_flag {
        return base("gated_off", Value::Null, None);
    }
    if over {
        return base("unavailable", Value::Null, Some("over_cap"));
    }
    if cooldown_remaining() > 0 && !body.override_flag {
        return base("gated_off", Value::Null, None);
    }

    // Default: call the real provider when a key is resolved.
    // Set AI_REC_LOCAL_ONLY=1 to force rule-based setups (free CI / offline demos).
    let local_only = std::env::var("AI_REC_LOCAL_ONLY")
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false);

    let strategy = if local_only {
        local_strategy_from_bundle(&bundle)
    } else {
        let ctx = RecPromptContext {
            market_state: pruned_market_state,
            signals: bundle.get("signals"),
            ai_eval: bundle.get("ai_eval"),
            candidates: sent_candidates.clone(),
            risk_inputs: sent_risk_inputs.clone(),
            open_positions: sent_positions.clone(),
        };
        let (system, user_prompt) = build_rec_prompts(ticker, &ctx, &pname);
        match complete_strategy(&resolved, &system, &user_prompt).await {
            Ok(s) => s,
            Err(reason) => {
                return base("unavailable", Value::Null, Some(reason));
            }
        }
    };

    commit_query();
    let status = if strategy.get("decision").and_then(|v| v.as_str()) == Some("no_trade") {
        "no_trade"
    } else {
        "produced"
    };
    base(status, strategy, None)
}

fn unavailable_envelope(
    body: &RecRequestBody,
    as_of: Option<Value>,
    reason: &str,
    gate: &Value,
    cap: &Value,
) -> Value {
    let (pid, pname) = persona_name(body.persona_id.as_deref());
    json!({
        "status": "unavailable",
        "persona": { "id": pid, "name": pname },
        "as_of": as_of.unwrap_or(Value::Null),
        "pinned_fingerprint": body.snapshot_fingerprint,
        "stale_born": false,
        "strategy": null,
        "unavailable_reason": reason,
        "gate": gate,
        "cap": cap,
        "key_source": "none",
        "scenario": null,
    })
}

fn local_strategy_from_bundle(bundle: &Value) -> Value {
    let setups = bundle
        .pointer("/signals/setups")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if setups.is_empty() {
        return json!({
            "decision": "no_trade",
            "bias": "neutral",
            "structure": null,
            "strikes": [],
            "expiration": null,
            "entry_trigger": null,
            "invalidation_level": null,
            "max_risk": null,
            "position_size": null,
            "exit_plan": { "target": null, "stop": null },
            "time_horizon": null,
            "confidence": null,
            "summary": "No high-conviction setup in current signals.",
            "key_points": [],
            "reengage_when": ["Wait for score/setup edge near walls or gamma flip."],
            "rationale": "Signals layer produced no setups; standing aside preserves capital.",
        });
    }
    let top = &setups[0];
    let bias = top.get("bias").and_then(|v| v.as_str()).unwrap_or("neutral");
    let name = top.get("name").and_then(|v| v.as_str()).unwrap_or("Setup");
    let strategy = top
        .get("strategy")
        .and_then(|v| v.as_str())
        .unwrap_or("defined-risk structure");
    let rationale = top
        .get("rationale")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let conf = top
        .get("conviction")
        .and_then(|v| v.as_str())
        .unwrap_or("medium");
    let flip = bundle
        .pointer("/market_state/gamma_flip")
        .and_then(|v| v.as_f64());
    json!({
        "decision": "trade",
        "bias": bias,
        "structure": strategy,
        "strikes": [],
        "expiration": null,
        "entry_trigger": format!("At/near {name}"),
        "invalidation_level": flip,
        "max_risk": "1R defined-risk",
        "position_size": "small (rule-based local rec; not LLM)",
        "exit_plan": { "target": null, "stop": flip },
        "time_horizon": "1–5 sessions",
        "confidence": conf,
        "summary": name,
        "key_points": [rationale],
        "reengage_when": [],
        "rationale": rationale,
    })
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RecRequestBody {
    pub persona_id: Option<String>,
    pub snapshot_fingerprint: String,
    pub dte_min: Option<i32>,
    pub dte_max: Option<i32>,
    #[serde(default = "default_true")]
    pub dark_pool: bool,
    #[serde(default, rename = "override")]
    pub override_flag: bool,
    pub scenario_id: Option<String>,
    /// The client-supplied open-positions digest (SPEC §2.6). Raw `Value` so a malformed digest
    /// can never 422 the rec — `rec_inputs::digest::parse_digest` is total.
    #[serde(default)]
    pub open_positions: Option<Value>,
}

fn default_true() -> bool {
    true
}

/// Ensure ai_eval on bundle when missing (for status).
pub fn ensure_ai_eval(bundle: &mut Value) {
    if bundle.get("ai_eval").is_some() {
        return;
    }
    if let Some(sig) = bundle.get("signals") {
        // Best-effort: reconstruct gate from score if signals present.
        let score = sig
            .get("opportunity_score")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i32;
        let ready = score >= DEFAULT_GATE_SCORE;
        bundle.as_object_mut().map(|o| {
            o.insert(
                "ai_eval".into(),
                json!({
                    "ready": ready,
                    "reasons": if ready { json!([format!("score>={DEFAULT_GATE_SCORE}")]) } else { json!([]) },
                    "score_threshold": DEFAULT_GATE_SCORE,
                }),
            )
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_shape() {
        let resolved = ResolvedLlmKey::none("no_key");
        let s = status_payload(Some(&json!({"ready": true, "reasons": []})), &resolved);
        assert!(s["availability"]["in_app_enabled"].is_boolean());
        assert!(s["gate"]["state"].is_string());
        assert!(s["cap"]["remaining_today"].is_number());
        assert_eq!(s["scenarios"]["enabled"], false);
    }

    fn stub_bundle() -> Value {
        json!({
            "market_state": {"ticker": "SPY", "straddle_move": {"state": "ok"}},
            "signals": {"opportunity_score": 70},
            "strike_profile": {},
            "ai_eval": {"ready": true},
            "meta": {}
        })
    }

    fn stub_candidates() -> Value {
        json!({ "state": "ok", "budget": "handoff", "sent_to_model": false, "included": {"contracts": 3, "expiration_count": 1} })
    }

    #[test]
    fn export_shape() {
        let bundle = stub_bundle();
        let e = build_export("SPY", &bundle, Some("income_keeper"), stub_candidates(), not_set_risk_inputs());
        assert_eq!(e["ticker"], "SPY");
        assert!(e["persona_prompt"].as_str().unwrap().contains("Income Keeper"));
        assert!(e["context"]["signals"].is_object());
    }

    #[test]
    fn an_anonymous_export_reports_risk_inputs_not_set_with_the_section_present() {
        let e = build_export("SPY", &stub_bundle(), None, stub_candidates(), not_set_risk_inputs());
        assert_eq!(e["context"]["risk_inputs"]["state"], "not_set");
        assert!(e["context"]["risk_inputs"].is_object());
    }

    #[test]
    fn the_egress_note_is_composed_from_the_categories_and_no_longer_claims_no_account_or_identity() {
        let e = build_export("SPY", &stub_bundle(), None, stub_candidates(), not_set_risk_inputs());
        let note = e["egress_note"].as_str().unwrap();
        assert!(!note.to_ascii_lowercase().contains("no account or identity"));
        for cat in e["egress_categories"].as_array().unwrap() {
            if cat["sent"] == true {
                let key = cat["key"].as_str().unwrap();
                // Every SENT category's human label must actually appear in the composed note.
                let present = match key {
                    "context" => note.contains("context"),
                    "candidates" => note.contains("candidate contracts"),
                    "risk_inputs" => note.contains("your risk inputs"),
                    "persona_prompt" => note.contains("the persona prompt"),
                    "glossary" => note.contains("the glossary"),
                    _ => true,
                };
                assert!(present, "note missing sent category {key}: {note}");
            }
        }
    }

    #[test]
    fn a_category_that_was_not_sent_is_present_with_sent_false() {
        let e = build_export("SPY", &stub_bundle(), None, stub_candidates(), not_set_risk_inputs());
        let cats = e["egress_categories"].as_array().unwrap();
        let op = cats.iter().find(|c| c["key"] == "open_positions").unwrap();
        assert_eq!(op["sent"], false);
        // risk_inputs is present (not omitted) even though not_set means it was not sent.
        let ri = cats.iter().find(|c| c["key"] == "risk_inputs").unwrap();
        assert_eq!(ri["sent"], false);
    }

    #[test]
    fn the_export_candidate_block_uses_the_handoff_budget_and_sent_to_model_false() {
        let e = build_export("SPY", &stub_bundle(), None, stub_candidates(), not_set_risk_inputs());
        assert_eq!(e["context"]["candidates"]["budget"], "handoff");
        assert_eq!(e["context"]["candidates"]["sent_to_model"], false);
    }
}
