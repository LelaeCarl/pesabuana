const {
  addDays,
  daysBetweenInclusive,
  startOfWeek,
  isRealDate,
} = require('./dates.cjs');
const { divRound, divCeil } = require('./money.cjs');

const MAX_RANGE_DAYS = 3660;

// Direct costs stay on the sale. Other expenses stay in their own list.
// Gross profit subtracts direct costs once. Net profit then subtracts other expenses once.
function addExact(total, amount, state) {
  const next = total + amount;
  if (!Number.isSafeInteger(next)) {
    state.overflow = true;
    return total;
  }
  return next;
}

function summarize(sales, expenses, from, to) {
  const state = { overflow: false };
  let saleTotal = 0;
  let directCosts = 0;
  let saleCount = 0;
  for (const sale of sales) {
    if (sale.entryDate < from || sale.entryDate > to) continue;
    saleTotal = addExact(saleTotal, sale.saleAmount, state);
    directCosts = addExact(directCosts, sale.directCost, state);
    saleCount += 1;
  }
  let otherExpenses = 0;
  let expenseCount = 0;
  for (const expense of expenses) {
    if (expense.entryDate < from || expense.entryDate > to) continue;
    otherExpenses = addExact(otherExpenses, expense.amount, state);
    expenseCount += 1;
  }
  const gross = saleTotal - directCosts;
  const net = gross - otherExpenses;
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(net)) state.overflow = true;
  return {
    saleTotal,
    directCosts,
    otherExpenses,
    gross: state.overflow ? null : gross,
    net: state.overflow ? null : net,
    saleCount,
    expenseCount,
    overflow: state.overflow,
  };
}

function rangeError(from, to) {
  if (!isRealDate(from) || !isRealDate(to)) return 'Enter a valid date.';
  if (from > to) return 'Start date must be on or before the end date.';
  if (daysBetweenInclusive(from, to) > MAX_RANGE_DAYS) return 'Choose a period of 10 years or less.';
  return null;
}

function eachDate(from, to) {
  const dates = [];
  let cursor = from;
  const total = daysBetweenInclusive(from, to);
  for (let i = 0; i < total; i += 1) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function buildChart(sales, expenses, from, to) {
  const days = eachDate(from, to);
  const daily = [];
  for (const date of days) {
    const summary = summarize(sales, expenses, date, date);
    if (summary.overflow) return null;
    daily.push({ from: date, to: date, gross: summary.gross, net: summary.net });
  }
  if (daily.length <= 42) return daily;
  const groups = [];
  for (const day of daily) {
    const weekStart = startOfWeek(day.from);
    let group = groups[groups.length - 1];
    if (!group || group.weekStart !== weekStart) {
      group = { weekStart, from: day.from, to: day.to, gross: 0, net: 0 };
      groups.push(group);
    }
    group.to = day.to;
    group.gross += day.gross;
    group.net += day.net;
    if (!Number.isSafeInteger(group.gross) || !Number.isSafeInteger(group.net)) return null;
  }
  return groups.map((group) => ({
    from: group.from,
    to: group.to,
    gross: group.gross,
    net: group.net,
  }));
}

function formatTenthsPercent(tenths) {
  if (tenths === null || tenths === undefined) return 'Unavailable';
  const sign = tenths < 0 ? '-' : '';
  const abs = Math.abs(tenths);
  const whole = Math.floor(abs / 10);
  const frac = abs % 10;
  return `${sign}${whole}.${frac}%`;
}

function metricProfit(summary, metric) {
  return metric === 'gross' ? summary.gross : summary.net;
}

function evaluateTarget(target, sales, expenses, today) {
  const totalDays = daysBetweenInclusive(target.startDate, target.deadline);
  let status = 'active';
  if (today < target.startDate) status = 'not_started';
  else if (today > target.deadline) status = 'ended';

  // Profit already earned stops at today. The deadline is included once it has arrived.
  const earnedTo = status === 'not_started'
    ? null
    : (status === 'ended' ? target.deadline : today);

  let profit = 0;
  let elapsedDays = 0;
  let averageDaily = null;
  let estimate = null;
  let paceSaleCount = 0;
  let paceExpenseCount = 0;

  if (earnedTo) {
    const earned = summarize(sales, expenses, target.startDate, earnedTo);
    if (earned.overflow) return { overflow: true };
    profit = metricProfit(earned, target.metric);
    if (profit === null || !Number.isSafeInteger(profit)) return { overflow: true };
    paceSaleCount = earned.saleCount;
    paceExpenseCount = earned.expenseCount;
    elapsedDays = daysBetweenInclusive(target.startDate, earnedTo);
    averageDaily = divRound(profit, elapsedDays);
    if (status === 'active' && averageDaily !== null) {
      estimate = divRound(BigInt(profit) * BigInt(totalDays), BigInt(elapsedDays));
    }
  }

  const progressTenths = divRound(BigInt(profit) * 1000n, BigInt(target.targetAmount));
  if (progressTenths === null) return { overflow: true };
  const reached = profit >= target.targetAmount;
  const surplus = profit > target.targetAmount ? profit - target.targetAmount : 0;
  const remaining = reached ? 0 : target.targetAmount - profit;

  let daysRemaining = 0;
  let daysUntilStart = null;
  if (status === 'not_started') {
    daysRemaining = totalDays;
    daysUntilStart = daysBetweenInclusive(today, target.startDate) - 1;
  } else if (status === 'active') {
    daysRemaining = daysBetweenInclusive(today, target.deadline);
  }

  let dailyNeeded = null;
  if (status !== 'ended') {
    dailyNeeded = remaining === 0 || daysRemaining <= 0 ? 0 : divCeil(remaining, daysRemaining);
  }

  return {
    overflow: false,
    status,
    metric: target.metric,
    targetAmount: target.targetAmount,
    startDate: target.startDate,
    deadline: target.deadline,
    totalDays,
    profit,
    progressTenths,
    remaining,
    surplus,
    reached,
    daysRemaining,
    daysUntilStart,
    dailyNeeded,
    elapsedDays,
    averageDaily,
    estimate,
    periodSaleCount: paceSaleCount,
    periodExpenseCount: paceExpenseCount,
    paceSaleCount,
    paceExpenseCount,
  };
}

module.exports = {
  MAX_RANGE_DAYS,
  summarize,
  rangeError,
  buildChart,
  formatTenthsPercent,
  evaluateTarget,
};
