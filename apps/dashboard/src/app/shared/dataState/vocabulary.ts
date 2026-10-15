/**
 * The data-state vocabulary: a closed set of words a widget may use to say what its data is
 * (canon 2026-10-13, "Owner rulings on the v4 design proposals", P-1 and P-2). Each word pairs with
 * a glyph (DataStateTag), so no state is carried by hue alone. Failures add the warning colour; no
 * state uses green or red. A new state needs a canon change before it can appear here.
 *
 * Design source: design/src/data/states.mjs (the state matrix and the hybrid desk read the same words).
 */
import type { PublicDataState, PublicSourceState } from '@convexa/api';

export type DataStateKey =
  | 'updated'
  | 'delayed'
  | 'computed'
  | 'lastGood'
  | 'sourceDown'
  | 'couldntLoad'
  | 'notSetUp'
  | 'off'
  | 'paused'
  | 'notLive'
  | 'sample'
  | 'demo'
  | 'signIn'
  | 'thirdParty'
  | 'local';

/** How a tag is drawn: `solid` current data, `warn` a failure, `quiet` deliberately absent,
 *  `dashed` sample data, `dotted` a third party's. */
export type DataStateKind = 'solid' | 'warn' | 'quiet' | 'dashed' | 'dotted';

export const DATA_STATES: Record<DataStateKey, { word: string; kind: DataStateKind }> = {
  updated: { word: 'Updated', kind: 'solid' },
  delayed: { word: 'Delayed by source', kind: 'solid' },
  computed: { word: 'Computed', kind: 'solid' },
  lastGood: { word: 'Last good copy', kind: 'warn' },
  sourceDown: { word: 'Source down', kind: 'warn' },
  couldntLoad: { word: 'Couldn’t load', kind: 'warn' },
  notSetUp: { word: 'Not set up', kind: 'quiet' },
  off: { word: 'Off', kind: 'quiet' },
  paused: { word: 'Paused', kind: 'quiet' },
  notLive: { word: 'Not live', kind: 'quiet' },
  sample: { word: 'Sample', kind: 'dashed' },
  demo: { word: 'Demo · sample data', kind: 'dashed' },
  signIn: { word: 'Sign in', kind: 'quiet' },
  thirdParty: { word: 'Live · TradingView', kind: 'dotted' },
  /** Design LOCAL (design/src/data/states.mjs): kept in this browser or the account, needs no feed.
   *  Not yet in canon P-2's closed set; an amendment is requested with the Wave 1 lane 4 report. */
  local: { word: 'Stored here', kind: 'solid' },
};

/**
 * The word for one part of a public-data answer.
 *
 * - `off` / `not_configured` / `unavailable` map straight across (Off, Not set up, Source down).
 * - `live` is current data: Delayed by source when the source itself publishes late (FINRA short
 *   interest, CFTC), otherwise Updated. `stale` (the source failed this cycle and an earlier copy is
 *   showing) makes it Last good copy.
 * - In demo builds every answer is sample data, whatever the state field says.
 *
 * Getting this wrong is silent and misleading: an outage that reads "Updated", or sample data that
 * reads as live. vocabulary.spec.ts pins the table.
 */
export function publicDataWord(
  state: PublicDataState,
  {
    stale = false,
    delayed = false,
    demo = false,
  }: { stale?: boolean; delayed?: boolean; demo?: boolean } = {},
): DataStateKey {
  if (demo) return 'demo';
  switch (state) {
    case 'off':
      return 'off';
    case 'not_configured':
      return 'notSetUp';
    case 'unavailable':
      return 'sourceDown';
    case 'live':
      if (stale) return 'lastGood';
      return delayed ? 'delayed' : 'updated';
  }
}

const SOURCE_WORDS: Record<PublicSourceState, DataStateKey> = {
  updated: 'updated',
  delayed: 'delayed',
  last_good: 'lastGood',
  source_down: 'sourceDown',
  not_set_up: 'notSetUp',
  off: 'off',
};

/**
 * The word for one row of an answer's `sources` list. The API decides each state (it alone knows
 * whether the copy it serves came from this cycle's fetch), so this is a straight lookup. A state
 * this build doesn't know (a newer server) reads `null`: the caller treats it as unknown rather
 * than guessing a word. Demo builds say sample data whatever the row says.
 */
export function sourceStateWord(
  state: PublicSourceState | string,
  { demo = false }: { demo?: boolean } = {},
): DataStateKey | null {
  if (demo) return 'demo';
  return Object.prototype.hasOwnProperty.call(SOURCE_WORDS, state)
    ? SOURCE_WORDS[state as PublicSourceState]
    : null;
}
