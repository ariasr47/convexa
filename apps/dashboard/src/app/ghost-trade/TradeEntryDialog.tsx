/**
 * Ghost-trade entry dialog (paper trade — no broker, no real order). Picks a contract, shows the
 * live fill (option mid → cost), and emits a NewTradeForm. Fills at the snapshot mid, or a labeled
 * theoretical mark when no quote exists.
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Stack, Typography,
  FormControl, InputLabel, Select, MenuItem, ToggleButton, ToggleButtonGroup, TextField, Box,
} from '@mui/material';
import { fetchTrackedContract, OptionRight } from '@org/api';
import { bsPrice } from './mark';
import { NewTradeForm } from './useGhostTrade';
import type { MarkBasis } from './types';

const SIMULATED_TIP = 'A paper trade — no broker, no real money, no real order is ever placed.';
const DISCLAIMER =
  'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and ' +
  'assignment are not modeled.';

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

export function TradeEntryDialog({ open, ticker, expirations, strikes, spot, prefill, onClose, onConfirm }: Props) {
  const [expiration, setExpiration] = useState('');
  const [strike, setStrike] = useState<number | ''>('');
  const [right, setRight] = useState<OptionRight>('call');
  const [qty, setQty] = useState(1);
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [fill, setFill] = useState<{ mark: number; basis: MarkBasis } | null>(null);
  const [fillState, setFillState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Reset fields each time the dialog opens (honor the Prime / AI prefill). A strike the prefill
  // names that isn't in the chain list still seeds — the user can adjust to the nearest listed one.
  useEffect(() => {
    if (!open) return;
    const nearest = strikes.length ? strikes.reduce((b, s) => (Math.abs(s - spot) < Math.abs(b - spot) ? s : b), strikes[0]) : '';
    setExpiration(prefill?.expiration || expirations[0] || '');
    setStrike(prefill?.strike ?? nearest);
    setRight(prefill?.right ?? 'call');
    setQty(prefill?.qty && prefill.qty >= 1 ? prefill.qty : 1);
    setStop(prefill?.stop ?? '');
    setTarget(prefill?.target ?? '');
    setFill(null);
    setFillState('idle');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the fill basis from the picked contract.
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

  const cost = fill ? fill.mark * 100 * qty : null;
  const canConfirm = fill != null && fillState !== 'error' && qty >= 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
          <span>Open simulated trade · {ticker}</span>
          <Chip size="small" color="default" variant="outlined" label="SIMULATED" title={SIMULATED_TIP} />
          {prefill?.provenance && <Chip size="small" color="primary" variant="outlined" label={prefill.provenance} />}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
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
          {/* Risk plan — editable; seeded from an AI rec's exit_plan when Accepted, blank for a
              manual entry. Not an input to the mark/P-L math (v1); recorded with the trade. */}
          <Stack direction="row" spacing={2}>
            <TextField
              size="small" type="number" label="Stop (optional)" value={stop}
              onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))} fullWidth
            />
            <TextField
              size="small" type="number" label="Target (optional)" value={target}
              onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))} fullWidth
            />
          </Stack>
          {prefill?.sizingNote && (
            <Typography variant="caption" color="text.secondary">{prefill.sizingNote}</Typography>
          )}
          <Box>
            {fillState === 'error' ? (
              <Typography variant="body2" color="error">Couldn't load the chain for entry — try again.</Typography>
            ) : fill ? (
              <>
                <Typography variant="body2">
                  Fill: mid ${fill.mark.toFixed(2)} · Cost ${cost?.toFixed(0)} (mid × 100 × qty)
                </Typography>
                {fill.basis === 'theoretical' && (
                  <Typography variant="caption" color="text.secondary">
                    No live quote — fill will use a theoretical (Black-Scholes) mark.
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Select a contract to see the fill.</Typography>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">{DISCLAIMER}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" disabled={!canConfirm}
          onClick={() => fill && onConfirm({
            expiration, strike: Number(strike), right, qty, entryMark: fill.mark, entryBasis: fill.basis,
            stop: stop === '' ? null : Number(stop), target: target === '' ? null : Number(target),
          })}
        >
          Open simulated trade
        </Button>
      </DialogActions>
    </Dialog>
  );
}
