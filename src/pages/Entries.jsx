import { useEffect, useState } from 'react';
import { parseMoney, minorToInput, formatMoney } from '../../shared/money.cjs';
import { formatLongDate, presetRange } from '../../shared/dates.cjs';
import { summarize } from '../../shared/stats.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function Entries({ state, commit, today, focus }) {
  const [pageError, setPageError] = useState('');
  const [pending, setPending] = useState(null);
  const week = presetRange('week', today);
  const month = presetRange('month', today);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(focus === 'expense' ? 'add-expense' : 'add-sale')?.scrollIntoView({ block: 'start' });
  }, [focus]);

  async function remove() {
    const current = pending;
    setPending(null);
    const result = current.kind === 'sale'
      ? await commit(await window.pesabuana.deleteSale(current.record.id))
      : await commit(await window.pesabuana.deleteExpense(current.record.id));
    if (result.error) setPageError(result.error);
  }

  return (
    <div className="sheet">
      <h1>Entries</h1>
      <p className="meta">A sale can be one order or a daily total. Direct costs are part of the sale. Other expenses are recorded separately.</p>
      {pageError ? <p className="form-error">{pageError}</p> : null}
      <table className="totals">
        <thead>
          <tr>
            <th>Period</th>
            <th>Sales</th>
            <th>Direct costs</th>
            <th>Gross profit</th>
            <th>Other expenses</th>
            <th>Net profit</th>
          </tr>
        </thead>
        <tbody>
          <TotalRow label={`This week, ${formatLongDate(week.from)} to ${formatLongDate(week.to)}`} summary={summarize(state.sales, state.expenses, week.from, week.to)} currency={state.currency} />
          <TotalRow label={`This month, ${formatLongDate(month.from)} to ${formatLongDate(month.to)}`} summary={summarize(state.sales, state.expenses, month.from, month.to)} currency={state.currency} />
        </tbody>
      </table>
      <div className="split">
        <SaleSection state={state} commit={commit} today={today} onError={setPageError} onDelete={(record) => setPending({ kind: 'sale', record })} />
        <ExpenseSection state={state} commit={commit} today={today} onError={setPageError} onDelete={(record) => setPending({ kind: 'expense', record })} />
      </div>
      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'sale' ? 'Delete sale' : 'Delete expense'}
          message={pending.kind === 'sale'
            ? `Delete the sale for ${nameOf(pending.record)}? This removes its sale amount and direct cost.`
            : `Delete the expense for ${nameOf(pending.record)}?`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

function TotalRow({ label, summary, currency }) {
  if (summary.overflow) {
    return <tr><td colSpan={6}>{label}: these totals are too large to show.</td></tr>;
  }
  return (
    <tr>
      <td>{label}</td>
      <td>{formatMoney(summary.saleTotal, currency)}</td>
      <td>{formatMoney(summary.directCosts, currency)}</td>
      <td>{formatMoney(summary.gross, currency)}</td>
      <td>{formatMoney(summary.otherExpenses, currency)}</td>
      <td>{formatMoney(summary.net, currency)}</td>
    </tr>
  );
}

function nameOf(record) {
  return record.description || formatLongDate(record.entryDate);
}

function SaleSection({ state, commit, today, onError, onDelete }) {
  const currency = state.currency;
  const [editingId, setEditingId] = useState(null);
  const [entryDate, setEntryDate] = useState(today);
  const [description, setDescription] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [directCost, setDirectCost] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset(nextDate = today) {
    setEditingId(null);
    setEntryDate(nextDate);
    setDescription('');
    setSaleAmount('');
    setDirectCost('');
    setError('');
  }

  function edit(sale) {
    setEditingId(sale.id);
    setEntryDate(sale.entryDate);
    setDescription(sale.description);
    setSaleAmount(minorToInput(sale.saleAmount, currency.exponent));
    setDirectCost(minorToInput(sale.directCost, currency.exponent));
    setError('');
    onError('');
    document.getElementById('add-sale')?.scrollIntoView({ block: 'start' });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!saleAmount.trim()) {
      setError('Enter a sale amount. Use 0 if there was no sale.');
      return;
    }
    if (!directCost.trim()) {
      setError('Enter a direct cost. Use 0 if there was no direct cost.');
      return;
    }
    const sale = parseMoney(saleAmount, currency.exponent);
    if (!sale.ok) {
      setError(`Sale amount: ${sale.error}`);
      return;
    }
    const cost = parseMoney(directCost, currency.exponent);
    if (!cost.ok) {
      setError(`Direct cost: ${cost.error}`);
      return;
    }
    setBusy(true);
    const payload = { entryDate, description, saleAmount: sale.minor, directCost: cost.minor };
    const result = await commit(await (
      editingId
        ? window.pesabuana.updateSale({ ...payload, id: editingId })
        : window.pesabuana.addSale(payload)
    ));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    reset(today);
  }

  return (
    <section id="add-sale">
      <h2>{editingId ? 'Edit sale' : 'Add sale'}</h2>
      <p className="meta">Direct cost is subtracted only from gross profit.</p>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sale-date">Date</label>
            <input id="sale-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
          </div>
          <div className="field wide">
            <label htmlFor="sale-description">Description</label>
            <input id="sale-description" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sale-amount">Sale amount</label>
            <input id="sale-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="direct-cost">Direct cost</label>
            <input id="direct-cost" inputMode="decimal" autoComplete="off" placeholder="0.00" value={directCost} onChange={(event) => setDirectCost(event.target.value)} />
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>{editingId ? 'Save changes' : 'Add sale'}</button>
          {editingId ? <button type="button" onClick={() => reset(today)} disabled={busy}>Cancel</button> : null}
        </div>
      </form>
      {state.sales.length === 0 ? <p className="meta">No sales yet.</p> : state.sales.map((sale) => (
        <article className="record" key={sale.id}>
          <div>
            <p className="record-date">{formatLongDate(sale.entryDate)}</p>
            <p className="record-title">{sale.description || 'No description'}</p>
          </div>
          <div className="record-money">
            <span>Sale {formatMoney(sale.saleAmount, currency)}</span>
            <span>Direct cost {formatMoney(sale.directCost, currency)}</span>
            <span>Gross {formatMoney(sale.saleAmount - sale.directCost, currency)}</span>
          </div>
          <div className="record-actions">
            <button type="button" onClick={() => edit(sale)}>Edit</button>
            <button type="button" className="danger" onClick={() => onDelete(sale)}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );
}

function ExpenseSection({ state, commit, today, onError, onDelete }) {
  const currency = state.currency;
  const [editingId, setEditingId] = useState(null);
  const [entryDate, setEntryDate] = useState(today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setEditingId(null);
    setEntryDate(today);
    setDescription('');
    setAmount('');
    setError('');
  }

  function edit(expense) {
    setEditingId(expense.id);
    setEntryDate(expense.entryDate);
    setDescription(expense.description);
    setAmount(minorToInput(expense.amount, currency.exponent));
    setError('');
    onError('');
    document.getElementById('add-expense')?.scrollIntoView({ block: 'start' });
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!amount.trim()) {
      setError('Enter an expense amount.');
      return;
    }
    const parsed = parseMoney(amount, currency.exponent);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.minor === 0) {
      setError('Enter an expense amount above zero.');
      return;
    }
    setBusy(true);
    const payload = { entryDate, description, amount: parsed.minor };
    const result = await commit(await (
      editingId
        ? window.pesabuana.updateExpense({ ...payload, id: editingId })
        : window.pesabuana.addExpense(payload)
    ));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    reset();
  }

  return (
    <section id="add-expense">
      <h2>{editingId ? 'Edit expense' : 'Add expense'}</h2>
      <p className="meta">Other expenses are subtracted only from net profit.</p>
      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="expense-date">Date</label>
            <input id="expense-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required />
          </div>
          <div className="field wide">
            <label htmlFor="expense-description">Description</label>
            <input id="expense-description" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="expense-amount">Amount</label>
            <input id="expense-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>{editingId ? 'Save changes' : 'Add expense'}</button>
          {editingId ? <button type="button" onClick={reset} disabled={busy}>Cancel</button> : null}
        </div>
      </form>
      {state.expenses.length === 0 ? <p className="meta">No expenses yet.</p> : state.expenses.map((expense) => (
        <article className="record" key={expense.id}>
          <div>
            <p className="record-date">{formatLongDate(expense.entryDate)}</p>
            <p className="record-title">{expense.description || 'No description'}</p>
          </div>
          <div className="record-money">
            <span>Amount {formatMoney(expense.amount, currency)}</span>
          </div>
          <div className="record-actions">
            <button type="button" onClick={() => edit(expense)}>Edit</button>
            <button type="button" className="danger" onClick={() => onDelete(expense)}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );
}
