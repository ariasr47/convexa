```json
{
  "role": "architect",
  "agree": [
    "This feature replaces a contributor-maintained Rust/TypeScript agreement with an executable, reviewable chain: the Rust HTTP contract produces one deterministic OpenAPI artifact; that artifact produces checked TypeScript types and request functions; the shared API package presents the generated result to its existing consumers; and the normal repository gates reject any broken link in that chain.",
    "Specialized streaming connection behavior may remain specialized, but its transported contract must come from the same generated truth and its existing behavior must be preserved.",
    "A drift gate that is only observed green could be vacuous; completion requires a poisoned change that demonstrably turns it red and a restored change that turns it green.",
    "“Generated” and “checked clean” are deliberately different results.",
    "Every manual generation exception is visible under **Manual adapter required**, names its repo-relative adapter and verification, and an undocumented exception makes the normal check fail.",
    "Dashboard consumers continue to import the supported public surface from `@convexa/api`; no consumer deep-imports a generated internal file."
  ],
  "conflicts": [
    {
      "quote": "Against the pinned pre-cutover fixtures, each inventoried ordinary operation returns the same externally observable status, headers with contract meaning, and response body before and after migration.",
      "source": "pm",
      "why": "My architecture position names representative typed-DTO fixtures plus existing conformance, which is a narrower proof than PM's every-operation parity requirement. Both scopes cannot be presented as the ship bar, and several current operations contain time-, redirect-, session-, or live-derived values that require explicit normalization or injected fixtures before exhaustive comparison is mechanically meaningful.",
      "proposal": "Prefer the stronger inventory-driven bar if the human accepts its cost: assign every inventoried operation a hermetic parity case, compare exact status and contract-meaningful headers, and compare bodies after only a reviewed set-equality-pinned normalization for genuinely nondeterministic values. Otherwise the SPEC must explicitly choose risk-tiered representative runtime parity while retaining exhaustive static route/schema coverage; it may not silently call representative coverage exhaustive.",
      "kind": "product"
    },
    {
      "quote": "Use the documented manual-adapter path or change the schema.",
      "source": "ux",
      "why": "As written, this makes a manual adapter sound like a recovery path after generation did not complete. That conflicts with fail-closed drift: an unchanged prior artifact cannot become current merely because an adapter exists, and an ad hoc adapter would recreate handwritten contract authority outside the checked graph.",
      "proposal": "Say that incomplete generation always remains failed. A manual adapter is usable only after its operation is still contract-described, its exception is added to the set-equality-pinned allowlist with an owning test, and the full artifact/client generation reruns successfully; otherwise the only recovery is changing the Rust wire shape or generator support.",
      "kind": "technical"
    },
    {
      "quote": "If connectivity is established as the cause, add: `A required tool or dependency could not be reached.`",
      "source": "ux",
      "why": "The canonical generate/check path is required to be offline after declared toolchain dependencies are installed. Treating connectivity as an expected generation failure mode would permit the implementation to fetch a schema, generator, live API, or dependency during the contract step and weaken deterministic/offline enforcement.",
      "proposal": "Reserve connectivity guidance for a separate dependency-install/bootstrap step outside generate/check. During canonical generation, a network attempt is itself a tooling-policy failure; missing local executables or packages should be reported as local setup failures without suggesting that contract generation normally reaches the network.",
      "kind": "technical"
    },
    {
      "quote": "include rollback guidance that restores the last checked artifacts and public boundary without changing runtime endpoint, auth, or SSE behavior.",
      "source": "ux",
      "why": "Restoring only generated artifacts and the public TypeScript boundary while leaving a changed Rust contract creates the exact stale state the drift gate must reject. The feature is an atomic cutover, so artifact-only rollback is not a coherent recovery mechanism.",
      "proposal": "Document rollback as reverting the complete atomic repository change, or restoring the matching Rust contract, OpenAPI artifact, generated tree, and facade together. The check must pass after rollback; no instruction should recommend checking out generated output alone to silence a failure.",
      "kind": "technical"
    },
    {
      "quote": "Every checked generated TypeScript file carries the generated-file banner and canonical commands, and a generated file cannot be mistaken for an editable source file.",
      "source": "ux",
      "why": "The selected TypeScript generator has not yet been proven in this repository to inject an identical configurable banner into every emitted file. My R1 also asserted a banner without naming whether the pinned generator, a supported plugin hook, or a deterministic postprocessor provides it; that mechanism gap must not become an untestable acceptance claim.",
      "proposal": "During the generator lane-check, prove a supported header/template hook first. If absent, prepend the exact banner in one deterministic repository-owned postprocessing pass before hashing and assert it on every generated text file; generated non-text assets, if any, need a directory manifest rather than byte corruption. If neither route is stable, UX must permit a generated-directory sentinel plus import-boundary lint instead of per-file copy.",
      "kind": "technical"
    },
    {
      "quote": "A supported negative fixture for an unsupported schema construct stops generation and reports `unsupported`, the construct identifier, a repo-relative source location, and the manual-or-schema recovery path; it does not call the API contract invalid.",
      "source": "ux",
      "why": "Neither utoipa macro expansion nor the selected TypeScript generator has been shown to expose a stable machine-readable error containing all four requested facts. Raw compiler/generator diagnostics cannot simply be relabeled without a classifier, and guessing a source location would violate diagnostic truthfulness.",
      "proposal": "Make repository-owned schema-policy validation the mechanism for known unsupported constructs, with stable categories and stored repo-relative operation/source metadata. Preserve unknown compiler/generator failures as tooling failures with their safe raw diagnostic; require a source location only when the tool actually supplies or the policy index records it.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: Does the approved parity inventory include every route registered in the production Axum router—including demo/HTML, aliases, research, redirects, and currently unconsumed operations—or only ordinary production operations plus explicitly named specialized surfaces?",
    "PM: Is exhaustive per-operation runtime body parity worth the fixture/time-injection cost, or may synthesis use exhaustive static contract coverage plus risk-tiered runtime parity for nondeterministic and external-integration operations?",
    "UX: If the pinned generator cannot inject the exact notice into every emitted file through a supported hook, will a deterministic postprocessor satisfy the per-file requirement, and may non-text outputs use a generated-directory sentinel?",
    "UX: Will you narrow connectivity copy to dependency installation/bootstrap so the canonical generate/check commands can truthfully promise zero network access?"
  ]
}
```
