# FINRA data on Convexa: what the terms allow (2026-10-15)

Question Q-2: may Convexa show FINRA short interest, Reg SHO short-sale volume and OTC Transparency data on its public site? Researched from FINRA's published terms on 2026-10-15 by a five-angle research pass. Every claim was re-read at its cited page, and an adversary searched for prohibitions. **This is a reading of published terms, not legal advice.**

## Answer

My answer for Q-2: FINRA's terms allow Convexa's use only through the FINRA API with a free credential. That is not how Convexa is built today. FINRA's written permission to republish derived figures for free, non-commercial use, with attribution, is in one place: the Specific Terms for Equity Data on developer.finra.org (last updated 2022-12-20). Section 2.3 lets the Developer redistribute the data and figures derived from it to End Users, for their own non-commercial use, on four conditions. FINRA must be named as owner and source. No fee may be charged. End Users may not pass the data on. The Developer must make commercially reasonable efforts to get End Users to comply. Section 2.4 explicitly allows derived data. Section 6 (data retention) says "Not applicable", so the 12-hour cache is fine. These terms cover every dataset in the otcMarket group, which includes consolidatedShortInterest, regShoDaily and weeklySummary.

That permission is given only to a "Developer" who has accepted the API Terms of Service and holds a valid FINRA-issued credential (Specific Terms §1.2, Terms of Service §1.3 and §3.4). Convexa holds neither:
- **Short interest:** the API calls carry no credential (finra.rs:1 calls them "keyless"; fetch.rs sends no Authorization header). The endpoint answers anyway, but that is server behaviour, not a license.
- **Reg SHO daily volume:** these files come from cdn.finra.org, outside the API. The only terms that point at them are the finra.org Terms of Use, through the Short Sale Volume page's "free for non-commercial use" row. Those Terms limit use to your own use and require FINRA's written consent to display or distribute content. They also ban building a database from the site, robots, and derivative works. That is the opposite of a public display permission.
- **Planned OTC panel:** the otctransparency.finra.org website sits behind a click-to-accept gate that a server cannot get through properly. The same weekly data is in the API as weeklySummary.

Bottom line: production should stay Off as built. All three datasets become permitted on a reasonable reading once the owner accepts the API Terms of Service himself and gets the free Public credential, Convexa pulls all three through the API with that credential, and the attribution and no-redistribution notices are added in the places listed below.

One question is still open, and only FINRA can settle it: whether a public showcase site, with a posted notice instead of a signed agreement, counts as "non-commercial personal or professional use" and meets the compliance-effort condition (§2.3(d)).

## Per dataset

### short_interest_api: allowed with conditions (confidence medium)

Governing terms:
- FINRA API Terms of Service (last updated 2026-03-19): §1.3 Developer, §2 precedence, §3.3, §3.4 credentials, §3.6 attribution, §10.4-10.5 termination
- Specific Terms for Equity Data (2022-12-20): §1.1 otcMarket group, §1.2 credential required, §2.2 non-commercial, §2.3(a)-(d) redistribution, §2.4 derivative data, §6 retention n/a
- Developer docs (API Program Terms): Individual accounts not for commercial purposes; Responsible Use Guidelines
- Developer fees page: Public credential $0, includes Consolidated Short Interest

FINRA's terms explicitly allow free, non-commercial public redistribution of short-interest figures and anything derived from them, with FINRA named as owner and source (Equity Specific Terms §2.3 and §2.4). The API metadata places consolidatedShortInterest in the otcMarket group, so those terms cover it. The permission belongs to a Developer who has accepted the click-to-accept API Terms of Service and holds a valid credential (§1.2; Terms of Service §3.4). Convexa calls the endpoint with no credential. It gets HTTP 200, but no FINRA page grants anything to unauthenticated callers, so today no license covers Convexa's public display. A Public credential is free and covers this dataset, which makes the gap easy to close. Shares short, days to cover and change percent are fields of the dataset itself, and §2.3 covers both raw and derived data on the same conditions. Convexa charges nothing, so the no-fee condition is met. Nothing caps caching. Two conditions remain uncertain because the terms do not define them: whether a resume showcase is non-commercial, and whether a posted notice is enough to meet §2.3(d). That uncertainty is why confidence is medium rather than high.

Conditions:
- The owner personally creates an Individual account on developer.finra.org, accepts the API Terms of Service, and provisions a Public credential. Every data request sends the OAuth2 Bearer token. The secret stays server-side in Railway secrets and never reaches the browser bundle (Terms of Service §3.4(i), §11).
- Attribution next to every FINRA figure, including derived ones, naming FINRA as owner and source. Suggested text: 'Source and owner: FINRA (Financial Industry Regulatory Authority). Derived figures computed by Convexa from FINRA data.' Keep the plain link to the finra.org page. It must open the whole page, not inside a frame, and must not use FINRA's logo or suggest FINRA endorses Convexa (Terms of Service §13.9; finra.org linking clause).
- A no-redistribution notice, as a condition of use rather than a polite request: 'For your own non-commercial personal use only. Further redistribution is not permitted.' It appears in the UI, in alert text, and in the JSON responses. This is the commercially reasonable effort required by §2.3(c)-(d).
- No fee, ad, subscription or paid tier ever attached to these figures (§2.2, §2.3(b)).
- A disclaimer near the figures: 'Provided as is, for information only; not investment advice' (mirrors Terms of Service §7.2).
- Respect the platform limits: request only what is needed, use POST filters, and do not repeatedly re-download history older than one year.
- If FINRA ends the license, stop serving the data (§10.5). Re-check the Equity Specific Terms page date whenever the terms are re-verified.

What Convexa must change:
- fetch.rs post_json / Http::new: add OAuth2 client-credentials token retrieval from the FINRA Identity Platform and an Authorization: Bearer header. Retire the 'keyless' comment at finra.rs:1.
- finra.rs interest_request (lines 119-137): add a settlementDate range of about 7 months, so each refresh fetches only the 12 settlements Convexa keeps instead of the full history back to 2020.
- The JSON at /api/public-data/tickers/{T} carries no notice yet. Add an attribution and terms field: owner and source FINRA, non-commercial personal use only, no further redistribution.
- alerts/publicRules.ts:175 builds only 'FINRA · <date>'. Add the owner-and-source wording.
- Source chips that say only 'FINRA · consolidated short interest' should say 'owner and source'. Add a short site terms page that the notices link to.

Open question: Does a free public portfolio/resume site with no ads, fees or sign-ups, showing derived figures to anonymous visitors under a posted 'non-commercial use only, no redistribution' notice, count as 'non-commercial personal or professional use' and satisfy §2.3(d)? FINRA API support (developer.finra.org/support, 'Chat with us') can answer this. The same message can ask them to settle FAQ 12, which contradicts the rest of the support page on whether a Public credential reaches production data.

### regsho_daily_files: not allowed (confidence medium)

Governing terms:
- Short Sale Volume catalog page Terms of Use row: 'Data is free for non-commercial use', linking to finra.org Terms of Use
- finra.org Terms of Use (2023-11-09): Permitted Uses ('your own' non-commercial use), Copyright (b) display/distribution needs consent, Restrictions (d) database, (e) robots, (i) derivative works, (j) misleading, (m) software, (o) catch-all; Entirety clause
- If moved to the API: Specific Terms for Equity Data (regShoDaily is in otcMarket) plus FINRA API Terms of Service

As built, Convexa downloads CNMSshvol files from cdn.finra.org. The CDN host has no terms of its own. The only dataset-specific statement is the Short Sale Volume page's 'free for non-commercial use' row, and it points to the finra.org Terms of Use. Those Terms explicitly limit content to the user's own non-commercial use. They require FINRA's prior written consent to display or distribute content. They ban building a database from the site, robots and harvesting tools, and derivative works, except where other FINRA terms expressly allow it. A scheduled server that caches 20 daily files and publishes derived ratios to the public falls under those bans on their face. Two facts favour Convexa: the Terms never name cdn.finra.org, and FINRA has noted without objection that other websites redistribute the Daily File. But those are inferences and observed practice, and they give way to the explicit restrictions. No text grants public redistribution for this download route. The identical data is available through the API as regShoDaily (otcMarket group, Public credential, rolling 12 months). That route falls under the Equity Specific Terms, whose §2.3 and §2.4 expressly allow derived data and also satisfy the database ban's carve-out for 'other terms'. Switching source therefore moves this dataset to allowed_with_conditions on the same terms as short interest.

Conditions:
- Same credential, attribution, no-fee, no-redistribution and disclaimer conditions as short_interest_api once the data comes from the API's regShoDaily dataset.
- Label the ratio accurately: 'Off-exchange short-sale volume ratio (FINRA TRF/ADF/ORF trades only); not short interest.' FINRA's own example shows a FINRA-only ratio of 20% falling to about 10.7% once exchange volume is added, and both the finra.org Terms (j) and API Terms of Service §3.3(iii) ban misleading use.
- Do not republish the raw daily files. Serve only the per-ticker figures the interface needs.
- On each refresh, fetch only trade dates not already cached, not the whole 20-day window.

What Convexa must change:
- Stop downloading https://cdn.finra.org/equity/regsho/daily/CNMSshvol{YYYYMMDD}.txt. Fetch from api.finra.org/data/group/otcMarket/name/regShoDaily with the Bearer token, filtered to the universe's symbols and the last 20 trade dates. The API returns trades per reporting facility, so aggregate across facilities to reproduce the consolidated (CNMS) figure, and check the totals against a CNMS file once.
- Relabel the 20-day ratio as off-exchange only, with a one-line caveat that it is not short interest.
- Add the same attribution and no-redistribution notice to this panel, its alerts, and its JSON.

Open question: Does FINRA treat the cdn.finra.org Daily Short Sale Volume files as covered by the finra.org Terms of Use, so that public display of derived ratios needs written consent? Only FINRA can say, through the copyright-permission contact or FINRA Business Services. Moving to the API's regShoDaily dataset makes the question irrelevant.

### otc_transparency: allowed with conditions (confidence medium)

Governing terms:
- If via API (weeklySummary, otcMarket): FINRA API Terms of Service plus Specific Terms for Equity Data §1.2, §2.2-2.4
- If via otctransparency.finra.org: the site's click-to-accept Terms of Use (disclaimers plus required attribution format)
- FINRA technical notice of July 6, 2015: weekly ATS data may be used for derived statistics and charts and circulated with appropriate attribution to FINRA (ATS data only)
- Regulatory Notice 15-48: non-ATS data free of charge from April 2016 (no use terms)

The panel is not built yet, so the verdict covers the route Convexa should take. Through the Query API, weeklySummary sits in the otcMarket group and accepts Public credentials. The Equity Specific Terms §2.3 and §2.4 then expressly allow free, attributed, non-commercial display of per-security weekly ATS and non-ATS volume, the same as for short interest. FINRA's 2015 notice separately allows anyone to derive and circulate charts from weekly ATS data with attribution, but it does not mention non-ATS data. The website route is the wrong path. otctransparency.finra.org requires a click on 'I agree' on every visit, which a server cannot do properly, and pulling data from it by script would be the kind of harvesting the finra.org Terms of Use ban. The site's own terms contain no non-commercial limit and no redistribution ban, only disclaimers and an attribution line. Using that attribution wording on the panel costs nothing and settles the question of whether those terms also reach API-sourced data. The superseded 2014 guidelines, which treated per-stock display as generally not allowed, belong to the deleted Rule 4553 fee regime and should not be relied on either way.

Conditions:
- Source the panel only from api.finra.org otcMarket/weeklySummary with the owner's Public credential. Do not automate the otctransparency.finra.org website.
- Attribution: name FINRA as owner and source, and add the OTC Transparency wording: 'OTC Transparency data is provided via https://www.finra.org/filing-reporting/otc-transparency and is copyrighted by FINRA <year>.'
- The same no-fee, non-commercial-only and no-further-redistribution notice in the UI and the JSON, plus an 'as is / not investment advice' disclaimer.
- The 'as of' label shows the data's actual week (weekStartDate) and tier, not when Convexa fetched it. FINRA publishes this data 2 weeks after the week for Tier 1 stocks, 4 weeks for other NMS stocks and OTC securities, and has had unplanned delays.
- Do not re-download data older than one year (FINRA says it is static). Use the rolling 12-month dataset and fetch only new weeks.

What Convexa must change:
- Build the planned panel against weeklySummary through the same credentialed HTTP client as short interest. Never use the website.
- Write the combined attribution line for the panel, and make the panel's 'as of' date the data week.

Open question: Do the otctransparency.finra.org website terms, including their attribution format, also apply to weeklySummary data pulled through the API? FINRA Business Services ((866) 953-4672) or FINRA API support could answer. Showing both attribution forms makes the answer non-blocking.

## Recommendation

Keep production FINRA data Off as built, and switch it on only after one change: move all three datasets onto FINRA's API under a free Public credential that you accept yourself.

1. You personally create an Individual account at developer.finra.org, accept the API Terms of Service, and provision the free Public credential. I can't accept terms for you. Store the client secret in Railway secrets.
2. Convexa sends the Bearer token on short-interest calls, adds a settlementDate filter, replaces the cdn.finra.org Reg SHO downloads with regShoDaily, and builds the planned OTC panel on weeklySummary.
3. Add one notice to every FINRA panel, alert and JSON response. It names FINRA as owner and source, says free for non-commercial personal use only with no further redistribution, adds the OTC Transparency copyright line where relevant, and states the data is as-is and not investment advice. Relabel the short-volume ratio as off-exchange only and not short interest.
4. Then turn production FINRA data On. In the same week, send one message to FINRA API support asking the open question: does a free public portfolio site with posted notices count as non-commercial use and meet §2.3(d)? Record their answer as the close of Q-2.

This is the single route that brings every dataset under FINRA's one explicit redistribution permission. It costs nothing beyond your own acceptance of the terms.

The tradeoff: accepting the API terms makes you personally liable to indemnify FINRA without a cap (§9.1), and FINRA can end access on 15 days' notice. A free display of 20-60 tickers that follows the conditions keeps that risk small.

## Note

This verdict is my reading of FINRA's published terms and pages as fetched on 2026-10-15. It is not legal advice, I am not a lawyer, and I have not contacted FINRA. FINRA does not define "non-commercial", and whether factual data aggregates can be copyrighted is a legal question that no FINRA page answers. FINRA can also change these terms at any time. For certainty, get written confirmation from FINRA or advice from counsel.

## Main sources (read 2026-10-15)
- [FINRA API Terms of Service (HTML; 'last updated on March 19, 2026'). Read 2026-10-15, raw HTML fetched with curl (HTTP 200) and grepped.](https://developer.finra.org/finra-api-terms-service)
- [FINRA API Terms of Service, PDF (03-2026). Read 2026-10-15.](https://developer.finra.org/sites/default/files/2026-03/FINRA%20-%20API%20Terms%20of%20Service%20%2803-2026%29.pdf)
- [FINRA API Terms of Service - Specific Terms for Equity Data ('last updated on December 20, 2022'). Read 2026-10-15.](https://developer.finra.org/specific-terms-equity-data)
- [Specific Terms for Equity Data, PDF (12/22). Read 2026-10-15.](https://developer.finra.org/sites/default/files/2022-12/Developer%20API%20-%20Specific%20Terms%20-%20Equity%20Data%20%2812-2022%29%5B10%5D.pdf)
- [FINRA Developer Center Documentation: Getting Started > Terms of Service, User Types, Credential Types, API Platform Basics (Authorization, Platform Usage Limits, Request Throttling, Responsible Use Guidelines, Response Size Limits, Troubleshooting status codes). Read 2026-10-15 (raw HTML, 1.5 MB).](https://developer.finra.org/docs#getting_started-terms_of_service)
- [Docs: Query API > Equity > Consolidated Short Interest (with the Equity terms section #query_api-equity-terms_of_service, #query_api-equity-reg_sho_daily_short_sale_volume and #query_api-equity-weekly_summary). Read 2026-10-15.](https://developer.finra.org/docs#query_api-equity-consolidated_short_interest)
- [FINRA Developer Center - Fees (credential-type matrix). Read 2026-10-15. Check and cross icons were parsed from the HTML table.](https://developer.finra.org/fees)
- [Fees - Public Credentials. Read 2026-10-15.](https://developer.finra.org/fees/public)
- [FINRA Developer Center - Support FAQ (FAQ 4, 6, 10, 11, 12). Read 2026-10-15.](https://developer.finra.org/support)
- [FINRA Developer Center - Catalog of Datasets. Read 2026-10-15.](https://developer.finra.org/catalog)
- [FINRA Developer Center home. Read 2026-10-15.](https://developer.finra.org/)
- [News: Individual Fingerprint Dataset and update to FINRA API Terms of Service (dated Jan 28, 2025). Read 2026-10-15 via WebFetch summary.](https://developer.finra.org/news/individual-fingerprint-dataset-and-update-finra-api-terms-service)
- [News: Q4 2021 API Update (Oct 1, 2021). Read 2026-10-15 via WebFetch summary.](https://developer.finra.org/news/q4-2021-api-update-laying-foundation-future)
- [News: Announcing the FINRA API Console (Jan 24, 2022). Read 2026-10-15 via WebFetch summary.](https://developer.finra.org/news/announcing-finra-api-console)
- [FINRA Data - About Equity Short Interest. Read 2026-10-15 via WebFetch only: curl got HTTP 403, and the built-in browser hit a Cloudflare 'Just a moment...' challenge that I did not attempt to bypass.](https://www.finra.org/finra-data/browse-catalog/equity-short-interest)
- [FINRA Data - Equity Short Interest data grid. Read 2026-10-15 via WebFetch only (curl 403).](https://www.finra.org/finra-data/browse-catalog/equity-short-interest/data)
- [FINRA.org Terms of Use ('Last modified: November 9, 2023' per the fetch). Read 2026-10-15 via WebFetch summary only. Raw text was not verified (curl to finra.org returns 403).](https://www.finra.org/terms-of-use)
- [OTC Transparency Data – Terms of Use (click-through gate with I Agree / I Disagree buttons)](https://otctransparency.finra.org/otctransparency/Agreement)
- [OTC (ATS & Non-ATS) Transparency – FINRA.org overview](https://www.finra.org/filing-reporting/otc-transparency)
- [Technical Notice: Downloadable ATS Data Available at no Charge on FINRA.org July 13, 2015 (dated July 6, 2015)](https://www.finra.org/filing-reporting/otc-transparency/technical-notices/technical-notices/downloadable-ats-data-available-no-charge-finraorg-july-13-2015)
- [Technical Notice: FINRA ATS Data Changes Effective Monday, April 25, 2016](https://www.finra.org/filing-reporting/otc-transparency/technical-notices/technical-notices/finra-ats-data-changes-effective-monday-april-25-2016)
- [Technical Notice: FINRA Developer API Service Available for OTC Transparency Data (Nov 8, 2019)](https://www.finra.org/filing-reporting/otc-transparency/finra-developer-api-service-available-otc-transparency-data)
- [FINRA Developer Center documentation (Query API: Weekly Summary dataset, request headers, Platform Usage Limits, Equity terms pointer)](https://developer.finra.org/docs)
- [Technical Notice: OTC Transparency Data Publication Delay (Dec 24, 2024)](https://www.finra.org/rules-guidance/rulebooks/otc-transparency-data-publication-delay-20241224)
- [FAQ about OTC (ATS & Non-ATS) Transparency](https://www.finra.org/filing-reporting/market-transparency-reporting/otc-transparency/faq)
- [Short Sale Volume (About the Data, FINRA Data catalog)](https://www.finra.org/finra-data/browse-catalog/short-sale-volume)
- [Daily Short Sale Volume Files](https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data/daily-short-sale-volume-files)
- [Short Sale Volume Data (interactive grid page)](https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data)
- [Sample CDN Reg SHO daily file (Consolidated NMS, 2026-10-14)](https://cdn.finra.org/equity/regsho/daily/CNMSshvol20261014.txt)
- [Short Sale Volume Daily Data User Guide (March 2026 revision)](https://www.finra.org/sites/default/files/2020-12/short-sale-volume-user-guide.pdf)


Full evidence (208 claims and their page checks) is in the workflow journal for run `wf_ba69ccda-2f9`.
