/** Page-local research client — absolute sitting base + existing path; credentials omit. */

export const COVERAGE_TAIL = '/api/_research/session-archive/coverage';

export function listTail(symbol: string): string {
  return `/api/_research/session-books/${encodeURIComponent(symbol)}`;
}

export function loadTail(symbol: string, etDate: string): string {
  return `/api/_research/session-books/${encodeURIComponent(symbol)}/book?et_date=${encodeURIComponent(etDate)}`;
}

export function researchUrl(base: string, tail: string): string {
  const b = base.replace(/\/$/, '');
  const t = tail.startsWith('/') ? tail : `/${tail}`;
  return `${b}${t}`;
}

let loadAbort: AbortController | null = null;

/** Test hook — reset module-level load AbortController. */
export function resetLoadAbortForTests(): void {
  loadAbort = null;
}

export type FetchResearchArgs = {
  base: string;
  tail: string;
  token: string;
  /** When true, abort any prior in-flight load GET. */
  abortPreviousLoad?: boolean;
  signal?: AbortSignal;
};

export type FetchResearchResult = {
  status: number;
  json: Record<string, unknown> | null;
  bodyText: string;
};

export async function fetchResearch(args: FetchResearchArgs): Promise<FetchResearchResult> {
  const url = researchUrl(args.base, args.tail);
  if (url.startsWith('/')) {
    throw new Error('research client refused path-only URL');
  }

  let signal = args.signal;
  if (args.abortPreviousLoad) {
    loadAbort?.abort();
    loadAbort = new AbortController();
    signal = loadAbort.signal;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (args.token) {
    headers.Authorization = `Bearer ${args.token}`;
    headers['X-Metrics-Token'] = args.token;
  }

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    headers,
    signal,
  });

  const bodyText = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, bodyText };
}
