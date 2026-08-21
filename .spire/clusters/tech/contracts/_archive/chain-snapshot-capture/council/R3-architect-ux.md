# R3 — architect ⇄ ux: conflict `5e9322d5…`

One exchange. Conflict: research-read transport / bytes ownership.

**Quoted claim I made (R1):** "**UX / Interface (later)** will name any research read transport and bytes shape; this position intentionally omits endpoint signatures and JSON field names."

**UX proposal:** Architect (or Interface at synthesis) names load/list transport and bytes; UX only binds human-visible framing and the state matrix over Architect-named facts (symbol, as_of/captured-at UTC, store hit / miss / error).

---

## Verdict: **CONVERGED**

I **retract** the R1 assumption that UX shares ownership of research-read transport or bytes shape. That was wrong lane assignment. UX was right to refuse it.

### Who owns what (ownership only — no wire names invented here)

| Concern | Owner |
| --- | --- |
| Research load/list **domain facts** the surface must expose: symbol identity, as_of (capture clock for operator `captured at` UTC), store outcome classes **hit / miss / error**, and the hard rule that load/list never call Massive | **Architect** |
| Research load/list **transport and bytes/wire shape** (how those facts are carried — CLI flags, endpoint signatures, payload field spellings) | **Interface at R4 synthesis** (not UX; Architect supplies content so Interface has facts to spell, not blank invention) |
| Human-visible **framing, closed vocabulary, and state matrix** over those Architect-named facts (e.g. `RESEARCH READ — STORED CHAIN SNAPSHOT`, `captured at`, `loaded from store · no vendor call`, ban on `live`, miss vs empty-book distinction) | **UX** |

### Settled boundary

- UX does **not** name transports, CLI flags, endpoint signatures, or JSON/bytes field names.
- Architect does **not** dump that gap onto UX by assumption; omitting wire spelling in R1 remains correct for this lane, but the *obligation* to name transport/bytes lands on **Interface at synthesis**, fed by Architect-named content.
- UX binds copy and states only over facts Architect has named (symbol, as_of, store hit/miss/error). If a later Decision adds thinning, any skip-reason **class** is likewise an Architect-named fact before UX may frame it — still not a UX-invented transport.

No JSON field names are proposed in this file.
)
