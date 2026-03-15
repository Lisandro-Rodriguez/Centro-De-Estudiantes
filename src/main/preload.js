const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize:     () => ipcRenderer.send('window:minimize'),
  maximize:     () => ipcRenderer.send('window:maximize'),
  close:        () => ipcRenderer.send('window:close'),

  // DB básico
  query:  (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  run:    (sql, params) => ipcRenderer.invoke('db:run',   { sql, params }),
  get:    (sql, params) => ipcRenderer.invoke('db:get',   { sql, params }),

  // Turno
  iniciarTurno: (data)   => ipcRenderer.invoke('turno:iniciar', data),
  cerrarTurno:  (data)   => ipcRenderer.invoke('turno:cerrar',  data),

  // FIX: handlers atómicos para préstamos (evitan race conditions de stock)
  registrarPrestamo: (data) => ipcRenderer.invoke('prestamo:registrar', data),
  devolverPrestamo:  (data) => ipcRenderer.invoke('prestamo:devolver',  data),

  // Config
  getConfig: (key)          => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value)   => ipcRenderer.invoke('config:set', { key, value }),

  // PIN — verificación en proceso principal, nunca se expone el valor real
  verificarPin:  (pin)                    => ipcRenderer.invoke('pin:verificar', pin),
  cambiarPin:    (pinActual, pinNuevo)     => ipcRenderer.invoke('pin:cambiar', { pinActual, pinNuevo }),

  // Backup
  crearBackup:  ()  => ipcRenderer.invoke('backup:crear'),
  listarBackups: () => ipcRenderer.invoke('backup:listar'),

  // Exports
  exportPDF:   (data) => ipcRenderer.invoke('pdf:export',   data),
  exportExcel: (data) => ipcRenderer.invoke('excel:export', data),

  // Actualizaciones
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('update:install'),
});
