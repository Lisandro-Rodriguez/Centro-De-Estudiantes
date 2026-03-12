// ─── Global App State ─────────────────────────────────────────────────────────
const App = {
  turnoActivo: null,
  config: {},
  currentPage: 'dashboard',

  // rol activo: 'presidente' | 'vocal' | 'becario' | null (sin turno)
  rolActivo: null,

  async init() {
    const keys = ['hojas_gratis', 'hojas_max', 'precio_hoja', 'nombre_centro'];
    for (const k of keys) {
      this.config[k] = await window.api.getConfig(k);
    }

    const nombre = this.config.nombre_centro || 'Centro de Estudiantes';
    document.getElementById('titlebar-name').textContent = nombre;

    await this.checkTurnoActivo();

    document.getElementById('btn-min').onclick = () => window.api.minimize();
    document.getElementById('btn-max').onclick = () => window.api.maximize();
    document.getElementById('btn-close').onclick = () => window.api.close();

    window.api.onUpdateAvailable(() => {
      document.getElementById('update-banner').style.display = 'flex';
    });
    window.api.onUpdateDownloaded(() => {
      document.getElementById('btn-update').textContent = '✓ Lista — Instalar y reiniciar';
    });
    document.getElementById('btn-update').onclick = () => window.api.installUpdate();

    Router.bindNav();
    Router.navigate('dashboard');
  },

  async checkTurnoActivo() {
    // Busca turno abierto + roles del personal en ese turno en una sola query
    const res = await window.api.get(
      `SELECT t.*,
              GROUP_CONCAT(p.nombre || ' ' || p.apellido, ', ') as personal_names,
              MAX(CASE
                WHEN tp.estado IN ('presente','demorado') AND p.rol = 'presidente' THEN 3
                WHEN tp.estado IN ('presente','demorado') AND p.rol = 'vocal'      THEN 2
                WHEN tp.estado IN ('presente','demorado') AND p.rol = 'becario'    THEN 1
                ELSE 0
              END) as rol_max
       FROM turnos t
       LEFT JOIN turno_personal tp ON tp.turno_id = t.id
       LEFT JOIN personal p ON p.id = tp.personal_id
       WHERE t.hora_fin IS NULL
       ORDER BY t.id DESC LIMIT 1`
    );
    this.turnoActivo = res.ok && res.data ? res.data : null;

    if (this.turnoActivo) {
      const rolMax = this.turnoActivo.rol_max || 0;
      if (rolMax >= 3)      this.rolActivo = 'presidente';
      else if (rolMax >= 2) this.rolActivo = 'vocal';
      else if (rolMax >= 1) this.rolActivo = 'becario';
      else                  this.rolActivo = 'becario'; // todos ausentes/cubiertos
    } else {
      // Sin turno activo → acceso total
      this.rolActivo = 'presidente';
    }

    this.aplicarPermisos();
  },

  setTurnoActivo(turno) {
    this.turnoActivo = turno;
  },

  getTurnoActivo() {
    return this.turnoActivo;
  },

  // Llamar cada vez que cambia el turno o el rol
  async refreshRol() {
    await this.checkTurnoActivo();
  },

  esBecario() {
    return this.rolActivo === 'becario';
  },

  esAdmin() {
    return this.rolActivo === 'presidente' || this.rolActivo === 'vocal';
  },

  // Aplica restricciones al sidebar según el rol
  aplicarPermisos() {
    const esBecario = this.esBecario();

    // Items que solo ven admins
    const soloAdmin = ['configuracion'];

    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      const page = el.dataset.page;
      if (soloAdmin.includes(page) && esBecario) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });

    // Indicador de rol en sidebar
    const badge = document.getElementById('rol-badge');
    if (badge) {
      if (esBecario) {
        badge.textContent = 'Becario';
        badge.className = 'badge badge-blue';
        badge.style.display = 'inline-flex';
      } else if (this.rolActivo === 'vocal') {
        badge.textContent = 'Vocal';
        badge.className = 'badge badge-gray';
        badge.style.display = 'inline-flex';
      } else if (this.rolActivo === 'presidente') {
        badge.textContent = 'Presidente';
        badge.className = 'badge badge-green';
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await App.init();
});
