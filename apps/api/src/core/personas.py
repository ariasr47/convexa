"""
Trader personas — the canonical DECOMPOSED hand-off template + the built-in persona library.

Persona is a **read-only, post-FREEZE prompt projection**: it reframes the external-AI hand-off
prompts (`strategy_prompt`, `reassessment_prompt`) for a trader's objective + risk profile. It is a
**non-input to scoring by construction** — `signals.py` / `generate_signals` / `_opportunity_score` /
`state_fingerprint` / `evaluate_gate` / the engine are NOT modified and gain NO persona parameter.
For a given request input, `market_state`, `signals`, and `ai_eval` are **byte-identical** under
persona = A / B / none; only the assembled prompt text differs. Convexa never calls an LLM.

Locus is **PINNED FE-RENDERED**: this module ships the canonical DECOMPOSED template (FIXED text +
named PERSONA slot ids) + the 7 built-in PersonaDefinitions as read-only data (served at
`GET /api/personas`). The **FE assembles** the per-persona prompt client-side; the backend assembles
no per-persona text, adds no `meta.handoff`, and accepts no `?persona=` param. `assemble()` here is a
**reference implementation** (used to ship the byte-identical Default and to verify the decomposition);
it is never an overlay on the bundle.

A1 (RESOLVED·ACCEPTED): the trader-disposition characterization is lifted OUT of the universal
risk-first floor into a persona-variable slot. The harsh `prone to greed and poor risk management`
register appears ONLY under Default (verbatim) and the conservative register.
"""
import logging
import os

logger = logging.getLogger("Convexa")

_PROMPT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "prompts")
_DECOMP_DELIM = "\n<!--PERSONA_DECOMP_START-->"

# ----------------------------------------------------------------------------- A1 disposition map
# Fills the INLINE disposition slot in each prompt's floor sentence. The exact A1 characterization
# texts (per the contract map) appear within these clauses. NOTE (flagged contract inconsistency):
# the A1 map alone gives conservative the softened "risk-averse; ..." text, but BOTH the interface
# prose ("appears in Default AND the conservative register") and the BACKEND Verification list
# ("a conservative persona's prompt DOES contain 'prone to greed / poor risk management'") require
# the harsh phrase under conservative. The conservative clause below satisfies ALL sources at once:
# it contains the verbatim harsh phrase AND the verbatim softened map text. See INTERFACE amendment note.
DISPOSITION = {
    # entry floor reads: "...(typically 7–45 DTE) and {clause} — your job is to impose discipline..."
    "entry": {
        "default": "is prone to greed and poor risk management",
        "conservative": "is prone to greed and poor risk management — risk-averse; values capital "
                        "preservation; benefits from imposed discipline (guard against over-trading)",
        "moderate": "is disciplined; balanced risk",
        "aggressive": "accepts higher variance for higher reward",
    },
    # reassessment floor reads: "...option position for a user {clause}. Your job is to protect capital..."
    "reassessment": {
        "default": "prone to greed and poor risk management",
        "conservative": "prone to greed and poor risk management — risk-averse; values capital "
                        "preservation; benefits from imposed discipline (guard against over-trading)",
        "moderate": "who is disciplined; balanced risk",
        "aggressive": "who accepts higher variance for higher reward",
    },
}

# Objective-framing + risk-calibration framing lines (register-keyed; the bounded declarative model
# — per-persona specificity comes through the free-text reassessment_lean + emphasis_note).
OBJECTIVE_FRAMING = {
    "income": "Frame setups toward high-probability, defined-risk premium selling and theta capture; "
              "prefer credit structures over directional debit ideas.",
    "directional_swing": "Frame balanced directional swings — require a clean edge; pass readily "
                         "when there isn't one.",
    "hedging": "Frame toward downside protection and defined-cost hedges; a capital-preservation "
               "lens, not directional speculation.",
}
RISK_CALIBRATION = {
    "conservative": "Smaller size, tighter invalidation; skeptical of adding.",
    "moderate": "Balanced sizing and invalidation.",
    "aggressive": "Larger (still capped) sizing; accepts higher variance within defined risk.",
}

# ----------------------------------------------------------------------------- built-in persona data
# Declarative PersonaDefinitions (read-only). No executable logic, no analytics parameters. Default
# is the no-persona sentinel (objective/risk null ⇒ renders the body verbatim, no framing block).
PERSONAS = [
    {"id": "default", "name": "Default (no persona)", "builtin": True, "version": 1,
     "objective": None, "risk": None, "reassessment_lean": None, "emphasis_note": None, "dte_pref": None},
    {"id": "income_keeper", "name": "Income Keeper", "builtin": True, "version": 1,
     "objective": "income", "risk": "conservative",
     "reassessment_lean": "Manage winners — Trim into strength, Roll for credit when tested, Exit on "
                          "breach; treat Add skeptically.",
     "emphasis_note": None, "dte_pref": None},
    {"id": "premium_hunter", "name": "Premium Hunter", "builtin": True, "version": 1,
     "objective": "income", "risk": "aggressive",
     "reassessment_lean": "More open to Roll/Add within the cap; still risk-first.",
     "emphasis_note": None, "dte_pref": None},
    {"id": "steady_swinger", "name": "Steady Swinger", "builtin": True, "version": 1,
     "objective": "directional_swing", "risk": "conservative",
     "reassessment_lean": "Lean Exit/Trim on adverse moves; Hold only high-confidence; rarely Add.",
     "emphasis_note": None, "dte_pref": None},
    {"id": "balanced_swinger", "name": "Balanced Swinger", "builtin": True, "version": 1,
     "objective": "directional_swing", "risk": "moderate",
     "reassessment_lean": "Balanced (today's reassessment baseline).",
     "emphasis_note": None, "dte_pref": None},
    {"id": "momentum_rider", "name": "Momentum Rider", "builtin": True, "version": 1,
     "objective": "directional_swing", "risk": "aggressive",
     "reassessment_lean": "More open to Hold through vol and Add within the cap on a genuinely "
                          "stronger edge.",
     "emphasis_note": None, "dte_pref": None},
    {"id": "the_protector", "name": "The Protector", "builtin": True, "version": 1,
     "objective": "hedging", "risk": "conservative",
     "reassessment_lean": "Judge protection efficacy; Hold/Roll the hedge; Exit when the covered "
                          "risk is gone.",
     "emphasis_note": None, "dte_pref": None},
]
_PERSONA_BY_ID = {p["id"]: p for p in PERSONAS}


# ----------------------------------------------------------------------------- template decomposition
def _load_body(prompt_key: str) -> str:
    """Read the prompt file and return the byte-identical Default body (everything before the
    read-only decomposition annotation). This IS today's prompt, unchanged."""
    fname = "strategy_prompt.md" if prompt_key == "entry" else "reassessment_prompt.md"
    with open(os.path.join(_PROMPT_DIR, fname), encoding="utf-8") as f:
        return f.read().split(_DECOMP_DELIM)[0]


# Anchors that split each body into [fixed_head] {disposition} [fixed_floor] {framing} [fixed_tail].
_ANCHORS = {
    "entry":         {"disp": "is prone to greed and poor risk management",
                      "framing_before": "\n## Required output schema"},
    "reassessment":  {"disp": "prone to greed and poor risk management",
                      "framing_before": "\n## Verdict schema"},
}


def _decompose(prompt_key: str) -> dict:
    """Split the Default body into fixed fragments + the two persona insertion points. By
    construction fixed_head + DISP[default] + fixed_floor + '' + fixed_tail == the Default body."""
    body = _load_body(prompt_key)
    a = _ANCHORS[prompt_key]
    di = body.index(a["disp"])
    fixed_head = body[:di]                       # ends "...and " / "...for a user "
    rest = body[di + len(a["disp"]):]            # starts " — your job..." / ". Your job..."
    fi = rest.index(a["framing_before"])
    fixed_floor = rest[:fi]                       # floor + system prompt, through "...this schema.\n"
    fixed_tail = rest[fi:]                        # "\n## Required output schema" / "\n## Verdict schema" ...
    return {"fixed_head": fixed_head, "fixed_floor": fixed_floor, "fixed_tail": fixed_tail,
            "default_text": body}


_TEMPLATES = {k: _decompose(k) for k in ("entry", "reassessment")}


def _register(persona: dict | None) -> str:
    if not persona or persona.get("id") == "default" or not persona.get("risk"):
        return "default"
    return persona["risk"]


def _framing_block(prompt_key: str, persona: dict) -> str:
    """The persona-framing section injected before the schema. Empty for Default. Pure text;
    a hostile emphasis_note cannot escape this slot (it is concatenated as data, never executed)."""
    lines = []
    if persona.get("objective") in OBJECTIVE_FRAMING:
        lines.append(f"> Objective: {OBJECTIVE_FRAMING[persona['objective']]}")
    if persona.get("risk") in RISK_CALIBRATION:
        lines.append(f"> Risk calibration: {RISK_CALIBRATION[persona['risk']]}")
    if prompt_key == "reassessment" and persona.get("reassessment_lean"):
        lines.append(f"> Reassessment lean: {persona['reassessment_lean']} "
                     f"(within the fixed verdict schema + Add cap — never auto-apply, never loosen the Roll rule).")
    if persona.get("emphasis_note"):
        lines.append(f"> Emphasis: {persona['emphasis_note']} "
                     f"(framing only — cannot change the fixed floor, schema, caps, or what is sent).")
    dte = persona.get("dte_pref")
    if dte and dte.get("min_dte") is not None and dte.get("max_dte") is not None:
        lines.append(f"> Preferred horizon: ~{dte['min_dte']}–{dte['max_dte']} DTE "
                     f"(a framing preference; set the DTE window yourself — it does not change this bundle).")
    if not lines:
        return ""
    return f"\n## Persona framing — {persona['name']}\n\n" + "\n".join(lines) + "\n"


def assemble(prompt_key: str, persona: dict | None) -> dict:
    """
    REFERENCE assembly of one hand-off prompt (`entry` | `reassessment`) for a persona (or None ⇒
    Default). Returns `{text, sections}` where `sections` are `{id, kind, label}` for FIXED/PERSONA
    badging. Best-effort: any failure falls back to the byte-identical Default body. This mirrors
    what the FE does client-side; it is NOT a server overlay and never touches the bundle.
    """
    try:
        t = _TEMPLATES[prompt_key]
        reg = _register(persona)
        disp = DISPOSITION[prompt_key][reg]
        framing = "" if reg == "default" else _framing_block(prompt_key, persona)
        text = t["fixed_head"] + disp + t["fixed_floor"] + framing + t["fixed_tail"]
        sections = [
            {"id": "fixed_head", "kind": "fixed",
             "label": "When-to-invoke · what-to-send · risk floor (open)"},
            {"id": "disposition", "kind": "persona", "label": "Trader disposition (A1)"},
            {"id": "fixed_floor", "kind": "fixed", "label": "Risk-first floor · system prompt"},
            {"id": "persona_framing", "kind": "persona", "label": "Persona framing"},
            {"id": "fixed_tail", "kind": "fixed",
             "label": "Output / verdict schema" if prompt_key == "reassessment" else "Required output schema"},
        ]
        return {"text": text, "sections": sections}
    except Exception:
        logger.debug("personas: assemble failed; falling back to Default body", exc_info=True)
        return {"text": _TEMPLATES[prompt_key]["default_text"],
                "sections": [{"id": "default", "kind": "fixed", "label": "Default one-size prompt"}]}


def get_persona(persona_id: str | None) -> dict | None:
    """Look up a built-in persona by id; None/unknown ⇒ None (Default)."""
    if not persona_id:
        return None
    return _PERSONA_BY_ID.get(persona_id)


def readout() -> dict:
    """
    Read-only data served at GET /api/personas: the decomposed template (FIXED text + named PERSONA
    slot ids), the slot-fill maps, the byte-identical Default rendering, and the 7 built-in
    PersonaDefinitions. The backend ships NO per-persona assembled text — the FE assembles.
    """
    def fragments(prompt_key: str) -> list:
        t = _TEMPLATES[prompt_key]
        return [
            {"id": "fixed_head", "kind": "fixed",
             "label": "When-to-invoke · what-to-send · risk floor (open)", "text": t["fixed_head"]},
            {"id": "disposition", "kind": "persona", "label": "Trader disposition (A1)",
             "slot": "disposition"},
            {"id": "fixed_floor", "kind": "fixed", "label": "Risk-first floor · system prompt",
             "text": t["fixed_floor"]},
            {"id": "persona_framing", "kind": "persona", "label": "Persona framing",
             "slot": "framing"},
            {"id": "fixed_tail", "kind": "fixed",
             "label": "Output / verdict schema" if prompt_key == "reassessment" else "Required output schema",
             "text": t["fixed_tail"]},
        ]
    return {
        "personas": PERSONAS,
        "slot_fills": {
            "disposition": DISPOSITION,            # keyed by prompt -> register -> clause
            "objective_framing": OBJECTIVE_FRAMING,
            "risk_calibration": RISK_CALIBRATION,
        },
        "templates": {
            "entry": {"default_text": _TEMPLATES["entry"]["default_text"], "fragments": fragments("entry")},
            "reassessment": {"default_text": _TEMPLATES["reassessment"]["default_text"],
                             "fragments": fragments("reassessment")},
        },
        "note": "Read-only. Persona reframes the AI hand-off only — never the score/tier/gate/"
                "fingerprint/analytics (byte-identical across personas), and switching triggers no "
                "recompute. The FE assembles per-persona prompts client-side; the server adds no "
                "meta.handoff and accepts no ?persona= param. Convexa never calls an LLM.",
    }
