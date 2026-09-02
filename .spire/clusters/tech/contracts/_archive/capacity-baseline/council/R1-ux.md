# R1 — ux position: capacity-baseline

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here**, and there is **no `/_ops/metrics` change**. The BRIEF is a named maintainer load/soak **command** plus a **receipt**. It must not change trader-visible behavior, scoring, or production runtime defaults.

`NO_UI_CHANGE` is binding. `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** (The Curvature Terminal). This feature consumes **no** dashboard route, component, token, motion, chip, or copy table. SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table. I request **no amendment** to `DESIGN_SYSTEM.md`. Anyone proposing a Ticker “capacity” widget, a Settings toggle, an Ask-AI footnote, or a `/_ops` capacity dashboard is re-scoping — raise it as an R2 `product` conflict; do not fold it in.

The canon’s honesty rules still bind the **words** on the command/receipt: simulated and mocked reads carry their framing **in-body**, not as a footnote; a number with no vouched source does not ship; a label must not rename what the value is.

The user-facing surface I own is three coupled artifacts plus hard negative space:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S1 | **CLI stdout** while a named load or soak command runs | maintainer / CI log | every printed word, progress vs verdict, absence literals, banned terms |
| S2 | **Run receipt** (durable artifact + stdout twin) | maintainer later; any later council quoting the run | standing block, labels, units, outcome-class names, what the receipt is allowed to claim |
| S3 | **Negative space — trader product + operator-metrics UI + research-lab chrome** | every trader; anyone reading `/_ops/metrics` or a score-lab report | what must **never** appear: no route, nav, chip, panel, badge, metrics-page series, or research-lab standing title for this harness |

This is **not** a research replay (`batch-backtest` / `score-lab` / `replay-outcome-join`). Those artifacts say **NOT LIVE** about stored books and **Authorizes: nothing** on the live score. This harness says **NOT A PRODUCTION MEASUREMENT** about a **mocked-vendor** process and **Authorizes: nothing** on trader UI, scoring, **or production runtime defaults**. Do not reuse `RESEARCH READ` / `RESEARCH REPLAY` as the title — a pasted receipt would inherit the wrong genre.

This is **not** `GET /api/_metrics` / `/_ops/metrics`. That page already labels process-telemetry **p95** over a rolling window (empty → `—`, headroom `null` → `unknown`, non-alerting). A harness p95 is a **different datum**. Collapsing the two labels is the defining integrity failure for this feature.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** a Convexa maintainer or CI job, not the anonymous or signed-in trader, and not a desk operator reading `/_ops/metrics`.
- **Primary job:** *Run one named command; know whether this mocked process stayed under the locked harness p95 / unexpected-error / capacity-refusal thresholds; know that a pass is not a production measurement and does not authorize changing defaults, scoring, or trader copy.*
- **Failure I am designing against:** a receipt (or CI green line) quoted later as “production can take N live traders,” “Massive p95,” “SLO,” or “we verified capacity” — or a 503 capacity refusal mixed into “errors,” or a 0-request run recorded as a pass.

**Information structure (S1/S2), always in this order:**

1. Standing / framing block **first** (what this run is — before any latency number).
2. Identity: named command (`load` or `soak`), evidence class (`local` or `ci`), locked surfaces actually driven, process-local ceilings actually used, vendor-I/O standing.
3. Counts by **closed outcome class** (never one blended “error rate”).
4. Observed harness figures next to **the same run’s locked thresholds**, each with unit and basis.
5. One terminal verdict line that agrees with the process exit code.
6. Closing reminder: not a production measurement; authorizes nothing.

**User vocabulary — closed term set. These are the only words the output may use for these things:**

| Concept | Approved term | **Banned** (asserts a meaning the data cannot carry) |
|---|---|---|
| What ran | **capacity harness** · **load** · **soak** | “production test,” “live load test,” “Massive soak,” “SLO check,” “benchmark of production” |
| The process under test | **this harness process** · **mocked-vendor process** | “production,” “Railway,” “the live site,” “our capacity” |
| Vendor I/O | **in-process mock** · **0 outbound vendor calls** (only when vouched) | “Massive latency,” “paid feed,” “live Options,” “vendor p95” |
| Latency figure | **harness p95** + unit **ms** + **basis** (the architect-named timer, printed) | bare “p95,” “p95” as if it were `/api/_metrics` `p95_ms`, “mean,” “users can load in X ms” |
| Unexpected failure | **unexpected error** | blending this with 503/429; “errors” as a synonym for refusals |
| LiveCapacity 503 | **capacity refusal** (503) | “rate limited,” “error,” “outage,” trader sentence “Live streaming is at capacity…” as a harness verdict |
| Public limiter 429 | **rate-limit refusal** (429) | “capacity refusal,” “error,” “too many users” |
| Client gave up | **client timeout** | “server error,” “capacity refusal” |
| Locked bars | **harness thresholds** · **locks** | “SLO,” “production ceiling,” “SLA,” “certified limit” |
| Evidence class | **local** · **ci** | a local pass labeled as CI; a CI load labeled as soak; “hosted production evidence” |
| The output document | **capacity receipt** | “results dashboard,” “metrics snapshot,” “research read,” “production report” |
| Authorization | **Authorizes: nothing** on trader-visible behavior, score/tier/gate/fingerprint, or production runtime defaults | “production ready,” “raise MAX_LIVE_SUBSCRIBERS,” “ship this p95,” “verified,” “can handle N subscribers” |
| Production SSE copy (unchanged, not ours to rewrite) | existing trader detail remains **`Live streaming is at capacity. Try again shortly.`** on the **trader** 503 body | reprinting that sentence as the harness FAIL/PASS line |

Verified at source (not assumed): `LiveCapacity` defaults `MAX_LIVE_SESSIONS=50` / `MAX_LIVE_SUBSCRIBERS=500`; refuse is **503 + `Retry-After: 30`**, detail `Live streaming is at capacity. Try again shortly.` (`apps/api/src/services/live_capacity.rs`, `apps/api/src/routes/stream.rs`); `PUBLIC_RATE_LIMIT_PER_MIN` default **120**, **`0` disables** and the config comment names load tests (`apps/api/src/config.rs`); 429 body is `error: rate_limited` + `Too many requests. Limit is {n} per minute per IP on data endpoints.` (`apps/api/src/middleware/rate_limit.rs`). The harness may **exercise** those paths. It may **not** relabel them, and it may **not** change those production strings or defaults.

### 2. Binding framing (must ship on every receipt, including FAIL / BLOCKED / INCOMPLETE)

`(a)` **Standing block is first** on stdout and in the receipt, before any p95 or count:

```
CAPACITY HARNESS — MOCKED VENDORS · NOT A PRODUCTION MEASUREMENT
  Command:     {load|soak}
  Evidence:    {local|ci}
  Surfaces:    {architect-locked list actually driven this run — never “the API”}
  Vendor I/O:  in-process mock · 0 outbound vendor calls
  This process (not production defaults):
               MAX_LIVE_SESSIONS={n} · MAX_LIVE_SUBSCRIBERS={n} · PUBLIC_RATE_LIMIT_PER_MIN={n}
  Thresholds:  harness p95 {basis} ≤ {p95_lock} ms
               unexpected-error rate ≤ {error_lock}
               capacity-refusal rate ≤ {refusal_lock}
               (harness locks — not production SLOs)
  Authorizes:  nothing. No trader-visible change, no score/tier/gate/fingerprint change,
               no production runtime default change.
```

`{p95_lock}`, `{error_lock}`, `{refusal_lock}`, soak duration, and the surface list are **PM/architect locks, not UX numbers**. I own that those locks are **printed beside the observed values**, that they are named **harness thresholds**, and that a missing lock is a blocked run, not a pass.

`(b)` **Vendor I/O line is not decorative.** Print `in-process mock · 0 outbound vendor calls` only when the run can vouch it. If it cannot, the verdict is **BLOCKED** (below), never PASS with the claim omitted.

`(c)` **Ceilings are “this process.”** If the harness sets `PUBLIC_RATE_LIMIT_PER_MIN=0` (the existing documented load-test disable) or lowers LiveCapacity ceilings to provoke 503s, the receipt must say **this process only — not production defaults**. A pass must not be readable as “we changed production to 0 / 500 / 50.”

`(d)` Repeat one closing line at the bottom of stdout and the receipt:

`CAPACITY HARNESS — NOT A PRODUCTION MEASUREMENT · Authorizes: nothing`

`(e)` The receipt is **this-run**. It carries a run timestamp. It never says “current production,” “live p95,” or “as of the last deploy.”

### 3. States (command + receipt) — complete matrix

There is no dashboard component matrix. Browser default/loading/empty/error/offline/stale are **N/A** (`NO_UI_CHANGE`). These are the **operator-visible run states**. Empty, blocked, incomplete, and fail must stay **visibly distinct** (`[absent-is-not-none]`). Progress copy is not a verdict.

| State | When | Operator sees | Must not happen |
|---|---|---|---|
| **running** | Load or soak in flight | `[RUNNING] {load\|soak} — {elapsed} / {locked duration or “until N requests”} — no verdict yet` plus phase/counts | A partial file titled as a finished receipt; a p95 printed as if final |
| **pass** | Run completed; vendor I/O vouched in-process; all three locks held; ≥1 request actually driven | Standing block → identity → class counts → observed vs locks → `[PASS] …` → closing line; **exit 0** | “production ready”; soak label on a load command; `/_ops/metrics` p95 wording |
| **fail — threshold** | Run completed; at least one lock crossed | Standing block remains; `[FAIL]` names **which lock**, observed vs lock, unit/basis; **exit non-zero** | Generic “failed”; treating a crossed refusal lock as an “error” or vice versa |
| **fail — vacuous** | 0 requests/streams selected or completed | `[FAIL] {command} — 0 requests selected; no pass recorded.`; **exit non-zero**; **no** measurement receipt that can be quoted as “we measured and found nothing wrong” | Silent green; empty artifact that looks like a clean baseline |
| **blocked — vendor I/O** | Mock boundary broken, outbound vendor call detected, or the 0-outbound claim cannot be vouched | `[BLOCKED] {command} — vendor I/O left the process or is unverifiable. No pass recorded.` **exit non-zero** | PASS with the vendor line omitted; burning the paid Options feed |
| **blocked — paid feed** | Run would require or use `MASSIVE_API_KEY` / live Massive | `[BLOCKED] {command} — paid Options feed would be used. Harness must not burn the paid Options feed. No pass recorded.` **exit non-zero**; **do not print the key** | Echoing secrets; falling back to live Massive to “still get a number” |
| **incomplete** | Soak/load ended before the locked duration or requested N (kill, crash, timeout of the harness itself) | `[INCOMPLETE] {command} — run ended at {elapsed} before locked {duration_or_N}. No pass recorded.` **exit non-zero** | Using a partial p95 as a baseline; exit 0 |
| **not-run (other mode)** | The invoked command is load-only (e.g. CI) and soak is not part of it | `[NOT RUN] soak — not part of this command. {ci\|local} load evidence is not soak evidence.` Does **not** by itself fail a load command | Labeling a CI load receipt as soak; implying soak passed because it was skipped |
| **harness error** | Command cannot start (bind fail, missing mock, bad flags) | `[ERROR] {command} — {closed reason}. No pass recorded.` **exit non-zero** | Trader-facing 5xx; writing a PASS receipt |
| **offline / stale (trader SSE sense)** | N/A — this is not the Ticker live chip | — | Inventing `⏸ offline` / “Live offline” / `unavailable this cycle` on the receipt |
| **trader product (negative)** | Always | Unchanged Ticker/SSE/Settings/Ask-AI/`/_ops/metrics` | New copy, route, or default |

**Closed outcome classes** (counts on every finished receipt; never collapse):

| Literal (exact class name) | Means | Must not be filed under |
|---|---|---|
| `ok` | 2xx (and, for SSE, a successfully admitted stream the harness treats as success — architect names the success token; the label stays `ok`) | — |
| `capacity refusal` | 503 from the LiveCapacity path (same refuse class as production SSE) | `unexpected error`, `rate-limit refusal` |
| `rate-limit refusal` | 429 from `PUBLIC_RATE_LIMIT_PER_MIN` | `capacity refusal`, `unexpected error` |
| `unexpected error` | Other 5xx / transport failures that are not the two refusal classes | either refusal class; `ok` |
| `client timeout` | Harness aborted waiting | `unexpected error`, `capacity refusal` |
| `not attempted` | This class was not in play (e.g. limiter disabled ⇒ 429s should be **zero**, not “n/a”) | blank, `n/a`, bare `0` without the class name |

Banned competing empties on this CLI: `n/a`, blank, trader `—`, `unavailable this cycle`, `unknown` (that last is `/_ops/metrics` headroom copy — wrong register here), research `no stored snapshot`.

If `PUBLIC_RATE_LIMIT_PER_MIN=0` this process and a 429 still appears, that is **harness error / blocked**, not a capacity result.

### 4. Exact verdict wording

Placeholders in braces are filled from **this run’s** vouched fields. Do not hard-code counts.

| Verdict | Exit | Exact operator-facing line |
|---|---|---|
| Running | pending | `[RUNNING] {load\|soak} — {elapsed} / {locked_span} — no verdict yet` |
| Pass | 0 | `[PASS] {load\|soak} — harness p95 {basis} {p95} ms (lock {p95_lock} ms) · unexpected errors {err}/{n} (lock {error_lock}) · capacity refusals {ref}/{n} (lock {refusal_lock}) · vendor I/O stayed in-process · not a production measurement` |
| Threshold fail | non-zero | `[FAIL] {load\|soak} — crossed {harness p95\|unexpected-error rate\|capacity-refusal rate}: observed {obs} lock {lock}{unit}. Not a production measurement.` |
| Vacuous | non-zero | `[FAIL] {load\|soak} — 0 requests selected; no pass recorded.` |
| Vendor blocked | non-zero | `[BLOCKED] {load\|soak} — vendor I/O left the process or is unverifiable. No pass recorded.` |
| Paid-feed blocked | non-zero | `[BLOCKED] {load\|soak} — paid Options feed would be used. Harness must not burn the paid Options feed. No pass recorded.` |
| Incomplete | non-zero | `[INCOMPLETE] {load\|soak} — run ended at {elapsed} before locked {locked_span}. No pass recorded.` |
| Soak not in this command | 0 only if the **load** command independently passed; soak itself is not a pass | `[NOT RUN] soak — not part of this command. {ci\|local} load evidence is not soak evidence.` |
| Harness error | non-zero | `[ERROR] {load\|soak} — {closed reason}. No pass recorded.` |

Do not use “SLO miss,” “production down,” “verified,” “certified,” “WCAG,” “pixel perfect,” “Live,” or “Massive p95” in any generated line. Color may supplement severity; **plain text must carry the whole meaning** (CI logs strip ANSI).

Human summary, machine receipt, and **exit code must agree**. A success-sounding line with a non-zero exit (or the reverse) is a copy bug.

Named commands the operator/CI must be able to say without guessing (architect binds the actual nx/cargo/npm target; I own that the **labels** stay `load` vs `soak` and cannot be aliases of `serve`):

- a **load** command — the CI-eligible named check unless PM locks otherwise
- a **soak** command — distinct name; a load receipt must not print `Command: soak`
- no path from CI aggregate → “update thresholds” / rewrite locks

I do **not** invent npm script names if the architect chooses clap-only; if npm wrappers exist, follow the `browser:*` pattern (`capacity:load` / `capacity:soak`) so maintainers do not type `serve`.

### 5. What must never appear on Ticker / Settings / Ask-AI / `/_ops/metrics`

Per BRIEF + `[operator-vs-trader-path-separation]` + `NO_UI_CHANGE`:

- **No** Ticker widget, Command Deck control, live chip, freshness line, or skeleton about harness/load/soak.
- **No** Settings panel for “run capacity,” mock toggle, or ceiling editor.
- **No** Ask-AI disclosure that cites this receipt as a reason the live score or tier moved (it must not have moved).
- **No** Scanner column, Positions cell, Landing CTA.
- **No** new series, caption, or tooltip on `/_ops/metrics` that plots harness p95 as if it were process telemetry.
- **No** change to trader 503 detail `Live streaming is at capacity. Try again shortly.` or to the 429 `Too many requests…` string.
- **No** change to production defaults `MAX_LIVE_SESSIONS`, `MAX_LIVE_SUBSCRIBERS`, `PUBLIC_RATE_LIMIT_PER_MIN` as a side-effect of shipping the harness.

Structural proof belongs to architect/FE empty-diff / path guards; **copy proof** is zero new trader-facing strings in dashboard copy tables for this feature.

### 6. Microcopy integrity rules (defining failure mode)

1. Trace every printed number to a vouched field from **this harness run** (or mark the class `not attempted`). No orphan “looks fast enough for production.”
2. Do not rename **harness p95** to “p95” next to `/_ops/metrics` language, and do not rename **capacity refusal** to “error” or “rate limited.” Production refuse is 503, not 429 — verified at `live_capacity.rs` (“Over either: 503 + Retry-After, not 429”).
3. Do not label mocked I/O as Massive/live Options latency. Fixture provenance may appear as lineage (`source: fixture`) and must **never** render as a Live chip or “● Live.”
4. Do not call locks **SLOs**. Production-maturity **#7** is `telemetry-slos` and is queued **after** this item. This receipt is a **harness gate**, not an SLO dashboard.
5. Tooltips/glossary: N/A on trader UI. Inside the receipt, a short legend may define the three locks and the outcome classes — definitions explain; they do not invent metrics.
6. Secrets: receipts and stdout never interpolate `MASSIVE_API_KEY`, tokens, cookies, or connection strings (`[no-secrets-in-image]` on the artifact).
7. `[model-read-carries-its-assumptions]`: every harness p95 line names its **basis** (what clock: e.g. bundle GET wall time vs time-to-first SSE event — architect names the timer; UX requires the name on the line). A p95 without a basis is an undefended claim — **withdraw it**.
8. `[absent-is-not-none]`: skipped soak is `NOT RUN`, not a zero-refusal pass; 0 requests is `FAIL`, not empty-success; limiter-off 429s are not `n/a`.

### 7. Acceptance criteria → states → `Verify by`

These are the operator-visible criteria I own. Marks land in synthesized SPEC §3 `Verify by` per `spire-tech-risk-based-verify`. There is no separate test-case matrix. The BRIEF has outcome statements rather than numbered ACs; these IDs are the UX rows the synthesizer should fold.

| ID | Acceptance criterion | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | SPEC §4 carries **`NO_UI_CHANGE`**; no new trader route, nav, Settings, Ask-AI, Ticker, Scanner, Positions, or `/_ops/metrics` affordance for capacity/load/soak | negative space | **test** | A silent dashboard string/route is invisible on a CLI-only review pass |
| UX-2 | Production trader 503 detail and 429 rate-limit message are byte-unchanged | negative space | **test** | Copy drift on the live SSE/API path is silent if we only read harness stdout |
| UX-3 | Standing block is the **first** block of stdout and of the receipt on every finished run (pass, fail, blocked, incomplete) | pass / fail / blocked / incomplete | **test** | Hedge drop on one branch is negative space |
| UX-4 | Standing/closing copy always includes the tokens `CAPACITY HARNESS`, `MOCKED VENDORS` or `in-process mock`, `NOT A PRODUCTION MEASUREMENT`, and `Authorizes: nothing` | all finished states | **test** | Required-token presence silently regresses; exact prose cadence is UX-5 |
| UX-5 | Standing block wording, field order, and “harness locks — not production SLOs” / “this process (not production defaults)” match §2 | pass / fail | **review** | Visible intentional copy |
| UX-6 | Exit 0 occurs only in **pass** (and a load command may exit 0 with soak `NOT RUN` only if load independently passed); every fail/blocked/incomplete/vacuous/error exits non-zero; verdict line and exit agree | all | **test** | CI consumers read exit codes, not prose |
| UX-7 | 0 requests/streams selected exits non-zero and writes **no** quoteable measurement receipt | fail — vacuous | **test** | Vacuous green is the worst harness failure mode |
| UX-8 | Incomplete soak/load (elapsed < locked span or N) exits non-zero and is labeled `INCOMPLETE`, never PASS | incomplete | **test** | Partial p95 as baseline would silently lie |
| UX-9 | Vendor I/O that leaves the process, or cannot be vouched, is `BLOCKED`, exit non-zero, no PASS | blocked — vendor I/O | **test** | Paid-feed burn / mock leak is invisible in a “p95 looks fine” table |
| UX-10 | A path that would use the paid Options feed / live Massive is `BLOCKED` with the paid-feed sentence; secrets are not printed | blocked — paid feed | **test** | Key echo and silent live fallback are silent-regression / secret risks |
| UX-11 | Finished receipts count `ok`, `capacity refusal`, `rate-limit refusal`, `unexpected error`, and `client timeout` as **separate** classes; 503 is never filed as `unexpected error` or `rate-limit refusal` | pass / fail — threshold | **test** | BRIEF locks p95 **and** error **and** refusal; blending them makes a lock unobservable |
| UX-12 | `[FAIL]` on a crossed lock names which of the three locks tripped and prints observed vs lock with unit | fail — threshold | **test** | Which lock fired is an invariant, not a stylistic choice |
| UX-13 | Harness p95 is labeled **harness p95**, unit **ms**, with a printed **basis**; it is never labeled as `/api/_metrics` p95 or “Massive p95” | pass / fail — threshold | **test** | Silent rename of the datum is the defining integrity failure |
| UX-14 | Receipt prints process-local `MAX_LIVE_SESSIONS`, `MAX_LIVE_SUBSCRIBERS`, `PUBLIC_RATE_LIMIT_PER_MIN` actually used, framed as **this process, not production defaults** | pass / fail | **test** | Missing ceilings turn a mock run into an implied production claim |
| UX-15 | Load vs soak are distinct command labels; a load receipt cannot say `Command: soak`; CI/local evidence class is printed; skipped soak is `[NOT RUN] soak` not a zero-refusal pass | pass / not-run | **test** | Evidence-class swap is silent in CI summaries |
| UX-16 | `[NOT RUN] soak` uses the exact “load evidence is not soak evidence” wording | not-run | **review** | Intentional wording |
| UX-17 | Running output says **no verdict yet** and is not titled as the final receipt | running | **review** | Visible; low silent-regression risk |
| UX-18 | Banned phrases do not appear: `SLO`, `production ready`, `verified`, `certified`, `● Live`, `live load test`, `Massive p95`, `can handle`, `Authorizes:` anything other than `nothing` | all | **test** | Phrase scan; wrong-register copy silently lands from shared helpers |
| UX-19 | Production runtime defaults for LiveCapacity and public rate-limit are unchanged by shipping/running the harness; score/tier/`state_fingerprint` remain byte-identical | negative space | **test** | Default/score drift is invisible on a receipt-wording review |
| UX-20 | Dashboard copy tables gain no trader-cycle literals for this feature (`unavailable this cycle`, Live offline, sim `—` as miss) | all | **test** | Wrong-register copy from shared helpers |
| UX-21 | Receipt/stdout contain no secret values | all | **test** | Secret leakage is not caught by reading for tone |

## Risks I see

1. **Harness p95 vs `/_ops/metrics` p95.** Same three-letter token, different clocks. A paste into a weekly note will say “p95” and readers will open the operator page. UX-13 exists for this.
2. **503 capacity refusal filed as “error.”** BRIEF wants **three** locks. One blended error rate makes the refusal lock untestable and teaches the wrong production meaning (capacity refuse is **503**, not 429, not 5xx-compute).
3. **A green vacuous run.** 0 selected requests, skipped soak, or incomplete duration recorded as PASS is how an unmeasured gap stays “closed.”
4. **Mock framing dropped on FAIL.** People quote failures harder than passes. Standing block on FAIL/BLOCKED is load-bearing (UX-3).
5. **Process ceilings read as production defaults.** If the harness disables the public limiter or lowers subscriber caps, a receipt that does not say “this process only” becomes a GATE-Z default change in the reader’s head.
6. **Genre collision with research CLIs.** Reusing `RESEARCH READ — NOT LIVE` would mark a load test as a score-lab artifact (or the reverse). Different standing title is intentional.
7. **Trader 503 copy “helpfully” reused as the harness FAIL line.** That sentence is for a **trader** waiting on SSE. On a CI log it reads as a production outage.
8. **Calling this an SLO** steals production-maturity #7’s meaning before telemetry exists.
9. **My own failure mode, named:** inventing dashboard states, numeric locks, soak duration, or route lists the BRIEF left for the council to lock. I have not chosen p95/error/refusal numbers, duration, or the final surface set. If a later sentence in this file looks like a production user-count claim, **withdraw it**.

## Assumptions I'm making about the other two lanes

- **Architect provides one named load command and one named soak command** (clap and/or nx/npm) that are not aliases of `serve`, and CI invokes at most the load command unless PM explicitly locks soak into CI.
- **Architect makes outbound Massive/Options I/O structurally impossible in those commands** (in-process mock/stub; no live `MarketDataPort::Live` / `LiveMassive` path), so the receipt line `in-process mock · 0 outbound vendor calls` is true or the run is BLOCKED — never aspirational.
- **Architect emits separately counted `ok` / `capacity refusal` (503 LiveCapacity) / `rate-limit refusal` (429) / `unexpected error` / `client timeout`**, not a single “error” blob, so UX-11 can be implemented without guessing from free-form logs.
- **Architect prints the process-local values of `MAX_LIVE_SESSIONS`, `MAX_LIVE_SUBSCRIBERS`, and `PUBLIC_RATE_LIMIT_PER_MIN` actually used this run**, and does **not** change those production defaults when the harness is shipped or run.
- **Architect does not rewrite** trader 503 detail `Live streaming is at capacity. Try again shortly.` or the 429 `Too many requests…` message.
- **Architect names one printable latency basis per driven surface** (e.g. bundle GET wall time vs time-to-first SSE event) that the receipt can echo; I will not invent the timer.
- **Architect locks the driven surface list to a closed, printable set** (BRIEF says API/SSE; existing routes include `GET /api/ticker/{ticker}`, `GET /api/stream/{ticker}`, `GET /api/stream/prices` — inclusion is architect’s, not mine) and the receipt prints **that** list, never “the whole API.”
- **Architect treats 0 selected requests, incomplete duration, and unverifiable vendor I/O as non-zero exits** with no PASS receipt.
- **Architect keeps the harness an off-request test driver** (BRIEF `single-ticker-on-demand`): it never becomes an in-request market sweep and never writes a second scoring path.
- **PM locks numeric harness thresholds (p95, unexpected-error rate, capacity-refusal rate) and soak duration/N** as named constants the receipt can print; PM does **not** call them SLOs and does **not** treat a pass as authorization to raise production ceilings.
- **PM’s AC set includes ship-blocking rows** for: `NO_UI_CHANGE`, no production default change, no score/tier/fingerprint change, mocked vendor I/O never leaves the process, non-zero exit when a lock is crossed, exit 0 only when below locks with a framed receipt.
- **PM does not scope** a trader-visible capacity UI, a `/_ops/metrics` series, `telemetry-slos`, a production user-count claim, or a live-Massive soak into this feature; if PM’s position does, I will file an R2 `product` conflict rather than design it.
- **PM distinguishes CI evidence from local evidence** the same way `browser-quality-gates` distinguished local vs hosted: a CI load pass is not soak evidence and neither is a production measurement.
- **Neither lane proposes folding harness numbers into Ask-AI context, Ticker tiles, or `/_ops/metrics`.** `NO_UI_CHANGE` / no-amendment assumes both agree.
