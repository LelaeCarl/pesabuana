import { formatMoney } from '../../shared/money.cjs';
import { equivalentText } from '../../shared/rates.cjs';

function shownEquivalent(minor, rate, code) {
  const text = equivalentText(minor, rate, code);
  if (!rate || text === 'Set exchange rates' || text === 'Too large to show') return text;
  return `≈ ${text.replace(/, approximate$/, '')}`;
}

export function Equivalents({ minor, rates, showMissing = false, onSetRates, savedNote = false }) {
  const usdRate = rates && rates.USD;
  const kshRate = rates && rates.KES;
  const usd = usdRate ? shownEquivalent(minor, usdRate, 'USD') : null;
  const ksh = kshRate ? shownEquivalent(minor, kshRate, 'KES') : null;
  const missing = (!usdRate || !kshRate) && showMissing;
  if (!usd && !ksh && !missing) return null;
  return (
    <p className="equivalents">
      {usd ? <span className="mono-num">{usd}</span> : null}
      {ksh ? <span className="mono-num">{ksh}</span> : null}
      {missing ? (
        <button type="button" className="rate-setup" onClick={onSetRates}>
          Set exchange rates
          <span className="sr"> for {usdRate ? 'KSh' : kshRate ? 'USD' : 'USD and KSh'}</span>
        </button>
      ) : null}
      {savedNote && (usd || ksh) ? (
        <button type="button" className="equivalent-note" title="Converted with the rates saved in Settings. These figures are approximate.">
          Saved rates
        </button>
      ) : null}
    </p>
  );
}

export function MoneyFigure({ minor, currency, hero = false }) {
  if (minor === null || minor === undefined) return <p className={hero ? 'hero-number' : 'metric-value'}>Unavailable</p>;
  const text = formatMoney(minor, currency);
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const symbol = currency.symbol;
  const amount = body.startsWith(symbol) ? body.slice(symbol.length) : body;
  if (!hero) {
    return <p className={`metric-value mono-num${negative ? ' negative' : ''}`}>{negative ? '-' : ''}{body}</p>;
  }
  return (
    <p className={`hero-number mono-num${negative ? ' negative' : ''}`}>
      {negative ? <span className="sign">-</span> : null}
      <span className="currency">{symbol}</span>
      {amount}
    </p>
  );
}
