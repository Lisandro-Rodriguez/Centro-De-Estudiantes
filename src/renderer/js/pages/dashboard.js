// ─── Dashboard ────────────────────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.dashboard = async function() {
  const container = document.getElementById('page-container');
  // Detectar préstamos vencidos al abrir dashboard
  await Morosos.detectarVencidos();
  container.innerHTML = `<div style="color:var(--text-muted);padding:40px;text-align:center;">Cargando...</div>`;

  const today = UI.today();

  // Stats
  const [personal, alumnos, prestamosHoy, panHoy, hojasHoy, turnosHoy] = await Promise.all([
    DB.query(`SELECT COUNT(*) as c FROM personal WHERE activo=1`),
    DB.query(`SELECT COUNT(*) as c FROM alumnos WHERE activo=1`),
    DB.query(`SELECT COUNT(*) as c FROM prestamos WHERE date(fecha_prestamo)=? AND estado='prestado'`, today),
    DB.query(`SELECT COUNT(*) as c FROM registro_pan WHERE fecha=?`, today),
    DB.query(`SELECT SUM(cantidad) as c FROM registro_hojas WHERE fecha=?`, today),
    DB.query(`SELECT COUNT(*) as c FROM turnos WHERE fecha=?`, today),
  ]);

  const pActivos = personal[0]?.c || 0;
  const aActivos = alumnos[0]?.c || 0;
  const prestH = prestamosHoy[0]?.c || 0;
  const panH = panHoy[0]?.c || 0;
  const hojasH = hojasHoy[0]?.c || 0;
  const turnosH = turnosHoy[0]?.c || 0;

  // Recent loans
  const prestamosRecientes = await DB.query(`
    SELECT pr.*, m.nombre as material, a.nombre || ' ' || a.apellido as alumno_full
    FROM prestamos pr
    LEFT JOIN materiales m ON m.id = pr.material_id
    LEFT JOIN alumnos a ON a.id = pr.alumno_id
    WHERE pr.estado = 'prestado'
    ORDER BY pr.fecha_prestamo DESC LIMIT 5
  `);

  // Agenda hoy
  const agendaHoy = await DB.query(`
    SELECT ag.*, p.nombre || ' ' || p.apellido as p1,
           p2.nombre || ' ' || p2.apellido as p2name
    FROM agenda ag
    LEFT JOIN personal p ON p.id = ag.personal_id
    LEFT JOIN personal p2 ON p2.id = ag.personal_id2
    WHERE ag.fecha = ?
    ORDER BY ag.hora_inicio
  `, today);

  container.innerHTML = `
    ${nMorosos > 0 ? `
    <div style="background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
      <span style="color:var(--red);font-size:16px;">⚠</span>
      <div>
        <span style="font-size:13px;color:var(--red);font-weight:600;">${nMorosos} préstamo${nMorosos>1?'s':''} vencido${nMorosos>1?'s':''} sin devolver</span>
        <div style="font-size:11px;color:var(--red);opacity:0.8;">
          ${morososData.slice(0,3).map(m=>`${m.nombre} ${m.apellido} — ${m.material_nombre||'?'}`).join(' · ')}${nMorosos>3?` · y ${nMorosos-3} más`:''}
        </div>
      </div>
      <button class="btn btn-sm" style="margin-left:auto;border-color:var(--red);color:var(--red);" onclick="Router.navigate('prestamos')">Ver préstamos</button>
    </div>` : ''}
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <div class="page-subtitle">${new Date().toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
      ${App.getTurnoActivo() ? '' : `<button class="btn btn-success" onclick="Router.navigate('turno')">◷ Iniciar turno</button>`}
    </div>

    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-value">${pActivos}</div>
        <div class="stat-label">Personal activo</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${aActivos}</div>
        <div class="stat-label">Alumnos</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${prestH}</div>
        <div class="stat-label">Préstamos activos</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-value">${panH}</div>
        <div class="stat-label">Panes hoy</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">${hojasH || 0}</div>
        <div class="stat-label">Hojas entregadas hoy</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${turnosH}</div>
        <div class="stat-label">Turnos hoy</div>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <div class="card">
          <div class="card-title">Agenda de hoy</div>
          ${agendaHoy.length === 0
            ? UI.emptyState('▦', 'No hay turnos programados para hoy')
            : agendaHoy.map(a => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light)">
                <div>
                  <div style="font-weight:500;font-size:13px;">${UI.formatTime(a.hora_inicio)} — ${UI.formatTime(a.hora_fin)}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${[a.p1,a.p2name].filter(Boolean).join(', ') || 'Sin asignar'}</div>
                </div>
                <span class="badge ${a.estado === 'cubierto' ? 'badge-green' : a.estado === 'ausente' ? 'badge-red' : 'badge-blue'}">${a.estado}</span>
              </div>
            `).join('')}
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title">Préstamos activos</div>
          ${prestamosRecientes.length === 0
            ? UI.emptyState('⊡', 'Sin préstamos activos')
            : prestamosRecientes.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light)">
                <div>
                  <div style="font-weight:500;font-size:13px;">${p.material || '—'}</div>
                  <div style="font-size:12px;color:var(--text-muted);">${p.alumno_full || p.alumno_nombre || '—'}</div>
                </div>
                <span class="badge badge-yellow">prestado</span>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;
};
