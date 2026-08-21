# R3 — architect: empty/unusable stored book (T1)

One technical exchange. Conflicts: `0cb8f978…` (pm) · `c273ecd1…` (ux).

**Quoted R1 claim under attack:** "**replayed** — load + deserialize + compute succeeded." and "**Absent ≠ empty ≠ error:** capture-disabled ≠ empty_corpus ≠ per-row missing ≠ compute_failed."

**Peers' ask:** a fifth closed row disposition for snapshot-present / stored-chain-empty; name it; say whether the gate fires before compute (no score figure); keep it out of the miss literal `no stored snapshot for <SYMBOL>`.

**Not reopened here:** empty-corpus artifact rule (settled T0b — no measurement file) · split empty-bucket refuse-vs-allow (D1 owner pending).

---

## Verdict: **CONVERGED**

I **retract** the R1 four-member row vocabulary. It could not honor `[absent-is-not-none]` or PM AC-12 / UX-8: an empty stored chain still yields `Ok` from Path-B (`process_gex_profile` returns `GexResult::empty()` when `contracts.is_empty()`), so post-compute classification would land zeros as **`replayed`**. That is the failure both peers named.

### Closed row token

| Token | Meaning |
| --- | --- |
| **`empty_book`** | Load + deserialize + `to_vendor_bundle` succeeded; the rebuilt `VendorBundle`'s option chain has **zero contracts as stored**. |

**Name choice:** `empty_book` over `empty_unusable`. Mechanism axis = familiarity with the BRIEF / invariant wording ("no snapshot ≠ **empty book** ≠ replay error"). Product prose "empty / unusable book" maps to this **one** closed token when the stored contracts vector is empty after honest rebuild. A non-empty contracts vector that later fails inside compute stays **`compute_failed`** — not this token. Do not invent a second "unusable-but-non-empty" disposition in v1 without a separate, named predicate.

### When the gate fires

**Before compute.** Mechanism:

1. `store.load` → bytes present (else **`missing`**).
2. `deserialize_capture` / wire rebuild succeeds (else **`unreadable`**).
3. **Empty-book gate:** if `vendor.market.contracts` is empty → set disposition **`empty_book`**, **skip** `compute_analytics_from_vendor`, emit the row with identity only (symbol / as_of / source) and **no score / tier / GEX measurement figure**.
4. Otherwise call compute; `Ok` → **`replayed`**; `Err` → **`compute_failed`**.

Decisive axis vs "call compute then inspect outputs": **correctness** — post-compute inspection cannot distinguish "we measured and the book was empty" from "Path-B returned an empty `GexResult`," and the latter is exactly zeros-as-measurement.

### Distinctness rules (closed set after this exchange)

| Disposition | Snapshot bytes | Wire rebuild | Contracts as stored | Compute called |
| --- | --- | --- | --- | --- |
| `missing` | absent / `None` | — | — | no |
| `unreadable` | present | fail | — | no |
| **`empty_book`** | present | ok | **empty** | **no** |
| `compute_failed` | present | ok | non-empty | yes → `Err` |
| `replayed` | present | ok | non-empty | yes → `Ok` |

Corpus-level **`empty_corpus`** (zero metas after list/filter; console-only; no measurement artifact — T0b) stays separate: it is not a per-row disposition and is not this gate.

### Must not collapse into miss copy

- **`empty_book` is never printed or counted as** the miss family whose capture-era literal is `no stored snapshot for <SYMBOL>` (that string remains UX-owned wording for **`missing`** only).
- Collapsing would lie: a snapshot **was** stored and loaded; the chain inside it is empty.
- Exact operator literal for `empty_book` is **UX-owned** (PM ask already routes wording there). Architect owns the type + gate timing + the forbid on miss-literal reuse — not the words.

### Isolation / run behavior

- Per-row: sibling metas continue; one `empty_book` does not abort the run (`[best-effort-isolated-or-null]` at row scope).
- Zero Massive: gate path never constructs a live port or vendor client.
- Artifact/console: when a measurement artifact is written for a non-empty corpus, `empty_book` rows appear with identity + disposition and **without** a numeric measurement figure for that book (AC-12).

### Binding for R4 / decisions.md fold

1. Closed row vocabulary is five members: `replayed` · `missing` · `unreadable` · `compute_failed` · **`empty_book`**.
2. Gate = empty `vendor.market.contracts` **after** successful load/rebuild, **before** `compute_analytics_from_vendor`.
3. `empty_book` ≠ miss literal; ≠ `empty_corpus`; ≠ `unreadable`; ≠ `compute_failed`.
4. UX binds the console/artifact words over the Architect-named token; Architect does not invent those strings here.

**Status for conductor:** T1 technical conflicts **resolved** — fold into `decisions.md`; no owner call required on this item.
)
