# R3 — ux response: tradeable-rec-inputs

> One capped exchange. Binding wording below feeds R4 synthesis directly.

## b3fb59df

**ACCEPT** — "Match on the full identity or refuse to match," with the architect's structural
constraint adopted verbatim and one wording correction inside their own option (c).

I withdraw my R1 assumption sentence as an assertion of fact. **"The rec identifies its recommended
contract in a machine-comparable form (strike + expiration + right)" is not true of the shipped
schema** (`apps/api/src/services/llm.rs:124-131` carries strikes + expiration and no right token).
It becomes a *requirement with a specified degradation*, not an assumption.

### Binding

1. **The match key is one type carrying strike + expiration + right, and it cannot be constructed
   without a right.** No code path in this feature renders a per-contract quote from a partial key.
   Structurally impossible, per the architect's constraint — not a convention.
2. **Preferred: the rec response carries an explicit right token** (closed: `call` | `put` |
   `undetermined`). This is my open conflict 7d61862 and the architect answers it this round; if the
   schema field lands, U-20 stands as written and the fact line renders exactly one leg.
3. **If no right token ships**, the cited-contract fact line degrades through a closed three-literal
   set — never by picking a leg:

| Case | Renders |
|---|---|
| full identity present in the candidate set | `{STRIKE} {C/P} {EXPIRY} · bid {b} / ask {a} · Δ {d} · IV {iv}% · from the {as_of} chain snapshot` |
| strike + expiration present, right undetermined, **and** the wire carries both legs as one digested pair with an explicit undetermined-right token | both legs, each labelled `call` / `put`, under one line: `The read doesn't say call or put — both legs shown.` |
| strike + expiration present, right undetermined, pair **not** on the wire | `The read doesn't say call or put — no quote shown.` (no figure) |
| strike or expiration absent from the candidate set | `Not in the candidate set Convexa sent` (no figure) |

Tooltip on the middle two: `Convexa only draws a quote when it can match the exact contract —
strike, expiration and call/put.`

### The one correction inside the architect's option space

Their option (c) reads "or fall back to UX's off-set literal." **Do not.** In the
undetermined-right case the strike and expiration *are* in the set, so
`Not in the candidate set Convexa sent` would be a false statement — it renames "we can't tell which
leg you mean" as "we didn't send it." That is the exact failure class this fact line exists to
prevent. Undetermined-right gets its own literal (above); the off-set literal keeps its original,
narrower meaning.

### AC replacements for U-20 (with `Verify by`)

| ID | Criterion | State(s) | Verify by |
|---|---|---|---|
| U-20a | A cited contract whose **full identity** (strike + expiration + right) is present in the candidate set renders its quote/greeks with the set's as-of. The match is by exact identity; strike + expiration alone never selects a row. | rec `cited` | test |
| U-20b | When the rec does not state a right, the fact line renders either both legs labelled `call` / `put` with `The read doesn't say call or put — both legs shown.`, or `The read doesn't say call or put — no quote shown.` with no figure. Exactly one right is never chosen for the reader. | rec `cited-right-undetermined` | test |
| U-20c | A cited contract whose strike or expiration is absent from the candidate set renders `Not in the candidate set Convexa sent` and no quote figure; this literal never renders for the undetermined-right case. | rec `cited-off-set` | test |
| U-20d | No code path renders a per-contract quote from a match key that does not carry a right. | rec — all | test |

All four are `test`: a partial-key match reintroduced by a later refactor is silent, confidently
wrong, and invisible on review.

If the architect's R3 on 7d61862 returns "no right token, and no both-legs pair on the wire," then
U-20a/U-20b collapse to U-20c + the no-quote literal, the rec shows no per-contract quote at all,
and that is a recorded loss — not a best-effort string match behind a provenance claim.

---

## 56b47beb

**ACCEPT** — the egress fact moves into the section helper above both fields; both field helpers stay
exactly as written in R1.

PM is right and my R1 was wrong on ordering: `used only as context for AI recommendations` reads as
internal use, and the most personal number in the app sat above the disclosure. The phrase is not
softened, it is **replaced** by the plain fact.

### Binding — Settings → Risk inputs, section helper (visible, above both inputs, never a tooltip)

> These figures are sent to your AI provider with each recommendation request. Convexa never checks
> them against a broker, never enforces them, and never uses them to score anything.
> **View what's sent →**

- The egress sentence is **first** and renders above the `Account size` control in DOM and visual
  order.
- The three non-claims survive verbatim (*not verified* · *not enforced* · *not a scoring input*).
- `Open positions included: your simulated positions in this browser.` stays as its own line under
  the helper (unchanged by f1259f15 — simulated digest only).
- **`View what's sent`** reuses the shipped string (`COPY.action.viewExport`) and links to the AI
  recommendation panel of `settings.effective.defaultTicker`, which always resolves
  (`useSettings.ts:64/73`). One click from the helper to a surface where `View what's sent` is
  visible; U-26 already guarantees it is present there in every state. No new copy, no new drawer
  entry point.
- Field helpers unchanged: `Account size` keeps `The account value you want sizing based on. You type
  it; Convexa never checks it against a broker.` The egress fact is **not** repeated per field.

### AC changes (with `Verify by`)

| ID | Criterion | State(s) | Verify by |
|---|---|---|---|
| U-1 | The `Risk inputs` panel renders a section helper, above both inputs in DOM order, whose first sentence states the figures are sent to the AI provider with each recommendation request, and which names *not verified* / *not enforced* / *never used to score anything*. Both field helpers render as written. | Settings `default` / `empty` | test |
| U-1b | The section helper carries a `View what's sent` link to the default ticker's AI recommendation panel, live in the `anonymous` state as well (the export floor is anonymous-ok). | Settings `default` / `empty` / `anonymous` | review |

U-1 moves from `review` to **`test`**: this is the same egress claim as U-23, now in a third
location, and a copy edit that drops the sentence or a layout refactor that reorders the helper below
the first input regresses silently. The assertion is *presence of the egress sentence* **and**
*precedes both inputs*. U-1b stays `review` — a visible, intentional affordance.

Satisfies PM's AC-10 without requiring the account-size helper to carry the fact twice.

---

## Asks answered

**[architect] After a risk-block edit, which value is authoritative in the export drawer?**

**The as-sent values — and yes, plainly: this requires the rec response to echo the risk inputs it
was given. I need that wire field.** Specifically the rec artifact carries, pinned to itself:
account size as sent, cap `{value, unit}` as sent, and the effective dollar cap (or its
not-derivable token) as sent.

Drawer rule — exactly one set of values, always named:

- **A rec is on screen** → the drawer's `Your risk inputs` section renders the **as-sent** values,
  labelled `Your risk inputs (as sent with this recommendation)`. When they differ from what is
  stored now, the section carries the same superseded sentence as U-19: `Your risk inputs changed
  after this read. The values below are the ones sent.`
- **No rec on screen** (idle, anonymous, fresh export) → the drawer renders the **currently stored**
  values, labelled `Your risk inputs (what the next request will send)`.
- Never both, never an unlabelled set. The two are different facts and each label names its own.

Consequence the other lanes must hold: the cap comparison verdict is computed against the **as-sent**
cap, so the rec strip, the drawer and the sim-entry confirm annotation all cite one number
(consistent with c5fe2f82's "computed once, passed down as a rendered result"). This is the same
pinning PM asks of you for AC-28.

**[architect] Which single surface owns the drop-count-with-reason?**

**The export drawer's `Candidate contracts` section owns it in v1.** It is the one candidate-bearing
surface that ships regardless of the pending c134ba40 ruling. Binding line:

> `{N} contracts across {M} expirations · {K} omitted ({REASON})`

`{REASON}` is rendered by closed lookup on a wire drop-reason token (my open ask); `{K}` arrives on
the wire and is **never** computed by subtracting two counts in the browser. `K = 0` renders
`none omitted` — the absence is stated, never implied by a missing clause. Verify by `test`.

Conditional: if the owner rules c134ba40 **in**, ownership moves up to the `What the numbers said`
strip (one digested line, every verdict including `no_trade`), and the drawer keeps the same numbers
as the detailed enumeration — same wire tokens, one computation, two renderings. I will not place a
set-level candidate count on the rec surface ahead of that ruling; that is the ruling.

**[pm] With up to 3 tenors on the wire, which one does the single headline render, and where does a
trader verify a move cited for a different expiration?**

- **Ticker widget headline: the nearest in-window tenor, always exactly one** (matches AC-22). Its
  basis line names its own expiration, so it can never be read as the rec's expiration.
- **Verification surface for a differently-dated citation: the rec panel's existing `What the
  numbers said` strip** (§4e already carries the straddle-implied move there). It renders the move
  for **the expiration the rec cites**, selected by exact expiration match against the tenors on the
  wire, with its own basis line. This is one line in a strip I already own — not a second widget and
  not a per-tenor table.
- **If no tenor on the wire matches the cited expiration**: `No straddle-implied move for {EXPIRY} in
  this read.` The nearest tenor's number is **never** relabelled under another expiration — that is
  the rename failure this feature exists to end. Verify by `test`.
- **Export drawer** enumerates every tenor sent, each with its basis line.

So: **no**, this does not constrain the prompt to one tenor. Carry up to 3 on the wire (architect's
reason is right); render one on the ticker board, the cited one on the rec. Your tenor-budget
conflict (3f64a61d) stays free of my lane.

**[pm] Is the export drawer reachable without a session, and does the rec panel render anonymously?**

**Both yes — this is code-verified fact, not a design preference.**

- `GET /api/recommendation/export/{ticker}` is documented and routed as **anonymous-ok, no LLM**
  (`apps/api/src/routes/recommendation.rs:42`, `routes/mod.rs:78`).
- The `View what's sent` control lives in the Widget **header actions slot, ungated**
  (`AiRecPanel.tsx:126,182-202` — "the manual export floor stays anonymous-usable (AC-E6)").
- The rec panel itself **renders** for an anonymous user; what is auth-gated is the *ask-AI action*,
  which is replaced by the sign-in prompt (`AiRecPanel.tsx:130,356`). §0's "intended user is signed
  in" describes the primary job, not a render gate.

**AC-39 is therefore observable and I am not asking you to withdraw it.** Two conditions on it from
my lane: (a) the anonymous drawer's `Your risk inputs` section renders the explicit not-sent line
(`Not sent — you haven't set this.`) carrying whichever single literal settles cb992bd1, never an
omitted section; (b) the anonymous egress note enumerates only what an anonymous export actually
carries — no risk inputs, no positions digest — so U-23's claim stays true on both paths.

Whether the **candidates endpoint** is reachable anonymously (and thus whether the anonymous export
carries the candidate band at all) is the **architect's** fact, not mine — it is my open ask and the
architect's own ask to PM. My copy handles either answer via the not-sent line.
