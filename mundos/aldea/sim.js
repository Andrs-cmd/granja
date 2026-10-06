// =====================================================================
// La aldea · motor de civilización (puro: sin three ni DOM; determinista con semilla).
// Una tribu crece por eras hasta su destino: imperio estelar, trascendencia, utopía de Gaia,
// mente colmena… o la destrucción. Cada ciudadano es una persona con personalidad, valores,
// opiniones, recuerdos y sueños: elige su oficio, vota, protesta, migra, inventa y cree (o no).
// La sociedad decide en los momentos de cambio y esas decisiones, sumadas, trazan su destino.
// El paso es de un día; lo que se ve hora a hora (ir al trabajo, volver a casa) lo anima la escena.
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';
import { MIN_DIA, DIAS_EST, DIAS_ANIO, ESTACIONES, ERAS, TEC, OFICIOS, USOS, GOBIERNOS, DECISIONES, DESTINOS, CAUSAS, PODERES, NOM_M, NOM_F, APELLIDOS, NOMBRES_CIUDAD, NOMBRES_MOV, tituloOficio } from './datos.js';
import * as M from './mente.js';
import * as U from './ciudad.js';
export { ERAS, TEC, OFICIOS, USOS, GOBIERNOS, DECISIONES, DESTINOS, CAUSAS, PODERES, ESTACIONES, DIAS_ANIO, MIN_DIA, tituloOficio };
export { M as MENTE, U as CIUDAD };

export const VERSION = 3, MAX_PERSONAS = 240;
const clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const TMP = new WeakMap();

// ---------------------------------------------------------------- azar reproducible dentro del estado
export function rnd(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (s, l) => l[Math.floor(rnd(s) * l.length)];
const ent = (s, a, b) => a + rnd(s) * (b - a);
const prob = (s, p) => rnd(s) < p;
const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

// ---------------------------------------------------------------- tiempo: 24 días por año; un ciudadano «vive» un día por paso
export const diaAbs = (s) => Math.floor(s.t / MIN_DIA);
export const horaDe = (s) => (s.t % MIN_DIA) / 60;
export function fecha(s) { const d = diaAbs(s); return { anio: Math.floor(d / DIAS_ANIO) + 1, est: Math.floor((d % DIAS_ANIO) / DIAS_EST), dia: (d % DIAS_EST) + 1, hora: horaDe(s), d }; }
export function fechaTxt(s, conHora = true) { const f = fecha(s), h = f.hora; return `Año ${f.anio} · ${ESTACIONES[f.est]}${conHora ? ` · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}` : ''}`; }
const sello = (s) => `A${fecha(s).anio}`;
const anio = (s) => fecha(s).anio;

// ---------------------------------------------------------------- diario, hitos, vida
export function log(s, texto, tipo = 'info') { s.diario.unshift({ texto, tipo, d: sello(s) }); if (s.diario.length > 180) s.diario.length = 180; }
function hito(s, texto, tipo = 'logro') { s.hitos.unshift({ texto, d: sello(s), tipo, era: s.era }); if (s.hitos.length > 200) s.hitos.length = 200; }
function vida(s, a, texto) { a.vida.unshift({ texto, d: sello(s) }); if (a.vida.length > 12) a.vida.length = 12; }
const g = (a, m, f) => (a.sexo === 'f' ? f : m);
export const nombreDe = (a) => (a ? `${a.nombre} ${a.apellido}` : '—');
// agrupar lo social del día en una línea (si no, inunda el diario)
function social(s, tipo, txt) { const t = tmp(s); (t.soc ||= {})[tipo] ||= []; t.soc[tipo].push(txt); }
function volcarSocial(s) {
  const t = tmp(s); if (!t.soc) return;
  const lista = (l) => (l.length <= 2 ? l.join(', ') : `${l.slice(0, 2).join(', ')} y ${l.length - 2} más`);
  const T = { amig: ['Nuevas amistades', 'bueno'], enem: ['Se enemistan', 'malo'], pelea: ['Peleas', 'malo'], invento: ['Inventos', 'logro'], boda: ['Se unen en pareja', 'bueno'], nace: ['Nacen', 'bueno'] };
  for (const [k, l] of Object.entries(t.soc)) if (l.length) log(s, `${T[k][0]}: ${lista(l)}.`, T[k][1]);
  t.soc = {};
}
function tmp(s) { let t = TMP.get(s); if (!t) { t = {}; TMP.set(s, t); } return t; }

// ---------------------------------------------------------------- índices (se rehacen cada día o cuando cambia la gente)
function idx(s) { const t = tmp(s); if (t.v !== s.gente) { t.v = s.gente; t.m = new Map(s.gente.map((a) => [a.id, a])); t.paD = -1; } return t.m; }
export const vivo = (s, id) => idx(s).get(id) || null;
export const persona = (s, id) => vivo(s, id) || s.difuntos.find((d) => d.id === id) || s.idos.find((d) => d.id === id) || null;
export function gentes(s, al) { const t = tmp(s); idx(s); if (t.paD !== s.t) { t.pa = {}; for (const a of s.gente) (t.pa[a.al] ||= []).push(a); t.paD = s.t; } return t.pa[al] || []; }
const invalidar = (s) => { tmp(s).paD = -1; };
// capacidad de un uso en una ciudad, guardada por un día (se consulta por cada persona)
function cap(s, al, u) { const t = tmp(s); if (t.capD !== s.dia) { t.capD = s.dia; t.cap = {}; } const k = al + u; return (t.cap[k] ??= U.capacidad(s, al, u)); }
const familia = (a, b) => a.padres.includes(b.id) || b.padres.includes(a.id) || a.padres.some((p) => b.padres.includes(p));
export const vivas = (s) => s.ciudades.filter((C) => !C.vacia);
export const lazo = (s, a, b) => s.lazos[a < b ? `${a}-${b}` : `${b}-${a}`] ?? 30;
function cambiarLazo(s, a, b, d) { if (a === b) return; const k = a < b ? `${a}-${b}` : `${b}-${a}`; s.lazos[k] = Math.round(clamp(lazo(s, a, b) + d, -100, 100)); }

// ---------------------------------------------------------------- mundo nuevo
export function crearAldea(semilla = Date.now(), ciclo = 1, historia = []) {
  const sem = semilla >>> 0;
  const s = {
    mundo: 'aldea', version: VERSION, semilla: sem, rng: sem ^ 0x5bd1e995, t: 6 * 60, dia: 0, ciclo, historia,
    era: 0, eras: [{ era: 0, anio: 1 }], tec: {}, inv: { c: null, f: null }, mult: {}, cultura: 0, puntos: { c: 0, f: 0 },
    ejes: { cf: 0, aa: 0, ic: 0, ni: 0 }, ejeBase: { cf: 0, aa: 0, ic: 0, ni: 0 },
    gobierno: 'consejo', leyes: {}, decision: null, decisiones: [], movimientos: [], sigMov: 1, sigId: 1,
    ciudades: [], lazos: {}, celdas: [], arboles: [], rocas: [], tumbas: [], gente: [], difuntos: [], idos: [],
    contaminacion: 0, ecologia: 100, riesgos: {}, guerra: null, mega: null, destino: null, fin: false,
    esp: { influencia: 3, fe: 30 }, clima: { lluvia: 0, nieve: 0, sequia: 0 }, epidemia: null,
    cont: { nacimientos: 0, muertes: 0, llegadas: 0, partidas: 0, inventos: 0, revoluciones: 0, guerras: 0, ciudades: 1 },
    diario: [], hitos: [], hist: { anio: [], pob: [], hab: [], ciencia: [], fe: [], animo: [], era: [], eco: [], desig: [] },
    vc: 1, maxPob: 0,
  };
  crearMapa(s, sem);
  U.crearTerreno(s, azar(sem ^ 0x1234));
  s.arbolesIni = s.arboles.length; s.maxArboles = s.arboles.length + 260;
  const C = nuevaCiudad(s, pick(s, NOMBRES_CIUDAD.slice(0, 6)), 0, 0, null);
  Object.assign(C.res, { comida: 60, materiales: 30, metal: 0, energia: 0, bienes: 5 });
  // colonos: tres parejas (alguna con hijos), dos solteros y una persona mayor que recuerda los mitos
  const ap = () => pick(s, APELLIDOS.filter((x) => !s.gente.some((a) => a.apellido === x)));
  for (let i = 0; i < 3; i++) {
    const apel = ap(), m = nuevaPersona(s, { sexo: 'm', edad: ent(s, 19, 38), apellido: apel, al: 0 }), f = nuevaPersona(s, { sexo: 'f', edad: ent(s, 18, 35), apellido: apel, al: 0 });
    emparejar(s, m, f, true);
    if (prob(s, 0.6)) { const h = nuevaPersona(s, { edad: ent(s, 2, 12), apellido: apel, padres: [m.id, f.id], al: 0 }); m.hijos.push(h.id); f.hijos.push(h.id); }
  }
  nuevaPersona(s, { edad: ent(s, 17, 28), apellido: ap(), al: 0 }); nuevaPersona(s, { edad: ent(s, 17, 28), apellido: ap(), al: 0 });
  nuevaPersona(s, { edad: ent(s, 55, 66), apellido: ap(), al: 0 });
  for (const a of s.gente) for (const b of s.gente) if (a.id < b.id) { const v = familia(a, b) || a.pareja === b.id ? 70 : Math.round(ent(s, -10, 30)); relacion(a, b.id, v); relacion(b, a.id, v); }
  // la primera fogata y unas chozas
  const c0 = U.celdaEn(s, 0, 0); c0.u = 'teatro'; c0.n = 1; c0.al = 0; c0.fogata = true; c0.t = 'p';
  for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const c = U.celdaEn(s, dx, dz); if (c && !c.u && !['a', 'v', 'm', 'c'].includes(c.t)) { c.u = 'vivienda'; c.n = 1; c.al = 0; U.talarCelda(s, c); } }
  for (const a of s.gente) a.oficio = a.edad >= 14 ? pick(s, ['comida', 'comida', 'comida', 'materiales', 'construir']) : null;
  const sab = s.gente.filter((a) => a.edad >= 14).sort((x, y) => y.v.curiosidad - x.v.curiosidad)[0]; if (sab) sab.oficio = 'ciencia';
  const cham = s.gente.filter((a) => a.edad >= 14 && a !== sab).sort((x, y) => y.v.fe - x.v.fe)[0]; if (cham) cham.oficio = 'fe';
  elegirLider(s, C, 'fundacion');
  recalcMult(s); calcularEjes(s);
  log(s, `${s.gente.length} personas encienden una fogata en un claro junto al lago. Así empieza ${C.nombre}${ciclo > 1 ? ', sobre las ruinas de otra civilización' : ''}.`, 'logro');
  hito(s, ciclo > 1 ? `Ciclo ${ciclo}: una tribu nueva en el orbe` : `Nace la tribu de ${C.nombre}`, 'era');
  asignar(s, C);
  return s;
}
function crearMapa(s, sem) {
  const r = azar(sem ^ 0x9e3779b9), ru = ruido2D(sem & 0xffff);
  const aL = r() * Math.PI * 2;
  s.lago = { x: +(Math.cos(aL) * 30).toFixed(2), z: +(Math.sin(aL) * 30).toFixed(2), r: 8 };
  s.rio = []; for (let i = 0; i <= 7; i++) { const k = i / 7, rr = 36 + k * 9.5, a = aL + Math.sin(k * 4 + (sem % 7)) * 0.13; s.rio.push([+(Math.cos(a) * rr).toFixed(2), +(Math.sin(a) * rr).toFixed(2)]); }
  const aS = aL + Math.PI * (0.62 + r() * 0.4), aC = aL - Math.PI * (0.5 + r() * 0.15);
  s.cementerio = { x: +(Math.cos(aC) * 36).toFixed(2), z: +(Math.sin(aC) * 36).toFixed(2), ang: aC };
  for (let i = 0; i < 9; i++) { const a = aS + (r() - 0.5) * 0.7, rr = 27 + r() * 8; s.rocas.push({ x: +(Math.cos(a) * rr).toFixed(2), z: +(Math.sin(a) * rr).toFixed(2), t: r() }); }
  const libre = (x, z, m) => dist(x, z, s.lago.x, s.lago.z) > s.lago.r + m && dist(x, z, s.cementerio.x, s.cementerio.z) > 6.5 && s.rio.every(([px, pz]) => dist(x, z, px, pz) > 2.6);
  for (let x = -44; x <= 44; x += 3.1) for (let z = -44; z <= 44; z += 3.1) {
    const px = x + (r() - 0.5) * 2.4, pz = z + (r() - 0.5) * 2.4, rr = Math.hypot(px, pz);
    if (rr > 43 || rr < 13) continue;
    if (ru(px / 9 + 3, pz / 9 + 7) < 0.6 - (rr - 13) / 45 || !libre(px, pz, 2)) continue;
    s.arboles.push({ x: +px.toFixed(2), z: +pz.toFixed(2), c: +(0.7 + r() * 0.3).toFixed(2), v: r() < 0.55 ? 0 : 1, o: 0 });
  }
}
function nuevaCiudad(s, nombre, x, z, madre) {
  const C = { id: s.ciudades.length, nombre, x: +x.toFixed(2), z: +z.toFixed(2), madre, fundada: anio(s), res: { comida: 0, materiales: 0, metal: 0, energia: 0, bienes: 0 }, lider: null, mandato: 0, vacia: false, hambre: 0, salud: 0.5, defensa: 0, prosperidad: 1, falta: null, gini: 0, cultura: 0 };
  s.ciudades.push(C);
  return C;
}
function nombreLibre(s, sexo) { const usados = new Set(s.gente.map((a) => a.nombre)), l = (sexo === 'f' ? NOM_F : NOM_M).filter((n) => !usados.has(n)); return pick(s, l.length ? l : sexo === 'f' ? NOM_F : NOM_M); }
const PIEL = [0xf1c9a5, 0xe0ac7e, 0xc68c5c, 0xa8714a, 0x8a5a3b, 0x6b4430], PELO = [0x2a1c12, 0x3a2a1e, 0x5a3a22, 0x8a5a2a, 0xc9a05a, 0x1a1a1a, 0x7a3a1a];
function cultura(s, al) {
  const G = gentes(s, al).filter((a) => a.edad >= 16); if (G.length < 3) return null;
  const op = {}; for (const k of Object.keys(G[0].op)) op[k] = G.reduce((n, a) => n + a.op[k], 0) / G.length;
  return { fe: G.reduce((n, a) => n + a.v.fe, 0) / G.length, op };
}
function nuevaPersona(s, o = {}) {
  const sexo = o.sexo || (prob(s, 0.5) ? 'f' : 'm'), padres = (o.padres || []).map((id) => persona(s, id)).filter(Boolean);
  const mente = M.nuevaMente(() => rnd(s), padres.filter((p) => p.p), o.al != null ? cultura(s, o.al) : null);
  const pm = padres.find((p) => p.sexo === 'f'), pp = padres.find((p) => p.sexo === 'm');
  const a = {
    id: s.sigId++, nombre: nombreLibre(s, sexo), apellido: o.apellido || pick(s, APELLIDOS), sexo, edad: +(o.edad ?? 0).toFixed(3), al: o.al ?? 0,
    ...mente, padres: padres.map((p) => p.id), hijos: [], pareja: null, rel: {}, mem: [], vida: [],
    oficio: null, hab: {}, edu: Math.round((o.edad ?? 0) > 16 ? s.era * 6 * rnd(s) : 0), riqueza: +(ent(s, 2, 8) * (1 + s.era)).toFixed(1), clase: 'media', rank: 0.5,
    hogar: null, trabajo: null, salud: 100, animo: 60, enf: 0, emb: 0, mov: null, fama: 0, inventos: 0, triste: 0,
    ap: { piel: pm && pp ? pick(s, [pm.ap.piel, pp.ap.piel]) : pick(s, PIEL), pelo: padres.length ? pick(s, padres).ap.pelo : pick(s, PELO), alto: +(sexo === 'f' ? ent(s, 0.9, 0.99) : ent(s, 0.97, 1.08)).toFixed(3), ancho: +ent(s, 0.92, 1.12).toFixed(2), peinado: sexo === 'f' ? (prob(s, 0.8) ? 'largo' : 'corto') : prob(s, 0.12) ? 'calvo' : 'corto', tono: +rnd(s).toFixed(2) },
  };
  a.sueno = { k: M.elegirSueno(() => rnd(s), a), ok: false };
  s.gente = [...s.gente, a];
  return a;
}
// relaciones: cada quien recuerda a lo sumo 10 personas (las más fuertes)
function relacion(a, id, v) {
  a.rel[id] = Math.round(clamp(v, -100, 100));
  const ks = Object.keys(a.rel);
  if (ks.length > 10) { const fam = (k) => +k === a.pareja || a.padres.includes(+k) || a.hijos.includes(+k); const peor = ks.filter((k) => !fam(k)).sort((x, y) => Math.abs(a.rel[x]) - Math.abs(a.rel[y]))[0]; if (peor != null) delete a.rel[peor]; }
}
function emparejar(s, a, b, inicial = false) {
  a.pareja = b.id; b.pareja = a.id; relacion(a, b.id, Math.max(60, a.rel[b.id] || 0)); relacion(b, a.id, Math.max(60, b.rel[a.id] || 0));
  if (inicial) return;
  if (a.al !== b.al) { const [va, al] = gentes(s, a.al).length > gentes(s, b.al).length ? [a, b.al] : [b, a.al]; mudar(s, va, al); }
  social(s, 'boda', `${a.nombre} y ${b.nombre}`);
  vida(s, a, `Se unió con ${b.nombre}`); vida(s, b, `Se unió con ${a.nombre}`);
  M.recordar(a, sello(s), `Se unió con ${b.nombre}`, 16); M.recordar(b, sello(s), `Se unió con ${a.nombre}`, 16);
}
function mudar(s, a, al) {
  const ix = idx(s);
  for (const x of [a, ...a.hijos.map((id) => ix.get(id)).filter((h) => h && h.edad < 16 && h.al === a.al)]) { x.al = al; x.hogar = null; x.trabajo = null; }
  invalidar(s);
}

// ---------------------------------------------------------------- avanzar el tiempo
export function avanzar(s, minutos, maxDias = 40) {
  if (s.fin) { s.t += minutos; return 0; }
  let hechos = 0;
  const fin = s.t + minutos;
  while (Math.floor(fin / MIN_DIA) > Math.floor(s.t / MIN_DIA)) {
    s.t = (Math.floor(s.t / MIN_DIA) + 1) * MIN_DIA;
    dia(s); hechos++;
    if (hechos >= maxDias || s.pausar || s.fin) return hechos;   // el resto se pierde: mejor perder tiempo que congelar la pantalla
  }
  s.t = fin;
  return hechos;
}
function dia(s) {
  s.dia++;
  const f = fecha(s);
  tmp(s).cuenta = {};
  if (s.destino) return epilogo(s);
  if (!s.gente.length) return vacio(s, f);
  if (f.dia === 1) estacion(s, f);
  const V = vivas(s);
  const dem = {};
  for (const C of V) { const G = gentes(s, C.id); dem[C.id] = demanda(s, C, G); economia(s, C, G, dem[C.id]); }
  for (const a of [...s.gente]) if (s.gente.includes(a)) vivir(s, a, dem[a.al] || (dem[a.al] = demanda(s, s.ciudades[a.al], gentes(s, a.al))));
  if (s.dia % 3 === 0) for (const C of vivas(s)) planificar(s, C);
  investigar(s);
  if (s.dia % 6 === 0) {
    for (const C of vivas(s)) asignar(s, C);
    U.ambiente(s, s.mult.limpio || 0);
    if ((s.ejes.ni < -20 || s.leyes.verde === 2) && s.era >= 3) U.reforestar(s, 3);
    if (s.dia % 24 === 0) for (const C of s.ciudades) if (C.vacia) U.reforestar(s, 1);
    calcularEjes(s); clases(s); movimientos(s); crisis(s); entreCiudades(s);
  }
  if (s.dia % 6 === 3) for (const t of s.arboles) if (t.c >= 0 && t.c < 1) t.c = Math.min(1, t.c + 0.048);
  guerraDia(s); epidemiaDia(s);
  decisionDia(s);
  megaDia(s);
  if (f.est === 0 && f.dia === 1) anual(s, f);
  for (const C of s.ciudades) if (!C.vacia && !gentes(s, C.id).length) { C.vacia = true; log(s, `${C.nombre} queda vacía.`, 'malo'); }
  if (!s.gente.length) vacio(s, f);
  s.maxPob = Math.max(s.maxPob, s.gente.length);
  volcarSocial(s);
}

// ---------------------------------------------------------------- economía de cada ciudad
export function recalcMult(s) {
  const m = { sucio: 1, limpio: 0 };
  for (const k of Object.keys(OFICIOS)) m[k] = 1 + s.era * 0.06;
  for (const k of Object.keys(s.tec)) { const T = TEC[k]; for (const [c, x] of Object.entries(T.mult || {})) m[c] = (m[c] || 1) * x; if (T.sucio) m.sucio += 0.3; if (T.limpio) m.limpio += 0.4; }
  if (s.leyes.verde === 2) m.sucio *= 0.5;
  if (s.leyes.atomo === false) m.energia *= 0.7;
  m.sucio = Math.max(0.1, m.sucio - m.limpio);
  s.mult = m;
}
const consumoComida = (a) => (a.edad < 12 ? 0.6 : 1);
const estacionFactor = (s) => { const e = fecha(s).est; return (e === 3 ? 0.55 : e === 1 ? 1.15 : 1.05) * (s.clima.sequia ? 0.6 : 1); };
// cuántos trabajadores harían falta en cada oficio (lo que la gente mira para elegir trabajo)
function demanda(s, C, G) {
  const pob = G.length, adultos = G.filter((a) => a.edad >= 14 && a.edad < 66).length || 1, m = s.mult, e = s.era, R = C.res;
  const obras = s.celdas.filter((c) => c.o && c.al === C.id).length;
  const t = {
    comida: (G.reduce((n, a) => n + consumoComida(a), 0) * (1.12 + (R.comida < pob * 8 ? 0.35 : 0))) / (OFICIOS.comida.base * m.comida * 0.72 * estacionFactor(s)),   // 0,72: lo que rinde en promedio un trabajador
    materiales: (pob * 0.22 + obras * 2.5) / (OFICIOS.materiales.base * m.materiales) + 0.5,
    metal: s.tec.bronce ? (pob * 0.06 * (1 + e * 0.3)) / (OFICIOS.metal.base * m.metal) + 0.3 : 0,
    energia: e >= 4 ? (pob * 0.45 * (e - 3)) / (OFICIOS.energia.base * m.energia) + 0.5 : 0,
    bienes: (pob * 0.09 * (e + 1)) / (OFICIOS.bienes.base * m.bienes),
    ciencia: adultos * (0.04 + 0.02 * e) * (1 + s.ejes.cf / 150) * (s.leyes.academias ? 1.3 : 1) * (s.gobierno === 'tecnocracia' ? 1.3 : 1),
    fe: adultos * 0.06 * (1 - s.ejes.cf / 120) * (s.gobierno === 'teocracia' ? 1.6 : 1),
    salud: pob / 22, comercio: e >= 1 ? adultos * (0.03 + 0.012 * e) : 0, seguridad: adultos * (s.guerra ? 0.14 : 0.035) * (s.leyes.armado ? 1.6 : 1),
    cultura: adultos * (0.02 + 0.008 * e), construir: Math.max(0.8, obras * 1.5),
  };
  return { t, adultos, pob };
}
function economia(s, C, G, D) {
  const R = C.res, m = s.mult, e = s.era, out = {}, huelga = s.movimientos.find((x) => x.tipo === 'huelga' && x.activo && x.al === C.id && x.fuerza > 0.25);
  const sinEnergia = e >= 4 && R.energia <= 0;
  for (const a of G) {
    if (a.edad < 14 || !a.oficio || a.edad >= 72) continue;
    if (huelga && a.mov === huelga.id) continue;
    if (s.leyes.cuarentena > 0 && !['salud', 'comida', 'fe'].includes(a.oficio)) continue;
    let ef = (0.55 + (a.hab[a.oficio] || 0) / 110) * (a.salud < 50 ? 0.6 : 1) * (a.animo > 75 ? 1.1 : a.animo < 25 ? 0.8 : 1) * (a.edad > 62 ? 0.7 : 1);
    if (a.trabajo == null && OFICIOS[a.oficio].uso && e > 0 && a.oficio !== 'comida') ef *= 0.55;   // sin taller, escuela o templo propio se rinde menos
    if (sinEnergia && ['bienes', 'metal', 'ciencia'].includes(a.oficio)) ef *= 0.6;
    if (a.oficio === 'ciencia') ef *= 1 + a.edu / 60;
    if (a.oficio === 'fe') ef *= 0.5 + a.v.fe;
    out[a.oficio] = (out[a.oficio] || 0) + ef;
    a.hab[a.oficio] = clamp((a.hab[a.oficio] || 0) + 0.06 * (1 - (a.hab[a.oficio] || 0) / 100) * (0.6 + a.v.curiosidad));
    a.riqueza = (a.riqueza + OFICIOS[a.oficio].ing * ef * C.prosperidad * (1 + e * 0.35) * 0.1 * (s.leyes.tierra === 'comunal' && e <= 2 ? 0.7 : 1) - 0.05 * (1 + e * 0.3));
  }
  if (C.campos === undefined || s.dia % 6 === 0) C.campos = U.capacidad(s, C.id, 'campo');
  const P = (k) => (out[k] || 0) * OFICIOS[k].base * (m[k] || 1);
  // los campos rinden más que recolectar en el monte
  const fCampo = e === 0 ? 1 : Math.min(1, 0.55 + C.campos / Math.max(1, out.comida || 1) * 0.45);
  R.comida += P('comida') * estacionFactor(s) * fCampo;
  R.materiales += P('materiales');
  if (s.tec.bronce) R.metal += P('metal');
  if (e >= 4) R.energia += P('energia');
  const bienes = Math.min(P('bienes'), R.materiales * 0.5 + 2); R.bienes += bienes; R.materiales = Math.max(0, R.materiales - bienes * 0.2);
  // la ciencia y la fe van a la investigación de toda la civilización
  const mov = (t) => s.movimientos.some((x) => x.tipo === t && x.activo);
  s.puntos.c += (P('ciencia') + G.reduce((n, a) => n + (a.edad >= 14 ? a.v.curiosidad * 0.004 : 0), 0)) * (s.leyes.censura ? 0.6 : 1) * (mov('renacimiento') ? 1.25 : 1) * (mov('tecno') ? 1.1 : 1);
  s.puntos.f += P('fe') + G.reduce((n, a) => n + (a.v.fe > 0.7 ? 0.003 : 0), 0);
  s.cultura += P('cultura') * 0.2;
  C.salud = clamp((P('salud') / Math.max(1, G.length / 20)) * 0.5, 0, 1.5);
  C.defensa = P('seguridad') * (s.leyes.armado ? 1.3 : 1);
  C.prosperidad = 1 + Math.min(2, (P('comercio') / Math.max(1, G.length)) * 3);
  C.cultura = P('cultura') / Math.max(1, G.length);
  // consumo
  const cc = G.reduce((n, a) => n + consumoComida(a), 0);
  R.comida -= cc; C.hambre = R.comida < 0 ? Math.min(1, -R.comida / cc) : 0; if (R.comida < 0) R.comida = 0;
  R.comida = Math.min(R.comida, G.length * 60);
  R.bienes = Math.max(0, R.bienes - G.length * 0.08 * (e + 1)); C.sinBienes = R.bienes <= 0;
  if (e >= 4) { R.energia -= G.length * 0.4 * (e - 3); C.sinEnergia = R.energia < 0; if (R.energia < 0) R.energia = 0; R.energia = Math.min(R.energia, G.length * 30); } else C.sinEnergia = false;
  for (const k of ['materiales', 'metal', 'bienes']) R[k] = Math.min(R[k], G.length * 50 + 300);
  // obras
  const listas = U.construir(s, C, P('construir') * (1 + e * 0.15));
  for (const { c, nuevo } of listas) if (nuevo && !s.celdas.some((x) => x !== c && x.u === c.u && !x.ru)) log(s, `${C.nombre}: ${primero(c.u, e)}.`, 'logro');
  // comuna o impuestos: la riqueza se acerca al promedio
  if (s.leyes.tierra === 'comunal' || s.gobierno === 'comuna' || s.leyes.impuestos) { const prom = G.reduce((n, a) => n + a.riqueza, 0) / Math.max(1, G.length), k = s.gobierno === 'comuna' ? 0.02 : 0.006; for (const a of G) a.riqueza += (prom - a.riqueza) * k; }
}
function primero(u, e) {
  const n = { vivienda: ['las primeras chozas', 'las primeras casas', 'casas de piedra', 'casas de ladrillo', 'edificios obreros', 'los primeros edificios altos', 'torres de vidrio', 'torres del futuro'][Math.min(7, e)], campo: 'los primeros campos sembrados', mina: 'la primera mina', cantera: 'la primera cantera', central: 'la primera central de energía', taller: e >= 4 ? 'la primera fábrica' : 'el primer taller', escuela: ['la primera escuela', 'la primera escuela', 'la primera escuela', 'la universidad', 'la universidad', 'el primer laboratorio', 'el centro de datos', 'el instituto del futuro'][Math.min(7, e)], templo: 'el primer templo', hospital: 'la primera casa de salud', mercado: 'el primer mercado', cuartel: 'el primer cuartel', teatro: 'el teatro', palacio: 'la casa de gobierno', parque: 'el primer parque', puerto: 'el puerto espacial' }[u];
  return `se levanta ${n}`;
}
function planificar(s, C) {
  const porUso = {};
  for (const a of gentes(s, C.id)) if (a.edad >= 14 && a.oficio && OFICIOS[a.oficio].uso) porUso[OFICIOS[a.oficio].uso] = (porUso[OFICIOS[a.oficio].uso] || 0) + 1;
  const r = U.planificar(s, C, { pob: gentes(s, C.id).length, porUso }, () => rnd(s));
  if (r?.u === 'puerto' && !r.renueva) { log(s, `${C.nombre} empieza a construir un puerto espacial.`, 'logro'); hito(s, 'Obras del puerto espacial', 'tec'); }
}
function asignar(s, C) { const G = gentes(s, C.id); U.asignarViviendas(s, C, G); U.asignarTrabajos(s, C, G); }
function clases(s) {
  for (const C of vivas(s)) {
    const G = gentes(s, C.id).filter((a) => a.edad >= 16).sort((a, b) => a.riqueza - b.riqueza);
    G.forEach((a, i) => { a.rank = G.length > 1 ? +(i / (G.length - 1)).toFixed(2) : 0.5; a.clase = s.era === 0 ? 'media' : a.rank > 0.85 ? 'alta' : a.rank < 0.4 ? 'baja' : 'media'; });
    for (const a of gentes(s, C.id)) if (a.edad < 16) { const p = a.padres.map((id) => vivo(s, id)).find(Boolean); if (p) { a.clase = p.clase; a.rank = p.rank; } }
    // desigualdad (índice de Gini aproximado)
    const n = G.length; let sum = 0, acum = 0; for (let i = 0; i < n; i++) { const r = Math.max(0, G[i].riqueza); sum += r; acum += (i + 1) * r; }
    C.gini = n > 2 && sum > 0 ? +Math.max(0, (2 * acum) / (n * sum) - (n + 1) / n).toFixed(2) : 0;
  }
}

// ---------------------------------------------------------------- la vida de cada persona, un día
function vivir(s, a, D) {
  const C = s.ciudades[a.al], e = s.era;
  a.edad += 1 / DIAS_ANIO;
  // educación: se aprende de joven si hay escuelas (y en la era de la información, toda la vida)
  if (a.edad >= 5 && (a.edad < 22 || e >= 6)) { const esc = cap(s, a.al, 'escuela'); a.edu = clamp(a.edu + (esc ? 0.05 + Math.min(0.25, (esc / Math.max(1, gentes(s, a.al).length)) * 1.5) : 0.01) * (0.5 + a.v.curiosidad), 0, 15 + e * 12); }
  // salud
  const limite = 46 + (s.mult.salud || 1) * 7 + (a.p.res - 0.5) * 6;
  const cont = U.mapa(s).get(a.hogar)?.cont || 0;
  const objetivo = 100 - Math.max(0, a.edad - limite + 15) * 2 - cont * 45 - C.hambre * 45 - (a.enf ? 35 : 0) + C.salud * 8;
  a.salud = clamp(a.salud + (objetivo - a.salud) * 0.05);
  a.hambre = C.hambre > 0.2;
  if (a.enf > 0) { a.enf--; if (a.enf === 0) M.recordar(a, sello(s), 'Se curó de la fiebre', 4, C.salud > 0.6 ? 'ciencia' : null, C.salud > 0.6 ? 0.06 : 0); }
  const pm = (a.edad < 1 ? 0.0016 / (s.mult.salud || 1) : a.edad > limite ? Math.pow((a.edad - limite) / 22, 3) / DIAS_ANIO : 0) + (a.salud < 8 ? 0.06 : 0);
  if (pm > 0 && prob(s, pm)) return morir(s, a, a.salud < 8 ? (C.hambre > 0.2 ? 'hambre' : a.enf ? 'enfermedad' : 'debilidad') : a.edad < 1 ? 'una fiebre de recién nacido' : 'vejez');
  if (a.emb > 0 && --a.emb <= 0) parto(s, a);
  // vida social: conversar con alguien conocido o con un vecino
  if (a.edad >= 4 && prob(s, 0.07 + a.p.ext * 0.2)) conversar(s, a);
  // ánimo
  if ((a.id + s.dia) % 3 === 0 || a._obj == null) a._obj = objetivoAnimo(s, a, C);   // el ánimo de fondo se recalcula cada tres días
  a.animo = clamp(a.animo + (a._obj - a.animo) * 0.1);
  // lo que decide cada semana (escalonado para que no decidan todos el mismo día)
  if ((a.id + s.dia) % 6 === 0 && a.edad >= 14) decidir(s, a, C, D);
  // parejas e hijos
  if (!a.pareja && a.edad >= 17 && (a.id + s.dia) % 4 === 0 && prob(s, 0.25)) buscarPareja(s, a);
  if (a.sexo === 'f' && a.pareja && !a.emb && a.edad >= 17 && a.edad <= 42) {
    const p = vivo(s, a.pareja), hijos = a.hijos.filter((id) => vivo(s, id)).length;
    const pr = 0.013 * Math.pow(Math.max(0, 1 - s.gente.length / MAX_PERSONAS), 1.3) * (C.hambre > 0.1 ? 0.15 : 1) * (a.hogar != null ? 1 : 0.5) * (1.25 - e * 0.05) / (1 + hijos * 0.4) * (a.animo > 35 ? 1 : 0.5) * (a.sueno.k === 'familia' ? 1.4 : 1);
    if (p && p.sexo === 'm' && prob(s, pr)) a.emb = 9;
  }
}
function objetivoAnimo(s, a, C) {
  const Gb = GOBIERNOS[s.gobierno], libertad = (a.p.ape + (1 - a.v.lealtad)) / 2, mp = U.mapa(s);
  let o = 54 - (a.p.neu - 0.5) * 24;
  o += C.hambre > 0 ? -28 * C.hambre : 4;
  o += a.hogar == null ? (a.edad < 3 ? 0 : -14) : a.clase === 'alta' ? 8 : a.clase === 'baja' ? -3 : 3;
  if (a.salud < 70) o -= (70 - a.salud) * 0.3;
  if (a.pareja) o += 5;
  const amigos = Object.values(a.rel).filter((v) => v > 40).length; o += Math.min(8, amigos * 2) - (amigos === 0 ? 6 : 0);
  if (a.oficio && a.edad >= 14) o += preferencia(s, a, a.oficio) > 0.3 ? 4 : -2;
  o -= (C.gini || 0) * (a.clase === 'baja' ? 30 : a.v.empatia > 0.6 ? 12 : 0);
  o -= Gb.autoridad * libertad * 18 - (Gb.autoridad > 0.6 && a.v.lealtad > 0.6 ? 6 : 0);
  if (a.v.fe > 0.6) o += cap(s, a.al, 'templo') || s.era === 0 ? 4 : -4;
  if (s.gobierno === 'teocracia' && a.v.fe < 0.35) o -= 8;
  if (s.leyes.censura && a.v.curiosidad > 0.65) o -= 7;
  o -= (mp.get(a.hogar)?.cont || 0) * 25;
  if (s.guerra && (s.guerra.a === a.al || s.guerra.b === a.al)) o -= 8 * (1 - a.op.guerra * 0.5);
  if (C.sinEnergia) o -= 8; if (C.sinBienes && s.era >= 2) o -= 5;
  o += Math.min(6, (C.cultura || 0) * 30);
  if (s.fiesta && s.dia <= s.fiesta) o += 6;
  if (a.sueno.ok) o += 8;
  for (const m of a.mem) o += m.peso * 0.35;
  return clamp(o);
}
// qué tan bien le cae un oficio a esta persona (su carácter y lo que piensa)
function preferencia(s, a, k) {
  const v = a.v, p = a.p, op = a.op;
  switch (k) {
    case 'comida': return p.res * 0.3 + (1 - p.ape) * 0.25 + op.naturaleza * 0.15;
    case 'materiales': return p.res * 0.3 + (1 - p.ape) * 0.2 + (1 - p.neu) * 0.1;
    case 'metal': return (1 - p.neu) * 0.25 + v.ambicion * 0.15 + op.tecnologia * 0.1;
    case 'energia': return op.tecnologia * 0.4 + p.res * 0.2;
    case 'bienes': return p.res * 0.3 + op.tecnologia * 0.2 + p.ape * 0.1;
    case 'ciencia': return v.curiosidad * 0.9 + op.ciencia * 0.4 - 0.25 + (a.edu < 4 + s.era * 6 ? -1 : 0);
    case 'fe': return v.fe * 1.1 + op.religion * 0.4 - 0.45;
    case 'salud': return v.empatia * 0.7 + v.curiosidad * 0.2 - 0.2 + (a.edu < 3 + s.era * 4 ? -0.6 : 0);
    case 'comercio': return v.codicia * 0.6 + p.ext * 0.4 + v.ambicion * 0.3 - 0.35;
    case 'seguridad': return (1 - v.miedo) * 0.35 + v.lealtad * 0.3 + op.guerra * 0.35 - 0.2;
    case 'cultura': return p.ape * 0.6 + (1 - p.res) * 0.3 - 0.3;
    case 'construir': return p.res * 0.3 + (1 - p.ape) * 0.15 + (1 - p.neu) * 0.1;
  }
  return 0;
}
// criterio propio: oficio, inventar, migrar, sueños, fe
function decidir(s, a, C, D) {
  if (a.edad < 68) {
    const cuenta = tmp(s).cuenta[a.al] || contarOficios(s, a.al);
    let mejor = null, mp = -1e9;
    for (const k of Object.keys(OFICIOS)) {
      const O = OFICIOS[k]; if ((O.era || 0) > s.era || !D.t[k]) continue;
      if (k === 'metal' && !s.tec.bronce) continue;
      const hay = cuenta[k] || 0, falta = (D.t[k] - hay + (a.oficio === k ? 1 : 0)) / Math.max(1, D.t[k]);
      const sc = Math.max(-1, Math.min(1.5, falta)) * 1.4 + preferencia(s, a, k) + (a.oficio === k ? 0.3 + (a.hab[k] || 0) / 160 : 0) + (k === 'comercio' || k === 'ciencia' ? a.v.ambicion * 0.15 : 0) + (hash(a.id * 31 + s.dia) - 0.5) * 0.25;
      if (sc > mp) { mp = sc; mejor = k; }
    }
    if (mejor && mejor !== a.oficio) {
      const antes = a.oficio; if (antes) cuenta[antes] = (cuenta[antes] || 1) - 1; cuenta[mejor] = (cuenta[mejor] || 0) + 1;
      a.oficio = mejor; a.trabajo = null;
      vida(s, a, antes ? `Dejó de ser ${tituloOficio(antes, s.era, a.sexo).toLowerCase()} y se hizo ${tituloOficio(mejor, s.era, a.sexo).toLowerCase()}` : `Empezó a trabajar como ${tituloOficio(mejor, s.era, a.sexo).toLowerCase()}`);
    }
  }
  if (['ciencia', 'bienes', 'salud', 'energia'].includes(a.oficio) && a.edu > 6 && prob(s, 0.006 * a.v.curiosidad * (1 + a.edu / 40) * (s.leyes.censura ? 0.4 : 1))) inventar(s, a);
  // migrar a otra ciudad (o irse del orbe) si la vida es dura aquí
  a.triste = a.animo < 28 ? a.triste + 1 : Math.max(0, a.triste - 1);
  if (a.triste >= 3 && a.edad >= 17) {
    const otra = vivas(s).filter((B) => B.id !== a.al && B.hambre < 0.1 && lazo(s, a.al, B.id) > -40).sort((x, y) => animoCiudad(s, y.id) - animoCiudad(s, x.id))[0];
    if (otra && animoCiudad(s, otra.id) > a.animo + 10 && prob(s, 0.4)) { const de = C.nombre; mudar(s, a, otra.id); vida(s, a, `Se mudó de ${de} a ${otra.nombre}`); M.recordar(a, sello(s), `Dejó ${de} buscando una vida mejor`, 6); a.triste = 0; }
    else if (a.triste >= 6 && prob(s, 0.12) && s.gente.length > 8) { irse(s, a, C); return; }
  }
  revisarSueno(s, a);
  // el carácter tira de vuelta: las opiniones no se disuelven del todo en las de los demás
  const base = M.opinionesBase(a.v); for (const k of Object.keys(a.op)) a.op[k] += (base[k] - a.op[k]) * 0.03;
  // las relaciones se enfrían si no se cultivan
  for (const k of Object.keys(a.rel)) if (+k !== a.pareja && !a.padres.includes(+k) && !a.hijos.includes(+k)) a.rel[k] = Math.round(a.rel[k] * 0.96);
  // la fe se gana o se pierde con lo vivido
  if (prob(s, 0.05)) a.v.fe = +clamp(a.v.fe + (a.op.religion - (a.v.fe * 2 - 1)) * 0.05, 0, 1).toFixed(2);
}
function contarOficios(s, al) { const c = {}; for (const a of gentes(s, al)) if (a.oficio && a.edad >= 14) c[a.oficio] = (c[a.oficio] || 0) + 1; tmp(s).cuenta[al] = c; return c; }
const animoCiudad = (s, al) => { const G = gentes(s, al); return G.length ? G.reduce((n, a) => n + a.animo, 0) / G.length : 0; };
const INVENTOS = [['la honda', 'el arco', 'la red de pesca', 'el anzuelo de hueso'], ['el arado', 'el molino de mano', 'el telar', 'el horno de barro'], ['la noria', 'el reloj de sol', 'la balanza', 'el arco de piedra'], ['el telescopio', 'la brújula', 'el microscopio', 'la imprenta de tipos'], ['el telégrafo', 'la locomotora', 'el pararrayos', 'la vacuna'], ['la bombilla', 'el teléfono', 'el avión', 'la radio portátil'], ['el microchip', 'la red global', 'el satélite', 'la edición genética'], ['el reactor de bolsillo', 'la nanomáquina', 'el implante neural', 'la vela solar']];
function inventar(s, a) {
  const que = pick(s, INVENTOS[Math.min(7, s.era)]), inv = s.inv.c;
  if (inv) inv.p += TEC[inv.k].costo * 0.1;
  a.inventos++; a.fama += 10; s.cont.inventos++;
  social(s, 'invento', `${a.nombre} (${que})`);
  vida(s, a, `Inventó ${que}`); M.recordar(a, sello(s), `Inventó ${que}`, 14, 'ciencia', 0.15);
  for (const [id, v] of Object.entries(a.rel)) if (v > 30) { const b = vivo(s, +id); if (b) M.recordar(b, sello(s), `${a.nombre} inventó ${que}`, 3, 'tecnologia', 0.04); }
}
function revisarSueno(s, a) {
  const S = a.sueno; if (S.ok) return;
  const ok = { familia: a.hijos.filter((id) => vivo(s, id)).length >= 2, riqueza: a.rank > 0.85 && s.era > 0, saber: a.inventos > 0, fe: a.oficio === 'fe' && (a.hab.fe || 0) > 40, poder: s.ciudades.some((C) => C.lider === a.id), aventura: a.vida.some((v) => /Se mudó|fundar/.test(v.texto)), arte: a.oficio === 'cultura' && (a.hab.cultura || 0) > 40, paz: a.edad > 50 && !a.mem.some((m) => m.peso < -10) }[S.k];
  if (ok) { S.ok = true; S.anio = anio(s); vida(s, a, `Cumplió su sueño: ${M.SUENOS[S.k].toLowerCase()}`); M.recordar(a, sello(s), 'Cumplió su sueño', 18); }
}
function conversar(s, a) {
  const ks = Object.keys(a.rel), G = gentes(s, a.al);
  let b = null;
  if (ks.length && prob(s, 0.6)) b = vivo(s, +pick(s, ks));
  else if (G.length > 1) b = pick(s, G);
  if (!b || b === a || b.edad < 4) return;
  const antes = a.rel[b.id] || 0;
  let d = ent(s, -4, 6) + (a.p.ama + b.p.ama - 1) * 4;
  let dif = 0; for (const k of Object.keys(a.op)) dif += Math.abs(a.op[k] - b.op[k]); d += (1 - dif / 7) * 5 - 2.2;
  if (a.oficio === b.oficio) d += 1; if (a.clase === b.clase) d += 0.8; if (a.mov && a.mov === b.mov) d += 2;
  const v = antes + d;
  relacion(a, b.id, v); relacion(b, a.id, (b.rel[a.id] || 0) + d);
  M.influir(a, b, v); M.influir(b, a, v);
  if (antes < 45 && v >= 45 && !familia(a, b) && a.pareja !== b.id && !(a.amigos || []).includes(b.id)) { (a.amigos ||= []).push(b.id); if (a.amigos.length > 8) a.amigos.shift(); social(s, 'amig', `${a.nombre} y ${b.nombre}`); vida(s, a, `Se hizo amig${g(a, 'o', 'a')} de ${b.nombre}`); }
  if (antes > -45 && v <= -45) { social(s, 'enem', `${a.nombre} y ${b.nombre}`); vida(s, a, `Se enemistó con ${b.nombre}`); }
  if (v < -55 && a.p.ama < 0.35 && prob(s, 0.05)) { a.salud -= ent(s, 4, 14); b.salud -= ent(s, 4, 14); social(s, 'pelea', `${a.nombre} y ${b.nombre}`); M.recordar(a, sello(s), `Se peleó con ${b.nombre}`, -10); M.recordar(b, sello(s), `Se peleó con ${a.nombre}`, -10); }
}
function buscarPareja(s, a) {
  const cand = Object.entries(a.rel).map(([id, v]) => [vivo(s, +id), v]).filter(([b, v]) => b && v > 25 && !b.pareja && b.sexo !== a.sexo && b.edad >= 17 && Math.abs(b.edad - a.edad) < 14 && !familia(a, b)).sort((x, y) => y[1] - x[1]);
  if (cand.length) emparejar(s, a, cand[0][0]);
  else {
    // si no hay a quién querer, se busca: alguien soltero y parecido (o se arregla un matrimonio)
    const sol = gentes(s, a.al).filter((b) => b !== a && !b.pareja && b.sexo !== a.sexo && b.edad >= 17 && Math.abs(b.edad - a.edad) < 12 && !familia(a, b));
    const b = sol.sort((x, y) => similitud(a, y) - similitud(a, x))[0];
    if (b) { relacion(a, b.id, (a.rel[b.id] || 0) + 14); relacion(b, a.id, (b.rel[a.id] || 0) + 14); if (a.edad > 24 && prob(s, 0.25)) emparejar(s, a, b); }
  }
}
function parto(s, m) {
  const p = vivo(s, m.pareja), C = s.ciudades[m.al];
  const h = nuevaPersona(s, { edad: 0, apellido: p?.apellido || m.apellido, padres: [m.id, ...(p ? [p.id] : [])], al: m.al });
  m.hijos.push(h.id); if (p) p.hijos.push(h.id);
  relacion(h, m.id, 70); relacion(m, h.id, 70); if (p) { relacion(h, p.id, 65); relacion(p, h.id, 65); }
  h.hogar = m.hogar; h.clase = m.clase; h.riqueza = 0;
  s.cont.nacimientos++;
  if (s.gente.length < 60) social(s, 'nace', `${h.nombre} (${g(h, 'hijo', 'hija')} de ${m.nombre})`);
  vida(s, m, `Nació ${h.nombre}`); if (p) vida(s, p, `Nació ${h.nombre}`); vida(s, h, `Nació en ${C.nombre}, ${g(h, 'hijo', 'hija')} de ${m.nombre}${p ? ` y ${p.nombre}` : ''}`);
  M.recordar(m, sello(s), `Nació su ${g(h, 'hijo', 'hija')} ${h.nombre}`, 14); if (p) M.recordar(p, sello(s), `Nació su ${g(h, 'hijo', 'hija')} ${h.nombre}`, 12);
  if (prob(s, 0.012 / (s.mult.salud || 1))) morir(s, m, 'el parto');
}
const registro = (s, x, extra) => ({ id: x.id, nombre: x.nombre, apellido: x.apellido, sexo: x.sexo, edad: +x.edad.toFixed(1), d: sello(s), padres: x.padres, hijos: x.hijos, pareja: x.pareja, oficio: x.oficio, era: s.era, vida: x.vida.slice(0, 5), p: x.p, v: x.v, op: x.op, sueno: x.sueno, ciudad: s.ciudades[x.al]?.nombre, ...extra });
export function morir(s, a, causa, silencio = false) {
  if (!s.gente.includes(a)) return;
  s.gente = s.gente.filter((x) => x !== a);
  s.cont.muertes++;
  s.difuntos.unshift(registro(s, a, { causa, estado: 'muerto' })); if (s.difuntos.length > 90) s.difuntos.length = 90;
  if (s.tumbas.length < 81) { const C = s.cementerio, i = s.tumbas.length; s.tumbas.push({ x: +(C.x + ((i % 9) - 4) * 1.1).toFixed(2), z: +(C.z + (Math.floor(i / 9) - 4) * 1.2).toFixed(2) }); }
  const ix = idx(s), batalla = /batalla|represión|guerra/.test(causa);
  for (const id of [a.pareja, ...a.hijos, ...a.padres]) { const b = ix.get(id); if (!b) continue; M.recordar(b, sello(s), `Murió ${a.nombre}${batalla ? ' en la violencia' : ''}`, -22, batalla ? 'guerra' : causa === 'enfermedad' ? 'ciencia' : null, batalla ? -0.25 : causa === 'enfermedad' ? (b.v.fe > 0.5 ? -0.05 : 0.05) : 0); if (b.pareja === a.id) { b.pareja = null; b.exPareja = a.id; } vida(s, b, `Murió ${a.nombre}`); }
  const her = [ix.get(a.pareja), ...a.hijos.map((id) => ix.get(id))].filter(Boolean);
  if (her.length) for (const h of her) h.riqueza += a.riqueza / her.length;
  for (const C of s.ciudades) if (C.lider === a.id) { C.lider = null; if (!silencio) log(s, `Muere ${a.nombre}, quien guiaba ${C.nombre}.`, 'malo'); }
  if (!silencio && (a.fama >= 20 || (causa !== 'vejez' && s.gente.length < 40))) log(s, `Muere ${a.nombre} ${a.apellido} a los ${Math.floor(a.edad)} años (${causa}).`, causa === 'vejez' ? 'info' : 'malo');
}
function irse(s, a, C, causa = 'era infeliz') {
  const ix = idx(s), van = [a, ...(a.pareja && ix.get(a.pareja) ? [ix.get(a.pareja)] : [])];
  for (const x of [...van]) for (const id of x.hijos) { const h = ix.get(id); if (h && h.edad < 16 && !van.includes(h)) van.push(h); }
  for (const x of van) { s.gente = s.gente.filter((y) => y !== x); s.idos.unshift(registro(s, x, { causa, estado: 'se fue' })); }
  if (s.idos.length > 80) s.idos.length = 80;
  s.cont.partidas += van.length;
  log(s, `${a.nombre}${van.length > 1 ? ` y ${van.length - 1} más se van` : ' se va'} del orbe: ${causa}.`, 'malo');
}

// ---------------------------------------------------------------- estaciones, años, clima
function estacion(s, f) {
  s.esp.influencia = Math.min(10, s.esp.influencia + 1 + (s.esp.fe > 60 && f.est === 1 ? 1 : 0));
  const C = s.clima;
  if (f.est === 1 && prob(s, 0.12)) { C.sequia = 6; log(s, 'Una sequía golpea los campos.', 'malo'); } else C.sequia = 0;
  C.lluvia = prob(s, [0.4, 0.2, 0.35, 0.2][f.est]) ? 2 : 0; C.nieve = f.est === 3 && prob(s, 0.5) ? 3 : 0;
  if (f.est === 2 && vivas(s).every((X) => X.hambre === 0) && s.gente.length > 5 && prob(s, 0.5)) { s.fiesta = s.dia + 2; log(s, s.era < 3 ? 'Fiesta de la cosecha alrededor del fuego.' : s.era < 6 ? 'Feria de otoño en las plazas.' : 'Festival de otoño en toda la ciudad.', 'bueno'); }
}
function anual(s, f) {
  const H = s.hist, pob = s.gente.length;
  H.anio.push(f.anio); H.pob.push(pob); H.hab.push(habitantes(s)); H.ciencia.push(Math.round(s.puntosAnio?.c || 0)); H.fe.push(Math.round(s.puntosAnio?.f || 0)); H.animo.push(Math.round(s.gente.reduce((n, a) => n + a.animo, 0) / Math.max(1, pob))); H.era.push(s.era); H.eco.push(s.ecologia); H.desig.push(Math.round((s.ciudades[0]?.gini || 0) * 100));
  if (H.anio.length > 400) for (const k of Object.keys(H)) H[k] = H[k].filter((_, i) => i % 2 === 0);
  s.puntosAnio = { c: 0, f: 0 };
  for (const k of Object.keys(s.ejeBase)) s.ejeBase[k] *= 0.995;   // la historia pesa, pero se va desdibujando
  if ((s.era <= 2 && pob < 40 && prob(s, 0.35)) || (pob < 25 && prob(s, 0.45))) llegan(s, 1 + Math.floor(rnd(s) * 3));
  for (const C of vivas(s)) { if (!vivo(s, C.lider) || C.mandato <= f.anio) elegirLider(s, C, 'mandato'); }
  riesgos(s);
  if (!s.destino) fundarCiudad(s);
  for (const c of s.celdas) if (c.cr) { c.cr = +(c.cr * 0.85).toFixed(2); if (c.cr < 0.08) delete c.cr; s.vc++; }   // los cráteres se cubren de hierba
}
function llegan(s, n, C = vivas(s)[0] || s.ciudades[0]) {
  const ap = pick(s, APELLIDOS), nuevos = [];
  if (n >= 2) { const m = nuevaPersona(s, { sexo: 'm', edad: ent(s, 19, 36), apellido: ap, al: C.id }), f = nuevaPersona(s, { sexo: 'f', edad: ent(s, 18, 34), apellido: ap, al: C.id }); emparejar(s, m, f, true); nuevos.push(m, f); if (n >= 3) { const h = nuevaPersona(s, { edad: ent(s, 1, 10), apellido: ap, padres: [m.id, f.id], al: C.id }); m.hijos.push(h.id); f.hijos.push(h.id); nuevos.push(h); } }
  else nuevos.push(nuevaPersona(s, { edad: ent(s, 17, 35), al: C.id }));
  for (const a of nuevos) { vida(s, a, `Llegó a ${C.nombre}`); a.oficio = a.edad >= 14 ? 'comida' : null; }
  if (C.vacia) C.vacia = false;
  s.cont.llegadas += nuevos.length; s.vacioDesde = null;
  log(s, nuevos.length > 1 ? `Llega la familia ${ap} buscando un lugar donde vivir.` : `Llega ${nuevos[0].nombre}, que viene de muy lejos.`, 'bueno');
}
function vacio(s, f) {
  if (s.fin) return;
  if (!s.vacioDesde) { s.vacioDesde = s.dia; log(s, 'No queda nadie en el orbe.', 'malo'); }
  if (s.dia - s.vacioDesde > DIAS_ANIO * 3) { s.fin = true; finHistoria(s, 'extincion'); }
}

// ---------------------------------------------------------------- investigación y eras
function investigar(s) {
  const P = s.puntos; s.puntos = { c: 0, f: 0 };
  s.puntosAnio ||= { c: 0, f: 0 }; s.puntosAnio.c += P.c; s.puntosAnio.f += P.f;
  const k = s.mega ? 0.5 : 1;   // con un megaproyecto en marcha, la mitad del esfuerzo va a él
  if (s.mega) { s.mega.ap.ciencia = (s.mega.ap.ciencia || 0) + P.c * 0.5; s.mega.ap.fe = (s.mega.ap.fe || 0) + P.f * 0.5; }
  for (const t of ['c', 'f']) {
    if (!s.inv[t]) s.inv[t] = elegirTec(s, t);
    const I = s.inv[t]; if (!I) continue;
    I.p += P[t] * k;
    if (I.p >= TEC[I.k].costo) { const sobra = I.p - TEC[I.k].costo; aprender(s, I.k); s.inv[t] = elegirTec(s, t); if (s.inv[t]) s.inv[t].p = sobra; }
  }
  if (s.era < 7) {
    const deEra = Object.keys(s.tec).filter((x) => TEC[x].era === s.era).length;
    if (deEra >= 3 && s.gente.length >= ERAS[s.era + 1].pob) subirEra(s);
  }
}
function elegirTec(s, t) {
  const E = s.ejes, cand = Object.values(TEC).filter((T) => T.t === t && !s.tec[T.k] && T.era <= s.era && T.req.every((r) => s.tec[r]));
  if (!cand.length) return null;
  const sc = (T) => {
    let v = 1 + (T.era < s.era ? 1.2 : 0) + rnd(s) * 0.6;
    if (T.armas) v *= 0.6 + ((E.aa + 100) / 160) * (s.leyes.atomo === false ? 0 : 1);
    if (T.sucio) v *= 0.6 + (E.ni + 100) / 200;
    if (T.limpio) v *= 0.6 + (100 - E.ni) / 200;
    if (T.k === 'ia' && s.leyes.ia === 'no') v *= 0.05;
    if (T.destino === 'estelar') v *= 0.5 + (E.aa + E.cf + 200) / 300;
    if (T.destino === 'colmena') v *= 0.4 + (E.cf - E.ic + 200) / 350;
    if (T.destino === 'gaia') v *= 0.5 + (-E.ni - E.aa + 200) / 300;
    if (s.leyes.censura && t === 'c') v *= 0.8;
    return v;
  };
  const T = cand.map((x) => [x, sc(x)]).sort((a, b) => b[1] - a[1])[0][0];
  return { k: T.k, p: 0 };
}
function aprender(s, k) {
  const T = TEC[k]; s.tec[k] = anio(s);
  for (const [e, x] of Object.entries(T.ejes || {})) s.ejeBase[e] = clamp(s.ejeBase[e] + x, -100, 100);
  recalcMult(s);
  log(s, `Descubren: ${T.n}. ${T.d}`, 'logro');
  if (T.destino) hito(s, `${T.n}: se abre el camino «${DESTINOS[T.destino].n}»`, 'destino');
  else hito(s, T.n, 'tec');
  for (const a of s.gente) if (a.edad > 12 && prob(s, 0.3)) { const gusta = a.op.tecnologia + (T.t === 'f' ? a.op.religion : a.op.ciencia); M.recordar(a, sello(s), `Llegó ${T.n.toLowerCase()}`, gusta > 0 ? 3 : -2, T.t === 'f' ? 'religion' : 'tecnologia', gusta > 0 ? 0.04 : -0.02); }
  if (k === 'radio' || k === 'internet') log(s, k === 'radio' ? 'Las voces de la radio llegan a todas las casas: las ideas se contagian más rápido.' : 'Todos conectados: cualquier idea puede volverse un movimiento en días.', 'info');
}
function subirEra(s) {
  s.era++; s.eras.push({ era: s.era, anio: anio(s), ciclo: s.ciclo });
  const E = ERAS[s.era];
  log(s, `${E.i} Comienza una nueva era: ${E.n}. ${E.d}`, 'era');
  hito(s, `${E.i} ${E.n}`, 'era');
  for (const a of s.gente) if (a.edad > 10) M.recordar(a, sello(s), `Empezó una nueva era: ${E.n.toLowerCase()}`, a.op.tecnologia > 0 ? 6 : -1, 'tecnologia', a.op.tecnologia > 0 ? 0.04 : 0);
  recalcMult(s);
  const D = Object.entries(DECISIONES).find(([, d]) => d.era === s.era);
  if (D) { if (s.decision) s.decisionPendiente = D[0]; else abrirDecision(s, D[0]); }
  s.vc++;
}

// ---------------------------------------------------------------- decisiones de la sociedad
export function abrirDecision(s, k, ctx = {}) {
  if (s.decision) return false;
  const D = DECISIONES[k] || null;
  let ops = D ? D.ops : null;
  if (k === 'salto') ops = Object.entries(DESTINOS).filter(([, X]) => X.tec && s.tec[X.tec]).map(([d, X]) => ({ k: d, n: `${X.i} ${X.mega}`, d: X.d, w: X.w, destino: d })).concat([{ k: 'esperar', n: 'Todavía no', d: 'Seguir viviendo como hasta ahora (se volverá a preguntar más adelante).', w: { miedo: 0.8, lealtad: 0.3, ambicion: -0.6 } }]);
  if (!ops?.length) return false;
  const txt = (x) => x.replace('{A}', s.ciudades[ctx.a ?? 0]?.nombre || '').replace('{B}', s.ciudades[ctx.b ?? 0]?.nombre || '').replace('{M}', ctx.m || '');
  s.decision = { k, t: k === 'salto' ? 'El gran salto' : txt(D.t), q: k === 'salto' ? 'La civilización puede dar el último paso. ¿Hacia dónde?' : txt(D.q), ops: ops.map((o) => ({ ...o })), abre: s.dia, cierra: s.dia + (D?.crisis ? 12 : DIAS_ANIO), ctx, consejo: {}, forzada: null, crisis: !!D?.crisis };
  log(s, `⚖ La sociedad debe decidir: ${s.decision.t}.`, 'decision');
  // la sociedad decide sola: nadie pausa el tiempo para esperar al jugador
  return true;
}
// el voto de una persona en la decisión pendiente (y por qué)
export function votoDe(s, a, D = s.decision) {
  if (!D) return null;
  let mejor = null, mv = -1e9;
  for (const o of D.ops) {
    let v = M.atractivo(a, o.w) + (hash(a.id * 977 + D.abre + o.k.length * 13) - 0.5) * 0.6;
    if (D.consejo[o.k]) v += D.consejo[o.k] * (0.3 + a.v.fe * 0.9);   // el susurro del espíritu convence más a los creyentes
    if (o.destino) v += alineacion(s, o.destino);   // la cultura que dejó la historia también empuja
    if (v > mv) { mv = v; mejor = o; }
  }
  return { k: mejor.k, n: mejor.n, motivo: M.motivoVoto(a, mejor.w) };
}
export function conteo(s, D = s.decision) {
  if (!D) return null;
  const Gb = GOBIERNOS[s.gobierno], tally = Object.fromEntries(D.ops.map((o) => [o.k, 0])), lider = vivo(s, s.ciudades[0]?.lider);
  const votantes = s.gente.filter((a) => a.edad >= 16);
  let total = 0;
  for (const a of votantes) {
    let w = 1;
    if (Gb.voto === 'mayores') w = a.edad >= 40 ? 2 : 0.4;
    else if (Gb.voto === 'ricos') w = 0.3 + a.rank * 2;
    else if (Gb.voto === 'fieles') w = 0.3 + a.v.fe * 3 + (a.oficio === 'fe' ? 3 : 0);
    else if (Gb.voto === 'sabios') w = 0.3 + a.edu / 20 + (a.oficio === 'ciencia' ? 3 : 0);
    else if (Gb.voto === 'lider') w = a === lider ? votantes.length * 1.5 : a.rank > 0.85 ? 1.5 : 0.25;
    const v = votoDe(s, a, D); tally[v.k] += w; total += w;
  }
  return { tally, total: total || 1, quien: Gb.voto };
}
function decisionDia(s) {
  const D = s.decision; if (!D) { if (s.decisionPendiente) { const k = s.decisionPendiente; s.decisionPendiente = null; abrirDecision(s, k); } return; }
  if (s.dia < D.cierra && !D.forzada) return;
  const c = conteo(s, D), gana = D.forzada || Object.entries(c.tally).sort((a, b) => b[1] - a[1])[0][0];
  const op = D.ops.find((o) => o.k === gana);
  s.decision = null; s.pausar = false;
  const pct = Math.round((c.tally[gana] / c.total) * 100);
  s.decisiones.push({ k: D.k, t: D.t, op: op.k, n: op.n, anio: anio(s), era: s.era, pct, forzada: !!D.forzada, quien: c.quien, ejes: op.ejes || {} });
  log(s, `⚖ ${D.t}: gana «${op.n}»${D.forzada ? ' (impuesto por el espíritu del orbe)' : ` con el ${pct} % del peso de los votos`}.`, 'decision');
  hito(s, `${D.t}: «${op.n}»`, 'decision');
  for (const a of s.gente) if (a.edad >= 16) {
    const v = votoDe(s, a, D);
    if (v.k === gana) M.recordar(a, sello(s), `Ganó lo que quería en «${D.t}»`, 4, 'lider', 0.05);
    else M.recordar(a, sello(s), `Perdió en «${D.t}»: ganó «${op.n}»`, D.forzada ? -9 : -5, 'lider', -0.07);
    if (D.forzada) M.recordar(a, sello(s), 'El espíritu del orbe impuso su voluntad', a.v.fe > 0.5 ? 6 : -6, 'religion', a.v.fe > 0.5 ? 0.15 : -0.12);
  }
  aplicar(s, D, op);
}
function aplicar(s, D, op) {
  for (const [e, x] of Object.entries(op.ejes || {})) s.ejeBase[e] = clamp(s.ejeBase[e] + x, -100, 100);
  if (op.ley) Object.assign(s.leyes, op.ley);
  if (op.gob) cambiarGobierno(s, op.gob, `por la decisión «${D.t}»`);
  if (op.muertos) { const n = Math.round(s.gente.length * op.muertos); for (let i = 0; i < n; i++) { const a = pick(s, s.gente.filter((x) => x.edad >= 16)); if (a) morir(s, a, 'la represión', true); } if (n) log(s, `Mueren ${n} personas en la represión.`, 'malo'); }
  if (op.guerra) empezarGuerra(s, D.ctx.a, D.ctx.b);
  if (op.revolucion) revolucion(s, D.ctx, op.revolucion);
  if (op.destino) empezarMega(s, op.destino);
  if (op.k === 'esperar') s.esperarHasta = s.dia + DIAS_ANIO * 8;
  if (op.k === 'negociar' && D.k === 'guerra') { cambiarLazo(s, D.ctx.a, D.ctx.b, 35); log(s, 'Se firma la paz. Las dos ciudades respiran.', 'bueno'); }
  if (D.k === 'cisma') { const Mv = s.movimientos.find((x) => x.nombre === D.ctx.m); if (Mv) Mv[op.k === 'reconocer' ? 'reconocida' : 'perseguida'] = true; }
  recalcMult(s); calcularEjes(s);
}
function cambiarGobierno(s, gob, porque) {
  if (s.gobierno === gob) return;
  const antes = GOBIERNOS[s.gobierno].n; s.gobierno = gob;
  log(s, `El gobierno cambia: de ${antes.toLowerCase()} a ${GOBIERNOS[gob].n.toLowerCase()} (${porque}).`, 'logro');
  hito(s, GOBIERNOS[gob].n, 'gob');
  for (const C of vivas(s)) elegirLider(s, C, 'cambio');
}

// ---------------------------------------------------------------- líderes (según el gobierno)
function elegirLider(s, C, motivo) {
  const G = gentes(s, C.id).filter((a) => a.edad >= 20); if (!G.length) { C.lider = null; return; }
  const actual = vivo(s, C.lider);
  if (['monarquia', 'dictadura', 'jefatura'].includes(s.gobierno) && actual && actual.al === C.id && motivo === 'mandato') { C.mandato = anio(s) + 8; return; }
  let gana = null;
  if (s.gobierno === 'monarquia' && !actual && C.herederos?.length) gana = C.herederos.map((id) => vivo(s, id)).find((a) => a && a.edad >= 16 && a.al === C.id) || null;
  if (!gana) {
    const votos = gentes(s, C.id).filter((v) => v.edad >= 16).slice(0, 80);
    const pts = (c) => {
      let n = c.v.ambicion * 30 + c.p.ext * 20 + c.fama * 0.6 + (c.edad > 30 && c.edad < 65 ? 10 : 0);
      if (s.gobierno === 'teocracia') n += c.v.fe * 50 + (c.oficio === 'fe' ? 30 : 0);
      if (s.gobierno === 'tecnocracia') n += c.edu * 0.8 + (c.oficio === 'ciencia' ? 25 : 0);
      if (['republica', 'democracia', 'comuna', 'consejo'].includes(s.gobierno)) n += (votos.reduce((x, v) => x + (v.rel[c.id] || 0) * 0.2 + similitud(v, c) * 6, 0) / Math.max(1, votos.length)) * 8;
      if (s.gobierno === 'consejo') n += c.edad * 0.6;
      if (s.gobierno === 'republica') n += c.rank * 30;
      if (s.gobierno === 'comuna') n += c.v.empatia * 25 - c.rank * 15;
      return n + rnd(s) * 8;
    };
    gana = G.map((c) => [c, pts(c)]).sort((a, b) => b[1] - a[1])[0][0];
  }
  const antes = C.lider; C.lider = gana.id; C.mandato = anio(s) + (GOBIERNOS[s.gobierno].voto === 'todos' || s.gobierno === 'republica' ? 4 : 8);
  if (s.gobierno === 'monarquia') C.herederos = gana.hijos.slice();
  if (antes !== gana.id) {
    gana.fama += 15; vida(s, gana, `Llegó a guiar ${C.nombre}`); M.recordar(gana, sello(s), `Llegó al poder en ${C.nombre}`, 14);
    revisarSueno(s, gana);
    const cargo = cargoDe(s, gana);
    if (C.id === 0 || gentes(s, C.id).length > 15) log(s, `${gana.nombre} ${gana.apellido} es ahora ${cargo} de ${C.nombre}.`, 'info');
    if (C.id === 0) hito(s, `${gana.nombre} ${gana.apellido}, ${cargo}`, 'lider');
  }
}
export function cargoDe(s, a) { return { consejo: 'la voz del consejo', jefatura: g(a, 'el jefe', 'la jefa'), monarquia: g(a, 'el rey', 'la reina'), teocracia: g(a, 'el sumo sacerdote', 'la suma sacerdotisa'), republica: g(a, 'el cónsul', 'la cónsul'), democracia: g(a, 'el presidente', 'la presidenta'), dictadura: g(a, 'el dictador', 'la dictadora'), comuna: g(a, 'el delegado', 'la delegada'), tecnocracia: g(a, 'el director', 'la directora') }[s.gobierno]; }
const similitud = (a, b) => { let d = 0; for (const k of Object.keys(a.op)) d += Math.abs(a.op[k] - b.op[k]); return 1 - d / 7; };

// ---------------------------------------------------------------- ejes del destino
export function calcularEjes(s) {
  const A = s.gente.filter((a) => a.edad >= 16), n = A.length || 1, prom = (f) => A.reduce((x, a) => x + f(a), 0) / n;
  const ind = s.celdas.filter((c) => ['taller', 'central', 'mina'].includes(c.u) && c.e >= 4).length, dev = s.celdas.filter((c) => c.u).length || 1;
  const op = {
    cf: prom((a) => a.op.ciencia - a.op.religion) * 30,
    aa: prom((a) => a.v.ambicion - a.v.empatia + a.op.guerra * 0.4) * 40,
    ic: prom((a) => a.v.codicia - a.v.empatia * 0.5 - a.op.igualdad * 0.5) * 35,
    ni: prom((a) => a.op.tecnologia - a.op.naturaleza) * 25 + (ind / dev) * 40 - (s.ecologia - 60) * 0.25,
  };
  for (const k of Object.keys(s.ejes)) s.ejes[k] = Math.round(clamp(s.ejeBase[k] + op[k], -100, 100));
  s.ejesOp = Object.fromEntries(Object.entries(op).map(([k, v]) => [k, Math.round(v)]));
}

// ---------------------------------------------------------------- movimientos sociales (nacen de la suma de individuos)
function movimientos(s) {
  const A = s.gente.filter((a) => a.edad >= 16), n = A.length; if (n < 6) return;
  const crear = (tipo, tema, fil, umbral, al = null) => {
    const sim = A.filter(fil);
    let Mv = s.movimientos.find((x) => x.tipo === tipo && x.activo);
    if (!Mv && sim.length / n >= umbral) {
      const lider = sim.sort((a, b) => b.p.ext + b.v.ambicion - a.p.ext - a.v.ambicion)[0];
      Mv = { id: s.sigMov++, tipo, tema, nombre: pick(s, NOMBRES_MOV[tipo]), desde: anio(s), lider: lider.id, activo: true, fuerza: 0, al: al ?? lider.al };
      s.movimientos.push(Mv); s.movimientos = s.movimientos.slice(-14);
      log(s, `Nace «${Mv.nombre}»: ${{ huelga: 'los obreros se organizan', secta: 'una nueva forma de fe', revolucion: 'un movimiento contra el gobierno', ecologista: 'defensores del bosque y del aire', tecno: 'entusiastas del futuro', renacimiento: 'un florecer de artes y ciencias', pacifista: 'un movimiento por la paz' }[tipo]}, guiado por ${lider.nombre}.`, 'mov');
      hito(s, `Movimiento «${Mv.nombre}»`, 'mov'); vida(s, lider, `Fundó «${Mv.nombre}»`); lider.fama += 12;
    }
    if (!Mv) return null;
    for (const a of A) { if (a.mov === Mv.id && !fil(a) && prob(s, 0.3)) a.mov = null; else if (a.mov == null && fil(a) && prob(s, 0.45)) { a.mov = Mv.id; vida(s, a, `Se unió a «${Mv.nombre}»`); } }
    Mv.fuerza = +(A.filter((a) => a.mov === Mv.id).length / n).toFixed(2);
    if (Mv.fuerza < umbral * 0.4) { Mv.activo = false; Mv.hasta = anio(s); for (const a of A) if (a.mov === Mv.id) a.mov = null; log(s, `«${Mv.nombre}» se disuelve.`, 'info'); return null; }
    return Mv;
  };
  const e = s.era;
  const h = e >= 3 ? crear('huelga', 'igualdad', (a) => a.clase === 'baja' && a.animo < 42 && a.op.igualdad > 0.25, 0.18) : null;
  if (h && h.fuerza > 0.25 && !s.decision && prob(s, 0.3)) abrirDecision(s, 'desigualdad', { a: h.al });
  const sec = crear('secta', 'religion', (a) => a.v.fe > 0.68 && a.op.religion > 0.45 && (s.ejes.cf > 0 || a.op.lider < 0), 0.12);
  if (sec && sec.fuerza > 0.18 && !sec.reconocida && !sec.perseguida && !s.decision) abrirDecision(s, 'cisma', { m: sec.nombre });
  if (sec) s.puntos.f += sec.fuerza * 3;
  const rev = e >= 1 ? crear('revolucion', 'lider', (a) => a.op.lider < -0.35 && a.animo < 45, 0.22) : null;
  if (rev && rev.fuerza > 0.3 && !s.decision) abrirDecision(s, 'revolucion', { m: rev.nombre, mov: rev.id });
  const eco = e >= 4 ? crear('ecologista', 'naturaleza', (a) => a.op.naturaleza > 0.45 && (s.contaminacion > 0.2 || s.ecologia < 60), 0.15) : null;
  if (eco && eco.fuerza > 0.2 && s.contaminacion > 0.3 && !s.decision && s.leyes.verde !== 2) abrirDecision(s, 'contaminacion', { a: 0 });
  if (e >= 5) crear('tecno', 'tecnologia', (a) => a.op.tecnologia > 0.55 && a.v.curiosidad > 0.55, 0.15);
  if (e >= 2 && e <= 4) crear('renacimiento', 'ciencia', (a) => a.op.ciencia > 0.3 && a.p.ape > 0.6 && s.cultura > 50 * (e + 1), 0.12);
  crear('pacifista', 'guerra', (a) => a.op.guerra < -0.45 && !!(s.guerra || s.leyes.bomba), 0.18);
  for (const Mv of s.movimientos) if (Mv.activo && !vivo(s, Mv.lider)) { const nuevo = A.find((a) => a.mov === Mv.id); if (nuevo) Mv.lider = nuevo.id; }
}
function revolucion(s, ctx, modo) {
  const Mv = s.movimientos.find((x) => x.id === ctx.mov) || s.movimientos.find((x) => x.tipo === 'revolucion' && x.activo);
  const nuevo = s.ejes.ic < -10 ? 'comuna' : s.ejes.cf < -25 ? 'teocracia' : s.ejes.cf > 30 && s.era >= 5 ? 'tecnocracia' : 'democracia';
  s.cont.revoluciones++;
  if (modo === 'ceder') { cambiarGobierno(s, nuevo, `la revolución «${Mv?.nombre || ''}»`); if (Mv) { Mv.activo = false; Mv.hasta = anio(s); const L = vivo(s, Mv.lider); if (L) { s.ciudades[L.al].lider = L.id; L.fama += 20; } } return; }
  const fuerzaReb = (Mv?.fuerza || 0.3) * s.gente.length, defensa = vivas(s).reduce((n, C) => n + C.defensa, 0);
  const muertos = Math.round(s.gente.length * ent(s, 0.03, 0.09));
  for (let i = 0; i < muertos; i++) { const a = pick(s, s.gente.filter((x) => x.edad >= 16)); if (a) morir(s, a, 'la represión', true); }
  if (fuerzaReb > defensa * 1.4 && prob(s, 0.6)) { log(s, `La represión fracasa: ${muertos} muertos y la revolución toma el poder.`, 'malo'); cambiarGobierno(s, nuevo, 'una revolución sangrienta'); hito(s, 'Guerra civil', 'malo'); if (s.leyes.bomba && prob(s, 0.15)) return destruir(s, 'nuclear'); }
  else { log(s, `La revolución es aplastada: ${muertos} muertos. El miedo se instala.`, 'malo'); if (Mv) { Mv.activo = false; Mv.hasta = anio(s); } if (s.gobierno !== 'dictadura' && prob(s, 0.4)) cambiarGobierno(s, 'dictadura', 'el aplastamiento de la revolución'); }
  for (const a of s.gente) M.recordar(a, sello(s), `La represión de «${Mv?.nombre || 'la revolución'}»`, -10, 'lider', a.mov === Mv?.id ? -0.3 : -0.08);
}

// ---------------------------------------------------------------- crisis, guerras, epidemias y riesgos de destrucción
function crisis(s) {
  if (s.decision) return;
  for (const C of vivas(s)) if ((C.gini || 0) > 0.45 && s.era >= 2 && prob(s, 0.03)) return void abrirDecision(s, 'desigualdad', { a: C.id });
  if (s.contaminacion > 0.45 && s.era >= 4 && s.leyes.verde !== 2 && prob(s, 0.05)) return void abrirDecision(s, 'contaminacion', { a: 0 });
  const abiertos = Object.values(DESTINOS).filter((X) => X.tec && s.tec[X.tec]).length, enEra7 = anio(s) - (s.eras.filter((x) => x.era === 7).pop()?.anio || anio(s));
  // si la cultura tira hacia un destino que todavía no tiene su tecnología, la sociedad espera (un tiempo)
  const quiere = Object.keys(DESTINOS).filter((k) => DESTINOS[k].tec).sort((a, b) => alineacion(s, b) - alineacion(s, a))[0];
  const espera = quiere && !s.tec[DESTINOS[quiere].tec] && alineacion(s, quiere) > 0.2 && enEra7 < 45;
  if (s.era >= 7 && !s.mega && s.dia > (s.esperarHasta || 0) && abiertos && !espera && (abiertos >= 2 || enEra7 > 12)) abrirDecision(s, 'salto');
}
function entreCiudades(s) {
  const V = vivas(s);
  for (const A of V) for (const B of V) {
    if (A.id >= B.id) continue;
    const LA = vivo(s, A.lider), LB = vivo(s, B.lider);
    let d = (20 - lazo(s, A.id, B.id)) * 0.03 + (LA && LA.v.ambicion > 0.65 ? -0.5 : 0) + (LB && LB.v.ambicion > 0.65 ? -0.5 : 0) - (s.ejes.aa / 100) * 0.8 + ent(s, -1, 1) - (A.hambre > 0.2 || B.hambre > 0.2 ? 0.8 : 0);
    if (s.movimientos.some((x) => x.tipo === 'pacifista' && x.activo)) d += 1.2;
    cambiarLazo(s, A.id, B.id, d);
    if (lazo(s, A.id, B.id) < -55 && !s.guerra && s.era >= 1 && !s.decision && prob(s, 0.1)) abrirDecision(s, 'guerra', { a: A.id, b: B.id });
  }
}
function empezarGuerra(s, a, b) {
  if (a == null || b == null) return;
  s.guerra = { a, b, desde: s.dia, bajas: [0, 0] }; s.cont.guerras++;
  log(s, `⚔ Estalla la guerra entre ${s.ciudades[a].nombre} y ${s.ciudades[b].nombre}.`, 'malo'); hito(s, `Guerra: ${s.ciudades[a].nombre} contra ${s.ciudades[b].nombre}`, 'malo');
}
function guerraDia(s) {
  const W = s.guerra; if (!W) return;
  const A = s.ciudades[W.a], B = s.ciudades[W.b];
  if (A.vacia || B.vacia) { s.guerra = null; return; }
  const fa = A.defensa + gentes(s, A.id).length * 0.1, fb = B.defensa + gentes(s, B.id).length * 0.1;
  for (const [C, f, otro, i] of [[A, fa, fb, 0], [B, fb, fa, 1]]) {
    if (gentes(s, C.id).length > 6 && prob(s, 0.06 * (otro / (f + otro + 0.01)) * (1 + s.era * 0.1))) { const v = pick(s, gentes(s, C.id).filter((x) => x.edad >= 16 && x.edad < 60)); if (v) { W.bajas[i]++; morir(s, v, 'una batalla', true); } }
    if (s.era >= 2 && prob(s, 0.03)) { const c = pick(s, s.celdas.filter((x) => x.al === C.id && x.u && !x.ru)); if (c) { c.ru = true; s.vc++; } }
  }
  if (s.leyes.bomba && s.tec.fision && prob(s, 0.0025 * (1 + Math.max(0, s.ejes.aa) / 50))) return destruir(s, 'nuclear');
  if (s.dia - W.desde > DIAS_ANIO && prob(s, 0.03)) {
    const ganador = fa > fb ? A : B, perdedor = ganador === A ? B : A;
    log(s, `Termina la guerra: ${ganador.nombre} vence. Muertos: ${W.bajas[0] + W.bajas[1]}.`, 'logro');
    hito(s, `Fin de la guerra: vence ${ganador.nombre}`, 'malo');
    if (fa > fb * 2 || fb > fa * 2) { for (const x of gentes(s, perdedor.id)) { x.al = ganador.id; M.recordar(x, sello(s), `${perdedor.nombre} fue conquistada`, -12, 'guerra', -0.2); } for (const c of s.celdas) if (c.al === perdedor.id) c.al = ganador.id; perdedor.vacia = true; invalidar(s); log(s, `${perdedor.nombre} pasa a manos de ${ganador.nombre}.`, 'malo'); s.vc++; }
    cambiarLazo(s, A.id, B.id, 40); s.guerra = null;
    for (const x of s.gente) M.recordar(x, sello(s), 'Terminó la guerra', 6, 'guerra', x.al === ganador.id ? 0.05 : -0.15);
  }
}
function epidemiaDia(s) {
  if (!s.epidemia) {
    if (prob(s, (0.0009 * (1 + s.contaminacion * 2)) / (s.mult.salud || 1) + (s.tec.genetica ? 0.0004 : 0))) { const C = pick(s, vivas(s)); if (!C) return; s.epidemia = { al: C.id, hasta: s.dia + 30 }; log(s, `Una epidemia se extiende por ${C.nombre}.`, 'malo'); if (!s.decision) abrirDecision(s, 'epidemia', { a: C.id }); }
    return;
  }
  const E = s.epidemia, C = s.ciudades[E.al], cuar = s.leyes.cuarentena > 0;
  for (const a of gentes(s, E.al)) if (!a.enf && prob(s, (cuar ? 0.006 : 0.025) / (s.mult.salud || 1))) a.enf = Math.round(ent(s, 4, 12));
  if (s.leyes.cuarentena > 0) s.leyes.cuarentena--;
  if (s.dia > E.hasta) { s.epidemia = null; log(s, `La epidemia de ${C.nombre} termina.`, 'bueno'); }
}
export function riesgosDe(s) {
  const r = {}, V = vivas(s);
  let peorLazo = 100; for (const A of V) for (const B of V) if (A.id < B.id) peorLazo = Math.min(peorLazo, lazo(s, A.id, B.id));
  r.nuclear = s.leyes.bomba && s.tec.fision ? Math.round(clamp(20 + (s.guerra ? 40 : 0) + Math.max(0, s.ejes.aa) * 0.4 + Math.max(0, -peorLazo) * 0.3)) : 0;
  r.ia = s.tec.ia ? (s.leyes.ia === 'libre' ? 55 : s.leyes.ia === 'control' ? 18 : 4) + Math.round(Math.max(0, s.ejes.cf) * 0.2) : 0;
  r.eco = Math.round(clamp(100 - s.ecologia - 20) * (s.era >= 4 ? 1 : 0.3));
  r.plaga = s.tec.genetica ? Math.round(12 + Math.max(0, s.ejes.aa) * 0.2) : 0;
  const ad = s.gente.filter((a) => a.edad >= 16), des = ad.filter((a) => a.op.lider < -0.3).length / Math.max(1, ad.length);
  r.civil = Math.round(clamp(des * 120 + (V[0]?.gini || 0) * 40 - 20));
  return r;
}
function riesgos(s) {
  const r = (s.riesgos = riesgosDe(s));
  if (s.era >= 5 && r.nuclear > 0 && prob(s, (r.nuclear / 100) * (s.guerra ? 0.03 : 0.008))) return destruir(s, 'nuclear');   // sin guerra, la bomba casi siempre se queda guardada
  if (r.ia > 0 && prob(s, (r.ia / 100) * 0.016)) return destruir(s, 'ia');
  if (s.ecologia < 12 && s.era >= 4) { s.ecoMal = (s.ecoMal || 0) + 1; if (s.ecoMal > 10 && prob(s, 0.15)) return destruir(s, 'eco'); } else s.ecoMal = 0;
  if (r.plaga > 0 && prob(s, (r.plaga / 100) * 0.02)) return destruir(s, 'plaga');
  if (r.civil > 70 && s.era >= 3 && prob(s, 0.04)) return destruir(s, 'civil');
}
export function destruir(s, causa) {
  const frac = { nuclear: 0.93, ia: 0.97, eco: 0.8, plaga: 0.85, civil: 0.55, hambre: 0.7 }[causa] || 0.8;
  const total = s.gente.length, muertos = s.gente.filter(() => prob(s, frac));
  for (const a of muertos) morir(s, a, CAUSAS[causa].n.toLowerCase(), true);
  U.arruinar(s, causa === 'eco' || causa === 'plaga' ? 0.35 : causa === 'civil' ? 0.5 : 0.9, () => rnd(s));
  if (causa === 'nuclear' || causa === 'eco') { for (const t of s.arboles) if (prob(s, causa === 'nuclear' ? 0.7 : 0.5)) t.c = -1; for (const c of s.celdas) c.cont = Math.min(1, c.cont + (causa === 'nuclear' ? 0.8 : 0.4)); }
  log(s, `💀 ${CAUSAS[causa].n}. ${CAUSAS[causa].t} Mueren ${muertos.length} de cada ${total}.`, 'malo');
  hito(s, `💀 ${CAUSAS[causa].n}`, 'malo');
  if (s.era >= 4 || s.gente.length < 4) { s.destino = { tipo: 'destruccion', causa, dia: s.dia, anio: anio(s), era: s.era }; s.decision = null; s.mega = null; s.pausar = false; }
  else { s.era = Math.max(0, s.era - 1); log(s, 'La civilización retrocede: se pierde parte de lo aprendido.', 'malo'); }
  s.vc++;
}

// ---------------------------------------------------------------- ciudades nuevas
function fundarCiudad(s) {
  const C0 = s.ciudades[0], G = gentes(s, 0);
  if (vivas(s).length >= Math.min(7, 3 + Math.floor(s.era / 2)) || G.length < 40 || s.era < 1 || !prob(s, 0.25 + s.era * 0.04)) return;
  const sitio = sitioCiudad(s); if (!sitio) return;
  const parejas = G.filter((a) => a.sexo === 'f' && a.pareja && a.edad >= 18 && a.edad < 40).map((m) => [m, vivo(s, m.pareja)]).filter(([, p]) => p && p.al === 0 && p.id !== C0.lider).sort((x, y) => y[0].v.ambicion + y[1].p.ape - x[0].v.ambicion - x[1].p.ape);
  if (parejas.length < 2) return;
  const nombre = pick(s, NOMBRES_CIUDAD.filter((n) => !s.ciudades.some((C) => C.nombre === n))), B = nuevaCiudad(s, nombre, sitio.x, sitio.z, 0);
  const n = Math.min(parejas.length, 2 + Math.floor(G.length / 30));
  for (const [m, p] of parejas.slice(0, n)) { mudar(s, m, B.id); mudar(s, p, B.id); vida(s, m, `Ayudó a fundar ${nombre}`); vida(s, p, `Ayudó a fundar ${nombre}`); M.recordar(m, sello(s), `Fundó ${nombre}`, 12); }
  for (const r of ['comida', 'materiales', 'metal', 'bienes']) { const q = C0.res[r] * 0.2; C0.res[r] -= q; B.res[r] += q; }
  const c = U.celdaEn(s, B.x, B.z); if (c) { c.u = 'teatro'; c.n = 1; c.al = B.id; c.fogata = true; c.e = s.era; U.talarCelda(s, c); }
  s.lazos[`0-${B.id}`] = 45; s.cont.ciudades++; s.vc++;
  log(s, `Un grupo de familias deja ${C0.nombre} y funda ${nombre}.`, 'logro'); hito(s, `Fundación de ${nombre}`, 'ciudad');
  elegirLider(s, B, 'fundacion'); asignar(s, B); asignar(s, C0);
}
function sitioCiudad(s) {
  let mejor = null, mp = -1e9;
  for (const c of s.celdas) {
    if (c.u || c.o || ['a', 'v', 'c', 'm'].includes(c.t)) continue;
    const r = Math.hypot(c.x, c.z); if (r < 16 || r > 40) continue;
    if (s.ciudades.some((C) => dist(c.x, c.z, C.x, C.z) < (C.id === 0 ? U.radioCiudad(s, C, gentes(s, 0).length) + 6 : 18))) continue;
    if (s.celdas.some((x) => x.u && x.u !== 'campo' && dist(c.x, c.z, x.x, x.z) < 7)) continue;
    const p = -Math.abs(dist(c.x, c.z, s.lago.x, s.lago.z) - 14) * 0.5 + rnd(s) * 6;
    if (p > mp) { mp = p; mejor = c; }
  }
  return mejor;
}

// ---------------------------------------------------------------- megaproyecto y destino
function empezarMega(s, k) {
  const X = DESTINOS[k];
  s.mega = { k, n: X.mega, ap: {}, prog: 0, desde: anio(s), apoyo: 0 };
  log(s, `${X.i} La civilización elige su destino: empieza el megaproyecto «${X.mega}».`, 'logro'); hito(s, `${X.i} Megaproyecto: ${X.mega}`, 'destino');
  for (const a of s.gente) M.recordar(a, sello(s), `Empezó «${X.mega}»`, M.atractivo(a, X.w) > 0 ? 10 : -6);
  s.vc++;
}
function megaDia(s) {
  const Mg = s.mega; if (!Mg) return;
  const X = DESTINOS[Mg.k];
  for (const r of Object.keys(X.costo)) {
    if (r === 'ciencia' || r === 'fe') continue;
    if (r === 'cultura') { const q = Math.min(s.cultura * 0.05, X.costo[r] * 0.01); s.cultura -= q; Mg.ap[r] = (Mg.ap[r] || 0) + q; continue; }
    for (const C of vivas(s)) { const q = Math.min(C.res[r] * 0.08, X.costo[r] * 0.004); C.res[r] -= q; Mg.ap[r] = (Mg.ap[r] || 0) + q; }
  }
  const ad = s.gente.filter((a) => a.edad >= 16);
  Mg.apoyo = +(ad.filter((a) => M.atractivo(a, X.w) > 0).length / Math.max(1, ad.length)).toFixed(2);   // la gente que no cree en el proyecto lo frena
  Mg.prog = +Math.min(1, Math.min(...Object.entries(X.costo).map(([r, c]) => (Mg.ap[r] || 0) / c)) * (0.5 + Mg.apoyo)).toFixed(4);
  if (Mg.k === 'gaia' && s.ecologia < 65) Mg.prog = Math.min(Mg.prog, 0.9);
  if (Mg.prog >= 1) {
    s.destino = { tipo: Mg.k, dia: s.dia, anio: anio(s), era: s.era }; s.mega = null; s.decision = null; s.pausar = false;
    log(s, `${X.i} ${X.n}. ${X.d}`, 'logro'); hito(s, `${X.i} DESTINO: ${X.n}`, 'destino');
    s.vc++;
  }
}
// epílogo: dos años de animación final y luego la historia termina (o renace de las cenizas)
export const DUR_EPI = DIAS_ANIO * 2;
function epilogo(s) {
  const D = s.destino, k = (s.dia - D.dia) / DUR_EPI;
  D.fase = +Math.min(1, k).toFixed(3);
  if (D.tipo === 'estelar' || D.tipo === 'trascendencia') {
    D.pob0 ??= s.gente.length;
    const deben = Math.ceil(D.pob0 * (1 - D.fase)), sobran = s.gente.length - deben;
    for (const a of s.gente.slice(0, Math.max(0, sobran))) { s.gente = s.gente.filter((x) => x !== a); s.idos.unshift(registro(s, a, { causa: D.tipo === 'estelar' ? 'partió a las estrellas' : 'trascendió como luz', estado: D.tipo === 'estelar' ? 'partió' : 'trascendió' })); }
    if (s.idos.length > 80) s.idos.length = 80;
  }
  if (D.tipo === 'colmena') for (const a of s.gente) for (const t of Object.keys(a.op)) a.op[t] = +(a.op[t] * 0.95 + 0.05 * 0.6).toFixed(2);
  if (k >= 1 && !s.fin) {
    if (D.tipo === 'destruccion' && s.gente.length >= 4) return renacer(s);
    s.fin = true; finHistoria(s, D.tipo);
  }
}
function finHistoria(s, tipo) {
  const X = DESTINOS[tipo] || { n: 'Extinción', i: '🕯' };
  s.resumenFin = { tipo, n: X.n, i: X.i, anios: anio(s), era: s.era, maxPob: s.maxPob, hab: habitantes(s), ...s.cont, causa: s.destino?.causa };
  s.historia = [...(s.historia || []), { ciclo: s.ciclo, tipo, n: X.n, i: X.i, anios: anio(s), era: s.era, causa: s.destino?.causa, semilla: s.semilla }];
  log(s, `${X.i} Fin de la historia de esta civilización: ${X.n}${s.destino?.causa ? ` (${CAUSAS[s.destino.causa].n.toLowerCase()})` : ''}, tras ${anio(s)} años.`, 'logro');
  hito(s, `${X.i} Fin: ${X.n}`, 'destino');
}
// de las cenizas: los sobrevivientes vuelven a empezar, entre ruinas, con lo poco que recuerdan
function renacer(s) {
  const D = s.destino;
  s.historia = [...(s.historia || []), { ciclo: s.ciclo, tipo: 'destruccion', n: 'Destrucción', i: '💀', anios: anio(s), era: D.era, causa: D.causa, semilla: s.semilla }];
  s.ciclo++; s.destino = null; s.era = 0; s.eras.push({ era: 0, anio: anio(s), ciclo: s.ciclo });
  s.tec = Object.fromEntries(Object.keys(s.tec).filter((k) => TEC[k].era === 0 && prob(s, 0.6)).map((k) => [k, anio(s)])); s.inv = { c: null, f: null };
  s.gobierno = 'consejo'; s.leyes = {}; s.mega = null; s.guerra = null; s.epidemia = null; s.decision = null;
  for (const k of Object.keys(s.ejeBase)) s.ejeBase[k] = Math.round(s.ejeBase[k] * 0.3 - (k === 'aa' ? 15 : 0));   // el trauma deja una lección
  for (const a of s.gente) { a.oficio = 'comida'; a.edu = Math.min(a.edu, 10); a.riqueza = 3; M.recordar(a, sello(s), `Sobrevivió a ${CAUSAS[D.causa].n.toLowerCase()}`, -18, 'guerra', -0.3); }
  recalcMult(s);
  log(s, `🌱 De las cenizas: ${s.gente.length} sobrevivientes vuelven a empezar entre las ruinas. Comienza el ciclo ${s.ciclo}.`, 'era');
  hito(s, `🌱 Ciclo ${s.ciclo}: de las cenizas`, 'era');
  s.vc++;
}

// ---------------------------------------------------------------- poderes del espíritu del orbe
export function usarPoder(s, k, arg = null) {
  const P = PODERES[k]; if (!P) return 'Ese poder no existe.';
  if (s.esp.influencia < P.costo) return 'No te alcanza la influencia.';
  const creyentes = s.gente.filter((a) => a.v.fe > 0.5);
  switch (k) {
    case 'aconsejar': if (!s.decision || !arg) return 'No hay decisión pendiente.'; s.decision.consejo[arg] = (s.decision.consejo[arg] || 0) + 0.8; log(s, `El espíritu del orbe susurra a favor de «${s.decision.ops.find((o) => o.k === arg)?.n}».`, 'espiritu'); break;
    case 'forzar': if (!s.decision || !arg) return 'No hay decisión pendiente.'; s.decision.forzada = arg; break;
    case 'lluvia': s.clima.sequia = 0; s.clima.lluvia = 3; for (const C of vivas(s)) C.res.comida += gentes(s, C.id).length * 3; log(s, 'Llueve sobre los campos: el espíritu escuchó.', 'espiritu'); break;
    case 'bendicion': for (const a of s.gente) { a.salud = clamp(a.salud + 25); a.enf = 0; M.recordar(a, sello(s), 'Sintió la bendición del espíritu', 10, 'religion', 0.06); } log(s, 'Una luz tibia cubre el orbe.', 'espiritu'); break;
    case 'revelacion': for (const a of s.gente) M.recordar(a, sello(s), 'Vio la revelación del espíritu', a.v.fe > 0.4 ? 12 : 2, 'religion', a.p.ape > 0.7 ? 0.08 : 0.25); s.puntos.f += 200; log(s, 'Una visión recorre el orbe: miles dicen haber visto al espíritu.', 'espiritu'); break;
    case 'chispa': { const I = s.inv.c; if (I) I.p += TEC[I.k].costo * 0.35; const a = pick(s, s.gente.filter((x) => x.oficio === 'ciencia')) || pick(s, s.gente); if (a) inventar(s, a); log(s, 'Una chispa de genio ilumina a los sabios.', 'espiritu'); break; }
    case 'calma': for (const k2 of Object.keys(s.lazos)) s.lazos[k2] = Math.max(s.lazos[k2], 20); for (const Mv of s.movimientos) if (Mv.tipo === 'revolucion') Mv.fuerza *= 0.5; for (const a of s.gente) a.op.lider = Math.max(a.op.lider, -0.2); log(s, 'Una calma extraña apaga los odios.', 'espiritu'); break;
    case 'inspirar': { const a = vivo(s, arg); if (!a) return 'Elige primero a alguien.'; a.v.curiosidad = +clamp(a.v.curiosidad + 0.2, 0, 1).toFixed(2); a.edu += 15; inventar(s, a); M.recordar(a, sello(s), 'El espíritu le habló en sueños', 16, 'religion', 0.2); a.fama += 15; log(s, `${a.nombre} despierta con una idea que nadie había tenido.`, 'espiritu'); break; }
    case 'rayo': { const c = pick(s, s.celdas.filter((x) => x.u && !x.ru)); if (c) { c.ru = true; s.vc++; s.efecto = { k: 'rayo', x: c.x, z: c.z, t: s.t, r: 3 }; } for (const a of s.gente) M.recordar(a, sello(s), 'El cielo castigó la ciudad', -6, 'religion', a.v.fe > 0.5 ? 0.06 : -0.04); log(s, 'Un rayo cae sobre la ciudad y deja ruinas.', 'espiritu'); break; }
    case 'plaga': { const C = pick(s, vivas(s)); if (C) { s.epidemia = { al: C.id, hasta: s.dia + 20 }; log(s, `Una fiebre cae sobre ${C.nombre}.`, 'espiritu'); } break; }
    case 'cosecha': for (const C of vivas(s)) { C.res.comida += gentes(s, C.id).length * 10; C.hambre = 0; } log(s, 'Los campos dan el doble: graneros llenos en todo el orbe.', 'espiritu'); break;
    case 'fertilidad': { const madres = s.gente.filter((a) => a.sexo === 'f' && a.pareja && a.edad >= 18 && a.edad < 44); let n = 0; for (const m of madres) { if (s.gente.length >= MAX_PERSONAS || n >= 8) break; if (prob(s, 0.6)) { parto(s, m); n++; } } log(s, n ? `Una primavera de cunas: nacen ${n} niños bendecidos.` : 'El espíritu bendice a las familias, pero no hay quién espere un hijo.', 'espiritu'); break; }
    case 'bosque': U.reforestar(s, 30); for (const c of s.celdas) c.cont *= 0.5; s.contaminacion *= 0.5; s.vc++; log(s, 'El bosque renace: brotan árboles en las praderas y el aire se limpia.', 'espiritu'); break;
    case 'sequia': s.clima.sequia = 14; s.clima.lluvia = 0; log(s, 'El cielo se cierra: empieza una sequía.', 'espiritu'); break;
    case 'incendio': {
      const t0 = pick(s, s.arboles.filter((x) => x.c > 0.3)) || pick(s, s.celdas.filter((c) => c.u && !c.ru)); if (!t0) return 'No hay nada que arda.';
      let arb = 0, edif = 0; for (const x of s.arboles) if (x.c > 0 && Math.hypot(x.x - t0.x, x.z - t0.z) < 9) { x.c = -1; arb++; }
      for (const c of s.celdas) if (Math.hypot(c.x - t0.x, c.z - t0.z) < 7) { if (c.t === 'b') c.t = 'p'; if (c.u && !c.ru && prob(s, 0.5)) { c.ru = true; edif++; } }
      for (const a of [...s.gente]) { const c = U.mapa(s).get(a.hogar); if (c && Math.hypot(c.x - t0.x, c.z - t0.z) < 6 && prob(s, 0.12)) morir(s, a, 'el incendio'); }
      s.efecto = { k: 'incendio', x: t0.x, z: t0.z, t: s.t, r: 9 }; s.vc++;
      log(s, `Un incendio arrasa ${arb} árboles${edif ? ` y ${edif} edificios` : ''}.`, 'espiritu'); break;
    }
    case 'inundacion': {
      const L = s.lago; let n = 0;
      for (const c of s.celdas) { const d = Math.hypot(c.x - L.x, c.z - L.z); if (d < L.r + 9 && c.u && !c.ru && prob(s, 0.6)) { c.ru = true; if (c.u === 'campo') c.u = null; n++; } }
      for (const C of vivas(s)) C.res.comida *= 0.6;
      for (const a of [...s.gente]) { const c = U.mapa(s).get(a.hogar); if (c && Math.hypot(c.x - L.x, c.z - L.z) < L.r + 6 && prob(s, 0.08)) morir(s, a, 'la inundación'); }
      s.efecto = { k: 'inundacion', x: L.x, z: L.z, t: s.t, r: L.r + 9 }; s.vc++;
      log(s, `El lago se desborda: el agua se lleva ${n} construcciones de la orilla.`, 'espiritu'); break;
    }
    case 'terremoto': {
      const C = pick(s, vivas(s)); if (!C) return 'No hay ciudades.';
      let n = 0; for (const c of s.celdas) { const d = Math.hypot(c.x - C.x, c.z - C.z); if (c.u && !c.ru && c.u !== 'campo' && prob(s, Math.max(0.04, 0.5 - d / 60) * (c.n > 6 ? 1.4 : 1))) { c.ru = true; n++; } }
      for (const a of [...gentes(s, C.id)]) if (prob(s, 0.06)) morir(s, a, 'el terremoto');
      s.efecto = { k: 'terremoto', x: C.x, z: C.z, t: s.t, r: 30 }; s.vc++;
      log(s, `La tierra tiembla bajo ${C.nombre}: ${n} edificios caen.`, 'espiritu'); break;
    }
    case 'meteorito': {
      const hechas = s.celdas.filter((c) => c.u && !c.ru && Math.hypot(c.x, c.z) < 34), c0 = hechas.length && prob(s, 0.75) ? pick(s, hechas) : pick(s, s.celdas.filter((c) => c.t !== 'a' && Math.hypot(c.x, c.z) < 34)); if (!c0) return 'No hay dónde caer.';
      const R0 = 7, m = U.mapa(s); let n = 0;
      for (const c of s.celdas) { const d = Math.hypot(c.x - c0.x, c.z - c0.z); if (d > R0) continue; if (c.u || c.o) { c.ru = true; c.o = null; if (c.u === 'campo') c.u = null; n++; } if (c.t !== 'a' && c.t !== 'v') { c.t = 'r'; c.cr = +Math.max(c.cr || 0, 1 - (d / R0) * 0.6).toFixed(2); if (c.h > 0) c.h = +(c.h * 0.4).toFixed(2); } }   // tierra quemada (se borra con los años)
      for (const x of s.arboles) if (Math.hypot(x.x - c0.x, x.z - c0.z) < R0 + 2) x.c = -1;
      for (const a of [...s.gente]) { const c = m.get(a.hogar), w = m.get(a.trabajo); if ([c, w].some((z) => z && Math.hypot(z.x - c0.x, z.z - c0.z) < R0) && prob(s, 0.45)) morir(s, a, 'el meteorito'); }
      s.efecto = { k: 'meteorito', x: c0.x, z: c0.z, t: s.t, r: R0 }; s.vc++; s.vh = (s.vh || 0) + 1;
      log(s, `☄ Un meteorito cae del cielo: un cráter donde había ${n ? `${n} construcciones` : 'campo abierto'}.`, 'espiritu'); break;
    }
    case 'errantes': llegan(s, 3); if (s.fin && !s.destino) { s.fin = false; s.vacioDesde = null; } break;
  }
  s.esp.influencia -= P.costo;
  const ira = P.t === 'c';
  s.esp.fe = clamp(s.esp.fe + (ira ? 2 : 5));
  if (k !== 'aconsejar' && k !== 'forzar') for (const a of creyentes.filter((x) => vivo(s, x.id))) M.recordar(a, sello(s), ira ? 'Teme la ira del espíritu' : 'El espíritu nos escucha', ira ? -4 : 6, 'religion', 0.04);
  return null;
}

// ---------------------------------------------------------------- consultas para la interfaz
export const habitantes = (s) => Math.round(s.gente.length * ERAS[Math.min(8, s.era)].repr);
export function resumen(s, al = null) {
  const G = al == null ? s.gente : gentes(s, al), n = G.length || 1;
  const cl = { alta: 0, media: 0, baja: 0 }; for (const a of G) if (a.edad >= 16) cl[a.clase || 'media']++;
  return {
    pob: G.length, hab: Math.round(G.length * ERAS[Math.min(8, s.era)].repr), ninos: G.filter((a) => a.edad < 16).length, ancianos: G.filter((a) => a.edad >= 65).length,
    animo: Math.round(G.reduce((x, a) => x + a.animo, 0) / n), salud: Math.round(G.reduce((x, a) => x + a.salud, 0) / n), edu: Math.round(G.reduce((x, a) => x + a.edu, 0) / n),
    clases: cl, sinCasa: G.filter((a) => a.hogar == null && a.edad >= 3).length,
  };
}
export const oficioDe = M.oficioDe;
export function pensamiento(s, a) { return M.pensar(s, a, { voto: s.decision ? votoDe(s, a) : null }); }
export function relacionesDe(s, a, n = 8) { return Object.entries(a.rel || {}).map(([id, v]) => ({ p: persona(s, +id), v })).filter((x) => x.p).sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, n); }
export function parentesco(a, b) {
  if (a.pareja === b.id) return 'pareja';
  if (a.exPareja === b.id) return 'fue su pareja';
  if (a.padres.includes(b.id)) return b.sexo === 'f' ? 'madre' : 'padre';
  if (b.padres?.includes(a.id)) return b.sexo === 'f' ? 'hija' : 'hijo';
  if (a.padres.some((p) => b.padres?.includes(p))) return b.sexo === 'f' ? 'hermana' : 'hermano';
  return null;
}
// cuánto empujan los ejes (la historia y la cultura) hacia un destino (-1..1)
export function alineacion(s, k) { const E = s.ejes; return ({ estelar: E.cf + E.aa + E.ni * 0.4, trascendencia: -E.cf - E.aa * 0.6 - E.ic * 0.3, gaia: -E.ni - E.aa * 0.5, colmena: -E.ic * 1.2 + E.cf * 0.6 }[k] || 0) / 120; }
// hacia dónde «tira» la sociedad ahora mismo (para el medidor de destino)
export function destinoProbable(s) {
  const E = s.ejes, r = riesgosDe(s);
  const sc = { estelar: (E.cf + E.aa + E.ni * 0.5) / 2.5, trascendencia: (-E.cf - E.aa - E.ic * 0.3) / 2.3, gaia: (-E.ni - E.aa * 0.5 - E.ic * 0.3) / 1.8, colmena: (-E.ic + E.cf * 0.6) / 1.6, destruccion: (Math.max(0, ...Object.values(r)) - 30) / 1.2 };
  return Object.entries(sc).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v: Math.round(v) }));
}
export function guardar(s) {
  for (const a of s.gente) { a.edad = Math.round(a.edad * 1000) / 1000; a.edu = Math.round(a.edu * 10) / 10; a.salud = Math.round(a.salud); a.animo = Math.round(a.animo); a.riqueza = Math.round(a.riqueza * 10) / 10; for (const k of Object.keys(a.hab)) a.hab[k] = Math.round(a.hab[k] * 10) / 10; delete a._obj; }
  for (const t of s.arboles) t.c = Math.round(t.c * 100) / 100;
  return s;
}
export function cargar(o) { return o && o.mundo === 'aldea' && o.version === VERSION && Array.isArray(o.gente) ? o : null; }
