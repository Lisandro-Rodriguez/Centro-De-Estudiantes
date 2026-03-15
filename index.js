const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const initSqlJs = require('sql.js');

// ─── Paths ────────────────────────────────────────────────────────────────────
const isDev = process.argv.includes('--dev');
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'centro.db');

let mainWindow;
let db;
let saveTimer;

// ─── Persist DB to disk (debounced) ──────────────────────────────────────────
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!db) return;
    try {
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (e) {
      console.error('DB save error:', e);
    }
  }, 300);
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => mainWindow?.webContents.send('update:available', info));
  autoUpdater.on('update-downloaded', (info) => mainWindow?.webContents.send('update:downloaded', info));
  autoUpdater.on('error', (err) => console.error('Updater error:', err));
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
}

ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    backgroundColor: '#0f1117',
    show: false,
  });

  mainWindow.loadFile(path.join(app.getAppPath(), 'src/renderer/index.html'));
    mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });
}

// ─── Database Setup ───────────────────────────────────────────────────────────
async function setupDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS personal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, apellido TEXT NOT NULL, dni TEXT UNIQUE,
      rol TEXT NOT NULL CHECK(rol IN ('becario','presidente','vocal')),
      email TEXT, telefono TEXT, horas_requeridas REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS alumnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, apellido TEXT NOT NULL, dni TEXT UNIQUE,
      carrera TEXT, email TEXT, telefono TEXT, activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL, hora_inicio TEXT NOT NULL, hora_fin TEXT, notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS turno_personal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
      personal_id INTEGER NOT NULL REFERENCES personal(id),
      hora_entrada TEXT, hora_salida TEXT, horas_cumplidas REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS agenda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL, hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL,
      personal_id INTEGER REFERENCES personal(id),
      personal_id2 INTEGER REFERENCES personal(id),
      notas TEXT, estado TEXT DEFAULT 'programado'
    );
    CREATE TABLE IF NOT EXISTS materiales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, descripcion TEXT,
      cantidad_total INTEGER DEFAULT 1, cantidad_disponible INTEGER DEFAULT 1,
      categoria TEXT DEFAULT 'estudio'
    );
    CREATE TABLE IF NOT EXISTS prestamos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumno_id INTEGER REFERENCES alumnos(id), alumno_nombre TEXT,
      material_id INTEGER REFERENCES materiales(id),
      turno_id INTEGER REFERENCES turnos(id),
      fecha_prestamo TEXT DEFAULT (datetime('now','localtime')),
      fecha_devolucion TEXT, estado TEXT DEFAULT 'prestado', notas TEXT
    );
    CREATE TABLE IF NOT EXISTS registro_pan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumno_id INTEGER REFERENCES alumnos(id), alumno_nombre TEXT NOT NULL,
      fecha TEXT DEFAULT (date('now','localtime')),
      tipo TEXT NOT NULL CHECK(tipo IN ('desayuno','merienda')),
      turno_id INTEGER REFERENCES turnos(id)
    );
    CREATE TABLE IF NOT EXISTS registro_hojas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumno_id INTEGER REFERENCES alumnos(id), alumno_nombre TEXT NOT NULL,
      fecha TEXT DEFAULT (date('now','localtime')),
      cantidad INTEGER NOT NULL, pagas INTEGER DEFAULT 0,
      precio_por_hoja REAL DEFAULT 0, monto_total REAL DEFAULT 0,
      turno_id INTEGER REFERENCES turnos(id)
    );
    CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    INSERT OR IGNORE INTO configuracion VALUES ('hojas_gratis','3');
    INSERT OR IGNORE INTO configuracion VALUES ('hojas_max','7');
    INSERT OR IGNORE INTO configuracion VALUES ('precio_hoja','0');
    INSERT OR IGNORE INTO configuracion VALUES ('nombre_centro','Centro de Estudiantes');
  `);

  saveDb();
}

// ─── sql.js helpers ───────────────────────────────────────────────────────────
function sqlAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function sqlGet(sql, params = []) {
  const r = sqlAll(sql, params);
  return r.ok ? { ok: true, data: r.data[0] || null } : r;
}

function sqlRun(sql, params = []) {
  try {
    db.run(sql, params);
    const li = db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = li.length ? li[0].values[0][0] : null;
    saveDb();
    return { ok: true, lastInsertRowid };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window:close',   () => mainWindow?.close());

ipcMain.handle('db:query', (_, { sql, params = [] }) => sqlAll(sql, params));
ipcMain.handle('db:run',   (_, { sql, params = [] }) => sqlRun(sql, params));
ipcMain.handle('db:get',   (_, { sql, params = [] }) => sqlGet(sql, params));

ipcMain.handle('turno:iniciar', (_, { fecha, hora_inicio, personal_ids, notas }) => {
  try {
    db.run(`INSERT INTO turnos (fecha,hora_inicio,notas) VALUES (?,?,?)`, [fecha, hora_inicio, notas || '']);
    const turnoId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    for (const pid of personal_ids) {
      db.run(`INSERT INTO turno_personal (turno_id,personal_id,hora_entrada) VALUES (?,?,?)`, [turnoId, pid, hora_inicio]);
    }
    saveDb();
    return { ok: true, turnoId };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('turno:cerrar', (_, { turnoId, hora_fin }) => {
  try {
    db.run(`UPDATE turnos SET hora_fin=? WHERE id=?`, [hora_fin, turnoId]);
    const turno = sqlGet(`SELECT * FROM turnos WHERE id=?`, [turnoId]).data;
    const personal = sqlAll(`SELECT * FROM turno_personal WHERE turno_id=?`, [turnoId]).data;
    for (const tp of personal) {
      const entrada = tp.hora_entrada || turno.hora_inicio;
      const [hE, mE] = String(entrada).split(':').map(Number);
      const [hS, mS] = hora_fin.split(':').map(Number);
      const horas = Math.max(0, ((hS * 60 + mS) - (hE * 60 + mE)) / 60);
      db.run(`UPDATE turno_personal SET hora_salida=?,horas_cumplidas=? WHERE id=?`, [hora_fin, horas, tp.id]);
      db.run(`UPDATE personal SET horas_requeridas=horas_requeridas-? WHERE id=?`, [horas, tp.personal_id]);
    }
    saveDb();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('config:get', (_, key) => {
  const r = sqlGet(`SELECT valor FROM configuracion WHERE clave=?`, [key]);
  return r.data ? r.data.valor : null;
});
ipcMain.handle('config:set', (_, { key, value }) => {
  sqlRun(`INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)`, [key, value]);
  return { ok: true };
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await setupDatabase();
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => {
  saveDb();
  if (process.platform !== 'darwin') app.quit();
});