```json
{
  "role": "pm",
  "agree": [
    "The public `/lab` hub stays instrument demos with synthetic data.",
    "Same-origin `fetch('/api/_research/...')` **is** a trader-origin request and **must** 404.",
    "Copying `fetchMetrics()` (relative `/api/_metrics`, no token header) cannot satisfy weekly production-corpus use: production requires `METRICS_SECRET_TOKEN` (`production-fails-closed`), and Pages never proxies this prefix.",
    "API origin is a **runtime** operator input, not a baked backend URL (`[no-secrets-in-image]`).",
    "`present` is **only** a loadable `LiveMassive` body.",
    "Tape / snapshots / flat-files keep their own closed decks (`kept`, tape provenance, ring snapshots) and are the dump/replay temptation; they stay non-goals.",
    "Empty `apps/api` diff is the structural score-identity proof.",
    "TopNav `NAV` and the mobile drawer stay exactly the trader set.",
    "Refreshing the tab forgets the token.",
    "That friction is accepted; persisting `METRICS_SECRET_TOKEN` in the browser is not.",
    "I will not agree to a unified “status” column.",
    "It must **not** grow a `present` / `kept` column.",
    "Flat-file / tape / snapshot vehicles are **absent** from v1 chrome (no `kept` extract table, no tape clock, no ring miss string)."
  ],
  "conflicts": [
    {
      "quote": "Session-archive books are the spine; archive-coverage is the one sibling occupancy read I admit in v1.",
      "source": "architect",
      "why": "The brief names the v1 vehicle set as a council lock (books-only vs books+coverage vs also tape / snapshots / flat-files). Decision-impact observation is list SPY session books and open one dated book, not read today’s coverage cells. Coverage is a sibling the council may admit later. Shipping it this slice puts the coverage deck on the same screen as the books list — the occupancy-leak this slice is designed not to make. Honesty of `present` does not require a matrix here: this screen does not speak `present`; list provenance is not a coverage cell.",
      "proposal": "v1 = session-books list + digested open for SPY, QQQ, and IWM on `/_ops/research` only. Coverage stays Future-dated on the same operator URL family, visually partitioned, printing only its own closed deck. Books table never grows a `present` or `kept` column. Do not derive coverage cells from list source.",
      "kind": "product"
    },
    {
      "quote": "Unlock with the metrics token, see whether this process has SPY (and the liquid trio) session books, open one dated book as a research read with zero Massive, and read today’s coverage cells without renaming `present` or treating a local matrix as hosted coverage.",
      "source": "ux",
      "why": "Same scope call. Reading today’s coverage cells is the archive-coverage job, not the corpus-browser job the brief observes. I accept the occupancy rules inside that sentence — do not rename `present`; a local matrix is not hosted coverage — as binding when coverage ships. They do not pull the matrix into this slice.",
      "proposal": "Primary job this slice: with the metrics token, list SPY/QQQ/IWM session books and open one dated book as a digested research read with zero vendor. Coverage cells stay out of v1 chrome.",
      "kind": "product"
    },
    {
      "quote": "Optional local JSON export may serialize the load body on the operator machine (metrics-page Export precedent: client-only, no server write).",
      "source": "architect",
      "why": "Download/export of paid books is Out. Metrics export is an instrumentation snapshot, not a paid options capture. A weekly URL that writes the load body to disk is a redistribution path for research that authorizes nothing.",
      "proposal": "No export or download control this slice. The load body stays in memory for digested confirmation only and is never serialized to a file from this surface.",
      "kind": "product"
    },
    {
      "quote": "API origin + metrics token live in **ephemeral** page memory (and at most `sessionStorage`).",
      "source": "architect",
      "why": "`sessionStorage` keeps a plaintext metrics token across reload. That is a secret in the browser, not sitting-only memory. Reload re-ask is expected, not data loss; persisting the operator token in the browser is not.",
      "proposal": "Token and API origin live in page memory for the tab only. Refresh re-asks. No `sessionStorage`, no `localStorage`, no query string.",
      "kind": "technical"
    },
    {
      "quote": "Corpus data is available only from an origin allowed to reach the research family (the same class of access as operator metrics).",
      "source": "pm",
      "why": "SELF-REVISION — I withdraw the parenthetical. Architect showed a same-origin research fetch from Pages must 404, and copying the metrics relative client cannot list or open books in production. Origin-blocked stays first-class and distinct from empty and unauthorized. I no longer claim research is reachable the way metrics is.",
      "proposal": "Pages research 404 stands. Weekly list/open needs a runtime non-Pages API origin the operator supplies in the sitting, plus the metrics token. Local Vite proof stays local evidence, not hosted weekly-use proof.",
      "kind": "technical"
    }
  ],
  "asks": [
    "UX: what is the operator-visible runtime API-origin control (reject `*.pages.dev`, not in the URL, not baked, not durable) so token unlock can list/open from a hosted sitting, and where does origin-rejected live in the state matrix so it is distinguishable from unauthorized, empty list, and generic readout-unavailable?",
    "Architect: do existing session-books list/load already distinguish empty / not-storing / no session book / unreadable without a coverage read this slice, so those outcomes have vouched homes if coverage stays Future?",
    "Architect: is the production Pages HTTPS origin already on the browser-origin allowlist, or does hosted weekly use fail even after the operator supplies the API origin?"
  ]
}
```
