# byo-ai-key — PRODUCT CONTRACT

> PM (second, after the Architect). Scope: user stories, scope fences, product behavior, and
> acceptance criteria — every AC observable WITHOUT reading code, each AC a required behavioral test,
> each degraded/edge variation its OWN AC. NO code, no endpoint signatures, no JSON field names, no
> UI layout, no copy beyond intent (exact wording → UX). Derived strictly from the
> ARCHITECTURE_CONTRACT + BRIEF — does NOT re-scope. Where the Architect left a product question (§9),
> it is DECIDED below in "Product decisions made here" (owner said proceed).

## 0. Goal (one sentence)
Each signed-in user can store their own (encrypted) Anthropic key so the in-app AI recommendation runs
on their key at their cost; the shared server key — **OPTIONAL and possibly absent** — gives a small
free daily allowance to **admin users only when it is configured** (regular users get **0** and must
bring their own key), and the resulting states (no-key, admin-with-allowance, admin-exhausted,
shared-key-unconfigured, own-key) are each shown honestly and distinctly.

---

## 1. User stories
- **As a regular signed-in user without a key**, I want to be told clearly that the AI recommendation
  needs my own Anthropic key and where to add it — never silently doing nothing, never implying a free
  trial exists.
- **As any signed-in user**, I want to add / replace / remove my Anthropic key in Settings and see it's
  set without it ever being shown back to me, so I control my own credential.
- **As an admin**, I want a few free recs per day on the shared key (when the owner has configured one)
  without adding my own key, and to see how many I have left.
- **As an admin with my own key**, I want my calls to run on MY key first so I don't burn my free
  allowance — and to keep working even when no shared key is configured.
- **As any signed-in user with my own key**, I want recs on my key (un-metered against the shared
  allowance) with a subtle "using your key" confirmation.
- **As any signed-in user**, I want the manual export / copy-paste hand-off to keep working with no key
  at all — an always-available floor.
- **As the owner**, I want the app to behave honestly when I have NOT configured a shared key (the
  common case today), never offering a free allowance that can't actually run; and I want my server key
  (once set) never spent by non-admins, and every stored user key encrypted at rest and never exposed
  to any browser, log, or response.

---

## 2. Scope

### In scope
- Per-user own-key storage: **add / replace / remove**, in the existing Settings surface as a new
  "AI key" section.
- A **masked, write-only** key model: Settings shows that a key is set plus a last-4 hint; never the
  full key; no "show key" action.
- Per-request key resolution on the in-app AI recommendation: own key → else admin shared allowance
  (only when a shared key is configured) → else no usable path, with **own-key-first even for admins**.
- A **minimal admin concept** (an allowlist) governing the shared free allowance ONLY.
- **Per-identity metering** of the shared allowance (default **3/day per admin**), separate from
  own-key calls (which are not metered against the shared allowance).
- The five honest states (a–e below), each distinctly shown; an admin **remaining-free-uses**
  indicator (shown ONLY when a shared key is configured; a regular user never sees a free-use counter).
- Honest handling of an **absent shared key**: the admin free allowance is offered/decremented only
  when a shared key is configured.
- Preserving the existing manual export floor for any signed-in user with no key.

### Out of scope (this feature)
- Any general roles / permissions / scopes / admin UI / admin management screen
  (`minimal-admin-not-RBAC` — the admin concept exists only to grant the shared free allowance).
- Revealing or reading back a stored key in any form beyond the masked last-4 hint.
- A persistent credential store (stored keys reset on restart — accepted prototype, mirrors accounts).
- Any provider other than Anthropic.
- In-app LLM reassessment, token streaming, acceptance/outcome analytics, vendor/model swap (the
  separately-deferred ai-rec seams).
- Any real-order / broker path (`no-real-order-path` unaffected — Accept stays SIMULATED + confirm).
- The full credential-custody red-team (`system-6`) — DEFERRED by owner (see §6 / §7).

### Future-dated (named, not built)
- Allowing an admin to *prefer* the shared key while holding their own (this phase: own-key-first, no
  override — §3 decision 8).
- Per-user own-key usage analytics / spend visibility.
- A persistent encrypted credential store + the system-6 red-team pass at the go-live trigger.

---

## 3. Product decisions made here (resolving the Architect's 9 open questions)

1. **State copy intent** (exact wording → UX; intent fixed here). **The shared server key is OPTIONAL
   and may be absent — it is NOT configured today** — so the admin free allowance is only real when a
   shared key is present; this adds a fifth state (e), distinct from (c):
   - **(a) regular, no key, 0 allowance** — an empty/CTA state on the AI-rec surface: "AI
     recommendations need your Anthropic key — add it in Settings." Framed as a **setup step, NOT a
     free trial**; no free-use counter; offers a path to Settings. No recommendation is produced.
   - **(b) admin, shared key configured, allowance remaining** — a normal recommendation PLUS a subtle
     remaining-count indicator, intent "N of 3 free uses left today." Subordinate to the rec, not a
     headline.
   - **(c) admin, shared key configured, allowance exhausted, no own key** — an unavailable state
     distinct from (a): intent "you've used today's 3 free recommendations — add your own key in
     Settings to continue." No recommendation. (Implies a daily reset; the surface need not promise an
     exact reset time, but must not imply the free uses are gone forever.)
   - **(d) any user with own key** — a normal recommendation PLUS a subtle "using your key" indicator;
     no free-use counter (own-key calls have none).
   - **(e) admin, NO shared key configured, no own key** — an unavailable CTA state (admin-flavored):
     intent "the shared AI key isn't configured — add your own key to use recommendations." It
     effectively falls through to the BYO-key CTA. It shows **NO "N of 3 free uses" counter** and
     **decrements nothing** (those uses cannot run). It is **distinct from (c)**: (c) = allowance used
     up while a shared key IS present; (e) = there is no shared key to run any free use against. No
     recommendation is produced.
   - The **manual export / hand-off floor stays available to every signed-in user with no key**
     (CONFIRMED).

2. **Masked-reveal UX** — the stored key is **write-only**. Settings shows "Key set" plus a last-4
   hint (intent "•••• 1234") and the actions **Replace** and **Remove**. The full key is never shown;
   there is **no "show key" action** (the server cannot return it). Entering a new key **overwrites**
   (replace == overwrite, no history). **Remove** deletes the stored key. With no key set, Settings
   shows an empty "Add your Anthropic key" state.

3. **Allowance number + env-name intent** — admin free allowance default **3/day per admin**,
   env-tunable, **and gated on a shared key being configured** (no shared key ⇒ no usable allowance,
   state (e)). This allowance **composes with — does not replace** — the existing `ai_eval` gate and
   the existing cooldown: those still apply on the shared-key path; the allowance is an **additional
   precondition on the shared-key path ONLY**. (Literal env-name strings are an executioner concern;
   PM fixes only that the allowance, the admin allowlist, and the encryption secret are each their own
   server-side config, the allowance distinct from today's global cap.)

4. **Settings placement** — key entry lives **inside the existing per-user Settings surface** as a new
   "AI key" section. Not a separate page and not on the AI-rec surface itself (which only points to it).

5. **Admin remaining count** — the AI-rec surface exposes an admin's **remaining free uses** in
   state (b) and the exhausted message in state (c). It shows **no counter** in state (e) (no shared
   key — those uses can't run). A **regular user never sees a free-use counter** or any allowance
   language — only the "connect your key" CTA (a) or, once they add a key, a normal rec (d).

6. **Wire status vocabulary** — the **admin-allowance-exhausted** state (c) is a **distinct** observable
   status from the regular-no-key state (a) and from the existing global/own cap reasons. The
   **shared-key-unconfigured admin** state (e) is **also a distinct** observable status from both (a)
   no_key and (c) exhausted (intent value e.g. `shared_key_unconfigured`), so UX can render its
   admin-flavored "shared AI key isn't configured — add your own key" CTA. The per-admin remaining
   count is carried only for admins, only when a shared key is configured. (Exact status strings +
   field names are executioner-internal; PM fixes that a/c/e are observably distinguishable and that a
   regular user is never shown a remaining count.)

7. **Own-key cooldown** — own-key users **keep a per-identity cooldown** (the anti-over-trading
   rationale, CONTEXT §5), applied per-identity so one user's calls never cool down another's. Own-key
   calls are **never blocked by a shared counter** — only by their own cooldown / the `ai_eval` gate.

8. **Admin own-key preference** — **own-key-first, no override this phase** (Architect default
   CONFIRMED). An admin holding their own decryptable key runs on their key and **does not** spend the
   free allowance, **regardless of whether a shared key exists**. "Admin prefers shared while holding
   own" is Future-dated.

9. **Endpoint shape & field names** — out of PM lane; behavior is fixed by the ACs below (write-only
   set/replace/remove, masked-hint read, the five observable states). Signatures + field names are the
   executioners'.

---

## 4. Product behavior — the five states (precedence is observable order)

Resolution order, for a **signed-in** user (the existing auth gate is outermost and unchanged — §6):
**own decryptable key → else (admin AND shared key configured AND allowance left) → else no usable
path.** Note the admin shared path now has a precondition order: *is a shared key configured?* gates
*has the admin allowance left?* Exactly one state shows per request:

| State | Who / condition | Produces a rec? | Key used | What the user sees (intent) |
|---|---|---|---|---|
| (a) | regular user, no own key | No | none | "connect your key" CTA → Settings; **no free-use counter** |
| (b) | admin, shared key configured, allowance remaining | Yes | shared server key | normal rec + subtle "N of 3 free uses left today"; count **decrements** after a produced rec |
| (c) | admin, shared key configured, allowance exhausted, no own key | No | none | "out of free uses — add your key" (distinct from (a)); **no rec** |
| (d) | any user with own key | Yes | their own key | normal rec + subtle "using your key"; **no free-use counter**; not metered against the shared allowance |
| (e) | admin, NO shared key configured, no own key | No | none | "the shared AI key isn't configured — add your own key" (admin-flavored, distinct from (a) and (c)); **no counter, decrements nothing**; **no rec** |

**Transitions (observable):** a regular user who adds a key → a→d. An admin who adds a key → b/c/e→d
and **stops spending** the free allowance. Removing a key → d→a (regular), or d→b/c (admin, shared key
present, per remaining allowance), or d→e (admin, no shared key). Consuming the last free unit → b→c.
The daily reset → c→b. Configuring the shared key (admin had none) → e→b (allowance becomes usable).
Removing the shared key → b/c→e.

Every state is **best-effort and returns successfully (HTTP 200 + a status)** — never a 5xx. The
existing `ai_eval` gate (fresh-edge) and cooldown remain orthogonal and unchanged: a gated /
cooling-down surface shows its own existing state, independent of key source.

---

## 5. Acceptance criteria (each observable without reading code; each a required test)

> Conventions: "produces a rec" = the AI-rec surface shows a recommendation artifact for the current
> ticker. "No rec" = the surface shows the named unavailable/CTA state and no recommendation. Every AC
> below is a **signed-in** user EXCEPT AC-22 (logged-out, unchanged). "Egress" ACs are observable at
> the network/log boundary without reading source.

### Core states
- **AC-1 (regular, no key → CTA, no counter)** — A signed-in regular user (not on the admin allowlist)
  with no stored key requests a recommendation. The surface shows the **"connect your Anthropic key —
  add it in Settings"** state, produces **no recommendation**, and shows **no free-use counter** and no
  allowance language. It is **not** framed as a free trial.

- **AC-2 (admin, shared key configured, allowance left → rec + count decrements)** — A signed-in admin,
  with a shared key configured and free uses remaining and no own key, requests a recommendation. The
  surface produces a recommendation AND shows a remaining-free-uses indicator (intent "N of 3 left
  today"). After a produced rec, the next observed remaining count is **one lower**.

- **AC-3 (admin, shared key configured, exhausted → distinct exhausted state, no rec)** — A signed-in
  admin who has used all free uses for the day (shared key configured) and has no own key requests a
  recommendation. The surface shows the **"out of free uses — add your key"** state, produces **no
  recommendation**, and this state is **observably distinct** from the regular-no-key CTA (AC-1).

- **AC-4 (own key → rec on own key, own-key indicator)** — A signed-in user with a stored, valid key
  requests a recommendation. The surface produces a recommendation, shows a subtle **"using your key"**
  indicator, and shows **no free-use counter**.

- **AC-5 (own-key-first for admins — does not burn the free 3)** — A signed-in admin who has stored
  their own key (shared key configured) requests a recommendation. The rec runs on **their own key**
  (own-key indicator, AC-4), and the admin's remaining free-use count is **unchanged** by that call.

- **AC-6 (non-admin with a key gets recs)** — A signed-in **regular** user (not an admin) who adds a
  valid key requests a recommendation and **gets a recommendation** (own-key path, AC-4) — proving the
  feature is usable by regular users via BYO key, not gated to admins.

### Shared-key-absent states (the owner requirement: the shared key is optional / not set today)
- **AC-24 (admin, NO shared key configured, no own key → shared-key-unconfigured CTA, no rec, no
  counter)** — A signed-in admin (on the allowlist, free allowance nominally remaining) with no own key
  requests a recommendation while **no shared key is configured**. The surface shows the admin-flavored
  **"the shared AI key isn't configured — add your own key"** CTA, produces **no recommendation**, and
  shows **no free-use counter** and decrements nothing. This state is **observably distinct** from the
  regular-no-key CTA (AC-1) and from the admin-exhausted state (AC-3).

- **AC-25 (that admin then adds their own key → recs work on their key)** — The admin from AC-24 adds
  their own valid key in Settings, then requests a rec: they **get a recommendation on their own key**
  (own-key path, AC-4) — the shared key's absence never blocks an own-key user (admin or not).

- **AC-26 (shared key later configured → admin free allowance becomes usable)** — Starting from the
  AC-24 condition (admin, no own key, no shared key), once a shared key is configured the same admin's
  next rec request **produces a recommendation on the shared key and shows the remaining-count
  indicator** (state (b), AC-2) — i.e. e→b. No own key is involved.

### Key management (write-only, masked)
- **AC-7 (add key → set, masked hint)** — In Settings' AI-key section, a signed-in user with no key
  adds a key. Settings then shows the key is **set** with a **last-4 hint**, and the **full key is
  never shown** anywhere in Settings (no reveal action exists).

- **AC-8 (replace key → overwrites, new hint)** — A user with a key set enters a different key in
  Settings. The stored key is **overwritten** (the displayed last-4 hint reflects the **new** key), and
  subsequent recommendations use the new key. No history of the old key is shown or recoverable.

- **AC-9 (remove key → back to role default)** — A user with a key set removes it in Settings. Settings
  returns to the empty "add a key" state. A regular user's next rec request then shows the CTA (AC-1);
  an admin's falls back per shared-key presence (AC-2 / AC-3 with a shared key, AC-24 without one).

- **AC-10 (key never returned to the browser)** — At no point does any response, settings read, or
  AI-rec call return the full stored key to the browser. Inspecting the network responses for the key
  flows shows at most the masked last-4 hint and the "set" indicator — **never** the raw key.

### Egress / security floor (observable at the boundary)
- **AC-11 (key never logged)** — Adding, replacing, using, or removing a key produces **no log line,
  error, trace, or observability field containing the raw key** (and the stored ciphertext is treated
  as secret too — not logged). A log scan across these flows finds no key material.

- **AC-12 (key never reaches the browser on the rec path — egress check)** — When a recommendation is
  produced on a user's own key (AC-4), the request/response traffic to the browser carries the
  recommendation and status only; the **user's API key never appears** in any payload sent to the
  browser. (Resolution + decryption stay server-side.)

- **AC-13 (export floor carries no key / no identity)** — The manual export / hand-off artifact carries
  the computed context + persona prompt + glossary only. It contains **no API key**, no other ticker,
  no user identity, and no order data.

### Score / isolation invariants
- **AC-14 (score + state_fingerprint byte-identical regardless of key path)** — For the same ticker and
  inputs, `opportunity_score`, `opportunity_tier`, the entry gate, and `state_fingerprint` are
  **byte-identical** across: anonymous, regular-no-key, admin-with-allowance, admin-exhausted,
  admin-shared-key-unconfigured, and own-key. The key source, admin status, shared-key presence, and
  remaining count are **never** a scoring input.

- **AC-15 (a rec-surface failure degrades the rec surface ALONE)** — When the key lookup, decryption,
  the LLM call, or the over-limit/exhausted/unconfigured path fails or is unavailable, the AI-rec
  surface shows a **contained status** (no_key / over_limit / shared_key_unconfigured / unavailable) and
  the call still **succeeds (HTTP 200), never 5xx**; the bundle, SSE stream, GEX chart, and ghost-trade
  tracker keep rendering the last data, untouched.

### Degraded / edge cases (each its own AC — these are the test cases)
- **AC-16 (decrypt failure on a stored key → unavailable, not a rec, not 5xx)** — A user has a stored
  key that cannot be decrypted (e.g. the server encryption secret changed / key material unrecoverable).
  The rec request returns an **unavailable** status (treated like no usable key — a regular user the
  CTA, an admin the allowance / shared-key-unconfigured fallback), **not** a recommendation and **not**
  a 5xx, and no raw/ciphertext key is leaked in the response or log.

- **AC-17 (LLM failure / timeout on the chosen key → unavailable status only)** — The downstream LLM
  errors or times out on whichever key was resolved (own or shared). The surface shows an unavailable
  status (existing timeout/error vocabulary), the call returns 200, the bundle/SSE/chart/tracker are
  intact, and — for a **shared-key** call — a free use is **not** consumed (count only decrements on a
  produced rec).

- **AC-18 (encryption secret absent → graceful, no crash)** — With the server-side encryption secret
  not configured, the app does **not crash**. Adding a key still behaves gracefully (the chosen
  config-gated behavior: either keys are accepted under an ephemeral per-process secret that resets on
  restart, or the key flow is cleanly unavailable) — exact absent-UX is UX's to word, but the surface
  is honest and never errors out (5xx) and never exposes a key.

- **AC-19 (admin removed from allowlist → loses free allowance, keeps own key)** — A user no longer on
  the admin allowlist requests a rec: they no longer get the shared free allowance (a regular user with
  no key sees the CTA, AC-1). If they have their own key, they still get recs on it (AC-4) — own-key
  access does not depend on admin status.

- **AC-20 (store reset on restart → keys gone, graceful)** — After a server restart, previously stored
  keys are **gone** (in-memory prototype). A user who had a key now sees the no-key behavior for their
  role (CTA / allowance / shared-key-unconfigured fallback), with no error and no stale "set" hint
  implying a key that is gone.

- **AC-21 (exhausted admin adds a key mid-day → immediately gets recs, count untouched)** — An admin in
  the exhausted state (c) adds their own key in Settings, then requests a rec: they **immediately get a
  recommendation** on their own key (AC-4), and their (already-zero) free count is not affected (the
  c→d transition).

- **AC-22 (logged-out is unchanged — auth gate outermost)** — A logged-out visitor who triggers the
  ask-AI path sees the existing **"sign in"** prompt (the auth gate, 403/503) — **never** a no_key /
  over_limit / exhausted / shared-key-unconfigured state, never a key prompt. The **manual export floor
  stays available to anonymous** users, unchanged.

- **AC-23 (manual export floor works with no key, any signed-in user)** — A signed-in user with no
  stored key (regular, admin-exhausted, or admin-shared-key-unconfigured) can still use the **manual
  export / hand-off** with no key required — it produces the export artifact with no recommendation and
  no key.

---

## 6. Product-level constraints the next role MUST NOT violate
- **The five states must be observably distinct.** In particular (a) regular-no-key ≠ (c)
  admin-exhausted ≠ (e) admin-shared-key-unconfigured — different copy, different intent (setup step vs
  spent-allowance vs no-shared-key-exists). Never frame (a) or (e) as a free trial.
- **A regular user never sees a free-use counter or allowance language** — only the CTA (a) or a normal
  rec once they BYO (d).
- **No free-use counter is shown when no shared key is configured** (state (e)) — those uses cannot run,
  so nothing is offered or decremented; the admin falls through to a BYO CTA.
- **The stored key is write-only.** No surface reveals or reads back the full key — masked last-4 hint
  at most. No "show key" affordance.
- **Own-key-first, including for admins** — holding a key runs on that key, does not spend the free
  allowance, and works **even when no shared key is configured**.
- **The shared free allowance is an ADDITIONAL precondition on the shared-key path only** — gated on a
  shared key being configured, and composes with (does not replace) the existing `ai_eval` gate +
  cooldown.
- **Every rec outcome is best-effort: HTTP 200 + status, never 5xx.** A failure / unconfigured-shared-key
  degrades the rec surface alone; bundle / SSE / chart / tracker stay intact.
- **The manual export floor stays available** to any signed-in user with no key (and to anonymous,
  unchanged).
- **`[additive-keeps-score-byte-identical]`** — no credential, identity, admin flag, shared-key
  presence, or counter is ever a scoring input; score / tier / gate / `state_fingerprint` byte-identical
  across all key paths.
- **`[no-real-order-path]`** — unaffected; Accept-into-tracker stays SIMULATED + mandatory confirm.

### Security floor (HARD — restated; enforced structurally by the executioners)
- User keys are **ENCRYPTED at rest** (decryptable, NOT hashed — they must recover to call Anthropic),
  keyed by a **server-side, gitignored** secret read only inside the crypto helper.
- The raw key is **NEVER logged** (no log line / exception / trace / observability field; ciphertext
  treated as secret too), **NEVER returned in any response**, **NEVER sent to the browser**.
- Resolution + decryption stay **server-side**; the decrypted key lives only transiently for one call,
  is never cached where a response reaches it, and never enters the export floor (CONTEXT §8 egress
  invariant).
- Write-only from the client (masked hint only); rotate == overwrite; delete supported.

### Orchestrator note (NOT a PM deliverable)
- **`system-6` Security / red-team is DEFERRED by owner** — the encrypt + hygiene floor above ships
  now; the full credential-custody red-team re-fires at the persistent / multi-user / public go-live
  trigger. (A GATE-S note for the Orchestrator, recorded here for traceability.)

---

## 7. Bounce log + interface notes (for the Architect / executioners)
- **No ARCHITECTURE amendment required.** The Architect's locked envelope supports every product
  outcome above without narrowing scope.
- **Interface note — shared-key-absent state (e):** the owner clarified the shared `ANTHROPIC_API_KEY`
  is **optional and not configured today**, so the admin free allowance is only real when a shared key
  is present. This adds a fifth outcome state (e) — admin with allowance nominally remaining but **no
  shared key configured** → no usable free path → an admin-flavored BYO CTA, **no counter shown, nothing
  decremented**, distinct from (c) exhausted and from (a) no_key. This is **the existing
  `ANTHROPIC_API_KEY`-absent ⇒ `unavailable:no_key` config-gating pattern (shipped ai-rec; CONTEXT
  §7/§8) lifted to the shared-key level for the admin path** — reuse that always-200, best-effort
  behavior (never 5xx, bundle/SSE intact). The executioners should give it a **distinct rec-endpoint
  status value** (intent `shared_key_unconfigured`), separate from `no_key` (regular, no own key) and
  the admin-exhausted status. Own-key-first is unaffected — any user (admin included) with their own key
  produces recs regardless of whether a shared key exists; regular users (0-free / BYO) are unaffected.

---

## UX / Tech-Writer handoff (compressor #2 — 5 bullets)
1. **Author 5 distinct copy blocks for the AI-rec surface**, one per state §4: (a) regular-no-key CTA
   "needs your Anthropic key — add in Settings" (setup step, **NOT a free trial**, no counter); (b)
   admin remaining-count "N of 3 free uses left today" (subtle); (c) admin-exhausted "out of free
   uses — add your key" (**reads differently from (a)/(e)**, not gone-forever); (d) own-key "using your
   key" (subtle, no counter); (e) admin-no-shared-key "the shared AI key isn't configured — add your
   own key" (**admin-flavored BYO CTA, no counter**, distinct from (a) and (c) — this is the common case
   today since no shared key is set). A regular user never sees allowance copy. (AC-1/2/3/4/5/6/24.)
2. **A new Settings "AI key" section** inside the existing per-user Settings: empty "add a key" state, a
   **write-only set state showing last-4 only** with Replace + Remove, **no reveal/show action**; word
   the absent-encryption-secret state honestly. (AC-7/8/9/18.)
3. **Each degraded / transition state needs its own copy** (separate tests): decrypt-failure →
   unavailable (AC-16), LLM error/timeout → unavailable (AC-17, reuse existing ai-rec timeout/error
   wording), store-reset → no stale "set" hint (AC-20), admin-dropped-from-allowlist → CTA unless own
   key (AC-19), and the (e) transitions — admin adds own key from (e)→recs (AC-25), shared key later
   configured (e)→(b) (AC-26).
4. **Hard floors to carry into the "Tests to write" matrix**, not just copy: key never
   shown/returned/logged/browser-sent (AC-10/11/12), export floor carries no key/identity and works
   keyless for any signed-in user incl. state (e) (AC-13/23), logged-out hits the existing sign-in gate
   not a key state (AC-22), score/`state_fingerprint` byte-identical across all key paths incl. (e)
   (AC-14), a failure / unconfigured-shared-key degrades the rec surface alone (AC-15).
5. **No copy may invent product behavior**: own-key-first (admins don't burn the free 3, and own-key
   works with no shared key), the allowance is shared-key-path-only + gated on a shared key being
   configured + composes with the existing gate/cooldown, 0 free for regulars, write-only key, no admin
   UI beyond the env allowlist. Exact env-name strings + endpoint/field names (incl. the
   `shared_key_unconfigured` status value) are the executioners'; UX owns wording + per-state surface
   treatment only.
