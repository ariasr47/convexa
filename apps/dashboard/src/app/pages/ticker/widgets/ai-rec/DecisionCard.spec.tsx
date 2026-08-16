import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionCard } from './DecisionCard';
import { noTradeRec, recAllTraced, recNoneNamed } from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);
const actions = (over: Partial<AiRecPresentation['actions']> = {}): AiRecPresentation['actions'] => ({ directExport: false, analyze: false, askAnyway: false, retry: false, settings: false, signIn: false, reviewTrade: true, createOrder: true, analysis: true, refresh: false, dismiss: true, ...over });
const presentation = (over: Partial<AiRecPresentation> = {}): AiRecPresentation => ({ requestState: 'idle', resultState: 'fresh_trade', missingPositionFields: [], actions: actions(), ...over });
const renderCard = (rec = recAllTraced(), p = presentation()) => render(<DecisionCard rec={rec} bundle={null} presentation={p} dataAge={null} onReview={vi.fn()} onCreateOrder={vi.fn()} onAnalysis={vi.fn()} onRefresh={vi.fn()} onDismiss={vi.fn()} />);

describe('DecisionCard', () => {
  it('uses the fixed hierarchy test ids', () => { renderCard(); const ids = ['decision-context','decision-verdict','decision-metadata','decision-thesis','decision-grid','decision-evidence','decision-actions']; expect(ids.map((id) => screen.getByTestId(id).dataset.testid)).toEqual(ids); });
  it('renders a structured verdict', () => { renderCard(); expect(screen.getByTestId('decision-verdict')).toHaveTextContent('Trade · long'); });
  it('orders the decision grid fields', () => { renderCard(); const text = screen.getByTestId('decision-grid').textContent ?? ''; expect(text.indexOf('Max risk')).toBeLessThan(text.indexOf('Invalidation')); expect(text.indexOf('Invalidation')).toBeLessThan(text.indexOf('Entry')); expect(text.indexOf('Entry')).toBeLessThan(text.indexOf('Target')); });
  it('keeps exact values and absence labels', () => { renderCard(recNoneNamed(), presentation({ resultState: 'incomplete_trade', missingPositionFields: ['Structure','Strike(s)','Expiration','Entry trigger'], actions: actions({ reviewTrade: false, createOrder: false, refresh: true }) })); expect(screen.getAllByText('not given').length).toBeGreaterThan(0); });
  it('does not render long rationale inline', () => { const rec = recAllTraced(); rec.strategy!.rationale = 'Lead sentence. POISON LONG RATIONALE'; renderCard(rec); expect(screen.queryByText('POISON LONG RATIONALE')).toBeNull(); expect(screen.getByTestId('decision-thesis')).toHaveTextContent('Lead sentence.'); });
  it('renders no-trade without a decision grid or simulated actions', () => { renderCard(noTradeRec(), presentation({ resultState: 'no_trade', actions: actions({ reviewTrade: false, createOrder: false }) })); expect(screen.getByTestId('decision-verdict')).toHaveTextContent('No trade — sit this one out'); expect(screen.queryByTestId('decision-grid')).toBeNull(); expect(screen.queryByText('Review simulated trade')).toBeNull(); });
  it('renders incomplete names once in a degraded strip', () => { renderCard(recNoneNamed(), presentation({ resultState: 'incomplete_trade', missingPositionFields: ['Structure','Strike(s)'], actions: actions({ reviewTrade: false, createOrder: false, refresh: true }) })); expect(screen.getByTestId('rec-not-actionable')).toHaveTextContent('Structure, Strike(s)'); });
  it('renders one grounding line byte-faithfully', () => { renderCard(); expect(screen.getAllByTestId('grounding-card-line')).toHaveLength(1); expect(screen.getByTestId('grounding-card-line')).toHaveTextContent('Every checked figure traces to a Convexa number.'); });
  it('renders scripted framing', () => { const rec = recAllTraced(); rec.scenario = { id: 'x', name: 'Scripted' } as never; renderCard(rec); expect(screen.getByTestId('decision-context')).toHaveTextContent('SIMULATED / advisory'); });
  it('makes every retained help trigger keyboard reachable', () => { renderCard(); const names = within(screen.getByTestId('ai-rec-decision-card')).getAllByRole('button').map((b) => b.getAttribute('aria-label')).filter(Boolean); expect(names.some((name) => name?.includes('help'))).toBe(true); });
});
