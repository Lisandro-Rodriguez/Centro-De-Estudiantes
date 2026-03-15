// ─── Helper de inventario / mercadería ────────────────────────────────────────
const Inventario = {

  async stockBajo() {
    const lista = await DB.query(
      `SELECT * FROM mercaderia WHERE activo=1 AND stock_actual <= stock_minimo ORDER BY stock_actual ASC`
    );
    return lista;
  },

  // Actualiza el badge rojo en el ítem del menú
  actualizarBadge(count) {
    const navItem = document.querySelector('.nav-item[data-page="mercaderia"]');
    if (!navItem) return;
    let badge = navItem.querySelector('.nav-alert-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-alert-badge';
        badge.style.cssText = 'margin-left:auto;background:var(--red);color:#fff;border-radius:999px;font-size:10px;padding:1px 6px;font-weight:700;';
        navItem.appendChild(badge);
      }
      badge.textContent = count;
    } else {
      if (badge) badge.remove();
    }
  },

  // Chequear al iniciar app
  async checkInicio() {
    const bajo = await this.stockBajo();
    this.actualizarBadge(bajo.length);
    return bajo;
  }
};