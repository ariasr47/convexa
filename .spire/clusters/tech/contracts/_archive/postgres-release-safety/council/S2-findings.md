# S2 — skeptic findings: postgres-release-safety

## Critical  (blocks — must loop back to R4)

- None. The prior AC28 evidence defects are repaired: repository/process validation now requires an explicit canonical repository root and exact immutable commit object, while live Railway claims are explicitly excluded from the machine receipt and must be directly reviewed at GATE S.

## Important  (should fix)

- None found after the evidence-repair review. The live-platform review has an explicit accountable class of reviewer (QA or GATE S with live host access), required deployment identity, and direct observations; it is not represented as a caller-supplied machine fact. — evidence: `INTERFACE_CONTRACT.md:175-186`; `SPEC.md:135`

## Minor / advisory

- Before ship, nominate the concrete QA or GATE-S reviewer in the gate evidence so the “whichever has live host access” handoff cannot be left unowned. This is a process hardening note, not a contract defect. — evidence: `INTERFACE_CONTRACT.md:177`; `SPEC.md:92,135`

## Checked and clean

- Dropped conflicts: all four R2 conflict IDs are folded with matching resolution markers; the R3 decisions preserve the per-version rollback boundary, distinct refusal meanings, and four-member terminal outcome set. — evidence: `council/conflicts.json`; `council/decisions.md:7-47`; `SPEC.md:239-243`
- Unobservable acceptance criteria: AC28 now has a deterministic repository/process prerequisite plus separately owned direct live Railway review; the remaining criteria are assigned to real-PostgreSQL, process, structural, conformance, golden, or exact-copy checks. — evidence: `SPEC.md:104-138`; `INTERFACE_CONTRACT.md:120-186`
- Authoritative git inputs: both receipt subcommands require `--repository-root` and exact lowercase 40-hex `--expected-git-sha`, validate the canonical git toplevel and commit object, and read only `git show <sha>:railway.json`; working-tree config is explicitly excluded. — evidence: `INTERFACE_CONTRACT.md:122-134`; `SPEC.md:135`
- Opaque live validation claims: the machine tool accepts no deployment id, image revision, deployment status, health result, config-source claim, host log, or locator; the receipt is scoped to repository/process evidence and the live observations are explicitly required separately. — evidence: `INTERFACE_CONTRACT.md:153-173`; `SPEC.md:92,135`
- Terminal schema unchanged and aligned: stdout remains JSON Lines with exactly one terminal object; the receipt accepts one exact terminal object only, and terminal fields/outcomes/reasons agree with the data flow and acceptance criteria. — evidence: `INTERFACE_CONTRACT.md:7-100,136`; `SPEC.md:73-84,96,123`
- Unspecified component states: CLI and production-startup tables cover default, loading, empty, error, and offline/stale behavior for every classified database state. — evidence: `SPEC.md:142-151`
- Interface mismatch: the operational command contract, startup refusal copy, unchanged `/api/health` pin, and machine-checkable conformance block agree with the stated backend-only data flow; no UI consumes unpromised fields. — evidence: `SPEC.md:73-100,142-186`; `INTERFACE_CONTRACT.md:7-107,188-207`
- Internal contradiction: no conflict remains between per-version transactions, earlier-version preservation, terminal copy, startup read-only behavior, immutable git-object validation, and split live review. — evidence: `SPEC.md:78-100,123-138,163-173`; `INTERFACE_CONTRACT.md:75-100,111-186`
- Guardrail breach: no new violation found for structural-over-prose enforcement, runtime-only secrets, cited-code verification, production fail-closed behavior, or protected trading/quantitative outputs. — evidence: `SPEC.md:227-233`; `BRIEF.md:8-10`
