/**
 * emDashCoalesce.scan.spec.ts — rec-absence-literals-hole (PLAN F14, SPEC §7 Layer 3, AC-17).
 *
 * Targets the COALESCING PATTERN `?? '—'` / `?? "—"` (and its escaped/entity forms) within the ai-rec
 * folder — a *pattern*, not a character, so it is silent against the ~135 legitimate punctuation
 * em-dashes already in this folder (`copy.ts` 50, `AiRecPanel.tsx` 57, `literals.ts` 28). Follows the
 * shipped `bannedWords.scan.spec.ts` idiom (`import.meta.glob` with
 * `{ query: '?raw', import: 'default', eager: true }`, a `.spec.` filter, `stripComments`, TWO
 * anti-vacuity tests) but NOT its rule — this is a different check in the same idiom, no
 * "byte-for-byte" claim.
 *
 * **Bound, stated plainly:** folder-scoped, evadable by rewriting the expression. AC-17 does NOT lean
 * on this layer — Layer 2 (`reservedMark.render.spec.tsx`) is the DOM-output assertion no source-shape
 * rewrite can evade.
 */
import { describe, expect, it } from 'vitest';

const RAW: Record<string, string> = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const EM = '—';

/** Normalize CR-LF to LF, then the escape and entity spellings to the literal character, so the
 *  pattern cannot be evaded by respelling it. `core.autocrlf = true` and there is no `.gitattributes`
 *  — the `ai-rec-grounding` guard-8c pin failed closed on a fresh Windows checkout for exactly this. */
function normalize(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\\u\{?2014\}?/gi, EM)
    .replace(/&mdash;/gi, EM)
    .replace(/&#8212;/g, EM)
    .replace(/&#x2014;/gi, EM);
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const coalesce = () => new RegExp(`\\?\\?\\s*(['"\`])\\s*${EM}\\s*\\1`, 'g');

const appFiles = () => Object.keys(RAW).filter((p) => !p.includes('.spec.'));

describe('rec-absence-literals-hole · Layer 3 — the coalescing-pattern scan (AC-17)', () => {
  it('anti-vacuity 1 — the glob found a real, non-empty file set, including the load-bearing modules', () => {
    const files = appFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const must of ['./AiRecPanel.tsx', './literals.ts', './copy.ts']) {
      expect(files, `${must} missing from the scan`).toContain(must);
    }
  });

  it('the rule — no non-spec file under the folder matches the coalescing pattern', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(RAW)) {
      if (path.includes('.spec.')) continue;
      const normalized = stripComments(normalize(src));
      if (coalesce().test(normalized)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it('anti-vacuity 2 (the mutation) — the matcher DOES fire on a poison written in escaped form, and on each respelling', () => {
    for (const poison of [
      `value={s.structure ?? '${EM}'}`,
      'value={s.structure ?? "\\u2014"}',
      "value={s.structure ?? '&mdash;'}",
      `value={s.structure ?? '${EM}'}\r\n`,
    ]) {
      expect(normalize(poison).match(coalesce()), poison).not.toBeNull();
    }
  });

  it('the bound, demonstrated — the scan does NOT fire on ordinary prose punctuation using the same character', () => {
    const prose = `Not pre-filled ${EM} the read named no Strike(s).`;
    expect(coalesce().test(normalize(prose))).toBe(false);
  });
});
