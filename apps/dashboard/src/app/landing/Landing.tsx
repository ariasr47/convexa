/**
 * Convexa landing page (`/`, full-bleed, OUTSIDE the shell — README §2, UX_BLUEPRINT §3).
 * A single dark marketing surface. STATIC — no fetch, no SSE, no store, no compute (rendering `/`
 * issues no network request). It renders NO trader nav shell.
 *
 * Honesty floor (`[no-real-order-path]`): no affordance presents an un-built capability as working.
 * The coming-soon boxes are visually inert (`ComingSoonBox` hatch). The brokerage-connect "Notify me"
 * control is a NON-navigating waitlist acknowledgement — it shows a toast and never enters a broker
 * flow and never dead-ends. Every value-prop / hero CTA navigates into a real in-shell route.
 *
 * Re-skin (convexa-redesign): composes the shared `ui/` primitives — ConvexityMotif (hero motif),
 * ValueCard (the 3 "what works today" cards), ComingSoonBox (the coming-soon band) — plus MUI atoms.
 * Tokens come from the theme (`primary.main`, `text.secondary`, `background.*`, `divider`) — no hex.
 */
import { useState } from 'react';
import {
  Box, Button, Chip, Container, Divider, Link, Snackbar, Stack, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockIcon from '@mui/icons-material/Lock';
import RadarIcon from '@mui/icons-material/Radar';
import { ConvexaMark } from '../shell/ConvexaMark';
import { ConvexityMotif, ValueCard, ComingSoonCard, Jargon } from '../ui';

// Jargon tooltip copy — verbatim, plain-language (README §2 / UX_BLUEPRINT honesty floor).
const DEALER_GAMMA_GLOSS =
  'How options dealers are positioned — it tells you where price tends to get pulled toward or pushed ' +
  'away from, and whether the market is likely to calm down or speed up.';
const SIMULATED_GLOSS =
  'Practice mode — positions and P/L are tracked for you, but nothing is sent to a broker and no real ' +
  'money moves.';

// The waitlist acknowledgement toast — non-navigating, never implies a broker connection.
const WAITLIST_TOAST = "Thanks — we'll let you know when brokerage connect is live.";

export function Landing() {
  // The brokerage-connect waitlist affordance is non-navigating: a click acknowledges in place
  // (toast) and never enters a broker flow.
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <Box
      data-testid="landing"
      sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}
    >
      {/* ===== 1. Hero ===== */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <ConvexityMotif />
        <Container maxWidth="md" sx={{ position: 'relative', py: { xs: 8, md: 12 } }}>
          <Stack spacing={3} sx={{ alignItems: 'flex-start', maxWidth: 660 }}>
            <Chip
              label="Dealer-gamma analytics"
              size="small"
              sx={{
                bgcolor: 'rgba(79, 156, 255, 0.12)',
                color: 'primary.main',
                fontWeight: 600,
                borderRadius: 999,
              }}
            />
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.25rem', md: '3.125rem' },
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.08,
              }}
            >
              See the AI read on your real positioning.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620 }}>
              Connect your positions and get an AI read on your real risk — grounded in live{' '}
              <Jargon term="dealer gamma" gloss={DEALER_GAMMA_GLOSS} />, not vibes.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
              <Button
                component={RouterLink}
                to="/ticker"
                variant="contained"
                size="large"
                data-testid="cta-primary"
              >
                Open the Ticker viewer →
              </Button>
              <Button
                component={RouterLink}
                to="/ticker"
                variant="outlined"
                size="large"
                data-testid="cta-secondary"
              >
                See a live example
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ===== 2. What works today ===== */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', mb: 2, letterSpacing: '0.08em' }}
        >
          What works today
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          <ValueCard
            icon={<BarChartIcon />}
            title="Ticker / GEX analysis"
            testId="vp-ticker"
            ctaTestId="vp-ticker-cta"
            to="/ticker"
            ctaLabel="Analyze a ticker →"
            body={
              <>
                <Jargon term="Dealer gamma" gloss={DEALER_GAMMA_GLOSS} /> walls, the gamma flip, live
                order flow, and volatility context for any ticker — the structure that says where price
                is pulled and whether the regime fades or trends.
              </>
            }
          />
          <ValueCard
            icon={<AccountBalanceWalletIcon />}
            title="Simulated positions portfolio"
            testId="vp-positions"
            ctaTestId="vp-positions-cta"
            to="/positions"
            ctaLabel="Open Positions →"
            body={
              <>
                Track simulated positions with live P/L, fills, grouping, and saved views. Paper-only —
                every trade is <Jargon term="SIMULATED" gloss={SIMULATED_GLOSS} />, nothing touches a
                broker.
              </>
            }
          />
          <ValueCard
            icon={<AutoAwesomeIcon />}
            title="AI recommendations"
            testId="vp-airec"
            ctaTestId="vp-airec-cta"
            to="/ticker"
            ctaLabel="See it on a ticker →"
            body={
              <>
                An AI read on the current setup — risk-first, framed by your trader persona, grounded in
                the positioning the engine already computed. Advisory only; you confirm every paper trade.
              </>
            }
          />
        </Box>
      </Container>

      {/* ===== 3. Honest coming-soon band (hatched, inert) ===== */}
      <Container maxWidth="lg" sx={{ pb: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
            gap: 3,
          }}
        >
          {/* Brokerage connect — the headline future capability. Non-navigating waitlist affordance. */}
          <ComingSoonCard
            testId="brokerage-block"
            icon={<LockIcon />}
            title="Connect a real brokerage"
            body={
              <>
                Connect your real brokerage positions — get the same AI reads on the risk you&apos;re
                actually carrying. <strong>Coming soon.</strong>
              </>
            }
            action={
              <Button
                variant="outlined"
                size="small"
                onClick={() => setToastOpen(true)}
                data-testid="waitlist-button"
              >
                Notify me
              </Button>
            }
          />

          {/* Scanner — coming soon. Links to the honest in-shell placeholder (never "working"). */}
          <ComingSoonCard
            testId="scanner-block"
            icon={<RadarIcon />}
            title="Scanner"
            body={
              <>
                A multi-ticker scanner to surface the best setups across names. <strong>Coming soon.</strong>
              </>
            }
            action={
              <Link
                component={RouterLink}
                to="/scanner"
                underline="hover"
                data-testid="scanner-cta"
                sx={{ fontWeight: 600 }}
              >
                Preview the scanner →
              </Link>
            }
          />
        </Box>
      </Container>

      {/* ===== 4. Footer ===== */}
      <Divider />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={1}>
          <ConvexaMark size={16} fontSize="1rem" />
          <Typography variant="caption" color="text.secondary" data-testid="footer-disclaimer">
            Convexa is an analysis tool. All positions and trades shown are <strong>simulated</strong>{' '}
            (paper). Not investment advice. No brokerage connection.
          </Typography>
        </Stack>
      </Container>

      {/* Non-navigating waitlist acknowledgement (toast). Never enters a broker flow. */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={<span data-testid="waitlist-ack">{WAITLIST_TOAST}</span>}
        ContentProps={{ 'aria-live': 'polite' }}
      />
    </Box>
  );
}

export default Landing;
