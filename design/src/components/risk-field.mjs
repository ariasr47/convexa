// Risk field — one of the four risk-first figures on the AI read (max risk · invalidation · entry · target).
import { icon, labelInfo } from '../lib.mjs';

export const spec = {
  id: 'risk-field',
  name: 'Risk field',
  react: 'RiskField',
  path: 'pages/ticker/widgets/ai-rec/DecisionCard.tsx (RiskField)',
  change: 'A recessed cell with the figure in mono, a grounding line under it (check = traced to Convexa, dash = the model’s own number in Sans with a dotted rule). Compact size for the narrow form and the phone sheet.',
  notes: 'Grounding is carried by the type register and the glyph, never by colour — it survives a black-and-white screenshot.',
};

export function riskField({ label, value, sub, traced = true, mono = true, compact = false }) {
  const pad = compact ? '10px 12px' : '12px 14px';
  const size = compact ? 18 : 20;
  return `<div style="padding: ${pad}; border-radius: 10px; background: var(--ink-2); border: 1px solid var(--line); min-width: 0;">
    ${compact ? `<span class="caps">${label}</span>` : labelInfo(label)}
    <div class="${mono ? 'mono' : 'sans'}" style="font-size: ${size}px; font-weight: 500; line-height: 1.2; margin-top: ${compact ? 3 : 4}px; ${mono ? '' : 'border-bottom: 1px dotted var(--steel-2); display: inline-block;'}">${value}</div>
    <div style="display: flex; align-items: center; gap: ${compact ? 5 : 6}px; margin-top: ${compact ? 3 : 4}px; font-size: 11px; color: var(--steel);"><span class="${traced ? 'steel' : 'dim'}" style="display: inline-flex;">${icon(traced ? 'check' : 'minus', compact ? 11 : 12)}</span><span>${sub}</span></div>
  </div>`;
}

export const SPY_RISK = [
  { label: 'Max risk', value: '$420', sub: 'debit paid · 1.7% of account' },
  { label: 'Invalidation', value: '568.50', sub: 'traces to the gamma flip' },
  { label: 'Entry', value: 'near 573', sub: 'on a pullback to VWAP 571.88' },
  { label: 'Target', value: '579.50', sub: 'AI-stated · untraced', traced: false, mono: false },
];

export const states = [
  { label: 'Traced', props: SPY_RISK[1] },
  { label: 'Untraced', props: SPY_RISK[3] },
  { label: 'Compact', props: { ...SPY_RISK[0], compact: true } },
];
export const render = riskField;
