// ─── Historial de Turnos ──────────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.historial = async function() {
  const container = document.getElementById('page-container');

  // Filtros
  const filtroMes = new Date().toISOString().slice(0,7); // YYYY-MM por defecto

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Historial de Turnos</h1>
        <div class="page-subtitle">Registro completo de turnos pasados</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:16px;padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Mes:</label>
          <input type="month" id="filtro-mes" value="${filtroMes}" style="width:160px;" />
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Personal:</label>
          <select id="filtro-personal" style="width:180px;">
            <option value="">Todos</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Pages._cargarHistorial()">🔍 Filtrar</button>
        <button class="btn btn-secondary btn-sm" onclick="Pages._limpiarFiltros()">✕ Limpiar</button>
        <div id="resumen-filtro" style="margin-left:auto;font-size:12px;color:var(--text-muted);"></div>
      </div>
    </div>

    <!-- Resumen del período -->
    <div id="resumen-periodo" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;"></div>

    <!-- Lista de turnos -->
    <div id="lista-historial"></div>
  `;

  // Cargar personal en el filtro
  const personal = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
  const selPersonal = document.getElementById('filtro-personal');
  personal.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.apellido}, ${p.nombre}`;
    selPersonal.appendChild(opt);
  });

  document.getElementById('filtro-mes').addEventListener('change', Pages._cargarHistorial);
  document.getElementById('filtro-personal').addEventListener('change', Pages._cargarHistorial);

  Pages._limpiarFiltros = () => {
    document.getElementById('filtro-mes').value = filtroMes;
    document.getElementById('filtro-personal').value = '';
    Pages._cargarHistorial();
  };

  Pages._cargarHistorial = async () => {
    const mes      = document.getElementById('filtro-mes').value;       // YYYY-MM
    const pid      = document.getElementById('filtro-personal').value;
    const [año, m] = mes.split('-');
    const desde    = `${mes}-01`;
    const hasta    = `${mes}-31`;

    // Turnos del período
    let turnos = await DB.query(`
      SELECT t.*,
             ROUND(SUM(CASE WHEN tp.estado NOT IN ('ausente') THEN COALESCE(tp.horas_cumplidas,0) ELSE 0 END),1) as total_horas,
             COUNT(DISTINCT tp.personal_id) as cant_personal
      FROM turnos t
      LEFT JOIN turno_personal tp ON tp.turno_id = t.id
      WHERE t.fecha BETWEEN ? AND ? AND t.hora_fin IS NOT NULL
      ${pid ? `AND tp.personal_id = ${pid}` : ''}
      GROUP BY t.id
      ORDER BY t.fecha DESC, t.hora_inicio DESC
    `, desde, hasta);

    // Resumen del período
    const totalHoras = turnos.reduce((s,t) => s + (t.total_horas||0), 0);
    const totalTurnos = turnos.length;
    const [nombreMes] = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].slice(Number(m)-1);

    // Horas por persona en el período
    const horasPorPersona = await DB.query(`
      SELECT p.nombre, p.apellido, p.rol,
             ROUND(SUM(CASE WHEN tp.estado NOT IN ('ausente') THEN COALESCE(tp.horas_cumplidas,0) ELSE 0 END),1) as horas,
             COUNT(CASE WHEN tp.estado NOT IN ('ausente','salio') THEN 1 END) as presencias,
             COUNT(CASE WHEN tp.estado = 'ausente' THEN 1 END) as ausencias
      FROM turno_personal tp
      JOIN personal p ON p.id = tp.personal_id
      JOIN turnos t ON t.id = tp.turno_id
      WHERE t.fecha BETWEEN ? AND ? AND t.hora_fin IS NOT NULL
      ${pid ? `AND tp.personal_id = ${pid}` : ''}
      GROUP BY tp.personal_id
      ORDER BY horas DESC
    `, desde, hasta);

    document.getElementById('resumen-filtro').textContent =
      `${totalTurnos} turno${totalTurnos!==1?'s':''} encontrado${totalTurnos!==1?'s':''}`;

    document.getElementById('resumen-periodo').innerHTML = `
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--accent);">${totalTurnos}</div>
        <div style="font-size:11px;color:var(--text-muted);">📅 Turnos en ${nombreMes}</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--green);">${totalHoras.toFixed(1)}h</div>
        <div style="font-size:11px;color:var(--text-muted);">⏱️ Horas totales</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--yellow);">${horasPorPersona.length}</div>
        <div style="font-size:11px;color:var(--text-muted);">👥 Personas activas</div>
      </div>
      <div class="card" style="text-align:center;padding:14px;">
        <div style="font-size:26px;font-weight:700;color:var(--purple);">${totalTurnos ? (totalHoras/totalTurnos).toFixed(1)+'h' : '—'}</div>
        <div style="font-size:11px;color:var(--text-muted);">📊 Promedio por turno</div>
      </div>
    `;

    // Ranking de horas del período
    const rankingHTML = horasPorPersona.length === 0 ? '' : `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🏅 Horas por persona — ${nombreMes} ${año}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${horasPorPersona.map((p, i) => {
            const max = horasPorPersona[0].horas || 1;
            const pct = Math.round((p.horas / max) * 100);
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            return `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:24px;text-align:center;font-size:14px;">${medal || (i+1)}</div>
              <div style="width:140px;font-size:13px;font-weight:500;">${p.nombre} ${p.apellido}</div>
              <div style="flex:1;background:var(--bg-elevated);border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${pct}%;background:var(--accent);height:100%;border-radius:4px;transition:width .4s;"></div>
              </div>
              <div style="width:50px;text-align:right;font-size:13px;font-family:var(--font-mono);color:var(--accent);">${p.horas}h</div>
              <div style="font-size:11px;color:var(--text-muted);width:90px;">${p.presencias} presencias · ${p.ausencias} ausencias</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    // Lista de turnos con detalle expandible
    const turnosHTML = turnos.length === 0
      ? `<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">Sin turnos en este período</div>`
      : turnos.map(t => `
        <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;">
          <div onclick="Pages._toggleDetalle(${t.id}, this)"
               style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;transition:background .15s;"
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
                <span style="font-size:12px;color:var(--text-muted);margin-left:6px;">
                  ${_duracion(t.hora_inicio, t.hora_fin)}
                </span>
              </div>
              ${t.notas ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">📝 ${t.notas}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:13px;font-family:var(--font-mono);color:var(--green);">${t.total_horas||0}h</span>
              <span style="font-size:11px;color:var(--text-muted);">👥 ${t.cant_personal}</span>
              <span style="font-size:12px;color:var(--text-muted);">▼</span>
            </div>
          </div>
          <div id="detalle-${t.id}" style="display:none;border-top:1px solid var(--border-light);padding:14px 16px;background:var(--bg-elevated);">
            <div style="color:var(--text-muted);font-size:12px;">Cargando...</div>
          </div>
        </div>`).join('');

    document.getElementById('lista-historial').innerHTML = rankingHTML + turnosHTML;
  };

  // Expandir/colapsar detalle de un turno
  Pages._toggleDetalle = async (turnoId, headerEl) => {
    const det = document.getElementById(`detalle-${turnoId}`);
    const isOpen = det.style.display !== 'none';
    det.style.display = isOpen ? 'none' : 'block';
    const arrow = headerEl.querySelector('span:last-child');
    if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
    if (!isOpen && det.dataset.loaded !== '1') {
      det.dataset.loaded = '1';
      const personas = await DB.query(`
        SELECT tp.*,
               p.nombre, p.apellido, p.rol,
               pr.nombre as reemplazado_nombre, pr.apellido as reemplazado_apellido
        FROM turno_personal tp
        JOIN personal p ON p.id = tp.personal_id
        LEFT JOIN personal pr ON pr.id = tp.reemplazado_id
        WHERE tp.turno_id = ?
        ORDER BY tp.hora_entrada NULLS LAST
      `, turnoId);

      const estadoInfo = {
        presente:     { cls:'badge-green',  icon:'✅' },
        demorado:     { cls:'badge-yellow', icon:'⏳' },
        reemplazando: { cls:'badge-blue',   icon:'🔄' },
        ausente:      { cls:'badge-red',    icon:'❌' },
        salio:        { cls:'badge-gray',   icon:'🚪' },
      };

      det.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${personas.map(tp => {
            const ei = estadoInfo[tp.estado] || { cls:'badge-gray', icon:'?' };
            const horas = tp.horas_cumplidas ? `${tp.horas_cumplidas.toFixed(1)}h` : '—';
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-surface);border-radius:var(--radius);border:1px solid var(--border-light);">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--accent);flex-shrink:0;">${tp.nombre[0]}${tp.apellido[0]}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:500;">${tp.nombre} ${tp.apellido}
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400;">· ${tp.rol}</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);">
                  ${tp.hora_entrada ? `Entrada: ${UI.formatTime(tp.hora_entrada)}` : 'Sin entrada registrada'}
                  ${tp.hora_salida  ? ` · Salida: ${UI.formatTime(tp.hora_salida)}` : ''}
                  ${tp.estado === 'reemplazando' && tp.reemplazado_nombre ? ` · Reemplazó a ${tp.reemplazado_nombre} ${tp.reemplazado_apellido}` : ''}
                </div>
              </div>
              <span class="badge ${ei.cls}">${ei.icon} ${tp.estado}</span>
              <span style="font-size:13px;font-family:var(--font-mono);color:var(--green);min-width:32px;text-align:right;">${horas}</span>
            </div>`;
          }).join('')}
        </div>`;
    }
  };

  // Cargar al inicio
  Pages._cargarHistorial();
};

function _mesCorto(fecha) {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const m = parseInt(String(fecha).slice(5,7));
  return meses[m-1] || '';
}
function _duracion(ini, fin) {
  if (!ini || !fin) return '';
  const [hi,mi] = String(ini).split(':').map(Number);
  const [hf,mf] = String(fin).split(':').map(Number);
  const mins = (hf*60+mf)-(hi*60+mi);
  if (mins <= 0) return '';
  const h = Math.floor(mins/60);
  const m = mins%60;
  return `(${h?h+'h':''}${m?m+'min':''})`;
}