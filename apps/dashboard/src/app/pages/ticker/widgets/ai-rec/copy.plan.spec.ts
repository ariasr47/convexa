/**
 * copy.plan.spec.ts — rec-absence-literals-hole. The new copy: the value-slot absence literals and
 * `literalCopy`, the one shared mapping table both renderers read; plus the plan-scope caption.
 */
import { describe, expect, it } from 'vitest';
import {
  GROUNDING_BLOCK_ABSENT,
  GROUNDING_CARD,
  literalCopy,
  PLAN_FIELD_COPY,
  PLAN_FIELD_LABEL,
  PLAN_FIELDS_NOT_CHECKED,
  REASONING_PROSE_NOT_CHECKED,
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

  it('literalCopy is total over the closed set; only `dash` carries the reserved mark', () => {
    for (const k of ['value', 'not_set', 'unavailable', 'not_given', 'unrecognized'] as const) {
      expect(literalCopy(k).text).not.toContain(RESERVED);
      expect(literalCopy(k).tip.length).toBeGreaterThan(0);
    }
    expect(literalCopy('dash').text).toBe(RESERVED);
  });
});

describe('rec-plan-scope-caption · PLAN_FIELDS_NOT_CHECKED', () => {
  it('PLAN_FIELDS_NOT_CHECKED names every PLAN_FIELD_LABEL and stays disjoint from siblings', () => {
    for (const label of Object.values(PLAN_FIELD_LABEL)) {
      expect(PLAN_FIELDS_NOT_CHECKED).toContain(label);
    }
    expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(REASONING_PROSE_NOT_CHECKED);
    expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(GROUNDING_BLOCK_ABSENT);
    for (const line of Object.values(GROUNDING_CARD)) {
      expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(line);
    }
    for (const lit of [
      PLAN_FIELD_COPY.notGiven.text,
      PLAN_FIELD_COPY.unavailable.text,
      PLAN_FIELD_COPY.unrecognized.text,
      '—',
    ]) {
      expect(PLAN_FIELDS_NOT_CHECKED).not.toBe(lit);
    }
    expect(PLAN_FIELDS_NOT_CHECKED.toLowerCase()).not.toMatch(
      /\b(verified|confirmed|validated|approved|safe|trusted|grounding|hallucinated|suspect|invalid)\b/,
    );
  });
});
