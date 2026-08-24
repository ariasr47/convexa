import createClient from 'openapi-fetch';
import type { paths } from '../generated/schema';

/** The one ordinary-HTTP transport for the public API facade. */
export const http = createClient<paths>({
  // openapi-fetch constructs an absolute Request; the adapter below turns this sentinel origin
  // back into the same-origin relative URL expected by browser callers and test doubles.
  baseUrl: 'http://localhost',
  credentials: 'same-origin',
  // Preserve the facade's observable fetch seam while openapi-fetch owns request typing.
  fetch: async (request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const preserveSignal = request.headers.has('x-convexa-preserve-signal');
    delete headers['x-convexa-preserve-signal'];
    const path = new URL(request.url).pathname;
    const requiresCredentials =
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/book') ||
      path.startsWith('/api/broker/') ||
      path.startsWith('/api/scan') ||
      path.startsWith('/api/positions/') ||
      (path.startsWith('/api/recommendation/') && request.method === 'POST');
    const init: RequestInit = requiresCredentials ? { credentials: request.credentials } : {};
    if (request.method !== 'GET' && request.method !== 'HEAD') init.method = request.method;
    if (Object.keys(headers).length) init.headers = headers;
    if (preserveSignal) init.signal = request.signal;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const body = await request.clone().text();
      if (body) init.body = body;
    }
    const url = new URL(request.url);
    const input = url.origin === 'http://localhost' ? `${url.pathname}${url.search}` : request.url;
    return Object.keys(init).length ? globalThis.fetch(input, init) : globalThis.fetch(input);
  },
});
