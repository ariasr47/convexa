import { initializeDemoWorkspace } from './prebootstrap';

// Keep the application graph (and every durable store) out of evaluation until the
// build-selected workspace has been initialized.
async function start() {
  initializeDemoWorkspace();
  const { mountApp } = await import('./mountApp');
  mountApp();
}

void start();
