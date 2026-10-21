import { useState } from 'react';
import { formatMoney } from '../../shared/money.cjs';
import { formatLongDate, presetRange } from '../../shared/dates.cjs';
import { summarize } from '../../shared/stats.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { MoneyFigure } from '../components/MoneyBlock.jsx';
import { EntryTable } from './Overview.jsx';

export function Entries({ state, commit, today, onAddSale, onAddExpense, onEdit }) {
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState(null);
  const [pageError, setPageError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const week = presetRange('week', today);
  const month = presetRange('month', today);
  const rows = allRows(state).filter((row) => filter === 'all' || row.kind === filter);
  const totals = summarize(state.sales, state.expenses, '1990-01-01', '2100-12-31');

  async function remove() {
    const current = pending;
    setPending(null);
    const result = current.kind === 'sale'
      ? await commit(await window.pesabuana.deleteSale(current.recordId))
      : await commit(await window.pesabuana.deleteExpense(current.recordId));
    if (result.error) setPageError(result.error);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Entries</h1>
          <p className="subtitle">Sales and expenses, in one place.</p>
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={onAddExpense}>Add expense</button>
          <button type="button" className="button primary" onClick={onAddSale}><span className="plus">+</span>Add sale</button>
        </div>
      </div>
      {pageError ? <p className="form-error" role="alert">{pageError}</p> : null}
      <div className="entries-summary">
        <div>
          <div className="metric-label">Sales</div>
          <MoneyFigure minor={totals.overflow ? null : totals.saleTotal} currency={state.currency} />
        </div>
        <div>
          <div className="metric-label">Direct costs</div>
          <MoneyFigure minor={totals.overflow ? null : totals.directCosts} currency={state.currency} />
        </div>
        <div>
          <div className="metric-label">Net profit</div>
          <MoneyFigure minor={totals.overflow ? null : totals.net} currency={state.currency} />
        </div>
      </div>
      <div className="entries-toolbar">
        <div className="filter-tabs" role="group" aria-label="Entry type">
          {[['all', 'All entries'], ['sale', 'Sales'], ['expense', 'Expenses']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <span className="subtitle">{rows.length ? `${formatLongDate(rows[rows.length - 1].date)} – ${formatLongDate(rows[0].date)} · RMB` : 'RMB'}</span>
      </div>
      <EntryTable
        rows={rows}
        currency={state.currency}
        empty={state.sales.length + state.expenses.length === 0}
        onEdit={(row) => onEdit(row)}
        onDelete={(row) => setPending(row)}
      />
      <p className="explanation">Enter each sale once. Include its direct cost with the sale, and record other business expenses separately. A sale's profit impact is its gross profit. Other expenses reduce net profit on their own.</p>
      <section className="period-summary">
        <button type="button" className="link" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((open) => !open)}>
          {summaryOpen ? 'Hide week and month' : 'Week and month'}
        </button>
        {summaryOpen ? (
          <div className="table-surface">
            <table className="totals">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="num">Sales</th>
                  <th className="num">Direct costs</th>
                  <th className="num">Gross profit</th>
                  <th className="num">Other expenses</th>
                  <th className="num">Net profit</th>
                </tr>
              </thead>
              <tbody>
                <TotalRow label={`This week, ${formatLongDate(week.from)} to ${formatLongDate(week.to)}`} summary={summarize(state.sales, state.expenses, week.from, week.to)} currency={state.currency} />
                <TotalRow label={`This month, ${formatLongDate(month.from)} to ${formatLongDate(month.to)}`} summary={summarize(state.sales, state.expenses, month.from, month.to)} currency={state.currency} />
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'sale' ? 'Delete sale' : 'Delete expense'}
          message={pending.kind === 'sale'
            ? `Delete the sale for ${pending.description}? This removes its sale amount and direct cost.`
            : `Delete the expense for ${pending.description}?`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

function TotalRow({ label, summary, currency }) {
  if (summary.overflow) return <tr><td colSpan={6}>{label}: these totals are too large to show.</td></tr>;
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{formatMoney(summary.saleTotal, currency)}</td>
      <td className="num">{formatMoney(summary.directCosts, currency)}</td>
      <td className="num">{formatMoney(summary.gross, currency)}</td>
      <td className="num">{formatMoney(summary.otherExpenses, currency)}</td>
      <td className="num">{formatMoney(summary.net, currency)}</td>
    </tr>
  );
}

function allRows(state) {
  const sales = state.sales.map((sale) => ({
    id: `sale-${sale.id}`,
    recordId: sale.id,
    date: sale.entryDate,
    description: sale.description || 'No description',
    kind: 'sale',
    amount: sale.saleAmount,
    direct: sale.directCost,
    impact: sale.saleAmount - sale.directCost,
    record: sale,
  }));
  const expenses = state.expenses.map((expense) => ({
    id: `expense-${expense.id}`,
    recordId: expense.id,
    date: expense.entryDate,
    description: expense.description || 'No description',
    kind: 'expense',
    amount: expense.amount,
    direct: null,
    impact: -expense.amount,
    record: expense,
  }));
  return [...sales, ...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
