// Component registry — the library page renders every entry's states from here, so adding a state or a
// component is one edit that shows up in the library, and screens import the same render functions.
import * as chip from './chip.mjs';
import * as figureCell from './figure-cell.mjs';
import * as ladder from './ladder.mjs';
import * as riskField from './risk-field.mjs';
import { button, buttonSpec, buttonStates, field, fieldSpec, fieldStates, seg, segSpec, segStates, toggle, toggleSpec, checkbox, kbd } from './controls.mjs';
import { tagSpec, tagStates, renderTag, familyEntries } from './data-states.mjs';
import { chartEntries } from './charts.mjs';
import { panel, widgetSpec, widgetStates, dialogSpec, dialogFrame, sheetPeek, stripSpec, warningStrip, infoStrip, refused, tooltip, toast, emptyState } from './surfaces.mjs';

const entry = (spec, states, render, opts = {}) => ({ spec, states, render, ...opts });

export const registry = [
  entry(buttonSpec, buttonStates, button, { group: 'Controls' }),
  entry(segSpec, segStates, (p) => seg(...p), { group: 'Controls', snippet: `<span class="seg"><span class="on">Field</span><span>Magnet</span></span>` }),
  entry(chip.spec, chip.states, chip.render, { group: 'Controls' }),
  entry(fieldSpec, fieldStates, field, { group: 'Controls', col: true }),
  entry(toggleSpec, [{ label: 'On', props: null }], () => `${toggle(true)}${toggle(false)}${checkbox(true, 'Sep 18 · 15 DTE')}${checkbox(false, 'Oct 17 · 44 DTE')}${kbd('⌘K')}${kbd('↵')}${kbd('esc')}`, { group: 'Controls', single: true }),
  entry(figureCell.spec, figureCell.states, figureCell.render, { group: 'Data', frame: 'strip' }),
  entry(ladder.spec, ladder.states, ladder.render, { group: 'Data', frame: 'ladder' }),
  entry(riskField.spec, riskField.states, riskField.render, { group: 'Data', frame: 'grid' }),
  entry(widgetSpec, widgetStates, panel, { group: 'Chrome', frame: 'wide' }),
  entry(dialogSpec, [{ label: 'Dialog', props: null }], () => `${dialogFrame('Dialog frame', `<p style="margin: 0; font-size: 12.5px; color: var(--steel);">Title row, close, body with 14px gaps, footer with stacked-on-phone actions.</p>`, { chip: '<span class="chip outline">SIMULATED</span>', footer: '<span style="flex: 1;"></span><button class="btn ghost" type="button">Cancel</button><button class="btn primary" type="button">Confirm</button>' })}<div style="width: 300px;">${sheetPeek()}</div>`, { group: 'Overlays', single: true, frame: 'wide' }),
  entry(stripSpec, [{ label: 'Strips', props: null }], () => `<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">${warningStrip('<strong style="font-weight: 600;">A newer snapshot has arrived.</strong> This read is pinned to 10:41:52 ET.', '<button class="btn secondary sm" type="button">Refresh</button>')}${infoStrip('No expirations selected — pick one or more above, or use <strong style="font-weight: 600;">All</strong>.', '<button class="btn secondary sm" type="button">Select all</button>')}${refused('Open simulated trade', 'Sign in to open a paper position. No real order is ever sent.')}<div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start;">${tooltip('Strike with the most positive dealer gamma. Tends to act as resistance.')}${toast('Saved to your account.')}</div>${emptyState({ title: 'No tickers in your view.', body: 'Pick tickers to build your scan.', action: 'Edit view' })}</div>`, { group: 'Overlays', single: true, frame: 'wide' }),
  // v4 (2026-10-13): the data-state vocabulary and nine widget families in all fourteen states.
  entry(tagSpec, tagStates, renderTag, { group: 'Data states' }),
  ...familyEntries.map((f) => entry(f.spec, f.states, f.render, { group: 'Data states' })),
  // v5 (2026-10-13): the chart system — fifteen primitives, each in its variants and the seven data states.
  ...chartEntries,
];

export { chip, figureCell, ladder, riskField, button, field, seg, toggle, checkbox, kbd, panel, dialogFrame, sheetPeek, warningStrip, infoStrip, refused, tooltip, toast, emptyState };
