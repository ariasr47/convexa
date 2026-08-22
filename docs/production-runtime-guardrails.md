# Production runtime guardrails

This runbook is for the deployment operator. It does not replace the locked feature contract or QA.

## Release sequence

1. Build the API with the Postgres feature and deploy an exact `RELEASE_GIT_SHA` with `APP_ENV=prod`.
2. Configure the Railway API service to one replica for migration/startup. Do not start a second target-release API process before the first reaches readiness.
3. Supply runtime variables only through Railway: Postgres, the explicit archive-body volume mount, exact HTTPS browser origins, the metrics token, addressed session/encryption key rings, and any legacy verifier/decoder retained for rotation overlap.
4. Capture complete Railway service configuration, deployment events, and startup logs from deployment start through first readiness. Add that release-bound evidence to `migration_startup_owner` in `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json`.
5. Run `api-rust production-volume-drill prepare` against the named mounted volume. Preserve the generated state file through the replacement.
6. Restart or redeploy the same release, then run `api-rust production-volume-drill verify` with distinct before/after deployment ids and both platform evidence locators.
7. Retain `.spire/clusters/tech/state/conformance/production-runtime-guardrails-volume.json` and the transport receipt for independent QA cross-checking.

`GET /api/health`, a successful archive writeability probe, and local receipt tests are not mounted-volume durability evidence. AC7 and AC26 remain ship-blocking until the real Railway receipts validate against the exact release and QA checks their linked evidence.

## Railway volume permissions

Railway mounts a new volume as root, while the production image runs `api-rust` as UID `10001`.
Bootstrap a new empty volume with one maintenance deployment only:

1. Set `RAILWAY_RUN_UID=0` temporarily and deploy the exact release.
2. Create `SESSION_CHAIN_ARCHIVE_BODY_ROOT`, assign it to `10001:10001`, and restrict it to mode `750`.
3. Remove `RAILWAY_RUN_UID` and redeploy the same release.
4. Confirm `/proc/1/status` reports UID/GID `10001` before running the volume drill.

Do not leave the API running as root. The ownership change persists on the volume; subsequent normal deployments remain unprivileged.

## Failure handling

A production refusal is repaired by correcting runtime configuration or the required dependency, then restarting the same release under one startup owner. Never bypass the refusal with a local store, an ephemeral key, wildcard CORS, open metrics, or a fabricated receipt.
