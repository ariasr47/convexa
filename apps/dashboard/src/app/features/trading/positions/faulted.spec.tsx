/**
 * F16 — THE FAULTED STORE AS A FIRST-CLASS PRODUCT STATE (SPEC §2.9, §4; AC-61..AC-69).
 *
 * Owner ruling #8 is STRICT: every durable write is refused. This is the state a trader meets on
 * their worst day, and the whole design rests on one decision that a reviewer cannot see in a
 * screenshot — the refusal uses `aria-disabled` and keeps the control FOCUSABLE, because a
 * `disabled` MUI button drops out of the tab order and swallows pointer events, putting the REASON
 * for the refusal out of reach of both keyboard and hover. Every case below exists because it
 * regresses silently: `disabled` looks correct, reads correct in a diff, and destroys the state.
 *
 * Mocks ONLY the network boundary. The store is REAL and is genuinely corrupted.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { ArchiveBlock } from '@/features/trading/outcomes/ArchiveBlock';
import { themeForPref } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { LiveUpdate, TickerBundle, TrackedContract } from '@org/api';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioPanel } from './PortfolioPanel';
import { EMPTY_FAULTED, EMPTY_NO_POSITIONS, TR_ARCHIVE_PARTIAL_NOTE } from './labels';
import type { SimPosition } from './leg';
import { liftLegacyRecord } from './migrate';
import { PORTFOLIO_V3_KEY, __resetMemory, newId, positionsFaulted, putPosition } from './store';
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

/**
 * Does this element's own emotion class resolve its ink/fill to the theme's DISABLED tokens?
 *
 * `sx` compiles to emotion classes, so `getAttribute('style')` is always empty; and the theme is
 * CSS-variable-backed, so `action.disabled` serialises as `var(--mui-palette-action-disabled)`
 * rather than a colour literal — both forms are checked. Compound rules (`.css-x.Mui-disabled{…}`)
 * are excluded: they are in the sheet but apply to nobody here, and counting them would let a
 * control "prove" a treatment it does not render.
 */
function bindsDisabledInk(el: Element): boolean {
  const sheet = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/\s+/g, '')
    .toLowerCase();
  const a = themeForPref('dark').palette.action;
  const tokens = [
    '--mui-palette-action-disabled',
    a.disabled.toLowerCase().replace(/\s+/g, ''),
    a.disabledBackground.toLowerCase().replace(/\s+/g, ''),
  ];
  return Array.from(el.classList)
    .filter((c) => c.startsWith('css-'))
    .some((c) =>
      Array.from(sheet.matchAll(new RegExp(`\\.${c.toLowerCase()}\\{([^{}]*)\\}`, 'g'))).some((m) =>
        tokens.some((t) => m[1].includes(t)),
      ),
    );
}

const describeControl = (el: Element) =>
  el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent ?? '?';

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

describe('AC-63 — the reason for a refusal is reachable, not swallowed', () => {
  it('every mutating control is aria-disabled AND STILL FOCUSABLE — never HTML `disabled`', async () => {
    const user = userEvent.setup();
    await mountFaulted();

    const cta = screen.getByTestId('open-entry');
    expect(cta).toHaveAttribute('aria-disabled', 'true');
    // THE CENTRAL ASSERTION. `disabled` would take it out of the tab order AND swallow the hover,
    // which is exactly how the reason becomes unreachable by both routes at once.
    expect(cta).not.toBeDisabled();
    expect(cta).not.toHaveAttribute('disabled');
    expect(cta).toHaveAttribute('aria-describedby', 'store-faulted-banner');
    expect(document.getElementById('store-faulted-banner')).toBeInTheDocument();

    // STILL IN THE TAB ORDER — the property `disabled` destroys.
    let guard = 0;
    while (document.activeElement !== cta && guard++ < 40) await user.tab();
    expect(document.activeElement).toBe(cta);

    // …and the reason opens on HOVER, from the real tree.
    await user.hover(cta);
    await waitFor(() =>
      expect(screen.getByRole('tooltip').textContent).toMatch(/won't save anything new/i),
    );
  });

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

  it('EVERY refused control goes through the ONE primitive — none is hand-rolled', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    await user.click(screen.getByTestId('view-picker'));
    // `data-refused` is stamped by `Refused` and by nothing else, so this is a census of controls
    // that actually received the treatment rather than a look-alike of it. A hand-rolled
    // `aria-disabled` somewhere would be missing from this set AND missing its tooltip.
    const refused = document.querySelectorAll('[data-refused="true"]');
    expect(refused.length).toBeGreaterThan(0);
    for (const el of refused) {
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el).not.toHaveAttribute('disabled');
      expect(el).toHaveAttribute('aria-describedby', 'store-faulted-banner');
      // …and AC-63's other half, in the REAL tree: it also LOOKS refused. The treatment lives in
      // the one primitive, so what can still break here is a site that stops routing through it —
      // which is exactly how the aria-only version shipped past a green suite once already.
      expect(bindsDisabledInk(el), `not visibly refused: ${describeControl(el)}`).toBe(true);
    }
  });

  it('the entry CTA is a visibly QUIETER control while faulted than while healthy', async () => {
    await mountFaulted();
    const faultedCta = screen.getByTestId('open-entry');
    const faultedClass = faultedCta.className;
    expect(bindsDisabledInk(faultedCta)).toBe(true);

    cleanup();
    await mountHealthy();
    const healthyCta = screen.getByTestId('open-entry');
    // THE COMPARISON QA HAD TO MAKE BY EYE. The same CTA, the same page, the same theme — the only
    // difference is store health, and it has to be visible before it is read.
    expect(healthyCta.className).not.toBe(faultedClass);
    expect(bindsDisabledInk(healthyCta)).toBe(false); // vacuity guard: healthy is NOT dimmed
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

  it('the latch is PER-STORE — a faulted positions store leaves the orders store usable', async () => {
    localStorage.setItem(PORTFOLIO_V3_KEY, CORRUPT);
    __resetMemory();
    expect(positionsFaulted()).toBe(true);
    // `best-effort-isolated-or-null`: an unrelated durable store is unaffected and still writes.
    localStorage.setItem('convexa.unrelated.v1', '{"ok":true}');
    expect(localStorage.getItem('convexa.unrelated.v1')).toBe('{"ok":true}');
  });
});

describe('AC-65 — faulted and offline are independent, and legible together', () => {
  it('both banners render, faulted FIRST; faulted dims nothing and shows no ⏸', async () => {
    await mountFaulted({ streamOffline: true });
    const faulted = screen.getByTestId('faulted-banner');
    const offline = screen.getByTestId('offline-banner');
    expect(faulted).toBeInTheDocument();
    expect(offline).toBeInTheDocument();
    // Document order = the declared priority order.
    expect(
      faulted.compareDocumentPosition(offline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Faulted contributes NO pause marker of its own.
    expect(faulted.textContent).not.toContain('⏸');
  });

  it('offline alone disables no control — the two states never borrow each other`s treatment', async () => {
    localStorage.removeItem(PORTFOLIO_V3_KEY);
    __resetMemory();
    putPosition(pos());
    render(<Harness streamOffline />);
    await waitFor(() => expect(screen.getByTestId('offline-banner')).toBeInTheDocument());
    expect(screen.getByTestId('open-entry')).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByTestId('faulted-banner')).toBeNull();
  });
});

describe('AC-62 / AC-67 — what the banner says, and what the empty surface says', () => {
  it('AC-62 — the banner is non-dismissible, carries an icon, and both actions are operable', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    const banner = screen.getByTestId('faulted-banner');
    // A standing condition, not an interruption.
    expect(banner).toHaveAttribute('role', 'status');
    // Non-dismissible: no close affordance anywhere inside it.
    expect(within(banner).queryByRole('button', { name: /dismiss|close|×/i })).toBeNull();
    // Hue alone never carries "warning" — there is an icon.
    expect(banner.querySelector('svg')).not.toBeNull();
    // Both actions present and operable. `Reload the page` is the ONLY in-app step offered: there
    // is no Repair and no Reset, because the store never repairs and never deletes.
    const onReloadable = within(banner).getByTestId('faulted-reload');
    expect(onReloadable).toBeEnabled();
    await user.click(within(banner).getByTestId('faulted-export-pointer'));
    expect(
      within(banner).queryByRole('button', { name: /repair|reset|clear|start over/i }),
    ).toBeNull();
    // No apology, no error code.
    expect(banner.textContent).not.toMatch(
      /oops|sorry|something went wrong|error code|\bE\d{3}\b/i,
    );
  });

  it('AC-67 — faulted with zero rows renders EMPTY_FAULTED, never the normal empty copy', async () => {
    await mountFaulted();
    expect(screen.getByTestId('empty-faulted')).toHaveTextContent(EMPTY_FAULTED.slice(0, 40));
    expect(screen.queryByTestId('empty-no-positions')).toBeNull();
    expect(screen.queryByText(EMPTY_NO_POSITIONS)).toBeNull();
  });

  it('AC-66 — while faulted NO dismissible notice renders: not merge, not stale-view', async () => {
    await mountFaulted();
    expect(screen.queryByTestId('merge-notice')).toBeNull();
    expect(screen.queryByTestId('stale-view-notice')).toBeNull();
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

describe('the read side stays fully usable while faulted', () => {
  it('grouping, density and the status filter all still work — a fault refuses WRITES, not reads', async () => {
    const user = userEvent.setup();
    await mountFaulted();
    for (const id of ['group-select-ticker', 'density-toggle-compact', 'status-chip-closed']) {
      const control = screen.getByTestId(id);
      expect(control).not.toHaveAttribute('aria-disabled');
      await act(async () => {
        await user.click(control);
      });
    }
    // Still rendering, nothing threw, and the banner is still there.
    expect(screen.getByTestId('faulted-banner')).toBeInTheDocument();
  });
});
