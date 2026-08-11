# AGENTS.md — Spire Tech boot document (Codex)

You are running the installed `spire:tech` cluster on Codex. Phase 2 static composition and scratch-install tests validate this boot document and its native adapter; they do not prove that a current Codex host executed a role or gate. The verified limitations are stated in §5 below. Read this file and the named project/conductor artifacts before acting.

## 1. Select the installation and context

Read `.spire/clusters/tech/project.json` and `.spire/clusters/tech/context/PROJECT_CONTEXT.md`, then run the installed `$spire-tech` selector or its universal equivalent:

```powershell
node .spire/bin/spire.mjs run tech --provider codex
```

Require success before reading `.codex/ORCHESTRATOR.md`. Selection validates `.spire/installation.json`, `.spire/version`, catalog/descriptor/provider identity, launch adapter, provider config, and immutable artifacts. It records routing evidence only; it does not mean a role or gate executed.

## 2. State and sequence

Project-owned artifacts live under `.spire/clusters/tech/`. Feature contracts are `.spire/clusters/tech/contracts/{FEATURE}/`; state and selector receipts are in the sibling `state/` and `receipts/` directories. Provider-native framework and tools live under `.codex/`.

The conductor sequence is Discovery → Council → Plan → Backend and Frontend → QA → Ship. Every role handoff returns through the conductor; a non-zero gate blocks progress.

## 3. Run gates

```powershell
node .codex/tools/gates.mjs contract_lint FEATURE
node .codex/tools/gates.mjs context_for FEATURE --write
node .codex/tools/gates.mjs council_conflicts FEATURE
node .codex/tools/gates.mjs interface_conformance --contract PATH --url URL
node .codex/tools/gates.mjs ledger_tally
```

Structured write targets are workspace-fenced by `.codex/hooks.json` and `.codex/tools/path_guard.js`. P9 is delivered for structured write tools; arbitrary shell command strings are excluded.

## 4. Kit methods

The twenty-seven installed methods are `spire-tech-acceptance-criteria`, `spire-tech-adversarial-spec-review`, `spire-tech-code-review`, `spire-tech-component-states`, `spire-tech-conformance-receipt`, `spire-tech-contract-consume`, `spire-tech-council-critique`, `spire-tech-debugging`, `spire-tech-design-review`, `spire-tech-flow-integration-tests`, `spire-tech-frontend-patterns`, `spire-tech-independent-conformance`, `spire-tech-interface-conformance`, `spire-tech-invariant-honor`, `spire-tech-lane-refusal`, `spire-tech-mechanism-claims`, `spire-tech-microcopy-integrity`, `spire-tech-react-a11y`, `spire-tech-react-async-data`, `spire-tech-react-composition`, `spire-tech-react-performance`, `spire-tech-react-server-client`, `spire-tech-react-testing`, `spire-tech-risk-based-verify`, `spire-tech-runtime-observation`, `spire-tech-tdd`, and `spire-tech-visual-evidence`. Installed methods resolve under `.codex/skills/`; each named method's file is `<name>/SKILL.md` beneath that directory. The planning method is `.codex/plan/PLAN_METHOD.md`. If host discovery is unavailable, read the exact installed file; do not invent a different method.

## 5. Host boundaries and verified limitations

As of 2026-08-09, official Codex documentation describes custom agents with identity, instructions, model/effort, sandbox, MCP, and skill configuration but no per-agent tool allowlist. P8 therefore remains `0`, docs-derived / unverified. Codex composition emits all nine canonical role TOMLs, including the three council voices, synthesizer, and skeptic. Their tool and role-path restrictions are explicit instructions, not mechanical fences; the shared conductor remains the only handoff hub.

Named dispatch, developer instructions, and model routing are configured in emitted agent TOML. Their exact Phase 2 behavior is docs-derived / unverified on the current host until Task 10 produces attributable model-mediated evidence; selection alone does not close that proof.

As of 2026-08-09, current official docs describe repository skills under `.agents/skills` invoked with `$name`, while deprecated personal custom prompts use `/prompts:<name>`. The exact absence of a project-defined slash command equivalent is docs-derived / unverified. Spire installs its `$spire-tech` adapter at `.codex/skills/spire-tech/SKILL.md` from the dated adapter contract; Task 10 must prove current host discovery before any live claim.
