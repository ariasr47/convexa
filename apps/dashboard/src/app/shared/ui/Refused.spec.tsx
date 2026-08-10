import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Refused } from './Refused';

afterEach(() => cleanup());

describe('Refused', () => {
  it('shows action label, reason, and focusable sign-in', async () => {
    const onSignIn = vi.fn();
    render(
      <Refused
        actionLabel="Simulate this trade"
        reason="Sign in to open a paper position."
        onSignIn={onSignIn}
      />,
    );
    expect(screen.getByTestId('refused-affordance')).toBeInTheDocument();
    expect(screen.getByTestId('refused-affordance-reason').textContent).toMatch(/Sign in/i);
    const btn = screen.getByTestId('refused-affordance-sign-in');
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
