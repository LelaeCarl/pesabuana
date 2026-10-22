const test = require('node:test');
const assert = require('node:assert/strict');
const { comparisonWindows, presetRange } = require('../shared/dates.cjs');
const { buildComparison, metricChange, summarize } = require('../shared/stats.cjs');

test('week-to-date uses matching weekdays, including a year boundary', () => {
  const october = comparisonWindows('week', '2026-10-22');
  assert.deepEqual(october.current, { from: '2026-10-19', to: '2026-10-22' });
  assert.deepEqual(october.previous, { from: '2026-10-12', to: '2026-10-15' });
  assert.equal(october.note, null);

  const newYear = comparisonWindows('week', '2027-01-01');
  assert.deepEqual(newYear.current, { from: '2026-12-28', to: '2027-01-01' });
  assert.deepEqual(newYear.previous, { from: '2026-12-21', to: '2026-12-25' });
});

test('month-to-date uses matching elapsed days, including February, leap years, and December', () => {
  const october = comparisonWindows('month', '2026-10-22');
  assert.deepEqual(october.current, { from: '2026-10-01', to: '2026-10-22' });
  assert.deepEqual(october.previous, { from: '2026-09-01', to: '2026-09-22' });
  assert.equal(october.note, null);

  const march = comparisonWindows('month', '2027-03-31');
  assert.deepEqual(march.current, { from: '2027-03-01', to: '2027-03-28' });
  assert.deepEqual(march.previous, { from: '2027-02-01', to: '2027-02-28' });
  assert.equal(march.note, 'Comparing the first 28 days of each month.');

  const leap = comparisonWindows('month', '2028-03-31');
  assert.deepEqual(leap.current, { from: '2028-03-01', to: '2028-03-29' });
  assert.deepEqual(leap.previous, { from: '2028-02-01', to: '2028-02-29' });
  assert.equal(leap.note, 'Comparing the first 29 days of each month.');

  const leapDay = comparisonWindows('month', '2028-02-29');
  assert.deepEqual(leapDay.current, { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(leapDay.previous, { from: '2028-01-01', to: '2028-01-29' });
  assert.equal(leapDay.note, null);

  const january = comparisonWindows('month', '2027-01-15');
  assert.deepEqual(january.current, { from: '2027-01-01', to: '2027-01-15' });
  assert.deepEqual(january.previous, { from: '2026-12-01', to: '2026-12-15' });
});

test('a shortened comparison window does not replace the full overview range', () => {
  const full = presetRange('month', '2027-03-31');
  assert.deepEqual(full, { from: '2027-03-01', to: '2027-03-31' });
  const windows = comparisonWindows('month', '2027-03-31');
  const sales = [
    { entryDate: '2027-03-10', saleAmount: 10000, directCost: 0 },
    { entryDate: '2027-03-31', saleAmount: 5000, directCost: 0 },
  ];
  const headline = summarize(sales, [], full.from, full.to);
  const comparison = buildComparison(sales, [], 'month', '2027-03-31');
  assert.equal(headline.saleTotal, 15000);
  assert.equal(comparison.rows[0].current, 10000);
  assert.notEqual(comparison.rows[0].current, headline.saleTotal);
});

test('change math covers positive, zero, and negative baselines without invented percentages', () => {
  assert.deepEqual(metricChange(1200000, 1000000), { amount: 200000, percentTenths: 200, basis: 'percent' });
  assert.deepEqual(metricChange(80000, 100000), { amount: -20000, percentTenths: -200, basis: 'percent' });
  assert.deepEqual(metricChange(0, 0), { amount: 0, percentTenths: null, basis: 'none' });
  assert.deepEqual(metricChange(0, 300000), { amount: -300000, percentTenths: -1000, basis: 'percent' });
  assert.deepEqual(metricChange(400000, 0), { amount: 400000, percentTenths: null, basis: 'amount' });
  assert.deepEqual(metricChange(100000, -50000), { amount: 150000, percentTenths: null, basis: 'amount' });
  const near = metricChange(10001, 10000);
  assert.equal(near.percentTenths, 0);
  assert.equal(near.basis, 'percent');

  const empty = buildComparison([], [], 'week', '2026-10-22');
  assert.equal(empty.previousEmpty, true);
  assert.equal(empty.rows[2].change.basis, 'none');
  assert.equal(empty.rows[2].change.percentTenths, null);
});

test('today and custom ranges have no comparison window', () => {
  assert.equal(comparisonWindows('today', '2026-10-22'), null);
  assert.equal(comparisonWindows('custom', '2026-10-22'), null);
});

test('future dates outside the comparison window are not counted', () => {
  const sales = [{ entryDate: '2026-10-25', saleAmount: 900000, directCost: 0 }];
  const comparison = buildComparison(sales, [], 'week', '2026-10-22');
  assert.equal(comparison.rows[0].current, 0);
  assert.equal(comparison.previousEmpty, true);
});
