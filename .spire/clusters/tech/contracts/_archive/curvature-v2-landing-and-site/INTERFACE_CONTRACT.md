# curvature-v2-landing-and-site — interface contract

**Status:** `NO_BACKEND_CHANGE`
**Spec:** `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/SPEC.md` (§6 points here)

## Why this is NO_BACKEND_CHANGE

This feature rebuilds six frontend surfaces (landing, blog index, methodology, 404/route fallback,
auth wall, footer). It adds no endpoint, changes no request or response shape, and touches no server
code:

- **`apps/api` diff stays 0** on `spire/curvature-v2-foundations` (BRIEF, and the repo build invariant
  the SPEC restates in §8). The methodology page's score constants are read from
  `libs/quant-engine/src/signals.rs` **as source text on disk** by a test — a read, not an import, and
  not a byte changed in either crate.
- **Five of the six surfaces have no data edge at all.** Landing, blog, methodology and the 404 issue
  zero API requests; the footer renders `new Date().getFullYear()`. The SPEC pins that absence as an
  invariant (§2 "a zero-edge tree", enforced by the shipped strict-fetch harness plus a build-breaking
  import deny-list).
- **The sixth — the auth wall — consumes an already-shipped read and adds nothing to it.**
  `RequireAuth` reads `useAuth()`, which is the one app-wide who-am-I the provider already fires once
  on mount (`AuthContext.tsx`, mounted at `app.tsx:197`). This feature adds a third render branch on a
  flag the provider **already sets** (`subsystemDegraded`) and a `Try again` control that calls the
  provider's existing `refresh()`. No new field is requested, and no new call site is created.

The owner rulings of 2026-09-10 (D-B — the hero is a static inline SVG isometric projection, no WebGL
and no new dependency; D-A — the blog index ships one published read and no draft slots) change
nothing here: both are render-side, and neither adds a data edge to any of the six surfaces.

## Endpoints this feature consumes (existing, unchanged)

| Method | Path | Purpose here | Auth | Error semantics |
| --- | --- | --- | --- | --- |
| GET | `/api/auth/session` | The who-am-I read behind the sign-in wall. Its resolution flips `ready`; `authenticated` decides wall vs. children. | none (anonymous 200 is the contract — an anonymous caller gets `authenticated: false`, not a 401) | **Always 200 server-side.** A *transport* fault (network failure or a non-200) is resolved client-side to anonymous **plus** `subsystemDegraded: true` (`AuthContext.tsx:10-12`), which is what the new degraded wall branch renders. The client never surfaces a raw status on these surfaces. |

**Authoritative field list:** `libs/api/src/generated/schema.ts` — `components['schemas']['SessionStatusBody']`,
reachable as `paths['/api/auth/session'].get` (`operations['auth_session']`). Consumed through
`getSession()` (`libs/api/src/lib/convexa.ts:1038-1042`). The schema's own note is binding here:
generated clients rely on the four identity fields being **present even when their values are null**
for an anonymous session — which is exactly the case this feature's wall renders.

No other endpoint is reachable from any surface in scope: `pages/{landing,blog,methodology,not-found}/**`
are barred from importing `@convexa/api` by an ESLint deny-list (SPEC §2/§7), and the landing's shipped
strict-fetch harness throws on any non-auth call.

## Conformance spec

Machine-checkable against the live backend at G1. This is the **existing** contract of the endpoint the
wall already consumes, restated here so `interface_conformance.mjs` has something real to check — an
empty `endpoints` array exits 2 ("spec has no endpoints"), which is a configuration error, not evidence.
No `auth` flag: the anonymous 200 is the property the wall depends on, and marking it `auth` would send
a session to the one endpoint whose anonymous behaviour is the thing under test.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/auth/session",
      "path_params": {},
      "query": {},
      "required": {
        "authenticated": "boolean",
        "google_available": "boolean",
        "user": "object|null",
        "settings": "object|null"
      }
    }
  ]
}
```

**Reading the block.** `user` and `settings` are `object|null` because an anonymous session returns
both as JSON `null` and a signed-in session returns objects; a *missing* key is a FAIL either way,
which is the regression this pin exists to catch. `demo_seed` is deliberately omitted — it is optional
in the schema and no surface in this feature reads it.

## Amendment rule

A change to this file after approval is a GATE Z amendment — a visible file-level event. If any later
slice of this feature needs a field, an endpoint, or a status this block does not name, it stops and
amends here first; it does not read an undeclared field from a response.
