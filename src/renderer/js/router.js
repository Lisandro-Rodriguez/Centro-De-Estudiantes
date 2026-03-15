// ─── Router ───────────────────────────────────────────────────────────────────
const Router = {
  pages: {
    dashboard:     () => Pages.dashboard(),
    turno:         () => Pages.turnoPage('turno'),
    historial:     () => Pages.turnoPage('historial'),
    gente:         () => Pages.gente(),
    alumnos:       () => Pages.gente('alumnos'),
    personal:      () => Pages.gente('personal'),
    inventario:    () => Pages.inventario(),
    materiales:    () => Pages.inventario('materiales'),
    mercaderia:    () => Pages.inventario('mercaderia'),
    agenda:        () => Pages.agenda(),
    prestamos:     () => Pages.prestamos(),
    pan:           () => Pages.pan(),
    hojas:         () => Pages.hojas(),
    informes:      () => Pages.informes(),
    configuracion: () => Pages.configuracion(),
  },

  navigate(page) {
    console.log('[Router] navigate ->', page);

    // Reset PIN cuando salimos de páginas protegidas
    if (App.currentPage === 'configuracion' && page !== 'configuracion') App._pinConfirmado = false;
    if (App.currentPage === 'informes'      && page !== 'informes')      App._pinInformes  = false;

    // Guard de PIN ANTES de cambiar currentPage
    if (page === 'informes' && !App._pinInformes) {
      App.pedirPinAdmin(() => { App._pinInformes = true; Router.navigate('informes'); });
      return;
    }
    if (page === 'configuracion' && !App._pinConfirmado) {
      App.pedirPinAdmin(() => { App._pinConfirmado = true; Router.navigate('configuracion'); });
      return;
    }

    App.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    if (typeof NavGroups !== 'undefined') NavGroups.abrirParaPagina(page);

    const fn = this.pages[page];
    if (fn) fn();
    else console.error('[Router] Pagina no encontrada:', page);
  },

  // Llamar esto DESPUÉS de que el DOM esté listo
  bindNav() {
    if (typeof NavGroups !== 'undefined') NavGroups.init();
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        console.log('[Router] click en:', el.dataset.page);
        Router.navigate(el.dataset.page);
      });
    });
    console.log('[Router] Nav bindeado, items:', document.querySelectorAll('.nav-item[data-page]').length);
  }
};