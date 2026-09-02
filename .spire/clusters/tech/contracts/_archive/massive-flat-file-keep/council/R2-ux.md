```json
{
  "role": "ux",
  "agree": [
    "Coverage `present` still means a loadable `LiveMassive` session book.",
    "**Do not** add a `MarketDataSourceKind` variant this slice.",
    "Mechanism: these bytes never become a `VendorBundle` and never reach `insert_if_absent`.",
    "`present` is **not a member**.",
    "**Audience = research operator.** Trader UI is out (`NO_UI_CHANGE`).",
    "Occupancy is **kept** per class.",
    "Aggregates **do not** count as trades or as quotes.",
    "List/load shows three classes, not one blended “tape.”",
    "Vendor day files are universe-per-day; the **durable occupant** is the **locked-name extract** per `(symbol, ET date, file class)`, not a promise to retain the entire US universe file forever.",
    "A keep armed before that line classifies `NotElapsed` and **must not GET** (a pre-due 404 would fabricate `Miss`).",
    "Weekend is `Ineligible`, not miss.",
    "No trader route, no AppShell, no player chrome."
  ],
  "conflicts": [
    {
      "quote": "Layout leaves a closed product slot so aggregates can be added later without restating provenance.",
      "source": "architect",
      "why": "PM locked session-bar aggregates In this slice as a third entitled class (S2 / AC-3 / AC-5), independently occupied and independently claimed. Parking them in a later slot is a silent Out: standing would name only trades and quotes, the list would omit the kind, and a bars-only keep could still be read as “the tape.” BRIEF left aggregates as a council lock, not an architect non-goal.",
      "proposal": "This slice occupies three classes. Operator kind token is `aggregates` (never “session bars”, never “OHLC that proves open-to-close”, never a blended “tape”). Standing payload appends `· aggregates`. If the human takes architect Out, omit the column entirely — do not print `0 aggregates`.",
      "kind": "product"
    },
    {
      "quote": "Retain **both** corpus gzip and extract because a cancelled plan cannot re-GET (the feature’s reason to exist).",
      "source": "architect",
      "why": "PM’s durable occupant is the locked-name extract; full-universe retain is Future-dated. If the root holds the universe gzip, operator standing that says “not a full-universe keep” is a storage claim the data falsifies; if list/load serves that gzip, copy that says watchlist-extract-only is a redistribution/completeness lie. `kept` is an extract claim, not a universe-object claim.",
      "proposal": "Operator-visible occupant and claims stay `(symbol, D, class)` extract. If gzip is retained as a fetch artifact, standing names it as a non-redistributed vendor object, never “we kept the whole SIP day.” Research load returns extract only — never the universe CSV.",
      "kind": "product"
    },
    {
      "quote": "Given D is due and the entitled class is not obtained, occupancy is **miss** — not not-elapsed, not empty extract, not an empty session-day tape, not not-storing.",
      "source": "pm",
      "why": "The operator literal I locked is `flat files miss: vendor file for {ET_DATE} due and absent`. That vouches absence. “Not obtained” also covers vendor-down, 403, truncation, and write-fail — none of which prove the file is absent. Printing `miss` there renames an unconfirmed fetch into a hole (`absent-is-not-none`). Empty extract stays the zero-row-on-a-present-file class; not-elapsed stays the clock class.",
      "proposal": "`miss` only when due and vendor 404/no-such-key is confirmed, or inspect of a named due D with no stored object (BRIEF). Keep transport/unknown failure: `flat files download failed: vendor file for {ET_DATE} not confirmed` — not miss. Truncated stored body: `unreadable`. Credential failures never print as miss.",
      "kind": "technical"
    },
    {
      "quote": "Auth 403/401 → `Unattempted` (credential), non-zero exit, no partial rename.",
      "source": "architect",
      "why": "`Unattempted` is not an operator occupancy word. It collapses GET-not-run, transport failure, and 403/401. A 403 after GET is a fetch, so it cannot stand in for missing-files-credentials or wrong-credential-class (zero fetch). Transport-without-404 is `download failed`, not miss, not empty extract. GET-not-run on a named due D with no object is inspect `miss` (BRIEF), not Unattempted.",
      "proposal": "Type-level may keep a non-miss failed-GET state. Operator print: pair absent → missing-files-credentials (no GET); live key in the files slot → wrong-credential-class (no GET); unknown transport → `download failed`; confirmed 404 → `miss`. Never print `Unattempted`.",
      "kind": "technical"
    },
    {
      "quote": "**Interface / PM** will not collapse occupancy into a boolean `present`/`missing` on the wire; the closed states (`NotElapsed` / `Miss` / `ExtractEmpty` / `Unreadable` / `NotStoring` / …) must remain distinct through to the operator consumer (`absent-is-not-none`).",
      "source": "architect",
      "why": "Distinctness must survive; the printed tokens must not. Operator success occupancy is `kept` / `kept from Massive flat files`, never `present`, never `Stored`. `Stored` is gzip-on-disk and would label a zero-row symbol as success. `ExtractEmpty` is not the operator string `empty extract`. Surfacing type names would rename the values.",
      "proposal": "Map Stored + ≥1 extract rows → `kept from Massive flat files`; ExtractEmpty → `empty extract`; NotElapsed → `not-elapsed`; Miss → `miss`; Unreadable → `unreadable`; NotStoring → `not-storing`; Ineligible → `ineligible weekend`. Do not print `present`, `Stored`, `live`, `live_massive`, or `Live tape` on this vehicle.",
      "kind": "technical"
    },
    {
      "quote": "Mechanism: new optional root; conflict predicate is bidirectional nest against ring, archive index, archive body, **and** the tape root; collision refuses process start (same as tape collision → `Err`, not disabled).",
      "source": "architect",
      "why": "A mis-set keep root would refuse `serve` bind. Traders would lose the desk. That is not `NO_UI_CHANGE` and not live-tick isolation. PM’s collision outcome is keep **refuse to mix** with tape/archive/ring unchanged; not-storing is unset/unwritable, a different class. Architect’s own armed-keep rule says collision refuse is on the armed construct, not on `serve`.",
      "proposal": "Collision refuses armed keep (`refuse to mix`) and occupies none of those roots. `serve` still binds and talks to Massive REST/WS. Operator line is not `flat files not storing`.",
      "kind": "technical"
    },
    {
      "quote": "Mechanism: files client type **has no `api_key` field**; it takes an access-key + secret pair loaded from env **other than** `MASSIVE_API_KEY`.",
      "source": "architect",
      "why": "Different env names do not detect the live REST/WS key placed in the files slot. SigV4 would still GET and 403 as `Unattempted` — a fetch, and not PM’s wrong-credential-class refuse with files-call count 0. Operator copy cannot say “does not fetch” or distinguish that refuse from missing pair or from miss.",
      "proposal": "Armed keep classifies the files pair against the live REST key before any GET. Equal/wrong class → refuse, zero files fetch, literal wrong-credential-class. Missing pair → missing-files-credentials, zero fetch. Source scan on the files leaf remains.",
      "kind": "technical"
    },
    {
      "quote": "Not-elapsed, miss, empty extract, unreadable, not-storing, missing-files-credentials, wrong-credential-class, ineligible-weekend, not-in-watchlist, unauthorized, kept, live-tape, and live-paid-present outcomes are distinguishable in operator keep/list/load without reading source.",
      "source": "pm",
      "why": "Listing `live-tape` and `live-paid-present` as keep/list/load outcomes puts poison tokens on this vehicle. Success occupancy is `kept`, never `present`. `live tape` is a foreign class (session-day-tape / ticker Live tape) and must not appear as a flat-file cell. The same AC then bans coverage/tape literals as this occupancy — the outcome list contradicts the ban and the `live` / `live_massive` / `present` poison.",
      "proposal": "This vehicle’s printed deck is kept · not-elapsed · miss · empty extract · unreadable · not-storing · missing-files-credentials · wrong-credential-class · ineligible-weekend · not-in-watchlist · unauthorized (HTTP). live-tape and live-paid-present are distinguished by absence; poison tests fail if those literals appear here.",
      "kind": "technical"
    },
    {
      "quote": "Armed keep with missing/unusable S3 keys yields **`flat files unauthorized`** and the clause **REST apiKey is not the S3 secret**.",
      "source": "ux",
      "why": "I collapsed three classes into one line. PM requires missing-files-credentials ≠ wrong-credential-class ≠ HTTP unauthorized. Printing the REST-apiKey clause on a mere missing pair asserts a substitution this run did not perform — copy that the data does not support.",
      "proposal": "Missing pair → `flat files unauthorized` (or missing-files-credentials) with no REST clause and no fetch. Live key in the files slot → wrong-credential-class + `REST apiKey is not the files secret` + no fetch. HTTP token miss → shipped `metrics_unauthorized` only.",
      "kind": "technical"
    },
    {
      "quote": "Extract:     watchlist rows only · not a full-universe keep · not a full open-to-close claim",
      "source": "ux",
      "why": "“Not a full-universe keep” is a storage fact I cannot vouch until the occupant lock lands. If architect retains the universe gzip, that standing line is false. The still-defensible hedges are no redistribution and no open-to-close completeness claim from a filtered extract.",
      "proposal": "Standing: product occupant is the watchlist extract · not a full-universe redistribution · not a full open-to-close claim. Drop “not a full-universe keep” as a store assertion.",
      "kind": "technical"
    }
  ],
  "asks": [
    "Architect: if the keep root collides with tape/archive/ring, does `serve` fail to bind, or does only armed keep refuse-to-mix while the desk stays up?",
    "Architect: does `_research` list/load ever return the universe gzip body, or only watchlist extracts?",
    "Architect: how is wrong-credential-class refused with zero files fetch if isolation is only “env other than MASSIVE_API_KEY”?",
    "PM: after architect’s extra-GET / derived-OHLCV argument, are session-bar aggregates still In this slice? Standing will append `· aggregates` only if that lock holds."
  ]
}
```
