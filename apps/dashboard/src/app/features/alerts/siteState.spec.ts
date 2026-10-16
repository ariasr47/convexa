// The one word the Alerts page says about SEC EDGAR, and the Fired tag's word. Wrong here is silent
// and misleading: an EDGAR outage that reads "Not set up" sends the operator to a setting that is
// already set; a check where every read failed that reads "Updated" calls an outage quiet.
import { describe, expect, it } from 'vitest';
import { firedTag, secSite } from './siteState';

describe('secSite (W1-17)', () => {
  const done = { phase: 'done' as const, secFailed: false };
  it('maps each answer to its own word', () => {
    expect(secSite({ ...done, sec: 'not_configured' })).toBe('notSetUp');
    expect(secSite({ ...done, sec: 'unavailable' })).toBe('down');
    expect(secSite({ ...done, sec: 'off' })).toBe('off');
    expect(secSite({ ...done, sec: 'live' })).toBe('live');
  });
  it('no answer yet is checking, never Not set up', () => {
    expect(secSite({ phase: 'idle', sec: null, secFailed: false })).toBe('checking');
    expect(secSite({ phase: 'checking', sec: null, secFailed: false })).toBe('checking');
  });
  it('a read that failed is down, never Not set up', () => {
    expect(secSite({ phase: 'done', sec: null, secFailed: true })).toBe('down');
  });
  it('the demo is always live (its sample)', () => {
    expect(secSite({ phase: 'demo', sec: null, secFailed: false })).toBe('live');
  });
});

describe('firedTag (W1-44)', () => {
  const t = () => '9:00 AM';
  it('Updated only when every read answered, with the check’s own time', () => {
    expect(firedTag({ checkedAt: 1, reads: 3, failed: 0 }, t)).toEqual({
      state: 'updated',
      detail: 'checked 9:00 AM',
    });
  });
  it('every read failing is Source down, never Updated', () => {
    expect(firedTag({ checkedAt: 1, reads: 2, failed: 2 }, t).state).toBe('sourceDown');
  });
  it('a partial failure says how many', () => {
    expect(firedTag({ checkedAt: 1, reads: 3, failed: 1 }, t)).toEqual({
      state: 'sourceDown',
      detail: '1 of 3 reads · checked 9:00 AM',
    });
  });
});
