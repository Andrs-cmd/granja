// =====================================================================
// Civilizaciones — laboratorio (puro: sin three ni DOM).
// 1) analisis(E): desglosa la fuerza de cada civilización ahora mismo y explica quién va ganando y por qué.
// 2) lote: corre muchos mundos rápidos (en un Web Worker) y saca estadísticas de qué arquetipos,
//    rasgos especiales, doctrinas y rasgos ganan más, con una explicación en lenguaje simple.
// =====================================================================
import { crearMundo, paso, mods, rv, tecMil, guerrasDe, PRESETS, ESPECIALES, DOCTRINAS, RASGOS, CLAVES } from './sim.js';

const NOMBRE = Object.fromEntries(RASGOS.map(([k, n]) => [k, n]));
const x1 = (v) => `×${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })}`;

// ---------------------------------------------------------------- análisis del mundo actual
export const COMPONENTES = [
  ['poblacion', '👥 Población', 'Cuánta gente: de ahí salen soldados y saber.'],
  ['tecnica', '⚙️ Técnica', 'Su era y avance: cada era vale ×1,5 en batalla.'],
  ['ejercito', '🛡️ Movilización', 'Qué parte de su gente pone en armas (agresividad, disciplina, especiales).'],
  ['calidad', '🎖️ Calidad de tropa', 'Disciplina, ímpetu, cohesión, fe y especiales de combate.'],
  ['economia', '💰 Economía', 'Comercio, rutas y puertos: más saber y comida.'],
  ['unidad', '🤝 Unidad', 'Cohesión y lealtad: menos cismas, más defensa.'],
];
export function analisis(E) {
  const vivas = E.civs.filter((c) => c.vivo); if (!vivas.length) return null;
  const filas = vivas.map((c) => {
    const m = mods(c), socios = Object.values(E.rel).filter((r) => r.comercio && (r.a === c.id || r.b === c.id)).length;
    const comp = {
      poblacion: c.pob, tecnica: tecMil(c),
      ejercito: (0.02 + rv(c, 'agresividad') / 100 * 0.06 + rv(c, 'disciplina') / 100 * 0.01) * m.ejercito * (m.mercenarios ? 1 + rv(c, 'comercio') / 250 : 1),
      calidad: (0.7 + rv(c, 'agresividad') / 300 + rv(c, 'disciplina') / 250 + rv(c, 'cohesion') / 500 + rv(c, 'fe') / 1000) * m.ataque,
      economia: 1 + socios * 0.15 * (0.4 + rv(c, 'comercio') / 100) * m.comercioTec + (c._nav ? 0.15 : 0),
      unidad: (rv(c, 'cohesion') + rv(c, 'lealtad')) / 2,
    };
    const militar = comp.poblacion * comp.tecnica * comp.ejercito * comp.calidad;
    const enArmas = E.ejercitos.filter((e) => e.civ === c.id).reduce((s, e) => s + e.fuerza, 0);
    return { c, comp, militar, enArmas, guerras: guerrasDe(E, c.id).length };
  });
  const max = {}; for (const [k] of COMPONENTES) max[k] = Math.max(...filas.map((f) => f.comp[k]), 1e-9);
  const prom = {}; for (const [k] of COMPONENTES) prom[k] = filas.reduce((s, f) => s + f.comp[k], 0) / filas.length;
  const maxMil = Math.max(...filas.map((f) => f.militar), 1);
  for (const f of filas) {
    f.barras = Object.fromEntries(COMPONENTES.map(([k]) => [k, f.comp[k] / max[k] * 100]));
    f.rel = Object.fromEntries(COMPONENTES.map(([k]) => [k, f.comp[k] / Math.max(1e-9, prom[k])]));
    f.militarPct = f.militar / maxMil * 100;
    const orden = COMPONENTES.map(([k, n]) => [k, n, f.rel[k]]).sort((a, b) => b[2] - a[2]);
    f.fuerte = orden.slice(0, 2).filter((o) => o[2] > 1.05); f.debil = orden.slice(-2).filter((o) => o[2] < 0.95);
  }
  filas.sort((a, b) => b.militar - a.militar);
  const lider = filas[0], seg = filas[1];
  let texto = `${lider.c.emblema} ${lider.c.nombre} es la potencia militar del momento`;
  if (lider.fuerte.length) texto += `, sobre todo por ${lider.fuerte.map((o) => `${o[1].replace(/^\S+ /, '').toLowerCase()} (${x1(o[2])} del promedio)`).join(' y ')}`;
  texto += '.';
  if (seg) { const r = lider.militar / Math.max(1, seg.militar); texto += r < 1.3 ? ` ${seg.c.nombre} le pisa los talones (${x1(r)}).` : ` Le saca ${x1(r)} a ${seg.c.nombre}.`; }
  // rasgos que más pesan ahora: los del líder que más se apartan del resto
  const difs = CLAVES.map((k) => [k, rv(lider.c, k) - filas.slice(1).reduce((s, f) => s + rv(f.c, k), 0) / Math.max(1, filas.length - 1)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  if (filas.length > 1) texto += ` Lo que más la distingue: ${difs.map(([k, d]) => `${NOMBRE[k].toLowerCase()} ${d > 0 ? '+' : ''}${Math.round(d)}`).join(', ')}.`;
  const doc = DOCTRINAS[lider.c.doctrina]; if (doc) texto += ` Su doctrina: ${doc.e} ${doc.n} — ${doc.d}`;
  return { filas, texto };
}

// ---------------------------------------------------------------- lotes: muchos mundos rápidos
// modo 'actual': las mismas facciones del mundo con otras semillas; modo 'arquetipos': mezcla al azar de arquetipos
export function configLote(modo, i, base = null, semilla0 = 1) {
  const s = (semilla0 * 7919 + i * 104729) >>> 0;
  if (modo === 'actual' && base) return { ...base, semilla: s, civs: base.civs.map((c) => ({ ...c, r: { ...c.r } })) };
  const ks = Object.keys(PRESETS), elegidos = []; let x = s;
  const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  const k = 4; while (elegidos.length < k) { const p = ks[Math.floor(rnd() * ks.length)]; if (!elegidos.includes(p)) elegidos.push(p); }
  return { semilla: s, tipo: ['continente', 'archipielago', 'pangea'][Math.floor(rnd() * 3)], velo: 200 + Math.floor(rnd() * 7) * 100, civs: elegidos.map((p) => ({ ...PRESETS[p], r: { ...PRESETS[p].r }, preset: p })) };
}
export function correrMundo(cfg, maxAños = 2200) {
  const E = crearMundo(cfg);
  while (!E.fin && E.año < maxAños) paso(E);
  const g = E.fin ? E.civs[E.fin.ganador] : E.civs.filter((c) => c.vivo).sort((a, b) => b.poder - a.poder)[0];
  // los fundadores (no las facciones que nacieron de cismas) son los que se comparan
  const fundadores = E.civs.slice(0, cfg.civs.length), raiz = (c) => { while (c && c.padre != null) c = E.civs[c.padre]; return c; };
  const gr = raiz(g);
  return {
    año: E.año, tipo: E.fin?.tipo || 'abierto', mapa: cfg.tipo, velo: cfg.velo, ganador: gr ? gr.id : -1, ganadorNombre: g?.nombre,
    civs: fundadores.map((c) => ({ id: c.id, nombre: c.nombre, preset: c.arquetipo, r0: c.r0, esp: c.esp, doctrina: c.doctrina, vivo: c.vivo, maxPob: Math.round(c.stats.maxPob), conquistas: c.stats.conquistas, batallas: c.stats.batallasG, gano: gr && gr.id === c.id })),
  };
}
export function estadisticas(res) {
  const por = (clave) => { const t = {}; for (const r of res) for (const c of r.civs) { const ks = clave(c); for (const k of [].concat(ks)) { if (k == null) continue; t[k] ||= { n: 0, g: 0, pob: 0 }; t[k].n++; if (c.gano) t[k].g++; t[k].pob += c.maxPob; } } return Object.entries(t).map(([k, v]) => ({ k, n: v.n, g: v.g, tasa: v.g / v.n, pob: v.pob / v.n })).sort((a, b) => b.tasa - a.tasa || b.n - a.n); };
  const arquetipos = por((c) => c.preset || c.nombre), especiales = por((c) => c.esp), doctrinas = por((c) => c.doctrina);
  // rasgos: promedio de los ganadores contra el promedio de todos
  const todos = res.flatMap((r) => r.civs), gan = todos.filter((c) => c.gano);
  const rasgos = CLAVES.map((k) => { const pg = gan.reduce((s, c) => s + (c.r0[k] ?? 50), 0) / Math.max(1, gan.length), pt = todos.reduce((s, c) => s + (c.r0[k] ?? 50), 0) / Math.max(1, todos.length); return { k, n: NOMBRE[k], dif: pg - pt, g: pg }; }).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  const base = 1 / Math.max(1, todos.length / Math.max(1, res.length)); // tasa esperada si todo fuera azar
  const tipos = {}; for (const r of res) tipos[r.tipo] = (tipos[r.tipo] || 0) + 1;
  const años = res.reduce((s, r) => s + r.año, 0) / Math.max(1, res.length);
  // explicación sencilla
  const frases = [];
  const top = arquetipos.filter((a) => a.n >= 2)[0]; if (top) frases.push(`El arquetipo que más gana es ${PRESETS[top.k]?.t || top.k}: ${Math.round(top.tasa * 100)} % de sus partidas (si todo fuera azar sería ${Math.round(base * 100)} %).`);
  const sube = rasgos.filter((r) => r.dif > 4).slice(0, 3), baja = rasgos.filter((r) => r.dif < -4).slice(0, 2);
  if (sube.length) frases.push(`Los ganadores tenían más ${sube.map((r) => `${r.n.toLowerCase()} (+${Math.round(r.dif)})`).join(', ')} que el promedio.`);
  if (baja.length) frases.push(`Y menos ${baja.map((r) => `${r.n.toLowerCase()} (${Math.round(r.dif)})`).join(', ')}.`);
  const de = especiales.filter((e) => e.n >= 3)[0]; if (de) frases.push(`El rasgo especial más ganador: ${ESPECIALES[de.k]?.e || ''} ${ESPECIALES[de.k]?.n || de.k} (${Math.round(de.tasa * 100)} %).`);
  const dd = doctrinas.filter((e) => e.n >= 3)[0]; if (dd) frases.push(`La doctrina más ganadora: ${DOCTRINAS[dd.k]?.e || ''} ${DOCTRINAS[dd.k]?.n || dd.k} (${Math.round(dd.tasa * 100)} %).`);
  frases.push(`Las partidas duraron en promedio ${Math.round(años)} años.`);
  return { n: res.length, arquetipos, especiales, doctrinas, rasgos, tipos, años, base, frases };
}
