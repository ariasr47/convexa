/**
 * Design tokens — the SINGLE SOURCE OF TRUTH for every color and type value the app ships.
 * (redesign-stage-1: the "Curvature Terminal" identity, proposal
 * `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` §3 — values land here verbatim, never
 * re-derived in components.)
 *
 * AUTHORITY: `tokens.ts` is the single authority (owner ruling 2026-07-22, proposal §6a-3).
 * The former Figma "Design Reference" design system is RETIRED — it encodes the retired
 * palette; do not sync against it. `theme.ts` consumes `palette`/`shape`/`typographyTokens`;
 * the MUI-palette subset becomes `--mui-palette-*` CSS vars (theme.ts `cssVariables: true`).
 *
 * Editing rule: change a token HERE, never hardcode a hex in a component
 * (`[theme-token-discipline]`, enforced by `hex-discipline.spec.ts` + `banned-hexes.spec.ts`).
 *
 * Amber-vs-warning rule (binding, proposal §3): brand amber (`gammaAmber`) is FILLED/STRUCTURAL
 * — wordmark, primary actions, active states, the gamma-flip line. A surface that means
 * "warning" binds `warning.*` (burnt orange) AND renders an icon/glyph — hue alone never
 * carries "warning". A surface that means "brand/active" binds `primary.*`. Never the old
 * shared-amber ambiguity. Links/info/live status bind `info` (signal — deliberately quieter
 * than amber, so one color dominates: spent, not sprinkled).
 */

// ---------------------------------------------------------------------------------------------
// The named brand constants (proposal §3 — the names are part of the identity).
// Components NEVER import these directly; they bind MUI palette slots / `extrasFor(theme)`.
// ---------------------------------------------------------------------------------------------

/** Canvas — deeper and warmer than a code editor's near-black. */
export const ink = '#0B0F17';
/** Raised surface (keeps the shipped elevation/inset-well system). */
export const panel = '#131A24';
/** Primary text — warm terminal phosphor (measured 15.10:1 on ink). */
export const phosphor = '#E9E4D6';
/** Secondary text / quiet structure. */
export const steel = '#8A9BB4';
/** THE brand color, dominant — wordmark, primary actions, active states, the flip line. */
export const gammaAmber = '#F2A93B';
/**
 * The light-scheme amber. §3 gave `#C9821A`; it MEASURED 2.90:1 against paper (below the 3:1
 * UI floor), so the pre-authorized minimal darken applied (contract §5/§10-5, recorded in the
 * stage report): `#C57F19` → 3.02:1 on paper, 3.27:1 on white, 5.03:1 ink-on-fill.
 */
export const amberDeep = '#C57F19';
/** Links / info / live status — deliberately quieter than amber. */
export const signal = '#5E8BC4';
/** TRUE warnings only (stale/offline, error strips, degraded) — ALWAYS paired with an icon. */
export const warningOrange = '#E07A3F';
/** Light canvas — neutral-warm paper, deliberately clear of the cream tell. */
export const paper = '#F6F6F3';
/** Light-scheme ink text (primary text + contrastText on light amber fills). */
export const inkText = '#17202B';
/** DERIVED light counterparts (contract §5-measured; light warning/info/secondary). */
const lightWarning = '#A65526'; // burnt orange darkened → 4.91:1 paper / 5.32:1 white
const lightInfo = '#3D6DA5'; //   signal darkened → 4.94:1 paper / 5.34:1 white (links are body text)
const lightSecondary = '#5A6B85'; // steel darkened → 5.00:1 paper; white label on fill 5.42:1

/** MUI palette values per color scheme (dark = the historical default / anonymous baseline). */
export const palette = {
  dark: {
    primary: { main: gammaAmber, contrastText: ink }, // explicit ink text on amber fills (9.60:1)
    secondary: { main: steel, contrastText: ink }, //    quiet structural accent (kills the MUI purple leak)
    success: '#2ecc71', // RESERVED: calls / positive gamma / +P&L direction ONLY
    error: '#ff5c5c', //   RESERVED: puts / negative gamma / −P&L direction ONLY
    warning: warningOrange, // TRUE warnings only + icon ALWAYS (flip/coming-soon moved to primary)
    info: signal, //          links / live dot / live line / live chip
    text: { primary: phosphor, secondary: steel, disabled: 'rgba(138, 155, 180, 0.5)' },
    background: { default: ink, paper: panel },
    /** v2 `line` — the hairline divider. A real MUI slot every existing call site already binds,
     *  so landing it here changes the hairline app-wide with ZERO diff at those sites. */
    divider: 'rgba(138,155,180,0.16)',
  },
  light: {
    primary: { main: amberDeep, contrastText: inkText },
    secondary: { main: lightSecondary, contrastText: '#FFFFFF' },
    success: '#1e9e57', // RESERVED (as dark)
    error: '#d23b3b', //   RESERVED (as dark)
    warning: lightWarning,
    info: lightInfo,
    text: { primary: inkText, secondary: 'rgba(0, 0, 0, 0.6)', disabled: 'rgba(0, 0, 0, 0.38)' },
    background: { default: paper, paper: '#ffffff' },
    divider: 'rgba(23,32,43,0.12)',
  },
} as const;

/**
 * MUI `shape` token — the PANEL radius role (SPEC §2.2, ruling 4: "radius In"). Migrated 10 → 12
 * at the Curvature Terminal v2 foundations build. MUI resolves a numeric `borderRadius: n` inside
 * `sx` through `createUnaryUnit(theme, 'shape.borderRadius', 4, 'borderRadius')` — i.e. n × this
 * value, not n pixels — so this flip scales every numeric `sx` radius site by 1.2× whether or not
 * anyone looks. The other three declared roles (dialog 16 / control 8 / pill 999) are theme
 * overrides in `theme.ts` because one value cannot serve four roles.
 */
export const shape = { borderRadius: 12 } as const;

/**
 * Type trio (proposal §3): IBM Plex Sans (body/UI) · IBM Plex Mono (data/tape, tabular by
 * construction) · Archivo (display — SemiExpanded via the variable `wdth` axis, never a faux
 * stretch). All three self-hosted under /public/fonts (OFL 1.1, license files shipped);
 * fallback stacks are system faces only — Inter is RETIRED, not a fallback.
 */
export const typographyTokens = {
  fontFamily: "'IBM Plex Sans', system-ui, 'Segoe UI', Roboto, sans-serif",
  monoFontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  displayFontFamily: "'Archivo', 'IBM Plex Sans', system-ui, sans-serif",
  /** The display width treatment — a REAL font-stretch percentage (semi-expanded, 112.5%). */
  displayFontStretch: '112.5%',
} as const;

/**
 * The LANDING display scale (proposal §3: display 44–56px, Archivo 700, SemiExpanded).
 * Exported for Stage 2 (the hero rework consumes it); Stage 1 rescales no shipped surface —
 * in-app heading sizes are structural and stay.
 */
export const displayScale = {
  minPx: 44,
  maxPx: 56,
  fontWeight: 700,
} as const;

/**
 * Presentation-only extras. NOT MUI palette entries — applied via `sx` literals, so they have
 * no `--mui-*` var; kept here so the values stay single-sourced.
 *
 * MODE-AWARE (light-mode-parity): `extras` keeps the DARK values (the default scheme);
 * `extrasLight` mirrors each key for the light scheme. Components must resolve via
 * `extrasFor(theme)` inside an `sx`/styled callback — binding the bare `extras` object
 * dark-locks the surface (the light-mode hatch/panel bugs).
 *
 * Retired at redesign-stage-1: `accentViolet` (violet retired ENTIRELY — consumers rebound to
 * primary) and `buttonPrimaryBg` (amber primary + explicit ink contrastText makes MUI's default
 * contained treatment correct; the dark MuiButton override rode out with it).
 */
export const extras = {
  panelRaised: '#1B2432', // one elevation step above panel, hue-consistent with ink (derived)
  hatchAlt: '#101520', //   just-off-canvas hatch stripe (derived)
  textSecondary: steel,
  textDisabled: 'rgba(138, 155, 180, 0.5)',
  /**
   * The TEXT-GRADE amber (redesign-stage-3 §5.2) — for body/label-size (<18px) amber text
   * (coming-soon pills, the LOCKED chip, tier words, chip labels, the COPY buttons).
   * Dark = `gammaAmber` UNCHANGED (dark renders byte-identical; measured 9.60:1 on ink,
   * 8.76:1 on panel — ≥4.5 text class, pinned in stage3-amber.spec.ts). `primary.main`
   * remains the FILL/UI amber (buttons, bars, borders, icons — the ≥3:1 class).
   */
  textAmber: gammaAmber,
  // ---- Curvature Terminal v2 additions (SPEC §2.1) — six more, `divider` lives on `palette` ----
  /** v2 `ink2` — the WELL: the recessed body inside a panel. `Widget`'s `bodyVariant: 'inset'`
   *  fakes this today with `background.default`, which is `ink`, not `ink2`. One call site. */
  well: '#0D121B',
  /** v2 `raised2` — one elevation step above `panelRaised`; inherits its parity guarantee. */
  panelRaised2: '#223041',
  /** v2 `line2` — strong divider / control border. No second MUI divider slot exists, and a
   *  `palette.divider2` would emit a `--mui-palette-*` var no MUI component consumes. */
  lineStrong: 'rgba(138,155,180,0.30)',
  /** v2 `steel2` — TEXT TERTIARY. Explicitly NOT `palette.text.disabled`
   *  (`rgba(138,155,180,0.5)`), which MEANS disabled: two names, two meanings. Collapsing them
   *  would give a legible tertiary label disabled semantics for assistive tech. */
  textTertiary: 'rgba(138,155,180,0.85)',
  /** v2 `scrim` — sheet/dialog scrim. Consumed ONCE, via `MuiBackdrop.styleOverrides.root`. */
  scrim: 'rgba(0,0,0,0.55)',
  /** v2 `glass` — translucent nav background. Dark is exactly alpha(panel #131A24, 0.82), so the
   *  resting TopNav arm renders byte-identical. NAMED GAP: no token exists for the SCROLLED 0.9
   *  state; that one arm keeps its computed alpha until a token does. */
  glass: 'rgba(19,26,36,0.82)',
  /**
   * `textDim` — the REDUCED-EMPHASIS text state (PR #46 CI repair, 2026-09-09 Amendments row):
   * offline-retained figures, a paused tape readout, a session-tape-dropped last-trade caption —
   * anywhere copy needs to read "quieter" than its normal register (`text.primary` or
   * `text.secondary`) because the value behind it went stale. Replaces `opacity: 0.5` on text,
   * which computed a FAILING contrast at every real call site (`color-contrast`, serious,
   * measured 2.21–4.34:1 across `TickerHeader.tsx`'s last-trade readout, `TapePulseStrip.tsx`'s
   * paused Mid value, `FigureCell.tsx`'s dimmed value glyph and `ScanCells.tsx`'s offline-retained
   * `cell-price`) — opacity composites the foreground WITH the background, so it can never carry a
   * contrast guarantee independent of what it sits on. `textDim` is a SOLID colour instead: measured
   * (`text-dim-contrast.spec.ts`) at `#7B8CA6` on `panel` 5.12:1 (the hardest real dark surface —
   * `well`/`ink` clear with more headroom, 5.49/5.61), all four clearing the WCAG AA 4.5:1 normal-
   * text floor with real margin, one step quieter than `steel`/`text.secondary` (6.19:1 on panel) so
   * the reduced-emphasis intent still reads. NOT `extras.textTertiary` (steel2): that token names a
   * PERMANENT third-level label; this one names a STATE (temporarily degraded, temporarily true)
   * — collapsing the two would give a transient offline value the same meaning as a standing caption,
   * the exact two-names-one-meaning trap `textTertiary`'s own doc warns against for `textDisabled`.
   * The pause mark (`PauseMark`, F4/F5) stays the non-colour cue alongside it, unchanged.
   */
  textDim: '#7B8CA6',
  /**
   * `textInfo` — the TEXT-GRADE info blue (PR #46 CI repair, 2026-09-09 Amendments row), mirroring
   * `textAmber`'s fill-vs-text split for the `info` hue (`signal`): `info.main` is deliberately the
   * QUIETEST fill in the palette ("links / live status — deliberately quieter than amber" — see the
   * top-of-file note), which is exactly why it fails as small TEXT sat on its own tint. Three real
   * small-text `info.main` sites measured under WCAG AA's 4.5:1 (`color-contrast`, serious): the
   * connection chip's "live · mid …" label (4.43:1, `alpha(info.main,0.16)` tint over `ink`), the
   * `mid · tape` header badge (3.7:1, composited `action.selected` fill) and the ladder mid row's
   * live badge word (same). `success`/`error`/`warning` do NOT share this failure at the SAME
   * `alpha(tone,0.16)` formula (measured 4.7–7.0:1 — real headroom), so this is `info` alone.
   * Measured (`text-info-contrast.spec.ts`): dark `#8CB0DE` clears every real composited surface
   * these three sites paint on (`alpha(info.main,0.16)` over ink/panel/well 6.3–7.1:1;
   * `action.selected` over panel 4.77:1 — the tighter floor, still clearing with margin).
   */
  textInfo: '#8CB0DE',
} as const;

/** Light-scheme counterparts, same keys. Raised panels sit a soft warm-grey above white paper;
 *  the hatch alternates paper with a just-darker step (mirroring the dark paper↔hatch delta). */
export const extrasLight: Record<keyof typeof extras, string> = {
  panelRaised: '#ECECE7',
  hatchAlt: '#EFEFEA',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  textDisabled: 'rgba(0, 0, 0, 0.38)',
  /**
   * Light text-grade amber — the §5.2 candidate `#8F5C0F` SHIPPED after passing the hard
   * measurement gate (computed in stage3-amber.spec.ts): 5.23:1 on paper `#F6F6F3`,
   * 5.67:1 on white, 4.81:1 composited over the worst tint fill it sits on
   * (`alpha(amberDeep, 0.16)` on white). `amberDeep` alone measures ~3.0–3.3 — legal for
   * UI fills, a WCAG failure as body text; this slot closes that flag.
   */
  textAmber: '#8F5C0F',
  well: '#F1F1EC',
  panelRaised2: '#E3E3DD',
  lineStrong: 'rgba(23,32,43,0.22)',
  /**
   * Light `steel2` — darkened from the original `#61708A` (owner ruling 7, 2026-09-03: the
   * canon stated only "a solid light-mode value", and `#61708A` measured 4.23:1 on
   * `extras.panelRaised` — below the WCAG AA 4.5:1 normal-text floor for the widget-card surface
   * a real tertiary label sits on, e.g. `PositionBrief.tsx`'s basis chip). `#5D6B84` clears every
   * light surface a real consumer paints text on TODAY (grep-verified, `steel2-contrast.spec.ts`):
   * `panelRaised` 4.54:1 (dialogs/toolbars/table-hover/`PositionBrief`), `well` 4.75:1 (the inset
   * body of 7 ticker widgets + the nav search trigger), `background.default`/"paper" 4.97:1,
   * `background.paper`/white 5.38:1 (Widget's own card + `FigureCell`'s `CellCard`).
   * `panelRaised2` (`raised2`, `#E3E3DD`) is deliberately NOT in that floor: it has ZERO real
   * consumers anywhere in the app (defined in this file and touched only by token-hygiene specs),
   * so a darken past what real surfaces need would be un-evidenced — and the further candidate
   * that does clear it (`#58657D`) measures 5.88:1 on white, which would read as MORE contrast
   * than `text.secondary`'s 5.74:1 there, inverting the tertiary-quieter-than-secondary hierarchy.
   * Re-verify against `raised2` the day a component actually paints a background with it.
   */
  textTertiary: '#5D6B84',
  scrim: 'rgba(23,32,43,0.45)',
  glass: 'rgba(255,255,255,0.86)',
  /**
   * Light `textDim` — measured (`text-dim-contrast.spec.ts`) at `#576578` on `panelRaised` 5.01:1
   * (the hardest real light surface, same floor `steel2`'s light value clears), `well` 5.24:1,
   * `paper` 5.48:1, white 5.94:1 — all clearing WCAG AA 4.5:1 with real margin. Never exercised by
   * the shipped scans (the offline/paused states this token dims are dark-scheme-only fixtures
   * today), computed anyway to the same rigor as every other v2 pair rather than left unverified.
   */
  textDim: '#576578',
  /**
   * Light `textInfo` — measured (`text-info-contrast.spec.ts`) at `#2F547D` on `alpha(lightInfo,
   * 0.16)` composited over `white`/`paper`/`panelRaised`/`well` (6.31–5.40:1) and on
   * `action.selected` composited over the same surfaces (7.82–6.54:1) — every real light surface
   * these three sites could paint on, all clearing WCAG AA 4.5:1 with real margin. Never exercised
   * by the shipped scans (the connection-chip `live` state and the two badge labels this token
   * corrects are dark-scheme fixtures today), computed anyway to the same rigor as every other v2
   * pair rather than left unverified.
   */
  textInfo: '#2F547D',
} as const;

/** Resolve the mode-correct extras inside an `sx`/styled `theme` callback. */
export const extrasFor = (theme: {
  palette: { mode: string };
}): Record<keyof typeof extras, string> => (theme.palette.mode === 'light' ? extrasLight : extras);

// `brandGradient` was DELETED at redesign-stage-3 (§5.1): the skill bans the gradient-brand
// vocabulary ("the gradient mark is dead") and both consumers (the account avatar + the Sign-up
// pill) were rebound to flat `primary.main` + `primary.contrastText` — which also fixed their
// measured-broken white-on-amber labels (~2:1). A token with zero consumers is a standing
// invitation to re-sprinkle; stage1-tokens.spec.ts pins its ABSENCE (the `accentViolet` precedent).

/**
 * Categorical chart palette — operator/diagnostic series colors (Tableau-10 subset). Deliberately
 * mode-INVARIANT and deliberately NON-brand: these are non-semantic,
 * colorblind-distinguishable series hues for `/_ops/metrics` only, off the trader path. The
 * brand palette does not govern diagnostic series hues (redesign-stage-1 §3.2 — UNCHANGED).
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
 * Elevation ladder — a small NAMED box-shadow scale (not MUI's 25-slot `shadows[]`). Depth in dark
 * UI is luminance-first (lighter surface = closer); these ambient shadows are the SUPPORTING cue.
 * `e1` carries a faint top inset-highlight that fakes an overhead light for a bevelled edge.
 * Mode-aware, resolved via `elevationFor(theme)` inside an `sx`/styled callback (like `extrasFor`).
 *   e1 = resting panel/card · e2 = raised (hover / scrolled sticky-nav) · e4 = overlay (toast/menu/dialog)
 * Light-mode counterparts use softer black alphas and drop the white top-highlight.
 * The dark theme ALSO derives an explicit MUI `shadows[]` from this ladder (theme.ts — the
 * theme-audit "dark shadows" gap closure), so menus/popovers/dialogs visibly separate on `panel`.
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
