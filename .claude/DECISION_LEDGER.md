# DECISION LEDGER — compounding memory (standing reference)

> How the system gets wiser per feature. The conveyor between a one-off decision and the shared
> rulebook, triggered by **recurrence**.
>
> **CAPTURE** — at every gateway the Orchestrator appends each *binding* decision it locked as a row
> below (stable `key` · feature · gate · statement · binding). **DETECT** — at **GATE S** it tallies
> the rows. **GRADUATE** — any key crossing the threshold is promoted into the canonical rulebook.
> **REUSE** — a feature's `BRIEF.md` cites promoted keys in "Invariant watch"; each role restates the
> ones it touches; ORCHESTRATOR §6 forbids reopening them. So each ship can only *add* to the
> constraint envelope the next feature inherits.

## Promotion rule
- **Threshold:** a key present in **≥3 distinct shipped features**, OR **≥2 if every instance is
  `binding:yes`**, graduates at the next GATE S.
- **Binding-only intake:** only a decision a *future feature could violate* enters the ledger (same
  bar as the GATE I decision-impact cull). Incidental implementation choices are not logged.
- **Single-source:** a promoted rule's **prose lives once** in `PROJECT_CONTEXT.md` §5 (+ a locked
  pointer in `OPEN_THREADS.md` §9). This ledger only **indexes** it — never a second copy (drift risk).
- **Contestable:** a promoted rule is a default, not a cage — reopen via **GATE Z**; the Orchestrator
  then updates/demotes it here and in the canon. Provenance (the earning rows) is retained.

## Promoted canon (key index → where the rule lives)
| key | rule (one line) | lives in | promoted | earned by |
|-----|-----------------|----------|----------|-----------|
| `best-effort-isolated-or-null` | an optional/added computation fails to a null/omitted field, **never an HTTP error**; `market_state`/`strike_profile` + SSE stay intact | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (5) |
| `additive-keeps-score-byte-identical` | an additive feature leaves gate / `opportunity_score` / `opportunity_tier` / `state_fingerprint` **byte-identical**; never a scoring input | CONTEXT §5 · THREADS §9 | 2026-06-22 | dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (4) |
| `live-vs-static-isolation` | every datum declares live-derived vs static; live UI degrades on SSE drop (dim+offline, never blank) while static reads keep rendering | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, trader-personas (4) |
| `operator-vs-trader-path-separation` | an operator/diagnostic surface stays off every trader/bundle route + unlinked from the trader UI; read-only + side-effect-free (no vendor fetch / recompute / cache mutation / trader-route call); trader path + SSE untouched | CONTEXT §5 · THREADS §9 | 2026-06-23 | backend-observability, latency-visualizer (2 binding) |
| `no-real-order-path` | "action" never reaches a real broker/order path: a simulated feature stays `SIMULATED` (paper) + mandatory-confirm; a not-yet-built real surface (e.g. a "Live" tab) ships as a **non-functional placeholder** with no broker, no order/execution path, no real-position data source | CONTEXT §5 · THREADS §9 | 2026-06-24 | ai-recommendations, positions-portfolio (2 binding) |
| `server-side-gate-enforcement` | an access gate on a state/cost-bearing action is enforced **server-side** (the server is the boundary of record), never FE-only; the FE check is for UX, not enforcement — a bypassed client check must still be rejected by the server | CONTEXT §5 · THREADS §9 | 2026-06-29 | user-accounts (AC-E7 catch), byo-ai-key (2 binding) |
| `secret-encrypted-at-rest` | a stored recoverable secret (a user/third-party API key, broker token, etc.) is **ENCRYPTED at rest** (symmetric, server-side key — NOT hashed), and **never logged / returned in a response / sent to the browser**; write-only from the client (masked hint only) + rotate/delete; persisted as **ciphertext only** (the crypto boundary sits before the store); a decrypt-fail is treated as no-usable-secret, never a leak | CONTEXT §5 · THREADS §9 | 2026-06-29 | byo-ai-key, persistent-db (2 binding) |
| `no-secrets-in-image` | a build/deploy artifact (container image, pushed repo) carries **NO secret**: `.dockerignore` excludes `.env*`/`.venv`/credential files, no `COPY .env`, no secret literal, no hardcoded backend URL; ALL config + secrets injected at **runtime via env** (host Variables / Pages env), values owner-entered; images run **non-root** | CONTEXT §5 · THREADS §9 | 2026-06-29 | containerize-apps, persistent-db, deploy (3 binding) |

> Pre-existing canon (recorded by the ledger, already a rule before it existed — not re-promoted):
> `dark-pool-context-only` (THREADS §9) · `gamma-sourcing-split` (CONTEXT §3 / THREADS §9).
> (`ai-external-no-llm` was here until **2026-06-23** — now **DEMOTED / narrowed** by `ai-recommendations`;
> see the Demoted table.)

## Demoted (contradicted by reality — system-7)
> The inverse of graduation: memory must track **truth**, not just recurrence. A promoted invariant that
> reality contradicts — an **accepted GATE Z amendment**, or a **GATE Q QA/conformance FAIL** proving it
> false or over-general — is demoted: its prose is **removed (or narrowed)** in `PROJECT_CONTEXT.md` §5
> + `OPEN_THREADS.md` §9, its key moves out of "Promoted canon" into the table below, and its earning
> rows stay in the Ledger as provenance. **Bar (mirrors promotion):** demote only when the *rule itself*
> is shown wrong/over-general — a single feature's legitimate carve-out is an **exception** noted on that
> feature, NOT a demotion. (`contract_lint.py`'s canon check follows automatically — a demoted key leaves
> the Promoted-canon table, so it is no longer expected in canon prose.)

| key | demoted | contradicting evidence (feature · gate) | disposition |
|-----|---------|------------------------------------------|-------------|
| `ai-external-no-llm` | 2026-06-23 | `ai-recommendations` · GATE S — owner decision (2026-06-23): GammaFlow now CALLS an LLM in-app for a risk-first entry rec. Contradicts the absolute "does not call an LLM." | **NARROWED, not erased.** New rule: GammaFlow MAY call an LLM **only** as a best-effort, isolated, gated, **advisory consumer** of already-computed state (never a scoring/gate/fingerprint input, no recompute, off the SSE path, server-side key, no auto-act, no real order); the AI is otherwise external + the manual hand-off remains valid. Prose narrowed in CONTEXT §8. Earning rows (trade-tracker-sim, trader-personas — "no LLM call") retained as provenance: they still comply (they made no call). |

## Watch list (keys logged, not yet at threshold)
- **`loss-free-durable-migration`** (1 instance — rebrand-convexa, 2026-06-28) — when a durable client
  store's key/shape changes, existing data is carried forward loss-free (read-new-else-old, promote-forward,
  never-delete, idempotent, never-throw), composing with any prior version chain. Generalizes the positions
  v1→v2 pattern. Not promoted (1 instance); logged for recurrence (the broker/persistent-DB tracks will
  likely hit it). *binding:yes.*
- _(`no-secrets-in-image` GRADUATED 2026-06-29 at `deploy` — 3 binding (containerize-apps, persistent-db,
  deploy); the held-until-published rule fired when the image is pushed to Railway for real. Now in Promoted
  canon above.)_
- _(`server-side-gate-enforcement` GRADUATED 2026-06-29 — 2 binding (user-accounts AC-E7, byo-ai-key).)_
- _(`secret-encrypted-at-rest` GRADUATED 2026-06-29 — reached 2 binding instances (byo-ai-key, persistent-db);
  now in Promoted canon above.)_
- _(`no-real-order-path` graduated 2026-06-24; reaffirmed again by user-accounts → 3 binding instances,
  already in Promoted canon.)_

## Ledger (append-only — one row per binding decision instance)
| key | feature | gate | statement (as locked) | binding |
|-----|---------|------|-----------------------|---------|
| `best-effort-isolated-or-null` | dark-pool-stream-isolation | S | any off-exchange failure → `off_exchange=None` (object omitted, not an HTTP error); bundle + SSE intact | yes |
| `live-vs-static-isolation` | dark-pool-stream-isolation | S | live tiles dim + `⏸ offline` on payload-gap watchdog; GEX chart/stats/blocks persist from last bundle | yes |
| `dark-pool-context-only` | dark-pool-stream-isolation | S | block prints display-only, unscored, no side (already canon THREADS §9) | yes |
| `additive-keeps-score-byte-identical` | dex-voloi-skew-term | S | `signals.py` untouched; score + `state_fingerprint` byte-identical with/without the four metrics | yes |
| `best-effort-isolated-or-null` | dex-voloi-skew-term | S | the four metrics each independently nullable → own "unavailable this cycle" | yes |
| `live-vs-static-isolation` | dex-voloi-skew-term | S | the four are static reads — excluded from the live-offline treatment (stay un-dimmed on SSE drop) | yes |
| `additive-keeps-score-byte-identical` | trade-tracker-sim | S | entry gate + `opportunity_score` + `state_fingerprint` byte-identical to pre-feature | yes |
| `best-effort-isolated-or-null` | trade-tracker-sim | S | all ghost-trade backend surface best-effort/isolated; missing→404, no-NBBO→null, never breaks bundle | yes |
| `ai-external-no-llm` | trade-tracker-sim | S | stateless server, no order path, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trade-tracker-sim | S | SSE drop degrades only P/L + current mark (⏸ last known); record/stats/history persist | yes |
| `additive-keeps-score-byte-identical` | backend-observability | S | `OBSERVABILITY_ENABLED` OFF ⇒ byte-identical bundle; computed values frozen; trader path unchanged | yes |
| `best-effort-isolated-or-null` | backend-observability | S | instrumentation best-effort — a forced span exception still yields 200 + identical values (never a non-200) | yes |
| `operator-vs-trader-path-separation` | backend-observability | S | metrics readout off the trader routes; SSE uninstrumented; trader dashboard ignores `trace_id`/`timings` | yes |
| `additive-keeps-score-byte-identical` | trader-personas | S | persona = A vs B vs none → byte-identical `market_state`/`signals`/`ai_eval`; persona never a scoring input | yes |
| `best-effort-isolated-or-null` | trader-personas | S | persona assembly failure → default one-size prompt, never an HTTP error, never blocks bundle/gate/hand-off | yes |
| `ai-external-no-llm` | trader-personas | S | persona assembles text only; AI external, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trader-personas | S | persona is presentation-only — fully usable from last bundle, never marked offline | yes |
| `operator-vs-trader-path-separation` | latency-visualizer | S | trend on `/_ops/metrics` only, never linked from a trader route; the page's sole network call stays `GET /api/_metrics`; no control triggers a vendor fetch / recompute / cache mutation / trader-route call | yes |
| `best-effort-isolated-or-null` | latency-visualizer | S | a failed poll keeps the last series behind a soft notice + self-heals (no retry storm, no error page); never affects the page, snapshot tables, or any other surface; the in-browser series is ephemeral (only Export persists, to the operator's machine) | yes |
| `additive-keeps-score-byte-identical` | ai-recommendations | S | the in-app LLM rec is a pure CONSUMER in a one-way-leaf module `signals`/`engine`/`live`/`darkpool` do NOT import; `opportunity_score`/`opportunity_tier`/`state_fingerprint` byte-identical with vs without a rec (verified live + via the E3 test) | yes |
| `best-effort-isolated-or-null` | ai-recommendations | S | LLM timeout/error/over-cap/no-key → HTTP 200 + a `status` field (never 5xx); the rec surface degrades ALONE; bundle/SSE/chart/tiles/tracker intact; manual export floor always works | yes |
| `live-vs-static-isolation` | ai-recommendations | S | a rec is a static artifact pinned to its snapshot — stale on a newer bundle, UNTOUCHED on an SSE drop, never silently refreshes/re-runs | yes |
| `no-real-order-path` | ai-recommendations | S | "action" = Accept into the paper-sim ghost-trade tracker + mandatory confirm; `SIMULATED`; advisory; no broker/order path (watch-list key) | yes |
| `ai-external-no-llm` | ai-recommendations | S | **DEMOTION trigger** — GammaFlow now CALLS an LLM (isolated/gated/advisory consumer); narrows the rule, see Demoted table | yes |
| `no-real-order-path` | positions-portfolio | S | multi-position sim portfolio: every entry `SIMULATED` (manual/market/limit are sim bookkeeping vs the existing mark stream); the **Live tab is a zero-import lock** — no broker, no order/execution path, no real position; no real order anywhere | yes |
| `additive-keeps-score-byte-identical` | positions-portfolio | S | the portfolio issues NO `/api/ticker` call + never feeds `signals`/`opportunity_score`/`opportunity_tier`/`state_fingerprint`; the tier read is display-only; AC-41 asserts byte-identical with/without the portfolio | yes |
| `best-effort-isolated-or-null` | positions-portfolio | S | a per-row mark/contract-lookup failure degrades only that row (excluded+flagged from the subtotal, never zeroed); a corrupt store degrades to an empty portfolio without throwing, leaving the readable v1 blob intact | yes |
| `live-vs-static-isolation` | positions-portfolio | S | on an SSE drop live cells dim + `⏸` last-known (never blank/0), the P/L trend = a broken line; position records / history / customization / saved views persist from the durable store | yes |
| `additive-keeps-score-byte-identical` | app-shell-landing | S | multi-page restructure (router + AppShell + Convexa landing); `apps/api` diff empty, the relocated Ticker renders the bundle score verbatim — score/tier/`state_fingerprint` untouched | yes |
| `best-effort-isolated-or-null` | app-shell-landing | S | relocated features keep best-effort degradation; standalone `/positions` per-row mark failure (404/null/refresh-fail) degrades that cell to last-known, never blanks/drops the row | yes |
| `live-vs-static-isolation` | app-shell-landing | S | Ticker live-degrade survives the route move (⏸ offline, static persists); live SSE is **page-scoped** — opens on `/ticker`, closes on nav-away, reopens on return, never double-subscribes | yes |
| `operator-vs-trader-path-separation` | app-shell-landing | S | `/_ops/metrics` stays OFF the new nav shell and unlinked from the trader UI (verified) | yes |
| `no-real-order-path` | app-shell-landing | S | all SIMULATED; positions "Live" tab stays the zero-import LOCKED placeholder; the landing's brokerage block is an honest non-navigating "coming soon" (no order/broker path) | yes |
| `additive-keeps-score-byte-identical` | ticker-load-experience | S | pre-warm/concurrency/coalescing change only WHEN/HOW inputs are obtained — same `market_data` in → byte-identical bundle out; `opportunity_score`/`tier`/`state_fingerprint` identical cold==warm (QA re-proven: score 44, fp `b5c70f93c2d5`) | yes |
| `best-effort-isolated-or-null` | ticker-load-experience | S | chain pre-warm + 3-fetch concurrency are best-effort: any miss/stale/malformed/fetch-exception falls back to a normal vendor fetch with no new error surface; `last_trade` nullable between prints/overnight | yes |
| `live-vs-static-isolation` | ticker-load-experience | S | SSE `last_trade` is live-derived (dims with mid/spread/flow on a stream drop); cold-load skeleton is a DISTINCT state from offline-degrade and from "unavailable this cycle" | yes |
| `live-spot=NBBO-mid` | ticker-load-experience | S | **NARROWING (system-7)** — `last_trade` ADDED as a display-only SSE readout; the NBBO mid stays the anchor for headline/levels/flip (`_levels_for_filter` keeps `self.mid`). Narrows THREADS §9 "do not add last-trade." | yes |
| `additive-keeps-score-byte-identical` | user-accounts | S | auth/sessions/settings = a one-way leaf the scoring path never imports (0/12 modules); anonymous vs signed-in bundle byte-identical (score 24, fp `79373ef9194e`); no user setting is a scoring input; bundle/SSE gained NO required header/query param | yes |
| `best-effort-isolated-or-null` | user-accounts | S | **CARVE-OUT (the auth error class):** auth endpoints return real HTTP statuses by design (401 non-enumerating bad-creds / 403 gated / 409 dup email) — the null-not-error rule governs added BUNDLE computations, NOT the auth surface; an auth-subsystem failure still degrades the trader path to anonymous (bundle/SSE intact) | yes |
| `no-real-order-path` | user-accounts | S | gating the Positions sim-trade WRITE actions + the "ask AI" call behind a session is ACCESS CONTROL; Positions stays `SIMULATED` (client-local localStorage); no broker/order/execution path; the "Live" tab stays zero-import LOCKED | yes |
| `additive-keeps-score-byte-identical` | rebrand-convexa | S | full GammaFlow→Convexa rename is cosmetic to the engine — logger/title/identifier/key renames only; `opportunity_score`/`tier`/`state_fingerprint` byte-identical (score 2, fp `8fa0e1e62a11`), conformance 8/8, no interface/wire change | yes |
| `best-effort-isolated-or-null` | rebrand-convexa | S | the migrate-on-read helper never throws — a corrupt/absent legacy blob degrades to empty in-memory with the source blob preserved (rollback-safe); a failed promote-write is swallowed and the value still surfaces | yes |
| `loss-free-durable-migration` | rebrand-convexa | S | renaming a durable localStorage key carries existing data forward LOSS-FREE: read-new-else-old, promote-forward-once (idempotent), never delete the old key, never throw; composes with the existing positions v1→v2 chain so every legacy user lands whole | yes |
| `additive-keeps-score-byte-identical` | byo-ai-key | S | per-user key resolution / credential store / crypto / metering / admin allowlist stay OUT of scoring; score 24 / tier actionable / fp `79373ef9194e` byte-identical across all 6 key states (anon/regular-no-key/admin-allowance/exhausted/shared-unconfigured/own-key); 0/5 scoring modules import the credential store or crypto leaf | yes |
| `best-effort-isolated-or-null` | byo-ai-key | S | key lookup / decrypt-fail / LLM error / over-limit / missing-encryption-secret all degrade the rec surface ALONE to a `status` (no_key/over_limit/shared_key_unconfigured/unavailable), always-200 never 5xx; bundle/SSE/chart/tracker + the keyless export floor intact | yes |
| `server-side-gate-enforcement` | byo-ai-key | S | the credential endpoints (`/api/auth/ai-key`) + the AI-rec call are gated SERVER-SIDE (403 anonymous; key resolution + the admin-allowance decision are server-authoritative); the FE only renders the server's resolved state — not an FE-only gate | yes |
| `secret-encrypted-at-rest` | byo-ai-key | S | a stored third-party secret (the user's Anthropic key) is ENCRYPTED (Fernet, server-side `AI_KEY_ENCRYPTION_KEY`), NOT hashed (must be recoverable to call); never logged / returned / sent to the browser; write-only + masked last4 + rotate/delete; decrypt-fail ⇒ treated as no usable key (no leak) | yes |
| `additive-keeps-score-byte-identical` | persistent-db | S | storage-backend swap only — the auth stores stay a one-way leaf the scoring path never imports (AST 0/5); trading/bundle/SSE path is stateless + untouched; score/tier/`state_fingerprint` byte-identical (in-memory default path conformance PASS, no regression) | yes |
| `best-effort-isolated-or-null` | persistent-db | S | a Postgres outage degrades the AUTH subsystem only — the adapter raises (never false-success) → existing machinery yields 503 `auth_unavailable` / treat-as-anonymous; the anonymous bundle/SSE/trader path never touches the DB and stays fully up. Auth fails CLOSED | yes |
| `secret-encrypted-at-rest` | persistent-db | S | the per-user AI key moves into Postgres as **ciphertext ONLY** (+ masked last4); the adapter never imports `crypto`, never reads `AI_KEY_ENCRYPTION_KEY`, never en/decrypts — the encryption boundary (crypto leaf, before the store) is preserved across the new store | yes |
| `no-secrets-in-image` | persistent-db | S | `DATABASE_URL` / DB credentials injected at RUNTIME via env, never committed/baked; `.dockerignore` already excludes `.env*` so the new config holds the image-hygiene line | yes |
| `no-secrets-in-image` | deploy | S | the image is **pushed to a registry for real** (Railway) — every secret (`DATABASE_URL`, `API_ORIGIN`, `MASSIVE/ANTHROPIC` keys, `AI_KEY_ENCRYPTION_KEY`/`AUTH_SESSION_SIGNING_KEY`, `METRICS_SECRET_TOKEN`) lives only in Railway Variables / Pages env, never in the repo/image; the Pages Function reads `API_ORIGIN` from env (no hardcoded URL); secret-scan clean. **3rd instance → GRADUATES** | yes |
| `additive-keeps-score-byte-identical` | deploy | S | deploy config + the 3 HIGH security guards (metrics token-gate, the fail-open public rate-limit leaf, the startup stable-key warning) change no scoring/engine/`state_fingerprint`; the limiter is a leaf outside the scoring path; in-memory conformance PASS, no regression | yes |

> Note (GATE S, deploy, 2026-06-29): step 3 of the infra program — the deploy ARTIFACTS + security
> hardening (the live deploy itself is the owner applying the runbook). Railway (backend container +
> Postgres) + Cloudflare Pages (frontend) wired via a streaming Pages Function proxy (`/api/*`→Railway,
> SSE-safe; client uses relative `/api`, so zero client change). Repo changes R1–R4: `$PORT`-honoring CMD,
> env-gated CORS (`ALLOWED_ORIGINS`), the Pages Function, edge-block of `/api/_metrics`. **system-6
> Security/red-team ACTIVATED for the first time** (the deferred role, triggered by going public; run on a
> different model) → verdict **GO-WITH-REQUIRED-FIXES**: 3 HIGH closed before ship — HIGH-1 token-gate
> `/api/_metrics` (`METRICS_SECRET_TOKEN`), HIGH-2 per-IP rate-limit on the anon cost-bearing
> `/api/ticker`+`/api/stream` (`PUBLIC_RATE_LIMIT_PER_MIN`, owner-chosen; fail-open leaf, 429-before-vendor),
> HIGH-3 startup WARNING when `ACCOUNT_STORE=postgres` + a stable key is missing; +3 MED/+3 LOW logged as
> fast-follows (SECURITY_REVIEW.md). **GRADUATION:** `no-secrets-in-image` hit its 3rd binding instance
> (real registry push) → promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` gained
> an instance (already canon). **Pending owner action:** apply the runbook (create the Railway service +
> Postgres, set the env/secrets incl. the new `METRICS_SECRET_TOKEN`/`PUBLIC_RATE_LIMIT_PER_MIN` + stable
> keys, set the Cloudflare build + `API_ORIGIN`) → then the live smoke test. Not yet live.

> Note (GATE S, persistent-db, 2026-06-29): the in-memory→Postgres persistence swap (psycopg3 sync raw-SQL
> adapter behind the existing 4 auth ports; `ACCOUNT_STORE=postgres`+`DATABASE_URL`; in-memory stays default;
> DB-outage fail-closed for auth / trader path stays up). Infra fast-path (architect → backend build →
> conductor static review; PM/UX skipped). **Live-Postgres verify DEFERRED** (no Postgres in the dev box) —
> verified by the in-memory-default conformance (no regression) + statement-level SQL parity review + the
> ciphertext-only/leaf-boundary AST checks. **GRADUATION:** `secret-encrypted-at-rest` reached its 2nd
> binding instance (byo-ai-key → persistent-db held the ciphertext-only boundary across a NEW store) →
> promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` + `best-effort-isolated-or-null`
> each gained an instance (already canon). `no-secrets-in-image` hit 2 instances but is **deliberately held**
> to the `deploy` feature (it governs *published* artifacts; nothing's been pushed yet). **Deferred seam
> named:** the per-admin AI metering counters are process-local (NOT behind the stores) → not shared across
> replicas; centralizing them is a future item, out of scope here. system-6 (adversarial review of the
> persistence/deploy + credential surface) still lands at go-live.

> Note (GATE S, byo-ai-key, 2026-06-29): the hybrid bring-your-own AI-key feature — per-user encrypted
> Anthropic keys (own-key-first), admin-only free allowance (default 3/day) on the shared key, the 5-state
> resolution incl. `shared_key_unconfigured`. **GRADUATION:** `server-side-gate-enforcement` reached its
> **2nd binding instance** (user-accounts AC-E7 catch → byo-ai-key's server-authoritative credential/rec
> gating) → promoted into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. A
> satisfying loop closure: a key the QA role *surfaced from a failure* (AC-E7) recurred and graduated. The
> two already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`) each gained
> an instance — no new graduation from them. New watch-list key `secret-encrypted-at-rest` (1 instance;
> will recur on broker-connect). QA (GATE Q) on Sonnet, de-correlated: initial FAIL on AC-19 (uncovered by a
> named test though the behavior worked) → bounced → FE added the test → **RE-RUN PASS 26/26**, security
> floor + score byte-identity + conformance all clean. `system-6` (Security/red-team) stays DEFERRED
> (encrypt+hygiene floor enforced) — but credential custody (encrypted user keys) makes byo-ai-key its
> eventual first client at the go-live trigger.

> Note (GATE S, rebrand-convexa, 2026-06-28): the GammaFlow→Convexa rebrand was **completed** — extended
> from UI-only to the whole codebase (134 refs / 51 files): identifiers, the `gammaflow.ts`→`convexa.ts`
> client, logger/title/ContextVar, docs/README/CLAUDE.md, `project.json` `project_name`, and a **loss-free
> migration of the 4 durable localStorage keys** `gammaflow.*`→`convexa.*`. **REVERSES the earlier
> "Convexa = UI-only / don't rename code/keys" decision** (app-shell-landing GATE-S note above; CONTEXT
> §1/§6, THREADS §7d) by deliberate owner choice (2026-06-28). It was a **feature decision, not a
> Promoted-canon key**, so it is **updated in place** (CONTEXT §1 brand line + the feature-state UI-only
> notes annotated "superseded"; THREADS §7d/§7g) — **NOT** moved to the Demoted table. New watch-list key
> `loss-free-durable-migration`. The three logged keys (`additive-keeps-score-byte-identical`,
> `best-effort-isolated-or-null`, + the new migration key) — the two canon keys gained an instance, no new
> graduation. QA (GATE Q) on Sonnet, de-correlated: **23/23 ACs PASS**, conformance unchanged, dashboard
> 283/283 + @org/api 7/7. STAYS unrenamed (non-goals): `@org/*` scope, `DATA_DIR`, the local working
> folder, and archived-contract/ledger history (provenance).

> Note (GATE S, user-accounts, 2026-06-25): the project's **first stateful backend surface + first
> credential store** (email/username+password auth, server-side sessions, per-user light prefs, Google
> OAuth wired-but-config-gated-OFF, in-memory SQLite behind a swap seam; hybrid access — anonymous
> browsing open, the sim Positions write actions + the "ask AI" call require a session). The three touched
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `no-real-order-path`) each gained an instance → **no new graduation** (all already canon);
> `no-real-order-path` is now at **3 binding instances**. The `best-effort-isolated-or-null` instance
> carries an explicit **CARVE-OUT** (auth endpoints legitimately return real HTTP statuses — a NEW class,
> not the bundle null-rule), documented in CONTEXT §5 and the row above; this refines the rule's scope
> without demoting it (the trading-path guarantee is untouched and reaffirmed). **Descriptive-property
> narrowing (NOT a promoted-canon demotion):** the informal "stateless server" property is narrowed in
> CONTEXT §2/§5 to "the **trading/bundle path** stays stateless; auth introduces a contained, swappable
> state store outside that path." It was never a Promoted-canon key (no Demoted-table move). New watch-list
> key `server-side-gate-enforcement` logged (the AC-E7 GATE Q catch). QA (GATE Q) on Sonnet, de-correlated:
> initial FAIL on AC-E7 (FE-only gate) → bounced (GATE Z) → FE wired the server gate → **GATE Q RE-RUN
> PASS** 30/30, conformance 2/2, `dashboard` 246/246 + `@org/api` 7/7.

> Note (GATE S, ticker-load-experience, 2026-06-25): perf + UX refinement of the ticker page (chain
> pre-warm 7.8s→1.2s, fetch concurrency, request-coalescing, skeleton-first load, live last-trade). The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance → **no new graduation**. The notable decision is a
> **system-7 NARROWING** of the THREADS §9 resolved decision "Live spot = NBBO mid — do not add
> last-trade": by explicit owner decision (2026-06-25) the rule is narrowed to "the **mid stays the
> anchor** for headline/levels/flip; a **display-only last-trade readout MAY be added** beside it." Not a
> promoted-canon key (it lived in THREADS §9 "Resolved", not the Promoted table), so it is narrowed in
> place in THREADS §9 + PROJECT_CONTEXT §5 rather than moved to the Demoted table; the anchor decision
> itself stands. Letting last-trade drive the anchor/levels/flip remains a GATE-Z reversal.

> Note (GATE S, app-shell-landing, 2026-06-24): pure FE restructure + rebrand (Convexa, **UI-only** — no
> code/package/store-key rename). The five binding keys above each gained an instance but are all already
> canon → **no new graduation**. `operator-vs-trader-path-separation` is now at 3 instances
> (backend-observability, latency-visualizer, app-shell-landing).

> Note (GATE S, positions-portfolio, 2026-06-24): `no-real-order-path` reached **2 binding:yes instances**
> (ai-recommendations, positions-portfolio) → crossed the "≥2 if all binding" threshold → **GRADUATED** by
> the Orchestrator into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → no new graduation this ship.

> Note (GATE S, latency-visualizer): `operator-vs-trader-path-separation` reached **2 binding:yes
> instances** (backend-observability, latency-visualizer) → crossed the "≥2 if all binding" threshold.
> **RESOLVED — GRADUATED by the Orchestrator 2026-06-23** into CONTEXT §5 + THREADS §9 (see Promoted
> canon above). The executioner detected/flagged; the Orchestrator held the promotion pen.

> Note (GATE S, ai-recommendations, 2026-06-23): first **DEMOTION** (system-7). `ai-external-no-llm`
> ("GammaFlow does not call an LLM") is contradicted by `ai-recommendations` — by explicit owner decision,
> GammaFlow now calls an LLM as an isolated/gated/advisory consumer. The rule is **NARROWED** (not erased)
> in CONTEXT §8 and moved to the Demoted table; provenance rows retained. DETECT tally: the three
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → **no new graduations** this
> ship; `no-real-order-path` logged to the watch list (1 instance).

> Seeded retroactively 2026-06-22 from the five archived features (`OPEN_THREADS.md` §3–§7). Going
> forward, the Orchestrator appends a row per binding decision at each gateway (ORCHESTRATOR §0 step 7).
