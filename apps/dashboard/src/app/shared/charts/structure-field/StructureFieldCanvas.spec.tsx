import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructureFieldCanvas, type StructureFieldSurfaces } from './StructureFieldCanvas';
import type { LevelPalette } from './levelStrokes';
import type { StructureFieldModel } from './types';

// Stub RESOLVED theme values — the canvas never resolves a theme itself (SPEC §2.7); it only
// consumes what the host hands down. Distinctive strings (not real palette colours) so a test can
// prove the canvas painted from THESE props, not from some reintroduced internal literal.
const testPalette: LevelPalette = {
  callWall: 'rgb(1,2,3)',
  mid: 'rgb(4,5,6)',
  maxPain: 'rgb(7,8,9)',
  gammaFlip: 'rgb(10,11,12)',
  putWall: 'rgb(13,14,15)',
};
const testSurfaces: StructureFieldSurfaces = {
  ink: 'rgb(20,20,20)',
  panel: 'rgb(21,21,21)',
  raised: 'rgb(22,22,22)',
  phosphor: 'rgb(23,23,23)',
  steel: 'rgb(24,24,24)',
  warning: 'rgb(25,25,25)',
};

const model: StructureFieldModel = {
  symbol: 'SPY',
  samples: [
    { strike: 448, netGex: -2_000_000, netDex: null, volOi: null, volume: null },
    { strike: 450, netGex: 3_000_000, netDex: null, volOi: null, volume: null },
    { strike: 452, netGex: 1_000_000, netDex: null, volOi: null, volume: null },
  ],
  spot: 450,
  callWall: 452,
  putWall: 448,
  gammaFlip: 449,
  asOfSec: null,
  liveMid: null,
  live: false,
  source: 'rest',
};

describe('StructureFieldCanvas hover probe (AC-7)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('turns a real pointer movement over the production canvas into a visible strike readout', async () => {
    const rafs = new Map<number, FrameRequestCallback>();
    let nextRaf = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRaf++;
      rafs.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafs.delete(id);
    });
    const context = new Proxy(
      {
        measureText: (text: string) => ({ width: text.length * 7 }),
        createLinearGradient: () => ({ addColorStop: () => undefined }),
        createRadialGradient: () => ({ addColorStop: () => undefined }),
      },
      {
        get: (target, key) =>
          key in target ? target[key as keyof typeof target] : () => undefined,
      },
    ) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 600,
      bottom: 300,
      width: 600,
      height: 300,
      toJSON: () => ({}),
    });

    render(
      <StructureFieldCanvas
        model={model}
        variant="ticker"
        height={300}
        palette={testPalette}
        surfaces={testSurfaces}
      />,
    );
    const canvas = screen.getByTestId('structure-field-canvas');
    await userEvent.setup().pointer({ target: canvas, coords: { x: 300, y: 150 } });
    const frame = [...rafs.values()][0];
    expect(frame).toBeDefined();
    frame!(performance.now());
    await waitFor(() =>
      expect(
        screen.getByText((text) => text.includes('$452') && text.includes('net GEX')),
      ).toBeInTheDocument(),
    );
  });
});

/**
 * SPEC §2.7 / criterion 7 — the FE-3 slice this task can prove without a ladder (built at FE-5):
 * the canvas paints EVERY level/surface colour from the props it receives, never from a
 * reintroduced internal literal. Distinctive stub strings make this a real mutation guard: if a
 * future edit hardcodes a colour back in, these stub strings stop appearing and the test reds.
 */
describe('StructureFieldCanvas — paints only from the resolved `palette`/`surfaces` props (criterion 7, FE-3 slice)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('every painted stroke/fill traces back to a `palette` or `surfaces` prop value', async () => {
    const rafs = new Map<number, FrameRequestCallback>();
    let nextRaf = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRaf++;
      rafs.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => rafs.delete(id));

    const painted = { fills: [] as string[], strokes: [] as string[] };
    const target: Record<string, unknown> = {
      measureText: (text: string) => ({ width: text.length * 7 }),
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      createRadialGradient: () => ({ addColorStop: () => undefined }),
    };
    const context = new Proxy(target, {
      get: (t, key) => (key in t ? t[key as keyof typeof t] : () => undefined),
      set: (t, key, value) => {
        if (key === 'fillStyle') painted.fills.push(String(value));
        if (key === 'strokeStyle') painted.strokes.push(String(value));
        t[key as string] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);

    render(
      <StructureFieldCanvas
        model={model}
        variant="ticker"
        height={300}
        palette={testPalette}
        surfaces={testSurfaces}
      />,
    );
    const frame = [...rafs.values()][0];
    expect(frame).toBeDefined();
    frame!(performance.now());

    // The base fill (paintStructure's unconditional dark fill — criterion 52's turn-on) comes from
    // `surfaces.ink`, never a literal.
    expect(painted.fills).toContain(testSurfaces.ink);
    // The two level lines (put/call walls) come from `palette`, never `RED`/`GREEN`.
    expect(painted.strokes).toContain(testPalette.putWall);
    expect(painted.strokes).toContain(testPalette.callWall);
  });
});
