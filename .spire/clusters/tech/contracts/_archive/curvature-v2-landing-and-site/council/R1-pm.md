# R1 — pm position: curvature-v2-landing-and-site

## Position

I own the product layer only: who the surfaces are for, what is In / Out / Future-dated on each of the
six, what each affordance promises, and acceptance criteria a stranger can check without reading code.
Nothing below chooses a component, a layout, a library, or a data shape.

---

### 0. Ground truth I read at source (three BRIEF premises do not survive it)

`[cited-code-is-verified-not-assumed]`. Every line here was read this round, not carried from the
BRIEF.

| # | What the BRIEF / context says | What the bytes say |
|---|---|---|
| 0a | Feasibility (3): "`/` for a signed-in user redirects to the default ticker (`app.tsx:131`) — keep" | **False.** `app.tsx:148` is `<Route index element={<Landing />} />` with the comment "`/` is still NEVER a redirect to a ticker." The redirect at `app.tsx:127-132` belongs to the **`/ticker`** route bound at `app.tsx:150`, not to `/`. **A signed-in trader hitting `/` gets the marketing landing today.** This is an open product decision, not a settled one. |
| 0b | "the gated Scanner shows the design's auth wall" reads as new gating | The gate **already ships**: `app.tsx:156-165` wraps `/positions` and `/scanner` in `RequireAuth`, and `RequireAuth.tsx:36-40` already carries the design's exact unlock sentence. This phase is a **re-composition of an existing wall**, not an access-policy change. PROJECT_CONTEXT §5's "anonymous browsing (Landing/Ticker/Scanner) is unchanged" is **stale**; `OPEN_THREADS §7ac:1184-1186` is current. |
| 0c | The landing sells a create-an-account path | **Sign-ups are closed, failing closed** (`OPEN_THREADS §7ac:1177-1183`). The refusal reaches the visitor **only after they type an email and a password and submit** (`AuthDialog.tsx:115-118` → `copy.ts:28` "New sign-ups are closed while Convexa is in private testing."). |
| 0d | — | The scanner's server read **refuses signed-out callers** (`OPEN_THREADS §7ac:1184-1186`). With `apps/api` diff pinned at 0, **an anonymous landing cannot show real scanner data.** |
| 0e | "`app.tsx` has no `*` route today" | **True** (`app.tsx:138-182`). Observed consequence: a mistyped address renders the nav and an **empty body** — no message, no way forward. |
| 0f | "Lab and Blog are reachable from the footer on every full page" | **Not today.** `Footer` is rendered by `Landing.tsx:238` and by nothing else; `AppShell.tsx:108` renders nav + outlet only. The design carries the footer block on **nine** full pages (`design/site/{landing,desk,scanner,positions,alerts,settings,blog,methodology,lab}.html`). |
| 0g | Invariant watch names "the cream blog palette" as the slop-tell to kill | **Already dead.** `apps/dashboard/public/blog/how-we-read-dealer-structure.html:33-39` is ink `#0B0F17` on `#E9E4D6`, Plex + Archivo, self-hosted faces. The design's own note ("The cream page and system font found in the July review are retired") describes a **done** state. Do not spend this phase there. |
| 0h | — | **No `<noscript>` exists anywhere in `apps/dashboard`.** `index.html:94-97` is an empty root div plus a module script. **JavaScript blocked ⇒ the acquisition surface is a blank page.** |
| 0i | — | `index.html:52,65` still ship the v1 hook — "See the AI read on your real positioning" — as the Open Graph and Twitter title. Every share of `/` promises the **old** landing. |
| 0j | "the waitlist … the design does not contain" | The design **does** contain one sentence: `landing.html:193` "Brokerage connect (read-only) is coming — <a>get notified</a>." What it does not contain is today's *interactive* waitlist (`Landing.tsx:224-233` button → `:240-247` acknowledgement toast, copy at `:46`). The distinction decides the ruling (P-6). |
| 0k | methodology "eleven sections" | The artboard has **ten** `h2` sections and a ten-entry "On this page" nav (`methodology.html:54-107`). The count to pin is the artboard's, not the BRIEF's. |

---

### 1. User stories

**The first-time visitor (anonymous, no account, cannot get one — sign-ups are closed):**

- **S1** As someone who landed on Convexa from a link, I want the first screen to tell me what it reads
  and what it costs me to try, so I can decide in one screen whether to open a ticker.
- **S2** As a sceptical options trader, I want to see the product's own instrument rather than an
  illustration of one, so I can judge whether the read is real.
- **S3** As a visitor, I want the one big action on the page to actually work without an account, so my
  first click is not a refusal.
- **S4** As a visitor, I want to know what the app will *never* do (place an order, claim live when it
  is a snapshot, assert a number it cannot trace) before I trust it with my reasoning.
- **S5** As a visitor who wants proof, I want a route from the landing to the long explanation — the
  methodology and the blog — without hunting.
- **S6** As a visitor who cannot sign up, I want to learn that sign-ups are closed **before** I fill in a
  form, so I do not experience a rejection I could have been spared.
- **S7** As a visitor on a phone, at low bandwidth, with JavaScript blocked, or with an old browser, I
  want at minimum to learn what this product is and where to read about it.

**The returning trader (invited, signed in):**

- **S8** As a returning trader, I want `/` to take me toward my desk rather than re-pitching me a
  product I already use.
- **S9** As a trader who follows a stale bookmark or mistypes a path, I want to be told there is nothing
  at that address and be handed a way back to a symbol — not a blank page.
- **S10** As a trader whose session expired, I want a gated surface to say what it is and what unlocks
  it, and to still offer me the free ticker so I am never dead-ended.
- **S11** As a trader who is about to size a trade off Convexa's numbers, I want the methodology page to
  state the score's components, the two data clocks, and where the read is weak — including what the
  score deliberately does **not** consume.
- **S12** As a trader reading any absence literal on the desk, I want one page that defines the closed
  vocabulary so `—`, `unavailable` and `not given` are never guesses.

---

### 2. Scope — In / Out / Future-dated, by surface

#### 2.1 Landing (`/`)

**In**
- The design's section inventory and order, and only it: **hero → structure field → triage score → AI
  read → "Numbers say where they came from" → the three trust cards → the CTA band** (`landing.html`
  57, 117, 150, 166, 183, 190). Seven sections. The inventory is the deliverable, not a suggestion.
- Exactly **one** hero instrument (canon `DESIGN_SYSTEM.md:52,113`).
- The three trust promises as *named* cards: **Snapshot, never live · Simulated, always · Advisory,
  never an order** (`landing.html:186`).
- The hero's honest qualifier — "Built for 7–45 DTE swing trades with optional intraday timing. An
  analysis tool; every trade is simulated." (`landing.html:69`).
- The primary CTA **opens a ticker** (free, ungated). The secondary CTA goes to the long explanation.
- The CTA band's promise "Open any ticker. No account, no card." (`landing.html:192`).
- A `<noscript>` statement of what Convexa is plus a working link to the static article (0g/0h).
- Document title, meta description and share (Open Graph / Twitter) **text** re-cut to the v2 promise
  (0i).
- A signed-in visitor's experience of `/` — ruled at P-8.

**Out (this phase, with reason)**
- **The "What works today" spine** (`Landing.tsx:133-210`) and its four value cards. Superseded by the
  design's four narrative sections. It is a feature list; the design sells a read.
- **The brokerage waitlist affordance** — the "Notify me" button and its acknowledgement toast
  (`Landing.tsx:224-233,240-247`). It acknowledges a subscription that nothing records. See P-6.
- **"The desk right now" strip** (`landing.html:90-115`) — five ticker cards with prices, tiers,
  sparklines and pulsing live dots. Cut for this phase. Three independent reasons: (i) the BRIEF's own
  section inventory omits it; (ii) real data is impossible here — the scanner read refuses signed-out
  callers and `apps/api` is frozen (0d); (iii) as a frozen sample it would carry five live chips and
  five pulsing dots on a static surface, which canon rejects outright (`DESIGN_SYSTEM.md:73` — "A
  'live' chip or pulse on a snapshot surface … Liveness is a claim").
- A second orchestrated motion moment (`[single-motion-moment]`).
- A new share image asset (`og-image.png`). Asset production is not this lane.

**Future-dated**
- The desk strip returns **when, and only when, an anonymous visitor can read real scanner rows** —
  i.e. after a backend lane reopens that read, or after the owner reopens sign-ups and the strip moves
  behind the wall. Restoring condition stated so a later session does not have to re-derive it.
- The "get notified" affordance returns when there is a destination that records something (P-6).
- A refreshed share image.

#### 2.2 Blog index (`/blog`)

**In**
- The v2 index composition: eyebrow, "How we read structure", the intro sentence (`blog.html:44-45`),
  one **published** read (`How We Read Dealer Structure`) with its tag, dek and "Read the post →", and
  the two **named, explicitly unpublished** slots — "Why a no-trade read is a complete answer" and "Two
  clocks: tape, structure, and what 'live' means" (`blog.html:74`).
- The published card leads to the standalone article document, which already carries the v2 palette
  (0g) — so no v2 surface hands off to a v1 page.

**Out**
- **Writing either draft article.** Naming a post is not owing one this phase.
- Re-skinning the article template (already done — 0g).
- Tags, authors, dates, pagination, RSS, search.

**Future-dated**
- The two named articles. Until then the slots must read as *not yet written*, never as *loading* and
  never as a link.

#### 2.3 Methodology (`/methodology`)

**In**
- The artboard's **ten** sections in the artboard's order (0k), which changes both the count and the
  order shipping today (`MethodologyPage.tsx:15-20` renders six, and leads with dealer structure rather
  than the two clocks): **Two data speeds → Dealer structure → Flip vs walls → Score and tier →
  Advisory reads → AI read and grounding → Simulation → Where the read is weak → What Convexa never
  does → Vocabulary.**
- The four **new** sections' copy: Advisory reads, AI read and grounding, Simulation, Vocabulary.
- The **score component table** (five rows, each with its cap) and the "Honest scope" note that today's
  score consumes neither vol-normalized GEX nor the IV-rank band (`methodology.html:90-93`) — the
  single most trust-bearing paragraph on the site, because it is the app admitting a limit nobody would
  have found.
- The **vocabulary table** of absence literals (`methodology.html:106-107`).
- An on-this-page index, so a trader can reach "Where the read is weak" without reading nine sections.
- The existing closing actions and the disclaimer (`copy.ts:97-99,11-13`).

**Out**
- Any number on this page that is not traceable to a source someone read this phase (P-10).
- The clause "reviewable in full from 'What's sent'" (`methodology.html:98`) — see P-9.

**Future-dated**
- `whats-sent`, `flows`, `persona`, `operator` as shipped surfaces. I rule them **documentation
  artboards** for this phase (BRIEF open item 2), because the only thing making one of them look
  shipped is a sentence on this page that I am cutting.

#### 2.4 Route fallback and 404

**In**
- A **catch-all**: any address that is not a route renders the 404 composition inside the shell —
  `404` · "Nothing at this address." · "The desk is one symbol away. Ticker analysis is free; the rest
  is behind a sign-in." · **Open the Ticker** (primary) · **Home** (secondary) (`not-found.html:33`).
- The 404 keeps the nav and the footer. It is a place in the product, not an exit.
- The route-loading state: quiet, named ("Loading the Scanner…"), and **not shown for a fast chunk**
  (`not-found.html:32` — "under 300ms it never shows"). A flash of a spinner on every navigation is a
  worse product than a 200ms wait.

**Out**
- A server/CDN-level 404 document, redirect rules, or a "did you mean" suggester.
- Recovering a legacy address by guessing. A route that once existed and no longer does gets the 404
  (P-11) — it does **not** silently land somewhere plausible.

**Future-dated**
- Search-from-404 (typing a symbol straight into the 404). Wants the command palette; not this phase.

#### 2.5 Auth wall + sign-in dialog

**In**
- The wall's v2 composition for the two gated surfaces: the **Private testing** marker, the headline
  naming the surface ("The Scanner needs a sign-in."), the unlock sentence, the sign-in action, and the
  **free path always beside it** (`auth.html:52-64`).
- The dialog's stated behavior: it opens over what you were doing, the surface behind it keeps
  updating, closing it leaves you where you were, and errors appear **under the field, not as a toast**
  (`auth.html:51`).
- The dialog's footer promise: "Ticker analysis stays free — open any symbol without an account.
  Signing in unlocks the Scanner, a persisted sim book and AI reads on your own key."
  (`auth.html:47`).
- **Honest create-account state**: sign-ups are closed, and the visitor learns it **before** typing
  (P-7). This is the one place I am overriding the design source, which shows an ordinary
  "Create your account" tab and an ordinary "Create an account" button.

**Out**
- Changing who is gated. `/scanner` and `/positions` stay gated; landing, `/ticker/*`, `/blog`,
  `/methodology` stay public (0b).
- Reopening sign-ups. That is an owner/ops decision with a real cost, not a frontend one.
- Password reset, email verification, magic links.

**Future-dated**
- A full-page `/auth` route (owner-dropped at the redesign; the dialog stands).
- The open-signups variant of every create-account affordance — one flip, already scoped by P-7.

#### 2.6 Footer

**In**
- The footer on **every full page** the visitor can reach, not just `/` (0f), carrying **How Convexa
  works · Blog · Lab**, the simulated/read-only/not-advice disclaimer, and the copyright
  (`landing.html:198-206`, canon rule 19 `DESIGN_SYSTEM.md:174`).

**Out**
- The design's footer **theme control** (Dark / Light / System, `landing.html:205`). The theme is a
  durable per-account preference owned by Settings; a second control for the same preference in the
  chrome of every page is a second source of truth for a stored value, and the phase has no budget to
  reconcile the two. Flagging it: **the owner can overrule me cheaply**, and if they do it must write
  the same preference Settings writes, not a separate one.
- Newsletter, social, status page, legal sub-pages.

---

### 3. Product behavior — the rulings

- **P-1 · The primary action is the free one.** The landing's primary CTA opens a ticker. Today's
  primary CTA is "Open Scanner →" (`Landing.tsx:108-116`), and for an anonymous visitor — the only
  audience the landing has — it lands on a sign-in wall. **The single most valuable change in this
  feature is that the biggest button on the acquisition page stops refusing the person who clicks it.**
- **P-2 · The trust band is a promise about the whole product, not the landing.** "Snapshot, never
  live" means structure recomputes on a stated cadence and prices stream and are labelled as tape.
  "Simulated, always" means paper, no slippage, no broker. "Advisory, never an order" means the read
  runs on your key, pins to a snapshot, and you confirm every paper trade. If any of the three stops
  being true elsewhere in the app, this page becomes a lie — so all three are ship-blocking copy.
- **P-3 · Every visual on the landing is either the one hero instrument or a *labelled sample of a real
  product surface*.** Nothing decorative, nothing invented. Canon `DESIGN_SYSTEM.md:113` bans a second
  illustration; the trust band bans a false live claim. Concretely: **the words "live", a live chip,
  and a pulsing dot do not appear on `/`** — not on the hero panel (`landing.html:73`), not on the
  structure-field sample (`landing.html:125`). Each sample panel is marked as a sample once, and that
  mark governs every number inside it — including the AI-read card's `$420`, `568.50` and `579.50`
  (`landing.html:177`), which are illustrative and must never read as a produced verdict.
- **P-4 · The landing makes no network claim it cannot keep.** `/` performs no data read (today's
  landing already performs none — `Landing.tsx:2-3`). Whatever the hero instrument turns out to be, the
  landing does not become the first page that needs the API to say something true.
- **P-5 · The AI-read section describes the *type register* as the honesty mechanism** — a figure that
  traces to Convexa reads in one register, a figure the model asserted and we could not trace reads in
  another (`landing.html:170`). This is the only claim on the landing that a reader can verify inside
  the product in ten seconds, so it must be stated exactly and must match what the desk actually does.
- **P-6 · The brokerage waitlist is cut; the sentence survives without an affordance.** Today's "Notify
  me" opens a toast saying "Thanks — we'll let you know when brokerage connect is live"
  (`Landing.tsx:46`) while recording nothing and promising a notification nobody can send. The design's
  own `get notified` link has no destination (`landing.html:193`). Ruling: the landing may **state**
  that brokerage connect (read-only) is coming; it may not offer an action that pretends to enrol you.
  Restoring condition: a destination that records the address.
- **P-7 · A closed door is disclosed before the knock.** While sign-ups are closed, every
  create-an-account affordance — on the landing CTA band, on the auth wall, and in the dialog — states
  "private testing / new sign-ups are closed" **at the point of the affordance**, before any field is
  filled. Today the reason arrives only after submit (0c). The precedent is already in this codebase:
  the Google button ships *present-but-disabled-when-unconfigured* rather than failing on click
  (PROJECT_CONTEXT §2b). The refusal copy itself is already right (`copy.ts:25-28`) — it is the
  *timing* that is the defect. **This makes the landing's "Sign up when you want the Scanner…"
  sentence (`landing.html:192`) conditional copy, not a constant.**
- **P-8 · The signed-in trader's `/` — the decision I am flagging loudest.** The BRIEF says "keep" a
  redirect that does not exist (0a). Three coherent options: **(a)** keep today's behavior, `/` is the
  landing for everyone; **(b)** `/` sends a signed-in trader to their default ticker; **(c)** `/` stays
  the landing but a signed-in trader gets a "resume" affordance to their default symbol instead of the
  create-account CTA. **My position is (c).** (a) makes the returning trader re-read a pitch every time
  they type the bare domain; (b) makes the product's own front door unreachable to the person most
  likely to send someone the link, and it fights the existing, deliberate comment "`/` is NEVER a
  redirect to a ticker" (`app.tsx:147`). (c) keeps one address, one composition, and swaps only the
  action — which is the smallest honest change. **This is a priority/value call and belongs to the
  owner** if the council disagrees.
- **P-9 · The methodology page promises no surface that does not exist.** The clause "reviewable in
  full from 'What's sent'" (`methodology.html:98`) ships **only** if a "what's sent" surface ships in
  this phase. It does not (§2.3 Future). The sentence keeps its substance — what leaves the machine,
  itemised — and drops the pointer.
- **P-10 · Every number on the methodology page is traceable to a source read this phase.** The score
  table asserts caps of 40 / 25 / 25 / 10 / 6. Four of those match the constants PROJECT_CONTEXT §5
  records (`40/25/25/10`); **the dark-pool cap of 6 I could not verify from the context I hold** — the
  context pack calls it "a small capped confluence bonus" and never states the cap. A trust page that
  invents one number destroys the credibility of the nine it got right. Ruling: each row is verified
  against the engine or the row is dropped; no row is estimated.
- **P-11 · The vocabulary table says what kind of list it is.** The design lists six literals
  (`methodology.html:107`). The app's closed absence vocabulary is wider — `positions-legs` shipped
  four render literals including `not recorded` and `no basis` (PROJECT_CONTEXT §5
  `[absent-is-not-none]`). A table a reader takes for the closed set, that is not the closed set,
  teaches them to mis-read the two it omits. Ruling: either the table is complete, or it says in one
  clause that it is a selection. Silence is the one option that is not available.
- **P-12 · A route that exists in the old app but not in the design is not silently rehomed.** It
  either keeps its route or it 404s with the standard offer. No quiet redirect to a "close enough"
  page — that is how a bookmark becomes a lie.

---

### 4. Acceptance criteria

Each row is one observable outcome, checkable by a stranger with a browser and the design source.
Degraded states are their own rows. `Verify by` is risk-based (`spire-tech-risk-based-verify`), not
one-test-per-row: **AC-L1, AC-L4, AC-L5, AC-F1 and AC-N1 are together protected by one structural
inventory check plus one end-to-end journey** — do not commission five suites.

**Ship-blocking:** AC-L1, AC-L2, AC-L3, AC-L4, AC-L5, AC-L6, AC-A1, AC-A4, AC-N1, AC-M2, AC-F1, AC-G1.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L1** | S1 | Loading `/` presents exactly the seven design sections, in the design's order — hero, structure field, triage score, AI read, "Numbers say where they came from", the three trust cards, the CTA band — and no eighth section. | test |
| **AC-L2** | S1 | `/` contains no "What works today" heading and no value-card grid of shipped surfaces. | test |
| **AC-L3** | S4 | `/` contains no control that acknowledges, enrols, or thanks a visitor for a brokerage-connect notification; the page may state that brokerage connect (read-only) is coming as text only. | test |
| **AC-L4** | S2 | `/` renders exactly one hero instrument and no second illustration; every other visual on the page is a labelled sample of a surface that exists in the product. | test |
| **AC-L5** | S4 | On `/`, no element renders a live indicator, a pulsing status dot, or the word "live" as a claim about the data shown. | test |
| **AC-L6** | S3 | Clicking the landing's primary call to action as a signed-out visitor opens a ticker page showing structure for a symbol — it does not present a sign-in wall. | test |
| **AC-L7** | S4 | The trust band on `/` names all three promises in the product's words: snapshot-never-live, simulated-always, advisory-never-an-order. | review |
| **AC-L8** | S1 | The hero states the horizon and the disclaimer — that Convexa is built for 7–45 DTE swing trading, is an analysis tool, and that every trade is simulated. | review |
| **AC-L9** | S5 | From `/`, a visitor reaches the methodology page in one click from the honesty section, without using the footer. | review |
| **AC-L10** | S1 | The document title and the description and share-preview text served for `/` describe the v2 promise; none of them still reads "See the AI read on your real positioning". | review |
| **AC-L11** | S7 | With JavaScript disabled, loading `/` shows a readable line naming Convexa and a working link to a document that renders without JavaScript. Today it shows a blank page. | review |
| **AC-L12** | S2 | With JavaScript enabled but the hero instrument unable to render on the visitor's device, the hero still presents its headline, its sentence, and its primary action — the section does not collapse to empty space. | test |
| **AC-L13** | S7 | At 393, 834, 900 and 1280 px wide, `/` produces no horizontal overflow and every call to action remains reachable. | test |
| **AC-L14** | S8 | A signed-in trader loading `/` is offered a way back to their desk in place of the create-an-account action. (Blocked on P-8 if the owner rules otherwise.) | test |
| **AC-B1** | S5 | `/blog` presents one published read with a "read the post" action, and two named slots each labelled as not yet published. | review |
| **AC-B2** | S5 | Activating the published read opens the article; the article renders in the product's dark ink palette and product faces, not a cream page in a system font. | review |
| **AC-B3** | S5 | Neither unpublished slot navigates anywhere, and neither presents itself as loading, coming shortly, or dated. | test |
| **AC-M1** | S11 | `/methodology` presents the ten design sections in the design's order, beginning with the two data speeds. | test |
| **AC-M2** | S11 | The score section presents each scoring component with its cap, and every stated cap matches the engine's constants. A component whose cap cannot be verified against the engine is absent from the table rather than estimated. | review |
| **AC-M3** | S11 | The score section states, in the visitor's reading path, that the score consumes neither vol-normalized GEX nor the IV-rank band. | review |
| **AC-M4** | S12 | The vocabulary section defines each absence literal it lists, and either lists every literal the app can render or states that it is a selection. | review |
| **AC-M5** | S11 | `/methodology` names no product surface a visitor cannot reach from the running app — in particular it contains no pointer to a "what's sent" screen. | test |
| **AC-M6** | S11 | From `/methodology`, a reader reaches "Where the read is weak" without scrolling through the preceding sections. | review |
| **AC-M7** | S11 | The closing disclaimer states that Convexa is an analysis tool, that simulated positions are paper, that a connected brokerage is read-only, and that this is not investment advice. | review |
| **AC-N1** | S9 | Loading an address that matches no route renders the 404 composition — the code, "Nothing at this address.", the free-ticker sentence, an action that opens a ticker, and an action that returns home — with the navigation still present. Today this address renders an empty body. | test |
| **AC-N2** | S9 | The 404 states that ticker analysis is free and that the rest is behind a sign-in, so a visitor learns the access model at the moment they are lost. | review |
| **AC-N3** | S9 | Activating the 404's primary action opens a ticker page for a real symbol. | test |
| **AC-N4** | S10 | Navigating to a page whose code has not loaded yet shows a quiet named loading state that identifies the destination; a navigation that completes quickly shows no loading state at all. | review |
| **AC-N5** | S9 | An address that a previous version of the app served, and that no longer exists, renders the 404 rather than redirecting to a different page. | test |
| **AC-A1** | S10 | A signed-out visitor opening a gated surface sees a wall that names the surface, states the private-testing status, states what signing in unlocks, offers a sign-in action, and offers a working link into the free ticker. | test |
| **AC-A2** | S10 | The wall never appears for a signed-in trader, including on the first load of a gated surface before the session read has resolved — the trader does not see the wall flash and disappear. | test |
| **AC-A3** | S10 | While the session read is failing or unavailable, a gated surface still resolves to either the surface or the wall; it never leaves the visitor on an indefinite blank. | test |
| **AC-A4** | S6 | While sign-ups are closed, every create-an-account affordance — landing, wall and dialog — states that new sign-ups are closed before the visitor types anything. | test |
| **AC-A5** | S6 | If a visitor nonetheless submits a create-account attempt while sign-ups are closed, the refusal states the policy and does not read as a temporary fault or invite a retry. | test |
| **AC-A6** | S10 | Sign-in errors appear beside the field or form that caused them and remain readable; nothing important is announced only in a disappearing toast. | review |
| **AC-A7** | S10 | Dismissing the sign-in dialog returns the visitor to the surface and scroll position they were on, with nothing lost. | test |
| **AC-A8** | S3 | Ticker, landing, blog and methodology remain reachable signed-out; scanner and positions remain gated. Nothing in this feature widens or narrows that set. | test |
| **AC-F1** | S5 | From every full page a visitor can reach — landing, ticker, scanner, positions, alerts, settings, blog, methodology, lab, and the 404 — the footer offers Blog, Lab and "How Convexa works". | test |
| **AC-F2** | S4 | The footer on every one of those pages carries the simulated / read-only-brokerage / not-investment-advice disclaimer. | test |
| **AC-F3** | S5 | The footer's Blog and Lab links open those pages; the top navigation continues to carry only the four product links and does not re-acquire Blog or Lab. | test |
| **AC-G1** | S7 | Across the four pages in this feature, the accessibility gate reports zero waivers. | test |
| **AC-G2** | S7 | With reduced motion requested, the landing presents its hero instrument as a static frame and introduces no second animated moment. | test |
| **AC-G3** | S8 | The existing end-to-end journeys still pass unchanged; no journey is deleted or weakened to accommodate a new composition. | test |

**Method notes.** `test` on AC-L1/L2/L3/L4/L5 is the structural inventory the BRIEF already asks for
(`structural-over-prose-enforcement`) — one check that fails if a section is added, removed, reordered,
or if a banned element reappears; it must be shown to bite by poisoning it, or it is not enforcement.
`review` rows are copy and static presence, where a human on a normal pass would notice a regression.
AC-M2 is `review` deliberately: the fact being checked is agreement between a sentence and an engine
constant, and `apps/api` is frozen this phase — an automated cross-check would either import the
backend or assert a hard-coded number against another hard-coded number, which proves nothing.

---

## Risks I see

1. **The landing is the one page where a design source and a canon rule contradict each other in
   writing.** `landing.html` puts live chips and pulsing dots on five ticker cards, on the hero panel
   and on the structure-field sample; `DESIGN_SYSTEM.md:73` says a live chip on a snapshot surface is
   rejected because "Liveness is a claim". If nobody rules, the build will faithfully reproduce the
   artboard and ship a marketing page that claims a stream it does not have — on the same page as the
   words "Snapshot, never live". My ruling is P-3; I expect this to be the loudest R2 argument.
2. **The create-account funnel currently ends in a 403.** Every surface in this feature invites an
   account. Sign-ups are closed and fail closed. If P-7 is not adopted, this phase *increases* the
   number of places that lead a stranger to a refusal, and does it on the acquisition surface.
3. **The signed-in `/` question is unowned.** The BRIEF resolved it against a line of code that does
   something else (0a). If R4 synthesizes "keep the redirect", the synthesizer will be specifying a
   behavior change while believing it is preserving one.
4. **The methodology page is where this feature can do real harm.** It is the only surface that makes
   checkable factual claims about the engine — caps, cadences, bases, a closed vocabulary. Four new
   sections of copy, written in one phase, against a backend nobody is allowed to touch, is exactly the
   setup for a confidently wrong number on the page a trader reads before sizing. P-10 and P-11 exist
   for that; they will feel like friction and should be held anyway.
5. **"Every full page gets the footer" quietly touches every page in the app.** Ten surfaces, including
   three dense desk pages that have never had a footer. The product risk is not the footer — it is that
   a change of that reach lands in the phase whose acceptance surface is "four pages", and its
   regressions surface on pages nobody in this feature was looking at.
6. **The section inventory is the deliverable, and inventories rot silently.** A later phase adding a
   section to `/` will not feel like a violation to whoever adds it. If the inventory check is not
   proven to bite, "no waitlist" and "one hero instrument" degrade to prose within two features — the
   precise failure `[structural-over-prose-enforcement]` was promoted to prevent.
7. **A blank page for JavaScript-off visitors is a defect I found rather than inherited scope.** It is
   cheap to fix and easy to argue out of scope. If it is argued out, it should be argued out
   deliberately and recorded — not omitted because nobody looked.
8. **Two draft slots on the blog are a dated promise.** They are honest today. In four months, "not yet
   published" on two named posts reads as an abandoned product. That is a content-cadence commitment
   the phase is making on someone's behalf; it belongs in the record, not in the design's footnotes.

---

## Assumptions I'm making about the other two lanes

- **A1 — The frontend can render the landing's structure-field, triage-score and AI-read samples from
  frozen, in-bundle content, with zero network reads on `/`.** If any of the three requires a live or
  fetched payload, P-4 breaks and the whole "no live claim on a marketing surface" position needs
  re-cutting.
- **A2 — Exactly one hero instrument is technically deliverable this phase, and the lanes will name
  which one.** The canon says the 3D dealer-gamma surface (`DESIGN_SYSTEM.md:52,113`), the artboard
  leads with it, and the app ships a two-dimensional hero curve. I am assuming architecture/UX resolves
  the identity and that whichever wins, it degrades to a static frame under reduced motion and still
  leaves the hero's headline, sentence and action present when it cannot render at all (AC-L12).
- **A3 — A three-dimensional hero, if chosen, does not make the landing's first paint depend on a
  large new runtime dependency or on hardware acceleration.** If it does, AC-L12 stops being a degraded
  row and becomes the common case on low-end phones, and I will argue for the two-dimensional
  instrument on product grounds.
- **A4 — A catch-all route can be added without shadowing the operator addresses.** The two operator
  addresses are declared before the shell group precisely so a catch-all cannot capture them
  (`app.tsx:139-141`); I am assuming that ordering holds and that adding a fallback does not make an
  unlinked operator surface unreachable.
- **A5 — The footer can be mounted once for the whole shell rather than page by page**, so AC-F1 does
  not become ten separate edits and one missed page. Where it mounts is architecture's call; that it
  appears on all ten is mine.
- **A6 — `apps/api` genuinely stays at diff 0**, therefore: the scanner read stays refused for
  signed-out callers, sign-ups stay closed, and no acceptance criterion of mine may depend on either
  changing. Every scope cut I made in §2.1 rests on this. If a backend lane is actually available this
  phase, the desk strip returns to the table and P-6/P-7 change shape.
- **A7 — The auth dialog can present a per-mode state (create-account disabled with a stated reason)
  without forking into a second dialog** — `[single-shared-sim-entry-dialog]`'s sibling discipline. If
  the only way to satisfy P-7 is a second sign-in surface, I withdraw the "before the visitor types"
  requirement and settle for the reason being stated on the tab itself.
- **A8 — The four disputed artboards (`persona`, `flows`, `operator`, `whats-sent`) are documentation
  and neither lane is planning to ship them.** My P-9 cut of the methodology clause assumes this. If
  architecture or UX intends to ship `whats-sent`, say so in R2 and the clause stays.
- **A9 — The existing accessibility and no-overflow suites can absorb four re-composed pages without a
  waiver**, and the 108 chromium journeys can pass against a landing whose primary action changed
  destination. If any shipped journey asserts the current "Open Scanner →" primary CTA, that journey is
  encoding a product decision I am reversing (P-1), and it should be updated rather than treated as a
  constraint on the product.
- **A10 — The blog article documents need no work this phase.** I verified the template is already
  ink/Plex/Archivo (0g). If either lane has evidence that the shipped article still renders a cream
  page anywhere, that changes the blog scope and I want it in R2.
