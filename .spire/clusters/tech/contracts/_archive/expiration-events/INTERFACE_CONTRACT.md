# expiration-events — INTERFACE_CONTRACT (GATE M — only the changed field)

> Additive extension of the shipped `market_state.event_calendar` block (feature `bundle-events`,
> archived). No new endpoint; no removed/renamed field; no changed type on anything shipped.

## 1. The added field

`market_state.event_calendar.expirations` — **array, always present** when `event_calendar` is non-null
(`[]` is a valid value; see §3 for what it does and does NOT mean).

One entry per tenor on the bundle's existing full-chain expiration curve, ascending by DTE:

```jsonc
{
  "expiration": "2026-09-18",   // ISO date, echoed from the tenor curve
  "dte": 53,                    // integer, echoed from the tenor curve
  "contains_event": true,       // does a scheduled event fall inside this option's life? (§2)
  "event_count": 1,             // integer >= 0 — events contained by THIS expiration
  "event_types": ["earnings"],  // closed enums, de-duped, sorted; [] when contains_event is false
  "first_event_date": "2026-08-26"  // ISO date | null — earliest contained event
}
```

`contains_event` and `event_count` are redundant by construction (`contains_event == event_count > 0`);
both ship because the boolean is what a consumer branches on and the count is what it reports.

## 2. Containment — the rule, stated exactly

An event is **contained** by an expiration when:

> `serving_day <= event.date <= expiration` — **except** an `amc` event **on** the expiration date,
> which is **NOT** contained.

The exception is the whole point of stating this precisely: a contract expiring at Friday's close is
**dead before** an after-close report the same day. Treating that as "contains earnings" would flag an
expiry that structurally cannot see the event — an off-by-one that produces a wrong tenor choice. An
event with `session: null` on the expiration date **IS** counted as contained (unknown session ⇒ do not
silently assume it lands after the close; the conservative direction is to flag it).

Events strictly before the serving day are already excluded upstream (`event_calendar.events` is
upcoming-only) and therefore cannot be contained by anything.

## 3. What an empty `expirations` does NOT mean

`expirations: []` is emitted whenever a per-expiration claim cannot be supported:
- `state` is `unknown` (never curated) — **we cannot say anything about any expiry**, or
- `state` is `none` (checked, nothing scheduled in `covers`), or
- the bundle carries no usable tenor curve (sparse chain).

**`state` remains the sole disambiguator and MUST be read first.** An empty list under `unknown` means
*we don't know*, never *no expiry is affected* — the `absent-is-not-none` rule carried down one level.
A consumer that reads `expirations` without first branching on `state` is wrong.

## 4. Semantics

- **Derived, not fetched.** Built after scoring from the bundle's own tenor curve × the calendar. Adds no
  vendor call and does not change how the tenor curve itself is computed.
- **Bounded.** One entry per available expiration; per-entry payload is a summary (count + de-duped type
  tokens + first date), **not** a repeat of the event objects — those live once, in `events`.
- **Static.** SSE payload gains no field.
- **Never an error.** Any derivation fault ⇒ `expirations: []`, bundle still **200**.
- **Never a scoring input.** `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
  gate stay byte-identical.

## Conformance spec

The runnable spec stays the standalone `.spire/clusters/tech/state/conformance/bundle_events.json` (extended by this
feature, not replaced) — the canonical convention per the owner's 2026-06-23 system-12 decision. Run it
with `interface_conformance.py --spec …`. The block below is a **single-source POINTER, not a copy**,
present only to satisfy kit v1.0.0 `contract_lint` M7 (which errors unless this section carries a
parseable fenced JSON block); duplicating the spec here would recreate the dual-source drift that
decision removed. See `BACKLOG.md §E system-12`.

```json
{
  "$ref": ".spire/clusters/tech/state/conformance/bundle_events.json",
  "_note": "Pointer, not a copy. Canonical runnable spec is the standalone file; run with --spec. Harness limitation carried over: interface_conformance TYPE_CHECKS has no enum matcher, so event_types tokens and the closed state vocabulary are verified off-harness by the mutation-tested selftest and live reads."
}
```
