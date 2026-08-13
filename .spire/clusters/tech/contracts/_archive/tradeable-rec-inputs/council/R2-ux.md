```json
{
  "role": "ux",
  "agree": [
    "**Anchor on `gex_spot`, not the live price.**",
    "Every datum here is **STATIC** (chain-snapshot derived).",
    "**UX does not design an options-chain browser.**",
    "A full chain browser, a strike screener, or per-contract sorting/filtering UI.",
    "The reading carries a wide-quotes marker and displays the threshold used.",
    "The entry surface states, visible before the first save, that these figures are included in the context sent to the AI provider with each rec request.",
    "**R8 — The no-trade path is a first-class path.**"
  ],
  "conflicts": [
    {
      "quote": "| C. Server reads the broker book | Typed, server-side, real | **Additive when present, never the sole source** |",
      "source": "architect",
      "why": "PM puts real broker positions OUT of v1 ('v1 counts the simulated book only, and says so'), and every word I wrote sits on that ruling. If broker-sourced exposure rides alongside the simulated digest, three shipped or proposed strings become false at once: the export drawer's live promise that no broker/order data ever leaves, my Settings disclosure line 'Open positions included: your simulated positions in this browser.', and PM's AC-21 simulated label. It also replaces the three-state matrix I designed (none open / not sent / store faulted) with a per-source matrix nobody has specified, and the architect's own text says a Webull option position arrives `partial` — a knowingly incomplete number is the worst thing to place beside a dollar risk figure. Two lanes disagree on scope, so there is no single honest wording I can write.",
      "proposal": "v1 sends the simulated book only, per PM's OUT list, and the architect's option C is future-dated behind PM's stated trigger (one week of owner-verified daily use, as its own feature). If the owner wants C in v1 anyway, then it is a different copy set, not an additive one: every exposure figure carries a source token rendered by closed lookup, the broker path gets its own `partial` literal, the egress note enumerates broker positions explicitly, and the positions state matrix is respecified — decided before wording, not after.",
      "kind": "product"
    },
    {
      "quote": "**Up to 3 tenors, not 1.**",
      "source": "architect",
      "why": "PM scoped one reading (the nearest in-window expiration) and my §3 designed one headline, one basis line, five states. Three tenors is not the same card with more rows: each tenor carries its own null cause, so the surface needs partial states (tenor 1 quoted, tenor 2 no-quote, tenor 3 no strike resolvable) that no lane has specified, and three ± figures with no ranking makes the reader decide which one is the answer. It also collides with my placement ruling — the ticker board is at eleven widgets and I refused a twelfth for one scalar; a three-row per-expiry readout is a table, and a table needs a placement decision I did not make.",
      "proposal": "Carry up to 3 tenors on the wire for the model — the architect's reason (a rec that names an expiry needs that expiry's move) is right and costs the trader nothing. Render exactly one by default: the nearest in-window tenor, matching PM's AC-22, with the additional tenors reachable in the export drawer and named in the tooltip. If the UI must display more than one, that is a new component with a per-tenor state matrix and its own placement call, and it should be scoped as such rather than inherited from a payload shape.",
      "kind": "technical"
    },
    {
      "quote": "A per-trade risk cap larger than the account size is refused with a message; it is not silently accepted.",
      "source": "pm",
      "why": "Three lanes describe three different cap records and this AC only parses against one of them. PM assumes a single dollar cap comparable to account size; my U-3 stores one value with an explicit unit ($ or %); the architect stores a fraction of equity plus an optional absolute dollar ceiling with the effective cap derived as the min of the two. Against a fraction the rule is unstatable — a fraction can never be larger than the account size — so as written it silently forces the dollar-only model. The architect's model additionally puts a number on screen that the trader never typed, which is precisely what my §4b refuses unless it arrives on the wire already derived and labelled.",
      "proposal": "Settle the record shape before the copy is written. My preference for v1: one cap stored as {value, unit}, with local refusals 'enter a number greater than zero' and 'enter a percentage between 0 and 100', and AC-12 restated as 'a cap entered in dollars that exceeds the account size is refused'. If the min-of-two model wins, the form needs a third control plus a labelled derived readout ('Effective cap $X — the lower of your two limits') computed server-side and rendered verbatim, and AC-12 must be rewritten against that derived dollar cap.",
      "kind": "technical"
    },
    {
      "quote": "Given a signed-in owner who never entered a risk block, a rec still produces; its risk figures carry no account-derived dollar amount, and the surface names the absence as *not entered* rather than showing a dash.",
      "source": "pm",
      "why": "PM's literal for this state is *not entered*; my §4a and §2 codified `not set` for the identical state; PM's AC-37 then introduces a third adjacent phrase, *size not suggested*. One state with two names ships as two literals, which is the em-dash problem this feature exists to fix, one layer up — and this literal is a canonical-vocabulary addition (`positions-legs` codified four members), so it gets recorded once, not twice. The AC table is where the wording becomes binding, so the divergence has to close before synthesis rather than during implementation.",
      "proposal": "One word per state across every surface. I propose `not set`, because it is the only member of the closed vocabulary the trader can act on and the panel's action reads 'Set your risk inputs' — 'entered' names an event that did not happen, 'set' names the state the UI is reporting. If PM prefers *not entered*, I will take it without argument, but then AC-16, my U-14/U-16, the export drawer's not-sent line and AC-37's note must all carry that single wording, and the DESIGN_SYSTEM amendment records that one member.",
      "kind": "technical"
    },
    {
      "quote": "No prompt rewrite beyond inserting the named blocks.",
      "source": "architect",
      "why": "PM's AC-2 and AC-3 and my U-20 all require matching the contract the rec named against the candidate set, and distinguishing 'not in the candidate set' from 'no quote'. That match is only possible if the rec response carries strike + expiration + right in a machine-comparable field. If neither the prompt nor the response schema changes and the contract survives only inside the analyst prose, the frontend has to pull a strike out of a sentence with a regex — inference dressed as provenance, which will eventually draw a real quote beside the wrong contract. §4d's cited-contract line is the feature's strongest fabrication guard and it is unimplementable on prose.",
      "proposal": "Confirm whether the shipped rec schema already returns a structured contract identity; if it does, record that in the contract and nothing else changes. If it does not, adding those three fields to the response schema belongs in this feature — it is a schema field, not the grounding/citation enforcement deferred to `ai-rec-grounding`. If neither is available, then AC-2, AC-3 and U-20 are withdrawn together and the rec shows no per-contract quote at all, rather than shipping a best-effort string match behind a provenance claim.",
      "kind": "technical"
    },
    {
      "quote": "Convexa never blocks, warns on, or refuses an entry that exceeds the cap.",
      "source": "ux",
      "why": "Self-revision: I withdraw the 'warns on' clause. PM's S5/R5/AC-31 (annotate, never block, action stays enabled) is a genuine honesty gain that does not touch `[no-real-order-path]`, and my absolute phrasing would have deleted the one check standing between the owner and an authoritative-looking number nobody audited — PM's central call, and it is correct. 'Never blocks' and 'never refuses' still stand, and §7's no-sizing-calculator ruling is unchanged.",
      "proposal": "Replace that bullet with: Convexa never blocks or refuses an entry that exceeds the cap; it states the comparison once, in `warning.*` + icon per the design system's warning rule (never brand amber, never the green/red direction slots), and the same annotation persists at the confirm step per AC-31. The comparison must reach the UI as a closed verdict token together with the effective cap it used — the client still performs no arithmetic on the owner's entered values, so §4b stands intact.",
      "kind": "technical"
    },
    {
      "quote": "**Basis line (VISIBLE, never tooltip-only):** `From the {EXPIRATION} ATM straddle · {N} DTE · mid quotes`",
      "source": "ux",
      "why": "Self-revision: incomplete, and by my own standard. The headline prints ± Y.Z%, and the architect anchors that percentage on `gex_spot` rather than the live price the trader is watching at the top of the same page. A percentage of a number the reader cannot see is a claim the visible data does not support, and it will disagree with any percentage the trader computes off the live tape — the architect's own R5. PM's AC-23 requires the anchor spot on the reading and my line omits it.",
      "proposal": "Basis line becomes: `From the {EXPIRATION} ATM straddle · {N} DTE · mid quotes · % of the {ANCHOR_LABEL} spot ${ANCHOR}`, with the anchor value and which spot it is both rendered from the payload and never derived client-side; the tooltip explains why it is the gamma anchor rather than the live tape. This is what makes AC-23 satisfiable and closes the anchor-divergence risk in copy rather than leaving it to the reader.",
      "kind": "technical"
    }
  ],
  "asks": [
    "architect: can the rec response carry a per-field reason token for `max_risk`, `position_size`, `exit_plan.target` and `exit_plan.stop` that distinguishes 'the model left this blank' from 'an input it needed was missing this cycle'? Without it, §4a's `unavailable` / `not given` split collapses into one hedged literal and the feature's flagship honesty gain degrades back toward one em-dash.",
    "architect: does each candidate quote — and the straddle reading — carry an explicit session-basis token (live-session vs prior-close), or only `as_of`? PM's R3 says evenings may be the majority case; my lane renders literals by closed lookup and will not infer session by comparing a timestamp against a market-hours guess in the browser.",
    "architect: where does the cap comparison run, and does the wire carry a closed verdict token (within / above / not-checkable / no-cap) plus the effective dollar cap it compared against? The copy differs materially between 'Convexa compared these two numbers' and 'the AI asserted this', and I will not compute the comparison client-side from the owner's entered values.",
    "pm: does 'the rec's suggested size flows into the existing simulated entry pre-fill' mean the quantity field is pre-populated with the AI's number, or that the number is displayed beside a field the trader fills deliberately? The first makes the AI's size the form default, which is the hierarchy-side version of the drift the brief's binding framing warns about, and it needs a state and a literal I have not designed.",
    "architect: what is the closed drop-reason vocabulary for contracts the cap or the band omitted? AC-8 and my export drawer must state how many were included and that others were omitted by the cap, by lookup on a wire token rather than by subtracting two counts in the browser.",
    "pm + architect: is the candidates endpoint reachable for an anonymous caller, as AC-39's anonymous hand-off export implies? My §5 drawer copy and U-26's reachability rule are written for a signed-in rec panel, and an anonymous path needs its own state list and its own egress sentence."
  ]
}
```
