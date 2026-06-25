# ticker-load-experience — FRONTEND EXECUTION CONTRACT (→ apps/dashboard)

> UI work + component states ONLY. References `INTERFACE_CONTRACT.md` for what the FE CONSUMES; carries
> NO server internals (no `live.py`/`main.py`/`engine.py`/`signals.py`/uvicorn/Pydantic). Component
> states + copy are in `UX_BLUEPRINT.md`. Restated binding invariants this lane touches:
> `additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`, `live-vs-static-isolation`,
> `live-spot=NBBO-mid` carve-out. Target files: `apps/dashboard/src/app/ticker/TickerDashboard.tsx`
> (+ a small skeleton helper) and `libs/api/src/lib/gammaflow.ts` (the `LiveUpdate` type extension).

---

## 1. Consume the new SSE field (INTERFACE §2)

- Extend `LiveUpdate` in `libs/api/src/lib/gammaflow.ts`: add `last_trade: number | null;` (always
  present, nullable). No other client change — `streamTicker` already forwards the parsed payload.
- `last_trade` is LIVE-DERIVED. The FE renders it from `live.last_trade`, degrades it with the existing
  `streamOffline` watchdog (the same mechanism that dims `mid`/`spread`/`net_flow`/`gamma_flip`), and
  treats null as the honest "no recent print" empty — never a stale number (`[live-vs-static-
  isolation]`, `[best-effort-isolated-or-null]`).
- **`live-spot=NBBO-mid` (binding):** `last_trade` is DISPLAY-ONLY. It MUST NOT be wired into the
  headline anchor (`isLive ? live.mid : m.price`), the levels, the gamma-flip value, the GEX chart's
  `liveSpot`, or any derived state. Render it; never compute from it (AC-LastTrade-4/5, AC-Invariant-1).

## 2. Skeleton-first load — remove the full-page gate (AC-Skel-1..5)

- Remove the monolithic full-page `<CircularProgress/>` body gate
  (`TickerDashboard.tsx:497`, `{!data && !error && <CircularProgress />}`) and split the `m &&`
  body-gate (:512) so STRUCTURE paints when `data == null && error == null`.
- Paint per-region skeletons (MUI `<Skeleton>`) over the existing component tree per the
  UX_BLUEPRINT §3 inventory: headline frame, the stat-grid tiles, the GEX chart frame, the
  term-structure card, fresh-positioning, off-exchange, setups. No new data shape; the component tree
  is unchanged — only the LOADING look is added.
- **Per-source fill (not per-tile-on-one-clock):** a region leaves LOADING when ITS source resolves —
  live tiles + the last-trade line from SSE (`live != null`), the bundle tiles/chart/sections from the
  REST bundle (`data != null`), the AI panel on its own lifecycle (unchanged). A slow bundle must not
  hold back the live readings (AC-Skel-2).
- A source resolving to null/[] shows its EXISTING "unavailable this cycle" empty text (UX §3 column
  "Its EMPTY look") — NOT a perpetual skeleton (AC-Skel-5). LOADING (shimmer) ≠ EMPTY (no shimmer) ≠
  OFFLINE (dimmed real values) — distinct CSS classes/conditions (AC-Skel-3/4, AC-Invariant-3).
- PRESERVE the small inline toolbar `<CircularProgress size={18}/>` (:452) — it is the per-refresh
  activity spinner, not the removed full-page gate.

## 3. The four post-load states — preserve, do not regress (AC-State-1/2/3)

These already ship; assert them against the new skeleton model:
- **STALE** (`data && error`) — keep the bundle behind the soft "Couldn't refresh…" Alert (:492). No
  blank (AC-State-1).
- **OFFLINE** (`data && streamOffline`) — dim ONLY live-derived tiles + the last-trade line (`opacity:
  0.5` + `⏸`), one `⚠ Live offline — reconnecting…` chip; statics/chart keep last good values
  (AC-State-2, AC-LastTrade-3). EXTEND the offline treatment to the new last-trade line (it degrades
  WITH the live fields).
- **ERROR** (`!data && error`) — the single red error + Retry (:484), the ONLY blank screen
  (AC-State-3, AC-Invariant-2).

## 4. Last-trade readout — render per UX_BLUEPRINT §4.1

- Add a SECONDARY line beside the headline (`variant="body2"` `color="text.secondary"`), per the
  state→copy table in UX §4.1: DEFAULT `● Last trade $X`, LIVE-EMPTY `Last trade — no recent print`,
  OFFLINE `⏸ Last trade $X` dimmed, LOADING short skeleton. It is never the `variant="h1"` headline.
- Wire the last-trade tooltip + glossary line from UX §4.1.
- **Copy correction (UX §4.1 note):** `liveStatus()` (:201) currently appends `· last $X` using
  `live.mid` (the MID, mislabeled "last"). Relabel that segment so it does not read as "last trade"
  (e.g. drop "last" or render `· mid $X`), so the ONLY "last trade" on screen is the new print-driven
  readout. Behavior unchanged; copy only.

## 5. Stale warning + speed (AC-Stale-1/2, AC-PreWarm-1/2/3)

- The stale warning copy/markup is UNCHANGED (:472). Its spurious mid-session firing is fixed by the
  backend `STALE_AFTER_SECONDS` config (INTERFACE §4), not the FE. FE tests assert it does not show
  when freshness is within threshold and still shows when genuinely old (drive via mocked
  `meta.freshness`).
- Speed has NO FE copy. AC-PreWarm-1/2 are timing: a fast-resolving (mocked-warm) bundle clears
  skeletons immediately; a slow (mocked-cold) bundle keeps skeleton structure throughout, never a
  blank. AC-PreWarm-3 / AC-Invariant-1: the page presents identical data/levels/score regardless of
  whether the bundle arrived warm or cold (the FE cannot and must not distinguish them).

---

## 6. Tests to write (REQUIRED set — the FE implements this floor, never chooses it)

> Per the standing FE-tests rule (`PROJECT_CONTEXT §7`): each AC = ≥1 named behavioral test; the
> flow-integration (F) test drives the real user flow mocking ONLY the network boundary (`getTicker`,
> `streamTicker` / `EventSource`); never a live backend. QA enforces AC↔test traceability at GATE Q.
> This table is the projection of UX_BLUEPRINT §5 (AC → component-state map). Kinds: U=unit,
> C=component, F=flow-integration.

| AC | Test name | Kind | Covers (state / edge / invariant) |
|---|---|---|---|
| AC-Skel-1 | `cold load paints page structure with no full-page spinner` | C | LOADING (cold): structure present, no body `<CircularProgress>` |
| AC-Skel-2 | `each source fills its own region independently` | F | live fills before bundle; AI on its own clock; slow bundle ≠ blocking live |
| AC-Skel-3 | `cold skeleton is visually distinct from unavailable-this-cycle` | C | LOADING ≠ EMPTY (shimmer vs muted text) |
| AC-Skel-4 | `cold skeleton is visually distinct from live-feed-dropped` | C | LOADING ≠ OFFLINE (shimmer vs dimmed real values) |
| AC-Skel-5 | `resolved-empty source shows empty state, not a stuck skeleton` | C | source→null ⇒ EMPTY, skeleton cleared |
| AC-State-1 | `failed refresh after success keeps last bundle behind soft notice` | C | STALE; nothing blanks |
| AC-State-2 | `live-feed drop dims only live tiles, statics keep last good values` | C | OFFLINE; live-vs-static split |
| AC-State-3 | `first-load failure shows single error + retry as the only blank screen` | C | ERROR; only blank |
| AC-PreWarm-1 | `active-session visit fills near-instantly (warm path)` | F | mocked-warm bundle resolves immediately; skeleton does not linger |
| AC-PreWarm-2 | `first-ever cold visit shows skeleton throughout, never a blank` | F | LOADING persists then DEFAULT; never blank/spinner |
| AC-PreWarm-3 | `pre-warmed and non-pre-warmed loads present identical data and levels` | F | DEFAULT identical regardless of arrival timing |
| AC-Coalesce-1 | `concurrent identical loads render one consistent page` | F | DEFAULT consistency under concurrent loads (FE face) |
| AC-Concurrency-1 | `overlapping fetches present the complete page, no section dropped or reordered` | F | DEFAULT completeness |
| AC-Isolation-1 | `pre-warm unavailable falls back to normal load, no error` | F | DEFAULT via normal path; no error surfaced |
| AC-Isolation-2 | `single source failure shows only that component empty, rest loads` | C | EMPTY for one component, DEFAULT for the rest |
| AC-LastTrade-1 | `last trade shows live print beside anchor and updates` | C | DEFAULT last-trade; updates on payload |
| AC-LastTrade-2 | `no recent print shows "no recent print", never a stale value` | C | LIVE-EMPTY |
| AC-LastTrade-3 | `last trade dims and pauses with live fields on drop, recovers on reconnect` | C | OFFLINE last-trade; recover |
| AC-LastTrade-4 | `last trade is secondary and never presented as the headline` | C | placement; not the `h1` |
| AC-LastTrade-5 | `changing or clearing last trade never moves headline, levels, or flip` | C | anchor invariance (`live-spot=NBBO-mid`) |
| AC-Stale-1 | `stale warning does not fire mid-session under real-time threshold` | C | STALE not spurious (mocked freshness within threshold) |
| AC-Stale-2 | `stale warning still fires when data is genuinely old` | C | STALE honest (mocked old freshness) |
| AC-Invariant-1 | `score tier gate and fingerprint are unchanged across pre-warm and last-trade presence` | F | byte-identity wire face (FE asserts same values rendered) |
| AC-Invariant-2 | `no feature failure produces an error page beyond first-load-failed` | F | EMPTY/LIVE-EMPTY/normal degrade, never new error |
| AC-Invariant-3 | `live-vs-static isolation: last trade degrades live while statics persist` | C | last-trade is live-class; LOADING≠OFFLINE≠STALE |

The FE MAY add unit tests (ceiling) but MUST NOT silently drop a required case (untestable → GATE Z
bounce). Assert the contract's component states + degraded paths + promoted invariants — not a coverage %.

## 7. Out of bounds for this lane (restate)

- NO server internals (no `live.py`/`main.py` edits, no Pydantic, no uvicorn). The only cross-repo edit
  is the `LiveUpdate` type in `libs/api` (a shared-lib type the FE consumes).
- NO change to the headline anchor / levels / flip / score wiring (`live-spot=NBBO-mid`,
  `additive-keeps-score-byte-identical`). Last-trade is display-only.
- NO new error/blank surface beyond the existing first-load-failed screen
  (`best-effort-isolated-or-null`, AC-Invariant-2).
- NO conflation of the four states; the cold skeleton class must never appear post-load and the offline
  dim must never appear pre-load (`live-vs-static-isolation`, AC-Invariant-3).
