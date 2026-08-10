/**
 * `/scanner` — the view editor (UX §3.3, AC-13). Its symbol choices are BUILT FROM the read-only
 * `GET /api/scan/universe` response and nothing else: there is deliberately no free-text symbol
 * field, no "add ticker" affordance, and no request-tracking flow — a trader cannot invent, add, or
 * request a universe symbol in v1 (`[no-universe-admin]`). Selection ORDER is the display order.
 *
 * Saving is the one gated, state-bearing action: `onSave` runs the caller's `useGate`-wrapped write,
 * whose SERVER answer is the boundary of record. Nothing is written locally here — the dialog holds
 * only draft state and closes only when the server echoed a save.
 */
import {
  getScanUniverse,
  type ScanDensity,
  type ScanView,
  type ScanViewSort,
  type ScanViewWrite,
} from '@convexa/api';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { MONO } from './ScanCells';
import { SCAN_COPY } from './labels';

export interface ViewEditorDialogProps {
  open: boolean;
  onClose: () => void;
  view: ScanView | null;
  sort: ScanViewSort;
  density: ScanDensity;
  saveError: string | null;
  /** Resolves `true` only when the SERVER echoed a saved view. */
  onSave: (draft: ScanViewWrite) => Promise<boolean>;
}

const symbolButtonSx = (selected: boolean) => ({
  cursor: 'pointer',
  border: '1px solid',
  borderColor: selected ? 'primary.main' : 'divider',
  background: 'transparent',
  color: selected ? 'text.primary' : 'text.secondary',
  fontFamily: MONO.fontFamily,
  fontSize: '0.78rem',
  fontWeight: 600,
  borderRadius: '7px',
  padding: '6px 10px',
});

const moveButtonSx = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  background: 'transparent',
  font: 'inherit',
  fontSize: '0.75rem',
  color: 'text.secondary',
  borderRadius: '6px',
  padding: '2px 7px',
  minWidth: 26,
};

export function ViewEditorDialog({
  open,
  onClose,
  view,
  sort,
  density,
  saveError,
  onSave,
}: ViewEditorDialogProps) {
  const [universe, setUniverse] = useState<string[]>([]);
  const [universeFailed, setUniverseFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // The universe is read LAZILY, only when the editor opens — the page's mount path stays one call.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setUniverseFailed(false);
    setSelected(view?.symbols ?? []);
    setName(view?.name ?? '');
    getScanUniverse()
      .then((res) => {
        if (!cancelled) setUniverse(res.symbols);
      })
      .catch(() => {
        if (!cancelled) setUniverseFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, view]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (symbol: string) =>
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );

  const move = (index: number, delta: number) =>
    setSelected((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const submit = async () => {
    setSaving(true);
    const ok = await onSave({
      symbols: selected,
      name: name.trim() ? name.trim() : null,
      sort,
      density,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle data-testid="scan-view-editor">{SCAN_COPY.viewEditorTitle}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '10px' }}>
          {SCAN_COPY.universeHint}
        </Typography>

        {universeFailed && (
          <Typography
            data-testid="scan-universe-unavailable"
            sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '10px' }}
          >
            The tracked universe is unavailable this cycle. Try again shortly.
          </Typography>
        )}

        {/* Choices come from the universe response ALONE — there is no free-text symbol input. */}
        <Box
          data-testid="scan-universe-list"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', mb: '16px' }}
        >
          {universe.map((symbol) => (
            <Box
              key={symbol}
              component="button"
              type="button"
              aria-pressed={selectedSet.has(symbol)}
              data-testid={`scan-universe-${symbol}`}
              onClick={() => toggle(symbol)}
              sx={symbolButtonSx(selectedSet.has(symbol))}
            >
              {symbol}
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: '6px' }}>
          {SCAN_COPY.selectedHeading}
        </Typography>
        <Box
          data-testid="scan-selected-list"
          sx={{ display: 'flex', flexDirection: 'column', gap: '4px', mb: '16px' }}
        >
          {selected.map((symbol, index) => (
            <Box
              key={symbol}
              data-testid="scan-selected-item"
              data-symbol={symbol}
              sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Box component="span" sx={{ ...MONO, fontSize: '0.82rem', minWidth: 64 }}>
                {symbol}
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={`${SCAN_COPY.moveUp} ${symbol}`}
                data-testid={`scan-move-up-${symbol}`}
                onClick={() => move(index, -1)}
                sx={moveButtonSx}
              >
                ↑
              </Box>
              <Box
                component="button"
                type="button"
                aria-label={`${SCAN_COPY.moveDown} ${symbol}`}
                data-testid={`scan-move-down-${symbol}`}
                onClick={() => move(index, 1)}
                sx={moveButtonSx}
              >
                ↓
              </Box>
            </Box>
          ))}
        </Box>

        <TextField
          label={SCAN_COPY.viewNameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': 'scan-view-name' } }}
        />

        {saveError && (
          <Typography
            data-testid="scan-save-error"
            sx={{ fontSize: '0.8rem', color: 'warning.main', mt: '10px' }}
          >
            ⚠ {saveError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="scan-view-cancel">
          {SCAN_COPY.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || selected.length === 0}
          data-testid="scan-view-save"
        >
          {SCAN_COPY.saveView}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
