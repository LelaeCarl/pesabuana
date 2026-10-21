import { useState } from 'react';
import { parseMoney, minorToInput } from '../../shared/money.cjs';
import { endOfMonth } from '../../shared/dates.cjs';
import { evaluateTarget } from '../../shared/stats.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { TargetCard } from '../components/TargetCard.jsx';

export function Targets({ state, commit, today }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  async function remove() {
    const id = pending;
    setPending(null);
    const result = await commit(await window.pesabuana.deleteTarget(id));
    if (result.error) setError(result.error);
  }

  return (
    <div className="sheet">
      <h1>Targets</h1>
      <p className="meta">Each target uses its own dates. The same profit can count toward more than one target. Targets do not spend money.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {state.targets.length === 0 ? <p>No targets yet.</p> : state.targets.map((target) => (
        <div className="section" key={target.id}>
          <TargetCard
            target={target}
            report={evaluateTarget(target, state.sales, state.expenses, today)}
            currency={state.currency}
            rates={state.rates}
          />
          <EditTarget target={target} currency={state.currency} commit={commit} onError={setError} onDelete={() => setPending(target.id)} />
        </div>
      ))}
      <section className="section">
        <h2>Add target</h2>
        <TargetForm currency={state.currency} today={today} commit={commit} />
      </section>
      {pending ? (
        <ConfirmDialog
          title="Delete target"
          message="Delete this target? Entries are kept."
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

function EditTarget({ target, currency, commit, onError, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <div className="actions">
        <button type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Cancel' : 'Edit'}</button>
        <button type="button" className="danger" onClick={onDelete}>Delete</button>
      </div>
      {open ? (
        <TargetForm
          currency={currency}
          today={target.startDate}
          commit={commit}
          initial={target}
          onDone={() => setOpen(false)}
          onError={onError}
        />
      ) : null}
    </div>
  );
}

function TargetForm({ currency, today, commit, initial, onDone, onError }) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [metric, setMetric] = useState(initial ? initial.metric : 'net');
  const [amount, setAmount] = useState(initial ? minorToInput(initial.targetAmount, currency.exponent) : '');
  const [startDate, setStartDate] = useState(initial ? initial.startDate : today);
  const [deadline, setDeadline] = useState(initial ? initial.deadline : endOfMonth(today));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
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
    setError('');
    if (!initial) {
      setName('');
      setAmount('');
    }
    if (onDone) onDone();
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor={initial ? `name-${initial.id}` : 'target-name'}>Name</label>
          <input id={initial ? `name-${initial.id}` : 'target-name'} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={initial ? `metric-${initial.id}` : 'target-metric'}>Profit to measure</label>
          <select id={initial ? `metric-${initial.id}` : 'target-metric'} value={metric} onChange={(event) => setMetric(event.target.value)}>
            <option value="net">Net profit</option>
            <option value="gross">Gross profit</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={initial ? `amount-${initial.id}` : 'target-amount'}>Target amount</label>
          <input id={initial ? `amount-${initial.id}` : 'target-amount'} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={initial ? `start-${initial.id}` : 'target-start'}>Start date</label>
          <input id={initial ? `start-${initial.id}` : 'target-start'} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor={initial ? `deadline-${initial.id}` : 'target-deadline'}>Deadline</label>
          <input id={initial ? `deadline-${initial.id}` : 'target-deadline'} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>{initial ? 'Save changes' : 'Add target'}</button>
        {initial ? <button type="button" onClick={onDone}>Cancel</button> : null}
      </div>
    </form>
  );
}
