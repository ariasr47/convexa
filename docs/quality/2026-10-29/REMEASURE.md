# Live re-measure after Convexa 1.0.0

_Production and staging at `3f88a6a9` (v1.0.0), measured 2026-10-29 between 16:28 and 16:43 PDT
with the site audit's own runner. Compared with the audit's run of 2026-10-25
(`docs/quality/2026-10-25/SITE-AUDIT.md`). Two releases landed in between, so the change covers
both: 2026-10-26 (`6998ffac`: PERF-01, PERF-02, PERF-03) and 1.0.0 (PERF-04, -05, -06, -08, -09,
-10, -11)._

## The answer

- **Pages no longer jump.** On production, layout shift was 0.052–0.501 on a phone and 0.034–0.267
  on a laptop. It is now 0.001–0.029 and 0.001–0.018.
- **Phones paint about 0.45 s sooner, but still late.**
  - Production first paint: 4.23–4.61 s → 3.73–4.34 s.
  - Main content (LCP): 4.61–7.44 s → 4.34–6.21 s.
  - The worst main-thread blocking (TBT, /ticker/NVDA/research) fell from 613 ms to 196 ms.
- **Laptops were already fast and still are.** First paint 0.57–0.65 s, LCP 0.65–1.05 s, both
  unchanged within noise.

## Method

- **Runner:** `tmp/site-audit/performance/scripts/perf-run.mjs`, unchanged. It makes GET page loads
  only: no clicks, no input.
- **Profiles:**
  - Mobile: Lighthouse's Slow 4G, meaning 562.5 ms RTT, 180 KB/s down, 4× CPU, at 412×823.
  - Desktop: 40 ms RTT, 10 Mbps, 1× CPU, at 1350×940.
- **Runs:** 2 runs per URL, medians by `summarize.mjs`, across all 30 URLs in `scripts/urls.txt`
  (15 production, 15 staging).
- **Result:** both profiles exited 0, with 60 + 60 runs and 0 navigation errors.
- **Noise:**
  - The median gap between a URL's two runs is 28 ms for phone first paint, 36 ms for phone LCP
    and 32 ms on a laptop.
  - The largest phone LCP gap is 1,116 ms, on one URL.
  - Changes under about 100 ms are noise.
- **Machine:** an M1 Pro running none of the project's processes. The owner's Steam client used
  about one core (load 6.6 at the start). The audit doesn't record its machine's load.
- **Raw data:** `tmp/remeasure-2026-10-29/` (gitignored):
  - `pw/{mobile,desktop}/*.json`, one file per run;
  - `pw/*-summary.json`;
  - `compare-{mobile,desktop}.tsv`, one row per URL, from `compare.mjs`.

## Production, before → after (medians of 2)

Columns 2–5 are phone figures; the last column is the laptop's layout shift.

| Route | First paint (s) | LCP (s) | Layout shift | TBT (ms) | Laptop layout shift |
| --- | --- | --- | --- | --- | --- |
| / | 4.61 → 4.34 | 4.61 → 4.34 | 0.052 → 0.001 | 0 → 0 | 0.034 → 0.001 |
| /blog | 4.28 → 3.84 | 5.01 → 4.56 | 0.276 → 0.001 | 1 → 0 | 0.066 → 0.001 |
| /blog/how-we-read-dealer-structure | 4.29 → 3.85 | 5.06 → 4.61 | 0.342 → 0.011 | 26 → 16 | 0.208 → 0.001 |
| /credits | 4.29 → 3.84 | 5.34 → 4.67 | 0.501 → 0.014 | 1 → 0 | 0.267 → 0.004 |
| /methodology | 4.27 → 3.84 | 5.04 → 4.61 | 0.332 → 0.003 | 0 → 0 | 0.208 → 0.001 |
| /positions | 4.23 → 3.80 | 4.89 → 4.46 | 0.077 → 0.001 | 0 → 0 | 0.046 → 0.001 |
| /privacy | 4.35 → 3.85 | 4.95 → 4.49 | 0.381 → 0.002 | 0 → 0 | 0.208 → 0.001 |
| /research | 4.42 → 3.88 | 6.26 → 5.39 | 0.329 → 0.001 | 15 → 0 | 0.208 → 0.001 |
| /research/filings | 4.28 → 3.73 | 5.86 → 5.21 | 0.345 → 0.029 | 18 → 26 | 0.086 → 0.018 |
| /research/markets | 4.29 → 3.78 | 5.96 → 5.33 | 0.354 → 0.029 | 240 → 120 | 0.21 → 0.003 |
| /scanner | 4.24 → 3.75 | 4.91 → 4.41 | 0.065 → 0.001 | 0 → 0 | 0.046 → 0.001 |
| /terms | 4.32 → 3.86 | 4.91 → 4.45 | 0.383 → 0.003 | 0 → 0 | 0.208 → 0.001 |
| /this-page-does-not-exist-404 | 4.31 → 3.85 | 4.82 → 4.40 | 0.162 → 0.001 | 0 → 0 | 0.051 → 0.001 |
| /ticker/NVDA/research | 4.32 → 3.83 | 7.44 → 6.21 | 0.189 → 0.001 | 613 → 196 | 0.076 → 0.001 |
| /ticker/SPY | 4.29 → 3.83 | 6.25 → 5.26 | 0.456 → 0.005 | 29 → 38 | 0.209 → 0.001 |

Staging moved the same way. Its rows are in `compare-mobile.tsv` and `compare-desktop.tsv`.

## What is still slow

1. **A phone's first paint is limited by bytes.** On the landing page (`prod_root.mobile.1.json`),
   401 KB arrives before the first paint:
   - 312 KB of script in 38 requests: `mui` (112 KB) lands last, at 4,041 ms; `react` (57 KB) at
     3,739 ms; `mountApp` (35 KB) at 3,404 ms;
   - 84 KB of the three preloaded fonts.

   Then 591 ms of long tasks (114, 370 and 107 ms at 4× CPU) run before the paint at 4,660 ms.

   At Slow 4G's 180 KB/s, the script alone takes about 1.7 s to arrive after the document has
   (1.1 s). Add its 0.6 s of work, and the floor is about 3.4 s even with no fonts at all. More
   chunk splitting can't bring a phone's first paint near 2 s while that paint waits for React
   and MUI.

   **Recommendation:** paint the first screen from HTML. The route-heads step
   (`tools/write-blog-heads.mjs`, from SEO-1/2) already writes one file per static route. Give each
   file a static first screen (the shell and the page's heading) that the app replaces when it
   mounts. This is the only change here that takes the script off the first paint's path.

   The cost is a second copy of each first screen to keep in step with the app, plus a check that
   it stays in step. The two copies must also match in size, or the swap reintroduces layout
   shift.
2. **On staging, the site footer is drawn and then removed on research pages.** The worst shift
   on each page below is `footer[site-footer]` collapsing to a 0×0 box:

   | Staging page | Phone shift | Laptop shift |
   | --- | --- | --- |
   | /ticker/NVDA/research | 0.273 | 0.209 |
   | /research | — | 0.078 |
   | /research/filings | — | 0.054 |

   The same routes on production read 0.001–0.029, so the fault is in the demo build. Not
   investigated.
3. **/research/filings:** the "Expected · next …" section moves 44 px down at about 5.2 s. That
   shift is 0.170 on a staging phone and 0.029 on a production phone.
4. **The heaviest routes on a phone:**

   | Route | LCP | TBT |
   | --- | --- | --- |
   | Production /ticker/NVDA/research | 6.21 s | 196 ms |
   | Production /research/markets | 5.33 s | 120 ms |
   | Production /ticker/SPY | 5.26 s | — |
   | Staging /ticker/SPY | 6.97 s | 483 ms (669 at the audit) |
5. **Script mix:**
   - Production routes now load 1 to 5 more scripts than at the audit, 3 on most. Staging routes
     load 6 more each.
   - Most content routes carry 2–12 KB more lazy script. The landing carries 66 KB less, from
     PERF-06's prefetch fix.
   - Critical script fell about 19 KB on every route, and fonts about 45 KB.

   The added scripts were not investigated.

**Read with care:** staging /ticker/SPY's laptop LCP went from 0.66 s to 1.15 s. The two runs timed
different elements: the footer disclaimer at the audit, the desk's gamma headline now. So the new
figure times the actual content, and it is not a regression.
