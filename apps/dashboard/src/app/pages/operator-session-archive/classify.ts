import type { SittingResearchBaseParse } from './sittingBase';

export type ResearchEnvelope = 'list' | 'load' | 'coverage';

export type RequestUrlKind = 'absolute' | 'path-only' | 'same-origin-pages';

export type ClassifiedArm =
  | { kind: 'OriginEmpty' }
  | { kind: 'OriginPagesHost' }
  | { kind: 'OriginUnusable' }
  | { kind: 'OriginRelative404' }
  | { kind: 'OriginCors' }
  | { kind: 'Aborted' }
  | { kind: 'Unauthorized'; detail?: string }
  | { kind: 'OriginPages404' }
  | { kind: 'EmptyList'; detail?: string; framing?: string }
  | { kind: 'LoadMiss'; detail?: string; symbol?: string; et_date?: string }
  | { kind: 'NotStoring'; detail?: string }
  | { kind: 'ListStoreError'; detail?: string }
  | { kind: 'Unreadable'; detail?: string }
  | { kind: 'InvariantFault'; envelope: ResearchEnvelope }
  | { kind: 'Unclassified5xx' }
  | { kind: 'UnclassifiedTransport' }
  | { kind: 'UnparseableDate'; detail?: string }
  | { kind: 'Ready'; json: Record<string, unknown> };

export type ClassifyInput = {
  parse?: SittingResearchBaseParse;
  requestUrlKind?: RequestUrlKind;
  status?: number;
  json?: Record<string, unknown> | null;
  bodyText?: string;
  envelope?: ResearchEnvelope;
  transportError?: unknown;
  corsClassified?: boolean;
};

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name?: string }).name === 'AbortError'
  );
}

function errorToken(json: Record<string, unknown> | null | undefined): string | undefined {
  return typeof json?.error === 'string' ? json.error : undefined;
}

/**
 * First-match classifier for research GET outcomes (SPEC §2 table).
 * View-model maps Unclassified* + region warmth into offline / stale / coverage-unavailable.
 */
export function classifyResearchOutcome(input: ClassifyInput): ClassifiedArm {
  if (input.parse) {
    if (input.parse.kind === 'OriginEmpty') return { kind: 'OriginEmpty' };
    if (input.parse.kind === 'OriginPagesHost') return { kind: 'OriginPagesHost' };
    if (input.parse.kind === 'OriginUnusable') return { kind: 'OriginUnusable' };
  }

  const urlKind = input.requestUrlKind ?? 'absolute';
  if (urlKind === 'path-only' || urlKind === 'same-origin-pages') {
    return { kind: 'OriginRelative404' };
  }

  if (input.transportError != null && input.status == null) {
    if (isAbortError(input.transportError)) return { kind: 'Aborted' };
    if (input.corsClassified) return { kind: 'OriginCors' };
    return { kind: 'UnclassifiedTransport' };
  }

  const status = input.status;
  const json = input.json ?? null;

  if (status === 401) {
    return {
      kind: 'Unauthorized',
      detail: typeof json?.detail === 'string' ? json.detail : undefined,
    };
  }

  if (status === 404) {
    if (errorToken(json) === 'no_session_book') {
      return {
        kind: 'LoadMiss',
        detail: typeof json?.detail === 'string' ? json.detail : undefined,
        symbol: typeof json?.symbol === 'string' ? json.symbol : undefined,
        et_date: typeof json?.et_date === 'string' ? json.et_date : undefined,
      };
    }
    return { kind: 'OriginPages404' };
  }

  if (status != null && status >= 500) {
    const err = errorToken(json);
    if (err === 'session_archive_not_storing') {
      return {
        kind: 'NotStoring',
        detail: typeof json?.detail === 'string' ? json.detail : undefined,
      };
    }
    if (err === 'session_archive_store_error') {
      return {
        kind: 'ListStoreError',
        detail: typeof json?.detail === 'string' ? json.detail : undefined,
      };
    }
    if (err === 'session_book_unreadable') {
      return {
        kind: 'Unreadable',
        detail: typeof json?.detail === 'string' ? json.detail : undefined,
      };
    }
    return { kind: 'Unclassified5xx' };
  }

  if (status === 422) {
    return {
      kind: 'UnparseableDate',
      detail: typeof json?.detail === 'string' ? json.detail : undefined,
    };
  }

  if (status === 200 && json) {
    const vendorCalled = json.vendor_called === true;
    const authorizes = json.authorizes;
    if (vendorCalled || (authorizes != null && authorizes !== 'nothing')) {
      return { kind: 'InvariantFault', envelope: input.envelope ?? 'list' };
    }

    if (
      input.envelope === 'list' &&
      json.store === 'miss' &&
      json.count === 0 &&
      Array.isArray(json.books) &&
      json.books.length === 0
    ) {
      return {
        kind: 'EmptyList',
        detail: typeof json.detail === 'string' ? json.detail : undefined,
        framing: typeof json.framing === 'string' ? json.framing : undefined,
      };
    }

    return { kind: 'Ready', json };
  }

  return { kind: 'UnclassifiedTransport' };
}
