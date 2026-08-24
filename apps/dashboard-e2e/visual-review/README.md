# Visual review policy

Visual checks are compare-only and platform-scoped. A missing or changed baseline fails with expected, actual, and diff evidence; checks never write PNGs. Candidate generation is a separate uncached command reachable only with an owner/design-reviewer authorization receipt. It writes six current-platform candidates and a `candidates_written` receipt, never an approval. A code reviewer must author the acceptance receipt after inspecting the candidate images and source diff; two distinct clean compare-only runs are required before stability can be recorded.

The durable state machine is `compare_failed → authorized → candidates_written → accepted|rejected → stability_clean`.
The owner/design reviewer authors only the authorization, and the code reviewer authors only the acceptance; the update
command cannot create or modify either human decision. Every receipt is exact-key, repository-path confined, platform
scoped, source-revision bound, and SHA bound to its evidence. Candidate generation runs Playwright with `shell:false`
and the private update environment, writes exactly the six current-platform PNGs, atomically emits one
`candidates_written` receipt, and prints that candidates are written—not approved. Any partial or unexpected write is
rolled back. Acceptance is validated externally and requires the exact candidate/source-diff bindings; only an accepted
set can establish stability, which requires two distinct clean zero-retry compare runs with unchanged image hashes.

The six scenarios are defined by `src/quality/manifest.json`; pixel tolerance is zero and masks are not used. Windows and Linux baselines are never substituted. The visual policy does not claim hosted evidence until a real hosted runner produces it.
