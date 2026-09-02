# R3 — architect ⇄ pm: capacity-baseline (`c40411fb`)

One exchange. Conflict `c40411fb` only. Already settled and not reopened: commands `load`|`soak`; evidence `local`|`ci`; blended 2.0s and 60s/8+16 withdrawn; soak 10 min local+GATE Q; merge CI is load only.

## Resolution

**CONVERGED.** I withdraw “optional.” Score / tier / fingerprint identity after a successful `load` and after a successful `soak` is **required and ship-blocking**. It is an isolation predicate, not a capacity threshold and not a lab verdict.

**Sentence I no longer defend:** “Optional **byte-identity check** that a warm HTTP bundle's score triple equals the snapshot produced by `compute_analytics_from_vendor` on the same book is a **no-fork proof**, not a lab verdict.”

PM’s proposal stands: keep the triple out of p95 and error locks; require an observable identity proof after a successful load and a successful soak (same inputs, byte-identical score / tier / fingerprint); an empty scoring-engine diff is necessary and not sufficient.

**Mechanism** (how the invariant is observed):

1. **Oracle, before driven work, same harness process.** On the golden fixture book the command already refuses to run without, call production Path-B `compute_analytics_from_vendor` and take `opportunity_score`, `opportunity_tier`, and `state_fingerprint` through the production signal / gate / tier functions. The oracle is that same-process function on that book — not a checked-in score golden, not a second formula, and not a paid-feed A/B (vendor I/O stays zero). `state_fingerprint` hashes regime, vol_regime, setups, score bucket, and distance signs; it does not include wall-clock, so a 10-minute soak on a static book is a fair equality.

2. **Two observations after the closed scenario set, still the same process, on both commands.**
   - One ticker-analysis HTTP GET for that fixture symbol through the production router (post-load this is the warm cache-hit; a miss is still valid). The served triple must be byte-identical to the oracle. This is the no-fork proof: a harness-only scoring path, or a cache that stores a transformed score, diverges here.
   - A second in-process Path-B call on the same book must be byte-identical to the oracle. Warm HTTP alone cannot see an engine mutation that leaves the GEX cache holding the pre-run bundle.

3. **Pass rule.** Either mismatch → that command cannot exit 0. Identity failure is not a p95, unexpected-error, or stream-drop lock, and the receipt still authorizes nothing on live weights or production defaults. Skipping the GET, or comparing Path-B only to itself, is vacuous and is not a pass. A capacity FAIL cannot be turned into PASS by a matching triple. Merge-CI `load` includes this proof (one extra GET + one extra Path-B compute). Soak includes it at local + GATE Q.

4. **Structural companions (necessary, not sufficient).** Empty `libs/quant-engine` feature diff; additive `vendor_fixture` is `None` in production `construct`; production refuses fixture-Some + `APP_ENV=prod`; when the fixture arm is not engaged, today’s four-fetch join is unchanged — trader Path-B stays behavior-identical, including the triple. Nested isolation tests may poison the equality; they do not replace the command-path proof.

5. **Scan narrowing.** R1’s source scan “no `opportunity_score` as a predicate” is withdrawn as written. The scan still forbids using the triple as a capacity threshold (no fail-if-score-below-N). It must allow the equality-to-oracle isolation predicate, and it must assert that the command body actually performs that equality.

Cost is one Path-B compute before work plus one HTTP GET and one Path-B compute after. Isolation observability dominated; the shape is already in-tree (`score_identity.rs`).

## Still disputed

none
