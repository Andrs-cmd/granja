// =====================================================================
// Motor de simulación de la granja (lógica pura, sin Three.js).
// Todo es autónomo: los personajes deciden solos qué hacer para sobrevivir,
// según sus necesidades, rasgos, rol y reacción al estrés (js/personajes.js).
// El estado es JSON serializable (se guarda en localStorage).
// Tiempo en minutos de juego, con decimales: el motor avanza de forma continua.
// =====================================================================
import { PERSONAJES, RASGOS, CONFIG } from './personajes.js';
export { RASGOS, PERSONAJES };

export const MIN_DIA = 1440;
export const DIAS_ESTACION = 28;
export const DIAS_ANIO = DIAS_ESTACION * 4;
export const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
export const TANQUE_MAX = 600;
export const VERSION = 2;

export const CULTIVOS = {
  lechuga: { nombre: 'Lechuga', dias: 7, raciones: 6, semillas: [1, 2], estaciones: [0, 2] },
  papa: { nombre: 'Papa', dias: 14, raciones: 14, semillas: [1, 2], estaciones: [0, 1, 2] },
  frijol: { nombre: 'Fríjol', dias: 12, raciones: 10, semillas: [1, 3], estaciones: [0, 1] },
  maiz: { nombre: 'Maíz', dias: 18, raciones: 20, semillas: [1, 2], estaciones: [1] },
};

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
export const HABILIDADES = { huerto: 'Huerto', agua: 'Agua', cuidado: 'Cuidado' };
const AREA = { sembrar: 'huerto', regar: 'huerto', cosechar: 'huerto', limpiar: 'huerto', sacarAgua: 'agua', filtrar: 'agua', alimentar: 'cuidado' };

// ---------------------------------------------------------------- azar reproducible
function rng(s) {
  s.rng = (s.rng + 0x6D2B79F5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- tiempo
export const dia = (s) => Math.floor(s.t / MIN_DIA);
export const hora = (s) => (s.t % MIN_DIA) / 60;
export const estacion = (s) => Math.floor(dia(s) / DIAS_ESTACION) % 4;
export const anio = (s) => Math.floor(dia(s) / DIAS_ANIO) + 1;
export const diaEstacion = (s) => (dia(s) % DIAS_ESTACION) + 1;
export const diasVividos = (s) => Math.floor((s.t - s.t0) / MIN_DIA);
export function fechaTxt(s) {
  const h = hora(s), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `Año ${anio(s)} · ${ESTACIONES[estacion(s)]} ${diaEstacion(s)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
const esNoche = (s) => { const h = hora(s); return h >= 22 || h < 6; };

// ---------------------------------------------------------------- rasgos, ficha y habilidades
export const ficha = (a) => PERSONAJES.find((p) => p.id === a.id) || {};
export function mod(a, clave) {
  let m = 1;
  for (const r of a.rasgos) { const v = RASGOS[r]?.mod?.[clave]; if (v != null) m *= v; }
  return m;
}
const tiene = (a, clave) => a.rasgos.some((r) => RASGOS[r]?.mod?.[clave] != null);
export const nivel = (xp) => Math.min(10, Math.floor(Math.sqrt(xp / 120)));   // 2 h de práctica → nivel 1; 200 h → nivel 10

// escasez: poca comida o agua guardada para los vivos
export function escasez(s) {
  const vivos = s.agentes.filter((a) => a.vivo && a.tipo === 'humano').length || 1;
  return s.rec.raciones < vivos * 1.4 * 3 || s.rec.potable + s.rec.cruda * 0.5 < vivos * 3.5 * 2;
}
const estres = (s, a) => (escasez(s) ? ficha(a).psique?.estres : null);

// ---------------------------------------------------------------- partida nueva
export function nuevaPartida({ semilla = Date.now(), inicio = 6 * 60, generacion = 1 } = {}) {
  const s = {
    version: VERSION, config: CONFIG, rng: semilla | 0, generacion,
    t: inicio, t0: inicio,
    clima: { lluvia: false, lluviaHoy: null },
    rec: { potable: 30, cruda: 120, raciones: 45, comedero: 2, bebedero: 6, semillas: { lechuga: 8, papa: 6, frijol: 6, maiz: 4 } },
    parcelas: PARCELAS.map((p, i) => ({ id: i, x: p.x, z: p.z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null })),
    agentes: PERSONAJES.map((p) => ({
      id: p.id, tipo: p.tipo, nombre: p.nombre, rasgos: [...p.rasgos], vivo: true,
      pos: { ...(p.tipo === 'perro' ? LUGAR.caseta : p.tipo === 'gato' ? LUGAR.banca : LUGAR.puerta) },
      dentro: p.tipo === 'humano', n: { comida: 85, agua: 85, energia: 90, salud: 100 },
      xp: { huerto: 0, agua: 0, cuidado: 0 }, tarea: null, accion: 'Descansando', murio: null, causa: null,
      edad: p.edad ?? (p.tipo === 'humano' ? 30 : 3), enfermo: 0,
    })),
    diario: [],
    stats: { cosechas: 0, raciones: 0, litrosPozo: 0, litrosLluvia: 0 },
    escasez: false,
    sequia: 0,          // días que le quedan a la sequía
    fin: null,
  };
  Object.assign(s.parcelas[0], { cultivo: 'lechuga', crec: 3, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[3], { cultivo: 'lechuga', crec: 2, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[1], { cultivo: 'papa', crec: 4, estado: 'creciendo', agua: 80 });
  const nombres = s.agentes.map((a) => a.nombre);
  log(s, `${generacion > 1 ? `Generación ${generacion}. ` : ''}${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)} empiezan su vida en la granja.`, 'info');
  decidirClima(s);
  return s;
}

export function log(s, texto, tipo = 'info') {
  s.diario.unshift({ t: s.t, texto, tipo });
  if (s.diario.length > 250) s.diario.length = 250;
}

// ---------------------------------------------------------------- clima
function decidirClima(s) {
  const prob = s.sequia > 0 ? 0 : [0.4, 0.15, 0.3, 0.2][estacion(s)];
  if (rng(s) < prob) {
    const inicio = dia(s) * MIN_DIA + Math.floor(rng(s) * 20 * 60);
    s.clima.lluviaHoy = { desde: inicio, hasta: inicio + 120 + Math.floor(rng(s) * 300) };
  } else s.clima.lluviaHoy = null;
}

// ---------------------------------------------------------------- avance del tiempo (continuo)
export function avanzar(s, minutos) {
  while (minutos > 1e-9 && !s.fin) {
    const d = Math.min(1, minutos);
    tick(s, d);
    minutos -= d;
  }
}

function tick(s, d) {
  const diaAntes = dia(s);
  s.t += d;
  if (dia(s) !== diaAntes) nuevoDia(s);

  const L = s.clima.lluviaHoy;
  const llueve = !!(L && s.t >= L.desde && s.t < L.hasta);
  if (llueve !== s.clima.lluvia) {
    s.clima.lluvia = llueve;
    if (llueve) log(s, 'Empieza a llover: el tanque se llena y el huerto se riega solo.', 'clima');
  }
  if (llueve) {
    const antes = s.rec.cruda;
    s.rec.cruda = Math.min(TANQUE_MAX, s.rec.cruda + 0.5 * d);
    s.stats.litrosLluvia += s.rec.cruda - antes;
    for (const p of s.parcelas) p.agua = 100;
  }
  const esc = escasez(s);
  if (esc !== s.escasez) {
    s.escasez = esc;
    if (esc) {
      const r = s.agentes.filter((a) => a.vivo && ficha(a).psique?.estres).map((a) => `${a.nombre} ${ficha(a).psique.estres === 'trabaja' ? 'trabaja más duro' : 'empieza a racionar'}`);
      log(s, `Escasean las reservas.${r.length ? ' ' + r.join('; ') + '.' : ''}`, 'aviso');
    }
  }
  actualizarParcelas(s, d);
  for (const a of s.agentes) if (a.vivo) { necesidades(s, a, d); comportamiento(s, a, d); }
}

function nuevoDia(s) {
  if (s.sequia > 0 && --s.sequia === 0) log(s, 'Terminó la sequía.', 'clima');
  decidirClima(s);
  s.rec.raciones *= 0.992;                      // la comida guardada se echa a perder
  eventos(s);
  if (dia(s) % DIAS_ESTACION === 0) {
    const e = estacion(s);
    log(s, `Comienza ${ESTACIONES[e].toLowerCase()}${e === 3 ? ': no crece nada hasta la primavera' : ''}.`, 'clima');
    if (e === 0 && diasVividos(s) > 0) log(s, `¡Sobrevivieron un año más! Ya van ${Math.round(diasVividos(s) / DIAS_ANIO)}.`, 'logro');
  }
}

// ---------------------------------------------------------------- eventos de la naturaleza y de la vida
const LONGEVIDAD = { humano: 70, perro: 13, gato: 16 };   // en años de la granja
function eventos(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION;
  // sequía: puede empezar al inicio del verano
  if (e === 1 && dE === 0 && rng(s) < 0.35) { s.sequia = 10 + Math.floor(rng(s) * 12); s.clima.lluviaHoy = null; log(s, `Empieza una sequía: no lloverá en unos ${s.sequia} días y el pozo rinde la mitad.`, 'malo'); }
  // plaga en el huerto (el gato cazador puede frenarla)
  const creciendo = s.parcelas.filter((p) => p.estado === 'creciendo');
  if (e !== 3 && creciendo.length && rng(s) < 0.025) {
    const p = creciendo[Math.floor(rng(s) * creciendo.length)];
    const gato = s.agentes.find((a) => a.vivo && tiene(a, 'cazador'));
    if (gato && rng(s) < 0.6) log(s, `Una plaga de ratones atacó la parcela ${p.id + 1}, pero ${gato.nombre} la ahuyentó.`, 'bueno');
    else { p.estado = 'muerta'; log(s, `Una plaga acabó con ${CULTIVOS[p.cultivo].nombre.toLowerCase()} de la parcela ${p.id + 1}.`, 'malo'); }
  }
  // helada temprana a finales de otoño
  if (e === 2 && dE === 23 && rng(s) < 0.4) {
    const muertas = s.parcelas.filter((p) => p.estado === 'creciendo');
    muertas.forEach((p) => { p.estado = 'muerta'; });
    log(s, `Helada temprana${muertas.length ? `: se perdieron ${muertas.length} parcelas` : ''}.`, 'malo');
  }
  for (const a of s.agentes) {
    if (!a.vivo) continue;
    a.edad += 1 / DIAS_ANIO;
    // enfermedades: más probables con la edad o con la salud baja
    if (a.enfermo > 0) { if (--a.enfermo === 0) log(s, `${a.nombre} se recuperó.`, 'bueno'); }
    else if (a.tipo === 'humano' && rng(s) < 0.004 * (1 + Math.max(0, a.edad - 45) / 15) * (a.n.salud < 60 ? 2 : 1) * mod(a, 'enfermar')) {
      a.enfermo = 3 + Math.floor(rng(s) * 5);
      log(s, `${a.nombre} cayó enfermo${a.n.salud < 60 ? ' (estaba débil)' : ''}: estará lento unos días.`, 'malo');
    }
    // vejez
    const L = LONGEVIDAD[a.tipo], sobra = a.edad - L * 0.85;
    if (sobra > 0 && rng(s) < 0.002 + sobra * 0.004) morir(s, a, 'de vejez');
  }
}

// ---------------------------------------------------------------- huerto
const EVAP = [35, 55, 30, 20];
function actualizarParcelas(s, d) {
  const e = estacion(s);
  for (const p of s.parcelas) {
    if (p.estado === 'vacia' || p.estado === 'muerta') continue;
    p.agua = Math.max(0, p.agua - (EVAP[e] * (s.sequia > 0 ? 1.3 : 1) / MIN_DIA) * d);
    const C = CULTIVOS[p.cultivo], temporada = C.estaciones.includes(e);
    if (p.estado === 'creciendo') {
      if (p.agua > 0 && temporada) p.crec += d / MIN_DIA;
      if (p.agua <= 0 || !temporada) p.secoMin += d; else p.secoMin = Math.max(0, p.secoMin - 0.5 * d);
      if (p.secoMin > MIN_DIA * 2) {
        p.estado = 'muerta';
        log(s, `Se murió ${C.nombre.toLowerCase()} de la parcela ${p.id + 1} (${!temporada ? 'fuera de temporada' : 'falta de agua'}).`, 'malo');
      } else if (p.crec >= C.dias) {
        p.estado = 'lista'; p.listaMin = 0;
        log(s, `${C.nombre} de la parcela ${p.id + 1} lista para cosechar.`, 'bueno');
      }
    } else if (p.estado === 'lista') {
      p.listaMin += d;
      if (p.listaMin > MIN_DIA * 6) { p.estado = 'muerta'; log(s, `${C.nombre} de la parcela ${p.id + 1} se pudrió sin cosechar.`, 'malo'); }
    }
  }
}

// qué conviene sembrar: algo de la estación que alcance a madurar (o siga en la próxima) y rinda más por día
function elegirCultivo(s) {
  const e = estacion(s), quedan = DIAS_ESTACION - (dia(s) % DIAS_ESTACION) - hora(s) / 24;
  let mejor = null, puntaje = -1;
  for (const [k, C] of Object.entries(CULTIVOS)) {
    if ((s.rec.semillas[k] || 0) < 1 || !C.estaciones.includes(e)) continue;
    if (!C.estaciones.includes((e + 1) % 4) && C.dias > quedan - 0.5) continue;
    const p = C.raciones / C.dias + (s.rec.semillas[k] > 2 ? 0.05 : 0);
    if (p > puntaje) { puntaje = p; mejor = k; }
  }
  return mejor;
}

// ---------------------------------------------------------------- necesidades y muerte
const TASA = {
  humano: { comida: 2.2, agua: 4, energia: 4 },
  perro: { comida: 2.0, agua: 3.5, energia: 3 },
  gato: { comida: 1.6, agua: 2.5, energia: 2.5 },
};
function necesidades(s, a, d) {
  const T = TASA[a.tipo], n = a.n, k = d / 60, est = estres(s, a);
  n.comida = Math.max(0, n.comida - T.comida * mod(a, 'hambre') * (est === 'raciona' ? 0.9 : 1) * k);
  n.agua = Math.max(0, n.agua - T.agua * mod(a, 'sed') * k);
  const durmiendo = a.tarea && a.tarea.tipo === 'dormir' && a.tarea.fase === 'trabajo';
  const trabajando = a.tarea && a.tarea.fase === 'trabajo' && AREA[a.tarea.tipo];
  if (durmiendo) n.energia = Math.min(100, n.energia + 15 * k);
  else n.energia = Math.max(0, n.energia - (T.energia + (trabajando ? 4 : 0)) * mod(a, 'cansancio') * (est === 'trabaja' && trabajando ? 1.25 : 1) * k);
  let dS = 0;
  if (n.comida <= 0) dS -= 4;
  if (n.agua <= 0) dS -= 6;
  if (n.energia <= 0) dS -= 1;
  if (a.enfermo > 0) dS -= 0.85;
  const vejez = Math.max(0, (a.edad - LONGEVIDAD[a.tipo] * 0.7) / (LONGEVIDAD[a.tipo] * 0.3));   // 0 joven → 1 anciano
  if (n.comida > 40 && n.agua > 40 && n.energia > 15) dS += 0.6 * (1 - 0.7 * Math.min(1, vejez));
  n.salud = Math.min(100, Math.max(0, n.salud + dS * k));
  if (n.salud <= 0) morir(s, a);
}

function morir(s, a, causa) {
  a.vivo = false; a.murio = s.t; a.dentro = false;
  a.causa = causa || (a.n.agua <= 0 ? 'de sed' : a.n.comida <= 0 ? 'de hambre' : a.enfermo > 0 ? 'de una enfermedad' : 'de agotamiento');
  soltarTarea(s, a);
  a.accion = 'Murió';
  log(s, `${a.nombre} murió ${a.causa}. 🕯️`, 'muerte');
  if (s.agentes.filter((x) => x.tipo === 'humano').every((h) => !h.vivo)) {
    s.fin = { t: s.t, dias: diasVividos(s) };
    log(s, `Fin de la generación ${s.generacion}: la granja quedó vacía tras ${s.fin.dias} días.`, 'muerte');
  }
}

// ---------------------------------------------------------------- tareas
const VEL = { humano: 130, perro: 170, gato: 150 };   // unidades por minuto: paso de paseo
function soltarTarea(s, a) {
  const T = a.tarea;
  if (!T) return;
  if (T.parcela != null) { const p = s.parcelas[T.parcela]; if (p && p.reservada === a.id) p.reservada = null; }
  a.tarea = null;
}
const DENTRO = ['comer', 'beber', 'dormir', 'filtrar'];
const DURACION = { comer: 30, beber: 3, dormir: 60, filtrar: 60, sacarAgua: 60, regar: 12, sembrar: 20, cosechar: 30, limpiar: 15, alimentar: 10, descansar: 45 };
function crearTarea(s, a, tipo, extra = {}) {
  const t = { tipo, fase: 'camino', trabajo: DURACION[tipo] || 30, ...extra };
  if (DENTRO.includes(tipo)) { t.destino = { ...LUGAR.puerta }; t.dentro = true; }
  else if (t.parcela != null) { const p = s.parcelas[t.parcela]; t.destino = { x: p.x, z: p.z - 1.3 }; p.reservada = a.id; }
  else if (tipo === 'sacarAgua') t.destino = { x: LUGAR.pozo.x + 1.2, z: LUGAR.pozo.z };
  else if (tipo === 'alimentar') t.destino = { x: LUGAR.comedero.x + 0.9, z: LUGAR.comedero.z + 0.3 };
  else if (tipo === 'descansar') t.destino = { x: LUGAR.banca.x + (a.id === s.agentes[0].id ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
  a.tarea = t;
  return t;
}
function mover(a, destino, d) {
  const dx = destino.x - a.pos.x, dz = destino.z - a.pos.z, dist = Math.hypot(dx, dz), v = VEL[a.tipo] * d;
  if (dist <= v) { a.pos.x = destino.x; a.pos.z = destino.z; return true; }
  a.pos.x += (dx / dist) * v; a.pos.z += (dz / dist) * v;
  return false;
}

const consumoAgua = (s) => s.agentes.filter((a) => a.vivo && a.tipo === 'humano').length * 3.5;

function elegirTarea(s, a) {
  const n = a.n, R = s.rec, est = estres(s, a);
  // 1. supervivencia (quien raciona aguanta más antes de comer)
  if (n.agua < 40 && (R.potable >= 1 || R.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.comida < (est === 'raciona' ? 25 : 40) && R.raciones >= 1) return crearTarea(s, a, 'comer');
  if (n.energia < 18) return crearTarea(s, a, 'dormir');
  if (esNoche(s) && n.energia < 85) return crearTarea(s, a, 'dormir');

  // 2. trabajo de la granja: se arma la lista de pendientes y cada quien prefiere su rol
  const libre = (p) => !p.reservada;
  const otro = s.agentes.find((x) => x !== a && x.tipo === 'humano' && x.vivo && x.tarea);
  const yaHace = (tipo) => otro && otro.tarea.tipo === tipo;
  const opciones = [];   // [prioridad, tipo, extra]
  if (R.potable < Math.max(8, consumoAgua(s)) && R.cruda >= 5 && !yaHace('filtrar')) opciones.push([100, 'filtrar']);
  { const p = s.parcelas.find((p) => p.estado === 'lista' && libre(p)); if (p) opciones.push([90, 'cosechar', { parcela: p.id }]); }
  if (R.cruda >= 8) { const p = s.parcelas.find((p) => p.estado === 'creciendo' && p.agua < 45 && libre(p)); if (p) opciones.push([85, 'regar', { parcela: p.id }]); }
  if (R.cruda < 60 && !yaHace('sacarAgua')) opciones.push([80, 'sacarAgua']);
  { const p = s.parcelas.find((p) => p.estado === 'muerta' && libre(p)); if (p) opciones.push([60, 'limpiar', { parcela: p.id }]); }
  { const c = elegirCultivo(s); const p = c && s.parcelas.find((p) => p.estado === 'vacia' && libre(p)); if (p) opciones.push([70, 'sembrar', { parcela: p.id, cultivo: c }]); }
  if ((R.comedero < 0.5 || R.bebedero < 2) && (R.raciones >= 1 || R.cruda >= 3) && !yaHace('alimentar') && s.agentes.some((x) => x.tipo !== 'humano' && x.vivo)) opciones.push([65, 'alimentar']);
  if (R.potable < consumoAgua(s) * 5 && R.cruda >= 30 && !yaHace('filtrar')) opciones.push([40, 'filtrar']);
  if (R.cruda < 250 && !yaHace('sacarAgua') && estacion(s) !== 0) opciones.push([35, 'sacarAgua']);
  if (opciones.length) {
    const rol = ficha(a).psique?.rol;
    opciones.forEach((o) => { if (rol && AREA[o[1]] === rol) o[0] += 25; });
    opciones.sort((x, y) => y[0] - x[0]);
    const [, tipo, extra] = opciones[0];
    return crearTarea(s, a, tipo, extra);
  }
  // 3. tiempo libre
  if (n.agua < 65 && R.potable >= 1) return crearTarea(s, a, 'beber');
  if (n.comida < 55 && R.raciones >= 1 && est !== 'raciona' && hora(s) > 11.5 && hora(s) < 13.5) return crearTarea(s, a, 'comer');
  if (hora(s) >= 7 && hora(s) < 20) return crearTarea(s, a, 'descansar');
  return crearTarea(s, a, 'dormir');
}

const ACCION = {
  comer: 'Comiendo', beber: 'Bebiendo', dormir: 'Durmiendo', filtrar: 'Filtrando agua', sacarAgua: 'Sacando agua del pozo',
  regar: 'Regando', sembrar: 'Sembrando', cosechar: 'Cosechando', limpiar: 'Limpiando una parcela', alimentar: 'Alimentando a los animales', descansar: 'Descansando en la banca',
  seguir: 'Acompañando a la pareja', cazar: 'Cazando ratones', siesta: 'Tomando la siesta',
};
const VA_A = {
  comer: 'Va a comer', beber: 'Va a beber', dormir: 'Va a dormir', filtrar: 'Va a filtrar agua', sacarAgua: 'Va al pozo',
  regar: 'Va a regar', sembrar: 'Va a sembrar', cosechar: 'Va a cosechar', limpiar: 'Va a limpiar una parcela', alimentar: 'Va a alimentar a los animales', descansar: 'Va a la banca',
};

function comportamiento(s, a, d) {
  if (a.tipo !== 'humano') return comportamientoAnimal(s, a, d);
  if (a.tarea && !['beber', 'comer', 'dormir'].includes(a.tarea.tipo) && ((a.n.agua < 20 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) || (a.n.comida < 20 && s.rec.raciones >= 1))) soltarTarea(s, a);
  if (!a.tarea) elegirTarea(s, a);
  const T = a.tarea;
  a.accion = T.fase === 'camino' ? VA_A[T.tipo] || ACCION[T.tipo] : ACCION[T.tipo];
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (a.dentro && T.dentro) { T.fase = 'trabajo'; return; }
    if (mover(a, T.destino, d)) { T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  if (T.tipo === 'dormir') {
    if ((!esNoche(s) && a.n.energia >= 95) || (esNoche(s) && a.n.energia >= 99 && hora(s) >= 5.5)) soltarTarea(s, a);
    else if ((a.n.agua < 15 && s.rec.potable >= 1) || (a.n.comida < 15 && s.rec.raciones >= 1)) soltarTarea(s, a);
    return;
  }
  // el trabajo avanza más rápido con rasgos, con práctica y (si su estrés es "trabaja") con escasez
  const area = AREA[T.tipo];
  const vel = area ? mod(a, area) * (1 + 0.06 * nivel(a.xp[area])) * (estres(s, a) === 'trabaja' ? 1.2 : 1) * (a.enfermo > 0 ? 0.6 : 1) : 1;
  if (area) {
    const antes = nivel(a.xp[area]);
    a.xp[area] += d * mod(a, 'aprende');
    if (nivel(a.xp[area]) > antes) log(s, `${a.nombre} mejoró en ${HABILIDADES[area].toLowerCase()}: nivel ${nivel(a.xp[area])}.`, 'logro');
  }
  T.trabajo -= d * vel;
  if (T.tipo === 'descansar' && necesitaTrabajo(s)) { soltarTarea(s, a); return; }
  if (T.trabajo > 0) return;
  completar(s, a, T);
  soltarTarea(s, a);
}
const necesitaTrabajo = (s) => s.parcelas.some((p) => !p.reservada && (p.estado === 'lista' || (p.estado === 'creciendo' && p.agua < 45) || p.estado === 'muerta'))
  || s.rec.potable < 8 || s.rec.cruda < 60;

function completar(s, a, T) {
  const R = s.rec, p = T.parcela != null ? s.parcelas[T.parcela] : null;
  switch (T.tipo) {
    case 'beber':
      if (R.potable >= 1) { R.potable -= 1; a.n.agua = Math.min(100, a.n.agua + 35); }
      else if (R.cruda >= 1) {
        R.cruda -= 1; a.n.agua = Math.min(100, a.n.agua + 35);
        if (rng(s) < 0.4 * mod(a, 'enfermar')) { a.n.salud = Math.max(1, a.n.salud - 15); log(s, `${a.nombre} tomó agua sin filtrar y se enfermó del estómago.`, 'malo'); }
      }
      break;
    case 'comer': if (R.raciones >= 1) { R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + 38); } break;
    case 'filtrar': { const l = Math.min(25, R.cruda); R.cruda -= l; R.potable += l; break; }
    case 'sacarAgua': { const l = Math.min(TANQUE_MAX - R.cruda, 40 * mod(a, 'pozo') * (s.sequia > 0 ? 0.5 : 1)); R.cruda += l; s.stats.litrosPozo += l; break; }
    case 'regar': { const l = estacion(s) === 1 ? 12 : 8; if (R.cruda >= l && (p.estado === 'creciendo' || p.estado === 'lista')) { R.cruda -= l; p.agua = 100; } break; }
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
        const rac = Math.round(C.raciones * mod(a, 'cosecha') * (1 + 0.03 * nivel(a.xp.huerto)));
        const sem = C.semillas[0] + Math.floor(rng(s) * (C.semillas[1] - C.semillas[0] + 1));
        R.raciones += rac; R.semillas[p.cultivo] = (R.semillas[p.cultivo] || 0) + sem;
        s.stats.cosechas += 1; s.stats.raciones += rac;
        log(s, `${a.nombre} cosechó ${C.nombre.toLowerCase()}: +${rac} raciones y ${sem} semilla${sem > 1 ? 's' : ''}.`, 'bueno');
        Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 });
      }
      break;
    case 'limpiar': Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 }); break;
    case 'alimentar':
      if (R.raciones >= 1 && R.comedero < 2) { const c = Math.min(2 - R.comedero, R.raciones); R.raciones -= c; R.comedero += c; }
      if (R.cruda >= 1 && R.bebedero < 6) { const l = Math.min(6 - R.bebedero, R.cruda); R.cruda -= l; R.bebedero += l; }
      break;
  }
}

// ---------------------------------------------------------------- animales
function comportamientoAnimal(s, a, d) {
  const R = s.rec, n = a.n;
  if (!a.tarea) {
    if (n.agua < 45 && R.bebedero >= 0.5) a.tarea = { tipo: 'beber', fase: 'camino', destino: { x: LUGAR.comedero.x - 0.5, z: LUGAR.comedero.z + 0.4 }, trabajo: 3 };
    else if (n.comida < 45 && R.comedero >= 0.3) a.tarea = { tipo: 'comer', fase: 'camino', destino: { x: LUGAR.comedero.x + 0.3, z: LUGAR.comedero.z + 0.6 }, trabajo: 10 };
    else if (n.comida < 45 && tiene(a, 'cazador')) {
      const p = s.parcelas[Math.floor(rng(s) * s.parcelas.length)];
      a.tarea = { tipo: 'cazar', fase: 'camino', destino: { x: p.x + (rng(s) - 0.5) * 3, z: p.z + 1.2 }, trabajo: 60 };
    } else if ((esNoche(s) && n.energia < 90) || n.energia < 20) {
      const dd = a.tipo === 'perro' ? LUGAR.caseta : { x: LUGAR.banca.x, z: LUGAR.banca.z - 0.05 };
      a.tarea = { tipo: 'dormir', fase: 'camino', destino: { ...dd }, trabajo: 0 };
    } else if (tiene(a, 'leal')) {
      const amo = s.agentes.filter((x) => x.tipo === 'humano' && x.vivo && !x.dentro)
        .sort((x, y) => Math.hypot(x.pos.x - a.pos.x, x.pos.z - a.pos.z) - Math.hypot(y.pos.x - a.pos.x, y.pos.z - a.pos.z))[0];
      const dd = amo ? { x: amo.pos.x + 1.4, z: amo.pos.z + 1.0 } : { x: LUGAR.puerta.x + 1.2, z: LUGAR.puerta.z + 1.5 };
      a.tarea = { tipo: 'seguir', fase: 'camino', destino: dd, trabajo: 10 };
    } else {
      a.tarea = { tipo: 'siesta', fase: 'camino', destino: { x: LUGAR.banca.x + (rng(s) - 0.5) * 2, z: LUGAR.banca.z - 0.05 }, trabajo: 90 };
    }
  }
  const T = a.tarea;
  a.accion = ACCION[T.tipo] || T.tipo;
  if (T.fase === 'camino') { if (mover(a, T.destino, d)) T.fase = 'trabajo'; return; }
  if (T.tipo === 'dormir') {
    n.energia = Math.min(100, n.energia + (15 / 60) * d);
    if ((!esNoche(s) && n.energia >= 95) || n.agua < 20 || n.comida < 20) a.tarea = null;
    return;
  }
  T.trabajo -= d;
  if (T.trabajo > 0) return;
  if (T.tipo === 'comer' && R.comedero >= 0.3) { const c = a.tipo === 'gato' ? 0.3 : 0.5; R.comedero = Math.max(0, R.comedero - c); n.comida = Math.min(100, n.comida + 45); }
  if (T.tipo === 'beber' && R.bebedero >= 0.5) { R.bebedero = Math.max(0, R.bebedero - 0.5); n.agua = Math.min(100, n.agua + 40); }
  if (T.tipo === 'cazar' && rng(s) < 0.4) { n.comida = Math.min(100, n.comida + 35); log(s, `${a.nombre} cazó un ratón en el huerto.`, 'info'); }
  a.tarea = null;
}

// ---------------------------------------------------------------- guardar / cargar
const CLAVE = 'granja3d-partida', CLAVE_HIST = 'granja3d-historial';
export function guardar(s) { try { s.guardadoReal = Date.now(); localStorage.setItem(CLAVE, JSON.stringify(s)); return true; } catch { return false; } }
export function cargar() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE)); return s && s.version === VERSION && s.config === CONFIG ? s : null; } catch { return null; }
}
export function borrarPartida() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }
export function historial() { try { return JSON.parse(localStorage.getItem(CLAVE_HIST)) || []; } catch { return []; } }
export function registrarGeneracion(s) {
  const h = historial();
  if (!h.some((x) => x.generacion === s.generacion && x.config === s.config)) {
    h.unshift({ generacion: s.generacion, config: s.config, dias: s.fin.dias, cosechas: s.stats.cosechas,
      muertes: s.agentes.filter((a) => !a.vivo).map((a) => `${a.nombre} (${a.causa})`) });
    try { localStorage.setItem(CLAVE_HIST, JSON.stringify(h.slice(0, 30))); } catch { /* sin almacenamiento */ }
  }
  return h;
}
