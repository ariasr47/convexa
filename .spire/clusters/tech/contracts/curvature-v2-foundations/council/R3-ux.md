# R3 — ux reconcile: curvature-v2-foundations

> Filter applied to `council/conflicts.json`: `kind == "technical"` AND `self_revision != true` AND
> (`raised_by == "ux"` OR `source == "ux"`) → **10 entries**, below in that order. Product conflicts and
> the three already-folded self-revisions are untouched. Canon `DESIGN_SYSTEM.md` **Status: SET —
> Curvature Terminal v2**; my lane is subordinate to it, so where a canon rule number settles a
> conflict I cite the rule and stop.

---

## 1. architect → ux — "`FigureCell` lands **in place** at every existing `StatTile` call site (`LiveTape` 4 cells, `DealerPositioning` 11–12, `IvRank`, `MarketContext`, `StraddleMove`, `DealerFlowProjection`)."

**Verdict:** conceded

**Evidence:** Two importers only (`LiveTape.tsx:35`, `DealerPositioning.tsx:25`) — settled, and I withdrew
the sentence in R2. What I need to correct now is my own R2 over-claim that the four look-alikes "carry
no register, no live slot": that is also false at source. All four are **declared static** and render
their figures in **mono by hand** — `IvRank.tsx:66-69` ("NO live/offline prop is accepted"),
`MarketContext.tsx:9-10` ("STATIC. It takes NO `offline`/`isLive`/`streamOffline` prop"),
`StraddleMove.tsx:3` ("takes NO `offline`/`isLive` prop"), plus `IvRank.tsx:64`, `MarketContext.tsx:113`,
`StraddleMove.tsx:32` all binding `typographyTokens.monoFontFamily`. So for those four the register is
already mono-correct and the liveness read is already correct **by absence** (a static figure's right
render is no dot — my F1). The gap is narrower and entirely structural: (i) nothing red-builds if a
later edit puts a not-a-number literal in the mono face there; (ii) their figures do not step
20 → 17 → 15 at the container thresholds; (iii) their ⓘ is a bare non-focusable `InfoOutlinedIcon`
inside a hover `Tooltip` at **six declaration sites** — `IvRank.tsx:91`, `:120`, `:229`,
`MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77` — which canon rule 20 and
the Banned row "Hover-only affordances" already forbid. The fix for (iii) is not new anatomy: the
correct pattern already ships at `ai-rec/AccessibleHelp.tsx:8-12` (`Tooltip` → `IconButton` with
`aria-label`, `describeChild`).

**What the spec should say:** The `FigureCell` state matrix (F1–F9) binds to **16 declaration sites in 2
files** — `LiveTape.tsx` 4 and `DealerPositioning.tsx` 12 (`:102, :109, :116, :136, :142, :148, :155,
:161, :169, :179, :196, :208`) — so the brief's "every figure on the ticker page carries its register
and its liveness" is narrowed in §3 to those two widgets, and `IvRank` / `MarketContext` /
`StraddleMove` / `DealerFlowProjection` are named in a **stale-entry-checked exemption list** (the
`hex-discipline` EXEMPT idiom) stating that their figures are mono and dotless today but are not
enforced, not container-stepped, and not keyboard-reachable at the ⓘ — so the accent-edge/register scan
is scoped to the two converted widgets and is not vacuously green (`Verify by: test`). Whether phase 1
also adopts the four is already before the owner on the existing product card (pm's "The migration
surface is far smaller than it looks"); this list is what makes either ruling countable rather than
implicit.

---

## 2. ux → pm — "Verified at source: that primitive is consumed by seven files (…) and is re-exported from the shared UI barrel."

**Verdict:** resolved-my-position-stands

**Evidence:** Both other lanes verified the same import graph independently (architect's identical
conflict; my R2). Two `import { StatTile }` statements exist: `LiveTape.tsx:35`, `DealerPositioning.tsx:25`.
The re-export is `pages/ticker/widgets/_kit/index.ts:11`, the ticker-local barrel — `shared/ui/index.ts`
does not export it and says so in prose at `:7-8`.

**What the spec should say:** Drop both clauses from the record; the accent-edge deletion is
**16 render sites in 2 files on the ticker page**, a hand edit, not a codemod. The six-screen /
two-scheme GATE Q review list stays exactly as pm wrote it — it is earned by the **radius migration**
(canon Tokens §Radius, `shape.borderRadius` 10 → 12), which does touch every card, not by the tile
count. On landing / scanner / positions / settings / alerts the visible delta is the radius and the
token rebind only, so "same label and same value after" is a real assertion only on ticker
(`Verify by: review`, per-screen).

---

## 3. ux → pm — AC-1: "the page carries **exactly one** liveness claim — counting the chip, any live dot, any pulse and any 'live' wording"

**Verdict:** resolved-my-position-stands

**Evidence:** **Canon rule 13** puts a live dot in the figure cell's label row "**only** when the value
comes from the stream"; **canon rule 18** bans "a second liveness claim anywhere on the same page".
Both are in the same document, so rule 18 cannot mean a rule-13 dot without the canon contradicting
itself — it means a second **page-scope** authority (the architect's verified `TapePulseStrip.tsx:211-214`).
Two further facts settle the *evidence* half, and both cut against the fix the architect and pm agreed
on ("count visible nodes, not attached ones"): `CommandDeck.tsx:226` renders the condensed bar as
`{condensed && (<StickyCondensed …/>)}` — the comment at `:224-225` reads "Rendered **ONLY** when
condensed — so the deck hero's single connection chip is never duplicated in the DOM while the deck
itself is on screen" — so it is the *wrapper* Box at `:212-222` that is mounted-but-hidden, not the chip.
And when `condensed` **is** true the hero `TickerHeader` (`:261`) is still mounted and not `aria-hidden`,
merely scrolled out; an out-of-viewport element passes both Testing Library's and Playwright's
`toBeVisible()`. So an attached-node count *and* a visible-node count each red-build a correct build.
Separately, the per-figure liveness fact needs **no data-flow change** — it is already computable at
each call site: `LiveTape.tsx:78` `netFlow != null`; `:148` `numbersActive && live?.spread != null`;
`:87` `numbersActive && live?.gamma_flip != null` (the rendered value falls back to the bundle's
`m.gamma_flip`, so this is exactly "the shown number came from the stream"); `:165` VWAP reads `m.vwap`
→ **always false**; all 12 `DealerPositioning` cells → **always false** (`:2`, "the STATIC StatTile grid").

**What the spec should say:** Replace the single count with three criteria. (a) Exactly one module can
produce a connection chip — importer set-equality on `connectionChip`, importer set = `{TickerHeader.tsx
(definition), CommandDeck.tsx}` (`Verify by: test`). (b) Exactly one connection chip is **in the
viewport** at each of the two scroll positions, hero-visible and hero-scrolled-past, measured with
Playwright `toBeInViewport` — never an attached-node or `toBeVisible` count (`Verify by: test`). (c) A
figure's live dot renders only when that figure's own value arrived from a delivering stream, so on the
ticker page exactly three cells may wear one (Net flow, Spread, Gamma flip) and **VWAP never does**
(`Verify by: test`). The dot is decorative to the eye and carries the single visually-hidden word
`live`, so the cell reads **"Net flow, live"** to a screen reader; it is never inside an `aria-live`
region, so a tick never announces.

---

## 4. architect → ux — "This phase adds **exactly one** visually-hidden `aria-live="polite"` region per page, owned by the connection chip — mirroring 'one chip per page' so a second region cannot appear."

**Verdict:** conceded

**Evidence:** The guarantee does not follow from the mechanism, though not for the reason given: the
chip renderer is **conditionally mounted** (`CommandDeck.tsx:226`), not mounted-but-hidden. The double
instantiation is real in the other direction — while `condensed` is true, `StickyCondensed` (`:227`,
calling `connectionChip` at `:96`) and the hero `TickerHeader` (`:261`) are both mounted and neither is
`aria-hidden`, so a region owned by the chip component announces twice at exactly the moment the sticky
bar appears. A second defect my R1 wording hid: `connectionChip` returns `text` that **contains the
mid** (`TickerHeader.tsx:328-341`), so a region keyed on the chip's text announces on every tick.

**What the spec should say:** One page-scoped announcer is mounted **once in the ticker page shell**,
above both chip renderers and fed by the single `connectionChip` result; neither chip renderer carries
`role="status"` and neither owns a region. It announces only when the resolved chip **class** changes —
one of the six — never when the text changes, so a mid update is silent (`Verify by: test` for
"exactly one `aria-live` node in the chip path" and for "no announcement on a mid-only change";
`Verify by: review` for the six sentences, which stand as written in my R1 §7, e.g. offline →
`Live stream offline. Reconnecting. Structure levels are still current.`).

---

## 5. ux → pm — AC-20: "a figure in a panel narrower than the compact threshold renders at the compact size … | test | Container-step test holding viewport constant across two panel widths"

**Verdict:** resolved-my-position-stands

**Evidence:** jsdom implements no layout and no container queries at all — every element has zero
dimensions, so no `@container` condition can ever match and `getComputedStyle(figure).fontSize` returns
the base declaration whatever the panel width. A jsdom "renders at the compact size" test therefore
either always fails or is written to assert the base value and passes with the container rule deleted.
What jsdom **can** honestly assert is the *declaration*, using the shipped idiom at
`type-floor.spec.tsx:35-39` — with one verified hardening. That helper ends in

```js
return css.split(`.${emotionClass}{`)[1]?.split('}')[0] ?? '';   // type-floor.spec.tsx:39
```

which returns the **first** rule bearing the class, i.e. the base 20px rule; the `@container` blocks are
later occurrences in the joined stylesheet text and the helper cannot see them. Assert against the whole
joined text, not index `[1]`. One mechanism constraint that is also declaration-assertable:
`Widget/Widget.tsx:157` sets `containerType: 'inline-size'` with **no `containerName`**, so today the
query binds to the nearest ancestor container only by luck of there being one level; phase 2's rails
would capture it.

**What the spec should say:** Split AC-20 into two rows. (a) *Declared*: the emitted stylesheet carries
the `@container` at-rule against the **named** panel container with `(max-width: 360px)` → 17px and
`(max-width: 280px)` → 15px off a 20px base, and no rule inside either block declares a font-size below
the 11px caption floor — `Verify by: test`. (b) *Rendered*: at a fixed viewport, a figure in a 340px
panel renders at 17px and in a 260px panel at 15px — `Verify by: review`, upgradeable to `test` only in
Playwright if the e2e suite gains container-width cases. Do not fake (b) with a unit test.

---

## 6. ux → pm — R-I: "The old primitive carried a non-directional emphasis colour for the opportunity tier."

**Verdict:** conceded

**Evidence:** My R1 §8.1 claimed deleting the accent makes the two walls "visually identical" and that a
replacement mark is **required in phase 1**. Both halves fail at source. The wall tiles' identity is in
the label words themselves — `DealerPositioning.tsx:103` `label="Call wall"`, `:110` `label="Put wall"` —
so the `accent="up"` / `accent="down"` at `:105` / `:112` is redundant salience, not the only encoding.
The gamma-sign accents are redundant too: `fmtUsdCompact` renders negatives with a leading figure minus,
pinned by `_kit/copy.spec.ts:54` (`expect(fmtUsdCompact(v).startsWith('−$')).toBe(true)`), and
`LiveTape.tsx:140` prefixes net flow with an explicit `+`/`−`. So **no datum is lost at any of the 16
sites** — what is lost is scan speed, which is precisely the cost canon rule 13 and the Banned row
"Accent-bar stat tiles (state carried by a coloured edge) … hue-alone state fails a black-and-white
screenshot" already ruled in knowingly. Adding a replacement mark would be a new pattern, i.e. an
Amendments event, not something I can bind at R3. The half of my conflict that survives is narrow and
still real: pm's R-I names only `accentColor`, so `accent` is deleted unruled.

**What the spec should say:** The accent bar goes at all 16 sites with **no replacement mark and no
replacement colour**; the labels stay exactly `Call wall` and `Put wall` (their side is in the words,
and the shipped ⓘ copy already says "Tends to act as resistance" / "as support" at
`DealerPositioning.tsx:107` / `:114` — do not promote that hedge into the label). §3 must rule on
**both** props by name, `accent` and `accentColor`, and the amber for the opportunity tier moves onto the
tier word already inside the value string (`Verify by: test` for "no accent/accentColor prop survives
anywhere"; `Verify by: review` for the tier word's amber).

---

## 7. architect → ux — "| **replay** | `replay · {SYMBOL} {Wed Sep 2}` | **outline** | hollow ring | no | …"

**Verdict:** conceded

**Evidence:** Already withdrawn in my R2 self-revision; `sessionTapeStanding.ts:130-199` renders seven
distinct shipped sentences and one label cannot carry them. One correction to the architect's proposed
invariant, verified at the same source: replay is **not** one tone. `gap` (`:159`) and `ended` (`:168`)
are `tone: 'warning'` with `warnIcon: true`; `drop` (`:177`) and `fault` (`:185`) are `tone: 'warning'`
with `warnIcon: false` because their text already embeds a literal `⚠` (documented at `:113-114`). The
invariant that actually holds — and that makes the standing detail free — is the one the type system
already enforces: `SessionTapeChip.pulse` is the **literal type `false`** (`:112`), and every arm's
`dot` is `'○'` or absent, never `●`. So no replay standing can pulse or wear the live dot, whatever its
tone.

**What the spec should say:** `replay` stays one of the six chip **states**; it carries a closed
`standing` (the seven from `sessionTapeStanding.ts:48-54`) that varies the **sentence and the warning
tone** but can never produce a pulse or a filled dot. The sentences are the shipped ones verbatim — do
not rewrite them (`Verify by: review`) — with exactly one change, required by the canon's Icons row:
`drop` and `fault` drop the literal `⚠` from the string and set `warnIcon: true`, so they render
`Session tape stream dropped` and `Session tape playback fault` with the stroke warn icon.
`Verify by: test` that the produced `kind` set is exactly six, that the seven sentences are pairwise
distinct, and that none contains "Live offline".

---

## 8. pm → ux — "↑↓ move, ↵ opens, **⇧↵ adds to the scan view**, Esc closes."

**Verdict:** conceded

**Evidence:** Already withdrawn in my R2 self-revision on pm's own scope ruling ("commands, recent
history, actions, add-to-scan. Not now."). pm's added point is correct and independent: a write has no
degraded arm here — saving a scan view is session-gated, so a signed-out trader would meet a refusal no
position describes while the helper row still advertised the shortcut.

**What the spec should say:** The palette is **read-only** in phase 1. Bindings are ⌘K/Ctrl-K to open,
↑↓ to move, ↵ to open the ticker, Esc to close; the footer helper row renders exactly
`↑↓ move` · `↵ open ticker` · `esc close` (`Verify by: review` for the words, `Verify by: test` for
"no shortcut is advertised that the palette does not perform").

---

## 9. ux → architect — "If the palette wants recent tickers, that is a new `convexa.*` key and therefore a `[loss-free-durable-migration]` surface"

**Verdict:** resolved-agree

**Evidence:** The architect self-revised on the same facts. Verified: `pages/ticker/recentTickers/store.ts:9`
`const KEY = 'convexa.recent-tickers.v1'`, `:11` `MAX_RECENTS = 8`, `:12` closed pins `SPY · QQQ · NVDA`,
`:78` `listRecents()`, `:86` `recordVisit()`, and the header at `:6` records the fail-safe ("Corrupt/
unreadable → empty in-memory; original blob left intact"). Reading it introduces no key, no shape and no
migration.

**What the spec should say:** Recents stay out of phase 1 on pm's scope ruling, and the recorded cost is
corrected: restoring them later is a **module-placement** change (promote `recentTickers/store.ts` out
of `pages/ticker/`), not a `[loss-free-durable-migration]`. Non-goal "no new durable client store, no
change to an existing key or shape" stands. No AC.

---

## 10. ux → architect — "`value: string | NotANumber` where `NotANumber` is the **closed six-member union** from canon rule 24"

**Verdict:** resolved-agree

**Evidence:** The architect self-revised the cardinality on the same shipped literals I cited
(`positions/labels.ts:126` `NO_BASIS_LABEL`, `broker/brokerView.ts` `NOT_PROVIDED`, `positions`'
`not recorded`, all spec-pinned and two cited as canonical in `PROJECT_CONTEXT.md` §5
`[absent-is-not-none]`). I also **drop my own alternative** of letting the caller declare the
classification: a caller-declared flag lets a real figure be mislabelled a literal, which is the register
inversion running the other way, and it returns `[absent-is-not-none]` to prose against
`[structural-over-prose-enforcement]`. One residual my lane must name: membership is a runtime string
test, so `DealerPositioning.tsx:150` `` value={`$${m.max_pain ?? '—'}`} `` yields `"$—"`, which is **not**
a member and would fall through to the mono figure register carrying a unit.

**What the spec should say:** `FigureCell` classifies by **membership in one exported `NotANumber` union**
seeded from the shipped declaration sites, not from a count; phase 1's criterion asserts closure,
non-synonymy and register — every member renders as 15px Sans, never in the figure register, never
carrying a unit — and does **not** assert the number six, which is the owner's Amendments call already
on the table (`Verify by: test`). Add the paired negative: no rendered figure value may contain a
closed-vocabulary member together with any other character, so `$—` is a red build and `max_pain == null`
renders the bare `—` (`Verify by: test`).
