# ai-providers — R3 decisions

Source: `council/conflicts.json` (10 conflicts, 10/10 quotes verified, 1 self-revision).
Conductor folds retractions and settled technical items here. Product calls go to the owner one at a time.

## Folded — self-revisions (no exchange)

### D1 — No silent catalog-default fallback on resolve
- **Conflict id:** `731d5fa440…` (architect self-revision, tagged product)
- **Quote (architect R1):** "On resolve: if preference ∈ catalog for the active provider → use it; else fall back to catalog default **and surface that effective model** on status/rec provenance so it is never invisible."
- **Ruling:** Architect withdraws auto-fallback. If preference is unset or not in the catalog → no LLM call; closed `model_missing` / `model_unset`. A catalog recommended default may appear only as a visible selectable option and is used only after it is the selected preference.
- **Settled by:** architect self-revision; matches PM AC-17 and UX no-silent-substitute. No human call on *silent fallback* (that is dead). The remaining first-visit preselect-vs-block question is queued separately.

## Settled — technical (code fact, no exchange needed)

### D2 — Existing store is one BYO ciphertext, not per-provider slots
- **Conflict id:** `001a613732…` (architect vs pm, technical)
- **Quote (pm R1):** "The server can persist **per-user, per-provider** BYO secrets under the existing encrypt-at-rest / never-echo floors…"
- **Ruling:** Encrypt-at-rest / never-echo hold. Concurrent per-provider secrets do **not**. Live PK is `(user_id, kind="ai")` — one row. Multi-slot requires an explicit schema/PK change if the owner chooses that scope. This does not pick the product scope; it forbids treating multi-slot as already built.
- **Settled by:** live `store.rs` / architect mechanism. No human call.

## Human product calls (one at a time)

### D3 — One active BYO key vs keys on more than one provider — **B (owner 2026-08-17)**
- **Conflict ids:** `4a76e0e7…` · `a66d1978…` · `e4144d75…` · `767922d1…`
- **Ruling:** v1 stores **one BYO secret per provider** (Anthropic / OpenAI / Gemini / Grok). The trader can switch vendor without re-pasting. Switching the **active** provider updates the named provider+model pair Settings and Ask-AI agree on before the next ask.
- **Consequence of D2:** this is **not** already built. Architect must name an explicit credential-identity expansion (PK/rows per provider) under the same encrypt-at-rest / never-echo floors. UX renders a per-provider set / empty / replace / remove matrix, not a single Anthropic row.
- **Out of this ruling:** one-shot “next ask only” model override stays Future (not asked).

### D4 — First visit: preselect named catalog default vs block until click — **A (owner 2026-08-17)**
- **Conflict ids:** `0ec998f0…` · `9c1f8e7d…` · `55f323ae…`
- **Ruling:** When the catalog exposes a recommended default and no valid saved preference exists, **preselect that named model** (optionally labeled as the catalog recommended default). Ask is enabled with a visible name; the trader can change it. The act of leaving it selected **is** the selection (D1: used only after it is the selected preference).
- **Still locked (D1):** if a *saved* preference is later missing from the catalog → no LLM call; distinct blocked choose-another state; no silent substitute.

### D5 — Admin / any “free uses” path — **REMOVED (owner 2026-08-17)**
- **Conflict id:** `cc6cda08…` (and the leftover hybrid `shared_admin` allowance from `byo-ai-key`)
- **Ruling:** There is **no free-use path** for anyone — not admins, not regular users. Delete admin shared-key allowance, `remaining_free_uses` / “free uses” copy, and the `shared_admin` power path from this feature’s product surface.
- **How a trader powers Ask-AI (closed set):**
  1. **BYO API key** for a chosen provider (Anthropic / OpenAI / Gemini / Grok), or
  2. **Sign in with Grok (OAuth)** and run on Convexa’s Grok pool (preferred, cheaper — **not** “free”).
- **If Grok OAuth / pool is unavailable:** that path is present-but-unavailable (honest). The only working path is BYO. No silent fallthrough onto a server `ANTHROPIC_API_KEY` / `XAI_API_KEY` as a free allowance.
- **Copy:** never say “free uses,” “free allowance,” or “out of free uses.” Pool copy may say cheaper / included with Grok sign-in only if a vouched field supports that claim; it must not say free.

### D6 — Settings and Ask-AI share one persisted model preference — default-with-veto
- **Ask:** UX/PM whether Ask-AI writes the standing preference (no one-shot override).
- **Ruling:** **Yes.** One persisted provider+model preference; Settings and Ask-AI always label-agree. One-shot “next ask only” stays Future. Say `stop` if you wanted a one-shot override in v1.

## R3 closed
All product calls settled. Technical D2 + owner D3 require a per-provider credential schema. Synthesizer writes SPEC + INTERFACE against this file.

## Owner clarification after S2 (2026-08-17) — **reopens pool identity, not D5**

### D7 — Grok OAuth spends the **user's** subscription, not Convexa's pool
- **Correction:** "sub-pool" means the signed-in Grok user's **own** SuperGrok / Grok subscription allowance (their sub-pool). It is **not** a Convexa-billed server pool key.
- **Preferred path:** already signed into Convexa → **Connect Grok** (OAuth) → Ask-AI runs on **that user's Grok subscription**.
- **Not this path:** Convexa env `XAI_API_KEY` as a shared/sub pool; any "Convexa Grok pool" copy; Convexa-user-id pool metering as the product story.
- **Still distinct:** a **personal xAI API key** (BYO `xai` row) is pay-per-token console key, not the subscription. Provenance must not collapse "your Grok subscription" and "your Grok API key."
- **D5 still holds:** no admin/shared **free uses**. Convexa does not give anyone a free allowance. Subscription spend is the user's Grok plan, not a Convexa free tier.
- **D1–D4, D6 unchanged.**
- **Was out of scope, now in:** SuperGrok / subscription OAuth. Architect must name a buildable user-OAuth mechanism or keep the arm **present-but-unavailable** until primary xAI docs verify (same honesty as AC-27). Do not invent endpoints.
- **Copy:** never "Convexa Grok pool." Prefer "your Grok subscription" / closed path label that names the **user's** subscription. Still no "free" / unvouched "cheaper" / "included" in v1 UI.
- **§9.2 pool meter:** drop Convexa-quota framing. If the vendor does not expose a remaining-allowance field, do not invent a Convexa meter; use distinct vendor/link reasons only (`oauth_expired`, `oauth_unlinked`, subscription-unavailable if vouched).
