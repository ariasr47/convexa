# ai-rec-grounding — QA report (GATE Q)

**Verifier:** QA / Verification lane — fresh session, not one of the builders.
**Pass 1:** 2026-08-13 — **FAIL** (65 PASS · 3 FAIL · 0 UNVERIFIABLE)
**Pass 2 (this report):** 2026-08-14 — re-run on the GATE Z fixes (`GATE_Z_BOUNCE.md`)
**Method:** run the app and observe first; read code only to explain an observed failure or to run the
criteria-independent Critical sweep. Fixes verified by observation, never by their description.

> ## GATE Q: **PASS** — 68 PASS · 0 FAIL · 0 UNVERIFIABLE
> Every acceptance criterion passes, no binding invariant is broken, no Critical finding remains, and
> independent conformance is PASS on my own receipt. Three Minor observations are recorded in §8;
> none blocks. Details of the pass-1 evidence are retained below so the record is self-contained.

---

## 1. Pass-2 re-run: what was executed

Environment discipline held: **API served on `:8010` only** (`netstat` confirmed no listener on `:8000`
at any point in this pass), `localhost` not `127.0.0.1` for the browser, exit codes read not printed
summaries, no `git stash` at any point.

| Run | Command | Result |
|---|---|---|
| **F-1 · CI format gate** | `npm run format:check` (**repo-wide**, the exact CI step — not a scoped invocation) | **exit 0** — `All matched files use Prettier code style!` |
| FE suite, run 1 | `npx nx test @convexa/dashboard --skip-nx-cache` | exit **1** — `Test Files 5 failed \| 144 passed (149)`, `Tests 5 failed \| 1700 passed (1705)` |
| FE suite, run 2 | same | exit **1** — identical counts, identical 5 files |
| ai-rec spec files | `npx vitest run` ×5 ai-rec/entry-dialog spec files, `--reporter=verbose` | **exit 0 — 152 passed (152)** |
| Typecheck | `npx nx typecheck @convexa/dashboard --skip-nx-cache` | exit **0** |
| Rust suite | `cargo test -p api-rust --features postgres` | exit **0** — 247 + 6 + 5 + 4 + 5 + 2 = **269 green** (was 268; +1 = the new prompt-directive test) |
| e2e | `npx playwright test src/e2e/no-overflow.spec.ts` | exit **0** — **34 passed**, incl. the densest grounding card at 393px in both schemes |
| Lint | `npm run lint` | exit 1 — **1 error**, `pages/ticker/stage3-headings.spec.tsx:278`, file untouched by this feature ⇒ pre-existing and unchanged from pass 1 |
| `cargo fmt --check` | `cargo fmt -p api-rust -- --check` | non-zero, 289 diff sites (was 288) — the same pre-existing whole-crate drift; **not a CI gate** (CI Rust job = `cargo test` + release build) |
| **Independent conformance** | `node .claude/tools/gates.mjs interface_conformance … --url http://127.0.0.1:8010 --report …/conformance-receipt-qa.json` | **PASS 2/2**, 26 required fields, regenerated from my own run |
| Live browser | Playwright/Chromium, `localhost:4200`, every `/api/**` call re-issued against **:8010** so the hardcoded `:8000` Vite proxy is never used | trade + `no_trade` branches observed — §4 |

### The baseline and the flake claim — confirmed independently

Both of my runs: `Tests 5 failed | 1700 passed (1705)`, `Test Files 5 failed | 144 passed (149)`.
Passing count **1700**, matching the lane's report (was 1691 in pass 1; +9 from the new named tests).
The five red files are **exactly** the accepted identities:

`stage3-amber.spec.ts` · `grouping.integration.spec.tsx` · `orders.risk.spec.tsx` ·
`positions.risk.spec.tsx` · `readonly.spec.tsx`

**`app.risk.spec.tsx` was green in both of my runs** and is not among the five. Combined with the
lane's 5 runs (3 in a clean-HEAD worktree, 2 on branch), that is 7 independent green observations of
that file against 1 red. I accept the pre-existing load-sensitive-flake conclusion. **No sixth red
file; the baseline is unchanged.** (In pass 1 I proved all five are red at HEAD too, in a detached
worktree — that proof stands and was not re-run.)

---

## 2. Z-F2 / F-1 — the CI format gate

**Fixed. Verified by running the repo-wide command myself**, not a scoped one:

```
> prettier --check "apps/dashboard/**/*.{ts,tsx,js,jsx,mjs,css,json,md}" "apps/dashboard-e2e/**/*…" …
Checking formatting...
All matched files use Prettier code style!
FORMAT_EXIT=0
```

In pass 1 this exited **1** on 9 files, every one authored by this feature. CI's first frontend step now
passes, so lint / typecheck / test / build / e2e are reachable again. No unrelated file was reformatted
(the working tree still shows the same 27 modified + 7 untracked paths as pass 1, plus `OPEN_THREADS.md`).

---

## 3. Z-B3 / F-2 — the guard-8c wiring pin

**The assertion was NOT weakened.** Read side by side with the pass-1 text: both assertions are
byte-identical — the same 12-space-indented `"            pruned_move.as_ref(),\n            grounding_anchors,"`
pattern and the same `src.matches("raw_move.as_ref()").count() == 1`. The only change is one added line,
`let src = raw.replace("\r\n", "\n");`, normalizing the **representation** before matching.

**Re-poison-proved by QA under both line endings** (file round-tripped and restored md5-identical):

| Source state | Line endings | Result |
|---|---|---|
| clean | LF | **GREEN** — `the_base_closure_grounds_against_the_pruned_move_never_the_raw_one … ok` |
| clean | **CRLF** | **GREEN** — the pass-1 false red is gone |
| poisoned (`pruned_move.as_ref()` → `raw_move.as_ref()`) | LF | **RED** — `… FAILED` |
| poisoned | **CRLF** | **RED** — `… FAILED` |

The guard keeps its behaviour in both representations and still bites on the one poison arm nothing
else in the feature can catch. F-2 closed.

---

## 4. Z-F1 / AC-33 — the prose-numbers disclosure

**Literal (verbatim, `copy.ts` → `REASONING_PROSE_NOT_CHECKED`):**

> `Numbers written out in this reasoning aren't checked — only the stop, target and invalidation level above are.`

**Observed in a real browser, both branches** (API on `:8010`, dark and light):

| Branch | Disclosure renders | Inside a field? | Inside a clause? | Chrome | Card-level grounding line | Per-figure clauses |
|---|---|---|---|---|---|---|
| produced **trade** (live local-rules rec) | **yes**, verbatim | `insideAField: false` | `insideAClause: false` | `<span>` caption, **12px**, `text.secondary`, **0 icons** | `local_rules` line present | `clause-stop`, `clause-invalidation` present |
| **`no_trade`** | **yes**, verbatim | `false` | `false` | identical | **`null` — none renders** | **`[]` — none renders** |

DOM-order indices in the rendered panel text on the trade card: `Stop` @1141 → `Why` @1367 →
**disclosure @1624** — it sits with the reasoning, after the fields, exactly as AC-33 requires. Panel
scan on both branches with the new literal present: **zero wire-token leaks, zero banned words, zero
check glyphs.**

**Judging the lane's AC-19 argument myself.** The claim is that the statement is a permanent
scope-boundary fact rather than a grounding caveat, so it may render on `no_trade`. I accept it, on
observation rather than on the argument: on the `no_trade` card the grounding vocabulary is entirely
absent — no card-level line, no clause, no marker, no tint, no icon — and the disclosure carries no
grounding token, no state and no chrome of its own. It qualifies the **reasoning prose**, which does
exist on a `no_trade` card and does contain numbers, so rendering it there is the honest choice; gating
it on the verdict would leave exactly that prose unqualified. **AC-19 re-verified and still PASS.** One
copy nit is recorded as N-6.

Disjointness: the new literal is distinct from every card-level, per-figure, missing-input and prefill
literal, from all four shipped absence literals, and contains no banned word and no internal name. It
deliberately says `aren't checked` (a permanent scope boundary) where `GROUNDING_BLOCK_ABSENT` says
`wasn't checked` (a missing server check) — different strings, different facts.

**Named tests (3, all green):** `renders visibly, placed WITH the reasoning (not with the fields), on a
produced trade card` · `also renders on a no_trade card (the reasoning still carries prose there)` ·
`is disjoint from every other closed-set literal and carries no banned word`.

---

## 5. Z-B1 / Z-B2 — AC-41 and AC-47, and the ordering claim

### 5.1 The runs are real, complete, and faithfully reported — verified against primary evidence

The lanes wrote their raw captures into the same scratch directory this session uses, so I checked the
artifact's tables against **the ten actual response bodies**, not against its prose:

`rec_{SPY,QQQ,IWM,NVDA,AAPL}.json` (04:12:09 → 04:13:17Z) and
`rerun_{SPY,QQQ,IWM,NVDA,AAPL}.json` (04:16:21 → 04:17:42Z) — **exactly ten files, exactly ten table
rows. Nothing was discarded and nothing was synthesized.** Every one carries
`persona: Default (no persona)`, `key_source: own_key`.

Recomputed from the raw JSON, independently of the artifact's arithmetic:

| Pass | traced | untraced | not_checkable | checked | rate `untraced/(traced+untraced)` | artifact says |
|---|---|---|---|---|---|---|
| 1 | 3 | 4 | 1 | 8 | **4/7 = 57.1%** | 57.1% ✔ |
| 2 | 5 | 4 | 0 | 9 | **4/9 = 44.4%** | 44.4% ✔ |

Every per-field cell matches too, including the awkward ones the artifact could have quietly smoothed:
pass-1 QQQ `exit_target = not_checkable/no_cited_expiration` with `invalidation = traced/exact
call_wall 735.0`; pass-1 NVDA `cited_contract = right_undetermined`; pass-2 AAPL all three fields
`traced` on `gamma_flip 289.45`.

**AC-41 after-arm, recomputed:** four `trade` verdicts across the ten runs (IWM×2, NVDA, AAPL); all four
carry a non-null `parsed_risk_dollars` (**$120 / $150 / $291 / $250**) and `risk_refusal: null` —
**4 of 4 readable as a single dollar figure, against the recorded before-arm of 0 of 4.** The metric is
sound even though the measurement account had no cap (`verdict: no_cap`): `parsed_risk_dollars` is set
from the parse itself in `envelope_extras`, independently of `cap_verdict`'s short-circuit.

### 5.2 The ordering claim — checked, and reported precisely

The coordinator is right that this is the load-bearing claim. Here is exactly what the evidence supports
and what it does not.

**Verifiable, and verified:**

- **The response ladder itself is genuinely pre-committed.** It is written in `SPEC.md` §7 — *"a high
  no-match rate ⇒ **one** prompt revision ('quote the level exactly as the context gives it') and
  **one** re-run ⇒ still high ⇒ **ship with the honest rate recorded**… **Never** a tolerance widening,
  never a scope cut to flatter the number, never a synthesized run."* `SPEC.md` has been on disk since
  **01:55Z**, and **I read that paragraph myself during QA pass 1, hours before any of these runs
  existed.** The revision the lane applied matches that pre-registered wording.
- **The revision really happened between the two passes.** `llm.rs` has exactly one modification time,
  **04:14:50Z** — strictly after pass 1's last response (04:13:17Z) and strictly before pass 2's first
  (04:16:21Z). So pass 1 ran against the unrevised prompt and pass 2 against the revised one. The
  sequence is filesystem-corroborated, not merely narrated.
- **No tolerance widening and no scope cut — proved, not argued.** `grounding.rs`, `recommendation.rs`,
  `field_reasons.rs` and `score_identity.rs` are **md5-identical to the bytes I verified in QA pass 1**
  (checked against the digest file I recorded then). `GROUNDING_TOL_PCT` is still `0.1`, the
  `max(0.01, …)` cent floor is still in place, and the per-field rule set is unchanged. The only
  backend change in this pass is the prompt string plus its test.

**Not corroborated — recorded as N-5, not as a pass:**

- The artifact's own provenance sentence — *"Status at file creation: 2026-08-14T04:10:26Z — method and
  ladder committed, zero recs run yet… Everything below '## Results' is appended after the method
  section is on disk, never edited into it"* — **has no support on disk.** `d7-measurement.md` has
  creation time == last-write time == **04:18:46Z**, i.e. after pass 2 finished, and **no file anywhere
  in the repo or the session scratch was created at 04:10:26Z.** I checked whether this is decisive and
  it is **not**: a full-file rewrite resets creation time on this filesystem, demonstrated in the same
  window by `copy.ts` and `llm.rs`, so the claim is neither confirmed nor refuted by the timestamps.
- The consequence that matters: the one decision **not** pre-registered in `SPEC.md` is the numeric bar
  (**"high = ≥50%"**), which exists only in the artifact created after both passes. That bar is the
  single value that could have been fitted to the observed numbers — and it happens to sit between them
  (44.4% < 50% < 57.1%).

**Why this does not fail AC-47.** The criterion's requirement is that *the response ladder* be written
down before the split is seen; the ladder — what to do if the rate is high, and the prohibitions that
bound the response — is verifiably pre-dated and was **executed**, not argued away: the lane triggered
the escalation, did the extra work, and recorded 44.4% as *"still a substantial minority — not zero, not
'fixed'"* rather than reframing it. The threshold only ever gated whether to do **more** work, and the
ladder's binding prohibitions are independently proved by byte-identity of the resolver. The provenance
sentence should nonetheless be corrected before this artifact enters the permanent record — see N-5.

### 5.3 `OPEN_THREADS` §7ae — lands the artifact and the headline numbers honestly

The new entry names the artifact path, states **"4 of 4 … against the recorded before-arm of 0 of 4"**,
states **"57.1% … so the ladder's one permitted step ran … Result: 44.4%, still substantial, recorded
honestly rather than chased further — no tolerance widening, no scope cut, no synthesized run"**, and
records the F-2 fix and the seven-AC triage. Nothing is rounded, softened or omitted relative to the
artifact. AC-47's "recorded in the committed artifact **and** in `OPEN_THREADS` whatever it says" is met.

---

## 6. The seven-AC coverage gap — closed, and the AC-34 poison proofs re-run by QA

All seven now map to named, passing tests. I ran each and read its body; none is a rename of an existing
assertion.

| AC | Named test | Substance |
|---|---|---|
| 2 | `AC-2 — a traced clause naming a source with NO number renders NOWHERE (the negative half)` | asserts `{kind:'none'}` for `exact`, `near` **and** `inside_range` with the needed number null |
| 12 | `AC-12 — no numeric figure renders as an attributed quotation from the model` | rendered card; asserts no quote marks on Stop/Target/Invalidation values |
| 23 | `AC-23 — a couldn't-check clause names WHICH missing input blocked the check, by closed lookup…` | all three emittable reasons map to their `MISSING_INPUT_CLAUSE` member |
| 29 | `AC-29 — the bundle-failure (unavailable) envelope renders no card-level line and no per-figure clause at all` | mounts a real `status: unavailable` envelope; asserts both absent |
| 30 | extends the shipped SSE test | captures the card line **and** `clause-stop` text **before** the drop and asserts byte-identity after, plus no offline/dimmed attribute |
| 31 | extends the shipped superseded test | same byte-identity assertions across a newer bundle and a changed risk block |
| 34 | `AC-34(a)` + `AC-34(b)` | see below |

**AC-34 poison-proved by QA, all three arms RED** (files restored md5-identical):

| Poison | Result |
|---|---|
| give a **prose** key point the mono (Convexa-computed) register | **RED** — `expected '"IBM Plex Mono", …' not to contain 'IBM Plex Mono'` |
| detach the counted line from the wire: `someTracedLine(g.counts.traced, 99)` | **RED** |
| **non-vacuity** — strip every digit out of the fixture prose | **RED** — `expected false to be true`, the fixture's own vacuity guard firing |

That third arm is the one the coordinator specifically asked about, and it closes the trap: AC-34(a)
**cannot** pass over number-free prose, because the test asserts the rendered list items exist and at
least one contains a digit before it asserts anything else. The fixture prose genuinely carries numbers
(248, 1.12, 240, 260, 265), and the test also expands the *Analyst read* and re-checks the 265 line.
AC-34(b) drives the **same** prose through two different `counts` values and asserts the rendered line
changes only with the counts — so the line is provably counts-driven and unperturbed by the prose.

---

## 7. Regression checks — the fixes disturbed nothing

Observed live, in a real browser, after the fixes (API on `:8010`):

- **Type register (AC-9):** `Stop 768.11` **mono**, `Invalidation 768.11` **mono** (both `traced`);
  `Target not given`, `Max risk`, `Suggested size`, `Structure`, `Strike(s)`, `Expiration`,
  `Entry trigger` all **sans**. Split intact in both colour schemes.
- **Four excluded fields (AC-25) + the suppressed pair (AC-26):** Structure / Strike(s) / Expiration /
  Entry trigger / Max risk / Suggested size — **0 clauses each**, no marker, no tint.
- **Prefill gate (AC-7 / AC-68):** clicking *Accept* on the traced card seeds `Stop = 768.11` with **no**
  reason node; `Target` (`not_applicable`) opens empty with no reason — unchanged behaviour.
- **Closed-vocabulary totality (AC-32):** panel scan over 17–25 wire tokens on trade and `no_trade`
  cards — **zero leaks**, with the new literal present.
- **`additive-keeps-score-byte-identical`, both arms:** `score_identity.rs` 2 tests green, and
  `git diff --stat -- apps/api/tests/score_identity.rs` **empty**; the pin file is md5-identical to
  pass 1.
- **AC-60 / AC-63:** the e2e no-overflow suite re-run after a line was added to the card — **34 passed**,
  including the densest grounding card at 393px in both schemes.
- **Interface (AC-66 / conformance):** my regenerated receipt is **PASS 2/2** and agrees with the backend's
  (both on `:8010`). The pass-1 layer-2 walk stands — the payload shape was not touched by these fixes
  (`recommendation.rs` and `grounding.rs` are byte-identical to pass 1).

---

## 8. Acceptance criteria — final verdicts

Pass-1 evidence is retained; rows whose verdict or automation changed in pass 2 are marked **↻**.

| # | Criterion (abbrev. — full text in SPEC §3) | Verdict | How · evidence |
|---|---|---|---|
| 1 | exactly one clause per value-bearing checked figure **(SB)** | PASS | test `AC-1/AC-11 …` · observed live |
| 2 ↻ | traced clause carries the anchor's name **and value**, or both range endpoints; a sourceless traced clause renders nowhere **(SB)** | PASS | **now a named test** `AC-2 — … the negative half` covering all three bases + the positive halves in `AC-3` · observed live (`traces to Convexa's gamma flip (768.11)`) |
| 3 | clause shape selected by wire `basis` alone **(SB)** | PASS | test `AC-3 …` · QA poison → RED |
| 4 | containment reads as containment, visibly different from a level match | PASS | review of both copy shapes; rendered in the e2e densest card |
| 5 | no percentage/tolerance in any per-figure clause; tolerance once, from the response | PASS | observed: only `0.1%`, once, in the definition tooltip |
| 6 | total anchor lookup, all eleven + fallback | PASS | test `AC-6 …`; labels match §4 verbatim |
| 7 | nothing untraced pre-fills, seeds, defaults or is derived **(SB)** | PASS | 10 named tests · QA poison → RED · observed live (re-verified this pass) |
| 8 | traced vs untraced distinguishable in B&W without hovering **(SB)** | PASS | mono/sans register + visible clause text, both observed |
| 9 | register set by grounding state, never carries the state alone | PASS | 4 named tests · QA poison → RED · observed in both schemes (re-verified) |
| 10 | no banned word, no check glyph **(SB)** | PASS | `bannedWords.scan.spec.ts` · QA poisons → RED ×2 · live scan clean **including the new AC-33 literal** |
| 11 | an untraced stop still shows the model's number | PASS | test `AC-1/AC-11 …` · observed |
| 12 ↻ | no numeric figure renders as an attributed quotation | PASS | **now a named test** `AC-12 …` |
| 13 | rec never withheld/blanked/greyed **(SB)** | PASS | test `AC-13 …` · observed |
| 14 | no grounding state adds/removes a copy, export or accept affordance | PASS | review + observation across card states |
| 15 | exactly one card-level line, below the hero, above the risk tile | PASS | test + observed geometry (y=444 vs y=486) |
| 16 | counted line renders the server's integers; poisoning a field token changes nothing **(SB)** | PASS | test `AC-16 …` |
| 17 | denominator excludes size and dollar risk; reads out of 4 | PASS | FE + Rust tests · live payload `checked = 3` per the stated rule |
| 18 | the affirmative line still renders on a fully traced rec | PASS | test `AC-15/AC-18 …` |
| 19 | `no_trade` renders no card line, clause, marker or caveat **(SB)** | PASS | test `AC-19 …` · **re-verified live this pass**: `card: null`, `clauses: []` on a `no_trade` card carrying the new disclosure |
| 20 | local-rules line is the calm caption, no warning colour/icon | PASS | test `AC-20 …` · observed live |
| 21 | live arm: traced stop naming its level + the cap line's own couldn't-check verdict | PASS | observed live (`traces to Convexa's gamma flip (768.11)`; `Couldn't check against your cap. Convexa couldn't read a dollar amount in the risk figure.`) |
| 22 | every literal distinct from every other and from the four absence literals **(SB)** | PASS | test `AC-22 …` + full manual disjointness incl. the new AC-33 literal. Coverage note N-3 |
| 23 ↻ | a couldn't-check clause names the missing input by closed lookup | PASS | **now a named test** `AC-23 …` covering all three emittable reasons · observed rendering in a real browser in pass 1 |
| 24 | absence renders through the closed literal set with no grounding treatment **(SB)** | PASS | observed (`Target: not given`, no clause, no register override); structurally clause-free on the absence path |
| 25 | no marker on structure / strikes / expiration / entry trigger **(SB)** | PASS | test `AC-25 …` · QA poison → RED · **re-verified live: 0 clauses on all four** |
| 26 | no clause on size or dollar risk; exclusion stated once | PASS | 2 tests · QA poison → RED · re-verified live |
| 27 | block-absent renders one card line in place of every clause **(SB)** | PASS | test `AC-27 …` (fixture with the key deleted, not nulled) |
| 28 | every reference input missing still renders in full **(SB)** | PASS | FE + Rust tests · observed live in pass 1 |
| 29 ↻ | bundle-failure envelope renders no line and no clause | PASS | **now a named test** `AC-29 …` mounting a real `status: unavailable` envelope |
| 30 ↻ | SSE drop changes no clause; no dimming, no offline marker | PASS | **the shipped SSE test now asserts byte-identity of the card line and `clause-stop` across the drop**, plus no disabled/dimmed attribute |
| 31 ↻ | states pinned to production; a newer bundle never re-derives | PASS | **same test extended** across a newer bundle and a changed risk block; superseded strip still the only "old read" signal |
| 32 | no wire token renders as user-visible text | PASS | test `AC-32 …` · QA poison proves the narrowed panel scope non-vacuous · live scans clean on 3 card states |
| **33 ↻** | one statement, placed with the reasoning, saying prose numbers are not checked | **PASS** (was FAIL) | 3 named tests · **observed rendering verbatim in a real browser on both the trade and `no_trade` branches**, in the caption idiom, not inside any field or clause, after the fields and with the reasoning |
| 34 ↻ | no prose number acquires a grounding treatment; prose excluded from the counts | PASS | **now two named tests** `AC-34(a)`/`AC-34(b)` · **QA poison-proved: 3/3 arms RED including the non-vacuity arm** |
| 35 | the definition surface claims coverage for exactly what is checked | PASS | observed tooltip verbatim |
| 36 | the single-dollar-figure directive is in the assembled prompt; deleting it reds the build **(SB)** | PASS | test green (unchanged) · **corroborated on live traffic: 4/4 trade verdicts returned one `$N` figure** |
| 37 | `within`/`above` with both numbers, in the shipped warning chrome | PASS | live real rec `within` / cap 500 / parsed 300; `CapAnnotation` chrome unchanged |
| 38 | two different amounts ⇒ the cap refuses and names the ambiguity **(SB)** | PASS | Rust + FE tests green |
| 39 | the accepted `max_risk` input set does not move by one input **(SB)** | PASS | 8-row outcome table with anti-vacuity assertion, green |
| 40 | three distinct refusal sentences by closed lookup; nothing off `cap_not_derivable_reason` | PASS | test · observed live |
| **41 ↻** | committed before/after artifact, ≥5 real recs across ≥3 tickers, vs the 0-of-4 before-arm; no synthesized run | **PASS** (was FAIL) | `d7-measurement.md` — **10 real recs across 5 tickers**, verified against the **ten raw captured response bodies**: every cell faithful, none discarded, none synthesized. **4 of 4** trade verdicts parseable vs **0 of 4** before. Per-run ticker + verdict tabulated; persona and timestamp recorded per pass rather than per row (N-7) |
| 42 | fabricated rec ⇒ every figure non-traced, `{4,0,4,0}`, *none traced* **(SB)** | PASS | Rust test through `envelope_extras` |
| 43 | honest counterpart ⇒ all-traced and one-field-off variants **(SB)** | PASS | Rust test |
| 44 | the fabricated card shows *none traced* + authorship on every checked figure **(SB)** | PASS | test · observed live in pass 1 (all three values sans, none mono) |
| 45 | fabrication reachable only from fixtures; the config readout reports none | PASS | test · QA poisons → RED ×2 · live readout `scenarios.enabled: false` |
| 46 | off-set literal renders; grounding adds no second statement | PASS | Rust fixture + FE clause count |
| **47 ↻** | untraced split measured over ≥5 recs / ≥3 tickers, ladder written **before** the split is seen, recorded in the artifact and `OPEN_THREADS` | **PASS** (was FAIL) | 10 recs / 5 tickers, rates recomputed from raw captures (57.1% → 44.4%); ladder pre-committed in **SPEC §7** (on disk 01:55Z; **read by me in QA pass 1**, hours before the runs) and executed — `llm.rs` mtime 04:14:50Z sits strictly between the passes. Recorded in the artifact and in `OPEN_THREADS` §7ae. **Threshold provenance not corroborated — N-5** |
| 48 | score / tier / fingerprint byte-identical, and the pin file's diff empty **(SB)** | PASS | 2 tests green · pin diff **empty** · pin file md5-identical to pass 1 · QA poison → RED |
| 49 | a sixth stated number without a rule reds the build **(SB)** | PASS | QA poison → `error[E0004]` |
| 50 | loosening a shipped rule reds the build; fixtures self-assert non-vacuity **(SB)** | PASS | boundary test green · QA poisons ×4 → RED · **the constant and the rules are md5-identical to pass 1** |
| 51 | field-reason iff `not_applicable`, on every branch | PASS | test · QA poison → RED |
| 52 | a third structurally-unchecked field reds the build | PASS | test · QA poison → RED |
| 53 | `traced + untraced + not_checkable == checked` | PASS | test · QA poison → RED · holds on every live payload checked |
| 54 | the target is never traced against an unsent tenor | PASS | test · **QA re-poison-proved this pass under LF and CRLF** |
| 55 | the leaf imports no state/route/HTTP/async; scan anti-vacuity-asserted | PASS | tests · QA poisons ×3 → RED |
| 56 | cooldown and daily-cap counters advance as before; no re-request | PASS | metering path carries zero diff; the shipped test asserts no second POST. **Corroborated this pass**: the D7 run made 10 real calls against the shipped meter with no cap or cooldown anomaly (`override` used as documented) |
| 57 | entry stays simulated behind the existing confirm | PASS | review + observation |
| 58 | no success/error palette, no green/red; only unhappy members carry warning + `aria-hidden` icon | PASS | observed computed styles across members |
| 59 | zero hex; ≥11px; amber clears 4.5:1 in both modes | PASS | glob hex scan green; 12px observed; light `#A65526` pinned 4.91:1, dark `#E07A3F` ≈6.0:1 |
| 60 | no horizontal overflow at 393px; the clause wraps on its own line | PASS | **e2e re-run after the new line was added — 34 passed**, both schemes; `ownLine: true` observed |
| 61 | legal `(field, basis)` pairs; another field's basis reds the build | PASS | test · QA poison → RED · verified on the live payload |
| 62 | line budget: exactly 1 card line, ≤3 clauses, 0 on `no_trade` | PASS | test · counted on the rendered card (1 + 2 live; 1 + 3 fabricated; **0 + 0 on `no_trade` re-verified this pass**) |
| 63 | verdict and risk tile both in the first screen at 393px | PASS | observed y=375 vs y=454 in an 852px viewport |
| 64 | a local-rules rec with nothing checkable renders nothing | PASS | FE + Rust tests |
| 65 | the definition surface reads as an allowlist | PASS | review of the rendered tooltip + the bare excluded fields. **Strengthened by AC-33**: the disclosure now names the checked set a second time, in the reasoning |
| 66 | one real POST captured and walked against §1a | PASS | **layer 2 run in pass 1** — 36/36 paths, all tokens declared, 3 cross-checks + 35 nullability biconditionals. Payload code byte-identical since |
| 67 | size and dollar risk render exactly as on `main` | PASS | observed; those call sites pass no `groundingState` |
| 68 | the withheld prefill explains itself, three distinct reasons **(SB)** | PASS | 9 named tests · QA poison → RED · observed live (re-verified this pass) |

### Summary

**68 PASS · 0 FAIL · 0 UNVERIFIABLE.**

---

## 9. Binding invariants — re-checked

All twelve hold, unchanged from pass 1. `additive-keeps-score-byte-identical` re-verified on **both**
arms (assertions green **and** an empty pin-file diff, with the pin file md5-identical to pass 1);
`structural-over-prose-enforcement` re-verified on guard 8c under both line endings;
`absent-is-not-none` re-verified against the new literal, which deliberately does **not** reuse the
block-absent phrasing; `digested-labels-not-raw-dump` re-verified by the AC-34(b) poison, which proves
the counted line tracks the wire and nothing else.

---

## 10. Criteria-independent Critical sweep — pass 2

Re-run over the pass-2 change set (`copy.ts`, `reasoning.tsx`, `literals.spec.ts`,
`ai-rec.grounding.spec.tsx`, `ai-rec.risk.spec.tsx`, `llm.rs`, `grounding_isolation.rs`,
`OPEN_THREADS.md`, `d7-measurement.md`).

- **Auth / authz:** no endpoint, route or gate touched. The measurement used the shipped BYO-key path
  and the documented `override` field, not a disabled check.
- **Cross-tenant:** nothing new reads or crosses a user boundary.
- **Secret exposure:** the measurement artifact records `key_source` and refusal tokens only — **no key
  material, no raw prompt, no model text beyond what explains a refusal.** I re-scanned the artifact and
  the ten raw captures: no `sk-ant-`, no credential, no cookie value.
- **Destructive data:** none. No store or migration touched.
- **New prompt directive:** a plain instruction string; adds no egress surface and reaches no export.
- **Result: no Critical finding.**

### Findings carried and added

**N-3 (Minor, carried, test coverage)** — AC-22's disjointness set still omits `COULD_NOT_CHECK_LINE`,
the three `MISSING_INPUT_CLAUSE` members, and now also `REASONING_PROSE_NOT_CHECKED`. The property holds
(re-checked by hand this pass across all literals), and the AC-33 test does assert the new literal
differs from the card line — but the set would still not catch a future collapse of *we could not look*
into *we looked and it is not there*. Not bounced; recorded.

**N-5 (Important, new, record hygiene — not an AC failure)** — `d7-measurement.md`'s provenance
sentence asserts a file-creation time (`2026-08-14T04:10:26Z`) and an append-only construction that the
filesystem does not support: the file's creation time equals its last-write time at **04:18:46Z**, after
both passes, and no file created at 04:10:26Z exists anywhere in the repo or the session scratch. The
evidence is **inconclusive**, not disproving — a full-file rewrite resets creation time on this
filesystem — but an artifact that will be read as the record of a pre-registered measurement should not
assert a provenance mechanism that cannot be checked. **Recommended correction:** state what is actually
verifiable — that the ladder is pre-committed in `SPEC.md` §7, and that `llm.rs`'s single modification
time falls strictly between the two passes — and either drop the 04:10:26Z claim or land the numeric
bar somewhere that is timestamped before the first call.

**N-6 (Minor, new, copy)** — on a `no_trade` card the disclosure's tail, *"only the stop, target and
invalidation level above are"*, points at three `—` dashes, since nothing is checked on a `no_trade`
rec. It reads as a present-tense scope statement rather than a claim about that card, and it asserts no
figure as traced, so it is not a false claim — but it is the one place the sentence sits oddly.

**N-7 (Minor, new)** — AC-41 asks for *"per-run verdict, ticker, persona and timestamp"*. The artifact
tabulates verdict and ticker **per run**, but persona and timestamp **per pass** (both are constant
across the ten runs, and the raw captures carry exact per-run times). Substantively met; noted for
precision.

**Carried from pass 1, unchanged:** the two new Rust files are not rustfmt-clean (54-file whole-crate
drift, not a CI gate); the single pre-existing lint error in `stage3-headings.spec.tsx`; SPEC §9 items
5 and 7 remain declared gaps (item 6 no longer applies — layer 2 was run for real).

---

## 11. Overall GATE Q verdict

> **GATE Q: PASS** — 68 PASS · 0 FAIL · 0 UNVERIFIABLE

- Independent conformance: **PASS 2/2** on my own regenerated receipt, agreeing with the backend's.
- Binding invariants: **all hold**, both arms of `additive-keeps-score-byte-identical` included.
- Critical sweep: **no Critical finding**.
- Every bounced item verified by observation: **AC-33** rendered on both branches in a real browser;
  **AC-41/AC-47** recomputed from the ten raw response bodies, with the ladder's pre-commitment
  established from `SPEC.md` §7 and the revision's position between passes established from the
  filesystem; **AC-34** poison-proved on all three arms including non-vacuity; **F-1** cleared with the
  repo-wide CI command; **F-2** re-poison-proved RED under both LF and CRLF with the assertion
  unweakened. The suite baseline is unchanged at 5 accepted red files, 1700 passing, and
  `app.risk.spec.tsx` was green in both of my runs.

Three Minor and one Important record-hygiene finding (N-5) remain; none blocks the gate. N-5 should be
corrected in `d7-measurement.md` before that artifact is archived, since it is the record a later
session will read as proof that the measurement was pre-registered.

---

*QA writes: this file and `conformance-receipt-qa.json` only. No source, contract, SPEC, INTERFACE or
PLAN file was modified in either pass. Every poisoned file was restored and md5-verified
byte-identical; at the end of this pass the working tree differs from its state at the start of pass 2
by nothing at all, and `grounding.rs` / `recommendation.rs` / `field_reasons.rs` / `score_identity.rs` /
`FigureClause.tsx` remain md5-identical to the bytes verified in pass 1.*
