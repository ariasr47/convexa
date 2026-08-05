/**
 * R5b — Webull's own unrealized P/L is CARRIED but never RENDERED (owner ruling Q2, 2026-08-03).
 *
 * Two independent guards, because one alone is escapable:
 *  1. a RENDER regression across every wire arm — the capture's distinctive values must never
 *     reach visible text (a broken number under a Webull-branded label is worse than no number:
 *     Webull's option P/L is ~100× wrong by its own arithmetic);
 *  2. a SOURCE scan — `brokerView.ts` is the only non-fixture module under `broker/` that may even
 *     name the field, so a future component cannot quietly start reading it.
 *
 * The ruling is reversible; what must not happen is it being reversed by accident.
 */
import type { BrokerPosition } from '@org/api';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrokerPositionCard } from './BrokerPositionCard';
import { BrokerPositionRow } from './BrokerPositionRow';
import { buildBrokerPositionView } from './brokerView';
import {
  FIXED_NOW_MS,
  POS_CAPTURE_AMD_STOCK,
  POS_CAPTURE_NO_MULTIPLIER,
  POS_CAPTURE_NVDA_OPTION,
  POS_CAPTURE_SHORT_OPTION,
  POS_EQUITY,
  POS_FLAT_A,
  POS_FLAT_B,
  POS_NO_COST_BASIS,
  POS_PARTIAL,
  POS_SPREAD,
  POS_UNRECOGNIZED,
} from './fixtures';

/** The two distinctive values from the real capture — NVDA's (wrong) option P/L and AMD's. */
const CAPTURED_PL_VALUES = [-7840.5, 267.63];

const ARMS: [string, BrokerPosition][] = [
  ['capture NVDA option (−7840.50)', POS_CAPTURE_NVDA_OPTION],
  ['capture AMD stock (267.63)', POS_CAPTURE_AMD_STOCK],
  ['capture short option', POS_CAPTURE_SHORT_OPTION],
  ['capture no-multiplier', POS_CAPTURE_NO_MULTIPLIER],
  ['equity', POS_EQUITY],
  ['spread', POS_SPREAD],
  ['flat A', POS_FLAT_A],
  ['flat B (unparseable)', POS_FLAT_B],
  ['no cost basis', POS_NO_COST_BASIS],
  ['partial', POS_PARTIAL],
  ['unrecognized', POS_UNRECOGNIZED],
];

function viewOf(bp: BrokerPosition) {
  return buildBrokerPositionView({
    position: bp,
    legMarks: new Map(),
    dte: null,
    nowMs: FIXED_NOW_MS,
    book: null,
  });
}

/** Every digit form the value could plausibly render as, so a formatter change can't slip past. */
function renderedForms(v: number): string[] {
  const abs = Math.abs(v);
  return [
    String(v),
    String(abs),
    abs.toFixed(2),
    abs.toFixed(0),
    abs.toLocaleString('en-US'),
    abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ];
}

afterEach(() => cleanup());

describe('R5b · Webull’s own P/L is carried, never rendered', () => {
  it('the datum IS on the projection (reversing the ruling stays a render change)', () => {
    expect(viewOf(POS_CAPTURE_NVDA_OPTION).unrealized_pl).toEqual({
      state: 'supplied',
      value: -7840.5,
    });
  });

  it.each(ARMS)('no captured broker P/L value appears in rendered text: %s', (_name, bp) => {
    for (const streamOffline of [false, true]) {
      for (const isStale of [false, true]) {
        const r = render(
          <>
            <BrokerPositionRow
              view={viewOf(bp)}
              streamOffline={streamOffline}
              isStale={isStale}
              asOf={'2026-08-01T14:40:00Z'}
            />
            <BrokerPositionCard
              view={viewOf(bp)}
              streamOffline={streamOffline}
              isStale={isStale}
              asOf={'2026-08-01T14:40:00Z'}
            />
          </>,
        );
        const text = r.container.textContent ?? '';
        for (const v of CAPTURED_PL_VALUES) {
          for (const form of renderedForms(v)) {
            expect(
              text,
              `"${form}" leaked (offline=${streamOffline} stale=${isStale})`,
            ).not.toContain(form);
          }
        }
        r.unmount();
      }
    }
  });

  it('MUTATION GUARD: the value-form matcher would actually catch a leak', () => {
    render(
      <div>
        Webull says −7840.50 / 7,840.50 / 267.63 — this is what a regression would look like.
      </div>,
    );
    const text = screen.getByText(/Webull says/).textContent ?? '';
    const leaks = CAPTURED_PL_VALUES.flatMap(renderedForms).filter((f) => text.includes(f));
    expect(leaks.length).toBeGreaterThan(0);
  });
});

// =================================================================================================
// Source scan — only `brokerView.ts` may name the field
// =================================================================================================

const RAW_SOURCES = import.meta.glob('./*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * `fixtures.ts` is exempt and stays exempt: it is TEST-SUPPORT DATA typed against the wire, where
 * `unrealized_pl` is a required field of `BrokerPosition`. It is imported by no render code (its
 * own header says so, and `broker.risk.spec.tsx`'s scans cover the render surface).
 */
const EXEMPT = ['./brokerView.ts', './fixtures.ts'];

describe('R5b · source scan', () => {
  it('scans a REAL, non-empty file set', () => {
    const app = Object.keys(RAW_SOURCES).filter((p) => !p.includes('.spec.'));
    expect(app.length).toBeGreaterThanOrEqual(10);
    expect(app).toContain('./brokerView.ts');
  });

  it('no module under broker/ except brokerView.ts (and the fixtures) references unrealized_pl', () => {
    const offenders = Object.entries(RAW_SOURCES)
      .filter(([p]) => !p.includes('.spec.') && !EXEMPT.includes(p))
      .filter(([, src]) => /unrealized_pl/.test(src))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it('MUTATION GUARD: the scan predicate fires on a real reference', () => {
    expect(/unrealized_pl/.test('const x = view.unrealized_pl;')).toBe(true);
  });
});
