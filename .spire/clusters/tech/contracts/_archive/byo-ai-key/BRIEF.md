# byo-ai-key — brief

Goal:            **Hybrid bring-your-own AI key.** Each signed-in user can store their own Anthropic API key
                 (Settings); the in-app AI recommendation then makes that user's calls **with their own key**
                 (their cost, no shared cap). The shared server key (`ANTHROPIC_API_KEY`) provides a free
                 allowance **only to ADMIN users (3/day); regular users get 0 free** — without their own key
                 the AI feature is unavailable to them. This introduces a **minimal admin concept** (the app
                 has no roles today) and **per-user metering** of the shared-key allowance (today's cap is
                 process-global). Owner-required: **distinct, honest states** — (a) regular user, no key, 0
                 allowance → "connect your Anthropic key to enable recommendations"; (b) admin with free uses
                 left → works (show remaining); (c) admin out of free uses, no own key → "out of free uses,
                 add your key"; (d) any user with their own key → works on their key. Stored keys are
                 **encrypted at rest** (recoverable, NOT hashed) and never leave the server.

Decision impact: **N/A** (enabler / cost-control / infra class — trading-decision cull N/A). Lets the app
                 serve AI recs to multiple users **without the owner bearing per-user LLM cost**; observable
                 via the four states above behaving correctly per role + key presence.

Feasibility:    pass. Builds on three things already in place: the isolated one-way-leaf `ai_recommendation.py`
                 with its **`LLMProvider` seam** (resolve the key per-request instead of once from env), the
                 **accounts system** (sessions + per-user settings shipped in `user-accounts`), and the
                 **store-port pattern** (add a `UserCredentialStore`, mirroring `UserStore`/`SessionStore`).
                 Encryption = a standard lib (e.g. `cryptography` Fernet / AES-GCM) keyed by a new server-side
                 env secret; admin = an env allowlist (lean) — Architect confirms. The deferred BYO-key seam
                 (OPEN_THREADS §7b) anticipated exactly this. In-memory store resets on restart (prototype).
                 New backend dep (`cryptography`) if not already present.

Effort:          L

Invariant watch: `[additive-keeps-score-byte-identical]` (CONTEXT §5) — the AI rec is already an isolated
                 leaf; per-user key resolution + metering stay OUT of `signals`/scoring/bundle/`state_finger
                 print` (byte-identical). `[best-effort-isolated-or-null]` (CONTEXT §5) — key
                 lookup/decryption/LLM failure or over-limit degrades the **rec surface alone** to a `status`
                 (no_key / over_limit / unavailable), **never** an HTTP 5xx and never breaks bundle/SSE; the
                 manual export floor stays available. `[no-real-order-path]` — unaffected.
                 **Security floor (HARD, feature-binding):** a user's API key is **ENCRYPTED at rest** (it
                 must be decryptable to call Anthropic — so encryption, not hashing) via a **server-side
                 encryption key** (env, gitignored); the raw key is **never logged, never returned in a
                 response, never sent to the browser** (once saved it is write-only from the client — show at
                 most a masked last-4; support rotate + delete); resolution stays server-side (the AI-call
                 boundary in CONTEXT §8 still holds — the key never reaches the browser).
                 **New `[minimal-admin-not-RBAC]`:** the admin concept stays a contained allowlist/flag for
                 THIS allowance, **not** a general role/permission system — scope creep to avoid.
                 **Security/red-team (system-6): DEFERRED** by owner (encrypt+hygiene floor now); re-fires at
                 the persistent / multi-user / public "going live" trigger — credential custody is exactly
                 its remit, so a BYO-key feature is its eventual first client.

Context tags:    architecture,backend,frontend,api,ui,conventions,decisions,ai,features

Entry point:     architect-first — the pivotal calls are technical/security: (1) the **per-request key-
                 resolution seam** (user's own key → else admin shared-key-with-allowance → else `no_key`),
                 extending the `LLMProvider` seam without touching the leaf's isolation; (2) the **encryption-
                 at-rest seam** — a `UserCredentialStore`, the encryption-key management, and the
                 write-only/masked-reveal model; (3) the **admin-determination mechanism** (env allowlist vs
                 user-record flag — keep minimal); (4) **per-user + admin-allowance metering** (extend the
                 process-global `AI_REC_DAILY_CAP`/cooldown to per-identity counting); (5) the **four gated
                 states** as a state machine the PM/UX can turn into ACs. Leave copy/endpoints/UI to
                 downstream.

Source:          Owner 2026-06-28 — chose the **hybrid** AI-key model, then refined: **regular users 0 free
                 (BYO required), admin 3 free/day** on the shared key; **encrypt + hygiene now, defer
                 red-team**; explicitly asked to design the **no-allowance vs has-allowance** states. Follows
                 the Part-1 step of adding the shared `ANTHROPIC_API_KEY` (which becomes the admin
                 free-allowance key + fallback). Realizes the deferred BYO-key seam (OPEN_THREADS §7b).
