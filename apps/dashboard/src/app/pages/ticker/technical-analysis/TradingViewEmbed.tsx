/**
 * One TradingView widget, embedded exactly as TradingView publishes it: a container holding the
 * widget slot, the attribution line, and the loader script with its JSON config as text. The loader
 * (the only TradingView code that runs in Convexa's page) swaps the slot for an iframe served from
 * TradingView's own origin. The container is built imperatively inside a host React owns, so React
 * never reconciles nodes the loader replaced.
 *
 * States: the host holds its final height while the widget loads, so nothing shifts. If the loader
 * itself fails (a blocker, a network error, the CSP), `onFail` fires once. A symbol TradingView can't
 * show fails inside its iframe, where Convexa can't see it; TradingView says so in the frame.
 */
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { useEffect, useRef } from 'react';
import { LOADER_ORIGIN } from './tradingView';

export type TradingViewAttribution = { href: string; label: string };

export function TradingViewEmbed({
  widget,
  config,
  attribution,
  height,
  title,
  onFail,
}: {
  /** The loader's name: `advanced-chart` → embed-widget-advanced-chart.js. */
  widget: 'advanced-chart' | 'technical-analysis';
  config: Record<string, unknown>;
  attribution: TradingViewAttribution;
  height: number;
  /** What the frame shows, for assistive tech (TradingView's iframe carries no useful title). */
  title: string;
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);
  const json = JSON.stringify(config);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';

    const slot = document.createElement('div');
    slot.className = 'tradingview-widget-container__widget';
    slot.style.height = 'calc(100% - 32px)';
    slot.style.width = '100%';

    // TradingView's attribution, in its published markup; its loader styles it and §4 of its
    // policies says it stays as designed.
    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright';
    const link = document.createElement('a');
    link.href = attribution.href;
    link.rel = 'noopener nofollow';
    link.target = '_blank';
    const label = document.createElement('span');
    label.className = 'blue-text';
    label.textContent = attribution.label;
    link.appendChild(label);
    const mark = document.createElement('span');
    mark.className = 'trademark';
    mark.textContent = ' by TradingView';
    copyright.append(link, mark);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `${LOADER_ORIGIN}/external-embedding/embed-widget-${widget}.js`;
    script.async = true;
    script.textContent = json;
    script.onerror = () => failRef.current();

    container.append(slot, copyright, script);
    el.replaceChildren(container);

    // Name the frame once the loader has inserted it.
    const observer = new MutationObserver(() => {
      const frame = el.querySelector('iframe');
      if (frame && frame.title !== title) frame.title = title;
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      el.replaceChildren();
    };
  }, [widget, json, attribution.href, attribution.label, title]);

  return (
    <Box
      ref={host}
      sx={(t) => ({
        height,
        width: '100%',
        minWidth: 0,
        borderRadius: '10px',
        overflow: 'hidden',
        // A border, not a fill: it holds the final size while loading without tinting the band
        // behind TradingView's attribution line.
        border: `1px solid ${alpha(t.palette.text.secondary, 0.18)}`,
      })}
    />
  );
}
