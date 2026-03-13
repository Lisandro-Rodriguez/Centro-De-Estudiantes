const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // DB operations
  query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  run: (sql, params) => ipcRenderer.invoke('db:run', { sql, params }),
  get: (sql, params) => ipcRenderer.invoke('db:get', { sql, params }),

  // Turno operations
  iniciarTurno: (data) => ipcRenderer.invoke('turno:iniciar', data),
  cerrarTurno: (data) => ipcRenderer.invoke('turno:cerrar', data),

  // Config
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', { key, value }),

  // Updates
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('update:install'),
  exportPdf:   (opts) => ipcRenderer.invoke('pdf:export', opts),
  exportExcel: (opts) => ipcRenderer.invoke('excel:export', opts),
});
