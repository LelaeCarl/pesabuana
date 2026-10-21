const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../electron/db.cjs');
const { summarize, evaluateTarget } = require('../shared/stats.cjs');
const { validateSale, validateTarget } = require('../shared/validate.cjs');

async function tempDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  const database = await openDatabase(file);
  return { directory, file, database };
}

async function writeV1(file, { currency = null, sale = null, target = null } = {}) {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: () => path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
  });
  const database = new SQL.Database();
  database.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), currency_code TEXT NOT NULL);
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      sale_amount INTEGER NOT NULL,
      direct_cost INTEGER NOT NULL
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL
    );
    CREATE TABLE targets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      metric TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      deadline TEXT NOT NULL
    );
    INSERT INTO meta (key, value) VALUES ('schema', '1');
  `);
  if (currency) database.run('INSERT INTO settings (id, currency_code) VALUES (1, ?)', [currency]);
  if (sale) {
    database.run(
      'INSERT INTO sales (entry_date, description, sale_amount, direct_cost) VALUES (?, ?, ?, ?)',
      [sale.entryDate, sale.description, sale.saleAmount, sale.directCost],
    );
  }
  if (target) {
    database.run(
      'INSERT INTO targets (id, metric, target_amount, start_date, deadline) VALUES (1, ?, ?, ?, ?)',
      [target.metric, target.amount, target.startDate, target.deadline],
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(database.export()));
  database.close();
}

function presetNamed(state, name) {
  return state.targets.find((item) => item.name === name);
}

test('a new account uses RMB and the two targets once', async () => {
  const { directory, file, database } = await tempDb();
  const state = database.getState();
  assert.equal(state.currency.code, 'CNY');
  assert.equal(state.sales.length, 0);
  assert.equal(state.rates.USD, null);
  assert.equal(state.rates.KES, null);
  const birthday = presetNamed(state, 'Operation Birthday Gift');
  const newYear = presetNamed(state, 'Operation New Year');
  assert.equal(birthday.targetAmount, 10000000);
  assert.equal(birthday.metric, 'net');
  assert.equal(birthday.startDate, '2026-10-22');
  assert.equal(birthday.deadline, '2026-12-04');
  assert.equal(newYear.targetAmount, 15000000);
  assert.equal(newYear.metric, 'net');
  assert.equal(newYear.startDate, '2026-10-22');
  assert.equal(newYear.deadline, '2026-12-31');
  database.updateTarget({
    id: birthday.id,
    name: 'Operation Birthday Gift',
    metric: 'net',
    targetAmount: 9000000,
    startDate: '2026-10-22',
    deadline: '2026-12-04',
  });
  database.close();

  const reopened = await openDatabase(file);
  assert.equal(reopened.getState().targets.length, 2);
  assert.equal(presetNamed(reopened.getState(), 'Operation Birthday Gift').targetAmount, 9000000);
  for (const target of reopened.getState().targets) reopened.deleteTarget(target.id);
  reopened.close();

  const afterDelete = await openDatabase(file);
  assert.equal(afterDelete.getState().targets.length, 0);
  afterDelete.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('a saved entry is still there after the database is closed and opened', async () => {
  const { directory, file, database } = await tempDb();
  database.addSale({
    entryDate: '2026-10-22',
    description: 'Morning stall',
    saleAmount: 150000,
    directCost: 40000,
  });
  database.addExpense({
    entryDate: '2026-10-22',
    description: 'Transport',
    amount: 2550,
  });
  database.close();

  const reopened = await openDatabase(file);
  const state = reopened.getState();
  assert.equal(state.currency.code, 'CNY');
  assert.equal(state.sales[0].saleAmount, 150000);
  assert.equal(state.sales[0].directCost, 40000);
  assert.equal(state.expenses[0].amount, 2550);
  const totals = summarize(state.sales, state.expenses, '2026-10-22', '2026-10-22');
  assert.equal(totals.gross, 110000);
  assert.equal(totals.net, 107450);
  reopened.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('backup and restore keep entries, targets, and rates', async () => {
  const { directory, file, database } = await tempDb();
  database.addSale({
    entryDate: '2026-10-22',
    description: 'Kept',
    saleAmount: 100000,
    directCost: 70000,
  });
  database.addExpense({
    entryDate: '2026-10-22',
    description: 'Supplies',
    amount: 5000,
  });
  database.setRate('USD', '0.14');
  database.setRate('KES', '18.50');
  const before = database.getState();
  const progress = evaluateTarget(before.targets[0], before.sales, before.expenses, '2026-10-22');
  const backup = path.join(directory, 'backup.sqlite');
  database.backupTo(backup);

  database.setRate('USD', '0.20');
  database.addSale({
    entryDate: '2026-10-22',
    description: 'Later',
    saleAmount: 9000,
    directCost: 0,
  });
  database.restoreFrom(backup);
  const restored = database.getState();
  assert.equal(restored.sales.length, 1);
  assert.equal(restored.sales[0].saleAmount, 100000);
  assert.equal(restored.sales[0].directCost, 70000);
  assert.equal(restored.expenses[0].amount, 5000);
  assert.equal(restored.rates.USD.text, '0.14');
  assert.equal(restored.rates.KES.text, '18.50');
  assert.equal(restored.targets.length, 2);
  const again = evaluateTarget(restored.targets[0], restored.sales, restored.expenses, '2026-10-22');
  assert.equal(again.progressTenths, progress.progressTenths);
  assert.equal(again.profit, progress.profit);

  fs.writeFileSync(path.join(directory, 'notes.txt'), 'hello');
  assert.throws(() => database.restoreFrom(path.join(directory, 'notes.txt')), /not a pesabuana backup/);
  assert.equal(database.getState().sales[0].description, 'Kept');
  database.close();
  const reopened = await openDatabase(file);
  assert.equal(reopened.getState().rates.USD.text, '0.14');
  reopened.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('an older RMB account keeps exact amounts and gains the targets once', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  await writeV1(file, {
    currency: 'CNY',
    sale: { entryDate: '2026-10-22', description: 'Old sale', saleAmount: 10010, directCost: 4020 },
  });
  const database = await openDatabase(file);
  const state = database.getState();
  assert.equal(state.currency.code, 'CNY');
  assert.equal(state.sales[0].saleAmount, 10010);
  assert.equal(state.sales[0].directCost, 4020);
  assert.equal(state.targets.length, 2);
  database.close();
  const again = await openDatabase(file);
  assert.equal(again.getState().targets.length, 2);
  assert.equal(again.getState().sales[0].saleAmount, 10010);
  again.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('an empty account in another currency becomes RMB', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  await writeV1(file, { currency: 'USD' });
  const database = await openDatabase(file);
  assert.equal(database.getState().currency.code, 'CNY');
  assert.equal(database.getState().blocked, null);
  assert.equal(database.getState().targets.length, 2);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('records in another currency are not relabelled', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  await writeV1(file, {
    currency: 'KES',
    sale: { entryDate: '2026-10-22', description: 'Stall', saleAmount: 5000, directCost: 1000 },
  });
  const before = fs.readFileSync(file);
  const database = await openDatabase(file);
  const state = database.getState();
  assert.equal(state.blocked.code, 'KES');
  assert.equal(state.currency.code, 'KES');
  assert.equal(state.sales[0].saleAmount, 5000);
  assert.equal(state.targets.length, 0);
  database.close();
  assert.deepEqual(fs.readFileSync(file), before);

  const current = await tempDb();
  const backup = path.join(current.directory, 'foreign.sqlite');
  fs.copyFileSync(file, backup);
  assert.throws(() => current.database.restoreFrom(backup), /not restored/);
  assert.equal(current.database.getState().currency.code, 'CNY');
  assert.equal(current.database.getState().sales.length, 0);
  current.database.close();
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(current.directory, { recursive: true, force: true });
});

test('changing a rate leaves stored amounts and target progress unchanged', async () => {
  const { directory, database } = await tempDb();
  database.addSale({
    entryDate: '2026-10-22',
    description: 'Order',
    saleAmount: 100000,
    directCost: 70000,
  });
  database.addExpense({ entryDate: '2026-10-22', description: 'Supplies', amount: 5000 });
  const first = database.getState();
  const before = evaluateTarget(first.targets[0], first.sales, first.expenses, '2026-10-22');
  database.setRate('USD', '0.14');
  const second = database.getState();
  const after = evaluateTarget(second.targets[0], second.sales, second.expenses, '2026-10-22');
  assert.equal(second.sales[0].saleAmount, 100000);
  assert.equal(second.sales[0].directCost, 70000);
  assert.equal(after.profit, before.profit);
  assert.equal(after.progressTenths, before.progressTenths);
  assert.equal(summarize(second.sales, second.expenses, '2026-10-22', '2026-10-22').net, 25000);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('a damaged database starts empty and keeps the old file aside', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  fs.writeFileSync(file, 'this is not a database');
  const database = await openDatabase(file);
  const state = database.getState();
  assert.equal(state.currency.code, 'CNY');
  assert.equal(state.sales.length, 0);
  assert.match(state.notice, /empty account/);
  const damaged = fs.readdirSync(directory).filter((name) => name.includes('damaged'));
  assert.equal(damaged.length, 1);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('currency is locked and records are checked before saving', async () => {
  const { directory, database } = await tempDb();
  assert.throws(() => database.setCurrency('USD'), /already set/);
  assert.equal(validateSale({
    entryDate: '2026-10-22',
    description: '  ',
    saleAmount: 0,
    directCost: 0,
  }).ok, false);
  assert.equal(validateTarget({
    name: 'Goal',
    metric: 'gross',
    targetAmount: 100,
    startDate: '2026-10-22',
    deadline: '2026-10-01',
  }).error, 'The deadline must be on or after the start date.');
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
