# byo-ai-key — UX BLUEPRINT

> UX / Tech-Writer (third, after Architect → PM). Scope: component states, where each datum surfaces,
> microcopy/labels, tooltip/glossary text, exact degraded-state wording, and the AC↔component-state
> mapping that IS the required-tests matrix. Derived strictly from PRODUCT_CONTRACT (5-state model §4,
> 26 ACs §5, decisions §3, interface note §7) + ARCHITECTURE_CONTRACT (the 5 pivotal calls) +
> PROJECT_CONTEXT §8 (AI-call boundary). NO server internals, NO math, NO final endpoint/payload
> decisions beyond NAMING the fields the UI consumes.

This feature EXTENDS the shipped `apps/dashboard/src/app/ai-rec/*` surface (the 12-state rec panel,
`AiRecPanel` + `useAiRecommendation` + `copy.ts`) and adds a new section to the shipped
`apps/dashboard/src/app/auth/SettingsPage.tsx`. Everything below composes ON TOP of the existing
states (auth-outermost gate, `ai_eval` gate, cooldown, daily cap, produced/no_trade/stale/unavailable)
— it does not replace them. The new key-resolution states slot in front of the existing produced/idle
flow exactly where the shipped `no_key` / `inAppEnabled:false` branch already lives in `ActionRegion`.

---

## 1. Where this surfaces (two surfaces)

1. **AI-rec panel** (`AiRecPanel`, mounted on the Ticker page only) — renders ONE of the five
   key-resolution states (a–e) as the body/action region, composing with the existing gate/cooldown/
   cap states. The five states are driven by the rec endpoint's `status` + a per-admin remaining-uses
   field (see §6 fields).
2. **Settings "AI key" section** (new section appended inside `SettingsPage`, below Theme) — the
   write-only key entry: empty / set (masked) states, Replace + Remove, validation + error copy.

A logged-out visitor NEVER reaches a key-resolution state: the existing auth-outermost gate
(`useGate` / `SignInPrompt`) renders first (AC-22). The manual export floor ("View what's sent")
stays reachable from every state, signed-in or anonymous (AC-13/22/23).

---

## 2. The composition order on the AI-rec panel (precedence — what the user actually sees)

Exactly one body/action state renders per request. The resolution is a layered precedence; the FE
reads it off the status fields, never re-derives it:

```
1. AUTH (outermost, shipped)        logged-out / 403 stale cookie  → SignInPrompt   (AC-22)
2. in-app feature off (shipped)     in_app_enabled:false           → "In-app AI not configured"
3. KEY-RESOLUTION STATE (NEW)       status ∈ {a no_key, c over_limit-admin,
                                              e shared_key_unconfigured}            (a/c/e: no rec)
                                    status produced + key_source own | shared_admin (b/d: rec)
4. ai_eval gate / cooldown / cap (shipped)  orthogonal — still apply on the SHARED path; an own-key
                                    user is bound only by their own cooldown + the ai_eval gate.
```

The five key-resolution states (a–e) are the new layer (3). They are mutually exclusive and
observably distinct (PRODUCT_CONTRACT §6). States a, c, e produce NO recommendation and render a
CTA/unavailable body. States b, d produce a recommendation (the existing `RecResult`) plus a subtle
provenance indicator.

---

## 3. The five AI-rec panel states — component states + exact copy

Each state lists: trigger (status fields it reads), body treatment, exact copy, the action region, and
the `data-testid` the FE must expose for the required tests. All five are best-effort HTTP 200 — none
is an error/5xx (AC-15). The "View what's sent" export control stays present in EVERY state (AC-23).

### State (a) — regular user, no own key → connect-your-key CTA  (AC-1, AC-6 pre-add, AC-9 regular)
- **Trigger:** rec `status === 'unavailable'` AND `unavailable_reason === 'no_key'` (regular; not an
  admin). No `remaining_free_uses` field present (regular users never carry one).
- **Treatment:** a calm, informational CTA block (NOT an error red; NOT a free-trial banner). Frames
  this as a one-time setup step. No spinner, no counter, no allowance language.
- **`data-testid`:** `ai-rec-state-no-key`.
- **Exact copy:**
  - Title: **"Add your Anthropic key to get AI recommendations"**
  - Body: **"AI recommendations run on your own Anthropic API key — your key, your cost. Add it once
    in Settings and this unlocks. The manual export below always works without a key."**
  - Primary action button: **"Add your key in Settings"** → navigates to Settings (the AI-key
    section). `data-testid` `ai-rec-add-key-cta`.
  - MUST NOT contain the words "free", "trial", "free uses", or any counter.

### State (b) — admin, shared key configured, allowance remaining → rec + subtle counter  (AC-2, AC-26)
- **Trigger:** rec `status === 'produced'` AND `key_source === 'shared_admin'`; response carries
  `remaining_free_uses` (integer ≥ 0) AND `free_uses_total` (the allowance, e.g. 3).
- **Treatment:** the FULL existing `RecResult` (risk-first artifact, Accept, etc.) renders UNCHANGED.
  A subtle, SUBORDINATE chip is added to the existing provenance row (alongside `Persona · …`,
  `As of …`, `SIMULATED / advisory`). It is small, low-emphasis, never a headline.
- **`data-testid`:** chip `ai-rec-free-uses` on a produced rec.
- **Exact copy (chip):** **"{remaining} of {total} free uses left today"** — e.g. "2 of 3 free uses
  left today". (`freeUsesChip(remaining, total)`.)
- **Decrement (AC-2):** the chip reflects the `remaining_free_uses` the server returns on EACH
  produced shared rec; after a produced shared rec the next observed value is one lower (the server
  decrements on a produced shared rec only — AC-17 confirms a failure does NOT decrement).
- **Tooltip on the chip:** **"Free recommendations on the shared key, for admins. Used today's allowance?
  Add your own Anthropic key in Settings to keep going. The count resets daily."**

### State (c) — admin, shared key configured, allowance exhausted, no own key → distinct exhausted CTA  (AC-3, AC-21 pre-add)
- **Trigger:** rec `status === 'unavailable'` AND `unavailable_reason === 'over_limit'` AND the
  identity is an admin (the response carries `remaining_free_uses === 0` and `key_source` resolved to
  none with a shared key present). Observably DISTINCT from (a) and (e) by copy + testid.
- **Treatment:** a calm unavailable block (NOT error red, NOT "gone forever"). Distinct from the
  shipped global daily-cap state (that is `cap.over_limit`; this is the PER-ADMIN shared allowance).
- **`data-testid`:** `ai-rec-state-admin-exhausted`.
- **Exact copy:**
  - Title: **"You've used today's 3 free recommendations"** (renders `{total}` — "today's {total}
    free recommendations").
  - Body: **"Your free allowance on the shared key is used up for today. Add your own Anthropic key in
    Settings to keep getting recommendations — your free uses come back tomorrow."**
  - Action button: **"Add your key in Settings"** → Settings. `data-testid` `ai-rec-add-key-cta`.
  - MUST NOT say the uses are gone permanently; MUST read differently from (a) and (e).

### State (d) — any user with own key → rec + subtle "using your key"  (AC-4, AC-5, AC-6, AC-8, AC-21, AC-25)
- **Trigger:** rec `status === 'produced'` AND `key_source === 'own_key'`. NO `remaining_free_uses`
  rendered (own-key calls have no counter — AC-4).
- **Treatment:** the FULL existing `RecResult` renders UNCHANGED. A subtle, subordinate chip is added
  to the provenance row. No counter, no allowance language.
- **`data-testid`:** chip `ai-rec-own-key`.
- **Exact copy (chip):** **"Using your key"** (`OWN_KEY_CHIP`).
- **Tooltip on the chip:** **"This recommendation ran on your own Anthropic key — your cost, no shared
  limit. It doesn't use the free admin allowance. Manage your key in Settings."**
- **AC-5 (admin own-key first):** an admin in this state shows the **"Using your key"** chip and NO
  `free-uses` chip — the response's `remaining_free_uses` is unchanged across this call (own-key does
  not spend the allowance). The required test asserts both: chip present, free-uses count unchanged.

### State (e) — admin, NO shared key configured, no own key → admin-flavored BYO CTA  (AC-24, AC-25 pre-add, AC-26 pre-config)
- **Trigger:** rec `status === 'unavailable'` AND `unavailable_reason === 'shared_key_unconfigured'`
  (the distinct status from §7 of the PRODUCT_CONTRACT). NO `remaining_free_uses` rendered — nothing
  is offered or decremented. Observably DISTINCT from (a) `no_key` and (c) `over_limit`.
- **Treatment:** a calm unavailable CTA, admin-flavored, that explains the shared key isn't configured
  and falls through to the BYO path. This is the COMMON case today (no shared key is set —
  PRODUCT_CONTRACT §3). NOT a free-trial framing. NO counter.
- **`data-testid`:** `ai-rec-state-shared-unconfigured`.
- **Exact copy:**
  - Title: **"The shared AI key isn't set up"**
  - Body: **"There's no shared key configured for free admin recommendations right now. Add your own
    Anthropic key in Settings to use recommendations — your key, your cost. The manual export below
    still works without a key."**
  - Action button: **"Add your key in Settings"** → Settings. `data-testid` `ai-rec-add-key-cta`.
  - MUST NOT show a free-use counter; MUST read differently from (a) and (c).

### Cross-state invariants (carried into the matrix)
- The three CTA states (a, c, e) each route to Settings with the SAME button label
  ("Add your key in Settings") but are distinguished by title/body copy + testid (PRODUCT_CONTRACT §6).
- The "View what's sent" export control is present in all five states (AC-23) and unchanged.
- The auth gate (state §2.1) and the in-app-off state (§2.2) precede all five; logged-out NEVER shows
  a, b, c, d, or e (AC-22).

---

## 4. Settings "AI key" section — component states + exact copy

A new section appended INSIDE the existing `SettingsPage` (`apps/dashboard/src/app/auth/SettingsPage.tsx`),
below the Theme control. Write-only model: the key is sent (write); only a masked last-4 hint + a
"set" indicator are ever read back (AC-7/8/10). There is NO "show key" / reveal control anywhere
(PRODUCT_CONTRACT §6). The section is visible only when signed-in (key storage is per-account); when
anonymous, the section shows a sign-in prompt (see §4.5).

Section heading: **"AI key"**. Section helper (under the heading): **"Your own Anthropic key lets AI
recommendations run on your key, at your cost. It's stored encrypted and used only for your own
recommendations — it's never shown again and never leaves the server."** `data-testid`
`settings-ai-key-section`.

### State (Empty) — no key set  (AC-7 pre-add, AC-9 post-remove, AC-20 post-restart)
- **Trigger:** the key-status read returns `set === false`.
- **Treatment:** an empty "add a key" form: a single password-type input + an "Add key" button.
- **`data-testid`:** `settings-ai-key-empty`; input `settings-ai-key-input`; button `settings-ai-key-add`.
- **Exact copy:**
  - Input label: **"Anthropic API key"**
  - Input placeholder: **"sk-ant-…"**
  - Input is `type="password"` (never `text`) — the value the user is TYPING is masked by the browser;
    once submitted it is cleared from the field and never re-displayed.
  - Helper under input: **"Starts with sk-ant-. Stored encrypted; you won't be able to view it again."**
  - Button: **"Add key"** (→ submitting: **"Adding…"**).

### State (Set) — a key is stored  (AC-7 post-add, AC-8, AC-10)
- **Trigger:** the key-status read returns `set === true` + `last4` (the only credential thing read back).
- **Treatment:** a masked display row + Replace + Remove actions. The full key is NEVER shown; the only
  affordance is the masked hint. NO reveal/show control exists (assert its ABSENCE in tests).
- **`data-testid`:** `settings-ai-key-set`; masked display `settings-ai-key-masked`; Replace
  `settings-ai-key-replace`; Remove `settings-ai-key-remove`.
- **Exact copy:**
  - Masked display: **"Key set ···· {last4}"** — e.g. "Key set ···· 1234" (`maskedKeyLabel(last4)`).
  - Sub-line: **"Stored encrypted. Used only for your recommendations. Never shown again."**
  - Replace action: **"Replace"** — opens the same input form (entering a new key overwrites; AC-8);
    submitting copy **"Replacing…"**; on success the masked hint reflects the NEW last-4 (AC-8).
  - Remove action: **"Remove"** — opens a confirm (see §4.4); on success → Empty state (AC-9).
  - There is NO "Show key", "Reveal", "Copy key", or "View key" control. (Tested by absence.)

### State (Replace form) — entering a new key over an existing one  (AC-8)
- **Trigger:** user clicked **Replace** in the Set state.
- **Treatment:** identical to the Empty input form, but the button reads **"Replace key"** and a
  Cancel link returns to the Set state without change.
- **Exact copy:** input + helper as Empty; button **"Replace key"** (→ **"Replacing…"**); Cancel:
  **"Cancel"**. On success: masked hint reflects the new last-4; sub-line confirms (see §4.6 toast).

### State (Remove confirm)  (AC-9)
- **Trigger:** user clicked **Remove**.
- **Treatment:** a small inline confirm (or dialog) — destructive, single confirm. Honest about the
  consequence per role-independent wording (role-specific fallback shows on the rec surface, not here).
- **`data-testid`:** `settings-ai-key-remove-confirm`.
- **Exact copy:**
  - Prompt: **"Remove your stored Anthropic key?"**
  - Body: **"AI recommendations will stop running on your key. You can add a key again any time."**
  - Confirm button: **"Remove key"** (`data-testid` `settings-ai-key-remove-confirm-btn`); Cancel:
    **"Keep key"**.

### State (Anonymous) — section while signed out  (AC-22 adjacency; not a key state)
- **Trigger:** `auth.authenticated === false`.
- **Treatment:** the section renders a brief sign-in prompt instead of the form — a stored key is
  per-account, so there is nothing to set anonymously.
- **`data-testid`:** `settings-ai-key-anonymous`.
- **Exact copy:** **"Sign in to add your own Anthropic key for AI recommendations."**

### State (Encryption secret absent — backend config)  (AC-18)
- **Trigger:** the backend reports that key storage is unavailable on this deployment (the key-status
  read returns a `storage_available === false` flag, OR an Add attempt returns a contained
  "unavailable" outcome — NEVER a 5xx; AC-18). UX honors whichever the backend chooses: per the
  ARCHITECTURE default, an absent encryption secret falls back to an ephemeral per-process key (keys
  accepted but reset on restart, like the session signing key) — so the common path is the normal
  Empty/Set flow with the ephemerality already covered by AC-20 wording. If the backend instead
  reports storage unavailable, the UX is honest and never errors out.
- **Treatment:** if `storage_available === false`: the input is disabled and an info (NOT error) note
  shows. No crash, no 5xx, no key ever exposed.
- **`data-testid`:** `settings-ai-key-storage-unavailable`.
- **Exact copy (storage-unavailable variant):** **"Key storage isn't set up on this deployment yet,
  so a key can't be saved right now. The manual export hand-off still works without a key."**
- **Note:** the ADD-failure transport variant reuses the save-error toast (§4.6).

### Save / error feedback (reused + new)
- **Success toast** (reuses the existing `Snackbar` + `settings-saved` pattern): **"AI key saved."** on
  add/replace; **"AI key removed."** on remove. `data-testid` `settings-ai-key-saved`.
- **Save error** (non-blocking `Alert`, reuses the `settings-save-error` pattern): **"Couldn't save
  your key. Please try again."** `data-testid` `settings-ai-key-error`. The error NEVER echoes the key.
- **Validation error** (client-side, before send): if the field is empty on submit →
  **"Enter your Anthropic key."**; (optional soft format hint, non-blocking) if it doesn't start with
  `sk-ant-` → **"That doesn't look like an Anthropic key (it should start with sk-ant-)."** —
  warn-only; the backend is the authority. `data-testid` `settings-ai-key-validation`.

---

## 5. Microcopy / glossary / tooltip index (single source for `byoKeyCopy`)

The FE adds these to the rec-surface copy module and the auth copy module (do not improvise; these are
the canonical strings the tests assert verbatim where load-bearing).

**AI-rec panel (extend `ai-rec/copy.ts`):**
- `byoKey.noKey.title` = "Add your Anthropic key to get AI recommendations"
- `byoKey.noKey.body` = "AI recommendations run on your own Anthropic API key — your key, your cost.
  Add it once in Settings and this unlocks. The manual export below always works without a key."
- `byoKey.noKey.cta` = "Add your key in Settings"
- `byoKey.adminExhausted.title(total)` = `You've used today's ${total} free recommendations`
- `byoKey.adminExhausted.body` = "Your free allowance on the shared key is used up for today. Add your
  own Anthropic key in Settings to keep getting recommendations — your free uses come back tomorrow."
- `byoKey.sharedUnconfigured.title` = "The shared AI key isn't set up"
- `byoKey.sharedUnconfigured.body` = "There's no shared key configured for free admin recommendations
  right now. Add your own Anthropic key in Settings to use recommendations — your key, your cost. The
  manual export below still works without a key."
- `freeUsesChip(remaining, total)` = `${remaining} of ${total} free uses left today`
- `byoKey.freeUses.tooltip` = "Free recommendations on the shared key, for admins. Used today's
  allowance? Add your own Anthropic key in Settings to keep going. The count resets daily."
- `OWN_KEY_CHIP` = "Using your key"
- `byoKey.ownKey.tooltip` = "This recommendation ran on your own Anthropic key — your cost, no shared
  limit. It doesn't use the free admin allowance. Manage your key in Settings."

**Settings AI-key section (extend `auth/copy.ts` under `settings.aiKey`):**
- `heading` = "AI key"
- `helper` = "Your own Anthropic key lets AI recommendations run on your key, at your cost. It's stored
  encrypted and used only for your own recommendations — it's never shown again and never leaves the
  server."
- `inputLabel` = "Anthropic API key"
- `inputPlaceholder` = "sk-ant-…"
- `inputHelper` = "Starts with sk-ant-. Stored encrypted; you won't be able to view it again."
- `addBtn` = "Add key" / `addingBtn` = "Adding…"
- `maskedKeyLabel(last4)` = `Key set ···· ${last4}`
- `setSubLine` = "Stored encrypted. Used only for your recommendations. Never shown again."
- `replaceBtn` = "Replace" / `replaceSubmitBtn` = "Replace key" / `replacingBtn` = "Replacing…"
- `removeBtn` = "Remove"
- `removeConfirmTitle` = "Remove your stored Anthropic key?"
- `removeConfirmBody` = "AI recommendations will stop running on your key. You can add a key again any time."
- `removeConfirmBtn` = "Remove key" / `removeCancelBtn` = "Keep key" / `cancelBtn` = "Cancel"
- `savedAdd` = "AI key saved." / `savedRemove` = "AI key removed."
- `saveError` = "Couldn't save your key. Please try again."
- `validationEmpty` = "Enter your Anthropic key."
- `validationFormat` = "That doesn't look like an Anthropic key (it should start with sk-ant-)."
- `storageUnavailable` = "Key storage isn't set up on this deployment yet, so a key can't be saved
  right now. The manual export hand-off still works without a key."
- `anonymous` = "Sign in to add your own Anthropic key for AI recommendations."

---

## 6. Fields the UI consumes (naming only — signatures are the executioners')

The UI reads ONLY these from the extended interface. It NEVER reads a raw key, ciphertext, identity, or
admin flag (none of those reach the browser — AC-10/11/12; PROJECT_CONTEXT §8).

**From the rec response / status (extends the shipped `RecResponse` / `RecStatus`):**
- `status` — existing enum + the existing `unavailable_reason`. The `unavailable_reason` value set
  the UI keys off GAINS a distinct value: `shared_key_unconfigured` (state e), distinct from `no_key`
  (state a) and `over_limit` (the admin-exhausted state c). (Exact wire strings are executioner-fixed;
  the UI maps these three intents to states a/c/e respectively.)
- `key_source` — which key produced a rec: `own_key` (→ "Using your key" chip, state d) |
  `shared_admin` (→ free-uses chip, state b) | `none` (no rec). Used ONLY to pick the provenance chip;
  NEVER a scoring input (AC-14).
- `remaining_free_uses` — integer, present ONLY for admins on a shared-key-configured path; absent for
  regular users (a regular user NEVER sees a counter — PRODUCT_CONTRACT §6). Drives the free-uses chip
  (b) + the exhausted title (c). Absent in states a, d, e.
- `free_uses_total` — the allowance number (e.g. 3) for the "{remaining} of {total}" copy. Falls back
  to a display constant only if absent.

**From the key-status read (NEW endpoint — write/mutate set+delete; this read returns at most a masked
hint, NEVER the key — AC-10):**
- `set` — boolean: a key is stored (→ Set state) or not (→ Empty state).
- `last4` — the last-4 masked hint, present only when `set === true`. The ONLY credential datum the UI
  ever receives.
- `storage_available` — boolean: false ⇒ the storage-unavailable variant (AC-18). Optional; absent ⇒
  treated as available (the ephemeral-key fallback path).

---

## 7. AC → component-state mapping  (THE REQUIRED-TESTS MATRIX)

Every AC maps to the component state(s) and the named assertion(s) that satisfy it. This mapping IS the
required-tests set the FE implements (it does not choose the set). Egress/invariant ACs are listed with
their boundary assertion. "FE" = frontend test; "BE" = backend runtime/conformance proof. Several ACs
require BOTH lanes (key-source-driven behavior surfaces on the FE; metering/decrypt/egress is proven on
the BE).

| AC | Component state(s) / surface | Required test assertion(s) | Lane |
|---|---|---|---|
| AC-1 | (a) `ai-rec-state-no-key` | `status:unavailable`+`reason:no_key`, regular ⇒ CTA renders, NO `ai-rec-free-uses`, NO "free/trial" text, no rec body, "Add your key in Settings" → Settings | FE |
| AC-2 | (b) produced + `ai-rec-free-uses` | shared produced ⇒ rec body + chip "N of 3 free uses left today"; after a produced shared rec the next `remaining_free_uses` is one lower | FE + BE(meter) |
| AC-3 | (c) `ai-rec-state-admin-exhausted` | `reason:over_limit` admin ⇒ exhausted title/body, no rec; testid + copy DISTINCT from (a) `ai-rec-state-no-key` and (e) `ai-rec-state-shared-unconfigured` | FE + BE |
| AC-4 | (d) produced + `ai-rec-own-key` | own-key produced ⇒ rec body + "Using your key" chip; NO `ai-rec-free-uses` chip | FE + BE |
| AC-5 | (d) for an admin | admin own-key ⇒ "Using your key" chip present, `ai-rec-free-uses` absent, `remaining_free_uses` UNCHANGED across the call | FE + BE(meter) |
| AC-6 | (a)→(d) regular | regular user with a key ⇒ produced (d), proving BYO works for non-admins | FE + BE |
| AC-7 | Settings Empty→Set | add ⇒ `settings-ai-key-set` + `settings-ai-key-masked` "Key set ···· {last4}"; NO reveal control exists (assert absence); full key never in DOM | FE + BE(egress) |
| AC-8 | Settings Set→Replace→Set | replace ⇒ masked hint shows the NEW last-4; next rec uses the new key (key_source own_key, fresh produced); no old-key history shown | FE + BE |
| AC-9 | Settings Set→Remove→Empty; (d)→(a)/(c)/(e) | remove ⇒ Empty state; regular next rec ⇒ (a); admin next rec ⇒ (c) w/ shared key or (e) without | FE + BE |
| AC-10 | Settings reads + rec path (egress) | inspect all key-flow responses: at most `last4`+`set`/masked hint; raw key NEVER in any response body or DOM | FE(network/DOM) + BE |
| AC-11 | egress (logs) | add/replace/use/remove ⇒ no log/trace/observability field contains the raw key OR ciphertext | BE(log scan) |
| AC-12 | (d) rec path egress | produced-on-own-key ⇒ request+response to browser carry rec+status only; key never in any browser payload | FE(network) + BE |
| AC-13 | export floor (`RecExport`) | export artifact = context + persona prompt + glossary + egress_note ONLY; NO key, no other ticker, no identity, no order data | FE + BE(conformance) |
| AC-14 | all states (invariant) | `opportunity_score`/`opportunity_tier`/gate/`state_fingerprint` byte-identical across anonymous, (a), (b), (c), (d), (e); key source/admin/shared-presence/count never a scoring input | BE(byte-identical proof) + FE(bundle unchanged) |
| AC-15 | (a)/(c)/(e)/unavailable + page isolation | a key lookup/decrypt/LLM/limit failure ⇒ contained status (no_key/over_limit/shared_key_unconfigured/unavailable), HTTP 200 not 5xx; bundle/SSE/GEX chart/ghost-trade keep rendering | FE(isolation) + BE |
| AC-16 | (a)/(c)/(e) via decrypt-fail | a stored key that can't be decrypted ⇒ unavailable (treated as no usable key: regular (a), admin (c)/(e) fallback), not a rec, not 5xx, no key/ciphertext leaked | BE + FE(state renders) |
| AC-17 | (b)/(d) → unavailable | LLM error/timeout on the resolved key ⇒ unavailable status, 200, page intact; a SHARED-key call does NOT decrement `remaining_free_uses` | FE + BE(meter) |
| AC-18 | Settings storage-unavailable / Empty | encryption secret absent ⇒ no crash; either ephemeral-key accept (Empty/Set flow normal) OR `storage_available:false` ⇒ `settings-ai-key-storage-unavailable`; never 5xx, never exposes a key | FE + BE |
| AC-19 | (a)/(d) | admin dropped from allowlist ⇒ no free allowance (regular-no-key (a)); with own key still produces (d) | BE + FE |
| AC-20 | Settings Empty + (a)/(c)/(e) | after restart, keys gone ⇒ `set:false` Empty (no stale "set" hint); rec shows role no-key behavior, no error | BE + FE |
| AC-21 | (c)→(d) | exhausted admin adds own key ⇒ immediately produced on own key (d); free count untouched | FE + BE |
| AC-22 | auth gate (NOT a key state) | logged-out ask-AI ⇒ `ai-rec-signin-prompt`/`ai-rec-auth-gate`, NEVER (a)/(b)/(c)/(d)/(e); export floor stays anonymous-usable | FE + BE(403) |
| AC-23 | export floor, all no-key states | signed-in regular / admin-exhausted / shared-unconfigured ⇒ "View what's sent" works, produces export, no rec, no key | FE + BE |
| AC-24 | (e) `ai-rec-state-shared-unconfigured` | admin, no shared key, no own key ⇒ shared-unconfigured CTA, no rec, NO `ai-rec-free-uses`; DISTINCT from (a) and (c) | FE + BE |
| AC-25 | (e)→(d) | admin from (e) adds own key ⇒ produced on own key (d); shared-key absence never blocks an own-key user | FE + BE |
| AC-26 | (e)→(b) | from (e), shared key later configured ⇒ next rec produced on shared key + free-uses chip (b); no own key involved | FE + BE |

**Coverage check:** all 26 ACs mapped. Each AC = ≥1 named FE test (the QA AC↔test traceability rule);
the BE-only egress/byte-identical/metering ACs (AC-11, AC-14 score-proof, AC-16, AC-19, AC-20) are
proven by the backend lane's runtime + conformance proofs and are enumerated in the BACKEND contract.

---

## 8. Binding-framing restatement (what the copy must honor)
- **Honest, not a free trial** — states (a) and (e) frame BYO-key as a setup step; never "free trial".
  (c) frames the allowance as renewing daily, never gone forever. (PRODUCT_CONTRACT §6.)
- **Write-only key** — no reveal/show/copy affordance anywhere; masked last-4 at most (AC-7/10).
- **Server-side, never browser** — copy states the key is "stored encrypted… never leaves the server"
  and "never shown again"; the UI must never claim the key is retrievable (PROJECT_CONTEXT §8).
- **Regular users see no allowance language** — only the (a) CTA or, after BYO, the (d) chip. The
  free-uses chip and exhausted/unconfigured copy are admin-only.
- **Export floor honesty** — the egress note (shipped `COPY.export.egress`) already states no API key
  ever leaves; keep it verbatim (AC-13).
- **Score-byte-identical** — no key/identity/admin/count copy is ever derived from or feeds a score
  field; provenance chips read off `key_source` only (AC-14).
