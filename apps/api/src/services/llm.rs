//! Multi-provider LLM clients for AI recommendations (BYO key).
//!
//! Providers: Anthropic Messages API, OpenAI-compatible Chat Completions (OpenAI, xAI/Grok,
//! and generic base URLs), Google Gemini generateContent.

use serde_json::{json, Value};
use tracing::warn;

/// Supported LLM providers for BYO keys.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    Anthropic,
    OpenAi,
    /// xAI Grok (OpenAI-compatible API at api.x.ai).
    Xai,
    Gemini,
    /// Generic OpenAI-compatible endpoint (requires base_url override).
    OpenAiCompatible,
}

impl LlmProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::OpenAi => "openai",
            Self::Xai => "xai",
            Self::Gemini => "gemini",
            Self::OpenAiCompatible => "openai_compatible",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "anthropic" | "claude" => Some(Self::Anthropic),
            "openai" | "chatgpt" | "gpt" => Some(Self::OpenAi),
            "xai" | "grok" => Some(Self::Xai),
            "gemini" | "google" => Some(Self::Gemini),
            "openai_compatible" | "compatible" | "openrouter" => Some(Self::OpenAiCompatible),
            _ => None,
        }
    }

    /// Infer provider from common key prefixes when the client doesn't send one.
    pub fn detect_from_key(raw: &str) -> Self {
        let k = raw.trim();
        if k.starts_with("sk-ant-") {
            return Self::Anthropic;
        }
        if k.starts_with("AIza") {
            return Self::Gemini;
        }
        if k.starts_with("xai-") {
            return Self::Xai;
        }
        // OpenRouter / many OpenAI-compatible keys still start with sk-
        if k.starts_with("sk-or-") {
            return Self::OpenAiCompatible;
        }
        if k.starts_with("sk-") {
            return Self::OpenAi;
        }
        // Default: treat as OpenAI-compatible (broadest)
        Self::OpenAi
    }

    pub fn default_model(self) -> &'static str {
        match self {
            // Match Python `AI_REC_MODEL` default (apps/api ai_recommendation.py).
            Self::Anthropic => "claude-opus-4-8",
            Self::OpenAi => "gpt-4o",
            Self::Xai => "grok-3",
            Self::Gemini => "gemini-2.0-flash",
            Self::OpenAiCompatible => "gpt-4o",
        }
    }

    pub fn default_base_url(self) -> Option<&'static str> {
        match self {
            Self::Anthropic => Some("https://api.anthropic.com"),
            Self::OpenAi => Some("https://api.openai.com/v1"),
            Self::Xai => Some("https://api.x.ai/v1"),
            Self::Gemini => Some("https://generativelanguage.googleapis.com/v1beta"),
            Self::OpenAiCompatible => None,
        }
    }
}

/// Resolved material for one rec call — NEVER log key_material.
#[derive(Debug, Clone)]
pub struct ResolvedLlmKey {
    pub key_source: &'static str, // own_key | shared_admin | none
    pub provider: LlmProvider,
    pub key_material: Option<String>,
    pub model: String,
    pub base_url: Option<String>,
    pub unavailable_reason: Option<&'static str>,
    pub metering_identity: Option<String>,
}

impl ResolvedLlmKey {
    pub fn none(reason: &'static str) -> Self {
        Self {
            key_source: "none",
            provider: LlmProvider::Anthropic,
            key_material: None,
            model: LlmProvider::Anthropic.default_model().into(),
            base_url: None,
            unavailable_reason: Some(reason),
            metering_identity: None,
        }
    }

    pub fn usable(&self) -> bool {
        self.key_material.is_some() && self.key_source != "none"
    }
}

/// The rec-input blocks the assembler inserted (`services/recommendation.rs` builds this).
/// `market_state` here is ALREADY a pruned clone — `straddle_move.tenors` restricted to the
/// tenors actually present in `candidates` (via `quant_engine::restrict_move_to_tenors`), so the
/// model is never shown a tenor whose contracts it was not sent.
pub struct RecPromptContext<'a> {
    pub market_state: Value,
    pub signals: Option<&'a Value>,
    pub ai_eval: Option<&'a Value>,
    /// The §1 candidate envelope, `budget: "prompt"`, `sent_to_model: true`.
    pub candidates: Value,
    /// The as-sent risk block (§4 shape) or `{state:"not_set", ...}`.
    pub risk_inputs: Value,
    /// The client digest, labelled `simulated`.
    pub open_positions: Value,
}

/// System + user prompt for a market-state recommendation.
pub fn build_rec_prompts(ticker: &str, ctx: &RecPromptContext<'_>, persona_name: &str) -> (String, String) {
    let system = format!(
        "You are a risk-first options strategist for Convexa. Persona: {persona_name}. \
         Respond ONLY with a single JSON object (no markdown) matching this schema:\n\
         {{\"decision\":\"trade\"|\"no_trade\",\"bias\":\"long\"|\"short\"|\"neutral\"|\"volatility\",\
         \"structure\":string|null,\"strikes\":number[],\"expiration\":string|null,\
         \"right\":\"call\"|\"put\"|null,\
         \"entry_trigger\":string|null,\"invalidation_level\":number|null,\
         \"max_risk\":string|null,\"position_size\":string|null,\
         \"exit_plan\":{{\"target\":number|null,\"stop\":number|null}},\
         \"time_horizon\":string|null,\"confidence\":\"low\"|\"medium\"|\"high\"|null,\
         \"summary\":string|null,\"key_points\":string[],\"reengage_when\":string[],\
         \"rationale\":string}}\n\
         Cite concrete levels from the context (walls, gamma flip, magnets, IV/HV). \
         Prefer defined-risk. Saying no_trade is valid and preferred when edge is unclear. \
         When you name a single contract, state `right` as call or put. If the structure has more \
         than one leg, leave `right` null — do not guess. \
         Size within the owner's stated risk block when one is present; if it is absent, say so \
         rather than inventing a figure. The candidate contracts listed are the only ones Convexa \
         sent you."
    );
    let context = json!({
        "ticker": ticker,
        "market_state": ctx.market_state,
        "signals": ctx.signals,
        "ai_eval": ctx.ai_eval,
        "candidate_contracts": ctx.candidates,
        "risk_inputs": ctx.risk_inputs,
        "open_positions": ctx.open_positions,
        "open_positions_note": "SIMULATED positions from the owner's browser only. Broker positions are not counted.",
        "strike_profile_note": "strike_profile omitted from prompt if large; use walls/flip from market_state",
    });
    let user = format!(
        "Ticker {ticker}. Produce a strategy recommendation from this Convexa context:\n{}",
        serde_json::to_string_pretty(&context).unwrap_or_else(|_| "{}".into())
    );
    (system, user)
}

/// Call the configured provider; return strategy JSON value or error reason code.
pub async fn complete_strategy(
    resolved: &ResolvedLlmKey,
    system: &str,
    user: &str,
) -> Result<Value, &'static str> {
    let key = resolved
        .key_material
        .as_deref()
        .ok_or("no_key")?;
    let model = &resolved.model;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|_| "llm_error")?;

    let text = match resolved.provider {
        LlmProvider::Anthropic => {
            anthropic_messages(&client, key, model, system, user).await?
        }
        LlmProvider::OpenAi | LlmProvider::Xai | LlmProvider::OpenAiCompatible => {
            let base = resolved
                .base_url
                .clone()
                .or_else(|| {
                    resolved
                        .provider
                        .default_base_url()
                        .map(|s| s.to_string())
                })
                .unwrap_or_else(|| "https://api.openai.com/v1".into());
            openai_chat(&client, &base, key, model, system, user).await?
        }
        LlmProvider::Gemini => {
            let base = resolved
                .base_url
                .clone()
                .or_else(|| resolved.provider.default_base_url().map(|s| s.to_string()))
                .unwrap_or_else(|| {
                    "https://generativelanguage.googleapis.com/v1beta".into()
                });
            gemini_generate(&client, &base, key, model, system, user).await?
        }
    };

    parse_strategy_json(&text)
}

async fn anthropic_messages(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, &'static str> {
    let url = "https://api.anthropic.com/v1/messages";
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "system": system,
        "messages": [{ "role": "user", "content": user }],
    });
    let resp = client
        .post(url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            warn!(error = %e, "anthropic request failed");
            "timeout"
        })?;
    let status = resp.status();
    let text_body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        // Log status + short body snippet only (never the API key).
        let snippet: String = text_body.chars().take(240).collect();
        warn!(%status, model, body = %snippet, "anthropic HTTP error");
        return Err("llm_error");
    }
    let v: Value = serde_json::from_str(&text_body).map_err(|_| "llm_error")?;
    // content[0].text
    v.pointer("/content/0/text")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            warn!("anthropic response missing content[0].text");
            "llm_error"
        })
}

async fn openai_chat(
    client: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, &'static str> {
    let url = format!(
        "{}/chat/completions",
        base.trim_end_matches('/')
    );
    let body = json!({
        "model": model,
        "temperature": 0.2,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
    });
    let resp = client
        .post(&url)
        .bearer_auth(key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            warn!(error = %e, "openai-compatible request failed");
            "timeout"
        })?;
    let status = resp.status();
    let text_body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        let snippet: String = text_body.chars().take(240).collect();
        warn!(%status, model, body = %snippet, "openai-compatible HTTP error");
        return Err("llm_error");
    }
    let v: Value = serde_json::from_str(&text_body).map_err(|_| "llm_error")?;
    v.pointer("/choices/0/message/content")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            warn!("openai-compatible response missing choices[0].message.content");
            "llm_error"
        })
}

async fn gemini_generate(
    client: &reqwest::Client,
    base: &str,
    key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, &'static str> {
    let url = format!(
        "{}/models/{}:generateContent?key={}",
        base.trim_end_matches('/'),
        model,
        urlencoding_simple(key)
    );
    let body = json!({
        "system_instruction": { "parts": [{ "text": system }] },
        "contents": [{ "role": "user", "parts": [{ "text": user }] }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    });
    let resp = client
        .post(&url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|_| "timeout")?;
    if !resp.status().is_success() {
        warn!(status = %resp.status(), "gemini HTTP error");
        return Err("llm_error");
    }
    let v: Value = resp.json().await.map_err(|_| "llm_error")?;
    v.pointer("/candidates/0/content/parts/0/text")
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or("llm_error")
}

fn urlencoding_simple(s: &str) -> String {
    // Keys are URL-safe enough for query; still escape reserved.
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

fn parse_strategy_json(text: &str) -> Result<Value, &'static str> {
    let trimmed = text.trim();
    // Strip optional ```json fences
    let body = if let Some(rest) = trimmed.strip_prefix("```") {
        let rest = rest
            .strip_prefix("json")
            .unwrap_or(rest)
            .trim_start();
        rest.strip_suffix("```").unwrap_or(rest).trim()
    } else {
        trimmed
    };
    let v: Value = serde_json::from_str(body).map_err(|_| "llm_error")?;
    // Minimal coerce
    let decision = v
        .get("decision")
        .and_then(|d| d.as_str())
        .unwrap_or("no_trade");
    let decision = if decision == "trade" {
        "trade"
    } else {
        "no_trade"
    };
    let bias = v
        .get("bias")
        .and_then(|b| b.as_str())
        .unwrap_or("neutral");
    let bias = match bias {
        "long" | "short" | "neutral" | "volatility" => bias,
        _ => "neutral",
    };
    // Deliberately UNLIKE `bias` (which defaults to "neutral"): an unrecognised or absent `right`
    // stays ABSENT. A defaulted right is exactly the confidently-wrong match this exists to
    // prevent (INTERFACE_CONTRACT §5, `strategy.right`).
    let right = match v.get("right").and_then(|r| r.as_str()) {
        Some("call") => Value::String("call".into()),
        Some("put") => Value::String("put".into()),
        _ => Value::Null,
    };
    Ok(json!({
        "decision": decision,
        "bias": bias,
        "structure": v.get("structure").cloned().unwrap_or(Value::Null),
        "strikes": v.get("strikes").cloned().unwrap_or(json!([])),
        "expiration": v.get("expiration").cloned().unwrap_or(Value::Null),
        "right": right,
        "entry_trigger": v.get("entry_trigger").cloned().unwrap_or(Value::Null),
        "invalidation_level": v.get("invalidation_level").cloned().unwrap_or(Value::Null),
        "max_risk": v.get("max_risk").cloned().unwrap_or(Value::Null),
        "position_size": v.get("position_size").cloned().unwrap_or(Value::Null),
        "exit_plan": v.get("exit_plan").cloned().unwrap_or(json!({"target":null,"stop":null})),
        "time_horizon": v.get("time_horizon").cloned().unwrap_or(Value::Null),
        "confidence": v.get("confidence").cloned().unwrap_or(Value::Null),
        "summary": v.get("summary").cloned().unwrap_or(Value::Null),
        "key_points": v.get("key_points").cloned().unwrap_or(json!([])),
        "reengage_when": v.get("reengage_when").cloned().unwrap_or(json!([])),
        "rationale": v.get("rationale").and_then(|r| r.as_str()).unwrap_or("").to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_prefixes() {
        assert_eq!(
            LlmProvider::detect_from_key("sk-ant-api03-xxxx"),
            LlmProvider::Anthropic
        );
        assert_eq!(
            LlmProvider::detect_from_key("sk-proj-xxxx"),
            LlmProvider::OpenAi
        );
        assert_eq!(LlmProvider::detect_from_key("AIzaSyxxx"), LlmProvider::Gemini);
        assert_eq!(LlmProvider::detect_from_key("xai-xxx"), LlmProvider::Xai);
    }

    #[test]
    fn parse_strategy_strips_fences() {
        let raw = "```json\n{\"decision\":\"no_trade\",\"bias\":\"neutral\",\"rationale\":\"wait\"}\n```";
        let v = parse_strategy_json(raw).unwrap();
        assert_eq!(v["decision"], "no_trade");
    }

    #[test]
    fn a_call_right_is_projected() {
        let raw = r#"{"decision":"trade","right":"call","rationale":"x"}"#;
        assert_eq!(parse_strategy_json(raw).unwrap()["right"], "call");
    }

    #[test]
    fn a_put_right_is_projected() {
        let raw = r#"{"decision":"trade","right":"put","rationale":"x"}"#;
        assert_eq!(parse_strategy_json(raw).unwrap()["right"], "put");
    }

    #[test]
    fn an_unrecognised_right_stays_absent_and_never_defaults() {
        let raw = r#"{"decision":"trade","right":"straddle","rationale":"x"}"#;
        assert!(parse_strategy_json(raw).unwrap()["right"].is_null());
    }

    #[test]
    fn an_absent_right_stays_absent_contrast_with_bias_default() {
        let raw = r#"{"decision":"trade","rationale":"x"}"#;
        let v = parse_strategy_json(raw).unwrap();
        assert!(v["right"].is_null());
        // Contrast: `bias` DOES default (to "neutral") — `right` deliberately does not.
        assert_eq!(v["bias"], "neutral");
    }

    // --- B15: prompt assembly ---

    fn quoted(strike: f64, side: quant_engine::ContractType, exp: &str) -> quant_engine::Contract {
        quant_engine::Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: 100.0,
            expiration_date: exp.into(),
            implied_volatility: 0.3,
            greeks: Some(quant_engine::Greeks { gamma: Some(0.01), delta: Some(0.5), theta: None, vega: None }),
            volume: Some(10.0),
            bid: Some(1.0),
            ask: Some(1.2),
        }
    }

    fn as_of() -> chrono::DateTime<chrono::Utc> {
        use chrono::TimeZone;
        chrono::Utc.with_ymd_and_hms(2026, 8, 12, 20, 0, 0).unwrap()
    }

    fn user_context_json(user: &str) -> Value {
        let (_, json_part) = user.split_once(":\n").expect("prompt carries a JSON body");
        serde_json::from_str(json_part).expect("prompt body is valid JSON")
    }

    #[test]
    fn the_prompt_block_never_exceeds_twenty_records() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16"] {
            for i in 0..30 {
                chain.push(quoted(100.0 + i as f64 * 0.1, quant_engine::ContractType::Call, exp));
                chain.push(quoted(100.0 + i as f64 * 0.1, quant_engine::ContractType::Put, exp));
            }
        }
        let set = quant_engine::CandidateSet::build(
            &chain, 100.0, as_of(), quant_engine::DteWindow::default(),
            quant_engine::CandidateBudget::Prompt, true, &quant_engine::SnapshotMeta::default(),
        );
        let candidates = crate::services::rec_inputs::candidate_envelope("SPY", &set, Some(1.0));
        let ctx = RecPromptContext {
            market_state: json!({}),
            signals: None,
            ai_eval: None,
            candidates,
            risk_inputs: json!({"state": "not_set"}),
            open_positions: json!({"source": "simulated", "state": "none_open"}),
        };
        let (_, user) = build_rec_prompts("SPY", &ctx, "Default");
        let v = user_context_json(&user);
        let n = v["candidate_contracts"]["contracts"].as_array().unwrap().len();
        assert!(n <= 20, "prompt block carried {n} records, budget caps at 20");
    }

    #[test]
    fn the_forwarded_move_is_restricted_to_the_candidate_tenors() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16"] {
            chain.push(quoted(100.0, quant_engine::ContractType::Call, exp));
            chain.push(quoted(100.0, quant_engine::ContractType::Put, exp));
        }
        let mv = quant_engine::compute_straddle_move(&chain, 100.0, as_of(), quant_engine::DteWindow::default(), &quant_engine::SnapshotMeta::default());
        assert_eq!(mv.tenors.len(), 3);
        // Prompt budget caps tenors at 2 — narrower than the move's 3.
        let set = quant_engine::CandidateSet::build(
            &chain, 100.0, as_of(), quant_engine::DteWindow::default(),
            quant_engine::CandidateBudget::Prompt, true, &quant_engine::SnapshotMeta::default(),
        );
        let pruned = quant_engine::restrict_move_to_tenors(&mv, set.included_expirations());
        assert!(pruned.tenors.len() <= 2);
        assert!(quant_engine::assert_tenor_subset(&pruned, set.included_expirations()).is_ok());

        let ctx = RecPromptContext {
            market_state: json!({ "straddle_move": pruned }),
            signals: None,
            ai_eval: None,
            candidates: crate::services::rec_inputs::candidate_envelope("SPY", &set, None),
            risk_inputs: json!({"state": "not_set"}),
            open_positions: json!({"source": "simulated", "state": "none_open"}),
        };
        let (_, user) = build_rec_prompts("SPY", &ctx, "Default");
        let v = user_context_json(&user);
        let forwarded_tenors = v["market_state"]["straddle_move"]["tenors"].as_array().unwrap();
        assert!(forwarded_tenors.len() <= 2);
        let candidate_exps: Vec<String> = v["candidate_contracts"]["included"]["expirations"]
            .as_array().unwrap().iter().map(|x| x.as_str().unwrap().to_string()).collect();
        for t in forwarded_tenors {
            let exp = t["expiration"].as_str().unwrap();
            assert!(candidate_exps.iter().any(|e| e == exp), "{exp} forwarded but not in candidate set");
        }
    }

    #[test]
    fn widening_the_restriction_makes_the_subset_assertion_fail() {
        // A single-expiration candidate chain — the candidate set's included tenor set is narrow.
        let narrow_chain = vec![
            quoted(100.0, quant_engine::ContractType::Call, "2026-08-21"),
            quoted(100.0, quant_engine::ContractType::Put, "2026-08-21"),
        ];
        let narrow_set = quant_engine::CandidateSet::build(
            &narrow_chain, 100.0, as_of(), quant_engine::DteWindow::default(),
            quant_engine::CandidateBudget::Prompt, true, &quant_engine::SnapshotMeta::default(),
        );

        // A three-tenor move computed off a WIDER chain (as if the restriction were wrongly
        // widened to the move's own tenors instead of the actual candidate set).
        let mut wide_chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16"] {
            wide_chain.push(quoted(100.0, quant_engine::ContractType::Call, exp));
            wide_chain.push(quoted(100.0, quant_engine::ContractType::Put, exp));
        }
        let mv = quant_engine::compute_straddle_move(&wide_chain, 100.0, as_of(), quant_engine::DteWindow::default(), &quant_engine::SnapshotMeta::default());
        assert_eq!(mv.tenors.len(), 3);

        // Poison: assert against the NARROW set's included tenors (the correct bound). The
        // unrestricted 3-tenor move must fail the subset check.
        assert!(quant_engine::assert_tenor_subset(&mv, narrow_set.included_expirations()).is_err());
    }

    #[test]
    fn the_positions_digest_rides_the_prompt_labelled_simulated() {
        let ctx = RecPromptContext {
            market_state: json!({}),
            signals: None,
            ai_eval: None,
            candidates: json!({"state": "ok"}),
            risk_inputs: json!({"state": "not_set"}),
            open_positions: json!({"source": "simulated", "state": "none_open", "this_underlying": null, "portfolio": null}),
        };
        let (_, user) = build_rec_prompts("SPY", &ctx, "Default");
        let v = user_context_json(&user);
        assert_eq!(v["open_positions"]["source"], "simulated");
        assert_eq!(v["open_positions"]["state"], "none_open");
    }
}
