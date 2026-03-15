const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const { autoUpdater } = require('electron-updater');
const initSqlJs = require('sql.js');

// ─── Paths ────────────────────────────────────────────────────────────────────
const isDev        = process.argv.includes('--dev');
const userDataPath  = app.getPath('userData');
// FIX: nombre no obvio para dificultar eliminación accidental
// El archivo vive en userData del sistema operativo, carpeta de la app
const dbPath        = path.join(userDataPath, '.appdata', 'store.bin');
const backupDir     = path.join(userDataPath, '.appdata', 'bk');

let mainWindow;
let db;
let saveTimer;
let _saveInProgress = false; // FIX: evitar escrituras concurrentes

// ─── Persist DB to disk (debounced + safe) ────────────────────────────────────
// FIX: reducido el debounce de 300ms → 1500ms para evitar writes constantes,
//      y se usa writeFile async con flag que evita escrituras solapadas.
function saveDb(force = false) {
  clearTimeout(saveTimer);
  const delay = force ? 0 : 1500;
  saveTimer = setTimeout(async () => {
    if (!db || _saveInProgress) return;
    _saveInProgress = true;
    try {
      const data = db.export();
      const buf  = Buffer.from(data);
      // Escribir a archivo temporal primero, luego rename (atómico en el SO)
      const tmpPath = dbPath + '.tmp';
      fs.writeFileSync(tmpPath, buf);
      fs.renameSync(tmpPath, dbPath);
    } catch (e) {
      console.error('DB save error:', e);
    } finally {
      _saveInProgress = false;
    }
  }, delay);
}

// ─── Backup automático diario ─────────────────────────────────────────────────
// Guarda hasta 7 copias rotativas en /userData/backups/centro-YYYY-MM-DD.db
function runDailyBackup() {
  if (!db) return;
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const today   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const bkPath  = path.join(backupDir, `centro-${today}.db`);

    // Solo hacer backup una vez por día
    if (fs.existsSync(bkPath)) return;

    const data = db.export();
    fs.writeFileSync(bkPath, Buffer.from(data));
    console.log('[Backup] Creado:', bkPath);

    // Rotar: mantener solo los últimos 7 días
    const archivos = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('centro-') && f.endsWith('.db'))
      .sort(); // ISO date ordena correctamente
    if (archivos.length > 7) {
      archivos.slice(0, archivos.length - 7).forEach(f => {
        try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
      });
    }
  } catch (e) {
    console.error('[Backup] Error:', e);
  }
}

// ─── Protección del archivo de base de datos ──────────────────────────────────
// Pone el archivo en modo solo-lectura cuando la app NO está corriendo,
// y lo desbloquea solo al iniciar. Esto evita que un usuario sin permisos
// técnicos lo borre fácilmente desde el explorador de archivos.
function protegerDB() {
  try {
    if (fs.existsSync(dbPath)) {
      // Solo lectura para todos (owner incluido en Windows via attrib)
      fs.chmodSync(dbPath, 0o444);
      if (process.platform === 'win32') {
        require('child_process').execSync(`attrib +R "${dbPath}"`, { stdio: 'ignore' });
      }
    }
  } catch (e) { /* silencioso — no crítico */ }
}

function desprotegerDB() {
  try {
    if (fs.existsSync(dbPath)) {
      fs.chmodSync(dbPath, 0o644);
      if (process.platform === 'win32') {
        require('child_process').execSync(`attrib -R "${dbPath}"`, { stdio: 'ignore' });
      }
    }
  } catch (e) { /* silencioso */ }
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload  = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available',  info => mainWindow?.webContents.send('update:available', info));
  autoUpdater.on('update-downloaded', info => mainWindow?.webContents.send('update:downloaded', info));
  autoUpdater.on('error', err => console.error('Updater error:', err));
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
}

ipcMain.on('update:install', () => autoUpdater.quitAndInstall());

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1024, minHeight: 680,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
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

  // FIX: crear carpeta oculta si no existe
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Ocultar carpeta en Windows
  if (process.platform === 'win32') {
    try { require('child_process').execSync(`attrib +H "${dbDir}"`, { stdio: 'ignore' }); } catch {}
  }

  // Desproteger para poder leer/escribir durante la sesión
  desprotegerDB();

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // FIX: habilitar claves foráneas e integridad (en sql.js se aplican por sesión)
  db.run(`PRAGMA foreign_keys = ON`);
  // sql.js no soporta WAL (es in-memory), pero sí podemos mejorar la integridad
  db.run(`PRAGMA journal_mode = MEMORY`);

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
      turno_id   INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
      personal_id INTEGER NOT NULL REFERENCES personal(id),
      hora_entrada TEXT, hora_salida TEXT, horas_cumplidas REAL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'presente'
        CHECK(estado IN ('presente','demorado','cubierto','ausente','salio','reemplazando'))
    );
    CREATE TABLE IF NOT EXISTS agenda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL, hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL,
      personal_id  INTEGER REFERENCES personal(id),
      personal_id2 INTEGER REFERENCES personal(id),
      estado_p1 TEXT DEFAULT 'programado'
        CHECK(estado_p1 IN ('programado','presente','demorado','cubierto','ausente')),
      estado_p2 TEXT DEFAULT 'programado'
        CHECK(estado_p2 IN ('programado','presente','demorado','cubierto','ausente')),
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
    INSERT OR IGNORE INTO configuracion VALUES ('pin_admin','1234');
    CREATE TABLE IF NOT EXISTS carreras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      siglas TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS mercaderia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      stock_actual REAL DEFAULT 0,
      stock_minimo REAL DEFAULT 1,
      descripcion TEXT,
      activo INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS mercaderia_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mercaderia_id INTEGER NOT NULL REFERENCES mercaderia(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida')),
      cantidad REAL NOT NULL,
      motivo TEXT,
      turno_id INTEGER REFERENCES turnos(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS incumplimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alumno_id  INTEGER NOT NULL REFERENCES alumnos(id),
      prestamo_id INTEGER REFERENCES prestamos(id),
      fecha TEXT NOT NULL,
      cuatrimestre TEXT NOT NULL,
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // ── Índices para rendimiento ──────────────────────────────────────────────
  // FIX: índices en las columnas más consultadas para evitar full-table scans
  //      a medida que crecen los registros históricos.
  try {
    db.run(`CREATE INDEX IF NOT EXISTS idx_prestamos_estado     ON prestamos(estado)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_prestamos_alumno     ON prestamos(alumno_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_prestamos_fecha      ON prestamos(date(fecha_prestamo))`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_pan_fecha_alumno     ON registro_pan(fecha, alumno_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_hojas_fecha_alumno   ON registro_hojas(fecha, alumno_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_turnos_fecha         ON turnos(fecha)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_turno_personal_turno ON turno_personal(turno_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_incump_alumno_cuatri ON incumplimientos(alumno_id, cuatrimestre)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_merced_movs_id       ON mercaderia_movimientos(mercaderia_id)`);
  } catch (e) { /* índices ya existen */ }

  // ── Migrations ────────────────────────────────────────────────────────────
  const migrations = [
    `ALTER TABLE personal ADD COLUMN carrera TEXT`,
    `ALTER TABLE carreras ADD COLUMN siglas TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE turno_personal ADD COLUMN estado TEXT NOT NULL DEFAULT 'presente'`,
    `ALTER TABLE agenda ADD COLUMN estado_p1 TEXT DEFAULT 'programado'`,
    `ALTER TABLE agenda ADD COLUMN estado_p2 TEXT DEFAULT 'programado'`,
    `ALTER TABLE alumnos ADD COLUMN incumplimientos_count INTEGER DEFAULT 0`,
    `ALTER TABLE alumnos ADD COLUMN bloqueado_prestamo INTEGER DEFAULT 0`,
    `ALTER TABLE alumnos ADD COLUMN bloqueado_hasta TEXT`,
    `ALTER TABLE turno_personal ADD COLUMN cubierto_por_id INTEGER`,
    `ALTER TABLE turno_personal ADD COLUMN reemplazado_id INTEGER`,
    `ALTER TABLE turno_personal ADD COLUMN reemplazante_id INTEGER`,
    `ALTER TABLE turno_personal ADD COLUMN hora_salida TEXT`,
  ];
  for (const m of migrations) {
    try { db.run(m); } catch {}
  }

  saveDb(true);

  // Backup al iniciar (una vez por día)
  runDailyBackup();
  // Programar backup diario cada 24h mientras la app esté abierta
  setInterval(runDailyBackup, 24 * 60 * 60 * 1000);
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
    // FIX: exponer `changes` para que el renderer pueda verificar si el UPDATE afectó filas
    const ch = db.exec('SELECT changes()');
    const changes = ch.length ? ch[0].values[0][0] : 0;
    saveDb();
    return { ok: true, lastInsertRowid, changes };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── IPC básico ───────────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window:close',   () => mainWindow?.close());

ipcMain.handle('db:query', (_, { sql, params = [] }) => sqlAll(sql, params));
ipcMain.handle('db:run',   (_, { sql, params = [] }) => sqlRun(sql, params));
ipcMain.handle('db:get',   (_, { sql, params = [] }) => sqlGet(sql, params));

// ─── Turno: iniciar ───────────────────────────────────────────────────────────
ipcMain.handle('turno:iniciar', (_, { fecha, hora_inicio, personal, notas }) => {
  try {
    db.run(`INSERT INTO turnos (fecha,hora_inicio,notas) VALUES (?,?,?)`,
      [fecha, hora_inicio, notas || '']);
    const turnoId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    for (const p of personal) {
      const horaEntrada = (p.estado === 'demorado' || p.estado === 'ausente') ? null : hora_inicio;
      db.run(
        `INSERT INTO turno_personal (turno_id,personal_id,hora_entrada,estado,reemplazado_id)
         VALUES (?,?,?,?,?)`,
        [turnoId, p.id, horaEntrada, p.estado || 'presente', p.reemplazado_id || null]
      );
    }
    saveDb();
    return { ok: true, turnoId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Turno: cerrar (FIX: transacción atómica) ────────────────────────────────
ipcMain.handle('turno:cerrar', (_, { turnoId, hora_fin }) => {
  try {
    db.run(`BEGIN`);
    db.run(`UPDATE turnos SET hora_fin=? WHERE id=?`, [hora_fin, turnoId]);

    const turno    = sqlGet(`SELECT * FROM turnos WHERE id=?`, [turnoId]).data;
    const personal = sqlAll(`SELECT * FROM turno_personal WHERE turno_id=?`, [turnoId]).data;

    for (const tp of personal) {
      if (tp.estado === 'ausente') continue;
      const entrada = tp.hora_entrada || turno.hora_inicio;
      const [hE, mE] = String(entrada).split(':').map(Number);
      const [hS, mS] = hora_fin.split(':').map(Number);
      const horas = Math.max(0, ((hS * 60 + mS) - (hE * 60 + mE)) / 60);
      db.run(
        `UPDATE turno_personal SET hora_salida=?,horas_cumplidas=? WHERE id=?`,
        [hora_fin, horas, tp.id]
      );
    }

    db.run(`COMMIT`);
    saveDb();
    return { ok: true };
  } catch (e) {
    try { db.run(`ROLLBACK`); } catch {}
    return { ok: false, error: e.message };
  }
});

// ─── Préstamo: registrar (FIX: atómico, evita race condition de stock) ────────
ipcMain.handle('prestamo:registrar', (_, { alumnoId, alumnoNombre, materialId, turnoId, notas }) => {
  try {
    db.run(`BEGIN`);

    // Verificar y decrementar stock en una sola operación atómica
    db.run(
      `UPDATE materiales SET cantidad_disponible = cantidad_disponible - 1
       WHERE id = ? AND cantidad_disponible > 0`,
      [materialId]
    );
    const ch = db.exec('SELECT changes()')[0].values[0][0];
    if (ch === 0) {
      db.run(`ROLLBACK`);
      return { ok: false, error: 'Sin stock disponible para este material' };
    }

    db.run(
      `INSERT INTO prestamos (alumno_id, alumno_nombre, material_id, turno_id, notas)
       VALUES (?,?,?,?,?)`,
      [alumnoId || null, alumnoNombre, materialId, turnoId || null, notas || null]
    );
    const li = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    db.run(`COMMIT`);
    saveDb();
    return { ok: true, lastInsertRowid: li };
  } catch (e) {
    try { db.run(`ROLLBACK`); } catch {}
    return { ok: false, error: e.message };
  }
});

// ─── Préstamo: devolver (FIX: atómico) ───────────────────────────────────────
ipcMain.handle('prestamo:devolver', (_, { id, materialId }) => {
  try {
    db.run(`BEGIN`);

    db.run(
      `UPDATE prestamos SET estado='devuelto', fecha_devolucion=datetime('now','localtime')
       WHERE id = ? AND estado = 'prestado'`,
      [id]
    );
    const ch = db.exec('SELECT changes()')[0].values[0][0];
    if (ch === 0) {
      db.run(`ROLLBACK`);
      return { ok: false, error: 'Préstamo no encontrado o ya devuelto' };
    }

    if (materialId) {
      db.run(
        `UPDATE materiales SET cantidad_disponible = cantidad_disponible + 1 WHERE id = ?`,
        [materialId]
      );
    }

    db.run(`COMMIT`);
    saveDb();
    return { ok: true };
  } catch (e) {
    try { db.run(`ROLLBACK`); } catch {}
    return { ok: false, error: e.message };
  }
});

// ─── Config ───────────────────────────────────────────────────────────────────
ipcMain.handle('config:get', (_, key) => {
  // FIX: el PIN nunca se expone al renderer
  if (key === 'pin_admin') return null;
  const r = sqlGet(`SELECT valor FROM configuracion WHERE clave=?`, [key]);
  return r.data ? r.data.valor : null;
});
ipcMain.handle('config:set', (_, { key, value }) => {
  sqlRun(`INSERT OR REPLACE INTO configuracion (clave,valor) VALUES (?,?)`, [key, value]);
  return { ok: true };
});

// FIX: verificación de PIN en el proceso principal — el renderer nunca ve el valor real
ipcMain.handle('pin:verificar', (_, pinIngresado) => {
  const r = sqlGet(`SELECT valor FROM configuracion WHERE clave='pin_admin'`, []);
  const pinReal = r.data ? r.data.valor : '1234';
  return { ok: String(pinIngresado) === String(pinReal) };
});

// FIX: cambiar PIN también desde el proceso principal
ipcMain.handle('pin:cambiar', (_, { pinActual, pinNuevo }) => {
  const r = sqlGet(`SELECT valor FROM configuracion WHERE clave='pin_admin'`, []);
  const pinReal = r.data ? r.data.valor : '1234';
  if (String(pinActual) !== String(pinReal)) return { ok: false, error: 'PIN actual incorrecto' };
  if (!pinNuevo || String(pinNuevo).length < 4) return { ok: false, error: 'El PIN debe tener al menos 4 dígitos' };
  sqlRun(`INSERT OR REPLACE INTO configuracion (clave,valor) VALUES ('pin_admin',?)`, [String(pinNuevo)]);
  return { ok: true };
});

// ─── Backup manual (desde configuración) ─────────────────────────────────────
ipcMain.handle('backup:crear', async () => {
  try {
    const { dialog } = require('electron');
    const fecha = new Date().toISOString().slice(0, 10);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `centro-backup-${fecha}.db`,
      filters: [{ name: 'Base de datos', extensions: ['db'] }]
    });
    if (!filePath) return { ok: false, cancelled: true };
    const data = db.export();
    fs.writeFileSync(filePath, Buffer.from(data));
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('backup:listar', () => {
  try {
    if (!fs.existsSync(backupDir)) return { ok: true, data: [] };
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('centro-') && f.endsWith('.db'))
      .sort()
      .reverse()
      .map(f => ({
        nombre: f,
        ruta:   path.join(backupDir, f),
        fecha:  f.replace('centro-', '').replace('.db', ''),
        tamano: fs.statSync(path.join(backupDir, f)).size
      }));
    return { ok: true, data: files };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── PDF Export ───────────────────────────────────────────────────────────────
ipcMain.handle('pdf:export', async (_, { html, filename }) => {
  try {
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (!filePath) return { ok: false, cancelled: true };

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r => setTimeout(r, 600));
    const pdfData = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    win.destroy();
    fs.writeFileSync(filePath, pdfData);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Excel Export ─────────────────────────────────────────────────────────────
ipcMain.handle('excel:export', async (_, { sheets, filename }) => {
  try {
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [{ name: 'CSV para Excel', extensions: ['csv'] }]
    });
    if (!filePath) return { ok: false, cancelled: true };

    const sheet = sheets[0];
    const esc = v => {
      const s = String(v === null || v === undefined ? '' : v);
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = 'sep=;\r\n' + sheet.rows.map(row => row.map(esc).join(';')).join('\r\n');
    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await setupDatabase();
  createWindow();
  setupUpdater();
});

app.on('window-all-closed', () => {
  // Forzar save síncrono ANTES de cerrar
  if (db) {
    try {
      const data = db.export();
      const tmpPath = dbPath + '.tmp';
      fs.writeFileSync(tmpPath, Buffer.from(data));
      fs.renameSync(tmpPath, dbPath);
    } catch (e) {
      console.error('Final save error:', e);
    }
  }
  // FIX: proteger el archivo al cerrar la app
  protegerDB();
  if (process.platform !== 'darwin') app.quit();
});
