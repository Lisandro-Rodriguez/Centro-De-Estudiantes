// ─── Router ───────────────────────────────────────────────────────────────────
const Router = {
  pages: {
    dashboard:     () => Pages.dashboard(),
    turno:         () => Pages.turno(),
    agenda:        () => Pages.agenda(),
    prestamos:     () => Pages.prestamos(),
    pan:           () => Pages.pan(),
    hojas:         () => Pages.hojas(),
    alumnos:       () => Pages.alumnos(),
    personal:      () => Pages.personal(),
    materiales:    () => Pages.materiales(),
    mercaderia:    () => Pages.mercaderia(),
    informes:      () => Pages.informes(),
    configuracion: () => Pages.configuracion(),
  },

  navigate(page) {
    console.log('[Router] navigate ->', page);
    // Reset PIN confirmation when leaving configuracion
    if (App.currentPage === 'configuracion' && page !== 'configuracion') { App._pinConfirmado = false; }
    if (App.currentPage === 'informes' && page !== 'informes') { App._pinInformes = false; }
    App.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const fn = this.pages[page];
    if (fn) {
      fn();
    } else {
      console.error('[Router] Pagina no encontrada:', page);
    }
  },

  // Llamar esto DESPUÉS de que el DOM esté listo
  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        console.log('[Router] click en:', el.dataset.page);
        Router.navigate(el.dataset.page);
      });
    });
    console.log('[Router] Nav bindeado, items:', document.querySelectorAll('.nav-item[data-page]').length);
  }
};
