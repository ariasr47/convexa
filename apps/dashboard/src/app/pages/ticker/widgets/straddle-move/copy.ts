/**
 * Straddle-implied move — copy (SPEC §4; verbatim). The industry term "Expected move" appears ONLY
 * inside the tooltip — never as a label, heading or chip (AC-44). Three distinct unavailable
 * literals, chosen by closed lookup on the wire `state` token — never by inspecting a null (AC-46).
 */
export const TITLE = 'Straddle-implied move';

/** Basis line — visible without hovering, never tooltip-only. `{ANCHOR_LABEL}`/`{ANCHOR}` render
 *  VERBATIM from the payload, never derived client-side. */
export function basisLine(
  expiration: string,
  dte: number,
  anchorLabel: string,
  anchor: number | null,
): string {
  // A missing anchor reads "—", never "$0" (TD-10: `anchor_spot ?? 0` printed "spot $0").
  const spot = anchor == null ? '—' : `$${anchor.toFixed(2)}`;
  return `From the ${expiration} ATM straddle · ${dte} DTE · mid quotes · % of the ${anchorLabel} spot ${spot}`;
}

export const ADVISORY_LINE =
  'What options are priced for — not a forecast, not a probability, not a scored signal.';

export const TOOLTIP =
  'The at-the-money call plus put, priced together. Traders call this the "expected move" — it is ' +
  'what the options market charges for the move, not a prediction and not a confidence interval. ' +
  'Convexa shows it because it makes a target or a stop defensible, not because it is likely to be ' +
  'right.';

/** The three distinct unavailable causes, closed-lookup on `StraddleMoveState`. */
export const NO_QUOTE = 'No ATM straddle quote this cycle.';
export const UNAVAILABLE = 'Straddle-implied move unavailable this cycle.';
export const NO_EXPIRATION_IN_WINDOW = 'No expiration inside your current window.';

export const WIDE_QUOTES_MARKER = 'Wide quotes';

/** `± $X.XX  (± Y.Z%)` — mono/tabular headline, never a heading element. */
export function headline(moveDollars: number, movePct: number): string {
  const sign = moveDollars >= 0 ? '±' : '±';
  return `${sign} $${Math.abs(moveDollars).toFixed(2)}  (${sign} ${Math.abs(movePct).toFixed(1)}%)`;
}

const EXPIRY_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * The card's title over data (canon P-10): the move and where the walls sit against it, e.g.
 * "Options price a ±$2.48 move (±0.4%) to Oct 9; both walls sit outside it". A wall is inside the
 * move when it is no further from the spot than the move. Without a spot or a wall, the move alone.
 */
export function moveFinding({
  moveDollars,
  movePct,
  expiration,
  spot,
  callWall,
  putWall,
}: {
  moveDollars: number;
  movePct: number;
  expiration: string;
  spot: number | null;
  callWall: number | null;
  putWall: number | null;
}): string {
  const t = Date.parse(`${expiration}T12:00:00Z`);
  const when = Number.isFinite(t) ? EXPIRY_LABEL.format(new Date(t)) : expiration;
  const lead = `Options price a ±$${Math.abs(moveDollars).toFixed(2)} move (±${Math.abs(movePct).toFixed(1)}%) to ${when}`;
  const ok = (v: number | null): v is number => v != null && Number.isFinite(v);
  if (!ok(spot) || (!ok(callWall) && !ok(putWall))) return lead;
  const inside = (w: number) => Math.abs(w - spot) <= Math.abs(moveDollars);
  const call = ok(callWall) ? inside(callWall) : null;
  const put = ok(putWall) ? inside(putWall) : null;
  if (call !== null && put !== null) {
    if (call && put) return `${lead}; both walls sit inside it`;
    if (!call && !put) return `${lead}; both walls sit outside it`;
    return `${lead}; the ${call ? 'call' : 'put'} wall sits inside it`;
  }
  const which = call !== null ? 'call' : 'put';
  return `${lead}; the ${which} wall sits ${(call ?? put) ? 'inside' : 'outside'} it`;
}
