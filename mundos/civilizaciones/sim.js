// =====================================================================
// Civilizaciones — simulación PURA (sin three ni DOM) y determinista con semilla.
// Un paso = un año. El estado E es JSON salvo E.mapa, que se regenera desde la semilla al cargar
// (así el guardado pesa poco y el mapa nunca se desincroniza).
// Idea central: cada civilización nace con rasgos elegidos (r0) que son su identidad; los rasgos
// actuales (r) derivan hacia un "objetivo" que mezcla esa identidad con lo que le pasa (entorno,
// guerras, plagas, prosperidad). Así lo que eliges importa, pero la historia también.
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';

export const TAM = 1.1, PASO = Math.sqrt(3) * TAM, RMAPA = 43;
export const B = { MAR: 0, COSTA: 1, PLAYA: 2, PRADERA: 3, BOSQUE: 4, SELVA: 5, DESIERTO: 6, TUNDRA: 7, MONTANA: 8, NIEVE: 9 };
export const BIOMAS = [
  { n: 'Mar', c: '#1d4f7a' }, { n: 'Costa', c: '#3f8fb0' }, { n: 'Playa', c: '#e3d29a' }, { n: 'Pradera', c: '#8cb85a' }, { n: 'Bosque', c: '#3f7a3a' },
  { n: 'Selva', c: '#2d6b35' }, { n: 'Desierto', c: '#dcb56a' }, { n: 'Tundra', c: '#9fac92' }, { n: 'Montaña', c: '#8a8378' }, { n: 'Nieve', c: '#eef2f5' },
];
const COMIDA = [0, 1.0, 1.2, 3, 2, 2.2, 0.5, 0.8, 0.6, 0.15];
const esAgua = (b) => b <= 1;

export const RASGOS = [
  ['agresividad', 'Agresividad', '⚔️'], ['ciencia', 'Ciencia', '🔬'], ['fe', 'Fe', '🙏'], ['comercio', 'Comercio', '💰'],
  ['expansion', 'Expansión', '🧭'], ['fertilidad', 'Fertilidad', '👶'], ['cohesion', 'Cohesión', '🤝'], ['diplomacia', 'Diplomacia', '🕊️'],
  ['calor', 'Adapt. al calor', '🔥'], ['frio', 'Adapt. al frío', '❄️'], ['agua', 'Adapt. al agua', '🌊'],
];
export const ERAS = [
  { n: 'Edad de Piedra', tec: 0, e: '🪨' }, { n: 'Edad del Bronce', tec: 150, e: '🔔' }, { n: 'Edad del Hierro', tec: 450, e: '⚒️' },
  { n: 'Edad Media', tec: 1000, e: '🏰' }, { n: 'Era de la Pólvora', tec: 2000, e: '💥' }, { n: 'Era Industrial', tec: 3600, e: '🏭' }, { n: 'Era Moderna', tec: 6000, e: '🚀' },
];
const DESC = [['la agricultura', 30], ['la cerámica', 70], ['la rueda', 110], ['la escritura', 220], ['la navegación', 300], ['los acueductos', 600], ['la filosofía', 750],
  ['la moneda', 850], ['los castillos', 1250], ['la astronomía', 1500], ['la imprenta', 1750], ['la brújula', 2150], ['los cañones', 2400], ['la banca', 2700],
  ['el método científico', 3100], ['la máquina de vapor', 3800], ['el ferrocarril', 4300], ['la electricidad', 5000], ['la aviación', 6500], ['la computación', 8000], ['la energía atómica', 9500]];
export const NIVELES = ['Aldea', 'Pueblo', 'Ciudad', 'Metrópolis'];
const nivelDe = (p) => (p < 1000 ? 0 : p < 4000 ? 1 : p < 11000 ? 2 : 3);

// presets divertidos (la interfaz los ofrece; también sirven para las pruebas)
export const PRESETS = {
  guerrero: { nombre: 'Imperio de Karth', emblema: '⚔️', color: '#c0392b', t: 'Imperio guerrero', r: { agresividad: 88, ciencia: 40, fe: 45, comercio: 30, expansion: 75, fertilidad: 62, cohesion: 68, diplomacia: 14, calor: 50, frio: 50, agua: 30 } },
  sabios: { nombre: 'Sabios de Elwen', emblema: '🌳', color: '#27ae60', t: 'Sabios del bosque', r: { agresividad: 20, ciencia: 88, fe: 40, comercio: 45, expansion: 38, fertilidad: 45, cohesion: 72, diplomacia: 70, calor: 40, frio: 45, agua: 40 } },
  mercaderes: { nombre: 'Liga de Saltmar', emblema: '⛵', color: '#2e86de', t: 'Mercaderes del mar', r: { agresividad: 30, ciencia: 60, fe: 30, comercio: 92, expansion: 55, fertilidad: 50, cohesion: 50, diplomacia: 75, calor: 50, frio: 30, agua: 92 } },
  fanaticos: { nombre: 'Califato de Zahr', emblema: '🔥', color: '#e67e22', t: 'Fanáticos del desierto', r: { agresividad: 72, ciencia: 30, fe: 96, comercio: 35, expansion: 60, fertilidad: 72, cohesion: 86, diplomacia: 20, calor: 92, frio: 15, agua: 20 } },
  hielo: { nombre: 'Clanes de Vinterhal', emblema: '❄️', color: '#7fb3d5', t: 'Clanes del hielo', r: { agresividad: 62, ciencia: 45, fe: 50, comercio: 30, expansion: 45, fertilidad: 55, cohesion: 76, diplomacia: 35, calor: 10, frio: 95, agua: 50 } },
  horda: { nombre: 'Horda de Tumur', emblema: '🐎', color: '#8e44ad', t: 'Horda nómada', r: { agresividad: 82, ciencia: 20, fe: 30, comercio: 25, expansion: 95, fertilidad: 82, cohesion: 40, diplomacia: 18, calor: 60, frio: 60, agua: 15 } },
  republica: { nombre: 'República de Aurea', emblema: '🕊️', color: '#f1c40f', t: 'República pacífica', r: { agresividad: 10, ciencia: 70, fe: 35, comercio: 72, expansion: 40, fertilidad: 50, cohesion: 62, diplomacia: 95, calor: 50, frio: 45, agua: 55 } },
  tecno: { nombre: 'Tecnarquía de Ix', emblema: '⚙️', color: '#95a5a6', t: 'Tecnócratas', r: { agresividad: 45, ciencia: 98, fe: 10, comercio: 60, expansion: 45, fertilidad: 30, cohesion: 56, diplomacia: 45, calor: 45, frio: 50, agua: 50 } },
};
export const EMBLEMAS = ['⚔️', '🌳', '⛵', '🔥', '❄️', '🐎', '🕊️', '⚙️', '🦁', '🐉', '🌙', '☀️', '🦅', '🐺', '👁️', '🌊', '🏔️', '💀'];
const COLORES_EXTRA = ['#d35d9b', '#16a085', '#b9770e', '#5d6d7e', '#a04000', '#1abc9c', '#6c3483', '#cacfd2'];

// lenguas: sílabas que dan "sabor" a los nombres de ciudades, líderes y religiones de cada pueblo
const LENGUAS = [
  ['ka', 'ru', 'tor', 'mak', 'zan', 'ur', 'gor', 'ash', 'dra', 'kel'], ['el', 'ya', 'mir', 'sil', 'an', 'tha', 'lo', 'ri', 'wen', 'li'],
  ['al', 'sa', 'ham', 'dar', 'ib', 'kha', 'mun', 'zar', 'qa', 'hir'], ['bo', 'ra', 'ven', 'ul', 'sten', 'vi', 'grim', 'hal', 'rik', 'ny'],
  ['xi', 'pa', 'tla', 'man', 'chi', 'co', 'yu', 'na', 'huac', 'te'], ['ae', 'lu', 'cor', 'tes', 'in', 'ma', 'ri', 'sa', 'ven', 'to'],
  ['dun', 'mor', 'ba', 'ek', 'tar', 'on', 'gal', 'u', 'rhan', 'ok'], ['shi', 'ka', 'ro', 'mi', 'zu', 'ten', 'ha', 'no', 'ki', 'ra'],
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function palabra(R, lengua, min = 2, max = 3) { const L = LENGUAS[lengua % LENGUAS.length], n = min + Math.floor(R() * (max - min + 1)); let s = ''; for (let i = 0; i < n; i++) s += L[Math.floor(R() * L.length)]; return cap(s.slice(0, 11)); }
const elige = (R, l) => l[Math.floor(R() * l.length)];
const cl = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const hash = (a, b) => (Math.imul(a ^ 0x5bd1e995, 2654435761) ^ Math.imul(b + 0x27d4eb2d, 40503)) >>> 0;

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
  // elevación: ruido fractal menos una caída hacia el borde (para que el orbe tenga mar alrededor)
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
  // ríos: desde las alturas bajan por la pendiente más fuerte hasta el mar
  const Rr = azar(semilla ^ 0xa5a5), fuentes = [];
  for (let i = 0; i < n; i++) if (a[i] > 0.55 && a[i] < 0.85 && Rr() < 0.05) fuentes.push(i);
  for (const s of fuentes.slice(0, 12)) {
    let i = s;
    for (let k = 0; k < 80; k++) { let mj = -1; for (const j of vec[i]) if (e[j] < e[i] && (mj < 0 || e[j] < e[mj])) mj = j; if (mj < 0) break; if (a[mj] < 0) break; rio[mj] = 1; i = mj; }
  }
  for (const k in mods) bioma[+k] = mods[k]; // cicatrices de meteoritos
  const h = a.map((v, i) => (bioma[i] === B.MAR ? 0.1 : bioma[i] === B.COSTA ? 0.2 : 0.45 + Math.max(0, v) * 1.4 + Math.max(0, v - 0.68) * 9));
  return { n, x, z, a, h, bioma, temp, rio, costaAdj, vec, grid, filas, cols };
}
export const dist = (M, i, j) => { const dx = M.x[i] - M.x[j], dz = M.z[i] - M.z[j]; return Math.sqrt(dx * dx + dz * dz) / PASO; }; // en "hexágonos"
// celda más cercana a un punto (por la rejilla: sin recorrer todo el mapa); -1 si cae fuera
export function celdaCercana(M, px, pz) {
  const r = Math.round(pz / (1.5 * TAM) + (M.filas - 1) / 2); let mi = -1, md = 1e9;
  for (let rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= M.filas) continue; const c = Math.round(px / PASO + (M.cols - 1) / 2 - (rr & 1 ? 0.25 : -0.25));
    for (let cc = c - 1; cc <= c + 1; cc++) { if (cc < 0 || cc >= M.cols) continue; const i = M.grid[rr * M.cols + cc]; if (i < 0) continue; const d = (M.x[i] - px) ** 2 + (M.z[i] - pz) ** 2; if (d < md) { md = d; mi = i; } }
  }
  return mi;
}

// ---------------------------------------------------------------- rasgos efectivos (actual + líder + edad de oro)
export function rv(c, k) { let v = c.r[k]; if (c.lider?.bono === k) v += 14; if (c.oro > 0 && (k === 'ciencia' || k === 'comercio' || k === 'cohesion')) v += 8; return cl(v); }
// tabla de comida por bioma para una civ (se recalcula una vez por año: la celda solo suma río y costa)
function tablaComida(c) {
  const ag = rv(c, 'agua'), ca = rv(c, 'calor'), fr = rv(c, 'frio'), t = COMIDA.slice();
  t[B.COSTA] *= 0.3 + ag / 70; t[B.DESIERTO] *= 0.35 + ca / 45; t[B.SELVA] *= 0.6 + ca / 150; t[B.TUNDRA] *= 0.35 + fr / 45; t[B.NIEVE] *= 0.35 + fr / 45; t[B.MONTANA] *= 0.6 + fr / 200;
  c._com = t; c._costa = ag / 120; c._nav = navega(c); return t;
}
function comidaCelda(M, i, c) { const t = c._com || tablaComida(c); return t[M.bioma[i]] + (M.rio[i] ? 1.4 : 0) + (M.costaAdj[i] ? c._costa : 0); }
const navega = (c) => c.tec >= 300 || rv(c, 'agua') >= 60; // la navegación abre el mar a ejércitos y colonos
// ventaja militar de la tecnología: continua dentro de cada era (no solo al saltar de era)
export const tecMil = (c) => { const e = c.era, sig = ERAS[e + 1]?.tec ?? ERAS[e].tec * 1.6; return Math.pow(1.5, e + cl((c.tec - ERAS[e].tec) / (sig - ERAS[e].tec), 0, 1)); };
export const poderCiv = (c) => (c.pob || 0) * tecMil(c) * (0.6 + rv(c, 'agresividad') / 200);
export const eraDe = (tec) => { let e = 0; for (let i = 0; i < ERAS.length; i++) if (tec >= ERAS[i].tec) e = i; return e; };
const clave = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const relDe = (E, a, b) => E.rel[clave(a, b)] || null;

// ---------------------------------------------------------------- diario e hitos
function log(E, texto, tipo = '', hito = false, civ = null) {
  const l = { d: E.año, texto, tipo, civ }; E.diario.unshift(l); if (E.diario.length > 220) E.diario.length = 220;
  if (hito) { E.hitos.unshift(l); if (E.hitos.length > 160) E.hitos.length = 160; }
}
function efecto(E, t, celda, extra = {}) { E.efectos.push({ id: E.sig.ef++, t, celda, año: E.año, ...extra }); if (E.efectos.length > 80) E.efectos.splice(0, E.efectos.length - 80); }

// ---------------------------------------------------------------- creación
// cfg: { semilla, tipo, velo (años de aislamiento), civs: [{ nombre, color, emblema, r: {rasgo: 0-100} }] }
export function crearMundo(cfg) {
  const semilla = (cfg.semilla >>> 0) || 1, tipo = cfg.tipo || 'continente', M = generarMapa(semilla, tipo), R = azar(semilla ^ 0x9e3779b9);
  const E = { v: 1, semilla, tipo, año: 0, velo: Math.max(0, cfg.velo ?? 400), mapa: M, dueno: new Array(M.n).fill(-1), ciudadDe: new Array(M.n).fill(-1), zona: new Array(M.n).fill(0),
    civs: [], ciudades: [], ejercitos: [], rel: {}, diario: [], hitos: [], hist: [], efectos: [], ruinas: [], mods: {}, poderes: { cargas: 2, prox: 80 },
    sig: { ciu: 0, ej: 0, ef: 0 }, fin: null, finVisto: false, domina: { id: -1, años: 0 }, sinGuerra: 0 };
  const K = cfg.civs.length;
  // sitios iniciales repartidos (muestreo del punto más lejano) sobre tierra habitable
  const cand = []; for (let i = 0; i < M.n; i++) { const b = M.bioma[i]; if (!esAgua(b) && b !== B.MONTANA && b !== B.NIEVE && Math.hypot(M.x[i], M.z[i]) < RMAPA - 7) cand.push(i); }
  const sitios = [cand[Math.floor(R() * cand.length)]];
  while (sitios.length < K) { let mejor = -1, md = -1; for (const i of cand) { let d = 1e9; for (const s of sitios) d = Math.min(d, dist(M, i, s)); d += R() * 5; if (d > md) { md = d; mejor = i; } } sitios.push(mejor); }
  // clima alrededor de cada sitio, para ubicar a cada pueblo donde "encaja" (los del desierto en el desierto…)
  const clima = sitios.map((s) => { let cal = 0, fri = 0, agu = 0, t = 0; for (let i = 0; i < M.n; i++) if (dist(M, i, s) < 6) { t++; const b = M.bioma[i]; if (b === B.DESIERTO || b === B.SELVA) cal++; if (b === B.TUNDRA || b === B.NIEVE) fri++; if (esAgua(b)) agu++; } return [cal / t, fri / t, agu / t]; });
  const perms = (l) => (l.length <= 1 ? [l] : l.flatMap((v, i) => perms([...l.slice(0, i), ...l.slice(i + 1)]).map((p) => [v, ...p])));
  let mejorP = null, mejorS = -1e9;
  for (const p of perms([...Array(K).keys()])) { let s = 0; p.forEach((si, ci) => { const r = cfg.civs[ci].r, [ca, fr, ag] = clima[si]; s += (r.calor - 50) * ca + (r.frio - 50) * fr + (r.agua - 50) * ag; }); if (s > mejorS) { mejorS = s; mejorP = p; } }
  for (let i = 0; i < M.n; i++) { let mz = 0, md = 1e9; sitios.forEach((s, k) => { const d = dist(M, i, s); if (d < md) { md = d; mz = k; } }); E.zona[i] = mz; }
  cfg.civs.forEach((cc, ci) => {
    const r = {}; for (const [k] of RASGOS) r[k] = cl(+(cc.r?.[k] ?? 50));
    const c = nuevaCiv(E, R, { nombre: cc.nombre || `Pueblo ${ci + 1}`, color: cc.color || COLORES_EXTRA[ci], emblema: cc.emblema || EMBLEMAS[ci], r, lengua: ci * 2 + Math.floor(R() * 2) });
    c.zona = mejorP[ci];
    const ciu = fundar(E, R, c, sitios[mejorP[ci]], 320, true); ciu.capital = true; c.capital = ciu.id;
    log(E, `${c.emblema} Nace ${c.nombre} junto a ${ciu.nombre}. Su fe: ${c.religion}.`, 'logro', true, c.id);
  });
  if (E.velo > 0) log(E, `🌫️ Un velo de niebla separa a los pueblos. Caerá en el año ${E.velo}.`, '', true);
  muestrear(E);
  return E;
}
function nuevaCiv(E, R, { nombre, color, emblema, r, lengua, padre = null }) {
  const c = { id: E.civs.length, nombre, color, emblema, r: { ...r }, r0: { ...r }, lengua, padre, tec: 0, era: 0, desc: 0, pob: 0, poder: 0, celdas: 0, vivo: true, nacio: E.año, murio: null, causa: '',
    religion: '', lider: null, oro: 0, plaga: null, capital: -1, expPts: 0, zona: -1, ex: { guerra: 0, paz: 0, desastre: 0, prosperidad: 0, comercio: 0, victorias: 0, derrotas: 0, alianzas: 0 },
    stats: { guerras: 0, batallasG: 0, batallasP: 0, conquistas: 0, perdidas: 0, maxPob: 0 }, heroe: null, pobPrev: 0 };
  c.religion = elige(R, ['el culto de ', 'la fe de ', 'los misterios de ', 'la senda de ', 'el templo de ']) + palabra(R, lengua, 2, 2);
  E.civs.push(c); nuevoLider(E, R, c, true); return c;
}
const EPITETOS = { agresividad: ['el Conquistador', 'la Conquistadora'], ciencia: ['el Sabio', 'la Sabia'], fe: ['el Piadoso', 'la Piadosa'], comercio: ['el Mercader', 'la Mercader'],
  expansion: ['el Explorador', 'la Exploradora'], fertilidad: ['el Prolífico', 'la Madre del Pueblo'], cohesion: ['el Unificador', 'la Unificadora'], diplomacia: ['el Pacificador', 'la Pacificadora'] };
function nuevoLider(E, R, c, primero = false) {
  const ks = Object.keys(EPITETOS), pesos = ks.map((k) => rv(c, k) ** 2 + 200), tot = pesos.reduce((s, v) => s + v, 0); let x = R() * tot, k = ks[0];
  for (let i = 0; i < ks.length; i++) { x -= pesos[i]; if (x <= 0) { k = ks[i]; break; } }
  const mujer = R() < 0.45, cruel = k === 'agresividad' && R() < 0.3;
  c.lider = { nombre: palabra(R, c.lengua, 2, 3), epiteto: cruel ? (mujer ? 'la Cruel' : 'el Cruel') : EPITETOS[k][mujer ? 1 : 0], bono: k, edad: 18 + Math.floor(R() * 25), desde: E.año, titulo: mujer ? 'reina' : 'rey' };
  if (!primero) log(E, `👑 ${cap(c.lider.titulo)} ${c.lider.nombre} ${c.lider.epiteto} sube al trono de ${c.nombre}.`, '', false, c.id);
}
function fundar(E, R, c, celda, pob, capital = false) {
  const M = E.mapa, ciu = { id: E.sig.ciu++, civ: c.id, celda, nombre: palabra(R, c.lengua), pob, nivel: nivelDe(pob), fundada: E.año, capital, fuego: 0, comida: 0, cap: 0, sitiada: 0, fundador: c.id };
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
  for (const c of vivas) tablaComida(c);
  if (E.año === E.velo) log(E, '🌫️ ¡El velo cae! Los pueblos del orbe pueden encontrarse.', 'logro', true);
  const antesVelo = E.año < E.velo;

  // 1) comida, clima y frontera en una pasada por las celdas
  for (const ci of E.ciudades) ci.comida = 0;
  const S = {};
  for (const c of vivas) S[c.id] = { celdas: 0, cal: 0, fri: 0, agu: 0, front: [], borde: {} };
  for (let i = 0; i < M.n; i++) {
    const d = E.dueno[i]; if (d < 0) continue; const c = E.civs[d], s = S[d]; if (!s) { E.dueno[i] = -1; continue; }
    const ci = C.get(E.ciudadDe[i]); if (!ci || ci.civ !== d) { E.dueno[i] = -1; E.ciudadDe[i] = -1; continue; }
    ci.comida += comidaCelda(M, i, c); s.celdas++;
    const b = M.bioma[i]; if (b === B.DESIERTO || b === B.SELVA) s.cal++; if (b === B.TUNDRA || b === B.NIEVE) s.fri++; if (M.costaAdj[i] || esAgua(b)) s.agu++;
    for (const j of M.vec[i]) {
      const dj = E.dueno[j];
      if (dj < 0) { if (M.bioma[j] !== B.MAR || (c._nav && R() < 0.15)) s.front.push(j, i); }
      else if (dj !== d) s.borde[dj] = (s.borde[dj] || 0) + 1;
    }
  }

  // 2) población de cada ciudad (logística sobre su comida)
  const nSocios = {}; for (const r of Object.values(E.rel)) if (r.comercio) { nSocios[r.a] = (nSocios[r.a] || 0) + 1; nSocios[r.b] = (nSocios[r.b] || 0) + 1; }
  for (const ci of E.ciudades) {
    const c = E.civs[ci.civ]; if (!c.vivo) continue;
    const socios = nSocios[c.id] || 0;
    ci.cap = Math.max(60, ci.comida * 70 * (1 + c.tec / 2200) * (1 + socios * 0.05 * rv(c, 'comercio') / 100) * (1 + rv(c, 'fertilidad') / 500) * (ci.capital ? 1.15 : 1));
    const rr = (0.006 + rv(c, 'fertilidad') / 100 * 0.03) * (c.oro > 0 ? 1.3 : 1);
    if (ci.pob < ci.cap) ci.pob += ci.pob * rr * (1 - ci.pob / ci.cap); else ci.pob -= (ci.pob - ci.cap) * 0.08;
    ci.pob = Math.max(20, ci.pob); if (ci.fuego > 0) ci.fuego--; if (ci.sitiada > 0) ci.sitiada--;
    const nv = nivelDe(ci.pob);
    if (nv > ci.nivel) { ci.nivel = nv; const primera = nv === 3 && !c.metro; if (primera) c.metro = true; if (nv >= 2) log(E, `${c.emblema} ${ci.nombre} (${c.nombre}) se convierte en ${NIVELES[nv].toLowerCase()}${primera ? ', la primera de su pueblo' : ''}.`, 'bueno', primera, c.id); }
    else if (nv < ci.nivel - 0 && ci.pob < [0, 800, 3200, 9000][ci.nivel]) ci.nivel = nv; // histéresis para no parpadear
  }
  for (const c of vivas) {
    const mias = E.ciudades.filter((x) => x.civ === c.id); c.pob = mias.reduce((s, x) => s + x.pob, 0); c.nCiudades = mias.length; c.celdas = S[c.id].celdas;
    c.stats.maxPob = Math.max(c.stats.maxPob, c.pob); c.poder = poderCiv(c);
  }

  // 3) líderes, edades de oro, tecnología y rasgos
  for (const c of vivas) {
    const L = c.lider; L.edad++;
    const enGuerra = guerrasDe(E, c.id).length > 0;
    if (R() < (L.edad > 42 ? (L.edad - 42) * 0.005 : 0.002) + (enGuerra ? 0.006 : 0)) {
      const años = E.año - L.desde; log(E, `⚰️ Muere ${L.titulo === 'reina' ? 'la reina' : 'el rey'} ${L.nombre} ${L.epiteto} de ${c.nombre} tras ${años} años de reinado.`, '', false, c.id); nuevoLider(E, R, c);
    }
    if (c.oro > 0 && --c.oro === 0) log(E, `${c.emblema} Termina la edad de oro de ${c.nombre}.`, '', false, c.id);
    if (c.heroe && --c.heroe.años <= 0) { log(E, `🗡️ El general ${c.heroe.nombre} de ${c.nombre} se retira a morir en paz.`, '', false, c.id); c.heroe = null; }
    const socios = Object.values(E.rel).filter((r) => r.comercio && (r.a === c.id || r.b === c.id));
    let ritmo = 0.5 * Math.pow(c.pob / 1000, 0.35) * Math.pow(0.1 + rv(c, 'ciencia') / 40, 1.3) * (1 + socios.length * 0.15 * (0.4 + rv(c, 'comercio') / 100)) * (c.oro > 0 ? 1.6 : 1);
    // difusión: aprender de vecinos más avanzados (más rápido si comercian)
    for (const r of Object.values(E.rel)) { if (r.a !== c.id && r.b !== c.id) continue; const o = E.civs[r.a === c.id ? r.b : r.a]; if (o.vivo && o.tec > c.tec) ritmo += (o.tec - c.tec) * (r.comercio ? 0.0025 : 0.0006); }
    const trib = Object.values(E.rel).find((r) => r.estado === 'tributo' && (r.a === c.id || r.b === c.id));
    if (trib) ritmo *= trib.senor === c.id ? 1.15 : 0.85;
    c.tec += ritmo;
    while (c.desc < DESC.length && c.tec >= DESC[c.desc][1]) {
      const d = DESC[c.desc][0], primero = !E.civs.some((o) => o !== c && o.desc > c.desc);
      log(E, `💡 ${c.nombre} descubre ${d}${primero ? ' — ¡primera en el mundo!' : ''}.`, 'logro', primero, c.id); c.desc++;
    }
    const era = eraDe(c.tec); if (era > c.era) { c.era = era; log(E, `${ERAS[era].e} ${c.nombre} entra en la ${ERAS[era].n}.`, 'logro', true, c.id); }
    derivarRasgos(E, c, S[c.id], enGuerra);
  }

  // 4) expansión celda a celda y fundación de ciudades
  for (const c of vivas) {
    const s = S[c.id]; c.expPts = Math.min(8, c.expPts + (0.5 + Math.sqrt(c.pob / 1000) * 0.8) * (0.2 + rv(c, 'expansion') / 75));
    c.encerrada = s.front.length === 0;
    let intentos = 0;
    while (c.expPts >= 1 && intentos++ < 8 && s.front.length) {
      let mejor = -1, mo = -1, ms = -1e9;
      for (let k = 0; k < s.front.length; k += 2) {
        const j = s.front[k], o = s.front[k + 1]; if (E.dueno[j] >= 0) continue; if (antesVelo && E.zona[j] !== c.zona) continue;
        const ci = C.get(E.ciudadDe[o]); if (!ci) continue; const dd = dist(M, j, ci.celda), rad = 1.6 + ci.nivel * 1.1 + c.era * 0.3 + rv(c, 'expansion') / 55;
        if (dd > rad) continue; const sc = comidaCelda(M, j, c) - dd * 0.25 + R() * 0.8; if (sc > ms) { ms = sc; mejor = j; mo = o; }
      }
      if (mejor < 0) { c.encerrada = true; break; }
      E.dueno[mejor] = c.id; E.ciudadDe[mejor] = E.ciudadDe[mo]; c.expPts -= M.bioma[mejor] === B.MONTANA || esAgua(M.bioma[mejor]) ? 1.6 : 1;
    }
    // colonos: nueva aldea a unos hexágonos de una ciudad que ya tiene gente de sobra
    const mias = E.ciudades.filter((x) => x.civ === c.id), fuente = mias.filter((x) => x.pob > 700 && x.pob > x.cap * 0.55);
    if (fuente.length && mias.length < 2 + c.pob / 1800 && R() < 0.04 + rv(c, 'expansion') / 100 * 0.14) {
      const f = fuente[Math.floor(R() * fuente.length)]; let mejor = -1, ms = -1e9;
      for (let k = 0; k < 50; k++) {
        const ang = R() * Math.PI * 2, d = (4 + R() * (navega(c) ? 7 : 4.5)) * PASO, j = celdaCercana(M, M.x[f.celda] + Math.cos(ang) * d, M.z[f.celda] + Math.sin(ang) * d);
        const b = M.bioma[j]; if (j < 0 || esAgua(b) || b === B.MONTANA || (b === B.NIEVE && rv(c, 'frio') < 65)) continue;
        if (E.dueno[j] >= 0 && E.dueno[j] !== c.id) continue; if (antesVelo && E.zona[j] !== c.zona) continue;
        if (E.ciudades.some((x) => dist(M, x.celda, j) < 3.8)) continue;
        let sc = comidaCelda(M, j, c); for (const v of M.vec[j]) sc += comidaCelda(M, v, c) * 0.5; sc += R() * 2;
        if (sc > ms) { ms = sc; mejor = j; }
      }
      if (mejor >= 0 && ms > 5) { f.pob -= 180; const n = fundar(E, R, c, mejor, 180); log(E, `${c.emblema} Colonos de ${f.nombre} fundan ${n.nombre}.`, '', false, c.id); }
    }
  }

  // 5) contacto y diplomacia (solo cuando el velo ya cayó)
  if (!antesVelo) diplomacia(E, R, vivas, S, C);
  // 6) guerra: ejércitos, batallas y sitios
  guerra(E, R, C);
  // 7) eventos: plagas, hambrunas, edades de oro, cismas
  eventos(E, R);
  // 8) poderes del espíritu: se recargan con los siglos
  if (E.año >= E.poderes.prox) { E.poderes.prox = E.año + 80; if (E.poderes.cargas < 3) E.poderes.cargas++; }
  // 9) fin y muestreo
  limpiar(E); comprobarFin(E);
  if (E.año % 10 === 0) muestrear(E);
  E.efectos = E.efectos.filter((f) => E.año - f.año < 30);
}
export function guerrasDe(E, id) { return Object.values(E.rel).filter((r) => r.estado === 'guerra' && (r.a === id || r.b === id)).map((r) => (r.a === id ? r.b : r.a)); }

function derivarRasgos(E, c, s, enGuerra) {
  const ex = c.ex; for (const k in ex) ex[k] *= 0.985;
  if (enGuerra) ex.guerra += 0.03; else ex.paz += 0.02;
  const crec = c.pobPrev ? (c.pob - c.pobPrev) / c.pobPrev : 0; c.pobPrev = c.pob; if (crec > 0.004 && !enGuerra) ex.prosperidad += 0.03;
  const t = s.celdas || 1, fh = s.cal / t, ff = s.fri / t, fa = s.agu / t, n = c.nCiudades || 1, r0 = c.r0;
  const obj = {
    agresividad: r0.agresividad + ex.guerra * 20 + ex.derrotas * 8 - ex.paz * 6 + (c.encerrada && c.pobPrev > 0 && crec < 0.001 ? 14 : 0), // hambre de tierra
    ciencia: r0.ciencia + ex.prosperidad * 15 + ex.comercio * 10 - ex.desastre * 6 + (c.oro > 0 ? 6 : 0),
    fe: r0.fe + ex.desastre * 22 - ex.prosperidad * 6 - Math.max(0, c.era - 4) * 6,
    comercio: r0.comercio + ex.comercio * 18 + fa * 15 - ex.guerra * 5,
    expansion: r0.expansion + (c.encerrada ? -12 : 6) + ex.victorias * 6,
    fertilidad: r0.fertilidad + ex.desastre * 14 - c.era * 3,
    cohesion: r0.cohesion - Math.min(22, Math.max(0, n - 4) * 1.5) + ex.victorias * 8 - ex.desastre * 8 - ex.derrotas * 10 + (rv(c, 'fe') - 50) * 0.12,
    diplomacia: r0.diplomacia + ex.alianzas * 15 + ex.comercio * 8 - ex.guerra * 12,
    calor: Math.max(r0.calor, r0.calor * 0.5 + fh * 140), frio: Math.max(r0.frio, r0.frio * 0.5 + ff * 140), agua: r0.agua + fa * 35,
  };
  for (const k in obj) c.r[k] += (cl(obj[k], 2, 98) - c.r[k]) * 0.015;
}

// ---------------------------------------------------------------- diplomacia
function diplomacia(E, R, vivas, S, C) {
  const M = E.mapa;
  for (let x = 0; x < vivas.length; x++) for (let y = x + 1; y < vivas.length; y++) {
    const A = vivas[x], Bc = vivas[y], k = clave(A.id, Bc.id); let r = E.rel[k];
    const fr = (S[A.id].borde[Bc.id] || 0) + (S[Bc.id].borde[A.id] || 0);
    if (!r) {
      // contacto: fronteras que se tocan, ciudades cercanas, o exploradores marinos
      let cerca = fr > 0;
      if (!cerca) for (const p of E.ciudades) { if (p.civ !== A.id) continue; for (const q of E.ciudades) if (q.civ === Bc.id && dist(M, p.celda, q.celda) < 11) { cerca = true; break; } if (cerca) break; }
      if (!cerca && (navega(A) || navega(Bc)) && R() < 0.02) cerca = true;
      if (!cerca) continue;
      const v0 = ((rv(A, 'diplomacia') + rv(Bc, 'diplomacia')) / 2 - (rv(A, 'agresividad') + rv(Bc, 'agresividad')) / 2) * 0.5 + (R() - 0.5) * 20 + (A.padre === Bc.id || Bc.padre === A.id ? -20 : 0);
      r = E.rel[k] = { contacto: E.año, a: Math.min(A.id, Bc.id), b: Math.max(A.id, Bc.id), v: cl(v0, -100, 100), estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: fr, ultimaGuerra: E.año };
      log(E, `🤝 Primer contacto: ${A.emblema} ${A.nombre} y ${Bc.emblema} ${Bc.nombre} se descubren.`, 'logro', true);
      continue;
    }
    r.frontera = fr;
    const aA = rv(A, 'agresividad'), aB = rv(Bc, 'agresividad'), dA = rv(A, 'diplomacia'), dB = rv(Bc, 'diplomacia');
    const escasez = (A.encerrada ? 12 : 0) + (Bc.encerrada ? 12 : 0) + Math.min(40, (E.año - r.ultimaGuerra) / 15); // el roce crece con los siglos de paz
    const relig = (rv(A, 'fe') + rv(Bc, 'fe')) / 2 > 55 ? 14 : 0;
    const obj = (dA + dB) / 2 * 0.85 - (aA + aB) / 2 * 0.95 + (rv(A, 'comercio') + rv(Bc, 'comercio')) / 2 * 0.25 - Math.min(30, fr * 0.35) * (aA + aB) / 100 - relig - escasez + (r.estado === 'alianza' ? 12 : 0)
      + (enemigoComun(E, A.id, Bc.id) ? 20 : 0);
    r.v = cl(r.v + (obj - r.v) * 0.03 + (R() - 0.5) * 5, -100, 100);
    // incidentes: la chispa que hasta a los pueblos pacíficos puede llevar a la guerra
    if (r.estado !== 'guerra' && R() < 0.004 + Math.min(0.006, fr * 0.0002)) {
      const P = R() < 0.5 ? A : Bc, Q = P === A ? Bc : A, golpe = 25 + R() * 45; r.v = cl(r.v - golpe, -100, 100);
      log(E, `❗ ${elige(R, [`Asesinan a un embajador de ${Q.nombre} en la corte de ${P.nombre}`, `Soldados de ${P.nombre} queman una aldea fronteriza de ${Q.nombre}`, `Un príncipe de ${P.nombre} rapta a una princesa de ${Q.nombre}`, `${P.nombre} profana un templo de ${Q.religion}`, `Piratas de ${P.nombre} saquean barcos de ${Q.nombre}`, `${P.nombre} reclama tierras que ${Q.nombre} considera suyas`])}.`, 'malo', false);
    }
    // comercio
    const quiere = r.estado !== 'guerra' && r.v > -5 && rv(A, 'comercio') + rv(Bc, 'comercio') > 75;
    if (quiere && !r.comercio) { r.comercio = true; log(E, `💰 Se abre una ruta comercial entre ${A.nombre} y ${Bc.nombre}.`, 'bueno', !r.yaComercio); r.yaComercio = true; }
    else if (!quiere && r.comercio) r.comercio = false;
    if (r.comercio) { A.ex.comercio += 0.02; Bc.ex.comercio += 0.02; }
    if (r.estado === 'paz' || r.estado === 'alianza') {
      if (r.estado === 'paz' && r.v > 50 && dA > 40 && dB > 40) { r.estado = 'alianza'; A.ex.alianzas += 0.5; Bc.ex.alianzas += 0.5; log(E, `🕊️ ${A.nombre} y ${Bc.nombre} firman una alianza.`, 'bueno', true); continue; }
      if (r.estado === 'alianza' && r.v < 15) { r.estado = 'paz'; log(E, `💔 Se rompe la alianza entre ${A.nombre} y ${Bc.nombre}.`, 'malo', true); }
      if (E.año < r.tregua || E.año - r.contacto < 15) continue;
      // ¿quién declara? cada lado según su agresividad, su poder relativo y su líder
      for (const [P, Q] of [[A, Bc], [Bc, A]]) {
        if (r.v > -18 || r.estado === 'alianza') break;
        const ratio = cl(P.poder / Math.max(1, Q.poder), 0.25, 3), ag = rv(P, 'agresividad') / 100;
        let p = (0.006 + ag * ag * 0.09) * Math.pow(ratio, 0.9) * (1.35 - rv(P, 'diplomacia') / 100) * (P.lider.bono === 'agresividad' ? 1.8 : 1) * (1 + (-18 - r.v) / 40);
        if (P.encerrada) p *= 1.5;
        if (R() < p) { declarar(E, P, Q, r); break; }
      }
    } else if (r.estado === 'tributo') {
      const S_ = E.civs[r.senor], T = E.civs[r.senor === r.a ? r.b : r.a];
      if (T.poder > S_.poder * 0.85 && R() < 0.05) { log(E, `✊ ${T.nombre} se rebela contra el tributo a ${S_.nombre}: ¡guerra de independencia!`, 'malo', true); r.senor = -1; declarar(E, T, S_, r, true); }
      else if (rv(S_, 'agresividad') > 60 && S_.poder > T.poder * 3 && E.año - r.desde > 30 && R() < 0.01) { log(E, `🗡️ ${S_.nombre} decide acabar con su vasallo ${T.nombre}.`, 'malo', true); r.senor = -1; declarar(E, S_, T, r, true); }
      else if (T.nCiudades <= 3 && S_.pob > T.pob * 4 && R() < 0.006 * (0.5 + rv(S_, 'diplomacia') / 50)) asimilar(E, S_, T);
      else if (E.año - r.desde > 150 && R() < 0.01) { r.estado = 'paz'; r.senor = -1; log(E, `${T.nombre} deja de pagar tributo a ${S_.nombre} tras siglo y medio.`, '', false); }
    } else if (r.estado === 'guerra') {
      // cansancio de guerra: tiempo, bajas y ciudades perdidas; la agresividad aguanta más
      for (const P of [A, Bc]) r.cans[P.id] = (r.cans[P.id] || 0) + 0.012 + (r.bajas[P.id] || 0) / Math.max(300, P.pob) * 2;
      r.bajas = {};
      for (const [P, Q] of [[A, Bc], [Bc, A]]) {
        const umbral = 0.7 + rv(P, 'agresividad') / 100 * 1.1 + (P.lider.bono === 'agresividad' ? 0.3 : 0);
        if (r.cans[P.id] > umbral) { pazEntre(E, R, P, Q, r); break; }
      }
    }
  }
  // aliados se suman a las guerras de sus aliados
  for (const r of Object.values(E.rel)) {
    if (r.estado !== 'alianza') continue;
    for (const [x, y] of [[r.a, r.b], [r.b, r.a]]) for (const en of guerrasDe(E, x)) {
      if (en === y) continue; const rr = relDe(E, y, en); const Y = E.civs[y], EN = E.civs[en];
      if (rr && rr.estado === 'paz' && E.año >= rr.tregua && rr.v < 25 && R() < 0.08) { log(E, `📯 ${Y.nombre} entra en la guerra junto a su aliado ${E.civs[x].nombre}.`, 'malo', true); declarar(E, Y, EN, rr); }
    }
  }
}
function enemigoComun(E, a, b) { const ga = guerrasDe(E, a); return guerrasDe(E, b).some((x) => ga.includes(x)); }
function declarar(E, P, Q, r, silencio = false) {
  r.estado = 'guerra'; r.desde = E.año; r.cans = { [P.id]: 0, [Q.id]: 0 }; r.bajas = {}; r.comercio = false; r.agresor = P.id; r.ciudadesTomadas = { [P.id]: 0, [Q.id]: 0 };
  P.stats.guerras++; Q.stats.guerras++;
  const nombres = ['la Guerra de los Cien Años', 'la Guerra del Río', 'la Gran Guerra', 'la Guerra de las Coronas', 'la Guerra Santa', 'la Guerra de la Frontera', 'la Guerra del Hierro'];
  r.nombre = P.padre === Q.id || Q.padre === P.id ? 'la Guerra Civil' : rv(P, 'fe') > 70 ? 'la Guerra Santa' : nombres[(E.año + P.id * 3 + Q.id) % nombres.length];
  if (!silencio) log(E, `⚔️ ${P.emblema} ${P.nombre} declara la guerra a ${Q.emblema} ${Q.nombre}: comienza ${r.nombre}.`, 'malo', true);
}
function pazEntre(E, R, P, Q, r) {
  // P está agotada; si Q la aplasta, P paga tributo; si no, tregua
  const ratio = Q.poder / Math.max(1, P.poder), tomadas = r.ciudadesTomadas?.[Q.id] || 0, dur = E.año - r.desde;
  // un agresor muy superior no acepta la paz: quiere la rendición total
  if (ratio > 2.6 && rv(Q, 'agresividad') > 55 && tomadas > 0 && R() < 0.8) { if (!r.rechazo) { r.rechazo = true; log(E, `🚫 ${Q.nombre} rechaza la paz: exige la rendición total de ${P.nombre}.`, 'malo', true); } r.cans[P.id] *= 0.85; return; }
  disolver(E, P.id, Q.id);
  if (ratio > 4 && tomadas > 0 && P.nCiudades <= Math.max(3, Q.nCiudades * 0.6)) {
    // capitulación: el vencido entrega todo y su pueblo pasa a ser parte del vencedor
    log(E, `🏳️ ${P.emblema} ${P.nombre} capitula ante ${Q.emblema} ${Q.nombre} al cabo de ${r.nombre} (${dur} años).`, 'malo', true);
    for (const ci of E.ciudades) if (ci.civ === P.id) { ci.civ = Q.id; ci.capital = false; ci.pob *= 0.85; ci.conq = E.año; }
    for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === P.id) E.dueno[i] = Q.id;
    Q.ex.victorias += 1.5; extinguir(E, P, 'conquistada', Q); return;
  }
  if (ratio > 2 && tomadas > 0 && rv(Q, 'diplomacia') < 70) {
    r.estado = 'tributo'; r.senor = Q.id; r.desde = E.año; r.v = -10;
    log(E, `📜 ${P.nombre} se rinde y paga tributo a ${Q.nombre}. Termina ${r.nombre} (${dur} años).`, 'malo', true);
    Q.ex.victorias += 1; P.ex.derrotas += 1;
  } else {
    r.estado = 'paz'; r.tregua = E.año + 20 + Math.floor(R() * 30); r.v = -10; r.ultimaGuerra = E.año;
    // quien pidió la paz (P) suele pagarla con una ciudad de la frontera, salvo que haya ganado más
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
    log(E, `🕊️ Paz entre ${P.nombre} y ${Q.nombre}${gana ? `; ${gana.nombre} sale ganando${cede ? ` y se queda con ${cede.nombre}` : ''}` : ', sin vencedor claro'}.`, 'bueno', true);
  }
  r.ultimaGuerra = E.año; r.cans = {};
}
function disolver(E, a, b) {
  // los ejércitos vuelven a casa: los sobrevivientes regresan a la ciudad propia más cercana
  E.ejercitos = E.ejercitos.filter((ej) => {
    if (!((ej.civ === a && ej.enemigo === b) || (ej.civ === b && ej.enemigo === a))) return true;
    const casa = ciudadPropiaCercana(E, ej.civ, ej.celda); if (casa) casa.pob += ej.fuerza * 0.8; return false;
  });
}
function ciudadPropiaCercana(E, civ, celda) { let m = null, md = 1e9; for (const c of E.ciudades) if (c.civ === civ) { const d = dist(E.mapa, c.celda, celda); if (d < md) { md = d; m = c; } } return m; }
function asimilar(E, S_, T) {
  for (const ci of E.ciudades) if (ci.civ === T.id) { ci.civ = S_.id; ci.capital = false; }
  for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === T.id) E.dueno[i] = S_.id;
  extinguir(E, T, 'asimilada', S_);
  log(E, `🫂 ${T.nombre} es asimilada pacíficamente por ${S_.nombre}; su gente adopta ${S_.religion}.`, 'logro', true);
}
function extinguir(E, c, causa, por = null) {
  c.vivo = false; c.murio = E.año; c.causa = causa; c.por = por?.id ?? null; c.pob = 0;
  E.ejercitos = E.ejercitos.filter((e) => e.civ !== c.id);
  for (const k of Object.keys(E.rel)) { const r = E.rel[k]; if (r.a === c.id || r.b === c.id) delete E.rel[k]; }
  for (let i = 0; i < E.dueno.length; i++) if (E.dueno[i] === c.id) { E.dueno[i] = -1; E.ciudadDe[i] = -1; }
  if (causa !== 'asimilada') log(E, `💀 ${c.emblema} ${c.nombre} ha sido ${causa}${por ? ` por ${por.nombre}` : ''}. Duró ${E.año - c.nacio} años.`, 'malo', true, c.id);
}

// ---------------------------------------------------------------- guerra
function costo(E, c, i) { const b = E.mapa.bioma[i]; if (esAgua(b)) return navega(c) ? (b === B.MAR ? 2.2 : 1.4) : Infinity; return b === B.MONTANA ? 2.5 : b === B.NIEVE ? 2 : b === B.BOSQUE || b === B.SELVA ? 1.4 : 1; }
function ruta(E, c, de, a) {
  // Dijkstra sencillo con montículo binario (≈2400 celdas: barato incluso varias veces por año)
  const M = E.mapa, d = new Float64Array(M.n).fill(Infinity), prev = new Int32Array(M.n).fill(-1), h = [[0, de]]; d[de] = 0;
  const push = (x) => { h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b2 = a + 1; let m = i; if (a < h.length && h[a][0] < h[m][0]) m = a; if (b2 < h.length && h[b2][0] < h[m][0]) m = b2; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
  while (h.length) {
    const [dd, i] = pop(); if (dd > d[i]) continue; if (i === a) break;
    for (const j of M.vec[i]) { const nd = dd + (j === a ? 1 : costo(E, c, j)); if (nd < d[j]) { d[j] = nd; prev[j] = i; push([nd, j]); } }
  }
  if (!isFinite(d[a])) return null;
  const r = []; for (let i = a; i !== de && i >= 0; i = prev[i]) r.push(i); return r.reverse();
}
const fuerzaEf = (E, c, ej, R) => {
  const M = E.mapa, b = M.bioma[ej.celda];
  let t = 1; if (E.dueno[ej.celda] === c.id) t *= 1.15; if (b === B.MONTANA) t *= 1.25; else if (b === B.BOSQUE || b === B.SELVA) t *= 1.1;
  if (b === B.DESIERTO || b === B.SELVA) t *= 0.7 + rv(c, 'calor') / 333; if (b === B.TUNDRA || b === B.NIEVE) t *= 0.7 + rv(c, 'frio') / 333; if (esAgua(b)) t *= 0.6 + rv(c, 'agua') / 250;
  return ej.fuerza * tecMil(c) * (0.5 + ej.moral) * (0.7 + rv(c, 'agresividad') / 250 + rv(c, 'cohesion') / 330 + rv(c, 'fe') / 1000) * t * (ej.general ? 1.25 : 1) * (0.8 + R() * 0.4);
};
function guerra(E, R, C) {
  const M = E.mapa;
  // reclutar
  for (const r of Object.values(E.rel)) {
    if (r.estado !== 'guerra') continue;
    for (const [P, Q] of [[E.civs[r.a], E.civs[r.b]], [E.civs[r.b], E.civs[r.a]]]) {
      const mios = E.ejercitos.filter((e) => e.civ === P.id && e.enemigo === Q.id), actual = mios.reduce((s, e) => s + e.fuerza, 0);
      const deseo = P.pob * (0.025 + rv(P, 'agresividad') / 100 * 0.07) * (r.agresor === P.id ? 1 : 1.7) * (1 - Math.min(0.6, (r.cans[P.id] || 0) * 0.4));
      if (actual > deseo * 0.6 || mios.length >= 3 || R() > 0.6) continue;
      const objetivos = E.ciudades.filter((x) => x.civ === Q.id); if (!objetivos.length) continue;
      let base = null, obj = null, md = 1e9;
      for (const ci of E.ciudades) { if (ci.civ !== P.id || ci.pob < 500) continue; for (const o of objetivos) { const d = dist(M, ci.celda, o.celda); if (d < md) { md = d; base = ci; obj = o; } } }
      if (!base) continue;
      const camino = ruta(E, P, base.celda, obj.celda); if (!camino) { r.cans[P.id] = (r.cans[P.id] || 0) + 0.01; continue; }
      const f = Math.min(deseo - actual, base.pob * 0.2); if (f < 60) continue; base.pob -= f;
      E.ejercitos.push({ id: E.sig.ej++, civ: P.id, enemigo: Q.id, celda: base.celda, ruta: camino, obj: obj.id, fuerza: f, moral: 0.8, tray: [base.celda], sitio: -1, sitioAños: 0, general: null, combate: 0 });
    }
  }
  // mover
  for (const ej of E.ejercitos) {
    const P = E.civs[ej.civ]; ej.tray = [ej.celda]; ej.combate = Math.max(0, ej.combate - 1);
    if (ej.retirada > 0) { ej.retirada--; continue; }
    let o = C.get(ej.obj);
    if (!o || o.civ !== ej.enemigo) {
      const objs = E.ciudades.filter((x) => x.civ === ej.enemigo); o = null; let md = 1e9; for (const x of objs) { const d = dist(M, ej.celda, x.celda); if (d < md) { md = d; o = x; } }
      if (!o) continue; ej.obj = o.id; ej.ruta = ruta(E, P, ej.celda, o.celda) || []; ej.sitio = -1;
    }
    if (ej.sitio >= 0) continue;
    const vel = 2 + (P.era >= 5 ? 1 : 0) + (P.era >= 6 ? 1 : 0);
    for (let s = 0; s < vel; s++) {
      // interceptar ejércitos enemigos cercanos (así hay batallas campales y no solo sitios)
      let cerca = null, mdd = 3.2;
      for (const x of E.ejercitos) if (x.civ === ej.enemigo) { const d = dist(M, x.celda, ej.celda); if (d < mdd) { mdd = d; cerca = x; } }
      let sig = -1;
      if (cerca && mdd > 1.1) { let mb = 1e9; for (const j of M.vec[ej.celda]) { if (!isFinite(costo(E, P, j))) continue; const d = dist(M, j, cerca.celda); if (d < mb) { mb = d; sig = j; } } ej.ruta = null; }
      else if (cerca) break;
      else { if ((!ej.ruta || !ej.ruta.length) && ej._ra !== E.año) { ej._ra = E.año; ej.ruta = ruta(E, P, ej.celda, o.celda) || []; } sig = ej.ruta?.shift() ?? -1; }
      if (sig < 0) break;
      if (sig === o.celda || dist(M, sig, o.celda) < 0.6) { ej.sitio = o.id; ej.sitioAños = 0; o.sitiada = 2; log(E, `🏹 ${P.nombre} pone sitio a ${o.nombre}.`, 'malo', false); break; }
      ej.celda = sig; ej.tray.push(sig);
      if (esAgua(M.bioma[sig])) s += 0.5;
    }
  }
  // batallas campales
  const muertos = new Set();
  for (let i = 0; i < E.ejercitos.length; i++) for (let j = i + 1; j < E.ejercitos.length; j++) {
    const a = E.ejercitos[i], b = E.ejercitos[j]; if (muertos.has(a.id) || muertos.has(b.id)) continue;
    if (!(a.enemigo === b.civ && b.enemigo === a.civ) && !(guerrasDe(E, a.civ).includes(b.civ))) continue;
    if (dist(M, a.celda, b.celda) > 1.2) continue;
    batalla(E, R, a, b, muertos);
  }
  // sitios
  for (const ej of E.ejercitos) {
    if (muertos.has(ej.id) || ej.sitio < 0) continue;
    const o = C.get(ej.sitio), P = E.civs[ej.civ]; if (!o || o.civ !== ej.enemigo) { ej.sitio = -1; continue; }
    const D = E.civs[o.civ]; ej.sitioAños++; o.sitiada = 2;
    const def = (o.pob * 0.1 + 60) * tecMil(D) * (1 + 0.3 * o.nivel + (D.tec >= 1250 ? 0.5 : 0)) * (1 + rv(D, 'ciencia') / 200) * (0.7 + rv(D, 'cohesion') / 200 + rv(D, 'fe') / 600) * (o.capital ? 1.25 : 1) * (E.mapa.bioma[o.celda] === B.MONTANA ? 1.3 : 1) * (o.conq && E.año - o.conq < 12 ? 1.8 : 1);
    const atq = fuerzaEf(E, P, ej, R);
    ej.fuerza *= 0.93; o.pob *= 0.97; ej.combate = 1;
    const rr = relDe(E, P.id, D.id); if (rr) { rr.bajas[P.id] = (rr.bajas[P.id] || 0) + ej.fuerza * 0.07; rr.bajas[D.id] = (rr.bajas[D.id] || 0) + o.pob * 0.03; }
    if (atq > def * (0.85 + R() * 0.6)) caer(E, R, o, ej, P, D);
    else if (ej.fuerza < 50 || (ej.sitioAños > 3 && atq < def * 0.45)) { log(E, `🛡️ ${o.nombre} resiste: el sitio de ${P.nombre} fracasa.`, 'bueno', false); muertos.add(ej.id); const casa = ciudadPropiaCercana(E, P.id, ej.celda); if (casa) casa.pob += ej.fuerza * 0.5; D.ex.victorias += 0.15; }
  }
  E.ejercitos = E.ejercitos.filter((e) => !muertos.has(e.id) && e.fuerza >= 25 && E.civs[e.civ].vivo && E.civs[e.enemigo].vivo);
}
function lugar(E, celda) { let m = null, md = 1e9; for (const c of E.ciudades) { const d = dist(E.mapa, c.celda, celda); if (d < md) { md = d; m = c; } } const b = BIOMAS[E.mapa.bioma[celda]].n; return md < 4 && m ? m.nombre : esAgua(E.mapa.bioma[celda]) ? 'el mar' : `${b === 'Montaña' ? 'las montañas' : b === 'Bosque' || b === 'Selva' ? 'el bosque' : b === 'Desierto' ? 'las dunas' : 'los llanos'}`; }
function batalla(E, R, a, b, muertos) {
  const A = E.civs[a.civ], Bc = E.civs[b.civ], fa = fuerzaEf(E, A, a, R), fb = fuerzaEf(E, Bc, b, R);
  const [g, p, G, P, fg, fp] = fa >= fb ? [a, b, A, Bc, fa, fb] : [b, a, Bc, A, fb, fa];
  const k = fp / fg, bajasG = g.fuerza * (0.12 + 0.4 * k) * (0.8 + R() * 0.3), bajasP = p.fuerza * (0.5 + 0.3 * (1 - k));
  g.fuerza -= bajasG; p.fuerza -= bajasP; g.moral = Math.min(1.2, g.moral + 0.1); p.moral = Math.max(0.2, p.moral - 0.3); g.combate = p.combate = 2;
  G.stats.batallasG++; P.stats.batallasP++;
  const rr = relDe(E, A.id, Bc.id); if (rr) { rr.bajas[g.civ] = (rr.bajas[g.civ] || 0) + bajasG; rr.bajas[p.civ] = (rr.bajas[p.civ] || 0) + bajasP; }
  const nom = `la batalla de ${lugar(E, g.celda)}`;
  efecto(E, 'batalla', g.celda, { otra: p.celda, ca: G.color, cb: P.color });
  const grande = bajasG + bajasP > 1500;
  log(E, `⚔️ ${cap(nom)}: ${G.nombre} derrota a ${P.nombre} (${Math.round(bajasP + bajasG)} caídos).`, 'malo', grande && R() < 0.4);
  if (!g.general && !G.heroe && R() < 0.05) { g.general = palabra(R, G.lengua, 2, 3); G.heroe = { nombre: g.general, años: 25 + Math.floor(R() * 20) }; log(E, `🗡️ Tras ${nom} se alza el general ${g.general} de ${G.nombre}, héroe de su pueblo.`, 'logro', true, G.id); }
  if (p.general && R() < 0.35) { log(E, `☠️ Cae el general ${p.general} de ${P.nombre}.`, 'malo', false); if (P.heroe?.nombre === p.general) P.heroe = null; p.general = null; }
  if (p.fuerza < 40) muertos.add(p.id); else { p.retirada = 2; p.sitio = -1; p.ruta = null; }
}
function caer(E, R, o, ej, P, D) {
  const M = E.mapa;
  const pExt = cl(0.04 + rv(P, 'agresividad') / 100 * 0.55 - rv(P, 'diplomacia') / 100 * 0.35 + (P.religion !== D.religion && rv(P, 'fe') > 65 ? 0.15 : 0) + (P.lider.epiteto.includes('Cruel') ? 0.25 : 0), 0.03, 0.88);
  const extermina = !(o.conq && E.año - o.conq < 25) && R() < pExt, eraCapital = o.capital; o.conq = E.año;
  if (extermina) { o.pob *= 0.12; o.fuego = 12; efecto(E, 'caida', o.celda, { arrasada: true }); log(E, `🔥 ${P.emblema} ${P.nombre} arrasa ${o.nombre}: la ciudad arde y su gente es pasada a cuchillo.`, 'malo', true); }
  else { o.pob *= 0.75; o.fuego = 4; efecto(E, 'caida', o.celda); log(E, `🏳️ ${P.emblema} ${P.nombre} conquista ${o.nombre}, que era de ${D.nombre}.`, 'malo', o.nivel >= 2 || o.capital); }
  o.civ = P.id; o.capital = false; o.sitiada = 0;
  for (let i = 0; i < M.n; i++) if (E.ciudadDe[i] === o.id) E.dueno[i] = P.id;
  o.pob += ej.fuerza * 0.4; ej.fuerza *= 0.55; ej.sitio = -1; ej.ruta = null; ej.moral = Math.min(1.2, ej.moral + 0.15);
  P.stats.conquistas++; D.stats.perdidas++; P.ex.victorias += 0.3; D.ex.derrotas += 0.3; D.ex.desastre += 0.15;
  const rr = relDe(E, P.id, D.id); if (rr) { rr.ciudadesTomadas = rr.ciudadesTomadas || {}; rr.ciudadesTomadas[P.id] = (rr.ciudadesTomadas[P.id] || 0) + 1; rr.cans[D.id] = (rr.cans[D.id] || 0) + 0.18; }
  if (extermina && o.pob < 80) destruir(E, o);
  const quedan = E.ciudades.filter((c) => c.civ === D.id);
  if (!quedan.length) { extinguir(E, D, extermina ? 'exterminada' : 'conquistada', P); return; }
  if (eraCapital) {
    const n = quedan.reduce((m, c) => (c.pob > m.pob ? c : m)); n.capital = true; D.capital = n.id; D.r.cohesion = Math.max(0, D.r.cohesion - 12);
    log(E, `👑 Cae la capital de ${D.nombre}. La corte huye a ${n.nombre}.`, 'malo', true, D.id);
  }
}
function destruir(E, o) {
  E.ciudades = E.ciudades.filter((c) => c !== o);
  for (let i = 0; i < E.mapa.n; i++) if (E.ciudadDe[i] === o.id) { E.dueno[i] = -1; E.ciudadDe[i] = -1; }
  E.ruinas.push({ celda: o.celda, nombre: o.nombre, año: E.año }); if (E.ruinas.length > 30) E.ruinas.shift();
  log(E, `🏚️ De ${o.nombre} solo quedan ruinas.`, 'malo', false);
}

// ---------------------------------------------------------------- eventos
const PESTES = ['la Peste Negra', 'la Fiebre Gris', 'el Mal Rojo', 'la Tos de Ceniza', 'la Plaga Sudorosa', 'la Viruela Pálida', 'el Gran Contagio'];
function plaga(E, R, c, nombre = null) {
  c.plaga = { nombre: nombre || elige(R, PESTES), años: 2 + Math.floor(R() * 5), sev: (0.04 + R() * 0.07) * Math.max(0.3, 1 - c.era * 0.1) * (1.25 - rv(c, 'ciencia') / 160) };
  log(E, `☣️ ${c.plaga.nombre} azota a ${c.nombre}.`, 'malo', true, c.id); c.ex.desastre += 0.5; efecto(E, 'plaga', E.ciudades.find((x) => x.id === c.capital)?.celda ?? 0);
}
function eventos(E, R) {
  for (const c of E.civs) {
    if (!c.vivo) continue;
    const mias = E.ciudades.filter((x) => x.civ === c.id), socios = Object.values(E.rel).filter((r) => (r.a === c.id || r.b === c.id) && (r.comercio || r.estado === 'guerra'));
    // plagas: más con densidad y comercio, menos con ciencia; se contagian a socios y enemigos
    if (c.plaga) {
      for (const m of mias) m.pob *= 1 - c.plaga.sev;
      for (const r of socios) { const o = E.civs[r.a === c.id ? r.b : r.a]; if (o.vivo && !o.plaga && !o.inmune && R() < 0.12) plaga(E, R, o, c.plaga.nombre); }
      if (--c.plaga.años <= 0) { log(E, `${c.emblema} ${c.nombre} supera ${c.plaga.nombre}.`, '', false, c.id); c.plaga = null; c.inmune = 25; }
    } else if (c.inmune > 0) c.inmune--;
    else if (R() < (0.0015 + Math.min(0.004, c.pob / 2e6) + socios.length * 0.0008) * (1.3 - rv(c, 'ciencia') / 125)) plaga(E, R, c);
    // hambruna: sequía al azar o gente de sobra
    const sobre = mias.filter((m) => m.pob > m.cap * 1.02).length;
    if (mias.length && (R() < 0.0025 || (sobre / mias.length > 0.6 && R() < 0.02))) {
      for (const m of mias) m.pob *= 0.86; c.ex.desastre += 0.3; c.r.cohesion = Math.max(0, c.r.cohesion - 3);
      log(E, `🌾 Hambruna en ${c.nombre}: los graneros se vacían.`, 'malo', false, c.id);
    }
    // edad de oro: paz, cohesión y prosperidad
    if (!c.oro && guerrasDe(E, c.id).length === 0 && R() < 0.003 * (rv(c, 'cohesion') / 60) * (1 + c.ex.prosperidad)) {
      c.oro = 30 + Math.floor(R() * 30); log(E, `✨ Comienza la edad de oro de ${c.nombre} bajo ${c.lider.nombre} ${c.lider.epiteto}.`, 'logro', true, c.id);
    }
    // cisma / guerra civil: imperios grandes y poco cohesionados se parten
    const coh = rv(c, 'cohesion');
    if (mias.length >= 4 && coh < 30 && E.año - (c.ultCisma ?? c.nacio) > 150 && R() < 0.001 + (30 - coh) / 30 * 0.01) { c.ultCisma = E.año; cisma(E, R, c, mias); }
  }
}
function cisma(E, R, c, mias) {
  const M = E.mapa, capi = mias.find((x) => x.capital) || mias[0];
  if (E.civs.filter((x) => x.vivo).length >= 7) { for (const m of mias) m.pob *= 0.9; c.r.cohesion += 6; log(E, `🔥 Revueltas en ${c.nombre}; la corona las ahoga en sangre.`, 'malo', false, c.id); return; }
  const semilla = mias.reduce((m, x) => (dist(M, x.celda, capi.celda) > dist(M, m.celda, capi.celda) ? x : m));
  const rebeldes = mias.filter((x) => x !== capi && dist(M, x.celda, semilla.celda) < dist(M, x.celda, capi.celda));
  if (!rebeldes.length || rebeldes.length >= mias.length) return;
  const dx = M.x[semilla.celda] - M.x[capi.celda], dz = M.z[semilla.celda] - M.z[capi.celda];
  const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'del Este' : 'del Oeste') : dz > 0 ? 'del Sur' : 'del Norte';
  const base = c.nombre.split(' ').slice(-1)[0], r = {};
  for (const [k] of RASGOS) r[k] = Math.round(cl(c.r[k] + (R() - 0.5) * 26)); r.cohesion = 62; r.agresividad = cl(r.agresividad + 10);
  const usados = new Set(E.civs.filter((x) => x.vivo).map((x) => x.color)), color = COLORES_EXTRA.find((x) => !usados.has(x)) || COLORES_EXTRA[E.civs.length % 8];
  const n = nuevaCiv(E, R, { nombre: elige(R, ['Reino', 'Liga', 'Señorío', 'Confederación', 'Sultanato', 'Principado']) + ` ${base} ${dir}`, color, emblema: elige(R, ['🦅', '🐺', '🌙', '🐉', '👁️', '🦁']), r, lengua: c.lengua + 1, padre: c.id });
  n.tec = c.tec * 0.95; n.era = c.era; n.desc = c.desc; n.zona = c.zona;
  n.religion = rv(c, 'fe') > 55 ? `los ${palabra(R, n.lengua, 2, 2).toLowerCase()}istas (cisma de ${c.religion.replace(/^(el|la|los) /, '')})` : c.religion;
  for (const x of rebeldes) { x.civ = n.id; x.capital = false; } semilla.capital = true; n.capital = semilla.id;
  for (let i = 0; i < M.n; i++) { const ci = E.ciudadDe[i]; if (rebeldes.some((x) => x.id === ci)) E.dueno[i] = n.id; }
  E.ejercitos = E.ejercitos.filter((e) => e.civ !== c.id || !rebeldes.some((x) => dist(M, x.celda, e.celda) < 3));
  c.r.cohesion = cl(c.r.cohesion + 18); c.ex.desastre += 0.3;
  // copia los contactos del padre (los rebeldes ya conocen el mundo)
  for (const r2 of Object.values(E.rel)) { if (r2.a !== c.id && r2.b !== c.id) continue; const o = r2.a === c.id ? r2.b : r2.a; const k = clave(n.id, o); E.rel[k] = { a: Math.min(n.id, o), b: Math.max(n.id, o), v: r2.v * 0.5, estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: 0, ultimaGuerra: E.año }; }
  const rel = { a: c.id, b: n.id, v: -40, estado: 'paz', desde: E.año, tregua: 0, comercio: false, senor: -1, cans: {}, bajas: {}, frontera: 0, ultimaGuerra: E.año };
  E.rel[clave(c.id, n.id)] = rel;
  if (rv(c, 'diplomacia') > 62) { rel.v = 0; rel.tregua = E.año + 30; log(E, `📜 ${rebeldes.length} ciudades de ${c.nombre} se independizan en paz: nace ${n.emblema} ${n.nombre}.`, 'logro', true, n.id); }
  else { log(E, `⚡ ¡Guerra civil en ${c.nombre}! ${rebeldes.length} ciudades se alzan y nace ${n.emblema} ${n.nombre}.`, 'malo', true, n.id); declarar(E, c, n, rel, true); }
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
  if (E.año < Math.max(E.velo, 200) + 100) return; // dejar que la historia arranque antes de declarar a nadie dominante
  const tot = vivas.reduce((s, c) => s + c.pob, 0), top = vivas.reduce((m, c) => (c.pob > m.pob ? c : m));
  const seg = vivas.filter((c) => c !== top).reduce((m, c) => Math.max(m, c.pob), 0);
  if (top.pob / tot > 0.65 && top.pob > seg * 2.5) { if (E.domina.id === top.id) E.domina.años++; else E.domina = { id: top.id, años: 1 }; } else E.domina = { id: -1, años: 0 };
  // si tras dos milenios de contacto nadie se impone, la historia juzga al más poderoso
  if (E.año >= E.velo + 2000) { const w = vivas.reduce((m, c) => (c.poder > m.poder ? c : m)); E.fin = { tipo: 'tiempo', ganador: w.id, año: E.año }; log(E, `🏆 Tras dos mil años de historia compartida, ${w.emblema} ${w.nombre} es la potencia del orbe.`, 'logro', true); return; }
  if (E.domina.años >= 50) { E.fin = { tipo: 'domina', ganador: top.id, año: E.año }; log(E, `🏆 ${top.emblema} ${top.nombre} domina el orbe: ${Math.round(top.pob / tot * 100)} % de toda la gente vive bajo su bandera.`, 'logro', true); }
}
function muestrear(E) {
  const p = {}, w = {}; for (const c of E.civs) if (c.vivo) { p[c.id] = Math.round(c.pob); w[c.id] = Math.round(poderCiv(c)); }
  E.hist.push({ a: E.año, p, w });
  if (E.hist.length > 300) E.hist = E.hist.filter((_, i) => i % 2 === 0 || i === E.hist.length - 1);
}

// ---------------------------------------------------------------- poderes del espíritu del orbe (influencia limitada por cargas)
export function usarPoder(E, tipo, celda) {
  if (E.poderes.cargas <= 0) return 'Sin cargas: el orbe recupera una cada 80 años.';
  const M = E.mapa, R = azar(hash(E.semilla + 77, E.año * 31 + celda)); E.poderes.cargas--;
  const cerca = E.ciudades.filter((c) => dist(M, c.celda, celda) < 3.5), dueno = E.dueno[celda] >= 0 ? E.civs[E.dueno[celda]] : (cerca[0] ? E.civs[cerca[0].civ] : null);
  if (tipo === 'meteorito') {
    for (let i = 0; i < M.n; i++) { const d = dist(M, i, celda); if (d < 2.2 && !esAgua(M.bioma[i])) { M.bioma[i] = d < 1 ? B.MONTANA : B.DESIERTO; E.mods[i] = M.bioma[i]; M.rio[i] = 0; } }
    for (const c of E.ciudades.filter((c) => dist(M, c.celda, celda) < 2.6)) { c.pob *= 0.08; c.fuego = 10; if (c.pob < 80) destruir(E, c); }
    E.ejercitos = E.ejercitos.filter((e) => dist(M, e.celda, celda) > 2.6);
    efecto(E, 'meteorito', celda); log(E, `☄️ Un meteorito cae del cielo cerca de ${lugar(E, celda)}.`, 'malo', true); limpiar(E); return null;
  }
  if (!dueno) { E.poderes.cargas++; return 'Toca tierras de alguna civilización.'; }
  if (tipo === 'plaga') { if (dueno.plaga) { E.poderes.cargas++; return `${dueno.nombre} ya sufre una plaga.`; } plaga(E, R, dueno, 'la Plaga del Orbe'); return null; }
  if (tipo === 'bendicion') { dueno.oro = Math.max(dueno.oro, 40); for (const c of E.ciudades) if (c.civ === dueno.id) c.pob *= 1.15; dueno.r.cohesion = cl(dueno.r.cohesion + 10); efecto(E, 'bendicion', celda); log(E, `🌟 El espíritu del orbe bendice a ${dueno.nombre}.`, 'logro', true, dueno.id); return null; }
  if (tipo === 'terremoto') {
    for (const c of E.ciudades) { const d = dist(M, c.celda, celda); if (d < 7) { c.pob *= 0.6 + d / 7 * 0.35; c.fuego = Math.max(c.fuego, d < 3 ? 3 : 0); } }
    dueno.r.cohesion = cl(dueno.r.cohesion - 8); dueno.ex.desastre += 0.4; efecto(E, 'terremoto', celda); log(E, `🌋 Un terremoto sacude las tierras de ${dueno.nombre}.`, 'malo', true, dueno.id); return null;
  }
  E.poderes.cargas++; return 'Poder desconocido.';
}

// ---------------------------------------------------------------- guardar y cargar (sin el mapa: se regenera)
export function exportar(E) { const { mapa, ...resto } = E; void mapa; return JSON.parse(JSON.stringify(resto, (k, v) => (k.startsWith('_') ? undefined : v))); }
export function importar(o) { if (!o || o.v !== 1 || !Array.isArray(o.civs)) return null; o.mapa = generarMapa(o.semilla, o.tipo, o.mods || {}); if (o.dueno.length !== o.mapa.n) return null; return o; }
export function avanzar(E, años) { for (let i = 0; i < años; i++) paso(E); return E; }
export function resumen(E) {
  return E.civs.map((c) => ({ id: c.id, nombre: c.nombre, vivo: c.vivo, pob: Math.round(c.pob), era: ERAS[c.era].n, ciudades: E.ciudades.filter((x) => x.civ === c.id).length, celdas: c.celdas, causa: c.causa, murio: c.murio }));
}
