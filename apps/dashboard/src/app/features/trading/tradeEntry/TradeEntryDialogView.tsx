/**
 * TradeEntryDialog — the ONE shared sim-entry dialog (sim-entry-unification, owner items 2+3).
 * Used by BOTH launch sites:
 *   - Ticker page (`ticker/TickerDashboard.tsx`) → `usePortfolio.openPosition`, single-leg variant
 *     (no `multiLeg`, no `restingLimit`) — the page has no resting-limit lifecycle of its own;
 *   - Positions page (`positions/PositionsPanel.tsx`) → the server-gated `usePortfolio.openPosition`.
 *
 * Both write into the ONE book (`convexa.positions.v3`) through the SAME function: the v3 cutover
 * deleted the Ticker page's separate ghost-trade engine, so a trader cannot produce two competing
 * records of one trade (AC-72). A single-leg entry is a one-element `legs` array — one open path.
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
import {
  alreadyMetNotice,
  dialogScenarioStrip,
  ENTRY_PRICE_LIMIT,
  ENTRY_PRICE_MARKET,
  GOOD_TIL_HELPER,
  GOOD_TIL_LABEL,
  GOOD_TIL_VALIDATION,
  LIMIT_HELPER,
  MARKET_HELPER,
  CONFIRM_LABEL as ORDER_CONFIRM_LABEL,
  DIALOG_TITLE as ORDER_DIALOG_TITLE,
  provenanceAiRead,
  provenanceScenario,
  REC_NO_TRIGGER_TEXT,
  REC_WORDS_LABEL,
  simulatedDisclosure,
  staleRecDisclosure,
  STOP_TARGET_HELPER,
  TRIGGER_EMPTY_HELPER,
  TRIGGER_LABEL,
  TRIGGER_NO_SEED_HELPER,
  TRIGGER_SEED_CHIP,
} from '@/features/trading/orders/copy';
import { triggerMet } from '@/features/trading/orders/engine';
import type { Trigger } from '@/features/trading/orders/types';
import { resolveMarketFill, type ResolvedFill } from '@/features/trading/positions/entry';
import {
  DIALOG_NET_COMPUTED,
  DIALOG_NET_INCOMPLETE,
  DISCLAIMER,
  netEntryPhrase,
  SIMULATED_TIP,
} from '@/features/trading/positions/labels';
import { netEntryCost, type Leg, type SimPosition } from '@/features/trading/positions/leg';
import { STRUCTURE_LABELS, structureKindOf } from '@/features/trading/positions/structure';
import type { LegInput } from '@/features/trading/positions/usePortfolio';
import { marketDataOff } from '@/shared/dataState/marketData';
import { useMarketDataMode } from '@/shared/hooks/useMarketDataMode';
import { downText, extrasFor, upText } from '@/shared/theme/tokens';
import { dataMode, demoNowMs, fetchTrackedContract } from '@convexa/api';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState, type ReactNode } from 'react';
import { FieldLabel } from './FieldLabel';
import { FillModeToggle } from './FillModeToggle';
import { LegFields, multiplierFor } from './LegFields';
import {
  checkManualEntry,
  MANUAL_ENTRY_COPY,
  newYorkDateIso,
  normalizeUnderlying,
  underlyingError,
} from './manualContract';
import {
  defaultGoodTil,
  goodTilToExpiresAt,
  newDraft,
  todayIso,
  type EntryPrefill,
  type FillMode,
  type LegDraft,
  type MarketFillBasis,
  type OrderEntrySubmit,
  type OrderPlan,
  type SubmitBase,
  type TradeEntrySubmit,
} from './types';

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
  /**
   * THE SIM MULTI-LEG VARIANT (SPEC §4 Flows 1, AC-4..AC-13). Enables leg rows: add/remove, a
   * per-leg Buy/Sell control, a per-leg instrument kind, and per-leg prices.
   *
   * ONLY a host that persists a `SimPosition` may turn this on. The Ticker page's single-trade
   * ghost engine can hold neither a second leg nor a short side, so it leaves this OFF and the
   * dialog is byte-identical to shipped there; it joins at the F18 cutover, when that page starts
   * writing through `usePortfolio`. This is a SIM capability flag and nothing else — a real-money
   * entry surface is a structurally separate component, not a third value of a mode here.
   */
  multiLeg?: boolean;
  /** ai-rec-backtest-orders: the additive order-variant seam. Absent ⇒ byte-identical to shipped. */
  orderPlan?: OrderPlan;
  /** Order-variant confirm (required when `orderPlan` is passed). */
  onConfirmOrder?: (submit: OrderEntrySubmit) => void;
  /** Inline error surfaced by the host on a refused order write (the §4.6 faulted-store title). */
  orderError?: string | null;
  /**
   * tradeable-rec-inputs (SPEC §4): the cap-check annotation, ALREADY RENDERED by the host from the
   * pinned `cap_check` verdict — this dialog performs NO cap computation of its own (the shared
   * `TradeEntryDialog` receives the verdict + numbers as props and never recomputes them, so two
   * computations of one verdict can never disagree). Absent on a manual/Prime entry with no rec, and
   * on a `no_trade` verdict the host passes nothing (the four-field `—` already said so once).
   */
  capAnnotation?: ReactNode;
  onClose: () => void;
  onConfirm: (submit: TradeEntrySubmit) => void;
}

export function TradeEntryDialog({
  open,
  ticker,
  expirations,
  strikes,
  spot,
  prefill,
  restingLimit = false,
  multiLeg = false,
  orderPlan,
  onConfirmOrder,
  orderError,
  capAnnotation,
  onClose,
  onConfirm,
}: Props) {
  const marketDataMode = useMarketDataMode();
  // Phones get a full-screen sheet (this form has many fields); tablets+ keep the centered dialog.
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [mode, setMode] = useState<FillMode>('manual');
  // THE LEG DRAFTS. Seeded to exactly ONE row, so the single-leg path is byte-identical to shipped;
  // a multi-leg entry is the SAME array with more elements — never a second dialog, never a spread
  // builder, never a wizard (`[single-shared-sim-entry-dialog]`, AC-8).
  const [legs, setLegs] = useState<LegDraft[]>(() => [newDraft()]);
  const head = legs[0];
  const patchLeg = (index: number, patch: Partial<LegDraft>) =>
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  // The first leg's contract facts drive the shipped single-contract resolver + the ORDER variant,
  // both of which are single-option by construction.
  const expiration = head.expiration;
  const strike = head.strike;
  const right = head.right;
  const qty = head.qty;
  const [stop, setStop] = useState<number | ''>('');
  const [target, setTarget] = useState<number | ''>('');
  const [manualPrice, setManualPrice] = useState<number | ''>('');
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  // Resolved market/theoretical fill for the picked contract (the EXISTING entry resolver).
  const [marketFill, setMarketFill] = useState<ResolvedFill | null>(null);
  const [fillState, setFillState] = useState<'idle' | 'loading' | 'error' | 'no_resolvable'>(
    'idle',
  );
  const [contractStatsFailed, setContractStatsFailed] = useState(false);
  // ---- Order-variant state (inert unless `orderPlan` is passed) --------------------------------
  const isOrder = orderPlan != null;
  const [trigDirection, setTrigDirection] = useState<'above' | 'below'>('above');
  const [trigLevel, setTrigLevel] = useState<number | ''>('');
  const [priceMode, setPriceMode] = useState<'market' | 'limit'>('market');
  const [goodTil, setGoodTil] = useState('');

  // Market and Limit fill at a live quote. With no options feed on this site (live build, `not_live`
  // or `paused`), only Manual price is offered, and the control says why (Final Overlays, DLG-01).
  const feedOff = dataMode === 'live' && marketDataOff(marketDataMode);
  // MANUAL CONTRACT ENTRY (manualContract.ts): with the feed off there is no chain to pick an
  // expiry or strike from, so the trader types the underlying and each contract. Nothing is looked
  // up — the contract route is never asked — and the shape is checked before anything can open.
  const manualContract = !isOrder && feedOff && expirations.length === 0;
  const [underlying, setUnderlying] = useState('');

  // Reset fields each time the dialog opens (honor the Prime / AI prefill). A strike the prefill
  // names that isn't in the chain list still seeds — the user can adjust to the nearest listed one.
  useEffect(() => {
    if (!open) return;
    const nearest = strikes.length
      ? strikes.reduce((b, s) => (Math.abs(s - spot) < Math.abs(b - spot) ? s : b), strikes[0])
      : '';
    // rec-absence-literals-hole §2.5 — the dialog branches on PREFILL PRESENCE, not on the field
    // value: `??` cannot express that (it fires identically on `null` and `undefined`).
    // `prefill === undefined` (opened directly, not via Accept) keeps today's nearest-strike /
    // first-expiration / `call` defaults BYTE-IDENTICAL (AC-13). A prefill that arrived with a field
    // the read never named seeds the draft's own empty sentinel, which the confirm control rejects.
    const exp = prefill ? (prefill.expiration ?? '') : (expirations[0] ?? '');
    setMode('manual');
    // ONE row, always — the multi-leg variant is entered by ADDING to this array, never by opening
    // something else.
    setLegs([
      newDraft({
        expiration: exp,
        strike: prefill ? (prefill.strike ?? '') : nearest,
        right: prefill ? (prefill.right ?? '') : 'call',
        // tradeable-rec-inputs (AC-79, ship-blocking): the quantity field is NEVER seeded from the
        // model — it always opens at the dialog's own default of 1, in every case.
        qty: 1,
      }),
    ]);
    setStop(prefill?.stop ?? '');
    setTarget(prefill?.target ?? '');
    setManualPrice('');
    setLimitPrice('');
    setMarketFill(null);
    setFillState('idle');
    setContractStatsFailed(false);
    setUnderlying('');
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
    // rec-absence-literals-hole (F11, discovered — not named in §2.5): `right === ''` (the read named
    // no structure) has no contract to look up either, mirroring the shipped `strike === ''` guard.
    if (!open || manualContract || !expiration || strike === '' || right === '') return;
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
        if (!fill) {
          setMarketFill(null);
          setFillState('no_resolvable');
          return;
        }
        setMarketFill(fill);
        setFillState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setContractStatsFailed(true);
        setMarketFill(null);
        setFillState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, manualContract, ticker, expiration, strike, right, spot]);

  // ---- Derived previews / guards per mode ------------------------------------------------------
  //
  // MARKET and LIMIT resolve ONE option contract, and a per-unit limit has no defined meaning for a
  // structure (`composeMark.netLimitDollarsFor` carries that ruling). So both modes are available
  // only for a single OPTION leg — and the boundary is STATED to the trader, never applied silently.
  const singleOptionEntry = legs.length === 1 && legs[0].kind === 'option';
  const effectiveMode: FillMode = singleOptionEntry && !feedOff ? mode : 'manual';

  /**
   * The per-unit price THIS leg would open at, or `null` when it is not known yet. For the shipped
   * single-option path that is the mode's price; for every additional leg it is the trader's own
   * typed per-leg price. There is NO back-solved, allocated or apportioned price anywhere: that
   * would fabricate an instrument fact in the same audit spine where the lift refuses to backfill an
   * invented `entry_time`, and the same lift is reused by the archive import.
   */
  const priceOfDraft = (d: LegDraft, index: number): number | null => {
    if (singleOptionEntry && index === 0) {
      if (effectiveMode === 'manual') return manualPrice === '' ? null : Number(manualPrice);
      if (effectiveMode === 'market') return marketFill?.mark ?? null;
      return limitPrice === '' ? null : Number(limitPrice);
    }
    return d.price === '' ? null : Number(d.price);
  };

  const draftPrices = legs.map(priceOfDraft);
  const everyLegPriced = draftPrices.every((p) => p != null);

  // Options expire on New York's calendar, so the typed expiration is checked against New York's
  // date (the scenario clock on the demo), never the browser's (Wave 2 review risk).
  const expiryToday = newYorkDateIso(dataMode === 'demo' ? demoNowMs() : Date.now());
  // The typed contract's check (null when the chain supplies the contract). Its ticker is the one
  // the position is stored under; until the symbol is valid the host's ticker never stands in.
  const manualCheck = manualContract
    ? checkManualEntry({
        underlying,
        legs: legs.map((d, i) => ({ ...d, price: draftPrices[i] })),
        today: expiryToday,
      })
    : null;
  const manualLegErrors = manualCheck && !manualCheck.ok ? manualCheck.legs : null;
  const entryTicker = manualContract ? normalizeUnderlying(underlying) : ticker;

  /** The drafted structure, as a `SimPosition` the SHARED recogniser and leg arithmetic can read. */
  const draftPosition: SimPosition = {
    id: 'draft',
    legs: legs.map((d, i): Leg => {
      const isOption = d.kind === 'option';
      return {
        id: d.key,
        kind: d.kind,
        ticker: entryTicker,
        side: d.side,
        qty: d.qty,
        multiplier: multiplierFor(d.kind),
        entry_price: draftPrices[i] ?? 0,
        entry_basis: 'manual',
        expiration: isOption ? d.expiration || null : null,
        strike: isOption ? (d.strike === '' ? null : Number(d.strike)) : null,
        // rec-absence-literals-hole — mirrors the shipped `strike` narrow one line above: submit
        // already rejects `''`, but TypeScript cannot know that, so the narrow is required.
        right: isOption ? (d.right === '' ? null : d.right) : null,
      };
    }),
    opened_time: '',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 3,
  };

  // AC-18 — the derived name follows the legs immediately, with no reload: it is recomputed from
  // the drafts on every render by the SAME recogniser the book uses. Never stored, never chosen.
  const draftStructureLabel = STRUCTURE_LABELS[structureKindOf(draftPosition)];

  /**
   * The running net, in DOLLARS, > 0 debit and < 0 credit — or `null` until EVERY leg has a price.
   * NEVER a partial sum (AC-10): a partial net is not merely incomplete, it can be sign-inverted.
   */
  const runningNet = everyLegPriced ? netEntryCost(draftPosition) : null;
  const netPhrase = runningNet == null ? DIALOG_NET_INCOMPLETE : netEntryPhrase(runningNet);
  // The live-mark hint for the Limit preview: the same resolved mid/theoretical mark the market fill
  // uses (resolveMarketFill is the single source of that value).
  const liveMark = marketFill?.mark ?? null;
  const alreadyCrossable = liveMark != null && limitPrice !== '' && liveMark <= Number(limitPrice);

  // ---- Order-variant derivations (all inert when `orderPlan` is absent) -------------------------
  // The structured trigger the confirm would arm: set only when a numeric level is present.
  const orderTrigger: Trigger | null =
    isOrder && trigLevel !== '' && Number(trigLevel) > 0
      ? {
          kind: trigDirection === 'above' ? 'underlying_above' : 'underlying_below',
          level: Number(trigLevel),
        }
      : null;
  // D8-2 — appears/disappears LIVE as the user edits the trigger against the current live mid.
  const alreadyMet =
    isOrder &&
    orderPlan.liveMid != null &&
    orderTrigger != null &&
    triggerMet(orderTrigger, orderPlan.liveMid);
  // D3 good-til validation: after now, no later than the contract's expiration; never blank (AC-8).
  const goodTilInvalid =
    isOrder &&
    (goodTil === '' || goodTil < todayIso() || (expiration !== '' && goodTil > expiration));

  /** Every OPTION leg must name its contract; an equity leg has no contract to name. */
  /** Every OPTION leg must name its contract; an equity leg has no contract to name. `!!d.right` is
   *  the new conjunct (rec-absence-literals-hole AC-12f): `right` is the one contract field the
   *  predicate could not see before, and the `''` sentinel is falsy, so the same shape serves. The
   *  strike and expiration arms are UNCHANGED — the seam maps their unstated case onto values those
   *  arms already reject. */
  const everyLegAddressed = legs.every(
    (d) => d.qty >= 1 && (d.kind === 'equity' || (d.strike !== '' && !!d.expiration && !!d.right)),
  );

  const canConfirm = (() => {
    if (!everyLegAddressed) return false;
    if (manualCheck && !manualCheck.ok) return false;
    if (isOrder) {
      if (goodTilInvalid) return false;
      if (priceMode === 'limit') return limitPrice !== '' && Number(limitPrice) > 0;
      return true; // market-on-trigger needs no price
    }
    if (effectiveMode === 'market') return marketFill != null && fillState === 'idle';
    // AC-10 — a partial net never confirms: every leg carries a price, or nothing opens.
    return everyLegPriced && draftPrices.every((p) => (p as number) > 0);
  })();

  // "Place limit order" only when the host actually rests the order (Positions lifecycle).
  // THE ACTION'S NAME NEVER CHANGES PER CASE otherwise — one leg or six, it reads the same.
  const confirmLabel = isOrder
    ? ORDER_CONFIRM_LABEL
    : restingLimit && effectiveMode === 'limit'
      ? 'Place limit order'
      : 'Open simulated position';
  const priceLabel = effectiveMode === 'limit' ? 'Limit price' : 'Manual price';

  const handleConfirm = () => {
    if (!everyLegAddressed) return;
    if (manualCheck && !manualCheck.ok) return;
    const base: SubmitBase = {
      ticker: entryTicker,
      stop: stop === '' ? null : Number(stop),
      target: target === '' ? null : Number(target),
    };
    if (isOrder) {
      // rec-absence-literals-hole (F11, discovered — not named in §2.5): `right` feeds
      // `OrderContract.right: OptionRight` (non-nullable) below; mirrors the shipped
      // `strike === ''` guard on this same line.
      if (goodTilInvalid || strike === '' || !expiration || right === '') return;
      onConfirmOrder?.({
        ...base,
        expiration,
        strike: Number(strike),
        right,
        qty,
        trigger: orderTrigger,
        limitPrice: priceMode === 'limit' && limitPrice !== '' ? Number(limitPrice) : null,
        expiresAt: goodTilToExpiresAt(goodTil),
        goodTilDate: goodTil,
      });
      return;
    }

    // ONE payload shape for one leg and for six. `multiplier` is decided here, at construction, and
    // travels with the leg — it is never re-derived from `kind` downstream.
    const legInputs: LegInput[] = legs.map((d, i) => ({
      kind: d.kind,
      ticker: entryTicker,
      side: d.side,
      qty: d.qty,
      multiplier: multiplierFor(d.kind),
      price: draftPrices[i],
      expiration: d.kind === 'option' ? d.expiration || null : null,
      strike: d.kind === 'option' ? (d.strike === '' ? null : Number(d.strike)) : null,
      right: d.kind === 'option' ? (d.right === '' ? null : d.right) : null,
    }));

    if (effectiveMode === 'market') {
      if (!marketFill) return;
      // Safe narrow: `resolveMarketFill` only ever returns `snapshot` or `theoretical`.
      onConfirm({
        ...base,
        entryMode: 'market',
        legs: legInputs,
        resolvedMark: marketFill.mark,
        resolvedBasis: marketFill.basis as MarketFillBasis,
      });
      return;
    }
    if (effectiveMode === 'limit') {
      if (limitPrice === '') return;
      onConfirm({ ...base, entryMode: 'limit', legs: legInputs, limitPrice: Number(limitPrice) });
      return;
    }
    if (!everyLegPriced) return;
    onConfirm({ ...base, entryMode: 'manual', legs: legInputs });
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
      fullScreen={fullScreen}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px',
            border: 1,
            borderColor: 'divider',
            backgroundImage: 'none',
            bgcolor: (theme) => extrasFor(theme).panelRaised,
          },
        },
      }}
    >
      <DialogContent data-testid="trade-entry-dialog" sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header — title + SIMULATED (+ provenance) + close. */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexGrow: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {isOrder
                  ? ORDER_DIALOG_TITLE
                  : manualContract
                    ? underlyingError(underlying) == null
                      ? `Open simulated position · ${entryTicker}`
                      : 'Open simulated position'
                    : `Open simulated position · ${ticker}`}
              </Typography>
              <Chip
                size="small"
                label="SIMULATED"
                title={SIMULATED_TIP}
                sx={(t) => ({
                  bgcolor: alpha(t.palette.success.main, 0.18),
                  color: upText(t),
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                })}
              />
              {!isOrder && prefill?.provenance && (
                // KEEP amber (stage-3 §4.2: provenance is brand-flavored); the 13px LABEL binds
                // text-grade `textAmber` (§5.2 gate), the border stays a `primary` alpha (UI class).
                <Chip
                  size="small"
                  variant="outlined"
                  label={prefill.provenance}
                  sx={(t) => ({
                    color: extrasFor(t).textAmber,
                    borderColor: alpha(t.palette.primary.main, 0.5),
                  })}
                />
              )}
            </Stack>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close"
              sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}
            >
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
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary' }}
                data-testid="order-provenance-line"
              >
                {orderPlan.provenance.source === 'ai_scenario'
                  ? provenanceScenario(orderPlan.provenance.scenarioName ?? 'scenario')
                  : provenanceAiRead(orderPlan.provenance.personaName, orderPlan.provenance.asOf)}
              </Typography>
            </>
          )}

          {/* MANUAL CONTRACT ENTRY — the underlying first: every leg of a position shares it. */}
          {manualContract && (
            <Box data-testid="entry-manual-contract">
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mb: 1, fontSize: 12 }}
              >
                {MANUAL_ENTRY_COPY.lead}
              </Typography>
              <FieldLabel htmlFor="entry-underlying">Underlying</FieldLabel>
              <TextField
                id="entry-underlying"
                size="small"
                fullWidth
                value={underlying}
                onChange={(e) => setUnderlying(e.target.value.toUpperCase())}
                error={
                  underlying.trim() !== '' && manualCheck?.ok === false && !!manualCheck.underlying
                }
                helperText={
                  underlying.trim() !== '' && manualCheck?.ok === false
                    ? (manualCheck.underlying ?? undefined)
                    : undefined
                }
                placeholder="SPY"
                slotProps={{
                  htmlInput: {
                    'aria-label': 'Underlying',
                    autoCapitalize: 'characters',
                    autoComplete: 'off',
                    spellCheck: false,
                    maxLength: 8,
                  },
                }}
                sx={inputSx}
              />
            </Box>
          )}

          {/* Fill-mode segmented control (shipped 3-mode — replaced by the 2-option entry-price
              control in the ORDER VARIANT ONLY, §3.1-6). Market/Limit resolve ONE option contract,
              so once the entry is not a single option leg they are refused VISIBLY, never hidden. */}
          {!isOrder && (
            <FillModeToggle
              value={effectiveMode}
              singleOptionEntry={singleOptionEntry}
              feedOff={feedOff}
              // A typed entry links to its own underlying once the symbol is valid, before the
              // rest of the contract is; until then no ticker (the demo opens SPY), never the host's.
              ticker={
                manualContract ? (underlyingError(underlying) == null ? entryTicker : '') : ticker
              }
              onChange={setMode}
            />
          )}

          {/* THE DERIVED NAME (AC-18) — read from the drafted legs by the SAME recogniser the book
              uses, recomputed on every keystroke, never stored and never chosen. Neutral register:
              a structure name is not a direction, so it is never tinted. */}
          {!isOrder && multiLeg && (
            <Box>
              <FieldLabel>Structure</FieldLabel>
              <Chip
                size="small"
                variant="outlined"
                label={draftStructureLabel}
                data-testid="entry-structure-name"
                sx={{ borderColor: 'divider', color: 'text.secondary' }}
              />
            </Box>
          )}

          {/* THE LEG ROWS. One row for a plain long call, six for an exotic — the SAME rows, the
              SAME dialog, no wizard and no step flow (AC-8, AC-13). */}
          {legs.map((d, i) => (
            <LegFields
              key={d.key}
              draft={d}
              index={i}
              total={legs.length}
              multiLeg={!isOrder && multiLeg}
              expirations={expirations}
              strikes={strikes}
              inputSx={inputSx}
              // The single-option path keeps the SHIPPED mode-scoped price field below; every other
              // shape prices per leg, because that is the only honest way to net a structure.
              showPrice={!isOrder && !singleOptionEntry}
              manualContract={manualContract}
              today={expiryToday}
              errors={manualLegErrors?.[i]}
              onPatch={(patch) => patchLeg(i, patch)}
              onRemove={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}

          {/* Add a leg — INSIDE this dialog. NO leg-count cap is enforced or messaged (AC-13). */}
          {!isOrder && multiLeg && (
            <Button
              size="small"
              onClick={() =>
                setLegs((prev) => [
                  ...prev,
                  newDraft({
                    expiration: prev[0]?.expiration ?? '',
                    strike: prev[0]?.strike ?? '',
                    right: prev[0]?.right ?? 'call',
                    side: 'short',
                  }),
                ])
              }
              data-testid="entry-add-leg"
              sx={{ alignSelf: 'flex-start', color: 'info.main' }}
            >
              + Add leg
            </Button>
          )}

          {/* rec-absence-literals-hole (AC-12a/b/c/d) — the read named no contract field(s): ONE
              line, literal-agnostic on purpose so the copy stays owned by `ai-rec/copy.ts` and this
              file never re-spells it. An unexplained blank reads as a bug rather than a refusal. */}
          {prefill?.contractWithheldReason && (
            <Typography
              variant="caption"
              data-testid="entry-contract-withheld"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              {prefill.contractWithheldReason}
            </Typography>
          )}

          {/* ORDER VARIANT — the entry trigger section (§3.1-5). */}
          {isOrder && (
            <Box data-testid="order-trigger-section">
              <FieldLabel htmlFor="order-trigger-level">{TRIGGER_LABEL}</FieldLabel>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Select
                  size="small"
                  value={trigDirection}
                  onChange={(e) => setTrigDirection(e.target.value as 'above' | 'below')}
                  inputProps={{ 'aria-label': 'Trigger direction' }}
                  sx={{ ...inputSx, minWidth: 110 }}
                >
                  <MenuItem value="above">Above</MenuItem>
                  <MenuItem value="below">Below</MenuItem>
                </Select>
                <TextField
                  id="order-trigger-level"
                  size="small"
                  fullWidth
                  type="number"
                  value={trigLevel}
                  onChange={(e) =>
                    setTrigLevel(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  slotProps={{ htmlInput: { 'aria-label': 'Trigger level' } }}
                  sx={inputSx}
                />
                {orderPlan.seededTrigger && (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={TRIGGER_SEED_CHIP}
                    data-testid="order-seed-chip"
                  />
                )}
              </Stack>
              {/* Seed-policy helpers (D2): no parseable level ⇒ nothing pre-filled; empty ⇒ arms
                  immediately. */}
              {!orderPlan.seededTrigger && trigLevel === '' && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                  data-testid="order-no-seed-helper"
                >
                  {TRIGGER_NO_SEED_HELPER}
                </Typography>
              )}
              {orderPlan.seededTrigger && trigLevel === '' && (
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                >
                  {TRIGGER_EMPTY_HELPER}
                </Typography>
              )}
              {/* The rec's verbatim words — ALWAYS shown beneath the trigger fields (§3.1-5). */}
              <Box sx={{ mt: 1 }}>
                <FieldLabel>{REC_WORDS_LABEL}</FieldLabel>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                  data-testid="order-verbatim-words"
                >
                  {orderPlan.triggerSourceText
                    ? `“${orderPlan.triggerSourceText}”`
                    : REC_NO_TRIGGER_TEXT}
                </Typography>
              </Box>
            </Box>
          )}

          {/* ORDER VARIANT — the 2-option entry-price control (§3.1-6). */}
          {isOrder && (
            <Box data-testid="order-entry-price-section">
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={priceMode}
                onChange={(_, v) => v && setPriceMode(v)}
                aria-label="entry price"
              >
                <ToggleButton value="limit">{ENTRY_PRICE_LIMIT}</ToggleButton>
                <ToggleButton value="market">{ENTRY_PRICE_MARKET}</ToggleButton>
              </ToggleButtonGroup>
              {priceMode === 'limit' && (
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  value={limitPrice}
                  sx={{ ...inputSx, mt: 1 }}
                  onChange={(e) =>
                    setLimitPrice(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  slotProps={{ htmlInput: { 'aria-label': 'Limit price' } }}
                />
              )}
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              >
                {priceMode === 'limit' ? LIMIT_HELPER : MARKET_HELPER}
              </Typography>
            </Box>
          )}

          {/* Mode-scoped price (hidden in Market mode). Manual and Limit keep separate typed values.
              Only the SINGLE-OPTION path uses it — every other shape prices per leg above. */}
          {!isOrder && singleOptionEntry && effectiveMode !== 'market' && (
            <Box>
              <FieldLabel htmlFor="entry-price">{priceLabel}</FieldLabel>
              <TextField
                id="entry-price"
                size="small"
                fullWidth
                type="number"
                value={effectiveMode === 'limit' ? limitPrice : manualPrice}
                onChange={(e) => {
                  const v = e.target.value === '' ? ('' as const) : Number(e.target.value);
                  if (effectiveMode === 'limit') setLimitPrice(v);
                  else setManualPrice(v);
                }}
                error={manualContract && manualPrice !== '' && !!manualLegErrors?.[0]?.price}
                helperText={
                  manualContract && manualPrice !== '' ? manualLegErrors?.[0]?.price : undefined
                }
                slotProps={{ htmlInput: { 'aria-label': priceLabel } }}
                sx={inputSx}
              />
            </Box>
          )}

          {/* Risk plan — editable; seeded from an AI rec's exit_plan when Accepted, blank for a
              manual entry. Not an input to the mark/P-L math (v1); recorded with the trade. */}
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel htmlFor="entry-stop">Stop (optional)</FieldLabel>
              <TextField
                id="entry-stop"
                size="small"
                fullWidth
                type="number"
                value={stop}
                onChange={(e) => setStop(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': 'Stop (optional)' } }}
                sx={inputSx}
              />
              {/* ai-rec-grounding (AC-68) — a withheld price field says why, in one line, drawn from
                  the closed literal set and rendered VERBATIM (the same seam `provenance`/`sizingNote`
                  use). Three members after D8; this branch is literal-agnostic on purpose, so the copy
                  stays owned by `ai-rec/copy.ts` and this file never re-spells it. An unexplained
                  blank reads as a bug rather than a refusal. */}
              {prefill?.stopWithheldReason && (
                <Typography
                  variant="caption"
                  data-testid="entry-stop-withheld"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                >
                  {prefill.stopWithheldReason}
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <FieldLabel htmlFor="entry-target">Target (optional)</FieldLabel>
              <TextField
                id="entry-target"
                size="small"
                fullWidth
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))}
                slotProps={{ htmlInput: { 'aria-label': 'Target (optional)' } }}
                sx={inputSx}
              />
              {prefill?.targetWithheldReason && (
                <Typography
                  variant="caption"
                  data-testid="entry-target-withheld"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
                >
                  {prefill.targetWithheldReason}
                </Typography>
              )}
            </Box>
          </Stack>

          {isOrder && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
              {STOP_TARGET_HELPER}
            </Typography>
          )}

          {/* ORDER VARIANT — the never-blank good-til bound (§3.1-8, AC-8). */}
          {isOrder && (
            <Box data-testid="order-good-til-section">
              <FieldLabel htmlFor="order-good-til">{GOOD_TIL_LABEL}</FieldLabel>
              <TextField
                id="order-good-til"
                size="small"
                fullWidth
                type="date"
                value={goodTil}
                onChange={(e) => setGoodTil(e.target.value)}
                error={goodTilInvalid}
                helperText={goodTilInvalid ? GOOD_TIL_VALIDATION : GOOD_TIL_HELPER}
                slotProps={{ htmlInput: { 'aria-label': 'Good-til' } }}
                sx={inputSx}
              />
            </Box>
          )}

          {/* ORDER VARIANT — contract-stats degraded caption (per-row isolation; plan editable). */}
          {isOrder && contractStatsFailed && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Contract stats unavailable — your entry still works.
            </Typography>
          )}

          {/* tradeable-rec-inputs (AC-79/80/81): the rec's size text, displayed VERBATIM beside the
              quantity field and never fed into it — the field above always opened at the dialog's
              own default. `size not suggested` is a distinct literal from `not set` (SPEC §4). */}
          {prefill?.sizeText && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary' }}
              data-testid="entry-ai-size-text"
            >
              {`AI-suggested size: “${prefill.sizeText}”`}
            </Typography>
          )}
          {prefill?.sizingNote && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {prefill.sizingNote}
            </Typography>
          )}

          {/* Fill preview — per mode, honest about the basis (S6). Not part of the order variant
              (an order fills LATER, on live crosses — the §3.1-6 helpers state the semantics). */}
          {!isOrder && !singleOptionEntry ? (
            // THE MULTI-LEG / EQUITY NET. Computed from the trader's own per-leg prices and SAID to
            // be — the app never asks for a net and never splits one across legs. Until every leg
            // has a price it reads INCOMPLETE, never a partial sum (AC-9, AC-10, AC-22).
            <Box>
              <Typography
                variant="body2"
                sx={{ color: runningNet == null ? 'text.secondary' : 'text.primary' }}
                data-testid="entry-net"
              >
                {runningNet == null ? netPhrase : `${netPhrase} · ${DIALOG_NET_COMPUTED}`}
              </Typography>
              <Chip size="small" variant="outlined" sx={{ mt: 0.5 }} label="user-entered price" />
            </Box>
          ) : !isOrder ? (
            <Box>
              {fillState === 'loading' ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Select a contract to see the fill.
                </Typography>
              ) : fillState === 'error' ? (
                <Typography variant="body2" sx={{ color: downText }}>
                  Couldn't load the chain for entry — try again.
                </Typography>
              ) : effectiveMode === 'manual' ? (
                <>
                  <Typography
                    variant="body2"
                    sx={{ color: manualPrice === '' ? 'text.secondary' : 'text.primary' }}
                    data-testid="entry-net"
                  >
                    {manualPrice === ''
                      ? 'Enter a price — opens at exactly the price you type.'
                      : runningNet != null && runningNet < 0
                        ? `Opens at your price $${Number(manualPrice).toFixed(2)} · ${netPhrase} — you receive this at open.`
                        : `Opens at your price $${Number(manualPrice).toFixed(2)} · ${netPhrase} — user-entered, not a market quote.`}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                    label="user-entered price"
                  />
                  {contractStatsFailed && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Contract stats unavailable — your entry still works.
                    </Typography>
                  )}
                </>
              ) : effectiveMode === 'market' ? (
                fillState === 'no_resolvable' ? (
                  <Typography variant="body2" sx={{ color: downText }}>
                    No quote or theoretical mark available for this contract — a market order can't
                    fill. Try Manual price, or pick another contract.
                  </Typography>
                ) : marketFill ? (
                  <>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.primary' }}
                      data-testid="entry-net"
                    >
                      {`Fill: mid $${marketFill.mark.toFixed(2)} · ${netPhrase} (mid × 100 × qty)`}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                      label={marketFill.basis === 'theoretical' ? 'theoretical' : 'snapshot mid'}
                    />
                    {marketFill.basis === 'theoretical' && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        No live quote — fill will use a theoretical (Black-Scholes) mark.
                      </Typography>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Select a contract to see the fill.
                  </Typography>
                )
              ) : restingLimit ? (
                // Limit — the host rests it `pending` and fills only on a LIVE cross (Positions).
                <>
                  <Typography
                    variant="body2"
                    sx={{ color: limitPrice === '' ? 'text.secondary' : 'text.primary' }}
                  >
                    {limitPrice === ''
                      ? 'Enter a limit price.'
                      : `Rests until the live mark reaches $${Number(limitPrice).toFixed(2)}, then fills at $${Number(limitPrice).toFixed(2)}. Stays cancellable until it fills.`}
                  </Typography>
                  {alreadyCrossable && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      The live mark is already at or below your limit — this will fill on the next
                      live tick.
                    </Typography>
                  )}
                </>
              ) : (
                // Limit — immediate open at your price (Ticker: no resting lifecycle in the engine).
                <Typography
                  variant="body2"
                  sx={{ color: limitPrice === '' ? 'text.secondary' : 'text.primary' }}
                  data-testid="entry-net"
                >
                  {limitPrice === ''
                    ? 'Enter a limit price to see the fill.'
                    : `Fills at your limit $${Number(limitPrice).toFixed(2)} · ${netPhrase}`}
                </Typography>
              )}
            </Box>
          ) : null}

          {/* ORDER VARIANT — a refused order write (faulted store) surfaces inline; nothing partial. */}
          {isOrder && orderError && (
            <Alert severity="warning" data-testid="order-inline-error">
              <Typography variant="subtitle2">{orderError}</Typography>
            </Alert>
          )}

          {/* tradeable-rec-inputs — the cap-check annotation carried through to the confirm step,
              already rendered by the host; this dialog performs no cap computation of its own. */}
          {capAnnotation && <Box data-testid="entry-cap-annotation">{capAnnotation}</Box>}

          {/* Disclaimer — shipped verbatim, or the mandatory D8-1 SIMULATED disclosure in the order
              variant (always visible above the confirm, §3.1-9). */}
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary' }}
            data-testid={isOrder ? 'order-simulated-disclosure' : undefined}
          >
            {isOrder ? simulatedDisclosure(ticker) : DISCLAIMER}
          </Typography>

          {/* Footer. */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
            <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disableElevation
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
