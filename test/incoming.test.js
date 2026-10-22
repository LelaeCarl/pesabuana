const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDatabase } = require('../electron/db.cjs');
const {
  filterIncoming,
  summarizeIncoming,
  withIncomingView,
} = require('../shared/incoming.cjs');
const { summarize, evaluateTarget, buildComparison } = require('../shared/stats.cjs');

const today = '2026-10-22';

async function tempDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pesabuana-in-'));
  const file = path.join(directory, 'pesabuana.sqlite');
  const database = await openDatabase(file);
  return { directory, file, database };
}

function itemInput(overrides = {}) {
  return {
    party: 'Ada',
    description: 'Invoice 12',
    kind: 'business',
    expectedAmount: 100000,
    expectedDate: '2026-10-21',
    notes: '',
    clientToken: `item-${Math.random()}`,
    ...overrides,
  };
}

test('expected money does not change sales, profit, or target progress', async () => {
  const { directory, database } = await tempDb();
  database.addSale({ entryDate: '2026-10-22', description: 'Order', saleAmount: 100000, directCost: 70000 });
  const other = database.getState().categories.find((item) => item.builtinKey === 'other').id;
  database.addExpense({ entryDate: '2026-10-22', description: 'Fee', amount: 5000, categoryId: other });
  const before = database.getState();
  const profit = summarize(before.sales, before.expenses, '2026-10-22', '2026-10-22');
  const progress = evaluateTarget(before.targets[0], before.sales, before.expenses, today);
  const comparison = buildComparison(before.sales, before.expenses, 'month', today);
  database.addIncoming(itemInput({ kind: 'business', clientToken: 'biz' }));
  database.addIncoming(itemInput({
    party: 'Ben',
    description: 'Loan',
    kind: 'loan',
    expectedAmount: 200000,
    clientToken: 'loan',
  }));
  database.addIncoming(itemInput({
    party: 'Chen',
    description: 'Other',
    kind: 'other',
    expectedAmount: 1500,
    expectedDate: null,
    clientToken: 'other',
  }));
  const after = database.getState();
  assert.equal(after.sales.length, 1);
  assert.equal(after.expenses.length, 1);
  assert.equal(summarize(after.sales, after.expenses, '2026-10-22', '2026-10-22').gross, profit.gross);
  assert.equal(summarize(after.sales, after.expenses, '2026-10-22', '2026-10-22').net, profit.net);
  const again = evaluateTarget(after.targets[0], after.sales, after.expenses, today);
  assert.equal(again.profit, progress.profit);
  assert.deepEqual(buildComparison(after.sales, after.expenses, 'month', today).rows, comparison.rows);
  assert.equal(after.incoming.length, 3);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('partial then full payment, including a loan, stays out of sales', async () => {
  const { directory, database } = await tempDb();
  database.addIncoming(itemInput({ kind: 'loan', expectedAmount: 100000, clientToken: 'loan-1' }));
  const item = database.getState().incoming[0];
  database.addIncomingPayment({
    itemId: item.id, amount: 30000, receivedDate: '2026-10-20', note: 'First', today, clientToken: 'pay-1',
  });
  let view = withIncomingView(database.getState().incoming[0], today);
  assert.equal(view.received, 30000);
  assert.equal(view.remaining, 70000);
  assert.equal(view.status, 'partial');
  database.addIncomingPayment({
    itemId: item.id, amount: 70000, receivedDate: '2026-10-22', note: '', today, clientToken: 'pay-2',
  });
  view = withIncomingView(database.getState().incoming[0], today);
  assert.equal(view.status, 'received');
  assert.equal(view.remaining, 0);
  assert.equal(database.getState().sales.length, 0);
  assert.equal(summarize(database.getState().sales, database.getState().expenses, '1990-01-01', '2100-12-31').net, 0);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('removing a payment restores the balance and duplicate or excess payments are refused', async () => {
  const { directory, database } = await tempDb();
  database.addIncoming(itemInput({ clientToken: 'once' }));
  database.addIncoming(itemInput({ clientToken: 'once', party: 'Duplicate' }));
  assert.equal(database.getState().incoming.length, 1);
  const item = database.getState().incoming[0];
  database.addIncomingPayment({
    itemId: item.id, amount: 30000, receivedDate: '2026-10-20', note: '', today, clientToken: 'same-pay',
  });
  database.addIncomingPayment({
    itemId: item.id, amount: 30000, receivedDate: '2026-10-20', note: '', today, clientToken: 'same-pay',
  });
  assert.equal(database.getState().incoming[0].payments.length, 1);
  assert.throws(() => database.addIncomingPayment({
    itemId: item.id, amount: 80000, receivedDate: '2026-10-21', note: '', today, clientToken: 'too-much',
  }), /larger than the amount still to receive/);
  assert.throws(() => database.addIncomingPayment({
    itemId: item.id, amount: 0, receivedDate: '2026-10-21', note: '', today, clientToken: 'zero',
  }), /above zero/);
  assert.throws(() => database.addIncomingPayment({
    itemId: item.id, amount: 1000, receivedDate: '2026-10-23', note: '', today, clientToken: 'future',
  }), /not in the future/);
  const paymentId = database.getState().incoming[0].payments[0].id;
  database.deleteIncomingPayment(paymentId);
  const restored = withIncomingView(database.getState().incoming[0], today);
  assert.equal(restored.received, 0);
  assert.equal(restored.remaining, 100000);
  assert.equal(restored.status, 'pending');
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('overdue totals follow the date, partial balance, and cancellation', () => {
  const items = [
    { id: 1, expectedAmount: 100000, received: 0, expectedDate: '2026-10-21', cancelled: false },
    { id: 2, expectedAmount: 50000, received: 0, expectedDate: '2026-10-22', cancelled: false },
    { id: 3, expectedAmount: 40000, received: 0, expectedDate: null, cancelled: false },
    { id: 4, expectedAmount: 100000, received: 30000, expectedDate: '2026-10-20', cancelled: false },
    { id: 5, expectedAmount: 80000, received: 80000, expectedDate: '2026-10-01', cancelled: false },
    { id: 6, expectedAmount: 90000, received: 10000, expectedDate: '2026-10-19', cancelled: true },
  ].map((item) => withIncomingView(item, today));
  const totals = summarizeIncoming(items);
  assert.equal(totals.stillToReceive, 100000 + 50000 + 40000 + 70000);
  assert.equal(totals.overdue, 100000 + 70000);
  assert.equal(items[1].overdue, false);
  assert.equal(items[2].overdue, false);
  assert.equal(items[4].status, 'received');
  assert.equal(items[5].status, 'cancelled');
  const open = filterIncoming(items, { status: 'open', today });
  assert.deepEqual(open.map((item) => item.id), [4, 1, 2, 3]);
});

test('cancellation keeps payments and reopening restores the unpaid remainder', async () => {
  const { directory, database } = await tempDb();
  database.addIncoming(itemInput({ expectedAmount: 100000, clientToken: 'cancel-me' }));
  const item = database.getState().incoming[0];
  database.addIncomingPayment({
    itemId: item.id, amount: 30000, receivedDate: '2026-10-18', note: 'Kept', today, clientToken: 'kept',
  });
  database.setIncomingCancelled(item.id, true);
  let view = withIncomingView(database.getState().incoming[0], today);
  assert.equal(view.status, 'cancelled');
  assert.equal(view.payments.length, 1);
  assert.equal(summarizeIncoming([view]).stillToReceive, 0);
  assert.throws(() => database.addIncomingPayment({
    itemId: item.id, amount: 1000, receivedDate: '2026-10-22', note: '', today, clientToken: 'blocked',
  }), /Reopen/);
  database.setIncomingCancelled(item.id, false);
  view = withIncomingView(database.getState().incoming[0], today);
  assert.equal(view.status, 'partial');
  assert.equal(summarizeIncoming([view]).stillToReceive, 70000);
  assert.throws(() => database.updateIncoming({
    id: item.id,
    party: item.party,
    description: item.description,
    kind: item.kind,
    expectedAmount: 20000,
    expectedDate: item.expectedDate,
    notes: '',
  }), /cannot be less/);
  database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

test('incoming records survive restart, backup, and migration of an older account', async () => {
  const { directory, file, database } = await tempDb();
  database.addSale({ entryDate: '2026-10-22', description: 'Kept', saleAmount: 100000, directCost: 0 });
  database.addIncoming(itemInput({ party: 'Ada Enterprises', clientToken: 'keep' }));
  const item = database.getState().incoming[0];
  database.addIncomingPayment({
    itemId: item.id, amount: 25000, receivedDate: '2026-10-15', note: 'Part', today, clientToken: 'part',
  });
  const backup = path.join(directory, 'backup.sqlite');
  database.backupTo(backup);
  database.close();

  const reopened = await openDatabase(file);
  assert.equal(reopened.getState().incoming[0].party, 'Ada Enterprises');
  assert.equal(reopened.getState().incoming[0].payments[0].amount, 25000);
  assert.equal(reopened.getState().sales[0].saleAmount, 100000);
  reopened.restoreFrom(backup);
  assert.equal(reopened.getState().incoming.length, 1);

  const older = path.join(directory, 'older.sqlite');
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: () => path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
  });
  const raw = new SQL.Database(fs.readFileSync(file));
  raw.run("UPDATE meta SET value = '3' WHERE key = 'schema'");
  raw.run('DROP TABLE incoming_payments');
  raw.run('DROP TABLE incoming_items');
  fs.writeFileSync(older, Buffer.from(raw.export()));
  raw.close();
  reopened.restoreFrom(older);
  const migrated = reopened.getState();
  assert.equal(migrated.incoming.length, 0);
  assert.equal(migrated.sales.length, 1);
  assert.equal(migrated.sales[0].saleAmount, 100000);
  assert.equal(migrated.categories.length, 14);
  assert.equal(migrated.targets.length, 2);
  reopened.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
