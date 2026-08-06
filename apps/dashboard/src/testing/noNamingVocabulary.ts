/**
 * TEST-SUPPORT ONLY (imported by specs, never by render code). The structure-name vocabulary both
 * enforcement layers share, so a DOM assertion and a source scan can never drift apart.
 *
 * This file lives OUTSIDE `features/trading/broker/` on purpose: it necessarily contains every banned
 * word, and Layer 2's glob is rooted at `broker/`, so keeping it here is what lets the scan stay
 * honest. Layer 2 additionally asserts that no non-spec module under `broker/` imports it.
 */
import { STRUCTURE_LABELS } from '@/features/trading/positions/structure';

/**
 * B1 — the whole label values. Imported from the real dictionary so the vocabulary cannot drift: a
 * spec may forbid production code an import and still require the TEST to make it. That is the point.
 */
export const STRUCTURE_LABEL_VALUES: readonly string[] = Object.values(STRUCTURE_LABELS);

/**
 * B2 — the bare-word denylist, given as regex SOURCES (SPEC §2.3, verbatim). Word-boundary-anchored,
 * NOT substring: a substring form would fire on `environment`, `irony`, `spreadsheet`, `collarbone`,
 * `customer`. So when B2 reports a hit, the correct reading is "a shape word is standing on its own
 * here" — and the fix is NEVER to drop the anchors and NEVER to delete the term.
 *
 * Derivation (auditable, not taste): every shape-naming word in any structure kind or label value,
 * UNION AC-4's eight enumerated words, MINUS a reasoned exclusion set. `calendar`/`diagonal` are kinds
 * whose labels are bare words. `covered`/`protective` are the ONLY handle on those two shapes, because
 * `call`/`put` are excluded — they collide with load-bearing shipped copy ("sends no strike, expiry, or
 * call/put") and are ordinary English in code. `long`/`short` are side words. `debit`/`credit` are the
 * feature's OWN settled rendered vocabulary. `shares` is already covered by B1's substring form.
 * Plurals are enumerated BECAUSE the terms are anchored.
 */
export const B2_TERMS: readonly RegExp[] = [
  /\bverticals?\b/i,
  /\bspreads?\b/i,
  /\bcondors?\b/i,
  /\bbutterfl(?:y|ies)\b/i,
  /\bstraddles?\b/i,
  /\bstrangles?\b/i,
  /\bcollars?\b/i,
  /\biron\b/i,
  /\bcalendars?\b/i,
  /\bdiagonals?\b/i,
  /\bcovered\b/i,
  /\bprotective\b/i,
  /\bcustom\b/i,
];

/**
 * The ONE narrow exception: framework/CSS API tokens no trader ever reads. Matched PER OCCURRENCE,
 * never per word — a bare shape word elsewhere in the same file still fires. Three binding rules:
 * (i) an allow-pattern may only ever be a framework or CSS API token, cited to its API, never authored
 * prose; (ii) it exempts the OCCURRENCE; (iii) adding one is a SPEC EDIT, not a test edit.
 */
export const B2_ALLOW_OCCURRENCES: readonly string[] = [
  'orientation="vertical"',
  "orientation={'vertical'}",
  'verticalAlign',
  'vertical-align',
];

/** AC-4's own eight words, inline — the anti-drift anchor. Trimming B2 turns that assertion red. */
export const AC4_WORDS: readonly string[] = [
  'vertical',
  'spread',
  'condor',
  'butterfly',
  'straddle',
  'strangle',
  'collar',
  'iron',
];

/** Strip the allow-listed OCCURRENCES, then test the remainder. Never weakens a term. */
export function b2HitsIn(text: string): string[] {
  let remainder = text;
  for (const allowed of B2_ALLOW_OCCURRENCES) remainder = remainder.split(allowed).join(' ');
  return B2_TERMS.filter((re) => re.test(remainder)).map(String);
}

/** B1 is a case-insensitive WHOLE-VALUE substring test (`Call debit spread` inside any text). */
export function b1HitsIn(text: string): string[] {
  const haystack = text.toLowerCase();
  return STRUCTURE_LABEL_VALUES.filter((v) => haystack.includes(v.toLowerCase()));
}
