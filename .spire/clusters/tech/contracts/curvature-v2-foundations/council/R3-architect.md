# R3 — architect reconcile: curvature-v2-foundations

Scope of this file: the technical, non-self-revision conflicts where I am `raised_by` or `source`.
Eight blocks. Product conflicts are left to the owner untouched. Everything cited here was read at
source this session; where I could not verify, I say so and name the assumption.

Path root for every citation is `apps/dashboard/src/app/` unless stated otherwise.

---

## architect -> pm — "that primitive is consumed by seven files ... and is re-exported from the shared UI barrel"

**Verdict:** resolved-my-position-stands

**Mechanism or evidence:** Settled by three independent reads (mine, ux's `66880f71`, the controller's).
Re-verified this session, and I extend it from "two importers" to the render-site count the sweep is
actually priced on: `pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx:25` and
`pages/ticker/widgets/live-tape/LiveTape.tsx:35` are the only `import { StatTile }` statements.
`<StatTile>` elements: `DealerPositioning.tsx:102, 109, 116, 136, 142, 148, 155, 161, 169, 179, 196,
208` = 12 (the one at `:196` sits inside a conditional branch); `LiveTape.tsx:138, 146, 154, 163` = 4.
Sixteen, in two files, on one page. The barrel claim is falsified by `shared/ui/index.ts:15-22`
(ComingSoonBox, ComingSoonBadge/Card, ErrorBoundary, Jargon, Refused, TintChip, ValueCard, `./Widget`)
and by its own header at `:7-8`: "`StatTile` and the ticker `copy` map stay ticker-local (still one
consumer each)". One trap for the build lane: `LiveTape.tsx:2` says "the 5 LIVE-DERIVED StatTiles" —
stale prose; the JSX renders four. Count from the JSX, not the header comment.

**What the spec should say:** The accent-edge deletion is 16 render sites in 2 files
(`DealerPositioning` 12, `LiveTape` 4), a hand-edit, not a codemod. The app-wide visible change this
phase is the radius migration and the token rebind; the six-screen, two-scheme review list is earned
by the radius, not by the tile count, and stands unchanged. "Consumed by seven files" and
"re-exported from the shared UI barrel" must be struck from the record so a later phase does not
re-derive scope from them.

---

## architect -> ux — "`FigureCell` lands **in place** at every existing `StatTile` call site (`LiveTape` 4 cells, `DealerPositioning` 11–12, `IvRank`, `MarketContext`, `StraddleMove`, `DealerFlowProjection`)"

**Verdict:** resolved-agree

**Mechanism or evidence:** ux self-revised at `27d9cd1b` and adopted the finding: "only LiveTape.tsx:35
and DealerPositioning.tsx:25 import StatTile ... I named files I had checked by grep for the word, not
by reading the import graph." Nothing left to contest. The residual is not a disagreement between us —
it is ux's open ask to pm ("do the four hand-rolled 'StatTile-family' surfaces convert in phase 1"),
and that is a scope call I do not own. What I owe R4 is the mechanism that keeps the answer countable
whichever way it lands: the four look-alikes (`IvRank`, `MarketContext`, `StraddleMove`,
`DealerFlowProjection`) hand-roll their own label/value markup, so the F1–F9 state matrix does not
reach them by a primitive swap.

**What the spec should say:** The `FigureCell` state matrix binds at 16 sites in `LiveTape` and
`DealerPositioning`. If pm rules the four look-alikes out of phase 1, the SPEC names them explicitly
as still rendering un-registered figures, fenced in a stale-entry-checked exemption list on the
`hex-discipline` EXEMPT idiom, and the enforcement scan is scoped to the converted widgets so it
cannot pass vacuously. "Every figure on the ticker page answers register and liveness" is then false
as phase-1 scope and must not be written.

---

## architect -> pm — AC-1, "the page carries **exactly one** liveness claim — counting the chip, any live dot, any pulse and any 'live' wording"

**Verdict:** resolved-my-position-stands on the counting basis; **conceded** on my second reason

**Mechanism or evidence:** The first reason now rests on canon-internal evidence rather than on my
preference. `context/DESIGN_SYSTEM.md:168` (rule 13) puts "a live dot **only** when the value comes
from the stream" in the figure cell's label row; `:173` (rule 18) says "A second liveness claim
anywhere on the same page is the failure this rule exists to stop." Read literally, 13 and 18
contradict each other inside one document. The only consistent reading is that rule 18's claim is
**page-scoped** — a second chip, a second page-level assertion of stream state — because rule 13
mandates figure-scoped dots on the same page. AC-1's counting basis is therefore falsified by the
canon, not by me, and a test counting "the chip, any live dot, any pulse" red-builds a rule-13-correct
implementation.

I concede my second reason plainly. My R2 said `CommandDeck` "keeps the sticky condensed bar
MOUNTED-but-hidden ... so two chip nodes are attached to the DOM at all times." That is wrong.
`CommandDeck.tsx:226` is `{condensed && (<StickyCondensed ... />)}` — only the wrapper `<Box>` at
`:212` is always mounted; the chip renderer inside it is conditionally rendered, and the comment at
`:224-225` says so in terms. Duplication occurs only while `condensed` is true. Further,
`CommandDeck.tsx:198-206` returns early when `IntersectionObserver` is absent, which is the jsdom
case, so `condensed` never becomes true in the component harness and exactly one chip is attached
there. A jsdom node count of one would **not** red-build correct code. I withdraw "wrong in both
directions at once." pm's own self-revision (`4a559879`) moved the evidence to the browser layer, and
that is right — for the reason that after scroll in a real browser there genuinely are two attached
chips, not for the reason I gave.

**What the spec should say:** Three assertions, not one count. (1) Exactly one **page-scoped**
liveness claim per page — the chip, with `TapePulseStrip.tsx:211-214`'s `tape-stream-state` text
folded into it — enforced by importer set-equality on the connection-chip resolver module plus a
count of one **visible** chip in the browser layer. (2) Widget bars and figure dots are subordinate
scopes, unlimited in number. (3) Every subordinate signal is gated on the same delivering-stream
predicate the resolver uses, so none can outlive the stream.

---

## architect -> pm — AC-20, "a figure in a panel narrower than the compact threshold renders at the compact size ... | test | Container-step test"

**Verdict:** resolved-agree

**Mechanism or evidence:** ux reached the same conclusion independently at `f03e7029` and marked the
rendered row `review`; the only thing in conflict is pm's harness note routing component/state rows to
"the existing jsdom + Testing Library harness". jsdom performs no layout and evaluates no container
query, so the rendered step cannot be observed there. Two mechanisms the synthesizer needs:

- **Named container is a required edit, not an assumption.** `shared/ui/Widget/Widget.tsx:157` sets
  `{ containerType: 'inline-size' }` and there is no `containerName` anywhere in that file. An unnamed
  `@container` query resolves against the *nearest* container ancestor, so a nested rail would answer
  the panel's question. `containerName: 'panel'` on the `Widget` body, queried as
  `theme.containerQueries.down(360)` / `.down(280)`, is what makes canon rule 21
  (`DESIGN_SYSTEM.md:176`, "Every widget frame is a container-query context") true per-panel.
- **The declaration test needs a hardened reader.** `pages/ticker/widgets/_kit/type-floor.spec.tsx:35-39`
  joins every `<style>` element's text, strips all whitespace, then does
  `css.split(\`.${emotionClass}{\`)[1]?.split('}')[0]`. That returns exactly **one** block and stops at
  the first `}`, so it is structurally incapable of returning both the base declaration and a nested
  `@container` body. Hardening is a global regex over the joined CSS capturing every block bearing the
  class, not a split-once. Stated assumption I could not close: I did not run it, so I do not know
  which rule stylis emits first, only that the helper reads one.

**What the spec should say:** Split AC-20 into two rows. (a) *Declaration* — `test`, jsdom: the
emitted CSS carries the `@container` at-rule with the 360/280 conditions and the 20 → 17 → 15 ladder
and the 11px caption floor that does not step below it, read with the hardened `type-floor.spec.tsx`
idiom. (b) *Rendered size* — Playwright, in `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` (the
suite canon rule 17 already names for checked widths): panel at 340px and 260px with the viewport
held constant, reading computed font size. Do not fake (b) in jsdom.

---

## architect -> ux — "exactly one visually-hidden `aria-live="polite"` region per page, owned by the connection chip"

**Verdict:** resolved-my-position-stands, with my stated mechanism corrected

**Mechanism or evidence:** My R2 reason was partly wrong and the conclusion survives on two sharper
ones. Correction first: the double-mount is transient, not permanent, per `CommandDeck.tsx:226` above.
But `aria-hidden={!condensed}` at `CommandDeck.tsx:213` **never suppresses a mounted chip** — the
wrapper is `aria-hidden` exactly when it is empty, and not `aria-hidden` exactly when it holds a chip.
So while condensed, `StickyCondensed`'s chip (`CommandDeck.tsx:96` calls the shared resolver) and the
hero `TickerHeader`'s chip (`CommandDeck.tsx:261`, still mounted — scrolling does not unmount) are both
attached and neither is hidden: two regions, one transition, two announcements. Second and independent:
an `aria-live` region that is inserted *together with* its content does not reliably announce, because
assistive tech announces mutations to regions already present in the accessibility tree. A chip-owned
region therefore fails in both directions — silent when the chip first mounts, doubled while condensed.
One page-scoped announcer mounted once above both chip renderers, fed by the single resolver's output,
fixes both by construction.

One constraint on the enforcement that the synthesizer must not lose: `shared/ui/index.ts:10-13`
records that `arc.ts`/`ArcDivider.tsx` are deliberately **not** barrel-exported because "their importer
sets are pinned by scan (`arc.spec.ts`) ... a barrel re-export would blind the scan." The same applies
here — if the connection-chip resolver is importer-set-pinned, it must not be re-exported from
`shared/ui/index.ts`.

**What the spec should say:** The `aria-live="polite"` region is hoisted out of the chip to one
page-scoped announcer, mounted once and always mounted, fed by the single resolver's output; chip
renderers carry no `role="status"` and no region of their own. Enforced by exactly one `aria-live` node
in the chip path plus importer set-equality on the resolver module (`arc.spec.ts` idiom, resolver not
barrel-exported).

---

## architect -> ux — replay chip bound to one label, `replay · {SYMBOL} {Wed Sep 2}`

**Verdict:** resolved-agree

**Mechanism or evidence:** ux self-revised at `fa2ff9d8` and adopted the position verbatim: "The
architect's reading (six `kind`s, `replay` carrying a closed `standing`) and PM's R-A and AC-8 are both
right and I adopt them." One correction to my own number, which changes the type the SPEC must name:
`pages/ticker/sessionTapeStanding.ts:46-54` exports `ConsumeStanding` with **eight** members —
`s0 | starting | playing | gap | ended | drop | fault | not-this-ticker`. `s0` is the no-session-tape
arm, i.e. not a replay at all, which leaves exactly the seven replay standings I named. The mechanism
is therefore a derivation, not a retyping: `type ReplayStanding = Exclude<ConsumeStanding, { kind: 's0' }>`,
so an added standing is a compile error at the exhaustive switch without duplicating the list anywhere.

**What the spec should say:** Six chip **states**. `replay` carries `standing: ReplayStanding`, derived
from the shipped `ConsumeStanding` by excluding `s0`, and the standing varies only the sentence —
never the tone, never the outline, never a dot or a pulse, never the liveness claim. Verification:
the enumeration test asserts the produced set of `kind`s is exactly six (`test`); a second test asserts
the seven standings' sentences are pairwise distinct and that none contains "Live offline" (`test`,
the `day-replay-mock-adapter.spec.tsx:187,191` assertions already pin this); the sentences themselves
are ux's copy and are `review`.

---

## ux -> architect — "If the palette wants recent tickers, that is a new `convexa.*` key and therefore a `[loss-free-durable-migration]` surface"

**Verdict:** conceded

**Mechanism or evidence:** ux is right and I had already withdrawn this at `194d4e49`; we agree on
both the falsification and the real cost. Verified: `pages/ticker/recentTickers/store.ts:9` holds
`convexa.recent-tickers.v1`, `:78` exports `listRecents()`, `:86` exports `recordVisit()`. Reading it
introduces no new key, no shape change and no migration, so `[loss-free-durable-migration]` never
fires. I can now name the real cost with its shipped precedent rather than describing it: it is the
promotion rule recorded at `shared/ui/index.ts:5-8` — "primitives land here when they earn a SECOND
consumer ... `TintChip` was promoted from `pages/ticker/widgets/_kit` when `/scanner` became its second
consumer — `pages/` may never import a sibling page." A shell-level palette is that second consumer, so
restoring recents later is the TintChip move applied to a store: one file move plus import edits.
I supplied a false cost basis for pm's deferral; ux caught it; the deferral stands or falls on pm's
scope ruling alone, which is where ux also put it.

**What the spec should say:** Non-goal — no **new** durable client store and no change to any existing
durable key or shape. Record that recents are out of phase 1 on pm's scope future-dating, and record
the corrected cost: restoring them is a **module-placement** question (promote
`pages/ticker/recentTickers/store.ts` to `shared/`), not a durable-migration one, so a later phase does
not over-price it.

---

## ux -> architect — "`value: string | NotANumber` where `NotANumber` is the **closed six-member union** from canon rule 24"

**Verdict:** conceded on cardinality and on who picks the member; resolved-my-position-stands on keeping the type closed

**Mechanism or evidence:** The cardinality is dead and I withdrew it at `8b30bab1`; ux's read is
correct. Canon rule 24 (`context/DESIGN_SYSTEM.md:179`) lists six — `—` · `unavailable` · `not given` ·
`not set` · `size not suggested` · `unrecognized` — and says "a seventh member is an **Amendments**
event." The app ships nine: `features/trading/positions/labels.ts:126` `NO_BASIS_LABEL = 'no basis'`,
`features/trading/broker/brokerView.ts:55` `NOT_PROVIDED = 'not provided'`, and `NOT_RECORDED` from
`positions/view.ts`. That is an unfiled Amendments event and it is the owner's, already routed as
product at `1d13000d` / `5954bcc2`; I do not settle it.

New evidence this session that moves me further toward ux and that the synthesizer must have:
`brokerView.ts:149` is `const asBrokerLiteral = (text: string): string => (text === NOT_RECORDED ? NOT_PROVIDED : text)`,
with `:152` doing the same inside sentences, and `:52` documenting that the two are different things
("`not recorded` ... our own saved records"). The app therefore already **substitutes one member for
another, per surface, by design** — and it is the honest direction, because a broker's non-disclosure
must not be reported as our record being empty. Two consequences. First, ux is right that the caller
picks the member; a flat vocabulary that any surface may draw from would erase a shipped, deliberate
distinction. Second, pm's "never substitutes for another member" must bind `FigureCell`'s own
rendering — the cell renders the literal it was handed, unchanged — not the classification layer, or
it red-flags correct shipped code at `brokerView.ts:149`.

What survives of my position is the closure, and it is the half that carries
`[structural-over-prose-enforcement]`: whether a word **is** a not-a-number literal at all is a type
question, and it decides the register.

**What the spec should say:** `FigureCell` takes a not-a-number value as a member of one exported
closed union seeded from the shipped declaration sites (`positions/labels.ts`, `broker/brokerView.ts`,
`positions/view.ts`, plus the canon's six), never from a hardcoded count; the caller declares which
member. Membership decides the register structurally — 15px Sans, never the mono figure face, never
carrying a unit — and the cell never swaps the literal it was given. AC-19 binds `FigureCell`'s own
accepted set until the rule-24 Amendments ruling lands; the count of six must not appear in it.

---

## Answers to the direct asks routed to me (facts only — no ruling implied)

These are factual questions from pm and ux whose answers are load-bearing for conflicts that are
*theirs* or the owner's. R3 is the last exchange, so I am answering them here rather than leaving them
open.

**Is a per-figure "this value came from a delivering stream" fact available at render time, without a
data-flow change?** Yes — at all four `LiveTape` call sites, because the expression that produces the
value already discriminates stream from bundle from null. Net flow: `netFlow != null` (`LiveTape.tsx:78`,
`numbersActive && live ? live.net_flow : null`). Spread: `numbersActive && live?.spread != null`
(`:148`). Gamma flip: `numbersActive && live?.gamma_flip != null` — and specifically **not**
`flipValue != null`, because `:87` falls back to the bundle's `m.gamma_flip`, so a dot keyed on the
rendered value would claim the stream for a static number. VWAP: `false` — `:165` reads `m.vwap`, a
bundle field, and `:163-168` passes no `offline` prop at all. ux's stated worry is exactly right and
the mechanism is: derive `FigureCell`'s `live` prop from the value's own expression at the call site,
never from `widgetLive` (`:74`) or `numbersActive` (`:73`), which are widget-scoped.

**Is "a value arrived before the drop" distinguishable from "no value ever arrived", without changing
`LiveTape`'s data flow?** No, and nothing holds it incidentally. `shared/hooks/useFlashOnChange.ts:38`
keeps a `prev` ref, but `:44` writes `prev.current = value` **before** the null guard at `:46`, so on a
drop the ref is overwritten with `null` and the last non-null value is destroyed; `:61` returns only
the flash state. Retention requires a new `useRef` latch per live field, updated only on a non-null
incoming value, cleared on symbol change and on replay arm, plus a test that the latched value is not
re-flashed (it did not change — it stopped arriving).

**One correction to my own R2 framing that the owner needs before ruling on AC-17.** I called retention
"a behaviour change ... a claim, not a restyle," implying it was new scope pm was reaching for. That
framing was wrong: canon rule 13 at `context/DESIGN_SYSTEM.md:168` already states "Offline keeps the
**last known value at 50% opacity with a pause marker** and says so." AC-17 restates the canon, and
today's `LiveTape` does not conform to it. The owner's question is therefore *does phase 1 pay to make
`LiveTape` conform to rule 13, or does rule 13 take an Amendments carve-out* — not *does pm get new
scope*. The one outcome I still argue against on evidence, either way, is a caption asserting a
retained value beside a dash, which is what a literal AC-17 read of today's data produces at
`LiveTape.tsx:140` and `:148`.
