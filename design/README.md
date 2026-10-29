# Convexa design — Curvature Terminal v2

**Binding design rules live in `.spire/clusters/tech/context/DESIGN_SYSTEM.md`; runtime token values live only in `apps/dashboard/src/app/shared/theme/tokens.ts`.** This folder is the design *source* that the canon points to — the working form of the direction, never a second rulebook.

The design is code, not drawings. One token file, a set of component modules that render themselves
and declare their states, screen modules that compose those components over sample data, and a
registry that says which screens render at which widths. A build regenerates everything else: the
Claude Design canvas, the static site, the library page, `tokens.css` and `tokens.json`.

**The canvas, "Convexa Desk Redesign": https://claude.ai/artifact/3ooV24ayHwh52t3qAhFiBe** — one file per board (`project/<Name>.dc.html` + `project/canvas.json`), published by `node design/src/emit-project.mjs <out>` once the build is committed.
Since 2026-10-25 it holds only the current, ruled design; since 2026-10-28 it has 13 pages by app area: **Start here** (the board map, which is the entry board `Main`, the screen tracker, the version card and the guide); the app in its navigation order, **Scanner**, **Ticker desk**, **Research** and **Positions & alerts**; the pages around it, **Settings & operator**, **Dialogs & overlays**, **Public site** and **Shell & foundations** (with the library); **Planned · Trade journal**, **Planned · Public-data tools** and **Prototypes · not ruled**; and **Changelog**. Each page opens with a header note that names it and the version. Which row sits on which page: `PAGE_ROWS` in `src/screens/final/index.mjs`; the build fails on a row with no page or two, and on a row whose spec card says Built on a planned page.
**Versions:** the canvas states Convexa's one version, the root `package.json` "version" (1.0.0 is the first release). Each built row's title and spec card name the release it first shipped in ("since Convexa 1.0.0"), set once in `SHIPPED_IN` (`src/screens/final/tracker-data.mjs`); the board map and the tracker show it as Since. The build fails when a row on a built page has no entry, a planned row has one, or an entry is a prerelease, before 1.0.0 or after `package.json`. The Changelog page lists every `CHANGELOG.md` entry as the design changes up to a version, from the `v*` tags. `emit-project.mjs` stamps the version card in the published index only: the version, the release status from the tags, the commit and its date, and the commits not yet on origin/main.
The earlier rounds (v2 pages, v4 and v5 pages, the Q-5 page, Directions B and C) are off the canvas; their screen modules still build the static site, and git keeps the boards (`git show af9822f8:design/canvas/canvas.json`). The old single-page v2–v4 canvas https://claude.ai/code/artifact/82be651e-c9a1-4ad4-a672-886626f8cf73 now points here; its last full version is `canvas/convexa-desk-redesign.html`. The research canvas https://claude.ai/artifact/HxZArSCsbrjQCx8VBbYRw7 stays as history.

```
design/
  tokens/tokens.json      ← the design-side token mirror (verified against tokens.ts); colour, type, radius, spacing, z, breakpoints, motion
  src/
    lib.mjs               ← token CSS (generated from tokens.json), icons, wordmark, nav, footer, charts
    components/           ← one module per primitive: render(props) + states[] + spec (React mapping)
    screens/              ← one module per surface, composing components over data
    data/index.mjs        ← every sample number and string; change data here, not in screens
    canvas.config.mjs     ← which screens become artboards, at which widths, on which canvas page
    build.mjs             ← writes canvas/ and site/
    boards.mjs            ← renders one artboard's file (build.mjs and emit-project.mjs both use it)
    emit-project.mjs      ← renders every board from source as the files-based canvas's project/ folder, stamps the version card, + publish batches
    verify-tokens.mjs     ← checks tokens.json against apps/dashboard tokens.ts; lists the additions
    seed.sh               ← seeds the canvas file from the artboards (needs the Claude Design helper)
  canvas/                 ← generated: *.dc.html artboards, canvas.json, convexa-desk-redesign.html (self-contained viewer)
  site/                   ← generated: one static page per screen, index.html, library.html, tokens.css, tokens.json
  CHANGELOG.md            ← append-only design decisions (supersede, never rewrite)
```

## How the app follows the design

- **Tokens.** `tokens.ts` stays the runtime authority. `tokens/tokens.json` mirrors `apps/dashboard/src/app/shared/theme/tokens.ts` for every
  value that exists there, and lists the redesign's additions under `additions`. `node
  design/src/verify-tokens.mjs` fails when the two drift. `site/tokens.css` is generated from the same file.
- **Components.** Every module in `src/components/` carries a `spec` with the React component it maps
  to, the file it lives in, and what changes. The library page (`site/library.html`) renders the
  states from those specs, so the app's component catalog and the design's cannot describe different things.
- **Screens.** `site/desk.html` runs the same state machine as the canvas artboard (read state, liveness,
  scheme, phone sheet). Resize it: the layout is the layout the app should ship.

## How to ask for changes without redesigning

| You want | Touch | Then |
| --- | --- | --- |
| Different numbers, names, copy | `src/data/index.mjs` (or the screen's own prose) | `node design/src/build.mjs` |
| A new state on an existing component | the component's `states` array | build; it appears in the library |
| A new component | a module in `src/components/` registered in `components/index.mjs` | build |
| A new widget on the desk | compose it in `screens/desk.mjs` from components | build |
| A new screen | a module in `src/screens/`, one line in `screens/index.mjs`, one line per width in `canvas.config.mjs` | build |
| Another width or a light render of a screen | one line in `canvas.config.mjs` | build |
| A colour, radius, breakpoint | `tokens/tokens.json` | build; then `verify-tokens.mjs` tells you what to change in `tokens.ts` |

After the build is committed, `node design/src/emit-project.mjs <out>` renders every board again from the committed
source into `<out>/project/` (the index and one file per board; the Changelog board reads the release tags present
then) and writes `<out>/batches.json`; publishing those files to the canvas URL above updates the editable canvas. It
refuses (exit 1) while `design/` or `package.json` has uncommitted changes, and it lists any board whose render differs
from the committed `canvas/`: a stale build to rebuild and commit, or the Changelog board after a release tag. The v4
single-file viewer `canvas/convexa-desk-redesign.html` (made by `seed.sh`) is frozen at v4 and no longer regenerated.
`canvas/` and `site/` are generated: do not hand-edit them.

**When you append to `CHANGELOG.md`** (every design commit does), the Changelog board grows by a line or two, so
re-measure it in the same commit: `node tmp/journal-boards/heights.mjs --only '^FChangelogEntries$' --write`, then set
`"FChangelogEntries.entries"` in `src/screens/final/heights.json` to the new number of entries, and build again. The
build fails while that count differs from the file's, rather than cut the oldest entries off. (`heights.mjs` is a
gitignored tool in the main tree's `tmp/`: it renders each Final board at its width and writes its natural height + 20.)

## What the design is

Kept: the Curvature Terminal identity (ink, one amber, phosphor, steel, signal for live, burnt
orange + icon for warnings, green/red for direction only; Archivo + IBM Plex Sans + Mono; the arc
budget of three; one orchestrated motion moment; the honesty rules including the type register).
Changed: the ticker layout (masthead → structure field hero with ladder, tape and structure path →
read strip → wide AI brief beside tape / position / orders → quiet context band), the AI read
(verdict-first, nine states), figure cells for accent-bar tiles, a ⌘K palette in the nav, gated
liveness, a 3D dealer-gamma landing hero, six breakpoints and container queries. Sample values only.

## v4 (2026-10-13): the hybrid site

Five canvas pages extend v2 without changing its boards' layouts: **v4 · Data states** (the fourteen-
state vocabulary, the state matrix, the source map, the hybrid NVDA desk), **v4 · Tools from public
data** (the roadmap from docs/public-data/CANDIDATES.md and one sheet per priority tool), **v4 · App**
(every route at 1440, 390 and light, with a states board), **v4 · Research** (the note view with
neutral directions, the index, phone and light research boards) and **v4 · Coverage**. Sources:
`src/components/data-states.mjs`, `src/components/tools.mjs`, `src/data/{states,hybrid,tools}.mjs`,
`src/screens/v4/*`. Findings and canon proposals: `REVIEW-2026-10-13.md`.

