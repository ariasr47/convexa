import { describe, expect, it } from 'vitest';
import {
  documentHostIsPages,
  parseSittingResearchBase,
  type SittingResearchBaseParse,
} from './sittingBase';

function arm(result: SittingResearchBaseParse): string {
  return result.kind;
}

describe('parseSittingResearchBase', () => {
  it('OriginEmpty — missing / whitespace-only', () => {
    expect(arm(parseSittingResearchBase(''))).toBe('OriginEmpty');
    expect(arm(parseSittingResearchBase('   '))).toBe('OriginEmpty');
    expect(arm(parseSittingResearchBase('\t\n'))).toBe('OriginEmpty');
    expect(arm(parseSittingResearchBase(null))).toBe('OriginEmpty');
    expect(arm(parseSittingResearchBase(undefined))).toBe('OriginEmpty');
  });

  it('OriginPagesHost — pages.dev and *.pages.dev (ASCII case-insensitive)', () => {
    expect(arm(parseSittingResearchBase('https://pages.dev'))).toBe('OriginPagesHost');
    expect(arm(parseSittingResearchBase('https://convexa.pages.dev'))).toBe('OriginPagesHost');
    expect(arm(parseSittingResearchBase('https://hash.convexa.pages.dev'))).toBe('OriginPagesHost');
    expect(arm(parseSittingResearchBase('https://CONVEXA.PAGES.DEV'))).toBe('OriginPagesHost');
    expect(arm(parseSittingResearchBase('https://convexa.Pages.Dev/'))).toBe('OriginPagesHost');
  });

  it('OriginUnusable — relative /api poison and non-absolute', () => {
    expect(arm(parseSittingResearchBase('/api'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('/api/_research'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('api/_research'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('not a url'))).toBe('OriginUnusable');
  });

  it('OriginUnusable — userinfo / query / fragment / non-root path', () => {
    expect(arm(parseSittingResearchBase('https://user:pass@api.example.com'))).toBe(
      'OriginUnusable',
    );
    expect(arm(parseSittingResearchBase('https://api.example.com?x=1'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('https://api.example.com#frag'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('https://api.example.com/v1'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('https://api.example.com/api/_research'))).toBe(
      'OriginUnusable',
    );
  });

  it('OriginUnusable — non-loopback http', () => {
    expect(arm(parseSittingResearchBase('http://api.example.com'))).toBe('OriginUnusable');
    expect(arm(parseSittingResearchBase('http://192.168.1.1:8000'))).toBe('OriginUnusable');
  });

  it('usable https — non-Pages host, canonical form', () => {
    const r = parseSittingResearchBase('https://api.example.com');
    expect(r).toEqual({ kind: 'usable', base: 'https://api.example.com' });

    const trailing = parseSittingResearchBase('https://api.example.com/');
    expect(trailing).toEqual({ kind: 'usable', base: 'https://api.example.com' });

    const upper = parseSittingResearchBase('HTTPS://API.Example.COM');
    expect(upper).toEqual({ kind: 'usable', base: 'https://api.example.com' });

    const withPort = parseSittingResearchBase('https://api.example.com:8443');
    expect(withPort).toEqual({ kind: 'usable', base: 'https://api.example.com:8443' });

    const defaultHttpsPort = parseSittingResearchBase('https://api.example.com:443');
    expect(defaultHttpsPort).toEqual({ kind: 'usable', base: 'https://api.example.com' });
  });

  it('usable loopback http — 127.0.0.1 / localhost / ::1', () => {
    expect(parseSittingResearchBase('http://127.0.0.1:8000')).toEqual({
      kind: 'usable',
      base: 'http://127.0.0.1:8000',
    });
    expect(parseSittingResearchBase('http://localhost:8000')).toEqual({
      kind: 'usable',
      base: 'http://localhost:8000',
    });
    expect(parseSittingResearchBase('http://[::1]:8000')).toEqual({
      kind: 'usable',
      base: 'http://[::1]:8000',
    });
    expect(parseSittingResearchBase('http://127.0.0.1')).toEqual({
      kind: 'usable',
      base: 'http://127.0.0.1',
    });
    expect(parseSittingResearchBase('http://127.0.0.1:80')).toEqual({
      kind: 'usable',
      base: 'http://127.0.0.1',
    });
  });

  it('root path alone is allowed on usable https', () => {
    expect(parseSittingResearchBase('https://api.example.com/')).toEqual({
      kind: 'usable',
      base: 'https://api.example.com',
    });
  });
});

describe('documentHostIsPages', () => {
  it('true for pages.dev and *.pages.dev hosts', () => {
    expect(documentHostIsPages('pages.dev')).toBe(true);
    expect(documentHostIsPages('convexa.pages.dev')).toBe(true);
    expect(documentHostIsPages('hash.convexa.pages.dev')).toBe(true);
    expect(documentHostIsPages('CONVEXA.PAGES.DEV')).toBe(true);
  });

  it('false for non-Pages hosts', () => {
    expect(documentHostIsPages('api.example.com')).toBe(false);
    expect(documentHostIsPages('localhost:4200')).toBe(false);
    expect(documentHostIsPages('127.0.0.1:4200')).toBe(false);
    expect(documentHostIsPages('pages.dev.evil.com')).toBe(false);
  });
});
