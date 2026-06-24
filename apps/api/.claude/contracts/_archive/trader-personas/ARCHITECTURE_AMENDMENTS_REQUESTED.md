# ARCHITECTURE_CONTRACT — amendments requested (GATE Z bounce: PM → Architect)

> Owner to resolve: **Architect**. Blocking: **UX/Tech-Writer cannot start until this is resolved**
> (UX would author disposition copy against a FIXED/variable boundary that is about to move).
> Source: `PRODUCT_CONTRACT.md` → "Amendments bounced to Architect". Reader has
> `GAMMAFLOW_CONTEXT.md` + `ARCHITECTURE_CONTRACT.md` + `PRODUCT_CONTRACT.md` + this file.
> Status: **A1 OPEN**. `ARCHITECTURE_CONTRACT.md` is marked **CONTESTED** in `_MANIFEST.md`.

## A1 — Move the trader-disposition characterization from a FIXED section to a persona-variable slot
**Contested clause in the locked Architecture:** the FIXED (persona-invariant) "risk-first floor"
currently absorbs the prompts' trader-disposition line — the assertion that the trader is
*"prone to greed and poor risk management."* Under the locked FIXED/variable decomposition that line
ships to **every** trader under **every** persona.

**Repo-grounded (Orchestrator-verified):** the line is FIXED in both hand-off prompts today —
- `prompts/strategy_prompt.md:38` — "…and is prone to greed and poor risk management — your job is to…"
- `prompts/reassessment_prompt.md:47` — "…position for a user prone to greed and poor risk management.…"

**Why it must change:** the feature's goal is to brief the AI for *who the trader actually is* across
a wide array of traders. A blanket psychological assumption baked into a FIXED slot contradicts that
goal and is unreachable by any persona under the current split — a disciplined-trader persona could
never shed it.

**Buildable alternative the PM requests (Architect's call — FIXED/variable is your boundary):**
split *only the characterization of the trader* out of the FIXED risk-first floor into the existing
**persona-variable slot family**. Per-persona characterization, e.g.:
- `conservative` → "risk-averse; values capital preservation"
- `moderate` → "disciplined; balanced risk"
- `aggressive` → "accepts higher variance for higher reward"
- the "prone to greed / poor risk management" wording survives as the **conservative/novice persona's**
  framing — not a universal line.

**What stays FIXED (unchanged — the universal discipline floor):** lead with risk; `no_trade`/Hold is
valid; JSON-only; anchor to `gex_spot`; reliability order; respect regime; the output/verdict schema;
the Add cap; no-auto-apply; the Roll constraint; the "what to send" field set.

**Why this is safe (the constraint that makes it acceptable):** the line is **not deleted**.
**"Default (no persona)" still reproduces today's exact prompt verbatim, greed line included.** The
reclassification changes behavior **only when a persona is active**. The no-op-when-absent and
byte-identical guarantees (`market_state`/`signals`/`opportunity_score`/`ai_eval`/`state_fingerprint`)
are **unaffected** — this is a FIXED-vs-variable boundary move within the prompt-template
decomposition, touching **no** analytics, scoring, gate, fingerprint, or transport.

## Resolution options for the Architect
- **Accept** → update the ARCHITECTURE_CONTRACT's prompt-template FIXED/variable decomposition to
  place trader-disposition characterization in the persona-variable slot family (Default + the
  conservative/novice persona retain the original wording); clear the CONTESTED flag; hand off to the
  **UX/Tech-Writer** (the PM already ran — A1 is the only open item).
- **Counter** → if any part is un-buildable or violates the boundary, state why and propose the
  closest buildable alternative, and bounce it **back to the PM** as a PRODUCT_CONTRACT amendment
  (the PM re-accepts before UX starts). Do not silently absorb or narrow scope.
