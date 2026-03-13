// ─── Sistema de temas y personalización ───────────────────────────────────────
const Temas = {

  TEMAS: [
    { id: 'oscuro',  nombre: '🌙 Oscuro',           desc: 'El clásico oscuro' },
    { id: 'claro',   nombre: '☀️ Claro',             desc: 'Fondo blanco, ideal para el día' },
    { id: 'azul',    nombre: '🎓 Azul universitario', desc: 'Azul profundo, estilo académico' },
    { id: 'violeta', nombre: '🔮 Violeta noche',      desc: 'Violeta intenso para la noche' },
    { id: 'verde',   nombre: '🧉 Verde mate',         desc: 'Verde oscuro, sabor argentino' },
  ],

  async init() {
    // Cargar tema guardado
    const tema = await window.api.getConfig('tema') || 'oscuro';
    this.aplicar(tema);
    // Cargar logo guardado
    const logo = await window.api.getConfig('logo_base64') || '';
    this.aplicarLogo(logo);
  },

  aplicar(temaId) {
    const html = document.documentElement;
    if (temaId === 'oscuro') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', temaId);
    }
  },

  aplicarLogo(base64) {
    const logoEl = document.getElementById('sidebar-logo-content');
    if (!logoEl) return;
    if (base64) {
      logoEl.innerHTML = `<img src="${base64}" alt="Logo" />`;
    } else {
      logoEl.innerHTML = `◈`;
      logoEl.style.color = 'var(--accent)';
    }
    // También en titlebar
    const tbIcon = document.querySelector('.titlebar-icon');
    if (tbIcon) {
      if (base64) {
        tbIcon.innerHTML = `<img src="${base64}" style="width:18px;height:18px;object-fit:cover;border-radius:3px;" />`;
      } else {
        tbIcon.innerHTML = `◈`;
      }
    }
  },

  async guardarTema(temaId) {
    await window.api.setConfig({ key: 'tema', value: temaId });
    this.aplicar(temaId);
    UI.toast('Tema aplicado', 'success');
  },

  async subirLogo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        await window.api.setConfig({ key: 'logo_base64', value: base64 });
        this.aplicarLogo(base64);
        UI.toast('Logo actualizado', 'success');
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  },

  async quitarLogo() {
    await window.api.setConfig({ key: 'logo_base64', value: '' });
    this.aplicarLogo('');
    UI.toast('Logo eliminado', 'info');
  },

  // Modal de selección de tema + logo
  mostrarPanel() {
    const temaActual = document.documentElement.getAttribute('data-theme') || 'oscuro';

    UI.modal(`
      <div class="modal-header">
        <h3 class="modal-title">🎨 Apariencia</h3>
        <button class="modal-close">✕</button>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Tema</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${this.TEMAS.map(t => `
            <button onclick="Temas._seleccionarTema('${t.id}')"
              style="padding:12px;text-align:left;background:${t.id===temaActual?'var(--accent-dim)':'var(--bg-elevated)'};
                     border:1.5px solid ${t.id===temaActual?'var(--accent)':'var(--border)'};
                     border-radius:var(--radius);cursor:pointer;transition:all .15s;"
              onmouseover="this.style.borderColor='var(--accent)'"
              onmouseout="this.style.borderColor='${t.id===temaActual?'var(--accent)':'var(--border)'}'">
              <div style="font-size:14px;margin-bottom:2px;">${t.nombre}</div>
              <div style="font-size:11px;color:var(--text-muted);">${t.desc}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;">Logo del centro</div>
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);">
          <div style="width:44px;height:44px;border-radius:var(--radius);background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;" id="logo-preview-modal">
            ${document.getElementById('sidebar-logo-content')?.innerHTML || '◈'}
          </div>
          <div style="flex:1;">
            <div style="font-size:13px;margin-bottom:6px;">Imagen PNG, JPG o SVG</div>
            <div style="font-size:11px;color:var(--text-muted);">Se muestra en el sidebar y la barra superior</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <label style="cursor:pointer;">
              <input type="file" id="logo-input" accept="image/*" style="display:none;" onchange="Temas._onLogoFile(this)" />
              <span class="btn btn-sm btn-secondary" style="display:block;">📁 Subir</span>
            </label>
            <button class="btn btn-sm btn-secondary" onclick="Temas.quitarLogo()">✕ Quitar</button>
          </div>
        </div>
      </div>
    `);
  },

  _seleccionarTema(id) {
    this.guardarTema(id);
    // Update button states in modal
    document.querySelectorAll('[onclick^="Temas._seleccionarTema"]').forEach(btn => {
      const btnId = btn.getAttribute('onclick').match(/'(\w+)'/)[1];
      btn.style.background    = btnId === id ? 'var(--accent-dim)' : 'var(--bg-elevated)';
      btn.style.borderColor   = btnId === id ? 'var(--accent)'     : 'var(--border)';
    });
  },

  _onLogoFile(input) {
    if (input.files?.[0]) {
      this.subirLogo(input.files[0]).then(b64 => {
        const prev = document.getElementById('logo-preview-modal');
        if (prev) prev.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:cover;" />`;
      });
    }
  }
};
