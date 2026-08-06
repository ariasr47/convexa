/**
 * Every trader-visible string this feature authors (SPEC §4, verbatim). NOT appended to `copy.ts`:
 * that file already carries the shipped per-position chip's tip and cannot be subjected to a literal
 * structure-name scan (SPEC §2.3). This module IS scanned — both arms of predicate set B run over it,
 * and Layer 3 asserts the outcome on every channel AC-4 names.
 *
 * RULE FOR ANY FUTURE EDIT: a shape word standing on its own here turns a test red. The fix is to
 * REWORD, never to weaken the predicate or delete a term (SPEC §9 item 5).
 *
 * Pure strings + tiny pure formatters. No React, no side effects, no imports but one type.
 */
import type { WithheldCause } from './grouping';

const legs = (n: number) => `${n} option leg${n === 1 ? '' : 's'}`;

export const GROUP_COPY = {
  /** `3 option legs · grouped by underlying` — part of the count element, not a sixth header item. */
  countClause: (legCount: number) => `${legs(legCount)} · grouped by underlying`,

  /** Keyboard-reachable tooltip on the count clause — never hover-only. */
  countTip:
    'Webull reports these as separate holdings on one underlying and sends no strike, expiry, or ' +
    'call/put. Grouping them by underlying is a fact; naming the shape would be a guess, so ' +
    "Convexa doesn't.",

  /** The disclosure button's accessible name. The chevron stays `aria-hidden`. */
  showLegs: (ticker: string, legCount: number) => `Show ${ticker}'s ${legs(legCount)}`,
  hideLegs: (ticker: string, legCount: number) => `Hide ${ticker}'s ${legs(legCount)}`,

  /**
   * AC-23 — the lone option leg (live twice on the captured book: NVDA, PLTR). PLAIN TEXT: no button,
   * no chevron, never a ghost one, no `netted by Convexa`. `as Webull reports it` names the count's
   * SOURCE; `not grouped` / `nothing to group` / `the only one on this ticker` were rejected because
   * they assert an ABSENCE OF SIBLINGS, which is the banned reading in other words.
   */
  loneLegClause: '1 option leg · as Webull reports it',
  loneLegTip:
    'Webull reports one option leg on this ticker — and sends no strike, expiry, or call/put with ' +
    "it. With one leg there's nothing to group and nothing to net, so this row shows that leg's own " +
    'figures, unchanged.',

  /** The basis label under the netted figure, so the figure never renders unlabeled. */
  nettedBy: 'netted by Convexa',

  /**
   * The basis-label tooltip. TRUE inserts ONE sentence before the existing tail; nothing else is
   * altered, so the clause is one auditable insertion rather than a rewrite. Absent from both: any
   * tolerance figure and any dollar difference (AC-10) — the FE cannot vouch the backend's 0.5%
   * round-trip bound, and the gap against Webull's own total is a number this app never displays.
   */
  nettedTip: (restsOnDerivedSize: boolean) =>
    restsOnDerivedSize
      ? 'Convexa added these legs up: for each one, per-contract cost × contract size × number of ' +
        'contracts, with money received counted against money paid. Webull doesn’t publish a ' +
        'combined cost for legs it reports separately, so this is Convexa’s arithmetic, not a ' +
        'Webull figure. For at least one of these legs Webull doesn’t state the contract size ' +
        'either, so Convexa worked that size out from the leg’s own Webull totals — expand the ' +
        'group for each leg’s own numbers and notes.'
      : 'Convexa added these legs up: for each one, per-contract cost × contract size × number of ' +
        'contracts, with money received counted against money paid. Webull doesn’t publish a ' +
        'combined cost for legs it reports separately, so this is Convexa’s arithmetic, not a ' +
        'Webull figure — expand the group for each leg’s own numbers and notes.',

  /** The sentence in the expanded panel (the shipped `leg-max-loss-note` slot's grammar). */
  expandedBasis: (restsOnDerivedSize: boolean) =>
    restsOnDerivedSize
      ? "Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent — and for " +
        'at least one leg Convexa also worked out the contract size it used, because Webull ' +
        "didn't state one. The legs it applies to say so on their own rows. Advisory context, not " +
        'a broker figure.'
      : "Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory " +
        'context, not a broker figure.',

  /**
   * The withheld tooltip. `{n}` is the count for the cause THE RENDERED LITERAL NAMES (the union
   * cardinality); `{m}` is `leg_count`. Never a leg's identity — "the short leg" would be a guess.
   * A group is ≥2 legs by definition, so `{m} legs` is always plural.
   */
  withheldTip: (cause: WithheldCause, n: number, m: number): string => {
    const have = n === 1 ? 'has' : 'have';
    switch (cause) {
      case 'cost_missing':
        return `Webull's feed doesn't carry a cost for ${n} of these ${m} legs. Convexa won't show a partial total — each leg's own cost is below.`;
      case 'size_missing':
        return `Convexa doesn't have a contract size for ${n} of these ${m} legs, so it can't turn their per-contract costs into dollars — and it won't guess one.`;
      case 'both_permanent':
        return `For ${n} of these ${m} legs Convexa is missing either the cost Webull sent or the contract size to turn it into dollars — so it won't net them, and it won't guess. Each leg's own figures are below.`;
      case 'unreadable':
        return `Convexa couldn't read the cost Webull sent for ${n} of these ${m} legs, so it won't net them this cycle. Refresh for another read — each leg's own cost is shown below.`;
      default:
        return `${n} of these ${m} legs ${have} no usable figure.`;
    }
  },

  /** The visible reason line inside the expanded panel — ONE line, for the cause actually shown. */
  withheldReason: (cause: WithheldCause, n: number, m: number): string => {
    const head = `Net entry needs all ${m} legs.`;
    const have = n === 1 ? 'has' : 'have';
    const be = n === 1 ? 'is' : 'are';
    switch (cause) {
      case 'cost_missing':
        return `${head} ${n} ${have} no cost in Webull's feed.`;
      case 'size_missing':
        return `${head} ${n} ${have} no contract size.`;
      case 'both_permanent':
        return `${head} ${n} ${be} missing a cost or a contract size.`;
      case 'unreadable':
        return `${head} ${n} couldn't be read this cycle.`;
      default:
        return head;
    }
  },

  /**
   * The visible count beside a withheld literal (AC-17a). ALWAYS the count for the cause the rendered
   * literal names, out of `leg_count`. Never the other cause's count, never their sum, never
   * `leg_count − supplied`, and never a second count.
   */
  withheldCount: (n: number, m: number) => `${n} of these ${m} legs`,
} as const;
