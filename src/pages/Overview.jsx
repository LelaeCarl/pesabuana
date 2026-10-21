import { useState } from 'react';
import { formatMoney } from '../../shared/money.cjs';
import { formatLongDate, formatRange, presetRange } from '../../shared/dates.cjs';
import { summarize, rangeError, buildChart, evaluateTarget } from '../../shared/stats.cjs';
import { Equivalents, MoneyFigure } from '../components/MoneyBlock.jsx';
import { ProfitChart } from '../components/ProfitChart.jsx';
import { TargetCard } from '../components/TargetCard.jsx';

const FILTERS = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['custom', 'Custom'],
];

export function Overview({ state, today, onAddSale, onAddExpense, onOpenEntries, onOpenTargets, onSetRates, onEditTarget }) {
  const month = presetRange('month', today);
  const [preset, setPreset] = useState('month');
  const [customFrom, setCustomFrom] = useState(month.from);
  const [customTo, setCustomTo] = useState(month.to);
  const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset, today);
  const error = preset === 'custom' ? rangeError(range.from, range.to) : null;
  const summary = error ? null : summarize(state.sales, state.expenses, range.from, range.to);
  const through = range.to < today ? range.to : today;
  const series = error ? null : (through < range.from ? [] : buildChart(state.sales, state.expenses, range.from, through));
  const recent = recentRows(state, range.from, range.to);
  const presetLabel = FILTERS.find(([id]) => id === preset)[1];

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p className="subtitle">{periodLabel(range, presetLabel)}</p>
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={onAddExpense}>Add expense</button>
          <button type="button" className="button primary" onClick={onAddSale}><span className="plus">+</span>Add sale</button>
        </div>
      </div>
      <div className="overview-grid">
        <section className="profit-panel">
          <div className="profit-header">
            <div className="eyebrow">Net profit</div>
            <div className="period-controls" role="group" aria-label="Date filter">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={preset === id} onClick={() => setPreset(id)}>{label}</button>
              ))}
            </div>
          </div>
          {preset === 'custom' ? (
            <div className="custom-range">
              <label className="field">From<input aria-label="From" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
              <label className="field">To<input aria-label="To" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
            </div>
          ) : null}
          {error ? <p className="form-error panel-error" role="alert">{error}</p> : (
            <>
              <div className="profit-figure">
                {summary.overflow ? <p className="form-error">These totals are too large to show.</p> : (
                  <>
                    <MoneyFigure minor={summary.net} currency={state.currency} hero />
                    <Equivalents minor={summary.net} rates={state.rates} showMissing savedNote onSetRates={onSetRates} />
                  </>
                )}
              </div>
              {summary.overflow ? null : (
                <div className="metric-strip">
                  <Metric label="Sales" minor={summary.saleTotal} state={state} onSetRates={onSetRates} />
                  <Metric label="Direct costs" minor={summary.directCosts} state={state} onSetRates={onSetRates} />
                  <Metric label="Gross profit" minor={summary.gross} state={state} onSetRates={onSetRates} />
                  <Metric label="Other expenses" minor={summary.otherExpenses} state={state} onSetRates={onSetRates} />
                </div>
              )}
              {series ? (
                <ProfitChart
                  series={series}
                  currency={state.currency}
                  from={range.from}
                  to={range.to}
                  today={today}
                  onAddSale={onAddSale}
                  accountEmpty={state.sales.length === 0 && state.expenses.length === 0}
                />
              ) : null}
            </>
          )}
        </section>
        <aside>
          <div className="targets-heading">
            <h2 className="section-title">Targets</h2>
            <button type="button" className="link" onClick={onOpenTargets}>View all</button>
          </div>
          {state.targets.length === 0 ? <p className="subtitle">No targets yet.</p> : (
            <div className="goal-stack">
              {state.targets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  report={evaluateTarget(target, state.sales, state.expenses, today)}
                  currency={state.currency}
                  rates={state.rates}
                  onSetRates={onSetRates}
                  onEdit={() => onEditTarget(target.id)}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
      <section className="recent">
        <div className="section-heading">
          <h2 className="section-title">Recent entries</h2>
          <button type="button" className="link" onClick={() => onOpenEntries('entries')}>View entries</button>
        </div>
        <EntryTable rows={recent} currency={state.currency} empty={state.sales.length + state.expenses.length === 0} />
      </section>
      <p className="page-footer"><span>RMB is the source currency. USD and KSh are approximate equivalents.</span><span>pesabuana</span></p>
    </>
  );
}

function Metric({ label, minor, state, onSetRates }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <MoneyFigure minor={minor} currency={state.currency} />
      <div className="metric-conversion">
        <Equivalents minor={minor} rates={state.rates} showMissing onSetRates={onSetRates} />
      </div>
    </div>
  );
}

function periodLabel(range, presetLabel) {
  if (range.from === range.to) return `${formatLongDate(range.from)} · ${presetLabel}`;
  return `${formatRange(range.from, range.to)} · ${presetLabel}`;
}

function recentRows(state, from, to) {
  const sales = state.sales.filter((sale) => sale.entryDate >= from && sale.entryDate <= to).map((sale) => ({
    id: `sale-${sale.id}`,
    date: sale.entryDate,
    description: sale.description || 'No description',
    kind: 'sale',
    amount: sale.saleAmount,
    direct: sale.directCost,
    impact: sale.saleAmount - sale.directCost,
  }));
  const expenses = state.expenses.filter((expense) => expense.entryDate >= from && expense.entryDate <= to).map((expense) => ({
    id: `expense-${expense.id}`,
    date: expense.entryDate,
    description: expense.description || 'No description',
    kind: 'expense',
    amount: expense.amount,
    direct: null,
    impact: -expense.amount,
  }));
  return [...sales, ...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
}

export function EntryTable({ rows, currency, empty, onEdit, onDelete }) {
  if (rows.length === 0) {
    return (
      <div className="table-surface">
        <p className="table-empty">{empty ? 'No entries yet. Your saved sales and expenses will appear here.' : 'No entries in this period.'}</p>
      </div>
    );
  }
  return (
    <div className="table-surface">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th className="num">Amount (RMB)</th>
            <th className="num">Direct cost</th>
            <th className="num">Profit impact</th>
            {onEdit ? <th>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="entry-date">{formatShort(row.date)}</td>
              <td className="entry-description">{row.description}</td>
              <td><span className={row.kind === 'expense' ? 'entry-type expense' : 'entry-type'}>{row.kind === 'sale' ? 'Sale' : 'Expense'}</span></td>
              <td className="num">{formatAmount(row.amount, currency)}</td>
              <td className="num">{row.direct === null ? '—' : formatAmount(row.direct, currency)}</td>
              <td className="num">{formatAmount(row.impact, currency)}</td>
              {onEdit ? (
                <td>
                  <button type="button" className="row-action" onClick={() => onEdit(row)}>Edit</button>
                  {onDelete ? <button type="button" className="row-action" onClick={() => onDelete(row)}>Delete</button> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatShort(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]} ${year === new Date().getFullYear() ? '' : year}`.trim();
}

function formatAmount(minor, currency) {
  return formatMoney(minor, currency);
}
