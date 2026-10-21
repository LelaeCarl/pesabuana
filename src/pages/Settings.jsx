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
    <div className="sheet">
      <h1>Settings</h1>
      <p className="meta">Amounts are stored in RMB. Exchange rates only change how amounts are shown.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="banner">{message}</p> : null}
      <section className="section">
        <h2>Exchange rates</h2>
        <RateEditor code="USD" label="1 RMB =" suffix="USD" rate={state.rates.USD} commit={commit} onError={setError} />
        <RateEditor code="KES" label="1 RMB =" suffix="KSh" rate={state.rates.KES} commit={commit} onError={setError} />
      </section>
      <section className="section">
        <h2>Back up data</h2>
        <p className="meta">A backup is a copy of entries, expenses, targets, and exchange rates.</p>
        <div className="actions">
          <button type="button" className="primary" onClick={backup}>Back up data</button>
          <button type="button" onClick={() => (hasRecords ? setConfirming(true) : restore())}>Restore backup</button>
        </div>
      </section>
      <section className="section">
        <h2>Records</h2>
        <p>{state.sales.length} sales, {state.expenses.length} expenses, {state.targets.length} targets.</p>
        <p className="path">{state.databaseFile}</p>
      </section>
      {confirming ? (
        <ConfirmDialog
          title="Restore backup"
          message="Replace all current records with a backup? You will choose the file next. This includes entries, expenses, targets, exchange rates, and the currency."
          confirmLabel="Continue"
          onConfirm={restore}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

function RateEditor({ code, label, suffix, rate, commit, onError }) {
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
      <div className="rate-row">
        <span>{label}</span>
        <div className="field">
          <label htmlFor={`rate-${code}`}>{suffix}</label>
          <input id={`rate-${code}`} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Set exchange rates" />
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>Save changes</button>
          {rate ? <button type="button" onClick={clear} disabled={busy}>Remove</button> : null}
        </div>
      </div>
      {rate ? <p className="meta">Last changed {formatStamp(rate.updatedAt)}.</p> : <p className="meta">Set exchange rates</p>}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
