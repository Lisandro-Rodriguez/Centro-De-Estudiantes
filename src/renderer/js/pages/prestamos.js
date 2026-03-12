Pages = window.Pages || {};

Pages.prestamos = async function() {
  const container = document.getElementById('page-container');
  const turno = App.getTurnoActivo();

  // Detectar vencidos automáticamente al abrir
  await Morosos.detectarVencidos();

  async function recargar(filtro = 'activos') {
    let sql;
    if (filtro === 'activos') {
      sql = `SELECT pr.*, m.nombre as material_nombre, a.nombre||' '||a.apellido as alumno_full
             FROM prestamos pr
             LEFT JOIN materiales m ON m.id = pr.material_id
             LEFT JOIN alumnos a ON a.id = pr.alumno_id
             WHERE pr.estado = 'prestado' ORDER BY pr.fecha_prestamo DESC`;
    } else if (filtro === 'morosos') {
      const hoy = new Date().toISOString().split('T')[0];
      sql = `SELECT pr.*, m.nombre as material_nombre, a.nombre||' '||a.apellido as alumno_full,
                    a.incumplimientos_count, a.bloqueado_prestamo
             FROM prestamos pr
             LEFT JOIN materiales m ON m.id = pr.material_id
             LEFT JOIN alumnos a ON a.id = pr.alumno_id
             WHERE pr.estado = 'prestado' AND pr.alumno_id IS NOT NULL
               AND date(pr.fecha_prestamo) < '${hoy}'
             ORDER BY pr.fecha_prestamo ASC`;
    } else {
      sql = `SELECT pr.*, m.nombre as material_nombre, a.nombre||' '||a.apellido as alumno_full
             FROM prestamos pr
             LEFT JOIN materiales m ON m.id = pr.material_id
             LEFT JOIN alumnos a ON a.id = pr.alumno_id
             ORDER BY pr.fecha_prestamo DESC LIMIT 50`;
    }

    const prestamos = await DB.query(sql);
    const hoy = new Date().toISOString().split('T')[0];

    document.getElementById('tabla-prestamos').innerHTML = UI.buildTable(
      ['Material', 'Alumno', 'Fecha', 'Estado', ''],
      prestamos.map(p => {
        const vencido = p.estado === 'prestado' && p.fecha_prestamo && p.fecha_prestamo.split('T')[0] < hoy;
        const bloqueado = p.bloqueado_prestamo;
        const incump = p.incumplimientos_count || 0;
        const btnDevolver = p.estado === 'prestado'
          ? `<button class="btn btn-sm btn-success" onclick="Pages._devolverPrestamo(${p.id}, ${p.material_id})">✓ Devuelto</button>`
          : '';
        return `
          <tr ${vencido ? 'style="background:rgba(239,68,68,0.05);"' : ''}>
            <td class="fw-600">${p.material_nombre || '—'}</td>
            <td>
              ${p.alumno_full || p.alumno_nombre || '—'}
              ${bloqueado ? '<span class="badge badge-red" style="margin-left:4px;">BLOQUEADO</span>' : ''}
              ${!bloqueado && incump > 0 ? `<span class="badge badge-yellow" style="margin-left:4px;">${incump} incump.</span>` : ''}
            </td>
            <td class="td-muted">${UI.formatDate(p.fecha_prestamo)}
              ${vencido ? `<span class="badge badge-red" style="margin-left:4px;">Vencido</span>` : ''}
            </td>
            <td>
              <span class="badge ${p.estado === 'prestado' ? 'badge-yellow' : p.estado === 'devuelto' ? 'badge-green' : 'badge-red'}">
                ${p.estado}
              </span>
            </td>
            <td>${btnDevolver}</td>
          </tr>`;
      }),
      'Sin préstamos'
    );
  }

  // Stats
  const hoy = new Date().toISOString().split('T')[0];
  const [stats, morososCount] = await Promise.all([
    DB.query(`SELECT estado, COUNT(*) as c FROM prestamos GROUP BY estado`),
    DB.get(`SELECT COUNT(*) as c FROM prestamos WHERE estado='prestado' AND alumno_id IS NOT NULL AND date(fecha_prestamo) < ?`, hoy)
  ]);
  const activos   = stats.find(s => s.estado === 'prestado')?.c  || 0;
  const devueltos = stats.find(s => s.estado === 'devuelto')?.c  || 0;
  const nMorosos  = morososCount?.c || 0;

  const materiales = await DB.query(`SELECT * FROM materiales WHERE cantidad_disponible > 0 ORDER BY nombre`);
  const alumnos    = await DB.query(`SELECT * FROM alumnos WHERE activo=1 ORDER BY apellido`);

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Préstamos</h1>
        <div class="page-subtitle">Gestión de materiales prestados</div>
      </div>
      <button class="btn btn-primary" id="btn-nuevo-prestamo">⊡ Nuevo préstamo</button>
    </div>

    <div class="stats-grid" style="max-width:500px;margin-bottom:24px;">
      <div class="stat-card yellow">
        <div class="stat-value">${activos}</div>
        <div class="stat-label">Activos</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${devueltos}</div>
        <div class="stat-label">Devueltos</div>
      </div>
      <div class="stat-card" style="border-color:var(--red);">
        <div class="stat-value" style="color:var(--red);">${nMorosos}</div>
        <div class="stat-label">Vencidos</div>
      </div>
    </div>

    ${nMorosos > 0 ? `
      <div style="background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:var(--radius);padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
        <span style="color:var(--red);font-size:16px;">⚠</span>
        <span style="font-size:13px;color:var(--red);font-weight:500;">${nMorosos} préstamo${nMorosos>1?'s':''} vencido${nMorosos>1?'s':''} de días anteriores sin devolver</span>
        <button class="btn btn-sm" style="margin-left:auto;border-color:var(--red);color:var(--red);" onclick="Pages._filtroPrestamos('morosos')">Ver morosos</button>
      </div>
    ` : ''}

    <div class="search-bar">
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" id="fil-activos"  onclick="Pages._filtroPrestamos('activos')"  style="border-color:var(--accent);color:var(--accent);">Activos</button>
        <button class="btn btn-secondary btn-sm" id="fil-morosos"  onclick="Pages._filtroPrestamos('morosos')"  ${nMorosos>0?'style="border-color:var(--red);color:var(--red);"':''}>Morosos ${nMorosos>0?`(${nMorosos})`:''}  </button>
        <button class="btn btn-secondary btn-sm" id="fil-todos"    onclick="Pages._filtroPrestamos('todos')">Todos</button>
      </div>
    </div>

    <div id="tabla-prestamos"></div>
  `;

  await recargar();

  Pages._filtroPrestamos = (f) => {
    ['activos','morosos','todos'].forEach(id => {
      const btn = document.getElementById(`fil-${id}`);
      if (!btn) return;
      btn.style.borderColor = f === id ? 'var(--accent)' : (id === 'morosos' && nMorosos > 0 ? 'var(--red)' : '');
      btn.style.color       = f === id ? 'var(--accent)' : (id === 'morosos' && nMorosos > 0 ? 'var(--red)' : '');
    });
    recargar(f);
  };

  Pages._devolverPrestamo = async (id, materialId) => {
    await DB.run(`UPDATE prestamos SET estado='devuelto', fecha_devolucion=datetime('now','localtime') WHERE id=?`, id);
    if (materialId) await DB.run(`UPDATE materiales SET cantidad_disponible = cantidad_disponible + 1 WHERE id=?`, materialId);
    UI.toast('Material devuelto', 'success');
    recargar();
  };

  document.getElementById('btn-nuevo-prestamo').onclick = async () => {
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
        <div class="form-group" id="bloqueo-aviso" style="display:none;grid-column:span 1;"></div>
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

    // Al seleccionar alumno, verificar bloqueo e incumplimientos
    document.getElementById('pr-alumno').addEventListener('change', async function() {
      const aid = this.value;
      const aviso = document.getElementById('bloqueo-aviso');
      if (!aid) { aviso.style.display = 'none'; return; }

      const bloqueado = await Morosos.estaBloqueado(Number(aid));
      const incump    = await Morosos.contarIncumplimientos(Number(aid));
      const guardar   = document.getElementById('btn-guardar-prestamo');

      if (bloqueado) {
        const a = await DB.get(`SELECT bloqueado_hasta FROM alumnos WHERE id=?`, aid);
        aviso.innerHTML = `<div style="background:rgba(239,68,68,0.12);border:1px solid var(--red);border-radius:var(--radius);padding:10px;font-size:12px;color:var(--red);">
          ⛔ Alumno BLOQUEADO hasta ${a.bloqueado_hasta} por 3 incumplimientos este cuatrimestre. No puede pedir préstamos.
        </div>`;
        aviso.style.display = 'block';
        guardar.disabled = true;
        guardar.style.opacity = '0.4';
      } else if (incump > 0) {
        aviso.innerHTML = `<div style="background:rgba(234,179,8,0.1);border:1px solid var(--yellow);border-radius:var(--radius);padding:10px;font-size:12px;color:var(--yellow);">
          ⚠ Este alumno tiene <strong>${incump} incumplimiento${incump>1?'s':''}</strong> este cuatrimestre. Al 3ro quedará bloqueado.
        </div>`;
        aviso.style.display = 'block';
        guardar.disabled = false;
        guardar.style.opacity = '1';
      } else {
        aviso.style.display = 'none';
        guardar.disabled = false;
        guardar.style.opacity = '1';
      }
    });

    document.getElementById('btn-guardar-prestamo').onclick = async () => {
      const matId       = document.getElementById('pr-material').value;
      const alumnoId    = document.getElementById('pr-alumno').value;
      const nombreLibre = document.getElementById('pr-nombre-libre').value.trim();
      const notas       = document.getElementById('pr-notas').value.trim();

      if (!matId) { UI.toast('Seleccioná un material', 'error'); return; }
      if (!alumnoId && !nombreLibre) { UI.toast('Ingresá el alumno', 'error'); return; }

      // Doble check bloqueo
      if (alumnoId && await Morosos.estaBloqueado(Number(alumnoId))) {
        UI.toast('El alumno está bloqueado para préstamos este cuatrimestre', 'error');
        return;
      }

      const alumnoSel  = document.getElementById('pr-alumno');
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
      await Morosos.detectarVencidos();
      recargar();
    };
  };
};
