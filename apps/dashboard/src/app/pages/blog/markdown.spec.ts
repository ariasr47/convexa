/**
 * The blog's Markdown subset (markdown.ts). A parser that drops, merges or splits text does so
 * silently: the post would just read wrong. These pin the block and inline rules the published post
 * relies on, and that the real post parses without losing a line of text.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs, lists with continuations, quotes, rules and figures', () => {
    const md = [
      '# Title',
      '',
      'One line',
      'joined to the next.',
      '',
      '> A quote',
      '> on two lines.',
      '',
      '1. First',
      '   continues here',
      '2. Second',
      '- a bullet after a numbered list starts a new list',
      '',
      '---',
      '',
      '![A caption, with a comma](img/walls-and-flip.svg)',
      '### Small',
    ].join('\n');
    expect(parseMarkdown(md)).toEqual([
      { kind: 'h1', text: 'Title' },
      { kind: 'p', text: 'One line joined to the next.' },
      { kind: 'quote', text: 'A quote on two lines.' },
      { kind: 'ol', items: ['First continues here', 'Second'] },
      { kind: 'ul', items: ['a bullet after a numbered list starts a new list'] },
      { kind: 'hr' },
      { kind: 'figure', name: 'walls-and-flip', caption: 'A caption, with a comma' },
      { kind: 'h3', text: 'Small' },
    ]);
  });

  it('reads a table, dropping the separator row and keeping an escaped pipe in its cell', () => {
    const md = ['| Component | Cap |', '| --- | --- |', '| Vol stretch | \\|IV/HV − 1\\| |'].join(
      '\n',
    );
    expect(parseMarkdown(md)).toEqual([
      { kind: 'table', head: ['Component', 'Cap'], rows: [['Vol stretch', '|IV/HV − 1|']] },
    ]);
  });

  it('keeps every word of the published post', () => {
    let dir = process.cwd();
    for (let i = 0; i < 8 && !existsSync(resolve(dir, 'nx.json')); i++) dir = resolve(dir, '..');
    const md = readFileSync(resolve(dir, 'docs/blog/how-we-read-dealer-structure.md'), 'utf8');
    const words = (s: string) =>
      s
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .split(/\s+/);
    const text = parseMarkdown(md)
      .map((b) => {
        if ('text' in b) return b.text;
        if ('items' in b) return b.items.join(' ');
        if (b.kind === 'table') return [...b.head, ...b.rows.flat()].join(' ');
        if (b.kind === 'figure') return `${b.caption} img ${b.name} svg`;
        return '';
      })
      .join(' ');
    // The list numbers are markup, not text.
    expect(words(text)).toEqual(words(md.replace(/^\d+\.\s/gm, '')));
  });
});

describe('parseInline', () => {
  it('splits code, links, bold and both italic forms, leaving snake_case alone', () => {
    expect(
      parseInline('A `score_drivers` and [How](/methodology), **bold**, _em_ and *em2*.'),
    ).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'code', text: 'score_drivers' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', text: 'How', href: '/methodology' },
      { kind: 'text', text: ', ' },
      { kind: 'strong', text: 'bold' },
      { kind: 'text', text: ', ' },
      { kind: 'em', text: 'em' },
      { kind: 'text', text: ' and ' },
      { kind: 'em', text: 'em2' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseInline('a snake_case_word')).toEqual([{ kind: 'text', text: 'a snake_case_word' }]);
  });
});
