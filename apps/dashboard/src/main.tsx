import { initializeDemoWorkspace } from './prebootstrap';
import { shouldReloadOnce } from './reloadOnce';

// A chunk that fails to load, usually one a deploy has replaced, reloads the page once per tab; a
// second failure is left to the error boundaries (reloadOnce.ts). Registered before start() makes
// the first dynamic import.
window.addEventListener('vite:preloadError', () => {
  if (shouldReloadOnce(() => window.sessionStorage)) window.location.reload();
});

// Keep the application graph (and every durable store) out of evaluation until the
// build-selected workspace has been initialized.
async function start() {
  initializeDemoWorkspace();
  const { mountApp } = await import('./mountApp');
  mountApp();
}

void start();
