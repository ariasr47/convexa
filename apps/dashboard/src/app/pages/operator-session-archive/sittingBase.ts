export type SittingResearchBaseParse =
  | { kind: 'OriginEmpty' }
  | { kind: 'OriginPagesHost' }
  | { kind: 'OriginUnusable' }
  | { kind: 'usable'; base: string };

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isPagesHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'pages.dev' || h.endsWith('.pages.dev');
}

/** True when dashboard `location.host` (hostname[:port]) is a Pages host. */
export function documentHostIsPages(host: string): boolean {
  const hostname = host.split(':')[0] ?? '';
  return isPagesHost(hostname);
}

/**
 * Trim-first parse of the sitting research API origin (SPEC §2).
 * Canonical usable form: scheme + lowercased host + non-default port; no path.
 */
export function parseSittingResearchBase(
  raw: string | null | undefined,
): SittingResearchBaseParse {
  if (raw == null) return { kind: 'OriginEmpty' };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'OriginEmpty' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'OriginUnusable' };
  }

  if (url.username || url.password) return { kind: 'OriginUnusable' };
  if (url.search || url.hash) return { kind: 'OriginUnusable' };

  const path = url.pathname;
  if (path !== '' && path !== '/') return { kind: 'OriginUnusable' };

  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  // Node may keep brackets on IPv6 hostname (`[::1]`); strip for comparisons.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (isPagesHost(hostname)) return { kind: 'OriginPagesHost' };

  if (scheme === 'https') {
    return { kind: 'usable', base: canonicalize(scheme, hostname, url.port) };
  }

  if (scheme === 'http' && LOOPBACK_HOSTS.has(hostname)) {
    return { kind: 'usable', base: canonicalize(scheme, hostname, url.port) };
  }

  return { kind: 'OriginUnusable' };
}

function canonicalize(scheme: string, hostname: string, port: string): string {
  const defaultPort =
    (scheme === 'https' && port === '443') || (scheme === 'http' && port === '80');
  const hostPart = hostname.includes(':') ? `[${hostname}]` : hostname;
  if (!port || defaultPort) return `${scheme}://${hostPart}`;
  return `${scheme}://${hostPart}:${port}`;
}
