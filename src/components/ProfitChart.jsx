import { formatMoney } from '../../shared/money.cjs';
import { formatDayMonth } from '../../shared/dates.cjs';

export function ProfitChart({ series, currency, label }) {
  if (!series) return <p className="empty">These totals are too large to chart.</p>;
  const hasValue = series.some((item) => item.gross !== 0 || item.net !== 0);
  if (!hasValue) return <p className="empty">No profit to chart in this period.</p>;

  const width = 860;
  const height = 280;
  const left = 168;
  const right = 16;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = series.flatMap((item) => [item.gross, item.net]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min;
  const yFor = (value) => top + ((max - value) / span) * plotHeight;
  const zeroY = yFor(0);
  const slot = plotWidth / series.length;
  const barWidth = series.length === 1 ? 42 : Math.max(3, Math.min(12, slot * 0.28));
  const labelStep = Math.max(1, Math.ceil(series.length / 6));
  const yLabels = [];
  if (max !== 0) yLabels.push(max);
  yLabels.push(0);
  if (min !== 0) yLabels.push(min);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {yLabels.map((value, index) => (
          <text
            key={`${value}-${index}`}
            x={left - 12}
            y={yFor(value) + 4}
            textAnchor="end"
            className="chart-label"
          >
            {formatMoney(value, currency)}
          </text>
        ))}
        <line x1={left} y1={zeroY} x2={width - right} y2={zeroY} className="chart-zero" />
        {series.map((item, index) => {
          const center = left + slot * index + slot / 2;
          const grossX = series.length === 1 ? center - barWidth - 10 : center - barWidth - 1;
          const netX = series.length === 1 ? center + 10 : center + 1;
          const showDate = series.length > 1 && (index % labelStep === 0 || index === series.length - 1);
          return (
            <g key={`${item.from}-${item.to}`}>
              <Bar
                x={grossX}
                value={item.gross}
                yFor={yFor}
                zeroY={zeroY}
                width={barWidth}
                className="bar-gross"
                label={`Gross profit ${formatMoney(item.gross, currency)}`}
              />
              <Bar
                x={netX}
                value={item.net}
                yFor={yFor}
                zeroY={zeroY}
                width={barWidth}
                className="bar-net"
                label={`Net profit ${formatMoney(item.net, currency)}`}
              />
              {showDate ? (
                <text x={center} y={height - 14} textAnchor="middle" className="chart-label">
                  {formatDayMonth(item.from)}
                </text>
              ) : null}
              {series.length === 1 ? (
                <>
                  <text x={grossX + barWidth / 2} y={height - 14} textAnchor="middle" className="chart-label">Gross</text>
                  <text x={netX + barWidth / 2} y={height - 14} textAnchor="middle" className="chart-label">Net</text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ul className="legend">
        <li><span className="swatch gross" />Gross profit</li>
        <li><span className="swatch net" />Net profit</li>
      </ul>
    </div>
  );
}

function Bar({ x, value, yFor, zeroY, width, className, label }) {
  if (value === 0) return null;
  const y = yFor(value);
  const top = Math.min(y, zeroY);
  const height = Math.max(1, Math.abs(zeroY - y));
  return (
    <rect x={x} y={top} width={width} height={height} className={className}>
      <title>{label}</title>
    </rect>
  );
}
