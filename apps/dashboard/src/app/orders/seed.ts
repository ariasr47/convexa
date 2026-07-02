/**
 * The trigger-seed parser (D2 policy — binding): a proposed structured Trigger is pre-seeded ONLY
 * when the rec's `entry_trigger` text states exactly ONE numeric level AND an unambiguous
 * direction word. Anything else ⇒ EMPTY — never guess (AC-6). The seed is advisory, always
 * editable, never armed unseen (it renders in the confirm dialog); the verbatim text is stored as
 * `trigger_source_text` and ALWAYS displayed (product constraint §7). The engine evaluates ONLY
 * the structured Trigger — never unparsed English (arch §3).
 */
import type { Trigger, TriggerKind } from './types';

// Direction vocabularies (FRONTEND contract §3.4):
//   above / over / break above / breaks above           ⇒ underlying_above
//   below / under / break below / breakdown below       ⇒ underlying_below
const ABOVE_WORDS = /\b(?:above|over)\b/i;
const BELOW_WORDS = /\b(?:below|under|breakdown)\b/i;

/** Every numeric level in the text (allows $ and thousands separators; "2x"/percent-free). */
const NUMBER_RE = /\$?\d+(?:,\d{3})*(?:\.\d+)?/g;

/**
 * Parse a rec's free-text `entry_trigger` into a proposed Trigger seed, or null (empty seed).
 * Rules: exactly ONE numeric level + exactly ONE direction class present; otherwise null.
 */
export function parseTriggerSeed(entryTrigger: string | null | undefined): Trigger | null {
  const text = (entryTrigger ?? '').trim();
  if (!text) return null;

  const numbers = text.match(NUMBER_RE) ?? [];
  if (numbers.length !== 1) return null; // zero or 2+ numbers ⇒ ambiguous ⇒ empty

  const hasAbove = ABOVE_WORDS.test(text);
  const hasBelow = BELOW_WORDS.test(text);
  if (hasAbove === hasBelow) return null; // no direction word, or BOTH ⇒ ambiguous ⇒ empty

  const level = Number(numbers[0].replace(/[$,]/g, ''));
  if (!Number.isFinite(level) || level <= 0) return null;

  const kind: TriggerKind = hasAbove ? 'underlying_above' : 'underlying_below';
  return { kind, level };
}
