/**
 * Ticker page trade/entry/act dialog state (§3.8 Phase D).
 * Keeps TickerDashboard focused on composition; hosts still wire UI to these handlers.
 */
import { useGate } from '@/features/auth/useGate';
import { GATE_SIGN_IN } from '@/features/trading/orders/copy';
import { parseTriggerSeed } from '@/features/trading/orders/seed';
import type { OrderProvenance } from '@/features/trading/orders/types';
import { createOrder } from '@/features/trading/orders/useOrders';
import type {
  EntryPrefill,
  OrderEntrySubmit,
  OrderPlan,
} from '@/features/trading/TradeEntryDialog';
import { COPY } from '@/pages/ticker/widgets/ai-rec/copy';
import { recToPrefill } from '@/pages/ticker/widgets/ai-rec/prefill';
import type { useAiRecommendation } from '@/pages/ticker/widgets/ai-rec/useAiRecommendation';
import type { LiveUpdate, RecResponse, TickerBundle } from '@convexa/api';
import { useCallback, useEffect, useRef, useState } from 'react';

type AiRecApi = ReturnType<typeof useAiRecommendation>;

export function useTickerTradeFlows(opts: {
  ticker: string;
  data: TickerBundle | null;
  live: LiveUpdate | null;
  isLive: boolean;
  aiRec: AiRecApi;
  opportunityTier: string | undefined;
  primeEligible: boolean | undefined;
  structurePrice: number | undefined;
}) {
  const { data, live, isLive, aiRec, opportunityTier, primeEligible, structurePrice } = opts;

  const orderGate = useGate();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryPrefill, setEntryPrefill] = useState<EntryPrefill | undefined>();
  const [entryRecFingerprint, setEntryRecFingerprint] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [showPrimeBanner, setShowPrimeBanner] = useState(false);
  const prevTierRef = useRef<string | null>(null);

  const [actState, setActState] = useState<{
    open: boolean;
    plan?: OrderPlan;
    prefill?: EntryPrefill;
    provenance?: OrderProvenance;
  }>({ open: false });
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    const t = opportunityTier;
    if (t === 'prime' && primeEligible && prevTierRef.current !== 'prime') setShowPrimeBanner(true);
    if (t !== 'prime') setShowPrimeBanner(false);
    prevTierRef.current = t ?? null;
  }, [opportunityTier, primeEligible]);

  const openEntry = useCallback((prefill?: EntryPrefill, recFingerprint: string | null = null) => {
    setEntryPrefill(prefill);
    setEntryRecFingerprint(recFingerprint);
    setEntryOpen(true);
  }, []);

  const onAcceptRec = useCallback(
    (rec: RecResponse, personaName: string) => {
      if (!rec.strategy) return;
      const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing);
      if (pf) openEntry(pf, rec.pinned_fingerprint ?? null);
    },
    [openEntry],
  );

  const onActRec = useCallback(
    (rec: RecResponse, personaName: string) => {
      if (!rec.strategy || rec.strategy.decision !== 'trade') return;
      if (!orderGate.allowed) {
        orderGate.prompt(GATE_SIGN_IN);
        return;
      }
      orderGate.clear();
      const pf = recToPrefill(rec.strategy, personaName, COPY.accept.sizing);
      if (!pf) return;
      const scenario = rec.scenario ?? null;
      const provenance: OrderProvenance = {
        source: scenario ? 'ai_scenario' : 'ai_rec',
        rec_fingerprint: rec.pinned_fingerprint,
        rec_as_of: rec.as_of,
        persona: { id: rec.persona.id, name: rec.persona.name },
        ...(scenario ? { scenario_id: scenario.id, scenario_name: scenario.name } : {}),
        trigger_source_text: rec.strategy.entry_trigger ?? null,
      };
      const plan: OrderPlan = {
        seededTrigger: parseTriggerSeed(rec.strategy.entry_trigger),
        triggerSourceText: rec.strategy.entry_trigger ?? null,
        provenance: {
          source: scenario ? 'ai_scenario' : 'ai_rec',
          personaName: rec.persona.name,
          asOf: rec.as_of,
          ...(scenario ? { scenarioName: scenario.name } : {}),
        },
        stale: aiRec.stale,
        liveMid: isLive ? (live?.mid ?? null) : null,
      };
      setOrderError(null);
      setActState({ open: true, plan, prefill: pf, provenance });
    },
    [aiRec.stale, isLive, live?.mid, orderGate],
  );

  const onConfirmOrder = useCallback(
    async (submit: OrderEntrySubmit) => {
      const provenance = actState.provenance;
      if (!provenance) return;
      let ran = false;
      await orderGate.guard(
        GATE_SIGN_IN,
        () => {
          ran = true;
          const res = createOrder(
            {
              ticker: submit.ticker,
              expiration: submit.expiration,
              strike: submit.strike,
              right: submit.right,
              qty: submit.qty,
              trigger: submit.trigger,
              limit_price: submit.limitPrice,
              stop: submit.stop,
              target: submit.target,
              expires_at: submit.expiresAt,
              provenance,
            },
            {
              spot: live?.mid ?? structurePrice ?? 0,
              tier: data?.signals?.opportunity_tier ?? '',
              bundle: data,
            },
          );
          if (!res.ok) {
            setOrderError(res.reason ?? null);
            return;
          }
          setOrderError(null);
          setActState({ open: false });
        },
        { serverGate: orderGate.simTradeGate },
      );
      if (!ran) setActState({ open: false });
    },
    [actState.provenance, data, live?.mid, orderGate, structurePrice],
  );

  return {
    orderGate,
    entryOpen,
    setEntryOpen,
    entryPrefill,
    entryRecFingerprint,
    entryError,
    setEntryError,
    showPrimeBanner,
    setShowPrimeBanner,
    openEntry,
    onAcceptRec,
    onActRec,
    actState,
    setActState,
    orderError,
    setOrderError,
    onConfirmOrder,
    GATE_SIGN_IN,
  };
}
