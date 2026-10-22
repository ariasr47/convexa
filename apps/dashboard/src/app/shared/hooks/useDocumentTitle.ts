/**
 * useDocumentTitle — the one place the app writes `document.title` (spec 2026-10-21/02, part (e)).
 * It sets the title on mount and whenever `title` changes, and puts back the title it found on
 * unmount, so leaving a route returns the tab to the shell's title (`apps/dashboard/index.html`).
 *
 * Call it ONCE per route, in the component that knows the most. Never nest two calls on one route:
 * React runs a child's effects before its parent's, so a parent's call would overwrite the child's.
 *
 * Titles end in ' — Convexa'; ' · ' joins facts inside a title (e.g. 'NVDA · <note title>').
 */
import { useEffect } from 'react';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
