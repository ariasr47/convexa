/**
 * Unit — the six D8 disclosures render VERBATIM per UX §3.3 (FRONTEND contract §7 "copy.spec").
 * These strings are BINDING wording; any drift is a contract break, not a copy tweak.
 */
import { describe, expect, it } from 'vitest';
import {
  simulatedDisclosure, alreadyMetNotice, NOT_EVALUATED_TEXT, notEvaluatedTip, SCRIPTED_CHIP,
  scriptedStrip, staleRecDisclosure, GATE_SIGN_IN, dialogScenarioStrip,
} from './copy';

describe('the six binding D8 disclosures (verbatim)', () => {
  it('D8-1 — the mandatory SIMULATED confirm disclosure', () => {
    expect(simulatedDisclosure('TSLA')).toBe(
      'Simulated only — no real order is ever placed. Once confirmed, this order can trigger and ' +
      'fill unattended whenever a live stream for TSLA is open in this browser. Orders are ' +
      'stored in this browser — not synced to your account.',
    );
  });

  it('D8-2 — condition already met', () => {
    expect(alreadyMetNotice('TSLA', 'above', 252)).toBe(
      'Condition already met — TSLA is already above 252 on live data. This order will trigger ' +
      'on the first live update after you place it.',
    );
  });

  it('D8-3 — not evaluated (visible text + tooltip)', () => {
    expect(NOT_EVALUATED_TEXT).toBe('Waiting for live data — not currently evaluated');
    expect(notEvaluatedTip('TSLA')).toBe(
      'No live stream for TSLA is open in this tab (or the session is closed), so this order ' +
      'cannot trigger or fill right now — and it will not catch up on moves it missed. Open ' +
      "TSLA's ticker page during live hours to watch it. It can still expire on the clock, and " +
      'you can still cancel it.',
    );
  });

  it('D8-4 — scripted-scenario marking (chip + strip, and the dialog strip variant)', () => {
    expect(SCRIPTED_CHIP).toBe('SCRIPTED SCENARIO');
    expect(scriptedStrip('Break above call wall')).toBe(
      'Scripted scenario · Break above call wall — deterministic scripted output run through ' +
      'the real rec pipeline. Not a real AI read.',
    );
    expect(dialogScenarioStrip('Break above call wall')).toBe(
      'Scripted scenario — this plan came from the "Break above call wall" scenario, not a real AI read.',
    );
  });

  it('D8-5 — stale rec at Act', () => {
    expect(staleRecDisclosure('2026-07-02T14:00:00Z')).toBe(
      'Newer data has arrived since this read was pinned (as of 2026-07-02T14:00:00Z). The plan ' +
      'below reflects that older snapshot; the trigger still evaluates against live data only.',
    );
  });

  it('D8-6 — the sign-in gate on Act', () => {
    expect(GATE_SIGN_IN).toBe('Sign in to place a simulated order.');
  });
});
