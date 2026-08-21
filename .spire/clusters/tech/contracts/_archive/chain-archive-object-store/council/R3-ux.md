```json
{
  "role": "ux",
  "converged": true,
  "resolutions": [
    {
      "conflict_id": "a22173172f27018a88e09904b0be15db2c4db11be78f99e453d7a04b2de91c47",
      "resolution": "Reclassify AC-15 (trader-UI silence / no new trader chrome) and AC-24 (`authorizes: nothing` on research hit) as Verify by **test** — structural `apps/dashboard` empty-diff / no new trader route or affordance, plus research-wire assertion that the hit envelope keeps `authorizes: nothing`; no DOM harness. Leave AC-19–AC-23 and AC-25 as **review**."
    },
    {
      "conflict_id": "40a7bfedb6e77921766d338eab5c3c1e09d453b7615043e54b5c8ac4bf944407",
      "resolution": "Bind AC-8's operator-visible outcome to the exact shipped string **`session archive not storing`** when the archive/store is disabled / not configured / unavailable at open. Drop the parenthetical \"or store-error\" alias for that class. Keep list metadata I/O faults on **`session archive store error: <reason>`** and missing/corrupt body on **`session book unreadable: <reason>`**. SPEC honesty observables are the exact shipped strings (`no session book for <SYMBOL> on <ET_DATE>` / `session book unreadable: <reason>` / `session archive not storing`); shortened AC labels are aliases only — not a second vocabulary."
    }
  ],
  "still_open": [
    {
      "conflict_id": "c705f8f76927879fb69f9f38b0575c7b5cbda31ebf87bbefdcbd9ed273890643",
      "reason": "Product — exact reuse of shipped session-archive operator strings vs \"lightly touch\" research wording when object-miss becomes common. Not settled in this technical exchange; awaits operator."
    }
  ]
}
```
