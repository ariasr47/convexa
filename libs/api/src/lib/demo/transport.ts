import type { BrokerBook } from '../broker';
import type {
  AiProvidersBootstrap,
  BookEnvelope,
  ScanResponse,
  ScanView,
  StructureHistoryResponse,
  TickerBundle,
  components,
} from '../convexa';
import {
  DTE,
  EXPIRIES,
  SYMBOLS,
  effectiveExpiries,
  loadScenario,
  sampleContractQuote,
} from './catalog';
import { callDelta, flowSeed } from './flowSeed';
import { computeIndicators } from './indicators';
import { DEMO_ACCOUNT, dataMode, demoStorageKey } from './mode';
import { demoPublicData } from './public-data';
import { canSimulatePaperAction, initializeDemoWorkspace } from './workspace';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refused = (
  code: 'demo_unsupported' | 'demo_unavailable',
  detail: string,
  status = code === 'demo_unsupported' ? 422 : 501,
) => json({ code, detail }, status);
const DEMO_TIME = '2026-10-07T18:30:00Z';
const stamp = Date.parse(DEMO_TIME);
type CandidateSetWire = components['schemas']['CandidatesWire'];
type RecommendationWire = components['schemas']['RecommendationBody'];
type PersonaWire = components['schemas']['PersonaWire'];
type AuthResponseWire = components['schemas']['AuthResponseBody'];
type AuthSettingsWire = components['schemas']['AuthSettingsBody'];
type DemoPosition = {
  id: string;
  schema_version?: number;
  legs?: {
    id: string;
    ticker: string;
    expiration?: string | null;
    strike?: number | null;
    right?: string | null;
    qty: number;
    status?: string;
  }[];
  status?: string;
  [key: string]: unknown;
};
const writeFaults = new Set<string>();

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function isStringRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}
function isBookBlob(value: unknown): value is BookEnvelope['blob'] {
  if (
    !isObject(value) ||
    value.schema_version !== 1 ||
    !Array.isArray(value.positions) ||
    !Array.isArray(value.orders) ||
    !Array.isArray(value.decisions)
  )
    return false;
  return (
    value.positions.every(
      (row) =>
        isObject(row) &&
        typeof row.id === 'string' &&
        typeof row.ticker === 'string' &&
        typeof row.expiration === 'string' &&
        typeof row.strike === 'number' &&
        typeof row.right === 'string' &&
        typeof row.qty === 'number' &&
        typeof row.status === 'string',
    ) &&
    value.orders.every(
      (row) =>
        isObject(row) &&
        typeof row.id === 'string' &&
        typeof row.ticker === 'string' &&
        typeof row.status === 'string',
    ) &&
    value.decisions.every(
      (row) => isObject(row) && typeof row.id === 'string' && typeof row.decision === 'string',
    )
  );
}
function validStoredValue(key: string, value: unknown): boolean {
  if (!isObject(value)) return false;
  switch (key) {
    case 'convexa.positions.v3':
      return (
        value.schema_version === 3 &&
        isStringRecord(value.positions) &&
        Array.isArray(value.decisions) &&
        isObject(value.customization)
      );
    case 'convexa.orders.v1':
      return value.schema_version === 1 && isStringRecord(value.orders);
    case 'convexa.uiprefs.v1':
      return (
        value.schema_version === 1 &&
        (value.theme === 'dark' || value.theme === 'light') &&
        typeof value.default_ticker === 'string'
      );
    case 'convexa.demo.auth.settings.v1':
      return (
        (value.theme === 'dark' || value.theme === 'light') &&
        typeof value.default_ticker === 'string' &&
        (typeof value.active_persona_id === 'string' || value.active_persona_id === null) &&
        isObject(value.risk_inputs)
      );
    case 'convexa.demo.scan.view.v1':
      return (
        typeof value.authenticated === 'boolean' &&
        (value.density === 'compact' || value.density === 'comfortable') &&
        isObject(value.sort) &&
        typeof value.source === 'string' &&
        Array.isArray(value.symbols) &&
        value.symbols.every((symbol) => typeof symbol === 'string')
      );
    case 'convexa.demo.book.v1':
      return isBookBlob(value);
    default:
      return true;
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
  if (writeFaults.has(resolved))
    throw new Error(`Writes disabled for unreadable demo store: ${key}`);
  if (!validStoredValue(key, value)) {
    writeFaults.add(resolved);
    throw new Error(`Invalid demo value refused: ${key}`);
  }
  try {
    window.localStorage.setItem(resolved, JSON.stringify(value));
  } catch (error) {
    writeFaults.add(resolved);
    throw error;
  }
}

function readTouchSeconds(): number | undefined {
  const key = 'convexa.positions.touch_at';
  const resolved = demoStorageKey(key);
  try {
    const raw = window.localStorage.getItem(resolved);
    if (raw === null) return undefined;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0)
      throw new Error('Invalid demo position touch timestamp');
    return seconds;
  } catch (error) {
    writeFaults.add(resolved);
    throw error;
  }
}

function writeTouchSeconds(seconds: number): void {
  const key = 'convexa.positions.touch_at';
  const resolved = demoStorageKey(key);
  if (writeFaults.has(resolved))
    throw new Error('Writes disabled for unreadable demo touch timestamp');
  try {
    window.localStorage.setItem(resolved, String(seconds));
  } catch (error) {
    writeFaults.add(resolved);
    throw error;
  }
}

function readRecord(key: string): Record<string, unknown> {
  const value = readStored(key);
  return value ? (value as Record<string, unknown>) : {};
}

function projectLocalBook(): BookEnvelope['blob'] {
  const portfolio = readRecord('convexa.positions.v3');
  const ordersStore = readRecord('convexa.orders.v1');
  const positionsById =
    portfolio.positions && typeof portfolio.positions === 'object'
      ? (portfolio.positions as Record<string, DemoPosition>)
      : {};
  const ordersById =
    ordersStore.orders && typeof ordersStore.orders === 'object'
      ? (ordersStore.orders as Record<string, Record<string, unknown>>)
      : {};
  const positions: BookEnvelope['blob']['positions'] = Object.values(positionsById).flatMap(
    (position) => {
      const leg = position.legs?.[0];
      if (!leg || leg.expiration == null || leg.strike == null || leg.right == null) return [];
      return [
        {
          id: position.id,
          ticker: leg.ticker,
          expiration: leg.expiration,
          strike: leg.strike,
          right: leg.right,
          qty: leg.qty,
          status: String(position.status ?? 'open'),
        },
      ];
    },
  );
  const orders: BookEnvelope['blob']['orders'] = Object.values(ordersById).map((order) => ({
    id: String(order.id),
    ticker: String(order.ticker),
    status: String(order.status),
  }));
  const decisions: BookEnvelope['blob']['decisions'] = Array.isArray(portfolio.decisions)
    ? portfolio.decisions.flatMap((decision) => {
        if (!decision || typeof decision !== 'object') return [];
        const item = decision as Record<string, unknown>;
        const contract =
          item.contract && typeof item.contract === 'object'
            ? (item.contract as Record<string, unknown>)
            : {};
        return [
          {
            id: String(item.id ?? item.trade_id),
            ticker: typeof contract.ticker === 'string' ? contract.ticker : null,
            decision: String(item.event_type ?? 'sample'),
          },
        ];
      })
    : [];
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
  const positions =
    portfolio.positions && typeof portfolio.positions === 'object'
      ? { ...(portfolio.positions as Record<string, DemoPosition>) }
      : {};
  for (const item of blob.positions) {
    const prior = positions[item.id];
    const legs = prior?.legs
      ? [...prior.legs]
      : [
          {
            id: `${item.id}-leg-1`,
            ticker: item.ticker,
            expiration: item.expiration,
            strike: item.strike,
            right: item.right,
            qty: item.qty,
            status: item.status,
          },
        ];
    const first = legs[0];
    legs[0] = {
      ...first,
      ticker: item.ticker,
      expiration: item.expiration,
      strike: item.strike,
      right: item.right,
      qty: item.qty,
    };
    positions[item.id] = {
      ...prior,
      id: item.id,
      schema_version: prior?.schema_version ?? 3,
      status: item.status,
      legs,
    };
  }
  const decisions = Array.isArray(portfolio.decisions)
    ? ([...portfolio.decisions] as Record<string, unknown>[])
    : [];
  const existingDecisionIds = new Set(decisions.map((decision) => decision.id));
  const overlayDecisions = blob.decisions.filter(
    (decision) => !existingDecisionIds.has(decision.id),
  );
  const orders =
    orderStore.orders && typeof orderStore.orders === 'object'
      ? { ...(orderStore.orders as Record<string, Record<string, unknown>>) }
      : {};
  for (const item of blob.orders)
    orders[item.id] = { ...orders[item.id], id: item.id, ticker: item.ticker, status: item.status };
  const nextPortfolio = { ...portfolio, schema_version: 3, positions, decisions };
  const nextOrders = { ...orderStore, schema_version: 1, orders };
  const savedOverlay = priorOverlay
    ? (priorOverlay as BookEnvelope['blob'])
    : { schema_version: 1 as const, positions: [], orders: [], decisions: [] };
  const byId = new Map(savedOverlay.decisions.map((decision) => [decision.id, decision]));
  for (const decision of overlayDecisions) byId.set(decision.id, decision);
  const nextOverlay = { ...blob, decisions: [...byId.values()] };
  if (
    !validStoredValue('convexa.positions.v3', nextPortfolio) ||
    !validStoredValue('convexa.orders.v1', nextOrders) ||
    !validStoredValue('convexa.demo.book.v1', nextOverlay)
  )
    throw new Error('Generated book projection failed local store validation');
  try {
    writeStored('convexa.positions.v3', nextPortfolio);
    writeTouchSeconds(updatedAt);
    writeStored('convexa.orders.v1', nextOrders);
    writeStored('convexa.demo.book.v1', nextOverlay);
  } catch (error) {
    for (const key of [
      'convexa.positions.v3',
      'convexa.positions.touch_at',
      'convexa.orders.v1',
      'convexa.demo.book.v1',
    ])
      writeFaults.add(demoStorageKey(key));
    throw error;
  }
}

function riskInputs(
  accountSize: number | null = null,
  cap: { unit: string; value: number } | null = null,
): AuthSettingsWire['risk_inputs'] {
  const value =
    cap && Number.isFinite(cap.value) && cap.value > 0
      ? cap.unit === 'percent' && accountSize != null
        ? (accountSize * cap.value) / 100
        : cap.unit === 'usd'
          ? cap.value
          : null
      : null;
  return {
    state: accountSize != null || cap != null ? 'set' : 'not_set',
    storage_available: true,
    account_size: accountSize,
    per_trade_cap: cap,
    effective_dollar_cap: {
      state: value == null ? 'not_derivable' : 'derived',
      ...(value == null ? { not_derivable_reason: 'sample_input_incomplete' } : { value }),
      derived_from: {
        account_size: accountSize,
        cap_unit: cap?.unit ?? null,
        cap_value: cap?.value ?? null,
      },
    },
    updated_at: stamp / 1000,
  };
}

function readDemoSettings(): AuthSettingsWire {
  const saved = readStored('convexa.demo.auth.settings.v1');
  const prefs = (readStored('convexa.uiprefs.v1') ?? {}) as {
    theme?: string;
    default_ticker?: string;
  };
  if (saved) return saved as AuthSettingsWire;
  return {
    theme: prefs.theme ?? 'dark',
    default_ticker: prefs.default_ticker ?? 'SPY',
    active_persona_id: 'demo-careful-reader',
    // Seeded so the account's risk caps show filled in: a $25,000 sample account, 2% per trade.
    risk_inputs: riskInputs(25_000, { unit: 'percent', value: 2 }),
  };
}

function readScanView(): ScanView {
  return (readStored('convexa.demo.scan.view.v1') ?? {
    authenticated: true,
    density: 'comfortable',
    sort: { key: 'score', dir: 'desc' },
    source: 'demo_local',
    symbols: SYMBOLS,
  }) as ScanView;
}

function candidateSet(
  symbol: string,
  scenario: NonNullable<Awaited<ReturnType<typeof loadScenario>>>,
): CandidateSetWire {
  return {
    ticker: symbol,
    state: 'unavailable',
    as_of: DEMO_TIME,
    anchor_basis: 'gex_spot',
    anchor_spot: scenario.bars.at(-1)!.close,
    session_basis: 'rth',
    snapshot_age_seconds: 0,
    quote_age: 'not_available',
    band_pct: 10,
    budget: 'handoff',
    caps: { max_bytes: 0, max_records: 0, rights: 2, strikes_per_tenor_right: 0, tenors: 3 },
    contracts: [],
    included: { contracts: 0, expiration_count: 0, expirations: [] },
    omitted: {
      total: 0,
      expirations_omitted_by_cap: 0,
      by_reason: {
        expiration_cap: 0,
        no_interest: 0,
        outside_band: 0,
        outside_window: 0,
        strike_cap: 0,
      },
    },
    liquidity: {
      atm_relative_spread_band: 'unknown',
      no_two_sided_quote: 0,
      quoted: 0,
      wide_quote_threshold_pct: 15,
      wide_quotes: false,
    },
    sent_to_model: false,
  };
}

/** The scenario's own close-to-close change, in percent to two places: the last authored close against
 *  the one before it. `null` (shown as —) when there is no prior close to compare with. */
export function closeToClosePct(bars: ReadonlyArray<{ close: number }>): number | null {
  if (bars.length < 2) return null;
  const prior = bars[bars.length - 2].close;
  const last = bars[bars.length - 1].close;
  if (!Number.isFinite(prior) || !Number.isFinite(last) || prior <= 0) return null;
  return Number((((last - prior) / prior) * 100).toFixed(2));
}

/**
 * The tier for a sample score, on the API's own bands (apps/api scanner projection.rs TierBands and
 * quant-engine compute_opportunity_tier: prime 80 with a ready AI read, actionable 60).
 * The demo's authored reads are always available, so a sample score of 80 or more is Prime. A flat
 * "60 or more is Actionable" meant the demo never showed Prime, though NVDA scores 81 (site check
 * D-23).
 */
export function demoTier(score: number): 'prime' | 'actionable' | 'watch' {
  if (score >= 80) return 'prime';
  if (score >= 60) return 'actionable';
  // The authored scores run 47-81; the floor stays Watch, as before, rather than a dormant word
  // the bundle's tier type doesn't carry.
  return 'watch';
}

function scoreDrivers(total: number) {
  return { total, proximity: 18, setups: 12, vol: total - 35, transition: 5, dark_pool: 0 };
}

function recommendationStatus(): RecommendationWire {
  return {
    persona: { id: null, name: '' },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 0, resets_at: '' },
    availability: { in_app_enabled: false },
    powering: { key_source: 'none', provider: null, model: null, unavailable_reason: 'no_key' },
    scenarios: { enabled: false, catalog: [] },
  };
}

function sampleAnalysisText(
  symbol: string,
  variant: NonNullable<Awaited<ReturnType<typeof loadScenario>>>['variants'][string],
  sourceId: string,
): string {
  return `Sample analysis · authored for this scenario. ${symbol} shows ${variant.setup.toLowerCase()} with authored score ${variant.score}. Fingerprint ${variant.fingerprint}; source bar ${sourceId}. This is educational scenario copy, not a forecast, provider-generated response, or executable instruction. No market, broker, or AI provider was used.`;
}

function recommendationExport(
  symbol: string,
  scenario: NonNullable<Awaited<ReturnType<typeof loadScenario>>>,
  variant: NonNullable<Awaited<ReturnType<typeof loadScenario>>>['variants'][string],
): RecommendationWire {
  const sourceId =
    scenario.research.evidence[0]?.state === 'present'
      ? scenario.research.evidence[0].sourceIds[0]
      : 'unavailable';
  const spot = scenario.bars.at(-1)!.close;
  // The scenario's own structure, as the desk draws it (tickerPayload): what a read would be given.
  // The live export sends the bundle's market_state here too (services/recommendation.rs), though
  // the generated RecommendationContextBody doesn't list it, so the context is built apart from the
  // envelope literal. The sample paragraph rides along with the snapshot it describes.
  const context = {
    market_state: {
      ticker: symbol,
      spot,
      as_of: DEMO_TIME,
      call_wall: variant.wall,
      put_wall: Number((variant.wall - spot * 0.075).toFixed(2)),
      gamma_flip: variant.flip,
      max_pain: spot,
      setup: variant.setup,
      score: variant.score,
      sample_analysis: sampleAnalysisText(symbol, variant, sourceId),
    },
    candidates: candidateSet(symbol, scenario),
    risk_inputs: { state: 'not_set', account_size: null, per_trade_cap: null },
    open_positions: { source: 'simulated', state: 'not_sent' },
  };
  return {
    ticker: symbol,
    as_of: DEMO_TIME,
    persona: { id: null, name: 'Authored sample' },
    context,
    egress_note:
      'No content was sent to a model or external provider. This export contains authored sample context only.',
    persona_prompt: null,
    glossary: [
      'spot: the underlying’s close at the scenario snapshot',
      'call_wall / put_wall: the strikes with the largest call and put dealer gamma',
      'gamma_flip: where net dealer gamma changes sign',
      'max_pain: the strike where open options would expire worth the least',
      'score: the scanner’s 0–100 score for the setup',
    ].join('\n'),
    egress_categories: [
      { key: 'context', sent: false },
      { key: 'candidates', sent: false },
      { key: 'risk_inputs', sent: false },
      { key: 'open_positions', sent: false },
      { key: 'persona_prompt', sent: false },
      { key: 'glossary', sent: false },
    ],
  };
}

type GroundingWire = NonNullable<RecommendationWire['grounding']>;
type GroundingFieldWire = GroundingWire['fields']['invalidation_level'];
type GroundingFieldsWire = GroundingWire['fields'];

/** The API's grounding tolerance, stated once per response (services/recommendation.rs
 *  GROUNDING_TOL_PCT). */
const GROUNDING_TOL_PCT = 0.1;

const notApplicableField = (): GroundingFieldWire => ({
  state: 'not_applicable',
  basis: null,
  anchor_kind: null,
  anchor_value: null,
  range_low: null,
  range_high: null,
  expiration: null,
  not_checkable_reason: null,
});

/**
 * The counts, tallied as the API tallies them (services/rec_inputs/grounding.rs `counts`): a field
 * that is not applicable, or not checkable for a structural reason, is not checked; every other
 * state is. The demo's reads cite no contract, so the contract adds nothing.
 */
export function groundingCounts(fields: GroundingFieldsWire): GroundingWire['counts'] {
  const c = { checked: 0, traced: 0, untraced: 0, not_checkable: 0 };
  for (const f of Object.values(fields)) {
    if (f.state === 'not_applicable') continue;
    if (f.state === 'not_checkable') {
      if (f.not_checkable_reason === 'structurally_unchecked') continue;
      c.checked += 1;
      c.not_checkable += 1;
    } else if (f.state === 'traced') {
      c.checked += 1;
      c.traced += 1;
    } else if (f.state === 'untraced') {
      c.checked += 1;
      c.untraced += 1;
    }
  }
  return c;
}

/**
 * The contract's card rule, in its fixed order, first match wins (the archived ai-rec-grounding
 * INTERFACE_CONTRACT, `grounding.card`; the API's grounding.rs `card_member`): not applicable when
 * the read states no trade or nothing was checked; then local rules; then none traced, could not
 * check, some traced, all traced.
 */
export function groundingCard(
  decision: string,
  counts: GroundingWire['counts'],
  localOnly = false,
): GroundingWire['card'] {
  if (decision !== 'trade' || counts.checked === 0) return 'not_applicable';
  if (localOnly) return 'local_rules';
  if (counts.traced === 0 && counts.untraced >= 1) return 'none_traced';
  if (counts.traced === 0) return 'could_not_check';
  if (counts.traced < counts.checked) return 'some_traced';
  return 'all_traced';
}

/**
 * The authored read's grounding block, as the API would send it (site check D-07, corrected
 * 2026-10-16 after review: the demo follows the API). Every authored read states no trade, and a
 * read that states no trade is not applicable by contract, whatever figures it names; the authored
 * reads set none, so every field is not applicable and the counts are zero. The panel therefore
 * shows no trace line on them, exactly as on a live no-trade read.
 */
export function sampleReadGrounding(
  decision: 'trade' | 'no_trade',
  fields: GroundingFieldsWire = {
    exit_stop: notApplicableField(),
    exit_target: notApplicableField(),
    invalidation_level: notApplicableField(),
    max_risk: notApplicableField(),
    position_size: notApplicableField(),
  },
): GroundingWire {
  const counts = groundingCounts(fields);
  return {
    card: groundingCard(decision, counts),
    counts,
    fields,
    tolerance_pct: GROUNDING_TOL_PCT,
  };
}

const twoDp = (value: number) => value.toFixed(2);
const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const shortDate = (iso: string) => {
  const t = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(t) ? SHORT_DATE.format(new Date(t)) : iso;
};

/**
 * The authored read's key points and re-engage lines, written from the same snapshot the desk draws
 * for the selected expiry set (tickerPayload), so every level they name is a level on the page.
 */
export function sampleReadReasons(
  snapshot: TickerBundle['market_state'],
  regime: TickerBundle['signals']['regime'],
): { keyPoints: string[]; reengage: string[] } {
  const spot = snapshot.price;
  const flip = snapshot.gamma_flip;
  const wall = snapshot.call_wall;
  const keyPoints: string[] = [];
  const reengage: string[] = [];
  const positive = regime === 'positive_gamma';
  if (spot != null && flip != null && flip > 0) {
    const above = spot >= flip;
    const pct = Math.abs(((spot - flip) / flip) * 100).toFixed(1);
    keyPoints.push(
      `Spot ${twoDp(spot)} is ${pct}% ${above ? 'above' : 'below'} the flip at ${twoDp(flip)}: ` +
        (positive
          ? '+γ, dealer hedging tends to damp moves here.'
          : '−γ, dealer hedging tends to amplify moves here.'),
    );
    reengage.push(
      `Spot closes ${above ? 'below' : 'above'} the flip at ${twoDp(flip)}, where hedging turns ` +
        `${positive ? '−γ' : '+γ'}.`,
    );
  }
  const tenor =
    snapshot.straddle_move?.state === 'ok'
      ? snapshot.straddle_move.tenors.find(
          (t) => t.expiration === snapshot.straddle_move?.primary_expiration,
        )
      : undefined;
  if (spot != null && wall != null && tenor) {
    const inside = Math.abs(wall - spot) <= tenor.move_dollars;
    keyPoints.push(
      `The ${twoDp(wall)} call wall sits ${inside ? 'inside' : 'outside'} the ±$${twoDp(tenor.move_dollars)} ` +
        `move the ${shortDate(tenor.expiration)} straddle prices.`,
    );
    if (!inside)
      reengage.push(
        'Or the call wall moves inside the implied move on the next structure refresh.',
      );
  }
  return { keyPoints, reengage };
}

function recommendation(
  symbol: string,
  variant: NonNullable<Awaited<ReturnType<typeof loadScenario>>>['variants'][string],
  personaId: string | null | undefined,
  snapshot: TickerBundle,
): RecommendationWire {
  const reasons = sampleReadReasons(snapshot.market_state, snapshot.signals.regime);
  return {
    status: 'produced',
    ticker: symbol,
    as_of: DEMO_TIME,
    persona: { id: personaId ?? 'demo-careful-reader', name: 'Careful sample reader' },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 0, resets_at: DEMO_TIME },
    availability: { in_app_enabled: false },
    key_source: 'none',
    strategy: {
      bias: 'neutral',
      confidence: 'low',
      decision: 'no_trade',
      exit_plan: { target: null, stop: null },
      strikes: [],
      structure: variant.setup,
      summary: `Authored sample: ${symbol} shows ${variant.setup.toLowerCase()} with authored score ${variant.score}. Not a model recommendation.`,
      rationale: `Synthetic ${symbol} structure has ${variant.setup.toLowerCase()} with authored score ${variant.score}. This is scenario copy, not a forecast or executable instruction; no live market, broker, or AI provider was used.`,
      key_points: reasons.keyPoints,
      reengage_when: [...reasons.reengage, 'Review when the selected authored expiry set changes.'],
    },
    grounding: sampleReadGrounding('no_trade'),
    pinned_fingerprint: variant.fingerprint,
    stale_born: false,
  };
}
const supportedPath = (method: string, pathname: string): boolean => {
  const routes: [string, RegExp][] = [
    ['GET', /^\/api\/auth\/session$/],
    ['POST', /^\/api\/auth\/(signup|login|logout)$/],
    ['PUT', /^\/api\/auth\/settings$/],
    ['POST', /^\/api\/positions\/sim-trade\/gate$/],
    ['GET', /^\/api\/scan(?:\/universe|\/view)?$/],
    ['PUT', /^\/api\/scan\/view$/],
    ['GET', /^\/api\/scan\/[A-Z]+\/history$/i],
    ['GET', /^\/api\/ticker\/[A-Z]+$/i],
    ['GET', /^\/api\/contract\/[A-Z]+$/i],
    ['GET', /^\/api\/candidates\/[A-Z]+$/i],
    ['GET', /^\/api\/_metrics$/],
    ['GET', /^\/api\/auth\/ai-key$/],
    ['PUT', /^\/api\/auth\/ai-key$/],
    ['DELETE', /^\/api\/auth\/ai-key$/],
    ['DELETE', /^\/api\/auth\/grok$/],
    ['GET', /^\/api\/book$/],
    ['PUT', /^\/api\/book$/],
    ['POST', /^\/api\/recommendation\/[A-Z]+$/i],
    ['GET', /^\/api\/recommendation\/(status|export)\/[A-Z]+$/i],
    ['GET', /^\/api\/personas$/],
    ['GET', /^\/api\/public-data\/(?:markets|filings)$/],
    ['GET', /^\/api\/public-data\/tickers\/[^/]+$/],
    ['GET', /^\/api\/broker\/credential$/],
    ['PUT', /^\/api\/broker\/credential$/],
    ['DELETE', /^\/api\/broker\/credential$/],
    ['GET', /^\/api\/broker\/book$/],
    ['POST', /^\/api\/broker\/book\/refresh$/],
  ];
  return routes.some(([verb, pattern]) => verb === method && pattern.test(pathname));
};

/** How fast the demo's positioning thins past its authored 11-strike core, in points (DESK-10). */
const GAMMA_THINS_OVER = 12;
const OI_THINS_OVER = 8;

function tickerPayload(
  scenario: Awaited<ReturnType<typeof loadScenario>> & {},
  key: string,
  expirations: string[],
) {
  const variant = scenario.variants[key];
  const spot = scenario.bars.at(-1)!.close;
  const ivOffset = (scenario.phase % 7) * 0.35;
  const ivByExpiry = [26.4 + ivOffset, 25.7 + ivOffset, 27.2 + ivOffset];
  const observations = scenario.bars
    .slice(-20)
    .map((bar, index) =>
      Number((22 + ((bar.close / scenario.base + index * 0.17) % 8)).toFixed(2)),
    );
  const atmIv = Number((24 + ((scenario.phase + scenario.step) % 5)).toFixed(2));
  observations[observations.length - 1] = atmIv;
  const observedMin = Math.min(...observations);
  const observedMax = Math.max(...observations);
  const ivRank = Number((100 * (atmIv - observedMin)) / (observedMax - observedMin || 1));
  const ivPercentile = Number(
    (
      (100 * observations.filter((observation) => observation < atmIv).length) /
      observations.length
    ).toFixed(2),
  );
  const selectedExpiry = expirations[0];
  const selectedDte = DTE[selectedExpiry as keyof typeof DTE];
  // D-22: Net DEX, Vol/OI, IV skew and the off-exchange share come from this symbol's own bars and
  // authored IV (flowSeed.ts), not one set of constants every symbol shared.
  const flow = flowSeed({ bars: scenario.bars, atmIvPct: atmIv });
  // Fidelity DESK-10: the strike grid spans both walls with 12 points to spare, in 2.5-point steps
  // (SPY: 640 to 717.5), so the field draws the put wall it names. It used to be 11 strikes 5
  // points apart around spot (SPY 665 to 715): the authored core, which the grid still covers.
  // Positioning keeps the core's shape: at twice the core's strike density each strike carries half
  // of the core's per-strike gamma and open interest, and past the core both thin out. So the
  // bundle's story holds: net GEX stays positive under the authored +γ regime, and Net DEX and
  // Vol/OI keep their sign and size (SPY, all expirations: +$0.43B and 0.44×, from +$1.06B and
  // 0.51×). A flat grid out to the put wall turned SPY's net GEX negative and multiplied its Net
  // DEX by 14. The three strikes that trade over their open interest are the core's three (spot's
  // 5-point strike plus 15, 20 and 25) at the core's full open interest and ratios, so Fresh
  // positioning keeps its rows.
  const callWall = variant.wall;
  const putWall = Number((variant.wall - spot * 0.075).toFixed(2));
  const coreLo = Math.floor(spot / 5) * 5 - 25;
  const coreHi = coreLo + 50;
  const strikeLo = Math.min(Math.floor((putWall - 12) / 2.5) * 2.5, coreLo);
  const strikeHi = Math.max(Math.ceil((callWall + 12) / 2.5) * 2.5, coreHi);
  const strikes = Array.from({ length: Math.round((strikeHi - strikeLo) / 2.5) + 1 }, (_, i) => {
    const strike = Number((strikeLo + i * 2.5).toFixed(2));
    // The core's own index scale (0 to 10 on its 5-point strikes), so values continue its ramps.
    const core = (strike - coreLo) / 5;
    const beyond = Math.max(0, coreLo - strike, strike - coreHi);
    const unusual = Number.isInteger(core) && core >= 8 && core <= 10 ? core - 8 : null;
    const gammaShare = 0.5 * Math.exp(-((beyond / GAMMA_THINS_OVER) ** 2));
    const oiShare = unusual !== null ? 1 : 0.5 * Math.exp(-((beyond / OI_THINS_OVER) ** 2));
    const callGex = Number(
      ((100_000_000 - Math.abs(strike - variant.wall) * 1_500_000) * gammaShare).toFixed(2),
    );
    const putGex = Number(
      ((-80_000_000 + Math.abs(strike - variant.flip) * 1_000_000) * gammaShare).toFixed(2),
    );
    const callOi = Math.max(1, Math.round((20_000 + core * 101) * oiShare));
    const putOi = Math.max(1, Math.round((18_000 + core * 89) * oiShare));
    const totalOi = callOi + putOi;
    const baseVolume =
      unusual !== null ? totalOi * (1.2 + unusual * 0.1) : (3_500 + core * 41) * oiShare;
    const volume = Math.round(baseVolume * flow.volumeMultiplier);
    // The API's own dollar DEX: delta × open interest × 100 × spot (quant-engine gex.rs).
    const delta = callDelta(spot, strike, atmIv, selectedDte);
    const callDex = Number((delta * callOi * 100 * spot).toFixed(2));
    const putDex = Number(((delta - 1) * putOi * 100 * spot).toFixed(2));
    return {
      strike,
      net_gex: callGex + putGex,
      call_gex: callGex,
      put_gex: putGex,
      call_oi: callOi,
      put_oi: putOi,
      total_oi: totalOi,
      net_dex: Number((callDex + putDex).toFixed(2)),
      call_dex: callDex,
      put_dex: putDex,
      volume,
      vol_oi_ratio: Number((volume / totalOi).toFixed(6)),
    };
  });
  const callGex = strikes.reduce((sum, strike) => sum + strike.call_gex, 0);
  const putGex = strikes.reduce((sum, strike) => sum + strike.put_gex, 0);
  const callDex = strikes.reduce((sum, strike) => sum + (strike.call_dex ?? 0), 0);
  const putDex = strikes.reduce((sum, strike) => sum + (strike.put_dex ?? 0), 0);
  const netGex = callGex + putGex;
  const netDex = callDex + putDex;
  const totalOi = strikes.reduce((sum, row) => sum + row.total_oi, 0);
  const totalVolume = strikes.reduce((sum, row) => sum + row.volume!, 0);
  const callOi = strikes.reduce((sum, row) => sum + row.call_oi!, 0);
  const putOi = strikes.reduce((sum, row) => sum + row.put_oi!, 0);
  const charmPerDayBase = Number((variant.score * 100).toFixed(2));
  const skewCallIv = Number((atmIv - 0.4 * flow.skewPts).toFixed(2));
  const skewPutIv = Number((atmIv + 0.6 * flow.skewPts).toFixed(2));
  const termSlope = Number((ivByExpiry[2] - ivByExpiry[0]).toFixed(2));
  const indicators = computeIndicators(scenario.bars);
  const finalIndicator = (name: keyof typeof indicators) => {
    const point = indicators[name].at(-1);
    return point?.state === 'ready' ? point.value : null;
  };
  const ema20 = finalIndicator('ema20')!;
  const ema50 = finalIndicator('ema50')!;
  const rsi = finalIndicator('rsi14')!;
  const adx = finalIndicator('adx14')!;
  const atr = finalIndicator('atr14')!;
  const direction =
    spot > ema20 && ema20 > ema50
      ? 'uptrend'
      : spot < ema20 && ema20 < ema50
        ? 'downtrend'
        : 'mixed';
  const momentum =
    rsi >= 70
      ? 'overbought'
      : rsi <= 30
        ? 'oversold'
        : rsi >= 55
          ? 'bullish'
          : rsi <= 45
            ? 'bearish'
            : 'neutral';
  const strength = adx >= 25 ? 'strong' : adx >= 20 ? 'moderate' : 'weak';
  const absGex = strikes.reduce((sum, row) => sum + Math.abs(row.net_gex ?? 0), 0);
  const concentration = Number(
    (Math.max(...strikes.map((row) => Math.abs(row.net_gex ?? 0))) / (absGex || 1)).toFixed(4),
  );
  const balance = Number((netGex / (absGex || 1)).toFixed(4));
  const weightedStrike =
    strikes.reduce((sum, row) => sum + row.strike * Math.abs(row.net_gex ?? 0), 0) / (absGex || 1);
  const centerDistance = Number(((weightedStrike - spot) / spot).toFixed(4));
  const locationShift = Number(
    (
      strikes.reduce((sum, row) => sum + (row.volume! - row.total_oi * 0.1), 0) / totalVolume
    ).toFixed(4),
  );
  const volumeCall = strikes.reduce(
    (sum, row) => sum + row.volume! * (row.call_oi! / row.total_oi!),
    0,
  );
  const volumePut = totalVolume - volumeCall;
  const volumePcr = volumePut / volumeCall;
  const oiPcr = putOi / callOi;
  const compositionLabel =
    volumePcr > oiPcr * 1.05
      ? 'flow_put_tilted'
      : volumePcr < oiPcr * 0.95
        ? 'flow_call_tilted'
        : 'consistent';
  const atmStrike = strikes.reduce(
    (nearest, row) =>
      Math.abs(row.strike - spot) < Math.abs(nearest - spot) ? row.strike : nearest,
    strikes[0].strike,
  );
  const callQuote = sampleContractQuote(spot, atmStrike, 'call', selectedDte);
  const putQuote = sampleContractQuote(spot, atmStrike, 'put', selectedDte);
  const straddlePrice = Number((callQuote.mid + putQuote.mid).toFixed(2));
  const straddleQuoteSpreadPct = Number(
    (100 * (callQuote.ask + putQuote.ask - callQuote.bid - putQuote.bid)) / straddlePrice,
  );
  // D-22: this symbol's off-exchange share of a 10M-share window, in whole percent, split across the
  // three block prints 12 : 9 : 7 (the shape the shared constants had) and rounded to 1,000 shares.
  const offexTotal = 10_000_000;
  const offexTarget = Math.round(flow.offExchangeShare * 100) * 100_000;
  const blockA = Math.round((offexTarget * 12) / 28 / 1_000) * 1_000;
  const blockB = Math.round((offexTarget * 9) / 28 / 1_000) * 1_000;
  const blockRows = [
    { price: Number((spot * 0.996).toFixed(2)), shares: blockA, age_seconds: 75 },
    { price: Number((spot * 1.002).toFixed(2)), shares: blockB, age_seconds: 130 },
    {
      price: Number((spot * 1.006).toFixed(2)),
      shares: offexTarget - blockA - blockB,
      age_seconds: 210,
    },
  ];
  const offexShares = blockRows.reduce((sum, row) => sum + row.shares, 0);
  const volBasis = 0.18;
  const fullExpirations = EXPIRIES.map((date, i) => ({ date, dte: [2, 9, 44][i] }));
  const state: TickerBundle['market_state'] = {
    ticker: scenario.symbol,
    price: spot,
    gex_spot: spot,
    timestamp: stamp / 1000,
    timestamp_iso: DEMO_TIME,
    call_wall: callWall,
    put_wall: putWall,
    peak_gex_strike: Number((Math.round(variant.wall / 5) * 5).toFixed(2)),
    gamma_flip: variant.flip,
    max_pain: spot,
    max_pain_expiration: '2026-10-16',
    net_gex: netGex,
    call_gex: callGex,
    put_gex: putGex,
    total_gex: netGex,
    net_dex: netDex,
    call_dex: callDex,
    put_dex: putDex,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: Number((spot - 1.25).toFixed(2)),
    vwap_upper_2: null,
    vwap_upper_3: null,
    vwap_lower_2: null,
    vwap_lower_3: null,
    dte_min: Math.min(
      ...expirations.map((d) => (d === EXPIRIES[0] ? 2 : d === EXPIRIES[1] ? 9 : 44)),
    ),
    dte_max: Math.max(
      ...expirations.map((d) => (d === EXPIRIES[0] ? 2 : d === EXPIRIES[1] ? 9 : 44)),
    ),
    atm_iv: atmIv,
    hv_30d: 23,
    iv_hv_ratio: Number((atmIv / 23).toFixed(4)),
    net_flow: null,
    put_call_ratio: Number(oiPcr.toFixed(4)),
    chain_vol_oi_ratio: Number((totalVolume / totalOi).toFixed(4)),
    total_volume: totalVolume,
    vol_oi_unusual_threshold: 1,
    iv_skew: {
      call_iv: skewCallIv,
      put_iv: skewPutIv,
      slope: Number((skewPutIv - skewCallIv).toFixed(2)),
      expiration: selectedExpiry,
      dte: selectedDte,
      reference: 'ATM call and put IV, selected expiry; authored sample observations.',
    },
    term_structure: {
      points: EXPIRIES.map((expiration, index) => ({
        expiration,
        dte: DTE[expiration],
        atm_iv: ivByExpiry[index],
      })),
      near_iv: ivByExpiry[0],
      far_iv: ivByExpiry[2],
      slope: termSlope,
      state: Math.abs(termSlope) < 0.5 ? 'flat' : termSlope > 0 ? 'contango' : 'backwardation',
    },
    dealer_flow_projection: {
      spot_basis: spot,
      charm: {
        horizon_days: 9,
        opex_date: '2026-10-16',
        per_day_base: charmPerDayBase,
        projected_delta: Number((charmPerDayBase * 9).toFixed(2)),
      },
      vanna: {
        move_iv_points: 1,
        illustrative_move_iv_points: 5,
        projected_delta: Number((variant.distance * spot * 10).toFixed(2)),
        illustrative_projected_delta: Number(
          (Number((variant.distance * spot * 10).toFixed(2)) * 5).toFixed(2),
        ),
        reference_direction: 'increase',
      },
    },
    market_context: {
      trend_momentum: {
        as_of_session: scenario.bars.at(-1)!.date,
        direction: {
          close: spot,
          ema20,
          ema50,
          label: direction,
          thresholds: 'close vs EMA20 vs EMA50',
          window: '20/50 daily closes',
        },
        strength: {
          adx,
          label: strength,
          thresholds: 'weak <20; moderate 20-24.99; strong >=25',
          window: 'Wilder ADX 14, daily OHLC',
        },
        momentum: {
          rsi,
          label: momentum,
          thresholds: 'oversold <=30; bearish <45; neutral 45-55; bullish >55; overbought >=70',
          window: 'Wilder RSI 14, daily closes',
        },
      },
      gex_profile_shape: {
        balance,
        balance_label:
          centerDistance > 0.005
            ? 'above_skewed'
            : centerDistance < -0.005
              ? 'below_skewed'
              : 'balanced',
        center_of_mass_distance: centerDistance,
        concentration,
        concentration_label:
          concentration >= 0.35 ? 'concentrated' : concentration >= 0.2 ? 'mixed' : 'dispersed',
        eligible_strikes: strikes.length,
        spot_basis: spot,
        thresholds:
          'Concentration: concentrated >=0.35, mixed >=0.20; balance by center-of-mass distance ±0.5% of spot.',
      },
      flow_vs_positioning: {
        flow_basis:
          'authored full-chain same-day option volume vs standing open interest; unsigned totals',
        composition: {
          volume_pcr: Number(volumePcr.toFixed(4)),
          oi_pcr: Number(oiPcr.toFixed(4)),
          tilt_ratio: Number(
            (Math.max(volumePcr, oiPcr) / Math.max(0.0001, Math.min(volumePcr, oiPcr))).toFixed(4),
          ),
          label: compositionLabel,
          thresholds:
            'Flow put-tilted >5% above OI PCR; call-tilted >5% below; otherwise consistent.',
        },
        location: {
          distribution_shift: locationShift,
          label:
            Math.abs(locationShift) < 0.02
              ? 'aligned'
              : Math.abs(locationShift) < 0.08
                ? 'rotating'
                : 'divergent',
          thresholds:
            'Aligned <2%; rotating <8%; divergent otherwise, by volume minus 10% of OI over total volume.',
        },
      },
      atr: {
        as_of_session: scenario.bars.at(-1)!.date,
        close_basis: spot,
        method: 'simple mean true range from the existing synthetic daily OHLC indicator series',
        atr_5d: null,
        atr_14d: {
          value: atr,
          pct_of_close: Number(((100 * atr) / spot).toFixed(4)),
          window_bars: 14,
        },
        atr_30d: null,
      },
    },
    iv_rank: {
      state: 'computed',
      rank: ivRank,
      percentile: ivPercentile,
      band: ivRank >= 70 ? 'premium_rich' : ivRank <= 30 ? 'premium_cheap' : 'neutral',
      current_iv: atmIv,
      iv_basis: 'authored_full_chain_atm_iv',
      basis_dte: 30,
      sample_count: observations.length,
      min_samples: 10,
      window_cap: 20,
      window_sessions: 20,
      window_descriptor: '20 authored synthetic IV observations in this scenario',
      basis_descriptor: 'Full-chain interpolated 30D ATM IV; authored observations only.',
      advisory_note: 'Synthetic scenario context; not observed market history or a scored signal.',
      rank_unavailable_reason: null,
    },
    vol_normalized_gex: {
      call_gex: Number((callGex / volBasis).toFixed(2)),
      put_gex: Number((putGex / volBasis).toFixed(2)),
      net_gex: Number((netGex / volBasis).toFixed(2)),
      total_gex: Number((netGex / volBasis).toFixed(2)),
      vol_used: volBasis,
      vol_basis: 'decimal implied-volatility basis 0.18',
      basis_note:
        'Selected-expiry raw profile GEX divided by the same authored decimal volatility basis.',
    },
    straddle_move: {
      state: 'ok',
      as_of: DEMO_TIME,
      session_basis: 'rth',
      anchor_basis: 'gex_spot',
      anchor_label: 'gex_spot',
      anchor_spot: spot,
      primary_expiration: selectedExpiry,
      wide_quote_threshold_pct: 15,
      tenors: [
        {
          expiration: selectedExpiry,
          dte: selectedDte,
          strike_used: atmStrike,
          strike_distance_pct: Number(((100 * Math.abs(atmStrike - spot)) / spot).toFixed(4)),
          straddle_price: straddlePrice,
          move_dollars: straddlePrice,
          move_pct: Number(((100 * straddlePrice) / spot).toFixed(4)),
          quote_spread_pct_of_mid: straddleQuoteSpreadPct,
          wide_quotes: false,
          basis: 'authored ATM call and put marks at the selected expiry',
        },
      ],
    },
  };
  const signals: TickerBundle['signals'] = {
    ticker: scenario.symbol,
    regime: 'positive_gamma',
    regime_note: 'Authored synthetic structure snapshot.',
    vol_regime: 'neutral',
    distances: {
      call_wall_pct: Number(((variant.wall - spot) / spot).toFixed(4)),
      gamma_flip_pct: variant.distance,
    },
    setups: [
      {
        name: variant.setup,
        bias: 'neutral',
        conviction: 'medium',
        strategy: 'observe',
        rationale: 'Authored scenario variant.',
      },
    ],
    opportunity_score: variant.score,
    opportunity_tier: demoTier(variant.score),
    prime_prompt_eligible: false,
    score_drivers: scoreDrivers(variant.score),
    dark_pool_confluence: null,
  };
  const bundle: TickerBundle = {
    market_state: state,
    signals,
    state_fingerprint: variant.fingerprint,
    strike_profile: { ticker: scenario.symbol, spot, strikes },
    expirations: expirations.map((date) => fullExpirations.find((e) => e.date === date)!),
    ai_eval: {
      ready: false,
      reasons: ['Sample analysis is authored, not generated by an AI provider.'],
      changed: false,
      state_fingerprint: variant.fingerprint,
      score_threshold: 50,
    },
    meta: {
      served_at: DEMO_TIME,
      cache: { hit: true, age_seconds: 0, ttl_seconds: 0 },
      freshness: {
        snapshot_iso: DEMO_TIME,
        data_age_seconds: 0,
        stale: false,
        stale_after_seconds: 0,
      },
    },
    off_exchange: {
      ratio_pct: Number(((100 * offexShares) / offexTotal).toFixed(4)),
      offex_shares: offexShares,
      total_shares: offexTotal,
      levels: blockRows.map((row) => ({
        price: row.price,
        shares: row.shares,
        proximity_pct: Number(((row.price - spot) / spot).toFixed(4)),
        share_of_offex_pct: Number(((100 * row.shares) / offexShares).toFixed(4)),
      })),
      blocks: blockRows.map((row) => ({
        ...row,
        notional: Number((row.price * row.shares).toFixed(2)),
        proximity_pct: Number(((row.price - spot) / spot).toFixed(4)),
      })),
      block_min_shares: 500_000,
      note: 'Side unknown · authored synthetic off-exchange context, not a trade-direction signal.',
    },
    position_eval: null,
  };
  return bundle;
}

export async function demoFetch(request: Request): Promise<Response> {
  if (dataMode !== 'demo')
    return refused('demo_unavailable', 'Demo transport is not active in this build.');
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname.replace(/\/$/, '');
  if (!supportedPath(method, pathname))
    return refused(
      'demo_unavailable',
      'This method and path are not part of the local demo contract.',
    );

  const publicData = demoPublicData(pathname, url.searchParams);
  if (publicData)
    return publicData.ok ? json(publicData.body) : refused('demo_unsupported', publicData.detail);

  const tickerMatch = pathname.match(/^\/api\/(?:ticker|contract|candidates)\/([A-Z]+)$/i);
  if (
    tickerMatch &&
    (pathname.startsWith('/api/ticker/') ||
      pathname.startsWith('/api/contract/') ||
      pathname.startsWith('/api/candidates/'))
  ) {
    const symbol = tickerMatch[1].toUpperCase();
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    if (pathname.startsWith('/api/ticker/')) {
      const minDte = url.searchParams.has('min_dte')
        ? Number(url.searchParams.get('min_dte'))
        : undefined;
      const maxDte = url.searchParams.has('max_dte')
        ? Number(url.searchParams.get('max_dte'))
        : undefined;
      const projection = effectiveExpiries({
        minDte,
        maxDte,
        expirations: url.searchParams.get('expirations')?.split(','),
      });
      if (projection.state !== 'ready') return refused('demo_unsupported', projection.detail);
      const requested = url.searchParams.get('dark_pool');
      if (requested === 'false')
        return refused('demo_unsupported', 'darkPool=false has no curated sample score variant.');
      return json(tickerPayload(scenario, projection.key, projection.dates));
    }
    if (pathname.startsWith('/api/contract/')) {
      const expiration = url.searchParams.get('expiration') ?? '';
      const strike = Number(url.searchParams.get('strike'));
      const right = url.searchParams.get('right');
      const allowedStrike = Math.floor(scenario.bars.at(-1)!.close / 5) * 5 - 25;
      const inChain =
        (EXPIRIES as readonly string[]).includes(expiration) &&
        Number.isFinite(strike) &&
        strike >= allowedStrike &&
        strike <= allowedStrike + 50 &&
        (right === 'call' || right === 'put');
      if (!inChain)
        return json(
          {
            code: 'demo_unavailable',
            detail: 'No sample contract exists for the requested contract.',
          },
          404,
        );
      const dte = expiration === EXPIRIES[0] ? 2 : expiration === EXPIRIES[1] ? 9 : 44;
      const spot = scenario.bars.at(-1)!.close;
      const optionQuote = sampleContractQuote(spot, strike, right, dte);
      const contract: components['schemas']['ContractWire'] = {
        ticker: symbol,
        expiration,
        strike,
        right,
        dte,
        iv: 0.27,
        greeks: { delta: right === 'call' ? 0.52 : -0.48, gamma: 0.018, theta: -0.11, vega: 0.21 },
        option_quote: optionQuote,
      };
      return json(contract);
    }
    const candidates = candidateSet(symbol, scenario);
    return json(candidates);
  }

  if (pathname === '/api/auth/session') {
    try {
      const response: AuthResponseWire = {
        authenticated: true,
        google_available: false,
        user: DEMO_ACCOUNT,
        settings: readDemoSettings(),
        demo_seed: null,
      };
      return json(response);
    } catch {
      return refused('demo_unavailable', 'The local demo settings could not be read.');
    }
  }
  if (
    pathname === '/api/auth/signup' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/grok' ||
    (pathname === '/api/auth/ai-key' && method !== 'GET') ||
    (pathname === '/api/broker/credential' && method !== 'GET')
  )
    return refused(
      'demo_unavailable',
      'Credentials, sign-in, AI-provider, and OAuth actions are disabled in this local sample.',
    );
  if (pathname === '/api/_metrics')
    return refused('demo_unavailable', 'Operator metrics are unavailable in the public sample.');
  if (pathname === '/api/auth/settings' && method === 'PUT') {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const current = readDemoSettings();
      const rawRisk =
        body.risk_inputs && typeof body.risk_inputs === 'object'
          ? (body.risk_inputs as Record<string, unknown>)
          : null;
      const rawCap =
        rawRisk?.per_trade_cap && typeof rawRisk.per_trade_cap === 'object'
          ? (rawRisk.per_trade_cap as Record<string, unknown>)
          : null;
      const accountSize =
        rawRisk && 'account_size' in rawRisk
          ? typeof rawRisk.account_size === 'number'
            ? rawRisk.account_size
            : null
          : (current.risk_inputs.account_size ?? null);
      const cap =
        rawRisk && 'per_trade_cap' in rawRisk
          ? rawCap && typeof rawCap.value === 'number' && typeof rawCap.unit === 'string'
            ? { unit: rawCap.unit, value: rawCap.value }
            : null
          : (current.risk_inputs.per_trade_cap ?? null);
      if (
        (accountSize != null && (!Number.isFinite(accountSize) || accountSize <= 0)) ||
        (cap != null &&
          (!Number.isFinite(cap.value) ||
            cap.value <= 0 ||
            (cap.unit === 'percent' && cap.value > 100) ||
            (cap.unit !== 'percent' && cap.unit !== 'usd')))
      )
        return refused(
          'demo_unsupported',
          'Sample risk settings must be positive and use supported units.',
        );
      const next: AuthSettingsWire = {
        theme: typeof body.theme === 'string' ? body.theme : current.theme,
        default_ticker:
          typeof body.default_ticker === 'string'
            ? body.default_ticker.toUpperCase()
            : current.default_ticker,
        active_persona_id:
          body.active_persona_id === null || typeof body.active_persona_id === 'string'
            ? body.active_persona_id
            : (current.active_persona_id ?? null),
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
    } catch {
      return refused('demo_unavailable', 'Local demo settings could not be saved.');
    }
  }

  if (pathname === '/api/book') {
    if (method === 'GET') {
      let blob: BookEnvelope['blob'];
      let updatedAt = stamp / 1000;
      try {
        initializeDemoWorkspace();
        blob = projectLocalBook();
        updatedAt = readTouchSeconds() ?? updatedAt;
      } catch {
        return refused('demo_unavailable', 'The local sample book is unreadable.');
      }
      const envelope: BookEnvelope = {
        schema_version: 1,
        updated_at: updatedAt,
        source: 'demo_local',
        blob,
      };
      return json(envelope);
    }
    try {
      const body = (await request.json()) as {
        schema_version?: number;
        updated_at?: number;
        blob?: BookEnvelope['blob'];
      };
      const blob = body.blob;
      if (!isBookBlob(blob))
        return refused('demo_unsupported', 'The local sample book payload is malformed.');
      const updatedAt =
        typeof body.updated_at === 'number' && Number.isFinite(body.updated_at)
          ? body.updated_at
          : stamp / 1000;
      initializeDemoWorkspace();
      mergeBookPut(blob, updatedAt);
      const envelope: BookEnvelope = {
        schema_version: 1,
        updated_at: updatedAt,
        source: 'demo_local',
        blob: projectLocalBook(),
      };
      return json(envelope);
    } catch {
      return refused('demo_unavailable', 'The local sample book could not be saved.');
    }
  }
  if (pathname === '/api/scan/view' && method === 'PUT') {
    try {
      readScanView();
      const body = (await request.json()) as Record<string, unknown>;
      const symbols = Array.isArray(body.symbols)
        ? body.symbols.filter(
            (s): s is string =>
              typeof s === 'string' && SYMBOLS.includes(s as (typeof SYMBOLS)[number]),
          )
        : SYMBOLS;
      const view = {
        authenticated: true,
        density: body.density === 'compact' ? 'compact' : 'comfortable',
        name: typeof body.name === 'string' ? body.name : null,
        sort: body.sort ?? { key: 'score', dir: 'desc' },
        source: 'demo_local',
        symbols,
      };
      writeStored('convexa.demo.scan.view.v1', view);
      return json(view);
    } catch {
      return refused('demo_unavailable', 'The local sample view could not be saved.');
    }
  }
  if (
    pathname === '/api/scan' ||
    pathname === '/api/scan/view' ||
    pathname === '/api/scan/universe'
  ) {
    const rows: ScanResponse['rows'] = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const sample = await loadScenario(symbol);
        const price = sample!.bars.at(-1)!.close;
        const variant = sample!.variants[EXPIRIES.join(',')];
        const putWall = Number((variant.wall - price * 0.075).toFixed(2));
        const nearerWall =
          Math.abs(price - variant.wall) <= Math.abs(price - putWall) ? variant.wall : putWall;
        return {
          symbol,
          status: 'ok',
          price,
          as_of: stamp / 1000,
          chg_pct: closeToClosePct(sample!.bars),
          call_wall: variant.wall,
          put_wall: putWall,
          flip: variant.flip,
          dist_to_flip_pct: Number((((price - variant.flip) / price) * 100).toFixed(2)),
          dist_to_wall_pct: Number((((price - nearerWall) / price) * 100).toFixed(2)),
          regime: 'positive_gamma',
          score: variant.score,
          tier: demoTier(variant.score),
          vol_regime: 'neutral',
          score_drivers: scoreDrivers(variant.score),
        };
      }),
    );
    let view: ScanView;
    try {
      view = readScanView();
    } catch {
      return refused('demo_unavailable', 'The local sample view is unreadable.');
    }
    if (pathname === '/api/scan/universe')
      return json({ symbols: SYMBOLS, universe_size: SYMBOLS.length, source: 'demo_local' });
    if (pathname === '/api/scan/view') return json(view);
    const response: ScanResponse = {
      market_data: 'sample',
      rows: rows.filter((row) => view.symbols.includes(row.symbol)),
      sweep: null,
      view,
    };
    return json(response);
  }
  if (pathname.endsWith('/history')) {
    const symbol = pathname.split('/')[3].toUpperCase();
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    const variant = scenario.variants[EXPIRIES.join(',')];
    const limitValue = Number(url.searchParams.get('limit') ?? 48);
    const limit =
      Number.isFinite(limitValue) && limitValue > 0 ? Math.min(96, Math.floor(limitValue)) : 48;
    const samples: StructureHistoryResponse['samples'] = scenario.bars.slice(-limit).map((bar) => ({
      symbol,
      as_of: Date.parse(`${bar.date}T16:00:00Z`) / 1000,
      price: bar.close,
      score: variant.score,
      tier: demoTier(variant.score),
      regime: 'positive_gamma',
      vol_regime: 'neutral',
      flip: variant.flip,
      dist_to_flip_pct: Number((((bar.close - variant.flip) / bar.close) * 100).toFixed(2)),
      call_wall: variant.wall,
      put_wall: Number((variant.wall - bar.close * 0.075).toFixed(2)),
      dist_to_wall_pct: ((variant.wall - bar.close) / bar.close) * 100,
      score_drivers: scoreDrivers(variant.score),
      net_gex: 20_000_000,
      iv_hv_ratio: 1.13,
      atm_iv: 26,
      hv_30d: 23,
    }));
    const history: StructureHistoryResponse = {
      symbol,
      samples,
      basis: 'Authored synthetic daily scenario snapshots; not live or stored history.',
      stored_count: scenario.bars.length,
      backend: 'scenario_catalog',
    };
    return json(history);
  }
  if (pathname === '/api/personas') {
    const personas: PersonaWire[] = [
      {
        id: 'sample-reviewer',
        name: 'Sample reviewer',
        version: 1,
        builtin: true,
        objective: 'directional_swing',
        risk: 'moderate',
        reassessment_lean: 'Reassess only when the authored sample structure changes.',
        dte_pref: JSON.stringify({ min_dte: 2, max_dte: 44 }),
      },
    ];
    return json(personas);
  }
  if (pathname === '/api/auth/ai-key') {
    const bootstrap: AiProvidersBootstrap = {
      storage_available: true,
      providers: ['anthropic', 'openai', 'xai', 'gemini'].map((provider) => ({
        provider: provider as AiProvidersBootstrap['providers'][number]['provider'],
        set: false,
        last4: null,
      })),
      grok: { available: false, connected: false, unavailable_reason: 'subscription_unavailable' },
      preference: { power_path: null, provider: null, model: null },
      catalog: { providers: [], grok_subscription: { provider: 'xai', models: [] } },
    };
    return json(bootstrap);
  }
  if (pathname === '/api/broker/credential')
    return json({ set: false, last4: null, storage_available: true });
  if (pathname === '/api/broker/book' || pathname === '/api/broker/book/refresh') {
    const sample: BrokerBook = {
      state: 'ok',
      basis: 'cache',
      account_ref: 'Demo sample account · synthetic',
      as_of: DEMO_TIME,
      positions: [
        {
          broker_position_id: 'demo-broker-aapl-equity',
          fidelity: 'exact',
          fidelity_notes: ['Authored sample holding; no brokerage connection.'],
          legs: [
            {
              kind: 'equity',
              symbol: 'AAPL',
              underlying: 'AAPL',
              quantity: 25,
              multiplier: 1,
              cost_basis: { state: 'supplied', value: 240 },
              broker_mark: { state: 'supplied', value: 265 },
            },
          ],
          unrealized_pl: { state: 'supplied', value: 625 },
        },
      ],
    };
    return json(sample);
  }
  if (pathname.startsWith('/api/recommendation/')) {
    const match = pathname.match(/^\/api\/recommendation\/(?:status\/|export\/)?([A-Z]+)$/i);
    if (!match)
      return refused(
        'demo_unavailable',
        'The recommendation route is not part of the local sample contract.',
      );
    const symbol = match[1].toUpperCase();
    const scenario = await loadScenario(symbol);
    if (!scenario) return refused('demo_unsupported', `No authored sample exists for ${symbol}.`);
    const isStatus = pathname.toLowerCase().startsWith('/api/recommendation/status/');
    const isExport = pathname.toLowerCase().startsWith('/api/recommendation/export/');
    if (isStatus) return json(recommendationStatus());
    let minDte: number | undefined;
    let maxDte: number | undefined;
    let requestBody: Record<string, unknown> = {};
    if (method === 'POST') {
      try {
        requestBody = (await request.json()) as Record<string, unknown>;
      } catch {
        return refused('demo_unsupported', 'The authored sample analysis request was malformed.');
      }
      minDte = typeof requestBody.dte_min === 'number' ? requestBody.dte_min : undefined;
      maxDte = typeof requestBody.dte_max === 'number' ? requestBody.dte_max : undefined;
    } else {
      minDte = url.searchParams.has('min_dte')
        ? Number(url.searchParams.get('min_dte'))
        : undefined;
      maxDte = url.searchParams.has('max_dte')
        ? Number(url.searchParams.get('max_dte'))
        : undefined;
    }
    const dteValidation = effectiveExpiries({ minDte, maxDte });
    if (dteValidation.state !== 'ready') return refused('demo_unavailable', dteValidation.detail);
    const requestedFingerprint =
      method === 'POST'
        ? requestBody.snapshot_fingerprint
        : isExport
          ? request.headers.get('x-convexa-sample-fingerprint')
          : null;
    let selected: { key: string; variant: (typeof scenario.variants)[string] } | undefined;
    if (typeof requestedFingerprint === 'string' && requestedFingerprint.length > 0) {
      const matches = Object.entries(scenario.variants).filter(
        ([, candidate]) => candidate.fingerprint === requestedFingerprint,
      );
      if (matches.length !== 1)
        return refused(
          'demo_unavailable',
          'The requested fingerprint is not a unique authored sample for this symbol.',
        );
      selected = { key: matches[0][0], variant: matches[0][1] };
      const dates = selected.key.split(',');
      if (
        dates.some(
          (date) =>
            !(date in DTE) ||
            (minDte !== undefined && DTE[date as keyof typeof DTE] < minDte) ||
            (maxDte !== undefined && DTE[date as keyof typeof DTE] > maxDte),
        )
      ) {
        return refused(
          'demo_unavailable',
          'The selected authored expiries do not fit the requested DTE bounds.',
        );
      }
    } else if (method === 'POST') {
      return refused(
        'demo_unavailable',
        'An exact authored sample fingerprint is required for analysis.',
      );
    } else {
      const projection = effectiveExpiries({ minDte, maxDte });
      if (projection.state !== 'ready') return refused('demo_unsupported', projection.detail);
      selected = { key: projection.key, variant: scenario.variants[projection.key] };
    }
    const variant = selected.variant;
    if (isExport) return json(recommendationExport(symbol, scenario, variant));
    if (method !== 'POST')
      return refused(
        'demo_unavailable',
        'The recommendation route is not part of the local sample contract.',
      );
    const personaId = typeof requestBody.persona_id === 'string' ? requestBody.persona_id : null;
    // The read cites the snapshot the desk draws for the same expiry set.
    const snapshot = tickerPayload(scenario, selected.key, selected.key.split(','));
    return json(recommendation(symbol, variant, personaId, snapshot));
  }
  if (pathname === '/api/positions/sim-trade/gate') {
    const body: components['schemas']['SimTradeGateBody'] = {
      authorized: canSimulatePaperAction(),
    };
    return json(body);
  }
  return refused('demo_unavailable', 'This sample capability is unavailable.');
}
