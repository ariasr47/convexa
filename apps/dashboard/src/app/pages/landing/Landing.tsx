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
 * Re-skin (convexa-redesign → redesign-stage-2): composes the shared `ui/` primitives — ValueCard
 * (the 3 "what works today" cards), ComingSoonBox (the coming-soon band) — plus the page-local
 * HeroCurve (THE signature moment; it replaced the old hero motif wallpaper + radial blob) and MUI
 * atoms. Tokens come from the theme (`primary.main`, `text.secondary`, `background.*`, `divider`)
 * — no hex. Sections 1–3 sit inside the page's single `<main>` landmark (Stage 0 §10.2 deferral,
 * landed at stage 2); the heading outline is h1 (hero) → h2 ("What works today") → h3 (card titles).
 */
import { displayScale } from '@/shared/theme/tokens';
import { ComingSoonCard, Jargon, ValueCard } from '@/shared/ui';
import { Footer } from '@/shell/Footer';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import LockIcon from '@mui/icons-material/Lock';
import RadarIcon from '@mui/icons-material/Radar';
import { Box, Button, Chip, Container, Link, Snackbar, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { HeroCurve } from './HeroCurve';

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
      {/* The page's single <main> landmark — sections 1–3; the Footer (<footer>) stays outside.
          Landing renders outside the AppShell (which owns the in-shell <main>), so exactly one
          <main> exists on this route. */}
      <Box component="main">
        {/* ===== 1. Hero ===== */}
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          {/* THE moment (paint-only overlay; the hero box is sized by its content, never the SVG). */}
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
              {/* Display scale lands (§6.4): the Stage-1 `displayScale` export on its intended
                surface — 44–56px fluid clamp, Archivo 700 Expanded via the theme h1 variant.
                COPY LOCKED (Stage 0 §4.3 — visuals only). */}
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
              {/* Honest hero (redesign-stage-0 §4.3, `[no-real-order-path]`): sells ONLY today-working
                value — no connect-your-positions / real-risk claim. The hatched "Connect a real
                brokerage — Coming soon" card below stays the ONLY place the future capability appears. */}
              <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 620 }}>
                Gamma walls, the flip, and live order flow for any ticker — plus an AI read on the
                setup and a simulated portfolio to practice it. Grounded in live{' '}
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
          {/* Heading outline (§6.2): the section label IS the h2 — styling unchanged (overline). */}
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
              icon={<BarChartIcon />}
              title="Ticker / GEX analysis"
              testId="vp-ticker"
              ctaTestId="vp-ticker-cta"
              to="/ticker"
              ctaLabel="Analyze a ticker →"
              body={
                <>
                  <Jargon term="Dealer gamma" gloss={DEALER_GAMMA_GLOSS} /> walls, the gamma flip,
                  live order flow, and volatility context for any ticker — the structure that says
                  where price is pulled and whether the regime fades or trends.
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
                  Track simulated positions with live P/L, fills, grouping, and saved views.
                  Paper-only — every trade is <Jargon term="SIMULATED" gloss={SIMULATED_GLOSS} />,
                  nothing touches a broker.
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
                  An AI read on the current setup — risk-first, framed by your trader persona,
                  grounded in the positioning the engine already computed. Advisory only; you
                  confirm every paper trade.
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

            {/* Scanner — coming soon. Links to the honest in-shell placeholder (never "working"). */}
            <ComingSoonCard
              testId="scanner-block"
              icon={<RadarIcon />}
              title="Scanner"
              body={
                <>
                  A multi-ticker scanner to surface the best setups across names.{' '}
                  <strong>Coming soon.</strong>
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
      </Box>

      {/* ===== 4. Footer ===== */}
      <Footer />

      {/* Non-navigating waitlist acknowledgement (toast). Never enters a broker flow. */}
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
