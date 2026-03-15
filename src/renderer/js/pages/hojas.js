Pages = window.Pages || {};

Pages.hojas = async function() {
  const container = document.getElementById('page-container');
  const today = UI.today();
  const alumnos = await DB.query(`SELECT * FROM alumnos WHERE activo=1 ORDER BY apellido`);
  const turno = App.getTurnoActivo();

  const hojasGratis = Number(App.config.hojas_gratis || 3);
  const hojasMax = Number(App.config.hojas_max || 7);
  const precioHoja = Number(App.config.precio_hoja || 0);

  async function recargar() {
    const registros = await DB.query(`
      SELECT r.* FROM registro_hojas r WHERE r.fecha = ? ORDER BY r.id DESC
    `, today);

    const totalHojas = registros.reduce((s,r) => s+r.cantidad, 0);
    const totalPagas = registros.reduce((s,r) => s+r.pagas, 0);
    const totalRecaudado = registros.reduce((s,r) => s+(r.monto_total||0), 0);

    document.getElementById('stats-hojas').innerHTML = `
      <div class="stat-card blue">
        <div class="stat-value">${totalHojas}</div>
        <div class="stat-label">Hojas entregadas hoy</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${totalPagas}</div>
        <div class="stat-label">Hojas pagas hoy</div>
      </div>
      ${precioHoja > 0 ? `
      <div class="stat-card green">
        <div class="stat-value">$${totalRecaudado.toFixed(0)}</div>
        <div class="stat-label">Recaudado hoy</div>
      </div>` : ''}
    `;

    document.getElementById('tabla-hojas').innerHTML = UI.buildTable(
      ['Alumno', 'Cantidad', 'Gratis', 'Pagas', precioHoja > 0 ? 'Monto' : '', ''],
      registros.map(r => `
        <tr>
          <td>${r.alumno_nombre}</td>
          <td class="text-mono fw-600">${r.cantidad}</td>
          <td class="text-mono text-green">${r.cantidad - r.pagas}</td>
          <td class="text-mono ${r.pagas > 0 ? 'text-yellow' : 'text-muted'}">${r.pagas}</td>
          ${precioHoja > 0 ? `<td class="text-mono">$${(r.monto_total||0).toFixed(0)}</td>` : ''}
          <td>
            <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteHojas(${r.id})">✕</button>
          </td>
        </tr>
      `),
      'Sin registros de hojas hoy'
    );
  }

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Fotocopias</h1>
        <div class="page-subtitle">${hojasGratis} gratis · hasta ${hojasMax} pagas${precioHoja > 0 ? ` · $${precioHoja} c/u` : ''}</div>
      </div>
    </div>

    <div class="card" style="max-width:540px;margin-bottom:24px;">
      <div class="card-title">Entregar hojas</div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Alumno</label>
          <select id="h-alumno">
            <option value="">— Buscar alumno —</option>
            ${alumnos.map(a=>`<option value="${a.id}" data-nombre="${a.nombre} ${a.apellido}">${a.apellido}, ${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>O nombre libre</label>
          <input type="text" id="h-nombre-libre" placeholder="Nombre..." />
        </div>
        <div class="form-group">
          <label>Cantidad total de hojas</label>
          <input type="number" id="h-cantidad" min="1" max="${hojasGratis + hojasMax}" value="${hojasGratis}" />
        </div>
        <div class="form-group">
          <label id="h-calculo-label">Desglose</label>
          <div id="h-calculo" style="padding:9px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);">
            ${hojasGratis} gratis · 0 pagas
          </div>
        </div>
      </div>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-primary" id="btn-entregar-hojas">◫ Entregar hojas</button>
      </div>
    </div>

    <div class="stats-grid" id="stats-hojas" style="max-width:540px;"></div>
    <div id="tabla-hojas" style="margin-top:16px;"></div>
  `;

  await recargar();

  Pages._deleteHojas = async (id) => {
    await DB.run(`DELETE FROM registro_hojas WHERE id=?`, id);
    UI.toast('Registro eliminado', 'info');
    recargar();
  };

  document.getElementById('h-cantidad').addEventListener('input', function() {
    const cant = Number(this.value) || 0;
    const gratis = Math.min(cant, hojasGratis);
    const pagas = Math.max(0, cant - hojasGratis);
    const monto = pagas * precioHoja;
    const el = document.getElementById('h-calculo');
    el.innerHTML = `<span class="text-green">${gratis} gratis</span> · <span class="text-yellow">${pagas} pagas</span>${precioHoja > 0 ? ` · <span class="text-accent">$${monto.toFixed(0)}</span>` : ''}`;
    if (cant > hojasGratis + hojasMax) {
      el.innerHTML += ` <span class="text-red">⚠ máximo ${hojasGratis + hojasMax}</span>`;
    }
  });

  document.getElementById('btn-entregar-hojas').onclick = async () => {
    const alumnoId = document.getElementById('h-alumno').value;
    const alumnoSel = document.getElementById('h-alumno');
    const nombreLibre = document.getElementById('h-nombre-libre').value.trim();
    const cantidad = Number(document.getElementById('h-cantidad').value);

    if (!alumnoId && !nombreLibre) { UI.toast('Seleccioná un alumno', 'error'); return; }
    if (!cantidad || cantidad < 1) { UI.toast('Ingresá una cantidad válida', 'error'); return; }
    if (cantidad > hojasGratis + hojasMax) {
      UI.toast(`Máximo permitido: ${hojasGratis + hojasMax} hojas`, 'error');
      return;
    }

    let alumnoNombre = nombreLibre;
    let alumnoIdFinal = alumnoId ? Number(alumnoId) : null;
    if (alumnoId) alumnoNombre = alumnoSel.options[alumnoSel.selectedIndex].dataset.nombre;

    const gratis = Math.min(cantidad, hojasGratis);
    const pagas = Math.max(0, cantidad - hojasGratis);
    const monto = pagas * precioHoja;

    // Check daily limit per alumno
    if (alumnoIdFinal) {
      const yaHoy = await DB.get(`SELECT SUM(cantidad) as total FROM registro_hojas WHERE alumno_id=? AND fecha=?`, alumnoIdFinal, today);
      const totalYa = yaHoy?.total || 0;
      if (totalYa + cantidad > hojasGratis + hojasMax) {
        UI.toast(`${alumnoNombre} ya recibió ${totalYa} hojas hoy. Límite: ${hojasGratis + hojasMax}`, 'error');
        return;
      }
    }

    await DB.run(
      `INSERT INTO registro_hojas (alumno_id, alumno_nombre, fecha, cantidad, pagas, precio_por_hoja, monto_total, turno_id) VALUES (?,?,?,?,?,?,?,?)`,
      alumnoIdFinal, alumnoNombre, today, cantidad, pagas, precioHoja, monto, turno?.id || null
    );

    UI.toast(`${cantidad} hojas entregadas a ${alumnoNombre}`, 'success');
    document.getElementById('h-alumno').value = '';
    document.getElementById('h-nombre-libre').value = '';
    document.getElementById('h-cantidad').value = hojasGratis;
    document.getElementById('h-calculo').innerHTML = `<span class="text-green">${hojasGratis} gratis</span> · <span class="text-yellow">0 pagas</span>`;
    recargar();
  };
};