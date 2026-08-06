#!/usr/bin/env node
// gates.mjs — single-process entrypoint for the four delivery gates (spec §7.1).
//
// Startup dominates gate work ~2.5:1 (spec §1.2), so paying the Node boot once per
// gateway instead of once per gate is the whole point of this file. It ROUTES ONLY:
// any behavior difference between `gates.mjs <tool> ARGS` and `node <tool>.mjs ARGS`
// is a bug in this file. Node builtins only.
//
//   node .claude/tools/gates.mjs contract_lint --canon-only
//   node .claude/tools/gates.mjs context_for {FEATURE} --write
//   node .claude/tools/gates.mjs council_conflicts {FEATURE}
//   node .claude/tools/gates.mjs interface_conformance --contract … --url …
//   node .claude/tools/gates.mjs ledger_tally

import { main as contractLint } from './contract_lint.mjs';
import { main as contextFor } from './context_for.mjs';
import { main as councilConflicts } from './council_conflicts.mjs';
import { main as interfaceConformance } from './interface_conformance.mjs';
import { main as ledgerTally } from './ledger_tally.mjs';

const TOOLS = {
  contract_lint: contractLint,
  context_for: contextFor,
  council_conflicts: councilConflicts,
  interface_conformance: interfaceConformance,
  ledger_tally: ledgerTally,
};

const [sub, ...rest] = process.argv.slice(2);
if (!sub || !Object.hasOwn(TOOLS, sub)) {
  console.log(`usage: node gates.mjs <${Object.keys(TOOLS).join('|')}> [args…]`);
  if (sub) console.log(`  unknown tool: ${sub}`);
  process.exitCode = 2;
} else {
  process.exitCode = await TOOLS[sub]([`${sub}.mjs`, ...rest]);
}
export {};
