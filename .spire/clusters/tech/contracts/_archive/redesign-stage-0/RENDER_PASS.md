# redesign-stage-0 — conductor render pass (real browser, 2026-07-22)

> Playwright MCP against the served branch (`redesign-stage-0`, live backend then a forced
> stream kill). Conductor-provided evidence for the §9.6 items the QA lane's tools cannot
> reach. Screenshots in `render-pass/`.

| Check (contract ref) | Result | Evidence |
|---|---|---|
| 393px no-overflow, /ticker (§3.1) | **PASS** — scrollWidth 378 vs 393 (was 580), dark AND light, and 378 held IN the degraded state | measured; `s0-ticker-393-light.jpeg` |
| Mobile nav (§3.1) | **PASS** — hamburger present, drawer = exactly {Ticker, Positions, Scanner, Blog}, no `/_ops`, Escape closes | `s0-drawer-393-light.jpeg` |
| Heading semantics (§3.3) | **PASS** — h1=1, **h6=0** (was 29), `<main>` landmark present | measured |
| theme-color follows mode (§3.6) | **PASS** — light `#f5f6f8` ↔ dark `#0e1117`, both = live `background.default` | measured both directions |
| Focus ring (§3.2) | **PASS** — authored `solid 2px rgb(79,156,255)` (primary.main) on focus, not UA default | measured on landing |
| Hero copy (§4.3) | **PASS** — h1 "See the dealer positioning behind the price."; hero block no longer sells the unbuilt brokerage | measured |
| **Offline-degrade walk at 393 (§9.6)** | **PASS** — on a REAL backend kill (>15s gap): "⚠ Live offline — reconnecting…" chip, live tiles → "⏸ offline", "⏸ Last trade $377.75", static GEX chart + 19 stat values persist un-blanked, no layout shift | `s0-393-dark-offline-degrade.jpeg` |
| Desktop 1440 sanity | **PASS** — identity unchanged | prior session evidence + spot check |

**Methodology note (recorded for honesty):** the first offline probe showed NO degradation —
root cause was **three orphan uvicorn processes still serving :8000** (the Windows
orphan-server gotcha), so the stream never actually dropped. After killing all of them the
watchdog fired exactly to spec. Not an app defect; the walk is a true PASS.

**Not covered here (QA scope):** the full §8 `test:` matrix audit (named tests ↔ cases,
mutation-guard checks), suite/typecheck/lint/build re-run, the empty `apps/api` diff
re-verification, token-discipline source audit, cold-skeleton + sticky-condensed-bar +
full-screen-dialog visual states (accepted residual: verified by component tests only).
