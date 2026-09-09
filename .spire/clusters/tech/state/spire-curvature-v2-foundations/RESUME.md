# RESUME — spire/curvature-v2-foundations

## ⬆ UPDATE — 2026-09-09 (Windows box): PR #46 OPEN · first CI run red on four repaired causes · baselines RE-ACCEPTED at `be00d739` on both platforms · branch at `27eb19e2` · phase 4 council at the S2 cap, ONE owner ruling open

**Read this first; every block below is history.** Owner: "pr first, then council". PR #46
(https://github.com/ariasr47/convexa/pull/46, `spire/curvature-v2-foundations` → `main`) opened at `11307915`.
Its first CI run (`34304816896`) was red in the accessibility and visual children and in the supply-chain policy
job; all four causes are in `PR46_CI_REPAIR_TASK.md` (§A–§E) and in BACKLOG F-G…F-K. Commits since, oldest first,
all pushed: `f13dcbfb` docs (the task) · `bec49028` chore(ci) advisories + `.gitleaks.toml` · `b7425507`
fix(dashboard) contrast tokens (`extras.textDim`/`textInfo`, Amendments row) · `ad858c83` fix(dashboard) bundled
greek/latin-ext/symbol subsets, `⌘`/`▾` → icons, glyph-coverage spec · `1d6f6b42` chore(deps) scoped js-yaml
override · `097d37a7` chore(spire) helper maxBuffer, bootstrap cleanup · `b1c898df` win32 baselines at 1d6f6b4 ·
`be00d739` test(quality) `--disable-lcd-text` · `6f9807b7` win32 baselines at be00d73 · `27eb19e2` linux baselines
at be00d73. **Second CI run `34323995666` on `27eb19e2` was in flight when this was written — read its verdict
from `gh run view 34323995666` before believing anything here about CI.** Expected: accessibility and visual green;
policy job still red on the two unfixable `js-yaml` highs (F-J, owner decision).

| platform | authorization | candidate set | acceptance | stability runs |
| --- | --- | --- | --- | --- |
| win32 | `win32-curvature-v2-be00d73-20260909` | `b185b79d60efafa1935d6801512bb38d` | `accept-b185b79d60efafa1935d6801512bb38d-20260909` | `local-1788938275643-b4e88155` · `local-1788938286153-11c43fb7` |
| linux | `linux-curvature-v2-be00d73-20260909` | `bedb336775fcf3b0d850301f1a33e5f4` | `accept-bedb336775fcf3b0d850301f1a33e5f4-20260909` | `local-1788938340728-93e20c6d` · `local-1788938345682-6c3ad028` |

**Six SHA-256, win32:** landing `ffd2603e95de642e80554059756d743fe388720c8a6787eb9734b58dcd8ce8dd` · ticker-desktop
`42e7b8203007a469fa847656098253838ed4a50eba5057a24eb208648a9ff175` · ticker-offline-mobile
`6aef0610c00c8314c8aec1b5ca014f75bbec9bcbcc2373e64eaa4de8f4cf9291` · positions-dense
`d39d97f4e7976496650177a7e997857f9c6bc08906d6f9af2733996544054211` · scanner-dense
`ec1ba3e283517a0824d2c406fd7cff6c0ed614b018b79b69c2de54d73851c516` · ai-recommendation
`0eecfb0cfb36fb054740dfb9a005d1847ebbdbc12f2ebc93455e83ed749855db`.
**Six SHA-256, linux:** landing `d22a0387d6edf26416fc9a8b4b055f1244f9a810726650401684053c08fd288a` · ticker-desktop
`5b10208026b62fc8fa86230dc443bf674184fc73dec99bec0f0565b7fb5d914c` · ticker-offline-mobile
`05ec3e4c98ec2216fa958dd4e6e1ef34179e136ff109b069d080f9ff3aba8806` · positions-dense
`d7609f61da0624ed79c9c4e3b580ea291af6e355c406a16e31d7773c9675f687` · scanner-dense
`acbd7057aaee6ee3631b17e8f846c318e7740176e63db4481b6451ae725e0ee4` · ai-recommendation
`cddcd5525ed190e718bc99c8683a7bb2a9f71f4b94a9f3ef1418cf5ae3b3d8e1`.
All six changed on both platforms (contrast tokens and bundled glyphs touch every page; grayscale AA touches every
pixel of text). Linux ran as before in the Playwright image (`linux-container/` scripts); container and volume
removed again.

**Open, owner's call (one per line):**
- **F-J:** the policy job cannot go green — `js-yaml` 4 under `@redocly/openapi-core` is unfixable upstream and
  security exceptions are prohibited. Move the policy (a narrowly scoped, dated exception for this one path) or wait
  for `openapi-typescript` to move. Recommendation: the scoped exception, expiring 2026-12-31.
- **Key rotation:** `MASSIVE_API_KEY` sat in `apps/api/.env` in the initial commit `1aac13ec`; rotate if not rotated
  then. Not asked to rewrite history.
- **D-B (phase 4 council):** the landing hero instrument — A static SVG isometric projection (recommended) · B
  three.js · C ship A and pre-register three.js. D-A (blog draft slots) proceeds on A unless vetoed.

**Phase 4 (`curvature-v2-landing-and-site`) council state, on branch `spire/curvature-v2-landing-and-site`:**
R1 ×3, R2 ×3 (31 conflicts validated by `council_conflicts`), R3 reconciled with inboxes, R4 wrote SPEC (71 rows,
receipt 31/31) + INTERFACE_CONTRACT (NO_BACKEND_CHANGE), S2 ran twice (cap): pass 2 left 2 Important + 1 Minor.
**Next there:** the D-B ruling → one final R4 pass folding D-B and S2 pass 2 → `contract_lint` → spec approval →
GATE PLAN. Council trap paid for: R2 files must carry the conflicts JSON fence with no heading above it, and every
conflict id is a hash of (source, index, whole-file body) — regenerate ids after any edit, never hand-patch them.

**Next on this branch:** read run `34323995666`. If accessibility and visual are green: merge is the owner's call
(the policy job needs F-J resolved or an explicit override). If the visual child is red: the diff images in the
`browser-quality-visual` artifact say whether it is fonts again (F-I fixed the app-bundled ones; a system-font
fallback elsewhere would show as glyph-only diffs) — do NOT re-take baselines until the cause is named.

## ⬆ UPDATE — 2026-09-08 late (Windows box): F-D FIXED (two causes) · win32 AND linux baselines ACCEPTED at `40ec63fc` · pushed to `2eaa7136` · next: the PR, on the owner's go — SUPERSEDED by the block above

**Read this first; the two blocks below it are history.** Owner ruling this session: `keep` the CI visual gate,
`go` on the order fix-F-D → linux via docker → PR. Commits, oldest first, all pushed: `6fa9419b`
fix(dashboard) synchronous paint after every layout · `40ec63fc` fix(dashboard) explicit lineWidth ·
`e2929865` test(quality) win32 baselines at 40ec63f · `2eaa7136` test(quality) linux baselines at 40ec63f.
(`f5cb325a` win32 baselines at bdb93b9 and `019f17f8` docs stand underneath.) **No PR opened.**

**F-D had two causes**, both in `pages/ticker/widgets/chrome/TapePulseStrip.tsx`, found with a temporary canvas
call-timeline probe against the real `ticker-desktop` scenario (six runs, real-clock stamps on every context
call; deleted after use): (1) `layout()` reset `canvas.width` — clearing the bitmap — and left the repaint to a
frame the gate's frozen clock never ran → blank slot; fixed by drawing synchronously after every layout and
once on mount. (2) The trail polyline set `lineWidth = 1.75` and nothing reset it, so the dashed baseline was
stroked at 1.75 on every frame except the one right after a resize (context reset → 1); which frame was last
was a race between the ResizeObserver callback and the clock pause's due-timer flush → red 42 vs 60, 3/6 each;
fixed by setting `lineWidth = 1` before the baseline stroke. Probe after both fixes: 6/6 identical under load.
Three regression cases in `TapePulseStrip.spec.tsx`, each RED before its fix. Gates cold on each commit:
typecheck 0 · dashboard suite 240 files / 2924, exit 0 (alone — see "flakes" below) · e2e desk subset 108/108.

| platform | compare run | authorization | candidate set | acceptance | stability runs |
| --- | --- | --- | --- | --- | --- |
| win32 | `local-1788913954573-e9274620` (2 changed: both tickers) | `win32-curvature-v2-40ec63f-20260908` | `6ee078b9e37d1c2f758749d76fea9931` | `accept-6ee078b9e37d1c2f758749d76fea9931-20260909` | `local-1788914073868-b12eda33` · `local-1788914089502-e90beaa7` |
| linux | `local-1788914036966-2a3b0bc2` (5 changed; ai-recommendation passed) | `linux-curvature-v2-40ec63f-20260908` | `fe3e8ea657c1851e9a3c3aa11bd0ad01` | `accept-fe3e8ea657c1851e9a3c3aa11bd0ad01-20260909` | `local-1788914379457-fb938714` · `local-1788914386915-63922f49` |

**Six SHA-256, win32:** landing `dcd5af69caaab82f2d9e06165cf268aec82b43a52cd7578d92c6380558f6c2e8` · ticker-desktop
`1c67d05182e52b711acf49f9aae97fc7f089efb6b922e680ddef2a54bfd34a30` · ticker-offline-mobile
`9bcb7e46ebb6056b4310972045f60a2766956fcc9298e560138879b6ded5af75` · positions-dense
`59ba1436fb3d7d5c38e7f671c3290137ac13ce8722bd2f556e58d2ac42f8c750` · scanner-dense
`dcd1ca53541dadfb34dca632252eb00d020a518fd74f2e3c241fb356de9074c8` · ai-recommendation
`abe4f38480153d8189e8c7ebe286c9874b81921dd2e8bfb0b7305a1c43040a48`.
**Six SHA-256, linux:** landing `9ebe1f8ea05c2b2bced65abd5f145248e60c773af8b3d75d43e081debb13417b` · ticker-desktop
`38b1203e29f170d3b85cdfbff6df473f1b80f156bf9a19ee1ef49c4b869df843` · ticker-offline-mobile
`24320682cfbb31d8f33dd836c74267d23953e30ea5ecdf00986294baf7cb9413` · positions-dense
`3bb35b3addd8e36f426fc9c6bd069efe744b8431b90cb1def1a262bf2afd9bd3` · scanner-dense
`e588b7273237946277e98382d2b422d4af767e1220ce180d742dfd2774f1c8de` · ai-recommendation
`cf50b7f14bfe3bec9c40e3d040baeb8efc07b1e5cde78f00dcf4b4ace315d03b` (unchanged since 2026-08-25).

**How linux ran** (no Ubuntu WSL distro on this box): a separate clone inside `mcr.microsoft.com/playwright:
v1.62.1-noble` (Ubuntu 24.04.4, Chromium 1234, Node 24.18 — CI runs Node 26 from `.nvmrc`; the bundler is
native rolldown, the pixels are Chromium's) on Docker Desktop's WSL2 backend, the Windows tree mounted read-only
as the clone source; scripts + why `--dns-result-order=ipv4first` is required in that image under
`visual-baseline-receipts/linux-container/` and the runbook's new section. Artifacts copied out with `docker cp`,
re-validated on Windows with the repository validators (`check` ×3, `stability`; Windows `git diff --binary`
of the six PNGs byte-equal to the container's patch), committed once, pushed. Container and volume removed.

**What was looked at:** win32 — the two changed actuals/diffs (dashed baseline only), candidates byte-equal
to them. linux — all five actuals and diffs plus the passing ai-recommendation baseline; compositions equal
win32/darwin, differences are font metrics (landing body wraps a word earlier, scanner columns a few px).
**CI-parity caveat stands:** the runner's fonts may differ from the image's; two green CI runs of the visual
child on the PR are the proof, and the fallback is the hosted-runner redesign (BACKLOG F-A).

**Filed (BACKLOG Harvest addendum):** F-D closed with the second cause · **F-E** the dashboard suite has a
cross-worker race (`replay-outcome-join.structural.spec.ts` writes a poison file that
`stage3-amber.spec.ts`'s `import.meta.glob` catches mid-run) and under load loses files to worker crashes /
15 s timeouts — it exited 0 only when run alone; check the exit code, never the printed totals · **F-F** the
"tape paused · trail frozen" caption shows while the frozen trail has been age-pruned to nothing after the
gate's +30 s jump (SPEC §4.6 semantics, owner's call).

**Next:** the PR for `spire/curvature-v2-foundations` → `main`, on the owner's go, then watch two CI runs of
the visual child. **Phase 4 opened at GATE I on 2026-09-08 (owner: "continue with the re-design work"):**
re-cut into `curvature-v2-landing-and-site` (BRIEF drafted at
`contracts/curvature-v2-landing-and-site/BRIEF.md`, manifest at GATE I, BACKLOG entry written) with
`curvature-v2-responsive-sweep` pre-registered as its successor. **GATE C (the council) waits for the owner's
go — it is the expensive step (three decide-tier voices, a synthesizer and a skeptic).** Recommended
sequencing: PR first, phase 4 on a branch off it. Also this session: the test-suite and back-testing review,
`docs/research/TEST_SUITE_AND_BACKTESTING_REVIEW_2026-09-08.md` (tier-A cleanups are a hygiene batch, not
a pipeline feature).

## ⬆ UPDATE — 2026-09-08 (Windows box): win32 visual baselines ACCEPTED, committed `f5cb325a`, pushed · linux leg BLOCKED on an owner decision — SUPERSEDED by the block above

**Read this first.** The HANDOVER block below is **consumed for win32** and **still live for linux** (its
step 3). Boot found two obstacles, both resolved: `spire run tech` exited 4 (`artifact integrity`) because the
receipt-pinned repo-root `AGENTS.md` was checked out CRLF (no `.gitattributes` rule; pinned `eol=lf` in the
docs commit after `f5cb325a`), and the entry rewrote the tracked `receipts/selection.json` timestamp, reverted
before the flow so the update command's source-scope check stayed clean. `npm run ports:free` killed an
orphan listener on `:4300` (pid 10092). Toolchain as the handover said: Node 26.7.0, `npm ci` (two
postinstalls blocked by npm's allow-scripts — `@swc/core`, `nx` — harmless: the native swc binding and nx
native both load), Playwright 1.62.1 / Chromium 1234, fresh production build served via `http-server`.

**win32 flow, every step as the runbook prescribes, all six scenarios on strict fixtures, retries 0:**

| step | id / result |
| --- | --- |
| compare_failed | run `local-1788908546804-9d816d0a` — 5 pixel failures + `ai-recommendation` PASSED (byte-identical to the 2026-08-24 baseline) |
| authorized | `win32-curvature-v2-bdb93b9-20260908` (`workspace-owner` / owner) — after viewing all 5 actuals, 5 diffs and the passing baseline against the darwin preview + `DESIGN_SYSTEM.md` |
| candidates_written | `e2a1eea5690ec3f68ac293c384ec5f39` — 6 PNGs; 5 changed, `ai-recommendation` unchanged |
| accepted | `accept-e2a1eea5690ec3f68ac293c384ec5f39-20260908` (`workspace-code-reviewer`) — after viewing all 6 candidates, the 5-file binary patch (847,225 bytes) and the sha match to the compare actuals |
| stability_clean | `local-1788908987370-76c0c9cb` + `local-1788908997180-b74e99e6`, both 6/6 pass |
| commit | `f5cb325a test(quality): accept win32 visual baselines for Curvature Terminal v2 (bdb93b9)` — 29 files, pushed |

Six SHA-256 (win32 · `snapshots/win32/chromium/`): landing `dcd5af69caaab82f2d9e06165cf268aec82b43a52cd7578d92c6380558f6c2e8` ·
ticker-desktop `a7542ea13521aaf545ad5dd7c33321834b4f65b84b272d8c28286d22f4334def` ·
ticker-offline-mobile `04517b4c6e21b3ded6ea71327d8165ba692791085c0d4e6d19c5f54bbb986ac5` ·
positions-dense `59ba1436fb3d7d5c38e7f671c3290137ac13ce8722bd2f556e58d2ac42f8c750` ·
scanner-dense `dcd1ca53541dadfb34dca632252eb00d020a518fd74f2e3c241fb356de9074c8` ·
ai-recommendation `abe4f38480153d8189e8c7ebe286c9874b81921dd2e8bfb0b7305a1c43040a48`.

**What the inspection saw:** every win32 actual matches its darwin preview composition — v2 nav, the masthead
headline row with the sign-in card, the structure-field hero with FIELD/MAGNET and the level ladder, positions
cards + Simulated/Broker tabs, the scanner table with score bars and the three notes, the unchanged AI-read
dialog. Diffs are total on the four redesigned surfaces and anti-aliasing-only on `landing`. Known residuals
present as recorded (headline wrap at 1280, scanner header cluster, the `496528h`/`20688 d` sentinel ages,
both tickers "Live offline — reconnecting…"). One new finding, **F-D**: the `ticker-desktop` tape-trail
sparkline is a run-to-run race — the first compare drew it, the update run and five later compares did not;
the accepted baseline is the blank slot (6 of 7 runs). Mechanism and fix candidates: `context/BACKLOG.md`,
Harvest addendum 2026-09-08. Not fixed here (a source change would restart the flow).

**linux leg — NOT run, blocked on a decision.** WSL2 is present but the only distro is Docker Desktop's
internal `docker-desktop` (no Ubuntu; `wsl -l -v`), and Docker Desktop is installed but stopped. Options,
owner's call: (a) `wsl --install -d Ubuntu-24.04` (a system install this session did not make) then the
runbook's linux flow from a separate clone inside WSL — the CI-parity path; (b) start Docker Desktop and run
the flow in `mcr.microsoft.com/playwright:v1.62.1-noble` (Ubuntu 24.04, same Chromium 1234) from a separate
clone — equal parity, but not the runbook's wording. Until one runs, CI's visual child stays red on any PR.
**No PR opened.**

**Read this first.** Claude's per-machine memory does not travel; this file and
`visual-baseline-receipts/RUNBOOK.md` are the memory the Windows session has. Treat every claim here as a
claim: re-verify against `git` before acting.

**Branch state at handover:** `spire/curvature-v2-foundations` at the tip of origin (this handover commit,
on top of `b31956e1`). Pushed; **no PR**; nothing uncommitted on the Mac except two intentionally untracked
local files (`.claude/launch.json`, `convexa-api-contract-candidate-*.ok`). `main` is untouched.

**What happened on the Mac on 2026-09-08 (newest last):** the fidelity audit → the `/ticker` repair lane
(two passes, desk 1.07× the design) → the surfaces repair lane (positions 1.16×, settings 1.16×, alerts
0.90× in two columns, scanner with score bar + notes), both cold re-verified and pushed → owner: _"proceed
with the visual baseline receipt flow"_ → the flow is **win32/linux-only by schema**, so the Mac could only
prepare it (`visual-baseline-receipts/`: RUNBOOK, drafting helper, darwin preview of the six compositions)
→ owner ruling, verbatim: _"the Windows session may sign both, proceed on Windows (i'm on mac right now),
commit and push everything i need and create a handover so i can continue on a windows machine"_ —
recorded as ledger row `conductor-signs-both-visual-receipts-on-owner-ruling`.

**The task on this box, in order:**

1. `git fetch && git switch spire/curvature-v2-foundations && git pull --ff-only && git status` → clean.
2. Run the **win32** flow end to end per `visual-baseline-receipts/RUNBOOK.md` (steps 1–6): compare-only
   → inspect the six actuals and diffs against `context/DESIGN_SYSTEM.md` + `design/site/*.html` (the
   darwin preview in `visual-baseline-receipts/preview-darwin-ecbb73e5/` shows the same compositions) →
   `visual_receipts.mjs authorize` → `npm run browser:visual:update -- --authorization …` → inspect the six
   candidates and the patch → `visual_receipts.mjs accept` → two clean compare runs →
   `visual_receipts.mjs stability` → **one** commit → push.
3. If WSL2 (x86-64 Ubuntu) is available: repeat for **linux** from a separate clone inside WSL (the runbook
   says why). If not, say so plainly — the linux flow waits, and CI's visual child stays red until it runs.
4. Do **not** open the PR without asking. Report back: the two candidate-set ids, the acceptance ids, the
   stability run ids, and the six SHA-256 per platform.

**How to boot on Windows:** `node .spire/bin/spire.mjs run tech --provider claude` then `/spire-tech`.
Toolchain: Node **26.7.0** (`.nvmrc`; nvm-windows), `npm ci`, `npx playwright install chromium`,
`npx nx build @convexa/dashboard --configuration=production` (the gate serves `dist` when
`BROWSER_QUALITY_PREBUILD_STATUS=pass`; PowerShell: `$env:BROWSER_QUALITY_PREBUILD_STATUS='pass'`).
`.gitattributes` enforces LF — do not set `core.autocrlf`; the helper writes LF. `run-gate.mjs` on win32
needs `node_modules/npm/bin/npm-cli.js` beside `node.exe` (a standard install has it). `npm run ports:free`
is Windows-aware. Each gate run wipes `apps/dashboard-e2e/test-output/playwright/visual/` — copy
`summary.json` aside between runs. The six visual scenarios run on strict fixtures: the API does not
need to run, no account is needed, and no live vendor is contacted.

**Rules that bind here:** the update command runs only through the authorization receipt — never
`--update-snapshots` by hand; nothing is committed before `stability_clean`; never `git stash`; never
commit `.env*`; never create an account or type a password; the helper drafts, the session decides after
looking — say in the report what was looked at.

**Paste this to open the Windows session:**

```
/spire-tech
Boot from .spire/clusters/tech/state/spire-curvature-v2-foundations/RESUME.md — its top block is the Windows handover written on the Mac on 2026-09-08. Task: run the visual-baseline receipt flow on this win32 box end to end per visual-baseline-receipts/RUNBOOK.md, drafting the receipts with visual_receipts.mjs. The owner ruled that this session may author BOTH the authorization and the acceptance, after inspecting the actual/diff images and then the candidate PNGs and the patch. Keep everything untracked until stability_clean, then one commit and push. If WSL2 x86-64 is available, repeat for linux from a separate clone inside WSL; otherwise say so. Do not open a PR without asking. Report the candidate-set ids, acceptance ids, stability run ids and the six SHA-256 per platform.
```

**Residuals the owner already knows (do not fold into the flow):** the anonymous `/ticker` headline wraps
at 1280 beside the sign-in card; the scanner header cluster centres under the title at 900; positions at
1440 is 1.26× the design; the AI-providers panel is 633 px against 420; the scanner fixture's
`sweep_last_completed: 1` sentinel renders "Structure as-of 496528h" (audit L2). The hosted Linux
candidates workflow cannot complete as wired (BACKLOG Harvest 2026-09-08 addendum).

## ⬆ UPDATE — 2026-09-08, owner: "proceed with the visual baseline receipt flow" — prepared; BLOCKED on platform, by design

The flow (`apps/dashboard-e2e/visual-review/README.md`, ledger `visual-baseline-requires-human-authority`) is
scoped to **win32 and linux** by schema and validator; this Mac is darwin and has no Linux runtime, and no
session reaches the Windows box. Nothing in the flow can run here. What was done instead, all committed under
`visual-baseline-receipts/`: (1) a compare-only run on this Mac at `ecbb73e5` proving the six visual fixtures
still reach the screenshot step on the redesigned app (all six fail only on the missing darwin baseline) and
previewing the six compositions the owner authorizes (`preview-darwin-ecbb73e5/`); (2) `visual_receipts.mjs`,
a drafting helper that writes the authorization and acceptance receipts from evidence on disk and validates
them with the repository's own validators — proven against the three shipped win32 receipts and on dry runs
(artifacts deleted); (3) `RUNBOOK.md`, the exact sequence for the Windows box (win32) and a Linux host (WSL2
x86-64 for CI parity), with the untracked-until-stable rule the 2026-08-24 flow relied on.

**Findings, filed:** all six baselines are stale on both platforms since phase 1 (not only the two the
surfaces task named); CI's linux visual child will be red on any PR from this branch until the linux flow runs;
the hosted `browser-visual-linux-candidates.yml` path cannot complete as wired (depth-1 checkout vs.
`assertSourceScope`; receipt/evidence commit ordering; stability's revision binding) — `context/BACKLOG.md`
Harvest 2026-09-08 addendum; `validateStability`'s image-hash check is vacuous on pass runs. Preview
residuals: the anonymous `/ticker` headline wraps at 1280 beside the sign-in card (pass-2 change 9 side effect);
the scanner header cluster centres under the title at 900.

**Next, on the Windows box** (a Claude session there can drive it from the runbook): win32 flow end to end,
one commit; then the linux flow in WSL2, one commit; then the PR. Owner's call whether the conductor acts as
both authorizer and code reviewer (PLAN.md:86 says the conductor supplies both after review) or a second pair
of eyes signs the acceptance.

## ⬆ UPDATE — 2026-09-08, conductor: the surfaces fidelity lane is VERIFIED and accepted — F5–F8 closed

The lane landed eight commits (`debbd55f`…`cf4727b9`: positions · alerts · settings · scanner, three
fixups the gates themselves caught, the report). Cold re-verification (fresh uncached production build,
the harness `--grep "positions|alerts|settings|scanner"` into `surfaces-repair-verify/`) matched the
lane's census **to the pixel**; report: `SURFACES_FIDELITY_REPAIR_REPORT.md`, last section. The review
found two copy claims the data does not vouch for — "Prime starts around 80" (the tier band is a server
env, default 75, never on the wire) and "fired alerts … on the desk" (the desk evaluates and notifies,
displays nothing) — plus the events' "Mark read" button on the Rules card and the fifth track-record card
wrapping alone; three conductor commits fix them, and a fourth makes the harness's `contentBottom` a
census field (the instrument's blind spot the lane found: `pageHeight` reads the grown 1,800 px viewport
on short pages).

**Numbers, final tree (content height vs the design measured in the same run):** positions at 1280
**1,298 vs 1,120 = 1.159×** (audit 1.69×; threshold ≤ 1.20 now met; 1440 still 1.258× — the app's
1,240 px max column does not reflow while the design's does; 390 1.103×); alerts **0.903×** at 1280/1440
in the design's two columns (composer 39.2%), 0.763× at 390; settings **1.158×** (audit 1.51×), 0.891× at
390; scanner: no `overflowX` on any of five captures, score bar on every row, notes row present.
Sub-thresholds still open: `settings-ai-key-panel` 633 vs ≤ 420 (from 1,142); `tr-families` met (176 ≤ 320).

**Every gate green cold, standalone:** e2e **108/108, 0 flaky** (uncached) · unit suite alone 240 files /
**2,921** · typecheck 0 (+ the e2e project's tsc 0) · lint 0 (5 pre-existing warnings) · format 0 ·
`apps/api` diff empty · NUL/CRLF 0 across 59 files.

**Now the owner's call, in order of leverage:** (1) the visual gate's `positions-dense` and `scanner-dense`
baselines changed by design — authorization → candidates → acceptance receipt flow, never `visual-update`
unilaterally; (2) phase 4 (landing + responsive) with a composition row per surface and the harness as
the instrument; (3) the residuals named in the report (positions at 1440 / `OrdersPanel`; the AI-providers
panel; Brokerage progressive disclosure; the alerts "universe member" chip and desk-open chip; scanner
STATUS-into-age and the hover preview; the scanner fixture's `sweep_last_completed: 1` sentinel — L2);
(4) the backend backlog items on `main` ("Harvest — 2026-09-08"). Lesson recorded: the mock's captions
are design intent for layout, never for numbers — every figure the app prints needs a wire source.

## ⬆ UPDATE — 2026-09-08, pass 2 of the /ticker lane ("Do all four") landed — GATE Z: none

All three frontend changes landed, four commits (`1d84505a` change 7 hero header collapse at 390 ·
`ed1671f6` change 8 `IvRank` unmounted from the band · `1f8b606e` change 9 masthead controls join the
headline row at ≥ laptop · `b91b59ff` a manifest-sync fix change 8's e2e rename needed, found at the
e2e gate). Full account: `TICKER_FIDELITY_REPAIR_REPORT.md`'s `## Pass 2` section (per-change detail,
every assertion edit with its reason, before/after composition table, gate exit codes).

**Every gate green cold:** typecheck 0 · dashboard suite 0 @ 239 files / **2,914** tests (was 2,905) ·
lint 0 (4 pre-existing warnings) · format:check 0 · `apps/api` diff empty · NUL scan 0 · the harness
(`--grep desk-real`, fresh production build) 11/11 · e2e (`--grep "desk|curvature|overflow"`)
108/108, 0 flaky. **No GATE Z items this pass** — every decision point was already resolved by the
task's own text or was an in-lane testing-strategy call (change 8's two page-level test cases moved
into `IvRank.spec.tsx` rather than dropped, listed in the report).

**Composition, the numbers that mattered:** the ONE page-level threshold the conductor's cold
verification had missed (390 px page height, was 5,566 vs ≤ 5,520) is now **met** — 5,484 px, 36 px to
spare — because change 7 fixed the actual defect driving it (the hero header's `S…` truncation and
one-word-per-line subtitle wrap at 390, now visually correct, confirmed against the crop evidence).
Two region-level thresholds stay narrowly missed, each with a directly-measured root cause (not
guessed): `command-deck` 215 px vs ≤ 200 (design 186) — joining the toolbar widens the header's right
region enough that its own chip row wraps to two lines at 1280/1440, a content-width tension, not a
join bug; `widget-structure-hero` 968 px vs ≤ 950 (design 905) at 390 — the header itself (the fixed
defect) is correct, the remaining 18 px reads as ordinary content-length variance in the must-not-touch
canvas/ladder interior. The band (`ticker-context-grid`) landed at 968 px, within 2 px of the task's
own predicted "≈ 970" — the ≤ 800 density target stays the owner's own named-open item, untouched by
design (no field was cut to force a number under a line).

## ⬆ UPDATE — 2026-09-08, owner: "proceed with the surfaces lane" — the four site surfaces open as a direct lane

Contract: `SURFACES_FIDELITY_REPAIR_TASK.md` (this folder) — positions (F5) · alerts (F6) · settings (F7,
rail still deferred per D-B) · scanner (F8), on the ticker lane's rules; the composition gate is the audit
harness `--grep "positions|alerts|settings|scanner"` into `surfaces-repair-after/`, thresholds as ratios of
the design's height measured in the same run. The visual gate's `positions-dense` and `scanner-dense`
baselines will change by design and need the receipt flow afterwards. Report:
`SURFACES_FIDELITY_REPAIR_REPORT.md`.

## ⬆ UPDATE — 2026-09-08, conductor: Pass 2 VERIFIED and accepted; the /ticker fidelity lane is CLOSED

Cold re-verification matches the lane's Pass 2 numbers to the pixel (report, last section). Desk at
1280: **2,705 px vs the design's 2,532 (1.07×)** — from 4,046 (1.57×) before the audit. All four owner
decisions are executed: hero header fixed at 390 (`1d84505a`), IvRank out of the band (`ed1671f6`),
masthead controls on the headline row (`1f8b606e`), and the two backend items filed in `BACKLOG.md`.
Every gate green cold; e2e 108/108. **Small residuals, not blocking, next touch of `/ticker` owns them:**
masthead 215 vs ≤ 200 (second line wraps `All expirations` at ≥ 1100), hero 968 vs ≤ 950 at 390,
band 968 vs the ≤ 800 density item. **Next:** the four site surfaces (positions · alerts · settings ·
scanner — audit F5–F8) as a second direct fidelity lane, then phase 4 (landing + responsive) with a
composition row per surface; or phase 4 first if the owner prefers. Harness lesson recorded in the
report: never run the unit suite concurrently with a production build — 6 phantom failures.

## ⬆ UPDATE — 2026-09-08, owner ruled "Do all four"; pass 2 of the /ticker lane opened

All four pending decisions taken: (1) fix the hero header collapse at 390 (owner leave for the hero
**header** only); (2) remove the `IvRank` card from the context band (ruling recorded in
`context/DECISION_LEDGER.md`, `context-band-is-the-designs-card-list`); (3) the masthead's controls join
the headline row at ≥ 1100; (4) the flow sparkline and the masthead's change/name are **backend** backlog
items (`context/BACKLOG.md`, "Harvest — 2026-09-08"), not built on this branch. Pass 2's contract is
appended to `TICKER_FIDELITY_REPAIR_TASK.md` (changes 7–9); the lane reports into
`TICKER_FIDELITY_REPAIR_REPORT.md` under `## Pass 2`.

## ⬆ UPDATE — 2026-09-08, conductor: the /ticker fidelity lane is VERIFIED and accepted; four owner decisions pending

Cold re-verification (every gate re-run, a fresh build, the harness into `ticker-repair-verify/`, the
desk e2e 108/108) matches the lane's report to the pixel — see the last section of
`TICKER_FIDELITY_REPAIR_REPORT.md`. Desk at 1280: 4,046 → 2,818 px (1.57× → 1.11× the design).
Fourteen lane commits `c6afe2c6..810da249`, pushed with this note. **Pending, the owner's:**
(1) masthead 243 vs ≤ 200 — the headline row still sits above a separate controls row; the design puts
`EXPIRATIONS` / `PERSONA` / the CTA on the headline's right at ≥ 1100; (2) the `IvRank` card in the
context band is not in the design's band and repeats the read strip's IV-rank cell — remove it from the
band (frees a grid row, −85 px) or keep it; (3) the hero header collapses at 390 (`S…`, one word per
line) — a bounded wrap fix inside the fenced hero, needs leave; (4) the Live tape flow sparkline has no
wire trail (GATE Z above) — server-side trail on the SSE event (backend backlog) or a client ring-buffer
(product call). Then phase 4 with a composition row per surface, or a second direct lane for
positions / alerts / settings (F5–F8) first.

## ⬆ UPDATE — 2026-09-08, ticker fidelity repair lane resumed (rate-limit kill) — GATE Z filed, composition

## gaps closed further

**What happened.** The build lane on `TICKER_FIDELITY_REPAIR_TASK.md` was killed mid-edit by an API rate
limit (two half-finished, uncommitted files). A fresh lane resumed: finished the interrupted Market
context edit, then closed composition gaps in the context band, Live tape, the masthead and Setups
(phone). Four fix commits: `d5362a82` (finish the Market context wiring) · `a3d53244` (context band density +
responsive column count) · `bea3aed2` (Live tape's 2×2 grid + masthead control row) · `119bf485` (Setups
density) — plus `88d887eb` (this report + the harness evidence). Full account, numbers and gate exit
codes: this folder's `TICKER_FIDELITY_REPAIR_REPORT.md`.

**GATE Z — the design's Live tape "Flow" sparkline has no wire equivalent (not built, not faked).**
`design/src/screens/desk.mjs:363-364`'s Live tape card ends with a flow-spark row — a 30-point trail
sampled every 10 seconds (`SPY · 30 × 10s`), rendered as a `sparkline()`. The live stream
(`LiveUpdateBody`, `libs/api/src/generated/schema.ts:1550`) carries only the CURRENT scalar `net_flow`
per tick — no trail/history array. Rendering the design's spark would require either (a) fabricating
data (forbidden — canon, and this task's own rules), or (b) a new client-side ring-buffer that
accumulates stream ticks into a rolling 30-point window — a real, undecided product behavior (reset
rules on symbol change / stream drop / tab backgrounding, eviction policy) that reaches into the
liveness/stream-isolation area this task's must-not-change list protects, not a pure layout change. Not
built this lane. If wanted: either (a) the API starts including a short server-side trail on the SSE
event (cheapest, keeps the accumulation logic and its edge cases server-side, matches how `atm_iv`/
`hv_30d` already exist upstream per the F3 API follow-up below), or (b) a follow-on FE lane scoped
explicitly to design the client-side accumulation's behavior (owner/product call, not a layout lane's
to invent). `LiveTape.tsx`'s 2×2 figure grid itself is fixed and verified (533px → 318px against the
design's 295px) — only the spark row is the open item.

## ⬆ UPDATE — 2026-09-08, ticker fidelity repair lane, change 3 (F3) — API follow-up filed

**What happened.** Direct repair lane on `TICKER_FIDELITY_REPAIR_TASK.md`'s six changes (F1/F2/F3/F4/F9/F10),
off the council pipeline, per the owner's "proceed with your recommendations" on the 2026-09-08 audit. This
entry is the ONE thing that lane could not build in-lane (NO_BACKEND_CHANGE): a follow-up for `apps/api`,
filed here rather than invented client-side. See this folder's `TICKER_FIDELITY_REPAIR_REPORT.md` for the
full six-change report (composition table, gate exit codes, commits).

**GATE Z — API follow-up (not built this lane, `apps/api` stays untouched here).** The masthead's
design source (`design/src/screens/desk.mjs:261-262`) shows `SPY 573.12 +1.84 · +0.32%` — a signed
change (`+1.84`) and a signed percent (`+0.32%`) beside the mid — plus the instrument's full name
(`SPDR S&P 500 ETF`, `desk.mjs:267`). Checked against the saved real bundle
(`fidelity-audit-2026-09-08/_tools/spy-bundle-2026-09-08T1059Z.json`) and the wire schema
(`libs/api/src/generated/schema.ts`): `market_state` carries `price` and `gex_spot` only — no prior
close, no session-open reference, no signed change/percent field, and no instrument display name
(only the ticker symbol). Change 3 (F3) therefore **omits** both fields on the rebuilt masthead —
never faked, never rendered as the closed not-a-number vocabulary's `—` (canon 24 is for absent
_figures_, not absent _wire fields_ the schema never promised) — `TickerHeader.tsx` shows `SYMBOL ·
$mid` only, dropping the parenthetical the old layout used to carry (`levels @ / expirations` moved
to a new second line instead; see the change's own commit).

**What the API would need to add, if this is wanted:** (a) a prior-close or session-open reference
price on `market_state` (or a pre-computed signed change/percent pair, to keep the sign/rounding rule
in one place) — Convexa's own vendor feed almost certainly carries this upstream since `atm_iv`/`hv_30d`
already exist; (b) an instrument display name lookup (ticker → "SPDR S&P 500 ETF") — either a small
static map (index/sector/megacap ETFs the universe already curates,
`apps/api/src/scanner/config/universe.json`, the same file `scanner/labels.ts` re-mirrors by hand) or a
real per-symbol metadata field if the vendor feed carries one. Neither is large, but both are
`apps/api` changes outside this lane's `NO_BACKEND_CHANGE` scope — an owner/backend-lane decision, not
a client-side one.

## ⬆ UPDATE — 2026-09-08, the Mac session (read this before the handover block below)

**What happened.** The Mac booted from the handover, then ran the owner's request: _"re-audit all the
work that has been done so far and make sure that it is faithful to the Convexa Desk Redesign …
gather evidence with screenshots."_ Result: `fidelity-audit-2026-09-08/FIDELITY_AUDIT.md` (this folder)
— the built app and `design/site/*.html` rendered side by side at 1440 / 1280 / 834 / 390, DOM-census
measured, 29 composite pairs. Verdict: the v2 vocabulary shipped everywhere and the repaired hero is at
the design's height (483 vs 488); the rest of `/ticker` and the four site surfaces are still v1 layouts
(desk 1.57× the design's height at 1280 with the hero fixed · positions 1.69× · settings 1.51× · alerts
one column vs two). New: the term-structure chart hard-codes dark ink and off-palette green/red and
renders as a black block in the light scheme (F9); the live chip printed `live · undefined` when a stream
event lacked `market_session` (L1 — **fixed** `6ab92e97`); two template leaks in the design oracle
(**fixed** in the generator, `ad1e7696`). Web report:
https://claude.ai/code/artifact/d00842fe-a02d-4b21-9885-df8ecd206193.

**Owner decisions (2026-09-08, verbatim "proceed with your recommendations"):** (1) push — done,
`c0f05063..ad1e7696`, six commits: spire 3.19.3 upgrade (`76f18d12`), the CI format gate (`d9987f18`),
CLAUDE.md's Nx rules restored (`978ad012`), the audit + harness (`2fca12ce`), the two fixes; (2) **extend
the fidelity pass to the rest of `/ticker`** — masthead · read strip · tape-and-plan grid · context band ·
F9 — as a direct repair lane on the hero repair's rules, **before phase 4**; the composition gate is the
audit harness's `desk-real` measurements (task file: `TICKER_FIDELITY_REPAIR_TASK.md`, this folder);
(3) every later contract carries one composition row per surface, measured the same way; (4) positions /
alerts / settings (F5–F8) follow as a second direct lane or a phase-4 item, then phase 4.

**Also landed on the Mac:** spire-os **3.19.3** (the 3.19.1 receipt was off-spec for every release — five
fields no spire-os ever wrote; 3.19.3 validates without `--force` and adopts `.claude/launch.json`
across the wipe) · `AGENTS.md` is a repo-root immutable the installer rewrites, so it is Prettier-exempt
now and the Nx rules live in `CLAUDE.md` · `npm run ci` never ran `format:check` while CI did — 20
files were red on GitHub across all three phases; fixed, and worth adding `format:check` to `ci:targets`.

**Machine notes.** The vendor websocket flapped through this session (backoff to 60 s) and
`/api/ticker/SPY` stopped answering; the audit's desk captures render a saved real bundle
(`fidelity-audit-2026-09-08/_tools/spy-bundle-2026-09-08T1059Z.json`) through the strict fixture
instead. The audit harness has a `AUDIT_LIVE=1` mode for a healthy API. Raw PNG captures are gitignored
in the evidence folder; the JSON census, JPEG pairs and tools are committed.

## ➡ HANDOVER — to a fresh session on the owner's Mac (written 2026-09-08 on the Windows box)

**Read this first, then the recovery block under it.** Claude's per-machine memory does **not** travel —
this file and its two siblings (`STRUCTURE_HERO_REVIEW.md`, `STRUCTURE_HERO_REPAIR_TASK.md`) are the only
memory the Mac session has. Treat every claim here as a claim: re-verify against `git` before acting.

**Branch state at handover:** `spire/curvature-v2-foundations` at **`aebf7cc7`** plus one `docs(research):`
commit made at handover for the owner's business-review folder (27 files, read-only research, no code).
Pushed to origin; **no PR**; nothing uncommitted. `main` is untouched by this branch's work.

**What just happened (last 24 h):** phase 3 closed at GATE S → owner saw the `/ticker` structure hero
"looks off" → review found it was the plan's placeholder stack and that every phase built v2 vocabulary on
v1 layouts (site-wide survey in `STRUCTURE_HERO_REVIEW.md`) → owner ruled _"just fix the ticker screen
for now"_ → one Sonnet repair lane landed it (`57525861..1ac1f339`) → conductor re-verified cold
(typecheck 0 · 239 files / 2,861 tests 0 · lint 0 · e2e `desk|curvature|overflow` 108/108 vs production
build · `apps/api` diff empty) · hero **1,225 → 550 px** at 1280 (design 488).

**The decision waiting for the owner:** extend the same fidelity pass to the **rest of `/ticker`**
(masthead frame · read-strip chrome + an 8th-cell **clip at 1280** · tape-&-plan grid · context-band
grid/density — measured table in the review) — recommended, one Sonnet lane, same rules as
`STRUCTURE_HERO_REPAIR_TASK.md` — or stop at the hero and open phase 4 proper. **Ask; do not start it.**
Then the five cosmetic hero residuals (review § "Repair result") fold into whichever comes first.

**How to boot on the Mac:**

1. `git fetch && git switch spire/curvature-v2-foundations && git status` — expect a clean tree at or after
   the research commit.
2. `node .spire/bin/spire.mjs run tech --provider claude` then `/spire-tech` (cold start) — the conductor's
   boot sequence reads this file as the overlay.
3. Toolchain: Node via nvm (`.nvmrc` / `package.json engines`), `npm ci`, Rust stable for `apps/api`
   (`cargo run -p api-rust -- serve`), `npx playwright install chromium` for e2e. `npm run ports:free`
   is cross-platform (`lsof` on macOS). None of the Windows notes in the global CLAUDE.md (`py -3`,
   nvm-windows PATH, MSYS path mangling, CRLF) apply on the Mac; `python3` is fine.
4. `npm run dev` → `http://localhost:4200/ticker/SPY` needs no account; scanner / positions / alerts do —
   **never create an account or type a password on the owner's behalf**; to _render_ those pages for a
   layout check, route `/api/auth/session` to `{ authenticated: true, … }` in Playwright as
   `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:207-218` does (data endpoints then 403 — fine
   for composition, useless for populated states).
5. Design oracle: serve `design/site/` statically (`python3 -m http.server 4310 --directory design/site`)
   and compare `desk.html` etc. at 1280 / 1000 / 393. Regenerate with `node design/src/build.mjs`; never
   hand-edit `design/canvas` or `design/site`.
6. Gates before any "done": `npx nx typecheck @convexa/dashboard --skip-nx-cache`, the dashboard suite
   (delete `node_modules/.vite` if a `_mutation_poison_*` phantom appears), `npm run lint`, and e2e as
   `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e` against the production build after
   `npm run ports:free`. Exit codes, not printed summaries.

**Standing rules that bit this week:** never `git stash`; never a bare `nx format:write` (scope with
`--files`); `apps/api` diff must stay 0 on this branch; `OrderRow.tsx:172` is off-limits (Z-1); no literal
NUL bytes; verify every cited `file:line` with `grep -n` before acting — anchors drifted in every phase;
ask before push / merge / release / deploy / migrations; build lanes on Sonnet, Opus/Fable for
council / skeptic / architecture.

## ⚠ RECOVERY BLOCK — written 2026-09-08 because the owner's session could end abruptly

**Where we are.** Phases 1–3 shipped. After phase 3 the owner looked at `/ticker/SPY` locally and said the
structure widget looked off. Investigation (`STRUCTURE_HERO_REVIEW.md`, this folder) found the hero is the
plan's placeholder stack, 1,225 px vs the design's 488 px, and that the divergence is **systemic**: every
phase installed v2's vocabulary on v1's layouts because no BRIEF/SPEC/QA row ever compared composition to
`design/site/*.html`. Owner ruling (2026-09-07): **"Just fix the ticker screen for now."**

**UPDATE 2026-09-08 — the hero repair LANDED and is verified by the conductor's own runs.** Five lane
commits `57525861 · 9b57e338 · a8f822b1 · 003853cc · 1ac1f339` (17 files, frontend only), all ten task items
done. Conductor re-ran cold: typecheck **0** · dashboard suite **239 files / 2,861 tests, exit 0** · lint **0**
(one pre-existing warning) · e2e `--grep "desk|curvature|overflow"` against the production build **108/108,
exit 0** · `apps/api` diff **empty** · NUL scan clean. Measured hero at 1280: **550 px** (was 1,225; design
488), Magnet view also 550 (no height jump); 1000: 760 px, one column, 5-cell ladder row; 393: 1,041 px, 2×2
ladder; no horizontal overflow, 0 console errors. Pushed to origin as a backup. Residuals recorded in
`STRUCTURE_HERO_REVIEW.md` § "Repair result" — none blocking.

**Open owner question, unanswered when written:** the rest of `/ticker` also diverges (masthead framing,
read strip chrome + an 8th-cell clip at 1280, the tape-&-plan grid, the context-band grid/density — table in
`STRUCTURE_HERO_REVIEW.md` § "The rest of `/ticker`"). Recommended: a second lane for the full ticker page
after the hero lands. **Ask before starting it.**

**Not started, still pending the owner:** phase 4 proper; the `docs/research/…` folder (offered twice for
`docs(research):`, never answered); the canon's Icons-row `U+26A0` question.

**Servers** (kill with `npm run ports:free`, plus `4310` for the static design site): `npm run dev` on
`:4200`/`:8000`; `py -3 -m http.server 4310` from `design/site/`.

---

**Phase 3 of 4 (`curvature-v2-surfaces`) is DONE and closed at GATE S on 2026-09-07 — GATE Q PASS 95/0/0.**
**Phase 2 of 4 (`curvature-v2-desk-and-read`) is DONE and closed at GATE S on 2026-09-05.**
**Phase 1 of 4 is DONE and closed at GATE S on 2026-09-03.**
**Next: phase 4 of 4 — open it at GATE I.** Branch is **pushed to origin as a backup** (owner's call, 2026-09-07) and there
is **no PR** — the owner's call. Everything after the backup push is local; push again before relying on it.

| phase                          | scope                                                                                                                                                                           | state                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 `curvature-v2-foundations`   | tokens, scales, `FigureCell`, connection chip, nav + ⌘K, container panels                                                                                                       | **shipped, GATE Q PASS 79/1/1**                                                                                                                               |
| 2 `curvature-v2-desk-and-read` | desk masthead, structure-field hero, level ladder, read strip, verdict-first AI read, retention latch                                                                           | **shipped, GATE Q PASS 60/0/1**                                                                                                                               |
| 3 `curvature-v2-surfaces`      | scanner · positions (sim + Broker tab) · settings · alerts **· the eight ticker quiet-band widgets' internals**                                                                 | **shipped, GATE Q PASS 95/0/0** (pass 4; passes 1–3 FAILed 91/4/0, 93/2/0, 94/1/0). 5 owner rulings D-A…D-E, 2 conductor calls, S2 ×2, 4 GATE Z repair passes |
| 4                              | landing · site pages · responsive sweep · the curve text-equivalent · spacing burn-down remainder · **settings section navigation (deferred from phase 3 by owner ruling D-B)** | not started                                                                                                                                                   |

**Read before designing phase 4:** `contracts/curvature-v2-surfaces/_MANIFEST.md` — the **GATE S close-out section** is the
most useful page in this branch: the conductor's own final measurements, what the gate caught that three green suites did not,
the regression this phase introduced and fixed, and the process notes. Then `contracts/curvature-v2-surfaces/QA_REPORT.md`
(**all four passes** — the three FAILs are where the value is) and `council/decisions.md` §4 (rulings **D-A…D-E**, each with
its reversal; the two CONDUCTOR calls are the only ones that lapse). `BUILD_REPORT.md` §9 carries the itemized debt with
`file:line` and an owning phase. The AI-powered direction is **PARKED** in `context/BACKLOG.md` (2026-09-06 harvest) with the
verified provider rules and the resume shape — do not re-derive it.

**Phase 4's scope, and what phase 3 handed it:** landing · site pages · responsive sweep · the curve text-equivalent · the
spacing burn-down remainder · **settings section navigation** (owner ruling **D-B** deferred it out of phase 3 — it is a real
scope item with three named behaviours, not leftovers) · the three sub-44px `Select`s on `/ticker` and the 15 `ScanToolbar`
chips (itemized, untouched this phase so out of criterion 66's reach) · the `/positions` condor width tuning at 900px.
**Owner-flagged 2026-09-07, after phase 3 closed — the structure hero does not match the design source:**
`STRUCTURE_HERO_REVIEW.md` (this folder) measures it — 1,225 px tall vs the design's 488 px at 1280, the field
window at spot ±10 % (`chart.tsx:26-27`) leaving the wall span 13 % of the plot, the ladder as five figure
cards instead of `ladder.mjs`'s one-line rows, no axis, no max-pain line, `Levels|Magnet` toggle. Root cause
is `PLAN.md:1205`'s illustrative stack becoming the layout with no composition criterion. **It is systemic, not the hero alone** — the same
file's site-wide survey rates `/positions` and `/alerts` **far** from their design pages and `/scanner` and
`/settings` **partial**; only nav, masthead and the read strip are close. Cause: no BRIEF after phase 1 named a
design screen, no criterion in any phase reads "matches `<screen>.html` at a width", and the canon (`:256` item 7)
calls composition "design intent, not a line-by-line rule". **Phase 4 must carry one composition row per
surface, with the generated design page as the oracle.** Awaiting the owner's call on route.
**Open owner question filed in the canon's Icons row:** does the colour-emoji clause reach `U+26A0` (⚠) in a scanner chip
label (`pages/scanner/labels.ts:196,205,211`), or is it a deliberate third truth mark? Answer it before touching those chips.

**Read before designing phase 3 (kept for provenance):**
`contracts/curvature-v2-desk-and-read/_MANIFEST.md` (gate trail, final measurements, the four defects this
phase found in shipped code, and the carried-debt list with phases attached),
`contracts/curvature-v2-desk-and-read/QA_REPORT.md` (**both passes**), and
`state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md` (the seven DELEGATED calls P1–P5, D-14, D-15,
each with its reversal — ratified by the owner's spec approval, and two of them corrected later in the
session when they turned out to be wrong on their facts).

**Phase 3's canon amendment is filed:** rule **13**'s type register now reads "traced to Convexa's computation
**or to a record the trader entered**" (owner ruling **D-D**), so a number the trader typed renders Mono with no dotted rule.
Criterion 7a was amended separately by owner ruling **D-E** at GATE Z — it is a contract row, not canon.

**Phase 2's canon amendments are filed:** rules **11**, **14**, **16** (amber → text-scoped with a closed
three-item non-text list; nine states → **ten**; composition and dispositions), and **17** (tense only).
The `tooltip` z-rung is deliberately **not** amended — `theme.ts:83` already ships a working, consumed
value of **60**, and the gap is in the canon's prose, not the code.

**The traps that cost the most time, so phase 4 does not re-chase them:**

1. A stale `node_modules/.vite` glob transform holding a deleted `_mutation_poison_*` file produces a spurious
   suite failure that **`--skip-nx-cache` does not clear**. It bit again in phase 3, including one of QA's own runs.
   Delete `node_modules/.vite`.
2. **The local e2e run silently falls through to the Vite dev server** unless invoked as
   `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e` from the repo root, because `process.env.CI` is unset
   outside CI. `broker-grouping.spec.ts` fails ~74/75 on dev and passes against the production build.
3. **The browser-quality manifest is four files that must move in lockstep** with the e2e case count, or passing tests
   report `"status": "incomplete"`.
4. **The IDE's diagnostics were wrong on every lane's tree this phase** — dozens of phantom errors on trees that
   cold-typecheck at exit 0. The cold exit code is the only evidence.
5. **Verify every cited line number and path with `grep -n` before acting on it.** Anchors drifted repeatedly, in both
   directions: lanes corrected the conductor twice, and QA corrected the conductor once.

---

# RESUME — spire/curvature-v2-foundations (2026-09-03)

**Resume status:** ACTIVE — **phases 1–3 closed at GATE S; PR #46 open; win32 + linux visual baselines re-accepted 2026-09-09 at `be00d739` (branch at `27eb19e2`); phase 4 council at the S2 cap with the D-B ruling open — see the 2026-09-09 block at the top.**  
**Written:** 2026-09-03 (GATE R, phase 1 closed at GATE S — a clean phase boundary, not a mid-build checkpoint)

Written at GATE R for a **fresh session on another machine**. Self-contained against `PROJECT_CONTEXT.md`.
Boot with `/conductor`; this file is the overlay.

## Objective

Build **Curvature Terminal v2** — the owner-approved site-wide redesign — in **four phases**, through the
spire council pipeline (owner chose the pipeline over a direct branch build, 2026-09-03).

**Phase 1 of 4 is DONE and closed at GATE S.** Phases 2–4 are unstarted.

| phase                        | scope                                                                     | state                                                          |
| ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1 `curvature-v2-foundations` | tokens, scales, `FigureCell`, connection chip, nav + ⌘K, container panels | **shipped, GATE Q PASS**                                       |
| 2                            | desk hero + level ladder + read strip + **verdict-first AI read brief**   | not started — _this is the owner's original loudest complaint_ |
| 3                            | scanner · positions · settings · alerts                                   | not started                                                    |
| 4                            | landing · site pages · responsive sweep (adds 834 to the overflow suite)  | not started                                                    |

## Done (7 commits on this branch, pushed, **no PR**)

`ccea723` canon re-baseline · `4231e13` the `design/` source · `2fb26d9` council output · `e5b132b` adapter
receipt · `404f814` **the phase-1 build** (134 files) · `e94343c` pipeline records · `770d547` canon
amendments + ledger.

Design canon is `SET — Curvature Terminal v2` (`context/DESIGN_SYSTEM.md`). `docs/design/DESIGN_SYSTEM.md`
is a pointer stub. `design/` holds the canvas + static site + `library.html` + the verified token mirror;
regenerate with `node design/src/build.mjs`, never hand-edit `design/canvas` or `design/site`.

## Verified final state (the conductor's own runs, not the lanes')

typecheck 0 · dashboard suite 0 @ **215 files / 2376 tests** · lint 0 · e2e 0 @ **75/75 against the
production build** · `node design/src/verify-tokens.mjs` 0 · `contract_lint` 0 errors · `apps/api` diff
**0 lines** · all 32 council conflict ids re-derive from the live R2 bytes.

## Next concrete step

Open **phase 2** at GATE I: write `.spire/clusters/tech/contracts/<phase-2-feature>/BRIEF.md` (format:
`ORCHESTRATOR.md` §4a; fill `Considered:` with the real cull set), then `/council <feature>`.
**Read `contracts/curvature-v2-foundations/council/decisions.md` first** — eight owner rulings, several
of which bind later phases.

## Owed to phase 2 (carried, do not rediscover)

1. **The `LiveTape` last-non-null retention latch** and a test that a latched value is **not** re-flashed
   (owner ruling 2). `useFlashOnChange.ts:44` writes `prev.current` _before_ its null guard, so a drop
   destroys the last value — retention is a real mechanism, not wiring. Clear the latch on symbol change
   and on replay arm.
2. `design/src/verify-tokens.mjs`'s structured checks cover only the **10 v1 tokens**, not the 7 v2
   additions — its exit 0 does **not** prove the mirror matches for `steel2` et al.
3. The spacing exemption list's burn-down (fenced with an expiry by owner ruling 4).
4. The itemized 44px carried debt — `BUILD_REPORT.md` §4, `file:line`, phase attached.
5. **Open owner question:** the undeclared `tooltip` z-rung (canon declares six rungs, MUI has eight;
   `tooltip` defaults to 1500, above every v2 rung).

## Gotchas this phase paid for — do not relearn them

- **A fully green suite is not evidence of correct behaviour.** GATE Q #1 FAILed 72/8/1 while typecheck,
  2353 tests, 75/75 e2e and lint were all green: `[live-vs-static-isolation]` was broken because two
  predicates answered "is this live?". The census test that would have caught it had never been written.
  Ledger key `one-liveness-predicate`.
- **`apps/dashboard-e2e/playwright.config.ts` is an explicit `testMatch` allowlist.** A new spec file not
  added to it never runs and reports green. Prove execution with `--list`.
- **`borderRadius: n` in `sx` means n × `shape.borderRadius`**, not n pixels. Changing `shape` moves every
  numeric site by that ratio.
- **`type-floor.spec.tsx:39` returns only the first rule bearing a class** — structurally blind to
  `@container` blocks; it would pass with them deleted.
- **jsdom does not evaluate container queries.** AC-20b is honestly UNVERIFIABLE (both `FigureCell`
  consumers are `span={2}`, so no wide/narrow panel pair exists to compare). Do not convert it to a PASS.
- **The e2e dev-server flake is real and diagnosed:** `broker-grouping.spec.ts` fails ~74/75 on the Vite
  dev server (`net::ERR_ABORTED`, a navigation race) and passes 75/75 against the production build. Run
  e2e against the production build. `npm run ports:free` first, always.
- **Two tests once shipped with `expect(true).toBe(true)` under a "MUTATION PROOF" heading.** Ledger key
  `a-proof-must-be-able-to-fail`: where a guard is compile-time, prove it with `@ts-expect-error`
  (TS2578 fires if the error stops occurring), never a runtime `expect`.

## Not committed, deliberately

`.claude/launch.json` (CLAUDE.md forbids a hand-maintained copy — generate from `project.json` on demand)
and `convexa-api-contract-candidate-*.ok` (generated cache marker; one is already wrongly tracked on
`main`, and `spire/repo-hygiene-2026-09` fixes the cause).
