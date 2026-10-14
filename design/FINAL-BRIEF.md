# Brief: "Final · Convexa v1" canvas page — one screen group (2026-10-14)

Each agent fills ONE group module of a new canvas page that shows every screen of the Convexa web app in its
final, ruled state, with a spec card per screen. The owner asked for "a new page with the final version of the
app and every screen for a completely specced out web-app". Quality bar: a real product spec a frontend
engineer could build from, drawn in the existing design system.

## Where you work

- Worktree: `/Users/rodrigoarias/dev/convexa/.worktrees/design-final` (branch `design/final`). Design source:
  `design/src/`. Read `design/README.md` first.
- **Write only your own files**: `design/src/screens/final/<group>.mjs` and, if you need them, new helper
  modules named `design/src/screens/final/<group>-*.mjs`. Do NOT edit any other file (not lib.mjs, not
  components/, not v4/ or v5/ screens, not index.mjs, not canvas.config.mjs, not spec.mjs, not this brief).
  Other agents are writing the sibling group modules at the same time. If a shared file truly needs a change,
  write it up in your final report instead.
- Do NOT run `node design/src/build.mjs` (it rewrites shared outputs other agents depend on). Do NOT commit,
  push, stash, or run git commands that change state. Read-only git is fine.
- Check your work with: `node /Users/rodrigoarias/dev/convexa/tmp/final-render.mjs <group> --shots`
  (run from anywhere). It renders each board standalone into `/Users/rodrigoarias/dev/convexa/tmp/final-render/<group>/`,
  prints its natural height, horizontal overflow and any visible text under 11px, and exits 1 on any failure.
  Look at the .jpg screenshots with the Read tool. Iterate until it exits 0 and the boards look right. Then copy
  the printed heights into each board's `h` (the page uses them for frame sizes; max 8000 — split a board that
  would be taller).

## The row shape (see design/src/screens/final/index.mjs and spec.mjs, and foundations.mjs as the example)

```js
export const ROWS = [{
  key: 'landing', label: 'Landing', css: '', specH: 1800,
  spec: { title, route, job, env: { production, staging }, widgets: [...], states: [...], phone, acceptance: [...],
          built: [{ status: 'shipped'|'partial'|'todo', what }], rulings: [...], code: [...] },
  boards: [{ id: 'staging', title: 'Staging · demo account', w: 1440, h: 3000, body: (o) => html, opts: {} }, ...],
}];
```
`body(o)` gets `{ minHeight, scheme? }` merged with `opts` (use `opts: { scheme: 'light' }` for light boards).
Board ids become file names (`F<Key><Id>`), so keep them short: `staging`, `production`, `phone`, `light`,
`states`, `staging-phone`, etc. Spec-card state tags take keys: current, delayed, stale, loading, empty, error,
unavailable, notConfigured, off, paused, notLive, sample, demo, locked, computed, thirdParty, local — or
`[key, 'custom word']`, a list of those, or plain text. Set `specH` to the spec card's measured height.

## Boards per screen row (in this order; skip any that would be identical to another)

1. spec card (from `spec`, rendered for you)
2. **Staging · demo account** — 1440 dark. The whole app is sample data, signed in to the seed demo account:
   `v4Page({ demo: true, ... })` in lib.mjs gives the demo bar ("Demo · sample data … Signed in as the demo
   account · Reset demo data") and the nav's "Demo account" avatar. No sign-in walls, and no "Sign in"/"Log in"/
   "Sign up" anywhere. Every source chip dashed ("shaped like …").
3. **Production** — 1440 dark, when it differs. `v4Page({ notice: 'hybrid' })` (the default) gives the
   "Options data isn't live on this site" bar and a signed-out nav. NOTHING is mocked in production: no Sample
   tags, no sample tables or charts. Anything needing the Massive options feed (dealer gamma/structure, walls,
   flip, flow, tape, scores, scanner, AI reads, option prices/greeks, IV) shows its **Not live** state: what it
   would show, why it's off, and a link "See it on the demo →" to the same screen on staging (`STAGING_DEMO_URL`,
   see how lib.mjs gets it). Everything that works without Massive is LIVE: Treasury yields, CFTC positioning,
   FINRA short interest / short-sale volume, SEC EDGAR filings (shows "Not set up" until the operator sets
   SEC_USER_AGENT), research notes (real), TradingView's daily chart (third party, dotted frame), and anything
   computed from those. Visitors are signed out; sign-ups are closed (account-only screens show the
   private-testing wall with "Sign in").
4. **Phone** — 390, production (the portfolio site). Add a staging phone only if it differs materially.
5. **Light** — 1440, production, `scheme: 'light'`.
6. **States** — 1440: every state of the screen, each labelled with its P-2 word and when it happens (reuse
   `statesBoard` from `screens/v4/kit.mjs`).

## Rulings the boards must carry (binding; canon: `/Users/rodrigoarias/dev/convexa/.spire/clusters/tech/context/DESIGN_SYSTEM.md`, Amendments rows dated 2026-10-13 and 2026-10-14)

- P-1 "Not live" for Massive-dependent widgets; an "On this page" legend counting each state on mixed pages.
- P-2 closed vocabulary: Updated, Delayed by source, Computed, Last good copy, Source down, Couldn't load, Not set
  up, Off, Paused, Not live, Sample, Demo · sample data, Sign in, Live · TradingView. Word + glyph; failures add
  burnt orange; none uses green/red.
- P-3 sample inside a live page: dashed frame, hatch stripe, Sample tag, scenario date (now only staging uses sample).
- P-4 build status appears on design boards only (the spec card's "Built so far"), never inside a product board.
- P-5 rejected: a ticker's price change stays green/red text with ▲/▼.
- P-6 the selected quick symbol: outline + weight, not amber.
- P-8 a chart frame's border is its provenance: solid (ours/primary source), dotted (third party), dashed+hatch (sample).
- P-9 charts neutral and ordinal: phosphor for the claim's series, steel then chartContext2 for context, chartBand
  wash for ranges; no categorical palette on trader screens; more than 3 series → small multiples.
- P-10 a chart title states its finding only with data; loading/empty/error/not-live frames name the metric.
- P-11 sign never by hue alone (gamma included): zero line/position or +/− text as well.
- P-12 chart tweens ≤ 600 ms allowed (not a motion moment).
- P-13 11px floor for all text including chart text in SVG/canvas.
- P-14 TradingView loads on view (no click-to-load facade); its privacy line stays.
- P-15 the landing hero may be the WebGL dealer-gamma surface (F1); boards draw its static projection (the
  designed fallback); production labels it "Illustrative sample".
- Amber is spent (focus ring, base-case diamond, primary button); amber as TEXT uses the text-grade amber.
- 2026-10-14 environments: production = no mocks; staging = always signed in to the seed demo account (no
  sign-out; "Reset demo data" instead); the Lab in production shows Not live with a link to the demo; the
  landing illustrations stay in production, labelled "Illustrative sample".

Charts: use the v5 chart system (`design/src/chart-kit.mjs`, `design/src/components/charts.mjs`,
`components/tradingview.mjs`). The "after" forms on the v5 family boards (`screens/v5/families-*.mjs`,
`screens/v5/system.mjs`) are the ruled designs. Reuse renderers from `screens/v4/*` and `screens/v5/*` wherever
they already draw the screen; compose or adapt in your own module where they don't (e.g. a v4 page that still
shows sample data where production must show Not live, or a "Demo visitor" left over).

## The spec card: ground it in the real app

Read the shipped app (read-only) at `/Users/rodrigoarias/dev/convexa/apps/dashboard/src/app/` (routes in
`app.tsx`; pages under `pages/`, features under `features/`; data-state words in `shared/dataState/`), the demo
transport in `/Users/rodrigoarias/dev/convexa/libs/api/src/lib/demo/`, and the public-data API in
`/Users/rodrigoarias/dev/convexa/apps/api/src/routes/public_data.rs`. The spec must say what the screen is for,
every widget with its real data source and delay, what production and staging each show, every state, the phone
layout, acceptance checks a QA engineer could observe, what is shipped vs partly built vs designed-not-built
(be honest; check the code), the rulings it carries, and the code paths. Record gaps between the shipped app and
the final design under "Built so far".

## Copy rules

Plain, specific, active voice; name things the way users recognize them. No buy/sell language and no investment
advice. Sample values only on staging boards; production boards show plausible public data (Treasury, CFTC,
FINRA, SEC) with sources and dates, and Not live for the rest. No NUL bytes in files.

## Report back (under 300 words)

Rows and boards you made (with final heights), the render tool's last exit code, any shared-file change you
need (exact), and gaps between the shipped app and the final design that the owner should know about.
