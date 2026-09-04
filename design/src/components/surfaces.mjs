// Surfaces — panel / widget frame, dialog frame, drawer, bottom-sheet peek, strips (warning / info / refused),
// tooltip, toast, empty state.
import { backdrop, dialogFrame, icon, widgetHead } from '../lib.mjs';

export const widgetSpec = {
  id: 'widget',
  name: 'Panel · widget frame',
  react: 'Widget',
  path: 'shared/ui/Widget/Widget.tsx',
  change: 'Keep the frame; `live` accepts a label (e.g. "mid · tape"); the inset body becomes the .well; quiet chrome as today (no sheen, no lift); the selected ring is the plain amber ring. Every panel is a container for container queries.',
  notes: 'The live bar is a 2px signal edge at the top-left that pulses only while live. Hover lifts a normal panel 2px to e2; quiet panels never lift.',
};
export function panel({ title = '', subtitle = '', body = '', live = false, quiet = false, actions = '', selected = false, well = true, style = '' }) {
  return `<section class="panel ${quiet ? 'quiet' : ''}" style="position: relative; overflow: hidden; ${selected ? 'outline: 2px solid var(--amber-text); outline-offset: 2px;' : ''}${style}">${live ? '<span class="livebar"></span>' : ''}${title ? widgetHead(title, { subtitle, live, quiet, actions }) : ''}<div class="${well ? 'well' : ''}" style="padding: ${quiet ? '4px 16px 14px' : '14px 16px'}; font-size: 12px; color: var(--steel);">${body}</div></section>`;
}
export const widgetStates = [
  { label: 'Live widget', props: { title: 'Live tape', subtitle: 'Trade tape + quote stream · pauses on a drop', live: true, body: 'Well body · ink-2 recess' } },
  { label: 'Quiet (context band)', props: { title: 'Term structure', subtitle: 'ATM IV by tenor', quiet: true, well: false, body: 'No sheen, no lift.' } },
  { label: 'Selected', props: { title: 'Selected widget', subtitle: 'plain ring', selected: true, body: 'The conic sweep is retired.' } },
];

export const dialogSpec = {
  id: 'dialog',
  name: 'Dialog · drawer · sheet',
  react: 'Dialog · Drawer (right) · Drawer (bottom, new sheet)',
  path: 'features/trading/TradeEntryDialog · ai-rec/StateExportDrawer · new BottomSheet',
  change: 'One frame: title row with chip and close, 14px body rhythm, footer actions that stack on the phone. Width 440–780 by content; full width under 600. Drawers are 520px from the right; the sheet docks at the bottom with a peek row and a scrim when open.',
  notes: 'The scrim uses the scrim token; content behind keeps updating. Errors are inline, never a toast.',
};
export { backdrop, dialogFrame };
export function sheetPeek({ verdict = 'Trade · Bullish', open = true } = {}) {
  return `<div style="border-radius: 16px 16px 0 0; background: var(--panel); border: 1px solid var(--line); border-bottom: 0; padding: 8px 14px 12px; box-shadow: 0 -14px 36px rgba(0,0,0,0.42);"><div style="width: 36px; height: 4px; border-radius: 2px; background: var(--line-2); margin: 0 auto 8px;"></div><div style="display: flex; align-items: center; gap: 8px;"><span class="amber" style="display: inline-flex;">${icon('sparkle', 14)}</span><span style="font-size: 13px; font-weight: 600;">AI read</span><span class="dim">·</span><span class="display" style="font-size: 14px;"><span class="amber">${verdict.split(' · ')[0]}</span>${verdict.includes(' · ') ? ' · ' + verdict.split(' · ')[1] : ''}</span><span style="flex: 1;"></span><span class="mono" style="font-size: 11px; color: var(--steel);">as of 10:41</span>${icon('chevron', 14, open ? '' : 'style="transform: rotate(180deg);"')}</div></div>`;
}

export const stripSpec = {
  id: 'strip',
  name: 'Strips · tooltip · toast · empty · refused',
  react: 'Alert(warning / info) · Tooltip · Snackbar · Refused · empty-state block',
  path: 'shared/ui/Refused.tsx · MUI Alert with icon',
  change: 'Warning strips are burnt orange plus the icon, always. Info strips are signal with the info glyph. A refusal names the action, says why, and offers the sign-in beside it. Empty states are dashed quiet panels with one primary action.',
  notes: 'Toasts use e4 on raised; they never carry errors that belong inline.',
};
export const warningStrip = (text, action = '') => `<div style="display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; background: var(--warn-tint); border: 1px solid var(--warn); color: var(--warn); font-size: 12px; flex-wrap: wrap;">${icon('warn', 15)}<span style="flex: 1 1 200px; color: var(--phosphor);">${text}</span>${action}</div>`;
export const infoStrip = (text, action = '') => `<div style="display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 8px; background: var(--signal-tint); border: 1px solid var(--signal); font-size: 12px; flex-wrap: wrap;"><span class="signal" style="display: inline-flex;">${icon('info', 15)}</span><span style="flex: 1 1 200px;">${text}</span>${action}</div>`;
export const refused = (action, reason) => `<div style="display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line); font-size: 12px; flex-wrap: wrap;"><span style="display: inline-flex; color: var(--steel);">${icon('lock', 14)}</span><span style="flex: 1 1 200px; color: var(--steel);"><strong style="color: var(--phosphor); font-weight: 600;">${action}</strong> · ${reason}</span><button class="btn secondary sm" type="button">Sign in</button></div>`;
export const tooltip = (text) => `<div class="tt" style="position: static; max-width: 280px;">${text}</div>`;
export const toast = (text) => `<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line-2); box-shadow: var(--e4); font-size: 12.5px;"><span class="steel" style="display: inline-flex;">${icon('check', 15)}</span><span style="flex: 1;">${text}</span><span style="color: var(--steel-2); display: inline-flex;">${icon('close', 14)}</span></div>`;
export const emptyState = ({ iconName = 'radar', title, body, action }) => `<div class="panel quiet" style="padding: 18px; text-align: center; border-style: dashed;"><div style="display: inline-flex; color: var(--steel);">${icon(iconName, 22)}</div><div style="font-size: 13px; font-weight: 600; margin-top: 6px;">${title}</div><div style="font-size: 12px; color: var(--steel); margin-top: 2px;">${body}</div>${action ? `<button class="btn primary sm" type="button" style="margin-top: 10px;">${action}</button>` : ''}</div>`;
