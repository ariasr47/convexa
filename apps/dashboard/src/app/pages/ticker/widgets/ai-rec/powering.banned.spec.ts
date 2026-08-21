import { describe, expect, it } from 'vitest';
import { POWERING } from './copy';

describe('Ask-AI powering copy — banned product vocabulary (AC-19 / D7)', () => {
  const banned = [/free/i, /Convexa Grok pool/i, /cheaper/i, /\bincluded\b/i];

  function collect(value: unknown, out: string[]): void {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) collect(v, out);
    }
  }

  it('POWERING strings never say free / pool / cheaper / included', () => {
    const strings: string[] = [];
    collect(POWERING, strings);
    expect(strings.length).toBeGreaterThan(5);
    expect(strings.filter((s) => banned.some((re) => re.test(s)))).toEqual([]);
  });
});
