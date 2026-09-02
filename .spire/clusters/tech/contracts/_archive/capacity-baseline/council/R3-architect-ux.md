# R3 — architect ⇄ ux: capacity-baseline

Conflict `b4adaac8`. One exchange. UX already withdrew the capacity-refusal *rate* lock (`d7cd1197`) and the single 503 bucket (`c11c1ced`). Expected probe 503s stay out of unexpected-error. Subscriber-ceiling vs session-ceiling stay distinct class names.

## Resolution

**CONVERGED** on both remaining items.

### 1. Two refusal checks, not `{refusal_lock}`

I withdraw any remaining `{refusal_lock}` rate upper bound on the same run as the overflow probe. p95 locks and unexpected-error = 0 stay upper-bound locks; refusal does not.

Mechanism: **phase-separated counters**, not one blended rate over the whole process.

LiveCapacity only admits SSE (`admit_and_subscribe`). Ticker-analysis HTTP is not this refuse class. A 503 on HTTP during hold is unexpected-error, not a capacity refusal.

| Check | When | Predicate | Vacuity / fail |
| --- | --- | --- | --- |
| **Hold under ceiling** | Warm HTTP + SSE hold (and soak hold): this-process subscriber/session ceilings ≥ concurrent admitted clients | Capacity-refusal count **0**: subscriber-ceiling count = 0 **and** session-ceiling count = 0 in this phase | Any such 503 in hold fails the command (admission regression). |
| **Overflow probe** | Dedicated admit wave with probe ceilings **below** client count (`max_subscribers+1` on one ticker; independently `max_sessions+1` new symbols) | Every overflow attempt is **503** with **Retry-After: 30** (header seconds = 30, same production refuse). Subscriber overflow files as subscriber-ceiling refusal; session overflow files as session-ceiling refusal. Those 503s are **excluded** from unexpected-error. | All-admit (zero overflow refusals after overflow was attempted) is **vacuous fail**, not a green low rate. Missing/non-30 Retry-After fails that attempt. Misfile as unexpected-error or rate-limit refusal fails. |

Rate-limit refusal remains a separate class. This-process limiter is 0, so the count prints **0** (never blank); a 429 in that state is blocked/harness error, not a capacity result. Trader 503/429 bodies stay byte-unchanged and are not the harness verdict line.

PASS/FAIL copy (UX wording) must name **which of the two checks** tripped and **which class** (subscriber vs session). It must not read as if expected probe 503s sat under a rate cap.

### 2. Standing block: stdout + receipt file, not stderr

I withdraw R1 “stderr framing” as the standing destination.

Mechanism, matching in-repo research **default** mode (standing first on stdout + artifact; progress on stderr) and this slice’s lack of a `--json` pipe mode:

- **stdout** — finished human summary; standing is the **first** block (pass, fail, blocked, incomplete).
- **receipt file** — standing is the **first** block of the durable artifact. A receipt without standing is a failed run (parser already required this).
- **stderr** — **progress only** (`[RUNNING] … no verdict yet`). No standing, no terminal verdict. So `>` of stdout is quoteable with framing, and `2>&1` CI logs do not print standing twice or put a finished block after progress in a way that makes “first” ambiguous.

Human summary, receipt, and exit code still must agree. I do not add a v1 `--json` exception that would move standing prose to stderr.

## Still disputed (or "none")

none
