const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoney, formatMoney, minorToInput, divRound, divCeil } = require('../shared/money.cjs');

test('stores decimal money as exact minor units', () => {
  const first = parseMoney('0.10', 2);
  const second = parseMoney('0.20', 2);
  assert.equal(first.minor + second.minor, 30);
  assert.equal(formatMoney(first.minor + second.minor, 'USD'), 'USD 0.30');
});

test('pads a short decimal and rejects extra places', () => {
  assert.equal(parseMoney('0.1', 2).minor, 10);
  assert.equal(parseMoney('1.2', 3).minor, 1200);
  assert.equal(parseMoney('10', 2).minor, 1000);
  assert.equal(parseMoney('10', 0).minor, 10);
  assert.equal(parseMoney('10.5', 0).ok, false);
  assert.equal(parseMoney('1.234', 2).ok, false);
  assert.equal(parseMoney('12,50', 2).ok, false);
  assert.equal(parseMoney('-5', 2).ok, false);
  assert.equal(parseMoney('', 2).ok, false);
});

test('rejects amounts that are too large', () => {
  assert.equal(parseMoney('1000000000000.00', 2).ok, false);
  assert.equal(parseMoney('999999999999.99', 2).ok, true);
});

test('formats grouped amounts and losses', () => {
  assert.equal(formatMoney(123456789, 'KES'), 'KES 1,234,567.89');
  assert.equal(formatMoney(-2550, 'KES'), '-KES 25.50');
  assert.equal(formatMoney(0, 'JPY'), 'JPY 0');
  assert.equal(formatMoney(1234, 'KWD'), 'KWD 1.234');
});

test('converts stored amounts back to input text', () => {
  assert.equal(minorToInput(1050, 2), '10.50');
  assert.equal(minorToInput(0, 0), '0');
  assert.equal(minorToInput(5, 3), '0.005');
});

test('rounds rates without binary fractions', () => {
  assert.equal(divRound(1, 2), 1);
  assert.equal(divRound(-1, 2), -1);
  assert.equal(divRound(15499, 22), 705);
  assert.equal(divCeil(9000, 4), 2250);
  assert.equal(divCeil(0, 4), 0);
  assert.equal(divRound(BigInt(100) * 10n, 3n), 333);
});
