/**
 * What the Alerts page knows about SEC EDGAR on this site, in one word, so every place that says it
 * (the kind tags, the dialog's SEC strip, the Review "Checks" line, the save toast) says the same
 * thing (W1-17). Getting this wrong misleads quietly: an EDGAR outage read as "Not set up" sends the
 * operator to a setting that is already set, and a check still running reads as a missing setup.
 *
 * - `notSetUp`: the API says SEC access isn't configured (SEC_USER_AGENT unset).
 * - `checking`: no answer yet (the opening check is still running).
 * - `down`: the read failed, or EDGAR didn't answer.
 * - `off`: public data is switched off on this server.
 * - `live`: EDGAR answered.
 */
import type { PublicDataState } from '@convexa/api';

export type SecSite = 'live' | 'notSetUp' | 'checking' | 'down' | 'off';

export function secSite(c: {
  phase: 'demo' | 'idle' | 'checking' | 'done';
  sec: PublicDataState | null;
  secFailed: boolean;
}): SecSite {
  if (c.phase === 'demo') return 'live';
  switch (c.sec) {
    case 'live':
      return 'live';
    case 'not_configured':
      return 'notSetUp';
    case 'off':
      return 'off';
    case 'unavailable':
      return 'down';
    default:
      // No answer: still running, or (phase done) the read itself failed.
      return c.phase === 'done' || c.secFailed ? 'down' : 'checking';
  }
}

export const SEC_DOWN_NOTE = 'SEC EDGAR didn’t answer';

/**
 * The Fired panel's tag after a check (W1-44): the time the check finished, never the render's, and
 * a word for how much of it answered. Updated only when every read answered; Source down when any
 * read failed, saying how many when some did answer (an outage never reads as a quiet check).
 */
export function firedTag(
  c: { checkedAt: number | null; reads: number; failed: number },
  time: (ms: number) => string = (ms) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
): { state: 'updated' | 'sourceDown'; detail?: string } {
  const at = c.checkedAt !== null ? `checked ${time(c.checkedAt)}` : undefined;
  if (c.failed <= 0) return { state: 'updated', detail: at };
  if (c.failed >= c.reads) return { state: 'sourceDown', detail: at };
  return { state: 'sourceDown', detail: `${c.failed} of ${c.reads} reads${at ? ` · ${at}` : ''}` };
}
