# Convexa browser quality gates

Tested browser engines: the Chromium, Firefox, and WebKit versions installed from Convexa's locked Playwright toolchain. Chromium runs the full end-to-end suite. Firefox and WebKit run the bounded compatibility journeys named in this repository. This policy does not claim coverage for every released Chrome, Edge, Firefox, or Safari version.

The retained full tier is the frozen 20-test Chromium inventory. Compatibility is five journeys × three pinned engines; accessibility is nine axe scans plus seven Chromium behavior sequences. The pixel visual-comparison gate was retired on 2026-10-08 (lean-tests batch 22), together with the layout-overflow suite; batch 36 retired four duplicate Chromium specs. Branded-browser, all-version, operating-system, real-device, responsive-as-device, and assistive-technology certification claims are intentionally declined. A locked Playwright upgrade is the explicit engine-version refresh and compatibility review event.

The Vite `es2022` setting is emitted-code intent only, never behavioral browser evidence. A future Browserslist declaration would also be build intent, never behavioral evidence.

Current hosted status: `[NOT RUN] hosted browser quality — hosted-runner evidence is unavailable. Local results do not count as hosted evidence.`

Commands:

```text
npm run browser:chromium
npm run browser:compat
npm run browser:a11y
npm run browser:quality
```

Artifacts are rooted at `apps/dashboard-e2e/test-output/playwright/{chromium,compatibility,accessibility}`. The retired visual gate's review evidence is kept, unchanged, in [visual review](visual-review/README.md).
