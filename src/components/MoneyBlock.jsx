import { formatMoney } from '../../shared/money.cjs';
import { equivalentText } from '../../shared/rates.cjs';

export function Equivalents({ minor, rates, showMissing = false }) {
  const usd = rates && rates.USD
    ? equivalentText(minor, rates.USD, 'USD')
    : (showMissing ? 'USD: Set exchange rates' : null);
  const ksh = rates && rates.KES
    ? equivalentText(minor, rates.KES, 'KES')
    : (showMissing ? 'KSh: Set exchange rates' : null);
  if (!usd && !ksh) return null;
  return (
    <p className="equivalents">
      {usd ? <span>{usd}</span> : null}
      {ksh ? <span>{ksh}</span> : null}
    </p>
  );
}

export function MoneyBlock({ label, minor, currency, rates, primary = false }) {
  return (
    <div className={primary ? 'money-block primary' : 'money-block'}>
      <div className="money-label">{label}</div>
      {minor === null ? <div className="money-value">Unavailable</div> : (
        <>
          <div className="money-value">{formatMoney(minor, currency)}</div>
          <Equivalents minor={minor} rates={rates} showMissing={primary} />
        </>
      )}
    </div>
  );
}
