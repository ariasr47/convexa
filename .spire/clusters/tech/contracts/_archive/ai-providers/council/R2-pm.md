```json
{
  "role": "pm",
  "agree": [
    "Until the owner or a lane-check cites live xAI OAuth endpoints + scopes, do **not** invent protocol URLs, token shapes, or \"Sign in with Grok\" as if shipped fact.",
    "Keep this **named distinctly** from `pool_grok` so the cheaper Grok pool is never confused with the Anthropic admin free-tier.",
    "**Out of scope / non-goal:** SuperGrok-subscription OAuth that spends the user's xAI subscription instead of a key.",
    "Provider and model are **never scoring inputs** (`additive-keeps-score-byte-identical`); module boundary stays recommendation/auth leaf only.",
    "Provider select (closed four) **before** the secret field — provider is chosen by the trader, not guessed from `sk-…`.",
    "If either is absent: **omit the chip** (do not invent; do not show \"default\").",
    "Selection is visible and overrideable; if the server still has an env default, the UI must **show that name** as the current selection (or an explicit \"Server default · {name}\" option) — never a blank that hides it.",
    "if architect marks Grok OAuth blocked-on, the UI must still ship BYO multi-provider + model picker without fake \"Continue with Grok\" that cannot complete — preferred-path chrome becomes present-but-unavailable (like Google sign-in), not a lying primary."
  ],
  "conflicts": [
    {
      "quote": "Keep **one active BYO credential** (`kind = \"ai\"`). Switching vendor = replace.",
      "source": "architect",
      "why": "R1-pm In-scope and ACs require a key set per chosen BYO provider, including switching with keys set on more than one (AC-1/4/25). One-slot replace-to-switch cannot leave multiple providers observably set and forces re-pasting secrets to change vendor — that silently narrows owner-facing multi-provider powering.",
      "proposal": "Human picks scope: (a) accept one-active BYO for v1 and rewrite PM ACs to sequential capability per vendor (add/replace/remove for whichever provider is active, never concurrent), or (b) expand credential storage to a multi-slot matrix before build. Do not leave both claims for the synthesizer.",
      "kind": "product"
    },
    {
      "quote": "On resolve: if preference ∈ catalog for the active provider → use it; else fall back to catalog default **and surface that effective model** on status/rec provenance so it is never invisible.",
      "source": "architect",
      "why": "Falling back and calling on a catalog default when the saved preference is missing/invalid substitutes a model the trader did not select for this path. Surfacing after the fact still lets Ask-AI run — that breaks AC-17 (distinct blocked state; no silent substitute; no recommendation until the trader picks a catalog model).",
      "proposal": "Status may show the catalog recommended default as a suggested/current picker value the trader can see and change (agree with UX). When the saved preference is absent from the active catalog, Ask-AI stays blocked until the trader selects a catalog model; do not resolve-and-call on an unconfirmed substitute.",
      "kind": "product"
    },
    {
      "quote": "Recommend PM rename Ask-AI admin copy later if \"free\" collides with pool messaging — pool copy must stay non-\"free\" regardless.",
      "source": "ux",
      "why": "Deferring the admin-copy rename past this ship leaves the defining vocabulary collision live: traders will read admin \"free uses\" and the preferred Grok pool as the same path. PM AC-19 is ship-blocking that legacy admin shared-allowance outcomes stay mutually distinct from Convexa Grok pool states in product language.",
      "proposal": "Keep any Ask-AI admin-allowance wording fix required for admin≠pool honesty inside this feature's review gate (AC-19). Pool copy still never says \"free\" unless a vouched field authorizes it.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: when OAuth is config-gated unavailable, is there any non-OAuth way for a trader to become pool-entitled in v1, or is `pool_grok` spend unreachable until the OAuth identity arm verifies?",
    "Architect: under one-active BYO, will status still expose the closed provider label for the single stored key so Settings/Ask-AI can show a named provider without FE key-string forensics?",
    "UX: does the Ask-AI model control always write through to the standing preference (PM In), or do you need a one-shot \"next ask only\" override (PM Future-dated)?"
  ]
}
```
