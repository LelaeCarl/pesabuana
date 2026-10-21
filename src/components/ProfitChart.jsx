import { useMemo, useState } from 'react';
import { formatMoney } from '../../shared/money.cjs';
import { formatDayMonth, formatLongDate } from '../../shared/dates.cjs';

export function ProfitChart({ series, currency, from, to, today, onAddSale, accountEmpty = false }) {
  const [hover, setHover] = useState(null);
  const model = useMemo(() => buildModel(series, today), [series, today]);

  if (!series) return <p className="form-error">These totals are too large to chart.</p>;

  const width = 640;
  const height = 226;
  const left = 44;
  const right = 8;
  const top = 12;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const { points, minYuan, maxYuan, empty } = model;
  const span = maxYuan - minYuan || 1;
  const yFor = (yuan) => top + ((maxYuan - yuan) / span) * plotHeight;
  const xFor = (index) => (
    points.length <= 1 ? left + plotWidth / 2 : left + (plotWidth * index) / (points.length - 1)
  );
  const zeroY = yFor(0);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((step) => minYuan + span * step);
  const netPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.netYuan)}`).join(' ');
  const grossPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.grossYuan)}`).join(' ');
  const area = points.length
    ? `${netPath} L ${xFor(points.length - 1)} ${zeroY} L ${xFor(0)} ${zeroY} Z`
    : '';
  const labelIndexes = axisIndexes(points.length);

  function move(event) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(xFor(index) - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  }

  const active = hover === null ? null : points[hover];

  return (
    <div className="chart-block">
      <div className="chart-header">
        <h2 className="section-title">Profit over time</h2>
        <div className="legend">
          <span><i className="swatch gross" />Gross profit</span>
          <span><i className="swatch" />Net profit</span>
        </div>
      </div>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Cumulative profit in RMB from ${formatLongDate(from)} to ${formatLongDate(to)}`}
          onMouseMove={move}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} y1={yFor(tick)} x2={width - right} y2={yFor(tick)} className="chart-grid" />
              <text x={left - 8} y={yFor(tick) + 4} textAnchor="end" className="chart-label">{axisLabel(tick)}</text>
            </g>
          ))}
          {points.length > 0 && !empty ? (
            <>
              <path d={area} className="chart-area" />
              <path d={grossPath} className="chart-gross" />
              <path d={netPath} className="chart-net" />
              {active ? (
                <circle cx={xFor(hover)} cy={yFor(active.netYuan)} r="3.5" className="chart-dot" />
              ) : null}
            </>
          ) : null}
          {labelIndexes.map((index) => (
            <text key={points[index].date} x={xFor(index)} y={height - 8} textAnchor="middle" className="chart-label">
              {formatDayMonth(points[index].date)}
            </text>
          ))}
        </svg>
        {empty ? (
          <div className="chart-empty">
            <strong>{accountEmpty ? 'Your first sale starts the chart.' : 'No entries in this period.'}</strong>
            <p>{accountEmpty ? 'Record a sale and its direct cost.' : 'Choose another period, or add an entry dated in this one.'}</p>
            {accountEmpty && onAddSale ? <button type="button" className="button primary" onClick={onAddSale}><span className="plus">+</span>Add sale</button> : null}
          </div>
        ) : null}
        {active ? (
          <div className="chart-tip" style={{ left: `${Math.min(78, (xFor(hover) / width) * 100)}%` }}>
            <div>{formatLongDate(active.date)}</div>
            <div>Gross {formatMoney(active.gross, currency)}</div>
            <div>Net {formatMoney(active.net, currency)}</div>
          </div>
        ) : null}
      </div>
      <div className="chart-caption">
        <span>Cumulative profit · RMB</span>
        <span>{formatDayMonth(from)} – {formatDayMonth(to)}</span>
      </div>
    </div>
  );
}

function buildModel(series, today) {
  const points = [];
  let gross = 0;
  let net = 0;
  let any = false;
  for (const item of series) {
    if (item.from > today) break;
    gross += item.gross;
    net += item.net;
    if (item.gross !== 0 || item.net !== 0) any = true;
    points.push({
      date: item.to > today ? today : item.to,
      gross,
      net,
      grossYuan: gross / 100,
      netYuan: net / 100,
    });
  }
  const peak = points.reduce((max, point) => Math.max(max, point.grossYuan, point.netYuan), 0);
  const floor = points.reduce((min, point) => Math.min(min, point.grossYuan, point.netYuan), 0);
  const empty = !any;
  const maxYuan = empty ? 100000 : niceMax(Math.max(peak, 1));
  const minYuan = floor < 0 ? -niceMax(Math.abs(floor)) : 0;
  return { points, minYuan, maxYuan, empty };
}

function niceMax(yuan) {
  if (yuan <= 1000) return 1000;
  const pow = 10 ** Math.floor(Math.log10(yuan));
  const n = yuan / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function axisLabel(yuan) {
  const rounded = Math.round(yuan);
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 1000)}k`;
  return String(rounded);
}

function axisIndexes(length) {
  if (length <= 1) return length === 1 ? [0] : [];
  if (length === 2) return [0, 1];
  return [0, Math.floor((length - 1) / 2), length - 1];
}
