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

export type TickerTab = 'overview' | 'technical' | 'research';

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
        '& .MuiTab-root': { minHeight: 44, minWidth: 96 },
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
