import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Dialog } from './Dialog.jsx';

export function CategoryField({ categories, value, onChange, allowUncategorised, error, onCreate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const root = useRef(null);
  const selected = categories.find((item) => item.id === value) || null;
  const label = value === null && allowUncategorised
    ? 'Uncategorised'
    : selected
      ? `${selected.name}${selected.archived ? ' (archived)' : ''}`
      : 'Choose a category';
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const active = categories.filter((item) => !item.archived || item.id === value);
    return active.filter((item) => !needle || item.name.toLowerCase().includes(needle));
  }, [categories, query, value]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  function choose(next) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="field category-field" ref={root}>
      <span id={`${listId}-label`}>Category</span>
      <button
        type="button"
        className="category-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${listId}-error` : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected || value === null ? 'category-value' : 'category-placeholder'}>{label}</span>
      </button>
      {error ? <span id={`${listId}-error`} className="form-error" role="alert">{error}</span> : null}
      {open ? (
        <div className="category-menu">
          <input
            aria-label="Search categories"
            value={query}
            placeholder="Search categories"
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div role="listbox" id={listId} aria-label="Category">
            {allowUncategorised ? (
              <button type="button" role="option" aria-selected={value === null} className="category-option" onClick={() => choose(null)}>
                Uncategorised
              </button>
            ) : null}
            {options.map((item) => (
              <button
                type="button"
                role="option"
                key={item.id}
                aria-selected={item.id === value}
                className="category-option"
                title={item.name}
                onClick={() => choose(item.id)}
              >
                {item.name}{item.archived ? ' (archived)' : ''}
              </button>
            ))}
            {options.length === 0 ? <p className="subtitle">No matching categories.</p> : null}
          </div>
          <button type="button" className="category-add" onClick={() => { setOpen(false); onCreate(); }}>
            + Add category
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CategoryNameDialog({ title, initial, submitLabel, error, restoreName, onSubmit, onRestore, onCancel }) {
  const [name, setName] = useState(initial || '');

  function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    onSubmit(name);
  }

  return (
    <Dialog titleId="category-name-heading" onDismiss={onCancel}>
      <form onSubmit={submit}>
        <div className="dialog-header">
          <h2 id="category-name-heading">{title}</h2>
          <button type="button" className="close" onClick={onCancel} aria-label="Close">×</button>
        </div>
        <div className="dialog-body form-stack">
          <label className="field">
            Category name
            <input value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {restoreName ? (
            <p className="form-section-note">
              {restoreName} is archived.
              <span className="actions">
                <button type="button" className="button" onClick={onRestore}>Restore</button>
              </span>
            </p>
          ) : null}
        </div>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="button primary">{submitLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
