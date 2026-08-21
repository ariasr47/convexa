# R3 — ux ⇄ pm technical resolution: chain-snapshot-capture

One exchange. Two technical conflicts only (`200df8d4…`, `8c938b8b…`).
PM accepted both proposals in `R3-pm-ux.md`. I confirm. No product calls reopened
(thinning, retention dials, scope). No transports or fields invented.

---

## Conflict `200df8d4…` — AC-15 Verify by (raised by ux against pm)

**Quote contradicted:** "**`review` owns payload-composition intent (AC-3), absence of trader UI (AC-15), P3 not absorbed (AC-22), operator-without-trader-UI check (AC-23), and single-ticker-on-demand / sweep-only multi-ticker framing (AC-24).**"

**CONVERGED.** PM accepts. Absence of capture chrome across trader routes is negative space under `spire-tech-risk-based-verify` — a Settings toggle, nav link, or shared LiveBadge import can pass a copy review and still violate `[operator-vs-trader-path-separation]`.

**Resolution.** AC-15 **Verify by: test** (structural empty-diff / no capture affordance on trader routes). AC-23 (positive operator path without trader UI) may stay **review**. Criterion text of AC-15 otherwise unchanged.

---

## Conflict `8c938b8b…` — AC-9 miss wording (raised by ux against pm)

**Quote contradicted:** "Requesting snapshots for a ticker that has none reports **none for this ticker** (distinct from \"empty chain book\") and does **not** call Massive to create one."

**CONVERGED.** PM accepts. Meaning and no-Massive rule stand; the visible miss string binds to the closed term already in the UX empty state — not a second approved phrase.

**Resolution.** Keep AC-9's meaning; bind operator-visible text to `no stored snapshot for <SYMBOL>`. Store-vouched `pruned by retention` only when Architect exposes that distinction — otherwise one honest miss string. Drop "none for this ticker" as a competing approved empty. **Verify by: test** unchanged.

---

## Summary

| Conflict | Verdict | One-line resolution |
|---|---|---|
| `200df8d4…` AC-15 verify-by | **CONVERGED** | AC-15 → `Verify by: test` (structural empty-diff / no capture affordance on trader routes); AC-23 may stay review |
| `8c938b8b…` AC-9 miss wording | **CONVERGED** | Bind miss copy to `no stored snapshot for <SYMBOL>`; drop competing "none for this ticker" |

Both confirmed. Zero DISSENT. Nothing here needs a product card.
)
