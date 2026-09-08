/**
 * TickerToolbar — the command deck's **control strip** (tier 2 of the CommandDeck). The three controls
 * (Ticker entry · Expirations multi-select · Persona picker) are unified into ONE segmented, divided
 * container: a single instrument panel with hairline `divider` seams between segments, each segment an
 * uppercase micro-label above its control. (Previously three bare, separate labeled `Field`s floating
 * on the page — see the ticker-command-deck plan.)
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
import type { Expiration } from '@convexa/api';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode } from 'react';
import { dteLabel } from '../_kit/copy';

/** One segment of the instrument panel — an uppercase micro-label above its control. When `htmlFor`
 *  is given the caption is a real `<label>` so the control keeps an accessible name. */
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
    <Stack spacing={0.5} sx={{ px: { xs: 0, sm: 1.75 }, py: 0.25, minWidth: 0, maxWidth: '100%' }}>
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
        }}
      >
        {label}
      </Typography>
      {children}
    </Stack>
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
}: Props) {
  return (
    <Box
      data-testid="ticker-toolbar"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'stretch',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        rowGap: 1.5,
        width: embedded ? '100%' : undefined,
        // Standalone: recessed instrument panel. Embedded: hairline top + seams only (deck is the frame).
        ...(embedded
          ? {
              border: 'none',
              borderTop: `1px solid ${t.palette.divider}`,
              borderRadius: 0,
              bgcolor: 'transparent',
              boxShadow: 'none',
              pt: 1.5,
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
        // Hairline seams BETWEEN segments (not before the first).
        '& > * + *': {
          borderLeft: { xs: 'none', sm: `1px solid ${t.palette.divider}` },
        },
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
        <FormControl
          size="small"
          sx={{ minWidth: 190, maxWidth: '100%' }}
          disabled={!allDates.length}
        >
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
                ? 'All expirations'
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
        <Box
          sx={{ display: 'flex', alignItems: 'center', px: 1.25, borderLeft: 'none !important' }}
        >
          <CircularProgress size={18} />
        </Box>
      )}
    </Box>
  );
}

export default TickerToolbar;
