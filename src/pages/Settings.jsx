import { useEffect, useState } from 'react';
import { formatStamp } from '../../shared/dates.cjs';
import { CategoryNameDialog } from '../components/CategoryField.jsx';
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
          <p className="subtitle">Currency, categories, backups, and your local records.</p>
        </div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="banner" role="status">{message}</p> : null}
      <div className="settings-layout">
        <nav className="settings-aside" aria-label="Settings sections">
          <button type="button" className="link" onClick={() => scrollToSection('exchange-rates')}>Exchange rates</button>
          <button type="button" className="link" onClick={() => scrollToSection('categories')}>Expense categories</button>
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
          <section className="settings-card" id="categories">
            <h2>Expense categories</h2>
            <p>Categories describe expenses. They do not change profit.</p>
            <CategoryManager state={state} commit={commit} onError={setError} />
          </section>
          <section className="settings-card" id="backups">
            <h2>Backups</h2>
            <p>A backup includes your entries, expense categories, targets, and exchange rates.</p>
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
          message="Replace all current records with a backup? You will choose the file next. This includes entries, expenses, categories, targets, exchange rates, and the currency."
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

function CategoryManager({ state, commit, onError }) {
  const [editor, setEditor] = useState(null);
  const [nameError, setNameError] = useState('');
  const [restoreOffer, setRestoreOffer] = useState(null);
  const categories = state.categories || [];
  const active = categories.filter((item) => !item.archived);
  const archived = categories.filter((item) => item.archived);

  function closeEditor() {
    setEditor(null);
    setNameError('');
    setRestoreOffer(null);
  }

  async function saveName(name) {
    if (!editor) return;
    const result = editor.mode === 'rename'
      ? await commit(await window.pesabuana.renameCategory(editor.category.id, name))
      : await window.pesabuana.addCategory(name);
    if (result.needsRestore) {
      setRestoreOffer(result);
      setNameError('');
      return;
    }
    if (result.error) {
      setNameError(result.error);
      onError('');
      return;
    }
    if (editor.mode !== 'rename') commit(result);
    closeEditor();
  }

  async function restoreOffered() {
    const result = await commit(await window.pesabuana.restoreCategory(restoreOffer.categoryId));
    if (result.error) {
      setNameError(result.error);
      return;
    }
    closeEditor();
  }

  async function archive(id) {
    onError('');
    const result = await commit(await window.pesabuana.archiveCategory(id));
    if (result.error) onError(result.error);
  }

  async function restore(id) {
    onError('');
    const result = await commit(await window.pesabuana.restoreCategory(id));
    if (result.error) onError(result.error);
  }

  return (
    <>
      <div className="actions">
        <button type="button" className="button" onClick={() => { setNameError(''); setRestoreOffer(null); setEditor({ mode: 'add' }); }}>Add category</button>
      </div>
      <ul className="category-list">
        {active.map((item) => (
          <li key={item.id}>
            <span title={item.name}>{item.name}</span>
            <span className="actions">
              <button type="button" className="row-action" onClick={() => { setNameError(''); setEditor({ mode: 'rename', category: item }); }}>Rename</button>
              <button type="button" className="row-action" onClick={() => archive(item.id)}>Archive</button>
            </span>
          </li>
        ))}
      </ul>
      {archived.length ? (
        <>
          <h3 className="section-title">Archived</h3>
          <ul className="category-list">
            {archived.map((item) => (
              <li key={item.id}>
                <span title={item.name}>{item.name}</span>
                <button type="button" className="row-action" onClick={() => restore(item.id)}>Restore</button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {editor ? (
        <CategoryNameDialog
          title={editor.mode === 'rename' ? 'Rename category' : 'Add category'}
          initial={editor.mode === 'rename' ? editor.category.name : ''}
          submitLabel={editor.mode === 'rename' ? 'Save name' : 'Save category'}
          error={nameError}
          restoreName={restoreOffer ? restoreOffer.name : ''}
          onCancel={closeEditor}
          onRestore={restoreOffered}
          onSubmit={saveName}
        />
      ) : null}
    </>
  );
}
