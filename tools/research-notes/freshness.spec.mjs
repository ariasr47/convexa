// Freshness decides whether a published note tells a reader "current" or "review due", from date
// windows. A wrong answer is silent and misleads: a stale verdict shown as current. One table pins
// each boundary: the day an event passes, the 30-day price edge, resolved events, and precedence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWhen } from './dates.mjs';
import { freshness, upcoming } from './freshness.mjs';

const when = (text) => /** @type {any} */ (parseWhen(text, { allowOngoing: true })).when;
const aging = {
  priceAsOf: '2026-10-12',
  events: [
    { kind: 'catalyst', label: 'Lock-up release', when: when('2026-10-14'), resolved: false },
    {
      kind: 'catalyst',
      label: 'Q3 results',
      when: when('2026-11-05..2026-11-16'),
      resolved: false,
    },
    { kind: 'catalyst', label: 'Launch', when: when('2026-10-13'), resolved: true },
    { kind: 'kill', label: 'Kill criterion #1', when: when('2026-11'), resolved: false },
    { kind: 'forecast', label: 'Forecast', when: when('by 2026-12-31'), resolved: false },
  ],
};

test('freshness: each boundary and the order of precedence', () => {
  const cases = [
    // [today, options, state, since, passed labels, next label, price stale]
    ['2026-10-12', {}, 'current', null, [], 'Lock-up release', false],
    ['2026-10-14', {}, 'current', null, [], 'Lock-up release', false], // counts the day AFTER
    ['2026-10-15', {}, 'due', '2026-10-14', ['Lock-up release'], 'Price turned 30 days old', false],
    ['2026-11-10', {}, 'due', '2026-10-14', ['Lock-up release'], 'Price turned 30 days old', false],
    [
      '2026-11-11',
      {},
      'due',
      '2026-10-14',
      ['Lock-up release', 'Price turned 30 days old'],
      'Q3 results',
      true,
    ],
    [
      '2026-11-17',
      {},
      'due',
      '2026-10-14',
      ['Lock-up release', 'Price turned 30 days old', 'Q3 results'],
      'Kill criterion #1',
      true,
    ],
    [
      '2026-10-15',
      { superseded: true },
      'superseded',
      '2026-10-14',
      ['Lock-up release'],
      'Price turned 30 days old',
      false,
    ],
    [
      '2026-10-21',
      { superseded: true, notFollowingSince: '2026-10-20' },
      'archived',
      '2026-10-14',
      ['Lock-up release'],
      'Price turned 30 days old',
      false,
    ],
    [
      '2026-10-12',
      { notFollowingSince: '2026-10-20' },
      'current',
      null,
      [],
      'Lock-up release',
      false,
    ],
  ];
  for (const [today, options, state, since, passed, next, stale] of cases) {
    const f = freshness(aging, { today, ...options });
    const name = `${today} ${JSON.stringify(options)}`;
    assert.equal(f.state, state, name);
    assert.equal(f.since, since, name);
    assert.deepEqual(
      f.passed.map((e) => e.label),
      passed,
      name,
    );
    assert.equal(f.next?.label ?? null, next, name);
    assert.equal(f.priceStale, stale, name);
  }
});

test('upcoming: open, unresolved catalysts inside the horizon, soonest first', () => {
  assert.deepEqual(
    upcoming(aging.events, '2026-10-12', 70).map((u) => [u.label, u.date, u.inDays]),
    [
      ['Lock-up release', '2026-10-14', 2],
      ['Q3 results', '2026-11-16', 24],
    ],
  );
  assert.deepEqual(
    upcoming(aging.events, '2026-10-12', 10).map((u) => u.label),
    ['Lock-up release'],
  );
});
