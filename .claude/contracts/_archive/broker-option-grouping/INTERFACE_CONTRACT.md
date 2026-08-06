# broker-option-grouping — interface contract

**Status: `NO_BACKEND_CHANGE`.**

This feature is **frontend-only**. It adds no endpoint, no field, no query parameter, no header and
no envelope change; it expects an **empty `apps/api` diff**, and that empty diff is the proof
obligation for `[additive-keeps-score-byte-identical]` (SPEC §8, AC-31).

**The judgement, stated unambiguously so nobody has to infer it:** `NO_BACKEND_CHANGE` is the correct
marking for this feature — grouping is a pure presentation layer over an already-served payload. A
`## Conformance spec` block is nonetheless carried below, and it is **not** ceremony: it re-pins the
one environment-independent read arm this feature consumes, so `interface_conformance.mjs` has
something executable to run at G1 rather than a paragraph of prose. `contract_lint` M7 would accept
the `NO_BACKEND_CHANGE` marker alone; GATE Q is better served by both.

*(Revised at S2 2026-08-06: no wire change. The only edit is to the import-scope note below, so this
file cannot be read as disagreeing with SPEC §2.3, which was widened from `grouping.ts` to every
file this feature authors. Endpoints, wire types and the conformance block are untouched. **S2 pass 2
(2026-08-06) touched this seam not at all** — its single Critical was about the FE-side structure-name
scan's word list (SPEC §2.3 predicate set B), which reads no wire field and changes no request or
response.)*

---

## Endpoints consumed (all pre-existing, all unchanged)

| Method | Path | Purpose here | Auth | New? |
|---|---|---|---|---|
| `GET` | `/api/broker/book` | The only data source for the grouped view. The FE groups `positions[]` by each option leg's `underlying`; the envelope's `state` / `as_of` / `stale_after_seconds` / `last_attempt_*` drive the unchanged shipped render states and the snapshot-staleness axis. | session cookie | no — shipped in `broker-connect` |
| `POST` | `/api/broker/book/refresh` | Only as the target of the **existing** Refresh control. Grouping adds no call site and no new trigger; it only requires that a refresh returning the same book leaves expanded groups expanded (SPEC AC-25). | session cookie | no — shipped in `broker-connect` |

**Authoritative field list:** `.claude/contracts/_archive/broker-connect/INTERFACE_CONTRACT.md`,
including its **Amendment 1** (option presence rules: Webull supplies no strike / expiry / right /
`contract_multiplier`, so an option is an honest single-leg `partial` position and the ×100
multiplier is reconstructed under four guards, else withheld). That file is the truth; this one
points at it and never restates it.

**Error semantics, streaming:** unchanged. Broker reads are best-effort and never 5xx for broker
trouble; the closed `state: ok | empty | unknown` remains the **sole** disambiguator, and `stale` /
`degraded` remain **derived predicates**, never wire booleans. **Nothing on SSE** — the broker
surface is on-demand + TTL, and this feature adds no stream, no poller and no subscription.

---

## Wire types read by the grouping layer (unchanged by this feature)

Declared in `libs/api/src/lib/broker.ts`, consumed via `@org/api` as **types only**. The grouping
module `broker/grouping.ts` carries the strict **allow-list** — `@org/api` types, `./brokerView` and
`./predicates`, and nothing from `positions/*`. The presentational modules this feature adds
(`broker/BrokerGroupHeader.tsx`, `broker/groupCopy.ts`) carry the **deny-list** form of the same ban
plus the source scan and the render regression, because a component cannot express an allow-list —
SPEC §2.3 is authoritative for all of it. **What matters at this seam is unchanged either way: no
group-shaped type crosses the wire, and nothing on this path reads a field that does not already
exist.**

- **`BrokerBook`** — `state`, `as_of`, `stale_after_seconds`, `positions[]`; feeds `isStale(book,
  nowMs)`, which is the group's `modeled_label` authority.
- **`BrokerPosition`** — reached per member as `BrokerPositionView.broker` (declared
  `brokerView.ts:128`, assigned `:257`). The grouping layer reads `broker_position_id` (the stable
  member sort key, guaranteed stable across refreshes at `broker.ts:87`), `fidelity`,
  `fidelity_notes` (for the derived provenance boolean, computed in `brokerView.ts` only) and
  `legs[]`.
- **`BrokerLeg`** — `kind` (`option` vs `equity`: the membership fact, never inferred from a
  multiplier or a price shape), `underlying` (**the grouping key, taken verbatim — never parsed, no
  normalization, no suffix-stripping, no aliasing**), `quantity` (**SIGNED on the wire by contract,
  `broker.ts:70` — short is negative; the sign of each leg's contribution is a broker-supplied fact,
  never inferred**), `multiplier` (`number?`, **omitted rather than defaulted** — omission is a
  permanent withholding cause), and `cost_basis`.
- **`BrokerFact`** — the closed tri-state `supplied | not_supplied | unparseable` (`broker.ts:46`)
  that the withheld-literal cascade reads per leg. `not_supplied` is permanent, `unparseable` is
  transient, and the two must never collapse into one literal.

**No field is added, renamed, widened or re-typed.** `BrokerLeg.multiplier` remains a bare `number?`
with no provenance discriminator — a `multiplier_source` wire field was considered and **rejected**,
because provenance already reaches the FE as the position-level `fidelity_notes` entry, and adding
the field would break the empty-`apps/api` diff for information the FE can already derive.

**One consequence of the wire shape, stated here because it is a seam fact and SPEC §1 depends on
it:** Webull's `total_cost` is **not** the figure this app renders. The FE composes each leg's cost
from `unit_cost × multiplier × signed quantity`, and where `multiplier` is reconstructed rather than
supplied, the composed figure can differ from the broker's own total by a rounding residual. Both
numbers are recorded in SPEC §1; only the composed one is ever displayed, and no copy on this surface
quotes the difference (SPEC AC-10).

---

## Conformance spec

Environment-independent arm only, and **only** the read this feature consumes. Run with
`--auth-signup`: a fresh throwaway account deterministically has **no** stored credential, so
`GET /api/broker/book` returns the `unknown` / `no_credential_stored` arm — which still exercises
every envelope field this feature depends on for its no-book render states.

The credential-dependent arms (`state: ok|empty`, `positions[]` / leg / tri-state shapes,
`last_attempt_*` under a real fetch) are verified by the backend's adapter characterization tests
over captured payload fixtures plus the FE's own fixture-driven suite — not by this block.
`POST /api/broker/book/refresh` is **deliberately excluded**: a conformance sweep must not force-fetch
against the owner's real Webull rate limits. **Never run this block with `--auth-cookie` against a
credentialed session.**

```json
{
  "comment": "NO_BACKEND_CHANGE. Re-pin of the fresh-session (no-credential) read arm of the endpoint this FE-only feature consumes. Authoritative field list: .claude/contracts/_archive/broker-connect/INTERFACE_CONTRACT.md (+ Amendment 1). No field is added or changed by broker-option-grouping.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/broker/book",
      "auth": true,
      "query": {},
      "required": {
        "state": "string",
        "reason": "string",
        "positions": "array",
        "as_of": "string?",
        "basis": "string?",
        "stale_after_seconds": "number?",
        "account_ref": "string?",
        "last_attempt_at": "string?",
        "last_attempt_outcome": "string?"
      }
    }
  ]
}
```

---

## Explicitly NOT in this interface

- No `group`, `combo_id`, `strategy_id` or any pairing identifier on the wire. **Which legs
  constitute one trade is a separate wire fact `/account/positions` does not carry** — which is why
  the group is a count and a net, and never a name. If such an identifier ever lands, that is
  Stage 2 (SPEC §1) and a different feature.
- No `multiplier_source` / provenance flag (see above).
- No group-shaped response object, no server-side grouping, no new query parameter to request one.
  Grouping is derived FE-side from `underlying`, which is already on the wire.
- No durable server or client key introduced by this feature; expand state is ephemeral React state.
- No write, order, close or modify path of any kind. `[no-real-order-path]` is untouched: the broker
  provider port has **no write method — nonexistent, not disabled**.
