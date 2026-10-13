# Meta-design brief: an ADHD-friendly, premium research note

Researched 2026-10-12. Scope: how one ticker's research note should read, look and show uncertainty. This is design guidance only, not investment advice. Any figures in the specs below are placeholders.

**How strong the evidence is.** Skimming evidence is strong (NN/g eye-tracking, 120+ participants). ADHD-specific evidence is thin, recent, small-sample and mostly qualitative [20][21][22][23], so the ADHD advice leans on general skimming research and W3C COGA [12][13]. The uncertainty advice rests on controlled experiments. [n] resolves to URLs in section F.

---

## (A) The 10 highest-impact changes, ranked

**1. Put the valuation verdict on the first screen as one "price vs value" strip.**
Above the fold, show today's price, the owner's bear-to-bull value range and the base-case marker on a single axis, with a confidence word and a "reviewed N days ago" stamp. *Why:* in 2018, 57% of viewing time fell above the fold and 74% within the first two screenfuls [4]. NN/g's inverted pyramid says to state the conclusion first so readers can stop at any point [1], and COGA asks for summaries of long documents [12]. The new valuation section is currently planned deep in the page, where most attention never reaches.

**2. Show every value claim as a range, and play down the single point.**
The owner's target becomes "$A–$C, base $B", never a lone big number. *Why:* adding means to uncertainty displays nudges readers to discount the uncertainty [31]. Interval-only displays push people to treat the inside and outside of a boundary as categories [27]. Morningstar ties the margin of safety it demands to how uncertain the fair value is [45].

**3. Add a "What the price implies" card (reverse DCF in one sentence plus one comparison).**
*Why:* expectations investing starts from the price and solves for the growth it implies, then compares that with your own view [44]. COGA recommends word-based alternatives to bare numbers [12]. This is the most skimmable valuation fact on the page.

**4. Redraw the football field to avoid "inside the bar" thinking.**
Use one shared axis, a labelled vertical line for the current price, and soft-ended (gradient) bars with labelled ends. *Why:* readers judge points just inside a bar differently from points just outside it at the same distance [27], and gradient plots were proposed as better than bars with error bars for inference [34]. Spec in C3.

**5. Show scenario probabilities as frequencies, not percentages alone.**
Draw a 20-cell probability bar where each cell is "1 in 20". *Why:* frequency formats such as icon arrays and quantile dotplots improve probability judgments, especially for low-numeracy readers [27]. Quantile dotplots and CDFs led to better decisions than text, intervals or density plots [29], and quantile dotplots made estimates less variable than densities [28].

**6. Pair every quantified uncertainty with a qualitative confidence badge.**
*Why:* across two experiments, adding a Low/Medium/High forecaster-confidence statement to quantile dotplots changed decisions and trust, and the authors recommend showing both [32]. Morningstar uses the same pairing in its five-level Uncertainty Rating [45].

**7. Add a thesis scorecard: 3–5 falsifiable pillars, each with a status and a kill criterion.**
*Why:* COGA says not to make users rely on memory or their own calculations [12]. Seeking Alpha's factor grades show at a glance where a stock is strong or weak, with the underlying data one click away [48]. A premortem (imagining the thesis has already failed) surfaces risks people would otherwise not voice [54].

**8. Show two timestamps and an explicit stale state.**
Separate "price as of" from "thesis reviewed on", and show a "review due" state. *Why:* Morningstar recomputes its star rating every market close, but analysts change fair values only when warranted [45]. Price and judgment run on different clocks, and the note should show both.

**9. Make every chart title the takeaway, label directly, and keep one visual per section.**
*Why:* top-placed titles get more fixations, and titles should state the message [25]. Readers recall the title's message more than the chart's [26]. Readers preferred heavily annotated charts [24], yet with ADHD participants, less in-chart text did better in both groups [21]. Reconcile them: one takeaway sentence in the title, short direct labels instead of legends [39].

**10. Cut what overwhelms.**
No radar or "snowflake" charts, no composite scores without reasons, no auto-playing motion, at most two levels of disclosure, and one amber element per screen. *Why:* radar axes have independent scales and shape area distorts magnitude [42]. More than two disclosure levels hurts usability [5]. Motion in the periphery hijacks attention [8]. Distraction is a named barrier for people with ADHD [14]. Readers spot standout formatting, so it has to be used sparingly [16].

---

## (B) ADHD and skimmability principles, with evidence

- **Answer first, at every level.** Lead with the conclusion, then support, then background. Also lead each paragraph with its point and each sentence with its information-carrying words [1]. UK public-sector guidance says the same for sections, paragraphs and sentences [16].
- **Headings carry the meaning.** Readers often scan only headings (the "layer-cake" pattern). This is efficient, but it means headings must be descriptive, front-loaded and plainly linked to their body text [3]. Without strong cues, readers fall back to F-shaped scanning and miss content lower down or to the right [2]. Your "one-line takeaway headline per section" is the right pattern. Write it as a sentence with a verb and a number, not as a label ("Margins are already at peak: 31% vs 22% 10-yr avg", not "Profitability").
- **Chunk and bullet.** Short paragraphs, bulleted lists, bold key phrases and visual grouping all counter F-scanning [2]. Adults with ADHD and parents of children with ADHD asked for limited text, bullets and clear menus [20]. A W3C research draft reports, from anecdotal evidence, that people with ADHD find visual representations and lists easier to process [13].
- **One visual anchor per section; emphasis is a budget.** Readers spot standout elements, and the more there are, the less each one stands out [16]. Your rule of reserving amber for the single most important thing matches this. Keep it to one per viewport.
- **Line length and spacing.** WCAG 1.4.8 (AAA) sets ≤80 characters per line, line spacing of at least 1.5, and paragraph spacing of at least 1.5× the line spacing [58]. In on-screen tests, 55 characters per line was read faster than 25 or 100, while other studies found readers *prefer* medium lines even when long lines read faster [68]. The BDA advises roughly 60–70 characters, 1.5 spacing, left-aligned text, no italics or underlining, and no all-caps body text [15]. **Spec:** body measure 60–72ch, line-height 1.55–1.65, ragged right.
- **Progressive disclosure, two levels maximum.** Keep what most readers need in the primary layer, label the fold clearly, and never nest folds [5]. Avoid accordions when readers need most of the content or when uninterrupted reading matters [7]. So keep the takeaway, the visual and the 2–3 key numbers visible, and fold only the method and data detail.
- **Remove distraction.** No autoplay, no pop-ups mid-reading, and an uncluttered layout [14]. Motion in peripheral vision draws attention whether or not it means anything [8]. In interviews, ADHD readers said ads, notifications and clutter made them abandon reading (only 5 interviewees) [23].
- **Don't make the reader compute or remember.** Show computed deltas ("+18% vs price", "next up in 9 days") rather than two numbers the reader has to subtract [12]. Use numerals, which readers scan for [17].
- **Keep orientation after interruptions.** COGA says headings and position cues help users regain context [12]. For a sticky table of contents in a side rail, NN/g recommends highlighting the current section, which also shows scroll progress [6]. Your sticky rail with progress fits this. Keep its labels identical to the section headings [6].
- **Reading-time estimates.** No peer-reviewed evidence shows that the label raises engagement. The claims for it are vendor anecdotes [19]. If you show one, compute it at 238 words per minute, the meta-analytic average for silent non-fiction reading [18], and pair it with a skim time ("7 min read · 1 min skim").
- **Dark theme caveat.** For people with normal vision, light mode gave better reading performance, and the advantage grew as text got smaller. NN/g recommends letting users choose a theme [9]. Keep the terminal aesthetic, but set body text ≥16px with no light weights, and offer a light "reading" theme (COGA's personalization objective) [12]. The BDA favours moderate rather than maximum contrast [15].
- **The "premium" feel.** Attractive interfaces are judged easier to use, but polish can mask real problems in testing [11]. Test comprehension, not looks.

---

## (C) Uncertainty and valuation visualization specs

**General rules.** Showing uncertainty is rare: in one sample of 612 news graphics, only 3% depicted it [33]. Done well, it is a differentiator. Avoid an interval with nothing else, because it invites categorical, inside-versus-outside reading. Add something richer, such as a gradient, dots or a scenario breakdown [27]. Readers can mistake error bars for hard highs and lows even when a key explains them [27]. Animated hypothetical outcome plots outperform error bars on some judgments [30], but they are motion, so offer them only on request and never under reduced motion [60].

**C1. Price-vs-value hero strip (above the fold)**
- One horizontal axis in $/share. A light gradient band runs from bear to bull, densest at the base case. A small diamond marks the base case, and that diamond is the page's one amber element. A full-height hairline marks the current price, labelled "Price $X · 12 Oct close".
- Text to the right: "+18% to base · range −22% to +61%". Direction is shown by the ▲/▼ glyph plus the sign, with green or red applied to the glyph only.
- Below the strip: a confidence badge (C6) and a freshness stamp (C8). Height ≤64px. The axis is shared with C3 so readers learn the scale once.
- This is a Few bullet graph: one featured measure, one comparative marker, muted background ranges [37].

**C2. "What the price implies" card**
- Headline sentence: "At $X, the market implies ~Y% annual revenue growth for 10 years at a Z% margin."
- Three bars on one axis: *Implied* | *Company 5-yr history* | *Owner base case*. Add one verdict word ("demanding", "in line" or "undemanding") with a short reason.
- A fold holds the fixed inputs (discount rate, horizon, terminal assumption), because the solved variable depends on them [44]. Do not colour the verdict green or red, because it is a judgment, not a direction.

**C3. Football field**
- Rows in a fixed order, so the chart compares across tickers: Reverse-DCF implied (a point) · Owner DCF (bear–bull) · Peer multiples · Analyst targets low–high · 52-week range. Banks combine these same method rows, including the 52-week range, to sanity-check one against another [43].
- Bars are neutral, 10–12px tall, with ends that fade over the last 10% to avoid a hard-boundary reading [27][34]. Label numeric values at both ends. A tick inside the bar marks the base or median. The current price is a single full-height line, labelled once at the top [41].
- Caption = takeaway ("Price sits below 4 of 5 method ranges"). Put a visible data table in the fold as the long description [65].

**C4. Scenario probability bar**
- One 100% bar of 20 equal cells (each "1 in 20"), grouped into Bear | Base | Bull. Each group is labelled with value per share and frequency ("Base · 11 in 20 · $B"). Below the bar, mark the probability-weighted value on the C1 axis.
- Use a neutral lightness ramp, not red or green: a bear value can still sit above the price, so these are not directions.
- If the model produces a distribution (Monte Carlo, for example), replace the bar with a 20-dot quantile dotplot on the shared axis. Readers can then count how many dots sit above today's price [28][29]. Morningstar defines its bull and bear cases so that each tail has 25% probability [46]. Whatever convention you use, state it in the label.

**C5. Sensitivity grid**
- At most 5×5 (for example, discount rate × terminal growth). Each cell shows value per share and the signed % against price. Outline the base-case cell, and label the midpoint "= today's price".
- This is a deviation-from-reference display [38]. Colour encodes *distance* from price with one lightness ramp. Direction is carried by the sign and the ▲/▼ glyph. Datawrapper warns against red–green diverging gradients for colour-blind readers [39]. A diverging scale fits only when the midpoint means something, and the midpoint should be labelled [40]. Heatmaps are exempt from WCAG 1.4.11 contrast [57], but 1.4.1 (colour not the only cue) still applies [55].

**C6. Confidence badge**
- Three levels as word plus shape: "Low ▮▯▯ / Medium ▮▮▯ / High ▮▮▮". Show the two main reasons on focus or tap, and tie the level to the width of the C1 range [45][32]. Never use colour alone [55]. Icons need text labels [10].

**C7. Thesis scorecard**
- 3–5 rows: *Pillar (a falsifiable claim)* · *Metric and threshold* · *Latest reading + date* · *Status* (✓ On track / ! Watch / ✕ Broken, as word plus glyph) · *Kill criterion*.
- Sort rows by importance. Write the kill criteria as a premortem: assume the thesis failed and say why [54].
- Use letter grades only if each one links to its data, as Seeking Alpha does [48].

**C8. Freshness and staleness**
- Top-right: "Price as of 12 Oct 2026 close · Thesis reviewed 3 Sep (39 d ago)".
- When reviewed more than 90 days ago, or when a catalyst passes unreviewed, show a static "Review due" chip. While stale, it takes the amber slot, because an out-of-date value is the riskiest fact on the page. Fade the base-case marker to an outline. No blinking [61].

**C9. Target history**
- A step line for the owner's base value, with its bear–bull band in a light shade, drawn against the price line. Each step carries a marker and a one-line reason ("cut: lower margin path").
- Morningstar expects fair values to drift up roughly at the cost of equity even when nothing changes [45], so note that a flat target can be an implicit cut.
- In the sidebar, use a sparkline version that is word-sized and frameless and takes its scale from adjacent numbers [36].
- For a forward view, a fan chart (graded shades that widen with the horizon) is the established idiom [35]. Label what each band means.

---

## (D) Platform patterns: borrow vs avoid

| Platform | Borrow | Avoid |
|---|---|---|
| **Morningstar** | Fair value plus an explicit uncertainty level that sets the margin of safety. The 5-star thresholds run from 80% of fair value (Low) to 25% (Extreme) [45]. Bull and bear defined by tail probability [46]. | Compressing everything into one star count. For a personal note, the range itself is more informative than its summary. |
| **Simply Wall St** | Explicit pass/fail checklists (6 checks × 5 areas) [47]. | The radar "snowflake", whose colour runs red→green with the score [47]. That breaks your direction-only colour rule and has the usual radar distortions [42]. Reviewers note it shows scores without reasons [47]. |
| **Seeking Alpha** | Sector-relative factor grades (A+ to F), underlying data one click away, and a rating history [48]. | Opaque composites when you can't see how they are built. |
| **TipRanks** | The analyst target high / average / low range, which is easy to plot as a football-field row [49]. | An equal-weight score of 8 factors that mixes blogger and news sentiment with fundamentals, and treats missing factors as neutral, which hides the gaps [49]. |
| **Koyfin / YCharts** | Normalized comparison charts (% change from a start date) and comparisons on any metric [53]. | Dashboard density as the default. Reviewers flag a learning curve [52]. |
| **Fiscal.ai** | Segment and KPI history, which users single out as the most valuable data [51]. | — |
| **Bloomberg** | Bloomberg's stated aim is to conceal complexity behind expert workflows [50]. | Terminal density in a reading surface. Borrow the type and ink aesthetic, not the information density. |

The pattern that carries over to a personal note: **one verdict, one range, one confidence word, then reasons you can check.** Every aggregate needs a visible path back to its inputs.

---

## (E) Accessibility checklist

- [ ] Text contrast ≥4.5:1 (≥3:1 for large text) on every ink surface, including muted grey labels [56].
- [ ] Chart marks, axis lines, the price line and focus rings ≥3:1 against their neighbours [57].
- [ ] Direction never by colour alone: use sign + ▲/▼ + word [55][39]. Up to ~8% of men of Northern-European descent have a colour-vision deficiency, mostly red–green [67].
- [ ] Body ≥16px, measure ≤80ch, line-height ≥1.5, left-aligned [58]. The layout must survive user text-spacing overrides [63].
- [ ] Use tabular figures (`font-variant-numeric: tabular-nums`) in tables and TL;DR numbers so digits align [69].
- [ ] Folds are `<button aria-expanded>` operable with Enter or Space [64]. Essential numbers never live only inside a fold or tooltip.
- [ ] Tooltips are dismissible, hoverable and persistent [59].
- [ ] The sticky rail never fully hides the focused element: use `scroll-padding-top` equal to the rail height [62].
- [ ] `prefers-reduced-motion`: no animated progress bar, smooth scroll, count-up numbers or HOPs [60][66]. Nothing moves on its own for more than 5 seconds without a pause control [61].
- [ ] Every chart has a short text alternative plus a visible long description: the takeaway caption and a data table in the fold [65].
- [ ] Semantic headings in rail order. Tables use `<th scope>` [70].
- [ ] Offer a light reading theme, following the OS preference by default [9][12].

---

## (F) Sources

1. NN/g, Inverted Pyramid — https://www.nngroup.com/articles/inverted-pyramid/
2. NN/g, F-Shaped Pattern (2017) — https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
3. NN/g, Layer-Cake Pattern (2019) — https://www.nngroup.com/articles/layer-cake-pattern-scanning/
4. NN/g, Scrolling and Attention (2018) — https://www.nngroup.com/articles/scrolling-and-attention/
5. NN/g, Progressive Disclosure — https://www.nngroup.com/articles/progressive-disclosure/
6. NN/g, Table of Contents (2023) — https://www.nngroup.com/articles/table-of-contents/
7. NN/g, Accordions: 5 Scenarios to Avoid Them — https://www.nngroup.com/videos/avoid-accordions/
8. NN/g, Animation Usability — https://www.nngroup.com/articles/animation-usability/
9. NN/g, Dark Mode vs. Light Mode (2020) — https://www.nngroup.com/articles/dark-mode/
10. NN/g, Icon Usability — https://www.nngroup.com/videos/icon-usability/
11. NN/g, Aesthetic-Usability Effect — https://www.nngroup.com/articles/aesthetic-usability-effect/
12. W3C COGA, Making Content Usable — https://www.w3.org/TR/coga-usable/
13. W3C COGA, Cognitive Accessibility User Research (draft) — https://www.w3.org/TR/coga-user-research/
14. UK DfE, Cognitive accessibility guidelines — https://deliver-good-services.education.gov.uk/guides/cognitive-accessibility-guidelines
15. BDA Dyslexia Style Guide 2023 — https://cdn.bdadyslexia.org.uk/uploads/documents/Advice/style-guide/BDA-Style-Guide-2023.pdf (returned HTTP 403 when fetched; figures taken from reproductions: https://www.bumc.bu.edu/jmedday/files/2025/05/Dyslexia-friendly-style-guide.docx and https://dyslexiascotland.org.uk/contrasting-advice-what-colours-are-best-for-accessibility/)
16. ONS Service Manual, How people read online (GOV.UK-style) — https://service-manual.ons.gov.uk/content/writing-for-users/how-people-read-online
17. NHS content guide, Numbers — https://service-manual.nhs.uk/content/numbers-measurements-dates-time
18. Brysbaert (2019) reading-rate meta-analysis — https://www.bps.org.uk/research-digest/most-comprehensive-review-date-finds-average-persons-reading-speed-slower
19. Reading-time label claims (vendor, uncontrolled) — https://martech.org/estimated-reading-times-increase-engagement/
20. Scholze et al. (2023), JMIR Formative Research, ADHD web-content preferences — https://pmc.ncbi.nlm.nih.gov/articles/PMC10520768/
21. Tran, Lee, Park (CHI 2024), Accessible Data Visualizations for People with ADHD — https://dl.acm.org/doi/10.1145/3613904.3642112
22. Alonso Virgós et al. (2026), IJIMAI, WCAG guidelines with ADHD users — https://zenodo.org/records/22894852
23. ACM (2025), Pupillometry and Typography for ADHD Readers (abstract seen only via search) — https://dl.acm.org/doi/10.1145/3772363.3799383
24. Stokes et al. (2022), Integrating Text and Charts — https://arxiv.org/abs/2208.01780
25. Borkin et al. (2015), Beyond Memorability — https://vcg.seas.harvard.edu/publications/20150101-beyond-memorability-visualization-recognition-and-recall
26. Kong, Liu, Karahalios (CHI 2018 / 2019), visualization titles — https://mail.zcliu.cs.umd.edu/vistitles/CHI18-VisTitles.pdf ; https://mail.zcliu.cs.umd.edu/vistitles/degree-of-misalignment-CHI19.pdf
27. Padilla, Kay, Hullman, Uncertainty Visualization (chapter) — https://friendly.github.io/6135/papers/Uncertainty_Visualization_Padilla_Kay_Hullman_2020.pdf
28. Kay et al. (CHI 2016), When (ish) is My Bus? — https://mucollective.northwestern.edu/project/when-ish-is-my-bus
29. Fernandes et al. (CHI 2018), Quantile Dotplots or CDFs Improve Transit Decision-Making — https://users.eecs.northwestern.edu/~jhullman/pn1957-fernandes.pdf
30. Hullman, Resnick, Adar (2015), Hypothetical Outcome Plots — https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0142444
31. Kale, Kay, Hullman (2020), Visual Reasoning Strategies for Effect Size — https://arxiv.org/abs/2007.14516
32. Padilla, Powell, Kay, Hullman (2021), Uncertain About Uncertainty — https://pmc.ncbi.nlm.nih.gov/articles/PMC7868089/
33. Hullman (2019), Why Authors Don't Visualize Uncertainty — https://arxiv.org/abs/1908.01697
34. Correll & Gleicher (2014), Error Bars Considered Harmful — https://graphics.cs.wisc.edu/Vis/ErrorBars/
35. Bank of England, Understanding the fan chart (1998) — https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart
36. Tufte, Sparkline theory and practice — https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/
37. Few, Bullet Graph Design Specification — http://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf
38. Financial Times, Visual Vocabulary — https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary
39. Datawrapper, Colorblindness part 2 — https://www.datawrapper.de/blog/colorblindness-part2
40. Datawrapper, Diverging vs sequential color scales — https://www.datawrapper.de/blog/diverging-vs-sequential-color-scales
41. Datawrapper, Confidence intervals and value markers — https://www.datawrapper.de/blog/confidence-intervals-value-markers-bar-charts/
42. Radar-chart critiques — https://observablehq.com/blog/avoid-radar-charts ; https://blog.scottlogic.com/2011/09/23/a-critique-of-radar-charts
43. Wall Street Prep, Football Field — https://www.wallstreetprep.com/knowledge/football-field-valuation-real-example-excel-template/
44. Mauboussin & Rappaport, Expectations Investing Q&A — https://www.fool.com.au/2022/01/20/expectations-investing-a-qampa-with-michael-mauboussin-and-alfred-rappaport-usfeed/
45. Morningstar Equity Research Methodology (Sept 2022) — https://www.morningstar.com/content/dam/marketing/shared/research/methodology/705988Morningstar_Equity_Research_Methodology.pdf
46. Morningstar, Introduction to the Uncertainty Rating (returned HTTP 403 when fetched; content taken from a search summary) — https://www.morningstar.com/stocks/an-introduction-morningstar-uncertainty-rating
47. Simply Wall St, How does the Snowflake work — https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work ; critique: https://stockunlock.com/simply-wall-st-review.html
48. Seeking Alpha, Quant Ratings & Factor Grades FAQ — https://seekingalpha.com/article/4263303-quant-ratings-factor-grades-faq ; https://help.seekingalpha.com/premium/quant-ratings-and-factor-grades-faq
49. TipRanks, Smart Score — https://www.tipranks.com/news/labs/get-a-full-stock-analysis-with-tipranks-smart-score
50. Bloomberg, How Terminal UX designers conceal complexity — https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity
51. Fiscal.ai user reviews — https://trustpilot.com/review/fiscal.ai
52. The CFO Club, Koyfin review — https://thecfoclub.com/tools/koyfin-review/
53. YCharts, Fundamental Charts overview — https://go.ycharts.com/knowledge-base/fundamental-charts-overview
54. Pre-mortem (Klein, HBR 2007; Mitchell et al. 1989) — https://en.wikipedia.org/wiki/Pre-mortem
55. WCAG 2.2 SC 1.4.1 Use of Color — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
56. WCAG 2.2 SC 1.4.3 Contrast (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
57. WCAG 2.2 SC 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
58. WCAG 2.2 SC 1.4.8 Visual Presentation — https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html
59. WCAG 2.2 SC 1.4.13 Content on Hover or Focus — https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
60. WCAG 2.2 SC 2.3.3 Animation from Interactions — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
61. WCAG 2.2 SC 2.2.2 Pause, Stop, Hide — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
62. WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
63. WCAG 2.2 SC 1.4.12 Text Spacing — https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
64. WAI-ARIA APG, Disclosure pattern — https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
65. W3C WAI, Complex Images tutorial — https://www.w3.org/WAI/tutorials/images/complex/
66. MDN, prefers-reduced-motion — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
67. Colour-vision deficiency prevalence review (PMC) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12385717/
68. Line-length research (Dyson & Haselgrove 2001, via Shaikh & Chaparro) — https://portfolio.erau.edu/en/publications/the-effects-of-line-length-on-reading-performance-of-online-news-/
69. MDN, font-variant-numeric — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
70. WCAG 2.2 SC 1.3.1 Info and Relationships — https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html
