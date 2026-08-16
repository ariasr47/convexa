import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionCard } from './DecisionCard';
import { noTradeRec, recAllTraced, recNoneNamed } from './fixtures';
import type { AiRecPresentation } from './presentationPolicy';

afterEach(cleanup);
const actions = (o: Partial<AiRecPresentation['actions']> = {}) => ({ directExport:false, analyze:false, askAnyway:false, retry:false, settings:false, signIn:false, reviewTrade:true, createOrder:true, analysis:true, refresh:false, dismiss:true, ...o });
const pres = (o: Partial<AiRecPresentation> = {}): AiRecPresentation => ({ requestState:'idle', resultState:'fresh_trade', missingPositionFields:[], actions:actions(), ...o });
const renderCard = (rec = recAllTraced(), presentation = pres(), bundle: any = null, onCreateOrder: (() => void) | null = vi.fn()) => render(<DecisionCard rec={rec} bundle={bundle} presentation={presentation} dataAge="older data" onReview={vi.fn()} onCreateOrder={onCreateOrder ?? undefined} onAnalysis={vi.fn()} onRefresh={vi.fn()} onDismiss={vi.fn()} />);

describe('DecisionCard observable contract', () => {
  it('keeps the fixed hierarchy in DOM order', () => {
    renderCard();
    const ids = ['decision-context','decision-provenance','decision-verdict','decision-metadata','decision-thesis','decision-grid','decision-evidence','decision-actions'];
    for (let i=0;i<ids.length-1;i++) expect(screen.getByTestId(ids[i]).compareDocumentPosition(screen.getByTestId(ids[i+1])) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('tabs through every help trigger with unique names', async () => {
    const user = userEvent.setup(); renderCard();
    const helps = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.includes('help'));
    expect(new Set(helps.map((b) => b.getAttribute('aria-label'))).size).toBe(helps.length);
    for (const help of helps) { await user.tab(); expect(help).toHaveAttribute('aria-label'); }
  });
  it('names each incomplete position field exactly once', () => {
    renderCard(recNoneNamed(), pres({ resultState:'incomplete_trade', missingPositionFields:['Structure','Strike(s)','Expiration','Entry trigger'], actions:actions({reviewTrade:false,createOrder:false,refresh:true}) }));
    for (const field of ['Structure','Strike(s)','Expiration','Entry trigger']) expect((screen.getByTestId('ai-rec-decision-card').textContent?.match(new RegExp(field.replace(/[()]/g,'\\$&'),'g')) ?? []).length).toBe(1);
  });
  it('retains full key/persona/as-of/risk provenance without context duplicates', () => {
    const rec = recAllTraced(); rec.key_source='own_key'; rec.sent!.risk_inputs!.state='set'; renderCard(rec);
    expect(screen.getAllByText('Persona · Default (no persona)')).toHaveLength(1); expect(screen.getByText(/As of/)).toBeInTheDocument(); expect(screen.getByText('Using your key')).toBeInTheDocument(); expect(screen.getByTestId('ai-rec-provenance-chip')).toBeInTheDocument();
  });
  it('shows stale-born warning icon and superseded recovery copy', () => {
    const rec = recAllTraced(); rec.stale_born=true; renderCard(rec, pres({resultState:'stale_at_generation',actions:actions({reviewTrade:false,createOrder:false,refresh:true})})); expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('already marked stale'))).toBe(true);
    cleanup(); renderCard(recAllTraced(), pres({resultState:'superseded_inputs',actions:actions({reviewTrade:false,createOrder:false,refresh:true})})); expect(screen.getByRole('alert')).toHaveTextContent('risk inputs changed');
  });
  it('places cap annotation after grounding evidence', () => { renderCard(); const evidence=screen.getByTestId('decision-evidence'); expect(evidence.querySelector('[data-testid="grounding-card-line"]')).toBeTruthy(); expect(evidence.querySelector('[data-testid="cap-annotation"]')).toBeTruthy(); expect(evidence.querySelector('[data-testid="grounding-card-line"]')!.compareDocumentPosition(evidence.querySelector('[data-testid="cap-annotation"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); });
  it('filters NaN/Infinity response and DTE values', () => { const rec=recAllTraced(); rec.strategy!.strikes=[NaN,Infinity]; const bundle={market_state:{dte_min:NaN,dte_max:Infinity}}; renderCard(rec,pres(),bundle); const text=screen.getByTestId('ai-rec-decision-card').textContent ?? ''; expect(text).not.toMatch(/NaN|Infinity/); expect(text).not.toContain('your DTE window'); });
  it('does not render retired labels or clauses for absence literals', () => { const rec=recNoneNamed(); rec.strategy!.invalidation_level=null; renderCard(rec, pres({resultState:'incomplete_trade',missingPositionFields:['Structure'],actions:actions({reviewTrade:false,createOrder:false})})); const text=screen.getByTestId('ai-rec-decision-card').textContent ?? ''; expect(text).not.toMatch(/Accept into ghost trade|Act as sim order|Get a fresh recommendation|Show full analysis|ghost trade/); expect(screen.queryByTestId('clause-invalidation')).toBeNull(); });
  it('omits order action when callback is absent', () => { renderCard(recAllTraced(), pres(), null, null); expect(screen.queryByRole('button',{name:'Create sim order'})).toBeNull(); });
  it('renders scripted warning plus simulated framing', () => { const rec=recAllTraced(); rec.scenario={id:'s',name:'Scripted'} as never; renderCard(rec); expect(screen.getByRole('alert')).toHaveTextContent('Scripted scenario'); expect(screen.getByRole('alert')).toHaveTextContent('SIMULATED / advisory'); });
  it('keeps absent confidence help and finite DTE exactly once', () => { const rec=recAllTraced(); rec.strategy!.confidence=null; const bundle={market_state:{dte_min:7,dte_max:45}}; renderCard(rec,pres(),bundle); expect(screen.getByRole('button',{name:'Confidence help'})).toBeInTheDocument(); expect(screen.getAllByText(/your DTE window: 7–45/)).toHaveLength(1); });
  it('keeps no-trade complete without grid or simulated actions', () => { renderCard(noTradeRec(),pres({resultState:'no_trade',actions:actions({reviewTrade:false,createOrder:false})})); expect(screen.getByText('No trade — sit this one out')).toBeInTheDocument(); expect(screen.queryByTestId('decision-grid')).toBeNull(); expect(screen.queryByRole('button',{name:'Review simulated trade'})).toBeNull(); });
});
