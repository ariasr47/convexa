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
import { formatAccountSize, formatAmount, validateAccountSize, validateCap } from './riskInputs';
import { RiskInputsSection } from './RiskInputsSection';
import {
  defaultRiskInputs,
  installAuthBackend,
  uninstallAuthBackend,
  userSession,
} from './testBackend';
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
    // Shown grouped with its unit, as the board draws it (site check D-23); stored as 50000.
    await waitFor(() =>
      expect(screen.getByTestId('risk-inputs-account-size')).toHaveValue('$50,000'),
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

// Site check D-23: the account size reads "$25,000", as the board draws it, and that display text
// must save back as the SAME number. A money parser that misreads the grouped text (or a decimal
// comma) would silently change the figure the AI is told to size within.
describe('the account size display reads back to the stored number (D-23)', () => {
  it('formats grouped with its unit, and the validators read that text back verbatim', () => {
    expect(formatAccountSize(25_000)).toBe('$25,000');
    expect(formatAccountSize(1_234_567.89)).toBe('$1,234,567.89');
    expect(formatAccountSize(950)).toBe('$950');
    expect(formatAccountSize(null)).toBe('');
    for (const n of [1, 950, 25_000, 25_000.5, 1_234_567.89, 1_000_000]) {
      expect(validateAccountSize(formatAccountSize(n))).toEqual({ ok: true, value: n });
      expect(validateCap(formatAmount(n), 'usd', null)).toEqual({
        ok: true,
        value: { value: n, unit: 'usd' },
      });
    }
    expect(validateCap(formatAmount(2), 'percent', 25_000)).toEqual({
      ok: true,
      value: { value: 2, unit: 'percent' },
    });
  });

  it('accepts what a person types in either form, and refuses commas that are not thousands groups', () => {
    expect(validateAccountSize('25000')).toEqual({ ok: true, value: 25_000 });
    expect(validateAccountSize(' $ 25,000 ')).toEqual({ ok: true, value: 25_000 });
    expect(validateCap('$500', 'usd', 25_000)).toEqual({
      ok: true,
      value: { value: 500, unit: 'usd' },
    });
    const refused = { ok: false, error: C.errorGreaterThanZero };
    expect(validateAccountSize('1,50')).toEqual(refused); // a decimal comma, never 150
    expect(validateAccountSize('25,00,0')).toEqual(refused);
    expect(validateAccountSize('$')).toEqual(refused);
    expect(validateCap('$2', 'percent', 25_000)).toEqual(refused); // `$` only on a dollar figure
    expect(validateAccountSize('')).toEqual({ ok: true, value: null }); // clearing stays legal
  });

  it('refuses a thousands group that starts with zero: "0,500" is a decimal comma to someone', () => {
    const refused = { ok: false, error: C.errorGreaterThanZero };
    for (const raw of ['0,500', '$0,500', '012,345', '000,001', '00,500.25']) {
      expect(validateAccountSize(raw), raw).toEqual(refused);
      expect(validateCap(raw, 'usd', null), raw).toEqual(refused);
    }
    expect(validateCap('0,5', 'percent', 25_000)).toEqual(refused);
    // A real group still reads: the first group is 1–3 digits with no leading zero.
    expect(validateAccountSize('1,000,000')).toEqual({ ok: true, value: 1_000_000 });
    expect(validateAccountSize('$100,000.50')).toEqual({ ok: true, value: 100_000.5 });
  });

  it('refuses every number form but a plain decimal: hex, binary, octal, exponent', () => {
    const refused = { ok: false, error: C.errorGreaterThanZero };
    for (const raw of ['0x10', '$0x10', '1e3', '$1e3', '0b11', '0o17', '1_000', '.5', '5.']) {
      expect(validateAccountSize(raw), raw).toEqual(refused);
      expect(validateCap(raw, 'usd', null), raw).toEqual(refused);
    }
    // In range for a percent cap, so only the strict form keeps these out.
    for (const raw of ['1e1', '0x5', '0b11']) {
      expect(validateCap(raw, 'percent', 25_000), raw).toEqual(refused);
    }
    expect(validateAccountSize('25000.75')).toEqual({ ok: true, value: 25_000.75 });
    expect(validateCap('2.5', 'percent', 25_000)).toEqual({
      ok: true,
      value: { value: 2.5, unit: 'percent' },
    });
  });

  it('a stored $25,000 shows as "$25,000" and an untouched Save sends 25000, the same number', async () => {
    const user = userEvent.setup();
    const backend = installAuthBackend({
      session: userSession('u-1', 'trader@example.com'),
      riskInputs: {
        ...defaultRiskInputs(),
        state: 'set',
        account_size: 25_000,
        per_trade_cap: { value: 2, unit: 'percent' },
      },
    });
    render(
      <Mount>
        <RiskInputsSection />
      </Mount>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('risk-inputs-account-size')).toHaveValue('$25,000'),
    );
    await user.click(screen.getByTestId('risk-inputs-save'));
    await screen.findByTestId('risk-inputs-saved');
    expect(backend.calls.settingsPut).toBe(1);
    expect(backend.state.riskInputs.account_size).toBe(25_000);
    expect(backend.state.riskInputs.per_trade_cap).toEqual({ value: 2, unit: 'percent' });
  });
});
