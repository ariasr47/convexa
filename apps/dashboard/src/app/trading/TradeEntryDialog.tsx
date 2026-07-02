/**
 * TradeEntryDialog — the ONE shared sim-entry dialog (sim-entry-unification, owner items 2+3).
 * Used by BOTH launch sites:
 *   - Ticker page (`ticker/TickerDashboard.tsx`) → `useGhostTrade.openTrade` (single-trade engine);
 *   - Positions page (`positions/PositionsPanel.tsx`) → the server-gated `usePortfolio.openPosition`.
 *
 * Skin/structure are the REDESIGNED ghost-trade dialog (Figma 118:1446): a 400px panel-raised slate
 * dialog (`extrasFor(theme).panelRaised` — theme-native, zero hardcoded hex), uppercase field labels,
 * a Manual price / Market / Limit fill-mode segmented control, mandatory confirm, `SIMULATED` chip.
 *
 * Capabilities absorbed from the old `positions/PositionEntryDialog.tsx`:
 *   - the honest per-mode fill-basis preview + chips (`user-entered price` / `snapshot mid` /
 *     `theoretical`), driven by the EXISTING resolver (`positions/entry.ts` — not rewritten here);
 *   - the richer degraded states: `no_resolvable` (market can't fill — no quote AND no theoretical
 *     mark) vs transport `error`, plus the manual-mode "contract stats unavailable" caption;
 *   - mode-scoped price fields (a typed Manual price and a typed Limit price are remembered
 *     independently across mode switches);
 *   - resting-limit semantics (`restingLimit`): the Positions host implements the `pending →
 *     filled/cancelled` lifecycle, so the dialog labels the confirm "Place limit order" and previews
 *     the resting behavior + the already-crossable hint. The Ticker host's single-trade engine has no
 *     resting lifecycle, so without `restingLimit` a limit opens immediately at your price (the
 *     shipped ghost-trade behavior, preserved).
 *
 * SIMULATED everywhere — paper only, no broker, no real order path (`[no-real-order-path]`). The
 * dialog performs no write itself: it emits a mode-tagged `TradeEntrySubmit` and the host owns the
 * (server-gated, on Positions) write. No new/changed API call: the only network touch is the
 * EXISTING `GET /api/contract` lookup (`fetchTrackedContract`) both old dialogs already made.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Dialog, DialogContent, Button, Chip, Stack, Typography, Select, MenuItem, ToggleButton,
  ToggleButtonGroup, TextField, Box, IconButton, Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { fetchTrackedContract, OptionRight } from '@org/api';
import { resolveMarketFill, type ResolvedFill } from '../positions/entry';
import { SIMULATED_TIP, DISCLAIMER } from '../positions/labels';
import { extrasFor } from '../tokens';
import type { Trigger } from '../orders/types';
import { triggerMet } from '../orders/engine';
import {
  DIALOG_TITLE as ORDER_DIALOG_TITLE, provenanceAiRead, provenanceScenario, dialogScenarioStrip,
  staleRecDisclosure, alreadyMetNotice, simulatedDisclosure, TRIGGER_LABEL, TRIGGER_SEED_CHIP,
  TRIGGER_NO_SEED_HELPER, TRIGGER_EMPTY_HELPER, REC_WORDS_LABEL, REC_NO_TRIGGER_TEXT,
  ENTRY_PRICE_LIMIT, ENTRY_PRICE_MARKET, LIMIT_HELPER, MARKET_HELPER, STOP_TARGET_HELPER,
  GOOD_TIL_LABEL, GOOD_TIL_HELPER, GOOD_TIL_VALIDATION, CONFIRM_LABEL as ORDER_CONFIRM_LABEL,
} from '../orders/copy';

/** Fill mode — how the entry price is decided. Local dialog state only (no store / lifecycle). */
export type FillMode = 'manual' | 'market' | 'limit';

/** The two bases a MARKET fill can resolve to (`resolveMarketFill` returns nothing else). */
export type MarketFillBasis = 'snapshot' | 'theoretical';

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

/** Common facts every confirm carries (the contract + risk plan). */
interface SubmitBase {
  ticker: string;
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
  stop: number | null;
  target: number | null;
}

/**
 * The mode-tagged confirm payload. Structurally a `positions/usePortfolio.OpenPositionInput`, so the
 * Positions host passes it straight through; the Ticker host maps it onto a ghost-trade
 * `NewTradeForm` (manual/limit → the typed price with basis `manual`; market → the resolved fill).
 */
export type TradeEntrySubmit =
  | (SubmitBase & { entryMode: 'manual'; price: number })
  | (SubmitBase & { entryMode: 'market'; resolvedMark: number; resolvedBasis: MarketFillBasis })
  | (SubmitBase & { entryMode: 'limit'; limitPrice: number });

// ---- ai-rec-backtest-orders: the additive ORDER VARIANT seam (UX §3) ----------------------------
// Host-passed. ABSENT ⇒ the dialog is byte-identical to shipped (protects AC-47/48). Present ⇒ the
// order-creation confirm: trigger section + verbatim-words block, the 2-option entry-price control
// (Limit / Market on trigger), the never-blank good-til, the notice strips, the D8-1 disclosure,
// and the "Place simulated order" confirm. The dialog still performs NO write — the host owns the
// (server-gated) order store write.

/** What the Act flow seeds into the order variant (D2/D3 + the D7/D8 strips). */
export interface OrderPlan {
  /** D2 seed — null ⇒ the empty-seed state (nothing guessed, AC-6). */
  seededTrigger: Trigger | null;
  /** The rec's verbatim `entry_trigger` text — ALWAYS displayed (product constraint §7). */
  triggerSourceText: string | null;
  provenance: {
    source: 'ai_rec' | 'ai_scenario';
    personaName: string;
    asOf: string | null;
    scenarioName?: string;
  };
  /** Newer bundle since the rec's pin ⇒ the D8-5 strip (proceed allowed, AC-10). */
  stale: boolean;
  /** The CURRENT live underlying mid (null when not live) — drives the D8-2 already-met notice,
   *  re-evaluated LIVE as the user edits the trigger. */
  liveMid: number | null;
}

/** The order-variant confirm payload (the host persists it via the gated orders-store write). */
export interface OrderEntrySubmit extends SubmitBase {
  trigger: Trigger | null;
  /** null ⇒ market-on-trigger. */
  limitPrice: number | null;
  /** ISO instant of the good-til bound (end of the chosen day) — never blank (AC-8). */
  expiresAt: string;
  /** The good-til calendar date (YYYY-MM-DD) as chosen. */
  goodTilDate: string;
}

/** D3 default: min(now + 7 days, contract expiration), as a YYYY-MM-DD local date. */
export function defaultGoodTil(expiration: string, now: Date = new Date()): string {
  const plus7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const y = plus7.getFullYear();
  const m = String(plus7.getMonth() + 1).padStart(2, '0');
  const d = String(plus7.getDate()).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  return expiration && iso > expiration ? expiration : iso;
}

/** Local YYYY-MM-DD for "today" (the good-til lower bound). */
function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** End-of-day ISO instant for a YYYY-MM-DD good-til date (the durable `expires_at`). */
export function goodTilToExpiresAt(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

interface Props {
  open: boolean;
  ticker: string;
  expirations: string[];
  strikes: number[];
  spot: number;
  prefill?: EntryPrefill;
  /** True when the HOST implements the resting-limit `pending → filled/cancelled` lifecycle
   *  (Positions). Controls the limit-mode copy + confirm label ONLY — the emitted payload is the same
   *  mode-tagged union either way. Absent (Ticker), a limit opens immediately at your price. */
  restingLimit?: boolean;
  /** ai-rec-backtest-orders: the additive order-variant seam. Absent ⇒ byte-identical to shipped. */
  orderPlan?: OrderPlan;
  /** Order-variant confirm (required when `orderPlan` is passed). */
  onConfirmOrder?: (submit: OrderEntrySubmit) => void;
  /** Inline error surfaced by the host on a refused order write (the §4.6 faulted-store title). */
  orderError?: string | null;
  onClose: () => void;
  onConfirm: (submit: TradeEntrySubmit) => void;
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

export function TradeEntryDialog({
  open, ticker, expirations, strikes, spot, prefill, restingLimit = false,
  orderPlan, onConfirmOrder, orderError, onClose, onConfirm,
}: Props) {
  const [mode, setMode] = useState<FillMode>('manual');
  const [expiration, setExpiration] = useState('');
  const [strike, setStrike] = useState<number | ''>('');
  const [right, setRight] = useState<OptionRight>('call');
  const [qty, setQty] = useState(1);
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [manualPrice, setManualPrice] = useState<number | ''>('');
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  // Resolved market/theoretical fill for the picked contract (the EXISTING entry resolver).
  const [marketFill, setMarketFill] = useState<ResolvedFill | null>(null);
  const [fillState, setFillState] = useState<'idle' | 'loading' | 'error' | 'no_resolvable'>('idle');
  const [contractStatsFailed, setContractStatsFailed] = useState(false);
  // ---- Order-variant state (inert unless `orderPlan` is passed) --------------------------------
  const isOrder = orderPlan != null;
  const [trigDirection, setTrigDirection] = useState<'above' | 'below'>('above');
  const [trigLevel, setTrigLevel] = useState<number | ''>('');
  const [priceMode, setPriceMode] = useState<'market' | 'limit'>('market');
  const [goodTil, setGoodTil] = useState('');

  // Reset fields each time the dialog opens (honor the Prime / AI prefill). A strike the prefill
  // names that isn't in the chain list still seeds — the user can adjust to the nearest listed one.
  useEffect(() => {
    if (!open) return;
    const nearest = strikes.length ? strikes.reduce((b, s) => (Math.abs(s - spot) < Math.abs(b - spot) ? s : b), strikes[0]) : '';
    const exp = prefill?.expiration || expirations[0] || '';
    setMode('manual');
    setExpiration(exp);
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
    // Order variant: D2 trigger seed (or empty), Market-on-trigger default (the rec schema states
    // no contract premium — honest default, UX §3.1.6), the D3 good-til default.
    if (orderPlan) {
      setTrigDirection(orderPlan.seededTrigger?.kind === 'underlying_below' ? 'below' : 'above');
      setTrigLevel(orderPlan.seededTrigger?.level ?? '');
      setPriceMode('market');
      setGoodTil(defaultGoodTil(exp));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the contract stats / market fill from the picked contract (mid → theoretical BS mark via
  // the shared resolver). Best-effort: a lookup failure only degrades THIS preview, never the app.
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
          setFillState('no_resolvable'); // 404 / not in snapshot
          return;
        }
        const fill = resolveMarketFill(tc, spot, right, Number(strike));
        if (!fill) { setMarketFill(null); setFillState('no_resolvable'); return; }
        setMarketFill(fill);
        setFillState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setContractStatsFailed(true);
        setMarketFill(null);
        setFillState('error');
      });
    return () => { cancelled = true; };
  }, [open, ticker, expiration, strike, right, spot]);

  // ---- Derived previews / guards per mode ------------------------------------------------------
  const manualCost = manualPrice !== '' ? Number(manualPrice) * 100 * qty : null;
  const marketCost = marketFill ? marketFill.mark * 100 * qty : null;
  const limitCost = limitPrice !== '' ? Number(limitPrice) * 100 * qty : null;
  // The live-mark hint for the Limit preview: the same resolved mid/theoretical mark the market fill
  // uses (resolveMarketFill is the single source of that value).
  const liveMark = marketFill?.mark ?? null;
  const alreadyCrossable = liveMark != null && limitPrice !== '' && liveMark <= Number(limitPrice);

  // ---- Order-variant derivations (all inert when `orderPlan` is absent) -------------------------
  // The structured trigger the confirm would arm: set only when a numeric level is present.
  const orderTrigger: Trigger | null = isOrder && trigLevel !== '' && Number(trigLevel) > 0
    ? { kind: trigDirection === 'above' ? 'underlying_above' : 'underlying_below', level: Number(trigLevel) }
    : null;
  // D8-2 — appears/disappears LIVE as the user edits the trigger against the current live mid.
  const alreadyMet = isOrder && orderPlan.liveMid != null && orderTrigger != null
    && triggerMet(orderTrigger, orderPlan.liveMid);
  // D3 good-til validation: after now, no later than the contract's expiration; never blank (AC-8).
  const goodTilInvalid = isOrder && (goodTil === '' || goodTil < todayIso() || (expiration !== '' && goodTil > expiration));

  const canConfirm = (() => {
    if (strike === '' || !expiration || qty < 1) return false;
    if (isOrder) {
      if (goodTilInvalid) return false;
      if (priceMode === 'limit') return limitPrice !== '' && Number(limitPrice) > 0;
      return true; // market-on-trigger needs no price
    }
    if (mode === 'manual') return manualPrice !== '' && Number(manualPrice) > 0;
    if (mode === 'market') return marketFill != null && fillState === 'idle';
    return limitPrice !== '' && Number(limitPrice) > 0; // limit
  })();

  // "Place limit order" only when the host actually rests the order (Positions lifecycle).
  const confirmLabel = isOrder
    ? ORDER_CONFIRM_LABEL
    : restingLimit && mode === 'limit' ? 'Place limit order' : 'Open simulated position';
  const priceLabel = mode === 'limit' ? 'Limit price' : 'Manual price';

  const handleConfirm = () => {
    if (strike === '' || !expiration) return;
    const base: SubmitBase = {
      ticker, expiration, strike: Number(strike), right, qty,
      stop: stop === '' ? null : Number(stop), target: target === '' ? null : Number(target),
    };
    if (isOrder) {
      if (goodTilInvalid) return;
      onConfirmOrder?.({
        ...base,
        trigger: orderTrigger,
        limitPrice: priceMode === 'limit' && limitPrice !== '' ? Number(limitPrice) : null,
        expiresAt: goodTilToExpiresAt(goodTil),
        goodTilDate: goodTil,
      });
      return;
    }
    if (mode === 'manual' && manualPrice !== '') {
      onConfirm({ ...base, entryMode: 'manual', price: Number(manualPrice) });
    } else if (mode === 'market' && marketFill) {
      // Safe narrow: `resolveMarketFill` only ever returns `snapshot` or `theoretical`.
      onConfirm({ ...base, entryMode: 'market', resolvedMark: marketFill.mark, resolvedBasis: marketFill.basis as MarketFillBasis });
    } else if (mode === 'limit' && limitPrice !== '') {
      onConfirm({ ...base, entryMode: 'limit', limitPrice: Number(limitPrice) });
    }
  };

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
            bgcolor: (theme) => extrasFor(theme).panelRaised,
          },
        },
      }}
    >
      <DialogContent data-testid="trade-entry-dialog" sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header — title + SIMULATED (+ provenance) + close. */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Stack direction="row" spacing={1} sx={{ flexGrow: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {isOrder ? ORDER_DIALOG_TITLE : `Open simulated position · ${ticker}`}
              </Typography>
              <Chip
                size="small" label="SIMULATED" title={SIMULATED_TIP}
                sx={(t) => ({ bgcolor: alpha(t.palette.success.main, 0.18), color: 'success.main', fontWeight: 700, letterSpacing: '0.04em' })}
              />
              {!isOrder && prefill?.provenance && <Chip size="small" color="primary" variant="outlined" label={prefill.provenance} />}
            </Stack>
            <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* ORDER VARIANT — notice strips (each only when applicable, §3.1-2 order) + provenance. */}
          {isOrder && (
            <>
              {orderPlan.provenance.source === 'ai_scenario' && (
                <Alert severity="warning" sx={{ py: 0 }} data-testid="order-scenario-strip">
                  {dialogScenarioStrip(orderPlan.provenance.scenarioName ?? 'scenario')}
                </Alert>
              )}
              {orderPlan.stale && (
                <Alert severity="warning" sx={{ py: 0 }} data-testid="order-stale-strip">
                  {staleRecDisclosure(orderPlan.provenance.asOf)}
                </Alert>
              )}
              {alreadyMet && orderTrigger && (
                <Alert severity="info" sx={{ py: 0 }} data-testid="order-already-met">
                  {alreadyMetNotice(ticker, trigDirection, orderTrigger.level)}
                </Alert>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }} data-testid="order-provenance-line">
                {orderPlan.provenance.source === 'ai_scenario'
                  ? provenanceScenario(orderPlan.provenance.scenarioName ?? 'scenario')
                  : provenanceAiRead(orderPlan.provenance.personaName, orderPlan.provenance.asOf)}
              </Typography>
            </>
          )}

          {/* Fill-mode segmented control (shipped 3-mode — replaced by the 2-option entry-price
              control in the ORDER VARIANT ONLY, §3.1-6). */}
          {!isOrder && (
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} fullWidth aria-label="fill mode">
              <ToggleButton value="manual">Manual price</ToggleButton>
              <ToggleButton value="market">Market</ToggleButton>
              <ToggleButton value="limit">Limit</ToggleButton>
            </ToggleButtonGroup>
          )}

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

          {/* ORDER VARIANT — the entry trigger section (§3.1-5). */}
          {isOrder && (
            <Box data-testid="order-trigger-section">
              <FieldLabel htmlFor="order-trigger-level">{TRIGGER_LABEL}</FieldLabel>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Select
                  size="small" value={trigDirection}
                  onChange={(e) => setTrigDirection(e.target.value as 'above' | 'below')}
                  inputProps={{ 'aria-label': 'Trigger direction' }} sx={{ ...inputSx, minWidth: 110 }}
                >
                  <MenuItem value="above">Above</MenuItem>
                  <MenuItem value="below">Below</MenuItem>
                </Select>
                <TextField
                  id="order-trigger-level" size="small" fullWidth type="number" value={trigLevel}
                  onChange={(e) => setTrigLevel(e.target.value === '' ? '' : Number(e.target.value))}
                  slotProps={{ htmlInput: { 'aria-label': 'Trigger level' } }} sx={inputSx}
                />
                {orderPlan.seededTrigger && (
                  <Chip size="small" color="primary" variant="outlined" label={TRIGGER_SEED_CHIP} data-testid="order-seed-chip" />
                )}
              </Stack>
              {/* Seed-policy helpers (D2): no parseable level ⇒ nothing pre-filled; empty ⇒ arms
                  immediately. */}
              {!orderPlan.seededTrigger && trigLevel === '' && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }} data-testid="order-no-seed-helper">
                  {TRIGGER_NO_SEED_HELPER}
                </Typography>
              )}
              {orderPlan.seededTrigger && trigLevel === '' && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {TRIGGER_EMPTY_HELPER}
                </Typography>
              )}
              {/* The rec's verbatim words — ALWAYS shown beneath the trigger fields (§3.1-5). */}
              <Box sx={{ mt: 1 }}>
                <FieldLabel>{REC_WORDS_LABEL}</FieldLabel>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }} data-testid="order-verbatim-words">
                  {orderPlan.triggerSourceText ? `“${orderPlan.triggerSourceText}”` : REC_NO_TRIGGER_TEXT}
                </Typography>
              </Box>
            </Box>
          )}

          {/* ORDER VARIANT — the 2-option entry-price control (§3.1-6). */}
          {isOrder && (
            <Box data-testid="order-entry-price-section">
              <ToggleButtonGroup
                exclusive size="small" fullWidth value={priceMode}
                onChange={(_, v) => v && setPriceMode(v)} aria-label="entry price"
              >
                <ToggleButton value="limit">{ENTRY_PRICE_LIMIT}</ToggleButton>
                <ToggleButton value="market">{ENTRY_PRICE_MARKET}</ToggleButton>
              </ToggleButtonGroup>
              {priceMode === 'limit' && (
                <TextField
                  size="small" fullWidth type="number" value={limitPrice} sx={{ ...inputSx, mt: 1 }}
                  onChange={(e) => setLimitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  slotProps={{ htmlInput: { 'aria-label': 'Limit price' } }}
                />
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                {priceMode === 'limit' ? LIMIT_HELPER : MARKET_HELPER}
              </Typography>
            </Box>
          )}

          {/* Mode-scoped price (hidden in Market mode). Manual and Limit keep separate typed values. */}
          {!isOrder && mode !== 'market' && (
            <Box>
              <FieldLabel htmlFor="entry-price">{priceLabel}</FieldLabel>
              <TextField
                id="entry-price" size="small" fullWidth type="number"
                value={mode === 'limit' ? limitPrice : manualPrice}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' as const : Number(e.target.value);
                  if (mode === 'limit') setLimitPrice(v); else setManualPrice(v);
                }}
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

          {isOrder && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>{STOP_TARGET_HELPER}</Typography>
          )}

          {/* ORDER VARIANT — the never-blank good-til bound (§3.1-8, AC-8). */}
          {isOrder && (
            <Box data-testid="order-good-til-section">
              <FieldLabel htmlFor="order-good-til">{GOOD_TIL_LABEL}</FieldLabel>
              <TextField
                id="order-good-til" size="small" fullWidth type="date" value={goodTil}
                onChange={(e) => setGoodTil(e.target.value)}
                error={goodTilInvalid}
                helperText={goodTilInvalid ? GOOD_TIL_VALIDATION : GOOD_TIL_HELPER}
                slotProps={{ htmlInput: { 'aria-label': 'Good-til' } }} sx={inputSx}
              />
            </Box>
          )}

          {/* ORDER VARIANT — contract-stats degraded caption (per-row isolation; plan editable). */}
          {isOrder && contractStatsFailed && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Contract stats unavailable — your entry still works.
            </Typography>
          )}

          {prefill?.sizingNote && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{prefill.sizingNote}</Typography>
          )}

          {/* Fill preview — per mode, honest about the basis (S6). Not part of the order variant
              (an order fills LATER, on live crosses — the §3.1-6 helpers state the semantics). */}
          {!isOrder && (
          <Box>
            {fillState === 'loading' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a contract to see the fill.</Typography>
            ) : fillState === 'error' ? (
              <Typography variant="body2" color="error">Couldn't load the chain for entry — try again.</Typography>
            ) : mode === 'manual' ? (
              <>
                <Typography variant="body2" sx={{ color: manualPrice === '' ? 'text.secondary' : 'text.primary' }}>
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
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    Fill: mid ${marketFill.mark.toFixed(2)} · Cost ${marketCost?.toFixed(0)} (mid × 100 × qty)
                  </Typography>
                  <Chip
                    size="small" variant="outlined" sx={{ mt: 0.5 }}
                    label={marketFill.basis === 'theoretical' ? 'theoretical' : 'snapshot mid'}
                  />
                  {marketFill.basis === 'theoretical' && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      No live quote — fill will use a theoretical (Black-Scholes) mark.
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a contract to see the fill.</Typography>
              )
            ) : restingLimit ? (
              // Limit — the host rests it `pending` and fills only on a LIVE cross (Positions).
              <>
                <Typography variant="body2" sx={{ color: limitPrice === '' ? 'text.secondary' : 'text.primary' }}>
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
            ) : (
              // Limit — immediate open at your price (Ticker: no resting lifecycle in the engine).
              <Typography variant="body2" sx={{ color: limitPrice === '' ? 'text.secondary' : 'text.primary' }}>
                {limitPrice === ''
                  ? 'Enter a limit price to see the fill.'
                  : `Fills at your limit $${Number(limitPrice).toFixed(2)} · Cost $${limitCost?.toFixed(0)} (price × 100 × qty)`}
              </Typography>
            )}
          </Box>
          )}

          {/* ORDER VARIANT — a refused order write (faulted store) surfaces inline; nothing partial. */}
          {isOrder && orderError && (
            <Alert severity="warning" data-testid="order-inline-error">
              <Typography variant="subtitle2">{orderError}</Typography>
            </Alert>
          )}

          {/* Disclaimer — shipped verbatim, or the mandatory D8-1 SIMULATED disclosure in the order
              variant (always visible above the confirm, §3.1-9). */}
          <Typography variant="caption" sx={{ color: 'text.secondary' }} data-testid={isOrder ? 'order-simulated-disclosure' : undefined}>
            {isOrder ? simulatedDisclosure(ticker) : DISCLAIMER}
          </Typography>

          {/* Footer. */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
            <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button variant="contained" disableElevation disabled={!canConfirm} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
