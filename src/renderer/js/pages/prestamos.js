Pages = window.Pages || {};

Pages.prestamos = async function() {
  const container = document.getElementById('page-container');
  const turno = App.getTurnoActivo();

  async function recargar(filtro = 'activos') {
    let sql;
    if (filtro === 'activos') {
      sql = `SELECT pr.*, m.nombre as material_nombre, a.nombre||' '||a.apellido as alumno_full
             FROM prestamos pr
             LEFT JOIN materiales m ON m.id = pr.material_id
             LEFT JOIN alumnos a ON a.id = pr.alumno_id
             WHERE pr.estado = 'prestado' ORDER BY pr.fecha_prestamo DESC`;
    } else {
      sql = `SELECT pr.*, m.nombre as material_nombre, a.nombre||' '||a.apellido as alumno_full
             FROM prestamos pr
             LEFT JOIN materiales m ON m.id = pr.material_id
             LEFT JOIN alumnos a ON a.id = pr.alumno_id
             ORDER BY pr.fecha_prestamo DESC LIMIT 50`;
    }

    const prestamos = await DB.query(sql);

    document.getElementById('tabla-prestamos').innerHTML = UI.buildTable(
      ['Material', 'Alumno', 'Fecha', 'Estado', ''],
      prestamos.map(p => {
        const matNombre = (p.material_nombre || '').replace(/"/g, '&quot;');
        const btnDevolver = p.estado === 'prestado'
          ? `<button class="btn btn-sm btn-success" onclick="Pages._devolverPrestamo(${p.id}, '${p.material_id}')">✓ Devuelto</button>`
          : '';
        return `
          <tr>
            <td class="fw-600">${p.material_nombre || '—'}</td>
            <td>${p.alumno_full || p.alumno_nombre || '—'}</td>
            <td class="td-muted">${UI.formatDate(p.fecha_prestamo)}</td>
            <td>
              <span class="badge ${p.estado === 'prestado' ? 'badge-yellow' : p.estado === 'devuelto' ? 'badge-green' : 'badge-red'}">
                ${p.estado}
              </span>
            </td>
            <td>${btnDevolver}</td>
          </tr>
        `;
      }),
      'Sin préstamos'
    );
  }

  const materiales = await DB.query(`SELECT * FROM materiales WHERE cantidad_disponible > 0 ORDER BY nombre`);
  const alumnos = await DB.query(`SELECT * FROM alumnos WHERE activo=1 ORDER BY apellido`);
  const stats = await DB.query(`SELECT estado, COUNT(*) as c FROM prestamos GROUP BY estado`);
  const activos = stats.find(s => s.estado === 'prestado')?.c || 0;
  const devueltos = stats.find(s => s.estado === 'devuelto')?.c || 0;

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Préstamos</h1>
        <div class="page-subtitle">Gestión de materiales prestados</div>
      </div>
      <button class="btn btn-primary" id="btn-nuevo-prestamo">⊡ Nuevo préstamo</button>
    </div>

    <div class="stats-grid" style="max-width:400px;margin-bottom:24px;">
      <div class="stat-card yellow">
        <div class="stat-value">${activos}</div>
        <div class="stat-label">Activos</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${devueltos}</div>
        <div class="stat-label">Devueltos</div>
      </div>
    </div>

    <div class="search-bar">
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" id="fil-activos" onclick="Pages._filtroPrestamos('activos')" style="border-color:var(--accent)">Activos</button>
        <button class="btn btn-secondary btn-sm" id="fil-todos" onclick="Pages._filtroPrestamos('todos')">Todos</button>
      </div>
    </div>

    <div id="tabla-prestamos"></div>
  `;

  await recargar();

  Pages._filtroPrestamos = (f) => {
    document.getElementById('fil-activos').style.borderColor = f === 'activos' ? 'var(--accent)' : '';
    document.getElementById('fil-todos').style.borderColor = f === 'todos' ? 'var(--accent)' : '';
    recargar(f);
  };

  Pages._devolverPrestamo = async (id, materialId) => {
    await DB.run(`UPDATE prestamos SET estado='devuelto', fecha_devolucion=datetime('now','localtime') WHERE id=?`, id);
    if (materialId) {
      await DB.run(`UPDATE materiales SET cantidad_disponible = cantidad_disponible + 1 WHERE id=?`, materialId);
    }
    UI.toast('Material devuelto', 'success');
    recargar();
  };

  document.getElementById('btn-nuevo-prestamo').onclick = () => {
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">Nuevo préstamo</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Material</label>
          <select id="pr-material">
            <option value="">— Seleccionar material —</option>
            ${materiales.map(m => `<option value="${m.id}">${m.nombre} (${m.cantidad_disponible} disp.)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Alumno (lista)</label>
          <select id="pr-alumno">
            <option value="">— Seleccionar alumno —</option>
            ${alumnos.map(a => `<option value="${a.id}" data-nombre="${a.nombre} ${a.apellido}">${a.apellido}, ${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>O nombre libre</label>
          <input type="text" id="pr-nombre-libre" placeholder="Nombre alumno..." />
        </div>
        <div class="form-group">
          <label>Notas</label>
          <input type="text" id="pr-notas" placeholder="Observaciones..." />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-prestamo">⊡ Guardar</button>
      </div>
    `);

    document.getElementById('btn-guardar-prestamo').onclick = async () => {
      const matId = document.getElementById('pr-material').value;
      const alumnoId = document.getElementById('pr-alumno').value;
      const nombreLibre = document.getElementById('pr-nombre-libre').value.trim();
      const notas = document.getElementById('pr-notas').value.trim();

      if (!matId) { UI.toast('Seleccioná un material', 'error'); return; }
      if (!alumnoId && !nombreLibre) { UI.toast('Ingresá el alumno', 'error'); return; }

      const alumnoSel = document.getElementById('pr-alumno');
      let alumnoNombre = nombreLibre;
      let alumnoIdFinal = alumnoId ? Number(alumnoId) : null;
      if (alumnoId) alumnoNombre = alumnoSel.options[alumnoSel.selectedIndex].dataset.nombre;

      await DB.run(
        `INSERT INTO prestamos (alumno_id, alumno_nombre, material_id, turno_id, notas) VALUES (?,?,?,?,?)`,
        alumnoIdFinal, alumnoNombre, Number(matId), turno?.id || null, notas
      );
      await DB.run(`UPDATE materiales SET cantidad_disponible = cantidad_disponible - 1 WHERE id=?`, Number(matId));

      UI.toast('Préstamo registrado', 'success');
      UI.closeModal();
      recargar();
    };
  };
};
