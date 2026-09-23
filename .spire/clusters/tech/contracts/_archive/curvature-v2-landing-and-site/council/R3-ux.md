# R3 — ux resolution exchange: curvature-v2-landing-and-site

> Canon (`.spire/clusters/tech/context/DESIGN_SYSTEM.md`, Status **SET**, Curvature Terminal v2) outranks
> every document cited below, including the design source under `design/`. Settled facts from
> `council/decisions.md` §0–§4 are cited as given and not re-argued. Product call **D-A** proceeds on
> option (A) — no draft slots — unless the owner overrules.
>
> Copy discipline for every string below: closed-vocabulary literals are quoted **byte-exact** (including
> the apostrophe glyph), and no label renames the value it sits on.

---

## 60b85e24 — with architect — role: source

**Verdict: CONVERGE**

**Resolution.** I withdraw the sentence. Two of the eight pieces I named are not primitives this feature
can compose from, and one of those I now withdraw for a second, product reason.

- **`FigureCell` — withdrawn.** It is `pages/ticker/widgets/_kit/FigureCell.tsx`, page-local. The landing
  does not mount it and does not force a `shared/` promotion; the score sample is composed from plain
  typography plus the shipped tier chip vocabulary. No desk baseline is disturbed by this feature.
- **The gamma surface — accepted as new.** `pages/landing/GammaSurfaceHero.tsx`, a port of
  `gammaSurface()` as inline SVG: prop-free, geometry computed once at module load, no `arc.ts` import,
  no runtime import from `design/`.
- **`Refused` — withdrawn too, on my own grounds.** It wraps a refused *write affordance* with a sign-in
  recovery. Once the waitlist control is deleted (`96c5f81b`) and "Create an account" becomes `Sign in`,
  the landing has no refused affordance left. `Widget`, chips, the route `ErrorBoundary`, `Footer` and
  `ArcDivider` stand as genuinely shared.

**Three copy-integrity conditions on the port — these are mine, and they are not optional.** The design's
own artefact paints claims into the SVG that the landing may not make:

| in `design/src/lib.mjs` | disposition | why |
| --- | --- | --- |
| `<text … font-family="IBM Plex Mono" …>mid 573.12</text>` (`:430`) | **cut** | Mono is the traced register (canon rule 23: "Mono means *this figure is Convexa's*"). A specific mid painted into a marketing hero is an untraceable figure wearing the traced register — the exact inversion the register exists to prevent. |
| `<text … font-family="IBM Plex Mono" …>gamma flip 568.50</text>` (`:431`) | **cut** | same |
| `<circle … class="beam">` (`:429`) | **cut** | `beam` is a data-signal keyframe. Canon's Motion predicate (a) requires a genuinely live stream; there is none. It would also breach AC-U13 as re-cut by self-revision `09f56616`. |

**The hero SVG paints no text at all.** The legend, the eyebrow and the sample disclosure are DOM text
beside the picture — in the accessibility tree, in my lane, and readable in a screenshot.

**Verbatim copy the SPEC should carry (hero panel):**

| slot | literal | source |
| --- | --- | --- |
| panel eyebrow (caps) | `Dealer gamma surface · strike × tenor` | `design/src/screens/landing.mjs:52` — kept verbatim; it describes the picture, asserts no datum |
| legend, three items | `gamma flip` · `call wall` · `put wall` | `landing.mjs:54`, minus the numeric tenor range |
| caption under the panel | `Illustrative sample — not a live read and not a recorded session.` | mine; the same string the field panel carries, so `/` has one sample literal, not two |
| SVG accessible name | `Dealer gamma surface across strike and tenor` | `design/src/lib.mjs:424`, `role="img"` kept; add `aria-describedby` → the caption id so the disclosure reaches a screen reader |

**Cut from the design source, with cause:** `three.js surface · the desk's own model, drawn in depth`
(`landing.mjs:56` — the artefact contains no three.js; all three lanes agree) · `structure as-of 42s`
chip and `<span class="chip live"><span class="dot"></span>mid</span>` (`landing.mjs:52` — a live chip
and dot on a snapshot surface, canon Banned row) · `rendered from the desk's own bundle` and
`7d → 90d tenors` (`landing.mjs:54` — a provenance claim and an axis range the projection does not
compute).

**Component states — `GammaSurfaceHero`:**

| state | trigger | what renders | copy | Verify by |
| --- | --- | --- | --- | --- |
| default | first paint | the SVG, static, identical on every device | eyebrow · legend · caption | `review` (presence, ordering, wording) |
| reduced motion | `prefers-reduced-motion` | byte-identical — the module contains no animation and no `beam` | unchanged | `test` (negative space: zero `@keyframes`/`animation` and zero `class="beam"` under `pages/landing/**`) |
| error | a throw during render | the route-variant `ErrorBoundary` (self-revision `e1837901`) | boundary copy, not the hero's | `test` |
| loading / stale / offline / empty | — | **n/a by construction**: the module has no props, no data edge, no async work | — | — |

**Refinement to the set-equality cap (accepted with one condition).** `{HeroCurve.tsx,
GammaSurfaceHero.tsx}` is decidable *only if* no other SVG geometry is authored under
`pages/landing/**`. Two things would break it, so I rule them now:
1. **Every icon is imported from `shared/`.** No icon geometry is authored in the landing folder.
2. **No ring gauge.** The design's score sample uses `ring(72, {size: 52})` (`landing.mjs:87`), and no
   ring-gauge component exists anywhere in `apps/dashboard`. Inventing one for the acquisition page only
   is a second illustration under canon's hard limit ("exactly one hero instrument … and nothing else",
   `DESIGN_SYSTEM.md:113-114`). The landing's score sample renders the score as a figure plus the shipped
   tier row `Dormant → Watch → Actionable → Prime` and the caption `0–100 triage score · not a trade
   signal` (`landing.mjs:90`, verbatim). If the council wants the ring, it is an **Amendments** event on
   `DESIGN_SYSTEM.md` and it lands on the desk first — not on the landing as a one-off.

**Evidence.** `design/src/lib.mjs:383-433` (closed-form isometric projection; `role="img"` +
`aria-label` at `:424`; `class="beam"` at `:429`; painted mono figures at `:430-431`) ·
`design/src/screens/landing.mjs:52,54,56,87,90` · `DESIGN_SYSTEM.md:113-114` (one hero instrument),
`:138` (nothing in the app imports from `design/` at runtime), `:178` (rule 23, type register) ·
`apps/dashboard/src/app/pages/landing/HeroCurve.tsx:78` (the only `viewBox` under `pages/landing/**`
today — grep returns exactly one hit) · `apps/dashboard/src/app/shared/ui/Refused.tsx:12-24` (its props
are `actionLabel`/`reason`/`onSignIn` — a refused write affordance) · no ring/gauge component exists
under `apps/dashboard/src/app/shared/` (grep for `strokeDasharray|Gauge` returns only spec files and
`usePollingResource.ts`).

---

## 206a60b3 — with pm — role: source

**Verdict: CONVERGE**

**Resolution.** PM is right and the fault is mine: I wrote a structural check whose subject is a word,
scoped it to the one page whose job is to define that word, and hid the ambiguity in the phrase "applied
to itself" — a distinction a reader can make and a scan cannot. I accept the split exactly as proposed,
and I write both halves.

**AC-U5a (replaces the structural half).** *No live chip, live dot, pulse, beam, particle, drift, trail
or shimmer renders on any of the six surfaces.* **Verify by `test`** — negative space, silently
regressing, mutation-proved. This is the arm that carries the canon's teeth (Banned: "A 'live' chip, dot
or pulse on a snapshot surface"; rule 22). It reads elements and classes, never prose.

**AC-U5b (replaces the honesty half).** *No surface in this feature describes its own displayed figures
as live, current, or as-of.* **Verify by `review`** — it is about what a sentence means, not which words
it contains, and it is visible and intentional copy.

**Explicitly permitted, so the check is never quietly narrowed at build:**

| surface | permitted use of the word | why it is not a self-claim |
| --- | --- | --- |
| `/methodology` — "Two data speeds" | defines the two clocks: tape vs structure snapshot | the page teaches the vocabulary; it displays no figure of its own |
| `/methodology` — Vocabulary section | defines `unavailable` and the live-vs-snapshot distinction | same |
| `/` — the field section bullet | describes what the **desk** does | the sample beside it is frozen and says so |

**One microcopy refinement on the landing bullet.** The design's line is `The mid is tape — it pulses only
while the stream is genuinely live` (`landing.mjs:126`). Sitting three inches from a frozen sample, the
bare subject "the mid" can be read as *this* mid. The SPEC carries it with its subject named:

> `On a ticker desk the mid is tape — it pulses only while the stream is genuinely live.`

Four added words, no new claim, and the ambiguity that would have made AC-U5b arguable is gone.

**The landing's field panel carries, verbatim** (settled by `80f4f7b0` + `5cb7604c` — `variant='ticker'`
suppresses the canvas's own title strip and tape pill, so the panel header is mine):

| slot | literal |
| --- | --- |
| panel header | `Structure field` |
| panel caption | `Illustrative sample — not a live read and not a recorded session.` |

No `as-of`, no `demo as-of`, no `synthetic demo`, no `TAPE OFF` pill anywhere on `/`.

**Evidence.** `DESIGN_SYSTEM.md:73` (Banned: a "live" chip or pulse on a snapshot surface), `:177`
(rule 22, liveness is gated), `:228` · `council/decisions.md` §1 `09f56616` (AC-U13 re-cut to the
negative-space keyframe rule), §2 `80f4f7b0` (`variant='ticker'` sets `embedded`; the panel header and
the sample literal are the landing's) · `design/src/screens/landing.mjs:126` · `design/src/screens/
methodology.mjs:53` ("last known is frozen when the stream is offline and never framed as live" — the
page already teaches the distinction it needs the word for).

---

## 78ecd37d — with pm — role: raised_by

**Verdict: CONVERGE** (I confirm the conflict; PM withdrew the ruling independently in their own R2, so
this closes on agreement rather than on my objection.)

**Resolution.** The landing says **nothing** about brokerage connect in its body: no "coming", no notify
control, no acknowledgement. Read-only brokerage connect shipped; a sentence in the future tense about a
capability already in the product is the same class of failure as a live dot on a snapshot, and the
product has already made this exact correction once — `shared/copy/disclaimer.tsx:6-10` records that the
disclaimer's old ending "No brokerage connection." **became false the instant a Webull credential was
stored**, and was rewritten to the narrower true claim.

**Nothing is lost by the deletion.** The footer — mounted once in `AppShell` on every in-shell route
(settled, `0b1ff840`) — already renders the true present-tense sentence on `/`:

> `Convexa is an analysis tool. Positions in the sim book are simulated (paper); a connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not investment advice.`
> (`shared/copy/disclaimer.tsx:18-21`, `DISCLAIMER_TEXT`; the rendered fragment at `:30-32` bolds
> `simulated`.)

**If the owner overrules and wants brokerage named in the landing body**, the only wording available is
present tense, and I supply it so nobody drafts it under time pressure:

> `Connect a brokerage in Settings and Convexa reads your positions — read-only. It never places, changes, or cancels an order.`

It renders as a sentence, never as a CTA: the capability needs a sign-in the visitor cannot obtain while
sign-ups are closed, plus the visitor's own broker credentials, so an action would be a second dead-end
funnel. `Verify by: review` (visible, intentional copy).

**AC:** *No surface in this feature states or implies that brokerage connect is forthcoming.*
**Verify by `test`** — the absence of a future-tense brokerage claim is invisible in review once the card
is gone and regresses silently if a later lane re-imports `ComingSoonCard`; assert zero occurrences of a
brokerage-plus-forthcoming phrase under `pages/{landing,blog,methodology,not-found}/**`, mutation-proved.

**Evidence.** `apps/dashboard/src/app/shared/copy/disclaimer.tsx:6-10,18-21,30-32` ·
`apps/dashboard/src/app/features/auth/copy.ts:158-166` (shipped `settings.brokerage` — `heading`,
`helper` "Convexa reads positions only — it never places, changes, or cancels an order", `connectBtn`,
connected/replace/disconnect states) · `apps/dashboard/src/app/pages/methodology/copy.ts:11-13` (shipped
present tense) · `design/src/screens/methodology.mjs:63` (same, in the design source) ·
`design/src/screens/landing.mjs:118` (the false sentence: `Brokerage connect (read-only) is coming — get
notified.`) · `council/decisions.md` §0 row 3.

---

## 96c5f81b — with architect — role: raised_by

**Verdict: CONVERGE** (I confirm. Both the PM's R2 and the record now agree; the exchange is about the
replacement, not the deletion.)

**Resolution.** Delete the mechanism, not its type size. Removed from `Landing.tsx`: the `WAITLIST_TOAST`
constant (`:46`), the `toastOpen` state (`:51`), the `ComingSoonCard` block (`:213-235`) including the
title `Connect a real brokerage`, the body ending `Coming soon.` and the `Notify me` button
(`data-testid="waitlist-button"`), and the `Snackbar` (`:240-247`) with `data-testid="waitlist-ack"`.

**The surviving CTA-band composition, verbatim** (design order, with the closed-signups substitution
P-7 requires):

| slot | literal | source | note |
| --- | --- | --- | --- |
| band heading | `Open any ticker. No account, no card.` | `landing.mjs:117` | verbatim |
| band body | `The full structure desk is free. Sign up when you want the Scanner, a simulated book that persists, and AI reads on your own key.` | `landing.mjs:117` minus `across 69 tracked names` | PM ruled the count dropped; the landing never reads `universe.json`, so it can rot into a lie |
| primary | `Open the Ticker →` → `/ticker` | `landing.mjs:118` | P-1: the biggest button stops refusing the person who clicks it |
| secondary | `Sign in` | **imported** `AUTH_COPY.account.signIn` (`features/auth/copy.ts:12`) | replaces `Create an account`; the deny-list allows `features/auth/copy` (`7c81de20`) |
| under the secondary | `New sign-ups are closed while Convexa is in private testing.` | **imported** `AUTH_COPY.signup.signupsClosed` (`features/auth/copy.ts:28`) | AC-U9 / P-7 — one sentence, one source, so reopening sign-ups is one edit |

Hero band (unchanged from the design): primary `Open the Ticker →` → `/ticker`; secondary
`How it’s built` → `/methodology` (`landing.mjs:47`, curly apostrophe kept byte-exact).

**One honesty rule this creates, which I own:** two actions on `/` now share the accessible name
`Open the Ticker`. That is permitted **only because their destinations are identical**. Two same-named
actions with different destinations would be an accessible-name collision; `Verify by test` — assert
every action on `/` with the same accessible name resolves to the same `href`.

**A11Y-B2 rewrite (the selector-and-subject change).** The existing test is named `A11Y-B2 native actions
and polite waitlist announcement`; the name goes with the subject.

> **`A11Y-B2 CTA actions are native, keyboard-reachable, and name their destination`** — on `/`:
> `cta-primary` is an `<a>` with `href="/ticker"` and accessible name `Open the Ticker`;
> `cta-band-primary` is an `<a>` with the same `href` and the same name; `cta-band-secondary` is a
> `<button>` with accessible name `Sign in` that opens the auth dialog; each takes a visible
> `:focus-visible` ring on keyboard focus (canon rule 6); and the closed-signups sentence is present in
> the band. No `[aria-live]` region is asserted, because none is mounted.

**Verify by `test`** — keyboard reachability and the focus ring regress silently; the copy inside the band
is separately `review`.

**Evidence.** `apps/dashboard/src/app/pages/landing/Landing.tsx:46,51,213-235,240-247` ·
`apps/dashboard-e2e/src/quality/accessibility.spec.ts:115-125` (asserts `cta-primary` → `/scanner`,
presses `waitlist-button`, expects `"Thanks — we'll let you know when brokerage connect is live."`) ·
`apps/dashboard/src/app/features/auth/copy.ts:12,28` · `design/src/screens/landing.mjs:47,117,118` ·
`council/decisions.md` §1 `7c81de20` (the deny-list allows `features/auth/copy`).

---

## 4bff0a56 — with architect — role: raised_by

**Verdict: CONVERGE** (I confirm the substance and **narrow my own claim by one sentence** — see below.)

**Resolution.** I am not asking for a state peer to the wall and not asking the route decision to change.
Degrading the route decision to anonymous is correct. What must stop is the **heading asserting a fact the
failed read did not return**. Verified at source: `RequireAuth.tsx` today reads only `{ ready,
authenticated }` (`:56`) and never consults `subsystemDegraded` at all — so this is additive, not a
rewrite of a working branch.

**Narrowing my R2.** I claimed the caption at `:84` was part of the identity assertion. It is not.
`Private testing — invited accounts only. Landing, ticker, and blog stay open without signing in.` is a
**policy** statement, true whoever the visitor is. It stays in every branch. Only the heading at `:75`
asserts identity. Withdrawn, and the wall keeps one more true sentence than my R2 would have left it.

**Component states — `RequireAuth`:**

| state | condition | what renders | verbatim copy | Verify by |
| --- | --- | --- | --- | --- |
| holding | `!ready` | `<RouteFallback />` — never the wall, never `null` | shipped `aria-label="Loading page"` | `test` (see `4a4bb05c`) |
| pass-through | `ready && authenticated` | `children` | — | `test` |
| wall (normal) | `ready && !authenticated && !subsystemDegraded` | the shipped wall, unchanged | `Sign in to open {surface}` · `wallCopy(surface).unlocks` · `wallCopy(surface).freePath` · the policy caption · `Sign in` · `Open free Ticker →` | `review` (visible copy) |
| **wall (degraded)** | `ready && !authenticated && subsystemDegraded` | the same wall frame; heading swapped; one line added above the unlock sentence; a `Try again` action added beside `Sign in`; everything else identical | see below | **`test`** |

**Degraded-branch copy, exactly:**

| slot | literal | source |
| --- | --- | --- |
| heading (replaces `Sign in to open {surface}`) | `We couldn't check your session.` | **new** — `AUTH_COPY.gate.sessionUnknown`, to be added to `features/auth/copy.ts` |
| first body line | `Couldn't reach sign-in right now. Please try again in a moment.` | **shipped verbatim** — `AUTH_COPY.gate.unavailable` (`copy.ts:197`; identical at `:33` and `:46`) |
| action beside `Sign in` | `Try again` — `onClick` calls `refresh()` | **new** — `AUTH_COPY.gate.retry` |
| kept unchanged | `wallCopy(surface).unlocks` · `wallCopy(surface).freePath` · the policy caption (`:84`) · the `Sign in` button · `Open free Ticker →` | `RequireAuth.tsx:37-52,80-107` |

Two new literals total, both in `features/auth/copy.ts` — the one home this council already agreed the
auth strings have. The `Sign in` button stays in the degraded branch: it is an **offer**, not a claim
about who the visitor is.

**Why `test` and not `review`.** The degraded branch is unreachable in any normal pass — you must force
`getSession()` to reject to see it. It is invisible, and it regresses silently. AC-U29 stands as written.

**Evidence.** `apps/dashboard/src/app/features/auth/RequireAuth.tsx:56` (`const { ready, authenticated }
= useAuth()` — `subsystemDegraded` appears nowhere in the file), `:63,:75,:84` ·
`apps/dashboard/src/app/features/auth/AuthContext.tsx:10-12` ("That flag drives ONLY the gated-action
'couldn't reach sign-in' copy"), `:55-57`, `:108-121` (the transport-fault branch sets
`authenticated:false, subsystemDegraded:true`) · `apps/dashboard/src/app/features/auth/copy.ts:33,46,197`
· `design/src/screens/dialogs.mjs:29-40` (the design's wall has no degraded branch — this is new work,
not a deviation).

---

## 4a4bb05c — with architect — role: raised_by

**Verdict: CONVERGE** (I confirm. The app already does this on the identical fact, two routes away.)

**Resolution.** While `!ready`, `RequireAuth` renders the same `RouteFallback` that
`DefaultTickerRedirect` already renders on the same condition — not the wall, not a skeleton *of* the
wall, not `null`. AC-U28 stands: **never the wall, never `null`.**

This is not "a redesign that adds a skeleton to improve the wall". It is the codebase's own established
answer, with its rationale written in the comment above it: *"Waits for the ONE non-blocking who-am-I
read (`ready`) behind the quiet route fill"* (`app.tsx:122-125`). `null` is not a hold a person can
perceive: on a hard load of `/scanner` a signed-in trader gets an empty region under a mounted nav with
nothing saying anything is happening — precisely PM's AC-A3 ("it never leaves the visitor on an
indefinite blank").

**The distinction that actually matters, stated so the build cannot blur it:** what must not ship is a
**signed-out-looking** placeholder — a wall skeleton, a greyed `Sign in`, a "you are not signed in"
shimmer. A neutral fill that makes **no auth claim** is not one. The shipped `RouteFallback` qualifies:
its only string is `aria-label="Loading page"`, which is true and asserts nothing about the session.

The product has already ruled this exact shape once, in copy: `AUTH_COPY.settings.sessionResolving` —
`Checking your session — these controls unlock in a moment.` — carries the comment *"Never claims
signed-out or signed-in — the session state is not yet known."* (`copy.ts:96-98`). Same principle, same
fact, already owner-approved.

| state | condition | what renders | copy | Verify by |
| --- | --- | --- | --- | --- |
| holding | `!ready` | `<RouteFallback />` (`app.tsx:99-108`) | `Loading page` (accessible name only; no visible text) | `test` — assert `require-auth-wall` is **absent** and `route-fallback` **present** while the who-am-I is in flight |

**One refinement, so this does not smuggle in a shell redesign.** If a delay-before-show (sub-300ms
suppression) is wanted, it lands **once inside `RouteFallback`**, so both call sites behave identically;
it never lands only in `RequireAuth`. And my AC-U26's separate question — whether `RouteFallback` gains a
route name — is **not** bundled here and is answered on its own; if it is, the name comes from the route
table as a literal, never from parsing `location.pathname`.

**Evidence.** `apps/dashboard/src/app/app.tsx:99-108` (`RouteFallback`, `data-testid="route-fallback"`,
`aria-label="Loading page"`), `:122-131` (`DefaultTickerRedirect`: `if (!ready) return <RouteFallback
/>;` with the quiet-route-fill comment) · `apps/dashboard/src/app/features/auth/RequireAuth.tsx:61-63`
(today `if (!ready) return null;`) · `apps/dashboard/src/app/features/auth/copy.ts:96-98`.

---

## 656c4d95 — with architect — role: raised_by

**Verdict: CONVERGE** (I confirm my condition, and I add one row the exchange has not covered — a lazy
boundary needs an **error** state, not only a loading one.)

**Resolution.** The bundle argument is real and I do not contest it. My condition is that the states it
creates are written before it lands, not discovered after.

**If the `React.lazy` boundary lands, the landing's state matrix gains two rows — both scoped to the field
section, never to the page:**

| state | trigger | what renders | verbatim copy | Verify by |
| --- | --- | --- | --- | --- |
| loading *(field section only)* | the chunk is in flight | the same panel frame at a **reserved min-height equal to the loaded canvas box**; header and caption present; the well area empty | header `Structure field` · caption `Illustrative sample — not a live read and not a recorded session.` | `test` — assert no `CircularProgress`, no shimmer keyframe, and identical panel height in both branches |
| error *(field section only)* | the chunk rejects | the same panel frame, same header and caption; the well area carries one line | `The structure field sample didn't load.` | `test` |

**No spinner** (a second moving element on a page whose motion budget is the `HeroCurve` draw). **No
skeleton shimmer** (a data-signal keyframe that fails canon's Motion predicate (a) — there is no stream to
gate it). **No zero-height box** (layout shift directly under the H1 on first paint).

**The row the exchange has not covered.** A `React.lazy` chunk-load **rejection throws during render**. With
no section-scoped boundary it propagates to the route `ErrorBoundary` (self-revision `e1837901`) and
replaces the **entire acquisition page** with an error surface — a strictly worse outcome than the bytes
the boundary saves, and it fires on exactly the connections the boundary exists to help. So the boundary
is a pair, not a single: `<ErrorBoundary variant="section"><Suspense fallback={…}>…` — or it does not
land. The error copy above names what failed, does not blame the visitor, does not claim a data fetch
(there is none), and offers no retry, because nothing the page needs is missing.

**Standing alternative, unchanged from my R2:** if either the fallback or the section boundary is
unacceptable, import the field eagerly and pay the bytes.

**Evidence.** `DESIGN_SYSTEM.md:106` (Motion — a keyframe qualifies for the data-signal class only if it
"is driven by a **genuinely live stream** and stops when the stream drops") · `council/decisions.md` §1
`09f56616` (the `HeroCurve` draw is the one orchestrated moment), §1 `e1837901` (every route element is
wrapped; the eager index gets a bare route-variant `ErrorBoundary`), §2 `80f4f7b0` (the panel header and
the sample literal are the landing's) · `apps/dashboard/src/app/app.tsx:112-116` (`lazyRoute` = route
`ErrorBoundary` + `Suspense`, the shipped pairing pattern).

---

## d1a94c99 — with pm — role: raised_by

**Verdict: CONVERGE** (I confirm the substance, **correct my own wording** against the canon, and replace
my proposed mechanism with a stronger one I found at source.)

**Resolution.** The "this is a selection" clause is deleted. A selection clause on the one page that
defines the closed vocabulary teaches the trader that the set is open — the exact inversion rule 24
exists to prevent, and the reason the canon was widened from six to nine on 2026-09-03.

**Correcting my own R2.** I wrote "**Nine** rows, nine distinct definitions". The canon forbids that
framing: *"The AC asserts closure and non-synonymy, **never a count**"* (`DESIGN_SYSTEM.md:258`). My
sentence would have written the count I was told not to write. The AC reads:

> **AC-U20.** The Vocabulary table renders **one row per member of the shipped closed vocabulary, set-equal
> to it** — no member missing, no non-member present. Each row carries a definition distinct from every
> other row's; no two rows are paraphrases. Every literal renders in **Plex Sans**, never mono and never
> as a figure.
> **Verify by:** `test` (set-equality + register) · `review` (the definitions' wording).

**Mechanism — better than the `?raw` scan I proposed.** The closed vocabulary already ships as a typed
`as const` array: `apps/dashboard/src/app/shared/copy/notANumber.ts:26-38`, `NOT_A_NUMBER`, with
`NotANumber = (typeof NOT_A_NUMBER)[number]`. The methodology page **imports it** and the spec asserts
set-equality between the table's literal column and that array. A tenth member added to the union without
a definition red-builds the page that documents it — which is exactly what my R2 asked for, achieved with
a type-checked import instead of a source scan. `pages/methodology` → `shared/` is the sanctioned
dependency direction and is untouched by the deny-list (`7c81de20` bans `@convexa/api`, `@/pages/*`,
`@/features/trading/*`, `features/auth/AuthContext`).

**The definitions I sign** (literals byte-exact from `notANumber.ts:26-36`; the first six keep the design's
wording where it is already right, `methodology.mjs:60`):

| literal | means |
| --- | --- |
| `—` | no value on this snapshot — a plain dash, never a fake zero |
| `unavailable` | an input failed or is missing this cycle |
| `not given` | the read did not answer this field |
| `not set` | you supplied no risk block — the one on this list you can clear yourself, by typing one |
| `size not suggested` | the risk block is present; the model returned no size |
| `unrecognized` | the read answered a conviction outside low / medium / high; Convexa will not repeat what it cannot place |
| `not recorded` | the saved record never held this fact, so there is nothing to show |
| `not provided` | the feed did not send this field — the source withheld it, not us |
| `no basis` | no cost basis is on file, so a cost-based figure cannot be derived; the dollar figure beside it is still real |

Nine distinct meanings, and the three closest pairs are separated on purpose: `not recorded` (we never
captured it) vs `not provided` (the source did not send it) vs `unavailable` (an input failed **this
cycle**). `notANumber.ts:14-16` states the non-synonymy rule the module itself enforces.

**The register defect neither position addressed.** `design/src/screens/methodology.mjs:60` renders every
literal with `class="mono"` — the figure register, on the page that teaches the vocabulary. Rule 24: *"rendered as Sans text, never as a figure"*. The shipped app already gets this right and proves it:
`shared/figure/figureState.spec.ts:108` — *"`not recorded` with register `traced` is STILL Sans (AC-19:
register is ignored on a literal)"*. The page follows the app, not the artboard.

**Evidence.** `DESIGN_SYSTEM.md:179` (rule 24), `:258` (ruling 3 — "never a count") ·
`apps/dashboard/src/app/shared/copy/notANumber.ts:1-23,26-38,46-48` ·
`apps/dashboard/src/app/shared/figure/figureState.spec.ts:108-116,185` ·
`design/src/screens/methodology.mjs:60` (six literals, all `class="mono"`).

---

## 22f6ae74 — with pm — role: raised_by

**Verdict: CONVERGE** (I confirm. The general rule is right and I adopt it in full; only the named
particular was false, and it is cheap to fix.)

**Resolution.** Keep the phrase; name where it lives; render it as **text, never as a route link**. The
route link is the real hazard AC-M5 reaches for — there is no `/whats-sent` route and a link would 404.

**The sentence the SPEC carries** (replacing the trailing clause of `methodology.mjs:51`):

> `What leaves the machine, on demand, is the computed snapshot, the candidate contracts, your two risk numbers, the open-positions digest for the ticker, the persona prompt and the field glossary. You can read the exact payload before it is sent: open “What’s sent to the AI” from the full-analysis drawer on any ticker, or “View what’s sent” in Settings → Risk inputs. No other ticker, no identity, no broker data and no key ever leave.`

**Two literals quoted, and the apostrophes differ — this matters.** `What’s sent to the AI`
(`ai-rec/copy.ts:21`) uses U+2019; `View what's sent` (`auth/copy.ts:210`) uses U+0027. Quoting a shipped
label that does not match byte-for-byte is a broken pin dressed as a citation. Both are reproduced above
exactly as they ship.

**AC-M5 as I would sign it:** *`/methodology` names no product surface a visitor cannot reach from the
running app, and every anchor on the page resolves to a path in the route table or to a static document
under `public/`.* **Verify by `test`** — a dead internal link is invisible until someone clicks it and
regresses silently when a route is renamed. The prose naming a surface's location is **`review`**.

**The cut stands where PM aimed it.** `persona.html`, `flows.html` and `operator.html` are documentation
artboards and are named nowhere on `/methodology`. `whats-sent.html` is not in that group: it documents a
shipped drawer.

**Evidence.** `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts:21` (`requestExport: 'What’s
sent to the AI'`) · `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx:381-384` (the
button, inside the `<Drawer>` closed at `:388`) · `apps/dashboard/src/app/features/auth/copy.ts:210`
(`viewWhatsSent: "View what's sent"`) · `apps/dashboard/src/app/features/auth/RiskInputsSection.tsx:113-120`
(rendered as `{C.viewWhatsSent} →`, `data-testid="risk-inputs-view-whats-sent"` — my R2 cited `:116`, the
testid line; the label renders at `:119`) · `design/src/screens/methodology.mjs:51` (names it in prose,
not as a link — the design agrees) · `design/src/screens/dialogs.mjs:89-97` (the drawer's own artboard).

---

## bc0fe3d9 — with pm — role: raised_by

**Verdict: CONVERGE** (I confirm. The defect is real, the fix is wanted, and the mark is the part I am
holding: `test`, not `review`.)

**Resolution.** `Verify by: test`. A `<noscript>` block is invisible in every normal pass — nobody reviews
the acquisition page with JavaScript off — so its silent removal by any future build or template change
is unobservable. That is the textbook `test` side of `spire-tech-risk-based-verify` (invariant, negative
space, silently regressing) and the opposite of the `review` side (visible, intentional copy). Marked
`review`, this criterion is checked exactly once, at build, and never again.

**The mechanism already exists.** Four shipped specs glob `apps/dashboard/index.html` with Vite `?raw`
(`fonts.spec.ts`, `banned-hexes.spec.ts`, `brand-assets.spec.ts`, `firstPaintTheme.spec.ts`, per the
architect's own R2 agree list). AC-L11 rides that pattern: assert `index.html` contains a `<noscript>`;
that its text contains `Convexa`; that it contains an anchor to
`/blog/how-we-read-dealer-structure.html`; and that the target file exists on disk and contains no
`<script type="module">`. Mutation-proved.

**The copy inside it, verbatim** (mine):

> `Convexa needs JavaScript to run. It reads options dealer positioning — the call and put walls, the gamma flip, and where price is pulled.`
> `How We Read Dealer Structure — a plain page that works without JavaScript.`

The second line is the anchor. Its text is the target document's **own title**, verified at
`public/blog/how-we-read-dealer-structure.html:6` (`<title>`) and `:68` (`<h1>`) — so the link names what
it opens rather than describing it.

**One constraint that falls out for free.** The block carries **no hardcoded hex**: `hex-discipline.spec.ts`
and `banned-hexes.spec.ts` already glob `index.html`, so a styled `<noscript>` would red-build. Plain
markup, inheriting whatever the first-paint theme sets. That is the correct outcome anyway — a marketing
flourish nobody can see is worse than none.

**Evidence.** `apps/dashboard/index.html:94-97` (`<body>` contains `<div id="root">` and the module
script; there is no `<noscript>` anywhere in the file) · `apps/dashboard/public/blog/how-we-read-dealer-structure.html:6,68`
(the only static article under `public/blog/`) · `DESIGN_SYSTEM.md:192` (hex specs glob `/index.html`).

---

## 5b3ba168 — with pm — role: raised_by

**Verdict: CONVERGE** (I confirm, and the mechanism objection is answered by evidence: **all five
constants are traceable at source, and none of them is in `apps/api`.**)

**Resolution.** The third option PM's ruling excluded is not merely available — it is easy, and the
premise it was excluded on is false at two points.

**All five caps, traced.** They live in `libs/quant-engine`, a workspace library:

| row on the page | Max | constant at source |
| --- | --- | --- |
| Proximity to walls / flip | 40 | `libs/quant-engine/src/signals.rs:482` — `(40.0 * (1.0 - nearest / FAR_LEVEL_PCT)).max(0.0)` |
| \|IV/HV − 1\| stretch | 25 | `:487` — `((ivhv_v - 1.0).abs() * 50.0).min(25.0)` |
| Active setups | 25 | `:488` — `((setups.len() as f64) * 8.0).min(25.0)` |
| Flip transition | 10 | `:489` — `if near_flip { 10.0 } else { 0.0 }` |
| Dark-pool confluence | 6 | `:24` — `pub const DARK_POOL_BONUS_CAP: i32 = 6;` |

**Two corrections to the record, stated plainly because the ruling rests on them.**
1. *"The dark-pool cap of 6 is the live instance — neither of us could trace it"* (PM's R2 agree list,
   endorsing the architect). It is a **named, public, single-line constant** —
   `DARK_POOL_BONUS_CAP: i32 = 6` — consumed once, at `signals.rs:541`. It is the most traceable of the five.
2. *"`apps/api` is frozen this phase"*. The constants are not in `apps/api`; they are in
   `libs/quant-engine`. And a **read-only** scan changes zero bytes in either, so the BRIEF's
   "`apps/api` diff stays 0 on this branch" (`BRIEF.md:15`) is untouched either way.

**What I sign.**
- **Keep `review` for the section's wording** — the prose is visible, intentional copy.
- **Add one `test`**: a Vitest (node environment) case reads `libs/quant-engine/src/signals.rs` from disk
  and asserts the five values above against the table's `Max` column, mutation-proved. It imports no
  backend, executes no Rust, and compares source to page rather than one hard-coded number to another.
- **Fallback if the mechanism is refused:** drop the `Max` column and state each component without a
  number (the architect's own §4.6 fallback). I will not sign copy that asserts five engine constants
  nothing checks — the same refusal I made against "69 tracked names", applied consistently.

**One clause the page must gain, because the arithmetic is visible and the design's table omits it.** The
five maxima sum to **106**, and a reader who adds them up is owed the reason they do not sum to 100:

> `The components can total more than 100; the score is capped at 100.`

True at `signals.rs:490` (`(proximity + vol + setup + transition).min(100.0)`) and `:458`
(`(drivers.total + dp_bonus).min(100)`), and it rides the same test.

**One optional clause, and the condition on it.** The proximity row's `Max` is the top of a linear ramp,
not a plateau — full at the level, zero at 3% away (`FAR_LEVEL_PCT: f64 = 0.03`, `signals.rs:13`). If the
lane states it, the "What it reads" cell becomes `how close the mid sits to a level that matters — full
at the level, nothing at 3% away`, and `FAR_LEVEL_PCT` joins the same test's constant set. **If the lane
declines to pin a sixth constant, the clause is dropped and the row keeps the design's own words.** A
number stated is a number pinned, or it is not stated.

**Evidence.** `libs/quant-engine/src/signals.rs:13,23-24,454-462,467-499,541` ·
`design/src/screens/methodology.mjs:42-46` (the table, and the section prose "The score is a capped sum
of plain components") · `BRIEF.md:15` ("Frontend only; `apps/api` diff stays 0 on this branch") ·
`DESIGN_SYSTEM.md:205` ("Source-scans use Vite `?raw` and must be mutation-tested").

---

## Withdrawals I am recording in this round

Four claims of mine leave the council, so no build lane inherits them:

1. **"the figure cell" and "`Refused`" as landing primitives** (`60b85e24`) — one for the dependency
   direction, one because the affordance it would wrap is deleted.
2. **"Nine rows"** as AC-U20's wording (`d1a94c99`) — the canon forbids asserting a count; set-equality
   to the shipped union replaces it.
3. **The claim that `RequireAuth.tsx:84` is an identity assertion** (`4bff0a56`) — it is a policy
   statement and it stays in every branch.
4. **`AC-U5`'s "or the word 'live' applied to itself"** (`206a60b3`) — a distinction a scan cannot make;
   split into a structural half and a review half.
