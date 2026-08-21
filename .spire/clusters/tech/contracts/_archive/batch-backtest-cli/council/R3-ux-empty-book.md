# R3 — ux: empty/unusable stored book (T1)

One technical exchange. Conflicts: `c273ecd1…` (ux) · `0cb8f978…` (pm).

**Quoted R1 claim under attack (architect):** "**Absent ≠ empty ≠ error:** capture-disabled ≠ empty_corpus ≠ per-row missing ≠ compute_failed."

**My R2 proposal:** Add closed row disposition **`empty_book`** (or **`empty_unusable`**): load + deserialize succeeded, stored chain has no usable contracts — printed with a literal distinct from `no stored snapshot for <SYMBOL>`, from unreadable, and from replay/compute error.

**PM ask I own:** exact operator literal once Architect names the disposition (parallel to miss / unreadable).

**Not reopened here:** empty-corpus no-artifact rule (T0b) · split empty-bucket refuse-vs-allow (D1) · endpoints / CLI flags / wire field spellings (none invented).

---

## Verdict: **CONVERGED**

Architect named the type **`empty_book`** (`R3-architect-empty-book.md`) and placed the gate **before** compute (empty `vendor.market.contracts` after successful load/rebuild → skip Path-B; no score/tier/GEX figure). That is a type I can caption without renaming what the value is.

I accept the five-member closed row set and the before-compute gate as the meaning my words must track. Naming a second "unusable-but-non-empty" disposition is out for v1 — Architect closed that; I will not invent copy for a predicate that does not exist.

### Operator literal (binding)

| Disposition (Architect) | Exact console / artifact literal | Optional suffix |
| --- | --- | --- |
| **`empty_book`** | **`empty stored book for <SYMBOL>`** | ` at <as_of>` when a dated identity was requested |

**Closed three-way absence family (operator-visible):**

| Literal (exact) | Means | Must not be used for |
| --- | --- | --- |
| `no stored snapshot for <SYMBOL>` | **`missing`** — nothing stored for that identity | empty stored book; store fault; compute error |
| `stored snapshot unreadable: <reason>` | **`unreadable`** — bytes present, wire/rebuild failed | miss; empty book; compute error |
| **`empty stored book for <SYMBOL>`** | **`empty_book`** — snapshot present and loaded; contracts empty **as stored**; compute **not** called | miss; unreadable; replayed zeros; `compute_failed` |

### Copy integrity rules for this disposition

1. **Never** print the miss string for an `empty_book` row — that would lie (a snapshot *was* stored and loaded).
2. **Never** render a score / tier / GEX / opportunity figure on an `empty_book` row (including bare `0` as a measurement). Identity + disposition only.
3. **Never** use banned empties: `no options`, `empty chain`, `n/a`, blank, trader `—`, `unavailable this cycle`.
4. Corpus-level **`empty_corpus`** (zero metas; console-only; no measurement artifact) stays a different state with different wording — this literal is **per-row** only.
5. Unreadable keeps the capture family string; I do not invent a second fault vocabulary here.

### UX-8 restated against the Architect token

| ID | Criterion | State | Verify by |
| --- | --- | --- | --- |
| UX-8 | Empty **stored book** (disposition `empty_book`) prints exactly **`empty stored book for <SYMBOL>`** (optional ` at <as_of>`) — never the miss string, never a numeric measurement for that book | empty book | **test** |

### Explicit non-claims

- No endpoints, CLI flags, payload field names, or transport shapes.
- No second disposition name (`empty_unusable` withdrawn as a competing type — product prose "empty / unusable book" maps to Architect's one token `empty_book` when contracts are empty as stored).
- Gate timing and skip-compute mechanism belong to Architect; I only require that the printed words stay true to "snapshot present; book empty as stored; no measurement figure."

**CONVERGED.** Zero DISSENT. Ready for `decisions.md` fold on T1.
)
