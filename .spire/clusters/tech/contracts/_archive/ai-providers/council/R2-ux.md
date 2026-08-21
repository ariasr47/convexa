```json
{
  "role": "ux",
  "agree": [
    "Keep **one active BYO credential** (`kind = \"ai\"`). Switching vendor = replace.",
    "Until the owner or a lane-check cites live xAI OAuth endpoints + scopes, do **not** invent protocol URLs, token shapes, or \"Sign in with Grok\" as if shipped fact.",
    "Keep this **named distinctly** from `pool_grok` so the cheaper Grok pool is never confused with the Anthropic admin free-tier.",
    "Closed unavailable reasons must not collapse (`absent-is-not-none`): at minimum distinguish `no_key` · `shared_key_unconfigured` · `pool_unavailable` · `pool_exhausted` · `oauth_unlinked` / `oauth_expired` (if OAuth ships) · `storage_unavailable` · LLM call faults (`timeout` / `llm_error` / etc. already used by `complete_strategy`).",
    "The UI must **not** guess the provider from the shape of a pasted key string — the trader selects the provider label first.",
    "Does **not** silently fall back to a hidden default.",
    "If the Grok OAuth + Convexa pool arm cannot be delivered honestly in this build, the ship either (a) delivers the arm meeting AC-9/10/14/15, or (b) leaves those ACs **explicitly open / blocked-on** in the gate record — it must **not** ship a false \"connected to Grok pool\" affordance or silently redefine SuperGrok-subscription pass-through as the pool.",
    "**Per-request model override that is not persisted** as a standing preference — model choice is a durable trader preference for the active path, not a one-shot hidden query param the Settings surface never shows.",
    "**SuperGrok / \"use my xAI subscription instead of a key\"** — a different product."
  ],
  "conflicts": [
    {
      "quote": "Switching the active BYO provider (with keys set on more than one) updates the named provider+model pair Settings and Ask-AI agree on before the next ask.",
      "source": "pm",
      "why": "UX R1 information structure is a single BYO credential row (provider select → one masked last-4 → replace/remove), matching today's `(user_id, kind=ai)` shape and Architect's one-active-BYO non-goal. Concurrent keys-per-provider forces a four-row set/unset matrix, different empty/replace states, and a provider-switch control the current panel does not have — that is a scope expansion, not a copy tweak.",
      "proposal": "v1: one active BYO key; switching vendor is replace. Trader sees the stored provider label + masked hint for that single credential. Drop AC-25's \"keys set on more than one\" (and \"per-provider\" secret persistence) unless the human explicitly expands to multi-slot.",
      "kind": "product"
    },
    {
      "quote": "The server can persist **per-user, per-provider** BYO secrets under the existing encrypt-at-rest / never-echo floors and resolve exactly one usable key (or none) for an Ask-AI call without returning plaintext to the client.",
      "source": "pm",
      "why": "Same multi-slot assumption: per-provider stored secrets imply multiple concurrent BYO credentials. UX cannot honestly render \"set for that provider\" across four vendors while Architect keeps a single `kind = \"ai\"` record and UX keeps one write-only chrome path.",
      "proposal": "Persist one BYO secret per user; the closed provider label on that record is what Settings/Ask-AI display. Multi-provider means the trader may choose any of the four when writing, not that four ciphertexts coexist.",
      "kind": "product"
    },
    {
      "quote": "On resolve: if preference ∈ catalog for the active provider → use it; else fall back to catalog default **and surface that effective model** on status/rec provenance so it is never invisible.",
      "source": "architect",
      "why": "Auto-substituting another model when the saved preference is absent from the catalog renames the trader's choice. Surfacing the substitute still asserts \"this is what you are running\" without an explicit re-pick — the defining UX integrity failure for this feature. PM already requires a distinct choose-another-model block with no silent substitute.",
      "proposal": "If preference ∉ catalog (or unset with no accepted recommended default policy): return a distinct `model_not_in_catalog` / model-missing outcome; FE shows the blocked choose-another state and does not ask. Never resolve a different model behind the trader's back.",
      "kind": "product"
    },
    {
      "quote": "No powered ask runs against an unnamed / invisible default: if the product would otherwise have used an env default the trader never selected, the surface instead requires an explicit model choice (blocked until chosen) rather than silently asking.",
      "source": "pm",
      "why": "BRIEF requires a named model the trader can see and override — not necessarily an empty control until a click. Forcing blank-until-chosen while a server catalog still has a recommended default recreates a visually empty model field (today's failure mode) unless every empty state is perfectly copy-disciplined. Architect's catalog recommended default + UX's \"show that name as the current selection\" already make the default visible and overrideable.",
      "proposal": "When the catalog exposes a recommended default and no valid saved preference exists, preselect that named model (optionally labeled as the catalog recommended default) so Ask is enabled with a visible name; trader can change it. Block ask only when the catalog is empty/unavailable or the saved selection is invalid (AC-17 path) — not whenever an env-derived recommendation exists.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: while the OAuth identity arm stays config-gated / blocked-on, can any signed-in trader be `pool_grok`-entitled in v1, or must Settings render the preferred path only as present-but-unavailable (info note, no Connect CTA that cannot complete)?",
    "Architect: confirm the closed FE-consumable unavailable-reason set for at least no_key · pool_unavailable · pool_exhausted · oauth_expired/unlinked · storage_unavailable · model_not_in_catalog · key_rejected · shared_admin variants so Ask-AI copy cannot collapse states.",
    "PM: with one-shot model override Out, do Settings and Ask-AI bind to the same persisted model preference (Ask-AI select writes that preference), so both surfaces always label-agree before the next ask?"
  ]
}
```
