# QA_REPORT — distance-to-level-tiles

**Gate:** Q (independent verification)  
**Feature commit:** `74df555` — `feat(dashboard): distance-to-spot secondary lines on key level tiles`  
**Posture:** `NO_BACKEND_CHANGE`  
**Observer:** GATE Q (fresh session; not builder)  
**Observed:** 2026-08-11

---

## Overall GATE Q verdict: **PASS**

| Check | Result |
|-------|--------|
| AC-1 … AC-5 | **5 PASS / 0 FAIL / 0 UNVERIFIABLE** |
| Interface conformance (`NO_BACKEND_CHANGE`) | **PASS** (empty `apps/api` diff) |
| Invariant watch | **PASS** (all four) |
| Critical security/integrity sweep | **PASS** (no Critical findings) |
| Feature-scoped + hex automation | **PASS** (22/22, exit 0) |

Full monorepo dashboard suite remains red on **6 pre-existing failures outside this change set** (documented below). They do **not** appear in `git diff 74df555~1 74df555` and do not invalidate the AC evidence for this FE-only display feature.

---

## 1. Acceptance criteria

| ID | Criterion (verbatim) | Verdict | Evidence / HOW |
|----|----------------------|---------|----------------|
| **AC-1** | Call wall, Put wall, Max pain tiles show a secondary line: signed $ gap · % · above/below (or `at spot`) when `gex_spot` or `price` is available | **PASS** | **unit:** `distanceToLevel` · `formats above / below / at spot with figure-minus and percent` → `+$10 · 4.0% above` / `−$10 · 4.0% below` / `at spot`. **widget:** `DealerPositioning · distance-to-spot secondary` · `shows distance secondary on Call wall, Put wall, and Max pain from gex_spot` asserts `stat-secondary` contains those three strings. **atom:** `StatTile` · `renders optional secondary caption only when provided`. Command: `npx nx test @convexa/dashboard -- --run src/app/pages/ticker/widgets/_kit/distanceToLevel.spec.ts …/StatTile.spec.tsx …/DealerPositioning.spec.tsx` → **exit 0**, 14 tests green. |
| **AC-2** | Gamma flip tile shows the same secondary form against the displayed flip value | **PASS** | **unit path:** same `distanceToLevel` formatter. **widget:** `LiveTape · tape-local honesty` · `PRE-LIVE: …` asserts flip `$248` vs `gex_spot` 250 → `stat-secondary` text `−$2.0 · 0.8% below`. Wiring: `LiveTape.tsx` `flipSecondary = distanceToLevel(flipValue, levelSpot(m))` on Gamma flip `StatTile`. |
| **AC-3** | When spot cannot be anchored (`gex_spot` and `price` both null), secondary is omitted — never fabricated | **PASS** | **unit:** `distanceToLevel` · `returns null when inputs are missing or non-finite`; `levelSpot` · both null → `null`. **widget:** `DealerPositioning` · `omits distance secondary when spot cannot be anchored` with `{ gex_spot: null, price: null }` → walls still `$260`, `queryByTestId('stat-secondary')` null. No fabricated `at spot` / gap. |
| **AC-4** | Secondary uses theme `text.secondary` + mono face only; no hardcoded hex; no success/error tint (green/red reserved for signed direction) | **PASS** | **code review:** `StatTile.tsx` secondary caption `sx={{ fontFamily: MONO, color: 'text.secondary', … }}` — no `#…`, no `success.*` / `error.*` on secondary. `distanceToLevel` returns plain strings only (no color). **hex-discipline suite:** `hex-discipline.spec.ts` (3) + `banned-hexes.spec.ts` (5) → **exit 0**. Feature source scan on commit diff: no new hex literals. |
| **AC-5** | No brand reopening; no token table in this SPEC | **PASS** | **review/QA of this file §4:** `SPEC.md` §4 names sole authority `DESIGN_SYSTEM.md` (SET); binds via existing theme slots / `StatTile` secondary; explicitly forbids second hex table and retired `convexa-design` skill. No palette/type restatement in SPEC. |

### Summary counts

| Verdict | Count |
|---------|------:|
| PASS | 5 |
| FAIL | 0 |
| UNVERIFIABLE | 0 |

---

## 2. Interface conformance (NO_BACKEND_CHANGE)

| Item | Result |
|------|--------|
| Posture | `NO_BACKEND_CHANGE` per `INTERFACE_CONTRACT.md` |
| Live `interface_conformance` gate | **n/a** — not required for this posture |
| Proof command | `git diff 74df555~1 74df555 -- apps/api` |
| `apps/api` files changed | **none** (empty) |
| Feature commit files | dashboard widgets + kit + SPEC only (see receipt) |
| Receipt | `conformance-receipt-qa.json` → **verdict PASS** |

Distance strings are pure client projection; they cannot reach score / tier / fingerprint / signals. Backend cannot observe this ship.

---

## 3. Frontend suite & automation traceability

### Feature-scoped + structural (authoritative for this ship)

```text
npx nx test @convexa/dashboard -- --run \
  src/app/pages/ticker/widgets/_kit/distanceToLevel.spec.ts \
  src/app/pages/ticker/widgets/_kit/StatTile.spec.tsx \
  src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.spec.tsx \
  src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx \
  src/app/shared/theme/hex-discipline.spec.ts \
  src/app/shared/theme/banned-hexes.spec.ts
→ Test Files  6 passed (6)
→ Tests  22 passed (22)
→ EXIT 0
```

| AC | Required method | Named automation / review |
|----|-----------------|---------------------------|
| AC-1 | unit + widget | `distanceToLevel` formats…; `DealerPositioning` shows distance secondary…; `StatTile` optional secondary… |
| AC-2 | unit + widget path | `distanceToLevel` + `LiveTape` PRE-LIVE flip secondary assertion |
| AC-3 | widget | `DealerPositioning` omits… when spot cannot be anchored; unit null paths |
| AC-4 | code review + hex suite | StatTile secondary sx review; `hex-discipline` + `banned-hexes` exit 0 |
| AC-5 | this file §4 | SPEC §4 review — no token table / brand reopen |

No hollow “renders without throw” oracles: assertions check exact secondary strings, omit-on-null, and testids.

### Full monorepo suite (baseline; not introduced by 74df555)

```text
npx nx test @convexa/dashboard -- --run
→ Test Files  6 failed | 132 passed (138)
→ Tests  6 failed | 1518 passed (1524)
→ EXIT 1
```

| Failing test | Attribution |
|--------------|-------------|
| `stage3-amber.spec.ts` · closed-list `TradeEntryDialog.tsx` must contain `extrasFor(` | Pre-existing re-export shim (`export { … } from './tradeEntry'`); **not in 74df555** |
| `app.risk.spec.tsx` · `/_ops/metrics` Operator Metrics | Lazy-route fallback timeout; **not in 74df555** |
| `grouping.integration.spec.tsx` · `/api/book` call pattern | Broker network stub; **not in 74df555** |
| `orders.risk.spec.tsx` · recommendation URL allow-list | Orders flow; **not in 74df555** |
| `positions.risk.spec.tsx` · contract-only lookups | Positions additive; **not in 74df555** |
| `readonly.spec.tsx` · portfolio endpoint allow-list | Positions additive; **not in 74df555** |

**Note:** Initial full-suite run also hit a broken `node_modules/@convexa/api` junction targeting deleted `C:\Dev\gammaflow-web\libs\api`. Relinked to `C:\Dev\convexa\libs\api` for observation only (workspace env, not product code). After relink, failures reduced to the six above.

Typecheck (`npx nx typecheck @convexa/dashboard`) was red primarily on the same broken `@convexa/api` resolution before relink; not re-used as a feature blocker after env fix. Feature seams themselves are covered by green vitest.

---

## 4. Invariant watch (BRIEF + OPEN_THREADS §9)

| Invariant | Verdict | Evidence |
|-----------|---------|----------|
| **theme-token-discipline** | **PASS** | Secondary caption binds `color: 'text.secondary'` + `typographyTokens.monoFontFamily` only. Hex-discipline + banned-hexes green. No success/error tint on distance. |
| **additive-keeps-score-byte-identical** | **PASS** | Empty `apps/api` diff; pure client string; no signals/score/tier/fingerprint touch. By construction. |
| **absent-is-not-none** | **PASS** | Missing/non-finite spot or level → `null` secondary omitted; never fabricates `at spot` or a $ gap. Widget test with both anchors null. |
| **model-read-carries-its-assumptions** | **PASS** | Distance is arithmetic (level − spot), not a forecast or scored signal. Tooltips state “Secondary line is distance from gex_spot (or mid).” No bullish/bearish recolor. |

Other §9 invariants (auth, secrets, sim dialog, order path, etc.) are **out of surface** for this display-only change; Critical sweep found no regression into them.

---

## 5. Critical sweep (criteria-independent)

Scope: files in `74df555` under `apps/dashboard/.../ticker/widgets/`.

| Area | Finding |
|------|---------|
| Authn / authz / cross-tenant | None — no auth surface touched |
| Secret exposure | None — no secrets, env, or storage |
| Destructive data | None — read-only projection |
| Score / fingerprint binding | None — display caption only |
| Injection / XSS | Secondary is number-formatted string from numeric level/spot; not raw HTML |
| Severity Critical | **0** |

No Critical criteria-gap defects. No Important findings that block GATE Q.

---

## 6. User-facing / design review (proportional)

| Check | Result |
|-------|--------|
| Secondary is non-interactive caption (`<p>` caption) | Observed in StatTile source + widget tests |
| Color not sole carrier of above/below | Text carries `above` / `below` / `at spot` words; no green/red on secondary (AC-4) |
| Complete states: present / omit when unanchored | Covered by AC-1–AC-3 automation |
| Visual browser spot-check | Not required — SPEC verify methods are unit/widget/review; automation observed live |

---

## 7. Amendments bounced

**None** — GATE Q **PASS**. No bounce to Backend or Frontend for this feature’s acceptance criteria.

### Carry-forward (not GATE Q FAIL for this feature)

Monorepo dashboard suite has **6 pre-existing red tests** outside `distance-to-level-tiles`. Recommend a separate hygiene pass (TradeEntryDialog closed-list path, ops lazy route, broker/positions network allow-lists). Workspace note: ensure `node_modules/@convexa/api` junctions to `libs/api` under this repo, not a deleted path.

---

## 8. Commands & exit codes (observed)

| Command | Exit | Notes |
|---------|-----:|-------|
| `git diff 74df555~1 74df555 -- apps/api` | 0 | empty |
| Feature-scoped vitest (4 seams) | **0** | 14/14 |
| Feature + hex-discipline (6 files) | **0** | 22/22 |
| Full `npx nx test @convexa/dashboard -- --run` | **1** | 6 pre-existing fails (see §3) |

---

**GATE Q: PASS** — ship criteria for `distance-to-level-tiles` hold under independent observation.
