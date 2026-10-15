/**
 * A provenance chip as a link to its source's card on /credits. Inside the router it navigates
 * in place (the credits page scrolls to the card on mount); outside it (a test, an isolated
 * render) it is a plain link. A chip whose text names no source renders as it was.
 */
import Link from '@mui/material/Link';
import type { ReactNode } from 'react';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';
import { creditsAnchor, creditsHref } from './anchor';

export function CreditsLink({ text, children }: { text: string; children: ReactNode }) {
  const inRouter = useInRouterContext();
  const anchor = creditsAnchor(text);
  if (!anchor) return <>{children}</>;
  const href = creditsHref(anchor);
  const common = {
    underline: 'none' as const,
    title: 'About this source: Data sources and credits',
    sx: { maxWidth: '100%', color: 'inherit', display: 'inline-flex', borderRadius: '12px' },
    'data-credits': anchor,
  };
  return inRouter ? (
    <Link component={RouterLink} to={href} {...common}>
      {children}
    </Link>
  ) : (
    <Link href={href} {...common}>
      {children}
    </Link>
  );
}
