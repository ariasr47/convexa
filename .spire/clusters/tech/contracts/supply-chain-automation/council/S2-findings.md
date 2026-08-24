# S2 — skeptic findings: supply-chain-automation

## Critical  (blocks — must loop back to R4)

- None found in pass 2. The three prior Critical findings are closed: qualification now has distinct
  `base_revision_sha`/`candidate_revision_id`/`accepted_revision_sha` phases; §4.2 enumerates all 11
  capability IDs with pass/fail/unavailable fixtures and exact exits; and §8 defines target-specific
  Cargo/npm seed closures, component-set equality, and deterministic TAR subject identity. — evidence:
  `SPEC.md:2.1,3 AC-1–AC-3`; `INTERFACE_CONTRACT.md:4.2,8.1–8.4`.

## Important  (should fix)

- **The component-oracle hash still lacks a canonical serialization algorithm.** The repaired contract
  says “sorted identities form `component_oracle_sha256`” and later requires equality with
  `component_identity_set_sha256`, but it never specifies whether sorting/hashing uses RFC 8785 JSON,
  UTF-8 line records, delimiters/escaping, or the exact canonical field order for `(family, ecosystem,
  name, version, provenance)`. Two conforming adapters can derive different hashes from the same lock
  closure, making the receipt and cross-subject mutation checks non-interoperable. — evidence:
  `INTERFACE_CONTRACT.md:8.3` (sorted identity/hash rule) and `8.4` (`component_oracle_sha256` /
  `component_identity_set_sha256` fields), contrasted with the explicitly canonicalized `run_key` rule
  in `INTERFACE_CONTRACT.md:7`.

- **The Syft artifact-boundary claim remains semantically ambiguous despite the oracle repair.** §2.3
  describes the flow as “build named subject once → scan that digest → generate ... target-specific
  SBOMs,” but §8.3 instructs the implementation to give Syft a synthetic temporary catalog derived
  from lock identities, not the API image or dashboard TAR. The contract does disclose that these are
  resolved-dependency inventories, but it still labels the output an SBOM for the subject and requires
  the same subject digest. Unless the generated artifact is explicitly classified as a lock-derived
  dependency inventory associated with (rather than cataloged from) the subject, a reviewer can
  reasonably read AC-21/AC-22 as claiming Syft observed the subject bytes. — evidence:
  `SPEC.md:2.3` (scan/generate flow and “target-specific SBOMs”), `INTERFACE_CONTRACT.md:8.1` (subject-
  bound inventory disclaimer), `INTERFACE_CONTRACT.md:8.3` (synthetic catalog presented to Syft).

## Minor / advisory

- The capability fixture table calls the `sanitizer.all-publication-channels` policy-fail arm a
  “completed `fail`” for a safe value violating a policy template, while the same row calls leaked
  canary bytes an unavailable/blocked capability stop. Keep those two distinctions in the fixture
  names and receipt `expected_state` values so a sanitizer policy rejection cannot be mistaken for a
  publication leak. — evidence: `INTERFACE_CONTRACT.md:4.2` capability table and receipt contract.

- The accepted-revision phase re-runs ordinary CI after the binding receipt, but the contract does not
  state whether that CI result is incorporated into the binding receipt or joined by its own run key.
  This is advisory because AC-1/AC-3 now have an executable bootstrap, but the release owner should
  avoid treating a qualification artifact alone as ordinary accepted-revision CI. — evidence:
  `INTERFACE_CONTRACT.md:3` (binding receipt and “ordinary CI then reruns”); `SPEC.md:3 AC-1`.

## Checked and clean

- Rechecked every prior finding: two-revision qualification and selector patch identity; all 11
  capability probes and exact `0/1/2` semantics; API Cargo and dashboard npm seed/oracle equality;
  POSIX ustar TAR determinism and traversal/link/device rejection; native Dependabot-only body scope;
  strict array schemas, bounded grammars, owners/actions resolution, artifact references and retention;
  publication-channel suppression and canary coverage; dispatch path inputs and `run_key`/
  `subject_set_sha256` joins; the Railway/Cloudflare host-rebuild limitation; and conflict receipt
  integrity. No prior Critical or Important remains open.
- Ran all six S2 checks: all 36 R2 conflict IDs remain represented; no dropped conflict, unspecified
  required component state, missing report field schema, or guardrail breach was found. The repaired
  contract preserves `NO_BACKEND_CHANGE`/`NO_UI_CHANGE`, no security exceptions, no auto-merge, and
  no deployed-byte provenance claim. — evidence: `council/conflicts.json`; `SPEC.md:4,8,9`;
  `INTERFACE_CONTRACT.md:5,7,10.1,12,Conformance spec`.
