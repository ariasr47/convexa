# How Convexa Is Built

_Two sites from one codebase, a Rust API with a pinned contract, data that says where it came from, and a design system that drives the build._

---

## What Convexa is

Convexa turns a stock's option chain into **dealer gamma structure**: the call and put walls, the gamma flip and the magnet. It reads that structure beside public market data (filings, insider trades, rates, futures positioning) and gives a risk-first read of the setup. Every trade is simulated.

It is a personal project, built solo. This page is about how it is built: the decisions worth making, and the ones it would have been easy to fake.

> Not investment advice. Positions and orders are paper; a connected brokerage is read-only.

---

## Two sites, one codebase

The dealer-structure engine needs a real-time options feed, and that feed costs money a portfolio project doesn't spend. So Convexa ships as two builds of the same code:

| | Demo | Live site |
|---|---|---|
| What runs | Every screen, on one authored market day | What is free and live today |
| Data | Authored in the browser | Real public sources, read by the Rust API |
| Network | None | The site and its API |

The [demo](https://staging.convexa.pages.dev) makes **zero network requests**: an end-to-end check asserts it. The live site mocks **nothing**: where a panel would need the paid feed, it says *Not live* and what it would show, instead of drawing a plausible-looking number.

---

## Data that says where it came from

Every panel carries one state word from a closed list (*Updated*, *Delayed by source*, *Last good copy*, *Not live*, *Off*, *Sample*) with its source and when it was read. When a source fails, the API serves its last good copy and says so; it never relabels an old figure as fresh.

Three examples of what that costs, paid on purpose:

- **FINRA.** Short interest and short-sale volume were live, until a read of FINRA's terms showed public display needs a developer credential. The data is now **Off**, with the reason on every card, until the credential exists.
- **SEC.** EDGAR asks every program for a contact address and a polite request rate. The API sends one, keeps a request budget, and bounds each read in time, so one slow filer can't hold a page.
- **The notes.** Each figure in a research note names the XBRL concept it comes from, and a check compares it with the company's filing: 35 of 35 match. The FOMC decisions on the rates chart come from the Fed's own statements, each row citing its URL.

---

## A contract that can't drift

The API is Rust (Axum on Tokio). Its OpenAPI document is generated from the Rust types, the TypeScript client is generated from that document, and the generated files' hashes are pinned in the repository. A change to the wire that skips the contract fails the checks.

Because the site deploys before the API, every new field is optional on the wire and read defensively: an older API simply draws less.

---

## A desk that reads in order

The ticker desk is built around one question: what should the eye read first? The answer is **the price and the structure verdict**, then **the levels that frame it**, then **supporting context**.

So the price leads the masthead with its day change, and the verdict reads “+γ long gamma above 683.92”: the sign is in the words, never in the color alone. The main chart's title states its finding (“spot sits 1.0% above the flip”), not the chart's name. On a phone the price now appears at y≈276 instead of y≈605, and the levels are reached about 350 pixels sooner.

The design lives as source, not as a picture: every screen has boards for each environment and width, and a spec card listing what is built. A screen tracker is generated from those cards, so “what's left” is never a hand-kept list.

---

## Tests where a silent failure costs something

Tests exist where a quiet bug would cost something: money arithmetic, dates and time zones, parsers of third-party documents, data writes, state words, the boundary between two accounts on one browser. About 3,400 automated tests today, and in fix rounds each new test is shown to fail without its fix.

What isn't tested: layout, copy and styling. Those are checked by looking, at real widths, in both themes.

---

## How the work gets done

Convexa is built solo with AI coding agents, inside a process that keeps them honest: product memory, contracts and the design system live in the repository; decisions are dated and append-only; each round of work is reviewed by a second agent whose job is to find what's wrong; nothing ships until its checks pass. The checks run locally (CI is off to keep the project free to run), with a secret scan before every push.

[Open the demo](https://staging.convexa.pages.dev) to see the whole desk, or read [how we read dealer structure](/blog/how-we-read-dealer-structure) for the method behind it.
