/**
 * TickerToolbar — the command deck's **controls** (tier 2 of the CommandDeck, or beside the CTA in the
 * headline row from `laptop`). The controls (Ticker entry · Expirations multi-select · Persona picker)
 * are the Final board's `.tk-sel` chips: each a 36px bordered chip with its caps label, value and
 * chevron inside (fidelity DESK-05; earlier a segmented panel with hairline seams, and before that
 * three bare labeled `Field`s — see the ticker-command-deck plan).
 *
 * Scope (owner decision): the toolbar mirrors the Figma strictly. The connection status + regime chip
 * live in `TickerHeader` (the deck hero), not here; the README's other extra controls (Dark-pool
 * toggle, All/Clear, View AI hand-off, DTE pre-fill, stale banner) were intentionally removed.
 * Dark-pool context is fixed on.
 *
 * ALL logic is preserved byte-for-byte: `onSymbolChange`/`onSubmitSymbol` (uppercase + Enter-to-load),
 * the Expirations multiselect (`checked`/`selected`/all→`null`), `PersonaPicker` + `onOpenCustomize`,
 * the transient refresh spinner. The restyle is layout only. `data-testid="ticker-toolbar"` and every
 * accessible label are kept.
 */
import { PersonaPicker } from '@/features/personas/components';
import type { usePersona } from '@/features/personas/usePersona';
import { extrasFor } from '@/shared/theme/tokens';
import type { Expiration } from '@convexa/api';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode } from 'react';
import { dteLabel } from '../_kit/copy';

/**
 * One control as the Final board's `.tk-sel` chip (`design/src/screens/final/ticker-desk.mjs:28`):
 * a 36px bordered chip on the well holding the caps label, the value and a chevron, so Expirations,
 * Persona and the CTA sit on one 36px row (fidelity DESK-05: two 47px outlined selects at 306 and
 * 288px wrapped the CTA onto a third line). Re-skin only: the SAME `Select`/`PersonaPicker` children,
 * ids, testids and accessible names; the chip is the field, so the control inside drops its own
 * outline, padding and 190px minimum. Below `tablet` each chip takes a full row at 44px, as the
 * board's phone does. When `htmlFor` is given the caption is a real `<label>`.
 */
function Segment({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        minHeight: { xs: 44, tablet: 36 },
        flex: { xs: '1 1 100%', tablet: '0 1 auto' },
        pl: 1.5,
        pr: 1.25,
        boxSizing: 'border-box',
        minWidth: 0,
        maxWidth: '100%',
        borderRadius: '8px',
        border: `1px solid ${extrasFor(t).lineStrong}`,
        bgcolor: extrasFor(t).well,
        fontSize: 13,
        '& .MuiFormControl-root': { minWidth: 0, flex: { xs: '1 1 auto', tablet: '0 1 auto' } },
        '& .MuiInputBase-root': { fontSize: 13, fontWeight: 600, borderRadius: 0 },
        '& .MuiOutlinedInput-notchedOutline': { border: 0 },
        '& .MuiSelect-select.MuiSelect-select.MuiSelect-select': {
          minHeight: 0,
          py: 0,
          pl: 0,
          pr: '22px',
          lineHeight: { xs: '42px', tablet: '34px' },
        },
        '& .MuiSelect-icon': { right: -4, fontSize: 18, color: 'text.secondary' },
        // The standalone fallback's ticker entry sits in a chip too.
        '& input.MuiInputBase-input': { py: 0.75, px: 0.5 },
      })}
    >
      <Typography
        component={htmlFor ? 'label' : 'span'}
        htmlFor={htmlFor}
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: 11, // label type floor ≥11px (Stage 0 item 4)
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

interface Props {
  symbol: string;
  onSymbolChange: (v: string) => void;
  onSubmitSymbol: () => void;
  expirations: Expiration[];
  allDates: string[];
  selected: string[] | null;
  checked: string[];
  onSelectExpirations: (v: string[] | null) => void;
  persona: ReturnType<typeof usePersona>;
  onOpenCustomize: () => void;
  loading: boolean;
  /**
   * Inside CommandDeck the outer paper already provides the panel — use a lighter strip
   * (no second border box) so it doesn't read as panel-in-panel.
   */
  embedded?: boolean;
  /**
   * PASS 2 change 9 — at ≥ laptop (1100) the toolbar joins `TickerHeader`'s own headline row
   * (`CommandDeck.tsx`'s `controlsJoinHeadline`) instead of sitting in its own full-width tier-2
   * strip below it (`design/src/screens/desk.mjs:255-274`'s `.mast-controls`: fields + the CTA
   * side by side, pinned to the headline row's right edge). Only meaningful when `embedded` — drops
   * the full-width + top-divider chrome that strip placement needs (nothing to divide FROM when
   * sitting beside the CTA instead of below the header). Content/ids/testids unchanged either way.
   */
  inline?: boolean;
}

export function TickerToolbar({
  symbol,
  onSymbolChange,
  onSubmitSymbol,
  expirations,
  allDates,
  selected,
  checked,
  onSelectExpirations,
  persona,
  onOpenCustomize,
  loading,
  embedded = false,
  inline = false,
}: Props) {
  return (
    <Box
      data-testid="ticker-toolbar"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        // The board's `.tk-ctl` gaps between chips (10px rows, 12px columns).
        gap: '10px 12px',
        width: embedded && !inline ? '100%' : undefined,
        // Standalone: recessed instrument panel. Embedded row: hairline top + seams (deck is the
        // frame). Embedded inline (PASS 2 change 9): same seams, no top divider/full-width — there
        // is no header content above it to divide from, it sits beside the CTA instead.
        ...(embedded
          ? {
              border: 'none',
              // On a phone the chips are full-width bordered fields under the tabs, as the
              // board's phone masthead draws them, with no rule above (fidelity DESK-06).
              ...(inline
                ? {}
                : {
                    borderTop: { xs: 'none', sm: `1px solid ${t.palette.divider}` },
                    pt: { xs: 0, sm: 1.5 },
                  }),
              borderRadius: 0,
              bgcolor: 'transparent',
              boxShadow: 'none',
              px: 0,
              pb: 0,
            }
          : {
              border: `1px solid ${t.palette.divider}`,
              borderRadius: '12px',
              bgcolor: `color-mix(in srgb, ${t.palette.background.paper} 55%, transparent)`,
              boxShadow:
                t.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
              p: 0.75,
            }),
      })}
    >
      {/* Ticker fidelity repair, change 3 (F3) — the design's desk carries no bare ticker input
          (`design/src/screens/desk.mjs:274-278`'s `.mast-controls`: EXPIRATIONS / PERSONA / the one
          CTA only); the palette (⌘K / Ctrl+K, `shell/AppShell.tsx`) is the ticker-entry job on the
          populated desk, and it already accepts an arbitrary plausible symbol
          (`CommandPalette.tsx`'s "open anyway" item), so nothing becomes unreachable. Kept ONLY for
          the standalone (non-`embedded`) cold-load/error fallback in `TickerDashboard.tsx` — before
          `m` exists there is no masthead (no "desk") for the palette to stand in for yet, and this
          is the page's one remaining way to change ticker in that state. */}
      {!embedded && (
        <Segment label="Ticker" htmlFor="ticker-input">
          <TextField
            id="ticker-input"
            size="small"
            value={symbol}
            sx={{ width: 120 }}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && symbol) onSubmitSymbol();
            }}
          />
        </Segment>
      )}

      <Segment label="Expirations">
        <FormControl size="small" sx={{ maxWidth: '100%' }} disabled={!allDates.length}>
          <Select
            multiple
            displayEmpty
            value={checked}
            input={<OutlinedInput />}
            inputProps={{ 'aria-label': 'Expirations' }}
            onChange={(e) => {
              const v =
                typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
              // Every date ticked -> null ("all", no filter); otherwise the explicit subset (incl. []).
              onSelectExpirations(v.length === allDates.length ? null : v);
            }}
            renderValue={() =>
              selected === null
                ? 'All'
                : selected.length === 0
                  ? 'None selected'
                  : `${selected.length} of ${allDates.length}`
            }
            MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
          >
            {expirations.map((e) => (
              <MenuItem key={e.date} value={e.date}>
                <Checkbox checked={checked.includes(e.date)} />
                <ListItemText primary={e.date} secondary={dteLabel(e.dte)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Segment>

      <Segment label="Persona">
        {/* Persona (prompt-layer overlay) — micro-label above per the Figma; never recomputes. */}
        <PersonaPicker persona={persona} onOpenCustomize={onOpenCustomize} externalLabel />
      </Segment>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
          <CircularProgress size={18} />
        </Box>
      )}
    </Box>
  );
}

export default TickerToolbar;
