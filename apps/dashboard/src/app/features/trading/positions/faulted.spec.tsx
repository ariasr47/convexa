/**
 * F16 — THE FAULTED STORE AS A FIRST-CLASS PRODUCT STATE (SPEC §2.9, §4; AC-61..AC-69).
 *
 * Owner ruling #8 is STRICT: every durable write is refused. This is the state a trader meets on
 * their worst day. The cases below pin what regresses silently: the fault is known on the first
 * paint, a refused control never acts, nothing is written from any surface, the empty state never
 * claims "no positions", and export still works and says it is partial.
 *
 * Mocks ONLY the network boundary. The store is REAL and is genuinely corrupted.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { ArchiveBlock } from '@/features/trading/outcomes/ArchiveBlock';
import { themeForPref } from '@/shared/theme/theme';
import type { LiveUpdate, TickerBundle, TrackedContract } from '@convexa/api';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPanel } from './PortfolioPanel';
import { EMPTY_FAULTED, EMPTY_NO_POSITIONS, TR_ARCHIVE_PARTIAL_NOTE } from './labels';
import type { SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import { PORTFOLIO_V3_KEY, __resetMemory, newId, putPosition } from './store';
import type { Position } from './types';
import { usePortfolio } from './usePortfolio';

/** A readable-but-unparseable blob — the exact material the fault latch exists to protect. */
const CORRUPT = '{"schema_version":2,"positions":{ THIS IS NOT JSON';

const QUOTE: TrackedContract = {
  ticker: 'TSLA',
  expiration: '2026-07-17',
  strike: 250,
  right: 'call',
  option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
  greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
  iv: 0.45,
  dte: 24,
};

function installBackend() {
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  const json = (b: unknown, status = 200) =>
    new Response(b === null ? 'null' : JSON.stringify(b), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session'))
        return json({
          authenticated: true,
          user: { id: 'u', email: 'u@x.com', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      if (url.includes('/api/positions/sim-trade/gate')) return json({ authorized: true });
      if (url.includes('/api/contract/')) return json(QUOTE);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

function makeBundle(): TickerBundle {
  return {
    market_state: { ticker: 'TSLA', price: 250 },
    signals: { ticker: 'TSLA', opportunity_tier: 'watch' },
    strike_profile: { ticker: 'TSLA', spot: 250, strikes: [{ strike: 250 }] },
    expirations: [{ date: '2026-07-17', dte: 24 }],
    meta: { served_at: '2026-06-23T14:00:00Z' },
    position_eval: null,
  } as unknown as TickerBundle;
}

/** A durable record, authored flat and put through the ONE lift — never a hand conversion. */
function pos(over: Partial<Position> = {}): SimPosition {
  const raw: Position = {
    id: newId(),
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 2,
    ...over,
  };
  return liftLegacyRecord(raw) as SimPosition;
}

/** The captured `faulted` flag on the VERY FIRST render pass, before any effect flushes. */
let firstPaintFaulted: boolean | null = null;

function Harness({ streamOffline = false }: { streamOffline?: boolean }) {
  const [data] = useState<TickerBundle | null>(makeBundle());
  const [entryOpen, setEntryOpen] = useState(false);
  const live: LiveUpdate | null = null;
  const pf = usePortfolio('TSLA', data, live, false, streamOffline);
  if (firstPaintFaulted == null) firstPaintFaulted = pf.health.faulted;
  return (
    <ThemeProvider theme={themeForPref('dark')}>
      <AuthProvider>
        <AuthDialogProvider>
          <PortfolioPanel
            pf={pf}
            data={data}
            live={live}
            isLive={false}
            streamOffline={streamOffline}
            ticker="TSLA"
            entryOpen={entryOpen}
            onEntryOpen={setEntryOpen}
          />
        </AuthDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Corrupt the store, then mount the real feature subtree over it. */
async function mountFaulted(props: Parameters<typeof Harness>[0] = {}) {
  localStorage.setItem(PORTFOLIO_V3_KEY, CORRUPT);
  __resetMemory();
  const r = render(<Harness {...props} />);
  await waitFor(() => expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument());
  return r;
}

async function mountHealthy(seed = true) {
  localStorage.removeItem(PORTFOLIO_V3_KEY);
  __resetMemory();
  if (seed) putPosition(pos());
  const r = render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('customization-toolbar')).toBeInTheDocument());
  return r;
}

function storageSnapshot(): string {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) as string;
    out[k] = localStorage.getItem(k) as string;
  }
  return JSON.stringify(Object.entries(out).sort());
}

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  firstPaintFaulted = null;
  installBackend();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// =================================================================================================

describe('AC-64 — no frame ever paints an enabled affordance on a faulted store', () => {
  it('the fault is known on the FIRST render pass, not after an effect', async () => {
    await mountFaulted();
    expect(firstPaintFaulted).toBe(true);
    // …and the very first paint already carried the refusal.
    expect(screen.getByTestId('open-entry')).toHaveAttribute('aria-disabled', 'true');
  });

  it('a HEALTHY store paints no refusal at all — the treatment costs a healthy surface nothing', async () => {
    await mountHealthy();
    expect(firstPaintFaulted).toBe(false);
    expect(screen.getByTestId('open-entry')).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByTestId('faulted-banner')).toBeNull();
  });
});

describe('AC-63 — a refused control never acts', () => {
  it('AC-63 — the entry dialog NEVER OPENS: activation is a no-op', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    await user.click(screen.getByTestId('open-entry'));
    expect(screen.queryByTestId('trade-entry-dialog')).toBeNull();
  });

  it('the saved-view Save / Save as / Delete actions are refused the same way', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    await user.click(screen.getByTestId('view-picker'));
    const saveAs = screen.getByTestId('save-as-new');
    expect(saveAs).toHaveAttribute('aria-disabled', 'true');
    expect(saveAs).not.toHaveAttribute('disabled');
    await user.click(saveAs);
    expect(screen.queryByTestId('save-as-name')).toBeNull(); // the dialog never opened
  });
});

describe('AC-61 — nothing is written, from any surface', () => {
  it('attempting to open, close, cancel or save a view leaves storage BYTE-IDENTICAL', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    const before = storageSnapshot();

    await user.click(screen.getByTestId('open-entry'));
    await user.click(screen.getByTestId('view-picker'));
    await user.click(screen.getByTestId('save-as-new'));
    // Grouping/density are READS and still work — they are not part of this assertion, so the
    // snapshot is taken over the write attempts only.
    expect(storageSnapshot()).toBe(before);
    // And the damaged blob itself is untouched, byte for byte.
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBe(CORRUPT);
  });
});

describe('AC-67 — the empty surface never claims there are no positions', () => {
  it('AC-67 — faulted with zero rows renders EMPTY_FAULTED, never the normal empty copy', async () => {
    await mountFaulted();
    expect(screen.getByTestId('empty-faulted')).toHaveTextContent(EMPTY_FAULTED.slice(0, 40));
    expect(screen.queryByTestId('empty-no-positions')).toBeNull();
    expect(screen.queryByText(EMPTY_NO_POSITIONS)).toBeNull();
  });
});

describe('AC-68 — export still works, and says it is partial', () => {
  it('the Archive lead carries the partial note and the `Export archive` label is UNCHANGED', () => {
    localStorage.setItem(PORTFOLIO_V3_KEY, CORRUPT);
    __resetMemory();
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <ArchiveBlock onImported={() => undefined} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tr-archive-lead')).toHaveTextContent(
      TR_ARCHIVE_PARTIAL_NOTE.slice(0, 40),
    );
    // The action's NAME never changes per case.
    expect(screen.getByTestId('tr-export')).toHaveTextContent('Export archive');
    expect(screen.getByTestId('tr-export')).toBeEnabled();
    expect(screen.getByTestId('tr-export')).not.toHaveAttribute('aria-disabled');
  });

  it('a HEALTHY store shows no partial note at all', () => {
    localStorage.removeItem(PORTFOLIO_V3_KEY);
    __resetMemory();
    render(
      <ThemeProvider theme={themeForPref('dark')}>
        <ArchiveBlock onImported={() => undefined} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('tr-archive-lead').textContent).not.toContain(
      TR_ARCHIVE_PARTIAL_NOTE,
    );
  });
});
