# R3 — pm resolutions: broker-connect

Responding party on C2 (architect) and C4 (ux). Resolution text only.

## C2 — split AC-6: **ACCEPT**

The architect is right on my own grounds: "one position with its legs" pre-commits to a
payload capability the BRIEF holds open, and composing legs heuristically from a flat
per-contract payload is the same fabrication class my AC-14 forbids in the flattening
direction. The unconditional truth (nothing missing, nothing wrong) and the conditional
presentation (grouping) split cleanly. One addition of my own: until the owner decides the
flat-payload fallback, per-contract rows must present AS per-contract rows — honest
ungrouped truth, never inferred pairings.

**Final AC text:**

- **AC-6a** *(unconditional; blocked-on-approval, verified in the named runtime follow-up)*
  With a connected broker and a non-empty Webull book, the Live tab lists every position the
  broker reports — symbols and quantities matching what the Webull app shows, and any
  position count shown never understating the broker's book. No reported holding is absent,
  merged away, or altered.
- **AC-6b** *(conditional on payload capture)* If the captured Webull payload carries a
  grouping identity for multi-leg options positions, the Live tab renders each such position
  as one position with its legs, not N unrelated rows. If the payload is flat with no
  grouping identity, the tab renders the per-contract rows honestly as separate contract
  rows — it never composes legs into a strategy by heuristic — and the grouped-rendering
  fallback goes to the owner as a named post-capture product decision (recorded, not
  defaulted).

## C4 — reword AC-8: **ACCEPT**, with the semantics call the architect asked for

**Product ruling: manual refresh has force-fetch semantics.** The owner presses refresh to
get closer to the truth *now*; cache-read semantics would make the affordance a decorated
no-op. So: refresh always requests a fresh broker read, the server remains free to throttle
it (the throttle protects the owner's own rate limits and is not the user's to bypass), and
a throttled or failed attempt is reported honestly instead of pretending freshness. The two
outcomes must be distinguishable at a glance — a moved stamp and an unmoved stamp with an
explanation are different facts.

**Final AC text:**

- **AC-8** A manual refresh affordance exists and always requests a fresh broker read. On a
  successful fresh fetch, the as-of stamp advances. If no fresh read happens (server
  throttle, broker unreachable), the tab visibly states that the shown snapshot is unchanged
  and why — a cache-served or failed refresh is never a silent no-op, and the affordance
  never claims freshness the fetch did not deliver.

## C3 — for the record (no action)

C3 is **MOOT in fact**: the owner already holds approved Webull API keys, so payload capture
cannot lag the build and the ship-timing either/or never arises. The escape hatch stands in
the decisions log regardless — if capture somehow fails at GATE Q, the conductor presents
the owner an explicit either/or (ship with AC-6a deferred vs hold for capture); neither lane
pre-decides it. AC-6a's *blocked-on-approval* annotation is now expected to clear during the
build rather than after it.
