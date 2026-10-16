// A returning staging browser gets newly added sample alerts merged in by id, once, without losing
// anything it saved (W1-53). Wrong here is a silent data write over the visitor's own alerts.
import { describe, expect, it } from 'vitest';
import { DEMO_ALERTS_SEED, DEMO_ALERTS_SEED_VERSION, mergeDemoAlertsSeed } from './alerts';

type Blob = {
  rules: { id: string; symbol?: string; enabled?: boolean }[];
  events: { id: string }[];
  notifyBrowser: boolean;
};

// What a browser seeded with version 1 holds, after the visitor's own edits.
const v1 = (): Blob => ({
  rules: [
    { id: 'demo-alert-spy-flip', symbol: 'SPY', enabled: false },
    { id: 'ar_mine', symbol: 'AMD', enabled: true },
  ],
  events: [{ id: 'ev_mine' }],
  notifyBrowser: true,
});

describe('mergeDemoAlertsSeed', () => {
  it('adds the new sample rules and their firing, keeping every rule and setting of the visitor', () => {
    const out = JSON.parse(mergeDemoAlertsSeed(JSON.stringify(v1()), 1) ?? 'null') as Blob;
    const ids = out.rules.map((r) => r.id);
    expect(ids.slice(0, 2)).toEqual(['demo-alert-spy-flip', 'ar_mine']);
    expect(out.rules[0].enabled).toBe(false); // their edit stands
    for (const r of DEMO_ALERTS_SEED.rules) expect(ids).toContain(r.id);
    expect(out.events.map((e) => e.id)).toEqual(['ev_mine', 'demo-alert-event-tnote']);
    expect(out.notifyBrowser).toBe(true);
  });
  it('a deleted SPY rule (in the old seed) is not brought back', () => {
    const blob = { ...v1(), rules: [{ id: 'ar_mine' }] };
    const out = JSON.parse(mergeDemoAlertsSeed(JSON.stringify(blob), 1) ?? 'null') as Blob;
    expect(out.rules.map((r) => r.id)).not.toContain('demo-alert-spy-flip');
  });
  it('a browser already seeded with the new rules (before versions were recorded) is left alone', () => {
    const blob = { ...v1(), rules: [...v1().rules, { id: 'demo-alert-nvda-filing' }] };
    expect(mergeDemoAlertsSeed(JSON.stringify(blob), 1)).toBeNull();
  });
  it('a current browser, or a blob it can’t read, is never written', () => {
    expect(mergeDemoAlertsSeed(JSON.stringify(v1()), DEMO_ALERTS_SEED_VERSION)).toBeNull();
    expect(mergeDemoAlertsSeed('{ not json', 1)).toBeNull();
    expect(mergeDemoAlertsSeed('42', 1)).toBeNull();
  });
});
