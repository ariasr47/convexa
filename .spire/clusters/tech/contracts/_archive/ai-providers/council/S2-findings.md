# S2 — skeptic findings: ai-providers

Pass 2 (re-review after S2 pass 1 Critical + Important fold). Reviewed: `SPEC.md`,
`INTERFACE_CONTRACT.md`, `BRIEF.md`, `council/conflicts.json` (10/10), `council/decisions.md`
(D1–D6), R2-architect/pm/ux, pass-1 `S2-findings.md`. Method: re-walked the pass-1 Critical
(`preference.model = null` first-visit vs resolve Ask-enablement) first; walked every R2
`conflict_id` into SPEC **text** (not fold stamps); walked D1–D6 (D5 = no free uses / no
`shared_admin`); walked INTERFACE vs §2/§4; walked §4 states vs ACs. Cross-checked cited live
seams: `llm.rs` `ResolvedLlmKey`, `recommendation.rs` `resolve_llm_key`, `auth.rs` `AiKeyBody`,
`store.rs` `cred_key`, `migrations.rs` PK `(user_id, kind)`.

## §0

- **Produced:** `.spire/clusters/tech/contracts/ai-providers/council/S2-findings.md`
- **Decided:** Pass-1 Critical is gone (0 Critical). Do not loop to R4 on Ask-enablement. Four
  Importants remain and should be fixed before build.
- **Carry forward:** Situation A–D lock + resolve step 2 repaired the three-null Ask fork.
  Pass-1 Importants 1–8 are folded (Use-this-key, switch rule, no pool→BYO, pool label,
  exhausted/unlinked, no unvouched cheaper, `key_unusable`/`key_rejected`, POST rec in
  conformance). D5 deletion of `shared_admin` / free uses still stands — live
  `resolve_llm_key` still has that arm; that is build work, not a spec hole.
- **Unresolved:** SPEC §9.1 (xAI OAuth verification) and §9.2 (pool meter numbers), plus the
  four Importants below. No R2 conflict is parked in §9.

## Critical  (blocks — must loop back to R4)

None. Pass-1 Critical does **not** still contradict.

Re-checked the exact fork: first-visit / never-written / explicit-clear / `preference.model =
null` vs Ask-enablement vs AC-7 / AC-13 / AC-17. SPEC.md §2.3 now splits four situations.
Situation A persists the catalog recommended default on first settings/catalog read and
enables Ask **only if** a usable power path also exists; a `power_path`-null ask is setup-block
(`no_key` / pool-unavailable), **never** `model_missing` / `model_unset`. Situation B forbids
`ai_model: null` (422). Situation C (`power_path` set + stale id) is the only
`model_not_in_catalog` / AC-17 path. Situation D keeps a visible D4 name under AC-13.
"Active path while `power_path` is null: there is **no** active power path. Resolve must not
evaluate 'model invalid for active path.'" INTERFACE_CONTRACT.md GET `/api/auth/ai-key`
persists `ai_model` without writing `power_path`. PUT `/api/auth/settings`: "`null` is
forbidden (422)". POST resolve step 2: if `ai_power_path` is null → `key_source=none` +
`unavailable_reason=no_key`; **do not** evaluate model validity. Step 3 model gate runs
**only when** `ai_power_path` is set. AC-7 / AC-13 / AC-17 now agree with that order. The
three-null wire is no longer assigned opposite Ask-enablement.

D4's "Ask is enabled with a visible name" (`decisions.md`) is scoped, not reopened: the
recommended default **is** the selection (D1 still holds for a later-invalid *saved* id);
Ask still requires a power path. That is a fold, not remaining opposition.

## Important  (should fix)

- **Credential migration promotes the ciphertext and not `power_path`, so every existing BYO
  user becomes AC-13 unpowered while their key still shows set.** Live resolve today spends
  the own encrypted key with no preference triple (`recommendation.rs` `resolve_llm_key`:
  own key → `shared_admin` → `none`). SPEC.md §2.2 migration: "the existing single
  `kind="ai"` row promotes into the slot named by its stored `provider` (default
  `anthropic` if absent); other slots start empty" — no backfill of `ai_power_path` /
  `ai_provider`. SPEC.md §2.3: "`power_path` is written only by an explicit **power
  gesture**"; first-visit persist "**does not** write `power_path`." INTERFACE resolve step
  2 then yields `no_key` for `ai_power_path` null even when `providers[].set === true`.
  AC-13 copy is a setup block with a path to Settings, "not framed as free," and the BYO-empty
  sample is `Add an API key…` — while AC-1 still shows that provider **set** with a masked
  hint. Two builders will split: (1) follow the letter and brick every current Ask-AI user
  until they re-save or press Use-this-key; (2) invent a migration gesture the spec never
  names. Decrypt-fail on a promoted slot is also classified `no_key` (step 2 never reaches
  `key_unusable`) — "add a key" over "replace it." — evidence: SPEC.md §2.2 Migration;
  SPEC.md §2.3 "First-visit model preselect **does not** write `power_path`"; SPEC.md AC-1 /
  AC-13 / AC-16; INTERFACE_CONTRACT.md endpoint 7 step 2 + state→wire "`power_path` null →
  `no_key`"; `apps/api/src/services/recommendation.rs` `resolve_llm_key` own-key arm
  (lines 152–188).

- **Ask-AI consumes a model catalog the Ask-AI wire never promises, and "first Ask
  bootstrap" persist contradicts the side-effect-free status probe.** AC-6 requires changing
  the model from the closed catalog on Settings **or** Ask-AI. AC-7 requires the named
  default visible on the Ask setup block. SPEC.md §4: model options are "from server catalog
  only"; Ask-AI "visible model select bound to the same standing preference." Catalog arrays
  exist only on GET `/api/auth/ai-key`, described as "Settings bootstrap read." GET
  `/api/recommendation/status/{ticker}` is "**Side-effect-free**" and has `powering.model`
  (one id) but no `catalog.*`. SPEC.md §2.3 A: persist "on first settings/catalog read
  **(or first Ask bootstrap)**." If bootstrap is status, INTERFACE forbids the write. If
  bootstrap is GET ai-key, Ask-AI's documented reads (status + settings + POST rec) never
  say to call it — and until that call, `powering.preference.model` stays null while
  `powering.model` "may be D4-persisted," which is D6 drift between two fields on the same
  probe. A builder who implements Ask-AI from endpoints 6–7 either invents model ids
  (`digested-labels-not-raw-dump`) or ships an empty Ask picker that fails AC-6/7. —
  evidence: SPEC.md §2.3 A; SPEC.md §4 Ask-AI + Model control; SPEC.md AC-6 / AC-7 / AC-13;
  INTERFACE_CONTRACT.md endpoint 1 purpose sentence + first-visit persist; endpoint 6
  "Side-effect-free" + field list (no catalog); standing rule 8 (echoes, no drift);
  conformance status `required` (no `catalog.*`).

- **§4 still has no gesture that writes `power_path = pool_grok` after AC-11, so a connected
  trader who declined the pool cannot re-select it without unlinking.** In-scope promises
  "explicit **Use this path** gestures that write `power_path`." Pool writes only on
  **Connect** / OAuth callback (SPEC.md §4 flow 2.2; INTERFACE endpoint 5: "on success
  writes `ai_power_path = pool_grok`"). BYO writes on save or **Use this key** (AC-11). The
  Grok card default cell is three states only: "Connected + **active** when
  `power_path=pool_grok` + model + Disconnect **or** available disconnected + Connect **or**
  present-but-unavailable." There is no connected + inactive + Use-this-pool control.
  Disconnect when `power_path` is already `own_key` does **not** clear it ("If
  `ai_power_path` was `pool_grok`, clear it") — so the specified return path is unlink then
  Connect again. INTERFACE PUT settings *can* send `ai_power_path = pool_grok`, but §4 never
  names that control. After the defining two-path case (pool linked **and** a BYO slot set),
  one direction has a gesture and the other does not. — evidence: SPEC.md §1 In-scope
  "Use this path"; SPEC.md §4 flows 2.2–2.3 + Grok pool card default cell; SPEC.md AC-11;
  INTERFACE_CONTRACT.md endpoint 4 `ai_power_path` notes; endpoint 5 callback + DELETE
  `/api/auth/grok`.

- **Unpowered setup-block reason is `no_key` *or* `pool_unavailable` in SPEC §2.3 and only
  `no_key` on the wire contract — a remaining `absent-is-not-none` fork.** SPEC.md §2.3 A:
  "setup-block (`no_key` / pool-unavailable), **never** `model_missing`." SPEC.md §2.3 D:
  "`no_key` (or honest pool-unavailable when that is the only advertised fix)." SPEC.md §5
  and INTERFACE resolve step 2 / status / state→wire lock the same situation to
  `unavailable_reason=no_key` only. AC-15 scopes `pool_unavailable` to "**While
  `power_path = pool_grok`**." Two builders will emit different closed reasons for the same
  first-visit / never-gestured user on a deployment whose pool is down; FE copy keyed on
  `pool_unavailable` (pool-down sample) vs `no_key` (add-a-key sample) will not agree.
  Pass-1's enable-vs-block fight is gone; this is blocked-vs-blocked with opposite tokens.
  — evidence: SPEC.md §2.3 A + D; SPEC.md §5 "Ask with `power_path` null"; SPEC.md AC-13 /
  AC-15; SPEC.md §8 `absent-is-not-none`; INTERFACE_CONTRACT.md endpoint 6
  "setup-block uses `no_key` when `power_path` null"; endpoint 7 step 2; state→wire
  "`power_path` null → `no_key`."

## Minor / advisory

- **SPEC §2.3 switch rule has no third step for "new catalog has no recommended default."**
  INTERFACE PUT settings: keep if ∈ catalog; else persist recommended; **else** `ai_model`
  stays unset and Ask blocks `model_unset`. SPEC lists only (1) keep (2) write recommended.
  Empty-catalog is a named §4 state; the SPEC rule reads as if a recommended default always
  exists. — evidence: SPEC.md §2.3 switch rule vs INTERFACE_CONTRACT.md endpoint 4 model
  switch rule step 3.

- **First-visit persist makes GET `/api/auth/ai-key` a write.** Specified, but
  `storage_available: false` on that GET does not say whether `ai_model` stays null, the
  response still echoes a preview id, or the persist is retried. AC-18 only covers refusing
  a BYO key save. — evidence: INTERFACE_CONTRACT.md endpoint 1 persist paragraph +
  `storage_available`; SPEC.md AC-7 / AC-18.

- **`catalog.pool.provider` / `catalog.pool.models` are always required in conformance, but
  "Always `xai` when pool catalog is advertised" leaves the not-advertised shape unnamed**
  (empty models? still `xai`?). — evidence: INTERFACE_CONTRACT.md GET ai-key
  `catalog.pool.*` notes vs conformance `required`.

- **`byo_remove_confirm` is still a named §4 state with no confirm copy** (design direction
  only: "warning+icon confirm"). Success snackbars now have samples; the remove dialog does
  not. — evidence: SPEC.md §4 additional named states vs Copy samples.

- **An existing `openai_compatible` ciphertext still promotes into a non-trader slot and
  vanishes from the four-row matrix.** Called out as not a trader slot; still a migration
  edge for any `sk-or-` / explicit-compatible row. — evidence: SPEC.md §2.2 migration;
  `llm.rs` `detect_from_key`.

- **§4 model control does not say options are filtered to the active / preview catalog.**
  INTERFACE exposes `catalog.providers[]` + `catalog.pool` as separate allowlists. A union
  dropdown lets the trader pick an id that immediately trips AC-17 / `model_not_in_catalog`
  on the current path. §2.3 implies per-path catalogs; §4 only says "Options from server
  catalog only." — evidence: SPEC.md §4 Model for recommendations; INTERFACE_CONTRACT.md
  `catalog.providers` vs `catalog.pool`.

## Checked and clean

- **1. Dropped conflicts — clean (done first).** Walked all ten `conflicts.json` ids into
  SPEC body text, not only the footer receipt / HTML stamps:
  - `4a76e0e7…` / `001a6137…` / `a66d1978…` / `e4144d75…` / `767922d1…` (one-row store vs
    concurrent per-provider keys) → §2.2 names the live PK as **not** multi-slot (D2) and
    an explicit identity expansion `(user_id, kind="ai", provider)` (D3). Re-verified live
    `store.rs` `cred_key(user_id, kind)` and PG `PRIMARY KEY (user_id, kind)`
    (`migrations.rs` ~54). AC-1 / AC-20 keep concurrent set-state.
  - `731d5fa4…` / `0ec998f0…` / `9c1f8e7d…` (no silent catalog-default call) → §2.3
    situation C + AC-17: no LLM call; distinct choose-another-model; switch-rule preselect
    is carved out as D4-class, not D1.
  - `55f323ae…` (preselect named recommended default) → §2.3 A + AC-7 + §4 model control
    default cell + GET ai-key persist.
  - `cc6cda08…` (admin "free" copy vs pool) → owner D5 **removed** the path. §1, §2.4,
    AC-13, AC-19, INTERFACE standing rule 6, and closed `key_source` (`own_key` \|
    `pool_grok` \| `none`) all delete `shared_admin` / `remaining_free_uses` /
    `free_uses_total`. Stronger than the R2 proposal; not omitted.
  Footer receipt lists 10/10 `disposition: folded`. §9 holds only the two named opens
  (xAI OAuth verification; pool meter numbers) — no R2 conflict parked there.

- **D1–D6 walk (required by the seat; D5 = no free uses / no `shared_admin`).** D1 is
  situation C + closed `model_not_in_catalog` / `model_unset` (alias `model_missing` named).
  D2 (one-row fact) and D3 (owner chose multi-slot + matrix) are in §2.2 / §4. D4 is
  situation A + persist + AC-7, scoped so Ask still needs a power path. D5 is in §1, §2.4,
  AC-19, INTERFACE rule 6, rec `key_source`, and rejected approaches ("Keeping admin free
  uses alongside pool messaging"). D6 is §1 In-scope, §2.3 single writer / echoes, AC-6,
  INTERFACE rule 8 + endpoint 4 (no one-shot field). D1+D4 are no longer internally
  opposed — pass-1 Critical cleared, not dropped.

- **Pass-1 Importants — folded (not silently dropped).** (1) Use-this-key / Connect / save
  now write `power_path` (§4 + INTERFACE power-gesture notes). Reverse pool re-select is
  the new Important above, not the original hole. (2) Switch rule keep-or-write-recommended
  + AC-17 / AC-20 carve-out. (3) INTERFACE "(or pool declined)" parenthetical is gone; step
  4 never decrypts BYO on `pool_grok`. (4) Closed display label
  `key_source=pool_grok` → **Convexa Grok pool**. (5) `pool_exhausted` / `oauth_unlinked`
  have AC-14/15, §4 states, §5 rows, and copy samples. (6) No unvouched "cheaper" /
  "included" (§1, §4 copy rule 3, AC-9, INTERFACE "No vouched cost fields in v1"). (7)
  `key_unusable` vs `key_rejected` named in §2.4 / AC-16 / resolve step 5. (8) POST
  `/api/recommendation/{ticker}` is in the conformance JSON (`key_source` / `provider` /
  `model` / `unavailable_reason` / `status`).

- **Pass-1 Minors that were folded:** AC-25 now marked `(SB)`; `model_unset` restored and
  disambiguated from `model_not_in_catalog`; server **must not** retitle from
  `detect_from_key`; single-writer / echo rule for the three preference nestings; helper
  is "Connect Grok (while signed in)" not account login; signed-out status shape is
  specified (`key_source=none`, `unavailable_reason` null, preference null); pool meter
  declared distinct from `cap.over_limit`. Leftovers (`byo_remove_confirm` copy,
  `openai_compatible` vanish) stay Minor.

- **2. Unobservable ACs — clean.** Read AC-1–AC-30. Every row is checkable from Settings /
  Ask-AI / network bodies / ticker bundle / gate record. Review-gated SB rows (AC-9, AC-23,
  AC-24, AC-27) are UI / gate-record checks. AC-25 is checkable from bundle
  `opportunity_score` / `opportunity_tier` / `state_fingerprint` (conformance pins those
  paths). AC-2 never-echo is checkable from GET bodies + client storage. First-visit persist
  is checkable by a subsequent GET returning a non-null `preference.model` / `ai_model`.
  The remaining reason-token fork (Important) is a contradiction, not an inspect-the-source
  AC.

- **3. Unspecified component states — remainder.** The six-row §4 table fills default /
  loading / empty / error / offline-stale for Settings panel, BYO row, Grok card, model
  control, Ask-AI gate, provenance. Additional named states `anonymous`,
  `pool_available_disconnected`, `pool_connected`, `pool_unavailable`, `pool_exhausted`,
  `oauth_expired`, `oauth_unlinked`, `byo_set`, `byo_replace`, `model_catalog_empty`,
  `success` have behavior or samples. Holes that remain (connected+inactive / Use-this-pool,
  migration-unpowered-with-key-set, Ask-AI catalog empty because no read) are Important
  above — not silent TBDs in the five required columns.

- **4. Interface mismatch — remainder.** After the two INTERFACE-vs-§2/§4 Importants
  (Ask-AI catalog / persist; `no_key` vs `pool_unavailable`), no further conformance-field
  vs §2 type clash: matrix length 4, `last4` iff `set`, settings `theme` + `risk_inputs` +
  `ai_*`, status `powering.*` without free-use counters, POST rec provenance fields present,
  ticker bundle score paths untouched. `preference.model` nullability matches the persist
  lock. `key_source` vs `power_path` (`none` when blocked) matches the state table. No
  §4 field other than `catalog.*` on Ask-AI is consumed without a promised endpoint.

- **5. Internal contradiction — remainder.** Pass-1 Ask-enablement opposition is gone
  (see Critical = None). SuperGrok stays Out. OAuth blocked-on honesty (AC-27) matches
  §2.5 / §9.1. Score isolation matches AC-25 / §8. No remaining section-vs-section
  disagreement on D5 deletion, pool≠BYO label, or silent model substitute. The unpowered
  reason-token fork is the leftover contradiction (Important).

- **6. Guardrail breach — no additional SPEC-text violation of the named §8 list.**
  Checked each bullet: encrypt-at-rest / never-echo / write-only (AC-2, INTERFACE rule 2;
  live `AiKeySection` already write-only / masked last-4 / no reveal); server-side gates;
  score non-inputs (AC-25); rec-only isolation (AC-26); `no-real-order-path` (Accept stays
  SIMULATED); theme tokens / no new motion (AC-30); `cited-code-is-verified-not-assumed`
  (citations still match the tree — see below); `ai-asserted-numbers-are-traceable` (omit
  unnamed chips; AC-8 / AC-24); `digested-labels-not-raw-dump` now has a pool closed label.
  The `absent-is-not-none` residue is the unpowered `no_key`/`pool_unavailable` fork
  (Important), not a missing rule and not the pass-1 enable-vs-block collapse.

- **Cited live code (SPEC §2.1) — re-verified this pass, not assumed.**
  - `apps/api/src/services/llm.rs`: `ResolvedLlmKey.key_source` comment is still
    `own_key | shared_admin | none` (D5 deletion is real build work).
  - `apps/api/src/routes/auth.rs`: `AiKeyBody { key, provider: Option<String> }` — INTERFACE
    tightens `provider` to required closed BYO enum.
  - `apps/api/src/services/auth/store.rs` + `migrations.rs`: PK / map key is
    `(user_id, kind)` — one ciphertext. D2 fact still true.
  - `apps/api/src/services/recommendation.rs` `resolve_llm_key`: own decrypted key → admin
    shared env keys (`shared_admin`) → `none`; anonymous status still *advertises*
    `shared_admin` via `any_shared_key()`. Model is still env-default /
    `default_model`. Envelope still has `key_source` + null free-use fields and no
    provider/model that ran. Correctly specified as the thing this feature replaces.
