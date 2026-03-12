Pages = window.Pages || {};

Pages.agenda = async function() {
  const container = document.getElementById('page-container');
  const personal  = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);

  // ── Slots fijos 08:00–20:00 ──────────────────────────────────────────────
  const SLOTS = Array.from({length: 12}, (_, i) => ({
    inicio: `${String(8 + i).padStart(2,'0')}:00`,
    fin:    `${String(9 + i).padStart(2,'0')}:00`,
  }));

  const todayStr = new Date().toISOString().split('T')[0];
  let vistaActual  = 'diaria';   // 'diaria' | 'semanal'
  let fechaActual  = todayStr;   // fecha seleccionada en vista diaria

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getMondayOf(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split('T')[0];
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  function fmtFecha(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long'});
  }

  function estadoColor(e) {
    return {programado:'var(--accent)',presente:'var(--green)',demorado:'var(--yellow)',cubierto:'#3b82f6',ausente:'var(--red)'}[e]||'var(--accent)';
  }
  function estadoBadge(e) {
    const map = {programado:['badge-gray','Programado'],presente:['badge-green','Presente'],demorado:['badge-yellow','Demorado'],cubierto:['badge-blue','Cubierto'],ausente:['badge-red','Ausente']};
    const [cls,lbl] = map[e]||['badge-gray',e];
    return `<span class="badge ${cls}" style="font-size:10px;">${lbl}</span>`;
  }
  function colorBloque(ep1,ep2) {
    for (const e of ['ausente','demorado','cubierto','presente','programado']) {
      if ([ep1,ep2].filter(Boolean).includes(e)) return estadoColor(e);
    }
    return estadoColor('programado');
  }

  function selectEstado(agId, persona, val) {
    return `<select style="padding:2px 5px;font-size:11px;border-radius:4px;" onchange="Pages._cambiarEstadoAgenda(${agId},'${persona}',this.value)">
      ${['programado','presente','demorado','cubierto','ausente'].map(e=>`<option value="${e}" ${val===e?'selected':''}>${e.charAt(0).toUpperCase()+e.slice(1)}</option>`).join('')}
    </select>`;
  }

  // ── Render vista diaria ──────────────────────────────────────────────────
  async function renderDiaria(fecha) {
    const registros = await DB.query(`
      SELECT ag.*, p1.nombre||' '||p1.apellido as p1name, p2.nombre||' '||p2.apellido as p2name
      FROM agenda ag
      LEFT JOIN personal p1 ON p1.id = ag.personal_id
      LEFT JOIN personal p2 ON p2.id = ag.personal_id2
      WHERE ag.fecha = ?
      ORDER BY ag.hora_inicio
    `, fecha);

    // Indexar por slot
    const bySlot = {};
    registros.forEach(r => { bySlot[r.hora_inicio] = r; });

    document.getElementById('agenda-body').innerHTML = `
      <div style="font-size:14px;font-weight:600;margin-bottom:16px;color:var(--text-secondary);text-transform:capitalize;">
        ${fmtFecha(fecha)}
        ${fecha === todayStr ? '<span class="badge badge-green" style="margin-left:8px;">Hoy</span>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${SLOTS.map(slot => {
          const a = bySlot[slot.inicio];
          if (!a) {
            return `
              <div style="display:grid;grid-template-columns:80px 1fr auto;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius);border:1px solid var(--border-light);opacity:0.5;">
                <span style="font-family:var(--font-mono);font-size:13px;color:var(--text-muted);">${slot.inicio}–${slot.fin}</span>
                <span style="font-size:12px;color:var(--text-muted);">Sin cobertura</span>
                <button class="btn btn-sm btn-secondary" onclick="Pages._addSlot('${fecha}','${slot.inicio}','${slot.fin}')">+ Asignar</button>
              </div>`;
          }
          return `
            <div style="display:grid;grid-template-columns:80px 1fr auto;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-surface);border-radius:var(--radius);border:1px solid var(--border-light);border-left:3px solid ${colorBloque(a.estado_p1,a.estado_p2)};">
              <span style="font-family:var(--font-mono);font-size:13px;font-weight:600;">${slot.inicio}–${slot.fin}</span>
              <div style="display:flex;flex-direction:column;gap:4px;">
                ${a.p1name ? `
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:12px;min-width:130px;">${a.p1name}</span>
                    ${selectEstado(a.id,'p1',a.estado_p1||'programado')}
                    ${estadoBadge(a.estado_p1||'programado')}
                  </div>` : ''}
                ${a.p2name ? `
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:12px;min-width:130px;">${a.p2name}</span>
                    ${selectEstado(a.id,'p2',a.estado_p2||'programado')}
                    ${estadoBadge(a.estado_p2||'programado')}
                  </div>` : ''}
                ${a.notas ? `<div style="font-size:11px;color:var(--text-muted);">${a.notas}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-secondary" onclick="Pages._editSlot(${a.id})">✎</button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteAgenda(${a.id})">✕</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  // ── Render vista semanal ─────────────────────────────────────────────────
  async function renderSemanal(lunesStr) {
    const fechas = Array.from({length:7}, (_,i) => addDays(lunesStr, i));
    const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    const registros = await DB.query(`
      SELECT ag.*, p1.nombre||' '||p1.apellido as p1name, p2.nombre||' '||p2.apellido as p2name
      FROM agenda ag
      LEFT JOIN personal p1 ON p1.id = ag.personal_id
      LEFT JOIN personal p2 ON p2.id = ag.personal_id2
      WHERE ag.fecha BETWEEN ? AND ?
      ORDER BY ag.fecha, ag.hora_inicio
    `, fechas[0], fechas[6]);

    // Indexar por fecha+slot
    const byKey = {};
    registros.forEach(r => { byKey[`${r.fecha}_${r.hora_inicio}`] = r; });

    document.getElementById('agenda-body').innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:700px;">
          <thead>
            <tr>
              <th style="width:70px;padding:8px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono);text-align:left;">Hora</th>
              ${fechas.map((f,i) => `
                <th style="padding:8px;font-size:12px;font-weight:600;text-align:center;${f===todayStr?'color:var(--accent);':'color:var(--text-secondary);'}">
                  ${dayNames[i]}<br><span style="font-size:10px;font-weight:400;">${f.split('-').slice(1).reverse().join('/')}</span>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${SLOTS.map(slot => `
              <tr style="border-top:1px solid var(--border-light);">
                <td style="padding:6px 8px;font-size:12px;font-family:var(--font-mono);color:var(--text-muted);white-space:nowrap;">${slot.inicio}</td>
                ${fechas.map(f => {
                  const a = byKey[`${f}_${slot.inicio}`];
                  if (!a) return `
                    <td style="padding:4px;text-align:center;">
                      <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:2px 6px;opacity:0.4;" onclick="Pages._addSlot('${f}','${slot.inicio}','${slot.fin}')">+</button>
                    </td>`;
                  const nombres = [a.p1name, a.p2name].filter(Boolean);
                  return `
                    <td style="padding:4px;">
                      <div style="background:var(--bg-elevated);border-radius:4px;padding:4px 6px;border-left:2px solid ${colorBloque(a.estado_p1,a.estado_p2)};font-size:11px;cursor:pointer;" onclick="Pages._editSlot(${a.id})">
                        ${nombres.map(n => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${n.split(' ')[0]}</div>`).join('')}
                      </div>
                    </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Shell de la página ───────────────────────────────────────────────────
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Agenda</h1>
        <div class="page-subtitle" id="agenda-subtitle">Cobertura de turnos</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-secondary btn-sm" id="btn-prev">‹</button>
        <button class="btn btn-secondary btn-sm" id="btn-today">Hoy</button>
        <button class="btn btn-secondary btn-sm" id="btn-next">›</button>
        <div style="width:1px;height:24px;background:var(--border);margin:0 4px;"></div>
        <button class="btn btn-sm" id="btn-vista-diaria"  style="border:1px solid var(--accent);color:var(--accent);">Día</button>
        <button class="btn btn-sm btn-secondary" id="btn-vista-semanal">Semana</button>
      </div>
    </div>
    <div id="agenda-body"></div>
  `;

  // ── Navegación ───────────────────────────────────────────────────────────
  async function render() {
    if (vistaActual === 'diaria') {
      await renderDiaria(fechaActual);
    } else {
      await renderSemanal(getMondayOf(fechaActual));
    }
  }

  document.getElementById('btn-prev').onclick = () => {
    fechaActual = addDays(fechaActual, vistaActual === 'diaria' ? -1 : -7);
    render();
  };
  document.getElementById('btn-next').onclick = () => {
    fechaActual = addDays(fechaActual, vistaActual === 'diaria' ? 1 : 7);
    render();
  };
  document.getElementById('btn-today').onclick = () => {
    fechaActual = todayStr;
    render();
  };
  document.getElementById('btn-vista-diaria').onclick = () => {
    vistaActual = 'diaria';
    document.getElementById('btn-vista-diaria').style.borderColor = 'var(--accent)';
    document.getElementById('btn-vista-diaria').style.color = 'var(--accent)';
    document.getElementById('btn-vista-semanal').style.borderColor = '';
    document.getElementById('btn-vista-semanal').style.color = '';
    render();
  };
  document.getElementById('btn-vista-semanal').onclick = () => {
    vistaActual = 'semanal';
    document.getElementById('btn-vista-semanal').style.borderColor = 'var(--accent)';
    document.getElementById('btn-vista-semanal').style.color = 'var(--accent)';
    document.getElementById('btn-vista-diaria').style.borderColor = '';
    document.getElementById('btn-vista-diaria').style.color = '';
    render();
  };

  await render();

  // ── Acciones ─────────────────────────────────────────────────────────────
  Pages._cambiarEstadoAgenda = async (id, persona, estado) => {
    const col = persona === 'p1' ? 'estado_p1' : 'estado_p2';
    await DB.run(`UPDATE agenda SET ${col}=? WHERE id=?`, estado, id);
    render();
  };

  Pages._deleteAgenda = async (id) => {
    UI.confirm('Eliminar slot', '¿Eliminar este turno de la agenda?', async () => {
      await DB.run(`DELETE FROM agenda WHERE id=?`, id);
      render();
    });
  };

  function modalSlot(fecha, inicio, fin, agendaRow = null) {
    // Validar que no sea el mismo personal en p1 y p2
    function validarYGuardar() {
      const p1v = document.getElementById('ag-p1').value;
      const p2v = document.getElementById('ag-p2').value;
      if (p1v && p2v && p1v === p2v) {
        UI.toast('No podés asignar la misma persona en ambos puestos', 'error');
        return false;
      }
      return true;
    }

    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${agendaRow ? 'Editar slot' : 'Asignar slot'} — ${inicio}–${fin}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group" style="grid-column:span 2;">
          <label>Fecha</label>
          <input type="date" id="ag-fecha" value="${fecha}" />
        </div>
        <div class="form-group">
          <label>Personal #1</label>
          <select id="ag-p1">
            <option value="">— Sin asignar —</option>
            ${personal.map(p=>`<option value="${p.id}" ${agendaRow?.personal_id==p.id?'selected':''}>${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Personal #2</label>
          <select id="ag-p2">
            <option value="">— Sin asignar —</option>
            ${personal.map(p=>`<option value="${p.id}" ${agendaRow?.personal_id2==p.id?'selected':''}>${p.apellido}, ${p.nombre} (${p.rol})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:span 2;">
          <label>Notas</label>
          <input type="text" id="ag-notas" value="${agendaRow?.notas||''}" placeholder="Observaciones..." />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        ${agendaRow ? `<button class="btn btn-danger" style="margin-right:auto;" onclick="Pages._deleteAgenda(${agendaRow.id});UI.closeModal();">Eliminar</button>` : ''}
        <button class="btn btn-primary" id="btn-guardar-agenda">Guardar</button>
      </div>
    `);

    // Validación en tiempo real: deshabilitar misma opción en p2
    ['ag-p1','ag-p2'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        const p1v = document.getElementById('ag-p1').value;
        const p2v = document.getElementById('ag-p2').value;
        if (p1v && p2v && p1v === p2v) {
          UI.toast('No podés elegir la misma persona para ambos puestos', 'error');
          // Reset el que acaba de cambiar
          document.getElementById(id).value = '';
        }
      });
    });

    document.getElementById('btn-guardar-agenda').onclick = async () => {
      if (!validarYGuardar()) return;
      const f  = document.getElementById('ag-fecha').value;
      const p1 = document.getElementById('ag-p1').value || null;
      const p2 = document.getElementById('ag-p2').value || null;
      const nt = document.getElementById('ag-notas').value;
      if (!f) { UI.toast('Seleccioná una fecha', 'error'); return; }
      if (agendaRow) {
        await DB.run(`UPDATE agenda SET fecha=?,personal_id=?,personal_id2=?,notas=? WHERE id=?`, f, p1, p2, nt, agendaRow.id);
      } else {
        // Verificar que no exista ya un slot para esa fecha/hora
        const existe = await DB.get(`SELECT id FROM agenda WHERE fecha=? AND hora_inicio=?`, f, inicio);
        if (existe) { UI.toast('Ya existe un turno en ese horario para esa fecha', 'error'); return; }
        await DB.run(
          `INSERT INTO agenda (fecha,hora_inicio,hora_fin,personal_id,personal_id2,notas,estado_p1,estado_p2,estado) VALUES (?,?,?,?,?,?,'programado','programado','programado')`,
          f, inicio, fin, p1, p2, nt
        );
      }
      UI.toast('Guardado', 'success');
      UI.closeModal();
      fechaActual = f;
      render();
    };
  }

  Pages._addSlot  = (fecha, inicio, fin) => modalSlot(fecha, inicio, fin);
  Pages._editSlot = async (id) => {
    const a = await DB.get(`SELECT * FROM agenda WHERE id=?`, id);
    if (a) modalSlot(a.fecha, a.hora_inicio, a.hora_fin, a);
  };
};
