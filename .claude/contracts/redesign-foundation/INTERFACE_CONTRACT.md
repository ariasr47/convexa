# redesign-foundation — INTERFACE CONTRACT (FE ↔ BE truth)

> Role: Delivery UX / Tech-Writer, compressor #3 (Split Context). The single FE↔BE truth for
> `redesign-foundation`. Self-contained against `PROJECT_CONTEXT.md` + the inbound contracts; no
> chat-history dependency.

## Verdict: NO_BACKEND_CHANGE

This feature is a **purely visual reskin** of the theme foundation + Landing + AppShell nav. It
introduces **no new endpoint, no new request, no new field, no changed payload, and no `apps/api`
edit**. It consumes ONLY existing surfaces, unchanged.

### What the in-scope surfaces consume

| Surface | Network behavior | Existing endpoint/field consumed (UNCHANGED) |
|---|---|---|
| **Landing (`/`)** | **Static — no fetch, no SSE.** Rendering `/` issues no trader/bundle/analysis request and opens no stream. | none |
| **AppShell nav chrome** | none of its own (no feature data, no fetch, no SSE) | none |
| **AccountControl (in the nav)** | reflects the existing app-wide, non-blocking who-am-I read via `AuthContext` (fired once on mount everywhere — a pre-existing auth concern, NOT a Landing/nav-introduced call) | `GET /api/auth/session` → existing `SessionStatus` (`authenticated`, `user{display_name,email,…}`, `google_available`, `settings`). **Read unchanged; no new field, no new param, no new header.** |

The who-am-I read is the ONLY network activity associated with the in-scope surfaces, and it is
**pre-existing** (owned by `AuthContext`, contract-mandated, non-blocking). The "Landing makes no network
call" property (AC-Land-6) excludes this auth read by the project's standing definition (`calledNonAuth()`
in `app.spec.tsx`): "no network call" = no trader/bundle/analysis fetch; the session read is excluded.

### Scoring / invariants (restated — NO change)

- `apps/api` is **untouched**. The scoring path (`signals` / `opportunity_score` / `opportunity_tier` /
  the entry gate / `state_fingerprint`) is never imported, altered, or fed by anything in this feature.
- No theme token, font, or style becomes a scoring input. Score / tier / `state_fingerprint` stay
  **byte-identical** (`[additive-keeps-score-byte-identical]`).
- No durable-key change — keys stay `convexa.*` (`[loss-free-durable-migration]`). No new localStorage
  key/value.
- No route/IA change; `/_ops/metrics` stays off-shell + unlinked (`[operator-vs-trader-path-separation]`).

## Conformance spec

This feature adds **no new endpoint or field** to the FE↔BE seam. The existing interface
conformance surface (`.claude/tools/interface_conformance.py`) is therefore **unchanged** — there is
nothing new to verify at GATE Q beyond confirming the spec did not change. The block below is the
machine-checkable statement of that fact for system-1.

```json
{
  "feature": "redesign-foundation",
  "backend_change": false,
  "new_endpoints": [],
  "changed_endpoints": [],
  "new_fields": [],
  "changed_fields": [],
  "removed_fields": [],
  "consumed_existing_unchanged": [
    {
      "endpoint": "GET /api/auth/session",
      "owner": "pre-existing AuthContext who-am-i read (not introduced by this feature)",
      "fields_read": ["authenticated", "user.display_name", "user.email"],
      "request_changed": false,
      "response_changed": false
    }
  ],
  "scoring_path_byte_identical": true,
  "durable_keys_changed": false,
  "routes_changed": false,
  "conformance_surface_changed": false,
  "verify_at_gate_q": "nothing new — confirm interface_conformance.py output is unchanged"
}
```
