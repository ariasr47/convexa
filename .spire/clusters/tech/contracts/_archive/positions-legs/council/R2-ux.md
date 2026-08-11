```json
{
  "role": "ux",
  "agree": [
    "**All-or-nothing, and this is the hardest rule in §6: if ANY leg's mark is null, `net_mark` and P/L\nare `null`. Never a partial sum.**",
    "**Basis = the weakest link**, ordered `snapshot` > `modeled` > `theoretical` > `last_known`.",
    "**No error, no warning styling, no blocked confirm, no toast.**",
    "Custom is a description, not a diagnosis.",
    "**AC-19 [T]** If one leg cannot be quoted while others can, the position shows one honest position-level\n  degraded state rather than presenting a partially-real P/L as real.",
    "**AC-21 [T]** The static figures (net debit/credit, max loss, max gain, breakeven) do **not** dim or\n  degrade on an SSE drop — they are not live-derived.",
    "**`PositionView` is a per-cycle DERIVED, NEVER-PERSISTED projection**"
  ],
  "conflicts": [
    {
      "quote": "The BRIEF's \"a debit spread's real breakeven\n   is uncomputable\" is fixed here in the sense of **made computable**, not computed.",
      "source": "architect",
      "why": "This is head-on with PM §2, which lists max loss as product-required and says \"**Max loss is not cuttable.**\" plus AC-14/AC-15/AC-16/AC-17. The two positions cannot both be executed. My lane cannot absorb the difference: PM's AC-16 requires \"the at-expiration figures are replaced by a short stated reason — never blank, never `0`\", and a *replacement* reason is uninstantiable copy if the figures never exist — there is nothing to replace, and I would be writing a sentence explaining the absence of a feature rather than the limits of a number. It also decides whether §4's design direction has a fourth read on the row (\"what can I lose\") or three. I am not asking to settle it in my lane; I am refusing to write both copy sets and let GATE Q pick.",
      "proposal": "Owner picks one of: (a) payoff math IN — max loss only for named single-expiration defined-risk structures, with breakeven/max gain deferred, per PM's own cut order; I then own the withheld-reason copy and the `Unlimited` wording; or (b) payoff math OUT — PM drops AC-14/15/16/17 to Future and the BRIEF's decision-impact sentence is explicitly restated as \"made computable\", so nobody discovers at GATE Q that the stated reason for the feature did not ship. Not (c): ship a half-set where max loss appears for some structures and no reason appears for the rest.",
      "kind": "product"
    },
    {
      "quote": "Recognized set for v3: `equity`, `long_call`, `long_put`, `short_call`, `short_put`,\n`covered_call`, `vertical_debit`, `vertical_credit`, `calendar`, `diagonal`, `straddle`, `strangle`,\n`butterfly`, `condor`, `iron_condor`, **`custom`**.",
      "source": "architect",
      "why": "I own the closed `STRUCTURE_LABEL` lookup, and this enum cannot carry the labels PM's §1(b) requires — in both directions. Under-names: PM's named set asks for \"Call debit spread\", \"Put credit spread\", Protective put, Collar, Cash-secured put and Iron butterfly; `vertical_debit`/`vertical_credit` carry no call/put discriminator, so one enum member has to render two different trader-facing names, which is exactly the mis-labeling PM's risk 4 is about. Over-names: this set contains `butterfly` and `condor` (non-iron), which PM explicitly assigns to Custom (\"Call butterfly / put butterfly (non-iron)\", \"Non-iron condors\"). A closed lookup whose domain neither matches nor is a subset of the product's named set is not a lookup — it is a second, silent naming decision made in a pure module. This invalidates my U2 and PM's AC-8 simultaneously.",
      "proposal": "One enum, one owner: PM's §1(b) table is the domain, the architect's `structureKindOf` is the recognizer over it, and the enum gains whatever discriminator the labels need (either four vertical members or a `right` field on the view row) so no member maps to two names. Any shape PM assigns to Custom is *not* a recognizer member in v1 — adding it later is the free change the architect already argues for. I write one label per member and `Custom · N legs` for the rest; I will not write a label that hedges across two structures.",
      "kind": "technical"
    },
    {
      "quote": "And the **`pl_pct_basis` discriminator rides with the\nnumber** because percent-of-net-credit is a genuinely different quantity from percent-of-net-debit\nand presenting both as \"P/L %\" without a basis is exactly what `[model-read-carries-its-assumptions]`\nforbids.",
      "source": "architect",
      "why": "I accept the honesty argument and cannot render it as stated. \"Rides with the number\" in a fixed-width dense table cell means either a suffix (`+18% of net credit` blows the `nowrap` mono cell and is the documented 393px overflow mechanism) or a new column, and my R1 binds \"I am adding **no new column** in this feature.\" There is a second, sharper consequence the architect's `null` percent creates in my lane: `—` already carries two meanings on this surface (not-applicable, and pending-limit), and my U8 binds that two different truths never share one glyph. A third meaning — \"percent is undefined because net cost is ~0\" — lands on the same em dash and silently breaks the one distinction I flagged as most likely to regress quietly.",
      "proposal": "Disclosure without a column: the `pl_pct` cell renders the number bare, the **column header** carries the basis-aware tooltip, and the cell's own tip names the basis for that row (\"+18% — measured against the $115 net credit you received, not against capital at risk\"). For `pl_pct === null` the cell renders the literal word `undefined`, not `—`, with its own tip. If the architect judges a tooltip insufficient for `[model-read-carries-its-assumptions]` on a number this load-bearing, the honest alternative is not a suffix — it is that P/L% for credit structures is withheld in v1, which is a product call, not mine.",
      "kind": "technical"
    },
    {
      "quote": "With the promote aborted, the store runs **in-memory** from whatever did parse, and **every\n   durable write is REFUSED**, visibly (the mutator returns false; the caller surfaces it).",
      "source": "architect",
      "why": "\"The caller surfaces it\" hands my lane the most dangerous state in the feature with no design and no copy, and a boolean return is the exact shape that gets ignored at the call site. Nothing in my R1, PM's ACs, or this position names what the trader sees while writes are refused. Unspecified, it renders as: the trader opens a position, the dialog closes, the row appears (in-memory), and it is gone on reload — a silent data loss produced by the code path whose whole purpose is preventing silent data loss. PM's AC-31 covers the *read* side (\"an honest message stating that nothing was deleted\") but says nothing about the app continuing to accept writes it will not keep.",
      "proposal": "Name it as a first-class component state — `store-faulted` — with three properties, all mine to word: (1) a persistent, **non-dismissible** banner above the table, warning-class WITH an icon per canon, saying we could not read your saved positions, nothing was deleted, and new positions will not be saved until this is fixed; (2) the entry CTA **disabled** with that reason in its tooltip, not enabled-then-failing; (3) Close and every other mutator disabled the same way. That requires the store to expose a *faulted* flag to the view layer, not just a `false` return per call — an architecture change I am asking for, not making.",
      "kind": "technical"
    },
    {
      "quote": "`position_eval` therefore becomes an approximation for multi-leg.",
      "source": "architect",
      "why": "I do not contest the approximation; I contest that it can stay unstated in the read. The Ticker-page position-context alert addresses the trader about \"your position\" while being computed from one leg of four, and under canon rule 4 / `[model-read-carries-its-assumptions]` a model read that names the wrong subject is overclaiming — the same class as the tinted hit-rate. Worse is the other branch: \"none if the structure has no option leg\" means a shares-only position produces *no* alert at all, and a silent absence is indistinguishable from \"nothing changed\", which is the failure mode this app is built against. Neither state has copy in any of the three positions.",
      "proposal": "Two strings, both mine to write once the seam exists: any position-context alert on a multi-leg structure names the leg it evaluated (\"Based on the $400 call leg — Convexa evaluates one leg of a multi-leg position\"), and a position with no option leg renders an explicit stated non-evaluation rather than silence. The architect's side of it is that the primary-leg selection must be *readable* from `PositionView` (which leg won), not an anonymous internal choice.",
      "kind": "technical"
    },
    {
      "quote": "**Withheld risk figures get a visible short reason in place of the number**, and the space to say it.",
      "source": "pm",
      "why": "This is an assumption about my lane I cannot honor as written at 393px, and it is the second-order cost of §2 that the cut order does not price. My R1 caps the mobile card footer at exactly four items (`Qty` · net debit/credit · `Mark` · expiry) because that is what fits without horizontal overflow — a shipped, e2e-enforced constraint. Max loss + max gain + breakeven is three more figures; a *stated reason* in place of each is three more sentences. Both cannot sit on a collapsed 393px card, and putting them there is precisely how `scrollWidth 580 vs 393` happened before. The row is a scan surface, not a risk report.",
      "proposal": "Contingent on the payoff-math conflict resolving IN: the collapsed row/card carries at most **one** risk figure (max loss, the uncuttable one), and max gain + breakeven + all withheld-reason copy live in the leg disclosure, which is already the designed home for per-position detail and has vertical room for a sentence. If PM requires all three visible on the collapsed row at 393px, that is a different card — its own design pass, and it costs the density this surface exists for. Owner priority call, not a UX preference.",
      "kind": "product"
    },
    {
      "quote": "This is the\n   number the trader typed and the number their broker showed them.",
      "source": "pm",
      "why": "The architect's schema makes this false in a way that changes what the entry form asks for: `entry_price` is stored **per leg**, positive, and `netEntryCost` is a SUM — so the net is *derived*, not typed. Only one of two designs is possible and they are not equivalent. If the trader types per-leg prices, the net is computed and my shipped dialog copy `— user-entered, not a market quote` is a claim about the legs, not the net. If the trader types a net (which is what their broker actually quotes them, per this sentence), per-leg entry prices must be back-solved and written into the durable record — fabricated per-leg facts in the same audit spine where the architect refuses to backfill an invented `entry_time`. I will not write copy that presents a fabricated per-leg price as the trader's own number.",
      "proposal": "Per-leg entry prices are typed; the net is computed and **labeled as computed** in the dialog (`Net debit $840 · computed from your leg prices`), and the position row's net entry carries the same provenance in its tip. If PM insists the trader types the net because that is what the broker shows, the architect needs to answer whether an allocated per-leg price can be stored honestly (e.g. flagged as allocated) — a schema conversation, not a copy one.",
      "kind": "technical"
    },
    {
      "quote": "**I am binding: no call/put tint in positions.** This is a deliberate divergence from a literal reading of `DESIGN_SYSTEM.md`'s palette-role column and I want it argued in R2, not discovered at GATE Q",
      "source": "ux",
      "why": "Raising my own R1 as a conflict because it is a divergence from the design canon of record and neither sibling position touches it, so it would otherwise pass unratified. `DESIGN_SYSTEM.md` lines 42-43 state `success` is \"**RESERVED** — calls / +gamma / +P&L direction\" and `error` \"**RESERVED** — puts / −gamma / −P&L direction\", which literally permits a green `Call` and a red `Put` in my leg list. The `convexa-design` skill's rule 2 says green/red are reserved for *direction* of P/L or flow, and a call is not a direction. On this surface the literal reading produces a green `Call` label one cell from a red P/L on the same losing row — the proximity-chip regression, exactly. Two owner-owned documents disagree, and the skill's \"where they conflict, this skill wins\" clause is written about the generic skills, not about `DESIGN_SYSTEM.md`, so I cannot settle it myself.",
      "proposal": "Ratify the divergence as **scoped, not global**: green/red keep the calls/puts role in the GEX-chart domain where they encode flow direction, and are banned on any leg attribute (`Call`/`Put`, `Long`/`Short`, `debit`/`credit`) on the positions surface, where the only direction present is P/L. If ratified, `DESIGN_SYSTEM.md`'s palette-role column gains \"(GEX domain)\" so the next reader does not rediscover this, and the className-identity guard in my U15 enforces it. If rejected, U15 changes and I need to know now, because it is a `test`-class AC.",
      "kind": "product"
    }
  ],
  "asks": [
    "PM — AC-10 says \"Changing a leg so the shape changes (e.g. moving one expiration) changes the displayed name immediately, with no reload.\" Does that mean editing legs inside the entry dialog *before* confirm, or editing the legs of an already-open position? The second is an entire surface nobody scoped: an edit dialog, a confirm, a decision-log entry, and a rule for what happens to the position's entry price and history. The architect's §2 has no edit path and my expansion carries zero actions.",
    "PM — does an in-row disclosure satisfy \"The legs themselves, visible in the portfolio list without opening a detail surface\"? My design puts a summarizing structure line on the collapsed row (`$400/$420 Call vertical`) and the individual legs one click away in a sibling row, never on a separate page. If \"at a glance\" means every leg's strike and expiry must be readable *without* clicking, the collapsed row cannot hold a 4-leg condor at 393px, and AC-1's \"one row\" and your scannability argument are then in tension with each other.",
    "architect — does `PositionView`'s per-leg row expose `instrument_kind` and the leg's own `MarkBasis` explicitly? My U7/U8 turn on a component deciding \"render `—` because this leg is equity\" versus \"render `unavailable` because this lookup failed\", and inferring that from a null `strike` collapses the two meanings I bound as never-shared.",
    "architect — how many distinct not-a-number readings must the `pl_pct` cell support in v1? I currently know of `null` from near-zero net cost, `unavailable` from an unresolved leg, and `—` from a pending limit. If `pl_pct_basis: 'undefined'` is reachable for any other reason, each reason needs its own word, not a shared glyph.",
    "PM — can the one-time merge notice (AC-28) and the stale-saved-view notice (my §4) co-occur for the same trader, and if so which owns the single banner slot above the table? A trader with items in both stores *and* a view filtered on `long_call` is not exotic — it is the same long-time user, and two stacked banners at 393px push the first row below the fold on the one load where you most want them to see their positions."
  ]
}
```
