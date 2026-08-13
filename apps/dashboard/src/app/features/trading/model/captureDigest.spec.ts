/**
 * outcome-ledger — the CAPTURE side's invariants. The risk here is invisible to review and severe:
 * capture must never gate, block or alter the trade/position/order write, and it must never reach
 * the network. A regression would break a trade write for a readout's benefit.
 */
import { __resetPersonas, saveActiveId } from '@/features/personas/store';
import type { TickerBundle } from '@convexa/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEntryContextDigest, CAPTURE_EVENTS, entryContextFor } from './captureDigest';

const bundle = (over: Record<string, unknown> = {}): TickerBundle =>
  ({
    market_state: { price: 300, iv_rank: { band: 'premium_rich', rank: 82 } },
    signals: {
      opportunity_score: 71,
      opportunity_tier: 'prime',
      regime: 'negative_gamma',
      vol_regime: 'iv_rich',
      setups: [
        {
          name: 'pin_confluence',
          conviction: 'high',
          bias: 'up',
          strategy: 's',
          rationale: 'PROSE',
        },
      ],
    },
    ai_eval: { state_fingerprint: 'fp-1' },
    ...over,
  }) as unknown as TickerBundle;

beforeEach(() => {
  localStorage.clear();
  __resetPersonas();
});

describe('what is captured (§2/Q2)', () => {
  it('captures the small orthogonal label set from the bundle already in hand + the persona store', () => {
    saveActiveId('scalper-1');
    const d = buildEntryContextDigest({
      bundle: bundle(),
      aiRecFingerprint: 'fp-rec',
      riskBlockPresent: true,
    });
    expect(d).toEqual({
      opportunity_score: 71,
      setups: [{ name: 'pin_confluence', conviction: 'high' }],
      persona_id: 'scalper-1',
      iv_rank_band: 'premium_rich',
      gamma_regime: 'negative_gamma',
      vol_regime: 'iv_rich',
      state_fingerprint: 'fp-1',
      ai_rec_fingerprint: 'fp-rec',
      risk_block_present: true,
    });
  });

  it('tradeable-rec-inputs AC-82 — captures the presence flag ONLY, never an account-size value', () => {
    const d = buildEntryContextDigest({
      bundle: bundle(),
      aiRecFingerprint: null,
      riskBlockPresent: false,
    });
    expect(d.risk_block_present).toBe(false);
    expect(JSON.stringify(d)).not.toMatch(/account_size|accountSize/i);
  });

  it('`[digested-labels-not-raw-dump]` — labels only: no setup prose, no raw series, no greeks, no bundle dump', () => {
    const d = buildEntryContextDigest({
      bundle: bundle(),
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(JSON.stringify(d)).not.toContain('PROSE');
    expect(d.setups?.[0]).toEqual({ name: 'pin_confluence', conviction: 'high' });
    // The IV band is the WIRE label — never re-derived from `rank`. A wire band that disagrees with
    // the rank is captured as the wire says.
    const odd = buildEntryContextDigest({
      bundle: bundle({ market_state: { price: 1, iv_rank: { band: 'premium_cheap', rank: 82 } } }),
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(odd.iv_rank_band).toBe('premium_cheap');
  });

  it('caps the captured setups at 5 — a digest, not a dump', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `s${i}`, conviction: 'low' }));
    const d = buildEntryContextDigest({
      bundle: bundle({ signals: { ...bundle().signals, setups: many } }),
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(d.setups).toHaveLength(5);
  });
});

describe('capture is BEST-EFFORT and never blocks the write (§2/Q2, §4/A)', () => {
  it('an absent bundle ⇒ every bundle-sourced field is null — never a throw, and never a fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const d = buildEntryContextDigest({
      bundle: null,
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(d.opportunity_score).toBeNull();
    expect(d.setups).toBeNull();
    expect(d.iv_rank_band).toBeNull();
    expect(d.state_fingerprint).toBeNull();
    // Capture reads only what is already in hand: no fetch, no recompute, no wire traffic.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('a partial / hostile bundle degrades field-by-field, and NEVER throws into the trade write', () => {
    for (const b of [
      {},
      { signals: null },
      { signals: { setups: 'not-an-array' } },
      { market_state: { iv_rank: null } },
    ]) {
      expect(() =>
        buildEntryContextDigest({
          bundle: b as unknown as TickerBundle,
          aiRecFingerprint: null,
          riskBlockPresent: null,
        }),
      ).not.toThrow();
    }
  });

  it('a persona-store failure degrades to null — it does not cost the record its other fields', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const d = buildEntryContextDigest({
      bundle: bundle(),
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(d.persona_id).toBeNull();
    expect(d.opportunity_score).toBe(71); // the rest of the digest is unharmed
    getItem.mockRestore();
  });
});

describe('where capture attaches (the 5 decision points)', () => {
  it('attaches at the decision-point events only — `alert` and the mechanical transitions carry none', () => {
    expect([...CAPTURE_EVENTS]).toEqual([
      'open',
      'accept',
      'reject',
      'order_placed',
      'order_filled',
    ]);
    for (const event of CAPTURE_EVENTS) {
      expect(
        entryContextFor(event, {
          bundle: bundle(),
          aiRecFingerprint: null,
          riskBlockPresent: null,
        }),
      ).toHaveProperty('entry_context');
    }
    // `alert` is mechanical, not a decision; the rest are transitions reachable via the join.
    for (const event of [
      'alert',
      'close',
      'order_triggered',
      'order_cancelled',
      'limit_placed',
    ] as const) {
      expect(
        entryContextFor(event, {
          bundle: bundle(),
          aiRecFingerprint: null,
          riskBlockPresent: null,
        }),
      ).toEqual({});
    }
  });

  it('the digest object`s PRESENCE is the epoch marker: present-with-null ≠ absent', () => {
    // Present with a null field ⇒ capture ran; the source was genuinely unavailable that cycle.
    const attached = entryContextFor('open', {
      bundle: null,
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(attached).toHaveProperty('entry_context');
    expect(
      (attached as { entry_context: { persona_id: null } }).entry_context.persona_id,
    ).toBeNull();
    // Absent ⇒ the record predates capture. A record with no digest is NEVER backfilled.
    expect(
      entryContextFor('close', { bundle: null, aiRecFingerprint: null, riskBlockPresent: null }),
    ).toEqual({});
  });

  it('the rec-identity KEY is always present on records this app writes (null ⇒ no rec was involved)', () => {
    // The absent-key case means "this path cannot carry the identity" — a different fact, reserved
    // for records imported from a browser whose capture predates the threading.
    const d = buildEntryContextDigest({
      bundle: bundle(),
      aiRecFingerprint: null,
      riskBlockPresent: null,
    });
    expect(Object.prototype.hasOwnProperty.call(d, 'ai_rec_fingerprint')).toBe(true);
    expect(d.ai_rec_fingerprint).toBeNull();
  });
});
