Pages = window.Pages || {};

Pages.pan = async function() {
  const container = document.getElementById('page-container');
  const today = UI.today();
  const alumnos = await DB.query(`SELECT * FROM alumnos WHERE activo=1 ORDER BY apellido`);
  const turno = App.getTurnoActivo();

  async function recargar() {
    const registros = await DB.query(`
      SELECT r.*, a.nombre || ' ' || a.apellido as alumno_full
      FROM registro_pan r LEFT JOIN alumnos a ON a.id = r.alumno_id
      WHERE r.fecha = ? ORDER BY r.id DESC
    `, today);

    const desayunos = registros.filter(r => r.tipo === 'desayuno').length;
    const meriendas = registros.filter(r => r.tipo === 'merienda').length;

    document.getElementById('stats-pan').innerHTML = `
      <div class="stat-card green">
        <div class="stat-value">${desayunos}</div>
        <div class="stat-label">Desayunos hoy</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${meriendas}</div>
        <div class="stat-label">Meriendas hoy</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">${desayunos + meriendas}</div>
        <div class="stat-label">Total panes hoy</div>
      </div>
    `;

    document.getElementById('tabla-pan').innerHTML = UI.buildTable(
      ['Alumno', 'Tipo', 'Hora', ''],
      registros.map(r => `
        <tr>
          <td>${r.alumno_full || r.alumno_nombre}</td>
          <td><span class="badge ${r.tipo === 'desayuno' ? 'badge-blue' : 'badge-yellow'}">${r.tipo}</span></td>
          <td class="td-muted">${r.fecha}</td>
          <td>
            <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deletePan(${r.id})">✕</button>
          </td>
        </tr>
      `),
      'Sin registros de pan hoy'
    );
  }

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Pan / Merienda</h1>
        <div class="page-subtitle">1 pan por alumno por turno · ${new Date().toLocaleDateString('es-AR')}</div>
      </div>
    </div>

    <div class="card" style="max-width:520px;margin-bottom:24px;">
      <div class="card-title">Registrar pan</div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Alumno</label>
          <select id="pan-alumno">
            <option value="">— Buscar alumno —</option>
            ${alumnos.map(a=>`<option value="${a.id}" data-nombre="${a.nombre} ${a.apellido}">${a.apellido}, ${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="pan-tipo">
            <option value="merienda">Merienda</option>
            <option value="desayuno">Desayuno</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>O ingresar nombre libre</label>
          <input type="text" id="pan-nombre-libre" placeholder="Nombre del alumno (si no está en la lista)" />
        </div>
      </div>
      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn-primary" id="btn-registrar-pan">◻ Registrar pan</button>
      </div>
    </div>

    <div class="stats-grid" id="stats-pan" style="max-width:520px;"></div>
    <div id="tabla-pan" style="margin-top:16px;"></div>
  `;

  await recargar();

  Pages._deletePan = async (id) => {
    await DB.run(`DELETE FROM registro_pan WHERE id=?`, id);
    UI.toast('Registro eliminado', 'info');
    recargar();
  };

  document.getElementById('btn-registrar-pan').onclick = async () => {
    const alumnoId = document.getElementById('pan-alumno').value;
    const alumnoSel = document.getElementById('pan-alumno');
    const nombreLibre = document.getElementById('pan-nombre-libre').value.trim();
    const tipo = document.getElementById('pan-tipo').value;

    let alumnoNombre = nombreLibre;
    let alumnoIdFinal = alumnoId ? Number(alumnoId) : null;

    if (!alumnoId && !nombreLibre) {
      UI.toast('Seleccioná un alumno o ingresá un nombre', 'error');
      return;
    }

    if (alumnoId) {
      const opt = alumnoSel.options[alumnoSel.selectedIndex];
      alumnoNombre = opt.dataset.nombre;
    }

    // Check duplicate in same day+tipo
    if (alumnoIdFinal) {
      const dup = await DB.get(`SELECT id FROM registro_pan WHERE alumno_id=? AND fecha=? AND tipo=?`, alumnoIdFinal, today, tipo);
      if (dup) { UI.toast(`${alumnoNombre} ya recibió el ${tipo} hoy`, 'error'); return; }
    }

    await DB.run(
      `INSERT INTO registro_pan (alumno_id, alumno_nombre, fecha, tipo, turno_id) VALUES (?,?,?,?,?)`,
      alumnoIdFinal, alumnoNombre, today, tipo, turno?.id || null
    );

    UI.toast(`Pan registrado para ${alumnoNombre}`, 'success');
    document.getElementById('pan-alumno').value = '';
    document.getElementById('pan-nombre-libre').value = '';
    recargar();
  };
};
