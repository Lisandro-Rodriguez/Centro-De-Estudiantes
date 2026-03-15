// ─── DB Helpers ───────────────────────────────────────────────────────────────
const DB = {
  async query(sql, ...params) {
    const res = await window.api.query(sql, params);
    if (!res.ok) { console.error('DB query error:', res.error); return []; }
    return res.data || [];
  },
  async get(sql, ...params) {
    const res = await window.api.get(sql, params);
    if (!res.ok) { console.error('DB get error:', res.error); return null; }
    return res.data || null;
  },
  async run(sql, ...params) {
    const res = await window.api.run(sql, params);
    if (!res.ok) { console.error('DB run error:', res.error); throw new Error(res.error); }
    return res;
  }
};