/**
 * Convexa landing (`/`, the shell's index route in `app.tsx`).
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
 * NO `<main>` and NO `<Footer/>` here (AC-F4): `AppShell` owns the app's one `<main>`
 * landmark and mounts the footer once for every in-shell page (F3) — mounting
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
import { isDemoBuild, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { prefetchTickerRoute, scheduleLandingPrefetch } from '@/shared/lib/prefetchRoutes';
import { displayScale, extrasFor } from '@/shared/theme/tokens';
import { pageColumnSx } from '@/shared/ui/PageColumn';
import CheckIcon from '@mui/icons-material/Check';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, type ReactNode } from 'react';
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

/** Shared H2 treatment for the four feature-shaped sections + the CTA band, as the boards set it
 *  (`.display` tracking -0.01em, `.ss-feat h2` line height 1.12 and balanced lines; fidelity
 *  SITE-05). No theme-dependent colour here (inherits `text.primary`), so a plain object is safe
 *  to hoist. */
const sectionHeadingSx = {
  m: 0,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  fontSize: 'clamp(26px, 2.6vw, 34px)',
  lineHeight: 1.12,
  textWrap: 'balance',
} as const;

/** A landing row on the page column, as the boards draw `.ss-feat` / `.ss-trust`: a hairline rule
 *  across the column (not the viewport) and 64px above and below the content (fidelity SITE-05). */
const rowSx = {
  borderTop: 1,
  borderColor: 'divider',
  py: { xs: 7, md: 8 },
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
      sx={{ outline: 'none' }}
    >
      <Box sx={pageColumnSx}>
        <Box
          sx={{
            ...rowSx,
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
          {/* The copy fills its track, as on the board (fidelity SITE-05): no cap of its own, the
              board's `.ss-feat` rhythm (eyebrow, 8, H2, 14, body at 52ch, 16, bullets 14/1.5). */}
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Typography component="h2" variant="h2" sx={{ ...sectionHeadingSx, mt: 1 }}>
              {heading}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mt: 1.75,
                fontSize: 15.5,
                lineHeight: 1.6,
                maxWidth: '52ch',
                color: 'text.secondary',
                textWrap: 'pretty',
              }}
            >
              {body}
            </Typography>
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, mt: 2 }}>
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
                  <Typography variant="body2" sx={{ fontSize: 14, lineHeight: 1.5 }}>
                    {bullet}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
          {/* `order` moves with the SAME 1100 threshold as the grid above — a "flip" section's
              visual column only makes sense to lead once the grid has actually gone two-column;
              a mismatched breakpoint here would flip the reading order a beat early/late. */}
          <Box sx={{ minWidth: 0, order: { xs: 0, laptop: flip ? -1 : 0 } }}>{visual}</Box>
        </Box>
      </Box>
    </Box>
  );
}

export function Landing() {
  const demo = isDemoBuild();

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
        {/* The curve's box, so its long shallow run passes UNDER the copy and the footnote, as
            `HeroCurve` intends, at any hero height. `HeroCurve` stretches its drawing over this box
            and puts the baseline at 90% of its height (360 of 400 units), the run just above it, so
            the box is (hero − 28px) / 0.9 tall: the baseline lands 28px above the hero's foot, in
            the middle of its 56px bottom padding, and the section clips the empty strip below.
            Stretched over the hero itself, the run struck through the production footnote's last
            lines at 1280 and 1440 (landing legibility, fidelity gate 2026-10-25). Below `laptop`
            the curve is not drawn. */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 'calc((100% - 28px) / 0.9)',
            pointerEvents: 'none',
          }}
        >
          <HeroCurve />
        </Box>
        {/* The board's `.ss-hero` padding: 72px over and 56px under (40 and 32 on a phone). */}
        <Box
          sx={{ ...pageColumnSx, position: 'relative', pt: { xs: 5, md: 9 }, pb: { xs: 4, md: 7 } }}
        >
          <Box
            sx={{
              display: 'grid',
              // GATE Z amendment 7 — two-column at 1100 (`laptop`), not MUI's `lg` (1200).
              gridTemplateColumns: { xs: '1fr', laptop: '1.05fr 1fr' },
              // Three items: the copy, the panel and the footnote (spec 01, Behaviour › Landing).
              // One column below 1100, in DOM order, 40px apart, so a phone reaches the panel
              // before the footnote. From 1100 the copy and the footnote stack in column 1, 20px
              // apart (the copy Stack's own spacing, as when the footnote sat inside it), and the
              // panel spans both rows of column 2, centred. Column 1 is then the old Stack's
              // height, so the panel and the copy line up as they did.
              gridTemplateRows: { laptop: 'auto auto' },
              rowGap: { xs: 5, laptop: 2.5 },
              columnGap: { xs: 5, laptop: 6 },
              alignItems: 'center',
              // The panel's root is GammaSurfaceHero's figure; it is placed here, beside the
              // other two items' placement, so the grid's layout reads in one place.
              '& > [data-testid="landing-hero-panel"]': {
                gridColumn: { laptop: '2' },
                gridRow: { laptop: '1 / span 2' },
                alignSelf: { laptop: 'center' },
              },
            }}
          >
            <Stack
              spacing={2.5}
              sx={{
                alignItems: 'flex-start',
                maxWidth: 600,
                minWidth: 0,
                gridColumn: { laptop: '1' },
                gridRow: { laptop: '1' },
                alignSelf: { laptop: 'end' },
              }}
            >
              <Chip
                label={demo ? LANDING_COPY.hero.chipDemo : LANDING_COPY.hero.chip}
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
                  // The board's `.ss-chip` type, 12.5px/600 (fidelity REV-L2-FND07-1): the theme's
                  // small chip is the library's 11px status chip, which this hero label is not.
                  fontSize: 12.5,
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
                {demo ? (
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
                ) : (
                  // Production's front door (owner, 2026-10-16): most of the desk needs a paid
                  // options feed this site doesn't have, so the first click is the full demo.
                  <Button
                    href={STAGING_DEMO_URL}
                    variant="contained"
                    size="large"
                    data-testid="cta-primary"
                    aria-label={LANDING_COPY.openDemoName}
                  >
                    {LANDING_COPY.hero.primaryLive}
                  </Button>
                )}
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
            </Stack>

            {/* The F1 dealer-gamma surface: WebGL2 with its static projection as the fallback (P-15). */}
            <GammaSurfaceHero demo={demo} />

            {/* Shrink-to-fit up to 600px, as it was inside the copy Stack. */}
            <Typography
              variant="caption"
              data-testid="hero-footnote"
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                justifySelf: 'start',
                gridColumn: { laptop: '1' },
                gridRow: { laptop: '2' },
                alignSelf: { laptop: 'start' },
              }}
            >
              {demo ? LANDING_COPY.hero.footnote : LANDING_COPY.hero.footnoteLive}
            </Typography>
          </Box>
        </Box>
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
        heading={demo ? LANDING_COPY.aiRead.h2Demo : LANDING_COPY.aiRead.h2}
        body={LANDING_COPY.aiRead.body}
        bullets={LANDING_COPY.aiRead.bullets}
        visual={<AiReadSample demo={demo} />}
      />

      {/* ===== 5. "Numbers say where they came from" — the three trust promises live INSIDE
                  this section, not as a section of their own (AC-L1). ===== */}
      <Box component="section" data-testid="landing-section" data-section="register">
        <Box sx={pageColumnSx}>
          <Box
            sx={{
              ...rowSx,
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
                    {demo && 'bodyDemo' in card ? card.bodyDemo : card.body}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ===== 6. CTA band — the closure sentence sits directly under the secondary action,
                  before any form exists (AC-L16/AC-A4). ===== */}
      <Box
        component="section"
        data-testid="landing-section"
        data-section="cta"
        // The board's band sits 24px under the last row and 8px over the footer (`.ss-cta` margin).
        sx={{ pt: 3, pb: 1 }}
      >
        <Box sx={pageColumnSx}>
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
                sx={{ ...sectionHeadingSx, fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.15 }}
              >
                {demo ? LANDING_COPY.ctaDemo.heading : LANDING_COPY.cta.heading}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1.5, maxWidth: 560 }}>
                {demo ? LANDING_COPY.ctaDemo.body : LANDING_COPY.cta.body}
              </Typography>
            </Box>
            <Stack spacing={1.25} sx={{ alignItems: 'stretch' }}>
              {demo ? (
                <Button
                  component={RouterLink}
                  to="/ticker"
                  variant="contained"
                  size="large"
                  data-testid="cta-band-primary"
                  aria-label={LANDING_COPY.openTickerName}
                >
                  {LANDING_COPY.hero.primary}
                </Button>
              ) : (
                <Button
                  href={STAGING_DEMO_URL}
                  variant="contained"
                  size="large"
                  data-testid="cta-band-primary"
                  aria-label={LANDING_COPY.openDemoName}
                >
                  {LANDING_COPY.cta.primary}
                </Button>
              )}
              <Button
                component={RouterLink}
                // Demo: the demo account's book. Production: the free live Ticker (sign-ups are
                // closed, so the band offers no sign-in; “Log in” stays in the nav).
                to={demo ? '/positions' : '/ticker'}
                variant="outlined"
                size="large"
                data-testid="cta-band-secondary"
                // Neutral outlined secondary from the theme (owner ruling A, 2026-10-15): the
                // band's amber is spent on the contained primary above.
              >
                {demo ? LANDING_COPY.ctaDemo.secondary : LANDING_COPY.cta.secondary}
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                {demo ? LANDING_COPY.ctaDemo.note : LANDING_COPY.cta.note}
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Landing;
