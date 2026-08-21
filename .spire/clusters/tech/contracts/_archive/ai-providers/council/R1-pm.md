# R1 — pm position: ai-providers

## Position

### 0. The product problem in one sentence

A signed-in trader can ask for an in-app AI recommendation without ever seeing **which provider**
and **which model** will (or did) produce the plan they may size — and today's Settings "AI key"
surface only speaks Anthropic. The owner-asked fix is: power Ask-AI via **(1)** a personal API key
for Anthropic, OpenAI, Gemini, or Grok/xAI, **or preferentially (2)** Grok OAuth onto **Convexa's
cheaper Grok sub-pool**, and on **every** powered path the trader must **choose a specific named
model** before asking. Acting on an unnamed model, or paying full BYO when a cheaper Convexa Grok
pool was the intended default, is the failure this feature exists to prevent.

---

### 1. What ships

A **redesign of how the trader powers and names** in-app AI recommendations:

1. **Multi-provider BYO keys** for the closed set **Anthropic · OpenAI · Gemini · Grok/xAI** —
   add / replace / remove, write-only, masked hint only, never echoed.
2. **Preferred path:** sign in with Grok (OAuth) and spend **Convexa's Grok sub-pool** when that
   path is available — offered as the cheaper default, never forced if the trader prefers BYO.
3. **Mandatory model choice** on every powered path — Settings and Ask-AI show a **named provider**
   and a **named model** before a recommendation is requested; no invisible env default the trader
   cannot see or override.
4. **Provenance** on a produced recommendation names the **provider and model that actually ran**.
5. **First-class degraded states** that do not collapse into one another: signed-out · no powering
   path · OAuth expired · pool unavailable · bad/rejected key · model missing from catalog ·
   storage unavailable · (legacy) admin shared-allowance states kept distinct from the Grok pool.

Score / tier / fingerprint stay byte-identical. Manual export / copy-paste hand-off remains the
always-available floor. Accept stays SIMULATED.

---

### 2. Scope

#### In

1. **Settings powering surface redesign** — replace the Anthropic-only "AI key" panel with a
   surface where a signed-in trader can:
   - choose among the closed provider set for BYO keys;
   - add / replace / remove a key per chosen BYO provider (write-only; masked last-4-style hint;
     no reveal / show / copy of the secret);
   - connect / disconnect **Grok OAuth → Convexa Grok sub-pool** when that arm is available;
   - choose and persist a **specific model** for the active powering path from a closed catalog
     the product surfaces (not inferred from the key string).
2. **Ask-AI surface honesty** — before a rec is requested, the trader can see the **named
   provider + named model** that will be used (or an explicit blocked state naming why Ask-AI
   cannot run). After a produced rec, provenance names the provider + model that **actually** ran.
3. **Preferred-path behavior** — when Grok OAuth + Convexa pool is available for this trader, that
   path is **offered and preferred as cheaper** than a personal xAI/Grok BYO key; the trader can
   still choose any BYO provider+key+model instead.
4. **Distinct powering / failure states** (each its own observable outcome — see §3 and ACs):
   signed-out; no usable powering path; Grok OAuth connected + pool usable; OAuth expired; pool
   unavailable; BYO key set + usable; bad/rejected key; model missing / not in catalog; key
   storage unavailable; legacy admin shared-allowance remaining / exhausted / shared-key
   unconfigured — **renamed in product language** so they are never confused with the Convexa
   Grok pool.
5. **Preservation** — auth gate outermost on Ask-AI; manual export floor for anyone (including
   signed-out / no-key); cooldown / fresh-edge gate / daily own-path caps that already exist remain
   orthogonal; encrypt-at-rest / never-echo floors; score / tier / fingerprint untouched.

#### Out

1. **SuperGrok / "use my xAI subscription instead of a key"** — a different product. Owner asked
   for **log in with Grok to spend Convexa's cheaper pool**, not pass-through of a personal
   SuperGrok subscription.
2. **Providers outside the closed set** (Claude-via-Bedrock, Azure OpenAI as a separate vendor
   brand, local models, etc.).
3. **Per-request model override that is not persisted** as a standing preference — model choice is
   a durable trader preference for the active path, not a one-shot hidden query param the Settings
   surface never shows. (A future "try this model once" is Future-dated.)
4. **Spend dashboards / invoice / token metering UI** for BYO keys (vendor bills the trader).
5. **Admin RBAC / roles UI** — the minimal admin allowlist for the legacy shared Anthropic
   allowance stays as shipped; this feature does not build admin management.
6. **Reassessment LLM path, token streaming, acceptance analytics** — deferred ai-rec seams,
   unchanged.
7. **Any real-order / broker path** — Accept remains paper-sim + confirm.
8. **Inventing an xAI OAuth protocol from third-party blogs** — mechanism is architect-owned; if
   the pool arm cannot be built honestly this round, that is an R2 technical conflict, **not** a
   silent drop of the preferred path from product intent.
9. **Copy / layout / component APIs** — UX owns wording and arrangement; this position binds
   observable states and required distinctions only.
10. **Changing the AI's asserted-number grounding / absence / plan-scope honesty** — already
    shipped; provenance may name provider/model but must not invent a check the rec did not run.

#### Future-dated (named so they are not absorbed)

- One-shot "try this model for the next ask only" without changing the saved preference.
- Per-provider usage / estimated-cost visibility for BYO keys.
- Trader preference to keep Grok OAuth connected but **prefer BYO xAI** as default (today:
  pool-preferred when available; BYO remains selectable).
- Expanding the closed provider set.
- SuperGrok subscription pass-through (explicitly a different product — see Out).
- Reassessment / streaming powered by the same multi-provider + model choice.

---

### 3. Product behavior

**Closed vocabulary (product labels, not wire names):** powering providers the trader can name are
exactly **Anthropic · OpenAI · Gemini · Grok**. Model labels come from a **closed catalog per
path** (BYO provider catalog vs Convexa Grok pool catalog). The UI must **not** guess the provider
from the shape of a pasted key string — the trader selects the provider label first.

**Active powering path (one at a time for Ask-AI):**

| Situation | What the trader sees / can do |
|---|---|
| **Signed-out** | Ask-AI shows the existing sign-in gate only — never cooldown, cap, no-key, pool, or model states. Settings AI powering section prompts sign-in; no secret can be saved. Manual export still works. |
| **Signed-in, no BYO key, Grok OAuth not connected, no legacy admin shared path** | Ask-AI shows a **setup** blocked state: need a powering path — prefer Grok pool when offered, else add a BYO key — and a path to Settings. **No recommendation.** No free-trial framing. |
| **Grok OAuth available to connect (pool arm live on this deployment)** | Settings offers **Connect with Grok** as the **preferred / cheaper** path, clearly distinct from "add a personal Grok/xAI API key." |
| **Grok OAuth connected + Convexa pool usable + model chosen** | Ask-AI can run on the pool. Surface shows named provider (**Grok / Convexa pool** intent) + named model before ask. Produced rec provenance names that provider+model. |
| **Grok OAuth connected but OAuth expired / revoked** | Distinct blocked state: connection expired — reconnect or switch to a BYO key. **Not** collapsed into "no key" or "pool unavailable." No rec. |
| **Grok OAuth connected but Convexa pool unavailable** (quota, not configured, deployment off) | Distinct blocked state: pool unavailable — try later or use a BYO key. **Not** collapsed into OAuth-expired or no-key. No rec. |
| **BYO key set for a chosen provider + model chosen from that provider's catalog** | Ask-AI can run on the trader's key. Before ask: named provider + named model. After: provenance matches. Subtle "using your key" honesty remains (generalized beyond Anthropic-only). |
| **BYO key rejected as bad / unusable at ask time** | Distinct failure on the Ask-AI surface: key was rejected — replace key in Settings. Prior pinned rec (if any) is not silently rewritten. Bundle / rest of dashboard intact. |
| **Saved model no longer in the catalog for the active path** | Distinct blocked state: chosen model unavailable — pick another model from the current catalog before asking. Does **not** silently fall back to a hidden default. |
| **Key storage unavailable on this deployment** | Settings cannot accept a new key (inputs inert or explicitly blocked). Copy intent: storage isn't set up; manual export still works. Distinct from "you have no key." |
| **Legacy admin shared Anthropic allowance remaining** | Still produces a rec when that path is the one that resolves, with remaining-count honesty — but product language must **not** call this the "Convexa Grok pool." Distinct label (e.g. admin shared allowance). |
| **Legacy admin shared allowance exhausted / shared key unconfigured** | Keep today's distinct exhausted vs unconfigured outcomes; CTA toward BYO (now multi-provider) and/or Grok pool when available. |
| **Model not yet chosen** (provider/path ready, model empty) | Ask-AI / Settings block the ask until a specific model is selected. Never "we'll pick one for you" without naming it. |
| **Trader switches provider, path, or model** | The newly selected named provider + model become what Ask-AI will use on the next ask; Settings and Ask-AI agree on the same names. |
| **Cooldown / fresh-edge gate / daily cap** (existing) | Unchanged and **orthogonal** — shown only after a usable powering path exists; never substitute for signed-out or powering failures. |
| **LLM / transport failure after a valid path** | Existing best-effort unavailable + Retry; does not blank the dashboard; does not leak secrets. |
| **Score / tier / fingerprint** | Identical whether the trader uses pool, BYO Anthropic, BYO OpenAI, etc. Provider and model are never scoring inputs. |

**Precedence intent (observable, not an algorithm dump):** for a signed-in trader, Ask-AI uses
exactly one resolved path per ask: **usable Convexa Grok pool (when that is the trader's selected /
preferred active path) → else usable BYO key for the selected provider → else legacy admin shared
allowance when that still applies → else blocked with the matching distinct reason.** Own BYO key
still beats burning a legacy admin shared allowance when the trader has a usable BYO key (preserve
shipped own-key-first for that legacy arm). The trader's **explicit selection** of pool vs BYO
provider is the product control; "preferred" means the pool is the default offer when available,
not that BYO is disabled.

**What provenance may assert:** the closed provider label and model label that produced this rec
(and existing persona / as-of / SIMULATED honesty). **What it must not assert:** that the model
"verified" anything, that a check ran which did not, or any secret material.

---

### 4. User stories

- **US-1** — As a signed-in trader, I want to power Ask-AI with **my own** Anthropic, OpenAI,
  Gemini, or Grok/xAI key, **so that** recommendations run at my cost on a vendor I choose.
- **US-2** — As a signed-in trader, I want to **connect Grok OAuth to Convexa's cheaper Grok
  sub-pool** when it is available, **so that** I am not pushed into a full-price personal xAI key
  as the default path.
- **US-3** — As a signed-in trader on any powered path, I want to **see and choose a specific
  named model** before I ask, **so that** I never act on a plan from a hidden default.
- **US-4** — As a trader reading a produced recommendation, I want provenance to name the
  **provider and model that actually ran**, **so that** two asks (or two days) are comparable.
- **US-5** — As a signed-in trader, I want add / replace / remove of BYO keys to stay **write-only
  and never echoed**, **so that** my secret cannot be recovered from the browser or Settings.
- **US-6** — As a trader in a degraded powering state (no path, OAuth expired, pool unavailable,
  bad key, model missing, storage unavailable, signed-out), I want that state **named distinctly
  with a recovery action**, **so that** I am not left staring at a silent disabled button or a
  false "no key" catch-all.
- **US-7** — As any trader (signed-in or not), I want the **manual export / copy-paste hand-off**
  to keep working without a key or pool, **so that** analysis is never hostage to LLM powering.
- **US-8** — As an admin on the legacy shared Anthropic allowance, I want that path to remain
  honest and **visibly distinct from the Convexa Grok pool**, **so that** "free admin allowance"
  is never mistaken for the preferred Grok pool product.
- **US-9** — As the owner, I want provider/model choice to leave **score, tier, and fingerprint
  byte-identical**, **so that** powering is never a scoring input.

---

### 5. Acceptance criteria

Every row is one observable outcome a stranger can check without reading source. **(SB)** =
ship-blocking. `Verify by` is risk-based: `test` where silent regression under an unrelated change
is plausible; `review` where the behavior is visible/intentional. Never one-test-per-AC theater.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1 | A signed-in trader can complete **add** of a BYO key for **each** of the closed providers Anthropic, OpenAI, Gemini, and Grok/xAI from Settings, and after a successful add the surface shows that a key is set for that provider with a **masked hint only** (no full secret). | test |
| AC-2 **(SB)** | US-5 | After any successful add/replace, no Settings read, Ask-AI surface, network response body visible to the client, or client-side storage inspection used by the product shows the full secret again — only the masked hint (or "not set"). There is **no** reveal / show / copy control for the secret. | test |
| AC-3 **(SB)** | US-1, US-5 | A signed-in trader can **replace** a stored BYO key for a provider; the new masked hint reflects the replacement; the previous secret is not shown. | test |
| AC-4 **(SB)** | US-1, US-5 | A signed-in trader can **remove** a stored BYO key for a provider; Settings then shows that provider as not set; Ask-AI no longer treats that key as a usable path. | test |
| AC-5 **(SB)** | US-3 | When a usable powering path exists, both Settings and Ask-AI show a **named provider** and a **named model** before a recommendation is requested; the ask affordance does **not** proceed while model is unset. | test |
| AC-6 **(SB)** | US-3 | The trader can change the selected model from the closed catalog for the active path; the next successful ask uses the newly selected **named** model (observable via pre-ask labels and post-ask provenance). | test |
| AC-7 **(SB)** | US-3 | No powered ask runs against an unnamed / invisible default: if the product would otherwise have used an env default the trader never selected, the surface instead requires an explicit model choice (blocked until chosen) rather than silently asking. | test |
| AC-8 **(SB)** | US-4 | A successfully produced recommendation displays provenance that names the **provider label** and **model label** that produced it; those labels match the path that was active for that ask. | test |
| AC-9 **(SB)** | US-2 | When the Grok OAuth + Convexa pool arm is **available** on the deployment for a signed-in trader without a conflicting explicit BYO-only selection, Settings presents Connect-with-Grok / pool as the **preferred cheaper** path, observably distinct from "add a personal Grok/xAI API key." | review |
| AC-10 **(SB)** | US-2 | A signed-in trader with **Grok OAuth connected**, **pool usable**, and a **model chosen** can obtain a recommendation; pre-ask labels and post-ask provenance identify the Convexa Grok pool path and the chosen model (not a personal BYO key). | test |
| AC-11 **(SB)** | US-2, US-1 | A signed-in trader can decline the pool and instead use a BYO provider+key+model; Ask-AI then runs on that BYO path, not the pool. | test |
| AC-12 **(SB)** | US-6 | **Signed-out:** Ask-AI shows only the sign-in gate; cooldown, daily cap, no-key, OAuth-expired, pool-unavailable, bad-key, and model-missing states do **not** appear. Settings powering controls require sign-in. | test |
| AC-13 **(SB)** | US-6 | **No usable powering path** (signed-in, no BYO key, Grok not connected / pool not selected, and no legacy admin shared path): Ask-AI shows a setup blocked state with a path to Settings, produces **no** recommendation, and is **not** framed as a free trial. | test |
| AC-14 **(SB)** | US-6 | **OAuth expired / revoked:** Ask-AI (and Settings status) show a distinct expired-connection state with reconnect and/or switch-to-BYO recovery; this state is textually and behaviorally distinct from no-key and from pool-unavailable; **no** recommendation. | test |
| AC-15 **(SB)** | US-6 | **Pool unavailable** while OAuth still appears connected: distinct pool-unavailable blocked state with recovery toward retry later and/or BYO; **not** labeled as expired OAuth or as "add your key" alone; **no** recommendation. | test |
| AC-16 **(SB)** | US-6 | **Bad / rejected BYO key** at ask time: Ask-AI shows a distinct key-rejected state pointing at replace-key in Settings; produces **no** new recommendation; does not blank the rest of the ticker dashboard. | test |
| AC-17 **(SB)** | US-6 | **Model missing from catalog** (saved selection not in the current catalog for the active path): Ask-AI/Settings show a distinct choose-another-model blocked state; the product does **not** silently substitute another model; **no** recommendation until the trader selects a catalog model. | test |
| AC-18 **(SB)** | US-6 | **Key storage unavailable:** Settings refuses saving a BYO key with an explicit storage-unavailable outcome; the trader cannot be led to believe a key was stored; manual export remains available. | test |
| AC-19 **(SB)** | US-8 | Legacy admin shared-allowance remaining / exhausted / shared-unconfigured outcomes remain mutually distinct from each other **and** from Convexa Grok pool states; product language does not call the admin shared allowance the Grok pool. | review |
| AC-20 | US-8 | A regular (non-admin) signed-in trader never sees an admin free-use counter or admin-allowance language. | test |
| AC-21 | US-7 | In every blocked powering state in AC-12–AC-18, and when signed-out, the **manual export / copy-paste hand-off** remains usable without performing an Ask-AI call. | test |
| AC-22 | US-6 | Existing cooldown, fresh-edge gate, and daily-cap blocked states still appear when a usable powering path exists and those conditions apply; they do not replace or overwrite the distinct powering-failure states when powering is the blocker. | review |
| AC-23 | US-3 | Provider labels shown to the trader are from the closed set (Anthropic / OpenAI / Gemini / Grok) and are **not** inferred by parsing the pasted key string in the UI. | review |
| AC-24 | US-4 | Provenance naming provider/model does not claim grounding, verification, or any check the recommendation did not already express through existing honesty chrome. | review |
| AC-25 | US-1 | Switching the active BYO provider (with keys set on more than one) updates the named provider+model pair Settings and Ask-AI agree on before the next ask. | test |
| AC-26 | US-6 | An LLM/transport failure after a valid path still isolates to the Ask-AI surface (unavailable + recovery); ticker bundle / positions / score tiles remain intact. | test |
| AC-27 **(SB)** | US-9 | For the same market inputs, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` are byte-identical across pool vs each BYO provider path and vs pre-feature baseline; provider/model are not scoring inputs. | test |
| AC-28 **(SB)** | US-2 | If the Grok OAuth + Convexa pool arm cannot be delivered honestly in this build, the ship either (a) delivers the arm meeting AC-9/10/14/15, or (b) leaves those ACs **explicitly open / blocked-on** in the gate record — it must **not** ship a false "connected to Grok pool" affordance or silently redefine SuperGrok-subscription pass-through as the pool. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent wrong-power / wrong-model / secret-echo / state-collapse
  regressions:** multi-provider add/replace/remove (AC-1/3/4), never-echo (AC-2), mandatory named
  model (AC-5–7), provenance match (AC-8), pool vs BYO selection (AC-10/11), signed-out outermost
  (AC-12), distinct degraded states (AC-13–18), export floor (AC-21), provider switch agreement
  (AC-25), isolation (AC-26), score byte-identity (AC-27). Those can die under a refactor while the
  Settings panel "still looks redesigned."
- **`review` owns preferred-path offering copy intent (AC-9), legacy-vs-pool naming (AC-19),
  closed-label non-inference (AC-23), provenance non-overclaim (AC-24), orthogonality of existing
  gate states (AC-22), and the honesty gate on a blocked pool arm (AC-28).** Visible/intentional;
  brittle string snapshots buy little.
- Prefer **one** Settings integration pass covering add/replace/remove + masked hint + storage
  unavailable, and **one** Ask-AI pass covering signed-out / no-path / model-missing / bad-key /
  provenance, over per-AC component theater.
- DOM harness already exists for Settings AI key + Ask-AI families; no new harness is demanded by
  these rows. Paint/layout remain UX `review` territory and are intentionally absent from this
  table.

**Ship-blocking set:** AC-1–AC-8, AC-9–AC-11 (pool arm — or AC-28's honest blocked-on escape),
AC-12–AC-18, AC-19, AC-27, AC-28. AC-28 exists so "pool preferred" cannot be laundered into a lie.

---

### 6. Product decisions locked in this position

1. **Closed provider set** = Anthropic, OpenAI, Gemini, Grok/xAI. No others this feature.
2. **Model choice is mandatory and named** on every powered path — including the Convexa Grok
   pool. Hidden env defaults are not an acceptable trader experience.
3. **Convexa Grok sub-pool via Grok OAuth is the preferred default offer** when available; BYO
   remains fully selectable. SuperGrok subscription pass-through is Out.
4. **Degraded states do not collapse** — especially OAuth expired ≠ pool unavailable ≠ no key ≠
   bad key ≠ model missing ≠ signed-out ≠ storage unavailable.
5. **Legacy admin shared Anthropic allowance survives** but must be **renamed in product language**
   so it cannot be read as the Grok pool.
6. **Write-only secrets** remain absolute; multi-provider does not weaken never-echo.
7. **Provenance names provider + model that ran**; it does not invent grounding.
8. **If the pool arm is not buildable**, do not silently narrow owner intent in the shipped UI —
   mark blocked-on (AC-28) and keep BYO multi-provider + model choice shippable on their own
   ship-blocking ACs.

---

## Risks I see

1. **State collapse under a single "AI unavailable" bucket.** The defining product failure for this
   feature: OAuth expired, pool empty, bad key, and model missing all feel like "add your key."
   ACs 14–17 exist to make collapse a failed check.
2. **Silent model default.** Backend already has env default models. If Settings/Ask-AI never force
   an explicit choice, traders still cannot tell which model produced the plan — the BRIEF's
   decision-impact failure. AC-5/7 are the hard stop.
3. **Pool arm hand-waved as SuperGrok.** Third-party agents invent "use my subscription." That is
   Out. Shipping a Connect button that cannot actually spend a Convexa pool is worse than leaving
   the arm blocked-on (AC-28).
4. **Legacy admin allowance confused with Grok pool.** Two "shared/cheaper" stories on one surface.
   Rename intent is ship-blocking (AC-19); UX must keep them visually distinct without me laying
   out pixels.
5. **Provider inferred from key prefix.** Convenient and wrong the moment formats collide or a
   trader pastes into the wrong slot. Closed label selection first (AC-23).
6. **Provenance lies or overclaims.** Showing a model the server did not use, or wording that
   sounds like verification. AC-8 + AC-24.
7. **Signed-out pollution.** New pool/OAuth states leaking onto the logged-out Ask-AI gate would
   repeat the byo-ai-key outermost-auth bug class. AC-12.
8. **Secret echo under multi-provider.** More write paths → more chances to return a key in an
   error payload or status read. AC-2 stays `test`.
9. **Scope creep into spend metering / SuperGrok / streaming.** Named Out / Future; do not absorb.
10. **Silently dropping the pool from In because it is hard.** Owner preference is clear. If
    architecture cannot support it, that is an R2 conflict — not a PM quiet-edit of scope.

---

## Assumptions I'm making about the other two lanes

**About the technical shape (architect):**

- The server can persist **per-user, per-provider** BYO secrets under the existing encrypt-at-rest /
  never-echo floors and resolve exactly one usable key (or none) for an Ask-AI call without
  returning plaintext to the client.
- The server can persist a trader's **selected provider path** and **selected model label** and use
  that selection on the next Ask-AI call (not only an env default).
- A **closed model catalog per path** (per BYO provider and for the Convexa Grok pool) can be
  exposed to Settings/Ask-AI so the UI lists only real choices; a saved model absent from the
  catalog can be detected as a first-class condition (AC-17) rather than silently substituted.
- **Grok OAuth → Convexa-owned pool spend** has a buildable mechanism the architect will name
  (Convexa OAuth app + server-side pool credential, or a verified vendor user-OAuth product) —
  or will explicitly mark blocked-on. I am **not** assuming SuperGrok subscription passthrough.
- Pool vs OAuth-expired vs BYO-rejected vs no-path can be returned as **observably distinct**
  outcomes to the Ask-AI surface without collapsing into one unavailable reason.
- Legacy admin shared Anthropic allowance resolution can remain in place beside the new pool without
  treating the pool as that allowance renamed.
- Provider and model never enter scoring / tier / fingerprint computation; byte-identity (AC-27) is
  enforceable by the same isolation boundary as prior AI features.
- Ask-AI remains server-gated; a bypassed client check still cannot spend pool or BYO credentials.
- Manual export stays a non-LLM path that does not require powering credentials.

**About the presentation (ux):**

- Exact microcopy for preferred-pool offering, each degraded state, and legacy-allowance rename is
  UX's lane; my ACs only require the **distinctions and recovery affordances**, not wording.
- UX can redesign the Anthropic-only Settings panel into a multi-provider + pool + model surface
  without introducing a reveal-secret control or a new animation family.
- UX will keep Settings and Ask-AI **label-agreeing** on the active named provider + model (same
  names the trader selected), including when switching providers.
- Provider is chosen from closed labels (not parsed from the key blob); model is a visible control,
  not buried only in advanced text.
- Dark/light parity and theme tokens cover the redesigned surface (`theme-token-discipline`); no
  new palette role required for provenance beyond existing chip patterns.
- Layout/placement of pool vs BYO vs model controls is UX's call under the product constraint that
  the preferred pool path is obviously the cheaper default when available, and that degraded
  states remain first-class (not tooltip-only footnotes on the happy path).
