import { useState } from 'react';
import { formatMoney } from '../../shared/money.cjs';
import { formatLongDate, formatRange } from '../../shared/dates.cjs';
import { formatTenthsPercent } from '../../shared/stats.cjs';
import { Dialog } from './Dialog.jsx';
import { Equivalents, MoneyFigure } from './MoneyBlock.jsx';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function TargetCard({ report, target, currency, rates, expanded = false, onSetRates, onEdit, onDelete }) {
  const [details, setDetails] = useState(false);
  if (!report || report.overflow) {
    return <article className="goal"><h3>{target.name}</h3><p>These totals are too large to show.</p></article>;
  }
  const tile = deadlineTile(target.deadline);
  const percent = formatTenthsPercent(report.progressTenths);
  const bar = Math.max(0, Math.min(100, report.progressTenths / 10));
  const metric = report.metric === 'gross' ? 'Gross profit' : 'Net profit';
  return (
    <article className="goal">
      <div className="goal-top">
        <div className="date-tile" aria-label={`Deadline ${formatLongDate(target.deadline)}`}>
          <span className="month">{tile.month}</span>
          <span className="day">{tile.day}</span>
        </div>
        <div>
          <h3>{target.name}</h3>
          <p className="goal-kind">{metric} target · {tile.year}</p>
        </div>
      </div>
      <div className="goal-amount">
        <MoneyFigure minor={report.targetAmount} currency={currency} />
        <small>target</small>
      </div>
      <Equivalents minor={report.targetAmount} rates={rates} showMissing onSetRates={onSetRates} />
      <div className="goal-progress-meta">
        <span>{formatMoney(report.profit, currency)} earned</span>
        <strong>{percent}</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${bar}%` }} />
      </div>
      <div className="goal-footer">
        <div>
          Remaining
          <strong className={report.profit < 0 ? 'negative' : ''}>{formatMoney(report.remaining, currency)}</strong>
        </div>
        <div>
          Needed per day
          <strong>{neededText(report, currency)}</strong>
        </div>
      </div>
      {expanded ? <ExpandedFacts report={report} currency={currency} target={target} /> : (
        <button type="button" className="goal-more" onClick={() => setDetails(true)}>
          <span>{daysLine(report)}</span>
          <span>Details</span>
        </button>
      )}
      {expanded ? (
        <div className="goal-actions">
          <button type="button" className="link" onClick={onEdit}>Edit target</button>
          <button type="button" className="link danger-link" onClick={onDelete}>Delete target</button>
        </div>
      ) : null}
      {details ? (
        <TargetDetails
          report={report}
          target={target}
          currency={currency}
          rates={rates}
          onSetRates={onSetRates}
          onClose={() => setDetails(false)}
          onEdit={onEdit}
        />
      ) : null}
    </article>
  );
}

function ExpandedFacts({ report, currency, target }) {
  return (
    <>
      <div className="goal-extra">
        <div>
          Days left
          <strong>{daysValue(report)}</strong>
        </div>
        <div>
          Estimate at deadline
          <strong>{estimateText(report, currency)}</strong>
        </div>
      </div>
      <p className="target-period">{formatRange(target.startDate, target.deadline)} · {daysNote(report)}</p>
      {report.profit < 0 ? <p className="target-period">This period is a loss.</p> : null}
      <p className="target-period">{statusText(report)}</p>
    </>
  );
}

function TargetDetails({ report, target, currency, rates, onSetRates, onClose, onEdit }) {
  const metric = report.metric === 'gross' ? 'Gross profit' : 'Net profit';
  return (
    <Dialog titleId="details-heading" onDismiss={onClose}>
      <div className="dialog-header">
        <h2 id="details-heading">{target.name}</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="dialog-body">
        <dl className="details-list">
          <dt>Profit to measure</dt><dd>{metric}</dd>
          <dt>Start date</dt><dd>{formatLongDate(target.startDate)}</dd>
          <dt>Deadline</dt><dd>{formatLongDate(target.deadline)}</dd>
          <dt>Earned</dt><dd>{formatMoney(report.profit, currency)}</dd>
          <dt>Target</dt><dd>{formatMoney(report.targetAmount, currency)}</dd>
          <dt>Progress</dt><dd>{formatTenthsPercent(report.progressTenths)}</dd>
          <dt>Amount remaining</dt><dd>{formatMoney(report.remaining, currency)}</dd>
          <dt>Days left</dt><dd>{daysValue(report)}. {daysNote(report)}</dd>
          <dt>Needed per day</dt><dd>{neededText(report, currency)}</dd>
          <dt>Estimate</dt><dd>{estimateText(report, currency)}</dd>
        </dl>
        <Equivalents minor={report.targetAmount} rates={rates} showMissing onSetRates={onSetRates} />
        <p className="details-note">{statusText(report)} {estimateNote(report)}</p>
      </div>
      <div className="dialog-footer">
        <button type="button" className="button" onClick={onClose}>Close</button>
        {onEdit ? <button type="button" className="button primary" onClick={() => { onClose(); onEdit(); }}>Edit target</button> : null}
      </div>
    </Dialog>
  );
}

function deadlineTile(iso) {
  const [year, month, day] = iso.split('-');
  return { month: MONTHS[Number(month) - 1], day, year };
}

function statusText(report) {
  if (report.status === 'not_started') return 'Not started.';
  if (report.status === 'ended' && report.reached) return 'Deadline passed. Target reached.';
  if (report.status === 'ended') return 'Deadline passed. Target not reached.';
  if (report.reached) return 'Target reached.';
  return 'In progress.';
}

function daysValue(report) {
  if (report.status === 'ended') return '0';
  if (report.status === 'not_started') return String(report.daysUntilStart);
  return String(report.daysRemaining);
}

function daysNote(report) {
  if (report.status === 'ended') return 'Deadline passed.';
  if (report.status === 'not_started') return 'Days until the start date.';
  return 'Days left includes today.';
}

function daysLine(report) {
  if (report.status === 'ended') return '0 days left';
  if (report.status === 'not_started') {
    const wait = report.daysUntilStart === 1 ? '1 day' : `${report.daysUntilStart} days`;
    return `Starts in ${wait}`;
  }
  const left = report.daysRemaining === 1 ? '1 day left' : `${report.daysRemaining} days left`;
  return `${left} · Includes today`;
}

function neededText(report, currency) {
  if (report.dailyNeeded === null) return 'Ended';
  return formatMoney(report.dailyNeeded, currency);
}

function estimateText(report, currency) {
  if (report.status === 'not_started') return 'After the start date';
  if (report.status === 'ended' || report.estimate === null) return 'Final';
  return formatMoney(report.estimate, currency);
}

function estimateNote(report) {
  if (report.status === 'active') return 'The estimate uses the average since the start date, including days with no entries.';
  if (report.status === 'not_started') return 'An estimate is available after the start date.';
  return 'The result stops at the deadline.';
}
