/**
 * Blog index (`/blog`) copy — SPEC §4 "Blog index". Eyebrow, heading and intro are pinned
 * VERBATIM from `design/src/screens/blog.mjs:15-17` (AC-C1a). The published card's own dek
 * is pinned verbatim from `blog.mjs:22-23` and lives beside its article in `BlogPage.tsx`'s
 * `BLOG_ARTICLES` (per-article data), not here.
 *
 * No draft-slot copy exists in this module. Owner ruling D-A = (A), 2026-09-10 (SPEC §1): the
 * index ships the one published read and NO draft slots — the `published | draft`
 * discriminated union has no member to discriminate this phase and is deliberately not built.
 */
export const BLOG_COPY = {
  eyebrow: 'Blog',
  heading: 'How we read structure',
  intro:
    'Dealer structure, score honesty, and the two clocks on the desk. The longer form of the ' +
    'in-app Methodology page. Articles render in the app theme — ink, Plex, one amber — never a ' +
    'separate template.',
  readPost: 'Read the post →',
} as const;
