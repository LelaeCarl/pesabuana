const { getCurrency } = require('./currencies.cjs');

function maxMinor(exponent) {
  let value = 1;
  for (let i = 0; i < 12 + exponent; i += 1) value *= 10;
  return value - 1;
}

function parseMoney(raw, exponent) {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter an amount.' };
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Enter an amount.' };
  if (input.includes(',')) {
    return { ok: false, error: 'Use a dot for decimals, not a comma.' };
  }
  if (!/^\d+(\.\d+)?$/.test(input)) {
    return { ok: false, error: 'Enter a valid amount.' };
  }
  const [whole, frac = ''] = input.split('.');
  if (whole.length > 12) return { ok: false, error: 'Amount is too large.' };
  if (frac.length > exponent) {
    return {
      ok: false,
      error: exponent === 0
        ? 'Use a whole number for this currency.'
        : `Use at most ${exponent} decimal places.`,
    };
  }
  const padded = frac.padEnd(exponent, '0');
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  const minor = Number(digits);
  if (!Number.isSafeInteger(minor) || minor > maxMinor(exponent)) {
    return { ok: false, error: 'Amount is too large.' };
  }
  return { ok: true, minor };
}

function minorToInput(minor, exponent) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Amount cannot be shown.');
  const scale = 10 ** exponent;
  const whole = Math.floor(minor / scale);
  if (exponent === 0) return String(whole);
  const frac = minor % scale;
  return `${whole}.${String(frac).padStart(exponent, '0')}`;
}

function formatMoney(minor, currencyOrCode) {
  const currency = typeof currencyOrCode === 'string'
    ? getCurrency(currencyOrCode)
    : currencyOrCode;
  if (!currency) throw new Error('Unknown currency.');
  if (!Number.isSafeInteger(minor)) throw new Error('Amount cannot be shown.');
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const scale = 10 ** currency.exponent;
  const whole = Math.floor(abs / scale);
  const frac = abs % scale;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = currency.exponent === 0
    ? grouped
    : `${grouped}.${String(frac).padStart(currency.exponent, '0')}`;
  const gap = currency.symbol === '￥' ? '' : ' ';
  const core = `${currency.symbol}${gap}${body}`;
  return negative ? `-${core}` : core;
}

function isSafeNonNegative(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

// Integer division. Half steps round away from zero. Overflow returns null.
function divRound(numerator, denominator) {
  const n = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
  const d = typeof denominator === 'bigint' ? denominator : BigInt(denominator);
  if (d === 0n) return null;
  const negative = (n < 0n) !== (d < 0n);
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const rounded = (an + ad / 2n) / ad;
  const signed = negative ? -rounded : rounded;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (signed > max || signed < -max) return null;
  return Number(signed);
}

// Ceiling for a non-negative amount split across days.
function divCeil(numerator, denominator) {
  if (!Number.isSafeInteger(denominator) || denominator <= 0) return null;
  if (!Number.isSafeInteger(numerator) || numerator <= 0) return 0;
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const q = (n + d - 1n) / d;
  if (q > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(q);
}

module.exports = {
  maxMinor,
  parseMoney,
  minorToInput,
  formatMoney,
  isSafeNonNegative,
  divRound,
  divCeil,
};
