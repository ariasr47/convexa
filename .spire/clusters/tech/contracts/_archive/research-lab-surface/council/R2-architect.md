```json
{
  "role": "architect",
  "agree": [
    "The buyer is the **research operator / owner of the paid corpus**, not the trader on Landing / Ticker / Positions / Scanner, and not a public visitor of `/lab`.",
    "A trader-origin Pages request to the research family still 404s.",
    "Trader session cookie is not a gate and not a fallback.",
    "Query-string token is forbidden.",
    "Reload may re-ask — expected, not framed as data loss.",
    "NO_BACKEND_CHANGE is the product default.",
    "A lab/operator client, if any, **must not leak onto trader routes** and must not grow a trader research helper.",
    "I am not folding coverage into `/_ops/metrics`, and I am not occupying `/lab`.",
    "Coverage `present` is a **loadable `LiveMassive` body** (derive loads the object).",
    "The books table prints `source` **verbatim**.",
    "It must **not** grow a `present` / `kept` column.",
    "Refreshing the tab forgets the token.",
    "`/_ops/metrics` is **not** retrofitted this slice.",
    "`missing` / `unreadable` / `not yet due` / `blocked occupancy` are not buttons that fetch a body.",
    "v1 is on-demand GET (mount + symbol change + Retry), not a trend loop."
  ],
  "conflicts": [
    {
      "quote": "This slice **does not speak the coverage deck** (`present` / `missing` / `not yet due` / `blocked occupancy`) because coverage UI is out.",
      "source": "pm",
      "why": "List/load already distinguish empty, miss, not-storing, and unreadable — I do not need coverage HTTP to serve those arms, and I will not mint coverage `present` from a list row’s `source` (that is fabricated occupancy). Coverage is the only shipped oracle that may say `present` (loadable LiveMassive). UX and I admitted that one sibling; tape/snapshots/flat-files stay out. Omitting coverage is a feasible books-only page only if the screen never says `present`. Dropping the sibling while still needing today’s live-paid honesty is the leak. Mixing decks is a unified status column, not a second existing GET with its own closed lookup.",
      "proposal": "Admit coverage as the one v1 sibling occupancy read on the same off-shell `/_ops/` route: existing coverage GET (server-default date), closed cell deck, never applied to a book row. If the human locks coverage Out, I retract lock 1 pick B to books list+load only — no coverage GET from this page, and the view-model must not mint `present` from list `source`.",
      "kind": "product"
    },
    {
      "quote": "Optional local JSON export may serialize the load body on the operator machine (metrics-page Export precedent: client-only, no server write).",
      "source": "architect",
      "why": "PM Out forbids download/export of paid books (redistribution). The load body is the full capture, including contracts/bars/minutes/trades. A client file of that body is a raw dump on disk even if the screen shows only cardinalities. Metrics Export is pipeline snapshots, not a paid options book. I withdraw the export arm.",
      "proposal": "No local export of a loaded book this slice. Arrays stay in ephemeral memory for cardinality counts only — never rendered, never written.",
      "kind": "product"
    },
    {
      "quote": "API origin + metrics token live in **ephemeral** page memory (and at most `sessionStorage`).",
      "source": "architect",
      "why": "sessionStorage survives reload, so it cannot implement PM’s reload-may-re-ask or UX’s memory-only tab. It is still a plaintext token at rest without encrypted-at-rest. I already forbade localStorage on that ground; the sessionStorage exception is indefensible.",
      "proposal": "Token and API origin live only in page memory for the tab. Refresh clears them. Not sessionStorage, not localStorage, not query string, not logs.",
      "kind": "technical"
    },
    {
      "quote": "Opening this URL on that origin is **origin-blocked**, not an empty corpus.",
      "source": "pm",
      "why": "The Pages Function 404s `/api/_research` before proxy — that is a trader-origin request to the research family, not the dashboard document. `/_ops/research` JS can still load on Pages. Treating that location host as origin-blocked makes hosted weekly use of the operator URL impossible (Axum does not serve the SPA; local Vite is not hosted weekly use). Copying metrics’ relative fetch 404s the same way. Mechanism already named: page-local client, absolute API origin as runtime input, reject host `*.pages.dev`, existing token header pair, credentials omit. CORS already allows those headers on the exact-origin allowlist (Pages origin membership is a lane-check, not a proxy hole).",
      "proposal": "Keep the Pages `_research` 404. Classify origin-blocked on the research base URL (empty, `*.pages.dev`, or Pages 404 body), not on the dashboard location host. UX owns origin entry. If the human locks ‘this URL on Pages is origin-blocked’ as the product, weekly use is local-Vite-only and I will not add a typed API origin.",
      "kind": "product"
    }
  ],
  "asks": [
    "UX: What operator input captures API origin (public URL, not a secret), and which state-matrix row is origin-blocked / origin-rejected? I will not invent chrome or copy.",
    "PM: If coverage UI is locked Out, is it accepted that this URL cannot answer whether today’s expected live-paid book is present without minting present from list source?",
    "PM: Is production weekly use the Pages-hosted operator URL talking cross-origin to a typed API origin, or must opening that URL on Pages stay origin-blocked (local-Vite only)?",
    "UX: If the human locks coverage Out, do you retract the coverage card and coverage-cell criteria, leaving books list + digest only?"
  ]
}
```
