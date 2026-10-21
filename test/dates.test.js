const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isRealDate,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  daysBetweenInclusive,
  addDays,
  presetRange,
  formatRange,
} = require('../shared/dates.cjs');

test('weeks start on Monday', () => {
  assert.equal(startOfWeek('2026-10-22'), '2026-10-19');
  assert.equal(endOfWeek('2026-10-22'), '2026-10-25');
  assert.equal(startOfWeek('2026-10-19'), '2026-10-19');
  assert.equal(startOfWeek('2026-10-18'), '2026-10-12');
  assert.equal(endOfWeek('2026-10-18'), '2026-10-18');
});

test('months include the real last day', () => {
  assert.equal(startOfMonth('2026-10-22'), '2026-10-01');
  assert.equal(endOfMonth('2026-10-22'), '2026-10-31');
  assert.equal(endOfMonth('2026-02-01'), '2026-02-28');
  assert.equal(endOfMonth('2024-02-01'), '2024-02-29');
});

test('counts calendar days and rejects impossible dates', () => {
  assert.equal(daysBetweenInclusive('2026-10-22', '2026-10-22'), 1);
  assert.equal(daysBetweenInclusive('2026-10-22', '2026-10-25'), 4);
  assert.equal(daysBetweenInclusive('2026-10-22', '2026-11-01'), 11);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(isRealDate('2026-02-29'), false);
  assert.equal(isRealDate('2024-02-29'), true);
  assert.equal(isRealDate('2026-13-01'), false);
});

test('preset periods use the local calendar', () => {
  assert.deepEqual(presetRange('today', '2026-10-22'), {
    from: '2026-10-22',
    to: '2026-10-22',
  });
  assert.deepEqual(presetRange('week', '2026-10-22'), {
    from: '2026-10-19',
    to: '2026-10-25',
  });
  assert.deepEqual(presetRange('month', '2026-10-22'), {
    from: '2026-10-01',
    to: '2026-10-31',
  });
  assert.equal(formatRange('2026-10-19', '2026-10-25'), '19 Oct 2026 to 25 Oct 2026');
});
