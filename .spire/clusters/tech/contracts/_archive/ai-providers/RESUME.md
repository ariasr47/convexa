# ai-providers — frontend lane resume

**Resume status:** CONSUMED
Written: 2026-08-18 (FE resume after crashed spawn `01a01376-9596`)

## Where it stopped

F9 finished. Implementation from F1–F8 was already on disk; this spawn audited SPEC §4,
filled leftover tests + one crash harden, then ran the suite + typecheck.

## Landed this spawn

- Leftover tests: AC-14/15 distinct oauth/subscription Settings + Ask-AI rows; AC-21/29
  export on those reasons; AC-7 named model visible on unpowered Ask-AI; AC-28 deep-link
  click-through; AC-30 no-hex/no-keyframes scan.
- Grok expired card now offers Connect (SPEC reconnect) even when `connected=true`.
- `catalogForPreference` + Settings panel degrade on incomplete/legacy GET ai-key
  (broker.integration was crashing Settings).
- Model-select tests query the visible combobox (hidden native input is not clickable).

## F9

- `npx nx test @convexa/dashboard --skip-nx-cache` → 1912 passed, 1 failed
  (`orders.risk` — accepted pre-existing). `$LASTEXITCODE` 1 because of that file.
  `broker.integration` green after the harden. `app.risk` flake did not fire this run.
- `npx nx typecheck @convexa/dashboard --skip-nx-cache` → exit 0 (cache skipped).

## Visual

Serve `npx nx serve @convexa/dashboard` → :4200 HTTP 200. Chrome DevTools MCP could not
attach (existing chrome-profile lock). Visual inspection **unavailable**. Structural
evidence is the flow/risk specs above.

## Next

QA / GATE Q. Do not restart F1–F8.
