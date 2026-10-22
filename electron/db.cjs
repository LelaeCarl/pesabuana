const fs = require('fs');
const path = require('path');
const { getCurrency } = require('../shared/currencies.cjs');
const { BUILTIN_CATEGORIES, normalizeCategoryName } = require('../shared/categories.cjs');
const { localStamp, todayISO } = require('../shared/dates.cjs');
const { validateIncomingItem, validateIncomingPayment } = require('../shared/incoming.cjs');
const { PRESET_TARGETS } = require('../shared/presets.cjs');
const { parseRate, rateFromText } = require('../shared/rates.cjs');
const {
  validateSale,
  validateExpense,
  validateTarget,
  validateCurrencyCode,
  amountWithinCurrency,
} = require('../shared/validate.cjs');

let SQL = null;

function wasmFile() {
  return path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
}

async function loadSql() {
  if (SQL) return SQL;
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs({
    locateFile: () => wasmFile(),
  });
  return SQL;
}

function openFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  return new SQL.Database(bytes);
}

function writeAtomic(filePath, bytes) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const tmp = path.join(directory, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const handle = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(handle, bytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  if (fs.existsSync(filePath)) {
    const previous = path.join(directory, `.${path.basename(filePath)}.previous`);
    fs.rmSync(previous, { force: true });
    fs.renameSync(filePath, previous);
    try {
      fs.renameSync(tmp, filePath);
      fs.rmSync(previous, { force: true });
    } catch (error) {
      if (!fs.existsSync(filePath) && fs.existsSync(previous)) {
        fs.renameSync(previous, filePath);
      }
      fs.rmSync(tmp, { force: true });
      throw error;
    }
    return;
  }
  fs.renameSync(tmp, filePath);
}

async function openDatabase(filePath) {
  await loadSql();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let database = null;
  let notice = null;
  if (fs.existsSync(filePath)) {
    try {
      database = openFile(filePath);
      const outcome = ensureSchema(database);
      if (outcome === 'migrated') persist(database, filePath);
    } catch (error) {
      if (database) {
        try { database.close(); } catch (closeError) { /* already unusable */ }
      }
      const damaged = `${filePath}.damaged-${Date.now()}`;
      fs.renameSync(filePath, damaged);
      database = new SQL.Database();
      ensureSchema(database);
      notice = 'A damaged data file was set aside. pesabuana started with an empty account.';
      persist(database, filePath);
    }
  } else {
    database = new SQL.Database();
    ensureSchema(database);
    persist(database, filePath);
  }

  return createApi(database, filePath, notice);
}

function createApi(initialDatabase, filePath, initialNotice) {
  let database = initialDatabase;
  let notice = initialNotice;

  function get(sql, params = []) {
    return queryOne(database, sql, params);
  }

  function all(sql, params = []) {
    return queryAll(database, sql, params);
  }

  function persistCurrent() {
    const bytes = Buffer.from(database.export());
    writeAtomic(filePath, bytes);
  }

  function saveAfter(change) {
    const snapshot = Buffer.from(database.export());
    change();
    try {
      persistCurrent();
    } catch (error) {
      database.close();
      database = new SQL.Database(snapshot);
      throw new Error('The records could not be saved. Nothing was changed.');
    }
  }

  function currencyRow() {
    return get('SELECT currency_code FROM settings WHERE id = 1');
  }

  function blockedAccount() {
    if (metaValue(database, 'schema') === '2') return null;
    return foreignAccount(database);
  }

  function requireReady() {
    const blocked = blockedAccount();
    if (blocked) {
      const currency = getCurrency(blocked.code);
      const name = currency ? currency.name : blocked.code;
      throw new Error(`This account uses ${name} and has records. Amounts were not converted to RMB.`);
    }
    const row = currencyRow();
    const currency = row ? getCurrency(row.currency_code) : null;
    if (!currency) throw new Error('Choose a currency first.');
    return currency;
  }

  function checkAmount(minor, currency, label) {
    if (!amountWithinCurrency(minor, currency)) {
      throw new Error(`${label} is too large.`);
    }
  }

  function mapSale(row) {
    return {
      id: row.id,
      entryDate: row.entry_date,
      description: row.description,
      saleAmount: row.sale_amount,
      directCost: row.direct_cost,
    };
  }

function mapExpense(row) {
  return {
    id: row.id,
    entryDate: row.entry_date,
    description: row.description,
    amount: row.amount,
    categoryId: row.category_id == null ? null : row.category_id,
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    archived: Number(row.archived) === 1,
    sortOrder: row.sort_order,
    builtinKey: row.builtin_key || null,
  };
}

  function mapTarget(row) {
    return {
      id: row.id,
      name: row.name || 'Profit target',
      metric: row.metric,
      targetAmount: row.target_amount,
      startDate: row.start_date,
      deadline: row.deadline,
      presetKey: row.preset_key || null,
    };
  }

  function readRates() {
    const rates = { USD: null, KES: null };
    if (!tableNames(database).has('exchange_rates')) return rates;
    for (const row of all('SELECT code, rate_text, updated_at FROM exchange_rates')) {
      if (row.code !== 'USD' && row.code !== 'KES') continue;
      const parsed = rateFromText(row.rate_text);
      if (!parsed) continue;
      rates[row.code] = { text: parsed.text, scale: parsed.scale, units: parsed.units, updatedAt: row.updated_at };
    }
    return rates;
  }

  function getState() {
    const blocked = blockedAccount();
    const row = currencyRow();
    const currency = row ? getCurrency(row.currency_code) : null;
    const sales = all('SELECT * FROM sales ORDER BY entry_date DESC, id DESC').map(mapSale);
    const expenses = all('SELECT * FROM expenses ORDER BY entry_date DESC, id DESC').map(mapExpense);
    const categories = tableNames(database).has('categories')
      ? all('SELECT * FROM categories').map(mapCategory).sort(compareCategories)
      : [];
    const targets = all('SELECT * FROM targets').map(mapTarget)
      .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id - b.id);
    const incoming = readIncoming();
    return {
      currency,
      blocked: blocked ? {
        code: blocked.code,
        name: (getCurrency(blocked.code) || {}).name || blocked.code,
        sales: blocked.sales,
        expenses: blocked.expenses,
        targets: blocked.targets,
      } : null,
      sales,
    expenses,
    categories,
    targets,
      incoming,
      rates: readRates(),
      databaseFile: filePath,
      notice,
    };
  }

  function setCurrency(code) {
    const result = validateCurrencyCode(code);
    if (!result.ok) throw new Error(result.error);
    if (currencyRow()) throw new Error('Currency is already set.');
    saveAfter(() => {
      database.run('INSERT INTO settings (id, currency_code) VALUES (1, ?)', [result.value]);
    });
    return getState();
  }

  function addSale(input) {
    const currency = requireReady();
    const result = validateSale(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.saleAmount, currency, 'Sale amount');
    checkAmount(result.value.directCost, currency, 'Direct cost');
    saveAfter(() => {
      database.run(
        'INSERT INTO sales (entry_date, description, sale_amount, direct_cost) VALUES (?, ?, ?, ?)',
        [result.value.entryDate, result.value.description, result.value.saleAmount, result.value.directCost],
      );
    });
    return getState();
  }

  function updateSale(input) {
    const currency = requireReady();
    if (!input || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error('That sale was not found.');
    }
    if (!get('SELECT id FROM sales WHERE id = ?', [input.id])) {
      throw new Error('That sale was not found.');
    }
    const result = validateSale(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.saleAmount, currency, 'Sale amount');
    checkAmount(result.value.directCost, currency, 'Direct cost');
    saveAfter(() => {
      database.run(
        'UPDATE sales SET entry_date = ?, description = ?, sale_amount = ?, direct_cost = ? WHERE id = ?',
        [result.value.entryDate, result.value.description, result.value.saleAmount, result.value.directCost, input.id],
      );
    });
    return getState();
  }

  function deleteSale(id) {
    requireReady();
    if (!Number.isInteger(id) || !get('SELECT id FROM sales WHERE id = ?', [id])) {
      throw new Error('That sale was not found.');
    }
    saveAfter(() => {
      database.run('DELETE FROM sales WHERE id = ?', [id]);
    });
    return getState();
  }

  function categoryById(id) {
    if (!Number.isInteger(id) || id <= 0) return null;
    return get('SELECT * FROM categories WHERE id = ?', [id]);
  }

  function assignCategory(categoryId, { required, allowArchived }) {
    if (categoryId == null) {
      if (required) throw new Error('Choose a category.');
      return null;
    }
    const row = categoryById(categoryId);
    if (!row) throw new Error('Choose a category.');
    if (Number(row.archived) === 1 && !allowArchived) {
      throw new Error('That category is archived. Choose another category.');
    }
    return row.id;
  }

  function addExpense(input) {
    const currency = requireReady();
    const result = validateExpense(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.amount, currency, 'Expense amount');
    const categoryId = assignCategory(result.value.categoryId, { required: true, allowArchived: false });
    saveAfter(() => {
      database.run(
        'INSERT INTO expenses (entry_date, description, amount, category_id) VALUES (?, ?, ?, ?)',
        [result.value.entryDate, result.value.description, result.value.amount, categoryId],
      );
    });
    return getState();
  }

  function updateExpense(input) {
    const currency = requireReady();
    if (!input || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error('That expense was not found.');
    }
    const existing = get('SELECT id, category_id FROM expenses WHERE id = ?', [input.id]);
    if (!existing) throw new Error('That expense was not found.');
    const result = validateExpense(input, { allowUncategorised: true });
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.amount, currency, 'Expense amount');
    const requested = result.value.categoryId;
    const categoryId = assignCategory(requested, {
      required: false,
      allowArchived: requested != null && requested === existing.category_id,
    });
    saveAfter(() => {
      database.run(
        'UPDATE expenses SET entry_date = ?, description = ?, amount = ?, category_id = ? WHERE id = ?',
        [result.value.entryDate, result.value.description, result.value.amount, categoryId, input.id],
      );
    });
    return getState();
  }

  function addCategory(name) {
    requireReady();
    const parsed = normalizeCategoryName(name);
    if (!parsed.ok) throw new Error(parsed.error);
    const existing = get('SELECT * FROM categories WHERE name_key = ?', [parsed.value.key]);
    if (existing && Number(existing.archived) === 1) {
      return { needsRestore: true, categoryId: existing.id, name: existing.name };
    }
    if (existing) throw new Error('That category already exists.');
    let categoryId = null;
    saveAfter(() => {
      const order = get('SELECT COALESCE(MAX(sort_order), 0) AS n FROM categories');
      database.run(
        'INSERT INTO categories (name, name_key, archived, sort_order, builtin_key) VALUES (?, ?, 0, ?, NULL)',
        [parsed.value.name, parsed.value.key, Number(order.n) + 1],
      );
      categoryId = get('SELECT last_insert_rowid() AS id').id;
    });
    return { state: getState(), categoryId };
  }

  function renameCategory(id, name) {
    requireReady();
    const parsed = normalizeCategoryName(name);
    if (!parsed.ok) throw new Error(parsed.error);
    const current = categoryById(id);
    if (!current) throw new Error('That category is no longer available.');
    const clash = get('SELECT id FROM categories WHERE name_key = ? AND id <> ?', [parsed.value.key, current.id]);
    if (clash) throw new Error('That category already exists.');
    saveAfter(() => {
      database.run(
        'UPDATE categories SET name = ?, name_key = ? WHERE id = ?',
        [parsed.value.name, parsed.value.key, current.id],
      );
    });
    return getState();
  }

  function archiveCategory(id) {
    requireReady();
    const current = categoryById(id);
    if (!current) throw new Error('That category is no longer available.');
    saveAfter(() => {
      database.run('UPDATE categories SET archived = 1 WHERE id = ?', [current.id]);
    });
    return getState();
  }

  function restoreCategory(id) {
    requireReady();
    const current = categoryById(id);
    if (!current) throw new Error('That category is no longer available.');
    saveAfter(() => {
      database.run('UPDATE categories SET archived = 0 WHERE id = ?', [current.id]);
    });
    return getState();
  }

  function deleteExpense(id) {
    requireReady();
    if (!Number.isInteger(id) || !get('SELECT id FROM expenses WHERE id = ?', [id])) {
      throw new Error('That expense was not found.');
    }
    saveAfter(() => {
      database.run('DELETE FROM expenses WHERE id = ?', [id]);
    });
    return getState();
  }

  function addTarget(input) {
    const currency = requireReady();
    const result = validateTarget(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.targetAmount, currency, 'Target amount');
    saveAfter(() => {
      database.run(
        'INSERT INTO targets (name, metric, target_amount, start_date, deadline, preset_key) VALUES (?, ?, ?, ?, ?, NULL)',
        [result.value.name, result.value.metric, result.value.targetAmount, result.value.startDate, result.value.deadline],
      );
    });
    return getState();
  }

  function updateTarget(input) {
    const currency = requireReady();
    if (!input || !Number.isInteger(input.id) || input.id <= 0) {
      throw new Error('That target was not found.');
    }
    if (!get('SELECT id FROM targets WHERE id = ?', [input.id])) {
      throw new Error('That target was not found.');
    }
    const result = validateTarget(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.targetAmount, currency, 'Target amount');
    saveAfter(() => {
      database.run(
        'UPDATE targets SET name = ?, metric = ?, target_amount = ?, start_date = ?, deadline = ? WHERE id = ?',
        [result.value.name, result.value.metric, result.value.targetAmount, result.value.startDate, result.value.deadline, input.id],
      );
    });
    return getState();
  }

  function deleteTarget(id) {
    requireReady();
    if (!Number.isInteger(id) || !get('SELECT id FROM targets WHERE id = ?', [id])) {
      throw new Error('That target was not found.');
    }
    saveAfter(() => {
      database.run('DELETE FROM targets WHERE id = ?', [id]);
    });
    return getState();
  }

  function setRate(code, raw) {
    requireReady();
    if (code !== 'USD' && code !== 'KES') throw new Error('Choose USD or KSh.');
    const parsed = parseRate(typeof raw === 'string' ? raw : '');
    if (!parsed.ok) throw new Error(parsed.error);
    saveAfter(() => {
      database.run('DELETE FROM exchange_rates WHERE code = ?', [code]);
      database.run(
        'INSERT INTO exchange_rates (code, rate_text, updated_at) VALUES (?, ?, ?)',
        [code, parsed.text, localStamp()],
      );
    });
    return getState();
  }

  function clearRate(code) {
    requireReady();
    if (code !== 'USD' && code !== 'KES') throw new Error('Choose USD or KSh.');
    saveAfter(() => {
      database.run('DELETE FROM exchange_rates WHERE code = ?', [code]);
    });
    return getState();
  }

  function readIncoming() {
    if (!tableNames(database).has('incoming_items')) return [];
    const grouped = new Map();
    if (tableNames(database).has('incoming_payments')) {
      for (const payment of all('SELECT * FROM incoming_payments ORDER BY received_date, id')) {
        const list = grouped.get(payment.item_id) || [];
        list.push({
          id: payment.id,
          amount: payment.amount,
          receivedDate: payment.received_date,
          note: payment.note || '',
        });
        grouped.set(payment.item_id, list);
      }
    }
    return all('SELECT * FROM incoming_items ORDER BY id').map((row) => {
      const payments = grouped.get(row.id) || [];
      const received = payments.reduce((sum, payment) => sum + payment.amount, 0);
      return {
        id: row.id,
        party: row.party,
        description: row.description,
        kind: row.kind,
        expectedAmount: row.expected_amount,
        expectedDate: row.expected_date || null,
        notes: row.notes || '',
        createdOn: row.created_on,
        cancelled: Number(row.cancelled) === 1,
        payments,
        received,
      };
    });
  }

  function incomingById(id) {
    if (!Number.isInteger(id) || id <= 0) return null;
    return get('SELECT * FROM incoming_items WHERE id = ?', [id]);
  }

  function receivedTotal(itemId) {
    const row = get('SELECT COALESCE(SUM(amount), 0) AS total FROM incoming_payments WHERE item_id = ?', [itemId]);
    return Number(row.total);
  }

  function addIncoming(input) {
    const currency = requireReady();
    const result = validateIncomingItem(input, { requireToken: true });
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.expectedAmount, currency, 'Amount expected');
    const existing = get('SELECT id FROM incoming_items WHERE client_token = ?', [result.value.clientToken]);
    if (existing) return getState();
    saveAfter(() => {
      database.run(
        `INSERT INTO incoming_items
          (party, description, kind, expected_amount, expected_date, notes, created_on, cancelled, client_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          result.value.party,
          result.value.description,
          result.value.kind,
          result.value.expectedAmount,
          result.value.expectedDate,
          result.value.notes,
          todayISO(),
          result.value.clientToken,
        ],
      );
    });
    return getState();
  }

  function updateIncoming(input) {
    const currency = requireReady();
    const current = incomingById(input && input.id);
    if (!current) throw new Error('That item is no longer in the records.');
    const result = validateIncomingItem(input);
    if (!result.ok) throw new Error(result.error);
    checkAmount(result.value.expectedAmount, currency, 'Amount expected');
    const received = receivedTotal(current.id);
    if (result.value.expectedAmount < received) {
      throw new Error('The expected amount cannot be less than payments already recorded.');
    }
    saveAfter(() => {
      database.run(
        `UPDATE incoming_items
         SET party = ?, description = ?, kind = ?, expected_amount = ?, expected_date = ?, notes = ?
         WHERE id = ?`,
        [
          result.value.party,
          result.value.description,
          result.value.kind,
          result.value.expectedAmount,
          result.value.expectedDate,
          result.value.notes,
          current.id,
        ],
      );
    });
    return getState();
  }

  function addIncomingPayment(input) {
    const currency = requireReady();
    const result = validateIncomingPayment(input);
    if (!result.ok) throw new Error(result.error);
    const current = incomingById(input.itemId);
    if (!current) throw new Error('That item is no longer in the records.');
    if (Number(current.cancelled) === 1) {
      throw new Error('Reopen this item before recording a payment.');
    }
    checkAmount(result.value.amount, currency, 'Payment');
    const duplicate = get('SELECT id FROM incoming_payments WHERE client_token = ?', [result.value.clientToken]);
    if (duplicate) return getState();
    const received = receivedTotal(current.id);
    const left = current.expected_amount - received;
    if (left <= 0) throw new Error('This item is already fully received.');
    if (result.value.amount > left) throw new Error('That payment is larger than the amount still to receive.');
    saveAfter(() => {
      database.run(
        `INSERT INTO incoming_payments (item_id, amount, received_date, note, client_token)
         VALUES (?, ?, ?, ?, ?)`,
        [current.id, result.value.amount, result.value.receivedDate, result.value.note, result.value.clientToken],
      );
    });
    return getState();
  }

  function deleteIncomingPayment(id) {
    requireReady();
    if (!Number.isInteger(id) || !get('SELECT id FROM incoming_payments WHERE id = ?', [id])) {
      throw new Error('That payment was not found.');
    }
    saveAfter(() => {
      database.run('DELETE FROM incoming_payments WHERE id = ?', [id]);
    });
    return getState();
  }

  function setIncomingCancelled(id, cancelled) {
    requireReady();
    const current = incomingById(id);
    if (!current) throw new Error('That item is no longer in the records.');
    saveAfter(() => {
      database.run('UPDATE incoming_items SET cancelled = ? WHERE id = ?', [cancelled ? 1 : 0, current.id]);
    });
    return getState();
  }

  function backupTo(destination) {
    if (path.resolve(destination) === path.resolve(filePath)) {
      throw new Error('Choose a different file for the backup.');
    }
    const bytes = Buffer.from(database.export());
    writeAtomic(destination, bytes);
    return destination;
  }

  function restoreFrom(source) {
    if (path.resolve(source) === path.resolve(filePath)) {
      throw new Error('Choose a backup file.');
    }
    let incoming;
    try {
      incoming = openFile(source);
    } catch (error) {
      throw new Error('That file is not a pesabuana backup.');
    }
    try {
      if (!isPesabuanaFile(incoming)) throw new Error('That file is not a pesabuana backup.');
      const code = readCurrency(incoming);
      if (code && !getCurrency(code)) throw new Error('That file is not a pesabuana backup.');
      const foreign = foreignAccount(incoming);
      if (foreign) {
        const currency = getCurrency(foreign.code);
        const name = currency ? currency.name : foreign.code;
        throw new Error(`This backup uses ${name} and has records. It was not restored, and the amounts were not converted.`);
      }
    } catch (error) {
      try { incoming.close(); } catch (closeError) { /* ignore a damaged file */ }
      if (error.message && error.message.startsWith('This backup uses')) throw error;
      throw new Error('That file is not a pesabuana backup.');
    }
    const outcome = ensureSchema(incoming);
    if (outcome === 'blocked') {
      incoming.close();
      throw new Error('This backup uses another currency and has records. It was not restored.');
    }
    const previous = database;
    database = incoming;
    notice = null;
    try {
      persistCurrent();
    } catch (error) {
      database = previous;
      incoming.close();
      throw error;
    }
    previous.close();
    return getState();
  }

  function close() {
    database.close();
  }

  return {
    getState,
    setCurrency,
    addSale,
    updateSale,
    deleteSale,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    renameCategory,
    archiveCategory,
    restoreCategory,
    addTarget,
    updateTarget,
    deleteTarget,
    setRate,
    clearRate,
    addIncoming,
    updateIncoming,
    addIncomingPayment,
    deleteIncomingPayment,
    setIncomingCancelled,
    backupTo,
    restoreFrom,
    close,
  };
}

function queryOne(database, sql, params = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(params);
    if (!statement.step()) return null;
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function queryAll(database, sql, params = []) {
  const statement = database.prepare(sql);
  const rows = [];
  try {
    statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
  }
  return rows;
}

function tableNames(database) {
  const names = new Set();
  const statement = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'");
  try {
    while (statement.step()) names.add(statement.getAsObject().name);
  } finally {
    statement.free();
  }
  return names;
}

function metaValue(database, key) {
  const row = queryOne(database, 'SELECT value FROM meta WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setMeta(database, key, value) {
  database.run('DELETE FROM meta WHERE key = ?', [key]);
  database.run('INSERT INTO meta (key, value) VALUES (?, ?)', [key, value]);
}

function countRows(database, table) {
  const row = queryOne(database, `SELECT COUNT(*) AS n FROM ${table}`);
  return row ? Number(row.n) : 0;
}

function readCurrency(database) {
  const row = queryOne(database, 'SELECT currency_code FROM settings WHERE id = 1');
  return row ? row.currency_code : null;
}

function foreignAccount(database) {
  const code = readCurrency(database);
  if (!code || code === 'CNY') return null;
  if (!tableNames(database).has('sales')) return null;
  const sales = countRows(database, 'sales');
  const expenses = countRows(database, 'expenses');
  const targets = countRows(database, 'targets');
  if (sales + expenses + targets === 0) return null;
  return { code, sales, expenses, targets };
}

function columnNames(database, table) {
  return queryAll(database, `PRAGMA table_info(${table})`).map((row) => row.name);
}

function seedCategories(database) {
  if (metaValue(database, 'categories_seeded') === '1') return;
  database.run('BEGIN');
  try {
    BUILTIN_CATEGORIES.forEach((item, index) => {
      const existing = queryOne(database, 'SELECT id FROM categories WHERE builtin_key = ?', [item.key]);
      if (existing) return;
      database.run(
        'INSERT INTO categories (name, name_key, archived, sort_order, builtin_key) VALUES (?, ?, 0, ?, ?)',
        [item.name, item.name.toLowerCase(), index + 1, item.key],
      );
    });
    setMeta(database, 'categories_seeded', '1');
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (rollbackError) { console.error(rollbackError); }
    throw error;
  }
}

function migrateCategories(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      builtin_key TEXT UNIQUE
    );
  `);
  if (!columnNames(database, 'expenses').includes('category_id')) {
    database.exec('ALTER TABLE expenses ADD COLUMN category_id INTEGER');
  }
  seedCategories(database);
  setMeta(database, 'schema', '3');
}

function compareCategories(left, right) {
  const leftOther = left.builtinKey === 'other' ? 1 : 0;
  const rightOther = right.builtinKey === 'other' ? 1 : 0;
  if (leftOther !== rightOther) return leftOther - rightOther;
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.id - right.id;
}

function columnNames(database, table) {
  return queryAll(database, `PRAGMA table_info(${table})`).map((row) => row.name);
}

function seedCategories(database) {
  if (metaValue(database, 'categories_seeded') === '1') return;
  database.run('BEGIN');
  try {
    BUILTIN_CATEGORIES.forEach((item, index) => {
      const existing = queryOne(database, 'SELECT id FROM categories WHERE builtin_key = ?', [item.key]);
      if (existing) return;
      database.run(
        'INSERT INTO categories (name, name_key, archived, sort_order, builtin_key) VALUES (?, ?, 0, ?, ?)',
        [item.name, item.name.toLowerCase(), index + 1, item.key],
      );
    });
    setMeta(database, 'categories_seeded', '1');
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (rollbackError) { /* already closed */ }
    throw error;
  }
}

function migrateCategories(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL,
      builtin_key TEXT UNIQUE
    );
  `);
  if (!columnNames(database, 'expenses').includes('category_id')) {
    database.exec('ALTER TABLE expenses ADD COLUMN category_id INTEGER');
  }
  seedCategories(database);
  setMeta(database, 'schema', '3');
}

function migrateIncoming(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS incoming_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party TEXT NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL,
      expected_amount INTEGER NOT NULL,
      expected_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_on TEXT NOT NULL,
      cancelled INTEGER NOT NULL DEFAULT 0,
      client_token TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS incoming_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      received_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      client_token TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_incoming_payments_item ON incoming_payments(item_id);
  `);
  setMeta(database, 'schema', '4');
}

function seedPresets(database) {
  if (metaValue(database, 'presets_seeded') === '1') return;
  database.run('BEGIN');
  try {
    for (const preset of PRESET_TARGETS) {
      database.run(
        'INSERT INTO targets (name, metric, target_amount, start_date, deadline, preset_key) VALUES (?, ?, ?, ?, ?, ?)',
        [preset.name, preset.metric, preset.amount, preset.startDate, preset.deadline, preset.key],
      );
    }
    setMeta(database, 'presets_seeded', '1');
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (rollbackError) { /* already closed */ }
    throw error;
  }
}

const V2_TABLES = `
  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    currency_code TEXT NOT NULL
  );
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
    amount INTEGER NOT NULL,
    category_id INTEGER
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    builtin_key TEXT UNIQUE
  );
  CREATE TABLE targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    target_amount INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    deadline TEXT NOT NULL,
    preset_key TEXT UNIQUE
  );
  CREATE TABLE exchange_rates (
    code TEXT PRIMARY KEY,
    rate_text TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_sales_date ON sales(entry_date);
  CREATE INDEX idx_expenses_date ON expenses(entry_date);
  CREATE TABLE incoming_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    expected_amount INTEGER NOT NULL,
    expected_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_on TEXT NOT NULL,
    cancelled INTEGER NOT NULL DEFAULT 0,
    client_token TEXT UNIQUE
  );
  CREATE TABLE incoming_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    received_date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    client_token TEXT UNIQUE
  );
  CREATE INDEX idx_incoming_payments_item ON incoming_payments(item_id);
`;

function createFresh(database) {
  database.exec(V2_TABLES);
  setMeta(database, 'schema', '4');
  database.run("INSERT INTO settings (id, currency_code) VALUES (1, 'CNY')");
  seedPresets(database);
  seedCategories(database);
}

function migrateV1(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      code TEXT PRIMARY KEY,
      rate_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE targets_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      metric TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      deadline TEXT NOT NULL,
      preset_key TEXT UNIQUE
    );
  `);
  const existing = queryAll(database, 'SELECT metric, target_amount, start_date, deadline FROM targets');
  for (const row of existing) {
    database.run(
      'INSERT INTO targets_v2 (name, metric, target_amount, start_date, deadline, preset_key) VALUES (?, ?, ?, ?, ?, NULL)',
      ['Profit target', row.metric, row.target_amount, row.start_date, row.deadline],
    );
  }
  database.exec('DROP TABLE targets; ALTER TABLE targets_v2 RENAME TO targets;');
  database.exec('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(entry_date);');
  database.exec('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(entry_date);');
  if (readCurrency(database) !== 'CNY') {
    database.run('DELETE FROM settings');
    database.run("INSERT INTO settings (id, currency_code) VALUES (1, 'CNY')");
  }
  seedPresets(database);
  setMeta(database, 'schema', '2');
}

function ensureSchema(database) {
  const names = tableNames(database);
  if (!names.has('meta')) {
    createFresh(database);
    return 'created';
  }
  const version = metaValue(database, 'schema');
  if (version === '4') return 'ready';
  if (version === '3') {
    if (metaValue(database, 'categories_seeded') !== '1') seedCategories(database);
    migrateIncoming(database);
    return 'migrated';
  }
  if (version === '2') {
    migrateCategories(database);
    migrateIncoming(database);
    return 'migrated';
  }
  if (version === '1') {
    if (foreignAccount(database)) return 'blocked';
    migrateV1(database);
    migrateCategories(database);
    migrateIncoming(database);
    return 'migrated';
  }
  throw new Error('This data file uses an unknown version.');
}

function isPesabuanaFile(database) {
  let statement;
  try {
    const names = tableNames(database);
    for (const required of ['meta', 'settings', 'sales', 'expenses', 'targets']) {
      if (!names.has(required)) return false;
    }
    statement = database.prepare("SELECT value FROM meta WHERE key = 'schema'");
    if (!statement.step()) return false;
    const value = statement.getAsObject().value;
    return value === '1' || value === '2' || value === '3' || value === '4';
  } catch (error) {
    return false;
  } finally {
    if (statement) {
      try { statement.free(); } catch (error) { /* ignore a damaged file */ }
    }
  }
}

function persist(database, filePath) {
  writeAtomic(filePath, Buffer.from(database.export()));
}

module.exports = { openDatabase };
