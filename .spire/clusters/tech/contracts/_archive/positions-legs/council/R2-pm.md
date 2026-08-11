```json
{
  "role": "pm",
  "agree": [
    "A recognizer bug must be cosmetic by construction.",
    "5. Same-contract merge/averaging — the shipped \"stack\" choice is unchanged.",
    "4. The corrupt blob is **never overwritten, never repaired, never pruned, never deleted.**",
    "| `model/store` write paths (`putTrade`, `clearTrade`, the 2nd `appendDecision`) | **deleted** | one store, one log — Q2 resolved |",
    "**The ROW is the position. The LEG is a detail, one disclosure away.**",
    "No per-leg Close, no per-leg Cancel.",
    "When **any** leg's mark is unresolved, the position's P/L, P/L% and mark all render `unavailable`"
  ],
  "conflicts": [
    {
      "quote": "2. **Payoff math**: breakeven, max profit, max loss, margin, buying power, assignment/exercise, early\n   assignment on short legs.",
      "source": "architect",
      "why": "This deletes the feature's stated reason for existing. The BRIEF's Decision impact is explicit: a debit spread's real breakeven and max loss are currently uncomputable, so the app cannot tell the trader what they actually risk. Made-computable is not an observable outcome — a trader cannot see a data model. My AC-14/15/16 and UX's own §6 slot both assume at least max loss lands; with this non-goal standing, the ONLY new user-visible outcome of an L-effort release is a row that says `Iron condor` instead of two rows. I am not narrowing scope silently to fit the non-goal, and I am not asking the architect to absorb payoff math without an effort re-estimate — this is exactly the priority call the owner is entitled to make.",
      "proposal": "Owner picks one of three, explicitly: (a) max loss ONLY for named single-expiration defined-risk structures in v1 — verticals, iron condors, iron butterflies — with `Unlimited` where the worst case is unbounded and a stated reason everywhere else; max gain and breakeven deferred. This is my cut order from R1 §2 and the smallest thing that satisfies the BRIEF. (b) All three figures, and the effort goes from L to L+ with payoff math contracted separately. (c) None of it in this feature, in which case the BRIEF's Decision impact sentence must be rewritten before GATE C closes and I will drop AC-14/15/16 and tell UX to cut its §6 Max loss slot — but the owner should know they are shipping the representation and not the answer.",
      "kind": "product"
    },
    {
      "quote": "Recognized set for v3: `equity`, `long_call`, `long_put`, `short_call`, `short_put`,\n`covered_call`, `vertical_debit`, `vertical_credit`, `calendar`, `diagonal`, `straddle`, `strangle`,\n`butterfly`, `condor`, `iron_condor`, **`custom`**.",
      "source": "architect",
      "why": "Which shapes get a name is a product call and this set contradicts mine in both directions. It NAMES `butterfly` and `condor` (non-iron), which my R1 §1(b) deliberately routes to Custom — a mislabelled 1x2 or a non-iron condor is the dangerous direction, because the trader sizes off the name. And it DROPS names I asked for that a Webull account is full of: protective put, collar, iron butterfly, cash-secured put. By the architect's own §4 the label is display-only and adding a recognizer later is a pure function change with zero migration, so nothing technical rides on this — which is precisely why the set should be mine and not a side effect of enum design.",
      "proposal": "Adopt the R1 §1(b) named list as the v1 recognizer set: add `protective_put`, `collar`, `iron_butterfly`, and either `cash_secured_put` or an explicit decision that a short put is labelled `Short put` only (see my ask below); drop `butterfly` and `condor` from v1 recognition so those shapes render `Custom · N legs` until we see them arrive. Everything else in the architect's set stands unchanged. If a recognizer is cheaper to write than to omit, keep the code and gate the LABEL — but the trader must not see a name we are not confident in.",
      "kind": "technical"
    },
    {
      "quote": "3. With the promote aborted, the store runs **in-memory** from whatever did parse, and **every\n   durable write is REFUSED**, visibly (the mutator returns false; the caller surfaces it).",
      "source": "architect",
      "why": "I accept never-overwrite — it is the right rule and my AC-31 depends on it. What cannot stand is shipping this as an internal boolean. As written, a trader with one unreadable legacy blob enters a mode where the app looks normal, accepts an entry, and then that position is gone on reload. That is a whole product state — Convexa has become read-only — and it exists in neither my ACs nor UX's twenty component states. `the caller surfaces it` is the entire user-facing design of a mode in which nothing the trader does persists, and it silently converts a data-protection decision into a decision to stop the trader trading.",
      "proposal": "Make the faulted mode a first-class, specified product state before it is built: a persistent (not dismissible) banner stating that saved data could not be read, that NOTHING was deleted, that new positions will not be saved until it is resolved, and offering export; entry affordances visibly disabled rather than accepting input and failing after the fact. Owner call inside that: whether refusing ALL durable writes is the behaviour we want, or whether new positions may be accepted into a fresh store while the unreadable blob is left untouched. I lean to the architect's stricter rule, but a trader locked out of recording a live trade is a consequence the owner should choose, not inherit.",
      "kind": "product"
    },
    {
      "quote": "`position_eval` therefore becomes an approximation for multi-leg.",
      "source": "architect",
      "why": "Stated where? The statement lives in a pure FE function, not in the trader's view. A trader holding a four-leg condor would get a position-context assessment computed from one long leg, rendered in exactly the same surface and voice as an assessment of a single long call. That is the app becoming confidently wrong about the structures this feature exists to introduce, and it is `model-read-carries-its-assumptions` broken at the read that matters most. I am not asking for a backend change — the empty `apps/api` diff holds either way. I am refusing to let an approximation ship undisclosed because disclosure was assumed to be somebody else's line item.",
      "proposal": "Owner picks: (a) the alert/assessment still fires for multi-leg but carries a visible qualifier naming the leg it evaluated (e.g. assessed on the $400 call leg only), or (b) the position-context assessment is suppressed for any position with more than one leg and says so, rather than answering about a leg while appearing to answer about the position. Either way it needs an AC and UX copy. What must not happen is (c): the same UI, the same confidence, one leg of four.",
      "kind": "product"
    },
    {
      "quote": "**Group axis becomes `None · Ticker · Structure · Expiry`** (Expiry returns to the toolbar; it was\ndropped at REVISION 2 and multi-expiry positions make it meaningful again).",
      "source": "ux",
      "why": "REVISION 2 removed that control deliberately. Re-adding a previously-removed toolbar axis is new scope and a reversal of a shipped owner decision, and it is arriving inside a feature whose risk surface is a durable migration. My R1 scope says grouping/filtering/sorting/saved views continue to work over the new shape — continue, not grow. UX's own reasoning (calendars need a group axis) is sound, which is exactly why it should be an owner decision rather than a UX judgement call folded into a refactor.",
      "proposal": "Route to the owner as a yes/no: restore Group-by-Expiry now because multi-expiry structures make it meaningful, or hold it as a Future item and let calendars group under Structure in v1 (in which case UX cuts U17 as its position already offers). If it is held, nothing else in the UX position changes. I have no objection to the axis on its merits — only to it landing unremarked.",
      "kind": "product"
    }
  ],
  "asks": [
    "UX: what is the multi-leg ENTRY surface? Your §6 specifies dialog COPY and your assumption 12 says entry is in scope, but none of U1–U20 covers CONSTRUCTING a position with more than one leg — adding a leg, removing a leg, choosing Buy/Sell per leg, or the single-leg path keeping its current click count (my AC-7). If no entry surface is specified, no multi-leg position can exist outside a fixture and AC-1 through AC-6 are unobservable at GATE Q. I need at least: how legs are added/removed, what the dialog shows before a shape is recognisable, and confirmation that the single-leg flow gains zero steps.",
    "Architect: can the same record id appear in BOTH `positions.v2` and `ghost-trade.v1`? My AC-23 promises count-after = count-A + count-B exactly; your union keep-first makes that false whenever an id collides. If collisions are possible I will restate AC-23 as count of DISTINCT records with the dedupe rule visible to the trader — but I need the fact, because a count that comes out one short of the arithmetic is indistinguishable from data loss to the person it happens to.",
    "Architect: does the outcome ledger count a multi-leg position as exactly ONE record, or one per leg? UX assumption 17 asserts one; your position does not say. AC-27 (hit rate, N and mean return read identically before and after) is the single most sensitive detector of a wrong merge, and a per-leg harvest would quadruple N and invalidate every interval the track record prints.",
    "UX: if the owner lands max loss (conflict 1, option (a)), where does it go given `I am adding **no new column** in this feature` and the four-item cap on the 393px card footer? I am not asking you to redesign now — I am asking whether the figure fits without a new column, or whether the answer is a new column and that cost belongs in the owner's decision.",
    "UX + architect: U16's degraded saved-view path assumes a filter value with no forward mapping, but the architect's assumption 7 says every existing `Strategy` value maps to a `StructureKind`. If that holds, U16 describes a state that cannot occur in v1 — is the notice, its copy and its seeded fixture (your risk 6) worth building now, or does the forward-mapping guarantee make it dead scope?"
  ]
}
```
