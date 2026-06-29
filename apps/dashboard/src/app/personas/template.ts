/**
 * Persona-parametrized hand-off assembly — FE-rendered (locus PINNED). The FE owns a faithful copy
 * of the canonical decomposed template (the backend's `prompts/strategy_prompt.md` +
 * `reassessment_prompt.md` are the source of truth; keep in sync / swap to a backend-served template
 * if one is added). Persona is a presentation overlay: Default renders today's prompt BYTE-IDENTICAL;
 * a persona swaps the trader-disposition slot (A1) and adds framing slots. It NEVER touches the
 * bundle/score/gate/fingerprint, and assembly failure falls back to the Default prompt.
 */
import type { PersonaDefinition, PersonaRisk, Handoff, HandoffPrompt, HandoffSection } from '@org/api';

// The verbatim trader-disposition phrase in today's prompt (A1 relocation target).
const GREED = 'prone to greed and poor risk management';

// A1 disposition map — fills the persona-variable disposition slot. The interface amendment resolved
// the A1-map-vs-prose inconsistency with a SUPERSET for `conservative`: the verbatim harsh phrase
// PLUS the softened map text (so conservative + Default both contain "prone to greed", per the
// verification). Moderate/aggressive carry no greed/discipline-deficit characterization.
const DISPOSITION: Record<PersonaRisk, string> = {
  conservative: 'prone to greed and poor risk management; risk-averse, values capital preservation, benefits from imposed discipline (guard against over-trading)',
  moderate: 'disciplined; balanced risk',
  aggressive: 'accepts higher variance for higher reward',
};

// ---- Canonical prompts, embedded verbatim (Default rendering = byte-identical to today) ----------
export const ENTRY_VERBATIM = `## When to invoke (gate + dedupe)

Invoke the AI **only** when:

\`\`\`
ai_eval.ready == true            # rule layer says it's actionable
AND ai_eval.changed == true      # distinct from the last picture (server-side dedupe)
AND meta.freshness.stale == false
AND ai_eval.state_fingerprint not in <fingerprints you've already evaluated>
\`\`\`

## What to send

- The full bundle from the route: \`market_state\`, \`signals\`, \`strike_profile\`, \`meta\`.
- \`market_state_glossary.md\` as the field reference (definitions, reliability order).
- The requested DTE window (\`market_state.dte_min\` / \`dte_max\`) so the AI sizes the trade
  to the horizon the levels were computed for.

## System prompt (risk-first)

> You are a disciplined options strategist. The user trades **longer-dated** options
> (typically 7–45 DTE) and is ${GREED} — your job is to
> impose discipline, not to find a reason to trade.
>
> Read the bundle using the glossary's reliability order (gamma structure first, then
> IV/HV and VWAP, then max pain, then higher-order greeks directionally). Anchor levels to
> \`gex_spot\`, not \`price\`. Respect the regime: in \`positive_gamma\` favor mean-reversion /
> selling premium; in \`negative_gamma\` favor momentum / buying premium and do NOT fade.
>
> You must lead with risk. Return **\`no_trade\`** when \`signals.setups\` is empty,
> \`meta.freshness.stale\` is true, or there is no clean edge — saying "no trade" is a
> correct and common answer. When you do propose a trade, every risk field below is
> mandatory; do not omit them.
>
> Respond with **JSON only**, matching this schema.

## Required output schema

\`\`\`json
{
  "decision": "trade | no_trade",
  "bias": "long | short | neutral | volatility",
  "structure": "e.g. call debit spread, put credit spread, long calls",
  "strikes": [/* concrete strike(s) */],
  "expiration": "YYYY-MM-DD within the requested DTE window",
  "entry_trigger": "the condition/level that confirms entry",
  "invalidation_level": 0.0,
  "max_risk": "max $ or % of account at risk",
  "position_size": "concrete size consistent with max_risk",
  "exit_plan": { "target": 0.0, "stop": 0.0 },
  "time_horizon": "expected holding period",
  "confidence": "low | medium | high",
  "rationale": "why, citing the specific Convexa levels (walls, flip, magnet, IV/HV)"
}
\`\`\``;

export const REASSESS_VERBATIM = `## When to reassess

Do **not** reassess on stale/overnight/closed data:

\`\`\`
meta.freshness.stale == false
AND live.market_session not in {overnight, closed}
\`\`\`

## What to send — \`reassessment_request\`

The open trade + the current bundle \`market_state\` + a recent decision digest, plus
\`market_state_glossary.md\` and the held contract's current stats (\`option_quote\`, greeks, \`iv\`, \`dte\`).

## System prompt (risk-first, position health)

> You are a disciplined options strategist reviewing an **open** longer-dated (7–45 DTE) option
> position for a user ${GREED}. Your job is to protect capital and
> impose discipline — **lead with risk**, not with reasons to add.
>
> Read the bundle using the glossary's reliability order. Anchor levels to \`gex_spot\`.
> Respect the regime. Weigh the held contract vs the walls, the gamma flip, DTE remaining, and the
> current P/L. Prefer **Hold** or **Exit** over churn; **Trim** to manage risk into strength; **Add**
> only on a genuinely stronger edge (and the app caps the size); **Roll** only when a specific
> better contract clearly improves the risk profile.
>
> Respond with **JSON only**, matching this schema.

## Verdict schema — \`recommendation\` (ingested)

\`\`\`jsonc
"recommendation": {
  "verdict": "Hold | Trim | Add | Exit | Roll",
  "replacement_contract": null,      // REQUIRED only for "Roll": {expiration, strike, right}
  "rationale": "string",
  "verdict_id": "string",
  "status": "ready"                  // "pending" | "ready" | "failed"
}
\`\`\`

- **No auto-apply.** The user **Accepts** or **Rejects**; every choice is recorded. Accept maps:
  \`Hold\`→unchanged · \`Trim\`→reduce qty · \`Add\`→increase **within the operator cap** ·
  \`Exit\`→close + book realized P/L · \`Roll\`→close + open the replacement ghost.
- **Roll constraint:** \`replacement_contract\` MUST be present in the current chain snapshot, else
  the FE defers the Roll until a refresh prices it — not an error.`;

// Section anchors for inserting persona framing (kept verbatim so Default is untouched).
const ENTRY_REGIME_ANCHOR = '> selling premium; in `negative_gamma` favor momentum / buying premium and do NOT fade.';
const REASSESS_ANCHOR = '> better contract clearly improves the risk profile.';

// ---- Section badge metadata (the FIXED/PERSONA tagging the viewer renders) -----------------------
const ENTRY_FIXED: HandoffSection[] = [
  { id: 'when_to_invoke', kind: 'fixed', label: 'When to invoke (gate + dedupe)' },
  { id: 'what_to_send', kind: 'fixed', label: 'What to send (full bundle + glossary + DTE window)' },
  { id: 'risk_first_floor', kind: 'fixed', label: 'Universal risk-first floor' },
  { id: 'output_schema', kind: 'fixed', label: 'Required output / verdict schema' },
];
const REASSESS_FIXED: HandoffSection[] = [
  { id: 'when_to_reassess', kind: 'fixed', label: 'When to reassess (gate + dedupe)' },
  { id: 'what_to_send', kind: 'fixed', label: 'What to send (bundle + glossary + held contract)' },
  { id: 'risk_first_floor', kind: 'fixed', label: 'Universal risk-first floor' },
  { id: 'verdict_schema', kind: 'fixed', label: 'Verdict schema · Add cap · no-auto-apply · Roll constraint' },
];

function personaSections(p: PersonaDefinition, isReassess: boolean): HandoffSection[] {
  const name = p.name;
  const out: HandoffSection[] = [
    { id: 'objective', kind: 'persona', label: `Objective framing · ${name}` },
    { id: 'risk', kind: 'persona', label: `Risk calibration · ${name}` },
    { id: 'disposition', kind: 'persona', label: `Trader disposition · ${name}` },
  ];
  if (isReassess) out.push({ id: 'reassessment_lean', kind: 'persona', label: `Reassessment lean · ${name}` });
  if (p.emphasis_note && p.emphasis_note.trim()) out.push({ id: 'emphasis', kind: 'persona', label: `Emphasis note · ${name}` });
  if (p.dte_pref) out.push({ id: 'dte_framing', kind: 'persona', label: `DTE-preference framing · ${name}` });
  return out;
}

// Default section list: the disposition slot is the only persona-variable region in the verbatim text.
const ENTRY_SECTIONS_DEFAULT: HandoffSection[] = [
  ENTRY_FIXED[0], ENTRY_FIXED[1],
  { id: 'disposition', kind: 'persona', label: 'Trader disposition · Default (no persona)' },
  ENTRY_FIXED[2], ENTRY_FIXED[3],
];
const REASSESS_SECTIONS_DEFAULT: HandoffSection[] = [
  REASSESS_FIXED[0], REASSESS_FIXED[1],
  { id: 'disposition', kind: 'persona', label: 'Trader disposition · Default (no persona)' },
  REASSESS_FIXED[2], REASSESS_FIXED[3],
];

function isDefault(p: PersonaDefinition): boolean { return p.id === 'default'; }

function framingBlock(p: PersonaDefinition, isReassess: boolean): string {
  const lines = [
    `> Persona framing — ${p.objective_framing ?? ''}`.trimEnd(),
    `> Risk calibration (${p.risk}): ${p.risk_calibration ?? ''}`.trimEnd(),
  ];
  if (isReassess && p.reassessment_lean) lines.push(`> Reassessment lean: ${p.reassessment_lean}`);
  if (p.emphasis_note && p.emphasis_note.trim()) lines.push(`> Emphasis (framing only, cannot relax any fixed rule): ${p.emphasis_note.trim()}`);
  if (p.dte_pref) lines.push(`> DTE preference: frame ideas around ${p.dte_pref.min_dte}–${p.dte_pref.max_dte} DTE (the window the user prefers).`);
  return lines.join('\n');
}

function assemblePrompt(p: PersonaDefinition, isReassess: boolean): HandoffPrompt {
  const verbatim = isReassess ? REASSESS_VERBATIM : ENTRY_VERBATIM;
  if (isDefault(p)) {
    return { text: verbatim, sections: isReassess ? REASSESS_SECTIONS_DEFAULT : ENTRY_SECTIONS_DEFAULT };
  }
  const anchor = isReassess ? REASSESS_ANCHOR : ENTRY_REGIME_ANCHOR;
  const block = framingBlock(p, isReassess);
  const text = verbatim
    .replace(GREED, DISPOSITION[p.risk])               // A1 disposition swap (persona-variable slot)
    .replace(anchor, `${anchor}\n>\n${block}`);        // insert persona framing after the regime/Roll line
  const fixed = isReassess ? REASSESS_FIXED : ENTRY_FIXED;
  const sections = [fixed[0], fixed[1], ...personaSections(p, isReassess), fixed[2], fixed[3]];
  return { text, sections };
}

/** Assemble the full hand-off projection (entry + reassessment) for the active persona. Best-effort:
 *  any failure falls back to the Default one-size prompt with `fallback: true` — never throws. */
export function assembleHandoff(persona: PersonaDefinition): Handoff {
  try {
    return {
      persona: { id: isDefault(persona) ? null : persona.id, name: persona.name },
      entry: assemblePrompt(persona, false),
      reassessment: assemblePrompt(persona, true),
    };
  } catch {
    return {
      persona: { id: null, name: 'Default (no persona)' },
      entry: { text: ENTRY_VERBATIM, sections: ENTRY_SECTIONS_DEFAULT },
      reassessment: { text: REASSESS_VERBATIM, sections: REASSESS_SECTIONS_DEFAULT },
      fallback: true,
    };
  }
}
