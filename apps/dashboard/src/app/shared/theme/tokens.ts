/**
 * Design tokens — the SINGLE SOURCE shared by the running app (`theme.ts`) and the Figma design system
 * (file "Convexa — Web App (Design Reference)", collections Primitives/Color/Spacing/Radius/Typography).
 *
 * GENERATED / KEPT-IN-SYNC: regenerate with `node scripts/sync-figma-tokens.mjs` (see that file).
 * Values here mirror the Figma variables 1:1. `theme.ts` consumes `palette`/`shape`/`typographyTokens`;
 * the MUI-palette subset becomes `--mui-palette-*` CSS vars (theme.ts `cssVariables: true`).
 *
 * Editing rule: change a token HERE (or in Figma + re-sync), never hardcode a hex in a component.
 * Output-neutral by construction — these are exactly the values the theme shipped before extraction.
 */

/** MUI palette values per color scheme (dark = the historical default / anonymous baseline). */
export const palette = {
  dark: {
    primary: '#4f9cff',
    success: '#2ecc71', // calls / positive gamma / +P&L
    error: '#ff5c5c', //   puts / negative gamma / −P&L
    warning: '#ffa726', // amber — stale/offline, gamma-flip line, "coming soon"
    info: '#29b6f6', //    cyan — live dot/line, live status
    // Off-white (Catskill White) per the Figma — softer than pure #fff for body/headings.
    text: { primary: '#e6edf3', secondary: '#8b949e', disabled: '#5b6675' },
    background: { default: '#0e1117', paper: '#161b22' },
  },
  light: {
    primary: '#1d6fe0',
    success: '#1e9e57',
    error: '#d23b3b',
    warning: '#ed6c02',
    info: '#0288d1',
    text: { secondary: 'rgba(0, 0, 0, 0.6)', disabled: 'rgba(0, 0, 0, 0.38)' },
    background: { default: '#f5f6f8', paper: '#ffffff' },
  },
} as const;

/** MUI `shape` token (cards 10px; controls/chips override locally per the redesign). */
export const shape = { borderRadius: 10 } as const;

/** MUI `typography.fontFamily` + the mono numeric stack (Figma `font-family/sans` · `font-family/mono`). */
export const typographyTokens = {
  fontFamily: 'Inter, system-ui, Segoe UI, Roboto, sans-serif',
  monoFontFamily: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/**
 * Presentation-only extras (Figma: `color/bg/raised`, `color/bg/hatch-alt`, `color/text/secondary|disabled`,
 * `color/accent/violet`). NOT MUI palette entries — applied via `sx` literals, so they have no `--mui-*`
 * var. Kept here so the values are still single-sourced and the Figma↔code sync covers them.
 *
 * MODE-AWARE (light-mode-parity): `extras` keeps the historical DARK values (the default scheme and the
 * only mode most call sites originally shipped against); `extrasLight` mirrors each key for the light
 * scheme. Components must resolve via `extrasFor(theme)` inside an `sx`/styled callback — binding the
 * bare `extras` object dark-locks the surface (the light-mode hatch/panel bugs). The Figma light-mode
 * variable sync for these is a follow-up on `scripts/sync-figma-tokens.mjs`.
 */
export const extras = {
  panelRaised: '#1c2330',
  hatchAlt: '#14181f',
  textSecondary: '#8b949e',
  textDisabled: '#5b6675',
  accentViolet: '#7b5cff',
  // contained-primary button fill — deep enough for white text (≈5.5:1); the bright `#4f9cff`
  // primary/accent (links, active nav, COPY links, chips, borders, icons) is unchanged.
  buttonPrimaryBg: '#1d6fe0',
} as const;

/** Light-scheme counterparts, same keys. Raised panels sit a soft grey above white paper; the hatch
 *  alternates paper with a just-darker grey (mirroring the dark scheme's subtle paper↔hatch delta). */
export const extrasLight: Record<keyof typeof extras, string> = {
  panelRaised: '#eef1f5',
  hatchAlt: '#f0f2f5',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textDisabled: 'rgba(0, 0, 0, 0.38)',
  accentViolet: '#7b5cff',
  buttonPrimaryBg: '#1d6fe0',
} as const;

/** Resolve the mode-correct extras inside an `sx`/styled `theme` callback. */
export const extrasFor = (theme: {
  palette: { mode: string };
}): Record<keyof typeof extras, string> => (theme.palette.mode === 'light' ? extrasLight : extras);

/**
 * Brand gradient — the fixed blue→violet brand MARK (the account avatar + the Sign-up pill).
 * Deliberately mode-INVARIANT (logo-like: it does NOT shift with the theme), single-sourced from the
 * dark-primary + accent-violet tokens so it's not a raw literal at call sites. This is the one
 * intentional non-mode-aware brand element (formerly the contract-permitted hardcoded gradient).
 */
export const brandGradient =
  `linear-gradient(135deg, ${palette.dark.primary}, ${extras.accentViolet})` as const;

/**
 * Categorical chart palette — operator/diagnostic series colors (Tableau-10 subset). Deliberately
 * mode-INVARIANT (like `brandGradient`): these are NON-semantic, colorblind-distinguishable series
 * hues (no red-for-bad/green-for-good), identical in dark and light. The single source for every
 * chart series color — a component never hardcodes a hex (`[theme-token-discipline]`, enforced by
 * `shared/theme/hex-discipline.spec.ts`).
 */
export const chartCategorical = {
  /** Per-stage series hues for the operator latency trend (keyed by bundle stage name). */
  stages: {
    vendor_fetch: '#4e79a7',
    engine_build: '#f28e2b',
    off_exchange: '#59a14f',
    signals: '#b07aa1',
    persist: '#76b7b2',
    serialize_wrap: '#edc949',
  } as Record<string, string>,
  /** The single-series line color (matches `stages.vendor_fetch`). */
  singleLine: '#4e79a7',
  /** Stale-repeat marker stroke — a neutral grey (raw grey-500), non-semantic by design. */
  staleDot: '#9e9e9e',
} as const;

/**
 * Elevation ladder — a small NAMED box-shadow scale (not MUI's 25-slot `shadows[]`). Depth in dark UI
 * is luminance-first (lighter surface = closer); these ambient shadows are the SUPPORTING cue. `e1`
 * carries a faint top inset-highlight that fakes an overhead light for a bevelled edge. Mode-aware,
 * resolved via `elevationFor(theme)` inside an `sx`/styled callback (like `extrasFor`).
 *   e1 = resting panel/card · e2 = raised (hover / scrolled sticky-nav) · e4 = overlay (toast/menu/dialog)
 * Light-mode counterparts use softer black alphas and drop the white top-highlight.
 */
export const elevation = {
  dark: {
    e1: '0 1px 2px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    e2: '0 6px 16px rgba(0, 0, 0, 0.32), 0 2px 4px rgba(0, 0, 0, 0.2)',
    e4: '0 12px 32px rgba(0, 0, 0, 0.44), 0 4px 8px rgba(0, 0, 0, 0.28)',
  },
  light: {
    e1: '0 1px 2px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05)',
    e2: '0 6px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    e4: '0 12px 32px rgba(0, 0, 0, 0.16), 0 4px 8px rgba(0, 0, 0, 0.1)',
  },
} as const;

/** Resolve the mode-correct elevation scale inside an `sx`/styled `theme` callback. */
export const elevationFor = (theme: {
  palette: { mode: string };
}): Record<keyof typeof elevation.dark, string> =>
  theme.palette.mode === 'light' ? elevation.light : elevation.dark;
