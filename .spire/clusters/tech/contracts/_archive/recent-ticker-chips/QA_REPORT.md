# QA_REPORT — recent-ticker-chips

**Gate:** Q (independent verification)  
**Feature state:** uncommitted working tree (FE-only; not yet a single feature commit)  
**Posture:** `NO_BACKEND_CHANGE`  
**Observer:** GATE Q (fresh session; not builder)  
**Observed:** 2026-08-11

---

## Overall GATE Q verdict: **PASS**

| Check | Result |
|-------|--------|
| AC-1 … AC-8 | **8 PASS / 0 FAIL / 0 UNVERIFIABLE** |
| Interface conformance (`NO_BACKEND_CHANGE`) | **PASS** (empty `apps/api` status + diff) |
| Invariant watch (BRIEF + OPEN_THREADS §9) | **PASS** |
| Critical security/integrity sweep | **PASS** (no Critical findings) |
| Feature-scoped + hex automation | **PASS** (30/30, exit 0, `--skip-nx-cache`) |
| Typecheck `@convexa/dashboard` | **PASS** (exit 0) |

---

## 1. Acceptance criteria

| ID | Criterion (verbatim) | Verdict | Evidence / HOW |
|----|----------------------|---------|----------------|
| **AC-1** | On `/ticker/*`, inside the Command Deck card **below** the Ticker / Expirations / Persona strip, a **Quick** row of chips is visible | **PASS** | **widget/integration:** `CommandDeck — Quick symbols row (recent-ticker-chips)` · `renders quick-symbols BELOW the toolbar inside command-deck (AC-1)` — `quick-symbols` is inside `command-deck`, and `ticker-toolbar.compareDocumentPosition(quick) & DOCUMENT_POSITION_FOLLOWING` is truthy. **widget:** `QuickSymbols` · `renders QUICK label + closed pins SPY QQQ NVDA even when recents empty` asserts `QUICK` label + three pin buttons. Mount site: `CommandDeck.tsx` places `<QuickSymbols … />` after `<TickerToolbar … />` inside the deck `Stack` (not sticky). |
| **AC-2** | Closed liquid pins always render: **SPY**, **QQQ**, **NVDA** (order fixed); not driven by recents emptiness | **PASS** | **unit:** `recentTickers store` · `pins are closed SPY · QQQ · NVDA in fixed order` → `PINNED_TICKERS === ['SPY','QQQ','NVDA']`. **widget:** `QuickSymbols` empty-recents case → chip texts `['SPY','QQQ','NVDA']` only. Pins are a code constant, never stored with recents. |
| **AC-3** | Clicking a chip navigates to `/ticker/{SYMBOL}` (uppercase); deck symbol input reflects the new symbol | **PASS** | **unit (nav glue):** `selectTickerSymbol` · `uppercases, syncs input, navigates to /ticker/SYMBOL` — `setSymbol('IWM')` + `navigate('/ticker/IWM')` for input `iwm`. **widget:** `QuickSymbols` · `click calls onSelect with uppercase symbol` → `onSelect('SPY')`. **wiring review:** `TickerDashboard` `onSelectQuickSymbol` → `selectTickerSymbol({ symbol, navigate, setSymbol })`; route-param `useEffect` also `setSymbol(s)` on `[ticker]` so chip nav + deep links keep the deck input aligned. |
| **AC-4** | The chip matching the **current route symbol** has a selected treatment (theme tokens only — not success/error green/red) | **PASS** | **widget:** `QuickSymbols` · `marks the current route symbol selected` — `currentSymbol: 'qqq'` → QQQ `aria-pressed="true"`, SPY `aria-pressed="false"`. **review:** selected surface uses `t.palette.primary.main` border + `alpha(primary, 0.14)` fill; unselected uses `divider` / transparent — **no** `success.*` / `error.*` / hex. Selected driven by `routeSymbol` (URL param), not the uncommitted input field (`CommandDeck` props). |
| **AC-5** | Visiting symbols updates a **durable recents** list (client-local): after A→B→C reload still includes them; de-duped against pins; capped (≤8 recents beyond pins) | **PASS** | **unit (store):** `recordVisit uppercases, MRU-front, de-dupes self` (AAPL/META); `recordVisit of a pin does NOT appear in recents` (SPY/QQQ skipped, IWM kept); `caps recents at MAX_RECENTS (8)` (A9 first, A1 dropped); `survives reload (re-hydrate from localStorage)` after `__resetRecentTickers`. Key `convexa.recent-tickers.v1`. **widget:** `appends recents after pins, de-duped` → `['SPY','QQQ','NVDA','AMD','IWM']`. **wiring:** `TickerDashboard` `useEffect([ticker])` calls `recordVisit(s)` on route change. |
| **AC-6** | When recents are empty/corrupt, **pins still show** — never a blank Quick row and never an error claiming “no symbols” (`[absent-is-not-none]`) | **PASS** | **unit:** empty storage → `listRecents() === []`; corrupt `{not-json` → empty recents, no throw, **original key left intact** (no `removeItem`). **widget:** empty recents still renders `QUICK` + three pins; `row.textContent` does not match `/no symbols/i`. |
| **AC-7** | Sticky condensed bar is **unchanged** (no chips there); TopNav/widgets/API untouched | **PASS** | **widget:** `CommandDeck` · `sticky condensed bar has NO quick chips` — with sticky revealed, `within(deck-sticky).queryByTestId('quick-symbols')` and `queryByText('QUICK')` are null. **review:** `StickyCondensed` has no `QuickSymbols` import/mount; `TopNav.tsx` has zero matches for quick/QUICK; working-tree widget changes limited to `widgets/chrome/` (+ `stage3-headings` prop stubs only). **api proof:** `git status --short apps/api` and `git diff --name-only HEAD -- apps/api` both **empty**. |
| **AC-8** | Zero new hardcoded hex; chips use theme/paper/divider/text + selected via primary or amber **signal** slot only if already used for selection elsewhere — prefer outline/selected via `primary` / `divider` / `action.selected`; no P/L green/red | **PASS** | **hex-discipline:** `hex-discipline.spec.ts` (3) + `banned-hexes.spec.ts` (5) → exit 0. **source scan:** no `#[0-9a-fA-F]{3,8}`, no `success`/`error` palette usage in `QuickSymbols.tsx`. Selected path: `primary` + `divider` + `action.selected` hover only. |

### Summary counts

| Verdict | Count |
|---------|------:|
| PASS | 8 |
| FAIL | 0 |
| UNVERIFIABLE | 0 |

---

## 2. Interface conformance (`NO_BACKEND_CHANGE`)

| Item | Result |
|------|--------|
| Posture | `NO_BACKEND_CHANGE` per `INTERFACE_CONTRACT.md` |
| Live `interface_conformance` gate | **n/a** — not required for this posture (honest empty-diff proof) |
| Proof commands | `git status --short apps/api` · `git diff --name-only HEAD -- apps/api` |
| `apps/api` files changed | **none** (empty status + empty name-only diff) |
| Feature surface | Client route `/ticker/:symbol` + client-local `localStorage` key only |
| Receipt | `conformance-receipt-qa.json` → **verdict PASS** |

`additive-keeps-score-byte-identical` holds by construction: chips never touch signals / score / tier / `state_fingerprint`; backend cannot observe this feature.

---

## 3. Frontend suite & automation traceability

### Feature-scoped + structural (authoritative for this ship)

```text
npx nx test @convexa/dashboard --skip-nx-cache -- --run `
  src/app/pages/ticker/recentTickers/store.spec.ts `
  src/app/pages/ticker/recentTickers/navigation.spec.ts `
  src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx `
  src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx `
  src/app/shared/theme/hex-discipline.spec.ts `
  src/app/shared/theme/banned-hexes.spec.ts
→ Test Files  6 passed (6)
→ Tests  30 passed (30)
→ EXIT 0  ($LASTEXITCODE=0)
```

| AC | Required method (SPEC) | Named automation / review |
|----|------------------------|---------------------------|
| AC-1 | unit + widget/integration | `CommandDeck` quick-symbols below toolbar; `QuickSymbols` QUICK + pins |
| AC-2 | unit + widget | store pin constant; QuickSymbols pins-only empty case |
| AC-3 | integration / flow | `selectTickerSymbol` unit + QuickSymbols click + TickerDashboard wiring review |
| AC-4 | widget + review | QuickSymbols `aria-pressed`; primary/divider selected treatment review |
| AC-5 | unit (store) + integration | store reload/cap/dedupe; QuickSymbols append order; route `recordVisit` wiring |
| AC-6 | unit + widget | corrupt/empty store; pins still render; no “no symbols” copy |
| AC-7 | review + empty `apps/api` diff | sticky exclusion test; TopNav untouched; empty api proof |
| AC-8 | hex-discipline + review | hex suites exit 0; no hex/success/error in QuickSymbols |

No hollow “renders without throw” oracles: assertions check DOM order, fixed pin list, `aria-pressed`, navigate path, durable reload, corrupt-blob non-destroy, and sticky exclusion.

### Typecheck

```text
npx nx typecheck @convexa/dashboard
→ EXIT 0
```

---

## 4. Invariant watch (BRIEF + OPEN_THREADS §9)

| Invariant | Verdict | Evidence |
|-----------|---------|----------|
| **theme-token-discipline** | **PASS** | Chips bind `palette.primary` / `divider` / `text.*` / `action.selected` only; zero hex; hex-discipline + banned-hexes green. |
| **additive-keeps-score-byte-identical** | **PASS** | Empty `apps/api` diff; nav chrome only; no score/tier/fingerprint path. |
| **loss-free-durable-migration** | **PASS** | New key `convexa.recent-tickers.v1` (no rename). Corrupt blob → empty in-memory **without** `removeItem`; original key preserved until a successful valid write. Covered by store corrupt test. |
| **live-vs-static-isolation** | **PASS** | Chips are navigation chrome, not live-derived market data; no SSE/live obligation introduced. Sticky bar (live mark) unchanged. |
| **absent-is-not-none** | **PASS** | Empty/corrupt recents still show closed liquid pins; never a blank Quick row or “no symbols” error (AC-6). |

Other §9 invariants (auth, secrets, sim dialog, order path, dark-pool, etc.) are **out of surface** for this FE-only nav chrome; Critical sweep found no regression into them.

---

## 5. Critical security / integrity sweep (criteria-independent)

Scope: changed FE files only (`recentTickers/*`, `QuickSymbols*`, `CommandDeck*`, `TickerDashboard` wiring, `stage3-headings` prop stubs).

| Area | Finding |
|------|---------|
| Auth / authorization | **None** — no new protected resource; client route + localStorage only. |
| Cross-tenant | **None** — no multi-tenant store; browser-local key only. |
| Secret exposure | **None** — stores uppercase ticker symbols only. |
| Destructive data | **None** — corrupt path does not delete durable blob; pin set is constant. |
| Injection / XSS | **None Critical** — chip labels are React text children; symbols uppercased from route/store. Navigation target is `/ticker/${uppercase}` (same family as existing submit path). |
| Scoring / backend surface | **None** — empty `apps/api` diff; no signals coupling. |

**Critical findings: 0.** No GATE Q fail from criteria-gap defects.

---

## 6. User-facing / a11y / complete-state (design-review discipline)

| Check | Result |
|-------|--------|
| Interactive semantics | Native `<button type="button">` chips with `aria-label` (symbol) and `aria-pressed` for selected state — color is not the sole selected cue. |
| Keyboard | Buttons are focusable via native control semantics (no custom non-focusable div). |
| Empty / corrupt state | Pins always present; no error chrome claiming absence of symbols. |
| Narrow layout | Chip stack `flexWrap: 'wrap'` with `minWidth: 0` (wireframe-aligned). |
| Placement | Full deck only; sticky condensed bar deliberately chip-free (tested). Cold-load standalone `TickerToolbar` branch correctly omits Quick row (AC-1 places it inside Command Deck card only). |
| Visual evidence | Not captured as screenshots this run; widget DOM assertions + theme-token review substitute for FE display (per GATE Q method preference for this feature). |

---

## 7. Bounce

**None.** Overall GATE Q **PASS** — no amendments bounced to Backend or Frontend.
