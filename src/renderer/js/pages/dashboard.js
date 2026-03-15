// ─── Dashboard ────────────────────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.dashboard = async function() {
  const container = document.getElementById('page-container');
  container.innerHTML = `<div style="color:var(--text-muted);padding:40px;text-align:center;">Cargando...</div>`;

  const today = UI.today();
  const ahora = new Date();

  // Cargar todo en paralelo
  const [
    , stockBajo, morososData,
    turnoPersonal,
    proximoTurno,
    resumenDia,
  ] = await Promise.all([
    Morosos.detectarVencidos(),
    Inventario.stockBajo(),
    Morosos.listaMorosos(),
    // Personal activo en el turno ahora
    App.getTurnoActivo() ? DB.query(`
      SELECT tp.*, p.nombre, p.apellido, p.rol
      FROM turno_personal tp
      JOIN personal p ON p.id = tp.personal_id
      WHERE tp.turno_id = ? AND tp.estado NOT IN ('salio','ausente')
      ORDER BY tp.hora_entrada
    `, App.getTurnoActivo()?.id) : Promise.resolve([]),
    // Próximo turno en agenda
    DB.get(`
      SELECT ag.*, p.nombre||' '||p.apellido as p1, p2t.nombre||' '||p2t.apellido as p2
      FROM agenda ag
      LEFT JOIN personal p ON p.id = ag.personal_id
      LEFT JOIN personal p2t ON p2t.id = ag.personal_id2
      WHERE ag.fecha >= ? AND ag.hora_inicio > ?
      ORDER BY ag.fecha, ag.hora_inicio LIMIT 1
    `, today, ahora.toTimeString().slice(0,5)),
    // Resumen del día
    Promise.all([
      DB.get(`SELECT COUNT(*) as c FROM prestamos WHERE date(fecha_prestamo)=? AND estado='prestado'`, today),
      DB.get(`SELECT COUNT(*) as c FROM registro_pan WHERE fecha=?`, today),
      DB.get(`SELECT COALESCE(SUM(cantidad),0) as c FROM registro_hojas WHERE fecha=?`, today),
    ]),
  ]);

  const [prestRes, panRes, hojasRes] = resumenDia;
  const prestH  = prestRes?.c || 0;
  const panH    = panRes?.c   || 0;
  const hojasH  = hojasRes?.c || 0;
  const nMorosos  = morososData.length;
  const nStock    = stockBajo.length;

  // Fecha en español bien argentina
  const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const fechaStr = `${diasSemana[ahora.getDay()]} ${ahora.getDate()} de ${meses[ahora.getMonth()]} de ${ahora.getFullYear()}`;

  // Estado del turno activo
  const turno = App.getTurnoActivo();
  const estadoBadge = (e) => ({
    presente:'<span class="badge badge-green">✅ Presente</span>',
    demorado:'<span class="badge badge-yellow">⏳ Demorado</span>',
    reemplazando:'<span class="badge badge-blue">🔄 Reemplazando</span>',
  }[e] || '');

  container.innerHTML = `
    <!-- Alertas -->
    ${nMorosos > 0 ? `
    <div style="background:rgba(239,68,68,0.08);border:1px solid var(--red);border-radius:var(--radius);padding:10px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:16px;">⚠️</span>
      <span style="font-size:13px;color:var(--red);font-weight:500;">${nMorosos} préstamo${nMorosos>1?'s':''} vencido${nMorosos>1?'s':''} sin devolver</span>
      <button class="btn btn-sm" style="margin-left:auto;border-color:var(--red);color:var(--red);" onclick="Router.navigate('prestamos')">Ver</button>
    </div>` : ''}
    ${nStock > 0 ? `
    <div style="background:rgba(234,179,8,0.07);border:1px solid var(--yellow);border-radius:var(--radius);padding:10px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:16px;">📦</span>
      <span style="font-size:13px;color:var(--yellow);font-weight:500;">${nStock} producto${nStock>1?'s':''} con stock bajo</span>
      <button class="btn btn-sm" style="margin-left:auto;border-color:var(--yellow);color:var(--yellow);" onclick="Router.navigate('mercaderia')">Ver</button>
    </div>` : ''}

    <!-- Encabezado -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
      <div>
        <h1 class="page-title" style="margin-bottom:4px;">🏠 Inicio</h1>
        <div style="font-size:13px;color:var(--text-muted);">${fechaStr}</div>
      </div>
      <div>
        ${!turno ? `<button class="btn btn-success" onclick="Router.navigate('turno')">▶ Iniciar turno</button>` : ''}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

      <!-- Turno activo -->
      <div class="card" style="border-color:${turno?'var(--green)':'var(--border)'};transition:border-color .3s;">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>🕐 Turno actual</span>
          ${turno ? `<span class="badge badge-green" style="font-size:10px;">● En curso</span>` : ''}
        </div>
        ${turno ? `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Desde las ${UI.formatTime(turno.hora_inicio)}</div>
          ${turnoPersonal.length === 0
            ? `<div style="color:var(--text-muted);font-size:13px;">Sin personal activo ahora</div>`
            : turnoPersonal.map(tp => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light);">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--accent);flex-shrink:0;">${tp.nombre[0]}${tp.apellido[0]}</div>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:500;">${tp.nombre} ${tp.apellido}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${tp.rol}</div>
                </div>
                ${estadoBadge(tp.estado)}
              </div>`).join('')}
          <button class="btn btn-sm btn-secondary" onclick="Router.navigate('turno')" style="margin-top:12px;width:100%;">Ver turno completo</button>
        ` : `
          <div style="padding:20px 0;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">💤</div>
            <div style="font-size:13px;color:var(--text-muted);">No hay turno activo</div>
            <button class="btn btn-success btn-sm" onclick="Router.navigate('turno')" style="margin-top:12px;">▶ Iniciar turno</button>
          </div>
        `}
      </div>

      <!-- Próximo turno en agenda -->
      <div class="card">
        <div class="card-title">📅 Próximo en agenda</div>
        ${proximoTurno ? `
          <div style="margin-bottom:8px;">
            <div style="font-size:22px;font-weight:700;color:var(--accent);font-family:var(--font-mono);">${UI.formatTime(proximoTurno.hora_inicio)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${proximoTurno.fecha === today ? 'Hoy' : proximoTurno.fecha} · ${UI.formatTime(proximoTurno.hora_inicio)} — ${UI.formatTime(proximoTurno.hora_fin)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${proximoTurno.p1 ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span>👤</span>${proximoTurno.p1}</div>` : ''}
            ${proximoTurno.p2 ? `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><span>👤</span>${proximoTurno.p2}</div>` : ''}
          </div>
          <button class="btn btn-sm btn-secondary" onclick="Router.navigate('agenda')" style="margin-top:12px;width:100%;">Ver agenda</button>
        ` : `
          <div style="padding:20px 0;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">📭</div>
            <div style="font-size:13px;color:var(--text-muted);">Sin turnos programados próximamente</div>
            <button class="btn btn-sm btn-secondary" onclick="Router.navigate('agenda')" style="margin-top:12px;">Ver agenda</button>
          </div>
        `}
      </div>
    </div>

    <!-- Resumen del día -->
    <div class="card">
      <div class="card-title">📈 Resumen de hoy</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;">
        <div onclick="Router.navigate('prestamos')" style="cursor:pointer;padding:12px;border-radius:var(--radius);background:var(--bg-elevated);transition:background .15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='var(--bg-elevated)'">
          <div style="font-size:26px;font-weight:700;color:var(--accent);">${prestH}</div>
          <div style="font-size:12px;color:var(--text-muted);">📦 Préstamos activos</div>
        </div>
        <div onclick="Router.navigate('pan')" style="cursor:pointer;padding:12px;border-radius:var(--radius);background:var(--bg-elevated);transition:background .15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='var(--bg-elevated)'">
          <div style="font-size:26px;font-weight:700;color:var(--green);">${panH}</div>
          <div style="font-size:12px;color:var(--text-muted);">🥐 Desayunos/Meriendas</div>
        </div>
        <div onclick="Router.navigate('hojas')" style="cursor:pointer;padding:12px;border-radius:var(--radius);background:var(--bg-elevated);transition:background .15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='var(--bg-elevated)'">
          <div style="font-size:26px;font-weight:700;color:var(--yellow);">${hojasH}</div>
          <div style="font-size:12px;color:var(--text-muted);">📄 Fotocopias entregadas</div>
        </div>
      </div>
    </div>
  `;
};
// ─── Auto-refresh del dashboard ───────────────────────────────────────────────
// Refresca automáticamente cada 60s si el usuario está en el dashboard
Pages._dashboardTimer = null;

Pages._iniciarRefreshDashboard = function() {
  Pages._detenerRefreshDashboard();
  Pages._dashboardTimer = setInterval(async () => {
    if (App.currentPage === 'dashboard') {
      await Pages.dashboard();
    }
  }, 60_000);
};

Pages._detenerRefreshDashboard = function() {
  if (Pages._dashboardTimer) {
    clearInterval(Pages._dashboardTimer);
    Pages._dashboardTimer = null;
  }
};

// Arrancar al cargar
const _origDashboard = Pages.dashboard;
Pages.dashboard = async function() {
  await _origDashboard();
  Pages._iniciarRefreshDashboard();
};
