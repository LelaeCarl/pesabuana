const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRate, convertMinor, equivalentText } = require('../shared/rates.cjs');
const { formatMoney } = require('../shared/money.cjs');

test('formats RMB with the yuan symbol and keeps exact cents', () => {
  assert.equal(formatMoney(10000000, 'CNY'), '￥100,000.00');
  assert.equal(formatMoney(25000, 'CNY'), '￥250.00');
  assert.equal(formatMoney(-5000, 'CNY'), '-￥50.00');
});

test('missing rates ask to be set and entered rates convert exactly', () => {
  assert.equal(equivalentText(25000, null, 'USD'), 'Set exchange rates');
  assert.equal(parseRate('0').ok, false);
  assert.equal(parseRate('-1').ok, false);
  assert.equal(parseRate('1.2.3').ok, false);
  const usd = parseRate('0.14');
  const ksh = parseRate('18.50');
  assert.equal(usd.ok, true);
  assert.equal(convertMinor(25000, usd, 2, 2), 3500);
  assert.equal(equivalentText(25000, usd, 'USD'), 'USD 35.00, approximate');
  assert.equal(convertMinor(10000000, usd, 2, 2), 1400000);
  assert.equal(convertMinor(25000, ksh, 2, 2), 462500);
  assert.equal(equivalentText(25000, ksh, 'KES'), 'KSh 4,625.00, approximate');
  assert.equal(convertMinor(10, parseRate('0.20'), 2, 2), 2);
});
