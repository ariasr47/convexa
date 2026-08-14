/**
 * ai-rec-grounding — the card + prefill-gate integration suite (PLAN F10, F17). Mounts the real app at
 * `/ticker/TSLA` against a strict fetch mock (throws on any unexpected call); the PAYLOAD FIXTURE is
 * the mock — never a mocked selector, never a mocked lookup. Covers the SPEC §3 acceptance rows that
 * are visible only when the card is actually rendered against a produced response.
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import {
  __resetMemory as __resetPositions,
  allPositions,
} from '@/features/trading/positions/store';
import { typographyTokens } from '@/shared/theme/tokens';
import type { RecResponse, RecStatus, TickerBundle } from '@convexa/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY, REASONING_PROSE_NOT_CHECKED } from './copy';
import {
  noTradeRec,
  recAllTraced,
  recBlockAbsent,
  recCouldNotCheck,
  recFabricated,
  recLocalRules,
  recLocalRulesNothingCheckable,
} from './fixtures';

function makeStatus(): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
  };
}

function installBackend(rec: RecResponse, bundle: TickerBundle = makeBundle()) {
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const calls = { rec: 0 };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/api/auth/session')) {
        return json({
          authenticated: true,
          user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        });
      }
      if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
      if (url.includes('/api/ticker/')) return json(bundle);
      if (url.includes('/api/recommendation/status/')) return json(makeStatus());
      if (url.includes('/api/recommendation/') && method === 'POST') {
        calls.rec++;
        return json(rec);
      }
      if (url.includes('/api/personas')) return json(PRESETS);
      if (url.includes('/api/contract/')) return json(null);
      if (url.includes('/history'))
        return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
      throw new Error(`Unexpected fetch in ai-rec-grounding test: ${url}`);
    }),
  );

  return { calls };
}

function renderApp() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <App />
    </MemoryRouter>,
  );
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}
async function ask(user: ReturnType<typeof renderApp>) {
  await waitFor(() =>
    expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeEnabled(),
  );
  await user.click(within(panel()).getByRole('button', { name: COPY.action.get }));
}

/**
 * F12 — locate a `RiskField`'s VALUE element (never the label, never the clause) by its label text.
 * `Field`'s DOM shape is `<Box><Stack><Typography(label)/></Stack><Typography(value)/></Box>` — the
 * label (`variant="caption"`) renders as a `<span>`, the value (`variant="body2"`) as a `<p>`, so
 * climbing from the label's nearest `<div>` ancestor (the `Stack`) to its parent (the `Box`) and
 * querying the first `<p>` reaches exactly the value node the register applies to.
 */
function fieldValueEl(label: string): HTMLElement {
  const labelEl = within(panel()).getByText(label);
  const fieldBox = labelEl.closest('div')?.parentElement as HTMLElement;
  const value = fieldBox.querySelector('p');
  if (!value) throw new Error(`no value <p> found for field "${label}"`);
  return value as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  __resetPositions();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

// =================================================================================================
// F10 — the card component specs
// =================================================================================================
describe('ai-rec-grounding · the card (F10)', () => {
  it('AC-15/AC-18 — recAllTraced renders exactly ONE grounding-card-line, affirmative, between the hero and the cap surface', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces to a Convexa number\./);
    expect(within(panel()).queryAllByTestId('grounding-card-line')).toHaveLength(1);
  });

  it('AC-17 — the count reads 4, never `of 5` or `of 6`', async () => {
    const rec = recAllTraced();
    rec.grounding = {
      ...rec.grounding!,
      card: 'some_traced',
      counts: { checked: 4, traced: 3, untraced: 1, not_checkable: 0 },
    };
    installBackend(rec);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/3 of 4 checked figures/);
    expect(within(panel()).queryByText(/of 5|of 6/)).toBeNull();
  });

  it('AC-1/AC-11 — on a fabricated rec, stop/target/invalidation each render their VALUE and exactly one clause', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    expect(within(panel()).getAllByTestId('clause-stop')).toHaveLength(1);
    expect(within(panel()).getAllByTestId('clause-target')).toHaveLength(1);
    expect(within(panel()).getAllByTestId('clause-invalidation')).toHaveLength(1);
  });

  it("AC-44 (SB) — recFabricated shows the AI's own number on every checked, value-bearing figure", async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    expect(within(panel()).getAllByText("the AI's own number").length).toBeGreaterThanOrEqual(3);
  });

  it('AC-25 (SB) — Structure/Strike(s)/Expiration/Entry trigger carry NO clause on any fixture', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    expect(within(panel()).queryAllByTestId(/^clause-/).length).toBe(3); // stop, target, invalidation only
  });

  it('AC-26 — Max risk and Suggested size carry no clause on any fixture', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);
    const maxRiskLabel = within(panel()).getByText(COPY.risk.maxRisk).closest('div');
    expect(maxRiskLabel?.querySelector('[data-clause]')).toBeNull();
  });

  it('AC-19 (SB) — no_trade renders NO card line, NO clause, NO cap surface', async () => {
    installBackend(noTradeRec());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByTestId('grounding-card-line')).toBeNull();
    expect(within(panel()).queryAllByTestId(/^clause-/)).toHaveLength(0);
    expect(within(panel()).queryByTestId('cap-annotation')).toBeNull();
  });

  it('AC-27 (SB) — a block-absent rec renders exactly ONE card line in place of every per-figure clause; the rest of the card renders in full', async () => {
    installBackend(recBlockAbsent());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText("This read wasn't checked against Convexa's numbers.");
    expect(within(panel()).queryAllByTestId('grounding-card-line')).toHaveLength(1);
    expect(within(panel()).queryAllByTestId(/^clause-/)).toHaveLength(0);
    // The rest of the card still renders: the verdict, and an Accept affordance.
    expect(within(panel()).getByRole('button', { name: COPY.action.accept })).toBeInTheDocument();
  });

  it('AC-28 (SB) — recCouldNotCheck renders in full; every checked figure carries the could-not-check clause', async () => {
    installBackend(recCouldNotCheck());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Convexa couldn't check these figures this cycle\./);
    expect(within(panel()).getAllByText("couldn't check this").length).toBe(3);
  });

  it('AC-20 — a local-rules rec states the calm caption, no warning icon, clauses render normally', async () => {
    installBackend(recLocalRules());
    const user = renderApp();
    await settle();
    await ask(user);
    const line = await within(panel()).findByTestId('grounding-card-line');
    expect(line).toHaveTextContent(
      "No AI read here — these figures come from Convexa's own rules.",
    );
    expect(line.querySelector('svg[color="warning"]')).toBeNull();
  });

  it('AC-64 — a local-rules rec with nothing checkable renders NO card line and NO clause', async () => {
    installBackend(recLocalRulesNothingCheckable());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.action.accept);
    expect(within(panel()).queryByTestId('grounding-card-line')).toBeNull();
    expect(within(panel()).queryAllByTestId(/^clause-/)).toHaveLength(0);
  });

  it('AC-13 (SB) — the Accept affordance renders identically on a fabricated and an all-traced rec', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(within(panel()).getByRole('button', { name: COPY.action.accept })).toBeInTheDocument();
  });

  it('AC-62 — recAllTraced carries ≤3 per-figure clauses and exactly 1 card line; no_trade carries 0 of both', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);
    expect(within(panel()).queryAllByTestId(/^clause-/).length).toBeLessThanOrEqual(3);
    expect(within(panel()).queryAllByTestId('grounding-card-line')).toHaveLength(1);
  });

  it('AC-32 (amended) — no grounding wire token ever renders as user-visible text', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    // Scoped to the ai-rec panel — a pre-existing, unrelated bundle-tile literal elsewhere on the
    // page happens to spell one of these tokens (`gex_spot`, as the straddle-move anchor-basis
    // label), which is out of this feature's lane and not the claim AC-32 makes.
    const text = panel().textContent ?? '';
    const tokens = [
      'not_applicable',
      'not_checkable',
      'local_rules',
      'none_traced',
      'could_not_check',
      'some_traced',
      'all_traced',
      'inside_range',
      'no_named_level',
      'no_cited_expiration',
      'straddle_move_unavailable',
      'structurally_unchecked',
      'no_text',
      'no_dollar_figure',
      'multiple_different_figures',
      'gex_spot',
      'call_wall',
      'put_wall',
      'peak_gex_strike',
      'gamma_flip',
      'max_pain',
      'vwap_upper_2',
      'vwap_upper_3',
      'vwap_lower_2',
      'vwap_lower_3',
    ];
    for (const t of tokens) expect(text).not.toContain(t);
    // Anti-vacuity: the same probe over a hand-built poison string DOES fire.
    expect('this card is not_checkable today').toContain('not_checkable');
  });

  // -----------------------------------------------------------------------------------------------
  // F12 — the type register, asserted at RENDERED scope (DESIGN_SYSTEM Amendment 2026-08-13, D3).
  // The unit-level poison-proof lives in `literals.spec.ts`; this is the POSITIVE assertion at the
  // scope that actually matters — a guard asserting only negatives can pass over an empty surface
  // (the exact GATE Q trap this feature was warned against repeating).
  // -----------------------------------------------------------------------------------------------
  it('AC-9 / F12 — a TRACED value renders mono; an UNTRACED value renders sans, on the real card', async () => {
    const traced = recAllTraced();
    installBackend(traced);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);
    const stopVal = fieldValueEl('Stop');
    const targetVal = fieldValueEl('Target');
    const invalidationVal = fieldValueEl(COPY.risk.invalidation);
    // VACUITY GUARD — the values really did render with real text, not an empty node.
    expect(stopVal.textContent).toBe(String(traced.strategy!.exit_plan.stop));
    expect(targetVal.textContent).toBe(String(traced.strategy!.exit_plan.target));
    expect(invalidationVal.textContent).toBe(String(traced.strategy!.invalidation_level));
    for (const el of [stopVal, targetVal, invalidationVal]) {
      expect(getComputedStyle(el).fontFamily).toContain('IBM Plex Mono');
    }
    cleanup();
    vi.unstubAllGlobals();

    const untraced = recFabricated();
    installBackend(untraced);
    const user2 = renderApp();
    await settle();
    await ask(user2);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    const stopVal2 = fieldValueEl('Stop');
    const targetVal2 = fieldValueEl('Target');
    const invalidationVal2 = fieldValueEl(COPY.risk.invalidation);
    expect(stopVal2.textContent).toBe(String(untraced.strategy!.exit_plan.stop));
    for (const el of [stopVal2, targetVal2, invalidationVal2]) {
      const family = getComputedStyle(el).fontFamily;
      expect(family).toContain('IBM Plex Sans');
      expect(family).not.toContain('IBM Plex Mono');
    }
  });

  it('AC-9 / F12 — `not_checkable` renders SANS too, distinct from `traced`, on the real card', async () => {
    const notCheckable = recCouldNotCheck();
    installBackend(notCheckable);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Convexa couldn't check these figures this cycle\./);
    const stopVal = fieldValueEl('Stop');
    expect(stopVal.textContent).toBe(String(notCheckable.strategy!.exit_plan.stop));
    const family = getComputedStyle(stopVal).fontFamily;
    expect(family).toContain('IBM Plex Sans');
    expect(family).not.toContain('IBM Plex Mono');
  });

  it('F12 — the register never carries the state ALONE: the visible clause text is present alongside it in both registers (D3, complementary not alternative)', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    const stopVal = fieldValueEl('Stop');
    expect(getComputedStyle(stopVal).fontFamily).toContain('IBM Plex Sans');
    expect(within(panel()).getByTestId('clause-stop')).toHaveTextContent("the AI's own number");
  });

  it('F12 — zero hardcoded hex; the register resolves through the shared theme token, not a literal', () => {
    // typographyTokens carries the ONLY two font-family strings this feature may reference — no hex,
    // no ad hoc font name, so a rename of either family propagates from one place.
    expect(typographyTokens.monoFontFamily).toMatch(/IBM Plex Mono/);
    expect(typographyTokens.fontFamily).toMatch(/IBM Plex Sans/);
    expect(typographyTokens.monoFontFamily).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(typographyTokens.fontFamily).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

// =================================================================================================
// F17 — the prefill-gate integration specs (AC-7, AC-68)
// =================================================================================================
describe('ai-rec-grounding · the prefill gate, end to end (F17)', () => {
  it('AC-7 (SB) · traced — Accept seeds the dialog exactly as on `main`; no withheld-reason node exists', async () => {
    const rec = recAllTraced();
    installBackend(rec);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe(
      String(rec.strategy!.exit_plan.stop),
    );
    expect((within(dialog).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe(
      String(rec.strategy!.exit_plan.target),
    );
    expect(within(dialog).queryByTestId('entry-stop-withheld')).toBeNull();
    expect(within(dialog).queryByTestId('entry-target-withheld')).toBeNull();
  });

  it('AC-7 (SB) · untraced — Accept opens both price fields EMPTY with the untraced reason line', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByTestId('entry-stop-withheld')).toHaveTextContent(
      "Not pre-filled — this was the AI's own number.",
    );
    expect(within(dialog).getByTestId('entry-target-withheld')).toHaveTextContent(
      "Not pre-filled — this was the AI's own number.",
    );
  });

  it('AC-7 (SB) · not_checkable — Accept opens empty with the not_checkable reason line', async () => {
    installBackend(recCouldNotCheck());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Convexa couldn't check these figures this cycle\./);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByTestId('entry-stop-withheld')).toHaveTextContent(
      "Not pre-filled — Convexa couldn't check this figure.",
    );
  });

  it('AC-7 (SB) + AC-68 (D8) · block absent — Accept opens both fields EMPTY with the block-absent reason, never the not_checkable literal', async () => {
    installBackend(recBlockAbsent());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText("This read wasn't checked against Convexa's numbers.");
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe('');
    const reason = "Not pre-filled — this read wasn't checked against Convexa's numbers.";
    expect(within(dialog).getByTestId('entry-stop-withheld')).toHaveTextContent(reason);
    expect(within(dialog).getByTestId('entry-target-withheld')).toHaveTextContent(reason);
    expect(within(dialog).getByTestId('entry-stop-withheld').textContent).not.toBe(
      "Not pre-filled — Convexa couldn't check this figure.",
    );
  });

  it('AC-7 (SB) · nothing else derived — quantity still opens at the dialog default of 1; strike/right come from the rec', async () => {
    const rec = recFabricated();
    installBackend(rec);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    await user.click(within(panel()).getByRole('button', { name: COPY.action.accept }));
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText(/Quantity/) as HTMLInputElement).value).toBe('1');
    expect(allPositions()).toEqual([]); // advice, not a command — nothing tracked pre-confirm
  });

  it('AC-68 · never silent — every empty price field has a non-empty sibling reason node (arms untraced/not_checkable/block-absent)', async () => {
    for (const rec of [recFabricated(), recCouldNotCheck(), recBlockAbsent()]) {
      installBackend(rec);
      const user = renderApp();
      await settle();
      await ask(user);
      await user.click(await within(panel()).findByRole('button', { name: COPY.action.accept }));
      const dialog = await screen.findByRole('dialog');
      expect((within(dialog).getByLabelText('Stop (optional)') as HTMLInputElement).value).toBe('');
      expect((within(dialog).getByLabelText('Target (optional)') as HTMLInputElement).value).toBe(
        '',
      );
      expect(within(dialog).getByTestId('entry-stop-withheld')).not.toHaveTextContent('');
      expect(within(dialog).getByTestId('entry-target-withheld')).not.toHaveTextContent('');
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('single-shared-sim-entry-dialog — no second component EXPORTED as /^TradeEntry.*Dialog$/ exists besides the shipped one', () => {
    const files = import.meta.glob('../../../../features/trading/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(0); // anti-vacuity: the glob found real files
    // Matches the exact exported name "TradeEntry...Dialog" (e.g. `TradeEntryDialog`), never a
    // trailing-suffixed internal helper like `TradeEntryDialogView` — that view component is the ONE
    // dialog's own presentational layer, not a second dialog.
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('.spec.')) continue;
      for (const m of src.matchAll(/export\s+function\s+(TradeEntry\w*Dialog)\b/g)) {
        if (/^TradeEntry.*Dialog$/.test(m[1])) offenders.push(path);
      }
    }
    // The public re-export lives at `TradeEntryDialog.tsx`; the ONE real definition (what this guard
    // is actually pinning) lives at `tradeEntry/TradeEntryDialogView.tsx` — `TradeEntryDialog.tsx`
    // itself declares no function, only a re-export.
    expect(offenders).toEqual(['../../../../features/trading/tradeEntry/TradeEntryDialogView.tsx']);
  });
});

// =================================================================================================
// GATE Z Z-F1 — AC-33: the prose-numbers-are-not-checked disclosure
// =================================================================================================
describe('ai-rec-grounding · AC-33 (GATE Z Z-F1) — the reasoning carries its own disclosure', () => {
  it('renders visibly, placed WITH the reasoning (not with the fields), on a produced trade card', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);
    const node = within(panel()).getByTestId('reasoning-prose-not-checked');
    expect(node).toHaveTextContent(REASONING_PROSE_NOT_CHECKED);
    // "Placed with the reasoning, not with the fields" — it must sit inside the same section as
    // `Why` / `Analyst read`, never inside a `RiskField`'s Box (which would pair it with a value).
    expect(node.closest('[data-testid^="clause-"]')).toBeNull();
    for (const label of ['Stop', 'Target', COPY.risk.invalidation, COPY.risk.maxRisk]) {
      const fieldLabel = within(panel()).getByText(label);
      expect(fieldLabel.closest('div')?.parentElement?.contains(node)).toBe(false);
    }
  });

  it('also renders on a no_trade card (the reasoning still carries prose there)', async () => {
    installBackend(noTradeRec());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).getByTestId('reasoning-prose-not-checked')).toHaveTextContent(
      REASONING_PROSE_NOT_CHECKED,
    );
  });

  it('is disjoint from every other closed-set literal and carries no banned word', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    const cardLine = within(panel()).getByTestId('grounding-card-line').textContent ?? '';
    expect(REASONING_PROSE_NOT_CHECKED).not.toBe(cardLine);
    expect(REASONING_PROSE_NOT_CHECKED.toLowerCase()).not.toMatch(
      /\b(verified|confirmed|validated|approved|safe|trusted|grounding|hallucinated|suspect|invalid)\b/,
    );
  });
});

// =================================================================================================
// The seven-AC coverage gap (GATE Z bounce, shared item) — AC-12, AC-29 named here; AC-2/AC-23 live
// in `literals.spec.ts` (pure-function layer); AC-30/AC-31 extend the shipped SSE/superseded tests in
// `ai-rec.risk.spec.tsx`.
// =================================================================================================
describe('ai-rec-grounding · the seven-AC coverage gap (GATE Z bounce, shared item)', () => {
  it('AC-12 — no numeric figure renders as an attributed quotation from the model', async () => {
    installBackend(recFabricated());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/No figure here traces to a Convexa number\./);
    for (const label of ['Stop', 'Target', COPY.risk.invalidation]) {
      const el = fieldValueEl(label);
      // A verbatim-quoted numeric figure would read like `"6"` or `“6”` — never the case for a
      // GROUNDED figure (verbatim quotation is reserved for the one honest class: prose that cannot
      // be read as a number at all, e.g. `max_risk`, which this loop does not touch).
      expect(el.textContent ?? '').not.toMatch(/["“”]/);
    }
  });

  it('AC-29 — the bundle-failure (unavailable) envelope renders no card-level line and no per-figure clause at all', async () => {
    const rec: RecResponse = {
      ...noTradeRec(),
      status: 'unavailable',
      strategy: null,
      unavailable_reason: 'transport',
    };
    installBackend(rec);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.unavailable.title);
    expect(within(panel()).queryByTestId('grounding-card-line')).toBeNull();
    expect(within(panel()).queryAllByTestId(/^clause-/)).toHaveLength(0);
  });
});

// =================================================================================================
// AC-34 (GATE Z coverage gap, item 2 of 2 — the FE half of the seven-AC list) — numbers inside the
// AI's free prose acquire NO grounding treatment and never move the counts. Both halves NON-VACUOUS
// (the fixture's prose genuinely contains numbers) and POISON-PROVED (see the poison drill run
// alongside this change; restored byte-identically — `git diff --stat` on this file is the receipt).
// =================================================================================================
describe('ai-rec-grounding · AC-34 — prose numbers acquire no marker and are excluded from the counts', () => {
  function withProseNumbers(base: RecResponse): RecResponse {
    return {
      ...base,
      strategy: {
        ...base.strategy!,
        key_points: [
          'Gamma flip sits at 248, below spot — dealers are long gamma.',
          'IV/HV at 1.12 is only mildly rich.',
        ],
        reengage_when: ['If spot breaks below 240 the setup is invalidated.'],
        rationale:
          'The 260 call wall caps upside near-term. A break above 265 would change the read.',
      },
    };
  }

  it('AC-34(a) — no number inside the reasoning prose acquires a grounding state, marker, chip, tint, link or tooltip', async () => {
    installBackend(withProseNumbers(recAllTraced()));
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(/Every checked figure traces/);

    // VACUITY GUARD — the prose really does carry numbers, or this test proves nothing (the exact
    // trap named in the bounce: a numberless card would pass vacuously).
    const items = within(panel()).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((el) => /\d/.test(el.textContent ?? ''))).toBe(true);

    for (const el of items) {
      expect(el.getAttribute('data-clause')).toBeNull();
      expect(el.closest('[data-testid^="clause-"]')).toBeNull();
      expect(el.closest('a')).toBeNull();
      expect(el.getAttribute('title')).toBeNull();
      // The type register (F12) is reserved for the three GROUNDED fields — a prose number must
      // never pick up the mono register, which in this app now specifically claims "traces to
      // Convexa" (DESIGN_SYSTEM Amendment 2026-08-13).
      expect(getComputedStyle(el).fontFamily).not.toContain('IBM Plex Mono');
    }

    // The expanded "Analyst read" prose carries a number too ("265") — same guarantees apply there.
    await user.click(within(panel()).getByRole('button', { name: COPY.reasoning.showMore }));
    const detail = await within(panel()).findByText(/A break above 265/);
    expect(detail.getAttribute('data-clause')).toBeNull();
    expect(detail.closest('[data-testid^="clause-"]')).toBeNull();
    expect(detail.closest('a')).toBeNull();
    expect(detail.getAttribute('title')).toBeNull();
    expect(getComputedStyle(detail).fontFamily).not.toContain('IBM Plex Mono');
  });

  it('AC-34(b) — prose numbers are excluded from the counts: the rendered line tracks `grounding.counts`, never the prose', async () => {
    installBackend(withProseNumbers(recAllTraced()));
    const user = renderApp();
    await settle();
    await ask(user);
    // The prose above carries several numbers (248, 1.12, 240, 260, 265) — NONE of them is 4, and
    // the card still reads exactly the server's `checked` integer.
    await within(panel()).findByText('Every checked figure traces to a Convexa number.');
    cleanup();
    vi.unstubAllGlobals();

    const threeOfFour = withProseNumbers(recAllTraced());
    threeOfFour.grounding = {
      ...threeOfFour.grounding!,
      card: 'some_traced',
      counts: { checked: 4, traced: 3, untraced: 1, not_checkable: 0 },
    };
    installBackend(threeOfFour);
    const user2 = renderApp();
    await settle();
    await ask(user2);
    // SAME prose, same numbers in it — the rendered line changes ONLY because `counts` changed,
    // proving the line is counts-driven and never derived from (or perturbed by) the prose.
    await within(panel()).findByText(
      '3 of 4 checked figures trace to a Convexa number — each exception says so below.',
    );
  });
});
