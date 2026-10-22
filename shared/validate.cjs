const { getCurrency } = require('./currencies.cjs');
const { isRealDate, daysBetweenInclusive, MIN_YEAR, MAX_YEAR } = require('./dates.cjs');
const { isSafeNonNegative, maxMinor } = require('./money.cjs');
const { MAX_RANGE_DAYS } = require('./stats.cjs');

function fail(error) {
  return { ok: false, error };
}

function ok(value) {
  return { ok: true, value };
}

function validateDate(value) {
  if (!isRealDate(value)) {
    return fail(`Enter a date from ${MIN_YEAR} to ${MAX_YEAR}.`);
  }
  return ok(value);
}

function validateDescription(value) {
  if (value === undefined || value === null) return ok('');
  if (typeof value !== 'string') return fail('Enter a description.');
  const text = value.trim();
  if (text.length > 200) return fail('Description must be 200 characters or less.');
  return ok(text);
}

function validateSale(input) {
  if (!input || typeof input !== 'object') return fail('Enter the sale details.');
  const entryDate = validateDate(input.entryDate);
  if (!entryDate.ok) return entryDate;
  const description = validateDescription(input.description);
  if (!description.ok) return description;
  if (!isSafeNonNegative(input.saleAmount) || !isSafeNonNegative(input.directCost)) {
    return fail('Enter valid amounts.');
  }
  if (input.saleAmount === 0 && input.directCost === 0) {
    return fail('Enter a sale amount or a direct cost.');
  }
  return ok({
    entryDate: entryDate.value,
    description: description.value,
    saleAmount: input.saleAmount,
    directCost: input.directCost,
  });
}

function validateCategorySelection(value, required) {
  if (value === null || value === undefined || value === '') {
    return required ? fail('Choose a category.') : ok(null);
  }
  if (!Number.isInteger(value) || value <= 0) return fail('Choose a category.');
  return ok(value);
}

function validateExpense(input, options = {}) {
  if (!input || typeof input !== 'object') return fail('Enter the expense details.');
  const entryDate = validateDate(input.entryDate);
  if (!entryDate.ok) return entryDate;
  const description = validateDescription(input.description);
  if (!description.ok) return description;
  if (!isSafeNonNegative(input.amount) || input.amount === 0) {
    return fail('Enter an expense amount above zero.');
  }
  const category = validateCategorySelection(input.categoryId, !options.allowUncategorised);
  if (!category.ok) return category;
  return ok({
    entryDate: entryDate.value,
    description: description.value,
    amount: input.amount,
    categoryId: category.value,
  });
}

function validateName(value) {
  if (typeof value !== 'string') return fail('Enter a name.');
  const text = value.trim();
  if (!text) return fail('Enter a name.');
  if (text.length > 80) return fail('Use 80 characters or less for the name.');
  return ok(text);
}

function validateTarget(input) {
  if (!input || typeof input !== 'object') return fail('Enter the target details.');
  const name = validateName(input.name);
  if (!name.ok) return name;
  if (input.metric !== 'gross' && input.metric !== 'net') {
    return fail('Choose gross or net profit.');
  }
  const startDate = validateDate(input.startDate);
  if (!startDate.ok) return startDate;
  const deadline = validateDate(input.deadline);
  if (!deadline.ok) return deadline;
  if (deadline.value < startDate.value) {
    return fail('The deadline must be on or after the start date.');
  }
  if (daysBetweenInclusive(startDate.value, deadline.value) > MAX_RANGE_DAYS) {
    return fail('Choose a period of 10 years or less.');
  }
  if (!isSafeNonNegative(input.targetAmount) || input.targetAmount === 0) {
    return fail('Enter a target amount above zero.');
  }
  return ok({
    name: name.value,
    metric: input.metric,
    targetAmount: input.targetAmount,
    startDate: startDate.value,
    deadline: deadline.value,
  });
}

function validateCurrencyCode(code) {
  const currency = getCurrency(code);
  if (!currency) return fail('Choose a currency from the list.');
  return ok(currency.code);
}

function amountWithinCurrency(minor, currency) {
  return isSafeNonNegative(minor) && minor <= maxMinor(currency.exponent);
}

module.exports = {
  validateSale,
  validateExpense,
  validateTarget,
  validateCurrencyCode,
  amountWithinCurrency,
};
