// Chip — the one tinted label. Tones carry meaning: up/down are direction, live is signal, warn is a
// true warning (always with the icon), emph is the amber accent (tier, conviction), outline is provenance.
import { icon } from '../lib.mjs';

export const spec = {
  id: 'chip',
  name: 'Chip',
  react: 'TintChip',
  path: 'shared/ui/TintChip.tsx (unify with TickerHeader.TintChip)',
  change: 'One component, seven tones, 11px floor, optional dot / warn icon / mono.',
  notes: 'Never use a tone as decoration. A chip that means "warning" carries the icon; a chip that means "live" carries the pulsing dot only while the stream is genuinely live.',
};

export function chip({ label, tone = 'neutral', dot = false, warnIcon = false, mono = false, size = 'md', style = '' }) {
  const cls = ['chip', tone === 'neutral' ? '' : tone, mono ? 'mono' : ''].filter(Boolean).join(' ');
  const sz = size === 'sm' ? 'height: 18px; padding: 0 6px; ' : size === 'lg' ? 'height: 26px; padding: 0 11px; font-size: 12px; ' : '';
  return `<span class="${cls}" style="${sz}${style}">${warnIcon ? icon('warn', 11) : ''}${dot ? '<span class="dot"></span>' : ''}${label}</span>`;
}

export function symbolPill({ symbol, on = false, hover = false, focus = false }) {
  return `<span class="sym ${on ? 'on' : ''} ${focus ? 'ring' : ''}" style="${hover ? 'border-color: var(--steel); background: var(--raised);' : ''}">${symbol}</span>`;
}

/** The one connection chip — every state it can be in. */
export const CONNECTION = {
  live: { label: 'live · open · <span class="mono">573.12</span>', tone: 'live', dot: true },
  closed: { label: '○ market closed · mid 573.12', tone: 'neutral' },
  overnight: { label: 'overnight — no live data', tone: 'warn', warnIcon: true },
  noTicks: { label: 'no live ticks · mid 573.12', tone: 'warn', warnIcon: true },
  offline: { label: 'Live offline — reconnecting…', tone: 'warn', warnIcon: true },
  replay: { label: '○ replay · Wed Sep 2', tone: 'outline' },
};
export const connectionChip = (state) => chip(CONNECTION[state]);

export const states = [
  { label: 'positive gamma', props: { label: 'positive gamma', tone: 'up' } },
  { label: 'negative gamma', props: { label: 'negative gamma', tone: 'down' } },
  { label: 'live', props: { label: 'live · open', tone: 'live', dot: true } },
  { label: 'warning', props: { label: 'live offline', tone: 'warn', warnIcon: true } },
  { label: 'emphasis', props: { label: 'high', tone: 'emph' } },
  { label: 'neutral', props: { label: 'medium' } },
  { label: 'outline', props: { label: 'SIMULATED', tone: 'outline' } },
  { label: 'outline mono', props: { label: 'claude-sonnet-5', tone: 'outline', mono: true } },
  { label: 'small', props: { label: 'Stale', tone: 'warn', warnIcon: true, size: 'sm' } },
];
export const render = chip;
