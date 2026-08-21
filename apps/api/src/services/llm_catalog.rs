//! Closed Ask-AI model catalogs (BYO + Grok subscription).
//!
//! Env `AI_REC_MODEL_{PROVIDER}` / `AI_REC_MODEL` become the **recommended** catalog
//! entry (visible, selectable) — never a hidden call-time substitute.

use crate::services::llm::LlmProvider;

pub const BYO_PROVIDERS: [&str; 4] = ["anthropic", "openai", "xai", "gemini"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogModel {
    pub id: String,
    pub recommended: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderCatalog {
    pub provider: &'static str,
    pub models: Vec<CatalogModel>,
}

pub fn is_trader_byo(provider: &str) -> bool {
    BYO_PROVIDERS.contains(&provider)
}

/// Closed trader BYO token only — aliases (`claude`, `grok`) are rejected.
pub fn parse_byo_provider(s: &str) -> Option<&'static str> {
    let t = s.trim();
    BYO_PROVIDERS.iter().copied().find(|p| *p == t)
}

fn env_recommended(provider: LlmProvider) -> Option<String> {
    let specific = std::env::var(format!(
        "AI_REC_MODEL_{}",
        provider.as_str().to_ascii_uppercase()
    ))
    .ok()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty());
    if specific.is_some() {
        return specific;
    }
    if provider == LlmProvider::Anthropic {
        return std::env::var("AI_REC_MODEL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
    }
    None
}

fn models_for(provider: LlmProvider) -> Vec<CatalogModel> {
    let default = provider.default_model();
    match env_recommended(provider) {
        Some(id) if id != default => vec![
            CatalogModel {
                id,
                recommended: true,
            },
            CatalogModel {
                id: default.into(),
                recommended: false,
            },
        ],
        Some(id) => vec![CatalogModel {
            id,
            recommended: true,
        }],
        None => vec![CatalogModel {
            id: default.into(),
            recommended: true,
        }],
    }
}

fn catalog_for(provider: LlmProvider) -> ProviderCatalog {
    ProviderCatalog {
        provider: provider.as_str(),
        models: models_for(provider),
    }
}

pub fn byo_catalogs() -> Vec<ProviderCatalog> {
    vec![
        catalog_for(LlmProvider::Anthropic),
        catalog_for(LlmProvider::OpenAi),
        catalog_for(LlmProvider::Xai),
        catalog_for(LlmProvider::Gemini),
    ]
}

pub fn grok_subscription_catalog() -> ProviderCatalog {
    catalog_for(LlmProvider::Xai)
}

pub fn recommended_id(catalog: &ProviderCatalog) -> Option<&str> {
    catalog
        .models
        .iter()
        .find(|m| m.recommended)
        .map(|m| m.id.as_str())
}

pub fn catalog_contains(catalog: &ProviderCatalog, model: &str) -> bool {
    catalog.models.iter().any(|m| m.id == model)
}

pub fn byo_catalog(provider: &str) -> Option<ProviderCatalog> {
    byo_catalogs().into_iter().find(|c| c.provider == provider)
}

pub fn preview_catalog_for_null_path(grok_available: bool) -> ProviderCatalog {
    if grok_available {
        return grok_subscription_catalog();
    }
    for p in byo_catalogs() {
        if recommended_id(&p).is_some() {
            return p;
        }
    }
    byo_catalogs()
        .into_iter()
        .next()
        .expect("BYO catalog set is non-empty")
}

pub fn catalog_for_path(power_path: Option<&str>, provider: Option<&str>) -> ProviderCatalog {
    match power_path {
        Some("grok_subscription") => grok_subscription_catalog(),
        Some("own_key") => provider
            .and_then(byo_catalog)
            .unwrap_or_else(|| catalog_for(LlmProvider::Anthropic)),
        _ => preview_catalog_for_null_path(false),
    }
}

/// When power_path and/or provider changes to a new active catalog:
/// keep current if it is in the new catalog, else write the recommended default
/// (or unset when the catalog has none).
pub fn apply_model_switch(current: Option<&str>, new_catalog: &ProviderCatalog) -> Option<String> {
    if let Some(m) = current {
        if catalog_contains(new_catalog, m) {
            return Some(m.to_string());
        }
    }
    recommended_id(new_catalog).map(|s| s.to_string())
}

pub fn catalogs_to_json() -> serde_json::Value {
    let providers: Vec<serde_json::Value> = byo_catalogs()
        .into_iter()
        .map(provider_catalog_json)
        .collect();
    let grok = provider_catalog_json(grok_subscription_catalog());
    serde_json::json!({
        "providers": providers,
        "grok_subscription": grok,
    })
}

pub fn provider_catalog_json(c: ProviderCatalog) -> serde_json::Value {
    let models: Vec<serde_json::Value> = c
        .models
        .iter()
        .map(|m| {
            serde_json::json!({
                "id": m.id,
                "recommended": m.recommended,
            })
        })
        .collect();
    serde_json::json!({
        "provider": c.provider,
        "models": models,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommended_defaults_match_llm_provider_defaults() {
        let cats = byo_catalogs();
        let rec = |p: &str| {
            recommended_id(cats.iter().find(|c| c.provider == p).unwrap())
                .unwrap()
                .to_string()
        };
        assert_eq!(rec("anthropic"), LlmProvider::Anthropic.default_model());
        assert_eq!(rec("openai"), LlmProvider::OpenAi.default_model());
        assert_eq!(rec("xai"), LlmProvider::Xai.default_model());
        assert_eq!(rec("gemini"), LlmProvider::Gemini.default_model());
        assert_eq!(
            recommended_id(&grok_subscription_catalog()).unwrap(),
            LlmProvider::Xai.default_model()
        );
    }

    #[test]
    fn model_switch_keeps_id_when_in_new_catalog() {
        let openai = byo_catalog("openai").unwrap();
        let keep = apply_model_switch(Some("gpt-4o"), &openai);
        assert_eq!(keep.as_deref(), Some("gpt-4o"));
    }

    #[test]
    fn model_switch_writes_recommended_when_not_in_catalog() {
        let anthropic = byo_catalog("anthropic").unwrap();
        let next = apply_model_switch(Some("gpt-4o"), &anthropic);
        assert_eq!(
            next.as_deref(),
            Some(LlmProvider::Anthropic.default_model())
        );
    }

    #[test]
    fn model_switch_unsets_when_catalog_empty() {
        let empty = ProviderCatalog {
            provider: "anthropic",
            models: vec![],
        };
        assert!(apply_model_switch(Some("claude-opus-4-8"), &empty).is_none());
        assert!(apply_model_switch(None, &empty).is_none());
    }

    #[test]
    fn preview_catalog_prefers_subscription_when_available() {
        let c = preview_catalog_for_null_path(true);
        assert_eq!(c.provider, "xai");
    }

    #[test]
    fn preview_catalog_is_first_byo_when_subscription_unavailable() {
        let c = preview_catalog_for_null_path(false);
        assert_eq!(c.provider, "anthropic");
        assert!(recommended_id(&c).is_some());
    }

    #[test]
    fn parse_byo_rejects_aliases_and_openai_compatible() {
        assert_eq!(parse_byo_provider("anthropic"), Some("anthropic"));
        assert!(parse_byo_provider("claude").is_none());
        assert!(parse_byo_provider("grok").is_none());
        assert!(parse_byo_provider("openai_compatible").is_none());
    }
}
