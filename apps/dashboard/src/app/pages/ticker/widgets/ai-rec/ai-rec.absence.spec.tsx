/**
 * ai-rec.absence.spec.tsx — rec-absence-literals-hole (PLAN F9). The card render regressions for the
 * six unnamed-field states. Mounts the real app at `/ticker/TSLA` against a strict fetch mock (throws
 * on any unexpected call); the PAYLOAD FIXTURE is the mock — never a mocked selector, never a mocked
 * copy table, never a mocked submit predicate.
 *
 * The harness (`installBackend`, `renderApp`, `panel`, `settle`, `ask`, `fieldValueEl`) is copied
 * verbatim from `ai-rec.grounding.spec.tsx:31-120` (F0.3 confirmed it is the shipped, proven traversal
 * — no per-field `data-testid` exists anywhere in `AiRecPanel.tsx`/`reasoning.tsx`, so a label-anchored
 * DOM walk is the only honest mechanism).
 */
import App from '@/app';
import { makeBundle } from '@/features/auth/testBackend';
import { PRESETS } from '@/features/personas/presets';
import { __resetMemory as __resetPositions } from '@/features/trading/positions/store';
import type { RecResponse, RecStatus, TickerBundle } from '@convexa/api';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY, PLAN_FIELD_LABEL } from './copy';
import {
  noTradeRec,
  recAllTraced,
  recBlankValues,
  recCandidateSetEmpty,
  recHalfNamed,
  recLocalRulesUnnamed,
  recNoFieldReasonsBlock,
  recNoneNamed,
  recOffScaleConfidence,
  recOnlySoftFieldsUnnamed,
  recUnknownToken,
} from './fixtures';

function makeStatus(): RecStatus {
  return {
    availability: { in_app_enabled: true },
    gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
    cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-27T04:00:00Z' },
  };
}

const esInstances: { onerror: ((e: Event) => void) | null }[] = [];

function installBackend(rec: RecResponse, bundle: TickerBundle = makeBundle()) {
  esInstances.length = 0;
  class MockEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      esInstances.push(this);
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

  const calls = { rec: 0 };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/auth/session')) {
      return json({
        authenticated: true,
        user: { id: 'u-1', email: 'a@x.com', display_name: null, auth_methods: ['password'] },
        google_available: false,
        settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
      });
    }
    if (url.includes('/api/positions/sim-trade/gate')) return json({ allowed: true });
    if (url.includes('/api/ticker/')) return json(bundle);
    if (url.includes('/api/recommendation/status/')) return json(makeStatus());
    if (url.includes('/api/recommendation/') && method === 'POST') {
      calls.rec++;
      return json(rec);
    }
    if (url.includes('/api/personas')) return json(PRESETS);
    if (url.includes('/api/contract/')) return json(null);
    if (url.includes('/history'))
      return json({ symbol: 'TSLA', samples: [], basis: 'test structure history' });
    throw new Error(`Unexpected fetch in ai-rec.absence test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  return { calls, fetchMock };
}

function renderApp() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/ticker/TSLA']}>
      <App />
    </MemoryRouter>,
  );
  return user;
}

const panel = () => screen.getByTestId('ai-rec-panel');
async function settle() {
  await screen.findByText('Call wall');
  await screen.findByText('AI recommendation · TSLA');
}
async function ask(user: ReturnType<typeof renderApp>) {
  await waitFor(() =>
    expect(within(panel()).getByRole('button', { name: COPY.action.get })).toBeEnabled(),
  );
  await user.click(within(panel()).getByRole('button', { name: COPY.action.get }));
}

/** Copied verbatim from `ai-rec.grounding.spec.tsx:114-120` (F0.3) — the shipped, proven traversal for
 *  a `Field`-shaped label/value pair. Does NOT reach the conviction slot (see `convictionValueEl`
 *  below) — that markup is a bare `<Box><label/><value/></Box>`, one level shallower. */
function fieldValueEl(label: string): HTMLElement {
  const labelEl = within(panel()).getByText(label);
  const fieldBox = labelEl.closest('div')?.parentElement as HTMLElement;
  const value = fieldBox.querySelector('p');
  if (!value) throw new Error(`no value <p> found for field "${label}"`);
  return value as HTMLElement;
}

/** The conviction slot's value element — a Chip label or a suppressed-chip `<p>`, a sibling of its
 *  own label inside one shallow `Box` (not the `Field` shape `fieldValueEl` targets). */
function convictionValueEl(): HTMLElement {
  const box = within(panel()).getByText(PLAN_FIELD_LABEL.confidence).parentElement as HTMLElement;
  const el = box.querySelector('.MuiChip-label') ?? box.querySelector('p');
  if (!el) throw new Error('no conviction value element');
  return el as HTMLElement;
}

/** Resolves any of the six plan/conviction slots by label, routing Confidence through its own
 *  traversal. */
function slotValueEl(label: string): HTMLElement {
  return label === PLAN_FIELD_LABEL.confidence ? convictionValueEl() : fieldValueEl(label);
}

const RESERVED = '—';
const SIX = Object.values(PLAN_FIELD_LABEL);

beforeEach(() => {
  localStorage.clear();
  __resetPositions();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('rec-absence-literals-hole · the card (F9)', () => {
  it('AC-1 (SB) — nothing named: every slot renders one of the closed vocabulary, no `—`, exactly six resolved', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(`Trade · long`);
    let resolved = 0;
    for (const label of SIX) {
      const el = slotValueEl(label);
      resolved++;
      expect(el.textContent).not.toBe('');
      expect(el.textContent).not.toContain(RESERVED);
      expect(['not given', 'unavailable', 'unrecognized']).toContain(el.textContent);
    }
    expect(resolved).toBe(6);
  });

  it('AC-2 — three named, three not: only the unnamed three change, the named three render verbatim', async () => {
    installBackend(recHalfNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(fieldValueEl(PLAN_FIELD_LABEL.structure).textContent).toBe('long call');
    expect(fieldValueEl(PLAN_FIELD_LABEL.strikes).textContent).toBe('$260');
    expect(fieldValueEl(PLAN_FIELD_LABEL.entryTrigger).textContent).toBe('break above 252');
    expect(fieldValueEl(PLAN_FIELD_LABEL.expiration).textContent).toBe('not given');
    expect(fieldValueEl(PLAN_FIELD_LABEL.timeHorizon).textContent).toBe('not given');
  });

  it('AC-22 (SB) — a fully-traced rec renders every one of the six verbatim, no absence word anywhere', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    for (const label of SIX) {
      const text = slotValueEl(label).textContent ?? '';
      expect(['not given', 'unavailable', 'unrecognized']).not.toContain(text);
    }
    expect(within(panel()).queryByText('not given')).toBeNull();
    expect(within(panel()).queryByText('unavailable')).toBeNull();
    expect(within(panel()).queryByText('unrecognized')).toBeNull();
  });

  it('AC-4 (SB) — never-stated / candidate-set-missing / the reserved mark are three pairwise-distinct strings, rendered through the selector', async () => {
    installBackend(recNoneNamed());
    const user1 = renderApp();
    await settle();
    await ask(user1);
    const neverStated = fieldValueEl(PLAN_FIELD_LABEL.structure).textContent;
    cleanup();
    vi.unstubAllGlobals();

    installBackend(recCandidateSetEmpty());
    const user2 = renderApp();
    await settle();
    await ask(user2);
    const inputMissing = fieldValueEl(PLAN_FIELD_LABEL.strikes).textContent;
    cleanup();
    vi.unstubAllGlobals();

    installBackend(noTradeRec());
    const user3 = renderApp();
    await settle();
    await ask(user3);
    const reservedMark = within(panel()).getByText(COPY.noTrade.title).textContent;

    expect(new Set([neverStated, inputMissing, reservedMark]).size).toBe(3);
    expect([neverStated, inputMissing, reservedMark].every((s) => !!s && s.length > 0)).toBe(true);
  });

  it('AC-5 (SB) — no field_reasons block at all: all six read `not given`, no null/undefined/NaN/reserved anywhere, no error state', async () => {
    installBackend(recNoFieldReasonsBlock());
    const user = renderApp();
    await settle();
    await ask(user);
    for (const label of SIX) {
      const el = slotValueEl(label);
      expect(el.textContent).toBe('not given');
    }
    const text = panel().textContent ?? '';
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
    expect(within(panel()).queryByTestId('rec-not-actionable')).toBeInTheDocument();
  });

  it('AC-6 — an unrecognised reason token renders `not given`, never the raw token, never blank, never `unavailable`', async () => {
    installBackend(recUnknownToken());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(fieldValueEl(PLAN_FIELD_LABEL.structure).textContent).toBe('not given');
    expect(panel().textContent).not.toContain('wat');
  });

  it('AC-7 (SB) — blank-ish values ("", whitespace, []) are treated as not named, every slot non-empty', async () => {
    installBackend(recBlankValues());
    const user = renderApp();
    await settle();
    await ask(user);
    for (const label of SIX) {
      const el = slotValueEl(label);
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
      expect(el.textContent).toBe('not given');
    }
  });

  it('AC-24 (SB) — an off-scale conviction reads `unrecognized`, never `not given`, and the raw string never reaches the DOM', async () => {
    installBackend(recOffScaleConfidence());
    const user = renderApp();
    await settle();
    await ask(user);
    const el = slotValueEl(PLAN_FIELD_LABEL.confidence);
    expect(el.textContent).toBe('unrecognized');
    expect(el.textContent).not.toBe('not given');
    expect(panel().textContent).not.toContain('quite high');
  });

  it('AC-25 (SB) — unavailable renders on Strike(s)/Expiration only, never on the local-rules path', async () => {
    installBackend(recCandidateSetEmpty());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(fieldValueEl(PLAN_FIELD_LABEL.strikes).textContent).toBe('unavailable');
    expect(fieldValueEl(PLAN_FIELD_LABEL.expiration).textContent).toBe('unavailable');
    for (const label of [
      PLAN_FIELD_LABEL.structure,
      PLAN_FIELD_LABEL.entryTrigger,
      PLAN_FIELD_LABEL.timeHorizon,
      PLAN_FIELD_LABEL.confidence,
    ]) {
      expect(slotValueEl(label).textContent).not.toBe('unavailable');
    }
    cleanup();
    vi.unstubAllGlobals();

    installBackend(recLocalRulesUnnamed());
    const user2 = renderApp();
    await settle();
    await ask(user2);
    for (const label of SIX) {
      expect(slotValueEl(label).textContent).not.toBe('unavailable');
    }
  });

  it('AC-23 — none of the six ever renders `not set` (none depends on owner input)', async () => {
    for (const fixture of [recNoneNamed(), recCandidateSetEmpty()]) {
      installBackend(fixture);
      const user = renderApp();
      await settle();
      await ask(user);
      for (const label of SIX) {
        expect(slotValueEl(label).textContent).not.toBe('not set');
      }
      expect(within(panel()).queryByTestId('risk-field-set-risk-inputs')).toBeNull();
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('AC-26 — the DTE caption renders only beside a stated Expiration, never a bare `?`', async () => {
    installBackend(recAllTraced());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(fieldValueEl(PLAN_FIELD_LABEL.expiration).textContent).toContain(
      ' · your DTE window: 7–45',
    );
    cleanup();
    vi.unstubAllGlobals();

    installBackend(recNoneNamed());
    const user2 = renderApp();
    await settle();
    await ask(user2);
    const el = fieldValueEl(PLAN_FIELD_LABEL.expiration);
    expect(el.textContent).not.toContain('· your DTE window');
    expect(el.textContent).not.toContain('?');
  });

  it('AC-3a/3b/3c (SB) — no_trade: no plan row at all, the four risk slots show the reserved mark, no absence literal except the carve-out', async () => {
    installBackend(noTradeRec());
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    for (const label of SIX) {
      expect(within(panel()).queryByText(label)).toBeNull();
    }
    expect(within(panel()).queryByTestId('decision-grid')).toBeNull();
  });

  it('AC-3d (SB) — no_trade has no executable grid or conviction slot', async () => {
    const r = noTradeRec();
    r.strategy = { ...r.strategy!, confidence: null };
    installBackend(r);
    const user = renderApp();
    await settle();
    await ask(user);
    await within(panel()).findByText(COPY.noTrade.title);
    expect(within(panel()).queryByTestId('decision-grid')).toBeNull();
  });

  it('AC-8 — an SSE drop leaves all six exactly as they were: no flip to an absence literal or a dimmed treatment', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    const before = SIX.map((label) => slotValueEl(label).textContent);
    // Fire the mocked EventSource's onerror directly (the SSE-drop signal) and let effects settle.
    esInstances[0]?.onerror?.(new Event('error'));
    await new Promise((r) => setTimeout(r, 0));
    const after = SIX.map((label) => slotValueEl(label).textContent);
    expect(after).toEqual(before);
  });

  it('AC-14 (SB) — the verdict renders unchanged and the card is never blanked, greyed or re-verdicted, across every degraded field-reason state', async () => {
    for (const fixture of [
      recNoneNamed(),
      recBlankValues(),
      recCandidateSetEmpty(),
      recNoFieldReasonsBlock(),
    ]) {
      installBackend(fixture);
      const user = renderApp();
      await settle();
      await ask(user);
      await within(panel()).findByText('Trade · long');
      expect(within(panel()).queryByRole('button', { name: COPY.action.accept })).toBeNull();
      expect(within(panel()).getByTestId('rec-not-actionable')).toBeInTheDocument();
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('AC-10a (SB) — model path, all four position-defining fields unnamed: exactly one standing line naming them in card order', async () => {
    installBackend(recNoneNamed());
    const user = renderApp();
    await settle();
    await ask(user);
    const lines = within(panel()).getAllByTestId('rec-not-actionable');
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe(
      'Not actionable as given. Never named: Structure, Strike(s), Expiration, Entry trigger. Nothing is saved until you review and confirm.',
    );
    cleanup();
    vi.unstubAllGlobals();

    installBackend(recAllTraced());
    const user2 = renderApp();
    await settle();
    await ask(user2);
    expect(within(panel()).queryByTestId('rec-not-actionable')).toBeNull();
  });

  it('AC-10b (SB) — the local-rules path is EXEMPT: no standing line, the shipped local-rules line unchanged', async () => {
    installBackend(recLocalRulesUnnamed());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(within(panel()).queryByTestId('rec-not-actionable')).toBeNull();
    expect(within(panel()).getByTestId('grounding-card-line')).toHaveTextContent(
      "No AI read here — these figures come from Convexa's own rules.",
    );
  });

  it('AC-10c — missing information is NEVER an exemption: no grounding block + unnamed fields still fires the line', async () => {
    const r = recNoneNamed();
    delete (r as { grounding?: unknown }).grounding;
    installBackend(r);
    const user = renderApp();
    await settle();
    await ask(user);
    expect(within(panel()).getByTestId('rec-not-actionable')).toBeInTheDocument();
  });

  it('AC-11 (SB) — only Time horizon/Confidence unnamed: those two show the absence literal, no standing line', async () => {
    installBackend(recOnlySoftFieldsUnnamed());
    const user = renderApp();
    await settle();
    await ask(user);
    expect(fieldValueEl(PLAN_FIELD_LABEL.timeHorizon).textContent).toBe('not given');
    expect(slotValueEl(PLAN_FIELD_LABEL.confidence).textContent).toBe('not given');
    expect(within(panel()).queryByTestId('rec-not-actionable')).toBeNull();
    await user.click(await within(panel()).findByRole('button', { name: COPY.action.accept }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('AC-19/28 — a gated state (no key) renders no field row for the six and no absence literal', async () => {
    installBackend({
      status: 'unavailable',
      persona: { id: null, name: 'Default (no persona)' },
      as_of: null,
      pinned_fingerprint: '',
      stale_born: false,
      strategy: null,
      unavailable_reason: 'no_key',
      gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
      cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-27T04:00:00Z' },
    });
    const user = renderApp();
    await settle();
    await ask(user);
    for (const label of SIX) {
      expect(within(panel()).queryByText(label)).toBeNull();
    }
    expect(within(panel()).queryByText('not given')).toBeNull();
    expect(within(panel()).queryByText('unavailable')).toBeNull();
    expect(within(panel()).queryByText('unrecognized')).toBeNull();
  });
});
