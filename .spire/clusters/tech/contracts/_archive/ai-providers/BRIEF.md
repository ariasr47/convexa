# ai-providers — brief
Goal:            Redesign how a signed-in trader powers in-app AI recommendations. They can
                 (1) store their own API key for Anthropic, OpenAI, Gemini, or Grok/xAI, or
                 (2) **preferentially** sign in with Grok (OAuth) and run on **their own Grok
                 subscription / sub-pool** (not a Convexa-billed pool). In every powered path
                 they must **always be able to choose a specific model** — never a hidden
                 default they cannot see or override. Today's Settings "AI key" panel is
                 Anthropic-only (`sk-ant-…` copy, single key, no provider, no model). The
                 server already accepts `provider` on `PUT /api/auth/ai-key` and can call
                 Anthropic / OpenAI / xAI / Gemini / OpenAI-compatible, but model is
                 env-default only (`AI_REC_MODEL_*`) and there is no Grok OAuth or
                 subscription path.

Decision impact: Which model's read the trader acts on. Today they cannot choose, so two
                 traders (or the same trader on two days) cannot tell *which* model produced
                 the plan they may size. **Observed by:** Settings (and the Ask-AI surface)
                 show a named provider + a named model before a rec is requested; a BYO key
                 for each listed vendor can be added, replaced, removed without the raw key
                 returning; Grok OAuth onto **their subscription** is the preferred path when
                 available; a rec's provenance names the provider, model, and subscription vs
                 personal API key; score / tier / fingerprint stay byte-identical.

Feasibility:     pass for BYO multi-provider + user-chosen model (wire and `LlmProvider` already
                 exist; this is mostly Settings/Ask-AI UX + persisting a chosen model).
                 **Grok OAuth onto the user's own subscription is architect-owned and
                 uncertain** — do not invent endpoints. Name a buildable user-OAuth mechanism
                 (user's SuperGrok / Grok subscription sub-pool) or mark that arm blocked-on
                 (present-but-unavailable). This is **not** a Convexa server pool key.
                 Encrypt-at-rest, write-only, never-echo floors stay. A BYO `xai` API key
                 remains a separate path from subscription OAuth.

Effort:          L  (UX redesign + model persistence + OAuth/pool arm; BYO multi-provider is
                 the smaller half)

Invariant watch: `secret-encrypted-at-rest` (**HARD** — recoverable secrets encrypted, never
                 logged / returned / sent to the browser; write-only + rotate/delete; ciphertext
                 only) · `server-side-gate-enforcement` (Ask-AI and key/OAuth writes stay
                 server-gated; FE is UX) · `additive-keeps-score-byte-identical` (provider and
                 model are never scoring inputs) · `best-effort-isolated-or-null` (key / OAuth /
                 pool / LLM failure degrades the rec surface alone) · `no-real-order-path` ·
                 `theme-token-discipline` · `single-motion-moment` · `digested-labels-not-raw-dump`
                 (provider/model are closed labels, not inferred from the key string in the UI)
                 · `absent-is-not-none` (no key vs pool unavailable vs OAuth expired vs BYO set
                 must not collapse) · `cited-code-is-verified-not-assumed` (**now canon** — cite
                 live `AiKeySection.tsx`, `llm.rs`, `auth.rs` `AiKeyBody`, `recommendation.rs`
                 `resolve_llm_key`, not Python `ai_recommendation.py`) · `ai-asserted-numbers-are-traceable`
                 (provenance may name provider/model; it must not invent a check the rec did not
                 run)

Context tags:    frontend,ui,backend,architecture,ai,decisions

Source:          Owner 2026-08-17 after `rec-plan-scope-caption` ship — asked to add
                 Anthropic/OpenAI/Gemini/Grok keys **or** Grok OAuth onto the **user's**
                 Grok subscription / sub-pool (preferred), and to **redesign the UX**; model
                 choice is mandatory on every path. Clarified 2026-08-17 (D7): not Convexa's
                 pool. Extends shipped `byo-ai-key`; owner later removed all admin/free uses
                 (D5).

Considered:      ai-providers (CHOSEN — owner-named; the only item whose failure is a trader
                 acting on an unnamed model or paying full BYO when a cheaper Grok pool was
                 the intended default) ·
                 project-context-s2-is-python-era (culled: system-of-building **N/A** — still
                 unpaid; 23 Python-era markers. Do not bundle. Fix before the next backend
                 feature that *trusts* §2 as ground truth; this BRIEF already cites live Rust
                 paths) ·
                 degradation-visibility (culled: decision-impact **N/A**, fourth consecutive
                 gate — needs owner override, not a fifth re-derivation) ·
                 sse-connection-ceiling / S5c (culled: availability **N/A**; still open on the
                 live Rust container; not this UX) ·
                 volume-profile POC/CVD (culled: real decision-impact but not pulled) ·
                 hygiene batch (culled: tooling **N/A**)
