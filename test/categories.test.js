const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../electron/db.cjs');
const { filterEntryRows, filteredExpenseTotal } = require('../shared/entries.cjs');
const { summarize, evaluateTarget, buildComparison } = require('../shared/stats.cjs');

async function tempDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-cat-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  const database = await openDatabase(file);
  return { directory, file, database };
}

function categoryId(database, key) {
  return database.getState().categories.find((item) => item.builtinKey === key).id;
}

test('the sale, direct cost, and expense example keeps gross and net after categorising', async () => {
  const { directory, database } = await tempDb();
  database.addSale({ entryDate: '2026-10-22', description: 'Order', saleAmount: 100000, directCost: 70000 });
  const shipping = categoryId(database, 'shipping');
  database.addExpense({ entryDate: '2026-10-22', description: 'Postage', amount: 5000, categoryId: shipping });
  const first = summarize(database.getState().sales, database.getState().expenses, '2026-10-22', '2026-10-22');
  assert.equal(first.gross, 30000);
  assert.equal(first.net, 25000);
  assert.equal(database.getState().expenses[0].categoryId, shipping);

  const taxes = categoryId(database, 'taxes');
  database.addExpense({ entryDate: '2026-10-22', description: 'Tax paid', amount: 2000, categoryId: taxes });
  const second = summarize(database.getState().sales, database.getState().expenses, '2026-10-22', '2026-10-22');
  assert.equal(second.gross, 30000);
  assert.equal(second.otherExpenses, 7000);
  assert.equal(second.net, 23000);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('categories can be created, renamed, archived, restored, and kept after restart', async () => {
  const { directory, file, database } = await tempDb();
  assert.equal(database.getState().categories.length, 14);
  assert.equal(database.getState().categories.at(-1).name, 'Other');
  const created = database.addCategory('Samples & prototypes');
  assert.equal(created.state.categories.find((item) => item.id === created.categoryId).name, 'Samples & prototypes');
  const renamed = database.renameCategory(created.categoryId, 'Samples');
  assert.equal(renamed.categories.find((item) => item.id === created.categoryId).name, 'Samples');
  database.archiveCategory(created.categoryId);
  assert.equal(database.getState().categories.find((item) => item.id === created.categoryId).archived, true);
  database.close();

  const reopened = await openDatabase(file);
  assert.equal(reopened.getState().categories.length, 15);
  const stored = reopened.getState().categories.find((item) => item.id === created.categoryId);
  assert.equal(stored.name, 'Samples');
  assert.equal(stored.archived, true);
  reopened.restoreCategory(created.categoryId);
  assert.equal(reopened.getState().categories.find((item) => item.id === created.categoryId).archived, false);
  reopened.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('blank, duplicate, archived, long, and invalid category values are rejected', async () => {
  const { directory, database } = await tempDb();
  assert.throws(() => database.addCategory('   '), /category name/);
  assert.throws(() => database.addCategory('Other'), /already exists/);
  assert.throws(() => database.addCategory('  other   '), /already exists/);
  assert.throws(() => database.addCategory('Uncategorised'), /reserved/);
  assert.throws(() => database.addCategory('a'.repeat(61)), /60/);
  const longName = database.addCategory('a'.repeat(60));
  assert.equal(longName.state.categories.some((item) => item.name.length === 60), true);

  const shipping = database.getState().categories.find((item) => item.builtinKey === 'shipping');
  database.archiveCategory(shipping.id);
  const offered = database.addCategory('Shipping & delivery');
  assert.equal(offered.needsRestore, true);
  assert.equal(offered.categoryId, shipping.id);
  assert.equal(database.getState().categories.length, 15);

  assert.throws(() => database.addExpense({
    entryDate: '2026-10-22',
    description: 'Missing',
    amount: 100,
    categoryId: 99999,
  }), /Choose a category/);
  assert.throws(() => database.addExpense({
    entryDate: '2026-10-22',
    description: 'Archived',
    amount: 100,
    categoryId: shipping.id,
  }), /archived/);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('creating a category does not create an expense, and old uncategorised rows can stay that way', async () => {
  const { directory, database } = await tempDb();
  database.addCategory('Samples & prototypes');
  assert.equal(database.getState().expenses.length, 0);
  const other = categoryId(database, 'other');
  database.addExpense({ entryDate: '2026-10-22', description: 'Old', amount: 5000, categoryId: other });
  database.getState();
  const expense = database.getState().expenses[0];
  database.updateExpense({
    id: expense.id,
    entryDate: expense.entryDate,
    description: 'Still old',
    amount: expense.amount,
    categoryId: null,
  });
  assert.equal(database.getState().expenses[0].categoryId, null);
  assert.equal(database.getState().expenses[0].description, 'Still old');
  assert.equal(database.getState().expenses[0].amount, 5000);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('a schema 2 account keeps counts, totals, targets, and rates, and does not reseed categories', async () => {
  const { directory, file, database } = await tempDb();
  const snapshot = Buffer.from(fs.readFileSync(file));
  database.close();
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: () => path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
  });
  const raw = new SQL.Database(snapshot);
  raw.run("UPDATE meta SET value = '2' WHERE key = 'schema'");
  raw.run("DELETE FROM meta WHERE key = 'categories_seeded'");
  raw.run('DROP TABLE categories');
  raw.run('ALTER TABLE expenses DROP COLUMN category_id');
  raw.run("INSERT INTO expenses (entry_date, description, amount) VALUES ('2026-10-22', 'Kept', 5000)");
  raw.run("INSERT INTO sales (entry_date, description, sale_amount, direct_cost) VALUES ('2026-10-22', 'Order', 100000, 70000)");
  raw.run("INSERT INTO exchange_rates (code, rate_text, updated_at) VALUES ('USD', '0.15', '2026-10-22 05:56')");
  const beforeSales = raw.exec('SELECT COUNT(*) FROM sales')[0].values[0][0];
  const beforeExpenses = raw.exec('SELECT COUNT(*) FROM expenses')[0].values[0][0];
  fs.writeFileSync(file, Buffer.from(raw.export()));
  raw.close();

  const migrated = await openDatabase(file);
  const state = migrated.getState();
  assert.equal(state.sales.length, beforeSales);
  assert.equal(state.expenses.length, beforeExpenses);
  assert.equal(state.expenses[0].description, 'Kept');
  assert.equal(state.expenses[0].amount, 5000);
  assert.equal(state.expenses[0].categoryId, null);
  assert.equal(state.expenses[0].entryDate, '2026-10-22');
  const totals = summarize(state.sales, state.expenses, '2026-10-22', '2026-10-22');
  assert.equal(totals.gross, 30000);
  assert.equal(totals.net, 25000);
  assert.equal(state.targets.length, 2);
  assert.equal(state.targets[0].targetAmount, 10000000);
  assert.equal(state.rates.USD.text, '0.15');
  assert.equal(state.categories.length, 14);
  migrated.renameCategory(state.categories[0].id, 'Promotions');
  migrated.close();

  const again = await openDatabase(file);
  assert.equal(again.getState().categories.length, 14);
  assert.equal(again.getState().categories.find((item) => item.builtinKey === 'advertising').name, 'Promotions');
  again.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('backup and restore keep custom and archived categories, and an older backup migrates once', async () => {
  const { directory, database } = await tempDb();
  const created = database.addCategory('Samples & prototypes');
  database.addExpense({
    entryDate: '2026-10-22',
    description: 'Sample pack',
    amount: 2500,
    categoryId: created.categoryId,
  });
  database.archiveCategory(created.categoryId);
  const other = categoryId(database, 'other');
  database.updateExpense({
    id: database.getState().expenses[0].id,
    entryDate: '2026-10-22',
    description: 'Sample pack',
    amount: 2500,
    categoryId: created.categoryId,
  });
  const backup = path.join(directory, 'backup.sqlite');
  database.backupTo(backup);
  database.addCategory('Temporary');
  database.restoreFrom(backup);
  const restored = database.getState();
  assert.equal(restored.categories.some((item) => item.name === 'Temporary'), false);
  const custom = restored.categories.find((item) => item.name === 'Samples & prototypes');
  assert.equal(custom.archived, true);
  assert.equal(restored.expenses[0].categoryId, custom.id);
  assert.equal(restored.expenses[0].amount, 2500);

  const older = path.join(directory, 'older.sqlite');
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: () => path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
  });
  const source = new SQL.Database(fs.readFileSync(backup));
  source.run("UPDATE meta SET value = '2' WHERE key = 'schema'");
  source.run("DELETE FROM meta WHERE key = 'categories_seeded'");
  source.run('DROP TABLE categories');
  source.run('UPDATE expenses SET category_id = NULL');
  fs.writeFileSync(older, Buffer.from(source.export()));
  source.close();
  database.restoreFrom(older);
  const migrated = database.getState();
  assert.equal(migrated.expenses.length, 1);
  assert.equal(migrated.expenses[0].categoryId, null);
  assert.equal(migrated.expenses[0].amount, 2500);
  assert.equal(migrated.categories.length, 14);
  assert.equal(migrated.categories.filter((item) => item.name === 'Other').length, 1);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
  assert.equal(other > 0, true);
});

test('exchange rates do not change RMB comparison amounts or category totals', async () => {
  const { directory, database } = await tempDb();
  database.addSale({ entryDate: '2026-10-22', description: 'Now', saleAmount: 1200000, directCost: 0 });
  database.addSale({ entryDate: '2026-10-15', description: 'Then', saleAmount: 1000000, directCost: 0 });
  const taxes = categoryId(database, 'taxes');
  database.addExpense({ entryDate: '2026-10-22', description: 'Tax', amount: 2000, categoryId: taxes });
  const before = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-22');
  const progress = evaluateTarget(database.getState().targets[0], database.getState().sales, database.getState().expenses, '2026-10-22');
  database.setRate('USD', '0.20');
  const after = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-22');
  assert.deepEqual(after.rows, before.rows);
  const again = evaluateTarget(database.getState().targets[0], database.getState().sales, database.getState().expenses, '2026-10-22');
  assert.equal(again.profit, progress.profit);
  assert.equal(database.getState().expenses[0].amount, 2000);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('editing or deleting an expense changes the comparison for that window', async () => {
  const { directory, database } = await tempDb();
  const other = categoryId(database, 'other');
  database.addExpense({ entryDate: '2026-10-22', description: 'Fee', amount: 8000, categoryId: other });
  const first = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-22');
  assert.equal(first.rows[1].current, 8000);
  const expense = database.getState().expenses[0];
  database.updateExpense({ ...expense, amount: 3000, categoryId: other });
  const second = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-22');
  assert.equal(second.rows[1].current, 3000);
  database.deleteExpense(expense.id);
  const third = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-22');
  assert.equal(third.rows[1].current, 0);
  const nextDay = buildComparison(database.getState().sales, database.getState().expenses, 'week', '2026-10-23');
  assert.deepEqual(nextDay.current, { from: '2026-10-19', to: '2026-10-23' });
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('category filters keep the matching expenses and their total', () => {
  const rows = [
    { kind: 'sale', amount: 100000, categoryId: null },
    { kind: 'expense', amount: 5000, categoryId: 2 },
    { kind: 'expense', amount: 2000, categoryId: 9 },
    { kind: 'expense', amount: 800, categoryId: null },
  ];
  const shipping = filterEntryRows(rows, { type: 'all', category: '2' });
  assert.deepEqual(shipping.map((row) => row.amount), [5000]);
  assert.equal(filteredExpenseTotal(shipping), 5000);
  const uncategorised = filterEntryRows(rows, { type: 'expense', category: 'none' });
  assert.equal(filteredExpenseTotal(uncategorised), 800);
  const expenses = filterEntryRows(rows, { type: 'expense', category: 'all' });
  assert.equal(filteredExpenseTotal(expenses), 7800);
  assert.equal(filteredExpenseTotal(rows), 7800);
});

test('an archived category stays on its record and cannot be chosen for a new expense', async () => {
  const { directory, database } = await tempDb();
  const shipping = categoryId(database, 'shipping');
  database.addExpense({ entryDate: '2026-10-22', description: 'Parcel', amount: 1500, categoryId: shipping });
  database.archiveCategory(shipping);
  const expense = database.getState().expenses[0];
  database.updateExpense({
    id: expense.id,
    entryDate: '2026-10-23',
    description: 'Parcel moved',
    amount: 1500,
    categoryId: shipping,
  });
  assert.equal(database.getState().expenses[0].categoryId, shipping);
  assert.equal(database.getState().expenses[0].entryDate, '2026-10-23');
  assert.throws(() => database.addExpense({
    entryDate: '2026-10-22',
    description: 'Another',
    amount: 100,
    categoryId: shipping,
  }), /archived/);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
