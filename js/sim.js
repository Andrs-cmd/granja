// =====================================================================
// Motor de simulación de la granja (lógica pura, sin Three.js).
// Agentes autónomos basados en necesidades, personalidad (Big Five),
// hábitos, ánimo, relación de pareja y desencadenantes del entorno.
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
export const VERSION = 3;

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
  mirador: { x: 12.4, z: 18.4 },     // esquina del bloque para contemplar
  taller: { x: 6.2, z: 10.2 },       // tronco donde se talla madera
};
export const PASEO = [{ x: -8.6, z: 8.0 }, { x: -8.6, z: 21.8 }, { x: 13.4, z: 21.8 }, { x: 13.4, z: 8.0 }, { x: 1.0, z: 8.6 }];
export const PARCELAS = [
  { x: -1.3, z: 16.7 }, { x: 3.0, z: 16.7 }, { x: 7.3, z: 16.7 },
  { x: -1.3, z: 19.5 }, { x: 3.0, z: 19.5 }, { x: 7.3, z: 19.5 },
];
export const HABILIDADES = { huerto: 'Huerto', agua: 'Agua', cuidado: 'Cuidado', casa: 'Cocina y casa' };
const AREA = { sembrar: 'huerto', regar: 'huerto', cosechar: 'huerto', limpiar: 'huerto', sacarAgua: 'agua', filtrar: 'agua', alimentar: 'cuidado', cocinar: 'casa', limpiarCasa: 'casa' };

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

// ---------------------------------------------------------------- ficha, rasgos y habilidades
export const ficha = (a) => PERSONAJES.find((p) => p.id === a.id) || {};
const P5 = (a, k) => ficha(a).personalidad?.[k] ?? 0.5;
const HAB = (a) => ficha(a).habitos || {};
export function mod(a, clave) {
  let m = 1;
  for (const r of a.rasgos) { const v = RASGOS[r]?.mod?.[clave]; if (v != null) m *= v; }
  return m;
}
const tiene = (a, clave) => a.rasgos.some((r) => RASGOS[r]?.mod?.[clave] != null);
export const nivel = (xp) => Math.min(10, Math.floor(Math.sqrt(xp / 120)));
const HORARIO = { madrugador: [5.5, 21.5], normal: [6.5, 22.5], noctambulo: [8.0, 24.5] };
const horario = (a) => HORARIO[HAB(a).cronotipo] || HORARIO.normal;
function horaDeDormir(s, a) {
  const [desp, dorm] = horario(a), h = hora(s);
  return dorm > 24 ? h >= dorm - 24 && h < desp : h >= dorm || h < desp;
}
const despierto = (s, a) => !horaDeDormir(s, a);
const pareja = (s, a) => s.agentes.find((x) => x !== a && x.tipo === 'humano' && x.vivo);
const humanos = (s) => s.agentes.filter((x) => x.tipo === 'humano' && x.vivo);

// escasez: poca comida o agua guardada para los vivos
export function escasez(s) {
  const vivos = humanos(s).length || 1;
  return s.rec.raciones < vivos * 1.4 * 3 || s.rec.potable + s.rec.cruda * 0.5 < vivos * 3.5 * 2;
}
const estres = (s, a) => (escasez(s) ? HAB(a).estres : null);

// ---------------------------------------------------------------- ánimo
// el ánimo sale de las necesidades + "recuerdos" que se desvanecen (moodlets)
function recuerdo(s, a, texto, valor, horas = 12) {
  if (!a || !a.vivo || a.tipo !== 'humano') return;
  const v = valor < 0 ? valor * (0.6 + P5(a, 'neuroticismo') * 0.9) : valor;
  a.recuerdos = a.recuerdos.filter((r) => r.texto !== texto);
  a.recuerdos.push({ texto, valor: Math.round(v), hasta: s.t + horas * 60 });
}
function calcularAnimo(s, a) {
  const n = a.n;
  const base = (n.comida * 0.9 + n.agua * 0.9 + n.energia * 0.7 + n.salud * 0.5 + n.social + n.diversion) / 5 * 0.82;
  a.recuerdos = a.recuerdos.filter((r) => r.hasta > s.t);
  const casa = s.casa.limpieza < 30 ? -6 : s.casa.limpieza > 75 ? 3 : 0;
  a.animo = Math.max(0, Math.min(100, base + a.recuerdos.reduce((t, r) => t + r.valor, 0) + casa));
}
export const caraAnimo = (v) => (v >= 80 ? '😄' : v >= 62 ? '🙂' : v >= 45 ? '😐' : v >= 28 ? '😟' : '😢');
const irritable = (a) => a.n.comida < 20 || a.n.energia < 20 || a.animo < 30;

// ---------------------------------------------------------------- partida nueva
function nuevoAgente(p) {
  const humano = p.tipo === 'humano';
  return {
    id: p.id, tipo: p.tipo, nombre: p.nombre, rasgos: [...p.rasgos], vivo: true,
    pos: { ...(p.tipo === 'perro' ? LUGAR.caseta : p.tipo === 'gato' ? LUGAR.banca : LUGAR.puerta) },
    dentro: humano, n: { comida: 85, agua: 85, energia: 90, salud: 100, social: 70, diversion: 70 },
    animo: 70, recuerdos: [], xp: { huerto: 0, agua: 0, cuidado: 0, casa: 0 },
    tarea: null, accion: 'Descansando', murio: null, causa: null,
    edad: p.edad ?? (humano ? 30 : 3), enfermo: 0, animo_buff: 0, ultimoAbrazo: 0, abrazo: 0,
  };
}
export function nuevaPartida({ semilla = Date.now(), inicio = 6 * 60, generacion = 1 } = {}) {
  const s = {
    version: VERSION, config: CONFIG, rng: semilla | 0, generacion,
    t: inicio, t0: inicio,
    clima: { lluvia: false, lluviaHoy: null },
    rec: { potable: 30, cruda: 120, raciones: 45, comedero: 2, bebedero: 6, semillas: { lechuga: 8, papa: 6, frijol: 6, maiz: 4 } },
    casa: { limpieza: 80 },
    pareja: { afinidad: 70, discusiones: 0, charlas: 0, intimidad: 0, ultimaCena: -1, ultimaIntimidad: -1, recetaNueva: false },
    parcelas: PARCELAS.map((p, i) => ({ id: i, x: p.x, z: p.z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null })),
    agentes: PERSONAJES.map(nuevoAgente),
    ultimaCosecha: null, efectos: [],
    diario: [], stats: { cosechas: 0, raciones: 0, litrosPozo: 0, litrosLluvia: 0 },
    escasez: false, sequia: 0, fin: null,
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
// efectos visuales momentáneos para la escena (corazones, nubecitas de discusión…)
function efecto(s, tipo, x, z, extra = {}) { s.efectos.push({ tipo, x, z, t: s.t, ...extra }); if (s.efectos.length > 20) s.efectos.shift(); }

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
  s.efectos = s.efectos.filter((e) => s.t - e.t < 6);

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
      const r = humanos(s).filter((a) => HAB(a).estres).map((a) => `${a.nombre} ${HAB(a).estres === 'trabaja' ? 'trabaja más duro' : 'empieza a racionar'}`);
      log(s, `Escasean las reservas.${r.length ? ' ' + r.join('; ') + '.' : ''}`, 'aviso');
      humanos(s).forEach((a) => recuerdo(s, a, 'Preocupación por las reservas', -10, 24));
    }
  }
  s.casa.limpieza = Math.max(0, s.casa.limpieza - (9 / MIN_DIA) * d * (s.agentes.some((a) => a.vivo && a.tipo !== 'humano') ? 1.2 : 1));
  actualizarParcelas(s, d);
  for (const a of s.agentes) if (a.vivo) { necesidades(s, a, d); comportamiento(s, a, d); }
  encuentros(s);
}

function nuevoDia(s) {
  if (s.sequia > 0 && --s.sequia === 0) log(s, 'Terminó la sequía.', 'clima');
  decidirClima(s);
  s.rec.raciones *= 0.992;
  eventos(s);
  if (dia(s) % DIAS_ESTACION === 0) {
    const e = estacion(s);
    log(s, `Comienza ${ESTACIONES[e].toLowerCase()}${e === 3 ? ': no crece nada hasta la primavera' : ''}.`, 'clima');
    if (e === 0 && diasVividos(s) > 0) {
      log(s, `¡Sobrevivieron un año más! Ya van ${Math.round(diasVividos(s) / DIAS_ANIO)}.`, 'logro');
      humanos(s).forEach((a) => recuerdo(s, a, 'Otro año juntos', 12, 48));
    }
  }
}

// ---------------------------------------------------------------- eventos de la naturaleza y de la vida
const LONGEVIDAD = { humano: 70, perro: 13, gato: 16 };
function perdidaDeCosecha(s, texto) {
  for (const a of humanos(s)) {
    if (P5(a, 'neuroticismo') > 0.5 && rng(s) < 0.6) { recuerdo(s, a, 'Lloró por la cosecha perdida', -14, 24); log(s, `${a.nombre} se puso a llorar: ${texto}.`, 'malo'); }
    else if (P5(a, 'responsabilidad') > 0.6) { recuerdo(s, a, 'Decidido a hacerlo mejor', -3, 12); a.animo_buff = s.t + MIN_DIA; log(s, `${a.nombre} se propuso que no vuelva a pasar.`, 'info'); }
    else recuerdo(s, a, 'Se perdió una cosecha', -8, 18);
  }
}
function eventos(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION;
  if (e === 1 && dE === 0 && rng(s) < 0.35) { s.sequia = 10 + Math.floor(rng(s) * 12); s.clima.lluviaHoy = null; log(s, `Empieza una sequía: no lloverá en unos ${s.sequia} días y el pozo rinde la mitad.`, 'malo'); }
  const creciendo = s.parcelas.filter((p) => p.estado === 'creciendo');
  if (e !== 3 && creciendo.length && rng(s) < 0.025) {
    const p = creciendo[Math.floor(rng(s) * creciendo.length)];
    const gato = s.agentes.find((a) => a.vivo && tiene(a, 'cazador'));
    const perro = s.agentes.find((a) => a.vivo && tiene(a, 'leal'));
    if (gato && rng(s) < 0.45) log(s, `Una plaga de ratones atacó la parcela ${p.id + 1}, pero ${gato.nombre} la ahuyentó.`, 'bueno');
    else if (perro && perro.n.diversion > 40 && rng(s) < 0.4) log(s, `${perro.nombre} espantó a los animales que querían comerse la parcela ${p.id + 1}.`, 'bueno');
    else { p.estado = 'muerta'; log(s, `Una plaga acabó con ${CULTIVOS[p.cultivo].nombre.toLowerCase()} de la parcela ${p.id + 1}.`, 'malo'); perdidaDeCosecha(s, 'una plaga se comió una parcela'); }
  }
  if (e === 2 && dE === 23 && rng(s) < 0.4) {
    const muertas = s.parcelas.filter((p) => p.estado === 'creciendo');
    muertas.forEach((p) => { p.estado = 'muerta'; });
    log(s, `Helada temprana${muertas.length ? `: se perdieron ${muertas.length} parcelas` : ''}.`, 'malo');
    if (muertas.length) perdidaDeCosecha(s, 'la helada quemó el huerto');
  }
  for (const a of s.agentes) {
    if (!a.vivo) continue;
    a.edad += 1 / DIAS_ANIO;
    if (a.enfermo > 0) { if (--a.enfermo === 0) log(s, `${a.nombre} se recuperó.`, 'bueno'); }
    else if (a.tipo === 'humano' && rng(s) < 0.004 * (1 + Math.max(0, a.edad - 45) / 15) * (a.n.salud < 60 ? 2 : 1) * mod(a, 'enfermar')) {
      a.enfermo = 3 + Math.floor(rng(s) * 5);
      log(s, `${a.nombre} cayó enfermo${a.n.salud < 60 ? ' (estaba débil)' : ''}: estará lento unos días.`, 'malo');
      recuerdo(s, pareja(s, a), `Preocupación por ${a.nombre}`, -6, 48);
    }
    const L = LONGEVIDAD[a.tipo], sobra = a.edad - L * 0.85;
    if (sobra > 0 && rng(s) < 0.002 + sobra * 0.004) morir(s, a, 'de vejez');
  }
  // la relación se enfría sola si no se cuida
  s.pareja.afinidad = Math.max(0, s.pareja.afinidad - 2.2);
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
        perdidaDeCosecha(s, `se secó ${C.nombre.toLowerCase()}`);
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

// qué sembrar: lo que alcance a madurar; los abiertos a la experiencia varían más y cada quien favorece su comida favorita
function elegirCultivo(s, a) {
  const e = estacion(s), quedan = DIAS_ESTACION - (dia(s) % DIAS_ESTACION) - hora(s) / 24;
  const opciones = [];
  for (const [k, C] of Object.entries(CULTIVOS)) {
    if ((s.rec.semillas[k] || 0) < 1 || !C.estaciones.includes(e)) continue;
    if (!C.estaciones.includes((e + 1) % 4) && C.dias > quedan - 0.5) continue;
    let p = C.raciones / C.dias;
    if (HAB(a).comida === k) p *= 1.15;
    if (s.parcelas.some((x) => x.cultivo === k)) p *= 1 - P5(a, 'apertura') * 0.35;   // variedad
    opciones.push([p, k]);
  }
  opciones.sort((x, y) => y[0] - x[0]);
  return opciones[0]?.[1] || null;
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
  const durmiendo = a.tarea && ['dormir', 'dormirCon'].includes(a.tarea.tipo) && a.tarea.fase === 'trabajo';
  const trabajando = a.tarea && a.tarea.fase === 'trabajo' && AREA[a.tarea.tipo];
  if (durmiendo) n.energia = Math.min(100, n.energia + 15 * k);
  else n.energia = Math.max(0, n.energia - (T.energia + (trabajando ? 4 : 0)) * mod(a, 'cansancio') * (est === 'trabaja' && trabajando ? 1.25 : 1) * k);
  // compañía y diversión bajan mientras está despierto (la compañía más rápido en los extrovertidos)
  if (!durmiendo) {
    n.social = Math.max(0, n.social - (a.tipo === 'humano' ? 2 + P5(a, 'extraversion') * 3 : 1.5) * k);
    n.diversion = Math.max(0, n.diversion - (a.tipo === 'humano' ? 3 : 2.5) * (trabajando ? 1.4 : 1) * k);
  }
  let dS = 0;
  if (n.comida <= 0) dS -= 4;
  if (n.agua <= 0) dS -= 6;
  if (n.energia <= 0) dS -= 1;
  if (a.enfermo > 0) dS -= 0.85;
  const vejez = Math.max(0, (a.edad - LONGEVIDAD[a.tipo] * 0.7) / (LONGEVIDAD[a.tipo] * 0.3));
  if (n.comida > 40 && n.agua > 40 && n.energia > 15) dS += 0.6 * (1 - 0.7 * Math.min(1, vejez));
  n.salud = Math.min(100, Math.max(0, n.salud + dS * k));
  if (a.tipo === 'humano') calcularAnimo(s, a);
  if (n.salud <= 0) morir(s, a);
}

function morir(s, a, causa) {
  a.vivo = false; a.murio = s.t; a.dentro = false;
  a.causa = causa || (a.n.agua <= 0 ? 'de sed' : a.n.comida <= 0 ? 'de hambre' : a.enfermo > 0 ? 'de una enfermedad' : 'de agotamiento');
  soltarTarea(s, a);
  a.accion = 'Murió';
  log(s, `${a.nombre} murió ${a.causa}. 🕯️`, 'muerte');
  for (const o of humanos(s)) recuerdo(s, o, `Duelo por ${a.nombre}`, a.tipo === 'humano' ? -35 : -18, a.tipo === 'humano' ? 24 * 14 : 24 * 5);
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
const DENTRO = ['comer', 'beber', 'dormir', 'filtrar', 'cocinar', 'cenar', 'limpiarCasa'];
const DURACION = {
  comer: 30, beber: 3, dormir: 60, filtrar: 60, sacarAgua: 60, regar: 12, sembrar: 20, cosechar: 30, limpiar: 15, alimentar: 10,
  descansar: 40, leer: 60, tallar: 50, contemplar: 35, jugarGato: 25, pasearPerro: 0, conversar: 25, cocinar: 45, cenar: 35, limpiarCasa: 40, siesta: 50,
};
const OCIOS = ['descansar', 'leer', 'tallar', 'contemplar', 'siesta'];
function crearTarea(s, a, tipo, extra = {}) {
  const t = { tipo, fase: 'camino', trabajo: DURACION[tipo] ?? 30, ...extra };
  const izq = a.id === s.agentes[0].id;
  if (DENTRO.includes(tipo)) { t.destino = { ...LUGAR.puerta }; t.dentro = true; }
  else if (t.parcela != null) { const p = s.parcelas[t.parcela]; t.destino = { x: p.x, z: p.z - 1.3 }; p.reservada = a.id; }
  else if (tipo === 'sacarAgua') t.destino = { x: LUGAR.pozo.x + 1.2, z: LUGAR.pozo.z };
  else if (tipo === 'alimentar') t.destino = { x: LUGAR.comedero.x + 0.9, z: LUGAR.comedero.z + 0.3 };
  else if (tipo === 'descansar' || tipo === 'leer' || tipo === 'siesta') t.destino = { x: LUGAR.banca.x + (izq ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
  else if (tipo === 'tallar') t.destino = { x: LUGAR.taller.x, z: LUGAR.taller.z + 0.9 };
  else if (tipo === 'contemplar') t.destino = { x: LUGAR.mirador.x + (izq ? -0.6 : 0.6), z: LUGAR.mirador.z };
  else if (tipo === 'pasearPerro') { t.ruta = PASEO.map((p) => ({ ...p })); t.destino = t.ruta.shift(); }
  else if (tipo === 'jugarGato') { const g = s.agentes.find((x) => x.tipo === 'gato' && x.vivo); t.destino = g ? { x: g.pos.x + 1.0, z: g.pos.z + 0.6 } : { ...LUGAR.banca }; }
  a.tarea = t;
  return t;
}
function mover(a, destino, d) {
  const dx = destino.x - a.pos.x, dz = destino.z - a.pos.z, dist = Math.hypot(dx, dz), v = VEL[a.tipo] * d;
  if (dist <= v) { a.pos.x = destino.x; a.pos.z = destino.z; return true; }
  a.pos.x += (dx / dist) * v; a.pos.z += (dz / dist) * v;
  return false;
}
const ocupadoEn = (b, tipos) => b && b.tarea && tipos.includes(b.tarea.tipo);
const libreParaPareja = (s, b) => b && b.vivo && despierto(s, b) && (!b.tarea || OCIOS.includes(b.tarea.tipo)) && b.n.comida > 25 && b.n.agua > 25;
const consumoAgua = (s) => humanos(s).length * 3.5;

// invita a la pareja a conversar (afuera de día, adentro de noche)
function invitar(s, a, tipo) {
  const b = pareja(s, a);
  if (!libreParaPareja(s, b)) return false;
  const afuera = !esNoche(s) && hora(s) < 19.5;
  const cita = s.t;
  for (const [x, lado] of [[a, -1], [b, 1]]) {
    soltarTarea(s, x);
    const t = crearTarea(s, x, tipo, { cita });
    if (afuera) { t.destino = { x: LUGAR.banca.x + lado * 0.75, z: LUGAR.banca.z + 1.7 }; t.dentro = false; }
    else { t.destino = { ...LUGAR.puerta }; t.dentro = true; }
  }
  return true;
}

function elegirTarea(s, a) {
  const n = a.n, R = s.rec, est = estres(s, a), resp = P5(a, 'responsabilidad'), h = hora(s);
  const otro = pareja(s, a);
  // 1. supervivencia
  if (n.agua < 40 && (R.potable >= 1 || R.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.comida < (est === 'raciona' ? 25 : 40) && R.raciones >= 1) return crearTarea(s, a, 'comer');
  if (n.energia < 18) return crearTarea(s, a, 'dormir');
  if (horaDeDormir(s, a) && n.energia < 92) return crearTarea(s, a, 'dormir');

  // 2. cena juntos (19:00–20:30): cocina quien tenga más mano para la casa o más apertura
  if (h >= 19 && h < 20.5 && s.pareja.ultimaCena !== dia(s) && R.raciones >= 2) {
    const cocinero = otro && despierto(s, otro)
      ? [a, otro].sort((x, y) => (nivel(y.xp.casa) + P5(y, 'apertura') * 3) - (nivel(x.xp.casa) + P5(x, 'apertura') * 3))[0] : a;
    if (cocinero === a && !ocupadoEn(otro, ['cocinar'])) { s.pareja.ultimaCena = dia(s); return crearTarea(s, a, 'cocinar'); }
  }

  // 3. trabajo de la granja por urgencia; la responsabilidad adelanta tareas y el rol desempata
  const libre = (p) => !p.reservada;
  const yaHace = (tipo) => otro && otro.tarea && otro.tarea.tipo === tipo;
  const umbralRiego = 30 + resp * 25;
  const opciones = [];
  if (R.potable < Math.max(8, consumoAgua(s)) && R.cruda >= 5 && !yaHace('filtrar')) opciones.push([100, 'filtrar']);
  { const p = s.parcelas.find((p) => p.estado === 'lista' && libre(p)); if (p) opciones.push([90, 'cosechar', { parcela: p.id }]); }
  if (R.cruda >= 8) { const p = s.parcelas.find((p) => p.estado === 'creciendo' && p.agua < umbralRiego && libre(p)); if (p) opciones.push([85, 'regar', { parcela: p.id }]); }
  if (R.cruda < 60 && !yaHace('sacarAgua')) opciones.push([80, 'sacarAgua']);
  { const c = elegirCultivo(s, a); const p = c && s.parcelas.find((p) => p.estado === 'vacia' && libre(p)); if (p) opciones.push([70, 'sembrar', { parcela: p.id, cultivo: c }]); }
  if ((R.comedero < 0.5 || R.bebedero < 2) && (R.raciones >= 1 || R.cruda >= 3) && !yaHace('alimentar') && s.agentes.some((x) => x.tipo !== 'humano' && x.vivo)) opciones.push([65, 'alimentar']);
  { const p = s.parcelas.find((p) => p.estado === 'muerta' && libre(p)); if (p) opciones.push([60, 'limpiar', { parcela: p.id }]); }
  if (s.casa.limpieza < 25 + resp * 35 && !yaHace('limpiarCasa')) opciones.push([45 + resp * 15, 'limpiarCasa']);
  if (R.potable < consumoAgua(s) * (3 + resp * 4) && R.cruda >= 30 && !yaHace('filtrar')) opciones.push([40, 'filtrar']);
  if (R.cruda < 150 + resp * 200 && !yaHace('sacarAgua') && estacion(s) !== 0) opciones.push([35, 'sacarAgua']);

  // 4. ocio y vida social compiten con lo menos urgente
  const ocio = [];
  const gustos = HAB(a).ocio || [];
  const gusto = (k) => (gustos.includes(k) ? 1.6 - gustos.indexOf(k) * 0.2 : 0.6);
  const necesitaOcio = (100 - n.diversion) * 0.7;
  const necesitaSocial = (100 - n.social) * (0.4 + P5(a, 'extraversion') * 0.8);
  const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo && !x.dentro);
  const perro = s.agentes.find((x) => x.tipo === 'perro' && x.vivo);
  const luz = h >= 6.5 && h < 20.5;
  if (luz) {
    ocio.push([necesitaOcio * gusto('leer'), 'leer']);
    ocio.push([necesitaOcio * gusto('tallar'), 'tallar']);
    ocio.push([necesitaOcio * gusto('contemplar') * (h > 17.5 ? 1.5 : 1), 'contemplar']);
    if (gato && !ocupadoEn(otro, ['jugarGato'])) ocio.push([necesitaOcio * gusto('jugarGato') * (0.5 + (HAB(a).animales?.esmoquin ?? 0.5)), 'jugarGato']);
    if (perro && perro.n.diversion < 55 && !ocupadoEn(otro, ['pasearPerro'])) ocio.push([(necesitaOcio + (100 - perro.n.diversion) * 0.5) * gusto('pasearPerro') * (0.5 + (HAB(a).animales?.nube ?? 0.5)), 'pasearPerro']);
  }
  if (otro && libreParaPareja(s, otro) && !irritable(a)) ocio.push([necesitaSocial * 1.2, 'conversar']);
  if (h >= 13 && h < 15.5 && n.energia < 60) ocio.push([60 - n.energia, 'siesta']);
  ocio.sort((x, y) => y[0] - x[0]);

  const rol = HAB(a).rol, rolOtro = otro && HAB(otro).rol;
  const otroLibre = otro && despierto(s, otro) && (!otro.tarea || OCIOS.includes(otro.tarea.tipo));
  opciones.forEach((o) => {
    if (rol && AREA[o[1]] === rol) o[0] += 25;
    else if (otroLibre && rolOtro && AREA[o[1]] === rolOtro && o[0] < 95) o[0] -= 30;   // eso le toca a la pareja
  });
  opciones.sort((x, y) => y[0] - x[0]);
  const trabajo = opciones[0], gana = ocio[0];
  // el ocio solo le gana al trabajo poco urgente, y menos a quien es responsable
  if (gana && gana[0] > 18 && (!trabajo || gana[0] > trabajo[0] * (0.55 + resp * 0.6))) {
    if (gana[1] === 'conversar') { if (invitar(s, a, 'conversar')) return a.tarea; }
    else if (gana[1] !== a.ultimoOcio || gana[0] > 45) { a.ultimoOcio = gana[1]; return crearTarea(s, a, gana[1]); }
  }
  if (trabajo) { const [, tipo, extra] = trabajo; return crearTarea(s, a, tipo, extra); }

  // 5. tiempo libre sin nada pendiente
  if (n.agua < 65 && R.potable >= 1) return crearTarea(s, a, 'beber');
  if (n.comida < 55 && R.raciones >= 1 && est !== 'raciona' && h > 11.5 && h < 13.5) return crearTarea(s, a, 'comer');
  const libres = ocio.filter((o) => o[1] !== 'conversar' && o[1] !== 'siesta');
  if (libres.length && luz) {
    // elige con algo de azar entre sus gustos y evita repetir lo último que hizo
    const pesos = libres.map(([v, k]) => Math.max(4, v) * gusto(k) * (k === a.ultimoOcio ? 0.25 : 1));
    let r = rng(s) * pesos.reduce((x, y) => x + y, 0), i = 0;
    while (i < pesos.length - 1 && (r -= pesos[i]) > 0) i++;
    a.ultimoOcio = libres[i][1];
    return crearTarea(s, a, libres[i][1]);
  }
  if (luz) return crearTarea(s, a, 'descansar');
  return crearTarea(s, a, n.energia < 92 ? 'dormir' : 'leer');
}

export const ACCION = {
  comer: 'Comiendo', beber: 'Bebiendo', dormir: 'Durmiendo', filtrar: 'Filtrando agua', sacarAgua: 'Sacando agua del pozo',
  regar: 'Regando', sembrar: 'Sembrando', cosechar: 'Cosechando', limpiar: 'Limpiando una parcela', alimentar: 'Alimentando a los animales', descansar: 'Descansando en la banca',
  leer: 'Leyendo', tallar: 'Tallando madera', contemplar: 'Contemplando el paisaje', jugarGato: 'Jugando con el gato', pasearPerro: 'Paseando al perro',
  conversar: 'Conversando', cocinar: 'Cocinando la cena', cenar: 'Cenando juntos', limpiarCasa: 'Limpiando la casa', siesta: 'Tomando la siesta',
  seguir: 'Acompañando a la pareja', cazar: 'Cazando ratones', dormirCon: 'Durmiendo acurrucado', pedir: 'Pidiendo atención', jugar: 'Jugando', pasear: 'De paseo',
};
const VA_A = {
  comer: 'Va a comer', beber: 'Va a beber', dormir: 'Va a dormir', filtrar: 'Va a filtrar agua', sacarAgua: 'Va al pozo',
  regar: 'Va a regar', sembrar: 'Va a sembrar', cosechar: 'Va a cosechar', limpiar: 'Va a limpiar una parcela', alimentar: 'Va a alimentar a los animales',
  descansar: 'Va a la banca', leer: 'Va a leer', tallar: 'Va a tallar madera', contemplar: 'Va a mirar el paisaje', jugarGato: 'Va a jugar con el gato',
  pasearPerro: 'Paseando al perro', conversar: 'Va a conversar', cocinar: 'Va a cocinar', cenar: 'Va a cenar', limpiarCasa: 'Va a limpiar la casa', siesta: 'Va a la siesta',
};

const OCIO_LLENA = { leer: 0.7, tallar: 0.75, contemplar: 0.8, jugarGato: 1.1, descansar: 0.35, siesta: 0.3 };
function comportamiento(s, a, d) {
  if (a.tipo !== 'humano') return comportamientoAnimal(s, a, d);
  if (a.tarea && !['beber', 'comer', 'dormir', 'cenar'].includes(a.tarea.tipo) && ((a.n.agua < 20 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) || (a.n.comida < 20 && s.rec.raciones >= 1))) soltarTarea(s, a);
  if (!a.tarea) elegirTarea(s, a);
  const T = a.tarea;
  a.accion = T.fase === 'camino' ? VA_A[T.tipo] || ACCION[T.tipo] : ACCION[T.tipo];
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (a.dentro && T.dentro) { T.fase = 'trabajo'; return; }
    if (mover(a, T.destino, d)) {
      if (T.ruta && T.ruta.length) { T.destino = T.ruta.shift(); return; }
      if (T.tipo === 'pasearPerro') { terminarPaseo(s, a); return; }
      T.fase = 'trabajo'; if (T.dentro) a.dentro = true;
    }
    return;
  }
  if (T.tipo === 'dormir') {
    if (!horaDeDormir(s, a) && a.n.energia >= 95) { soltarTarea(s, a); despertar(s, a); }
    else if ((a.n.agua < 15 && s.rec.potable >= 1) || (a.n.comida < 15 && s.rec.raciones >= 1)) soltarTarea(s, a);
    return;
  }
  // actividades conjuntas: esperan a que llegue la otra persona
  if (T.cita != null) {
    const b = pareja(s, a);
    if (!b || !b.tarea || b.tarea.cita !== T.cita) { if (T.tipo !== 'cenar') { soltarTarea(s, a); return; } }
    else if (b.tarea.fase !== 'trabajo') return;
  }
  const area = AREA[T.tipo];
  const animoVel = a.animo < 30 ? 0.8 : a.animo > 70 ? 1.1 : 1;
  const vel = area ? mod(a, area) * (1 + 0.06 * nivel(a.xp[area])) * (estres(s, a) === 'trabaja' ? 1.2 : 1) * (a.enfermo > 0 ? 0.6 : 1) * animoVel * (a.animo_buff > s.t ? 1.15 : 1) : 1;
  if (area) {
    const antes = nivel(a.xp[area]);
    a.xp[area] += d * mod(a, 'aprende');
    if (nivel(a.xp[area]) > antes) log(s, `${a.nombre} mejoró en ${HABILIDADES[area].toLowerCase()}: nivel ${nivel(a.xp[area])}.`, 'logro');
  }
  if (OCIO_LLENA[T.tipo]) a.n.diversion = Math.min(100, a.n.diversion + OCIO_LLENA[T.tipo] * d * ((HAB(a).ocio || []).includes(T.tipo) ? 1.3 : 1));
  if (T.tipo === 'siesta') a.n.energia = Math.min(100, a.n.energia + 0.2 * d);
  if (T.tipo === 'conversar' || T.tipo === 'cenar') a.n.social = Math.min(100, a.n.social + 2.2 * d);
  if (T.tipo === 'jugarGato') {
    const g = s.agentes.find((x) => x.tipo === 'gato' && x.vivo);
    if (g) { g.n.diversion = Math.min(100, g.n.diversion + d); if (!g.tarea || g.tarea.tipo !== 'jugar') { g.tarea = { tipo: 'jugar', fase: 'trabajo', trabajo: T.trabajo, con: a.id }; g.dentro = false; } }
  }
  T.trabajo -= d * vel;
  if (OCIOS.includes(T.tipo) && necesitaTrabajo(s, a)) { soltarTarea(s, a); return; }
  if (T.trabajo > 0) return;
  completar(s, a, T);
  if (a.tarea === T) soltarTarea(s, a);
}
const necesitaTrabajo = (s, a) => s.parcelas.some((p) => !p.reservada && (p.estado === 'lista' || (p.estado === 'creciendo' && p.agua < 25 + P5(a, 'responsabilidad') * 20)))
  || s.rec.potable < 8 || s.rec.cruda < 60;

function despertar(s, a) {
  const otro = pareja(s, a);
  if (otro && otro.tarea?.tipo === 'dormir' && HAB(a).cronotipo === 'madrugador' && HAB(otro).cronotipo === 'noctambulo' && rng(s) < 0.05) {
    log(s, `${a.nombre} madrugó a revisar el huerto mientras ${otro.nombre} seguía durmiendo.`, 'info');
  }
}

function terminarPaseo(s, a) {
  const perro = s.agentes.find((x) => x.tipo === 'perro' && x.vivo);
  if (perro) { perro.n.diversion = Math.min(100, perro.n.diversion + 60); perro.n.energia = Math.max(0, perro.n.energia - 8); }
  a.n.diversion = Math.min(100, a.n.diversion + 30);
  recuerdo(s, a, 'Un buen paseo con el perro', 6, 8);
  soltarTarea(s, a);
}

const primerHumano = (s) => s.agentes.find((x) => x.tipo === 'humano' && x.vivo);
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
    case 'comer': {
      // los amables comparten cuando escasea y la pareja tiene más hambre
      const otro = pareja(s, a);
      if (R.raciones >= 1 && escasez(s) && otro && otro.n.comida < a.n.comida - 15 && P5(a, 'amabilidad') > 0.6 && rng(s) < 0.5) {
        R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + 15); otro.n.comida = Math.min(100, otro.n.comida + 23);
        recuerdo(s, otro, `${a.nombre} compartió su comida`, 10, 24); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 3);
        log(s, `${a.nombre} compartió su ración con ${otro.nombre}.`, 'bueno');
      } else if (R.raciones >= 1) {
        R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + 38);
        if (s.ultimaCosecha === HAB(a).comida && rng(s) < 0.5) recuerdo(s, a, `Comió ${CULTIVOS[HAB(a).comida].nombre.toLowerCase()}, su favorita`, 5, 6);
      }
      break;
    }
    case 'cocinar': {
      // la cena es para los dos; la apertura inventa recetas nuevas que alegran más
      const otro = pareja(s, a);
      s.pareja.recetaNueva = rng(s) < P5(a, 'apertura') * 0.5;
      if (s.pareja.recetaNueva) log(s, `${a.nombre} probó una receta nueva para la cena.`, 'info');
      const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo);
      if (gato && rng(s) < 0.2) log(s, `${gato.nombre} maulló sin parar mientras ${a.nombre} cocinaba.`, 'info');
      const cita = s.t;
      const juntos = !!(otro && despierto(s, otro) && otro.tarea?.tipo !== 'dormir' && otro.n.comida < 97);
      crearTarea(s, a, 'cenar', { cita, juntos });
      a.tarea.fase = 'trabajo';
      if (juntos) { soltarTarea(s, otro); crearTarea(s, otro, 'cenar', { cita, juntos }); }
      return;
    }
    case 'cenar': {
      const otro = pareja(s, a);
      if (R.raciones >= 1) { R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + 45); }
      const juntos = T.juntos && otro;
      recuerdo(s, a, juntos ? 'Cena juntos' : 'Cenó a solas', juntos ? 8 + (s.pareja.recetaNueva ? 4 : 0) : -2, 14);
      if (juntos && s.pareja.cenaResuelta !== T.cita) { s.pareja.cenaResuelta = T.cita; s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 2.5); efecto(s, 'corazones', 0.5, 0, { techo: true }); }
      break;
    }
    case 'conversar': {
      const otro = pareja(s, a);
      if (!otro || s.pareja.resuelta === T.cita) break;   // el resultado lo resuelve quien termine primero
      s.pareja.resuelta = T.cita;
      s.pareja.charlas += 1;
      const irr = (irritable(a) ? 1 : 0) + (irritable(otro) ? 1 : 0);
      const amab = (P5(a, 'amabilidad') + P5(otro, 'amabilidad')) / 2, neuro = (P5(a, 'neuroticismo') + P5(otro, 'neuroticismo')) / 2;
      const choque = Math.abs(P5(a, 'extraversion') - P5(otro, 'extraversion')) * 0.12 + Math.abs(P5(a, 'responsabilidad') - P5(otro, 'responsabilidad')) * 0.1;
      const pDisc = 0.03 + choque + (1 - amab) * 0.08 + neuro * 0.06 + irr * (0.3 * (1 - amab) + 0.15 * neuro) + (escasez(s) ? 0.08 : 0) + (s.casa.limpieza < 35 ? 0.05 : 0) - s.pareja.afinidad / 1200;
      const mid = { x: (a.pos.x + otro.pos.x) / 2, z: (a.pos.z + otro.pos.z) / 2 };
      if (rng(s) < pDisc) {
        s.pareja.afinidad = Math.max(0, s.pareja.afinidad - 6); s.pareja.discusiones += 1;
        const tema = escasez(s) ? 'por la comida' : s.casa.limpieza < 35 ? 'por la casa desordenada' : irritable(a) || irritable(otro) ? 'por el cansancio' : 'por una tontería';
        log(s, `${a.nombre} y ${otro.nombre} discutieron ${tema}.`, 'malo');
        recuerdo(s, a, 'Discutieron', -12, 16); recuerdo(s, otro, 'Discutieron', -12, 16);
        efecto(s, 'discusion', mid.x, mid.z, { dentro: a.dentro });
      } else {
        s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1.2);
        recuerdo(s, a, 'Buena conversación', 6, 10); recuerdo(s, otro, 'Buena conversación', 6, 10);
        efecto(s, 'charla', mid.x, mid.z, { dentro: a.dentro });
      }
      break;
    }
    case 'limpiarCasa': s.casa.limpieza = Math.min(100, s.casa.limpieza + 60); recuerdo(s, a, 'Casa limpia', 3, 12); break;
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
        s.stats.cosechas += 1; s.stats.raciones += rac; s.ultimaCosecha = p.cultivo;
        log(s, `${a.nombre} cosechó ${C.nombre.toLowerCase()}: +${rac} raciones y ${sem} semilla${sem > 1 ? 's' : ''}.`, 'bueno');
        recuerdo(s, a, 'Buena cosecha', 5, 10);
        Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 });
      }
      break;
    case 'limpiar': Object.assign(p, { cultivo: null, crec: 0, estado: 'vacia', secoMin: 0 }); break;
    case 'alimentar':
      if (R.raciones >= 1 && R.comedero < 2) { const c = Math.min(2 - R.comedero, R.raciones); R.raciones -= c; R.comedero += c; }
      if (R.cruda >= 1 && R.bebedero < 6) { const l = Math.min(6 - R.bebedero, R.cruda); R.cruda -= l; R.bebedero += l; }
      break;
    case 'jugarGato': recuerdo(s, a, 'Jugó con el gato', 5, 8); break;
    case 'leer': case 'tallar': case 'contemplar': recuerdo(s, a, { leer: 'Un buen libro', tallar: 'Talló algo bonito', contemplar: 'Un paisaje precioso' }[T.tipo], 4, 8); break;
  }
}

// ---------------------------------------------------------------- encuentros: abrazos al cruzarse e intimidad de noche
function encuentros(s) {
  const [a, b] = humanos(s);
  if (!a || !b) return;
  if (!a.dentro && !b.dentro && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.8 && s.t - Math.max(a.ultimoAbrazo, b.ultimoAbrazo) > 240
    && s.pareja.afinidad > 45 && !irritable(a) && !irritable(b) && despierto(s, a) && despierto(s, b)) {
    const ext = (P5(a, 'extraversion') + P5(b, 'extraversion')) / 2;
    if (rng(s) < 0.002 * (0.5 + ext) * (s.pareja.afinidad / 50)) {
      a.ultimoAbrazo = b.ultimoAbrazo = s.t;
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1.5);
      recuerdo(s, a, 'Un abrazo', 4, 6); recuerdo(s, b, 'Un abrazo', 4, 6);
      a.abrazo = b.abrazo = s.t;
      efecto(s, 'corazones', (a.pos.x + b.pos.x) / 2, (a.pos.z + b.pos.z) / 2);
    }
  }
  // intimidad: de noche, ambos acostados, a gusto, con la casa limpia y privacidad
  const h = hora(s);
  if (a.dentro && b.dentro && (h >= 21 || h < 1.5) && s.pareja.ultimaIntimidad !== dia(s)
    && [a, b].every((x) => x.n.energia > 35 && x.n.comida > 40 && x.n.agua > 40 && x.animo > 55 && x.tarea?.tipo === 'dormir')
    && s.pareja.afinidad > 60 && s.casa.limpieza > 40) {
    s.pareja.ultimaIntimidad = dia(s);
    const prob = 0.06 + (s.pareja.afinidad - 60) / 260 + (s.pareja.recetaNueva ? 0.05 : 0) + Math.min(0.1, (dia(s) - (s.pareja.diaIntimo ?? -99)) / 100);
    if (rng(s) > prob) return;
    const iniciativa = [a, b].sort((x, y) => (P5(y, 'extraversion') - P5(y, 'neuroticismo')) - (P5(x, 'extraversion') - P5(x, 'neuroticismo')))[0];
    const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo && x.dentro);
    if (gato && rng(s) < 0.4) {
      log(s, `Un momento romántico entre ${a.nombre} y ${b.nombre}… hasta que ${gato.nombre} saltó a la cama. 🐈‍⬛`, 'info');
      [a, b].forEach((x) => recuerdo(s, x, 'El gato interrumpió', 3, 8));
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1);
    } else {
      s.pareja.diaIntimo = dia(s);
      log(s, `${iniciativa.nombre} tomó la iniciativa: ${a.nombre} y ${b.nombre} pasaron un rato a solas. 💞`, 'bueno');
      [a, b].forEach((x) => recuerdo(s, x, 'Noche romántica', 14, 30));
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 5); s.pareja.intimidad += 1;
    }
    efecto(s, 'corazones', 0.5, 0, { techo: true });
  }
}

// ---------------------------------------------------------------- animales (con caprichos)
function comportamientoAnimal(s, a, d) {
  const R = s.rec, n = a.n;
  if (!a.tarea) {
    const gato = a.tipo === 'gato', perro = a.tipo === 'perro';
    const cocinando = humanos(s).find((h) => h.tarea?.tipo === 'cocinar' && h.tarea.fase === 'trabajo');
    if (n.agua < 45 && R.bebedero >= 0.5) a.tarea = { tipo: 'beber', fase: 'camino', destino: { x: LUGAR.comedero.x - 0.5, z: LUGAR.comedero.z + 0.4 }, trabajo: 3 };
    else if (n.comida < 45 && R.comedero >= 0.3) a.tarea = { tipo: 'comer', fase: 'camino', destino: { x: LUGAR.comedero.x + 0.3, z: LUGAR.comedero.z + 0.6 }, trabajo: 10 };
    else if (gato && cocinando && rng(s) < 0.02) a.tarea = { tipo: 'pedir', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 30, dentro: true };
    else if (n.comida < 45 && tiene(a, 'cazador')) {
      const p = s.parcelas[Math.floor(rng(s) * s.parcelas.length)];
      a.tarea = { tipo: 'cazar', fase: 'camino', destino: { x: p.x + (rng(s) - 0.5) * 3, z: p.z + 1.2 }, trabajo: 60, parcelaCaza: p.id };
    } else if ((esNoche(s) && n.energia < 90) || n.energia < 20) {
      // el gato duerme con quien esté más triste o estresado (y lo calma)
      const triste = gato ? humanos(s).filter((h) => h.dentro && h.tarea?.tipo === 'dormir').sort((x, y) => x.animo - y.animo)[0] : null;
      if (triste && triste.animo < 60) a.tarea = { tipo: 'dormirCon', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 0, dentro: true, con: triste.id };
      else a.tarea = { tipo: 'dormir', fase: 'camino', destino: { ...(perro ? LUGAR.caseta : { x: LUGAR.banca.x, z: LUGAR.banca.z - 0.05 }) }, trabajo: 0 };
    } else if (perro && tiene(a, 'leal')) {
      const paseador = humanos(s).find((h) => h.tarea?.tipo === 'pasearPerro');
      const amo = paseador || humanos(s).filter((x) => !x.dentro)
        .sort((x, y) => Math.hypot(x.pos.x - a.pos.x, x.pos.z - a.pos.z) - Math.hypot(y.pos.x - a.pos.x, y.pos.z - a.pos.z))[0];
      const dd = amo ? { x: amo.pos.x + (paseador ? 0.9 : 1.4), z: amo.pos.z + (paseador ? 0.6 : 1.0) } : { x: LUGAR.puerta.x + 1.2, z: LUGAR.puerta.z + 1.5 };
      a.tarea = { tipo: paseador ? 'pasear' : 'seguir', fase: 'camino', destino: dd, trabajo: paseador ? 1 : 10 };
    } else {
      a.tarea = { tipo: 'siesta', fase: 'camino', destino: { x: LUGAR.banca.x + (rng(s) - 0.5) * 2, z: LUGAR.banca.z - 0.05 }, trabajo: 60 + rng(s) * 60 };
    }
  }
  const T = a.tarea;
  a.accion = ACCION[T.tipo] || T.tipo;
  if (T.tipo === 'jugar') {   // jugando con un humano
    const h = s.agentes.find((x) => x.id === T.con);
    if (!h || h.tarea?.tipo !== 'jugarGato') { a.tarea = null; return; }
    a.n.diversion = Math.min(100, a.n.diversion + d);
    return;
  }
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (mover(a, T.destino, d)) { T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  if (T.tipo === 'dormir' || T.tipo === 'dormirCon') {
    if (T.tipo === 'dormirCon') {
      const h = s.agentes.find((x) => x.id === T.con);
      if (h && !T.calmo && h.animo < 60) { T.calmo = true; recuerdo(s, h, `${a.nombre} durmió a su lado`, 7, 14); }
    }
    if ((!esNoche(s) && n.energia >= 95) || n.agua < 20 || n.comida < 20) { a.tarea = null; if (a.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; } }
    return;
  }
  T.trabajo -= d;
  if (T.trabajo > 0) return;
  if (T.tipo === 'comer' && R.comedero >= 0.3) { const c = a.tipo === 'gato' ? 0.3 : 0.5; R.comedero = Math.max(0, R.comedero - c); n.comida = Math.min(100, n.comida + 45); }
  if (T.tipo === 'beber' && R.bebedero >= 0.5) { R.bebedero = Math.max(0, R.bebedero - 0.5); n.agua = Math.min(100, n.agua + 40); }
  if (T.tipo === 'cazar') {
    if (rng(s) < 0.4) { n.comida = Math.min(100, n.comida + 35); n.diversion = Math.min(100, n.diversion + 25); log(s, `${a.nombre} cazó un ratón en el huerto.`, 'info'); }
    else if (rng(s) < 0.08) { const p = s.parcelas[T.parcelaCaza]; if (p && p.estado === 'creciendo') { p.crec = Math.max(0, p.crec - 0.5); log(s, `${a.nombre} persiguió un insecto y pisoteó un poco la parcela ${p.id + 1}.`, 'info'); } }
  }
  if (T.tipo === 'pedir' && a.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
  if (T.tipo === 'siesta' || T.tipo === 'seguir') n.diversion = Math.min(100, n.diversion + 5);
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
