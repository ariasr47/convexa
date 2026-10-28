// Final · Planned · the trade journal (spec 08, docs/product/specs/2026-10-26/08-trade-journal.md): its eight rows
// in BOARD BRIEF order, each from its own file, all `section: 'planned'`, so they land on the "Planned · not
// built" page after the public-data tools. Each row is the spec card and its boards (BOARD BRIEF: 43 boards and
// 8 spec cards), drawn on the journal kit (./journal-kit.mjs) and the Sample journal (design/src/data/
// journal-sample.mjs). The row lanes' contract is tmp/journal-boards/KIT.md.
import { ROW as TIMELINE } from './journal-timeline.mjs';
import { ROW as COMPOSE } from './journal-compose.mjs';
import { ROW as ENTRY } from './journal-entry.mjs';
import { ROW as REVIEW } from './journal-review.mjs';
import { ROW as RULEBOOK } from './journal-rulebook.mjs';
import { ROW as TIDY_IMPORT } from './journal-tidy-import.mjs';
import { ROW as OVERLAYS } from './journal-overlays.mjs';
import { ROW as SETTINGS } from './journal-settings.mjs';

export const ROWS = [TIMELINE, COMPOSE, ENTRY, REVIEW, RULEBOOK, TIDY_IMPORT, OVERLAYS, SETTINGS];
