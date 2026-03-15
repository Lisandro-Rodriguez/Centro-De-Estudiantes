// ─── Inventario: Materiales + Mercadería ─────────────────────────────────────
Pages = window.Pages || {};

Pages.inventario = async function(tab) {
  Pages._inventarioTab = tab || Pages._inventarioTab || 'materiales';
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:16px;">
      <h1 class="page-title">🎒 Inventario</h1>
    </div>
    <div class="page-tabs" style="margin-bottom:24px;">
      <div class="page-tab ${Pages._inventarioTab==='materiales'?'active':''}" id="tab-inv-mat">🎒 Materiales para préstamo</div>
      <div class="page-tab ${Pages._inventarioTab==='mercaderia'?'active':''}" id="tab-inv-merc">🧉 Mercadería</div>
    </div>
    <div id="inventario-body"></div>`;

  document.getElementById('tab-inv-mat').addEventListener('click',  () => Pages.inventario('materiales'));
  document.getElementById('tab-inv-merc').addEventListener('click', () => Pages.inventario('mercaderia'));

  if (Pages._inventarioTab === 'materiales') await Pages._renderMateriales();
  else await Pages._renderMercaderia();
};

// ─── Helpers SQL ──────────────────────────────────────────────────────────────
async function _sqlRun(sql, params) {
  const res = await window.api.run(sql, Array.isArray(params) ? params : []);
  if (!res.ok) { console.error('sqlRun error:', res.error, sql, params); throw new Error(res.error); }
  return res;
}
async function _sqlGet(sql, params) {
  const res = await window.api.get(sql, Array.isArray(params) ? params : []);
  if (!res.ok) { console.error('sqlGet error:', res.error); return null; }
  return res.data || null;
}
async function _sqlAll(sql, params) {
  const res = await window.api.query(sql, Array.isArray(params) ? params : []);
  if (!res.ok) { console.error('sqlAll error:', res.error); return []; }
  return res.data || [];
}

// ══════════════════════════════════════════════════════════════════
// MATERIALES
// ══════════════════════════════════════════════════════════════════
Pages._renderMateriales = async function() {
  const body = document.getElementById('inventario-body');
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      ${App.esAdmin() ? '<button class="btn btn-primary" id="btn-nuevo-mat">+ Nuevo material</button>' : ''}
    </div>
    <div id="tabla-mat"></div>`;

  await Pages._recargarMateriales();

  if (App.esAdmin()) {
    // FIX: sin { once: true } para que el botón funcione múltiples veces
    document.getElementById('btn-nuevo-mat')
      .addEventListener('click', () => App.pedirPinAdmin(() => Pages._formMatModal(null)));
  }
};

Pages._recargarMateriales = async function() {
  const t = document.getElementById('tabla-mat');
  if (!t) return;
  const lista = await _sqlAll('SELECT * FROM materiales ORDER BY nombre', []);
  t.innerHTML = UI.buildTable(
    ['Nombre','Categoría','Total','Disponibles',''],
    lista.map(m => `<tr>
      <td style="font-weight:500;">${m.nombre}</td>
      <td>${m.categoria||'—'}</td>
      <td class="text-mono">${m.cantidad_total}</td>
      <td class="text-mono" style="color:${m.cantidad_disponible===0?'var(--red)':m.cantidad_disponible<m.cantidad_total?'var(--yellow)':'var(--green)'}">
        ${m.cantidad_disponible}
      </td>
      <td style="display:flex;gap:6px;">
        ${App.esAdmin() ? `
          <button class="btn btn-sm btn-secondary" data-edit-mat="${m.id}">✎</button>
          <button class="btn btn-sm btn-danger btn-icon" data-del-mat="${m.id}" data-nombre="${m.nombre.replace(/"/g,'&quot;')}">✕</button>
        ` : ''}
      </td>
    </tr>`),
    'Sin materiales registrados'
  );

  t.querySelectorAll('[data-edit-mat]').forEach(btn => {
    btn.addEventListener('click', () => App.pedirPinAdmin(() => Pages._formMatModal(Number(btn.dataset.editMat))));
  });
  t.querySelectorAll('[data-del-mat]').forEach(btn => {
    btn.addEventListener('click', () => App.pedirPinAdmin(() => Pages._deleteMat(Number(btn.dataset.delMat), btn.dataset.nombre)));
  });
};

Pages._formMatModal = async function(id) {
  const m = id ? await _sqlGet('SELECT * FROM materiales WHERE id=?', [id]) : null;
  const cerrar = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">${m ? 'Editar material' : 'Nuevo material'}</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group" style="grid-column:span 2">
        <label>Nombre *</label>
        <input type="text" id="mat-nombre" value="${m?.nombre||''}" placeholder="Ej: Calculadora, Mate..." />
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <select id="mat-cat">
          <option value="estudio"   ${m?.categoria==='estudio'  ?'selected':''}>Estudio</option>
          <option value="utensilio" ${m?.categoria==='utensilio'?'selected':''}>Utensilio</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cantidad total</label>
        <input type="number" id="mat-total" value="${m?.cantidad_total||1}" min="1" />
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label>Descripción</label>
        <input type="text" id="mat-desc" value="${m?.descripcion||''}" placeholder="Descripción opcional" />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-mat-cancel">Cancelar</button>
      <button class="btn btn-primary"   id="btn-mat-save">Guardar</button>
    </div>`);

  document.getElementById('btn-mat-cancel').addEventListener('click', cerrar, { once: true });

  let guardando = false;
  document.getElementById('btn-mat-save').addEventListener('click', async () => {
    if (guardando) return;
    const nombre = document.getElementById('mat-nombre').value.trim();
    if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
    const cat   = document.getElementById('mat-cat').value;
    const total = Number(document.getElementById('mat-total').value) || 1;
    const desc  = document.getElementById('mat-desc').value.trim() || null;
    guardando = true;
    try {
      if (m) {
        const diff = total - m.cantidad_total;
        await _sqlRun('UPDATE materiales SET nombre=?,categoria=?,cantidad_total=?,cantidad_disponible=cantidad_disponible+?,descripcion=? WHERE id=?',
          [nombre, cat, total, diff, desc, m.id]);
      } else {
        await _sqlRun('INSERT INTO materiales (nombre,descripcion,cantidad_total,cantidad_disponible,categoria) VALUES (?,?,?,?,?)',
          [nombre, desc, total, total, cat]);
      }
      cerrar();
      UI.toast('Material guardado', 'success');
      await Pages._recargarMateriales();
    } catch(e) {
      UI.toast('Error: ' + e.message, 'error');
      guardando = false;
    }
  });
};

Pages._deleteMat = function(id, nombre) {
  UI.confirm('Eliminar material', `¿Eliminar "${nombre}"?`, async () => {
    await _sqlRun('DELETE FROM materiales WHERE id=?', [id]);
    UI.toast('Eliminado', 'info');
    await Pages._recargarMateriales();
  });
};

// ══════════════════════════════════════════════════════════════════
// MERCADERÍA
// ══════════════════════════════════════════════════════════════════
Pages._renderMercaderia = async function() {
  const body = document.getElementById('inventario-body');
  body.innerHTML = `
    <div id="alerta-stock-bajo"></div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      ${App.esAdmin() ? '<button class="btn btn-primary" id="btn-nuevo-merc">+ Nuevo producto</button>' : ''}
      <button class="btn btn-secondary" id="btn-mov-merc">📥 Registrar movimiento</button>
    </div>
    <div id="tabla-merc"></div>
    <div style="margin-top:24px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text-secondary);">Últimos movimientos</div>
      <div id="tabla-movs"></div>
    </div>`;

  await Pages._recargarMercaderia();

  if (App.esAdmin()) {
    // FIX: sin { once: true }
    document.getElementById('btn-nuevo-merc')
      .addEventListener('click', () => App.pedirPinAdmin(() => Pages._formMercaderiaModal(null)));
  }

  // FIX: sin { once: true } — el botón debe poder abrirse múltiples veces
  document.getElementById('btn-mov-merc')
    .addEventListener('click', () => Pages._movimientoModal());
};

Pages._recargarMercaderia = async function() {
  const t = document.getElementById('tabla-merc');
  if (!t) return;

  const lista = await _sqlAll('SELECT * FROM mercaderia ORDER BY nombre', []);
  const bajos = lista.filter(m => m.stock_actual <= (m.stock_minimo || 0));

  const alerta = document.getElementById('alerta-stock-bajo');
  if (alerta) alerta.innerHTML = bajos.length > 0 ? `
    <div style="background:var(--yellow-dim);border:1px solid var(--yellow);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:13px;">
      ⚠️ ${bajos.length} producto${bajos.length>1?'s':''} con stock bajo el mínimo
    </div>` : '';

  t.innerHTML = UI.buildTable(
    ['Producto','Unidad','Stock actual','Stock mínimo','Estado',''],
    lista.map(m => {
      const bajo = m.stock_actual <= (m.stock_minimo || 0);
      return `<tr>
        <td style="font-weight:500;">${m.nombre}</td>
        <td>${m.unidad||'—'}</td>
        <td class="text-mono" style="color:${bajo?'var(--red)':'var(--green)'}">${m.stock_actual}</td>
        <td class="text-mono">${m.stock_minimo||0}</td>
        <td>${bajo?'<span class="badge badge-yellow">⚠ Stock bajo</span>':'<span class="badge badge-green">OK</span>'}</td>
        <td style="display:flex;gap:6px;">
          ${App.esAdmin() ? `
            <button class="btn btn-sm btn-secondary" data-edit-merc="${m.id}">✎</button>
            <button class="btn btn-sm btn-danger btn-icon" data-del-merc="${m.id}" data-nombre="${m.nombre.replace(/"/g,'&quot;')}">✕</button>
          ` : ''}
        </td>
      </tr>`;
    }),
    'Sin productos registrados'
  );

  t.querySelectorAll('[data-edit-merc]').forEach(btn => {
    btn.addEventListener('click', () => App.pedirPinAdmin(() => Pages._formMercaderiaModal(Number(btn.dataset.editMerc))));
  });
  t.querySelectorAll('[data-del-merc]').forEach(btn => {
    btn.addEventListener('click', () => App.pedirPinAdmin(() => Pages._deleteMercaderia(Number(btn.dataset.delMerc), btn.dataset.nombre)));
  });

  const movs = await _sqlAll(`
    SELECT mm.*, m.nombre as producto
    FROM mercaderia_movimientos mm
    JOIN mercaderia m ON m.id = mm.mercaderia_id
    ORDER BY mm.id DESC LIMIT 15`, []);

  const tm = document.getElementById('tabla-movs');
  if (tm) tm.innerHTML = UI.buildTable(
    ['Fecha','Producto','Tipo','Cantidad','Motivo'],
    movs.map(mv => `<tr>
      <td class="text-mono" style="font-size:12px;">${UI.formatDate(mv.created_at)||'—'}</td>
      <td>${mv.producto}</td>
      <td><span class="badge ${mv.tipo==='entrada'?'badge-green':'badge-yellow'}">${mv.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td>
      <td class="text-mono">${mv.cantidad}</td>
      <td style="font-size:12px;">${mv.motivo||'—'}</td>
    </tr>`),
    'Sin movimientos registrados'
  );

  if (typeof Inventario !== 'undefined') Inventario.actualizarBadge(bajos.length);
};

Pages._formMercaderiaModal = async function(id) {
  const m = id ? await _sqlGet('SELECT * FROM mercaderia WHERE id=?', [id]) : null;
  const cerrar = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">${m ? 'Editar producto' : 'Nuevo producto'}</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group" style="grid-column:span 2">
        <label>Nombre *</label>
        <input type="text" id="merc-nombre" value="${m?.nombre||''}" placeholder="Ej: Yerba, Azúcar..." />
      </div>
      <div class="form-group">
        <label>Unidad</label>
        <select id="merc-unidad">
          <option value="kg"   ${m?.unidad==='kg'  ?'selected':''}>kg</option>
          <option value="g"    ${m?.unidad==='g'   ?'selected':''}>g</option>
          <option value="L"    ${m?.unidad==='L'   ?'selected':''}>L</option>
          <option value="ml"   ${m?.unidad==='ml'  ?'selected':''}>ml</option>
          <option value="unid" ${m?.unidad==='unid'?'selected':''}>unidades</option>
          <option value="caja" ${m?.unidad==='caja'?'selected':''}>cajas</option>
          <option value="paq"  ${m?.unidad==='paq' ?'selected':''}>paquetes</option>
        </select>
      </div>
      <div class="form-group">
        <label>Stock mínimo (alerta)</label>
        <input type="number" id="merc-minimo" value="${m?.stock_minimo||0}" min="0" />
      </div>
      ${!m ? `<div class="form-group" style="grid-column:span 2">
        <label>Stock inicial</label>
        <input type="number" id="merc-inicial" value="0" min="0" />
      </div>` : ''}
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-merc-cancel">Cancelar</button>
      <button class="btn btn-primary"   id="btn-merc-save">Guardar</button>
    </div>`);

  document.getElementById('btn-merc-cancel').addEventListener('click', cerrar, { once: true });

  let guardando = false;
  document.getElementById('btn-merc-save').addEventListener('click', async () => {
    if (guardando) return;
    const nombre = document.getElementById('merc-nombre').value.trim();
    if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
    const unidad = document.getElementById('merc-unidad').value;
    const minimo = Number(document.getElementById('merc-minimo').value) || 0;
    guardando = true;
    try {
      if (m) {
        await _sqlRun('UPDATE mercaderia SET nombre=?,unidad=?,stock_minimo=? WHERE id=?',
          [nombre, unidad, minimo, m.id]);
      } else {
        const inicial = Number(document.getElementById('merc-inicial')?.value) || 0;
        const ins = await _sqlRun('INSERT INTO mercaderia (nombre,unidad,stock_actual,stock_minimo) VALUES (?,?,?,?)',
          [nombre, unidad, inicial, minimo]);
        if (inicial > 0 && ins.lastInsertRowid) {
          await _sqlRun('INSERT INTO mercaderia_movimientos (mercaderia_id,tipo,cantidad,motivo) VALUES (?,?,?,?)',
            [ins.lastInsertRowid, 'entrada', inicial, 'Stock inicial']);
        }
      }
      cerrar();
      UI.toast('Producto guardado', 'success');
      await Pages._recargarMercaderia();
    } catch(e) {
      UI.toast('Error: ' + e.message, 'error');
      guardando = false;
    }
  });
};

Pages._deleteMercaderia = function(id, nombre) {
  UI.confirm('Eliminar producto', `¿Eliminar "${nombre}"?`, async () => {
    await _sqlRun('DELETE FROM mercaderia WHERE id=?', [id]);
    await _sqlRun('DELETE FROM mercaderia_movimientos WHERE mercaderia_id=?', [id]);
    UI.toast('Eliminado', 'info');
    await Pages._recargarMercaderia();
  });
};

// ─── Modal: registrar movimiento ──────────────────────────────────────────────
Pages._movimientoModal = async function() {
  const lista = await _sqlAll('SELECT * FROM mercaderia ORDER BY nombre', []);
  if (!lista.length) { UI.toast('Primero agregá productos al inventario', 'error'); return; }

  const cerrar = UI.modal(`
    <div class="modal-header">
      <h3 class="modal-title">📥 Registrar movimiento</h3>
      <button class="modal-close">✕</button>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group">
        <label>Producto *</label>
        <select id="mov-prod">
          <option value="">— Seleccionar —</option>
          ${lista.map(m=>`<option value="${m.id}">${m.nombre} (stock: ${m.stock_actual} ${m.unidad||''})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tipo *</label>
        <select id="mov-tipo">
          <option value="entrada">📥 Entrada (suma stock)</option>
          <option value="salida">📤 Salida (resta stock)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cantidad *</label>
        <input type="number" id="mov-cant" value="1" min="1" />
      </div>
      <div class="form-group">
        <label>Motivo</label>
        <input type="text" id="mov-motivo" placeholder="Ej: Compra, Consumo..." />
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" id="btn-mov-cancel">Cancelar</button>
      <button class="btn btn-primary"   id="btn-mov-save">Registrar</button>
    </div>`);

  document.getElementById('btn-mov-cancel').addEventListener('click', cerrar, { once: true });

  // FIX: sin { once: true } + bandera guardando para evitar doble click
  //      y que el botón siga vivo si hay error de validación
  let guardando = false;
  document.getElementById('btn-mov-save').addEventListener('click', async () => {
    if (guardando) return;

    const prodId = Number(document.getElementById('mov-prod').value);
    const tipo   = document.getElementById('mov-tipo').value;
    const cant   = Number(document.getElementById('mov-cant').value);
    const motivo = document.getElementById('mov-motivo').value.trim() || null;
    const hoy    = new Date().toISOString().split('T')[0];

    // Validaciones — el botón sigue vivo si fallan
    if (!prodId)        { UI.toast('Seleccioná un producto', 'error'); return; }
    if (!cant || cant <= 0) { UI.toast('La cantidad debe ser mayor a 0', 'error'); return; }

    guardando = true;
    document.getElementById('btn-mov-save').disabled = true;

    try {
      const prod = await _sqlGet('SELECT * FROM mercaderia WHERE id=?', [prodId]);
      if (!prod) { UI.toast('Producto no encontrado', 'error'); guardando = false; return; }

      if (tipo === 'salida' && cant > prod.stock_actual) {
        UI.toast(`Stock insuficiente — disponible: ${prod.stock_actual} ${prod.unidad||''}`, 'error');
        guardando = false;
        document.getElementById('btn-mov-save').disabled = false;
        return;
      }

      const delta = tipo === 'entrada' ? cant : -cant;
      await _sqlRun('UPDATE mercaderia SET stock_actual = stock_actual + ? WHERE id=?', [delta, prodId]);
      await _sqlRun('INSERT INTO mercaderia_movimientos (mercaderia_id,tipo,cantidad,motivo) VALUES (?,?,?,?)',
        [prodId, tipo, cant, motivo]);

      // 1. Cerrar modal
      cerrar();
      // 2. Toast
      UI.toast('Movimiento registrado', 'success');
      // 3. Actualizar tabla
      await Pages._recargarMercaderia();

    } catch(e) {
      UI.toast('Error: ' + e.message, 'error');
      guardando = false;
      const btn = document.getElementById('btn-mov-save');
      if (btn) btn.disabled = false;
    }
  });
};
