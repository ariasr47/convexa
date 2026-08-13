# tradeable-rec-inputs — backend-lane verification notes (Track V, backend-owned steps)

Judged by exit code, not printed summaries, per plan Global Constraint 7.

## V0 — baseline (clean tree, before any edit)

- `cargo test -p quant-engine` → 65 + 3 + 8 + 2 = 78 tests, exit 0.
- `cargo test -p api-rust` → 160 (lib) + 6 (main) + 5 (research_isolation) = 171 tests, exit 0.
- `cargo check -p api-rust --features postgres` → exit 0.
- Score-identity triple captured off the unchanged tree (`score_identity.rs`, `--nocapture`,
  hermetic `SYN` fixture, both `dark_pool` branches): `score=8`, `tier=dormant`,
  `fingerprint=ad81df2ba2c3` (identical on both branches). Pinned into
  `PINNED_SCORE_DP_TRUE/FALSE`, `PINNED_TIER_DP_TRUE/FALSE`, `PINNED_FINGERPRINT_DP_TRUE/FALSE`.

## V1 — engine unit suites

`cargo test -p quant-engine straddle` → 9 ok (7 B1 + 2 B3). `cargo test -p quant-engine
candidates` → 9 ok (B2). Full `cargo test -p quant-engine` → 83 lib tests (baseline 65 + 18),
96 total across suites, exit 0.

## V2 — production feature build + clippy

`cargo check -p api-rust --features postgres` → exit 0 (mandatory separate step; this is the ONLY
path that compiles `db/pg_auth.rs` / `db/migrations.rs`).
`cargo clippy -p api-rust -p quant-engine --all-targets` → exit 0, zero errors. Two real issues
surfaced and fixed in this pass's own new code: a denied `clippy::approx_constant` (`6.28` read as
an approximation of τ in `score_identity.rs`'s poison test — changed to `7.35`) and a
`manual_split_once` in a new `llm.rs` test helper. Two `neg_cmp_op_on_partial_ord` warnings in
`straddle_move.rs`/`candidates.rs` were resolved by adding an explicit `!x.is_finite()` guard
(preserves NaN-rejection semantics — a blind `<=` rewrite would have silently accepted NaN).
Remaining clippy warnings are all in pre-existing, untouched modules (`infrastructure/massive/ws.rs`,
`infrastructure/redis/price_cache.rs`, `routes/stream.rs`, `services/broker/*`, `services/flight.rs`,
`services/scanner/tiering.rs`, `services/market_data/fixture.rs`, `main.rs::cmd_score_lab`,
`routes/auth.rs::require_user`, `state.rs::GexCache::len`, `services/auth/store.rs::persist_locked`,
`services/auth/service.rs::broker_cache_invalidator`) — zero new warnings in the modules this pass
added or touched.

## V3 — backend suites + poison guards

`cargo test -p api-rust` (all targets) → 212 (lib) + 6 (main) + 5 (candidate_isolation) +
5 (research_isolation) + 2 (score_identity) = 230, exit 0 (baseline 171 + 59).
Poison guards individually confirmed green (all bite when poisoned, per their own assertions):
- `cargo test -p api-rust --test score_identity` → both the identity test and
  `poison_adding_a_move_derived_value_to_the_scoring_inputs_changes_the_fingerprint` pass.
- `cargo test -p api-rust --test candidate_isolation` → 5 ok, incl. `the_guard_bites` and
  `the_match_key_constructor_takes_a_non_optional_right`.
- `cargo test -p quant-engine candidates::tests::raising_a_ceiling_in_a_test_build_makes_the_guard_fail`
  → ok (record ceiling still binds with an absurd per-group override).
- `cargo test -p api-rust llm::tests::widening_the_restriction_makes_the_subset_assertion_fail` →
  ok (also mirrored inside `quant-engine`'s own `straddle_move::tests`).
- `npx nx test @convexa/dashboard -- boundaries` — **frontend-lane test, out of this lane's scope.**

## V7 — the §7 pre-commit quote-fill measurement

B18 (`fetch_chain_quote_fill` + the `quote-fill` CLI subcommand, `data/research/quote_fill_*.json`
output) is **built and compiles** (`cargo test -p api-rust`, exit 0, per the plan's stated bar for
this step). The **live** evening (20:00–23:00 ET) + RTH runs that V7 itself calls for were **not
executed in this pass** — this session ran outside that window. Per the plan's pre-committed
response ladder (carry-forward #8), the correct action when the window/key pairing is unavailable
is to record which branch was taken rather than synthesize a measurement: **no branch of the ladder
was evaluated; the live run is deferred to a session inside the stated window.** `MASSIVE_API_KEY`
IS present in this environment (used live for V8 below), so only the time-window condition blocks
V7, not key availability.

## V8 — live interface conformance (never on :8000)

Served `apps/api` on `127.0.0.1:8010` (`cargo run --features postgres -- serve --bind
127.0.0.1:8010`, JSON stores — no `DATABASE_URL` configured), live `MASSIVE_API_KEY`. Obtained a
session via `POST /api/auth/signup`, replayed via `--auth-cookie`.

```
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:8010 \
  --auth-cookie gf_session=<value> \
  --report .spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt.json
```

Result: **exit 0**, `"verdict": "PASS"`, 4/4 endpoints PASS (`GET /api/ticker/{ticker}` 23 fields,
`GET /api/candidates/{ticker}` 50 fields, `GET /api/recommendation/export/{ticker}` 19 fields,
`GET /api/auth/settings` 12 fields). Receipt at
`.spire/clusters/tech/contracts/tradeable-rec-inputs/conformance-receipt.json`.

## V9 — the shapes outside the machine-checkable block (manual, on the same live :8010 server)

- `PUT /api/auth/settings` with `{"account_size": 10000, "per_trade_cap": {"value": 5, "unit":
  "percent"}}` → `risk_inputs.state = "set"`, `effective_dollar_cap = {state: "derived", value:
  500.0}` (5% of 10000, derived server-side, exactly once). `GET` round-tripped identically.
  A follow-up `PUT` with a `$99,999` dollar cap (exceeding the just-stored $10,000 account size)
  was refused (`422 {"error":"validation","message":"A dollar cap can't exceed your account
  size."}`) — nothing stored, confirmed by the unchanged subsequent `GET`. A `PUT` with no session
  cookie returned `401` (server-side gate — `[server-side-gate-enforcement]`).
- `POST /api/recommendation/SPY` (signed in, no AI key configured in this environment ⇒
  `status: "unavailable"`, `key_source: "none"` — no LLM spend) still carried the full B16 envelope:
  `sent.budget: "prompt"`, `sent.candidates.state: "ok"`, `sent.risk_inputs.state: "set"` (the block
  just saved), `cap_check.verdict: "not_applicable"` (no strategy ⇒ no stated entry) with
  `cap_check.effective_dollar_cap: 500` still carried through, `field_reasons.*` all `not_given`,
  `cited_contract.state: "none"`. Matches SPEC §2.5/§2.6 shapes exactly. No daily cap or provider
  key was spent (the call short-circuited on `!resolved.usable()`).

## V10 — before/after verdict comparison — **executed with live verdicts**

Two passes. **Attempt 1** (no LLM key configured anywhere in this environment): 0/5 tickers
produced a strategy in either arm because `resolve_llm_key`/`usable()` (untouched by this feature,
confirmed via `git diff`) gates on a configured key. Preserved as history in
`before-after-verdicts.md`'s "Attempt 1" section — it was a real, honest finding at the time, not a
defect. **Attempt 2** (after the owner provisioned an AI key): a `git worktree` pre-feature build
served on `:8011` (before-arm) against this build on `:8010` (after-arm), both signed in with the
owner's key as each test account's BYO key, real Anthropic calls, `AI_REC_LOCAL_ONLY` never used.
Result: 0/5 `no_trade`→trade flips, 1/5 `trade`→`no_trade` flip (QQQ, model-stated reason: target
already reached, negative expected value), 4/5 holds with materially more concrete
(quote-grounded, cap-aware) rationale after the feature. No code defect found; one structural
finding recorded for the owner (the model's `max_risk` prose often names two dollar figures in one
sentence, correctly reading as `not_checkable` per the parser's own by-design ambiguity rule — not
a bug). Full method, per-ticker table and characterization in
`.spire/clusters/tech/contracts/tradeable-rec-inputs/before-after-verdicts.md`.

## V11

Not run in this pass — the design/a11y/typecheck sweep (V11, `npm run ci`) spans the frontend lane
and is not this lane's to run.
