import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/app';
import { installModalFocusHandoff } from './app/shared/a11y/modalFocusHandoff';
import { RootErrorBoundary } from './app/shared/ui/RootErrorBoundary';

/** The whole tree. A throw no inner boundary catches shows the root notice, never a blank page. */
export function Root() {
  return (
    <StrictMode>
      <RootErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RootErrorBoundary>
    </StrictMode>
  );
}

/** Install modal focus handling before React creates any managed modal. */
export function mountApp() {
  installModalFocusHandoff();
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(<Root />);
}
