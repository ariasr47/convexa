/**
 * THE MODAL FOCUS HANDOFF — one seam that keeps focus out of the aria-hidden background.
 *
 * Chrome (DevTools console, `/positions`, 2026-08-04):
 *   "Blocked aria-hidden on an element because its descendant retained focus. […] Consider using
 *    the inert attribute instead, which will also prevent focus."
 *   Element with focus: <button class='… MuiButton-text MuiButton-sizeSmall MuiButton-colorPrimary …'>
 *   Ancestor with aria-hidden: <div id='root'>
 *
 * ─ WHAT IS ACTUALLY WRONG (measured, not assumed) ─────────────────────────────────────────────────
 * MUI's `ModalManager` hides every sibling of the modal's portal — in this app that is `<div id=root>`,
 * the whole app — with `aria-hidden="true"`. `FocusTrap` moves focus in on open and restores it on
 * close. Neither is wrong on its own; the ORDER is. Instrumented on the running app with synchronous
 * intercepts of `setAttribute` / `removeAttribute` / `focus` (the trigger being AccountControl's
 * `Log in`, whose live class list byte-matches the warning above):
 *
 *   OPEN   1. setAttribute(aria-hidden=true) on #root   focus = trigger  ← VIOLATION
 *          2. focus() -> dialog paper                   focus = paper
 *
 *   CLOSE  1. focus() -> trigger                        #root still aria-hidden  ← VIOLATION
 *          2. removeAttribute(aria-hidden) from #root
 *
 * So it is NOT only the open path. And the close window is not a sliver: `Dialog` passes
 * `closeAfterTransition: true`, so `aria-hidden` survives the whole exit fade while focus already
 * sits back on the trigger.
 *
 * A THIRD window is symmetric and easy to miss — `remove()` also aria-hides the CLOSING MODAL
 * (`ariaHidden(modal.modalRef, …)`) before unhiding the background, and at that instant focus is
 * still on whatever the user clicked to close it. Measured: `>remove active=BUTTON[close]`. So the
 * dialog's own Cancel button spends the exit fade focused inside an aria-hidden subtree too.
 *
 * `Popover` renders a `Modal` too, so every `Menu` / `Select` / `Autocomplete` carries the identical
 * defect — which is why this is fixed once, here, at the manager, rather than per dialog.
 *
 * ─ WHY NOT THE TWO OBVIOUS FIXES ──────────────────────────────────────────────────────────────────
 *  - `autoFocus` on a dialog element fixes the OPEN half only (React commits `autoFocus` in the
 *    mutation phase, ahead of Modal's passive effect) and actively makes the CLOSE half worse: focus
 *    entering the trap sets FocusTrap's `nodeToRestore` to the trigger, so close then restores to it.
 *    Two dialogs on this very page do exactly that (`CustomizationToolbar` Save-as / Rename).
 *  - `inert` on the background, which is what the warning itself suggests, does NOT blur
 *    synchronously. Measured in Chrome: after `root.setAttribute('inert','')` the trigger still held
 *    focus through a forced reflow, a microtask AND a rAF, only dropping to <body> by the 50ms mark.
 *    A fix that races style recalc is not a fix.
 *
 * ─ THE FIX ────────────────────────────────────────────────────────────────────────────────────────
 * Wrap the two `ModalManager` methods that own the attribute, so the ordering is correct BY
 * CONSTRUCTION — synchronously, inside MUI's own call, with no dependence on effect scheduling:
 *
 *   add()     blur the background element FIRST, then let MUI apply aria-hidden.
 *             → aria-hidden can never land on a subtree that still holds focus.
 *   remove()  park focus on <body> FIRST (inside neither the modal nor the background), let MUI
 *             swap the attributes, and only THEN put focus back on the trigger.
 *             → focus is never inside whichever subtree is hidden at that moment.
 *
 * The blur is what makes this deterministic where `inert` was not: `HTMLElement.blur()` moves the
 * active element to <body> synchronously, and <body> is outside the hidden subtree.
 *
 * Restoring focus is now OUR job, so `MuiModal.defaultProps.disableRestoreFocus` is set at the theme
 * layer (`shared/theme/theme.ts`) to stand FocusTrap's early, mis-ordered restore down. The two are a
 * pair: neither is correct alone, and `modalFocusHandoff.spec.tsx` fails if the theme half is removed.
 *
 * `ModalManager` is a public export of `@mui/material/Modal` (not a deep private import), and the
 * spec asserts the wrapped shape, so a MUI upgrade that changes it fails the suite rather than
 * silently reinstating the bug.
 */
import { ModalManager } from '@mui/material/Modal';

/** The shape `ModalManager` tracks per modal. MUI does not export its `Modal` interface. */
type ManagedModal = { mount: Element | null; modalRef: Element | null };

type ManagerProto = {
  add(modal: ManagedModal, container: HTMLElement): number;
  remove(modal: ManagedModal, ariaHiddenState?: boolean): number;
};

/** Modals currently held open by the manager. Gates the background-focus recorder below. */
const managed = new Set<ManagedModal>();

/** Per-modal element to hand focus back to on close. */
const triggerOf = new WeakMap<ManagedModal, HTMLElement>();

/**
 * The last element focused while NO modal was open. This is the fallback trigger for the
 * `autoFocus` case: React has already moved focus INTO the dialog by the time `add()` runs, so the
 * live `activeElement` is no longer the thing we should hand focus back to.
 */
let lastBackgroundFocus: HTMLElement | null = null;

let uninstall: (() => void) | null = null;

/** Is `el` in the region `add()` is about to hide — i.e. inside the container but outside the modal? */
function isInHiddenRegion(el: Element, container: HTMLElement, modal: ManagedModal): boolean {
  if (!container.contains(el)) return false;
  if (modal.modalRef?.contains(el)) return false;
  // `mount` is usually the container itself (<body>); only meaningful when it is a nested node.
  if (modal.mount && modal.mount !== container && modal.mount.contains(el)) return false;
  return true;
}

function documentOf(modal: ManagedModal): Document {
  return modal.modalRef?.ownerDocument ?? modal.mount?.ownerDocument ?? document;
}

/**
 * Install the handoff. Idempotent; returns an uninstall so the spec can prove the difference the
 * seam makes (a guard that cannot be switched off cannot be shown to do anything).
 */
export function installModalFocusHandoff(): () => void {
  if (uninstall) return uninstall;

  const recordBackgroundFocus = (event: FocusEvent) => {
    if (managed.size > 0) return;
    if (event.target instanceof HTMLElement) lastBackgroundFocus = event.target;
  };
  document.addEventListener('focusin', recordBackgroundFocus, true);

  const proto = ModalManager.prototype as unknown as ManagerProto;
  const superAdd = proto.add;
  const superRemove = proto.remove;

  proto.add = function add(modal, container) {
    // Runs BEFORE MUI applies aria-hidden to the background.
    if (!managed.has(modal)) {
      const doc = container.ownerDocument;
      const active = doc.activeElement;
      if (active instanceof HTMLElement && isInHiddenRegion(active, container, modal)) {
        triggerOf.set(modal, active);
        active.blur();
      } else if (lastBackgroundFocus) {
        // Focus was already inside the modal (an `autoFocus`ed field): nothing to blur, but we
        // still owe the trigger a way back.
        triggerOf.set(modal, lastBackgroundFocus);
      }
    }
    const index = superAdd.call(this, modal, container);
    managed.add(modal);
    return index;
  };

  proto.remove = function remove(modal, ariaHiddenState) {
    // `remove()` hides the CLOSING MODAL (aria-hidden on `modalRef`) and unhides the background, in
    // that order — so focus must be out of BOTH before it runs. Parking it on <body> first is the
    // only position that is inside neither.
    let wantsRestore = false;
    if (managed.has(modal)) {
      const doc = documentOf(modal);
      const active = doc.activeElement;
      if (active === null || active === doc.body || active === doc.documentElement) {
        wantsRestore = true;
      } else if (active instanceof HTMLElement && modal.modalRef?.contains(active)) {
        // The ordinary case: `Dialog` sets `closeAfterTransition`, so this runs at the END of the
        // exit fade with the control the user just clicked (Cancel, a MenuItem) still focused.
        wantsRestore = true;
        active.blur();
      }
      // Anything else means focus moved somewhere deliberate — leave it alone.
    }

    const index = superRemove.call(this, modal, ariaHiddenState);

    if (managed.delete(modal)) {
      const trigger = triggerOf.get(modal);
      triggerOf.delete(modal);
      // aria-hidden is off the background by now, so this lands somewhere visible to AT.
      if (wantsRestore && trigger?.isConnected) trigger.focus();
    }
    return index;
  };

  uninstall = () => {
    document.removeEventListener('focusin', recordBackgroundFocus, true);
    proto.add = superAdd;
    proto.remove = superRemove;
    managed.clear();
    lastBackgroundFocus = null;
    uninstall = null;
  };
  return uninstall;
}
