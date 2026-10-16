/**
 * The demo scenario's prior close for one symbol (site check D-22), the reference for the masthead's
 * ▲/▼ day change. Demo builds only: a live build's `market_state` carries no prior close, so this
 * stays `null` there and the masthead shows no change rather than a made-up one. Read from the
 * authored scenario in the browser (`loadSampleQuote`); no request leaves it.
 */
import { dataMode, loadSampleQuote } from '@convexa/api';
import { useEffect, useState } from 'react';

export function useSamplePriorClose(symbol: string): number | null {
  const [quote, setQuote] = useState<{ symbol: string; priorClose: number } | null>(null);
  const wanted = symbol.toUpperCase();
  useEffect(() => {
    if (dataMode !== 'demo') return;
    let active = true;
    void loadSampleQuote(wanted).then((outcome) => {
      if (active && outcome.state === 'ready')
        setQuote({ symbol: outcome.value.symbol, priorClose: outcome.value.priorClose });
    });
    return () => {
      active = false;
    };
  }, [wanted]);
  return quote?.symbol === wanted ? quote.priorClose : null;
}
