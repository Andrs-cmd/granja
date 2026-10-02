// =====================================================================
// Motor de simulación de la granja (lógica pura, sin Three.js).
// El estado es un objeto JSON serializable: se guarda tal cual en localStorage.
// Unidad de tiempo: 1 minuto de juego. Coordenadas: las mismas de la escena (x, z).
// =====================================================================

export const MIN_DIA = 1440;
export const DIAS_ESTACION = 28;
export const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
export const TANQUE_MAX = 600;          // litros de agua cruda
export const VERSION = 1;

export const CULTIVOS = {
  lechuga: { nombre: 'Lechuga', dias: 7, raciones: 6, semillas: [1, 2], estaciones: [0, 2] },
  papa: { nombre: 'Papa', dias: 14, raciones: 14, semillas: [1, 2], estaciones: [0, 1, 2] },
  frijol: { nombre: 'Fríjol', dias: 12, raciones: 10, semillas: [1, 3], estaciones: [0, 1] },
  maiz: { nombre: 'Maíz', dias: 18, raciones: 20, semillas: [1, 2], estaciones: [1] },
};

// lugares de la escena
export const LUGAR = {
  puerta: { x: -2.4, z: 7.0 },
  pozo: { x: -6.3, z: 10.6 },
  tanque: { x: 8.6, z: 8.8 },
  comedero: { x: -0.4, z: 7.6 },
  banca: { x: 3.0, z: 12.3 },
  caseta: { x: -7.4, z: 3.0 },
};
export const PARCELAS = [
  { x: -1.3, z: 16.7 }, { x: 3.0, z: 16.7 }, { x: 7.3, z: 16.7 },
  { x: -1.3, z: 19.5 }, { x: 3.0, z: 19.5 }, { x: 7.3, z: 19.5 },
];

const RASGOS = {
  fuerte: { nombre: 'Fuerte', desc: 'Saca 50 % más agua del pozo.' },
  comilon: { nombre: 'Comilón', desc: 'Le da hambre 20 % más rápido.' },
  manoVerde: { nombre: 'Mano verde', desc: 'Siembra, riega y cosecha 40 % más rápido; cosecha 15 % más.' },
  ahorradora: { nombre: 'Ahorradora', desc: 'Le da hambre 15 % más lento.' },
  leal: { nombre: 'Leal', desc: 'Sigue a la pareja a todas partes.' },
  cazador: { nombre: 'Cazador', desc: 'Caza ratones en el huerto cuando tiene hambre.' },
};
export { RASGOS };

// ---------------------------------------------------------------- azar reproducible
function rng(s) {
  s.rng = (s.rng + 0x6D2B79F5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- utilidades de tiempo
export const dia = (s) => Math.floor(s.t / MIN_DIA);
export const hora = (s) => (s.t % MIN_DIA) / 60;
export const estacion = (s) => Math.floor(dia(s) / DIAS_ESTACION) % 4;
export const anio = (s) => Math.floor(dia(s) / (DIAS_ESTACION * 4)) + 1;
export const diaEstacion = (s) => (dia(s) % DIAS_ESTACION) + 1;
export function fechaTxt(s) {
  const h = hora(s), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `Año ${anio(s)} · ${ESTACIONES[estacion(s)]} ${diaEstacion(s)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
const esNoche = (s) => { const h = hora(s); return h >= 22 || h < 6; };

// ---------------------------------------------------------------- partida nueva
function agente(id, tipo, nombre, rasgos, pos) {
  return {
    id, tipo, nombre, rasgos, vivo: true, pos: { ...pos }, dentro: tipo === 'humano',
    n: { comida: 85, agua: 85, energia: 90, salud: 100 },
    tarea: null, accion: 'Descansando', murio: null,
  };
}

export function nuevaPartida(semilla = Date.now()) {
  const s = {
    version: VERSION, rng: semilla | 0,
    t: 6 * 60,                                     // día 0, 06:00
    clima: { lluvia: false, lluviaHasta: 0, lluviaHoy: null },
    rec: { potable: 30, cruda: 120, raciones: 45, comedero: 2, bebedero: 6, semillas: { lechuga: 8, papa: 6, frijol: 6, maiz: 4 } },
    parcelas: PARCELAS.map((p, i) => ({ id: i, x: p.x, z: p.z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null })),
    agentes: [
      agente('tomas', 'humano', 'Tomás', ['fuerte', 'comilon'], LUGAR.puerta),
      agente('lucia', 'humano', 'Lucía', ['manoVerde', 'ahorradora'], LUGAR.puerta),
      agente('nube', 'perro', 'Nube', ['leal'], LUGAR.caseta),
      agente('esmoquin', 'gato', 'Esmoquin', ['cazador'], LUGAR.banca),
    ],
    ordenes: [],
    nextId: 1,
    permanentes: { regar: true, cosechar: true, resembrar: null, limpiar: true, potableMin: 25, tanqueMin: 150, animales: true },
    diario: [],
    stats: { cosechas: 0, raciones: 0, litrosPozo: 0, litrosLluvia: 0 },
    fin: null,
  };
  // el huerto ya viene empezado: dos lechugas a medio crecer y una papa recién brotada
  Object.assign(s.parcelas[0], { cultivo: 'lechuga', crec: 3, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[3], { cultivo: 'lechuga', crec: 2, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[1], { cultivo: 'papa', crec: 4, estado: 'creciendo', agua: 80 });
  log(s, 'Tomás, Lucía, Nube y Esmoquin empiezan su vida en la granja. La despensa alcanza para una semana o dos: ¡a sembrar!', 'info');
  decidirClima(s);
  return s;
}

export function log(s, texto, tipo = 'info') {
  s.diario.unshift({ t: s.t, texto, tipo });
  if (s.diario.length > 250) s.diario.length = 250;
}

// ---------------------------------------------------------------- órdenes del jugador
export const TIPOS_ORDEN = {
  sembrar: 'Sembrar', regar: 'Regar', cosechar: 'Cosechar', limpiar: 'Limpiar parcela',
  sacarAgua: 'Sacar agua del pozo', filtrar: 'Filtrar agua', alimentar: 'Alimentar a los animales', descansar: 'Descansar',
};
export function ordenar(s, orden) {
  const o = { id: s.nextId++, quien: 'cualquiera', ...orden, asignada: null };
  s.ordenes.push(o);
  return o;
}
export function cancelarOrden(s, id) {
  const o = s.ordenes.find((x) => x.id === id);
  if (!o) return;
  if (o.asignada) { const a = s.agentes.find((x) => x.id === o.asignada); if (a && a.tarea && a.tarea.orden === id) soltarTarea(s, a); }
  s.ordenes = s.ordenes.filter((x) => x.id !== id);
}

// ---------------------------------------------------------------- clima
function decidirClima(s) {
  const prob = [0.4, 0.15, 0.3, 0.2][estacion(s)];
  if (rng(s) < prob) {
    const inicio = dia(s) * MIN_DIA + Math.floor(rng(s) * 20 * 60);
    s.clima.lluviaHoy = { desde: inicio, hasta: inicio + 120 + Math.floor(rng(s) * 300) };
  } else s.clima.lluviaHoy = null;
}

// ---------------------------------------------------------------- avance del tiempo
export function avanzar(s, minutos) {
  for (let i = 0; i < minutos && !s.fin; i++) tick(s);
}

function tick(s) {
  const diaAntes = dia(s);
  s.t += 1;
  if (dia(s) !== diaAntes) nuevoDia(s);

  // lluvia
  const L = s.clima.lluviaHoy;
  const llueve = !!(L && s.t >= L.desde && s.t < L.hasta);
  if (llueve !== s.clima.lluvia) {
    s.clima.lluvia = llueve;
    if (llueve) log(s, 'Empieza a llover: el tanque se llena y el huerto se riega solo.', 'clima');
  }
  if (llueve) {
    const antes = s.rec.cruda;
    s.rec.cruda = Math.min(TANQUE_MAX, s.rec.cruda + 0.5);
    s.stats.litrosLluvia += s.rec.cruda - antes;
    for (const p of s.parcelas) p.agua = 100;
  }

  actualizarParcelas(s);
  for (const a of s.agentes) if (a.vivo) { necesidades(s, a); comportamiento(s, a); }
}

function nuevoDia(s) {
  decidirClima(s);
  s.rec.raciones *= 0.996;                       // la comida guardada se echa a perder poco a poco
  if (dia(s) % DIAS_ESTACION === 0) {
    const e = estacion(s);
    log(s, `Comienza ${ESTACIONES[e].toLowerCase()}${e === 3 ? ': no crece nada hasta la primavera, ojalá hayan guardado comida' : ''}.`, 'clima');
    if (e === 0 && dia(s) > 0) log(s, `¡Sobrevivieron un año más! Ya van ${anio(s) - 1}.`, 'logro');
  }
}

// ---------------------------------------------------------------- huerto
const EVAP = [35, 55, 30, 20];                   // % de humedad que se pierde por día según la estación
function actualizarParcelas(s) {
  const e = estacion(s);
  for (const p of s.parcelas) {
    if (p.estado === 'vacia' || p.estado === 'muerta') continue;
    p.agua = Math.max(0, p.agua - EVAP[e] / MIN_DIA);
    const C = CULTIVOS[p.cultivo];
    const temporada = C.estaciones.includes(e);
    if (p.estado === 'creciendo') {
      if (p.agua > 0 && temporada) p.crec += 1 / MIN_DIA;
      if (p.agua <= 0 || !temporada) p.secoMin += 1; else p.secoMin = Math.max(0, p.secoMin - 0.5);
      if (p.secoMin > MIN_DIA * 2) {
        p.estado = 'muerta';
        log(s, `Se murió ${C.nombre.toLowerCase()} de la parcela ${p.id + 1} (${!temporada ? 'fuera de temporada' : 'falta de agua'}).`, 'malo');
      } else if (p.crec >= C.dias) {
        p.estado = 'lista'; p.listaMin = 0;
        log(s, `${C.nombre} de la parcela ${p.id + 1} lista para cosechar.`, 'bueno');
      }
    } else if (p.estado === 'lista') {
      p.listaMin += 1;
      if (p.listaMin > MIN_DIA * 6) { p.estado = 'muerta'; log(s, `${C.nombre} de la parcela ${p.id + 1} se pudrió sin cosechar.`, 'malo'); }
    }
  }
}

// ---------------------------------------------------------------- necesidades y muerte
const TASA = {
  humano: { comida: 2.2, agua: 4, energia: 4 },
  perro: { comida: 2.0, agua: 3.5, energia: 3 },
  gato: { comida: 1.6, agua: 2.5, energia: 2.5 },
};
function necesidades(s, a) {
  const T = TASA[a.tipo], n = a.n;
  let hambre = T.comida;
  if (a.rasgos.includes('comilon')) hambre *= 1.2;
  if (a.rasgos.includes('ahorradora')) hambre *= 0.85;
  n.comida = Math.max(0, n.comida - hambre / 60);
  n.agua = Math.max(0, n.agua - T.agua / 60);
  const durmiendo = a.tarea && a.tarea.tipo === 'dormir' && a.tarea.fase === 'trabajo';
  const trabajando = a.tarea && a.tarea.fase === 'trabajo' && !['dormir', 'descansar', 'comer', 'beber'].includes(a.tarea.tipo);
  if (durmiendo) n.energia = Math.min(100, n.energia + 15 / 60);
  else n.energia = Math.max(0, n.energia - (T.energia + (trabajando ? 4 : 0)) / 60);
  let dS = 0;
  if (n.comida <= 0) dS -= 4;
  if (n.agua <= 0) dS -= 6;
  if (n.energia <= 0) dS -= 1;
  if (n.comida > 40 && n.agua > 40 && n.energia > 15) dS += 0.6;
  n.salud = Math.min(100, Math.max(0, n.salud + dS / 60));
  if (n.salud <= 0) morir(s, a);
}

function morir(s, a) {
  a.vivo = false; a.murio = s.t; a.dentro = false;
  const causa = a.n.agua <= 0 ? 'de sed' : a.n.comida <= 0 ? 'de hambre' : 'de agotamiento';
  soltarTarea(s, a);
  a.accion = 'Murió';
  log(s, `${a.nombre} murió ${causa}. 🕯️`, 'muerte');
  const humanos = s.agentes.filter((x) => x.tipo === 'humano');
  if (humanos.every((h) => !h.vivo)) {
    s.fin = { t: s.t, dias: dia(s) };
    log(s, `Fin: la granja quedó vacía tras ${dia(s)} días.`, 'muerte');
  }
}

// ---------------------------------------------------------------- tareas
const VEL = { humano: 0.6, perro: 0.9, gato: 0.8 };   // unidades por minuto de juego
function soltarTarea(s, a) {
  const T = a.tarea;
  if (!T) return;
  if (T.parcela != null) { const p = s.parcelas[T.parcela]; if (p && p.reservada === a.id) p.reservada = null; }
  if (T.orden) { const o = s.ordenes.find((x) => x.id === T.orden); if (o) o.asignada = null; }
  a.tarea = null;
}
function terminarTarea(s, a) {
  const T = a.tarea;
  if (T.orden) s.ordenes = s.ordenes.filter((x) => x.id !== T.orden);
  if (T.parcela != null) { const p = s.parcelas[T.parcela]; if (p && p.reservada === a.id) p.reservada = null; }
  a.tarea = null;
}

// destinos: dentro de la casa (se entra por la puerta) o un punto afuera
const DENTRO = ['comer', 'beber', 'dormir', 'filtrar'];
function crearTarea(s, a, tipo, extra = {}) {
  const t = { tipo, fase: 'camino', trabajo: 0, ...extra };
  if (DENTRO.includes(tipo) && a.tipo === 'humano') { t.destino = { ...LUGAR.puerta }; t.dentro = true; }
  else if (t.parcela != null) { const p = s.parcelas[t.parcela]; t.destino = { x: p.x, z: p.z - 1.3 }; p.reservada = a.id; }
  else if (tipo === 'sacarAgua') t.destino = { x: LUGAR.pozo.x + 1.2, z: LUGAR.pozo.z };
  else if (tipo === 'alimentar') t.destino = { x: LUGAR.comedero.x + 0.9, z: LUGAR.comedero.z + 0.3 };
  else if (tipo === 'descansar') t.destino = { x: LUGAR.banca.x + (a.id === 'tomas' ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
  t.trabajo = DURACION[tipo] ? DURACION[tipo](a) : 30;
  a.tarea = t;
  return t;
}
const rapido = (a) => (a.rasgos.includes('manoVerde') ? 1 / 1.4 : 1);
const DURACION = {
  comer: () => 30, beber: () => 5, dormir: () => 60, filtrar: () => 60, sacarAgua: () => 60,
  regar: (a) => 12 * rapido(a), sembrar: (a) => 20 * rapido(a), cosechar: (a) => 30 * rapido(a), limpiar: () => 15,
  alimentar: () => 10, descansar: () => 45,
};

function mover(s, a, destino) {
  const dx = destino.x - a.pos.x, dz = destino.z - a.pos.z, d = Math.hypot(dx, dz), v = VEL[a.tipo];
  if (d <= v) { a.pos.x = destino.x; a.pos.z = destino.z; return true; }
  a.pos.x += (dx / d) * v; a.pos.z += (dz / d) * v;
  return false;
}

// ¿se puede hacer esta orden ahora? (si no, se explica por qué)
function viable(s, o) {
  const p = o.parcela != null ? s.parcelas[o.parcela] : null;
  switch (o.tipo) {
    case 'sembrar':
      if (p.estado !== 'vacia') return 'la parcela no está vacía';
      if ((s.rec.semillas[o.cultivo] || 0) < 1) return `no hay semillas de ${CULTIVOS[o.cultivo].nombre.toLowerCase()}`;
      if (!CULTIVOS[o.cultivo].estaciones.includes(estacion(s))) return `${CULTIVOS[o.cultivo].nombre.toLowerCase()} no se da en ${ESTACIONES[estacion(s)].toLowerCase()}`;
      return null;
    case 'regar': return p.estado !== 'creciendo' && p.estado !== 'lista' ? 'no hay nada sembrado' : s.rec.cruda < 8 ? 'no hay agua en el tanque' : null;
    case 'cosechar': return p.estado !== 'lista' ? 'todavía no está lista' : null;
    case 'limpiar': return p.estado !== 'muerta' ? 'no hay nada que limpiar' : null;
    case 'filtrar': return s.rec.cruda < 5 ? 'no hay agua cruda para filtrar' : null;
    case 'alimentar': return s.rec.raciones < 1 && s.rec.cruda < 3 ? 'no hay comida ni agua' : null;
    default: return null;
  }
}

function elegirTarea(s, a) {
  const n = a.n, h = hora(s);
  // 1. supervivencia (lo deciden solos)
  if (n.agua < 40 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.comida < 40 && s.rec.raciones >= 1) return crearTarea(s, a, 'comer');
  if (n.energia < 18) return crearTarea(s, a, 'dormir');
  if (esNoche(s) && n.energia < 85) return crearTarea(s, a, 'dormir');
  // 2. órdenes del jugador (primero las asignadas a esta persona)
  const libres = s.ordenes.filter((o) => !o.asignada && (o.quien === a.id || o.quien === 'cualquiera'))
    .sort((x, y) => (y.quien === a.id) - (x.quien === a.id) || x.id - y.id);
  for (const o of libres) {
    if (o.parcela != null && s.parcelas[o.parcela].reservada && s.parcelas[o.parcela].reservada !== a.id) continue;
    const motivo = viable(s, o);
    if (motivo) {
      if (!o.avisada) { log(s, `No se puede «${TIPOS_ORDEN[o.tipo].toLowerCase()}${o.parcela != null ? ' parcela ' + (o.parcela + 1) : ''}»: ${motivo}.`, 'aviso'); o.avisada = true; }
      if (['sembrar', 'cosechar', 'limpiar', 'regar'].includes(o.tipo) && /no está vacía|nada|lista/.test(motivo)) s.ordenes = s.ordenes.filter((x) => x !== o);
      continue;
    }
    o.asignada = a.id;
    return crearTarea(s, a, o.tipo, { orden: o.id, parcela: o.parcela, cultivo: o.cultivo });
  }
  // 3. órdenes permanentes (rutina)
  const P = s.permanentes;
  const libre = (p) => !p.reservada;
  if (P.cosechar) { const p = s.parcelas.find((p) => p.estado === 'lista' && libre(p)); if (p) return crearTarea(s, a, 'cosechar', { parcela: p.id }); }
  if (P.regar && s.rec.cruda >= 8) { const p = s.parcelas.find((p) => p.estado === 'creciendo' && p.agua < 45 && libre(p)); if (p) return crearTarea(s, a, 'regar', { parcela: p.id }); }
  if (P.limpiar) { const p = s.parcelas.find((p) => p.estado === 'muerta' && libre(p)); if (p) return crearTarea(s, a, 'limpiar', { parcela: p.id }); }
  if (P.resembrar && (s.rec.semillas[P.resembrar] || 0) >= 1 && CULTIVOS[P.resembrar].estaciones.includes(estacion(s))) {
    const p = s.parcelas.find((p) => p.estado === 'vacia' && libre(p)); if (p) return crearTarea(s, a, 'sembrar', { parcela: p.id, cultivo: P.resembrar });
  }
  const otro = s.agentes.find((x) => x !== a && x.tipo === 'humano' && x.tarea);
  const yaHace = (tipo) => otro && otro.tarea.tipo === tipo;
  if (P.potableMin && s.rec.potable < P.potableMin && s.rec.cruda >= 5 && !yaHace('filtrar')) return crearTarea(s, a, 'filtrar');
  if (P.tanqueMin && s.rec.cruda < P.tanqueMin && !yaHace('sacarAgua')) return crearTarea(s, a, 'sacarAgua');
  if (P.animales && (s.rec.comedero < 0.5 || s.rec.bebedero < 2) && (s.rec.raciones >= 1 || s.rec.cruda >= 3) && !yaHace('alimentar')
    && s.agentes.some((x) => x.tipo !== 'humano' && x.vivo)) return crearTarea(s, a, 'alimentar');
  // 4. tiempo libre
  if (n.agua < 65 && s.rec.potable >= 1) return crearTarea(s, a, 'beber');
  if (h >= 7 && h < 20) return crearTarea(s, a, 'descansar');
  return crearTarea(s, a, 'dormir');
}

const ACCION = {
  comer: 'Comiendo', beber: 'Bebiendo', dormir: 'Durmiendo', filtrar: 'Filtrando agua', sacarAgua: 'Sacando agua del pozo',
  regar: 'Regando', sembrar: 'Sembrando', cosechar: 'Cosechando', limpiar: 'Limpiando parcela', alimentar: 'Alimentando a los animales', descansar: 'Descansando en la banca',
  seguir: 'Acompañando', cazar: 'Cazando ratones', siesta: 'Tomando la siesta',
};

function comportamiento(s, a) {
  if (a.tipo !== 'humano') return comportamientoAnimal(s, a);
  // interrupciones urgentes: si tiene mucha sed o hambre deja lo que hace
  if (a.tarea && !['beber', 'comer', 'dormir'].includes(a.tarea.tipo) && ((a.n.agua < 20 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) || (a.n.comida < 20 && s.rec.raciones >= 1))) soltarTarea(s, a);
  if (!a.tarea) elegirTarea(s, a);
  const T = a.tarea;
  a.accion = (T.fase === 'camino' ? 'Yendo a: ' : '') + (ACCION[T.tipo] || T.tipo).replace(/^./, (c) => (T.fase === 'camino' ? c.toLowerCase() : c));
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (a.dentro && T.dentro) { T.fase = 'trabajo'; return; }
    if (mover(s, a, T.destino)) { T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  // trabajando
  if (T.tipo === 'dormir') {
    if ((!esNoche(s) && a.n.energia >= 95) || (esNoche(s) && a.n.energia >= 99 && hora(s) >= 5.5)) terminarTarea(s, a);
    else if ((a.n.agua < 15 && s.rec.potable >= 1) || (a.n.comida < 15 && s.rec.raciones >= 1)) terminarTarea(s, a);
    return;
  }
  T.trabajo -= 1;
  if (T.tipo === 'descansar' && (s.ordenes.some((o) => !o.asignada && (o.quien === a.id || o.quien === 'cualquiera')))) { terminarTarea(s, a); return; }
  if (T.trabajo > 0) return;
  completar(s, a, T);
  terminarTarea(s, a);
}

function completar(s, a, T) {
  const R = s.rec, p = T.parcela != null ? s.parcelas[T.parcela] : null;
  switch (T.tipo) {
    case 'beber':
      if (R.potable >= 1) { R.potable -= 1; a.n.agua = Math.min(100, a.n.agua + 35); }
      else if (R.cruda >= 1) {
        R.cruda -= 1; a.n.agua = Math.min(100, a.n.agua + 35);
        if (rng(s) < 0.4) { a.n.salud = Math.max(1, a.n.salud - 15); log(s, `${a.nombre} tomó agua sin filtrar y se enfermó del estómago.`, 'malo'); }
      }
      break;
    case 'comer':
      if (R.raciones >= 1) { R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + 38); }
      break;
    case 'filtrar': { const l = Math.min(25, R.cruda); R.cruda -= l; R.potable += l; break; }
    case 'sacarAgua': {
      const l = Math.min(TANQUE_MAX - R.cruda, a.rasgos.includes('fuerte') ? 60 : 40);
      R.cruda += l; s.stats.litrosPozo += l; break;
    }
    case 'regar': {
      const l = estacion(s) === 1 ? 12 : 8;
      if (R.cruda >= l && p.estado !== 'vacia' && p.estado !== 'muerta') { R.cruda -= l; p.agua = 100; }
      break;
    }
    case 'sembrar':
      if (p.estado === 'vacia' && (R.semillas[T.cultivo] || 0) >= 1) {
        R.semillas[T.cultivo] -= 1;
        Object.assign(p, { cultivo: T.cultivo, crec: 0, estado: 'creciendo', secoMin: 0, agua: Math.max(p.agua, 50) });
        log(s, `${a.nombre} sembró ${CULTIVOS[T.cultivo].nombre.toLowerCase()} en la parcela ${p.id + 1}.`, 'info');
      }
      break;
    case 'cosechar':
      if (p.estado === 'lista') {
        const C = CULTIVOS[p.cultivo];
        const rac = Math.round(C.raciones * (a.rasgos.includes('manoVerde') ? 1.15 : 1));
        const sem = C.semillas[0] + Math.floor(rng(s) * (C.semillas[1] - C.semillas[0] + 1));
        R.raciones += rac; R.semillas[p.cultivo] = (R.semillas[p.cultivo] || 0) + sem;
        s.stats.cosechas += 1; s.stats.raciones += rac;
        log(s, `${a.nombre} cosechó ${C.nombre.toLowerCase()}: +${rac} raciones y ${sem} semilla${sem > 1 ? 's' : ''}.`, 'bueno');
        Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 });
      }
      break;
    case 'limpiar': Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 }); break;
    case 'alimentar': {
      if (R.raciones >= 1 && R.comedero < 2) { const c = Math.min(2 - R.comedero, R.raciones, 2); R.raciones -= c; R.comedero += c; }
      if (R.cruda >= 1 && R.bebedero < 6) { const l = Math.min(6 - R.bebedero, R.cruda); R.cruda -= l; R.bebedero += l; }
      break;
    }
  }
}

// ---------------------------------------------------------------- animales
function comportamientoAnimal(s, a) {
  const R = s.rec, n = a.n;
  if (!a.tarea) {
    if (n.agua < 45 && R.bebedero >= 0.5) a.tarea = { tipo: 'beber', fase: 'camino', destino: { x: LUGAR.comedero.x - 0.5, z: LUGAR.comedero.z + 0.4 }, trabajo: 5 };
    else if (n.comida < 45 && R.comedero >= 0.3) a.tarea = { tipo: 'comer', fase: 'camino', destino: { x: LUGAR.comedero.x + 0.3, z: LUGAR.comedero.z + 0.6 }, trabajo: 10 };
    else if (n.comida < 45 && a.rasgos.includes('cazador')) {
      const p = s.parcelas[Math.floor(rng(s) * s.parcelas.length)];
      a.tarea = { tipo: 'cazar', fase: 'camino', destino: { x: p.x + (rng(s) - 0.5) * 3, z: p.z + 1.2 }, trabajo: 60 };
    } else if (esNoche(s) && n.energia < 90 || n.energia < 20) {
      const d = a.tipo === 'perro' ? LUGAR.caseta : { x: LUGAR.banca.x, z: LUGAR.banca.z - 0.05 };
      a.tarea = { tipo: 'dormir', fase: 'camino', destino: { ...d }, trabajo: 0 };
    } else if (a.rasgos.includes('leal')) {
      const amo = s.agentes.filter((x) => x.tipo === 'humano' && x.vivo && !x.dentro)
        .sort((x, y) => Math.hypot(x.pos.x - a.pos.x, x.pos.z - a.pos.z) - Math.hypot(y.pos.x - a.pos.x, y.pos.z - a.pos.z))[0];
      const d = amo ? { x: amo.pos.x + 1.4, z: amo.pos.z + 1.0 } : { ...LUGAR.puerta, z: LUGAR.puerta.z + 1.5 };
      a.tarea = { tipo: 'seguir', fase: 'camino', destino: d, trabajo: 20 };
    } else {
      a.tarea = { tipo: 'siesta', fase: 'camino', destino: { x: LUGAR.banca.x + (rng(s) - 0.5) * 2, z: LUGAR.banca.z - 0.05 }, trabajo: 90 };
    }
  }
  const T = a.tarea;
  a.accion = ACCION[T.tipo] || T.tipo;
  if (T.fase === 'camino') { if (mover(s, a, T.destino)) T.fase = 'trabajo'; return; }
  if (T.tipo === 'dormir') {
    a.n.energia = Math.min(100, a.n.energia + 15 / 60);
    if ((!esNoche(s) && n.energia >= 95) || n.agua < 20 || n.comida < 20) a.tarea = null;
    return;
  }
  T.trabajo -= 1;
  if (T.trabajo > 0) return;
  if (T.tipo === 'comer' && R.comedero >= 0.3) { const c = a.tipo === 'gato' ? 0.3 : 0.5; R.comedero = Math.max(0, R.comedero - c); n.comida = Math.min(100, n.comida + 45); }
  if (T.tipo === 'beber' && R.bebedero >= 0.5) { R.bebedero = Math.max(0, R.bebedero - 0.5); n.agua = Math.min(100, n.agua + 40); }
  if (T.tipo === 'cazar' && rng(s) < 0.4) { n.comida = Math.min(100, n.comida + 35); log(s, `${a.nombre} cazó un ratón en el huerto.`, 'info'); }
  a.tarea = null;
}

// ---------------------------------------------------------------- guardar / cargar
const CLAVE = 'granja3d-partida';
export function guardar(s) { try { localStorage.setItem(CLAVE, JSON.stringify(s)); return true; } catch { return false; } }
export function cargar() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE)); return s && s.version === VERSION ? s : null; } catch { return null; }
}
export function borrarPartida() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }
