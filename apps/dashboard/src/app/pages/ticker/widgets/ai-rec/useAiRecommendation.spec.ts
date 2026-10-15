/**
 * useAiRecommendation — the A10 retention guard (SPEC §4.5/§5, GATE Z resolution 2026-09-05).
 *
 * The cheap check done BEFORE writing this file (recorded for whoever reads this next): the shipped
 * `request()` catch branch used to `setRec(unavailableArtifact)` unconditionally on ANY non-auth
 * failure, including a REFRESH fired while a produced read was already pinned — genuinely replacing
 * it, not merely hiding it. This is reachable in the real app: `DecisionCard`'s own "Refresh" button
 * and the A1c annex's "Ask anyway" both call `ai.request()` again while `producedRec` is truthy. So
 * SPEC's "the previously pinned read stays pinned and readable" was NOT true by construction — it was
 * a genuine gap, fixed inside this hook (never a parallel ref in `AiRecPanel.tsx` — that risks
 * disagreeing with this hook's own lifecycle on dismiss/ticker-change/sign-out).
 *
 * Mocks ONLY the network boundary (`@convexa/api`'s `requestRecommendation`/`fetchRecStatus`), never
 * a component — matching every other rec-hook-adjacent suite in this tree.
 */
import { ApiError, type RecResponse, type RecStatus, type TickerBundle } from '@convexa/api';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noTradeRec } from './fixtures';

const requestSpy = vi.fn<(ticker: string, body: unknown) => Promise<RecResponse>>();
const statusSpy = vi.fn<(ticker: string) => Promise<RecStatus>>();
vi.mock('@convexa/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convexa/api')>();
  return {
    ...actual,
    requestRecommendation: (t: string, b: unknown) => requestSpy(t, b),
    fetchRecStatus: (t: string) => statusSpy(t),
  };
});

// Import AFTER the mock is registered (vi.mock is hoisted, so this is just for readability).
import { useAiRecommendation } from './useAiRecommendation';

function defaultStatus(): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 10, resets_at: '' },
  };
}

function bundle(): TickerBundle {
  return {
    ai_eval: { state_fingerprint: 'fp-A' },
    meta: { freshness: { snapshot_iso: '2026-06-26T14:00:00Z' } },
  } as unknown as TickerBundle;
}

const opts = {
  personaId: null,
  personaName: 'Default (no persona)',
  dteMin: null,
  dteMax: null,
  darkPool: false,
};

beforeEach(() => {
  requestSpy.mockReset();
  statusSpy.mockReset();
  statusSpy.mockResolvedValue(defaultStatus());
});
afterEach(() => cleanup());

describe('useAiRecommendation — A10 retention', () => {
  it('keeps a previously pinned produced read across a later FAILED refresh — never evicts it', async () => {
    requestSpy.mockResolvedValueOnce(noTradeRec());
    const { result } = renderHook(() => useAiRecommendation('TSLA', bundle(), opts));
    await waitFor(() => expect(result.current.statusReady).toBe(true));

    await act(async () => {
      await result.current.request();
    });
    expect(result.current.rec?.status).toBe('produced');
    const pinned = result.current.rec;

    requestSpy.mockRejectedValueOnce(new Error('network blip'));
    await act(async () => {
      await result.current.request();
    });

    // Byte-identical object, not merely an equivalent one — proves the pinned read was never
    // replaced, not even with a look-alike reconstruction.
    expect(result.current.rec).toBe(pinned);
    expect(result.current.rec?.status).toBe('produced');
  });

  it('CONTRAST — the very first failed ask (nothing previously pinned) still renders the unavailable artifact', async () => {
    requestSpy.mockRejectedValueOnce(new Error('network blip'));
    const { result } = renderHook(() => useAiRecommendation('TSLA', bundle(), opts));
    await waitFor(() => expect(result.current.statusReady).toBe(true));

    await act(async () => {
      await result.current.request();
    });

    // Proves the retention guard does not swallow the base A10 case: the FIRST failure, with no
    // produced read to protect, must still synthesize `unavailable` exactly as before.
    expect(result.current.rec?.status).toBe('unavailable');
  });
});

describe('useAiRecommendation — no-vendor-production-posture B2 amendment (GATE Z 2026-09-24)', () => {
  // In the shipped app the status read normally reports paused first, which disables the Analyze
  // action before `request` ever fires — this covers the race where a request beats that response
  // (or a future caller that reaches `request` directly), and proves the exact regression the
  // amendment names: this fault must render the honest paused copy, never `transport` (which
  // `AiRecPanelBlocks.tsx` renders as "Couldn’t get a read"), and it must not be rethrown the
  // way an `AuthError` is (the panel would otherwise never re-render at all, or a host `guard()`
  // would show a sign-in prompt instead).
  it('a paused POST renders the honest paused reason — never `transport`, and is not rethrown', async () => {
    requestSpy.mockRejectedValueOnce(
      new ApiError('Recommendation request failed (503)', 503, 'market_data_paused'),
    );
    const { result } = renderHook(() => useAiRecommendation('TSLA', bundle(), opts));
    await waitFor(() => expect(result.current.statusReady).toBe(true));

    await act(async () => {
      await result.current.request();
    });

    expect(result.current.rec?.status).toBe('unavailable');
    expect(result.current.rec?.unavailable_reason).toBe('market_data_paused');
    expect(result.current.loading).toBe(false);
  });
});
