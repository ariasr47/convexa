# bundle-events — BACKEND_EXECUTION_CONTRACT (GATE M fast-path)

> Emits exactly what `INTERFACE_CONTRACT.md` pins. Backend only; no UI, no `libs/api` change in this
> phase (the FE may ignore the new field entirely — the `meta.trace_id` precedent).

## 1. What to build

1. **A projection helper** turning the loaded calendar into the wire block — put it in the existing
   **`src/scanner/events.py` leaf** (it already owns the semantics) or a thin sibling. It must:
   - map curation state → the closed `state` enum (`unknown` / `none` / `scheduled`) per INTERFACE §2,
   - **force `unknown` when the calendar is expired** (`cfg.is_expired()`),
   - filter to **upcoming only** and compute `days_until` from the serving day,
   - carry `calendar_as_of` / `calendar_horizon_end` / `calendar_covers` / `calendar_expired` through.
2. **Attach it in `main.py`** as `market_state.event_calendar`, **AFTER `generate_signals` returns** —
   the `iv_rank` / `market_context` attach-after-scoring precedent. Add the field to the `MarketState`
   Pydantic model as `Optional`, defaulting to `None`, so the key is always emitted.
3. **The standalone conformance spec** `.claude/tools/conformance/bundle_events.json`, in the exact flat
   shape of `.claude/tools/conformance/iv_rank.json` — assert the key's **presence + type** on the
   ticker endpoint (the value is legitimately `null`, so do not pin a populated payload).
4. **A runnable selftest** for the projection (`apps/api` has no pytest — follow the `events_selftest.py`
   convention already in this leaf, assert-based, RED→GREEN).

## 2. Binding invariants

- **`[additive-keeps-score-byte-identical]` (HARD).** `signals.py` / `engine.py` / `live.py` /
  `darkpool.py` **0 diff**. The calendar is read and attached **after** scoring; no scoring module
  imports the events leaf. `opportunity_score` / `opportunity_tier` / `state_fingerprint` / the entry
  gate must be **byte-identical** with the block present, null, and absent — **prove it on a real
  ticker**, don't assert it.
- **`[best-effort-isolated-or-null]`.** Any calendar fault ⇒ `event_calendar: null`, bundle still 200.
  Wrap the attach so a raise inside the projection cannot escape into the response path. The loader is
  already non-raising; do not rely on that alone.
- **`[model-read-carries-its-assumptions]`.** The block is self-describing — it carries the file's own
  `as_of`, `horizon_end`, `covers` and `expired`. A date is only as trustworthy as the calendar's
  freshness, and `confirmed:false` + `note` must survive to the wire (a source disagreement is signal).
- **`[digested-labels-not-raw-dump]`.** `state` is the authoritative closed token; the event list stays
  small and bounded (upcoming only). No raw dump of the whole file.
- **`[live-vs-static-isolation]`.** STATIC — the **SSE payload gains no field**. Verify that explicitly.
- **The `absent-is-not-none` contract survives onto the wire.** An uncurated ticker is `unknown`, never
  `none`. This is the single most important behavior here; test it directly.
- **`[no-secrets-in-image]`** — n/a (the calendar is deliberately non-secret, checked-in config).

## 3. GATE Q surface

Run by a fresh de-correlated `qa-verify` after the lane reports done (venv
`apps/api/.venv/Scripts/python.exe`, `cwd=apps/api`; boot `npx nx serve api`):
1. **Byte-identity (HARD)** — score/tier/`state_fingerprint` identical across block-present vs
   null vs the pre-change build on a real ticker; `git diff` of the four scoring modules **empty**.
2. **The three states, live** — a curated-with-dates ticker (e.g. NVDA) → `scheduled` with
   `days_until` correct; an ETF (e.g. SPY) → **`none`**; an **uncurated** ticker (TSLA, MU, CSCO or UNH —
   deliberately absent from the config) → **`unknown`**. Independently RED the unknown/none collapse.
3. **Expiry forces unknown** — with a config whose `horizon_end` has passed, a curated ticker still
   reads `unknown`.
4. **Best-effort** — point `SCAN_EVENTS_PATH` at a missing/corrupt file ⇒ `event_calendar: null`,
   bundle **200**, `market_state`/`strike_profile` intact.
5. **Conformance** — `interface_conformance.py --spec .claude/tools/conformance/bundle_events.json`
   GREEN against the running backend, plus the existing `iv_rank.json` sweep as a regression floor.
6. **SSE untouched** — the live payload gains no field.
7. **Upcoming-only** — no past-dated event appears; `days_until >= 0`.

## 4. Lane rules

- Writes under `apps/api/` + `.claude/tools/conformance/` only. **No UI, no `libs/api`.**
- Commit locally on `main`; **do not push** — the conductor pushes after GATE Q.
- If the interface proves wrong or under-specified, **STOP and report** rather than inventing (GATE Z).
- Note: the config currently has **4 deliberately-uncurated tickers** (TSLA, MU, CSCO, UNH) — they are
  the natural `unknown` fixtures; do **not** "fix" the config by adding dates for them.
