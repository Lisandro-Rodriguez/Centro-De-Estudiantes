// ─── Grupos colapsables del sidebar ──────────────────────────────────────────
const NavGroups = {

  // Estado: qué grupos están abiertos
  _estado: {},

  init() {
    // Restaurar estado guardado (localStorage-like via config)
    const saved = this._loadEstado();
    Object.entries(saved).forEach(([id, open]) => {
      if (open) this._aplicar(id, true, false);
    });
  },

  toggle(id) {
    const abierto = this._estado[id] || false;
    this._aplicar(id, !abierto, true);
  },

  // Abrir el grupo que contiene la página activa
  abrirParaPagina(page) {
    const mapa = {
      prestamos:    'servicios',
      pan:          'servicios',
      hojas:        'servicios',
      gente:        'gestion',
      alumnos:      'gestion',
      personal:     'gestion',
      inventario:   'gestion',
      materiales:   'gestion',
      mercaderia:   'gestion',
    };
    const grupo = mapa[page];
    if (grupo && !this._estado[grupo]) {
      this._aplicar(grupo, true, true);
    }
  },

  _aplicar(id, abrir, animate) {
    const body  = document.getElementById(`group-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    if (!body) return;

    this._estado[id] = abrir;

    if (abrir) {
      body.style.maxHeight = body.scrollHeight + 200 + 'px'; // +200 para items dinámicos
      if (arrow) { arrow.textContent = '▼'; arrow.classList.add('open'); }
    } else {
      body.style.maxHeight = '0';
      if (arrow) { arrow.textContent = '▶'; arrow.classList.remove('open'); }
    }
    this._guardarEstado();
  },

  _guardarEstado() {
    try { localStorage.setItem('navgroups', JSON.stringify(this._estado)); } catch(e) {}
  },
  _loadEstado() {
    try { return JSON.parse(localStorage.getItem('navgroups') || '{}'); } catch(e) { return {}; }
  }
};