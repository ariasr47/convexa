# R3 — architect ↔ pm

One exchange. Conflict `1eba46ca4b905d35549f2fda4ba8f0e4e16bbc15d826fb8851e85b616890833f` (architect → pm: miss vs Unattempted). Related self-revision `7a05fb036614ba8899003c371abe3ea251c34bb56387295563df8e1177a83427` is already folded: PM retracted “not obtained after due = miss.” That retract is honored and is **not** reopened.

Quoted PM sentence under fight: “Occupancy is miss or unreadable as appropriate — not kept.” That row paired keep/fetch faults after due (including vendor down) with miss. It cannot stand under `absent-is-not-none`.

I do not author copy, layout, endpoint signatures, or JSON key spellings. Interface at R4 spells record keys. Operator English stays UX.

## Converged

Yes. Occupancy is a **closed type-level enum**. A later successful GET must not look like filling a hole that was never proved. Fetch fault after due is **not kept** and is **not automatically miss**.

### Mapping (when each class applies)

Classification is per entitled **corpus** identity `(et_date, product)` first. A universe-file miss is **one day-file fact** inherited by every locked-name extract of that product — not three independent per-ticker vendor misses. Extract identity `(symbol, et_date, product)` may still be ExtractEmpty / Unreadable / not-in-watchlist on a Stored corpus.

| Type-level class | When | Mechanism (how, not copy) | Not |
| --- | --- | --- | --- |
| **NotElapsed** | `now_et < D + 1 day 11:00 America/New_York` | due-clock; **GET forbidden** (a pre-due 404 would fabricate Miss) | Miss |
| **Ineligible** | session D is ET Sat/Sun | weekday rule; **GET forbidden** | Miss |
| **NotStoring** | dedicated root unset / empty / unwritable | refuse-before-GET; store cannot accept an occupant | Miss, empty extract, missing-files-credentials |
| **MissingFilesCredentials** | armed keep, files access+secret pair absent | refuse-before-GET; files-call count **0** | NotStoring, Miss, Unattempted, HTTP unauthorized |
| **WrongCredentialClass** | live REST/WS key value placed in the files-secret slot | refuse-before-GET; files-call count **0** (runtime compare against the live REST key, not only a source scan of the env name) | MissingFilesCredentials, FetchAuthRejected, Miss |
| **NotInWatchlist** | named symbol not in the locked trio | no extract; **GET not implied** | Miss |
| **Unattempted** | D is due, **no durable occupant**, **no proved-absence record**, and **GET was not run** | inspect / list / load of a never-kept due date; keep not armed. **Do not call S3 to confirm an inspect miss.** Store-absent is not vendor-absent. | Miss, NotElapsed, NotStoring |
| **TransportUnconfirmed** | D is due; **GET was issued**; response is not 404 / NoSuchKey (timeout, reset, DNS, 5xx, vendor-down, truncated-in-flight, local write/fsync/rename fail before a durable locator) | absence **not** proved; temp is not Stored; no partial rename | Miss, Unreadable, Unattempted (GET-not-run) |
| **FetchAuthRejected** | D is due; **GET was issued**; HTTP 401/403 from the files endpoint | SigV4 rejected or files plan refused the object; that is a **fetch**, not a missing pair, and **not** vendor absence. PM R2 agree (“Wrong guess → 403 Unattempted, not Miss”) stands as **not-Miss**; type-level this arm stays distinct from GET-not-run so inspect and a 403 cannot share one hole. | Miss, MissingFilesCredentials, OperatorUnauthorized |
| **Miss** | D is due **and** a keep GET **completed** with vendor **404** or S3 **NoSuchKey** on the entitled object | absence **proved** at the files endpoint after the due line. Persist a **proved-absence record** (not a gzip). List/load after cancel reads that record with **zero vendor I/O**. | empty extract, Unattempted, TransportUnconfirmed, Unreadable, NotStoring |
| **Unreadable** | a **durable local object/pointer exists** (successful rename or planted occupant) and gzip-magic / csv / header / ticker-column filter fails | body or extract cannot be loaded as reconstructable history. Truncation **after** rename is this class; truncation **before** rename is TransportUnconfirmed. | empty extract, Miss, NotStoring |
| **Stored** | corpus gzip on disk, gzip-magic + digest ok | first-wins successful corpus bytes | coverage `present` (banned on this vehicle) |
| **ExtractEmpty** | corpus Stored; locked symbol has **zero** rows for that product | we got the file; the name is quiet | Miss, Unreadable, Unattempted |
| **OperatorUnauthorized** | research list/load without the operator token when a token is required | existing operator-token gate; **zero vendor**; no extract body. Trader session cookie is not this gate. | FetchAuthRejected, MissingFilesCredentials, Miss |

`present` is **not a member**. Live tape / live paid book remain other stores.

**Already-kept wins:** a Stored reconstructable extract is not overwritten by a later empty extract, Unreadable blob, Miss record, or unconfirmed fetch.

**Retry:** Miss, Unattempted, TransportUnconfirmed, and FetchAuthRejected may be retried by a later armed keep. Unattempted / TransportUnconfirmed / FetchAuthRejected becoming Stored is **not** “filling a Miss.” Only a prior proved-absence record becoming Stored is filling a Miss.

**AC-15 residual (product text, not a new fight):** after PM’s retract, the ship-blocking miss path is **due ∧ keep GET 404/NoSuchKey**, not “any entitled class not obtained.” The fetch-fault row is **not kept**, then Unreadable **xor** TransportUnconfirmed **xor** FetchAuthRejected — never a default Miss.

### Inspect vs keep (the BRIEF “missing file” sentence)

BRIEF: a missing file after it is due is a miss, not an empty tape. **Missing** here means **proved vendor absence**, not store-absent. PM’s inspect proposal is accepted: due + no stored object + no proved 404 → Unattempted, not Miss. Empty extract stays the zero-row-on-a-present-file class.

## What I withdraw

- I **withdraw** R1’s single `Unattempted` bucket as sufficient occupancy **content**. GET-not-run, transport-without-404, and 401/403-after-GET cannot share one type if later GET success, inspect, and credential refuse must stay distinct from Miss and from each other. R1’s sentence “Auth 403/401 → `Unattempted` (credential)” remains **true as not-Miss and no partial rename**; it is **false as identity** with inspect GET-not-run or with missing-files-credentials (zero fetch).
- I **withdraw** any reading of vendor-down / write-fail as “miss or unreadable as appropriate.” Vendor-down without 404 is TransportUnconfirmed. Unreadable requires a durable local pointer.
- I **do not withdraw** Miss = due ∧ vendor 404 / NoSuchKey. I **do not withdraw** “do not call S3 to confirm an inspect miss.”
- I **do not re-ask** PM to defend “not obtained after due = miss.” That claim is dead.

Not in this exchange: aggregates In/Out, universe-gzip retention, collision vs `serve` bind, operator literals (`kept` / `download failed` / never print `Unattempted`). Those remain other conflicts. Residual UX inspect-as-miss (`22159b6e…` / `75e92688…` / `f91d4ee8…`) is **architect ↔ ux**, not a PM split: this pair already rejects fabricating a vendor hole on zero-S3 inspect.

## Named mechanism

**Proved absence vs unconfirmed fetch vs GET-not-run**, implemented as classify-then-maybe-GET, with a local proved-absence record so Miss survives cancel.

```
armed keep?
  no  → open dedicated root only (vendor counter 0)
        durable gzip+digest ok     → Stored / ExtractEmpty / Unreadable
        proved-absence record      → Miss          (no GET)
        else, D not due            → NotElapsed / Ineligible
        else, root unusable        → NotStoring
        else                       → Unattempted   (GET not run; not Miss)
  yes → refuse-before-GET if:
        NotElapsed / Ineligible / NotInWatchlist / NotStoring /
        MissingFilesCredentials / WrongCredentialClass / mix-collision
        (files-call count 0; none of these are Miss)
      → else SigV4 GET of the entitled universe key
        404 / NoSuchKey            → persist proved-absence record → Miss
        401 / 403                  → FetchAuthRejected (fetch happened; not Miss)
        transport / 5xx / no-rename → TransportUnconfirmed (not Miss; temp discarded)
        2xx + fsync + rename + gzip-magic + digest
                                   → Stored; extract filter
                                      zero watchlist rows → ExtractEmpty
                                      csv/header fault    → Unreadable
```

**Proved-absence record (content, not keys):** `(et_date, product)`, files endpoint status class 404/NoSuchKey, observed-at UTC. No gzip body. Not Stored. First-wins against a later unconfirmed fetch; a later 2xx successful corpus **replaces** it. Without this record, list/load after cancel cannot represent Miss without re-GET, and inspect would either fabricate Miss or forget a proved hole.

**Why not collapse (axes):** complexity of one extra sidecar class is lower than a re-GET on inspect (cost + cancel-then-load) and lower than treating store-absent as Miss (honesty). Familiarity: same first-wins + sidecar pattern as the successful digest; coverage `present` stays off this vehicle.

**Attackable assumptions (not this pair’s remaining fight):** (1) Massive files endpoint uses 404 / NoSuchKey rather than a 200 empty object for a unpublished key — if it returns 200 empty gzip, classify Stored then ExtractEmpty/Unreadable, never Miss. (2) UX may still refuse the type-name `Unattempted` as an operator word; that is copy, not this mapping.

No remaining architect ↔ pm split on this conflict. If a later voice restores “due and not obtained = miss,” that reopens a withdrawn claim — do not promote it as a new product question from this pair.
