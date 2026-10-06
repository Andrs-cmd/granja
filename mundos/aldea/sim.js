// =====================================================================
// La aldea: simulación PURA (sin three ni DOM) de una pequeña sociedad que crece dentro del orbe.
//  - cada persona tiene necesidades, rasgos y habilidades que mejoran con la práctica
//  - cuando queda libre elige qué hacer con una IA de utilidad: sus necesidades, lo que su aldea
//    necesita (comida, madera, piedra, obras), lo que le gusta y lo que sabe hacer
//  - cada aldea tiene su despensa, su líder y su consejo, que decide qué construir
//  - cuando la aldea se llena, parejas jóvenes fundan ALDEAS HIJAS en otra zona del orbe; entre aldeas
//    hay visitas, bodas, trueque, ayuda en el hambre… y también rivalidad y disputas
//  - vida social: amistades, enemistades, parejas, hijos, vejez, muertes, herencias, líderes
//  - eventos con consecuencias en cadena: sequía → mala cosecha → hambre → racionamiento → gente que se va
// Todo el azar sale de `s.rng` (guardado en el estado): misma semilla, misma historia.
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';

export const VERSION = 2, PASO = 10, MIN_DIA = 1440, DIAS_EST = 6, DIAS_ANIO = 24, R_ORBE = 46;
export const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
const clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const TMP = new WeakMap();   // datos de paso que no se guardan (índices, conteos, sociales del día)

// ---------------------------------------------------------------- azar reproducible dentro del estado (mulberry32)
export function rnd(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (s, l) => l[Math.floor(rnd(s) * l.length)];
const ent = (s, a, b) => a + rnd(s) * (b - a);
const prob = (s, p) => rnd(s) < p;

// ---------------------------------------------------------------- tiempo: 24 días por año (4 estaciones de 6 días) para ver generaciones
export const diaAbs = (s) => Math.floor(s.t / MIN_DIA);
export const horaDe = (s) => (s.t % MIN_DIA) / 60;
export function fecha(s) { const d = diaAbs(s); return { anio: Math.floor(d / DIAS_ANIO) + 1, est: Math.floor((d % DIAS_ANIO) / DIAS_EST), dia: (d % DIAS_EST) + 1, hora: horaDe(s), d }; }
export function fechaTxt(s, conHora = true) { const f = fecha(s), h = f.hora; return `Año ${f.anio} · ${ESTACIONES[f.est]}, día ${f.dia}${conHora ? ` · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}` : ''}`; }
const sello = (s) => { const f = fecha(s); return `A${f.anio} ${ESTACIONES[f.est].slice(0, 3)}.${f.dia}`; };
const est = (s) => fecha(s).est;

// ---------------------------------------------------------------- catálogos
export const RASGOS = {
  fuerte: { n: 'Fuerte', d: 'Rinde más talando, picando piedra y construyendo.' },
  ingenioso: { n: 'Ingenioso', d: 'Aprende rápido y es buen artesano.' },
  sociable: { n: 'Sociable', d: 'Necesita gente; hace amigos con facilidad.' },
  solitario: { n: 'Solitario', d: 'Le basta poca compañía.' },
  trabajador: { n: 'Trabajador', d: 'Prefiere trabajar a descansar.' },
  perezoso: { n: 'Perezoso', d: 'Busca cualquier excusa para descansar.' },
  ambicioso: { n: 'Ambicioso', d: 'Quiere mandar; si no manda, se resiente (o se va a fundar su propia aldea).' },
  piadoso: { n: 'Piadoso', d: 'Reza y mantiene viva la fe en el espíritu del orbe.' },
  colerico: { n: 'Colérico', d: 'Se enoja fácil: discusiones y peleas.' },
  amable: { n: 'Amable', d: 'Cae bien a casi todo el mundo.' },
  fertil: { n: 'Fértil', d: 'Más probabilidad de tener hijos.' },
  curandero: { n: 'Curandero', d: 'Sabe de hierbas: sana mejor que nadie.' },
  gloton: { n: 'Glotón', d: 'Le da hambre más seguido.' },
  robusto: { n: 'Robusto', d: 'Se enferma poco y vive más.' },
  enfermizo: { n: 'Enfermizo', d: 'Se enferma más y se recupera lento.' },
  valiente: { n: 'Valiente', d: 'Buen cazador; da la cara cuando atacan.' },
  cobarde: { n: 'Cobarde', d: 'Huye del peligro.' },
  alegre: { n: 'Alegre', d: 'Ve el lado bueno de las cosas.' },
  melancolico: { n: 'Melancólico', d: 'Le cuesta estar contento.' },
  aventurero: { n: 'Aventurero', d: 'Un día puede irse a buscar otras tierras o fundar una aldea.' },
  cocinero: { n: 'Buen cocinero', d: 'Sus comidas rinden más y alegran.' },
  campesino: { n: 'Mano verde', d: 'Las plantas y los animales le crecen mejor.' },
};
const CHOQUES = [['sociable', 'solitario'], ['trabajador', 'perezoso'], ['alegre', 'melancolico'], ['robusto', 'enfermizo'], ['valiente', 'cobarde'], ['colerico', 'amable']];
const RASGO_HAB = { fuerte: { talar: 14, picar: 14, construir: 8 }, ingenioso: { artesania: 14, construir: 8 }, curandero: { sanar: 28 }, valiente: { cazar: 14 }, cocinero: { cocinar: 24 }, campesino: { cultivar: 22, criar: 12 }, sociable: { liderar: 8 }, ambicioso: { liderar: 12 } };
const RASGO_GUSTO = { fuerte: { talar: 0.3, picar: 0.3 }, ingenioso: { forjar: 0.4, construir: 0.2, carpinteria: 0.4 }, curandero: { sanar: 0.6 }, valiente: { cazar: 0.4 }, cocinero: { cocinar: 0.5 }, campesino: { cultivar: 0.5, pastorear: 0.3 }, cobarde: { cazar: -0.4 }, solitario: { pescar: 0.3, pastorear: 0.2 } };
export const HABS = { recolectar: 'Recolectar', cazar: 'Cazar', pescar: 'Pescar', cultivar: 'Cultivar', criar: 'Criar animales', talar: 'Talar', picar: 'Picar piedra', construir: 'Construir', cocinar: 'Cocinar', sanar: 'Sanar', artesania: 'Artesanía', liderar: 'Liderar' };

// edificios: costo, trabajo (horas-persona) y radio que ocupan
export const TIPOS = {
  fogata: { n: 'Fogata', madera: 0, piedra: 0, trabajo: 1, radio: 2.4 },
  choza: { n: 'Choza', madera: 14, piedra: 0, trabajo: 10, radio: 2.4, camas: 3 },
  casa: { n: 'Casa', madera: 30, piedra: 18, trabajo: 26, radio: 3, camas: 5 },
  campo: { n: 'Campo de cultivo', madera: 4, piedra: 0, trabajo: 5, radio: 3.3 },
  corral: { n: 'Corral', madera: 30, piedra: 0, trabajo: 14, radio: 3.4 },
  granero: { n: 'Granero', madera: 40, piedra: 10, trabajo: 26, radio: 3.3 },
  pozo: { n: 'Pozo', madera: 6, piedra: 24, trabajo: 16, radio: 1.6 },
  muelle: { n: 'Muelle y botes', madera: 50, piedra: 0, trabajo: 20, radio: 2.2 },
  aserradero: { n: 'Aserradero', madera: 40, piedra: 14, trabajo: 26, radio: 3.1 },
  herreria: { n: 'Herrería', madera: 30, piedra: 45, trabajo: 34, radio: 3 },
  enfermeria: { n: 'Casa de sanación', madera: 36, piedra: 30, trabajo: 30, radio: 3 },
  templo: { n: 'Templo', madera: 45, piedra: 90, trabajo: 70, radio: 3.6 },
  plaza: { n: 'Plaza de mercado', madera: 40, piedra: 60, trabajo: 44, radio: 4.2 },
  muralla: { n: 'Empalizada', madera: 140, piedra: 20, trabajo: 90, radio: 0 },
  monumento: { n: 'Monumento', madera: 10, piedra: 80, trabajo: 40, radio: 1.8 },
};
const FEM = ['casa', 'choza', 'herreria', 'enfermeria', 'plaza', 'muralla'];   // para concordar el artículo
export const elTipo = (t) => `${FEM.includes(t) ? 'la' : 'el'} ${TIPOS[t].n.toLowerCase()}`;
// trabajos: la habilidad que usan y cuántas horas dura un turno
const TRAB = {
  recolectar: { hab: 'recolectar', txt: 'Recolecta bayas', h: 3 },
  cazar: { hab: 'cazar', txt: 'Caza en el bosque', h: 4 },
  pescar: { hab: 'pescar', txt: 'Pesca en el lago', h: 3 },
  cultivar: { hab: 'cultivar', txt: 'Trabaja el campo', h: 3 },
  pastorear: { hab: 'criar', txt: 'Cuida los animales', h: 3 },
  talar: { hab: 'talar', txt: 'Tala un árbol', h: 3 },
  picar: { hab: 'picar', txt: 'Pica piedra', h: 3 },
  construir: { hab: 'construir', txt: 'Construye', h: 3 },
  cocinar: { hab: 'cocinar', txt: 'Cocina para la aldea', h: 2 },
  forjar: { hab: 'artesania', txt: 'Hace herramientas', h: 3 },
  carpinteria: { hab: 'artesania', txt: 'Hace muebles para una casa', h: 3 },
  sanar: { hab: 'sanar', txt: 'Cuida a un enfermo', h: 2 },
};
export const ACCIONES = {
  comer: 'Come', dormir: 'Duerme', socializar: 'Conversa', rezar: 'Reza en el templo', descansar: 'Descansa', jugar: 'Juega', visitar: 'Visita otra aldea',
  fiesta: 'Celebra la fiesta', convalecer: 'Guarda reposo', apagar: '¡Apaga el incendio!', defender: 'Defiende la aldea', pasear: 'Pasea', bebe: 'Es un bebé',
  ...Object.fromEntries(Object.entries(TRAB).map(([k, v]) => [k, v.txt])),
};
export const ANIM = { comer: 'sentado', dormir: 'sentado', socializar: 'quieto', visitar: 'quieto', rezar: 'sentado', descansar: 'sentado', jugar: 'corre', fiesta: 'baila', convalecer: 'sentado', apagar: 'trabaja', defender: 'golpe', pasear: 'quieto', bebe: 'quieto', recolectar: 'trabaja', cazar: 'quieto', pescar: 'sentado', cultivar: 'trabaja', pastorear: 'quieto', talar: 'golpe', picar: 'golpe', construir: 'trabaja', cocinar: 'trabaja', forjar: 'golpe', carpinteria: 'golpe', sanar: 'trabaja' };

const NOM_M = ['Tomás', 'Mateo', 'Joaquín', 'Elías', 'Simón', 'Gabriel', 'Andrés', 'Lucas', 'Martín', 'Julián', 'Esteban', 'Ramiro', 'Bruno', 'Iván', 'Félix', 'Gonzalo', 'Hernán', 'Ismael', 'Lorenzo', 'Nicolás', 'Pablo', 'Rodrigo', 'Samuel', 'Vicente', 'Emilio', 'Fabián', 'Germán', 'Hugo', 'Ciro', 'Dante', 'Abel', 'Benjamín', 'Camilo', 'Damián', 'Eusebio', 'Facundo', 'Jacinto', 'León', 'Marcos', 'Octavio', 'Rafael', 'Salvador', 'Tadeo', 'Ulises', 'Aurelio', 'Baltasar', 'Cristóbal', 'Darío', 'Evaristo', 'Fermín'];
const NOM_F = ['Lucía', 'Elena', 'Inés', 'Rosa', 'Marta', 'Clara', 'Ana', 'Sara', 'Julia', 'Irene', 'Laura', 'Olga', 'Paula', 'Valeria', 'Carmen', 'Alba', 'Teresa', 'Nora', 'Lía', 'Adela', 'Beatriz', 'Celia', 'Dora', 'Eva', 'Flor', 'Gloria', 'Helena', 'Isabel', 'Jimena', 'Luz', 'Mila', 'Noemí', 'Pilar', 'Raquel', 'Sofía', 'Violeta', 'Amparo', 'Blanca', 'Candela', 'Delia', 'Estela', 'Fátima', 'Graciela', 'Matilde', 'Otilia', 'Remedios', 'Salomé', 'Tránsito', 'Úrsula', 'Ximena'];
const APELLIDOS = ['del Río', 'Montes', 'Arango', 'Salazar', 'Cárdenas', 'Restrepo', 'Ortiz', 'Vargas', 'Peña', 'Quintero', 'Rojas', 'Mejía', 'Duque', 'Toro', 'Henao', 'Zuluaga', 'Ospina', 'Giraldo', 'Valencia', 'Londoño', 'Cuervo', 'Pardo', 'Serna', 'Aguirre', 'Bermúdez'];
const NOMBRES_AL = { madre: ['Valle Hondo', 'Buenavista', 'El Claro', 'Santa Rita', 'Río Manso', 'La Esperanza'], lago: ['El Remanso', 'Las Garzas', 'Aguas Claras', 'La Orilla'], bosque: ['Los Robles', 'El Pinar', 'La Espesura', 'Monte Oscuro'], piedra: ['La Pedrera', 'Piedra Alta', 'Las Lajas', 'El Peñón'] };
const PIEL = [0xf1c9a5, 0xe0ac7e, 0xc68c5c, 0xa8714a, 0x8a5a3b, 0x6b4430];
const PELO = [0x2a1c12, 0x3a2a1e, 0x5a3a22, 0x8a5a2a, 0xc9a05a, 0x1a1a1a, 0x7a3a1a];
const ROPA = [0x8a5a3a, 0x6a7a4a, 0x4a5a7a, 0x9a6a4a, 0x7a4a5a, 0xa08a5a, 0x5a6a5a, 0x8a3a2a, 0x6a4a8a, 0x3a6a6a];
const PANT = [0x3a3028, 0x2e3440, 0x4a3a2a, 0x2a2a2a, 0x46402e];

// ---------------------------------------------------------------- diario, hitos, recuerdos
export function log(s, texto, tipo = 'info') { s.diario.unshift({ texto, tipo, d: sello(s) }); if (s.diario.length > 160) s.diario.length = 160; }
function hito(s, texto) { s.hitos.unshift({ texto, d: sello(s) }); if (s.hitos.length > 120) s.hitos.length = 120; }
function vida(a, s, texto) { a.vida.unshift({ texto, d: sello(s) }); if (a.vida.length > 14) a.vida.length = 14; }
// recuerdo con fecha de vencimiento: suma o resta al ánimo mientras dure (la misma clave lo reemplaza)
function recuerdo(s, a, k, txt, v, dias) { a.mem = a.mem.filter((m) => m.k !== k); a.mem.push({ k, txt, v, hasta: s.t + dias * MIN_DIA }); if (a.mem.length > 8) a.mem.sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).length = 8; }
const tiene = (a, r) => a.rasgos.includes(r);
const g = (a, m, f) => (a.sexo === 'f' ? f : m);
export const nombreDe = (a) => (a ? `${a.nombre} ${a.apellido}` : '—');
// las amistades y enemistades del día se agrupan en una sola línea del diario (si no, lo inundan)
function social(s, tipo, a, b) { let t = TMP.get(s); if (!t) { idx(s); t = TMP.get(s); } (t.soc ||= { amig: [], enem: [], pelea: [] })[tipo].push(`${a.nombre} y ${b.nombre}`); }
function volcarSocial(s) {
  const t = TMP.get(s); if (!t?.soc) return;
  const lista = (l) => (l.length <= 2 ? l.join(', ') : `${l.slice(0, 2).join(', ')} y ${l.length - 2} pareja${l.length > 3 ? 's' : ''} más`);
  if (t.soc.amig.length) log(s, `Nuevas amistades: ${lista(t.soc.amig)}.`, 'bueno');
  if (t.soc.enem.length) log(s, `Se enemistan: ${lista(t.soc.enem)}.`, 'malo');
  if (t.soc.pelea?.length) log(s, `${t.soc.pelea.length > 1 ? 'Peleas' : 'Pelea'} a golpes: ${lista(t.soc.pelea)}.`, 'malo');
  t.soc = { amig: [], enem: [], pelea: [] };
}

// ---------------------------------------------------------------- relaciones (afinidad -100..100, clave "a-b" con a<b)
const rk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const af = (s, a, b) => s.rel[rk(a, b)] || 0;
function cambiarAf(s, a, b, d) { const k = rk(a, b), v = clamp((s.rel[k] || 0) + d, -100, 100); if (Math.abs(v) < 0.5) delete s.rel[k]; else s.rel[k] = Math.round(v * 10) / 10; return v; }
function idx(s) { let t = TMP.get(s); if (!t || t.v !== s.gente) { t = { ...(t || {}), v: s.gente, m: new Map(s.gente.map((a) => [a.id, a])), paT: -1 }; TMP.set(s, t); } return t.m; }
export const vivo = (s, id) => idx(s).get(id) || null;
export const persona = (s, id) => vivo(s, id) || s.difuntos.find((d) => d.id === id) || s.idos.find((d) => d.id === id) || null;
const familia = (a, b) => a.padres.includes(b.id) || b.padres.includes(a.id) || a.padres.some((p) => b.padres.includes(p));
// lazos entre aldeas (-100..100)
export const lazo = (s, a, b) => s.lazos[rk(a, b)] ?? 0;
function cambiarLazo(s, a, b, d) { if (a === b) return; s.lazos[rk(a, b)] = Math.round(clamp(lazo(s, a, b) + d, -100, 100) * 10) / 10; }

// ---------------------------------------------------------------- aldeas
// gente de una aldea (con caché por paso: se llama muchísimo)
export function gentes(s, al) { const t = TMP.get(s); if (t?.pa && t.paT === s.t && t.v === s.gente) return t.pa[al] || []; return s.gente.filter((a) => a.al === al); }
function cachear(s) { idx(s); const t = TMP.get(s), pa = {}; for (const a of s.gente) (pa[a.al] ||= []).push(a); t.pa = pa; t.paT = s.t; }
export const aldeaDe = (s, a) => s.aldeas[a.al];
export const vivas = (s) => s.aldeas.filter((A) => !A.vacia);
function nuevaAldea(s, nombre, x, z, madre = null) {
  const A = { id: s.aldeas.length, nombre, x: +x.toFixed(2), z: +z.toFixed(2), madre, fundada: diaAbs(s), res: { alimentos: 0, comidas: 0, madera: 0, piedra: 0, herramientas: 0 },
    meta: null, lider: null, mandato: 0, resMin: 10, racion: false, podrido: 0, sinLena: false, sinSitio: 0, animales: 0, ataques: 0, vacia: false };
  s.aldeas.push(A);
  return A;
}
// radio en el que una aldea puede construir: crece con su gente; la empalizada y la plaza lo amplían
export function radioAldea(s, A) {
  const n = gentes(s, A.id).length, extra = (hay(s, 'muralla', A.id) ? 3 : 0) + (hay(s, 'plaza', A.id) ? 3 : 0);
  return A.id === 0 ? 22 + extra : Math.min(18, 9 + n * 0.45) + extra * 0.7;   // la madre no se come todo el orbe: deja sitio a las hijas
}

// ---------------------------------------------------------------- mundo nuevo
export function crearAldea(semilla = Date.now()) {
  const sem = semilla >>> 0;
  const s = {
    mundo: 'aldea', version: VERSION, semilla: sem, rng: sem ^ 0x5bd1e995, t: 6 * 60, resto: 0, sigId: 1, sigEd: 1,
    gente: [], difuntos: [], idos: [], rel: {}, lazos: {}, aldeas: [], edificios: [], arboles: [], rocas: [], arbustos: [], tumbas: [],
    fauna: 80, peces: 90, clima: { lluvia: 0, sequia: 0, nieve: 0, duro: false }, fiesta: null, amenaza: null,
    esp: { fe: 30, influencia: 3 }, epidemia: 0, refundaciones: 0, fin: false, maxPob: 0,
    cont: { nacimientos: 0, muertes: 0, llegadas: 0, partidas: 0, parejas: 0, lideres: 0, aldeas: 1 },
    diario: [], hitos: [], hist: { pob: [], comida: [], animo: [], casas: [], al: { 0: [] }, paso: 2 }, extinta: false,
  };
  crearMapa(s, sem);
  const A = nuevaAldea(s, pick(s, NOMBRES_AL.madre), 0, 0);
  Object.assign(A.res, { alimentos: 70, comidas: 12, madera: 24, piedra: 0, herramientas: 6 });
  nuevoEdificio(s, 'fogata', 0, 0, true, 0);
  // colonos: dos parejas (una con un hijo), dos solteros y alguien mayor; varía con la semilla
  const ap = () => { const l = APELLIDOS.filter((x) => !s.gente.some((a) => a.apellido === x)); return pick(s, l); };
  const p1 = ap(), p2 = ap();
  const m1 = nuevaPersona(s, { sexo: 'm', edad: ent(s, 22, 36), apellido: p1 }), f1 = nuevaPersona(s, { sexo: 'f', edad: ent(s, 20, 34), apellido: p1 });
  const m2 = nuevaPersona(s, { sexo: 'm', edad: ent(s, 20, 40), apellido: p2 }), f2 = nuevaPersona(s, { sexo: 'f', edad: ent(s, 19, 36), apellido: p2 });
  emparejar(s, m1, f1, true); emparejar(s, m2, f2, true);
  if (prob(s, 0.7)) { const h = nuevaPersona(s, { edad: ent(s, 4, 11), apellido: p1, padres: [m1.id, f1.id] }); m1.hijos.push(h.id); f1.hijos.push(h.id); }
  nuevaPersona(s, { edad: ent(s, 18, 30), apellido: ap() });
  if (prob(s, 0.6)) nuevaPersona(s, { edad: ent(s, 50, 61), apellido: ap() }); else nuevaPersona(s, { edad: ent(s, 18, 30), apellido: ap() });
  for (const a of s.gente) for (const b of s.gente) if (a.id < b.id && !s.rel[rk(a.id, b.id)]) cambiarAf(s, a.id, b.id, familia(a, b) ? 70 : ent(s, -8, 26));
  for (const a of s.gente) { const ang = rnd(s) * 6.28; a.x = a.px = Math.cos(ang) * 4; a.z = a.pz = Math.sin(ang) * 4; }
  log(s, `${s.gente.length} colonos llegan a un claro junto al lago y encienden una fogata. Así nace ${A.nombre}.`, 'logro');
  hito(s, `Fundación de ${A.nombre}`);
  elegirLider(s, A, 'fundacion');
  asignarHogares(s); consejo(s, A);
  return s;
}

function crearMapa(s, sem) {
  const r = azar(sem ^ 0x9e3779b9), ru = ruido2D(sem & 0xffff);
  const aL = r() * Math.PI * 2;
  s.lago = { x: +(Math.cos(aL) * 30).toFixed(2), z: +(Math.sin(aL) * 30).toFixed(2), r: 8 };
  s.rio = []; for (let i = 0; i <= 7; i++) { const k = i / 7, rr = 36 + k * 9.5, a = aL + Math.sin(k * 4 + sem % 7) * 0.13; s.rio.push([+(Math.cos(a) * rr).toFixed(2), +(Math.sin(a) * rr).toFixed(2)]); }
  const aS = aL + Math.PI * (0.62 + r() * 0.4), aC = aL - Math.PI * (0.5 + r() * 0.15);
  s.cementerio = { x: +(Math.cos(aC) * 35).toFixed(2), z: +(Math.sin(aC) * 35).toFixed(2), ang: aC };
  for (let i = 0; i < 11; i++) { const a = aS + (r() - 0.5) * 0.9, rr = 30 + r() * 10; s.rocas.push({ x: +(Math.cos(a) * rr).toFixed(2), z: +(Math.sin(a) * rr).toFixed(2), q: 40 + Math.floor(r() * 30), t: r() }); }
  const libre = (x, z, m) => dist(x, z, s.lago.x, s.lago.z) > s.lago.r + m && dist(x, z, s.cementerio.x, s.cementerio.z) > 6.5 && s.rocas.every((o) => dist(x, z, o.x, o.z) > 2.8) && s.rio.every(([px, pz]) => dist(x, z, px, pz) > 2.6);
  for (let x = -44; x <= 44; x += 3.1) for (let z = -44; z <= 44; z += 3.1) {
    const px = x + (r() - 0.5) * 2.4, pz = z + (r() - 0.5) * 2.4, rr = Math.hypot(px, pz);
    if (rr > 43 || rr < 17) continue;
    if (ru(px / 9 + 3, pz / 9 + 7) < 0.62 - (rr - 17) / 40 || !libre(px, pz, 2)) continue;
    s.arboles.push({ x: +px.toFixed(2), z: +pz.toFixed(2), c: +(0.7 + r() * 0.3).toFixed(2), v: r() < 0.55 ? 0 : 1, o: 0 });
  }
  for (let i = 0, n = 0; i < 200 && n < 16; i++) { const a = r() * 6.28, rr = 15 + r() * 12, x = Math.cos(a) * rr, z = Math.sin(a) * rr; if (libre(x, z, 3) && s.arbustos.every((b) => dist(x, z, b.x, b.z) > 3)) { s.arbustos.push({ x: +x.toFixed(2), z: +z.toFixed(2), b: 6 }); n++; } }
}

function rasgosAzar(s, n, base = []) {
  const r = [...base];
  for (let i = 0; i < 40 && r.length < n; i++) { const k = pick(s, Object.keys(RASGOS)); if (r.includes(k) || CHOQUES.some(([x, y]) => (k === x && r.includes(y)) || (k === y && r.includes(x)))) continue; r.push(k); }
  return r;
}
function nombreLibre(s, sexo) { const usados = new Set(s.gente.map((a) => a.nombre)), l = (sexo === 'f' ? NOM_F : NOM_M).filter((n) => !usados.has(n)); return pick(s, l.length ? l : sexo === 'f' ? NOM_F : NOM_M); }

// o: { sexo, edad, apellido, padres, rasgos, x, z, al }
function nuevaPersona(s, o = {}) {
  const sexo = o.sexo || (rnd(s) < 0.5 ? 'f' : 'm'), padres = (o.padres || []).map((id) => persona(s, id)).filter(Boolean);
  let base = [];
  for (const p of padres) for (const k of p.rasgos) if (prob(s, 0.35)) base.push(k);
  base = rasgosAzar(s, Math.min(3, base.length), [...new Set(base)].slice(0, 2));
  const rasgos = o.rasgos || rasgosAzar(s, prob(s, 0.45) ? 3 : 2, base);
  const edad = o.edad ?? 0, adulto = Math.max(0, Math.min(edad - 14, 30));
  const hab = {}, gusto = {};
  for (const k of Object.keys(HABS)) hab[k] = edad < 14 ? 0 : Math.round(clamp(3 + rnd(s) * 18 + adulto * 0.5 * rnd(s)));
  for (const r of rasgos) for (const [k, v] of Object.entries(RASGO_HAB[r] || {})) if (edad >= 14) hab[k] = clamp(hab[k] + v);
  for (const k of Object.keys(TRAB)) gusto[k] = +(0.7 + rnd(s) * 0.6).toFixed(2);
  for (const r of rasgos) for (const [k, v] of Object.entries(RASGO_GUSTO[r] || {})) gusto[k] = +clamp(gusto[k] + v, 0.2, 2).toFixed(2);
  const pm = padres.find((p) => p.sexo === 'f'), pp = padres.find((p) => p.sexo === 'm');
  const ap = { piel: pm && pp ? pick(s, [pm.ap.piel, pp.ap.piel]) : pick(s, PIEL), pelo: padres.length ? pick(s, padres).ap.pelo : pick(s, PELO), ropa: pick(s, ROPA), pantalon: pick(s, PANT),
    peinado: sexo === 'f' ? (prob(s, 0.85) ? 'largo' : 'corto') : prob(s, 0.12) ? 'calvo' : 'corto', alto: +(sexo === 'f' ? ent(s, 0.9, 0.99) : ent(s, 0.97, 1.08)).toFixed(3), ancho: +ent(s, 0.92, 1.12).toFixed(2) };
  const a = {
    id: s.sigId++, nombre: nombreLibre(s, sexo), apellido: o.apellido || pick(s, APELLIDOS), sexo, edad: +edad.toFixed(3), rasgos, hab, gusto, al: o.al ?? 0,
    nec: { saciedad: 80, energia: 85, social: 60, animo: 62, salud: 100 }, x: o.x ?? 0, z: o.z ?? 0, px: o.x ?? 0, pz: o.z ?? 0, ruta: [], acc: null, dentro: false,
    hogar: null, pareja: null, padres: padres.map((p) => p.id), hijos: [], mem: [], vida: [], bienes: 0, enf: 0, emb: 0, triste: 0, horas: {}, ap, llego: diaAbs(s),
  };
  s.gente = [...s.gente, a];   // array nuevo: así el índice por id se rehace
  return a;
}
function emparejar(s, a, b, inicial = false) {
  a.pareja = b.id; b.pareja = a.id; cambiarAf(s, a.id, b.id, inicial ? 75 : 20);
  if (inicial) return;
  s.cont.parejas++;
  // boda entre aldeas: se muda quien venga de la aldea más llena
  if (a.al !== b.al) {
    const [va, de] = gentes(s, a.al).length >= gentes(s, b.al).length ? [a, b] : [b, a];
    const desde = va.al; mudar(s, va, de.al);
    log(s, `Boda entre aldeas: ${va.nombre} deja ${s.aldeas[desde].nombre} para vivir con ${de.nombre} en ${s.aldeas[de.al].nombre}.`, 'bueno');
    cambiarLazo(s, desde, de.al, 10);   // las bodas unen a las aldeas
  } else log(s, `${a.nombre} y ${b.nombre} se unen en pareja. Hay baile alrededor de la fogata.`, 'bueno');
  vida(a, s, `Se unió con ${b.nombre}`); vida(b, s, `Se unió con ${a.nombre}`);
  for (const x of [a, b]) recuerdo(s, x, 'boda', 'Recién unid' + g(x, 'o', 'a'), 18, 8);
  s.fiesta = { hasta: s.t + 8 * 60, motivo: `la unión de ${a.nombre} y ${b.nombre}`, al: a.al };
}
// cambiar de aldea (con los hijos chicos)
function mudar(s, a, al) {
  const ix = idx(s), van = [a, ...a.hijos.map((id) => ix.get(id)).filter((h) => h && h.edad < 15 && h.al === a.al)];
  for (const x of van) { x.al = al; x.hogar = null; x._h = null; if (x.acc) terminar(s, x, true); }
  const t = TMP.get(s); if (t) t.paT = -1;
}

// ---------------------------------------------------------------- edificios
function nuevoEdificio(s, tipo, x, z, hecho = false, al = 0) {
  const A = s.aldeas[al];
  const b = { id: s.sigEd++, tipo, al, x: +x.toFixed(2), z: +z.toFixed(2), rot: +Math.atan2(A.x - x, A.z - z).toFixed(3), p: hecho ? 1 : 0, hecho, fuego: 0, dano: 0, desde: diaAbs(s) };
  if (tipo === 'campo') b.campo = { e: 'barbecho', c: 0, k: 0, r: 0 };
  if (tipo === 'casa') { b.nivel = 0; b.mej = 0; }
  if (tipo === 'muralla') { b.radio = x; b.x = A.x; b.z = A.z; b.rot = 0; }   // en la empalizada, `x` es el radio del anillo
  if (tipo === 'muelle') b.rot = +Math.atan2(s.lago.x - x, s.lago.z - z).toFixed(3);   // mira al agua
  s.edificios.push(b);
  return b;
}
const hechos = (s, tipo, al) => s.edificios.filter((b) => b.hecho && (!tipo || b.tipo === tipo) && (al == null || b.al === al));
const hay = (s, tipo, al) => s.edificios.some((b) => b.hecho && b.tipo === tipo && (al == null || b.al === al));
const fogata = (s, al = 0) => s.edificios.find((b) => b.tipo === 'fogata' && b.al === al) || s.edificios.find((b) => b.tipo === 'fogata');
export const edificio = (s, id) => s.edificios.find((b) => b.id === id) || null;

// ¿se puede construir aquí? (todas las aldeas comparten el suelo)
function sitioLibre(s, x, z, R, al) {
  const L = s.lago;
  if (Math.hypot(x, z) + R > 43.5) return false;
  if (dist(x, z, L.x, L.z) < L.r + R + 1.2) return false;
  if (dist(x, z, s.cementerio.x, s.cementerio.z) < R + 6) return false;
  if (s.rio.some(([px, pz]) => dist(x, z, px, pz) < R + 1.5)) return false;
  if (s.rocas.some((o) => o.q > 0 && dist(x, z, o.x, o.z) < R + 1.6)) return false;
  if (s.edificios.some((b) => b.tipo !== 'muralla' && dist(x, z, b.x, b.z) < R + TIPOS[b.tipo].radio + 1.1)) return false;
  if (s.edificios.some((b) => b.tipo === 'muralla' && Math.abs(dist(x, z, b.x, b.z) - b.radio) < R + 1)) return false;
  if (s.aldeas.some((A) => A.id !== al && dist(x, z, A.x, A.z) < R + 7)) return false;
  if (s.arbustos.some((b) => dist(x, z, b.x, b.z) < R + 0.8)) return false;
  return true;
}
// busca un sitio libre cerca del centro de la aldea (los campos prefieren la orilla del lago si queda cerca)
function buscarSitio(s, tipo, A) {
  const R = TIPOS[tipo].radio, L = s.lago, rad = radioAldea(s, A);
  if (tipo === 'muelle') {
    const a0 = Math.atan2(A.z - L.z, A.x - L.x);
    for (let i = 0; i < 40; i++) { const a = a0 + (rnd(s) - 0.5) * 1.6, x = L.x + Math.cos(a) * (L.r + 0.4), z = L.z + Math.sin(a) * (L.r + 0.4); if (!s.edificios.some((b) => dist(x, z, b.x, b.z) < 4 + TIPOS[b.tipo].radio) && !s.rio.some(([px, pz]) => dist(x, z, px, pz) < 4)) return { x, z }; }
    return null;
  }
  const lagoCerca = dist(A.x, A.z, L.x, L.z) < rad + L.r + 6;
  for (let i = 0; i < 400; i++) {
    let x, z;
    if (tipo === 'campo' && lagoCerca && i < 220) { const a = Math.atan2(A.z - L.z, A.x - L.x) + (rnd(s) - 0.5) * 2.6, rr = L.r + R + 1.5 + rnd(s) * (6 + i / 25); x = L.x + Math.cos(a) * rr; z = L.z + Math.sin(a) * rr; }
    else { const a = rnd(s) * Math.PI * 2, rr = R + 4 + rnd(s) * Math.min(rad, 6 + i / 12); x = A.x + Math.cos(a) * rr; z = A.z + Math.sin(a) * rr; }
    if (dist(x, z, A.x, A.z) + R > rad + 3) continue;
    if (sitioLibre(s, x, z, R, A.id)) return { x, z };
  }
  return null;
}
function despejar(s, x, z, r) { let n = 0; for (const t of s.arboles) if (t.c >= 0 && dist(x, z, t.x, t.z) < r) { if (t.c > 0.5) n++; t.c = -1; } return n * 3; }

// ---------------------------------------------------------------- vivienda: familias juntas, los recién casados buscan techo propio
function raiz(s, a, prof = 0) {
  const ix = idx(s);
  if (prof < 4 && (a.edad < 16 || (!a.pareja && a.edad < 21))) { const pa = a.padres.map((id) => ix.get(id)).filter((p) => p && p.al === a.al).sort((x, y) => (x.sexo === 'f' ? -1 : 1) - (y.sexo === 'f' ? -1 : 1))[0]; if (pa) return raiz(s, pa, prof + 1); }
  if (a.pareja && ix.get(a.pareja)) return Math.min(a.id, a.pareja);
  return a.id;
}
function asignarHogares(s) {
  const casas = hechos(s).filter((b) => TIPOS[b.tipo].camas && !b.fuego), libre = new Map(casas.map((b) => [b.id, camasDe(b)]));
  const fams = new Map();
  for (const a of s.gente) { const k = `${a.al}:${raiz(s, a)}`; if (!fams.has(k)) fams.set(k, []); fams.get(k).push(a); }
  const lista = [...fams.values()].sort((x, y) => y.length - x.length);
  for (const f of lista) for (const a of f) a.hogar = null;
  for (const f of lista) {
    const al = f[0].al, mias = casas.filter((b) => b.al === al);
    // la casa donde ya vivía la mayoría
    const cuenta = {}; for (const a of f) if (a._h) cuenta[a._h] = (cuenta[a._h] || 0) + 1;
    const pref = Object.keys(cuenta).map(Number).sort((x, y) => cuenta[y] - cuenta[x]).find((id) => (libre.get(id) || 0) >= f.length && mias.some((b) => b.id === id));
    const casa = pref ?? mias.filter((b) => libre.get(b.id) >= f.length).sort((x, y) => libre.get(y.id) - libre.get(x.id))[0]?.id;
    for (const a of [...f].sort((x, y) => y.edad - x.edad)) {
      const c = casa != null && libre.get(casa) > 0 ? casa : mias.find((b) => libre.get(b.id) > 0)?.id;
      if (c == null) break;
      a.hogar = c; libre.set(c, libre.get(c) - 1);
    }
  }
  for (const a of s.gente) a._h = a.hogar;
}
const camasDe = (b) => (TIPOS[b.tipo].camas || 0) + (b.nivel >= 2 ? 1 : 0);   // con muebles cabe uno más
export function camas(s, al) { return hechos(s, null, al).filter((b) => !b.fuego).reduce((n, b) => n + camasDe(b), 0); }

// ---------------------------------------------------------------- consejo: qué construir (el líder pesa en las prioridades)
function deseos(s, A) {
  const G = gentes(s, A.id), pob = G.length, L = vivo(s, A.lider), lr = (r) => (L && tiene(L, r) ? 1 : 0), R = A.res, al = A.id;
  const sinTecho = G.filter((a) => a.hogar == null).length, libres = camas(s, al) - pob, res = reserva(s, A);
  const n = (t) => s.edificios.filter((b) => b.tipo === t && b.al === al).length, d = [];
  const casaOk = pob >= 10 || (pob >= 7 && R.piedra >= 18) || (al > 0 && R.piedra >= 18);
  if (libres < 2 || sinTecho) d.push({ tipo: casaOk ? 'casa' : 'choza', peso: 90 + sinTecho * 12, motivo: sinTecho ? `${sinTecho} duermen a la intemperie` : 'hacen falta camas' });
  const chozas = hechos(s, 'choza', al);
  if (chozas.length && pob >= 10 && res > 8 && libres >= 0) d.push({ tipo: 'casa', peso: 26, motivo: 'cambiar una choza por una casa de verdad', reemplaza: chozas[0].id });
  if (n('campo') < Math.ceil(pob / 2.2) && est(s) < 2 && pob >= 3) d.push({ tipo: 'campo', peso: A.resMin < 3 ? 130 : res < 8 ? 80 : 45, motivo: A.resMin < 3 ? 'el hambre reciente asustó a todos' : 'más tierra para sembrar' });
  if (pob >= 8 && n('corral') < 1 + Math.floor(pob / 25) && (s.fauna < 45 || pob >= 14)) d.push({ tipo: 'corral', peso: 48 + (s.fauna < 25 ? 35 : 0), motivo: s.fauna < 25 ? 'ya casi no quedan presas: hay que criar animales' : 'criar cabras, ovejas y gallinas' });
  if (pob >= 6 && !n('granero')) d.push({ tipo: 'granero', peso: 55 + (A.podrido > 20 ? 30 : 0), motivo: 'que la comida no se pudra' });
  if (n('granero') && n('granero') < 1 + Math.floor(pob / 18) && R.alimentos + R.comidas > capacidad(s, A) * 0.7) d.push({ tipo: 'granero', peso: 40, motivo: 'la despensa no da abasto' });
  if (pob >= 10 && !n('pozo')) d.push({ tipo: 'pozo', peso: 40 + (s.epidemia > 0 ? 40 : 0) + (s.clima.sequia ? 25 : 0), motivo: 'agua limpia' });
  if (pob >= 12 && !n('muelle') && s.edificios.filter((b) => b.tipo === 'muelle').length < 2 && dist(A.x, A.z, s.lago.x, s.lago.z) < s.lago.r + 24) d.push({ tipo: 'muelle', peso: 28 + (R.madera > 150 ? 30 : 0) + (s.peces < 30 ? 10 : 0), motivo: 'botes para pescar en lo hondo del lago' });
  if (pob >= 12 && !n('aserradero')) d.push({ tipo: 'aserradero', peso: 38 * (1 + lr('trabajador') * 0.4), motivo: 'trabajar mejor la madera' });
  if (pob >= 15 && !n('herreria')) d.push({ tipo: 'herreria', peso: 36 + (R.herramientas < adultos(s, al).length / 2 ? 22 : 0), motivo: 'faltan herramientas' });
  if (pob >= 18 && !n('enfermeria')) d.push({ tipo: 'enfermeria', peso: (30 + (s.epidemia > 0 ? 50 : 0)) * (1 + lr('curandero') * 0.7), motivo: 'un lugar para los enfermos' });
  if (pob >= 22 && !n('templo')) d.push({ tipo: 'templo', peso: (26 + G.filter((a) => tiene(a, 'piadoso')).length * 7) * (1 + lr('piadoso')), motivo: 'honrar al espíritu del orbe' });
  if (pob >= 26 && !n('plaza')) d.push({ tipo: 'plaza', peso: 28 * (1 + lr('sociable') * 0.6 + lr('ambicioso') * 0.4), motivo: 'un mercado para comerciar' });
  if (pob >= 14 && !n('muralla') && A.ataques > 0) d.push({ tipo: 'muralla', peso: (45 + A.ataques * 14) * (1 + (lr('colerico') + lr('valiente')) * 0.5), motivo: 'protegerse de los ataques' });
  if (pob >= 30 && !n('monumento') && L && tiene(L, 'ambicioso')) d.push({ tipo: 'monumento', peso: 34, motivo: `honrar a ${L.nombre} (idea suya)` });
  return d.sort((x, y) => y.peso - x.peso);
}
function consejo(s, A) {
  const obras = s.edificios.filter((b) => !b.hecho && b.al === A.id), pob = gentes(s, A.id).length;
  if (obras.length >= 1 + Math.floor(pob / 16) || !pob) { A.meta = null; return; }
  const d = deseos(s, A)[0];
  if (!d) { A.meta = null; return; }
  const T = TIPOS[d.tipo], R = A.res;
  if (R.madera >= T.madera && R.piedra >= T.piedra) {
    let x = 0, z = 0;
    if (d.tipo === 'muralla') { x = clamp(Math.max(...s.edificios.filter((b) => b.tipo !== 'muralla' && b.al === A.id && b.tipo !== 'muelle').map((b) => dist(b.x, b.z, A.x, A.z) + TIPOS[b.tipo].radio)) + 2.5, 10, Math.min(A.id ? 22 : 31, ...vivas(s).filter((B) => B.id !== A.id).map((B) => dist(A.x, A.z, B.x, B.z) - 9))); }   // la empalizada no encierra a las vecinas
    else { const p = buscarSitio(s, d.tipo, A); if (!p) { if (['casa', 'choza'].includes(d.tipo)) A.sinSitio++; A.meta = null; return; } x = p.x; z = p.z; A.sinSitio = 0; }
    R.madera -= T.madera; R.piedra -= T.piedra;
    const b = nuevoEdificio(s, d.tipo, x, z, false, A.id);
    if (d.reemplaza) b.reemplaza = d.reemplaza;
    if (d.tipo === 'muralla') { for (const t of s.arboles) if (t.c >= 0 && Math.abs(dist(t.x, t.z, A.x, A.z) - x) < 1.6) t.c = -1; }
    else R.madera += despejar(s, b.x, b.z, T.radio + 0.8);
    const L = vivo(s, A.lider);
    log(s, `${L ? `${L.nombre} y el consejo de ${A.nombre} deciden` : `${A.nombre} decide`} construir: ${T.n.toLowerCase()} (${d.motivo}).`, 'info');
    A.meta = null;
  } else A.meta = { tipo: d.tipo, motivo: d.motivo, madera: Math.max(0, T.madera - R.madera), piedra: Math.max(0, T.piedra - R.piedra) };
}
function terminarObra(s, b) {
  b.hecho = true; b.p = 1;
  const T = TIPOS[b.tipo], A = s.aldeas[b.al], primera = s.edificios.filter((x) => x.tipo === b.tipo && x.hecho).length === 1;
  if (b.tipo !== 'campo') log(s, `${A.nombre}: terminan ${['casa', 'choza'].includes(b.tipo) ? 'una ' + T.n.toLowerCase() : elTipo(b.tipo)}.`, 'logro');
  if (primera && b.tipo !== 'campo') hito(s, `Primer${FEM.includes(b.tipo) ? 'a' : ''} ${T.n.toLowerCase()} (${A.nombre})`);
  if (b.tipo === 'corral') { A.animales = Math.max(A.animales, 4); log(s, `${A.nombre} atrapa unas cabras y gallinas: el corral arranca con ${Math.round(A.animales)} animales.`, 'bueno'); }
  if (b.reemplaza) { const v = edificio(s, b.reemplaza); if (v) { s.edificios = s.edificios.filter((x) => x !== v); A.res.madera += 5; log(s, 'Derriban la vieja choza: la familia se pasa a la casa nueva.', 'info'); } }
  for (const a of gentes(s, b.al)) if (a.edad >= 6) recuerdo(s, a, 'obra', `La aldea tiene ${b.tipo === 'casa' ? 'una casa nueva' : T.n.toLowerCase()}`, 4, 3);
  asignarHogares(s);
}

// ---------------------------------------------------------------- recursos y demanda de cada aldea
export const capacidad = (s, A) => 160 + hechos(s, 'granero', A.id).length * 600;
const consumoDia = (s, A) => gentes(s, A.id).reduce((n, a) => n + (a.edad < 3 ? 0.8 : a.edad < 12 ? 1.3 : 2.1), 0) || 1;
export const reserva = (s, A) => (A.res.alimentos + A.res.comidas * 1.3) / consumoDia(s, A);
const adultos = (s, al) => (al == null ? s.gente : gentes(s, al)).filter((a) => a.edad >= 15);
const capAnimales = (s, A) => hechos(s, 'corral', A.id).length * 12;
function demanda(s, A) {
  const e = est(s), al = A.id, G = gentes(s, al), pob = G.length, res = reserva(s, A), obj = [12, 20, 26, 8][e], M = A.meta, R = A.res;
  const dem = {};
  dem.comida = clamp((obj - res) / obj, 0, 1) * 1.6 + 0.3 + (A.racion ? 0.6 : 0);
  const lenaInv = (hechos(s, null, al).filter((b) => TIPOS[b.tipo].camas).length * 1.1 + 2) * DIAS_EST * 1.4;
  dem.madera = 0.2 + (M?.madera > 0 ? 1 : 0) + (R.madera < pob * 2 ? 0.5 : 0) + (e >= 2 && R.madera < lenaInv ? 0.9 : 0) + (R.madera > 140 ? -0.6 : 0);
  dem.piedra = (M?.piedra > 0 ? 1.1 : 0.08) + (R.piedra < 10 && pob > 8 ? 0.3 : 0);
  dem.construir = s.edificios.some((b) => !b.hecho && b.al === al) ? 1.3 : 0;
  const tc = tareaCampo(s, al); dem.cultivar = tc ? (tc.campo.e === 'maduro' ? 1.5 + (res < 6 ? 1.5 : 0) : 1.3) : 0;
  dem.pastorear = A.animales >= 1 && hay(s, 'corral', al) ? 0.7 + (res < 8 ? 0.5 : 0) : 0;
  dem.cocinar = R.alimentos > 4 && R.comidas < pob * 2.5 && R.madera > 1 ? 0.9 : 0;
  dem.forjar = R.herramientas < adultos(s, al).length * 1.1 && R.madera > 4 && R.piedra > 3 ? 0.65 : 0;
  dem.carpinteria = R.madera > 70 && hechos(s, 'casa', al).some((b) => (b.nivel || 0) < 3) ? 0.45 + (R.madera > 180 ? 0.7 : 0) : 0;
  dem.sanar = G.some((a) => a.enf > 0 || a.nec.salud < 45) ? 1.6 : 0;
  const cupo = { comida: Math.ceil(pob * 0.45 * dem.comida), madera: Math.ceil(pob * 0.25 * dem.madera), piedra: Math.ceil(pob * 0.2 * dem.piedra), construir: 2 + Math.floor(pob / 6), cultivar: 1 + hechos(s, 'campo', al).length, pastorear: hechos(s, 'corral', al).length * 2, cocinar: 1 + Math.floor(pob / 12), forjar: 1 + Math.floor(pob / 20), carpinteria: 1 + Math.floor(pob / 15), sanar: 1 + G.filter((a) => a.enf > 0).length };
  return { dem, cupo, ocup: {} };
}
const GRUPO = { recolectar: 'comida', cazar: 'comida', pescar: 'comida', cultivar: 'cultivar', pastorear: 'pastorear', talar: 'madera', picar: 'piedra', construir: 'construir', cocinar: 'cocinar', forjar: 'forjar', carpinteria: 'carpinteria', sanar: 'sanar' };
const MOTIVO = { comida: 'la despensa se está quedando corta', madera: 'hace falta madera', piedra: 'hace falta piedra', construir: 'hay una obra en marcha', cultivar: 'los campos lo piden', pastorear: 'los animales necesitan cuidado', cocinar: 'hay comida cruda por preparar', forjar: 'faltan herramientas', carpinteria: 'sobra madera y las casas están peladas', sanar: 'hay gente enferma' };

function tareaCampo(s, al, b) {
  const e = est(s), f = fecha(s);   // se siembra en primavera y verano: caben dos cosechas al año
  const necesita = (x) => x.hecho && x.campo && x.al === al && ((x.campo.e === 'maduro') || (x.campo.e === 'barbecho' && (e === 0 || e === 1 || (e === 2 && f.dia <= 1))) || (x.campo.e === 'sembrado' && x.campo.k < 0.85 && e < 3));
  if (b) return necesita(b);
  return s.edificios.filter(necesita).sort((x, y) => (y.campo.e === 'maduro') - (x.campo.e === 'maduro') || x.campo.k - y.campo.k)[0] || null;
}

// ---------------------------------------------------------------- avanzar
export function avanzar(s, minutos) {
  s.resto += minutos;
  let n = 0;
  while (s.resto >= PASO && n++ < 600) { s.resto -= PASO; paso(s); }
  if (s.resto > PASO) s.resto = PASO;   // si el equipo no da, se pierde tiempo en vez de congelarse
}
function paso(s) {
  s.t += PASO;
  if (!s.gente.length) { if (s.t % MIN_DIA === 0) diaVacio(s); return; }   // sin nadie: solo corre el reloj (y quizá lleguen errantes)
  cachear(s);
  const h = PASO / 60, ctx = s.aldeas.map((A) => (A.vacia ? null : demanda(s, A)));
  for (const a of s.gente) if (a.acc && GRUPO[a.acc.tipo] && ctx[a.al]) { const o = ctx[a.al].ocup; o[a.acc.tipo] = (o[a.acc.tipo] || 0) + 1; }
  for (const a of [...s.gente]) if (s.gente.includes(a)) pasoPersona(s, a, h, ctx[a.al] || demanda(s, s.aldeas[a.al]));
  if (s.t % 60 === 0) cadaHora(s);
  if (s.t % MIN_DIA === 0) cadaDia(s);
}

// velocidad al caminar (unidades por minuto de juego)
function vel(a) { return 0.75 * (a.edad < 10 ? 0.8 : a.edad > 65 ? 0.7 : 1) * (a.nec.salud < 40 ? 0.7 : 1) * (a.acc?.prisa ? 1.8 : 1); }
function ruta(s, x0, z0, x1, z1) {
  const L = s.lago, dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1e-6;
  const k = clamp(((L.x - x0) * dx + (L.z - z0) * dz) / l2, 0, 1), cx = x0 + dx * k, cz = z0 + dz * k, d = dist(cx, cz, L.x, L.z);
  if (d < L.r + 1 && k > 0.02 && k < 0.98) { let nx = cx - L.x, nz = cz - L.z; if (Math.hypot(nx, nz) < 1e-3) { nx = -dz; nz = dx; } const m = Math.hypot(nx, nz); return [[L.x + (nx / m) * (L.r + 2.5), L.z + (nz / m) * (L.r + 2.5)], [x1, z1]]; }
  return [[x1, z1]];
}
function mover(a, d) {
  while (d > 0 && a.ruta.length) {
    const [x, z] = a.ruta[0], l = dist(a.x, a.z, x, z);
    if (l <= d) { a.x = x; a.z = z; a.ruta.shift(); d -= l; } else { a.x += ((x - a.x) / l) * d; a.z += ((z - a.z) / l) * d; d = 0; }
  }
}

function pasoPersona(s, a, h, ctx) {
  a.px = a.x; a.pz = a.z;
  necesidades(s, a, h);
  if (a.edad < 3) return bebe(s, a);
  const R = aldeaDe(s, a).res;
  // interrupciones: hambre extrema (si hay comida), agotamiento, la noche o una emergencia en su aldea
  const c0 = a.acc;
  if (c0 && GRUPO[c0.tipo] && c0.tipo !== 'sanar' && ((a.nec.saciedad < 12 && R.comidas + R.alimentos >= 1) || a.nec.energia < 8 || (horaDe(s) >= 21.5 && !c0.prisa))) terminar(s, a, true);
  else if (c0 && !['apagar', 'defender', 'convalecer'].includes(c0.tipo) && a.edad >= 15 && (s.edificios.some((b) => b.fuego > 0 && b.al === a.al) || (s.amenaza?.tipo === 'bandidos' && s.amenaza.al === a.al && !tiene(a, 'cobarde') && a.edad < 66))) terminar(s, a, true);
  if (!a.acc) decidir(s, a, ctx);
  const c = a.acc; if (!c) return;
  if (a.ruta.length) { a.dentro = false; mover(a, vel(a) * h * 60); if (a.ruta.length) return; }
  if (!c.llego) { c.llego = true; llegar(s, a, c); if (!a.acc) return; }
  c.h -= h;
  trabajar(s, a, c, h);
  if (a.acc && c.h <= 0) terminar(s, a, false);
}
function bebe(s, a) {
  const ix = idx(s), m = a.padres.map((id) => ix.get(id)).filter((p) => p && p.edad >= 3 && p.al === a.al)[0];
  a.acc = { tipo: 'bebe', h: 1, porque: 'Aún es muy pequeñ' + g(a, 'o', 'a') };
  if (m) { a.x = m.x + 0.6; a.z = m.z + 0.4; a.dentro = m.dentro; }
  else { const c = edificio(s, a.hogar) || fogata(s, a.al); a.x = c.x + 0.8; a.z = c.z + 0.8; a.dentro = !!a.hogar; }
}

// necesidades por hora (h = horas del paso)
function necesidades(s, a, h) {
  const n = a.nec, t = a.acc?.tipo, durmiendo = t === 'dormir' && a.acc.llego, trab = GRUPO[t] && a.acc?.llego;
  n.saciedad = clamp(n.saciedad - h * 3.6 * (tiene(a, 'gloton') ? 1.3 : 1) * (a.edad < 12 ? 0.8 : 1) * (s.clima.duro && est(s) === 3 ? 1.15 : 1) * (durmiendo ? 0.45 : 1));
  if (durmiendo) { const c = edificio(s, a.hogar); n.energia = clamp(n.energia + h * (c ? (c.tipo === 'casa' ? 13 + (c.nivel || 0) * 0.5 : 11.5) : 8)); }
  else n.energia = clamp(n.energia - h * (trab ? 5.2 : 3.8) * (a.edad > 62 ? 1.2 : 1) * (tiene(a, 'trabajador') ? 0.92 : 1));
  n.social = clamp(n.social - h * (durmiendo ? 0.6 : tiene(a, 'sociable') ? 3 : tiene(a, 'solitario') ? 1 : 2));
}

// ---------------------------------------------------------------- decidir: IA de utilidad
function decidir(s, a, ctx) {
  const hr = horaDe(s), n = a.nec, nino = a.edad < 15, viejo = a.edad >= 62, noche = hr >= (nino ? 20.5 : 21.5) || hr < 5.5, A = aldeaDe(s, a), R = A.res;
  const comida = R.comidas + R.alimentos >= 0.6, op = [];
  const add = (tipo, u, porque, extra) => { if (u > 0) op.push({ tipo, u: u * ent(s, 0.88, 1.12), porque, extra }); };
  // emergencias en su aldea
  const fuego = s.edificios.find((b) => b.fuego > 0 && b.al === a.al);
  if (fuego && a.edad >= 13 && !(tiene(a, 'cobarde') && prob(s, 0.5))) add('apagar', 400, `¡Se quema ${elTipo(fuego.tipo)}!`, { b: fuego.id });
  if (s.amenaza?.tipo === 'bandidos' && s.amenaza.al === a.al && a.edad >= 15 && a.edad < 66 && !tiene(a, 'cobarde')) add('defender', 380, 'Llegaron bandidos a la aldea');
  if (n.salud < 30 || a.enf > 0) add('convalecer', 110 + (a.enf > 0 ? 20 : 0), a.enf > 0 ? 'Está enferm' + g(a, 'o', 'a') : 'Está muy débil');
  if (s.fiesta && hr >= 16 && hr < 23.5 && (s.fiesta.al == null || s.fiesta.al === a.al)) add('fiesta', 140, `Fiesta por ${s.fiesta.motivo}`);
  // necesidades
  if (noche) add('dormir', 200, 'Es de noche');
  else if (n.energia < 22) add('dormir', (40 - n.energia) * 3.5, 'Está agotad' + g(a, 'o', 'a'));
  if (comida && n.saciedad < 72) add('comer', (78 - n.saciedad) * 1.7 + ([7, 12, 13, 18, 19].includes(Math.floor(hr)) ? 25 : 0) + (n.saciedad < 30 ? 90 : 0), n.saciedad < 30 ? 'Tiene mucha hambre' : 'Es hora de comer');
  add('socializar', (72 - n.social) * (tiene(a, 'sociable') ? 1.3 : tiene(a, 'solitario') ? 0.55 : 1) * (hr >= 17 ? 1.5 : 1), n.social < 30 ? 'Se siente sol' + g(a, 'o', 'a') : 'Quiere conversar');
  if (hay(s, 'templo', a.al) && (tiene(a, 'piadoso') || n.animo < 35)) add('rezar', (85 - n.animo) * 0.6 + (tiene(a, 'piadoso') ? 18 : 0), tiene(a, 'piadoso') ? 'Es piados' + g(a, 'o', 'a') : 'Busca consuelo');
  add('descansar', (tiene(a, 'perezoso') ? 28 : 7) + Math.max(0, 45 - n.energia), tiene(a, 'perezoso') ? 'No tiene ganas de trabajar' : 'Necesita un respiro');
  add('pasear', 4, 'No tiene nada urgente');
  if (nino && a.edad < 13) add('jugar', 55, 'Es niñ' + g(a, 'o', 'a'));
  // visitar otra aldea: familia, amigos o pareja posible
  if (!noche && a.edad >= 15 && hr < 18 && s.aldeas.length > 1) {
    const ix = idx(s); let lazoP = 0;
    for (const id of [...a.padres, ...a.hijos]) { const p = ix.get(id); if (p && p.al !== a.al) lazoP += 14; }
    if (!a.pareja && a.edad < 35) lazoP += 6;
    if (lazoP || prob(s, 0.15)) add('visitar', (6 + lazoP) * (tiene(a, 'sociable') ? 1.3 : 1) * (n.social < 50 ? 1.3 : 0.8), lazoP > 10 ? 'Extraña a su familia de la otra aldea' : 'Quiere ver cómo andan los vecinos');
  }
  // trabajos
  if (!noche && a.edad >= 8) {
    for (const [k, T] of Object.entries(TRAB)) {
      if (nino && !['recolectar', 'pescar', 'cultivar', 'pastorear'].includes(k)) continue;
      const gr = GRUPO[k], d = ctx.dem[gr]; if (!d) continue;
      if (k === 'sanar' && a.hab.sanar < 12 && !tiene(a, 'curandero')) continue;
      let u = 42 * d * a.gusto[k] * (0.72 + a.hab[T.hab] / 140);
      u *= tiene(a, 'trabajador') ? 1.3 : tiene(a, 'perezoso') ? 0.7 : 1;
      if (nino) u *= 0.45;
      if (viejo) u *= ['cocinar', 'sanar', 'forjar', 'cultivar', 'pastorear', 'carpinteria'].includes(k) ? 0.9 : 0.5;
      if (n.energia < 28) u *= 0.4;
      if (k === 'recolectar' && est(s) === 3) u *= 0.2;
      if (k === 'cazar') u *= clamp(s.fauna / 60, A.racion ? 0.35 : 0.06, 1.2);   // si se acabaron las presas cazan poco (salvo con hambre: van lejos)
      if (k === 'pescar') u *= clamp(s.peces / 60, A.racion ? 0.3 : 0.05, 1.2) * (hay(s, 'muelle', a.al) ? 1.3 : 1);
      const hambre = !comida && n.saciedad < 35 && (gr === 'comida' || (k === 'cultivar' && ctx.dem.cultivar > 1.5));
      if (hambre) u *= 3;
      const cu = ctx.cupo[gr] || 1, oc = gr === 'comida' ? (ctx.ocup.recolectar || 0) + (ctx.ocup.cazar || 0) + (ctx.ocup.pescar || 0) : ctx.ocup[k] || 0;
      u /= 1 + oc / cu;
      const yo = [];
      if (a.gusto[k] > 1.12) yo.push('le gusta'); if (a.hab[T.hab] >= 45) yo.push(`es buen${g(a, 'o', 'a')} en eso (${Math.round(a.hab[T.hab])})`);
      add(k, u, hambre ? 'Tiene hambre y no queda nada en la despensa' : `${MOTIVO[gr][0].toUpperCase()}${MOTIVO[gr].slice(1)}${yo.length ? ` y ${yo.join(' y ')}` : ''}`);
    }
  }
  op.sort((x, y) => y.u - x.u);
  for (const o of op) if (empezar(s, a, o)) return;
}
// prepara el destino de la acción; false si no hay dónde hacerla
function empezar(s, a, o) {
  const A = aldeaDe(s, a), F = fogata(s, a.al), casa = edificio(s, a.hogar), L = s.lago, al = a.al;
  const cerca = (x, z, r = 1.2) => { const an = rnd(s) * 6.28; return [x + Math.cos(an) * r, z + Math.sin(an) * r]; };
  let dest = null, h = 1, extra = {};
  switch (o.tipo) {
    case 'dormir': dest = casa ? [casa.x, casa.z] : cerca(F.x, F.z, 2.2); h = 12; break;
    case 'convalecer': { const e = hechos(s, 'enfermeria', al)[0]; dest = e ? cerca(e.x, e.z, 0.5) : casa ? [casa.x, casa.z] : cerca(F.x, F.z, 2.3); h = 3; break; }
    case 'comer': dest = casa && casa.tipo === 'casa' && prob(s, 0.5) ? cerca(casa.x, casa.z, 1.6) : cerca(F.x, F.z, 2.4); h = 0.5; break;
    case 'socializar': case 'fiesta': { const p = hechos(s, 'plaza', al)[0], c = p && prob(s, 0.6) ? p : F; dest = cerca(c.x, c.z, 2 + rnd(s) * 2); h = o.tipo === 'fiesta' ? 2 : 1.5; break; }
    case 'visitar': { const otras = s.aldeas.filter((B) => B.id !== al && !B.vacia); if (!otras.length) return false; const B = pick(s, otras), f2 = fogata(s, B.id); dest = cerca(f2.x, f2.z, 2.5 + rnd(s) * 2); h = 2; extra = { ref: B.id }; break; }
    case 'rezar': { const t = hechos(s, 'templo', al)[0]; dest = cerca(t.x, t.z, 0.6); h = 1.5; break; }
    case 'descansar': dest = casa ? cerca(casa.x, casa.z, 2.4) : cerca(F.x, F.z, 3); h = 1; break;
    case 'pasear': dest = cerca(a.x, a.z, 3 + rnd(s) * 5); if (Math.hypot(...dest) > 42 || dist(dest[0], dest[1], L.x, L.z) < L.r + 1) dest = cerca(F.x, F.z, 6); h = 0.5; break;
    case 'jugar': dest = cerca(F.x, F.z, 4 + rnd(s) * 4); h = 1.5; break;
    case 'apagar': { const b = edificio(s, o.extra.b); dest = cerca(b.x, b.z, TIPOS[b.tipo].radio + 0.8); h = 2; extra = { ref: b.id, ox: b.x, oz: b.z, prisa: true }; break; }
    case 'defender': { const m = s.amenaza; dest = cerca(m.x, m.z, 1.5); h = 2; extra = { prisa: true, ox: m.x, oz: m.z }; break; }
    case 'recolectar': { const b = s.arbustos.filter((x) => x.b >= 1.5).sort((x, y) => dist(a.x, a.z, x.x, x.z) - dist(a.x, a.z, y.x, y.z))[0]; if (!b) return false; dest = cerca(b.x, b.z, 0.9); extra = { ref: s.arbustos.indexOf(b), ox: b.x, oz: b.z }; break; }
    case 'cazar': {
      // con pocas presas hay que ir lejos, hasta el borde del orbe: más horas de camino
      const lejos = s.fauna < 25, t = s.arboles.filter((x) => x.c > 0.6 && Math.hypot(x.x, x.z) > (lejos ? 37 : 27)); if (!t.length) return false;
      const p = pick(s, t); dest = cerca(p.x, p.z, 1.5); extra = { ox: p.x, oz: p.z, lejos }; break;
    }
    case 'pescar': { const mu = hechos(s, 'muelle', al)[0]; if (mu) { dest = [mu.x + Math.sin(mu.rot) * 2, mu.z + Math.cos(mu.rot) * 2]; extra = { ox: L.x, oz: L.z, bote: true }; break; } const an = Math.atan2(a.z - L.z, a.x - L.x) + (rnd(s) - 0.5) * 1.6; dest = [L.x + Math.cos(an) * (L.r + 0.7), L.z + Math.sin(an) * (L.r + 0.7)]; extra = { ox: L.x, oz: L.z }; break; }
    case 'cultivar': { const b = tareaCampo(s, al); if (!b) return false; dest = cerca(b.x, b.z, rnd(s) * 2.2); extra = { ref: b.id, sub: b.campo.e === 'maduro' ? 'cosechar' : b.campo.e === 'barbecho' ? 'sembrar' : 'cuidar', ox: b.x, oz: b.z }; break; }
    case 'pastorear': { const c = hechos(s, 'corral', al)[0]; if (!c) return false; dest = cerca(c.x, c.z, 1 + rnd(s) * 2); extra = { ref: c.id, ox: c.x, oz: c.z }; break; }
    case 'talar': { const as = hechos(s, 'aserradero', al)[0] || F; let mejor = null, md = 1e9; for (const t of s.arboles) if (t.c >= 0.8 && !t.o) { const d = dist(as.x, as.z, t.x, t.z) + dist(a.x, a.z, t.x, t.z) * 0.3; if (d < md) { md = d; mejor = t; } } if (!mejor) return false; mejor.o = a.id; dest = cerca(mejor.x, mejor.z, 1); extra = { ref: s.arboles.indexOf(mejor), ox: mejor.x, oz: mejor.z }; break; }
    case 'picar': { const r = s.rocas.filter((x) => x.q > 0).sort((x, y) => dist(a.x, a.z, x.x, x.z) - dist(a.x, a.z, y.x, y.z))[0]; if (!r) return false; dest = cerca(r.x, r.z, 1.3); extra = { ref: s.rocas.indexOf(r), ox: r.x, oz: r.z }; break; }
    case 'construir': { const obras = s.edificios.filter((b) => !b.hecho && b.al === al); if (!obras.length) return false; const b = pick(s, obras); if (b.tipo === 'muralla') { const an = rnd(s) * 6.28; dest = [b.x + Math.cos(an) * (b.radio - 1), b.z + Math.sin(an) * (b.radio - 1)]; extra = { ref: b.id, ox: b.x + Math.cos(an) * b.radio, oz: b.z + Math.sin(an) * b.radio }; } else { dest = cerca(b.x, b.z, TIPOS[b.tipo].radio + 0.6); extra = { ref: b.id, ox: b.x, oz: b.z }; } break; }
    case 'cocinar': dest = cerca(F.x, F.z, 1.6); extra = { ox: F.x, oz: F.z }; break;
    case 'forjar': { const hz = hechos(s, 'herreria', al)[0] || F; dest = cerca(hz.x, hz.z, TIPOS[hz.tipo].radio * 0.6); extra = { ox: hz.x, oz: hz.z }; break; }
    case 'carpinteria': { const c = hechos(s, 'casa', al).filter((b) => (b.nivel || 0) < 3).sort((x, y) => (x.nivel || 0) - (y.nivel || 0) || (y.mej || 0) - (x.mej || 0))[0]; if (!c || A.res.madera < 8) return false; A.res.madera -= 8; dest = cerca(c.x, c.z, 3.4); extra = { ref: c.id, ox: c.x, oz: c.z }; break; }
    case 'sanar': { const p = s.gente.filter((x) => x !== a && x.al === al && (x.enf > 0 || x.nec.salud < 45)).sort((x, y) => x.nec.salud - y.nec.salud)[0]; if (!p) return false; dest = cerca(p.x, p.z, 0.9); extra = { ref: p.id, ox: p.x, oz: p.z }; break; }
  }
  if (TRAB[o.tipo]) h = TRAB[o.tipo].h;
  if (o.tipo === 'cazar' && extra.lejos) h = 6;
  a.acc = { tipo: o.tipo, h, porque: o.porque + (extra.lejos ? ' (ya no quedan presas cerca: va hasta el borde del bosque)' : ''), llego: false, ...extra };
  a.ruta = ruta(s, a.x, a.z, dest[0], dest[1]); a.dentro = false;
  return true;
}
function llegar(s, a, c) {
  if (c.tipo === 'comer') comer(s, a);
  if ((c.tipo === 'dormir' || c.tipo === 'convalecer') && (a.hogar != null || hay(s, 'enfermeria', a.al))) a.dentro = c.tipo === 'dormir' ? a.hogar != null : true;
  if (c.tipo === 'rezar') a.dentro = true;
}
function comer(s, a) {
  const A = aldeaDe(s, a), R = A.res, racion = A.racion ? 0.75 : 1, k = (a.edad < 12 ? 0.6 : 1) * racion;   // con la despensa baja se raciona
  if (racion < 1) recuerdo(s, a, 'racion', 'Están racionando la comida', -5, 1);
  if (R.comidas >= k) { R.comidas -= k; a.nec.saciedad = clamp(a.nec.saciedad + 62 * racion); if (A.cocinero && prob(s, 0.3)) recuerdo(s, a, 'comida', 'Comió delicioso', 5, 1); }
  else if (R.alimentos >= k * 1.2) { R.alimentos -= k * 1.2; a.nec.saciedad = clamp(a.nec.saciedad + 46 * racion); recuerdo(s, a, 'comida', 'Comió algo crudo y simple', -3, 1); if (prob(s, 0.02)) { a.nec.salud -= 8; recuerdo(s, a, 'barriga', 'Le cayó mal la comida', -6, 1); } }
  else { recuerdo(s, a, 'hambre', 'No había nada de comer', -12, 1); terminar(s, a, true); }
}

// eficiencia: habilidad, herramientas, líder, rasgos, edad, salud y edificios
function eficiencia(s, a, k) {
  const T = TRAB[k], A = aldeaDe(s, a), ad = Math.max(1, adultos(s, a.al).length), L = vivo(s, A.lider);
  let f = (0.55 + (a.hab[T.hab] / 100) * 0.9) * (1 + 0.35 * Math.min(1, A.res.herramientas / ad)) * (1 + (L ? L.hab.liderar / 100 : 0) * 0.12);
  if (tiene(a, 'fuerte') && ['talar', 'picar', 'construir'].includes(k)) f *= 1.25;
  if (tiene(a, 'curandero') && k === 'sanar') f *= 1.4;
  if (tiene(a, 'campesino') && ['cultivar', 'pastorear'].includes(k)) f *= 1.25;
  if (a.edad < 14) f *= 0.5; else if (a.edad > 64) f *= 0.7;
  if (a.nec.salud < 45) f *= 0.65;
  if (a.nec.animo > 75) f *= 1.08; else if (a.nec.animo < 25) f *= 0.85;
  return f;
}
function trabajar(s, a, c, h) {
  const T = TRAB[c.tipo], A = aldeaDe(s, a), R = A.res;
  if (c.tipo === 'apagar') { const b = edificio(s, c.ref); if (!b || b.fuego <= 0) return terminar(s, a, false); b.fuego = Math.max(0, b.fuego - h * 1.3 * (tiene(a, 'fuerte') ? 1.3 : 1)); return; }
  if (c.tipo === 'socializar' || c.tipo === 'fiesta' || c.tipo === 'visitar') { a.nec.social = clamp(a.nec.social + h * 8); return; }
  if (c.tipo === 'rezar') { s.esp.fe = clamp(s.esp.fe + h * 0.25); recuerdo(s, a, 'rezo', 'Rezó al espíritu del orbe', tiene(a, 'piadoso') ? 9 : 5, 1); return; }
  if (c.tipo === 'dormir') { const hr = horaDe(s); if (hr >= 5.5 && hr < 20 && a.nec.energia >= (hr < 9 ? 88 : 97)) terminar(s, a, false); return; }
  if (c.tipo === 'descansar' || c.tipo === 'convalecer') { a.nec.energia = clamp(a.nec.energia + h * 4); return; }
  if (c.tipo === 'jugar') { a.nec.social = clamp(a.nec.social + h * 6); return; }
  if (!T) return;
  const f = eficiencia(s, a, c.tipo);
  switch (c.tipo) {
    case 'recolectar': { const b = s.arbustos[c.ref]; if (!b || b.b <= 0) return terminar(s, a, false); const q = Math.min(b.b, 2 * f * h); b.b -= q; R.alimentos += q; break; }
    case 'pescar': { const q = 2 * f * h * Math.max(0.08, s.peces / 100) * (est(s) === 3 ? (c.bote ? 0.2 : 0.4) : 1) * (c.bote ? 1.45 : 1); s.peces = clamp(s.peces - q * 0.25); R.alimentos += q; break; }
    case 'cultivar': {
      const b = edificio(s, c.ref); if (!b?.campo) return terminar(s, a, false); const C = b.campo;
      if (c.sub === 'cosechar') { if (C.e !== 'maduro') return terminar(s, a, false); const q = Math.min(C.r, 9 * f * h); C.r -= q; R.alimentos += q; if (C.r <= 0.5) { C.e = 'barbecho'; C.c = 0; C.k = 0; C.r = 0; terminar(s, a, false); } }
      else if (c.sub === 'cuidar') C.k = clamp(C.k + 0.12 * f * h, 0, 1);
      else { C.s = (C.s || 0) + 0.38 * f * h; if (C.s >= 1) { C.e = 'sembrado'; C.c = 0.02; C.k = 0.5; C.s = 0; terminar(s, a, false); } }
      break;
    }
    case 'pastorear': { const q = 0.32 * f * h * Math.pow(Math.max(0, A.animales), 0.7); R.alimentos += q; A.cuidados = (A.cuidados || 0) + h; break; }   // leche y huevos
    case 'picar': { const r = s.rocas[c.ref]; if (!r || r.q <= 0) return terminar(s, a, false); const q = Math.min(r.q, 1.6 * f * h); r.q -= q; R.piedra += q; break; }
    case 'construir': { const b = edificio(s, c.ref); if (!b || b.hecho) return terminar(s, a, false); b.p = Math.min(1, b.p + (f * h) / TIPOS[b.tipo].trabajo); if (b.p >= 1) { terminarObra(s, b); terminar(s, a, false); } break; }
    case 'cocinar': { const q = Math.min(R.alimentos, 3.4 * f * h); if (q <= 0 || R.madera < 0.1) return terminar(s, a, false); R.alimentos -= q; R.comidas += q * (tiene(a, 'cocinero') ? 1.45 : 1.25); R.madera = Math.max(0, R.madera - q * 0.08); if (tiene(a, 'cocinero')) A.cocinero = true; break; }
    case 'forjar': { const her = hay(s, 'herreria', a.al), q = (her ? 0.42 : 0.18) * f * h; if (R.madera < q * 1.2 || R.piedra < q * 1.2) return terminar(s, a, false); R.madera -= q * 1.2; R.piedra -= q * 1.2; R.herramientas += q; break; }
    case 'carpinteria': {
      const b = edificio(s, c.ref); if (!b || (b.nivel || 0) >= 3) return terminar(s, a, false);
      b.mej = (b.mej || 0) + (f * h) / 14; R.madera = Math.max(0, R.madera - h * 1.6);
      if (b.mej >= 1) { b.mej = 0; b.nivel = (b.nivel || 0) + 1; const quien = gentes(s, a.al).find((x) => x.hogar === b.id); log(s, `${a.nombre} termina ${['una mesa y bancas', 'un portal techado y camas nuevas', 'jardineras y un balcón'][b.nivel - 1]} para la casa${quien ? ` de ${quien.nombre}` : ''}.`, 'info'); for (const x of gentes(s, a.al)) if (x.hogar === b.id) recuerdo(s, x, 'muebles', 'Su casa está más bonita', 6, 6); terminar(s, a, false); }
      break;
    }
    case 'sanar': { const p = vivo(s, c.ref); if (!p) return terminar(s, a, false); const k = hay(s, 'enfermeria', a.al) ? 1.5 : 1; p.nec.salud = clamp(p.nec.salud + 4.5 * f * h * k); if (p.enf > 0) p.enf = Math.max(0, p.enf - 0.22 * f * h * k); a.x = p.x + 0.8; a.z = p.z + 0.5; c.ox = p.x; c.oz = p.z; if (p.enf <= 0 && p.nec.salud > 70) terminar(s, a, false); break; }
  }
  // práctica, desgaste de herramientas y pequeño patrimonio personal
  a.hab[T.hab] = clamp((a.hab[T.hab] || 0) + h * 0.32 * (1 - (a.hab[T.hab] || 0) / 100) * (tiene(a, 'ingenioso') ? 1.5 : 1) * (a.edad < 20 ? 1.25 : 1));
  a.horas[c.tipo] = (a.horas[c.tipo] || 0) + h;
  R.herramientas = Math.max(0, R.herramientas - h * 0.004);
  a.bienes += h * 0.03 * f;
}
function terminar(s, a, abortado) {
  const c = a.acc; if (!c) return;
  const R = aldeaDe(s, a).res;
  if (c.tipo === 'talar' && s.arboles[c.ref]) { const t = s.arboles[c.ref]; t.o = 0; if (!abortado && t.c >= 0.8) { const f = eficiencia(s, a, 'talar'); R.madera += (6 + 5 * f) * (hay(s, 'aserradero', a.al) ? 1.4 : 1); t.c = 0; } }
  if (c.tipo === 'cazar' && !abortado) cazar(s, a, c);
  if (c.tipo === 'socializar' && !abortado) conversar(s, a);
  if (c.tipo === 'visitar' && !abortado) { conversar(s, a); recuerdo(s, a, 'visita', `Visitó ${s.aldeas[c.ref]?.nombre || 'la otra aldea'}`, 5, 2); }
  if (c.tipo === 'fiesta' && !abortado) { recuerdo(s, a, 'fiesta', 'Disfrutó la fiesta', 12, 3); conversar(s, a); }
  if (c.tipo === 'jugar' && !abortado) { recuerdo(s, a, 'juego', 'Jugó un buen rato', 5, 1); conversar(s, a); }
  a.acc = null; a.ruta = []; if (c.tipo !== 'dormir' || a.hogar == null) a.dentro = false;
}
function cazar(s, a, c) {
  const R = aldeaDe(s, a).res, fa = s.fauna + (c.lejos ? 22 : 0), f = eficiencia(s, a, 'cazar'), p = clamp((0.28 + a.hab.cazar * 0.005 + (tiene(a, 'valiente') ? 0.08 : 0)) * (0.3 + fa / 120) * (est(s) === 3 ? 0.7 : 1), 0.05, 0.92);
  if (prob(s, p)) { const q = (10 + 10 * f) * (0.6 + fa / 200); R.alimentos += q; s.fauna = clamp(s.fauna - 4); if (q > 24 && prob(s, 0.2)) log(s, `${a.nombre} vuelve de cacería con un venado enorme.`, 'bueno'); }
  if (prob(s, (tiene(a, 'valiente') ? 0.016 : 0.024) * (c.lejos ? 1.4 : 1))) { a.nec.salud -= 30; a.ultimoDano = 'herida de caza'; log(s, `Un jabalí hiere a ${a.nombre} durante la cacería.`, 'malo'); vida(a, s, 'Lo hirió un jabalí'); recuerdo(s, a, 'herida', 'Lo hirió un jabalí', -12, 4); }
}
// conversación con quienes estén cerca: afinidad según el carácter de cada uno
function conversar(s, a) {
  const otros = s.gente.filter((b) => b !== a && b.edad >= 3 && b.acc && ['socializar', 'fiesta', 'jugar', 'comer', 'descansar', 'visitar'].includes(b.acc.tipo) && dist(a.x, a.z, b.x, b.z) < 9);
  if (!otros.length) { a.nec.social = clamp(a.nec.social + 6); return; }
  for (const b of otros.sort(() => rnd(s) - 0.5).slice(0, 2)) {
    let d = ent(s, -5, 6);
    for (const x of [a, b]) { if (tiene(x, 'amable')) d += 2.5; if (tiene(x, 'colerico')) d -= 2.6; if (tiene(x, 'sociable')) d += 1; }
    if (a.rasgos.some((r) => b.rasgos.includes(r))) d += 1.5;
    if (Math.abs(a.edad - b.edad) > 25) d -= 1;
    const antes = af(s, a.id, b.id), v = cambiarAf(s, a.id, b.id, d);
    a.nec.social = clamp(a.nec.social + 24); b.nec.social = clamp(b.nec.social + 18);
    if (a.al !== b.al) cambiarLazo(s, a.al, b.al, d * 0.025);   // las visitas acercan (o alejan) a las aldeas
    const kk = rk(a.id, b.id), visto = (s.relHito ||= {})[kk];
    if (antes < 40 && v >= 40 && !familia(a, b) && a.pareja !== b.id && visto !== 1) { s.relHito[kk] = 1; social(s, 'amig', a, b); vida(a, s, `Se hizo amig${g(a, 'o', 'a')} de ${b.nombre}`); vida(b, s, `Se hizo amig${g(b, 'o', 'a')} de ${a.nombre}`); }
    if (antes > -40 && v <= -40 && visto !== -1) { s.relHito[kk] = -1; social(s, 'enem', a, b); vida(a, s, `Se enemistó con ${b.nombre}`); vida(b, s, `Se enemistó con ${a.nombre}`); }
    if (v < -50 && (tiene(a, 'colerico') || tiene(b, 'colerico')) && s.t - Math.max(a.pelea || -1e9, b.pelea || -1e9) > 8 * MIN_DIA && prob(s, 0.04)) pelea(s, a, b);
  }
}
function pelea(s, a, b) {
  const da = ent(s, 4, 14), db = ent(s, 4, 14);
  a.nec.salud -= da; b.nec.salud -= db; a.pelea = b.pelea = s.t; a.ultimoDano = b.ultimoDano = 'una pelea';
  cambiarAf(s, a.id, b.id, -12);
  for (const x of [a, b]) recuerdo(s, x, 'pelea', `Se agarró a golpes con ${x === a ? b.nombre : a.nombre}`, -14, 4);
  social(s, 'pelea', a, b); vida(a, s, `Peleó con ${b.nombre}`); vida(b, s, `Peleó con ${a.nombre}`);
  if (a.al !== b.al) cambiarLazo(s, a.al, b.al, -6);
  for (const o of gentes(s, a.al)) if (o !== a && o !== b && o.edad > 10) recuerdo(s, o, 'tension', 'Hay tensión en la aldea', -3, 2);
}

// ---------------------------------------------------------------- cada hora: ánimo, salud, clima, incendios y amenazas
function cadaHora(s) {
  const hr = horaDe(s), e = est(s), frio = e === 3 && (hr >= 19 || hr < 7);
  idx(s); const T = TMP.get(s); T.al = s.aldeas.map((A) => ({ hac: gentes(s, A.id).length / Math.max(1, camas(s, A.id)), res: reserva(s, A) }));   // para el ánimo
  // racionamiento con histéresis (el consejo raciona antes de vaciar la despensa)
  for (const A of s.aldeas) {
    const n = gentes(s, A.id).length, rv = T.al[A.id].res, rac = n > 2 && (A.racion ? rv < 6 : rv < 4);
    if (rac && !A.racion && s.t - (A.racionLog ?? -1e9) > DIAS_EST * MIN_DIA) { A.racionLog = s.t; log(s, `${A.nombre}: la despensa baja y el consejo empieza a racionar la comida.`, 'malo'); }   // una vez por estación, no cada vez que sube y baja
    A.racion = rac;
  }
  for (const a of [...s.gente]) {
    const n = a.nec, A = aldeaDe(s, a);
    a.mem = a.mem.filter((m) => m.hasta > s.t);
    n.animo = clamp(n.animo + (objetivoAnimo(s, a) - n.animo) * 0.06);
    const max = a.edad > 55 ? 100 - (a.edad - 55) * 1.4 : 100;
    if (n.saciedad <= 0) { n.salud -= 0.45; a.ultimoDano = 'hambre'; }
    if (frio && (a.hogar == null || A.sinLena) && !(a.acc?.tipo === 'dormir' && a.dentro && !A.sinLena)) { n.salud -= a.edad < 5 || a.edad > 65 ? 0.9 : 0.5; a.ultimoDano = 'frío'; }
    if (a.enf > 0) { n.salud -= 0.6 * (tiene(a, 'enfermizo') ? 1.4 : tiene(a, 'robusto') ? 0.6 : 1) * (hay(s, 'enfermeria', a.al) ? 0.7 : 1) * (a.edad < 5 || a.edad > 65 ? 1.4 : 1); a.ultimoDano = 'enfermedad'; }
    else if (n.saciedad > 25 && n.salud < max) n.salud += (tiene(a, 'robusto') ? 0.4 : tiene(a, 'enfermizo') ? 0.16 : 0.26) * (a.acc?.tipo === 'convalecer' ? 2 : 1);
    n.salud = clamp(n.salud, -1, Math.max(5, max));
    if (n.salud <= 0) morir(s, a, a.ultimoDano || 'debilidad');
  }
  // clima
  if (s.clima.lluvia > 0) s.clima.lluvia--;
  if (s.clima.nieve > 0) s.clima.nieve--;
  // incendios: daño si nadie lo apaga; puede saltar al vecino
  for (const b of [...s.edificios]) if (b.fuego > 0) {
    b.dano += 0.13 * (s.clima.lluvia ? 0.4 : 1); const apagando = s.gente.some((a) => a.acc?.tipo === 'apagar' && a.acc.ref === b.id && a.acc.llego);
    b.fuego = Math.max(0, b.fuego - (s.clima.lluvia ? 1.2 : 0) + (apagando ? 0 : 0.3));
    if (b.fuego > 0 && prob(s, 0.04)) { const v = s.edificios.find((x) => x !== b && x.hecho && !x.fuego && !['muralla', 'pozo', 'muelle'].includes(x.tipo) && dist(x.x, x.z, b.x, b.z) < 8); if (v) { v.fuego = 5; log(s, `El fuego salta a ${elTipo(v.tipo)} de al lado.`, 'malo'); } }
    if (b.dano >= 1) quemado(s, b);
    else if (b.fuego <= 0) { log(s, `Logran apagar el incendio de ${elTipo(b.tipo)}.`, 'bueno'); for (const a of s.gente) if (a.acc?.tipo === 'apagar' && a.acc.ref === b.id) recuerdo(s, a, 'heroe', 'Ayudó a apagar el incendio', 8, 4); b.dano = 0; asignarHogares(s); }
  }
  // amenazas
  const m = s.amenaza;
  if (m && s.t >= m.hasta) { if (m.tipo === 'bandidos') resolverBandidos(s); s.amenaza = null; }
  if (s.fiesta && s.t >= s.fiesta.hasta) s.fiesta = null;
}
function objetivoAnimo(s, a) {
  const n = a.nec, casa = edificio(s, a.hogar), T = TMP.get(s)?.al?.[a.al], A = aldeaDe(s, a);
  let o = 43 + (tiene(a, 'alegre') ? 10 : 0) - (tiene(a, 'melancolico') ? 10 : 0);
  o += (n.saciedad - 50) * 0.25 + (n.energia - 50) * 0.1 + (n.social - 50) * 0.18 + Math.min(0, n.salud - 70) * 0.3;
  o += casa ? (casa.tipo === 'casa' ? 6 + (casa.nivel || 0) * 1.5 : 1) : a.edad < 3 ? 0 : -14;
  if (a.pareja) o += 4;
  if (T?.hac > 1) o -= Math.min(12, (T.hac - 1) * 25); if (T?.res < 3) o -= 10;
  if (hay(s, 'plaza', a.al)) o += 3;
  if (hay(s, 'templo', a.al) && tiene(a, 'piadoso')) o += 5;
  if (tiene(a, 'ambicioso') && A.lider !== a.id && a.edad >= 18) o -= 5;
  if (A.lider === a.id) o += 6;
  for (const m of a.mem) o += m.v;
  return clamp(o);
}
function quemado(s, b) {
  const T = TIPOS[b.tipo], A = s.aldeas[b.al];
  log(s, `${A.nombre}: ${T.n.toLowerCase()} queda reducid${FEM.includes(b.tipo) ? 'a' : 'o'} a cenizas.`, 'malo');
  if (b.tipo === 'granero') { A.res.alimentos *= 0.4; A.res.comidas *= 0.4; log(s, 'Con el granero se pierde buena parte de la comida.', 'malo'); }
  if (b.tipo === 'corral') { A.animales *= 0.4; }
  if (b.tipo === 'fogata') { b.fuego = 0; b.dano = 0; return; }
  s.edificios = s.edificios.filter((x) => x !== b);
  for (const a of gentes(s, b.al)) { if (a.hogar === b.id) { recuerdo(s, a, 'sinCasa', 'Perdió su casa en el incendio', -20, 8); vida(a, s, 'Perdió su casa en un incendio'); } else if (a.edad > 8) recuerdo(s, a, 'incendio', 'El incendio asustó a todos', -5, 3); }
  hito(s, `Incendio en ${A.nombre}: se pierde ${T.n.toLowerCase()}`);
  asignarHogares(s);
}
function resolverBandidos(s) {
  const m = s.amenaza, A = s.aldeas[m.al], R = A.res, def = s.gente.filter((a) => a.acc?.tipo === 'defender' && a.acc.llego);
  let fuerza = def.reduce((n, a) => n + (tiene(a, 'fuerte') ? 1.6 : 1) * (tiene(a, 'valiente') ? 1.5 : 1) * clamp(a.nec.salud / 100, 0.2, 1), 0);
  if (hay(s, 'muralla', A.id)) fuerza += 10;
  fuerza *= 1 + 0.3 * Math.min(1, R.herramientas / Math.max(1, def.length));
  const ban = m.n, gana = prob(s, fuerza / (fuerza + ban * 1.1));
  for (const a of def) a.acc && terminar(s, a, true);
  if (gana) {
    log(s, `¡${A.nombre} repele a ${ban} bandidos!${def.length ? ` ${def.slice(0, 3).map((a) => a.nombre).join(', ')} dan la cara.` : ''}`, 'logro');
    for (const a of def) { recuerdo(s, a, 'heroe', 'Defendió la aldea', 14, 6); a.nec.salud -= ent(s, 0, 18); a.ultimoDano = 'heridas de pelea'; vida(a, s, 'Defendió la aldea de los bandidos'); }
    for (const a of def) for (const b of def) if (a.id < b.id) cambiarAf(s, a.id, b.id, 8);
    hito(s, `${A.nombre} rechaza a los bandidos`);
  } else {
    R.alimentos *= 0.5; R.comidas *= 0.5; R.herramientas *= 0.6; R.madera *= 0.85; A.animales *= 0.7;
    log(s, `Los bandidos saquean ${A.nombre}: se llevan la mitad de la comida, animales y herramientas.`, 'malo');
    for (const a of def) { a.nec.salud -= ent(s, 10, 35); a.ultimoDano = 'heridas de los bandidos'; }
    if (def.length && prob(s, 0.45)) { const v = pick(s, def); v.nec.salud = -1; morir(s, v, 'a manos de los bandidos'); }
    for (const a of gentes(s, A.id)) recuerdo(s, a, 'saqueo', 'Los bandidos saquearon la aldea', -14, 8);
    hito(s, `Saqueo de ${A.nombre}`);
  }
  A.ataques++;
}

// ---------------------------------------------------------------- cada día
function cadaDia(s) {
  const f = fecha(s), e = f.est;
  if (f.dia === 1) nuevaEstacion(s, e);
  // edad, embarazos y muertes naturales
  for (const a of [...s.gente]) {
    const antes = a.edad; a.edad = +(a.edad + 1 / DIAS_ANIO).toFixed(4);
    if (antes < 15 && a.edad >= 15) { vida(a, s, 'Llegó a la edad adulta'); for (const k of Object.keys(HABS)) a.hab[k] = clamp((a.hab[k] || 0) + 3 + rnd(s) * 8); for (const r of a.rasgos) for (const [k, v] of Object.entries(RASGO_HAB[r] || {})) a.hab[k] = clamp(a.hab[k] + v * 0.6); }
    if (a.emb > 0 && --a.emb <= 0) parto(s, a);
    const lim = tiene(a, 'robusto') ? 57 : tiene(a, 'enfermizo') ? 46 : 52;
    const p = a.edad < 1 ? 0.0012 : a.edad > lim ? Math.pow((a.edad - lim) / 24, 3) / DIAS_ANIO : 0;
    if (p > 0 && prob(s, p)) { a.nec.salud = -1; morir(s, a, a.edad < 1 ? 'una fiebre de recién nacido' : 'vejez'); }
  }
  if (!s.gente.length) return finSiVacia(s);
  for (const A of s.aldeas) if (!A.vacia) diaAldea(s, A, f);
  // campos, bosque, bayas, fauna y peces
  for (const b of s.edificios) if (b.campo && b.hecho) {
    const C = b.campo;
    if (C.e === 'sembrado') {
      if (e < 3) { C.c += 0.11 * (s.clima.sequia ? 0.3 : 1) * (0.45 + C.k * 0.6) * (s.clima.lluvia ? 1.2 : 1); C.k = clamp(C.k - 0.07, 0, 1); }
      if (C.c >= 1) { C.e = 'maduro'; C.c = 1; C.r = 80 * (0.55 + C.k * 0.5) * (s._buena ? 1.6 : 1) * (s.clima.sequia ? 0.6 : 1); }
    }
    if (e === 3 && f.dia === 1 && C.e !== 'barbecho') { if (C.e === 'maduro' && C.r > 5) log(s, `${s.aldeas[b.al].nombre}: la cosecha que nadie recogió se pudre con la helada.`, 'malo'); C.e = 'barbecho'; C.c = 0; C.k = 0; C.r = 0; }
  }
  for (const t of s.arboles) if (t.c >= 0 && t.c < 1) t.c = Math.min(1, t.c + (e === 3 ? 0.006 : 0.022));
  for (const b of s.arbustos) b.b = clamp(b.b + (e === 0 ? 1 : e === 1 ? (s.clima.sequia ? 0.15 : 0.8) : e === 2 ? 0.45 : -0.6), 0, 8);
  // siempre llegan presas y peces de fuera; los botes alcanzan peces de lo hondo
  s.fauna = clamp(s.fauna + (0.07 * s.fauna * (1 - s.fauna / 100) + 1) * (e === 3 ? 0.3 : 1));
  s.peces = clamp(s.peces + 0.09 * s.peces * (1 - s.peces / 100) + 1.2 + hechos(s, 'muelle').length * 0.6);
  if (s.fauna < 12 && !s._avisoFauna) { s._avisoFauna = true; log(s, 'Ya casi no quedan venados ni jabalíes en el bosque: la caza no alcanza.', 'malo'); } else if (s.fauna > 35) s._avisoFauna = false;
  if (s.peces < 12 && !s._avisoPeces) { s._avisoPeces = true; log(s, 'El lago está casi vacío de peces.', 'malo'); } else if (s.peces > 35) s._avisoPeces = false;
  if (s.rocas.filter((r) => r.q > 0).length < 5 && prob(s, 0.06)) { const r = s.rocas.find((x) => x.q <= 0); if (r) { r.q = 40 + rnd(s) * 30; log(s, 'Al picar descubren una veta de piedra nueva.', 'bueno'); } }
  // relaciones: el tiempo enfría un poco todo
  for (const k of Object.keys(s.rel)) { s.rel[k] *= 0.99; if (Math.abs(s.rel[k]) < 0.5) delete s.rel[k]; }
  parejas(s); nacimientos(s);
  asignarHogares(s);
  partidas(s);
  if (!s.gente.length) return finSiVacia(s);
  for (const A of s.aldeas) if (!A.vacia) { const L = vivo(s, A.lider); if (!L || L.al !== A.id || f.d >= A.mandato) elegirLider(s, A, L && L.al === A.id ? 'mandato' : 'vacante'); golpe(s, A); consejo(s, A); }
  entreAldeas(s, f);
  fundar(s);
  eventosDia(s, f);
  for (const A of s.aldeas) if (!A.vacia && !gentes(s, A.id).length) { A.vacia = true; A.lider = null; log(s, `${A.nombre} queda abandonada.`, 'malo'); hito(s, `${A.nombre} queda abandonada`); }
  s.esp.fe = clamp(s.esp.fe - 0.5);
  if (s.epidemia > 0) s.epidemia--;
  s.maxPob = Math.max(s.maxPob, s.gente.length);
  volcarSocial(s);
  // crónica
  if (f.d % s.hist.paso === 0) {
    const H = s.hist, pob = s.gente.length;
    H.pob.push(pob); H.comida.push(Math.round(s.aldeas.reduce((n, A) => n + A.res.alimentos + A.res.comidas, 0))); H.animo.push(Math.round(s.gente.reduce((n, a) => n + a.nec.animo, 0) / Math.max(1, pob))); H.casas.push(hechos(s).length);
    for (const A of s.aldeas) { const l = (H.al[A.id] ||= Array(H.pob.length - 1).fill(0)); l.push(gentes(s, A.id).length); }
    if (H.pob.length > 240) { for (const k of ['pob', 'comida', 'animo', 'casas']) H[k] = H[k].filter((_, i) => i % 2 === 0); for (const k of Object.keys(H.al)) H.al[k] = H.al[k].filter((_, i) => i % 2 === 0); H.paso *= 2; }
  }
  s._buena = false;
}
// la parte del día que es de cada aldea: comida, leña, animales
function diaAldea(s, A, f) {
  const R = A.res, G = gentes(s, A.id), e = f.est;
  for (const a of G) if (a.edad < 3) { const k = 0.8; if (R.comidas >= k) R.comidas -= k; else if (R.alimentos >= k) R.alimentos -= k; else { a.nec.salud -= 14; a.ultimoDano = 'hambre'; } }
  A.resMin = Math.min(reserva(s, A), (A.resMin ?? 10) + 0.4);   // memoria del hambre: la peor reserva reciente
  const gr = hay(s, 'granero', A.id), antes = R.alimentos + R.comidas;
  R.alimentos *= gr ? 0.988 : 0.968; R.comidas *= gr ? 0.975 : 0.95;
  const cap = capacidad(s, A), tot = R.alimentos + R.comidas; if (tot > cap) { const k = cap / tot; R.alimentos *= k; R.comidas *= k; }
  A.podrido = (A.podrido || 0) * 0.8 + (antes - R.alimentos - R.comidas);
  // leña: en invierno cada casa gasta bastante (y algo en otoño)
  if (e >= 2) {
    const casas = hechos(s, null, A.id).filter((b) => TIPOS[b.tipo].camas), nec = (casas.reduce((n, b) => n + (b.tipo === 'casa' ? 1.2 : 0.8), 0) + 2) * (e === 2 ? 0.3 : s.clima.duro ? 1.8 : 1);
    A.sinLena = e === 3 && R.madera < nec; R.madera = Math.max(0, R.madera - nec);
    if (A.sinLena && prob(s, 0.5)) log(s, `${A.nombre}: no queda leña y las casas pasan la noche heladas.`, 'malo');
  } else A.sinLena = false;
  // animales: crecen si los cuidan; si sobran, se carnean
  const cap2 = capAnimales(s, A);
  if (cap2) {
    const cuid = A.cuidados || 0; A.cuidados = 0;
    A.animales = clamp(A.animales + 0.07 * A.animales * (1 - A.animales / cap2) * (cuid > 1 ? 1 : 0.2) - (cuid < 0.5 && A.animales > 2 ? 0.25 : 0), 0, cap2);
    if (A.animales > cap2 * 0.85) { A.animales -= 1; R.alimentos += 14; }
    if (A.racion && A.animales > 3 && prob(s, 0.35)) { A.animales -= 1; R.alimentos += 14; }
  } else A.animales = 0;
  // comerciante si hay mercado: también se lleva la madera que sobra
  if (hay(s, 'plaza', A.id) && f.dia === 3 && prob(s, 0.6)) comerciante(s, A);
}
function nuevaEstacion(s, e) {
  const f = fecha(s);
  s.esp.influencia = Math.min(6, s.esp.influencia + 1 + (hay(s, 'templo') ? 1 : 0) * (s.esp.fe > 50 ? 1 : 0.5));
  if (e === 0) { log(s, `Llega la primavera del año ${f.anio}. Hay que sembrar.`, 'info'); s.clima.duro = false; }
  if (e === 1) log(s, 'Empieza el verano.', 'info');
  if (e === 2) {
    log(s, 'Llega el otoño: hay que juntar comida y leña para el invierno.', 'info');
    const ok = vivas(s).filter((A) => reserva(s, A) > 14 && gentes(s, A.id).length >= 3);
    if (ok.length) {
      const juntas = ok.length > 1 && ok.every((A) => ok.every((B) => A === B || lazo(s, A.id, B.id) > 30));
      s.fiesta = { hasta: s.t + 24 * 60, motivo: 'la cosecha', al: juntas || ok.length === vivas(s).length ? null : ok[0].id };
      log(s, juntas ? `Fiesta de la cosecha entre aldeas: ${ok.map((A) => A.nombre).join(' y ')} celebran juntas.` : `${ok.map((A) => A.nombre).join(' y ')} celebra${ok.length > 1 ? 'n' : ''} la fiesta de la cosecha.`, 'logro');
      if (juntas) for (const A of ok) for (const B of ok) if (A.id < B.id) cambiarLazo(s, A.id, B.id, 6);
    }
  }
  if (e === 3) { s.clima.duro = prob(s, 0.28); log(s, s.clima.duro ? 'Llega un invierno durísimo: más hambre, más frío y más leña.' : 'Llega el invierno.', s.clima.duro ? 'malo' : 'info'); if (s.clima.duro) hito(s, `Invierno duro del año ${f.anio}`); }
  if (e === 0 && f.anio > 1) log(s, `Balance del año ${f.anio - 1}: ${s.gente.length} habitantes en ${vivas(s).length} aldea${vivas(s).length > 1 ? 's' : ''}, ${hechos(s).length} construcciones.`, 'logro');
  inmigrantes(s);
}
function eventosDia(s, f) {
  const e = f.est, pob = s.gente.length, C = s.clima;
  if (C.sequia > 0) { C.sequia--; if (!C.sequia) { log(s, 'Por fin llueve: termina la sequía.', 'bueno'); C.lluvia = 10; } }
  else if (e === 1 && prob(s, 0.035)) { C.sequia = Math.round(ent(s, 5, 11)); log(s, 'Empieza una sequía: los campos se secan.', 'malo'); hito(s, `Sequía del año ${f.anio}`); }
  if (!C.sequia && prob(s, [0.35, 0.15, 0.3, 0.12][e])) C.lluvia = Math.round(ent(s, 3, 12));
  if (e === 3 && prob(s, 0.4)) C.nieve = Math.round(ent(s, 4, 14));
  if (e === 1 && f.dia === 4 && hechos(s, 'campo').length && prob(s, 0.16)) { s._buena = true; log(s, 'Los campos vienen cargados: ¡buena cosecha este año!', 'bueno'); }
  // enfermedad: más fácil con hacinamiento, hambre y sin pozo
  const hac = pob / Math.max(1, camas(s)), hambre = s.gente.filter((a) => a.nec.saciedad < 20).length / Math.max(1, pob);
  const pE = (0.008 + (hac > 1 ? 0.008 : 0) + hambre * 0.03 + (e === 3 ? 0.006 : 0) + pob * 0.0001) * (hay(s, 'pozo') ? 0.5 : 1);
  if (pob > 2 && prob(s, pE)) brote(s, 1 + Math.floor(rnd(s) * 2), 'Aparece una fiebre.');
  for (const a of s.gente) if (a.enf > 0) {
    a.enf = Math.max(0, a.enf - (tiene(a, 'robusto') ? 1.4 : 1)); if (a.enf <= 0) continue;
    for (const b of s.gente) if (b !== a && !b.enf && prob(s, (b.hogar === a.hogar && a.hogar != null ? 0.16 : b.al === a.al ? 0.7 / s.gente.length : 0.1 / s.gente.length) * (tiene(b, 'enfermizo') ? 2 : tiene(b, 'robusto') ? 0.4 : 1) * (hay(s, 'pozo', b.al) ? 0.6 : 1))) b.enf = Math.round(ent(s, 3, 7));
  }
  // incendio (más probable en sequía y con muchas casas de madera)
  const quema = hechos(s).filter((b) => !['muralla', 'pozo', 'fogata', 'campo', 'monumento', 'muelle'].includes(b.tipo));
  if (quema.length && prob(s, (0.0025 + quema.length * 0.0003) * (C.sequia ? 4 : 1) * (C.lluvia ? 0.2 : 1))) { const b = pick(s, quema); b.fuego = 6; b.dano = 0; log(s, `¡Fuego en ${s.aldeas[b.al].nombre}! Se incendia ${['casa', 'choza'].includes(b.tipo) ? 'una ' + TIPOS[b.tipo].n.toLowerCase() : elTipo(b.tipo)}.`, 'malo'); }
  if (e === 3 && prob(s, 0.05 * (s.fauna < 40 ? 1.6 : 1))) lobos(s);
  // bandidos a la aldea más rica
  const rica = vivas(s).map((A) => [A, A.res.alimentos + A.res.comidas + A.res.herramientas * 10]).sort((x, y) => y[1] - x[1])[0];
  if (rica && pob >= 9 && rica[1] > 160 && !s.amenaza && prob(s, 0.006 + pob * 0.00015)) {
    const A = rica[0], an = rnd(s) * 6.28, rr = Math.min(10, radioAldea(s, A) * 0.6);
    s.amenaza = { tipo: 'bandidos', al: A.id, x: A.x + Math.cos(an) * rr, z: A.z + Math.sin(an) * rr, hasta: s.t + 12 * 60, n: Math.round(4 + gentes(s, A.id).length * 0.2 + rnd(s) * 4) };
    log(s, `¡Una banda de ${s.amenaza.n} bandidos se acerca a ${A.nombre}!`, 'malo');
  }
  for (const a of s.gente) { const A = aldeaDe(s, a); if (tiene(a, 'ambicioso') && A.lider && A.lider !== a.id && a.edad >= 18 && prob(s, 0.06)) cambiarAf(s, a.id, A.lider, -4); }
}
function brote(s, n, txt) {
  const sanos = s.gente.filter((a) => !a.enf && a.edad >= 1);
  if (!sanos.length) return;
  for (let i = 0; i < n && sanos.length; i++) { const a = sanos.splice(Math.floor(rnd(s) * sanos.length), 1)[0]; a.enf = Math.round(ent(s, 4, 8)); }
  s.epidemia = 12;
  log(s, txt, 'malo');
}
function lobos(s) {
  const A = pick(s, vivas(s)); if (!A) return;
  const an = Math.atan2(A.z, A.x) + (rnd(s) - 0.5) * 2, R0 = Math.min(40, Math.hypot(A.x, A.z) + 14);
  s.lobos = { x: Math.cos(an) * R0, z: Math.sin(an) * R0, tx: A.x, tz: A.z, t: s.t, hasta: s.t + 5 * 60 };
  if (hay(s, 'muralla', A.id)) { log(s, `Los lobos aúllan toda la noche detrás de la empalizada de ${A.nombre}, pero no logran entrar.`, 'info'); return; }
  const r = rnd(s), G = gentes(s, A.id);
  if (A.animales >= 2 && r < 0.4) { const k = Math.min(A.animales, 1 + Math.floor(rnd(s) * 3)); A.animales -= k; log(s, `Los lobos entran al corral de ${A.nombre} y se llevan ${k} animal${k > 1 ? 'es' : ''}.`, 'malo'); A.ataques++; return; }
  if (r < 0.5) { log(s, `Una manada de lobos ronda ${A.nombre}; la fogata los mantiene lejos.`, 'info'); for (const a of G) if (a.edad > 4) recuerdo(s, a, 'lobos', 'Oyó a los lobos muy cerca', -4, 2); }
  else if (r < 0.88) { const v = pick(s, G.filter((a) => a.edad >= 3)); if (!v) return; v.nec.salud -= ent(s, 20, 40); v.ultimoDano = 'mordidas de lobo'; log(s, `Los lobos atacan a ${v.nombre}, que sale mal herid${g(v, 'o', 'a')}.`, 'malo'); vida(v, s, 'Lo atacaron los lobos'); A.ataques++; }
  else { const vul = G.filter((a) => a.hogar == null || a.edad < 8 || a.edad > 65); const v = vul.length ? pick(s, vul) : null; if (!v) return; v.nec.salud = -1; morir(s, v, 'atacad' + g(v, 'o', 'a') + ' por los lobos'); A.ataques++; hito(s, `Los lobos se llevan a ${v.nombre}`); }
}
function comerciante(s, A) {
  const R = A.res, out = [];
  if (R.madera > 120) { const q = Math.round(Math.min(R.madera - 80, 90)); R.madera -= q; R.herramientas += Math.round(q / 12); R.alimentos += Math.round(q * 0.9); out.push(`compra ${q} de madera a cambio de comida y herramientas`); }
  if (R.piedra > 60) { R.piedra -= 25; R.alimentos += 40; out.push('cambia piedra por comida'); }
  if (R.alimentos > 300) { R.alimentos -= 60; R.herramientas += 4; out.push('compra comida a cambio de herramientas'); }
  if (hay(s, 'corral', A.id) && A.animales < 4 && R.madera > 25) { R.madera -= 20; A.animales += 2; out.push('vende un par de cabras'); }
  if (!out.length) out.push('trae noticias de otras tierras');
  log(s, `Un comerciante pasa por la plaza de ${A.nombre} y ${out.join(', ')}.`, 'bueno');
  for (const a of gentes(s, A.id)) if (a.edad > 10) recuerdo(s, a, 'mercado', 'Hubo mercado en la plaza', 4, 2);
}

// ---------------------------------------------------------------- aldeas hijas y lazos entre aldeas
// cuando una aldea se llena (o no hay dónde construir), una pareja joven y con empuje se va a fundar otra
function fundar(s) {
  if (diaAbs(s) - (s.ultFund ?? -99) < DIAS_EST * 2 || est(s) === 3) return;
  for (const A of vivas(s)) {
    const G = gentes(s, A.id), pob = G.length, sinTecho = G.filter((a) => a.hogar == null && a.edad >= 3).length;
    const lleno = pob >= 38 || (pob >= 16 && (sinTecho >= 3 || A.sinSitio >= 3)) || (pob >= 24 && (A.lider && G.some((a) => tiene(a, 'ambicioso') && a.id !== A.lider && a.edad >= 20)));
    if (!lleno || vivas(s).length >= 5 || !prob(s, pob >= 38 ? 0.18 : 0.08)) continue;
    const ix = idx(s);
    const parejas = G.filter((a) => a.sexo === 'f' && a.edad >= 18 && a.edad <= 42 && ix.get(a.pareja)?.al === A.id).map((m) => [m, ix.get(m.pareja)])
      .filter(([, p]) => p.id !== A.lider && m0(p))
      .map((par) => [par, par.reduce((n, x) => n + (tiene(x, 'ambicioso') ? 3 : 0) + (tiene(x, 'aventurero') ? 3 : 0) + (x.hogar == null ? 2 : 0) + (x.nec.animo < 45 ? 1 : 0), 0) + rnd(s) * 2]).sort((x, y) => y[1] - x[1]);
    if (!parejas.length) continue;
    const sitio = sitioAldea(s); if (!sitio) { A.sinSitio = 0; continue; }
    const [m, p] = parejas[0][0], van = [m, p];
    for (const x of [m, p]) for (const id of x.hijos) { const h = ix.get(id); if (h && h.edad < 15 && h.al === A.id && !van.includes(h)) van.push(h); }
    // se les suman solteros inquietos o sin techo, y a veces otra pareja
    for (const x of G.filter((a) => !van.includes(a) && a.edad >= 17 && a.edad < 36 && !a.pareja && a.id !== A.lider && (tiene(a, 'aventurero') || tiene(a, 'ambicioso') || a.hogar == null || prob(s, 0.15))).slice(0, 2)) van.push(x);
    if (parejas[1] && prob(s, 0.4)) for (const x of parejas[1][0]) if (!van.includes(x)) { van.push(x); for (const id of x.hijos) { const h = ix.get(id); if (h && h.edad < 15 && h.al === A.id && !van.includes(h)) van.push(h); } }
    let B = s.aldeas.find((x) => x.vacia && dist(x.x, x.z, sitio.x, sitio.z) < 1);
    if (!B) { const usados = new Set(s.aldeas.map((x) => x.nombre)), l = NOMBRES_AL[sitio.tipo].filter((n) => !usados.has(n)); B = nuevaAldea(s, pick(s, l.length ? l : NOMBRES_AL.bosque.map((n) => n + ' Nuevo')), sitio.x, sitio.z, A.id); }
    B.vacia = false; B.madre = A.id; B.fundada = diaAbs(s); B.resMin = 10; B.sinSitio = 0;
    if (!fogata(s, B.id) || fogata(s, B.id).al !== B.id) nuevoEdificio(s, 'fogata', B.x, B.z, true, B.id);
    const madera = despejar(s, B.x, B.z, 7);
    // se llevan su parte de la despensa
    const k = Math.min(0.45, van.length / pob), RA = A.res, RB = B.res;
    for (const r of ['alimentos', 'comidas', 'herramientas', 'piedra']) { const q = RA[r] * k * 0.8; RA[r] -= q; RB[r] += q; }
    const qm = Math.min(RA.madera * 0.35, 60); RA.madera -= qm; RB.madera += qm + madera;
    for (const x of van) { mudar(s, x, B.id); x.ruta = ruta(s, x.x, x.z, B.x + ent(s, -3, 3), B.z + ent(s, -3, 3)); recuerdo(s, x, 'fundar', `Empezar de cero en ${B.nombre}`, 12, 8); vida(x, s, `Ayudó a fundar ${B.nombre}`); }
    for (const x of gentes(s, A.id)) if (van.some((v) => familia(v, x) || v.pareja === x.id || af(s, v.id, x.id) > 40)) recuerdo(s, x, 'idaHija', `Se fueron a fundar ${B.nombre}`, -6, 5);
    s.lazos[rk(A.id, B.id)] = 45; s.ultFund = diaAbs(s); s.cont.aldeas++;
    log(s, `${m.nombre} y ${p.nombre}${van.length > 2 ? ` con ${van.length - 2} más` : ''} dejan ${A.nombre} y fundan ${B.nombre}, ${{ lago: 'a orillas del lago', bosque: 'en el bosque', piedra: 'junto a la pedrera' }[sitio.tipo]}.`, 'logro');
    hito(s, `Fundación de ${B.nombre} (hija de ${A.nombre})`);
    elegirLider(s, B, 'fundacion'); asignarHogares(s); consejo(s, B);
    return;
  }
  function m0(p) { return p.edad >= 18 && p.edad <= 45; }
}
// sitio para una aldea nueva: lejos de las otras, cerca del lago, del bosque o de la piedra
function sitioAldea(s) {
  const vacia = s.aldeas.find((A) => A.vacia); if (vacia) return { x: vacia.x, z: vacia.z, tipo: dist(vacia.x, vacia.z, s.lago.x, s.lago.z) < 16 ? 'lago' : 'bosque' };
  const L = s.lago, tipos = ['lago', 'bosque', 'piedra'], quiere = pick(s, tipos);
  let mejor = null, mp = -1e9;
  for (let i = 0; i < 500; i++) {
    const a = rnd(s) * 6.28, rr = 16 + rnd(s) * 22, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.hypot(x, z) > 38.5 || dist(x, z, L.x, L.z) < L.r + 5 || dist(x, z, s.cementerio.x, s.cementerio.z) < 10) continue;
    if (s.rio.some(([px, pz]) => dist(x, z, px, pz) < 5) || s.rocas.some((o) => dist(x, z, o.x, o.z) < 4)) continue;
    if (s.aldeas.some((A) => dist(x, z, A.x, A.z) < (A.id === 0 ? 17 : 19))) continue;
    if (s.edificios.some((b) => b.tipo !== 'muralla' && dist(x, z, b.x, b.z) < 9) || s.edificios.some((b) => b.tipo === 'muralla' && dist(x, z, b.x, b.z) < b.radio + 5)) continue;
    const dl = Math.abs(dist(x, z, L.x, L.z) - (L.r + 8)), dp = Math.min(...s.rocas.map((o) => dist(x, z, o.x, o.z))), arb = s.arboles.filter((t) => t.c > 0.5 && dist(x, z, t.x, t.z) < 9).length;
    const pts = quiere === 'lago' ? -dl * 2 : quiere === 'piedra' ? -dp * 1.5 : arb * 0.8;
    if (pts > mp) { mp = pts; mejor = { x, z, tipo: quiere }; }
  }
  return mejor;
}
// comercio, ayuda en el hambre, rivalidad y disputas entre aldeas
function entreAldeas(s, f) {
  const V = vivas(s);
  for (const A of V) for (const B of V) {
    if (A.id >= B.id) continue;
    const k = rk(A.id, B.id); s.lazos[k] = Math.round((s.lazos[k] ?? 20) * 0.985 * 100) / 100;   // sin trato, los lazos se enfrían
    const LA = vivo(s, A.lider), LB = vivo(s, B.lider), lz = s.lazos[k];
    for (const [X, Y, LX] of [[A, B, LA], [B, A, LB]]) {
      // ayuda: si una raciona y la otra tiene de sobra, se le pide comida
      if (Y.racion && reserva(s, X) > 9 && s.t - (Y._pidio ?? -1e9) > DIAS_EST * MIN_DIA) {
        Y._pidio = s.t;
        const generosa = lz > -20 && !(LX && (tiene(LX, 'ambicioso') || tiene(LX, 'colerico')) && prob(s, 0.5));
        if (generosa || prob(s, 0.25)) {
          const q = Math.round(Math.min((X.res.alimentos + X.res.comidas) * 0.25, consumoDia(s, Y) * 5)); const qa = Math.min(q, X.res.alimentos); X.res.alimentos -= qa; X.res.comidas -= Math.min(q - qa, X.res.comidas); Y.res.alimentos += q;
          log(s, `${Y.nombre} pasa hambre y pide ayuda: ${X.nombre} le manda ${q} de comida.`, 'bueno'); cambiarLazo(s, X.id, Y.id, 10);
          for (const a of gentes(s, Y.id)) recuerdo(s, a, 'ayuda', `${X.nombre} nos ayudó en el hambre`, 6, 6);
        } else {
          log(s, `${X.nombre} le niega ayuda a ${Y.nombre}, que pasa hambre.${LX ? ` (${LX.nombre} dice que no les sobra nada.)` : ''}`, 'malo'); cambiarLazo(s, X.id, Y.id, -18);
          for (const a of gentes(s, Y.id)) recuerdo(s, a, 'espalda', `Los de ${X.nombre} nos dieron la espalda`, -8, 8);
        }
      }
      // trueque: madera o piedra que sobra por comida que falta
      if (lz > -30 && prob(s, 0.1)) {
        if (X.res.madera > 120 && Y.res.madera < 40 && reserva(s, Y) > 6) { X.res.madera -= 40; Y.res.madera += 40; const q = 25; Y.res.alimentos -= Math.min(q, Y.res.alimentos); X.res.alimentos += q; log(s, `Trueque: ${X.nombre} lleva 40 de madera a ${Y.nombre} a cambio de comida.`, 'info'); cambiarLazo(s, X.id, Y.id, 3); }
        else if (X.res.piedra > 60 && Y.res.piedra < 15) { X.res.piedra -= 25; Y.res.piedra += 25; X.res.madera += 15; Y.res.madera = Math.max(0, Y.res.madera - 15); log(s, `Trueque: ${X.nombre} cambia piedra por madera con ${Y.nombre}.`, 'info'); cambiarLazo(s, X.id, Y.id, 3); }
      }
    }
    // rivalidad: con lazos malos hay disputas (por la pesca, el bosque o un robo)
    if (lz < -35 && prob(s, 0.04)) {
      const ga = gentes(s, A.id).filter((a) => a.edad >= 16 && a.edad < 60), gb = gentes(s, B.id).filter((a) => a.edad >= 16 && a.edad < 60);
      if (ga.length && gb.length) {
        const motivo = pick(s, ['la pesca en el lago', 'los árboles del bosque', 'un animal que se perdió', 'una vieja ofensa']);
        const x = pick(s, ga), y = pick(s, gb); x.nec.salud -= ent(s, 8, 25); y.nec.salud -= ent(s, 8, 25); x.ultimoDano = y.ultimoDano = 'una disputa entre aldeas';
        log(s, `Disputa entre ${A.nombre} y ${B.nombre} por ${motivo}: ${x.nombre} y ${y.nombre} terminan a golpes.`, 'malo'); cambiarLazo(s, A.id, B.id, -8);
        for (const a of [...gentes(s, A.id), ...gentes(s, B.id)]) if (a.edad > 10) recuerdo(s, a, 'disputa', `Pleito con ${a.al === A.id ? B.nombre : A.nombre}`, -4, 4);
        if (lz < -60 && prob(s, 0.15)) { const v = pick(s, [x, y]); v.nec.salud = -1; morir(s, v, 'una disputa entre aldeas'); hito(s, `Sangre entre ${A.nombre} y ${B.nombre}`); }
      }
    }
    // reconciliación: líderes amables o mucha gente emparentada
    if (lz < 0 && LA && LB && (tiene(LA, 'amable') || tiene(LB, 'amable')) && prob(s, 0.03)) { cambiarLazo(s, A.id, B.id, 20); log(s, `${LA.nombre} y ${LB.nombre} se reúnen y hacen las paces entre ${A.nombre} y ${B.nombre}.`, 'bueno'); }
  }
}

// ---------------------------------------------------------------- vida familiar: parejas, hijos, muertes, herencias
function parejas(s) {
  const solos = s.gente.filter((a) => a.edad >= 16 && !vivo(s, a.pareja));
  for (const a of solos) {
    if (a.pareja && !vivo(s, a.pareja)) a.pareja = null;
    if (a.pareja || !prob(s, 0.25)) continue;
    const c = solos.filter((b) => b !== a && !b.pareja && !familia(a, b) && Math.abs(a.edad - b.edad) < 15 && (b.sexo !== a.sexo || prob(s, 0.06)));
    const mejor = c.sort((x, y) => af(s, a.id, y.id) - af(s, a.id, x.id))[0];
    if (!mejor) continue;
    const v = af(s, a.id, mejor.id);
    if ((v >= 32 && prob(s, 0.3)) || (v >= 8 && mejor.al === a.al && prob(s, 0.02))) emparejar(s, a, mejor);
  }
  for (const a of s.gente) { const b = vivo(s, a.pareja); if (b && a.id < b.id && af(s, a.id, b.id) < -20 && prob(s, 0.06)) { a.pareja = b.pareja = null; log(s, `${a.nombre} y ${b.nombre} se separan después de muchas peleas.`, 'malo'); for (const x of [a, b]) { recuerdo(s, x, 'separacion', 'Se separó', -16, 8); vida(x, s, `Se separó de ${x === a ? b.nombre : a.nombre}`); } } }
}
function nacimientos(s) {
  for (const A of vivas(s)) {
    const res = Math.min(reserva(s, A), A.resMin ?? 10), libres = camas(s, A.id) - gentes(s, A.id).length;   // si hace poco hubo hambre, se piensa dos veces tener hijos
    for (const m of gentes(s, A.id)) {
      if (m.sexo !== 'f' || m.emb > 0 || m.edad < 17 || m.edad > 42) continue;
      const p = vivo(s, m.pareja); if (!p || p.sexo !== 'm') continue;
      const hijos = m.hijos.filter((id) => vivo(s, id)).length;
      const pr = 0.026 * (tiene(m, 'fertil') || tiene(p, 'fertil') ? 1.7 : 1) * (res < 3 ? 0.1 : res < 6 ? 0.45 : 1) * (libres > 0 ? 1 : 0.2) * (m.nec.animo > 40 ? 1 : 0.4) / (1 + hijos * 0.6) * (m.edad > 36 ? 0.5 : 1);
      if (prob(s, pr)) { m.emb = 9; recuerdo(s, m, 'emb', 'Espera un bebé', 10, 9); recuerdo(s, p, 'emb', 'Va a ser papá', 8, 9); }
    }
  }
}
function parto(s, m) {
  const p = vivo(s, m.pareja) || persona(s, m.pareja), cur = hay(s, 'enfermeria', m.al) || gentes(s, m.al).some((a) => a !== m && (tiene(a, 'curandero') || a.hab.sanar > 40));
  const n = prob(s, 0.025) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const h = nuevaPersona(s, { edad: 0, apellido: p?.apellido || m.apellido, padres: [m.id, ...(p ? [p.id] : [])], x: m.x, z: m.z, al: m.al });
    m.hijos.push(h.id); if (p) p.hijos = p.hijos ? [...p.hijos, h.id] : [h.id];
    h.hogar = m.hogar; h._h = m.hogar;
    cambiarAf(s, h.id, m.id, 70); if (p) cambiarAf(s, h.id, p.id, 65);
    s.cont.nacimientos++;
    log(s, `Nace ${h.nombre}, ${g(h, 'hijo', 'hija')} de ${m.nombre}${p ? ` y ${p.nombre}` : ''}${s.aldeas.length > 1 ? ` (${s.aldeas[m.al].nombre})` : ''}.`, 'bueno');
    vida(h, s, `Nació, ${g(h, 'hijo', 'hija')} de ${m.nombre}${p ? ` y ${p.nombre}` : ''}`); vida(m, s, `Nació ${h.nombre}`); if (vivo(s, p?.id)) vida(p, s, `Nació ${h.nombre}`);
    if (prob(s, cur ? 0.012 : 0.035)) { h.nec.salud = -1; morir(s, h, 'complicaciones al nacer'); }
  }
  if (n === 2) log(s, '¡Fueron gemelos!', 'logro');
  for (const x of [m, vivo(s, p?.id)]) if (x) recuerdo(s, x, 'bebe', 'Tuvo un bebé', 16, 8);
  if (s.cont.nacimientos === 1) hito(s, 'Primer nacimiento en la aldea');
  if (prob(s, cur ? 0.008 : 0.025)) { m.nec.salud = -1; morir(s, m, 'el parto'); }
}
const registro = (s, x, extra) => ({ id: x.id, nombre: x.nombre, apellido: x.apellido, sexo: x.sexo, edad: +x.edad.toFixed(1), d: sello(s), rasgos: x.rasgos, padres: x.padres, hijos: x.hijos, pareja: x.pareja, ap: x.ap, vida: x.vida.slice(0, 6), aldea: s.aldeas[x.al]?.nombre, ...extra });
export function morir(s, a, causa) {
  if (!s.gente.includes(a)) return;
  s.gente = s.gente.filter((x) => x !== a);
  const ix = idx(s), A = aldeaDe(s, a);
  if (a.acc?.tipo === 'talar' && s.arboles[a.acc.ref]) s.arboles[a.acc.ref].o = 0;
  s.cont.muertes++;
  s.difuntos.unshift(registro(s, a, { causa, anio: fecha(s).anio, estado: 'muerto' }));
  if (s.difuntos.length > 220) s.difuntos.length = 220;
  // tumba en el cementerio (filas que se van llenando; las más viejas se borran con el tiempo)
  const C = s.cementerio, i = s.cont.muertes - 1, fila = Math.floor((i % 48) / 8), col = i % 8, ang = C.ang, ux = -Math.sin(ang), uz = Math.cos(ang), vx = -Math.cos(ang), vz = -Math.sin(ang);
  s.tumbas = s.tumbas.filter((t) => t.i % 48 !== i % 48);
  s.tumbas.push({ i, x: +(C.x + ux * (col - 3.5) * 1.3 + vx * (fila - 2.5) * 1.6).toFixed(2), z: +(C.z + uz * (col - 3.5) * 1.3 + vz * (fila - 2.5) * 1.6).toFixed(2), nombre: a.nombre, id: a.id });
  log(s, `Muere ${a.nombre} ${a.apellido} a los ${Math.floor(a.edad)} años (${causa})${s.aldeas.length > 1 ? `, en ${A.nombre}` : ''}.`, causa === 'vejez' ? 'info' : 'malo');
  // duelo
  for (const b of s.gente) {
    const v = af(s, a.id, b.id), cercano = b.id === a.pareja || a.hijos.includes(b.id) || a.padres.includes(b.id);
    if (b.id === a.pareja) { recuerdo(s, b, 'duelo', `Extraña a ${a.nombre}, su pareja`, -28, 12); b.pareja = null; vida(b, s, `Enviudó: murió ${a.nombre}`); }
    else if (cercano) { recuerdo(s, b, 'duelo', `Llora a ${a.nombre}`, -22, 10); vida(b, s, `Murió ${a.nombre}`); }
    else if (v > 35) recuerdo(s, b, 'duelo', `Extraña a ${a.nombre}`, -10, 5);
    else if (b.edad > 6 && b.al === a.al && causa !== 'vejez') recuerdo(s, b, 'luto', 'La aldea está de luto', -3, 2);
  }
  // herencia: a la pareja o repartida entre los hijos vivos
  const her = [ix.get(a.pareja), ...a.hijos.map((id) => ix.get(id))].filter(Boolean);
  if (a.bienes > 1 && her.length) { const pareja = ix.get(a.pareja); if (pareja) pareja.bienes += a.bienes; else for (const h of her) h.bienes += a.bienes / her.length; if (a.bienes > 15) log(s, `${her.length === 1 || pareja ? (pareja || her[0]).nombre + ' hereda' : her.map((h) => h.nombre).join(' y ') + ' heredan'} lo que tenía ${a.nombre}.`, 'info'); }
  for (const m of [s.rel, s.relHito || {}]) for (const k of Object.keys(m)) { const [x, y] = k.split('-').map(Number); if (x === a.id || y === a.id) delete m[k]; }
  if (A.lider === a.id) { log(s, `${A.nombre} se queda sin líder.`, 'malo'); A.lider = null; }
  if (s.difuntos.length === 1) hito(s, `Primera muerte: ${a.nombre}`);
  asignarHogares(s);
}
function partidas(s) {
  for (const a of [...s.gente]) {
    if (a.edad < 16 || !s.gente.includes(a)) continue;
    a.triste = a.nec.animo < 28 ? a.triste + 1 : Math.max(0, a.triste - 2);
    const aventura = tiene(a, 'aventurero') && !a.pareja && a.edad < 40 && prob(s, 0.004);
    if (!((a.triste >= 3 && prob(s, 0.12)) || aventura)) continue;
    const ix = idx(s), p = ix.get(a.pareja), van = [a], A = aldeaDe(s, a);
    // si hay otra aldea a la que le va mejor, se muda allá en vez de irse del orbe
    const otra = !aventura && vivas(s).filter((B) => B.id !== a.al && reserva(s, B) > 6 && lazo(s, a.al, B.id) > -20 && camas(s, B.id) - gentes(s, B.id).length > 1).sort((x, y) => reserva(s, y) - reserva(s, x))[0];
    if (p && (p.nec.animo < 50 || prob(s, 0.6))) van.push(p);
    for (const x of [...van]) for (const id of x.hijos) { const h = ix.get(id); if (h && h.edad < 15 && !van.includes(h)) van.push(h); }
    if (otra) {
      for (const x of van) { if (!s.gente.includes(x)) continue; mudar(s, x, otra.id); recuerdo(s, x, 'mudanza', `Se mudó a ${otra.nombre} buscando una vida mejor`, 6, 6); vida(x, s, `Se mudó de ${A.nombre} a ${otra.nombre}`); }
      log(s, `${a.nombre}${van.length > 1 ? ` y ${van.length - 1} más se mudan` : ' se muda'} de ${A.nombre} a ${otra.nombre}: allá les va mejor.`, 'info'); s.cont.mudanzas = (s.cont.mudanzas || 0) + van.length;
      if (p && !van.includes(p)) { p.pareja = null; a.pareja = null; }
      break;
    }
    for (const x of van) { s.gente = s.gente.filter((y) => y !== x); s.idos.unshift(registro(s, x, { estado: 'se fue', causa: aventura ? 'buscar aventuras' : 'era infeliz' })); if (x.acc?.tipo === 'talar' && s.arboles[x.acc.ref]) s.arboles[x.acc.ref].o = 0; }
    if (s.idos.length > 120) s.idos.length = 120;
    if (p && !van.includes(p)) { p.pareja = null; recuerdo(s, p, 'abandono', `${a.nombre} se fue sin ${g(p, 'él', 'ella')}`, -24, 10); }
    s.cont.partidas += van.length;
    log(s, aventura ? `${a.nombre} se despide: quiere ver qué hay más allá del cristal.` : `${a.nombre}${van.length > 1 ? ` y ${van.length - 1} más se van` : ' se va'} de ${A.nombre}: ${A.racion ? 'ahí ya no hay qué comer' : 'ya no era feliz'}.`, aventura ? 'info' : 'malo');
    for (const b of s.gente) if (af(s, a.id, b.id) > 30) recuerdo(s, b, 'ida', `Extraña a ${a.nombre}`, -8, 5);
    for (const x of van) for (const k of Object.keys(s.rel)) { const [i, j] = k.split('-').map(Number); if (i === x.id || j === x.id) delete s.rel[k]; }
    if (van.some((x) => x.id === A.lider)) { A.lider = null; log(s, `${A.nombre} se queda sin líder: se fue con ellos.`, 'malo'); }
    break;   // una partida por día: el éxodo se ve llegar, no ocurre de golpe
  }
}
function inmigrantes(s, forzar = 0) {
  const pob = s.gente.length, V = vivas(s);
  if (!pob && !forzar) return;
  const A = V.length ? V.map((x) => [x, camas(s, x.id) - gentes(s, x.id).length + reserva(s, x) * 0.2]).sort((x, y) => y[1] - x[1])[0][0] : s.aldeas[0];
  const libres = camas(s, A.id) - gentes(s, A.id).length, an0 = pob ? s.gente.reduce((n, a) => n + a.nec.animo, 0) / pob : 50;
  let p = 0.07 + (an0 > 60 ? 0.14 : 0) + (Math.min(reserva(s, A), A.resMin ?? 10) > 8 ? 0.08 : -0.05) + (hay(s, 'plaza', A.id) ? 0.1 : 0) - (libres < 2 ? 0.25 : 0);
  p *= Math.max(0, 1 - pob / 120);
  if (pob < 3) p = 0.6;
  if (!forzar && !prob(s, p)) return;
  if (A.vacia) { A.vacia = false; A.resMin = 10; }
  const n = forzar || (prob(s, 0.45) ? 1 : prob(s, 0.5) ? 2 : 3), ap = pick(s, APELLIDOS), nuevos = [];
  const an = Math.atan2(A.z, A.x) + (rnd(s) - 0.5), x = Math.cos(an) * 41, z = Math.sin(an) * 41;
  if (n === 1) nuevos.push(nuevaPersona(s, { edad: ent(s, 17, 38), x, z, al: A.id }));
  else {
    const m = nuevaPersona(s, { sexo: 'm', edad: ent(s, 20, 38), apellido: ap, x, z, al: A.id }), f = nuevaPersona(s, { sexo: 'f', edad: ent(s, 19, 36), apellido: ap, x, z, al: A.id });
    emparejar(s, m, f, true); nuevos.push(m, f);
    if (n >= 3) { const h = nuevaPersona(s, { edad: ent(s, 1, 10), apellido: ap, padres: [m.id, f.id], x, z, al: A.id }); m.hijos.push(h.id); f.hijos.push(h.id); cambiarAf(s, h.id, m.id, 70); cambiarAf(s, h.id, f.id, 70); nuevos.push(h); }
  }
  if (!pob) { A.res.alimentos += 40; A.res.madera += 20; A.res.herramientas += 3; }   // los errantes traen algo
  for (const a of nuevos) { a.llego = diaAbs(s); vida(a, s, `Llegó a ${A.nombre}`); a.nec.saciedad = 45; }
  s.cont.llegadas += nuevos.length; s.extinta = false;
  log(s, n === 1 ? `Llega ${nuevos[0].nombre} ${nuevos[0].apellido} a ${A.nombre}, buscando un lugar donde quedarse.` : `Llega la familia ${ap} a ${A.nombre}: ${nuevos.map((a) => a.nombre).join(', ')}.`, 'bueno');
  if (s.cont.llegadas === nuevos.length) hito(s, 'Llegan los primeros forasteros');
  if (!A.lider || !vivo(s, A.lider)) elegirLider(s, A, 'vacante');
  asignarHogares(s);
}
// sin nadie en el orbe: errantes con tope; si no llegan, la historia termina con un resumen
function finSiVacia(s) {
  if (s.gente.length) return;
  for (const A of s.aldeas) if (!A.vacia) { A.vacia = true; A.lider = null; }
  if (!s.extinta) { s.extinta = true; s.vaciaDesde = diaAbs(s); log(s, 'No queda nadie. El viento apaga las fogatas.', 'malo'); hito(s, 'El orbe queda vacío'); }
}
function diaVacio(s) {
  finSiVacia(s);
  if (s.fin) return;
  const f = fecha(s);
  if (f.dia === 1 && s.refundaciones < 2 && prob(s, 0.5)) { s.refundaciones++; inmigrantes(s, 2 + (prob(s, 0.5) ? 1 : 0)); log(s, 'Unos errantes encuentran las casas vacías y deciden quedarse.', 'logro'); hito(s, 'Llegan errantes a las ruinas'); return; }
  if (s.refundaciones >= 2 || diaAbs(s) - (s.vaciaDesde ?? diaAbs(s)) > DIAS_ANIO * 2) {
    s.fin = true;
    const r = s.cont;
    s.resumenFin = { anios: f.anio, maxPob: s.maxPob, ...r };
    log(s, `Fin de la historia: ${f.anio} años, ${r.nacimientos} nacimientos, ${r.muertes} muertes, ${r.aldeas} aldea${r.aldeas > 1 ? 's' : ''} fundada${r.aldeas > 1 ? 's' : ''}, hasta ${s.maxPob} habitantes a la vez.`, 'logro');
    hito(s, 'Fin de la historia');
  }
}

// ---------------------------------------------------------------- líderes (uno por aldea)
function elegirLider(s, A, motivo) {
  const cand = gentes(s, A.id).filter((a) => a.edad >= 18);
  if (!cand.length) { A.lider = null; return; }
  const votantes = gentes(s, A.id).filter((v) => v.edad >= 15);
  const votos = (c) => votantes.reduce((n, v) => n + (v === c ? 0 : af(s, v.id, c.id) * 0.5), 0) + c.hab.liderar * 0.6 + (tiene(c, 'sociable') ? 8 : 0) + (tiene(c, 'ambicioso') ? 10 : 0) + (tiene(c, 'amable') ? 5 : 0) - (tiene(c, 'colerico') ? 6 : 0) + (c.id === A.lider ? 6 : 0) + (c.edad > 25 && c.edad < 62 ? 5 : 0) + rnd(s) * 6;
  const gana = cand.map((c) => [c, votos(c)]).sort((x, y) => y[1] - x[1])[0][0], antes = A.lider;
  A.lider = gana.id; A.mandato = diaAbs(s) + 3 * DIAS_ANIO;
  if (antes !== gana.id) {
    s.cont.lideres++;
    log(s, motivo === 'fundacion' ? `${gana.nombre} queda al frente de ${A.nombre}.` : `${gana.nombre} ${gana.apellido} es ${g(gana, 'el nuevo líder', 'la nueva líder')} de ${A.nombre}.`, 'logro');
    if (A.id === 0 || motivo === 'fundacion' || gentes(s, A.id).length >= 12) hito(s, `${gana.nombre} ${gana.apellido}, líder de ${A.nombre}`);
    vida(gana, s, `Fue elegid${g(gana, 'o', 'a')} líder de ${A.nombre}`);
    recuerdo(s, gana, 'lider', 'Lo eligieron para guiar la aldea', 14, 10);
    for (const a of cand) if (a !== gana && tiene(a, 'ambicioso')) { recuerdo(s, a, 'envidia', `Le duele que eligieran a ${gana.nombre}`, -8, 6); cambiarAf(s, a.id, gana.id, -6); }
  } else if (motivo === 'mandato') log(s, `${gana.nombre} sigue al frente de ${A.nombre} otros tres años.`, 'info');
}
function golpe(s, A) {
  const L = vivo(s, A.lider), G = gentes(s, A.id); if (!L || G.length < 6) return;
  const pop = (c) => { const v = G.filter((x) => x !== c && x.edad >= 15); return v.reduce((n, x) => n + af(s, x.id, c.id), 0) / Math.max(1, v.length); };
  if (pop(L) > -12) return;
  const r = G.filter((a) => a !== L && a.edad >= 18 && tiene(a, 'ambicioso')).sort((x, y) => pop(y) - pop(x))[0];
  if (!r || pop(r) <= pop(L) || !prob(s, 0.08)) return;
  log(s, `En ${A.nombre} la gente está harta de ${L.nombre}: ${r.nombre} ${g(L, 'lo', 'la')} desplaza y toma el mando.`, 'malo');
  recuerdo(s, L, 'derrocado', 'Lo quitaron del mando', -22, 10); vida(L, s, 'Lo quitaron del mando'); cambiarAf(s, L.id, r.id, -40);
  A.lider = r.id; A.mandato = diaAbs(s) + 3 * DIAS_ANIO; s.cont.lideres++;
  hito(s, `${r.nombre} toma el mando de ${A.nombre} por la fuerza`); vida(r, s, 'Tomó el mando de la aldea');
}

// ---------------------------------------------------------------- poderes del espíritu del orbe (influencia limitada)
export const PODERES = {
  lluvia: { n: 'Lluvia', costo: 2, d: 'Termina una sequía y riega los campos.' },
  bendicion: { n: 'Bendición', costo: 2, d: 'Alegra y sana a todos; cura la mitad de los enfermos.' },
  abundancia: { n: 'Abundancia', costo: 1, d: 'Llena el bosque de presas, el lago de peces y los arbustos de bayas.' },
  inspirar: { n: 'Inspirar', costo: 1, d: 'La persona elegida aprende de golpe y se llena de ánimo.' },
  rayo: { n: 'Rayo', costo: 1, d: 'Un rayo cae sobre una aldea… y algo arde.' },
  plaga: { n: 'Plaga', costo: 1, d: 'Una fiebre se extiende entre la gente.' },
  errantes: { n: 'Llamar errantes', costo: 3, d: 'Guía a unos viajeros hasta la aldea (también si quedó vacía).' },
};
export function usarPoder(s, k, objetivo = null) {
  const P = PODERES[k]; if (!P || s.esp.influencia < P.costo) return 'No te alcanza la influencia.';
  const piad = s.gente.filter((a) => tiene(a, 'piadoso'));
  if (k === 'inspirar') { const a = vivo(s, objetivo); if (!a) return 'Toca primero a una persona.'; const top = Object.keys(a.hab).sort((x, y) => a.hab[y] - a.hab[x])[0]; a.hab[top] = clamp(a.hab[top] + 15); recuerdo(s, a, 'inspirado', 'Sintió la mano del espíritu', 20, 6); log(s, `${a.nombre} despierta inspirad${g(a, 'o', 'a')}: siente que el espíritu del orbe l${g(a, 'o', 'a')} eligió.`, 'logro'); vida(a, s, 'El espíritu del orbe l' + g(a, 'o', 'a') + ' inspiró'); }
  if (k === 'lluvia') { s.clima.sequia = 0; s.clima.lluvia = 14; for (const b of s.edificios) if (b.campo?.e === 'sembrado') b.campo.c = Math.min(0.99, b.campo.c + 0.12); log(s, 'Las nubes se abren sobre el orbe: llueve.', 'bueno'); }
  if (k === 'bendicion') { for (const a of s.gente) { a.nec.salud = clamp(a.nec.salud + 25); recuerdo(s, a, 'bendicion', 'Se siente bendecid' + g(a, 'o', 'a'), 14, 4); if (a.enf > 0 && prob(s, 0.5)) a.enf = 0; } log(s, 'Una luz tibia cubre el orbe: el espíritu bendice a su gente.', 'logro'); }
  if (k === 'abundancia') { s.fauna = clamp(s.fauna + 45); s.peces = clamp(s.peces + 45); for (const b of s.arbustos) b.b = 8; log(s, 'El bosque se llena de venados y los arbustos se doblan de bayas.', 'bueno'); }
  if (k === 'rayo') { const l = hechos(s).filter((b) => !['muralla', 'pozo', 'fogata', 'campo', 'muelle'].includes(b.tipo)); if (l.length) { const b = pick(s, l); b.fuego = 7; b.dano = 0; log(s, `¡Un rayo cae sobre ${elTipo(b.tipo)} de ${s.aldeas[b.al].nombre} y prende fuego!`, 'malo'); } else { const t = s.arboles.find((x) => x.c > 0.8); if (t) t.c = 0; log(s, 'Un rayo parte un árbol en dos.', 'info'); } for (const a of s.gente) recuerdo(s, a, 'miedo', 'El cielo está furioso', -6, 3); }
  if (k === 'plaga') brote(s, 3, 'Una fiebre extraña cae sobre el orbe.');
  if (k === 'errantes') { s.fin = false; inmigrantes(s, 2 + (prob(s, 0.5) ? 1 : 0)); }
  s.esp.influencia -= P.costo;
  // los piadosos leen las señales: los buenos dones aumentan la fe, los castigos el temor (que también es fe)
  s.esp.fe = clamp(s.esp.fe + (['rayo', 'plaga'].includes(k) ? 3 : 6) + piad.length);
  for (const a of piad) recuerdo(s, a, 'senal', ['rayo', 'plaga'].includes(k) ? 'Teme la ira del espíritu' : 'El espíritu nos escucha', ['rayo', 'plaga'].includes(k) ? -4 : 10, 4);
  return null;
}

// ---------------------------------------------------------------- consultas para la interfaz
export function resumen(s, al = null) {
  const g0 = al == null ? s.gente : gentes(s, al), pob = g0.length, A = s.aldeas[al ?? 0];
  return {
    pob, adultos: g0.filter((a) => a.edad >= 15 && a.edad < 62).length, ninos: g0.filter((a) => a.edad < 15).length, ancianos: g0.filter((a) => a.edad >= 62).length,
    camas: camas(s, al ?? undefined), sinTecho: g0.filter((a) => a.hogar == null).length, animo: pob ? Math.round(g0.reduce((n, a) => n + a.nec.animo, 0) / pob) : 0,
    salud: pob ? Math.round(g0.reduce((n, a) => n + a.nec.salud, 0) / pob) : 0, enfermos: g0.filter((a) => a.enf > 0).length, reserva: reserva(s, A), capacidad: capacidad(s, A),
    lider: vivo(s, A.lider), obras: s.edificios.filter((b) => !b.hecho && (al == null || b.al === al)), hechos: hechos(s, null, al ?? undefined).length, aldeas: vivas(s).length,
  };
}
const ROLES = { recolectar: ['Recolector', 'Recolectora'], cazar: ['Cazador', 'Cazadora'], pescar: ['Pescador', 'Pescadora'], cultivar: ['Campesino', 'Campesina'], pastorear: ['Pastor', 'Pastora'], talar: ['Leñador', 'Leñadora'], picar: ['Cantero', 'Cantera'], construir: ['Constructor', 'Constructora'], cocinar: ['Cocinero', 'Cocinera'], forjar: ['Artesano', 'Artesana'], carpinteria: ['Carpintero', 'Carpintera'], sanar: ['Curandero', 'Curandera'] };
// el oficio es lo que más horas ha hecho (se ve cómo cada quien se especializa)
export function rolDe(a) {
  if (a.edad < 3) return 'Bebé'; if (a.edad < 15) return g(a, 'Niño', 'Niña');
  const t = Object.entries(a.horas || {}).sort((x, y) => y[1] - x[1])[0];
  return (t ? ROLES[t[0]][a.sexo === 'f' ? 1 : 0] : 'Sin oficio') + (a.edad >= 62 ? g(a, ' (anciano)', ' (anciana)') : '');
}
export function haciendo(s, a) { const c = a.acc; if (!c) return 'Pensando qué hacer'; let T = ACCIONES[c.tipo] || c.tipo; if (c.tipo === 'visitar') T = `Visita ${s.aldeas[c.ref]?.nombre || 'otra aldea'}`; return a.ruta.length ? `Va a: ${T.toLowerCase()}` : T; }
export function porQue(s, a) { return a.acc?.porque || ''; }
export function pensamiento(s, a) {
  const n = a.nec, o = g(a, 'o', 'a'), A = aldeaDe(s, a);
  if (a.edad < 3) return '¡Ba-ba!';
  if (n.salud < 30) return 'Me duele todo… no sé si salga de esta.';
  if (a.enf > 0) return 'Tengo fiebre. Ojalá alguien me cuide.';
  if (n.saciedad < 18) return 'Me muero de hambre.';
  if (A.racion) return 'Hay que apretarse el cinturón hasta la próxima cosecha.';
  if (a.hogar == null && est(s) === 3) return 'Qué frío… necesito un techo.';
  if (s.amenaza?.tipo === 'bandidos' && s.amenaza.al === a.al) return tiene(a, 'cobarde') ? 'Que no me vean, que no me vean…' : '¡Fuera de nuestra aldea!';
  if (s.edificios.some((b) => b.fuego > 0 && b.al === a.al)) return '¡Agua, traigan agua!';
  const m = [...a.mem].sort((x, y) => Math.abs(y.v) - Math.abs(x.v))[0];
  if (m && Math.abs(m.v) >= 10) return m.v < 0 ? `${m.txt}…` : `${m.txt}. ¡Qué bien!`;
  if (n.energia < 20) return 'Estoy rendid' + o + '.';
  if (n.social < 25) return tiene(a, 'solitario') ? 'Un poco de compañía no me caería mal.' : `Me siento sol${o}. ¿Nadie quiere conversar?`;
  if (tiene(a, 'ambicioso') && A.lider !== a.id && a.edad >= 18) return gentes(s, a.al).length > 30 ? 'Aquí ya no cabemos. Yo podría fundar mi propia aldea.' : 'Yo guiaría mejor esta aldea.';
  if (A.lider === a.id && A.meta) return `Necesitamos ${A.meta.madera > 0 ? 'madera' : 'piedra'} para ${elTipo(A.meta.tipo)}.`;
  if (s.fauna < 15 && a.acc?.tipo === 'cazar') return 'Antes había venados por todas partes…';
  if (n.animo > 75) return tiene(a, 'piadoso') ? 'El espíritu del orbe nos cuida.' : a.pareja ? `Qué suerte tener a ${vivo(s, a.pareja)?.nombre || 'mi gente'}.` : 'Qué buen día.';
  if (n.animo < 30) return tiene(a, 'aventurero') ? 'A veces pienso en irme lejos.' : 'Nada me sale bien.';
  if (a.edad < 13) return ['¿Quién juega conmigo?', 'Cuando sea grande voy a cazar lobos.', '¿Por qué el cielo es de cristal?'][a.id % 3];
  return a.acc && TRAB[a.acc.tipo] ? 'Hay que trabajar.' : 'Todo tranquilo.';
}
// relaciones de una persona, de la más fuerte a la más débil
export function relacionesDe(s, id, n = 8) {
  const out = [];
  for (const [k, v] of Object.entries(s.rel)) { const [x, y] = k.split('-').map(Number); if (x !== id && y !== id) continue; const o = vivo(s, x === id ? y : x); if (o) out.push({ p: o, v }); }
  return out.sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, n);
}
export function parentesco(s, a, b) {
  if (a.pareja === b.id) return 'pareja';
  if (a.padres.includes(b.id)) return b.sexo === 'f' ? 'madre' : 'padre';
  if (b.padres.includes(a.id)) return b.sexo === 'f' ? 'hija' : 'hijo';
  if (a.padres.some((p) => b.padres.includes(p))) return b.sexo === 'f' ? 'hermana' : 'hermano';
  return null;
}
export function guardar(s) { return s; }
// carga (y convierte las partidas de la versión 1, que tenían una sola aldea)
export function cargar(o) {
  if (!o || o.mundo !== 'aldea' || !Array.isArray(o.gente)) return null;
  if (o.version === 1) {
    o.aldeas = [{ id: 0, nombre: 'Valle Hondo', x: 0, z: 0, madre: null, fundada: 0, res: o.res, meta: o.meta, lider: o.lider, mandato: o.mandato, resMin: o.resMin ?? 10, racion: !!o._racion, podrido: o._podrido || 0, sinLena: !!o._sinLena, sinSitio: 0, animales: 0, ataques: o.ataques || 0, vacia: false }];
    for (const k of ['res', 'meta', 'lider', 'mandato', 'resMin', '_racion', '_podrido', '_sinLena', '_cocinero', 'ataques', 'ultimaMuerte']) delete o[k];
    for (const a of o.gente) { a.al = 0; a.hab.criar ??= Math.round(a.hab.cultivar * 0.4); }
    for (const b of o.edificios) { b.al = 0; if (b.tipo === 'casa') { b.nivel ??= 0; b.mej ??= 0; } if (b.tipo === 'muralla') { b.x = 0; b.z = 0; } }
    for (const a of o.gente) for (const k of Object.keys(TRAB)) a.gusto[k] ??= 1;
    o.lazos = {}; o.cont.aldeas = 1; o.refundaciones = 0; o.fin = false; o.maxPob = o.gente.length; o.hist.al = { 0: [...o.hist.pob] };
    if (o.amenaza) o.amenaza.al = 0;
    o.version = 2;
  }
  return o.version === VERSION ? o : null;
}
