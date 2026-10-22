const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pesabuana', {
  getState: () => ipcRenderer.invoke('get-state'),
  addSale: (input) => ipcRenderer.invoke('add-sale', input),
  updateSale: (input) => ipcRenderer.invoke('update-sale', input),
  deleteSale: (id) => ipcRenderer.invoke('delete-sale', id),
  addExpense: (input) => ipcRenderer.invoke('add-expense', input),
  updateExpense: (input) => ipcRenderer.invoke('update-expense', input),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  addCategory: (name) => ipcRenderer.invoke('add-category', name),
  renameCategory: (id, name) => ipcRenderer.invoke('rename-category', { id, name }),
  archiveCategory: (id) => ipcRenderer.invoke('archive-category', id),
  restoreCategory: (id) => ipcRenderer.invoke('restore-category', id),
  addTarget: (input) => ipcRenderer.invoke('add-target', input),
  updateTarget: (input) => ipcRenderer.invoke('update-target', input),
  deleteTarget: (id) => ipcRenderer.invoke('delete-target', id),
  setRate: (code, rate) => ipcRenderer.invoke('set-rate', { code, rate }),
  clearRate: (code) => ipcRenderer.invoke('clear-rate', code),
  addIncoming: (input) => ipcRenderer.invoke('add-incoming', input),
  updateIncoming: (input) => ipcRenderer.invoke('update-incoming', input),
  addIncomingPayment: (input) => ipcRenderer.invoke('add-incoming-payment', input),
  deleteIncomingPayment: (id) => ipcRenderer.invoke('delete-incoming-payment', id),
  setIncomingCancelled: (id, cancelled) => ipcRenderer.invoke('set-incoming-cancelled', { id, cancelled }),
  pickBackup: () => ipcRenderer.invoke('pick-backup'),
  writeBackup: (filePath) => ipcRenderer.invoke('write-backup', filePath),
  pickRestore: () => ipcRenderer.invoke('pick-restore'),
  restoreBackup: (filePath) => ipcRenderer.invoke('restore-backup', filePath),
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('menu-action', listener);
    return () => ipcRenderer.removeListener('menu-action', listener);
  },
});
