# BACKEND EXECUTION CONTRACT — DEX · Vol/OI · IV Skew · Term Structure

> For the Backend Executioner. Binds to GAMMAFLOW_CONTEXT.md + INTERFACE_CONTRACT.md.
> Server work ONLY — no UI. Implement to spec; do not redesign or add features.

## Files / functions to modify
- `src/providers/base.py` — add `volume: Optional[float]` to the `OptionContract` TypedDict (session
  traded volume; `None` if the vendor doesn't report it). Optional — the engine must degrade, never
  crash, when it's absent. (DEX/skew/term need no port change — they use existing vendor
  `delta`/`iv`.)
- `src/providers/massive.py` — populate `OptionContract.volume` from the snapshot's per-contract
  `day.volume` already in the parsed payload. **No new request.** Missing → `None`.
- `src/core/engine.py`:
  - **DEX** — in the SAME per-contract loop as GEX in `process_gex_profile`:
    `dollar_dex = delta · open_interest · 100 · synchronized_spot` using **vendor delta**, existing
    per-strike sign convention. Emit aggregate `net_dex` (signed sum) + `call_dex`/`put_dex` gross
    split, and per-strike `net_dex` (+ optional call/put dex) on each `strike_profile` row.
    Window-scoped (same filtered contracts as GEX).
  - **Vol/OI** — per strike (full-chain rows): `volume` (summed) and
    `vol_oi_ratio = volume / total_oi` (`None` when `total_oi <= 0` or no volume); aggregate
    `total_volume` and `chain_vol_oi_ratio = total_volume / total_oi`. Full chain (independent of the
    DTE filter).
  - **IV skew** — own guarded helper: anchor tenor = nearest expiration ≥ 7 DTE (reuse ATM-IV tenor
    selection); `slope = put_side_iv − call_side_iv` at ±25-delta (vendor delta to bucket),
    fixed-moneyness (≈ ±5% OTM) fallback; emit `{slope, put_iv, call_iv, dte, expiration, reference}`.
  - **Term structure** — own guarded helper: ATM IV per available expiration (reuse per-expiration
    ATM-strike selection; avg call+put IV at the nearest-to-spot strike); emit ascending
    `points[{dte, expiration, atm_iv}]` + `state` (contango/backwardation/flat) + `near_iv`/`far_iv`/
    `slope`. Emit the FULL available curve (FE samples display buckets). Cross-tenor (ignores filter).
- `main.py` / `_build_market_state` — surface `net_dex`/`call_dex`/`put_dex`, `chain_vol_oi_ratio`/
  `total_volume`/`vol_oi_unusual_threshold`, `iv_skew`, `term_structure` into the bundle. Add
  `VOL_OI_UNUSUAL_THRESHOLD` env (float, default `1.0`) → echoed as `vol_oi_unusual_threshold`.
- `src/core/signals.py` — **NO change.** None of the four touches `opportunity_score`, setups, the AI
  gate, or `state_fingerprint`.

## Binding constraints (from GAMMAFLOW_CONTEXT + ARCHITECTURE)
- **No new analytic greek, no BS repricing.** DEX uses vendor `delta`; skew/term use vendor `iv`;
  Vol/OI uses no greeks. `r = 4.5%`, `q`, `MIN_GREEK_T` floor all untouched. Gamma, gamma flip,
  walls, peak GEX, max pain, PCR, VWAP, HV — **unchanged**.
- **Spot basis:** any spot-scaled term (the `S` in dollar DEX) uses `synchronized_spot`
  (`gex_spot`), not the live/display spot.
- **Scope per metric:** DEX = selected DTE/expiration window (like GEX); Vol/OI = full chain; IV
  skew = single anchor tenor; term structure = cross-tenor. (Per the Architecture scope table.)
- **No new network I/O** beyond surfacing `volume` already in the chain snapshot.
- **Vendor-agnostic port:** every adapter must populate `OptionContract.volume`; the engine treats it
  as optional.
- **Best-effort + isolated:** each metric in its own guarded block; a failure → `null`/`[]` for that
  metric only. `process_gex_profile` must still return a valid GEX result (incl. `_empty_gex_result()`
  on no usable contracts) regardless of the four. **None may turn a 200 bundle into an HTTP error.**
  **SSE path untouched** — nothing recomputed per tick.

## Must emit (from INTERFACE_CONTRACT.md)
- `market_state`: `net_dex`, `call_dex`, `put_dex`, `chain_vol_oi_ratio`, `total_volume`,
  `vol_oi_unusual_threshold`, `iv_skew{slope,put_iv,call_iv,dte,expiration,reference}`,
  `term_structure{points[{dte,expiration,atm_iv}],state,near_iv,far_iv,slope}` — each independently
  nullable.
- `strike_profile[]`: `net_dex` (+ optional `call_dex`/`put_dex`), `volume`, `vol_oi_ratio`
  (`null` when `total_oi <= 0` or no volume).
- No `side`/`direction`/`bias` field anywhere; `signals`/`ai_eval` unchanged.

## Verification
- [ ] `curl '/api/ticker/TSLA'` → `market_state` has `net_dex`, `chain_vol_oi_ratio`,
      `vol_oi_unusual_threshold`, `iv_skew`, `term_structure`; `strike_profile` rows have `net_dex`,
      `volume`, `vol_oi_ratio`.
- [ ] DEX changes with `?min_dte=7&max_dte=45` (window-scoped); `chain_vol_oi_ratio`/`vol_oi_ratio`
      do **not** change with the window (full-chain).
- [ ] A strike with `total_oi == 0` or no volume → `vol_oi_ratio: null` (not 0).
- [ ] Force vendor `volume` absent chain-wide → `chain_vol_oi_ratio: null` and per-strike
      `vol_oi_ratio: null`; `net_dex`, `iv_skew`, `term_structure`, GEX/profile all still present.
- [ ] Force vendor `delta` absent chain-wide → `net_dex: null`; GEX, walls, flip, profile intact.
- [ ] Too few/zero-IV contracts at the tenor → `iv_skew: null`; one tenor only → `term_structure`
      with the single point (no fabricated buckets); bundle still 200.
- [ ] `opportunity_score`, setups, and `ai_eval.state_fingerprint` are byte-identical to pre-feature
      at a state where a metric would "fire."

## Out of scope
- No frontend. No new endpoint/param. No gamma-math change. No scoring/gate/setup wiring.
- No ADV/percentile Vol/OI cutoff (single fixed threshold only). No multi-session history for
  skew/term/Vol/OI. No new analytic greek source.

## Definition of done
- [ ] Code implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed to reflect merged code (re-read touched files; same
      section structure), and `market_state_glossary.md` updated with the new entries (draft in
      UX_BLUEPRINT.md → "Glossary additions"), including the reliability note.
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated for anything opened/closed (coordinate with frontend).
- [ ] Committed.
