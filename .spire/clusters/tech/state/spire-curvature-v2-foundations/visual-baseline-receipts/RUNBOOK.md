# Visual-baseline receipt flow — runbook and standing (2026-09-08)

Owner 2026-09-08: "proceed with the visual baseline receipt flow." This folder is everything the flow
needs that does not have to run on the target platform: the drafting helper, the owner's review
material, this runbook, and the findings the preparation surfaced. **Nothing in the flow itself can
run on this Mac** — see "Where this stands".

Policy of record: `apps/dashboard-e2e/visual-review/README.md`; archived contract
`.spire/clusters/tech/contracts/_archive/browser-quality-gates/SPEC.md` (§2, the receipt shapes and the
state machine) and `PLAN.md:86` ("The conductor supplies an owner/design-review authorization after
failed-compare review and a code-review acceptance/rejection after candidate/source-diff review");
ledger row `visual-baseline-requires-human-authority`. **Owner ruling 2026-09-08** (ledger row
`conductor-signs-both-visual-receipts-on-owner-ruling`): the Claude session on the Windows box may author
**both** receipts after inspecting — the authorization as `workspace-owner`, the acceptance as
`workspace-code-reviewer`. State machine:
`compare_failed → authorized → candidates_written → accepted|rejected → stability_clean`.

## Where this stands

- **Platform-scoped by construction.** The receipt schemas and `tools/lib/visual-review.mjs`
  (`PLATFORMS = win32 | linux`) admit two platforms; baselines live at
  `apps/dashboard-e2e/src/quality/snapshots/{win32,linux}/chromium/`; the README: "Windows and Linux
  baselines are never substituted." This machine is `darwin`: a `darwin` receipt is invalid, and darwin
  bytes can never stand in for either platform. No Docker/Podman/Lima on this Mac; no remote session to
  the Windows box. **The flow runs on the Windows box (win32) and on a Linux host (linux).**
- **All six baselines are stale on both platforms, not two.** Last written 2026-08-24 (win32) and
  2026-08-25 (linux); since then 72 `apps/dashboard/src` commits and 26 changed shell/theme files
  (phase 1 restyled the nav every route shares). No redesign phase ran `browser:visual` (phase 1's QA
  ran the compat spec on chromium only; the surfaces QA never mentions the gate).
- **Fixtures still work.** The compare-only run on this Mac at `ecbb73e5` (`preview-darwin-ecbb73e5/
summary.json`, run `local-1788906089716-7ff1748c`) fails all six scenarios **only** on "A snapshot
  doesn't exist at …/snapshots/darwin/chromium/<id>.png" — every readiness selector, the
  `positions-dense` leg-disclosure click, the `ai-recommendation` dialog and the `ticker-offline-mobile`
  15 s fast-forward all pass. The six actuals are in `preview-darwin-ecbb73e5/<scenario>.png`: they
  are what the owner authorizes, composition-wise (the bytes on win32/linux differ in rasterization).
- **CI is live and will be red on the visual child.** `.github/workflows/ci.yml` runs
  `npm run browser:quality` on ubuntu-24.04 for `push: main` and every `pull_request`; main's CI is
  green (2026-09-05, ~28 min). A PR from `spire/curvature-v2-foundations` fails the visual child until
  the **linux** baselines are regenerated through the flow. The Windows box's local gate needs the
  **win32** flow.
- **The hosted Linux candidates workflow cannot complete as wired** (F-A below). Do the Linux flow on a
  local Linux host — WSL2 x86-64 on the Windows box is the CI-parity choice (same Ubuntu 24.04 +
  Playwright 1.62.1 Chromium 1234 as the runner; an arm64 Linux would not be).

## The helper — `visual_receipts.mjs`

`node .spire/clusters/tech/state/spire-curvature-v2-foundations/visual-baseline-receipts/visual_receipts.mjs`
runs on any host with Node and git (Windows included; it resolves the repo root itself and imports the
repository's own validators from `apps/dashboard-e2e/tools/lib/`). It **drafts** the two human
receipts from evidence on disk and immediately runs the real validator on the draft. It never runs the
update command and never writes under `snapshots/`. The decision stays with the person who inspected
the images: run `authorize` only after looking at every actual/diff; run `accept` only after looking
at every candidate and the patch. Proven on this Mac 2026-09-08: `check` validates all three shipped
win32 receipts; `authorize` drafted a validator-clean receipt from the darwin compare (with a fake
`--platform linux`, deleted, never committed); `accept` drafted a validator-clean acceptance + binary
patch from a temp copy of the shipped win32 candidate set (deleted); `stability` rejects two failing
summaries.

| command                                                                                                                                            | what it does                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorize --summary <visual summary.json> --id <authorization_id> [--actor workspace-owner] [--role owner\|design_reviewer] [--revision <40hex>]` | copies summary + actual/expected/diff PNGs into `visual-review/evidence/<id>/` (as the 2026-08-24 flow retained its evidence), writes `visual-review/authorizations/<id>.json`, validates |
| `accept --candidate-set <candidate-sets/<csid>.json> [--actor workspace-code-reviewer] [--reject]`                                                 | writes `visual-review/diffs/<csid>.patch` (binary `git diff` of the six PNGs vs HEAD; intent-to-add for never-tracked files) and `visual-review/acceptances/<csid>.json`, validates       |
| `check --authorization\|--candidate-set\|--acceptance <path>`                                                                                      | runs the repository validator on an existing receipt                                                                                                                                      |
| `stability --acceptance <path> --summary <run1> --summary <run2>`                                                                                  | runs `validateStability` on two compare-only summaries                                                                                                                                    |

## The flow, on the target host (win32 first, then linux; each platform is its own flow)

Preconditions: clean tree at the tip of `origin/spire/curvature-v2-foundations`, `npm ci`,
`npx playwright install chromium`, `npx nx build @convexa/dashboard --configuration=production`, port
4200 free (`npm run ports:free` is Windows-aware). Setting the environment variable: PowerShell
`$env:BROWSER_QUALITY_PREBUILD_STATUS='pass'; npm run browser:visual`; cmd
`set BROWSER_QUALITY_PREBUILD_STATUS=pass && npm run browser:visual`; bash/WSL as written below. With it
the gate serves `apps/dashboard/dist` (the production build, as CI does); without it the local gate
serves the Vite dev server, and baselines from the dev bundle are not the bytes CI compares. For the
linux flow use a **separate clone inside WSL2** — never share one working tree between Windows and WSL
during the flow (the untracked receipts and PNGs would collide, and only a process inside WSL reports
`platform: linux`). Every gate below is compare-only and retries 0; `run-gate.mjs` wipes
`apps/dashboard-e2e/test-output/playwright/visual/` at the start of each run, so copy `summary.json`
aside whenever you need it later.

1. **compare_failed** — `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:visual` → exit 1,
   `apps/dashboard-e2e/test-output/playwright/visual/summary.json` with `host_platform` win32|linux and
   six `failed` scenario records (pixel mismatch: `*-actual.png` + `*-diff.png` attachments and the
   stale baseline as `expected`).
2. **authorized** — inspect the six actual PNGs (and diffs) against `context/DESIGN_SYSTEM.md` and
   `design/site/*.html`; `preview-darwin-ecbb73e5/` shows the same compositions. Then
   `node …/visual_receipts.mjs authorize --summary apps/dashboard-e2e/test-output/playwright/visual/summary.json --id <platform>-curvature-v2-<rev7>-<yyyymmdd> --actor workspace-owner --role owner`.
   **Commit nothing yet.** The update command refuses any _tracked_ change since `source_revision`
   other than the receipt itself; untracked files are invisible to that check — this is exactly how
   the 2026-08-24 flow ran (`git diff --name-only` never lists untracked paths).
3. **candidates_written** — `npm run browser:visual:update -- --authorization apps/dashboard-e2e/visual-review/authorizations/<id>.json`
   → exactly six PNGs under `snapshots/<platform>/chromium/` and
   `visual-review/candidate-sets/<csid>.json`; it prints "generated candidates; not approved". One run
   per authorization (a second is refused: "already generated a candidate set").
4. **accepted | rejected** — inspect the six candidate PNGs and the diff; then
   `node …/visual_receipts.mjs accept --candidate-set apps/dashboard-e2e/visual-review/candidate-sets/<csid>.json --actor workspace-code-reviewer`
   (`--reject` stops the flow cleanly; a new authorization starts over).
5. **stability_clean** — still uncommitted: run `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:visual`
   **twice**, copying `summary.json` to `visual-review/evidence/<id>/stability-1.json` and
   `stability-2.json`; both must be `pass`, retries 0, same `source_revision` (HEAD — which is why
   nothing is committed before this point). Then
   `node …/visual_receipts.mjs stability --acceptance apps/dashboard-e2e/visual-review/acceptances/<csid>.json --summary <stability-1.json> --summary <stability-2.json>`
   → `[stability_clean]`.
6. **Commit once**, everything together: the six PNGs, `evidence/<id>/`, the authorization, the
   candidate set, the patch, the acceptance, the two stability summaries —
   `test(quality): accept <platform> visual baselines for Curvature Terminal v2 (<rev7>)`. Push.
7. Repeat on the other platform. For linux, open the PR afterwards and confirm CI's visual child
   passes on two runs.

## Findings while preparing (not fixed here — owner's call)

- **F-A — the hosted `browser-visual-linux-candidates.yml` path cannot complete as wired.** It checks
  out `inputs.source_revision` at `fetch-depth: 1`, then `visual-update.mjs`'s `assertSourceScope` runs
  `git diff --name-only <auth.source_revision>`: an ancestor revision is not fetched (fails "source
  revision cannot be inspected"), and a receipt cannot be committed inside the very commit it names.
  With a deeper fetch the evidence files committed after `source_revision` make the receipt "stale"
  (only the receipt may differ). And `validateStability` demands two clean compare summaries carrying
  the acceptance's `source_revision`, which CI stamps as HEAD — impossible once the accepted baselines
  are committed. The flow is a dirty-working-tree local procedure by construction; the hosted path
  needs a design change before it can ever run (it never has: the workflow has zero runs). Filed in
  `context/BACKLOG.md`, Harvest 2026-09-08.
- **F-B — `validateStability`'s image-hash check is vacuous on pass runs.** It compares
  `sha256 ?? actual_sha256` per scenario, both null when a compare passes (no actual attachment), so
  "unchanged image hashes" reduces to run id / status / revision / platform / retries.
- **F-C — what the preview shows the authorizer.** `ticker-desktop` (anonymous, 1280): the headline
  "SPY · $500.00" wraps onto two lines because the anonymous "Open simulated trade / Sign in" card and
  the two selects share the headline row since pass 2 (change 9) — a `/ticker` residual for the
  anonymous state, not a gate concern; `scanner-dense` (900, light): the header's right cluster wraps
  under the title and centres — cosmetic; both ticker scenarios read "Live offline — reconnecting…"
  by design of the visual frame (`freezeVisualFrame`'s +30 s clock jump trips the stream watchdog; the
  audit harness header records the same).
