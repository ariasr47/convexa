/**
 * Blog copy — design/src/screens/final/shell-site-docs.mjs (BLOG_INTRO, blogIndexBoard,
 * blogStates). The intro no longer ends with the old note about how articles render. Each post's
 * own title, dek and tag live with it in posts.ts.
 */
export const BLOG_COPY = {
  eyebrow: 'Blog',
  heading: 'How we read structure',
  intro:
    'Dealer structure, score honesty, and the two clocks on the desk: the longer form of the ' +
    'Methodology page.',
  readPost: 'Read the post →',
  schematic: 'Schematic — not a chart of any market.',
  onePost: 'One post so far. New posts appear here; drafts are never listed.',
  morePosts: 'New posts appear here; drafts are never listed.',
  emptyTitle: 'No posts yet.',
  emptyBody: 'Posts on how Convexa reads structure appear here.',
} as const;
