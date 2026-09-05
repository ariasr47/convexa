/**
 * The HARDENED emotion-CSS-rule reader (curvature-v2-foundations SPEC §2.5). Extracted to its own
 * plain module (not a `.spec.ts` file) so BOTH `type-floor.spec.tsx` and `FigureCell.spec.tsx` can
 * import it without importing one spec file into another — a spec-into-spec import would re-run
 * the imported file's top-level `describe()` registrations inside the importer's test context.
 *
 * The OLD reader (`css.split('.${cls}{')[1]?.split('}')[0]`) returned only the FIRST rule bearing
 * the class and stopped at the first `}` — structurally blind to a hoisted `@container` block, and
 * it would have PASSED with those blocks deleted. This version captures EVERY block bearing the
 * class via a global regex over the joined, whitespace-stripped `<style>` text.
 */

/** Pure checker (drives the mutation guard in `type-floor.spec.tsx`). */
export function allRulesForClass(css: string, cls: string): string[] {
  const squashed = css.replace(/\s+/g, '');
  const blocks = Array.from(
    squashed.matchAll(new RegExp(`\\.${cls}\\{([^}]*)\\}`, 'g')),
    (m) => m[1],
  );
  return blocks;
}

/** The joined text of every `<style>` element currently in the document. */
export function joinedStyleText(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
}

/** The first `css-*` emotion class an element carries (throws via the caller's own assertion if absent). */
export function emotionClassOf(el: Element): string | undefined {
  return Array.from(el.classList).find((c) => c.startsWith('css-'));
}
