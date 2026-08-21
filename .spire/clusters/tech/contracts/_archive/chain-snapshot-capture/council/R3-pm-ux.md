# R3 — pm ⇄ ux technical resolution: chain-snapshot-capture

One exchange. Two technical conflicts only (`200df8d4…`, `8c938b8b…`).
**I accept both UX proposals.** No product calls reopened (thinning, retention dials, scope).

---

## Conflict `200df8d4…` — AC-15 Verify by (raised by ux against pm)

**Quote contradicted:** "`review` owns … absence of trader UI (AC-15)…"

**CONVERGED.** UX is right on risk class. Absence of capture chrome on trader routes is
**negative space**: a Settings toggle, nav link, or shared badge import can land green under a
copy/layout review and still violate `[operator-vs-trader-path-separation]`. Marking that
invariant `review` because "there is no trader chrome" assumes the claim under test.

**Resolution.** AC-15 **Verify by: test** — structural no-capture-affordance on trader routes
(empty-diff / no browse-replay-download affordance). AC-23 (positive operator path exists without
trader UI) stays **review** if desired. Criterion text of AC-15 otherwise unchanged.

---

## Conflict `8c938b8b…` — AC-9 miss wording (raised by ux against pm)

**Quote contradicted:** "…reports **none for this ticker** (distinct from \"empty chain book\")…"

**CONVERGED.** Behavioral outcome stands (store miss ≠ empty chain book; no Massive fill-in).
Locking a second approved empty string fights the closed term set UX already ships. Two "correct"
miss phrases is how later surfaces pick the friendlier one and drift into market-empty language.

**Resolution.** Keep AC-9's meaning and no-Massive rule; bind operator-visible text to closed
`no stored snapshot for <SYMBOL>`. Store-vouched `pruned by retention` only if Architect exposes
that distinction — otherwise a single honest miss string. No new product scope.

**AC-9, restated for synthesis:**

> Requesting snapshots for a ticker that has none reports **`no stored snapshot for <SYMBOL>`**
> (distinct from "empty chain book" / market-empty language) and does **not** call Massive to
> create one. **Verify by: test.**

---

## Summary

| Conflict | Verdict | One-line resolution |
|---|---|---|
| `200df8d4…` AC-15 verify-by | **CONVERGED** | AC-15 → `Verify by: test` (structural no-capture-affordance on trader routes); AC-23 may stay review |
| `8c938b8b…` AC-9 miss wording | **CONVERGED** | Bind miss copy to closed `no stored snapshot for <SYMBOL>`; drop "none for this ticker" |

Both accepted. Zero DISSENT. Nothing here needs a product card.
)
