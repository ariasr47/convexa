/**
 * REGRESSION GUARD for the Chrome a11y violation observed on `/positions` (2026-08-04):
 *
 *   "Blocked aria-hidden on an element because its descendant retained focus."
 *   Element with focus: <button class='… MuiButton-text MuiButton-sizeSmall …'>  (AccountControl "Log in")
 *   Ancestor with aria-hidden: <div id='root'>
 *
 * The console string itself is untestable — Blink only emits it when the accessibility tree is being
 * computed (DevTools open / a screen reader attached), so it appears in neither jsdom nor a headless
 * browser. What IS testable is the exact DOM predicate Chrome is complaining about, and that is what
 * is pinned here:
 *
 *   AT NO POINT MAY THE FOCUSED ELEMENT SIT INSIDE AN `aria-hidden="true"` SUBTREE.
 *
 * The state is TRANSIENT — both the settled open state and the settled closed state are already
 * correct, which is precisely why it survived review. So the detector cannot sample; it intercepts
 * `setAttribute` / `removeAttribute` / `focus` synchronously and evaluates the predicate after every
 * one of them. That is a direct port of the instrumentation used to diagnose this against the running
 * app (see the header of `modalFocusHandoff.ts` for the captured traces).
 *
 * ─ READ THIS BEFORE WEAKENING ANYTHING HERE ───────────────────────────────────────────────────────
 * The first test is a MUTATION GUARD: with the seam uninstalled the detector MUST report violations.
 * A detector that cannot fail is worthless (`convexa-design` enforcement note), and this one is doubly
 * exposed to that — if `installModalFocusHandoff` were a no-op, every other test here would still be
 * green. Do not delete it, and do not "fix" it by loosening the predicate.
 *
 * The fix is a PAIR: the `ModalManager` seam plus `MuiModal.defaultProps.disableRestoreFocus` in
 * `shared/theme/theme.ts`. The autoFocus case below is the one that fails if the theme half is
 * reverted — MUI's FocusTrap then restores focus to the trigger during the exit fade, while
 * `aria-hidden` is still up (`Dialog` sets `closeAfterTransition`).
 */
import { theme } from '@/shared/theme/theme';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { installModalFocusHandoff } from './modalFocusHandoff';

// =================================================================================================
// The detector — Chrome's predicate, evaluated after every focus / aria-hidden mutation
// =================================================================================================

function describeEl(el: Element): string {
  const testid = el.getAttribute('data-testid');
  return testid ? `${el.tagName.toLowerCase()}[${testid}]` : el.tagName.toLowerCase();
}

/** The focused element's aria-hidden ancestor, if any — i.e. exactly what Chrome blocks. */
function currentViolation(): string | null {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return null;
  for (let el: Element | null = active; el; el = el.parentElement) {
    if (el.getAttribute('aria-hidden') === 'true') {
      return `${describeEl(active)} focused inside aria-hidden ${describeEl(el)}`;
    }
  }
  return null;
}

/** Intercept the three operations that can create the state, and record it the instant it exists. */
function recordViolations(): { violations: string[]; stop: () => void } {
  const violations: string[] = [];
  const check = () => {
    const v = currentViolation();
    if (v && !violations.includes(v)) violations.push(v);
  };

  const origSetAttribute = Element.prototype.setAttribute;
  const origRemoveAttribute = Element.prototype.removeAttribute;
  // `focus` is an accessor (getter-only) on this environment's HTMLElement prototype, so it has to
  // be replaced through the property descriptor — a plain assignment throws.
  const focusDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus');
  const origFocus = HTMLElement.prototype.focus;

  Element.prototype.setAttribute = function (name: string, value: string) {
    origSetAttribute.call(this, name, value);
    if (name === 'aria-hidden') check();
  };
  Element.prototype.removeAttribute = function (name: string) {
    origRemoveAttribute.call(this, name);
    if (name === 'aria-hidden') check();
  };
  Object.defineProperty(HTMLElement.prototype, 'focus', {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, options?: FocusOptions) {
      origFocus.call(this, options);
      check();
    },
  });

  return {
    violations,
    stop: () => {
      Element.prototype.setAttribute = origSetAttribute;
      Element.prototype.removeAttribute = origRemoveAttribute;
      if (focusDescriptor) Object.defineProperty(HTMLElement.prototype, 'focus', focusDescriptor);
    },
  };
}

// =================================================================================================
// Fixtures — a background trigger + an overlay, the shape every reported case has
// =================================================================================================

function DialogFixture({ autoFocusField = false }: { autoFocusField?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Same variant/size as the reported AccountControl trigger. */}
      <Button size="small" variant="text" data-testid="trigger" onClick={() => setOpen(true)}>
        Log in
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Sign in</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus={autoFocusField}
            label="Email"
            slotProps={{ htmlInput: { 'data-testid': 'field' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button data-testid="close" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function MenuFixture() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" data-testid="trigger" onClick={(e) => setAnchor(e.currentTarget)}>
        Views
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem data-testid="item" onClick={() => setAnchor(null)}>
          Save as new view…
        </MenuItem>
      </Menu>
    </>
  );
}

function mount(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

afterEach(() => cleanup());

// =================================================================================================
// 1. Mutation guard — the detector must be able to fail
// =================================================================================================

describe('MUTATION GUARD — the un-fixed ordering really does violate', () => {
  it('without the handoff, MUI hides the background while the trigger still holds focus', async () => {
    const user = userEvent.setup();
    const rec = recordViolations();
    try {
      mount(<DialogFixture />);
      await user.click(screen.getByTestId('trigger'));
      await screen.findByRole('dialog');
    } finally {
      rec.stop();
    }
    // This is the reported bug, reproduced. If this ever comes back empty, the detector broke —
    // do NOT delete this test to make the suite green.
    expect(rec.violations.join(' | ')).toContain('aria-hidden');
    expect(rec.violations.length).toBeGreaterThan(0);
  });
});

// =================================================================================================
// 2. The fix
// =================================================================================================

describe('installModalFocusHandoff — focus is never inside the aria-hidden background', () => {
  it('Dialog: open + close produce no violation, and focus is handed over and back', async () => {
    const user = userEvent.setup();
    const uninstall = installModalFocusHandoff();
    const rec = recordViolations();
    try {
      mount(<DialogFixture />);
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      const dialog = await screen.findByRole('dialog');
      // Focus must land INSIDE the dialog, not be dropped on the floor.
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.click(screen.getByTestId('close'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // …and come back to the control that opened it.
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    } finally {
      rec.stop();
      uninstall();
    }
    expect(rec.violations).toEqual([]);
  });

  it('Dialog with an autoFocus field: no violation on the CLOSE path either', async () => {
    // This is the case `autoFocus` alone makes worse: focus entering the trap sets FocusTrap's
    // `nodeToRestore` to the trigger, so close restores to it while aria-hidden is still up.
    // It passes only because the theme also sets `MuiModal.defaultProps.disableRestoreFocus`.
    const user = userEvent.setup();
    const uninstall = installModalFocusHandoff();
    const rec = recordViolations();
    try {
      mount(<DialogFixture autoFocusField />);
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await screen.findByRole('dialog');
      expect(document.activeElement).toBe(screen.getByTestId('field'));

      await user.click(screen.getByTestId('close'));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    } finally {
      rec.stop();
      uninstall();
    }
    expect(rec.violations).toEqual([]);
  });

  it('Menu: Popover renders a Modal, so the same seam has to cover it', async () => {
    const user = userEvent.setup();
    const uninstall = installModalFocusHandoff();
    const rec = recordViolations();
    try {
      mount(<MenuFixture />);
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await screen.findByRole('menu');

      await user.click(screen.getByTestId('item'));
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    } finally {
      rec.stop();
      uninstall();
    }
    expect(rec.violations).toEqual([]);
  });
});

// =================================================================================================
// 3. Structural guards — the seam only works if it is actually wired up
// =================================================================================================

describe('the seam is installed for the real app', () => {
  // `import.meta.glob` (the repo's source-scan idiom — see `theme/focus-visible.spec.tsx`) rather
  // than a raw path import, which `@nx/enforce-module-boundaries` rejects.
  const SOURCES = import.meta.glob(
    [
      '/src/main.tsx',
      '/src/prebootstrap.ts',
      '/src/mountApp.tsx',
      '/src/app/shared/theme/theme.ts',
    ],
    {
      query: '?raw',
      import: 'default',
      eager: true,
    },
  ) as Record<string, string>;

  it('the scan is not vacuous', () => {
    expect(Object.keys(SOURCES).sort()).toEqual([
      '/src/app/shared/theme/theme.ts',
      '/src/main.tsx',
      '/src/mountApp.tsx',
      '/src/prebootstrap.ts',
    ]);
  });

  it('main initializes the workspace before dynamically mounting the app', () => {
    const source = SOURCES['/src/main.tsx'];
    const prebootstrapImport = source.indexOf("from './prebootstrap'");
    const initialize = source.indexOf('initializeDemoWorkspace()');
    const mountImport = source.indexOf("await import('./mountApp')");
    const mountCall = source.indexOf('mountApp()');
    expect(prebootstrapImport).toBeGreaterThanOrEqual(0);
    expect(initialize).toBeGreaterThan(prebootstrapImport);
    expect(mountImport).toBeGreaterThan(initialize);
    expect(mountCall).toBeGreaterThan(mountImport);
    expect(SOURCES['/src/prebootstrap.ts']).toContain("from '@convexa/api'");
  });

  it('mountApp installs the handoff before createRoot and render', () => {
    const source = SOURCES['/src/mountApp.tsx'];
    const install = source.indexOf('installModalFocusHandoff()');
    const createRoot = source.indexOf('ReactDOM.createRoot(');
    const render = source.indexOf('root.render(');
    expect(install).toBeGreaterThanOrEqual(0);
    expect(createRoot).toBeGreaterThan(install);
    expect(render).toBeGreaterThan(createRoot);
  });

  it('the theme stands FocusTrap’s mis-ordered restore down (the other half of the pair)', () => {
    const source = SOURCES['/src/app/shared/theme/theme.ts'];
    expect(source).toContain('MuiModal');
    expect(source).toContain('disableRestoreFocus');
  });

  it('installation is idempotent — a second call does not double-wrap', () => {
    const first = installModalFocusHandoff();
    const second = installModalFocusHandoff();
    expect(second).toBe(first);
    first();
  });
});
