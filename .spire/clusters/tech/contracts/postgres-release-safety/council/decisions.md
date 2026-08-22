# R3 — decisions: postgres-release-safety

## Human rulings

None. The critique round produced no product conflicts.

## Technical resolutions

### Terminal outcomes remain four-state

The closed top-level outcomes are `work applied`, `already current`, `unsafe database refused`, and
`execution failed`. The first two exit zero; the latter two exit nonzero. Lock-deadline exhaustion is
`execution failed` with the stable reason `migration owner busy`; it is not a fifth outcome and is not
an unsafe-schema refusal because the contender never obtained ownership.

### Failure copy follows the proven transaction boundary

A transaction failure may say `Migration failed. The failing schema version was not committed.` only
after rollback completion or a fresh ledger read proves that version absent. Earlier versions committed
by the same invocation may remain. A post-apply probe failure says `Migrations were committed, but the
resulting PostgreSQL schema was not accepted for this release.` If connection loss makes commit status
indeterminate, say `Migration failed. Commit status could not be verified.` and claim neither commit nor
rollback.

An optional `Highest committed version: {version}.` diagnostic is allowed only after a post-failure
ledger reread proves an exact manifest prefix. Otherwise it is omitted. It carries only the stable
manifest version/name, never SQL, driver text, bound values, URLs, or environment values.

This resolves conflicts
`a7b7c448944b35185751734bb52599df195ed3e87f432d7f0fb50c1c4ea26b68`,
`7ed24b8f28d71c09e47f183d5daec9f6f851d69a52b73047ad85be728291ad18`, and
`6f12209156ff14c9f242179a2fec8c3635a881545cb62291b41a179f51b0ec1e`.

### Schema states keep distinct meanings

- An absent ledger or exact manifest prefix means migrations are missing. The release command may
  migrate it; production startup refuses it without mutation.
- A hole, reordering, duplicate, or version/name disagreement means migration history is inconsistent:
  `Migration refused: the database migration history is inconsistent with this release.`
- An unknown recorded version means newer-than-release history:
  `Migration refused: the database records migrations newer than this release.`
- A current ledger plus a deterministic required-schema mismatch means the schema is incomplete or
  incompatible with this release.
- Connectivity, permission, or probe-execution failure that prevents classification means the schema
  could not be verified; it must not be renamed as incomplete or inconsistent.

This resolves conflict
`8d15f95578d65de0b8478ade5ff17038a744806450e54faf9c1163b518c3c84f`.

### Success wording is bounded to PostgreSQL readiness

`work applied` says `Migrations applied. The PostgreSQL schema is ready for this release.`
`already current` says `No migrations were needed. The PostgreSQL schema is ready for this release.`
Neither outcome claims that the whole deployment, application, or release has been verified.

## Product decisions still open

None.
