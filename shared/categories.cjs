const BUILTIN_CATEGORIES = [
  { key: 'advertising', name: 'Advertising & marketing' },
  { key: 'bank-fees', name: 'Bank & payment fees' },
  { key: 'office-supplies', name: 'Office supplies & stationery' },
  { key: 'packaging', name: 'Packaging & supplies' },
  { key: 'phone-internet', name: 'Phone & internet' },
  { key: 'professional-services', name: 'Professional services' },
  { key: 'rent', name: 'Rent & workspace' },
  { key: 'repairs', name: 'Repairs & maintenance' },
  { key: 'shipping', name: 'Shipping & delivery' },
  { key: 'software', name: 'Software & subscriptions' },
  { key: 'taxes', name: 'Taxes' },
  { key: 'travel', name: 'Travel & transport' },
  { key: 'utilities', name: 'Utilities' },
  { key: 'other', name: 'Other' },
];

function fail(error) {
  return { ok: false, error };
}

function ok(value) {
  return { ok: true, value };
}

function normalizeCategoryName(value) {
  if (typeof value !== 'string') return fail('Enter a category name.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return fail('Enter a category name.');
  if (name.length > 60) return fail('Use 60 characters or less for the category name.');
  if (name.toLowerCase() === 'uncategorised' || name.toLowerCase() === 'uncategorized') {
    return fail('Uncategorised is reserved.');
  }
  return ok({ name, key: name.toLowerCase() });
}

module.exports = {
  BUILTIN_CATEGORIES,
  normalizeCategoryName,
};
