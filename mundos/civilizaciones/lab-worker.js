// Web Worker del laboratorio: corre mundos completos sin congelar la página y avisa el progreso.
import { configLote, correrMundo, estadisticas } from './laboratorio.js';

self.onmessage = (ev) => {
  const { modo, n, base, maxAños, semilla } = ev.data, res = [];
  for (let i = 0; i < n; i++) {
    try { res.push(correrMundo(configLote(modo, i, base, semilla), maxAños)); }
    catch (e) { self.postMessage({ error: String(e?.message || e) }); return; }
    self.postMessage({ progreso: (i + 1) / n, ultimo: res[res.length - 1] });
  }
  self.postMessage({ listo: true, stats: estadisticas(res), res });
};
