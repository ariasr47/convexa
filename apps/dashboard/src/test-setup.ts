// Vitest setup for the dashboard test suite (wired via `setupFiles` in vite.config.mts).
// Adds jest-dom matchers (toBeInTheDocument, toHaveValue, …) to Vitest's `expect`.
import '@testing-library/jest-dom/vitest';

// @testing-library/react auto-cleans between tests when run under Vitest globals, but we register
// it explicitly so the behavior is guaranteed regardless of the globals setting. cleanup() is
// idempotent, so this is safe even if the adapter has already wired its own afterEach.
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// findBy*/waitFor default to 1s, which flakes on loaded CI runners (a shared 4-vCPU box renders
// far slower than a dev machine). 5s only delays *failure* reporting — passing waits return early.
configure({ asyncUtilTimeout: 5000 });
