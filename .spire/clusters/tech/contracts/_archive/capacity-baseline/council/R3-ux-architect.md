# R3 — ux ⇄ architect: capacity-baseline

One exchange. Conflict `b4adaac8` only. R1 not rewritten.

Already settled (not reopened): `{refusal_lock}` as a rate is withdrawn; one blended `capacity refusal` bucket is withdrawn — receipt classes keep subscriber-ceiling vs session-ceiling vs rate-limit distinct; 503 never files as `unexpected error` or `rate-limit refusal`; trader 503/429 bodies stay byte-unchanged.

Architect ask answered here: exact standing and FAIL wording that replaces `capacity-refusal rate ≤ {refusal_lock}`. UX ask answered here: stdout vs stderr vs file for the standing block.

## Resolution

**CONVERGED** on architect’s two predicates. I withdraw every remaining `{refusal_lock}` / `capacity-refusal rate` line from standing, PASS, and FAIL. Expected overflow 503s are refusals, not a rate the run stayed under.

### Two refusal checks (not a rate)

| Check | Hold | FAIL if |
|---|---|---|
| **Under-ceiling** | this-process hold under the printed ceilings | unexpected 503 count ≠ 0 |
| **Overflow** | every overflow attempt is **503 + Retry-After 30** (subscriber-ceiling and session-ceiling named separately on the counts) | any overflow attempt is not that pair; or 0 overflow attempts (vacuous); an all-admit probe fails |

Overflow 503s are **excluded** from the unexpected-error lock. An under-ceiling 503 still files as `subscriber-ceiling refusal` or `session-ceiling refusal` (never as `unexpected error`) **and** trips the under-ceiling check. Rate-limit remains a class count (`0` when this-process limiter is 0, never blank); it is not a third standing refusal lock.

### Standing — replace the refusal-rate line

Delete:

```
               capacity-refusal rate ≤ {refusal_lock}
```

Print, still inside the standing block, before any observed table:

```
  Refusal:     under-ceiling unexpected 503s = 0
               overflow: every attempt is 503 + Retry-After 30
               (harness locks — not production SLOs)
```

Do not print `capacity-refusal rate`, `refusal_lock`, or any inequality that expected probe 503s would appear to breach. Subscriber-ceiling vs session-ceiling stay in the **counts**, not as a blended rate. Observed overflow counts (pass / threshold-fail only, per `R3-ux-pm.md`): `{n} subscriber-ceiling · {n} session-ceiling · 503 + Retry-After 30`. A required overflow family that did not run is `[NOT RUN]`, never a zero-refusal pass.

### PASS / FAIL — exact operator lines

Placeholders are this-run vouched fields. Do not reprint trader copy `Live streaming is at capacity. Try again shortly.` as a harness verdict.

| Verdict | Exit | Exact line |
|---|---|---|
| Pass (refusal half; p95/error/stream-hold stay their own locks) | 0 | `[PASS] {load\|soak} — … · under-ceiling unexpected 503s 0 · overflow: {n_sub} subscriber-ceiling + {n_sess} session-ceiling, all 503 + Retry-After 30 · vendor I/O stayed in-process · not a production measurement` |
| Under-ceiling fail | non-zero | `[FAIL] {load\|soak} — under-ceiling unexpected 503s: observed {n} lock 0. Not a production measurement.` |
| Overflow fail (admitted or wrong retry) | non-zero | `[FAIL] {load\|soak} — overflow ({subscriber-ceiling\|session-ceiling}): {n} of {attempts} attempts were not 503 + Retry-After 30. Not a production measurement.` |
| Overflow vacuous | non-zero | `[FAIL] {load\|soak} — overflow probe: 0 overflow attempts; no pass recorded.` |

`[FAIL]` names **which** of the two checks tripped. PASS may record non-zero overflow 503s. That is not a crossed lock.

### Standing block: stdout vs stderr vs file

Architect constraint accepted: standing is **mandatory in the receipt file**; a receipt without standing is a failed run. UX-3 restated to the in-repo research `emit_run` contract (sibling clap commands):

| Mode | Standing goes | Does not |
|---|---|---|
| Receipt file (every finished run) | First block of the durable artifact | File-only with no console standing on a finished run |
| Default human CLI | **stdout** first, then the rest of the human record and the closing line | A second copy on stderr in the same invocation |
| stdout occupied by a machine document (`--json` or equivalent, if it exists) | **stderr** first; JSON on stdout | Standing on stdout (would break the document) |
| `[RUNNING]` progress | **stderr** | Titled as a finished receipt; mixed into JSON stdout |

v1 with no JSON mode is **stdout + file**. Architect’s “stderr” is the progress stream and the JSON-mode human stream, not “standing never on stdout.” Do not emit standing on all three at once.

## Still disputed

none
