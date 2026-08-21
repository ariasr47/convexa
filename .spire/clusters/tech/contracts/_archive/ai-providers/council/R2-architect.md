```json
{
  "role": "architect",
  "agree": [
    "SuperGrok subscription pass-through is Out.",
    "If the pool arm is not buildable, do not silently narrow owner intent in the shipped UI — mark blocked-on (AC-28) and keep BYO multi-provider + model choice shippable on their own ship-blocking ACs.",
    "The trader's **explicit selection** of pool vs BYO provider is the product control; \"preferred\" means the pool is the default offer when available, not that BYO is disabled.",
    "Legacy admin shared Anthropic allowance survives but must be **renamed in product language** so it cannot be read as the Grok pool.",
    "Options come from a server-provided catalog for the active path/provider; if catalog empty/unavailable, show honest empty — do not invent model ids in the client.",
    "If either is absent: **omit the chip** (do not invent; do not show \"default\").",
    "if architect marks Grok OAuth blocked-on, the UI must still ship BYO multi-provider + model picker without fake \"Continue with Grok\" that cannot complete — preferred-path chrome becomes present-but-unavailable (like Google sign-in), not a lying primary."
  ],
  "conflicts": [
    {
      "quote": "Switching the active BYO provider (with keys set on more than one) updates the named provider+model pair Settings and Ask-AI agree on before the next ask.",
      "source": "pm",
      "why": "Live credential PK is (user_id, kind) with kind=\"ai\" — one BYO ciphertext per user; replace overwrites. Concurrent keys-on-more-than-one needs a credential-identity expansion architect deferred as a v1 non-goal (complexity + migration). AC-25 and the In-scope 'key per chosen BYO provider' bullet cannot ship against the one-row store.",
      "proposal": "Human picks scope: (a) one active BYO credential and rewrite AC-1/4/25 to replace-switches-vendor; or (b) expand PK/rows to per-provider slots and drop the one-slot non-goal before build.",
      "kind": "product"
    },
    {
      "quote": "The server can persist **per-user, per-provider** BYO secrets under the existing encrypt-at-rest / never-echo floors and resolve exactly one usable key (or none) for an Ask-AI call without returning plaintext to the client.",
      "source": "pm",
      "why": "Encrypt-at-rest and never-echo already hold, but per-provider concurrency does not: CredentialRecord is one row per (user_id, kind=\"ai\"). Treating multi-slot persistence as already available under the existing store is false and will fail AC-1/4/25 at implementation.",
      "proposal": "If product chooses multi-slot, name an explicit schema/PK change; if product chooses one active key, drop the per-provider persistence assumption.",
      "kind": "technical"
    },
    {
      "quote": "On resolve: if preference ∈ catalog for the active provider → use it; else fall back to catalog default **and surface that effective model** on status/rec provenance so it is never invisible.",
      "source": "architect",
      "why": "PM AC-17 forbids silently substituting another model when the saved selection is missing from the catalog; auto-calling the catalog default still runs a model the trader did not choose for this path even if provenance later names it. Retracting this R1 resolver claim.",
      "proposal": "If preference is unset or ∉ catalog → resolve blocked with a closed model_missing / model_unset reason (no LLM call). Catalog recommended default may appear only as a visible selectable option (UX 'Server default · {name}'); it is used only after it is the selected preference.",
      "kind": "product"
    }
  ],
  "asks": [
    "PM: does v1 require concurrent BYO keys across providers (AC-25), or is one active BYO credential with replace-to-switch-vendor acceptable?",
    "PM: does AC-7 allow the catalog recommended default to appear pre-selected and named on first visit, or must the model control start empty/blocked until the trader clicks a choice?",
    "UX: if product keeps one active BYO slot, is replace-to-switch (single set-state + provider chip from stored provider) acceptable, or do you need per-provider set/empty rows regardless of storage?"
  ]
}
```
