# R3 — architect addendum: the `retained` predicate for a scanner price (S2 Important #2)

Scope: the ONE question routed by `decisions.md` §6. Every `file:line` was opened this round.
Two source facts below **withdraw** a premise my predecessor and SPEC §2.2 both assert.

## 0. Two facts that decide the question before the options are compared

- **Heartbeats on `/api/stream/prices` are SSE *comments*, not messages.** `stream.rs:434`
  (`.comment("connected")`), `:446` (`.comment("heartbeat")`, sent exactly when `dirty.is_empty()`,
  `:444-449`) and the transport keep-alive `:500` all emit comment lines; the repo's own wire test
  asserts that shape (`stream.rs:1414,1422`, `": heartbeat"`). `EventSource` never dispatches
  `message` for a comment, so `useLivePrices.ts:65-67` **cannot be woken by a heartbeat**. The only
  frames that reach `onmessage` are `data:` frames, and this route emits one only when `batch` is
  non-empty (`stream.rs:457-464`) — every one of them carries `prices`.
- **`LivePrice.ts` is not an arrival time and is not milliseconds.** The client comments it "when it
  arrived" (`useLivePrices.ts:23`), but the server writes `ev.ts_ns` (`stream.rs:454,480`), declared
  "Vendor timestamp (**nanoseconds** when available; **0 if missing**)" (`domain/price.rs:18-19`),
  parsed `unwrap_or(0)` (`massive/ws.rs:509,520`). The frame's own `as_of` is *seconds*
  (`stream.rs:462`) and the client discards it (`useLivePrices.ts:69` types only `prices`).

## 1. Chosen mechanism: **(i) watchdog ∧ provenance**. Constants: `SILENCE_MS = 45_000` and the `5_000` tick.

```
priceOffline(sym) = live.offline && live.prices[sym] != null ? { retained: true } : null
```
computed once at `Scanner.tsx:119-126`, where `live` (`:115`) and `lp` (`:122`) are already in hand.
No per-symbol age, no third number. `retained: false` is **unreachable on scanner by construction**,
so criterion 13's "`offline-bare` never occurs" (SPEC:544,689) is structural, not conventional.
Constants, both shipped and cited, none invented: `SILENCE_MS = 45_000` (`useLivePrices.ts:37`),
evaluated with strict `>` (`:85`) on a `5_000`ms interval (`:86`).

**Why (ii) per-symbol `ts` age is worse — four cited reasons, one of them fatal.**
1. **Fatal, arithmetic:** `now − lp.ts` compares ms to ns (`domain/price.rs:18-19`), a 10⁶ error; and
   any symbol whose vendor omitted `t` carries `ts: 0` (`massive/ws.rs:509,520`), so its age is the
   whole Unix epoch and it renders `offline · last known` **permanently, while live**.
2. Its stated justification is void. It existed only to repair "`setOffline(false)` on ANY frame,
   including a payload-less heartbeat" (`R3-architect.md:160-163`; SPEC §2.2:247-249). §0 shows no
   payload-less frame reaches that handler on this route. **I withdraw the `ts`-age repair.**
3. Even with correct units it measures *time since the last vendor print*, not *time since the stream
   spoke* — the conductor's objection, and under D-A it is the one falsehood left: a quiet-but-live
   symbol would say the stream dropped.
4. It mis-uses the shipped prop. `offline?: { retained: boolean } | null` (`FigureCell.tsx:174`) is a
   two-level shape: outer null/non-null = **the stream's** state, inner boolean = **the datum's**
   provenance. The shipped desk precedent reads exactly that way —
   `offline={tileOffline ? { retained: latch.retained } : null}` (`LiveTape.tsx:126,197,208,223`) over
   `useStreamLatch.ts:19-20,42` ("True iff the latch currently holds a value. The ONLY thing that
   licenses `· last known`"). Provenance, never age. (i) makes scanner and desk render one concept
   one way; (ii) mints a second shape for it.

## 2. (a) Is `setOffline(false)` at `:65-67` still a defect?

**No — the alleged defect does not exist on this route** (§0). A `message` here *is* a delivered
price, and under D-A clearing `offline` on it asserts nothing beyond "a price arrived", which is true.

**The real defect is its mirror image, and it ships today.** Because only price frames refresh
`lastSeen` (`:66`), a *healthy* stream on a quiet tape — precisely when the server is sending
heartbeat comments (`stream.rs:444-449`) — trips `SILENCE_MS` and flips `offline` **true**
(`:84-86`). The page then reads `Prices offline · showing last known` (`Scanner.tsx:144`,
`labels.ts:32`) with nothing wrong. **Minimal repair with no new constant, that I can name:**
`es.onopen = () => { lastSeen.current = Date.now(); setOffline(false); }` — a (re)connection is
transport-observable and honestly means "the stream is alive"; it also stops a reconnect inheriting a
stale `lastSeen`, which today keeps `offline` true from `onerror` (`:79-82`) until the next *price
change*. **Assumption I state rather than paper over:** that repair does not fix the quiet-tape case,
and no frontend-only repair can — the signal that separates "quiet tape" from "wedged socket" is the
1s heartbeat, and it is a comment, structurally invisible to `EventSource`. The fix is one line on
the same route (heartbeat as a `data:` frame), so it belongs in D-A's already-dated carried debt
against *the phase that adds `market_session` + `live` to `/api/stream/prices`*. (i) inherits this
gap **unchanged** and adds no new falsehood; (ii) would add one at row scope and leave this one.

## 3. (b) What criterion 12 asserts, observably

- **Event (the stated moment):** `live.offline` (`useLivePrices.ts:33,94`) turns true — immediately on
  `es.onerror` (`:79-82`), or at the first `5_000`ms tick strictly after 45 000 ms without a price
  frame (`:37,85,86`), i.e. a bounded window of **[45 s, 50 s)**. A test names the *event* and drives
  it (mock `EventSource` + `onerror`, the repo's own idiom at `ticker-hierarchy.spec.tsx:24-30`; or
  fake timers) — it never waits 45 s of wall clock.
- **Cells that must change:** exactly the rows where `live.prices[symbol]` is present at
  `Scanner.tsx:122` (so the displayed value came from the stream, `:123`). Each renders
  `[data-testid="cell-price"][data-figure-state="offline-retained"]` (`ScanCells.tsx:73`; per-consumer
  emission per R3 #16), dimmed, with the stroke pause mark and caption `offline · last known`
  (`FigureCell.tsx:260-268`).
- **A never-ticked symbol:** `live.prices[symbol]` undefined → `Scanner.tsx:123` returns the untouched
  polled row, so the cell shows the **swept price at full strength**, `data-figure-state="default"`,
  no pause mark, no caption. That is criterion 13, and (i) makes it true by construction.
- **Structure figures beside it:** identical text, not dimmed — they come from `useScan` and never
  touch `live`.

## 4. (c) One flag — CONFIRMED, and under (i) it is structural

`Scanner.tsx:144`'s `live.offline ? SCAN_COPY.cadenceHeaderOffline : SCAN_COPY.cadenceHeader` and the
per-figure retained arm must read the **same** `live.offline` from the **same** `useLivePrices` call
(`:115`), in the same commit. Under (i) that is automatic: the header reads the flag and the prop is
`live.offline && …`, so header and figures cannot disagree. Under (ii) it is not — the header would
key on the page flag while figures key on per-symbol ages, and they can disagree in both directions.

## 5. Bonus — desk specs the D-C criterion must re-run for the **live tape**

Opened this round. **Focus order / tap+keyboard:** `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts`
— the AC-35 suite (`:496-592`) walks a closed `HOVER_INFO_WIDGETS` list of four (`:502-507`) plus one
`FigureCell` site, `ladder-foot` (`:585-589`); `live-tape` appears only in the AC-20b width block
(`:626,641`), so the tape's *frame* ⓘ is covered by **nothing** today and D-C must extend this list,
not merely re-run it. **a11y tree / reading order:** `apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx`
— asserts zone labels are non-headings (`:85,100`) and reads `live-tape` (`:117-119`); a new focusable
button inside the shared frame changes the desk's tab order and accessible tree at all eight sites.
**Single motion moment:** `apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts` — its (e)
predicate asserts `widgetLivePulse` sits behind `...(live &&` + the reduced-motion media query
(`:228-236`) and its poison run string-transforms the **real** `Widget.tsx` source (`:265-277`); D-C
edits `Widget.tsx:245-249`, the same file, so this suite is in scope by construction.
**Live-dot census:** `apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx` — mounts `LiveTape`
+ `StructureHeroPanel` + `ReadStrip` together (`:170-184`) and asserts the tape's own dot count
(`:221-223`) and page-wide zero on a drop (`:283-294`). **The widget's own spec:**
`apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx` (`:114-436`).
`apps/dashboard/src/app/pages/ticker/ticker-desk-composition.spec.tsx:129` reads
`widget-live-tape`'s `textContent`; `AccessibleHelp` renders an `aria-label` only, no visible text
(`AccessibleHelp.tsx:40-49`), so it should be unaffected — cheap to include, and its greenness is
evidence. **One architectural flag for R4:** `AccessibleHelp` lives at
`pages/ticker/widgets/ai-rec/AccessibleHelp.tsx`, so wiring it into `shared/ui/Widget/Widget.tsx`
makes `shared/` import from `pages/` — the exact inversion R3 #0 refused for the figure module
(`notANumber.ts:18-23`, `liveClaim.ts:9-14`). D-C's mechanism needs it promoted (a `shared/a11y/`
already exists), and that move is part of the change, not a follow-up.
