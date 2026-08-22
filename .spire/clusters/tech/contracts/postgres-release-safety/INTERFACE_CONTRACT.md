# postgres-release-safety — interface contract

This is the operational release and unchanged HTTP-interface truth for the backend-only PostgreSQL safety slice. `NO_UI_CHANGE` and `NO_PUBLIC_HTTP_CHANGE` are binding. Startup refusal occurs before a listener exists and therefore has no HTTP error response.

**GATE Z amendment 2026-08-22 (evidence repair 3):** deterministic repository/process evidence is separated from direct live Railway review. The repository tool does not claim to validate opaque host evidence. The command event and terminal schemas below are unchanged.

## Release command

| Surface | Contract |
|---|---|
| Production image | `api-rust postgres-migrate` |
| Source invocation | `cargo run -p api-rust --features postgres -- postgres-migrate` |
| Required runtime input | Non-empty `DATABASE_URL`; production host identity/config remains runtime-injected |
| Optional runtime input | `MIGRATION_LOCK_TIMEOUT_SECONDS`, integer `1..=3600`, default `120` |
| stdout | UTF-8 JSON Lines only: zero or more progress objects followed by exactly one terminal object; no ANSI |
| stderr/logs | Sanitized operational diagnostics only; never an alternate success protocol |
| Exit `0` | Terminal outcome is `work applied` or `already current` |
| Nonzero exit | Terminal outcome is `unsafe database refused` or `execution failed` |

The command constructs no HTTP application state, router, listener, vendor client, cache, archive store, scanner, warmer, ensure worker, or other background worker.

## Command event schema

Every stdout object has `schema_version: 1` and a `kind` of `progress` or `terminal`.

Progress objects carry:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | integer | Always `1` |
| `kind` | string | Always `progress` |
| `state` | string | One of `checking`, `waiting`, `version_started`, `version_committed`, `version_rolled_back` |
| `message` | string | Closed operator copy; never a success outcome |
| `elapsed_ms` | integer | Non-negative elapsed milliseconds |
| `version` | integer or null | Non-null only for a manifest version involved in the event |
| `name` | string or null | Stable manifest name only when `version` is non-null |

Progress `message` is a closed projection of `state`:

| State | Exact `message` |
|---|---|
| `checking` | `Checking PostgreSQL schema…` |
| `waiting` | `Another migration run is active. Waiting…` |
| `version_started` | `Applying migration {version} ({name})…` |
| `version_committed` | `Migration {version} ({name}) committed.` |
| `version_rolled_back` | `Migration {version} ({name}) rolled back.` |

`{version}` is the positive compiled manifest version and `{name}` is its stable manifest name. `version_rolled_back` is legal only after rollback completion.

Terminal objects carry every field below exactly once:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | integer | Always `1` |
| `kind` | string | Always `terminal` |
| `outcome` | string | `work applied`, `already current`, `unsafe database refused`, or `execution failed` |
| `reason` | string | Closed member valid for the outcome, from the table below |
| `message` | string | Exact human copy paired with outcome/reason |
| `target_version` | integer or null | Highest compiled manifest version after successful non-empty manifest validation; null only for `execution failed` / `manifest invalid` |
| `highest_committed_version` | integer or null | Non-null only after a fresh ledger read proves an exact manifest prefix |
| `failing_version` | integer or null | Non-null only when a particular active version is proved to have failed |
| `elapsed_ms` | integer | Non-negative whole milliseconds for the invocation |

Neither object type may carry a database URL, host, username, password, query parameter, SQL body/preview, bound value, raw driver error, key material, or arbitrary environment value. A sanitized SQLSTATE class may be emitted to stderr/logs but is not part of this stdout contract.

## Closed terminal vocabulary

| Outcome | Reason | Exit | Exact `message` |
|---|---|---|---|
| `work applied` | `migrations applied` | `0` | `Migrations applied. The PostgreSQL schema is ready for this release.` |
| `already current` | `already current` | `0` | `No migrations were needed. The PostgreSQL schema is ready for this release.` |
| `unsafe database refused` | `inconsistent history` | nonzero | `Migration refused: the database migration history is inconsistent with this release.` |
| `unsafe database refused` | `future history` | nonzero | `Migration refused: the database records migrations newer than this release.` |
| `unsafe database refused` | `schema incompatible` | nonzero | `Migration refused: the PostgreSQL schema is incomplete or incompatible with this release.` |
| `execution failed` | `migration owner busy` | nonzero | `Migration failed: another migration run remained active past the wait deadline.` |
| `execution failed` | `postgres unavailable` | nonzero | `Migration failed: PostgreSQL is unavailable.` |
| `execution failed` | `schema unverifiable` | nonzero | `Migration failed: the PostgreSQL schema could not be verified.` |
| `execution failed` | `transaction failed` | nonzero | `Migration failed. The failing schema version was not committed.` |
| `execution failed` | `post-apply schema rejected` | nonzero | `Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release.` |
| `execution failed` | `commit status unverifiable` | nonzero | `Migration failed. Commit status could not be verified.` |
| `execution failed` | `manifest invalid` | nonzero | `Migration failed: this release contains an invalid migration manifest.` |
| `execution failed` | `cancelled` | nonzero | `Migration failed: the migration operation was cancelled.` |
| `execution failed` | `internal failure` | nonzero | `Migration failed: the migration operation could not complete.` |

`target_version` is non-null for every terminal record after a valid non-empty manifest establishes its highest version. An empty, duplicate, non-increasing, duplicate-name, empty-body, or unsplittable manifest uses `execution failed` / `manifest invalid` with `target_version: null`; no sentinel is permitted. `transaction failed` and its message are legal only after rollback completion or a fresh ledger read proves `failing_version` absent. When commit status cannot be proved, the command must use `commit status unverifiable`, set `failing_version` to null unless independently vouched, and claim neither commit nor rollback. `highest_committed_version` is null unless a post-failure read proves an exact manifest prefix; when non-null, it may be rendered as `Highest committed version: {version}.` with the stable manifest name, never SQL or driver text.

## Startup diagnostic contract

Production `api-rust serve` is read-only with respect to the migration ledger and schema. It emits one of these exact refusal messages and exits nonzero before listener bind or worker start:

| Condition | Exact message |
|---|---|
| Absent ledger or ordered exact-prefix history | `Startup refused: required PostgreSQL migrations are missing.` |
| Hole, reorder, duplicate, or version/name disagreement | `Startup refused: the PostgreSQL migration history is inconsistent with this release.` |
| Unknown recorded version | `Startup refused: the database records migrations newer than this release.` |
| Current ledger with deterministic required-schema mismatch | `Startup refused: the PostgreSQL schema is incomplete or incompatible with this release.` |
| Connectivity, permission, cancellation, or probe-execution prevents verification | `Startup refused: the PostgreSQL schema could not be verified.` |

No refusal is converted to an HTTP response, local-store fallback, waiting state, or trader-facing degraded mode because the process has not bound a listener.

## Existing HTTP endpoint

No endpoint, auth rule, status, or response field changes. `GET /api/health` remains anonymous and shape-compatible after a current usable schema passes pre-bind verification. The broader approved public interface remains governed by its existing contracts; this feature's live pin proves only that the hardened process can start and retain the health shape.

| Method | Path | Purpose | Auth | Semantics |
|---|---|---|---|---|
| `GET` | `/api/health` | Existing liveness/readiness and backend summary after validated startup | Anonymous | `200` with the existing health object. No response exists when startup refuses before bind. |

## Deployment-order evidence

The ordering authority is Railway's documented deployment lifecycle, not clocks from separate containers:

- The official [pre-deploy command authority](https://docs.railway.com/deployments/pre-deploy-command) says the command executes from the built application image between build and deployment, in a separate container with service environment variables and private-network access. A nonzero exit stops the deployment; the command is not retried. The container has no mounted volume and does not persist filesystem changes.
- The official [config-as-code reference](https://docs.railway.com/config-as-code/reference) defines `deploy.preDeployCommand`, makes config in code override dashboard values for that deployment, and exposes the originating config file in deployment details.
- The target git revision's `railway.json` must parse with `deploy.preDeployCommand` exactly `["api-rust postgres-migrate"]` and `deploy.healthcheckPath` exactly `"/api/health"`. The migration command uses runtime `DATABASE_URL` over Railway's private network and no volume/filesystem state.
- With that lifecycle, a deployment that reaches Railway `SUCCESS` and passes the configured `/api/health` check necessarily passed the pre-deploy command before its application container could become running/healthy. No cross-container timestamp comparison is needed or accepted.

AC28 has two ship-blocking evidence parts with different owners.

### Repository/process machine prerequisite

The repository-owned producer/validator is `tools/postgres-release-receipt.mjs`; its accepting and mutation/rejection tests live in `tools/postgres-release-receipt.spec.mjs`. Both subcommands require an authoritative local repository and immutable commit object:

```text
node tools/postgres-release-receipt.mjs produce --repository-root <absolute-repository-root> --expected-git-sha <40-hex-sha> --expected-pre-deploy-command "api-rust postgres-migrate" --expected-healthcheck-path "/api/health" --migration-terminal <terminal-object-json-file> --negative-control <negative-control-json-file> --out .spire/clusters/tech/state/conformance/postgres-release-safety-repository.json
```

```text
node tools/postgres-release-receipt.mjs validate --repository-root <absolute-repository-root> --expected-git-sha <40-hex-sha> --expected-pre-deploy-command "api-rust postgres-migrate" --expected-healthcheck-path "/api/health" --migration-terminal <terminal-object-json-file> --negative-control <negative-control-json-file> --receipt .spire/clusters/tech/state/conformance/postgres-release-safety-repository.json
```

`--repository-root` is required. The tool resolves it to an absolute canonical path, requires `git -C <root> rev-parse --show-toplevel` to resolve to the same path, and rejects a missing/non-git/different root. `--expected-git-sha` is required and must match lowercase `[0-9a-f]{40}` exactly. Both producer and validator run the equivalent of `git -C <root> cat-file -e <sha>^{commit}` and then read only the immutable blob returned by `git -C <root> show <sha>:railway.json`; they never read `railway.json` from the working tree. A missing commit/blob or non-identical independent hash is failure.

`--expected-pre-deploy-command` and `--expected-healthcheck-path` are required equality assertions, not caller-selectable policy. They must be exactly `api-rust postgres-migrate` and `/api/health`; any other value is rejected.

`--migration-terminal` is one JSON file containing exactly the terminal object defined in this contract. It is not the command's JSONL stream, not an array, and not a terminal object plus progress records. JSON whitespace and one trailing newline are permitted; after parsing, the top-level value must be one object with `kind: "terminal"`, exactly the terminal fields/types, no extra field, and outcome `work applied` or `already current`. The tool hashes the raw file bytes and embeds the parsed object unchanged. This machine check proves the object's schema and contents, not that Railway emitted it; that origin is observed in the live review below.

`--negative-control` is one exact-schema JSON object produced by the real-PostgreSQL process suite:

| Field | Required value/type |
|---|---|
| `schema_version` | integer `1` |
| `feature` | `postgres-release-safety` |
| `git_sha` | same exact 40-hex `--expected-git-sha` |
| `precondition` | `migrations missing` |
| `command` | `api-rust serve` |
| `exit_status` | nonzero integer |
| `startup_message` | `Startup refused: required PostgreSQL migrations are missing.` |
| `listener_bound` | `false` |
| `workers_started` | `false` |
| `database_fingerprint_before` / `database_fingerprint_after` | equal 64-hex strings |

No extra negative-control field is allowed. The repository/process receipt schema is equally closed:

| Receipt field | Type | Rule |
|---|---|---|
| `schema_version` | integer | Always `1` |
| `feature` | string | Always `postgres-release-safety` |
| `scope` | string | Exactly `repository_and_process_only` |
| `result` | string | `PASS` only for this limited machine scope; never the live AC28 verdict |
| `git_sha` | 40-hex string | Exact `--expected-git-sha` |
| `railway_config.path` | string | Exactly `railway.json` |
| `railway_config.sha256` | 64-hex string | SHA-256 of the immutable git blob bytes |
| `railway_config.pre_deploy_command` | string array | Exactly `["api-rust postgres-migrate"]` |
| `railway_config.healthcheck_path` | string | Exactly `/api/health` |
| `migration_terminal` | object | Exact parsed terminal object, unchanged |
| `migration_terminal_sha256` | 64-hex string | SHA-256 of the exact terminal-object file bytes |
| `negative_control` | object | Exact process object above, unchanged |
| `negative_control_sha256` | 64-hex string | SHA-256 of the exact negative-control file bytes |

Secret absence is deterministic because both input-object schemas and the receipt schema reject unknown fields. In addition, the tool recursively rejects any key, case-insensitive, in the closed denylist `database_url`, `password`, `secret`, `token`, `credential`, `authorization`, `cookie`, `sql`, `query`, `environment`, `username`; and any string value matching JavaScript regex `/postgres(?:ql)?:\/\//iu`, `/[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s/]+@/iu`, or `/\bBearer\s+\S+/iu`. Mutation tests prove each denylist/pattern rejects and the required safe fields accept.

The machine tool accepts no deployment id, image revision, deployment status, health result, config-source claim, host log, or evidence locator. It rejects caller timestamp/order flags and every unlisted chronology/duration field. Terminal `elapsed_ms` remains only the command's internal duration diagnostic.

### Live Railway GATE-S review

The repository/process `PASS` is necessary but insufficient. QA or GATE S—whichever has live host access—must directly inspect the target deployment with current Railway tooling and record a `Live Railway review` block in `QA_REPORT.md` or the GATE-S ship evidence before ship closure, including project, environment, service, and deployment id:

1. Deployment details identify the expected git SHA and built image revision.
2. Deployment details attribute `deploy.preDeployCommand` to `railway.json`, and the observed command is exactly `api-rust postgres-migrate`.
3. The same deployment's pre-deploy log contains exactly one closed zero-exit terminal object equal to the machine-validated terminal object.
4. The same deployment reaches Railway `SUCCESS` only after the pre-deploy stage succeeds.
5. A direct `GET /api/health` for that deployment returns `200` and passes the conformance shape.

QA records the directly observed values and verdict, not opaque locator strings or fixed fields generated by the repository tool. Any missing observation, identity/revision mismatch, different config source/command/terminal object, non-success deployment, or non-200 health result is a live-review FAIL and blocks ship. Railway's lifecycle is the ordering authority; the reviewer does not compare clocks across containers.

## Conformance spec

The live runner starts only after the release command has produced a zero-exit terminal outcome. It checks the unchanged anonymous health response; operational CLI, pre-bind refusal, database mutation, concurrency, and host ordering are process/database/deployment evidence and cannot be represented as HTTP endpoints.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/health",
      "path_params": {},
      "query": {},
      "required": {
        "status": "string",
        "service": "string",
        "durable_store": "string",
        "metrics_auth": "string"
      }
    }
  ]
}
```
