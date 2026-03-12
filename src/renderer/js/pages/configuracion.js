Pages = window.Pages || {};

// ─── Helper: multi-select de carreras ────────────────────────────────────────
// Devuelve el HTML del selector y maneja la lógica de selección múltiple.
// valorActual = string con siglas separadas por coma, ej: "ISI, TUP"
Pages._carrerasMultiSelect = async function(inputId, valorActual = '') {
  const carreras = await DB.query(`SELECT * FROM carreras ORDER BY nombre`);
  const seleccionadas = valorActual ? valorActual.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (carreras.length === 0) {
    return `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">
      Sin carreras cargadas. Agregá carreras en Configuración.
    </div>`;
  }

  return `
    <div id="${inputId}-wrap" style="border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-elevated);padding:8px 10px;max-height:130px;overflow-y:auto;">
      ${carreras.map(c => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px;">
          <input type="checkbox" value="${c.siglas}" data-nombre="${c.nombre}"
            ${seleccionadas.includes(c.siglas) ? 'checked' : ''}
            style="width:14px;height:14px;cursor:pointer;" />
          <span><strong>${c.siglas}</strong> — ${c.nombre}</span>
        </label>
      `).join('')}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Podés seleccionar más de una</div>
  `;
};

// Lee los checkboxes y devuelve string de siglas, ej: "ISI, TUP"
Pages._getCarrerasSeleccionadas = function(wrapId) {
  const checks = document.querySelectorAll(`#${wrapId}-wrap input[type=checkbox]:checked`);
  return Array.from(checks).map(c => c.value).join(', ');
};

// ─── Alumnos ──────────────────────────────────────────────────────────────────
Pages.alumnos = async function() {
  const container = document.getElementById('page-container');

  async function recargar(busqueda = '') {
    const lista = await DB.query(
      `SELECT * FROM alumnos WHERE activo=1 AND (nombre||' '||apellido LIKE ? OR dni LIKE ?) ORDER BY apellido`,
      `%${busqueda}%`, `%${busqueda}%`
    );
    document.getElementById('tabla-alumnos').innerHTML = UI.buildTable(
      ['Nombre', 'DNI', 'Carrera(s)', 'Teléfono', 'Estado', ''],
      lista.map(a => `
        <tr ${a.bloqueado_prestamo ? 'style="background:rgba(239,68,68,0.05);"' : ''}>
          <td class="fw-600">${a.apellido}, ${a.nombre}</td>
          <td class="td-muted">${a.dni || '—'}</td>
          <td>${a.carrera
            ? a.carrera.split(',').map(s => `<span class="badge badge-gray" style="margin:1px;">${s.trim()}</span>`).join(' ')
            : '—'}</td>
          <td class="td-muted">${a.telefono || '—'}</td>
          <td>
            ${a.bloqueado_prestamo
              ? `<span class="badge badge-red" title="Bloqueado hasta ${a.bloqueado_hasta}">⛔ Bloqueado</span>`
              : a.incumplimientos_count > 0
                ? `<span class="badge badge-yellow">⚠ ${a.incumplimientos_count} incump.</span>`
                : '<span class="badge badge-green" style="opacity:0.5;">OK</span>'}
          </td>
          <td style="display:flex;gap:6px;">
            ${App.esAdmin() ? `
              <button class="btn btn-sm btn-secondary" onclick="Pages._editAlumno(${a.id})">✎</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteAlumno(${a.id}, '${a.nombre} ${a.apellido}')">✕</button>
              ${a.bloqueado_prestamo ? `<button class="btn btn-sm btn-secondary" onclick="Pages._desbloquearAlumno(${a.id}, '${a.nombre} ${a.apellido}')" title="Desbloquear préstamos">🔓</button>` : ''}
            ` : ''}
          </td>
        </tr>
      `),
      'Sin alumnos registrados'
    );
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Alumnos</h1>
        <div class="page-subtitle">Alumnos regulares del centro</div>
      </div>
      ${App.esAdmin() ? '<button class="btn btn-primary" onclick="Pages._formAlumno()">+ Nuevo alumno</button>' : ''}
    </div>
    <div class="search-bar">
      <div class="search-input-wrap">
        <span class="search-icon">⊞</span>
        <input type="text" placeholder="Buscar por nombre o DNI..." id="busq-alumnos" />
      </div>
    </div>
    <div id="tabla-alumnos"></div>
  `;

  await recargar();
  document.getElementById('busq-alumnos').addEventListener('input', function() { recargar(this.value); });

  async function formAlumnoModal(alumno = null) {
    const multiSelect = await Pages._carrerasMultiSelect('al-carrera', alumno?.carrera || '');
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${alumno ? 'Editar alumno' : 'Nuevo alumno'}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" id="al-nombre" value="${alumno?.nombre || ''}" placeholder="Nombre" />
        </div>
        <div class="form-group">
          <label>Apellido *</label>
          <input type="text" id="al-apellido" value="${alumno?.apellido || ''}" placeholder="Apellido" />
        </div>
        <div class="form-group">
          <label>DNI</label>
          <input type="text" id="al-dni" value="${alumno?.dni || ''}" placeholder="DNI" />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="text" id="al-tel" value="${alumno?.telefono || ''}" placeholder="Teléfono" />
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>Carreras</label>
          ${multiSelect}
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>Email</label>
          <input type="email" id="al-email" value="${alumno?.email || ''}" placeholder="email@ejemplo.com" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-alumno">Guardar</button>
      </div>
    `);

    document.getElementById('btn-guardar-alumno').onclick = async () => {
      const n = document.getElementById('al-nombre').value.trim();
      const ap = document.getElementById('al-apellido').value.trim();
      if (!n || !ap) { UI.toast('Nombre y apellido son obligatorios', 'error'); return; }
      const carrera = Pages._getCarrerasSeleccionadas('al-carrera') || null;
      const data = [n, ap,
        document.getElementById('al-dni').value.trim() || null,
        carrera,
        document.getElementById('al-email').value.trim() || null,
        document.getElementById('al-tel').value.trim() || null
      ];
      if (alumno) {
        await DB.run(`UPDATE alumnos SET nombre=?,apellido=?,dni=?,carrera=?,email=?,telefono=? WHERE id=?`, ...data, alumno.id);
      } else {
        await DB.run(`INSERT INTO alumnos (nombre,apellido,dni,carrera,email,telefono) VALUES (?,?,?,?,?,?)`, ...data);
      }
      UI.toast('Alumno guardado', 'success');
      UI.closeModal();
      recargar();
    };
  }

  Pages._formAlumno = () => formAlumnoModal();
  Pages._editAlumno = async (id) => { const a = await DB.get(`SELECT * FROM alumnos WHERE id=?`, id); formAlumnoModal(a); };
  Pages._deleteAlumno = (id, nombre) => {
    UI.confirm('Eliminar alumno', `¿Eliminar a ${nombre}?`, async () => {
      await DB.run(`UPDATE alumnos SET activo=0 WHERE id=?`, id);
      UI.toast('Alumno eliminado', 'info');
      recargar();
    });
  };
  Pages._desbloquearAlumno = (id, nombre) => {
    UI.confirm('Desbloquear alumno', `¿Desbloquear préstamos para ${nombre}? Esta acción es manual y queda registrada.`, async () => {
      await DB.run(`UPDATE alumnos SET bloqueado_prestamo=0, bloqueado_hasta=NULL WHERE id=?`, id);
      UI.toast(`${nombre} desbloqueado`, 'success');
      recargar();
    });
  };
};

// ─── Personal ─────────────────────────────────────────────────────────────────
Pages.personal = async function() {
  const container = document.getElementById('page-container');

  async function recargar() {
    const lista = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
    document.getElementById('tabla-personal').innerHTML = UI.buildTable(
      ['Nombre', 'Rol', 'Carrera(s)', 'DNI', 'Teléfono', ''],
      lista.map(p => `
        <tr>
          <td class="fw-600">${p.apellido}, ${p.nombre}</td>
          <td><span class="badge ${p.rol === 'becario' ? 'badge-blue' : p.rol === 'presidente' ? 'badge-green' : 'badge-gray'}">${p.rol}</span></td>
          <td>${p.carrera
            ? p.carrera.split(',').map(s => `<span class="badge badge-gray" style="margin:1px;">${s.trim()}</span>`).join(' ')
            : '—'}</td>
          <td class="td-muted">${p.dni || '—'}</td>
          <td class="td-muted">${p.telefono || '—'}</td>
          <td style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-secondary" onclick="Pages._editPersonal(${p.id})">✎</button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deletePersonal(${p.id},'${p.nombre} ${p.apellido}')">✕</button>
          </td>
        </tr>
      `),
      'Sin personal registrado'
    );
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Personal</h1>
        <div class="page-subtitle">Becarios y miembros del centro</div>
      </div>
      <button class="btn btn-primary" onclick="Pages._formPersonal()">+ Nuevo</button>
    </div>
    <div id="tabla-personal"></div>
  `;

  await recargar();

  async function formPersonalModal(p = null) {
    const multiSelect = await Pages._carrerasMultiSelect('pe-carrera', p?.carrera || '');
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${p ? 'Editar' : 'Nuevo personal'}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" id="pe-nombre" value="${p?.nombre || ''}" />
        </div>
        <div class="form-group">
          <label>Apellido *</label>
          <input type="text" id="pe-apellido" value="${p?.apellido || ''}" />
        </div>
        <div class="form-group">
          <label>Rol *</label>
          <select id="pe-rol">
            <option value="becario" ${p?.rol === 'becario' ? 'selected' : ''}>Becario</option>
            <option value="presidente" ${p?.rol === 'presidente' ? 'selected' : ''}>Presidente</option>
            <option value="vocal" ${p?.rol === 'vocal' ? 'selected' : ''}>Vocal</option>
          </select>
        </div>
        <div class="form-group">
          <label>DNI</label>
          <input type="text" id="pe-dni" value="${p?.dni || ''}" />
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>Carreras</label>
          ${multiSelect}
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="text" id="pe-tel" value="${p?.telefono || ''}" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="pe-email" value="${p?.email || ''}" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-personal">Guardar</button>
      </div>
    `);

    document.getElementById('btn-guardar-personal').onclick = async () => {
      const n = document.getElementById('pe-nombre').value.trim();
      const ap = document.getElementById('pe-apellido').value.trim();
      if (!n || !ap) { UI.toast('Nombre y apellido son obligatorios', 'error'); return; }
      const carrera = Pages._getCarrerasSeleccionadas('pe-carrera') || null;
      const data = [n, ap,
        document.getElementById('pe-rol').value,
        carrera,
        document.getElementById('pe-dni').value.trim() || null,
        document.getElementById('pe-email').value.trim() || null,
        document.getElementById('pe-tel').value.trim() || null
      ];
      if (p) {
        await DB.run(`UPDATE personal SET nombre=?,apellido=?,rol=?,carrera=?,dni=?,email=?,telefono=? WHERE id=?`, ...data, p.id);
      } else {
        await DB.run(`INSERT INTO personal (nombre,apellido,rol,carrera,dni,email,telefono) VALUES (?,?,?,?,?,?,?)`, ...data);
      }
      UI.toast('Guardado', 'success');
      UI.closeModal();
      recargar();
    };
  }

  Pages._formPersonal = () => formPersonalModal();
  Pages._editPersonal = async (id) => { const p = await DB.get(`SELECT * FROM personal WHERE id=?`, id); formPersonalModal(p); };
  Pages._deletePersonal = (id, nombre) => {
    UI.confirm('Eliminar personal', `¿Eliminar a ${nombre}?`, async () => {
      await DB.run(`UPDATE personal SET activo=0 WHERE id=?`, id);
      UI.toast('Eliminado', 'info');
      recargar();
    });
  };
};

// ─── Materiales ───────────────────────────────────────────────────────────────
Pages.materiales = async function() {
  const container = document.getElementById('page-container');

  async function recargar() {
    const lista = await DB.query(`SELECT * FROM materiales ORDER BY nombre`);
    document.getElementById('tabla-mat').innerHTML = UI.buildTable(
      ['Nombre', 'Categoría', 'Total', 'Disponibles', ''],
      lista.map(m => `
        <tr>
          <td class="fw-600">${m.nombre}</td>
          <td>${m.categoria}</td>
          <td class="text-mono">${m.cantidad_total}</td>
          <td class="text-mono ${m.cantidad_disponible === 0 ? 'text-red' : m.cantidad_disponible < m.cantidad_total ? 'text-yellow' : 'text-green'}">
            ${m.cantidad_disponible}
          </td>
          <td style="display:flex;gap:6px;">
            ${App.esAdmin() ? `
              <button class="btn btn-sm btn-secondary" onclick="Pages._editMat(${m.id})">✎</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteMat(${m.id},'${m.nombre}')">✕</button>
            ` : ''}
          </td>
        </tr>
      `),
      'Sin materiales registrados'
    );
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Materiales</h1>
        <div class="page-subtitle">Inventario de materiales para préstamo</div>
      </div>
      ${App.esAdmin() ? '<button class="btn btn-primary" onclick="Pages._formMat()">+ Nuevo material</button>' : ''}
    </div>
    <div id="tabla-mat"></div>
  `;

  await recargar();

  function formMatModal(m = null) {
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${m ? 'Editar material' : 'Nuevo material'}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group" style="grid-column:span 2">
          <label>Nombre *</label>
          <input type="text" id="mat-nombre" value="${m?.nombre || ''}" placeholder="Ej: Calculadora, Mate, etc." />
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="mat-cat">
            <option value="estudio" ${m?.categoria === 'estudio' ? 'selected' : ''}>Estudio</option>
            <option value="utensilio" ${m?.categoria === 'utensilio' ? 'selected' : ''}>Utensilio</option>
            <option value="otro" ${m?.categoria === 'otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label>Cantidad total</label>
          <input type="number" id="mat-total" value="${m?.cantidad_total || 1}" min="1" />
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label>Descripción</label>
          <input type="text" id="mat-desc" value="${m?.descripcion || ''}" placeholder="Descripción opcional" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-mat">Guardar</button>
      </div>
    `);

    document.getElementById('btn-guardar-mat').onclick = async () => {
      const nombre = document.getElementById('mat-nombre').value.trim();
      if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
      const cat = document.getElementById('mat-cat').value;
      const total = Number(document.getElementById('mat-total').value) || 1;
      const desc = document.getElementById('mat-desc').value.trim() || null;
      if (m) {
        const diff = total - m.cantidad_total;
        await DB.run(`UPDATE materiales SET nombre=?,categoria=?,cantidad_total=?,cantidad_disponible=cantidad_disponible+?,descripcion=? WHERE id=?`,
          nombre, cat, total, diff, desc, m.id);
      } else {
        await DB.run(`INSERT INTO materiales (nombre,descripcion,cantidad_total,cantidad_disponible,categoria) VALUES (?,?,?,?,?)`,
          nombre, desc, total, total, cat);
      }
      UI.toast('Material guardado', 'success');
      UI.closeModal();
      recargar();
    };
  }

  Pages._formMat = () => formMatModal();
  Pages._editMat = async (id) => { const m = await DB.get(`SELECT * FROM materiales WHERE id=?`, id); formMatModal(m); };
  Pages._deleteMat = (id, nombre) => {
    UI.confirm('Eliminar material', `¿Eliminar "${nombre}"?`, async () => {
      await DB.run(`DELETE FROM materiales WHERE id=?`, id);
      UI.toast('Eliminado', 'info');
      recargar();
    });
  };
};

// ─── Configuración ────────────────────────────────────────────────────────────
Pages.configuracion = async function() {
  const container = document.getElementById('page-container');

  const conf = {
    nombre_centro: await window.api.getConfig('nombre_centro'),
    hojas_gratis:  await window.api.getConfig('hojas_gratis'),
    hojas_max:     await window.api.getConfig('hojas_max'),
    precio_hoja:   await window.api.getConfig('precio_hoja'),
  };

  async function recargarCarreras() {
    const carreras = await DB.query(`SELECT * FROM carreras ORDER BY nombre`);
    document.getElementById('lista-carreras').innerHTML = carreras.length === 0
      ? `<div class="text-muted fs-12" style="padding:8px 0;">Sin carreras cargadas</div>`
      : carreras.map(c => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-light);">
            <div>
              <span class="badge badge-blue" style="margin-right:8px;">${c.siglas || '—'}</span>
              <span style="font-size:13px;">${c.nombre}</span>
            </div>
            <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteCarrera(${c.id}, '${c.nombre}')">✕</button>
          </div>
        `).join('');
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Configuración</h1>
        <div class="page-subtitle">Parámetros generales del sistema</div>
      </div>
    </div>

    <div class="grid-2" style="max-width:1000px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">General</div>
          <div class="form-group">
            <label>Nombre del centro</label>
            <input type="text" id="cf-nombre" value="${conf.nombre_centro || ''}" />
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Hojas</div>
          <div class="form-grid form-grid-3">
            <div class="form-group">
              <label>Gratis / día</label>
              <input type="number" id="cf-hgratis" value="${conf.hojas_gratis || 3}" min="0" max="20" />
            </div>
            <div class="form-group">
              <label>Máx. pagas / día</label>
              <input type="number" id="cf-hmax" value="${conf.hojas_max || 7}" min="0" max="30" />
            </div>
            <div class="form-group">
              <label>Precio / hoja ($)</label>
              <input type="number" id="cf-precio" value="${conf.precio_hoja || 0}" min="0" step="0.5" />
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="btn-guardar-conf">◈ Guardar configuración</button>

        <div class="card" style="margin-top:20px;">
          <div class="card-title">Información del sistema</div>
          <div style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);line-height:2;">
            <div>Versión: <span class="text-accent">1.0.0</span></div>
            <div>Base de datos: <span class="text-green">SQLite · local</span></div>
            <div>Actualizaciones: <span class="text-accent">automáticas via GitHub</span></div>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title">Carreras</div>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
            Completá el nombre completo y las siglas. Las siglas se mostrarán en tablas y listados.
          </p>
          <div class="form-grid form-grid-2" style="margin-bottom:10px;">
            <div class="form-group">
              <label>Nombre completo</label>
              <input type="text" id="nueva-carrera-nombre" placeholder="Ej: Ingeniería en Sistemas" />
            </div>
            <div class="form-group">
              <label>Siglas</label>
              <input type="text" id="nueva-carrera-siglas" placeholder="Ej: ISI" style="text-transform:uppercase;" />
            </div>
          </div>
          <button class="btn btn-primary" id="btn-agregar-carrera" style="width:100%;margin-bottom:16px;">+ Agregar carrera</button>
          <div id="lista-carreras">
            <div class="text-muted fs-12">Cargando...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  await recargarCarreras();

  document.getElementById('btn-guardar-conf').onclick = async () => {
    const updates = {
      nombre_centro: document.getElementById('cf-nombre').value.trim(),
      hojas_gratis:  document.getElementById('cf-hgratis').value,
      hojas_max:     document.getElementById('cf-hmax').value,
      precio_hoja:   document.getElementById('cf-precio').value,
    };
    for (const [k, v] of Object.entries(updates)) {
      await window.api.setConfig(k, v);
      App.config[k] = v;
    }
    document.getElementById('titlebar-name').textContent = updates.nombre_centro || 'Centro de Estudiantes';
    UI.toast('Configuración guardada', 'success');
  };

  document.getElementById('btn-agregar-carrera').onclick = async () => {
    const nombre = document.getElementById('nueva-carrera-nombre').value.trim();
    const siglas = document.getElementById('nueva-carrera-siglas').value.trim().toUpperCase();
    if (!nombre) { UI.toast('Ingresá el nombre de la carrera', 'error'); return; }
    if (!siglas) { UI.toast('Ingresá las siglas', 'error'); return; }
    const existe = await DB.get(`SELECT id FROM carreras WHERE nombre=? OR siglas=?`, nombre, siglas);
    if (existe) { UI.toast('Ya existe una carrera con ese nombre o siglas', 'error'); return; }
    await DB.run(`INSERT INTO carreras (nombre, siglas) VALUES (?,?)`, nombre, siglas);
    document.getElementById('nueva-carrera-nombre').value = '';
    document.getElementById('nueva-carrera-siglas').value = '';
    UI.toast(`Carrera "${siglas}" agregada`, 'success');
    recargarCarreras();
  };

  // Enter en cualquiera de los campos agrega
  ['nueva-carrera-nombre', 'nueva-carrera-siglas'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-agregar-carrera').click();
    });
  });

  // Auto-uppercase siglas mientras se escribe
  document.getElementById('nueva-carrera-siglas').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });

  Pages._deleteCarrera = (id, nombre) => {
    UI.confirm('Eliminar carrera', `¿Eliminar "${nombre}"? Los alumnos y personal con esta carrera mantendrán sus siglas registradas.`, async () => {
      await DB.run(`DELETE FROM carreras WHERE id=?`, id);
      UI.toast('Carrera eliminada', 'info');
      recargarCarreras();
    });
  };
};
