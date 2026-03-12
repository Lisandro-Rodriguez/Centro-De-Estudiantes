// ─── UI Helpers ───────────────────────────────────────────────────────────────
const UI = {
  toast(msg, type = 'info', duration = 3000) {
    const icons = { success: '✓', error: '✕', info: '◈' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  modal(html, onClose) {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');
    box.innerHTML = html;
    overlay.style.display = 'flex';

    const close = () => {
      overlay.style.display = 'none';
      box.innerHTML = '';
      if (onClose) onClose();
    };

    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    const closeBtn = box.querySelector('.modal-close');
    if (closeBtn) closeBtn.onclick = close;

    return close;
  },

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-box').innerHTML = '';
  },

  confirm(title, msg, onConfirm) {
    const close = this.modal(`
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close">✕</button>
      </div>
      <p style="color:var(--text-secondary);margin-bottom:24px;">${msg}</p>
      <div class="form-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
        <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
      </div>
    `);
    document.getElementById('confirm-cancel').onclick = close;
    document.getElementById('confirm-ok').onclick = () => { close(); onConfirm(); };
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatTime(timeStr) {
    if (!timeStr) return '—';
    return timeStr.slice(0, 5);
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  nowTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  },

  emptyState(icon, text) {
    return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-text">${text}</div></div>`;
  },

  turnoActivoBanner() {
    const t = App.getTurnoActivo();
    if (!t) return '';
    return `
      <div class="turno-activo-bar">
        <div class="turno-activo-info">
          <div class="pulse-dot"></div>
          <strong>Turno activo</strong> — Inició ${UI.formatTime(t.hora_inicio)} · ${t.personal_names || 'Sin personal asignado'}
        </div>
        <button class="btn btn-sm btn-danger" onclick="Router.navigate('turno')">Ver turno</button>
      </div>
    `;
  },

  buildTable(headers, rows, emptyText = 'Sin registros') {
    if (!rows || rows.length === 0) return this.emptyState('⊟', emptyText);
    return `
      <div class="table-wrapper">
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    `;
  }
};
