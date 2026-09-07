# RESUME — curvature-v2-surfaces frontend lane (FE-8 → FE-10)

**Resume status:** ACTIVE — **stopped deliberately by the conductor after FE-7 landed, at the owner's request
(machine restart), 2026-09-07.** Nothing is half-done: the working tree was clean at the stop; the one follow-up
the conductor's cold check found (a stale live-checked exemption in `pauseGlyph.spec.ts`) is committed. Lane 4
was killed after committing FE-7 and before writing its own handover, so this file is the conductor's.

## Done (all committed on `spire/curvature-v2-foundations`, pushed to origin as a backup 2026-09-07, no PR — re-run before trusting)

| Task | Commit | What landed |
|---|---|---|
| FE-1 | `2cace383` | `shared/figure/{figureState,figureFace,FigureMarks,index}` + spec; `FigureCell` is a caller; N-1 needles enforcing in `shared/theme/fonts.spec.ts` behind a live-checked `EXEMPT` map (14) |
| FE-2 | `be7c067b` | liveness fence widened to the four surfaces (`liveClaim.spec.ts`); banned `genuineIsLive` deleted from `PositionsPage.tsx` |
| FE-3 | `d905d26a` | scanner atoms consume the figure module; U-6 lookup-miss split; `scanner.register.spec.tsx`; string-radius needle; `EXEMPT` 14 → 12 |
| FE-4 | `356cea52` | scanner degraded price arm (`live.offline ∧ provenance`), flash gate on the stream flag, **D-A copy** (header + gloss), T5 pinned both arms |
| FE-5 | `bdc992d8` | positions rows on the module; every `⏸` text mark → stroke icon (27a/27b/28/29); `literal()` tips keyboard-reachable; `pauseGlyph.spec.ts` (criterion 29); table/card render one datum one way; `EXEMPT` 12 → 6 |
| FE-6 | `5e1fa577` | positions header readout → `FigureCell` inside `PanelContainer`; `netPl.ts` five Net P/L states (closes the green `+$0` defect); `EXEMPT` 6 → 5 |
| FE-7 | `b2a8cf15` | Broker tab register conversion (`BrokerGroupHeader`, `BrokerPositionRow`, `BrokerPositionCard`, `ProvenanceHeader`, `reassess` + specs); `not provided` non-synonymy; pause icon; `EXEMPT` 5 → **0** |
| FE-7 follow-up | see `git log -1 -- apps/dashboard/src/app/features/trading/positions/pauseGlyph.spec.ts` | conductor: emptied `pauseGlyph.spec.ts`'s own `EXEMPT` map — its live check demanded it once FE-7 cleared both Broker sites |

**Conductor's cold re-check after FE-7 (2026-09-07):** `npm run typecheck` **0** · broker + positions + theme + figure
**70 files / 955 tests → 954 pass + the one stale-exemption failure, fixed above** (re-run of the affected suites after the
fix: see the follow-up commit) · `apps/api` three-dot diff **0 lines** · no `⏸` left in code anywhere under
`apps/dashboard/src/app` (doc-comments only). Lane 4's own measurements for FE-6 and FE-7 are in `BUILD_REPORT.md`
(§FE-6, §FE-7 — including what it saw in the running app).

## Next concrete step: **FE-8 — Settings**, then **FE-9 — alerts read-fault latch**, then **FE-10 — alerts UI**, in that order

Dispatch **one fresh Sonnet lane** for FE-8 → FE-10 (one commit per task). Inputs it must read: this file; `PLAN.md`
header + tasks FE-8/FE-9/FE-10 in full (**verify every cited line number with `grep -n` first — they drift**);
`SPEC.md` §2, §2.7, §3 D/E, §4.5, §4.6, §1 Out; `council/decisions.md` §3 #4 / #22, §4 D-B / D-D, §5, §8 (U-8);
`INTERFACE_CONTRACT.md` (alerts store rule); `BUILD_REPORT.md` for the format and FE-1's API notes.

What binds each task (restated from the rulings, not a substitute for reading them):
- **FE-8 Settings** — owner ruling **D-B: no settings section navigation** this phase; Settings keeps its 640px single
  column (`SettingsPage.tsx:156`); criterion = five sections reachable at every checked width with no page-body
  overflow. Figures → `FigureCell`; declared scales; **criterion 41**: the save confirmation loses green, the save-ERROR
  alert keeps `error` severity with its icon (a state, not a direction); never import the canvas footnote "Saved to your
  account." — `convexa.uiprefs.v1` is local (`features/auth/localPrefs.ts:15`). Face de-binding in `features/auth/` is
  proven by FE-8's component assertion (N-1's glob does not reach it; do not widen the glob).
- **FE-9 alerts latch (before any alerts UI change)** — `features/alerts/store.ts:41-49,59-68`: a parse failure resets
  to `empty()` and the next write overwrites the durable key — close that loss path with a read-fault latch (writes
  refused while the read is faulted, surfaced like positions' faulted posture `PositionRow.tsx:122-127`). Fixture authored
  from a **pre-phase** blob. `message` never deleted; **no shape change** to `AlertEvent`; idempotent; never throws.
- **FE-10 alerts UI** — `AlertsPage.tsx`: `:189` raw `r.kind` → closed `KINDS` label; `:192` fabricated
  `≥ ${r.scoreMin ?? 60}` → **`not set`** when absent, bare index (`≥ 72`, never a suffix) when present (47b); a **price
  threshold renders at all**, with its `$` prefix (47a — today it is written at `:48`, evaluated at `evaluate.ts:110`, and
  never shown); `:193` bare word `level` → **`not recorded`** (47d); tier-change row byte-identical; `:219-220` the unread
  marker is not an amber left edge alone (canon Banned "accent edge") — per SPEC §4.6; U-23a: post-phase firings build
  labels from the closed lookups (`evaluate.ts:73,94,116`), history is **not** re-labelled and the Recent list may not
  claim it was; user-entered thresholds render **Mono, no dotted rule** (D-D) — the F9 `· untraced` caption must be
  unreachable for them. Every literal is one of the closed nine (`shared/copy/notANumber.ts:26-36`).

Same lane rules as every lane this phase: scope only your tasks; never edit SPEC/PLAN/IC/decisions/`design/`/`apps/api`
or `features/trading/orders/OrderRow.tsx:172` (Z-1); every assigned mutation proof run red (quoted) then green; typecheck
+ targeted + lint exit codes per task; **run the app and look** (`npm run ports:free` → `npm run dev` → `/settings`,
`/alerts` at 1280 and 393) and say plainly what was not reachable; one commit per task with the `Co-Authored-By: Claude
Fable 5.1 <noreply@anthropic.com>` trailer; stage only your files; do not push; update this file for the next lane.

## `EXEMPT` maps (both live-checked on both arms)

- `shared/theme/fonts.spec.ts` (N-1, two needles): **0 entries** after FE-7. FE-14 asserts it empty.
- `features/trading/positions/pauseGlyph.spec.ts` (criterion 29): **0 entries** after the FE-7 follow-up.

## Gotchas (carried from lanes 2–4; do not rediscover)

1. **A price-merge bug in `Scanner.tsx`'s zero-state lead grouping was found and NOT fixed** (out of scope, filed as carried
   debt in `BUILD_REPORT.md` FE-4 §3) — `ScanTable` renders from `groups[*].rows` instead of the `rows` prop whenever
   `groups` is present. Still unfixed; not this lane's job.
2. **jsdom has no global `EventSource`.** Stub a controllable class (`ticker-hierarchy.spec.tsx:24-30`'s
   `SilentEventSource`, or FE-3/4's `CapturingEventSource`).
3. **Live-checked `EXEMPT` maps fail on BOTH arms** (file must exist AND still violate) — fixing a violation without
   deleting the entry red-builds. Do both in the same commit.
4. **The `MONO_BOUND` needle-1 regex windows ±6/+12 lines around ANY line naming `MONO`/`MONO_FACE`/`monoSx`/
   `monoFontFamily` — including inside a comment.** A doc-comment mentioning `` `no basis` `` or `` `—` `` in backticks near
   a mono-styled line reads as a violation. Fix: reword the comment (drop the backticks) or name the string as a constant —
   never restyle the render to dodge a heuristic.
5. **Scripted `sed`/heredoc edits risk silently no-op'ing on CRLF files.** Use the Edit tool; grep-verify after any scripted
   replace.
6. **`npm run ports:free`** at the start and the end of any app-verification pass (both IPv4 and `[::1]`).
7. **Seeding a populated `/positions` in a fresh `npm run dev` is a two-step trap.** The demo account only auto-populates
   when the backend reports `demoSeed` active (`SEED_TEST_ACCOUNT`) — a bare `npm run dev` does not. Sign UP a throwaway
   account. Then: visiting `/positions` once writes an empty `convexa.positions.v3`, after which no source is read again —
   so `localStorage.removeItem('convexa.positions.v3')` in the SAME `page.evaluate` that seeds `convexa.positions.v2`
   (shape: `{ schema_version: 2, positions: { [id]: PositionRecord }, decisions: [] }` — an object map, not an array),
   before the reload.
8. **Forcing a live SSE drop against the real dev backend is unreliable in lane time** (`page.route('**/api/stream/**',
   abort)` + reload did not flip `offline-banner` within 60 s, twice). The `EventSource`-stub tests are the reliable coverage
   for every offline arm; the browser pass is for reachable states — say so explicitly.
9. **Scratch files:** never at the repo root — use the session scratchpad / OS temp dir; delete before finishing.
10. **NEW (FE-7): a task's targeted run must include every spec file whose `EXEMPT` map names that task.** FE-7 cleared
    `⏸` from the broker files but never ran `features/trading/positions/pauseGlyph.spec.ts`, whose live check then failed
    in the conductor's cold check. Before committing: `grep -rln "FE-<n>" apps/dashboard/src --include=*.spec.*` and run
    every file it names.

## Remaining arc (unchanged from PLAN, for orientation)

FE-8 (settings) → FE-9 (alerts latch) → FE-10 (alerts UI) → FE-11 (the eight quiet-band widgets) → FE-12 (D-C: `Widget`
frame ⓘ via `AccessibleHelp` promoted to `shared/`, AC-35 extended to all eight `widget-{id}` frame roots, desk specs
re-run) → FE-13 (browser/e2e layer; Playwright `testMatch` allowlist extension — a spec not listed there never runs) →
FE-14 (frontend closer: whole-phase verification, both `EXEMPT` maps asserted empty, full suite + e2e against the
production build) → BE-1 (backend verification only: three-dot `apps/api` diff 0, score/tier/fingerprint byte-identical)
→ GATE Q.
