// ─── Global App State ─────────────────────────────────────────────────────────
const App = {
  turnoActivo: null,
  config: {},
  currentPage: 'dashboard',
  usuarioActivo: null,  // { id, nombre, apellido, rol }

  async init() {
    const keys = ['hojas_gratis', 'hojas_max', 'precio_hoja', 'nombre_centro'];
    for (const k of keys) {
      this.config[k] = await window.api.getConfig(k);
    }

    document.getElementById('titlebar-name').textContent =
      this.config.nombre_centro || 'Centro de Estudiantes';

    // Actualizar nombre abreviado en sidebar
    const nombre = this.config.nombre_centro || 'Centro de Estudiantes';
    const palabras = nombre.split(' ').filter(p => p.length > 2);
    const siglas = palabras.slice(0,3).map(p => p[0].toUpperCase()).join('');
    const sidebarNombre = document.getElementById('sidebar-centro-nombre');
    if (sidebarNombre) sidebarNombre.textContent = siglas || 'CE';

    // Inicializar temas y logo
    await Temas.init();

    // Inicializar sistema automático (estados + recordatorios)
    Automatico.init();

    document.getElementById('btn-min').onclick   = () => window.api.minimize();
    document.getElementById('btn-max').onclick   = () => window.api.maximize();
    document.getElementById('btn-close').onclick = () => window.api.close();

    window.api.onUpdateAvailable(() => {
      document.getElementById('update-banner').style.display = 'flex';
    });
    window.api.onUpdateDownloaded(() => {
      document.getElementById('btn-update').textContent = '✓ Lista — Instalar y reiniciar';
    });
    document.getElementById('btn-update').onclick = () => window.api.installUpdate();

    await this.checkTurnoActivo();
    Router.bindNav();
    await Inventario.checkInicio();

    // Mostrar pantalla de selección de usuario
    await this.mostrarLoginUsuario();
  },

  // ── Pantalla de selección de usuario (hasta 2 simultáneos) ───────────────
  async mostrarLoginUsuario() {
    const personal = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
    const overlay  = document.getElementById('login-overlay');
    // Seleccionados temporalmente en el login (antes de confirmar)
    this._loginSeleccion = [];

    const renderOverlay = () => {
      const sel = this._loginSeleccion;
      overlay.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px 36px;width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:26px;margin-bottom:6px;">◈</div>
            <div style="font-size:17px;font-weight:600;">${this.config.nombre_centro || 'Centro de Estudiantes'}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Seleccioná quién está trabajando hoy (hasta 2)</div>
          </div>

          ${personal.length === 0
            ? `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">
                 No hay personal registrado.<br>
                 <button class="btn btn-primary" style="margin-top:12px;" onclick="App._loginAdmin()">Entrar como administrador</button>
               </div>`
            : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
                 ${personal.map(p => {
                   const isSelected = sel.some(s => s.id === p.id);
                   const isDisabled = !isSelected && sel.length >= 2;
                   return `<button onclick="App._toggleLoginUser(${p.id})" ${isDisabled ? 'disabled' : ''}
                     style="display:flex;align-items:center;gap:12px;padding:11px 14px;
                            background:${isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)'};
                            border:1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};
                            border-radius:var(--radius);cursor:${isDisabled?'not-allowed':'pointer'};
                            text-align:left;width:100%;opacity:${isDisabled?'0.4':'1'};">
                     <div style="width:34px;height:34px;border-radius:50%;
                                 background:${isSelected?'var(--accent)':'var(--bg-surface)'};
                                 border:1.5px solid ${isSelected?'var(--accent)':'var(--border)'};
                                 display:flex;align-items:center;justify-content:center;
                                 font-size:12px;color:${isSelected?'#fff':'var(--accent)'};flex-shrink:0;">
                       ${isSelected ? '✓' : p.nombre[0]+p.apellido[0]}
                     </div>
                     <div style="flex:1;">
                       <div style="font-weight:500;font-size:13px;">${p.nombre} ${p.apellido}</div>
                       <div style="font-size:11px;color:var(--text-muted);">${p.rol}</div>
                     </div>
                     <span class="badge ${p.rol==='presidente'?'badge-green':p.rol==='vocal'?'badge-gray':'badge-blue'}">${p.rol}</span>
                   </button>`;
                 }).join('')}
               </div>
               ${sel.length > 0
                 ? `<button onclick="App._confirmarLogin()"
                      style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-weight:600;font-size:14px;cursor:pointer;">
                      Entrar${sel.length === 2 ? ' (2 usuarios)' : ` como ${sel[0].nombre}`}
                    </button>`
                 : `<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px 0;">
                      Seleccioná al menos una persona para continuar
                    </div>`}
              `}
        </div>`;
      overlay.style.display = 'flex';
    };

    this._toggleLoginUser = async (id) => {
      const p = await DB.get(`SELECT * FROM personal WHERE id=?`, id);
      const idx = this._loginSeleccion.findIndex(s => s.id === id);
      if (idx >= 0) {
        this._loginSeleccion.splice(idx, 1);
      } else if (this._loginSeleccion.length < 2) {
        this._loginSeleccion.push(p);
      }
      renderOverlay();
    };

    this._confirmarLogin = () => {
      if (!this._loginSeleccion.length) return;
      // El usuario "principal" es el de mayor rol
      const rolPriority = { presidente: 3, vocal: 2, becario: 1 };
      this._loginSeleccion.sort((a,b) => (rolPriority[b.rol]||0) - (rolPriority[a.rol]||0));
      this.usuarioActivo  = this._loginSeleccion[0];
      this.usuarioActivo2 = this._loginSeleccion[1] || null;
      document.getElementById('login-overlay').style.display = 'none';
      this.aplicarPermisos();
      Router.navigate('dashboard');
    };

    renderOverlay();
  },

  async seleccionarUsuario(personalId) {
    const p = await DB.get(`SELECT * FROM personal WHERE id=?`, personalId);
    if (!p) return;
    this.usuarioActivo  = p;
    this.usuarioActivo2 = null;
    document.getElementById('login-overlay').style.display = 'none';
    this.aplicarPermisos();
    Router.navigate('dashboard');
  },

  _loginAdmin() {
    // Si no hay personal, entrar como admin directamente
    this.usuarioActivo = { id: null, nombre: 'Admin', apellido: '', rol: 'presidente' };
    document.getElementById('login-overlay').style.display = 'none';
    this.aplicarPermisos();
    Router.navigate('dashboard');
  },

  cambiarUsuario(cual = null) {
    // cual: null = ambos, 1 = solo usuario 1, 2 = solo usuario 2
    if (cual === 1) {
      this._cambiarUsuarioIndividual(1);
    } else if (cual === 2) {
      this._cambiarUsuarioIndividual(2);
    } else {
      this.usuarioActivo  = null;
      this.usuarioActivo2 = null;
      this.mostrarLoginUsuario();
    }
  },

  async _cambiarUsuarioIndividual(cual) {
    const personal = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
    const overlay  = document.getElementById('login-overlay');
    const actual   = cual === 1 ? this.usuarioActivo : this.usuarioActivo2;

    overlay.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px 32px;width:380px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <button onclick="App._cerrarLoginOverlay()" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:0 4px;">←</button>
          <div>
            <div style="font-size:15px;font-weight:600;">Cambiar usuario ${cual}</div>
            <div style="font-size:11px;color:var(--text-muted);">Actual: ${actual ? actual.nombre+' '+actual.apellido : '—'}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${cual === 2 ? `<button onclick="App._quitarUsuario2()"
            style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(239,68,68,0.1);border:1.5px solid var(--red);border-radius:var(--radius);cursor:pointer;text-align:left;width:100%;">
            <span style="color:var(--red);font-size:18px;">✕</span>
            <div style="font-size:13px;color:var(--red);">Quitar segundo usuario</div>
          </button>` : ''}
          ${personal.map(p => {
            const otroUsuario = cual === 1 ? this.usuarioActivo2 : this.usuarioActivo;
            const esElOtro = otroUsuario && otroUsuario.id === p.id;
            return `<button onclick="App._setUsuario(${cual}, ${p.id})" ${esElOtro ? 'disabled' : ''}
              style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                     background:${actual?.id===p.id?'var(--accent-dim)':'var(--bg-elevated)'};
                     border:1.5px solid ${actual?.id===p.id?'var(--accent)':'var(--border)'};
                     border-radius:var(--radius);cursor:${esElOtro?'not-allowed':'pointer'};
                     text-align:left;width:100%;opacity:${esElOtro?'0.4':'1'};">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--accent);flex-shrink:0;">
                ${p.nombre[0]}${p.apellido[0]}
              </div>
              <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${p.nombre} ${p.apellido}</div>
                <div style="font-size:11px;color:var(--text-muted);">${p.rol}</div>
              </div>
              <span class="badge ${p.rol==='presidente'?'badge-green':p.rol==='vocal'?'badge-gray':'badge-blue'}">${p.rol}</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    overlay.style.display = 'flex';
  },

  async _setUsuario(cual, id) {
    const p = await DB.get(`SELECT * FROM personal WHERE id=?`, id);
    if (cual === 1) this.usuarioActivo  = p;
    else            this.usuarioActivo2 = p;
    this._cerrarLoginOverlay();
    this.aplicarPermisos();
  },

  _quitarUsuario2() {
    this.usuarioActivo2 = null;
    this._cerrarLoginOverlay();
    this.aplicarPermisos();
  },

  _cerrarLoginOverlay() {
    document.getElementById('login-overlay').style.display = 'none';
  },

  // ── PIN Admin ──────────────────────────────────────────────────────────────
  // FIX: la verificación ocurre en el proceso principal via IPC.
  // El renderer NUNCA recibe ni almacena el valor real del PIN.
  pedirPinAdmin(onSuccess) {
    if (this._pinModalAbierto) return;
    this._pinModalAbierto = true;

    const cerrar = UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">🔒 Acceso administrador</h3>
        <button class="modal-close">✕</button>
      </div>
      <div style="text-align:center;padding:8px 0 16px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Ingresá el PIN para continuar</div>
        <input type="password" id="pin-input" maxlength="8" placeholder="PIN"
          style="text-align:center;font-size:24px;font-family:var(--font-mono);letter-spacing:8px;width:140px;padding:10px;" />
        <div id="pin-error" style="color:var(--red);font-size:12px;margin-top:8px;display:none;">PIN incorrecto</div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" id="btn-pin-cancelar">Cancelar</button>
        <button class="btn btn-primary"   id="btn-confirmar-pin">Confirmar</button>
      </div>
    `, () => { this._pinModalAbierto = false; });

    const confirmar = async () => {
      const ingresado = document.getElementById('pin-input')?.value || '';
      // Verificación en proceso principal — renderer no compara contra nada local
      const res = await window.api.verificarPin(ingresado);
      if (res.ok) {
        this._pinModalAbierto = false;
        cerrar();
        onSuccess();
      } else {
        const err = document.getElementById('pin-error');
        if (err) err.style.display = 'block';
        const inp = document.getElementById('pin-input');
        if (inp) { inp.value = ''; inp.focus(); }
      }
    };

    document.getElementById('btn-pin-cancelar').onclick  = () => { this._pinModalAbierto = false; cerrar(); };
    document.getElementById('btn-confirmar-pin').onclick = confirmar;
    document.getElementById('pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
    setTimeout(() => document.getElementById('pin-input')?.focus(), 80);
  },

  // ── Turno (solo para horas, desacoplado del rol) ───────────────────────────
  async checkTurnoActivo() {
    const res = await window.api.get(
      `SELECT t.*, GROUP_CONCAT(p.nombre || ' ' || p.apellido, ', ') as personal_names,
              COUNT(tp.id) as personal_count
       FROM turnos t
       LEFT JOIN turno_personal tp ON tp.turno_id = t.id
       LEFT JOIN personal p ON p.id = tp.personal_id
       WHERE t.hora_fin IS NULL
       ORDER BY t.id DESC LIMIT 1`
    );
    const turno = res.ok && res.data ? res.data : null;

    // Auto-cerrar turno fantasma: sin hora_fin pero sin personal asignado
    if (turno && !turno.personal_count) {
      await window.api.run(
        `UPDATE turnos SET hora_fin = datetime('now','localtime') WHERE id = ?`,
        [turno.id]
      );
      this.turnoActivo = null;
      return;
    }
    this.turnoActivo = turno;
  },

  async refreshTurno() {
    await new Promise(r => setTimeout(r, 80));
    await this.checkTurnoActivo();
  },

  setTurnoActivo(turno) { this.turnoActivo = turno; },
  getTurnoActivo()       { return this.turnoActivo; },

  // ── Rol basado en el usuario logueado, no en el turno ─────────────────────
  getRol() {
    const rolPriority = { presidente: 3, vocal: 2, becario: 1 };
    const r1 = rolPriority[this.usuarioActivo?.rol] || 0;
    const r2 = rolPriority[this.usuarioActivo2?.rol] || 0;
    const best = r1 >= r2 ? this.usuarioActivo?.rol : this.usuarioActivo2?.rol;
    return best || 'becario';
  },

  esBecario() {
    return this.getRol() === 'becario';
  },

  esAdmin() {
    const rol = this.getRol();
    return rol === 'presidente' || rol === 'vocal';
  },

  // ── Sidebar y permisos ────────────────────────────────────────────────────
  aplicarPermisos() {
    const u  = this.usuarioActivo;
    const u2 = this.usuarioActivo2;
    if (!u) return;

    const avatar = (p) => `
      <div style="width:28px;height:28px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);
                  display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--accent);flex-shrink:0;">
        ${p.nombre?.[0]||'?'}${p.apellido?.[0]||''}
      </div>`;
    const rolBadge = (rol) =>
      `<span class="badge ${rol==='presidente'?'badge-green':rol==='vocal'?'badge-gray':'badge-blue'}" style="font-size:9px;">${rol}</span>`;

    const userRow = (p, cual) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        ${avatar(p)}
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nombre} ${p.apellido}</div>
        </div>
        ${rolBadge(p.rol)}
        <button onclick="App.cambiarUsuario(${cual})" title="Cambiar" style="background:transparent;border:1px solid var(--border-light);border-radius:4px;color:var(--text-muted);font-size:10px;cursor:pointer;padding:1px 5px;flex-shrink:0;">⇄</button>
      </div>`;

    const sidebar = document.getElementById('sidebar-user-info');
    if (sidebar) {
      sidebar.innerHTML = `
        <div style="border-top:1px solid var(--border-light);padding:10px 12px;">
          ${userRow(u, 1)}
          ${u2 ? userRow(u2, 2) : `
            <button onclick="App.cambiarUsuario(2)" style="width:100%;padding:4px;background:transparent;border:1px dashed var(--border-light);border-radius:var(--radius);color:var(--text-muted);font-size:11px;cursor:pointer;margin-bottom:6px;">
              + Segundo usuario
            </button>`}
          <button onclick="App.cambiarUsuario()" style="width:100%;padding:4px;background:transparent;border:1px solid var(--border-light);border-radius:var(--radius);color:var(--text-muted);font-size:11px;cursor:pointer;">
            ⇄ Cambiar todos
          </button>
        </div>`;
    }

    const badge = document.getElementById('rol-badge');
    if (badge) badge.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await App.init();
});