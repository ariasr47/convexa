import { typographyTokens } from '@/shared/theme/tokens';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_FIELDS_NOT_CHECKED } from './copy';
import { DecisionCard } from './DecisionCard';
import {
  noTradeRec,
  recAllTraced,
  recBlockAbsent,
  recFabricated,
  recLocalRules,
  recLocalRulesNothingCheckable,
  recNoneNamed,
  tradeRecNoRiskBlock,
} from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);
const actions = (o: Partial<AiRecPresentation['actions']> = {}) => ({
  directExport: false,
  analyze: false,
  askAnyway: false,
  retry: false,
  settings: false,
  signIn: false,
  reviewTrade: true,
  createOrder: true,
  analysis: true,
  refresh: false,
  dismiss: true,
  ...o,
});
const pres = (o: Partial<AiRecPresentation> = {}): AiRecPresentation => ({
  requestState: 'idle',
  resultState: 'fresh_trade',
  missingPositionFields: [],
  actions: actions(),
  ...o,
});
const renderCard = (
  rec = recAllTraced(),
  presentation = pres(),
  bundle: any = null,
  onCreateOrder: (() => void) | null = vi.fn(),
) =>
  render(
    <DecisionCard
      rec={rec}
      bundle={bundle}
      presentation={presentation}
      dataAge="older data"
      onReview={vi.fn()}
      onCreateOrder={onCreateOrder ?? undefined}
      onAnalysis={vi.fn()}
      onRefresh={vi.fn()}
      onDismiss={vi.fn()}
    />,
  );

describe('DecisionCard observable contract', () => {
  // Row 31 (SPEC §4.5, FE-9): the four risk fields render their grounding BEFORE any prose —
  // `decision-grid` now precedes `decision-thesis`, the deliberate reorder that makes
  // `AiRecPanel.tsx`'s own long-standing header doc ("risk + invalidation FIRST") literally true.
  it('keeps the fixed hierarchy in DOM order', () => {
    renderCard();
    const ids = [
      'decision-context',
      'decision-provenance',
      'decision-verdict',
      'decision-metadata',
      'plan-fields-not-checked',
      'decision-grid',
      'decision-thesis',
      'decision-evidence',
      'decision-actions',
    ];
    for (let i = 0; i < ids.length - 1; i++)
      expect(
        screen.getByTestId(ids[i]).compareDocumentPosition(screen.getByTestId(ids[i + 1])) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
  });
  it('tabs through every help trigger with unique names', async () => {
    const user = userEvent.setup();
    renderCard();
    const helps = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.includes('help'));
    expect(new Set(helps.map((b) => b.getAttribute('aria-label'))).size).toBe(helps.length);
    for (const help of helps) {
      await user.tab();
      expect(document.activeElement).toBe(help);
      expect(help).toHaveAttribute('aria-label');
    }
  });
  it('names each incomplete position field exactly once', () => {
    renderCard(
      recNoneNamed(),
      pres({
        resultState: 'incomplete_trade',
        missingPositionFields: ['Structure', 'Strike(s)', 'Expiration', 'Entry trigger'],
        actions: actions({ reviewTrade: false, createOrder: false, refresh: true }),
      }),
    );
    const explanation = screen.getByTestId('rec-not-actionable').textContent ?? '';
    for (const field of ['Structure', 'Strike(s)', 'Expiration', 'Entry trigger'])
      expect(
        (explanation.match(new RegExp(field.replace(/[()]/g, '\\$&'), 'g')) ?? []).length,
      ).toBe(1);
  });
  it('retains full key/persona/as-of/risk provenance without context duplicates', () => {
    const rec = recAllTraced();
    rec.key_source = 'own_key';
    rec.sent!.risk_inputs!.state = 'set';
    renderCard(rec);
    expect(screen.getAllByText('Persona · Default (no persona)')).toHaveLength(1);
    expect(screen.getByText(/As of/)).toBeInTheDocument();
    expect(screen.getByText('Using your key')).toBeInTheDocument();
    expect(screen.getByTestId('ai-rec-provenance-chip')).toBeInTheDocument();
  });
  it('subscription provenance is your Grok subscription, never BYO Grok or a pool', () => {
    const rec = recAllTraced();
    rec.key_source = 'grok_subscription';
    rec.provider = null;
    rec.model = 'grok-3';
    renderCard(rec);
    expect(screen.getByText('your Grok subscription')).toBeInTheDocument();
    expect(screen.getByText('Model · grok-3')).toBeInTheDocument();
    expect(screen.queryByText('Using your Grok key')).toBeNull();
    expect(screen.queryByText(/Convexa Grok pool|free uses/i)).toBeNull();
  });
  it('own-key BYO Grok is distinct from subscription', () => {
    const rec = recAllTraced();
    rec.key_source = 'own_key';
    rec.provider = 'xai';
    rec.model = 'grok-3';
    renderCard(rec);
    expect(screen.getByText('Using your Grok key')).toBeInTheDocument();
    expect(screen.queryByText('your Grok subscription')).toBeNull();
  });
  it('omits unnamed model chip — never invents default', () => {
    const rec = recAllTraced();
    rec.key_source = 'own_key';
    rec.provider = 'anthropic';
    rec.model = null;
    renderCard(rec);
    expect(screen.getByText('Using your Anthropic key')).toBeInTheDocument();
    expect(screen.queryByText(/Model ·/)).toBeNull();
    expect(screen.queryByText(/Model · default/i)).toBeNull();
  });
  it('shows stale-born warning icon and superseded recovery copy', () => {
    const rec = recAllTraced();
    rec.stale_born = true;
    renderCard(
      rec,
      pres({
        resultState: 'stale_at_generation',
        actions: actions({ reviewTrade: false, createOrder: false, refresh: true }),
      }),
    );
    const staleAlerts = screen.getAllByRole('alert');
    expect(staleAlerts).toHaveLength(1);
    expect(staleAlerts[0]).toHaveTextContent('already marked stale');
    expect(staleAlerts[0].querySelector('[data-testid="WarningAmberIcon"]')).toBeTruthy();
    cleanup();
    renderCard(
      recAllTraced(),
      pres({
        resultState: 'superseded_inputs',
        actions: actions({ reviewTrade: false, createOrder: false, refresh: true }),
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('risk inputs changed');
  });
  it('shows stale-newer recovery without simulated actions', () => {
    renderCard(
      recAllTraced(),
      pres({
        resultState: 'stale_newer_snapshot',
        actions: actions({ reviewTrade: false, createOrder: false, refresh: true }),
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('newer snapshot');
    expect(screen.getByRole('button', { name: 'Refresh analysis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review simulated trade' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create sim order' })).toBeNull();
  });
  it('places cap annotation after grounding evidence', () => {
    renderCard();
    const evidence = screen.getByTestId('decision-evidence');
    expect(evidence.querySelector('[data-testid="grounding-card-line"]')).toBeTruthy();
    expect(evidence.querySelector('[data-testid="cap-annotation"]')).toBeTruthy();
    expect(
      evidence
        .querySelector('[data-testid="grounding-card-line"]')!
        .compareDocumentPosition(evidence.querySelector('[data-testid="cap-annotation"]')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('filters NaN/Infinity response and DTE values', () => {
    const rec = recAllTraced();
    rec.strategy!.strikes = [NaN, Infinity];
    const bundle = { market_state: { dte_min: NaN, dte_max: Infinity } };
    renderCard(rec, pres(), bundle);
    const text = screen.getByTestId('ai-rec-decision-card').textContent ?? '';
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(text).not.toContain('your DTE window');
  });
  it('does not render retired labels or clauses for absence literals', () => {
    const rec = recNoneNamed();
    rec.strategy!.invalidation_level = null;
    renderCard(
      rec,
      pres({
        resultState: 'incomplete_trade',
        missingPositionFields: ['Structure'],
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    const text = screen.getByTestId('ai-rec-decision-card').textContent ?? '';
    expect(text).not.toMatch(
      /Accept into ghost trade|Act as sim order|Get a fresh recommendation|Show full analysis|ghost trade/,
    );
    expect(screen.queryByTestId('clause-invalidation')).toBeNull();
  });
  it('omits order action when callback is absent', () => {
    renderCard(recAllTraced(), pres(), null, null);
    expect(screen.queryByRole('button', { name: 'Create sim order' })).toBeNull();
  });
  it('consumes the policy gate after sign-out even when the host callback remains available', () => {
    renderCard(
      recAllTraced(),
      pres({ actions: actions({ createOrder: false, reviewTrade: false }) }),
      null,
      vi.fn(),
    );
    expect(screen.queryByRole('button', { name: 'Create sim order' })).toBeNull();
  });
  it('renders scripted warning plus simulated framing', () => {
    const rec = recAllTraced();
    rec.scenario = { id: 's', name: 'Scripted' } as never;
    renderCard(rec);
    expect(screen.getByRole('alert')).toHaveTextContent('Scripted scenario');
    expect(screen.getByRole('alert')).toHaveTextContent('SIMULATED / advisory');
  });
  it('keeps absent confidence help and finite DTE exactly once', () => {
    const rec = recAllTraced();
    rec.strategy!.confidence = null;
    const bundle = { market_state: { dte_min: 7, dte_max: 45 } };
    renderCard(rec, pres(), bundle);
    expect(screen.getByRole('button', { name: 'Confidence help' })).toBeInTheDocument();
    expect(screen.getAllByText(/your DTE window: 7–45/)).toHaveLength(1);
  });
  it('keeps not-set risk recovery and grounding register semantics', () => {
    renderCard(tradeRecNoRiskBlock());
    expect(screen.getByText('Set your risk inputs')).toHaveAttribute(
      'href',
      '/settings#risk-inputs',
    );
  });
  it('proves grounding registers and value-only clauses', () => {
    renderCard(recAllTraced());
    const traced = screen.getByText('245');
    expect(window.getComputedStyle(traced).fontFamily.replace(/["']/g, '')).toContain(
      typographyTokens.monoFontFamily.replace(/["']/g, ''),
    );
    expect(screen.getByTestId('clause-invalidation')).toHaveTextContent(
      "traces to Convexa's levels spot (245)",
    );
    cleanup();
    renderCard(recFabricated());
    const untraced = screen.getByText('245');
    expect(window.getComputedStyle(untraced).fontFamily.replace(/["']/g, '')).not.toContain(
      typographyTokens.monoFontFamily.replace(/["']/g, ''),
    );
    expect(screen.getByTestId('clause-invalidation')).toHaveTextContent("the AI's own number");
    cleanup();
    const absent = recNoneNamed();
    absent.strategy!.invalidation_level = null;
    renderCard(
      absent,
      pres({
        resultState: 'incomplete_trade',
        missingPositionFields: ['Structure'],
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.queryByTestId('clause-invalidation')).toBeNull();
  });
  it('keeps no-trade complete without grid or simulated actions', () => {
    renderCard(
      noTradeRec(),
      pres({
        resultState: 'no_trade',
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.getByText('No trade — sit this one out')).toBeInTheDocument();
    expect(screen.queryByTestId('decision-grid')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review simulated trade' })).toBeNull();
  });
});

describe('plan-scope caption on DecisionCard', () => {
  it('renders exactly one caption after decision-metadata on a non-local_rules trade', () => {
    renderCard(recAllTraced());
    const caption = screen.getByTestId('plan-fields-not-checked');
    expect(caption).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
    expect(screen.getAllByTestId('plan-fields-not-checked')).toHaveLength(1);
    const meta = screen.getByTestId('decision-metadata');
    expect(meta.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.contains(caption)).toBe(false);
    expect(caption.closest('[data-testid^="clause-"]')).toBeNull();
    expect(caption.closest('[data-testid="grounding-card-line"]')).toBeNull();
    expect(caption.closest('[data-testid="rec-not-actionable"]')).toBeNull();
  });

  it('sits before decision-thesis when a lead exists', () => {
    const rec = recAllTraced();
    rec.strategy!.rationale = 'Lead sentence. More detail follows.';
    renderCard(rec);
    const caption = screen.getByTestId('plan-fields-not-checked');
    const thesis = screen.getByTestId('decision-thesis');
    expect(caption.compareDocumentPosition(thesis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses quiet caption chrome (AC-17)', () => {
    renderCard(recAllTraced());
    const caption = screen.getByTestId('plan-fields-not-checked');
    expect(caption.tagName.toLowerCase()).toBe('span'); // MUI Typography caption → span
    expect(caption).toHaveTextContent(PLAN_FIELDS_NOT_CHECKED);
  });

  it('is absent on local_rules with a poison shared_admin key_source (AC-2)', () => {
    const rec = recLocalRules();
    // Negative fixture only — not a live powering path.
    (rec as { key_source?: string }).key_source = 'shared_admin';
    rec.remaining_free_uses = 1;
    renderCard(rec);
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
  });

  it('is present on not_applicable (AC-2r) and missing grounding', () => {
    renderCard(recLocalRulesNothingCheckable());
    expect(screen.getByTestId('plan-fields-not-checked')).toBeInTheDocument();
    cleanup();
    renderCard(recBlockAbsent());
    expect(screen.getByTestId('plan-fields-not-checked')).toBeInTheDocument();
  });

  it('is absent on no_trade and reserved dash treatment stays (AC-5)', () => {
    renderCard(
      noTradeRec(),
      pres({
        resultState: 'no_trade',
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.queryByTestId('plan-fields-not-checked')).toBeNull();
    expect(screen.queryByTestId('decision-metadata')).toBeNull();
  });
});

// =================================================================================================
// Fidelity repair 2, N5 — the provenance chip's "As of" and the structure line's expiration read
// through fmtAsOfEt/fmtExpiry; the raw ISO/date string never reaches the DOM. `data-rec-as-of` keeps
// the raw ISO (a machine attribute, not copy) — untouched.
// =================================================================================================
describe('DecisionCard — as-of and expiration are formatted, never raw (fidelity repair 2, N5)', () => {
  it('the raw ISO as_of string is absent from the DOM text; the design-shaped "HH:MM:SS ET" chip is present', () => {
    renderCard(recAllTraced());
    const card = screen.getByTestId('ai-rec-decision-card');
    expect(card.textContent).not.toContain('2026-06-26T14:00:00Z');
    expect(screen.getByText(/^As of \d{2}:\d{2}:\d{2} ET/)).toBeInTheDocument();
  });

  it('the raw expiration date string is absent from decision-metadata; the design-shaped "Mon D (N DTE)" form is present', () => {
    renderCard(recAllTraced());
    const metadata = screen.getByTestId('decision-metadata');
    expect(metadata.textContent).not.toContain('2026-07-18');
    expect(metadata.textContent).toMatch(/Jul \d+ \(\d+ DTE\)/);
  });

  it('data-rec-as-of keeps the raw ISO on the card root — a machine attribute, never copy', () => {
    renderCard(recAllTraced());
    expect(screen.getByTestId('ai-rec-decision-card')).toHaveAttribute(
      'data-rec-as-of',
      '2026-06-26T14:00:00Z',
    );
  });
});
