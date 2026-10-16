import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * A link to another page opens it at the top (W1-65). BrowserRouter keeps the window's scroll across
 * a pushed route, so a link at the foot of a long page (the blog post's “How Convexa works”) landed
 * part-way down the next one.
 *
 * It fires only when the PATHNAME changes. A page that rewrites its own query string
 * (`setSearchParams(…, { replace: true })` — the scanner's sort and filters, the filings kind chip)
 * flips the navigation type to REPLACE without moving to another page; keying on the navigation type
 * scrolled the reader to the top on the first such write. Back/forward (POP) is left to the
 * browser's own restoration, and an address with a #fragment to the page that scrolls to it
 * (MethodologyPage, Settings). The ref starts empty so a shell mounted by a push from a route
 * outside it still opens at the top; the first load is a POP and never scrolls.
 */
export function useScrollToTopOnPageChange(): void {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef<string | null>(null);
  useEffect(() => {
    const movedPage = previousPathname.current !== pathname;
    previousPathname.current = pathname;
    if (!movedPage || navigationType === 'POP' || hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);
}
