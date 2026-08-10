import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => cleanup());

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('catches a child throw and offers retry (route variant)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary variant="route">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('widget variant keeps a compact honest panel', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary variant="widget" label="Structure path">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('widget-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Structure path could not render/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('retry clears the error state when child becomes healthy', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    function Flip() {
      if (shouldThrow) throw new Error('once');
      return <div data-testid="ok-child">ok</div>;
    }
    render(
      <ErrorBoundary variant="widget" label="Tile">
        <Flip />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('widget-error-boundary')).toBeInTheDocument();
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByTestId('ok-child')).toBeInTheDocument();
    spy.mockRestore();
  });
});
