```json
{
  "role": "pm",
  "agree": [
    "**`apps/api` must have an EMPTY diff.**",
    "Sixteen render sites in two files is a hand-edit, not a codemod.",
    "Adopting `cmdk` means either porting that fix a second time or shipping a known regression.",
    "**The dot is per-figure, not per-widget.**",
    "**What is not acceptable is silently dropping the encoding.**",
    "It must say *tracked*, because \"no results\" here means \"not in the scanner universe\", **not** \"this ticker does not exist\"."
  ],
  "conflicts": [
    {
      "quote": "**A \"connecting\" chip is the seventh state, and it is banned.**",
      "source": "ux",
      "why": "This makes 'the page carries no liveness claim at all' a shipped and TESTED outcome before the first stream fact, and my R-B/AC-9 rule the opposite. A trader returning to a desk cannot distinguish 'we have not been told yet' from 'everything is fine' — absence reads as fine, which is the single failure US-2 exists to prevent. It is also the one acceptance criterion in this phase that cannot be verified as written: an AC whose observable is 'nothing is on the page' passes identically when the resolver is correct, when it throws, and when the stream never opened. The invariant cited forbids showing OFFLINE during a cold start; it does not forbid stating that we are still connecting.",
      "proposal": "Owner rules between (a) the chip renders a neutral connecting/loading form until the first stream fact, or (b) the page carries no chip until then. If (b) wins, the criterion must be restated as a positive observable — every surface that will carry a chip shows a placeholder in the chip's place until the first fact — so absence is distinguishable from breakage by a human and by a test. AC-9 stands or falls on that ruling; I will not certify a criterion whose evidence is an empty region.",
      "kind": "product"
    },
    {
      "quote": "On a stream drop, a live-derived figure keeps its **last known value** at reduced opacity with the pause marker and says it is the last known value — never blanked, never replaced by a zero or a dash.",
      "source": "pm",
      "why": "WITHDRAWN. UX read at source that on a drop Net flow and Spread render the bare absence literal, not a retained figure, because they are recomputed as null whenever the stream is not delivering. AC-17 as written therefore demands a behaviour change — value retention across a drop — that neither the BRIEF nor my own scope ruling bought, and that my own framing of this phase ('this phase ships no new capability') excludes. I cannot defend an AC that requires the app to start doing something new while calling the phase foundations.",
      "proposal": "Split into two criteria so the degraded arms stand on their own: (i) a figure that DID receive a value before the drop shows that value dimmed with the pause marker and says it is the last known value; (ii) a figure that had no value at the drop shows the bare absence literal with the pause marker and says only that it is offline — never 'last known'. Then the owner rules separately whether phase 1 pays to move Net flow and Spread from (ii) into (i). Until that ruling, (ii) is the binding state for those two figures and no criterion may assert retention for them.",
      "kind": "product"
    },
    {
      "quote": "Each of the six not-a-number literals renders as small Sans text, never as a figure, and never substitutes for another member; the member count is six.",
      "source": "pm",
      "why": "WITHDRAWN in part. UX reports, and I confirmed at source, that the shipped app already renders at least three absence literals beyond the canon's six — `not recorded`, `no basis`, `not provided` — asserted by existing specs on the positions and broker surfaces, two of them cited as canonical in the project context. An AC that fixes the member count at six is either unsatisfiable against shipped code or satisfiable only by deleting shipped literals from screens this phase promised not to touch. My R-H ('no new absence word') survives; 'the member count is six' does not.",
      "proposal": "Keep the observable half — every absence literal renders as small Sans text, never in the figure register, never substituting for another member — and drop the count from the criterion. Reconciling the canon's list against the shipped set is an owner Amendment, not a build decision; until it lands, the figure primitive must classify the literal from what the caller declares rather than from a fixed six-member list, or phase 3 renders `not recorded` in the face that means 'Convexa computed this'.",
      "kind": "product"
    },
    {
      "quote": "**No burn-down of the pre-existing spacing/radius debt** beyond making it visible and fenced (§2).",
      "source": "architect",
      "why": "This is presented as build containment but it is a scope decision, and it contradicts the same position's own radius mechanism. §2 requires a per-site read of roughly two dozen bare-number radius sites because the numeric form re-scales by 1.2x, and risk 3 says the result 'will visibly change surfaces this phase claims not to touch'. So radius debt IS being burned down in part while spacing debt (86 sites across 35 files) is grandfathered with no expiry — and as one sentence it would let a build lane skip the radius sites and still claim the non-goal was honoured. Whether 'foundations' means the app is ON the declared scales or only that new code is fenced from leaving them is a value call the owner is entitled to make, especially since the architect states the M estimate depends on the answer.",
      "proposal": "Route as two separate owner calls, not one. (1) Spacing: accept a seeded 35-file exemption list as the phase-1 deliverable, with the occurrence count recorded in the build report and a named later phase that burns it down — or reject it and re-price the phase. (2) Radius: the migration is IN, and every site whose radius changes must be enumerated in the change so the per-screen and per-overlay sign-off has a list to check against rather than a reviewer's memory.",
      "kind": "product"
    },
    {
      "quote": "The migration surface is far smaller than it looks.",
      "source": "architect",
      "why": "True for the component swap — I verified only two files import the primitive, which falsifies my own R1's count of seven — but not for what the phase must DELIVER. Four widgets on the same ticker page (IvRank, DealerFlowProjection, MarketContext, StraddleMove) are 'StatTile-family' lookalikes that are not importers, and at least two of them wrap a non-focusable info icon in a hover-only tooltip (`IvRank.tsx:91`, `DealerFlowProjection.tsx:77`). If the sweep stops at the two importers, phase 1 ships a page where half the figure cards answer the info affordance to a keyboard or touch user and half do not — and my AC-35, which names the info affordance explicitly, would have to be certified as passing on a page where it demonstrably fails.",
      "proposal": "Owner rules whether phase 1 pays to give every figure-card info affordance on the ticker page a tap and focus path, or whether AC-35 narrows explicitly to the new primitive's own affordance with the remaining hover-only cards named in the build report as accepted, carried debt with a phase attached. Either is defensible. Shipping the split silently is not, because the reviewer sees a page where the tooltips work under a mouse.",
      "kind": "product"
    },
    {
      "quote": "**UX will specify the label row as: caps label, info affordance, live dot — and nothing else.**",
      "source": "architect",
      "why": "UX did not, and on the evidence could not. It found that Call wall and Put wall are distinguished today only by the directional colour this phase deletes, that the caption's sign is distance from spot rather than the wall's side, and ruled a replacement mark is required in phase 1. A label row closed to 'nothing else', combined with the deliberate refusal of any accent prop, leaves nowhere for a non-colour side mark — so the proposed shape cannot carry an outcome my scope explicitly forbids losing ('Any narrowing of what the trader can currently tell'). I am raising it rather than quietly narrowing scope.",
      "proposal": "Owner picks one and it gets its own acceptance criterion, because nothing in the current suite would notice the loss: (a) phase 1 adds a non-colour side mark so the two walls stay distinguishable in a greyscale screenshot; (b) phase 1 carries the side in the label words instead; (c) the distinction is accepted as lost and recorded as a knowing cost. My preference is (b) if (a) does not fit the effort box — it is honest and it needs no new anatomy.",
      "kind": "product"
    },
    {
      "quote": "↑↓ move, ↵ opens, ⇧↵ adds to the scan view, Esc closes.",
      "source": "ux",
      "why": "'Adds to the scan view' is a write, not a jump. My scope future-dated exactly this ('commands, recent history, actions, add-to-scan. Not now.'), the BRIEF's palette job is reaching the four surfaces and jumping to a symbol, and the architect's palette 'consumes existing reads only'. It also arrives with no degraded arm: saving a scan view is session-gated, so a signed-out trader who presses it meets a refusal neither position describes, while the helper row still advertises the shortcut. As written I cannot produce a checkable criterion for it — there is no stated success confirmation and no stated refusal.",
      "proposal": "Drop the write from phase 1 and keep the helper row to move / open / close. If the owner wants it in phase 1 it needs its own criteria — what the trader sees on success, what a signed-out trader sees instead, and whether the shortcut hint is suppressed when the action is unavailable — and the palette stops being read-only, which changes the isolation story the architect priced.",
      "kind": "technical"
    },
    {
      "quote": "With a genuinely delivering stream, the page carries **exactly one** liveness claim — counting the chip, any live dot, any pulse and any \"live\" wording — and that claim reads live and names the mid it is showing.",
      "source": "pm",
      "why": "The criterion stands; its EVIDENCE does not, and I withdraw that half. The architect verified that a correct implementation keeps a second condensed bar mounted-but-hidden, so two chip nodes are attached to the page at once, and that the check must therefore count VISIBLE claims rather than attached nodes or 'the correct implementation fails'. My completion evidence says 'a count of one across the rendered page', which in the component harness counts attached nodes and would red-build correct code — the precise hollow-automation failure I said I was guarding against.",
      "proposal": "Keep the criterion wording and move its evidence to the browser layer where visibility is real: one visible liveness claim per page, measured at the four widths in both schemes, plus a unit-level check that only one module can produce the claim at all. The unit harness may assert the resolver's output, not a node count.",
      "kind": "technical"
    }
  ],
  "asks": [
    "architect — is a per-figure fact equivalent to 'this value arrived from a delivering stream before the drop' available at render time? Without it the retained/not-retained split replacing AC-17 is not observable and the offline caption cannot be data-driven, which is exactly the caption UX refuses to write.",
    "architect — under the one-shot-read-on-open palette, is a freshness fact for the ranked results available to render? UX flags a tier and score with no as-of as a liveness claim by omission; without an answer I cannot write a checkable staleness criterion for the palette, and I will not leave that gap open.",
    "ux — is the nav 'jump to a ticker' affordance a field that accepts typing in place, or purely a trigger that opens the palette? It decides whether there are one or two entry paths to the palette's results, and a second path needs its own empty and unavailable criteria.",
    "ux — if the owner rules against an absent chip, which of the six states may render before the first stream fact, or does a loading form have to be minted outside the six? I need the answer in words a criterion can quote, not a tone.",
    "architect — after the two-file sweep, do the four StatTile-family lookalike cards visibly differ from the new figure primitive on the same page, and is that difference something a reviewer can name at GATE Q without reading source? If it is not nameable, my per-screen sign-off cannot catch it."
  ]
}
```
