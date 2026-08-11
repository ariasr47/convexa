# ai-context-pack — pipeline manifest
Entry:        architect-first
Stage:        GATE S — SHIPPED + ARCHIVED (2026-07-06)
Repos:        both
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md        locked
  - PRODUCT_CONTRACT.md             locked
  - UX_BLUEPRINT.md                 locked
  - INTERFACE_CONTRACT.md           locked  (standalone conformance spec: .spire/clusters/tech/state/conformance/ai_context_pack.json)
  - BACKEND_EXECUTION_CONTRACT.md   locked
  - FRONTEND_EXECUTION_CONTRACT.md  locked
Open amendments: none
QA (GATE Q):  QA_REPORT PASS — 26 PASS / 0 FAIL / 0 UNVERIFIABLE (fresh de-correlated Sonnet).
              Conformance new spec + 8-spec no-regression sweep; byte-identity re-derived live;
              nx test dashboard 658/658, @org/api 13/13, tsc -b clean, nx build green.

Build note: both executioner lanes were cut off by an API session limit BEFORE self-reporting (the
"completed" notifications carried a limit banner, not a build report). The conductor treated them as
UNVERIFIED, re-ran every gate, and fixed 3 FE TEST-ONLY defects the cut-off lanes never ran into
(component code correct): (1) source-scan idiom fileURLToPath(new URL(..,import.meta.url)) throws in
this Vitest env → Vite-native `?raw` import; (2) toHaveLength(20)→(23) (7 label families, not 6);
(3) over-broad auth regex /session/i collided with the feature's own copy → narrowed to auth-CTA
phrases + queryAllByText. Also cleaned a stale libs/api/dist (pre-rebrand gammaflow.d.ts) that caused
false @org/api type errors under `tsc -p` — `tsc -b --force` is the reliable typecheck. QA then
independently re-verified all green.

GATE S: GRADUATED `model-read-carries-its-assumptions` (2 binding) → CONTEXT §5 + THREADS §9; new
watch-list key `digested-labels-not-raw-dump`. Canon updated (CONTEXT §5/§6, THREADS §7q/§9, LEDGER,
BACKLOG). Latent (logged, not a regression): off_exchange.blocks[].age_seconds ~1s wall-clock jitter
(display-only/unscored).
Last gateway:  GATE S @ 2026-07-06 — SHIPPED + ARCHIVED
