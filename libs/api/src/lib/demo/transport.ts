import { loadScenario, effectiveExpiries, EXPIRIES, SYMBOLS, sampleContractMark } from './catalog';
import { dataMode } from './mode';
import { demoStorageKey } from './mode';
import type { TickerBundle, ScanResponse, ScanView, AiProvidersBootstrap, BookEnvelope, StructureHistoryResponse } from '../convexa';
import type { components } from '../convexa';
import type { BrokerBook } from '../broker';
import { canSimulatePaperAction, initializeDemoWorkspace } from './workspace';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refused = (code: 'demo_unsupported' | 'demo_unavailable', detail: string, status = code === 'demo_unsupported' ? 422 : 501) => json({ code, detail }, status);
const DEMO_TIME = '2026-10-07T18:30:00Z';
const stamp = Date.parse(DEMO_TIME);
type CandidateSetWire = components['schemas']['CandidatesWire'];
type RecommendationWire = components['schemas']['RecommendationBody'];
type PersonaWire = components['schemas']['PersonaWire'];
type AuthResponseWire = components['schemas']['AuthResponseBody'];
type AuthSettingsWire = components['schemas']['AuthSettingsBody'];
type DemoPosition = { id: string; schema_version?: number; legs?: { id: string; ticker: string; expiration?: string | null; strike?: number | null; right?: string | null; qty: number; status?: string }[]; status?: string; [key: string]: unknown };
const writeFaults = new Set<string>();

function isObject(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isStringRecord(value: unknown): value is Record<string, unknown> { return isObject(value); }
function isBookBlob(value: unknown): value is BookEnvelope['blob'] {
  if (!isObject(value) || value.schema_version !== 1 || !Array.isArray(value.positions) || !Array.isArray(value.orders) || !Array.isArray(value.decisions)) return false;
  return value.positions.every((row) => isObject(row) && typeof row.id === 'string' && typeof row.ticker === 'string' && typeof row.expiration === 'string' && typeof row.strike === 'number' && typeof row.right === 'string' && typeof row.qty === 'number' && typeof row.status === 'string')
    && value.orders.every((row) => isObject(row) && typeof row.id === 'string' && typeof row.ticker === 'string' && typeof row.status === 'string')
    && value.decisions.every((row) => isObject(row) && typeof row.id === 'string' && typeof row.decision === 'string');
}
function validStoredValue(key: string, value: unknown): boolean {
  if (!isObject(value)) return false;
  switch (key) {
    case 'convexa.positions.v3': return value.schema_version === 3 && isStringRecord(value.positions) && Array.isArray(value.decisions) && isObject(value.customization);
    case 'convexa.orders.v1': return value.schema_version === 1 && isStringRecord(value.orders);
    case 'convexa.uiprefs.v1': return value.schema_version === 1 && (value.theme === 'dark' || value.theme === 'light') && typeof value.default_ticker === 'string';
    case 'convexa.demo.auth.settings.v1': return (value.theme === 'dark' || value.theme === 'light') && typeof value.default_ticker === 'string' && (typeof value.active_persona_id === 'string' || value.active_persona_id === null) && isObject(value.risk_inputs);
    case 'convexa.demo.scan.view.v1': return typeof value.authenticated === 'boolean' && (value.density === 'compact' || value.density === 'comfortable') && isObject(value.sort) && typeof value.source === 'string' && Array.isArray(value.symbols) && value.symbols.every((symbol) => typeof symbol === 'string');
    case 'convexa.demo.book.v1': return isBookBlob(value);
    default: return true;
  }
}

function readStored(key: string): unknown | undefined {
  const resolved = demoStorageKey(key);
  try {
    const raw = window.localStorage.getItem(resolved);
    if (raw === null) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!validStoredValue(key, value)) throw new Error(`Invalid stored demo value: ${key}`);
    return value;
  } catch (error) {
    writeFaults.add(resolved);
    throw error;
  }
}

function writeStored(key: string, value: unknown): void {
  const resolved = demoStorageKey(key);
  if (writeFaults.has(resolved)) throw new Error(`Writes disabled for unreadable demo store: ${key}`);
  if (!validStoredValue(key, value)) { writeFaults.add(resolved); throw new Error(`Invalid demo value refused: ${key}`); }
  try { window.localStorage.setItem(resolved, JSON.stringify(value)); }
  catch (error) { writeFaults.add(resolved); throw error; }
}

function readTouchSeconds(): number | undefined {
  const key = 'convexa.positions.touch_at';
  const resolved = demoStorageKey(key);
  try {
    const raw = window.localStorage.getItem(resolved);
    if (raw === null) return undefined;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid demo position touch timestamp');
    return seconds;
  } catch (error) { writeFaults.add(resolved); throw error; }
}

function writeTouchSeconds(seconds: number): void {
  const key = 'convexa.positions.touch_at';
  const resolved = demoStorageKey(key);
  if (writeFaults.has(resolved)) throw new Error('Writes disabled for unreadable demo touch timestamp');
  try { window.localStorage.setItem(resolved, String(seconds)); }
  catch (error) { writeFaults.add(resolved); throw error; }
}

function readRecord(key: string): Record<string, unknown> {
  const value = readStored(key);
  return value ? value as Record<string, unknown> : {};
}

function projectLocalBook(): BookEnvelope['blob'] {
  const portfolio = readRecord('convexa.positions.v3');
  const ordersStore = readRecord('convexa.orders.v1');
  const positionsById = portfolio.positions && typeof portfolio.positions === 'object' ? portfolio.positions as Record<string, DemoPosition> : {};
  const ordersById = ordersStore.orders && typeof ordersStore.orders === 'object' ? ordersStore.orders as Record<string, Record<string, unknown>> : {};
  const positions: BookEnvelope['blob']['positions'] = Object.values(positionsById).flatMap((position) => {
    const leg = position.legs?.[0];
    if (!leg || leg.expiration == null || leg.strike == null || leg.right == null) return [];
    return [{ id: position.id, ticker: leg.ticker, expiration: leg.expiration, strike: leg.strike, right: leg.right, qty: leg.qty, status: String(position.status ?? 'open') }];
  });
  const orders: BookEnvelope['blob']['orders'] = Object.values(ordersById).map((order) => ({ id: String(order.id), ticker: String(order.ticker), status: String(order.status) }));
  const decisions: BookEnvelope['blob']['decisions'] = Array.isArray(portfolio.decisions)
    ? portfolio.decisions.flatMap((decision) => {
      if (!decision || typeof decision !== 'object') return [];
      const item = decision as Record<string, unknown>;
      const contract = item.contract && typeof item.contract === 'object' ? item.contract as Record<string, unknown> : {};
      return [{ id: String(item.id ?? item.trade_id), ticker: typeof contract.ticker === 'string' ? contract.ticker : null, decision: String(item.event_type ?? 'sample') }];
    }) : [];
  const storedProjection = readStored('convexa.demo.book.v1');
  if (storedProjection) {
    const overlay = storedProjection as BookEnvelope['blob'];
    const ids = new Set(decisions.map((row) => row.id));
    decisions.push(...overlay.decisions.filter((row) => !ids.has(row.id)));
  }
  return { schema_version: 1, positions, orders, decisions };
}

function mergeBookPut(blob: BookEnvelope['blob'], updatedAt: number): void {
  const portfolio = readRecord('convexa.positions.v3');
  const orderStore = readRecord('convexa.orders.v1');
  const priorOverlay = readStored('convexa.demo.book.v1');
  readTouchSeconds();
  const positions = portfolio.positions && typeof portfolio.positions === 'object' ? { ...(portfolio.positions as Record<string, DemoPosition>) } : {};
  for (const item of blob.positions) {
    const prior = positions[item.id];
    const legs = prior?.legs ? [...prior.legs] : [{ id: `${item.id}-leg-1`, ticker: item.ticker, expiration: item.expiration, strike: item.strike, right: item.right, qty: item.qty, status: item.status }];
    const first = legs[0];
    legs[0] = { ...first, ticker: item.ticker, expiration: item.expiration, strike: item.strike, right: item.right, qty: item.qty };
    positions[item.id] = { ...prior, id: item.id, schema_version: prior?.schema_version ?? 3, status: item.status, legs };
  }
  const decisions = Array.isArray(portfolio.decisions) ? [...portfolio.decisions] as Record<string, unknown>[] : [];
  const existingDecisionIds = new Set(decisions.map((decision) => decision.id));
  const overlayDecisions = blob.decisions.filter((decision) => !existingDecisionIds.has(decision.id));
  const orders = orderStore.orders && typeof orderStore.orders === 'object' ? { ...(orderStore.orders as Record<string, Record<string, unknown>>) } : {};
  for (const item of blob.orders) orders[item.id] = { ...orders[item.id], id: item.id, ticker: item.ticker, status: item.status };
  const nextPortfolio = { ...portfolio, schema_version: 3, positions, decisions };
  const nextOrders = { ...orderStore, schema_version: 1, orders };
  const savedOverlay = priorOverlay ? priorOverlay as BookEnvelope['blob'] : { schema_version: 1 as const, positions: [], orders: [], decisions: [] };
  const byId = new Map(savedOverlay.decisions.map((decision) => [decision.id, decision]));
  for (const decision of overlayDecisions) byId.set(decision.id, decision);
  const nextOverlay = { ...blob, decisions: [...byId.values()] };
  if (!validStoredValue('convexa.positions.v3', nextPortfolio) || !validStoredValue('convexa.orders.v1', nextOrders) || !validStoredValue('convexa.demo.book.v1', nextOverlay)) throw new Error('Generated book projection failed local store validation');
  try {
    writeStored('convexa.positions.v3', nextPortfolio);
    writeTouchSeconds(updatedAt);
    writeStored('convexa.orders.v1', nextOrders);
    writeStored('convexa.demo.book.v1', nextOverlay);
  } catch (error) {
    for (const key of ['convexa.positions.v3', 'convexa.positions.touch_at', 'convexa.orders.v1', 'convexa.demo.book.v1']) writeFaults.add(demoStorageKey(key));
    throw error;
  }
}

function riskInputs(accountSize: number | null = null, cap: { unit: string; value: number } | null = null): AuthSettingsWire['risk_inputs'] {
  const value = cap && Number.isFinite(cap.value) && cap.value > 0
    ? cap.unit === 'percent' && accountSize != null ? accountSize * cap.value / 100 : cap.unit === 'usd' ? cap.value : null
    : null;
  return {
    state: accountSize != null || cap != null ? 'set' : 'not_set', storage_available: true,
    account_size: accountSize, per_trade_cap: cap,
    effective_dollar_cap: {
      state: value == null ? 'not_derivable' : 'derived',
      ...(value == null ? { not_derivable_reason: 'sample_input_incomplete' } : { value }),
      derived_from: { account_size: accountSize, cap_unit: cap?.unit ?? null, cap_value: cap?.value ?? null },
    }, updated_at: stamp / 1000,
  };
}

function readDemoSettings(): AuthSettingsWire {
  const saved = readStored('convexa.demo.auth.settings.v1');
  const prefs = (readStored('convexa.uiprefs.v1') ?? {}) as { theme?: string; default_ticker?: string };
  if (saved) return saved as AuthSettingsWire;
  return { theme: prefs.theme ?? 'dark', default_ticker: prefs.default_ticker ?? 'SPY', active_persona_id: 'demo-careful-reader', risk_inputs: riskInputs() };
}

function readScanView(): ScanView {
  return (readStored('convexa.demo.scan.view.v1') ?? { authenticated: true, density: 'comfortable', sort: { key: 'score', dir: 'desc' }, source: 'demo_local', symbols: SYMBOLS }) as ScanView;
}

function candidateSet(symbol: string, scenario: NonNullable<Awaited<ReturnType<typeof loadScenario>>>): CandidateSetWire {
  return {
    ticker: symbol, state: 'unavailable', as_of: DEMO_TIME, anchor_basis: 'gex_spot', anchor_spot: scenario.bars.at(-1)!.close,
    session_basis: 'regular', snapshot_age_seconds: 0, quote_age: 'not_available', band_pct: 10, budget: 'handoff',
    caps: { max_bytes: 0, max_records: 0, rights: 2, strikes_per_tenor_right: 0, tenors: 3 },
    contracts: [], included: { contracts: 0, expiration_count: 0, expirations: [] },
    omitted: { total: 0, expirations_omitted_by_cap: 0, by_reason: { expiration_cap: 0, no_interest: 0, outside_band: 0, outside_window: 0, strike_cap: 0 } },
    liquidity: { atm_relative_spread_band: 'unknown', no_two_sided_quote: 0, quoted: 0, wide_quote_threshold_pct: 15, wide_quotes: false },
    sent_to_model: false,
  };
}

function scoreDrivers(total: number) {
  return { total, proximity: 18, setups: 12, vol: total - 35, transition: 5, dark_pool: 0 };
}

function recommendation(symbol: string, variant: NonNullable<Awaited<ReturnType<typeof loadScenario>>>['variants'][string]): RecommendationWire {
  return {
    status: 'produced', ticker: symbol, as_of: DEMO_TIME, persona: { id: 'sample-reviewer', name: 'Sample reviewer' },
    gate: { state: 'gated_off', cooldown_remaining_seconds: 0, reasons: ['This authored sample does not invoke an AI provider.'] },
    cap: { over_limit: false, remaining_today: 0, resets_at: DEMO_TIME },
    availability: { in_app_enabled: false }, key_source: 'none', unavailable_reason: 'sample_only_no_provider',
    scenario: { id: 'portfolio-2026-10-07-v1', name: 'Authored structure example' },
    strategy: {
      bias: 'neutral', confidence: 'low', decision: 'no_trade', exit_plan: { target: null, stop: null }, strikes: [],
      structure: variant.setup, summary: 'Authored sample analysis; not a model recommendation.',
      rationale: `Synthetic ${symbol} structure has ${variant.setup.toLowerCase()} with authored score ${variant.score}. This is scenario copy, not a forecast or executable instruction.`,
      key_points: [`Variant fingerprint: ${variant.fingerprint}.`, 'No live market, broker, or AI provider was used.'],
      reengage_when: ['Review when the selected authored expiry set changes.'],
    }, pinned_fingerprint: variant.fingerprint, stale_born: false,
  };
}
const supportedPath = (method: string, pathname: string): boolean => {
  const routes: [string, RegExp][] = [
    ['GET', /^\/api\/auth\/session$/], ['POST', /^\/api\/auth\/(signup|login|logout)$/], ['PUT', /^\/api\/auth\/settings$/],
    ['POST', /^\/api\/positions\/sim-trade\/gate$/], ['GET', /^\/api\/scan(?:\/universe|\/view)?$/], ['PUT', /^\/api\/scan\/view$/],
    ['GET', /^\/api\/scan\/[A-Z]+\/history$/], ['GET', /^\/api\/ticker\/[A-Z]+$/], ['GET', /^\/api\/contract\/[A-Z]+$/],
    ['GET', /^\/api\/candidates\/[A-Z]+$/], ['GET', /^\/api\/_metrics$/], ['GET', /^\/api\/auth\/ai-key$/],
    ['PUT', /^\/api\/auth\/ai-key$/], ['DELETE', /^\/api\/auth\/ai-key$/], ['DELETE', /^\/api\/auth\/grok$/],
    ['GET', /^\/api\/book$/], ['PUT', /^\/api\/book$/], ['POST', /^\/api\/recommendation\/[A-Z]+$/],
    ['GET', /^\/api\/recommendation\/(status|export)\/[A-Z]+$/], ['GET', /^\/api\/personas$/],
    ['GET', /^\/api\/broker\/credential$/], ['PUT', /^\/api\/broker\/credential$/], ['DELETE', /^\/api\/broker\/credential$/],
    ['GET', /^\/api\/broker\/book$/], ['POST', /^\/api\/broker\/book\/refresh$/],
  ];
  return routes.some(([verb, pattern]) => verb === method && pattern.test(pathname));
};

function tickerPayload(scenario: Awaited<ReturnType<typeof loadScenario>> & {}, key: string, expirations: string[]) {
  const variant = scenario.variants[key];
  const spot = scenario.bars.at(-1)!.close;
  const strikes = Array.from({ length: 11 }, (_, i) => {
    const strike = Number((Math.floor(spot / 5) * 5 - 25 + i * 5).toFixed(2));
    const callGex = Number((100_000_000 - Math.abs(strike - variant.wall) * 1_500_000).toFixed(2));
    const putGex = Number((-80_000_000 + Math.abs(strike - variant.flip) * 1_000_000).toFixed(2));
    return { strike, net_gex: callGex + putGex, call_gex: callGex, put_gex: putGex, call_oi: 20_000 + i * 101, put_oi: 18_000 + i * 89, total_oi: 38_000 + i * 190, net_dex: 1_000_000, call_dex: 2_000_000, put_dex: -1_000_000, volume: 3_500 + i * 41, vol_oi_ratio: 0.18 + i * 0.01 };
  });
  const callGex = strikes.reduce((sum, strike) => sum + strike.call_gex, 0);
  const putGex = strikes.reduce((sum, strike) => sum + strike.put_gex, 0);
  const callDex = strikes.reduce((sum, strike) => sum + (strike.call_dex ?? 0), 0);
  const putDex = strikes.reduce((sum, strike) => sum + (strike.put_dex ?? 0), 0);
  const netGex = callGex + putGex;
  const netDex = callDex + putDex;
  const fullExpirations = EXPIRIES.map((date, i) => ({ date, dte: [2, 9, 44][i] }));
  const state: TickerBundle['market_state'] = {
    ticker: scenario.symbol, price: spot, gex_spot: spot, timestamp: stamp / 1000, timestamp_iso: DEMO_TIME,
    call_wall: variant.wall, put_wall: Number((variant.wall - spot * 0.075).toFixed(2)), peak_gex_strike: Number((Math.round(variant.wall / 5) * 5).toFixed(2)), gamma_flip: variant.flip,
    max_pain: spot, max_pain_expiration: '2026-10-16', net_gex: netGex, call_gex: callGex, put_gex: putGex, total_gex: netGex,
    net_dex: netDex, call_dex: callDex, put_dex: putDex, net_vanna: null, net_charm: null, net_volga: null,
    vwap: Number((spot - 1.25).toFixed(2)), vwap_upper_2: null, vwap_upper_3: null, vwap_lower_2: null, vwap_lower_3: null,
    dte_min: Math.min(...expirations.map((d) => d === EXPIRIES[0] ? 2 : d === EXPIRIES[1] ? 9 : 44)),
    dte_max: Math.max(...expirations.map((d) => d === EXPIRIES[0] ? 2 : d === EXPIRIES[1] ? 9 : 44)),
    atm_iv: 26, hv_30d: 23, iv_hv_ratio: 1.13, net_flow: null, put_call_ratio: 0.91, chain_vol_oi_ratio: 0.38,
    total_volume: 126_400, vol_oi_unusual_threshold: 1, iv_skew: null, term_structure: null, dealer_flow_projection: null,
    market_context: null, iv_rank: null, vol_normalized_gex: null,
    straddle_move: { state: 'no_quote', as_of: DEMO_TIME, session_basis: 'regular', anchor_basis: 'gex_spot', anchor_label: 'gex_spot', anchor_spot: spot, primary_expiration: null, wide_quote_threshold_pct: 15, tenors: [] },
  };
  const signals: TickerBundle['signals'] = {
    ticker: scenario.symbol, regime: 'positive_gamma', regime_note: 'Authored synthetic structure snapshot.', vol_regime: 'neutral',
    distances: { call_wall_pct: Number(((variant.wall - spot) / spot).toFixed(4)), gamma_flip_pct: variant.distance },
    setups: [{ name: variant.setup, bias: 'neutral', conviction: 'moderate', strategy: 'observe', rationale: 'Authored scenario variant.' }],
    opportunity_score: variant.score, opportunity_tier: variant.score >= 65 ? 'actionable' : 'watch', prime_prompt_eligible: false,
    score_drivers: scoreDrivers(variant.score), dark_pool_confluence: null,
  };
  const bundle: TickerBundle = {
    market_state: state, signals, state_fingerprint: variant.fingerprint,
    strike_profile: { ticker: scenario.symbol, spot, strikes },
    expirations: expirations.map((date) => fullExpirations.find((e) => e.date === date)!),
    ai_eval: { ready: false, reasons: ['Sample analysis is authored, not generated by an AI provider.'], changed: false, state_fingerprint: variant.fingerprint, score_threshold: 50 },
    meta: { served_at: DEMO_TIME, cache: { hit: true, age_seconds: 0, ttl_seconds: 0 }, freshness: { snapshot_iso: DEMO_TIME, data_age_seconds: 0, stale: false, stale_after_seconds: 0 } },
    off_exchange: { ratio_pct: 0, offex_shares: 0, total_shares: 0, levels: [], blocks: [], block_min_shares: 0, note: 'No live off-exchange feed; scenario context only.' },
    position_eval: null,
  };
  return bundle;
}

export async function demoFetch(request: Request): Promise<Response> {
  if (dataMode !== 'demo') return refused('demo_unavailable', 'Demo transport is not active in this build.');
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname.replace(/\/$/, '');
  if (!supportedPath(method, pathname)) return refused('demo_unavailable', 'This method and path are not part of the local demo contract.');

  const tickerMatch = pathname.match(/^\/api\/(?:ticker|contract|candidates)\/([A-Z]+)$/);
  if (tickerMatch && (pathname.startsWith('/api/ticker/') || pathname.startsWith('/api/contract/') || pathname.startsWith('/api/candidates/'))) {
    const symbol = tickerMatch[1];
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    if (pathname.startsWith('/api/ticker/')) {
      const minDte = url.searchParams.has('min_dte') ? Number(url.searchParams.get('min_dte')) : undefined;
      const maxDte = url.searchParams.has('max_dte') ? Number(url.searchParams.get('max_dte')) : undefined;
      const projection = effectiveExpiries({ minDte, maxDte, expirations: url.searchParams.get('expirations')?.split(',') });
      if (projection.state !== 'ready') return refused('demo_unsupported', projection.detail);
      const requested = url.searchParams.get('dark_pool');
      if (requested === 'false') return refused('demo_unsupported', 'darkPool=false has no curated sample score variant.');
      return json(tickerPayload(scenario, projection.key, projection.dates));
    }
    if (pathname.startsWith('/api/contract/')) {
      const expiration = url.searchParams.get('expiration') ?? '';
      const strike = Number(url.searchParams.get('strike'));
      const right = url.searchParams.get('right');
      const allowedStrike = Math.floor(scenario.bars.at(-1)!.close / 5) * 5 - 25;
      const inChain = (EXPIRIES as readonly string[]).includes(expiration) && Number.isFinite(strike) && strike >= allowedStrike && strike <= allowedStrike + 50 && (right === 'call' || right === 'put');
      if (!inChain) return json({ code: 'demo_unavailable', detail: 'No sample contract exists for the requested contract.' }, 404);
      const dte = expiration === EXPIRIES[0] ? 2 : expiration === EXPIRIES[1] ? 9 : 44;
      const spot = scenario.bars.at(-1)!.close;
      const mid = sampleContractMark(spot, strike, right, dte);
      const contract: components['schemas']['ContractWire'] = { ticker: symbol, expiration, strike, right, dte, iv: 0.27, greeks: { delta: right === 'call' ? 0.52 : -0.48, gamma: 0.018, theta: -0.11, vega: 0.21 }, option_quote: { bid: Number((mid - 0.05).toFixed(2)), ask: Number((mid + 0.05).toFixed(2)), mid } };
      return json(contract);
    }
    const candidates = candidateSet(symbol, scenario);
    return json(candidates);
  }

  if (pathname === '/api/auth/session') {
    try {
      const response: AuthResponseWire = { authenticated: true, google_available: false, user: { id: 'demo-visitor', email: 'visitor@example.invalid', display_name: 'Demo visitor', auth_methods: [] }, settings: readDemoSettings(), demo_seed: { email: 'visitor@example.invalid' } };
      return json(response);
    } catch { return refused('demo_unavailable', 'The local demo settings could not be read.'); }
  }
  if (pathname === '/api/auth/signup' || pathname === '/api/auth/login' || pathname === '/api/auth/logout' || pathname === '/api/auth/grok' || pathname === '/api/auth/ai-key' && method !== 'GET' || pathname === '/api/broker/credential' && method !== 'GET' || pathname === '/api/broker/book/refresh') return refused('demo_unavailable', 'Credentials, sign-in, AI-provider, OAuth, and broker actions are disabled in this local sample.');
  if (pathname === '/api/_metrics') return refused('demo_unavailable', 'Operator metrics are unavailable in the public sample.');
  if (pathname === '/api/auth/settings' && method === 'PUT') {
    try {
      const body = await request.json() as Record<string, unknown>;
      const current = readDemoSettings();
      const rawRisk = body.risk_inputs && typeof body.risk_inputs === 'object' ? body.risk_inputs as Record<string, unknown> : null;
      const rawCap = rawRisk?.per_trade_cap && typeof rawRisk.per_trade_cap === 'object' ? rawRisk.per_trade_cap as Record<string, unknown> : null;
      const accountSize = rawRisk && 'account_size' in rawRisk ? (typeof rawRisk.account_size === 'number' ? rawRisk.account_size : null) : current.risk_inputs.account_size ?? null;
      const cap = rawRisk && 'per_trade_cap' in rawRisk
        ? rawCap && typeof rawCap.value === 'number' && typeof rawCap.unit === 'string' ? { unit: rawCap.unit, value: rawCap.value } : null
        : current.risk_inputs.per_trade_cap ?? null;
      if ((accountSize != null && (!Number.isFinite(accountSize) || accountSize <= 0)) || (cap != null && (!Number.isFinite(cap.value) || cap.value <= 0 || cap.unit === 'percent' && cap.value > 100 || cap.unit !== 'percent' && cap.unit !== 'usd'))) return refused('demo_unsupported', 'Sample risk settings must be positive and use supported units.');
      const next: AuthSettingsWire = {
        theme: typeof body.theme === 'string' ? body.theme : current.theme,
        default_ticker: typeof body.default_ticker === 'string' ? body.default_ticker.toUpperCase() : current.default_ticker,
        active_persona_id: body.active_persona_id === null || typeof body.active_persona_id === 'string' ? body.active_persona_id : current.active_persona_id ?? null,
        risk_inputs: rawRisk ? riskInputs(accountSize, cap) : current.risk_inputs,
      };
      const prefs = { schema_version: 1, theme: next.theme, default_ticker: next.default_ticker };
      try {
        writeStored('convexa.uiprefs.v1', prefs);
        writeStored('convexa.demo.auth.settings.v1', next);
      } catch (error) {
        writeFaults.add(demoStorageKey('convexa.uiprefs.v1'));
        writeFaults.add(demoStorageKey('convexa.demo.auth.settings.v1'));
        throw error;
      }
      return json(next);
    } catch { return refused('demo_unavailable', 'Local demo settings could not be saved.'); }
  }

  if (pathname === '/api/book') {
    if (method === 'GET') {
      let blob: BookEnvelope['blob'];
      let updatedAt = stamp / 1000;
      try {
        initializeDemoWorkspace();
        blob = projectLocalBook();
        updatedAt = readTouchSeconds() ?? updatedAt;
      } catch { return refused('demo_unavailable', 'The local sample book is unreadable.'); }
      const envelope: BookEnvelope = { schema_version: 1, updated_at: updatedAt, source: 'demo_local', blob };
      return json(envelope);
    }
    try {
      const body = await request.json() as { schema_version?: number; updated_at?: number; blob?: BookEnvelope['blob'] };
      const blob = body.blob;
      if (!isBookBlob(blob)) return refused('demo_unsupported', 'The local sample book payload is malformed.');
      const updatedAt = typeof body.updated_at === 'number' && Number.isFinite(body.updated_at) ? body.updated_at : stamp / 1000;
      initializeDemoWorkspace();
      mergeBookPut(blob, updatedAt);
      const envelope: BookEnvelope = { schema_version: 1, updated_at: updatedAt, source: 'demo_local', blob: projectLocalBook() };
      return json(envelope);
    }
    catch { return refused('demo_unavailable', 'The local sample book could not be saved.'); }
  }
  if (pathname === '/api/scan/view' && method === 'PUT') {
    try { readScanView(); const body = await request.json() as Record<string, unknown>; const symbols = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === 'string' && SYMBOLS.includes(s as typeof SYMBOLS[number])) : SYMBOLS; const view = { authenticated: true, density: body.density === 'compact' ? 'compact' : 'comfortable', name: typeof body.name === 'string' ? body.name : null, sort: body.sort ?? { key: 'score', dir: 'desc' }, source: 'demo_local', symbols }; writeStored('convexa.demo.scan.view.v1', view); return json(view); }
    catch { return refused('demo_unavailable', 'The local sample view could not be saved.'); }
  }
  if (pathname === '/api/scan' || pathname === '/api/scan/view' || pathname === '/api/scan/universe') {
    const rows: ScanResponse['rows'] = await Promise.all(SYMBOLS.map(async (symbol) => {
      const sample = await loadScenario(symbol);
      const price = sample!.bars.at(-1)!.close;
      const variant = sample!.variants[EXPIRIES.join(',')];
      const putWall = Number((variant.wall - price * 0.075).toFixed(2));
      const nearerWall = Math.abs(price - variant.wall) <= Math.abs(price - putWall) ? variant.wall : putWall;
      return { symbol, status: 'ready', price, as_of: stamp / 1000, chg_pct: 0.42, call_wall: variant.wall, put_wall: putWall, flip: variant.flip, dist_to_flip_pct: Number(((price - variant.flip) / price * 100).toFixed(2)), dist_to_wall_pct: Number(((price - nearerWall) / price * 100).toFixed(2)), regime: 'positive_gamma', score: variant.score, tier: variant.score > 60 ? 'actionable' : 'watch', vol_regime: 'neutral', score_drivers: scoreDrivers(variant.score) };
    }));
    let view: ScanView;
    try { view = readScanView(); }
    catch { return refused('demo_unavailable', 'The local sample view is unreadable.'); }
    if (pathname === '/api/scan/universe') return json({ symbols: SYMBOLS, universe_size: SYMBOLS.length, source: 'demo_local' });
    if (pathname === '/api/scan/view') return json(view);
    const response: ScanResponse = { market_data: 'sample', rows: rows.filter((row) => view.symbols.includes(row.symbol)), sweep: null, view };
    return json(response);
  }
  if (pathname.endsWith('/history')) {
    const symbol = pathname.split('/')[3];
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    const variant = scenario.variants[EXPIRIES.join(',')];
    const limitValue = Number(url.searchParams.get('limit') ?? 48);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(96, Math.floor(limitValue)) : 48;
    const samples: StructureHistoryResponse['samples'] = scenario.bars.slice(-limit).map((bar) => ({
      symbol, as_of: Date.parse(`${bar.date}T16:00:00Z`) / 1000, price: bar.close, score: variant.score,
      tier: variant.score > 60 ? 'actionable' : 'watch', regime: 'positive_gamma', vol_regime: 'neutral',
      flip: variant.flip, dist_to_flip_pct: Number(((bar.close - variant.flip) / bar.close * 100).toFixed(2)), call_wall: variant.wall,
      put_wall: Number((variant.wall - bar.close * 0.075).toFixed(2)),
      dist_to_wall_pct: (variant.wall - bar.close) / bar.close * 100,
      score_drivers: scoreDrivers(variant.score),
      net_gex: 20_000_000, iv_hv_ratio: 1.13, atm_iv: 26, hv_30d: 23,
    }));
    const history: StructureHistoryResponse = { symbol, samples, basis: 'Authored synthetic daily scenario snapshots; not live or stored history.', stored_count: scenario.bars.length, backend: 'scenario_catalog' };
    return json(history);
  }
  if (pathname === '/api/personas') {
    const personas: PersonaWire[] = [{ id: 'sample-reviewer', name: 'Sample reviewer', version: 1, builtin: true, objective: 'directional_swing', risk: 'moderate', reassessment_lean: 'Reassess only when the authored sample structure changes.', dte_pref: JSON.stringify({ min_dte: 2, max_dte: 44 }) }];
    return json(personas);
  }
  if (pathname === '/api/auth/ai-key') {
    const bootstrap: AiProvidersBootstrap = { storage_available: true, providers: ['anthropic', 'openai', 'xai', 'gemini'].map((provider) => ({ provider: provider as AiProvidersBootstrap['providers'][number]['provider'], set: false, last4: null })), grok: { available: false, connected: false, unavailable_reason: 'subscription_unavailable' }, preference: { power_path: null, provider: null, model: null }, catalog: { providers: [], grok_subscription: { provider: 'xai', models: [] } } };
    return json(bootstrap);
  }
  if (pathname === '/api/broker/credential') return json({ set: false, last4: null, storage_available: true });
  if (pathname === '/api/broker/book') {
    const sample: BrokerBook = { state: 'ok', basis: 'cache', account_ref: 'Demo sample account · synthetic', as_of: DEMO_TIME, positions: [{ broker_position_id: 'demo-broker-aapl-equity', fidelity: 'exact', fidelity_notes: ['Authored sample holding; no brokerage connection.'], legs: [{ kind: 'equity', symbol: 'AAPL', underlying: 'AAPL', quantity: 25, multiplier: 1, cost_basis: { state: 'supplied', value: 240 }, broker_mark: { state: 'supplied', value: 265 } }], unrealized_pl: { state: 'supplied', value: 625 } }] };
    return json(sample);
  }
  if (pathname.startsWith('/api/recommendation/')) {
    const match = pathname.match(/^\/api\/recommendation\/(?:status\/|export\/)?([A-Z]+)$/);
    if (!match) return refused('demo_unavailable', 'The recommendation route is not part of the local sample contract.');
    const symbol = match[1];
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    let minDte: number | undefined;
    let maxDte: number | undefined;
    let requestBody: Record<string, unknown> = {};
    if (method === 'POST') {
      try { requestBody = await request.json() as Record<string, unknown>; }
      catch { return refused('demo_unsupported', 'The authored sample analysis request was malformed.'); }
      minDte = typeof requestBody.dte_min === 'number' ? requestBody.dte_min : undefined;
      maxDte = typeof requestBody.dte_max === 'number' ? requestBody.dte_max : undefined;
    } else {
      minDte = url.searchParams.has('min_dte') ? Number(url.searchParams.get('min_dte')) : undefined;
      maxDte = url.searchParams.has('max_dte') ? Number(url.searchParams.get('max_dte')) : undefined;
    }
    const projection = effectiveExpiries({ minDte, maxDte });
    if (projection.state !== 'ready') return refused('demo_unsupported', projection.detail);
    const variant = scenario.variants[projection.key];
    if (method === 'POST' && typeof requestBody.snapshot_fingerprint === 'string' && requestBody.snapshot_fingerprint !== variant.fingerprint) return refused('demo_unavailable', 'The requested analysis fingerprint does not match this authored expiry projection.');
    const wire = recommendation(symbol, variant);
    if (pathname.startsWith('/api/recommendation/export/')) {
      const sourceId = scenario.research.evidence[0]?.state === 'present' ? scenario.research.evidence[0].sourceIds[0] : 'unavailable';
      const body: RecommendationWire = {
        ...wire,
        egress_note: `Sample analysis only: ${symbol} uses ${variant.setup} with authored score ${variant.score}; fingerprint ${variant.fingerprint}. Source ${sourceId}. No provider or live data was used.`,
        glossary: 'This sample is educational scenario copy. It is not a forecast, recommendation, or provider-generated response.',
        egress_categories: [
          { key: 'context', sent: false }, { key: 'candidates', sent: false }, { key: 'risk_inputs', sent: false },
          { key: 'open_positions', sent: false }, { key: 'persona_prompt', sent: false }, { key: 'glossary', sent: false },
        ],
      };
      return json(body);
    }
    return json(wire);
  }
  if (pathname === '/api/positions/sim-trade/gate') {
    const body: components['schemas']['SimTradeGateBody'] = { authorized: canSimulatePaperAction() };
    return json(body);
  }
  return refused('demo_unavailable', 'This sample capability is unavailable.');
}
