```json
{
  "role": "ux",
  "agree": [
    "The public `/lab` hub stays instrument demos with synthetic data.",
    "Pick **B**. Decisive axes: **`present-is-live-paid-only` + BRIEF weekly-use**, then complexity.",
    "Pick **A**. Decisive axis: **`operator-vs-trader-path-separation`**.",
    "Same-origin `fetch('/api/_research/...')` **is** a trader-origin request and **must** 404.",
    "Copying `fetchMetrics()` (relative `/api/_metrics`, no token header) cannot satisfy weekly production-corpus use: production requires `METRICS_SECRET_TOKEN` (`production-fails-closed`), and Pages never proxies this prefix.",
    "Raw `market.contracts` / bars / minutes / trades are **not** a UI structure.",
    "Token never in the query string, never in `console.log` of headers, never in UI copy.",
    "**Trader session cookie is not a gate and not a fallback.**",
    "Reload may re-ask — expected, not framed as data loss.",
    "**Operator-facing name is not Lab.**"
  ],
  "conflicts": [
    {
      "quote": "This slice **does not speak the coverage deck** (`present` / `missing` / `not yet due` / `blocked occupancy`) because coverage UI is out.",
      "source": "pm",
      "why": "Occupancy honesty cannot mint `present` from a list `source` token; that is fabricated coverage. The BRIEF allows coverage as a sibling the council may admit, and a partitioned coverage card already prints the closed HTTP deck while the books table prints `source` verbatim with no `present`/`kept` column — mixing is a layout failure, not a reason to omit the only vouched `present` surface. Never speaking the deck will push operators to read `source: live_massive` as live-paid `present`.",
      "proposal": "v1 = session-books spine + one partitioned coverage card on `/_ops/research` (closed cells, `Evidence: this process`, no CLI `[PASS]` line). Tape / snapshots / extracts stay out. List never grows a `present` column.",
      "kind": "product"
    },
    {
      "quote": "API origin + metrics token live in **ephemeral** page memory (and at most `sessionStorage`).",
      "source": "architect",
      "why": "Reload-reask and memory-only are already locked. `sessionStorage` survives refresh, is a plaintext secret-at-rest, and is the remember-me store architect said they have not designed. It is the same class as `localStorage` without `[secret-encrypted-at-rest]`.",
      "proposal": "Token (and any API-origin string) stay in page memory for the tab only. Refreshing re-asks. Never `sessionStorage`, `localStorage`, query string, `document.title`, error text, or aria.",
      "kind": "technical"
    },
    {
      "quote": "Optional local JSON export may serialize the load body on the operator machine (metrics-page Export precedent: client-only, no server write).",
      "source": "architect",
      "why": "PM already forbids download/export of paid books. Serializing the load body writes `market.contracts` to disk — the chain dump this surface must not present, now as a file. Metrics export is process metrics, not a paid-chain precedent.",
      "proposal": "No export/download control in v1. Digest is on-screen identity + array counts only.",
      "kind": "product"
    },
    {
      "quote": "**`review` owns** digested-vs-dump composition (AC-11), in-flight vs empty as visible standing (AC-25), non-absorption of sibling vehicles (AC-40), not naming it Lab (AC-41), motion/token discipline (AC-42).",
      "source": "pm",
      "why": "UX owns Verify-by. A contracts table or a tape/extract card can look intentional on a copy pass; dump-absence and sibling-vehicle absence silently regress. In-flight standing, not-naming-Lab, and motion/hex may stay review.",
      "proposal": "Mark dump-absence (no `market.contracts` / OHLC / tape rows) and sibling-vehicle absence (no tape / snapshot / extract tables) as `test`. Keep AC-25, AC-41, and AC-42 as `review`.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: is a visible API-origin control in v1 so Pages-hosted `/_ops/research` can browse the Railway research family, or is origin-blocked on `*.pages.dev` the accepted production outcome (weekly use only from an already-reachable origin)?",
    "Architect: if origin is a runtime field, which reject/fault arms must stay distinct in the view-model for copy — empty origin, `*.pages.dev`, CORS failure, relative-404 origin-blocked, 401 — so none collapse to empty-list or unauthorized?",
    "Architect: when list `source` is an unknown wire token, does the operator see the raw string or a distinct unavailable arm, and may that arm print the unknown token verbatim without reading as `present` or `live_massive`?"
  ]
}
```
