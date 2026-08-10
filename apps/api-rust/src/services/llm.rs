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

/// System + user prompt for a market-state recommendation.
pub fn build_rec_prompts(ticker: &str, bundle: &Value, persona_name: &str) -> (String, String) {
    let system = format!(
        "You are a risk-first options strategist for Convexa. Persona: {persona_name}. \
         Respond ONLY with a single JSON object (no markdown) matching this schema:\n\
         {{\"decision\":\"trade\"|\"no_trade\",\"bias\":\"long\"|\"short\"|\"neutral\"|\"volatility\",\
         \"structure\":string|null,\"strikes\":number[],\"expiration\":string|null,\
         \"entry_trigger\":string|null,\"invalidation_level\":number|null,\
         \"max_risk\":string|null,\"position_size\":string|null,\
         \"exit_plan\":{{\"target\":number|null,\"stop\":number|null}},\
         \"time_horizon\":string|null,\"confidence\":\"low\"|\"medium\"|\"high\"|null,\
         \"summary\":string|null,\"key_points\":string[],\"reengage_when\":string[],\
         \"rationale\":string}}\n\
         Cite concrete levels from the context (walls, gamma flip, magnets, IV/HV). \
         Prefer defined-risk. Saying no_trade is valid and preferred when edge is unclear."
    );
    let context = json!({
        "ticker": ticker,
        "market_state": bundle.get("market_state"),
        "signals": bundle.get("signals"),
        "ai_eval": bundle.get("ai_eval"),
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
    Ok(json!({
        "decision": decision,
        "bias": bias,
        "structure": v.get("structure").cloned().unwrap_or(Value::Null),
        "strikes": v.get("strikes").cloned().unwrap_or(json!([])),
        "expiration": v.get("expiration").cloned().unwrap_or(Value::Null),
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
}
