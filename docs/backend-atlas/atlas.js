/* Source-derived teaching atlas. No API requests, simulations, or measured timings. */
(() => {
  'use strict';
  const base = 'https://github.com/ariasr47/convexa/blob/8932fc1176543eff3fa826de6924e12ec52f3310/';
  const demoBase = 'https://github.com/ariasr47/convexa/blob/codex/portfolio-demo-platform/';
  const be = 'apps/api/src/', fe = 'apps/dashboard/src/app/', api = 'libs/api/src/lib/', quant = 'libs/quant-engine/src/';
  const ref = (path, line) => [path, line];
  const b = (path, line) => ref(be + path, line), f = (path, line) => ref(fe + path, line);
  const a = (path, line) => ref(api + path, line), q = (path, line) => ref(quant + path, line);
  const d = (path, line) => [path, line, demoBase];
  const byId = id => document.getElementById(id);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const sources = refs => {
    const list = element('div', undefined, 'source-links');
    list.setAttribute('aria-label', 'Source references');
    refs.forEach(([path, line, sourceBase]) => {
      const link = element('a', `${path}:${line}`);
      link.href = `${sourceBase ?? base}${path}#L${line}`;
      list.append(link);
    });
    return list;
  };
  const list = items => {
    const ul = element('ul');
    items.forEach(item => ul.append(element('li', item)));
    return ul;
  };
  const nodes = {
    browser: ['React dashboard', 'Four primary destinations share a shell, but own different kinds of state.', [
      'Ticker composes a REST bundle, ticker stream, structure history and universe membership. The bundle polls every 60 seconds.',
      'Scanner polls structure every 30 seconds and overlays one price stream for visible symbols. Scanner and Positions are auth-gated.',
      'Alerts and simulated positions live in browser stores. A stream update does not replace the structural snapshot.'
    ], [f('pages/ticker/useTickerPageModel.ts', 40), f('pages/ticker/useTickerBundle.ts', 15), f('pages/scanner/useScan.ts', 61), f('app.tsx', 162)]],
    facade: ['Typed API boundary', 'Ordinary HTTP passes through one openapi-fetch client and generated contract types.', [
      'The frontend audit counted 30 ordinary HTTP call sites; the OpenAPI artifact contains 50 paths / 57 operations. These are different inventories.',
      'Ticker EventSource is created in the facade. Scanner EventSource is created in its hook, so replacing fetch alone misses a stream.',
      'Operator research has a separate token-based client; OAuth buttons navigate outside ordinary HTTP.'
    ], [a('client.ts', 5), a('convexa.ts', 1306), f('pages/scanner/useLivePrices.ts', 57), f('pages/operator-session-archive/researchClient.ts', 43)]],
    edge: ['Pages edge boundary', 'Cloudflare serves the frontend and proxies the existing live API path to API_ORIGIN.', [
      'The Pages function forwards API traffic to the configured origin. Source configuration points to a Railway backend.',
      'Public operator metrics and research paths are blocked at the edge.',
      'The proposed static demo bypasses this proxy entirely. This diagram does not verify current remote availability.'
    ], [ref('functions/api/[[path]].ts', 44), ref('functions/api/[[path]].ts', 54), ref('functions/api/[[path]].ts', 81)]],
    router: ['Axum + AppState', 'A modular Rust application composes services in one shared state and registers handler-owned route contracts.', [
      'AppState owns the vendor client, caches, auth, broker service, stream hub and research services.',
      'Middleware provides rate limiting, CORS and HTTP tracing; handlers define the public contract graph.',
      'Production validates configuration, database schema and archive roots before serving. Worker startup happens only after a successful bind.'
    ], [b('state.rs', 265), b('routes/mod.rs', 35), b('server.rs', 22), b('server.rs', 284)]],
    analytics: ['Analytics service', 'A structural snapshot is computed once per symbol and reused across consumers.', [
      'Replay hold / TTL cache / per-symbol singleflight decide whether new acquisition is needed. Concurrent consumers share the in-flight work.',
      'Chain, daily bars, minute bars and optional trades are fetched together. Chain is required; the other inputs can degrade their own outputs.',
      'CPU work runs in Tokio blocking tasks, then the result is cached and captured where applicable. Price updates have a separate path.'
    ], [b('services/analytics.rs', 21), b('services/analytics.rs', 258), b('services/analytics.rs', 354)]],
    stream: ['Shared price streams', 'One stock-stream hub broadcasts vendor events to cache, capture and browser consumers.', [
      'Massive WebSocket authentication and subscriptions feed a shared hub; browsers receive SSE, not the vendor socket.',
      'Routes filter/throttle per symbol, batch watch prices and send heartbeat comments.',
      'Request/task/admission lifetimes remain attached until the stream closes. Browser subscription cleanup is a separate responsibility.'
    ], [b('infrastructure/massive/ws.rs', 325), b('routes/stream.rs', 436), b('routes/stream.rs', 458), a('convexa.ts', 1306)]],
    identity: ['Identity + two books', 'Authentication, the simulated book and the broker book have distinct owners.', [
      'Passwords use Argon2; session cookies are signed; stored credentials use AES-256-GCM.',
      '/api/book syncs per-user opaque frontend positions/orders/decisions JSON. With no Postgres, the server returns source:none and the browser owns storage.',
      'BrokerBookService resolves credentials and uses a per-user TTL/throttle cache. Its provider defaults to a deterministic stub; Webull is an adapter_fault placeholder.'
    ], [b('services/auth/passwords.rs', 8), b('services/auth/cookies.rs', 51), b('services/auth/crypto.rs', 94), b('routes/book.rs', 369), b('services/broker/mod.rs', 93)]],
    quant: ['Pure quant engine', 'Rust calculations consume supplied market inputs; this library does not own vendor I/O.', [
      'Existing outputs include GEX, greeks, signals, IV/HV, VWAP bands, skew, term structure and candidate calculations.',
      'Market Context adds EMA20/50, Wilder ADX14 and RSI14, plus ATR5/14/30 as simple mean true range. ATR here is not Wilder-smoothed.',
      'Context fields are independently nullable and attached after signals; they must not alter score, gate or fingerprint. No general candle-history API is established by these summaries.'
    ], [q('lib.rs', 1), q('context_pack.rs', 1), b('services/analytics.rs', 424), b('services/analytics.rs', 510)]],
    vendor: ['External adapters', 'Market acquisition, language-model explanation and broker holdings are separate boundaries.', [
      'Massive REST supplies analytics inputs; stock WebSocket supplies streaming prices; S3-compatible flat files support retained data.',
      'LLM adapters support Anthropic, OpenAI, xAI, Gemini and compatible endpoints. Their output does not feed the quant score.',
      'AI_REC_LOCAL_ONLY chooses rule-based strategy construction, but the usable-key check still runs first. It is not a free public demo selector.'
    ], [b('infrastructure/massive/rest.rs', 94), b('infrastructure/flatfiles/client.rs', 1), b('services/llm.rs', 12), b('services/recommendation.rs', 3), b('services/recommendation.rs', 775)]],
    storage: ['Several lifetimes', 'Caches, account records, simulation books and research archives are not interchangeable stores.', [
      'PriceCache uses memory or optional Redis, with memory fallback on Redis connection failure. Redis SET writes here have no expiry.',
      'Analytics has an in-process TTL cache. Scanner/auth/IV metadata can use Postgres or local alternatives; AuthStore.open_sqlite actually persists JSON.',
      'Research uses filesystem bodies plus metadata. The compiled migrations name 16 domain tables; this is schema intent, not a database inspection.'
    ], [b('infrastructure/redis/price_cache.rs', 16), b('infrastructure/redis/price_cache.rs', 144), b('state.rs', 1469), b('services/auth/store.rs', 602), b('db/migrations.rs', 15)]],
    scanner: ['Prepared scanner reads', 'Fast price refreshes and slower structural sweeps prepare the scanner before the browser asks.', [
      'The universe seeds scanner work. A fast snapshot loop updates spot/movement; the slow batch calls load_or_compute and projects tiers.',
      'Rows, heartbeat, bundles and history are persisted. /api/scan reads stored rows, then the browser overlays price events.',
      'Price-only fast ticks do not append structure samples. A price refresh is not a fresh structural analysis.'
    ], [b('services/scanner/universe.rs', 39), b('services/scanner/loop.rs', 194), b('services/scanner/loop.rs', 457), b('services/scanner/loop.rs', 498), b('routes/scan.rs', 593)]],
    research: ['Research off the trader path', 'Captured market inputs become archives, replays, joined outcomes and research reports.', [
      'Tools include structure samples, horizon outcome joins, score-lab driver analysis, batch replay/backtest, archive coverage and flat files.',
      'Most capabilities are CLI or operator surfaces. The browser operator client uses its own token and omits normal session credentials.',
      'Replay refuses APP_ENV=prod; production fixture injection is also refused. The implemented public Research view is a separate lazy ticker page backed by authored local sample cases; it does not expose operator archives or call this pipeline.'
    ], [b('services/research/mod.rs', 5), b('main.rs', 121), f('pages/operator-session-archive/researchClient.ts', 43), b('state.rs', 780), b('state.rs', 905)]]
  };
  // Each trace item is [step title, explanation, exact source references].
  const traces = [
    ['Open a ticker', 'Price and structure are independent; the steps show dependencies, not a measured serial timeline.', [
      ['Request the bundle', 'The dashboard asks for a typed ticker bundle; the backend also has a progressive staged SSE entry.', [a('convexa.ts', 1336), b('routes/ticker.rs', 211)]],
      ['Fast price branch', 'Read the price cache. A cold cache can request a quick stock snapshot and cache the price independently of structural analytics.', [b('routes/market.rs', 782), b('routes/ticker.rs', 211)]],
      ['Reuse or acquire', 'Analytics checks replay hold, TTL cache and per-symbol singleflight. Required chain plus daily/minute/optional trade inputs are acquired when needed.', [b('services/analytics.rs', 21), b('services/analytics.rs', 258)]],
      ['Compute structure', 'Blocking tasks run quant calculations. Missing optional inputs degrade their respective outputs; chain failure prevents a complete computation.', [b('services/analytics.rs', 258), b('services/analytics.rs', 354)]],
      ['Return a snapshot', 'The route returns the bundle or staged events. The browser later overlays ticker SSE prices without pretending the REST structure was recomputed.', [b('routes/market.rs', 782), f('pages/ticker/useTickerPageModel.ts', 40)]]
    ]],
    ['Open the scanner', 'Background production makes the read route cheap; browser price updates remain separate.', [
      ['Load the universe', 'Scanner startup reads the configured universe, establishing which symbols the workers will cover.', [b('services/scanner/universe.rs', 39)]],
      ['Refresh fast prices', 'The fast stock-snapshot loop updates spot and movement. Price-only ticks do not append structure samples.', [b('services/scanner/loop.rs', 194), b('services/scanner/loop.rs', 498)]],
      ['Sweep structure', 'The slow batch invokes load_or_compute and projects analytic results into scanner rows and tiers.', [b('services/scanner/loop.rs', 457)]],
      ['Read stored rows', 'Rows, heartbeat, bundles and structure history are stored. /api/scan serves these prepared rows.', [b('services/scanner/store.rs', 215), b('routes/scan.rs', 593)]],
      ['Overlay visible prices', 'The page polls structure every 30 seconds and subscribes to batched SSE prices for its visible symbols.', [f('pages/scanner/useScan.ts', 61), f('pages/scanner/useLivePrices.ts', 57)]]
    ]],
    ['Receive a price update', 'A shared backend broadcast fans out to independent consumers; no visitor connects directly to Massive.', [
      ['Authenticate the socket', 'The backend stock WebSocket worker authenticates and subscribes to Massive.', [b('infrastructure/massive/ws.rs', 325)]],
      ['Broadcast the event', 'Decoded stock events enter the shared hub for cache, tape capture and SSE consumers.', [b('infrastructure/massive/ws.rs', 325)]],
      ['Shape browser events', 'SSE routes filter and throttle by symbol; watch prices are batched and heartbeat comments keep the stream active.', [b('routes/stream.rs', 436), b('routes/stream.rs', 458)]],
      ['Update the display', 'Ticker EventSource and scanner EventSource have separate constructors. Live eligibility is checked independently of receiving an event.', [a('convexa.ts', 1306), f('pages/scanner/useLivePrices.ts', 57), f('shared/liveness/liveClaim.ts', 52)]],
      ['Release on close', 'Server stream guards hold request/task/admission lifetimes until closure. A replacement demo stream must also preserve unsubscribe and cleanup.', [b('routes/stream.rs', 436), a('convexa.ts', 1306)]]
    ]],
    ['Sign in and open the book', 'The simulated book and broker holdings use separate paths and must retain separate meanings.', [
      ['Verify identity', 'Login verifies the password and issues a signed session cookie.', [b('routes/auth.rs', 1167), b('services/auth/passwords.rs', 8), b('services/auth/cookies.rs', 51)]],
      ['Read the user book', 'Authenticated /api/book loads the per-user Postgres blob, or returns an empty source:none envelope without Postgres.', [b('routes/book.rs', 329), b('routes/book.rs', 369)]],
      ['Reconcile locally', 'The session effect starts a best-effort book pull. Browser positions/orders sync with latest-client-timestamp semantics.', [f('features/auth/AuthContext.tsx', 139), f('features/trading/positions/bookSync.ts', 9), b('routes/book.rs', 380)]],
      ['Resolve broker separately', 'BrokerBookService resolves a user credential and uses per-user TTL/throttle caching before PositionsProvider.fetch_book.', [b('services/broker/service.rs', 102), b('services/broker/service.rs', 175)]],
      ['Show two domains', 'Positions combines local simulation, contract marks and read-only broker holdings. A broker read is not a simulated-book write or real-order submission.', [f('pages/positions/PositionsPage.tsx', 103), a('broker.ts', 277)]]
    ]],
    ['Explain a market scenario', 'Online recommendation and offline research share market context, but are different workflows.', [
      ['Apply route policy', 'The recommendation path applies its session policy, then resolves user AI preference and key.', [b('routes/recommendation.rs', 546), b('services/recommendation.rs', 775)]],
      ['Ground the request', 'Cached or derived market data, candidate/risk grounding, gate, cap and cooldown constrain the recommendation workflow.', [b('services/recommendation.rs', 3), b('services/recommendation.rs', 775)]],
      ['Choose the explanation path', 'Local-only mode constructs a rule-based strategy after the key check; otherwise the configured LLM provider receives an HTTP request.', [b('services/recommendation.rs', 820), b('services/llm.rs', 234)]],
      ['Return grounded output', 'A recommendation envelope supplies explanation. LLM output does not feed the deterministic quant score.', [b('services/recommendation.rs', 3)]],
      ['Research is another path', 'Captured samples instead enter offline joins, replay/backtest and score-lab reports. A public curated synthetic research page is proposed, not an existing online LLM endpoint.', [b('services/research/mod.rs', 1), b('main.rs', 121)]]
    ]]
  ];
  // Tables use four columns: owner, input/lifetime, behavior, citations.
  const tables = {
    widgets: ['Screens & widgets', 'Surface', 'Input / owner', 'What the visitor sees', [
      ['Ticker command deck', 'market_state, signals, freshness, expirations; mode-specific price stream', 'Live uses the Rust-backed bundle. Demo selects one of seven authored nonempty expiry variants per symbol; dependent signals and the state fingerprint travel with the selected variant.', [f('pages/ticker/TickerDashboard.tsx', 838), d('libs/api/src/lib/demo/catalog/index.ts', 17), d('libs/api/src/lib/demo/transport.ts', 1100)]],
      ['Structure field + read strip', 'market_state, strike_profile.strikes; ticker stream for tape', 'Structure, walls and summary figures; the stream updates tape, not all analytics.', [f('pages/ticker/TickerDashboard.tsx', 926), f('pages/ticker/TickerDashboard.tsx', 939)]],
      ['Structure history', '/api/scan/{symbol}/history?limit=48', 'Historical structure samples with their basis and loading/error states.', [f('pages/ticker/useStructureHistory.ts', 8)]],
      ['Market Context', 'market_state.market_context', 'The live snapshot shows its supplied context. The separate Technical analysis view reads authored local OHLC bars and displays EMA20/50, RSI14, ADX14 and ATR14 with basis and warm-up states; it does not change Market Context, score or entry gate.', [f('pages/ticker/widgets/market-context/MarketContext.tsx', 36), q('context_pack.rs', 1), d('apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisView.tsx', 39), d('libs/api/src/lib/demo/indicators.ts', 20)]],
      ['Term structure + straddle move', 'market_state.term_structure / straddle_move', 'Volatility context from the REST snapshot and its age.', [f('pages/ticker/TickerDashboard.tsx', 1151), f('pages/ticker/TickerDashboard.tsx', 1165)]],
      ['Dealer flow + fresh positioning', 'dealer_flow_projection; chain_vol_oi_ratio; unusual strikes', 'Separate derived projections and activity context.', [f('pages/ticker/TickerDashboard.tsx', 1146), f('pages/ticker/TickerDashboard.tsx', 1169)]],
      ['Off-exchange + setups', 'off_exchange; signals.setups', 'Normal demo view contains at least three side-unknown off-exchange blocks with matching totals; setups come from the selected authored variant.', [f('pages/ticker/TickerDashboard.tsx', 1176), f('pages/ticker/TickerDashboard.tsx', 1182)]],
      ['AI read + analysis drawer', 'Recommendation status/POST, personas, pinned bundle, position digest', 'Live recommendation behavior retains its provider boundary. Demo exports the exact selected authored expiry fingerprint and states that no content was sent to an external provider.', [f('pages/ticker/widgets/ai-rec/useAiRecommendation.ts', 94), f('pages/ticker/widgets/ai-rec/StateExportDrawer.tsx', 124), d('libs/api/src/lib/demo/transport.ts', 478)]],
      ['Technical analysis', 'Ticker-local lazy view; 60 authored daily bars', 'Shows indicator series with method, units, source and insufficient-history states. Separate from the existing live Market Context widget and quant decision fields.', [d('apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisView.tsx', 39), d('libs/api/src/lib/demo/indicators.ts', 20)]],
      ['Research', 'Ticker-local lazy view; authored case per supported symbol', 'Six distinct authored cases, each with two linked source items, thesis, evidence, catalysts, risks and invalidation. This public view is distinct from operator archive research and has an explicit unavailable state in live mode.', [d('apps/dashboard/src/app/pages/ticker/research/ResearchView.tsx', 51), d('libs/api/src/lib/demo/views.ts', 66)]],
      ['Position brief + sim orders', 'Local book, independent order store, contract marks and ticker stream', 'Simulated exposure and order state; execution depends on eligibility.', [f('pages/ticker/TickerDashboard.tsx', 1025), f('features/trading/orders/useOrderEngine.ts', 94)]],
      ['Trade-entry dialog', 'Bundle expiries/strikes + contract lookup + simulation gate', 'Selection resolves a contract before writing the local simulated book.', [f('features/trading/tradeEntry/TradeEntryDialogView.tsx', 250), f('pages/ticker/useTickerTradeFlows.ts', 146)]],
      ['Scanner + command palette', 'Prepared scan rows; visible-symbol SSE; URL filters', 'Scanner polls structure; the palette requests rows once per opening.', [f('pages/scanner/useScan.ts', 61), f('shell/CommandPalette/usePaletteScan.ts', 10)]],
      ['Alerts + future slots', 'Browser rules; successful ticker REST snapshots', 'Local evaluations drive alert history. The intentionally inert coming-soon affordance remains inert; populated normal sample context is supplied by the authored ticker bundle.', [f('pages/ticker/TickerDashboard.tsx', 571), f('pages/ticker/TickerDashboard.tsx', 1044)]]
    ]],
    stores: ['Stores & lifetime', 'Store', 'Lifetime / ownership', 'Boundary that matters', [
      ['PriceCache', 'Memory or optional Redis', 'Redis connection failure falls back to memory; Redis writes have no expiry here.', [b('infrastructure/redis/price_cache.rs', 16), b('infrastructure/redis/price_cache.rs', 144)]],
      ['GexCache + GexFlight', 'Per process; configured TTL + per-symbol singleflight', 'peek supports stale/read-only consumers. Cache lifetime differs from stock-event freshness.', [b('state.rs', 1469), b('services/analytics.rs', 46)]],
      ['ScanStore', 'JSON/memory or Postgres', 'Rows, sweep heartbeat, bundles and structure history are stored together.', [b('services/scanner/store.rs', 215)]],
      ['AuthStore + IV history', 'JSON or Postgres account records; historical IV samples', 'Auth open_sqlite is JSON despite its name. Analytics can write IV history when deriving rank.', [b('services/auth/store.rs', 602), b('services/analytics.rs', 434)]],
      ['Server simulation book', 'Per-user opaque v3 JSON in Postgres', 'Latest client timestamp wins. Without Postgres, GET source:none leaves ownership local.', [b('routes/book.rs', 369), b('routes/book.rs', 380)]],
      ['Browser positions + orders', 'Live keys plus a separate convexa.demo.v1.* namespace', 'Separate fault latches remain. The demo resolver scopes reads, writes, migration keys and reset to its own namespace; the local paper book stays separate from read-only sample broker holdings.', [f('features/trading/positions/store.ts', 60), f('features/trading/positions/store.ts', 235), f('features/trading/orders/store.ts', 19), d('libs/api/src/lib/demo/mode.ts', 52), d('libs/api/src/lib/demo/workspace.ts', 559)]],
      ['Track record + trends', 'Outcomes derived from books/orders; trends ephemeral', 'Trend buffers cap at 240 samples / 60 minutes and clear on reload; they are not durable market history.', [f('features/trading/outcomes/sources.ts', 80), f('features/trading/positions/useTrends.ts', 13)]],
      ['Alerts, personas, preferences', 'Mode-resolved browser versioned keys', 'The demo key resolver scopes current and legacy reads, writes and the pre-React theme paint to the demo namespace.', [f('features/alerts/store.ts', 22), f('features/personas/store.ts', 9), f('features/auth/localPrefs.ts', 15), f('features/auth/firstPaintTheme.ts', 12), d('libs/api/src/lib/demo/mode.ts', 52)]],
      ['Research archives', 'Filesystem bodies + JSON/Postgres metadata', 'Snapshots, session archives, tapes and flat files have separate roots and provenance.', [b('state.rs', 1247), b('state.rs', 1317)]]
    ]],
    api: ['API families', 'Family', 'Routes / callers', 'Responsibility', [
      ['Desk + contracts', '/api/ticker/{ticker}, market-data, signals, strike-profile, contract, candidates', 'Typed structural snapshot and selected contract/candidate reads.', [b('routes/market.rs', 781), b('routes/contract.rs', 140), b('routes/candidates.rs', 158)]],
      ['Prices + streams', '/api/price/{ticker}, /api/prices, ticker progressive, /api/stream/*', 'Price reads and long-lived staged/live updates have different lifecycles.', [b('routes/price.rs', 166), b('routes/ticker.rs', 200), b('routes/stream.rs', 408)]],
      ['Scanner', '/api/scan, all, universe, view, {symbol}/history', 'Prepared rows, saved views and structural history.', [b('routes/scan.rs', 388)]],
      ['Identity + settings', 'Session, signup/login/logout, settings, keys, OAuth', 'Signed identity and per-user preferences/credential handling.', [b('routes/auth.rs', 1132)]],
      ['Simulation + broker', '/api/book; /api/broker/credential, book, book/refresh', 'Simulation JSON sync is separate from read-only provider holdings.', [b('routes/book.rs', 318), b('routes/broker.rs', 319)]],
      ['Recommendations + personas', 'Recommendation POST/status/export, sim-trade gate, /api/personas', 'Grounded explanation, simulation authorization and strategy preferences.', [b('routes/recommendation.rs', 546), a('convexa.ts', 2176)]],
      ['Health + metrics', '/health, /api/health, /api/_metrics', 'Health routes exist; metrics currently declares instrumentation disabled with empty recent traces.', [b('routes/health.rs', 249), b('routes/health.rs', 649)]],
      ['Operator research', '/api/_research/*', 'Snapshot, tape, session-book, flat-file and archive coverage operations; blocked by the public Pages proxy.', [b('routes/mod.rs', 70), ref('functions/api/[[path]].ts', 44)]]
    ]]
  };
  const journeys = [
    ['Explore a market', ['Scanner', 'Choose a symbol', 'Ticker snapshot', 'Context + structure history'], 'Prepared scan rows lead into the ticker model; structural context and streamed prices retain their own freshness.', [f('pages/scanner/Scanner.tsx', 136), f('pages/ticker/useTickerPageModel.ts', 40)]],
    ['Record a simulated decision', ['Ticker', 'Trade-entry selection', 'Simulation gate', 'Local book', 'Positions / outcomes'], 'Contract lookup and auth gating precede the simulation write. Outcomes are derived from positions/orders; this is not a broker execution path.', [f('pages/ticker/useTickerTradeFlows.ts', 146), f('features/trading/outcomes/sources.ts', 80)]],
    ['Follow an alert', ['Define browser rule', 'Successful ticker REST snapshot', 'Evaluate', 'Local event history'], 'Alerts are browser-local. Notification permission is an actual browser permission, independent of stored rules.', [f('pages/alerts/AlertsPage.tsx', 241), f('pages/ticker/TickerDashboard.tsx', 571)]],
    ['Ask for an explanation', ['Persona + pinned bundle', 'Recommendation request', 'Grounded response', 'Analysis / export'], 'The user-triggered explanation uses its own provider/key availability. It does not rewrite the quant score.', [f('pages/ticker/widgets/ai-rec/useAiRecommendation.ts', 179), b('services/recommendation.rs', 3)]],
    ['Explore authored demo analysis', ['Choose ticker', 'Technical analysis', 'Research case', 'Export selected snapshot'], 'Technical analysis and Research are separate lazy ticker views. They use authored browser-local bars and symbol cases; Research does not expose operator archives. Export provenance follows the exact selected expiry variant.', [d('apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisView.tsx', 39), d('apps/dashboard/src/app/pages/ticker/research/ResearchView.tsx', 51), d('libs/api/src/lib/demo/transport.ts', 478)]],
    ['Research a captured session', ['Operator credentials', 'Archive coverage', 'Session book', 'Replay / outcome reports'], 'Separate operator/CLI workflow. The public ticker Research page uses authored local cases and does not call the operator archive client.', [f('pages/operator-session-archive/researchClient.ts', 3), b('services/research/mod.rs', 5), d('apps/dashboard/src/app/pages/ticker/research/ResearchView.tsx', 51)]]
  ];
  const stack = [
    ['Browser + contracts', 'React · TypeScript · Vite · openapi-fetch', 'React owns the pages; the facade consumes generated OpenAPI types. Pages are lazy-loaded except Landing. Nx coordinates frontend tasks, but its graph does not automatically include the Cargo quant dependency.', [f('app.tsx', 53), a('client.ts', 1), ref('nx.json', 18), ref('Cargo.toml', 3)]],
    ['Server + math', 'Rust · Axum 0.8 · Tokio · Tower · serde · Utoipa', 'AppState composes the modular monolith. Pure quant code is a Cargo workspace member; CPU-heavy analytics uses blocking tasks.', [ref('apps/api/Cargo.toml', 24), b('state.rs', 265), b('services/analytics.rs', 354), q('lib.rs', 1)]],
    ['Startup sequence', 'Host guard → dotenv → config → production validation → bind', 'MARKET_DATA_MODE accepts live or paused and defaults to live. Production requires Postgres support and ready schema/archive roots. Configuration validates before worker launch.', [b('main.rs', 379), b('config.rs', 119), b('config.rs', 216), b('server.rs', 22), b('server.rs', 69)]],
    ['Five market producers', 'Stock stream · Path-A tape capture · warmer · archive ensure · scanner', 'All five start only after successful listener binding and only in live mode. Paused starts none. serve_http_only supports research replay without these producers.', [b('server.rs', 95), b('server.rs', 140)]],
    ['Failure isolation', 'Required chain · optional bars/trades · nullable context · separate stores', 'Optional analytics inputs degrade their own outputs; chain remains required. Redis can fall back to memory. Browser positions and orders preserve independent read-fault latches.', [b('services/analytics.rs', 258), q('context_pack.rs', 1), b('infrastructure/redis/price_cache.rs', 16), f('features/trading/orders/store.ts', 19), f('features/trading/positions/store.ts', 235)]],
    ['Observability truth', 'HTTP tracing · phase logs · cache/capacity probes · archive telemetry', 'Source includes vendor/compute phase milliseconds, but /api/_metrics declares instrumentation disabled and returns empty recent_traces. This atlas contains no captured latency or throughput results.', [b('server.rs', 297), b('services/analytics.rs', 306), b('state.rs', 351), b('routes/health.rs', 649)]],
    ['Build + release', 'Nx · production Vite · Brotli budgets · Cloudflare Pages', 'Mode, Node, ANALYZE and helper inputs participate in the production build identity. Demo and live use the same production optimization and require separate builds. The checker measures Brotli; the demo full initial boot closure is larger than the recorded live baseline, so a smaller entry chunk is not a performance win.', [ref('apps/dashboard/vite.config.mts', 45), ref('apps/dashboard/package.json', 11), ref('tools/check-dashboard-bundle.mjs', 41), ref('nx.json', 74), d('tools/build-dashboard.mjs', 1)]],
    ['Verification boundaries', 'Local builds and tests · browser journey · independent QA · hosted check', 'Final joined local checks passed: dashboard 262 files / 3,150 tests, API 8 files / 59 tests, typecheck and generated contract, format, and lint across three projects (advisory warnings). Earlier production G1 passed in 54.159 s with zero egress; the MSFT 60-source probe passed. Live Chromium passed 128/128; compatibility passed 15/15. Accessibility executed and passed 35/35, with seven unwaived moderate findings (five missing-H1 ticker findings, two Positions heading-order findings). Six Windows LIVE references were accepted at source 4c4fb35814a79de16f0d069f34a4f4d7b7797cd5; two compare-only runs passed 6/6 with native exit 0. That acceptance excludes later changes, DEMO and Linux. Independent QA passed Reset Demo contrast and new-route heading repairs, then found additional light-theme link/button/EMA20 contrast failures; textAmber now styles those controls and legend, and ready/loading/error branches have H1 headings. Hosted QA now records 19 PASS / 1 FAIL: AC18 failed because the deployed inline bootstrap was blocked by the existing same-origin script policy, leaving the preview blank. A same-origin external bootstrap repair is built; independent local G1 passed 1/1 with native exit 0 in 46.7 s (45.9 s test time), zero egress, on the CSP-aware server. Hosted redeployment and verification remain pending. Before the CSP repair, independent G1 passed 1/1 with native exit 0 in 52.0 s. Before the CSP repair, all 16 settled Technical analysis/Research scans across ready, unsupported, cold-error and held-loading states in dark/light passed with zero axe violations and one H1 each. Hosted verification failed at landing before route checks. Exact-revision CI, Linux visual results and repaired-preview verification remain pending. Local receipts retain their own source/artifact scope, not a deployed hash.', [d('tools/build-dashboard.spec.mjs', 1), d('apps/dashboard-e2e/src/demo/demo-journey.spec.ts', 1)]]
  ];
  const modes = {
    demo: ['IMPLEMENTED BROWSER-LOCAL DEMO · hosted repair pending', [['Build mode', 'demo | live selected before Nx'], ['Local facade + one clock', 'Authored scenario + isolated portfolio/orders'], ['Six-symbol scanner', 'Local stream + exact selected export'], ['Ticker: Overview', 'Existing ticker surface'], ['Ticker: Technical analysis', 'Lazy local-bar view'], ['Ticker: Research', 'Lazy authored-case view; operator research separate']], 'The wrapper validates VITE_DATA_MODE before Nx; unset defaults to live except the configured Pages feature branch. Mode participates in the build identity and changing it requires a rebuild. Demo selects the local HTTP facade, bounded sample stream, fixed scenario clock and convexa.demo.v1.* storage namespace together. The catalog covers six symbols and seven curated nonempty expiry selections. Scanner, paper book, orders and preferences use local browser state. Final joined widget coverage spans all six symbols and seven selections; technical analysis and six distinct Research cases remain separate lazy ticker views. Sample-tape figures are observed in the final G1 flow with app-local standing and live=false. Export provenance follows the selected variant fingerprint.', 'Earlier local production G1 passed in 54.159 s with zero egress; the MSFT 60-source probe passed. Dashboard passed 262 files / 3,150 tests and API 8 files / 59 tests; typecheck, generated contract, format, and lint exited 0 (lint advisory warnings). Live Chromium passed 128/128 and compatibility 15/15. Accessibility passed execution 35/35 with seven unwaived moderate findings, not zero findings. Six Windows LIVE references were accepted at source 4c4fb35814a79de16f0d069f34a4f4d7b7797cd5; two compare-only runs passed 6/6 with native exit 0. This excludes later changes, DEMO and Linux. Independent QA passed Reset Demo contrast and new-route heading repairs, then found additional light-theme link/button/EMA20 contrast failures; textAmber now styles those controls and legend, and ready/loading/error branches have H1 headings. Hosted QA now records 19 PASS / 1 FAIL: AC18 failed because the deployed inline bootstrap was blocked by the existing same-origin script policy, leaving the preview blank. A same-origin external bootstrap repair is built; independent local G1 passed 1/1 with native exit 0 in 46.7 s (45.9 s test time), zero egress, on the CSP-aware server. Hosted redeployment and verification remain pending. Before the CSP repair, independent G1 passed 1/1 with native exit 0 in 52.0 s. Before the CSP repair, all 16 settled Technical analysis/Research scans across ready, unsupported, cold-error and held-loading states in dark/light passed with zero axe violations and one H1 each. Hosted verification failed at landing before route checks. Exact-revision CI, Linux visual results and repaired-preview verification remain pending. These local receipts do not identify a deployed hash. Synthetic values are authored samples, never genuine-live observations or Rust responses.', [d('tools/build-dashboard.mjs', 1), d('tools/write-dashboard-routes.mjs', 1), d('libs/api/src/lib/demo/mode.ts', 1), d('libs/api/src/lib/demo/transport.ts', 1), d('libs/api/src/lib/demo/workspace.ts', 188), d('libs/api/src/lib/demo/streams.ts', 26), d('apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisView.tsx', 39), d('apps/dashboard/src/app/pages/ticker/research/ResearchView.tsx', 51)]],
    live: ['EXISTING SOURCE PATH · deployment not measured here', [['Frontend HTTP + SSE', 'Real session and request lifecycle'], ['Pages → Rust API', 'Typed routes + AppState'], ['Vendors + durable stores', 'Configured credentials required']], 'The existing live application uses same-origin HTTP and SSE, with separate provider and persistence boundaries. Backend MARKET_DATA_MODE defaults to live. DATA_FEED realtime/delayed is a separate choice.', 'Live mode remains the default when VITE_DATA_MODE is unset. The static artifact routes /api to Functions; this local source and mode receipt do not establish hosted availability.', [ref('functions/api/[[path]].ts', 81), b('config.rs', 119), b('config.rs', 216), b('services/llm.rs', 234), b('services/broker/service.rs', 102)]],
    paused: ['IMPLEMENTED BACKEND MODE · not a populated demo', [['MARKET_DATA_MODE=paused', 'Backend configuration'], ['HTTP application', 'No five market producers'], ['Market reads refused', 'No synthetic fallback']], 'Paused mode stops the stock-stream worker, tape capture, warmer, session-archive ensure worker and scanner. Demand paths refuse market acquisition instead of contacting the vendor.', 'Paused is useful for stopping market-data work. It neither seeds every widget nor switches browser persistence, OAuth, broker credentials or explanation providers into a public demo.', [b('server.rs', 95), b('config.rs', 119), ref('apps/api/tests/market_data_paused_no_vendor_contact.rs', 48)]]
  };
  function renderNode(key) {
    if (!Object.hasOwn(nodes, key)) return;
    const [title, intro, points, refs] = nodes[key];
    byId('node-detail').replaceChildren(element('p', 'Responsibility + boundary', 'eyebrow'), element('h3', title), element('p', intro), list(points), sources(refs));
    document.querySelectorAll('[data-node]').forEach(button => { const selected = button.dataset.node === key; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  }
  let traceIndex = 0, stepIndex = 0;
  function renderTrace() {
    const [title, note, steps] = traces[traceIndex];
    const map = byId('trace-map');
    map.replaceChildren();
    steps.forEach(([name], index) => {
      const button = element('button', undefined, `trace-step${index === stepIndex ? ' active' : ''}`);
      button.type = 'button'; button.dataset.step = String(index); button.setAttribute('aria-pressed', String(index === stepIndex));
      if (index === stepIndex) button.setAttribute('aria-current', 'step');
      button.append(element('span', `STEP ${index + 1}`), document.createTextNode(name)); map.append(button);
    });
    const [name, body, refs] = steps[stepIndex];
    byId('trace-detail').replaceChildren(element('p', `${title} · step ${stepIndex + 1} of ${steps.length}`, 'flow-label'), element('h3', name), element('p', body), element('p', note, 'measure'), sources(refs));
    byId('trace-prev').disabled = stepIndex === 0; byId('trace-next').disabled = stepIndex === steps.length - 1;
  }
  function renderTable(key) {
    if (!Object.hasOwn(tables, key)) return;
    const [caption, first, second, third, rows] = tables[key];
    const wrap = element('div', undefined, 'data-table-wrap'), table = element('table', undefined, 'data-table');
    table.append(element('caption', caption));
    const head = element('thead'), headings = element('tr'), body = element('tbody');
    [first, second, third, 'Source'].forEach(label => { const th = element('th', label); th.scope = 'col'; headings.append(th); });
    head.append(headings);
    rows.forEach(([name, input, behavior, refs]) => { const row = element('tr'), source = element('td'); source.append(sources(refs)); row.append(element('td', name), element('td', input), element('td', behavior), source); body.append(row); });
    table.append(head, body); wrap.append(table); byId('data-content').replaceChildren(wrap);
  }
  function flow(stops, className, stopClass, arrowClass) {
    const row = element('div', undefined, className);
    stops.forEach((stop, index) => {
      if (index) { const arrow = element('span', '→', arrowClass); arrow.setAttribute('aria-hidden', 'true'); row.append(arrow); }
      const box = element('div', Array.isArray(stop) ? stop[0] : stop, stopClass);
      if (Array.isArray(stop)) box.append(element('small', stop[1]));
      row.append(box);
    });
    return row;
  }
  function renderJourneys() {
    byId('journey-content').replaceChildren(...journeys.map(([title, stops, outcome, refs]) => {
      const article = element('article', undefined, 'journey');
      article.append(element('h3', title), flow(stops, 'journey-flow', 'stop', 'arrow'), element('p', outcome, 'outcome'), sources(refs)); return article;
    }));
  }
  function renderStack() {
    const grid = element('div', undefined, 'stack-grid');
    stack.forEach(([title, tools, body, refs]) => { const article = element('article', undefined, 'stack-item'); article.append(element('h3', title), element('p', tools, 'tools'), element('p', body), sources(refs)); grid.append(article); });
    byId('stack-content').replaceChildren(grid);
  }
  function renderMode(key) {
    if (!Object.hasOwn(modes, key)) return;
    const [label, stops, summary, boundary, refs] = modes[key];
    byId('mode-flow').replaceChildren(...flow(stops, 'mode-flow', 'mode-box', 'mode-arrow').childNodes);
    byId('mode-detail').replaceChildren(element('p', label, 'flow-label'), element('p', summary), element('p', boundary), sources(refs));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === key)));
  }
  function showView(key) {
    const section = byId(key);
    if (!section?.classList.contains('view')) return;
    document.querySelectorAll('.view').forEach(view => { view.hidden = view !== section; });
    document.querySelectorAll('[data-view]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.view === key)); button.setAttribute('aria-controls', button.dataset.view); });
  }
  const controller = new AbortController();
  const on = (target, name, callback) => target.addEventListener(name, callback, { signal: controller.signal });
  on(document, 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.node) renderNode(button.dataset.node);
    else if (button.dataset.view) showView(button.dataset.view);
    else if (button.dataset.mode) renderMode(button.dataset.mode);
    else if (button.dataset.step !== undefined) { stepIndex = Number(button.dataset.step); renderTrace(); byId('trace-map').children[stepIndex].focus(); }
  });
  on(byId('trace-select'), 'change', event => { traceIndex = Number(event.target.value); stepIndex = 0; renderTrace(); });
  on(byId('trace-prev'), 'click', () => { if (stepIndex > 0) { stepIndex--; renderTrace(); } });
  on(byId('trace-next'), 'click', () => { if (stepIndex < traces[traceIndex][2].length - 1) { stepIndex++; renderTrace(); } });
  on(byId('data-select'), 'change', event => renderTable(event.target.value));
  on(byId('theme'), 'click', () => {
    const light = document.documentElement.dataset.scheme !== 'light';
    document.documentElement.dataset.scheme = light ? 'light' : 'dark';
    byId('theme').textContent = light ? 'Dark scheme' : 'Light scheme';
    byId('theme').setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} color scheme`);
  });
  // Keep listeners when restored from the browser's back/forward cache.
  window.addEventListener('pagehide', event => { if (!event.persisted) controller.abort(); }, { once: true });
  traces.forEach(([name], index) => { const option = element('option', name); option.value = String(index); byId('trace-select').append(option); });
  renderNode('analytics'); renderTrace(); renderTable('widgets'); renderJourneys(); renderStack(); renderMode('demo'); showView('system');
})();
