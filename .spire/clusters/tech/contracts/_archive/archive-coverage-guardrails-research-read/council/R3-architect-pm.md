```json
{
  "role": "architect",
  "pair": "pm",
  "resolutions": [
    {
      "conflict_id": "1fcb87c522fba144510e1ce07c614bbac4f242dc70509f4b7aee14b8baa1dd95",
      "converged": true,
      "ruling": "Superseded by D2: default expected set is one ET date D (today_et_date(now) unless a caller names another YYYY-MM-DD via parse_et_date), not a storing-window grid. SessionChainArchive::list/load return metas and bodies; is_enabled is current Disabled vs not; there is no archive-enabled-at watermark. Inferring the window start from min(LiveMassive et_date) is forbidden because that is the first present book and would omit leading misses (24-25 if 26 is first present). Baking 2026-08-26 into code is forbidden (cited-code-is-verified-not-assumed). Default D=today while the store is enabled cannot be a pre-storing date; a currently disabled store is StoreDisabled (already folded), not a missing grid. Named-date residual: store oracles cannot tell a weekday from before this archive was storing apart from Missing. Distinction without a baked calendar date works only by an optional operator-supplied exclusive ET lower bound B (runtime env and/or CLI; Interface names the spelling). B is operator-asserted and is never derived from list(). If B is set and named D is strictly before B, D is removed from the expected set before per-identity classify: not Missing, not Unreadable, not RejectedSource, not NotYetDue, not IneligibleWeekend; zero due identities; no hole warning; the audit does not fail by itself. That filter is not a multi-day grid and does not reopen D2. If B is omitted, a named ET weekday is expected (ENSURE_SYMBOLS x D minus seed, iff is_et_weekday); load Ok(None) is Missing. That omitted-B case is the accepted residual. Setting B to the first present book re-hides leading misses; that is operator error, not derive inference. AC-12 holds on the default today path and on named D < B; it does not hold on a named weekday without B."
    },
    {
      "conflict_id": "a35113676817db277fb5cc2a41468b505c1ca1f4f8f9f40805f800981d644596",
      "converged": true,
      "ruling": "Accept PM. Last-readable for symbol S at evaluated D is the newest Present LiveMassive identity with et_date <= D. Mechanism: list(symbol, None) returns metas sorted et_date ascending (MemoryInner::list); walk newest-first; skip et_date > D; skip seed (SPY, 2020-01-02); skip meta.source != LiveMassive without load; load + deserialize_capture remaining LiveMassive candidates; skip Unreadable and continue; first readable Present wins. Do not implement the D bound as list(symbol, Some(60)): that keeps the global newest 60 and can be entirely after a historical named D. Cap at most 60 body loads on the et_date<=D walk so a corrupt archive cannot unbounded-read. If none qualify, typed absence: not a fabricated date, not the seed, not another symbol, not a later date that reads as recovery. One per-symbol value for evaluated D (D2 one-date matrix), not a per-historical-row grid column. Cap-hit-without-Present operator copy is architect-ux (be05e536), not this pair."
    },
    {
      "conflict_id": "195f0ecccf5b486648555add335439bb41df5fce3e7c9f302e262a5802dabaf4",
      "converged": true,
      "ruling": "Same mechanism as a3511367. UX global-latest (newest present anywhere in the archive) is withdrawn for this derive: D2 missing with a later Present must not print that later date. Seed skipped, Unreadable skipped, non-LiveMassive skipped without load, et_date > D skipped. Newest Present LiveMassive with et_date <= D, or typed absence. Matches PM AC-5 (D2 last-readable on or before D2) and AC-6 (honest none)."
    },
    {
      "conflict_id": "4756d937ac1c4ddc176726e56cc9f27ac8e67bf30acdc18c825f72ca31f42b76",
      "converged": true,
      "ruling": "Confirm mechanism only. PM self-revision a071ffd7 already withdrew the three-class lock; this does not reopen it. After expected-set and due-clock, due derive is four mutually exclusive arms: Present | Missing | Unreadable | RejectedSource. load Ok(None) -> Missing. load Err whose text is not session archive not storing -> Unreadable. load Ok(Some) whose body fails deserialize_capture -> Unreadable. load Ok(Some) + deserialize_capture Ok + source == LiveMassive + not seed -> Present. load Ok(Some) + source != LiveMassive -> RejectedSource. Today the only non-LiveMassive kind is Fixture; exhaustive match on MarketDataSourceKind so a new kind cannot silently Present. insert_if_absent is first-wins on (symbol, et_date), so a Fixture occupant blocks a later LiveMassive insert; coverage names that hole and does not overwrite or insert. RejectedSource is not Present, not Missing, not Unreadable. It fails the audit (exit 0 only when every due identity is Present) and is one checkpoint-warning identity after D1. Operator literal and warning line are UX, not this lane. Seed exclusion remains only (SPY, 2020-01-02); a Fixture on a live weekday is RejectedSource, not IneligibleSeed. StoreDisabled stays matrix-level (architect-ux e3daa5de), not a due-cell alias of RejectedSource."
    }
  ]
}
```
