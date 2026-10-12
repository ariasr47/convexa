/**
 * `figureStateOf` — the extracted F1–F9 decision (curvature-v2-surfaces SPEC §2.1, PLAN FE-1 step 5).
 *
 * This table is the contract the scanner atoms, the positions cells, the Broker tab and the two
 * mono-run quiet-band widgets consume from FE-3 onward. It asserts the MOVE was faithful: the four
 * captions are the shipped strings byte-for-byte (`FigureCell.tsx:262,271,282,293` before this
 * change), `register` is required and IGNORED on a literal (AC-19), and the offline/replay captions
 * OVERRIDE the caller's caption (the shipped precedence at `:253,262,271`).
 *
 * The `live` prop keeps the `LiveClaim` brand, so the extraction is not a back door around the
 * one-mint rule — the brand itself is proved at COMPILE time by
 * `liveness/liveClaim.typeproof.spec.ts`, which `npm run typecheck` (not `nx test`) is the only
 * thing that sees.
 */
import { isDeliveringLive, NOT_LIVE } from '@/shared/liveness/liveClaim';
import { describe, expect, it } from 'vitest';
import { figureStateOf, type FigureStateInput, type FigureStateName } from './figureState';

/** A branded `true` claim — a raw `true` does not type-check in `live`. */
const LIVE_TRUE = isDeliveringLive(
  { live: true, market_session: 'regular' } as Parameters<typeof isDeliveringLive>[0],
  false,
);

const at = (input: FigureStateInput) => figureStateOf(input);

describe('figureStateOf — the nine shipped state names, one table', () => {
  it('F1 default — traced value, Mono, a figure, nothing else set', () => {
    expect(at({ value: '$580.00', register: 'traced' })).toEqual({
      figureState: 'default',
      isLiteral: false,
      mono: true,
      isFigure: true,
      dim: false,
      untraced: false,
      showDot: false,
      showPause: false,
      caption: null,
    });
  });

  it('F3 live — the dot is the ONLY difference from default, and only a branded claim turns it on', () => {
    const live = at({ value: '+12,480', register: 'traced', live: LIVE_TRUE });
    expect(live.figureState).toBe<FigureStateName>('live');
    expect(live.showDot).toBe(true);
    expect(live.mono).toBe(true);
    expect(live.isFigure).toBe(true);

    const notLive = at({ value: '+12,480', register: 'traced', live: NOT_LIVE });
    expect(notLive.figureState).toBe<FigureStateName>('default');
    expect(notLive.showDot).toBe(false);
  });

  it('F4 offline-retained — dim + pause + the caption `offline · last known`, the value still a Mono figure', () => {
    expect(at({ value: '$0.05', register: 'traced', offline: { retained: true } })).toEqual({
      figureState: 'offline-retained',
      isLiteral: false,
      mono: true,
      isFigure: true,
      dim: true,
      untraced: false,
      showDot: false,
      showPause: true,
      caption: 'offline · last known',
    });
  });

  it('F5 offline-bare — Sans, NOT a figure, caption exactly `offline`, and `last known` appears nowhere', () => {
    const out = at({ value: '—', register: 'traced', offline: { retained: false } });
    expect(out).toEqual({
      figureState: 'offline-bare',
      isLiteral: true,
      mono: false,
      isFigure: false,
      dim: true,
      untraced: false,
      showDot: false,
      showPause: true,
      caption: 'offline',
    });
    expect(out.caption).not.toContain('last known');
    expect(JSON.stringify(out)).not.toContain('last known');
  });

  it('F6 replay — full strength, no dot, no pause, caption `session replay`', () => {
    expect(at({ value: '$573', register: 'traced', replay: true, live: LIVE_TRUE })).toEqual({
      figureState: 'replay',
      isLiteral: false,
      mono: true,
      isFigure: true,
      dim: false,
      untraced: false,
      showDot: false,
      showPause: false,
      caption: 'session replay',
    });
  });

  it('F7 empty — the bare `—` is its own state, Sans, never a figure', () => {
    const out = at({ value: '—', register: 'traced' });
    expect(out.figureState).toBe<FigureStateName>('empty');
    expect(out.isLiteral).toBe(true);
    expect(out.mono).toBe(false);
    expect(out.isFigure).toBe(false);
  });

  it('F8 unavailable — `not recorded` with register `traced` is STILL Sans (AC-19: register is ignored on a literal)', () => {
    const traced = at({ value: 'not recorded', register: 'traced' });
    expect(traced.figureState).toBe<FigureStateName>('unavailable');
    expect(traced.mono).toBe(false);
    expect(traced.isFigure).toBe(false);
    expect(traced.untraced).toBe(false);

    // …and `asserted` does not reach the untraced arm on a literal either — same output.
    expect(at({ value: 'not recorded', register: 'asserted' })).toEqual(traced);
  });

  it('F9 untraced — Sans, still A FIGURE, dotted rule, caption names the asserter', () => {
    expect(at({ value: '579.50', register: 'asserted', assertedBy: 'model' })).toEqual({
      figureState: 'untraced',
      isLiteral: false,
      mono: false,
      isFigure: true,
      dim: false,
      untraced: true,
      showDot: false,
      showPause: false,
      caption: 'model · untraced',
    });
  });

  it('F9 untraced — the shipped `AI-stated · untraced` fallback when no asserter is named', () => {
    expect(at({ value: '579.50', register: 'asserted' }).caption).toBe('AI-stated · untraced');
  });

  it('F2 loading is NOT producible here — it belongs to `StatSkeleton`, not to this decision', () => {
    const inputs: FigureStateInput[] = [
      { value: '$1', register: 'traced' },
      { value: '$1', register: 'asserted' },
      { value: '—', register: 'traced' },
      { value: 'not recorded', register: 'asserted' },
      { value: '$1', register: 'traced', live: LIVE_TRUE },
      { value: '$1', register: 'traced', replay: true },
      { value: '$1', register: 'traced', offline: { retained: true } },
      { value: '$1', register: 'traced', offline: { retained: false } },
    ];
    for (const input of inputs) {
      expect(figureStateOf(input).figureState).not.toBe('loading');
    }
  });
});

describe('figureStateOf — caption precedence (the shipped order at `FigureCell.tsx:253,262,271`)', () => {
  it('the offline captions OVERRIDE a caller caption, on both arms', () => {
    expect(
      at({
        value: '$0.05',
        register: 'traced',
        caption: '+1.20% from mid',
        offline: { retained: true },
      }).caption,
    ).toBe('offline · last known');
    expect(
      at({
        value: '—',
        register: 'traced',
        caption: '+1.20% from mid',
        offline: { retained: false },
      }).caption,
    ).toBe('offline');
  });

  it('replay overrides a caller caption too', () => {
    expect(
      at({ value: '$573', register: 'traced', caption: '+1.20% from mid', replay: true }).caption,
    ).toBe('session replay');
  });

  it('the caller caption survives on every non-computed arm, and absent means `null` (never `undefined`)', () => {
    expect(at({ value: '$580', register: 'traced', caption: 'from mid' }).caption).toBe('from mid');
    expect(at({ value: '—', register: 'traced', caption: '0 of 3 open marked' }).caption).toBe(
      '0 of 3 open marked',
    );
    expect(at({ value: 'not recorded', register: 'traced' }).caption).toBeNull();
    expect(at({ value: '$580', register: 'traced', caption: null }).caption).toBeNull();
  });
});
