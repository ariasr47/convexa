```json
{
  "role": "architect",
  "agree": [
    "**List stays metadata-cheap** — research list of session identities works from the thin index / metadata and does **not** require pulling every body, and still makes **zero Massive calls**.",
    "**Desk isolation** — object-store I/O does **not** sit on the trader request path; store failures never fail bundle / scan / SSE; score / tier / fingerprint stay byte-identical; stored books remain non-inputs and authorize **nothing**.",
    "**Research load stays zero-vendor** — present body, missing identity, missing object, corrupt object, and not-storing alike: **never** a Massive fill-in.",
    "**App DB is not the body retention volume** for session-archive books after this ship.",
    "It does **not** add a route, component, token, motion, Settings row, Ask-AI line, Ticker chip, Scanner badge, Positions affordance, or `/_ops` “storage health” chrome.",
    "**Pointer + missing body is not a new class.**",
    "Do **not** mint a fifth absence class for storage backend.",
    "**Hard ban — storage-backend chrome:** operator/trader surfaces must not advertise the physical store (S3-compatible, Railway volume, filesystem path, BYTEA, pointer)."
  ],
  "conflicts": [
    {
      "quote": "product preference is that **any paid-book body class still living on the same app OLTP volume** also leaves that volume if it would otherwise remain the retention bottleneck.",
      "source": "pm",
      "why": "Read against live ring BYTEA still co-located on app Postgres, this preference pulls `ChainSnapshotStore` / `pg_chain_snapshot` body migration into this BRIEF whenever OLTP feels tight inside the existing 14d+48/symbol envelope. Architect’s named shape moves only prune-proof session-archive bodies (pointer index + FS/Railway-volume body store); ring non-move is an explicit non-goal because the ring is already bounded while session identity is unbounded by design. Expanding to a second body-store cutover is scope, not required by the session-OLTP failure mode.",
      "proposal": "Keep this ship to session-archive body/index split only. Satisfy AC-22 by recording residual risk: ring BYTEA may still pressure OLTP inside the 48/14d envelope. A human Decision card is required before ring bodies become In.",
      "kind": "product"
    },
    {
      "quote": "**Silent ring deferral** — session bodies move, ring bodies still dominate disk, and the BRIEF \"weeks can accumulate\" claim stays false.",
      "source": "pm",
      "why": "That causal claim does not follow from the store split. Weeks of session corpus accumulate because session books are prune-proof and were retaining full chain BYTEA beside identity; moving those bodies off the app OLTP volume is the mechanism that stops Postgres disk from being session retention policy. The ring remains separately capped (14d + 48/symbol), so leaving ring BYTEA in place does not by itself falsify session-book accumulation for the corpus wait.",
      "proposal": "Treat ring deferral as residual bounded OLTP pressure (AC-22), not as failure of the BRIEF’s session-retention decision impact. Ship-blocking ACs stay on session bodies off OLTP, zero-Massive list/load, and honest miss/unreadable/not-storing.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: confirm env-configured filesystem root on a Railway volume (S3 deferred) satisfies this ship’s “object storage or a dedicated volume” prod adapter requirement.",
    "PM: confirm Architect’s explicit 48-ring non-move plus residual “ring BYTEA may still pressure OLTP inside the 48/14d envelope” satisfies AC-22 without making ring-body migration ship-blocking.",
    "PM: confirm the liquid-name ensure Notify worker may await FS body put off-path without violating AC-13, as long as trader HTTP/SSE still does not await object I/O.",
    "UX: confirm `session book unreadable: <reason>` may keep an opaque body-store I/O fault in `<reason>` when it does not introduce S3/volume/BYTEA/path product vocabulary."
  ]
}
```
