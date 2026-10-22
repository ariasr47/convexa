//! AI recommendation leaf — wire-compatible with Python `ai_recommendation`.
//!
//! Pure consumer of cached bundles. Never feeds score/fingerprint.
//! Key resolution (INTERFACE fixed order; D5 + D7):
//!   1. Auth outermost (caller)
//!   2. `ai_power_path` null → `none` / `no_key` (do not evaluate model)
//!   3. Model gate when path is set
//!   4. `grok_subscription` → subscription/OAuth reasons only; never BYO; never env XAI
//!   5. `own_key` → decrypt selected provider slot
//!   6. Never fall through onto server env keys (`shared_admin` deleted)
//!
//! LLM calls use `services::llm` (Anthropic / OpenAI-compatible / Gemini).

use crate::domain::today_et_date;
use crate::routes::market::build_bundle;
use crate::services::analytics::load_analytics;
use crate::services::llm::{
    build_rec_prompts, complete_strategy, LlmProvider, RecPromptContext, ResolvedLlmKey,
};
use crate::services::rec_inputs::cap_check::cap_verdict;
use crate::services::rec_inputs::cited::resolve_cited;
use crate::services::rec_inputs::digest::parse_digest;
use crate::services::rec_inputs::field_reasons::{
    field_reason, plan_field_reason, plan_value, FieldReason, InputPresence, PlanInputPresence,
    RecField, RecPlanField,
};
use crate::services::rec_inputs::grounding::{
    card_member, counts, resolve_field, GroundingAnchors, GROUNDING_TOL_PCT,
};
use crate::services::rec_inputs::max_risk::{parse_max_risk_dollars, ParsedRisk};
use crate::state::AppState;
use quant_engine::{
    restrict_move_to_tenors, CandidateBudget, CandidateSet, ContractType, DteWindow, SnapshotMeta,
    StraddleMove, StraddleMoveState,
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
        .map(|v| {
            !matches!(
                v.to_ascii_lowercase().as_str(),
                "0" | "false" | "no" | "off"
            )
        })
        .unwrap_or(true)
}

fn own_key_base_url(provider: LlmProvider) -> Option<String> {
    std::env::var(format!(
        "AI_REC_BASE_URL_{}",
        provider.as_str().to_ascii_uppercase()
    ))
    .ok()
    .filter(|s| !s.is_empty())
    .or_else(|| provider.default_base_url().map(|s| s.to_string()))
}

/// Resolve key for a signed-in user (or unsigned status probe).
pub fn resolve_llm_key(
    state: &AppState,
    user: Option<&crate::services::auth::UserRecord>,
) -> ResolvedLlmKey {
    resolve_llm_key_for(&state.auth, user)
}

pub fn resolve_llm_key_for(
    auth: &crate::services::auth::AuthService,
    user: Option<&crate::services::auth::UserRecord>,
) -> ResolvedLlmKey {
    if !feature_flag_on() {
        return ResolvedLlmKey::none("no_key");
    }
    let Some(u) = user else {
        return ResolvedLlmKey::unsigned();
    };
    // Force legacy-slot promote + own_key backfill before reading preference.
    let _ = auth.inspect_ai_slot(&u.id, "anthropic");
    let settings = auth
        .raw_settings(&u.id)
        .unwrap_or_else(|| crate::services::auth::SettingsRecord::defaults(&u.id));

    let pref_path = settings.ai_power_path.clone();
    let pref_provider = settings.ai_provider.clone();
    let pref_model = settings.ai_model.clone();

    let mut out = ResolvedLlmKey {
        key_source: "none",
        provider: LlmProvider::Anthropic,
        wire_provider: None,
        key_material: None,
        model: pref_model.clone().unwrap_or_default(),
        wire_model: pref_model.clone(),
        base_url: None,
        unavailable_reason: None,
        metering_identity: Some(u.id.clone()),
        preference_power_path: pref_path.clone(),
        preference_provider: pref_provider.clone(),
        preference_model: pref_model.clone(),
    };

    let Some(path) = pref_path.as_deref() else {
        out.unavailable_reason = Some("no_key");
        return out;
    };

    let catalog =
        crate::services::llm_catalog::catalog_for_path(Some(path), pref_provider.as_deref());
    let selected = pref_model
        .clone()
        .or_else(|| crate::services::llm_catalog::recommended_id(&catalog).map(|s| s.to_string()));
    match selected {
        None => {
            out.unavailable_reason = Some("model_unset");
            out.wire_model = None;
            return out;
        }
        Some(id) => {
            out.model = id.clone();
            out.wire_model = Some(id.clone());
            if !crate::services::llm_catalog::catalog_contains(&catalog, &id) {
                out.unavailable_reason = Some("model_not_in_catalog");
                return out;
            }
        }
    }

    match path {
        "grok_subscription" => {
            // Never decrypt BYO. Never spend a Convexa env XAI_API_KEY.
            let (available, connected, reason) = auth.grok_link_status(u);
            out.provider = LlmProvider::Xai;
            out.wire_provider = None;
            if available && connected {
                out.key_source = "grok_subscription";
                // v1 has no spend material even if a stale link row exists.
                out.unavailable_reason = Some("subscription_unavailable");
            } else {
                out.unavailable_reason = reason.or(Some("oauth_unlinked"));
            }
            out
        }
        "own_key" => {
            let Some(prov_s) = pref_provider.as_deref() else {
                out.unavailable_reason = Some("no_key");
                return out;
            };
            if !crate::services::llm_catalog::is_trader_byo(prov_s) {
                out.unavailable_reason = Some("no_key");
                return out;
            }
            let provider = LlmProvider::parse(prov_s).unwrap_or(LlmProvider::Anthropic);
            out.provider = provider;
            out.wire_provider = Some(provider.as_str());
            match auth.inspect_ai_slot(&u.id, prov_s) {
                crate::services::auth::AiSlot::Empty => {
                    out.unavailable_reason = Some("no_key");
                }
                crate::services::auth::AiSlot::Unusable => {
                    out.unavailable_reason = Some("key_unusable");
                }
                crate::services::auth::AiSlot::Ready { plaintext } => {
                    out.key_source = "own_key";
                    out.key_material = Some(plaintext);
                    out.base_url = own_key_base_url(provider);
                    out.unavailable_reason = None;
                }
            }
            out
        }
        _ => {
            out.unavailable_reason = Some("no_key");
            out
        }
    }
}

fn rate_snapshot() -> (i32, bool, String) {
    // Process-local daily cap (TECH_DEBT #17 / backlog 1.8). Correct under a single
    // Railway `api` replica. Multi-replica deploys must either pin one replica or
    // accept N× DAILY_CAP until a durable shared counter ships.
    let mut g = RATE.lock().unwrap_or_else(|e| e.into_inner());
    let today = today_et_date(chrono::Utc::now());
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
    let today = today_et_date(chrono::Utc::now());
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
    let reasons = ai_eval.get("reasons").cloned().unwrap_or_else(|| json!([]));
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

/// GET status — side-effect-free. No D4 persist. No free-uses counters.
pub fn status_payload(
    ai_eval: Option<&Value>,
    resolved: &ResolvedLlmKey,
    signed_in: bool,
) -> Value {
    let (remaining, over, resets) = rate_snapshot();
    let gate = derive_gate(ai_eval.unwrap_or(&json!({})));
    let in_app = signed_in
        && resolved.usable()
        && (resolved.key_source == "own_key" || resolved.key_source == "grok_subscription");
    let (key_source, provider, model, reason, pref_path, pref_prov, pref_model) = if signed_in {
        (
            resolved.key_source,
            resolved.wire_provider_value(),
            resolved.wire_model_value(),
            resolved
                .unavailable_reason
                .map(|s| json!(s))
                .unwrap_or(Value::Null),
            resolved
                .preference_power_path
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
            resolved
                .preference_provider
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
            resolved
                .preference_model
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
        )
    } else {
        (
            "none",
            Value::Null,
            Value::Null,
            Value::Null,
            Value::Null,
            Value::Null,
            Value::Null,
        )
    };
    json!({
        "availability": { "in_app_enabled": in_app },
        "gate": gate,
        "cap": {
            "over_limit": over,
            "remaining_today": remaining,
            "resets_at": resets,
        },
        "powering": {
            "key_source": key_source,
            "provider": provider,
            "model": model,
            "unavailable_reason": reason,
            "preference": {
                "power_path": pref_path,
                "provider": pref_prov,
                "model": pref_model,
            },
        },
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
pub fn build_export(
    ticker: &str,
    bundle: &Value,
    persona_id: Option<&str>,
    candidates: Value,
    risk_inputs: Value,
) -> Value {
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
    let egress_categories: Vec<Value> = categories
        .iter()
        .map(|(k, sent, _)| json!({ "key": k, "sent": sent }))
        .collect();
    let sent_labels: Vec<&str> = categories
        .iter()
        .filter(|(_, sent, _)| *sent)
        .map(|(_, _, l)| *l)
        .collect();
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
    anchors: GroundingAnchors,
    local_only: bool,
) -> (Value, Value, Value, Value) {
    let states_entry = strategy.get("decision").and_then(|v| v.as_str()) == Some("trade");
    let max_risk_text = strategy.get("max_risk").and_then(|v| v.as_str());
    let parsed = parse_max_risk_dollars(max_risk_text);
    let verdict = cap_verdict(states_entry, effective_cap, parsed);
    let (parsed_dollars, risk_refusal) = match parsed {
        ParsedRisk::Dollars(v) => (Some(v), None),
        ParsedRisk::NotParseable(r) => (None, Some(r)),
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
            Some(r) => serde_json::to_value(FieldReason {
                reason: r.reason,
                missing_input: r.missing_input,
            })
            .unwrap_or(Value::Null),
            None => Value::Null,
        }
    };
    // The SIX plan/conviction fields ride the same object, built at this ONE site so they cannot be
    // partially applied (INTERFACE_CONTRACT rule 2). `local_only` declares NO candidate-set
    // dependency — the local-rules producer needs no set at all, so an empty set says nothing about
    // its `strikes`/`expiration` and `unavailable` must stay unreachable there.
    let plan_presence = PlanInputPresence {
        candidate_set: if local_only {
            None
        } else {
            Some(!set.contracts().is_empty())
        },
    };
    let pfr = |field: RecPlanField| -> Value {
        match plan_field_reason(field, plan_value(field, strategy), plan_presence) {
            Some(r) => serde_json::to_value(r).unwrap_or(Value::Null),
            None => Value::Null,
        }
    };
    let field_reasons = json!({
        "max_risk": fr(RecField::MaxRisk, present(strategy.get("max_risk"))),
        "position_size": fr(RecField::PositionSize, present(strategy.get("position_size"))),
        "exit_target": fr(RecField::ExitTarget, present(strategy.pointer("/exit_plan/target"))),
        "exit_stop": fr(RecField::ExitStop, present(strategy.pointer("/exit_plan/stop"))),
        "invalidation_level": fr(RecField::InvalidationLevel, present(strategy.get("invalidation_level"))),
        "structure": pfr(RecPlanField::Structure),
        "strikes": pfr(RecPlanField::Strikes),
        "expiration": pfr(RecPlanField::Expiration),
        "entry_trigger": pfr(RecPlanField::EntryTrigger),
        "time_horizon": pfr(RecPlanField::TimeHorizon),
        "confidence": pfr(RecPlanField::Confidence),
    });

    let strikes: Vec<f64> = strategy
        .get("strikes")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_f64()).collect())
        .unwrap_or_default();
    let expiration = strategy.get("expiration").and_then(|v| v.as_str());
    let right = strategy
        .get("right")
        .and_then(|v| v.as_str())
        .and_then(|s| match s {
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
        "risk_refusal": risk_refusal,
    });

    // --- grounding (SPEC §2.1-2.4). The SENT inputs only: `pruned_move`, never `raw_move`; the
    // `Prompt` candidate set, never a `Handoff` one.
    let num = |p: Option<&Value>| p.and_then(|v| v.as_f64());
    let presence_sentinel = |p: Option<&Value>| present(p).then_some(1.0); // prose fields: presence only
    let cited_exp = expiration;
    let g = |field: RecField, asserted: Option<f64>| {
        resolve_field(field, asserted, cited_exp, pruned_move, &anchors)
    };
    let f_stop = g(RecField::ExitStop, num(strategy.pointer("/exit_plan/stop")));
    let f_target = g(
        RecField::ExitTarget,
        num(strategy.pointer("/exit_plan/target")),
    );
    let f_inval = g(
        RecField::InvalidationLevel,
        num(strategy.get("invalidation_level")),
    );
    let f_risk = g(
        RecField::MaxRisk,
        presence_sentinel(strategy.get("max_risk")),
    );
    let f_size = g(
        RecField::PositionSize,
        presence_sentinel(strategy.get("position_size")),
    );
    let all = [
        f_stop.clone(),
        f_target.clone(),
        f_inval.clone(),
        f_risk.clone(),
        f_size.clone(),
    ];
    let c = counts(&all, outcome.state);
    let card = card_member(states_entry, local_only, c);
    let grounding = json!({
        "card": card,
        "counts": c,
        "tolerance_pct": GROUNDING_TOL_PCT,
        "fields": {
            "exit_stop": f_stop,
            "exit_target": f_target,
            "invalidation_level": f_inval,
            "max_risk": f_risk,
            "position_size": f_size,
        },
    });

    (cap_check, field_reasons, cited_contract, grounding)
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
                &resolved,
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
            DteWindow {
                min: min_dte,
                max: max_dte,
            },
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta {
                as_of_iso: chrono::DateTime::from_timestamp(snap.cached_at, 0)
                    .map(|d| d.to_rfc3339()),
                session_basis: Some(snap.market_phase.as_str().to_string()),
            },
        ),
        None => CandidateSet::unavailable(CandidateBudget::Prompt, true, &empty_meta, None),
    };
    let sent_candidates =
        crate::services::rec_inputs::candidate_envelope(ticker, &candidate_set, None);

    // Pruned market_state: the FULL straddle_move already on the bundle, restricted to the tenors
    // actually present in the candidate block — ONE restriction function, never a local filter.
    let raw_move: Option<StraddleMove> = bundle
        .pointer("/market_state/straddle_move")
        .and_then(|v| serde_json::from_value(v.clone()).ok());
    let pruned_move = raw_move
        .as_ref()
        .map(|mv| restrict_move_to_tenors(mv, candidate_set.included_expirations()));
    let sent_tenors: Vec<String> = pruned_move
        .as_ref()
        .map(|mv| mv.tenors.iter().map(|t| t.expiration.clone()).collect())
        .unwrap_or_default();
    let mut pruned_market_state = bundle.get("market_state").cloned().unwrap_or(json!({}));
    if let Some(mv) = &pruned_move {
        if let Some(o) = pruned_market_state.as_object_mut() {
            o.insert(
                "straddle_move".into(),
                serde_json::to_value(mv).unwrap_or(Value::Null),
            );
        }
    }

    // The eleven price-scale anchors, read off the SENT market_state and captured by VALUE — the
    // `base` closure cannot borrow `pruned_market_state`, which is moved into `RecPromptContext` at
    // the provider call below.
    let grounding_anchors = GroundingAnchors::from_market_state(&pruned_market_state);

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
    let account_size = sent_risk_inputs
        .get("account_size")
        .and_then(|v| v.as_f64());
    let cap_value = sent_risk_inputs
        .pointer("/per_trade_cap/value")
        .and_then(|v| v.as_f64());
    let cap_unit = sent_risk_inputs
        .pointer("/per_trade_cap/unit")
        .and_then(|v| v.as_str());
    let sent_digest =
        crate::services::rec_inputs::digest::risk_inputs_digest(account_size, cap_value, cap_unit);
    let effective_cap = sent_risk_inputs
        .pointer("/effective_dollar_cap/value")
        .and_then(|v| v.as_f64());
    let cap_not_derivable_reason = sent_risk_inputs
        .pointer("/effective_dollar_cap/not_derivable_reason")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Open positions digest — the client-supplied artifact. NEVER persisted server-side.
    let sent_positions = parse_digest(body.open_positions.as_ref());

    // Hoisted above `base` so the card-level provenance member is derived inside the envelope
    // constructor and the grounding leaf takes a plain `bool` (SPEC §2.4). Pure env read, no side
    // effect; `AI_REC_LOCAL_ONLY=1` forces rule-based setups (free CI / offline demos).
    let local_only = std::env::var("AI_REC_LOCAL_ONLY")
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false);

    let base = |status: &str, strategy: Value, reason: Option<&str>| {
        let (cap_check, field_reasons, cited_contract, grounding) = envelope_extras(
            &strategy,
            &candidate_set,
            effective_cap,
            cap_not_derivable_reason.as_deref(),
            risk_block_present,
            pruned_move.as_ref(),
            grounding_anchors,
            local_only,
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
            "provider": resolved.wire_provider_value(),
            "model": resolved.wire_model_value(),
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
            "grounding": grounding,
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
    // (`local_only` hoisted above `base` — see comment there.)
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
    resolved: &ResolvedLlmKey,
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
        "key_source": resolved.key_source,
        "provider": resolved.wire_provider_value(),
        "model": resolved.wire_model_value(),
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
    let bias = top
        .get("bias")
        .and_then(|v| v.as_str())
        .unwrap_or("neutral");
    let name = top.get("name").and_then(|v| v.as_str()).unwrap_or("Setup");
    let strategy = top
        .get("strategy")
        .and_then(|v| v.as_str())
        .unwrap_or("defined-risk structure");
    let rationale = top.get("rationale").and_then(|v| v.as_str()).unwrap_or("");
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
        // rec-absence-literals-hole §2.4 — DELETED: a named author with ZERO input dependence. No
        // rule and no read computed it; it was the same string on every card. The assembler now
        // states nothing and `plan_field_reason` reports `not_given` (AC-33).
        "time_horizon": null,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_extras_returns_a_total_grounding_block_on_a_null_strategy() {
        let set = CandidateSet::unavailable(
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
            None,
        );
        let (_cap, _fr, _cited, grounding) = envelope_extras(
            &Value::Null,
            &set,
            None,
            None,
            false,
            None,
            GroundingAnchors::empty(),
            false,
        );
        assert_eq!(grounding["card"], "not_applicable");
        assert_eq!(grounding["tolerance_pct"], 0.1);
        for k in [
            "exit_stop",
            "exit_target",
            "invalidation_level",
            "max_risk",
            "position_size",
        ] {
            assert!(
                grounding["fields"][k].is_object(),
                "missing field block {k}"
            );
            assert_eq!(grounding["fields"][k]["state"], "not_applicable");
            assert!(grounding["fields"][k]["basis"].is_null());
        }
        for k in ["checked", "traced", "untraced", "not_checkable"] {
            assert_eq!(grounding["counts"][k], 0);
        }
    }

    // ---- rec-absence-literals-hole ------------------------------------------------------------

    #[test]
    fn field_reasons_carries_exactly_eleven_keys_with_exact_spellings() {
        let set = CandidateSet::unavailable(
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
            None,
        );
        let (_cap, fr, _cited, _g) = envelope_extras(
            &Value::Null,
            &set,
            None,
            None,
            false,
            None,
            GroundingAnchors::empty(),
            false,
        );
        let obj = fr.as_object().expect("field_reasons is an object");
        let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
        keys.sort_unstable();
        // Hand-built with `json!`, so NOTHING else pins these spellings: a typo'd key is invisible on
        // both sides and would be wrong on every field at once (AC-32).
        assert_eq!(
            keys,
            vec![
                "confidence",
                "entry_trigger",
                "exit_stop",
                "exit_target",
                "expiration",
                "invalidation_level",
                "max_risk",
                "position_size",
                "strikes",
                "structure",
                "time_horizon",
            ]
        );
        assert_eq!(obj.len(), 11);
    }

    #[test]
    fn the_six_ride_the_local_rules_envelope_and_never_claim_unavailable_there() {
        let set = CandidateSet::unavailable(
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
            None,
        );
        let strategy = local_strategy_from_bundle(&serde_json::json!({
            "signals": { "setups": [{ "bias": "long", "name": "Flip reclaim", "strategy": "long call",
                                      "rationale": "r", "conviction": "medium" }] },
            "market_state": { "gamma_flip": 245.0 },
        }));
        // local_only = true => the producer declares NO candidate-set dependency.
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy,
            &set,
            None,
            None,
            false,
            None,
            GroundingAnchors::empty(),
            true,
        );
        for k in ["strikes", "expiration"] {
            assert_eq!(
                fr[k]["reason"], "not_given",
                "{k} must not claim an input failed here"
            );
            assert!(fr[k]["missing_input"].is_null(), "{k}");
        }
        // Rule-authored, so they carry values and no reason at all.
        for k in ["structure", "entry_trigger", "confidence"] {
            assert!(
                fr[k].is_null(),
                "{k} was authored by the rules and needs no reason"
            );
        }
        // AC-33 — the input-independent constant is gone; the horizon is honestly absent.
        assert_eq!(fr["time_horizon"]["reason"], "not_given");
        assert!(strategy["time_horizon"].is_null());
    }

    #[test]
    fn a_declared_empty_candidate_set_names_candidate_set_on_the_two_fields_that_depend_on_it() {
        let set = CandidateSet::unavailable(
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
            None,
        );
        let strategy = serde_json::json!({
            "decision": "trade", "structure": "", "strikes": [], "expiration": null,
            "entry_trigger": "", "time_horizon": null, "confidence": null,
        });
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy,
            &set,
            None,
            None,
            false,
            None,
            GroundingAnchors::empty(),
            false,
        );
        for k in ["strikes", "expiration"] {
            assert_eq!(fr[k]["reason"], "unavailable", "{k}");
            assert_eq!(fr[k]["missing_input"], "candidate_set", "{k}");
        }
        for k in ["structure", "entry_trigger", "time_horizon", "confidence"] {
            assert_eq!(fr[k]["reason"], "not_given", "{k}");
            assert!(fr[k]["missing_input"].is_null(), "{k}");
        }
    }

    #[test]
    fn an_off_scale_confidence_is_reported_as_unrecognized_value_not_as_never_answered() {
        let set = CandidateSet::unavailable(
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
            None,
        );
        let strategy = serde_json::json!({ "decision": "trade", "confidence": "quite high" });
        let (_cap, fr, _cited, _g) = envelope_extras(
            &strategy,
            &set,
            None,
            None,
            false,
            None,
            GroundingAnchors::empty(),
            false,
        );
        assert_eq!(fr["confidence"]["reason"], "unrecognized_value");
        assert!(fr["confidence"]["missing_input"].is_null());
    }

    /// A hermetic two-contract `CandidateSet` (the 500 call + the 500 put), the standard reference set
    /// for the guard tests below. Mirrors `cited.rs`'s test-only `set()` builder.
    fn reference_set() -> CandidateSet {
        use chrono::{TimeZone, Utc};
        use quant_engine::{Contract, Greeks};
        let quoted = |strike: f64, side: ContractType, exp: &str| Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: 100.0,
            expiration_date: exp.into(),
            implied_volatility: 0.3,
            greeks: Some(Greeks {
                gamma: Some(0.01),
                delta: Some(0.5),
                theta: None,
                vega: None,
            }),
            volume: Some(10.0),
            bid: Some(1.0),
            ask: Some(1.2),
        };
        let chain = vec![
            quoted(500.0, ContractType::Call, "2026-09-18"),
            quoted(500.0, ContractType::Put, "2026-09-18"),
        ];
        CandidateSet::build(
            &chain,
            500.0,
            Utc.with_ymd_and_hms(2026, 8, 12, 20, 0, 0).unwrap(),
            DteWindow::default(),
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
        )
    }

    /// anchors 500/510/490 + a one-tenor pruned move [490, 510] for 2026-09-18 — the shared
    /// reference fixtures for the B11-B13 guard tests.
    fn reference_anchors() -> GroundingAnchors {
        use crate::services::rec_inputs::grounding::AnchorKind;
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::GexSpot, Some(500.00));
        a.set(AnchorKind::CallWall, Some(510.00));
        a.set(AnchorKind::PutWall, Some(490.00));
        a
    }

    fn reference_move() -> StraddleMove {
        StraddleMove {
            state: StraddleMoveState::Ok,
            as_of: None,
            session_basis: None,
            anchor_spot: Some(500.00),
            anchor_basis: quant_engine::AnchorBasis::GexSpot,
            anchor_label: "levels-anchor".into(),
            primary_expiration: Some("2026-09-18".into()),
            wide_quote_threshold_pct: 15.0,
            tenors: vec![quant_engine::StraddleTenor {
                expiration: "2026-09-18".into(),
                dte: 30,
                strike_used: 500.0,
                strike_distance_pct: 0.0,
                straddle_price: 10.00,
                move_dollars: 10.00,
                move_pct: 2.0,
                basis: quant_engine::MoveBasis::AtmStraddleMid,
                quote_spread_pct_of_mid: None,
                wide_quotes: false,
            }],
        }
    }

    /// The standard call shape for the B11-B13 guard tests: the hermetic reference set, the one-tenor
    /// reference move, a populated anchor set, `local_only = false`.
    fn extras_for(strategy: &Value) -> (Value, Value, Value, Value) {
        let set = reference_set();
        let mv = reference_move();
        envelope_extras(
            strategy,
            &set,
            Some(500.0),
            None,
            true,
            Some(&mv),
            reference_anchors(),
            false,
        )
    }

    /// Same as `extras_for`, but with empty anchors and no move — for the every-input-missing arm.
    fn extras_for_bare(strategy: &Value) -> (Value, Value, Value, Value) {
        let set = reference_set();
        envelope_extras(
            strategy,
            &set,
            Some(500.0),
            None,
            true,
            None,
            GroundingAnchors::empty(),
            false,
        )
    }

    /// `local_only = true` variant, returning just the grounding block.
    fn extras_local_only(strategy: &Value) -> Value {
        let set = reference_set();
        let mv = reference_move();
        envelope_extras(
            strategy,
            &set,
            Some(500.0),
            None,
            true,
            Some(&mv),
            reference_anchors(),
            true,
        )
        .3
    }

    /// Every shape the partition assertion (guard 2 / AC-51) must hold over: a full trade rec; a trade
    /// rec with every figure null; a `no_trade` rec; `Value::Null`; a trade rec with only the stop set.
    fn partition_strategy_shapes() -> Vec<Value> {
        vec![
            json!({
                "decision": "trade", "strikes": [500.0], "expiration": "2026-09-18", "right": "call",
                "invalidation_level": 490.30, "max_risk": "$300", "position_size": "2 contracts",
                "exit_plan": { "target": 505.0, "stop": 500.0 },
            }),
            json!({
                "decision": "trade", "strikes": [], "expiration": null, "right": null,
                "invalidation_level": null, "max_risk": null, "position_size": null,
                "exit_plan": { "target": null, "stop": null },
            }),
            json!({
                "decision": "no_trade", "strikes": [], "expiration": null, "right": null,
                "invalidation_level": null, "max_risk": null, "position_size": null,
                "exit_plan": { "target": null, "stop": null },
            }),
            Value::Null,
            json!({
                "decision": "trade", "strikes": [], "expiration": null, "right": null,
                "invalidation_level": null, "max_risk": null, "position_size": null,
                "exit_plan": { "target": null, "stop": 500.0 },
            }),
        ]
    }

    /// guard 2 / AC-51 — for EVERY field on EVERY branch, a `field_reason` exists IFF the grounding
    /// state is `not_applicable` (exclusive-or). Poison arm: make one field emit both, or neither.
    #[test]
    fn a_field_reason_exists_exactly_when_grounding_is_not_applicable() {
        let keys = [
            "max_risk",
            "position_size",
            "exit_target",
            "exit_stop",
            "invalidation_level",
        ];
        let shapes = partition_strategy_shapes();
        // Anti-vacuity: the shapes must exercise BOTH sides of the biconditional.
        assert!(
            shapes.len() >= 4,
            "the shape set must cover more than one branch"
        );
        for strategy in &shapes {
            let (_cap, fr, _cited, g) = extras_for(strategy);
            for k in keys {
                let has_reason = !fr[k].is_null();
                let is_na = g["fields"][k]["state"] == "not_applicable";
                assert_eq!(has_reason, is_na, "partition broken for {k} on {strategy}");
            }
        }
    }

    /// AC-42 (SB) — a hand-written fabricated rec through the recommendation's OWN serialization path:
    /// a stop far from every named anchor, a target outside the pruned move for the cited tenor, an
    /// invalidation level far from every anchor, a strike absent from the candidate set.
    #[test]
    fn a_fabricated_rec_resolves_every_asserted_figure_to_a_non_traced_state() {
        let strategy = json!({
            "decision": "trade",
            "strikes": [777.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 611.0,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 640.0, "stop": 623.0 },
        });
        let (_cap, _fr, cited, g) = extras_for(&strategy);
        assert_eq!(cited["state"], "off_set");
        for k in ["exit_stop", "exit_target", "invalidation_level"] {
            assert_eq!(
                g["fields"][k]["state"], "untraced",
                "{k} must not be traced"
            );
            assert!(g["fields"][k]["basis"].is_null());
            assert!(g["fields"][k]["anchor_kind"].is_null());
        }
        assert_eq!(
            g["counts"],
            json!({"checked": 4, "traced": 0, "untraced": 4, "not_checkable": 0})
        );
        assert_eq!(g["card"], "none_traced");
    }

    /// AC-43 (SB) — without this arm the fabrication fixture proves only that the resolver says no.
    #[test]
    fn the_honest_counterpart_traces_all_four_and_the_one_field_off_variant_traces_three() {
        let honest = json!({
            "decision": "trade",
            "strikes": [500.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 490.30,                    // inside the put wall's window -> near
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 505.0, "stop": 500.0 },  // stop exactly on gex_spot -> exact
        });
        let (_cap, _fr, cited, g) = extras_for(&honest);
        assert_eq!(cited["state"], "cited");
        assert_eq!(g["fields"]["exit_stop"]["basis"], "exact");
        assert_eq!(g["fields"]["exit_stop"]["anchor_kind"], "gex_spot");
        assert_eq!(g["fields"]["exit_stop"]["anchor_value"], 500.0);
        assert_eq!(g["fields"]["invalidation_level"]["basis"], "near");
        assert_eq!(g["fields"]["exit_target"]["basis"], "inside_range");
        assert_eq!(
            g["counts"],
            json!({"checked": 4, "traced": 4, "untraced": 0, "not_checkable": 0})
        );
        assert_eq!(g["card"], "all_traced");

        let one_off = json!({
            "decision": "trade",
            "strikes": [500.0], "expiration": "2026-09-18", "right": "call",
            "invalidation_level": 490.30,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 505.0, "stop": 623.0 },  // the one fabricated figure
        });
        let (_c, _f, _ci, g2) = extras_for(&one_off);
        assert_eq!(
            g2["counts"],
            json!({"checked": 4, "traced": 3, "untraced": 1, "not_checkable": 0})
        );
        assert_eq!(g2["card"], "some_traced");
    }

    /// AC-28 — every reference input missing: the rec still returns, in full.
    #[test]
    fn a_rec_with_every_reference_input_missing_still_returns_with_every_checked_figure_not_checkable(
    ) {
        let strategy = json!({
            "decision": "trade", "strikes": [], "expiration": null, "invalidation_level": 611.0,
            "max_risk": "$300", "position_size": "2 contracts",
            "exit_plan": { "target": 640.0, "stop": 623.0 },
        });
        let (_cap, _fr, _cited, g) = extras_for_bare(&strategy); // empty anchors, no move
        assert_eq!(
            g["fields"]["exit_stop"]["not_checkable_reason"],
            "no_named_level"
        );
        assert_eq!(
            g["fields"]["invalidation_level"]["not_checkable_reason"],
            "no_named_level"
        );
        assert_eq!(
            g["fields"]["exit_target"]["not_checkable_reason"],
            "no_cited_expiration"
        );
        assert_eq!(g["card"], "could_not_check");
    }

    /// AC-64 — `not_applicable` preempts `local_rules`: there are no figures to qualify.
    #[test]
    fn a_local_rules_rec_with_a_null_gamma_flip_renders_no_card_line_at_all() {
        let strategy = json!({
            "decision": "trade", "strikes": [], "expiration": null, "invalidation_level": null,
            "max_risk": "1R defined-risk", "position_size": "small (rule-based local rec; not LLM)",
            "exit_plan": { "target": null, "stop": null },
        });
        let g = extras_local_only(&strategy);
        assert_eq!(g["counts"]["checked"], 0);
        assert_eq!(g["card"], "not_applicable");
    }

    /// `boundary_extras` builds a trade strategy with only `field` set to `value` (the other two named
    /// fields null), the two-anchor set (gex_spot 500.00, put_wall 2.00), and the one-tenor pruned move.
    fn boundary_extras(field: &str, value: f64) -> Value {
        use crate::services::rec_inputs::grounding::AnchorKind;
        let mut strategy = json!({
            "decision": "trade", "strikes": [], "expiration": "2026-09-18", "right": null,
            "invalidation_level": null, "max_risk": null, "position_size": null,
            "exit_plan": { "target": null, "stop": null },
        });
        match field {
            "exit_stop" => strategy["exit_plan"]["stop"] = json!(value),
            "invalidation_level" => strategy["invalidation_level"] = json!(value),
            "exit_target" => strategy["exit_plan"]["target"] = json!(value),
            other => panic!("unknown boundary field {other}"),
        }
        let set = reference_set();
        let mv = reference_move();
        let mut anchors = GroundingAnchors::empty();
        anchors.set(AnchorKind::GexSpot, Some(500.00));
        anchors.set(AnchorKind::PutWall, Some(2.00));
        let (_c, _f, _ci, g) =
            envelope_extras(&strategy, &set, None, None, true, Some(&mv), anchors, false);
        g
    }

    /// guard 8 / AC-50 (SB) + AC-54. Poison arms, each of which must red (V3): widen the constant;
    /// delete the cent floor; swap `pruned_move` for `raw_move`; replace a rule body with constant
    /// Traced.
    #[test]
    fn the_resolution_boundaries_are_pinned_through_the_serialization_path() {
        // anchors: gex_spot 500.00 (window +/-0.50), put_wall 2.00 (window +/-0.01, the CENT FLOOR)
        // pruned move: 2026-09-18, anchor_spot 500.00, move_dollars 10.00 -> [490.00, 510.00]
        struct Arm {
            field: &'static str,
            value: f64,
            state: &'static str,
            basis: Option<&'static str>,
        }
        let arms = [
            Arm {
                field: "exit_stop",
                value: 500.00,
                state: "traced",
                basis: Some("exact"),
            },
            Arm {
                field: "exit_stop",
                value: 500.49,
                state: "traced",
                basis: Some("near"),
            },
            Arm {
                field: "exit_stop",
                value: 500.51,
                state: "untraced",
                basis: None,
            },
            Arm {
                field: "exit_stop",
                value: 2.008,
                state: "traced",
                basis: Some("near"),
            },
            Arm {
                field: "exit_stop",
                value: 2.015,
                state: "untraced",
                basis: None,
            },
            Arm {
                field: "invalidation_level",
                value: 500.00,
                state: "traced",
                basis: Some("exact"),
            },
            Arm {
                field: "invalidation_level",
                value: 500.49,
                state: "traced",
                basis: Some("near"),
            },
            Arm {
                field: "invalidation_level",
                value: 500.51,
                state: "untraced",
                basis: None,
            },
            Arm {
                field: "invalidation_level",
                value: 2.008,
                state: "traced",
                basis: Some("near"),
            },
            Arm {
                field: "invalidation_level",
                value: 2.015,
                state: "untraced",
                basis: None,
            },
            Arm {
                field: "exit_target",
                value: 490.00,
                state: "traced",
                basis: Some("inside_range"),
            },
            Arm {
                field: "exit_target",
                value: 510.00,
                state: "traced",
                basis: Some("inside_range"),
            },
            Arm {
                field: "exit_target",
                value: 489.99,
                state: "untraced",
                basis: None,
            },
            Arm {
                field: "exit_target",
                value: 510.01,
                state: "untraced",
                basis: None,
            },
        ];
        for a in &arms {
            let g = boundary_extras(a.field, a.value);
            assert_eq!(
                g["fields"][a.field]["state"], a.state,
                "{} @ {}",
                a.field, a.value
            );
            match a.basis {
                Some(b) => assert_eq!(
                    g["fields"][a.field]["basis"], b,
                    "{} @ {}",
                    a.field, a.value
                ),
                None => assert!(
                    g["fields"][a.field]["basis"].is_null(),
                    "{} @ {}",
                    a.field,
                    a.value
                ),
            }
        }
        // NON-VACUITY, asserted in the test itself: every checked field carries at least one traced arm
        // AND at least one untraced arm. A set drifted to a single outcome fails before it can certify.
        for field in ["exit_stop", "invalidation_level", "exit_target"] {
            assert!(
                arms.iter().any(|a| a.field == field && a.state == "traced"),
                "{field}: no traced arm"
            );
            assert!(
                arms.iter()
                    .any(|a| a.field == field && a.state == "untraced"),
                "{field}: no untraced arm"
            );
        }
    }

    /// AC-54 — pruned and unpruned moves differ: the target is NOT traced against a tenor whose
    /// contracts were never sent.
    #[test]
    fn a_target_is_never_traced_against_a_tenor_that_was_not_sent() {
        use crate::services::rec_inputs::grounding::AnchorKind;
        // raw: 2026-09-18 (10.00) AND 2026-12-18 (40.00). pruned: 2026-09-18 ONLY. The rec cites
        // 2026-12-18 with a target of 530.00 — inside the RAW [460.00, 540.00], unreachable pruned.
        let raw = StraddleMove {
            state: StraddleMoveState::Ok,
            as_of: None,
            session_basis: None,
            anchor_spot: Some(500.00),
            anchor_basis: quant_engine::AnchorBasis::GexSpot,
            anchor_label: "levels-anchor".into(),
            primary_expiration: Some("2026-09-18".into()),
            wide_quote_threshold_pct: 15.0,
            tenors: vec![
                quant_engine::StraddleTenor {
                    expiration: "2026-09-18".into(),
                    dte: 30,
                    strike_used: 500.0,
                    strike_distance_pct: 0.0,
                    straddle_price: 10.00,
                    move_dollars: 10.00,
                    move_pct: 2.0,
                    basis: quant_engine::MoveBasis::AtmStraddleMid,
                    quote_spread_pct_of_mid: None,
                    wide_quotes: false,
                },
                quant_engine::StraddleTenor {
                    expiration: "2026-12-18".into(),
                    dte: 120,
                    strike_used: 500.0,
                    strike_distance_pct: 0.0,
                    straddle_price: 40.00,
                    move_dollars: 40.00,
                    move_pct: 8.0,
                    basis: quant_engine::MoveBasis::AtmStraddleMid,
                    quote_spread_pct_of_mid: None,
                    wide_quotes: false,
                },
            ],
        };
        let pruned = restrict_move_to_tenors(&raw, &["2026-09-18".to_string()]);
        let strategy = json!({
            "decision": "trade", "strikes": [], "expiration": "2026-12-18", "right": null,
            "invalidation_level": null, "max_risk": null, "position_size": null,
            "exit_plan": { "target": 530.0, "stop": null },
        });
        let set = reference_set();
        let mut anchors = GroundingAnchors::empty();
        anchors.set(AnchorKind::GexSpot, Some(500.00));
        let (_c, _f, _ci, g) = envelope_extras(
            &strategy,
            &set,
            None,
            None,
            true,
            Some(&pruned),
            anchors,
            false,
        );
        assert_ne!(g["fields"]["exit_target"]["state"], "traced");
        assert_eq!(g["fields"]["exit_target"]["state"], "not_checkable");
        assert_eq!(
            g["fields"]["exit_target"]["not_checkable_reason"],
            "straddle_move_unavailable"
        );
    }

    #[test]
    fn status_shape() {
        let resolved = ResolvedLlmKey::none("no_key");
        let s = status_payload(
            Some(&json!({"ready": true, "reasons": []})),
            &resolved,
            true,
        );
        assert!(s["availability"]["in_app_enabled"].is_boolean());
        assert!(s["gate"]["state"].is_string());
        assert!(s["cap"]["remaining_today"].is_number());
        assert_eq!(s["scenarios"]["enabled"], false);
        assert_eq!(s["powering"]["key_source"], "none");
        assert_eq!(s["powering"]["unavailable_reason"], "no_key");
        assert!(s.get("remaining_free_uses").is_none());
        assert!(s.get("free_uses_total").is_none());
        assert_ne!(s["powering"]["key_source"], "shared_admin");
    }

    #[test]
    fn signed_out_status_has_null_powering_reason() {
        let resolved = ResolvedLlmKey::unsigned();
        let s = status_payload(None, &resolved, false);
        assert_eq!(s["powering"]["key_source"], "none");
        assert!(s["powering"]["unavailable_reason"].is_null());
        assert!(s["powering"]["preference"]["power_path"].is_null());
        assert_eq!(s["availability"]["in_app_enabled"], false);
        assert!(s.get("remaining_free_uses").is_none());
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
        let e = build_export(
            "SPY",
            &bundle,
            Some("income_keeper"),
            stub_candidates(),
            not_set_risk_inputs(),
        );
        assert_eq!(e["ticker"], "SPY");
        assert!(e["persona_prompt"]
            .as_str()
            .unwrap()
            .contains("Income Keeper"));
        assert!(e["context"]["signals"].is_object());
    }

    #[test]
    fn the_egress_note_is_composed_from_the_categories_and_no_longer_claims_no_account_or_identity()
    {
        let e = build_export(
            "SPY",
            &stub_bundle(),
            None,
            stub_candidates(),
            not_set_risk_inputs(),
        );
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
        let e = build_export(
            "SPY",
            &stub_bundle(),
            None,
            stub_candidates(),
            not_set_risk_inputs(),
        );
        let cats = e["egress_categories"].as_array().unwrap();
        let op = cats.iter().find(|c| c["key"] == "open_positions").unwrap();
        assert_eq!(op["sent"], false);
        // risk_inputs is present (not omitted) even though not_set means it was not sent.
        let ri = cats.iter().find(|c| c["key"] == "risk_inputs").unwrap();
        assert_eq!(ri["sent"], false);
    }

    fn resolve_svc() -> crate::services::auth::AuthService {
        crate::services::auth::AuthService::new(
            crate::services::auth::AuthStore::open_memory().unwrap(),
            crate::services::auth::AuthConfig {
                signing_key: "test-signing-key".into(),
                registration_open: true,
                cookie_secure: false,
                ..Default::default()
            },
        )
    }

    fn resolve_user(s: &crate::services::auth::AuthService) -> crate::services::auth::UserRecord {
        let (_, sid) = s.signup("res@b.co", "password1", None).unwrap();
        let cookie = s.signed_cookie_value(&sid);
        s.resolve_session(Some(&cookie)).user.unwrap()
    }

    #[test]
    fn resolve_null_path_is_no_key_and_does_not_evaluate_model() {
        let s = resolve_svc();
        let user = resolve_user(&s);
        let r = resolve_llm_key_for(&s, Some(&user));
        assert_eq!(r.key_source, "none");
        assert_eq!(r.unavailable_reason, Some("no_key"));
        assert_ne!(r.unavailable_reason, Some("model_missing"));
        assert_ne!(r.unavailable_reason, Some("model_unset"));
        assert_ne!(r.key_source, "shared_admin");
        assert!(r.key_material.is_none());
    }

    #[test]
    fn resolve_unsigned_is_none_with_null_reason() {
        let s = resolve_svc();
        let r = resolve_llm_key_for(&s, None);
        assert_eq!(r.key_source, "none");
        assert!(r.unavailable_reason.is_none());
        assert!(r.key_material.is_none());
    }

    #[test]
    fn resolve_own_key_decrypts_selected_slot() {
        let s = resolve_svc();
        let user = resolve_user(&s);
        s.set_ai_key(&user, "sk-ant-test-key-zzzz", "anthropic");
        let r = resolve_llm_key_for(&s, Some(&user));
        assert_eq!(r.key_source, "own_key");
        assert_eq!(r.wire_provider, Some("anthropic"));
        assert!(r.key_material.is_some());
        assert!(r.unavailable_reason.is_none());
        assert_ne!(r.key_source, "shared_admin");
    }

    #[test]
    fn resolve_grok_subscription_never_spends_byo() {
        let s = resolve_svc();
        let user = resolve_user(&s);
        s.set_ai_key(&user, "sk-ant-test-key-zzzz", "anthropic");
        s.write_settings(
            &user,
            crate::services::auth::SettingsPatch {
                ai_power_path: Some(Some("grok_subscription".into())),
                ai_provider: Some(None),
                ..Default::default()
            },
        )
        .unwrap();
        let r = resolve_llm_key_for(&s, Some(&user));
        assert_eq!(r.key_source, "none");
        assert_eq!(r.unavailable_reason, Some("oauth_unlinked"));
        assert!(r.key_material.is_none());
        assert!(r.wire_provider.is_none());
    }

    #[test]
    fn resolve_decrypt_fail_is_key_unusable() {
        let s = resolve_svc();
        let user = resolve_user(&s);
        s.test_store()
            .set_credential(&user.id, "ai", "not-valid-ciphertext", "abcd", "anthropic")
            .unwrap();
        s.write_settings(
            &user,
            crate::services::auth::SettingsPatch {
                ai_power_path: Some(Some("own_key".into())),
                ai_provider: Some(Some("anthropic".into())),
                ai_model: Some(Some(
                    crate::services::llm::LlmProvider::Anthropic
                        .default_model()
                        .into(),
                )),
                ..Default::default()
            },
        )
        .unwrap();
        let r = resolve_llm_key_for(&s, Some(&user));
        assert_eq!(r.unavailable_reason, Some("key_unusable"));
        assert_eq!(r.key_source, "none");
        assert!(r.key_material.is_none());
    }

    #[test]
    fn resolve_saved_model_not_in_catalog_blocks_without_substitute() {
        let s = resolve_svc();
        let user = resolve_user(&s);
        s.set_ai_key(&user, "sk-ant-test-key-zzzz", "anthropic");
        s.write_settings(
            &user,
            crate::services::auth::SettingsPatch {
                ai_model: Some(Some("not-a-catalog-model".into())),
                ..Default::default()
            },
        )
        .unwrap();
        let r = resolve_llm_key_for(&s, Some(&user));
        assert_eq!(r.unavailable_reason, Some("model_not_in_catalog"));
        assert!(r.key_material.is_none());
        assert_eq!(r.wire_model.as_deref(), Some("not-a-catalog-model"));
    }
}
