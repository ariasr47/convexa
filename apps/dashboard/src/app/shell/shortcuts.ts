/**
 * The shell's single-key shortcuts (design/src/screens/final/shell-site-front.mjs, “Keyboard
 * shortcuts”): `/` opens the jump-to box, `g` then a letter goes to a section, `?` opens the sheet.
 * ⌘K / Ctrl+K stays separate (AppShell): it inserts no text, so it may fire from a field.
 *
 * A plain letter does insert text, so none of these may fire while the reader is typing: in an
 * input, a textarea, a select or anything contenteditable, or while a dialog holds focus (its own
 * keys win). Getting this wrong is silent and costly — “gs” typed into a note's search box would
 * leave the page and drop what was typed — so AppShell.keyboard.spec.tsx pins it.
 */

/** `g` then one of these, within GO_TO_WINDOW_MS. Same order and targets as the primary nav. */
export const GO_TO: Readonly<Record<string, { label: string; to: string }>> = {
  s: { label: 'Scanner', to: '/scanner' },
  t: { label: 'Ticker', to: '/ticker' },
  r: { label: 'Research', to: '/research' },
  p: { label: 'Positions', to: '/positions' },
  a: { label: 'Alerts', to: '/alerts' },
};

export const GO_TO_WINDOW_MS = 1500;

/** True when a keystroke aimed at `target` belongs to whatever holds focus, not to the shell. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
    return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  // A role="textbox"/"combobox" widget, or anything inside an open dialog, owns its own keys.
  if (target.closest('[role="textbox"], [role="combobox"], [role="dialog"], [role="alertdialog"]'))
    return true;
  return false;
}

/** A plain keystroke: no ⌘, Ctrl or Alt (Shift is how `?` is typed, so it is allowed). */
export function isPlainKey(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey;
}
