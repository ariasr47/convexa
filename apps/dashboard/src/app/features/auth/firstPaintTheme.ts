/**
 * First-paint theme hint. The first-paint resolve (paint cache, then the uiprefs theme, else dark)
 * has ONE home: the blocking `convexa-bootstrap-<hash>.js` script that the `convexa-build-bootstrap`
 * Vite plugin injects into `index.html`'s head (it cannot import this module — first paint is before
 * the bundle). Structural spec pins the script to these keys + canvas tokens. This module keeps the
 * shared key and `applyPaintMode`, which `AppThemeProvider` calls after the effective pref resolves
 * (server-wins when signed in).
 *
 * Anonymous never-touched stays dark (AC-A3). `THEME_PAINT_KEY` is the last *resolved mode*,
 * not a settings store — never written into uiprefs (AC-F2 per-account isolation).
 */
import { demoStorageKey } from '@convexa/api';

export const THEME_PAINT_KEY = 'convexa.theme-paint';

export type PaintMode = 'light' | 'dark';

/** Apply the resolved mode to the document (html data-theme + theme-color + paint cache). */
export function applyPaintMode(doc: Document, mode: PaintMode, canvas: string): void {
  doc.documentElement.setAttribute('data-theme', mode);
  doc.documentElement.style.colorScheme = mode;
  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    doc.head.appendChild(meta);
  }
  meta.setAttribute('content', canvas);
  try {
    localStorage.setItem(demoStorageKey(THEME_PAINT_KEY), mode);
  } catch {
    /* quota / private mode — first paint still applied on the document */
  }
}
