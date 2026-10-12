/**
 * RiskInputsSection — component suite (tradeable-rec-inputs SPEC §4, AC-15/16/18/19/20/21/22/23/24/
 * 30/31/32/33/36). Mocks ONLY the network boundary (`fetch` via `testBackend`), never a live backend.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import { AuthDialogProvider } from './AuthDialogProvider';
import { RISK_INPUTS_COPY as C } from './copy';
import { RiskInputsSection } from './RiskInputsSection';
import { installAuthBackend, uninstallAuthBackend, userSession } from './testBackend';
import { AppThemeProvider } from './ThemeProvider';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  uninstallAuthBackend();
  localStorage.clear();
});

function Mount({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <AuthDialogProvider>{children}</AuthDialogProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </AuthProvider>
  );
}

function mountSignedIn() {
  installAuthBackend({ session: userSession('u-1', 'trader@example.com') });
  return render(
    <Mount>
      <RiskInputsSection />
    </Mount>,
  );
}

describe('the section helper — egress disclosure precedes BOTH fields (AC-16, U-1/U-1b)', () => {
  it('the first sentence names the AI-provider egress, and the helper text precedes both inputs in DOM order', async () => {
    mountSignedIn();
    const helper = await screen.findByTestId('risk-inputs-helper');
    expect(helper.textContent).toMatch(/^These figures are sent to your AI provider/);
    const account = screen.getByTestId('risk-inputs-account-size');
    const cap = screen.getByTestId('risk-inputs-cap-value');
    // DOM order: helper node compares "before" both field nodes.
    expect(helper.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(helper.compareDocumentPosition(cap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('save + reload round-trip (AC-15, ship-blocking)', () => {
  it('enters account size + a per-trade cap, saves, and a fresh mount shows the same two values with the same unit', async () => {
    const user = userEvent.setup();
    const view = mountSignedIn();
    await screen.findByTestId('risk-inputs-form');
    await user.clear(screen.getByTestId('risk-inputs-account-size'));
    await user.type(screen.getByTestId('risk-inputs-account-size'), '50000');
    await user.clear(screen.getByTestId('risk-inputs-cap-value'));
    await user.type(screen.getByTestId('risk-inputs-cap-value'), '1');
    await user.click(screen.getByTestId('risk-inputs-cap-unit-percent'));
    await user.click(screen.getByTestId('risk-inputs-save'));
    await screen.findByTestId('risk-inputs-saved');

    view.unmount();
    cleanup();
    render(
      <Mount>
        <RiskInputsSection />
      </Mount>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('risk-inputs-account-size')).toHaveValue('50000'),
    );
    expect(screen.getByTestId('risk-inputs-cap-value')).toHaveValue('1');
    expect(screen.getByTestId('risk-inputs-cap-unit-percent')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('effective-cap derivation surfaces (AC-22/23)', () => {
  it('a dollar cap with no account size saves, and the effective dollar cap shown equals the figure entered', async () => {
    const user = userEvent.setup();
    mountSignedIn();
    await screen.findByTestId('risk-inputs-form');
    await user.clear(screen.getByTestId('risk-inputs-account-size'));
    await user.click(screen.getByTestId('risk-inputs-cap-unit-usd'));
    await user.clear(screen.getByTestId('risk-inputs-cap-value'));
    await user.type(screen.getByTestId('risk-inputs-cap-value'), '400');
    await user.click(screen.getByTestId('risk-inputs-save'));
    await screen.findByTestId('risk-inputs-saved');
    expect(await screen.findByTestId('risk-inputs-effective-cap')).toHaveTextContent('$400');
  });

  it('a percent cap with no account size shows "Account size: not set" as the not-derivable reason — never $0, never blank', async () => {
    const user = userEvent.setup();
    mountSignedIn();
    await screen.findByTestId('risk-inputs-form');
    await user.clear(screen.getByTestId('risk-inputs-account-size'));
    await user.click(screen.getByTestId('risk-inputs-cap-unit-percent'));
    await user.clear(screen.getByTestId('risk-inputs-cap-value'));
    await user.type(screen.getByTestId('risk-inputs-cap-value'), '2');
    await user.click(screen.getByTestId('risk-inputs-save'));
    await screen.findByTestId('risk-inputs-saved');
    expect(await screen.findByTestId('risk-inputs-not-derivable')).toHaveTextContent(
      C.accountSizeNotSetReason,
    );
    expect(screen.queryByTestId('risk-inputs-not-derivable')).not.toHaveTextContent('$0');
  });
});

describe('failed save (AC-32)', () => {
  it('keeps typed values in the fields, shows settings.saveError verbatim, and never shows Saved', async () => {
    const user = userEvent.setup();
    installAuthBackend({
      session: userSession('u-1', 'trader@example.com'),
      settingsWrite: 'auth_unavailable',
    });
    render(
      <Mount>
        <RiskInputsSection />
      </Mount>,
    );
    await screen.findByTestId('risk-inputs-form');
    await user.clear(screen.getByTestId('risk-inputs-account-size'));
    await user.type(screen.getByTestId('risk-inputs-account-size'), '75000');
    await user.click(screen.getByTestId('risk-inputs-save'));
    expect(await screen.findByTestId('risk-inputs-save-error')).toHaveTextContent(C.saveError);
    expect(screen.getByTestId('risk-inputs-account-size')).toHaveValue('75000');
    expect(screen.queryByTestId('risk-inputs-saved')).not.toBeInTheDocument();
  });
});
