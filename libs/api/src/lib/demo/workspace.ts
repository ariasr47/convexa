import { loadScenario, sampleContractMark, type ScenarioSymbol } from './catalog';
import { dataMode, demoStorageKey, type SupportedDemoSymbol } from './mode';

export interface DemoClock {
  anchor: '2026-10-07T18:30:00Z';
  end: '2026-10-07T19:00:00Z';
  offsetMs: number;
  nowMs: number;
  playback: 'running' | 'paused' | 'ended';
}
export interface DemoOrderFrame {
  frameId: string;
  scenarioTimeMs: number;
  symbol: SupportedDemoSymbol;
  underlyingMid: number;
  marksByContractId: Record<string, number>;
}
export type Unsubscribe = () => void;
const noopUnsubscribe: Unsubscribe = () => undefined;
const ANCHOR = Date.parse('2026-10-07T18:30:00Z');
const DURATION = 30 * 60_000;
const demoPrefix = 'convexa.demo.v1.';
let offset = 0;
let playback: DemoClock['playback'] = 'running';
let storageUnavailable = false;
let interval: ReturnType<typeof setInterval> | undefined;
let frameGeneration = 0;
let frameRunPending = false;
const observers = new Set<(clock: DemoClock) => void>();
const frameObservers = new Set<(frame: DemoOrderFrame) => void>();
const clockValue = (): DemoClock => ({
  anchor: '2026-10-07T18:30:00Z',
  end: '2026-10-07T19:00:00Z',
  offsetMs: offset,
  nowMs: ANCHOR + offset,
  playback,
});
function emitClock() {
  const value = clockValue();
  for (const observer of observers) observer(value);
}
function stopTimer() {
  if (interval) clearInterval(interval);
  interval = undefined;
}
function invalidateFrames() {
  frameGeneration++;
}
function pauseForStorageFault() {
  storageUnavailable = true;
  playback = 'paused';
  invalidateFrames();
  stopTimer();
  emitClock();
}
function startTimer() {
  if (interval || observers.size + frameObservers.size === 0 || playback !== 'running') return;
  interval = setInterval(() => {
    offset = Math.min(DURATION, offset + 5_000);
    if (offset >= DURATION) {
      playback = 'ended';
      invalidateFrames();
      stopTimer();
    }
    emitClock();
    if (!frameRunPending && playback === 'running')
      void emitFrames(frameGeneration, clockValue(), [...frameObservers]);
  }, 1000);
}
function frameRunIsCurrent(
  generation: number,
  recipients: readonly ((frame: DemoOrderFrame) => void)[],
): boolean {
  return (
    playback === 'running' &&
    frameGeneration === generation &&
    recipients.length > 0 &&
    recipients.every((observer) => frameObservers.has(observer))
  );
}
function frameSnapshotIsCurrent(
  generation: number,
  frameClock: DemoClock,
  recipients: readonly ((frame: DemoOrderFrame) => void)[],
): boolean {
  return frameRunIsCurrent(generation, recipients) && offset === frameClock.offsetMs;
}
async function emitFrames(
  generation: number,
  frameClock: DemoClock,
  recipients: readonly ((frame: DemoOrderFrame) => void)[],
) {
  if (frameRunPending || !frameSnapshotIsCurrent(generation, frameClock, recipients)) return;
  frameRunPending = true;
  try {
    const loaded: { symbol: SupportedDemoSymbol; scenario: ScenarioSymbol }[] = [];
    for (const symbol of ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'] as const) {
      let scenario;
      try {
        scenario = await loadScenario(symbol);
      } catch {
        if (frameRunIsCurrent(generation, recipients)) {
          playback = 'paused';
          invalidateFrames();
          stopTimer();
          emitClock();
        }
        return;
      }
      if (!frameSnapshotIsCurrent(generation, frameClock, recipients)) return;
      if (scenario) loaded.push({ symbol, scenario });
    }
    for (const { symbol, scenario } of loaded) {
      if (!frameSnapshotIsCurrent(generation, frameClock, recipients)) return;
      const spot = Number(
        (scenario.bars.at(-1)!.close * (1 + (frameClock.offsetMs / DURATION) * 0.001)).toFixed(2),
      );
      const marks: Record<string, number> = {};
      for (const expiration of ['2026-10-09', '2026-10-16', '2026-11-20']) {
        const seededStrikes = symbol === 'SPY' ? [690] : symbol === 'QQQ' ? [630] : [];
        for (const strike of [
          ...new Set([
            ...seededStrikes,
            Math.floor(spot / 5) * 5 - 5,
            Math.floor(spot / 5) * 5,
            Math.floor(spot / 5) * 5 + 5,
          ]),
        ]) {
          for (const right of ['call', 'put'] as const) {
            const dte = expiration === '2026-10-09' ? 2 : expiration === '2026-10-16' ? 9 : 44;
            marks[`${symbol}|${expiration}|${strike}|${right}`] = sampleContractMark(
              spot,
              strike,
              right,
              dte,
            );
          }
        }
      }
      const frame: DemoOrderFrame = Object.freeze({
        frameId: `${symbol}-${frameClock.offsetMs}`,
        scenarioTimeMs: frameClock.nowMs,
        symbol,
        underlyingMid: spot,
        marksByContractId: Object.freeze(marks),
      });
      for (const observer of recipients) {
        if (!frameSnapshotIsCurrent(generation, frameClock, recipients)) return;
        observer(frame);
      }
    }
  } finally {
    frameRunPending = false;
  }
}
export function demoClock(): DemoClock | null {
  return dataMode === 'demo' ? clockValue() : null;
}
export function subscribeDemoClock(onState: (state: DemoClock) => void): Unsubscribe {
  if (dataMode !== 'demo') return noopUnsubscribe;
  observers.add(onState);
  onState(clockValue());
  startTimer();
  return () => {
    observers.delete(onState);
    if (observers.size + frameObservers.size === 0) stopTimer();
  };
}
export function subscribeDemoOrderFrames(onFrame: (frame: DemoOrderFrame) => void): Unsubscribe {
  if (dataMode !== 'demo') return noopUnsubscribe;
  frameObservers.add(onFrame);
  invalidateFrames();
  startTimer();
  return () => {
    if (frameObservers.delete(onFrame)) invalidateFrames();
    if (observers.size + frameObservers.size === 0) stopTimer();
  };
}
export function resumeDemoPlayback() {
  if (dataMode !== 'demo' || playback !== 'paused') return;
  if (storageUnavailable) initializeDemoWorkspace();
  if (storageUnavailable) return;
  playback = 'running';
  invalidateFrames();
  emitClock();
  startTimer();
}
export function demoNowMs() {
  return dataMode === 'demo' ? ANCHOR + offset : Date.now();
}
export function canSimulatePaperAction() {
  return dataMode === 'demo' && playback === 'running';
}

export function initializeDemoWorkspace(): void {
  if (dataMode !== 'demo' || typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    const sentinel = demoStorageKey('convexa.demo.workspace.initialized.v1');
    storageUnavailable = false;
    if (storage.getItem(sentinel) !== null) return;
    const seed: Record<string, unknown> = {
      'convexa.positions.v3': {
        schema_version: 3,
        positions: {
          'demo-position-spy-oct16-690c': {
            id: 'demo-position-spy-oct16-690c',
            schema_version: 3,
            opened_time: '2026-10-07T18:25:00Z',
            status: 'open',
            entry_mode: 'market',
            origin_order_id: 'demo-order-spy-filled',
            legs: [
              {
                id: 'demo-leg-spy-oct16-690c',
                kind: 'option',
                ticker: 'SPY',
                side: 'long',
                qty: 1,
                multiplier: 100,
                entry_price: 3,
                entry_basis: 'trigger_fill',
                expiration: '2026-10-16',
                strike: 690,
                right: 'call',
              },
            ],
          },
          'demo-position-qqq-oct09-630c': {
            id: 'demo-position-qqq-oct09-630c',
            schema_version: 3,
            opened_time: '2026-10-07T17:30:00Z',
            status: 'closed',
            entry_mode: 'market',
            close_time: '2026-10-07T18:20:00Z',
            realized_pl_dollar: 48,
            realized_pl_pct: 20,
            legs: [
              {
                id: 'demo-leg-qqq-oct09-630c',
                kind: 'option',
                ticker: 'QQQ',
                side: 'long',
                qty: 1,
                multiplier: 100,
                entry_price: 2.4,
                entry_basis: 'snapshot',
                expiration: '2026-10-09',
                strike: 630,
                right: 'call',
              },
            ],
          },
        },
        decisions: [
          {
            id: 'demo-decision-spy-order-placed',
            schema_version: 1,
            event_type: 'order_placed',
            clock_time: '2026-10-07T18:24:00Z',
            trade_id: 'demo-order-spy-filled',
            contract: {
              ticker: 'SPY',
              expiration: '2026-10-16',
              strike: 690,
              right: 'call',
              qty: 1,
            },
            mark_price: 3,
            mark_basis: 'snapshot',
            underlying_spot: 691.15,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:spy-order-placed',
          },
          {
            id: 'demo-decision-spy-order-triggered',
            schema_version: 1,
            event_type: 'order_triggered',
            clock_time: '2026-10-07T18:24:00Z',
            trade_id: 'demo-order-spy-filled',
            contract: {
              ticker: 'SPY',
              expiration: '2026-10-16',
              strike: 690,
              right: 'call',
              qty: 1,
            },
            mark_price: 3,
            mark_basis: 'snapshot',
            underlying_spot: 691.15,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:spy-order-triggered',
          },
          {
            id: 'demo-decision-spy-order-filled',
            schema_version: 1,
            event_type: 'order_filled',
            clock_time: '2026-10-07T18:25:00Z',
            trade_id: 'demo-order-spy-filled',
            position_id: 'demo-position-spy-oct16-690c',
            contract: {
              ticker: 'SPY',
              expiration: '2026-10-16',
              strike: 690,
              right: 'call',
              qty: 1,
            },
            mark_price: 3,
            mark_basis: 'snapshot',
            underlying_spot: 691.15,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:spy-order-filled',
          },
          {
            id: 'demo-decision-spy-open',
            schema_version: 1,
            event_type: 'open',
            clock_time: '2026-10-07T18:25:00Z',
            trade_id: 'demo-position-spy-oct16-690c',
            contract: {
              ticker: 'SPY',
              expiration: '2026-10-16',
              strike: 690,
              right: 'call',
              qty: 1,
            },
            mark_price: 3,
            mark_basis: 'snapshot',
            underlying_spot: 691.15,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:spy-open',
          },
          {
            id: 'demo-decision-qqq-open',
            schema_version: 1,
            event_type: 'open',
            clock_time: '2026-10-07T17:30:00Z',
            trade_id: 'demo-position-qqq-oct09-630c',
            contract: {
              ticker: 'QQQ',
              expiration: '2026-10-09',
              strike: 630,
              right: 'call',
              qty: 1,
            },
            mark_price: 2.4,
            mark_basis: 'snapshot',
            underlying_spot: 631.42,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:qqq-open',
          },
          {
            id: 'demo-decision-qqq-close',
            schema_version: 1,
            event_type: 'close',
            clock_time: '2026-10-07T18:20:00Z',
            trade_id: 'demo-position-qqq-oct09-630c',
            contract: {
              ticker: 'QQQ',
              expiration: '2026-10-09',
              strike: 630,
              right: 'call',
              qty: 1,
            },
            mark_price: 2.88,
            mark_basis: 'snapshot',
            underlying_spot: 631.9,
            pl_dollar: 48,
            pl_pct: 20,
            tier: 'watch',
            position_fingerprint: 'demo:qqq-close',
          },
          {
            id: 'demo-decision-spy-pending-placed',
            schema_version: 1,
            event_type: 'order_placed',
            clock_time: '2026-10-07T18:30:00Z',
            trade_id: 'demo-order-spy-nov20-limit',
            contract: {
              ticker: 'SPY',
              expiration: '2026-11-20',
              strike: 690,
              right: 'call',
              qty: 1,
            },
            mark_price: 4.47,
            mark_basis: 'snapshot',
            underlying_spot: 690.62,
            pl_dollar: 0,
            pl_pct: 0,
            tier: 'watch',
            position_fingerprint: 'demo:spy-pending-placed',
          },
        ],
        customization: {
          views: [
            {
              id: 'view-all-positions',
              name: 'All positions',
              builtin: true,
              config: {
                columns: [
                  'contract',
                  'structure',
                  'qty',
                  'entry',
                  'mark',
                  'pl',
                  'pl_pct',
                  'delta_entry',
                  'trend',
                  'max_loss',
                  'expiry',
                ],
                sortKey: 'pl_dollar',
                sortDir: 'desc',
                group: 'none',
                layout: 'table',
                density: 'comfortable',
                filter: { ticker: null, status: ['open'], structure: null, expiry: null },
              },
            },
          ],
          activeViewId: 'view-all-positions',
          working: {
            columns: [
              'contract',
              'structure',
              'qty',
              'entry',
              'mark',
              'pl',
              'pl_pct',
              'delta_entry',
              'trend',
              'max_loss',
              'expiry',
            ],
            sortKey: 'pl_dollar',
            sortDir: 'desc',
            group: 'none',
            layout: 'table',
            density: 'comfortable',
            filter: { ticker: null, status: ['open'], structure: null, expiry: null },
          },
        },
      },
      'convexa.orders.v1': {
        schema_version: 1,
        orders: {
          'demo-order-spy-filled': {
            id: 'demo-order-spy-filled',
            schema_version: 1,
            created_time: '2026-10-07T18:24:00Z',
            ticker: 'SPY',
            expiration: '2026-10-16',
            strike: 690,
            right: 'call',
            side: 'long',
            qty: 1,
            trigger: null,
            limit_price: null,
            stop: null,
            target: null,
            expires_at: '2026-10-16T20:00:00Z',
            provenance: { source: 'manual' },
            status: 'filled',
            triggered_time: '2026-10-07T18:24:00Z',
            filled_time: '2026-10-07T18:25:00Z',
            fill_mark: 3,
            fill_basis: 'trigger_fill',
            position_id: 'demo-position-spy-oct16-690c',
          },
          'demo-order-spy-nov20-limit': {
            id: 'demo-order-spy-nov20-limit',
            schema_version: 1,
            created_time: '2026-10-07T18:30:00Z',
            ticker: 'SPY',
            expiration: '2026-11-20',
            strike: 690,
            right: 'call',
            side: 'long',
            qty: 1,
            trigger: null,
            limit_price: 6.5,
            stop: null,
            target: null,
            expires_at: '2026-11-20T21:00:00Z',
            provenance: { source: 'manual' },
            status: 'triggered',
            triggered_time: '2026-10-07T18:30:00Z',
          },
        },
      },
      'convexa.alerts.v1': {
        schema_version: 1,
        rules: [
          {
            id: 'demo-alert-spy-flip',
            kind: 'level_touch',
            symbol: 'SPY',
            enabled: true,
            createdAt: ANCHOR,
            level: 'gamma_flip',
            note: 'Watch the authored sample flip',
          },
        ],
        events: [],
        notifyBrowser: false,
      },
      'convexa.personas.v1': {
        schema_version: 1,
        customs: [
          {
            id: 'demo-careful-reader',
            name: 'Careful sample reader',
            builtin: false,
            version: 1,
            objective: 'directional_swing',
            risk: 'conservative',
            reassessment_lean: 'Recheck the sample thesis when its stated invalidation is reached.',
            emphasis_note: 'Authored educational scenario.',
            dte_pref: { min_dte: 2, max_dte: 44 },
          },
        ],
        active_persona_id: 'demo-careful-reader',
      },
      'convexa.uiprefs.v1': { schema_version: 1, theme: 'dark', default_ticker: 'SPY' },
      'convexa.theme-paint': 'dark',
      'convexa.positions.touch_at': '1791397800',
      'convexa.recent-tickers.v1': { schema_version: 1, symbols: ['AAPL', 'MSFT', 'TSLA'] },
    };
    for (const [key, value] of Object.entries(seed)) {
      const resolved = demoStorageKey(key);
      if (storage.getItem(resolved) === null)
        storage.setItem(
          resolved,
          key === 'convexa.theme-paint' || key === 'convexa.positions.touch_at'
            ? String(value)
            : JSON.stringify(value),
        );
    }
    storage.setItem(sentinel, '1');
    storageUnavailable = false;
  } catch {
    /* A storage fault cannot authorize replacing bytes or falling through to live storage. */ pauseForStorageFault();
  }
}
export function resetDemoWorkspace(): void {
  if (dataMode !== 'demo' || typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(demoPrefix)) storage.removeItem(key);
    }
    window.location.reload();
  } catch {
    /* storage access failure cannot authorize clearing live or legacy keys */ pauseForStorageFault();
  }
}
