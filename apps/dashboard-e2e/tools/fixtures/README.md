# Local HTTPS test certificate

`localhost-test-cert.pem` and `localhost-test-key.pem` are public test fixtures, not production
credentials. The self-signed certificate is valid from 2026-01-01 through 2046-01-01 and names only
`localhost`, `127.0.0.1`, and `::1`. Do not install it in an operating-system trust store or use it
outside local tests.

`serve-dist.mjs ... https` uses these files and refuses non-loopback bind hosts. Built-artifact
Playwright checks use HTTPS so the artifact's unchanged `upgrade-insecure-requests` CSP works in
WebKit. Only the automatically started local harness opts out of certificate verification, in both
the browser context and the server readiness probe. `BASE_URL` and `DEMO_HOSTED_URL` overrides keep
normal certificate verification and do not start the local server.

The default `serve-dist.mjs` protocol remains HTTP for existing callers. Vite development also stays
on HTTP. The local HTTPS harness reproduces artifact CSP enforcement, not production certificate
trust, Cloudflare behavior, or all other response headers.
