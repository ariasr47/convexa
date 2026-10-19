# Supply-chain operations

The supply-chain checks run with the candidate Node/npm/Rust tuple and use the committed lockfiles as
their dependency authorities. Run `npm ci`, then `npm run test:tools` and `node tools/supply-chain/verify.mjs`.

License continuity is an observed inventory, not legal approval. The normalizer uses the lock metadata when
it contains a valid SPDX expression. A package without metadata is accepted only when its exact npm tarball
matches the lockfile SRI and an exact license-file SHA-256 resolves through the checked repository matcher;
unknown, modified, missing, ambiguous, conflicting, or integrity-mismatched evidence fails. Regenerate the
baseline with `node tools/supply-chain/generate-license-baseline.mjs` and review the resulting lock-bound diff.
Every row carries its lock's SHA-256 (CRLF-normalised for both locks, so a Windows checkout produces the same
baseline as CI), which means **any** `package-lock.json` change fails `npm_licenses` on every npm row at once
until the baseline is regenerated — the finding count is one lock change fanned out, not that many license
problems. Review the regenerated diff for removed/added packages and new SPDX expressions, not the hashes.

## Dependency proposals

Dependabot is off (owner, 2026-10-15, with GitHub Actions): `.github/dependabot.yml` was removed, and
alerts and security updates are off in the repository settings. When it was on, it proposed weekly
grouped npm, Cargo, Docker, and Actions updates for humans to review and merge, with no auto-merge;
restore the file from git history to bring that back.

## Limits

Evidence is associated with GitHub-built subjects only. It does not identify bytes independently rebuilt or
deployed by Railway or Cloudflare. No application runtime or trader-facing surface is changed.
The artifact path requires hosted Ubuntu 24.04, Docker Buildx, and the checksum-verified Syft and Trivy tools;
a local host without those capabilities returns `blocked` and cannot substitute rebuilt evidence.
