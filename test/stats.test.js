const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarize,
  buildChart,
  evaluateTarget,
  formatTenthsPercent,
  rangeError,
} = require('../shared/stats.cjs');
const { presetRange } = require('../shared/dates.cjs');

const today = '2026-10-22';

const sales = [
  { id: 1, entryDate: '2026-10-22', description: 'Stall', saleAmount: 10000, directCost: 2500 },
  { id: 2, entryDate: '2026-10-21', description: 'Order', saleAmount: 5000, directCost: 5000 },
  { id: 3, entryDate: '2026-10-01', description: 'Opening', saleAmount: 2000, directCost: 0 },
  { id: 4, entryDate: '2026-10-18', description: 'Sunday', saleAmount: 9999, directCost: 0 },
  { id: 5, entryDate: '2026-09-30', description: 'Old', saleAmount: 1000, directCost: 100 },
];

const expenses = [
  { id: 1, entryDate: '2026-10-22', description: 'Transport', amount: 1000 },
  { id: 2, entryDate: '2026-10-01', description: 'Rent', amount: 3000 },
  { id: 3, entryDate: '2026-09-30', description: 'Old rent', amount: 8000 },
];

function period(preset) {
  const range = presetRange(preset, today);
  return summarize(sales, expenses, range.from, range.to);
}

test('gross profit subtracts direct costs once and net profit subtracts other expenses once', () => {
  const month = period('month');
  assert.equal(month.overflow, false);
  assert.equal(month.saleTotal, 26999);
  assert.equal(month.directCosts, 7500);
  assert.equal(month.otherExpenses, 4000);
  assert.equal(month.gross, 19499);
  assert.equal(month.net, 15499);
  assert.equal(month.gross, month.saleTotal - month.directCosts);
  assert.equal(month.net, month.gross - month.otherExpenses);
  assert.notEqual(month.net, month.saleTotal - month.directCosts - month.directCosts - month.otherExpenses);

  const withoutExpenses = summarize(sales, [], '2026-10-01', '2026-10-31');
  assert.equal(month.gross, withoutExpenses.gross);
  assert.equal(month.directCosts, withoutExpenses.directCosts);
  assert.equal(month.otherExpenses, 4000);
});

test('weekly and daily totals ignore entries outside the period', () => {
  const week = period('week');
  assert.equal(week.saleTotal, 15000);
  assert.equal(week.directCosts, 7500);
  assert.equal(week.gross, 7500);
  assert.equal(week.otherExpenses, 1000);
  assert.equal(week.net, 6500);

  const day = period('today');
  assert.equal(day.saleTotal, 10000);
  assert.equal(day.directCosts, 2500);
  assert.equal(day.gross, 7500);
  assert.equal(day.net, 6500);
  assert.equal(day.saleCount, 1);
  assert.equal(day.expenseCount, 1);
});

test('chart buckets add up to the same profit as the totals', () => {
  const from = '2026-08-01';
  const to = '2026-10-22';
  const series = buildChart(sales, expenses, from, to);
  const summary = summarize(sales, expenses, from, to);
  assert.ok(series.length < 83);
  assert.equal(series.reduce((sum, item) => sum + item.gross, 0), summary.gross);
  assert.equal(series.reduce((sum, item) => sum + item.net, 0), summary.net);
});

test('target progress counts only the target period and can exceed the target', () => {
  const report = evaluateTarget(
    { metric: 'net', targetAmount: 10000, startDate: '2026-10-01', deadline: '2026-10-31' },
    sales,
    expenses,
    today,
  );
  assert.equal(report.overflow, false);
  assert.equal(report.status, 'active');
  assert.equal(report.profit, 15499);
  assert.equal(report.reached, true);
  assert.equal(report.surplus, 5499);
  assert.equal(report.remaining, 0);
  assert.equal(report.progressTenths, 1550);
  assert.equal(formatTenthsPercent(report.progressTenths), '155.0%');
  assert.equal(report.daysRemaining, 10);
  assert.equal(report.dailyNeeded, 0);
  assert.equal(report.elapsedDays, 22);
  assert.equal(report.averageDaily, 705);
  assert.equal(report.estimate, 21840);
});

test('losses, empty days, and entries outside the deadline stay exact', () => {
  const lossSales = [
    { id: 1, entryDate: '2026-10-22', saleAmount: 1000, directCost: 4000 },
    { id: 2, entryDate: '2026-10-18', saleAmount: 99999, directCost: 0 },
    { id: 3, entryDate: '2026-10-26', saleAmount: 99999, directCost: 0 },
  ];
  const lossExpenses = [{ id: 1, entryDate: '2026-10-22', amount: 500 }];
  const loss = evaluateTarget(
    { metric: 'gross', targetAmount: 6000, startDate: '2026-10-20', deadline: '2026-10-25' },
    lossSales,
    lossExpenses,
    today,
  );
  assert.equal(loss.profit, -3000);
  assert.equal(loss.remaining, 9000);
  assert.equal(loss.progressTenths, -500);
  assert.equal(formatTenthsPercent(loss.progressTenths), '-50.0%');
  assert.equal(loss.daysRemaining, 4);
  assert.equal(loss.dailyNeeded, 2250);
  assert.equal(loss.elapsedDays, 3);
  assert.equal(loss.averageDaily, -1000);
  assert.equal(loss.estimate, -6000);

  const net = evaluateTarget(
    { metric: 'net', targetAmount: 6000, startDate: '2026-10-20', deadline: '2026-10-25' },
    lossSales,
    lossExpenses,
    today,
  );
  assert.equal(net.profit, -3500);

  const sparse = evaluateTarget(
    { metric: 'gross', targetAmount: 1000, startDate: '2026-10-20', deadline: '2026-10-25' },
    [{ id: 1, entryDate: '2026-10-20', saleAmount: 300, directCost: 0 }],
    [],
    today,
  );
  assert.equal(sparse.elapsedDays, 3);
  assert.equal(sparse.averageDaily, 100);
  assert.equal(sparse.estimate, 600);
});

test('handles a target that has not started, has ended, or has no entries', () => {
  const upcoming = evaluateTarget(
    { metric: 'net', targetAmount: 5000, startDate: '2026-11-01', deadline: '2026-11-10' },
    [],
    [],
    today,
  );
  assert.equal(upcoming.status, 'not_started');
  assert.equal(upcoming.estimate, null);
  assert.equal(upcoming.daysUntilStart, 10);
  assert.equal(upcoming.daysRemaining, 10);
  assert.equal(upcoming.dailyNeeded, 500);
  assert.equal(upcoming.profit, 0);

  const ended = evaluateTarget(
    { metric: 'gross', targetAmount: 5000, startDate: '2026-10-01', deadline: '2026-10-15' },
    [],
    [],
    today,
  );
  assert.equal(ended.status, 'ended');
  assert.equal(ended.daysRemaining, 0);
  assert.equal(ended.dailyNeeded, null);
  assert.equal(ended.estimate, null);
  assert.equal(ended.reached, false);
  assert.equal(ended.elapsedDays, 15);
  assert.equal(ended.averageDaily, 0);

  const met = evaluateTarget(
    { metric: 'gross', targetAmount: 1000, startDate: '2026-10-01', deadline: '2026-10-15' },
    [{ id: 1, entryDate: '2026-10-10', saleAmount: 1000, directCost: 0 }],
    [],
    today,
  );
  assert.equal(met.reached, true);
  assert.equal(met.surplus, 0);
  assert.equal(met.profit, 1000);

  const sameDay = evaluateTarget(
    { metric: 'gross', targetAmount: 4000, startDate: today, deadline: today },
    [{ id: 1, entryDate: today, saleAmount: 2500, directCost: 500 }],
    [],
    today,
  );
  assert.equal(sameDay.status, 'active');
  assert.equal(sameDay.daysRemaining, 1);
  assert.equal(sameDay.profit, 2000);
  assert.equal(sameDay.estimate, 2000);
  assert.equal(sameDay.dailyNeeded, 2000);
});

test('a sale of 1000, direct costs of 700, and other expenses of 50', () => {
  const summary = summarize(
    [{ id: 1, entryDate: '2026-10-22', saleAmount: 100000, directCost: 70000 }],
    [{ id: 1, entryDate: '2026-10-22', amount: 5000 }],
    '2026-10-22',
    '2026-10-22',
  );
  assert.equal(summary.gross, 30000);
  assert.equal(summary.net, 25000);
  assert.equal(summary.gross, summary.saleTotal - summary.directCosts);
  assert.equal(summary.net, summary.gross - summary.otherExpenses);
});

test('future dated entries are not counted as profit already earned', () => {
  const report = evaluateTarget(
    { metric: 'net', targetAmount: 100000, startDate: '2026-10-20', deadline: '2026-10-31' },
    [
      { id: 1, entryDate: '2026-10-22', saleAmount: 10000, directCost: 0 },
      { id: 2, entryDate: '2026-10-24', saleAmount: 50000, directCost: 0 },
    ],
    [],
    today,
  );
  assert.equal(report.profit, 10000);
  assert.equal(report.status, 'active');
  assert.equal(report.daysRemaining, 10);
  assert.equal(report.estimate !== null, true);
});

test('rejects an inverted custom period', () => {
  assert.equal(rangeError('2026-10-22', '2026-10-01'), 'Start date must be on or before the end date.');
  assert.equal(rangeError('2026-10-01', '2026-10-22'), null);
});
