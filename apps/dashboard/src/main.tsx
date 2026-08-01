import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/app';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// App self-composes the auth + theme + sign-in-dialog providers around the route table (see app.tsx).
// The single BrowserRouter stays here (AC-Inv-8). who-am-I never blocks the trader path (AC-J1).
root.render(
  <StrictMode>
    {/* react-router v7: `v7_startTransition` and `v7_relativeSplatPath` are the DEFAULT behaviour
        and the `future` prop no longer exists on BrowserRouterProps. They were enabled explicitly on
        v6 first, and the suite verified green under those semantics BEFORE the upgrade, so the
        package bump changed no behaviour this app relies on. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
