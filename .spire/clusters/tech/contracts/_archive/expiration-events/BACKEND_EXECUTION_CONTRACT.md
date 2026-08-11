# expiration-events — BACKEND_EXECUTION_CONTRACT (GATE M fast-path)

> Emits exactly what `INTERFACE_CONTRACT.md` pins. Backend only; no UI, no `libs/api`.

## 1. What to build

1. **Extend the projection** in the existing events leaf (`apps/api/src/scanner/events.py`, where
   `project_event_calendar()` already lives) to compute `expirations[]` from **(a)** the already-projected
   upcoming events and **(b)** the bundle's existing full-chain tenor curve (`market_state.term_structure`
   — each point carries `expiration` + `dte`). Implement the containment rule **exactly** as
   INTERFACE §2, including the `amc`-on-expiry exclusion and the `session: null`-on-expiry inclusion.
2. **Wire it at the existing attach site in `main.py`** — the same post-`generate_signals` block that
   already attaches `event_calendar`. The tenor curve must be **read** from the computed bundle; do
   **NOT** modify `compute_term_structure` or anything in `engine.py`.
3. **Extend `.claude/tools/conformance/bundle_events.json`** to pin `expirations` presence + type
   (array). Do not create a second spec file.
4. **Extend the projection selftest** (`events_projection_selftest.py`) with fixture-driven cases —
   RED→GREEN, and the fixtures must include the two cases that cannot occur naturally: **`amc` on the
   expiry date** (excluded) and **`session: null` on the expiry date** (included).

## 2. Binding invariants

- **`[additive-keeps-score-byte-identical]` (HARD).** `engine.py` / `signals.py` / `live.py` /
  `darkpool.py` **0 diff** — this is the one most at risk here, because the obvious implementation is to
  decorate `compute_term_structure` at source. **Do not.** Read the curve off the computed bundle after
  scoring. Prove score/tier/`state_fingerprint` byte-identical vs the pre-change build on a real ticker.
- **`[best-effort-isolated-or-null]`.** No tenor curve, a malformed curve, or any derivation fault ⇒
  `expirations: []`, bundle still **200**. The derivation must not be able to raise into the response
  path (the existing attach-site try/except is the outer guard; do not rely on it alone).
- **`[absent-is-not-none]`** (watch-list key, `bundle-events`). `expirations` is `[]` for `unknown` AND
  `none`, so it is **not** self-disambiguating — `state` governs. Do not invent a per-expiration
  "unknown" token; keep the parent enum authoritative (INTERFACE §3).
- **`[digested-labels-not-raw-dump]`.** Per-entry payload is a **summary** (count + de-duped sorted type
  tokens + first date). Do **not** embed the event objects per expiration — they live once, in `events`.
- **`[model-read-carries-its-assumptions]`.** The containment rule is a modelling choice with a real edge
  case; keep it documented in-code at the point of implementation, not just in this contract.
- **`[live-vs-static-isolation]`.** STATIC — the SSE payload gains no field. Verify explicitly.

## 3. GATE Q surface

Fresh de-correlated `qa-verify` after the lane reports done (venv `apps/api/.venv/Scripts/python.exe`,
`cwd=apps/api`; boot `npx nx serve api`):
1. **The boundary, live** — on a curated ticker with a future event (NVDA, 2026-08-26): tenors before the
   date are `contains_event: false`, tenors on/after are `true` with the right count/types/first date.
2. **The `amc`-on-expiry exclusion and the `session:null`-on-expiry inclusion**, via fixtures. RED both.
3. **`state` still governs** — SPY (`none`) and an uncurated ticker (`unknown`) both yield `[]`.
4. **Byte-identity (HARD)** — score/tier/`state_fingerprint` unchanged vs the pre-change build;
   `engine.py`/`signals.py`/`live.py`/`darkpool.py` diffs **empty**; `compute_term_structure` untouched.
5. **Best-effort** — a bundle without a usable tenor curve ⇒ `[]` + 200.
6. **Ordering + echo fidelity** — ascending by `dte`; `expiration`/`dte` match the tenor curve exactly.
7. **Conformance** — the extended `bundle_events.json` GREEN, plus the existing specs as a regression
   floor. **SSE** gains no field.

## 4. Lane rules

- Writes under `apps/api/` + `.claude/tools/conformance/` only. Commit locally on `main`; **do not push**.
- **Server-kill gotcha:** do **NOT** kill by image — other `python.exe` processes belong to the user (a
  video render, the Claude MCP extension). Find the port owner (`Get-NetTCPConnection -LocalPort 8000
  -State Listen`), read command lines (`Get-CimInstance Win32_Process`), kill only `main.py`/`worker.py`
  and their `multiprocessing.spawn` children (**child first**), then curl-confirm dead.
- Another session is active in this repo: **do not touch** `.claude/contracts/redesign-*` or any
  untracked `apps/dashboard/src/app/auth|landing`, `assets/fonts` paths.
- If the interface proves wrong or under-specified, **STOP and report** (GATE Z) rather than inventing.
