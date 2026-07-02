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
import {
  CircularProgress, TextField, Box, Stack,
  FormControl, Select, OutlinedInput, MenuItem, Checkbox, ListItemText, Typography,
} from '@mui/material';
import { type ReactNode } from 'react';
import type { Expiration } from '@org/api';
import { PersonaPicker } from '../../personas/components';
import type { usePersona } from '../../personas/usePersona';
import { dteLabel } from './copy';

/** One segment of the instrument panel — an uppercase micro-label above its control. When `htmlFor`
 *  is given the caption is a real `<label>` so the control keeps an accessible name. */
function Segment({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <Stack spacing={0.5} sx={{ px: { xs: 0, sm: 1.75 }, py: 0.25, minWidth: 0 }}>
      <Typography
        component={htmlFor ? 'label' : 'span'} htmlFor={htmlFor} variant="caption"
        sx={{
          color: 'text.secondary', fontSize: 10.5, fontWeight: 600, lineHeight: 1.2,
          letterSpacing: '0.06em', textTransform: 'uppercase',
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
}

export function TickerToolbar({
  symbol, onSymbolChange, onSubmitSymbol, expirations, allDates, selected, checked,
  onSelectExpirations, persona, onOpenCustomize, loading,
}: Props) {
  return (
    <Box
      data-testid="ticker-toolbar"
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'stretch',
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
        rowGap: 1.5,
        // The panel reads as one recessed instrument: a faint well tint + hairline border + rounded,
        // token-bound (color-mix off the palette + neutral rgba light/shadow — zero hex).
        border: `1px solid ${t.palette.divider}`,
        borderRadius: '12px',
        bgcolor: `color-mix(in srgb, ${t.palette.background.paper} 55%, transparent)`,
        boxShadow: t.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
        p: 0.75,
        // Hairline seams BETWEEN segments (not before the first). On wrap (xs) the vertical seam is
        // suppressed so a wrapped row doesn't show a dangling divider.
        '& > * + *': {
          borderLeft: { xs: 'none', sm: `1px solid ${t.palette.divider}` },
        },
      })}
    >
      <Segment label="Ticker" htmlFor="ticker-input">
        <TextField
          id="ticker-input" size="small" value={symbol} sx={{ width: 120 }}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && symbol) onSubmitSymbol(); }}
        />
      </Segment>

      <Segment label="Expirations">
        <FormControl size="small" sx={{ minWidth: 190 }} disabled={!allDates.length}>
          <Select
            multiple
            displayEmpty
            value={checked}
            input={<OutlinedInput />}
            inputProps={{ 'aria-label': 'Expirations' }}
            onChange={(e) => {
              const v = (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value);
              // Every date ticked -> null ("all", no filter); otherwise the explicit subset (incl. []).
              onSelectExpirations(v.length === allDates.length ? null : v);
            }}
            renderValue={() =>
              selected === null ? 'All expirations'
              : selected.length === 0 ? 'None selected'
              : `${selected.length} of ${allDates.length}`}
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
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.25, borderLeft: 'none !important' }}>
          <CircularProgress size={18} />
        </Box>
      )}
    </Box>
  );
}

export default TickerToolbar;
