/**
 * Tint discipline on the positions surface (AC-78, owner ruling #18; SPEC §4 *Call/put tint* and §7
 * invariant 6). The scoped canon lives in `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Banned table,
 * green/red row, amended 2026-09-03) and is quoted verbatim in the `docs/design/DESIGN_SYSTEM.md` stub.
 *
 * THE RULE: the direction hues (`success.main` / `error.main`, and as text the text-grade `upText` /
 * `downText`, 2026-10-13) appear on this surface in exactly FIVE places, all of them
 * SIGNED DOLLAR DIRECTION — the `pl` cell, the `pl_pct` cell, the group subtotal, the sparkline
 * stroke, and the `ClosedSummary` realized figure. Nothing else is ever tinted.
 *
 * THE DECISIVE ARGUMENT, carried so nobody re-proposes it: A SHORT CALL IS BEARISH. Tinting a
 * position green because it contains a call tells the trader the opposite of the truth — the same
 * error class as the off-exchange proximity chips rendering green on a no-side datum, but on the
 * trader's own money. Gamma/GEX surfaces KEEP call-vs-put colouring (there it distinguishes call
 * gamma from put gamma, a domain fact); position and P&L surfaces use DIRECTION ONLY.
 *
 * WHAT TURNS THIS RED: any branch in `PositionRow` / `PositionCard` / `LegDisclosure` that selects a
 * colour from call-vs-put, from long-vs-short, from debit-vs-credit, from the structure name, or
 * from the risk slot's figure-vs-reason.
 */
import { describe, expect, it } from 'vitest';

describe('tint discipline — token discipline (AC-81)', () => {
  const SOURCES = import.meta.glob(['./*.tsx', '!./*.spec.tsx'], {
    eager: true,
    query: '?raw',
    import: 'default',
  }) as Record<string, string>;

  /**
   * The FIVE legitimate carriers, each recognised by the SIGN COMPARISON that selects it. A tint
   * chosen from `right === 'call'`, `side === 'long'`, `net_entry_basis`, the structure name or the
   * risk slot's figure-vs-reason matches none of these and fails the scan.
   */
  const DIRECTION_BRANCH = /(pl_dollar|plColor|r\$|subtotal|last)\s*>=\s*0/;

  /**
   * PRE-EXISTING, OUT OF SCOPE: the `PAPER` tab badge in `PortfolioPanel` is chrome, not a position
   * or P&L datum, and it predates this feature. AC-78 scopes the ban to the row/card data surface.
   * Exempted BY LINE CONTENT (not by file) so the rest of that file stays covered.
   */
  const EXEMPT = /PAPER badge|color: 'success\.main',$|color: upText,$|palette\.success\.main\}66/;

  it('success/error are selected ONLY by a sign comparison — never by a leg or structure attribute', () => {
    const offenders: string[] = [];
    let carriers = 0;
    for (const [file, src] of Object.entries(SOURCES)) {
      for (const line of src.split('\n')) {
        const code = line.trim();
        if (code.startsWith('*') || code.startsWith('//')) continue; // prose cannot offend
        if (code.startsWith('import ')) continue; // naming a helper selects nothing
        if (!/success\.main|error\.main|\bupText\b|\bdownText\b/.test(code)) continue;
        if (DIRECTION_BRANCH.test(code)) {
          carriers += 1;
          continue;
        }
        if (EXEMPT.test(code)) continue;
        offenders.push(`${file}: ${code}`);
      }
    }
    expect(offenders).toEqual([]);
    // EXACTLY five carriers: pl cell, pl_pct cell (same `plColor`), the group subtotal, the
    // sparkline stroke, the ClosedSummary realized figure, and the card's own P/L block. A sixth
    // tinted site anywhere under positions/ fails here rather than shipping quietly.
    expect(carriers).toBe(5);
  });
});
