# R3 — ux ⇄ architect: conflict `5e9322d5…`

One exchange. Conflict: who names research-read transport / bytes.

**Quoted claim contradicted (architect R1):** "**UX / Interface (later)** will name any research read transport and bytes shape; this position intentionally omits endpoint signatures and JSON field names."

**My proposal (R2):** Architect (or Interface at synthesis) names load/list transport and bytes; UX only binds human-visible framing and the state matrix over Architect-named facts (symbol, as_of/captured-at UTC, store hit / miss / error).

---

## Verdict: **CONVERGED**

Architect accepted (`R3-architect-ux.md`). I accept their ownership table as written. Naming transports or wire fields from this lane remains my defining failure mode; I will not invent endpoints, CLI flags, or JSON spellings here.

### Binding lane split (settled)

| Concern | Owner |
| --- | --- |
| Research load/list **domain facts**: symbol identity, as_of (for operator `captured at` UTC), store outcome classes **hit / miss / error**, and the hard rule that load/list never call Massive | **Architect** |
| Research load/list **transport and bytes/wire shape** (CLI flags, endpoint signatures, payload field spellings) | **Interface at R4 synthesis** (fed by Architect-named content — not blank invention, not UX) |
| Human-visible **framing, closed vocabulary, and state matrix** over those Architect-named facts | **UX** |

### What UX binds (framing / states only — no wire invention)

Over Architect-named facts only:

1. **Default (hit):** framing `RESEARCH READ — STORED CHAIN SNAPSHOT`; identity with `captured at` UTC; provenance `loaded from store · no vendor call`; hard ban on `live` / `LIVE` / live badge.
2. **Empty (miss):** closed `no stored snapshot for <SYMBOL>` — never market-empty language. `pruned by retention` only if Architect exposes a store-vouched prune-vs-never-captured distinction (still open ask; UX-8 will not invent it).
3. **Error (store):** `stored snapshot unreadable: …` — never framed as a license to hit Massive.
4. **Loading:** names a **store read**, never "fetching/refreshing from Massive".
5. **Skip reason (if thinning ships):** operator-visible class only after Architect names the fact; UX frames it, does not invent the signal or the transport that carries it.

### Explicit non-claims

- This file invents **no** endpoint paths, CLI flags, payload field names, or bytes schemas.
- UX-3 / UX-5 / UX-6 remain implementable once Architect-named facts exist on the research-read surface; Interface spells the wire at R4.
- Product conflicts on thinning / retention dials are untouched by this exchange.

**CONVERGED.** Zero DISSENT. Ready for `decisions.md` fold.
