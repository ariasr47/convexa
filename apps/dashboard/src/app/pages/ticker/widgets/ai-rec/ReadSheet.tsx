/**
 * ReadSheet — the AI read's bottom-sheet CONTAINER under 768px (SPEC §2.5, §4.1; canon rule 16;
 * DESIGN_SYSTEM.md row 16: "Under 768px the whole brief becomes a bottom sheet with a peek row
 * carrying the verdict, over the `scrim` token"). Criteria 45 (SB), 46 (review).
 *
 * **One component, not a second implementation.** The wide anatomy (>=768px) renders `children` —
 * `AiRecPanel`'s own `<Widget>` body, byte-identical to today — straight through, unwrapped. Under
 * 768px the SAME subtree is portalled into a fixed bottom `Drawer`; the ONLY genuinely new subtree
 * is the peek row, a small always-visible strip that carries the verdict while the sheet is
 * collapsed (SPEC §2.5's own words — nine states x two layouts is exactly where a second
 * implementation sneaks in, so this file adds a wrapper and one small subtree, never a parallel
 * render of the brief's body).
 *
 * **The container hazard, arriving by a different route (§2.5).** MUI portals a `Drawer`'s Paper to
 * `document.body`, severing the ancestry `@container panel` resolves through — the SAME failure as
 * declaring the name at the read strip (§2.5), arriving by a different route. The sheet re-declares
 * `panelContainerSx` (the SAME name `Widget.tsx`/`PanelContainer.tsx` already use, never a second
 * name) via the sanctioned `<PanelContainer>` wrapper, one level inside the portalled Paper root —
 * the nearest container ancestor of everything `children` renders is what matters, not literally
 * which DOM node the declaration sits on. `[lane-check]`: jsdom does not evaluate container queries —
 * the unit spec asserts the DECLARATION only (criterion 46 stays review, at a real 393px width).
 *
 * **Exactly one verdict node is ever mounted (criterion 45, SB).** The sheet defaults to EXPANDED the
 * moment a verdict exists — a freshly-asked read must show up immediately, full-body, the same way it
 * always has (an existing, already-shipped e2e flow drives "tap Analyze current snapshot" straight
 * into asserting `decision-verdict`/`decision-grid` attached at 393px with no intervening "expand"
 * tap — collapsing by default would have silently broken that flow). The peek row exists only once
 * the user explicitly MINIMIZES (a small chevron control inside the expanded sheet); while minimized,
 * `children` — which carry `AiRecPanel`'s own `decision-verdict` node whenever a read is produced —
 * are genuinely UNMOUNTED, not merely hidden, so the peek row's own copy is the ONLY verdict node in
 * the DOM. Re-expanding swaps that back. The two never coexist.
 *
 * The peek row's verdict string and its `isTrade` colour flag are computed ONCE in `AiRecPanel.tsx`
 * from the SAME `producedRec.strategy` object `DecisionCard` itself renders from (`decision`/`bias`) —
 * the "same value from the same model field" §2.5 requires — passed down as props, never re-derived
 * here from a wire scalar.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { PanelContainer } from '@/shared/ui';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type ReactNode, useState } from 'react';

export interface ReadSheetProps {
  /** The SAME string `DecisionCard`'s own `decision-verdict-word` node renders (`Trade · {bias}` /
   *  `No trade`) — `null` whenever no verdict is mounted in the wide anatomy either (idle, loading,
   *  unavailable, signed out — row 42: idle's verdict slot stays empty, so there is nothing to peek
   *  at and the sheet shows its body directly, uncollapsed). */
  verdict: string | null;
  /** Row 30 / canon 16 / DELEGATED P2: the verdict word is the ONLY amber-rendered TEXT in the panel,
   *  in every state. The peek row's own copy honors the SAME rule `DecisionCard` applies. */
  isTrade: boolean;
  /** The full `AiRecPanel` body — the SAME anatomy the wide layout renders, unmodified. */
  children: ReactNode;
  /**
   * Whether a verdict opens the sheet (default) or shows on the peek row. `false` for a read nobody
   * asked for: the demo's authored read arrives with the page (site check D-07), and an open sheet
   * would cover the phone desk on load. The peek row still carries the verdict, one tap from open.
   */
  defaultExpanded?: boolean;
}

export function ReadSheet({ verdict, isTrade, children, defaultExpanded = true }: ReadSheetProps) {
  const theme = useTheme();
  // The SAME `tablet` breakpoint `theme.ts`/DESIGN_SYSTEM.md already declare (768px) — never a
  // second literal. `useMediaQuery` degrades to `false` when `window.matchMedia` is absent (jsdom,
  // most unit tests) — every pre-existing AiRecPanel test keeps rendering the wide anatomy.
  const narrow = useMediaQuery(theme.breakpoints.down('tablet'));
  // Defaults OPEN: a freshly-produced read must show up immediately, full body, exactly as it
  // always has — see the module doc above for the shipped e2e flow this default protects. The
  // peek row is reached only by explicitly minimizing.
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Wide: the sheet is a container, not a variant. This `if` is the ONLY place `narrow` is
  // consulted in this file — every other visual difference between the two widths is CSS on the
  // shared anatomy, not a second render tree.
  if (!narrow) return <>{children}</>;

  // Nothing produced yet: nothing to peek AT (row 42, idle's verdict slot stays empty). The sheet
  // shows its body directly — no collapse state, no peek row, no risk of a stray amber-less
  // "verdict" placeholder inventing UX the contracts never named for this phase.
  if (verdict == null) return <>{children}</>;

  if (!expanded) {
    return (
      <Box
        component="button"
        type="button"
        data-testid="decision-verdict"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label={`${verdict} — open the AI read`}
        onClick={() => setExpanded(true)}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: theme.zIndex.drawer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          width: '100%',
          px: 2,
          py: 1.5,
          border: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Typography
          component="span"
          data-testid="decision-verdict-word"
          sx={{
            fontFamily: typographyTokens.displayFontFamily,
            fontStretch: typographyTokens.displayFontStretch,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            fontSize: '17px',
            color: isTrade ? 'primary.main' : undefined,
          }}
        >
          {verdict}
        </Typography>
        <ExpandLessIcon aria-hidden fontSize="small" sx={{ color: 'text.secondary' }} />
      </Box>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open
      onClose={() => setExpanded(false)}
      // DESIGN_SYSTEM.md row (v2 Motion): "bottom sheet 320ms" — the data-signal motion class names
      // this transition explicitly; MUI's own default (225ms entering / 195ms leaving) is not it.
      transitionDuration={320}
      slotProps={{
        paper: {
          // The sheet's own fixed-bottom geometry. Radius 16 is the DECLARED "dialogs" role
          // (DESIGN_SYSTEM.md row "Radius / elevation") — `MuiDialog`'s own styleOverride hardcodes
          // the identical literal; a `Drawer` has no such override, so it is repeated here, not
          // invented. (The `panel` container name is re-declared one level in, on `PanelContainer`
          // below — MUI's `slotProps.paper.sx` type is narrower than `Box`'s and rejects the array
          // form `panelContainerSx` needs; the sanctioned component wrapper sidesteps that cleanly
          // rather than fighting the slot type.)
          sx: {
            maxHeight: '85vh',
            overflowY: 'auto',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        },
      }}
    >
      {/* The minimize control — the only way back to the peek row. Carries NO verdict text of its
          own (criterion 45): repeating the verdict here, beside `children`'s own `decision-verdict`,
          would mount two verdict-marked nodes at once. */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 0.5,
        }}
      >
        <IconButton
          size="small"
          aria-label="Minimize the AI read"
          onClick={() => setExpanded(false)}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>
      {/* Re-declare the SAME `panel` container name the portal severed (§2.5) — never a second
          name — on the nearest ancestor of everything `children` renders, exactly one level inside
          the portalled Paper root. */}
      <PanelContainer>{children}</PanelContainer>
    </Drawer>
  );
}

export default ReadSheet;
