import { describe, expect, it } from 'vitest';
import { BANNED_ON_SCREEN, COPY, ORIGIN_BLOCKED_BANNED, originRejectedBody } from './copy';

describe('copy — exact SPEC §4', () => {
  it('AppBar / title / chip', () => {
    expect(COPY.appBar).toBe('Convexa · Session archive');
    expect(COPY.documentTitle).toBe('Session archive — Convexa');
    expect(COPY.readOnlyChip).toBe('read-only');
  });

  it('gate labels and unlock', () => {
    expect(COPY.originLabel).toBe('API origin');
    expect(COPY.tokenLabel).toBe('Metrics token');
    expect(COPY.unlock).toBe('Unlock');
    expect(COPY.changeOriginOrToken).toBe('Change origin or token');
  });

  it('three origin-rejected bodies', () => {
    expect(originRejectedBody('empty')).toBe(COPY.originRejectedEmpty);
    expect(originRejectedBody('pages')).toBe(COPY.originRejectedPages);
    expect(originRejectedBody('unusable')).toBe(COPY.originRejectedUnusable);
  });

  it('origin-blocked must not contain blocked occupancy', () => {
    expect(COPY.originBlockedBody).not.toContain(ORIGIN_BLOCKED_BANNED);
    expect(ORIGIN_BLOCKED_BANNED).toBe('blocked occupancy');
  });

  it('banned on-screen strings', () => {
    expect(BANNED_ON_SCREEN).toEqual(
      expect.arrayContaining([
        '$398',
        'weekly corpus',
        'Connected to ',
        '[PASS]',
        'Instrumentation: ON',
      ]),
    );
  });

  it('coverage standing / unavailable', () => {
    expect(COPY.coverageEvidence).toBe('Evidence: this process');
    expect(COPY.coverageUnavailable).toBe('Coverage readout unavailable.');
    expect(COPY.staleChip).toBe("Couldn't refresh — keeping the last list.");
  });
});
