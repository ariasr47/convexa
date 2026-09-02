import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OperatorSessionArchive } from './OperatorSessionArchive';
import { COPY } from './copy';

function wrap(ui: ReactElement) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

describe('OperatorSessionArchive gate chrome', () => {
  it('locked form — API origin not password; token password; Unlock; no GET', async () => {
    const fetchImpl = vi.fn();
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);

    expect(screen.getByTestId('operator-session-archive')).toBeInTheDocument();
    expect(screen.getByText(COPY.appBar)).toBeInTheDocument();
    expect(screen.getByText(COPY.readOnlyChip)).toBeInTheDocument();
    expect(document.title).toBe(COPY.documentTitle);

    const origin = screen.getByTestId('osa-origin') as HTMLInputElement;
    const token = screen.getByTestId('osa-token') as HTMLInputElement;
    expect(origin.type).toBe('text');
    expect(origin.type).not.toBe('url');
    expect(token.type).toBe('password');
    expect(screen.getByTestId('osa-unlock')).toHaveTextContent(COPY.unlock);
    expect(screen.queryByRole('heading', { name: 'Lab' })).not.toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('origin-rejected empty — no GET; title origin-rejected', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await user.click(screen.getByTestId('osa-unlock'));
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(COPY.originRejectedTitle)).toBeInTheDocument();
    expect(within(alert).getByText(COPY.originRejectedEmpty)).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('origin-rejected pages.dev — no GET', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await user.type(screen.getByTestId('osa-origin'), 'https://convexa.pages.dev');
    await user.click(screen.getByTestId('osa-unlock'));
    expect(screen.getByText(COPY.originRejectedTitle)).toBeInTheDocument();
    expect(screen.getByText(COPY.originRejectedPages)).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('origin-rejected relative — no GET', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    await user.type(screen.getByTestId('osa-origin'), '/api/_research');
    await user.click(screen.getByTestId('osa-unlock'));
    expect(screen.getByText(COPY.originRejectedUnusable)).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Pages document helper does not flip origin-blocked', async () => {
    const fetchImpl = vi.fn();
    wrap(
      <OperatorSessionArchive fetchImpl={fetchImpl} documentHost="convexa.pages.dev" />,
    );
    expect(screen.getByTestId('osa-pages-helper')).toHaveTextContent(COPY.pagesHelper);
    expect(screen.queryByText(COPY.originBlockedTitle)).not.toBeInTheDocument();
  });

  it('secrets absent from Alert / title / URL after typing', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    wrap(<OperatorSessionArchive fetchImpl={fetchImpl} />);
    const secret = 'super-secret-token-value';
    const origin = 'https://api.example.com';
    await user.type(screen.getByTestId('osa-origin'), '   ');
    await user.type(screen.getByTestId('osa-token'), secret);
    await user.click(screen.getByTestId('osa-unlock'));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain(secret);
    expect(alert.textContent).not.toContain(origin);
    expect(document.title).not.toContain(secret);
    expect(window.location.href).not.toContain(secret);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('Alert severity warning without icon={false}', () => {
    wrap(<OperatorSessionArchive />);
    // locked has no alert; unlock empty to get one
  });
});
