import { useState } from 'react';
import { formatRange, presetRange, endOfMonth } from '../../shared/dates.cjs';
import { summarize, rangeError, buildChart, evaluateTarget } from '../../shared/stats.cjs';
import { MoneyBlock } from '../components/MoneyBlock.jsx';
import { ProfitChart } from '../components/ProfitChart.jsx';
import { TargetCard } from '../components/TargetCard.jsx';

export function Overview({ state, today, onAddSale, onAddExpense }) {
  const month = presetRange('month', today);
  const [preset, setPreset] = useState('month');
  const [customFrom, setCustomFrom] = useState(month.from);
  const [customTo, setCustomTo] = useState(month.to);
  const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset, today);
  const error = preset === 'custom' ? rangeError(range.from, range.to) : null;
  const summary = error ? null : summarize(state.sales, state.expenses, range.from, range.to);
  const series = error ? null : buildChart(state.sales, state.expenses, range.from, range.to);
  const empty = summary && summary.saleCount === 0 && summary.expenseCount === 0;

  return (
    <div className="sheet">
      <h1>Overview</h1>
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Date filter">
          {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['custom', 'Custom']].map(([id, label]) => (
            <button key={id} type="button" className={preset === id ? 'active' : ''} onClick={() => setPreset(id)}>{label}</button>
          ))}
          {preset === 'custom' ? (
            <div className="custom-range">
              <input aria-label="From" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              <span>to</span>
              <input aria-label="To" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          ) : null}
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={onAddSale}>Add sale</button>
          <button type="button" onClick={onAddExpense}>Add expense</button>
        </div>
      </div>
      <p className="meta">{error || formatRange(range.from, range.to || endOfMonth(today))}</p>
      {error ? null : (
        <>
          {summary.overflow ? <p className="form-error">These totals are too large to show.</p> : (
            <>
              <MoneyBlock label="Net profit" minor={summary.net} currency={state.currency} rates={state.rates} primary />
              <div className="figure-row">
                <MoneyBlock label="Sales" minor={summary.saleTotal} currency={state.currency} rates={state.rates} />
                <MoneyBlock label="Direct costs" minor={summary.directCosts} currency={state.currency} rates={state.rates} />
                <MoneyBlock label="Gross profit" minor={summary.gross} currency={state.currency} rates={state.rates} />
                <MoneyBlock label="Other expenses" minor={summary.otherExpenses} currency={state.currency} rates={state.rates} />
              </div>
            </>
          )}
          {empty ? <p className="section">No entries in this period.</p> : (
            <section className="section">
              <h2>Gross and net profit</h2>
              <ProfitChart series={series} currency={state.currency} label="Gross and net profit" />
            </section>
          )}
        </>
      )}
      <section className="section">
        <h2>Targets</h2>
        {state.targets.length === 0 ? <p>No targets yet.</p> : (
          <div className="target-list">
            {state.targets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                report={evaluateTarget(target, state.sales, state.expenses, today)}
                currency={state.currency}
                rates={state.rates}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
