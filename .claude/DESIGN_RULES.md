# DESIGN_RULES — the front-end design-quality canon (rule of record)

> The SINGLE source for the kit's design-quality discipline. The role prompts POINT here
> (`agents/delivery-ux` · `agents/delivery-frontend` · `agents/qa-verify` · `ROLE_LAUNCH_PROMPTS` §3/§5
> · `ORCHESTRATOR` GATE U·X / GATE V) and never restate the rules — a rule stated twice is a rule that
> drifts. Scope: every feature with a user-facing surface. §7 says which role owns which part.

## 1. The non-negotiable loop

Why a loop: the builder writes good front-end code but has **weak visual judgment on its own render**.
A prompt sets direction; only a plan → build → look → critique → fix loop compensates for that gap.
Run it every time UI is touched:

1. **Pin the brief.** Name three things before designing: the **subject** (one concrete thing), the
   **audience** (who uses it), and the **single job** of the surface. A vague brief produces the
   average; distinctiveness comes from the subject's own world.
2. **Structure before style.** First pass is clarity and hierarchy only — a rough wireframe or a
   one-line layout description, semantic structure, correct information architecture. NO color or
   type decisions yet.
3. **A compact token plan before any styling:**
   - **Color:** 4–6 named values. Commit to a dominant color with sharp accents — timid,
     evenly-distributed palettes read as generated output.
   - **Type:** typefaces for the display + body roles (+ a utility face for captions/data if
     needed), with a real scale (weights, widths, spacing) set intentionally.
   - **Layout:** the concept in one sentence (+ a rough wireframe).
   - **Signature:** the ONE element this surface is remembered by, derived from the subject's own
     world — its materials, artifacts, vernacular.
4. **Self-critique the plan before building.** Work through what you'd produce for *any similar
   prompt*. Every token choice that matches that default gets revised — and the change stated, with
   why. This step is where slop dies (check §3's tells explicitly).
5. **Build to the approved tokens exactly.** Derive every color and type decision from the plan. Do
   not improvise new colors or faces mid-build.
6. **The visual verification loop — MANDATORY.** After building (and after any UI change): run the
   app the standard way, open it in a browser, capture **desktop (~1440px) AND mobile (~393px)**,
   and critique your own render — spacing, alignment, hierarchy, contrast, crowding, undesigned
   empty states. Fix what you see, re-capture, and repeat until the render matches the intent.
   Never report a UI task done without having looked at the rendered result.
   - **Environment honesty:** where screenshots are genuinely unavailable, the fallback is
     *structural render verification* — rendered DOM text, computed styles, both color-schemes —
     PLUS an explicit **"not visually verified by eye"** note in the report. Never silently skip
     the step. (Per-machine browser-tooling options are setup advice, not canon — see the kit's
     `docs/DESIGN_TOOLING.md`.)

## 2. Aesthetic direction

- **Typography is the personality.** Don't make Inter, Roboto, Arial, or system faces the identity;
  Space Grotesk has become its own default — avoid over-reaching for it. Pair display + body
  deliberately; make the type treatment memorable, not a neutral delivery vehicle.
- **Commit to a cohesive palette via tokens/variables.** Vary between light and dark and across
  features — do not converge on one look.
- **Backgrounds create atmosphere** — layered gradients, geometric pattern, contextual texture —
  not flat solids by default.
- **ONE orchestrated motion moment** (e.g. a staggered load reveal) beats scattered
  micro-interactions. Respect `prefers-reduced-motion`, always.
- **Structure encodes meaning.** Numbered markers (01/02/03), eyebrows, and dividers only when the
  content genuinely is a sequence — never as decoration.
- **Match execution complexity to the vision.** Maximalist directions need elaborate execution;
  minimal directions need precision in spacing, type, and detail.

## 3. Known AI-slop tells (defaults, not choices)

These appear regardless of subject; avoid them unless the brief explicitly asks. Where the brief
leaves an axis free, do not spend that freedom on:

- Cream background (~#F4F1EA) + high-contrast serif + terracotta/warm-clay accent (esp. ~#D97757).
- Near-black background + a single acid-green or vermilion accent.
- The broadsheet look: hairline rules, zero border-radius, dense newspaper columns.
- Purple/violet gradients on white.
- Predictable layouts and cookie-cutter component patterns with no context.

## 4. Restraint

Spend boldness in ONE place — the signature element — and keep everything around it quiet and
disciplined. Before finishing, take one accessory off: cut the piece of decoration that serves the
vision least. Over-decoration and excess animation are themselves tells that a design was generated.

## 5. The quality floor (never skip)

- Fully responsive down to mobile.
- Visible keyboard focus states on all interactive elements.
- `prefers-reduced-motion` respected.
- Semantic HTML, labeled inputs, proper heading hierarchy, adequate color contrast, touch targets
  sized for mobile.
- CSS-specificity footgun: broad section-level selectors and element-level selectors can cancel each
  other out — especially on section padding/margins. Verify section rhythm in the render; don't
  assume the cascade.

## 6. Copy is design material

- Write from the user's side of the screen: name things by what people control ("notifications"),
  never by how the system is built ("webhook config").
- Active voice on controls ("Save changes," not "Submit"); keep an action's name consistent through
  the whole flow ("Publish" → toast says "Published").
- Errors say what went wrong and how to fix it — no apology, no vagueness. Empty states invite
  action.
- Sentence case, plain verbs, no filler. Each element does exactly one job.

## 7. How this binds the roles (the pointer contract)

- **UX** owns the front half of §1: the brief-pin, the structure pass, and the token plan +
  self-critique — recorded as the design-direction subsection of `SPEC.md` §4, which the build lanes
  read directly.
- **FRONTEND** builds to the token plan exactly (§1.5) and runs the visual verification loop (§1.6)
  before reporting done — the report names what was captured and critiqued, or carries the explicit
  fallback note.
- **QA** verifies the §5 quality floor as part of the GATE Q sweep — review-kind under the
  risk-based rule (`qa-verify` §4) unless a case is marked `test:`.
- **GATE V** (the visual fast-path) and **GATE U·X** read this file as part of their audit sets.
