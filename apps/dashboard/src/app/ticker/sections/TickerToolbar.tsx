/**
 * TickerToolbar — the controls row (Figma `Ticker · Toolbar`, node 149:66): labeled fields — Ticker
 * entry · Expirations multi-select · Persona picker — each with a caption label ABOVE the control,
 * matching the Figma's label-above layout. A transient refresh spinner trails the fields.
 *
 * Scope (owner decision): the toolbar mirrors the Figma strictly. The connection status + regime chip
 * live in `TickerHeader` (Figma 149:96), not here; the README's other extra controls (Dark-pool
 * toggle, All/Clear, View AI hand-off, DTE pre-fill, stale banner) were intentionally removed.
 * Dark-pool context is fixed on.
 */
import {
  CircularProgress, TextField, Stack,
  FormControl, Select, OutlinedInput, MenuItem, Checkbox, ListItemText, Typography,
} from '@mui/material';
import { type ReactNode } from 'react';
import type { Expiration } from '@org/api';
import { PersonaPicker } from '../../personas/components';
import type { usePersona } from '../../personas/usePersona';
import { dteLabel } from './copy';

/** A labeled control field — caption above the control (Figma label-above layout). When `htmlFor`
 *  is given the caption is a real `<label>` so the control keeps an accessible name. */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography
        component={htmlFor ? 'label' : 'span'} htmlFor={htmlFor} variant="caption"
        sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}
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
    <Stack
      direction="row" data-testid="ticker-toolbar"
      sx={{ alignItems: 'flex-end', mb: 2, flexWrap: 'wrap', gap: 2, rowGap: 1.5 }}
    >
      <Field label="Ticker" htmlFor="ticker-input">
        <TextField
          id="ticker-input" size="small" value={symbol} sx={{ width: 120 }}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && symbol) onSubmitSymbol(); }}
        />
      </Field>

      <Field label="Expirations">
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
      </Field>

      <Field label="Persona">
        {/* Persona (prompt-layer overlay) — caption above per the Figma; never recomputes. */}
        <PersonaPicker persona={persona} onOpenCustomize={onOpenCustomize} externalLabel />
      </Field>

      {loading && <CircularProgress size={18} sx={{ mb: 1 }} />}
    </Stack>
  );
}

export default TickerToolbar;
