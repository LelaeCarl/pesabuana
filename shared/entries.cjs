function filterEntryRows(rows, { type = 'all', category = 'all' } = {}) {
  return rows.filter((row) => {
    if (type !== 'all' && row.kind !== type) return false;
    if (category === 'all') return true;
    if (row.kind !== 'expense') return false;
    if (category === 'none') return row.categoryId == null;
    return String(row.categoryId) === String(category);
  });
}

function filteredExpenseTotal(rows) {
  return rows.reduce((sum, row) => (row.kind === 'expense' ? sum + row.amount : sum), 0);
}

module.exports = { filterEntryRows, filteredExpenseTotal };
