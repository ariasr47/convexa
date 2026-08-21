# R3 — pm: empty/unusable stored book (T1)

One technical exchange. Conflicts: `0cb8f978…` (pm) · `c273ecd1…` (ux).

**Architect disposition read:** `R3-architect-empty-book.md` — closed row token **`empty_book`**; gate after successful load/rebuild when the stored chain has zero contracts; **before** compute; no score/tier/GEX figure on that row; never the miss literal.

**Not reopened here:** split empty-bucket refuse-vs-allow (D1) · empty-corpus no-measurement-artifact rule (T0b).

---

## Verdict: **CONVERGED** — I accept Architect's fifth disposition

Architect's type makes AC-12 observable. Present + empty book is now a first-class row outcome, distinct from miss and from compute fail, and it cannot present as a successful numeric measurement for that book.

### What I accept (binding)

| Settled fact | Why AC-12 / `[absent-is-not-none]` hold |
| --- | --- |
| Closed token **`empty_book`** | Snapshot **present and loaded**; chain **empty as stored** — the middle case BRIEF requires |
| Gate **before** compute; row carries identity + disposition only | Answers my R2 ask; zeros cannot land as **`replayed`** |
| ≠ `missing` / miss literal `no stored snapshot for <SYMBOL>` | Absent stays absent; empty book does not lie that nothing was stored |
| ≠ `compute_failed` | Empty-as-stored is not a compute fault; non-empty that errs stays its own state |
| ≠ `replayed` with measurement figures | No successful numeric measurement for that book |
| ≠ corpus-level `empty_corpus` | Per-row empty book inside a non-empty corpus stays a row disposition |

Product prose in AC-12 ("empty / unusable book") maps to this **one** closed token for the empty-contracts-as-stored case. I do not demand a second v1 disposition for "non-empty but otherwise unusable"; that stays out until a separate named predicate exists.

### AC-12, restated for synthesis (observable outcome only)

> A stored identity that loads with an empty chain as stored is reported under disposition **`empty_book`** — textually distinct from "no snapshots stored" / miss, and from replay/compute error — and that row carries **no** successful numeric measurement figure for the book. **Verify by: test.**

Exact operator wording over the token remains **UX-owned** (my R2 ask already routes there). I do not invent the literal here.

### Explicit non-claims

- Split empty-bucket policy untouched (still D1 / owner).
- Empty-corpus artifact rule untouched (T0b — console-only; no measurement file).
- No code, endpoints, payload fields, or UI layout in this file.

**CONVERGED.** Zero DISSENT. Ready for `decisions.md` fold on T1.
)
