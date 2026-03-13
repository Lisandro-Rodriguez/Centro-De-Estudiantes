Pages = window.Pages || {};

Pages.mercaderia = async function() {
  const container = document.getElementById('page-container');
  const turno = App.getTurnoActivo();

  async function recargar() {
    const lista = await DB.query(`SELECT * FROM mercaderia WHERE activo=1 ORDER BY nombre`);
    const bajoStock = lista.filter(m => m.stock_actual <= m.stock_minimo);

    document.getElementById('tabla-mercaderia').innerHTML = UI.buildTable(
      ['Producto', 'Unidad', 'Stock actual', 'Stock mínimo', 'Estado', ''],
      lista.map(m => {
        const bajo   = m.stock_actual <= m.stock_minimo;
        const critico = m.stock_actual === 0;
        return `
          <tr ${critico ? 'style="background:rgba(239,68,68,0.06);"' : bajo ? 'style="background:rgba(234,179,8,0.06);"' : ''}>
            <td class="fw-600">${m.nombre}</td>
            <td class="td-muted">${m.unidad}</td>
            <td class="text-mono" style="font-weight:600;color:${critico?'var(--red)':bajo?'var(--yellow)':'var(--green)'};">
              ${m.stock_actual}
            </td>
            <td class="text-mono td-muted">${m.stock_minimo}</td>
            <td>
              ${critico
                ? '<span class="badge badge-red">Sin stock</span>'
                : bajo
                  ? '<span class="badge badge-yellow">Stock bajo</span>'
                  : '<span class="badge badge-green">OK</span>'}
            </td>
            <td style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-success"   onclick="Pages._movMercaderia(${m.id},'entrada','${m.nombre}','${m.unidad}')" title="Agregar stock">+</button>
              <button class="btn btn-sm btn-secondary" onclick="Pages._movMercaderia(${m.id},'salida','${m.nombre}','${m.unidad}')"  title="Descontar stock">−</button>
              ${App.esAdmin() ? `
                <button class="btn btn-sm btn-secondary" onclick="App.pedirPinAdmin(()=>Pages._editMercaderia(${m.id}))">✎</button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="App.pedirPinAdmin(()=>Pages._deleteMercaderia(${m.id},'${m.nombre}'))">✕</button>
              ` : ''}
            </td>
          </tr>`;
      }),
      'Sin productos en inventario'
    );

    // Actualizar badge del menú
    Inventario.actualizarBadge(bajoStock.length);
  }

  container.innerHTML = `
    ${UI.turnoActivoBanner()}
    <div class="page-header">
      <div>
        <h1 class="page-title">Mercadería</h1>
        <div class="page-subtitle">Inventario de consumibles y productos del centro</div>
      </div>
      ${App.esAdmin() ? '<button class="btn btn-primary" onclick="App.pedirPinAdmin(Pages._formMercaderia)">+ Nuevo producto</button>' : ''}
    </div>
    <div id="tabla-mercaderia"></div>

    <div style="margin-top:28px;">
      <div style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:12px;">Últimos movimientos</div>
      <div id="tabla-movimientos"></div>
    </div>
  `;

  await recargar();
  await recargarMovimientos();

  async function recargarMovimientos() {
    const movs = await DB.query(`
      SELECT mm.*, me.nombre as producto, me.unidad
      FROM mercaderia_movimientos mm
      JOIN mercaderia me ON me.id = mm.mercaderia_id
      ORDER BY mm.created_at DESC LIMIT 30
    `);
    document.getElementById('tabla-movimientos').innerHTML = UI.buildTable(
      ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo'],
      movs.map(m => `
        <tr>
          <td class="td-muted text-mono" style="font-size:11px;">${UI.formatDate(m.created_at)}</td>
          <td>${m.producto}</td>
          <td><span class="badge ${m.tipo==='entrada'?'badge-green':'badge-yellow'}">${m.tipo==='entrada'?'▲ Entrada':'▼ Salida'}</span></td>
          <td class="text-mono">${m.cantidad} ${m.unidad}</td>
          <td class="td-muted">${m.motivo || '—'}</td>
        </tr>`),
      'Sin movimientos registrados'
    );
  }

  // Modal movimiento (entrada o salida)
  Pages._movMercaderia = (id, tipo, nombre, unidad) => {
    const esSalida = tipo === 'salida';
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${esSalida ? '▼ Descontar' : '▲ Agregar'} — ${nombre}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Cantidad (${unidad})</label>
          <input type="number" id="mov-cantidad" value="1" min="0.1" step="0.1" style="font-size:20px;font-weight:600;text-align:center;" />
        </div>
        <div class="form-group">
          <label>Motivo</label>
          <input type="text" id="mov-motivo" placeholder="${esSalida ? 'Ej: Se abrió un paquete' : 'Ej: Compra semanal'}" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn ${esSalida?'btn-secondary':'btn-success'}" id="btn-guardar-mov">
          ${esSalida ? '▼ Descontar' : '▲ Agregar'}
        </button>
      </div>
    `);

    document.getElementById('btn-guardar-mov').onclick = async () => {
      const cant = parseFloat(document.getElementById('mov-cantidad').value);
      const motivo = document.getElementById('mov-motivo').value.trim() || null;
      if (!cant || cant <= 0) { UI.toast('Ingresá una cantidad válida', 'error'); return; }

      if (esSalida) {
        const m = await DB.get(`SELECT stock_actual FROM mercaderia WHERE id=?`, id);
        if (m.stock_actual < cant) {
          UI.toast(`Stock insuficiente (disponible: ${m.stock_actual})`, 'error'); return;
        }
        await DB.run(`UPDATE mercaderia SET stock_actual = stock_actual - ?, updated_at = datetime('now','localtime') WHERE id=?`, cant, id);
      } else {
        await DB.run(`UPDATE mercaderia SET stock_actual = stock_actual + ?, updated_at = datetime('now','localtime') WHERE id=?`, cant, id);
      }

      await DB.run(
        `INSERT INTO mercaderia_movimientos (mercaderia_id, tipo, cantidad, motivo, turno_id) VALUES (?,?,?,?,?)`,
        id, tipo, cant, motivo, turno?.id || null
      );

      UI.toast(`Stock actualizado`, 'success');
      UI.closeModal();
      await recargar();
      await recargarMovimientos();
    };
  };

  // Modal nuevo/editar producto
  function formMercaderiaModal(m = null) {
    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${m ? 'Editar producto' : 'Nuevo producto'}</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group" style="grid-column:span 2">
          <label>Nombre *</label>
          <input type="text" id="mc-nombre" value="${m?.nombre||''}" placeholder="Ej: Yerba mate, Azúcar, Saquitos de té..." />
        </div>
        <div class="form-group">
          <label>Unidad de medida</label>
          <select id="mc-unidad">
            ${['unidad','kg','g','l','ml','paquete','caja','bolsa'].map(u =>
              `<option value="${u}" ${m?.unidad===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Stock mínimo (alerta)</label>
          <input type="number" id="mc-minimo" value="${m?.stock_minimo??1}" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>Stock inicial</label>
          <input type="number" id="mc-stock" value="${m?.stock_actual??0}" min="0" step="0.1" ${m?'disabled':''} />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="mc-desc" value="${m?.descripcion||''}" placeholder="Opcional..." />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-mc">Guardar</button>
      </div>
    `);

    document.getElementById('btn-guardar-mc').onclick = async () => {
      const nombre = document.getElementById('mc-nombre').value.trim();
      if (!nombre) { UI.toast('El nombre es obligatorio', 'error'); return; }
      const unidad  = document.getElementById('mc-unidad').value;
      const minimo  = parseFloat(document.getElementById('mc-minimo').value) || 0;
      const desc    = document.getElementById('mc-desc').value.trim() || null;

      if (m) {
        await DB.run(
          `UPDATE mercaderia SET nombre=?,unidad=?,stock_minimo=?,descripcion=?,updated_at=datetime('now','localtime') WHERE id=?`,
          nombre, unidad, minimo, desc, m.id
        );
      } else {
        const stock = parseFloat(document.getElementById('mc-stock').value) || 0;
        await DB.run(
          `INSERT INTO mercaderia (nombre,unidad,stock_actual,stock_minimo,descripcion) VALUES (?,?,?,?,?)`,
          nombre, unidad, stock, minimo, desc
        );
        // Registrar movimiento inicial si hay stock
        if (stock > 0) {
          const newId = (await DB.get(`SELECT last_insert_rowid() as id`)).id;
          await DB.run(
            `INSERT INTO mercaderia_movimientos (mercaderia_id,tipo,cantidad,motivo) VALUES (?,?,?,?)`,
            newId, 'entrada', stock, 'Stock inicial'
          );
        }
      }
      UI.toast('Producto guardado', 'success');
      UI.closeModal();
      recargar();
      recargarMovimientos();
    };
  }

  Pages._formMercaderia = () => formMercaderiaModal();
  Pages._editMercaderia = async (id) => {
    const m = await DB.get(`SELECT * FROM mercaderia WHERE id=?`, id);
    formMercaderiaModal(m);
  };
  Pages._deleteMercaderia = (id, nombre) => {
    UI.confirm('Eliminar producto', `¿Eliminar "${nombre}" del inventario?`, async () => {
      await DB.run(`UPDATE mercaderia SET activo=0 WHERE id=?`, id);
      UI.toast('Producto eliminado', 'info');
      recargar();
    });
  };
};
