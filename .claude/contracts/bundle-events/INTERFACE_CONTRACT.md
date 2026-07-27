# bundle-events — INTERFACE_CONTRACT (GATE M — only the changed field)

> Additive change to the EXISTING bundle endpoints (`GET /api/ticker/{ticker}` and its aliases/slices).
> No new endpoint, no removed or renamed field, no changed type on anything already shipped. Per
> ORCHESTRATOR GATE M this contract states **only what changed**.

## 1. The added field

`market_state.event_calendar` — **`object | null`**, and the **key is ALWAYS present** (the
`iv_rank` / `market_context` convention: emit the key, nullable value, so a consumer never has to
distinguish "absent" from "null").

```jsonc
"event_calendar": {
  "state": "scheduled",          // closed enum — see §2. AUTHORITATIVE on the wire.
  "events": [                    // [] unless state == "scheduled"; bounded, chronological, UPCOMING only
    {
      "date": "2026-08-26",      // ISO YYYY-MM-DD
      "type": "earnings",        // closed enum (earnings|ex_div|fomc|cpi|pce|nfp|product|lockup)
      "confirmed": true,         // true ONLY when company-announced; false = projection
      "session": "amc",          // "bmo"|"amc"|null — null means genuinely unknown, not "assume amc"
      "days_until": 30,          // integer, relative to the serving day (a convenience, not a new fact)
      "source": "https://…",     // provenance URL
      "note": "WSH CONFIRMED…"   // string|null — carries source DISAGREEMENT where it exists
    }
  ],
  "calendar_as_of": "2026-07-27",       // string|null — when the file was last verified
  "calendar_horizon_end": "2026-10-31", // string|null — entries claimed valid only to here
  "calendar_covers": ["earnings"],      // array — WHICH event types the curation pass covered
  "calendar_expired": false             // bool — horizon passed (or unset) ⇒ do not trust
}
```

## 2. `state` — the closed vocabulary (the load-bearing part)

| value | meaning | `events` |
|---|---|---|
| `unknown` | the ticker is **not curated** — we do not know its schedule | `[]` |
| `none` | curated, and **nothing scheduled within `calendar_covers`** | `[]` |
| `scheduled` | curated, with ≥1 upcoming event | non-empty |

**`unknown` and `none` are DIFFERENT CLAIMS and must never be collapsed** — this is the
`absent-is-not-none` contract from `src/scanner/events.py` carried onto the wire. A consumer that
renders `unknown` as "no earnings scheduled" is wrong. The FE/AI renders `state` via a **closed
lookup** and never re-derives it from `events.length` (`digested-labels-not-raw-dump`) — because
`events: []` is ambiguous on its own and `state` is what disambiguates it.

**`calendar_expired: true` forces `state: "unknown"`.** An out-of-horizon calendar cannot support a
`none` or `scheduled` claim, and silently serving dead dates is the failure mode the horizon exists to
prevent.

**`calendar_covers` scopes `none`.** `none` asserts "nothing of the covered types" — for an ETF under
`covers: ["earnings"]` that means no earnings, NOT no ex-dividend.

## 3. Semantics

- **Upcoming only.** Events strictly before the serving day are omitted; `days_until >= 0`.
- **Static, not live.** Nothing rides SSE; the SSE payload gains no field. The block changes only when
  the bundle is recomputed or the config is edited + the process restarted (no hot-reload).
- **Never an error.** Any calendar fault (missing/corrupt/unreadable config, loader raise) ⇒
  `event_calendar: null` with the bundle still **200**. It is enrichment, never a precondition.
- **Never a scoring input.** `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
  gate are **byte-identical** with the block present, null, or absent.

## 4. Conformance spec

The runnable spec is the standalone `.claude/tools/conformance/bundle_events.json` (the canonical
convention — precedent `iv_rank.json` / `scanner.json`; do **not** embed a nested block here).
It asserts the **key is always present** on the ticker endpoint and that, when non-null, `state` is one
of the three enum values. Because the value is legitimately `null` for an uncurated/faulted ticker, the
spec pins **presence + type**, not a populated payload.
