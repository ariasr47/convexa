// The valuation is money arithmetic a reader relies on: scenario values, the weighted value and the
// growth the price implies are published as computed, never typed. These pin the model against cases
// worked by hand, so a refactor that moves a discount factor or a tax line fails here, not on the site.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeValuation, impliedGrowth, runScenario } from './valuation.mjs';

/** A firm with no growth and a 10% margin on 100: worth exactly 100, the perpetuity, at a 10% rate. */
const flat = {
  price: { value: 8, asOf: '2026-10-12' },
  shares: 10,
  netCash: 0,
  revenue: 100,
  marginNow: 0.1,
  nol: 0,
  tax: 0,
  terminalTax: 0,
  terminalGrowth: 0,
  terminalWacc: 0.1,
  terminalRoc: 0.1,
  rocFollowsWacc: true,
  marginYear: 5,
  odds: null,
  sensitivity: null,
};
const scenario = {
  rev_y1: null,
  reinvest_y1: null,
  growth: 0,
  margin_y1: null,
  margin_target: 0.1,
  sales_to_capital: 1,
  wacc: 0.1,
  p_fail: 0,
  distress: 0,
};
const near = (actual, expected, places = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -places / 2, `${actual} ≉ ${expected}`);

test('worked cases: perpetuity, failure weighting, carried-forward losses, the growth fade', () => {
  // 10 a year forever at 10% is 100; per share over 10 shares, $10.
  near(runScenario(flat, scenario).value, 10, 6);

  // Net cash adds to equity; failure weights going concern against the distress value:
  // (100 + 50) / 10 = 15 → 15 × 0.7 + 2 × 0.3 = 11.10.
  near(
    runScenario({ ...flat, netCash: 50 }, { ...scenario, p_fail: 0.3, distress: 2 }).value,
    11.1,
    6,
  );

  // 20% tax, 30 of losses carried forward: years 1–3 untaxed (10 each), then 8 a year; terminal 8/0.1.
  // PV = 10 × 2.48685 + 8 × (6.14457 − 2.48685) + 80 / 1.1^10 = 84.97 → $8.50 a share.
  near(runScenario({ ...flat, tax: 0.2, terminalTax: 0.2, nol: 30 }, scenario).value, 8.5, 2);

  // A stated year-1 reinvestment replaces the sales-to-capital charge: 10 of profit less 10
  // reinvested in year 1, then the same perpetuity: 100 − 10 / 1.1 = 90.91 → $9.09 a share.
  near(runScenario(flat, { ...scenario, reinvest_y1: 10 }).value, 9.0909, 4);

  // A terminal tax rate of its own: 10 a year untaxed for ten years, then 8 forever.
  // 10 × 6.14457 + 80 / 1.1^10 = 92.29 → $9.23 a share.
  near(runScenario({ ...flat, terminalTax: 0.2 }, scenario).value, 9.2289, 4);

  // 10% for five years, then a straight fade to the 0% terminal rate: 8, 6, 4, 2, 0.
  const grown = runScenario(flat, { ...scenario, growth: 0.1 });
  near(grown.revenueY10, 100 * 1.1 ** 5 * 1.08 * 1.06 * 1.04 * 1.02, 6);
});

test('computeValuation: values against the price, odds-weighted value, and the price-implied growth', () => {
  const inputs = {
    ...flat,
    odds: [5, 10, 5],
    scenarios: [
      { name: 'bear', inputs: { ...scenario, margin_target: 0.05, margin_y1: 0.05 } },
      { name: 'base', inputs: scenario },
      { name: 'bull', inputs: { ...scenario, margin_target: 0.15, margin_y1: 0.15 } },
    ],
  };
  const out = computeValuation(inputs);
  near(out.scenarios.base.value, 10);
  near(out.scenarios.base.ev, 100); // enterprise value in $M, before the per-share split
  near(out.scenarios.base.vsPrice, 25); // $10 against an $8 price
  near(out.scenarios.bear.value, 5);
  near(out.scenarios.bull.value, 15);
  near(out.weighted.value, (5 * 5 + 10 * 10 + 5 * 15) / 20);
  assert.deepEqual(out.range, { lo: 5, hi: 15 });

  // Solving the base case for growth and plugging it back in returns the price. (Capital-light, so
  // growth earns more than it costs: a 30% return on new capital against a 10% cost.)
  const light = { ...scenario, sales_to_capital: 3 };
  const solved = impliedGrowth(flat, light, 12);
  assert.ok(solved.growth !== null && solved.growth > 0);
  near(runScenario(flat, { ...light, growth: solved.growth }).value, 12, 2);
  // A price no growth in range can reach says which side it fell off.
  assert.deepEqual(impliedGrowth(flat, light, 1e9), { growth: null, bound: 'above' });

  // Growth adds value only when new capital earns more than it costs: 30% on capital against a
  // 10% cost does; 5% (a 10% margin on 0.5 of revenue per dollar invested) destroys it.
  const growing = (s) =>
    computeValuation({
      ...flat,
      scenarios: ['bear', 'base', 'bull'].map((name) => ({ name, inputs: s })),
    });
  assert.equal(growing({ ...light, growth: 0.1 }).implied.growthAddsValue, true);
  assert.equal(
    growing({ ...scenario, sales_to_capital: 0.5, growth: 0.1 }).implied.growthAddsValue,
    false,
  );
});
