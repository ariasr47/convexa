/**
 * Ghost-trade entry dialog (paper trade — no broker, no real order). Reskinned to Figma 118:1446:
 * a 400px slate dialog with a Manual price / Market / Limit fill-mode control that picks the emitted
 * `entryMark`. Market uses the auto-resolved snapshot/theoretical mid (the original behavior); Manual
 * and Limit use a typed price. Emits a NewTradeForm. Theme-native — colors come from the theme/tokens.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Dialog, DialogContent, Button, Chip, Stack, Typography, Select, MenuItem, ToggleButton,
  ToggleButtonGroup, TextField, Box, IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { fetchTrackedContract, OptionRight } from '@org/api';
import { bsPrice } from './mark';
import { NewTradeForm } from './useGhostTrade';
import type { MarkBasis } from './types';
import { extras } from '../tokens';

const SIMULATED_TIP = 'A paper trade — no broker, no real money, no real order is ever placed.';
const DISCLAIMER =
  'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and ' +
  'assignment are not modeled.';

/** Fill mode — how the entry price is decided. Local dialog state only (no store / limit lifecycle). */
type FillMode = 'manual' | 'market' | 'limit';

/** The entry pre-fill seam. Originally `{ expiration, strike, right }`; extended (FE-execution lane,
 *  UX_BLUEPRINT §5) to also seed qty/stop/target from an AI rec. Every seeded field stays editable.
 *  `provenance`/`sizingNote` are set only for an AI-sourced prefill (render the source chip + sizing
 *  copy); a manual/Prime prefill leaves them undefined. */
export interface EntryPrefill {
  expiration: string;
  strike: number;
  right: OptionRight;
  qty?: number;
  stop?: number | null;
  target?: number | null;
  provenance?: string;
  sizingNote?: string;
}

interface Props {
  open: boolean;
  ticker: string;
  expirations: string[];
  strikes: number[];
  spot: number;
  prefill?: EntryPrefill;
  onClose: () => void;
  onConfirm: (form: NewTradeForm) => void;
}

/** Uppercase caption label above a field (Figma label pattern; not a MUI floating InputLabel). The
 *  text node stays sentence-case (accessible name) and is uppercased visually via CSS. */
function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      sx={{
        display: 'block', mb: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'text.disabled',
      }}
    >
      {children}
    </Typography>
  );
}

export function TradeEntryDialog({ open, ticker, expirations, strikes, spot, prefill, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<FillMode>('manual');
  const [expiration, setExpiration] = useState('');
  const [strike, setStrike] = useState<number | ''>('');
  const [right, setRight] = useState<OptionRight>('call');
  const [qty, setQty] = useState(1);
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>(''); // typed price for manual / limit modes
  const [fill, setFill] = useState<{ mark: number; basis: MarkBasis } | null>(null); // resolved market mid
  const [fillState, setFillState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Reset fields each time the dialog opens (honor the Prime / AI prefill). A strike the prefill
  // names that isn't in the chain list still seeds — the user can adjust to the nearest listed one.
  useEffect(() => {
    if (!open) return;
    const nearest = strikes.length ? strikes.reduce((b, s) => (Math.abs(s - spot) < Math.abs(b - spot) ? s : b), strikes[0]) : '';
    setMode('manual');
    setExpiration(prefill?.expiration || expirations[0] || '');
    setStrike(prefill?.strike ?? nearest);
    setRight(prefill?.right ?? 'call');
    setQty(prefill?.qty && prefill.qty >= 1 ? prefill.qty : 1);
    setStop(prefill?.stop ?? '');
    setTarget(prefill?.target ?? '');
    setPrice('');
    setFill(null);
    setFillState('idle');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the market fill basis from the picked contract (mid → theoretical BS mark). Preserved.
  useEffect(() => {
    if (!open || !expiration || strike === '') return;
    let cancelled = false;
    setFillState('loading');
    fetchTrackedContract(ticker, { expiration, strike: Number(strike), right })
      .then((tc) => {
        if (cancelled) return;
        if (!tc) { setFill(null); setFillState('error'); return; }
        const mid = tc.option_quote?.mid;
        if (mid != null) setFill({ mark: mid, basis: 'snapshot' });
        else if (tc.iv != null) setFill({ mark: bsPrice(right, spot, Number(strike), tc.dte, tc.iv), basis: 'theoretical' });
        else setFill(null);
        setFillState('idle');
      })
      .catch(() => { if (!cancelled) { setFill(null); setFillState('error'); } });
    return () => { cancelled = true; };
  }, [open, ticker, expiration, strike, right, spot]);

  // The emitted mark + basis depend on the active fill mode.
  const typedPrice = price === '' ? null : Number(price);
  const emit = (() => {
    if (mode === 'market') return fill; // auto-resolved mid
    if (typedPrice != null && typedPrice > 0) return { mark: typedPrice, basis: 'manual' as MarkBasis };
    return null;
  })();
  const cost = emit ? emit.mark * 100 * qty : null;
  const canConfirm = emit != null && (mode !== 'market' || fillState !== 'error') && qty >= 1;

  const priceLabel = mode === 'limit' ? 'Limit price' : 'Manual price';

  // Recessed field fill (Figma). Matches BOTH the TextField case (`.MuiOutlinedInput-root` is a
  // descendant) and the bare Select case (the Select root IS `.MuiOutlinedInput-root`, so a descendant
  // selector alone would miss it — include the self-selector).
  const inputSx = {
    '& .MuiOutlinedInput-root, &.MuiOutlinedInput-root': { bgcolor: 'background.default' },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px', border: 1, borderColor: 'divider', backgroundImage: 'none',
            bgcolor: extras.panelRaised,
          },
        },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header — title + SIMULATED (+ provenance) + close. */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexGrow: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Open simulated position · {ticker}
              </Typography>
              <Chip
                size="small" label="SIMULATED" title={SIMULATED_TIP}
                sx={(t) => ({ bgcolor: alpha(t.palette.success.main, 0.18), color: 'success.main', fontWeight: 700, letterSpacing: '0.04em' })}
              />
              {prefill?.provenance && <Chip size="small" color="primary" variant="outlined" label={prefill.provenance} />}
            </Stack>
            <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Fill-mode segmented control. */}
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} fullWidth aria-label="fill mode">
            <ToggleButton value="manual">Manual price</ToggleButton>
            <ToggleButton value="market">Market</ToggleButton>
            <ToggleButton value="limit">Limit</ToggleButton>
          </ToggleButtonGroup>

          {/* Expiration. */}
          <Box>
            <FieldLabel htmlFor="entry-expiration">Expiration</FieldLabel>
            <Select
              id="entry-expiration" size="small" fullWidth value={expiration}
              onChange={(e) => setExpiration(String(e.target.value))} sx={inputSx}
              inputProps={{ 'aria-label': 'Expiration' }}
            >
              {expirations.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </Box>

          {/* Strike. */}
          <Box>
            <FieldLabel htmlFor="entry-strike">Strike</FieldLabel>
            <Select
              id="entry-strike" size="small" fullWidth value={strike === '' ? '' : String(strike)}
              onChange={(e) => setStrike(Number(e.target.value))} sx={inputSx}
              inputProps={{ 'aria-label': 'Strike' }}
            >
              {strikes.map((s) => <MenuItem key={s} value={String(s)}>${s}</MenuItem>)}
            </Select>
          </Box>

          {/* Call / Put — active CALL = success green, active PUT = error red. */}
          <ToggleButtonGroup
            exclusive size="small" value={right} onChange={(_, v) => v && setRight(v)} fullWidth
            sx={{
              '& .MuiToggleButton-root.Mui-selected': { color: 'common.white' },
              '& .MuiToggleButton-root[value="call"].Mui-selected': {
                bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' },
              },
              '& .MuiToggleButton-root[value="put"].Mui-selected': {
                bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' },
              },
            }}
          >
            <ToggleButton value="call">Call</ToggleButton>
            <ToggleButton value="put">Put</ToggleButton>
          </ToggleButtonGroup>

          {/* Quantity. */}
          <Box>
            <FieldLabel htmlFor="entry-qty">Quantity</FieldLabel>
            <TextField
              id="entry-qty" size="small" fullWidth type="number" value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              slotProps={{ htmlInput: { min: 1, 'aria-label': 'Quantity' } }} sx={inputSx}
            />
          </Box>

          {/* Mode-driven price (hidden in Market mode). */}
          {mode !== 'market' && (
            <Box>
              <FieldLabel htmlFor="entry-price">{priceLabel}</FieldLabel>
              <TextField
                id="entry-price" size="small" fullWidth type="number" value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': priceLabel } }} sx={inputSx}
              />
            </Box>
          )}

          {/* Risk plan — editable; seeded from an AI rec's exit_plan when Accepted, blank for a
              manual entry. Not an input to the mark/P-L math (v1); recorded with the trade. */}
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel htmlFor="entry-stop">Stop (optional)</FieldLabel>
              <TextField
                id="entry-stop" size="small" fullWidth type="number" value={stop}
                onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': 'Stop (optional)' } }} sx={inputSx}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldLabel htmlFor="entry-target">Target (optional)</FieldLabel>
              <TextField
                id="entry-target" size="small" fullWidth type="number" value={target}
                onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': 'Target (optional)' } }} sx={inputSx}
              />
            </Box>
          </Stack>

          {prefill?.sizingNote && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{prefill.sizingNote}</Typography>
          )}

          {/* Fill preview. */}
          <Box>
            {mode === 'market' ? (
              fillState === 'error' ? (
                <Typography variant="body2" color="error">Couldn't load the chain for entry — try again.</Typography>
              ) : fill ? (
                <>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    Fill: mid ${fill.mark.toFixed(2)} · Cost ${cost?.toFixed(0)} (mid × 100 × qty)
                  </Typography>
                  {fill.basis === 'theoretical' && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      No live quote — fill will use a theoretical (Black-Scholes) mark.
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a contract to see the fill.</Typography>
              )
            ) : emit ? (
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                {mode === 'limit'
                  ? `Fills at your limit $${emit.mark.toFixed(2)} · Cost $${cost?.toFixed(0)} (price × 100 × qty)`
                  : `Opens at your price $${emit.mark.toFixed(2)} · Cost $${cost?.toFixed(0)} (price × 100 × qty)`}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Enter a {mode === 'limit' ? 'limit' : 'manual'} price to see the fill.
              </Typography>
            )}
          </Box>

          {/* Disclaimer (verbatim). */}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{DISCLAIMER}</Typography>

          {/* Footer. */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
            <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button
              variant="contained" disableElevation disabled={!canConfirm}
              onClick={() => emit && onConfirm({
                expiration, strike: Number(strike), right, qty, entryMark: emit.mark, entryBasis: emit.basis,
                stop: stop === '' ? null : Number(stop), target: target === '' ? null : Number(target),
              })}
            >
              Open simulated position
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
