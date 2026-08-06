import { expect, test, type Page } from '@playwright/test';

/**
 * broker-connect e2e (F8) — risk-based, NOT a state-machine mirror: the nine states live in the
 * component suite (`BrokerTabPanel.spec.tsx`); here the real browser proves the seams the jsdom
 * tier can't — the auth carve-out at the tab, the honest S1 (never an empty table), the
 * forbidden-word rule over REAL rendered text, and the 393px floor.
 *
 * Network fully stubbed (the suite's standing idiom — no live backend): the signed-in arms use
 * the deterministic fresh-session/no-credential wire, exactly what a throwaway `--auth-signup`
 * account returns from the stub provider.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 393, height: 851 };

const NO_CREDENTIAL_BOOK = {
  state: 'unknown',
  reason: 'no_credential_stored',
  positions: [],
};

/** A served one-position book (equity-only, so no /api/contract dependency in the mark path). */
function servedBook() {
  const asOf = new Date(Date.now() - 30_000).toISOString();
  return {
    state: 'ok',
    as_of: asOf,
    basis: 'fresh',
    stale_after_seconds: 300,
    account_ref: 'acctref0123456789',
    positions: [
      {
        broker_position_id: 'bp-e2e-1',
        fidelity: 'exact',
        legs: [
          {
            kind: 'equity',
            symbol: 'TSLA',
            underlying: 'TSLA',
            quantity: 100,
            multiplier: 1,
            cost_basis: { state: 'supplied', value: 242.1 },
            broker_mark: { state: 'supplied', value: 250.4 },
          },
        ],
        unrealized_pl: { state: 'not_supplied' },
      },
    ],
    last_attempt_at: asOf,
    last_attempt_outcome: 'ok',
  };
}

async function stubNetwork(
  page: Page,
  opts: { authenticated: boolean; book?: unknown; onBrokerCall?: () => void },
) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/broker/')) opts.onBrokerCall?.();

    if (path.startsWith('/api/auth/session')) {
      return route.fulfill({
        json: opts.authenticated
          ? {
              authenticated: true,
              user: { id: 'u', email: 'o@x.y', display_name: null, auth_methods: ['password'] },
              google_available: false,
              settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
            }
          : { authenticated: false, user: null, google_available: false, settings: null },
      });
    }
    if (path.startsWith('/api/broker/credential')) {
      return route.fulfill({ json: { set: false, last4: null, storage_available: true } });
    }
    if (path.startsWith('/api/broker/book')) {
      return route.fulfill({ json: opts.book ?? NO_CREDENTIAL_BOOK });
    }
    if (path.startsWith('/api/ticker/')) {
      return route.fulfill({
        json: {
          market_state: { ticker: 'TSLA', price: 250, gex_spot: 250, timestamp: 1 },
          signals: {
            ticker: 'TSLA',
            regime: 'positive_gamma',
            regime_note: null,
            vol_regime: 'neutral',
            distances: {},
            setups: [],
            opportunity_score: 42,
            opportunity_tier: 'watch',
            prime_prompt_eligible: false,
          },
          strike_profile: { ticker: 'TSLA', spot: 250, strikes: [] },
          expirations: [],
          ai_eval: {
            ready: true,
            reasons: [],
            changed: true,
            state_fingerprint: 'fp',
            score_threshold: 50,
          },
          meta: {
            served_at: new Date().toISOString(),
            cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
            freshness: {
              snapshot_iso: new Date().toISOString(),
              data_age_seconds: 10,
              stale: false,
              stale_after_seconds: 600,
            },
          },
          off_exchange: null,
          position_eval: null,
        },
      });
    }
    if (path.startsWith('/api/recommendation/status/')) {
      return route.fulfill({
        json: {
          availability: { in_app_enabled: false },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 0, resets_at: '2026-08-03T04:00:00Z' },
        },
      });
    }
    if (path.startsWith('/api/personas')) {
      return route.fulfill({ json: [{ id: 'default', name: 'Default (no persona)' }] });
    }
    if (path.startsWith('/api/contract/')) return route.fulfill({ status: 404, body: '' });
    return route.fallback();
  });
}

test.describe('broker tab', () => {
  // OWNER LOCKDOWN (2026-08-06): `/positions` is behind `RequireAuth`, so signed out you now get
  // the ROUTE wall and the Broker tab is never reachable. The in-tab `broker-signin-prompt` still
  // exists for the case where a session expires while the page is open; it is simply no longer the
  // signed-out ENTRY path. The security half of this test is unchanged and now stronger: a
  // signed-out visitor issues NO broker request, because the page that would issue it never mounts.
  test('signed out: the route wall stands in front of the Broker tab and NO broker request is issued', async ({
    page,
  }) => {
    let brokerCalls = 0;
    await stubNetwork(page, { authenticated: false, onBrokerCall: () => (brokerCalls += 1) });
    await page.setViewportSize(DESKTOP);
    await page.goto('/positions');
    await expect(page.getByTestId('require-auth-wall')).toBeVisible();
    await expect(page.getByTestId('tab-live')).toHaveCount(0);
    expect(brokerCalls).toBe(0);
  });

  test('signed in, no credential: the honest S1 not-connected state — never an empty table', async ({
    page,
  }) => {
    await stubNetwork(page, { authenticated: true });
    await page.setViewportSize(DESKTOP);
    await page.goto('/positions');
    await page.getByTestId('tab-live').click();
    await expect(page.getByTestId('broker-s1')).toBeVisible();
    await expect(page.getByText('Connect your brokerage')).toBeVisible();
    await expect(page.getByTestId('broker-connect-cta')).toBeVisible();
    await expect(page.getByTestId('broker-row')).toHaveCount(0);
    await expect(page.getByTestId('broker-count')).toHaveCount(0); // no zero-count claim
  });

  test('a populated tab never claims `live`: the freshness word appears only inside the negation phrase', async ({
    page,
  }) => {
    await stubNetwork(page, { authenticated: true, book: servedBook() });
    await page.setViewportSize(DESKTOP);
    await page.goto('/positions');
    await page.getByTestId('tab-live').click();
    await expect(page.getByTestId('broker-rows')).toBeVisible();
    await expect(page.getByTestId('broker-readonly-chip')).toHaveText('Webull · read-only');
    const text = (await page.getByTestId('broker-tab-panel').innerText()) ?? '';
    const stripped = text.replace(/a snapshot, never live/gi, '');
    expect(stripped).not.toMatch(/\blive\b/i);
  });

  test('393px: the populated Broker tab does not overflow horizontally', async ({ page }) => {
    await stubNetwork(page, { authenticated: true, book: servedBook() });
    await page.setViewportSize(MOBILE);
    await page.goto('/positions');
    await page.getByTestId('tab-live').click();
    await expect(page.getByTestId('broker-card')).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `scrollWidth ${scrollWidth} must fit ${innerWidth}`).toBeLessThanOrEqual(
      innerWidth,
    );
  });
});
