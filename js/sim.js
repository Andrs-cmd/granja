// =====================================================================
// Motor de simulación de la granja (lógica pura, sin Three.js).
// Agentes autónomos basados en necesidades, personalidad (Big Five),
// hábitos, ánimo, relación de pareja y desencadenantes del entorno
// (lluvia, calor, frío, arcoíris). Incluye animales de granja.
// El estado es JSON serializable (se guarda en localStorage).
// Tiempo en minutos de juego, con decimales: el motor avanza de forma continua.
// =====================================================================
import { PERSONAJES, RASGOS, CONFIG, GANADO, NOMBRES_CRIAS } from './personajes.js';
export { RASGOS, PERSONAJES, GANADO };

export const MIN_DIA = 1440;
export const DIAS_ESTACION = 28;
export const DIAS_ANIO = DIAS_ESTACION * 4;
export const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
export const TANQUE_MAX = 600;
export const VERSION = 4;

export const CULTIVOS = {
  // npk: lo que gasta del suelo en todo su ciclo (el fríjol devuelve nitrógeno: es leguminosa)
  lechuga: { nombre: 'Lechuga', dias: 7, raciones: 6, semillas: [1, 2], estaciones: [0, 2], npk: [14, 6, 10], frio: 0.6 },
  papa: { nombre: 'Papa', dias: 14, raciones: 14, semillas: [1, 2], estaciones: [0, 1, 2], npk: [22, 14, 30], frio: 1 },
  frijol: { nombre: 'Fríjol', dias: 12, raciones: 10, semillas: [1, 3], estaciones: [0, 1], npk: [-24, 12, 12], frio: 1 },
  maiz: { nombre: 'Maíz', dias: 18, raciones: 20, semillas: [1, 2], estaciones: [1], npk: [40, 14, 20], frio: 1.2 },
};

// ---------------------------------------------------------------- mapa (coordenadas de la escena)
export const BLOQUE = { x0: -34, x1: 38, z0: -28, z1: 40 };   // terreno ampliado (antes 44 × 44)
export const CASA = { x0: -6.4, x1: 12.4, z0: -6.6, z1: 6.6 };              // casa + terraza (no se atraviesa)
export const CORRAL = { x0: -31.5, x1: -9.8, z0: -25, z1: 22, puerta: { x: -9.8, z: 8.5 } };   // potrero grande
export const GALLINERO = { x0: 14.2, x1: 30, z0: -20, z1: -3.2, puerta: { x: 14.2, z: -5.0 } };
export const PISCINA = { x0: 14, x1: 21, z0: 11.5, z1: 17 };
export const LUGAR = {
  puerta: { x: -2.4, z: 7.0 },
  pozo: { x: -6.3, z: 10.6 },
  tanque: { x: 8.6, z: 8.8 },
  comedero: { x: -0.4, z: 7.6 },
  banca: { x: 3.0, z: 12.3 },
  caseta: { x: -7.4, z: 3.0 },
  mirador: { x: -14.0, z: 24.0 },
  taller: { x: 6.2, z: 10.2 },
  establo: { x: -16.2, z: -10.6 },
  pesebre: { x: -11.4, z: -2.0 },
  bebederoGanado: { x: -11.4, z: 2.6 },
  heno: { x: -12.6, z: -12.6 },
  compost: { x: -7.5, z: 26.5 },
  gallinero: { x: 19.0, z: -11.6 },
  grano: { x: 15.8, z: -6.0 },
  piscina: { x: 13.2, z: 14.2 },
};
export const PASEO = [{ x: -8.4, z: 8.6 }, { x: -8.4, z: 37.0 }, { x: 34.0, z: 37.0 }, { x: 34.0, z: 19.5 }, { x: 12.8, z: 19.0 }, { x: 12.8, z: 8.6 }, { x: 1.0, z: 8.6 }];
export const SUELO_INICIAL = { N: 62, P: 55, K: 58, ph: 6.5 };
const sueloNuevo = () => ({ ...SUELO_INICIAL, salud: 100, plaga: 0, plagaTipo: null, ultimo: null, encharcado: 0 });
export const PARCELAS = [
  { x: -1.3, z: 16.7 }, { x: 3.0, z: 16.7 }, { x: 7.3, z: 16.7 },
  { x: -1.3, z: 19.5 }, { x: 3.0, z: 19.5 }, { x: 7.3, z: 19.5 },
  // segundo huerto (terreno ampliado)
  { x: -1.3, z: 29.7 }, { x: 3.0, z: 29.7 }, { x: 7.3, z: 29.7 },
  { x: -1.3, z: 32.5 }, { x: 3.0, z: 32.5 }, { x: 7.3, z: 32.5 },
];
// huerto de frutales detrás de la casa: manzanos (verano y otoño) y naranjos (otoño e invierno)
export const FRUTALES = [
  { x: -5, z: -19, tipo: 'manzano' }, { x: 1, z: -19, tipo: 'naranjo' }, { x: 7, z: -19, tipo: 'manzano' },
  { x: -5, z: -24.5, tipo: 'naranjo' }, { x: 1, z: -24.5, tipo: 'manzano' }, { x: 7, z: -24.5, tipo: 'naranjo' },
];
// jardines de flores de María (campo de flores junto al gallinero)
export const JARDINES = [
  { x: 25, z: 0, flor: 0xe4507a }, { x: 29.5, z: 0, flor: 0xf2c94c }, { x: 34, z: 0, flor: 0x9b6ad8 },
  { x: 25, z: 5.5, flor: 0xf28c3a }, { x: 29.5, z: 5.5, flor: 0xf5f1e6 }, { x: 34, z: 5.5, flor: 0x5aa0e0 },
];
// obras de Andrés, en el orden en que las emprende: [id, nombre, horas de trabajo, x, z, para qué sirve]
export const OBRAS = [
  ['bodega', 'una bodega fría', 30, -7.5, -16.5, 'la comida fresca dura mucho más'],
  ['drenaje', 'una zanja de drenaje', 14, 3, 35.6, 'el huerto ya no se encharca con las tormentas'],
  ['secadero', 'un secadero', 12, 17, 26, 'se puede secar fruta y verdura al sol'],
  ['pergola', 'una pérgola', 18, 25, 20.5, 'un rincón romántico junto a la piscina'],
  ['horno', 'un horno de barro', 20, 11, -9, 'pan casero: las comidas alegran más'],
  ['invernadero', 'un invernadero', 40, 3, 32.5, 'tres parcelas producen también en invierno'],
  ['fuente', 'una fuente', 25, 3, 24.2, 'el agua corriendo embellece la granja'],
];
// esculturas que Andrés va tallando y ubicando por el terreno
export const ESCULTURAS = [
  { x: 21, z: 3, tipo: 'buho' }, { x: 31.5, z: 9.8, tipo: 'espiral' }, { x: -6, z: 23, tipo: 'figura' },
  { x: 14.5, z: 24, tipo: 'caballo' }, { x: -13, z: 31, tipo: 'pareja' }, { x: 31, z: -24, tipo: 'gato' },
];
export const FRUTA = { manzano: { nombre: 'manzanas', estaciones: [1, 2] }, naranjo: { nombre: 'naranjas', estaciones: [2, 3] } };
export const HABILIDADES = { huerto: 'Huerto', agua: 'Agua', cuidado: 'Cuidado', casa: 'Cocina y casa', granja: 'Granja', carpinteria: 'Carpintería' };
// mejoras que se desbloquean cuando alguien llega a ese nivel en el oficio
export const DESBLOQUEOS = {
  huerto: [[3, 'compost', 'Compost', 'los cultivos crecen 15 % más rápido'], [6, 'semillasSelectas', 'Semillas selectas', 'cada cosecha da una semilla más']],
  agua: [[3, 'filtroDoble', 'Filtro doble', 'filtra 40 L de una vez'], [6, 'canaletas', 'Canaletas', 'la lluvia llena el tanque 60 % más rápido']],
  casa: [[3, 'conservas', 'Conservas', 'la comida guardada dura mucho más'], [6, 'recetario', 'Recetario', 'cenas más alegres y más recetas nuevas']],
  granja: [[3, 'ordenoExperto', 'Ordeño experto', '20 % más leche'], [6, 'esquilaFina', 'Esquila fina', 'una lana más por oveja']],
  cuidado: [[3, 'remedios', 'Remedios caseros', 'las enfermedades duran la mitad'], [6, 'veterinaria', 'Veterinaria', 'los animales enfermos sanan más rápido']],
  carpinteria: [[3, 'muebles', 'Muebles nuevos', 'la casa se ensucia 25 % más lento'], [6, 'juguetes', 'Juguetes', 'Berlín y Axel se aburren más lento']],
};
const XP_OCIO = { tallar: 'carpinteria', jugarGato: 'cuidado', jugarPerro: 'cuidado', recogerFlores: 'huerto' };
const CAPACIDAD = { conservas: 60, queso: 16, secos: 40 };   // lo que cabe en la despensa
const obra = (s, id) => (s.obras || []).find((o) => o.id === id && o.progreso >= 1);
const AREA = {
  sembrar: 'huerto', regar: 'huerto', cosechar: 'huerto', limpiar: 'huerto', sacarAgua: 'agua', filtrar: 'agua', alimentar: 'cuidado',
  cocinar: 'casa', limpiarCasa: 'casa', tejer: 'casa', ordenar: 'granja', recogerHuevos: 'granja', esquilar: 'granja', segar: 'granja', alimentarGanado: 'granja',
  reparar: 'carpinteria', curar: 'cuidado', recogerFruta: 'huerto',
  fumigar: 'huerto', arrancar: 'huerto', abonar: 'huerto', voltearCompost: 'granja',
  construir: 'carpinteria', esculpir: 'carpinteria', cuidarJardin: 'huerto', hacerConservas: 'casa', hacerQueso: 'granja', secar: 'casa',
};

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
const lloviendo = (s) => s.clima.lluvia;
const calor = (s) => estacion(s) === 1 && hora(s) >= 12 && hora(s) < 16.5 && !lloviendo(s);
const frio = (s) => estacion(s) === 3;

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
const mejora = (s, k) => (s.desbloqueos || []).includes(k);
export const nivel = (xp) => Math.min(10, Math.floor(Math.sqrt((xp || 0) / 120)));
const HORARIO = { madrugador: [5.5, 21.5], normal: [6.5, 22.5], noctambulo: [8.0, 24.5] };
const horario = (a) => HORARIO[HAB(a).cronotipo] || HORARIO.normal;
function horaDeDormir(s, a) {
  const [desp, dorm] = horario(a), h = hora(s);
  return dorm > 24 ? h >= dorm - 24 && h < desp : h >= dorm || h < desp;
}
const despierto = (s, a) => !horaDeDormir(s, a);
const pareja = (s, a) => s.agentes.find((x) => x !== a && x.tipo === 'humano' && x.vivo);
const humanos = (s) => s.agentes.filter((x) => x.tipo === 'humano' && x.vivo);

// comida disponible: raciones del huerto + huevos y leche (medio "plato" cada uno)
export const comidaTotal = (s) => s.rec.raciones + s.rec.huevos * 0.5 + s.rec.leche * 0.5 + (s.rec.conservas || 0) + (s.rec.queso || 0) * 1.5 + (s.rec.secos || 0);
export function escasez(s) {
  const vivos = humanos(s).length || 1;
  return comidaTotal(s) < vivos * 1.4 * 3 || s.rec.potable + s.rec.cruda * 0.5 < vivos * 3.5 * 2;
}
const estres = (s, a) => (escasez(s) ? HAB(a).estres : null);
function consumirComida(s, a, valor) {
  const R = s.rec;
  if (R.huevos >= 2 && rng(s) < 0.6) { R.huevos -= 2; a.n.comida = Math.min(100, a.n.comida + valor); return 'huevos'; }
  if (R.leche >= 1 && R.raciones >= 0.5) { R.leche -= 1; R.raciones -= 0.5; a.n.comida = Math.min(100, a.n.comida + valor + 3); return 'leche'; }
  if (R.raciones >= 1) { R.raciones -= 1; a.n.comida = Math.min(100, a.n.comida + valor); return 'raciones'; }
  if (R.huevos >= 2) { R.huevos -= 2; a.n.comida = Math.min(100, a.n.comida + valor); return 'huevos'; }
  if (R.leche >= 2) { R.leche -= 2; a.n.comida = Math.min(100, a.n.comida + valor); return 'leche'; }
  // lo guardado, cuando ya no hay fresco
  if ((R.queso || 0) >= 0.7) { R.queso -= 0.7; a.n.comida = Math.min(100, a.n.comida + valor + 2); return 'queso'; }
  if ((R.conservas || 0) >= 1) { R.conservas -= 1; a.n.comida = Math.min(100, a.n.comida + valor); return 'conservas'; }
  if ((R.secos || 0) >= 1) { R.secos -= 1; a.n.comida = Math.min(100, a.n.comida + valor - 3); return 'secos'; }
  return null;
}

// ---------------------------------------------------------------- ánimo
function recuerdo(s, a, texto, valor, horas = 12) {
  if (!a || !a.vivo || a.tipo !== 'humano') return;
  let v = valor < 0 ? valor * (0.6 + P5(a, 'neuroticismo') * 0.9) : valor;
  // costumbre: lo bueno que se repite alegra cada vez menos (se recupera tras unos días sin repetirse)
  if (valor > 0) {
    a.costumbre = a.costumbre || {};
    const c = a.costumbre[texto], n = c ? c.n * Math.exp(-(s.t - c.t) / (4 * MIN_DIA)) : 0;
    v = valor / (1 + 0.35 * n * (1.2 - P5(a, 'apertura') * 0.4));
    a.costumbre[texto] = { n: n + 1, t: s.t };
  }
  a.recuerdos = a.recuerdos.filter((r) => r.texto !== texto);
  a.recuerdos.push({ texto, valor: Math.round(v), hasta: s.t + horas * 60 });
}
// memorias: momentos que marcan para siempre (suben o bajan el ánimo de fondo)
function memoria(s, a, texto, valor) {
  if (!a || !a.vivo || a.tipo !== 'humano') return;
  a.memorias = a.memorias || [];
  if (a.memorias.some((m) => m.texto === texto)) return;
  a.memorias.unshift({ texto, valor, t: s.t });
  if (a.memorias.length > 8) a.memorias.length = 8;
}
function calcularAnimo(s, a) {
  const n = a.n;
  const base = (n.comida * 0.9 + n.agua * 0.9 + n.energia * 0.7 + n.salud * 0.5 + n.social + n.diversion) / 5 * 0.82;
  a.recuerdos = a.recuerdos.filter((r) => r.hasta > s.t);
  const casa = s.casa.limpieza < 30 ? -6 : s.casa.limpieza > 75 ? 3 : 0;
  const sinAbrigo = frio(s) && s.rec.abrigos < humanos(s).length ? -5 : 0;
  const deterioro = s.casa.estado < 25 ? -8 : s.casa.estado < 50 ? -4 : 0;
  const huellas = Math.max(-8, Math.min(2, (a.memorias || []).reduce((t, m) => t + m.valor, 0)));
  const tension = -(s.pareja.tension || 0) / 12, belleza = (s.belleza || 0) / 22;   // vivir en un lugar bonito alegra
  a.animo = Math.max(0, Math.min(100, base + a.recuerdos.reduce((t, r) => t + r.valor, 0) + casa + sinAbrigo + deterioro + huellas + tension + belleza));
}
export const caraAnimo = (v) => (v >= 80 ? '😄' : v >= 62 ? '🙂' : v >= 45 ? '😐' : v >= 28 ? '😟' : '😢');
const irritable = (a) => a.n.comida < 20 || a.n.energia < 20 || a.animo < 30;

// ---------------------------------------------------------------- deseos: metas personales según el carácter
const nombreDe = (s, tipo) => s.agentes.find((x) => x.tipo === tipo)?.nombre || tipo;
const DESEOS = [
  { id: 'cosecharFavorito', texto: (s, a) => `Cosechar ${CULTIVOS[HAB(a).comida]?.nombre.toLowerCase() || 'su comida favorita'}`, peso: () => 1 },
  { id: 'arcoiris', texto: () => 'Ver un arcoíris', peso: (s, a) => 0.4 + P5(a, 'apertura') },
  { id: 'nocheRomantica', texto: () => 'Una noche romántica', peso: (s, a) => 0.3 + P5(a, 'extraversion') + (tiene(a, 'romantico') ? 1 : 0) },
  { id: 'nadarJuntos', texto: () => 'Nadar con su pareja', peso: (s, a) => (estacion(s) === 3 ? 0 : (HAB(a).ocio || []).includes('nadar') ? 1 : 0.3) },
  { id: 'abrigo', texto: () => 'Tejer un abrigo nuevo', peso: (s, a) => (s.rec.lana >= 2 ? 0.3 + P5(a, 'responsabilidad') + ((HAB(a).ocio || []).includes('tejer') ? 0.8 : 0) : 0) },
  { id: 'nacimiento', texto: () => 'Ver nacer un animal', peso: (s) => (estacion(s) <= 1 ? 0.9 : 0.2) },
  { id: 'subirNivel', texto: () => 'Mejorar en algún oficio', peso: (s, a) => 0.3 + P5(a, 'responsabilidad') },
  { id: 'cenaEspecial', texto: () => 'Una cena con receta nueva', peso: (s, a) => 0.3 + P5(a, 'apertura') },
  { id: 'paseo', texto: (s) => `Salir a pasear con ${nombreDe(s, 'perro')}`, peso: (s, a) => (HAB(a).animales?.nube ?? 0.5) },
  { id: 'casaImpecable', texto: () => 'Tener la casa impecable', peso: (s, a) => P5(a, 'responsabilidad') },
  { id: 'regalo', texto: () => 'Recibir un detalle de su pareja', peso: (s, a) => 0.3 + P5(a, 'neuroticismo') * 0.6 },
];
function nuevoDeseo(s, a) {
  const ops = DESEOS.filter((d) => d.id !== a.ultimoDeseo).map((d) => [Math.max(0, d.peso(s, a)), d]);
  let r = rng(s) * ops.reduce((t, o) => t + o[0], 0);
  for (const [w, d] of ops) { if ((r -= w) <= 0) { a.deseo = { id: d.id, texto: d.texto(s, a), desde: s.t }; return; } }
}
function cumplirDeseo(s, a, id) {
  if (!a || !a.vivo || a.tipo !== 'humano' || a.deseo?.id !== id) return;
  log(s, `✨ ${a.nombre} cumplió su deseo: ${a.deseo.texto.toLowerCase()}.`, 'logro');
  recuerdo(s, a, 'Cumplió un deseo', 8, 24);
  memoria(s, a, a.deseo.texto, 0.5);
  s.stats.deseos = (s.stats.deseos || 0) + 1;
  a.ultimoDeseo = id; a.deseo = null; a.proximoDeseo = s.t + MIN_DIA * (1 + rng(s) * 2);
}
function revisarDeseos(s) {
  for (const a of humanos(s)) {
    if (!a.deseo && s.t >= (a.proximoDeseo || 0)) nuevoDeseo(s, a);
    else if (a.deseo && s.t - a.deseo.desde > 12 * MIN_DIA) {
      if (P5(a, 'neuroticismo') > 0.5) recuerdo(s, a, 'Un deseo que no se cumple', -4, 48);
      a.ultimoDeseo = a.deseo.id; a.deseo = null; a.proximoDeseo = s.t + MIN_DIA;
    }
    if (a.deseo?.id === 'casaImpecable' && s.casa.limpieza >= 95) cumplirDeseo(s, a, 'casaImpecable');
  }
}
// vínculo de las mascotas con cada persona
function vincular(s, mascota, humano, v) {
  if (!mascota || !humano || !mascota.vinculo) return;
  mascota.vinculo[humano.id] = Math.max(0, Math.min(100, (mascota.vinculo[humano.id] ?? 50) + v));
}
const favorito = (s, m) => { const v = m.vinculo || {}; return humanos(s).sort((x, y) => (v[y.id] ?? 50) - (v[x.id] ?? 50))[0]; };

// ---------------------------------------------------------------- rutas: rodear la casa y entrar por las puertas
function cruza(p, q, R) {
  // ¿el segmento p→q atraviesa el rectángulo R? (prueba por muestreo, suficiente para esta escala)
  for (let i = 1; i < 20; i++) {
    const x = p.x + (q.x - p.x) * i / 20, z = p.z + (q.z - p.z) * i / 20;
    if (x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1) return true;
  }
  return false;
}
const dentroDe = (p, R) => p.x > R.x0 && p.x < R.x1 && p.z > R.z0 && p.z < R.z1;
function planRuta(from, to) {
  const pasos = [];
  let desde = { ...from };
  const viaPuerta = (R, fuera, dentro) => {
    const enDest = dentroDe(to, R), enOrig = dentroDe(desde, R);
    if (enDest !== enOrig) {
      const a = enOrig ? dentro : fuera, b = enOrig ? fuera : dentro;
      if (Math.hypot(desde.x - a.x, desde.z - a.z) > 0.5) pasos.push(a);
      pasos.push(b); desde = b;
    }
  };
  viaPuerta(CORRAL, { x: CORRAL.puerta.x + 0.9, z: CORRAL.puerta.z }, { x: CORRAL.puerta.x - 1.0, z: CORRAL.puerta.z });
  viaPuerta(GALLINERO, { x: GALLINERO.puerta.x - 0.9, z: GALLINERO.puerta.z }, { x: GALLINERO.puerta.x + 1.0, z: GALLINERO.puerta.z });
  // rodear la casa por la esquina más corta
  if (cruza(desde, to, CASA)) {
    const E = [{ x: CASA.x0 - 0.8, z: CASA.z1 + 0.8 }, { x: CASA.x1 + 0.8, z: CASA.z1 + 0.8 }, { x: CASA.x1 + 0.8, z: CASA.z0 - 0.8 }, { x: CASA.x0 - 0.8, z: CASA.z0 - 0.8 }];
    const largo = (pts) => pts.reduce((t, p, i) => t + Math.hypot(p.x - (i ? pts[i - 1].x : desde.x), p.z - (i ? pts[i - 1].z : desde.z)), 0) + Math.hypot(to.x - pts.at(-1).x, to.z - pts.at(-1).z);
    let mejor = null;
    for (const c of E) if (!cruza(desde, c, CASA) && !cruza(c, to, CASA) && (!mejor || largo([c]) < largo(mejor))) mejor = [c];
    if (!mejor) for (let i = 0; i < 4; i++) {
      const c1 = E[i], c2s = [E[(i + 1) % 4], E[(i + 3) % 4]];
      for (const c2 of c2s) if (!cruza(desde, c1, CASA) && !cruza(c2, to, CASA) && (!mejor || largo([c1, c2]) < largo(mejor))) mejor = [c1, c2];
    }
    if (mejor) pasos.push(...mejor);
  }
  pasos.push({ ...to });
  return pasos;
}

// ---------------------------------------------------------------- partida nueva
function nuevoAgente(p) {
  const humano = p.tipo === 'humano';
  return {
    id: p.id, tipo: p.tipo, nombre: p.nombre, rasgos: [...p.rasgos], vivo: true,
    pos: { ...(p.tipo === 'perro' ? LUGAR.caseta : p.tipo === 'gato' ? LUGAR.banca : LUGAR.puerta) },
    dentro: humano, n: { comida: 85, agua: 85, energia: 90, salud: 100, social: 70, diversion: 70 },
    animo: 70, recuerdos: [], memorias: [], deseo: null, xp: { huerto: 0, agua: 0, cuidado: 0, casa: 0, granja: 0, carpinteria: 0 },
    vinculo: humano ? undefined : Object.fromEntries(PERSONAJES.filter((h) => h.tipo === 'humano').map((h) => [h.id, Math.round((h.habitos?.animales?.[p.id] ?? 0.5) * 100)])),
    tarea: null, accion: 'Descansando', murio: null, causa: null, nadando: false,
    edad: p.edad ?? (humano ? 30 : 3), enfermo: 0, animo_buff: 0, ultimoAbrazo: 0, abrazo: 0,
  };
}
const ZONA = (tipo) => (tipo === 'vaca' || tipo === 'oveja' ? CORRAL : GALLINERO);
export const esAve = (tipo) => tipo === 'gallina' || tipo === 'gallo' || tipo === 'pollito';
const CRECER_DIAS = { vaca: 112, oveja: 56, pollito: 28 };
const CUPO = { corral: 18, gallinero: 24 };
const AREA_PASTO = 2.6;   // el potrero es más grande: cada animal gasta menos porcentaje del pasto
function puntoEn(s, R, margen = 1.2) { return { x: R.x0 + margen + rng(s) * (R.x1 - R.x0 - 2 * margen), z: R.z0 + margen + rng(s) * (R.z1 - R.z0 - 2 * margen) }; }
function nuevoAnimalGranja(s, g) {
  return { id: g.id, tipo: g.tipo, sexo: g.sexo || (g.tipo === 'gallo' ? 'm' : 'h'), crec: 1, madre: null, ultimoParto: -1, empolla: 0,
    nombre: g.nombre, vivo: true, pos: puntoEn(s, ZONA(g.tipo), 2), dest: null, espera: 0,
    hambre: 80, sed: 80, salud: 100, enfermo: 0, ubre: g.tipo === 'vaca' ? 4 : 0, lana: g.tipo === 'oveja' ? 40 : 0, edad: { vaca: 4, oveja: 2, gallina: 1, gallo: 1 }[g.tipo] ?? 2, comiendo: false, refugio: false, quieta: 0 };
}
export function nuevaPartida({ semilla = Date.now(), inicio = 6 * 60, generacion = 1 } = {}) {
  const s = {
    version: VERSION, config: CONFIG, rng: semilla | 0, generacion,
    t: inicio, t0: inicio,
    clima: { lluvia: false, lluviaHoy: null, arcoiris: 0 },
    rec: { potable: 30, cruda: 120, raciones: 45, comedero: 2, bebedero: 6, semillas: { lechuga: 8, papa: 6, frijol: 6, maiz: 4 },
      leche: 0, huevos: 4, lana: 2, heno: 150, abrigos: 2, grano: 2, pesebre: 6, bebederoGanado: 30, nido: 0 },
    granja: { pasto: 80 },
    casa: { limpieza: 80, estado: 100 },
    desbloqueos: [], zorro: null,
    pareja: { afinidad: 70, tension: 0, pendiente: null, discusiones: 0, charlas: 0, intimidad: 0, ultimaCena: -1, ultimaIntimidad: -1, recetaNueva: false },
    parcelas: PARCELAS.map((p, i) => ({ id: i, x: p.x, z: p.z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null, ...sueloNuevo() })),
    frutales: FRUTALES.map((f, i) => ({ id: i, ...f, fruta: 0 })),
    jardines: JARDINES.map((j, i) => ({ id: i, x: j.x, z: j.z, flor: j.flor, cuidado: 0.3, flores: 0 })),
    obras: OBRAS.map(([id, nombre, horas]) => ({ id, nombre, horas, progreso: 0 })), esculturas: 0, avanceEscultura: 0, belleza: 10,
    agentes: PERSONAJES.map(nuevoAgente),
    ganado: [],
    ultimaCosecha: null, efectos: [],
    diario: [], stats: { cosechas: 0, raciones: 0, litrosPozo: 0, litrosLluvia: 0, leche: 0, huevos: 0, lana: 0, nacimientos: 0, deseos: 0, reconciliaciones: 0, zorros: 0, regalos: 0 }, sigCria: 1,
    escasez: false, sequia: 0, fin: null,
  };
  s.ganado = GANADO.map((g) => nuevoAnimalGranja(s, g));
  Object.assign(s.parcelas[0], { cultivo: 'lechuga', crec: 3, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[3], { cultivo: 'lechuga', crec: 2, estado: 'creciendo', agua: 80 });
  Object.assign(s.parcelas[1], { cultivo: 'papa', crec: 4, estado: 'creciendo', agua: 80 });
  const nombres = s.agentes.map((a) => a.nombre);
  log(s, `${generacion > 1 ? `Generación ${generacion}. ` : ''}${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)} empiezan su vida en la granja, con vacas, ovejas y un gallinero.`, 'info');
  decidirClima(s);
  climaAhora(s);
  revisarDeseos(s);
  return s;
}

export function log(s, texto, tipo = 'info') {
  s.diario.unshift({ t: s.t, texto, tipo });
  if (s.diario.length > 250) s.diario.length = 250;
}
function efecto(s, tipo, x, z, extra = {}) { s.efectos.push({ tipo, x, z, t: s.t, ...extra }); if (s.efectos.length > 24) s.efectos.shift(); }

// ---------------------------------------------------------------- clima
const TEMP_BASE = [15, 23, 13, 3], AMPLITUD = [6, 7, 6, 5], HUM_BASE = [68, 52, 74, 80];
function decidirClima(s) {
  const e = estacion(s);
  // anomalía del día: días más fríos o más calurosos de lo normal; a veces olas de calor o frentes fríos
  const C = s.clima;
  C.anomalia = (C.anomalia || 0) * 0.6 + (rng(s) - 0.5) * 5;
  if (C.ola > 0) C.ola -= 1; else if (e === 1 && rng(s) < 0.04) { C.ola = 3 + Math.floor(rng(s) * 4); log(s, '🔥 Llega una ola de calor: el suelo se seca rápido y las plantas sufren.', 'aviso'); }
  if (C.frente > 0) C.frente -= 1; else if ((e === 2 || e === 0) && rng(s) < 0.035) { C.frente = 2 + Math.floor(rng(s) * 3); log(s, '🌬️ Entra un frente frío: puede helar en la madrugada.', 'aviso'); }
  const prob = s.sequia > 0 ? 0 : [0.4, 0.15, 0.3, 0.2][e];
  C.granizo = null;
  if (rng(s) < prob) {
    const inicio = dia(s) * MIN_DIA + Math.floor(rng(s) * 20 * 60);
    const tormenta = rng(s) < 0.22;
    C.lluviaHoy = { desde: inicio, hasta: inicio + (tormenta ? 300 + Math.floor(rng(s) * 360) : 120 + Math.floor(rng(s) * 300)), tormenta };
    if ((e === 0 || e === 1) && rng(s) < 0.12) { const g0 = inicio + 30 + Math.floor(rng(s) * 60); C.granizo = { desde: g0, hasta: g0 + 15 + Math.floor(rng(s) * 25), aplicado: false }; }
  } else C.lluviaHoy = null;
}
// temperatura (°C) y humedad (%) de este momento
function climaAhora(s) {
  const e = estacion(s), h = hora(s), C = s.clima;
  let t = TEMP_BASE[e] + (C.anomalia || 0) + AMPLITUD[e] * Math.sin((h - 9) / 24 * Math.PI * 2);
  if (C.ola > 0) t += 8;
  if (C.frente > 0) t -= 8;
  if (C.lluvia) t -= 3;
  let hum = HUM_BASE[e] + (C.lluvia ? 25 : 0) + (h < 7 || h > 21 ? 10 : 0) - (t - TEMP_BASE[e]) * 1.4 - (s.sequia > 0 ? 18 : 0);
  C.temp = Math.round(t * 10) / 10; C.hum = Math.round(Math.max(18, Math.min(100, hum)));
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
  s.efectos = s.efectos.filter((e) => s.t - e.t < 8);
  climaAhora(s);
  granizada(s);

  const L = s.clima.lluviaHoy;
  const llueve = !!(L && s.t >= L.desde && s.t < L.hasta);
  if (llueve !== s.clima.lluvia) {
    s.clima.lluvia = llueve;
    if (llueve) {
      const afuera = humanos(s).filter((a) => !a.dentro && despierto(s, a)).map((a) => a.nombre);
      log(s, `Empieza a llover${afuera.length ? `: ${afuera.join(' y ')} corre${afuera.length > 1 ? 'n' : ''} a refugiarse` : ''}. Los animales buscan techo.`, 'clima');
    } else if (hora(s) >= 7 && hora(s) < 18 && rng(s) < 0.5) {
      s.clima.arcoiris = s.t + 100;
      log(s, 'Dejó de llover y salió un arcoíris. 🌈', 'bueno');
    }
  }
  if (llueve) {
    const antes = s.rec.cruda;
    s.rec.cruda = Math.min(TANQUE_MAX, s.rec.cruda + (mejora(s, 'canaletas') ? 0.8 : 0.5) * d);
    s.stats.litrosLluvia += s.rec.cruda - antes;
    s.rec.bebederoGanado = Math.min(60, s.rec.bebederoGanado + 0.05 * d);
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
  s.casa.limpieza = Math.max(0, s.casa.limpieza - (9 / MIN_DIA) * d * (s.agentes.some((a) => a.vivo && a.tipo !== 'humano') ? 1.2 : 1) * (mejora(s, 'muebles') ? 0.75 : 1));
  if (s.zorro && s.t >= s.zorro.t) zorroAtaca(s);
  actualizarParcelas(s, d);
  actualizarGranja(s, d);
  for (const a of s.agentes) if (a.vivo) { necesidades(s, a, d); comportamiento(s, a, d); }
  encuentros(s);
}

function nuevoDia(s) {
  if (s.sequia > 0 && --s.sequia === 0) log(s, 'Terminó la sequía.', 'clima');
  decidirClima(s);
  // lo guardado se echa a perder; mientras más se acumula, más se pudre (no cabe todo en la despensa)
  const R0 = s.rec.raciones, frio = obra(s, 'bodega') ? 0.5 : 1;   // la bodega fría reduce a la mitad lo que se pierde
  s.rec.raciones *= 1 - ((mejora(s, 'conservas') ? 0.003 : 0.008) + (R0 > 150 ? 0.006 : 0) + (R0 > 350 ? 0.012 : 0)) * frio - (R0 > 500 ? 0.02 : 0);
  s.rec.conservas = (s.rec.conservas || 0) * 0.9995; s.rec.queso = (s.rec.queso || 0) * 0.997; s.rec.secos = (s.rec.secos || 0) * 0.999;
  s.rec.leche *= obra(s, 'bodega') ? 0.88 : mejora(s, 'conservas') ? 0.8 : 0.7;        // la leche se corta rápido
  s.rec.huevos *= mejora(s, 'conservas') ? 0.98 : 0.95;
  // la casa se desgasta (más con las lluvias); hay que repararla
  s.casa.estado = Math.max(0, (s.casa.estado ?? 100) - 1.1 - (s.clima.lluviaHoy ? 0.8 : 0));
  if (s.casa.estado < 50 && !s.casa.avisoDeterioro) { s.casa.avisoDeterioro = true; log(s, 'La casa está deteriorada: goteras y tablas sueltas.', 'aviso'); }
  if (s.casa.estado >= 60) s.casa.avisoDeterioro = false;
  // la tensión de una pelea se va disipando; si no hicieron las paces, queda rencor
  s.pareja.tension = Math.max(0, (s.pareja.tension || 0) - 6);
  const pend = s.pareja.pendiente;
  if (pend && s.t - pend.t > 30 * 60) {
    const [x, y] = humanos(s);
    if (x && y) { const rencoroso = P5(x, 'neuroticismo') >= P5(y, 'neuroticismo') ? x : y; recuerdo(s, rencoroso, 'Rencor', -6, 48); log(s, `${x.nombre} y ${y.nombre} siguen distanciados desde la última discusión.`, 'malo'); }
    s.pareja.pendiente = null;
  }
  revisarDeseos(s);
  mascotasDelDia(s);
  plagasDelDia(s);
  compostDelDia(s);
  eventos(s);
  if (dia(s) % DIAS_ESTACION === 0) {
    const e = estacion(s);
    log(s, `Comienza ${ESTACIONES[e].toLowerCase()}${e === 3 ? ': no crece nada y hace frío; los animales comerán heno' : ''}.`, 'clima');
    if (e === 0) {
      if (s.rec.abrigos > 0) { s.rec.abrigos = Math.max(0, s.rec.abrigos - 1); log(s, 'Un abrigo quedó gastado tras el invierno.', 'info'); }
      if (diasVividos(s) > 0) { log(s, `¡Sobrevivieron un año más! Ya van ${Math.round(diasVividos(s) / DIAS_ANIO)}.`, 'logro'); humanos(s).forEach((a) => recuerdo(s, a, 'Otro año juntos', 12, 48)); }
    }
  }
}

// ---------------------------------------------------------------- eventos de la naturaleza y de la vida
const LONGEVIDAD = { humano: 70, perro: 13, gato: 16, vaca: 18, oveja: 12, gallina: 8, gallo: 8, pollito: 8 };
function perdidaDeCosecha(s, texto) {
  for (const a of humanos(s)) {
    if (P5(a, 'neuroticismo') > 0.5 && rng(s) < 0.6) { recuerdo(s, a, 'Lloró por la cosecha perdida', -14, 24); log(s, `${a.nombre} se puso a llorar: ${texto}.`, 'malo'); }
    else if (P5(a, 'responsabilidad') > 0.6) { recuerdo(s, a, 'Decidido a hacerlo mejor', -3, 12); a.animo_buff = s.t + MIN_DIA; log(s, `${a.nombre} se propuso que no vuelva a pasar.`, 'info'); }
    else recuerdo(s, a, 'Se perdió una cosecha', -8, 18);
  }
}
function eventos(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION;
  if (e === 1 && dE === 0 && rng(s) < 0.35) { s.sequia = 10 + Math.floor(rng(s) * 12); s.clima.lluviaHoy = null; log(s, `Empieza una sequía: no lloverá en unos ${s.sequia} días, el pozo rinde la mitad y el pasto casi no crece.`, 'malo'); }
  const creciendo = s.parcelas.filter((p) => p.estado === 'creciendo');
  if (e !== 3 && creciendo.length && rng(s) < 0.025) {
    const p = creciendo[Math.floor(rng(s) * creciendo.length)];
    const gato = s.agentes.find((a) => a.vivo && tiene(a, 'cazador'));
    const perro = s.agentes.find((a) => a.vivo && tiene(a, 'leal'));
    const gallinas = s.ganado.filter((g) => g.vivo && g.tipo === 'gallina').length;
    if (gato && rng(s) < 0.45) log(s, `Una plaga de ratones atacó la parcela ${p.id + 1}, pero ${gato.nombre} la ahuyentó.`, 'bueno');
    else if (perro && perro.n.diversion > 40 && rng(s) < 0.4) log(s, `${perro.nombre} espantó a los animales que querían comerse la parcela ${p.id + 1}.`, 'bueno');
    else if (gallinas && rng(s) < 0.15 * gallinas) log(s, `Las gallinas se comieron los insectos que atacaban la parcela ${p.id + 1}.`, 'bueno');
    else { p.plaga = Math.max(p.plaga || 0, 0.2); p.plagaTipo = 'insecto'; log(s, `🐛 Apareció una plaga de insectos en la parcela ${p.id + 1}.`, 'aviso'); }
  }
  const sinAbrigo = frio(s) && s.rec.abrigos < humanos(s).length;
  for (const a of s.agentes) {
    if (!a.vivo) continue;
    a.edad += 1 / DIAS_ANIO;
    if (a.enfermo > 0) { if (--a.enfermo === 0) log(s, `${a.nombre} se recuperó.`, 'bueno'); }
    else if (a.tipo === 'humano' && rng(s) < 0.004 * (1 + Math.max(0, a.edad - 45) / 15) * (a.n.salud < 60 ? 2 : 1) * (sinAbrigo ? 2 : 1) * mod(a, 'enfermar') * (tiene(a, 'alergia') && e === 0 ? 1.6 : 1)) {
      a.enfermo = Math.ceil((3 + Math.floor(rng(s) * 5)) * (mejora(s, 'remedios') ? 0.5 : 1));
      log(s, `${a.nombre} cayó enfermo${sinAbrigo ? ' por el frío (no tiene abrigo)' : a.n.salud < 60 ? ' (estaba débil)' : ''}: estará lento unos días.`, 'malo');
      recuerdo(s, pareja(s, a), `Preocupación por ${a.nombre}`, -6, 48);
    }
    const L = LONGEVIDAD[a.tipo], sobra = a.edad - L * 0.85;
    if (sobra > 0 && rng(s) < 0.002 + sobra * 0.004) morir(s, a, 'de vejez');
  }
  reproduccion(s);
  for (const g of s.ganado) {
    if (!g.vivo) continue;
    g.edad += 1 / DIAS_ANIO;
    const L = LONGEVIDAD[g.tipo], sobra = g.edad - L * 0.85;
    if (sobra > 0 && rng(s) < 0.002 + sobra * 0.004) morirAnimal(s, g, 'de vejez');
  }
  // los jardines florecen en primavera y verano si se cuidan; en invierno se marchitan
  const est = estacion(s);
  for (const j of s.jardines || []) {
    j.cuidado = Math.max(0, j.cuidado - 0.04);
    const meta = est === 0 || est === 1 ? 0.25 + j.cuidado * 0.75 : est === 2 ? j.cuidado * 0.35 : 0;
    j.flores += (meta - j.flores) * 0.25;
  }
  // belleza: flores, esculturas y obras; alegra a todos
  const flores = (s.jardines || []).reduce((t, j) => t + j.flores, 0);
  s.belleza = Math.round(Math.min(100, flores * 8 + (s.esculturas || 0) * 5 + (obra(s, 'pergola') ? 6 : 0) + (obra(s, 'fuente') ? 9 : 0) + (obra(s, 'invernadero') ? 3 : 0) + s.casa.limpieza * 0.05 + (s.casa.estado ?? 100) * 0.05));
  // los frutales maduran en su temporada; si nadie recoge, la fruta se cae
  for (const f of s.frutales || []) {
    if (FRUTA[f.tipo].estaciones.includes(estacion(s))) f.fruta = Math.min(14, f.fruta + (1.3 + rng(s) * 0.6) * (1 + polinizacion(s) * 0.3));
    else f.fruta *= 0.6;
    if (f.fruta > 12) f.fruta -= 0.8;
  }
  s.pareja.afinidad = Math.max(0, s.pareja.afinidad - 2.2 - Math.max(0, s.pareja.afinidad - 70) * 0.08);   // la rutina desgasta: cuidar la relación cuesta más cuando ya está bien
  // enfermedades del ganado
  for (const g of s.ganado) {
    if (!g.vivo) continue;
    if (g.enfermo > 0) { g.enfermo = Math.max(0, g.enfermo - (mejora(s, 'veterinaria') ? 2 : 1)); if (!g.enfermo) log(s, `${g.nombre} se recuperó solo.`, 'info'); }
    else if (rng(s) < 0.006 * (frio(s) ? 2 : 1)) { g.enfermo = 3 + Math.floor(rng(s) * 4); log(s, `${g.nombre} amaneció enfermo (${g.tipo}): hay que curarlo.`, 'aviso'); }
  }
}

// ---------------------------------------------------------------- mascotas: travesuras, zorros y vínculos
function mascotasDelDia(s) {
  const gato = s.agentes.find((a) => a.vivo && a.tipo === 'gato'), perro = s.agentes.find((a) => a.vivo && a.tipo === 'perro');
  for (const m of [gato, perro]) if (m?.vinculo) for (const h of humanos(s)) m.vinculo[h.id] += (m.vinculo[h.id] - 50) * -0.03;   // sin atención, el vínculo vuelve a lo neutro
  if (gato && tiene(gato, 'travieso') && rng(s) < 0.18) {
    const robo = s.rec.huevos >= 1 && rng(s) < 0.4;
    if (robo) { s.rec.huevos -= 1; log(s, `${gato.nombre} se robó un huevo de la cocina. 🥚`, 'info'); }
    else { s.casa.limpieza = Math.max(0, s.casa.limpieza - 8); s.casa.estado = Math.max(0, s.casa.estado - 1.5); log(s, `${gato.nombre} tumbó una matera en la sala.`, 'info'); }
    for (const h of humanos(s)) {
      if (P5(h, 'amabilidad') > 0.6) recuerdo(s, h, `Las travesuras de ${gato.nombre}`, 2, 8);
      else recuerdo(s, h, `${gato.nombre} volvió a hacer de las suyas`, -3, 8);
    }
  }
  // un zorro puede rondar el gallinero esta noche
  if (!s.zorro && s.ganado.some((g) => g.vivo && esAve(g.tipo)) && rng(s) < (estacion(s) === 3 ? 0.11 : 0.05)) {
    s.zorro = { t: dia(s) * MIN_DIA + 60 * (23 + rng(s) * 5) };
  }
}
function zorroAtaca(s) {
  s.zorro = null;
  const perro = s.agentes.find((a) => a.vivo && a.tipo === 'perro');
  const aves = s.ganado.filter((g) => g.vivo && esAve(g.tipo) && !g.empolla);
  if (!aves.length) return;
  s.stats.zorros = (s.stats.zorros || 0) + 1;
  if (perro && tiene(perro, 'guardian') && perro.n.energia > 10 && perro.n.salud > 30) {
    perro.tarea = { tipo: 'vigilar', fase: 'camino', destino: { x: GALLINERO.puerta.x - 1.2, z: GALLINERO.puerta.z }, trabajo: 40 };
    if (perro.dentro) { perro.dentro = false; perro.pos = { ...LUGAR.puerta }; }
    efecto(s, 'ladrido', GALLINERO.puerta.x, GALLINERO.puerta.z);
    log(s, `🦊 Un zorro rondó el gallinero de noche, pero ${perro.nombre} lo espantó a ladridos.`, 'bueno');
    for (const h of humanos(s)) { recuerdo(s, h, `${perro.nombre} cuidó las gallinas`, 4, 24); vincular(s, perro, h, 2); }
  } else {
    const v = aves[Math.floor(rng(s) * aves.length)];
    morirAnimal(s, v, 'atacada por un zorro');
  }
}

// ---------------------------------------------------------------- reproducción del ganado
const adulto = (g) => g.vivo && g.crec >= 1;
const enCorral = (s) => s.ganado.filter((g) => g.vivo && (g.tipo === 'vaca' || g.tipo === 'oveja')).length;
const enGallinero = (s) => s.ganado.filter((g) => g.vivo && esAve(g.tipo)).length;
function nombreCria(s, tipo, sexo) {
  const lista = NOMBRES_CRIAS[tipo]?.[sexo] || ['Cría'];
  const usados = new Set(s.ganado.map((g) => g.nombre));
  const libre = lista.find((n) => !usados.has(n));
  return libre || `${lista[Math.floor(rng(s) * lista.length)]} ${s.sigCria}`;
}
function nacer(s, tipo, madre) {
  const sexo = rng(s) < 0.5 ? 'h' : 'm';
  const tipoCria = esAve(tipo) ? 'pollito' : tipo;
  const nombre = nombreCria(s, esAve(tipo) ? 'gallina' : tipo, sexo);
  const g = { id: `cria${s.sigCria++}`, tipo: tipoCria, sexo, crec: 0, madre: madre.id, ultimoParto: -1, empolla: 0, nombre, vivo: true,
    pos: { x: madre.pos.x + (rng(s) - 0.5) * 1.2, z: madre.pos.z + (rng(s) - 0.5) * 1.2 }, dest: null, espera: 0,
    hambre: 85, sed: 85, salud: 100, enfermo: 0, ubre: 0, lana: tipo === 'oveja' ? 10 : 0, edad: 0, comiendo: false, refugio: false, quieta: 0 };
  s.ganado.push(g); s.stats.nacimientos += 1;
  return g;
}
function reproduccion(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION, año = anio(s);
  const macho = (tipo) => s.ganado.some((g) => adulto(g) && g.tipo === tipo && g.sexo === 'm');
  // partos de vacas y ovejas en primavera
  if (e === 0 && dE >= 4 && dE <= 22) {
    for (const g of s.ganado.filter((x) => adulto(x) && x.sexo === 'h' && (x.tipo === 'vaca' || x.tipo === 'oveja'))) {
      if (g.ultimoParto === año || !macho(g.tipo) || enCorral(s) >= CUPO.corral) continue;
      if (rng(s) > (g.tipo === 'vaca' ? 0.05 : 0.07)) continue;
      g.ultimoParto = año;
      const n = g.tipo === 'oveja' && rng(s) < 0.3 && enCorral(s) + 2 <= CUPO.corral ? 2 : 1;
      const crias = Array.from({ length: n }, () => nacer(s, g.tipo, g));
      const que = g.tipo === 'vaca' ? (n > 1 ? 'terneros' : 'un ternero') : (n > 1 ? 'dos corderos' : 'un cordero');
      log(s, `¡${g.nombre} tuvo ${que}! ${crias.map((c) => `${c.nombre} (${c.sexo === 'h' ? 'hembra' : 'macho'})`).join(' y ')}. 🍼`, 'logro');
      humanos(s).forEach((a) => { recuerdo(s, a, `Nació ${crias[0].nombre}`, 7, 24); cumplirDeseo(s, a, 'nacimiento'); if (s.stats.nacimientos <= n) memoria(s, a, 'El primer nacimiento en la granja', 1); });
    }
  }
  // gallinas cluecas: empollan huevos del nido en primavera y verano
  for (const g of s.ganado.filter((x) => adulto(x) && x.tipo === 'gallina')) {
    if (g.empolla > 0) {
      if (dia(s) >= g.empolla) {
        g.empolla = 0;
        const n = Math.min(1 + Math.floor(rng(s) * 3), CUPO.gallinero - enGallinero(s));
        if (n > 0) {
          const crias = Array.from({ length: n }, () => nacer(s, 'gallina', g));
          log(s, `¡Nacieron ${n} pollito${n > 1 ? 's' : ''} de ${g.nombre}: ${crias.map((c) => c.nombre).join(', ')}! 🐣`, 'logro');
          humanos(s).forEach((a) => { recuerdo(s, a, 'Nacieron pollitos', 6, 24); cumplirDeseo(s, a, 'nacimiento'); });
        } else log(s, `Los huevos que empollaba ${g.nombre} no prosperaron.`, 'info');
      }
      continue;
    }
    if ((e === 0 || e === 1) && macho('gallo') && enGallinero(s) < CUPO.gallinero - 1 && rng(s) < 0.02) {
      g.empolla = dia(s) + 21;   // pone y empolla sus propios huevos
      log(s, `${g.nombre} se puso clueca: empollará sus huevos durante 21 días.`, 'info');
    }
  }
}

// ---------------------------------------------------------------- huerto
const EVAP = [35, 55, 30, 20];
function actualizarParcelas(s, d) {
  const e = estacion(s), tormenta = s.clima.lluvia && s.clima.lluviaHoy?.tormenta;
  for (const p of s.parcelas) {
    // encharcamiento con tormentas; la zanja de drenaje lo evita
    if (tormenta && !obra(s, 'drenaje')) { p.encharcado = (p.encharcado || 0) + d; if (p.encharcado > 120 && s.clima.diaInundacion !== dia(s)) { s.clima.diaInundacion = dia(s); log(s, '🌊 La tormenta encharcó el huerto: las raíces se pueden pudrir.', 'aviso'); } }
    else p.encharcado = Math.max(0, (p.encharcado || 0) - (obra(s, 'drenaje') ? 6 : 1.5) * d);
    if (p.estado === 'vacia') {   // la tierra en descanso se recupera
      const k = d / MIN_DIA;
      for (const n of ['N', 'P', 'K']) if (p[n] < 60) p[n] = Math.min(60, p[n] + 0.55 * k);
      p.ph += (6.5 - p.ph) * 0.01 * k;
      p.plaga = 0;
    }
    if (p.estado === 'vacia' || p.estado === 'muerta') continue;
    const calorX = s.clima.temp > 30 ? 1.5 : s.clima.temp > 26 ? 1.2 : 1;
    p.agua = Math.max(0, p.agua - (EVAP[e] * (s.sequia > 0 ? 1.3 : 1) * calorX / MIN_DIA) * d);
    const C = CULTIVOS[p.cultivo], inv = obra(s, 'invernadero') && p.id >= 9, temporada = C.estaciones.includes(e) || inv;
    if (p.estado === 'creciendo') {
      // la planta crece según el agua, los nutrientes, el pH, su salud y las abejas
      const nutr = Math.min(1, Math.min(p.N, p.P, p.K) / 35), ph = 1 - Math.min(0.5, Math.abs(p.ph - 6.5) * 0.35);
      const abejas = e <= 1 ? polinizacion(s) * 0.12 : 0;
      const ritmo = (0.45 + 0.55 * nutr) * ph * (0.5 + 0.5 * p.salud / 100) * (1 + abejas) * (mejora(s, 'compost') ? 1.15 : 1);
      if (p.agua > 0 && temporada) {
        p.crec += (d / MIN_DIA) * ritmo;
        // lo que la planta saca del suelo (el fríjol fija nitrógeno) y el suelo se acidifica de a poco
        const k = d / MIN_DIA / C.dias;
        p.N = Math.max(0, Math.min(100, p.N - C.npk[0] * k)); p.P = Math.max(0, p.P - C.npk[1] * k); p.K = Math.max(0, p.K - C.npk[2] * k);
        p.ph = Math.max(4.5, p.ph - 0.004 * d / MIN_DIA);
      }
      // helada: el frío quema lo que no está en el invernadero
      if (!inv && s.clima.temp < -0.5) {
        p.salud = Math.max(0, p.salud - (-s.clima.temp - 0.5) * 0.12 * C.frio * d);
        if (s.clima.diaHelada !== dia(s)) { s.clima.diaHelada = dia(s); log(s, `❄️ Heló en la madrugada (${s.clima.temp} °C): se quemaron hojas en el huerto.`, 'malo'); }
      }
      // calor y sed
      if (s.clima.temp > 31 && p.agua < 30 && !inv) p.salud = Math.max(0, p.salud - (s.clima.temp - 31) * 0.02 * d);
      // encharcamiento: las raíces se pudren si el agua no drena
      if (p.encharcado > 360) p.salud = Math.max(0, p.salud - 0.05 * d);
      // plagas: avanzan con humedad (hongos) o calor (insectos) y dañan la planta
      if (p.plaga > 0) {
        const gallinas = p.plagaTipo === 'insecto' && s.ganado.some((g) => g.vivo && g.tipo === 'gallina') ? 0.7 : 1;
        const fuerza = p.plagaTipo === 'hongo' ? s.clima.hum / 70 : Math.max(0.3, s.clima.temp / 20);
        p.plaga = Math.min(1, p.plaga + 0.18 * fuerza * gallinas * d / MIN_DIA);
        p.salud = Math.max(0, p.salud - p.plaga * 14 * d / MIN_DIA);
      }
      if (p.salud <= 0) {
        p.estado = 'muerta';
        const causa = p.plaga > 0.5 ? (p.plagaTipo === 'hongo' ? 'un hongo' : 'una plaga de insectos') : s.clima.temp < 0 ? 'la helada' : p.encharcado > 360 ? 'el encharcamiento' : 'el clima';
        log(s, `${C.nombre} de la parcela ${p.id + 1} se perdió por ${causa}.`, 'malo');
        perdidaDeCosecha(s, `${causa} acabó con ${C.nombre.toLowerCase()}`);
        p.ultimo = p.cultivo;
        continue;
      }
      if (p.agua <= 0 || !temporada) p.secoMin += d; else p.secoMin = Math.max(0, p.secoMin - 0.5 * d);
      if (p.secoMin > MIN_DIA * 2) {
        p.estado = 'muerta';
        log(s, `Se murió ${C.nombre.toLowerCase()} de la parcela ${p.id + 1} (${!temporada ? 'fuera de temporada' : 'falta de agua'}).`, 'malo');
        perdidaDeCosecha(s, `se secó ${C.nombre.toLowerCase()}`);
      } else if (p.crec >= C.dias) {
        p.estado = 'lista'; p.listaMin = 0; p.plaga = Math.min(p.plaga, 0.4);
        log(s, `${C.nombre} de la parcela ${p.id + 1} lista para cosechar.`, 'bueno');
      }
    } else if (p.estado === 'lista') {
      p.listaMin += d;
      if (p.listaMin > MIN_DIA * 6) { p.estado = 'muerta'; p.ultimo = p.cultivo; log(s, `${C.nombre} de la parcela ${p.id + 1} se pudrió sin cosechar.`, 'malo'); }
    }
  }
}
// abejas: con jardines en flor polinizan el huerto y los frutales (0..1)
function polinizacion(s) {
  const j = s.jardines || []; if (!j.length) return 0;
  return Math.min(1, j.reduce((t, x) => t + x.flores, 0) / j.length * 1.4);
}
function granizada(s) {
  const G = s.clima.granizo;
  s.clima.granizando = !!(G && s.t >= G.desde && s.t < G.hasta);
  if (!s.clima.granizando || G.aplicado) return;
  G.aplicado = true;
  let n = 0;
  for (const p of s.parcelas) if (p.estado === 'creciendo' || p.estado === 'lista') { if (obra(s, 'invernadero') && p.id >= 9) continue; p.salud = Math.max(0, p.salud - (25 + rng(s) * 35)); n++; }
  for (const f of s.frutales || []) f.fruta *= 0.5;
  s.casa.estado = Math.max(0, (s.casa.estado ?? 100) - 4);
  log(s, `🧊 Granizada: golpeó ${n ? `${n} parcela${n > 1 ? 's' : ''}, ` : ''}los frutales y el techo.`, 'malo');
  humanos(s).forEach((a) => recuerdo(s, a, 'La granizada', -6, 24));
}
const vecinas = (s, p) => s.parcelas.filter((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 4.9);
function plagasDelDia(s) {
  const hum = s.clima.hum, temp = s.clima.temp;
  for (const p of s.parcelas) {
    if (p.estado !== 'creciendo') continue;
    // aparecen más en monocultivo (mismo cultivo que la vez pasada o que las vecinas) y con humedad o calor
    if (!p.plaga) {
      const mono = (p.ultimo === p.cultivo ? 3 : 1) * (vecinas(s, p).filter((q) => q.cultivo === p.cultivo).length >= 2 ? 1.5 : 1);
      if (rng(s) < 0.006 * mono * (hum > 75 ? 1.8 : 1) * (temp > 22 ? 1.5 : 1)) { p.plaga = 0.06; p.plagaTipo = hum > 70 ? 'hongo' : 'insecto'; }
    }
  }
  // contagio a las vecinas (más con humedad si es hongo, con calor si son insectos)
  for (const p of s.parcelas.filter((q) => q.plaga > 0.3 && q.estado !== 'vacia')) {
    for (const q of vecinas(s, p)) {
      if (q.estado !== 'creciendo' || q.plaga > 0) continue;
      const k = p.plagaTipo === 'hongo' ? hum / 70 : temp / 22;
      if (rng(s) < 0.25 * k) { q.plaga = 0.08; q.plagaTipo = p.plagaTipo; if (s.clima.diaContagio !== dia(s)) { s.clima.diaContagio = dia(s); log(s, `${p.plagaTipo === 'hongo' ? '🍄 El hongo' : '🐛 La plaga'} saltó de la parcela ${p.id + 1} a la ${q.id + 1}.`, 'aviso'); } }
    }
  }
}
function compostDelDia(s) {
  const R = s.rec, adultos = (t) => s.ganado.filter((g) => g.vivo && g.tipo === t && g.crec >= 1).length;
  R.pila = (R.pila || 0) + adultos('vaca') * 1.0 + adultos('oveja') * 0.4 + (adultos('gallina') + adultos('gallo')) * 0.08;   // estiércol a la pila
  const volteada = dia(s) - (s.ultimoVolteo ?? -99) <= 6;
  const m = R.pila * (volteada ? 0.035 : 0.012);
  R.pila -= m; R.compost = Math.min(80, (R.compost || 0) + m * 0.7);
  if (estacion(s) === 3 || TEMP_BASE[estacion(s)] < 14) R.ceniza = Math.min(30, (R.ceniza || 0) + 0.4);   // la chimenea deja ceniza
}
function elegirCultivo(s, a, invernadero = false, parcela = null) {
  const e = estacion(s), quedan = DIAS_ESTACION - (dia(s) % DIAS_ESTACION) - hora(s) / 24;
  const opciones = [];
  for (const [k, C] of Object.entries(CULTIVOS)) {
    if ((s.rec.semillas[k] || 0) < 1 || (!invernadero && !C.estaciones.includes(e))) continue;
    if (!invernadero && !C.estaciones.includes((e + 1) % 4) && C.dias > quedan - 0.5) continue;
    let p = C.raciones / C.dias;
    if (HAB(a).comida === k) p *= 1.15;
    // rotación: quien sabe de huerto evita repetir y pone fríjol donde falta nitrógeno
    if (parcela) {
      const saber = Math.min(1, 0.35 + nivel(a.xp.huerto) * 0.08 + (tiene(a, 'manoVerde') ? 0.3 : 0) + P5(a, 'responsabilidad') * 0.2);
      if (parcela.ultimo === k) p *= 1 - 0.7 * saber;
      if (k === 'frijol' && parcela.N < 45) p *= 1 + 1.2 * saber;
      if ((k === 'maiz' || k === 'papa') && parcela.ultimo === 'frijol') p *= 1 + 0.4 * saber;
    }
    if (s.parcelas.some((x) => x.cultivo === k)) p *= 1 - P5(a, 'apertura') * 0.35;
    opciones.push([p, k]);
  }
  opciones.sort((x, y) => y[0] - x[0]);
  return opciones[0]?.[1] || null;
}

// ---------------------------------------------------------------- animales de granja (vaca, ovejas, gallinas, gallo)
const VEL = { humano: 1.8, perro: 2.6, gato: 2.2, vaca: 0.55, oveja: 0.7, gallina: 0.9, gallo: 0.9, pollito: 0.75 };   // unidades por minuto de juego
const HAMBRE_G = { vaca: 3.2, oveja: 2.6, gallina: 2.4, gallo: 2.4, pollito: 1.6 };
function actualizarGranja(s, d) {
  const e = estacion(s), G = s.granja, R = s.rec, k = d / 60, h = hora(s);
  if (e !== 3) G.pasto = Math.min(100, G.pasto + ((e === 2 ? 24 : 36) / MIN_DIA) * d * (s.sequia > 0 ? 0.3 : 1));
  const noche = h >= 20.5 || h < 5.5;
  for (const g of s.ganado) {
    if (!g.vivo) continue;
    const Z = ZONA(g.tipo), aves = esAve(g.tipo);
    // crecer
    if (g.crec < 1) {
      g.crec = Math.min(1, g.crec + d / ((CRECER_DIAS[g.tipo] || 56) * MIN_DIA));
      if (g.crec >= 1) {
        if (g.tipo === 'pollito') g.tipo = g.sexo === 'm' ? 'gallo' : 'gallina';
        const que = { vaca: g.sexo === 'm' ? 'un toro' : 'una vaca', oveja: g.sexo === 'm' ? 'un carnero' : 'una oveja', gallina: 'una gallina', gallo: 'un gallo' }[g.tipo];
        log(s, `${g.nombre} ya creció: ahora es ${que} adulto${g.sexo === 'h' ? 'a' : ''}.`, 'info');
      }
    }
    g.hambre = Math.max(0, g.hambre - HAMBRE_G[g.tipo] * k);
    g.sed = Math.max(0, g.sed - 3.5 * k);
    // refugio: de noche o con lluvia se meten al establo / gallinero
    const debeRefugio = noche || lloviendo(s);
    if (debeRefugio && !g.refugio) {
      g.refugio = true; g.comiendo = false;
      const base = aves ? LUGAR.gallinero : LUGAR.establo;
      const grupo = s.ganado.filter((x) => x.vivo && esAve(x.tipo) === aves), k = Math.max(0, grupo.indexOf(g));
      const ang = k * 2.4, r = (aves ? 0.6 : 1.0) + (aves ? 0.32 : 0.62) * Math.sqrt(k);   // espiral: nadie se monta encima de otro
      g.dest = { x: base.x + Math.cos(ang) * r, z: base.z + Math.sin(ang) * r };
    } else if (!debeRefugio && g.refugio && !g.empolla) { g.refugio = false; g.dest = null; }
    if (g.empolla && !g.refugio) { g.refugio = true; g.dest = { x: LUGAR.gallinero.x + (rng(s) - 0.5) * 1.6, z: LUGAR.gallinero.z }; }   // la clueca no sale del nido
    // las crías siguen a su madre
    const madre = g.crec < 1 && g.madre ? s.ganado.find((m) => m.id === g.madre && m.vivo) : null;
    if (madre && !g.refugio && Math.hypot(madre.pos.x - g.pos.x, madre.pos.z - g.pos.z) > 2.2) g.dest = { x: madre.pos.x + (rng(s) - 0.5) * 1.4, z: madre.pos.z + (rng(s) - 0.5) * 1.4 };
    if (g.quieta > s.t) { g.comiendo = false; continue; }            // la están ordeñando o esquilando
    // comer y beber
    g.comiendo = false;
    if (!g.refugio && g.sed < 55 && R.bebederoGanado >= 1 && !aves) {
      const b = LUGAR.bebederoGanado;
      if (Math.hypot(g.pos.x - b.x, g.pos.z - b.z) > 1.4) { if (!g.dest || g.dest.para !== 'beber') g.dest = { x: b.x - 0.9, z: b.z + (rng(s) - 0.5) * 1.6, para: 'beber' }; }
      else { g.sed = Math.min(100, g.sed + 70 * k); R.bebederoGanado = Math.max(0, R.bebederoGanado - 0.12 * 70 * k); g.dest = null; g.comiendo = true; }
    } else if (aves && g.sed < 55) {
      g.sed = Math.min(100, g.sed + 40 * k);   // beben del bebedero del gallinero (se llena con la lluvia y al alimentarlas)
    } else if (g.hambre < 70) {
      if (aves) {
        if (e !== 3) { g.hambre = Math.min(100, g.hambre + 18 * k); g.comiendo = !g.refugio; if (!g.refugio && rng(s) < 0.08 * d) g.dest = { x: Math.max(Z.x0 + 0.8, Math.min(Z.x1 - 0.8, g.pos.x + (rng(s) - 0.5) * 2.5)), z: Math.max(Z.z0 + 0.8, Math.min(Z.z1 - 0.8, g.pos.z + (rng(s) - 0.5) * 2.5)) }; }   // picotean bichos caminando
        else if (R.grano > 0.02) { g.hambre = Math.min(100, g.hambre + 30 * k); R.grano = Math.max(0, R.grano - 0.004 * 30 * k); g.comiendo = true; }
      } else if (!g.refugio && G.pasto > 6 && (e !== 3 || R.pesebre < 0.5)) {   // en invierno el pasto no crece, pero lo que queda se come
        g.hambre = Math.min(100, g.hambre + 26 * k); G.pasto = Math.max(0, G.pasto - (g.tipo === 'vaca' ? 0.06 : 0.03) * (g.crec < 1 ? 0.5 : 1) * 26 * k / AREA_PASTO); g.comiendo = true;
        // pasta caminando despacio, mordisco a mordisco
        if (!g.pastoreo || Math.hypot(g.pastoreo.x - g.pos.x, g.pastoreo.z - g.pos.z) < 0.15) { const a = rng(s) * Math.PI * 2; g.pastoreo = { x: Math.max(Z.x0 + 1, Math.min(Z.x1 - 1, g.pos.x + Math.cos(a) * 1.5)), z: Math.max(Z.z0 + 1, Math.min(Z.z1 - 1, g.pos.z + Math.sin(a) * 1.5)) }; }
        const dx = g.pastoreo.x - g.pos.x, dz = g.pastoreo.z - g.pos.z, dd = Math.hypot(dx, dz), v = VEL[g.tipo] * 0.22 * d;
        if (dd > v) { g.pos.x += dx / dd * v; g.pos.z += dz / dd * v; }
      } else if (R.pesebre > 0.05) {
        const p = LUGAR.pesebre;
        if (Math.hypot(g.pos.x - p.x, g.pos.z - p.z) > 1.4) { if (!g.dest || g.dest.para !== 'pesebre') g.dest = { x: p.x - 0.9, z: p.z + (rng(s) - 0.5) * 1.6, para: 'pesebre' }; }
        else { g.hambre = Math.min(100, g.hambre + 40 * k); R.pesebre = Math.max(0, R.pesebre - (g.tipo === 'vaca' ? 0.03 : 0.015) * (g.crec < 1 ? 0.5 : 1) * 40 * k); g.dest = null; g.comiendo = true; }
      }
    }
    // pasear por su zona
    if (!g.dest && !g.comiendo && !g.refugio) {
      g.espera -= d;
      if (g.espera <= 0) {
        // casi siempre se mueven cerca de su manada; a veces exploran el potrero
        const manada = s.ganado.filter((x) => x.vivo && x !== g && esAve(x.tipo) === aves && !x.refugio);
        if (manada.length && rng(s) < 0.65) {
          const cx = manada.reduce((t, x) => t + x.pos.x, 0) / manada.length, cz = manada.reduce((t, x) => t + x.pos.z, 0) / manada.length;
          g.dest = { x: Math.max(Z.x0 + 1, Math.min(Z.x1 - 1, cx + (rng(s) - 0.5) * 7)), z: Math.max(Z.z0 + 1, Math.min(Z.z1 - 1, cz + (rng(s) - 0.5) * 7)) };
        } else g.dest = puntoEn(s, Z);
        g.espera = 4 + rng(s) * 16;
      }
    }
    if (g.dest) {
      const dx = g.dest.x - g.pos.x, dz = g.dest.z - g.pos.z, dist = Math.hypot(dx, dz), v = VEL[g.tipo] * d;
      if (dist <= v) { g.pos.x = g.dest.x; g.pos.z = g.dest.z; if (!g.refugio) g.dest = null; }
      else { g.pos.x += (dx / dist) * v; g.pos.z += (dz / dist) * v; }
    }
    // producción
    const bien = g.hambre > 35 && g.sed > 35 && !g.enfermo;
    if (g.tipo === 'vaca' && g.sexo === 'h' && g.crec >= 1 && bien) g.ubre = Math.min(14, g.ubre + (9 / MIN_DIA) * d);
    if (g.tipo === 'oveja' && bien) g.lana = Math.min(100, g.lana + (1.2 / MIN_DIA) * d);
    if (g.tipo === 'gallina' && g.crec >= 1 && !g.empolla && bien) R.nido = Math.min(30, R.nido + ((e === 3 ? 0.35 : 0.8) / MIN_DIA) * d);
    if (g.tipo === 'gallo' && h >= 5.5 && h < 5.5 + d / 60 + 0.001) {
      efecto(s, 'kikiriki', g.pos.x, g.pos.z);
      if (dia(s) % 14 === 0) log(s, `${g.nombre} cantó al amanecer. 🐓`, 'info');
    }
    // salud
    g.salud = Math.max(0, Math.min(100, g.salud + (g.hambre <= 0 || g.sed <= 0 ? -3 : g.enfermo ? -0.35 : 0.5) * k));
    if (g.salud <= 0) morirAnimal(s, g, g.hambre <= 0 ? 'de hambre' : 'de sed');
  }
}
function morirAnimal(s, g, causa) {
  g.vivo = false; g.causa = causa;
  log(s, `${g.nombre} (${g.tipo}) murió ${causa}.`, 'muerte');
  humanos(s).forEach((a) => { recuerdo(s, a, `Murió ${g.nombre}`, -8, 72); if (causa === 'atacada por un zorro') memoria(s, a, `El zorro se llevó a ${g.nombre}`, -1); });
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
  n.agua = Math.max(0, n.agua - T.agua * mod(a, 'sed') * (calor(s) ? 1.3 : 1) * k);
  const durmiendo = a.tarea && ['dormir', 'dormirCon'].includes(a.tarea.tipo) && a.tarea.fase === 'trabajo';
  const trabajando = a.tarea && a.tarea.fase === 'trabajo' && AREA[a.tarea.tipo];
  const frioSinAbrigo = a.tipo === 'humano' && frio(s) && !a.dentro && s.rec.abrigos < humanos(s).length;
  if (durmiendo) n.energia = Math.min(100, n.energia + 15 * k);
  else n.energia = Math.max(0, n.energia - (T.energia + (trabajando ? 4 : 0)) * mod(a, 'cansancio') * (est === 'trabaja' && trabajando ? 1.25 : 1) * (frioSinAbrigo ? 1.25 : 1) * k);
  if (!durmiendo) {
    n.social = Math.max(0, n.social - (a.tipo === 'humano' ? 2 + P5(a, 'extraversion') * 3 : 1.5) * k);
    n.diversion = Math.max(0, n.diversion - (a.tipo === 'humano' ? 3 : 2.5 * (mejora(s, 'juguetes') ? 0.6 : 1)) * (trabajando ? 1.4 : 1) * k);
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
  a.vivo = false; a.murio = s.t; a.dentro = false; a.nadando = false;
  a.causa = causa || (a.n.agua <= 0 ? 'de sed' : a.n.comida <= 0 ? 'de hambre' : a.enfermo > 0 ? 'de una enfermedad' : 'de agotamiento');
  soltarTarea(s, a);
  a.accion = 'Murió';
  log(s, `${a.nombre} murió ${a.causa}. 🕯️`, 'muerte');
  for (const o of humanos(s)) { recuerdo(s, o, `Duelo por ${a.nombre}`, a.tipo === 'humano' ? -35 : -18, a.tipo === 'humano' ? 24 * 14 : 24 * 5); memoria(s, o, `La partida de ${a.nombre}`, a.tipo === 'humano' ? -5 : -3); }
  if (s.agentes.filter((x) => x.tipo === 'humano').every((h) => !h.vivo)) {
    s.fin = { t: s.t, dias: diasVividos(s) };
    log(s, `Fin de la generación ${s.generacion}: la granja quedó vacía tras ${s.fin.dias} días.`, 'muerte');
  }
}

// ---------------------------------------------------------------- tareas
function soltarTarea(s, a) {
  const T = a.tarea;
  if (!T) return;
  if (T.parcela != null) { const p = s.parcelas[T.parcela]; if (p && p.reservada === a.id) p.reservada = null; }
  if (T.tipo === 'nadar' && a.nadando) { a.nadando = false; a.pos = { ...LUGAR.piscina }; }
  a.tarea = null;
}
const DENTRO = ['comer', 'beber', 'dormir', 'filtrar', 'cocinar', 'cenar', 'limpiarCasa', 'hacerConservas', 'hacerQueso'];
const AFUERA_URGENTE = ['filtrar'];
const DURACION = {
  comer: 30, beber: 3, dormir: 60, filtrar: 60, sacarAgua: 60, regar: 12, sembrar: 20, cosechar: 30, limpiar: 15, alimentar: 10,
  descansar: 40, leer: 60, tallar: 50, contemplar: 35, jugarGato: 25, pasearPerro: 0, conversar: 25, cocinar: 45, cenar: 35, limpiarCasa: 40, siesta: 50,
  ordenar: 20, recogerHuevos: 10, esquilar: 30, segar: 60, alimentarGanado: 15, tejer: 80, nadar: 40,
  reparar: 70, curar: 25, reconciliar: 20, recogerFlores: 30, jugarPerro: 20, recogerFruta: 30,
  fumigar: 20, arrancar: 25, abonar: 20, voltearCompost: 30,
  construir: 90, esculpir: 80, cuidarJardin: 45, hacerConservas: 60, hacerQueso: 50, secar: 40,
};
const COMIDAS = [['desayuno', 6.5, 9, 20], ['almuerzo', 12, 13.5, 30], ['cena', 19, 20.5, 45]];   // [comida, desde, hasta, minutos de cocina]
const OCIOS = ['esculpir', 'cuidarJardin', 'descansar', 'leer', 'tallar', 'contemplar', 'siesta', 'tejer', 'nadar', 'recogerFlores', 'jugarPerro'];
const vaca = (s) => s.ganado.filter((g) => g.vivo && g.tipo === 'vaca' && g.sexo === 'h' && g.crec >= 1).sort((a, b) => b.ubre - a.ubre)[0];
function crearTarea(s, a, tipo, extra = {}) {
  const t = { tipo, fase: 'camino', trabajo: DURACION[tipo] ?? 30, ...extra };
  const izq = a.id === s.agentes[0].id;
  const adentroOcio = ((tipo === 'leer' || tipo === 'tejer') && (lloviendo(s) || esNoche(s) || hora(s) >= 19.5 || (frio(s) && rng(s) < 0.6)))
    || (tipo === 'siesta' && (calor(s) || lloviendo(s) || frio(s) || rng(s) < 0.5)) || (tipo === 'leer' && rng(s) < 0.35);
  if (DENTRO.includes(tipo) || adentroOcio || t.dentro) { t.destino = { ...LUGAR.puerta }; t.dentro = true; }
  else if (t.parcela != null) { const p = s.parcelas[t.parcela]; t.destino = { x: p.x, z: p.z - 1.3 }; p.reservada = a.id; }
  else if (tipo === 'sacarAgua') t.destino = { x: LUGAR.pozo.x + 1.2, z: LUGAR.pozo.z };
  else if (tipo === 'alimentar') t.destino = { x: LUGAR.comedero.x + 0.9, z: LUGAR.comedero.z + 0.3 };
  else if (['descansar', 'leer', 'siesta', 'tejer'].includes(tipo)) t.destino = { x: LUGAR.banca.x + (izq ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
  else if (tipo === 'tallar') t.destino = { x: LUGAR.taller.x, z: LUGAR.taller.z + 0.9 };
  else if (tipo === 'contemplar') t.destino = { x: LUGAR.mirador.x + (izq ? -0.6 : 0.6), z: LUGAR.mirador.z };
  else if (tipo === 'pasearPerro') { t.ruta = PASEO.map((p) => ({ ...p })); t.destino = t.ruta.shift(); a.tarea = t; return t; }
  else if (tipo === 'jugarGato') { const g = s.agentes.find((x) => x.tipo === 'gato' && x.vivo); t.destino = g ? { x: g.pos.x + 1.0, z: g.pos.z + 0.6 } : { ...LUGAR.banca }; }
  else if (tipo === 'ordenar') { const v = vaca(s); t.destino = v ? { x: v.pos.x + 1.1, z: v.pos.z + 0.4 } : { ...LUGAR.establo }; }
  else if (tipo === 'esquilar') { const o = s.ganado.find((g) => g.id === t.oveja); t.destino = o ? { x: o.pos.x + 1.0, z: o.pos.z + 0.4 } : { ...LUGAR.establo }; }
  else if (tipo === 'recogerHuevos') t.destino = { x: LUGAR.gallinero.x - 2.0, z: LUGAR.gallinero.z + 1.8 };
  else if (tipo === 'segar') t.destino = { x: -14.4 + (rng(s) - 0.5) * 5, z: 4 + (rng(s) - 0.5) * 12 };
  else if (tipo === 'alimentarGanado') t.destino = { x: LUGAR.pesebre.x + 1.0, z: LUGAR.pesebre.z + 0.8 };
  else if (tipo === 'nadar') t.destino = { ...LUGAR.piscina };
  else if (tipo === 'reparar') t.destino = { x: LUGAR.taller.x + 0.6, z: LUGAR.taller.z + 1.0 };
  else if (tipo === 'construir') { const o = OBRAS.find((x) => x[0] === t.obra); t.destino = { x: o[3] + 1.6, z: o[4] + 1.2 }; }
  else if (tipo === 'voltearCompost') t.destino = { x: LUGAR.compost.x + 1.2, z: LUGAR.compost.z + 0.4 };
  else if (tipo === 'esculpir') t.destino = { x: LUGAR.taller.x - 0.4, z: LUGAR.taller.z + 1.0 };
  else if (tipo === 'cuidarJardin') { const j = s.jardines[t.jardin]; t.destino = { x: j.x - 2.1, z: j.z + 0.3 }; }
  else if (tipo === 'secar') { const o = OBRAS.find((x) => x[0] === 'secadero'); t.destino = { x: o[3] + 1.2, z: o[4] + 1.0 }; }
  else if (tipo === 'recogerFruta') { const f = s.frutales[t.arbol]; t.destino = { x: f.x + 1.3, z: f.z + 0.6 }; }
  else if (tipo === 'recogerFlores') { const j = [...(s.jardines || [])].sort((x, y) => y.flores - x.flores)[0]; t.destino = j && j.flores > 0.4 ? { x: j.x + 2.1, z: j.z + 0.3 } : { x: LUGAR.mirador.x + 3 + (rng(s) - 0.5) * 3, z: LUGAR.mirador.z - 2 + (rng(s) - 0.5) * 2 }; }
  else if (tipo === 'curar') { const g = s.ganado.find((x) => x.id === t.animal); t.destino = g ? { x: g.pos.x + 1.0, z: g.pos.z + 0.4 } : { ...LUGAR.establo }; }
  else if (tipo === 'jugarPerro') { const p = s.agentes.find((x) => x.tipo === 'perro' && x.vivo); t.destino = p ? { x: p.pos.x + 1.2, z: p.pos.z + 0.4 } : { ...LUGAR.banca }; }
  // ruta: rodear la casa y entrar por las puertas del corral / gallinero
  if (t.destino && !t.ruta) {
    const desde = a.dentro ? LUGAR.puerta : a.pos;
    const pasos = planRuta(desde, t.destino);
    t.destino = pasos.shift(); t.ruta = pasos;
  }
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
const libreParaPareja = (s, b) => b && b.vivo && despierto(s, b) && (!b.tarea || OCIOS.includes(b.tarea.tipo)) && !b.nadando && b.n.comida > 25 && b.n.agua > 25;
const consumoAgua = (s) => humanos(s).length * 3.5;
const esAfuera = (T) => T && !T.dentro && !DENTRO.includes(T.tipo);

function invitar(s, a, tipo) {
  const b = pareja(s, a);
  if (!libreParaPareja(s, b)) return false;
  const afuera = !esNoche(s) && hora(s) < 19.5 && !lloviendo(s) && !frio(s);
  const cita = s.t;
  for (const [x, lado] of [[a, -1], [b, 1]]) {
    soltarTarea(s, x);
    const t = crearTarea(s, x, tipo, { cita, dentro: !afuera });
    const lugar = obra(s, 'pergola') && rng(s) < 0.5 ? { x: 25 + lado * 0.8, z: 20.5 } : { x: LUGAR.banca.x + lado * 0.75, z: LUGAR.banca.z + 1.7 };
      if (afuera) { const pasos = planRuta(x.dentro ? LUGAR.puerta : x.pos, lugar); t.destino = pasos.shift(); t.ruta = pasos; t.dentro = false; }
  }
  return true;
}

function elegirTarea(s, a) {
  const n = a.n, R = s.rec, est = estres(s, a), resp = P5(a, 'responsabilidad'), h = hora(s);
  const otro = pareja(s, a), llueve = lloviendo(s);
  if (n.agua < 40 && (R.potable >= 1 || R.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.comida < (est === 'raciona' ? 25 : 40) && comidaTotal(s) >= 1) return crearTarea(s, a, 'comer');
  if (n.energia < 18) return crearTarea(s, a, 'dormir');
  if (horaDeDormir(s, a) && n.energia < 92) return crearTarea(s, a, 'dormir');

  // todas las comidas se cocinan y se comen en la mesa: desayuno, almuerzo y cena
  for (const [comida, h0, h1, mins] of COMIDAS) {
    if (h < h0 || h >= h1 || s.pareja['ultima_' + comida] === dia(s) || comidaTotal(s) < 2 || (comida !== 'cena' && n.comida > 90)) continue;   // la cena es un ritual: siempre
    const otroCocina = otro && despierto(s, otro) && !otro.nadando;
    const cocinero = !otroCocina ? a : comida === 'desayuno'
      ? [a, otro].sort((x, y) => (HAB(y).cronotipo === 'madrugador' ? 1 : 0) - (HAB(x).cronotipo === 'madrugador' ? 1 : 0))[0]
      : [a, otro].sort((x, y) => (nivel(y.xp.casa) + P5(y, 'apertura') * 3 + (tiene(y, 'chef') ? 3 : 0)) - (nivel(x.xp.casa) + P5(x, 'apertura') * 3 + (tiene(x, 'chef') ? 3 : 0)))[0];
    if (cocinero === a && !ocupadoEn(otro, ['cocinar'])) { s.pareja['ultima_' + comida] = dia(s); return crearTarea(s, a, 'cocinar', { comida, trabajo: mins }); }
  }

  // trabajo por urgencia (con lluvia solo lo de adentro o lo muy urgente)
  const libre = (p) => !p.reservada;
  const yaHace = (tipo) => otro && otro.tarea && otro.tarea.tipo === tipo;
  const umbralRiego = 30 + resp * 25, e = estacion(s);
  const opciones = [];
  if (R.potable < Math.max(8, consumoAgua(s)) && R.cruda >= 5 && !yaHace('filtrar')) opciones.push([100, 'filtrar']);
  { const p = s.parcelas.find((p) => p.estado === 'lista' && libre(p)); if (p) opciones.push([90, 'cosechar', { parcela: p.id }]); }
  if (R.cruda >= 8) { const p = s.parcelas.find((p) => p.estado === 'creciendo' && p.agua < umbralRiego && libre(p)); if (p) opciones.push([85, 'regar', { parcela: p.id }]); }
  if (R.cruda < 60 && !yaHace('sacarAgua')) opciones.push([80, 'sacarAgua']);
  const v = vaca(s);
  if (v && !yaHace('ordenar') && v.ubre >= (h >= 5 && h < 11 ? 6 : 12)) opciones.push([75, 'ordenar']);
  const animalesGranja = s.ganado.some((g) => g.vivo);
  const reservaHumana = 30 + humanos(s).length * 28;   // las personas primero: comida para ~20 días
  const hambreGranja = s.ganado.some((g) => g.vivo && g.hambre < 30 && !esAve(g.tipo));
  if (animalesGranja && !yaHace('alimentarGanado') && ((R.pesebre < 3 && (e === 3 || s.granja.pasto < 25 || hambreGranja) && (R.heno >= 2 || (hambreGranja && R.raciones > reservaHumana))) || (R.bebederoGanado < 15 && R.cruda >= 20) || (e === 3 && R.grano < 0.5 && R.raciones >= 1)))
    opciones.push([hambreGranja ? 92 : 72, 'alimentarGanado']);
  { const p = s.parcelas.find((p) => p.estado === 'vacia' && libre(p) && (elegirCultivo(s, a) || (obra(s, 'invernadero') && p.id >= 9))); const c = p && elegirCultivo(s, a, obra(s, 'invernadero') && p.id >= 9, p); if (p && c) opciones.push([comidaTotal(s) > 300 ? 28 : 70, 'sembrar', { parcela: p.id, cultivo: c }]); }
  if ((R.comedero < 0.5 || R.bebedero < 2) && (comidaTotal(s) >= 1 || R.cruda >= 3) && !yaHace('alimentar') && s.agentes.some((x) => x.tipo !== 'humano' && x.vivo)) opciones.push([65, 'alimentar']);
  { const p = s.parcelas.find((p) => p.estado === 'muerta' && libre(p)); if (p) opciones.push([60, 'limpiar', { parcela: p.id }]); }
  // sanidad vegetal: quien tiene mano verde ve la plaga antes
  { const ve = tiene(a, 'manoVerde') ? 0.12 : 0.3;
    const p = s.parcelas.filter((q) => q.estado === 'creciendo' && q.plaga > ve && libre(q)).sort((x, y) => y.plaga - x.plaga)[0];
    if (p) opciones.push(p.plaga > 0.85 && p.salud < 30 ? [84, 'arrancar', { parcela: p.id }] : [80, 'fumigar', { parcela: p.id }]); }
  { const p = s.parcelas.find((q) => (q.estado === 'vacia' || q.estado === 'creciendo') && Math.min(q.N, q.P, q.K) < 40 && libre(q));
    if (p && (R.compost || 0) >= 4 && !yaHace('abonar')) opciones.push([57, 'abonar', { parcela: p.id }]); }
  if ((R.pila || 0) > 15 && dia(s) - (s.ultimoVolteo ?? -99) >= 5 && !yaHace('voltearCompost')) opciones.push([40, 'voltearCompost']);
  if (R.nido >= 2 && !yaHace('recogerHuevos')) opciones.push([55, 'recogerHuevos']);
  { const o = s.ganado.find((g) => g.vivo && g.tipo === 'oveja' && g.crec >= 1 && g.lana >= 70); if (o && (e === 0 || e === 1) && !yaHace('esquilar')) opciones.push([52, 'esquilar', { oveja: o.id }]); }
  if (s.casa.limpieza < 25 + resp * 35 && !yaHace('limpiarCasa')) opciones.push([45 + resp * 15, 'limpiarCasa']);
  if (R.lana >= 4 && R.abrigos < humanos(s).length + (e >= 2 ? 0 : -1) && !yaHace('tejer')) opciones.push([e >= 2 ? 48 : 30, 'tejer']);
  if (R.potable < consumoAgua(s) * (3 + resp * 4) && R.cruda >= 30 && !yaHace('filtrar')) opciones.push([40, 'filtrar']);
  { const g = s.ganado.find((x) => x.vivo && x.enfermo > 0); if (g && !yaHace('curar')) opciones.push([g.salud < 50 ? 88 : 62, 'curar', { animal: g.id }]); }
  { const f = (s.frutales || []).filter((x) => x.fruta >= 6).sort((x, y) => y.fruta - x.fruta)[0]; if (f && !yaHace('recogerFruta')) opciones.push([f.fruta >= 11 ? 68 : 54, 'recogerFruta', { arbol: f.id }]); }
  // conservar la comida
  // (la despensa tiene un límite: frascos, quesos y secos solo hasta llenarla)
  if (R.leche >= 6 && (R.queso || 0) < CAPACIDAD.queso && !yaHace('hacerQueso')) opciones.push([58, 'hacerQueso']);
  if (R.raciones > 70 && (e === 2 || R.raciones > 140) && (R.conservas || 0) < CAPACIDAD.conservas && !yaHace('hacerConservas')) opciones.push([44 + (e === 2 ? 10 : 0), 'hacerConservas']);
  if (obra(s, 'secadero') && R.raciones > 50 && (R.secos || 0) < CAPACIDAD.secos && e !== 3 && !llueve && h > 8 && h < 16 && !yaHace('secar')) opciones.push([36, 'secar']);
  // obras de Andrés (o de quien tenga el oficio)
  { const o = (s.obras || []).find((x) => x.progreso < 1);
    if (o && !yaHace('construir') && (tiene(a, 'manitas') || nivel(a.xp.carpinteria) >= 3)) opciones.push([34 + (tiene(a, 'manitas') ? 14 : 0) + (o.id === 'bodega' && R.raciones > 120 ? 10 : 0), 'construir', { obra: o.id }]); }
  // jardines de María
  { const j = (s.jardines || []).filter((x) => x.cuidado < 0.85).sort((x, y) => x.cuidado - y.cuidado)[0];
    if (j && e !== 3 && !yaHace('cuidarJardin') && (tiene(a, 'manoVerde') || tiene(a, 'romantico'))) opciones.push([30 + (tiene(a, 'manoVerde') ? 12 : 0) + (j.cuidado < 0.3 ? 12 : 0), 'cuidarJardin', { jardin: j.id }]); }
  if (s.casa.estado < 55 + resp * 20 && !yaHace('reparar')) opciones.push([s.casa.estado < 35 ? 82 : 46 + (tiene(a, 'manitas') ? 14 : 0), 'reparar']);
  const henoMeta = 50 + 32 * enCorral(s);
  if (s.granja.pasto >= 50 && (e === 1 || e === 2) && R.heno < henoMeta && !yaHace('segar')) opciones.push([R.heno < henoMeta * 0.75 && e === 2 ? 66 : 40, 'segar']);
  if (R.cruda < 150 + resp * 200 && !yaHace('sacarAgua') && e !== 0) opciones.push([35, 'sacarAgua']);
  const trabajoValido = opciones.filter((o) => !llueve || ['filtrar', 'limpiarCasa', 'tejer', 'reparar'].includes(o[1]) || o[0] >= 92);

  // después de una discusión: el más amable (o el menos rencoroso) pide perdón
  const pend = s.pareja.pendiente;
  if (pend && pend.perdon !== false && otro && s.t - pend.t > 60 && libreParaPareja(s, otro) && !irritable(a)) {
    const pide = (x) => P5(x, 'amabilidad') - P5(x, 'neuroticismo') * 0.5;
    if (pide(a) >= pide(otro) || s.t - pend.t > 10 * 60) { if (invitar(s, a, 'reconciliar')) return a.tarea; }
  }

  // ocio según gustos, clima y hora
  const ocio = [];
  const gustos = HAB(a).ocio || [];
  const gusto = (k) => (gustos.includes(k) ? 1.6 - gustos.indexOf(k) * 0.15 : 0.6);
  const necesitaOcio = (100 - n.diversion) * 0.7;
  const necesitaSocial = (100 - n.social) * (0.4 + P5(a, 'extraversion') * 0.8);
  const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo && !x.dentro);
  const perro = s.agentes.find((x) => x.tipo === 'perro' && x.vivo);
  const luz = h >= 6.5 && h < 20.5;
  const exterior = luz && !llueve ? (frio(s) ? 0.4 : 1) : 0;
  ocio.push([necesitaOcio * gusto('leer') * (llueve || frio(s) ? 1.4 : 1), 'leer']);
  if (R.lana >= 1) ocio.push([necesitaOcio * gusto('tejer') * (llueve || frio(s) ? 1.4 : 0.9), 'tejer']);
  if (exterior) {
    ocio.push([necesitaOcio * gusto('tallar') * exterior, 'tallar']);
    ocio.push([necesitaOcio * gusto('contemplar') * exterior * (h > 17.5 ? 1.5 : 1) * (s.clima.arcoiris > s.t ? 4 : 1), 'contemplar']);
    if (gato && !ocupadoEn(otro, ['jugarGato'])) ocio.push([necesitaOcio * gusto('jugarGato') * exterior * (0.5 + (HAB(a).animales?.esmoquin ?? 0.5)), 'jugarGato']);
    if (perro && perro.n.diversion < 55 && !ocupadoEn(otro, ['pasearPerro'])) ocio.push([(necesitaOcio + (100 - perro.n.diversion) * 0.5) * gusto('pasearPerro') * exterior * (0.5 + (HAB(a).animales?.nube ?? 0.5)), 'pasearPerro']);
    if (e !== 3 && h >= 9 && h < 19) ocio.push([necesitaOcio * gusto('nadar') * (calor(s) ? 2.2 : 0.8) * exterior, 'nadar']);
  }
  if (otro && libreParaPareja(s, otro) && !irritable(a)) ocio.push([necesitaSocial * 1.2, 'conversar']);
  if (h >= 13 && h < 15.5 && n.energia < 60) ocio.push([(60 - n.energia) * (calor(s) ? 1.6 : 1), 'siesta']);
  // arte: Andrés talla esculturas en su tiempo libre; María cuida sus flores por gusto
  if (tiene(a, 'manitas') && exterior && (s.esculturas || 0) < ESCULTURAS.length) ocio.push([necesitaOcio * 1.2, 'esculpir']);
  if (tiene(a, 'manoVerde') && exterior && e !== 3) { const j = [...(s.jardines || [])].sort((x, y) => x.cuidado - y.cuidado)[0]; if (j) ocio.push([necesitaOcio * 1.3, 'cuidarJardin', j.id]); }
  // alma romántica: recoge flores para regalar (primavera y verano)
  if (tiene(a, 'romantico') && otro && exterior && e <= 1 && s.t - (a.ultimoRegalo || -1e9) > 7 * MIN_DIA) ocio.push([20 + (100 - s.pareja.afinidad) * 0.5 + (otro.deseo?.id === 'regalo' ? 25 : 0), 'recogerFlores']);
  ocio.sort((x, y) => y[0] - x[0]);

  const rol = HAB(a).rol, rolOtro = otro && HAB(otro).rol;
  const otroLibre = otro && despierto(s, otro) && (!otro.tarea || OCIOS.includes(otro.tarea.tipo));
  trabajoValido.forEach((o) => {
    if (rol && AREA[o[1]] === rol) o[0] += 25;
    else if (otroLibre && rolOtro && AREA[o[1]] === rolOtro && o[0] < 95) o[0] -= 30;
  });
  trabajoValido.sort((x, y) => y[0] - x[0]);
  const trabajo = trabajoValido[0], gana = ocio[0];
  if (gana && gana[0] > 18 && (!trabajo || gana[0] > trabajo[0] * (0.55 + resp * 0.6))) {
    if (gana[1] === 'conversar') { if (invitar(s, a, 'conversar')) return a.tarea; }
    else if (gana[1] !== a.ultimoOcio || gana[0] > 45) { a.ultimoOcio = gana[1]; if (gana[1] === 'cuidarJardin') return crearTarea(s, a, 'cuidarJardin', { jardin: gana[2] }); return iniciarOcio(s, a, gana[1]); }
  }
  if (trabajo) { const [, tipo, extra] = trabajo; return crearTarea(s, a, tipo, extra); }

  if (n.agua < 65 && R.potable >= 1) return crearTarea(s, a, 'beber');
  if (n.comida < 55 && comidaTotal(s) >= 1 && est !== 'raciona' && h > 11.5 && h < 13.5) return crearTarea(s, a, 'comer');
  const libres = ocio.filter((o) => o[1] !== 'conversar' && o[1] !== 'siesta' && o[1] !== 'cuidarJardin');
  if (libres.length && (luz || llueve)) {
    const pesos = libres.map(([v, k]) => Math.max(4, v) * gusto(k) * (k === a.ultimoOcio ? 0.25 : 1));
    let r = rng(s) * pesos.reduce((x, y) => x + y, 0), i = 0;
    while (i < pesos.length - 1 && (r -= pesos[i]) > 0) i++;
    a.ultimoOcio = libres[i][1];
    return iniciarOcio(s, a, libres[i][1]);
  }
  if (luz) return crearTarea(s, a, 'descansar');
  return crearTarea(s, a, n.energia < 92 ? 'dormir' : 'leer');
}
// el nado puede contagiar a la pareja si también le gusta
function iniciarOcio(s, a, tipo) {
  const t = crearTarea(s, a, tipo);
  if (tipo === 'nadar') {
    const b = pareja(s, a);
    if (libreParaPareja(s, b) && (HAB(b).ocio || []).includes('nadar') && rng(s) < 0.35 + P5(b, 'extraversion') * 0.4) { soltarTarea(s, b); crearTarea(s, b, 'nadar'); log(s, `${a.nombre} y ${b.nombre} se fueron a nadar juntos.`, 'info'); cumplirDeseo(s, a, 'nadarJuntos'); cumplirDeseo(s, b, 'nadarJuntos'); }
  }
  return t;
}

export const ACCION = {
  comer: 'Comiendo', beber: 'Bebiendo', dormir: 'Durmiendo', filtrar: 'Filtrando agua', sacarAgua: 'Sacando agua del pozo',
  regar: 'Regando', sembrar: 'Sembrando', cosechar: 'Cosechando', limpiar: 'Limpiando una parcela', alimentar: 'Alimentando al perro y al gato', descansar: 'Descansando en la banca',
  leer: 'Leyendo', tallar: 'Tallando madera', contemplar: 'Contemplando el paisaje', jugarGato: 'Jugando con el gato', pasearPerro: 'Paseando al perro',
  conversar: 'Conversando', cocinar: 'Cocinando la cena', cenar: 'Cenando juntos', limpiarCasa: 'Limpiando la casa', siesta: 'Tomando la siesta',
  ordenar: 'Ordeñando a la vaca', recogerHuevos: 'Recogiendo huevos', esquilar: 'Esquilando una oveja', segar: 'Segando pasto para heno', alimentarGanado: 'Alimentando la granja',
  tejer: 'Tejiendo un abrigo', nadar: 'Nadando', reparar: 'Reparando la casa', curar: 'Curando a un animal', recogerFruta: 'Recogiendo fruta', construir: 'Construyendo', fumigar: 'Tratando una plaga', arrancar: 'Arrancando plantas enfermas', abonar: 'Abonando la tierra', voltearCompost: 'Volteando el compost', esculpir: 'Tallando una escultura', cuidarJardin: 'Cuidando el jardín', hacerConservas: 'Haciendo conservas', hacerQueso: 'Haciendo queso', secar: 'Secando fruta al sol', jugarJuntos: 'Jugando a perseguirse', explorar: 'Explorando', reconciliar: 'Haciendo las paces',
  recogerFlores: 'Recogiendo flores', jugarPerro: 'Jugando a la pelota', vigilar: 'Vigilando el gallinero', pelota: 'Trae la pelota', regazo: 'En un regazo',
  seguir: 'Acompañando a la pareja', cazar: 'Cazando ratones', dormirCon: 'Durmiendo acurrucado', pedir: 'Pidiendo atención', jugar: 'Jugando', pasear: 'De paseo', refugio: 'Refugiado de la lluvia',
};
const VA_A = {
  comer: 'Va a comer', beber: 'Va a beber', dormir: 'Va a dormir', filtrar: 'Va a filtrar agua', sacarAgua: 'Va al pozo',
  regar: 'Va a regar', sembrar: 'Va a sembrar', cosechar: 'Va a cosechar', limpiar: 'Va a limpiar una parcela', alimentar: 'Va a alimentar a las mascotas',
  descansar: 'Va a la banca', leer: 'Va a leer', tallar: 'Va a tallar madera', contemplar: 'Va a mirar el paisaje', jugarGato: 'Va a jugar con el gato',
  pasearPerro: 'Paseando al perro', conversar: 'Va a conversar', cocinar: 'Va a cocinar', cenar: 'Va a cenar', limpiarCasa: 'Va a limpiar la casa', siesta: 'Va a la siesta',
  ordenar: 'Va a ordeñar', recogerHuevos: 'Va al gallinero', esquilar: 'Va a esquilar', segar: 'Va a segar', alimentarGanado: 'Va al pesebre', tejer: 'Va a tejer', nadar: 'Va a la piscina',
  reparar: 'Va al taller a reparar', curar: 'Va a curar un animal', recogerFruta: 'Va a los frutales', construir: 'Va a la obra', fumigar: 'Va a tratar una plaga', abonar: 'Va a abonar', voltearCompost: 'Va al compost', esculpir: 'Va al taller a esculpir', cuidarJardin: 'Va al jardín', secar: 'Va al secadero', reconciliar: 'Va a hacer las paces', recogerFlores: 'Va a recoger flores', jugarPerro: 'Va a jugar con el perro',
};

const OCIO_LLENA = { cuidarJardin: 0.7, esculpir: 0.6, leer: 0.7, tallar: 0.75, contemplar: 0.8, jugarGato: 1.1, descansar: 0.35, siesta: 0.3, tejer: 0.6, nadar: 1.1, recogerFlores: 0.8, jugarPerro: 1.2 };
function comportamiento(s, a, d) {
  if (a.tipo !== 'humano') return comportamientoAnimal(s, a, d);
  const T0 = a.tarea;
  // lluvia: lo que se hace afuera se deja (salvo lo muy urgente) y corren a la casa
  if (T0 && lloviendo(s) && esAfuera(T0) && !(T0.tipo === 'alimentarGanado' && s.ganado.some((g) => g.vivo && g.hambre < 25))) {
    if (!a.mojado || a.mojado < s.clima.lluviaHoy?.desde) { a.mojado = s.t; recuerdo(s, a, 'Se mojó con la lluvia', -2, 4); }
    soltarTarea(s, a);
  }
  if (a.tarea && !['beber', 'comer', 'dormir', 'cenar'].includes(a.tarea.tipo) && ((a.n.agua < 20 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) || (a.n.comida < 20 && comidaTotal(s) >= 1))) soltarTarea(s, a);
  if (!a.tarea) elegirTarea(s, a);
  const T = a.tarea;
  // alergia al polen: en primavera, afuera, estornuda (una vez al día lo anota el diario)
  if (tiene(a, 'alergia') && estacion(s) === 0 && !a.dentro && despierto(s, a) && rng(s) < d * 0.004) {
    recuerdo(s, a, 'Estornudos por el polen', -3, 6);
    if (a.diaAlergia !== dia(s)) { a.diaAlergia = dia(s); log(s, `🤧 ${a.nombre} no para de estornudar: el polen de primavera está fuerte.`, 'info'); }
  }
  a.accion = T.fase === 'camino' ? VA_A[T.tipo] || ACCION[T.tipo] : ACCION[T.tipo];
  if (T.comida && T.tipo === 'cocinar') a.accion = { desayuno: 'Preparando el desayuno', almuerzo: 'Cocinando el almuerzo', cena: 'Cocinando la cena' }[T.comida];
  if (T.comida && T.tipo === 'cenar' && T.fase === 'trabajo') a.accion = { desayuno: 'Desayunando', almuerzo: 'Almorzando', cena: 'Cenando' }[T.comida] + (T.juntos ? ' juntos' : '');
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (a.dentro && T.dentro) { T.fase = 'trabajo'; return; }
    if (mover(a, T.destino, d)) {
      if (T.ruta && T.ruta.length) { T.destino = T.ruta.shift(); return; }
      if (T.tipo === 'pasearPerro') { terminarPaseo(s, a); return; }
      T.fase = 'trabajo'; if (T.dentro) a.dentro = true;
      if (T.tipo === 'nadar') { a.nadando = true; T.ang = Math.atan2(a.pos.z - (PISCINA.z0 + PISCINA.z1) / 2, a.pos.x - (PISCINA.x0 + PISCINA.x1) / 2); }
      if (T.tipo === 'ordenar') { const v = vaca(s); if (v) v.quieta = s.t + T.trabajo + 2; }
      if (T.tipo === 'esquilar') { const o = s.ganado.find((g) => g.id === T.oveja); if (o) o.quieta = s.t + T.trabajo + 2; }
    }
    return;
  }
  if (T.tipo === 'dormir') {
    if (!horaDeDormir(s, a) && a.n.energia >= 95) { soltarTarea(s, a); despertar(s, a); }
    else if ((a.n.agua < 15 && s.rec.potable >= 1) || (a.n.comida < 15 && comidaTotal(s) >= 1)) soltarTarea(s, a);
    return;
  }
  if (T.cita != null) {
    const b = pareja(s, a);
    if (!b || !b.tarea || b.tarea.cita !== T.cita) { if (T.tipo !== 'cenar') { soltarTarea(s, a); return; } }
    else if (b.tarea.fase !== 'trabajo') return;
  }
  // nadar: da vueltas por la piscina
  if (T.tipo === 'nadar') {
    T.ang = (T.ang || 0) + d * 0.09;
    const cx = (PISCINA.x0 + PISCINA.x1) / 2, cz = (PISCINA.z0 + PISCINA.z1) / 2;
    a.pos.x = cx + Math.cos(T.ang) * 2.4; a.pos.z = cz + Math.sin(T.ang) * 1.5;
    a.n.energia = Math.max(0, a.n.energia - 0.03 * d);
    if (calor(s)) recuerdo(s, a, 'Se refrescó en la piscina', 6, 8);
  }
  const area = AREA[T.tipo], areaXp = area || XP_OCIO[T.tipo];
  const animoVel = a.animo < 30 ? 0.8 : a.animo > 70 ? 1.1 : 1;
  const vel = area ? mod(a, area) * (1 + 0.06 * nivel(a.xp[area])) * (estres(s, a) === 'trabaja' ? 1.2 : 1) * (a.enfermo > 0 ? 0.6 : 1) * animoVel * (a.animo_buff > s.t ? 1.15 : 1) : 1;
  if (areaXp) {
    const antes = nivel(a.xp[areaXp]);
    a.xp[areaXp] = (a.xp[areaXp] || 0) + d * mod(a, 'aprende') * mod(a, 'aprende_' + areaXp) * (area ? 1 : 0.3);
    const ahora = nivel(a.xp[areaXp]);
    if (ahora > antes) {
      log(s, `${a.nombre} mejoró en ${HABILIDADES[areaXp].toLowerCase()}: nivel ${ahora}.`, 'logro');
      cumplirDeseo(s, a, 'subirNivel');
      for (const [nv, k, nom, desc] of DESBLOQUEOS[areaXp] || []) {
        if (ahora >= nv && !mejora(s, k)) { s.desbloqueos.push(k); log(s, `🔓 ${a.nombre} desbloqueó ${nom}: ${desc}.`, 'logro'); recuerdo(s, a, `Aprendió algo nuevo: ${nom}`, 5, 12); }
      }
    }
  }
  if (OCIO_LLENA[T.tipo]) a.n.diversion = Math.min(100, a.n.diversion + OCIO_LLENA[T.tipo] * d * ((HAB(a).ocio || []).includes(T.tipo) ? 1.3 : 1));
  if (T.tipo === 'siesta') a.n.energia = Math.min(100, a.n.energia + 0.2 * d);
  if (T.tipo === 'conversar' || T.tipo === 'cenar' || T.tipo === 'reconciliar') a.n.social = Math.min(100, a.n.social + 2.2 * d);
  if (T.tipo === 'jugarPerro') { const p = s.agentes.find((x) => x.tipo === 'perro' && x.vivo); if (p) { p.n.diversion = Math.min(100, p.n.diversion + d); if (!p.tarea || p.tarea.tipo !== 'jugar') { p.tarea = { tipo: 'jugar', fase: 'trabajo', trabajo: T.trabajo, con: a.id }; p.dentro = false; } } }
  if (T.tipo === 'contemplar' && s.clima.arcoiris > s.t && !T.vioArcoiris) { T.vioArcoiris = true; recuerdo(s, a, 'Vio un arcoíris', 8, 12); cumplirDeseo(s, a, 'arcoiris'); }
  if (T.tipo === 'jugarGato') {
    const g = s.agentes.find((x) => x.tipo === 'gato' && x.vivo);
    if (g) { g.n.diversion = Math.min(100, g.n.diversion + d); if (!g.tarea || g.tarea.tipo !== 'jugar') { g.tarea = { tipo: 'jugar', fase: 'trabajo', trabajo: T.trabajo, con: a.id }; g.dentro = false; } }
  }
  T.trabajo -= d * vel;
  if (OCIOS.includes(T.tipo) && T.tipo !== 'nadar' && necesitaTrabajo(s, a)) { soltarTarea(s, a); return; }
  if (T.trabajo > 0) return;
  completar(s, a, T);
  if (a.tarea === T) soltarTarea(s, a);
}
const necesitaTrabajo = (s, a) => !lloviendo(s) && (s.parcelas.some((p) => !p.reservada && (p.estado === 'lista' || (p.estado === 'creciendo' && p.agua < 25 + P5(a, 'responsabilidad') * 20)))
  || s.rec.potable < 8 || s.rec.cruda < 60 || s.ganado.some((g) => g.vivo && g.hambre < 25));

function despertar(s, a) {
  const otro = pareja(s, a);
  if (otro && otro.tarea?.tipo === 'dormir' && HAB(a).cronotipo === 'madrugador' && HAB(otro).cronotipo === 'noctambulo' && rng(s) < 0.05) {
    log(s, `${a.nombre} madrugó a ordeñar y revisar el huerto mientras ${otro.nombre} seguía durmiendo.`, 'info');
  }
}
function terminarPaseo(s, a) {
  const perro = s.agentes.find((x) => x.tipo === 'perro' && x.vivo);
  if (perro) { perro.n.diversion = Math.min(100, perro.n.diversion + 60); perro.n.energia = Math.max(0, perro.n.energia - 8); }
  a.n.diversion = Math.min(100, a.n.diversion + 30);
  recuerdo(s, a, 'Un buen paseo con el perro', 6, 8);
  vincular(s, perro, a, 4); cumplirDeseo(s, a, 'paseo');
  soltarTarea(s, a);
}

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
      const otro = pareja(s, a);
      if (comidaTotal(s) >= 1 && escasez(s) && otro && otro.n.comida < a.n.comida - 15 && P5(a, 'amabilidad') > 0.6 && rng(s) < 0.5) {
        if (consumirComida(s, otro, 23)) { a.n.comida = Math.min(100, a.n.comida + 15); recuerdo(s, otro, `${a.nombre} compartió su comida`, 10, 24); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 3); log(s, `${a.nombre} compartió su ración con ${otro.nombre}.`, 'bueno'); }
      } else {
        const que = consumirComida(s, a, 38);
        if (que === 'huevos' && hora(s) < 11) recuerdo(s, a, 'Desayunó huevos frescos', 4, 6);
        if (que === 'leche') recuerdo(s, a, 'Leche fresca de Canela', 3, 6);
        if (que === 'raciones' && s.ultimaCosecha === HAB(a).comida && rng(s) < 0.5) recuerdo(s, a, `Comió ${CULTIVOS[HAB(a).comida].nombre.toLowerCase()}, su favorita`, 5, 6);
      }
      break;
    }
    case 'cocinar': {
      const otro = pareja(s, a);
      const comida = T.comida || 'cena';
      s.pareja.recetaNueva = comida === 'cena' && rng(s) < P5(a, 'apertura') * 0.5 + (mejora(s, 'recetario') ? 0.25 : 0);
      s.pareja.cocinero = a.id;
      if (s.pareja.recetaNueva) log(s, `${a.nombre} probó una receta nueva para la cena${R.huevos >= 2 ? ' con huevos del gallinero' : R.leche >= 1 ? ' con leche de la vaca' : ''}.`, 'info');
      const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo);
      if (gato && rng(s) < 0.2) log(s, `${gato.nombre} maulló sin parar mientras ${a.nombre} cocinaba.`, 'info');
      const cita = s.t;
      const juntos = !!(otro && despierto(s, otro) && otro.tarea?.tipo !== 'dormir' && otro.n.comida < 97);
      crearTarea(s, a, 'cenar', { cita, juntos, comida, trabajo: comida === 'cena' ? 35 : 20 });
      a.tarea.fase = 'trabajo';
      if (juntos) { soltarTarea(s, otro); crearTarea(s, otro, 'cenar', { cita, juntos, comida, trabajo: comida === 'cena' ? 35 : 20 }); }
      return;
    }
    case 'cenar': {
      const otro = pareja(s, a);
      const comida = T.comida || 'cena';
      consumirComida(s, a, comida === 'cena' ? 45 : 38);
      const juntos = T.juntos && otro;
      const pan = obra(s, 'horno') ? 2 : 0;
      if (comida !== 'cena') {
        recuerdo(s, a, juntos ? (comida === 'desayuno' ? 'Desayunaron juntos' : 'Almorzaron juntos') : 'Comió a solas', (juntos ? 3 : -1) + pan, 6);
        if (juntos && s.pareja.comidaResuelta !== T.cita) { s.pareja.comidaResuelta = T.cita; s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 0.8); }
        break;
      }
      const chef = s.agentes.find((x) => x.id === s.pareja.cocinero);
      const deChef = chef && tiene(chef, 'chef') ? 2 : 0;
      recuerdo(s, a, juntos ? 'Cena juntos' : 'Cenó a solas', juntos ? 8 + (s.pareja.recetaNueva ? 4 : 0) + (mejora(s, 'recetario') ? 1 : 0) + deChef : -2 + deChef, 14);
      if (juntos && s.pareja.recetaNueva) cumplirDeseo(s, a, 'cenaEspecial');
      if (juntos && s.pareja.cenaResuelta !== T.cita) { s.pareja.cenaResuelta = T.cita; s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 2.5); efecto(s, 'corazones', 0.5, 0, { techo: true }); }
      break;
    }
    case 'conversar': {
      const otro = pareja(s, a);
      if (!otro || s.pareja.resuelta === T.cita) break;
      s.pareja.resuelta = T.cita;
      s.pareja.charlas += 1;
      const irr = (irritable(a) ? 1 : 0) + (irritable(otro) ? 1 : 0);
      const amab = (P5(a, 'amabilidad') + P5(otro, 'amabilidad')) / 2, neuro = (P5(a, 'neuroticismo') + P5(otro, 'neuroticismo')) / 2;
      const choque = Math.abs(P5(a, 'extraversion') - P5(otro, 'extraversion')) * 0.12 + Math.abs(P5(a, 'responsabilidad') - P5(otro, 'responsabilidad')) * 0.1;
      const grunon = [a, otro].find((x) => tiene(x, 'grunon') && hora(s) < 9);
      const pDisc = 0.03 + choque + (1 - amab) * 0.08 + neuro * 0.06 + irr * (0.3 * (1 - amab) + 0.15 * neuro) + (escasez(s) ? 0.08 : 0) + (s.casa.limpieza < 35 ? 0.05 : 0) - s.pareja.afinidad / 1200
        + (s.pareja.tension || 0) / 350 + (grunon ? 0.14 : 0);
      const mid = { x: (a.pos.x + otro.pos.x) / 2, z: (a.pos.z + otro.pos.z) / 2 };
      if (rng(s) < pDisc) {
        s.pareja.afinidad = Math.max(0, s.pareja.afinidad - 6); s.pareja.discusiones += 1;
        const tema = grunon ? `porque ${grunon.nombre} amaneció de mal genio` : escasez(s) ? 'por la comida' : s.casa.limpieza < 35 ? 'por la casa desordenada' : s.casa.estado < 40 ? 'por las goteras de la casa' : irritable(a) || irritable(otro) ? 'por el cansancio' : 'por una tontería';
        s.pareja.tension = Math.min(100, (s.pareja.tension || 0) + 22);
        s.pareja.pendiente = { t: s.t, perdon: rng(s) < 0.35 + Math.max(P5(a, 'amabilidad'), P5(otro, 'amabilidad')) * 0.45 - Math.max(P5(a, 'neuroticismo'), P5(otro, 'neuroticismo')) * 0.25 };
        log(s, `${a.nombre} y ${otro.nombre} discutieron ${tema}.`, 'malo');
        recuerdo(s, a, 'Discutieron', -12, 16); recuerdo(s, otro, 'Discutieron', -12, 16);
        efecto(s, 'discusion', mid.x, mid.z, { dentro: a.dentro });
      } else {
        s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1.2);
        const pergola = obra(s, 'pergola') && !a.dentro ? 3 : 0;
        recuerdo(s, a, 'Buena conversación', 6 + pergola, 10); recuerdo(s, otro, 'Buena conversación', 6 + pergola, 10);
        efecto(s, 'charla', mid.x, mid.z, { dentro: a.dentro });
      }
      break;
    }
    case 'limpiarCasa': s.casa.limpieza = Math.min(100, s.casa.limpieza + 60); recuerdo(s, a, 'Casa limpia', 3, 12); break;
    case 'filtrar': { const l = Math.min(mejora(s, 'filtroDoble') ? 40 : 25, R.cruda); R.cruda -= l; R.potable += l; break; }
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
        const nutr = Math.max(0.4, Math.min(1.1, Math.min(p.N, p.P, p.K) / 45));
        const rot = p.ultimo === p.cultivo ? 0.75 : p.ultimo === 'frijol' && (p.cultivo === 'maiz' || p.cultivo === 'papa') ? 1.15 : 1;
        const rac = Math.max(1, Math.round(C.raciones * mod(a, 'cosecha') * (1 + 0.03 * nivel(a.xp.huerto)) * nutr * rot * (0.3 + 0.7 * p.salud / 100)));
        if (rot < 1 && rng(s) < 0.5) log(s, `Repetir ${C.nombre.toLowerCase()} en la misma tierra rindió menos.`, 'info');
        if (rot > 1 && rng(s) < 0.5) log(s, `El fríjol dejó la tierra rica en nitrógeno: buena cosecha de ${C.nombre.toLowerCase()}.`, 'bueno');
        const sem = C.semillas[0] + Math.floor(rng(s) * (C.semillas[1] - C.semillas[0] + 1)) + (mejora(s, 'semillasSelectas') ? 1 : 0);
        R.raciones += rac; R.semillas[p.cultivo] = (R.semillas[p.cultivo] || 0) + sem;
        s.stats.cosechas += 1; s.stats.raciones += rac; s.ultimaCosecha = p.cultivo;
        log(s, `${a.nombre} cosechó ${C.nombre.toLowerCase()}: +${rac} raciones y ${sem} semilla${sem > 1 ? 's' : ''}.`, 'bueno');
        recuerdo(s, a, 'Buena cosecha', 5, 10);
        for (const h of humanos(s)) { if (HAB(h).comida === p.cultivo) cumplirDeseo(s, h, 'cosecharFavorito'); if (s.stats.cosechas === 1) memoria(s, h, 'La primera cosecha', 1); }
        Object.assign(p, { ultimo: p.cultivo, cultivo: null, crec: 0, estado: 'vacia', secoMin: 0, salud: 100, plaga: 0, plagaTipo: null });
      }
      break;
    case 'limpiar': Object.assign(p, { ultimo: p.ultimo || p.cultivo, cultivo: null, crec: 0, estado: 'vacia', secoMin: 0, salud: 100, plaga: 0, plagaTipo: null }); break;
    case 'fumigar': if (p) { const tipo = p.plagaTipo; p.plaga = Math.max(0, p.plaga - 0.55); if (!p.plaga) p.plagaTipo = null; log(s, `${a.nombre} trató la parcela ${p.id + 1} con ${tipo === 'hongo' ? 'caldo de ceniza' : 'purín de ortiga'}.`, 'info'); } break;
    case 'arrancar': if (p) { p.estado = 'muerta'; p.ultimo = p.cultivo; p.plaga = 0; log(s, `${a.nombre} arrancó las plantas enfermas de la parcela ${p.id + 1} para que no contagien.`, 'aviso'); recuerdo(s, a, 'Tuvo que arrancar plantas enfermas', -4, 12); } break;
    case 'abonar': if (p && (R.compost || 0) >= 4) { R.compost -= 4; p.N = Math.min(100, p.N + 20); p.P = Math.min(100, p.P + 7); p.K = Math.min(100, p.K + 18); if ((R.ceniza || 0) >= 2 && p.ph < 6.3) { R.ceniza -= 2; p.ph = Math.min(7.2, p.ph + 0.35); } } break;
    case 'voltearCompost': s.ultimoVolteo = dia(s); recuerdo(s, a, 'Olor a tierra buena', 1, 4); break;
    case 'alimentar':
      if (R.raciones >= 1 && R.comedero < 2) { const c = Math.min(2 - R.comedero, R.raciones); R.raciones -= c; R.comedero += c; }
      if (R.cruda >= 1 && R.bebedero < 6) { const l = Math.min(6 - R.bebedero, R.cruda); R.cruda -= l; R.bebedero += l; }
      for (const m of s.agentes) if (m.vivo && m.tipo !== 'humano') vincular(s, m, a, 0.5);
      break;
    case 'ordenar': { const v = vaca(s); if (v) { const l = Math.round(v.ubre * (mejora(s, 'ordenoExperto') ? 12 : 10)) / 10; R.leche += l; s.stats.leche += l; v.ubre = 0; v.quieta = 0; log(s, `${a.nombre} ordeñó a ${v.nombre}: ${l.toFixed(1)} L de leche.`, 'bueno'); } break; }
    case 'recogerHuevos': { const n = Math.floor(R.nido); R.huevos += n; R.nido -= n; s.stats.huevos += n; if (n) log(s, `${a.nombre} recogió ${n} huevo${n > 1 ? 's' : ''} del gallinero.`, 'info'); break; }
    case 'esquilar': { const o = s.ganado.find((g) => g.id === T.oveja); if (o) { const l = Math.round(o.lana / 25) + (mejora(s, 'esquilaFina') ? 1 : 0); R.lana += l; s.stats.lana += l; o.lana = 0; o.quieta = 0; log(s, `${a.nombre} esquiló a ${o.nombre}: +${l} de lana.`, 'bueno'); } break; }
    case 'segar': { const h = Math.min(16, s.granja.pasto / 4); R.heno += h; s.granja.pasto -= h * 1.3 / AREA_PASTO; log(s, `${a.nombre} segó pasto: +${Math.round(h)} de heno para el invierno.`, 'info'); break; }
    case 'alimentarGanado':
      if (R.heno >= 1 && R.pesebre < 12) { const c = Math.min(12 - R.pesebre, R.heno); R.heno -= c; R.pesebre += c; }
      else if (R.heno < 1 && R.raciones > 30 + humanos(s).length * 28 && R.pesebre < 4) { R.raciones -= 4; R.pesebre += 8; log(s, `Se acabó el heno: ${a.nombre} les dio verduras de la despensa a los animales.`, 'aviso'); }
      if (R.cruda >= 5 && R.bebederoGanado < 50) { const l = Math.min(50 - R.bebederoGanado, R.cruda * 0.5); R.cruda -= l; R.bebederoGanado += l; }
      if (estacion(s) === 3 && R.raciones >= 1 && R.grano < 2) { R.raciones -= 1; R.grano += 2; }
      break;
    case 'tejer': if (R.lana >= 4) { R.lana -= 4; R.abrigos += 1; log(s, `${a.nombre} terminó de tejer un abrigo de lana. 🧶`, 'bueno'); recuerdo(s, a, 'Tejió un abrigo', 6, 24); cumplirDeseo(s, a, 'abrigo'); } break;
    case 'jugarGato': { recuerdo(s, a, 'Jugó con el gato', 5, 8); vincular(s, s.agentes.find((x) => x.tipo === 'gato'), a, 2); break; }
    case 'jugarPerro': {
      const p = s.agentes.find((x) => x.tipo === 'perro');
      recuerdo(s, a, `Jugó a la pelota con ${p?.nombre || 'el perro'}`, 3, 6); vincular(s, p, a, 3);
      if (rng(s) < 0.3) log(s, `${a.nombre} y ${p?.nombre} jugaron a la pelota. 🎾`, 'info');
      break;
    }
    case 'reparar': {
      const sube = 30 * mod(a, 'carpinteria') * (1 + 0.05 * nivel(a.xp.carpinteria));
      s.casa.estado = Math.min(100, (s.casa.estado ?? 100) + sube);
      log(s, `🔨 ${a.nombre} reparó la casa (${Math.round(s.casa.estado)} %).`, 'bueno'); recuerdo(s, a, 'Arregló la casa', 4, 12);
      break;
    }
    case 'construir': {
      const o = s.obras.find((x) => x.id === T.obra);
      if (o && o.progreso < 1) {
        o.progreso = Math.min(1, o.progreso + (DURACION.construir / 60) / o.horas * mod(a, 'carpinteria') * (1 + 0.05 * nivel(a.xp.carpinteria)));
        if (o.progreso >= 1) {
          const info = OBRAS.find((x) => x[0] === o.id);
          log(s, `🏗️ ${a.nombre} terminó ${o.nombre}: ${info[5]}.`, 'logro');
          for (const h of humanos(s)) recuerdo(s, h, `Terminamos ${o.nombre}`, 10, 48);
          memoria(s, a, `Construyó ${o.nombre}`, 1);
        }
      }
      break;
    }
    case 'esculpir': {
      s.avanceEscultura = (s.avanceEscultura || 0) + DURACION.esculpir / 60 / 18;   // unas 18 horas por escultura
      if (s.avanceEscultura >= 1 && (s.esculturas || 0) < ESCULTURAS.length) {
        s.avanceEscultura = 0; s.esculturas = (s.esculturas || 0) + 1;
        const nom = { buho: 'un búho', espiral: 'una espiral de piedra', figura: 'una figura que mira el horizonte', caballo: 'un caballo', pareja: `una pareja abrazada (los dos)`, gato: `${nombreDe(s, 'gato')} en piedra` }[ESCULTURAS[s.esculturas - 1].tipo];
        log(s, `🗿 ${a.nombre} terminó una escultura: ${nom}.`, 'logro');
        for (const h of humanos(s)) recuerdo(s, h, 'Una escultura nueva en la granja', 6, 24);
        if (ESCULTURAS[s.esculturas - 1].tipo === 'pareja') { const o = pareja(s, a); if (o) { recuerdo(s, o, `${a.nombre} esculpió a los dos`, 10, 48); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 4); } }
      }
      break;
    }
    case 'cuidarJardin': {
      const j = s.jardines[T.jardin];
      if (j) { j.cuidado = Math.min(1, j.cuidado + 0.35); recuerdo(s, a, 'Sus flores', 4, 8); }
      if (R.cruda >= 4) R.cruda -= 4;   // riega
      break;
    }
    case 'hacerConservas': {
      const n = Math.min(14, Math.floor(R.raciones * 0.15));
      const n2 = Math.min(n, Math.ceil((CAPACIDAD.conservas - (R.conservas || 0)) / 0.9));
      if (n2 >= 3) { const n = n2; R.raciones -= n; R.conservas = (R.conservas || 0) + Math.round(n * 0.9); log(s, `🫙 ${a.nombre} hizo ${Math.round(n * 0.9)} frascos de conservas.`, 'bueno'); }
      break;
    }
    case 'hacerQueso': {
      if (R.leche >= 6) { R.leche -= 6; R.queso = (R.queso || 0) + 2; log(s, `🧀 ${a.nombre} hizo queso con la leche de la semana.`, 'bueno'); recuerdo(s, a, 'Queso casero', 4, 12); }
      break;
    }
    case 'secar': {
      const n = Math.min(10, Math.floor(R.raciones * 0.12));
      const n3 = Math.min(n, Math.ceil((CAPACIDAD.secos - (R.secos || 0)) / 0.75));
      if (n3 >= 3) { const n = n3; R.raciones -= n; R.secos = (R.secos || 0) + Math.round(n * 0.75); log(s, `☀️ ${a.nombre} puso a secar ${n} raciones de fruta y verdura.`, 'info'); }
      break;
    }
    case 'recogerFruta': {
      const f = s.frutales[T.arbol];
      if (f && f.fruta >= 1) {
        const n = Math.floor(f.fruta), rac = Math.round(n * 0.55 * (1 + 0.03 * nivel(a.xp.huerto)));
        f.fruta -= n; R.raciones += rac; s.stats.raciones += rac;
        log(s, `${a.nombre} recogió ${n} ${FRUTA[f.tipo].nombre} (+${rac} raciones). ${f.tipo === 'manzano' ? '🍎' : '🍊'}`, 'bueno');
        recuerdo(s, a, `Fruta fresca del ${f.tipo}`, 3, 8);
      }
      break;
    }
    case 'curar': {
      const g = s.ganado.find((x) => x.id === T.animal && x.vivo);
      if (g && g.enfermo > 0) { g.enfermo = 0; g.salud = Math.min(100, g.salud + 25); log(s, `🩹 ${a.nombre} curó a ${g.nombre}.`, 'bueno'); recuerdo(s, a, `Curó a ${g.nombre}`, 4, 12); }
      break;
    }
    case 'recogerFlores': {
      const otro = pareja(s, a);
      a.ultimoRegalo = s.t;
      const jardin = [...(s.jardines || [])].sort((x, y) => y.flores - x.flores)[0];
      if (jardin && jardin.flores > 0.4) jardin.flores -= 0.1;   // las corta de su propio jardín
      if (otro) {
        s.stats.regalos = (s.stats.regalos || 0) + 1;
        recuerdo(s, otro, `${a.nombre} le regaló flores`, 9, 30); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 3);
        log(s, `💐 ${a.nombre} le regaló un ramo de flores del campo a ${otro.nombre}.`, 'bueno');
        efecto(s, 'corazones', otro.pos.x, otro.pos.z, { dentro: otro.dentro });
        cumplirDeseo(s, otro, 'regalo');
      }
      break;
    }
    case 'reconciliar': {
      const otro = pareja(s, a);
      if (!otro || s.pareja.paces === T.cita) break;
      s.pareja.paces = T.cita; s.pareja.pendiente = null;
      s.pareja.tension = Math.max(0, (s.pareja.tension || 0) - 30); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 4);
      s.stats.reconciliaciones = (s.stats.reconciliaciones || 0) + 1;
      const pide = [a, otro].sort((x, y) => (P5(y, 'amabilidad') - P5(y, 'neuroticismo') * 0.5) - (P5(x, 'amabilidad') - P5(x, 'neuroticismo') * 0.5))[0];
      const recibe = pide === a ? otro : a;
      log(s, `🤝 ${pide.nombre} le pidió perdón a ${recibe.nombre} e hicieron las paces.`, 'bueno');
      for (const x of [a, otro]) { x.recuerdos = x.recuerdos.filter((r) => r.texto !== 'Discutieron'); recuerdo(s, x, 'Hicieron las paces', 8, 12); }
      if (s.stats.reconciliaciones === 1) { memoria(s, a, 'Aprendieron a perdonarse', 1); memoria(s, otro, 'Aprendieron a perdonarse', 1); }
      efecto(s, 'corazones', (a.pos.x + otro.pos.x) / 2, (a.pos.z + otro.pos.z) / 2, { dentro: a.dentro });
      break;
    }
    case 'nadar': a.nadando = false; a.pos = { ...LUGAR.piscina }; recuerdo(s, a, 'Un buen chapuzón', 5, 8); break;
    case 'leer': case 'tallar': case 'contemplar': {
      recuerdo(s, a, { leer: 'Un buen libro', tallar: 'Talló algo bonito', contemplar: 'Un paisaje precioso' }[T.tipo], 4, 8);
      const otro = pareja(s, a);
      if (T.tipo === 'tallar' && tiene(a, 'manitas') && otro && rng(s) < 0.06) {
        const fig = ['un pajarito', 'una cuchara', 'un gatito', 'un corazón', 'un caballito'][Math.floor(rng(s) * 5)];
        recuerdo(s, otro, `${a.nombre} le regaló ${fig} tallado`, 7, 24); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 2); s.stats.regalos = (s.stats.regalos || 0) + 1;
        log(s, `🪵 ${a.nombre} le talló ${fig} de madera a ${otro.nombre}.`, 'bueno'); cumplirDeseo(s, otro, 'regalo');
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- encuentros
function encuentros(s) {
  const [a, b] = humanos(s);
  if (!a || !b) return;
  if (!a.dentro && !b.dentro && !a.nadando && !b.nadando && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.8 && s.t - Math.max(a.ultimoAbrazo, b.ultimoAbrazo) > 240
    && s.pareja.afinidad > 45 && !irritable(a) && !irritable(b) && despierto(s, a) && despierto(s, b) && !lloviendo(s)) {
    const ext = (P5(a, 'extraversion') + P5(b, 'extraversion')) / 2;
    if (rng(s) < 0.002 * (0.5 + ext) * (s.pareja.afinidad / 50) * ([a, b].some((x) => tiene(x, 'romantico')) ? 2 : 1) * (s.pareja.tension > 30 ? 0.3 : 1)) {
      a.ultimoAbrazo = b.ultimoAbrazo = s.t;
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1.5);
      recuerdo(s, a, 'Un abrazo', 4, 6); recuerdo(s, b, 'Un abrazo', 4, 6);
      a.abrazo = b.abrazo = s.t;
      efecto(s, 'corazones', (a.pos.x + b.pos.x) / 2, (a.pos.z + b.pos.z) / 2);
    }
  }
  if (a.nadando && b.nadando && rng(s) < 0.0015 && s.pareja.afinidad > 50) { efecto(s, 'corazones', a.pos.x, a.pos.z); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 0.5); }
  const h = hora(s);
  if (a.dentro && b.dentro && (h >= 21 || h < 1.5) && s.pareja.ultimaIntimidad !== dia(s)
    && [a, b].every((x) => x.n.energia > 35 && x.n.comida > 40 && x.n.agua > 40 && x.animo > 55 && x.tarea?.tipo === 'dormir')
    && s.pareja.afinidad > 60 && s.casa.limpieza > 40) {
    s.pareja.ultimaIntimidad = dia(s);
    const prob = 0.06 + (s.pareja.afinidad - 60) / 260 + (s.pareja.recetaNueva ? 0.05 : 0) + Math.min(0.1, (dia(s) - (s.pareja.diaIntimo ?? -99)) / 100) + ([a, b].some((x) => tiene(x, 'romantico')) ? 0.025 : 0) - (s.pareja.tension || 0) / 300;
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
      [a, b].forEach((x) => { recuerdo(s, x, 'Noche romántica', 14, 30); cumplirDeseo(s, x, 'nocheRomantica'); });
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 5); s.pareja.intimidad += 1;
    }
    efecto(s, 'corazones', 0.5, 0, { techo: true });
  }
}

// ---------------------------------------------------------------- mascotas (con caprichos y refugio)
function comportamientoAnimal(s, a, d) {
  const R = s.rec, n = a.n;
  const gato = a.tipo === 'gato', perro = a.tipo === 'perro';
  // con lluvia: el perro a su caseta, el gato a la casa
  if (lloviendo(s) && (!a.tarea || !['refugio', 'dormir', 'dormirCon'].includes(a.tarea.tipo))) {
    a.tarea = perro ? { tipo: 'refugio', fase: 'camino', destino: { x: LUGAR.caseta.x + 0.2, z: LUGAR.caseta.z }, trabajo: 0 }
      : { tipo: 'refugio', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 0, dentro: true };
  }
  if (!a.tarea) {
    const cocinando = humanos(s).find((h) => h.tarea?.tipo === 'cocinar' && h.tarea.fase === 'trabajo');
    if (n.agua < 45 && R.bebedero >= 0.5) a.tarea = { tipo: 'beber', fase: 'camino', destino: { x: LUGAR.comedero.x - 0.5, z: LUGAR.comedero.z + 0.4 }, trabajo: 3 };
    else if (n.comida < 45 && R.comedero >= 0.3) a.tarea = { tipo: 'comer', fase: 'camino', destino: { x: LUGAR.comedero.x + 0.3, z: LUGAR.comedero.z + 0.6 }, trabajo: 10 };
    else if (gato && cocinando && rng(s) < 0.02) a.tarea = { tipo: 'pedir', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 30, dentro: true };
    // juegan entre ellos: el perro persigue al gato (de día, si los dos están libres)
    else if (!esNoche(s) && n.energia > 30 && rng(s) < 0.05 && (() => { const o = s.agentes.find((x) => x !== a && x.vivo && x.tipo !== 'humano'); return o && (!o.tarea || ['siesta', 'seguir', 'explorar'].includes(o.tarea.tipo)) && !o.dentro && !a.dentro; })()) {
      const o = s.agentes.find((x) => x !== a && x.vivo && x.tipo !== 'humano');
      const lugar = { x: 8 + (rng(s) - 0.5) * 14, z: 22 + (rng(s) - 0.5) * 8 };
      a.tarea = { tipo: 'jugarJuntos', fase: 'camino', destino: { ...lugar }, trabajo: 15 + rng(s) * 20, centro: lugar, con: o.id };
      o.tarea = { tipo: 'jugarJuntos', fase: 'camino', destino: { x: lugar.x + 1.5, z: lugar.z }, trabajo: a.tarea.trabajo, centro: lugar, con: a.id };
      if (rng(s) < 0.25) log(s, `${a.nombre} y ${o.nombre} jugaron a perseguirse por el jardín.`, 'info');
    }
    // el perro sale a pasear solo; el gato explora el terreno
    else if (!esNoche(s) && n.energia > 30 && rng(s) < 0.12 && !humanos(s).some((h) => h.tarea?.tipo === 'pasearPerro')) {
      a.tarea = { tipo: 'explorar', fase: 'camino', destino: perro ? { ...PASEO[1 + Math.floor(rng(s) * (PASEO.length - 1))] } : { x: BLOQUE.x0 + 4 + rng(s) * (BLOQUE.x1 - BLOQUE.x0 - 8), z: BLOQUE.z0 + 4 + rng(s) * (BLOQUE.z1 - BLOQUE.z0 - 8) }, trabajo: 15 };
    }
    // juguetón: trae la pelota a alguien que esté descansando afuera
    else if (perro && tiene(a, 'jugueton') && n.diversion < 65 && !esNoche(s) && rng(s) < 0.3
      && humanos(s).some((h) => !h.dentro && !h.nadando && h.tarea && OCIOS.includes(h.tarea.tipo) && h.tarea.fase === 'trabajo')) {
      const h = humanos(s).filter((x) => !x.dentro && !x.nadando && x.tarea && OCIOS.includes(x.tarea.tipo) && x.tarea.fase === 'trabajo')
        .sort((x, y) => (a.vinculo?.[y.id] ?? 50) - (a.vinculo?.[x.id] ?? 50))[0];
      a.tarea = { tipo: 'pelota', fase: 'camino', destino: { x: h.pos.x + 1.1, z: h.pos.z + 0.6 }, trabajo: 1, con: h.id };
    }
    // mimoso: se sube al regazo de quien lee, teje o descansa
    else if (gato && tiene(a, 'mimoso') && rng(s) < 0.25 && humanos(s).some((h) => h.tarea && ['leer', 'tejer', 'descansar'].includes(h.tarea.tipo) && h.tarea.fase === 'trabajo')) {
      const h = humanos(s).filter((x) => x.tarea && ['leer', 'tejer', 'descansar'].includes(x.tarea.tipo) && x.tarea.fase === 'trabajo')
        .sort((x, y) => (a.vinculo?.[y.id] ?? 50) - (a.vinculo?.[x.id] ?? 50))[0];
      a.tarea = { tipo: 'regazo', fase: 'camino', destino: { x: h.pos.x + 0.2, z: h.pos.z + 0.3 }, trabajo: 45, con: h.id, dentro: h.dentro };
    }
    else if (n.comida < 45 && tiene(a, 'cazador')) {
      const p = s.parcelas[Math.floor(rng(s) * s.parcelas.length)];
      a.tarea = { tipo: 'cazar', fase: 'camino', destino: { x: p.x + (rng(s) - 0.5) * 3, z: p.z + 1.2 }, trabajo: 60, parcelaCaza: p.id };
    } else if ((esNoche(s) && n.energia < 90) || n.energia < 20) {
      const triste = gato ? humanos(s).filter((h) => h.dentro && h.tarea?.tipo === 'dormir').sort((x, y) => (x.animo - (a.vinculo?.[x.id] ?? 50) * 0.2) - (y.animo - (a.vinculo?.[y.id] ?? 50) * 0.2))[0] : null;
      if (triste && triste.animo < (tiene(a, 'mimoso') ? 75 : 60)) a.tarea = { tipo: 'dormirCon', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 0, dentro: true, con: triste.id };
      else if (perro && estacion(s) === 1 && !esNoche(s)) a.tarea = { tipo: 'dormir', fase: 'camino', destino: { ...LUGAR.caseta }, trabajo: 0 };   // la siesta de verano, en la caseta
      else a.tarea = { tipo: 'dormir', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 0, dentro: true };   // de noche, adentro con su gente
    } else if (perro && tiene(a, 'leal')) {
      const paseador = humanos(s).find((h) => h.tarea?.tipo === 'pasearPerro');
      const afuera = humanos(s).filter((x) => !x.dentro && !x.nadando);
      const fav = favorito(s, a);
      const amo = paseador || (fav && afuera.includes(fav) && rng(s) < 0.7 ? fav : afuera.sort((x, y) => Math.hypot(x.pos.x - a.pos.x, x.pos.z - a.pos.z) - Math.hypot(y.pos.x - a.pos.x, y.pos.z - a.pos.z))[0]);
      const dd = amo ? { x: amo.pos.x + (paseador ? 0.9 : 1.4), z: amo.pos.z + (paseador ? 0.6 : 1.0) } : { x: LUGAR.puerta.x + 1.2, z: LUGAR.puerta.z + 1.5 };
      a.tarea = { tipo: paseador ? 'pasear' : 'seguir', fase: 'camino', destino: dd, trabajo: paseador ? 1 : 10 };
    } else {
      a.tarea = { tipo: 'siesta', fase: 'camino', destino: { x: LUGAR.banca.x + (rng(s) - 0.5) * 2, z: LUGAR.banca.z - 0.05 }, trabajo: 30 + rng(s) * 40 };
    }
  }
  const T = a.tarea;
  a.accion = ACCION[T.tipo] || T.tipo;
  if (T.tipo === 'jugar') {
    const h = s.agentes.find((x) => x.id === T.con);
    if (!h || !['jugarGato', 'jugarPerro'].includes(h.tarea?.tipo)) { a.tarea = null; return; }
    a.n.diversion = Math.min(100, a.n.diversion + d);
    return;
  }
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (mover(a, T.destino, d)) { T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  if (T.tipo === 'jugarJuntos') {
    // se persiguen dando vueltas alrededor de un punto
    const ang = s.t * 0.35 + (a.tipo === 'perro' ? 0 : 0.9);
    const r = 2.2 + Math.sin(s.t * 0.13) * 0.8;
    mover(a, { x: T.centro.x + Math.cos(ang) * r, z: T.centro.z + Math.sin(ang) * r }, d * 1.4);
    n.diversion = Math.min(100, n.diversion + 0.8 * d); n.energia = Math.max(0, n.energia - 0.04 * d);
    T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null;
    return;
  }
  if (T.tipo === 'explorar') { n.diversion = Math.min(100, n.diversion + 0.5 * d); T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null; return; }
  if (T.tipo === 'pelota') {
    const h = s.agentes.find((x) => x.id === T.con);
    if (h && h.vivo && h.tarea && OCIOS.includes(h.tarea.tipo) && !h.nadando && !h.dentro) { soltarTarea(s, h); crearTarea(s, h, 'jugarPerro'); h.tarea.fase = 'trabajo'; }
    else n.diversion = Math.min(100, n.diversion + 10);   // nadie le hizo caso: juega solo
    a.tarea = null; return;
  }
  if (T.tipo === 'regazo') {
    const h = s.agentes.find((x) => x.id === T.con);
    if (!h || !h.tarea || !['leer', 'tejer', 'descansar'].includes(h.tarea.tipo)) { a.tarea = null; if (a.dentro && !h?.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; } return; }
    a.pos.x = h.pos.x + 0.15; a.pos.z = h.pos.z + 0.25; a.dentro = h.dentro;
    if (!T.calmo) { T.calmo = true; recuerdo(s, h, `${a.nombre} en el regazo`, 3, 6); vincular(s, a, h, 1); }
    n.diversion = Math.min(100, n.diversion + 0.4 * d); n.energia = Math.min(100, n.energia + 0.1 * d);
    T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null;
    return;
  }
  if (T.tipo === 'refugio') {
    if (!lloviendo(s)) { a.tarea = null; if (a.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; } }
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
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE));
    if (!(s && s.version === VERSION && s.config === CONFIG)) return null;
    // los nombres salen siempre de las fichas: cambiarlos no reinicia la partida
    for (const a of s.agentes) {
      const p = PERSONAJES.find((x) => x.id === a.id);
      if (p) { a.nombre = p.nombre; a.rasgos = [...p.rasgos]; }   // nombres y rasgos salen siempre de las fichas
      a.memorias ??= []; a.xp.carpinteria ??= 0;
      if (a.tipo !== 'humano') a.vinculo ??= Object.fromEntries(PERSONAJES.filter((h) => h.tipo === 'humano').map((h) => [h.id, Math.round((h.habitos?.animales?.[a.id] ?? 0.5) * 100)]));
    }
    for (let i = s.parcelas.length; i < PARCELAS.length; i++) s.parcelas.push({ id: i, x: PARCELAS[i].x, z: PARCELAS[i].z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null });
    for (const p of s.parcelas) for (const [k, v] of Object.entries(sueloNuevo())) p[k] ??= v;
    for (const [id, nombre, horas] of OBRAS) if (!s.obras?.some((o) => o.id === id)) (s.obras ||= []).splice(OBRAS.findIndex((o) => o[0] === id), 0, { id, nombre, horas, progreso: 0 });
    s.frutales ??= FRUTALES.map((f, i) => ({ id: i, ...f, fruta: 0 }));
    s.jardines ??= JARDINES.map((j, i) => ({ id: i, x: j.x, z: j.z, flor: j.flor, cuidado: 0.3, flores: 0 }));
    s.obras ??= OBRAS.map(([id, nombre, horas]) => ({ id, nombre, horas, progreso: 0 })); s.esculturas ??= 0; s.avanceEscultura ??= 0; s.belleza ??= 10;
    s.casa.estado ??= 100; s.desbloqueos ??= []; s.pareja.tension ??= 0; s.pareja.pendiente ??= null;
    for (const g of s.ganado) g.enfermo ??= 0;
    return s;
  } catch { return null; }
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
