/**
 * The shapes `tools/research-notes/notes.mjs` emits for research/<TICKER>/*.md at build time. The
 * parser is the source of truth; keep these in step with its JSDoc typedefs.
 */
export type NoteInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: NoteInline[] }
  | { type: 'em'; children: NoteInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: NoteInline[] };

export type NoteList = {
  type: 'list';
  ordered: boolean;
  items: { children: NoteInline[]; list?: NoteList }[];
};

export type NoteBlock =
  | { type: 'heading'; level: 2 | 3; children: NoteInline[] }
  | { type: 'paragraph'; children: NoteInline[] }
  | NoteList
  | { type: 'quote'; children: NoteBlock[] }
  | { type: 'codeblock'; text: string }
  | { type: 'table'; header: NoteInline[][]; rows: NoteInline[][][] }
  | { type: 'rule' };

export type NoteStance = 'bullish' | 'bearish' | 'neutral' | 'watching';

export type ResearchNote = {
  ticker: string;
  date: string;
  title: string;
  slug: string;
  path: string;
  stance: NoteStance | null;
  horizon: string | null;
  updated: string | null;
  tags: string[];
  summary: string;
  blocks: NoteBlock[];
  sources: { href: string; label: string }[];
};

export type ResearchTickerSummary = {
  ticker: string;
  count: number;
  latest: Pick<ResearchNote, 'slug' | 'date' | 'updated' | 'title' | 'stance' | 'summary'>;
};
