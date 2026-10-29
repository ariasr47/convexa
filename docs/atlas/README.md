# The repo atlas

`docs/atlas/index.html` is a single, self-contained page that explains this repository: where
everything is, what happens when the site starts and when you click, and how it is built and
checked. It is generated from a commit by `npm run atlas`; nothing in it is edited by hand except
the template it is built from (`tools/atlas/template/`).

It has seventeen chapters in three parts:

- **I · Where everything is.** The running system as a diagram, linked both ways to the folder tree;
  every tracked file with a description quoted from the file itself, its exports, imports and
  importers; which files to open for a given change; the tech stack with versions read from the
  manifests.
- **II · What happens on startup.** A recorded replay of five page loads (every React commit, mount,
  request, stream, storage write and paint, on one clock), five everyday clicks traced the same way,
  a request waterfall of a cold visit, who owns which state, the data pipelines and the API's own
  startup.
- **III · How it is built and checked.** The Nx workspace, the environments, tests and gates, bundle
  sizes against their budgets, security, a record of the docs-vs-code mismatches the first atlas
  found (all fixed), and a reading order.

## Opening it

Download or check out `docs/atlas/index.html` and open it in a browser (`open docs/atlas/index.html`
on macOS). GitHub shows an HTML file as source, not as a page. The file needs no server and no
network: the data, styles, script and fonts (the dashboard's own Archivo and IBM Plex) are all
inside it. Light and dark follow the system setting.

## The published copy

The same page is published as a private claude.ai artifact, **Convexa Repo Atlas v`<version>`**:
<https://claude.ai/artifact/N1hvJFsEAebCmxPKhmSttD>. Like the file, it names the Convexa version it
describes, in its title and its stamp. An artifact takes a page body, not a whole document, so
`node tools/atlas/artifact.mjs --out <file>` turns `docs/atlas/index.html` into one: the same page
without its `<html>`, `<head>` and `<body>` wrappers, title first. Claude publishes that file to the
link above (the Artifact tool, with the link), and the artifact keeps one version per publish,
labelled with the Convexa version. Republish whenever the page is regenerated, which is once per
release at least (CLAUDE.md, "Versions").

## Regenerating it

```bash
npm run atlas            # writes docs/atlas/index.html from HEAD
npm run atlas:offline    # the same, without the live-site recordings
node tools/atlas/run.mjs --ref <ref> --out <file> [--offline]
```

| Option      | Default                 | What it does                                                                                                      |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--ref`     | `HEAD`                  | The commit to describe. Any ref git can resolve.                                                                  |
| `--out`     | `docs/atlas/index.html` | Where to write the page.                                                                                          |
| `--offline` | off                     | Skip every recording of the live build and production's `/api/health`. The page says so where that data would be. |

It needs Playwright's Chromium (`npx playwright install chromium`) and a checkout of the ref
itself: the generator, its template and `node_modules` come from this checkout (see below), so run
`npm ci` after checking out a ref whose `package-lock.json` differs. A full run takes about a minute
and a half on an M1 Pro. Without `--offline` it reads production's API
(`https://convexa.pages.dev/api/*`, GET only) for the live recordings and loads the TradingView embed
on the live desk, as a visitor would; a forwarded GET that production does not answer fails the run,
naming the request. Commit the regenerated page in its own commit.

## How it works

The code the page describes, and the builds it records, come from a clean export of the ref,
never from the working tree, so uncommitted edits to that code cannot leak in. Three things do come
from this checkout: the generator (`tools/atlas/*.mjs`), its template (`tools/atlas/template/`, the
hand-written facts) and `node_modules`. They must match the ref, and `tools/atlas/run.mjs` checks:

1. It resolves `--ref` to a full sha and its commit date. The page's stamp is "Convexa v`<version>` ·
   generated from `<sha>` (`<commit date>`)", and its title is "Convexa Repo Atlas v`<version>`", the
   version read from the root `package.json` of the export (step 2). If `tools/atlas` (tracked or untracked files) or
   `package-lock.json` in this checkout differs from that sha, it stops before doing anything:
   "tools/atlas or package-lock.json in this checkout differs from `<short>`: commit the edits or
   check out `<ref>`". A `--ref` older than the atlas therefore fails at once. If the installed
   `node_modules` differs from `package-lock.json` (npm's `node_modules/.package-lock.json` says
   which versions are installed), it logs a warning with the count and the first difference, and
   goes on; `npm ci` makes them match.
2. `git archive <sha> | tar -x` into a scratch folder under the OS temp dir. The export gets a
   `node_modules` of symlinks to this checkout's packages; workspace packages (`@convexa/*`) point
   at the export's own folders, so the build reads the commit's `libs/api`.
3. It builds the dashboard there: unminified demo and live builds for the recorders (component names
   survive), and the production demo and live builds with the ref's own Nx production command for
   the waterfall and the bundle numbers. The project's `check-dashboard-bundle.mjs`,
   `research-notes/check-filings.mjs` and `design/src/verify-tokens.mjs` run on the export and the page
   quotes their verdicts.
4. `index-files.mjs` indexes every path `git ls-tree -r <sha>` lists, from the export, and computes
   the facts the prose uses (file and folder counts, the OpenAPI operation count, Nx projects, Rust
   crates, the Node pin, dependency versions).
5. It serves the builds with the export's `apps/dashboard-e2e/tools/serve-dist.mjs` on free ports
   (never 8001) and drives Chromium: `record-startup.mjs` (five page loads), `record-clicks.mjs`
   (five actions) and `record-wire.mjs` (four cold visits to the production builds). `browser.mjs`
   holds the DevTools-style React hook and the network policy: a demo context cannot reach anything
   but its local server; a live context forwards `/api` GETs to production and aborts every other
   `/api` method.
6. `build.mjs` fills the template's tokens from those facts (a token that names nothing fails the
   build), embeds the recordings as JSON and the fonts as data URIs, and writes one HTML file.

The scratch folder and every server the run started are removed on exit, on error and on Ctrl-C,
and also if the process dies of an unhandled rejection: the clean-up is synchronous and runs from
Node's `exit` handler too. The browser's network routes never reject (a request still in flight
when a context closes is dropped, not left to crash the run). The run never stops a process it did
not start.

### What changes between two runs on one commit

Everything read from the code is identical byte for byte: the file index, the counts, the
versions, the bundle sizes and the check verdicts. The recordings keep the same shape (the same
runs, flows, pages and components) but their millisecond timings differ from run to run, and so,
slightly, do the counts that depend on timing: how many background commits the demo clock makes
during a wait, and how many requests the TradingView embed makes. Production's health is whatever
production reports at the time.

## Hand-maintained facts

The page states some facts that nothing derives. They live in `tools/atlas/template/content.js`
(and a few in `atlas.html` and `app.js`), and each was checked against the code on the date below. When a commit
changes one of them, update the template and this list. The `file:line` citations outside the
docs-vs-code record were carried from a55e0271 (the first atlas) to 8ef735c4 on 2026-10-22, and on
to **d01506ba** on **2026-10-29**, then to **5a668530** the same day,
by following each cited line through `git diff`; the ones that landed in changed lines were re-read
by hand. The docs-vs-code record keeps its a55e0271 line numbers on purpose: it says where each
mismatch was when it was found, and the page says so. The other facts carry their own date: those dated
2026-10-22 were checked at 791ebd88 and the two commits after it (2cb4c8ef, 8ef735c4), and those
dated 2026-10-29 at d01506ba, or at 5a668530 where the table says so.

A page generated from a later commit carries these citations unchanged, so a commit after 5a668530
that edits a cited file has to be checked too (`git diff --stat 5a668530 <ref>` lists them).
The commits after d01506ba up to the first 2026-10-29 page (d8918fd0's) move no cited line: they append to
`DESIGN_SYSTEM.md` and `BACKLOG.md` (cited by path only), add to `CLAUDE.md` below its cited lines,
reword one comment line of `tools/hooks/pre-push` above its cited lines, and change the atlas itself.
The commits from d8918fd0 to 5a668530 (the overnight site-audit lanes, spec 07 and two privacy
fixes) did move and change facts: each cited file they touch was followed through
`git diff d8918fd0 5a668530`, and every fact they changed was re-read at 5a668530.

Production's `/api/health` gives the page only what its public body keeps: `status`, `market_data`
and `durable_store` (`HEALTH_FIELDS` in `tools/atlas/run.mjs`). The price cache, the GEX kernel and
the rate limit moved to the token-gated `/api/_metrics` in 1658fb69, which the Pages edge does not
serve, so the template states them from the code, with production's values as its public health gave
them on 2026-10-29. Read from production, they would show on a page generated before that commit
deploys and vanish from the next one.

| Fact                                                                                                                                                                                                                                                                                     | Where on the page                          | Checked against                                                                                                                                                                                                                        | Verified   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Every `file:line` citation outside the docs-vs-code record                                                                                                                                                                                                                               | all chapters                               | the cited file at 5a668530, line by line through `git diff a55e0271 8ef735c4`, `git diff 8ef735c4 d01506ba` and `git diff d8918fd0 5a668530`                                                                                           | 2026-10-29 |
| Test cases: dashboard 2,089, Rust 1,267 (60 test binaries, one per `test result` line: 58 executables, 2 doc-tests), tools 242, libs/api 89; the hero's 3,445 is the first, second and fourth                                                                                            | hero, Tests & gates                        | each suite at 5a668530, run as `npm run verify` runs it (`vitest run`; `cargo test -p api-rust -p quant-engine`; `npm run test:tools` after `tsc -p libs/api/tsconfig.lib.json`), each exit 0                                          | 2026-10-29 |
| Playwright inventory: 13 chromium + 35 a11y + 18 compat + 1 demo; 28 axe scans plus 7 behaviour checks; five configs; test ports 4200, 4210-4212, 4217                                                                                                                                   | Tests & gates, map, Environments           | `apps/dashboard-e2e` at d01506ba: specs and fixtures edited since the 16 Oct inventory; counts, configs and ports unchanged                                                                                                            | 2026-10-29 |
| `api-rust` has 22 top-level subcommands                                                                                                                                                                                                                                                  | Inside the API, map                        | `enum Commands`, `apps/api/src/main.rs`                                                                                                                                                                                                | 2026-10-29 |
| The owner gate: 14 owner-only operations (`OWNER_ONLY_OPERATIONS`), answered only for the accounts in `OWNER_EMAILS` and refused for everyone while it names none                                                                                                                        | Inside the API, Environments, Security     | `apps/api/src/routes/mod.rs:2275-2290`, `routes/auth.rs`                                                                                                                                                                               | 2026-10-29 |
| The pre-push hook refuses `main` or `staging` at a version already out, then runs the research check, gitleaks and `nx affected -t lint typecheck`                                                                                                                                       | Tests & gates, Environments                | `tools/hooks/pre-push`                                                                                                                                                                                                                 | 2026-10-29 |
| Image `FROM scratch`, uid 10001                                                                                                                                                                                                                                                          | map, stack                                 | `apps/api/Dockerfile`                                                                                                                                                                                                                  | 2026-10-22 |
| Public data: 20 s timeout, SEC 200 ms apart in a 10 s budget, retry after 600 s, TTLs 1 h to 30 days                                                                                                                                                                                     | map, Data pipelines                        | `services/public_data/fetch.rs`, `cache.rs`, `mod.rs`                                                                                                                                                                                  | 2026-10-29 |
| GEX cache 10 s, 20 s for liquid names                                                                                                                                                                                                                                                    | map, Data pipelines                        | `apps/api/src/config.rs`                                                                                                                                                                                                               | 2026-10-29 |
| Session: 7-day idle, 30-day absolute; five free sign-ins per 15 min per account, then one a minute                                                                                                                                                                                       | map, Security                              | `services/auth/cookies.rs`, `throttle.rs`                                                                                                                                                                                              | 2026-10-22 |
| Rate limits: 120 public reads and 20 sign-ins a minute per IP by default; through the Pages proxy, per visitor only when the proxy and the API hold the same `PAGES_PROXY_SECRET`                                                                                                        | map, Security                              | `config.rs:546-548`, `middleware/rate_limit.rs`, `functions/api/[[path]].ts` at 5a668530                                                                                                                                               | 2026-10-29 |
| 13 Postgres migrations                                                                                                                                                                                                                                                                   | diagram, map, Where to look                | `apps/api/src/db/migrations.rs`                                                                                                                                                                                                        | 2026-10-22 |
| Five contract files pinned by sha256                                                                                                                                                                                                                                                     | map, Data pipelines, Tests & gates         | `apps/api/src/capacity/identity.rs`                                                                                                                                                                                                    | 2026-10-29 |
| Three `*_postgres.rs` test files need a real database                                                                                                                                                                                                                                    | map                                        | `apps/api/tests`                                                                                                                                                                                                                       | 2026-10-22 |
| Demo scenario `portfolio-2026-10-07-v1`: six symbols, 2026-10-07 18:30 UTC, 30 min at 5 s per real second                                                                                                                                                                                | diagram ("Oct 7 day"), map, Data pipelines | `libs/api/src/lib/demo/workspace.ts`, `mode.ts`                                                                                                                                                                                        | 2026-10-29 |
| GEX formula, walls, a 100-point flip grid across ±20 % of spot                                                                                                                                                                                                                           | map, Data pipelines, glossary              | `libs/quant-engine/src/gex.rs`, `gamma_flip.rs`                                                                                                                                                                                        | 2026-10-22 |
| Cadences: bundle 60 s, history 120 s, scanner 30 s, positions 60 s, tape offline after 15 s, scanner prices 45 s watchdog, SSE keep-alive 15 s, book push after 800 ms, idle prefetch 2.5 s timeout                                                                                      | Data pipelines, Who owns what, Bundle      | `useTickerBundle.ts`, `useStructureHistory.ts`, `useScan.ts`, `PositionsPage.tsx`, `useTickerStream.ts`, `libs/api/src/lib/demo/streams.ts`, `routes/stream.rs`, `positions/store.ts`, `prefetchRoutes.ts`                             | 2026-10-29 |
| Browser storage keys, the `convexa.demo.v1.` prefix on every localStorage key, and the one sessionStorage key, `convexa.chunk-reload.v1`, which has none                                                                                                                                 | Data pipelines                             | `apps/dashboard/src` (`reloadOnce.ts`, `PrivacyPage.tsx`) and `libs/api/src/lib/demo/mode.ts` at 5a668530                                                                                                                              | 2026-10-29 |
| Diagram labels: React 19 · MUI 9 · Router 7 (majors), the public sources (the OFR counted under Treasury), FINRA off, the options feed not live, the static site's route pages and 404                                                                                                   | map                                        | `package.json`, `services/public_data/finra.rs`, `ofr.rs`, production's health on 2026-10-29, `tools/write-blog-heads.mjs` at 5a668530                                                                                                 | 2026-10-29 |
| From the code, not production's health: the price cache (Redis with `REDIS_URL`, else memory), the GEX kernel (`avx2-f64x4` with AVX2, else scalar), the rate limits; production's values as its public health gave them on 29 Oct 2026 (memory, `avx2-f64x4`, 30 public reads a minute) | map, Stack, Security, Inside the API       | `redis/price_cache.rs:22-43`, `libs/quant-engine/src/simd.rs:270-278`, `config.rs:546-548` at 5a668530; production's values from the `/api/health` the d8918fd0 page recorded                                                          | 2026-10-29 |
| Routing on Pages: a page per route, `_redirects` rewrites, `404.html` with status 404, the sitemap on live builds; `serve-dist.mjs` still answers any unknown path with `index.html`                                                                                                     | map, On the wire, Where to look            | `tools/write-blog-heads.mjs`, `apps/dashboard-e2e/tools/serve-dist.mjs` at 5a668530                                                                                                                                                    | 2026-10-29 |
| Caching: `/assets` a year, fonts 30 days, the share image and favicons a day; the Pages Function lets a browser keep a public read 30 s and sends everything else `no-store`                                                                                                             | map, Environments, Bundle & speed          | `apps/dashboard/public/_headers`, `functions/api/[[path]].ts` at 5a668530                                                                                                                                                              | 2026-10-29 |
| Fonts: three faces preloaded (Archivo, Plex Sans 400, Plex Mono 400); Archivo cut to wght 600–900 and wdth 100–125 %                                                                                                                                                                     | Stack, On the wire                         | `apps/dashboard/index.html:71-93`, `src/styles.css` at 5a668530                                                                                                                                                                        | 2026-10-29 |
| Demo and live production JavaScript are byte-identical apart from the bootstrap script; the demo also loads its transport, which a live page never asks for                                                                                                                              | On the wire                                | both production builds of 791ebd88; at 5a668530, the 54 chunks the demo recordings load all carry content-hashed names from the live build's 96                                                                                        | 2026-10-29 |
| The behaviour prose: who owns what, the five pipelines, the API's startup steps and routes, environments, deploy steps, the gate and security cards, the component notes                                                                                                                 | chapters 05 to 15                          | each against its cited file at d01506ba; what the commits to 5a668530 changed (routing, caching, prefetch, the desk's head start, the reload-once, the demo transport, the proxy secret, `/_ops/metrics` on Pages) re-read at 5a668530 | 2026-10-29 |
| The click notes                                                                                                                                                                                                                                                                          | Follow a click                             | the code at d01506ba on 2026-10-29; a fresh recording on 2026-10-22 (631a8964's)                                                                                                                                                       | 2026-10-22 |
| Coverage measured once: lines 83.4 %, branches 72.4 %; no script runs it                                                                                                                                                                                                                 | Tests & gates                              | 38276a03, `docs/testing/COVERAGE.md`                                                                                                                                                                                                   | 2026-10-22 |
| A full-history gitleaks scan on 16 Oct 2026 (1,751 commits) found no leaks                                                                                                                                                                                                               | Tests & gates                              | that scan; dated, so it does not go stale                                                                                                                                                                                              | 2026-10-16 |
| The 9 Oct lean pass retired 920 tests across 106 files (5,173 → 3,187 cases); the deliberate breaks                                                                                                                                                                                      | Tests & gates                              | `docs/testing/2026-10/` (history)                                                                                                                                                                                                      | 2026-10-16 |
| CI off since 2026-10-15; three conformance files are run receipts                                                                                                                                                                                                                        | Tests & gates                              | `CLAUDE.md`, `.spire/clusters/tech/state/conformance`                                                                                                                                                                                  | 2026-10-22 |
| Fonts before and after 508f1ae7 (22 → 11 files on `/`)                                                                                                                                                                                                                                   | Bundle & speed                             | that commit's measurements (history)                                                                                                                                                                                                   | 2026-10-22 |
| The docs-vs-code record: seventeen mismatches found at a55e0271, fixed in 77160d5f and 31017589; its line numbers are a55e0271's                                                                                                                                                         | Docs vs code                               | those commits (history); each citation at a55e0271                                                                                                                                                                                     | 2026-10-22 |

Derived on every run, so not listed: Convexa's version (the title and the stamp), tracked files, every folder and test-file count, the OpenAPI
operation count, Nx projects and Rust crates, dependency and Node versions, bundle sizes and budget
verdicts, the filing and design-token checks, `.spire` contract and conformance counts, workflow
files, and everything recorded in a browser.

## The Feature Atlas, alongside it

`atlas.html` in this folder is a different page: the **Feature Atlas**, the owner's map of the
product (journey, catalog, invariants, roadmap), generated by `py docs/atlas/build_atlas.py` from the
Spire canon (OPEN_THREADS, archived manifests, DECISION_LEDGER, BACKLOG). It stays, and it is
regenerated at every GATE S (`.spire/clusters/tech/context/PROJECT_CONTEXT.md`, section 7). This page
explains the code; that one explains the product.
