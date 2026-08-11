# R3 — pm reconcile: positions-legs

Three technical conflicts were routed to me. I converge on all three. Each resolution below is written
to be transcribable into the spec without invention: the product decision, what the trader sees instead,
and the exact AC delta.

---

## 1. Cash-secured put is not a derivable name — architect

**Conflict (one line):** a cash-secured put and a naked short put have identical leg sets; the
distinguishing fact is collateral, which is a stated non-goal and absent from the schema, so
`Cash-secured put` cannot be derived.

**CONVERGED.**

The architect's fact is simply correct and it defeats my R1 sentence on its own terms. My §1(b)
conservatism rests entirely on "the name is derived from the legs and nothing else." A name that
requires a fact outside the legs is not a name I can promise, and emitting it would assert collateral
for every short put — including one the trader has nothing behind. That is the mis-labeling risk I
listed as my own risk 4, pointed at me.

**What the trader sees instead:** `Short put`. One name, for every position whose only option leg is a
short put, regardless of what the trader intends the cash behind it to be. No hedged label, no
sub-label, no tooltip that reintroduces the framing in smaller type.

**Concrete decisions R4 should write:**

1. **`Cash-secured put` is removed from the v1 named set.** The revised named set is exactly:
   Shares (long / short) · Long call · Long put · Short call · Short put · Call debit spread · Call
   credit spread · Put debit spread · Put credit spread · Covered call · Protective put · Collar ·
   Long straddle · Short straddle · Long strangle · Short strangle · Iron condor · Iron butterfly ·
   Calendar · Diagonal · **Custom**. Nothing else is named in v1.
2. **Covered call, protective put and collar are untouched** by this ruling and stay named. Their
   distinguishing element is a leg (the shares, the long put, the short call), so they are derivable
   by the same rule that kills the cash-secured label. This is the line: if the thing that makes the
   name true is a leg, it can be named; if it is a fact about the account, it cannot.
3. **No opener-declared intent field in v1** — I am answering the architect's "decided now or not at
   all" with **no**. Three product reasons: it is an unverified self-report that would drive a
   risk-adjacent label the app can never check; the very next feature in this track is the Webull
   import, which will produce positions with nobody present to declare an intent, so the field would be
   populated on hand-entered rows and absent on imported ones and the label would then mean "you typed
   something," not "this is what you hold"; and a durable field that exists only to change a word is
   the weakest possible use of the one cheap migration we get.
4. **Future, dated by trigger:** the cash-secured / collateral framing returns when a cash or
   buying-power model exists (i.e. when non-goal 7 is lifted). Not before, and not via a declared-intent
   shortcut.

**AC delta:**
- **AC-8** — unchanged in wording; its named set is now the revised list above. The illustrative
  examples in AC-8 (`Call debit spread`, `Covered call`, `Iron condor`, `Shares`) already avoid the
  dropped label, so no rewording is needed.
- **New AC-8a [R]** — A position whose only option leg is a short put displays `Short put`. No position
  name anywhere in the app implies collateral, cash set aside, or buying-power state.

---

## 2. "Anything the classifier is not certain about" implies a confidence the recogniser must not have — architect

**Conflict (one line):** my Custom criterion is phrased as a certainty judgement; the recogniser is a
total exact-match function with no score and must not acquire one.

**CONVERGED** — and the correction makes my own argument stronger, not weaker.

I was describing an outcome ("we don't name what we aren't sure of") in the vocabulary of a mechanism I
don't own, and the architect is right that a literal reader builds a fuzzy scorer from it. Determinism
is what I actually wanted: the value of a conservative named set is that a trader who sees a name can
trust it *every time*, and a heuristic scorer would make the same position name itself differently
across renders — which is a worse failure than Custom ever is.

**Restated criterion, verbatim, for the spec:**

> Any leg set that is not an exact match for a structure in the v1 named set renders **Custom**, with
> its leg count. Custom is the residue of an exact match, never a judgement about a leg set.

**Concrete decisions R4 should write:**

1. The right-hand column of my R1 §1(b) table ("Ratio spreads and backspreads", "Call/put butterfly
   (non-iron)", "Non-iron condors", "Boxes, jade lizards", "Anything with >4 legs…") is **illustrative
   consequence, not rule**. The rule is the residue sentence above; those shapes render Custom because
   they are not in the named set, and the table's right column should be written into the spec as
   examples of what falls out, not as a second list to be maintained.
2. **I accept the architect's yield:** `butterfly` and non-iron `condor` are not recognizer members in
   v1. The named set in §1 above is the whole domain; adding a name later is the free change both of us
   argued for and is a Future item driven by what actually shows up as Custom.
3. **Naming call that follows from this, for the enum question UX raised:** the four vertical spreads
   are four distinct trader-facing names — `Call debit spread`, `Call credit spread`, `Put debit
   spread`, `Put credit spread`. **No member of the named set may render two different names**, and no
   label may hedge across two structures. Which discriminator carries that is not my lane; that there
   are four names and not two is.

**AC delta:**
- **AC-9 [R]** — reworded to the residue phrasing: *"A leg set that is not an exact match for a
  structure in the v1 named set displays `Custom` with its leg count, in the same neutral visual
  register as every other name — no error styling, no alert colour, no icon."*
- **New AC-9a [R]** — The displayed structure name never changes unless a leg changes: the same
  position shows the same name across re-renders, reloads and sessions. (Review-verified; the
  mechanism guarantee is the architect's exact-match function, and I am not asking for a test that
  re-asserts a pure function's purity.)
- **AC-10** — unchanged; it is the converse of AC-9a and the two together are the whole determinism
  requirement.

---

## 3. "The number the trader typed" conflicts with per-leg entry prices — ux

**Conflict (one line):** entry prices are stored per leg, so the net is derived; if the trader types a
net instead, per-leg prices must be back-solved into the audit spine — fabricated facts UX will not
write copy for.

**CONVERGED.** UX is right, and I withdraw the sentence.

I wrote "This is the number the trader typed and the number their broker showed them" to defend a
*product outcome* — that one net figure, labeled paid or received, must be on the row — and I attached a
provenance claim to it that I had no business asserting. Between the two possible designs, back-solving
per-leg prices from a typed net writes invented instrument facts into the record that the whole
migration exists to protect, and it would do so in the same store where we refuse to invent an entry
time. A number that is honest about being computed beats a number that lies about being typed.

**Concrete decisions R4 should write:**

1. **Per-leg entry prices are typed by the trader. The net is computed from them and is disclosed as
   computed** wherever it appears — in the entry dialog and on the position row. The app never asks for
   a net and splits it across legs; there is no allocated, back-solved, or apportioned per-leg price
   anywhere in v1.
2. **The product requirement is unchanged and still binding:** every position shows its net entry as
   **one figure, explicitly labeled paid (debit) or received (credit)**. What changed is the provenance
   claim attached to it, not its presence, its prominence, or its label.
3. **The single-leg case is untouched.** For a one-leg position the leg price is the net, the entry
   flow is exactly as fast as today, and AC-7 is unaffected by this ruling.
4. **The sentence in my R1 §2 item 2 — "This is the number the trader typed and the number their broker
   showed them" — must not be carried into the spec.** Replace it with: *"one net figure, computed from
   the trader's own per-leg prices and shown as computed."*
5. **Future, dated by trigger:** a broker record that reports only a combo net fill and no per-leg
   prices. That arrives with the Webull import, not here, and it is that contract's decision how to
   store a net honestly — flagged as broker-reported rather than silently allocated. I am naming it now
   so the importer does not discover it as a surprise, not asking for schema here.

**AC delta:**
- **AC-11 [R]** — amended to: *"Every multi-leg position shows its net entry cost as one figure,
  explicitly labeled paid (debit) or received (credit), and disclosed as computed from the trader's
  per-leg prices — never presented as a quoted, broker-supplied, or directly-entered number."*
- **New AC-11a [R]** — In the entry dialog the trader enters a price per leg and the running net
  updates from those prices, shown as computed from them. There is no field anywhere that asks the
  trader to enter a net for a multi-leg position.
- **New AC-11b [R]** — Until every leg has a price, the running net reads as incomplete rather than
  showing a partial sum. (This is the entry-time twin of the all-or-nothing mark rule all three lanes
  already agreed on; a partial net at entry is the same lie as a partial P/L.)

---

## Deferred to owner

**Payoff math (max loss / max gain / breakeven).** Deferred to owner — I am not re-arguing it here.
One product consequence I own so the owner can price the cut: **if payoff math is cut, AC-14 / AC-15 /
AC-16 / AC-17 drop to Future in full and the row carries no risk slot at all** — a permanently-reasoned
empty slot explaining a feature that does not exist is worse for the trader than no slot, so UX's §6
slot and its withheld-reason copy are cut with them, and UX's contingent 393px conflict about how many
risk figures fit the collapsed card becomes moot unless the owner rules payoff math IN.

---

## Flagged, not resolved in this round

The architect also raised a conflict against my AC-28 / AC-29 (whether the one-time merge notice needs
durable provenance to know that a trader had items in both places, and to stay dismissed). It was not
routed to me this round, so I am not deciding it here — but it is a durable-schema-content question the
architect says must be answered before the schema is frozen, so it needs a line from the owner or a
routing decision from R4 rather than silence. My product requirement, stated so R4 has it: the notice
must survive a reload until the trader dismisses it, and must never reappear after dismissal. Whether
that costs a durable flag is a mechanism call, not mine.
