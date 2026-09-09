# PR #46 CI repair — task (written 2026-09-09 by the conductor; branch `spire/curvature-v2-foundations`)

PR: https://github.com/ariasr47/convexa/pull/46 (phases 1–3 → `main`). First CI run `34304816896` on head `11307915`:
backend and capacity jobs green; **frontend job red in the browser-quality gate (accessibility + visual children)**;
**supply-chain policy job red**. The four causes below are independent. None is the linux-baseline font risk we were
watching for in the way we expected: the visual diffs are symbol glyphs only.

**Order of work (one lane, one branch, then ONE baseline re-take per platform):** A → B → C → D → re-take win32 + linux
baselines through the receipt flow (both change again: A and B change pixels on every page) → push → CI green twice.

## A. Accessibility child — 7 of 9 scans fail on ONE rule, `color-contrast` (serious)

Reproduced locally (`BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:a11y` → exit 1; a temporary probe printed the
violations the gate's summary does not carry — see E). The gate had **never run on this branch** (no phase QA report
mentions it; the aggregate runs only in CI on `main` pushes and PRs). Offenders, measured:

| where | element | colours (fg on bg) | ratio | size | fix principle |
| --- | --- | --- | --- | --- | --- |
| **every page** (`/`, `/settings`, `/ticker/SPY`, light `/`) | the `⌘K` kbd hint, `shell/TopNav.tsx:246` `color: 'text.disabled'` | dark `#4c5768` on `#0d121b`; light `#959592` on `#f1f1ec` | **2.56 / 2.65** | 11px | `text.disabled` is for disabled controls only; the hint is informative text → `text.secondary` (steel `#8A9BB4` on ink ≈ 5.7:1) or drop the colour and keep the bordered kbd |
| desk | dimmed captions: `chrome/TickerHeader.tsx:186` `color: 'text.secondary', opacity: 0.5` ("Structure as-of …" line) | `#4b5566` / `#434c5c` on `#0b0f17` | **2.54 / 2.21** | 12–13px | **never dim text by opacity**; dim to a contrast-safe token (a new `text.dim` pair ≥ 4.5:1 on ink and on paper); the pause mark stays the non-colour cue (canon F4/F5) |
| desk | `chrome/TapePulseStrip.tsx:311` paused `Mid` value `opacity: 0.5` | same class | same | 13px | same token |
| desk | `structure-hero/StructureHeroPanel.tsx:107-109` 11px `info.main` legend text | `#547caf` on `#17202f` | **3.79** | 11px | `info.main` is a fill/dot grade; small text needs a text-grade blue (the canon's two-amber-grades precedent: `extrasFor(theme).textAmber`) — add `textInfo` or render the legend in `text.secondary` |
| desk | `_kit/FigureCell.tsx:412` 11px `info.main` (same class) | same | same | 11px | same |
| scanner | `cell-price` in `data-figure-state="offline-retained"` (`shared/figure/figureState.ts:128-131` `dim: true`) | `#7e7f7d` on `#131a24` | **4.34** | 17.6px normal | a hair under 4.5 (17.6px normal is not "large"); nudge the dim token to ≥ 4.5:1 |

Canon: `DESIGN_SYSTEM.md` already demands ≥ 4.5:1 for text (Two amber grades, stage-3 GATE Z focus ring) — a
contrast-safe dim is consistent with canon; record the token pair as an **Amendments** row, not a new system.
Verify: `npm run browser:a11y` green with `a11y-waivers.json` still `[]` (no waivers).

## B. Visual child — 4 of 6 differ on the linux runner, glyphs only

Diffs (run artifact `browser-quality-visual`): landing `→` arrows in the spine and CTAs; ticker-desktop the `⌘K` chip
glyph; scanner `γ` (Pos γ), `≥`, `≤`; positions the segmented control and `▾`. Cause: `apps/dashboard/src/styles.css`
bundles **Latin-only** subsets (`*-latin-*.woff2`) of IBM Plex Sans/Mono and Archivo; every glyph outside Latin falls
back to the host's system font (`system-ui, 'Segoe UI', Roboto` / `ui-monospace, Menlo, Consolas`), which differs
between the Playwright image, the GitHub runner, Windows and macOS. Fix at the source, deterministic everywhere:
bundle the glyphs the app uses — the `greek`, `latin-ext` and math/arrow ranges of Plex Sans/Mono (fontsource ships
`greek`; arrows/≥/≤ need a `pyftsubset` of the full Plex or the `math` subset), and for `⌘`/`⊞`/`▾` either a tiny
symbol subset (Noto Sans Symbols 2, OFL) or the canon's stroke icons (`DESIGN_SYSTEM.md` Icons row: inline SVG on a 24
grid — `▾` and the arrows are icon shapes; `⌘K` can stay text if its glyph is bundled). Verify with fontkit
(`hasGlyphForCodePoint`) for U+2192 U+2265 U+2264 U+03B3 U+2318 U+25BE against the bundled files, then both baseline
flows, then the PR's visual child green twice.

## C. Supply-chain policy job

- **`npm_advisories` FAIL, 7 findings, all `fixAvailable`:** `vitest`/`@vitest/coverage-v8`/`@vitest/ui`/`@vitest/mocker`
  4.1.10 (moderate: mocker path traversal), `js-yaml` 4.3.1 and `@redocly/openapi-core` 1.34.19 (high), `svgo` 3.3.4
  (high). `npm audit fix --dry-run` shows patch-level bumps (e.g. `svgo 3.3.4 => 3.3.5`). Apply, run the unit suite
  alone (exit code, not totals), commit `chore(deps)`. The exception registry forbids security exceptions
  (`tools/supply-chain/policy/exceptions.mjs` `security-exception-prohibited`), so upgrades are the only path.
- **`repository_secrets` FAIL, 8 gitleaks findings** — `policy.mjs:124` scans the PR's own commit range
  (`gitleaksLogOptions(event, revision, base)`), so the eight are branch-introduced: **five** `sourcegraph-access-token`
  matches inside the base85 binary patch `apps/dashboard-e2e/visual-review/diffs/e2a1eea5690ec3f68ac293c384ec5f39.patch`
  (random base85 that happens to match `sgp_…`), **three** `generic-api-key` matches in
  `contracts/curvature-v2-foundations/council/{R2-ux.md,R3-ux.md,conflicts.json}` (prose quoting a localStorage key
  name). All false positives. Fix: a root `.gitleaks.toml` (gitleaks auto-loads it from `--source`) with a **path**
  allowlist for `apps/dashboard-e2e/visual-review/diffs/.*\.patch$` and a **regex** allowlist for the localStorage-key
  prose pattern — never a blanket allowlist on `.spire/**` (a real key pasted into a doc must still fire).
- **Historical, not branch-scoped — owner's action:** a full-history scan finds `apps/api/.env` with `MASSIVE_API_KEY=…`
  in the initial commit `1aac13ec` (2026-06-18), deleted in the next commit `fc9c8d28` but present in history on GitHub
  forever. **Rotate the key if it was not rotated then.** History rewrite is not recommended (the repo has worktrees on
  three machines); rotation is sufficient. The other 36 full-history hits are localStorage key names and test fixtures.

## D. Evidence gaps found while diagnosing (file in BACKLOG)

- **F-H — the accessibility gate's summary carries `findings: []` even when scans fail.** `accessibility.spec.ts:41`
  attaches `axe-findings.json` as a body attachment; the quality reporter copies only path attachments, and its
  `findings` aggregation never reads them. A red gate whose evidence names no rule is the "gates that do not gate"
  class (Harvest 2026-09-05). Fix: attach with a `path`, or have the reporter parse the body attachment into
  `summary.findings`.
- The `browser:quality` aggregate runs only in CI (`main` pushes and PRs); `npm run ci` is lint → typecheck → test →
  build. Three redesign phases shipped "QA PASS" without the accessibility, compatibility or visual gates ever
  running. Either add the aggregate to `npm run ci` behind the prebuilt `dist`, or make GATE Q's checklist name the
  four browser gates explicitly.

## E. How the offenders were found (for the next person)

The gate prints only `A11Y-n has blocking axe findings`. A throwaway spec (deleted, never committed) mirrored
`accessibility.spec.ts`'s scan step for every scenario and printed `results.violations` filtered to serious/critical
with rule, impact, help and the first three targets — the table in §A. Reproduce the same way, or fix F-H first.

## Outcome (2026-09-09, the conductor, same session)

| section | state | where |
| --- | --- | --- |
| A contrast | **done** — solid `extras.textDim`/`extras.textInfo`, opacity dims removed, `a11y-waivers.json` still `[]`, local `browser:a11y` 9/9 | `b7425507` |
| B fonts | **done** — greek/latin-ext/symbol subsets bundled, `⌘`/`▾` → MUI icons, cmap-coverage spec; plus `--disable-lcd-text` after five linux runs disagreed on five subpixel-AA pixels | `ad858c83`, `be00d739` |
| C advisories | **5 of 7 closed**; the two `js-yaml` highs under `@redocly/openapi-core` cannot close (openapi-core needs `types.merge`, gone in js-yaml 5) → scoped nested override; policy job stays red on exactly these two — owner decision (BACKLOG F-J) | `bec49028`, `1d6f6b42` |
| C gitleaks | **done** — `.gitleaks.toml` path allowlist for the binary evidence patches, regex allowlist for localStorage-key prose; CI's `repository_secrets` green on run 2 (policy report `finding_count: 0`) | `bec49028` |
| C licenses (new on run 2) | **done** — `npm_licenses` failed with 1062 findings because every baseline row carries the npm lock's hash, so the advisory fixes' lock change fanned out to all rows (precedent: `331d030d`). Regenerated: 11 rows out (vitest 4.1.10 set, svgo 3.3.4), 12 in (their fixes + js-yaml 5.4.1), all MIT, 0 new expressions, 0 obligations; local `checkLicenseBaseline` → `license-continuity-pass`. The generator hashed `Cargo.lock` raw, so a CRLF checkout churned all 286 cargo rows — now CRLF-normalised like the npm lock | see RESUME |
| C historical key | **owner's action** — rotate `MASSIVE_API_KEY` if not rotated on 2026-06-18 | — |
| D evidence gaps | **filed** as BACKLOG F-G (gates never ran) and F-H (`findings: []`); not fixed | BACKLOG |
| baselines | **re-taken twice** on both platforms (A+B changed pixels; then grayscale AA changed them again); final at `be00d739` | `b1c898df`, `6f9807b7`, `27eb19e2` |

Second CI run: `34323995666` on `27eb19e2` — its verdict is in RESUME's top block, not here.
