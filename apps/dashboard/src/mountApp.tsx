import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/app';
import { installModalFocusHandoff } from './app/shared/a11y/modalFocusHandoff';

/** Install modal focus handling before React creates any managed modal. */
export function mountApp() {
  installModalFocusHandoff();
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
