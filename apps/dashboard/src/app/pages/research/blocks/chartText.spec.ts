/**
 * The guidance whisker and the axis unit are read from the note's words; a wrong read draws a figure
 * the note never gave. Cases are the shapes the 14 published notes use (Oct 13, 2026).
 */
import { describe, expect, it } from 'vitest';
import { captionUnit, guideRange } from './chartText';

describe('guideRange — a guidance label read in its bar’s unit', () => {
  it.each<[string, number, [number, number] | null]>([
    ['61,500 ± 1,500', 61500, [60000, 63000]],
    ['108,000 ± 2%', 108000, [105840, 110160]],
    ['89,850–90,950', 90400, [89850, 90950]],
    ['197–202', 199.5, [197, 202]],
    // The suffix written once applies to both ends; a $B label on a $M chart is rescaled.
    ['$3.45–3.60B', 3525, [3450, 3600]],
    ['~$4.3–4.9B', 4622, [4300, 4900]],
    ['$214–216M', 215, [214, 216]],
    // No range in the words: no whisker.
    ['~$269M implied', 269, null],
    ['~$25B', 25, null],
    // A range that doesn't hold its own bar is a mismatch, not a whisker.
    ['197–202', 250, null],
  ])('%s at %d', (shown, value, want) => {
    const got = guideRange(shown, value);
    if (want === null) expect(got).toBeNull();
    else {
      expect(got?.lo).toBeCloseTo(want[0], 6);
      expect(got?.hi).toBeCloseTo(want[1], 6);
    }
  });
});

describe('captionUnit — the unit a caption names', () => {
  it.each<[string, string | null]>([
    ['Quarterly revenue, $M', '$·M'],
    ['Quarterly net sales, $B', '$·B'],
    ['GAAP operating margin by year, %', '·%'],
    ['Quarterly revenue, NT$ billions (3Q26 is the sum of the monthly reports)', 'NT$·B'],
    ['Share count and what could add to it, millions', '·M'],
    ['Share of quarterly revenue, by customer (the 10-Q names only Microsoft)', null],
  ])('%s', (caption, want) => {
    const u = captionUnit(caption);
    expect(u ? `${u.pre}·${u.suf}` : null).toBe(want);
  });
});
