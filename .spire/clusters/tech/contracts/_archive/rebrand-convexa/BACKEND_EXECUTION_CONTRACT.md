# rebrand-convexa — BACKEND EXECUTION CONTRACT (→ apps/api)

> Compressor #3 output. Lane: backend executioner. Inputs: INTERFACE_CONTRACT.md (NO interface
> change), ARCHITECTURE_CONTRACT §0/§1/§3, UX_BLUEPRINT §2C. This lane is **cosmetic rename ONLY.**

## 0. Lane status: COSMETIC RENAME (NO interface change)

Not literally `NO_BACKEND_CHANGE` — backend files ARE edited — but the edits are 100% cosmetic
(internal labels + human-readable prose). **No interface field, envelope key, `meta.*` key, env var,
API path, scoring input, `state_fingerprint`, or persisted-data path changes.** See INTERFACE_CONTRACT.md.

## 1. In scope — rename these (from the Architect's footprint, §0/§1)

| # | What | File(s) | Old → New |
|---|---|---|---|
| 1 | Python logger name (~14 sites) | every `logging.getLogger("GammaFlowAsync")` in `apps/api/**` | `"GammaFlowAsync"` → **`"Convexa"`** |
| 2 | FastAPI app title | `apps/api/main.py:439` | `title="GammaFlow Volatility API"` → `title="Convexa Volatility API"` |
| 3 | Observability ContextVar label | `apps/api/src/core/observability.py:49` | `ContextVar("gammaflow_request_trace")` → `ContextVar("convexa_request_trace")` |
| 4 | Comments / docstrings | backend `*.py` product references | "GammaFlow" (product) → "Convexa" |
| 5 | Prompt / glossary prose | `apps/api/prompts/*.md`, `market_state_glossary.md`, `apps/api/README.md` | product "GammaFlow" → "Convexa"; build-system/method narrative → **unbranded** "the kit"/"the method" (D1) |

Find every backend occurrence with `grep -i gammaflow apps/api` (excluding nothing under `apps/api`;
`_archive/` is not under `apps/api`). Each must resolve to one of the 5 classes above. The exact new
strings are fixed by UX_BLUEPRINT §2C: logger `"Convexa"`, title `"Convexa Volatility API"`,
ContextVar `"convexa_request_trace"`.

## 2. STAYS — do NOT touch (ARCHITECTURE §1B/§3)

- **`DATA_DIR = "data"`** (`main.py:55`) and every persisted-data path — renaming would orphan dumps.
- **Env var names** — none contains "gammaflow"; all unchanged.
- **Interface fields, envelope keys, `meta.*` keys, scoring identifiers, `opportunity_score`,
  `opportunity_tier`, `state_fingerprint`** — byte-identical.
- **Module import boundaries / one-way leaves** (`ai_recommendation`, `auth`, `personas`,
  `observability`) — renaming a logger string / ContextVar label moves no import.

## 3. Hard constraints (MUST hold)

- **NO interface change** (INTERFACE_CONTRACT.md). The ContextVar + logger renames are
  process-internal; the trace payload and `/api/_metrics` field names contain no "gammaflow" and stay
  identical. The FastAPI title is metadata (docs/OpenAPI `info.title`), not a consumed bundle field.
- **`opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical** — engine
  untouched (`[additive-keeps-score-byte-identical]`).
- **The existing conformance specs stay PASSing** — `interface_conformance.py` PASS against
  `user-accounts.json`, `ai_recommendations.json`, `api_metrics.json`, `ticker-load-experience.json`.
- **No env var / interface field / API path / `DATA_DIR` / data-dir renamed.**
- **BOUNCE rule (PRODUCT §7 / ARCHITECTURE §3):** if any backend `gammaflow` reference turns out to
  escape the process (an env var, a serialized field, a path persisted data lives under), it is NOT
  covered by this cosmetic finding — flag it as an ARCHITECTURE amendment; do NOT ship silently. (The
  audit found none.)

## 4. Verification (the BE-owned slice of the AC matrix)

| AC | Check |
|---|---|
| AC-B3 | Boot the app: logger lines show the "Convexa" label; FastAPI title / OpenAPI `info.title` reads "Convexa Volatility API"; no live "GammaFlow" on backend human-readable surfaces |
| AC-C1 | Reproduce a known `opportunity_score` + `state_fingerprint` before/after → byte-identical |
| AC-C2 | `interface_conformance.py` PASS against the 4 existing specs (§3) |
| AC-B4 | `apps/api/README.md` + prompt/glossary prose: product → "Convexa", method narrative unbranded; `_archive`/ledger untouched |

No new conformance spec, no new endpoint, no payload change.
