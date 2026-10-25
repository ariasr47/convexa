/**
 * `/scanner` — the view editor (UX §3.3, AC-13). Its symbol choices are BUILT FROM the read-only
 * `GET /api/scan/universe` response and nothing else: there is deliberately no free-text symbol
 * field, no "add ticker" affordance, and no request-tracking flow — a trader cannot invent, add, or
 * request a universe symbol in v1 (`[no-universe-admin]`). Selection ORDER is the display order.
 *
 * Saving is the one gated, state-bearing action: `onSave` runs the caller's `useGate`-wrapped write,
 * whose SERVER answer is the boundary of record. Nothing is written locally here — the dialog holds
 * only draft state and closes only when the server echoed a save.
 *
 * Layout: the Final board's view editor (`design/src/screens/final/account-dialogs.mjs`
 * viewEditorDemo; fidelity ACC-10, ACC-20): 760 wide, a head with its close button, two columns
 * (the universe as checkboxes | the view's order rows with up/down chevrons), the name field, and a
 * foot that says where the view is kept. Under 600px it is the shared bottom sheet (ACC-15): full
 * width at the foot of the screen, a grab handle, one column, actions stacked at 44px.
 */
import { MONO_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import { bottomSheetActionsSx, bottomSheetDialogSx, grabHandleSx } from '@/shared/ui/bottomSheet';
import { coarseFloor } from '@/shared/ui/touch';
import {
  dataMode,
  getScanUniverse,
  type ScanDensity,
  type ScanView,
  type ScanViewSort,
  type ScanViewWrite,
} from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useId, useMemo, useState, type ChangeEvent } from 'react';
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

/** The demo keeps the view in this browser; the live site keeps it on the signed-in account. */
const DEMO = dataMode === 'demo';
/** The editor's own words (Final board). Not part of `SCAN_COPY`, whose keys CF-1 freezes. */
const EDITOR_COPY = {
  close: 'Close',
  universeHeading: (n: number) => `Tracked universe · ${n}${DEMO ? ' in the demo' : ''}`,
  storedAt: DEMO ? 'Saved in this browser’s demo workspace.' : 'Saved to your account.',
} as const;

/** 24-grid stroke icons (canon Icons row): `currentColor`, 1.75 stroke, round caps and joins. */
function StrokeIcon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: size, height: size, flex: 'none', display: 'block' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </Box>
  );
}
const ICON = {
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

/** The board's field label (`.fld`): 12.5px/600, above its control. */
const fieldLabelSx = { fontSize: '0.78125rem', fontWeight: 600, color: 'text.primary' } as const;

/** The board's `.drows` row: a hairline above, 6px in, 12px type. */
const listRowSx = {
  display: 'grid',
  alignItems: 'center',
  gap: '8px',
  py: '6px',
  borderTop: '1px solid',
  borderColor: 'divider',
  fontSize: '0.75rem',
} as const;

/** The board's ghost `sm` button: 30px, steel, a raised hover; 44px on a coarse pointer. */
const ghostButtonSx = (theme: Theme) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  minWidth: 30,
  minHeight: 30,
  p: 0,
  border: 'none',
  borderRadius: '8px',
  background: 'transparent',
  color: 'text.secondary',
  cursor: 'pointer',
  font: 'inherit',
  '&:hover:not(:disabled)': { color: 'text.primary', bgcolor: extrasFor(theme).panelRaised },
  '&:disabled': { opacity: 0.45, cursor: 'not-allowed' },
  '@media (pointer: coarse)': { minHeight: 44, minWidth: 44, width: 44 },
});

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
  const universeHeadingId = useId();
  const selectedHeadingId = useId();
  const nameId = useId();

  // The universe is read LAZILY, only when the editor opens — the page's mount path stays one call.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setUniverseFailed(false);
    setSelected(view?.symbols ?? []);
    // Prefilled with the view's saved name. An unnamed view stays unnamed: a name the reader never
    // chose would be written by the next save.
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
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      // 760 wide (the board's `.v4dlg.wide`); under 600px the shared bottom sheet takes over.
      sx={[{ '& .MuiDialog-paper': { maxWidth: 760 } }, bottomSheetDialogSx]}
    >
      <Box aria-hidden sx={grabHandleSx} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          px: '18px',
          py: '14px',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <DialogTitle
          data-testid="scan-view-editor"
          sx={{ p: 0, flex: '1 1 auto', minWidth: 0, fontSize: '1rem', fontWeight: 700 }}
        >
          {SCAN_COPY.viewEditorTitle}
        </DialogTitle>
        <Box
          component="button"
          type="button"
          aria-label={EDITOR_COPY.close}
          data-testid="scan-view-close"
          onClick={onClose}
          sx={ghostButtonSx}
        >
          <StrokeIcon d={ICON.close} size={16} />
        </Box>
      </Box>

      <Box
        sx={{
          px: '18px',
          py: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
        }}
      >
        <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.45, color: 'text.secondary' }}>
          {SCAN_COPY.universeHint}
        </Typography>

        {universeFailed && (
          <Typography
            data-testid="scan-universe-unavailable"
            sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
          >
            The tracked universe is unavailable this cycle. Try again shortly.
          </Typography>
        )}

        <Box
          data-testid="scan-editor-columns"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: '16px',
            alignItems: 'start',
          }}
        >
          {/* Choices come from the universe response ALONE — there is no free-text symbol input. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
            <Typography id={universeHeadingId} sx={fieldLabelSx}>
              {EDITOR_COPY.universeHeading(universe.length)}
            </Typography>
            <Box
              role="group"
              aria-labelledby={universeHeadingId}
              data-testid="scan-universe-list"
              sx={{ display: 'flex', flexDirection: 'column' }}
            >
              {universe.map((symbol) => {
                const on = selectedSet.has(symbol);
                return (
                  <Box
                    key={symbol}
                    component="label"
                    sx={{
                      ...listRowSx,
                      gridTemplateColumns: '24px minmax(0, 1fr)',
                      cursor: 'pointer',
                      ...coarseFloor,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ position: 'relative', display: 'inline-flex', width: 20, height: 20 }}
                    >
                      <Box
                        component="input"
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(symbol)}
                        data-testid={`scan-universe-${symbol}`}
                        sx={(t) => ({
                          appearance: 'none',
                          m: 0,
                          width: 20,
                          height: 20,
                          // The 20px box is the mark; the whole row (its `<label>`) is the target,
                          // 44px on a coarse pointer, so the theme's input floor is held off here.
                          minHeight: 20,
                          minWidth: 20,
                          borderRadius: '5px',
                          border: '1px solid',
                          borderColor: on ? 'text.primary' : extrasFor(t).lineStrong,
                          bgcolor: 'transparent',
                          cursor: 'pointer',
                        })}
                      />
                      {on && (
                        <Box
                          component="span"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'text.primary',
                            pointerEvents: 'none',
                          }}
                        >
                          <StrokeIcon d={ICON.check} />
                        </Box>
                      )}
                    </Box>
                    <Box component="span" sx={{ ...MONO_FACE, fontWeight: 600 }}>
                      {symbol}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
            <Typography id={selectedHeadingId} sx={fieldLabelSx}>
              {SCAN_COPY.selectedHeading}
            </Typography>
            <Box
              role="list"
              aria-labelledby={selectedHeadingId}
              data-testid="scan-selected-list"
              sx={{ display: 'flex', flexDirection: 'column' }}
            >
              {selected.map((symbol, index) => (
                <Box
                  key={symbol}
                  role="listitem"
                  data-testid="scan-selected-item"
                  data-symbol={symbol}
                  sx={{
                    ...listRowSx,
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    py: 0,
                    minHeight: 44,
                    boxSizing: 'border-box',
                  }}
                >
                  <Box component="span" sx={{ ...MONO_FACE, fontWeight: 600 }}>
                    {symbol}
                  </Box>
                  <Box component="span" sx={{ display: 'inline-flex', gap: '4px' }}>
                    <Box
                      component="button"
                      type="button"
                      aria-label={`${SCAN_COPY.moveUp} ${symbol}`}
                      data-testid={`scan-move-up-${symbol}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      sx={ghostButtonSx}
                    >
                      <StrokeIcon d={ICON.up} />
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      aria-label={`${SCAN_COPY.moveDown} ${symbol}`}
                      data-testid={`scan-move-down-${symbol}`}
                      disabled={index === selected.length - 1}
                      onClick={() => move(index, 1)}
                      sx={ghostButtonSx}
                    >
                      <StrokeIcon d={ICON.down} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Box component="label" htmlFor={nameId} sx={fieldLabelSx}>
            {SCAN_COPY.viewNameLabel}
          </Box>
          <Box
            component="input"
            id={nameId}
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            data-testid="scan-view-name"
            sx={(t) => ({
              boxSizing: 'border-box',
              width: '100%',
              minHeight: 40,
              px: '12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: extrasFor(t).lineStrong,
              bgcolor: extrasFor(t).well,
              color: 'text.primary',
              font: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 500,
              ...coarseFloor,
            })}
          />
        </Box>

        {saveError && (
          <Typography
            data-testid="scan-save-error"
            sx={{ fontSize: '0.8rem', color: 'warning.main' }}
          >
            ⚠ {saveError}
          </Typography>
        )}
      </Box>

      <Box
        data-testid="scan-view-footer"
        sx={[
          {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            px: '18px',
            py: '12px',
            borderTop: '1px solid',
            borderColor: 'divider',
          },
          bottomSheetActionsSx,
        ]}
      >
        <Typography
          sx={{ flex: '1 1 240px', fontSize: '0.75rem', lineHeight: 1.45, color: 'text.secondary' }}
        >
          {EDITOR_COPY.storedAt}
        </Typography>
        <Button onClick={onClose} color="inherit" data-testid="scan-view-cancel">
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
      </Box>
    </Dialog>
  );
}
