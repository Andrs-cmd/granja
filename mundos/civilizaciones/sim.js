// =====================================================================
// Civilizaciones — simulación PURA (sin three ni DOM) y determinista con semilla. Versión 2.
// Un paso = un año. El estado E es JSON salvo E.mapa (se regenera desde la semilla al cargar) y las
// claves que empiezan con "_" (cachés que se recalculan).
// Ideas centrales:
//  · Cada pueblo nace con rasgos (r0, con presupuesto), 2 rasgos especiales y una doctrina de guerra.
//    Los rasgos actuales (r) derivan hacia su identidad + lo que viven (guerras, plagas, prosperidad, clima).
//  · La guerra se resuelve aquí, por rondas (una por año): tropas, técnica, moral, doctrina, terreno,
//    unidades (piedra-papel-tijera), logística y general. Cada batalla deja un «parte» que explica por qué.
//  · La escena solo mira E: ejércitos (con su composición), combates en curso, sitios y efectos.
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';
import { RASGOS, CLAVES, ESPECIALES, DOCTRINAS, VENTAJA, UNIDADES, doctrinaDe, nombreUnidad, ajustarPresupuesto, PRESETS, EMBLEMAS, COLORES } from './facciones.js';
import { PODERES, ENERGIA_MAX, ENERGIA_AÑO } from './poderes.js';
export { RASGOS, CLAVES, ESPECIALES, DOCTRINAS, PRESETS, EMBLEMAS, COLORES, PODERES, nombreUnidad };

export const TAM = 1.1, PASO = Math.sqrt(3) * TAM, RMAPA = 43, MAX_CIVS = 8;
export const B = { MAR: 0, COSTA: 1, PLAYA: 2, PRADERA: 3, BOSQUE: 4, SELVA: 5, DESIERTO: 6, TUNDRA: 7, MONTANA: 8, NIEVE: 9 };
export const BIOMAS = [
  { n: 'Mar', c: '#1d4f7a' }, { n: 'Costa', c: '#3f8fb0' }, { n: 'Playa', c: '#e3d29a' }, { n: 'Pradera', c: '#8cb85a' }, { n: 'Bosque', c: '#3f7a3a' },
  { n: 'Selva', c: '#2d6b35' }, { n: 'Desierto', c: '#dcb56a' }, { n: 'Tundra', c: '#9fac92' }, { n: 'Montaña', c: '#8a8378' }, { n: 'Nieve', c: '#eef2f5' },
];
const COMIDA = [0, 1.0, 1.2, 3, 2, 2.2, 0.5, 0.8, 0.6, 0.15];
const esAgua = (b) => b <= 1;
export const ERAS = [
  { n: 'Edad de Piedra', tec: 0, e: '🪨' }, { n: 'Edad del Bronce', tec: 150, e: '🔔' }, { n: 'Edad del Hierro', tec: 450, e: '⚒️' },
  { n: 'Edad Media', tec: 1000, e: '🏰' }, { n: 'Era de la Pólvora', tec: 2000, e: '💥' }, { n: 'Era Industrial', tec: 3600, e: '🏭' }, { n: 'Era Moderna', tec: 6000, e: '🚀' },
];
const DESC = [['la agricultura', 30], ['la cerámica', 70], ['la rueda', 110], ['la escritura', 220], ['la navegación', 300], ['los acueductos', 600], ['la filosofía', 750],
  ['la moneda', 850], ['los castillos', 1250], ['la astronomía', 1500], ['la imprenta', 1750], ['la brújula', 2150], ['los cañones', 2400], ['la banca', 2700],
  ['el método científico', 3100], ['la máquina de vapor', 3800], ['el ferrocarril', 4300], ['la electricidad', 5000], ['la aviación', 6500], ['la computación', 8000], ['la energía atómica', 9500]];
export const NIVELES = ['Aldea', 'Pueblo', 'Ciudad', 'Metrópolis'];
const nivelDe = (p) => (p < 1000 ? 0 : p < 4000 ? 1 : p < 11000 ? 2 : 3);
const COLORES_EXTRA = ['#d35d9b', '#16a085', '#b9770e', '#5d6d7e', '#a04000', '#1abc9c', '#6c3483', '#cacfd2', '#e74c3c', '#48c9b0'];

const LENGUAS = [
  ['ka', 'ru', 'tor', 'mak', 'zan', 'ur', 'gor', 'ash', 'dra', 'kel'], ['el', 'ya', 'mir', 'sil', 'an', 'tha', 'lo', 'ri', 'wen', 'li'],
  ['al', 'sa', 'ham', 'dar', 'ib', 'kha', 'mun', 'zar', 'qa', 'hir'], ['bo', 'ra', 'ven', 'ul', 'sten', 'vi', 'grim', 'hal', 'rik', 'ny'],
  ['xi', 'pa', 'tla', 'man', 'chi', 'co', 'yu', 'na', 'huac', 'te'], ['ae', 'lu', 'cor', 'tes', 'in', 'ma', 'ri', 'sa', 'ven', 'to'],
  ['dun', 'mor', 'ba', 'ek', 'tar', 'on', 'gal', 'u', 'rhan', 'ok'], ['shi', 'ka', 'ro', 'mi', 'zu', 'ten', 'ha', 'no', 'ki', 'ra'],
  ['zz', 'ix', 'kri', 'tek', 'vra', 'sh', 'ik', 'zor', 'nax', 'ul'], ['mor', 'va', 'ne', 'lis', 'dra', 'cul', 'ae', 'sang', 'vey', 'ro'],
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function palabra(R, lengua, min = 2, max = 3) { const L = LENGUAS[lengua % LENGUAS.length], n = min + Math.floor(R() * (max - min + 1)); let s = ''; for (let i = 0; i < n; i++) s += L[Math.floor(R() * L.length)]; return cap(s.slice(0, 11)); }
const elige = (R, l) => l[Math.floor(R() * l.length)];
const cl = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const hash = (a, b) => (Math.imul(a ^ 0x5bd1e995, 2654435761) ^ Math.imul(b + 0x27d4eb2d, 40503)) >>> 0;
const num = (n) => Math.round(n).toLocaleString('es-CO');
const pct = (x) => `${Math.round(x * 100)} %`;
const los = (n) => `${n === 'artillería' ? 'la' : n.endsWith('as') ? 'las' : 'los'} ${n}`; // artículo para el nombre de una unidad

// ---------------------------------------------------------------- mapa (hexágonos con filas desplazadas, punta hacia ±z)
export function generarMapa(semilla, tipo = 'continente', mods = {}) {
  const n1 = ruido2D(semilla * 7 + 1), n2 = ruido2D(semilla * 7 + 2), n3 = ruido2D(semilla * 7 + 3), nt = ruido2D(semilla * 7 + 4), nh = ruido2D(semilla * 7 + 5);
  const filas = Math.ceil((RMAPA * 2) / (1.5 * TAM)) + 3, cols = Math.ceil((RMAPA * 2) / PASO) + 3;
  const grid = new Int32Array(filas * cols).fill(-1), x = [], z = [], fr = [], cc = [];
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) {
    const px = (c - (cols - 1) / 2 + (r & 1 ? 0.25 : -0.25)) * PASO, pz = (r - (filas - 1) / 2) * 1.5 * TAM;
    if (Math.hypot(px, pz) > RMAPA) continue;
    grid[r * cols + c] = x.length; x.push(px); z.push(pz); fr.push(r); cc.push(c);
  }
  const n = x.length, vec = [];
  for (let i = 0; i < n; i++) {
    const r = fr[i], c = cc[i], o = r & 1, l = [];
    for (const [dc, dr] of [[1, 0], [-1, 0], [o ? 0 : -1, -1], [o ? 1 : 0, -1], [o ? 0 : -1, 1], [o ? 1 : 0, 1]]) {
      const rr = r + dr, c2 = c + dc; if (rr < 0 || rr >= filas || c2 < 0 || c2 >= cols) continue; const j = grid[rr * cols + c2]; if (j >= 0) l.push(j);
    }
    vec.push(l);
  }
  const f = tipo === 'archipielago' ? 10 : 17, caida = { continente: 0.42, archipielago: 0.2, pangea: 0.55 }[tipo] ?? 0.42;
  const e = x.map((px, i) => { const pz = z[i], d = Math.hypot(px, pz) / RMAPA; return n1(px / f + 50, pz / f + 50) * 0.55 + n2(px / (f * 0.45) + 20, pz / (f * 0.45)) * 0.3 + n3(px / 4 + 9, pz / 4) * 0.15 - d * d * caida; });
  const orden = [...e].sort((a, b) => a - b), fracAgua = { continente: 0.4, archipielago: 0.6, pangea: 0.27 }[tipo] ?? 0.4;
  const mar = orden[Math.floor(n * fracAgua)], emax = orden[n - 1], emin = orden[0];
  const a = e.map((v) => (v >= mar ? (v - mar) / (emax - mar) : -(mar - v) / (mar - emin)));
  const bioma = new Array(n), temp = new Array(n), rio = new Array(n).fill(0), costaAdj = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (a[i] >= 0) for (const j of vec[i]) if (a[j] < 0) { costaAdj[i] = 1; break; }
  for (let i = 0; i < n; i++) {
    const ai = Math.max(0, a[i]);
    temp[i] = cl(0.52 + (z[i] / RMAPA) * 0.5 + (nt(x[i] / 14, z[i] / 14) - 0.5) * 0.35 - ai * 0.35, 0, 1); // norte (−z) frío, sur cálido
    const hum = nh(x[i] / 12 + 7, z[i] / 12 + 3) + (costaAdj[i] ? 0.12 : 0);
    if (a[i] < 0) { bioma[i] = a[i] > -0.16 || vec[i].some((j) => a[j] >= 0) ? B.COSTA : B.MAR; continue; }
    if (ai > 0.74) bioma[i] = ai > 0.9 || temp[i] < 0.3 ? B.NIEVE : B.MONTANA;
    else if (temp[i] < 0.1) bioma[i] = B.NIEVE;
    else if (temp[i] < 0.24) bioma[i] = B.TUNDRA;
    else if (temp[i] > 0.64 && hum < 0.6) bioma[i] = B.DESIERTO;
    else if (ai < 0.05 && costaAdj[i]) bioma[i] = B.PLAYA;
    else if (hum > 0.52) bioma[i] = temp[i] > 0.6 ? B.SELVA : B.BOSQUE;
    else bioma[i] = B.PRADERA;
  }
  const Rr = azar(semilla ^ 0xa5a5), fuentes = [];
  for (let i = 0; i < n; i++) if (a[i] > 0.55 && a[i] < 0.85 && Rr() < 0.05) fuentes.push(i);
  for (const s of fuentes.slice(0, 12)) {
    let i = s;
    for (let k = 0; k < 80; k++) { let mj = -1; for (const j of vec[i]) if (e[j] < e[i] && (mj < 0 || e[j] < e[mj])) mj = j; if (mj < 0) break; if (a[mj] < 0) break; rio[mj] = 1; i = mj; }
  }
  const M = { n, x, z, a, h: null, bioma, temp, rio, costaAdj, vec, grid, filas, cols };
  // cicatrices de poderes (meteoritos, volcanes, islas…): {celda: bioma} o {celda: [bioma, río]}
  for (const k in mods) { const v = mods[k]; bioma[+k] = Array.isArray(v) ? v[0] : v; if (Array.isArray(v)) rio[+k] = v[1]; }
  recalcularMapa(M);
  return M;
}
// alturas y costas (se rehacen cuando un poder cambia el terreno)
function recalcularMapa(M) {
  const { n, a, bioma, vec } = M;
  for (let i = 0; i < n; i++) { M.costaAdj[i] = 0; if (!esAgua(bioma[i])) for (const j of vec[i]) if (esAgua(bioma[j])) { M.costaAdj[i] = 1; break; } }
  M.h = a.map((v, i) => (bioma[i] === B.MAR ? 0.1 : bioma[i] === B.COSTA ? 0.2 : 0.45 + Math.max(0, v) * 1.4 + Math.max(0, v - 0.68) * 9 + (bioma[i] === B.MONTANA && v < 0.7 ? 1.6 : 0)));
}
export const dist = (M, i, j) => { const dx = M.x[i] - M.x[j], dz = M.z[i] - M.z[j]; return Math.sqrt(dx * dx + dz * dz) / PASO; };
export function celdaCercana(M, px, pz) {
  const r = Math.round(pz / (1.5 * TAM) + (M.filas - 1) / 2); let mi = -1, md = 1e9;
  for (let rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= M.filas) continue; const c = Math.round(px / PASO + (M.cols - 1) / 2 - (rr & 1 ? 0.25 : -0.25));
    for (let cc = c - 1; cc <= c + 1; cc++) { if (cc < 0 || cc >= M.cols) continue; const i = M.grid[rr * M.cols + cc]; if (i < 0) continue; const d = (M.x[i] - px) ** 2 + (M.z[i] - pz) ** 2; if (d < md) { md = d; mi = i; } }
  }
  return mi;
}
function celdasEn(M, celda, radio) { const l = []; for (let i = 0; i < M.n; i++) if (dist(M, i, celda) <= radio) l.push(i); return l; }

// ---------------------------------------------------------------- modificadores (especiales + doctrina), rasgos efectivos
const SUMAN = new Set(['moral', 'vel', 'diplo', 'terror', 'cab', 'arq', 'bestiaExtra', 'desgaste', 'cohesion', 'fe']);
export function mods(c) {
  if (c._m) return c._m;
  const m = { crec: 1, cap: 1, tec: 1, ataque: 1, defensa: 1, asedio: 1, naval: 1, moral: 0, ejercito: 1, vel: 0, cisma: 1, diplo: 0, terror: 0, emboscada: 1, plagaSev: 1, oro: 1, liderVida: 1, liderBono: 1, bajas: 1,
    muralla: 1, exp: 1, asimila: 1, comercioTec: 1, cab: 0, arq: 0, bestiaExtra: 0, llanos: 1, calorPen: 1, desastre: 1, defMontana: 1, abierto: 1, flanqueo: 1, desembarco: 1, desgaste: 0, cohesion: 0, fe: 0, comida: {} };
  const fuentes = [...(c.esp || []).map((k) => ESPECIALES[k]?.mod), DOCTRINAS[c.doctrina]?.mod].filter(Boolean);
  for (const f of fuentes) for (const [k, v] of Object.entries(f)) {
    if (k === 'comida') { for (const [b, x] of Object.entries(v)) m.comida[b] = (m.comida[b] || 1) * x; }
    else if (typeof v === 'boolean' || typeof v === 'string') m[k] = v;
    else if (SUMAN.has(k)) m[k] += v; else m[k] *= v;
  }
  c._m = m; return m;
}
export function rv(c, k) {
  let v = c.r[k] ?? 50; const m = mods(c);
  if (c.lider?.bono === k) v += 14 * m.liderBono;
  if (c.oro > 0 && (k === 'ciencia' || k === 'comercio' || k === 'cohesion')) v += 8;
  if (k === 'cohesion') v += m.cohesion; if (k === 'fe') v += m.fe; if (k === 'diplomacia') v += m.diplo * 0.5;
  return cl(v);
}
function tablaComida(c) {
  const ag = rv(c, 'agua'), ca = rv(c, 'calor'), fr = rv(c, 'frio'), bo = rv(c, 'bosque'), mo = rv(c, 'montana'), m = mods(c), t = COMIDA.slice();
  t[B.COSTA] *= 0.3 + ag / 70; t[B.DESIERTO] *= (0.35 + ca / 45) * m.calorPen; t[B.SELVA] *= (0.6 + ca / 150) * m.calorPen; t[B.TUNDRA] *= 0.35 + fr / 55; t[B.NIEVE] *= 0.35 + fr / 55;
  t[B.MONTANA] *= 0.5 + mo / 100; t[B.BOSQUE] *= 0.6 + bo / 120;
  for (const [b, x] of Object.entries(m.comida)) t[+b] *= x;
  c._com = t; c._costa = ag / 120; c._nav = navega(c); return t;
}
function comidaCelda(E, i, c) { const M = E.mapa, t = c._com || tablaComida(c); return (t[M.bioma[i]] + (M.rio[i] ? 1.4 : 0) + (M.costaAdj[i] ? c._costa : 0)) * (E._zm ? E._zm[i] : 1); }
const navega = (c) => c.tec >= 300 - rv(c, 'ciencia') * 1.5 || rv(c, 'agua') >= 60;
export const tecMil = (c) => {
  const e = c.era, sig = ERAS[e + 1]?.tec;
  const f = sig ? cl((c.tec - ERAS[e].tec) / (sig - ERAS[e].tec), 0, 1) : Math.log2(1 + Math.max(0, c.tec - ERAS[e].tec) / 3000);
  return Math.pow(1.5, e + f);
};
export const poderCiv = (c) => (c.pob || 0) * tecMil(c) * (0.6 + rv(c, 'agresividad') / 250 + rv(c, 'disciplina') / 250) * mods(c).ataque;
export const eraDe = (tec) => { let e = 0; for (let i = 0; i < ERAS.length; i++) if (tec >= ERAS[i].tec) e = i; return e; };
const clave = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const relDe = (E, a, b) => E.rel[clave(a, b)] || null;
export function guerrasDe(E, id) { const l = []; for (const r of Object.values(E.rel)) if (r.estado === 'guerra' && (r.a === id || r.b === id)) l.push(r.a === id ? r.b : r.a); return l; }

// ---------------------------------------------------------------- diario, hitos, crónica, efectos
function log(E, texto, tipo = '', hito = false, civ = null) {
  const l = { d: E.año, texto, tipo, civ }; E.diario.unshift(l); if (E.diario.length > 220) E.diario.length = 220;
  if (hito) { E.hitos.unshift(l); if (E.hitos.length > 160) E.hitos.length = 160; }
}
function crono(E, c, texto) { (c.cronica ||= []).push({ d: E.año, t: texto }); if (c.cronica.length > 60) c.cronica.splice(4, 1); }
function efecto(E, t, celda, extra = {}) { E.efectos.push({ id: E.sig.ef++, t, celda, año: E.año, ...extra }); if (E.efectos.length > 120) E.efectos.splice(0, E.efectos.length - 120); }

// ---------------------------------------------------------------- creación
// cfg: { semilla, tipo, velo, civs: [{ nombre, color, emblema, r, especiales: [k,k], doctrina: 'auto'|k, estilo }] }
export function crearMundo(cfg) {
  const semilla = (cfg.semilla >>> 0) || 1, tipo = cfg.tipo || 'continente', M = generarMapa(semilla, tipo), R = azar(semilla ^ 0x9e3779b9);
  const E = { v: 2, semilla, tipo, año: 0, velo: Math.max(0, cfg.velo ?? 400), mapa: M, dueno: new Array(M.n).fill(-1), ciudadDe: new Array(M.n).fill(-1), zona: new Array(M.n).fill(0),
    civs: [], ciudades: [], ejercitos: [], combates: [], partes: [], monstruos: [], zonas: [], rel: {}, diario: [], hitos: [], hist: [], efectos: [], ruinas: [], mods: {},
    poderes: { energia: 60, max: ENERGIA_MAX, usados: 0 }, sig: { ciu: 0, ej: 0, ef: 0, comb: 0, parte: 0, mon: 0 }, fin: null, finVisto: false, domina: { id: -1, años: 0 } };
  const civsCfg = cfg.civs.slice(0, MAX_CIVS), K = civsCfg.length;
  const cand = []; for (let i = 0; i < M.n; i++) { const b = M.bioma[i]; if (!esAgua(b) && b !== B.MONTANA && b !== B.NIEVE && Math.hypot(M.x[i], M.z[i]) < RMAPA - 7) cand.push(i); }
  // repartos de cunas: se queda con el de zonas más parejas en tierra útil (pesa más la tierra cercana)
  const util = M.bioma.map((b) => [0, 0.4, 1, 3, 2, 2, 1.2, 1.2, 0.6, 0.4][b]);
  let sitios = null, mejorJ = -1;
  for (let intento = 0; intento < (K > 5 ? 24 : 40); intento++) {
    const ss = [cand[Math.floor(R() * cand.length)]];
    while (ss.length < K) { let mejor = -1, md = -1; for (const i of cand) { let d = 1e9; for (const s of ss) d = Math.min(d, dist(M, i, s)); d += R() * 5; if (d > md) { md = d; mejor = i; } } ss.push(mejor); }
    const tot = ss.map(() => 0); for (let i = 0; i < M.n; i++) { let mz = 0, md = 1e9; ss.forEach((s, k) => { const d = dist(M, i, s); if (d < md) { md = d; mz = k; } }); tot[mz] += util[i] * (md < 9 ? 1.5 : 1); }
    const j = Math.min(...tot) / Math.max(...tot); if (j > mejorJ) { mejorJ = j; sitios = ss; }
  }
  // clima de cada cuna: cada pueblo va donde mejor encaja (asignación codiciosa: sirve hasta para 8)
  const clima = sitios.map((s) => { const c = [0, 0, 0, 0, 0]; let t = 0; for (let i = 0; i < M.n; i++) if (dist(M, i, s) < 6) { t++; const b = M.bioma[i]; if (b === B.DESIERTO || b === B.SELVA) c[0]++; if (b === B.TUNDRA || b === B.NIEVE) c[1]++; if (esAgua(b)) c[2]++; if (b === B.BOSQUE || b === B.SELVA) c[3]++; if (b === B.MONTANA) c[4]++; } return c.map((v) => v / t); });
  const ajuste = (r, k) => { const [ca, fr, ag, bo, mo] = clima[k]; return ((r.calor ?? 50) - 50) * ca + ((r.frio ?? 50) - 50) * fr + ((r.agua ?? 50) - 50) * ag + ((r.bosque ?? 50) - 50) * bo + ((r.montana ?? 50) - 50) * mo; };
  const asig = new Array(K).fill(-1), libres = new Set(sitios.map((_, k) => k));
  const orden = civsCfg.map((cc, i) => i).sort((p, q) => Math.max(...sitios.map((_, k) => ajuste(civsCfg[q].r || {}, k))) - Math.max(...sitios.map((_, k) => ajuste(civsCfg[p].r || {}, k))));
  for (const ci of orden) { let mk = -1, ms = -1e9; for (const k of libres) { const s = ajuste(civsCfg[ci].r || {}, k); if (s > ms) { ms = s; mk = k; } } asig[ci] = mk; libres.delete(mk); }
  for (let i = 0; i < M.n; i++) { let mz = 0, md = 1e9; sitios.forEach((s, k) => { const d = dist(M, i, s); if (d < md) { md = d; mz = k; } }); E.zona[i] = mz; }
  civsCfg.forEach((cc, ci) => {
    const r = ajustarPresupuesto(cc.r || {});
    const esp = (cc.especiales || []).filter((k) => ESPECIALES[k]).slice(0, 2);
    const c = nuevaCiv(E, R, { nombre: cc.nombre || `Pueblo ${ci + 1}`, color: cc.color || COLORES[ci % COLORES.length], emblema: cc.emblema || EMBLEMAS[ci], r, lengua: ci, esp,
      doctrina: cc.doctrina && cc.doctrina !== 'auto' && DOCTRINAS[cc.doctrina] ? cc.doctrina : doctrinaDe(r, esp), estilo: cc.estilo || 'piedra', arquetipo: cc.preset || null });
    c.zona = asig[ci];
    const ciu = fundar(E, R, c, sitios[asig[ci]], 320, true); ciu.capital = true; c.capital = ciu.id;
    c.bestia = bestiaDe(E, c, sitios[asig[ci]]);
    log(E, `${c.emblema} Nace ${c.nombre} junto a ${ciu.nombre}. Su fe: ${c.religion}. Doctrina: ${DOCTRINAS[c.doctrina].n}.`, 'logro', true, c.id); crono(E, c, `🌱 Nace junto a ${ciu.nombre}`);
  });
  if (E.velo > 0) log(E, `🌫️ Un velo de niebla separa a los pueblos. Caerá en el año ${E.velo}.`, '', true);
  muestrear(E);
  return E;
}
// la bestia de guerra sale de la tierra donde nace cada pueblo
function bestiaDe(E, c, cuna) {
  const m = mods(c); if (m.bestia) return m.bestia;
  const M = E.mapa, cnt = {}; let t = 0; for (const i of celdasEn(M, cuna, 6)) { t++; cnt[M.bioma[i]] = (cnt[M.bioma[i]] || 0) + 1; }
  const f = (b) => (cnt[b] || 0) / Math.max(1, t);
  if (f(B.DESIERTO) > 0.2 && c.r.calor > 55) return 'camello';
  if (f(B.SELVA) > 0.18) return 'elefante';
  if (f(B.TUNDRA) + f(B.NIEVE) > 0.2 && c.r.frio > 60) return 'oso';
  if (f(B.BOSQUE) > 0.25 && c.r.bosque > 60) return 'lobo';
  if (f(B.MONTANA) > 0.15 && c.r.montana > 60) return 'cabra';
  return m.bestiaExtra > 0 ? (c.r.calor > 60 ? 'camello' : 'lobo') : null;
}
function nuevaCiv(E, R, { nombre, color, emblema, r, lengua, padre = null, esp = [], doctrina = 'asalto', estilo = 'piedra', arquetipo = null }) {
  const c = { id: E.civs.length, nombre, color, emblema, r: { ...r }, r0: { ...r }, esp, doctrina, estilo, arquetipo, bestia: null, lengua, padre, tec: 0, era: 0, desc: 0, pob: 0, poder: 0, celdas: 0, vivo: true, nacio: E.año, murio: null, causa: '',
    religion: '', lider: null, oro: 0, plaga: null, capital: -1, expPts: 0, zona: -1, ex: { guerra: 0, paz: 0, desastre: 0, prosperidad: 0, comercio: 0, victorias: 0, derrotas: 0, alianzas: 0 },
    stats: { guerras: 0, batallasG: 0, batallasP: 0, conquistas: 0, perdidas: 0, maxPob: 0, asediosG: 0, emboscadas: 0, bajasCausadas: 0, bajasSufridas: 0 }, heroe: null, pobPrev: 0, rh: [] };
  c.religion = elige(R, ['el culto de ', 'la fe de ', 'los misterios de ', 'la senda de ', 'el templo de ']) + palabra(R, lengua, 2, 2);
  E.civs.push(c); nuevoLider(E, R, c, true); return c;
}
const EPITETOS = { agresividad: ['el Conquistador', 'la Conquistadora'], ciencia: ['el Sabio', 'la Sabia'], fe: ['el Piadoso', 'la Piadosa'], comercio: ['el Mercader', 'la Mercader'],
  expansion: ['el Explorador', 'la Exploradora'], fertilidad: ['el Prolífico', 'la Madre del Pueblo'], cohesion: ['el Unificador', 'la Unificadora'], diplomacia: ['el Pacificador', 'la Pacificadora'],
  disciplina: ['el General', 'la Generala'], ingenieria: ['el Constructor', 'la Constructora'], espionaje: ['el Astuto', 'la Astuta'], tolerancia: ['el Justo', 'la Justa'] };
function nuevoLider(E, R, c, primero = false) {
  const ks = Object.keys(EPITETOS), pesos = ks.map((k) => rv(c, k) ** 2 + 200), tot = pesos.reduce((s, v) => s + v, 0); let x = R() * tot, k = ks[0];
  for (let i = 0; i < ks.length; i++) { x -= pesos[i]; if (x <= 0) { k = ks[i]; break; } }
  const mujer = R() < 0.45, cruel = (k === 'agresividad' && R() < 0.3) || rv(c, 'crueldad') > 75 && R() < 0.3;
  c.lider = { nombre: palabra(R, c.lengua, 2, 3), epiteto: cruel ? (mujer ? 'la Cruel' : 'el Cruel') : EPITETOS[k][mujer ? 1 : 0], bono: cruel ? 'crueldad' : k, edad: 18 + Math.floor(R() * 25), desde: E.año, titulo: mujer ? 'reina' : 'rey' };
  if (!primero) log(E, `👑 ${cap(c.lider.titulo)} ${c.lider.nombre} ${c.lider.epiteto} sube al trono de ${c.nombre}.`, '', false, c.id);
}
function fundar(E, R, c, celda, pob, capital = false) {
  const M = E.mapa, ciu = { id: E.sig.ciu++, civ: c.id, celda, nombre: palabra(R, c.lengua), pob, nivel: nivelDe(pob), fundada: E.año, capital, fuego: 0, comida: 0, cap: 0, sitiada: 0, fundador: c.id, muralla: 1, asaltos: 0 };
  E.ciudades.push(ciu);
  for (const i of [celda, ...M.vec[celda]]) if ((E.dueno[i] < 0 || i === celda) && M.bioma[i] !== B.MAR && (E.año >= E.velo || E.zona[i] === c.zona || c.zona < 0)) { E.dueno[i] = c.id; E.ciudadDe[i] = ciu.id; }
  efecto(E, 'fundacion', celda);
  return ciu;
}

// ---------------------------------------------------------------- un año
export function paso(E) {
  if (!E.mapa) throw new Error('mapa sin generar');
  const R = azar(hash(E.semilla, E.año)), M = E.mapa; E.año++;
  const C = new Map(E.ciudades.map((c) => [c.id, c])), vivas = E.civs.filter((c) => c.vivo);
  for (let i = vivas.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [vivas[i], vivas[j]] = [vivas[j], vivas[i]]; }
  for (const c of vivas) { c._m = null; tablaComida(c); }
  zonasDelAño(E);
  if (E.año === E.velo) { log(E, '🌫️ ¡El velo cae! Los pueblos del orbe pueden encontrarse.', 'logro', true); efecto(E, 'velo', celdaCercana(M, 0, 0)); }
  const antesVelo = E.año < E.velo;

  // 1) comida, clima y frontera en una pasada
  for (const ci of E.ciudades) ci.comida = 0;
  const S = {};
  for (const c of vivas) S[c.id] = { celdas: 0, cal: 0, fri: 0, agu: 0, bos: 0, mon: 0, front: [], borde: {} };
  for (let i = 0; i < M.n; i++) {
    const d = E.dueno[i]; if (d < 0) continue; const c = E.civs[d], s = S[d]; if (!s) { E.dueno[i] = -1; continue; }
    const ci = C.get(E.ciudadDe[i]); if (!ci || ci.civ !== d) { E.dueno[i] = -1; E.ciudadDe[i] = -1; continue; }
    ci.comida += comidaCelda(E, i, c); s.celdas++;
    const b = M.bioma[i]; if (b === B.DESIERTO || b === B.SELVA) s.cal++; if (b === B.TUNDRA || b === B.NIEVE) s.fri++; if (M.costaAdj[i] || esAgua(b)) s.agu++; if (b === B.BOSQUE || b === B.SELVA) s.bos++; if (b === B.MONTANA) s.mon++;
    for (const j of M.vec[i]) {
      const dj = E.dueno[j];
      if (dj < 0) { if (M.bioma[j] !== B.MAR || (c._nav && R() < 0.15)) s.front.push(j, i); }
      else if (dj !== d) s.borde[dj] = (s.borde[dj] || 0) + 1;
    }
  }

  // 2) población
  const nSocios = {}; for (const r of Object.values(E.rel)) if (r.comercio) { nSocios[r.a] = (nSocios[r.a] || 0) + 1; nSocios[r.b] = (nSocios[r.b] || 0) + 1; }
  for (const ci of E.ciudades) {
    const c = E.civs[ci.civ]; if (!c.vivo) continue; const m = mods(c), socios = nSocios[c.id] || 0;
    ci.cap = Math.max(60, ci.comida * 55 * (1 + 2.4 * (1 - Math.exp(-c.tec / 3500))) * (1 + socios * 0.05 * rv(c, 'comercio') / 100) * (1 + rv(c, 'fertilidad') / 500) * (ci.capital ? 1.15 : 1)
      * (M.costaAdj[ci.celda] && c._nav ? 1 + rv(c, 'comercio') / 300 : 1) * m.cap);
    const rr = (0.006 + rv(c, 'fertilidad') / 100 * 0.03 + Math.max(0, c.r.ciencia - 80) / 100 * 0.014) * (c.oro > 0 ? 1.3 : 1) * m.crec;
    if (ci.pob < ci.cap) ci.pob += ci.pob * rr * (1 - ci.pob / ci.cap); else ci.pob -= (ci.pob - ci.cap) * 0.08;
    ci.pob = Math.max(20, ci.pob); if (ci.fuego > 0) ci.fuego--; if (ci.sitiada > 0) ci.sitiada--; else ci.muralla = Math.min(1, (ci.muralla ?? 1) + 0.05);
    const nv = nivelDe(ci.pob);
    if (nv > ci.nivel) { ci.nivel = nv; const primera = nv === 3 && !c.metro; if (primera) c.metro = true; if (nv >= 2) log(E, `${c.emblema} ${ci.nombre} (${c.nombre}) se convierte en ${NIVELES[nv].toLowerCase()}${primera ? ', la primera de su pueblo' : ''}.`, 'bueno', primera, c.id); }
    else if (nv < ci.nivel && ci.pob < [0, 800, 3200, 9000][ci.nivel]) ci.nivel = nv;
  }
  for (const c of vivas) {
    let p = 0, n = 0; for (const x of E.ciudades) if (x.civ === c.id) { p += x.pob; n++; } c.pob = p; c.nCiudades = n; c.celdas = S[c.id].celdas;
    c.stats.maxPob = Math.max(c.stats.maxPob, c.pob); c.poder = poderCiv(c);
  }

  // 3) líderes, edades de oro, saber y rasgos
  for (const c of vivas) {
    const L = c.lider, m = mods(c); L.edad++;
    const enGuerra = guerrasDe(E, c.id).length > 0;
    if (R() < ((L.edad > 42 ? (L.edad - 42) * 0.005 : 0.002) + (enGuerra ? 0.006 : 0)) * m.liderVida) {
      const años = E.año - L.desde; if (años >= 30 || L.hazañas > 0) crono(E, c, `👑 Muere ${L.nombre} ${L.epiteto} tras ${años} años de reinado${L.hazañas ? ` y ${L.hazañas} conquistas` : ''}`);
      log(E, `⚰️ Muere ${L.titulo === 'reina' ? 'la reina' : 'el rey'} ${L.nombre} ${L.epiteto} de ${c.nombre} tras ${años} años de reinado.`, '', false, c.id); nuevoLider(E, R, c);
    }
    if (c.oro > 0 && --c.oro === 0) log(E, `${c.emblema} Termina la edad de oro de ${c.nombre}.`, '', false, c.id);
    if (c.heroe && --c.heroe.años <= 0) { log(E, `🗡️ El general ${c.heroe.nombre} de ${c.nombre} se retira a morir en paz.`, '', false, c.id); c.heroe = null; }
    const socios = Object.values(E.rel).filter((r) => r.comercio && (r.a === c.id || r.b === c.id));
    let ritmo = 0.55 * Math.pow(c.pob / 1000, 0.35) * Math.pow(0.1 + rv(c, 'ciencia') / 40, 1.15) * (0.75 + rv(c, 'innovacion') / 200) * (1 + socios.length * 0.15 * (0.4 + rv(c, 'comercio') / 100) * m.comercioTec) * (c.oro > 0 ? 1.6 : 1) * m.tec;
    for (const r of Object.values(E.rel)) { if (r.a !== c.id && r.b !== c.id) continue; const o = E.civs[r.a === c.id ? r.b : r.a]; if (o.vivo && o.tec > c.tec) ritmo += (o.tec - c.tec) * (r.comercio ? 0.0025 : 0.0012) * (m.espia ? 2 : 1); }
    const trib = Object.values(E.rel).find((r) => r.estado === 'tributo' && (r.a === c.id || r.b === c.id));
    if (trib) ritmo *= trib.senor === c.id ? 1.15 : 0.85;
    if (c._nav) ritmo *= 1 + (S[c.id].agu / Math.max(1, S[c.id].celdas)) * (rv(c, 'comercio') + rv(c, 'ciencia')) / 240;
    c.tec += ritmo;
    while (c.desc < DESC.length && c.tec >= DESC[c.desc][1]) {
      const d = DESC[c.desc][0], primero = !E.civs.some((o) => o !== c && o.desc > c.desc);
      log(E, `💡 ${c.nombre} descubre ${d}${primero ? ' — ¡primera en el mundo!' : ''}.`, 'logro', primero, c.id); if (primero) crono(E, c, `💡 Primera en descubrir ${d}`); c.desc++;
    }
    const era = eraDe(c.tec); if (era > c.era) { c.era = era; crono(E, c, `${ERAS[era].e} Entra en la ${ERAS[era].n}`); log(E, `${ERAS[era].e} ${c.nombre} entra en la ${ERAS[era].n}.`, 'logro', true, c.id); }
    derivarRasgos(E, c, S[c.id], enGuerra);
    if (E.año % 25 === 0) { c.rh.push({ a: E.año, r: CLAVES.map((k) => Math.round(c.r[k])) }); if (c.rh.length > 90) c.rh = c.rh.filter((_, i) => i % 2 === 0); }
  }

  // 4) expansión y colonos
  for (const c of vivas) {
    const s = S[c.id], m = mods(c); c.expPts = Math.min(8, c.expPts + (0.5 + Math.sqrt(c.pob / 1000) * 0.8) * (0.2 + rv(c, 'expansion') / 75) * m.exp);
    c.encerrada = s.front.length === 0;
    let intentos = 0;
    while (c.expPts >= 1 && intentos++ < 8 && s.front.length) {
      let mejor = -1, mo = -1, ms = -1e9;
      for (let k = 0; k < s.front.length; k += 2) {
        const j = s.front[k], o = s.front[k + 1]; if (E.dueno[j] >= 0) continue; if (antesVelo && E.zona[j] !== c.zona) continue;
        const ci = C.get(E.ciudadDe[o]); if (!ci) continue; const dd = dist(M, j, ci.celda), rad = 1.6 + ci.nivel * 1.1 + c.era * 0.3 + rv(c, 'expansion') / 55;
        if (dd > rad) continue; const sc = comidaCelda(E, j, c) - dd * 0.25 + R() * 0.8; if (sc > ms) { ms = sc; mejor = j; mo = o; }
      }
      if (mejor < 0) { c.encerrada = true; break; }
      E.dueno[mejor] = c.id; E.ciudadDe[mejor] = E.ciudadDe[mo]; c.expPts -= M.bioma[mejor] === B.MONTANA || esAgua(M.bioma[mejor]) ? 1.6 : 1;
    }
    const mias = E.ciudades.filter((x) => x.civ === c.id), fuente = mias.filter((x) => x.pob > 650 && x.pob > x.cap * 0.45);
    if (fuente.length && mias.length < 2 + c.pob / 1800 && R() < (0.04 + rv(c, 'expansion') / 100 * 0.14) * m.exp) {
      const f = fuente[Math.floor(R() * fuente.length)]; let mejor = -1, ms = -1e9;
      for (let k = 0; k < 60; k++) {
        const ang = R() * Math.PI * 2, d = (4 + R() * (c._nav ? 9 : 4.5)) * PASO, j = celdaCercana(M, M.x[f.celda] + Math.cos(ang) * d, M.z[f.celda] + Math.sin(ang) * d);
        if (j < 0) continue; const b = M.bioma[j]; if (esAgua(b) || (b === B.MONTANA && rv(c, 'montana') < 70) || (b === B.NIEVE && rv(c, 'frio') < 65)) continue;
        if (E.dueno[j] >= 0 && E.dueno[j] !== c.id) continue; if (antesVelo && E.zona[j] !== c.zona) continue;
        if (E.ciudades.some((x) => dist(M, x.celda, j) < 3.8)) continue;
        let sc = comidaCelda(E, j, c); for (const v of M.vec[j]) sc += comidaCelda(E, v, c) * 0.5; sc += R() * 2;
        if (sc > ms) { ms = sc; mejor = j; }
      }
      if (mejor >= 0 && ms > 5) { f.pob -= 180; const n = fundar(E, R, c, mejor, 180); log(E, `${c.emblema} Colonos de ${f.nombre} fundan ${n.nombre}.`, '', false, c.id); }
    }
  }

  if (!antesVelo) diplomacia(E, R, vivas, S);
  guerra(E, R, C);
  monstruos(E, R);
  eventos(E, R);
  E.poderes.energia = Math.min(E.poderes.max ?? ENERGIA_MAX, (E.poderes.energia ?? 0) + ENERGIA_AÑO);
  limpiar(E); comprobarFin(E);
  if (E.año % 10 === 0) muestrear(E);
  E.efectos = E.efectos.filter((f) => E.año - f.año < 30);
  E.zonas = E.zonas.filter((z) => z.hasta > E.año);
}
// multiplicador de comida por celda según los poderes activos (lluvias, sequías, langostas, ceniza…)
function zonasDelAño(E) {
  if (!E.zonas.length) { E._zm = null; return; }
  const M = E.mapa, zm = E._zm && E._zm.length === M.n ? E._zm.fill(1) : new Float32Array(M.n).fill(1);
  for (const z of E.zonas) { if (!z.mult || z.mult === 1) continue; for (let i = 0; i < M.n; i++) if (dist(M, i, z.celda) <= z.r) zm[i] *= z.mult; }
  E._zm = zm;
}

function derivarRasgos(E, c, s, enGuerra) {
  const ex = c.ex; for (const k in ex) ex[k] *= 0.985;
  if (enGuerra) ex.guerra += 0.03; else ex.paz += 0.02;
  const crec = c.pobPrev ? (c.pob - c.pobPrev) / c.pobPrev : 0; c.pobPrev = c.pob; if (crec > 0.004 && !enGuerra) ex.prosperidad += 0.03;
  const t = s.celdas || 1, fh = s.cal / t, ff = s.fri / t, fa = s.agu / t, fb = s.bos / t, fm = s.mon / t, n = c.nCiudades || 1, r0 = c.r0;
  const obj = {
    agresividad: r0.agresividad + ex.guerra * 20 + ex.derrotas * 8 - ex.paz * 6 + (c.encerrada && c.pobPrev > 0 && crec < 0.001 ? 14 : 0),
    ciencia: r0.ciencia + ex.prosperidad * 15 + ex.comercio * 10 - ex.desastre * 6 + (c.oro > 0 ? 6 : 0),
    innovacion: r0.innovacion + ex.prosperidad * 10 - ex.desastre * 5,
    fe: r0.fe + ex.desastre * 22 - ex.prosperidad * 6 - Math.max(0, c.era - 4) * 6,
    comercio: r0.comercio + ex.comercio * 18 + fa * 15 - ex.guerra * 5,
    expansion: r0.expansion + (c.encerrada ? -12 : 6) + ex.victorias * 6,
    fertilidad: r0.fertilidad + ex.desastre * 14 - c.era * 3,
    salud: r0.salud + ex.desastre * 8 + c.era * 2,
    cohesion: r0.cohesion - Math.min(22, Math.max(0, n - 4) * 1.5) * (1.3 - rv(c, 'tolerancia') / 100) + ex.victorias * 8 - ex.desastre * 8 - ex.derrotas * 10 + (rv(c, 'fe') - 50) * 0.12 + (rv(c, 'ciencia') - 50) * 0.08 - (rv(c, 'innovacion') - 50) * 0.08,
    lealtad: r0.lealtad - ex.derrotas * 8 + ex.victorias * 4,
    tolerancia: r0.tolerancia + ex.comercio * 10 - ex.guerra * 5,
    diplomacia: r0.diplomacia + ex.alianzas * 15 + ex.comercio * 8 - ex.guerra * 12,
    disciplina: r0.disciplina + ex.guerra * 10, crueldad: r0.crueldad + ex.guerra * 6 + ex.derrotas * 6, espionaje: r0.espionaje + ex.guerra * 5, ingenieria: r0.ingenieria + ex.guerra * 4 + ex.prosperidad * 4,
    movilidad: r0.movilidad, honor: r0.honor - ex.guerra * 4,
    calor: Math.max(r0.calor, r0.calor * 0.5 + fh * 140), frio: Math.max(r0.frio, r0.frio * 0.5 + ff * 140), agua: r0.agua + fa * 35,
    bosque: Math.max(r0.bosque, r0.bosque * 0.5 + fb * 140), montana: Math.max(r0.montana, r0.montana * 0.5 + fm * 160),
  };
  for (const k in obj) c.r[k] += (cl(obj[k], 2, 98) - (c.r[k] ?? 50)) * 0.015;
}

// ---------------------------------------------------------------- diplomacia
function diplomacia(E, R, vivas, S) {
  const M = E.mapa;
  for (let x = 0; x < vivas.length; x++) for (let y = x + 1; y < vivas.length; y++) {
    const A = vivas[x], Bc = vivas[y], k = clave(A.id, Bc.id); let r = E.rel[k];
    const fr = (S[A.id].borde[Bc.id] || 0) + (S[Bc.id].borde[A.id] || 0);
    if (!r) {
      let cerca = fr > 0;
      if (!cerca) for (const p of E.ciudades) { if (p.civ !== A.id) continue; for (const q of E.ciudades) if (q.civ === Bc.id && dist(M, p.celda, q.celda) < 11) { cerca = true; break; } if (cerca) break; }
      if (!cerca && (A._nav || Bc._nav) && R() < 0.02) cerca = true;
      if (!cerca) continue;
      const v0 = ((rv(A, 'diplomacia') + rv(Bc, 'diplomacia')) / 2 - (rv(A, 'agresividad') + rv(Bc, 'agresividad')) / 2) * 0.5 + (R() - 0.5) * 20 + (A.padre === Bc.id || Bc.padre === A.id ? -20 : 0) + (mods(A).diplo + mods(Bc).diplo) * 0.5;
      r = E.rel[k] = { contacto: E.año, a: Math.min(A.id, Bc.id), b: Math.max(A.id, Bc.id), v: cl(v0, -100, 100), estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: fr, ultimaGuerra: E.año };
      log(E, `🤝 Primer contacto: ${A.emblema} ${A.nombre} y ${Bc.emblema} ${Bc.nombre} se descubren.`, 'logro', true);
      crono(E, A, `🤝 Descubre a ${Bc.nombre}`); crono(E, Bc, `🤝 Descubre a ${A.nombre}`);
      let mp = null, mdd = 1e9; for (const p of E.ciudades) if (p.civ === A.id) for (const q of E.ciudades) if (q.civ === Bc.id) { const d = dist(M, p.celda, q.celda); if (d < mdd) { mdd = d; mp = [p.celda, q.celda]; } }
      if (mp) efecto(E, 'contacto', celdaCercana(M, (M.x[mp[0]] + M.x[mp[1]]) / 2, (M.z[mp[0]] + M.z[mp[1]]) / 2), { a: A.id, b: Bc.id });
      continue;
    }
    r.frontera = fr;
    const mA = mods(A), mB = mods(Bc), aA = rv(A, 'agresividad'), aB = rv(Bc, 'agresividad'), dA = rv(A, 'diplomacia'), dB = rv(Bc, 'diplomacia');
    const escasez = (A.encerrada ? 12 : 0) + (Bc.encerrada ? 12 : 0) + Math.min(40, (E.año - r.ultimaGuerra) / 15);
    const relig = (rv(A, 'fe') + rv(Bc, 'fe')) / 2 > 55 && A.religion !== Bc.religion ? 14 + (mA.guerraSanta || mB.guerraSanta ? 12 : 0) : 0;
    const odio = (rv(A, 'crueldad') + rv(Bc, 'crueldad')) / 2 > 60 ? 10 : 0, confianza = (rv(A, 'honor') + rv(Bc, 'honor')) / 2 * 0.15;
    const obj = (dA + dB) / 2 * 0.85 - (aA + aB) / 2 * 0.95 + (rv(A, 'comercio') + rv(Bc, 'comercio')) / 2 * 0.25 - Math.min(30, fr * 0.35) * (aA + aB) / 100 - relig - escasez - odio + confianza
      + (r.estado === 'alianza' ? 12 : 0) + (enemigoComun(E, A.id, Bc.id) ? 20 : 0) + (mA.diplo + mB.diplo) * 0.5;
    r.v = cl(r.v + (obj - r.v) * 0.03 + (R() - 0.5) * 5, -100, 100);
    if (r.estado !== 'guerra' && R() < 0.004 + Math.min(0.006, fr * 0.0002)) {
      const P = R() < 0.5 ? A : Bc, Q = P === A ? Bc : A, golpe = 25 + R() * 45; r.v = cl(r.v - golpe, -100, 100);
      log(E, `❗ ${elige(R, [`Asesinan a un embajador de ${Q.nombre} en la corte de ${P.nombre}`, `Soldados de ${P.nombre} queman una aldea fronteriza de ${Q.nombre}`, `Un príncipe de ${P.nombre} rapta a una princesa de ${Q.nombre}`, `${P.nombre} profana un templo de ${Q.religion}`, `Piratas de ${P.nombre} saquean barcos de ${Q.nombre}`, `${P.nombre} reclama tierras que ${Q.nombre} considera suyas`])}.`, 'malo', false);
    }
    const umbralComercio = mA.comercioTodos || mB.comercioTodos ? -40 : -5;
    const quiere = r.estado !== 'guerra' && r.v > umbralComercio && rv(A, 'comercio') + rv(Bc, 'comercio') > 75;
    if (quiere && !r.comercio) { r.comercio = true; log(E, `💰 Se abre una ruta comercial entre ${A.nombre} y ${Bc.nombre}.`, 'bueno', !r.yaComercio); r.yaComercio = true; }
    else if (!quiere && r.comercio) r.comercio = false;
    if (r.comercio) { A.ex.comercio += 0.02; Bc.ex.comercio += 0.02; }
    if (r.estado === 'paz' || r.estado === 'alianza') {
      if (r.estado === 'paz' && r.v > 50 && dA > 40 && dB > 40) { r.estado = 'alianza'; A.ex.alianzas += 0.5; Bc.ex.alianzas += 0.5; log(E, `🕊️ ${A.nombre} y ${Bc.nombre} firman una alianza.`, 'bueno', true); continue; }
      if (r.estado === 'alianza' && r.v < ((rv(A, 'honor') + rv(Bc, 'honor')) / 2 > 70 ? -10 : 15)) { r.estado = 'paz'; log(E, `💔 Se rompe la alianza entre ${A.nombre} y ${Bc.nombre}.`, 'malo', true); }
      if (E.año - r.contacto < 15) continue;
      for (const [P, Q] of [[A, Bc], [Bc, A]]) {
        if (r.v > -18 || r.estado === 'alianza') break;
        const traicion = E.año < r.tregua; if (traicion && rv(P, 'honor') > 35) continue; // con honor no se rompe una tregua
        const ratio = cl(P.poder / Math.max(1, Q.poder), 0.25, 3), ag = rv(P, 'agresividad') / 100;
        let p = (0.006 + ag * ag * 0.09) * Math.pow(ratio, 0.9) * (1.35 - rv(P, 'diplomacia') / 100) * (P.lider.bono === 'agresividad' ? 1.8 : 1) * (1 + (-18 - r.v) / 40) * (traicion ? 0.4 : 1);
        if (P.encerrada) p *= 1.5; if (mods(P).pazPronta) p *= 0.5;
        if (R() < p) {
          if (traicion) { r.sorpresa = { civ: P.id, hasta: E.año + 4 }; log(E, `🗡️ ${P.nombre} rompe la tregua y ataca a traición a ${Q.nombre}.`, 'malo', true); for (const o of E.civs) if (o.vivo && o !== P) { const ro = relDe(E, P.id, o.id); if (ro) ro.v = cl(ro.v - 10, -100, 100); } }
          declarar(E, P, Q, r); break;
        }
      }
    } else if (r.estado === 'tributo') {
      const S_ = E.civs[r.senor], T = E.civs[r.senor === r.a ? r.b : r.a];
      if (T.poder > S_.poder * 0.85 && R() < 0.05 * (1.4 - rv(T, 'lealtad') / 100)) { log(E, `✊ ${T.nombre} se rebela contra el tributo a ${S_.nombre}: ¡guerra de independencia!`, 'malo', true); r.senor = -1; declarar(E, T, S_, r, true); }
      else if (rv(S_, 'agresividad') > 60 && S_.poder > T.poder * 3 && E.año - r.desde > 30 && R() < 0.01) { log(E, `🗡️ ${S_.nombre} decide acabar con su vasallo ${T.nombre}.`, 'malo', true); r.senor = -1; declarar(E, S_, T, r, true); }
      else if (T.nCiudades <= 3 && S_.pob > T.pob * 4 && R() < 0.006 * (0.5 + rv(S_, 'diplomacia') / 50) * (0.5 + rv(S_, 'tolerancia') / 100)) asimilar(E, S_, T);
      else if (E.año - r.desde > 150 && R() < 0.01) { r.estado = 'paz'; r.senor = -1; log(E, `${T.nombre} deja de pagar tributo a ${S_.nombre} tras siglo y medio.`, '', false); }
    } else if (r.estado === 'guerra') {
      for (const P of [A, Bc]) r.cans[P.id] = (r.cans[P.id] || 0) + 0.012 + (r.bajas[P.id] || 0) / Math.max(300, P.pob) * 2;
      r.bajas = {};
      for (const [P, Q] of [[A, Bc], [Bc, A]]) {
        const umbral = (0.7 + rv(P, 'agresividad') / 100 * 1.1 + (P.lider.bono === 'agresividad' ? 0.3 : 0)) * (mods(P).pazPronta ? 0.6 : 1) * (mods(P).sinRetirada ? 1.3 : 1);
        if (r.cans[P.id] > umbral) { pazEntre(E, R, P, Q, r); break; }
      }
      espionaje(E, R, A, Bc, r); espionaje(E, R, Bc, A, r);
    }
  }
  for (const r of Object.values(E.rel)) {
    if (r.estado !== 'alianza') continue;
    for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) for (const en of guerrasDe(E, x)) {
      if (en === y) continue; const rr = relDe(E, y, en); const Y = E.civs[y], EN = E.civs[en];
      if (rr && rr.estado === 'paz' && E.año >= rr.tregua && rr.v < 25 && R() < 0.08 * (0.5 + rv(Y, 'honor') / 100)) { log(E, `📯 ${Y.nombre} entra en la guerra junto a su aliado ${E.civs[x].nombre}.`, 'malo', true); declarar(E, Y, EN, rr); }
    }
  }
}
// espías y sobornos: la guerra que no se ve
function espionaje(E, R, P, Q, r) {
  const m = mods(P), esp = rv(P, 'espionaje');
  if ((m.espia || esp > 60) && R() < 0.06 + esp / 1000) {
    if (R() < 0.5 && Q.tec > P.tec) { const robo = (Q.tec - P.tec) * 0.06; P.tec += robo; log(E, `🕵️ Espías de ${P.nombre} roban planos de ${Q.nombre}.`, '', false, P.id); }
    else { let n = 0; for (const e of E.ejercitos) if (e.civ === Q.id) { e.moral = Math.max(0.2, e.moral - 0.12); n++; } if (n) log(E, `🕵️ Espías de ${P.nombre} envenenan los pozos y siembran el miedo en los ejércitos de ${Q.nombre}.`, 'malo', false, P.id); }
  }
  if (m.soborno && R() < 0.02 + rv(P, 'diplomacia') / 3000) {
    const mios = E.ejercitos.filter((e) => e.civ === Q.id && e.enemigo === P.id && e.comb < 0); if (!mios.length) return;
    const ej = mios.reduce((a, b) => (a.fuerza > b.fuerza ? a : b));
    if (R() < 1.2 - rv(Q, 'lealtad') / 100) { cambiarBando(E, ej, P, Q); log(E, `💰 ${P.nombre} soborna a un general de ${Q.nombre}: ${num(ej.fuerza)} soldados cambian de bando.`, 'malo', true, P.id); r.cans[Q.id] = (r.cans[Q.id] || 0) + 0.1; }
  }
}
function cambiarBando(E, ej, P, Q) { ej.civ = P.id; ej.enemigo = Q.id; ej.ruta = null; ej.sitio = -1; ej.obj = -1; ej.comb = -1; ej.general = null; ej.moral = 0.7; ej.doc = P.doctrina; efecto(E, 'traicion', ej.celda, { civ: P.id }); }
function enemigoComun(E, a, b) { const ga = guerrasDe(E, a); return guerrasDe(E, b).some((x) => ga.includes(x)); }
function declarar(E, P, Q, r, silencio = false) {
  r.estado = 'guerra'; r.desde = E.año; r.cans = { [P.id]: 0, [Q.id]: 0 }; r.bajas = {}; r.comercio = false; r.agresor = P.id; r.ciudadesTomadas = { [P.id]: 0, [Q.id]: 0 }; r.batallas = 0;
  P.stats.guerras++; Q.stats.guerras++;
  const nombres = ['la Guerra de los Cien Años', 'la Guerra del Río', 'la Gran Guerra', 'la Guerra de las Coronas', 'la Guerra de la Frontera', 'la Guerra del Hierro', 'la Guerra de las Ceniza', 'la Guerra de los Estandartes'];
  r.nombre = P.padre === Q.id || Q.padre === P.id ? 'la Guerra Civil' : rv(P, 'fe') > 70 && P.religion !== Q.religion ? 'la Guerra Santa' : nombres[(E.año + P.id * 3 + Q.id) % nombres.length];
  crono(E, P, `⚔️ Declara ${r.nombre} a ${Q.nombre}`); crono(E, Q, `⚔️ ${P.nombre} le declara ${r.nombre}`);
  if (!silencio) log(E, `⚔️ ${P.emblema} ${P.nombre} declara la guerra a ${Q.emblema} ${Q.nombre}: comienza ${r.nombre}.`, 'malo', true);
}
function pazEntre(E, R, P, Q, r) {
  const ratio = Q.poder / Math.max(1, P.poder), tomadas = r.ciudadesTomadas?.[Q.id] || 0, dur = E.año - r.desde;
  if (ratio > 2.6 && rv(Q, 'agresividad') > 55 && tomadas > 0 && R() < 0.8) { if (!r.rechazo) { r.rechazo = true; log(E, `🚫 ${Q.nombre} rechaza la paz: exige la rendición total de ${P.nombre}.`, 'malo', true); } r.cans[P.id] *= 0.85; return; }
  disolver(E, P.id, Q.id);
  if (ratio > 4 && tomadas > 0 && P.nCiudades <= Math.max(3, Q.nCiudades * 0.6)) {
    crono(E, Q, `🏆 ${P.nombre} capitula: absorbe todas sus ciudades`);
    log(E, `🏳️ ${P.emblema} ${P.nombre} capitula ante ${Q.emblema} ${Q.nombre} al cabo de ${r.nombre} (${dur} años).`, 'malo', true);
    for (const ci of E.ciudades) if (ci.civ === P.id) { ci.civ = Q.id; ci.capital = false; ci.pob *= 0.85; ci.conq = E.año; }
    for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === P.id) E.dueno[i] = Q.id;
    Q.ex.victorias += 1.5; extinguir(E, P, 'conquistada', Q); return;
  }
  if (ratio > 2 && tomadas > 0 && rv(Q, 'diplomacia') < 70) {
    r.estado = 'tributo'; r.senor = Q.id; r.desde = E.año; r.v = -10; crono(E, P, `📜 Derrotada: paga tributo a ${Q.nombre}`); crono(E, Q, `📜 ${P.nombre} le paga tributo`);
    log(E, `📜 ${P.nombre} se rinde y paga tributo a ${Q.nombre}. Termina ${r.nombre} (${dur} años).`, 'malo', true);
    Q.ex.victorias += 1; P.ex.derrotas += 1;
  } else {
    r.estado = 'paz'; r.tregua = E.año + 20 + Math.floor(R() * 30); r.v = -10;
    const gana = (r.ciudadesTomadas?.[P.id] || 0) > tomadas ? P : Q.poder > P.poder * 0.8 || tomadas > 0 ? Q : null, pierde = gana === P ? Q : P;
    let cede = null;
    if (gana) {
      gana.ex.victorias += 0.6; pierde.ex.derrotas += 0.6;
      const suyas = E.ciudades.filter((x) => x.civ === gana.id), mias = E.ciudades.filter((x) => x.civ === pierde.id && !x.capital);
      if (suyas.length && mias.length && E.ciudades.filter((x) => x.civ === pierde.id).length >= 2) {
        cede = mias.reduce((m, x) => { const d = Math.min(...suyas.map((y) => dist(E.mapa, x.celda, y.celda))); return d < m.d ? { c: x, d } : m; }, { c: null, d: 1e9 }).c;
        if (cede) { cede.civ = gana.id; cede.conq = E.año; for (let i = 0; i < E.mapa.n; i++) if (E.ciudadDe[i] === cede.id) E.dueno[i] = gana.id; }
      }
    }
    for (const X of [P, Q]) crono(E, X, `🕊️ Paz con ${(X === P ? Q : P).nombre} tras ${dur} años${!gana ? '' : gana === X ? ' (gana' + (cede ? ` ${cede.nombre})` : ')') : ' (pierde' + (cede ? ` ${cede.nombre})` : ')')}`);
    log(E, `🕊️ Paz entre ${P.nombre} y ${Q.nombre}${gana ? `; ${gana.nombre} sale ganando${cede ? ` y se queda con ${cede.nombre}` : ''}` : ', sin vencedor claro'}.`, 'bueno', true);
  }
  r.ultimaGuerra = E.año; r.cans = {};
}
function disolver(E, a, b) {
  const fuera = new Set();
  E.ejercitos = E.ejercitos.filter((ej) => {
    if (!((ej.civ === a && ej.enemigo === b) || (ej.civ === b && ej.enemigo === a))) return true;
    const casa = ciudadPropiaCercana(E, ej.civ, ej.celda); if (casa) casa.pob += ej.fuerza * 0.8; fuera.add(ej.id); return false;
  });
  E.combates = E.combates.filter((c) => !fuera.has(c.a) && !fuera.has(c.b));
}
function ciudadPropiaCercana(E, civ, celda) { let m = null, md = 1e9; for (const c of E.ciudades) if (c.civ === civ) { const d = dist(E.mapa, c.celda, celda); if (d < md) { md = d; m = c; } } return m; }
function asimilar(E, S_, T) {
  for (const ci of E.ciudades) if (ci.civ === T.id) { ci.civ = S_.id; ci.capital = false; }
  for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === T.id) E.dueno[i] = S_.id;
  extinguir(E, T, 'asimilada', S_);
  log(E, `🫂 ${T.nombre} es asimilada pacíficamente por ${S_.nombre}; su gente adopta ${S_.religion}.`, 'logro', true);
}
function extinguir(E, c, causa, por = null) {
  crono(E, c, `💀 ${cap(causa)}${por ? ` por ${por.nombre}` : ''}`); if (por) crono(E, por, `💀 Acaba con ${c.nombre}`);
  c.vivo = false; c.murio = E.año; c.causa = causa; c.por = por?.id ?? null; c.pob = 0;
  const fuera = new Set(E.ejercitos.filter((e) => e.civ === c.id || e.enemigo === c.id).map((e) => e.id));
  for (const e of E.ejercitos) if (e.enemigo === c.id && e.civ !== c.id) { const casa = ciudadPropiaCercana(E, e.civ, e.celda); if (casa) casa.pob += e.fuerza * 0.8; }
  E.ejercitos = E.ejercitos.filter((e) => !fuera.has(e.id)); E.combates = E.combates.filter((x) => !fuera.has(x.a) && !fuera.has(x.b));
  for (const k of Object.keys(E.rel)) { const r = E.rel[k]; if (r.a === c.id || r.b === c.id) delete E.rel[k]; }
  for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === c.id) { E.dueno[i] = -1; E.ciudadDe[i] = -1; }
  if (causa !== 'asimilada') log(E, `💀 ${c.emblema} ${c.nombre} ha sido ${causa}${por ? ` por ${por.nombre}` : ''}. Duró ${E.año - c.nacio} años.`, 'malo', true, c.id);
}

// ---------------------------------------------------------------- guerra: ejércitos con composición, combates por rondas, sitios
function costo(E, c, i) { const b = E.mapa.bioma[i]; if (esAgua(b)) return c._nav ? (b === B.MAR ? 2.2 : 1.4) : Infinity; return b === B.MONTANA ? 2.5 - rv(c, 'montana') / 100 : b === B.NIEVE ? 2 - rv(c, 'frio') / 120 : b === B.BOSQUE || b === B.SELVA ? 1.4 - rv(c, 'bosque') / 300 : 1; }
function ruta(E, c, de, a) {
  const M = E.mapa, d = new Float64Array(M.n).fill(Infinity), prev = new Int32Array(M.n).fill(-1), h = [[0, de]]; d[de] = 0;
  const push = (x) => { h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let i = 0; for (;;) { const a2 = 2 * i + 1, b2 = a2 + 1; let m = i; if (a2 < h.length && h[a2][0] < h[m][0]) m = a2; if (b2 < h.length && h[b2][0] < h[m][0]) m = b2; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
  while (h.length) {
    const [dd, i] = pop(); if (dd > d[i]) continue; if (i === a) break;
    for (const j of M.vec[i]) { const nd = dd + (j === a ? 1 : costo(E, c, j)); if (nd < d[j]) { d[j] = nd; prev[j] = i; push([nd, j]); } }
  }
  if (!isFinite(d[a])) return null;
  const r = []; for (let i = a; i !== de && i >= 0; i = prev[i]) r.push(i); return r.reverse();
}
// composición del ejército: rasgos + especiales + doctrina + era + la bestia de su tierra
export function composicion(c) {
  const m = mods(c);
  let cab = 0.05 + rv(c, 'movilidad') / 100 * 0.35 + m.cab + (c.doctrina === 'oleadas' ? 0.15 : 0);
  let arq = 0.15 + rv(c, 'ciencia') / 1000 + rv(c, 'bosque') / 1000 + m.arq + (c.doctrina === 'emboscada' ? 0.1 : 0);
  let asedio = c.era >= 1 ? rv(c, 'ingenieria') / 100 * 0.14 + (c.doctrina === 'asedio' ? 0.1 : 0) : 0.02;
  let bestia = c.bestia ? 0.05 + m.bestiaExtra : 0;
  let inf = Math.max(0.15, 1 - cab - arq - asedio - bestia);
  const t = cab + arq + asedio + bestia + inf;
  return { inf: inf / t, arq: arq / t, cab: cab / t, asedio: asedio / t, bestia: bestia / t };
}
// ventaja de unidades de x contra y (piedra-papel-tijera), con el terreno que frena a caballería y bestias
function ventajaUnidades(x, y, bioma) {
  const frena = bioma === B.BOSQUE || bioma === B.SELVA || bioma === B.MONTANA || bioma === B.NIEVE ? 0.55 : 1;
  const peso = (cmp, u) => (u === 'cab' || u === 'bestia' ? cmp[u] * frena : cmp[u]);
  let v = 0, mejor = null, mv = 0;
  for (const a of UNIDADES) for (const b of UNIDADES) { const s = peso(x, a) * y[b] * VENTAJA[a][b] - peso(y, b) * x[a] * VENTAJA[b][a]; v += s; if (s > mv) { mv = s; mejor = [a, b]; } }
  return { f: cl(1 + v, 0.6, 1.6), mejor };
}
// distancia a casa: más allá del alcance logístico, hambre y deserción
function logistica(E, c, ej) {
  let md = 1e9; for (const x of E.ciudades) if (x.civ === c.id) { const d = dist(E.mapa, x.celda, ej.celda); if (d < md) md = d; }
  const alcance = 5 + rv(c, 'movilidad') / 20 + c.era * 0.8 + (esAgua(E.mapa.bioma[ej.celda]) && c.doctrina === 'naval' ? 4 : 0);
  const exceso = Math.max(0, md - alcance);
  return { f: 1 / (1 + exceso * 0.05), desgaste: Math.min(0.12, exceso * 0.015), dist: md };
}
// fuerza efectiva desglosada (para resolver y para explicar)
function fuerzaEf(E, c, ej, rival, R) {
  const M = E.mapa, b = M.bioma[ej.celda], m = mods(c), propio = E.dueno[ej.celda] === c.id;
  let t = 1; if (propio) t *= 1.15; if (b === B.MONTANA) t *= 1.1 + rv(c, 'montana') / 400; else if (b === B.BOSQUE || b === B.SELVA) t *= 1 + rv(c, 'bosque') / 600;
  if (b === B.DESIERTO || b === B.SELVA) t *= (0.7 + rv(c, 'calor') / 333) * m.calorPen; if (b === B.TUNDRA || b === B.NIEVE) t *= 0.7 + rv(c, 'frio') / 333;
  if (esAgua(b)) t *= (0.6 + rv(c, 'agua') / 250 + rv(c, 'ciencia') / 350) * m.naval;
  let emb = 1; if ((b === B.BOSQUE || b === B.SELVA || b === B.MONTANA) && (propio || c.doctrina === 'emboscada')) emb = m.emboscada; if (b === B.PRADERA || b === B.DESIERTO || b === B.TUNDRA) emb *= m.abierto * m.llanos;
  const u = rival ? ventajaUnidades(ej.comp, rival.comp, b) : { f: 1 + ej.comp.asedio * 0.8, mejor: null };
  const L = logistica(E, c, ej);
  const sorpresa = Object.values(E.rel).some((r) => r.sorpresa?.civ === c.id && r.sorpresa.hasta >= E.año) ? 1.15 : 1;
  const f = {
    tropas: ej.fuerza, tecnica: tecMil(c), moral: 0.5 + ej.moral, doctrina: m.ataque * (rival ? 1 : 1) * (c.doctrina === 'oleadas' && rival && rival.comp.cab < 0.2 ? m.flanqueo : 1) * sorpresa,
    terreno: t * emb, unidades: u.f, logistica: L.f, general: ej.general ? (ej.leyenda ? 1.5 : 1.25) : 1,
    rasgos: 0.7 + rv(c, 'agresividad') / 300 + rv(c, 'disciplina') / 250 + rv(c, 'cohesion') / 500 + rv(c, 'fe') / 1000,
  };
  let total = 1; for (const k in f) total *= f[k];
  return { total: total * (0.85 + R() * 0.3), f, mejor: u.mejor, emboscada: emb > 1.05 };
}
const BAJAS_RONDA = 0.2;
function guerra(E, R, C) {
  const M = E.mapa;
  // reclutar
  for (const r of Object.values(E.rel)) {
    if (r.estado !== 'guerra') continue;
    for (const [P, Q] of [[E.civs[r.a], E.civs[r.b]], [E.civs[r.b], E.civs[r.a]]]) {
      const m = mods(P), mios = E.ejercitos.filter((e) => e.civ === P.id && e.enemigo === Q.id), actual = mios.reduce((s, e) => s + e.fuerza, 0);
      const deseo = P.pob * (0.02 + rv(P, 'agresividad') / 100 * 0.06 + rv(P, 'disciplina') / 100 * 0.01) * (r.agresor === P.id ? 1 : 1.6) * (1 - Math.min(0.6, (r.cans[P.id] || 0) * 0.4)) * m.ejercito * (m.mercenarios ? 1 + rv(P, 'comercio') / 250 : 1);
      if (actual > deseo * 0.6 || mios.length >= 4 || R() > 0.6) continue;
      const objetivos = E.ciudades.filter((x) => x.civ === Q.id); if (!objetivos.length) continue;
      let base = null, obj = null, md = 1e9;
      for (const ci of E.ciudades) { if (ci.civ !== P.id || ci.pob < 500) continue; for (const o of objetivos) { const d = dist(M, ci.celda, o.celda); if (d < md) { md = d; base = ci; obj = o; } } }
      if (!base) continue;
      const camino = ruta(E, P, base.celda, obj.celda); if (!camino) { r.cans[P.id] = (r.cans[P.id] || 0) + 0.01; continue; }
      const f = Math.min(deseo - actual, base.pob * 0.2 * (m.mercenarios ? 1.3 : 1)); if (f < 60) continue; base.pob -= f / (m.mercenarios ? 1.3 : 1);
      E.ejercitos.push({ id: E.sig.ej++, civ: P.id, enemigo: Q.id, celda: base.celda, ruta: camino, obj: obj.id, fuerza: f, fuerza0: f, moral: 0.8 + m.moral, tray: [base.celda], sitio: -1, sitioAños: 0,
        general: P.heroe && !E.ejercitos.some((e) => e.civ === P.id && e.general === P.heroe.nombre) ? P.heroe.nombre : null, leyenda: !!P.heroe?.leyenda, comb: -1, mov: 0, comp: composicion(P), doc: P.doctrina, era: P.era, bestia: P.bestia, nace: E.año });
    }
  }
  // mover (los trabados en combate o sitiando no se mueven)
  for (const ej of E.ejercitos) {
    const P = E.civs[ej.civ], m = mods(P); ej.tray = [ej.celda]; ej.era = P.era;
    const L = logistica(E, P, ej); if (L.desgaste) { ej.fuerza *= 1 - L.desgaste; ej.hambre = L.desgaste; } else ej.hambre = 0;
    if (E.dueno[ej.celda] === ej.enemigo) { const D = E.civs[ej.enemigo]; if (D?.vivo && mods(D).desgaste) ej.fuerza *= 1 - mods(D).desgaste; }
    if (ej.comb >= 0) continue;
    if (ej.retirada > 0) { ej.retirada--; continue; }
    let o = C.get(ej.obj);
    if (!o || o.civ !== ej.enemigo) {
      const objs = E.ciudades.filter((x) => x.civ === ej.enemigo); o = null; let md = 1e9; for (const x of objs) { const d = dist(M, ej.celda, x.celda); if (d < md) { md = d; o = x; } }
      if (!o) continue; ej.obj = o.id; ej.ruta = ruta(E, P, ej.celda, o.celda) || []; ej.sitio = -1;
    }
    if (ej.sitio >= 0) continue;
    ej.mov = (ej.mov || 0) + Math.max(1, 2 + rv(P, 'movilidad') / 50 + m.vel + ej.comp.cab * 1.5 + (P.era >= 5 ? 1 : 0) + (P.era >= 6 ? 1 : 0));
    while (ej.mov >= 1) {
      ej.mov -= 1;
      let cerca = null, mdd = 3.2;
      for (const x of E.ejercitos) if (x.civ === ej.enemigo && x.comb < 0) { const d = dist(M, x.celda, ej.celda); if (d < mdd) { mdd = d; cerca = x; } }
      let sig = -1;
      if (cerca && mdd > 1.1) { let mb = 1e9; for (const j of M.vec[ej.celda]) { if (!isFinite(costo(E, P, j))) continue; const d = dist(M, j, cerca.celda); if (d < mb) { mb = d; sig = j; } } ej.ruta = null; }
      else if (cerca) { ej.mov = 0; break; }
      else { if ((!ej.ruta || !ej.ruta.length) && ej._ra !== E.año) { ej._ra = E.año; ej.ruta = ruta(E, P, ej.celda, o.celda) || []; } sig = ej.ruta?.shift() ?? -1; }
      if (sig < 0) { ej.mov = 0; break; }
      if (sig === o.celda || dist(M, sig, o.celda) < 0.6) { ej.sitio = o.id; ej.sitioAños = 0; o.sitiada = 2; ej.mov = 0; log(E, `🏹 ${P.nombre} pone sitio a ${o.nombre}.`, 'malo', false); break; }
      ej.celda = sig; ej.tray.push(sig); if (esAgua(M.bioma[sig])) { ej.porMar = true; ej.mov -= 0.5; }
      // saqueo pirata: flotas que pasan junto a una costa enemiga
      if (m.saqueo && esAgua(M.bioma[sig])) for (const x of E.ciudades) if (x.civ === ej.enemigo && M.costaAdj[x.celda] && dist(M, x.celda, sig) < 1.6 && R() < 0.3) { const botin = x.pob * 0.06; x.pob -= botin; x.fuego = Math.max(x.fuego, 2); P.tec += 3; efecto(E, 'saqueo', x.celda, { civ: P.id }); if (R() < 0.3) log(E, `🏴‍☠️ La flota de ${P.nombre} saquea el puerto de ${x.nombre}.`, 'malo', false, P.id); }
    }
  }
  // nuevos combates: ejércitos hostiles a menos de un hexágono quedan trabados
  for (let i = 0; i < E.ejercitos.length; i++) for (let j = i + 1; j < E.ejercitos.length; j++) {
    const a = E.ejercitos[i], b = E.ejercitos[j]; if (a.comb >= 0 || b.comb >= 0) continue;
    if (!(a.enemigo === b.civ || b.enemigo === a.civ || guerrasDe(E, a.civ).includes(b.civ))) continue;
    if (dist(M, a.celda, b.celda) > 1.2) continue;
    const cb = { id: E.sig.comb++, a: a.id, b: b.id, celda: a.celda, otra: b.celda, ronda: 0, bajas: [0, 0], f0: [a.fuerza, b.fuerza], inicio: E.año, lugar: lugar(E, a.celda) };
    a.comb = b.comb = cb.id; a.sitio = b.sitio = -1; E.combates.push(cb); efecto(E, 'batalla', a.celda, { otra: b.celda, comb: cb.id });
  }
  // rondas de combate
  const porId = new Map(E.ejercitos.map((e) => [e.id, e])), muertos = new Set();
  for (const cb of E.combates) {
    const a = porId.get(cb.a), b = porId.get(cb.b);
    if (!a || !b || muertos.has(a.id) || muertos.has(b.id)) { cb.fin = true; if (a) a.comb = -1; if (b) b.comb = -1; continue; }
    ronda(E, R, cb, a, b, muertos);
  }
  E.combates = E.combates.filter((c) => !c.fin);
  // sitios
  for (const ej of E.ejercitos) {
    if (muertos.has(ej.id) || ej.sitio < 0 || ej.comb >= 0) continue;
    const o = C.get(ej.sitio), P = E.civs[ej.civ]; if (!o || o.civ !== ej.enemigo) { ej.sitio = -1; continue; }
    sitio(E, R, ej, o, P, E.civs[o.civ], muertos);
  }
  E.ejercitos = E.ejercitos.filter((e) => !muertos.has(e.id) && e.fuerza >= 25 && E.civs[e.civ].vivo && E.civs[e.enemigo]?.vivo);
  const vivosEj = new Set(E.ejercitos.map((e) => e.id));
  for (const cb of E.combates) if (!vivosEj.has(cb.a) || !vivosEj.has(cb.b)) { cb.fin = true; for (const e of E.ejercitos) if (e.comb === cb.id) e.comb = -1; }
  E.combates = E.combates.filter((c) => !c.fin);
}
function ronda(E, R, cb, a, b, muertos) {
  const A = E.civs[a.civ], Bc = E.civs[b.civ], mA = mods(A), mB = mods(Bc);
  const fa = fuerzaEf(E, A, a, b, R), fb = fuerzaEf(E, Bc, b, a, R);
  const sA = fb.total / (fa.total + fb.total), media = (a.fuerza + b.fuerza) / 2;
  const lossA = Math.min(a.fuerza, media * BAJAS_RONDA * sA * 2 * mA.bajas * (mA.sinRetirada ? 1.05 : 1)), lossB = Math.min(b.fuerza, media * BAJAS_RONDA * (1 - sA) * 2 * mB.bajas);
  a.fuerza -= lossA; b.fuerza -= lossB; cb.bajas[0] += lossA; cb.bajas[1] += lossB; cb.ronda++;
  const disc = (c) => 1.25 - rv(c, 'disciplina') / 200;
  a.moral -= (sA * 0.38 + mB.terror) * disc(A); b.moral -= ((1 - sA) * 0.38 + mA.terror) * disc(Bc);
  if (fa.emboscada && cb.ronda === 1) { b.moral -= 0.1; A.stats.emboscadas++; } if (fb.emboscada && cb.ronda === 1) { a.moral -= 0.1; Bc.stats.emboscadas++; }
  for (const [ej, c, l] of [[a, A, lossA], [b, Bc, lossB]]) { const rr = relDe(E, A.id, Bc.id); if (rr) rr.bajas[c.id] = (rr.bajas[c.id] || 0) + l; c.stats.bajasSufridas += l; void ej; }
  A.stats.bajasCausadas += lossB; Bc.stats.bajasCausadas += lossA;
  cb.ultima = { fa: fa.f, fb: fb.f, ma: fa.mejor, mb: fb.mejor, ea: fa.emboscada, eb: fb.emboscada };
  // ¿se rompe alguno?
  const rompe = (ej, m) => ej.fuerza < 40 || (!m.sinRetirada && ej.moral < 0.28);
  let perdedor = null;
  if (rompe(a, mA) && rompe(b, mB)) perdedor = a.fuerza / cb.f0[0] < b.fuerza / cb.f0[1] ? a : b;
  else if (rompe(a, mA)) perdedor = a; else if (rompe(b, mB)) perdedor = b;
  else if (cb.ronda >= 4) perdedor = a.fuerza / cb.f0[0] + a.moral < b.fuerza / cb.f0[1] + b.moral ? a : b;
  if (!perdedor) return;
  const ganador = perdedor === a ? b : a, G = E.civs[ganador.civ], P = E.civs[perdedor.civ];
  // persecución: la caballería del ganador cosecha a los que huyen
  const caza = perdedor.fuerza * (0.12 + ganador.comp.cab * 0.4); perdedor.fuerza -= caza; cb.bajas[perdedor === a ? 0 : 1] += caza;
  ganador.moral = Math.min(1.3, ganador.moral + 0.15); perdedor.moral = Math.max(0.15, perdedor.moral); ganador.comb = perdedor.comb = -1; cb.fin = true;
  G.stats.batallasG++; P.stats.batallasP++;
  const rr = relDe(E, A.id, Bc.id); if (rr) rr.batallas = (rr.batallas || 0) + 1;
  const pr = parte(E, 'batalla', cb, ganador, perdedor, G, P);
  const total = cb.bajas[0] + cb.bajas[1];
  log(E, `⚔️ La batalla de ${cb.lugar}: ${G.nombre} derrota a ${P.nombre} (${num(total)} caídos). ${pr.razones[0] ? cap(pr.razones[0]) + '.' : ''}`, 'malo', total > 2500 && R() < 0.5);
  efecto(E, 'fin_batalla', ganador.celda, { comb: cb.id, g: G.id });
  if (!ganador.general && !G.heroe && R() < 0.05) { ganador.general = palabra(R, G.lengua, 2, 3); G.heroe = { nombre: ganador.general, años: 25 + Math.floor(R() * 20) }; log(E, `🗡️ Tras la batalla de ${cb.lugar} se alza el general ${ganador.general} de ${G.nombre}, héroe de su pueblo.`, 'logro', true, G.id); }
  if (perdedor.general && R() < 0.35) { log(E, `☠️ Cae el general ${perdedor.general} de ${P.nombre}.`, 'malo', false); if (P.heroe?.nombre === perdedor.general) P.heroe = null; perdedor.general = null; }
  if (mods(P).mercenarios && R() < 0.4) { perdedor.fuerza *= 0.6; log(E, `💸 Los mercenarios de ${P.nombre} desertan tras la derrota.`, 'malo', false, P.id); }
  if (perdedor.fuerza < 40) muertos.add(perdedor.id); else { perdedor.retirada = 2; perdedor.sitio = -1; perdedor.ruta = null; }
}
function sitio(E, R, ej, o, P, D, muertos) {
  const M = E.mapa, mP = mods(P), mD = mods(D); ej.sitioAños++; o.sitiada = 2;
  // las máquinas golpean la muralla; luego asalto
  const muroBase = (0.25 * o.nivel + (D.tec >= 1250 ? 0.5 : 0) + rv(D, 'ingenieria') / 200) * mD.muralla;
  const golpe = (0.05 + ej.comp.asedio * 1.4 * (0.6 + rv(P, 'ingenieria') / 150) * mP.asedio * Math.sqrt(tecMil(P) / tecMil(D))) * (P.doctrina === 'asedio' ? 1.3 : 1);
  o.muralla = Math.max(0, (o.muralla ?? 1) - golpe);
  const muroEf = 1 + muroBase * o.muralla;
  const monte = M.bioma[o.celda] === B.MONTANA ? 1.3 * mD.defMontana : 1;
  const def = (o.pob * 0.1 + 60) * tecMil(D) * muroEf * (0.7 + rv(D, 'cohesion') / 200 + rv(D, 'fe') / 600) * (o.capital ? 1.25 : 1) * monte * (o.conq && E.año - o.conq < 12 ? 1.6 : 1) * mD.defensa;
  const fe = fuerzaEf(E, P, ej, null, R); let atq = fe.total * (mP.asaltoRapido ? 1.1 : 1);
  if (ej.porMar) atq *= cl((1 - rv(D, 'ciencia') / 220 + rv(P, 'agua') / 400) * mP.desembarco, 0.5, 1.3);
  ej.fuerza *= 0.95; o.pob *= 0.97; ej.ultimoAsalto = { atq, def, muro: o.muralla };
  const rr = relDe(E, P.id, D.id); if (rr) { rr.bajas[P.id] = (rr.bajas[P.id] || 0) + ej.fuerza * 0.05; rr.bajas[D.id] = (rr.bajas[D.id] || 0) + o.pob * 0.03; }
  // terror: ciudades que se rinden al ver llegar al ejército
  if (mP.rendicion && ej.sitioAños === 1 && atq > def * 1.2 && R() < 0.45 + mP.terror) { log(E, `🏳️ Aterrada, ${o.nombre} abre sus puertas a ${P.nombre} sin pelear.`, 'malo', true); caer(E, R, o, ej, P, D, { rendida: true }); return; }
  if (atq > def * (0.85 + R() * 0.6)) { caer(E, R, o, ej, P, D, { muroRoto: o.muralla < 0.35, asaltos: o.asaltos + 1, fe }); return; }
  o.asaltos = (o.asaltos || 0) + 1;
  if (ej.fuerza < 50 || (ej.sitioAños > 4 && atq < def * 0.45)) {
    const razones = [`las murallas de ${o.nombre} resistieron ${o.asaltos} asalto${o.asaltos === 1 ? '' : 's'}`];
    if (ej.hambre > 0.02) razones.push(`${P.nombre} estaba lejos de casa y el hambre diezmó a los sitiadores`);
    if (tecMil(D) > tecMil(P) * 1.2) razones.push(`la técnica de ${D.nombre} superaba a la del sitiador`);
    nuevoParte(E, { tipo: 'asedio', celda: o.celda, lugar: o.nombre, w: D.id, l: P.id, bajas: [0, ej.fuerza0 - ej.fuerza], razones });
    log(E, `🛡️ ${o.nombre} resiste: el sitio de ${P.nombre} fracasa.`, 'bueno', false); muertos.add(ej.id); const casa = ciudadPropiaCercana(E, P.id, ej.celda); if (casa) casa.pob += ej.fuerza * 0.5; D.ex.victorias += 0.15;
  }
}
function lugar(E, celda) { let m = null, md = 1e9; for (const c of E.ciudades) { const d = dist(E.mapa, c.celda, celda); if (d < md) { md = d; m = c; } } const b = BIOMAS[E.mapa.bioma[celda]].n; return md < 4 && m ? m.nombre : esAgua(E.mapa.bioma[celda]) ? 'el mar' : `${b === 'Montaña' ? 'las montañas' : b === 'Bosque' || b === 'Selva' ? 'el bosque' : b === 'Desierto' ? 'las dunas' : 'los llanos'}`; }
function nuevoParte(E, p) { p.id = E.sig.parte++; p.año = E.año; E.partes.unshift(p); if (E.partes.length > 60) E.partes.length = 60; return p; }
// el parte de guerra: qué factores pesaron más a favor del ganador (comparando su desglose con el del perdedor)
function parte(E, tipo, cb, g, p, G, P) {
  const u = cb.ultima, fg = g.id === cb.a ? u.fa : u.fb, fp = g.id === cb.a ? u.fb : u.fa, mejor = g.id === cb.a ? u.ma : u.mb, emb = g.id === cb.a ? u.ea : u.eb;
  const facts = Object.keys(fg).map((k) => [k, fg[k] / Math.max(1e-6, fp[k])]).sort((x, y) => y[1] - x[1]);
  const razones = [], dG = DOCTRINAS[G.doctrina];
  for (const [k, r] of facts) {
    if (r < 1.08 || razones.length >= 3) continue;
    if (k === 'tropas') razones.push(`${G.nombre} llevó ${r.toFixed(1)} veces más soldados`);
    else if (k === 'tecnica') razones.push(`la técnica de ${G.nombre} (${ERAS[G.era].n}) superó a la de ${P.nombre} (${ERAS[P.era].n})`);
    else if (k === 'moral') razones.push(`la moral de ${P.nombre} se quebró antes`);
    else if (k === 'doctrina') razones.push(`la doctrina de ${dG.n.toLowerCase()} de ${G.nombre} funcionó`);
    else if (k === 'terreno') razones.push(emb ? `${G.nombre} emboscó al enemigo en ${BIOMAS[E.mapa.bioma[g.celda]].n.toLowerCase()}` : `el terreno (${BIOMAS[E.mapa.bioma[g.celda]].n.toLowerCase()}) favoreció a ${G.nombre}`);
    else if (k === 'unidades' && mejor) razones.push(`${los(nombreUnidad(mejor[0], G.era, G.bestia))} de ${G.nombre} ${mejor[0] === 'cab' && mejor[1] === 'arq' ? 'flanquearon' : 'desbarataron'} a ${los(nombreUnidad(mejor[1], P.era, P.bestia))} de ${P.nombre}`);
    else if (k === 'logistica') razones.push(`${P.nombre} peleaba lejos de casa: el hambre y la distancia lo debilitaron (−${pct(1 - 1 / r)})`);
    else if (k === 'general') razones.push(`el general ${g.general || 'enemigo'} dirigió a ${G.nombre}`);
    else if (k === 'rasgos') razones.push(`la disciplina y el ímpetu de ${G.nombre} pesaron más`);
  }
  if (fg.tropas < fp.tropas * 0.9 && razones.length) razones[0] = `pese a ser menos, ${razones[0]}`;
  if (!razones.length) razones.push('fue una batalla pareja que se decidió por poco');
  return nuevoParte(E, { tipo, celda: cb.celda, lugar: cb.lugar, w: G.id, l: P.id, bajas: [g.id === cb.a ? cb.bajas[0] : cb.bajas[1], g.id === cb.a ? cb.bajas[1] : cb.bajas[0]], rondas: cb.ronda, razones });
}
function caer(E, R, o, ej, P, D, info = {}) {
  const M = E.mapa, mP = mods(P);
  const pExt = cl(0.03 + rv(P, 'crueldad') / 100 * 0.6 + rv(P, 'agresividad') / 100 * 0.15 - rv(P, 'tolerancia') / 100 * 0.3 - rv(P, 'diplomacia') / 100 * 0.15
    + (P.religion !== D.religion && P.doctrina === 'cruzada' ? 0.15 : 0) + (P.lider.epiteto.includes('Cruel') ? 0.25 : 0), 0.02, 0.9) * (info.rendida ? 0.3 : 1);
  const extermina = !(o.conq && E.año - o.conq < 25) && R() < pExt, eraCapital = o.capital; o.conq = E.año;
  const antes = o.pob, refugio = E.ciudades.filter((x) => x.civ === D.id && x !== o).sort((x, y) => dist(M, x.celda, o.celda) - dist(M, y.celda, o.celda))[0];
  if (extermina) { o.pob *= 0.12; o.fuego = 12; efecto(E, 'caida', o.celda, { arrasada: true, civ: P.id }); log(E, `🔥 ${P.emblema} ${P.nombre} arrasa ${o.nombre}: la ciudad arde y su gente es pasada a cuchillo.`, 'malo', true); }
  else { const queda = 0.6 + rv(P, 'tolerancia') / 100 * 0.3 * mP.asimila; o.pob *= Math.min(0.92, queda); o.fuego = 4; efecto(E, 'caida', o.celda, { civ: P.id }); log(E, `🏳️ ${P.emblema} ${P.nombre} conquista ${o.nombre}, que era de ${D.nombre}.`, 'malo', o.nivel >= 2 || o.capital); }
  if (refugio && antes - o.pob > 100) { const huyen = (antes - o.pob) * (extermina ? 0.25 : 0.4); refugio.pob += huyen; efecto(E, 'refugiados', o.celda, { a: refugio.celda, n: Math.round(huyen), civ: D.id }); }
  if (P.doctrina === 'cruzada' && P.religion !== D.religion) log(E, `🔥 Los fanáticos de ${P.nombre} queman los templos de ${D.religion} en ${o.nombre}.`, 'malo', false, P.id);
  if (info.fe || info.muroRoto || info.asaltos) {
    const razones = [];
    if (info.muroRoto) razones.push(`${los(nombreUnidad('asedio', P.era))} de ${P.nombre} abrieron brecha en la muralla`);
    if (info.asaltos > 1) razones.push(`cayó al asalto número ${info.asaltos}`);
    if (ej.porMar) razones.push(`${P.nombre} desembarcó desde el mar`);
    if (tecMil(P) > tecMil(D) * 1.2) razones.push(`la técnica de ${P.nombre} superaba a la de ${D.nombre}`);
    if (!razones.length) razones.push(`${P.nombre} tenía fuerzas de sobra`);
    nuevoParte(E, { tipo: 'caida', celda: o.celda, lugar: o.nombre, w: P.id, l: D.id, bajas: [ej.fuerza0 - ej.fuerza, antes - o.pob], razones });
  }
  o.civ = P.id; o.capital = false; o.sitiada = 0; o.muralla = 0.3; o.asaltos = 0;
  for (let i = 0; i < M.n; i++) if (E.ciudadDe[i] === o.id) E.dueno[i] = P.id;
  o.pob += ej.fuerza * 0.4; ej.fuerza *= 0.55; ej.sitio = -1; ej.ruta = null; ej.moral = Math.min(1.3, ej.moral + 0.15);
  P.stats.conquistas++; P.stats.asediosG++; D.stats.perdidas++; P.lider.hazañas = (P.lider.hazañas || 0) + 1; P.ex.victorias += 0.3; D.ex.derrotas += 0.3; D.ex.desastre += 0.15;
  const rr = relDe(E, P.id, D.id); if (rr) { rr.ciudadesTomadas = rr.ciudadesTomadas || {}; rr.ciudadesTomadas[P.id] = (rr.ciudadesTomadas[P.id] || 0) + 1; rr.cans[D.id] = (rr.cans[D.id] || 0) + 0.18; }
  if (extermina && o.pob < 80) destruir(E, o);
  const quedan = E.ciudades.filter((c) => c.civ === D.id);
  if (!quedan.length) { extinguir(E, D, extermina ? 'exterminada' : 'conquistada', P); return; }
  if (eraCapital) {
    const n = quedan.reduce((m, c) => (c.pob > m.pob ? c : m)); n.capital = true; D.capital = n.id; D.r.cohesion = Math.max(0, D.r.cohesion - 12);
    crono(E, D, `🔥 Cae la capital ${o.nombre} ante ${P.nombre}`);
    log(E, `👑 Cae la capital de ${D.nombre}. La corte huye a ${n.nombre}.`, 'malo', true, D.id);
  }
}
function destruir(E, o) {
  E.ciudades = E.ciudades.filter((c) => c !== o);
  for (let i = 0; i < E.mapa.n; i++) if (E.ciudadDe[i] === o.id) { E.dueno[i] = -1; E.ciudadDe[i] = -1; }
  for (const e of E.ejercitos) if (e.sitio === o.id) e.sitio = -1;
  E.ruinas.push({ celda: o.celda, nombre: o.nombre, año: E.año }); if (E.ruinas.length > 30) E.ruinas.shift();
  log(E, `🏚️ De ${o.nombre} solo quedan ruinas.`, 'malo', false);
}

// ---------------------------------------------------------------- monstruos (de los poderes): neutrales, atacan lo que tengan cerca
function monstruos(E, R) {
  const M = E.mapa;
  for (const mo of E.monstruos) {
    mo.años--; mo.tray = [mo.celda];
    const agua = mo.tipo === 'kraken';
    let obj = null, md = 1e9; for (const c of E.ciudades) { if (agua && !M.costaAdj[c.celda]) continue; const d = dist(M, c.celda, mo.celda); if (d < md) { md = d; obj = c; } }
    for (let s = 0; s < 2 && obj && md > 1.2; s++) {
      let mj = -1, mb = 1e9; for (const j of M.vec[mo.celda]) { if (agua !== esAgua(M.bioma[j])) continue; const d = dist(M, j, obj.celda); if (d < mb) { mb = d; mj = j; } }
      if (mj < 0) break; mo.celda = mj; mo.tray.push(mj); md = mb;
    }
    if (obj && md <= 1.6) { obj.pob *= 0.88; obj.fuego = Math.max(obj.fuego, 3); mo.ataca = obj.id; if (R() < 0.25) log(E, `${mo.tipo === 'kraken' ? '🐙 El kraken' : '🐉 El dragón'} ataca ${obj.nombre}.`, 'malo', false); } else mo.ataca = -1;
    for (const ej of E.ejercitos) {
      if (dist(M, ej.celda, mo.celda) > 1.6) continue; const c = E.civs[ej.civ];
      const daño = fuerzaEf(E, c, ej, null, R).total * 0.3; mo.hp -= daño; ej.fuerza *= 0.85; mo.peleando = ej.id;
      if (mo.hp <= 0) { const quien = ej.general || palabra(R, c.lengua, 2, 3); log(E, `🗡️ ${quien}, de ${c.nombre}, mata ${mo.tipo === 'kraken' ? 'al kraken' : 'al dragón'}. Su nombre será leyenda.`, 'logro', true, c.id); crono(E, c, `🐉 ${quien} mata ${mo.tipo === 'kraken' ? 'al kraken' : 'al dragón'}`); c.ex.victorias += 0.5; efecto(E, 'monstruo_muere', mo.celda); break; }
    }
  }
  E.monstruos = E.monstruos.filter((m) => { if (m.hp > 0 && m.años <= 0) { log(E, `${m.tipo === 'kraken' ? '🐙 El kraken se hunde' : '🐉 El dragón se marcha'} para siempre.`, '', false); efecto(E, 'monstruo_muere', m.celda, { se_va: true }); } return m.hp > 0 && m.años > 0; });
}

// ---------------------------------------------------------------- eventos
const PESTES = ['la Peste Negra', 'la Fiebre Gris', 'el Mal Rojo', 'la Tos de Ceniza', 'la Plaga Sudorosa', 'la Viruela Pálida', 'el Gran Contagio'];
function plaga(E, R, c, nombre = null) {
  c.plaga = { nombre: nombre || elige(R, PESTES), años: 2 + Math.floor(R() * 5), sev: (0.04 + R() * 0.07) * Math.max(0.3, 1 - c.era * 0.1) * (1.25 - rv(c, 'ciencia') / 160) * (1.4 - rv(c, 'salud') / 100) * mods(c).plagaSev };
  log(E, `☣️ ${c.plaga.nombre} azota a ${c.nombre}.`, 'malo', true, c.id); c.ex.desastre += 0.5 * mods(c).desastre; efecto(E, 'plaga', E.ciudades.find((x) => x.id === c.capital)?.celda ?? 0);
}
function eventos(E, R) {
  for (const c of E.civs) {
    if (!c.vivo) continue;
    const m = mods(c), mias = E.ciudades.filter((x) => x.civ === c.id), socios = Object.values(E.rel).filter((r) => (r.a === c.id || r.b === c.id) && (r.comercio || r.estado === 'guerra'));
    if (c.plaga) {
      for (const x of mias) x.pob *= 1 - c.plaga.sev;
      for (const r of socios) { const o = E.civs[r.a === c.id ? r.b : r.a]; if (o.vivo && !o.plaga && !o.inmune && R() < 0.12 * (1.3 - rv(o, 'salud') / 150)) plaga(E, R, o, c.plaga.nombre); }
      if (--c.plaga.años <= 0) { log(E, `${c.emblema} ${c.nombre} supera ${c.plaga.nombre}.`, '', false, c.id); c.plaga = null; c.inmune = 25; }
    } else if (c.inmune > 0) c.inmune--;
    else if (R() < (0.0015 + Math.min(0.004, c.pob / 2e6) + socios.length * 0.0008) * (1.3 - rv(c, 'ciencia') / 125) * (1.3 - rv(c, 'salud') / 150)) plaga(E, R, c);
    const sobre = mias.filter((x) => x.pob > x.cap * 1.02).length;
    if (mias.length && (R() < 0.0025 || (sobre / mias.length > 0.6 && R() < 0.02))) {
      for (const x of mias) x.pob *= 0.86; c.ex.desastre += 0.3 * m.desastre; c.r.cohesion = Math.max(0, c.r.cohesion - 3);
      log(E, `🌾 Hambruna en ${c.nombre}: los graneros se vacían.`, 'malo', false, c.id);
    }
    if (!c.oro && guerrasDe(E, c.id).length === 0 && R() < 0.003 * (rv(c, 'cohesion') / 60) * (1 + c.ex.prosperidad) * m.oro) {
      c.oro = 30 + Math.floor(R() * 30); crono(E, c, `✨ Edad de oro bajo ${c.lider.nombre} ${c.lider.epiteto}`); log(E, `✨ Comienza la edad de oro de ${c.nombre} bajo ${c.lider.nombre} ${c.lider.epiteto}.`, 'logro', true, c.id);
    }
    // traición de un general: lealtad baja + guerra
    if (rv(c, 'lealtad') < 35 && R() < 0.004) { const en = E.ejercitos.filter((e) => e.civ === c.id && e.comb < 0); if (en.length) { const ej = en[0], Q = E.civs[ej.enemigo]; if (Q?.vivo) { cambiarBando(E, ej, Q, c); log(E, `🗡️ Un general desleal de ${c.nombre} se pasa a ${Q.nombre} con ${num(ej.fuerza)} soldados.`, 'malo', true, c.id); } } }
    const coh = rv(c, 'cohesion');
    if (m.cisma > 0 && mias.length >= 4 && coh < 30 && E.año - (c.ultCisma ?? c.nacio) > 150 && R() < (0.001 + (30 - coh) / 30 * 0.01) * m.cisma * (1.5 - rv(c, 'lealtad') / 100)) { c.ultCisma = E.año; cisma(E, R, c, mias); }
  }
}
function cisma(E, R, c, mias, forzado = false) {
  const M = E.mapa, capi = mias.find((x) => x.capital) || mias[0];
  if (E.civs.filter((x) => x.vivo).length >= MAX_CIVS + 1) { for (const x of mias) x.pob *= 0.9; c.r.cohesion += 6; log(E, `🔥 Revueltas en ${c.nombre}; la corona las ahoga en sangre.`, 'malo', false, c.id); return false; }
  const semilla = mias.reduce((m, x) => (dist(M, x.celda, capi.celda) > dist(M, m.celda, capi.celda) ? x : m));
  const rebeldes = mias.filter((x) => x !== capi && dist(M, x.celda, semilla.celda) < dist(M, x.celda, capi.celda));
  if (!rebeldes.length || rebeldes.length >= mias.length) return false;
  const dx = M.x[semilla.celda] - M.x[capi.celda], dz = M.z[semilla.celda] - M.z[capi.celda];
  const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'del Este' : 'del Oeste') : dz > 0 ? 'del Sur' : 'del Norte';
  const base = c.nombre.split(' ').slice(-1)[0], r = {};
  for (const k of CLAVES) r[k] = Math.round(cl((c.r[k] ?? 50) + (R() - 0.5) * 26)); r.cohesion = 62; r.agresividad = cl(r.agresividad + 10);
  const usados = new Set(E.civs.filter((x) => x.vivo).map((x) => x.color)), color = COLORES_EXTRA.find((x) => !usados.has(x)) || COLORES_EXTRA[E.civs.length % COLORES_EXTRA.length];
  const esp = (c.esp || []).slice(0, 1);
  const n = nuevaCiv(E, R, { nombre: elige(R, ['Reino', 'Liga', 'Señorío', 'Confederación', 'Sultanato', 'Principado']) + ` ${base} ${dir}`, color, emblema: elige(R, ['🦅', '🐺', '🌙', '🐉', '👁️', '🦁']), r, lengua: c.lengua + 1, padre: c.id, esp, doctrina: doctrinaDe(r, esp), estilo: c.estilo, arquetipo: c.arquetipo });
  n.tec = c.tec * 0.95; n.era = c.era; n.desc = c.desc; n.zona = c.zona; n.bestia = c.bestia;
  n.religion = rv(c, 'fe') > 55 ? `los ${palabra(R, n.lengua, 2, 2).toLowerCase()}istas (cisma de ${c.religion.replace(/^(el|la|los) /, '')})` : c.religion;
  for (const x of rebeldes) { x.civ = n.id; x.capital = false; } semilla.capital = true; n.capital = semilla.id;
  for (let i = 0; i < M.n; i++) { const ci = E.ciudadDe[i]; if (rebeldes.some((x) => x.id === ci)) E.dueno[i] = n.id; }
  const fuera = new Set(E.ejercitos.filter((e) => e.civ === c.id && rebeldes.some((x) => dist(M, x.celda, e.celda) < 3)).map((e) => e.id));
  E.ejercitos = E.ejercitos.filter((e) => !fuera.has(e.id)); E.combates = E.combates.filter((x) => !fuera.has(x.a) && !fuera.has(x.b)); for (const e of E.ejercitos) if (e.comb >= 0 && !E.combates.some((x) => x.id === e.comb)) e.comb = -1;
  c.r.cohesion = cl(c.r.cohesion + 18); c.ex.desastre += 0.3;
  for (const r2 of Object.values(E.rel)) { if (r2.a !== c.id && r2.b !== c.id) continue; const o = r2.a === c.id ? r2.b : r2.a; const k = clave(n.id, o); E.rel[k] = { contacto: E.año - 20, a: Math.min(n.id, o), b: Math.max(n.id, o), v: r2.v * 0.5, estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: 0, ultimaGuerra: E.año }; }
  const rel = { contacto: E.año - 20, a: c.id, b: n.id, v: -40, estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: 0, ultimaGuerra: E.año };
  E.rel[clave(c.id, n.id)] = rel;
  crono(E, c, `⚡ Se separan ${rebeldes.length} ciudades: nace ${n.nombre}`); crono(E, n, `⚡ Nace al separarse de ${c.nombre}`);
  if (rv(c, 'diplomacia') > 62 && !forzado) { rel.v = 0; rel.tregua = E.año + 30; log(E, `📜 ${rebeldes.length} ciudades de ${c.nombre} se independizan en paz: nace ${n.emblema} ${n.nombre}.`, 'logro', true, n.id); }
  else { log(E, `⚡ ¡Guerra civil en ${c.nombre}! ${rebeldes.length} ciudades se alzan y nace ${n.emblema} ${n.nombre}.`, 'malo', true, n.id); declarar(E, c, n, rel, true); }
  return true;
}

// ---------------------------------------------------------------- limpieza, fin y muestreo
function limpiar(E) {
  for (const c of E.civs) if (c.vivo && !E.ciudades.some((x) => x.civ === c.id)) extinguir(E, c, 'extinguida');
  for (const c of E.civs) if (c.vivo && !E.ciudades.some((x) => x.id === c.capital && x.civ === c.id)) { const m = E.ciudades.filter((x) => x.civ === c.id).sort((p, q) => q.pob - p.pob)[0]; if (m) { E.ciudades.forEach((x) => { if (x.civ === c.id) x.capital = false; }); m.capital = true; c.capital = m.id; } }
}
function comprobarFin(E) {
  const vivas = E.civs.filter((c) => c.vivo); if (E.fin) return;
  if (vivas.length === 1) { E.fin = { tipo: 'unica', ganador: vivas[0].id, año: E.año }; log(E, `🏆 ${vivas[0].emblema} ${vivas[0].nombre} es la única civilización que queda en el orbe.`, 'logro', true); return; }
  if (vivas.length === 0) { E.fin = { tipo: 'nadie', ganador: -1, año: E.año }; log(E, '🌑 No queda nadie en el orbe.', 'malo', true); return; }
  if (E.año < Math.max(E.velo, 200) + 100) return;
  const tot = vivas.reduce((s, c) => s + c.pob, 0), top = vivas.reduce((m, c) => (c.pob > m.pob ? c : m));
  const seg = vivas.filter((c) => c !== top).reduce((m, c) => Math.max(m, c.pob), 0);
  if (top.pob / tot > 0.65 && top.pob > seg * 2.5) { if (E.domina.id === top.id) E.domina.años++; else E.domina = { id: top.id, años: 1 }; } else E.domina = { id: -1, años: 0 };
  if (E.año >= E.velo + 2000) { const w = vivas.reduce((m, c) => (c.poder > m.poder ? c : m)); E.fin = { tipo: 'tiempo', ganador: w.id, año: E.año }; log(E, `🏆 Tras dos mil años de historia compartida, ${w.emblema} ${w.nombre} es la potencia del orbe.`, 'logro', true); return; }
  if (E.domina.años >= 50) { E.fin = { tipo: 'domina', ganador: top.id, año: E.año }; log(E, `🏆 ${top.emblema} ${top.nombre} domina el orbe: ${Math.round(top.pob / tot * 100)} % de toda la gente vive bajo su bandera.`, 'logro', true); }
}
function muestrear(E) {
  const p = {}, w = {}; for (const c of E.civs) if (c.vivo) { p[c.id] = Math.round(c.pob); w[c.id] = Math.round(poderCiv(c)); }
  E.hist.push({ a: E.año, p, w });
  if (E.hist.length > 300) E.hist = E.hist.filter((_, i) => i % 2 === 0 || i === E.hist.length - 1);
}

// ---------------------------------------------------------------- poderes del espíritu del orbe
// devuelve null si se aplicó, o un texto con el motivo si no
export function puedePoder(E, tipo, celda) {
  const P = PODERES[tipo]; if (!P) return 'Poder desconocido.';
  if ((E.poderes.energia ?? 0) < P.costo) return `Falta energía: necesitas ${P.costo} y el orbe tiene ${Math.floor(E.poderes.energia)}.`;
  const M = E.mapa; if (celda == null || celda < 0 || celda >= M.n) return 'Toca un lugar dentro del orbe.';
  const b = M.bioma[celda];
  if (P.obj === 'tierra' && esAgua(b)) return 'Este poder se usa sobre tierra.';
  if (P.obj === 'agua' && !esAgua(b)) return 'Este poder se usa sobre el mar.';
  if (P.obj === 'civ' || P.obj === 'guerra') { const c = civEn(E, celda); if (!c) return 'Toca el territorio de una civilización.'; if (P.obj === 'guerra' && !guerrasDe(E, c.id).length) return `${c.nombre} no está en guerra.`; }
  return null;
}
export function civEn(E, celda) { const M = E.mapa; if (E.dueno[celda] >= 0 && E.civs[E.dueno[celda]].vivo) return E.civs[E.dueno[celda]]; let m = null, md = 3.5; for (const c of E.ciudades) { const d = dist(M, c.celda, celda); if (d < md) { md = d; m = E.civs[c.civ]; } } return m; }
function cambiarBioma(E, i, b, rio = 0) { E.mapa.bioma[i] = b; E.mapa.rio[i] = rio; E.mods[i] = rio ? [b, 1] : b; }
export function usarPoder(E, tipo, celda) {
  const err = puedePoder(E, tipo, celda); if (err) return err;
  const P = PODERES[tipo], M = E.mapa, R = azar(hash(E.semilla + 77, E.año * 31 + celda + tipo.length * 977)), c = civEn(E, celda), area = P.radio ? celdasEn(M, celda, P.radio) : [];
  E.poderes.energia -= P.costo; E.poderes.usados = (E.poderes.usados || 0) + 1;
  const ciudadesArea = P.radio ? E.ciudades.filter((x) => dist(M, x.celda, celda) <= P.radio + 0.5) : [];
  const L = (t, tipoLog = 'malo') => log(E, `${P.e} ${t}`, tipoLog, true, c?.id ?? null);
  const zona = (mult, años, extra = {}) => E.zonas.push({ tipo, celda, r: P.radio, mult, hasta: E.año + años, ...extra });
  let cambioMapa = false;
  switch (tipo) {
    case 'lluvia': zona(1.45, 30); E.zonas = E.zonas.filter((z) => !(z.tipo === 'incendio' && dist(M, z.celda, celda) < P.radio + z.r)); L(`Lluvias generosas caen durante años sobre ${lugar(E, celda)}.`, 'bueno'); break;
    case 'sequia': zona(0.45, 20); L(`Una gran sequía seca ${lugar(E, celda)}.`); break;
    case 'terremoto':
      for (const x of E.ciudades) { const d = dist(M, x.celda, celda); if (d < P.radio) { x.pob *= 0.6 + d / P.radio * 0.35; x.muralla = Math.min(x.muralla ?? 1, d / P.radio); x.fuego = Math.max(x.fuego, d < 3 ? 3 : 0); } }
      if (c) { c.r.cohesion = cl(c.r.cohesion - 8); c.ex.desastre += 0.4; } L(`Un terremoto sacude ${lugar(E, celda)}: caen casas y murallas.`); break;
    case 'volcan':
      for (const i of area) { const d = dist(M, i, celda); cambiarBioma(E, i, d < 1 ? B.MONTANA : B.DESIERTO); M.a[i] = Math.max(M.a[i], d < 1 ? 0.95 : 0.3); }
      for (const x of ciudadesArea) { x.pob *= 0.15; x.fuego = 10; if (x.pob < 80) destruir(E, x); }
      zona(1.5, 120, { r: P.radio + 3, ceniza: true }); cambioMapa = true; L(`Nace un volcán en ${lugar(E, celda)}; la ceniza fertilizará las tierras vecinas.`); break;
    case 'tsunami':
      for (const x of E.ciudades) if (M.costaAdj[x.celda] && dist(M, x.celda, celda) < P.radio) { x.pob *= 0.55; x.fuego = Math.max(x.fuego, 2); }
      E.ejercitos = E.ejercitos.filter((e) => !(esAgua(M.bioma[e.celda]) && dist(M, e.celda, celda) < P.radio + 2)); L(`Un tsunami barre las costas de ${lugar(E, celda)} y hunde las flotas.`); break;
    case 'glaciacion': for (const i of area) if (!esAgua(M.bioma[i])) cambiarBioma(E, i, dist(M, i, celda) < 2 ? B.NIEVE : B.TUNDRA); cambioMapa = true; L(`El hielo cubre ${lugar(E, celda)} para siempre.`); break;
    case 'incendio':
      for (const i of area) if (M.bioma[i] === B.BOSQUE || M.bioma[i] === B.SELVA) cambiarBioma(E, i, B.PRADERA);
      for (const x of ciudadesArea) { x.pob *= 0.85; x.fuego = Math.max(x.fuego, 4); } for (const e of E.ejercitos) if (dist(M, e.celda, celda) < P.radio) e.fuerza *= 0.7;
      zona(1, 6, { incendio: true }); cambioMapa = true; L(`Un incendio devora los bosques de ${lugar(E, celda)}.`); break;
    case 'fertil': for (const i of area) if (!esAgua(M.bioma[i]) && M.bioma[i] !== B.MONTANA) cambiarBioma(E, i, B.PRADERA, dist(M, i, celda) < 1.2 ? 1 : M.rio[i]); cambioMapa = true; L(`La tierra de ${lugar(E, celda)} se vuelve fértil.`, 'bueno'); break;
    case 'plaga': if (c.plaga) { E.poderes.energia += P.costo; return `${c.nombre} ya sufre una plaga.`; } plaga(E, R, c, 'la Plaga del Orbe'); break;
    case 'curacion': c.plaga = null; c.inmune = 40; for (const x of E.ciudades) if (x.civ === c.id) x.pob *= 1.1; L(`Una ola de salud recorre ${c.nombre}.`, 'bueno'); break;
    case 'cosecha': c.oro = Math.max(c.oro, 40); for (const x of E.ciudades) if (x.civ === c.id) x.pob *= 1.15; c.r.cohesion = cl(c.r.cohesion + 10); L(`El espíritu del orbe bendice a ${c.nombre}: comienza su edad de oro.`, 'logro'); crono(E, c, '🌟 Bendecida por el orbe'); break;
    case 'natalidad': for (const x of E.ciudades) if (x.civ === c.id) x.pob *= 1.25; c.r.fertilidad = cl(c.r.fertilidad + 10); L(`Explosión de nacimientos en ${c.nombre}.`, 'bueno'); break;
    case 'langostas': zona(0.35, 10); for (const x of ciudadesArea) x.pob *= 0.85; L(`Nubes de langostas devoran las cosechas de ${lugar(E, celda)}.`); break;
    case 'monstruo': {
      const kraken = esAgua(M.bioma[celda]), era = Math.max(0, ...E.civs.filter((x) => x.vivo).map((x) => x.era));
      E.monstruos.push({ id: E.sig.mon++, tipo: kraken ? 'kraken' : 'dragon', celda, hp: 2500 + era * 2200, hp0: 2500 + era * 2200, años: 35, tray: [celda], ataca: -1 });
      L(kraken ? `Un kraken emerge de las profundidades cerca de ${lugar(E, celda)}.` : `Un dragón despierta en ${lugar(E, celda)}.`); break;
    }
    case 'genio': c.tec += Math.max(120, c.tec * 0.12); c.r.ciencia = cl(c.r.ciencia + 10); L(`Nace un genio en ${c.nombre}: ${palabra(R, c.lengua, 2, 3)} cambia la forma de pensar de su pueblo.`, 'logro'); crono(E, c, '💡 Nace un genio'); break;
    case 'profeta': { const prof = palabra(R, c.lengua, 2, 3); c.religion = `la revelación de ${prof}`; c.r.fe = cl(c.r.fe + 20); c.r.cohesion = cl(c.r.cohesion + 15); for (const r of Object.values(E.rel)) if (r.a === c.id || r.b === c.id) r.v = cl(r.v - 15, -100, 100); L(`El profeta ${prof} funda ${c.religion} en ${c.nombre}.`, 'logro'); crono(E, c, `📿 El profeta ${prof} funda una fe`); break; }
    case 'fanatismo': c.r.agresividad = cl(c.r.agresividad + 20); c.r.fe = cl(c.r.fe + 20); for (const r of Object.values(E.rel)) if (r.a === c.id || r.b === c.id) r.v = cl(r.v - 25, -100, 100); L(`El fanatismo se apodera de ${c.nombre}: quieren guerra santa.`); break;
    case 'discordia': { const mias = E.ciudades.filter((x) => x.civ === c.id); if (mias.length < 3) { E.poderes.energia += P.costo; return `${c.nombre} necesita al menos 3 ciudades para dividirse.`; } if (!cisma(E, R, c, mias, true)) { E.poderes.energia += P.costo; return 'No se pudo dividir (demasiadas civilizaciones o ciudades muy juntas).'; } break; }
    case 'paz': { let n = 0; for (const o of guerrasDe(E, c.id)) { const r = relDe(E, c.id, o); disolver(E, c.id, o); r.estado = 'paz'; r.tregua = E.año + 40; r.v = 10; r.cans = {}; r.ultimaGuerra = E.año; n++; } for (const r of Object.values(E.rel)) if ((r.a === c.id || r.b === c.id) && r.estado === 'paz') r.tregua = Math.max(r.tregua, E.año + 40); L(n ? `Una paz inexplicable detiene ${n} guerra${n > 1 ? 's' : ''} de ${c.nombre}.` : `${c.nombre} queda en paz con todos por cuarenta años.`, 'bueno'); break; }
    case 'traicion': { const mios = E.ejercitos.filter((e) => e.civ === c.id); if (!mios.length) { E.poderes.energia += P.costo; return `${c.nombre} no tiene ejércitos en campaña.`; } const ej = mios.reduce((a, b) => (a.fuerza > b.fuerza ? a : b)), Q = E.civs[ej.enemigo]; if (ej.comb >= 0) { E.combates = E.combates.filter((x) => x.id !== ej.comb); for (const e of E.ejercitos) if (e.comb === ej.comb) e.comb = -1; } cambiarBando(E, ej, Q, c); L(`El general de ${c.nombre} traiciona a su pueblo y lleva ${num(ej.fuerza)} soldados a ${Q.nombre}.`); break; }
    case 'heroe': { const nom = palabra(R, c.lengua, 2, 3); c.heroe = { nombre: nom, años: 60, leyenda: true }; const mios = E.ejercitos.filter((e) => e.civ === c.id); if (mios.length) { const ej = mios.reduce((a, b) => (a.fuerza > b.fuerza ? a : b)); ej.general = nom; ej.leyenda = true; ej.moral = Math.min(1.3, ej.moral + 0.3); } L(`Nace ${nom}, héroe legendario de ${c.nombre}.`, 'logro'); crono(E, c, `🦸 Héroe legendario: ${nom}`); break; }
    case 'meteorito':
      for (const i of celdasEn(M, celda, 2.2)) if (!esAgua(M.bioma[i])) cambiarBioma(E, i, dist(M, i, celda) < 1 ? B.MONTANA : B.DESIERTO);
      for (const x of E.ciudades.filter((x) => dist(M, x.celda, celda) < 2.6)) { x.pob *= 0.08; x.fuego = 10; if (x.pob < 80) destruir(E, x); }
      E.ejercitos = E.ejercitos.filter((e) => dist(M, e.celda, celda) > 2.6); cambioMapa = true; L(`Un meteorito cae cerca de ${lugar(E, celda)}.`); break;
    case 'eclipse': c.r.cohesion = cl(c.r.cohesion - 15 * mods(c).desastre); c.r.fe = cl(c.r.fe + 10); for (const e of E.ejercitos) if (e.civ === c.id) e.moral = Math.max(0.15, e.moral - 0.4); L(`Un eclipse oscurece el cielo de ${c.nombre}: sus ejércitos huyen de pánico.`); break;
    case 'senal': {
      let o = null, md = 1e9; const cap1 = E.ciudades.find((x) => x.id === c.capital);
      for (const x of E.civs) if (x.vivo && x !== c) { const cx = E.ciudades.find((y) => y.id === x.capital); if (!cx || !cap1) continue; const d = dist(M, cx.celda, cap1.celda); if (d < md) { md = d; o = x; } }
      if (!o) { E.poderes.energia += P.costo; return 'No hay otro pueblo con quien unirlo.'; }
      let r = relDe(E, c.id, o.id); if (!r) r = E.rel[clave(c.id, o.id)] = { contacto: E.año - 20, a: Math.min(c.id, o.id), b: Math.max(c.id, o.id), v: 0, estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: 0, ultimaGuerra: E.año };
      if (r.estado === 'guerra') disolver(E, c.id, o.id); r.estado = 'alianza'; r.v = 80; r.senor = -1; r.tregua = E.año + 50; r.cans = {};
      efecto(E, 'senal', cap1.celda, { a: c.id, b: o.id, otra: E.ciudades.find((y) => y.id === o.capital)?.celda });
      L(`Un arcoíris une ${c.nombre} y ${o.nombre}: juran alianza eterna.`, 'logro'); crono(E, c, `🌈 Alianza divina con ${o.nombre}`); crono(E, o, `🌈 Alianza divina con ${c.nombre}`); break;
    }
    case 'isla': for (const i of area) { const d = dist(M, i, celda); if (esAgua(M.bioma[i])) { cambiarBioma(E, i, d < 1.2 ? B.BOSQUE : d < 1.8 ? B.PRADERA : B.PLAYA); M.a[i] = Math.max(M.a[i], 0.08 + (P.radio - d) * 0.06); } } cambioMapa = true; L(`Una isla emerge del mar cerca de ${lugar(E, celda)}.`, 'logro'); break;
    case 'estrecho': for (const i of area) { cambiarBioma(E, i, B.COSTA); M.a[i] = -0.1; } for (const x of ciudadesArea) if (esAgua(M.bioma[x.celda])) destruir(E, x); cambioMapa = true; L(`La tierra se hunde y el mar abre un estrecho en ${lugar(E, celda)}.`); break;
    case 'sembrar': for (const i of area) if (!esAgua(M.bioma[i]) && M.bioma[i] !== B.MONTANA && M.bioma[i] !== B.NIEVE) cambiarBioma(E, i, M.temp[i] > 0.6 ? B.SELVA : B.BOSQUE, M.rio[i]); cambioMapa = true; L(`Crece un bosque nuevo en ${lugar(E, celda)}.`, 'bueno'); break;
    case 'regalo': { const sig = ERAS[c.era + 1]; c.tec = sig ? Math.max(c.tec, sig.tec + 1) : c.tec * 1.2; L(`El orbe le susurra secretos a ${c.nombre}.`, 'logro'); crono(E, c, '📜 Recibe saber del orbe'); break; }
    default: E.poderes.energia += P.costo; return 'Poder desconocido.';
  }
  if (cambioMapa) { recalcularMapa(M); for (const x of [...E.ciudades]) if (esAgua(M.bioma[x.celda])) destruir(E, x); for (let i = 0; i < M.n; i++) if (M.bioma[i] === B.MAR && E.dueno[i] >= 0) { E.dueno[i] = -1; E.ciudadDe[i] = -1; } E.verMapa = (E.verMapa || 0) + 1; }
  efecto(E, `poder_${tipo}`, celda, { radio: P.radio, civ: c?.id ?? null });
  limpiar(E);
  return null;
}

// ---------------------------------------------------------------- guardar y cargar (con migración de la versión 1)
export function exportar(E) { const { mapa, ...resto } = E; void mapa; return JSON.parse(JSON.stringify(resto, (k, v) => (k.startsWith('_') ? undefined : v))); }
export function importar(o) {
  if (!o || !Array.isArray(o.civs)) return null;
  if (o.v === 1) migrarV1(o); else if (o.v !== 2) return null;
  o.mapa = generarMapa(o.semilla, o.tipo, o.mods || {}); if (o.dueno.length !== o.mapa.n) return null;
  return o;
}
function migrarV1(o) {
  for (const c of o.civs) {
    for (const k of CLAVES) { if (c.r[k] == null) c.r[k] = 50; if (c.r0[k] == null) c.r0[k] = 50; }
    c.esp = []; c.doctrina = doctrinaDe(c.r0, []); c.estilo = 'piedra'; c.bestia = null; c.rh = c.rh || [];
    Object.assign(c.stats, { asediosG: 0, emboscadas: 0, bajasCausadas: 0, bajasSufridas: 0, ...c.stats });
  }
  for (const e of o.ejercitos) { const c = o.civs[e.civ]; e.comb = -1; e.mov = 0; e.fuerza0 = e.fuerza; e.comp = composicion(c); e.doc = c.doctrina; e.era = c.era; e.bestia = null; }
  for (const x of o.ciudades) { x.muralla = 1; x.asaltos = 0; }
  Object.assign(o, { combates: [], partes: [], monstruos: [], zonas: [], v: 2 });
  o.poderes = { energia: Math.min(100, 40 + (o.poderes?.cargas || 0) * 15), max: ENERGIA_MAX, usados: 0 };
  Object.assign(o.sig, { comb: 0, parte: 0, mon: 0 });
}
export function avanzar(E, años) { for (let i = 0; i < años; i++) paso(E); return E; }
