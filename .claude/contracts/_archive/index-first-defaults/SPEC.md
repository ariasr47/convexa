# SPEC — index-first-defaults

**Interface:** `.claude/contracts/index-first-defaults/INTERFACE_CONTRACT.md` (**NO_BACKEND_CHANGE** —
this spec references it and must not contradict it).
**Brief:** `BRIEF.md` · **Route:** GATE V fast-path (FE lane only) · **Rule-of-record for styling:**
the `convexa-design` skill + `[theme-token-discipline]`.

## 1. Goal

Point the app's defaults at the tickers where the dealer-positioning evidence is strongest
(index/liquid-megacap), and stop silently implying equal signal quality on thin single names.
Three small moves, all presentation/config; user choices always win over new defaults.

## 2. Scope

In: the bare-route default ticker; the scanner's zero-state (no saved view) presentation; a
single-name honesty caption on the Ticker page. Out: any scoring/backend change, any universe
edit, any new preference field, alerts, breadth changes, copy rewrites beyond the one caption.

## 3. Acceptance criteria (observable without reading code)

- **AC-1 Default ticker.** Bare `/ticker` (and any entry path that previously fell back to TSLA)
  lands on **SPY**. A direct `/ticker/{symbol}` navigation is unchanged.
- **AC-2 User preference wins.** A signed-in user with `default_ticker` set, and an anonymous user
  with the client-local pref set, still land on THEIR ticker. Only the unset fallback changed. No
  stored preference is migrated, rewritten, or dropped (`[loss-free-durable-migration]` untouched —
  the durable shape does not change).
- **AC-3 Scanner zero-state leads with the strong-signal set.** With no saved view, the scanner
  presents an **"Indexes & megacaps" lead group** above the remaining universe rows; groups are
  internally score-desc exactly as today. Membership comes from a **closed lookup** (the universe
  payload's ETF/index members; if the payload carries no such marker, a small FE closed list of the
  universe's ETF symbols is acceptable — a named constant, never a heuristic). A user's saved view
  renders exactly as saved (no regrouping).
- **AC-4 Single-name caveat.** On `/ticker/{symbol}` for a symbol **not in the scanner universe**,
  a quiet one-line caption renders (placement per §4): advisory tone, token-only styling, both
  themes, not dismissible-required, never blocking, never a modal. It does NOT render for universe
  members (SPY/QQQ etc.).
- **AC-5 Unknown is not thin (`[absent-is-not-none]`).** If the universe read fails or hasn't
  resolved, the caveat does **not** render — the app must not claim "thin name" from "we don't
  know". No error surfaces for this; absence of the caption is the degraded state.
- **AC-6 Byte-identity + baselines.** `apps/api` diff empty; score/tier/`state_fingerprint`
  byte-identical (assert by construction: no request shape changed). `nx test @org/dashboard`,
  `typecheck`, `lint` (0 err/0 warn) and e2e 33/33 all green; new behavior covered per the
  risk-based testing rule (AC-1/2/3/5 are the silently-regressable ones — test those; AC-4 copy
  presence may be verified by review).

## 4. Component states, copy, design direction

- **Default ticker:** a constant change at the route fallback (today `/ticker` → TSLA). No UI.
- **Scanner lead group:** reuse the existing table's group-header treatment (as used by shipped
  grouping); header label: `Indexes & megacaps`. No new visual language, no color semantics beyond
  what the table already uses. `<sm` card collapse behavior unchanged.
- **Caveat caption (the one new copy string):** placement — the Ticker page chrome, on the
  freshness/context line (CommandDeck area), as a muted caption consistent with existing secondary
  text; never inside the chart. Copy (exact):
  `Single-name read — dealer-positioning evidence is strongest on index and high-liquidity
  tickers. Treat these levels as context, not a forecast.`
  This is `[model-read-carries-its-assumptions]` applied to the whole surface: advisory framing,
  no fear styling (no red/warn semantics — muted text token only).
- States: caption present (non-universe symbol, universe read resolved) · absent (universe member) ·
  absent (universe unknown/failed — AC-5). No loading state (it may appear when the read resolves).

## 5. Error handling / degraded behavior

The universe read is best-effort and silent: failure ⇒ no caption, no toast, no console spam
beyond existing norms. SSE/live behavior untouched (`[live-vs-static-isolation]` not in play —
the caption is static). No new error class, no new HTTP handling.

## 6. Non-goals

Universe membership editing · liquidity scoring · per-ticker warnings beyond the one caption ·
backend flags · changing score/tier/gate ( `[score-change-is-deliberate-and-measured]` is NOT
being exercised here) · mobile/PWA work.
