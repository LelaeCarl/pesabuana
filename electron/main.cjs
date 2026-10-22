const { app, BrowserWindow, Menu, dialog, ipcMain, session } = require('electron');
const path = require('path');
const { openDatabase } = require('./db.cjs');
const { todayISO } = require('../shared/dates.cjs');

const dataDirectory = process.env.PESABUANA_DATA_DIR
  || path.join(app.getPath('appData'), 'pesabuana');

app.setName('pesabuana');
app.setPath('userData', dataDirectory);

const databaseFile = path.join(dataDirectory, 'pesabuana.sqlite');
let database = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.whenReady().then(start).catch((error) => {
    console.error(error);
    app.quit();
  });
}

async function start() {
  try {
    database = await openDatabase(databaseFile);
  } catch (error) {
    console.error(error);
    dialog.showErrorBox(
      'pesabuana',
      `The records could not be opened.\n\nData folder:\n${dataDirectory}`,
    );
    app.quit();
    return;
  }

  const isPackaged = app.isPackaged;
  if (isPackaged) {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        console.error(`Blocked a network request: ${details.url}`);
        callback({ cancel: true });
      },
    );
  }

  registerHandlers();
  createWindow();
  installMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: '#f3f5f4',
    title: 'pesabuana',
    icon: path.join(__dirname, '../build/icon.ico'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  if (!app.isPackaged && process.env.PESABUANA_DEV_SERVER === '1') {
    window.loadURL('http://localhost:5173');
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function broadcast(action) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('menu-action', action);
  }
}

function installMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Back up data', click: () => broadcast('backup') },
        { label: 'Restore backup', click: () => broadcast('restore') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Overview', click: () => broadcast('overview') },
        { label: 'Entries', click: () => broadcast('entries') },
        { label: 'Targets', click: () => broadcast('targets') },
        { label: 'Settings', click: () => broadcast('settings') },
      ],
    },
  ];
  if (!app.isPackaged) {
    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      return await fn(event, payload);
    } catch (error) {
      return { error: error.message || 'Something went wrong.' };
    }
  });
}

function registerHandlers() {
  handle('get-state', () => ({ state: database.getState() }));
  handle('set-currency', (_event, code) => ({ state: database.setCurrency(code) }));
  handle('add-sale', (_event, input) => ({ state: database.addSale(input) }));
  handle('update-sale', (_event, input) => ({ state: database.updateSale(input) }));
  handle('delete-sale', (_event, id) => ({ state: database.deleteSale(id) }));
  handle('add-expense', (_event, input) => ({ state: database.addExpense(input) }));
  handle('update-expense', (_event, input) => ({ state: database.updateExpense(input) }));
  handle('delete-expense', (_event, id) => ({ state: database.deleteExpense(id) }));
  handle('add-category', (_event, name) => {
    const result = database.addCategory(name);
    if (result.needsRestore) return result;
    return { state: result.state, categoryId: result.categoryId };
  });
  handle('rename-category', (_event, input) => ({ state: database.renameCategory(input && input.id, input && input.name) }));
  handle('archive-category', (_event, id) => ({ state: database.archiveCategory(id) }));
  handle('restore-category', (_event, id) => ({ state: database.restoreCategory(id) }));
  handle('add-target', (_event, input) => ({ state: database.addTarget(input) }));
  handle('update-target', (_event, input) => ({ state: database.updateTarget(input) }));
  handle('delete-target', (_event, id) => ({ state: database.deleteTarget(id) }));
  handle('set-rate', (_event, input) => ({ state: database.setRate(input && input.code, input && input.rate) }));
  handle('clear-rate', (_event, code) => ({ state: database.clearRate(code) }));

  handle('pick-backup', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(window, {
      title: 'Save backup',
      defaultPath: path.join(app.getPath('documents'), `pesabuana-backup-${todayISO()}.sqlite`),
      filters: [
        { name: 'pesabuana backup', extensions: ['sqlite'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    return { filePath: result.filePath };
  });

  handle('write-backup', (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) {
      throw new Error('Choose a place to save the backup.');
    }
    const saved = database.backupTo(filePath);
    return { filePath: saved };
  });

  handle('pick-restore', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose a backup',
      properties: ['openFile'],
      filters: [
        { name: 'pesabuana backup', extensions: ['sqlite'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    return { filePath: result.filePaths[0] };
  });

  handle('restore-backup', (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) {
      throw new Error('Choose a backup file.');
    }
    return { state: database.restoreFrom(filePath) };
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (database) {
    try { database.close(); } catch (error) { console.error(error); }
    database = null;
  }
});
