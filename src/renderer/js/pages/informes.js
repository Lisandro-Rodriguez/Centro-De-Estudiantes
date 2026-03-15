// ─── Informes y Exportación ────────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.informes = async function() {
  // Requiere PIN admin
  if (!App._pinInformes) {
    App.pedirPinAdmin(() => { App._pinInformes = true; Pages.informes(); });
    return;
  }

  const container = document.getElementById('page-container');
  const hoy = new Date();
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
  const hoyStr = hoy.toISOString().split('T')[0];

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Informes</h1>
        <div class="page-subtitle">Exportá reportes en PDF y Excel</div>
      </div>
    </div>

    <!-- Filtro de período -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-title">Período</div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;">
          <label>Desde</label>
          <input type="date" id="inf-desde" value="${primerDiaMes}" style="width:160px;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label>Hasta</label>
          <input type="date" id="inf-hasta" value="${hoyStr}" style="width:160px;" />
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.setPeriodo('mes')">Este mes</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.setPeriodo('cuatrimestre')">Cuatrimestre</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.setPeriodo('anio')">Este año</button>
        </div>
      </div>
    </div>

    <!-- Cards de informes -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">

      <div class="card">
        <div class="card-title">◷ Horas trabajadas</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Horas por integrante del personal en el período</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('horas','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('horas','excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">✓ Asistencia a turnos</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Presentes, demorados y ausentes por turno</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('asistencia','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('asistencia','excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">◻ Panes entregados</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Desayunos y meriendas por día</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('pan','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('pan','excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">◫ Hojas entregadas</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Gratuitas y pagas con montos recaudados</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('hojas','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('hojas','excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⊡ Préstamos</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Activos e histórico del período</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('prestamos','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('prestamos','excel')">⬇ Excel</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="color:var(--red);">⚠ Morosos del cuatrimestre</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Alumnos con incumplimientos y bloqueados</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('morosos','pdf')">⬇ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="Informes.exportar('morosos','excel')">⬇ Excel</button>
        </div>
      </div>

    </div>

    <div id="inf-preview" style="margin-top:24px;"></div>
  `;
};

// ── Helper global ──────────────────────────────────────────────────────────────
const Informes = {
  getPeriodo() {
    return {
      desde: document.getElementById('inf-desde')?.value || '',
      hasta: document.getElementById('inf-hasta')?.value || '',
    };
  },

  setPeriodo(tipo) {
    const hoy = new Date();
    const desde = document.getElementById('inf-desde');
    const hasta = document.getElementById('inf-hasta');
    if (!desde || !hasta) return;
    hasta.value = hoy.toISOString().split('T')[0];
    if (tipo === 'mes') {
      desde.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
    } else if (tipo === 'cuatrimestre') {
      const mes = hoy.getMonth() + 1;
      desde.value = mes >= 3 && mes <= 7 ? `${hoy.getFullYear()}-03-01` : `${hoy.getFullYear()}-08-01`;
    } else if (tipo === 'anio') {
      desde.value = `${hoy.getFullYear()}-01-01`;
    }
  },

  // Centro del informe
  get centreName() {
    return App.config?.nombre_centro || 'Centro de Estudiantes';
  },

  _exportando: false,

  async exportar(tipo, formato) {
    if (this._exportando) return;
    const { desde, hasta } = this.getPeriodo();
    if (!desde || !hasta) { UI.toast('Seleccioná un período', 'error'); return; }
    if (desde > hasta) { UI.toast('La fecha de inicio no puede ser mayor al final', 'error'); return; }

    this._exportando = true;
    UI.toast('Generando informe...', 'info');

    try {
      const datos = await this.obtenerDatos(tipo, desde, hasta);
      if (formato === 'pdf') {
        await this.exportarPDF(tipo, datos, desde, hasta);
      } else {
        await this.exportarExcel(tipo, datos, desde, hasta);
      }
    } catch(e) {
      UI.toast('Error al generar el informe: ' + e.message, 'error');
      console.error(e);
    } finally {
      this._exportando = false;
    }
  },

  // ── Obtener datos según tipo ─────────────────────────────────────────────────
  async obtenerDatos(tipo, desde, hasta) {
    if (tipo === 'horas') {
      return await DB.query(`
        SELECT p.nombre || ' ' || p.apellido as nombre, p.rol,
               COUNT(DISTINCT tp.turno_id) as turnos,
               ROUND(SUM(tp.horas_cumplidas), 2) as horas_total
        FROM personal p
        LEFT JOIN turno_personal tp ON tp.personal_id = p.id
        LEFT JOIN turnos t ON t.id = tp.turno_id
          AND date(t.fecha) BETWEEN ? AND ?
        WHERE p.activo = 1
        GROUP BY p.id ORDER BY horas_total DESC
      `, desde, hasta);
    }
    if (tipo === 'asistencia') {
      return await DB.query(`
        SELECT t.fecha, t.hora_inicio, t.hora_fin,
               p.nombre || ' ' || p.apellido as nombre, p.rol,
               tp.estado, tp.horas_cumplidas
        FROM turnos t
        JOIN turno_personal tp ON tp.turno_id = t.id
        JOIN personal p ON p.id = tp.personal_id
        WHERE date(t.fecha) BETWEEN ? AND ?
        ORDER BY t.fecha DESC, t.hora_inicio
      `, desde, hasta);
    }
    if (tipo === 'pan') {
      return await DB.query(`
        SELECT fecha,
               SUM(CASE WHEN tipo='desayuno' THEN 1 ELSE 0 END) as desayunos,
               SUM(CASE WHEN tipo='merienda' THEN 1 ELSE 0 END) as meriendas,
               COUNT(*) as total
        FROM registro_pan
        WHERE fecha BETWEEN ? AND ?
        GROUP BY fecha ORDER BY fecha DESC
      `, desde, hasta);
    }
    if (tipo === 'hojas') {
      return await DB.query(`
        SELECT fecha,
               SUM(cantidad) as total_hojas,
               SUM(CASE WHEN pagas=0 THEN cantidad ELSE 0 END) as gratuitas,
               SUM(CASE WHEN pagas=1 THEN cantidad ELSE 0 END) as pagas_cant,
               ROUND(SUM(monto_total), 2) as recaudado
        FROM registro_hojas
        WHERE fecha BETWEEN ? AND ?
        GROUP BY fecha ORDER BY fecha DESC
      `, desde, hasta);
    }
    if (tipo === 'prestamos') {
      return await DB.query(`
        SELECT pr.fecha_prestamo, pr.fecha_devolucion, pr.estado,
               a.nombre || ' ' || a.apellido as alumno,
               m.nombre as material, pr.notas
        FROM prestamos pr
        LEFT JOIN alumnos a ON a.id = pr.alumno_id
        LEFT JOIN materiales m ON m.id = pr.material_id
        WHERE date(pr.fecha_prestamo) BETWEEN ? AND ?
        ORDER BY pr.fecha_prestamo DESC
      `, desde, hasta);
    }
    if (tipo === 'morosos') {
      const cuatri = Morosos.cuatrimestreActual();
      return await DB.query(`
        SELECT a.nombre || ' ' || a.apellido as alumno, a.dni, a.carrera,
               a.incumplimientos_count as incumplimientos,
               a.bloqueado_prestamo as bloqueado, a.bloqueado_hasta,
               COUNT(i.id) as inc_cuatri
        FROM alumnos a
        LEFT JOIN incumplimientos i ON i.alumno_id = a.id AND i.cuatrimestre = ?
        WHERE a.activo = 1 AND a.incumplimientos_count > 0
        GROUP BY a.id ORDER BY inc_cuatri DESC
      `, cuatri);
    }
    return [];
  },

  // ── PDF ───────────────────────────────────────────────────────────────────────
  async exportarPDF(tipo, datos, desde, hasta) {
    const titulo = this.tituloInforme(tipo);
    const tabla  = this.htmlTabla(tipo, datos);
    const resumen = this.htmlResumen(tipo, datos);

    const html = `
<!DOCTYPE html><html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: white; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
  .header-left h1 { font-size: 18px; color: #1e40af; font-weight: 700; }
  .header-left p  { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .header-right   { text-align: right; font-size: 10px; color: #6b7280; }
  .resumen { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .res-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 16px; min-width: 120px; text-align: center; }
  .res-val  { font-size: 20px; font-weight: 700; color: #0369a1; }
  .res-lbl  { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge-red { background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:600; }
  .badge-yellow { background:#fef9c3; color:#92400e; padding:2px 6px; border-radius:4px; font-size:9px; }
  .badge-green  { background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-size:9px; }
  .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; display:flex; justify-content:space-between; }
  .empty { text-align:center; color: #9ca3af; padding: 30px; font-size: 13px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${this.centreName}</h1>
      <p>${titulo} — Período: ${desde} al ${hasta}</p>
    </div>
    <div class="header-right">
      Generado: ${new Date().toLocaleString('es-AR')}<br>
      ${App.usuarioActivo ? App.usuarioActivo.nombre + ' ' + App.usuarioActivo.apellido : ''}
    </div>
  </div>
  ${resumen}
  ${datos.length === 0 ? '<div class="empty">No hay datos para el período seleccionado</div>' : tabla}
  <div class="footer">
    <span>${this.centreName} — ${titulo}</span>
    <span>Período: ${desde} — ${hasta}</span>
  </div>
</body></html>`;

    const nombre = `${tipo}_${desde}_${hasta}.pdf`;
    const res = await window.api.exportPdf({ html, filename: nombre });
    if (res.ok)              UI.toast('PDF guardado correctamente', 'success');
    else if (!res.cancelled) UI.toast('Error al guardar: ' + (res.error || ''), 'error');
  },

  // ── Excel ─────────────────────────────────────────────────────────────────────
  async exportarExcel(tipo, datos, desde, hasta) {
    const titulo = this.tituloInforme(tipo);
    const headers = this.excelHeaders(tipo);
    const rows    = this.excelRows(tipo, datos);
    const meta = [
      [this.centreName],
      [titulo],
      [`Período: ${desde} al ${hasta}`],
      [`Generado: ${new Date().toLocaleString('es-AR')}`],
      [],
      headers,
      ...rows
    ];

    const nombre = `${tipo}_${desde}_${hasta}.csv`;
    const res = await window.api.exportExcel({ sheets: [{ name: titulo.substring(0,30), rows: meta }], filename: nombre });
    if (res.ok)              UI.toast('CSV guardado — abrí con Excel', 'success');
    else if (!res.cancelled) UI.toast('Error al guardar: ' + (res.error || ''), 'error');
  },

  // ── Utilidades ────────────────────────────────────────────────────────────────
  tituloInforme(tipo) {
    return { horas:'Horas Trabajadas', asistencia:'Asistencia a Turnos', pan:'Panes Entregados', hojas:'Hojas Entregadas', prestamos:'Préstamos', morosos:'Morosos del Cuatrimestre' }[tipo] || tipo;
  },

  htmlResumen(tipo, datos) {
    if (!datos.length) return '';
    let cards = [];
    if (tipo === 'horas') {
      const total = datos.reduce((s,r) => s + (r.horas_total||0), 0);
      cards = [`<div class="res-card"><div class="res-val">${datos.length}</div><div class="res-lbl">Integrantes</div></div>`,
               `<div class="res-card"><div class="res-val">${total.toFixed(1)}</div><div class="res-lbl">Horas totales</div></div>`];
    } else if (tipo === 'pan') {
      const d = datos.reduce((s,r)=>s+(r.desayunos||0),0);
      const m = datos.reduce((s,r)=>s+(r.meriendas||0),0);
      cards = [`<div class="res-card"><div class="res-val">${datos.length}</div><div class="res-lbl">Días</div></div>`,
               `<div class="res-card"><div class="res-val">${d}</div><div class="res-lbl">Desayunos</div></div>`,
               `<div class="res-card"><div class="res-val">${m}</div><div class="res-lbl">Meriendas</div></div>`,
               `<div class="res-card"><div class="res-val">${d+m}</div><div class="res-lbl">Total</div></div>`];
    } else if (tipo === 'hojas') {
      const total = datos.reduce((s,r)=>s+(r.total_hojas||0),0);
      const rec   = datos.reduce((s,r)=>s+(r.recaudado||0),0);
      cards = [`<div class="res-card"><div class="res-val">${total}</div><div class="res-lbl">Hojas totales</div></div>`,
               `<div class="res-card"><div class="res-val">$${rec.toFixed(2)}</div><div class="res-lbl">Recaudado</div></div>`];
    } else if (tipo === 'morosos') {
      const bloq = datos.filter(r=>r.bloqueado).length;
      cards = [`<div class="res-card"><div class="res-val">${datos.length}</div><div class="res-lbl">Con incumplimientos</div></div>`,
               `<div class="res-card"><div class="res-val" style="color:#b91c1c;">${bloq}</div><div class="res-lbl">Bloqueados</div></div>`];
    } else if (tipo === 'prestamos') {
      const act = datos.filter(r=>r.estado==='prestado').length;
      cards = [`<div class="res-card"><div class="res-val">${datos.length}</div><div class="res-lbl">Total</div></div>`,
               `<div class="res-card"><div class="res-val">${act}</div><div class="res-lbl">Activos</div></div>`];
    }
    return cards.length ? `<div class="resumen">${cards.join('')}</div>` : '';
  },

  htmlTabla(tipo, datos) {
    const cols = {
      horas:      ['Nombre','Rol','Turnos','Horas totales'],
      asistencia: ['Fecha','Personal','Rol','Estado','Horas'],
      pan:        ['Fecha','Desayunos','Meriendas','Total'],
      hojas:      ['Fecha','Total hojas','Gratuitas','Pagas','Recaudado'],
      prestamos:  ['Fecha préstamo','Alumno','Material','Estado','Devolución'],
      morosos:    ['Alumno','DNI','Carrera','Incumplimientos','Bloqueado','Bloqueado hasta'],
    }[tipo] || [];

    const filas = datos.map(r => {
      let celdas = [];
      if (tipo==='horas')      celdas = [r.nombre, r.rol, r.turnos, r.horas_total||0];
      if (tipo==='asistencia') celdas = [r.fecha, r.nombre, r.rol,
        `<span class="badge-${r.estado==='presente'?'green':r.estado==='ausente'?'red':'yellow'}">${r.estado}</span>`,
        r.horas_cumplidas||0];
      if (tipo==='pan')        celdas = [r.fecha, r.desayunos||0, r.meriendas||0, r.total||0];
      if (tipo==='hojas')      celdas = [r.fecha, r.total_hojas||0, r.gratuitas||0, r.pagas_cant||0, `$${(r.recaudado||0).toFixed(2)}`];
      if (tipo==='prestamos')  celdas = [r.fecha_prestamo?.substring(0,10), r.alumno||'—', r.material||'—',
        `<span class="badge-${r.estado==='devuelto'?'green':'yellow'}">${r.estado}</span>`,
        r.fecha_devolucion?.substring(0,10)||'—'];
      if (tipo==='morosos')    celdas = [r.alumno, r.dni||'—', r.carrera||'—', r.incumplimientos||0,
        r.bloqueado?'<span class="badge-red">SÍ</span>':'No', r.bloqueado_hasta||'—'];
      return `<tr>${celdas.map(c=>`<td>${c}</td>`).join('')}</tr>`;
    }).join('');

    return `<table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>`;
  },

  excelHeaders(tipo) {
    return {
      horas:      ['Nombre','Rol','Turnos','Horas totales'],
      asistencia: ['Fecha','Personal','Rol','Estado','Horas'],
      pan:        ['Fecha','Desayunos','Meriendas','Total'],
      hojas:      ['Fecha','Total hojas','Gratuitas','Pagas','Recaudado ($)'],
      prestamos:  ['Fecha préstamo','Alumno','Material','Estado','Fecha devolución'],
      morosos:    ['Alumno','DNI','Carrera','Incumplimientos','Bloqueado','Bloqueado hasta'],
    }[tipo] || [];
  },

  excelRows(tipo, datos) {
    return datos.map(r => {
      if (tipo==='horas')      return [r.nombre, r.rol, r.turnos||0, r.horas_total||0];
      if (tipo==='asistencia') return [r.fecha, r.nombre, r.rol, r.estado, r.horas_cumplidas||0];
      if (tipo==='pan')        return [r.fecha, r.desayunos||0, r.meriendas||0, r.total||0];
      if (tipo==='hojas')      return [r.fecha, r.total_hojas||0, r.gratuitas||0, r.pagas_cant||0, r.recaudado||0];
      if (tipo==='prestamos')  return [r.fecha_prestamo?.substring(0,10)||'', r.alumno||'', r.material||'', r.estado, r.fecha_devolucion?.substring(0,10)||''];
      if (tipo==='morosos')    return [r.alumno, r.dni||'', r.carrera||'', r.incumplimientos||0, r.bloqueado?'Sí':'No', r.bloqueado_hasta||''];
      return [];
    });
  }
};