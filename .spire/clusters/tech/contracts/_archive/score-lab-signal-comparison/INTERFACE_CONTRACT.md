# score-lab-signal-comparison — interface contract

**Spec:** `.spire/clusters/tech/contracts/score-lab-signal-comparison/SPEC.md` (§6 points here)
**Status:** draft — written at R4 alongside `SPEC.md`

## What this feature adds to the FE↔BE interface: nothing

This feature is a **research CLI subcommand plus a file artifact**. It adds no endpoint, no route, no
handler, no query parameter and no field on any existing wire payload. A dashboard or `/_ops` surface for
lab results is out of scope and would breach `[operator-vs-trader-path-separation]`; `SPEC.md` §4 carries
`NO_UI_CHANGE` for the same reason. The frontend consumes nothing this feature produces.

**Why this file does not simply say `NO_BACKEND_CHANGE`.** That token would be true of the *interface* and
misleading about the work: the backend changes substantially (a new `services::research` module set, a
generalized pairing step, a new artifact shape, a bumped `SCORE_LAB_VERSION`, and a log line in the
scanner loop). More importantly, one of those changes sits directly beside a live endpoint. `SPEC.md`
§2.7 resolves a source-level `[absent-is-not-none]` breach by giving the lab a **strict analytics read with
no fallback**, forked from the same `read_structure_history` path that
`GET /api/scan/{symbol}/history` serves — while requiring that **the serve path keeps its fallback
unchanged**. The predictable implementation mistake is to make the shared read strict for everyone, which
turns a degraded-but-answering endpoint into a 500 for the browser. That is a wire-visible regression, so
the block below exists as a **machine-checked non-regression guard**, not as a description of new surface.
`[structural-over-prose-enforcement]`: prefer the check that goes red over the sentence an implementer must
remember.

## Endpoints

| Method | Path | Purpose | Auth | Errors | Streaming |
|---|---|---|---|---|---|
| GET | `/api/scan/{symbol}/history` | Existing, **unchanged**. Anonymous-open structure diary read for one ticker (`apps/api/src/routes/scan.rs` → `get_structure_history`). Returns the ring-buffered `StructureSample` series plus the honest-basis copy and the stored count. | none (anonymous) | Always 200 with the envelope below; an unknown or empty symbol yields `samples: []` and `stored_count: 0`, never a non-200. The Postgres base-columns fallback stays in force here, so a partial/failed analytics SELECT degrades the four analytics fields to `null` rather than failing the request. | none |

Notes that bind the build:

- The lab **must not** call this endpoint. It reads the store directly, offline, through its own strict
  path (`SPEC.md` §2.7). No CLI code path may acquire an HTTP client.
- `query.limit` is clamped server-side to `[1, STRUCTURE_HISTORY_MAX]`; this feature changes neither the
  clamp nor `STRUCTURE_HISTORY_MAX`.
- `samples[]` is `StructureSample` as serialized today. The four analytics fields (`net_gex`,
  `iv_hv_ratio`, `atm_iv`, `hv_30d`) and `score_drivers` are `skip_serializing_if = "Option::is_none"`,
  i.e. **absent keys** rather than nulls, and are therefore deliberately **not** asserted below — asserting
  them would make the guard fail on a legitimately empty or pre-analytics diary and would say nothing
  about the regression this block is here to catch.
- The fan-out assertions (`samples[].*`) pass vacuously on an empty diary, which is the correct behaviour
  for a guard: it proves the envelope and the element shape when elements exist, and never manufactures a
  FAIL from an empty local store.

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/scan/{symbol}/history",
      "path_params": { "symbol": "SPY" },
      "query": { "limit": 5 },
      "required": {
        "symbol": "string",
        "basis": "string",
        "stored_count": "number",
        "backend": "string",
        "samples": "array",
        "samples[].symbol": "string",
        "samples[].as_of": "number"
      }
    }
  ]
}
```

## What a FAIL here means

- **Non-200 / unreachable** — the most likely cause is the strict analytics read having been applied to
  the shared `read_structure_history` instead of a lab-only variant. `SPEC.md` §2.7 and AC-62 require the
  strict behaviour on the **CLI path only**; the serve path degrades honestly as it does today.
- **Missing or mistyped envelope field** — someone changed `StructureHistoryResponse` while reshaping the
  research read. This feature has no reason to touch that struct.
- **Mistyped `samples[]` element** — someone changed `StructureSample`'s wire shape. This feature adds no
  capture field and no column (`SPEC.md` §2.10); a change here means the "no new capture field" non-goal
  was violated.
