# R2 — ux critique: broker-connect

```json
{
  "role": "ux",
  "agree": [
    "Both `unknown` and `empty` carry an empty list, so **no consumer may branch on `positions.length`** — the state enum is authoritative, rendered by closed lookup, never re-derived (the `digested-labels-not-raw-dump` rule applied to a state).",
    "How that renders is the UX lane's call; *that the datum carries its own basis so honest rendering is even possible* is mine.",
    "READ-ONLY is not \"no functional order button\" — it is **no affordance at all**: no disabled buttons, no greyed \"Close\" action, no \"coming soon\" trade menu item, no copy implying an order path exists.",
    "Cadence/mechanics are the Architect's call.",
    "The app fabricates nothing while waiting.",
    "My product ruling (argued, and flagged as contestable): **the ledger counts SIM outcomes only in v1.**"
  ],
  "conflicts": [
    {
      "quote": "**AC-8** A manual refresh affordance exists; using it updates the as-of stamp on success.",
      "source": "pm",
      "why": "The architect's refresh model (on-demand fetch + short server TTL cache, server-authoritative throttling) means a manual refresh can legitimately be answered from the cache — a 'successful' refresh whose as-of stamp does not move. As written, AC-8 either fails on that honest cache-serve (the button reads as broken) or forces the refresh to bypass the very throttle the architect placed to protect the owner's broker rate limits. The UI must be able to render 'you asked; here is the same snapshot, and here is why' as a truthful outcome, not a silent no-op.",
      "proposal": "Manual refresh requests a fresh fetch; the server may answer from cache but says so on the wire (see the attempt-metadata proposal in the next conflict). Reword AC-8: 'A manual refresh affordance exists; using it either advances the as-of stamp or visibly states that the served snapshot came from the cache and why (throttled / broker unreachable) — never a silent no-op.'",
      "kind": "technical"
    },
    {
      "quote": "Rate limiting is handled server-side (throttle + TTL cache); a rate-limited moment serves the cached book with its honest `as_of`/`basis`, or `unknown` if there is none.",
      "source": "architect",
      "why": "This cannot stand as the complete envelope story, because it makes an outage invisible whenever a cache exists: a broker-unreachable or rate-limited moment with a valid cache returns an ok-looking book whose only signal is an old `as_of`. The UI is then structurally unable to render PM's AC-12 ('If last-known data exists it stays visible under an honest banner') or R1-ux's S7 degraded state — it can only show quiet staleness (S6), which misrepresents 'the last attempt failed' as 'nobody asked recently'. Stale and degraded are different honesty claims and different trader actions. Additionally, since `unknown` carries `positions: []`, last-known rows after cache expiry exist only in client session memory — so 'your last confirmed book stays below' (S8 copy, AC-12) is only conditionally true and never true after a page reload.",
      "proposal": "Additive fields on `BrokerBook` (no port change, matching the architect's own additive-field rule): `last_attempt_at` plus a closed `last_attempt_outcome` (ok | broker_unreachable | rate_limited | credential_rejected | adapter_fault), so a cached serve after a failed attempt renders as S7/S8 with an honest banner over the cached rows. UX side: the S7/S8 'last-known book stays below' clauses become conditional ('if a confirmed book from this session exists'), mirroring AC-12's own 'if last-known data exists'.",
      "kind": "technical"
    },
    {
      "quote": "**Webull · read-only** &nbsp;·&nbsp; `as of 2:41:07 PM` &nbsp;·&nbsp; refreshes about every {cadence} — a snapshot, never live.",
      "source": "ux",
      "why": "Own-lane copy falsified by the architect's refresh model — surfaced rather than silently patched. Architect §6 sets v1 as on-demand fetch + TTL cache with no background poller ('A background cadence poller and any push channel are **named deferred seams**, not v1'). There is no cadence for a `refresh_seconds` field to carry, so 'refreshes about every {cadence}' promises a schedule that does not exist — a fabricated freshness claim, the exact sin this header exists to prevent. The same phantom cadence infects R1-ux S6's trigger ('last good read older than the refresh cadence'), S7's 'this cycle' copy, and PM AC-11's 'older than its declared basis'.",
      "proposal": "Header becomes: '**Webull · read-only** · as of {time} · read on demand — a snapshot, never live.' Stamp tooltip: 'Your Webull positions are read when you open or refresh this tab, not streamed.' S6 staleness is driven by an explicit age threshold (wire-supplied or an agreed constant), which also repairs AC-11's trigger. S7 copy: 'Couldn't reach Webull just now — showing your book as of {time}. Everything else in Convexa is unaffected.' If a v2 poller lands, the cadence clause returns with a real wire field behind it.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: is 'Live' a binding trader-visible tab label, or a pointer to the existing surface? R1-ux renames the visible tab to 'Broker' because a tab literally labeled Live above polled rows contradicts the scanner poll-honesty rule your own AC-7 applies here — but your stories and ACs consistently name the surface 'the Live tab' without ever pinning the label. If you hold 'Live' as product framing, that is a product fork for the owner; if it is just the surface's internal name, say so and the rename proceeds.",
    "Architect: confirm the closed `unknown` reason vocabulary includes broker-rejected-credential (expired / revoked / unapproved key) as its own reason, distinct from broker-unreachable and from no-credential-stored — your §5 illustrative list ('no credential, decrypt-fail, broker unreachable, rate-limited with no usable cache, adapter fault') omits it, and PM's AC-13 plus R1-ux's S8 (warning + Reconnect CTA) are unrenderable as a distinct state without it. Three reasons, three renders, three trader actions.",
    "Architect + PM: does a broker row show unrealized P/L in v1 when Webull supplies cost basis and mark (basis named per `[model-read-carries-its-assumptions]`), or do broker rows ship without a P/L column, rendering `not provided`? Architect's non-goal ('no broker-reported P&L reconstruction') and the optional tri-state cost-basis/mark fields point different directions, and the row copy differs materially; PM should also say whether a P/L-less real book still satisfies S2's job-to-be-done."
  ]
}
```
