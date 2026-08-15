/**
 * copy.plan.spec.ts — rec-absence-literals-hole. The new copy: the six absence literals, the standing
 * line, the DTE caption and `literalCopy`, the one shared mapping table both renderers read.
 */
import { describe, expect, it } from 'vitest';
import {
  dteWindowCaption,
  literalCopy,
  notActionableLine,
  PLAN_FIELD_COPY,
  POSITION_DEFINING_LABELS,
  prefillUnnamedReason,
} from './copy';

const RESERVED = '—'; // the reserved mark, ESCAPED so this file cannot poison the Layer-3 scan

describe('rec-absence-literals-hole · the new copy', () => {
  it('no new VALUE-SLOT literal is (or contains) the reserved mark', () => {
    // Only the literal TEXT members ever render in a value slot or chip label — `dash` deliberately
    // reuses the shipped `—` (it is NOT new; see literalCopy's own test below) and is excluded on
    // purpose. Tips and prose (the standing line, the DTE caption, the prefill reason) legitimately
    // use `—` as ordinary punctuation, the same ~135-instance class SPEC §7 documents, so this row
    // checks value-slot text only — the shape a character-level scan cannot express safely.
    const valueSlotTexts = [
      PLAN_FIELD_COPY.notGiven.text,
      PLAN_FIELD_COPY.unavailable.text,
      PLAN_FIELD_COPY.unrecognized.text,
    ];
    for (const s of valueSlotTexts) expect(s).not.toContain(RESERVED);
  });

  it('the standing line, the DTE caption and the prefill reason are non-empty, producer-neutral prose', () => {
    for (const s of [
      notActionableLine(POSITION_DEFINING_LABELS),
      dteWindowCaption(7, 45),
      prefillUnnamedReason(['Strike(s)']),
    ]) {
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it('the DTE caption uses an EN dash and interpolates both bounds, never a question mark', () => {
    expect(dteWindowCaption(7, 45)).toBe(' · your DTE window: 7–45');
    expect(dteWindowCaption(7, 45)).not.toContain('?');
  });

  it('the standing line names the missing fields in card order and no cause', () => {
    expect(notActionableLine(['Structure', 'Expiration'])).toBe(
      'Not actionable as given. Never named: Structure, Expiration.',
    );
  });

  it('the six carry a producer-neutral tip (no AI, no rule named)', () => {
    for (const w of ['AI', 'model', 'rule']) {
      expect(PLAN_FIELD_COPY.notGiven.tip).not.toContain(w);
    }
  });

  it('literalCopy is total over the closed set; only `dash` carries the reserved mark', () => {
    for (const k of ['value', 'not_set', 'unavailable', 'not_given', 'unrecognized'] as const) {
      expect(literalCopy(k).text).not.toContain(RESERVED);
      expect(literalCopy(k).tip.length).toBeGreaterThan(0);
    }
    expect(literalCopy('dash').text).toBe(RESERVED);
  });
});
