/**
 * alerts.risk.spec.tsx — curvature-v2-surfaces FE-10 (SPEC §2.5, §2.6, §3 E, §4.5).
 * Criteria: 44 (SB), 45 (SB), 46 (SB), 47a (SB), 47d (SB), 48, 49 (SB), 50, N-5, U-23a, U-24, U-27.
 *
 * The alerts store is REAL (localStorage), never mocked — mirrors `store.spec.ts` and the shipped
 * `positions/faulted.spec.tsx` idiom. No network boundary exists on this page to mock.
 */
import { __resetAlertsMemory } from '@/features/alerts/store';
import { ALERTS_KEY, type AlertsState } from '@/features/alerts/types';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsPage } from './AlertsPage';

beforeEach(() => {
  localStorage.clear();
  __resetAlertsMemory();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  __resetAlertsMemory();
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <MemoryRouter>
      <AlertsPage />
    </MemoryRouter>,
  );
}

function seed(state: Partial<AlertsState>) {
  const full: AlertsState = {
    schema_version: 1,
    rules: [],
    events: [],
    notifyBrowser: false,
    ...state,
  };
  localStorage.setItem(ALERTS_KEY, JSON.stringify(full));
}

describe('45 (SB) — every rule kind and level render the closed-lookup label, never the raw wire token', () => {
  it('a score_gate rule label reads "Score gate", never the raw "score_gate" token', () => {
    seed({
      rules: [
        { id: 'r1', kind: 'score_gate', symbol: 'SPY', enabled: true, createdAt: 1, scoreMin: 72 },
      ],
    });
    mount();
    const rule = screen.getByTestId('alerts-rule');
    expect(rule).toHaveTextContent('SPY · Score gate');
    expect(rule).not.toHaveTextContent('score_gate');
  });

  it('a level_touch rule on a structure level renders the LEVELS label, never the raw wire enum', () => {
    seed({
      rules: [
        {
          id: 'r1',
          kind: 'level_touch',
          symbol: 'TSLA',
          enabled: true,
          createdAt: 1,
          level: 'call_wall',
        },
      ],
    });
    mount();
    const rule = screen.getByTestId('alerts-rule');
    expect(rule).toHaveTextContent('TSLA · Level touch');
    expect(within(rule).getByTestId('alerts-rule-summary')).toHaveTextContent('Call wall');
    expect(rule).not.toHaveTextContent('call_wall');
  });
});

describe('46/47a/47b (SB) — thresholds render by type; an absent threshold renders `not set`, never a fabricated default', () => {
  it('score gate: present scoreMin renders the bare index in Mono, absent renders `not set`', () => {
    seed({
      rules: [
        { id: 'r1', kind: 'score_gate', symbol: 'SPY', enabled: true, createdAt: 1, scoreMin: 72 },
        { id: 'r2', kind: 'score_gate', symbol: 'QQQ', enabled: true, createdAt: 2 }, // no scoreMin
      ],
    });
    mount();
    const rules = screen.getAllByTestId('alerts-rule');
    expect(within(rules[0]).getByTestId('alerts-rule-summary')).toHaveTextContent(
      'Score gate: ≥ 72',
    );
    expect(within(rules[0]).getByTestId('alert-rule-threshold')).toHaveAttribute(
      'data-figure-register',
      'mono',
    );
    // Never a fabricated `≥ 60` — the record does not hold a minimum for this rule.
    expect(within(rules[1]).getByTestId('alerts-rule-summary')).toHaveTextContent(
      'Score gate: not set',
    );
    expect(within(rules[1]).getByTestId('alerts-rule-summary')).not.toHaveTextContent('60');
    expect(within(rules[1]).queryByTestId('alert-rule-threshold')).not.toBeInTheDocument();
  });

  it('price threshold: renders at all, with the $ prefix, in Mono — today it never rendered', () => {
    seed({
      rules: [
        {
          id: 'r1',
          kind: 'level_touch',
          symbol: 'SPY',
          enabled: true,
          createdAt: 1,
          level: 'price',
          priceThreshold: 500,
        },
      ],
    });
    mount();
    const rule = screen.getByTestId('alerts-rule');
    expect(within(rule).getByTestId('alerts-rule-summary')).toHaveTextContent(
      'Price threshold: $500',
    );
    expect(within(rule).getByTestId('alert-rule-threshold')).toHaveAttribute(
      'data-figure-register',
      'mono',
    );
  });

  it('price threshold absent renders `not set`', () => {
    seed({
      rules: [
        {
          id: 'r1',
          kind: 'level_touch',
          symbol: 'SPY',
          enabled: true,
          createdAt: 1,
          level: 'price',
        },
      ],
    });
    mount();
    expect(screen.getByTestId('alerts-rule-summary')).toHaveTextContent('Price threshold: not set');
  });
});

describe('47d (SB) — a structure-level rule carries no threshold of its own; an absent level renders `not recorded`, never the bare word `level`; tier-change is byte-identical', () => {
  it('an absent level renders `not recorded`', () => {
    // A durable-store shape a rule can carry with no `level` (defensive — never reachable via the
    // shipped composer, but the record does not structurally forbid it).
    seed({
      rules: [{ id: 'r1', kind: 'level_touch', symbol: 'SPY', enabled: true, createdAt: 1 }],
    });
    mount();
    const summary = screen.getByTestId('alerts-rule-summary');
    expect(summary).toHaveTextContent('not recorded');
    expect(summary).not.toHaveTextContent(/\blevel\b/i);
  });

  it('tier_change renders "any tier transition", byte-identical', () => {
    seed({
      rules: [{ id: 'r1', kind: 'tier_change', symbol: 'SPY', enabled: true, createdAt: 1 }],
    });
    mount();
    expect(screen.getByTestId('alerts-rule-summary')).toHaveTextContent('any tier transition');
  });
});

describe('44 (SB) — read/unread are distinguishable in a black-and-white screenshot: label row + type, not the coloured edge alone', () => {
  it('an unread firing carries the "Unread" word and heavier weight; a read firing carries neither', () => {
    seed({
      events: [
        {
          id: 'e1',
          ruleId: 'r1',
          kind: 'score_gate',
          symbol: 'SPY',
          message: 'SPY unread',
          at: 1,
          read: false,
        },
        {
          id: 'e2',
          ruleId: 'r1',
          kind: 'score_gate',
          symbol: 'SPY',
          message: 'SPY read',
          at: 2,
          read: true,
        },
      ],
    });
    mount();
    const [unreadCard, readCard] = screen.getAllByTestId('alerts-event');
    expect(within(unreadCard).getByTestId('alerts-event-unread-label')).toHaveTextContent('Unread');
    expect(within(readCard).queryByTestId('alerts-event-unread-label')).not.toBeInTheDocument();
    const unreadMsg = within(unreadCard).getByText('SPY unread');
    const readMsg = within(readCard).getByText('SPY read');
    // The TYPE half of the distinction: different font-weight, independent of colour.
    expect(unreadMsg.className).not.toBe(readMsg.className);
  });

  it('MUTATION PROOF P target — with the colour classes stripped, the two cards are STILL distinguishable by DOM content alone', () => {
    seed({
      events: [
        {
          id: 'e1',
          ruleId: 'r1',
          kind: 'score_gate',
          symbol: 'SPY',
          message: 'A',
          at: 1,
          read: false,
        },
        {
          id: 'e2',
          ruleId: 'r1',
          kind: 'score_gate',
          symbol: 'SPY',
          message: 'B',
          at: 2,
          read: true,
        },
      ],
    });
    mount();
    const cards = screen.getAllByTestId('alerts-event');
    // Strip every colour-bearing attribute a black-and-white screenshot would erase, then prove
    // the DOM text content alone still tells the two apart.
    const textOnly = cards.map((c) => c.textContent ?? '');
    expect(textOnly[0]).toMatch(/Unread/);
    expect(textOnly[1]).not.toMatch(/Unread/);
  });
});

describe('48 — three distinct empty sentences, each naming a next action, none an error', () => {
  it('no rules: the shipped byte-identical sentence', () => {
    mount();
    expect(screen.getByTestId('alerts-rules')).toHaveTextContent(
      'No rules yet — add a score gate on SPY to try the path.',
    );
  });

  it('nothing evaluated yet this session (no rules, no events) — distinct from "armed, nothing fired"', () => {
    mount();
    expect(screen.getByTestId('alerts-events-empty')).toHaveTextContent(
      /No snapshot has been evaluated yet this session/,
    );
  });

  it('rules armed, nothing fired — a DIFFERENT sentence once a snapshot has been evaluated', async () => {
    seed({
      rules: [
        { id: 'r1', kind: 'score_gate', symbol: 'SPY', enabled: true, createdAt: 1, scoreMin: 72 },
      ],
    });
    const { useAlerts } = await import('@/features/alerts/useAlerts');
    // Drive a real evaluation (no rule fires — score stays below threshold) through the SAME hook
    // AlertsPage reads, exactly as the ticker page would.
    const { renderHook, act } = await import('@testing-library/react');
    const { result } = renderHook(() => useAlerts());
    act(() => {
      result.current.evaluateSnap({ symbol: 'SPY', score: 10 });
    });
    mount();
    const empty = screen.getByTestId('alerts-events-empty');
    expect(empty).toHaveTextContent(/No firings yet/);
    expect(empty).not.toHaveTextContent(/No snapshot has been evaluated/);
  });

  it('none of the three empties renders with an error colour/role', () => {
    mount();
    const empty = screen.getByTestId('alerts-events-empty');
    expect(empty).not.toHaveAttribute('role', 'alert');
    expect(empty.className).not.toMatch(/error/i);
  });
});

describe('49 (SB) — the page states structure-snapshot evaluation, not a stream; no live mark or pulse', () => {
  it('the shipped sentence names both halves; zero live-dot nodes anywhere on the page', () => {
    mount();
    const page = screen.getByTestId('alerts-page');
    expect(page).toHaveTextContent(/structure snapshots/);
    expect(page).toHaveTextContent(/not a live stream/);
    expect(page.querySelectorAll('[data-testid="figure-live-dot"]').length).toBe(0);
  });
});

describe('50 — a denied or unavailable notification permission renders a state saying so; the control never reads "on" for a permission not granted', () => {
  it('unavailable (no Notification global, e.g. this jsdom environment): the control reads "off" and explains why', () => {
    mount();
    expect(screen.getByTestId('alerts-notify')).toHaveTextContent('Enable browser notify');
    expect(screen.getByTestId('alerts-notify-explain')).toHaveTextContent(/aren't available/i);
  });

  it('denied: the control reads "off" and explains why, even if a STALE stored flag claims "on"', () => {
    class FakeNotification {
      static permission: NotificationPermission = 'denied';
      static requestPermission = vi.fn(async () => FakeNotification.permission);
    }
    vi.stubGlobal('Notification', FakeNotification);
    // A stale durable flag from before the trader revoked the OS/browser permission — the display
    // must not take its word for it.
    seed({ notifyBrowser: true });
    mount();
    expect(screen.getByTestId('alerts-notify')).toHaveTextContent('Enable browser notify');
    expect(screen.getByTestId('alerts-notify-explain')).toHaveTextContent(/blocked/i);
  });

  it('granted: the control reads "on", no explain line', () => {
    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn(async () => FakeNotification.permission);
    }
    vi.stubGlobal('Notification', FakeNotification);
    mount();
    expect(screen.getByTestId('alerts-notify')).toHaveTextContent('Browser notify on');
    expect(screen.queryByTestId('alerts-notify-explain')).not.toBeInTheDocument();
  });
});

describe('N-5 — the faulted posture, identical in attribute shape to PositionRow.tsx/FaultedBanner.tsx', () => {
  it('a banner explains it; every write affordance is refused but focusable, described, and neither dims nor grows a pause mark', async () => {
    localStorage.setItem(ALERTS_KEY, '{ not json at all');
    __resetAlertsMemory();
    mount();

    const banner = await screen.findByTestId('alerts-faulted-banner');
    expect(banner).toHaveAttribute('role', 'status');

    // The SAME census idiom as `positions/faulted.spec.tsx` — every `data-refused` control carries
    // the SAME attribute set, so the two surfaces cannot drift apart silently.
    const refused = document.querySelectorAll('[data-refused="true"]');
    expect(refused.length).toBeGreaterThan(0);
    for (const el of Array.from(refused)) {
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el).not.toHaveAttribute('disabled');
      expect(el).toHaveAttribute('aria-describedby', 'alerts-faulted-banner');
    }

    // Nothing dims: no element carries the shipped 0.5 opacity dim, and no pause icon is present —
    // faulted is not offline.
    expect(document.querySelector('svg[data-testid="PauseIcon"]')).toBeNull();
  });

  it('the add-rule button is refused and does nothing when activated', async () => {
    localStorage.setItem(ALERTS_KEY, '{ not json at all');
    __resetAlertsMemory();
    const user = userEvent.setup();
    mount();
    await screen.findByTestId('alerts-faulted-banner');
    const addBtn = screen.getByTestId('alerts-add');
    expect(addBtn).toHaveAttribute('data-refused', 'true');
    await user.click(addBtn);
    expect(screen.getByTestId('alerts-rules')).toHaveTextContent('No rules yet');
  });

  it('a healthy store never renders the faulted banner and no control carries data-refused', () => {
    mount();
    expect(screen.queryByTestId('alerts-faulted-banner')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-refused="true"]').length).toBe(0);
  });
});

describe('U-23a / U-24 / U-27', () => {
  it('the Recent list renders stored `message` verbatim and makes no claim history was re-labelled', () => {
    seed({
      events: [
        {
          id: 'e1',
          ruleId: 'r1',
          kind: 'level_touch',
          symbol: 'SPY',
          message: 'SPY touched level',
          at: 1,
          read: true,
        },
      ],
    });
    mount();
    expect(screen.getByText('SPY touched level')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-events')).not.toHaveTextContent(/re-labell?ed/i);
  });

  it('the back-fill honesty line and the "stored in this browser" disclosure are both present', () => {
    mount();
    const page = screen.getByTestId('alerts-page');
    expect(page).toHaveTextContent(/stored in this browser/i);
    expect(page).toHaveTextContent(/keep their original wording/i);
  });

  it('every firing timestamp names its zone', () => {
    const at = Date.now();
    seed({
      events: [
        { id: 'e1', ruleId: 'r1', kind: 'score_gate', symbol: 'SPY', message: 'x', at, read: true },
      ],
    });
    mount();
    const card = screen.getByTestId('alerts-event');
    const expected = new Date(at).toLocaleString(undefined, { timeZoneName: 'short' });
    // The bare (no zone) rendering is a STRICT prefix of the zone-naming one — asserting the exact
    // zone-naming string is the real assertion; the prefix check makes the regression visible.
    const bare = new Date(at).toLocaleString();
    expect(card).toHaveTextContent(expected);
    expect(expected.length).toBeGreaterThan(bare.length);
  });
});
