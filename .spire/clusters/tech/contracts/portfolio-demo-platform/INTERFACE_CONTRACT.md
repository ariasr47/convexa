# INTERFACE CONTRACT — portfolio-demo-platform (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/portfolio-demo-platform/SPEC.md`
**Posture:** `NO_BACKEND_CHANGE`

## Backend posture and existing wire

This is a frontend-only composition. `apps/api`, `libs/quant-engine`, generated OpenAPI schema and every live endpoint remain unchanged; no endpoint, query field, payload field, auth rule, score input, broker execution capability or Rust fixture selector is added. The `apps/api` diff for this feature is empty. Existing endpoint shape authority is `libs/api/src/generated/schema.ts` and existing conformance examples include `.spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md`. This file pins two safe, representative unchanged live reads below and gives the **new local application-provider contract** separately; a local method is not an HTTP endpoint. The demo-only `x-convexa-sample-fingerprint` header described below is metadata for the browser-local transport and is never added to a live generated request.

The existing `@convexa/api` exports in `libs/api/src/lib/convexa.ts` and `broker.ts` retain their function signatures and generated DTOs. A demo transport at `libs/api/src/lib/client.ts` returns `Response` objects to `openapi-fetch` for the current operations; the live transport continues same-origin HTTP. A demo response is compatible with the exact generated wire for that operation, with no invented top-level wire provenance field. Synthetic provenance is supplied by the separate local `scenarioProvenance()` capability and rendered by the app shell, note, chart and exports. A rejected local request has JSON `{ "code": "demo_unsupported" | "demo_unavailable", "detail": string }` and status 404 for unknown symbol, 422 for unsupported query/contract choice, or 501 for intentionally absent operation. It never falls back to `globalThis.fetch`.

## Existing operation inventory — demo dispatch obligations

Every method/path below has an exhaustive demo disposition. The live arm keeps its current wire/auth/error behavior. No demo handler may silently return an unrelated success DTO. The transport method/path dispatcher is exact, not a prefix wildcard; unknown pairs use the typed 501 refusal. Demo session and book are browser-local, not server sessions.

| Existing method/path | Demo disposition | Live truth / failure semantics |
|---|---|---|
| `GET /api/auth/session` | Local `Demo visitor` identity, complete generated session/settings shape, no cookie | Existing anonymous/session read; 200 |
| `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout` | Unavailable; UI does not collect credentials in demo | Existing auth semantics unchanged |
| `PUT /api/auth/settings` | Persist only demo risk/theme/settings and echo complete generated settings shape | Session-backed write unchanged |
| `POST /api/positions/sim-trade/gate` | Local authorization only for existing confirmed paper entry; never asserts server authorization | Live server gate unchanged |
| `GET /api/scan`, `GET /api/scan/universe`, `GET /api/scan/view`, `PUT /api/scan/view` | Same six-row catalog/universe and demo-only saved view; scanner URL filter/sort remains client-side | Existing scanner DTOs and live write gate unchanged |
| `GET /api/scan/{symbol}/history` | Authored structure samples for a supported symbol, same scenario anchor and levels | Existing history DTO unchanged |
| `GET /api/ticker/{ticker}` | Authored full bundle plus supported query projection below; `position_eval: null` | Existing `TickerBundle` and query behavior unchanged |
| `GET /api/contract/{ticker}` | Authored contract mark/Greeks for an in-catalog contract; absent contract 404 maps to existing `null` | Existing `TrackedContract` contract unchanged |
| `GET /api/candidates/{ticker}` | Compatible authored candidate set or truthful `unavailable` state within existing DTO | Existing exported seam unchanged |
| `GET /api/_metrics` | Unavailable in public demo; no invented production timing/throughput | Existing operator route/access unchanged |
| `GET/PUT/DELETE /api/auth/ai-key`, `DELETE /api/auth/grok` | GET returns no real key/connection and demo capability explanation; writes/disconnect unavailable | Existing live key/OAuth paths unchanged |
| `GET /api/book`, `PUT /api/book` | Read/write only versioned browser demo book; never server sync | Existing authenticated live book unchanged |
| `POST /api/recommendation/{ticker}`, `GET /api/recommendation/status/{ticker}`, `GET /api/recommendation/export/{ticker}` | Authored, labeled sample analysis/status/export for supported symbol and exact known selected variant; no LLM or key use | Existing live recommendation paths, request body and DTOs unchanged |
| `GET /api/personas` | Nonempty canonical sample-compatible persona catalog | Existing live persona DTO unchanged |
| `GET/PUT/DELETE /api/broker/credential` | GET no credential; writes refuse before receiving/storing a secret | Existing live credential semantics unchanged |
| `GET /api/broker/book`, `POST /api/broker/book/refresh` | Labeled read-only sample holdings; refresh is local snapshot/no real broker; credential or order capability absent | Existing read-only live broker semantics unchanged |

This is the 30-call exported ordinary-HTTP inventory identified in `docs/backend-atlas/frontend-source-audit.md` §Complete ordinary HTTP facade inventory. For generated API types, keep existing absent/nullable members as declared; do not use response-shape forgery to attach demo standing. A valid 200 with `option_quote: null` remains different from 404/null contract lookup. The AI/recommendation status vocabulary remains its existing closed vocabulary, and authored sample copy distinguishes it from provider output. Operator `_metrics` and `_research` are not trader research. Public broker holdings/account labels and all other records are newly synthetic; `apps/dashboard/src/app/features/trading/broker/fixtures.ts` `POS_CAPTURE_*`, `POS_CB_*` and `BOOK_CAPTURED_COMPLETE` mirror the owner's real Webull capture and are forbidden as demo data. `features/auth/testBackend.ts` imports Vitest, so no production import of its builders; it and dated AI fixtures are shape references only, with new independent synthetic provenance.

### Ticker query and fixture projection

`getTicker(symbol, query, fetchOpts)` remains `Promise<TickerBundle>`; `TickerQuery` remains `minDte?`, `maxDte?`, `expirations?`, `darkPool?`, `position?`. The demo handler supports uppercase six-symbol registry `SPY|QQQ|AAPL|MSFT|NVDA|TSLA`; it normalizes case once. All have three catalog expiries `2026-10-09|2026-10-16|2026-11-20`, anchored at `2026-10-07T18:30:00Z` and DTE `2|9|44`. Omitted/empty `expirations` means all at the API seam, matching the existing caller; a UI selection of zero expiries is handled as an explicit no-selection state before request. A nonempty explicit set is deduplicated and sorted and may be any subset of the three. Omitted DTE means no DTE bound; provided min/max must be integers within 0..60 and min <= max. The intersection maps to exactly one of seven **nonempty sorted expiry-set keys**; an empty intersection shows no matching expiries, never a full-chain success. Any expiry outside the catalog or invalid bound produces 422 `demo_unsupported` and no network attempt.

Each key selects a curated patch over the shared full-chain base. The patch materializes together `market_state`'s selected DTE labels, GEX/DEX, walls, flip and peak; `strike_profile`; `signals.distances`, `regime`, `regime_note`, `setups`, `opportunity_score`, `score_drivers`, `opportunity_tier`, `prime_prompt_eligible` and `state_fingerprint`; and matching `ai_eval`, Market Context GEX/flow/shape reads, dealer-flow projection, candidates and authored sample-analysis claims when those mention selected structure. A dependent member with no defensible authored value is `null`/unavailable at its consumer, not copied from the all-expiry case; required non-null wire members require a coherent authored value or that set is not offered. The SPY all-expiry versus `2026-11-20` variant must visibly move a wall/flip **and** change its distance, setup/score and fingerprint, providing a non-vacuous G2 oracle. This is a finite catalog, not a runtime GEX/signal compiler. Full-chain max pain, put/call OI ratio, Vol/OI, IV/HV, IV rank and term structure retain their full-chain basis and are shared only with that label. `darkPool=true` or omitted includes authored off-exchange context with no inferred trade side. `darkPool=false` returns 422 `demo_unsupported`: live mode omits both off-exchange and its capped score contribution, and the demo catalog has no truthful scored variant for that request. The current ticker UI fixes the control on. A supplied `position` is validated as input but does not produce a fabricated evaluation: the rest of the bundle remains available, `position_eval` is explicitly `null`, and the position-evaluation widget says `Position evaluation unavailable for this sample.` Contract marks are resolved independently from the full catalog. A missing optional computation remains `null`/absent in the existing DTO and is named unavailable at its consumer; zero is reserved for a valid computed zero. Score/tier/fingerprint are authored variant claims only, never a new live computation or scoring input.

### Normal sample coverage within the existing ticker wire

For each of the six symbols and all seven nonempty selected-expiry sets, a successful ordinary demo `GET /api/ticker/{ticker}` populates the following existing `TickerBundle` members. This is the **normal loaded case**, not a fallback rule for malformed input, unavailable static assets or a deliberate degraded fixture. `position_eval:null` remains the one locked normal-view exception. No generated DTO, route or Rust endpoint changes.

| Existing member / consumer | Normal authored basis and consistency |
|---|---|
| `market_state.iv_skew` / read strip | Non-null finite call/put IV and slope, valid catalog expiration/DTE and named reference. The IV inputs refer to the selected expiry; slope agrees with the authored call/put values. |
| `market_state.term_structure` / term widget and read strip | Non-null full-chain `points` for all three authored expiries with finite ATM IV, date and DTE 2/9/44; `near_iv`, `far_iv`, `slope` and `state` agree with those points. Keep `full chain` visible under a selected-expiry filter. |
| `market_state.dealer_flow_projection` / dealer widget | Non-null `spot_basis` and **both** finite `charm` and `vanna` limbs with their horizon, move, opex and reference-direction bases. Any statement about selected GEX/structure uses that variant's authored patch; no copied all-expiry projection under a different fingerprint. Both limbs remain labeled illustrative. |
| `market_state.market_context` / context widget | Non-null `trend_momentum`, `gex_profile_shape`, `flow_vs_positioning` and `atr` with populated inner reads. Trend EMA/RSI/ADX and ATR come from the already defined 60-bar indicator implementation and name their window/close basis; shape uses the selected strike profile and spot; flow composition uses authored full-chain put/call volume and OI totals, while its location read uses selected profile. Every label/threshold agrees with the finite source value. These display reads do not change score, gate or live quant definitions. |
| `market_state.iv_rank` / read strip | Non-null available rank from a finite, explicitly authored full-chain IV observation window: `sample_count >= min_samples`, positive window metadata, finite current/min/max with nondegenerate range in the local fixture, `rank = 100 × (current-min)/(max-min)` in 0..100, and percentile/band consistent with the same observations. Keep its full-chain basis and advisory note visible; no external or recorded-market-history claim. |
| `market_state.vol_normalized_gex` / context/read strip | Non-null `call_gex`, `put_gex`, `net_gex`, `total_gex`, positive `vol_used`, `vol_basis` and `basis_note`; each normalized number equals its matching selected-variant raw GEX divided by the same decimal volatility basis. It follows the selected profile, not a stale full-chain numerator. |
| `market_state.straddle_move` / straddle widget | `state: 'ok'`, with a `primary_expiration` inside the selected set and at least its matching tenor. The tenor uses an authored call and put mark/quote at the same expiry and ATM strike; `straddle_price` equals the sum of their mids, `move_dollars` and `move_pct` agree with that price and `anchor_spot`, and quote-width fields agree with the marks. No normal `no_quote` substitute. |
| `strike_profile.strikes`, `market_state.chain_vol_oi_ratio`, `market_state.total_volume` / fresh positioning | At least three rows satisfy `volume / total_oi >= vol_oi_unusual_threshold` and render. Every row's `total_oi = call_oi + put_oi`, and `vol_oi_ratio = volume / total_oi` from its own authored values; the full-chain volume/ratio labels use corresponding full-chain sums. Correct the first-row mismatch: 3,500 / 38,000 is about 0.092, so it cannot carry 0.18. Do not raise a displayed ratio alone. |
| `off_exchange` / off-exchange widget | At least three positive `blocks` with finite price/shares/notional/proximity/sample age, nonzero `offex_shares` and `total_shares`, and coherent `levels`. `ratio_pct = 100 × offex_shares / total_shares`; block shares cannot exceed off-exchange shares, and level shares/percentages agree with the authored grouping. No block gains a buy/sell side, and no score direction is inferred from these prints. |

Fixture validation may use finite arithmetic and the existing indicator implementation; it must not add an independent analytics/scoring engine or imply Rust parity. Shared full-chain values retain that label in filtered views; selected-profile reads, dealer claims, normalized GEX, straddle tenor, candidate claims and sample-analysis numbers match the chosen fingerprint. A missing computation in a deliberate degraded fixture remains `null`/unavailable at its own consumer, never zero or an unrelated variant. The normal matrix cannot use that degraded-state rule to leave a listed group empty.

### Canonical catalog asset loading

`libs/api/src/lib/demo/catalog/` owns exactly six canonical, small JSON seed assets, one per supported symbol, each with `symbol`, finite numeric `base`, `step` and `phase`. Vite URL references must emit them as non-inlined static assets. The lazy loader fetches the selected same-host asset, checks HTTP success, parses JSON, validates the requested symbol against the payload and validates finite seed values, then calls the existing `makeScenario` factory without altering its domain math. An invalid/missing seed returns the typed local load error. Cache the fulfilled scenario and one concurrent in-flight load per symbol; remove a rejected in-flight entry so a same-document Retry issues a new asset request and can succeed once the asset is restored. The old per-symbol TS wrappers cannot remain independent copies of seed facts: they either consume these canonical assets or carry a `PARKED` marker with reason and restoration condition. No test-only production route bypasses the asset loader. Fetching a same-host catalog asset is normal static asset traffic, while `/api`, Pages Function, vendor, broker, OAuth and AI requests remain forbidden in demo.

### Existing sample-analysis and export facades

For demo `POST /api/recommendation/{ticker}`, the existing `RecRequest.snapshot_fingerprint` is the required exact selector. Match it against the chosen symbol's seven known variant fingerprints, including noncontiguous expiry sets; do not derive the selected set solely from `dte_min`/`dte_max`. Validate any supplied DTE bounds as integers in `0..60`, ordered when both are present, and require every expiry selected by the fingerprint to lie within those bounds. Bounds may also contain other catalog expiries: that does not enlarge the selected variant. Unknown fingerprint, symbol mismatch, selected expiry outside supplied bounds or malformed selector returns typed `demo_unavailable`; no authored recommendation is returned. The response uses the same selected variant's score, context, claims and fingerprint as the visible ticker bundle. This is local selection logic only; the existing live POST body and generated DTO stay unchanged.

The existing `fetchRecExport(symbol, options)` facade gains only an optional local option `sampleFingerprint?: string`; `personaId` keeps its current meaning. In demo only, the facade carries this option to the local `GET /api/recommendation/export/{ticker}` transport as `x-convexa-sample-fingerprint`. The local export handler validates that header against the chosen symbol's known variant fingerprints and returns the matching authored export, including scenario ID, as-of, sample authorship and the exact selected variant. An unknown or symbol-mismatched header returns typed `demo_unavailable`. Omitted header retains the existing full-chain default for callers without a selected bundle. `StateExportDrawer.tsx` accepts an optional `sampleFingerprint` prop and forwards it only for demo; `TickerDashboard.tsx` supplies the selected bundle's `ai_eval.state_fingerprint` at its existing drawer callsite. Live facade calls ignore the option and emit the same generated GET path/query/headers as before. No public backend header, query parameter, payload member or DTO is introduced.

## Local application-provider contract (no new backend endpoint)

The frontend lane implements and exports these named capabilities; import paths here are the implementation boundary. Existing API functions continue to be imported from `@convexa/api`. `libs/api/src/lib/demo/mode.ts` reads the generated first-paint `window.__CONVEXA_BOOT__` and exports `dataMode`, `scenarioProvenance` and `demoStorageKey`; `libs/api/src/lib/demo/transport.ts` exports `demoFetch`; `libs/api/src/lib/demo/catalog/` owns the six canonical JSON seeds and lazy loader; `libs/api/src/lib/demo/streams.ts` exports `subscribeTicker` and `subscribeScannerPrices`; `libs/api/src/lib/demo/views.ts` exports `loadSampleBars` and `loadSampleResearch`; `libs/api/src/lib/demo/workspace.ts` exports `initializeDemoWorkspace`, `resetDemoWorkspace`, `demoClock`, `subscribeDemoClock`, `resumeDemoPlayback`, `demoNowMs` and `canSimulatePaperAction`. Re-export public types/functions through `libs/api/src/index.ts` where app consumers need them. The live stream arm is the existing EventSource behavior; the local views' live arm returns a named unavailable outcome. `apps/dashboard/src/app/app.tsx` chooses route access and lazy view modules; existing browser stores call `demoStorageKey` at **all** reads, writes and legacy paths before hydration. Do not duplicate the scenario registry or implement a second key resolver in UI.

```ts
export type DataMode = 'demo' | 'live';
export const dataMode: DataMode; // build-time constant; absent env => live, invalid explicit env => build error

export type SupportedDemoSymbol = 'SPY' | 'QQQ' | 'AAPL' | 'MSFT' | 'NVDA' | 'TSLA';
export interface ScenarioProvenance {
  kind: 'synthetic_scenario';
  scenarioId: 'portfolio-2026-10-07-v1';
  asOf: '2026-10-07T18:30:00Z';
  label: 'Demo · sample data';
}
export function scenarioProvenance(): ScenarioProvenance | null; // null in live mode

export type LocalOutcome<T> =
  | { state: 'ready'; value: T; provenance: ScenarioProvenance }
  | { state: 'unsupported'; reason: 'unsupported_symbol' | 'unsupported_filter'; detail: string }
  | { state: 'unavailable'; reason: 'live_provider_missing' | 'uncurated' | 'capability_absent'; detail: string }
  | { state: 'error'; reason: 'load_failed' | 'invalid_sample'; detail: string };

export interface SampleBar {
  id: string; // scenarioId:symbol:YYYY-MM-DD
  date: string; // synthetic YYYY-MM-DD session label, strictly ascending, unique
  open: number; high: number; low: number; close: number; volume: number;
}
export type IndicatorName = 'ema20' | 'ema50' | 'rsi14' | 'adx14' | 'atr14';
export type IndicatorPoint =
  | { state: 'ready'; value: number; sourceBarId: string; method: string; window: number; basis: string; unit: 'USD' | 'index' }
  | { state: 'warmup'; value: null; reason: 'insufficient_history'; requiredBars: number; observedBars: number };
export interface SampleBarsView {
  symbol: SupportedDemoSymbol;
  interval: '1d'; priceUnit: 'USD';
  bars: SampleBar[]; // exactly 60 ordered synthetic daily observations ending at scenario asOf date
  indicators: Record<IndicatorName, IndicatorPoint[]>; // one point per bar, same index/date
}
export function loadSampleBars(symbol: string): Promise<LocalOutcome<SampleBarsView>>;

export type ResearchFact =
  | { state: 'present'; text: string; sourceIds: string[] }
  | { state: 'checked_none'; text: string }
  | { state: 'uncurated'; text: null };
export interface SampleResearchCase {
  symbol: SupportedDemoSymbol;
  scenarioId: ScenarioProvenance['scenarioId'];
  snapshotAsOf: ScenarioProvenance['asOf'];
  title: string; thesis: string; evidence: ResearchFact[];
  catalysts: ResearchFact[]; risks: string[]; invalidation: string;
  assumptions: string[];
}
export function loadSampleResearch(symbol: string): Promise<LocalOutcome<SampleResearchCase>>;

export interface BuildBootstrap {
  mode: DataMode;
  key(logicalKey: string): string; // one generated resolver: demo prefix or exact live key
}
// window.__CONVEXA_BOOT__: BuildBootstrap is defined by the blocking generated index.html script
// before that script's first theme/localStorage read or any ES module loads.
export interface DemoClock {
  anchor: ScenarioProvenance['asOf'];
  end: '2026-10-07T19:00:00Z';
  offsetMs: number; // 0..1_800_000, never derived from host date
  nowMs: number; // anchor epoch + offset
  playback: 'running' | 'paused' | 'ended';
}
export function demoClock(): DemoClock | null; // null in live mode
export function subscribeDemoClock(onState: (state: DemoClock) => void): Unsubscribe; // current state immediately, then changes
export function resumeDemoPlayback(): void; // paused controller fault only; ended requires Reset Demo
export function demoNowMs(): number; // demo create/default/sweep/record time; live callers retain existing clock
export function canSimulatePaperAction(): boolean; // local confirmed paper path only; false is not paid-live liveness

export function demoStorageKey(logicalKey: string): string; // demo => convexa.demo.v1.<logical>; live => exact existing key
export function initializeDemoWorkspace(): void; // before React/store hydration, seed absent keys once
export function resetDemoWorkspace(): void; // enumerate demo keys only, then location.reload() rehydrates every store

export function demoFetch(request: Request): Promise<Response>; // no global fetch fallback
export type Unsubscribe = () => void;
export interface ScannerPrice { price: number; ts: number } // server ts live; scenario epoch ms demo
export interface DemoOrderFrame {
  frameId: string; scenarioTimeMs: number; symbol: SupportedDemoSymbol;
  underlyingMid: number; marksByContractId: Record<string, number>; // absent contract => no fill
}
export type MarketStreamEvent =
  | { kind: 'ticker_update'; update: LiveUpdate }
  | { kind: 'scanner_prices'; prices: Record<string, ScannerPrice> } // changed symbols only
  | { kind: 'heartbeat'; receivedAtMs: number } // actual message receipt; not a fabricated price ts
  | { kind: 'connection'; state: 'connected' | 'offline'; reason: 'open' | 'message' | 'error' | 'silence_45s' }
  | { kind: 'playback'; state: DemoClock['playback']; scenarioTimeMs: number }
  | { kind: 'demo_order_frame'; frame: DemoOrderFrame };
export function subscribeTicker(symbol: string, query: TickerQuery, onEvent: (event: MarketStreamEvent) => void): Unsubscribe;
export function subscribeScannerPrices(symbols: string[], onEvent: (event: MarketStreamEvent) => void): Unsubscribe;
```

The outcome union above is for **new local views** and is not pasted into any existing generated HTTP DTO. `ready`, `unsupported`, `unavailable`, `error` describe provider outcomes. Optional `null` and `warmup` describe data within a ready result. React request state separately distinguishes `loading`, cold error and failed refresh with retained data. `DemoClock.playback` separately describes an actual local pause/end; browser `navigator.onLine=false` does not set it. New indicator method/window/basis are data fields so the chart can name them and independent vector checks can validate them. Research `uncurated` is unknown, never rendered as `checked_none`. The `sourceIds` for a present numeric/evidence claim resolve to authored scenario fields/bar IDs; an absent source withholds the claim.

### Sample tape presentation and Research case obligations

The demo stream keeps the existing `LiveUpdate` shape: `live: false`, `session_tape: null`/absent, authored `buy_vol`, `sell_vol`, `net_flow = buy_vol - sell_vol`, positive bid/ask with `spread = ask - bid`, selected-variant `gamma_flip`, finite `mid`, `flow_window_s` and `ts`/`spot_ts` from the scenario clock. The current `LiveTape` and structure-mid consumers need a **separate application-local presentation standing**, for example `{ kind: 'sample'; symbol: SupportedDemoSymbol; scenarioTimeMs: number; playback: DemoClock['playback'] }` in `liveTapeStore.ts`, derived only from the active demo stream and clock. It is not a generated DTO member, a session-tape occupancy, or a live-provider signal. `useTickerStream.ts` publishes the standing with the sample update; `LiveTape.tsx` and `StructureHeroPanel.tsx` admit raw sample figures when that standing matches the route symbol. Both continue to key live dots, pulse, flash and trail exclusively from `isDeliveringLive`/genuine-live predicates, which remain false in demo. The visible title/caption says `Sample tape` and shows the scenario timestamp/window. Pause/end stop new values and retain the last figures/timestamp, with the corresponding explicit status; a new symbol clears the prior symbol's latch. The existing paper-order `demo_simulation` standing remains independent and uses `DemoOrderFrame`, not this presentation metadata. The live arm does not set or consume the sample standing.

`SampleResearchCase` retains its existing local type. For each supported symbol, `title`/`thesis`, at least two `evidence: {state:'present', sourceIds}` entries, `risks` and `invalidation` are authored around that symbol's own bar IDs and/or named scenario snapshot fields. The source IDs must resolve to the same case's inputs; a generic identical synthetic disclaimer alone is not a case. A source mismatch withholds the affected claim. `catalysts` may remain `uncurated` if none were authored, and a claim is `checked_none` only after that scenario source was actually checked. No external citation, current news, price forecast, measured result or AI claim is created.

### Streaming and browser capability edges

The ticker stream seam wraps existing `streamTicker` without changing that public function's signature; scanner's `useLivePrices.ts` EventSource moves behind the same provider choice. In live mode the scanner adapter merges **changed** `ScannerPrice` objects with their server `ts`, sets `offline` on EventSource error or 45 seconds without a message, and clears it on the next actual message/heartbeat. Its watchdog uses actual receipt wall time, while row age uses the untouched server timestamp. EventSource comment-only heartbeats cannot be claimed as delivered messages. In demo, scanner `ts` is the scenario frame epoch and its age UI says sample/as-of rather than wall-clock market freshness; `Scanner.tsx` disables its price flash specifically in demo and keeps the existing live condition. The shared controller emits immutable ticker/scanner/mark frames to all subscribers, plus a `playback` status on pause/end; it advances five scenario seconds per wall second only while observed, stops its timer at zero subscribers, resumes without catch-up, and freezes at 19:00Z. It admits one bounded asynchronous frame batch. Pause, end, subscribe or unsubscribe invalidates pending work; after every awaited catalog load it rechecks batch identity, playback state, offset and current cohort before emission. Replacement subscribers wait for the next frame, and a pending old frame cannot arrive during pause or after end. A controller fault Retry resumes at the retained offset; only reload resets the offset to the anchor. `subscribeDemoClock` and `playback` events make pause/end observable even when no price changed. A demo subscription never constructs `EventSource`, sets `LiveUpdate.live` true or creates `session_tape`. Unsubscribe removes only that observer; retained prices and static bundle survive teardown/gaps. Network loss alone does not emit paused. Demo operator pages render unavailable without importing/calling the absolute-base `researchClient.ts` fetch or the metrics poll; the public Research view uses only `loadSampleResearch`. `GoogleButton` and `AiKeySection` cannot navigate to OAuth in demo. Broker refresh, AI key writes, signup/login and direct unknown paths refuse before a request is created. File exports derive only from the demo namespace and include `scenarioId`, `asOf`, and `Sample analysis · authored for this scenario` in the exported content.

### Browser namespace, auth and order boundary

`apps/dashboard/vite.config.mts` injects one generated blocking classic script into built `index.html` using `transformIndexHtml`; it serializes the validated build mode and shared `BuildBootstrap.key` resolver to `window.__CONVEXA_BOOT__`, then reads first-paint theme using that resolver. `libs/api/src/lib/demo/mode.ts` delegates to this generated object. The `src/main.tsx` entry statically imports storage-only `src/prebootstrap.ts`, which statically imports `initializeDemoWorkspace` from the public `@convexa/api` barrel; this keeps the API library a static Nx consumer without evaluating App/store modules. The entry calls the initializer before `await import('./mountApp')`; only that mount module imports App/stores and hydrates React. No store or migration module can be evaluated before seed completion. All current and legacy position reads (`convexa.positions.v3/v2`, `convexa.ghost-trade.v1`, `gammaflow.*`), position touch timestamp, orders, alerts, personas, recent tickers, settings/UI preferences, first-paint theme key, outcome/export sources, scanner saved view and book sync resolve through that key before any storage access. Live resolves exact pre-existing keys and migrations. Demo resolves only `convexa.demo.v1.*`; **there is no demo-to-live legacy fallback**, including in the classic theme script. On absent demo state, initialize one coherent seed and version sentinel; a present deliberately emptied state is not absent. Corrupt/unreadable original bytes remain in place and write-fault latches block overwrite. Reset enumerates only the demo namespace and reloads the document so already hydrated store singletons cannot retain stale state. Local session has a display-only demo identity and no server cookie, while live access controls remain on Rust. G3 checks the **first painted** scheme with conflicting live/demo theme values and the post-reset reload, not only final React theme.

The existing shared `TradeEntryDialog` confirmation is mandatory for local market/limit paper placement, cancellation and book updates. In demo, `tradeEntry/types.ts` default good-til/today and expiry conversion, `useOrders.ts` create/cancel/decision times and both tick/render `sweepExpiredOrders` call sites, and `useOrderEngine.ts` evaluation time receive `demoNowMs` (scenario clock) and Eastern end-of-contract-day; the live branch retains its current wall clock behavior. The host `useOrderEngine.ts` resolves an authored mark from the same `DemoOrderFrame` by contract ID, **without** passing through `liveOptionMark`'s paid-live predicate; unavailable/frozen sample mark is null. `orders/engine.ts` gains `demo_simulation` as a separate pure tick standing and `tickFromDemo(frame, mark, now)`: its trigger/fill guard accepts that standing only for demo frames when playback runs, while `tickFromLive` still derives `genuineIsLive` and still rejects synthetic `LiveUpdate`. It keeps the existing comparator, `limitWouldFill`, forward-only transition and one-position-per-fill logic. A newly confirmed or seeded pending order evaluates only on the **next** frame; no retro-fill on mount, paused/end, or host wall date after October expiries. The demo standing cannot unlock real broker execution or claim `isDeliveringLive`.

```ts
// apps/dashboard/src/app/features/trading/orders/engine.ts additive pure adapter
export type OrderEvaluationStanding = 'genuine_live' | 'demo_simulation' | 'unavailable';
export function tickFromDemo(frame: DemoOrderFrame, optionMark: number | null, nowMs: number): EngineTick;
// EngineTick carries OrderEvaluationStanding; demo_simulation never sets LiveUpdate.live or genuineIsLive.
```

## Conformance spec

These are **unchanged live endpoint shape pins**, drawn from existing generated types and the current foundations contract. They are safe anonymous GETs. When a live backend is available, `interface_conformance.mjs` can check them. A backend-unavailable run is recorded `NOT RUN` under `NO_BACKEND_CHANGE`, never called a pass. New bars/research have no backend endpoint to invent or probe; their union/type and built-demo browser contract are above and in SPEC §7.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/auth/session",
      "query": {},
      "required": {
        "authenticated": "boolean",
        "google_available": "boolean",
        "user": "object|null",
        "settings": "object|null"
      }
    },
    {
      "method": "GET",
      "path": "/api/scan",
      "query": {},
      "required": {
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].status": "string",
        "rows[].tier": "string|null",
        "rows[].score": "number|null",
        "rows[].as_of": "number",
        "sweep": "object|null",
        "view": "object"
      }
    }
  ]
}
```

The block checks only existing backend shape, not demo mode or no-egress. Its two anonymous endpoints require no session bootstrap or paid recommendation invocation. SSE and local provider behavior are verified at their own boundaries; a successful conformance sweep cannot establish that the static demo avoided the Pages `/api` proxy. Conversely, `NO_BACKEND_CHANGE` does not authorize an `apps/api` edit if the demo frontend proves hard to compose.
