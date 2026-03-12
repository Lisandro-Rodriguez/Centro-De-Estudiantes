// ─── Lógica de morosos y cuatrimestres ────────────────────────────────────────

const Morosos = {

  // Devuelve el cuatrimestre activo: "2026-1" (mar-jul) o "2026-2" (ago-dic)
  cuatrimestreActual() {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1; // 1-12
    const anio = hoy.getFullYear();
    return mes >= 3 && mes <= 7 ? `${anio}-1` : `${anio}-2`;
  },

  // Fecha fin del cuatrimestre actual
  finCuatrimestre() {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    return mes >= 3 && mes <= 7 ? `${anio}-07-31` : `${anio}-12-31`;
  },

  // Verifica si un alumno está bloqueado HOY
  async estaBloqueado(alumnoId) {
    const a = await DB.get(`SELECT bloqueado_prestamo, bloqueado_hasta FROM alumnos WHERE id=?`, alumnoId);
    if (!a || !a.bloqueado_prestamo) return false;
    const hoy = new Date().toISOString().split('T')[0];
    // Si ya pasó el fin de cuatrimestre, desbloquear automáticamente
    if (a.bloqueado_hasta && hoy > a.bloqueado_hasta) {
      await DB.run(`UPDATE alumnos SET bloqueado_prestamo=0, bloqueado_hasta=NULL WHERE id=?`, alumnoId);
      return false;
    }
    return true;
  },

  // Cuenta incumplimientos del cuatrimestre actual para un alumno
  async contarIncumplimientos(alumnoId) {
    const cuatri = this.cuatrimestreActual();
    const r = await DB.get(
      `SELECT COUNT(*) as c FROM incumplimientos WHERE alumno_id=? AND cuatrimestre=?`,
      alumnoId, cuatri
    );
    return r?.c || 0;
  },

  // Registra un incumplimiento cuando un préstamo no fue devuelto en el día
  // Llamar al inicio del día o al detectar préstamos vencidos
  async registrarIncumplimiento(alumnoId, prestamoId) {
    const cuatri = this.cuatrimestreActual();
    const hoy = new Date().toISOString().split('T')[0];

    // Evitar duplicados: ya registrado hoy para este préstamo
    const existe = await DB.get(
      `SELECT id FROM incumplimientos WHERE prestamo_id=? AND alumno_id=?`,
      prestamoId, alumnoId
    );
    if (existe) return { nuevo: false };

    await DB.run(
      `INSERT INTO incumplimientos (alumno_id, prestamo_id, fecha, cuatrimestre) VALUES (?,?,?,?)`,
      alumnoId, prestamoId, hoy, cuatri
    );

    // Actualizar contador
    const total = await this.contarIncumplimientos(alumnoId);
    await DB.run(`UPDATE alumnos SET incumplimientos_count=? WHERE id=?`, total, alumnoId);

    // Al tercer incumplimiento → bloquear hasta fin de cuatrimestre
    if (total >= 3) {
      const hasta = this.finCuatrimestre();
      await DB.run(
        `UPDATE alumnos SET bloqueado_prestamo=1, bloqueado_hasta=? WHERE id=?`,
        hasta, alumnoId
      );
      return { nuevo: true, bloqueado: true, total };
    }

    return { nuevo: true, bloqueado: false, total };
  },

  // Detecta préstamos de días anteriores aún sin devolver y registra incumplimientos
  async detectarVencidos() {
    const hoy = new Date().toISOString().split('T')[0];
    const vencidos = await DB.query(`
      SELECT pr.*, a.nombre||' '||a.apellido as alumno_full
      FROM prestamos pr
      JOIN alumnos a ON a.id = pr.alumno_id
      WHERE pr.estado = 'prestado'
        AND pr.alumno_id IS NOT NULL
        AND date(pr.fecha_prestamo) < ?
    `, hoy);

    let nuevos = 0;
    for (const p of vencidos) {
      const r = await this.registrarIncumplimiento(p.alumno_id, p.id);
      if (r.nuevo) nuevos++;
    }
    return { vencidos: vencidos.length, nuevosIncumplimientos: nuevos };
  },

  // Devuelve lista de morosos actuales (préstamos no devueltos de días anteriores)
  async listaMorosos() {
    const hoy = new Date().toISOString().split('T')[0];
    return await DB.query(`
      SELECT pr.*,
             a.nombre, a.apellido, a.incumplimientos_count, a.bloqueado_prestamo, a.bloqueado_hasta,
             m.nombre as material_nombre,
             CAST(julianday('now') - julianday(pr.fecha_prestamo) AS INTEGER) as dias_vencido
      FROM prestamos pr
      JOIN alumnos a ON a.id = pr.alumno_id
      LEFT JOIN materiales m ON m.id = pr.material_id
      WHERE pr.estado = 'prestado'
        AND pr.alumno_id IS NOT NULL
        AND date(pr.fecha_prestamo) < ?
      ORDER BY pr.fecha_prestamo ASC
    `, hoy);
  }
};
