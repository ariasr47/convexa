/** Exact SPEC §4 strings — do not paraphrase. */

export const COPY = {
  appBar: 'Convexa · Session archive',
  documentTitle: 'Session archive — Convexa',
  readOnlyChip: 'read-only',
  authorizesLabel: 'Authorizes:',
  authorizesNothing: 'nothing',

  originLabel: 'API origin',
  originHelper:
    'Public API base URL. Not a secret. Not the Pages host. Refresh forgets it.',
  originTooltip:
    'Absolute http(s) origin of the API that serves the research family. A Pages host 404s /api/_research. Do not paste a metrics token here. Refreshing this tab forgets the origin and the token.',
  tokenLabel: 'Metrics token',
  tokenHelper: 'Same token as Operator Metrics. Not a trader session.',
  tokenTooltip:
    'Same operator token as Operator Metrics. Not a trader session. The value is never shown after Unlock, never put in the URL, and never announced.',
  unlock: 'Unlock',
  changeOriginOrToken: 'Change origin or token',

  lockedCaption:
    'Unlock with the API origin and the metrics token. A Pages host 404s the research family.',
  pagesHelper:
    'This page is on Pages. Type the API origin. Do not use this host.',

  originRejectedTitle: 'origin-rejected',
  originRejectedEmpty:
    'API origin is required. Type the API process base URL. Not a Pages host.',
  originRejectedPages:
    'Pages origin cannot serve the research family. Type a non-Pages API origin. Do not retry as a relative /api path.',
  originRejectedUnusable:
    'API origin must be an absolute http(s) URL. Relative /api paths 404 on Pages.',

  originBlockedTitle: 'origin-blocked',
  originBlockedBody:
    'This API origin 404s the research family. Not an empty corpus. Pages does not proxy /api/_research.',

  unauthorizedTitle: 'metrics_unauthorized',
  unauthorizedBody:
    'Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token',
  unauthorizedHelper: 'Same token as Operator Metrics. Not a trader session.',

  corsTitle: 'Cross-origin request blocked',
  corsBody:
    'The browser blocked this cross-origin research request. Not an empty corpus. Not unauthorized. Not a Pages research 404.',

  traderUnaffected:
    'Operator tool only — the trader bundle and SSE are unaffected.',
  loading: 'Loading session archive…',
  offline: 'Session archive readout unavailable.',
  retry: 'Retry',
  staleChip: "Couldn't refresh — keeping the last list.",

  booksFramingHit: 'RESEARCH READ — SESSION BOOK',
  booksFramingEmpty: 'RESEARCH READ — NO SESSION BOOK',
  booksProvenanceHit: 'loaded from session archive · no vendor call',
  booksProvenanceMiss: 'no vendor call',
  booksLicense: 'Our research · not redistributed on a trader route.',

  invariantTitle: 'invariant-fault',
  invariantLoad:
    'This stored book is not a legal research read. Not a digest. Not live market.',
  invariantList:
    'This session-books list is not a legal research read. Not a digest. Not live market.',
  invariantCoverage:
    'This coverage envelope is not a legal research read. Not a digest. Not live market.',

  coverageFraming: 'RESEARCH READ — SESSION ARCHIVE COVERAGE',
  coverageFramingWeekend:
    'RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES',
  coverageCommand: 'Command: archive-coverage',
  coverageEvidence: 'Evidence: this process',
  coverageSymbols: 'Symbols: SPY · QQQ · IWM',
  coverageCheckpoint: 'Checkpoint: after 16:00 America/New_York',
  coverageClosing: 'SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing',

  coverageUnavailable: 'Coverage readout unavailable.',
  coverageUnavailableCaption: 'Session books below are not coverage cells.',

  sourceTooltip:
    'Provenance token. Not a live quote. Coverage present is a loadable LiveMassive body — this list column is not that cell.',
  contractsCountTooltip:
    'Count of contracts in this stored book. Not a live chain. Rows are not shown.',
} as const;

/** Must never appear in origin-blocked Alert text (AC-21). */
export const ORIGIN_BLOCKED_BANNED = 'blocked occupancy';

export const BANNED_ON_SCREEN = [
  '$398',
  'weekly corpus',
  'Connected to ',
  '[PASS]',
  'Instrumentation: ON',
] as const;

export function originRejectedBody(reason: 'empty' | 'pages' | 'unusable'): string {
  if (reason === 'empty') return COPY.originRejectedEmpty;
  if (reason === 'pages') return COPY.originRejectedPages;
  return COPY.originRejectedUnusable;
}
