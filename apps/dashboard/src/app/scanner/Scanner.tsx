/**
 * Scanner — static "coming soon" placeholder (UX_BLUEPRINT §4, AC-Scan-1; convexa-redesign re-skin).
 * In the shell, but does ZERO data work: no fetch, no SSE, no compute, no backend call, no
 * spinner/skeleton. The ABSENCE of any network request is itself the AC-Scan-1 requirement — it must
 * not imply it is working or fetching. The later `scanner` feature builds the real thing.
 *
 * Presentation-only re-skin to the Figma frame "Scanner — Coming soon" (FRONTEND_EXECUTION_CONTRACT
 * · SURFACE: Scanner). The hatched inert card reuses `ui/ComingSoonBox` (structural `no-real-order-path`
 * inertness — the box itself never links). Tokens via the theme; the only sx literals are the documented
 * hatch stripe colors (`background.paper`/`extras.hatchAlt`) + the badge amber-alpha tints (`warning.main`).
 */
import { Box, Typography, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ComingSoonBox } from '../ui/ComingSoonBox';
import { extras } from '../tokens';

export function Scanner() {
  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', p: 3 }}>
      <ComingSoonBox
        data-testid="scanner-placeholder"
        sx={{
          maxWidth: 560,
          mx: 'auto',
          my: 8,
          backgroundImage: (theme) =>
            `repeating-linear-gradient(135deg, ${theme.palette.background.paper} 0 20px, ${extras.hatchAlt} 20px 40px)`,
          borderRadius: '14px',
          p: '52px 40px',
          textAlign: 'center',
        }}
      >
        {/* Scanner mark — blue magnifier with a check (Figma frame glyph). Token-driven stroke via
            `currentColor` on a wrapper coloured `primary.main`, so it is not a hardcoded hex. */}
        <Box
          component="svg"
          aria-hidden
          width={48}
          height={48}
          viewBox="0 0 24 24"
          fill="none"
          sx={{ display: 'block', margin: '0 auto 16px', color: 'primary.main' }}
        >
          <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={1.8} />
          <path d="M16 16 L21 21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          <path
            d="M8 11 L10.5 13.5 L14 8.5"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Box>

        <Typography component="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, mb: '12px' }}>
          Scanner — coming soon
        </Typography>

        <Typography
          component="p"
          sx={{
            maxWidth: 420,
            mx: 'auto',
            mb: '22px',
            fontSize: '0.92rem',
            lineHeight: 1.6,
            color: 'text.secondary',
          }}
        >
          A multi-ticker scanner that surfaces the strongest setups across names is on the roadmap.
          It&rsquo;s not live yet — for now, analyze one ticker at a time on the{' '}
          <Box component="strong" sx={{ color: 'text.primary' }}>
            Ticker
          </Box>{' '}
          page.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
          <Box
            component="span"
            sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: 'warning.main',
              border: '1px solid',
              borderColor: 'rgba(255,167,38,0.35)',
              bgcolor: 'rgba(255,167,38,0.08)',
              borderRadius: 999,
              padding: '3px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            coming soon
          </Box>
          <Link
            component={RouterLink}
            to="/ticker"
            data-testid="scanner-ticker-link"
            underline="hover"
            sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'primary.main' }}
          >
            Go to the Ticker viewer →
          </Link>
        </Box>
      </ComingSoonBox>
    </Box>
  );
}

export default Scanner;
