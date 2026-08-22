# production-runtime-guardrails — interface contract

This is the FE↔BE and deployment-check truth for the backend-only runtime-guardrail slice. Existing endpoint paths and JSON response fields remain unchanged; `NO_UI_CHANGE` applies. Startup refusal occurs before a listener exists and therefore has no HTTP error response.

## Runtime and transport policy

- A valid production process binds only after the pre-bind guardrails in `SPEC.md` succeed. If validation fails, clients observe connection refusal/no readiness endpoint, while the operator receives the process diagnostic.
- Browser CORS permission is limited to the normalized exact HTTPS origins in `ALLOWED_BROWSER_ORIGINS`. The pinned current browser methods are `HEAD`, `GET`, `POST`, `PUT`, and `DELETE`, with `OPTIONS` handled for preflight; pinned request headers are `Accept`, `Content-Type`, `Authorization`, and `X-Metrics-Token`. `HEAD` preserves Axum's existing GET/HEAD behavior. `PATCH`, `CONNECT`, `TRACE`, and undeclared headers are intentionally not browser-allowed because the current route inventory does not use them. Credentials are allowed only for an exact configured origin. A response to an unlisted origin carries no allow-origin permission. Requests without `Origin`, including non-browser `HEAD`, retain their existing route/auth semantics. A future route method/header addition must update this pin and both preflight arms in the same change.
- Production authentication is first-party only. `gf_session` is host-only with `Path=/`, `Secure`, `HttpOnly`, and `SameSite=Lax`; a cross-site/`SameSite=None` policy is not supported.
- `GET /api/health` remains anonymous and shape-compatible. A successfully started production instance reports `metrics_auth` as required. Its existing `durable_store` field identifies only the Postgres application-state/metadata backend; it does not attest that `SESSION_CHAIN_ARCHIVE_BODY_ROOT` survives replacement. Archive-volume durability exists only when the separate production-volume receipt passes.
- `GET /api/_metrics` remains an operator-only, read-only endpoint. In production, either `Authorization: Bearer <METRICS_SECRET_TOKEN>` or `X-Metrics-Token: <METRICS_SECRET_TOKEN>` is required. Missing or incorrect credentials return 401 with the existing error shape and no metrics content; a correct credential returns the existing metrics payload. The trader-origin proxy continues to return 404 before this backend surface.

## Endpoints

| Method | Path | Purpose | Auth | Success and error semantics |
|---|---|---|---|---|
| `GET` | `/api/health` | Existing liveness/readiness and backend summary after validated startup | Anonymous | `200` with the existing health object. No response exists when bootstrap is refused because the listener never binds. |
| `GET` | `/api/_metrics` | Existing read-only operator metrics | Operator token header, not session-cookie auth | Valid token: `200` unchanged metrics object. Missing/incorrect token in production: `401` `{error, detail}` and no metrics content. Trader-origin proxy remains `404`. |

## Required verification receipts

The generic interface runner covers the two JSON/status probes below. Transport and deployment claims require these additional non-secret release receipts:

- `.spire/clusters/tech/state/conformance/production-runtime-guardrails-transport.json` — assembled in two owned stages and independently validated by QA. The backend executioner's production-profile integration command records `schema_version`, feature, git SHA, UTC execution time, executor, exact command, overall result, and named results/evidence for: invalid-startup refusal before bind/workers; fresh/current/partial/future schema preflight; `durable_store` = Postgres-state-only semantics; metrics 401 without/wrong token and 200 with the correct token; exact-origin and unlisted-origin CORS; the full positive/negative method/header preflight matrix; first-party cookie attributes; and no-`Origin` compatibility. The production deployment operator adds `migration_startup_owner` with its result, the same git SHA, Railway project/environment/service/deployment ids, configured replica count, all target-release startup instance ids observed from deployment start through first readiness, the single startup id's schema-start/schema-finish/listener-bind UTC times, capture time/operator, and service-config, deployment-event, and startup-log evidence locators. `migration_startup_owner` is `PASS` only when replica count is one, exactly one target-release startup id is observed, schema-start < schema-finish < listener-bind, and every field/evidence locator is release/deployment-consistent. Missing/skipped entries, a second startup id before readiness, or any mismatch makes the whole receipt incomplete and ship-blocking; the record proves only this rollout, not a generalized migration lock.
- `.spire/clusters/tech/state/conformance/production-runtime-guardrails-volume.json` — emitted only by the deployment operator's real Railway mounted-volume drill and validated by QA. It records `schema_version`, feature, `PASS`, git SHA, project/environment/service ids, before/after deployment ids, volume id, mount path, sentinel relative locator, matching write/read SHA-256 values, written/verified UTC times, restart kind, executor, cleanup result, and evidence locators. It is invalid if generated locally, tied to another release/environment/volume, contains secrets, lacks distinct deployments, or lacks matching hashes and before/after evidence.

Neither `/api/health` nor the generic conformance block is evidence of mounted-volume persistence.

## Conformance spec

The live conformance run uses a valid production-profile server and intentionally sends no operator token to the second endpoint, proving the anonymous metrics denial shape. The successful token path and non-JSON transport properties are deliberately carried by the required transport receipt because this runner cannot inject arbitrary headers or inspect cookie/CORS assertions.

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
    },
    {
      "method": "GET",
      "path": "/api/_metrics",
      "path_params": {},
      "query": {},
      "expect_status": 401,
      "required": {
        "error": "string",
        "detail": "string"
      }
    }
  ]
}
```
