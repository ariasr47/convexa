// Keep the application graph (and every durable store) out of evaluation until the
// build-selected workspace has been initialized.
async function start() {
  const api = await import('@convexa/api');
  api.initializeDemoWorkspace();
  const { mountApp } = await import('./mountApp');
  mountApp();
}

void start();
