# BACKLOG — idea pool + roadmap discovery (standing reference)

> The divergent half of roadmap-advancement. The Orchestrator's **GATE I** (see
> `.claude/ORCHESTRATOR.md` §3) grooms this pool, culls to ONE next feature, and emits that as a
> per-feature `BRIEF.md` that seeds the pipeline. This file holds the candidates; it is NOT a
> commitment — promotion to a feature folder happens only through GATE I.
>
> Seeded from the deferred/open items already in `OPEN_THREADS.md`. Keep it current: when a thread
> ships, migrate its "deferred seams" here; when an item is promoted, mark it `→ promoted`.

## How an item earns promotion (the cull, from GATE I)
1. **Decision-impact test** — name the *trading decision* it improves and *how you'd observe* the
   improvement. No answer ⇒ parked, not promoted. (Mirrors the "AC observable without code" rule
   and the AI over-trading gate — we resist shiny features the same way we resist over-trading.)
2. **Feasibility gate** — data coverage + math invariants. Blocked items name their blocker.
3. **Score** — Value (H/M/L to the trading edge) × Effort (S/M/L); flag any locked invariant touched.

## Standing harvest sources (where the next wave comes from)
- **Deferred items** — `OPEN_THREADS.md` §7 + the "deferred seams" line inside each shipped thread.
- **Open strategic questions** — `OPEN_THREADS.md` §1/§9 (vendor + overnight).
- **Usage friction** — what's painful in your own daily trading use (capture as you hit it).
- **Downstream-AI quality** — does the `strategy_prompt` / `reassessment_prompt` hand-off produce
  better calls? Gaps here are first-class features.
- **Lifted constraints** — when a data/vendor limit lifts (e.g. overnight coverage), the features it
  was blocking become buildable.
- **Nx workspace graph** *(project-specific harvest source)* — the Nx MCP (`nx_workspace` / `nx affected`)
  surfaces what projects/targets exist and what's changed; use it during GATE I to spot structural gaps
  or affected-but-untouched areas worth a feature. (Conductor-side at Discovery only — kept here in the
  project-owned backlog, NOT in the generic `ORCHESTRATOR.md`.)

---

## Last GATE I — 2026-06-29 (infra program, step 2: persistent datastore)
**Chosen → `persistent-db`** (step 2 of the infra/deploy program). Swap the in-memory SQLite auth stores
for **persistent Postgres** behind the existing ports (`UserStore`/`SessionStore`/`UserSettingsStore`/
`UserCredentialStore`) so accounts/sessions/settings/encrypted-AI-keys **survive restarts + span replicas**
— the must-do-before-deploy step (the §4 "externalize your state" lesson). New adapter selected by the
existing env factory (`ACCOUNT_STORE=postgres` + `DATABASE_URL`); in-memory stays the local/test default.
Decision-impact cull **N/A** (deploy-readiness). Feasibility **pass to BUILD** — the ports + env-factory
already exist (provider pattern), so it's a contained adapter + schema/migrations; **runtime-verify needs a
Postgres instance** (dev box has none) → deferred like Docker. Effort **L** · entry = **architect-first**
(adapter shape raw-SQL-vs-ORM + async/sync, schema + migrations, pooling, the **DB-outage fail mode** — auth
fails closed, trader/bundle path stays up, the best-effort carve-out, ciphertext-only AI-key boundary).
**Invariant watch:** `additive-keeps-score-byte-identical` (storage-only, trading path untouched),
`best-effort-isolated-or-null` (DB outage degrades auth, not the anonymous bundle/SSE), `secret-encrypted-at-
rest` (ciphertext-only in the DB), `no-secrets-in-image` (`DATABASE_URL` via runtime env). No interface/UI/
scoring change. **Recommended target: Postgres** (deploy-ready; SQLite-file is a single-instance dead-end).
Brief at `.claude/contracts/persistent-db/BRIEF.md`; routing to the Architect (GATE A·X). **Then:** `deploy`
→ Security/red-team (system-6) at go-live.

**HOST DECISION (owner, 2026-06-29) — scopes the `deploy` feature:** backend → **Railway** (container +
managed Postgres → `DATABASE_URL`; long-running/SSE; runtime env for all secrets); frontend → **Cloudflare
Pages** (static Vite build; generous/commercial-OK, no egress fees). This is a **SPLIT-host** deploy, so the
`deploy` feature must wire the **cross-origin `/api`**: the Cloudflare-served SPA calls the Railway backend
on a different origin → either **CORS** on FastAPI (allow the Pages origin) OR a **Cloudflare Pages proxy/
rewrite** of `/api/*` → the Railway URL (preferred — keeps same-origin + no CORS), plus the frontend build
needs the backend base URL (build-time env / rewrite). Note: the shipped `apps/dashboard/Dockerfile` +
nginx-proxy is now the **local-`docker compose` + optional single-host** path; for the Cloudflare path,
Pages builds the static output directly (the container isn't used). All deferred to the `deploy` feature.

## Last GATE I — 2026-06-29 (owner request: infrastructure — containerize, then deploy)
**Chosen → `containerize-apps`** (step 1 of the infra/deploy program) — owner-directed. Author Docker
artifacts: a `Dockerfile` for the FastAPI backend (non-root, env-injected config) + a multi-stage
`Dockerfile` for the dashboard (Nx/Vite build → static-serve) + a root `docker-compose.yml` (one-command
local full-stack) + `.dockerignore`s. Promotes the standing §B "Containerize each app" candidate. Decision-
impact cull **N/A** (deploy-readiness/infra). Feasibility **pass to AUTHOR** — **Docker is NOT installed
here**, so artifacts are written correct-by-construction + reviewed; runtime build-verify (`docker build`/
`compose up`) is **deferred to a Docker Desktop install** (owner). Effort **M** · entry = **architect-first,
GATE-M-style infra fast-path** (skip PM/UX, no interface change). **Invariant watch:** additive/no app
change; **image-hygiene floor** (no secrets baked — `.dockerignore` excludes `.env`/`.venv`/`token.txt`/
`node_modules`/`data/`; env at runtime; non-root). **Known follow-on:** in-memory state resets per container
→ the `persistent-db` swap is the NEXT feature; deploy + host-pick follow that. Brief at
`.claude/contracts/containerize-apps/BRIEF.md`; routing to the Architect (GATE A·X).
**Program sequence:** `containerize-apps` → `persistent-db` (in-memory → managed Postgres behind the
existing store ports; set a stable `AI_KEY_ENCRYPTION_KEY`) → `deploy` (host pick: backend on Railway/Fly,
frontend on Cloudflare/Vercel, Postgres on Neon; CI/CD) → **activate Security/red-team (system-6)** at
go-live.

## Last GATE I — 2026-06-28 (owner request: hybrid bring-your-own AI key)
**Chosen → `byo-ai-key`** — owner-directed. **Hybrid** AI-key model: each signed-in user stores their own
Anthropic key (encrypted at rest) and the in-app AI rec calls with THEIR key; the shared `ANTHROPIC_API_KEY`
gives a free allowance **only to ADMIN users (3/day) — regular users get 0** (must BYO). Introduces a
**minimal admin concept** (no roles today) + **per-user metering** (today's cap is process-global) + **4
distinct gated states** (no-key-no-allowance / admin-with-uses-left / admin-exhausted / has-own-key).
Decision-impact cull **N/A** (enabler/cost-control — serve AI to many users without the owner bearing
per-user LLM cost). Feasibility **pass** (builds on the isolated `ai_recommendation.py` `LLMProvider` seam +
the shipped accounts system + a new encrypted `UserCredentialStore`; realizes the deferred BYO-key seam,
THREADS §7b). Effort **L** · entry = **architect-first** (per-request key-resolution seam, encryption-at-rest
seam + write-only/masked-reveal, admin mechanism, per-identity metering, the 4-state machine). **Invariant
watch:** `additive-keeps-score-byte-identical` (AI rec stays an isolated leaf), `best-effort-isolated-or-null`
(key/decrypt/LLM/over-limit failure → rec-surface-only `status`, never breaks bundle), `no-real-order-path`,
**security floor** (user keys ENCRYPTED not hashed — recoverable; server-side encryption key; never
logged/returned/in-browser; masked-reveal + rotate + delete), new `minimal-admin-not-RBAC`. **system-6
(Security/red-team) DEFERRED** by owner (encrypt+hygiene now); re-fires at the persistent/multi-user/public
trigger — BYO-key is its eventual first client. Brief at `.claude/contracts/byo-ai-key/BRIEF.md`; routing to
the Architect (GATE A·X).

## Last GATE I — 2026-06-28 (owner request: complete the Convexa rebrand)
**Chosen → `rebrand-convexa`** — owner-directed. Extend the rebrand from **UI-only to the whole codebase**:
rename ~71 `gammaflow` refs (apps/api comments/log-prefixes/title, apps/dashboard, libs/api incl. the
`gammaflow.ts` client + identifiers, docs, CLAUDE.md/AGENTS.md) → Convexa/convexa, set `project.json`
`project_name`, rename the GitHub repo `gammaflow → convexa`, and **migrate the 4 durable localStorage keys**
(`gammaflow.{positions.v2,ghost-trade.v1,personas.v1,uiprefs.v1}`) → `convexa.*` **loss-free**. **REVERSES
the locked "Convexa = UI-only" decision** (app-shell-landing GATE S; CONTEXT §1/§5, THREADS §7d) — a
deliberate owner GATE-Z reversal, formalized in canon at this feature's GATE S. Decision-impact cull **N/A**
(brand/infra class). Feasibility **pass** (no package renames — scope is `@org/*`; repo rename = `gh repo
rename` w/ redirect; storage migration reuses the proven positions v1→v2 pattern; backend refs look
cosmetic/no-interface-change). Effort **M** · entry = **architect-first** (rename map, the loss-free
migration seam, NO_BACKEND_CHANGE confirmation, non-goals — local working-folder NOT renamed; archived
contracts/ledger keep historical "GammaFlow" as record). **Invariant watch:** `[loss-free durable
migration]` (HARD — no saved data lost), `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`.
Brief at `.claude/contracts/rebrand-convexa/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-25 (owner request: user accounts / login / sessions / settings)
**Chosen → `user-accounts`** — owner-directed (not a queue-drain cull): add **email/username+password
signup & login + "Continue with Google" (OAuth) + a persisted server-side session**, backed by an
**in-memory SQLite** credential/settings store (prototype — resets on restart; designed with a
persistent-DB swap seam). Store **per-user settings — basics + light prefs only** (active persona /
default ticker / theme). **Hybrid access model (owner clarification):** the app stays usable
anonymously for browsing (Landing / Ticker-GEX viewer / Scanner stub), but **the sim Positions tracker
+ the in-app AI-rec "ask AI" call require a signed-in session.** Passwords **hashed (bcrypt/argon2),
never plaintext/never logged**; Google client secret + session key **server-side only** (env, like
`ANTHROPIC_API_KEY`). Decision-impact cull: **N/A** (enabler/infra class — judged on product value:
unlocks per-user persistence + gating + the **Track B `broker-connect` prerequisite**). Feasibility:
**pass**, config-gated for Google (needs a Google Cloud OAuth client; new backend deps → `requirements.txt`
+ `.venv`). Effort **L** · entry = **architect-first** (session mechanism, in-memory-SQLite + swap seam,
OAuth Authorization-Code flow, auth↔bundle isolation + auth's own real-HTTP-error class, per-user settings
store, the gated-surface enforcement boundary). **Invariant watch:** `additive-keeps-score-byte-identical`
(auth never touches scoring/SSE; no setting is a scoring input), `best-effort-isolated-or-null` (CARVE-OUT:
bundle path stays best-effort/None; **auth endpoints legitimately return 401/403/409** — the null-not-error
rule governs added *bundle computations*, not an auth surface), `no-real-order-path` (HONORED — accounts add
no broker/order path; Positions stays `SIMULATED`), `operator-vs-trader-path-separation` (kinship: auth must
not gate/perturb the anonymous trader path). **NEW note:** first stateful backend surface + first credential
store → narrows the "stateless server" property to the *trading path*; likely a GATE S ledger note, not a
GATE Z reversal. **Security:** red-team (**system-6**) DEFERRED by owner (in-memory = pre-live); re-activates
on real persistence / public exposure — the hygiene floor above is mandatory regardless. Brief at
`.claude/contracts/user-accounts/BRIEF.md`; routing to the Architect (GATE A·X). *(Note: `scanner` +
`gamma-unification` stay queued behind this owner redirect — not dropped.)*

## Last GATE I — 2026-06-25 (owner request: ticker-page load UX + latency; gamma question raised)
**Chosen → `ticker-load-experience`** — owner-directed redirect (displaces `scanner` as the next Track-A
item; scanner stays queued, not dropped). Make `/ticker/:symbol` load fast + feel instant + show a trusted
price. Three additive moves: (1) **skeleton-first load** (replace the single full-page spinner —
`TickerDashboard.tsx:497,512` — with per-component skeletons that render independently); (2) **latency**
— parallelize the 3–4 **sequential** vendor fetches (`main.py:261-267` + `off_exchange`; vendor I/O is the
dominant cold-miss cost) + trim on-path `persist`, measured against `/_ops/metrics` p50/p95; (3) **live
last-trade** readout alongside the mid (surface `live.py:160`'s already-tracked `last_trade_price`, never
broadcast today) + reflect the **real-time options tier** in freshness/cache config. Decision-impact cull:
passes (speed + trust of the primary surface; observable via TTFMP + a measured `vendor_fetch` drop + a
visible broker-matching last-trade). Feasibility pass (skeletons = MUI; parallelize = `asyncio.gather` over
existing `to_thread`; last-trade = surface one field; config = env — magnitude needs a live key, the
architecture doesn't). Effort M · entry = **architect-first** (skeleton-vs-split [split is a trap w/o
request-coalescing — `_serve` has no in-flight dedup], fetch-parallelization shape, last-trade as a
display-only sibling of the mid). **Invariant watch:** `additive-keeps-score-byte-identical`,
`best-effort-isolated-or-null`, `live-vs-static-isolation`; **`live-spot=NBBO-mid` HONORED** (last-trade is
additive display — mid stays the levels anchor; carve-out, not a reversal); **`gamma-sourcing-split` NOT
touched** (→ Track 2). Brief at `.claude/contracts/ticker-load-experience/BRIEF.md`; routing to the
Architect (GATE A·X).

**New parked track → `gamma-unification` (measure-first; see §C below).** Owner asked: with the advanced
real-time tier + full chain, compute our OWN analytic gamma for the walls so they're consistent with the
flip. Finding: the engine **already** computes analytic BS gamma (`engine.py:_calc_gamma`/`_gex_curve`) for
the flip + vanna/charm/volga; only the walls/net-GEX use **vendor** gamma (`engine.py:316`). Unifying =
point the walls at the math we already run. **Owner decision (2026-06-25): MEASURE FIRST** — spike that
computes analytic gamma alongside vendor gamma and quantifies wall/flip divergence on real tickers, BEFORE
any canon change. Honors the standing "measure the divergence before calibrating" rule (§9). Only after the
numbers: a GATE Z reopen/demotion of the locked **`gamma-sourcing-split`** rule, then a GATE M
implementation. Not bundled into `ticker-load-experience` (different risk class — core math).

## Last GATE I — 2026-06-24 (OWNER PIVOT: positions-centric, brokerage-connected, multi-page) — PROGRAM
**Strategic repositioning.** GammaFlow shifts from a single-ticker GEX dashboard into a **multi-page
product**: connect your brokerage positions → get **AI recommendations** built on the GEX profile +
heuristics we compute per ticker. Surfaces: a **landing/splash** page (brand/hooks), a **Ticker viewer**
(today's GEX dashboard, relocated), a **Scanner** (multi-ticker), and a **Positions** page (the shipped
sim portfolio, expanded, + AI-recs-on-positions + open-sim-trade), eventually fed by **real broker
positions**.

**Owner decisions (this GATE I):**
1. **Order boundary — narrowed, not full.** Connect a broker to **read real positions** (+ AI recs on
   them); **trades stay simulated — no real order execution.** This **narrows the promoted
   `no-real-order-path` canon** to "no real order *execution*" (reading real positions is now permitted).
   *Pending formal demotion at the broker feature's GATE S* (precedent: `ai-external-no-llm`); Track A does
   NOT exercise it (stays fully simulated/sim-only).
2. **Broker integration — direct per-broker, Webull first** (not an aggregator). Feasibility-gated:
   Webull third-party positions access is uncertain/region-gated → the broker feature is **blocked-on**
   verifying Webull API access; design a **`PositionsProvider` port** (mirroring the market-data provider
   port) so the broker is a contained adapter.
3. **Sequence — Track A first.**

**Security / going-live (system-6 activation):** connecting a real account is the **"going live" trigger**
the roadmap waited for → re-promote the deferred **Security/red-team role (system-6)** + first-class
credential handling when **Track B** starts. Track A (no real account) does not trigger it.

**Decomposition (groom + run ONE at a time through the pipeline):**
- **Track A — buildable now, NO broker, mostly FE:**
  - `app-shell-landing` ← **CHOSEN FIRST**: multi-page routing shell + nav/layout + **landing/splash**
    page; relocate the existing GEX dashboard → `/ticker` and the positions portfolio → `/positions`
    unchanged; `/scanner` nav stub. FE-only restructure + one new page; reuses every shipped feature.
  - `scanner`: multi-ticker scan page. **Invariant watch:** revisits the locked "single-ticker,
    on-demand" decision (the watchlist scan was dropped for being too slow) — must re-justify + design for
    perf (batch/throttle/cache). Promotes the parked §D multi-ticker-scanner item.
  - `positions-page-expansion`: expand the sim portfolio into the full Positions page + **AI recs on
    positions** (reuse `ai-recommendations` + the deferred position-aware `reassessment_prompt` seam) +
    open-sim-trade.
- **Track B — gated on decisions 2 + security:**
  - `broker-connect`: Webull-direct, **read-only** real positions via the `PositionsProvider` port; lands
    in the shipped positions "Live" tab seam; triggers the `no-real-order-path` narrowing + system-6.

Brief for the chosen first feature at `.claude/contracts/app-shell-landing/BRIEF.md`; routing to the
Architect (GATE A·X).

## Last GATE I — 2026-06-24 (owner request: positions portfolio)
**Chosen → `positions-portfolio`** — owner-directed: evolve the shipped ghost-trade tracker from a single
open sim position into a **multi-position portfolio** — a central all-positions view + per-ticker filtered
view, each position tracking its own P/L **and the change in it**, modern/organized/customizable
(columns/sort/filter, grouping, layout+density, durable saved views). Two view tabs: **Simulated**
(functional paper-sim) and **Live** (a present-but-**LOCKED** real-broker placeholder — no broker, no
order path, reflected in the UI but not implemented). Options contracts; the simulator fills at a
user-input price OR via market/limit on the live price. Decision-impact cull: passes (improves
hold/trim/exit position management). Feasibility pass (reuses mark/store/`TradeEntryDialog`/`GET
/api/contract`; Live is a stub ⇒ no vendor dependency). Effort L · entry = architect-first. **Invariant
watch:** `no-real-order-path` HONORED (Live is non-functional, no order path), `additive-keeps-score-
byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`. Brief at
`.claude/contracts/positions-portfolio/BRIEF.md`; routing to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (owner request: in-app AI recommendations)
**Chosen → `ai-recommendations`** — owner-directed (not a queue-drain cull): an in-app query to a
downstream LLM (latest Claude) for a **risk-first ENTRY recommendation**, fed the active persona's
assembled prompt + a **JSON export of the ticker's computed state**, rendered in the dashboard; the
manual hand-off is retained + augmented by the same JSON export; on-demand with `ai_eval` guardrails.
**Reverses promoted canon `ai-external-no-llm` by explicit owner decision** (GammaFlow may now call an
LLM via an isolated, gated, consumer-only path) → pending formal demotion at GATE S. Trading-decision
cull: passes (improves the entry decision). Effort L · entry = architect-first. Brief at
`.claude/contracts/ai-recommendations/BRIEF.md`; routed to the Architect (GATE A·X).

## Last GATE I — 2026-06-23 (pull: local latency visualization)
**Chosen → `latency-visualizer`** — carve the *visualization* slice out of §D "Observability
extensions," pulled by a concrete need (watch the already-measured bundle-stage latency locally +
free, pre-live). Brief at `.claude/contracts/latency-visualizer/BRIEF.md`; entry = architect-first
(stateless-client vs persisted-history is the pivotal call). Trading-decision cull N/A (operator
tooling — judged on operational value). The export/alerting/persistence rest of §D stays parked.

## Last GATE I — 2026-06-22 (pipeline had drained; 4 features archived)
**Chosen → `trader-personas`** (the only candidate clearing both decision-impact + feasibility;
Value H × Effort M). Brief at `.claude/contracts/trader-personas/BRIEF.md`; entry = architect-first.
Cull verdicts (so the next discovery doesn't re-litigate):
- **Parked, cleanliness/no observed friction:** flip-anchoring (user confirmed flip is fine),
  wall-distance guard (hasn't shown up live).
- **Blocked-on a decision/measurement (not a build):** vendor/overnight (cost-eval decision first),
  flip fixed-IV modeling (measure the divergence first).
- **Parked, scope/justification:** ghost-trade→real path (scope shift off paper-sim), multi-session
  dark-pool (dark-pool is locked context-only, never directional — §8), observability extensions
  (operator-facing, not a trading decision), multi-ticker scanner (revisits the single-ticker
  decision; needs re-justification).

## Pool

### A. Queued / in-mind (decided to build next)
- **`deploy`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/deploy/` (artifacts + hardening; the live
  deploy is owner-applied via the runbook). Step 3 of the infra program. Backend → Railway (Dockerfile +
  managed Postgres), frontend → Cloudflare Pages, cross-origin `/api` via a streaming Pages Function. Repo
  R1–R4 (`$PORT` CMD, env-gated CORS, the Pages Function, `/api/_metrics` edge-block). **system-6
  Security/red-team FIRST ACTIVATION** (different model) = GO-WITH-REQUIRED-FIXES → **3 HIGH closed**
  (metrics token-gate `METRICS_SECRET_TOKEN`; per-IP rate-limit `PUBLIC_RATE_LIMIT_PER_MIN` on the anon
  ticker/SSE endpoints; stable-key startup WARNING); 3 MED + 3 LOW fast-follows in `SECURITY_REVIEW.md`.
  No scoring change. **GATE S graduated `no-secrets-in-image`** (3 binding). **✅ LIVE 2026-06-29:**
  https://convexa.pages.dev (Cloudflare Pages) → Pages Function proxy → https://convexa-production.up.railway.app
  (Railway, app on `$PORT`=8080) + managed Postgres; smoke test PASS (SPA 200, proxied `/api` returns real
  backend JSON). Post-launch hardening pending: `ALLOWED_ORIGINS`, the 6 MED/LOW security fast-follows, CI/CD,
  custom domain, prerender/SEO.
  Seams → OPEN_THREADS §7k. **Fast-follows queued (§B):** the 6 MED/LOW security items; a CI/CD workflow; a
  custom domain; centralizing the per-replica metering counters.
- **`persistent-db`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/persistent-db/`. Step 2 of the
  infra program (backend infra fast-path). Added a **persistent Postgres adapter** (`src/auth/postgres_store.py`,
  psycopg3 sync raw-SQL behind the existing 4 auth ports; pool; idempotent bootstrap; ciphertext-only) selected
  by `ACCOUNT_STORE=postgres`+`DATABASE_URL` (**in-memory stays default**); `service.py`/`router.py` settings
  fail-closed hardening; deps `psycopg[binary]`+`psycopg-pool`; `.env.example` stable-key block. So
  accounts/sessions/settings/encrypted-AI-keys **survive restarts + span replicas** (the externalize-state
  step). DB-outage = auth fails closed (503/anon), trader path stays up. **No interface/UI/scoring change**
  (in-memory conformance PASS, no regression). **Live-Postgres verify DEFERRED** (no Postgres in dev box) —
  verified by parity review + the in-memory regression proof. **GATE S graduated `secret-encrypted-at-rest`**
  (2 binding); `no-secrets-in-image` held to `deploy`. Deferred seam: per-admin metering counters are
  process-local (not shared across replicas). Seams → OPEN_THREADS §7j. **Next:** `deploy`.
- **`containerize-apps`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/containerize-apps/`. Step 1 of
  the infra/deploy program (GATE-M-style infra fast-path; PM/UX skipped). Authored 7 Docker artifacts:
  `apps/api/Dockerfile` (python:3.12-slim, non-root uid 10001, explicit COPYs, socket healthcheck, uvicorn
  0.0.0.0 no-reload), `apps/dashboard/Dockerfile` (multi-stage: `nx build @org/dashboard` at repo-root
  context → unprivileged nginx serving `dist` + SSE-safe `/api` proxy), `nginx.conf`, root + `apps/api`
  `.dockerignore`, root `docker-compose.yml` (one-command local stack, runtime env_file, stateless documented),
  `apps/api/.env.example` (value-less; gitignore negation `!apps/api/.env.example` added to track it).
  **No app code / requirements changed.** **Image-hygiene floor verified** (no secrets baked — conductor
  static review PASS). **Docker NOT installed here** → runtime build-verify (`docker compose up --build`)
  **deferred to a Docker Desktop install** (owner). New ledger watch-list key `no-secrets-in-image`. Seams →
  OPEN_THREADS §7i. **Next:** `persistent-db` (in-memory → managed Postgres; stable `AI_KEY_ENCRYPTION_KEY`)
  → `deploy` → system-6.
- **`byo-ai-key`** — `✓ SHIPPED + ARCHIVED (2026-06-29)` → `_archive/byo-ai-key/`. Hybrid per-user AI key:
  each user stores their own Anthropic key (encrypted, Fernet, write-only/masked) and the AI rec calls with
  THEIR key (own-key-first); the shared key gives admins only a free allowance (`AI_REC_ADMIN_EMAILS`,
  default 3/day); regular users 0 → must BYO. 5 resolution states incl. `shared_key_unconfigured`. New
  `UserCredentialStore` + `src/auth/crypto.py`; per-request resolution at the `main.py` boundary; AI rec
  stays an isolated leaf (score byte-identical). QA PASS (Sonnet, de-correlated; AC-19 named-test gap caught
  & fixed → re-run 26/26; security floor clean; dashboard 313/313 + `@org/api` 13/13). **GATE S graduated
  `server-side-gate-enforcement`** (2 binding) into canon; new watch-list key `secret-encrypted-at-rest`.
  Realizes the deferred ai-rec BYO-key seam. `system-6` still deferred (credential custody → its eventual
  first client). Seams → OPEN_THREADS §7h.
- **`rebrand-convexa`** — `✓ SHIPPED + ARCHIVED (2026-06-28)` → `_archive/rebrand-convexa/`. Completed the
  GammaFlow→Convexa rebrand from UI-only to the whole codebase (134 refs / 51 files): identifiers, the
  `gammaflow.ts`→`convexa.ts` client, backend logger/title, docs/README/CLAUDE.md, `project.json`, the
  GitHub repo (`gammaflow`→`convexa`), and a **loss-free migration of the 4 durable localStorage keys**
  `gammaflow.*`→`convexa.*` (reusable `resolveDurable` helper composing with the positions v1→v2 chain).
  **REVERSED the app-shell-landing "UI-only" decision** (updated in place, not a Promoted-canon demotion).
  Cosmetic to the engine — score/`state_fingerprint` byte-identical. QA PASS (Sonnet, de-correlated —
  23/23 ACs; dashboard 283/283 + `@org/api` 7/7). New watch-list key `loss-free-durable-migration`. STAYS:
  `@org/*` scope, `DATA_DIR`, local folder, archived history. Seams → OPEN_THREADS §7g.
- **`user-accounts`** — `✓ SHIPPED + ARCHIVED (2026-06-25)` → `_archive/user-accounts/`. Both lanes: the
  project's first stateful backend surface — email/username+password auth + server-side sessions + per-user
  light prefs (active persona / default ticker / theme) over in-memory SQLite behind a 3-port swap seam
  (`src/auth/` one-way leaf; resets on restart); **Google OAuth wired but config-gated OFF** (enable via env,
  no rebuild); **hybrid access** (anonymous browsing open; sim Positions WRITE actions + "ask AI" require a
  session, server-enforced). Additive — score/tier/`state_fingerprint` byte-identical. QA PASS (Sonnet,
  de-correlated; AC-E7 server-gate FAIL bounced+fixed → GATE Q re-run 30/30, conformance 2/2, `dashboard`
  246/246 + `@org/api` 7/7). GATE S: narrowed the "stateless server" property to the trading path; new
  watch-list key `server-side-gate-enforcement`. Seams → OPEN_THREADS §7f. **Unblocks Track B
  `broker-connect`** (the accounts prerequisite is now met; broker-connect stays gated on the Webull-access
  verification + the system-6 go-live trigger).
- **`ticker-load-experience`** — `✓ SHIPPED + ARCHIVED (2026-06-25)` → `_archive/ticker-load-experience/`.
  Both lanes (commit `10971f3`): chain pre-warm (cold 7.8s→1.2s on an active session) + 3-fetch concurrency
  + request-coalescing + skeleton-first load + live `last_trade` readout + real-time freshness config.
  Additive — score/tier/`state_fingerprint` byte-identical. QA PASS (Sonnet, de-correlated — 26/26 ACs,
  conformance 2/2, 196/196 tests). **GATE S narrowed** the `live-spot=NBBO-mid` resolved decision (system-7:
  mid stays the anchor; display-only last-trade readout added). Seams → OPEN_THREADS §7e.
- **OWNER PIVOT program (positions-centric, multi-page):** Track A = `app-shell-landing` ✓ SHIPPED →
  `scanner` (still queued, was-next; deferred behind the owner's 2026-06-25 ticker-load redirect) →
  `positions-page-expansion`; Track B (gated) = `broker-connect`. See the "Last GATE I — OWNER PIVOT" note.
- **app-shell-landing** — `✓ SHIPPED + ARCHIVED (2026-06-24)` → `_archive/app-shell-landing/`. FE-only
  rebrand → **Convexa** (UI-only) + multi-page IA: `/` landing, `AppShell` nav, relocated `/ticker/:symbol`
  + `/positions`, static `/scanner` stub. Page-scoped SSE; store persists across nav; `NO_BACKEND_CHANGE`.
  Frontend `e8f8c06`; QA PASS (Sonnet, de-correlated — 42/42 ACs, 171 tests, no regression). GATE Z
  (wording) resolved as a carve-out. Feature 1 of the pivot. Seams → OPEN_THREADS §7d.
- **positions-portfolio** — `✓ SHIPPED + ARCHIVED (2026-06-24)` → `_archive/positions-portfolio/`. FE-only
  (`NO_BACKEND_CHANGE`) multi-position evolution of the ghost-trade tracker: central all-positions +
  per-ticker views, per-position P/L + Δ + trend sparkline, grouping + subtotals, customization + durable
  saved views, closed/history; entry simulator with manual/market/limit fills (resting limit fills only on
  a live cross); **Simulated** functional + **Live** zero-import LOCKED placeholder. Frontend `f7334e2`;
  QA PASS (Sonnet, de-correlated — 41/41 ACs, 130 tests). **GATE S graduated `no-real-order-path`** into
  canon (2 binding). Seams → OPEN_THREADS §7c.
- **ai-recommendations** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/ai-recommendations/`. In-app
  downstream-LLM query for a risk-first **entry** rec (active-persona prompt + JSON state export →
  rendered rec; Accept → paper-sim ghost trade; manual export floor). GammaFlow's first LLM call —
  isolated/gated/advisory consumer; score byte-identical. **DEMOTED `ai-external-no-llm`** (system-7,
  narrowed). Backend `eec3a3a`; frontend `42212f5`+`a2f6ae3`. QA PASS (Sonnet, de-correlated; E3 traceability
  catch resolved). Seams → OPEN_THREADS §7b. GATE Z reconciled the conformance-spec convention → system-12.
- **latency-visualizer** — `✓ SHIPPED + ARCHIVED (2026-06-23)` → `_archive/latency-visualizer/`.
  FE-only (`NO_BACKEND_CHANGE`): a local, ephemeral `LatencyTrend` card atop `/_ops/metrics` that
  trends the existing `GET /api/_metrics` windowed snapshots (per-stage/total/cache/vendor-latency
  p50/p95/max + headroom) via one stable poll loop (the page's single fetcher) + a bounded in-browser
  ring buffer; honest gaps / restart-break / stale-repeat, non-alerting, local Export only. Held
  `[operator-vs-trader-path-separation]` + `[best-effort-isolated-or-null]` (both logged at GATE S).
  **Parked (rest of §D):** OTel/Prometheus export, latency/headroom alert thresholds, persisted/
  cross-restart history, server-side store.
- **trader-personas** — `✓ SHIPPED + ARCHIVED (2026-06-22)` → `_archive/trader-personas/`. Both lanes
  landed (backend `1026190`; frontend `6dcdbe1`/`1233718`); persona reframes the AI hand-off only,
  gate/score/tier/fingerprint byte-identical, FE-rendered assembly. Seams it left → section D.
  (`OPEN_THREADS` §7)

### B. Ready candidates (feasible, small, unscheduled)
- **Convexa-redesign — finish the FE re-skin program** — `RAISED 2026-06-30 (Ticker surface re-skinned in code this session)`.
  The `convexa-redesign` branch now re-skins the **Ticker** surface to the Figma DS in code: `TickerDashboard`
  componentized into `ticker/sections/*` (Toolbar, Header, LiveTape, DealerPositioning, GexStrikeProfile,
  TermStructure, FreshPositioning, OffExchangeBlocks, Setups, StatTile, TintChip) + the AI-rec panel re-skin
  (signed-in + signed-out states). GEX is a **vertical** diverging bar chart; Term-structure sits **side-by-side
  with AI-rec** (equal-height row); section titles use the DS size via `theme.h6` (Inter Semi Bold 16).
  `nx test dashboard` 412/412, lint clean. **Pending follow-ups:**
  - **MUI-kit publish/update (OWNER UI — can't be scripted):** Foundations is now the full MUI palette (76 vars,
    Dark/Light) and the kit's `palette/*` aliases it. Owner must **Publish** the MUI kit (file `eJ9qzhA6rNxwk2KVQA9AvU`)
    → **Update** the library in the design file → then set the `Screens - *` frames to the kit's **dark** mode.
    Until then, MUI-kit instances on the screens don't inherit the brand theme.
  - **Token-binding retrofit + cleanup:** bind the remaining ticker/shell components to Foundations `color/*` +
    `Type/*` per `THEME_TOKENS.md` (Toolbar is the done template); **remove the now-dead `HandoffDialog`** in
    `personas/components.tsx` (AI-rec no longer opens it — the hand-off viewer was removed per owner); **update
    `THEME_TOKENS.md`** to record the expanded Foundations + kit aliasing; **QA the global `theme.h6` 16/600 change**
    for regressions on Positions/Settings/Landing section titles.
  - **Remaining surface + ship:** the full-page **`/auth`** route; a fresh **QA pass** vs
    `design_handoff_convexa_redesign/README.md` ACs + the 8 invariants; **merge `convexa-redesign` → main** (GATE S).
  - **Intentional Figma deviations (record, don't "fix"):** GEX is a **vertical** diverging bar chart (not the
    horizontal Figma `149:172`) — owner UX call (wider/shorter); the AI-rec **hand-off viewer** + the ticker's
    **portfolio/ghost-trade panels** were **removed** per owner. *Value H (ship the redesign) · Effort M.*
    Decision-impact cull **N/A** (FE redesign program; judged on design-conformance + ship-readiness).
- **Prerender public pages (SSG) + SEO hygiene** — `RAISED 2026-06-29 (post-launch optimization; SSR evaluated
  + rejected)`. Optimize first-paint + SEO for the PUBLIC pages WITHOUT full SSR (which was evaluated and
  rejected: a Vite-SPA→Next/Remix/Vite-SSR migration + a per-request render server would break the free
  static Cloudflare Pages model, and the app's value — live GEX charts/SSE/per-user positions/auth — is
  inherently client-side/private and can't/shouldn't be crawled, so it hydrates client-side regardless).
  **Scope:** (1) **prerender the landing page** (and the `docs/blog` post if we surface it) to static HTML at
  build time — e.g. `vite-react-ssg` or a small prerender step — so it's crawlable + paints instantly, while
  the app pages (ticker/positions/settings) stay the CSR SPA; (2) **SEO hygiene** regardless of rendering:
  per-page `<title>` + meta description, **Open Graph/Twitter-card tags** (link previews), `sitemap.xml`,
  `robots.txt`, semantic HTML on the landing page. Stays free-static on Cloudflare Pages (no render server);
  Pages supports adding true SSR via Functions later if ever needed. *Impact:* the landing page is the only
  SEO-relevant surface (the app is a private/interactive tool) — this captures ~all the SEO + first-paint
  upside at a fraction of SSR's cost. Decision-impact cull **N/A** (UX/marketing/infra class). *Value M (SEO/
  first-impression) · Effort S–M.* **Do after launch** (deploy first). Origin: owner SSR question 2026-06-29.
- **Containerize each app (Dockerfile per deployable) + deployment readiness** — `RAISED 2026-06-25
  (owner; hosting/deploy planning)`. One `Dockerfile` per deployable — the **FastAPI backend** (`apps/api`,
  uvicorn) and the **React/Vite frontend** (`apps/dashboard` → static build, served via a CDN/static host
  or an nginx container) — plus an optional `docker-compose.yml` for a one-command local full-stack run. In
  the **Nx monorepo** each app sets its own build context/root. *Impact:* makes the **host a swappable
  decision** (the same container runs on Railway / Render / Fly.io / Cloud Run / a Hetzner VPS) — the key
  anti-lock-in move; **prerequisite for any real deployment.** *Value M (deployment readiness) · Effort M.*
  **Build-system/infra class — trading-decision cull N/A** (judge on deploy portability, not trading edge).
  **Context:** **GitHub** chosen as the remote git host (2026-06-25; *remote not yet created/pushed* — the
  repo is still local-only). Relates to the **go-live trigger** (re-promotes the Security/red-team role
  system-6) + the hosting options weighed this session (Cloud Run / Railway / Fly / Hetzner+Coolify;
  frontend on Cloudflare Pages / Vercel / Firebase Hosting). Follow-on: a GitHub Actions CI/deploy workflow
  (run `nx test` + conformance on push, then deploy).
- **Live gamma-flip anchoring** — outside RTH, anchor the flip search to `gex_spot` (close) not the
  live mid, so a gapped pre-market anchor can't select a different crossing; also drop the per-tick
  `Gamma flip $…` INFO log to debug. *Impact:* a steadier, more consistent displayed flip across
  sessions. *Value M-low (you've said the displayed flip is fine) · Effort S.* Cleanliness. (`OPEN_THREADS` §7)
- **Wall-selection distance/DTE guard** — keep a deep-OTM round-number LEAP strike from becoming
  "the wall" far from spot. *Impact:* wall levels stay near the tradable zone. *Value M · Effort S.*
  **Invariant watch:** walls stay the gamma-based max/min net-GEX strike — a guard, not a redefinition.
  Bite only if it shows up live. (`OPEN_THREADS` §7)
- **Decision-Ledger crossing-detection hook** *(methodology/tooling — not a trading feature)* —
  mechanize the DETECT step of compounding memory: a `settings.json` hook (or small script) that
  tallies `DECISION_LEDGER.md` keys and flags when one crosses the promotion threshold (≥3 shipped
  features / ≥2 if binding), so at GATE S the Orchestrator is *told* "key X just crossed" instead of
  tallying by hand. *Impact:* orchestration reliability — a promotion can't be silently missed; the
  compounding loop fires even on a tired/long session. *Value M · Effort S.* **Note:** the
  decision-impact cull (trading-decision test) is **N/A** here — judge it on loop-fidelity, not edge;
  the promotion *judgement* + prose still stay with the Orchestrator (the hook only counts). Follow-on
  to the just-shipped Decision Ledger (`.claude/DECISION_LEDGER.md`; ORCHESTRATOR §3a).

- **Engine higher-order-greek determinism** *(correctness hygiene — not a trading feature)* — `SURFACED
  2026-06-25 (ticker-load-experience GATE Q)`. `engine.process_gex_profile` shows ~9th-significant-digit
  float reduction-order jitter in `net_vanna`/`net_charm`/`net_volga` across identical inputs (a pre-existing
  Python accumulation-order artifact, independent of the pre-warm/concurrency work). *Impact:* none observed
  on the trading path — `opportunity_score`, all score inputs (`net_gex`/`gamma_flip`/walls/`max_pain`/
  `put_call_ratio`), and `state_fingerprint` are byte-stable; only the three display-only higher-order greeks
  jitter sub-visibly. *Fix:* a deterministic reduction (e.g. sorted/Kahan/`fsum` accumulation) in the GEX
  pass. *Value L · Effort S.* **Decision-impact cull N/A** (correctness hygiene). Park until it ever surfaces
  visibly; not blocking.

### C. Strategic / blocked (high value, gated on a decision or heavy lift)
- **Data-vendor decision + overnight coverage** — Massive vs Databento (Blue Ocean overnight, full
  OPRA) vs Webull (cheap overnight underlying, no options). *Impact:* unlocks the overnight price gap
  — the core coverage hole. *Value H · Effort L.* **Blocked-on:** the cost/eval decision itself
  (verify whether Databento Standard $199 includes Blue Ocean). This is a *decision* before a build.
  (`OPEN_THREADS` §1/§2/§9)
- **Multi-session dark-pool accumulation map** — beyond the current bounded recent window; needs a
  heavier batched pull. *Impact:* see block accumulation across sessions, not just the last hour.
  *Value M · Effort L.* Future. (`OPEN_THREADS` §7/§9)
- **Flip fixed-IV-under-spot-move modeling** — the latent choice of holding IV fixed while repricing
  across the spot grid in the flip search. *Impact:* flip fidelity. *Value TBD · Effort L.*
  **Blocked-on:** measure the divergence first before any calibration (per §9 — judged immaterial so far).
- **`gamma-unification` — own analytic gamma for the walls (consistent flip)** — `RAISED 2026-06-25
  (owner); MEASURE-FIRST`. Today walls/net-GEX use **vendor** gamma (`engine.py:316`) while the flip +
  vanna/charm/volga use our **analytic** BS gamma (`engine.py:_calc_gamma`/`_gex_curve`) — the documented,
  locked `gamma-sourcing-split`. Owner wants them unified (one gamma model → walls & flip consistent),
  enabled by the advanced real-time tier (full chain + fresh IV) and de-blocking the Databento path (no
  vendor greeks). *Impact:* consistency + vendor independence. *Value M-H · Effort M (impl) + S (spike).*
  **Step 1 (owner-decided): a MEASUREMENT SPIKE** — compute analytic gamma alongside vendor gamma, quantify
  wall/net-GEX/flip divergence on real tickers (needs a live `MASSIVE_API_KEY`). **Then** GATE Z reopen/
  demotion of `gamma-sourcing-split` → GATE M implementation. **Risk:** American-exercise/illiquid-IV model
  fidelity; reopens locked core-math canon (CONTEXT §3 / THREADS §9). Honors §9's "measure before calibrating."

### D. Shipped-feature seams (park until a concrete need pulls them)
- **Ghost-trade → real path** — broker `FillSource`/`PositionStore`, `BundleFeed`+clock replay,
  recorded-verdict reassessment, server-side trade store. *Note:* implies leaving paper-sim for a real
  order path — a deliberate scope shift, not an increment. Park until going live. (`OPEN_THREADS` §5)
- **Observability extensions** — OTel/Prometheus export, latency/headroom alert thresholds,
  persisted cross-restart baselines. *Value M · Effort M.* Pull when operating the service in earnest.
  (`OPEN_THREADS` §6) **Note:** the *local visualization* slice was carved out → `latency-visualizer`
  (§A, promoted 2026-06-23); what remains here is **export + alerting + cross-restart persistence**
  (the parts that imply external infra / going-live ops).
- **Multi-ticker scanner** — the observability baseline data supports it. *Value M · Effort M-L.*
  **Invariant watch:** revisits the deliberate "single-ticker, on-demand" decision (the watchlist scan
  was dropped for being too slow) — re-justify before promoting. (`OPEN_THREADS` §6, `PROJECT_CONTEXT` §5)
- **Persona data single-sourcing (FE↔BE reconciliation)** — the backend ships the canonical
  decomposed template + 7 presets at `GET /api/personas` (transport filed as a late interface
  amendment, after the FE froze), but the FE **embeds** a faithful copy and assembles client-side, so
  the canonical preset/prompt data is **dual-sourced** (drift risk). *Impact:* an operator edit to a
  preset/prompt would reach the AI briefing instead of silently diverging — concrete need = first time
  presets are edited server-side. *Fix:* FE hydrates presets/template from `GET /api/personas`, keeping
  the embedded copy as offline/assembly-failure fallback. *Value M · Effort S.* Behaviour is correct
  today; not blocking. (`OPEN_THREADS` §7)
- **Persona conservative-disposition cleanup** — UX/FE gave `conservative` the *softened* disposition
  text, but the backend Verification required it to contain "prone to greed"; resolved pragmatically as
  a **superset** (harsh phrase + map text). *Fix:* decide whether conservative should be softened-only
  and amend the prompt template + contract if so. *Value L · Effort S.* (`OPEN_THREADS` §7)
- **Persona deferred extensions** — multi-device sync, operator-shared persona library, richer
  customization knobs, per-persona acceptance analytics (decision-history harvest). *Value M · Effort
  M.* Park until a concrete need pulls them. (`OPEN_THREADS` §7)

### E. Methodology / system-of-building improvements *(improve the AI-role system itself, not the trading product)*
> Source: `docs/SYSTEM_ANALYSIS.md` (2026-06-23). The trading-decision cull is **N/A** for this class —
> judge each on **correctness, throughput, or cost of the build system**, not trading edge (same
> convention as the §B Decision-Ledger hook). Sibling already in the pool: the **Decision-Ledger
> crossing-detection hook** (§B) is the DETECT-step mechanization and belongs to this class.
>
> **Roadmap home moved (2026-06-24, system-13):** the **project-neutral** framework roadmap now lives in
> the kit's `KIT_BACKLOG.md` (`C:\Dev\delivery-kit`) — that is the framework's own GATE I pool, groomed
> via the kit-evolution loop (`docs/AUTHORING.md` there). The `system-N` entries below are **retained as
> GammaFlow's instantiation + provenance** (the evidence that earned each one); generic framework
> improvements are proposed/culled in `KIT_BACKLOG.md`, not here.
> **Binding sequencing:** *system-1 … system-6 land before system-9* — automating the conductor before
> the mechanical gates + adversarial roles removes the human review that currently provides
> error-correction (SYSTEM_ANALYSIS §7).

- **system-1 · Interface-conformance check** — `✓ LANDED (2026-06-23, runtime variant) →
  .claude/tools/interface_conformance.py`. Each `INTERFACE_CONTRACT.md` embeds a machine-checkable
  `## Conformance spec` ```json block (endpoints → required field paths/types/presence); the tool hits
  the live backend (`--url`) — or a captured `--sample` for CI/offline — and validates the emitted JSON
  against it (dot-paths, `name[]` array fan-out, `type|null` unions, `?` optional). A FAIL = the live BE
  omits/mistypes a field the interface promises (= what the FE consumes). Wired into **GATE Q** (QA runs
  it; FAIL → GATE Z to Backend) + GATE U·X (interface must embed the spec) + the §3 linter (WARNs if a
  locked interface lacks the block — system-3 ensures the spec EXISTS, system-1 ensures the live
  response MATCHES it). Tested vs the real `/api/_metrics` shape (pass / array-fanout / drift-fail).
  *Value H · Effort M.* **Deferred:** static FE-type cross-check (`@org/api` TS vs the interface) — the
  runtime path already proves BE-emits ⊇ interface; FE-consumes ⊆ interface is held by the FE binding +
  the linter's interface-binding check.
- **system-2 · QA / Verify role (a 6th role, with teeth)** — `✓ LANDED (2026-06-23)`: new **GATE Q**
  (ORCHESTRATOR §3, between the executioners and GATE S) + role launch prompt (`ROLE_LAUNCH_PROMPTS.md`
  §6) + subagent (`.claude/agents/qa-verify.md`, tools: Read/Grep/Glob/Bash/Write — no Edit) + manifest
  `QA (GATE Q):` field + the §6 invariant "GATE S requires a passing `QA_REPORT.md`." A fresh session
  confirms each AC point-by-point, **fixes nothing**, bounces gaps via GATE Z; GATE Q re-runs on the
  fix. *Impact:* ends "builders mark their own homework." *Value H · Effort M.* **Invariant watch:** QA
  stays in lane (verifies, never repairs). **Best run on a DIFFERENT model** than the builders — partial
  down-payment on system-6 (correlated-error fix).
- **system-3 · Contract linter (mechanical gate-check)** — `✓ LANDED (2026-06-23) →
  .claude/tools/contract_lint.py`; wired into ORCHESTRATOR §0 step 7 (runs every gateway, ERROR blocks
  the handoff). **Implemented checks:** _MANIFEST present + required keys; files the manifest marks
  locked/draft exist; execution contracts bind to INTERFACE_CONTRACT (NO_*_CHANGE stubs exempt); BRIEF
  has all required fields; NEW-endpoint-in-architect/PM-lane flagged (existing endpoints exempt via
  ground-truth); server-internals-in-FE / UI-in-BE lane-purity warns; promoted-canon single-source
  (every ledger Promoted key has prose in PROJECT_CONTEXT §5). *Value M · Effort M.* Pairs with the
  §B ledger-crossing hook (same script surface). **Deferred extensions:** AC↔component-state mapping
  check (now tracked + broadened as **system-10**, AC↔test traceability); optional `settings.json`
  PreToolUse/Stop hook to auto-run it (offer made); the legacy 4 archived features predate `_MANIFEST.md`
  (flag only on `--all`, not on live gating).
- **system-4 · Lane enforcement via role subagents** — `✓ LANDED (2026-06-23, tools-allowlist half)`:
  `.claude/agents/{delivery-architect,delivery-pm,delivery-ux,delivery-backend,delivery-frontend}.md`
  + the earlier `qa-verify.md`. Contract authors (architect/pm/ux) + QA have **no `Edit`/`Bash`** (cannot
  modify or run code); executioners get the build toolset (Read/Grep/Glob/Edit/Write/Bash). Wired into
  ROLE_LAUNCH intro + ORCHESTRATOR §1/§6. *Value M · Effort M.* Keeps each role's fresh-context
  isolation (subagents start clean).
- **system-4b · PreToolUse path-guard hook** — `✓ LANDED (2026-06-23) → .claude/tools/path_guard.js +
  .claude/settings.json`. `↻ UPDATED by the monorepo merge (2026-06-24)`: now a single **workspace
  fence** (`path_guard.js`; the Python `path_guard.py` is retired as a tool). A PreToolUse hook on
  `Write|Edit|MultiEdit|NotebookEdit` blocks any write whose resolved target is OUTSIDE the monorepo
  root (exit 2), with carve-outs for `~/.claude/projects/**/memory` and `~/.claude/plans` (Reads are
  never blocked). Tested; fail-open on malformed input. **Scope honesty:** a session-global hook can't
  see WHICH role/subagent is active, so it enforces the **out-of-workspace** fence robustly but NOT
  per-role intra-lane rules (e.g. "the architect can't touch `src/`") — that residual stays on the
  tool-allowlist (no `Edit`) + the role prompt. **Cross-repo fence + the gammaflow-web mirror are now
  N/A** — both lanes share one repo, so there is no second repo to fence against or mirror into.
  Lane separation between `apps/api` and `apps/dashboard` is instead reinforced mechanically by the
  ESLint `@nx/enforce-module-boundaries` rule on the project tags. *Value M · Effort S.*
  **Activation:** new `settings.json` ⇒ open `/hooks` once or restart.
- **system-5 · Ground-truth + ledger sharding (retrieval)** — `✓ LANDED (2026-06-23, logical-slice) →
  .claude/tools/context_for.py`. Each `## N.` section in `PROJECT_CONTEXT.md` carries an inline
  `<!-- shard: tags=...; always -->` annotation; the tool assembles the minimal pack from the BRIEF's
  `Context tags:` (+ Invariant-watch keys) + the always-load invariant floor (§3 math, §5
  decisions/promoted invariants). `--print` emits the pack; `--stat` shows savings (39–72% on current
  features, growing with the canon). **Single-source kept** (logical slice, no physical split → no drift,
  unlike the rejected fork). Added a `Context tags:` BRIEF field (ORCHESTRATOR §4a); wired into
  ROLE_LAUNCH intro + §6 invariant. *Value H (cost) · Effort M–L.* **Invariant honored:** §3+§5 are
  `always` — sharding never drops a binding rule. **Deferred:** ledger sharding (the Promoted-canon
  index is already compact, so minor); auto-deriving `Context tags` from the BRIEF's free text.
- **system-6 · Adversarial Security/red-team role (different model)** — `⏸ DEFERRED until live
  (decided 2026-06-23)`: pre-live, a different-model red-team adds model cost/overhead with low payoff —
  no real data, no external exposure, no untrusted input surface yet. **Re-promote on the "going live"
  lifted-constraint trigger** (handling real funds/data, public exposure, or untrusted external content).
  A session whose whole mindset is "what could be made to go wrong?": least-privilege per role, injection
  from fetched/external content, data leakage — run on a **different base model** so its blind spots
  don't correlate with the builders'. *Impact:* the only structural fix for correlated error (one model,
  all hats — SYSTEM_ANALYSIS §5). *Value H (correctness, once live) · Effort M.* **Note:** the QA role's
  "run on a different model" guidance is a partial pre-payment on the de-correlation benefit.
- **system-7 · Promoted-canon demotion path** — `✓ LANDED (2026-06-23)`: the inverse of graduation. A
  promoted invariant contradicted by reality (an accepted **GATE Z** amendment, or a **GATE Q**
  QA/conformance FAIL proving it false/over-general) is **demoted** — prose removed/narrowed in
  PROJECT_CONTEXT §5 + OPEN_THREADS §9, key moved to the DECISION_LEDGER "Demoted" table with the
  contradicting evidence (earning rows retained as provenance). `contract_lint.py`'s canon check follows
  automatically (a demoted key leaves Promoted-canon). Wired: DECISION_LEDGER "Demoted" section + GATE Z
  "Demotion check" step + §6 invariant. **Bar mirrors promotion:** a one-off feature carve-out is an
  *exception*, not a demotion. *Impact:* stops compounding memory from calcifying a wrong-but-repeated
  decision into law (SYSTEM_ANALYSIS §4.5). *Value M · Effort S–M.*
- **system-8 · Close the flywheel (observability → GATE I)** — add the shipped metrics as a first-class
  GATE I harvest source so Discovery grooms from measured reality, not guesses. *Impact:* the
  build→measure→discover loop becomes real. *Value M · Effort S.* **Depends-on:** `latency-visualizer`
  / the observability readout (§A/§D).
- **system-9-lite · fresh-subagent-per-gateway** — `✓ ADOPTED (2026-06-23)`: run each role as a FRESH
  spawn of its `.claude/agents/delivery-*` subagent (+ `context_for.py` pack), discarded after each
  handoff — instead of long-lived role terminals that accumulate context. Captures the freshness +
  lane-fencing win with **no new infra and human review intact** (the conductor is still you). Wired into
  `ROLE_LAUNCH_PROMPTS.md` ("Running a role — the LITE path"). The on-ramp to full system-9.
- **system-9 · Orchestrator-as-subagent-pipeline + parallel feature lanes** — automate the conductor so
  you *approve* gates instead of *running* them, and run several feature lanes at once (shared
  OPEN_THREADS to avoid collisions). *Impact:* removes the human-as-bottleneck. *Value H · Effort L.*
  **Binding:** do NOT promote before system-1…system-6 land (see the sequencing note above) — this one
  removes the human review the system currently leans on for correctness; the **lite path above is the
  adopted interim** until then.
- **system-10 · Contract-linter AC↔test traceability check** — `PROPOSED (2026-06-23), unscheduled`.
  Mechanize the standing **FE-tests rule's** AC↔test traceability (PROJECT_CONTEXT §7; committed
  `d69e240`) that QA enforces by judgment today: extend `contract_lint.py` (system-3) so every
  `PRODUCT_CONTRACT` AC (and every required case in the FRONTEND_EXECUTION_CONTRACT "Tests to write"
  matrix) must map to **≥1 colocated `*.spec.tsx` test** — an uncovered AC fails the check even if the
  suite is green. **Resurrects system-3's own deferred AC↔component-state mapping extension.** *Impact:*
  an uncovered AC can't slip past a green suite; closes the residual that traceability is currently
  human-judged. *Value M · Effort M.* **Build-system class:** trading-decision cull **N/A** — judge on
  build-system correctness. **Design notes / depends-on:** (a) runs at **GATE Q (post-build)**, not the
  inter-role handoffs — the tests don't exist until the FE builds, so it's a QA-invoked mode of the
  linter, complementing the runtime conformance check (system-1); (b) needs a stable **AC-id/anchor
  convention** in `PRODUCT_CONTRACT` so an AC can be matched to a named test (likely the first sub-step);
  (c) the linter and the FE specs now live in **one repo** (post-merge: `apps/dashboard` specs read
  from the workspace root) — no cross-repo read to worry about. Follow-on to the FE-tests rule + system-2/3.
- **system-11 · Cross-repo role-context on dispatch** — `✓ RESOLVED by the monorepo merge (2026-06-24)
  — dissolved, not implemented`. The whole problem was an artifact of the two-repo split: dispatching a
  FRONTEND executioner required `spawn_task --cwd` (the Agent tool couldn't cross the path_guard
  cross-repo fence), which **bypassed the role framework** (no `delivery-frontend` subagent, no
  `context_for.py` pack, no role launch prompt, chip named by action not role). Folding the backend
  into the Nx workspace put **both lanes under one repo root**: the frontend lane now spawns as a
  `delivery-frontend` **Agent subagent** with automatic report-back — same role/context discipline as
  every other lane, no `spawn_task`, no polling. The "spawn_task drops the role context" hole is gone
  because spawn_task-for-frontend is gone (ORCHESTRATOR §2). *Outcome:* the parked question is moot.
  **Origin:** raised 2026-06-23 after two *maintenance* tasks were dispatched ad-hoc; the merge
  (plan `ok-let-s-do-option-dapper-treasure`) was the chosen structural fix.
- **system-12 · system-1 standalone-spec standardization** — `DECIDED 2026-06-23 (standalone = canonical),
  partial`. The conformance spec drifted: docs say "embed a `## Conformance spec` ```json block in
  INTERFACE_CONTRACT.md," but the shipped precedent (`.claude/tools/conformance/api_metrics.json`) and the
  ONLY runnable form is a **standalone flat-schema file**. The UX (following the docs) embedded a rich
  nested block the tool can't run — heading `## 3. Conformance spec` breaks system-1's `##\s*Conformance
  spec` regex (yet system-3's linter accepted it: the two **disagree** on detection), and the nested
  enums/conditional/forbidden_fields schema isn't the tool's flat `{path_params,query,body,required}`.
  **Owner decision (2026-06-23):** the runnable spec is a committed standalone `.claude/tools/conformance/
  {feature}.json`; the interface's `## Conformance spec` section REFERENCES it (rich content stays as QA
  reference). **Done:** ai-recommendations interface points at its standalone spec; the backend added
  POST-body support to `interface_conformance.py` (additive, kept; `api_metrics.json` still passes).
  **Remaining (do before the next GATE U·X):** reconcile the authoring docs — `COMPRESSOR_PROMPTS #3`,
  `delivery-ux.md`, `ORCHESTRATOR §6 / GATE U·X / GATE Q`, `BACKLOG system-1` — to the standalone
  convention; tighten `contract_lint` M7 to verify the interface references an EXISTING standalone spec
  (it currently only string-matches "Conformance spec"); align the system-1 heading regex with system-3's
  looser detection so they agree. *Value M · Effort S–M.* **Build-system class:** trading-decision cull
  N/A. Surfaced by the backend executioner at the ai-recommendations fan-out (GATE Z).
- **system-13 · Framework portability — the delivery-kit extraction** — `✓ LANDED (2026-06-24)`.
  Extracted the reusable framework (orchestrator + role subagents + tools + commands + compressor /
  role-launch docs) out of GammaFlow into a standalone, updatable **delivery-kit** (its own repo at
  `C:\Dev\delivery-kit`), with GammaFlow as **consumer #1**. The decoupling rule: **framework files are
  byte-identical across projects** — all per-project coupling moved into one project-owned seam,
  `.claude/project.json` (backend/frontend dirs, ports, serve/test commands, interpreter, context
  filename, optional lane-purity), plus `PROJECT_CONTEXT.md` (renamed from the old context file). Tools
  read the seam programmatically; agents/commands read it at runtime; agents renamed `gammaflow-*` →
  `delivery-*`. `install.mjs` / `extract.mjs` forward + sync the framework as a **plain folder copy**
  (the payoff of full externalization), and `kit_lint.mjs` is the **mechanical decoupling guarantee** —
  a banned-token scan that ABORTS an extract if any project specific re-coupled a framework file (the
  same move as `contract_lint` / `path_guard`: mechanize the trusted invariant; it caught a real
  re-coupling during the build). *Impact:* the methodology now compounds **across projects**, not just
  across features within one — a refinement made in any consumer flows back to the kit and out to all
  (a sibling to the Decision Ledger's "get wiser per feature"). *Value H (reuse / maintainability) ·
  Effort L.* **Build-system class:** trading-decision cull **N/A** — judge on framework
  reusability/maintainability. **Open residuals (logged, not built):** (a) **no version-skew signal** —
  `.claude/kit.version` records what a consumer is on, but nothing alerts when it's behind the kit;
  (b) **no divergence reconciliation** — if two consumers refine the same framework file, `extract` is
  last-writer-wins; (c) **`project.json` is a new single point of misconfiguration** the conductor +
  tools now depend on (a wrong/empty seam silently degrades the gates — a `project.json` validator is
  the obvious follow-on); (d) the kit ships **no tests of its own scripts** (install/extract/kit_lint
  verified by hand at extraction). **Relation:** orthogonal to system-9 — portability, not conductor
  automation; **enabled by** the monorepo merge (system-11): one repo root ⇒ no cross-repo fence ⇒ the
  framework is a clean folder. **Origin:** owner request post-merge (2026-06-24).
