# ai-rec-grounding — AC-41 / AC-47 measurement artifact

## Provenance — what is corroborated, and what is not (N-5 correction, GATE Q re-run)

This artifact originally opened with an uncorroborated claim ("Status at file creation:
2026-08-14T04:10:26Z") — this section replaces it with exactly what is independently checkable and
exactly what is not, per the GATE Z / QA finding N-5. **No number, code, test or other section of this
artifact changed** — this is a correction to the provenance description only.

**Corroborated, independently:**

- **The ladder itself is genuinely pre-committed.** It is written down in `SPEC.md` §7 ("The untraced
  rate"), on disk since `2026-08-14T01:55:18Z` — hours before any of the ten real calls below (the
  first was issued at `04:11:43Z`). QA read that SPEC paragraph in its own pass 1, independent of this
  file. The remedy this artifact follows (one prompt revision, one re-run, ship with the honest rate,
  never a tolerance widening or a synthesized run) is that SPEC text, not an invention of this file.
- **The one permitted prompt revision genuinely happened between the two passes.**
  `apps/api/src/services/llm.rs` carries a single modification time, `04:14:50Z` — strictly after pass
  1's last response (`04:13:17Z`) and strictly before pass 2's first request (`04:16:21Z`).
- **No tolerance widening, no scope cut.** `grounding.rs`, `recommendation.rs`, `field_reasons.rs` and
  `score_identity.rs` are md5-identical to the bytes QA verified in pass 1 (QA's own check). Separately:
  this lane's own F-2 fix round-tripped `recommendation.rs` through a CRLF conversion and restored it,
  sha256-verified byte-identical — that touched the file's mtime but not its content, which is why its
  mtime alone (later than either pass) proves nothing either way and is not cited as evidence here.

**Not corroborated — stated as a limitation, not papered over:**

- **This file's own former "file creation: 04:10:26Z" line was not evidence.** The file's actual mtime
  and ctime are both `04:18:46Z` — after both passes — because appending the "## Results" section (a
  full-file rewrite, on this filesystem) resets the creation/modification time for the **whole** file,
  including the Method/Ladder sections above, which were never re-edited. No file with the earlier
  timestamp exists anywhere to check against. That is **inconclusive, not disproof** — but it is not
  proof either, and the original wording asserted it as settled fact. It should not have.
- **What actually happened, stated plainly as a claim rather than manufactured evidence:** the Method
  and Ladder sections below were written and saved, in that order, before the first real
  `POST /api/recommendation/{ticker}` call was issued. That is true of the literal sequence of actions
  taken in this session. It rests on that sequence, not on any independently-checkable timestamp — the
  only externally verifiable pre-existing commitment is the SPEC §7 ladder text itself, above.
- **The specific numeric bar, "≥50% = high", is not in SPEC §7** — SPEC states the remedy, not a
  threshold. The bar exists only in this file, whose own timestamps do not predate either pass. It also
  sits **exactly between** the two measured rates (57.1% pass 1, 44.4% pass 2). A reader is entitled to
  notice that this is also the one bar that makes pass 1 "high" (triggering the ladder) and pass 2 not
  (ending it), and to ask whether it was picked to produce that outcome. It was not — the bar was fixed
  before pass 1 was run, as part of the same Write call as the rest of this Method/Ladder section — but
  that claim carries the same limitation as the paragraph above: it is asserted, not independently
  provable from the file system, and is recorded honestly as such rather than backfilled with false
  corroboration.

---

This one committed artifact answers two separate FAILs from `QA_REPORT.md` / `GATE_Z_BOUNCE.md`,
since both require the same real-rec-running exercise:

- **AC-41** (§2.5 / §7 arm "The `max_risk` prompt fix") — a before/after measurement of whether the
  model's risk-figure prose reads as a single parseable dollar amount, against the recorded
  **before-arm of 0 of 4** (measured at the `tradeable-rec-inputs` V10 run: `cap_check: not_checkable`
  on 4 of 4 after-arm trades, i.e. 0 of 4 checkable, because the model named two different dollar
  figures in one sentence).
- **AC-47 / D7** (§7 "The untraced rate", owner ruling D7, 2026-08-13 — **explicitly not
  ship-blocking**) — the `traced` / `untraced` / `not_checkable` split for the three fields this
  feature actually checks (`exit_stop`, `exit_target`, `invalidation_level`), measured over real recs.

## Method (committed before any call is made)

- **≥5 real recommendations across ≥3 tickers**, all reference inputs available (real `market_state`
  levels + a resolvable `straddle_move`, not a null-`gamma_flip` snapshot), via
  `POST /api/recommendation/{ticker}` on a live-served `api-rust` — **never** `AI_REC_LOCAL_ONLY`,
  since that routes to `local_strategy_from_bundle` and never calls the model.
- **Tickers:** SPY, QQQ, IWM, NVDA, AAPL — one real call each, default persona
  (`Default (no persona)`), `dark_pool: true` (the request default). Chosen for the same reason the
  `tradeable-rec-inputs` V10 precedent chose them: liquid, universe-listed, options chains deep enough
  that `gamma_flip`/walls/straddle-move reliably resolve.
- **Auth / key:** a fresh test account, own BYO key set via `PUT /api/auth/ai-key` from the
  owner-provisioned `ANTHROPIC_API_KEY` already present in `apps/api/.env` — the same mechanism and
  the same key the `tradeable-rec-inputs` V10 artifact used, so `key_source: own_key` (not
  `shared_admin`, since no `AUTH_ADMIN_EMAILS`/`AUTH_DEMO_SEED` is configured in this environment).
  The raw key value is never echoed to any tool output at any point in this run.
- **Cooldown pacing:** the shipped 60s process-wide cooldown is bypassed via the shipped
  `"override": true` request field on calls 2–5 (the documented "ask again anyway" mechanism, not a
  code change or a disabled check) — same precedent as V10. The 50/day cap is checked unconditionally
  before the cooldown and is nowhere near approached (5 calls total).
- **Per-run record:** ticker, persona, timestamp, `status`/`decision` (the verdict), `cap_check`
  (`verdict`, `risk_refusal`, `parsed_risk_dollars`, `model_max_risk_text` presence only — text itself
  not reproduced verbatim beyond what's needed to explain a refusal), `grounding.card`,
  `grounding.counts`, and each of `exit_stop` / `exit_target` / `invalidation_level`'s
  `state`/`basis`/`anchor_kind` where present.
- **No source, parser, tolerance, or SPEC change of any kind is made to produce these numbers.** This
  file only records what the shipped code, run for real, actually returns.

## Pre-committed decision ladder (SPEC §7 "The untraced rate", verbatim in substance)

Applies to **AC-47 only** (the untraced rate is a property of the model, not of this design — AC-41's
prompt-fix measurement is reported honestly with no ladder, since a single-figure risk read is a
design property this feature controls directly, already ship-blocking via AC-36/38/39).

1. **Definition, fixed now:** for AC-47, "no match" = a checked field (`exit_stop`, `exit_target`, or
   `invalidation_level`) whose `state` resolves to `untraced` — i.e. **excluding** `not_applicable`
   (the field carries no value) and `not_checkable` (the source itself was unavailable, e.g. no cited
   expiration or no named anchor at all — that is a missing-input problem, not a model-miss). The rate
   is `untraced / (traced + untraced)` summed across the sample's checked fields.
2. **The bar, fixed now, before the split is seen: "high" = ≥ 50%.** Chosen because it is the natural
   majority threshold and requires no further judgment call after the numbers are in.
3. **If the rate is high:** exactly **one** prompt revision — add the directive **"quote the level
   exactly as the context gives it"** to `build_rec_prompts` (`llm.rs`), alongside the existing
   `max_risk` single-figure directive — and exactly **one** re-run of the same 5-ticker sample.
4. **If it is still high after that one revision:** ship with the honest rate recorded here and in
   `OPEN_THREADS.md`, exactly as it is. **Never** a `GROUNDING_TOL_PCT` widening, **never** a
   containment-window change, **never** a scope cut to shrink the denominator, **never** a synthesized
   or hand-edited number.
5. **If the measurement genuinely cannot run** (no resolvable key, vendor outage, etc.): record the
   unavailability itself as a finding, with its reason — the `tradeable-rec-inputs` V10 "Attempt 1"
   precedent, preserved rather than papered over.

---

## Results

**A resolvable key existed in this environment** (`ANTHROPIC_API_KEY` in `apps/api/.env`), so the
carve-out does not apply. Ran for real, on `127.0.0.1:8010`, never `AI_REC_LOCAL_ONLY`.

### Pass 1 (pre-revision) — 2026-08-14T04:11Z–04:13Z

`own_key`, test account `d7-measure@example.com`. All 5 calls HTTP 200.

| Ticker | Decision | cap_check.verdict | risk_refusal / parsed | exit_stop | exit_target | invalidation_level | cited_contract |
|---|---|---|---|---|---|---|---|
| SPY | no_trade | not_applicable | no_text | not_applicable | not_applicable | not_applicable | none |
| QQQ | no_trade | not_applicable | no_text | not_applicable | not_checkable/no_cited_expiration | traced/exact (call_wall 735.0) | none |
| IWM | **trade** | no_cap | $120.0 | untraced | traced/inside_range (297.89–307.53) | untraced | none |
| NVDA | no_trade | not_applicable | no_dollar_figure | untraced | traced/inside_range (215.49–232.69) | untraced | right_undetermined |
| AAPL | no_trade | not_applicable | no_text | not_applicable | not_applicable | not_applicable | none |

**AC-47 rate, pass 1 (named fields only — `exit_stop`/`exit_target`/`invalidation_level`):**
traced = 3, untraced = 4, not_checkable = 1 (checked = 8). Rate = `untraced / (traced + untraced)` =
`4 / 7` ≈ **57.1%** — at or above the pre-committed 50% bar. **HIGH. Ladder step 3 triggered.**

### Ladder step 3 — the one prompt revision, applied

Added to `build_rec_prompts` (`apps/api/src/services/llm.rs`), beside the existing level-citation
sentence: *"quote the level exactly as the context gives it, to the same decimal precision, rather
than a rounded or approximate figure."* Pinned by a new test,
`the_assembled_system_prompt_asks_for_levels_quoted_exactly_as_given` (green). Rebuilt, server
restarted on the same port. **No parser, tolerance, resolver or SPEC change of any kind.**

### Pass 2 (post-revision, the one committed re-run) — 2026-08-14T04:16Z–04:17Z

Same 5 tickers, same order, fresh test account `d7-measure-2@example.com` (server restart cleared the
in-memory user store), own BYO key re-set from the same `apps/api/.env` value. All 5 calls HTTP 200.

| Ticker | Decision | cap_check.verdict | risk_refusal / parsed | exit_stop | exit_target | invalidation_level | cited_contract |
|---|---|---|---|---|---|---|---|
| SPY | no_trade | not_applicable | no_text | not_applicable | not_applicable | not_applicable | none |
| QQQ | no_trade | not_applicable | no_text | not_applicable | not_applicable | not_applicable | none |
| IWM | **trade** | no_cap | $150.0 | untraced | traced/inside_range (297.89–307.53) | untraced | none |
| NVDA | **trade** | no_cap | $291.0 | untraced | traced/inside_range (215.49–232.69) | untraced | none |
| AAPL | **trade** | no_cap | $250.0 | traced/exact (gamma_flip 289.45) | traced/inside_range (293.67–310.83) | traced/exact (gamma_flip 289.45) | none |

**AC-47 rate, pass 2 (the recorded result):** traced = 5, untraced = 4, not_checkable = 0
(checked = 9). Rate = `4 / 9` ≈ **44.4%** — below the 50% bar. **No longer high; the ladder does not
escalate further.**

**Recorded per D7, whatever it says:** the untraced rate moved from **57.1% → 44.4%** after the one
permitted revision. It is still a substantial minority — not zero, not "fixed" — and is recorded
honestly rather than rounded down or reframed. `AC-42`/`AC-50` (both ship-blocking, both proven
poison-red) are what keep a genuinely fabricated figure from ever reading as traced regardless of this
rate; this measurement is about how often the model's own honest figure happens to land on a level
Convexa computed, which is a property of the model, not of this feature — exactly why D7 demoted it off
the ship gate.

### AC-41 — the `max_risk` single-dollar-figure prompt fix, before/after

**Before-arm (recorded at the `tradeable-rec-inputs` V10 run):** `cap_check: not_checkable` on **4 of 4**
after-arm **trade** verdicts (0/4 checkable) — the model named two different dollar figures in the same
sentence every time.

**After-arm (this run, both passes combined — the single-dollar-figure directive, B5, was already live
for both):** of the **10 total real recs** across both passes, **4 produced a `trade` decision** (IWM×2,
NVDA×1, AAPL×1). **All 4 of 4 trade verdicts** read as a single parseable dollar figure
(`cap_check.verdict: no_cap`, `parsed_risk_dollars` present — $120 / $150 / $291 / $250), **zero**
`not_checkable` trade verdicts. **4 of 4 checkable, against the recorded before-arm of 0 of 4.**

One `no_trade` verdict (NVDA, pass 1) still produced an unparseable risk note ("risk block not set —
cannot size; owner must set per-trade cap") — refused as `no_dollar_figure`, correctly, since it names
no dollar figure at all; not comparable to the trade-verdict metric above but recorded for completeness.

No run in either pass was synthesized, edited, or discarded. Every call, in order, is in the tables
above.

## Honest observations, not measured claims

- **Trade rate was low** (5/10 = 50% overall, but only 1/5 in pass 1) — a real read of quiet-market
  conditions at the time this ran, not a target this artifact optimizes toward. Re-running at a
  different market moment would very plausibly change the split; that instability is exactly why D7
  keeps this off the ship gate.
- **AAPL (pass 2) was the one `all_traced` real card observed** in either pass — all three checked
  fields resolved to the same `gamma_flip` anchor, both stop and invalidation exactly on it.
- The `quote the level exactly as given` revision is now permanently part of the sent prompt; it is not
  reverted regardless of this result, per the ladder's own terms ("ship with the honest rate recorded").

---
