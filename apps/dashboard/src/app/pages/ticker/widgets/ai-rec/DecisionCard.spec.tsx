import { typographyTokens } from '@/shared/theme/tokens';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_FIELDS_NOT_CHECKED } from './copy';
import { DecisionCard } from './DecisionCard';
import { noTradeRec, recAllTraced, recFabricated, recNoneNamed } from './fixtures';
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
  it('filters NaN/Infinity response and DTE values', () => {
    const rec = recAllTraced();
    rec.strategy!.strikes = [NaN, Infinity];
    const bundle = { market_state: { dte_min: NaN, dte_max: Infinity } };
    renderCard(rec, pres(), bundle);
    const text = screen.getByTestId('ai-rec-decision-card').textContent ?? '';
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(text).not.toContain('your DTE window');
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
  it('keeps no-trade complete without a decision grid', () => {
    renderCard(
      noTradeRec(),
      pres({
        resultState: 'no_trade',
        actions: actions({ reviewTrade: false, createOrder: false }),
      }),
    );
    expect(screen.getByText('No trade — sit this one out')).toBeInTheDocument();
    expect(screen.queryByTestId('decision-grid')).toBeNull();
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
});
