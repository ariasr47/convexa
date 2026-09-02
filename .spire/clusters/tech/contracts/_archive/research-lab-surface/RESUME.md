# research-lab-surface — FE RESUME

**Resume status:** CONSUMED

## Done
- F.allowlist → F.sitting-base → F.decks → F.classifier → F.view-model → F.client → F.gate → F.corpus → F.route → F.closer (code + tests on disk)
- Folder `apps/dashboard/src/app/pages/operator-session-archive/` + allowlist helper + structural + route mount `/_ops/research` off-shell
- Feature-focused Vitest: **96 passed**, exit 0
- `npx nx typecheck @convexa/dashboard`: exit **0** (after deleting stale `dist`/`out-tsc` + fixing TS2367)
- Serve `:4200` returned 200 for `/_ops/research` and `/lab`

## Visual
- **Browser MCP unavailable** this session (chrome-devtools profile lock). Structural/jsdom evidence covers locked, origin-rejected (empty/pages/relative), unauthorized, origin-blocked, cors-fault, empty, coverage-unavailable (cold+warm), chip-switch hide, not-storing exclusive.

## Full suite
- `npx nx test @convexa/dashboard`: **2174 passed, 1 failed**, exit 1
- Pre-existing red (not this feature): `session-day-tape-capture.structural.spec.ts` — needles in `sessionTapeStanding.ts` / `widgets/_kit/copy.ts` (outside PLAN allowlist set; dirty-branch trader files)

## Gotchas
- PLAN F.allowlist import path `../../testing/` is wrong from `src/app/` — use `../testing/`
- Node URL hostname for IPv6 is `[::1]` (brackets) — strip before loopback compare
- MUI 9 TextField: `slotProps.htmlInput` for testids (not `inputProps`)
- Typecheck: rebuild `tsconfig.app.json` decls before spec after wiping `dist`
- Skip git commit on mixed dirty tree (operator instruction)

## Next (optional fresh lane)
- Browser visual pass when chrome-devtools free: locked / origin-rejected / unauthorized / coverage-unavailable / stale / occupancy-500 / chip-switch / empty
- Do not claim GATE Q
