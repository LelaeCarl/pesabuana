const { divRound } = require('./money.cjs');

const RATE_CODES = {
  USD: { label: 'USD', exponent: 2 },
  KES: { label: 'KSh', exponent: 2 },
};

function parseRate(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a rate.' };
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Enter a rate.' };
  if (input.includes(',')) return { ok: false, error: 'Use a dot for decimals, not a comma.' };
  if (!/^\d+(\.\d+)?$/.test(input)) return { ok: false, error: 'Enter a positive rate, such as 0.14.' };
  const [whole, frac = ''] = input.split('.');
  if (whole.length > 8) return { ok: false, error: 'That rate is too large.' };
  if (frac.length > 8) return { ok: false, error: 'Use at most 8 decimal places.' };
  if (/^0+$/.test(whole) && /^0*$/.test(frac)) {
    return { ok: false, error: 'Enter a rate above zero.' };
  }
  const unitsText = `${whole}${frac}`.replace(/^0+(?=\d)/, '');
  const units = Number(unitsText);
  if (!Number.isSafeInteger(units) || units <= 0) {
    return { ok: false, error: 'Enter a positive rate, such as 0.14.' };
  }
  return {
    ok: true,
    text: frac ? `${whole.replace(/^0+(?=\d)/, '') || '0'}.${frac}` : String(Number(whole)),
    scale: frac.length,
    units,
  };
}

function rateFromText(text) {
  if (!text) return null;
  const parsed = parseRate(text);
  if (!parsed.ok) return null;
  return { text: parsed.text, scale: parsed.scale, units: parsed.units };
}

// Multiply an RMB minor amount by a user rate and round only the displayed minor units.
function convertMinor(minor, rate, sourceExponent, destExponent) {
  if (!rate || !Number.isSafeInteger(minor)) return null;
  if (!Number.isSafeInteger(rate.units) || !Number.isSafeInteger(rate.scale)) return null;
  const shift = sourceExponent - destExponent + rate.scale;
  if (shift < 0) return null;
  const divisor = 10n ** BigInt(shift);
  return divRound(BigInt(minor) * BigInt(rate.units), divisor);
}

function formatGrouped(minor, exponent) {
  if (!Number.isSafeInteger(minor)) return null;
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const scale = 10 ** exponent;
  const whole = Math.floor(abs / scale);
  const frac = abs % scale;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = exponent === 0 ? grouped : `${grouped}.${String(frac).padStart(exponent, '0')}`;
  return negative ? `-${body}` : body;
}

function equivalentText(minor, rate, code) {
  const display = RATE_CODES[code];
  if (!display) return 'Set exchange rates';
  if (!rate) return 'Set exchange rates';
  const converted = convertMinor(minor, rate, 2, display.exponent);
  if (converted === null) return 'Too large to show';
  const body = formatGrouped(converted, display.exponent);
  if (body === null) return 'Too large to show';
  return `${display.label} ${body}, approximate`;
}

module.exports = {
  RATE_CODES,
  parseRate,
  rateFromText,
  convertMinor,
  equivalentText,
};
