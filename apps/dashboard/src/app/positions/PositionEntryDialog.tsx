/**
 * Position entry dialog — the shipped TradeEntryDialog extended to 3 modes (Manual price / Market /
 * Limit), each surfacing an honest, distinct fill-basis preview + label (UX_BLUEPRINT §6 S6).
 * Paper trade only — no broker, no real order. Mocks only the network boundary (`fetchTrackedContract`).
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Stack, Typography,
  FormControl, InputLabel, Select, MenuItem, ToggleButton, ToggleButtonGroup, TextField, Box,
} from '@mui/material';
import { fetchTrackedContract, OptionRight } from '@org/api';
import { bsPrice } from '../ghost-trade/mark';
import { resolveMarketFill } from './entry';
import type { EntryMode, EntryBasis } from './types';
import { SIMULATED_TIP, DISCLAIMER, ENTRY_MODE_LABEL } from './labels';
import type { OpenPositionInput } from './usePortfolio';

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
  onConfirm: (input: OpenPositionInput) => void;
}

export function PositionEntryDialog({ open, ticker, expirations, strikes, spot, prefill, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [expiration, setExpiration] = useState('');
  const [strike, setStrike] = useState<number | ''>('');
  const [right, setRight] = useState<OptionRight>('call');
  const [qty, setQty] = useState(1);
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [manualPrice, setManualPrice] = useState<number | ''>('');
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  // Resolved market/theoretical fill for the picked contract.
  const [marketFill, setMarketFill] = useState<{ mark: number; basis: EntryBasis } | null>(null);
  const [fillState, setFillState] = useState<'idle' | 'loading' | 'error' | 'no_resolvable'>('idle');
  const [contractStatsFailed, setContractStatsFailed] = useState(false);
  // The live mark used by the Limit preview (already-crossable hint).
  const [liveMark, setLiveMark] = useState<number | null>(null);

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
    setManualPrice('');
    setLimitPrice('');
    setMarketFill(null);
    setFillState('idle');
    setContractStatsFailed(false);
    setLiveMark(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the contract stats / market fill from the picked contract.
  useEffect(() => {
    if (!open || !expiration || strike === '') return;
    let cancelled = false;
    setFillState('loading');
    setContractStatsFailed(false);
    fetchTrackedContract(ticker, { expiration, strike: Number(strike), right })
      .then((tc) => {
        if (cancelled) return;
        if (!tc) {
          setContractStatsFailed(true);
          setMarketFill(null);
          setLiveMark(null);
          setFillState('no_resolvable'); // 404 / not in snapshot
          return;
        }
        const fill = resolveMarketFill(tc, spot, right, Number(strike));
        const mid = tc.option_quote?.mid ?? (tc.iv != null ? bsPrice(right, spot, Number(strike), tc.dte, tc.iv) : null);
        setLiveMark(mid);
        if (!fill) { setMarketFill(null); setFillState('no_resolvable'); return; }
        setMarketFill(fill);
        setFillState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setContractStatsFailed(true);
        setMarketFill(null);
        setLiveMark(null);
        setFillState('error');
      });
    return () => { cancelled = true; };
  }, [open, ticker, expiration, strike, right, spot]);

  const baseInput = () => ({
    ticker, expiration, strike: Number(strike), right, qty,
    stop: stop === '' ? null : Number(stop), target: target === '' ? null : Number(target),
  });

  // ---- Confirm guards per mode ---------------------------------------------------------------
  const canConfirm = (() => {
    if (strike === '' || !expiration || qty < 1) return false;
    if (mode === 'manual') return manualPrice !== '' && Number(manualPrice) > 0;
    if (mode === 'market') return marketFill != null && fillState === 'idle';
    if (mode === 'limit') return limitPrice !== '' && Number(limitPrice) > 0;
    return false;
  })();

  const confirmLabel = mode === 'limit' ? 'Place limit order' : 'Open simulated position';

  const handleConfirm = () => {
    const b = baseInput();
    if (mode === 'manual') {
      onConfirm({ ...b, entryMode: 'manual', price: Number(manualPrice) });
    } else if (mode === 'market' && marketFill) {
      onConfirm({ ...b, entryMode: 'market', resolvedMark: marketFill.mark, resolvedBasis: marketFill.basis });
    } else if (mode === 'limit') {
      onConfirm({ ...b, entryMode: 'limit', limitPrice: Number(limitPrice) });
    }
  };

  const manualCost = manualPrice !== '' ? Number(manualPrice) * 100 * qty : null;
  const marketCost = marketFill ? marketFill.mark * 100 * qty : null;
  const alreadyCrossable = liveMark != null && limitPrice !== '' && liveMark <= Number(limitPrice);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
          <span>Open simulated position · {ticker}</span>
          <Chip size="small" color="default" variant="outlined" label="SIMULATED" title={SIMULATED_TIP} />
          {prefill?.provenance && <Chip size="small" color="primary" variant="outlined" label={prefill.provenance} />}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {/* Mode toggle. */}
          <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} fullWidth aria-label="entry mode">
            <ToggleButton value="manual">{ENTRY_MODE_LABEL.manual} price</ToggleButton>
            <ToggleButton value="market">{ENTRY_MODE_LABEL.market}</ToggleButton>
            <ToggleButton value="limit">{ENTRY_MODE_LABEL.limit}</ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" fullWidth>
            <InputLabel>Expiration</InputLabel>
            <Select label="Expiration" value={expiration} onChange={(e) => setExpiration(String(e.target.value))}>
              {expirations.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Strike</InputLabel>
            <Select label="Strike" value={strike === '' ? '' : String(strike)} onChange={(e) => setStrike(Number(e.target.value))}>
              {strikes.map((s) => <MenuItem key={s} value={String(s)}>${s}</MenuItem>)}
            </Select>
          </FormControl>
          <ToggleButtonGroup exclusive size="small" value={right} onChange={(_, v) => v && setRight(v)} fullWidth>
            <ToggleButton value="call">Call</ToggleButton>
            <ToggleButton value="put">Put</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small" type="number" label="Quantity" value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            slotProps={{ htmlInput: { min: 1 } }}
          />

          {/* Mode-specific price fields. */}
          {mode === 'manual' && (
            <TextField
              size="small" type="number" label="Manual price" value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          )}
          {mode === 'limit' && (
            <TextField
              size="small" type="number" label="Limit price" value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          )}

          {/* Risk plan (optional). */}
          <Stack direction="row" spacing={2}>
            <TextField size="small" type="number" label="Stop (optional)" value={stop}
              onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))} fullWidth />
            <TextField size="small" type="number" label="Target (optional)" value={target}
              onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))} fullWidth />
          </Stack>
          {prefill?.sizingNote && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{prefill.sizingNote}</Typography>}

          {/* Fill preview per mode. */}
          <Box>
            {fillState === 'loading' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a contract to see the fill.</Typography>
            ) : fillState === 'error' ? (
              <Typography variant="body2" color="error">Couldn't load the chain for entry — try again.</Typography>
            ) : mode === 'manual' ? (
              <>
                <Typography variant="body2">
                  {manualPrice === ''
                    ? 'Enter a price — opens at exactly the price you type.'
                    : `Opens at your price $${Number(manualPrice).toFixed(2)} · Cost $${manualCost?.toFixed(0)} — user-entered, not a market quote.`}
                </Typography>
                <Chip size="small" variant="outlined" sx={{ mt: 0.5 }} label="user-entered price" />
                {contractStatsFailed && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    Contract stats unavailable — your entry still works.
                  </Typography>
                )}
              </>
            ) : mode === 'market' ? (
              fillState === 'no_resolvable' ? (
                <Typography variant="body2" color="error">
                  No quote or theoretical mark available for this contract — a market order can't fill. Try Manual price, or pick another contract.
                </Typography>
              ) : marketFill ? (
                <>
                  <Typography variant="body2">
                    Fill: mid ${marketFill.mark.toFixed(2)} · Cost ${marketCost?.toFixed(0)} (mid × 100 × qty)
                  </Typography>
                  <Chip size="small" variant="outlined" sx={{ mt: 0.5 }}
                    label={marketFill.basis === 'theoretical' ? 'theoretical' : 'snapshot mid'} />
                  {marketFill.basis === 'theoretical' && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      No live quote — fill will use a theoretical (Black-Scholes) mark.
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a contract to see the fill.</Typography>
              )
            ) : ( // limit
              <>
                <Typography variant="body2">
                  {limitPrice === ''
                    ? 'Enter a limit price.'
                    : `Rests until the live mark reaches $${Number(limitPrice).toFixed(2)}, then fills at $${Number(limitPrice).toFixed(2)}. Stays cancellable until it fills.`}
                </Typography>
                {alreadyCrossable && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    The live mark is already at or below your limit — this will fill on the next live tick.
                  </Typography>
                )}
              </>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{DISCLAIMER}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canConfirm} onClick={handleConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
