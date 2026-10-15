/**
 * Convexa landing (`/`, the shell index route — `app.tsx:140-147`).
 *
 * Six sections, in the design's order (SPEC §1/§3 AC-L1), and no seventh: hero · structure field ·
 * triage score · AI read · "Numbers say where they came from" (the honesty section — the three trust
 * promises are content INSIDE it, not a section of their own) · CTA band. One hero instrument —
 * `GammaSurfaceHero`, the F1 dealer-gamma surface over strike × tenor (WebGL2 with its static
 * projection as the fallback, P-15) — plus three labelled samples of shipped surfaces
 * (`StructureFieldSample`, `ScoreStripSample`, `AiReadSample`), each in a dashed, hatched sample frame
 * (P-3, P-8). Production tags all four "Illustrative sample"; staging gives them the demo's chip.
 * `HeroCurve` stays `aria-hidden` decorative background geometry — it is NOT the hero instrument.
 *
 * ZERO DATA EDGE (SPEC §2.1): no `fetch`, no `EventSource`, no durable store, no `@convexa/api`
 * import, no `features/trading` import — enforced by the ESLint deny-list (`eslint.config.mjs`) AND
 * `landing.spec.tsx`'s strict-fetch harness (throws on any non-auth call). `/` reads no session fact
 * at all, so there is no `ready` branch and no first-paint swap (AC-L17). The one intentional
 * non-data edge is `scheduleLandingPrefetch()` — it warms route chunks and touches no API.
 *
 * NO `<main>` and NO `<Footer/>` here (AC-F4): `AppShell.tsx:97` owns the app's one `<main>`
 * landmark, and `AppShell.tsx:116` mounts the footer once for every in-shell page (F3) — mounting
 * either here would nest a second landmark / render a second footer, which is the exact defect this
 * rewrite fixes (`Landing.tsx:61` used to nest a second `<main>` inside `AppShell`'s).
 *
 * Retired with this rewrite (SPEC §1 "Out of scope"): the "desk right now" strip (a live claim with
 * no stream), the `ValueCard` "What works today" grid, the brokerage-connect waitlist block/toast,
 * and the primary action's old destination (`/scanner`, which sat behind a sign-in wall — AC-L6 now
 * requires the primary action to work signed OUT).
 *
 * `[theme-token-discipline]`: every colour is a palette slot / `extrasFor(theme)` value resolved in
 * `sx`; zero hardcoded hex. `[no-real-order-path]`: no affordance in this file opens an entry flow —
 * the two "Sign in" style actions either route to `/ticker` or open the shared `AuthDialog`.
 */
import { useAuthDialog } from '@/features/auth/AuthDialogProvider';
import { isDemoBuild } from '@/shared/lib/demoSite';
import { prefetchTickerRoute, scheduleLandingPrefetch } from '@/shared/lib/prefetchRoutes';
import { displayScale, extrasFor } from '@/shared/theme/tokens';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AiReadSample } from './AiReadSample';
import { LANDING_COPY } from './copy';
import { GammaSurfaceHero } from './GammaSurfaceHero';
import { HeroCurve } from './HeroCurve';
import { ScoreStripSample } from './ScoreStripSample';
import { StructureFieldSample } from './StructureFieldSample';

/** A caps eyebrow label. Text-grade amber, never fill (canon Amber budget, SPEC §4 Design
 *  direction) — the `sx` callback stays INLINE here so `extrasFor(theme)`'s `theme` parameter is
 *  contextually typed by MUI's `SxProps<Theme>`, matching every other file in this folder. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'block',
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: (theme) => extrasFor(theme).textAmber,
      }}
    >
      {children}
    </Box>
  );
}

/** Shared H2 treatment for the four feature-shaped sections + the CTA band. No theme-dependent
 *  colour here (inherits `text.primary`), so a plain object is safe to hoist. */
const sectionHeadingSx = {
  m: 0,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  fontSize: 'clamp(26px, 2.6vw, 34px)',
  lineHeight: 1.15,
} as const;

interface FeatureSectionProps {
  section: 'field' | 'score' | 'ai-read';
  eyebrow: string;
  heading: string;
  body: string;
  bullets: readonly string[];
  visual: ReactNode;
  /** Visual column leads on wide screens (CSS `order` only — DOM/reading order never changes,
   *  so the heading walk stays h1 → h2 → … regardless of which section flips). */
  flip?: boolean;
}

/** One of the three "eyebrow / H2 / body / 3 bullets / a labelled sample" sections (field, score,
 *  ai-read — SPEC §4). Each bullet carries the shipped check glyph, imported from
 *  `@mui/icons-material` (never hand-authored SVG geometry — SPEC §2.6's icon rule; precedent
 *  `AiReadSample.tsx`'s `AutoAwesomeIcon`), so the one-hero-instrument `viewBox` scan (§7 item 2)
 *  stays decidable: no icon here paints its `viewBox` into this folder's own source text. */
function FeatureSection({
  section,
  eyebrow,
  heading,
  body,
  bullets,
  visual,
  flip = false,
}: FeatureSectionProps) {
  return (
    <Box
      component="section"
      data-testid="landing-section"
      data-section={section}
      // no-vendor-production-posture (F2): a stable scroll target for the ticker desk's paused-panel
      // "See an illustrative sample" link (`TickerDashboard.tsx`) — an ID only, never a copy change.
      id={`landing-sample-${section}`}
      tabIndex={-1}
      sx={{ py: { xs: 7, md: 10 }, outline: 'none' }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            // GATE Z amendment 7 — the design's two-column switch is 1100, not the MUI `lg`
            // breakpoint (1200). `laptop` (1100) is an ADDITIVE breakpoint theme.ts already
            // declares (SPEC §2.2 ruling 4 territory), so this binds to it rather than inventing
            // a second numeric literal for the same threshold.
            gridTemplateColumns: { xs: '1fr', laptop: '1fr 1.15fr' },
            gap: { xs: 4, laptop: 7 },
            alignItems: 'center',
          }}
        >
          <Stack spacing={1.75} sx={{ maxWidth: 480, minWidth: 0 }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Typography component="h2" variant="h2" sx={sectionHeadingSx}>
              {heading}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {body}
            </Typography>
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {bullets.map((bullet) => (
                <Stack
                  component="li"
                  direction="row"
                  spacing={1.25}
                  key={bullet}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <CheckIcon
                    sx={{
                      fontSize: 15,
                      mt: '3px',
                      flexShrink: 0,
                      color: (theme) => extrasFor(theme).textAmber,
                    }}
                  />
                  <Typography variant="body2">{bullet}</Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
          {/* `order` moves with the SAME 1100 threshold as the grid above — a "flip" section's
              visual column only makes sense to lead once the grid has actually gone two-column;
              a mismatched breakpoint here would flip the reading order a beat early/late. */}
          <Box sx={{ minWidth: 0, order: { xs: 0, laptop: flip ? -1 : 0 } }}>{visual}</Box>
        </Box>
      </Container>
    </Box>
  );
}

export function Landing() {
  const { openAuth } = useAuthDialog();
  const demo = isDemoBuild();
  const signInRef = useRef<HTMLButtonElement>(null);

  // The one intentional non-data edge (SPEC §2.1): warms route chunks after first paint, touches
  // no API. `/` otherwise reads no session fact and issues zero requests (AC-L17).
  useEffect(() => scheduleLandingPrefetch(), []);

  // no-vendor-production-posture (F2): a fresh `/#landing-sample-field` load (from the ticker desk's
  // paused panel) races the browser's own scroll-to-fragment step against this lazy route's render,
  // same as `MethodologyPage.tsx`'s identical effect — run the equivalent once after mount.
  useEffect(() => {
    if (!window.location.hash) return;
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target) return;
    // Optional-called: jsdom does not implement `scrollIntoView` (`FaultedBanner.tsx` precedent) —
    // an uncaught TypeError there would fail any test that mounts this page with a hash present.
    target.scrollIntoView?.({ block: 'start' });
    target.focus();
  }, []);

  return (
    <Box data-testid="landing" sx={{ bgcolor: 'background.default', color: 'text.primary' }}>
      {/* ===== 1. Hero — the one hero instrument (AC-L4/AC-L4a) ===== */}
      <Box
        component="section"
        data-testid="landing-section"
        data-section="hero"
        sx={{ position: 'relative', overflow: 'hidden' }}
      >
        <HeroCurve />
        <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 7, md: 10 } }}>
          <Box
            sx={{
              display: 'grid',
              // GATE Z amendment 7 — two-column at 1100 (`laptop`), not MUI's `lg` (1200).
              gridTemplateColumns: { xs: '1fr', laptop: '1.05fr 1fr' },
              gap: { xs: 5, laptop: 6 },
              alignItems: 'center',
            }}
          >
            <Stack spacing={2.5} sx={{ alignItems: 'flex-start', maxWidth: 600, minWidth: 0 }}>
              <Chip
                label={LANDING_COPY.hero.chip}
                size="small"
                sx={{
                  alignSelf: 'flex-start',
                  height: 'auto',
                  minHeight: 26,
                  // Fill-grade amber stays the TINT (`primary.main`, ≥3:1 UI class); the label
                  // ITSELF is small (<18px) amber text, so it takes the TEXT-GRADE amber
                  // (`extrasFor(theme).textAmber`, ≥4.5:1) — the same split `Eyebrow` above
                  // already uses. `primary.main` alone measured 2.68:1 on `paper` in light mode
                  // (color-contrast, serious) — the two-amber-grades rule this file already
                  // follows for every eyebrow, just not yet for this chip.
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  color: (theme) => extrasFor(theme).textAmber,
                  fontWeight: 600,
                  borderRadius: 999,
                  '& .MuiChip-label': { whiteSpace: 'normal', px: 1.5, py: 0.5, lineHeight: 1.3 },
                }}
              />
              <Typography
                component="h1"
                variant="h1"
                sx={{
                  m: 0,
                  fontSize: `clamp(${displayScale.minPx}px, 38px + 1.5vw, ${displayScale.maxPx}px)`,
                  fontWeight: displayScale.fontWeight,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.08,
                }}
              >
                {LANDING_COPY.hero.h1}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 560 }}>
                {LANDING_COPY.hero.sub}
              </Typography>
              <Typography
                variant="caption"
                data-testid="product-spine"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {LANDING_COPY.hero.spine}
              </Typography>
              <Stack
                spacing={1.5}
                useFlexGap
                // GATE Z amendment 7 (design conformance, QA m-3): the design draws the two hero
                // CTAs FULL-WIDTH and stacked at <=699px, row from 700 — a threshold neither MUI
                // named breakpoint (`sm`=600) nor any other already-declared one carries, so this
                // stays a literal function-form media query rather than adding a shared theme
                // breakpoint for a single caller. `width: '100%'` on this Stack (itself un-sized
                // by its `alignItems: 'flex-start'` parent, `:195` above) plus the Stack's own
                // default `align-items: stretch` in column mode is what makes the BUTTONS
                // themselves full-width — no per-button `sx` needed.
                //
                // QA re-check R-1 (2026-09-23): without `useFlexGap`, `spacing` renders as a
                // per-child margin keyed to the `direction` PROP, which stayed 'column' by default
                // while this `sx` flipped only the visual `flexDirection` at 700 — the stale
                // `margin-top: 12px` on the second child then read as CROSS-AXIS margin in row
                // mode (0px gap, secondary pushed 12px lower, and `align-items: stretch`'s line-box
                // grew to fit that margin, stretching the primary button to 54px). `useFlexGap`
                // renders `spacing` as a flex `gap`, which tracks whichever `flexDirection` is
                // active — matching the design's `.hero-ctas` rule (flex, a 12px gap, centred
                // cross-axis alignment) in both row and column mode, with no per-child margin to
                // distort the line box.
                sx={(theme) => ({
                  mt: 1,
                  width: '100%',
                  flexDirection: 'column',
                  [theme.breakpoints.up(700)]: {
                    width: 'auto',
                    flexDirection: 'row',
                    alignItems: 'center',
                  },
                })}
              >
                <Button
                  component={RouterLink}
                  to="/ticker"
                  variant="contained"
                  size="large"
                  data-testid="cta-primary"
                  // AC-L15: this and `cta-band-primary` share ONE accessible name. The visible
                  // label keeps its pinned arrow (AC-C1); the name drops it.
                  aria-label={LANDING_COPY.openTickerName}
                  onMouseEnter={() => void prefetchTickerRoute()}
                  onFocus={() => void prefetchTickerRoute()}
                >
                  {LANDING_COPY.hero.primary}
                </Button>
                <Button
                  component={RouterLink}
                  to="/methodology"
                  variant="outlined"
                  size="large"
                  data-testid="cta-secondary"
                  // GATE Z amendment 7 (design conformance): the design's `.btn.secondary` label
                  // is `var(--phosphor)` — the app's own body-text colour (`text.primary`), NOT
                  // amber (F7c's earlier fix bound this to the text-grade amber, which cleared
                  // AC-G1 but drew the wrong colour — QA's visual review: "labelled amber; the
                  // design's secondary is phosphor"). `text.primary` clears 4.5:1 in both schemes
                  // by construction (it is the body-text colour), so AC-G1 stays satisfied without
                  // the amber override the outlined-button default would otherwise need.
                  //
                  // QA re-check m-R3 (2026-09-23): the BORDER stayed MUI's outlined default
                  // (`alpha(primary.main, 0.5)` — measured 1.69:1 on the light background), where
                  // the design's `.btn.secondary` draws `border-color: var(--line-2)`
                  // (`extrasFor(theme).lineStrong`, the v2 `line2` strong-divider/control-border
                  // token). Amber on a secondary outline also spends the accent grade the canon's
                  // "Two amber grades" rule (DESIGN_SYSTEM.md) reserves for the primary fill,
                  // text-grade copy and the focus ring — the `:focus-visible` amber ring
                  // (`theme.ts`'s `MuiButtonBase-root:focus-visible` outline) is a separate box-
                  // model layer from `border-color` and still renders unchanged.
                  sx={{
                    color: 'text.primary',
                    borderColor: (theme) => extrasFor(theme).lineStrong,
                  }}
                >
                  {LANDING_COPY.hero.secondary}
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {LANDING_COPY.hero.footnote}
              </Typography>
            </Stack>

            {/* The F1 dealer-gamma surface: WebGL2 with its static projection as the fallback (P-15). */}
            <GammaSurfaceHero demo={demo} />
          </Box>
        </Container>
      </Box>

      {/* ===== 2. Structure field ===== */}
      <FeatureSection
        section="field"
        eyebrow={LANDING_COPY.field.eyebrow}
        heading={LANDING_COPY.field.h2}
        body={LANDING_COPY.field.body}
        bullets={LANDING_COPY.field.bullets}
        visual={<StructureFieldSample demo={demo} />}
      />

      {/* ===== 3. Triage score ===== */}
      <FeatureSection
        section="score"
        eyebrow={LANDING_COPY.score.eyebrow}
        heading={LANDING_COPY.score.h2}
        body={LANDING_COPY.score.body}
        bullets={LANDING_COPY.score.bullets}
        visual={<ScoreStripSample demo={demo} />}
        flip
      />

      {/* ===== 4. AI read ===== */}
      <FeatureSection
        section="ai-read"
        eyebrow={LANDING_COPY.aiRead.eyebrow}
        heading={LANDING_COPY.aiRead.h2}
        body={LANDING_COPY.aiRead.body}
        bullets={LANDING_COPY.aiRead.bullets}
        visual={<AiReadSample demo={demo} />}
      />

      {/* ===== 5. "Numbers say where they came from" — the three trust promises live INSIDE
                  this section, not as a section of their own (AC-L1). ===== */}
      <Box
        component="section"
        data-testid="landing-section"
        data-section="register"
        sx={{ py: { xs: 7, md: 10 } }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              // GATE Z amendment 7 — two-column at 1100 (`laptop`), not MUI's `lg` (1200).
              gridTemplateColumns: { xs: '1fr', laptop: '1fr 2fr' },
              gap: { xs: 4, laptop: 6 },
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Eyebrow>{LANDING_COPY.register.eyebrow}</Eyebrow>
              <Typography component="h2" variant="h2" sx={{ ...sectionHeadingSx, mt: 1.5 }}>
                {LANDING_COPY.register.h2}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5 }}>
                {LANDING_COPY.register.body}
              </Typography>
              {/* AC-L9 — one click from the landing to methodology, not via the footer. */}
              <Button
                component={RouterLink}
                to="/methodology"
                variant="text"
                data-testid="cta-methodology"
                // A11Y-2 (color-contrast, serious): same fix as `cta-secondary` below — a `text`
                // variant button also labels itself with `primary.main` by default (3.01:1 on
                // `background.default` in light mode, measured). Text-grade amber clears 4.5:1.
                sx={{ mt: 2, px: 0, minWidth: 0, color: (theme) => extrasFor(theme).textAmber }}
              >
                {LANDING_COPY.register.action}
              </Button>
            </Box>
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 2,
                // GATE Z amendment 7 — the design's trust-card row goes three-up from 700, not
                // MUI's `sm` (600); 700 has no named breakpoint elsewhere in this theme, so this
                // stays a literal function-form media query (the same idiom the hero CTA stack
                // above uses for the same numeral).
                [theme.breakpoints.up(700)]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
              })}
            >
              {LANDING_COPY.register.trustCards.map((card) => (
                <Box
                  key={card.title}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Typography component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {card.body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ===== 6. CTA band — the closure sentence sits directly under the secondary action,
                  before any form exists (AC-L16/AC-A4). ===== */}
      <Box
        component="section"
        data-testid="landing-section"
        data-section="cta"
        sx={{ py: { xs: 7, md: 10 } }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: { xs: 3, md: 5 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
              gap: { xs: 3, md: 5 },
              alignItems: 'center',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h2"
                variant="h2"
                sx={{ ...sectionHeadingSx, fontSize: 'clamp(24px, 2.4vw, 32px)' }}
              >
                {demo ? LANDING_COPY.ctaDemo.heading : LANDING_COPY.cta.heading}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5, maxWidth: 560 }}>
                {demo ? LANDING_COPY.ctaDemo.body : LANDING_COPY.cta.body}
              </Typography>
            </Box>
            <Stack spacing={1.25} sx={{ alignItems: 'stretch' }}>
              <Button
                component={RouterLink}
                to="/ticker"
                variant="contained"
                size="large"
                data-testid="cta-band-primary"
                aria-label={LANDING_COPY.openTickerName}
              >
                {LANDING_COPY.cta.primary}
              </Button>
              <Button
                variant="outlined"
                size="large"
                ref={signInRef}
                // Demo: no sign-in exists, so the button opens the demo account's book instead.
                {...(demo
                  ? { component: RouterLink, to: '/positions' }
                  : { onClick: () => openAuth({ returnFocus: signInRef.current }) })}
                data-testid="cta-band-secondary"
                // A11Y-2 (color-contrast, serious): this band sits on `background.paper` (white
                // in light mode), so the default `primary.main` label measured 3.27:1 — still
                // under 4.5:1. Same text-grade-amber fix as the hero's `cta-secondary`.
                sx={{ color: (theme) => extrasFor(theme).textAmber }}
              >
                {demo ? LANDING_COPY.ctaDemo.secondary : LANDING_COPY.cta.secondary}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                {demo ? LANDING_COPY.ctaDemo.note : LANDING_COPY.cta.signupsClosed}
              </Typography>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

export default Landing;
