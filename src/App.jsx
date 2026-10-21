import { useEffect, useState } from 'react';
import { todayISO } from '../shared/dates.cjs';
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
  const [focus, setFocus] = useState('');
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
        setFocus('');
        return;
      }
      if (action === 'backup' || action === 'restore') setPage('settings');
    });
    return () => {
      active = false;
      if (stop) stop();
    };
  }, []);

  function commit(result) {
    if (!result) return { error: 'Something went wrong.' };
    if (result.state) setState(result.state);
    return result;
  }

  function openEntries(which) {
    setPage('entries');
    setFocus(which);
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
        <div className="brand">pesabuana</div>
        <nav aria-label="Main">
          {PAGES.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={page === id ? 'nav-btn active' : 'nav-btn'}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => { setPage(id); setFocus(''); }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {state.notice ? <p className="banner sheet">{state.notice}</p> : null}
        {page === 'overview' ? (
          <Overview
            state={state}
            today={today}
            onAddSale={() => openEntries('sale')}
            onAddExpense={() => openEntries('expense')}
          />
        ) : null}
        {page === 'entries' ? <Entries state={state} commit={commit} today={today} focus={focus} /> : null}
        {page === 'targets' ? <Targets state={state} commit={commit} today={today} /> : null}
        {page === 'settings' ? <Settings state={state} commit={commit} /> : null}
      </main>
    </div>
  );
}
