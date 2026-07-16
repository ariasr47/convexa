/**
 * outcome-ledger — THE FLOW SPEC (the centerpiece). It mounts the real feature subtree and drives
 * the real user journey end to end, over the real derivation.
 *
 * ⚠ The boundary mocked here is **localStorage — the durable store**, not a network client. This
 * feature consumes NO endpoint, opens no SSE and makes no network call of any kind, so there is no
 * API client to mock and none is invented. The stores are seeded; everything else is real.
 *
 * The journey: nothing recorded → history builds → a cell clears the floor → records that must not
 * count arrive → a store goes unreadable → an archive is exported, imported, re-imported, declined.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetMemory as resetGhost } from '@/features/trading/model/store';
import { __resetOrdersMemory } from '@/features/trading/orders/store';
import { __resetMemory as resetPositions, PORTFOLIO_V2_KEY } from '@/features/trading/positions/store';
import { buildArchive } from './archive';
import { closedOutcome, digest, order, outcomes, position, seedStores } from './fixtures';
import { TrackRecordSection } from './TrackRecordSection';

const reset = () => {
  localStorage.clear();
  resetGhost();
  resetPositions();
  __resetOrdersMemory();
};

/** ⚠ NO provider, NO session, NO router, NO stream: the section is mounted BARE, on purpose.
 *  It takes no `live`/`isLive`/`streamOffline`/`data` prop (AC-E17) and reaches no auth (AC-2/25) —
 *  if it needed either, this render would fail. */
const mount = (personaLabel?: (id: string) => string | null) =>
  render(<TrackRecordSection personaLabel={personaLabel} />);

/** The whole readout's rendered text — what the trader can actually read. */
const surfaceText = () => screen.getByTestId('track-record').textContent ?? '';

beforeEach(reset);

describe('the journey starts: nothing has closed yet (AC-E1)', () => {
  it('renders the honest empty state — no error, no blank page, no zero-rate — and the frame + archive still render', () => {
    mount();
    expect(screen.getByTestId('tr-empty')).toBeTruthy();
    expect(surfaceText()).toContain('Nothing has closed yet.');
    // ⚠ empty ≠ unreadable. This user genuinely has no history.
    expect(screen.queryByTestId('tr-unreadable')).toBeNull();
    expect(surfaceText()).not.toContain('0%');
    expect(screen.queryByText(/retry/i)).toBeNull();
    // The framing is unconditional — the readout CARRIES it (AC-2/3/4/5).
    expect(screen.getByTestId('tr-advisory')).toBeTruthy();
    expect(screen.getByTestId('tr-sim-disclosure')).toBeTruthy();
    expect(screen.getByTestId('tr-storage')).toBeTruthy();
    expect(screen.getByTestId('tr-multiplicity')).toBeTruthy();
    // On an empty surface the archive is the only useful thing here (AC-21).
    expect(screen.getByTestId('tr-export')).toBeTruthy();
    expect(screen.getByTestId('tr-import')).toBeTruthy();
    // Day one: capture has not started, and the read says so rather than inventing a date.
    expect(screen.getByTestId('tr-epoch').textContent).toContain('haven’t recorded entry context');
  });

  it('AC-E5 — a store that cannot be read is UNREADABLE, not empty: telling a user with 400 trades "nothing has closed" would be a lie', () => {
    const corrupt = '{ this is not json';
    seedStores({ rawPositions: corrupt });
    expect(() => mount()).not.toThrow();
    expect(screen.getByTestId('tr-unreadable')).toBeTruthy();
    expect(screen.queryByTestId('tr-empty')).toBeNull();
    expect(surfaceText()).toContain('couldn’t read your stored history');
    expect(surfaceText()).toContain('has not been changed or deleted');
    // No throw, no severity="error", no Retry — and the blob survives the read byte-for-byte.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(corrupt);
  });
});

describe('history builds (AC-E2, AC-E3, AC-E4)', () => {
  it('AC-E4 — day one: every cell is building, the lead explainer renders, and NO rate exists anywhere', () => {
    const { positions, decisions } = outcomes(3, { winners: 3 });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    expect(screen.getByTestId('tr-lead-explainer')).toBeTruthy();
    expect(surfaceText()).toContain('Building history — 3 of 20 closed trades');
    expect(surfaceText()).not.toContain('hit rate —');
    expect(surfaceText()).not.toMatch(/plausibly/);
  });

  it('⚠ AC-E3 — THE 3-FOR-3 TRAP: three counted outcomes, all winners. The cell shows the count and nothing else.', () => {
    const { positions, decisions } = outcomes(3, { winners: 3 });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    const cell = screen.getByTestId('tr-cell-prime');
    expect(cell.textContent).toContain('Building history — 3 of 20 closed trades');
    // The two strings a naive implementation WOULD have shown:
    expect(cell.textContent).not.toContain('100%');
    expect(cell.textContent).not.toContain('3 of 3 won');
    // ...and everything else that would read as a result:
    expect(cell.textContent).not.toMatch(/plausibly|avg |±|quoted fills only/);
    expect(screen.queryByTestId('tr-wide-prime')).toBeNull();
    expect(screen.queryByTestId('tr-basis-prime')).toBeNull();
    // No meter beside a hit-rate-shaped cell (it would read as 100%).
    expect(cell.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('AC-E2 — 19 counted still shows only "19 of 20": nothing numeric readable as a result', () => {
    const { positions, decisions } = outcomes(19, { winners: 15 });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    const cell = screen.getByTestId('tr-cell-prime');
    expect(cell.textContent).toContain('19 of 20 closed trades');
    // (the building copy says "No hit rate yet" — what must not exist is a rate)
    expect(cell.textContent).not.toMatch(/\d+% hit rate|plausibly|avg |±/);
  });
});

describe('a cell clears the floor (AC-7 … AC-12, AC-17)', () => {
  const seedCounted = () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
  };

  it('AC-7/8/9 — the rate arrives INSEPARABLE from its range, N, mean and dispersion, in ONE element, with no interaction', () => {
    seedCounted();
    mount();
    const read = screen.getByTestId('tr-read-prime');
    // ONE string, ONE element. There is no DOM node holding the rate alone, so no `&&` and no
    // hide-control can ever produce a rate-only render.
    expect(read.textContent).toContain('60% hit rate');
    expect(read.textContent).toMatch(/plausibly \d+–\d+%/); // AC-11: a plain range, not a bare ±
    expect(read.textContent).toContain('20 closed trades');
    expect(read.textContent).toContain('per trade');
    expect(read.textContent).toContain('pts trade to trade');
    // The basis + window ride the second mandatory line (AC-8).
    expect(screen.getByTestId('tr-basis-prime').textContent).toContain('quoted fills only');
    expect(screen.getByTestId('tr-basis-prime').textContent).toMatch(/2026/);
  });

  it('AC-12 — a range wider than 20pp carries the "still wide" qualifier', () => {
    seedCounted();
    mount();
    // 12/20 ⇒ a Wilson band ~36–80: 44pp wide. A barely-cleared floor must never read as a verdict.
    expect(screen.getByTestId('tr-wide-prime').textContent).toBe('still wide — not a conclusion yet');
  });

  it('⚠ AC-14 — no rate is tinted: a 90% cell and a 10% cell are styled IDENTICALLY', () => {
    // The strongest available statement of "no semantic tint": if any styling were bound to the
    // sign or the size of the rate, these two cells' classes would diverge. The file next door does
    // `color: netPl >= 0 ? 'success.main' : 'error.main'`. The range is the verdict, not the hue.
    const good = outcomes(20, { prefix: 'g', winners: 18, tier: 'prime' });
    const bad = outcomes(20, { prefix: 'b', winners: 2, tier: 'watch' });
    seedStores({
      positions: [...good.positions, ...bad.positions],
      positionDecisions: [...good.decisions, ...bad.decisions],
    });
    mount();
    const winner = screen.getByTestId('tr-read-prime');
    const loser = screen.getByTestId('tr-read-watch');
    expect(winner.textContent).toContain('90% hit rate');
    expect(loser.textContent).toContain('10% hit rate');
    expect(loser.className).toBe(winner.className); // identical styling, whatever the result
    expect(winner.querySelector('svg')).toBeNull(); // no arrow, no ✓/✗, no sparkline, no gauge
    expect(loser.querySelector('svg')).toBeNull();
  });

  it('AC-17 — the coverage statement is readable WITHOUT interaction: it sits OUTSIDE the disclosure', () => {
    seedCounted();
    mount();
    const coverage = screen.getByTestId('tr-coverage');
    expect(coverage.textContent).toBe(
      'Counted 20 of 20 recorded closed positions. 0 still open — not yet counted. 0 orders never filled.',
    );
    // Not nested in the <details> — no click required, and every count renders even at zero.
    expect(screen.getByTestId('tr-breakdown').contains(coverage)).toBe(false);
  });

  it('AC-16 — no total that sums cell Ns is rendered anywhere', () => {
    const { positions, decisions } = outcomes(20, {
      winners: 12,
      entryDigest: digest({
        setups: [
          { name: 'pin_confluence', conviction: 'high' },
          { name: 'gamma_squeeze', conviction: 'low' },
        ],
      }),
    });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    // One trade appears in its tier cell AND both setup cells — the Ns overlap by design. The
    // readout says so and never adds them up.
    expect(surfaceText()).toContain('appears in every cell it qualifies for');
    expect(surfaceText()).not.toMatch(/total|in total|overall/i);
    expect(screen.getByTestId('tr-family-coverage-setup').textContent).toContain(
      'Of your 20 counted outcomes, 20 carry a recorded setup.',
    );
  });

  it('AC-10 — the readout renders no dollar figure at all', () => {
    seedCounted();
    mount();
    expect(surfaceText()).not.toContain('$');
  });
});

describe('records that must never reach a rate', () => {
  it('AC-E10/E11/E12 — a seeded winner with no decision, an open position and a never-filled order are counted for COVERAGE only', () => {
    const counted = outcomes(20, { winners: 12 });
    seedStores({
      positions: [
        ...counted.positions,
        // Exactly what `positions/testSeed.ts` writes: a fabricated closed winner, no decision.
        position({ id: 'seeded', realized_pl_dollar: 196, realized_pl_pct: 48.4 }),
        position({ id: 'p-open', status: 'open' }),
      ],
      positionDecisions: counted.decisions,
      orders: [order({ id: 'o-1', status: 'cancelled' })],
    });
    mount();
    expect(screen.getByTestId('tr-coverage').textContent).toBe(
      'Counted 20 of 21 recorded closed positions. 1 still open — not yet counted. 1 order never filled.',
    );
    // The fabricated 48.4% winner never reaches a rate — the spine rule excludes it for free.
    expect(screen.getByTestId('tr-read-prime').textContent).toContain('60% hit rate');
    expect(surfaceText()).not.toContain('48.4');
    expect(surfaceText()).not.toContain('196');
    // ...and no copy anywhere mentions seeding. It is just a record with no decision.
    expect(surfaceText().toLowerCase()).not.toMatch(/\bseed|\bdemo\b|test data/);
    // The seed is ONE MEMBER of this bucket, not its archetype: a rolled-into leg lands here too,
    // from ordinary activity. The label says the narrower, TRUE thing — "no ENTRY decision" — because
    // a rolled-into leg DOES have a recorded decision, just not an entry one.
    expect(screen.getByTestId('tr-reason-no_decision_record').textContent).toContain(
      'No entry decision recorded — it can’t tell us whether entering was a good call · 1',
    );
    // The balance identity is user-checkable, right there in the breakdown.
    expect(screen.getByTestId('tr-balance').textContent).toBe(
      '20 counted + 1 not counted = 21 recorded closed positions.',
    );
  });

  it('AC-E7/E8/E9 — typed, re-priced and scripted outcomes each land under their OWN reason, and none is a cohort', () => {
    const typed = closedOutcome('p-typed', { entryBasis: 'user_entered' });
    const modeled = closedOutcome('p-modeled', { exitBasis: 'modeled' });
    const scripted = closedOutcome('p-script', { originOrderId: 'o-s' });
    seedStores({
      positions: [typed.position, modeled.position, scripted.position],
      positionDecisions: [...typed.decisions, ...modeled.decisions, ...scripted.decisions],
      orders: [order({ id: 'o-s', provenance: { source: 'ai_scenario', scenario_id: 's1' } })],
    });
    mount();
    expect(screen.getByTestId('tr-reason-unpriced_basis').textContent).toContain(
      'Entry or exit price was typed, theoretical or stale — not a quote · 1',
    );
    expect(screen.getByTestId('tr-reason-modeled_basis').textContent).toContain(
      'Re-priced between quotes — not a quote · 1',
    );
    expect(screen.getByTestId('tr-reason-scenario_sourced').textContent).toContain(
      'Scripted test scenario — not a real decision · 1',
    );
    // AC-E8: `modeled` is a breakdown REASON, never a cell.
    expect(screen.queryByTestId('tr-cell-modeled')).toBeNull();
    expect(screen.getByTestId('tr-coverage').textContent).toContain('Counted 0 of 3');
  });

  it('AC-E6 — one malformed record among 100 costs the other 99 nothing, and shows up as an unreadable record', () => {
    const { positions, decisions } = outcomes(99, { winners: 60 });
    const broken = closedOutcome('broken', {});
    delete (broken.position as { close_time?: string }).close_time;
    seedStores({
      positions: [...positions, broken.position],
      positionDecisions: [...decisions, ...broken.decisions],
    });
    mount();
    expect(screen.getByTestId('tr-read-prime').textContent).toContain('61% hit rate');
    expect(screen.getByTestId('tr-reason-malformed').textContent).toContain(
      'Unreadable record — not counted · 1',
    );
  });
});

describe('coverage honesty (AC-19, AC-E13, AC-E14, AC-E18)', () => {
  it('AC-E13/E19 — pre-capture outcomes count for TIER and are reported as pre-capture elsewhere; the epoch is derived from the data', () => {
    const pre = outcomes(10, { prefix: 'pre', entryDigest: null }); // predate capture
    const post = outcomes(10, { prefix: 'post', entryClock: '2026-05-02T09:00:00.000Z' });
    seedStores({
      positions: [...pre.positions, ...post.positions],
      positionDecisions: [...pre.decisions, ...post.decisions],
    });
    mount();
    // Tier counts all 20 — it is recorded on every trade, including pre-capture ones.
    expect(screen.getByTestId('tr-family-coverage-tier').textContent).toBe(
      'Of your 20 counted outcomes, 20 carry a tier.',
    );
    expect(screen.getByTestId('tr-read-prime').textContent).toContain('hit rate');
    // Setup reports the gap in plain language — and there is NO "unknown" cell with a rate.
    expect(screen.getByTestId('tr-family-coverage-setup').textContent).toBe(
      'Of your 20 counted outcomes, 10 carry a recorded setup — 10 predate capture.',
    );
    expect(screen.queryByTestId('tr-cell-unknown')).toBeNull();
    expect(screen.getByTestId('tr-epoch').textContent).toContain('We started recording entry context on');
    expect(screen.getByTestId('tr-epoch').textContent).toContain('2026');
  });

  it('AC-E14 — "predate capture" and "had none available at entry" render as two visibly distinct clauses', () => {
    const pre = outcomes(2, { prefix: 'pre', entryDigest: null });
    const unavailable = outcomes(3, { prefix: 'un', entryDigest: digest({ persona_id: null }) });
    seedStores({
      positions: [...pre.positions, ...unavailable.positions],
      positionDecisions: [...pre.decisions, ...unavailable.decisions],
    });
    mount();
    const line = screen.getByTestId('tr-family-coverage-persona').textContent ?? '';
    expect(line).toContain('2 predate capture');
    expect(line).toContain('3 had none available at entry');
  });

  it('AC-E18 — the AI-rec path note self-cancels off the count, in BOTH directions', () => {
    // Direction 1: every path threads the rec identity ⇒ the count is 0 ⇒ the note is ABSENT.
    const threaded = outcomes(2, { entryDigest: digest({ ai_rec_fingerprint: null }) });
    seedStores({ positions: threaded.positions, positionDecisions: threaded.decisions });
    const { unmount } = mount();
    expect(screen.queryByTestId('tr-airec-path-note')).toBeNull();
    unmount();

    // Direction 2: a record whose digest cannot carry the identity ⇒ the count is > 0 ⇒ it renders.
    reset();
    const noKey = digest();
    delete (noKey as { ai_rec_fingerprint?: string | null }).ai_rec_fingerprint;
    const stranded = outcomes(2, { entryDigest: noKey });
    seedStores({ positions: stranded.positions, positionDecisions: stranded.decisions });
    mount();
    expect(screen.getByTestId('tr-airec-path-note')).toBeTruthy();
    expect(screen.getByTestId('tr-family-coverage-ai_rec').textContent).toContain(
      "came in through a path that can't carry the rec identity",
    );
  });

  it('the persona label is INJECTED (outcomes may not import personas); an id we no longer hold reads honestly, never as a raw id', () => {
    const known = outcomes(1, { prefix: 'k', entryDigest: digest({ persona_id: 'scalper-1' }) });
    const deleted = outcomes(1, { prefix: 'd', entryDigest: digest({ persona_id: 'custom-xyz' }) });
    seedStores({
      positions: [...known.positions, ...deleted.positions],
      positionDecisions: [...known.decisions, ...deleted.decisions],
    });
    mount((id) => (id === 'scalper-1' ? 'Scalper' : null));
    expect(screen.getByTestId('tr-cell-scalper-1').textContent).toContain('Scalper');
    expect(screen.getByTestId('tr-cell-custom-xyz').textContent).toContain('Persona no longer saved');
    expect(surfaceText()).not.toContain('custom-xyz');
  });
});

describe('a source goes unreadable mid-history — the PARTIAL state (AC-E5)', () => {
  it('⚠ withholds the "of M" comparison rather than caveating a wrong denominator, and every counted cell says "partial read"', () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    // The ghost store is unreadable; the positions store is fine. M is therefore UNDERSTATED.
    seedStores({ rawGhost: '{{{', positions, positionDecisions: decisions });
    mount();
    expect(screen.getByTestId('tr-partial-banner').textContent).toContain('Partial read');
    const coverage = screen.getByTestId('tr-coverage').textContent ?? '';
    expect(coverage).toContain('Counted 20 outcomes from the records we could read');
    // A partial roll-up must NEVER present its smaller M as the whole population.
    expect(coverage).not.toMatch(/Counted 20 of \d+/);
    expect(coverage).toContain('Nothing was changed or deleted');
    // Counted cells STILL render — partial means content — and the partiality rides the ALREADY
    // MANDATORY basis sibling, so it is inseparable from the number for free.
    expect(screen.getByTestId('tr-read-prime').textContent).toContain('60% hit rate');
    expect(screen.getByTestId('tr-basis-prime').textContent).toContain('· partial read');
  });
});

describe('the archive: export → import → re-import → decline (AC-20 … AC-25, AC-E15)', () => {
  const pickFile = (contents: string, name = 'convexa-archive-2026-07-16.json') => {
    const file = new File([contents], name, { type: 'application/json' });
    fireEvent.change(screen.getByTestId('tr-import-input'), { target: { files: [file] } });
  };

  it('AC-22/23/25 — a SIGNED-OUT user completes an import: confirm first (nothing written), then a full report', async () => {
    const incoming = outcomes(2, { prefix: 'new' });
    const file = JSON.stringify({
      schema: 'convexa.archive',
      version: 1,
      exported_at: '2026-07-16T00:00:00.000Z',
      stores: {
        ghost_trade: { trades: {}, decisions: [] },
        positions: {
          positions: Object.fromEntries(incoming.positions.map((p) => [p.id, p])),
          decisions: incoming.decisions,
        },
        orders: { orders: {} },
      },
    });
    seedStores({});
    mount(); // no session, no auth provider, no gate — see the mount() note above
    const before = localStorage.getItem(PORTFOLIO_V2_KEY);

    pickFile(file);
    await screen.findByTestId('tr-import-confirm-title');
    // ⚠ AC-22: the confirm states only-adds/never-deletes/never-overwrites/never-replaces FIRST...
    const body = screen.getByTestId('tr-import-confirm-body').textContent ?? '';
    expect(body).toContain('only adds');
    expect(body).toContain('never deletes, never overwrites and never replaces');
    // ...and NOTHING has been written yet.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(before);

    fireEvent.click(screen.getByTestId('tr-import-confirm'));
    await screen.findByTestId('tr-import-done-title');
    // AC-23: all three counts, every time, including zeros.
    expect(screen.getByTestId('tr-import-added').textContent).toBe('6 records added.');
    expect(screen.getByTestId('tr-import-skipped').textContent).toBe('0 already here — skipped.');
    expect(screen.getByTestId('tr-import-conflict').textContent).toBe(
      '0 collided with a different record — your existing record was kept.',
    );
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).not.toBe(before);
  });

  it('AC-24 — re-importing the SAME file reports 0 added and leaves the counted N, the rates and the coverage statement identical', async () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    const coverageBefore = screen.getByTestId('tr-coverage').textContent;
    const readBefore = screen.getByTestId('tr-read-prime').textContent;

    pickFile(JSON.stringify(buildArchive()));
    await screen.findByTestId('tr-import-confirm-title');
    fireEvent.click(screen.getByTestId('tr-import-confirm'));
    await screen.findByTestId('tr-import-done-title');
    expect(screen.getByTestId('tr-import-added').textContent).toBe('0 records added.');

    fireEvent.click(screen.getByText('Done'));
    // The read is RECOMPUTED from the (unchanged) stores, never patched — so it cannot drift.
    await waitFor(() => {
      expect(screen.getByTestId('tr-coverage').textContent).toBe(coverageBefore);
      expect(screen.getByTestId('tr-read-prime').textContent).toBe(readBefore);
    });
  });

  it('AC-E15 class B — an unreadable STORE ⇒ the import is DECLINED with its OWN self-contained title+body: nothing imported, nothing changed, the blob byte-untouched', async () => {
    // The FILE is fine here; YOUR STORED HISTORY is the problem, and we will not touch it. The store
    // APIs would rewrite the unreadable blob and destroy it — `[loss-free-durable-migration]` forbids
    // that outright, so refusing is the only non-destructive answer. Declining IS the design.
    const corrupt = '{ this is not json';
    seedStores({ rawPositions: corrupt });
    mount();
    pickFile(
      JSON.stringify({
        schema: 'convexa.archive',
        version: 1,
        exported_at: '',
        stores: {
          ghost_trade: { trades: {}, decisions: [] },
          positions: { positions: { 'p-1': position({ id: 'p-1' }) }, decisions: [] },
          orders: { orders: {} },
        },
      }),
    );
    await screen.findByTestId('tr-import-confirm-title');
    fireEvent.click(screen.getByTestId('tr-import-confirm'));
    await screen.findByTestId('tr-import-declined-title');

    // ⚠ The STRUCTURAL fact (the wording itself is `review:`): class B is NOT composed through class
    // A's template. That template ends "Your existing data was not changed." — a reassurance beside
    // the point in class A, where the point was the file, but INVERTED here, where not touching your
    // data IS the entire event. Ranking the protection as a footnote to a failure is the defect.
    expect(screen.getByTestId('tr-import-declined-body').textContent).not.toContain(
      'Your existing data was not changed.',
    );
    // No blame, no apology, no error severity, and no Retry/Import-anyway/Repair escape hatch: the
    // refusal is the feature. The remedy is a reload, and the body says so.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry|anyway|repair|force|clear/i })).toBeNull();

    fireEvent.click(screen.getByText('Done'));
    // The whole point: NOTHING was written. The unreadable blob survives byte-for-byte.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(corrupt);
  });

  it('AC-E15 — a declined file is not imported, the reason is from the closed set, and the readout is unchanged', async () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
    mount();
    const readBefore = screen.getByTestId('tr-read-prime').textContent;
    const blobBefore = localStorage.getItem(PORTFOLIO_V2_KEY);

    pickFile('{ not an archive at all');
    await screen.findByTestId('tr-import-confirm-title');
    fireEvent.click(screen.getByTestId('tr-import-confirm'));
    await screen.findByTestId('tr-import-declined-title');
    const declined = screen.getByTestId('tr-import-declined-body').textContent ?? '';
    expect(declined).toContain('This file couldn’t be read.'); // never a parser message
    expect(declined).toContain('Your existing data was not changed.');

    fireEvent.click(screen.getByText('Done'));
    expect(screen.getByTestId('tr-read-prime').textContent).toBe(readBefore);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(blobBefore); // byte-untouched
  });

  it('AC-E16 — a colliding, DIFFERING record is reported as a conflict, and the existing record wins', async () => {
    seedStores({ positions: [position({ id: 'p-1', realized_pl_pct: 20 })] });
    mount();
    pickFile(
      JSON.stringify({
        schema: 'convexa.archive',
        version: 1,
        exported_at: '',
        stores: {
          ghost_trade: { trades: {}, decisions: [] },
          positions: { positions: { 'p-1': position({ id: 'p-1', realized_pl_pct: 999 }) }, decisions: [] },
          orders: { orders: {} },
        },
      }),
    );
    await screen.findByTestId('tr-import-confirm-title');
    fireEvent.click(screen.getByTestId('tr-import-confirm'));
    await screen.findByTestId('tr-import-done-title');
    expect(screen.getByTestId('tr-import-conflict').textContent).toBe(
      '1 collided with a different record — your existing record was kept.',
    );
    expect(JSON.parse(localStorage.getItem(PORTFOLIO_V2_KEY) ?? '{}').positions['p-1'].realized_pl_pct).toBe(20);
  });

  it('AC-21 — export works with zero history and says the archive is empty', async () => {
    seedStores({});
    mount();
    fireEvent.click(screen.getByTestId('tr-export'));
    const result = await screen.findByTestId('tr-export-result');
    expect(result.textContent).toContain('convexa-archive-');
    expect(result.textContent).toContain("It's empty");
  });

  it('the archive block offers export + import and NOTHING destructive — no restore, replace, clear or reset', () => {
    seedStores({});
    mount();
    const archive = within(screen.getByTestId('tr-archive'));
    expect(archive.getByTestId('tr-export')).toBeTruthy();
    expect(archive.getByTestId('tr-import')).toBeTruthy();
    // The block offers exactly TWO actions. A destructive restore is the one operation
    // `[loss-free-durable-migration]` exists to forbid — not a button, not a mode, not a checkbox.
    const buttons = archive.getAllByRole('button').map((b) => b.textContent?.toLowerCase() ?? '');
    expect(buttons).toEqual(['export archive', 'import archive']);
    for (const label of buttons) {
      expect(label).not.toMatch(/restore|replace|overwrite|clear|reset|start fresh|import as new/);
    }
    expect(archive.queryByRole('checkbox')).toBeNull();
    // ("if you clear this browser's data" in the lead is a statement about the BROWSER, not an action.)
  });
});

describe('AC-E17 — the read is STATIC: a stream drop cannot touch it', () => {
  it('renders byte-identically regardless of any stream state — it accepts no live prop to change', () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
    // The component's props are `{ personaLabel }` — there is no `live`/`isLive`/`streamOffline`/
    // `offline`/`data` prop to pass, so a stream drop has NO input to this subtree. (The source scan
    // in `boundaries.spec.ts` enforces that this stays true.)
    const firstRender = mount();
    const first = firstRender.container.innerHTML;
    firstRender.unmount();
    reset();
    seedStores({ positions, positionDecisions: decisions });
    const second = mount().container.innerHTML;
    expect(second).toBe(first);
    // No offline chip, no dimming, no stale treatment, no freshness line, no Refresh.
    // (the word "stale" appears once, in `TR_BASIS_DEF`, describing a stale QUOTE at fill time —
    // a property of the recorded trade, not a freshness treatment of this readout)
    expect(surfaceText()).not.toMatch(/⏸|live offline|last updated|as of |refresh/i);
    expect(screen.queryByRole('button', { name: /refresh|retry/i })).toBeNull();
    // (an ACTUAL stream drop, driven end-to-end against the live Net P/L header on the real route,
    // is asserted in `pages/positions/positions-page.spec.tsx` — this is the signature-level half)
  });
});
