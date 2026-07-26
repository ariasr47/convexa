# Scanner v1 — Plan 4 of 4: the `/scanner` frontend page (dense terminal table · four honest states · gated view editor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/scanner` coming-soon stub with the real surface — a dense, honest, terminal-grade triage table that **CONSUMES** P3's wire (`GET /api/scan` · `/api/scan/universe` · `/api/scan/view` · the server-gated `PUT /api/scan/view`) through four new `libs/api` fetchers, renders the **locked 11-column set** (score-desc default, compact density, sticky Symbol + header, nulls as `—`), collapses to **cards `<sm`**, expresses the **four honest states** (skeleton · empty view · worker-down banner over intact rows · per-row `ok`/`stale`/`error`/`building` via a **closed lookup**), and saves a per-account view through a **server-gated write** (`useGate` → the real 403 → sign-in prompt → nothing written locally). Closes the P3 QA report's **DEFERRED-TO-P4** items: AC-11 in full and the visual halves of AC-1 / AC-7 / AC-8 / AC-9 / AC-12.

**Architecture:** FE-only phase — **the `apps/api` diff must be EMPTY** (the structural proof of `[additive-keeps-score-byte-identical]` for this phase). Three layers, dependency-direction downward only per `apps/dashboard/src/app/README.md`: (1) `libs/api` (`scope:shared`) gains the typed scanner fetchers + types, consumed via `@org/api`; (2) `shared/` gains **exactly two promotions on the 2nd-consumer rule** — `TintChip` → `shared/ui/`, `useFlashOnChange` → `shared/hooks/` — so `pages/scanner/` never imports `pages/ticker/` (**pages never import sibling pages**); (3) everything scanner-specific lives in `pages/scanner/` as small focused files (pure `format.ts`/`labels.ts` → `useScan.ts` data hook → `ScanCells`/`ScanTable`/`ScanCard` → `ScanToolbar`/`ViewEditorDialog` → `Scanner.tsx` shell). The page is **poll-based** (`SCAN_POLL_MS = 30_000`, one stable interval, auto-paused when the tab is hidden) — **no SSE, no per-row stream, never the word "live"**. The only motion is the sanctioned `useFlashOnChange` price flash, which reuses the already-allowlisted dynamic `flash-*` keyframe family — **no 6th keyframe family is introduced** (the app-wide inventory is set-equality pinned and adding one is build-breaking).

**Tech Stack:** React 19 + Vite + MUI 7 (`sx` + theme tokens only), `react-router-dom` (`RouterLink` / `useNavigate`), `@org/api` (the source-consumed shared client), Vitest + Testing Library (`nx test @org/dashboard`), Cypress (`nx e2e dashboard-e2e`, the 393px no-overflow route set). No new npm dependency.

## Global Constraints

Every task's requirements implicitly include these (copied verbatim in force from `.claude/contracts/scanner/UX_BLUEPRINT.md` §0–§6, `INTERFACE_CONTRACT.md` §2–§4, `PRODUCT_CONTRACT.md` §4/§7, `docs/design/DESIGN_SYSTEM.md`, the `convexa-design` skill, and `apps/dashboard/src/app/README.md`):

- **`[theme-token-discipline]` (HARD).** Every color goes through the MUI theme / `shared/theme/tokens.ts`. **Zero hardcoded hex** in any new file — `hex-discipline.spec.ts` globs `pages/**`, `features/**`, `shell/**`, `shared/ui/**` and will fail the build on one. Mode-aware values resolve through **`extrasFor(theme)` inside an `sx`/styled callback** — bare `extras.` / `extrasLight.` dark-locks the surface and is flagged by `stage3-amber.spec.ts`'s mutation-guarded `bareExtras` checker. Dark/light parity is part of done.
- **`[digested-labels-not-raw-dump]` (HARD).** `status` / `tier` / `regime` / `vol_regime` render through a **fixed closed lookup in `pages/scanner/labels.ts`** and are **never re-derived** from a scalar. An unknown value renders the **fail-honest unavailable** meta — never a guess, never a raw enum dump. No raw series ever rides a row.
- **`[model-read-carries-its-assumptions]` (HARD).** Every row is self-describing: per-row `as_of` + `status`, plus the page-level two-speed header. **The `building` `as_of` trap is the sharp edge** — INTERFACE §3.1 PINS that a synthesized `building` row carries a **non-null `as_of` that is NOT a freshness claim**, so the FE **MUST branch on `status === 'building'` BEFORE rendering "Updated"**. This is enforced by a unit test on `updatedText()` and by a render test on a `building` row whose `as_of` is a real recent epoch.
- **`[live-vs-static-isolation]` (HARD).** The scan surface is **poll-based**: plain REST reads on a stable interval. **No SSE, no `EventSource`, no `streamTicker`, no per-row stream.** The **word "live" never appears** anywhere the scanner renders or in its sources. The **only** motion is the sanctioned price-change flash via `useFlashOnChange` + `flashColorSx`, which honors `useReducedMotion` through the shared hook.
- **Motion consolidation (HARD, build-breaking).** `shared/theme/single-motion-moment.spec.ts` asserts the app-wide `@keyframes` inventory is **SET-EQUAL** to `{liveDotPulse, widgetLivePulse, ordersWatchPulse}` + the dynamic `flash-*` family (one declaring file) + emotion `keyframes` (HeroCurve only). **No scanner file may declare a `@keyframes`** — reuse `flashColorSx`; skeletons use MUI `<Skeleton>` (its pulse is MUI-internal, the `StatSkeleton` precedent).
- **`[server-side-gate-enforcement]` (HARD).** The view save goes through `useGate().guard(...)`; `saveScanView` **is** the server gate (`PUT /api/scan/view` returns a real 403 `auth_required` signed-out). Signed-out ⇒ `guard` shows `SignInPrompt` and **never runs the write**; a stale-cookie 403 ⇒ the `AuthError` aborts before any state mutation. **Nothing is ever written locally** — the scanner keeps **zero** `localStorage`/durable state. The FE check is UX only; the server is the boundary of record.
- **`[no-real-order-path]` (HARD).** Display + navigation only. A row/card click **navigates to `/ticker/{SYMBOL}` and does nothing else** — no order, no trade, no broker call, no POST of any kind.
- **`[additive-keeps-score-byte-identical]` (HARD, structural proof).** This is an **FE-only phase**: `git diff --stat apps/api/` must be **EMPTY** at every commit. The scanner **consumes** score/tier/regime/vol/flip/walls/distances exactly as the wire delivers them and re-derives nothing (AC-10).
- **convexa-design colour rules (HARD).** **Green/red are for PRICE DIRECTION only** — bound to `chg_pct` alone. **Score, distances-to-flip/wall, wall levels, flip level, regime, vol-regime are NEUTRAL** (`text.primary` / `text.secondary`) — a tinted proximity/rate is the exact regression class the Stage-3 sweep caught. **Tier is the row's single amber spend**: `<TintChip tone="emphasis">` (text-grade `textAmber` via `extrasFor`). No amber anywhere else on a row. True warnings (per-row `stale`/`error`, the worker-down banner) bind `warning.*` **and always carry a glyph/icon** — hue alone never carries "warning".
- **Type + touch floors.** Every chip/label ≥ **11px** (`0.6875rem`; `type-floor.spec.tsx` scans `pages/**`, `features/**`, `shell/**`, `shared/ui/**`). Row/card tap targets ≥ **44px**. Every interactive element gets a visible authored `:focus-visible` ring (supplied globally by the theme's `MuiCssBaseline` override — do **not** set `outline: 'none'` without an in-file replacement).
- **Mobile is a first-class terminal.** **No horizontal overflow at 393px**; the table collapses to **cards `<sm`**; wide desktop content scrolls inside its own `overflow-x: auto` container, never the page body. `/scanner` **joins** the Cypress 393px no-overflow route set.
- **FE structure map (`apps/dashboard/src/app/README.md`, binding).** Dependency direction is **downward only** (`pages/` + `features/` → `shared/`); **pages NEVER import sibling pages**; `shared/` is populated **on the 2nd consumer**; folder-per-widget. `@/*` aliases `src/app/*`.
- **Wire fidelity.** Field names/types/presence come from `INTERFACE_CONTRACT.md` §2 verbatim (the FIXED P1 `ScanRow.to_wire()` / `SweepHeartbeat.to_wire()` keys). **No invented keys**, no renames; every numeric field is nullable and renders `—` (em-dash) when null — **never `0`**, never a fabricated value.
- **Testing convention (risk-based, `.claude/agents/qa-verify.md` §4 as amended 2026-07-13).** **NOT one test per AC.** Test the invariants / negative space / silently-regressing behavior; verify visible+intentional things (copy, presence, ordering) by review. The set is enumerated in `UX_BLUEPRINT.md` §6 — **P4 implements exactly that set and does not re-scope it.**
- **Testing gotchas (learned, verbatim).** MUI `sx` compiles to **classes** — **NEVER** assert `getAttribute('style')` (always empty; the vacuous-assertion trap). Use className identity or the injected `<style>` CSS text. `?raw` source scans **MUST be mutation-tested** (a scan that can't fail is worthless). `useMediaQuery` takes the **STRING** form (`theme.breakpoints.down('sm')`); jsdom has no `matchMedia` ⇒ `false` ⇒ desktop table, so narrow-layout tests stub `matchMedia` (the `positions-stage0.spec.tsx` idiom). The dashboard suite has **2 known timing-flaky specs** — a clean rerun is the tiebreaker. `npx nx lint @org/dashboard` carries **29 pre-existing warnings** (warnings ≠ errors; do not "fix" unrelated ones).

## Open decisions (surface to the owner; do not block this plan)

1. **GATE-Z flag — `UX_BLUEPRINT` §2.1 and §3.1 contain the word "live", which AC-9 forbids on this surface.** The pinned two-speed gloss ends *"…This is a polled snapshot, not a live feed."* and the `error` tooltip ends *"…the rest of the table is live-scored on the stated cadence."* — both sit **directly under** §2.1's own sentence *"The word 'live' is forbidden here and everywhere on the table."* and under AC-9. That is an internal contradiction in the locked design authority, and it makes the AC-9 negative-space test (a structural + DOM scan for `\blive\b`) unenforceable as written. **This plan ships the intent with the banned token removed**: *"…This is a polled snapshot, not a real-time feed."* and *"…the rest of the table is scored on the stated cadence."* Everything else is verbatim. **Owner: confirm the two reworded clauses** (or drop the AC-9 word-ban to "no affirmative live claim", which would let the verbatim gloss stand but weakens the mechanical test).
2. **GATE-Z flag — the worker-down engagement threshold is under-specified.** `UX_BLUEPRINT` §2.3 engages the banner when the heartbeat is "behind/missing" and `INTERFACE_CONTRACT` §4 delegates the age computation to the FE, but **neither pins a number**. This plan locks **`SWEEP_DOWN_AFTER_S = 180`** (3 minutes ≈ one baseline slow pass at N=100, D4) as a named, single-sourced FE display constant, with `sweep === null` also engaging it. **Owner: confirm 180s**, or pin a value in the contract.
3. **GATE-Z flag — `{X}` in "Sweep last ran {X} ago" has no source when `sweep_last_completed` is `null`.** A heartbeat can exist (`updated_at` present) with **no completed pass yet** (`sweep_last_completed: null`), and the FE then has no honest "last ran" epoch. This plan resolves it inside the two pinned copy variants: engagement is decided on `updated_at`, and the `{X}` variant is used **only** when `sweep_last_completed != null`; otherwise the "Sweep hasn't reported yet" variant renders (honest: no completed pass has been reported). **Owner: confirm.**
4. **The two `shared/` promotions (RESOLVED here; recorded for transparency, not a GATE-Z).** `TintChip` and `useFlashOnChange` live in `pages/ticker/widgets/_kit/`. `/scanner` is their **2nd consumer**, and the README's rules — *"pages never import sibling pages"* + *"populate on 2nd consumer"* — make promotion to `shared/ui/` and `shared/hooks/` the only conforming move. Task 2 moves them, keeps `_kit/index.ts` re-exporting so every existing ticker import path is byte-unchanged, and re-points the two structural scans that pin their file paths (`single-motion-moment.spec.ts` `FLASH_HOME`, `stage3-amber.spec.ts` `TEXT_AMBER_CONSUMERS`). `StatTile` and `copy.ts` stay ticker-local (still one consumer).
5. **`Widget` is deliberately NOT used for the scan table (RESOLVED here).** `DESIGN_SYSTEM.md` names `Widget` as the bento shell; `UX_BLUEPRINT` §0 specifies a **page-level dense table**, not a bento widget. `Widget` carries widget-selection context and a `widgetLivePulse` live-status treatment that this surface must not have (`[live-vs-static-isolation]` — no live semantics on the scan table). `StatTile`/`TintChip`/`useFlashOnChange` **are** used per the DESIGN_SYSTEM authority.
6. **Project name.** The verification convention cites `nx test dashboard`; the actual Nx project is **`@org/dashboard`** (`npx nx show projects` → `["dashboard-e2e","@org/dashboard","@org/api","api",".claude"]`). Every command below uses the real name.

## File Structure

```
libs/api/src/lib/convexa.ts                       # + Scanner v1 types + 4 fetchers (getScan/getScanUniverse/
                                                  #   getScanView/saveScanView) — re-exported by src/index.ts's `export *`
libs/api/src/lib/convexa.spec.ts                  # + the scanner-client describe block

apps/dashboard/src/app/shared/ui/TintChip.tsx          # MOVED from pages/ticker/widgets/_kit (2nd-consumer promotion)
apps/dashboard/src/app/shared/ui/TintChip.spec.tsx     # MOVED (import re-pointed to './TintChip')
apps/dashboard/src/app/shared/ui/index.ts              # + TintChip export
apps/dashboard/src/app/shared/hooks/useFlashOnChange.ts       # MOVED from _kit
apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.tsx # MOVED
apps/dashboard/src/app/shared/hooks/index.ts           # + useFlashOnChange export
apps/dashboard/src/app/pages/ticker/widgets/_kit/index.ts     # re-exports the two from their new homes (zero call-site churn)
apps/dashboard/src/app/pages/ticker/widgets/_kit/StatTile.tsx           # import re-pointed
apps/dashboard/src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx    # import re-pointed
apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx     # import re-pointed
apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx      # import re-pointed
apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx  # import re-pointed
apps/dashboard/src/app/pages/ticker/widgets/setups/Setups.tsx           # import re-pointed
apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts        # FLASH_HOME re-pointed
apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts                # TintChip path re-pointed; the 2 scanner-stub entries removed

apps/dashboard/src/app/pages/scanner/
  labels.ts              # NET-NEW · the CLOSED lookups + ALL pinned user-facing copy (UX §2/§3)
  format.ts              # NET-NEW · pure display transports (relAge/coarseAge/dash/signedPct/updatedText/sortRows/sweepBanner)
  format.spec.ts         # NET-NEW · the pure-unit suite (incl. the `building` as_of trap)
  useScan.ts             # NET-NEW · the page data hook (poll + visibility auto-pause + view drafts + the gated save)
  useScan.spec.tsx       # NET-NEW · hook-level: cadence, auto-pause, degrade, the gated write
  ScanCells.tsx          # NET-NEW · the shared per-datum presentational atoms (table + card compose them)
  ScanTable.tsx          # NET-NEW · the ≥sm dense table (sticky header + sticky Symbol column)
  ScanCard.tsx           # NET-NEW · the <sm card collapse
  ScanToolbar.tsx        # NET-NEW · sort/density controls + Edit view + the sign-in prompt host
  ViewEditorDialog.tsx   # NET-NEW · universe-constrained subset select + reorder + name + the gated save
  Scanner.tsx            # REPLACED · the page shell: header, the four states, layout switch
  scanner.risk.spec.tsx  # NET-NEW · the risk-based suite (UX §6)
  scanner.spec.tsx       # DELETED (the coming-soon stub's suite)

apps/dashboard/src/app/app.risk.spec.tsx                 # + /api/scan* in the strict fetch mock; testid rename
apps/dashboard/src/app/pages/positions/positions-page.spec.tsx  # + /api/scan* in the strict fetch mock; testid rename
apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts      # + /api/scan* intercepts; /scanner ready marker + the card-collapse assert
```

Each new file has one responsibility: `labels.ts` is copy + closed lookups (no logic), `format.ts` is pure transports (no React), `useScan.ts` is the only fetcher/state owner, the three render files are presentational, and `Scanner.tsx` composes. **`apps/api/` gets ZERO edits.**

---

### Task 1: The `libs/api` scanner fetchers + types (consume `INTERFACE_CONTRACT` exactly)

> Item **1**. Adds the four typed fetchers + their types to the shared client in the existing house idiom (`getTicker`/`fetchTrackedContract`/`saveSettings`/`simTradeGate`). Reads reject on a transport fault so the caller degrades (the `getSession` precedent); the WRITE throws a typed `AuthError` so `useGate` can translate a real 403 into the sign-in prompt. **No invented keys** — every field name/type is copied from `INTERFACE_CONTRACT.md` §2. RED→GREEN on the gated-write error mapping.

**Files:**
- Modify: `libs/api/src/lib/convexa.ts` (append a Scanner v1 section after `simTradeGate`, before the `LiveUpdate` SSE block at ~line 679)
- Modify: `libs/api/src/lib/convexa.spec.ts` (append the scanner describe block)

**Interfaces:**
- Produces (Tasks 3–8 consume these via `@org/api`; `libs/api/src/index.ts` already does `export * from './lib/convexa'`):
  - `type ScanStatus = 'ok' | 'stale' | 'error' | 'building'`
  - `interface ScanRow` — the 14 FIXED P1 wire keys
  - `type ScanSortKey`, `interface ScanViewSort`, `type ScanDensity`, `interface ScanView`
  - `interface SweepHeartbeat`, `interface ScanResponse`, `interface ScanUniverse`, `interface ScanViewWrite`
  - `getScan(): Promise<ScanResponse>` · `getScanUniverse(): Promise<ScanUniverse>` · `getScanView(): Promise<ScanView>` · `saveScanView(view: ScanViewWrite): Promise<ScanView>`

- [ ] **Step 1: Add the Scanner v1 types + fetchers to `convexa.ts`**

In `libs/api/src/lib/convexa.ts`, insert this block **immediately after** the `simTradeGate` function (which ends at the `}` on line 677) and **before** the `/** Live payload pushed over SSE ... */` comment:

```ts
// ---- Scanner v1 (scanner INTERFACE_CONTRACT §2–§3) ---------------------------------------------
// The scan surface is POLL-BASED: four plain REST calls, NO SSE, NO per-row stream
// (`[live-vs-static-isolation]`). Three anonymous-open READS (always 200 server-side; a transport
// fault REJECTS here so the caller degrades to its last-known rows) + one server-gated WRITE (a real
// 403 `auth_required` signed-out — `[server-side-gate-enforcement]`; the FE check is UX only).
// Every field name/type below is the FIXED P1 wire (`ScanRow.to_wire()` / `SweepHeartbeat.to_wire()`)
// as pinned in INTERFACE §2 — do NOT rename or add keys.

/** The closed per-row status vocabulary (INTERFACE §2.2). The FE renders it via a CLOSED LOOKUP and
 *  never re-derives it; an unknown value is treated as unavailable (fail-honest), never guessed. */
export type ScanStatus = 'ok' | 'stale' | 'error' | 'building';

/** One scan row. EVERY numeric field is nullable (a partial/failed compute still yields an honest
 *  row) and renders as honestly-missing — never `0`, never a fabricated value. No raw series ever
 *  rides a row (`[digested-labels-not-raw-dump]`). */
export interface ScanRow {
  symbol: string; //                    canonical UPPER-case
  price: number | null; //              last poll price
  chg_pct: number | null; //            % change since prior session close
  score: number | null; //              opportunity_score — CONSUMED, never re-derived
  tier: string | null; //               opportunity_tier enum (closed FE lookup)
  regime: string | null; //             regime label enum (closed FE lookup)
  vol_regime: string | null; //         vol-regime label enum (closed FE lookup)
  flip: number | null; //               gamma flip level
  dist_to_flip_pct: number | null; //   signed % of price to the flip (display transport)
  call_wall: number | null;
  put_wall: number | null;
  dist_to_wall_pct: number | null; //   signed % of price to the NEARER wall
  /** Epoch-SECONDS of the compute that produced the row. NOT nullable — and for a synthesized
   *  `building` row it is NOT a freshness claim, so the FE MUST branch on `status === 'building'`
   *  BEFORE rendering any "Updated …" text (INTERFACE §3.1, PINNED). */
  as_of: number;
  status: ScanStatus;
}

/** The closed sortable-key set the FE may offer (INTERFACE §2.3). Sorting is a CLIENT-SIDE re-order
 *  of the returned rows; it never re-derives a value and never refetches. */
export type ScanSortKey =
  | 'score'
  | 'symbol'
  | 'price'
  | 'chg_pct'
  | 'dist_to_flip_pct'
  | 'dist_to_wall_pct';
export interface ScanViewSort {
  key: ScanSortKey;
  dir: 'asc' | 'desc';
}
export type ScanDensity = 'compact' | 'comfortable';

/** The caller's effective view. `symbols` IS the display ordering. */
export interface ScanView {
  source: 'account' | 'default'; //  where THIS response's view came from
  authenticated: boolean; //         whether the caller is signed in
  name: string | null; //            optional user label; null for the default view
  symbols: string[]; //              subset ⊆ universe, IN DISPLAY ORDER
  sort: ScanViewSort; //             default { key: 'score', dir: 'desc' }
  density: ScanDensity; //           default 'compact'
}

/** Sweep metadata (INTERFACE §2.4). The FE derives "sweep last ran X ago" from these epochs vs its
 *  own clock; the wire carries NO pre-rendered freshness copy. */
export interface SweepHeartbeat {
  updated_at: number; //                   last worker tick (epoch seconds)
  sweep_last_completed: number | null; //  epoch seconds of the last COMPLETED full pass, or null
  universe_size: number; //                symbols the worker is tracking
}

/** `GET /api/scan` (INTERFACE §3.1). Every symbol in `view.symbols` is present in `rows`
 *  (building-fill) — the screen is never dead. `sweep` is null iff the worker never wrote one. */
export interface ScanResponse {
  view: ScanView;
  rows: ScanRow[];
  sweep: SweepHeartbeat | null;
}

/** `GET /api/scan/universe` (INTERFACE §3.2). Read-only — v1 has no add/request/remove path. */
export interface ScanUniverse {
  symbols: string[];
  universe_size: number;
}

/** `PUT /api/scan/view` body (INTERFACE §3.4). `symbols` is required and must be a subset of the
 *  CURRENT universe, in display order; the server 422s anything else. */
export interface ScanViewWrite {
  symbols: string[];
  name?: string | null;
  sort?: ScanViewSort;
  density?: ScanDensity;
}

/** GET /api/scan — the requested-or-default view as slim rows + sweep metadata. Anonymous-open;
 *  server-side it is best-effort ALWAYS 200 (a store outage degrades CONTENT, never the status), so a
 *  non-2xx here means a TRANSPORT/proxy fault: we reject and the caller keeps its last-known rows. */
export async function getScan(): Promise<ScanResponse> {
  const res = await fetch('/api/scan', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Scan read failed (${res.status})`, res.status);
  return (await res.json()) as ScanResponse;
}

/** GET /api/scan/universe — the read-only owner-curated universe for the view editor. */
export async function getScanUniverse(): Promise<ScanUniverse> {
  const res = await fetch('/api/scan/universe', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`Universe read failed (${res.status})`, res.status);
  return (await res.json()) as ScanUniverse;
}

/** GET /api/scan/view — the caller's effective view. Anonymous ALWAYS gets a readable default; a
 *  READ is never gated. (The page reads the view off `getScan()`; this exists for the editor's
 *  reconciliation + parity with the wire.) */
export async function getScanView(): Promise<ScanView> {
  const res = await fetch('/api/scan/view', { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`View read failed (${res.status})`, res.status);
  return (await res.json()) as ScanView;
}

/** The scan-view WRITE's error envelope differs by status: 403/503 use the auth `{error, message}`
 *  envelope, while the 422 validation refusal uses FastAPI's `{detail}`. Map both into the typed
 *  `AuthError` so `useGate` can translate `auth_required` → the sign-in prompt, `auth_unavailable` →
 *  the degraded copy, and re-throw `validation` to the caller's own inline handling. */
async function toScanViewError(res: Response): Promise<AuthError> {
  if (res.status === 422) {
    let detail = 'That view is not valid.';
    try {
      const body = (await res.clone().json()) as { detail?: string };
      if (body && typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* no/garbled body — keep the safe fallback */
    }
    return new AuthError('validation', detail, 422);
  }
  return toAuthError(res);
}

/** PUT /api/scan/view — the ONE server-gated, state-bearing scanner action
 *  (`[server-side-gate-enforcement]`). Signed-in ⇒ 200 echoing the SAVED view (server-wins).
 *  Signed-out ⇒ a REAL 403 `auth_required` even if the FE guard is bypassed/absent, and NOTHING is
 *  persisted (AC-3). Off-universe symbol / bad sort / bad density ⇒ 422 `validation` (AC-13).
 *  Auth-subsystem fault ⇒ 503 `auth_unavailable`. Never touches the bundle/SSE path. */
export async function saveScanView(view: ScanViewWrite): Promise<ScanView> {
  const res = await fetch('/api/scan/view', {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'same-origin',
    body: JSON.stringify(view),
  });
  if (!res.ok) throw await toScanViewError(res);
  return (await res.json()) as ScanView;
}
```

- [ ] **Step 2: Write the failing client tests**

Append to `libs/api/src/lib/convexa.spec.ts`:

```ts
// ---- Scanner v1 client (scanner INTERFACE_CONTRACT §2–§3) --------------------------------------
describe('scanner client', () => {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  const VIEW: ScanView = {
    source: 'default',
    authenticated: false,
    name: null,
    symbols: ['SPY', 'QQQ'],
    sort: { key: 'score', dir: 'desc' },
    density: 'compact',
  };

  it('getScan hits the poll endpoint same-origin and returns the envelope untouched', async () => {
    const body: ScanResponse = {
      view: VIEW,
      rows: [
        {
          symbol: 'SPY',
          price: 500,
          chg_pct: 1.2,
          score: 82,
          tier: 'prime',
          regime: 'positive_gamma',
          vol_regime: 'iv_rich',
          flip: 495,
          dist_to_flip_pct: 1,
          call_wall: 510,
          put_wall: 490,
          dist_to_wall_pct: -2,
          as_of: 1000,
          status: 'ok',
        },
      ],
      sweep: { updated_at: 1000, sweep_last_completed: 990, universe_size: 25 },
    };
    const f = vi.fn(async () => json(body));
    vi.stubGlobal('fetch', f);
    await expect(getScan()).resolves.toEqual(body);
    expect(f).toHaveBeenCalledWith('/api/scan', { credentials: 'same-origin' });
  });

  it('getScan rejects with ApiError on a TRANSPORT fault (server-side it is always 200)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ detail: 'bad gateway' }, 502)));
    await expect(getScan()).rejects.toBeInstanceOf(ApiError);
  });

  it('getScanUniverse returns the read-only universe envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ symbols: ['SPY', 'QQQ'], universe_size: 2 })));
    await expect(getScanUniverse()).resolves.toEqual({ symbols: ['SPY', 'QQQ'], universe_size: 2 });
  });

  it('saveScanView PUTs the body and returns the server-wins echo', async () => {
    const saved: ScanView = { ...VIEW, source: 'account', authenticated: true, name: 'Morning' };
    const f = vi.fn(async () => json(saved));
    vi.stubGlobal('fetch', f);
    await expect(saveScanView({ symbols: ['SPY', 'QQQ'], name: 'Morning' })).resolves.toEqual(saved);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/scan/view');
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(String(init.body))).toEqual({ symbols: ['SPY', 'QQQ'], name: 'Morning' });
  });

  it('saveScanView maps the gated refusals: 403 -> auth_required, 503 -> auth_unavailable, 422 -> validation(detail)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'auth_required', message: 'sign in' }, 403)),
    );
    await expect(saveScanView({ symbols: ['SPY'] })).rejects.toMatchObject({
      name: 'AuthError',
      code: 'auth_required',
      status: 403,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'auth_unavailable', message: 'down' }, 503)),
    );
    await expect(saveScanView({ symbols: ['SPY'] })).rejects.toMatchObject({
      code: 'auth_unavailable',
    });

    // The 422 uses FastAPI's `{detail}` envelope, NOT the auth `{error,message}` one.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ detail: "'ZZZZ' is not in the tracked universe." }, 422)),
    );
    await expect(saveScanView({ symbols: ['ZZZZ'] })).rejects.toMatchObject({
      code: 'validation',
      message: "'ZZZZ' is not in the tracked universe.",
    });
  });
});
```

Extend the file's existing import line so the new symbols resolve (the spec imports from `./convexa`):

```ts
import {
  ApiError,
  getScan,
  getScanUniverse,
  saveScanView,
  type ScanResponse,
  type ScanView,
} from './convexa';
```

(Merge these names into the file's existing `import { … } from './convexa';` statement rather than adding a second one.)

- [ ] **Step 3: RED — run the new tests before the fetchers exist**

Temporarily comment out the whole `export async function saveScanView` body's `return` line and replace it with `throw new Error('not implemented');`, then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/api
```
Expected: FAIL — `saveScanView PUTs the body and returns the server-wins echo` reports `Error: not implemented`. **Restore** the real body.

- [ ] **Step 4: GREEN**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/api
```
Expected:
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```
(13 pre-existing + the 5 added.)

- [ ] **Step 5: Prove the backend was not touched**

```bash
cd C:/Dev/gammaflow-web && git status --porcelain apps/api/ && echo "APPS/API CLEAN: $(git diff --stat apps/api/ | wc -l) changed lines"
```
Expected: no `apps/api/` paths listed, then `APPS/API CLEAN: 0 changed lines` — `[additive-keeps-score-byte-identical]`, FE-only phase.

- [ ] **Step 6: Commit**

```bash
git add libs/api/src/lib/convexa.ts libs/api/src/lib/convexa.spec.ts
git commit -m "feat(scanner): libs/api scanner fetchers + types (getScan/getScanUniverse/getScanView/saveScanView) consuming the P3 wire"
```

---

### Task 2: Promote `TintChip` → `shared/ui/` and `useFlashOnChange` → `shared/hooks/` (the 2nd-consumer rule)

> The structural prerequisite for the whole page: `/scanner` needs the tier chip + the sanctioned price flash, and **pages never import sibling pages** (`apps/dashboard/src/app/README.md`). The README's own answer is *"`shared/` — populate on 2nd consumer"*. This task **moves** the two modules (and their specs), keeps `_kit/index.ts` re-exporting them so every existing ticker-widget import path is byte-unchanged, and **re-points the two structural scans that pin their file paths**. RED→GREEN is the `single-motion-moment` set-equality scan: it goes red the moment `useFlashOnChange.ts` moves, and green only when `FLASH_HOME` is re-pointed.

**Files:**
- Create (moved): `apps/dashboard/src/app/shared/ui/TintChip.tsx`, `apps/dashboard/src/app/shared/ui/TintChip.spec.tsx`, `apps/dashboard/src/app/shared/hooks/useFlashOnChange.ts`, `apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.tsx`
- Delete: `apps/dashboard/src/app/pages/ticker/widgets/_kit/TintChip.tsx`, `.../_kit/TintChip.spec.tsx`, `.../_kit/useFlashOnChange.ts`, `.../_kit/useFlashOnChange.spec.tsx`
- Modify: `apps/dashboard/src/app/shared/ui/index.ts`, `apps/dashboard/src/app/shared/hooks/index.ts`, `.../_kit/index.ts`, `.../_kit/StatTile.tsx`, `.../_kit/type-floor.spec.tsx`, `.../widgets/chrome/TickerHeader.tsx`, `.../widgets/live-tape/LiveTape.tsx`, `.../widgets/off-exchange-blocks/OffExchangeBlocks.tsx`, `.../widgets/setups/Setups.tsx`, `apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts`, `apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (Tasks 5–7 consume):
  - `@/shared/ui/TintChip` → `TintChip({ tone: 'success'|'error'|'info'|'warning'|'neutral'|'emphasis'; label: string })` — **file content unchanged byte-for-byte**.
  - `@/shared/hooks/useFlashOnChange` → `useFlashOnChange(value, { active, tone?, durationMs? }): FlashState | null`, `flashColorSx(flash): sx-fragment`, `type FlashTone`, `interface FlashState` — **file content unchanged byte-for-byte**.
  - `pages/ticker/widgets/_kit` keeps exporting both names (zero call-site churn for the ticker page).

- [ ] **Step 1: Move the four files (content unchanged)**

```bash
cd C:/Dev/gammaflow-web
git mv apps/dashboard/src/app/pages/ticker/widgets/_kit/TintChip.tsx           apps/dashboard/src/app/shared/ui/TintChip.tsx
git mv apps/dashboard/src/app/pages/ticker/widgets/_kit/TintChip.spec.tsx      apps/dashboard/src/app/shared/ui/TintChip.spec.tsx
git mv apps/dashboard/src/app/pages/ticker/widgets/_kit/useFlashOnChange.ts    apps/dashboard/src/app/shared/hooks/useFlashOnChange.ts
git mv apps/dashboard/src/app/pages/ticker/widgets/_kit/useFlashOnChange.spec.tsx apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.tsx
```

No content edit is needed in any of the four: `TintChip.tsx` already imports `extrasFor` from `@/shared/theme/tokens`, `useFlashOnChange.ts` already imports `@/shared/hooks/useReducedMotion`, and both specs import `'./TintChip'` / `'./useFlashOnChange'`, which resolve at the new locations.

- [ ] **Step 2: Add the two barrel exports**

`apps/dashboard/src/app/shared/hooks/index.ts` — replace the whole file:

```ts
export * from './useReducedMotion';
// Promoted from `pages/ticker/widgets/_kit` on its 2nd consumer (the /scanner price cell) — the
// app README's "shared/ — populate on 2nd consumer" rule; `pages/` never imports a sibling page.
export * from './useFlashOnChange';
```

`apps/dashboard/src/app/shared/ui/index.ts` — replace the scope-note paragraph and add the export. The new file:

```ts
/**
 * `ui/` — shared presentational primitives (ARCHITECTURE §2.1/§2.2). Pure presentation, props in →
 * MUI out, import-only-downward (feature surfaces import these; never the reverse).
 *
 * Scope note: primitives land here when they earn a SECOND consumer (the app README's
 * "populate on 2nd consumer" rule). `TintChip` was promoted from `pages/ticker/widgets/_kit` when
 * `/scanner` became its second consumer — `pages/` may never import a sibling page. `StatTile` and
 * the ticker `copy` map stay ticker-local (still one consumer each).
 *
 * DELIBERATELY NOT exported here (redesign-stage-2 §8-1): `arc.ts` (the convex-arc primitive) and
 * `ArcDivider.tsx` — their importer sets are pinned by scan (arc.spec.ts), so consumers import the
 * module paths directly; a barrel re-export would blind the scan. (The old hero motif was DELETED
 * at stage 2 — absorbed into the landing's HeroCurve moment.)
 */
export { ComingSoonBox, type ComingSoonBoxProps } from './ComingSoonBox';
export { ComingSoonBadge, ComingSoonCard, type ComingSoonCardProps } from './ComingSoonCard';
export { Jargon, type JargonProps } from './Jargon';
export { TintChip } from './TintChip';
export { ValueCard, type ValueCardProps } from './ValueCard';
export * from './Widget';
```

- [ ] **Step 3: Re-point `_kit` so every existing ticker import path is byte-unchanged**

`apps/dashboard/src/app/pages/ticker/widgets/_kit/index.ts` — replace the whole file:

```ts
/**
 * `_kit` — ticker-local widget infrastructure. `StatTile` + `copy` live here (one consumer).
 * `TintChip` and `useFlashOnChange` were PROMOTED to `shared/` when `/scanner` became their second
 * consumer (app README: "populate on 2nd consumer"; `pages/` never imports a sibling page) — they
 * are re-exported here so every existing ticker-widget import path stays byte-unchanged.
 */
export * from './StatTile';
export * from './copy';
export * from '@/shared/ui/TintChip';
export * from '@/shared/hooks/useFlashOnChange';
```

Now re-point the five direct importers (one line each):

`apps/dashboard/src/app/pages/ticker/widgets/_kit/StatTile.tsx` line 26:
```ts
import { flashColorSx, type FlashState } from '@/shared/hooks/useFlashOnChange';
```

`apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx` line 21:
```ts
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
```

`apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx` line 15:
```ts
import { useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
```

`apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx` line 12:
```ts
import { TintChip } from '@/shared/ui/TintChip';
```

`apps/dashboard/src/app/pages/ticker/widgets/setups/Setups.tsx` line 8:
```ts
import { TintChip } from '@/shared/ui/TintChip';
```

`apps/dashboard/src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx` line 18:
```ts
import { TintChip } from '@/shared/ui/TintChip';
```

- [ ] **Step 4: RED — the keyframe set-equality scan catches the move**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run shared/theme/single-motion-moment.spec.ts
```
Expected: FAIL —
```
FAIL  src/app/shared/theme/single-motion-moment.spec.ts > single-motion-moment … > the glob is not vacuous (app sources actually loaded, incl. the named homes)
AssertionError: expected [ … ] to contain '/src/app/pages/ticker/widgets/_kit/useFlashOnChange.ts'
```
plus the `(d) dynamic keyframe names (flash-*) are declared ONLY by useFlashOnChange` case failing on the new path. This is the scan doing its job: it pins the dynamic-keyframe family to exactly one declaring file, and that file just moved.

- [ ] **Step 5: GREEN — re-point the two structural scans that pin the old paths**

`apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts` line 34 — replace:

```ts
/** The one file allowed to declare a DYNAMIC keyframe name (the flash-* family). Promoted to
 *  `shared/hooks/` on its 2nd consumer (the /scanner price cell); the family is UNCHANGED — no new
 *  keyframe was added, so the inventory below stays SET-EQUAL. */
const FLASH_HOME = '/src/app/shared/hooks/useFlashOnChange.ts';
```

`apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts` — in `TEXT_AMBER_CONSUMERS`, replace the `_kit/TintChip.tsx` entry with its new path (leave every other entry alone in this task):

```ts
  '/src/app/shared/ui/TintChip.tsx', //                          the `emphasis` tone text
```

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run shared/theme/single-motion-moment.spec.ts shared/theme/stage3-amber.spec.ts
```
Expected: `Test Files  2 passed (2)` — the keyframe inventory is still set-equal to `{liveDotPulse, widgetLivePulse, ordersWatchPulse}` + the `flash-*` family in its one (new) home.

- [ ] **Step 6: Full suite + typecheck + lint — prove zero call-site churn**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard
```
Expected: `Test Files  73 passed (73)` / `Tests  606 passed (606)` — **the baseline is unchanged**: nothing was added or removed, only relocated. (If a spec fails, re-run it alone once — two timing-flaky specs exist and a clean rerun is the tiebreaker.)

```bash
cd C:/Dev/gammaflow-web && npx tsc -b apps/dashboard/tsconfig.app.json --force && npx nx run @org/dashboard:typecheck && npx nx lint @org/dashboard
```
Expected: `tsc` prints nothing (exit 0); `typecheck` succeeds; `lint` reports **29 warnings, 0 errors** (the pre-existing count — no new warning may be introduced).

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/shared apps/dashboard/src/app/pages/ticker
git commit -m "refactor(dashboard): promote TintChip -> shared/ui and useFlashOnChange -> shared/hooks (2nd-consumer rule); re-point the keyframe + textAmber scans"
```

---

### Task 3: `labels.ts` (the closed lookups + ALL pinned copy) + `format.ts` (pure display transports)

> The honesty core, as two React-free leaf modules so the traps are unit-testable in isolation. `labels.ts` holds **every** user-facing string (UX §2/§3, verbatim except the two reworded "live" clauses — Open decision 1) plus the **closed lookups** for `status`/`tier`/`regime`/`vol_regime` with a **fail-honest fallback** for an unknown value. `format.ts` holds the pure transports — relative ages, the `—` renderer, the direction-color resolver (bound to `chg_pct` alone), the client-side sorter, the worker-down banner resolver, and `updatedText()`, **which branches on `status === 'building'` FIRST** (the INTERFACE §3.1 PINNED `as_of` trap). RED→GREEN is that trap.

**Files:**
- Create: `apps/dashboard/src/app/pages/scanner/labels.ts`
- Create: `apps/dashboard/src/app/pages/scanner/format.ts`
- Create: `apps/dashboard/src/app/pages/scanner/format.spec.ts`

**Interfaces:**
- Consumes: `@org/api` types from Task 1 (`ScanRow`, `ScanStatus`, `ScanSortKey`, `ScanViewSort`, `SweepHeartbeat`).
- Produces (Tasks 4–8 consume):
  - `labels.ts`: `SCAN_COPY` (frozen copy bag) · `SCAN_COLUMNS: readonly ScanColumn[]` · `COLUMN_LABELS: Record<ScanColumn, string>` · `SORTABLE_COLUMNS: Partial<Record<ScanColumn, ScanSortKey>>` · `interface StatusMeta { label: string | null; tone: 'warning' | 'neutral' | null; tip: (rel: string) => string }` · `statusMeta(status: string): StatusMeta` · `UNAVAILABLE_STATUS_META` · `tierLabel(v)` / `regimeLabel(v)` / `volRegimeLabel(v)` → `string | null`
  - `format.ts`: `EM_DASH` · `relAge(s)` · `coarseAge(s)` · `dash(v, fmt)` · `fmtPrice` / `fmtScore` / `fmtSignedPct` · `updatedText(row, nowS): string | null` · `directionColor(chg): string` · `sortRows(rows, sort): ScanRow[]` · `SWEEP_DOWN_AFTER_S` · `sweepBanner(sweep, nowS): { engaged: boolean; text: string }`

- [ ] **Step 1: Write `labels.ts`**

Create `apps/dashboard/src/app/pages/scanner/labels.ts`:

```ts
/**
 * `/scanner` — ALL user-facing copy + the CLOSED label lookups, in one React-free leaf.
 *
 * Copy is pinned by `UX_BLUEPRINT.md` §2/§3 and is reproduced verbatim with ONE documented
 * deviation, flagged to GATE Z: the blueprint's cadence gloss ended "…not a live feed" and its
 * `error` tip ended "…is live-scored on the stated cadence", but the SAME section and AC-9 forbid
 * the word "live" on this surface. Both clauses ship with the banned token removed and the meaning
 * intact ("not a real-time feed" / "is scored on the stated cadence") so the AC-9 negative-space
 * scan is mechanically enforceable.
 *
 * The lookups are CLOSED (`[digested-labels-not-raw-dump]`): a status/tier/regime/vol value is
 * mapped through a fixed table and NEVER re-derived from a scalar. An unrecognized value resolves to
 * the fail-honest UNAVAILABLE meta (statuses) or to `null` (labels ⇒ render nothing) — never a guess,
 * never a raw enum dump.
 */
import type { ScanSortKey, ScanStatus } from '@org/api';

export const SCAN_COPY = {
  heading: 'Scanner',
  subhead:
    'One dense read of the tracked universe — which ticker deserves the deep-dive right now.',
  /** The two-speed basis, always above the table (UX §2.1). */
  cadenceHeader: 'Prices ~30s · structure ~3 min · hot names sooner',
  cadenceGloss:
    'Prices refresh about every 30 seconds; the full options structure re-computes about every 3 ' +
    'minutes; names that just moved re-compute sooner. This is a polled snapshot, not a real-time feed.',
  loading: 'Loading scan…',
  emptyViewTitle: 'No tickers in your view.',
  emptyViewBody: 'Pick tickers to build your scan.',
  /** Never a persistence claim for an anonymous visitor (UX §3.3). */
  signInToCustomize: 'Sign in to customize your view.',
  editView: 'Edit view',
  saveView: 'Save view',
  cancel: 'Cancel',
  viewNameLabel: 'View name (optional)',
  viewEditorTitle: 'Edit your scan view',
  universeHint:
    'Pick from the tracked universe. The universe is server-curated — it cannot be added to here.',
  selectedHeading: 'In your view (drag order = display order)',
  moveUp: 'Move up',
  moveDown: 'Move down',
  saveFailed: 'Could not save that view. Please try again.',
  sweepAbsent: "Sweep hasn't reported yet — showing the last known rows.",
  sweepBehind: (age: string) => `Sweep last ran ${age} ago — showing the last known rows.`,
  updated: (rel: string) => `Updated ${rel} ago`,
  sortAria: (col: string) => `Sort by ${col}`,
} as const;

/** The locked column set + order (UX §1.1, left→right triage reading order). */
export const SCAN_COLUMNS = [
  'symbol',
  'price',
  'chg_pct',
  'score',
  'tier',
  'regime',
  'vol_regime',
  'flip',
  'walls',
  'updated',
  'status',
] as const;
export type ScanColumn = (typeof SCAN_COLUMNS)[number];

export const COLUMN_LABELS: Record<ScanColumn, string> = {
  symbol: 'Symbol',
  price: 'Price',
  chg_pct: 'Chg %',
  score: 'Score',
  tier: 'Tier',
  regime: 'Regime',
  vol_regime: 'Vol',
  flip: 'Flip',
  walls: 'Walls',
  updated: 'Updated',
  status: 'Status',
};

/** The CLOSED set of sortable columns (UX §1.2) → the wire sort key each maps to. A column absent
 *  from this map renders a plain, non-interactive header. */
export const SORTABLE_COLUMNS: Partial<Record<ScanColumn, ScanSortKey>> = {
  symbol: 'symbol',
  price: 'price',
  chg_pct: 'chg_pct',
  score: 'score',
  flip: 'dist_to_flip_pct',
  walls: 'dist_to_wall_pct',
};

export interface StatusMeta {
  /** Chip label, or `null` when the status is QUIET (`ok` — freshness is the only cue, UX §3.1). */
  label: string | null;
  /** `warning` binds burnt orange AND the label carries a ⚠ glyph — hue never carries it alone. */
  tone: 'warning' | 'neutral' | null;
  /** Tooltip factory; `rel` is the row's relative as-of age (ignored by statuses that don't use it). */
  tip: (rel: string) => string;
}

const STATUS_META: Record<ScanStatus, StatusMeta> = {
  ok: { label: null, tone: null, tip: () => '' },
  stale: {
    label: '⚠ Stale',
    tone: 'warning',
    tip: (rel) =>
      `Last computed ${rel} ago; the sweep is behind. Price is frozen at its last read.`,
  },
  error: {
    label: '⚠ Error',
    tone: 'warning',
    tip: () =>
      'This symbol failed its last compute. Only this row is affected — the rest of the table is ' +
      'scored on the stated cadence.',
  },
  building: {
    label: 'Building',
    tone: 'neutral',
    tip: () => 'Tracked, not yet computed. First score is pending.',
  },
};

/** Fail-honest fallback: an unrecognized status is UNAVAILABLE, never guessed into a known state. */
export const UNAVAILABLE_STATUS_META: StatusMeta = {
  label: 'Unavailable',
  tone: 'neutral',
  tip: () => 'This row reported a state this build does not recognize. Treating it as unavailable.',
};

export function statusMeta(status: string): StatusMeta {
  return Object.prototype.hasOwnProperty.call(STATUS_META, status)
    ? STATUS_META[status as ScanStatus]
    : UNAVAILABLE_STATUS_META;
}

const TIER_LABEL: Record<string, string> = {
  dormant: 'Dormant',
  watch: 'Watch',
  actionable: 'Actionable',
  prime: 'Prime',
};
const REGIME_LABEL: Record<string, string> = {
  positive_gamma: 'Pos γ',
  negative_gamma: 'Neg γ',
};
const VOL_REGIME_LABEL: Record<string, string> = {
  iv_rich: 'IV rich',
  iv_cheap: 'IV cheap',
  neutral: 'Neutral',
};

/** A closed-lookup miss renders NOTHING (never the raw enum, never an invented label). */
function closed(map: Record<string, string>, value: string | null | undefined): string | null {
  if (value == null) return null;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

export const tierLabel = (v: string | null | undefined) => closed(TIER_LABEL, v);
export const regimeLabel = (v: string | null | undefined) => closed(REGIME_LABEL, v);
export const volRegimeLabel = (v: string | null | undefined) => closed(VOL_REGIME_LABEL, v);
```

- [ ] **Step 2: Write `format.ts`**

Create `apps/dashboard/src/app/pages/scanner/format.ts`:

```ts
/**
 * `/scanner` — pure display TRANSPORTS. No React, no fetch, no market math: every number here
 * arrives pre-computed on the wire and is only formatted, ordered, or compared against the clock
 * (`[additive-keeps-score-byte-identical]` — the scanner consumes, it never re-derives).
 *
 * The sharp edge lives here: `updatedText` branches on `status === 'building'` BEFORE it reads
 * `as_of`. INTERFACE §3.1 PINS that a synthesized `building` row carries a non-null `as_of` that is
 * NOT a freshness claim, so rendering "Updated 3s ago" off it would be a fabricated freshness claim
 * on a row that has never been computed.
 */
import type { ScanRow, ScanSortKey, ScanViewSort, SweepHeartbeat } from '@org/api';
import { SCAN_COPY } from './labels';

/** Honestly-missing. Every nullable numeric renders THIS, never `0`, never a fabricated value. */
export const EM_DASH = '—';

/** Per-row relative age: "42s" · "2m" · "3h" (UX §2.2). */
export function relAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** Coarse banner age: "3 min" · "12 min" · "1 hr" · "2 d" (UX §2.3). Floors at "1 min". */
export function coarseAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr`;
  return `${Math.floor(s / 86400)} d`;
}

/** `null`/`undefined`/non-finite ⇒ the em-dash. A real `0` formats normally — a zero is data. */
export function dash(value: number | null | undefined, format: (n: number) => string): string {
  return value == null || !Number.isFinite(value) ? EM_DASH : format(value);
}

export const fmtPrice = (n: number) => n.toFixed(2);
export const fmtScore = (n: number) => n.toFixed(0);
/** Signed percent with a REAL minus sign (never a hyphen). Neutral by construction — the CALLER
 *  decides colour, and only `chg_pct` ever gets one. */
export const fmtSignedPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;

/**
 * The per-row freshness line, or `null` when there is nothing honest to say.
 * `building` is checked FIRST (the pinned `as_of` trap); a non-positive/non-finite `as_of` is also
 * no claim. Everything else reports its real age.
 */
export function updatedText(row: Pick<ScanRow, 'status' | 'as_of'>, nowS: number): string | null {
  if (row.status === 'building') return null; // NOT a freshness claim — INTERFACE §3.1 (PINNED)
  if (!Number.isFinite(row.as_of) || row.as_of <= 0) return null;
  return SCAN_COPY.updated(relAge(nowS - row.as_of));
}

/**
 * The ONLY green/red decision on this surface: PRICE DIRECTION, bound to `chg_pct` alone
 * (convexa-design rule 2). Score, distances, walls, flip, regime and vol-regime resolve to the
 * neutral token — a tinted rate/proximity manufactures a verdict the datum cannot support, and is
 * the exact class the Stage-3 sweep caught on a proximity chip.
 */
export function directionColor(chg: number | null | undefined): string {
  if (chg == null || !Number.isFinite(chg)) return 'text.primary';
  return chg >= 0 ? 'success.main' : 'error.main';
}

const SORT_VALUE: Record<ScanSortKey, (r: ScanRow) => number | string | null> = {
  score: (r) => r.score,
  symbol: (r) => r.symbol,
  price: (r) => r.price,
  chg_pct: (r) => r.chg_pct,
  dist_to_flip_pct: (r) => r.dist_to_flip_pct,
  dist_to_wall_pct: (r) => r.dist_to_wall_pct,
};

/**
 * Client-side re-order of the RETURNED rows (UX §1.2) — never a refetch, never a re-derivation.
 * `null` sorts LAST regardless of direction (an absent value is not a small value), and ties keep
 * the wire order, so the sort is stable across polls.
 */
export function sortRows(rows: ScanRow[], sort: ScanViewSort): ScanRow[] {
  const pick = SORT_VALUE[sort.key] ?? SORT_VALUE.score;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: pick(row) }))
    .sort((a, b) => {
      const aNull = a.key == null;
      const bNull = b.key == null;
      if (aNull || bNull) {
        if (aNull && bNull) return a.index - b.index;
        return aNull ? 1 : -1;
      }
      const cmp =
        typeof a.key === 'string' && typeof b.key === 'string'
          ? a.key.localeCompare(b.key)
          : Number(a.key) - Number(b.key);
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * The worker-down engagement threshold. UX §2.3 says "behind/missing" and INTERFACE §4 delegates the
 * age computation to the FE, but NEITHER pins a number — this constant is that decision, single-
 * sourced and flagged to GATE Z (Open decision 2). 180s ≈ one baseline slow pass at N=100 (D4).
 */
export const SWEEP_DOWN_AFTER_S = 180;

/**
 * The worker-down banner state (UX §2.3), computed from the heartbeat epochs vs our own clock.
 * Engagement is decided on `updated_at` (worker liveness); the "last ran {X} ago" wording is only
 * honest when a COMPLETED pass exists, so a heartbeat with `sweep_last_completed: null` falls to the
 * "hasn't reported yet" variant (Open decision 3). Rows always keep rendering beneath it.
 */
export function sweepBanner(
  sweep: SweepHeartbeat | null,
  nowS: number,
): { engaged: boolean; text: string } {
  if (sweep == null) return { engaged: true, text: SCAN_COPY.sweepAbsent };
  if (nowS - sweep.updated_at <= SWEEP_DOWN_AFTER_S) return { engaged: false, text: '' };
  return sweep.sweep_last_completed != null
    ? { engaged: true, text: SCAN_COPY.sweepBehind(coarseAge(nowS - sweep.sweep_last_completed)) }
    : { engaged: true, text: SCAN_COPY.sweepAbsent };
}
```

- [ ] **Step 3: Write the failing pure-unit suite**

Create `apps/dashboard/src/app/pages/scanner/format.spec.ts`:

```ts
/**
 * `/scanner` transports + closed lookups — the PURE unit suite. Risk-based (`qa-verify.md` §4): these
 * are the silently-regressing pieces — a lookup miss that guesses, a `null` that renders `0`, a
 * `building` row that grows a fabricated freshness claim, a sort that floats `null`s to the top, a
 * direction colour that leaks onto a rate. None of that is visible in a screenshot review.
 */
import type { ScanRow, SweepHeartbeat } from '@org/api';
import { describe, expect, it } from 'vitest';
import {
  coarseAge,
  dash,
  directionColor,
  EM_DASH,
  fmtPrice,
  fmtSignedPct,
  relAge,
  sortRows,
  sweepBanner,
  updatedText,
} from './format';
import {
  regimeLabel,
  statusMeta,
  tierLabel,
  UNAVAILABLE_STATUS_META,
  volRegimeLabel,
} from './labels';

const NOW = 1_800_000;

function row(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    price: 500,
    chg_pct: 1.2,
    score: 82,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495,
    dist_to_flip_pct: 1,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: -2,
    as_of: NOW - 42,
    status: 'ok',
    ...over,
  };
}

describe('relative ages', () => {
  it('relAge buckets seconds / minutes / hours', () => {
    expect(relAge(0)).toBe('0s');
    expect(relAge(42)).toBe('42s');
    expect(relAge(59.4)).toBe('59s');
    expect(relAge(120)).toBe('2m');
    expect(relAge(3600)).toBe('1h');
    expect(relAge(-5)).toBe('0s'); // clock skew never renders a negative age
  });

  it('coarseAge is the banner grain: minutes floored at 1, then hours, then days', () => {
    expect(coarseAge(10)).toBe('1 min');
    expect(coarseAge(180)).toBe('3 min');
    expect(coarseAge(720)).toBe('12 min');
    expect(coarseAge(3600)).toBe('1 hr');
    expect(coarseAge(90_000)).toBe('1 d');
  });
});

describe('honestly-missing rendering', () => {
  it('null/undefined/NaN render the em-dash, but a real 0 renders as data', () => {
    expect(dash(null, fmtPrice)).toBe(EM_DASH);
    expect(dash(undefined, fmtPrice)).toBe(EM_DASH);
    expect(dash(Number.NaN, fmtPrice)).toBe(EM_DASH);
    expect(dash(0, fmtPrice)).toBe('0.00'); // a zero is a value, NOT a missing value
    expect(dash(0, fmtSignedPct)).toBe('+0.00%');
    expect(dash(-2.5, fmtSignedPct)).toBe('−2.50%'); // a REAL minus sign
  });
});

describe('updatedText — the pinned `building` as_of trap', () => {
  it('a building row NEVER produces a freshness line, even with a fresh non-null as_of', () => {
    // The synthesized building row can carry a real recent epoch; INTERFACE §3.1 pins that it is
    // NOT a freshness claim. Branch on status FIRST.
    expect(updatedText(row({ status: 'building', as_of: NOW - 3 }), NOW)).toBeNull();
    expect(updatedText(row({ status: 'building', as_of: 0 }), NOW)).toBeNull();
  });

  it('ok/stale rows report their real age; a non-positive as_of makes no claim', () => {
    expect(updatedText(row({ status: 'ok', as_of: NOW - 42 }), NOW)).toBe('Updated 42s ago');
    expect(updatedText(row({ status: 'stale', as_of: NOW - 600 }), NOW)).toBe('Updated 10m ago');
    expect(updatedText(row({ status: 'error', as_of: 0 }), NOW)).toBeNull();
  });
});

describe('closed lookups (never re-derived, never guessed)', () => {
  it('every wire status maps to its pinned chip; an unknown status is fail-honest UNAVAILABLE', () => {
    expect(statusMeta('ok').label).toBeNull(); //          quiet — freshness is the only cue
    expect(statusMeta('stale')).toMatchObject({ label: '⚠ Stale', tone: 'warning' });
    expect(statusMeta('error')).toMatchObject({ label: '⚠ Error', tone: 'warning' });
    expect(statusMeta('building')).toMatchObject({ label: 'Building', tone: 'neutral' });
    expect(statusMeta('teleporting')).toBe(UNAVAILABLE_STATUS_META);
    expect(statusMeta('')).toBe(UNAVAILABLE_STATUS_META);
    // The warning tones carry a glyph in the label — hue never carries "warning" alone.
    expect(statusMeta('stale').label).toContain('⚠');
    expect(statusMeta('error').label).toContain('⚠');
    // No tooltip on this surface may claim a real-time feed.
    for (const s of ['stale', 'error', 'building']) {
      expect(statusMeta(s).tip('2m')).not.toMatch(/\blive\b/i);
    }
  });

  it('tier/regime/vol labels resolve from the closed tables; anything else renders NOTHING', () => {
    expect(tierLabel('prime')).toBe('Prime');
    expect(tierLabel('watch')).toBe('Watch');
    expect(regimeLabel('positive_gamma')).toBe('Pos γ');
    expect(regimeLabel('negative_gamma')).toBe('Neg γ');
    expect(volRegimeLabel('iv_rich')).toBe('IV rich');
    expect(volRegimeLabel('neutral')).toBe('Neutral');
    // Unknown / null ⇒ null ⇒ the cell renders no label (never the raw enum, never a guess).
    expect(tierLabel('legendary')).toBeNull();
    expect(regimeLabel('sideways_gamma')).toBeNull();
    expect(volRegimeLabel(null)).toBeNull();
  });
});

describe('direction colour is bound to chg_pct alone', () => {
  it('resolves success/error by sign and neutral for a missing value', () => {
    expect(directionColor(1.2)).toBe('success.main');
    expect(directionColor(0)).toBe('success.main');
    expect(directionColor(-0.4)).toBe('error.main');
    expect(directionColor(null)).toBe('text.primary');
    expect(directionColor(Number.NaN)).toBe('text.primary');
  });
});

describe('sortRows — client-side re-order, nulls last, stable', () => {
  const rows = [
    row({ symbol: 'AAA', score: 10 }),
    row({ symbol: 'BBB', score: null }),
    row({ symbol: 'CCC', score: 90 }),
    row({ symbol: 'DDD', score: 50 }),
  ];

  it('the default score-desc read floats the best first and sinks nulls to the bottom', () => {
    const out = sortRows(rows, { key: 'score', dir: 'desc' }).map((r) => r.symbol);
    expect(out).toEqual(['CCC', 'DDD', 'AAA', 'BBB']);
  });

  it('nulls stay LAST when the direction flips (an absent value is not a small value)', () => {
    const out = sortRows(rows, { key: 'score', dir: 'asc' }).map((r) => r.symbol);
    expect(out).toEqual(['AAA', 'DDD', 'CCC', 'BBB']);
    expect(out[out.length - 1]).toBe('BBB');
  });

  it('symbol-asc is alphabetical, ties keep wire order, and the input array is not mutated', () => {
    const tied = [row({ symbol: 'ZZ', score: 5 }), row({ symbol: 'YY', score: 5 })];
    expect(sortRows(tied, { key: 'score', dir: 'desc' }).map((r) => r.symbol)).toEqual(['ZZ', 'YY']);
    expect(sortRows(rows, { key: 'symbol', dir: 'asc' }).map((r) => r.symbol)).toEqual([
      'AAA',
      'BBB',
      'CCC',
      'DDD',
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']); // untouched
  });
});

describe('sweepBanner', () => {
  const hb = (over: Partial<SweepHeartbeat> = {}): SweepHeartbeat => ({
    updated_at: NOW - 5,
    sweep_last_completed: NOW - 30,
    universe_size: 25,
    ...over,
  });

  it('engages on a missing or behind heartbeat and stays quiet on a fresh one', () => {
    expect(sweepBanner(null, NOW)).toEqual({
      engaged: true,
      text: "Sweep hasn't reported yet — showing the last known rows.",
    });
    expect(sweepBanner(hb(), NOW).engaged).toBe(false);
    expect(sweepBanner(hb({ updated_at: NOW - 400, sweep_last_completed: NOW - 180 }), NOW)).toEqual(
      { engaged: true, text: 'Sweep last ran 3 min ago — showing the last known rows.' },
    );
    // Behind with NO completed pass: we cannot honestly say "last ran X ago".
    expect(
      sweepBanner(hb({ updated_at: NOW - 400, sweep_last_completed: null }), NOW).text,
    ).toBe("Sweep hasn't reported yet — showing the last known rows.");
  });
});
```

- [ ] **Step 4: RED — break the `building` as_of trap, observe FAIL**

In `format.ts`, temporarily move the `building` guard **after** the `as_of` guard (i.e. reorder the two `if` lines inside `updatedText` so `as_of` is read first and a fresh building row falls through), then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/format.spec.ts
```
Expected: FAIL —
```
 FAIL  src/app/pages/scanner/format.spec.ts > updatedText — the pinned `building` as_of trap > a building row NEVER produces a freshness line, even with a fresh non-null as_of
AssertionError: expected 'Updated 3s ago' to be null
```
That string is exactly the fabricated freshness claim the invariant forbids. **Restore** the `status === 'building'` branch to the top of `updatedText`.

- [ ] **Step 5: GREEN**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/format.spec.ts
```
Expected:
```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/pages/scanner/labels.ts apps/dashboard/src/app/pages/scanner/format.ts apps/dashboard/src/app/pages/scanner/format.spec.ts
git commit -m "feat(scanner): FE closed status/tier/regime lookups + pinned copy + pure display transports (building as_of trap guarded)"
```

---

### Task 4: `useScan` — the page's one data owner (poll cadence · hidden-tab auto-pause · the server-gated save)

> Item **2** (page-level fetching, stated cadence, no SSE) + item **6**'s write half. ONE stable 30s interval whose visibility gate is read from a ref at fire time (the `useLatencyTrend` precedent — flapping can never spawn a second interval or a burst); a failed poll **keeps the last-known rows** and marks the read degraded rather than blanking. The save runs through `useGate().guard(...)` with `saveScanView` as the enforcement call itself (useGate's documented "fn carries the enforcement" case): signed-out ⇒ the prompt shows and the PUT is **never issued**; a stale-cookie 403 ⇒ the `AuthError` aborts **before** any state mutation. **Nothing is ever written locally.** RED→GREEN is that gate.

**Files:**
- Create: `apps/dashboard/src/app/pages/scanner/useScan.ts`
- Create: `apps/dashboard/src/app/pages/scanner/useScan.spec.tsx`

**Interfaces:**
- Consumes: `@org/api` (`getScan`, `saveScanView`, `AuthError`, the Task-1 types); `@/features/auth/useGate` (`useGate`, `GateApi`); Task 3's `sortRows`/`sweepBanner`/`SCAN_COPY`.
- Produces (Tasks 5–7 consume): `SCAN_POLL_MS = 30_000` · `SCAN_CLOCK_MS = 5_000` · `DEFAULT_SORT` · `interface ScanApi` · `useScan(): ScanApi`.

- [ ] **Step 1: Write `useScan.ts`**

Create `apps/dashboard/src/app/pages/scanner/useScan.ts`:

```ts
/**
 * useScan — the `/scanner` page's ONE data owner and its ONLY fetcher.
 *
 * POLL, never a stream (`[live-vs-static-isolation]`): a single `GET /api/scan` on a stable
 * `SCAN_POLL_MS` interval. There is deliberately NO `EventSource`, NO `streamTicker`, and no per-row
 * subscription anywhere on this surface, and the cadence the page STATES in its header is the same
 * cadence this constant sets.
 *
 * The interval is created once; the hidden-tab gate is read from a REF at fire time, so visibility
 * flapping or a StrictMode double-invoke can never add a second interval or burst the backend (the
 * `pages/operator-metrics/useLatencyTrend.ts` precedent). Becoming visible again triggers ONE
 * immediate refresh so an ambient radar is never silently stale.
 *
 * Degradation is best-effort: a failed poll KEEPS the last-known rows and flips `degraded` — the
 * table never blanks, never throws into the trader path.
 *
 * The view SAVE is the one gated, state-bearing action (`[server-side-gate-enforcement]`).
 * `saveScanView` IS the server gate (`PUT /api/scan/view` answers a real 403 signed-out), which is
 * useGate's documented "fn carries the enforcement" case — so no separate `opts.serverGate` is
 * passed. Signed out ⇒ `guard` shows the prompt and never runs the write. A 403 from a stale cookie
 * ⇒ the thrown `AuthError` aborts before `setSnapshot`, so NOTHING is written locally. This hook
 * writes no localStorage and owns no durable store — the server is the boundary of record.
 */
import {
  AuthError,
  getScan,
  saveScanView,
  type ScanDensity,
  type ScanRow,
  type ScanView,
  type ScanViewSort,
  type ScanViewWrite,
  type SweepHeartbeat,
} from '@org/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGate, type GateApi } from '@/features/auth/useGate';
import { sortRows, sweepBanner } from './format';
import { SCAN_COPY } from './labels';

/** Matches the worker's FAST lane (~30s prices, D4) and the header's stated basis. */
export const SCAN_POLL_MS = 30_000;
/** Display-clock tick for the relative "Updated …" / "Sweep last ran …" strings. Presentational
 *  only — it issues no network and never changes a value, just how old we say it is. */
export const SCAN_CLOCK_MS = 5_000;

export const DEFAULT_SORT: ScanViewSort = { key: 'score', dir: 'desc' };

interface Snapshot {
  phase: 'loading' | 'ready';
  rows: ScanRow[];
  view: ScanView | null;
  sweep: SweepHeartbeat | null;
  degraded: boolean;
}

export interface ScanApi {
  /** `loading` ⇒ the FIRST read is still in flight ⇒ the skeleton. Never re-entered after the first
   *  resolution: a later failed poll degrades, it does not re-skeleton. */
  phase: 'loading' | 'ready';
  /** The rows in DISPLAY order (client-side sorted; never refetched to sort). */
  rows: ScanRow[];
  view: ScanView | null;
  sweep: SweepHeartbeat | null;
  degraded: boolean;
  /** Wall clock in epoch-SECONDS, ticking at SCAN_CLOCK_MS — the basis for every relative age. */
  nowS: number;
  sort: ScanViewSort;
  density: ScanDensity;
  setSort: (sort: ScanViewSort) => void;
  setDensity: (density: ScanDensity) => void;
  workerDown: boolean;
  workerDownText: string;
  isEmptyView: boolean;
  gate: GateApi;
  saveError: string | null;
  refresh: () => Promise<void>;
  /** Resolves `true` only when the SERVER echoed a saved view. `false` covers every refusal
   *  (signed-out FE gate, a real 403, a 422) — the caller keeps the editor open on `false`. */
  saveView: (draft: ScanViewWrite) => Promise<boolean>;
}

export function useScan(): ScanApi {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    phase: 'loading',
    rows: [],
    view: null,
    sweep: null,
    degraded: false,
  }));
  const [sortDraft, setSortDraft] = useState<ScanViewSort | null>(null);
  const [densityDraft, setDensityDraft] = useState<ScanDensity | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nowS, setNowS] = useState(() => Date.now() / 1000);
  const gate = useGate();

  const refresh = useCallback(async () => {
    try {
      const res = await getScan();
      setSnapshot({
        phase: 'ready',
        rows: res.rows,
        view: res.view,
        sweep: res.sweep,
        degraded: false,
      });
    } catch {
      // Best-effort: keep whatever we already showed. A transport fault must never blank the table
      // or surface an error screen — the honest states live in the rows + the banner.
      setSnapshot((prev) => ({ ...prev, phase: 'ready', degraded: true }));
    }
  }, []);

  // --- the poll loop: ONE interval, gate read from a ref at fire time -----------------------------
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const hiddenRef = useRef(false);
  useEffect(() => {
    hiddenRef.current = typeof document !== 'undefined' && document.hidden;
    const onVisibility = () => {
      const wasHidden = hiddenRef.current;
      hiddenRef.current = document.hidden;
      if (wasHidden && !document.hidden) void refreshRef.current(); // resume ⇒ refresh at once
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let active = true;
    void refreshRef.current(); // the first read paints the page, hidden or not
    const id = setInterval(() => {
      if (active && !hiddenRef.current) void refreshRef.current();
    }, SCAN_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // --- the display clock (no network) -------------------------------------------------------------
  useEffect(() => {
    const id = setInterval(() => setNowS(Date.now() / 1000), SCAN_CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  // --- derived during render, never in an effect --------------------------------------------------
  const sort = sortDraft ?? snapshot.view?.sort ?? DEFAULT_SORT;
  const density = densityDraft ?? snapshot.view?.density ?? 'compact';
  const rows = useMemo(() => sortRows(snapshot.rows, sort), [snapshot.rows, sort]);
  const banner = useMemo(() => sweepBanner(snapshot.sweep, nowS), [snapshot.sweep, nowS]);

  const saveView = useCallback(
    async (draft: ScanViewWrite): Promise<boolean> => {
      setSaveError(null);
      let saved = false;
      try {
        await gate.guard(SCAN_COPY.signInToCustomize, async () => {
          // The SERVER call IS the gate. Signed out, `guard` never reaches this line; with a stale
          // cookie the 403 throws here, so `setSnapshot` below never runs — nothing is persisted
          // and nothing is written locally.
          const echo = await saveScanView(draft);
          setSnapshot((prev) => ({ ...prev, view: echo })); // server-wins echo
          setSortDraft(null);
          setDensityDraft(null);
          saved = true;
          await refreshRef.current(); // re-read rows for the new symbol set
        });
      } catch (err) {
        // `guard` handles auth_required / auth_unavailable itself and re-throws everything else —
        // a 422 arrives here as AuthError('validation') carrying the server's `detail`.
        setSaveError(err instanceof AuthError ? err.message : SCAN_COPY.saveFailed);
        saved = false;
      }
      return saved;
    },
    [gate],
  );

  return {
    phase: snapshot.phase,
    rows,
    view: snapshot.view,
    sweep: snapshot.sweep,
    degraded: snapshot.degraded,
    nowS,
    sort,
    density,
    setSort: setSortDraft,
    setDensity: setDensityDraft,
    workerDown: banner.engaged,
    workerDownText: banner.text,
    isEmptyView: snapshot.phase === 'ready' && (snapshot.view?.symbols.length ?? 0) === 0,
    gate,
    saveError,
    refresh,
    saveView,
  };
}
```

- [ ] **Step 2: Write the failing hook suite**

Create `apps/dashboard/src/app/pages/scanner/useScan.spec.tsx`:

```tsx
/**
 * `useScan` — RISK-BASED hook suite (`qa-verify.md` §4). The silently-regressing pieces:
 *   1. the cadence + the ABSENCE of any stream (a stray EventSource would be invisible in review),
 *   2. the hidden-tab auto-pause (a burst on a backgrounded tab is invisible until the bill),
 *   3. degrade-keeps-rows (a blanked table on one bad poll looks like "no setups today"),
 *   4. the SERVER-GATED write — signed out, the PUT must never be issued and NOTHING may be written
 *      locally, even though the FE could "helpfully" cache it.
 * Mocks ONLY the network boundary (`fetch` + `EventSource`), never a live backend.
 */
import { ThemeProvider } from '@mui/material/styles';
import type { ScanResponse } from '@org/api';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { AuthProvider } from '@/features/auth/AuthContext';
import { theme } from '@/shared/theme/theme';
import { SCAN_POLL_MS, useScan } from './useScan';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <AuthProvider>
      <AuthDialogProvider>{children}</AuthDialogProvider>
    </AuthProvider>
  </ThemeProvider>
);

let openedEventSources = 0;
let putCalls = 0;
let scanCalls = 0;
let authenticated = false;
let putStatus = 200;

function scanBody(symbols = ['SPY', 'QQQ']): ScanResponse {
  return {
    view: {
      source: authenticated ? 'account' : 'default',
      authenticated,
      name: null,
      symbols,
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    },
    rows: symbols.map((symbol, i) => ({
      symbol,
      price: 100 + i,
      chg_pct: 1,
      score: 90 - i,
      tier: 'prime',
      regime: 'positive_gamma',
      vol_regime: 'iv_rich',
      flip: 99,
      dist_to_flip_pct: 1,
      call_wall: 105,
      put_wall: 95,
      dist_to_wall_pct: -1,
      as_of: Date.now() / 1000,
      status: 'ok' as const,
    })),
    sweep: {
      updated_at: Date.now() / 1000,
      sweep_last_completed: Date.now() / 1000,
      universe_size: 2,
    },
  };
}

let scanFails = false;

beforeEach(() => {
  openedEventSources = 0;
  putCalls = 0;
  scanCalls = 0;
  scanFails = false;
  authenticated = false;
  putStatus = 200;
  localStorage.clear();
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      openedEventSources += 1;
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/session'))
        return json({
          authenticated,
          user: authenticated
            ? { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }
            : null,
          google_available: false,
          settings: authenticated
            ? { active_persona_id: null, default_ticker: null, theme: 'dark' }
            : null,
        });
      if (url.includes('/api/scan/view') && init?.method === 'PUT') {
        putCalls += 1;
        if (putStatus === 200) return json({ ...scanBody().view, source: 'account', name: 'Mine' });
        if (putStatus === 422) return json({ detail: "'ZZZZ' is not in the tracked universe." }, 422);
        return json({ error: 'auth_required', message: 'sign in' }, 403);
      }
      if (url.includes('/api/scan')) {
        scanCalls += 1;
        if (scanFails) return json({ detail: 'gateway' }, 502);
        return json(scanBody());
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('cadence + isolation', () => {
  it('reads /api/scan once on mount and opens NO stream (poll-based by construction)', async () => {
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(scanCalls).toBe(1);
    expect(openedEventSources).toBe(0);
    expect(result.current.rows.map((r) => r.symbol)).toEqual(['SPY', 'QQQ']);
  });

  it('polls again on the stated cadence — one read per interval, never a burst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const first = scanCalls;
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS + 100);
    });
    await waitFor(() => expect(scanCalls).toBe(first + 1));
  });

  it('auto-pauses while the tab is hidden and refreshes ONCE on resume', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const baseline = scanCalls;

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS * 3);
    });
    expect(scanCalls).toBe(baseline); // hidden ⇒ the tick fires but issues NO network

    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(scanCalls).toBe(baseline + 1)); // exactly one catch-up read
    hidden.mockRestore();
  });

  it('a failed poll KEEPS the last-known rows and flips `degraded` (never blanks)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    scanFails = true;
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS + 100);
    });
    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(result.current.rows).toHaveLength(2); // last-known rows intact
    expect(result.current.phase).toBe('ready'); // never re-skeletons
  });
});

describe('the server-gated view write', () => {
  it('signed OUT: the prompt shows, the PUT is never issued, and nothing is written locally', async () => {
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveView({ symbols: ['SPY'] });
    });
    expect(saved).toBe(false); // the caller learns it did NOT persist
    expect(putCalls).toBe(0); // the FE gate refused BEFORE the network
    expect(result.current.gate.promptText).toBe('Sign in to customize your view.');
    expect(result.current.view?.source).toBe('default'); // state untouched
    expect(localStorage.length).toBe(0); // NOTHING cached client-side
  });

  it('signed IN with a stale cookie: the server 403 aborts the write, state + storage untouched', async () => {
    authenticated = true;
    putStatus = 403;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveView({ symbols: ['SPY'] });
    });
    expect(saved).toBe(false); // a server refusal is never reported as a save
    expect(putCalls).toBe(1); // the SERVER is the boundary of record
    expect(result.current.view?.name).toBeNull(); // the echo never landed
    expect(result.current.gate.promptText).toBe('Sign in to customize your view.');
    expect(localStorage.length).toBe(0);
  });

  it('signed IN + 200: the SERVER echo wins and the rows are re-read', async () => {
    authenticated = true;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const before = scanCalls;
    await act(async () => {
      await result.current.saveView({ symbols: ['SPY', 'QQQ'], name: 'Mine' });
    });
    await waitFor(() => expect(result.current.view?.name).toBe('Mine'));
    expect(result.current.view?.source).toBe('account');
    expect(scanCalls).toBeGreaterThan(before);
    expect(result.current.gate.promptText).toBeNull();
  });

  it('a 422 surfaces the server detail inline and is NOT swallowed as an auth prompt', async () => {
    authenticated = true;
    putStatus = 422;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    await act(async () => {
      await result.current.saveView({ symbols: ['ZZZZ'] });
    });
    await waitFor(() =>
      expect(result.current.saveError).toBe("'ZZZZ' is not in the tracked universe."),
    );
    expect(result.current.gate.promptText).toBeNull();
  });
});
```

- [ ] **Step 3: RED — drop the gate, observe the write escape**

In `useScan.ts`, temporarily replace the `await gate.guard(SCAN_COPY.signInToCustomize, async () => { … })` wrapper with a direct call to its body (i.e. run `saveScanView(draft)` without `guard`), then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/useScan.spec.tsx
```
Expected: FAIL —
```
 FAIL  … > the server-gated view write > signed OUT: the prompt shows, the PUT is never issued, and nothing is written locally
AssertionError: expected 1 to be +0 // Object.is equality
```
i.e. an anonymous save reached the network. **Restore** the `gate.guard(...)` wrapper.

- [ ] **Step 4: GREEN**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/useScan.spec.tsx
```
Expected:
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

- [ ] **Step 5: Structural check — no stream on this surface**

```bash
cd C:/Dev/gammaflow-web && rg -n "EventSource|streamTicker|EventSourcePolyfill" apps/dashboard/src/app/pages/scanner --glob '!*.spec.*' || echo "CLEAN: no stream primitive in pages/scanner (poll-only)"
```
Expected: `CLEAN: no stream primitive in pages/scanner (poll-only)` (zero matches; the spec's `SilentEventSource` stub is excluded by the glob).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/pages/scanner/useScan.ts apps/dashboard/src/app/pages/scanner/useScan.spec.tsx
git commit -m "feat(scanner): useScan — 30s poll with hidden-tab auto-pause, degrade-keeps-rows, and the server-gated view save via useGate"
```

---

### Task 5: `ScanCells` + `ScanTable` + `ScanCard` — the locked columns, the per-row states, the card collapse

> Items **3**, **4** (render half) and **5** (per-row half). `ScanCells.tsx` renders each datum exactly ONE way so the table and the card can never drift; `ScanTable.tsx` is the ≥`sm` dense table (sticky header + sticky Symbol column, compact default, its own `overflow-x` container); `ScanCard.tsx` is the `<sm` collapse mirroring the `PositionCard` shape. Row/card click is a **real `/ticker/{SYMBOL}` link and nothing else**. RED→GREEN is the direction-colour boundary: a tinted distance cell must fail.

**Files:**
- Create: `apps/dashboard/src/app/pages/scanner/ScanCells.tsx`
- Create: `apps/dashboard/src/app/pages/scanner/ScanTable.tsx`
- Create: `apps/dashboard/src/app/pages/scanner/ScanCard.tsx`
- Create: `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx`

**Interfaces:**
- Consumes: Task 1 types; Task 2's `@/shared/ui/TintChip` + `@/shared/hooks/useFlashOnChange`; Task 3's `format.ts` + `labels.ts`.
- Produces (Tasks 6–7 consume):
  - `ScanCells.tsx`: `MONO` · `PriceCell` · `ChgCell` · `ScoreCell` · `TierCell` · `LabelCell` · `LevelDistCell` · `UpdatedCell` · `StatusCell` · `Dash`
  - `ScanTable.tsx`: `interface ScanTableProps { rows; sort; density; nowS; flashActive; onSort }` · `ScanTable(props)`
  - `ScanCard.tsx`: `interface ScanCardProps { row; nowS; flashActive }` · `ScanCard(props)` · `ScanCardList({ rows, nowS, flashActive })`

- [ ] **Step 1: Write `ScanCells.tsx`**

Create `apps/dashboard/src/app/pages/scanner/ScanCells.tsx`:

```tsx
/**
 * `/scanner` — the per-datum presentational atoms, shared by the table (≥sm) and the card (<sm), so a
 * datum is rendered exactly ONE way on this surface and the two layouts can never drift.
 *
 * The colour rules live here and nowhere else (convexa-design):
 *   - `ChgCell` is the ONLY green/red on the page — PRICE DIRECTION.
 *   - `ScoreCell`, `LevelDistCell`, `LabelCell` are NEUTRAL. A score is a rate and a distance is a
 *     signed proximity; tinting either manufactures a verdict the datum cannot support (the exact
 *     class the Stage-3 sweep caught on a proximity chip).
 *   - `TierCell` is the row's SINGLE amber spend (`TintChip tone="emphasis"` ⇒ the text-grade
 *     `textAmber` resolved through `extrasFor` inside TintChip). Nothing else on a row is amber.
 *   - `StatusCell` warning tones carry a ⚠ GLYPH in the label — hue never carries "warning" alone.
 * Every nullable value renders the em-dash, never `0`. All colour is a theme token; zero hex.
 */
import { Box, Tooltip, Typography } from '@mui/material';
import type { ScanRow } from '@org/api';
import { flashColorSx, useFlashOnChange } from '@/shared/hooks/useFlashOnChange';
import { typographyTokens } from '@/shared/theme/tokens';
import { TintChip } from '@/shared/ui/TintChip';
import {
  dash,
  directionColor,
  EM_DASH,
  fmtPrice,
  fmtScore,
  fmtSignedPct,
  relAge,
  updatedText,
} from './format';
import { regimeLabel, statusMeta, tierLabel, volRegimeLabel } from './labels';

/** Figures are mono + tabular by construction — numerals are the personality (skill rule 6). */
export const MONO = {
  fontFamily: typographyTokens.monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0,
} as const;

/** Honestly-missing. */
export function Dash({ testid }: { testid?: string }) {
  return (
    <Typography
      component="span"
      data-testid={testid}
      sx={{ ...MONO, fontSize: 'inherit', color: 'text.secondary' }}
    >
      {EM_DASH}
    </Typography>
  );
}

/**
 * Price — the page's ONE motion cue: a paint-only colour pulse on change via the shared
 * `useFlashOnChange` (which is inert under `prefers-reduced-motion` and declares no new keyframe
 * family). It is a polled data signal, NOT a stream, and is never labelled as one.
 */
export function PriceCell({ row, active }: { row: ScanRow; active: boolean }) {
  const flash = useFlashOnChange(row.price, { active });
  return (
    <Typography
      component="span"
      data-testid="cell-price"
      sx={[{ ...MONO, fontSize: 'inherit', color: 'text.primary' }, flashColorSx(flash)]}
    >
      {dash(row.price, fmtPrice)}
    </Typography>
  );
}

/** Chg % — THE only direction colour on this surface. */
export function ChgCell({ row }: { row: ScanRow }) {
  return (
    <Typography
      component="span"
      data-testid="cell-chg"
      sx={{ ...MONO, fontSize: 'inherit', color: directionColor(row.chg_pct) }}
    >
      {dash(row.chg_pct, fmtSignedPct)}
    </Typography>
  );
}

/** Score — the headline rate. NEVER green/red, NEVER amber. */
export function ScoreCell({ row }: { row: ScanRow }) {
  return (
    <Typography
      component="span"
      data-testid="cell-score"
      sx={{ ...MONO, fontSize: 'inherit', fontWeight: 600, color: 'text.primary' }}
    >
      {dash(row.score, fmtScore)}
    </Typography>
  );
}

/** Tier — the row's single amber spend, via the closed lookup. A miss renders nothing but a dash. */
export function TierCell({ row }: { row: ScanRow }) {
  const label = tierLabel(row.tier);
  return label ? <TintChip tone="emphasis" label={label} /> : <Dash testid="cell-tier" />;
}

/** Regime / Vol — closed-lookup labels, neutral. A lookup miss renders the dash, never the raw enum. */
export function LabelCell({ text, testid }: { text: string | null; testid: string }) {
  return (
    <Typography
      component="span"
      data-testid={testid}
      sx={{ fontSize: 'inherit', color: 'text.secondary' }}
    >
      {text ?? EM_DASH}
    </Typography>
  );
}

export const regimeTextOf = (row: ScanRow) => regimeLabel(row.regime);
export const volTextOf = (row: ScanRow) => volRegimeLabel(row.vol_regime);

/** A consumed level + its consumed signed distance. Both arrive pre-computed on the wire; the
 *  distance is a NO-SIDE datum and stays neutral. */
export function LevelDistCell({
  level,
  distPct,
  testid,
}: {
  level: number | null;
  distPct: number | null;
  testid: string;
}) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
      <Box component="span" sx={{ ...MONO, fontSize: 'inherit', color: 'text.primary' }}>
        {dash(level, fmtPrice)}
      </Box>
      <Box
        component="span"
        data-testid={testid}
        sx={{ ...MONO, fontSize: '0.6875rem', color: 'text.secondary' }}
      >
        {dash(distPct, fmtSignedPct)}
      </Box>
    </Box>
  );
}

/** "Updated {rel} ago" — or the dash when there is no honest claim to make (`building`, or a
 *  non-positive `as_of`). `updatedText` branches on status BEFORE it reads `as_of`. */
export function UpdatedCell({ row, nowS }: { row: ScanRow; nowS: number }) {
  const text = updatedText(row, nowS);
  return (
    <Typography
      component="span"
      data-testid="cell-updated"
      sx={{ ...MONO, fontSize: '0.7rem', color: 'text.secondary' }}
    >
      {text ?? EM_DASH}
    </Typography>
  );
}

/** The closed-lookup status chip. `ok` is QUIET (no chip — freshness is the only cue). */
export function StatusCell({ row, nowS }: { row: ScanRow; nowS: number }) {
  const meta = statusMeta(row.status);
  if (meta.label == null || meta.tone == null) return null;
  const rel = Number.isFinite(row.as_of) && row.as_of > 0 ? relAge(nowS - row.as_of) : 'a while';
  return (
    <Tooltip arrow title={meta.tip(rel)}>
      <Box component="span" data-testid="cell-status" data-tone={meta.tone}>
        <TintChip tone={meta.tone} label={meta.label} />
      </Box>
    </Tooltip>
  );
}
```

- [ ] **Step 2: Write `ScanTable.tsx`**

Create `apps/dashboard/src/app/pages/scanner/ScanTable.tsx`:

```tsx
/**
 * `/scanner` — the ≥`sm` dense terminal table (UX §1.1/§1.2): the LOCKED 11-column set in its locked
 * order, a sticky header row, a sticky Symbol column, and `compact` density by default. The table
 * scrolls inside its OWN `overflow-x` container so a wide desktop column set can never make the page
 * body scroll sideways.
 *
 * A row is a NAVIGATION target and nothing else (`[no-real-order-path]`, AC-11): the Symbol cell
 * carries a real `<a href="/ticker/{SYMBOL}">` (keyboard-reachable, opens in a new tab, gets the
 * global `:focus-visible` ring) and the row body forwards a click to the same route. There is no
 * order, trade, or broker affordance anywhere on this surface.
 */
import { Box } from '@mui/material';
import type { ScanDensity, ScanRow, ScanViewSort } from '@org/api';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { extrasFor } from '@/shared/theme/tokens';
import {
  ChgCell,
  LabelCell,
  LevelDistCell,
  MONO,
  PriceCell,
  regimeTextOf,
  ScoreCell,
  StatusCell,
  TierCell,
  UpdatedCell,
  volTextOf,
} from './ScanCells';
import { COLUMN_LABELS, SCAN_COLUMNS, SCAN_COPY, SORTABLE_COLUMNS, type ScanColumn } from './labels';

export interface ScanTableProps {
  rows: ScanRow[];
  sort: ScanViewSort;
  density: ScanDensity;
  nowS: number;
  /** Gate for the sanctioned price flash — off while the sweep is down (nothing is changing). */
  flashActive: boolean;
  onSort: (sort: ScanViewSort) => void;
}

const thSx = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
  textAlign: 'left' as const,
  padding: '9px 10px',
  fontSize: '0.6875rem', // the 11px chip/label type floor
  fontWeight: 600,
  letterSpacing: '.03em',
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  bgcolor: 'background.paper',
  borderBottom: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
};
/** The sticky Symbol column keeps identity on screen while the numerics scroll under it. */
const stickyColSx = { position: 'sticky' as const, left: 0, bgcolor: 'background.paper' };

const sortButtonSx = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit' as const,
  cursor: 'pointer',
};

function ariaSortOf(column: ScanColumn, sort: ScanViewSort): 'ascending' | 'descending' | 'none' {
  const key = SORTABLE_COLUMNS[column];
  if (!key || key !== sort.key) return 'none';
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

function HeaderCell({
  column,
  sort,
  onSort,
}: {
  column: ScanColumn;
  sort: ScanViewSort;
  onSort: (sort: ScanViewSort) => void;
}) {
  const key = SORTABLE_COLUMNS[column];
  const label = COLUMN_LABELS[column];
  const active = key != null && key === sort.key;
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Box
      component="th"
      scope="col"
      aria-sort={ariaSortOf(column, sort)}
      data-testid={`scan-th-${column}`}
      sx={column === 'symbol' ? { ...thSx, ...stickyColSx, zIndex: 3 } : thSx}
    >
      {key ? (
        <Box
          component="button"
          type="button"
          data-testid={`scan-sort-${column}`}
          aria-label={SCAN_COPY.sortAria(label)}
          onClick={() =>
            onSort({ key, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })
          }
          sx={sortButtonSx}
        >
          {label}
          {arrow}
        </Box>
      ) : (
        label
      )}
    </Box>
  );
}

function cellContent(column: ScanColumn, row: ScanRow, nowS: number, flashActive: boolean) {
  switch (column) {
    case 'symbol':
      return (
        <Box
          component={RouterLink}
          to={`/ticker/${row.symbol}`}
          data-testid="scan-row-link"
          sx={{ ...MONO, fontWeight: 600, color: 'text.primary', textDecoration: 'none' }}
        >
          {row.symbol}
        </Box>
      );
    case 'price':
      return <PriceCell row={row} active={flashActive} />;
    case 'chg_pct':
      return <ChgCell row={row} />;
    case 'score':
      return <ScoreCell row={row} />;
    case 'tier':
      return <TierCell row={row} />;
    case 'regime':
      return <LabelCell testid="cell-regime" text={regimeTextOf(row)} />;
    case 'vol_regime':
      return <LabelCell testid="cell-vol" text={volTextOf(row)} />;
    case 'flip':
      return (
        <LevelDistCell level={row.flip} distPct={row.dist_to_flip_pct} testid="cell-dist-flip" />
      );
    case 'walls':
      return (
        <LevelDistCell
          level={row.dist_to_wall_pct != null && row.dist_to_wall_pct >= 0 ? row.call_wall : row.put_wall}
          distPct={row.dist_to_wall_pct}
          testid="cell-dist-wall"
        />
      );
    case 'updated':
      return <UpdatedCell row={row} nowS={nowS} />;
    case 'status':
      return <StatusCell row={row} nowS={nowS} />;
    default:
      return null;
  }
}

function ScanTableRow({
  row,
  density,
  nowS,
  flashActive,
  onOpen,
}: {
  row: ScanRow;
  density: ScanDensity;
  nowS: number;
  flashActive: boolean;
  onOpen: (symbol: string) => void;
}) {
  const tdSx = {
    padding: density === 'compact' ? '7px 10px' : '12px 10px',
    fontSize: density === 'compact' ? '0.8rem' : '0.86rem',
    borderBottom: '1px solid',
    borderColor: 'divider',
    whiteSpace: 'nowrap' as const,
    // Coarse-pointer tap-target floor (≥44px row) without inflating the dense desktop read.
    '@media (pointer: coarse)': { paddingTop: '12px', paddingBottom: '12px' },
  };
  return (
    <Box
      component="tr"
      data-testid="scan-row"
      data-symbol={row.symbol}
      data-status={row.status}
      onClick={() => onOpen(row.symbol)}
      sx={{
        cursor: 'pointer',
        // Hover chrome is NEUTRAL — the row's one amber is the tier chip.
        '&:hover': { bgcolor: (theme) => extrasFor(theme).panelRaised },
      }}
    >
      {SCAN_COLUMNS.map((column) => (
        <Box
          component="td"
          key={column}
          sx={column === 'symbol' ? { ...tdSx, ...stickyColSx } : tdSx}
        >
          {cellContent(column, row, nowS, flashActive)}
        </Box>
      ))}
    </Box>
  );
}

export function ScanTable({ rows, sort, density, nowS, flashActive, onSort }: ScanTableProps) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        // The WIDE content scrolls inside its own container — the page body never scrolls sideways.
        overflowX: 'auto',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <Box
        component="table"
        data-testid="scan-table"
        data-density={density}
        sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}
      >
        <Box component="thead">
          <Box component="tr">
            {SCAN_COLUMNS.map((column) => (
              <HeaderCell key={column} column={column} sort={sort} onSort={onSort} />
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <ScanTableRow
              key={row.symbol}
              row={row}
              density={density}
              nowS={nowS}
              flashActive={flashActive}
              onOpen={(symbol) => navigate(`/ticker/${symbol}`)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Write `ScanCard.tsx`**

Create `apps/dashboard/src/app/pages/scanner/ScanCard.tsx`:

```tsx
/**
 * `/scanner` — the `<sm` card collapse (UX §1.3), mirroring the Positions `PositionCard` shape: one
 * card per symbol, ONE column at phone width, no horizontal overflow at 393px, nothing clipped.
 *
 * The whole card IS the navigation target: it renders as a single block-level `<a>` to
 * `/ticker/{SYMBOL}` (≥44px, keyboard-reachable, global `:focus-visible` ring) and performs no other
 * action (`[no-real-order-path]`, AC-11). It reuses the SAME `ScanCells` atoms as the table, so a
 * datum can never be rendered two ways.
 */
import { Box } from '@mui/material';
import type { ScanRow } from '@org/api';
import { Link as RouterLink } from 'react-router-dom';
import {
  ChgCell,
  LabelCell,
  LevelDistCell,
  MONO,
  PriceCell,
  regimeTextOf,
  ScoreCell,
  StatusCell,
  TierCell,
  UpdatedCell,
  volTextOf,
} from './ScanCells';

export interface ScanCardProps {
  row: ScanRow;
  nowS: number;
  flashActive: boolean;
}

const factSx = { display: 'flex', flexDirection: 'column' as const, gap: '2px', minWidth: 0 };
const factLabelSx = { fontSize: '0.6875rem', color: 'text.secondary' };

export function ScanCard({ row, nowS, flashActive }: ScanCardProps) {
  return (
    <Box
      component={RouterLink}
      to={`/ticker/${row.symbol}`}
      data-testid="scan-card"
      data-symbol={row.symbol}
      data-status={row.status}
      sx={{
        display: 'block',
        minHeight: 44,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        padding: '13px',
      }}
    >
      {/* Header: Symbol · Tier (the amber) · Status (only when not `ok`). */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          mb: '10px',
        }}
      >
        <Box component="span" sx={{ ...MONO, fontWeight: 700, fontSize: '1rem' }}>
          {row.symbol}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <TierCell row={row} />
          <StatusCell row={row} nowS={nowS} />
        </Box>
      </Box>

      {/* Primary line: price (flash) · chg % (the one direction colour). */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontSize: '1.1rem' }}>
        <PriceCell row={row} active={flashActive} />
        <Box component="span" sx={{ fontSize: '0.9rem' }}>
          <ChgCell row={row} />
        </Box>
      </Box>

      {/* Score gets its own labelled line — it is the triage headline. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px', mt: '8px' }}>
        <Box component="span" sx={factLabelSx}>
          Score
        </Box>
        <Box component="span" sx={{ fontSize: '1.05rem' }}>
          <ScoreCell row={row} />
        </Box>
      </Box>

      {/* Secondary 2-col grid — all neutral. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px 12px',
          mt: '10px',
          fontSize: '0.8rem',
        }}
      >
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Regime
          </Box>
          <LabelCell testid="cell-regime" text={regimeTextOf(row)} />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Vol
          </Box>
          <LabelCell testid="cell-vol" text={volTextOf(row)} />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Flip
          </Box>
          <LevelDistCell level={row.flip} distPct={row.dist_to_flip_pct} testid="cell-dist-flip" />
        </Box>
        <Box sx={factSx}>
          <Box component="span" sx={factLabelSx}>
            Wall
          </Box>
          <LevelDistCell
            level={
              row.dist_to_wall_pct != null && row.dist_to_wall_pct >= 0 ? row.call_wall : row.put_wall
            }
            distPct={row.dist_to_wall_pct}
            testid="cell-dist-wall"
          />
        </Box>
      </Box>

      {/* Footer: the freshness line (absent for a `building` row — the status chip says why). */}
      <Box
        sx={{
          mt: '10px',
          pt: '9px',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <UpdatedCell row={row} nowS={nowS} />
      </Box>
    </Box>
  );
}

/** One column at phone width — a 2-up card at 393px crushes the fact grid (the Stage-0 lesson). */
export function ScanCardList({ rows, nowS, flashActive }: { rows: ScanRow[] } & Omit<ScanCardProps, 'row'>) {
  return (
    <Box
      data-testid="scan-cards"
      sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}
    >
      {rows.map((row) => (
        <ScanCard key={row.symbol} row={row} nowS={nowS} flashActive={flashActive} />
      ))}
    </Box>
  );
}
```

- [ ] **Step 4: Write the risk suite's first batch (render invariants)**

Create `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx`:

```tsx
/**
 * `/scanner` — RISK-BASED suite (per `.claude/agents/qa-verify.md` §4 as amended 2026-07-13, and the
 * enumerated set in `UX_BLUEPRINT.md` §6). NOT one test per AC. We test only what can regress
 * SILENTLY and INVISIBLY:
 *
 *   1. the closed status/tier/regime lookups (a miss that GUESSES looks fine on screen),
 *   2. the honesty invariants — `stale` keeps a frozen price WITH its stamp, `building` fabricates
 *      no score and makes no freshness claim, `null` renders `—` and never `0`,
 *   3. the direction-colour boundary — className identity proves score/distance/wall/regime cells are
 *      untinted (the proximity-chip regression class),
 *   4. per-row isolation — one `error` row never takes its neighbours with it,
 *   5. `[no-real-order-path]` — a row/card is a LINK to the ticker page and nothing else,
 *   6. the four page states + the worker-down degrade (Task 7 batch),
 *   7. structural negative space — no "live", no stream primitive (Task 7 batch, mutation-guarded).
 *
 * NOT asserted here (visible + intentional ⇒ review): exact header wording, column labels, chip
 * styling, toolbar control presence. Pure transports live in `format.spec.ts`; the fetch/gate
 * lifecycle lives in `useScan.spec.tsx`.
 *
 * Mocks ONLY the network boundary (`fetch` + `EventSource`). MUI `sx` compiles to CLASSES — we assert
 * className identity, never `getAttribute('style')`.
 */
import { ThemeProvider } from '@mui/material/styles';
import type { ScanRow } from '@org/api';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { theme } from '@/shared/theme/theme';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { SCAN_COLUMNS } from './labels';

const NOW = 1_800_000;

export function makeRow(over: Partial<ScanRow> = {}): ScanRow {
  return {
    symbol: 'SPY',
    price: 500,
    chg_pct: 1.24,
    score: 82,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495,
    dist_to_flip_pct: 1.01,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: 2.0,
    as_of: NOW - 42,
    status: 'ok',
    ...over,
  };
}

function renderTable(rows: ScanRow[]) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ScanTable
          rows={rows}
          sort={{ key: 'score', dir: 'desc' }}
          density="compact"
          nowS={NOW}
          flashActive
          onSort={() => undefined}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function rowFor(symbol: string) {
  return screen
    .getAllByTestId('scan-row')
    .find((r) => r.getAttribute('data-symbol') === symbol) as HTMLElement;
}

afterEach(() => cleanup());

// =================================================================================================
// 1. The locked column set + honestly-missing rendering
// =================================================================================================
describe('the dense table renders the locked columns and never fabricates a value', () => {
  it('every locked column has a header, in order, and an ok row fills them', () => {
    renderTable([makeRow()]);
    const headers = screen
      .getAllByRole('columnheader')
      .map((th) => th.getAttribute('data-testid'));
    expect(headers).toEqual(SCAN_COLUMNS.map((c) => `scan-th-${c}`));
    const row = rowFor('SPY');
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('500.00');
    expect(within(row).getByTestId('cell-chg')).toHaveTextContent('+1.24%');
    expect(within(row).getByTestId('cell-score')).toHaveTextContent('82');
    expect(within(row).getByText('Prime')).toBeInTheDocument(); //   closed tier lookup
    expect(within(row).getByTestId('cell-regime')).toHaveTextContent('Pos γ');
    expect(within(row).getByTestId('cell-vol')).toHaveTextContent('IV rich');
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Updated 42s ago');
  });

  it('null numerics render the em-dash — never 0, never a fabricated value', () => {
    renderTable([
      makeRow({
        symbol: 'NUL',
        price: null,
        chg_pct: null,
        score: null,
        flip: null,
        dist_to_flip_pct: null,
        call_wall: null,
        put_wall: null,
        dist_to_wall_pct: null,
      }),
    ]);
    const row = rowFor('NUL');
    for (const id of ['cell-price', 'cell-chg', 'cell-score', 'cell-dist-flip', 'cell-dist-wall']) {
      expect(within(row).getByTestId(id)).toHaveTextContent('—');
      expect(within(row).getByTestId(id).textContent).not.toMatch(/\b0\b/);
    }
  });
});

// =================================================================================================
// 2. Green/red is PRICE DIRECTION only — className identity (sx compiles to classes)
// =================================================================================================
describe('direction colour never leaks onto a rate or a proximity', () => {
  it('chg_pct differs by sign while score / distances / regime stay className-identical', () => {
    renderTable([
      makeRow({ symbol: 'UPP', chg_pct: 2.5, score: 90, dist_to_flip_pct: 3, dist_to_wall_pct: 4 }),
      makeRow({
        symbol: 'DWN',
        chg_pct: -2.5,
        score: -90,
        dist_to_flip_pct: -3,
        dist_to_wall_pct: -4,
      }),
    ]);
    const up = rowFor('UPP');
    const down = rowFor('DWN');
    // The ONE sanctioned direction colour: the class MUST differ.
    expect(within(up).getByTestId('cell-chg').className).not.toBe(
      within(down).getByTestId('cell-chg').className,
    );
    // Everything else is a rate / a no-side datum: identical classes ⇒ provably untinted.
    for (const id of ['cell-score', 'cell-dist-flip', 'cell-dist-wall', 'cell-regime', 'cell-vol']) {
      expect(
        within(up).getByTestId(id).className,
        `${id} must be className-identical across a positive and a negative row`,
      ).toBe(within(down).getByTestId(id).className);
    }
  });
});

// =================================================================================================
// 3. The per-row honest states
// =================================================================================================
describe('per-row honesty', () => {
  it('a stale row keeps its FROZEN price with its as-of stamp and a ⚠ Stale chip', () => {
    renderTable([makeRow({ symbol: 'STL', price: 55.5, as_of: NOW - 600, status: 'stale' })]);
    const row = rowFor('STL');
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('55.50'); // frozen, not blanked
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('Updated 10m ago');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('⚠ Stale');
    expect(within(row).getByTestId('cell-status')).toHaveAttribute('data-tone', 'warning');
  });

  it('a building row fabricates NO score and makes NO freshness claim (the as_of trap)', () => {
    // A synthesized building row can carry a fresh non-null as_of — it is NOT a freshness claim.
    renderTable([
      makeRow({
        symbol: 'BLD',
        price: null,
        chg_pct: null,
        score: null,
        tier: null,
        as_of: NOW - 3,
        status: 'building',
      }),
    ]);
    const row = rowFor('BLD');
    expect(within(row).getByTestId('cell-score')).toHaveTextContent('—');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('Building');
    expect(within(row).getByTestId('cell-updated')).toHaveTextContent('—');
    expect(row.textContent).not.toMatch(/Updated/); // no fabricated freshness anywhere on the row
  });

  it('one error row degrades ALONE — its neighbours keep rendering their numbers', () => {
    renderTable([
      makeRow({ symbol: 'GOOD', score: 71 }),
      makeRow({ symbol: 'BAD', price: null, score: null, status: 'error' }),
      makeRow({ symbol: 'ALSO', score: 64 }),
    ]);
    expect(within(rowFor('BAD')).getByTestId('cell-status')).toHaveTextContent('⚠ Error');
    expect(within(rowFor('GOOD')).getByTestId('cell-score')).toHaveTextContent('71');
    expect(within(rowFor('ALSO')).getByTestId('cell-score')).toHaveTextContent('64');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(3); // nobody was dropped
  });

  it('an UNKNOWN status is fail-honest (Unavailable), never guessed into a known state', () => {
    renderTable([makeRow({ symbol: 'WAT', status: 'teleporting' as ScanRow['status'] })]);
    const row = rowFor('WAT');
    expect(within(row).getByTestId('cell-status')).toHaveTextContent('Unavailable');
    expect(within(row).getByTestId('cell-status').textContent).not.toMatch(/Stale|Error|Building/);
    expect(within(row).getByTestId('cell-price')).toHaveTextContent('500.00'); // row still renders
  });
});

// =================================================================================================
// 4. `[no-real-order-path]` — a row/card is a LINK to the ticker page and nothing else
// =================================================================================================
describe('navigation only', () => {
  it('table rows and mobile cards expose a real /ticker/{SYMBOL} link and no action control', () => {
    const rows = [makeRow({ symbol: 'SPY' }), makeRow({ symbol: 'QQQ' })];
    const { container, unmount } = renderTable(rows);
    expect(screen.getAllByTestId('scan-row-link').map((a) => a.getAttribute('href'))).toEqual([
      '/ticker/SPY',
      '/ticker/QQQ',
    ]);
    // The only buttons on the table are the column-sort controls — no order/trade affordance.
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.getAttribute('data-testid') ?? '').toMatch(/^scan-sort-/);
    }
    unmount();

    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanCardList rows={rows} nowS={NOW} flashActive />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const cards = screen.getAllByTestId('scan-card');
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/ticker/SPY', '/ticker/QQQ']);
    expect(screen.getByTestId('scan-cards').querySelectorAll('button')).toHaveLength(0);
  });
});
```

- [ ] **Step 5: RED — tint a distance cell, observe the className-identity failure**

In `ScanCells.tsx`, temporarily change `LevelDistCell`'s distance `color: 'text.secondary'` to `color: directionColor(distPct)`, then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx
```
Expected: FAIL —
```
 FAIL  … > direction colour never leaks onto a rate or a proximity > chg_pct differs by sign while score / distances / regime stay className-identical
AssertionError: cell-dist-flip must be className-identical across a positive and a negative row
```
That is exactly the proximity-chip regression class. **Restore** `color: 'text.secondary'`.

- [ ] **Step 6: GREEN**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx
```
Expected:
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/pages/scanner/ScanCells.tsx apps/dashboard/src/app/pages/scanner/ScanTable.tsx apps/dashboard/src/app/pages/scanner/ScanCard.tsx apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx
git commit -m "feat(scanner): dense terminal table (locked columns, sticky symbol+header) + <sm card collapse + the per-row honest states"
```

---

### Task 6: `ScanToolbar` + `ViewEditorDialog` — density/sort controls and the universe-constrained, server-gated editor

> Item **6**. The toolbar carries the view label (**never a persistence claim**), the density control, the Edit-view affordance, and the **inline sign-in prompt** — permanently visible to an anonymous visitor (UX §3.3) and re-raised by any refused write. The dialog builds its symbol choices **from `GET /api/scan/universe` alone** (AC-13: no free-text entry, no add/request path), supports reorder (order IS the ordering), an optional name, and folds the live sort/density into the saved bag. Both take explicit props and own no fetching except the universe read, so they are testable in isolation; the gate wiring is `useScan`'s (Task 4) and the page's (Task 7). RED→GREEN is AC-13: a free-text symbol path must fail.

**Files:**
- Create: `apps/dashboard/src/app/pages/scanner/ScanToolbar.tsx`
- Create: `apps/dashboard/src/app/pages/scanner/ViewEditorDialog.tsx`
- Modify: `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx` (append the controls/editor batch)

**Interfaces:**
- Consumes: `@org/api` (`getScanUniverse`, the Task-1 types); `@/features/auth/SignInPrompt`; `@/features/auth/useGate` (`GateApi`); Task 3's `SCAN_COPY`.
- Produces (Task 7 consumes):
  - `ScanToolbar.tsx`: `interface ScanToolbarProps { view; density; onDensity; onEditView; gate }` · `ScanToolbar(props)`
  - `ViewEditorDialog.tsx`: `interface ViewEditorDialogProps { open; onClose; view; sort; density; saveError; onSave: (draft: ScanViewWrite) => Promise<boolean> }` · `ViewEditorDialog(props)`

- [ ] **Step 1: Write `ScanToolbar.tsx`**

Create `apps/dashboard/src/app/pages/scanner/ScanToolbar.tsx`:

```tsx
/**
 * `/scanner` — the view controls row: which view is showing, the density control, the editor
 * affordance, and the in-context sign-in prompt.
 *
 * Honesty rules enforced here (UX §3.3): the label for the owner-curated default view says
 * "Default view" — it NEVER says "saved", "your", or anything implying persistence for a visitor who
 * has none. The anonymous prompt is standing, not a surprise on click, and it is the SAME prompt a
 * refused write re-raises. Nothing here writes: `onEditView`/`onDensity` are pure UI callbacks.
 */
import { Box, Typography } from '@mui/material';
import type { ScanDensity, ScanView } from '@org/api';
import { SignInPrompt } from '@/features/auth/SignInPrompt';
import type { GateApi } from '@/features/auth/useGate';
import { extrasFor } from '@/shared/theme/tokens';
import { SCAN_COPY } from './labels';

export interface ScanToolbarProps {
  view: ScanView | null;
  density: ScanDensity;
  onDensity: (density: ScanDensity) => void;
  onEditView: () => void;
  gate: GateApi;
}

const DENSITY_OPTIONS: { key: ScanDensity; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'comfortable', label: 'Comfortable' },
];

const segContainerSx = (theme: { palette: { mode: string } }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  bgcolor: extrasFor(theme).panelRaised,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  padding: '3px',
});
const segItemSx = (active: boolean) => (theme: { palette: { mode: string } }) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: active ? 'divider' : 'transparent',
  background: active ? extrasFor(theme).panelRaised : 'transparent',
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: '7px',
  color: active ? 'text.primary' : 'text.secondary',
  whiteSpace: 'nowrap',
});

const editButtonSx = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  background: 'transparent',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'text.primary',
  borderRadius: '8px',
  padding: '7px 13px',
};

/** "Default view" for the owner-curated fallback; the account view's own name (or a neutral
 *  "Your view") once one exists. Never a persistence claim for an anonymous visitor. */
function viewLabel(view: ScanView | null): string {
  if (view?.source !== 'account') return 'Default view';
  return view.name?.trim() ? view.name : 'Your view';
}

export function ScanToolbar({ view, density, onDensity, onEditView, gate }: ScanToolbarProps) {
  // Standing prompt while signed out (UX §3.3); a refused write replaces it with the gate's own text.
  const promptText = gate.promptText ?? (gate.allowed ? null : SCAN_COPY.signInToCustomize);
  return (
    <Box data-testid="scan-toolbar" sx={{ mb: '12px' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <Typography
          component="span"
          data-testid="scan-view-label"
          sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary' }}
        >
          {viewLabel(view)}
        </Typography>

        <Box sx={segContainerSx} role="group" aria-label="Row density" data-testid="scan-density">
          {DENSITY_OPTIONS.map((option) => (
            <Box
              key={option.key}
              component="button"
              type="button"
              aria-pressed={density === option.key}
              data-testid={`scan-density-${option.key}`}
              onClick={() => onDensity(option.key)}
              sx={segItemSx(density === option.key)}
            >
              {option.label}
            </Box>
          ))}
        </Box>

        <Box
          component="button"
          type="button"
          data-testid="scan-edit-view"
          onClick={onEditView}
          sx={{ ...editButtonSx, ml: 'auto' }}
        >
          {SCAN_COPY.editView}
        </Box>
      </Box>

      <Box sx={{ mt: promptText ? '10px' : 0 }}>
        <SignInPrompt
          text={promptText}
          testid="scan-signin-prompt"
          onSignIn={() => gate.signIn(SCAN_COPY.signInToCustomize)}
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Write `ViewEditorDialog.tsx`**

Create `apps/dashboard/src/app/pages/scanner/ViewEditorDialog.tsx`:

```tsx
/**
 * `/scanner` — the view editor (UX §3.3, AC-13). Its symbol choices are BUILT FROM the read-only
 * `GET /api/scan/universe` response and nothing else: there is deliberately no free-text symbol
 * field, no "add ticker" affordance, and no request-tracking flow — a trader cannot invent, add, or
 * request a universe symbol in v1 (`[no-universe-admin]`). Selection ORDER is the display order.
 *
 * Saving is the one gated, state-bearing action: `onSave` runs the caller's `useGate`-wrapped write,
 * whose SERVER answer is the boundary of record. Nothing is written locally here — the dialog holds
 * only draft state and closes only when the server echoed a save.
 */
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import {
  getScanUniverse,
  type ScanDensity,
  type ScanView,
  type ScanViewSort,
  type ScanViewWrite,
} from '@org/api';
import { useEffect, useMemo, useState } from 'react';
import { MONO } from './ScanCells';
import { SCAN_COPY } from './labels';

export interface ViewEditorDialogProps {
  open: boolean;
  onClose: () => void;
  view: ScanView | null;
  sort: ScanViewSort;
  density: ScanDensity;
  saveError: string | null;
  /** Resolves `true` only when the SERVER echoed a saved view. */
  onSave: (draft: ScanViewWrite) => Promise<boolean>;
}

const symbolButtonSx = (selected: boolean) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: selected ? 'primary.main' : 'divider',
  background: 'transparent',
  color: selected ? 'text.primary' : 'text.secondary',
  fontFamily: MONO.fontFamily,
  fontSize: '0.78rem',
  fontWeight: 600,
  borderRadius: '7px',
  padding: '6px 10px',
});

const moveButtonSx = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  background: 'transparent',
  font: 'inherit',
  fontSize: '0.75rem',
  color: 'text.secondary',
  borderRadius: '6px',
  padding: '2px 7px',
  minWidth: 26,
};

export function ViewEditorDialog({
  open,
  onClose,
  view,
  sort,
  density,
  saveError,
  onSave,
}: ViewEditorDialogProps) {
  const [universe, setUniverse] = useState<string[]>([]);
  const [universeFailed, setUniverseFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // The universe is read LAZILY, only when the editor opens — the page's mount path stays one call.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setUniverseFailed(false);
    setSelected(view?.symbols ?? []);
    setName(view?.name ?? '');
    getScanUniverse()
      .then((res) => {
        if (!cancelled) setUniverse(res.symbols);
      })
      .catch(() => {
        if (!cancelled) setUniverseFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, view]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (symbol: string) =>
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );

  const move = (index: number, delta: number) =>
    setSelected((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const submit = async () => {
    setSaving(true);
    const ok = await onSave({
      symbols: selected,
      name: name.trim() ? name.trim() : null,
      sort,
      density,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle data-testid="scan-view-editor">{SCAN_COPY.viewEditorTitle}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '10px' }}>
          {SCAN_COPY.universeHint}
        </Typography>

        {universeFailed && (
          <Typography
            data-testid="scan-universe-unavailable"
            sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '10px' }}
          >
            The tracked universe is unavailable this cycle. Try again shortly.
          </Typography>
        )}

        {/* Choices come from the universe response ALONE — there is no free-text symbol input. */}
        <Box
          data-testid="scan-universe-list"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', mb: '16px' }}
        >
          {universe.map((symbol) => (
            <Box
              key={symbol}
              component="button"
              type="button"
              aria-pressed={selectedSet.has(symbol)}
              data-testid={`scan-universe-${symbol}`}
              onClick={() => toggle(symbol)}
              sx={symbolButtonSx(selectedSet.has(symbol))}
            >
              {symbol}
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: '6px' }}>
          {SCAN_COPY.selectedHeading}
        </Typography>
        <Box
          data-testid="scan-selected-list"
          sx={{ display: 'flex', flexDirection: 'column', gap: '4px', mb: '16px' }}
        >
          {selected.map((symbol, index) => (
            <Box
              key={symbol}
              data-testid="scan-selected-item"
              data-symbol={symbol}
              sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Box component="span" sx={{ ...MONO, fontSize: '0.82rem', minWidth: 64 }}>
                {symbol}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={`${SCAN_COPY.moveUp} ${symbol}`}
                data-testid={`scan-move-up-${symbol}`}
                onClick={() => move(index, -1)}
                sx={moveButtonSx}
              >
                ↑
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={`${SCAN_COPY.moveDown} ${symbol}`}
                data-testid={`scan-move-down-${symbol}`}
                onClick={() => move(index, 1)}
                sx={moveButtonSx}
              >
                ↓
              </Box>
            </Box>
          ))}
        </Box>

        <TextField
          label={SCAN_COPY.viewNameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          inputProps={{ 'data-testid': 'scan-view-name' }}
        />

        {saveError && (
          <Typography
            data-testid="scan-save-error"
            sx={{ fontSize: '0.8rem', color: 'warning.main', mt: '10px' }}
          >
            ⚠ {saveError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="scan-view-cancel">
          {SCAN_COPY.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || selected.length === 0}
          data-testid="scan-view-save"
        >
          {SCAN_COPY.saveView}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: Append the controls/editor batch to the risk suite**

Append to `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx` (and extend its import block with the new modules + helpers):

```tsx
// ---- appended imports (merge into the file's existing import block) ----------------------------
// import { act, fireEvent, waitFor } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
// import { vi } from 'vitest';
// import type { GateApi } from '@/features/auth/useGate';
// import { ScanToolbar } from './ScanToolbar';
// import { ViewEditorDialog } from './ViewEditorDialog';
// import { SORTABLE_COLUMNS } from './labels';

// =================================================================================================
// 5. The controls emit only CLOSED wire vocabulary (a bad key silently breaks view persistence)
// =================================================================================================
describe('sort + density controls speak only the closed wire vocabulary', () => {
  it('a header click emits a closed sort key and toggles direction; aria-sort tracks the active column', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const closedKeys = new Set(Object.values(SORTABLE_COLUMNS));
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanTable
            rows={[makeRow()]}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            nowS={NOW}
            flashActive
            onSort={onSort}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    // The active column advertises its direction; a non-sortable column advertises nothing.
    expect(screen.getByTestId('scan-th-score')).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('scan-th-tier')).toHaveAttribute('aria-sort', 'none');
    expect(screen.queryByTestId('scan-sort-tier')).toBeNull(); // tier is not sortable

    await user.click(screen.getByTestId('scan-sort-score')); // active + desc ⇒ flip to asc
    await user.click(screen.getByTestId('scan-sort-symbol')); // a new column starts at desc
    for (const [{ key, dir }] of onSort.mock.calls) {
      expect(closedKeys.has(key)).toBe(true);
      expect(['asc', 'desc']).toContain(dir);
    }
    expect(onSort.mock.calls[0][0]).toEqual({ key: 'score', dir: 'asc' });
    expect(onSort.mock.calls[1][0]).toEqual({ key: 'symbol', dir: 'desc' });
  });

  it('the density control emits only the closed values and the table carries the rendered density', async () => {
    const user = userEvent.setup();
    const onDensity = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanToolbar
            view={null}
            density="compact"
            onDensity={onDensity}
            onEditView={() => undefined}
            gate={fakeGate({ allowed: true })}
          />
          <ScanTable
            rows={[makeRow()]}
            sort={{ key: 'score', dir: 'desc' }}
            density="comfortable"
            nowS={NOW}
            flashActive
            onSort={() => undefined}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await user.click(screen.getByTestId('scan-density-comfortable'));
    expect(onDensity).toHaveBeenCalledWith('comfortable');
    for (const [value] of onDensity.mock.calls) expect(['compact', 'comfortable']).toContain(value);
    expect(screen.getByTestId('scan-table')).toHaveAttribute('data-density', 'comfortable');
  });
});

// =================================================================================================
// 6. Anonymous copy never overclaims
// =================================================================================================
describe('the toolbar never overclaims persistence', () => {
  it('an anonymous visitor gets the standing sign-in prompt and a "Default view" label — no saved/your claim', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ScanToolbar
            view={{
              source: 'default',
              authenticated: false,
              name: null,
              symbols: ['SPY'],
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            }}
            density="compact"
            onDensity={() => undefined}
            onEditView={() => undefined}
            gate={fakeGate({ allowed: false })}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('scan-signin-prompt')).toHaveTextContent(
      'Sign in to customize your view.',
    );
    expect(screen.getByTestId('scan-view-label')).toHaveTextContent('Default view');
    expect(screen.getByTestId('scan-toolbar').textContent).not.toMatch(/saved|Saved to your account/i);
  });
});

// =================================================================================================
// 7. The editor is universe-constrained (AC-13) and saves the exact draft
// =================================================================================================
describe('the view editor', () => {
  const universe = { symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 };

  function renderEditor(onSave: (d: unknown) => Promise<boolean>) {
    return render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ViewEditorDialog
            open
            onClose={() => undefined}
            view={{
              source: 'account',
              authenticated: true,
              name: null,
              symbols: ['SPY', 'QQQ'],
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            }}
            sort={{ key: 'score', dir: 'desc' }}
            density="compact"
            saveError={null}
            onSave={onSave as never}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it('offers ONLY universe symbols — no free-text entry, no path to an off-universe symbol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(universe), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    renderEditor(async () => true);
    await screen.findByTestId('scan-universe-SPY');
    // Every choice control corresponds to a symbol the SERVER listed.
    const offered = within(screen.getByTestId('scan-universe-list'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(offered).toEqual(universe.symbols);
    expect(screen.queryByTestId('scan-universe-ZZZZ')).toBeNull();
    // The ONLY text input is the optional view NAME — there is no symbol text field to type into.
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute('data-testid', 'scan-view-name');
  });

  it('saves the exact draft: reordered symbols in display order + name + the live sort/density', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(universe), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const onSave = vi.fn(async () => true);
    renderEditor(onSave);
    await screen.findByTestId('scan-universe-NVDA');

    await user.click(screen.getByTestId('scan-universe-NVDA')); // append
    await user.click(screen.getByTestId('scan-move-up-NVDA')); // reorder: order IS the ordering
    await user.type(screen.getByTestId('scan-view-name'), 'Morning');
    await user.click(screen.getByTestId('scan-view-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toEqual({
      symbols: ['SPY', 'NVDA', 'QQQ'],
      name: 'Morning',
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    });
  });
});
```

Add this helper next to `makeRow` in the same file (a `GateApi` double so the toolbar can be driven without the auth providers):

```tsx
/** A minimal GateApi double — the toolbar only reads `allowed`/`promptText` and calls `signIn`. */
export function fakeGate(over: Partial<GateApi> = {}): GateApi {
  return {
    allowed: false,
    promptText: null,
    prompt: () => undefined,
    signIn: () => undefined,
    clear: () => undefined,
    guard: async () => undefined,
    simTradeGate: async () => ({ authorized: true as const }),
    ...over,
  };
}
```

- [ ] **Step 4: RED — add a free-text symbol path, observe AC-13 fail**

In `ViewEditorDialog.tsx`, temporarily add a second `TextField` above the name field:
```tsx
<TextField label="Add symbol" size="small" inputProps={{ 'data-testid': 'scan-add-symbol' }} />
```
then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx
```
Expected: FAIL —
```
 FAIL  … > the view editor > offers ONLY universe symbols — no free-text entry, no path to an off-universe symbol
AssertionError: expected [ <input />, <input /> ] to have a length of 1 but got 2
```
**Remove** the temporary field — the universe is server-curated and has no in-app add path (`[no-universe-admin]`).

- [ ] **Step 5: GREEN**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx
```
Expected:
```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/pages/scanner/ScanToolbar.tsx apps/dashboard/src/app/pages/scanner/ViewEditorDialog.tsx apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx
git commit -m "feat(scanner): view controls + universe-constrained view editor with the server-gated save (no in-app universe add path)"
```

---

### Task 7: `Scanner.tsx` — the page shell, the four states, and the collateral the stub's testid held

> Items **2** (the page shell replacing the stub) and **5** (the page-level states). Composes the header (two-speed basis + glossary), the toolbar, the worker-down banner, and the layout switch (`<sm` ⇒ cards). It also retires the **coming-soon stub's testid and its two entries in the amber census** — five other suites and the Cypress route set reference `scanner-placeholder`, and leaving any of them stale fails the suite by design. RED→GREEN is the worker-down banner: rows must survive it.

**Files:**
- Modify (replace contents): `apps/dashboard/src/app/pages/scanner/Scanner.tsx`
- Delete: `apps/dashboard/src/app/pages/scanner/scanner.spec.tsx`
- Modify: `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx` (append the page-state batch)
- Modify: `apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts` (drop the two coming-soon-stub entries)
- Modify: `apps/dashboard/src/app/app.risk.spec.tsx` (scan stub in the strict fetch mock + testid rename)
- Modify: `apps/dashboard/src/app/pages/positions/positions-page.spec.tsx` (same)

**Interfaces:**
- Consumes: `useScan` (Task 4), `ScanTable`/`ScanCardList` (Task 5), `ScanToolbar`/`ViewEditorDialog` (Task 6), `SCAN_COPY` (Task 3), `@/shared/ui/Jargon`.
- Produces: `Scanner()` — the `/scanner` route element already wired in `app.tsx:63` (`<Route path="/scanner" element={<Scanner />} />`; **no routing change is needed**). Page markers: `scanner-page` · `scan-cadence-header` · `scan-skeleton` · `scan-empty-view` · `scan-worker-down`.

- [ ] **Step 1: Replace `Scanner.tsx`**

Replace the entire contents of `apps/dashboard/src/app/pages/scanner/Scanner.tsx`:

```tsx
/**
 * `/scanner` — the multi-ticker triage surface (UX_BLUEPRINT §0–§3, PRODUCT_CONTRACT §3).
 *
 * One dense table over the tracked universe, POLLED on a stated cadence — no stream, no per-row
 * subscription, and the word this page must never say is never said (`[live-vs-static-isolation]`,
 * AC-9). The page is SELF-DESCRIBING about its own freshness: a two-speed basis in the header with a
 * plain-language glossary, a per-row as-of + status, and a worker-down banner OVER the intact
 * last-known rows when the sweep falls behind (AC-6) — it never 5xx's, never blanks.
 *
 * The four honest states are three distinct things plus a per-row one, and they are deliberately not
 * interchangeable: the first-load SKELETON (shimmer, no numbers) ≠ a `building` ROW (present,
 * tracked, not yet computed) ≠ a DEGRADE (last-known rows under a warning banner). The per-row
 * `ok`/`stale`/`error`/`building` chips come from the closed lookup in `labels.ts`.
 *
 * A row is a link to the Ticker page and nothing else (`[no-real-order-path]`, AC-11); customization
 * is the one gated write and the SERVER refuses it, not this file (`[server-side-gate-enforcement]`).
 */
import { Alert, Box, Skeleton, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Jargon } from '@/shared/ui/Jargon';
import { ScanCardList } from './ScanCard';
import { ScanTable } from './ScanTable';
import { ScanToolbar } from './ScanToolbar';
import { SCAN_COPY } from './labels';
import { useScan } from './useScan';
import { ViewEditorDialog } from './ViewEditorDialog';

/** Hoisted: the skeleton's row count is static, so the array never re-allocates per render. */
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/**
 * The COLD-LOAD placeholder. It is the LOADING look (shimmer, zero figures) and is visually and
 * structurally distinct from a `building` row (a real row that says why it has no score) and from a
 * degrade (real last-known rows under the banner). It must never appear after the first read.
 */
function ScanSkeleton() {
  return (
    <Box
      data-testid="scan-skeleton"
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
        {SCAN_COPY.loading}
      </Typography>
      {SKELETON_ROWS.map((i) => (
        <Skeleton key={i} variant="rectangular" height={26} />
      ))}
    </Box>
  );
}

const ctaSx = {
  mt: '12px',
  cursor: 'pointer',
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  border: 'none',
  font: 'inherit',
  fontSize: '0.82rem',
  fontWeight: 700,
  borderRadius: '8px',
  padding: '8px 15px',
};

export function Scanner() {
  const scan = useScan();
  const [editorOpen, setEditorOpen] = useState(false);
  // `useMediaQuery` takes the STRING form; jsdom has no matchMedia ⇒ false ⇒ the desktop table.
  const isNarrow = useMediaQuery(useTheme().breakpoints.down('sm'));
  // The sanctioned price flash only fires when the data really is turning over.
  const flashActive = !scan.workerDown && !scan.degraded;

  return (
    <Box data-testid="scanner-page" sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: '14px' }}>
        <Typography component="h1" sx={{ fontSize: '1.7rem', fontWeight: 700, m: '0 0 4px' }}>
          {SCAN_COPY.heading}
        </Typography>
        <Typography component="p" sx={{ fontSize: '0.88rem', color: 'text.secondary', m: 0 }}>
          {SCAN_COPY.subhead}
        </Typography>
        {/* The two-speed basis, always present, with its plain-language glossary on hover/focus. */}
        <Typography
          component="p"
          data-testid="scan-cadence-header"
          sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: '8px', mb: 0 }}
        >
          <Jargon term={SCAN_COPY.cadenceHeader} gloss={SCAN_COPY.cadenceGloss} />
        </Typography>
      </Box>

      <ScanToolbar
        view={scan.view}
        density={scan.density}
        onDensity={scan.setDensity}
        onEditView={() => setEditorOpen(true)}
        gate={scan.gate}
      />

      {/* Worker-down: a TRUE warning ⇒ burnt orange + MUI's built-in warning icon, sitting OVER the
          intact rows. The rows below keep rendering — a worker death never takes the page down. */}
      {scan.phase === 'ready' && scan.workerDown && (
        <Alert severity="warning" data-testid="scan-worker-down" sx={{ mb: '12px' }}>
          {scan.workerDownText}
        </Alert>
      )}

      {scan.phase === 'loading' ? (
        <ScanSkeleton />
      ) : scan.isEmptyView ? (
        <Box data-testid="scan-empty-view">
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {SCAN_COPY.emptyViewTitle}
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: 'text.secondary' }}>
            {SCAN_COPY.emptyViewBody}
          </Typography>
          {scan.view?.authenticated && (
            <Box
              component="button"
              type="button"
              data-testid="scan-empty-cta"
              onClick={() => setEditorOpen(true)}
              sx={ctaSx}
            >
              {SCAN_COPY.editView}
            </Box>
          )}
        </Box>
      ) : isNarrow ? (
        <ScanCardList rows={scan.rows} nowS={scan.nowS} flashActive={flashActive} />
      ) : (
        <ScanTable
          rows={scan.rows}
          sort={scan.sort}
          density={scan.density}
          nowS={scan.nowS}
          flashActive={flashActive}
          onSort={scan.setSort}
        />
      )}

      <ViewEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        view={scan.view}
        sort={scan.sort}
        density={scan.density}
        saveError={scan.saveError}
        onSave={scan.saveView}
      />
    </Box>
  );
}

export default Scanner;
```

- [ ] **Step 2: Delete the stub's suite and drop its two amber-census entries**

```bash
cd C:/Dev/gammaflow-web && git rm apps/dashboard/src/app/pages/scanner/scanner.spec.tsx
```

In `apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts`, **delete** the scanner entry from `MOVE_TO_INFO_SITES` (both lists are asserted "live", so a stale entry fails the suite):

```ts
  {
    file: '/src/app/pages/scanner/Scanner.tsx',
    marker: 'data-testid="scanner-ticker-link"',
    window: 'after',
  },
```

and **delete** the scanner entry from `TEXT_AMBER_CONSUMERS`:

```ts
  '/src/app/pages/scanner/Scanner.tsx', //                       coming-soon pill (11px)
```

Add this note above `TEXT_AMBER_CONSUMERS` so the removal is self-documenting:

```ts
// (scanner) The `/scanner` coming-soon stub's 11px amber pill and its Ticker link were RETIRED with
// the real Scanner page (Scanner v1 P4). The scan surface's one amber spend is the per-row tier
// chip, which lives in `shared/ui/TintChip.tsx` — already on this list.
```

- [ ] **Step 3: Re-point the collateral suites (strict fetch mocks + the retired testid)**

`apps/dashboard/src/app/app.risk.spec.tsx` — the fetch mock THROWS on any unexpected call, so `/api/scan` must be handled. Add these two branches immediately **before** the `if (url.includes('/api/auth/session'))` line:

```ts
    // scanner: the /scanner route polls the scan read on mount (poll-based, no SSE).
    if (url.includes('/api/scan/universe')) return json({ symbols: ['SPY'], universe_size: 1 });
    if (url.includes('/api/scan'))
      return json({
        view: {
          source: 'default',
          authenticated: false,
          name: null,
          symbols: ['SPY'],
          sort: { key: 'score', dir: 'desc' },
          density: 'compact',
        },
        rows: [
          {
            symbol: 'SPY',
            price: 500,
            chg_pct: 1,
            score: 82,
            tier: 'prime',
            regime: 'positive_gamma',
            vol_regime: 'iv_rich',
            flip: 495,
            dist_to_flip_pct: 1,
            call_wall: 510,
            put_wall: 490,
            dist_to_wall_pct: 2,
            as_of: Date.now() / 1000,
            status: 'ok',
          },
        ],
        sweep: {
          updated_at: Date.now() / 1000,
          sweep_last_completed: Date.now() / 1000,
          universe_size: 1,
        },
      });
```

Then replace all four `scanner-placeholder` occurrences in that file with `scanner-page` (lines 136, 214, 238 and the walk entry):

```bash
cd C:/Dev/gammaflow-web && node -e "const f='apps/dashboard/src/app/app.risk.spec.tsx';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').split('scanner-placeholder').join('scanner-page'));console.log('app.risk.spec.tsx re-pointed')"
```

`apps/dashboard/src/app/pages/positions/positions-page.spec.tsx` — add the **same two branches** immediately before its `if (url.includes('/api/auth/session'))` line, then:

```bash
cd C:/Dev/gammaflow-web && node -e "const f='apps/dashboard/src/app/pages/positions/positions-page.spec.tsx';const fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').split('scanner-placeholder').join('scanner-page'));console.log('positions-page.spec.tsx re-pointed')"
```

Confirm nothing stale remains:
```bash
cd C:/Dev/gammaflow-web && rg -n "scanner-placeholder|scanner-ticker-link" apps/dashboard apps/dashboard-e2e || echo "CLEAN: the coming-soon markers are fully retired (the e2e set lands in Task 8)"
```
Expected at this point: only `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts` still matches (Task 8 handles it). Every `apps/dashboard/src` match must be gone.

- [ ] **Step 4: Append the page-state batch to the risk suite**

Append to `apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx`:

```tsx
// ---- appended imports (merge into the file's existing import block) ----------------------------
// import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
// import { AuthProvider } from '@/features/auth/AuthContext';
// import { Scanner } from './Scanner';

// =================================================================================================
// 8. The page-level states + the structural negative space
// =================================================================================================
type PageOpts = {
  symbols?: string[];
  rows?: ScanRow[];
  sweep?: { updated_at: number; sweep_last_completed: number | null; universe_size: number } | null;
  authenticated?: boolean;
  hold?: boolean; // keep the first read in flight so the skeleton stays visible
};

function installScanBackend(opts: PageOpts = {}) {
  const nowS = Date.now() / 1000;
  const symbols = opts.symbols ?? ['SPY', 'QQQ'];
  const body = {
    view: {
      source: opts.authenticated ? 'account' : 'default',
      authenticated: !!opts.authenticated,
      name: null,
      symbols,
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    },
    rows: opts.rows ?? symbols.map((symbol, i) => makeRow({ symbol, score: 90 - i })),
    sweep:
      opts.sweep === undefined
        ? { updated_at: nowS, sweep_last_completed: nowS, universe_size: symbols.length }
        : opts.sweep,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (b: unknown) =>
        new Response(JSON.stringify(b), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/api/auth/session'))
        return json({
          authenticated: !!opts.authenticated,
          user: opts.authenticated
            ? { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }
            : null,
          google_available: false,
          settings: opts.authenticated
            ? { active_persona_id: null, default_ticker: null, theme: 'dark' }
            : null,
        });
      if (url.includes('/api/scan/universe')) return json({ symbols, universe_size: symbols.length });
      if (url.includes('/api/scan')) {
        if (opts.hold) return new Promise<Response>(() => undefined); // never resolves
        return json(body);
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthProvider>
          <AuthDialogProvider>
            <Scanner />
          </AuthDialogProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('the four honest page states', () => {
  it('the first-load SKELETON is its own state — no figures, and it is gone after the read', async () => {
    installScanBackend({ hold: true });
    const { unmount } = renderPage();
    const skeleton = await screen.findByTestId('scan-skeleton');
    expect(skeleton.textContent).toBe('Loading scan…'); // shimmer only — never a number
    expect(screen.queryByTestId('scan-table')).toBeNull();
    expect(screen.queryByTestId('scan-worker-down')).toBeNull(); // loading ≠ degraded
    expect(screen.queryByText('Building')).toBeNull(); //           loading ≠ building
    unmount();

    installScanBackend();
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.queryByTestId('scan-skeleton')).toBeNull(); // never reappears post-load
  });

  it('the anonymous default view is POPULATED — no empty block, no error, no persistence claim', async () => {
    installScanBackend({ authenticated: false, symbols: ['SPY', 'QQQ', 'NVDA'] });
    renderPage();
    await screen.findByTestId('scan-table');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(3);
    expect(screen.queryByTestId('scan-empty-view')).toBeNull(); // anonymous NEVER reaches it (D2)
    expect(await screen.findByTestId('scan-signin-prompt')).toHaveTextContent(
      'Sign in to customize your view.',
    );
    expect(screen.getByTestId('scanner-page').textContent).not.toMatch(/Saved to your account/i);
  });

  it('a signed-in EMPTY saved view gets the pick-tickers affordance instead of a dead screen', async () => {
    installScanBackend({ authenticated: true, symbols: [], rows: [] });
    renderPage();
    const empty = await screen.findByTestId('scan-empty-view');
    expect(empty).toHaveTextContent('No tickers in your view.');
    expect(empty).toHaveTextContent('Pick tickers to build your scan.');
    expect(screen.getByTestId('scan-empty-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('scan-table')).toBeNull();
  });

  it('a behind or absent sweep raises the banner OVER intact rows — never a blank or an error page', async () => {
    const nowS = Date.now() / 1000;
    installScanBackend({
      sweep: { updated_at: nowS - 900, sweep_last_completed: nowS - 180, universe_size: 2 },
    });
    const { unmount } = renderPage();
    const banner = await screen.findByTestId('scan-worker-down');
    expect(banner).toHaveTextContent('Sweep last ran 3 min ago — showing the last known rows.');
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2); // the rows SURVIVE the banner
    expect(within(rowFor('SPY')).getByTestId('cell-score')).toHaveTextContent('90');
    unmount();

    installScanBackend({ sweep: null });
    renderPage();
    expect(await screen.findByTestId('scan-worker-down')).toHaveTextContent(
      "Sweep hasn't reported yet — showing the last known rows.",
    );
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2);
  });
});

// =================================================================================================
// 9. Structural negative space (mutation-guarded `?raw` scans + a DOM sweep)
// =================================================================================================
const SCANNER_SOURCES = import.meta.glob(
  ['/src/app/pages/scanner/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Strip comments while PRESERVING newlines (the house idiom) so line numbers stay true. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^\s*\/\/.*$/gm, '');
}
const hasLiveWord = (src: string) => /\blive\b/i.test(stripComments(src));
const hasStreamPrimitive = (src: string) => /\bEventSource\b|\bstreamTicker\b/.test(stripComments(src));
const usesBareExtras = (src: string) =>
  /\bextras\./.test(stripComments(src)) || /\bextrasLight\./.test(stripComments(src));

describe('[live-vs-static-isolation] + [theme-token-discipline] on the scan surface', () => {
  it('the glob is not vacuous (the scanner sources actually loaded)', () => {
    const keys = Object.keys(SCANNER_SOURCES);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    expect(keys).toContain('/src/app/pages/scanner/Scanner.tsx');
    expect(keys).toContain('/src/app/pages/scanner/useScan.ts');
  });

  it('MUTATION GUARD: every checker flags its violation fixture and passes a clean one', () => {
    expect(hasLiveWord('const label = "live feed";')).toBe(true);
    expect(hasLiveWord('/* the word live in a comment */ const x = 1;')).toBe(false);
    expect(hasLiveWord('const x = "polled snapshot";')).toBe(false);
    expect(hasStreamPrimitive('const es = new EventSource(url);')).toBe(true);
    expect(hasStreamPrimitive('streamTicker(sym, {}, cb)')).toBe(true);
    expect(hasStreamPrimitive('const id = setInterval(poll, 30000);')).toBe(false);
    expect(usesBareExtras('color: extras.textAmber')).toBe(true);
    expect(usesBareExtras('color: extrasFor(theme).panelRaised')).toBe(false);
  });

  it('no scanner source says "live", mounts a stream, or dark-locks a mode-aware value', () => {
    const live: string[] = [];
    const streams: string[] = [];
    const bare: string[] = [];
    for (const [file, src] of Object.entries(SCANNER_SOURCES)) {
      if (hasLiveWord(src)) live.push(file);
      if (hasStreamPrimitive(src)) streams.push(file);
      if (usesBareExtras(src)) bare.push(file);
    }
    expect(live, 'AC-9: the scan surface never uses the word "live"').toEqual([]);
    expect(streams, '[live-vs-static-isolation]: the scan surface is poll-only').toEqual([]);
    expect(bare, 'mode-aware values must resolve via extrasFor(theme)').toEqual([]);
  });

  it('the RENDERED page never says "live" — with all four row states on screen', async () => {
    const nowS = Date.now() / 1000;
    installScanBackend({
      symbols: ['OKY', 'STL', 'ERR', 'BLD'],
      rows: [
        makeRow({ symbol: 'OKY', status: 'ok', as_of: nowS - 10 }),
        makeRow({ symbol: 'STL', status: 'stale', as_of: nowS - 900 }),
        makeRow({ symbol: 'ERR', status: 'error', price: null, score: null, as_of: nowS - 60 }),
        makeRow({ symbol: 'BLD', status: 'building', price: null, score: null, tier: null, as_of: nowS }),
      ],
    });
    renderPage();
    await screen.findByTestId('scan-table');
    const page = screen.getByTestId('scanner-page');
    expect(page.textContent ?? '').not.toMatch(/\blive\b/i);
    expect(page.textContent ?? '').toMatch(/Prices ~30s · structure ~3 min · hot names sooner/);
    expect(screen.getAllByTestId('scan-row')).toHaveLength(4);
  });
});
```

Add this to the file's `afterEach` so each page render starts from a clean network:

```tsx
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
```

- [ ] **Step 5: RED — let the worker-down banner replace the rows, observe FAIL**

In `Scanner.tsx`, temporarily change the body branch to `scan.phase === 'loading' || scan.workerDown ? <ScanSkeleton /> : …` (i.e. the degrade swallows the table), then run:
```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx
```
Expected: FAIL —
```
 FAIL  … > the four honest page states > a behind or absent sweep raises the banner OVER intact rows — never a blank or an error page
TestingLibraryElementError: Unable to find an element by: [data-testid="scan-row"]
```
That is the AC-6 failure mode: a worker death taking the page's content with it. **Restore** the `scan.phase === 'loading' ? …` branch.

- [ ] **Step 6: GREEN — the scanner suite, then the two collateral suites**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run pages/scanner
```
Expected:
```
 Test Files  3 passed (3)
      Tests  39 passed (39)
```
(`format.spec.ts` 10 + `useScan.spec.tsx` 8 + `scanner.risk.spec.tsx` 21 — the 8 render-invariant cases from Task 5, the 5 control/editor cases from Task 6, and the 8 page-state + structural cases added here.)

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run app.risk.spec.tsx pages/positions/positions-page.spec.tsx shared/theme/stage3-amber.spec.ts
```
Expected: `Test Files  3 passed (3)` — the route walk resolves `/scanner` to `scanner-page`, the positions nav round-trip still finds it, and the amber census no longer references the retired stub.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/pages/scanner apps/dashboard/src/app/app.risk.spec.tsx apps/dashboard/src/app/pages/positions/positions-page.spec.tsx apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts
git commit -m "feat(scanner): the /scanner page shell — two-speed header, four honest states, <sm card collapse; retire the coming-soon stub"
```

---

### Task 8: `/scanner` joins the 393px no-overflow e2e set + the full GATE-Q verification sweep

> Item **4**'s enforcement half plus the mechanical GATE-Q surface. `/scanner` re-enters the Cypress real-browser route set with the scan endpoints stubbed (an error/blank page would make the overflow check vacuous), and the run additionally proves the **card collapse actually happens** at 393px. Then the full FE verification sweep, the FE-only structural proof (`apps/api` diff empty), and the invariant scans.

**Files:**
- Modify: `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts`

**Interfaces:**
- Consumes: the shipped page (Tasks 1–7).
- Produces: the GATE-Q evidence — 393px no-overflow in both schemes on `/scanner`, the card-collapse proof, the full unit suite, typecheck, lint, build, and the empty-backend-diff proof.

- [ ] **Step 1: Stub the scan endpoints in the Cypress network boundary**

In `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts`, add a module-level fixture next to `bundle` (after the `bundle` object, before `ROUTES`):

```ts
/** Interface-shaped scan payload — enough for a content-full table/card render at 393px. An error
 *  or blank page would make the overflow assertion vacuous. */
const scan = {
  view: {
    source: 'default',
    authenticated: false,
    name: null,
    symbols: ['SPY', 'QQQ', 'NVDA'],
    sort: { key: 'score', dir: 'desc' },
    density: 'compact',
  },
  rows: ['SPY', 'QQQ', 'NVDA'].map((symbol, i) => ({
    symbol,
    price: 500.25 + i,
    chg_pct: i === 1 ? -1.42 : 1.24,
    score: 82 - i,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495.5,
    dist_to_flip_pct: 1.01,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: 1.94,
    as_of: Math.floor(Date.now() / 1000) - 42,
    status: 'ok',
  })),
  sweep: {
    updated_at: Math.floor(Date.now() / 1000),
    sweep_last_completed: Math.floor(Date.now() / 1000) - 30,
    universe_size: 3,
  },
};
```

Add the two intercepts inside `stubNetwork()` (order matters — the more specific path first):

```ts
  cy.intercept('GET', '/api/scan/universe*', {
    body: { symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 },
  });
  cy.intercept('GET', '/api/scan*', { body: scan });
```

- [ ] **Step 2: Re-point the route marker and prove the card collapse**

In the same file, replace the `/scanner` `ROUTES` entry:

```ts
  { path: '/scanner', ready: () => cy.get('[data-testid="scanner-page"]') },
```

and replace the two `[data-testid="scanner-placeholder"]` lookups in the mobile-nav test with:

```ts
      cy.get('[data-testid="scanner-page"]');
```

Then add this case inside each scheme's `describe` block, immediately after the `for (const r of ROUTES) { … }` loop:

```ts
    it('/scanner collapses the dense table to cards below sm (no clipped columns at 393px)', () => {
      cy.visit('/scanner', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
        },
      });
      cy.get('[data-testid="scanner-page"]');
      // The 11-column terminal table does not exist at phone width — cards do.
      cy.get('[data-testid="scan-cards"]').should('exist');
      cy.get('[data-testid="scan-table"]').should('not.exist');
      cy.get('[data-testid="scan-card"]').should('have.length', 3);
      // The whole card is the navigation target, and it goes to the Ticker page — nothing else.
      cy.get('[data-testid="scan-card"]').first().should('have.attr', 'href', '/ticker/SPY');
      assertNoHorizontalOverflow();
    });
```

- [ ] **Step 3: Run the e2e set (real browser, both schemes)**

```bash
cd C:/Dev/gammaflow-web && npx nx e2e dashboard-e2e
```
Expected: all specs green, including
```
  393px no-overflow · dark scheme
    ✓ / fits the viewport (scrollWidth <= innerWidth)
    ✓ /ticker/TSLA fits the viewport (scrollWidth <= innerWidth)
    ✓ /positions fits the viewport (scrollWidth <= innerWidth)
    ✓ /scanner fits the viewport (scrollWidth <= innerWidth)
    ✓ /settings fits the viewport (scrollWidth <= innerWidth)
    ✓ /scanner collapses the dense table to cards below sm (no clipped columns at 393px)
    ✓ below md the nav collapses: hamburger present, no inline nav row
  393px no-overflow · light scheme
    … (the same 7)
```
If `/scanner` fails the overflow assertion, the cause is a card child that does not shrink — add `minWidth: 0` to the offending flex/grid child in `ScanCard.tsx` (the fact-grid cells already carry it).

- [ ] **Step 4: The full unit suite — state the new totals**

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard
```
Expected:
```
 Test Files  75 passed (75)
      Tests  643 passed (643)
```
Arithmetic from the pinned baseline (73 files / 606 tests): **+3 files** (`pages/scanner/format.spec.ts`, `pages/scanner/useScan.spec.tsx`, `pages/scanner/scanner.risk.spec.tsx`) **−1 file** (`pages/scanner/scanner.spec.tsx`, deleted) = **75**; **+39 tests** (10 + 8 + 21) **−2 tests** (the deleted stub suite) = **643**. The two `TintChip`/`useFlashOnChange` spec moves are relocations, so they change neither number. If a spec fails, re-run that file alone once — two timing-flaky specs exist and a clean rerun is the tiebreaker.

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/api
```
Expected: `Test Files  1 passed (1)` / `Tests  18 passed (18)`.

- [ ] **Step 5: Typecheck, lint, build**

```bash
cd C:/Dev/gammaflow-web && npx tsc -b apps/dashboard/tsconfig.app.json --force
```
Expected: no output, exit 0.

```bash
cd C:/Dev/gammaflow-web && npx nx run @org/dashboard:typecheck && npx nx lint @org/dashboard && npx nx lint @org/api
```
Expected: typecheck succeeds; `@org/dashboard` lint reports **29 warnings, 0 errors** (the pre-existing count — a new warning means the new code introduced it and must be fixed); `@org/api` lint clean. The `@nx/enforce-module-boundaries` rule is satisfied by construction: `pages/scanner/` imports only `@/shared/*`, `@/features/auth/*` and `@org/api` (`scope:shared`, `type:lib`).

```bash
cd C:/Dev/gammaflow-web && npx nx build @org/dashboard
```
Expected: `Successfully ran target build for project @org/dashboard`.

- [ ] **Step 6: The FE-only structural proof + the invariant scans**

```bash
cd C:/Dev/gammaflow-web && git diff --stat main -- apps/api/ ; echo "---" ; git status --porcelain apps/api/ ; echo "APPS/API UNTOUCHED (no output above = pass)"
```
Expected: no `apps/api/` lines at all — `[additive-keeps-score-byte-identical]` for an FE-only phase: the backend, the engine, and every score/tier/fingerprint are byte-identical because nothing in `apps/api/` changed.

```bash
cd C:/Dev/gammaflow-web && rg -n "EventSource|streamTicker" apps/dashboard/src/app/pages/scanner --glob '!*.spec.*' || echo "CLEAN: poll-only surface (no stream primitive)"
cd C:/Dev/gammaflow-web && rg -n "#[0-9a-fA-F]{3,8}\b" apps/dashboard/src/app/pages/scanner --glob '!*.spec.*' || echo "CLEAN: zero hardcoded hex in pages/scanner"
cd C:/Dev/gammaflow-web && rg -n "@keyframes" apps/dashboard/src/app/pages/scanner || echo "CLEAN: the scanner declares no keyframe (the flash-* family is reused, inventory stays set-equal)"
cd C:/Dev/gammaflow-web && rg -n "fetch\(|axios|XMLHttpRequest" apps/dashboard/src/app/pages/scanner --glob '!*.spec.*' || echo "CLEAN: no raw network call in pages/scanner (all reads go through @org/api)"
```
Expected: four `CLEAN: …` lines.

```bash
cd C:/Dev/gammaflow-web && npx nx test @org/dashboard -- --run shared/theme
```
Expected: `Test Files  10 passed (10)` — the whole design-enforcement family (hex discipline, banned hexes, stage-1/stage-3 tokens, the keyframe set-equality, focus-visible, fonts, warning-icon, brand assets, blog tokens) is green with the promotions and the new page in place.

- [ ] **Step 7: Eyes-on review pass (the `review:` half of UX §6 — record in the commit body)**

Boot both processes and walk the surface. This is the non-automated half; the automated half is Steps 3–6.

```bash
# terminal 1
cd C:/Dev/gammaflow-web && npx nx serve api
# terminal 2
cd C:/Dev/gammaflow-web && npx nx serve dashboard    # http://localhost:4200/scanner
```

Confirm, in **both** color schemes (toggle via `/settings`):
1. **AC-1** — signed out, `/scanner` shows a populated read-only table plus "Sign in to customize your view." — not a blank, not an error, no persistence claim.
2. **AC-9** — the header reads `Prices ~30s · structure ~3 min · hot names sooner`; hovering it shows the glossary; the word "live" appears nowhere; the only motion is the price-cell flash, and it stops entirely under OS "reduce motion".
3. **AC-7 / AC-8** — a `stale` row shows a frozen price **with** its "Updated …" stamp and a ⚠ Stale chip; a `building` row shows dashes, a Building chip, and **no** "Updated" line.
4. **AC-11 / AC-12** — clicking a row (and a card at 393px) lands on that symbol's Ticker page with identical content to a cold load; no order/trade control exists anywhere on the scan surface.
5. Default sort is Score-descending; changing sort/density and saving persists it across a reload (**AC-2**); all 11 columns are present; row and card focus rings are visible on keyboard tab.
6. Dark/light parity: no washed-out chip, no invisible label, `panelRaised` hover reads correctly in both.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts
git commit -m "test(scanner): /scanner joins the 393px no-overflow e2e route set + the <sm card-collapse proof"
```

---

## Self-Review

**1. Spec coverage — every item this plan MUST cover maps to a task:**

| Required item | Task(s) | Evidence |
|---|---|---|
| 1. `libs/api` scanner fetchers + types consuming `INTERFACE_CONTRACT` exactly | **1** | The 14 FIXED `ScanRow` keys, `ScanView`/`SweepHeartbeat`/`ScanResponse`/`ScanUniverse`/`ScanViewWrite`, all nullables honored, **no invented keys**; reads reject on transport faults, the WRITE maps 403/503/422 to typed `AuthError`s. |
| 2. The `/scanner` page shell replacing the stub, stated poll cadence, no SSE, hidden-tab auto-pause | **4**, **7** | `SCAN_POLL_MS = 30_000` (matches the fast lane + the stated header), one stable interval with a ref-read visibility gate + one catch-up read on resume (the `useLatencyTrend` precedent); routing already exists at `app.tsx:63` so **no route change**; structural scan proves no stream primitive. |
| 3. The dense terminal table — locked column set/order, score-desc default, compact density, sticky Symbol + header, nulls as `—` | **3**, **5** | `SCAN_COLUMNS` is the locked 11 in order (header-order test); `DEFAULT_SORT = {score, desc}`; `data-density`; `stickyColSx` + sticky `thead`; `dash()` renders `—` and a real `0` stays `0`. |
| 4. The `<sm` mobile card collapse; `/scanner` joins the 393px e2e set | **5**, **7**, **8** | `ScanCard`/`ScanCardList` mirror the `PositionCard` shape (1 column at phone width); `useMediaQuery(theme.breakpoints.down('sm'))` STRING form in `Scanner.tsx`; the Cypress route set gains `/scanner` in both schemes **plus** an explicit collapse + link-target case. |
| 5. The four states — skeleton (distinct) · empty view · worker-down banner over intact rows · per-row status via **closed lookup, never re-derived** | **3**, **5**, **7** | `ScanSkeleton` (shimmer, zero figures, never post-load); `scan-empty-view` (signed-in only); `Alert severity="warning"` over intact rows with both pinned copy variants; `statusMeta()` closed lookup + `UNAVAILABLE_STATUS_META` fail-honest fallback. |
| 6. The view editor — universe subset + reorder + optional name + sort/density; **gated save** via `useGate`; signed-out gets the read-only default + inline prompt | **4**, **6** | Choices built from `getScanUniverse()` alone (no free-text field — RED→GREEN); `move()` reorder; `saveView` wraps `saveScanView` in `gate.guard(...)`; signed-out ⇒ zero PUT + zero `localStorage`; 403 ⇒ abort before any state write; standing `SignInPrompt` in the toolbar. |
| 7. Risk-based tests per `qa-verify.md` §4 + `UX_BLUEPRINT` §6 | **1**, **3**–**8** | 39 new dashboard tests + 5 client tests, all invariant/negative-space; copy, column labels and chip styling are left to review. |
| The P3-deferred ACs (AC-11; the visual halves of AC-1/7/8/9/12) | **5**, **7**, **8** | AC-11: real `/ticker/{SYMBOL}` hrefs + "the only buttons are sort controls". AC-1: the populated-anonymous page test. AC-7/8: the frozen-price and no-fabricated-score tests. AC-9: the source + DOM `\blive\b` scans and the no-stream scan. AC-12: the Step-7 eyes-on walk (speed-only is not machine-observable). |

**2. Invariants structurally preserved:** `[theme-token-discipline]` — zero hex (the existing `hex-discipline.spec.ts` glob already covers `pages/scanner/**`, plus a direct `rg` in Task 8 Step 6) and a mutation-guarded `extrasFor` scan. `[digested-labels-not-raw-dump]` — closed lookups with a fail-honest miss, unit- and render-tested. `[model-read-carries-its-assumptions]` — per-row `as_of`+status, the two-speed header, and the `building` `as_of` trap guarded twice (unit RED→GREEN in Task 3, render-level in Task 5). `[live-vs-static-isolation]` — poll only, mutation-guarded source scan + DOM sweep + `flashActive` gating, no new keyframe family (the set-equality spec is re-pointed, never widened). `[server-side-gate-enforcement]` — RED→GREEN in Task 4; the FE check is UX only and nothing is written locally. `[no-real-order-path]` — link-only rows/cards, asserted by construction (every `<button>` on the table must match `^scan-sort-`; the card list has zero). `[additive-keeps-score-byte-identical]` — the `apps/api` diff is proven empty at Task 1 Step 5 and Task 8 Step 6. convexa-design — one amber spend (tier `TintChip emphasis`), direction colour on `chg_pct` alone (className-identity RED→GREEN), warnings always glyphed/iconed, ≥11px labels, ≥44px coarse-pointer targets, authored focus rings inherited from the theme.

**3. Placeholder scan:** no TBD/TODO/"similar to Task N". Every step carries full source or an exact command with its expected output. Seven RED→GREEN disciplines: Task 1 (the gated-write error mapping), Task 2 (the keyframe set-equality catching the move), Task 3 (the `building` `as_of` trap), Task 4 (the server gate), Task 5 (direction-colour leakage onto a distance), Task 6 (AC-13's no-free-text rule), Task 7 (the degrade swallowing the rows).

**4. Type consistency across tasks:** `ScanRow`/`ScanView`/`ScanViewSort`/`ScanDensity`/`ScanViewWrite`/`SweepHeartbeat`/`ScanResponse`/`ScanUniverse`/`ScanStatus` are defined once in Task 1 and imported everywhere after. `saveView` is `(draft: ScanViewWrite) => Promise<boolean>` in `ScanApi` (Task 4), in `ViewEditorDialogProps.onSave` (Task 6), and at the `Scanner.tsx` call site (Task 7). `statusMeta`/`tierLabel`/`regimeLabel`/`volRegimeLabel`/`SCAN_COPY`/`SCAN_COLUMNS`/`COLUMN_LABELS`/`SORTABLE_COLUMNS` are named identically in Tasks 3, 5, 6 and 7. `MONO` is exported from `ScanCells.tsx` and consumed by `ScanTable`/`ScanCard`/`ViewEditorDialog`. `flashActive` is the prop name in `ScanTableProps`, `ScanCardProps` and the `Scanner.tsx` call sites. `makeRow`/`fakeGate`/`rowFor`/`installScanBackend`/`renderPage` are defined once each in `scanner.risk.spec.tsx` and reused by the later batches. `SWEEP_DOWN_AFTER_S` lives in `format.ts` only; `SCAN_POLL_MS`/`SCAN_CLOCK_MS`/`DEFAULT_SORT` live in `useScan.ts` only.

**5. Grounded in real code:** mirrors `features/trading/positions/PositionsView.tsx` (the `useMediaQuery` STRING-form layout switch, `thSx`/`tdPad` density idiom, the framed table container), `PositionRow.tsx`/`PositionCard.tsx` (the `MONO` cell + card-collapse shape), `CustomizationToolbar.tsx` (the `Segmented` pill controls + `extrasFor(theme).panelRaised`), `pages/operator-metrics/useLatencyTrend.ts` (the one-interval + ref-gated visibility poll), `pages/positions/PositionsPage.tsx` (the page frame: `maxWidth: 1240, mx: 'auto', p: 3`), `features/auth/useGate.ts` + `SignInPrompt.tsx` (the gated-write + in-context prompt), `pages/ticker/widgets/_kit/StatTile.tsx` (`StatSkeleton` as the cold-load precedent), `shared/theme/{hex-discipline,single-motion-moment,stage3-amber,warning-icon,type-floor}.spec` (the mutation-guarded `?raw` scan idiom and the two path pins this plan re-points), `features/trading/positions/positions-stage0.spec.tsx` (the `matchMedia` narrow-viewport stub), `features/auth/useSettings.spec.tsx` (the `renderHook` + provider-wrapper idiom), and `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts` (the 393px route set + `cy.intercept` network boundary).

## After this plan

Scanner v1 is complete: P1 (store) · P2 (sweep worker) · P3 (read API + gated view + warm-click) · **P4 (this page)**. Hand to `qa-verify` for GATE Q against `PRODUCT_CONTRACT.md` §4 — the P3 report's DEFERRED-TO-P4 rows (AC-11 in full; the visual halves of AC-1/7/8/9/12) are now observable in the running app, and the three GATE-Z flags in `## Open decisions` (the two "live"-word copy rewordings, the 180s worker-down threshold, the `sweep_last_completed: null` banner fallback) need an owner ruling before GATE S.
