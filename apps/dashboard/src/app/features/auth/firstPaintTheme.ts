/**
 * First-paint theme hint. Two homes, same algorithm:
 *   1. The blocking `convexa-bootstrap-<hash>.js` script that the `convexa-build-bootstrap` Vite
 *      plugin injects into `index.html`'s head (cannot import this module — first paint is
 *      before the bundle). Structural spec pins the script to these keys + canvas tokens.
 *   2. `AppThemeProvider`, after the effective pref resolves (server-wins when signed in).
 *
 * Anonymous never-touched stays dark (AC-A3). `THEME_PAINT_KEY` is the last *resolved mode*,
 * not a settings store — never written into uiprefs (AC-F2 per-account isolation).
 */
import { dataMode, demoStorageKey } from '@convexa/api';
import { UIPREFS_KEY, UIPREFS_LEGACY_KEY } from './localPrefs';

export const THEME_PAINT_KEY = 'convexa.theme-paint';

export type PaintMode = 'light' | 'dark';

export function resolveFirstPaintMode(
  getItem: (key: string) => string | null,
  prefersLight: boolean,
): PaintMode {
  try {
    const cached = getItem(demoStorageKey(THEME_PAINT_KEY));
    if (cached === 'light' || cached === 'dark') return cached;
  } catch {
    /* storage unavailable */
  }
  try {
    const raw =
      getItem(demoStorageKey(UIPREFS_KEY)) ??
      (dataMode === 'demo' ? null : getItem(demoStorageKey(UIPREFS_LEGACY_KEY)));
    if (raw) {
      const theme = (JSON.parse(raw) as { theme?: unknown }).theme;
      if (theme === 'light') return 'light';
      if (theme === 'system') return prefersLight ? 'light' : 'dark';
    }
  } catch {
    /* corrupt blob or storage unavailable → anonymous dark */
  }
  return 'dark';
}

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
