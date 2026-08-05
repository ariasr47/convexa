/**
 * The standing product disclaimer — ONE source, rendered in two places (the site footer and the
 * Settings page). It used to be duplicated verbatim, with Settings' own comment instructing the
 * next reader to "reuse Landing's caption verbatim" — an invitation for the two to drift.
 *
 * R5a: the old wording ended "No brokerage connection." That became FALSE the instant a Webull
 * credential was stored — the app now reads a real brokerage. The claim that still holds, and the
 * one that actually matters, is narrower and stronger: the connection is READ-ONLY. Convexa's port
 * has no write method at all (`[no-real-order-path]` is structural, not a disabled button), so the
 * disclaimer says what is true rather than what used to be.
 *
 * `<strong>simulated</strong>` is kept: the sim book being paper is the load-bearing claim for a
 * user looking at P/L figures, and it must survive any future rewording. Wording is
 * owner-reviewable at GATE Q.
 */

/** The plain-text form — for any surface that cannot take markup (exports, meta tags, tests). */
export const DISCLAIMER_TEXT =
  'Convexa is an analysis tool. Positions in the sim book are simulated (paper); a connected ' +
  'brokerage is read-only — Convexa never places, changes, or cancels an order. Not investment ' +
  'advice.';

/**
 * The rendered form. A fragment, not a block: each site keeps its own `Typography` wrapper, its own
 * `data-testid` and its own placement — only the WORDS are shared.
 */
export function DisclaimerCopy() {
  return (
    <>
      Convexa is an analysis tool. Positions in the sim book are <strong>simulated</strong> (paper);
      a connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not
      investment advice.
    </>
  );
}
