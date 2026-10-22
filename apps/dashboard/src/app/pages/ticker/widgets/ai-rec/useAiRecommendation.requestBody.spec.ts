/**
 * useAiRecommendation — the EXACT `POST /api/recommendation/{ticker}` body (INTERFACE §1.1, §5).
 *
 * The sibling `useAiRecommendation.spec.ts` replaces `requestRecommendation` at the facade, so
 * nothing pins what actually leaves the browser: a dropped `dark_pool`, a stale fingerprint, an
 * `override` that is always false, or an additive field sent as `null` on the shipped path
 * (AC-45: "absent", byte-for-byte) would all stay green there. This suite mocks ONLY `fetch` — the
 * real hook, the real `@convexa/api` facade and the real `openapi-fetch` serialization run — and
 * reads the JSON body off the one POST the hook issues.
 */
import type { OpenPositionsDigest, RecStatus, TickerBundle } from '@convexa/api';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noTradeRec } from './fixtures';
import { useAiRecommendation } from './useAiRecommendation';

const STATUS: RecStatus = {
  availability: { in_app_enabled: true },
  gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
  cap: { over_limit: false, remaining_today: 10, resets_at: '' },
};

const json = (b: unknown) =>
  new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/recommendation/status/')) return json(STATUS);
    if (url.startsWith('/api/recommendation/') && init?.method === 'POST')
      return json(noTradeRec());
    throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function bundle(): TickerBundle {
  return {
    ai_eval: { state_fingerprint: 'fp-A' },
    meta: { freshness: { snapshot_iso: '2026-06-26T14:00:00Z' } },
  } as unknown as TickerBundle;
}

/** The parsed JSON body of the ONE recommendation POST the hook issued, keyed by its exact URL. */
function sentBody(): { url: string; body: unknown } {
  const posts = fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
  );
  expect(posts).toHaveLength(1);
  const [input, init] = posts[0] as [RequestInfo | URL, RequestInit];
  return { url: String(input), body: JSON.parse(String(init.body)) };
}

async function requestWith(
  opts: Parameters<typeof useAiRecommendation>[2],
  reqOpts?: Parameters<ReturnType<typeof useAiRecommendation>['request']>[0],
) {
  const { result } = renderHook(() => useAiRecommendation('tsla', bundle(), opts));
  await waitFor(() => expect(result.current.statusReady).toBe(true));
  await act(async () => {
    await result.current.request(reqOpts);
  });
}

describe('useAiRecommendation — the request body, exactly as sent', () => {
  it('carries every gating input verbatim, plus the scenario and the open-positions digest when supplied', async () => {
    const digest: OpenPositionsDigest = {
      source: 'simulated',
      state: 'none_open',
      this_underlying: {
        direction: 'bullish',
        leg_count: 2,
        nearest_expiry_dte: 14,
        max_loss: { state: 'known', value: 1500, reason: null },
      },
      portfolio: { open_count: 3, capital_at_risk: 5550 },
    };
    await requestWith(
      {
        personaId: 'income-writer',
        personaName: 'Income writer',
        dteMin: 7,
        dteMax: 45,
        openPositions: () => digest,
      },
      { override: true, scenarioId: 'sc-earnings-gap' },
    );

    expect(sentBody()).toEqual({
      url: '/api/recommendation/TSLA',
      body: {
        persona_id: 'income-writer',
        snapshot_fingerprint: 'fp-A',
        dte_min: 7,
        dte_max: 45,
        dark_pool: true,
        override: true,
        scenario_id: 'sc-earnings-gap',
        open_positions: digest,
      },
    });
  });

  it('the shipped default path sends exactly six fields — no scenario_id, no open_positions, not even as null', async () => {
    await requestWith({
      personaId: null,
      personaName: 'Default (no persona)',
      dteMin: null,
      dteMax: null,
    });

    expect(sentBody()).toEqual({
      url: '/api/recommendation/TSLA',
      body: {
        persona_id: null,
        snapshot_fingerprint: 'fp-A',
        dte_min: null,
        dte_max: null,
        dark_pool: true,
        override: false,
      },
    });
  });
});
