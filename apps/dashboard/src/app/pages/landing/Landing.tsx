/**
 * Convexa landing page (`/`, full-bleed under the shell).
 * STATIC — no fetch, no SSE, no store, no compute (rendering `/` issues no network request).
 *
 * Product spine (where → why → plan → track):
 *   primary CTA → Scanner · secondary → Ticker · value cards mirror that order ·
 *   Positions as practice · AI as the read on a ticker · brokerage stays honest coming-soon.
 *
 * Honesty floor (`[no-real-order-path]`): no affordance presents an un-built capability as working.
 * Tokens only — no hex.
 */
import { displayScale } from '@/shared/theme/tokens';
import { ComingSoonCard, Jargon, ValueCard } from '@/shared/ui';
import { Footer } from '@/shell/Footer';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import LockIcon from '@mui/icons-material/Lock';
import RadarIcon from '@mui/icons-material/Radar';
import { Box, Button, Chip, Container, Snackbar, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { HeroCurve } from './HeroCurve';

// Jargon tooltip copy — plain-language (honesty floor).
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
      <Box component="main">
        {/* ===== 1. Hero ===== */}
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          <HeroCurve />
          <Container maxWidth="md" sx={{ position: 'relative', py: { xs: 8, md: 12 } }}>
            <Stack spacing={3} sx={{ alignItems: 'flex-start', maxWidth: 660 }}>
              <Chip
                label="Dealer-gamma analytics"
                size="small"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                  fontWeight: 600,
                  borderRadius: 999,
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: `clamp(${displayScale.minPx}px, 38px + 1.5vw, ${displayScale.maxPx}px)`,
                  fontWeight: displayScale.fontWeight,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.08,
                }}
              >
                See the dealer positioning behind the price.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 620 }}>
                Scan for structure, open a ticker for walls and the flip, then practice the plan on a{' '}
                <Jargon term="simulated" gloss={SIMULATED_GLOSS} /> book. Grounded in live{' '}
                <Jargon term="dealer gamma" gloss={DEALER_GAMMA_GLOSS} />, not vibes.
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
                data-testid="product-spine"
              >
                Scan → Ticker → Plan → Track
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  component={RouterLink}
                  to="/scanner"
                  variant="contained"
                  size="large"
                  data-testid="cta-primary"
                >
                  Open Scanner →
                </Button>
                <Button
                  component={RouterLink}
                  to="/ticker"
                  variant="outlined"
                  size="large"
                  data-testid="cta-secondary"
                >
                  Open free Ticker →
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>

        {/* ===== 2. What works today — spine order ===== */}
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography
            variant="overline"
            component="h2"
            sx={{ color: 'text.secondary', display: 'block', mb: 2, letterSpacing: '0.08em' }}
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
              icon={<RadarIcon />}
              title="Scanner"
              testId="vp-scanner"
              ctaTestId="vp-scanner-cta"
              to="/scanner"
              ctaLabel="Open Scanner →"
              body={
                <>
                  Ranked multi-ticker setups from live{' '}
                  <Jargon term="dealer gamma" gloss={DEALER_GAMMA_GLOSS} /> structure — score, tier,
                  walls, and distance to flip. Private testing: sign-in required.
                </>
              }
            />
            <ValueCard
              icon={<BarChartIcon />}
              title="Ticker / GEX analysis"
              testId="vp-ticker"
              ctaTestId="vp-ticker-cta"
              to="/ticker"
              ctaLabel="Analyze a ticker →"
              body={
                <>
                  Walls, the gamma flip, live order flow, and volatility context for any ticker —
                  free without an account. The structure that says where price is pulled.
                </>
              }
            />
            <ValueCard
              icon={<AccountBalanceWalletIcon />}
              title="Simulated positions"
              testId="vp-positions"
              ctaTestId="vp-positions-cta"
              to="/positions"
              ctaLabel="Open Positions →"
              body={
                <>
                  Track simulated positions with live P/L and saved views after you read the setup.
                  Paper-only — every trade is <Jargon term="SIMULATED" gloss={SIMULATED_GLOSS} />.
                </>
              }
            />
          </Box>
          <Box sx={{ mt: 3, maxWidth: 720 }}>
            <ValueCard
              icon={<AutoAwesomeIcon />}
              title="AI recommendations"
              testId="vp-airec"
              ctaTestId="vp-airec-cta"
              to="/ticker"
              ctaLabel="See it on a ticker →"
              body={
                <>
                  An AI read on the current setup — risk-first, framed by your trader persona,
                  grounded in the positioning the engine already computed. Advisory only; you
                  confirm every paper trade.
                </>
              }
            />
          </Box>
        </Container>

        {/* ===== 3. Honest coming-soon (broker only) ===== */}
        <Container maxWidth="lg" sx={{ pb: { xs: 4, md: 6 } }}>
          <ComingSoonCard
            testId="brokerage-block"
            icon={<LockIcon />}
            title="Connect a real brokerage"
            body={
              <>
                Connect your real brokerage positions — get the same AI reads on the risk
                you&apos;re actually carrying. <strong>Coming soon.</strong>
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
        </Container>
      </Box>

      <Footer />

      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={<span data-testid="waitlist-ack">{WAITLIST_TOAST}</span>}
        slotProps={{ content: { 'aria-live': 'polite' } }}
      />
    </Box>
  );
}

export default Landing;
