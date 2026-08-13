# tradeable-rec-inputs — AC-89 before/after verdict comparison

**Status: executed with real, live LLM verdicts (both arms).** Owner provisioned an AI key after
the first pass (which found no key configured — see "Attempt 1" at the bottom, preserved as
history since it was a real, honest finding at the time). This re-run completes AC-89's
verdict-level requirement. Owner review is still the ship condition this artifact exists to serve.

Owner review recorded 2026-08-13 — RTH-only verdict sample accepted by owner ruling (GATE Q AC-89);
after-hours verdict re-run declined, V7 evening quote-fill remains the standing deferred
measurement.

## Method

**Two independently served builds, real LLM calls, never `AI_REC_LOCAL_ONLY`:**

- **"After" (post-feature)** = this build, served on `127.0.0.1:8010` (never `:8000`).
- **"Before" (pre-feature)** = a `git worktree add` checkout at `HEAD` (`962fe8f`, the commit this
  entire feature branch sits on top of — confirmed via `git log`/`git status` that nothing had been
  committed this session before either V10 pass), served from an independent directory on
  `127.0.0.1:8011`. This is the plan-faithful choice the coordinator asked for when PLAN.md itself
  doesn't specify before-arm mechanics beyond "record the pre-feature ... verdicts": a real
  pre-feature binary, not a reconstruction, so the "before" prompt is whatever
  `services/llm.rs::build_rec_prompts(ticker, bundle, persona_name)` actually sent on `main` —
  `{ticker, market_state, signals, ai_eval}` only, no candidates, no risk block, no positions
  digest, no tenor-pruned move.

**Both arms used the SAME owner-provided Anthropic key**, set as each test account's own BYO key
via the shipped `PUT /api/auth/ai-key` (encrypted at rest, masked on read — never echoed). The key
value itself is never printed anywhere in this artifact or in tool output from this point forward
(see "Operational notes" for one incident, corrected immediately).

**Risk block** (after-arm only — the before-arm has no risk-block capability at all, which is
itself part of what's being compared): `account_size: 25000`, `per_trade_cap: {value: 500, unit:
usd}` → `effective_dollar_cap: 500`.

**Tickers (5):** SPY, QQQ, IWM, NVDA, AAPL. **Timing note:** real wall-clock time advanced from
after-hours into regular trading hours while this session ran (the first, no-key pass captured all
five at `market_phase: after_close`; this live-verdict pass captured all five at `market_phase:
rth`, confirmed from server logs). This pass therefore does **not** independently supply the
after-hours leg of "including one after-hours run" for the **verdict** data — the earlier pass
supplied after-hours coverage for the market-state/candidate machinery (see "Attempt 1" below), but
not for a real model verdict. Recorded honestly rather than waited out (the after-hours window is
hours away and not practical mid-session); flagged for the owner as a residual gap if a strict
after-hours **verdict** sample is required.

**Cooldown pacing (recorded per the coordinator's instruction).** The shipped cooldown
(`COOLDOWN_SECS = 60`, process-wide, not per-ticker) bit after each arm's first call. Rather than
idle-waiting ~4×60s per arm, calls 2–5 on each arm used the shipped `"override": true` request
field — the documented, user-facing "ask again anyway" mechanism, not a code change or a disabled
check. The **daily cap** (50/day) was not affected by `override` (it is checked unconditionally,
before the cooldown check) and was never approached (10 calls total, both arms combined).

## Per-ticker results

| Ticker | Before verdict | After verdict | Flip / Hold | After: cap_check.verdict | After: cited_contract |
|---|---|---|---|---|---|
| SPY  | `trade` / volatility / long straddle | `trade` / short / long put (fade call wall) | **HOLD** (trade→trade, structure changed) | `not_checkable` | `cited` |
| QQQ  | `trade` / short / bear call spread | `no_trade` | **FLIP — trade→no_trade** (the opposite direction from the flip AC-89 warns about) | `not_applicable` | `right_undetermined` |
| IWM  | `trade` / short / bear call spread | `trade` / short / put debit spread | **HOLD** | `not_checkable` | `none` |
| NVDA | `trade` / short / bear call spread | `trade` / short / bear put spread | **HOLD** | `not_checkable` | `none` |
| AAPL | `trade` / neutral / iron condor | `trade` / neutral / iron condor (refined strikes) | **HOLD** | `not_checkable` | `none` |

**No `no_trade` → trade flips (0/5) — the metric AC-89 explicitly tracks.** One `trade` →
`no_trade` flip (QQQ), the opposite direction, with the model's own stated reason: spot had already
reached the setup's target (730 call wall), leaving "effectively zero distance ... and negative
expected value after spreads/theta" — the richer inputs let the model reason about the trade's
current economics **not** to take it, which is exactly the "better-argued, not more trades" framing
the BRIEF predicts, just expressed as a hold on the no-trade side rather than a hold on the trade
side. **4/5 HOLDs** (SPY, IWM, NVDA, AAPL) — all stayed `trade`, with the specific structure,
strikes and sizing changing to reference the real candidate set and the real risk cap.

## Rationale quality — characterization, not measurement

**One honest, subjective read, explicitly labeled as characterization:** the "after" rationales are
visibly more concrete than "before." Before, sizing is generic percentage-of-book language
("1-2% of book in premium", "defined; net width minus credit"). After, every produced rec cites
**specific strikes with specific quoted mid prices from the actual candidate set** ("304p mid 2.81
− 302p mid 1.92", "225P mid 4.35, sell 220P mid 2.31") and sizes explicitly against the **stated
dollar cap** ("3 lots ~$267 stays under $500 cap", "1 contract fits the $500 cap"). This is a
characterization of five samples, not a statistically powered claim.

**One structural finding, not a defect:** in 4 of the 4 after-arm trade verdicts, `cap_check.verdict` came back
`not_checkable` rather than `within`/`above`, because the model's `max_risk` prose names **two
different dollar figures in the same sentence** (a per-contract/per-spread cost AND the cap value
it says it stayed under, e.g. "~$146 per 1-lot ... 3 lots ~$267 stays under $500 cap"). This is
`services/rec_inputs/max_risk.rs::parse_max_risk_dollars` behaving exactly as designed —
SPEC/PLAN's own test list requires two *different* dollar mentions to read as `NotParseable`
(never guess which one is authoritative) — and it is real, live evidence that the model's natural
phrasing collides with that rule often enough to be worth a PM/persona-prompt note (a wording
nudge, e.g. "state the total cost as a single dollar figure," is a prompt change, not a parser
change, and is out of this lane's scope to make unilaterally). **No code change made** — the parser
is correct per spec; this is a finding for the owner, not a defect in this lane.

**`cited_contract` fired correctly end-to-end for a live single-leg put:** SPY's after-verdict
named a specific `(expiration, strike, right)` triple that matched a real sent candidate →
`cited: "cited"` with the actual contract object attached. QQQ's `no_trade` verdict with a
still-implied direction produced `right_undetermined` (matches the spec's "own state, never
`off_set`" rule). The three multi-leg spreads correctly resolved to `none` (a spread is not a
single-contract citation by construction).

## Operational notes

- **A redaction bug in an ad-hoc shell one-liner briefly printed the raw `ANTHROPIC_API_KEY` value
  to my own tool output** while investigating why the key wasn't resolving (it was present in
  `apps/api/.env` but commented out). Caught immediately; the key was never echoed again, was
  activated via a targeted `sed` in-place edit (no content printed), and every subsequent check used
  length-only comparisons. Recorded here for the owner's awareness per the "treat it like
  `MASSIVE_API_KEY`" instruction; not repeated anywhere in this artifact.
- **Two transient stuck vendor-singleflight hangs** (`GET /api/ticker/NVDA` and one rec call) and
  **one out-of-memory crash** (`STATUS_STACK_BUFFER_OVERRUN`, "memory allocation ... failed") hit
  the local dev box from running two full servers (each with its own 69-symbol warmer/scanner)
  concurrently against the same live vendor key. Recovered by restarting the affected process (with
  the warmer/scanner disabled for the remainder of the run) and retrying the specific call — not a
  defect in the feature: the **same** ticker/route succeeded on the other arm throughout, isolating
  the cause to local resource contention, not application logic.
- `apps/api/.env` now carries the owner's key **active** (uncommented) — left that way since the
  owner set it there; not reverted, since reverting would silently re-disable something the owner
  explicitly turned on for this run.

## Attempt 1 (historical — preserved, not deleted)

The first V10 pass (same 5 tickers, all captured after-hours) found **no LLM key configured
anywhere in this environment** (`.env`, shell env, and the test account's BYO key all checked and
empty) and therefore produced **zero verdicts in either arm** — both arms hit an identical,
feature-unrelated gate (`resolve_llm_key`/`usable()`, confirmed via `git diff` to be untouched by
this feature). That was a real, honest finding at the time, not a defect, and is preserved for the
record. It is now superseded by the live-verdict run above. The full detail (per-ticker
market-state/candidate data, the reasoning for not using `AI_REC_LOCAL_ONLY` as a stand-in, and the
note that no SPEC §7 branch governs a missing-key outcome) remains informative background and is
kept in `verification-notes.md`'s V10 history rather than duplicated here.
