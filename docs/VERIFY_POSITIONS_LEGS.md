# Manual verification — multi-leg positions (`positions-legs`)

> **What this is.** A hands-on walkthrough of the `positions-legs` feature, shipped 2026-07-28.
> Automated verification already passed (83/83 acceptance criteria, on a reviewer model deliberately
> different from the ones that built it). **This guide is not that.** It exists so *you* can see the
> thing with your own eyes, in your own browser, against your own data.
>
> **Time:** ~25 minutes for Parts A–C, ~10 more for Part D. Parts can be done separately.
> **You need:** the app running locally, and about 5 minutes of DevTools comfort for Part D.
>
> Every quoted string below is copied from the shipped source, not paraphrased — if you see something
> different on screen, that is a real finding, not a wording drift in this document.

---

## 0. Before you start

### 0.1 Start the three processes

```bash
npx nx serve api
```

```bash
npx nx serve dashboard
```

```bash
npx nx run api:serve-worker
```

The dashboard is on **http://localhost:4300** (`.claude/launch.json` pins it there — not 4200). The
API is on :8000. The worker has no web page; it writes scanner data in the background and is not
needed for anything in this guide — start it only if you want the Scanner page populated.

### 0.2 Back up your book first

On **`/positions`**, click **Export JSON** and keep the file somewhere.

You almost certainly do not need it — the migration never deletes its source data — but it runs
**once** and does not re-run, so a copy costs you nothing and removes the only real risk here.

### 0.3 Sign in

**You must be signed in to open a position.** Signed out, the Positions page shows *"Sign in to track
simulated positions."*

⚠️ **Known rough edge, not part of this feature:** while signed out, the **+ Open simulated position**
button still looks fully enabled and **does nothing at all when clicked** — no dialog, no prompt, no
message. This comes from the accounts feature, not from `positions-legs`. If you click it and nothing
happens, you are signed out. (It is the same class of problem this feature *fixed* for the faulted
state, so it is worth fixing there too.)

### 0.4 Know which page does what

| Page | Entry button | Legs |
|---|---|---|
| **Ticker** (`/ticker/SPY`) | `+ Open simulated trade` | **Single leg only — deliberately.** Quick entry. There is no "Add leg" here and that is correct |
| **Positions** (`/positions`) | `+ Open simulated position` | **Multi-leg.** This is the one with `+ Add leg` |

If you go looking for multi-leg entry on the Ticker page you will not find it and will think the
feature is broken. It is not.

---

## Part A — the merge (the highest-stakes part)

You previously had **two** separate stores that could disagree: trades you tracked from a ticker page,
and positions you opened on the Positions page. They are now **one book**.

The merge runs automatically the first time you load the new build. It is a one-way promote: it reads
`convexa.positions.v2` and `convexa.ghost-trade.v1`, writes `convexa.positions.v3`, and **never deletes
either source**.

| # | Do | Expect |
|---|---|---|
| A1 | Load `/positions` for the first time on the new build | If you had records in **both** old stores, a one-off notice appears |
| A2 | Read the notice | Exactly: *"Trades you tracked on a ticker page and the positions you opened here are now one book — everything from both is in the list below. Nothing was deleted: your old records are still in this browser, exactly as they were."* |
| A3 | Check it quotes **no numbers** | It should not tell you "12 read, 9 merged". That is deliberate — the two stores legitimately overlap, so any count looks like a shortfall about a migration that lost nothing |
| A4 | Count your positions against your Export JSON from §0.2 | Everything you had is present. Records that existed in *both* stores appear **once**, not twice |
| A5 | Dismiss the notice, reload | It stays gone. It never comes back |
| A6 | DevTools → Application → Local Storage | `convexa.positions.v2` and `convexa.ghost-trade.v1` are **still there, untouched**. `convexa.positions.v3` is new |

**If A4 is wrong — stop and tell me.** Do not keep clicking. Your originals are intact in v2/v1 and
recovery is straightforward, but I want to see it before anything writes over v3.

---

## Part B — multi-leg entry and structure naming

The app now recognises what you hold by **looking at the legs**. It never stores a strategy name and
never guesses one: an exact match, or `Custom`.

| # | Do | Expect |
|---|---|---|
| B1 | `/positions` → **+ Open simulated position** | Dialog headed **"Open simulated position"** |
| B2 | Click **+ Add leg** three times | Four legs, each with its own expiration, strike, Call/Put, quantity and price. There is **no cap** on leg count |
| B3 | Build an iron condor — four strikes, one expiration, long/short/short/long | The structure reads **`Iron condor`** |
| B4 | Now change **one** leg's expiration | The name changes (to `Custom`, or a calendar/diagonal if the shape matches one) — it re-derives from the legs immediately |
| B5 | Build something deliberately odd — three legs, mismatched quantities | **`Custom`**. This is a normal, first-class outcome, not an error state |
| B6 | Build a covered call — 100 shares long + 1 short call | **`Covered call`**, and the share leg is priced correctly. *(This is the ×100 fix: shares used to be wrong by 100×, which is why covered calls and collars were impossible before.)* |
| B7 | Open a plain single long call | Still reads **`Long call`** and behaves exactly as it did before this feature |
| B8 | Expand a multi-leg row (the chevron on the left) | One line per leg. Direction shows as the plain words **`Long`** / **`Short`** |
| B9 | Look hard at B8's colours | **No green/red for calls vs puts.** Colour on this page means P&L direction only. *(A short call is bearish — tinting it green because it contains a call would tell you the opposite of the truth.)* |
| B10 | Look at the row's description cell for the condor | Something like **`TSLA · $380/$400/$440/$460`** — note it does **not** repeat the word "condor". The Structure column beside it already says `Iron condor` |

---

## Part C — max loss

Max loss is shown **only** where the worst case is genuinely bounded — decided by membership in a fixed
list of 15 structures, not by the app trying to detect risk. That is the point: an unrecognised short
cannot produce a confident finite number, because an unrecognised shape is not on the list at all.

**The 15 that show a figure:** long call · long put · short put · long shares · long straddle · long
strangle · the four verticals (call/put × debit/credit) · covered call · protective put · collar ·
iron condor · iron butterfly.

| # | Do | Expect |
|---|---|---|
| C1 | Look at the condor from B3 | A **`Max loss`** figure, unsigned — `$560`, never `+$560` or `−$560` |
| C2 | Find the at-expiration wording near it | It states the assumption — max loss assumes every leg held to expiration, and that fees, slippage, assignment and taxes are not modelled |
| C3 | Open a **naked short call** | **No number.** The reason reads exactly **`unlimited risk`** |
| C4 | Open a **calendar** (same strike, two expirations) | **No number.** Reason: **`mixed expiries`** |
| C5 | Look at any `Custom` position | **No number.** Reason: **`unnamed shape`** |
| C6 | Confirm you never see the word `Unlimited` sitting alone where a figure goes | Deliberate — under a "Max loss" heading it reads as a computed value |
| C7 | Narrow the browser window below ~1280px | The **Max loss column disappears from the table** |
| C8 | While narrow, switch to **Cards** | The figure is **still there**, in the card footer |

C7/C8 are intended: the column only fits at 1280px and above, and the card always carries the figure.

---

## Part D — the bad-day screen

This is the screen you only ever meet when something has gone wrong, and it is the part I would most
like you to look at, because it is where the two data-loss bugs lived.

**⚠️ Save an undo first.** DevTools → Application → Local Storage → `http://localhost:4300` → click
`convexa.positions.v3` → **copy the entire value into a scratch file.** Pasting it back is a clean,
lossless undo. Do this before D1.

| # | Do | Expect |
|---|---|---|
| D1 | Edit the `convexa.positions.v3` value — delete a single character from the middle of the JSON — then reload | The app comes up in the faulted state |
| D2 | Read the banner heading | Exactly: **"Recording paused — Convexa couldn't read your saved data"** |
| D3 | Read the body | It says Convexa left the data exactly as it is, and that **nothing was deleted** |
| D4 | Try to dismiss the banner | **You can't.** There is no close control — this state does not get to be ignored |
| D5 | Find the two actions | **"Export an archive of what loaded"** and **"Reload the page"** |
| D6 | Look at the entry / Close / Save-view buttons | Visibly **greyed and quiet** — clearly not usable |
| D7 | Press **Tab** to move focus onto one of those greyed buttons | It **still takes focus**, and a tooltip appears explaining *why* it is refused |
| D8 | Click one anyway | Nothing happens. No error, no silent partial write |
| D9 | Look at the numbers on screen — P/L, strikes, expiries | **Not greyed.** Only *controls* are dimmed; your data still reads at full strength |
| D10 | Go to a **ticker page** and try to open a trade there | Also refused. The state follows the *store*, not the page — the ticker page opens the same dialog against the same data |
| D11 | **The important one.** Back in DevTools, look at `convexa.positions.v3` | **Byte-for-byte exactly as you left it.** Your damaged data has not been touched, overwritten, or "helpfully" replaced with an empty book |
| D12 | Undo: paste your saved value back over `convexa.positions.v3`, reload | Everything returns to normal. Writes work again — the refusal is not sticky |

**D11 is the whole point.** Before this feature, that exact scenario destroyed the entire book on the
next save — one corrupt character, and one new position replaced everything.

**If you lose your undo copy:** deleting the `convexa.positions.v3` key entirely makes the merge re-run
from your untouched `v2`/`v1` originals on the next load. That recovers everything you had *before* the
migration, but **loses anything you created after it**, since those live only in v3. Use the paste-back
undo where you can.

---

## Part E — the small honest details

These are quick and they are where sloppiness usually shows.

| # | Do | Expect |
|---|---|---|
| E1 | Find a position with a missing or unpriceable field | You should be able to find up to four *different* blanks, each meaning a different thing: **`—`** (doesn't apply) · **`unavailable`** (couldn't price it this cycle) · **`not recorded`** (the saved record never held this) · **`no basis`** (there's no cost to compute a % against) |
| E2 | Confirm you never see `undefined`, `null` or `NaN` in any cell | Those are banned outright — in a screenshot they're indistinguishable from a crash |
| E3 | Open the **Group** control on `/positions` | Reads **None · Ticker · Structure**. *"Strategy" was renamed to "Structure"; grouping by expiry is deliberately a future item* |
| E4 | With the market closed, look at a ticker page's live figures | Net flow and spread show **`—`**; the static bundle keeps rendering normally. Live things degrade, stored things don't |
| E5 | Reload with a saved view active | Your saved views still work and are **not rewritten**. Viewing never changes what's stored |

---

## Known non-issues — please don't chase these

- **The Ticker page has no "Add leg".** Deliberate. Multi-leg entry lives on `/positions`.
- **`/positions` scrolls sideways at ~900px wide.** Pre-existing, present before this feature, measured
  identical with and without it. Logged separately in `.claude/OPEN_THREADS.md` §8.
- **The Max loss column vanishes below 1280px.** Intended (Part C7/C8).
- **A greyed refused button has faint text in light mode.** Reviewed and accepted — the *reason* lives
  in the full-strength banner and the tooltip, not the button label.
- **Nothing here is deployed.** This is all local. `convexa.pages.dev` is still the 2026-06-29 build
  until someone runs `docs/DEPLOY_RUNBOOK.md`.

---

## If something fails

Note **which step number**, what you saw, and what you expected. For anything in **Part A** or **D11**,
stop before doing anything else — those touch stored data, and the originals are recoverable as long as
nothing writes over them.

Reference material, if you want to go deeper:

- `.claude/contracts/_archive/positions-legs/SPEC.md` — the design of record, 83 acceptance criteria
- `.claude/contracts/_archive/positions-legs/QA_REPORT.md` — what automated verification checked, and
  the two findings that failed first time round
- `.claude/OPEN_THREADS.md` §7x — what shipped and what was deliberately deferred
