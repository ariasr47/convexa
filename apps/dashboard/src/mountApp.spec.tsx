/**
 * The root boundary is wired: a throw that escapes the app (here, the whole App) shows the root
 * notice with a working way out, never a blank page. Before it existed a provider throw unmounted
 * the entire React tree.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./app/app', () => ({
  default: () => {
    throw new Error('boom');
  },
}));

import { Root } from './mountApp';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Root', () => {
  it('shows the root notice instead of a blank page when the app throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Root />);
    expect(screen.getByRole('alert')).toHaveTextContent("Convexa couldn't finish loading");
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home page' })).toHaveAttribute('href', '/');
  });
});
