# S2 — skeptic findings: browser-quality-gates

## Critical  (blocks — must loop back to R4)

- The conflict accounting is internally false and makes the required dropped-conflict check unverifiable: the conflict ledger contains 16 conflicts (4 architect + 5 PM + 7 UX), while the spec says “All 15 R2 conflicts are settled.” Although the resolution ledger currently maps 16 IDs, the normative spec does not state that complete count and a stale count can conceal an omitted conflict on a later synthesis. — evidence: `council/conflicts.json` (`conflicts.Count = 16`, 16 resolution entries); `SPEC.md:§9` (“All 15 R2 conflicts are settled”)

- AC14 makes a ship-blocking human authorization a purported test criterion without defining an externally inspectable receipt, actor, or durable decision record: “candidate generation requires explicit owner/design-review authorization” and “normal code review accepts/rejects” cannot be verified from the command, artifacts, or a repository state contract. A command can satisfy the byte-writing half while the required authorization never occurred. — evidence: `SPEC.md:§3 AC14`; `SPEC.md:§4` visual acceptance flow (“owner/design reviewer ... explicitly authorizes candidate generation”)

## Important  (should fix)

- The nine accessibility states are an inventory, not an executable state contract. The spec requires each scan to wait for a “state-specific ready/error anchor,” but never maps any of the nine states to concrete anchors, expected content, or an externally checkable state predicate. This leaves a scan able to mount the wrong or generic state while satisfying the generic readiness language. — evidence: `SPEC.md:§2` (“Each scenario record ... ready/error anchor”); `SPEC.md:§4` closed nine-scan inventory; `SPEC.md:§3 AC6` (“state-specific ready/error anchors”)

- The aggregate's Nx semantics are described as future verification rather than as a buildable, source-grounded contract. The live seam is explicitly “an inferred `dashboard-e2e:e2e` target,” and task-bail syntax is only to be “verified against locked Nx 23.1.1” later. Without the concrete target/executor and exact task-bail option, the promised sibling completion and exactly-once aggregate behavior cannot yet be established. — evidence: `SPEC.md:§2` (“an inferred `dashboard-e2e:e2e` target”; “Task-bail is disabled using syntax verified ...”); `SPEC.md:§8` (`[cited-code-is-verified-not-assumed]`)

- Platform-scoped baselines have no complete bootstrap/return-to-hosted path in the contract. Check mode fails when the current platform's baseline is absent, while update mode can write only current-platform candidates and hosted Linux evidence is explicitly `NOT RUN`; the spec does not define the required Linux candidate-generation receipt/review and baseline commit handoff before CI can become a real merge gate. A local current-platform pass therefore cannot produce the future hosted visual evidence the workflow requires. — evidence: `SPEC.md:§1` (“A recorded hosted pass ... after ... the Linux baseline set has been deliberately reviewed”); `SPEC.md:§2` visual update (“write only current-platform candidates”); `SPEC.md:§4` visual states (“missing baseline fails”)

- AC9 is not sufficiently externally determinate to be a reliable behavioral gate: “keyboard order to primary actions,” “announcements/discoverable blocking errors,” and “focused-control/no-page-overflow behavior at 393px” name broad properties but provide no route/state, element sequence, expected announcement, or pass/fail oracle. Different implementations can produce materially different checks while all claiming compliance. — evidence: `SPEC.md:§3 AC9`

## Minor / advisory

- The spec says all child summaries include engine/state/scenario identity, but the full Chromium child has no explicit identity schema for its 52-test inventory beyond the manifest identities; define the summary shape for the full-suite tier so artifact consumers do not infer identity from paths. — evidence: `SPEC.md:§2` (“Summaries record ... engine/state/scenario identities”); `SPEC.md:§2` full Chromium manifest description

## Checked and clean

- Interface mismatch: checked `INTERFACE_CONTRACT.md` and the SPEC data-flow summary; the intentionally empty `endpoints` conformance block matches `NO_BACKEND_CHANGE` and the deterministic fixture boundary.
- Component states: checked the §4 state table for default/loading/empty/error/offline-stale across quality CLI, compatibility, accessibility, visual, and candidate-update rows; each is assigned behavior (though concrete accessibility anchors remain underspecified above).
- Local-versus-hosted honesty: checked §1, §2, §4, and §5; local results are explicitly local evidence and unavailable hosted execution is the exact `NOT RUN` state, with no local PASS promoted to hosted success.
- Full-suite/compatibility overlap: checked the manifest and aggregate claims in §2, §3 AC3/AC4/AC17, and both R3 resolutions; the intended contract explicitly separates the 52-test suite from the five-journey compatibility selection and schedules each once.
- Guardrail review: checked §8 against the scope, no-update-from-check, hermetic-fixture, absent-is-not-none, and no-UI/no-backend rules; no additional direct guardrail violation was found beyond the unverified Nx attachment risk called out above.
