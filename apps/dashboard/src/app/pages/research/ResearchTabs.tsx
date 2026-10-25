/**
 * The Research section's own tabs: the notes, the public-data views beside them, and the scorecard.
 * The top bar's amber already marks the section, so the current tab here is underlined in text colour
 * and amber stays spent. On a phone the row scrolls sideways as a rail rather than wrapping.
 *
 * A full-bleed band directly under the top bar, its rule edge to edge and its tabs on the page column
 * (design: lib.mjs v4Tabs, `.v4-tabs > .wrap`; fidelity audit 2026-10-25, R-12). Each research page
 * renders it above its column, not inside it.
 */
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import { dataMode } from '@convexa/api';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { researchIndex } from 'virtual:convexa-research';
import { useSampleLedger } from './sampleLedger';
import { MONO } from './ui';

const openForecasts = researchIndex.reduce(
  (n, r) => n + r.latest.forecasts.filter((f) => f.outcome === null).length,
  0,
);

export function ResearchTabs() {
  const { pathname } = useLocation();
  // The demo build counts its own six sample notes and their forecasts, not production's.
  const ledger = useSampleLedger();
  const demo = dataMode === 'demo';
  const demoOpen = ledger ? ledger.forecasts.filter((f) => f.outcome === null).length : null;
  const TABS: { to: string; label: string; badge: string | null }[] = [
    {
      to: '/research',
      label: 'Notes',
      badge: String(demo ? STAGING_DEMO_SYMBOLS.length : researchIndex.length),
    },
    { to: '/research/markets', label: 'Markets', badge: null },
    { to: '/research/filings', label: 'Filings', badge: null },
    {
      to: '/research/scorecard',
      label: 'Scorecard',
      badge: demo ? (demoOpen === null ? null : `${demoOpen} open`) : `${openForecasts} open`,
    },
  ];
  const current = (to: string) =>
    to === '/research' ? pathname === '/research' : pathname.startsWith(to);
  return (
    <Box
      component="nav"
      aria-label="Research"
      sx={(t) => ({ borderBottom: `1px solid ${t.palette.divider}` })}
    >
      <Box
        sx={{
          ...pageColumnSx,
          display: 'flex',
          gap: 0.5,
          height: 48,
          alignItems: 'stretch',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const on = current(tab.to);
          return (
            <Box
              key={tab.to}
              component={RouterLink}
              to={tab.to}
              aria-current={on ? 'page' : undefined}
              sx={(t) => ({
                display: 'flex',
                flex: 'none',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                fontSize: 14,
                fontWeight: on ? 600 : 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                color: on ? 'text.primary' : 'text.secondary',
                boxShadow: on ? `inset 0 -2px 0 ${t.palette.text.primary}` : 'none',
                transition: 'color 160ms ease-out',
                '&:hover': { color: 'text.primary' },
              })}
            >
              {tab.label}
              {tab.badge && (
                <Box
                  component="span"
                  sx={(t) => ({
                    ...MONO,
                    fontSize: 11,
                    px: 0.75,
                    py: '1px',
                    borderRadius: '999px',
                    color: 'text.primary',
                    bgcolor: alpha(t.palette.text.secondary, 0.16),
                  })}
                >
                  {tab.badge}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
