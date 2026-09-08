/**
 * `LevelLadder` — DOM-level proof for criteria 1, 2, 3, 5, 7, 8, 23 (SPEC §2.3). The pure-model
 * equivalents (and the mutation proofs) live in `ladderModel.spec.ts`; this file proves what only
 * the rendered DOM can: the `[data-figure-state]` count, the tick's identity against the SAME
 * `LevelPalette` object the canvas receives, and the live-dot count.
 */
import type { LevelPalette } from '@/shared/charts/structure-field/levelStrokes';
import { isDeliveringLive, NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLadder, formatAnchorText, type LadderInput } from './ladderModel';
import { LevelLadder } from './LevelLadder';

afterEach(() => cleanup());

// Distinctive, non-real-palette strings (the same discipline `StructureFieldCanvas.spec.tsx` and
// `paintStep.spec.ts` already use) — a test proves the RIGHT bucket painted, not merely that
// something painted.
const PALETTE: LevelPalette = {
  callWall: 'rgb(1,2,3)',
  mid: 'rgb(4,5,6)',
  maxPain: 'rgb(7,8,9)',
  gammaFlip: 'rgb(10,11,12)',
  putWall: 'rgb(13,14,15)',
};

const LIVE: LiveClaim = isDeliveringLive(
  { live: true, market_session: 'regular' } as Parameters<typeof isDeliveringLive>[0],
  false,
);

const FULL_INPUT: LadderInput = {
  callWall: 260,
  putWall: 240,
  maxPain: 250,
  gammaFlip: 248,
  mid: 252,
  midLive: LIVE,
  anchor: 250,
};

// `LevelLadder` is PRESENTATIONAL (PLAN's FE-6 host builds `rows`/`anchorText` once and passes them
// down) — this helper does that same build step so each test can still express its fixture as a
// `LadderInput`, matching `ladderModel.spec.ts`'s fixtures.
function wrap(input: LadderInput, palette: LevelPalette = PALETTE) {
  return render(
    <ThemeProvider theme={theme}>
      <LevelLadder
        rows={buildLadder(input)}
        anchorText={formatAnchorText(input.anchor)}
        palette={palette}
      />
    </ThemeProvider>,
  );
}

describe('LevelLadder — exactly five rows in the DOM (criterion 1)', () => {
  it('renders exactly five [data-figure-state] nodes, all present', () => {
    const { container } = wrap(FULL_INPUT);
    expect(container.querySelectorAll('[data-figure-state]')).toHaveLength(5);
  });

  it('renders exactly five [data-figure-state] nodes, all levels null', () => {
    const { container } = wrap({
      callWall: null,
      putWall: null,
      maxPain: null,
      gammaFlip: null,
      mid: null,
      midLive: NOT_LIVE,
      anchor: null,
    });
    expect(container.querySelectorAll('[data-figure-state]')).toHaveLength(5);
  });

  it('renders exactly five [data-figure-state] nodes with levels crossing', () => {
    const { container } = wrap({ ...FULL_INPUT, putWall: 300 });
    expect(container.querySelectorAll('[data-figure-state]')).toHaveLength(5);
  });
});

describe('LevelLadder — the e2e readiness anchor (criterion 2)', () => {
  it('renders the exact words "Call wall" and "Put wall" as visible text', () => {
    wrap(FULL_INPUT);
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    expect(screen.getByText('Put wall')).toBeInTheDocument();
  });
});

describe('LevelLadder — the anchor is named once, in the header (criterion 4)', () => {
  it('names the anchor once, not per row', () => {
    wrap(FULL_INPUT);
    expect(screen.getByTestId('level-ladder-anchor')).toHaveTextContent(
      'distance from levels @ $250',
    );
  });
});

describe('LevelLadder — the mid row distance, never a computed zero (criterion 3)', () => {
  it("renders `—` in the mid row's distance cell, never `at spot`, never a computed value", () => {
    wrap({ ...FULL_INPUT, mid: 250, anchor: 250, maxPain: 999 }); // avoid a duplicate '$250' text node
    const midLabel = screen.getByText('Mid');
    const midCard = midLabel.closest('[data-figure-state]')!;
    expect(midCard).toHaveTextContent('$250');
    expect(midCard).toHaveTextContent('—');
    expect(midCard).not.toHaveTextContent('at spot');
  });

  it('a non-mid row shows a real computed distance', () => {
    wrap(FULL_INPUT);
    const callWallValue = screen.getByText('$260');
    const callWallCard = callWallValue.closest('[data-figure-state]')!;
    expect(callWallCard).toHaveTextContent('+$10 · 4.0% above');
  });
});

describe('LevelLadder — D-14, the absent-level literal (criterion 5)', () => {
  it('a null call_wall keeps its row and label, and its value cell is `data-figure-state="empty"`, Sans (register ignored)', () => {
    wrap({ ...FULL_INPUT, callWall: null });
    expect(screen.getByText('Call wall')).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    // one is the value cell, one is the distance caption (both '—').
    const emptyValue = dashes.find(
      (n) => n.closest('[data-figure-state]')?.getAttribute('data-figure-state') === 'empty',
    );
    expect(emptyValue).toBeDefined();
    expect(emptyValue).toHaveAttribute('data-figure-register', 'sans');
    expect(screen.queryByText('$—')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('unavailable')).toBeNull();
  });
});

describe('LevelLadder — tick colour identity (criterion 7)', () => {
  // Repair task item 2: the max-pain tick is now DASHED (`design/src/components/ladder.mjs:13`), so
  // it paints via `borderTopColor` (a solid `backgroundColor` bar cannot dash) — the other four
  // solid ticks are unchanged (`backgroundColor`). This is the one assertion shape this task's tick
  // redesign changes; every value still traces to the SAME `LevelPalette` object.
  it("each row's tick reads from the SAME palette object, by identity", () => {
    wrap(FULL_INPUT, PALETTE);
    expect(screen.getByTestId('ladder-tick-callWall')).toHaveStyle({
      backgroundColor: PALETTE.callWall,
    });
    expect(screen.getByTestId('ladder-tick-putWall')).toHaveStyle({
      backgroundColor: PALETTE.putWall,
    });
    expect(screen.getByTestId('ladder-tick-maxPain')).toHaveStyle({
      borderTopColor: PALETTE.maxPain,
    });
    expect(screen.getByTestId('ladder-tick-gammaFlip')).toHaveStyle({
      backgroundColor: PALETTE.gammaFlip,
    });
    expect(screen.getByTestId('ladder-tick-mid')).toHaveStyle({ backgroundColor: PALETTE.mid });
  });

  it('no ladder tick uses a colour the palette does not carry', () => {
    wrap(FULL_INPUT);
    const values = Object.values(PALETTE).map((v) => v.replace(/\s+/g, ''));
    for (const id of ['callWall', 'putWall', 'gammaFlip', 'mid']) {
      const tick = screen.getByTestId(`ladder-tick-${id}`);
      const painted = getComputedStyle(tick).backgroundColor.replace(/\s+/g, '');
      expect(values).toContain(painted);
    }
    // Max pain is the dashed tick — its colour lives on `borderTopColor`, not `backgroundColor`.
    const maxPainTick = screen.getByTestId('ladder-tick-maxPain');
    const maxPainColor = getComputedStyle(maxPainTick).borderTopColor.replace(/\s+/g, '');
    expect(values).toContain(maxPainColor);
  });
});

describe('LevelLadder — exactly one live dot, on the mid row (criterion 8)', () => {
  it('exactly one figure-live-dot, on the mid row, when midLive is a live claim', () => {
    const { container } = wrap(FULL_INPUT);
    const dots = container.querySelectorAll('[data-testid="figure-live-dot"]');
    expect(dots).toHaveLength(1);
    const midValue = screen.getByText('$252');
    const midCard = midValue.closest('[data-figure-state]')!;
    expect(midCard.contains(dots[0])).toBe(true);
  });

  it('zero live dots when midLive is NOT_LIVE', () => {
    const { container } = wrap({ ...FULL_INPUT, midLive: NOT_LIVE });
    expect(container.querySelectorAll('[data-testid="figure-live-dot"]')).toHaveLength(0);
  });
});

describe('LevelLadder — the mid row offline/stale + F6 replay treatment (GATE Z, SPEC §4.1)', () => {
  it('offline, retained: the mid row dims and shows the pause mark; the four structure rows stay un-dimmed', () => {
    wrap({ ...FULL_INPUT, midOffline: { retained: true } });
    const midCard = screen.getByText('Mid').closest('[data-figure-state]')!;
    expect(midCard).toHaveAttribute('data-figure-state', 'offline-retained');
    expect(midCard).toHaveTextContent('offline · last known');
    // The CARD is never dimmed (`FigureCell` always mounts it `dim={false}`) — the retained VALUE
    // glyph itself carries the dim (same discipline the F4/F5 unit tests already establish).
    expect(getComputedStyle(screen.getByText('$252')).opacity).toBe('0.5');

    for (const id of ['callWall', 'putWall', 'maxPain', 'gammaFlip']) {
      const tick = screen.getByTestId(`ladder-tick-${id}`);
      const cell = tick.parentElement?.querySelector('[data-figure-state]') as HTMLElement;
      expect(cell.dataset.figureState).toBe('default');
      expect(getComputedStyle(cell).opacity).not.toBe('0.5');
    }
  });

  it('offline, bare: the mid row shows the bare literal + pause mark, caption `offline` (never "last known")', () => {
    wrap({ ...FULL_INPUT, mid: null, midOffline: { retained: false } });
    const midCard = screen.getByText('Mid').closest('[data-figure-state]')!;
    expect(midCard).toHaveAttribute('data-figure-state', 'offline-bare');
    expect(midCard).toHaveTextContent('offline');
    expect(midCard.textContent).not.toMatch(/last known/);
  });

  it('replay (F6): the mid row renders full strength, NO dot, NO pause mark, caption "session replay" (criterion 16b)', () => {
    wrap({ ...FULL_INPUT, midReplay: true });
    const midCard = screen.getByText('Mid').closest('[data-figure-state]') as HTMLElement;
    expect(midCard).toHaveAttribute('data-figure-state', 'replay');
    expect(midCard).toHaveTextContent('session replay');
    // The whole point of 16b: a replay standing must never wear the offline pause mark.
    expect(midCard.textContent).not.toMatch(/offline/);
    expect(within(midCard).queryByTestId('figure-live-dot')).toBeNull();
    expect(getComputedStyle(midCard).opacity).not.toBe('0.5');
  });

  it('replay never co-occurs with a live dot even if a stale `live` claim were passed (branch order proof)', () => {
    // `offline`/`replay` are checked before the live-dot branch in FigureCell — this proves the
    // ladder's own call site does not accidentally reintroduce a dot via `row.live` during replay.
    wrap({ ...FULL_INPUT, midReplay: true, midLive: LIVE });
    const midCard = screen.getByText('Mid').closest('[data-figure-state]') as HTMLElement;
    expect(midCard).toHaveAttribute('data-figure-state', 'replay');
    expect(within(midCard).queryByTestId('figure-live-dot')).toBeNull();
  });
});

describe('LevelLadder — the levels and the mid are readable as text (criterion 23)', () => {
  it('every level value and the mid render as visible text in the DOM', () => {
    wrap(FULL_INPUT);
    expect(screen.getByText('$260')).toBeInTheDocument(); // call wall
    expect(screen.getByText('$240')).toBeInTheDocument(); // put wall
    expect(screen.getByText('$250')).toBeInTheDocument(); // max pain
    expect(screen.getByText('$248')).toBeInTheDocument(); // gamma flip
    expect(screen.getByText('$252')).toBeInTheDocument(); // mid
  });
});
