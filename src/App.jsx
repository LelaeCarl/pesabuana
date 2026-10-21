import { useEffect, useState } from 'react';
import { todayISO } from '../shared/dates.cjs';
import { EntryDialog } from './components/EntryDialog.jsx';
import { Entries } from './pages/Entries.jsx';
import { Overview } from './pages/Overview.jsx';
import { Targets } from './pages/Targets.jsx';
import { Settings } from './pages/Settings.jsx';

const PAGES = [
  ['overview', 'Overview'],
  ['entries', 'Entries'],
  ['targets', 'Targets'],
  ['settings', 'Settings'],
];

export default function App() {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState('overview');
  const [draft, setDraft] = useState(null);
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [toast, setToast] = useState('');
  const today = todayISO();

  useEffect(() => {
    let active = true;
    if (!window.pesabuana) {
      setLoadError('Open pesabuana as the desktop app.');
      return undefined;
    }
    window.pesabuana.getState()
      .then((result) => {
        if (!active) return;
        if (result.error) setLoadError(result.error);
        else setState(result.state);
      })
      .catch(() => {
        if (active) setLoadError('The records could not be opened.');
      });
    const stop = window.pesabuana.onMenuAction((action) => {
      if (PAGES.some(([id]) => id === action)) {
        setPage(action);
        setDraft(null);
        return;
      }
      if (action === 'backup' || action === 'restore') setPage('settings');
    });
    return () => {
      active = false;
      if (stop) stop();
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function commit(result) {
    if (!result) return { error: 'Something went wrong.' };
    if (result.state) setState(result.state);
    return result;
  }

  function openEntry(kind, record = null) {
    setDraft({ kind, record });
  }

  function editRow(row) {
    openEntry(row.kind, row.record);
  }

  function editTarget(id) {
    setPage('targets');
    setEditingTargetId(id);
  }

  if (loadError) {
    return <main className="standalone"><h1>pesabuana</h1><p>{loadError}</p></main>;
  }
  if (!state) {
    return <main className="standalone"><h1>pesabuana</h1><p>Loading.</p></main>;
  }
  if (state.blocked) {
    return (
      <main className="standalone">
        <h1>pesabuana</h1>
        <p>This account uses {state.blocked.name} and has records. pesabuana now keeps amounts in RMB and will not convert them.</p>
        <p>Nothing was changed. Say how you want this account handled before it is migrated.</p>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">pesabuana</div>
        <nav className="navigation" aria-label="Main">
          {PAGES.map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => { setPage(id); setDraft(null); }}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="local-note"><span className="local-dot" aria-hidden="true" />Stored on this computer</span>
      </header>
      <main>
        {state.notice ? <p className="banner">{state.notice}</p> : null}
        {page === 'overview' ? (
          <Overview
            state={state}
            today={today}
            onAddSale={() => openEntry('sale')}
            onAddExpense={() => openEntry('expense')}
            onOpenEntries={() => setPage('entries')}
            onOpenTargets={() => setPage('targets')}
            onSetRates={() => setPage('settings')}
            onEditTarget={editTarget}
          />
        ) : null}
        {page === 'entries' ? (
          <Entries
            state={state}
            commit={commit}
            today={today}
            onAddSale={() => openEntry('sale')}
            onAddExpense={() => openEntry('expense')}
            onEdit={editRow}
          />
        ) : null}
        {page === 'targets' ? (
          <Targets
            state={state}
            commit={commit}
            today={today}
            onSetRates={() => setPage('settings')}
            editingId={editingTargetId}
            onEdit={editTarget}
            onClearEdit={() => setEditingTargetId(null)}
          />
        ) : null}
        {page === 'settings' ? <Settings state={state} commit={commit} /> : null}
      </main>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      {draft ? (
        <EntryDialog
          kind={draft.kind}
          record={draft.record}
          currency={state.currency}
          today={today}
          commit={commit}
          onClose={() => setDraft(null)}
          onSaved={setToast}
        />
      ) : null}
    </div>
  );
}
