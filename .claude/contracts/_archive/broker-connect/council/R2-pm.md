# R2 — pm critique: broker-connect

```json
{
  "role": "pm",
  "agree": [
    "architect: \"**There is NO write method. Not \\\"unused\\\" — nonexistent.** No `place_order`, no `cancel`, no `modify`, no generic `execute(...)` escape hatch, ever.\" — this is AC-15/AC-16's read-only absolutism made structural; the port's type surface enforcing what my ACs can only observe is exactly the division of labor I want.",
    "architect: \"Both `unknown` and `empty` carry an empty list, so **no consumer may branch on `positions.length`** — the state enum is authoritative, rendered by closed lookup, never re-derived (the `digested-labels-not-raw-dump` rule applied to a state).\" — this makes AC-10 (unknown vs confirmed-empty) structural rather than FE-inferred, which is the assumption my R1 declared it depends on.",
    "architect: \"Rotation = Replace (a new write overwrites the ciphertext); Delete leaves the Live surface in `unknown / not-connected` — a deleted credential must never leave a ghost book behind (the server cache for that account is invalidated on delete).\" — cache invalidation on delete is what makes AC-3 (\"no real-position data remains visible anywhere afterwards\") actually verifiable.",
    "ux: \"Position: the **visible tab label becomes `Broker`** (internal names, routes, testids may keep `live` for continuity — the ban is on what the trader reads).\" — accepted, no fight. My R1 pinned the SURFACE (the existing second tab, same page, same structure), not the visible word; AC-7 already forbids \"live\" as a freshness claim on polled data, and a tab literally named Live above polled rows is that claim in its largest type. The rename is UX-lane copy authority applied consistently; the owner sees it at GATE V regardless.",
    "ux: \"**READ-ONLY is rendered as absence, not as disabled controls.**\" — precisely AC-15's intent: a disabled Close button is a promise, and this feature makes no such promise.",
    "ux: \"and **the Broker tab's S1 empty state carries the primary discovery CTA**, deep-linking to the Settings `#brokerage` anchor (the `#ai-key` anchor precedent).\" — matches my scope item 1 (credentials in Settings, byo-ai-key shape reused deliberately); one credential home, two doors is the right product call and I confirm connect-in-place on the Positions page is NOT a product requirement."
  ],
  "conflicts": [
    {
      "quote": "The cadence figure comes from the wire (a `refresh_seconds`-style field), never hardcoded in FE copy — a hardcoded \"every 60s\" goes stale the day the poll changes.",
      "source": "ux",
      "why": "There is no cadence to put on the wire. The architect's §6 refresh model — which my R1 explicitly ceded to that lane (\"Cadence/mechanics are the Architect's call\") — is on-demand fetch + short TTL cache + explicit user refresh, with the background poller a NAMED v2 seam, not v1. UX's header copy (\"refreshes about every {cadence}\"), the stamp tooltip (\"read on a schedule, not streamed\"), and the S6 stale trigger (\"last good read older than the refresh cadence\") all describe a scheduled poller that does not exist in v1. Copy promising automatic refresh the product never performs is itself a freshness fabrication — the exact class of dishonest claim the as-of stamp exists to prevent, just inverted: instead of calling stale data live, it calls never-auto-refreshing data scheduled.",
      "proposal": "v1 provenance copy states the on-demand basis: \"Webull · read-only · as of {time} · updates when you refresh — a snapshot, never live\" (wordsmithing UX's), and staleness renders from the as-of age against whatever threshold datum the server declares — never from a cadence. The {cadence} copy slot and `refresh_seconds`-style field return only if/when the named v2 poller seam ships and puts a real cadence on the wire. AC-7/AC-11 language will follow the on-demand framing.",
      "kind": "technical"
    },
    {
      "quote": "**PM treats the blocked Webull approval as a sequencing fact** (payload capture is build task #1; design proceeds now), not as a reason to ship an unverified adapter behind a flag or to invent a mock-only \"done.\" Falsified if the PM's definition of done doesn't include a live payload capture.",
      "source": "architect",
      "why": "This sentence quietly decides a ship-timing question that is not the architect's to decide. It collapses two different things: inventing a mock-only done (which my position forbids as hard as his — AC-20: the app fabricates nothing while waiting), and shipping the honest, complete-except-one-AC feature with AC-6 recorded at GATE Q as blocked-on-approval and verified in a named follow-up runtime check (which my position explicitly allows). If Webull's approval outlasts the build, \"done requires live payload capture\" means GATE S is held hostage to a third party's approval queue. Whether to ship the demonstrable 19/20 (every state including credential-rejected exercised for real) or hold the whole feature for capture is a priority/scope call — the owner's, not a lane's.",
      "proposal": "Keep payload capture as build task #1 the moment keys exist, and keep the fixture-first adapter testing exactly as the architect designed it. If approval still lags at GATE Q, the conductor presents the owner an explicit either/or — (a) ship with AC-6 deferred to a named runtime follow-up, AC-20 holding meanwhile, or (b) hold GATE S until capture — rather than either lane pre-deciding it. My per-field product promises (which columns/facts render) stay uncommitted until capture either way, per the architect's own risk note.",
      "kind": "product"
    }
  ],
  "asks": [
    "Architect: with no poller in v1, what datum defines 'stale' for AC-11 / UX's S6 — a server-declared age threshold riding the wire, the TTL, or purely rendered as-of age with no binary stale state at all? Product needs stale to derive from data, not from an FE convention that drifts.",
    "Architect: does §11's non-goal 'no broker-reported P&L reconstruction' also exclude DISPLAYING a broker-SUPPLIED unrealized P/L figure if payload capture shows Webull sends one? UX's P/L-basis copy (§5) is written to go either way, but which way is a fact only you can settle post-capture — and I don't want it settled silently in the adapter mapping.",
    "Architect: does the closed reason vocabulary on `unknown` (§5) expose 'credential stored, never successfully read' distinctly from 'no credential' and from 'fetch currently in flight', or is in-flight purely client-known? UX's S1/S2/S5/S9 split — and my AC-9/AC-10 — need to know which of those distinctions the wire carries versus which the FE owns."
  ]
}
```
