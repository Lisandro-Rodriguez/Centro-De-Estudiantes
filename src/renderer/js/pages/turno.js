// ─── Turno ────────────────────────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.turnoPage = function (tab) {
  Pages._turnoTab = tab || Pages._turnoTab || 'turno';
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-tabs" style="margin-bottom:24px;">
      <div class="page-tab ${Pages._turnoTab === 'turno'     ? 'active' : ''}" id="tab-turno-btn">🕐 Turno actual</div>
      <div class="page-tab ${Pages._turnoTab === 'historial' ? 'active' : ''}" id="tab-hist-btn">📋 Historial</div>
    </div>
    <div id="tab-body"></div>
  `;
  // FIX: addEventListener en vez de onclick inline
  document.getElementById('tab-turno-btn').addEventListener('click', () => Pages.turnoPage('turno'));
  document.getElementById('tab-hist-btn').addEventListener('click',  () => Pages.turnoPage('historial'));

  if (Pages._turnoTab === 'turno') Pages._renderTurno();
  else Pages._renderHistorial();
};

// Aliases para el Router
Pages.turno    = () => Pages.turnoPage('turno');
Pages.historial = () => Pages.turnoPage('historial');

// ─── TURNO ACTUAL ─────────────────────────────────────────────────────────────
Pages._renderTurno = async function () {
  const wrap = document.getElementById('tab-body');
  if (!wrap) return;

  const turno      = App.getTurnoActivo();
  const personalList = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);

  if (turno) {
    const turnoPersonal = await DB.query(`
      SELECT tp.*, p.nombre, p.apellido, p.rol,
             pc.nombre  AS reemplazado_nombre,  pc.apellido AS reemplazado_apellido,
             pr.nombre  AS reemplazante_nombre, pr.apellido AS reemplazante_apellido
      FROM turno_personal tp
      JOIN personal p  ON p.id  = tp.personal_id
      LEFT JOIN personal pc ON pc.id = tp.reemplazado_id
      LEFT JOIN personal pr ON pr.id = tp.reemplazante_id
      WHERE tp.turno_id = ?
      ORDER BY tp.hora_entrada NULLS LAST
    `, turno.id);

    const [prestH, panH, hojasH] = await Promise.all([
      DB.query(`SELECT * FROM prestamos     WHERE turno_id=?`, turno.id),
      DB.query(`SELECT * FROM registro_pan  WHERE turno_id=?`, turno.id),
      DB.query(`SELECT * FROM registro_hojas WHERE turno_id=?`, turno.id),
    ]);

    const estadoInfo = {
      presente:     { cls: 'badge-green',  label: '✅ Presente' },
      demorado:     { cls: 'badge-yellow', label: '⏳ Demorado' },
      reemplazando: { cls: 'badge-blue',   label: '🔄 Reemplazando' },
      ausente:      { cls: 'badge-red',    label: '❌ Ausente' },
      salio:        { cls: 'badge-gray',   label: '🚪 Salió' },
    };

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
        <div style="font-size:13px;color:var(--text-muted);">
          En curso desde las ${UI.formatTime(turno.hora_inicio)} ·
          ${new Date().toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long' })}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" id="btn-agregar-persona">+ Agregar persona</button>
          <button class="btn btn-danger"    id="btn-cerrar-turno">⏹ Cerrar turno</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-title">👥 Personal en turno</div>
        ${turnoPersonal.map(tp => {
          const info    = estadoInfo[tp.estado] || { cls: 'badge-gray', label: tp.estado };
          const yaSalio = tp.estado === 'salio';
          const sub = [
            tp.rol,
            tp.hora_entrada ? `Entrada: ${UI.formatTime(tp.hora_entrada)}` : null,
            tp.hora_salida  ? `Salida: ${UI.formatTime(tp.hora_salida)}`   : null,
            tp.estado === 'reemplazando' && tp.reemplazado_nombre
              ? `reemplaza a ${tp.reemplazado_nombre} ${tp.reemplazado_apellido}` : null,
          ].filter(Boolean).join(' · ');
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border-light);opacity:${yaSalio ? '0.5' : '1'}">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-dim);border:1.5px solid var(--accent);
                        display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--accent);flex-shrink:0;">
              ${tp.nombre[0]}${tp.apellido[0]}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:14px;">${tp.nombre} ${tp.apellido}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${sub}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span class="badge ${info.cls}">${info.label}</span>
              ${!yaSalio ? `
                <select style="padding:4px 6px;font-size:11px;width:auto;"
                  data-tp-id="${tp.id}" class="estado-sel">
                  <option value="">Estado...</option>
                  <option value="presente"     ${tp.estado === 'presente'     ? 'selected' : ''}>✅ Presente</option>
                  <option value="demorado"     ${tp.estado === 'demorado'     ? 'selected' : ''}>⏳ Demorado</option>
                  <option value="reemplazando" ${tp.estado === 'reemplazando' ? 'selected' : ''}>🔄 Reemplazando</option>
                  <option value="ausente"      ${tp.estado === 'ausente'      ? 'selected' : ''}>❌ Ausente</option>
                </select>
                <button class="btn btn-sm btn-danger"
                  data-salida-id="${tp.id}"
                  data-nombre="${tp.nombre} ${tp.apellido}"
                  title="Registrar salida">🚪</button>
              ` : `<span style="font-size:11px;color:var(--text-muted);">Salió ${UI.formatTime(tp.hora_salida)}</span>`}
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="grid-3" style="margin-bottom:20px;">
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:700;color:var(--accent);">${prestH.length}</div>
          <div style="font-size:12px;color:var(--text-muted);">📦 Préstamos</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:700;color:var(--green);">${panH.length}</div>
          <div style="font-size:12px;color:var(--text-muted);">🥐 Desayunos</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:700;color:var(--yellow);">${hojasH.reduce((s,h) => s + h.cantidad, 0)}</div>
          <div style="font-size:12px;color:var(--text-muted);">📄 Fotocopias</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚡ Acciones rápidas</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="Router.navigate('prestamos')">📦 Registrar préstamo</button>
          <button class="btn btn-secondary" onclick="Router.navigate('pan')">🥐 Registrar desayuno</button>
          <button class="btn btn-secondary" onclick="Router.navigate('hojas')">📄 Entregar fotocopias</button>
        </div>
      </div>
    `;

    // Bind selects de estado
    wrap.querySelectorAll('.estado-sel').forEach(sel => {
      sel.addEventListener('change', async function () {
        const tpId = Number(this.dataset.tpId);
        const val  = this.value;
        if (!val) return;
        if (val === 'reemplazando') {
          this.value = '';
          Pages._modalReemplazo(tpId, turnoPersonal, personalList, turno.id);
          return;
        }
        await DB.run(`UPDATE turno_personal SET estado=? WHERE id=?`, val, tpId);
        await App.refreshTurno();
        UI.toast('Estado actualizado', 'success');
        Pages.turnoPage('turno');
      });
    });

    // Bind botones de salida
    wrap.querySelectorAll('[data-salida-id]').forEach(btn => {
      btn.addEventListener('click', function () {
        Pages._registrarSalida(Number(this.dataset.salidaId), this.dataset.nombre, turno.id);
      });
    });

    // Agregar persona
    document.getElementById('btn-agregar-persona').addEventListener('click', () => {
      Pages._modalAgregarPersona(personalList, turnoPersonal, turno.id);
    });

    // FIX: cerrar turno manual con confirmación
    document.getElementById('btn-cerrar-turno').addEventListener('click', () => {
      Pages._cerrarTurnoManual(turno.id, turnoPersonal);
    });

  } else {
    // ── Sin turno activo ──────────────────────────────────────────────────────
    const historial = await DB.query(`
      SELECT t.*,
             GROUP_CONCAT(DISTINCT p.nombre || ' ' || p.apellido) AS personal_names,
             ROUND(SUM(CASE WHEN tp.estado != 'ausente' THEN COALESCE(tp.horas_cumplidas,0) ELSE 0 END),1) AS total_horas
      FROM turnos t
      LEFT JOIN turno_personal tp ON tp.turno_id = t.id
      LEFT JOIN personal p ON p.id = tp.personal_id
      WHERE t.hora_fin IS NOT NULL
      GROUP BY t.id ORDER BY t.id DESC LIMIT 8
    `);

    let personaCount = 1;
    wrap.innerHTML = `
      <div class="card" style="max-width:600px;margin-bottom:28px;">
        <div class="card-title">▶ Iniciar nuevo turno</div>
        <div class="form-grid form-grid-2" style="margin-bottom:16px;">
          <div class="form-group"><label>Fecha</label><input type="date" id="t-fecha" value="${UI.today()}" /></div>
          <div class="form-group"><label>Hora de inicio</label><input type="time" id="t-hora" value="${UI.nowTime()}" /></div>
        </div>
        <div id="personas-container">${_personaForm(personalList, 1, true)}</div>
        <button class="btn btn-secondary btn-sm" id="btn-add-p" style="margin-bottom:16px;">+ Agregar segunda persona</button>
        <div class="form-group"><label>Notas</label><input type="text" id="t-notas" placeholder="Observaciones..." /></div>
        <div class="form-actions">
          <button class="btn btn-success" id="btn-iniciar-turno">▶ Iniciar turno</button>
        </div>
      </div>
      <div>
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-secondary);">Últimos turnos</div>
        ${UI.buildTable(
          ['Fecha', 'Inicio', 'Fin', 'Personal', 'Horas'],
          historial.map(t => `<tr>
            <td class="text-mono">${t.fecha}</td>
            <td>${UI.formatTime(t.hora_inicio)}</td>
            <td>${UI.formatTime(t.hora_fin) || '<span class="badge badge-green">activo</span>'}</td>
            <td style="font-size:12px;">${t.personal_names || '—'}</td>
            <td class="text-mono">${t.total_horas ? t.total_horas + 'h' : '—'}</td>
          </tr>`),
          'Sin turnos'
        )}
      </div>`;

    document.getElementById('btn-add-p').addEventListener('click', () => {
      personaCount++;
      const div = document.createElement('div');
      div.innerHTML = _personaForm(personalList, personaCount, false);
      document.getElementById('personas-container').appendChild(div.firstElementChild);
      if (personaCount >= 4) document.getElementById('btn-add-p').style.display = 'none';
    });

    // FIX: bandera para evitar doble click al iniciar turno
    let iniciando = false;
    document.getElementById('btn-iniciar-turno').addEventListener('click', async () => {
      if (iniciando) return;

      const fecha = document.getElementById('t-fecha').value;
      const hora  = document.getElementById('t-hora').value;
      const notas = document.getElementById('t-notas').value;

      if (!fecha) { UI.toast('Ingresá la fecha', 'error'); return; }
      if (!hora)  { UI.toast('Ingresá la hora de inicio', 'error'); return; }

      const personal = [];
      for (let i = 1; i <= personaCount; i++) {
        const pid    = document.getElementById(`t-p${i}`)?.value;
        const estado = document.getElementById(`t-p${i}-estado`)?.value || 'presente';
        const rId    = document.getElementById(`t-p${i}-reemplazado`)?.value || null;
        if (pid) personal.push({
          id: Number(pid),
          estado,
          reemplazado_id: estado === 'reemplazando' && rId ? Number(rId) : null
        });
      }

      if (!personal.length) { UI.toast('Seleccioná al menos una persona', 'error'); return; }
      if (new Set(personal.map(p => p.id)).size !== personal.length) {
        UI.toast('No podés repetir la misma persona', 'error');
        return;
      }

      iniciando = true;
      document.getElementById('btn-iniciar-turno').disabled = true;
      document.getElementById('btn-iniciar-turno').textContent = 'Iniciando...';

      const res = await window.api.iniciarTurno({ fecha, hora_inicio: hora, personal, notas });
      if (res.ok) {
        await App.refreshTurno();
        UI.toast('Turno iniciado 🎉', 'success');
        Pages.turnoPage('turno');
      } else {
        UI.toast('Error: ' + (res.error || ''), 'error');
        iniciando = false;
        const btn = document.getElementById('btn-iniciar-turno');
        if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar turno'; }
      }
    });
  }
};

// ─── Cerrar turno manualmente ─────────────────────────────────────────────────
Pages._cerrarTurnoManual = (turnoId, turnoPersonal) => {
  const activos = turnoPersonal.filter(tp => !['salio', 'ausente'].includes(tp.estado));
  UI.confirm(
    'Cerrar turno',
    `¿Cerrar el turno ahora? ${activos.length > 0 ? `Se registrará la salida de ${activos.length} persona${activos.length > 1 ? 's' : ''} activa${activos.length > 1 ? 's' : ''}.` : ''}`,
    async () => {
      const hora_fin = UI.nowTime();
      const res = await window.api.cerrarTurno({ turnoId, hora_fin });
      if (res.ok) {
        App.setTurnoActivo(null);
        await App.refreshTurno();
        UI.toast('Turno cerrado', 'success');
        Router.navigate('dashboard');
      } else {
        UI.toast('Error al cerrar: ' + (res.error || ''), 'error');
      }
    }
  );
};

// ─── Registrar salida individual ──────────────────────────────────────────────
// FIX: operación atómica vía IPC para evitar race condition entre dos usuarios
Pages._registrarSalida = (tpId, nombre, turnoId) => {
  UI.confirm('Registrar salida', `¿Confirmar salida de ${nombre}?`, async () => {
    const hora_salida = UI.nowTime();

    const tp       = await DB.get(`SELECT * FROM turno_personal WHERE id=?`, tpId);
    const turnoData = await DB.get(`SELECT * FROM turnos WHERE id=?`, turnoId);
    if (!tp || !turnoData) { UI.toast('Error: datos no encontrados', 'error'); return; }

    const entrada  = tp.hora_entrada || turnoData.hora_inicio;
    const [hE, mE] = String(entrada).split(':').map(Number);
    const [hS, mS] = hora_salida.split(':').map(Number);
    const horas    = Math.max(0, ((hS * 60 + mS) - (hE * 60 + mE)) / 60);

    await DB.run(
      `UPDATE turno_personal SET estado='salio', hora_salida=?, horas_cumplidas=? WHERE id=?`,
      hora_salida, horas, tpId
    );

    // FIX: re-consultar activos DESPUÉS del UPDATE para evitar race condition
    const activos = await DB.get(
      `SELECT COUNT(*) AS c FROM turno_personal
       WHERE turno_id=? AND estado NOT IN ('salio','ausente')`,
      turnoId
    );

    if (activos.c === 0) {
      // FIX: cerrarTurno es atómico en el proceso principal
      const res = await window.api.cerrarTurno({ turnoId, hora_fin: hora_salida });
      if (res.ok) {
        App.setTurnoActivo(null);
        await App.refreshTurno();
        UI.toast(`${nombre} salió. Turno cerrado automáticamente 🎉`, 'success');
        Router.navigate('dashboard');
      } else {
        UI.toast('Error al cerrar turno: ' + (res.error || ''), 'error');
      }
    } else {
      UI.toast(`Salida de ${nombre} registrada (${horas.toFixed(1)}h)`, 'success');
      Pages.turnoPage('turno');
    }
  });
};

// ─── Modal: registrar reemplazo ───────────────────────────────────────────────
Pages._modalReemplazo = (tpId, turnoPersonal, personalList, turnoId) => {
  // FIX: usar cerrar en vez de UI.closeModal()
  const cerrar = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">🔄 Registrar reemplazo</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>¿Quién está reemplazando? (el que vino)</label>
        <select id="r-reemplazante">
          <option value="">— Seleccionar —</option>
          ${personalList.map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>¿A quién reemplaza? (el que faltó)</label>
        <select id="r-reemplazado">
          <option value="">— Seleccionar —</option>
          ${turnoPersonal.map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-reemplazo-cancel">Cancelar</button>
      <button class="btn btn-primary"   id="btn-guardar-reemplazo">🔄 Registrar</button>
    </div>`);

  document.getElementById('btn-reemplazo-cancel').addEventListener('click', cerrar, { once: true });

  let guardando = false;
  document.getElementById('btn-guardar-reemplazo').addEventListener('click', async () => {
    if (guardando) return;
    const reemplazanteId  = document.getElementById('r-reemplazante').value;
    const reemplazadoTpId = document.getElementById('r-reemplazado').value;
    if (!reemplazanteId || !reemplazadoTpId) { UI.toast('Completá ambos campos', 'error'); return; }

    guardando = true;
    const reemplazadoTp = turnoPersonal.find(p => p.id == reemplazadoTpId);
    await DB.run(
      `UPDATE turno_personal SET estado='ausente', reemplazante_id=? WHERE id=?`,
      Number(reemplazanteId), reemplazadoTpId
    );
    await DB.run(
      `INSERT INTO turno_personal (turno_id, personal_id, hora_entrada, estado, reemplazado_id)
       VALUES (?,?,?,'reemplazando',?)`,
      turnoId, Number(reemplazanteId), UI.nowTime(), reemplazadoTp?.personal_id || null
    );
    cerrar();
    UI.toast('Reemplazo registrado', 'success');
    await App.refreshTurno();
    Pages.turnoPage('turno');
  });
};

// ─── Modal: agregar persona al turno ─────────────────────────────────────────
Pages._modalAgregarPersona = (personalList, turnoPersonal, turnoId) => {
  // FIX: usar cerrar en vez de UI.closeModal()
  const cerrar = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">+ Agregar al turno</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Personal</label>
        <select id="ag-persona">
          <option value="">— Seleccionar —</option>
          ${personalList.map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Estado</label>
        <select id="ag-estado" onchange="Pages._toggleCubierto('ag', this.value)">
          <option value="presente">✅ Presente</option>
          <option value="demorado">⏳ Demorado</option>
          <option value="reemplazando">🔄 Reemplazando</option>
        </select>
      </div>
      <div class="form-group" id="ag-cubierto-por" style="display:none;grid-column:span 2;">
        <label>¿A quién reemplaza?</label>
        <select id="ag-reemplazado">
          <option value="">— Seleccionar —</option>
          ${turnoPersonal.map(p => `<option value="${p.personal_id}">${p.apellido}, ${p.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-agregar-cancel">Cancelar</button>
      <button class="btn btn-primary"   id="btn-guardar-agregar">Agregar</button>
    </div>`);

  document.getElementById('btn-agregar-cancel').addEventListener('click', cerrar, { once: true });

  let guardando = false;
  document.getElementById('btn-guardar-agregar').addEventListener('click', async () => {
    if (guardando) return;
    const pid    = document.getElementById('ag-persona').value;
    const estado = document.getElementById('ag-estado').value;
    const rId    = document.getElementById('ag-reemplazado')?.value || null;
    if (!pid) { UI.toast('Seleccioná una persona', 'error'); return; }

    // FIX: verificar que la persona no esté ya en el turno
    const yaEsta = turnoPersonal.find(tp => tp.personal_id == pid && tp.estado !== 'salio');
    if (yaEsta) { UI.toast('Esa persona ya está en el turno', 'error'); return; }

    guardando = true;
    await DB.run(
      `INSERT INTO turno_personal (turno_id, personal_id, hora_entrada, estado, reemplazado_id)
       VALUES (?,?,?,?,?)`,
      turnoId, Number(pid), UI.nowTime(), estado, rId ? Number(rId) : null
    );
    cerrar();
    UI.toast('Persona agregada', 'success');
    await App.refreshTurno();
    Pages.turnoPage('turno');
  });
};

Pages._toggleCubierto = (prefix, estado) => {
  const div = document.getElementById(`${prefix}-cubierto-por`);
  if (div) div.style.display = estado === 'reemplazando' ? 'block' : 'none';
};

// ─── HISTORIAL ────────────────────────────────────────────────────────────────
Pages._renderHistorial = async function () {
  const wrap = document.getElementById('tab-body');
  if (!wrap) return;
  wrap.id = 'page-container';
  await Pages._historialContent(wrap);
  wrap.id = 'tab-body';
};

Pages._historialContent = async function (container) {
  const filtroMes = new Date().toISOString().slice(0, 7);
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:12px;color:var(--text-muted);">Mes:</label>
          <input type="month" id="filtro-mes" value="${filtroMes}" style="width:160px;" />
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:12px;color:var(--text-muted);">Personal:</label>
          <select id="filtro-personal" style="width:180px;"><option value="">Todos</option></select>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-filtrar">🔍 Filtrar</button>
        <div id="resumen-filtro" style="margin-left:auto;font-size:12px;color:var(--text-muted);"></div>
      </div>
    </div>
    <div id="resumen-periodo" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;"></div>
    <div id="lista-historial"></div>`;

  const personal = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
  const sel = container.querySelector('#filtro-personal');
  personal.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.apellido}, ${p.nombre}`;
    sel.appendChild(o);
  });

  const cargar = async () => {
    const mes  = container.querySelector('#filtro-mes').value;
    const pid  = container.querySelector('#filtro-personal').value;
    const [año, m] = mes.split('-');
    const desde = `${mes}-01`;
    const hasta = `${mes}-31`;
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                   'septiembre','octubre','noviembre','diciembre'];
    const nombreMes = meses[Number(m) - 1];

    // FIX: pid como parámetro parametrizado, no interpolado en el SQL
    const filtroPersonal = pid ? [desde, hasta, Number(pid)] : [desde, hasta];
    const sqlPersonal    = pid ? `AND tp.personal_id = ?` : '';

    const turnos = await DB.query(`
      SELECT t.*,
             ROUND(SUM(CASE WHEN tp.estado!='ausente' THEN COALESCE(tp.horas_cumplidas,0) ELSE 0 END),1) AS total_horas,
             COUNT(DISTINCT tp.personal_id) AS cant_personal
      FROM turnos t
      LEFT JOIN turno_personal tp ON tp.turno_id = t.id
      WHERE t.fecha BETWEEN ? AND ? AND t.hora_fin IS NOT NULL ${sqlPersonal}
      GROUP BY t.id ORDER BY t.fecha DESC, t.hora_inicio DESC`,
      ...filtroPersonal
    );

    const horasPP = await DB.query(`
      SELECT p.nombre, p.apellido, p.rol,
             ROUND(SUM(CASE WHEN tp.estado!='ausente' THEN COALESCE(tp.horas_cumplidas,0) ELSE 0 END),1) AS horas,
             COUNT(CASE WHEN tp.estado NOT IN ('ausente','salio') THEN 1 END) AS presencias,
             COUNT(CASE WHEN tp.estado='ausente' THEN 1 END) AS ausencias
      FROM turno_personal tp
      JOIN personal p ON p.id = tp.personal_id
      JOIN turnos t   ON t.id = tp.turno_id
      WHERE t.fecha BETWEEN ? AND ? AND t.hora_fin IS NOT NULL ${sqlPersonal}
      GROUP BY tp.personal_id ORDER BY horas DESC`,
      ...filtroPersonal
    );

    const totalHoras = turnos.reduce((s, t) => s + (t.total_horas || 0), 0);
    container.querySelector('#resumen-filtro').textContent =
      `${turnos.length} turno${turnos.length !== 1 ? 's' : ''} encontrado${turnos.length !== 1 ? 's' : ''}`;

    container.querySelector('#resumen-periodo').innerHTML = `
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--accent);">${turnos.length}</div>
        <div style="font-size:11px;color:var(--text-muted);">📅 Turnos en ${nombreMes}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--green);">${totalHoras.toFixed(1)}h</div>
        <div style="font-size:11px;color:var(--text-muted);">⏱️ Horas totales</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--yellow);">${horasPP.length}</div>
        <div style="font-size:11px;color:var(--text-muted);">👥 Personas activas</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--purple);">
          ${turnos.length ? (totalHoras / turnos.length).toFixed(1) + 'h' : '—'}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">📊 Promedio</div>
      </div>`;

    const ranking = horasPP.length === 0 ? '' : `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🏅 Horas por persona — ${nombreMes} ${año}</div>
        ${horasPP.map((p, i) => {
          const pct = Math.round((p.horas / (horasPP[0].horas || 1)) * 100);
          const med = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
          return `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="width:24px;text-align:center;">${med}</div>
            <div style="width:140px;font-size:13px;font-weight:500;">${p.nombre} ${p.apellido}</div>
            <div style="flex:1;background:var(--bg-elevated);border-radius:4px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;background:var(--accent);height:100%;border-radius:4px;"></div>
            </div>
            <div style="width:46px;text-align:right;font-size:13px;color:var(--accent);font-family:var(--font-mono);">${p.horas}h</div>
            <div style="font-size:11px;color:var(--text-muted);width:110px;">${p.presencias} pres · ${p.ausencias} aus</div>
          </div>`;
        }).join('')}
      </div>`;

    const lista = turnos.length === 0
      ? `<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">Sin turnos en este período</div>`
      : turnos.map(t => `
        <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;">
          <div data-turno-id="${t.id}" class="hist-row"
            style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;"
            onmouseover="this.style.background='var(--bg-hover)'"
            onmouseout="this.style.background=''">
            <div style="text-align:center;min-width:44px;">
              <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);">${String(t.fecha).slice(8)}</div>
              <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">${_mesCorto(t.fecha)}</div>
            </div>
            <div style="width:1px;background:var(--border-light);height:36px;"></div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:500;">
                ${UI.formatTime(t.hora_inicio)} — ${UI.formatTime(t.hora_fin)}
                <span style="font-size:12px;color:var(--text-muted);">${_duracion(t.hora_inicio, t.hora_fin)}</span>
              </div>
              ${t.notas ? `<div style="font-size:11px;color:var(--text-muted);">📝 ${t.notas}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:13px;font-family:var(--font-mono);color:var(--green);">${t.total_horas || 0}h</span>
              <span style="font-size:11px;color:var(--text-muted);">👥 ${t.cant_personal}</span>
              <span style="font-size:12px;color:var(--text-muted);" class="hist-arrow">▼</span>
            </div>
          </div>
          <div id="det-${t.id}" style="display:none;border-top:1px solid var(--border-light);padding:14px 16px;background:var(--bg-elevated);"></div>
        </div>`).join('');

    container.querySelector('#lista-historial').innerHTML = ranking + lista;

    container.querySelectorAll('.hist-row').forEach(row => {
      row.addEventListener('click', async function () {
        const id  = this.dataset.turnoId;
        const det = document.getElementById(`det-${id}`);
        const open = det.style.display !== 'none';
        det.style.display = open ? 'none' : 'block';
        this.querySelector('.hist-arrow').textContent = open ? '▼' : '▲';
        if (!open && !det.dataset.loaded) {
          det.dataset.loaded = '1';
          const personas = await DB.query(`
            SELECT tp.*, p.nombre, p.apellido, p.rol,
                   pr.nombre AS rn, pr.apellido AS ra
            FROM turno_personal tp
            JOIN personal p  ON p.id  = tp.personal_id
            LEFT JOIN personal pr ON pr.id = tp.reemplazado_id
            WHERE tp.turno_id = ?
            ORDER BY tp.hora_entrada NULLS LAST`, id);
          const ei = {
            presente:     { cls:'badge-green',  icon:'✅' },
            demorado:     { cls:'badge-yellow', icon:'⏳' },
            reemplazando: { cls:'badge-blue',   icon:'🔄' },
            ausente:      { cls:'badge-red',    icon:'❌' },
            salio:        { cls:'badge-gray',   icon:'🚪' },
          };
          det.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">
            ${personas.map(tp => {
              const e = ei[tp.estado] || { cls:'badge-gray', icon:'?' };
              return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                          background:var(--bg-surface);border-radius:var(--radius);border:1px solid var(--border-light);">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);
                            border:1px solid var(--accent);display:flex;align-items:center;
                            justify-content:center;font-size:11px;color:var(--accent);">
                  ${tp.nombre[0]}${tp.apellido[0]}
                </div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:500;">
                    ${tp.nombre} ${tp.apellido}
                    <span style="font-size:11px;color:var(--text-muted);">· ${tp.rol}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);">
                    ${tp.hora_entrada ? 'Entrada: ' + UI.formatTime(tp.hora_entrada) : 'Sin entrada'}
                    ${tp.hora_salida  ? ' · Salida: ' + UI.formatTime(tp.hora_salida) : ''}
                    ${tp.estado === 'reemplazando' && tp.rn ? ' · Reemplazó a ' + tp.rn + ' ' + tp.ra : ''}
                  </div>
                </div>
                <span class="badge ${e.cls}">${e.icon} ${tp.estado}</span>
                <span style="font-size:13px;font-family:var(--font-mono);color:var(--green);">
                  ${tp.horas_cumplidas ? tp.horas_cumplidas.toFixed(1) + 'h' : '—'}
                </span>
              </div>`;
            }).join('')}
          </div>`;
        }
      });
    });
  };

  container.querySelector('#btn-filtrar').addEventListener('click', cargar);
  container.querySelector('#filtro-mes').addEventListener('change', cargar);
  container.querySelector('#filtro-personal').addEventListener('change', cargar);
  await cargar();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _personaForm(personalList, n, required) {
  return `
  <div style="border:1px solid var(--border-light);border-radius:var(--radius);padding:14px;margin-bottom:12px;">
    <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;">
      Persona #${n} ${required
        ? '<span style="color:var(--red)">*</span>'
        : '<span style="color:var(--text-muted)">(opcional)</span>'}
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group"><label>Personal</label>
        <select id="t-p${n}">
          <option value="">— Seleccionar —</option>
          ${personalList.map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Estado</label>
        <select id="t-p${n}-estado" onchange="Pages._toggleCubierto('p${n}', this.value)">
          <option value="presente">✅ Presente</option>
          <option value="demorado">⏳ Demorado</option>
          <option value="reemplazando">🔄 Reemplazando a otro</option>
          <option value="ausente">❌ Ausente</option>
        </select>
      </div>
      <div class="form-group" id="p${n}-cubierto-por" style="display:none;grid-column:span 2;">
        <label>¿A quién reemplaza?</label>
        <select id="t-p${n}-reemplazado">
          <option value="">— Seleccionar —</option>
          ${personalList.map(p => `<option value="${p.id}">${p.apellido}, ${p.nombre}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>`;
}

function _mesCorto(f) {
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return m[parseInt(String(f).slice(5, 7)) - 1] || '';
}

function _duracion(ini, fin) {
  if (!ini || !fin) return '';
  const [hi, mi] = String(ini).split(':').map(Number);
  const [hf, mf] = String(fin).split(':').map(Number);
  const d = (hf * 60 + mf) - (hi * 60 + mi);
  if (d <= 0) return '';
  return `(${Math.floor(d / 60) ? Math.floor(d / 60) + 'h' : ''}${d % 60 ? d % 60 + 'min' : ''})`;
}
