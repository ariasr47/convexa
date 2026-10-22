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

It needs `npm ci` and Playwright's Chromium (`npx playwright install chromium`). A full run takes
about a minute and a half on an M1 Pro. Without `--offline` it reads production's API
(`https://convexa.pages.dev/api/*`, GET only) for the live recordings and loads the TradingView embed
on the live desk, as a visitor would. Commit the regenerated page in its own commit.

## How it works

`tools/atlas/run.mjs` never reads the working tree's code, so uncommitted edits cannot leak in:

1. It resolves `--ref` to a full sha and its commit date. The page's only stamp is
   "generated from `<sha>` (`<commit date>`)".
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

The scratch folder and every server the run started are removed on exit, on error and on Ctrl-C.
The run never stops a process it did not start.

### What changes between two runs on one commit

Everything read from the code is identical byte for byte: the file index, the counts, the
versions, the bundle sizes and the check verdicts. The recordings keep the same shape (the same
runs, flows, pages and components) but their millisecond timings differ from run to run, and so,
slightly, do the counts that depend on timing: how many background commits the demo clock makes
during a wait, and how many requests the TradingView embed makes. Production's health is whatever
production reports at the time.

## Hand-maintained facts

The page states some facts that nothing derives. They live in `tools/atlas/template/content.js`
(and a few in `atlas.html`), and each was checked against the code on the date below. When a commit
changes one of them, update the template and this list. `file:line` citations throughout the page
were carried from a55e0271 (the first atlas) to **8ef735c4** on **2026-10-22** by following each
cited line through `git diff`; the ones that landed in changed lines were re-read by hand. The
other facts were checked at 791ebd88 and against the two commits after it (2cb4c8ef, 8ef735c4).

| Fact                                                                                                                                                                                                | Where on the page                          | Checked against                                                                                                                                                                                            | Verified   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Every `file:line` citation                                                                                                                                                                          | all chapters                               | the cited file at 8ef735c4, line by line through `git diff a55e0271 8ef735c4`                                                                                                                              | 2026-10-22 |
| Test cases: dashboard 2,059, Rust 1,232 (61 test binaries), tools 217, libs/api 86; the hero's 3,377 is the first, second and fourth                                                                | hero, Tests & gates                        | 2cb4c8ef's, 8ef735c4's and f5a8a9d0's recorded runs; libs/api re-run on a clean export of 791ebd88                                                                                                         | 2026-10-22 |
| Playwright inventory: 13 chromium + 35 a11y + 18 compat + 1 demo; 28 axe scans plus 7 behaviour checks; five configs; test ports 4200, 4210-4212, 4217                                              | Tests & gates, map, Environments           | `apps/dashboard-e2e`, unchanged since the 16 Oct inventory                                                                                                                                                 | 2026-10-22 |
| `api-rust` has 21 top-level subcommands                                                                                                                                                             | Inside the API, map                        | `enum Commands`, `apps/api/src/main.rs`                                                                                                                                                                    | 2026-10-22 |
| Image `FROM scratch`, uid 10001                                                                                                                                                                     | map, stack                                 | `apps/api/Dockerfile`                                                                                                                                                                                      | 2026-10-22 |
| Public data: 20 s timeout, SEC 200 ms apart in a 10 s budget, retry after 600 s, TTLs 1 h to 30 days                                                                                                | map, Data pipelines                        | `services/public_data/fetch.rs`, `cache.rs`, `mod.rs`                                                                                                                                                      | 2026-10-22 |
| GEX cache 10 s, 20 s for liquid names                                                                                                                                                               | map, Data pipelines                        | `apps/api/src/config.rs`                                                                                                                                                                                   | 2026-10-22 |
| Session: 7-day idle, 30-day absolute; five free sign-ins per 15 min per account, then one a minute                                                                                                  | map, Security                              | `services/auth/cookies.rs`, `throttle.rs`                                                                                                                                                                  | 2026-10-22 |
| Rate-limit defaults: 120 public reads and 20 sign-ins a minute per IP                                                                                                                               | map, Security                              | `config.rs`, `middleware/rate_limit.rs`                                                                                                                                                                    | 2026-10-22 |
| 13 Postgres migrations                                                                                                                                                                              | diagram, map, Where to look                | `apps/api/src/db/migrations.rs`                                                                                                                                                                            | 2026-10-22 |
| Five contract files pinned by sha256                                                                                                                                                                | map, Data pipelines, Tests & gates         | `apps/api/src/capacity/identity.rs`                                                                                                                                                                        | 2026-10-22 |
| Three `*_postgres.rs` test files need a real database                                                                                                                                               | map                                        | `apps/api/tests`                                                                                                                                                                                           | 2026-10-22 |
| Demo scenario `portfolio-2026-10-07-v1`: six symbols, 2026-10-07 18:30 UTC, 30 min at 5 s per real second                                                                                           | diagram ("Oct 7 day"), map, Data pipelines | `libs/api/src/lib/demo/workspace.ts`, `mode.ts`                                                                                                                                                            | 2026-10-22 |
| GEX formula, walls, a 100-point flip grid across ±20 % of spot                                                                                                                                      | map, Data pipelines, glossary              | `libs/quant-engine/src/gex.rs`, `gamma_flip.rs`                                                                                                                                                            | 2026-10-22 |
| Cadences: bundle 60 s, history 120 s, scanner 30 s, positions 60 s, tape offline after 15 s, scanner prices 45 s watchdog, SSE keep-alive 15 s, book push after 800 ms, idle prefetch 2.5 s timeout | Data pipelines, Who owns what, Bundle      | `useTickerBundle.ts`, `useStructureHistory.ts`, `useScan.ts`, `PositionsPage.tsx`, `useTickerStream.ts`, `libs/api/src/lib/demo/streams.ts`, `routes/stream.rs`, `positions/store.ts`, `prefetchRoutes.ts` | 2026-10-22 |
| Browser storage keys and the `convexa.demo.v1.` prefix                                                                                                                                              | Data pipelines                             | `apps/dashboard/src`, `libs/api/src/lib/demo/mode.ts`                                                                                                                                                      | 2026-10-22 |
| Diagram labels: React 19 · MUI 9 · Router 7 (majors), the public sources, FINRA off, the options feed paused                                                                                        | map                                        | `package.json`, `services/public_data/finra.rs`, production's health                                                                                                                                       | 2026-10-22 |
| Demo and live production JavaScript are byte-identical apart from the bootstrap script                                                                                                              | On the wire                                | both production builds of 791ebd88                                                                                                                                                                         | 2026-10-22 |
| The behaviour prose: who owns what, the five pipelines, the API's startup steps and routes, environments, deploy steps, security cards, the component notes and the click notes                     | chapters 05 to 15                          | each against its cited file; the click notes against a fresh recording                                                                                                                                     | 2026-10-22 |
| Coverage measured once: lines 83.4 %, branches 72.4 %; no script runs it                                                                                                                            | Tests & gates                              | 38276a03, `docs/testing/COVERAGE.md`                                                                                                                                                                       | 2026-10-22 |
| A full-history gitleaks scan on 16 Oct 2026 (1,751 commits) found no leaks                                                                                                                          | Tests & gates                              | that scan; dated, so it does not go stale                                                                                                                                                                  | 2026-10-16 |
| October's lean pass retired 920 tests across 106 files (5,173 → 3,187 cases); the deliberate breaks                                                                                                 | Tests & gates                              | `docs/testing/2026-10/` (history)                                                                                                                                                                          | 2026-10-16 |
| CI off since 2026-10-15; three conformance files are run receipts                                                                                                                                   | Tests & gates                              | `CLAUDE.md`, `.spire/clusters/tech/state/conformance`                                                                                                                                                      | 2026-10-22 |
| Fonts before and after 508f1ae7 (22 → 11 files on `/`)                                                                                                                                              | Bundle & speed                             | that commit's measurements (history)                                                                                                                                                                       | 2026-10-22 |
| The docs-vs-code record: seventeen mismatches found at a55e0271, fixed in 77160d5f and 31017589                                                                                                     | Docs vs code                               | those commits (history)                                                                                                                                                                                    | 2026-10-22 |

Derived on every run, so not listed: tracked files, every folder and test-file count, the OpenAPI
operation count, Nx projects and Rust crates, dependency and Node versions, bundle sizes and budget
verdicts, the filing and design-token checks, `.spire` contract and conformance counts, workflow
files, and everything recorded in a browser.

## The September atlas

`atlas.html` and `build_atlas.py` in this folder are the September feature atlas, generated from the
Spire canon. This atlas replaces them; they are removed in the commit that first adds a generated
`index.html`.
