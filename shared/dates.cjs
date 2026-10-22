const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

function parseISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function todayISO(now = new Date()) {
  return formatISODate(now);
}

function localStamp(now = new Date()) {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${formatISODate(now)} ${hours}:${minutes}`;
}

function formatStamp(stamp) {
  if (typeof stamp !== 'string' || stamp.length < 16) return stamp || '';
  const date = stamp.slice(0, 10);
  const time = stamp.slice(11, 16);
  if (!isRealDate(date)) return stamp;
  return `${formatLongDate(date)} at ${time}`;
}

function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

function daysBetweenInclusive(start, end) {
  const from = parseISODate(start);
  const to = parseISODate(end);
  const diff = Math.round((to - from) / 86400000);
  return diff + 1;
}

function startOfWeek(iso) {
  const date = parseISODate(iso);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - mondayOffset);
  return formatISODate(date);
}

function endOfWeek(iso) {
  return addDays(startOfWeek(iso), 6);
}

function startOfMonth(iso) {
  const date = parseISODate(iso);
  return formatISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(iso) {
  const date = parseISODate(iso);
  return formatISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatLongDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatDayMonth(iso) {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

function formatRange(from, to) {
  if (from === to) return formatLongDate(from);
  return `${formatLongDate(from)} to ${formatLongDate(to)}`;
}

function comparisonWindows(preset, today) {
  if (!isRealDate(today)) return null;
  if (preset === 'week') {
    const from = startOfWeek(today);
    return {
      kind: 'week',
      label: 'Compared with last week',
      current: { from, to: today },
      previous: { from: addDays(from, -7), to: addDays(today, -7) },
      note: null,
    };
  }
  if (preset === 'month') {
    const from = startOfMonth(today);
    const day = parseISODate(today).getDate();
    const previousFrom = startOfMonth(addDays(from, -1));
    const previousDays = parseISODate(endOfMonth(previousFrom)).getDate();
    const elapsed = Math.min(day, previousDays);
    return {
      kind: 'month',
      label: 'Compared with last month',
      current: { from, to: addDays(from, elapsed - 1) },
      previous: { from: previousFrom, to: addDays(previousFrom, elapsed - 1) },
      note: elapsed < day ? `Comparing the first ${elapsed} days of each month.` : null,
      elapsed,
    };
  }
  return null;
}

function presetRange(preset, today) {
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'week') return { from: startOfWeek(today), to: endOfWeek(today) };
  if (preset === 'month') return { from: startOfMonth(today), to: endOfMonth(today) };
  throw new Error('Unknown period.');
}

module.exports = {
  MIN_YEAR,
  MAX_YEAR,
  isRealDate,
  todayISO,
  localStamp,
  formatStamp,
  addDays,
  daysBetweenInclusive,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  formatLongDate,
  formatDayMonth,
  formatRange,
  presetRange,
  comparisonWindows,
};
