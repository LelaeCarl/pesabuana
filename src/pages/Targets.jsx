import { useState } from 'react';
import { parseMoney, minorToInput } from '../../shared/money.cjs';
import { endOfMonth } from '../../shared/dates.cjs';
import { evaluateTarget } from '../../shared/stats.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { TargetCard } from '../components/TargetCard.jsx';

export function Targets({ state, commit, today, onSetRates, editingId, onEdit, onClearEdit }) {
  const [pending, setPending] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const editing = state.targets.find((target) => target.id === editingId) || null;

  async function remove() {
    const id = pending;
    setPending(null);
    const result = await commit(await window.pesabuana.deleteTarget(id));
    if (result.error) setError(result.error);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Targets</h1>
          <p className="subtitle">Your profit, measured against a date.</p>
        </div>
        <button type="button" className="button primary" onClick={() => setAdding(true)}><span className="plus">+</span>Add target</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {state.targets.length === 0 ? <p className="subtitle">No targets yet.</p> : (
        <div className="targets-grid">
          {state.targets.map((target) => (
            <TargetCard
              key={target.id}
              expanded
              target={target}
              report={evaluateTarget(target, state.sales, state.expenses, today)}
              currency={state.currency}
              rates={state.rates}
              onSetRates={onSetRates}
              onEdit={() => onEdit(target.id)}
              onDelete={() => setPending(target.id)}
            />
          ))}
        </div>
      )}
      <p className="explanation">Each target uses its own dates. The same profit can count toward both targets. Estimates use the average since the start date, including days without entries. Targets do not spend money.</p>
      {adding ? (
        <TargetEditor
          currency={state.currency}
          today={today}
          commit={commit}
          onClose={() => setAdding(false)}
          onError={setError}
        />
      ) : null}
      {editing ? (
        <TargetEditor
          currency={state.currency}
          today={today}
          commit={commit}
          initial={editing}
          onClose={onClearEdit}
          onError={setError}
        />
      ) : null}
      {pending ? (
        <ConfirmDialog
          title="Delete target"
          message="Delete this target? Entries are kept."
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

function TargetEditor({ currency, today, commit, initial, onClose, onError }) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [metric, setMetric] = useState(initial ? initial.metric : 'net');
  const [amount, setAmount] = useState(initial ? minorToInput(initial.targetAmount, currency.exponent) : '');
  const [startDate, setStartDate] = useState(initial ? initial.startDate : today);
  const [deadline, setDeadline] = useState(initial ? initial.deadline : endOfMonth(today));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idPrefix = initial ? `edit-${initial.id}` : 'new-target';

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    if (!amount.trim()) {
      setError('Enter a target amount.');
      return;
    }
    const parsed = parseMoney(amount, currency.exponent);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    const payload = { name, metric, targetAmount: parsed.minor, startDate, deadline };
    const result = await commit(await (
      initial
        ? window.pesabuana.updateTarget({ ...payload, id: initial.id })
        : window.pesabuana.addTarget(payload)
    ));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      if (onError) onError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Dialog titleId="target-heading" onDismiss={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog-header">
          <h2 id="target-heading">{initial ? 'Edit target' : 'Add target'}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dialog-body form-stack">
          <label className="field" htmlFor={`${idPrefix}-name`}>
            Name
            <input id={`${idPrefix}-name`} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <div className="form-row">
            <label className="field" htmlFor={`${idPrefix}-metric`}>
              Profit to measure
              <select id={`${idPrefix}-metric`} value={metric} onChange={(event) => setMetric(event.target.value)}>
                <option value="net">Net profit</option>
                <option value="gross">Gross profit</option>
              </select>
            </label>
            <label className="field" htmlFor={`${idPrefix}-amount`}>
              Target amount
              <input id={`${idPrefix}-amount`} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label className="field" htmlFor={`${idPrefix}-start`}>
              Start date
              <input id={`${idPrefix}-start`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="field" htmlFor={`${idPrefix}-deadline`}>
              Deadline
              <input id={`${idPrefix}-deadline`} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
            </label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving' : 'Save changes'}</button>
        </div>
      </form>
    </Dialog>
  );
}
