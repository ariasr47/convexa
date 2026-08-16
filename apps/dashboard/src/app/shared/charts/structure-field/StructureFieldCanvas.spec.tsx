import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructureFieldCanvas } from './StructureFieldCanvas';
import type { StructureFieldModel } from './types';

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
      { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => undefined) },
    ) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 300, width: 600, height: 300, toJSON: () => ({}),
    });

    render(<StructureFieldCanvas model={model} variant="ticker" height={300} />);
    const canvas = screen.getByTestId('structure-field-canvas');
    await userEvent.setup().pointer({ target: canvas, coords: { x: 300, y: 150 } });
    const frame = [...rafs.values()][0];
    expect(frame).toBeDefined();
    frame!(performance.now());
    await waitFor(() => expect(screen.getByText((text) => text.includes('$452') && text.includes('net GEX'))).toBeInTheDocument());
  });
});
