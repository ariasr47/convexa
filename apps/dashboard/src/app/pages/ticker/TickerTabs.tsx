/**
 * The ticker's three pages as tabs (Overview · Technical · Research), the same control the desk's
 * masthead carries (PublicDesk, TickerDashboard): links styled as tabs, 44 px tall, scrollable on a
 * phone. The current page is marked by the tab indicator and `aria-current`, never by amber alone.
 */
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Link as RouterLink } from 'react-router-dom';
import { tradingViewSymbol } from './technical-analysis/tradingView';

export type TickerTab = 'overview' | 'technical' | 'research';

/** TradingView's exchange codes, as the listing names them. AMEX is TradingView's code for every
 *  NYSE Arca listing (`tradingView.ts`). */
const EXCHANGE_NAMES: Record<string, string> = {
  AMEX: 'NYSE Arca',
  NASDAQ: 'Nasdaq',
  NYSE: 'NYSE',
};

/**
 * The listing line beside the symbol in the Technical mastheads (board `ticker-tech.mjs:64`, `:74`;
 * fidelity DESK-23): the company, then the exchange, as far as Convexa knows them — "SPDR S&P 500
 * ETF · NYSE Arca", "NVIDIA · Nasdaq". The exchange is the one `tradingViewSymbol` already places
 * the ticker on (its exchange map, else a research note's `about` line); an unknown part is left
 * out, never guessed, and with neither known there is no line.
 */
export function listingLine(
  ticker: string,
  company: string | null | undefined,
  about: string | null | undefined,
): string | null {
  const code = tradingViewSymbol(ticker, about).split(':');
  const exchange = code.length === 2 ? (EXCHANGE_NAMES[code[0]] ?? null) : null;
  const parts = [company?.trim() || null, exchange].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : null;
}

export function TickerTabs({ ticker, current }: { ticker: string; current: TickerTab }) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const path = `/ticker/${encodeURIComponent(ticker)}`;
  const tabs: [TickerTab, string, string][] = [
    ['overview', 'Overview', path],
    ['technical', 'Technical', `${path}/technical-analysis`],
    ['research', 'Research', `${path}/research`],
  ];
  return (
    <Tabs
      value={current}
      aria-label={`${ticker} ticker views`}
      variant={phone ? 'scrollable' : 'standard'}
      scrollButtons={phone ? 'auto' : false}
      sx={{
        minHeight: 44,
        // 13px, the boards' tab label (`.hd-tabs a`, `v4/hybrid-desk.mjs:16`), on a 44px target
        // (fidelity DESK-13, app side). Sentence case comes from the theme's button typography; its
        // 600 weight does not: the boards draw an unselected tab at 500 and the current one at 600
        // (fidelity R3).
        '& .MuiTab-root': { minHeight: 44, minWidth: 96, fontSize: 13, fontWeight: 500 },
        // Neutral (owner ruling A, 2026-10-15): the current page is carried by weight, a
        // `text.primary` label and a `text.primary` indicator, never amber.
        '& .MuiTab-root.Mui-selected': { color: 'text.primary', fontWeight: 600 },
        '& .MuiTabs-indicator': { bgcolor: 'text.primary' },
      }}
    >
      {tabs.map(([value, label, to]) => (
        <Tab
          key={value}
          component={RouterLink}
          to={to}
          value={value}
          label={label}
          aria-current={value === current ? 'page' : undefined}
        />
      ))}
    </Tabs>
  );
}
