```json
{
  "role": "ux",
  "agree": [
    "Half-day at 10:00 ET must remain `Rth` / `\"regular\"` / due / eligible.",
    "Overloading the weekend **arm** would print “ineligible weekend” for a Thursday.",
    "This is **not** `NO_UI_CHANGE`: lying session standing is in the observed-by.",
    "Closed-session copy may name **holiday**; **feed-lag** copy must **not** use holiday as its explanation once the date is a known full-day holiday.",
    "I assume they will **not** encode holiday solely as `weekend: true` on the coverage matrix, even though that boolean already drives the empty-expected HTTP framing.",
    "Under AC-1’s preconditions, coverage’s operator-visible reason is **holiday**, not weekend."
  ],
  "conflicts": [
    {
      "quote": "UX will **not** ship a second frontend holiday table or a calendar editor.",
      "source": "architect",
      "why": "A calendar editor is still out. The `/scanner` badge is not the ticker chip: it is `marketSessionPhase(nowMs)`, a client America/New_York weekend gate (Sat/Sun → `closed`, weekday 10:00 → `rth`). Ticker honesty can bind existing `market_session === 'closed'` once `market_session_at` consumes the domain predicate; the badge cannot. Forbidding a client-side table (and `GET /api/holidays`, which I will not invent) leaves Thanksgiving 10:00 ET as `rth` on the desk while the slow lane idles — the same class of lie as holiday-as-feed-lag. BRIEF already says vehicles that have a weekend gate consume the predicate.",
      "proposal": "Keep the editor and any holiday HTTP resource out. Compile the same closed-set membership into the existing pure `marketSessionPhase` from one generated source (not a hand-pasted FE list). If that remains a forbidden second table, PM must exclude the scanner badge from this slice and I will retract badge-Closed; worker idle and ticker `closed` would remain.",
      "kind": "technical"
    },
    {
      "quote": "Holiday D uses the **same empty-expected presentation Sat/Sun already use**.",
      "source": "ux",
      "why": "Retraction. Same LAYOUT still stands (empty rows, no sixth coverage cell, no `[PASS]`, no Thanksgiving name). Same STRINGS cannot stand next to PM AC-4: coverage’s operator-visible reason must be holiday, not weekend. Identical chrome hides Architect’s distinct discriminator and makes a Thursday `not_due` read as Saturday standing on the S1 surface except by `et_date`. Weekend coverage copy must stay byte-identical and must not gain the word weekend; holiday coverage needs a vouched class token.",
      "proposal": "Keep empty-expected layout. Architect emits a sibling `framing` value on the existing field (class holiday, not a holiday name, not `weekend: true`, not a new key). The card prints that string. Empty-expected chrome keys off empty rows plus no-expected-class framing, not `verdict === 'not_due'` alone. Distinct keep/tape literals `ineligible holiday` stay.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: if `CoverageMatrix.weekend` stays Sat/Sun only, will holiday D still arrive on coverage HTTP as `verdict: not_due`, empty `rows`/`holes`, and a sibling no-expected `framing` on the existing field (today `envelope` sets `NO EXPECTED IDENTITIES` only when `matrix.weekend`)?",
    "PM: is the `/scanner` session badge (`marketSessionPhase`) inside live session standing, or is worker idle plus ticker `closed` enough (badge may remain `RTH` on a holiday weekday)?",
    "Architect: `liveStatus` returns the live branch whenever `live.live` is true, before reading `market_session === 'closed'`. On holiday 10:00 ET, is `live` false whenever `market_session` is `closed`?"
  ]
}
```
