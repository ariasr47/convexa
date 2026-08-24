# Convexa browser quality gates

Tested browser engines: the Chromium, Firefox, and WebKit versions installed from Convexa's locked Playwright toolchain. Chromium runs the full end-to-end suite. Firefox and WebKit run the bounded compatibility journeys named in this repository. This policy does not claim coverage for every released Chrome, Edge, Firefox, or Safari version.

The retained full tier is the frozen 52-test Chromium inventory. Compatibility is five journeys × three pinned engines; accessibility is nine axe scans plus seven Chromium behavior sequences; visual comparison is six current-platform Chromium scenarios. Branded-browser, all-version, operating-system, real-device, responsive-as-device, and assistive-technology certification claims are intentionally declined. A locked Playwright upgrade is the explicit engine-version refresh and compatibility/baseline review event.

The Vite `es2022` setting is emitted-code intent only, never behavioral browser evidence. A future Browserslist declaration would also be build intent, never behavioral evidence.

Current hosted status: `[NOT RUN] hosted browser quality — hosted-runner evidence is unavailable. Local results do not count as hosted evidence.`

Commands:

```text
npm run browser:chromium
npm run browser:compat
npm run browser:a11y
npm run browser:visual
npm run browser:visual:update -- --authorization {receipt_path}
npm run browser:quality
```

Artifacts are rooted at `apps/dashboard-e2e/test-output/playwright/{chromium,compatibility,accessibility,visual}`. Visual authority and candidate policy are documented in [visual review](visual-review/README.md).
