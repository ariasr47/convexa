// Controls — buttons, fields, segmented control, switch, checkbox, kbd.
import { icon } from '../lib.mjs';

export const buttonSpec = {
  id: 'button',
  name: 'Button',
  react: 'MuiButton (contained / outlined / text) + link-class action',
  path: 'theme.ts MuiButton override · shared',
  change: 'Sentence case. 36px default, 30 small, 44 large and on coarse pointers. One focus ring everywhere (2px text-grade amber, 2px offset). Link-class actions bind signal, never amber.',
  notes: 'Primary is the amber fill and appears once per region. Secondary is the hairline. Ghost is for tertiary and in-row actions.',
};
export function button({ label, variant = 'primary', size = '', state = '', iconName = '', style = '', on = '' }) {
  const cls = ['btn', variant, size, state === 'focus' ? 'focus' : '', state === 'disabled' ? 'disabled' : ''].filter(Boolean).join(' ');
  const hover = state === 'hover' ? (variant === 'primary' ? 'transform: translateY(-1px); box-shadow: 0 8px 22px -8px rgba(242,169,59,0.6);' : variant === 'secondary' ? 'background: var(--raised); border-color: var(--steel);' : 'background: var(--raised); color: var(--phosphor);') : '';
  const working = state === 'working' ? '<span style="width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; animation: spin 0.9s linear infinite;"></span>' : '';
  const tag = variant === 'link' ? 'a' : 'button';
  return `<${tag} class="${cls}" ${tag === 'a' ? 'href="#"' : 'type="button"'} ${on ? `onClick="${on}"` : ''} style="${hover}${style}">${working}${iconName && state !== 'working' ? icon(iconName, size === 'lg' ? 16 : 14) : ''}${label}</${tag}>`;
}
export const buttonStates = [
  { label: 'Primary', props: { label: 'Analyze current snapshot', variant: 'primary' } },
  { label: 'Primary · hover', props: { label: 'Hover', variant: 'primary', state: 'hover' } },
  { label: 'Primary · focus', props: { label: 'Focus', variant: 'primary', state: 'focus' } },
  { label: 'Primary · disabled', props: { label: 'Cooling down · 42s', variant: 'primary', state: 'disabled' } },
  { label: 'Primary · working', props: { label: 'Working…', variant: 'primary', state: 'working' } },
  { label: 'Secondary', props: { label: 'Create sim order', variant: 'secondary' } },
  { label: 'Ghost', props: { label: 'Refresh analysis', variant: 'ghost', iconName: 'refresh' } },
  { label: 'Link', props: { label: 'What’s sent →', variant: 'link' } },
  { label: 'Small', props: { label: 'Open', variant: 'primary', size: 'sm' } },
  { label: 'Large · 44', props: { label: 'Open the Ticker', variant: 'primary', size: 'lg', iconName: 'arrow' } },
];

export const fieldSpec = {
  id: 'field',
  name: 'Field',
  react: 'OutlinedInput · Select · RiskInputsSection unit toggle',
  path: 'theme.ts + features/auth/RiskInputsSection.tsx',
  change: 'Fields sit on ink-2 so they read as recessed on any panel. Focus is the amber ring plus a 3px tint halo; errors use burnt orange plus an icon and a sentence. Labelled selects carry their caps label inside the control (masthead).',
  notes: 'A money or percent value always shows its unit control beside it — a bare number with an inferred unit is forbidden.',
};
export function field({ kind = 'text', value = '', placeholder = '', label = '', state = '', mono = false, unit = null, chip = '' }) {
  const cls = ['field', mono ? 'mono' : '', state === 'focus' ? 'focus' : ''].filter(Boolean).join(' ');
  const err = state === 'error' ? 'border-color: var(--warn); box-shadow: 0 0 0 3px var(--warn-tint);' : '';
  const dis = state === 'disabled' ? 'opacity: 0.5;' : '';
  const caret = state === 'focus' ? '<span style="width: 1px; height: 16px; background: var(--amber);"></span>' : '';
  const inner = value ? `<span>${value}</span>${caret}` : `<span class="ph">${placeholder}</span>`;
  let body = '';
  if (kind === 'select') body = `<div class="${cls}" style="${err}${dis}"><span>${value}</span>${chip}<span style="flex: 1;"></span>${icon('chevron', 14)}</div>`;
  else if (kind === 'labelled') body = `<div class="${cls}" style="${err}${dis}"><span class="caps" style="font-size: 11px;">${label}</span><span style="font-weight: 600;">${value}</span>${chip}<span style="flex: 1;"></span>${icon('chevron', 14)}</div>`;
  else if (kind === 'unit') body = `<div style="display: flex; gap: 8px; flex-wrap: wrap;"><div class="${cls}" style="flex: 1 1 100px; ${err}${dis}">${inner}</div><span class="seg" style="align-self: stretch;">${unit.map((u, i) => `<span class="${i === 0 ? 'on' : ''}">${u}</span>`).join('')}</span></div>`;
  else if (kind === 'textarea') body = `<div class="${cls}" style="height: auto; min-height: 64px; align-items: flex-start; padding: 10px 12px; line-height: 1.5; ${err}${dis}">${inner}</div>`;
  else body = `<div class="${cls}" style="${err}${dis}">${inner}${chip}</div>`;
  const help = state === 'error' ? `<div style="display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 11px; color: var(--warn);">${icon('warn', 12)} Enter a whole-dollar amount.</div>` : '';
  return `<div style="min-width: 0;">${label && kind !== 'labelled' ? `<span class="caps" style="display: block; margin-bottom: 5px;">${label}</span>` : ''}${body}${help}</div>`;
}
export const fieldStates = [
  { label: 'Text', props: { label: 'Default ticker', placeholder: 'e.g. SPY' } },
  { label: 'Focus', props: { label: 'Symbol', value: 'SP', state: 'focus', mono: true } },
  { label: 'Error', props: { label: 'Account size', value: '25,00O', state: 'error', mono: true } },
  { label: 'Disabled', props: { label: 'Persona', value: 'Not available while signed out', state: 'disabled' } },
  { label: 'Select', props: { kind: 'select', label: 'Active persona', value: 'Balanced Swinger' } },
  { label: 'Labelled select', props: { kind: 'labelled', label: 'Expirations', value: 'All', chip: '<span class="mono steel" style="font-size: 11px;">7–45 DTE</span>' } },
  { label: 'Unit-bearing numeric', props: { kind: 'unit', label: 'Per-trade cap', value: '2', mono: true, unit: ['% of account', '$ per trade'] } },
  { label: 'Textarea', props: { kind: 'textarea', label: 'Emphasis note', value: 'Prefer pins into the call wall in positive gamma.' } },
];

export const segSpec = {
  id: 'seg',
  name: 'Segmented control',
  react: 'ToggleButtonGroup (shared Seg style)',
  path: 'theme.ts + Settings theme control · scanner density',
  change: 'One raised track, the active segment lifts to panel with e1. 38px targets on coarse pointers. Used for view toggles, density, theme, fill mode, units.',
  notes: '',
};
export function seg(options, active = 0, { full = false } = {}) {
  return `<span class="seg" style="${full ? 'width: 100%;' : ''}">${options.map((o, i) => `<span class="${i === active ? 'on' : ''}" style="${full ? 'flex: 1; text-align: center;' : ''}">${o}</span>`).join('')}</span>`;
}
export const segStates = [
  { label: 'Two', props: [['Field', 'Magnet'], 0] },
  { label: 'Three', props: [['Dark', 'Light', 'System'], 0] },
  { label: 'Full width', props: [['Limit', 'Market on trigger'], 0, { full: true }] },
];

export const toggleSpec = {
  id: 'toggle',
  name: 'Switch · checkbox · kbd',
  react: 'Switch · Checkbox · Kbd (new)',
  path: 'shared',
  change: 'Amber when on; steel knob when off. Checkbox fills amber with an ink check. Kbd hints are 11px mono pills.',
  notes: '',
};
export const toggle = (on) => `<span role="switch" aria-checked="${on}" style="display: inline-flex; align-items: center; width: 38px; height: 22px; padding: 2px; border-radius: 999px; background: ${on ? 'var(--amber)' : 'var(--raised-2)'}; justify-content: ${on ? 'flex-end' : 'flex-start'};"><span style="width: 18px; height: 18px; border-radius: 50%; background: ${on ? 'var(--amber-ink)' : 'var(--steel)'};"></span></span>`;
export const checkbox = (on, label) => `<label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px;"><span style="width: 16px; height: 16px; border-radius: 4px; border: 1px solid ${on ? 'var(--amber)' : 'var(--line-2)'}; background: ${on ? 'var(--amber)' : 'transparent'}; color: var(--amber-ink); display: inline-flex; align-items: center; justify-content: center;">${on ? icon('check', 12) : ''}</span>${label}</label>`;
export const kbd = (k) => `<span class="kbd">${k}</span>`;
