const { isRealDate } = require('./dates.cjs');
const { isSafeNonNegative } = require('./money.cjs');

const INCOMING_KINDS = {
  business: 'Business payment',
  loan: 'Loan repayment',
  other: 'Other expected money',
};

const STATUS_LABELS = {
  pending: 'Pending',
  partial: 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
};

function fail(error) {
  return { ok: false, error };
}

function ok(value) {
  return { ok: true, value };
}

function trimmed(value, { required, max, empty, long }) {
  if (typeof value !== 'string') return required ? fail(empty) : ok('');
  const text = value.trim();
  if (required && !text) return fail(empty);
  if (text.length > max) return fail(long);
  return ok(text);
}

function validateToken(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    return fail('The save could not be repeated. Close the form and try again.');
  }
  return ok(value.trim());
}

function validateExpectedDate(value) {
  if (value === null || value === undefined || value === '') return ok(null);
  if (!isRealDate(value)) return fail('Enter a valid expected date, or leave it blank.');
  return ok(value);
}

function validateIncomingItem(input, options = {}) {
  if (!input || typeof input !== 'object') return fail('Enter the incoming details.');
  const party = trimmed(input.party, {
    required: true,
    max: 80,
    empty: 'Enter who the money is from.',
    long: 'Use 80 characters or less for the name.',
  });
  if (!party.ok) return party;
  const description = trimmed(input.description, {
    required: true,
    max: 200,
    empty: 'Enter what the money is for.',
    long: 'Use 200 characters or less for the description.',
  });
  if (!description.ok) return description;
  if (!Object.prototype.hasOwnProperty.call(INCOMING_KINDS, input.kind)) {
    return fail('Choose a type.');
  }
  if (!isSafeNonNegative(input.expectedAmount) || input.expectedAmount === 0) {
    return fail('Enter an amount above zero.');
  }
  const expectedDate = validateExpectedDate(input.expectedDate);
  if (!expectedDate.ok) return expectedDate;
  const notes = trimmed(input.notes, {
    required: false,
    max: 400,
    empty: '',
    long: 'Use 400 characters or less for the notes.',
  });
  if (!notes.ok) return notes;
  let clientToken = null;
  if (options.requireToken) {
    const token = validateToken(input.clientToken);
    if (!token.ok) return token;
    clientToken = token.value;
  }
  return ok({
    party: party.value,
    description: description.value,
    kind: input.kind,
    expectedAmount: input.expectedAmount,
    expectedDate: expectedDate.value,
    notes: notes.value,
    clientToken,
  });
}

function validateIncomingPayment(input) {
  if (!input || typeof input !== 'object') return fail('Enter the payment.');
  if (!isRealDate(input.today)) return fail('Enter a received date.');
  if (!isRealDate(input.receivedDate)) return fail('Enter a received date.');
  if (input.receivedDate > input.today) return fail('Enter a received date that is not in the future.');
  if (!isSafeNonNegative(input.amount) || input.amount === 0) {
    return fail('Enter a payment above zero.');
  }
  const note = trimmed(input.note, {
    required: false,
    max: 200,
    empty: '',
    long: 'Use 200 characters or less for the note.',
  });
  if (!note.ok) return note;
  const token = validateToken(input.clientToken);
  if (!token.ok) return token;
  return ok({
    receivedDate: input.receivedDate,
    amount: input.amount,
    note: note.value,
    clientToken: token.value,
    today: input.today,
  });
}

function itemStatus(item) {
  if (item.cancelled) return 'cancelled';
  if (item.received <= 0) return 'pending';
  if (item.received < item.expectedAmount) return 'partial';
  return 'received';
}

function remainingAmount(item) {
  return item.expectedAmount - item.received;
}

function isOverdue(item, today) {
  if (!item.expectedDate || item.cancelled) return false;
  if (remainingAmount(item) <= 0) return false;
  return item.expectedDate < today;
}

function summarizeIncoming(items) {
  let stillToReceive = 0;
  let overdue = 0;
  let overflow = false;
  for (const item of items) {
    if (item.cancelled) continue;
    const left = remainingAmount(item);
    if (left <= 0) continue;
    const nextStill = stillToReceive + left;
    if (!Number.isSafeInteger(nextStill)) overflow = true;
    else stillToReceive = nextStill;
    if (item.overdue) {
      const nextOverdue = overdue + left;
      if (!Number.isSafeInteger(nextOverdue)) overflow = true;
      else overdue = nextOverdue;
    }
  }
  return { stillToReceive, overdue, overflow };
}

function withIncomingView(item, today) {
  return {
    ...item,
    status: itemStatus(item),
    remaining: remainingAmount(item),
    overdue: isOverdue(item, today),
  };
}

function compareIncoming(left, right, today) {
  function rank(item) {
    if (!item.expectedDate) return 2;
    if (isOverdue(item, today)) return 0;
    return 1;
  }
  const difference = rank(left) - rank(right);
  if (difference !== 0) return difference;
  if (left.expectedDate && right.expectedDate && left.expectedDate !== right.expectedDate) {
    return left.expectedDate.localeCompare(right.expectedDate);
  }
  return left.id - right.id;
}

function filterIncoming(items, { status = 'open', kind = 'all', query = '', today } = {}) {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    const view = withIncomingView(item, today);
    if (status === 'open' && view.status !== 'pending' && view.status !== 'partial') return false;
    if (status === 'overdue' && !view.overdue) return false;
    if (status === 'received' && view.status !== 'received') return false;
    if (status === 'cancelled' && view.status !== 'cancelled') return false;
    if (kind !== 'all' && item.kind !== kind) return false;
    if (needle && !`${item.party} ${item.description}`.toLowerCase().includes(needle)) return false;
    return true;
  }).sort((left, right) => compareIncoming(left, right, today));
}

module.exports = {
  INCOMING_KINDS,
  STATUS_LABELS,
  validateIncomingItem,
  validateIncomingPayment,
  itemStatus,
  remainingAmount,
  isOverdue,
  summarizeIncoming,
  withIncomingView,
  compareIncoming,
  filterIncoming,
};
