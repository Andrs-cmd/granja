// =====================================================================
// Bóveda genética — simulación pura (sin three ni DOM), determinista con semilla.
// Un orbe con relieve y clima por zonas; plantas con genes que viven, compiten, se dispersan, mutan y se
// extinguen según el clima. Tú eres el curador de la bóveda de semillas: recolectas, guardas (las semillas
// pierden viabilidad), regeneras, cruzas variedades de la misma familia (para pasar resistencias de los
// parientes silvestres a los cultivos) y siembras. Las aldeas dependen de sus cultivos y te piden ayuda.
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';

export const CEL = 2.0, RADIO = 44;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ss = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// ---------------------------------------------------------------- genes, formas y familias
export const GENES = [
  ['frio', '❄️ Frío', 'Aguanta temperaturas bajas'], ['calor', '🔥 Calor', 'Aguanta temperaturas altas'],
  ['sequia', '🏜️ Sequía', 'Vive con poca agua'], ['humedad', '💧 Humedad', 'Vive en suelos muy húmedos'],
  ['plagas', '🛡️ Plagas', 'Resiste plagas y hongos'], ['rinde', '🌾 Rendimiento', 'Cuánto alimento da (cuesta vigor)'],
  ['vigor', '💪 Vigor', 'Qué tan rápido crece y compite'], ['dispersion', '🌬️ Dispersión', 'Qué tan lejos viajan sus semillas'],
];
export const CLAVES = GENES.map((g) => g[0]);
export const FORMAS = ['pasto', 'flor', 'arbusto', 'arbol', 'cactus', 'cereal', 'mata', 'conifera'];
export const FAMILIAS = {
  gramineas: { n: 'Gramíneas', e: '🌾', d: 'Pastos y cereales: el trigo y sus parientes silvestres.' },
  leguminosas: { n: 'Leguminosas', e: '🫘', d: 'Fríjoles, arvejas y tréboles: enriquecen el suelo.' },
  solanaceas: { n: 'Solanáceas', e: '🥔', d: 'La papa y sus parientes de montaña.' },
  frutales: { n: 'Frutales', e: '🍎', d: 'Árboles de fruto.' },
  flores: { n: 'Flores silvestres', e: '🌸', d: 'Flores que alimentan a los polinizadores.' },
  cactaceas: { n: 'Cactáceas', e: '🌵', d: 'Reinas del desierto.' },
  coniferas: { n: 'Coníferas', e: '🌲', d: 'Pinos y abetos del frío.' },
};
const GENEROS = { gramineas: ['Triticum', 'Avena', 'Hordeum', 'Festuca', 'Aegilops', 'Secale'], leguminosas: ['Phaseolus', 'Trifolium', 'Vicia', 'Lupinus', 'Lathyrus'], solanaceas: ['Solanum', 'Physalis', 'Capsicum'],
  frutales: ['Malus', 'Prunus', 'Citrus', 'Pyrus'], flores: ['Viola', 'Papaver', 'Lavandula', 'Bellis', 'Primula', 'Calendula'], cactaceas: ['Opuntia', 'Echinops', 'Cereus'], coniferas: ['Pinus', 'Abies', 'Picea', 'Larix'] };
const EPITETOS = ['borealis', 'australis', 'montana', 'robusta', 'aurea', 'silvestris', 'nivalis', 'arida', 'palustris', 'gigantea', 'nana', 'rubra', 'alba', 'ignea', 'lucida', 'ferox', 'dulcis', 'tenax', 'vivax', 'aeterna', 'magna', 'minor', 'nova', 'serena', 'tropica', 'glacialis', 'fortis', 'opulenta'];

// fitness de una especie en una celda: banda de temperatura × banda de humedad (0..1)
export function rangoT(g) { return [22 - 42 * g.frio, 16 + 28 * g.calor]; }
export function rangoH(g) { return [0.55 - 0.55 * g.sequia, 0.45 + 0.55 * g.humedad]; }
export function aptitud(g, t, h) {
  const [tMin, tMax] = rangoT(g), [hMin, hMax] = rangoH(g);
  return ss(tMin - 6, tMin, t) * (1 - ss(tMax, tMax + 6, t)) * ss(hMin - 0.15, hMin, h) * (1 - ss(hMax, hMax + 0.15, h));
}
// generalistas crecen más lento (tolerarlo todo cuesta), y el rendimiento le roba vigor
function tasa(sp) { const g = sp.g, amp = (g.frio + g.calor + g.sequia + g.humedad) / 4; return (0.22 + 0.62 * g.vigor) * (1.18 - 0.62 * amp) * (1 - 0.35 * g.rinde) * (sp.cultivo ? 0.45 : 1); }

// ---------------------------------------------------------------- el mapa
export function generarMapa(semilla) {
  const n0 = ruido2D(semilla), n1 = ruido2D(semilla + 7), n2 = ruido2D(semilla + 13), cols = Math.ceil((RADIO * 2) / CEL);
  const M = { cols, n: 0, x: [], z: [], elev: [], hum0: [], lat: [], agua: [], vec: [], idx: new Int32Array(cols * cols).fill(-1) };
  for (let r = 0; r < cols; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) * CEL - RADIO, z = (r + 0.5) * CEL - RADIO; if (Math.hypot(x, z) > RADIO - 1) continue;
    let e = n0(x / 22, z / 22) * 0.6 + n0(x / 9, z / 9) * 0.3 + n0(x / 4, z / 4) * 0.1; e = cl((e - 0.22) * 1.45);
    const i = M.n++; M.idx[r * cols + c] = i; M.x.push(x); M.z.push(z); M.elev.push(e);
    M.hum0.push(cl(n1(x / 18, z / 18) * 0.8 + n2(x / 7, z / 7) * 0.35 - 0.1)); M.lat.push(-z / RADIO); M.agua.push(e < 0.13 ? 1 : 0);
  }
  for (let r = 0; r < cols; r++) for (let c = 0; c < cols; c++) { const i = M.idx[r * cols + c]; if (i < 0) continue; const v = []; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= cols || cc >= cols) continue; const j = M.idx[rr * cols + cc]; if (j >= 0) v.push(j); } M.vec.push(v); }
  // la humedad sube cerca del agua
  const cerca = M.agua.map((a, i) => (a ? 1 : M.vec[i].some((j) => M.agua[j]) ? 0.6 : 0));
  for (let i = 0; i < M.n; i++) M.hum0[i] = cl(M.hum0[i] + cerca[i] * 0.25);
  return M;
}
// clima local: el norte es más frío, la montaña más fría y seca
export function climaCelda(E, i) {
  const M = E.mapa, t = E.clima.T + M.lat[i] * 13 - Math.max(0, M.elev[i] - 0.3) * 30, h = cl(M.hum0[i] * E.clima.lluvia - Math.max(0, M.elev[i] - 0.6) * 0.3);
  return [t, h];
}

// ---------------------------------------------------------------- creación
let _id = 0;
function nombreEsp(R, fam) { const g = GENEROS[fam], e = EPITETOS; return `${g[Math.floor(R() * g.length)]} ${e[Math.floor(R() * e.length)]}`; }
function nuevaEspecie(E, R, base) {
  const sp = { id: E.sig.sp++, nombre: base.nombre || nombreEsp(R, base.fam), comun: base.comun || null, fam: base.fam, forma: base.forma, hue: base.hue, flor: base.flor ?? -1, cultivo: !!base.cultivo, g: { ...base.g },
    nace: E.año, extinta: null, padres: base.padres || null, origen: base.origen || 'silvestre', total: 0, max: 0, vista: base.vista ?? false, gen: base.gen || 0 };
  for (const k of CLAVES) sp.g[k] = Math.round(cl(sp.g[k] ?? 0.5) * 100) / 100;
  sp.b = new Float32Array(E.mapa.n); E.especies.push(sp); return sp;
}
const G = (frio, calor, sequia, humedad, plagas, rinde, vigor, dispersion) => ({ frio, calor, sequia, humedad, plagas, rinde, vigor, dispersion });
// especies iniciales: cultivos y sus parientes silvestres (que guardan genes de resistencia), más la flora del orbe
const INICIALES = [
  { comun: 'Trigo de las aldeas', fam: 'gramineas', forma: 'cereal', hue: 0.12, cultivo: true, g: G(0.32, 0.3, 0.25, 0.3, 0.2, 0.82, 0.35, 0.2) },
  { comun: 'Trigo silvestre de la nieve', fam: 'gramineas', forma: 'pasto', hue: 0.2, g: G(0.85, 0.15, 0.4, 0.3, 0.55, 0.15, 0.6, 0.5) },
  { comun: 'Egílope del desierto', fam: 'gramineas', forma: 'pasto', hue: 0.15, g: G(0.15, 0.85, 0.85, 0.1, 0.5, 0.12, 0.55, 0.55) },
  { comun: 'Avena brava', fam: 'gramineas', forma: 'pasto', hue: 0.24, g: G(0.5, 0.5, 0.4, 0.5, 0.88, 0.1, 0.6, 0.6) },
  { comun: 'Festuca común', fam: 'gramineas', forma: 'pasto', hue: 0.27, g: G(0.55, 0.5, 0.5, 0.5, 0.45, 0.08, 0.75, 0.65) },
  { comun: 'Fríjol de las aldeas', fam: 'leguminosas', forma: 'mata', hue: 0.3, flor: 0.85, cultivo: true, g: G(0.2, 0.42, 0.22, 0.35, 0.22, 0.78, 0.35, 0.2) },
  { comun: 'Trébol de pradera', fam: 'leguminosas', forma: 'flor', hue: 0.3, flor: 0.9, g: G(0.55, 0.45, 0.35, 0.55, 0.6, 0.1, 0.7, 0.5) },
  { comun: 'Altramuz de dunas', fam: 'leguminosas', forma: 'flor', hue: 0.28, flor: 0.7, g: G(0.2, 0.8, 0.8, 0.15, 0.7, 0.12, 0.5, 0.45) },
  { comun: 'Papa de las aldeas', fam: 'solanaceas', forma: 'mata', hue: 0.32, flor: 0.75, cultivo: true, g: G(0.42, 0.22, 0.22, 0.38, 0.15, 0.82, 0.35, 0.15) },
  { comun: 'Papa amarga de páramo', fam: 'solanaceas', forma: 'mata', hue: 0.34, flor: 0.65, g: G(0.9, 0.1, 0.35, 0.55, 0.65, 0.18, 0.5, 0.35) },
  { comun: 'Uchuva silvestre', fam: 'solanaceas', forma: 'arbusto', hue: 0.3, flor: 0.14, g: G(0.3, 0.7, 0.4, 0.45, 0.85, 0.15, 0.55, 0.45) },
  { comun: 'Manzano silvestre', fam: 'frutales', forma: 'arbol', hue: 0.3, flor: 0.95, g: G(0.6, 0.35, 0.3, 0.5, 0.5, 0.3, 0.4, 0.35) },
  { comun: 'Naranjo de la costa', fam: 'frutales', forma: 'arbol', hue: 0.33, flor: 0.1, g: G(0.15, 0.75, 0.35, 0.55, 0.45, 0.35, 0.45, 0.3) },
  { comun: 'Amapola roja', fam: 'flores', forma: 'flor', hue: 0.28, flor: 0.0, g: G(0.45, 0.55, 0.5, 0.35, 0.5, 0.02, 0.8, 0.8) },
  { comun: 'Violeta de sombra', fam: 'flores', forma: 'flor', hue: 0.33, flor: 0.75, g: G(0.6, 0.3, 0.2, 0.75, 0.55, 0.02, 0.6, 0.55) },
  { comun: 'Lavanda de ladera', fam: 'flores', forma: 'arbusto', hue: 0.4, flor: 0.72, g: G(0.35, 0.7, 0.75, 0.2, 0.7, 0.05, 0.55, 0.5) },
  { comun: 'Prímula de nieve', fam: 'flores', forma: 'flor', hue: 0.3, flor: 0.15, g: G(0.92, 0.08, 0.35, 0.6, 0.5, 0.02, 0.5, 0.5) },
  { comun: 'Nopal', fam: 'cactaceas', forma: 'cactus', hue: 0.35, flor: 0.1, g: G(0.1, 0.95, 0.97, 0.05, 0.75, 0.2, 0.4, 0.3) },
  { comun: 'Cardón gigante', fam: 'cactaceas', forma: 'cactus', hue: 0.37, flor: 0.95, g: G(0.25, 0.85, 0.92, 0.05, 0.6, 0.05, 0.3, 0.25) },
  { comun: 'Pino de montaña', fam: 'coniferas', forma: 'conifera', hue: 0.38, g: G(0.85, 0.25, 0.5, 0.45, 0.6, 0.05, 0.45, 0.35) },
  { comun: 'Abeto de los lagos', fam: 'coniferas', forma: 'conifera', hue: 0.4, g: G(0.75, 0.2, 0.2, 0.8, 0.5, 0.05, 0.5, 0.3) },
];
// aldeas: viven de un cultivo y piden ayuda si se les muere
const ALDEAS = [['Valleverde', 'gramineas'], ['Los Fríjoles', 'leguminosas'], ['Alto Paramo', 'solanaceas']];

export function crearMundo(semilla = 1) {
  semilla = (semilla >>> 0) || 1;
  const M = generarMapa(semilla), R = azar(semilla ^ 0xabcdef);
  const E = { v: 1, semilla, año: 0, mapa: M, clima: { T: 13, lluvia: 1, objT: 13, objLl: 1 }, especies: [], aldeas: [], boveda: [], peticiones: [], eventos: [], diario: [], hitos: [], hist: [], efectos: [],
    fondos: 120, reputacion: 0, mejoras: { capacidad: 0, frio: 0, energia: 0, lab: 0, invernadero: 0 }, invernadero: [], sig: { sp: 0, sem: 0, pet: 0, ef: 0 }, stats: { recolectas: 0, cruces: 0, siembras: 0, rescates: 0, extinciones: 0, variedades: 0, entregas: 0 } };
  for (const b of INICIALES) { const sp = nuevaEspecie(E, R, { ...b, nombre: nombreEsp(R, b.fam), vista: b.cultivo }); sembrarInicial(E, R, sp); }
  // aldeas con sus campos: en tierra templada y apta para su cultivo
  for (const [nombre, fam] of ALDEAS) {
    const crop = E.especies.find((s) => s.cultivo && s.fam === fam);
    let mejor = -1, mf = -1; for (let k = 0; k < 400; k++) { const i = Math.floor(R() * M.n); if (M.agua[i] || E.aldeas.some((a) => dist(M, a.celda, i) < 14)) continue; const [t, h] = climaCelda(E, i), f = aptitud(crop.g, t, h) + R() * 0.1; if (f > mf) { mf = f; mejor = i; } }
    const campos = celdasCerca(M, mejor, 3.2).filter((j) => !M.agua[j]).slice(0, 12);
    E.aldeas.push({ nombre, fam, celda: mejor, campos, cultivo: crop.id, pob: 120, comida: 1, malos: 0, pidio: false, viva: true, hist: [] });
  }
  log(E, '🏛️ Abre la bóveda genética del orbe. Tu misión: que ninguna especie se pierda para siempre.', 'logro', true);
  muestrear(E);
  return E;
}
function sembrarInicial(E, R, sp) {
  const M = E.mapa; let n = 0;
  for (let k = 0; k < 900 && n < 60; k++) { const i = Math.floor(R() * M.n); if (M.agua[i]) continue; const [t, h] = climaCelda(E, i); const f = aptitud(sp.g, t, h); if (f > 0.5 && R() < f) { sp.b[i] = Math.max(sp.b[i], 0.2 + R() * 0.3); n++; } }
}
export const dist = (M, i, j) => Math.hypot(M.x[i] - M.x[j], M.z[i] - M.z[j]) / CEL;
export function celdasCerca(M, i, r) { const l = []; for (let j = 0; j < M.n; j++) if (dist(M, i, j) <= r) l.push(j); return l.sort((a, b) => dist(M, i, a) - dist(M, i, b)); }
export function celdaCercana(M, x, z) { const c = Math.floor((x + RADIO) / CEL), r = Math.floor((z + RADIO) / CEL); if (c < 0 || r < 0 || c >= M.cols || r >= M.cols) return -1; return M.idx[r * M.cols + c]; }

// ---------------------------------------------------------------- diario y efectos
function log(E, texto, tipo = '', hito = false) { const l = { d: E.año, texto, tipo }; E.diario.unshift(l); if (E.diario.length > 200) E.diario.length = 200; if (hito) { E.hitos.unshift(l); if (E.hitos.length > 150) E.hitos.length = 150; } }
function efecto(E, t, celda, extra = {}) { E.efectos.push({ id: E.sig.ef++, t, celda, año: E.año, ...extra }); if (E.efectos.length > 60) E.efectos.splice(0, E.efectos.length - 60); }
const vivas = (E) => E.especies.filter((s) => s.extinta == null);
export const especie = (E, id) => E.especies.find((s) => s.id === id);

// ---------------------------------------------------------------- un año
const MAX_VIVAS = 70;
export function paso(E) {
  const R = azar(hash(E.semilla, E.año + 1)), M = E.mapa; E.año++;
  climaDelAño(E, R);
  // clima de cada celda (una vez por año)
  const T = new Float32Array(M.n), H = new Float32Array(M.n), tot = new Float32Array(M.n);
  for (let i = 0; i < M.n; i++) { const [t, h] = climaCelda(E, i); T[i] = t; H[i] = h; }
  const L = vivas(E);
  for (const sp of L) for (let i = 0; i < M.n; i++) tot[i] += sp.b[i];
  // plagas activas: matan según la resistencia
  const plagas = E.eventos.filter((v) => v.tipo === 'plaga' && v.hasta >= E.año);
  // crecer, competir, dispersarse
  for (const sp of L) {
    const r = tasa(sp), g = sp.g, disp = 0.04 + g.dispersion * 0.12, b = sp.b, nb = new Float32Array(M.n);
    let s = 0, mx = 0;
    for (let i = 0; i < M.n; i++) {
      const v = b[i]; if (v < 1e-4) continue;
      if (M.agua[i]) continue;
      let f = aptitud(g, T[i], H[i]); if (sp.forma === 'arbol' || sp.forma === 'conifera') f *= M.elev[i] > 0.85 ? 0.2 : 1;
      let x = v + r * v * (f - tot[i]) - v * 0.02;
      for (const p of plagas) if (p.fam === sp.fam && Math.hypot(M.x[i] - M.x[p.celda], M.z[i] - M.z[p.celda]) < p.r * CEL) x *= 0.45 + 0.55 * g.plagas;
      for (const z of E.eventos) if (z.hasta >= E.año && (z.tipo === 'incendio' || z.tipo === 'inundacion') && Math.hypot(M.x[i] - M.x[z.celda], M.z[i] - M.z[z.celda]) < z.r * CEL && (z.tipo === 'incendio' ? sp.forma !== 'cactus' : M.elev[i] < 0.3)) x *= z.tipo === 'incendio' ? 0.35 : 0.5;
      x = Math.max(0, x); const sale = x * disp * Math.min(1, f + 0.2);
      nb[i] += x - sale; const vs = M.vec[i]; for (const j of vs) nb[j] += sale / vs.length;
      if (R() < g.dispersion * 0.004 * v) { const j = Math.floor(R() * M.n); if (!M.agua[j]) nb[j] += 0.02; }   // semillas que el viento o los pájaros llevan lejos
    }
    for (let i = 0; i < M.n; i++) { if (nb[i] < 2e-4) nb[i] = 0; else if (nb[i] > 1.2) nb[i] = 1.2; s += nb[i]; if (nb[i] > mx) mx = nb[i]; }
    sp.b = nb; sp.total = s; sp.max = Math.max(sp.max, s);
  }
  // los cultivos se mantienen en los campos de las aldeas
  for (const a of E.aldeas) if (a.viva) { const sp = especie(E, a.cultivo); if (sp && sp.extinta == null) for (const i of a.campos) sp.b[i] = Math.max(sp.b[i], 0.5 * cl(a.comida + 0.2)); }
  // extinciones y mutaciones (variedades nuevas)
  for (const sp of L) {
    if (sp.total < 0.03 && !E.aldeas.some((a) => a.viva && a.cultivo === sp.id)) {
      sp.extinta = E.año; sp.b.fill(0); E.stats.extinciones++;
      const enBov = E.boveda.some((m) => m.sp === sp.id && m.viab > 0);
      log(E, `${enBov ? '🕯️' : '💀'} Se extingue ${sp.comun || sp.nombre} (${FAMILIAS[sp.fam].n}).${enBov ? ' Por suerte hay semillas en la bóveda.' : ' No quedaba ninguna semilla guardada.'}`, enBov ? '' : 'malo', sp.origen !== 'mutación' || sp.vista || enBov);
    }
  }
  const L2 = vivas(E);
  if (L2.length < MAX_VIVAS) for (const sp of L2) {
    if (sp.cultivo || sp.total < 4) continue;
    if (R() < 0.0035 * (0.5 + sp.g.vigor) * Math.sqrt(sp.total) / 3) mutar(E, R, sp);
  }
  // aldeas, peticiones, bóveda
  aldeasDelAño(E, R, T, H);
  bovedaDelAño(E, R);
  eventosDelAño(E, R);
  // fondos: una beca que crece con la biodiversidad guardada y la reputación
  const enBov = new Set(E.boveda.filter((m) => m.viab > 0.05).map((m) => m.sp)).size;
  E.fondos += 2.5 + vivas(E).length * 0.04 + enBov * 0.18 + Math.min(30, E.reputacion) * 0.2 + seguridad(E) * 3;
  if (E.año % 5 === 0) muestrear(E);
  return E;
}
function mutar(E, R, sp) {
  const M = E.mapa, ocup = []; for (let i = 0; i < M.n; i++) if (sp.b[i] > 0.15) ocup.push(i); if (!ocup.length) return;
  const g = { ...sp.g }, ks = CLAVES.filter((k) => k !== 'rinde').sort(() => R() - 0.5).slice(0, 2 + Math.floor(R() * 2));
  for (const k of ks) g[k] = cl(g[k] + (R() - 0.5) * 0.3);
  const hija = nuevaEspecie(E, R, { fam: sp.fam, forma: sp.forma, hue: cl(sp.hue + (R() - 0.5) * 0.06, 0.1, 0.45), flor: sp.flor >= 0 ? (sp.flor + (R() - 0.5) * 0.15 + 1) % 1 : -1, g, padres: [sp.id], origen: 'mutación', gen: sp.gen + 1, comun: `${sp.comun ? sp.comun.split(' ')[0] : 'Variedad'} ${EPITETOS[Math.floor(R() * EPITETOS.length)]}` });
  const i0 = ocup[Math.floor(R() * ocup.length)]; for (const j of [i0, ...M.vec[i0]]) { const q = sp.b[j] * 0.4; hija.b[j] += q; sp.b[j] -= q; }
  E.stats.variedades++;
  const cambio = ks.map((k) => `${GENES.find((x) => x[0] === k)[1]} ${g[k] > sp.g[k] ? '▲' : '▼'}`).join(', ');
  log(E, `🧬 Una mutación da origen a ${hija.comun} (de ${sp.comun || sp.nombre}): ${cambio}.`, '', false);
  efecto(E, 'mutacion', i0, { sp: hija.id });
}

// ---------------------------------------------------------------- clima: tendencias, eventos y el calentamiento lento
function climaDelAño(E, R) {
  const C = E.clima;
  if (E.año > 150) C.objT += 0.006;   // la civilización calienta el orbe de a poco
  C.T += (C.objT - C.T) * 0.08 + (R() - 0.5) * 0.25; C.lluvia += (C.objLl - C.lluvia) * 0.1 + (R() - 0.5) * 0.03;
  C.lluvia = cl(C.lluvia, 0.3, 1.6);
  for (const v of E.eventos) if (v.hasta === E.año) { if (v.dT) C.objT -= v.dT; if (v.dLl) C.objLl -= v.dLl; if (v.fin) log(E, v.fin, 'bueno', false); }
  E.eventos = E.eventos.filter((v) => v.hasta >= E.año);
}
const EVENTOS = [
  ['sequia', 18, (E, R) => ({ dLl: -0.38, años: 12 + Math.floor(R() * 14), txt: '🏜️ Empieza una gran sequía: los suelos se secan en todo el orbe.', fin: '🌧️ Vuelven las lluvias tras la sequía.' })],
  ['calor', 14, (E, R) => ({ dT: 4.5, años: 12 + Math.floor(R() * 10), txt: '🔥 Una ola de calor de varios años golpea el orbe.', fin: '🌤️ Termina la ola de calor.' })],
  ['glaciacion', 6, (E, R) => ({ dT: -8, años: 50 + Math.floor(R() * 50), txt: '🧊 Una pequeña edad de hielo cubre el orbe: el frío avanza desde el norte.', fin: '☀️ El hielo retrocede: termina la pequeña edad de hielo.' })],
  ['lluvias', 10, (E, R) => ({ dLl: 0.3, años: 10 + Math.floor(R() * 10), txt: '🌧️ Décadas de lluvias: los suelos se encharcan.', fin: '🌤️ Termina la época de lluvias.' })],
  ['plaga', 16, (E, R) => { const fs = ['gramineas', 'leguminosas', 'solanaceas', 'frutales', 'flores'], fam = fs[Math.floor(R() * fs.length)], nom = { gramineas: 'la roya negra', leguminosas: 'el gorgojo', solanaceas: 'el tizón', frutales: 'la mosca de la fruta', flores: 'el pulgón' }[fam]; return { fam, r: 14 + R() * 18, años: 8 + Math.floor(R() * 8), txt: `🦠 Brota ${nom}: ataca a las ${FAMILIAS[fam].n.toLowerCase()}. Solo las variedades resistentes sobreviven.`, fin: `Pasa la plaga de ${nom}.`, nom }; }],
  ['incendio', 10, (E, R) => ({ r: 5 + R() * 6, años: 2, txt: '🔥 Un gran incendio arrasa la vegetación de una región.' })],
  ['inundacion', 7, (E, R) => ({ r: 7 + R() * 6, años: 2, txt: '🌊 Una inundación anega las tierras bajas.' })],
];
function eventosDelAño(E, R) {
  if (E.año < 15 || E.eventos.some((v) => v.grande && v.hasta > E.año) || R() > 0.035 + Math.min(0.02, E.año / 20000)) return;
  const tot = EVENTOS.reduce((s, e) => s + e[1], 0); let x = R() * tot, ev = EVENTOS[0]; for (const e of EVENTOS) { x -= e[1]; if (x <= 0) { ev = e; break; } }
  const M = E.mapa, d = ev[2](E, R), celda = (() => { for (let k = 0; k < 50; k++) { const i = Math.floor(R() * M.n); if (!M.agua[i]) return i; } return 0; })();
  const v = { tipo: ev[0], celda, hasta: E.año + d.años, ...d, grande: ev[0] !== 'incendio' && ev[0] !== 'inundacion' };
  if (d.dT) E.clima.objT += d.dT; if (d.dLl) E.clima.objLl += d.dLl;
  E.eventos.push(v); log(E, d.txt, 'malo', true); efecto(E, ev[0], celda, { r: d.r || 0 });
}

// ---------------------------------------------------------------- aldeas y sus pedidos
export function rendimiento(E, a, sp, T, H) {
  const M = E.mapa; if (!sp || sp.extinta != null) return 0; let s = 0;
  for (const i of a.campos) { const [t, h] = T ? [T[i], H[i]] : climaCelda(E, i); s += aptitud(sp.g, t, h); }
  let f = s / a.campos.length;
  for (const p of E.eventos) if (p.tipo === 'plaga' && p.fam === sp.fam && Math.hypot(M.x[a.celda] - M.x[p.celda], M.z[a.celda] - M.z[p.celda]) < (p.r + 4) * CEL) f *= 0.3 + 0.7 * sp.g.plagas;
  return f * (0.45 + sp.g.rinde * 0.75);
}
export const seguridad = (E) => { const v = E.aldeas.filter((a) => a.viva); return v.length ? v.reduce((s, a) => s + Math.min(1, a.comida), 0) / v.length : 0; };
function aldeasDelAño(E, R, T, H) {
  for (const a of E.aldeas) {
    if (!a.viva) continue;
    const sp = especie(E, a.cultivo), y = rendimiento(E, a, sp, T, H);
    a.comida = a.comida * 0.6 + y * 0.4; a.pob = Math.max(0, a.pob * (1 + (a.comida - 0.6) * 0.04));
    a.malos = a.comida < 0.5 ? a.malos + 1 : Math.max(0, a.malos - 1);
    if (E.año % 5 === 0) { a.hist.push(Math.round(a.comida * 100)); if (a.hist.length > 120) a.hist.shift(); }
    // pide ayuda: describe lo que necesita (el clima de sus campos y la plaga si la hay)
    if (a.malos >= 3 && !E.peticiones.some((p) => p.aldea === a.nombre && !p.cerrada)) {
      const ts = a.campos.map((i) => T[i]), hs = a.campos.map((i) => H[i]), t = ts.reduce((s, x) => s + x, 0) / ts.length, h = hs.reduce((s, x) => s + x, 0) / hs.length;
      const plaga = E.eventos.find((p) => p.tipo === 'plaga' && p.fam === a.fam);
      const p = { id: E.sig.pet++, aldea: a.nombre, fam: a.fam, t: Math.round(t * 10) / 10, h: Math.round(h * 100) / 100, plaga: plaga ? 0.6 : 0, nomPlaga: plaga?.nom || null, rinde: 0.35, desde: E.año, vence: E.año + 18, cerrada: false, premio: 120 + Math.round(R() * 80) };
      const pide = []; if (aptitud(sp.g, t, h) < 0.5) pide.push(t < 8 ? `que aguante el frío (${p.t} °C)` : t > 24 ? `que aguante el calor (${p.t} °C)` : `que se dé con ${p.t} °C`); if (h < 0.3 && sp.g.sequia < 0.6) pide.push('que resista la sequía'); if (h > 0.7 && sp.g.humedad < 0.6) pide.push('que aguante la humedad'); if (plaga) pide.push(`que resista ${plaga.nom}`);
      p.texto = `${a.nombre} pide una variedad de ${FAMILIAS[a.fam].n.toLowerCase()} ${pide.join(', ') || 'que rinda en sus campos'}. Sus cosechas fallan.`;
      E.peticiones.push(p); log(E, `📜 ${p.texto}`, 'malo', true); efecto(E, 'peticion', a.celda);
    }
    if (a.comida < 0.2 && a.malos > 12) { a.viva = false; log(E, `🏚️ ${a.nombre} es abandonada: el hambre empuja a su gente a irse.`, 'malo', true); efecto(E, 'abandono', a.celda); E.reputacion = Math.max(0, E.reputacion - 4); }
  }
  for (const p of E.peticiones) if (!p.cerrada && E.año > p.vence) { p.cerrada = true; p.fallo = true; E.reputacion = Math.max(0, E.reputacion - 2); log(E, `⌛ Nadie respondió al pedido de ${p.aldea}.`, 'malo', false); }
  if (E.peticiones.length > 30) E.peticiones = E.peticiones.slice(-30);
}
// ¿esta muestra sirve para el pedido? (cuánto rendiría en sus campos)
export function evaluarEntrega(E, pid, mid) {
  const p = E.peticiones.find((x) => x.id === pid), m = E.boveda.find((x) => x.id === mid); if (!p || !m) return null;
  const sp = especie(E, m.sp), a = E.aldeas.find((x) => x.nombre === p.aldea); if (!sp || !a) return null;
  const fam = sp.fam === p.fam, apt = aptitud(sp.g, p.t, p.h), plaga = !p.plaga || sp.g.plagas >= p.plaga, rinde = sp.g.rinde >= p.rinde;
  const y = rendimiento(E, a, { ...sp, extinta: null });
  return { ok: fam && apt >= 0.55 && plaga && rinde && m.viab > 0.2, fam, apt, plaga, rinde, viab: m.viab, y };
}
export function entregar(E, pid, mid) {
  const ev = evaluarEntrega(E, pid, mid); if (!ev) return 'No se encontró.';
  if (!ev.fam) return 'Tiene que ser de la misma familia que su cultivo.';
  if (!ev.rinde) return 'Rinde muy poco para alimentar una aldea (rendimiento menor a 35).';
  if (ev.apt < 0.55) return 'No se daría bien en el clima de sus campos.';
  if (!ev.plaga) return 'No resiste la plaga que los azota.';
  if (ev.viab <= 0.2) return 'Las semillas están casi muertas: regenéralas primero.';
  const p = E.peticiones.find((x) => x.id === pid), m = E.boveda.find((x) => x.id === mid), a = E.aldeas.find((x) => x.nombre === p.aldea), sp = especie(E, m.sp);
  if (sp.extinta != null) { if (!sp.soloBoveda) E.stats.rescates++; sp.extinta = null; } sp.soloBoveda = false;
  sp.cultivo = true; a.cultivo = sp.id; a.malos = 0; a.comida = Math.max(a.comida, 0.5); p.cerrada = true; p.ok = true;
  for (const i of a.campos) sp.b[i] = Math.max(sp.b[i], 0.5);
  E.fondos += p.premio; E.reputacion += 5; E.stats.entregas++;
  log(E, `🌾 Entregaste ${sp.comun || sp.nombre} a ${a.nombre}: sus campos vuelven a dar. +${p.premio} fondos.`, 'logro', true); efecto(E, 'entrega', a.celda);
  return null;
}

// ---------------------------------------------------------------- la bóveda
export const MEJORAS = {
  capacidad: { n: 'Más cajones', e: '🗄️', niveles: [[0, 24], [140, 48], [360, 96]], d: 'Cuántas muestras caben.' },
  frio: { n: 'Refrigeración', e: '🧊', niveles: [[0, 0.032], [160, 0.016], [380, 0.006]], d: 'Las semillas pierden viabilidad más despacio.' },
  energia: { n: 'Generador propio', e: '⚡', niveles: [[0, 0], [220, 1]], d: 'Los apagones ya no dañan las semillas.' },
  lab: { n: 'Laboratorio genético', e: '🔬', niveles: [[0, 0.08], [180, 0.05], [420, 0.025]], d: 'Cruces más precisos (menos azar) y predicción del resultado.' },
  invernadero: { n: 'Invernadero', e: '🏡', niveles: [[0, 2], [170, 4], [400, 8]], d: 'Cupos para regenerar semillas (renovar su viabilidad).' },
};
export const nivelDe = (E, k) => MEJORAS[k].niveles[E.mejoras[k]][1];
export const capacidad = (E) => nivelDe(E, 'capacidad');
export const COSTOS = { recolectar: 4, sembrar: 6, cruzar: 14, regenerar: 8 };
function bovedaDelAño(E, R) {
  const k = nivelDe(E, 'frio');
  for (const m of E.boveda) m.viab = Math.max(0, m.viab - k * (0.6 + R() * 0.8));
  // apagones (sin generador): se calienta la bóveda
  if (!nivelDe(E, 'energia') && E.año > 20 && R() < 0.018) { for (const m of E.boveda) m.viab *= 0.72; log(E, '⚡ Un apagón calienta la bóveda: todas las semillas pierden viabilidad. Un generador lo evitaría.', 'malo', true); efecto(E, 'apagon', -1); }
  for (const m of E.boveda) if (m.viab <= 0 && !m.muerta) { m.muerta = true; const sp = especie(E, m.sp); log(E, `🥀 Murieron las semillas de ${sp?.comun || sp?.nombre} en el cajón ${m.cajon}.`, 'malo', false); }
  // invernadero: las que terminan de regenerarse vuelven con viabilidad completa y más semillas
  for (const r of E.invernadero) if (r.listo <= E.año) { const m = E.boveda.find((x) => x.id === r.m); if (m) { m.viab = 1; m.cant = Math.min(5, (m.cant || 1) + 2); m.regen = (m.regen || 0) + 1; const sp = especie(E, m.sp); log(E, `🏡 Regeneradas en el invernadero: ${sp?.comun || sp?.nombre} (viabilidad 100 %).`, 'bueno', false); } }
  E.invernadero = E.invernadero.filter((r) => r.listo > E.año);
}
function cajonLibre(E) { const usados = new Set(E.boveda.map((m) => m.cajon)); for (let c = 1; c <= capacidad(E); c++) if (!usados.has(c)) return c; return -1; }
export function recolectar(E, spId, celda) {
  const sp = especie(E, spId); if (!sp || sp.extinta != null) return 'Esa especie ya no vive aquí.';
  if (celda != null && sp.b[celda] < 0.05) return 'Aquí casi no hay de esa planta.';
  if (E.fondos < COSTOS.recolectar) return 'Faltan fondos.';
  const ya = E.boveda.find((m) => m.sp === spId && !m.muerta);
  if (ya) { if (ya.viab > 0.85) return 'Ya tienes semillas frescas de esa especie.'; ya.viab = 1; ya.cant = Math.min(5, (ya.cant || 1) + 1); E.fondos -= COSTOS.recolectar; log(E, `🌰 Renovaste las semillas de ${sp.comun || sp.nombre} con plantas del campo.`, 'bueno', false); return null; }
  const c = cajonLibre(E); if (c < 0) return 'La bóveda está llena: amplíala o descarta muestras.';
  E.fondos -= COSTOS.recolectar; sp.vista = true;
  E.boveda.push({ id: E.sig.sem++, sp: spId, viab: 1, cant: 2, cajon: c, año: E.año, celda });
  E.stats.recolectas++; log(E, `🌰 Guardaste semillas de ${sp.comun || sp.nombre} en el cajón ${c}.`, 'bueno', false); if (celda != null) efecto(E, 'recolecta', celda);
  return null;
}
export function descartar(E, mid) { E.boveda = E.boveda.filter((m) => m.id !== mid); E.invernadero = E.invernadero.filter((r) => r.m !== mid); return null; }
export function regenerar(E, mid) {
  const m = E.boveda.find((x) => x.id === mid); if (!m) return 'No se encontró.'; if (m.muerta) return 'Esas semillas ya están muertas.';
  if (E.invernadero.some((r) => r.m === mid)) return 'Ya se está regenerando.';
  if (E.invernadero.length >= nivelDe(E, 'invernadero')) return 'El invernadero está lleno: amplíalo o espera.';
  if (E.fondos < COSTOS.regenerar) return 'Faltan fondos.';
  E.fondos -= COSTOS.regenerar; E.invernadero.push({ m: mid, listo: E.año + 4 }); return null;
}
export function sembrar(E, mid, celda) {
  const m = E.boveda.find((x) => x.id === mid), M = E.mapa; if (!m) return 'No se encontró.'; if (m.muerta || m.viab <= 0.05) return 'Esas semillas ya no germinan.';
  if (celda == null || celda < 0 || M.agua[celda]) return 'Siembra en tierra firme.'; if (E.fondos < COSTOS.sembrar) return 'Faltan fondos.';
  const sp = especie(E, m.sp); if (!sp) return 'No se encontró la especie.';
  E.fondos -= COSTOS.sembrar; m.cant = Math.max(0, (m.cant || 1) - 1);
  const nueva = !!sp.soloBoveda, rev = sp.extinta != null && !nueva; if (sp.extinta != null) sp.extinta = null; sp.soloBoveda = false; if (rev) E.stats.rescates++;
  const q = 0.12 + m.viab * 0.25; for (const j of [celda, ...M.vec[celda]]) sp.b[j] = Math.max(sp.b[j], q);
  E.stats.siembras++; sp.vista = true;
  log(E, rev ? `🌱 ¡${sp.comun || sp.nombre} vuelve a la vida! La sembraste desde la bóveda.` : nueva ? `🌱 ${sp.comun} crece por primera vez en el orbe.` : `🌱 Sembraste ${sp.comun || sp.nombre}.`, rev || nueva ? 'logro' : 'bueno', rev || nueva); efecto(E, 'siembra', celda, { sp: sp.id });
  if (m.cant <= 0) { m.viab *= 0.5; m.cant = 1; }
  return null;
}
// cruzar dos muestras de la misma familia: hijo con genes mezclados (y algo de azar según el laboratorio)
export function predecirCruce(E, ma, mb) {
  const A = especie(E, E.boveda.find((m) => m.id === ma)?.sp), Bb = especie(E, E.boveda.find((m) => m.id === mb)?.sp); if (!A || !Bb) return null;
  const ruido = nivelDe(E, 'lab'), g = {};
  for (const k of CLAVES) { const lo = Math.min(A.g[k], Bb.g[k]), hi = Math.max(A.g[k], Bb.g[k]); g[k] = [cl(lo - ruido), cl(hi + ruido), (A.g[k] + Bb.g[k]) / 2]; }
  return { A, B: Bb, g, misma: A.fam === Bb.fam };
}
export function cruzar(E, ma, mb, nombre) {
  const mA = E.boveda.find((m) => m.id === ma), mB = E.boveda.find((m) => m.id === mb);
  if (!mA || !mB || ma === mb) return { err: 'Elige dos muestras distintas.' };
  const A = especie(E, mA.sp), Bb = especie(E, mB.sp); if (A.fam !== Bb.fam) return { err: 'Solo se cruzan especies de la misma familia.' };
  if (mA.viab < 0.1 || mB.viab < 0.1) return { err: 'Alguna de las semillas está casi muerta.' };
  if (E.fondos < COSTOS.cruzar) return { err: 'Faltan fondos.' };
  const c = cajonLibre(E); if (c < 0) return { err: 'La bóveda está llena.' };
  const R = azar(hash(E.semilla + 991, E.año * 131 + ma * 17 + mb * 7 + E.stats.cruces)), ruido = nivelDe(E, 'lab'), g = {};
  // cada gen sale de uno de los padres, de la mezcla, con un poco de azar (como en el campo)
  for (const k of CLAVES) { const u = R(); g[k] = cl((u < 0.35 ? A.g[k] : u < 0.7 ? Bb.g[k] : (A.g[k] + Bb.g[k]) / 2) + (R() - 0.5) * 2 * ruido); }
  const cultivo = A.cultivo || Bb.cultivo, forma = (cultivo ? (A.cultivo ? A : Bb) : A.g.vigor > Bb.g.vigor ? A : Bb).forma;
  const sp = nuevaEspecie(E, R, { fam: A.fam, forma, hue: (A.hue + Bb.hue) / 2, flor: A.flor >= 0 ? A.flor : Bb.flor, g, cultivo, padres: [A.id, Bb.id], origen: 'cruce', gen: Math.max(A.gen, Bb.gen) + 1, comun: nombre || `Híbrido ${A.comun?.split(' ')[0] || A.nombre.split(' ')[0]} × ${Bb.comun?.split(' ')[0] || Bb.nombre.split(' ')[0]}`, vista: true });
  sp.extinta = E.año; sp.soloBoveda = true;   // existe solo en la bóveda hasta que la siembres
  E.fondos -= COSTOS.cruzar; mA.viab = Math.max(0, mA.viab - 0.05); mB.viab = Math.max(0, mB.viab - 0.05);
  const m = { id: E.sig.sem++, sp: sp.id, viab: 1, cant: 3, cajon: c, año: E.año, cruce: true }; E.boveda.push(m);
  E.stats.cruces++; log(E, `🧪 Nace en el laboratorio ${sp.comun}: cruce de ${A.comun || A.nombre} × ${Bb.comun || Bb.nombre}.`, 'logro', true);
  return { sp, m };
}
export function mejorar(E, k) {
  const M = MEJORAS[k], nv = E.mejoras[k] + 1; if (!M.niveles[nv]) return 'Ya está al máximo.';
  const costo = M.niveles[nv][0]; if (E.fondos < costo) return `Faltan ${Math.ceil(costo - E.fondos)} fondos.`;
  E.fondos -= costo; E.mejoras[k] = nv; log(E, `🏛️ La bóveda mejora: ${M.n} (nivel ${nv + 1}).`, 'logro', true); return null;
}

// ---------------------------------------------------------------- indicadores, crónica y guardado
export function indicadores(E) {
  const v = vivas(E), conocidas = E.especies.filter((s) => !s.soloBoveda || s.extinta == null), guardadas = new Set(E.boveda.filter((m) => !m.muerta && m.viab > 0.05).map((m) => m.sp));
  const perdidas = E.especies.filter((s) => s.extinta != null && !s.soloBoveda && !guardadas.has(s.id)).length;
  return { vivas: v.length, total: conocidas.length, guardadas: guardadas.size, perdidas, rescatadas: E.stats.rescates, seguridad: seguridad(E), aldeas: E.aldeas.filter((a) => a.viva).length };
}
function muestrear(E) {
  const I = indicadores(E); E.hist.push({ a: E.año, v: I.vivas, g: I.guardadas, p: I.perdidas, T: Math.round(E.clima.T * 10) / 10, Ll: Math.round(E.clima.lluvia * 100) / 100, s: Math.round(I.seguridad * 100) });
  if (E.hist.length > 400) E.hist = E.hist.filter((_, i) => i % 2 === 0 || i === E.hist.length - 1);
}
export function exportar(E) { const { mapa, ...r } = E; void mapa; return JSON.parse(JSON.stringify({ ...r, especies: r.especies.map((s) => ({ ...s, b: s.extinta != null ? [] : Array.from(s.b, (x) => Math.round(x * 1000) / 1000) })) })); }
export function importar(o) {
  if (!o || o.v !== 1 || !Array.isArray(o.especies)) return null;
  o.mapa = generarMapa(o.semilla); for (const s of o.especies) { s.b = s.b?.length ? Float32Array.from(s.b) : new Float32Array(o.mapa.n); if (s.b.length !== o.mapa.n) return null; }
  return o;
}
export const avanzar = (E, n) => { for (let i = 0; i < n; i++) paso(E); return E; };
