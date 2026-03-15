// ─── Gente: Alumnos + Personal ────────────────────────────────────────────────
Pages = window.Pages || {};

Pages.gente = async function(tab) {
  Pages._genteTab = tab || Pages._genteTab || 'alumnos';
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:16px;"><h1 class="page-title">👥 Gente</h1></div>
    <div class="page-tabs" style="margin-bottom:24px;">
      <div class="page-tab ${Pages._genteTab==='alumnos'?'active':''}"  id="tab-al">🎓 Alumnos</div>
      <div class="page-tab ${Pages._genteTab==='personal'?'active':''}" id="tab-pe">🧑‍💼 Personal</div>
    </div>
    <div id="gente-body"></div>`;
  document.getElementById('tab-al').onclick = () => Pages.gente('alumnos');
  document.getElementById('tab-pe').onclick = () => Pages.gente('personal');
  if (Pages._genteTab === 'alumnos') await Pages._renderAlumnos();
  else await Pages._renderPersonal();
};

// ─── Alumnos ──────────────────────────────────────────────────────────────────
Pages._renderAlumnos = async function() {
  const body = document.getElementById('gente-body');
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      ${App.esAdmin() ? '<button class="btn btn-primary" id="btn-nuevo-al">+ Nuevo alumno</button>' : ''}
      <input type="text" placeholder="Buscar por nombre o DNI..." id="busq-al" style="max-width:280px;" />
    </div>
    <div id="tabla-al"></div>`;

  const recargar = Pages._recargarAlumnos;
  await recargar();
  body.querySelector('#busq-al').addEventListener('input', function() { recargar(this.value); });
  if (App.esAdmin()) document.getElementById('btn-nuevo-al').onclick = () => Pages._formAlumnoModal(null);
};

Pages._recargarAlumnos = async function(busq = '') {
  const lista = await DB.query(
    `SELECT * FROM alumnos WHERE activo=1 AND (nombre||' '||apellido LIKE ? OR dni LIKE ?) ORDER BY apellido`,
    `%${busq}%`, `%${busq}%`
  );
  const t = document.getElementById('tabla-al');
  if (!t) return;
  t.innerHTML = UI.buildTable(
    ['Nombre','DNI','Carrera','Estado',''],
    lista.map(a => `<tr>
      <td>${a.apellido}, ${a.nombre}</td>
      <td class="text-mono">${a.dni||'—'}</td>
      <td style="font-size:12px;">${a.carrera ? a.carrera.split(',').map(s=>`<span class="badge badge-gray" style="margin:1px;">${s.trim()}</span>`).join('') : '—'}</td>
      <td>
        ${a.bloqueado_prestamo ? '<span class="badge badge-red">⛔ Bloqueado</span>' : a.incumplimientos_count>0 ? `<span class="badge badge-yellow">⚠ ${a.incumplimientos_count}</span>` : '<span class="badge badge-green" style="opacity:.5">OK</span>'}
      </td>
      <td style="display:flex;gap:6px;">
        ${App.esAdmin() ? `
          <button class="btn btn-sm btn-secondary" onclick="Pages._formAlumnoModal(${a.id})">✎</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="Pages._deleteAlumno(${a.id},'${(a.nombre+' '+a.apellido).replace(/'/g,"\\'")}')">✕</button>
          ${a.bloqueado_prestamo ? `<button class="btn btn-sm btn-secondary" onclick="Pages._desbloquearAlumno(${a.id},'${(a.nombre+' '+a.apellido).replace(/'/g,"\\'")}')">🔓</button>` : ''}
        ` : ''}
      </td>
    </tr>`),
    'Sin alumnos registrados'
  );
};

Pages._formAlumnoModal = async function(id) {
  const alumno = id ? await DB.get(`SELECT * FROM alumnos WHERE id=?`, id) : null;
  const multiSelect = await Pages._carrerasMultiSelect('al-carrera', alumno?.carrera || '');
  const cerrarAl = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">${alumno ? 'Editar alumno' : 'Nuevo alumno'}</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group"><label>Nombre *</label><input type="text" id="al-nombre" value="${alumno?.nombre||''}" /></div>
      <div class="form-group"><label>Apellido *</label><input type="text" id="al-apellido" value="${alumno?.apellido||''}" /></div>
      <div class="form-group"><label>DNI</label><input type="text" id="al-dni" value="${alumno?.dni||''}" /></div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="al-tel" value="${alumno?.telefono||''}" /></div>
      <div class="form-group" style="grid-column:span 2"><label>Carreras</label>${multiSelect}</div>
      <div class="form-group" style="grid-column:span 2"><label>Email</label><input type="email" id="al-email" value="${alumno?.email||''}" /></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-al-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-al">Guardar</button>
    </div>`);
  document.getElementById('btn-al-cancel').addEventListener('click', cerrarAl, { once: true });
  document.getElementById('btn-guardar-al').addEventListener('click', async () => {
    const n = document.getElementById('al-nombre').value.trim();
    const ap = document.getElementById('al-apellido').value.trim();
    if (!n || !ap) { UI.toast('Nombre y apellido son obligatorios', 'error'); return; }
    const carrera = Pages._getCarrerasSeleccionadas('al-carrera') || null;
    const data = [n, ap, document.getElementById('al-dni').value.trim()||null, carrera,
                  document.getElementById('al-email').value.trim()||null, document.getElementById('al-tel').value.trim()||null];
    if (alumno) await DB.run(`UPDATE alumnos SET nombre=?,apellido=?,dni=?,carrera=?,email=?,telefono=? WHERE id=?`, ...data, alumno.id);
    else        await DB.run(`INSERT INTO alumnos (nombre,apellido,dni,carrera,email,telefono) VALUES (?,?,?,?,?,?)`, ...data);
    UI.toast('Alumno guardado', 'success');
    cerrarAl();
    await Pages._recargarAlumnos();
  }, { once: true });
};

Pages._deleteAlumno = function(id, nombre) {
  UI.confirm('Eliminar alumno', `¿Eliminar a ${nombre}?`, async () => {
    await DB.run(`UPDATE alumnos SET activo=0 WHERE id=?`, id);
    UI.toast('Alumno eliminado', 'info');
    await Pages._recargarAlumnos();
  });
};

Pages._desbloquearAlumno = function(id, nombre) {
  UI.confirm('Desbloquear', `¿Desbloquear préstamos para ${nombre}?`, async () => {
    await DB.run(`UPDATE alumnos SET bloqueado_prestamo=0, bloqueado_hasta=NULL WHERE id=?`, id);
    UI.toast(`${nombre} desbloqueado`, 'success');
    await Pages._recargarAlumnos();
  });
};

// ─── Personal ─────────────────────────────────────────────────────────────────
Pages._renderPersonal = async function() {
  const body = document.getElementById('gente-body');
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      ${App.esAdmin() ? '<button class="btn btn-primary" id="btn-nuevo-pe">+ Nuevo miembro</button>' : ''}
    </div>
    <div id="tabla-pe"></div>`;
  await Pages._recargarPersonal();
  if (App.esAdmin()) document.getElementById('btn-nuevo-pe').onclick = () => App.pedirPinAdmin(() => Pages._formPersonalModal(null));
};

Pages._recargarPersonal = async function() {
  const lista = await DB.query(`SELECT * FROM personal WHERE activo=1 ORDER BY apellido`);
  const t = document.getElementById('tabla-pe');
  if (!t) return;
  t.innerHTML = UI.buildTable(
    ['Nombre','Rol','Carrera','DNI',''],
    lista.map(p => `<tr>
      <td>${p.apellido}, ${p.nombre}</td>
      <td><span class="badge ${p.rol==='presidente'?'badge-green':p.rol==='vocal'?'badge-gray':'badge-blue'}">${p.rol}</span></td>
      <td style="font-size:12px;">${p.carrera ? p.carrera.split(',').map(s=>`<span class="badge badge-gray" style="margin:1px;">${s.trim()}</span>`).join('') : '—'}</td>
      <td class="text-mono">${p.dni||'—'}</td>
      <td style="display:flex;gap:6px;">
        ${App.esAdmin() ? `
          <button class="btn btn-sm btn-secondary" onclick="App.pedirPinAdmin(()=>Pages._formPersonalModal(${p.id}))">✎</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="App.pedirPinAdmin(()=>Pages._deletePersonal(${p.id},'${(p.nombre+' '+p.apellido).replace(/'/g,"\\'")}'))">✕</button>
        ` : ''}
      </td>
    </tr>`),
    'Sin personal registrado'
  );
};

Pages._formPersonalModal = async function(id) {
  const p = id ? await DB.get(`SELECT * FROM personal WHERE id=?`, id) : null;
  const multiSelect = await Pages._carrerasMultiSelect('pe-carrera', p?.carrera || '');
  const cerrarPe = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">${p ? 'Editar personal' : 'Nuevo miembro'}</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group"><label>Nombre *</label><input type="text" id="pe-nombre" value="${p?.nombre||''}" /></div>
      <div class="form-group"><label>Apellido *</label><input type="text" id="pe-apellido" value="${p?.apellido||''}" /></div>
      <div class="form-group">
        <label>Rol *</label>
        <select id="pe-rol">
          <option value="becario"    ${p?.rol==='becario'   ?'selected':''}>Becario</option>
          <option value="presidente" ${p?.rol==='presidente'?'selected':''}>Presidente</option>
          <option value="vocal"      ${p?.rol==='vocal'     ?'selected':''}>Vocal</option>
        </select>
      </div>
      <div class="form-group"><label>DNI</label><input type="text" id="pe-dni" value="${p?.dni||''}" /></div>
      <div class="form-group" style="grid-column:span 2"><label>Carreras</label>${multiSelect}</div>
      <div class="form-group"><label>Teléfono</label><input type="text" id="pe-tel" value="${p?.telefono||''}" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="pe-email" value="${p?.email||''}" /></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-pe-cancel">Cancelar</button>
      <button class="btn btn-primary" id="btn-guardar-pe">Guardar</button>
    </div>`);
  document.getElementById('btn-pe-cancel').addEventListener('click', cerrarPe, { once: true });
  document.getElementById('btn-guardar-pe').addEventListener('click', async () => {
    const n = document.getElementById('pe-nombre').value.trim();
    const ap = document.getElementById('pe-apellido').value.trim();
    if (!n || !ap) { UI.toast('Nombre y apellido son obligatorios', 'error'); return; }
    const carrera = Pages._getCarrerasSeleccionadas('pe-carrera') || null;
    const data = [n, ap, document.getElementById('pe-rol').value, carrera,
                  document.getElementById('pe-dni').value.trim()||null,
                  document.getElementById('pe-email').value.trim()||null,
                  document.getElementById('pe-tel').value.trim()||null];
    if (p) await DB.run(`UPDATE personal SET nombre=?,apellido=?,rol=?,carrera=?,dni=?,email=?,telefono=? WHERE id=?`, ...data, p.id);
    else   await DB.run(`INSERT INTO personal (nombre,apellido,rol,carrera,dni,email,telefono) VALUES (?,?,?,?,?,?,?)`, ...data);
    UI.toast('Guardado', 'success');
    cerrarPe();
    await Pages._recargarPersonal();
  }, { once: true });
};

Pages._deletePersonal = function(id, nombre) {
  UI.confirm('Eliminar personal', `¿Eliminar a ${nombre}?`, async () => {
    await DB.run(`UPDATE personal SET activo=0 WHERE id=?`, id);
    UI.toast('Eliminado', 'info');
    await Pages._recargarPersonal();
  });
};