import { useEffect, useState } from 'react';
import { formatStamp } from '../../shared/dates.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function Settings({ state, commit }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const hasRecords = state.sales.length > 0 || state.expenses.length > 0 || state.targets.length > 0 || state.rates.USD || state.rates.KES;

  async function backup() {
    setError('');
    setMessage('');
    const picked = await window.pesabuana.pickBackup();
    if (picked.error || picked.cancelled) {
      if (picked.error) setError(picked.error);
      return;
    }
    const result = await window.pesabuana.writeBackup(picked.filePath);
    if (result.error) setError(result.error);
    else setMessage('Backup saved.');
  }

  async function restore() {
    setConfirming(false);
    setError('');
    setMessage('');
    const picked = await window.pesabuana.pickRestore();
    if (picked.error || picked.cancelled) {
      if (picked.error) setError(picked.error);
      return;
    }
    const result = await commit(await window.pesabuana.restoreBackup(picked.filePath));
    if (result.error) setError(result.error);
    else setMessage('Backup restored.');
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Currency, backups, and your local records.</p>
        </div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="banner" role="status">{message}</p> : null}
      <div className="settings-layout">
        <nav className="settings-aside" aria-label="Settings sections">
          <button type="button" className="link" onClick={() => scrollToSection('exchange-rates')}>Exchange rates</button>
          <button type="button" className="link" onClick={() => scrollToSection('backups')}>Backups</button>
          <button type="button" className="link" onClick={() => scrollToSection('storage')}>Storage</button>
        </nav>
        <div>
          <section className="settings-card" id="exchange-rates">
            <h2>Exchange rates</h2>
            <p>Only the displayed equivalents change. Your records stay in RMB.</p>
            <div className="rate-row">
              <RateEditor code="USD" suffix="USD" rate={state.rates.USD} commit={commit} onError={setError} />
              <RateEditor code="KES" suffix="KSh" rate={state.rates.KES} commit={commit} onError={setError} />
            </div>
          </section>
          <section className="settings-card" id="backups">
            <h2>Backups</h2>
            <p>A backup includes your entries, targets, and exchange rates.</p>
            <div className="actions">
              <button type="button" className="button" onClick={backup}>Back up data</button>
              <button type="button" className="link" onClick={() => (hasRecords ? setConfirming(true) : restore())}>Restore backup</button>
            </div>
          </section>
          <section className="settings-card" id="storage">
            <h2>Local records</h2>
            <p>{state.sales.length} sales · {state.expenses.length} expenses · {state.targets.length} targets</p>
            <p className="storage-path">{state.databaseFile}</p>
          </section>
        </div>
      </div>
      {confirming ? (
        <ConfirmDialog
          title="Restore backup"
          message="Replace all current records with a backup? You will choose the file next. This includes entries, expenses, targets, exchange rates, and the currency."
          confirmLabel="Continue"
          onConfirm={restore}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}

function RateEditor({ code, suffix, rate, commit, onError }) {
  const [value, setValue] = useState(rate ? rate.text : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(rate ? rate.text : '');
  }, [rate]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    onError('');
    const result = await commit(await window.pesabuana.setRate(code, value));
    setBusy(false);
    if (result.error) setError(result.error);
  }

  async function clear() {
    setBusy(true);
    setError('');
    const result = await commit(await window.pesabuana.clearRate(code));
    setBusy(false);
    if (result.error) setError(result.error);
    else setValue('');
  }

  return (
    <form onSubmit={save}>
      <label className="field" htmlFor={`rate-${code}`}>
        {suffix}
        <span className="rate-equation">
          1 RMB =
          <input
            id={`rate-${code}`}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error ? 'true' : undefined}
            value={value}
            placeholder="0.00"
            onChange={(event) => setValue(event.target.value)}
          />
          {suffix}
        </span>
      </label>
      <div className="settings-bottom">
        <small>{rate ? `Last changed ${formatStamp(rate.updatedAt)}` : 'Set exchange rates'}</small>
        <div className="actions">
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving' : 'Save changes'}</button>
          {rate ? <button type="button" className="button" onClick={clear} disabled={busy}>Remove</button> : null}
        </div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
