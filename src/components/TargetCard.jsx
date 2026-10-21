import { formatMoney } from '../../shared/money.cjs';
import { formatLongDate, formatRange } from '../../shared/dates.cjs';
import { formatTenthsPercent } from '../../shared/stats.cjs';
import { Equivalents } from './MoneyBlock.jsx';

export function TargetCard({ report, target, currency, rates }) {
  if (!report || report.overflow) {
    return <section className="target-card"><h2>{target.name}</h2><p>These totals are too large to show.</p></section>;
  }
  const percent = formatTenthsPercent(report.progressTenths);
  const bar = Math.max(0, Math.min(100, report.progressTenths / 10));
  const days = daysText(report);
  return (
    <section className="target-card">
      <div className="target-head">
        <h2>{target.name}</h2>
        <p className="meta">{formatRange(target.startDate, target.deadline)}</p>
      </div>
      <p className="target-status">{statusText(report)}</p>
      <div className="target-figures">
        <div>
          <div className="money-label">{report.metric === 'gross' ? 'Gross profit' : 'Net profit'}</div>
          <div className="money-value">{formatMoney(report.profit, currency)}</div>
          <Equivalents minor={report.profit} rates={rates} />
        </div>
        <div>
          <div className="money-label">Target amount</div>
          <div className="money-value">{formatMoney(report.targetAmount, currency)}</div>
          <Equivalents minor={report.targetAmount} rates={rates} showMissing />
        </div>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${bar}%` }} />
      </div>
      <p className="progress-text">Progress {percent}</p>
      <dl className="facts">
        <div><dt>Amount remaining</dt><dd>{formatMoney(report.remaining, currency)}</dd></div>
        <div><dt>Deadline</dt><dd>{formatLongDate(report.deadline)}</dd></div>
        <div><dt>Days left</dt><dd>{days}</dd></div>
        <div><dt>Needed per day</dt><dd>{report.dailyNeeded === null ? 'Ended' : formatMoney(report.dailyNeeded, currency)}</dd></div>
        {report.status === 'active' && report.estimate !== null ? (
          <div><dt>Estimate</dt><dd>{formatMoney(report.estimate, currency)}</dd></div>
        ) : null}
      </dl>
      {report.profit < 0 ? <p className="meta">This period is a loss.</p> : null}
      {report.status === 'active' ? <p className="meta">Estimate uses the average since the start date, including days with no entries.</p> : null}
      {report.status === 'not_started' ? <p className="meta">Estimate is available after the start date.</p> : null}
    </section>
  );
}

function statusText(report) {
  if (report.status === 'not_started') return 'Not started.';
  if (report.status === 'ended' && report.reached) return 'Deadline passed. Target reached.';
  if (report.status === 'ended') return 'Deadline passed. Target not reached.';
  if (report.reached) return 'Target reached.';
  return 'In progress.';
}

function daysText(report) {
  if (report.status === 'ended') return '0. Deadline passed.';
  if (report.status === 'not_started') {
    const wait = report.daysUntilStart === 1 ? '1 day' : `${report.daysUntilStart} days`;
    return `Starts in ${wait}.`;
  }
  const left = report.daysRemaining === 1 ? '1 day left' : `${report.daysRemaining} days left`;
  return `${left}. Includes today.`;
}
