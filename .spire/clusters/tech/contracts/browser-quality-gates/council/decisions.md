# R3 — council decisions

## D1 — Tested browser promise

**Decision: A — engine-scoped.** Convexa's tested-browser claim is limited to the Chromium,
Firefox, and WebKit engines installed by the repository's locked Playwright release. Browserslist
may state emitted-code intent, but it is not evidence that branded Chrome, Edge, Firefox, Safari,
iOS Safari, a real device, or an assistive-technology pairing completed the journeys. Reports name
the actual Playwright version, project, and engine; hosted evidence remains `not run` until a real
hosted execution occurs.

Source: owner ruling, 2026-08-23 (`A`). Resolves the branded-browser policy conflicts raised by PM
and UX against the architect R1 position.

## D2 — Five cross-engine journeys

**Decision: A — auth and focus.** The closed five-journey matrix is: (1) public Landing→Ticker
client-side navigation with Back/Forward and route-parameter binding; (2) deterministic content-full
Ticker followed by isolated stream loss with static content retained; (3) signed-out protected-route
wall plus sign-in dialog keyboard entry, close, and return focus; (4) signed-in dense Positions at
393px with keyboard-reachable expansion/collapse and route navigation; (5) signed-in dense Scanner at
table/mobile-card widths, including its deterministic degraded state and route navigation. Settings is
covered by the accessibility matrix, not a sixth compatibility journey. Each arm runs in pinned
Chromium, Firefox, and WebKit and carries a content/readiness vacuity guard.

Source: owner ruling, 2026-08-23 (`A`). Resolves the PM-versus-UX allocation conflict while preserving
the fixed five-journey cost boundary.

## D3 — Automated accessibility matrix

**Decision: A — balanced nine-scan matrix.** Chromium axe coverage is closed to: public Landing dark;
public Landing light; populated public Ticker; authenticated Settings; dense authenticated Positions;
dense authenticated Scanner at the compact viewport; empty Scanner; Ticker cold-load error; and Ticker
stream-offline after a successful bundle with static content retained. Every scan waits for a
state-specific ready/error anchor. Axe `serious` and `critical` findings block; `moderate` and `minor`
remain present in summaries/artifacts. Zero or skipped scans fail. Every summary states that automated
WCAG-oriented scanning is not a complete manual accessibility audit or assistive-technology
certification.

Source: owner ruling, 2026-08-23 (`A`). The broader loading/stale/dialog/worker-down/validation catalogue
is future coverage, not silently bundled into this feature.

## D4 — Visual baseline inventory

**Decision: A — six risk-focused images.** The closed Chromium-only set is: (1) Landing 393×852 dark,
public default; (2) Ticker 1280×900 dark, content-full with clustered GEX markers; (3) Ticker 393×852
light, successful bundle followed by live-offline degradation; (4) Positions 393×852 dark,
authenticated dense multi-leg book with one disclosure expanded; (5) Scanner 900×900 light,
authenticated dense table with deterministic last-known rows; (6) AI recommendation analysis 393×852
light, produced dense decision with its analysis sheet open. Identity includes scenario, viewport,
scheme, state, Chromium project, Playwright/browser revision, and host platform. Baselines are evidence
under the existing design canon, never a new visual authority.

Source: owner ruling, 2026-08-23 (`A`). Resolves all mutually incompatible six/eight-case R1 manifests.

## D5 — Axe exception policy

**Decision: A — narrow, expiring waiver.** A real in-scope `serious` or `critical` product finding
always fails and enters GATE Z; it cannot be grandfathered. Only an independently proven axe false
positive or a third-party node outside Convexa's control may use a waiver, and that waiver must name the
exact rule, exact target selector, evidence/rationale, owner, removal condition, and expiry. Broad,
unowned, non-matching, or expired waivers fail the gate. Waiver mutation tests must prove each required
field and expiry are enforced.

Source: owner ruling, 2026-08-23 (`A`). Resolves the PM unconditional-GATE-Z wording against the
architect/UX constrained false-positive mechanism.

## D6 — Visual candidate and acceptance authority

**Decision: A — two-stage review.** After a visual check fails, an owner/design reviewer first inspects
the expected/actual/diff evidence and explicitly authorizes candidate generation. The update command may
then write current-platform candidate PNGs and must label them `candidate`, never `approved`. Normal code
review subsequently accepts or rejects the exact generated image bytes together with their source diff.
After acceptance, two compare-only runs must pass with no retry and no further baseline change before
merge. CI and every aggregate/check path remain structurally unable to reach update mode.

Source: owner ruling, 2026-08-23 (`A`). Resolves the sequencing ambiguity between UX's pre-update
approval wording and PM's post-generation review authority.

## Technical resolution — aggregate authority

Accepted from the architect/UX R3 exchange: one checked manifest and one aggregate Nx target own
the selected check graph. Local and hosted workflows invoke the aggregate once. Constituent gates
execute exactly once, write distinct summaries/artifact roots, and remain independently publishable;
the visual-update target is structurally unreachable from every check/CI path. Missing, duplicate,
zero-selection, or incomplete child evidence makes the aggregate non-zero.

## D7 — Accessibility findings discovered during execution

**Decision: A — authorize narrow product accessibility repairs.** The feature may amend its prior
`NO_UI_CHANGE` boundary only for the independently reproduced findings surfaced by its real browser
oracles: remove prohibited ARIA from the ticker grip or replace it with valid semantics; bring the
named ticker/context text to the required contrast; give the Settings ticker field a programmatic
label; and make the skip link move focus to `main#main-content` without leaving the route. The cold
Ticker error criterion must use honest shipped user copy rather than the unreachable test-only phrase
`Unable to load ticker test fixture.`. No layout redesign, new feature, backend change, or unrelated
copy/style cleanup is authorized. Fixture/test defects remain tooling work and do not justify product
changes.

Source: owner ruling, 2026-08-23 (`A`), after read-only reproduction classified four shipped UI
accessibility defects plus the unreachable cold-error copy contract. This ruling requires a narrow
GATE Z amendment to `SPEC.md`, `INTERFACE_CONTRACT.md`, and `PLAN.md` before product edits.

## D8 — Blocking findings exposed after D7

**Decision: A — repair every reproduced blocking finding inside the already approved closed matrix.**
The feature may expand the D7 frontend source allowlist only for the independently reproduced
`serious`/`critical` or behavioral failures in the existing five journeys, nine axe scans, and seven
keyboard/reflow sequences: remove the nested score-cell tab stop from scanner card links without
removing its information; correct the named Ticker and Positions contrast surfaces; give position
sparkline tooltip content valid semantics; restore focus to the sign-in opener when the dialog closes;
and make the named Positions controls reachable/intersect the visual viewport at real Chromium 200%
page scale. This does not authorize a redesign, a new scan/journey, a lower axe threshold, a waiver,
backend changes, or unrelated cleanup.

Source: owner ruling, 2026-08-23 (`A`), after the D7 RED→GREEN pass exposed additional real product
defects. Fixture defects were repaired separately; every added product path must be tied to one exact
reproduced finding and pass focused component plus browser regression tests.
