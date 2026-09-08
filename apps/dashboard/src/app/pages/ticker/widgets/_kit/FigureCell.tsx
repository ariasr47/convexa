/**
 * `FigureCell` — the v2 figure primitive (SPEC §2.3/§4.1) that REPLACES `StatTile` at all 16
 * render sites, in one change, no deprecation window, no coexistence. Deletes the coloured
 * accent-bar anatomy entirely — `accent`/`accentColor` do not exist on this component, which is
 * what makes canon rule 13 structural rather than discouraged.
 *
 * State lives in two places, never merged:
 *   - the LABEL ROW (caps label · ⓘ · a live dot ONLY when this figure's own value came from the
 *     delivering stream — never the widget-scoped `live`/`numbersActive`);
 *   - the TYPE REGISTER of the value glyphs themselves (Mono = Convexa's figure / Sans with a
 *     dotted rule = asserted-but-untraced) and, independently, the closed `NotANumber` vocabulary
 *     (always Sans, never a figure, never a unit).
 *
 * WHERE THE DECISION LIVES NOW (curvature-v2-surfaces SPEC §2.1, FE-1). The whole F1–F9 branch,
 * both marks and the face binding MOVED to `shared/figure/` — `figureState.ts` (pure),
 * `FigureMarks.tsx` (`LiveDot`/`PauseMark`, now named exports) and `figureFace.ts`. This file is
 * one CALLER of that module, not its home: `ScanCard` is a single anchor and `ScanTable`'s column
 * header already IS the label row, so neither can host this card — but both must render the same
 * nine states. A MOVE, not a copy: two copies of this branch would drift, and the phase would
 * create the inconsistency it exists to close. What stays here is the chrome and the SIZE ladder
 * (20/17/15 and the fixed literal size) — register and state travel, size does not.
 *
 * Nine states (F1–F9, SPEC §4.1): F1 default · F2 loading (`StatSkeleton`, a separate export whose
 * NAME is carried forward byte-for-byte, preserving the `cold-skeleton` testid ~18 specs key on)
 * · F3 live · F4 offline-retained · F5
 * offline-bare · F6 replay · F7 empty/not-applicable · F8 unavailable · F9 untraced (no phase-1
 * call site emits F9 — AC-15b; the prop exists so phases 2–4 compose). F4/F5/F7/F8 carry distinct
 * `data-figure-state` DOM markers (AC-17b/AC-50b) so they are exclusive in the DOM, not only to
 * the eye.
 *
 * `register` is REQUIRED, NO DEFAULT (SPEC §2.3) — Mono cannot be the fallback a careless caller
 * gets. It stays required when `value` is a `NotANumber` member but has NO EFFECT on that render:
 * the literal branch is always Sans (AC-19) whatever `register` says.
 *
 * The ⓘ reuses the SHIPPED `shared/ui` `AccessibleHelp` pattern verbatim (SPEC §4.1: "do not invent a
 * second focusable-help pattern") — a real focusable `button` with an accessible name of the form
 * `About {label}`, opening on tap/Enter/Space, closing on Escape (Tooltip `describeChild`).
 *
 * Container steps (20 → 17 → 15px under 360/280px of NAMED panel width) land in FE-6, once the
 * `type-floor.spec.tsx` reader is hardened first (SPEC §2.5) — this file ships the 20px base only;
 * do not add `@container` rules here ahead of that sequencing.
 *
 * The live dot is DECORATIVE + static (no pulse): `[single-motion-moment]` pins `liveDotPulse`'s
 * sole declaration to `TickerHeader.tsx` (AC-54 — zero new keyframes this phase), and nothing in
 * SPEC §4.1 requires the PER-FIGURE dot (as opposed to the page-scope connection chip's dot) to
 * animate. Reusing the chip's keyframe by name here would be a fragile, undeclared cross-component
 * runtime dependency for no acceptance-criterion benefit, so the dot stays a plain static mark.
 */
import type { NotANumber } from '@/shared/copy/notANumber';
import {
  faceFor,
  figureStateOf,
  LiveDot,
  MONO_FACE,
  PauseMark,
  UNTRACED_RULE,
} from '@/shared/figure';
import { flashColorSx, type FlashState } from '@/shared/hooks/useFlashOnChange';
import type { LiveClaim } from '@/shared/liveness/liveClaim';
import { AccessibleHelp } from '@/shared/ui';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled, type Theme } from '@mui/material/styles';

// The card chrome: paper surface, divider border, radius-clipped. NO accent bar of any kind — the
// `&::before` colour edge from `StatTile` is gone, not merely unused (AC-13a).
const CellCard = styled(Card, {
  shouldForwardProp: (p) => p !== 'dim',
})<{ dim?: boolean }>(({ theme, dim }) => ({
  position: 'relative',
  height: '100%',
  overflow: 'hidden',
  // PANEL role (SPEC §2.2, ruling 4), theme-derived. Plain `styled()` callback (not `sx`), so a
  // raw theme number here is literal px, not routed through `createUnaryUnit`.
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  backgroundImage:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 46%)'
      : 'none',
  borderColor: theme.palette.divider,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)'
      : '0 1px 2px rgba(16,24,40,0.08)',
  ...(dim ? { opacity: 0.5 } : {}),
  transition:
    'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease, opacity 200ms ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 8px 20px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)'
        : '0 8px 20px -8px rgba(16,24,40,0.25)',
    borderColor: theme.palette.text.disabled,
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'opacity 200ms ease',
    '&:hover': { transform: 'none' },
  },
}));

/** The label-row caps label — v2 Type table: "figure labels, eyebrows — the floor" (11px, not
 *  MUI's 12px `caption` variant). */
function CapsLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1.3,
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

export interface FigureCellProps {
  label: string;
  /**
   * REQUIRED, NO DEFAULT (SPEC §2.3). Mono cannot be the fallback a careless caller gets. Stays
   * required-and-IGNORED when `value` is a `NotANumber` member — the literal branch is always Sans
   * (AC-19) whatever `register` says, and this component neither validates it there nor reports
   * the mismatch.
   */
  register: 'traced' | 'asserted';
  value: string | NotANumber;
  /** Label-row dot ONLY. Derived from the value's OWN expression at the call site — never from a
   *  widget-scoped `live`/`numbersActive` flag. Branded (FE-1, SPEC §2.1 invariant 1): only
   *  `isDeliveringLive(...)`/`andPresent(...)`/`NOT_LIVE` can produce this value. */
  live?: LiveClaim;
  /** `retained: true` is the ONLY thing that licenses the `· last known` clause (ruling 2) — it is
   *  data-driven, never a fixed caption. `null`/`undefined` → not offline at all. */
  offline?: { retained: boolean } | null;
  /** F6 — session replay: Mono full strength, no dot, no pause mark, no offline caption. */
  replay?: boolean;
  /** ⓘ copy, opened via the shipped `AccessibleHelp` pattern. */
  info?: string;
  /** The cell's own basis line (F1/F3/F7/F8). Ignored when `offline` or `replay` is set — those
   *  compute their own caption. */
  caption?: string | null;
  /** Names the asserter for F9 (`register === 'asserted'` on a non-literal value). */
  assertedBy?: string;
  flash?: FlashState | null;
}

function ValueGlyph({
  value,
  mono,
  dim,
  flash,
  untraced,
  isFigure,
}: {
  value: string;
  mono: boolean;
  dim?: boolean;
  flash?: FlashState | null;
  untraced?: boolean;
  /**
   * SPEC §4.1 container steps: a REAL figure (traced Mono or untraced-but-asserted Sans, F1/F3/F4/
   * F6/F9) steps 20 → 17 → 15px against the NAMED `panel` container under 360/280px. A closed-
   * vocabulary LITERAL (F5/F7/F8) is fixed at the 15px "literal size" and does NOT step further —
   * "it is not a figure" (SPEC §4.1). Queries the NAMED container ONLY (`theme.containerQueries
   * ('panel')`) — never an unnamed container (SPEC §2.5).
   */
  isFigure: boolean;
}) {
  return (
    <Typography
      component="span"
      data-figure-register={mono ? 'mono' : 'sans'}
      sx={[
        (theme: Theme) =>
          isFigure
            ? {
                fontSize: 20,
                [theme.containerQueries('panel').down(360)]: { fontSize: 17 },
                [theme.containerQueries('panel').down(280)]: { fontSize: 15 },
              }
            : { fontSize: 15 },
        {
          fontWeight: 500,
          lineHeight: 1.15,
          // The face comes from `shared/figure/figureFace.ts` — the one binding outside
          // `shared/theme/tokens.ts` (criterion N-1). The SIZE above does not travel with it.
          ...faceFor(mono),
          color: 'text.primary',
          ...(dim ? { opacity: 0.5 } : {}),
          ...(untraced ? UNTRACED_RULE : {}),
        },
        flashColorSx(flash ?? null),
      ]}
    >
      {value}
    </Typography>
  );
}

export function FigureCell({
  label,
  register,
  value,
  live,
  offline,
  replay,
  info,
  caption,
  assertedBy,
  flash,
}: FigureCellProps) {
  // THE ONE DECISION, made once, in `shared/figure/figureState.ts` (SPEC §2.1). This component
  // holds no F1–F9 branch of its own any more — it renders that decision inside its card.
  const {
    figureState,
    mono,
    isFigure,
    dim,
    untraced,
    showDot,
    showPause,
    caption: effectiveCaption,
  } = figureStateOf({ value, register, live, offline, replay, caption, assertedBy });

  // The flash rides only the arms that shipped it — F4-retained and F1/F3. A literal, a replayed
  // value, an untraced figure and the bare offline arm never pulse (unchanged behaviour).
  const activeFlash =
    figureState === 'offline-retained' || figureState === 'default' || figureState === 'live'
      ? (flash ?? null)
      : null;

  const glyph = (
    <ValueGlyph
      value={value}
      mono={mono}
      isFigure={isFigure}
      dim={dim}
      untraced={untraced}
      flash={activeFlash}
    />
  );

  const body = showPause ? (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'baseline' }}>
      <PauseMark />
      {glyph}
    </Stack>
  ) : (
    glyph
  );

  return (
    <CellCard dim={false} variant="outlined" data-figure-state={figureState}>
      <CardContent sx={{ pl: 2.25 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <CapsLabel>{label}</CapsLabel>
          {info && <AccessibleHelp label={`About ${label}`} text={info} />}
          {showDot && <LiveDot />}
        </Stack>
        {body}
        {effectiveCaption ? (
          <Typography
            component="p"
            data-testid="stat-secondary"
            sx={{
              ...MONO_FACE,
              color: 'text.secondary',
              fontSize: 11,
              mt: 0.25,
              mb: 0,
              lineHeight: 1.3,
            }}
          >
            {effectiveCaption}
          </Typography>
        ) : null}
      </CardContent>
    </CellCard>
  );
}

/**
 * `StatSkeleton` — the COLD-LOAD placeholder (F2). NAME CARRIED FORWARD BYTE-FOR-BYTE from the
 * deleted `StatTile.tsx` (PLAN FE-4 Step 3: "the `StatSkeleton` export"), including
 * `data-testid="cold-skeleton"` (~18 spec files key on it) — this is what keeps
 * `TickerDashboard.tsx`'s `import { StatSkeleton } from './widgets/_kit'` byte-unchanged even
 * though the component now lives in `FigureCell.tsx`. Never appears post-load (AC-46).
 */
export function StatSkeleton() {
  return (
    <CellCard
      dim={false}
      variant="outlined"
      data-testid="cold-skeleton"
      data-figure-state="loading"
    >
      <CardContent sx={{ pl: 2.25 }}>
        <Skeleton variant="text" width="60%" sx={{ fontSize: '0.75rem' }} />
        <Skeleton variant="text" width="45%" sx={{ fontSize: '1.25rem' }} />
      </CardContent>
    </CellCard>
  );
}

export default FigureCell;
