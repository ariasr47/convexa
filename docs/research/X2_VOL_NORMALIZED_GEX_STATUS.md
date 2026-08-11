# X2 vol-normalized GEX — technical status (2026-08-11)

> Autonomous brief: roadmap still lists X2 as “next”; **code and UI largely already shipped**.  
> This is a status / gap analysis, **not** a Spire BRIEF/SPEC and not a ship decision.

## Roadmap claim (stale)

`docs/ROADMAP_2026-08.md` X2:

> vol-normalize the GEX read; intraday-recompute where the data allows; public-ready methodology note.

## What already exists in tree

| Layer | Location | Status |
|-------|----------|--------|
| Formula + types | `libs/quant-engine/src/vol_gex.rs` | **Shipped** — `net/call/put/total / vol_scalar`; ATM IV prefer, else HV; sign preserved; walls/flip **not** re-derived |
| Units | `vol_units.rs` (`IvDecimal`, `HvPercent`) | **Shipped** — boundary typing to avoid %/decimal bugs |
| Analytics wiring | `apps/api/src/services/analytics.rs` → `vol_normalize_gex(...)` | **Shipped** on Path B snapshot |
| Snapshot field | `AnalyticsSnapshot.vol_normalized_gex` | **Shipped** |
| Wire / client | `libs/api` `MarketState.vol_normalized_gex?` | **Shipped**, independently nullable |
| UI | Dealer positioning widget — “Vol-norm GEX” tile + basis tooltip | **Shipped** + tests |
| Methodology | `/methodology` page copy (vol regimes, not a score input) | **Shipped** + specs |
| Canon | Additive only — not a scoring input | **Honored** in code comments + UI copy |
| Unit tests | `vol_gex` module tests (prefer ATM, HV fallback) | **Shipped** |

### Formula (v1, as implemented)

```text
vol_scalar = atm_iv_decimal  if atm_iv > 0
           | hv_30d_pct/100  else if HV available
           | unavailable     otherwise

net_gex_vol_norm = net_gex / vol_scalar   (same scalar for call/put/total)
```

O(1) over aggregates — no chain walk.

## Gaps vs the original X2 write-up

| Roadmap phrase | Gap |
|----------------|-----|
| “intraday-recompute where the data allows” | Live path recomputes when analytics recompute; **no separate hist/intraday research series** or higher-cadence dedicated vol-norm track beyond normal bundle refresh. |
| “public-ready methodology note” | **In-app `/methodology` exists**; optional standalone docs page / PDF / blog is not a separate deliverable. |
| GATE-M feature folder / archive | No `_archive/vol-normalized-gex/` contract pack found — may have shipped outside full Spire archive ritual or under another name. |
| Score-lab integration | Vol-norm **not** on structure samples / score-lab rows — research spine still evaluates **opportunity_score**, not vol-norm magnitude. |
| Hist validation | No automated multi-week lab of vol-norm vs raw GEX in-repo (external “independent backtest” still the motivation). |

## Relation to score-lab deep dive

First score-lab slice shows **structure_event** ranks well while **score** does not (global). Vol-norm GEX is a **magnitude** read for dealer exposure, not the opportunity score. It is the right product surface for “raw GEX misleads across vol regimes,” orthogonal to score reweight.

**Do not** fold vol-norm into score without a deliberate measured feature.

## Suggested remaining work (when you choose to open a feature)

Priority if any residual X2 work is desired:

1. **Canon hygiene:** mark X2 **shipped** in ROADMAP / BACKLOG; archive a thin SPEC pointer if Spire memory should record it.  
2. **Research (optional):** add optional `net_gex_vol_norm` (and basis) onto structure samples for score-lab/structure labs.  
3. **Intraday honesty:** document refresh cadence + when tile is null (no ATM IV / no HV).  
4. **True hist A/B:** later P3-class — raw vs vol-norm predictive lab on multi-week diary.

## Non-goals (still binding)

- Changing `process_gex_profile` goldens / SIMD path for vol-norm.
- Feeding opportunity score.
- Per-strike vol-norm profile (deferred in module docs).

## Bottom line

**X2 is not a greenfield build.** Core math, wire, UI, and methodology copy are in production code. Remaining value is **research coupling + roadmap honesty**, not re-implementing division by IV.
