# Site audit: production and staging, 2026-10-25

Three read-only audits (performance, SEO and sharing, security practices) of
https://convexa.pages.dev (production, the live build) and https://staging.convexa.pages.dev
(staging, the all-mock demo), merged, deduplicated and re-checked. GET requests and page loads
only: nothing was signed into, submitted or posted, and no repo file changed except this one.

## The answer in five lines

1. On a laptop every route paints fast (LCP 0.64–1.04 s on 30 route loads), but most content pages jump. CLS is about 0.21 on a laptop and 0.28–0.51 on a phone, and one cause dominates: the footer sits inside the 60vh route skeleton's first viewport and gets shoved off screen when the page chunk lands (PERF-02; re-checked: /credits CLS 0.513, footer shift 0.331).
2. On a phone every route is blank for 4.2–4.6 s, because the app graph is a second wave of chunks that index.html never preloads (mountApp starts at 2540 ms, after the entry finishes). Desk and note deep links take 6.2–7.4 s (PERF-01, PERF-05).
3. Shared links show the home page. All 13 non-post routes declare `canonical` and `og:url` as `https://convexa.pages.dev/` and carry the home title, so a desk or research link pasted into Slack or LinkedIn renders the home card (SEO-1/2; re-checked with the Slackbot UA on /ticker/SPY).
4. Security headers, CORS, CSP, mixed content and the console are clean: headers on 35/35 static paths, 0 CSP violations, 0 http:// requests, 0 uncaught page errors, and 2 console errors in 92 loads, both from the deliberate `/_ops/metrics` 404. The one high-severity gap: a signed-out `GET /api/scan/all` returns 200 with 69 rows that all carry flip, call_wall and put_wall, against the owner-only rule for licensed-derived data (SEC-1, re-checked).
5. Do batch B1 (shell layout, 3 files) and batch B4 (scanner auth gate) first. Then push: HEAD is 26 commits ahead of the deployed release 7810a87b, and the committed tab-title fix 730a8dec is one of those commits (SEO-3).

## Scope and method

- **Production:** https://convexa.pages.dev. `/api/health` reports release `7810a87ba81f…` (= `origin/main`), `market_data: not_live`. That is the live build with public data and Not-live states, as intended. Nothing here suggests demo mode for it.
- **Staging:** https://staging.convexa.pages.dev. All-mock demo: 0 `/api` calls and 0 third-party requests in 46 loads. No Pages Function is deployed there; `/api/*` returns the SPA shell.
- **Source references** are at HEAD `ea80a6c4`, and the cited line numbers were checked at HEAD. Live behaviour is release `7810a87b`.
- **Thresholds:** Core Web Vitals "good" means LCP ≤ 2.5 s and CLS ≤ 0.1.
- **Lens tooling:** Playwright 1.62.1 with Chrome, using Lighthouse's throttling constants:
  - mobile: 412x823, 562.5 ms RTT, 1.44 Mbps, CPU 4x
  - desktop: 1350x940, 40 ms RTT, 10 Mbps, CPU 1x
  - each lens reported a median of 2 runs; other tools were the chrome-devtools MCP (`lighthouse_audit`, traces), `curl -sI` and `curl` with crawler UAs.
- **Raw outputs:** `tmp/site-audit/{performance,seo-sharing,security-practices}/`, plus this synthesis's re-checks in `tmp/site-audit/synthesis/recheck/` (gitignored).

## Top 10, ranked by what a reviewer sees first, then by effort

Each finding was re-run with one recorded command. A re-check is a single run, where the lens figures are 2-run medians.

| #   | ID       | What a reviewer sees                                                                    | Effort        | Re-check result                                                                                                                                                                          |
| --- | -------- | --------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PERF-02  | Content pages jump as they load, on laptop and phone                                    | S             | prod /credits mobile: CLS **0.5134**; top shift **0.3305** = `footer[site-footer]` 0,551,412,272 → 0,0,0,0 at 5187 ms                                                                    |
| 2   | PERF-01  | Phone: blank screen for ~4.5 s on every route                                           | M             | prod / mobile: FCP = LCP = **4468 ms**; `index` 677→1426 ms, `mui` 677→2449 ms, then `mountApp` **2540**→3928 ms and `react` 2540→4070 ms                                                |
| 3   | SEO-1/2  | Shared desk/research links show the home card; canonicals all point at /                | M             | Slackbot UA on prod /ticker/SPY: `canonical` = `https://convexa.pages.dev/`, `og:url` = `https://convexa.pages.dev/`, `og:title` = the home title                                        |
| 4   | SEO-3    | Browser tabs on /ticker, /research, /scanner, /positions all read the home title        | XS (push)     | Playwright, prod: 5/5 routes title `Convexa — See the dealer positioning behind the price.`; fix `730a8dec` is not in `origin/main` (`merge-base --is-ancestor` exit 1)                  |
| 5   | PERF-03  | Landing jumps 41 px when the Not-live banner arrives                                    | S             | prod / mobile: `/api/health` 4510→5068 ms, then `main#main-content` 0,57 → 0,98 shift **0.0464** at 5079 ms                                                                              |
| 6   | PERF-05  | Phone: a desk deep link takes ~6 s                                                      | S             | prod /ticker/SPY mobile: LCP **6160 ms**; health 4262→4853, then PublicDesk chunk 4870→5745, then `/api/public-data/tickers/SPY` 6133→6720 (three serial hops)                          |
| 7   | PERF-04  | Desk and credits panels reflow when data lands                                          | S–M           | prod /ticker/SPY mobile: after data lands at 6720 ms, `Live from public data` block shifts **0.0528** (6772 ms) + **0.0682** (7025 ms)                                                  |
| 8   | PERF-06  | Clicking Ticker from the landing still downloads the desk; the landing prefetched the wrong one | S       | prod / mobile prefetched TickerDashboard 58,272 B, usePollingResource 40,481 B, Scanner 15,007 B, aiProviderLabels 5,178 B, useAlerts 4,643 B (123,581 B); none is used by prod /ticker  |
| 9   | SEO-4    | Any unknown URL returns 200 (Lighthouse and crawlers see a real page)                   | M             | `curl` prod `/this-page-does-not-exist-404`: **200** `text/html; charset=utf-8` 3910 B                                                                                                   |
| 10  | SEC-1    | Not visible on screen; anyone can `curl` the scanner board signed out                   | S             | `curl` prod `/api/scan/all`, no cookie: **200** `application/json` 26,315 B; **69** rows carry flip + call_wall + put_wall                                                               |

SEC-1 ranks 10th only because a reviewer won't see it on screen. On severity it is one of the four highs, and it is the cheapest of them to fix.

Recorded commands (outputs in `tmp/site-audit/synthesis/recheck/`, every one exit 0):

1. PERF-02: `node performance/scripts/perf-run.mjs synthesis/recheck/perf-mobile mobile 1 https://convexa.pages.dev/credits`, then `jq` over `.shifts` → `R2-perf02.txt`
2. PERF-01: `node performance/scripts/perf-run.mjs synthesis/recheck/perf-mobile mobile 1 https://convexa.pages.dev/` → `R1-perf01.txt`, waterfall in `perf-mobile/prod_root.mobile.1.json`
3. SEO-1/2: `curl -s -A 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' https://convexa.pages.dev/ticker/SPY | grep -oE '<link rel="canonical"[^>]*>|<meta property="og:(url|title)"[^>]*>'` → `R3-seo12.txt`
4. SEO-3: `node recheck/titles.cjs` (6 page loads, prints `document.title` after networkidle + 1.5 s) → `R5-seo3.txt`. Supporting: `git merge-base --is-ancestor 730a8dec origin/main` → exit 1, and `curl -s https://convexa.pages.dev/api/health | jq` → release 7810a87b (`R0-release.txt`)
5. PERF-03: `jq '{health:…, shifts:[.shifts[]|select(.v>0.005)…]}' perf-mobile/prod_root.mobile.1.json` → `R4-perf03.txt`
6. PERF-05: `node performance/scripts/perf-run.mjs synthesis/recheck/perf-mobile mobile 1 https://convexa.pages.dev/ticker/SPY`, then `jq` over `.requests` → `R6-perf05.txt`
7. PERF-04: `jq '[.shifts[]|select(.v>0.01)…]' perf-mobile/prod_ticker_SPY.mobile.1.json` → `R8-perf04.txt`
8. PERF-06: `jq '[.requests[]|select(.url|test("TickerDashboard|usePollingResource|Scanner-|aiProviderLabels|useAlerts"))…]' perf-mobile/prod_root.mobile.1.json` → `R10-perf06.txt`
9. SEO-4: `curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}' https://convexa.pages.dev/this-page-does-not-exist-404` → `R9-seo4.txt`
10. SEC-1: `curl -s -D recheck/R7-scan-all.hdr -o recheck/R7-scan-all.json -w '%{http_code} %{content_type} %{size_download}' https://convexa.pages.dev/api/scan/all && jq '[.. | objects | select(has("flip") and has("call_wall") and has("put_wall"))] | length'` → `R7-sec1.txt`

The re-checks agree with the lens medians to within 3%: / LCP 4468 vs 4606 ms, /credits CLS 0.513 vs 0.501, /ticker/SPY LCP 6160 vs 6246 ms and CLS 0.455 vs 0.456.

## Scores per route and site

### Page-load metrics

Playwright with Lighthouse throttling, 2-run medians (`tmp/site-audit/performance/pw/{mobile,desktop}-summary.json`). There is no Lighthouse Performance score: the MCP `lighthouse_audit` excludes that category and the Lighthouse CLI is not installed.

| Route                             | Prod mobile FCP / LCP ms | CLS   | TBT ms | Prod desktop LCP ms / CLS | Staging mobile FCP / LCP ms | CLS   | TBT ms | Staging desktop LCP ms / CLS |
| --------------------------------- | ------------------------ | ----- | ------ | ------------------------- | --------------------------- | ----- | ------ | ---------------------------- |
| /                                 | 4606 / 4606              | 0.052 | 0      | 674 / 0.034               | 4544 / 4544                 | 0.005 | 0      | 690 / 0.005                  |
| /ticker/SPY                       | 4294 / 6246              | 0.456 | 29     | 1044 / 0.209              | 4342 / 7988                 | 0.279 | 669    | 660 / 0.151                  |
| /ticker/NVDA/research             | 4324 / 7442              | 0.189 | 613    | 1024 / 0.076              | 4304 / 6408                 | 0.273 | 189    | 988 / 0.223                  |
| /research                         | 4416 / 6256              | 0.329 | 15     | 914 / 0.208               | 4356 / 5918                 | 0.121 | 1      | 888 / 0.106                  |
| /research/markets                 | 4292 / 5962              | 0.354 | 240    | 908 / 0.210               | 4492 / 6150                 | 0.297 | 254    | 904 / 0.212                  |
| /research/filings                 | 4280 / 5856              | 0.345 | 18     | 884 / 0.086               | 4366 / 5878                 | 0.251 | 0      | 922 / 0.088                  |
| /scanner (prod: sign-in wall)     | 4242 / 4910              | 0.065 | 0      | 692 / 0.046               | 4498 / 5394                 | 0.110 | 3      | 636 / 0.046                  |
| /positions (prod: sign-in wall)   | 4228 / 4888              | 0.077 | 0      | 700 / 0.046               | 4568 / 6496                 | 0.284 | 215    | 974 / 0.097                  |
| /methodology                      | 4270 / 5042              | 0.332 | 0      | 886 / 0.208               | 4526 / 5226                 | 0.281 | 0      | 910 / 0.210                  |
| /blog                             | 4280 / 5006              | 0.276 | 1      | 906 / 0.066               | 4474 / 5102                 | 0.211 | 10     | 1006 / 0.042                 |
| /blog/how-we-read-dealer-structure | 4294 / 5062             | 0.342 | 26     | 884 / 0.208               | 4486 / 5180                 | 0.291 | 42     | 916 / 0.210                  |
| /credits                          | 4292 / 5342              | 0.501 | 1      | 908 / 0.267               | 4384 / 5224                 | 0.352 | 15     | 890 / 0.210                  |
| /privacy                          | 4350 / 4952              | 0.381 | 0      | 926 / 0.208               | 4378 / 4970                 | 0.281 | 0      | 874 / 0.211                  |
| /terms                            | 4318 / 4906              | 0.383 | 0      | 904 / 0.208               | 4338 / 4906                 | 0.279 | 0      | 888 / 0.210                  |
| /this-page-does-not-exist-404     | 4306 / 4816              | 0.162 | 0      | 890 / 0.051               | 4328 / 4830                 | 0.110 | 0      | 888 / 0.028                  |

Mobile LCP misses 2.5 s on 30 of 30 route loads. Desktop LCP passes on 30 of 30. On mobile, 4 of 30 pass CLS ≤ 0.1: prod /, /scanner and /positions, and staging /. On desktop, 13 of 30 pass.

### Lighthouse

Chrome-devtools MCP. Accessibility, Best Practices, SEO and Agentic browsing (`tmp/site-audit/seo-sharing/lighthouse/*/report.json`, `tmp/site-audit/security-practices/lighthouse/*/report.json`).

`llms-txt` and `ard-schema` fail on every row, because both paths return the SPA shell (SEO-4). The last column lists the other failing weighted audits.

| Site / route                                       | Form    | A11y | BP  | SEO | Agentic | Other failing weighted audits                                     |
| -------------------------------------------------- | ------- | ---- | --- | --- | ------- | ----------------------------------------------------------------- |
| prod /                                             | mobile  | 100  | 100 | 100 | 50      | none                                                              |
| prod /                                             | desktop | 100  | 100 | 100 | 50      | none                                                              |
| prod /blog/how-we-read-dealer-structure            | mobile  | 100  | 100 | 100 | 50      | none                                                              |
| prod /methodology, /blog, /research                | mobile  | 100  | 100 | 92  | 50      | canonical (points at the home page)                               |
| prod /ticker/SPY                                   | mobile  | 97   | 100 | 92  | 29      | canonical; color-contrast (link 3.82:1); cumulative-layout-shift  |
| prod /ticker/SPY/technical-analysis                | desktop | 96   | 100 | 92  | 35      | canonical; color-contrast; cumulative-layout-shift (csp-xss is informative) |
| prod /this-page-does-not-exist-404                 | mobile  | 100  | 100 | 92  | 50      | canonical (http-status-code passes because it sees 200)           |
| staging /                                          | desktop | 100  | 100 | 66  | 50      | is-crawlable (intended: X-Robots-Tag noindex)                     |
| staging /positions                                 | mobile  | 94   | 100 | 66  | 50      | is-crawlable (intended); color-contrast (2.53:1); heading-order  |

### Security posture

Measured by the security-practices lens:

- **Headers:** HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options and COOP on 35/35 static paths per host, with one CSP per host.
- **Mixed content:** 0 http:// requests in 92 Playwright loads (23 routes × 2 hosts × 2 color schemes).
- **CSP violations:** 0.
- **Cookies on unauthenticated traffic:** 0.
- **http → https:** 301 on both hosts.
- **CORS:** an allowlist; only `https://convexa.pages.dev` gets ACAO.
- **Source maps:** not public. 0 `sourceMappingURL`, and the `.map` URLs return the shell.
- **Third-party requests:** 176 per production ticker route, all TradingView; 0 on staging.
- **Console:** 0 uncaught page errors. 2 console errors, both from `/_ops/metrics` (SEC-7). 4 headless GL driver warnings on /.
- **Failed requests:** 6, all TradingView `widget-sheriff` aborted with `net::ERR_ABORTED` (`security-practices/crawl/crawl.json`).

## Findings by severity

Each entry gives the site, evidence (tool, URL, number), the fix and the file. IDs are the lens IDs. Two pairs were merged (see "Duplicates merged").

### High

**PERF-02: route skeleton lets the footer into the first viewport; content routes score CLS 0.28–0.51 on mobile and about 0.21 on desktop.**
- **Site:** production and staging, every lazy route: /credits, /privacy, /terms, /methodology, /blog, /blog/<post>, /research, /research/markets, /research/filings, /ticker/SPY, /ticker/NVDA/research.
- **Evidence:**
  - The top shift is always `footer[site-footer]` 0,592,412,231 → 0,0,0,0, at 0.281 on mobile and 0.181 on desktop (`performance/pw/mobile-summary.json`).
  - The DevTools trace on prod /ticker/SPY gives CLS 0.46; CLSCulprits names the FOOTER (0.2807 at 6289 ms).
  - `<main>` measures 494 px during the fallback, which is 60vh of 823.
  - Experiment: injecting `[data-testid=route-fallback]{min-height:100dvh}` took /credits from 0.464/0.502 to 0.221/0.176 and /ticker/SPY from 0.459/0.456 to 0.175/0.169 (`performance/pw/exp-fallback-*`).
  - Re-check: /credits CLS 0.5134, footer shift 0.3305.
- **Fix:**
  - `RouteFallback` `minHeight: '100dvh'` (replacing `'60vh'`).
  - Sticky-footer shell: in the AppShell root, `minHeight: '100dvh', display: 'flex', flexDirection: 'column'`, and on `<main>`, `flex: '1 0 auto'`. Short pages (sign-in wall, 404) then keep the footer down too.
- **File:** `apps/dashboard/src/app/shared/ui/RouteFallback.tsx:29`, `apps/dashboard/src/app/shell/AppShell.tsx`.

**PERF-01: phone first paint is 4.2–4.6 s on every route, because the app graph is an unpreloaded second wave.**
- **Site:** production and staging (same bundle).
- **Evidence:**
  - Mobile, prod /: HTML 12→702 ms. Wave 1 is the 6 modulepreloaded chunks (162 KB br), 700→2463 ms, with `mui` 111.9 KB as the long pole. Only after the entry runs does `import('./mountApp')` fetch 28 more chunks (~146 KB br), 2546→4080 ms. FCP = LCP = 4540 ms (`performance/pw/mobile/prod_root.mobile.1.json`).
  - DevTools trace: LCP 4690 ms, of which 4613 ms is render delay (TTFB 77 ms); NetworkDependencyTree max critical path 7132 ms.
  - Experiment: injecting 28 `<link rel=modulepreload>` for the wave-2 chunks gave a median LCP of 3980 → 3392 ms (−588 ms; `performance/pw/exp.log`).
  - Re-check: LCP 4468 ms, with `mountApp` starting at 2540 ms.
- **Fix:** add a post `transformIndexHtml` hook that reads `ctx.bundle`, finds the chunk whose `facadeModuleId` ends in `src/mountApp.tsx`, and emits one `<link rel="modulepreload">` per file in its `imports` (plus the chunk itself). modulepreload fetches without evaluating, so `main.tsx`'s rule ("keep the application graph … out of evaluation until the build-selected workspace has been initialized") still holds.
- **File:** `apps/dashboard/vite.config.mts`.

**SEO-1/2: every non-post route's head is the home page's, so canonicals fold into / and share cards show the home card.**
- **Site:** production (staging is identical; see SEO-7).
- **Route:** /methodology, /blog, /research, /research/markets, /research/filings, /ticker/SPY, /ticker/NVDA/research, /credits, /privacy, /terms, /scanner, /positions, and any 404.
- **Evidence:**
  - curl: all 15 non-post SPA routes return the same 3910-byte shell with `<link rel="canonical" href="https://convexa.pages.dev/">`.
  - Playwright with JS on: canonical and `og:url` are still `/` on 13/13 non-post prod routes (`seo-sharing/rendered.json`).
  - Lighthouse SEO is 92 on /methodology, /blog, /research, /ticker/SPY and the 404, with the canonical audit at 0.
  - Crawler UAs (Slackbot, LinkedInBot, Twitterbot, facebookexternalhit, Discordbot, Googlebot) on /ticker/SPY get the home `og:title` (`seo-sharing/share-bots.txt`).
  - /methodology and /blog are in the sitemap yet canonicalize to /.
  - Only `/blog/<slug>` is right, via `tools/write-blog-heads.mjs`.
  - The og:image passes: 1200×630, 23,071 B, absolute URL.
  - Re-check: Slackbot UA on /ticker/SPY → canonical, og:url and og:title all home.
- **Fix:** turn the blog-heads step into a route-heads step.
  - From one table of static public routes, write `dist/<route>.html` with its own canonical, title, description, `og:title`, `og:description`, `og:url` and `twitter:*`. Pages already serves `dist/blog/<slug>.html` ahead of the `/*` fallback, so the same mechanism works for these.
  - For `/ticker/:symbol` and `/ticker/:symbol/research`, add a Pages Function that fetches `env.ASSETS` `/index.html` and rewrites the head per symbol with HTMLRewriter (for example "SPY dealer positioning — Convexa").
  - Fail the build when any listed route's head still names `/`.
- **File:** `tools/write-blog-heads.mjs`, `tools/build-dashboard.mjs`, `functions/ticker/[[path]].ts` (new).

**SEC-1: signed-out callers can read the scanner board and SPY structure history.**
- **Site:** production, through the Pages proxy.
- **Evidence:**
  - No-cookie GETs (`security-practices/api/`):
    - `/api/scan/all` → 200, 26,315 B, 69 rows, all with flip/call_wall/put_wall (newest `as_of` 2026-09-16, every row `status: error`, `market_data: not_live`).
    - `/api/scan` → 200, 8 rows, `view.authenticated=false`.
    - `/api/scan/SPY/history` → 200, 48 samples with `net_gex`, `atm_iv`, `hv_30d`, `stored_count: 576`.
  - Control: `/api/book`, `/api/broker/book`, `/api/broker/credential` and `/api/auth/ai-key` return 403 `auth_required`.
  - Source:
    - `get_scan` (`scan.rs:592`) and `get_scan_all` (`scan.rs:754`) take `MaybeUser` and never gate.
    - `get_structure_history` (`scan.rs:695`) has no user extractor.
    - The security matrix declares `optional_session()` for both scan paths (`apps/api/src/routes/mod.rs:2159-2160`).
    - `RequireAuth.tsx:8-9` claims these paths return 403.
    - On the live build with `not_live`, `ScannerRoute` mounts `ScannerNotLive`, which never calls `/api/scan*` (`app.tsx:218-223`). Gating therefore costs the UI nothing.
  - Re-check: 200, 26,315 B, 69 rows with all three fields.
  - The owner's 2026-10-18 rule: licensed-derived data reaches only the owner's signed-in account.
- **Fix:**
  - Gate the three GETs on `require_user` (`auth.rs:1083`), and owner-only if that is the licensing line.
  - Change `mod.rs:2159-2160` to `session()` and add `/api/scan/{symbol}/history` to the session list.
  - Auth is a listed test risk, so add one risk test asserting 403 `auth_required` on each path when signed out.
- **File:** `apps/api/src/routes/scan.rs`, `apps/api/src/routes/mod.rs`.

### Medium

**PERF-03: the Not-live banner mounts after `/api/health` answers and pushes every production page down 41 px.**
- **Site:** production, every route, first visit.
- **Evidence:**
  - Shift: `main#main-content` 0,57,412,766 → 0,98,412,725, worth 0.0464 on mobile right after health and 0.029 on desktop at 827 ms.
  - It is the largest landing shift: prod / CLS 0.052 against staging / 0.005, which has no banner.
  - It stacks on PERF-02 on deep links; it is still present after the fallback fix (`performance/pw/exp-fallback-fix/prod_ticker_SPY.mobile.1.json`).
  - Re-check: health 4510→5068 ms, shift 0.0464 at 5079 ms.
- **Fix:** on live builds, render a same-height `aria-hidden` placeholder while `mode === null`, and collapse only when health reports `live`, which production does not today.
- **File:** `apps/dashboard/src/app/shell/MarketDataNotice.tsx:72` (mounted at `AppShell.tsx:252`).

**PERF-05: desk and note deep links run serial hops (health → route chunk → data); mobile LCP is 6.2 s on SPY and 7.4 s on the NVDA note.**
- **Site:** production.
- **Evidence:**
  - Prod /ticker/SPY mobile: health 4357→4942 ms, then 12 PublicDesk chunks 4964→6080 ms, then `/api/public-data/tickers/SPY` 6221→6806 ms; LCP median 6246 ms.
  - /ticker/NVDA/research LCP median 7442 ms.
  - Desktop is unaffected (1044 and 1024 ms).
  - Re-check: health 4262→4853, PublicDesk 4870→5745, data 6133→6720, LCP 6160 ms.
- **Fix:** on live builds, call `routeLoaders.PublicDesk()` when `TickerDeskRoute` mounts, in parallel with health rather than after `mode` resolves, and start the public-ticker read from the route too.
- **File:** `apps/dashboard/src/app/app.tsx:207`.

**PERF-04: cards and legends render only once their fetch resolves, so content still shifts 0.12–0.17 after the PERF-02 fix.**
- **Site:** production and staging (/ticker/SPY, /credits).
- **Evidence:**
  - After the fallback-fix experiment, prod /ticker/SPY keeps 0.0528 + 0.0682 (PublicDesk's "Live from public data" block and its legend), and /credits keeps 0.0279 + 0.1409 (`section#treasury`, `#sources`) (`performance/pw/exp-fallback-fix/*.json`).
  - Re-check: 0.0528 at 6772 ms and 0.0682 at 7025 ms, after data landed at 6720 ms.
- **Fix:** fixed-height skeletons for PublicDesk's side cards and the provenance legend while `d` is undefined, and the same for CreditsPage's legend counts.
- **File:** `apps/dashboard/src/app/pages/ticker/public-desk/PublicDesk.tsx:340`, `apps/dashboard/src/app/pages/trust/CreditsPage.tsx`.

**PERF-06: the landing's idle prefetch loads the demo desk and the Scanner on production, which uses neither.**
- **Site:** production, / and then the click to /ticker.
- **Evidence:**
  - Prod / prefetches 14 chunks (138.8 KB). 11 of them (about 134 KB) are never requested by prod /ticker/SPY.
  - Coverage shows TickerDashboard evaluated with 179,614 of 195,830 B unused (`performance/pw/coverage.json`).
  - The SPA navigation to /ticker/SPY still fetches 10 scripts, 74 KB, and takes 1.2 s on mobile (`performance/pw/nav-mobile.json`).
  - Re-check: 5 of those chunks, 123,581 B, are prefetched on /.
- **Fix:** when `dataMode === 'live'`, prefetch `@/pages/ticker/public-desk/PublicDesk` instead of TickerDashboard and skip the Scanner (prod /scanner is a sign-in wall). Keep the current pair for the demo build.
- **File:** `apps/dashboard/src/app/shared/lib/prefetchRoutes.ts:16` (Scanner at `:26`).

**PERF-07: the `mui` manual chunk puts all of MUI, and React core, into wave 1 on every route.**
- **Site:** production and staging.
- **Evidence:**
  - `mui-Cf7yZ8VA.js` is 111.9 KB br / 365,445 B raw. Its private sourcemap lists `react/cjs/react.production.js`, `react/jsx-runtime`, `react-dom/cjs/react-dom.production.js` and `@popperjs/core` (`performance/chunks/composition.txt`).
  - 203–217 KB raw is unused on each of 30 routes.
  - On mobile, `mui` ends at 2463 ms while the other wave-1 files finish by 1999 ms.
  - Prod /positions runs 35 scripts before LCP, 23 of them under 2 KB br.
  - The `manualChunks` function routes `react` first (`vite.config.mts:143-150`), yet the sourcemap puts React in `mui`. The function is not doing what its comment says under Rolldown.
- **Fix:**
  - Replace the function with Rolldown `advancedChunks.groups` using explicit `test` regexes and priorities, so React, react-dom and scheduler land in `react`. Check with `tmp/site-audit/performance/scripts/chunk-composition.mjs`.
  - Drop the blanket `@mui/` group so component code ships with its routes, keeping @mui/system and @emotion shared.
  - Add a minimum chunk size.
- **File:** `apps/dashboard/vite.config.mts:132-166`.

**SEO-3: seven routes keep the home title on the live site.**
- **Site:** production and staging (/ticker/SPY, /ticker/NVDA/research, /research, /research/markets, /research/filings, /scanner, /positions).
- **Evidence:**
  - Playwright, JS on: `document.title` stays at the home title (`seo-sharing/rendered.json`).
  - Re-check: 5/5 routes sampled show the home title.
  - The fix is committed at HEAD (`730a8dec`; `app.tsx:200`, `RequireAuth.tsx:74`, `MarketsPage.tsx:99`, `FilingsPage.tsx:97`, `ResearchIndexPage.tsx:727`, `ResearchView.tsx:462`) but is not in `origin/main`, the deployed release.
- **Fix:**
  - Push main so Pages deploys it. That is the owner's call, since it is outward-facing.
  - Rename /methodology's title to end in " — Convexa" (`MethodologyPage.tsx:208`, per the `useDocumentTitle.ts` convention).
  - Optionally have the hook also update the canonical and `og:url` on navigation, as defence in depth behind SEO-1/2.
- **File:** none to deploy; `apps/dashboard/src/app/pages/methodology/MethodologyPage.tsx:208`.

**SEO-4: soft 404. Unknown URLs return 200 with the home head (robots `index, follow`, canonical /).**
- **Site:** production and staging.
- **Evidence:**
  - curl: `/this-page-does-not-exist-404` → 200, 3910 B. Only the client body says "Nothing at this address."
  - `/llms.txt`, `/manifest.webmanifest`, `/.well-known/ai-catalog.json` and `/blog/` also return the shell with 200, which fails Lighthouse llms-txt and ard-schema on every route.
  - `_redirects`: `/*  /index.html  200`.
  - Re-check: 200, `text/html`, 3910 B.
- **Fix:**
  - Add a Pages Functions middleware that matches HTML navigations against the route table (`app.tsx`) and serves the shell with status 404 and `X-Robots-Tag: noindex` for unmatched paths.
  - Minimum client fallback: `NotFound.tsx` sets `<meta name="robots" content="noindex">` on mount.
- **File:** `functions/_middleware.ts` (new), `apps/dashboard/src/app/pages/not-found/NotFound.tsx`.

**SEO-5: the hand-kept sitemap has 4 URLs, misses a published post and the content routes, and lists 2 URLs that canonicalize to /.**
- **Site:** production.
- **Evidence:**
  - `/sitemap.xml`: 753 B, 4 `<loc>`, no `<lastmod>`.
  - `/blog/how-convexa-is-built` serves 200 with a self canonical but is absent.
  - Also absent despite real content (JS-on text length): /ticker/NVDA/research (38,141 chars), /research/markets (8,499), /research/filings (7,911), /research (5,395), /credits (9,679), /privacy (5,074), /terms (3,636).
  - robots.txt passes.
- **Fix:** generate `dist/sitemap.xml` in the build step from the SEO-1 route table plus every post in `docs/blog/posts.json`, with `lastmod`, and delete `public/sitemap.xml`.
- **File:** `apps/dashboard/public/sitemap.xml`, `tools/build-dashboard.mjs`.

**SEO-6: blog heads are prerendered, but blog bodies are not.**
- **Site:** production and staging (both posts).
- **Evidence:**
  - JS off: title and canonical are right, but the body is the 213-char noscript paragraph with 0 `h1`. JS on: 6,143 and 4,745 chars.
  - The plain copies are correctly noindex, so they can't stand in.
- **Fix:** in `blogHead()`, inject the post's `<article>` (already emitted by `docs/blog/build_html.py`) inside `<div id="root">`. `createRoot` replaces it on mount, so JS users see no change.
- **File:** `tools/write-blog-heads.mjs`, `docs/blog/build_html.py`.

**SEO-7: staging pages declare production as their canonical and `og:url` and say `index, follow`.**
- **Site:** staging.
- **Evidence:**
  - Playwright: canonical and `og:url` are `https://convexa.pages.dev/` on 14/15 routes, robots `index, follow` on 15/15.
  - Staging is unindexed only because Cloudflare adds `x-robots-tag: noindex` to the branch alias (26/26 staging 200s, 0 prod). That header is not in `_headers`.
  - The prod and staging shells differ by one line (the bootstrap hash).
- **Fix:** in the `branchDefault` (staging) path of `tools/build-dashboard.mjs`, rewrite the built shell:
  - meta robots `noindex, nofollow`
  - `og:url` = `https://staging.convexa.pages.dev`
  - drop the canonical
  - add a sample-data marker to `og:title`
  - append `/*  X-Robots-Tag: noindex` to `dist/_headers`

  Use `dist/_headers` rather than a middleware because staging deploys no Functions. Production is unchanged and stays live.
- **File:** `tools/build-dashboard.mjs:19`.

**SEC-2: the public per-IP rate limit never triggers through the Pages proxy.**
- **Site:** production.
- **Evidence:**
  - `/api/health` reports `public_per_min: 30`, but 37 GETs to the expensive `/api/scan/universe` all returned 200, and 35 GETs to `/api/public-data/tickers/SPY` in 5 s also returned 200 with 0× 429 (`security-practices/ratelimit/xff-test.txt`).
  - `client_key` keys on the first `X-Forwarded-For` value (`rate_limit.rs:92-107`), and the proxy copies client headers verbatim (`functions/api/[[path]].ts:64-69`).
  - The sign-in budget uses the same key, so its bypass is inferred. No POST was sent.
- **Fix:**
  - In the proxy, set `X-Forwarded-For` from `CF-Connecting-IP` after the copy loop, or add `X-Convexa-Client-IP` plus a shared-secret header from a Pages secret.
  - In `client_key`, trust it only when the secret matches, and otherwise key on the right-most hop.
  - Add a `client_key` test (rate limiting guards auth).
- **File:** `functions/api/[[path]].ts`, `apps/api/src/middleware/rate_limit.rs:92`.

**SEC-3: TradingView's loader script runs in Convexa's origin, and its iframe is unsandboxed.**
- **Site:** production (/ticker, /ticker/SPY, /ticker/SPY/technical-analysis).
- **Evidence:**
  - Each route loads `s3.tradingview.com/…/embed-widget-advanced-chart.js` in the main frame, followed by 176 third-party requests. The iframe `sandbox` is null (`security-practices/crawl/crawl.json`).
  - Lighthouse csp-xss flags the `script-src` host allowlist (High, informative; BP still 100).
  - `frame-src` allows `s.tradingview.com`, which got 0 requests in 92 loads.
  - No cookies or non-GET requests reach TradingView.
- **Fix:**
  - First check TradingView's embedding terms (`TradingViewEmbed.tsx:2` says the widget is embedded "exactly as TradingView publishes it").
  - Then render the iframe directly (`https://www.tradingview-widget.com/embed-widget/<widget>/?locale=en#<json>`, the URL the loader builds) with `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`.
  - Drop `s3.tradingview.com` from `script-src` and `s.tradingview.com` from `frame-src`.
- **File:** `apps/dashboard/src/app/pages/ticker/technical-analysis/TradingViewEmbed.tsx:79-86`, `apps/dashboard/public/_headers:17`.

### Low

**PERF-08: demo transport and seeds ship in production's first wave.**
- **Site:** production.
- **Evidence:**
  - `streams-DrZnQwk0.js` is byte-identical on both hosts (30.0 KB br / 86,855 B raw).
  - About 72% of it is `demo/*` (transport.ts 31,484 B, public-data.ts 12,382 B, workspace.ts 8,376 B, and others; `performance/chunks/composition.txt`).
  - 89–90% of it is unused on prod routes.
- **Fix:** `if (dataMode === 'demo') return (await import('./demo/transport')).demoFetch(request);`, or a build-time `define`. Saves up to about 20 KB br in wave 1.
- **File:** `libs/api/src/lib/client.ts:4` (call at `:14`).

**PERF-09: fonts weigh 255 KB on the landing; the Archivo display face is a 91 KB full variable font, isn't preloaded, and swaps about 2.5 s after LCP on a phone.**
- **Site:** production and staging.
- **Evidence:**
  - `archivo-latin-standard-normal.woff2` (91,084 B) loads 4472→7050 ms against LCP 4540 ms.
  - The theme uses only weights 600 and 700.
  - CLSCulprits names it for a 0.0047 shift.
- **Fix:** instance Archivo to wght 600–700 and the one wdth the theme uses, subset it, and preload it from `index.html`. The size reduction is unmeasured because fontTools isn't installed.
- **File:** `apps/dashboard/src/styles.css`, `apps/dashboard/public/fonts/archivo/`, `apps/dashboard/index.html`.

**PERF-10: research charts force layout and a second render, giving TBT of 613 ms on prod /ticker/NVDA/research on mobile.**
- **Site:** production and staging.
- **Evidence:**
  - Long tasks of 434 and 724 ms run right after the note JSON lands.
  - CPU profile: 122 ms of self time in `useWidth`'s synchronous `getBoundingClientRect` (`performance/pw/profile-prod-nvda-research.txt`).
  - Staging's demo desk runs a 1 s tick that costs 54–65 ms per tick (`libs/api/src/lib/demo/workspace.ts:64-74`).
  - Desktop TBT is 0–46 ms.
- **Fix:** have `useWidth` seed from one ResizeObserver callback (or measure once at the note container) and draw charts in a viewBox, so the first render is final.
- **File:** `apps/dashboard/src/app/pages/research/useWidth.ts`.

**PERF-11: fonts and other unhashed public files are `max-age=0, must-revalidate`.**
- **Site:** production and staging.
- **Evidence:** `curl -sI` on `/fonts/…/*.woff2`, `/og-image.png` and `/favicon.*` → `public, max-age=0, must-revalidate` (`performance/headers/*.txt`). `_headers` has no `/fonts/*` block.
- **Fix:** `/fonts/*  Cache-Control: public, max-age=31536000, immutable`, renaming a font's path whenever its file changes; or `max-age=2592000` without `immutable`.
- **File:** `apps/dashboard/public/_headers`.

**API-CACHE (PERF-12 + SEC-6): no API response sets Cache-Control, and the proxy's own 404/502 responses skip the defence headers.**
- **Site:** production.
- **Evidence:**
  - Cache-Control appears 0 times across 22 production API responses.
  - `/api/health` and `/api/public-data/tickers/SPY` are `cf-cache-status: DYNAMIC`, each 554–585 ms on mobile throttling. Both gate PERF-03 and PERF-05.
  - `/api/auth/session` (per-user when signed in) has no `no-store`.
  - `/api/_metrics` and `/api/_research*` return 404 `text/plain` without HSTS, nosniff, XFO or Referrer-Policy: the early returns at `[[path]].ts:51` and `:56` skip the defence block at `:94-105`.
- **Fix:**
  - Health and public-data handlers send `Cache-Control: public, max-age=30, stale-while-revalidate=300`, or a TTL matched to each source.
  - Auth, broker and book responses send `no-store`.
  - Factor the four defence headers into one helper and apply it to the early returns. Leave `text/event-stream` untouched.
- **File:** `apps/api/src/routes/health.rs`, `apps/api/src/routes/public_data.rs`, `functions/api/[[path]].ts`.

**SEC-4: public `/api/health` discloses operating config the SPA does not read.**
- **Site:** production.
- **Evidence:**
  - 1349 B, including `rate_limit {public_per_min:30}`, `ai_meter {daily_cap:50, note:"…single api replica"}`, `metrics_auth`, `scanner.board` stats (69 rows, all `error`; 39,744 history samples), warm config and `gex_cache` counters (`security-practices/api/convexa.pages.dev_api_health.body`).
  - Proxied responses also carry `x-railway-edge`, `x-railway-request-id` and `x-hikari-trace`.
- **Fix:**
  - Keep health public but minimal: status, service, release, market_data and data_feed.
  - Move the rest into the token-gated `/api/_metrics`.
  - Optionally strip the `x-railway-*` and `x-hikari-*` headers in the proxy's response loop (`[[path]].ts:87-90`).
- **File:** `apps/api/src/routes/health.rs:551` (`rate_limit` at `:585`).

**SEC-5: a missing hashed asset gets the SPA shell as 200 `text/html` with a one-year immutable cache, and nothing catches `vite:preloadError`.**
- **Site:** both.
- **Evidence:**
  - `curl -sI /assets/Missing-abc123.js` → 200 `text/html`, `max-age=31536000, immutable`.
  - In the browser: "Failed to fetch dynamically imported module".
  - grep for `preloadError` or `ChunkLoadError` in `apps/dashboard/src` and `libs` finds 0 matches.
  - The `/assets/*.map` block only ever applies to the fallback, producing `immutable, no-store`.
- **Fix:**
  - Add a one-shot reload on `vite:preloadError` in the entry, with `sessionStorage` wrapped in try/catch.
  - Remove the dead `.map` block at `_headers:28-30`.
- **File:** `apps/dashboard/src/main.tsx`, `apps/dashboard/public/_headers`.

**SEC-7: `/_ops/metrics` on production always fires a 404 fetch and logs a console error; these are the only console errors in 92 loads (2, one per color scheme).**
- **Site:** production.
- **Evidence:** h1 "Operator metrics", `GET /api/_metrics` → 404 (blocked at the proxy by design), and the console logs "Failed to load resource … 404". Staging renders "Unavailable in the public demo." with no request.
- **Fix:** render the `DemoOperatorUnavailable`-style notice in live mode too, or drop both operator routes from the public bundle.
- **File:** `apps/dashboard/src/app/app.tsx:269-276`.

**SEC-8: no vulnerability-disclosure channel for a public repo with a live site.**
- **Site:** production and the repo.
- **Evidence:**
  - `/.well-known/security.txt` → the SPA shell (200 `text/html`).
  - No `SECURITY.md` at `origin/main`.
  - `gh api …/community/profile`: `security_policy=null`, health 42%.
- **Fix:** enable GitHub private vulnerability reporting, add a short `SECURITY.md`, and add `public/.well-known/security.txt` with `Contact: https://github.com/ariasr47/convexa/security/advisories/new` and an `Expires:` date. No email in the file.
- **File:** `apps/dashboard/public/.well-known/security.txt` (new), `SECURITY.md` (new).

**SEC-9: the CSP has no violation reporting and no Trusted Types.**
- **Site:** both.
- **Evidence:**
  - The one CSP has no `report-to` or `report-uri`.
  - Lighthouse trusted-types-xss is informative on 3 runs.
  - 0 violations in 92 loads, so the current policy fits.
- **Fix:** add a `Content-Security-Policy-Report-Only` header with `require-trusted-types-for 'script'` and a report endpoint. Enforce only after a clean run.
- **File:** `apps/dashboard/public/_headers:17`.

**SEO-8: each post's noscript fallback links to the wrong post through a 308.**
- **Site:** both.
- **Evidence:** on `/blog/how-convexa-is-built`, the noscript href is `/blog/plain/how-we-read-dealer-structure.html`; `.html` 308s to the extensionless URL.
- **Fix:**
  - In `blogHead()`, replace the noscript anchor with the post's own extensionless `/blog/plain/<slug>`.
  - In `index.html`, drop the `.html` suffix from the generic noscript link.
- **File:** `tools/write-blog-heads.mjs`, `apps/dashboard/index.html`.

**SEO-9: no structured data on any route.**
- **Site:** production.
- **Evidence:** 0 JSON-LD blocks on 16/16 prod and 15/15 staging rendered routes.
- **Fix:** add an Article JSON-LD per post from `posts.json` (add a date field), and a static WebSite + Organization block in `index.html`.
- **File:** `tools/write-blog-heads.mjs`, `apps/dashboard/index.html`.

**SEO-10 (optional): no web app manifest; the manifest probe paths return the shell.**
- **Site:** both.
- **Evidence:** `/manifest.webmanifest`, `/site.webmanifest` and `/manifest.json` → 200 `text/html` 3910 B. Favicons and theme-color pass.
- **Fix:** add `public/manifest.webmanifest` (with a 512 PNG icon, theme `#0B0F17`) and `<link rel="manifest">`; or let SEO-4's middleware 404 these paths.
- **File:** `apps/dashboard/public/manifest.webmanifest` (new), `apps/dashboard/index.html`.

## Fix plan: file-disjoint batches

No file appears in two batches, so batches can run in parallel lanes. Effort is a rough size: XS is minutes, S under half a day, M about a day. Order is by the ranking above.

| Batch                          | Findings                                                        | Files (exclusive to this batch)                                                                                                                                                                       | Effort | Re-measure with                                                       |
| ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| B0 Ship what is committed      | SEO-3 (and 673dd755 contrast, 96bf67c8 44px targets)           | none; push `main` (owner's call, outward-facing)                                                                                                                                                      | XS     | `node tmp/site-audit/synthesis/recheck/titles.cjs`                   |
| B1 Shell layout                | PERF-02, PERF-03                                                | `shared/ui/RouteFallback.tsx`, `shell/AppShell.tsx`, `shell/MarketDataNotice.tsx`                                                                                                                     | S      | `perf-run.mjs … mobile 2` on /credits, /ticker/SPY, /                 |
| B2 Build graph                 | PERF-01, then PERF-07                                           | `apps/dashboard/vite.config.mts`                                                                                                                                                                      | M      | `perf-run.mjs` on /; `chunk-composition.mjs`                          |
| B3 Route data flow             | PERF-05, PERF-04, PERF-06, SEC-7, SEO-3 methodology title      | `app/app.tsx`, `shared/lib/prefetchRoutes.ts`, `pages/ticker/public-desk/PublicDesk.tsx`, `pages/trust/CreditsPage.tsx`, `pages/methodology/MethodologyPage.tsx`, `shared/hooks/useDocumentTitle.ts` | S–M    | `perf-run.mjs` on /ticker/SPY; `nav-run.mjs`                          |
| B4 Scanner auth gate           | SEC-1                                                           | `apps/api/src/routes/scan.rs`, `apps/api/src/routes/mod.rs`, one risk test                                                                                                                           | S      | the SEC-1 curl above should return 403                                |
| B5 Generated heads and routing | SEO-1/2, SEO-4, SEO-5, SEO-6, SEO-7, SEO-8 (post part), SEO-9 (Article) | `tools/write-blog-heads.mjs`, `tools/build-dashboard.mjs` (+ spec), `public/sitemap.xml` (delete), `functions/ticker/[[path]].ts` (new), `functions/_middleware.ts` (new), `pages/not-found/NotFound.tsx`, `docs/blog/build_html.py` | M | `seo-render.cjs`; the share-bot curl loop in `share-bots.txt` |
| B6 Shell HTML and fonts        | PERF-09, SEO-8 (generic noscript), SEO-9 (site block), SEO-10  | `apps/dashboard/index.html`, `src/styles.css`, `public/fonts/archivo/`, `public/manifest.webmanifest` (new)                                                                                          | S      | `perf-run.mjs` on / (font bytes, Archivo timing)                      |
| B7 Static headers and client hardening | PERF-11, SEC-3, SEC-5, SEC-9, SEC-8                     | `public/_headers`, `technical-analysis/TradingViewEmbed.tsx`, `src/main.tsx`, `public/.well-known/security.txt` (new), `SECURITY.md` (new)                                                            | S–M    | `curl -sI` on /fonts/*; Lighthouse csp-xss on /ticker/SPY/technical-analysis |
| B8 API proxy and ops surface   | SEC-2, SEC-4, API-CACHE                                         | `functions/api/[[path]].ts`, `apps/api/src/middleware/rate_limit.rs`, `apps/api/src/routes/health.rs`, `apps/api/src/routes/public_data.rs`                                                           | M      | `xff-test.txt` loop (31st GET in 60 s → 429); `curl -D -` on health  |
| B9 Bundle and CPU hygiene      | PERF-08, PERF-10                                                | `libs/api/src/lib/client.ts`, `pages/research/useWidth.ts` (+ its chart callers), `libs/api/src/lib/demo/workspace.ts`                                                                                | S–M    | `coverage-run.mjs`; `profile-run.mjs` on /ticker/NVDA/research        |

Cross-batch notes:

- B5's noscript replacement must match the `index.html` that B6 leaves. Land B6 first or rebase B5 onto it.
- At the time of writing, another lane holds uncommitted edits to `apps/api/src/routes/mod.rs` and `apps/api/src/routes/public_data.rs`, along with `services/public_data/*` and the OpenAPI artifacts. B4 (`mod.rs`) and B8 (`public_data.rs`) start after that lane commits.
- In that working tree, the `/api/scan` matrix lines have already moved from `mod.rs:2159-2160` (HEAD) to `:2167-2168`. Use the HEAD line numbers in this report as anchors, not exact positions.
- B4 and B8 are both Rust but share no file.
- Every batch ends with `npm run verify` and `nx typecheck`, because Vitest does not typecheck.

## Duplicates merged

- **SEO-1 + SEO-2** became one finding. The canonical-to-/ and home-card symptoms come from the same 3910-byte shell, and one fix (per-route heads) covers both.
- **PERF-12 + SEC-6** became API-CACHE. Both report 0 Cache-Control headers on API responses; the merged fix sets public caching on health and public-data and `no-store` on auth.
- **Same root cause, kept separate because the fixes differ:**
  - SEO-4 (soft 404), SEC-5 (asset misses), SEC-8 (security.txt) and SEO-10 (manifest) all fall through `_redirects`' `/*  /index.html  200`.
  - PERF-03 and PERF-05 both wait on `/api/health`. API-CACHE shortens that wait on repeat visits; it doesn't remove it.

## Not checked

- **Lighthouse Performance score.** The MCP `lighthouse_audit` excludes the category and the Lighthouse CLI isn't installed. Playwright with Lighthouse throttling stands in.
- **INP.** No input was allowed; TBT is the proxy.
- **Real devices and field data.** Mobile CPU 4x was emulated on an M1 Pro shared with parallel audit agents, and there is no RUM or CrUX data. Re-checks are single runs.
- **Signed-in surfaces:**
  - session cookie flags (source says `HttpOnly; Secure; SameSite=Lax`, `auth.rs:866`; a `__Host-` prefix is optional hardening)
  - the sign-in rate limit (needs POST)
  - every page behind sign-in on production
- **The direct Railway origin.** Out of scope; checked only through the Pages proxy.
- **Fixes as built.** The two experiments (modulepreload, 100dvh fallback) were HTML/CSS injections in the test browser, not builds.
- **Archivo size after instancing.** fontTools isn't installed.
- **Accessibility beyond Lighthouse.** Lighthouse surfaced link contrast 3.82:1 on prod /ticker/SPY, plus 2.53:1 on staging /positions order-source text and an h6 heading-order issue. Commit 673dd755 ("text clears 4.5:1 in both schemes") is at HEAD but not deployed, so whether it resolves these is unverified.
- **TradingView's embedding terms** (a precondition of SEC-3).
- **The working tree at HEAD as a site.** Every live finding describes release 7810a87b. HEAD (`ea80a6c4`) is 26 commits ahead, and only SEO-3 was confirmed as fixed there.

## Fixed so far (2026-10-26, round 4 integration gate at `48deb0d2`)

This note is appended; nothing above was edited.

Batches B1, B2 and B4 are in `main`. These numbers are local measurements, not readings of the deployed sites: this note
made no request to either host. The audit's own figures, the first column below, describe production at `7810a87b` and
staging.

The two local columns measure builds of `b45b4af0` (before, the parent of B1 and B2) and `48deb0d2` (after):

- with the audit's Lighthouse throttling;
- 2 runs per URL, medians, before and after interleaved;
- served production-shaped (h2, TLS, brotli, Pages' pretty URLs);
- with the live build's `/api` faked: health `not_live`, about 580 ms on the phone.

Evidence is in `tmp/fidelity/integ4/perf/summary.json`.

| Finding (batch, commit) | Route, form | Audit | Local before | Local after |
| --- | --- | --- | --- | --- |
| PERF-02 and PERF-03 (B1, `c6b003bd`, `811ccd71`): CLS | prod /credits, mobile | 0.501 | 0.4542 | **0.1286** |
| | prod /ticker/SPY, mobile | 0.456 | 0.4140 | 0.0852 |
| | staging /credits, mobile | 0.352 | 0.3519 | 0.0761 |
| | staging /ticker/SPY, mobile | 0.279 | 0.2761 | 0.0010 |
| | prod /credits, desktop | 0.267 | 0.2935 | 0.0866 |
| | prod /ticker/SPY, desktop | 0.209 | 0.2091 | 0.0030 |
| | staging /credits, desktop | 0.210 | 0.2104 | 0.0011 |
| | staging /ticker/SPY, desktop | 0.151 | 0.1506 | 0.0012 |
| PERF-03 (B1, `811ccd71`): landing CLS | prod /, mobile | 0.052 | 0.0512 | 0.0082 |
| | prod /, desktop | 0.034 | 0.0340 | 0.0063 |
| PERF-01 (B2, `b3fbc065`): landing LCP, ms | prod /, mobile | 4606 | 4004 | 3390 |
| | staging /, mobile | 4544 | 3922 | 3378 |

- **PERF-02:**
  - The footer's shift is 0 in every "after" run. Before, it was 0.2758 to 0.2790 on the phone and 0.1487 to 0.2085
    on the laptop.
  - Short pages (the sign-in walls, the 404) keep the footer at the screen's bottom.
- **PERF-03:** with `/api/health` held 2.5 s, the bar's placeholder stands at the bar's own height (41 at 1440, 45 at
  390), and `<main>` moves 0px when the answer lands.
- **PERF-01:** `index.html` modulepreloads go from 5 to 34, on both builds.
- **SEC-1 (B4, `9d483d4d`, with the owner gate `d1f6ed0d` and `c9e8ebeb`):**
  - A signed-out `GET` of `/api/scan`, `/api/scan/all` or `/api/scan/{symbol}/history` now gets 403 `auth_required`.
    The audit had 200, with 69 rows carrying flip, call_wall and put_wall.
  - Signed in but not the owner, these and the other options-derived routes get 403 `owner_only`.
  - Proved by `cargo test -p api-rust` (exit 0):
    - `scan_reads_with_dealer_levels_refuse_a_signed_out_caller`;
    - `owner_only_routes_answer_the_owner_alone`;
    - `owner_only_routes_fail_closed_without_owner_emails`;
    - `every_operation_that_declares_a_dealer_level_is_owner_only_or_operator`.
  - Not curl-checked on production.
- **SEO-3 (`730a8dec`):** 19 distinct titles on each local build (spec 02's `titles.mjs`).

**Still open:**

- **Phone live `/credits` is over 0.1 (0.1286).** The remainder belongs to B3 and B6:
  - PERF-04, the treasury section and source legend reflowing when the data lands (the top shift is
    `section#treasury`, 0.0648);
  - PERF-09, the Plex 700 and Archivo font swap.
- **Mobile LCP is over 2.5 s on every route measured,** 3.4 to 6.4 s locally.
- **Laptop staging `/ticker/SPY` LCP went from 486 to 938 ms,** because the LCP element changed. Before, it was the
  footer disclaimer, painted inside the 60vh fill; now it is the desk's h2. FCP fell, 486 → 436 ms.

**What is pushed:** the local `origin/main` ref is `b45b4af0`, pushed at 02:05:45. It contains `730a8dec`, `673dd755`,
`96bf67c8` and `9d483d4d` (SEC-1). It does not contain B1, B2 or the owner gate (`c6b003bd`, `811ccd71`, `b3fbc065`,
`d1f6ed0d`). Whether production has deployed `b45b4af0` was not checked.

`48deb0d2` above is `421fcbc7` after the spec 08 fold (2026-10-26); the map is in
`docs/design/fidelity-2026-10-25/FIXES.md`, "SHA map after the spec 08 fold".
