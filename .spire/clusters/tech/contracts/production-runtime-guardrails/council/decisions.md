# R3 — decisions: production-runtime-guardrails

## Human rulings

### Archive-body durability boundary — 2026-08-21

**Ruling: mounted persistent volume in this slice (Option A).** Production startup must require an
explicit archive-body root and prove it reachable and writable before bind. Ship evidence must also
include a restart/redeploy drill showing that an archive sentinel survives on the mounted production
volume. Runtime diagnostics and acceptance criteria must not claim that the in-process write probe alone
proves durability. S3-compatible remote storage remains the separately queued
`remote-archive-body-store` program slice; it is not pulled into this feature.

This ruling resolves product conflicts
`ba81492e6074b4b510db46fc9702061ae333fde959ee207509de6f2ecf4e24f0` and
`68d42b1fbae30ecf2523753f1e775a2525e5f73d3cd1b9d860f4453dc0e6dd86`, and provides the product
boundary for technical conflict
`8d713030b4831c8ae3eba091dd8a26d19d6854c63ebb5b9c37f8f584d26cd6b6`.

## Technical resolutions

### Runtime mode classification

Railway is evidence that an explicit mode is mandatory, not evidence that the mode is production.
`APP_ENV` is a closed vocabulary: `prod` selects production; `dev`, `test`, and `staging` select
non-production arms. Railway and release builds refuse missing or unknown values before stores, router,
listener, or workers. Only a debug build outside Railway may default a missing value to `dev`.

This resolves `f27f5a0e9af8681a6ade2217073f212cc32d2a25a1f6d00c9ed25e9da845ada7`.

### Browser-origin validation and diagnostics

Production origins are compiled as an exact allowlist. Missing/empty lists, wildcards, malformed or
opaque entries, credentials, path/query/fragment, and non-HTTPS origins are rejected. Default ports are
normalized and duplicates removed. Tower receives exact origins plus explicit methods and headers;
production never uses `Any`. Requests without `Origin` retain their existing route/auth outcome.
Diagnostics use the stable `Allowed browser origins` label and closed, value-free reasons for
missing/empty, wildcard, malformed entry, and HTTPS-required; configured values are never echoed.

This resolves `c5747bb607ad47a303355939a182b2d9f5632c45ff6fcae17b5bbf750d182ee1`.

### Key-ring validation versus corpus readability

Startup validates only statically provable key-ring structure: exactly one configured active id,
unique ids, active membership, valid key material, distinct material per id, and a valid explicitly
configured legacy decoder. New ciphertext carries version + key id and dispatches only to that key;
legacy ciphertext uses only the configured legacy decoder. Startup does not scan the credential corpus
and does not claim that every historical key is present. An unknown/removed key discovered on use maps
to the existing no-usable-credential outcome, preserves ciphertext, leaves market reads/SSE available,
and emits only a secret-free failure class plus non-secret key id when available. The former generic
`retain every key required` startup line and distinct corpus-derived rotation-refused state are withdrawn.

This resolves `f90ec10dc8b7fe12fb564b43d5a601f28a730f45d3648d43bf9a7524ffc850b6` and
`74b754e16c355b9e4c718c30ac1c2fa55c268feedc6da1a32fbb0b50880376b4`.

### Archive runtime proof

The in-process check is an explicit-path create/write/fsync/remove probe with a bounded timeout. It
uses `Archive body root` wording and never calls that probe proof of durability. Durability is the
separate ship-blocking mounted-volume restart/redeploy sentinel drill required by the human ruling.

This resolves `8d713030b4831c8ae3eba091dd8a26d19d6854c63ebb5b9c37f8f584d26cd6b6`.

## Product decisions still open

None.

### Production cookie topology — 2026-08-21

**Ruling: first-party only (Option A).** Production authentication matches the existing Cloudflare
same-origin proxy. Cookies remain host-only, `Secure`, `HttpOnly`, and `SameSite=Lax`; production
startup rejects cross-site/`SameSite=None` policy. Supporting a secure cross-site deployment later
requires a separate design decision and explicit origin/cookie/deployment tests.

This resolves product conflict
`29f22b3580519a9f7553ed963bc5b391c2f3b33a28f2db0d79cf6a86dc4bd615`.
