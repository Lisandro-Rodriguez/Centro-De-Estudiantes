// ─── Sistema automático: estados de turno + recordatorios de agenda ───────────
const Automatico = {

  _intervaloEstados:    null,
  _intervaloAgenda:     null,
  _turnosNotificados:   new Set(),
  _estadosYaProcesados: new Set(),

  init() {
    this._intervaloEstados = setInterval(() => this.revisarEstados(), 60_000);
    this._intervaloAgenda  = setInterval(() => this.revisarAgenda(),  60_000);
    this.revisarEstados();
    this.revisarAgenda();
  },

  detener() {
    clearInterval(this._intervaloEstados);
    clearInterval(this._intervaloAgenda);
  },

  // ── Estados automáticos ─────────────────────────────────────────────────────
  async revisarEstados() {
    const turno = App.getTurnoActivo();
    if (!turno) return;

    // FIX: calcular diff usando la fecha+hora completa del turno, no solo
    // minutos del reloj. Esto evita valores negativos o erróneos si el turno
    // empezó en otro momento del día o cerca de medianoche.
    const ahora     = new Date();
    const fechaBase = turno.fecha || UI.today();
    const inicioFull = new Date(`${fechaBase}T${String(turno.hora_inicio).slice(0,5)}:00`);

    // Si la fecha no parsea correctamente, salir sin hacer nada
    if (isNaN(inicioFull.getTime())) return;

    const diffMs  = ahora.getTime() - inicioFull.getTime();
    const diff    = Math.floor(diffMs / 60_000); // minutos transcurridos

    // Menos de 10 minutos desde el inicio → no hacer nada todavía
    if (diff < 10) return;

    const personal = await DB.query(`
      SELECT * FROM turno_personal
      WHERE turno_id = ? AND estado IN ('presente','demorado')
        AND (hora_entrada IS NULL OR hora_entrada = '')
    `, turno.id);

    for (const tp of personal) {
      if (diff >= 30 && tp.estado !== 'ausente') {
        const clave = `${tp.id}-ausente`;
        if (this._estadosYaProcesados.has(clave)) continue;
        await DB.run(`UPDATE turno_personal SET estado='ausente' WHERE id=?`, tp.id);
        this._estadosYaProcesados.add(clave);
        UI.toast(`⏰ ${tp.nombre || ''} marcado como Ausente (30 min sin registrar entrada)`, 'warning');
        if (document.querySelector('[data-page="turno"].active')) Pages.turno();

      } else if (diff >= 15 && tp.estado === 'presente') {
        const clave = `${tp.id}-demorado`;
        if (this._estadosYaProcesados.has(clave)) continue;
        await DB.run(`UPDATE turno_personal SET estado='demorado' WHERE id=?`, tp.id);
        this._estadosYaProcesados.add(clave);
        UI.toast(`⏳ ${tp.nombre || ''} marcado como Demorado (15 min sin registrar entrada)`, 'warning');
        if (document.querySelector('[data-page="turno"].active')) Pages.turno();
      }
    }
  },

  // ── Recordatorios de agenda ─────────────────────────────────────────────────
  async revisarAgenda() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default') await Notification.requestPermission();

    const ahora    = new Date();
    const today    = UI.today();
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();

    const proximos = await DB.query(`
      SELECT ag.*,
             p1.nombre || ' ' || p1.apellido AS nombre_p1,
             p2.nombre || ' ' || p2.apellido AS nombre_p2
      FROM agenda ag
      LEFT JOIN personal p1 ON p1.id = ag.personal_id
      LEFT JOIN personal p2 ON p2.id = ag.personal_id2
      WHERE ag.fecha = ?
    `, today);

    for (const turnoAg of proximos) {
      const [hT, mT] = String(turnoAg.hora_inicio).split(':').map(Number);
      const turnoMin  = hT * 60 + mT;
      const minFaltan = turnoMin - ahoraMin;

      if (minFaltan >= 14 && minFaltan <= 16 && !this._turnosNotificados.has(turnoAg.id)) {
        this._turnosNotificados.add(turnoAg.id);
        this._notificar(
          '🕐 Turno en 15 minutos',
          `${turnoAg.nombre_p1 || '—'}${turnoAg.nombre_p2 ? ' y ' + turnoAg.nombre_p2 : ''} · ${UI.formatTime(turnoAg.hora_inicio)} – ${UI.formatTime(turnoAg.hora_fin)}`
        );
      }

      if (minFaltan >= -1 && minFaltan <= 1 && !this._turnosNotificados.has(`inicio-${turnoAg.id}`)) {
        this._turnosNotificados.add(`inicio-${turnoAg.id}`);
        this._notificar(
          '▶ Turno comenzando ahora',
          `${turnoAg.nombre_p1 || '—'}${turnoAg.nombre_p2 ? ' y ' + turnoAg.nombre_p2 : ''} · Hora de inicio: ${UI.formatTime(turnoAg.hora_inicio)}`
        );
      }
    }
  },

  _notificar(titulo, cuerpo) {
    try {
      const n = new Notification(titulo, { body: cuerpo, icon: null, silent: false });
      n.onclick = () => { window.focus(); Router.navigate('turno'); };
    } catch (e) {
      // Silencioso si falla
    }
  }
};
