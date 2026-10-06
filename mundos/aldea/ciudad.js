// =====================================================================
// La aldea · motor de crecimiento urbano y del terreno (puro, sin three).
// El orbe es una cuadrícula de celdas de 3×3. Cada celda tiene terreno (pradera, bosque, agua, río,
// roca, montaña), un uso (vivienda, campo, mina, fábrica…), un nivel (pisos), el estilo de la era en
// que se construyó y su contaminación. Las ciudades crecen hacia afuera y hacia arriba, renuevan sus
// edificios cuando cambia la era, excavan montañas, talan o reforestan, y quedan en ruinas si caen.
// =====================================================================
import { USOS, OFICIOS, ERAS } from './datos.js';

export const CEL = 3, NG = 31, MEDIO = 15, R_UTIL = 43.5;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const TMP = new WeakMap();
export const claveCelda = (i, j) => i * NG + j;
// índice de celdas por clave (se rehace si cambia el arreglo)
export function mapa(s) { let m = TMP.get(s.celdas); if (!m) { m = new Map(s.celdas.map((c) => [c.k, c])); TMP.set(s.celdas, m); } return m; }
export function celdaEn(s, x, z) { const i = Math.round(x / CEL) + MEDIO, j = Math.round(z / CEL) + MEDIO; return mapa(s).get(claveCelda(i, j)) || null; }
export function vecinas(s, c) { const m = mapa(s), i = Math.floor(c.k / NG), j = c.k % NG, out = []; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = m.get(claveCelda(i + di, j + dj)); if (v) out.push(v); } return out; }
// altura del terreno en un punto (interpolada entre centros de celda)
export function altura(s, x, z) {
  const fi = x / CEL + MEDIO, fj = z / CEL + MEDIO, i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, m = mapa(s);
  const h = (a, b) => m.get(claveCelda(a, b))?.h || 0;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

// ---------------------------------------------------------------- terreno inicial a partir del mapa (lago, río, rocas, árboles)
export function crearTerreno(s, R) {
  const L = s.lago, celdas = [];
  // la montaña se levanta junto a la zona de piedra, hacia el borde del orbe
  const cx = s.rocas.reduce((n, r) => n + r.x, 0) / s.rocas.length, cz = s.rocas.reduce((n, r) => n + r.z, 0) / s.rocas.length, a = Math.atan2(cz, cx);
  s.montana = { x: +(Math.cos(a) * 34).toFixed(2), z: +(Math.sin(a) * 34).toFixed(2), r: 11 };
  for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) {
    const x = (i - MEDIO) * CEL, z = (j - MEDIO) * CEL;
    if (Math.hypot(x, z) > R_UTIL) continue;
    const c = { k: claveCelda(i, j), x, z, t: 'p', h: 0, u: null, al: null, n: 0, e: 0, o: null, cont: 0 };
    const dm = dist(x, z, s.montana.x, s.montana.z);
    if (dist(x, z, L.x, L.z) < L.r - 0.6) c.t = 'a';
    else if (s.rio.some(([px, pz]) => dist(x, z, px, pz) < 2)) c.t = 'v';
    else if (dist(x, z, s.cementerio.x, s.cementerio.z) < 6) c.t = 'c';
    else if (dm < s.montana.r) { c.h = +(Math.pow(1 - dm / s.montana.r, 1.1) * (7 + R() * 2)).toFixed(2); c.t = c.h > 1.2 ? 'm' : 'r'; }
    else if (s.rocas.some((r) => dist(x, z, r.x, r.z) < 2.2)) c.t = 'r';
    else if (s.arboles.some((t) => Math.abs(t.x - x) < 1.6 && Math.abs(t.z - z) < 1.6)) c.t = 'b';
    c.f = +(Math.max(0.3, 1.2 - Math.max(0, dist(x, z, L.x, L.z) - L.r) / 25)).toFixed(2);   // fertilidad: mejor cerca del agua
    celdas.push(c);
  }
  s.celdas = celdas;
  for (const t of s.arboles) { const c = celdaEn(s, t.x, t.z); t.ci = c ? c.k : -1; }
  s.vc = 1;
}

// ---------------------------------------------------------------- capacidades
export const capCelda = (c) => (c.u && !c.ru ? (USOS[c.u].cap || 0) * Math.max(1, c.n) : 0);
export function celdasDe(s, al, u) { return s.celdas.filter((c) => c.al === al && c.u === u && !c.ru); }
export function capacidad(s, al, u) { let n = 0; for (const c of s.celdas) if (c.al === al && c.u === u && !c.ru) n += capCelda(c); return n; }
export const pisosEra = (e) => ERAS[Math.min(7, e)].pisos;
export const radioCiudad = (s, C, pob) => Math.min(C.id === 0 ? 30 : 17, 7 + Math.sqrt(pob) * 1.5 + s.era * 1.3);

// ---------------------------------------------------------------- planificador: qué construir, dónde, y cuándo renovar
// necesidades: { vivienda: personas, porUso: { uso: trabajadores } }
export function planificar(s, C, nec, R) {
  const mias = s.celdas.filter((c) => c.al === C.id), obras = mias.filter((c) => c.o).length, pob = nec.pob, era = s.era;
  if (obras >= 1 + Math.floor(pob / 16) + (era >= 4 ? 1 : 0)) return null;
  const pedidos = [];
  const capV = capacidad(s, C.id, 'vivienda');
  if (pob > capV * 0.9) pedidos.push({ u: 'vivienda', p: 100 * (pob / Math.max(1, capV)) });
  for (const [u, w] of Object.entries(nec.porUso)) { const cap = capacidad(s, C.id, u); if (w > cap * 0.95) pedidos.push({ u, p: 40 + (30 * (w - cap)) / Math.max(1, cap) }); }
  if (era >= 2 && !mias.some((c) => c.u === 'palacio' || c.o?.u === 'palacio')) pedidos.push({ u: 'palacio', p: 35 });
  if (era >= 5 || s.ejes.ni < -15) { const dev = mias.filter((c) => c.u && !USOS[c.u].plano).length, par = mias.filter((c) => c.u === 'parque').length; if (par < dev * (s.ejes.ni < -15 ? 0.12 : 0.05)) pedidos.push({ u: 'parque', p: 18 }); }
  if (s.tec.cohetes && C.id === 0 && !s.celdas.some((c) => c.u === 'puerto' || c.o?.u === 'puerto')) pedidos.push({ u: 'puerto', p: 45 });
  pedidos.sort((a, b) => b.p - a.p);
  for (const pd of pedidos) {
    // primero crecer hacia arriba si la era lo permite y la ciudad ya está llena
    const sube = pd.u !== 'campo' && !USOS[pd.u].plano && pd.u !== 'puerto' ? mias.filter((c) => c.u === pd.u && !c.o && !c.ru && c.n < pisosEra(era)).sort((a, b) => dist(a.x, a.z, C.x, C.z) - dist(b.x, b.z, C.x, C.z))[0] : null;
    const nueva = buscarCelda(s, C, pd.u, pob);
    const c = sube && (!nueva || era >= 3 || dist(nueva.x, nueva.z, C.x, C.z) > radioCiudad(s, C, pob) * 0.75) ? sube : nueva;
    if (!c) continue;
    const n = c === sube ? Math.min(pisosEra(era), c.n + Math.max(1, Math.round(pisosEra(era) / 6))) : 1;
    if (!pagar(s, C, pd.u, n - (c === sube ? c.n : 0), R)) { C.falta = USOS[pd.u].n; return null; }
    iniciarObra(s, C, c, pd.u, n);
    return { u: pd.u, c, sube: c === sube };
  }
  // sin necesidades urgentes: renovar lo viejo (la casa de madera pasa a piedra, a ladrillo, a concreto…)
  if (era >= 1 && obras < 1 + Math.floor(pob / 30)) {
    const vieja = mias.filter((c) => c.u && !c.o && !c.ru && c.e < era && !USOS[c.u].plano).sort((a, b) => a.e - b.e || dist(a.x, a.z, C.x, C.z) - dist(b.x, b.z, C.x, C.z))[0];
    if (vieja && pagar(s, C, vieja.u, 0.5, R)) { iniciarObra(s, C, vieja, vieja.u, Math.max(1, Math.min(pisosEra(era), vieja.n)), true); return { u: vieja.u, c: vieja, renueva: true }; }
  }
  // ruinas: se reconstruyen o se dejan al bosque
  const ruina = mias.find((c) => c.ru && !c.o);
  if (ruina && pagar(s, C, ruina.u || 'vivienda', 0.6, R)) { iniciarObra(s, C, ruina, ruina.u || 'vivienda', 1, true); return { u: ruina.u, c: ruina, reconstruye: true }; }
  return null;
}
function pagar(s, C, u, n, R) {
  const k = USOS[u].mat * (1 + s.era * 0.7) * Math.max(0.5, n), met = s.era >= 2 ? k * 0.15 : 0;
  if (C.res.materiales < k || C.res.metal < met) return false;
  C.res.materiales -= k; C.res.metal -= met; return true;
}
function iniciarObra(s, C, c, u, n, renueva = false) {
  c.o = { u, n, e: s.era, p: 0, w: +(USOS[u].obra * (1 + s.era * 0.45) * (renueva ? 0.6 : 1) * Math.max(1, Math.sqrt(n))).toFixed(1), r: renueva };
  c.al = C.id;
  if (c.t === 'b') talarCelda(s, c);
  s.vc++;
}
// la mejor celda libre para un uso: cerca del centro, en el terreno adecuado y con buenos vecinos
function buscarCelda(s, C, u, pob) {
  const rad = radioCiudad(s, C, pob), L = s.lago;
  let mejor = null, mp = -1e9;
  for (const c of s.celdas) {
    if (c.u || c.o || c.ru || ['a', 'v', 'c'].includes(c.t)) continue;
    if (c.al != null && c.al !== C.id) continue;
    const d = dist(c.x, c.z, C.x, C.z); if (d > rad + (u === 'mina' || u === 'cantera' ? 12 : 0)) continue;
    if (s.ciudades.some((o) => o.id !== C.id && !o.vacia && dist(c.x, c.z, o.x, o.z) < 7)) continue;
    if (c.t === 'm' && !['mina', 'cantera'].includes(u)) continue;
    let p = -d;
    if (u === 'mina') p = c.t === 'm' ? 30 - d * 0.3 : c.t === 'r' ? 15 - d * 0.5 : -999;
    else if (u === 'cantera') p = (c.t === 'r' || c.t === 'm' ? 14 : c.t === 'b' ? 8 : 0) - d * 0.5;
    else if (u === 'campo') p = c.f * 12 - Math.abs(d - rad * 0.65) * 0.6 + (c.t === 'b' ? -4 : 0);
    else if (u === 'vivienda') p = -d + (dist(c.x, c.z, L.x, L.z) < L.r + 6 ? 3 : 0) - c.cont * 10;
    else if (['taller', 'central'].includes(u) && s.era >= 4) p = d * 0.3 - (vecinasUso(s, c, 'vivienda') * 2) + (c.t === 'v' ? -50 : 0);
    else if (u === 'parque') p = -d * 0.5 + (c.t === 'b' ? 6 : 0);
    else if (u === 'puerto') p = d * 0.4 - vecinasUso(s, c, 'vivienda') * 3;
    else p = -d * 1.2;   // templos, escuelas, mercados, palacio: al centro
    if (c.t === 'b' && u !== 'parque') p -= s.ejes.ni < -10 ? 6 : 1.5;   // una sociedad verde evita talar
    if (p > mp) { mp = p; mejor = c; }
  }
  return mejor;
}
const vecinasUso = (s, c, u) => vecinas(s, c).filter((v) => v.u === u).length;
export function talarCelda(s, c) { let n = 0; for (const t of s.arboles) if (t.ci === c.k && t.c >= 0) { t.c = -1; n++; } if (c.t === 'b') c.t = 'p'; return n; }

// avance de las obras con los puntos de los constructores
export function construir(s, C, pts) {
  const obras = s.celdas.filter((c) => c.o && c.al === C.id);
  if (!obras.length || pts <= 0) return [];
  const listas = [], k = pts / obras.length;
  for (const c of obras) {
    c.o.p = Math.min(1, c.o.p + k / c.o.w);
    if (c.o.p >= 1) { const nuevo = !c.u; c.u = c.o.u; c.n = c.o.n; c.e = c.o.e; c.ru = false; c.o = null; s.vc++; listas.push({ c, nuevo }); }
  }
  return listas;
}

// ---------------------------------------------------------------- viviendas (los ricos en lo mejor) y lugares de trabajo
export function asignarViviendas(s, C, gente) {
  const casas = s.celdas.filter((c) => c.al === C.id && c.u === 'vivienda' && !c.ru).map((c) => ({ c, libre: capCelda(c), valor: -dist(c.x, c.z, C.x, C.z) * 0.6 - c.cont * 15 + c.e * 2 + c.n * 0.3 + (dist(c.x, c.z, s.lago.x, s.lago.z) < s.lago.r + 6 ? 4 : 0) })).sort((a, b) => b.valor - a.valor);
  const ix = new Map(gente.map((a) => [a.id, a])), fams = new Map();
  for (const a of gente) { let r = a; if (a.edad < 18 || (!a.pareja && a.edad < 22)) { const p = a.padres.map((id) => ix.get(id)).find(Boolean); if (p) r = p.pareja && ix.get(p.pareja) ? (p.id < p.pareja ? p : ix.get(p.pareja)) : p; } else if (a.pareja && ix.get(a.pareja)) r = a.id < a.pareja ? a : ix.get(a.pareja); const k = r.id; if (!fams.has(k)) fams.set(k, []); fams.get(k).push(a); }
  const lista = [...fams.values()].map((f) => ({ f, riq: Math.max(...f.map((a) => a.riqueza)) })).sort((a, b) => b.riq - a.riq);
  for (const { f } of lista) {
    const casa = casas.find((x) => x.libre >= f.length) || casas.find((x) => x.libre > 0);
    for (const a of f) { const cc = casa && casa.libre > 0 ? casa : casas.find((x) => x.libre > 0); if (!cc) { a.hogar = null; continue; } a.hogar = cc.c.k; cc.libre--; }
  }
}
export function asignarTrabajos(s, C, gente) {
  const lugares = {};
  for (const c of s.celdas) if (c.al === C.id && c.u && !c.ru && USOS[c.u].cap) (lugares[c.u] ||= []).push({ c, libre: capCelda(c) });
  const m = mapa(s), sobra = {};
  for (const a of gente) {
    const uso = OFICIOS[a.oficio]?.uso;
    if (a.oficio === 'construir') { const o = s.celdas.find((c) => c.o && c.al === C.id); a.trabajo = o ? o.k : null; continue; }
    if (!uso || !lugares[uso]) { a.trabajo = null; if (uso) sobra[a.oficio] = (sobra[a.oficio] || 0) + 1; continue; }
    const casa = m.get(a.hogar), l = lugares[uso].filter((x) => x.libre > 0).sort((x, y) => (casa ? dist(x.c.x, x.c.z, casa.x, casa.z) - dist(y.c.x, y.c.z, casa.x, casa.z) : 0))[0];
    if (l) { l.libre--; a.trabajo = l.c.k; } else { a.trabajo = lugares[uso][0].c.k; sobra[a.oficio] = (sobra[a.oficio] || 0) + 1; }
  }
  return sobra;   // trabajadores sin puesto (rinden menos)
}

// ---------------------------------------------------------------- contaminación, minería, bosque
export function ambiente(s, limpio) {
  const m = mapa(s), sucio = s.mult?.sucio ?? 1;
  for (const c of s.celdas) {
    let e = 0;
    if (c.u === 'taller' && c.e >= 4) e += 0.02 * c.n * sucio;
    if (c.u === 'central' && c.e >= 4) e += 0.05 * c.n * sucio;
    if (c.u === 'mina') e += 0.01;
    if (c.u === 'vivienda' && c.e >= 5) e += 0.002 * c.n * sucio;
    c.cont = Math.min(1, c.cont * (0.9 - limpio * 0.04) + e);
    // la mina excava la montaña
    if (c.u === 'mina' && c.h > 0) { c.h = Math.max(0, +(c.h - 0.06).toFixed(2)); if (c.h < 0.4) c.t = 'r'; s.vh = (s.vh || 0) + 1; }
  }
  // el humo se reparte entre vecinas
  // (lo que una celda reparte lo pierde ella: el humo se diluye, no se multiplica)
  const nuevo = new Map();
  for (const c of s.celdas) if (c.cont > 0.02) { const vs = vecinas(s, c), q = c.cont * 0.03; for (const v of vs) nuevo.set(v.k, (nuevo.get(v.k) || 0) + q); nuevo.set(c.k, (nuevo.get(c.k) || 0) - q * vs.length); }
  for (const [k, v] of nuevo) { const c = m.get(k); c.cont = Math.max(0, Math.min(1, c.cont + v)); }
  const util = s.celdas.filter((c) => c.t !== 'a');
  s.contaminacion = +Math.min(1, util.reduce((n, c) => n + c.cont, 0) / util.length * 5).toFixed(3);
  const bosque = s.arboles.filter((t) => t.c > 0.3).length / Math.max(1, s.arbolesIni);
  s.ecologia = Math.round(Math.max(0, Math.min(100, 100 * Math.min(1, bosque * 1.15) * (1 - Math.min(1, s.contaminacion)))));
}
// reforestar: las sociedades verdes plantan; las ruinas se las traga el bosque
export function reforestar(s, n) {
  const libres = s.celdas.filter((c) => !c.u && !c.o && (c.t === 'p' || c.t === 'b') && !s.ciudades.some((C) => !C.vacia && dist(c.x, c.z, C.x, C.z) < 9));
  for (let i = 0; i < n && libres.length; i++) {
    const c = libres[(s.dia * 7 + i * 13) % libres.length];
    if (s.arboles.length >= s.maxArboles) { const t = s.arboles.find((x) => x.c < 0); if (!t) break; Object.assign(t, { x: c.x + (((i * 37) % 10) / 10 - 0.5) * 2.4, z: c.z + (((i * 53) % 10) / 10 - 0.5) * 2.4, c: 0.05, ci: c.k }); }
    else s.arboles.push({ x: +(c.x + (((i * 37 + s.dia) % 10) / 10 - 0.5) * 2.4).toFixed(2), z: +(c.z + (((i * 53 + s.dia) % 10) / 10 - 0.5) * 2.4).toFixed(2), c: 0.05, v: i % 2, o: 0, ci: c.k });
    c.t = 'b';
  }
}
// destrucción: edificios en ruinas (y el bosque que vuelve)
export function arruinar(s, frac, R) {
  for (const c of s.celdas) if ((c.u || c.o) && R() < frac) { c.ru = true; c.o = null; if (c.u === 'campo') c.u = null; }
  s.vc++;
}
// barrios: cómo es cada zona de la ciudad (para la interfaz)
export function barrios(s, C, gente) {
  const m = mapa(s), clases = {};
  for (const a of gente) if (a.hogar != null) { const c = m.get(a.hogar); if (!c) continue; (clases[c.k] ||= { alta: 0, media: 0, baja: 0 })[a.clase || 'media']++; }
  const b = { centro: 0, alto: 0, medio: 0, obrero: 0, industrial: 0, templos: 0, saber: 0, campos: 0, ruinas: 0, parques: 0 };
  for (const c of s.celdas) {
    if (c.al !== C.id) continue;
    if (c.ru) { b.ruinas++; continue; }
    if (c.u === 'vivienda') { const k = clases[c.k]; if (!k) b.medio++; else if (k.alta >= k.baja && k.alta >= k.media) b.alto++; else if (k.baja > k.media) b.obrero++; else b.medio++; }
    else if (['taller', 'central', 'mina', 'cantera'].includes(c.u)) b.industrial++;
    else if (c.u === 'templo') b.templos++;
    else if (c.u === 'escuela') b.saber++;
    else if (c.u === 'campo') b.campos++;
    else if (c.u === 'parque') b.parques++;
    else if (c.u) b.centro++;
  }
  return b;
}
