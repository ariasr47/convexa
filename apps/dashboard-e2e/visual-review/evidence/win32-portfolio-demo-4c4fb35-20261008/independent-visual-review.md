# Independent Windows LIVE reference review

Decision: accept candidate set `68f647210293cad6724475d0a75932f4` for the six Windows Chromium reference images at source `4c4fb35814a79de16f0d069f34a4f4d7b7797cd5`.

Reviewer: `codex-independent-visual-review`, role `code_reviewer`, acting within delegated in-repository review authority. This is an agent review, not a claim that Rodrigo personally inspected the images.

## Images actually inspected

Viewed all six candidate PNGs in `apps/dashboard-e2e/src/quality/snapshots/win32/chromium/`. Also viewed every preserved expected and actual PNG in this evidence directory, plus both available diff PNGs: 20 image views total.

| Scenario | Observed viewport/theme | Preserved images viewed | Result |
| --- | --- | --- | --- |
| landing | 393x852, dark | `landing-expected.png`, `landing.png` | Byte-identical to prior reference |
| ticker-desktop | 1280x900, dark | `ticker-desktop-expected.png`, `ticker-desktop.png`, `ticker-desktop-diff.png` | Intended local tabs and 60px body displacement |
| ticker-offline-mobile | 393x852, light | `ticker-offline-mobile-expected.png`, `ticker-offline-mobile.png`, `ticker-offline-mobile-diff.png` | Intended local tabs and 60px body displacement; light theme retained |
| positions-dense | 393x852, dark | `positions-dense-expected.png`, `positions-dense.png` | Byte-identical to prior reference |
| scanner-dense | 900x900, dark | `scanner-dense-expected.png`, `scanner-dense.png` | Byte-identical to prior reference |
| ai-recommendation | 393x852, dark | `ai-recommendation-expected.png`, `ai-recommendation.png` | Byte-identical to prior reference |

The signed-in scanner and AI fixtures return the account setting `theme: 'dark'` (`src/quality/fixtures/scenarios.ts:218`), although their browser media preference is light. The table records the pixels actually observed and does not claim those references cover a light application theme.

## Visual and source findings

- No new visual defect found in these references. The ticker adds Overview, Technical analysis, and Research navigation. The mobile Research label continues beyond the viewport inside the intentionally scrollable tab strip; source uses `variant="scrollable"`, with a 44px minimum tab height.
- Both ticker headers remain pixel-identical to the prior references. Their genuine LIVE offline/reconnecting chip, last-trade value, structure labels, and sign-in state retain their content. The images show no DEMO provenance banner or Reset Demo control.
- Below the new tabs, a 60px vertical alignment comparison found one differing pixel among 947,200 compared desktop pixels (maximum channel delta 1), and 49 among 271,956 compared mobile pixels (maximum channel delta 3). Mobile differences are confined to rounded quick-ticker chip edges at y566-570; desktop difference is a rounded sign-in-panel edge. This is consistent with minor edge rasterization after translation and exposes no content/layout regression.
- The selected Overview tab uses `extrasFor(theme).textAmber`. Independently calculated light text `#8F5C0F` against canvas `#F6F6F3` gives contrast 5.2338742898:1. This is a check of the new tab text, not a whole-page accessibility verdict.
- Reviewed the visually relevant source-patch hunks: ticker navigation, routes, theme preference handling, LIVE/DEMO shell branches, stream/label handling, and quality evidence capture. Quality changes retain zero screenshot tolerance (`threshold`, `maxDiffPixels`, `maxDiffPixelRatio` all 0), no masks, and zero retries.
- Stored source patch is byte-identical to `git diff 8932fc1176543eff3fa826de6924e12ec52f3310 4c4fb35814a79de16f0d069f34a4f4d7b7797cd5 -- apps/dashboard/src apps/dashboard-e2e/src/quality`: 201,001 bytes, SHA-256 `f37efbc5c2d4845298c98db716fb0eccfe82a875403ea7e6a2b3aa13612a03da`. The patch covers 65 files; this receipt is not a general code-quality approval of all 65 files.
- All six candidate file hashes match both the candidate receipt and preserved actual evidence. Four also match the previous expected reference hashes. Authorization, candidate receipt, source patch, and all six images are SHA-bound by the acceptance JSON.

## Receipt validation and scope

Ran the existing read-only validator from repository root:

`node apps/dashboard-e2e/tools/validate-acceptance.mjs --acceptance apps/dashboard-e2e/visual-review/acceptances/68f647210293cad6724475d0a75932f4.json`

Native exit code: **0**. Output: `[acceptance-valid] 68f647210293cad6724475d0a75932f4 - externally authored decision verified` (dash normalized here).

Acceptance is limited to these six pinned LIVE reference images. It does not approve DEMO accessibility, the independently reported DEMO Reset Demo contrast issue, or the overall feature. It does not establish stability: the conductor must record two distinct clean compare-only runs separately. This reviewer changed only the acceptance JSON and this note; no application, test, baseline, build, or distribution artifact was changed by the reviewer.
