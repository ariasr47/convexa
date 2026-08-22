```json
{
  "role": "ux",
  "agree": [
    "A PostgreSQL-backed serve process validates the schema it receives but never upgrades, repairs, or records that schema.",
    "Each migration version is atomic because its DDL statements and ledger insert share one database transaction.",
    "No HTTP endpoint, trader UI, frontend type, bundle/SSE field, or public API behavior changes."
  ],
  "conflicts": [
    {
      "quote": "Migration failed. No schema version was committed.",
      "source": "ux",
      "why": "This overstates the rollback boundary. The agreed behavior commits each successful version independently, so an invocation may commit earlier versions before a later version fails; a post-apply usability check may also fail after version commits. The sentence would tell the operator that nothing was committed when the database can prove otherwise.",
      "proposal": "For a transaction failure, say `Migration failed. The failing schema version was not committed.` For a post-apply usability failure, use a separate reason-specific message that explicitly says migrations were committed but the resulting PostgreSQL schema could not be verified. Keep both as non-success terminal outcomes.",
      "kind": "technical"
    },
    {
      "quote": "Migration refused: the database schema is incomplete.",
      "source": "ux",
      "why": "This renames every proposed partial or inconsistent state as incomplete. The architecture position distinguishes a diverged migration history, including reordered or renamed ledger entries, from an actually missing schema object and from an unusable schema. A renamed or reordered history is inconsistent with the release, but it is not necessarily incomplete.",
      "proposal": "Use `Migration refused: the database migration history is inconsistent with this release.` for divergence. Reserve `incomplete` for a separately vouched missing-schema condition, and keep `could not be verified` for an unusable or unverifiable schema.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architecture: which closed observable reason distinguishes a migration-transaction failure from a post-apply usability failure after earlier version commits, so the terminal copy can state precisely what was and was not committed?"
  ]
}
```
