# Independent Linux candidate review

Decision: accept candidate set `44894ccd5fa8e8e986c66bd3e6c4841d` for the six Linux Chromium LIVE reference scenarios at source `219d73a67b6f7a284172afaa3fc24b1b850e3319` (S). Reviewer: `codex-independent-linux-visual-review`, role `code_reviewer`. This is an AI reviewer decision under the delegated review lane, not a claim of human approval.

## Scope and provenance

- Genuine failed comparison `95586514-fb3a-4693-bb2e-aec846394856`: 6 executed, 4 passed, 2 failed, 0 flaky. The existing authorization and all failed-compare files remain unchanged.
- [Hosted workflow 37735626254](https://github.com/ariasr47/convexa/actions/runs/37735626254), candidate job `113174367136`, succeeded. Dispatch/authorization ref A is `7d513d616e0d2c57a45e6e7cb4769c6b28aadc37`; `git log` confirms A is a direct child of S, and `git diff --name-only S A` contains only the authorization and its evidence.
- The workflow checks out S and restores only hash-bound authorization/evidence from A. Its build and comparison environment selects `VITE_DATA_MODE=live`. The candidate receipt and both raw summaries identify S, not A.
- GitHub artifact `11531258971`, `browser-visual-linux-candidates.zip`: independently rehashed locally as `c4957ba899b23260ebc596a0db31970df2b7a8d20094de97fc121cab1715bfb1`.
- Six existing Linux references were clean in `git status` before installation and each matched the authorization's expected SHA-256. All six selected candidate files matched both the downloaded receipt and the failed-compare actual hash. `installation-provenance.json` records every prior/candidate hash. Only two PNG byte sequences changed.
- The exact downloaded candidate receipt was copied unchanged. Both raw stability summaries and their attachment directories were copied unchanged to `stability-1/` and `stability-2/`; originals were hash-checked against the copies.

## Image inspection

The reviewer opened all 6 candidate PNGs, all 6 expected PNGs, all 6 failed-comparison actual PNGs, and both diff PNGs using the image viewer. Inspection covers only these captured viewports and states; no new application, browser, or build run was performed in this reviewer lane.

| Scenario | Captured size | Observed result |
| --- | --- | --- |
| landing | 393 x 852 | Dark landing page; readable headline, actions, navigation and surface-card start. Candidate, actual and expected are identical. |
| ticker-desktop | 1280 x 900 | Dark SPY overview with visible offline/reconnecting state, last-known $500 value, signed-out simulated-trade prompt, filters and structure card. Overview / Technical analysis / Research tabs add one 44px row plus 16px margin, shifting the existing content down 60px. The bottom of the structure card consequently falls below this viewport crop. |
| ticker-offline-mobile | 393 x 852 | Light SPY overview with offline state and the same 60px shift. Overview and Technical analysis fit; Research is partly outside the horizontal tab viewport. The source explicitly uses scrollable tabs. No overlap with the status chip, headline, sign-in prompt, filters or card is visible. Gesture/keyboard operation of the off-screen tab is not asserted by this screenshot review. |
| positions-dense | 393 x 852 | Dark signed-in positions view with retained/offline P&L, capital-at-risk card and simulated-order controls. Candidate, actual and expected are identical. |
| scanner-dense | 900 x 900 | Dark rendered scanner view, despite the manifest's light media preference; the signed-in fixture supplies its own preferences. Offline/last-known rows and stale sweep notice remain visible. Candidate, actual and expected are identical, including the existing horizontal table crop and old fixture timestamps. |
| ai-recommendation | 393 x 852 | Dark rendered Full analysis & data drawer, despite the manifest's light media preference. Existing summary, levels, source/grounding explanation and close action remain visible. Candidate, actual and expected are identical. |

The two diff images agree with the inserted tab row and the vertical displacement. No unrelated color, text, data, navigation, control, or overlay change was identified in the two changed frames. The four identical hashes establish that those frames were not silently replaced with different renderings. Existing cropped viewport content and the fixture's stale dates are not represented as new regressions.

## Source review and limits

The source patch is the raw stdout of `git diff --no-ext-diff --no-textconv --binary --full-index 8932fc1176543eff3fa826de6924e12ec52f3310 219d73a67b6f7a284172afaa3fc24b1b850e3319 -- apps/dashboard libs/api apps/dashboard-e2e :(exclude)apps/dashboard-e2e/visual-review/** :(exclude)apps/dashboard-e2e/src/quality/snapshots/**`.

It contains 422,050 bytes; SHA-256 `16a9d640de6320d847dc3d20264c096f49ea0c8c5ee10c1924813ea853d10c7b`. It includes dashboard Vite configuration, application/API code, and e2e harness changes, while excluding historical receipts/images. It cannot contain worktree-only AccessibleHelp, e2e, reporter or TLS changes because both endpoints are explicit immutable Git revisions.

The review traced the image-affecting source and its immediate dependencies: `TickerDashboard` tab insertion (patch section at line 3276); its route targets and unavailable LIVE-provider result; `useTickerPageModel` and sample-only provenance; first-paint theme storage, build bootstrap and mode selection; shell/auth LIVE-vs-DEMO branches; ticker structure and AI presentation; scanner stream behavior; strict fixture, screenshot assertions and reporter attachment preservation. The 44px minimum tab height and `mb: 2` account for the measured image shift. URLs encode the ticker, and the visible new labels do not rename existing numeric values. DEMO-only presentation branches are guarded by selected mode/provenance and are not what these LIVE fixtures show.

The pinned visual spec still enforces retries 0, threshold 0, maxDiffPixels 0 and maxDiffPixelRatio 0, and uses no masks. Its extra actual-image attachment preserves visible evidence; screenshot comparison remains present. The pinned fixture deliberately freezes the stream, asserts the ticker offline state and rejects unexpected network traffic. The Vite bootstrap selects the build mode before the application graph starts. No blocking finding was identified for accepting these six candidate images and their evidence bindings.

This is not a comprehensive approval of all source in the patch, the Technical analysis or Research rendered pages, DEMO interactions, accessibility, other browsers, unpictured states, later worktree fixes, or the overall release. Those claims need their own evidence. No application source, masks, tolerances or test expectations were changed by this reviewer.

## Receipt checks

Acceptance and stability checks are recorded in `validation.json` and `stability.json`. Stability requires the accepted six scenario-ID/hash pairs to equal each raw run's actual and expected hashes, every preserved attachment to match its raw-summary hash, 6/6 passed with retry 0, and distinct run IDs. Canonical sorting by scenario ID is supplied only to `validateStability`; the raw summaries are not edited.

The first supplemental stability check stopped on the Windows manifest's CRLF byte hash. Exact `git show S:apps/dashboard-e2e/src/quality/manifest.json` bytes hash to the candidate's `5686f47c2066be1d621153c85df6c3301872ad7145c3e4a48090bfb5e239a2bc`; the local file differs only by 1,489 CRLF endings and has identical parsed content. The check was corrected to verify the source blob; neither manifest nor candidate receipt was rewritten.
