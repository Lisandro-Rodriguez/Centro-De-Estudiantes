Pages = window.Pages || {};

Pages.turno = async function() {
  const container = document.getElementById('page-container');
  const turno = App.getTurnoActivo();
  const personalList = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);

  if (turno) {
    // ── Turno en curso ──
    const turnoPersonal = await DB.query(`
      SELECT tp.*, p.nombre, p.apellido, p.rol,
             pc.nombre as cubierto_por_nombre, pc.apellido as cubierto_por_apellido
      FROM turno_personal tp
      JOIN personal p ON p.id = tp.personal_id
      LEFT JOIN personal pc ON pc.id = tp.cubierto_por_id
      WHERE tp.turno_id = ?
    `, turno.id);

    function estadoBadge(estado) {
      const map = {
        presente:  ['badge-green',  'Presente'],
        demorado:  ['badge-yellow', 'Demorado'],
        cubierto:  ['badge-blue',   'Cubierto'],
        ausente:   ['badge-red',    'Ausente'],
      };
      const [cls, label] = map[estado] || ['badge-gray', estado];
      return `<span class="badge ${cls}">${label}</span>`;
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Turno Actual</h1>
          <div class="page-subtitle">En curso desde las ${UI.formatTime(turno.hora_inicio)}</div>
        </div>
        <button class="btn btn-danger" id="btn-cerrar-turno">◻ Cerrar turno</button>
      </div>

      <div class="turno-activo-bar" style="margin-bottom:24px;">
        <div class="turno-activo-info">
          <div class="pulse-dot"></div>
          <strong>Turno activo</strong> — ${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long'})}
        </div>
      </div>

      <div class="grid-2 mb-24">
        <div class="card">
          <div class="card-title">Personal en turno</div>
          ${turnoPersonal.map(tp => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-light)">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--accent);flex-shrink:0;">
                ${tp.nombre[0]}${tp.apellido[0]}
              </div>
              <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${tp.nombre} ${tp.apellido}</div>
                <div style="font-size:12px;color:var(--text-muted);">${tp.rol} · Entrada: ${UI.formatTime(tp.hora_entrada) || '—'}${tp.cubierto_por_nombre ? ` · Cubierto por: <strong>${tp.cubierto_por_nombre} ${tp.cubierto_por_apellido}</strong>` : ''}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                ${estadoBadge(tp.estado)}
                <select class="estado-select" style="padding:3px 6px;font-size:11px;" onchange="Pages._cambiarEstadoPersonal(${tp.id}, this.value)">
                  <option value="presente"  ${tp.estado==='presente' ?'selected':''}>Presente</option>
                  <option value="demorado"  ${tp.estado==='demorado' ?'selected':''}>Demorado</option>
                  <option value="cubierto"  ${tp.estado==='cubierto' ?'selected':''}>Cubierto</option>
                  <option value="ausente"   ${tp.estado==='ausente'  ?'selected':''}>Ausente</option>
                </select>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-title">Acciones rápidas del turno</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-secondary" onclick="Router.navigate('prestamos')">⊡ Registrar préstamo</button>
            <button class="btn btn-secondary" onclick="Router.navigate('pan')">◻ Registrar pan</button>
            <button class="btn btn-secondary" onclick="Router.navigate('hojas')">◫ Entregar hojas</button>
          </div>
        </div>
      </div>

      <div id="historial-section"></div>
    `;

    // Cargar historial del turno
    const [prestH, panH, hojasH] = await Promise.all([
      DB.query(`SELECT pr.*, m.nombre as mat FROM prestamos pr LEFT JOIN materiales m ON m.id=pr.material_id WHERE pr.turno_id=?`, turno.id),
      DB.query(`SELECT * FROM registro_pan WHERE turno_id=?`, turno.id),
      DB.query(`SELECT * FROM registro_hojas WHERE turno_id=?`, turno.id),
    ]);

    document.getElementById('historial-section').innerHTML = `
      <div class="grid-3">
        <div class="card">
          <div class="card-title">Préstamos (${prestH.length})</div>
          ${prestH.length === 0 ? UI.emptyState('⊡','Sin préstamos') : prestH.map(p=>`
            <div style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px;">
              <div>${p.mat || '—'}</div>
              <div class="text-muted fs-12">${p.alumno_nombre || '—'}</div>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <div class="card-title">Panes (${panH.length})</div>
          ${panH.length === 0 ? UI.emptyState('◻','Sin registros') : panH.map(p=>`
            <div style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px;">
              <div>${p.alumno_nombre}</div>
              <div class="text-muted fs-12">${p.tipo}</div>
            </div>
          `).join('')}
        </div>
        <div class="card">
          <div class="card-title">Hojas (${hojasH.reduce((s,h)=>s+h.cantidad,0)} total)</div>
          ${hojasH.length === 0 ? UI.emptyState('◫','Sin registros') : hojasH.map(h=>`
            <div style="padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px;">
              <div>${h.alumno_nombre} — <span class="text-mono">${h.cantidad} hjs</span></div>
              <div class="text-muted fs-12">${h.pagas > 0 ? `${h.pagas} pagas` : 'gratuitas'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    Pages._cambiarEstadoPersonal = async (turnoPersonalId, nuevoEstado) => {
      // Si demorado, registrar hora de entrada real ahora
      const extra = nuevoEstado === 'demorado'
        ? `, hora_entrada = COALESCE(hora_entrada, '${UI.nowTime()}')`
        : '';
      await DB.run(
        `UPDATE turno_personal SET estado=?${extra} WHERE id=?`,
        nuevoEstado, turnoPersonalId
      );
      // Recalcular rol activo (si alguien era presidente y ahora está ausente, puede cambiar)
      await App.refreshTurno();
      UI.toast('Estado actualizado', 'success');
      Pages.turno(); // rerender
    };

    document.getElementById('btn-cerrar-turno').onclick = () => {
      UI.confirm('Cerrar turno', '¿Estás seguro? Se registrarán las horas del personal presente.', async () => {
        const hora_fin = UI.nowTime();
        const res = await window.api.cerrarTurno({ turnoId: turno.id, hora_fin });
        if (res.ok) {
          App.setTurnoActivo(null);
          await App.refreshTurno();  // esto ya incluye checkTurnoActivo que limpia el turno
          UI.toast('Turno cerrado correctamente', 'success');
          Router.navigate('dashboard'); // volver al dashboard limpio
        } else {
          UI.toast('Error al cerrar turno', 'error');
        }
      });
    };

  } else {
    // ── Sin turno activo ──
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Turno</h1>
          <div class="page-subtitle">No hay turno activo en este momento</div>
        </div>
      </div>

      <div class="card" style="max-width:580px;margin-bottom:28px;">
        <div class="card-title">Iniciar nuevo turno</div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="t-fecha" value="${UI.today()}" />
          </div>
          <div class="form-group">
            <label>Hora de inicio</label>
            <input type="time" id="t-hora" value="${UI.nowTime()}" />
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div class="card-title" style="font-size:12px;margin-bottom:10px;">PERSONA #1 *</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>Personal</label>
              <select id="t-p1">
                <option value="">— Seleccionar —</option>
                ${personalList.map(p=>`<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Estado de asistencia</label>
              <select id="t-p1-estado" onchange="Pages._toggleCubierto('p1', this.value)">
                <option value="presente">Presente</option>
                <option value="demorado">Demorado</option>
                <option value="cubierto">Cubierto por otro</option>
                <option value="ausente">Ausente</option>
              </select>
            </div>
            <div class="form-group" id="p1-cubierto-por" style="display:none;grid-column:span 2;">
              <label>¿Quién lo cubre?</label>
              <select id="t-p1-cubierto-por">
                <option value="">— Seleccionar —</option>
                ${personalList.map(p=>`<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-light);padding-top:12px;margin-bottom:12px;">
          <div class="card-title" style="font-size:12px;margin-bottom:10px;">PERSONA #2 <span style="font-weight:400;color:var(--text-muted);">(opcional)</span></div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>Personal</label>
              <select id="t-p2">
                <option value="">— Solo uno —</option>
                ${personalList.map(p=>`<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Estado de asistencia</label>
              <select id="t-p2-estado" onchange="Pages._toggleCubierto('p2', this.value)">
                <option value="presente">Presente</option>
                <option value="demorado">Demorado</option>
                <option value="cubierto">Cubierto por otro</option>
                <option value="ausente">Ausente</option>
              </select>
            </div>
            <div class="form-group" id="p2-cubierto-por" style="display:none;grid-column:span 2;">
              <label>¿Quién lo cubre?</label>
              <select id="t-p2-cubierto-por">
                <option value="">— Seleccionar —</option>
                ${personalList.map(p=>`<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Notas del turno</label>
          <input type="text" id="t-notas" placeholder="Observaciones..." />
        </div>

        <div class="form-actions" style="margin-top:20px;">
          <button class="btn btn-success" id="btn-iniciar-turno">◷ Iniciar turno</button>
        </div>
      </div>

      <div>
        <div class="page-title" style="font-size:15px;margin-bottom:16px;">Últimos turnos</div>
        <div id="historial-turnos"></div>
      </div>
    `;

    const historial = await DB.query(`
      SELECT t.*,
             GROUP_CONCAT(p.nombre || ' ' || p.apellido, ', ') as personal_names,
             SUM(tp.horas_cumplidas) as total_horas
      FROM turnos t
      LEFT JOIN turno_personal tp ON tp.turno_id = t.id
      LEFT JOIN personal p ON p.id = tp.personal_id
      GROUP BY t.id
      ORDER BY t.id DESC LIMIT 10
    `);

    document.getElementById('historial-turnos').innerHTML = UI.buildTable(
      ['Fecha', 'Inicio', 'Fin', 'Personal', 'Horas'],
      historial.map(t => `
        <tr>
          <td class="text-mono">${UI.formatDate(t.fecha)}</td>
          <td>${UI.formatTime(t.hora_inicio)}</td>
          <td>${UI.formatTime(t.hora_fin) || '<span class="badge badge-green">activo</span>'}</td>
          <td>${t.personal_names || '—'}</td>
          <td class="text-mono">${t.total_horas ? t.total_horas.toFixed(1) + 'h' : '—'}</td>
        </tr>
      `),
      'Sin turnos registrados'
    );

    document.getElementById('btn-iniciar-turno').onclick = async () => {
      const fecha    = document.getElementById('t-fecha').value;
      const hora_ini = document.getElementById('t-hora').value;
      const p1       = document.getElementById('t-p1').value;
      const p1estado = document.getElementById('t-p1-estado').value;
      const p1cubPor = document.getElementById('t-p1-cubierto-por')?.value || null;
      const p2       = document.getElementById('t-p2').value;
      const p2estado = document.getElementById('t-p2-estado').value;
      const p2cubPor = document.getElementById('t-p2-cubierto-por')?.value || null;
      const notas    = document.getElementById('t-notas').value;

      if (!p1) { UI.toast('Seleccioná al menos una persona', 'error'); return; }
      if (p1 && p2 && p1 === p2) { UI.toast('No podés seleccionar la misma persona dos veces', 'error'); return; }

      const personal = [
        p1 ? { id: Number(p1), estado: p1estado, cubierto_por_id: p1estado === 'cubierto' && p1cubPor ? Number(p1cubPor) : null } : null,
        p2 ? { id: Number(p2), estado: p2estado, cubierto_por_id: p2estado === 'cubierto' && p2cubPor ? Number(p2cubPor) : null } : null,
      ].filter(Boolean);

      const res = await window.api.iniciarTurno({ fecha, hora_inicio: hora_ini, personal, notas });

      if (res.ok) {
        await App.refreshTurno();
        UI.toast('Turno iniciado', 'success');
        Pages.turno();
      } else {
        UI.toast('Error al iniciar turno: ' + (res.error || ''), 'error');
      }
    };

    Pages._toggleCubierto = (prefix, estado) => {
      const div = document.getElementById(`${prefix}-cubierto-por`);
      if (div) div.style.display = estado === 'cubierto' ? 'block' : 'none';
    };
  }
};
