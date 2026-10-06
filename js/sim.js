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
export const VERSION = 4;   // (los campos nuevos se migran en cargar)

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
  lagar: { x: 25, z: 26.6 },
  carreta: { x: 35, z: 14 },
};
// viñedo (uvas a fin de verano y en otoño) y la huerta de hierbas con dos matas de marihuana
// (son cultivos de renta: lo que no se toma o se fuma se le vende al comerciante)
export const PARRAS = [{ x: 21, z: 30.5 }, { x: 24.5, z: 30.5 }, { x: 28, z: 30.5 }, { x: 31.5, z: 30.5 }, { x: 21, z: 33.6 }, { x: 24.5, z: 33.6 }, { x: 28, z: 33.6 }, { x: 31.5, z: 33.6 },
  { x: 17.5, z: 30.5 }, { x: 17.5, z: 33.6 }, { x: 14, z: 30.5 }, { x: 14, z: 33.6 }];   // las 4 últimas, con el proyecto del viñedo
const PARRAS_BASE = 8;
export const LUGAR_GYM = { x: 11.5, z: 23 };
// caminos que Andrés va empedrando, primero por donde más se camina (sobre un camino terminado se anda más rápido)
export const CAMINOS = [
  { id: 'pozo', nombre: 'el camino al pozo', pts: [{ x: -2.6, z: 8.6 }, { x: -5.4, z: 10.3 }] },
  { id: 'corral', nombre: 'el camino al corral', pts: [{ x: -3.0, z: 8.3 }, { x: -8.7, z: 8.5 }] },
  { id: 'taller', nombre: 'el camino al taller y la piscina', pts: [{ x: -1.4, z: 8.4 }, { x: 4.2, z: 9.6 }, { x: 7.4, z: 9.9 }, { x: 10.0, z: 10.6 }, { x: 12.2, z: 11.4 }] },   // (rodea el tanque)
  { id: 'gallinero', nombre: 'el camino al gallinero', pts: [{ x: 12.2, z: 11.4 }, { x: 13.3, z: 7.6 }, { x: 13.3, z: -4.8 }] },
  { id: 'vinedo', nombre: 'el camino al viñedo', pts: [{ x: 12.2, z: 11.4 }, { x: 13.0, z: 18.4 }, { x: 17.5, z: 22.5 }, { x: 20.0, z: 28.6 }] },
  { id: 'carreta', nombre: 'el camino de la carreta', pts: [{ x: 13.0, z: 18.4 }, { x: 22.5, z: 18.6 }, { x: 33.2, z: 14.6 }] },
  { id: 'mirador', nombre: 'el sendero al mirador', pts: [{ x: -3.2, z: 22.6 }, { x: -8.4, z: 23.4 }, { x: -12.6, z: 23.9 }] },
];
export const largoCamino = (c) => c.pts.reduce((t, p, i) => t + (i ? Math.hypot(p.x - c.pts[i - 1].x, p.z - c.pts[i - 1].z) : 0), 0);
export function puntoCamino(c, f) {   // punto a la fracción f del recorrido
  let resto = largoCamino(c) * Math.max(0, Math.min(1, f));
  for (let i = 1; i < c.pts.length; i++) { const a = c.pts[i - 1], b = c.pts[i], l = Math.hypot(b.x - a.x, b.z - a.z); if (resto <= l) { const u = l ? resto / l : 0; return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }; } resto -= l; }
  return { ...c.pts.at(-1) };
}
const distTramo = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; const u = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0; return Math.hypot(p.x - a.x - dx * u, p.z - a.z - dz * u); };
const distCamino = (p, c) => { let m = 1e9; for (let i = 1; i < c.pts.length; i++) m = Math.min(m, distTramo(p, c.pts[i - 1], c.pts[i])); return m; };
let caminosHechos = [], sCaminos = null;
function refrescarCaminos(s) { sCaminos = s; caminosHechos = CAMINOS.filter((c) => (s.caminos?.[c.id]?.progreso || 0) >= 1); }
const caminosNuevos = () => Object.fromEntries(CAMINOS.map((c) => [c.id, { progreso: 0, uso: 0 }]));
function caminoPendiente(s) {
  const C = s.caminos || {};
  return CAMINOS.find((c) => C[c.id] && C[c.id].progreso > 0 && C[c.id].progreso < 1)
    || CAMINOS.filter((c) => C[c.id] && C[c.id].progreso < 1).sort((x, y) => C[y.id].uso - C[x.id].uso)[0];
}
// cada 10 minutos: por dónde caminan (los caminos más pisados se empiedran primero)
function pisadas(s) {
  for (const a of s.agentes) {
    if (!a.vivo || a.dentro || (a.tipo !== 'humano' && a.tipo !== 'nino') || !a.tarea || a.tarea.fase !== 'camino') continue;
    for (const c of CAMINOS) { const C = s.caminos[c.id]; if (C && C.progreso < 1 && distCamino(a.pos, c) < 1.8) C.uso += 1; }
  }
}
export const MATAS = [{ x: 33.6, z: 24.5 }, { x: 36, z: 24.5 }, { x: 33.6, z: 27.3 }, { x: 36, z: 27.3 }, { x: 33.6, z: 30.1 }, { x: 36, z: 30.1 }];
// el comerciante: lo que paga (o cobra) por cada cosa, en monedas, y cómo cambia con la estación [prim, ver, oto, inv]
export const MERCADO = {
  raciones: { nombre: 'raciones', base: 1, est: [1.1, 1, 0.7, 1.4] },
  conservas: { nombre: 'conservas', base: 3, est: [1, 0.9, 0.9, 1.3] },
  queso: { nombre: 'quesos', base: 6, est: [1, 1, 1, 1.15] },
  secos: { nombre: 'secos', base: 2, est: [1, 1, 0.9, 1.3] },
  huevos: { nombre: 'huevos', base: 0.5, est: [0.9, 1, 1, 1.3] },
  lana: { nombre: 'lana', base: 4, est: [0.8, 0.7, 1.2, 1.6] },
  abrigos: { nombre: 'abrigos', base: 18, est: [0.8, 0.6, 1.3, 1.7] },
  vino: { nombre: 'botellas de vino', base: 10, est: [1, 1.1, 0.85, 1.35] },
  hierba: { nombre: 'porciones de hierba', base: 9, est: [1.25, 1.2, 0.75, 1.1] },
};
export const TIENDA = {
  semilla: 2, medicina: 10, libro: 6, vaca: 45, oveja: 22, gallina: 6, gallo: 8,
  azada: 25, sierra: 25, cubo: 25, tijeras: 25, regalo: 14, materiales: 22, golosinas: 4, juguete: 8,
};
// la casa se construye y moderniza de a poco con los ahorros: primero se elige el estilo (dilema), luego cada mejora
export const ESTILOS = {
  mediterranea: { nombre: 'Mediterránea', pista: 'blanca, techos planos y terrazas' },
  nordica: { nombre: 'Nórdica', pista: 'madera oscura, tejado a dos aguas, ventanales' },
  tropical: { nombre: 'Tropical', pista: 'madera y concreto, aleros grandes, plantas' },
  asiatica: { nombre: 'Villa asiática', pista: 'madera rojiza, techos con aleros curvos, bambú' },
  americana: { nombre: 'Granja americana', pista: 'tablas blancas, porche, granero rojo' },
};
// [id, nombre, costo en monedas, horas de obra, efecto, requisitos]
export const MEJORAS_CASA = [
  // la casa
  ['fachada', 'la fachada nueva', 120, 40, 'toda la granja estrena el estilo elegido', []],
  ['techo', 'el techo nuevo con aislamiento', 160, 50, 'la casa se desgasta menos y abriga en invierno', ['fachada']],
  ['cocina', 'una cocina moderna', 250, 45, 'cocinan más rápido, las cenas alegran más y se puede hornear', ['fachada']],
  ['bano', 'un baño con agua caliente', 220, 40, 'un baño caliente cada día sube el ánimo', ['fachada']],
  ['terraza', 'la terraza alta', 260, 55, 'charlas al aire libre con menos peleas', ['fachada']],
  ['ventanales', 'ventanales de piso a techo', 300, 50, 'más luz y belleza', ['fachada']],
  ['ampliacion', 'un estudio bajo la terraza', 420, 80, 'un lugar para leer, tejer y tallar a gusto', ['fachada']],
  ['solar', 'paneles solares y cisterna', 600, 60, 'más agua de lluvia y filtrado rápido', ['techo']],
  ['azotea', 'la azotea con pérgola', 800, 85, 'el remate de la casa: belleza y ánimo', ['techo', 'terraza']],
  // el estilo de vida
  ['piscina', 'la piscina renovada con deck', 500, 55, 'nadar alegra más y embellece', ['fachada']],
  ['jacuzzi', 'un jacuzzi caliente', 450, 35, 'un baño caliente al aire libre, incluso en invierno', ['piscina']],
  ['gimnasio', 'un gimnasio al aire libre', 280, 35, 'entrenar rinde y alegra más', []],
  // los cultivos de renta
  ['vinedo', 'cuatro parras nuevas', 300, 40, 'el viñedo crece a 12 parras', []],
  ['bodegaVino', 'una bodega de vino', 450, 50, 'más vino por canasto y se vende más caro', ['vinedo']],
  ['cultivoCaseta', 'una caseta de cultivo', 350, 45, 'la hierba crece todo el año', []],
  ['cultivoPro', 'luces y riego en la caseta', 500, 40, 'cosechas más grandes y un curado más rápido', ['cultivoCaseta']],
  // la granja
  ['establo2', 'un establo más grande', 550, 70, 'caben 6 animales más en el potrero', []],
  ['gallinero2', 'un gallinero más grande', 380, 45, 'caben 8 aves más', []],
];
const DE_CASA = ['fachada', 'techo', 'cocina', 'bano', 'terraza', 'ventanales', 'ampliacion', 'solar', 'azotea', 'piscina'];
export const etapaCasa = (s) => { const n = (s.casa.mejoras || []).filter((m) => DE_CASA.includes(m)).length; return n >= 8 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1; };
const casaTiene = (s, id) => (s.casa.mejoras || []).includes(id);
const PREFIERE = {
  tomas: ['techo', 'gimnasio', 'vinedo', 'cultivoCaseta', 'ampliacion', 'establo2', 'solar', 'terraza', 'bodegaVino', 'cultivoPro', 'azotea', 'ventanales', 'cocina', 'bano', 'gallinero2', 'piscina', 'jacuzzi'],
  lucia: ['cocina', 'ventanales', 'bano', 'terraza', 'vinedo', 'piscina', 'gallinero2', 'bodegaVino', 'jacuzzi', 'techo', 'ampliacion', 'gimnasio', 'cultivoCaseta', 'establo2', 'solar', 'cultivoPro', 'azotea'],
};
// la granja se adapta a lo construido
function aplicarProyectos(s) {
  CUPO.corral = 18 + (casaTiene(s, 'establo2') ? 6 : 0);
  CUPO.gallinero = 24 + (casaTiene(s, 'gallinero2') ? 8 : 0);
}
// lujos que se compran ahorrando (una vez cada uno): embellecen la casa y quedan en la memoria
export const LUJOS = [['vajilla', 'una vajilla bonita', 60], ['bicicleta', 'una bicicleta', 90], ['estufa', 'una estufa de hierro', 130], ['tocadiscos', 'un tocadiscos con discos', 180], ['telescopio', 'un telescopio', 240]];
// lo máximo que el comerciante se lleva de cada cosa por visita (su carreta tiene límite)
const TOPE = { raciones: 30, conservas: 10, queso: 4, secos: 10, huevos: 24, lana: 8, abrigos: 2, vino: 14, hierba: 10 };
// herramientas que trae el comerciante: cada una acelera un oficio un 12 %
export const HERRAMIENTAS = { azada: ['huerto', 'una azada de acero'], cubo: ['agua', 'baldes reforzados'], sierra: ['carpinteria', 'una sierra buena'], tijeras: ['granja', 'tijeras de esquilar'] };
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
const XP_OCIO = { tallar: 'carpinteria', jugarGato: 'cuidado', jugarPerro: 'cuidado', recogerFlores: 'huerto', hornear: 'casa' };
const CAPACIDAD = { conservas: 60, queso: 16, secos: 40 };   // lo que cabe en la despensa
const obra = (s, id) => (s.obras || []).find((o) => o.id === id && o.progreso >= 1);
const AREA = {
  sembrar: 'huerto', regar: 'huerto', cosechar: 'huerto', limpiar: 'huerto', sacarAgua: 'agua', filtrar: 'agua', alimentar: 'cuidado',
  cocinar: 'casa', limpiarCasa: 'casa', tejer: 'casa', ordenar: 'granja', recogerHuevos: 'granja', esquilar: 'granja', segar: 'granja', alimentarGanado: 'granja',
  reparar: 'carpinteria', curar: 'cuidado', recogerFruta: 'huerto',
  cepillar: 'cuidado', fumigar: 'huerto', arrancar: 'huerto', abonar: 'huerto', voltearCompost: 'granja',
  construir: 'carpinteria', empedrar: 'carpinteria', esculpir: 'carpinteria', cuidarJardin: 'huerto', hacerConservas: 'casa', hacerQueso: 'granja', secar: 'casa',
  vendimia: 'huerto', pisarUva: 'casa', cosecharHierba: 'huerto', renovar: 'carpinteria',
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
export const esMascota = (a) => a.tipo === 'perro' || a.tipo === 'gato';
export const esHijo = (a) => a.tipo === 'nino';
const hijos = (s) => s.agentes.filter((x) => x.tipo === 'nino' && x.vivo);

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
  let v = valor < 0 ? valor * (0.6 + P5(a, 'neuroticismo') * 0.9) * (tiene(a, 'tranquilo') ? 0.8 : 1) : valor;
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
  if (a.recuerdos.some((r) => r.hasta <= s.t)) a.recuerdos = a.recuerdos.filter((r) => r.hasta > s.t);
  const casa = s.casa.limpieza < 30 ? -6 : s.casa.limpieza > 75 ? 3 : 0;
  const sinAbrigo = frio(s) && s.rec.abrigos < humanos(s).length ? -5 : 0;
  const deterioro = s.casa.estado < 25 ? -8 : s.casa.estado < 50 ? -4 : 0;
  const huellas = Math.max(-8, Math.min(2, (a.memorias || []).reduce((t, m) => t + m.valor, 0)));
  const tension = -(s.pareja.tension || 0) / 12, belleza = (s.belleza || 0) / 22;
  const expectativas = -Math.min(12, 3 + etapaCasa(s) * 2 + (s.comercio?.lujos?.length || 0) + (s.comercio?.monedas || 0) / 400);   // como en RimWorld: la prosperidad sube la vara
  const hogar = (casaTiene(s, 'bano') ? 1 : 0) + (casaTiene(s, 'azotea') ? 1 : 0) + (casaTiene(s, 'techo') && frio(s) ? 1 : 0);   // vivir en un lugar bonito alegra
  a.animo = Math.max(0, Math.min(100, base + a.recuerdos.reduce((t, r) => t + r.valor, 0) + casa + sinAbrigo + deterioro + huellas + tension + belleza + hogar + expectativas));
}
export const caraAnimo = (v) => (v >= 80 ? '😄' : v >= 62 ? '🙂' : v >= 45 ? '😐' : v >= 28 ? '😟' : '😢');
const irritable = (a) => a.n.comida < 20 || a.n.energia < 20 || a.animo < (tiene(a, 'malgenio') ? 42 : 30);

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

// ---------------------------------------------------------------- familia: embarazo, parto e hijos que crecen
// etapas por días de vida (el tiempo de la granja va rápido): bebé, niño, joven y adulto
export const ETAPAS = [['bebe', 0, 'Bebé'], ['nino', 14, 'Niño'], ['joven', 56, 'Joven'], ['adulto', 140, 'Adulto']];
export const ETAPA_NOMBRE = Object.fromEntries(ETAPAS.map(([k, , n]) => [k, n]));
export function etapaDe(s, a) { const dd = (s.t - (a.nacio ?? s.t)) / MIN_DIA; let e = 'bebe'; for (const [k, desde] of ETAPAS) if (dd >= desde) e = k; return e; }
export const diasDeVida = (s, a) => Math.floor((s.t - (a.nacio ?? s.t)) / MIN_DIA);
const familiaNueva = () => ({ plan: null, planHasta: 0, embarazo: null, parto: null, nacidos: 0, preguntado: -99 });
const NOMBRES_HIJO = { h: ['Mateo', 'Simón', 'Emilio', 'Joaquín', 'Martín', 'Gabriel', 'Tadeo'], m: ['Valentina', 'Sofía', 'Isabella', 'Emma', 'Julieta', 'Antonia', 'Paz'] };
const SUENO_HIJO = { nino: [20, 7.5], joven: [21.5, 7], adulto: [22.5, 6.5] };
const madreDe = (s) => s.agentes.find((x) => x.id === 'lucia' && x.vivo && x.tipo === 'humano');
const padreDe = (s) => s.agentes.find((x) => x.id === 'tomas' && x.vivo && x.tipo === 'humano');
const bebes = (s) => hijos(s).filter((k) => etapaDe(s, k) === 'bebe');
const bebeQueNecesita = (s) => bebes(s).find((b) => b.n.comida < 60 || b.n.agua < 60 || b.n.social < 40);
const bebeLlora = (s) => bebes(s).find((b) => b.n.comida < 40 || b.n.agua < 40 || b.n.social < 28);
const turnoNoche = (s) => { const H = humanos(s); return H.length > 1 ? H[dia(s) % 2] : H[0]; };

function nuevoHijo(s, sexo, nombre, padres) {
  const pool = [...new Set(padres.filter(Boolean).flatMap((p) => p.rasgos))].filter((r) => RASGOS[r]);
  const rasgos = [];
  while (rasgos.length < Math.min(3, pool.length)) { const r = pool[Math.floor(rng(s) * pool.length)]; if (!rasgos.includes(r)) rasgos.push(r); }
  s.sigHijo = (s.sigHijo || 0) + 1;
  return {
    id: 'hijo' + s.sigHijo, tipo: 'nino', sexo, nombre, nacio: s.t, etapa: 'bebe', padres: padres.filter(Boolean).map((p) => p.id), rasgos, vivo: true,
    pos: { ...LUGAR.puerta }, dentro: true, n: { comida: 80, agua: 80, energia: 80, salud: 100, social: 75, diversion: 70 },
    animo: 80, recuerdos: [], memorias: [], deseo: null, xp: { huerto: 0, agua: 0, cuidado: 0, casa: 0, granja: 0, carpinteria: 0 },
    tarea: null, accion: 'Durmiendo en la cuna', murio: null, causa: null, nadando: false, edad: 0, enfermo: 0, animo_buff: 0, ultimoAbrazo: 0, abrazo: 0, heridas: [],
  };
}
// la pareja habla de agrandar la familia (cada tanto, si están bien)
function familiaDelDia(s) {
  const F = (s.familia ||= familiaNueva()), M = madreDe(s), P = padreDe(s), K = hijos(s);
  if (K.length) for (const h of humanos(s)) recuerdo(s, h, `Ver crecer a ${K.map((k) => k.nombre).join(' y ')}`, 5, 24);
  if (F.embarazo) {
    const faltan = Math.ceil((F.embarazo.fin - s.t) / MIN_DIA);
    if (faltan <= 2 && !F.embarazo.preguntado && M) {
      const mon = Math.floor(s.comercio?.monedas || 0);
      if (proponer(s, 'parto', `${M.nombre} está por dar a luz`, `Faltan unos ${faltan} días. Un parto en casa es gratis, pero si se complica no hay a quién llamar. La partera del pueblo cobra 80 monedas (hay ${mon}).`, [
        { k: 'partera', txt: 'Llamar a la partera', pista: mon >= 80 ? '80 monedas; parto seguro' : `no alcanza (hay ${mon} de 80)` },
        { k: 'casa', txt: 'Parto en casa', pista: 'gratis; puede complicarse' },
      ], 'casa', {}, 30, 30)) F.embarazo.preguntado = true;
    }
    return;
  }
  if (!M || !P || F.nacidos >= 3 || M.edad > 44) return;
  if (F.plan === 'buscar' || F.plan === 'azar' || (F.plan === 'esperar' && dia(s) < F.planHasta)) return;
  if (dia(s) - F.preguntado < 18 || diasVividos(s) < 5 || s.pareja.afinidad < 60 || (s.pareja.tension || 0) > 40) return;
  F.preguntado = dia(s);
  proponer(s, 'hijo', K.length ? '¿Otro bebé?' : '¿Agrandar la familia?',
    `${P.nombre} y ${M.nombre} están bien juntos (afinidad ${Math.round(s.pareja.afinidad)}) y hablan de ${K.length ? `darle un hermano a ${K[0].nombre}` : 'tener un bebé'}. Un bebé trae mucha alegría, pero hay que cuidarlo de día y de noche y gasta comida y agua${etapaCasa(s) < 2 ? '; además la casa todavía es chica' : ''}.`, [
      { k: 'buscar', txt: 'Sí, buscar un bebé', pista: 'lo más probable es que llegue en unas semanas' },
      { k: 'esperar', txt: 'Todavía no', pista: 'lo vuelven a hablar en un mes' },
      { k: 'azar', txt: 'Que la vida decida', pista: 'puede pasar… o no' },
    ], 'azar', {}, 24, 18);
}
// después de una noche juntos
function concebir(s) {
  const F = s.familia, M = madreDe(s);
  if (!F || F.embarazo || !M || !padreDe(s) || F.nacidos >= 3 || M.edad > 44 || s.t - (F.ultimoParto ?? -1e9) < 25 * MIN_DIA) return;   // después de un parto, un tiempo sin embarazos
  const p = F.plan === 'buscar' ? 0.4 : F.plan === 'azar' ? 0.07 : F.plan === 'esperar' ? 0.01 : 0.008;
  if (rng(s) >= p) return;
  F.embarazo = { inicio: s.t, fin: s.t + 21 * MIN_DIA, preguntado: false };
  M.embarazada = true;
  log(s, `🤰 ¡${M.nombre} está embarazada! El bebé llegará en unas tres semanas.`, 'logro');
  for (const h of humanos(s)) recuerdo(s, h, 'Vamos a tener un bebé', 18, 24 * 5);
}
function familiaTick(s) {
  const F = s.familia; if (!F?.embarazo) return;
  const M = madreDe(s);
  if (!M) { F.embarazo = null; return; }
  M.embarazada = true;
  if (s.t >= F.embarazo.fin) nacimiento(s);
}
function nacimiento(s) {
  const F = s.familia, M = madreDe(s), P = padreDe(s);
  const sexo = rng(s) < 0.5 ? 'h' : 'm';
  const libres = NOMBRES_HIJO[sexo].filter((n) => !s.agentes.some((x) => x.nombre === n));
  const nombre = libres[Math.floor(rng(s) * libres.length)] || (sexo === 'h' ? 'Nico' : 'Nina');
  const seguro = F.parto === 'partera', complica = rng(s) < (seguro ? 0.03 : 0.18);
  const b = nuevoHijo(s, sexo, nombre, [P, M]);
  if (complica) b.n.salud = 45;
  s.agentes.push(b);
  F.nacidos += 1; F.embarazo = null; F.parto = null; F.plan = null; F.preguntado = dia(s) + 30; F.ultimoParto = s.t; M.embarazada = false;   // no vuelven a hablarlo hasta que el bebé crezca un poco
  s.stats.bebes = (s.stats.bebes || 0) + 1;
  log(s, `👶 ¡Nació ${nombre}! ${sexo === 'h' ? 'Un niño' : 'Una niña'}${complica ? ', pero el parto se complicó' : ` san${sexo === 'h' ? 'o' : 'a'}`}${seguro ? ' (con la partera)' : ''}. Heredó de sus padres: ${b.rasgos.map((r) => RASGOS[r]?.nombre || r).join(', ').toLowerCase()}.`, 'logro');
  if (complica) herir(s, M, 'parto', seguro ? 0.3 : 0.62, 'cuerpo', '');
  for (const h of humanos(s)) recuerdo(s, h, `Nació ${nombre}`, 30, 24 * 7);
  efecto(s, 'corazones', LUGAR.puerta.x, LUGAR.puerta.z);
  const otros = libres.filter((n) => n !== nombre).sort(() => rng(s) - 0.5).slice(0, 2);
  proponer(s, 'nombre', '¿Cómo se llamará?', `${P ? P.nombre + ' y ' : ''}${M.nombre} dudan entre tres nombres para ${sexo === 'h' ? 'el niño' : 'la niña'}. Por ahora le dicen ${nombre}.`,
    [nombre, ...otros].map((n) => ({ k: n, txt: n, pista: n === nombre ? 'como le dicen ahora' : '' })), nombre, { hijo: b.id }, 12, 0);
}
// un hijo grande hereda la granja si ya no quedan adultos
function heredar(s) {
  const h = hijos(s).filter((k) => ['joven', 'adulto'].includes(etapaDe(s, k))).sort((x, y) => x.nacio - y.nacio)[0];
  if (!h) return false;
  h.tipo = 'humano'; h.heredero = true; h.placer = placerNuevo(); h.deseoSex = 20; h.forma = 50; soltarTarea(s, h);
  log(s, `🌾 ${h.nombre} se queda a cargo de la granja. La vida sigue.`, 'logro');
  return true;
}
function irseAlPueblo(s, h) {
  h.vivo = false; h.seFue = true; h.causa = 'se fue a estudiar al pueblo'; h.accion = 'Estudia en el pueblo'; h.dentro = false; soltarTarea(s, h);
  log(s, `🎓 ${h.nombre} se fue a estudiar al pueblo. Prometió volver de visita.`, 'info');
  for (const o of humanos(s)) { recuerdo(s, o, `Orgullo por ${h.nombre}`, 10, 24 * 3); recuerdo(s, o, `Extrañan a ${h.nombre}`, -8, 24 * 7); }
}
function crecer(s, a, et) {
  if (et === 'nino') log(s, `🎂 ${a.nombre} ya camina y corretea por la granja.`, 'logro');
  if (et === 'joven') log(s, `🎂 ${a.nombre} ya es ${a.sexo === 'h' ? 'un muchacho' : 'una muchacha'}: ahora ayuda con los huevos, las mascotas y el riego.`, 'logro');
  if (et === 'adulto') {
    log(s, `🎂 ${a.nombre} ya es ${a.sexo === 'h' ? 'un hombre' : 'una mujer'} hech${a.sexo === 'h' ? 'o' : 'a'}.`, 'logro');
    proponer(s, 'mayoria', `${a.nombre} ya es grande`, `${a.nombre} piensa en su futuro: puede quedarse a trabajar la granja con sus padres o irse a estudiar al pueblo.`, [
      { k: 'quedarse', txt: 'Que se quede en la granja', pista: 'una mano más para todo' },
      { k: 'estudiar', txt: 'Que se vaya a estudiar', pista: 'orgullo, pero lo van a extrañar' },
    ], 'quedarse', { hijo: a.id }, 24, 0);
  }
  for (const h of humanos(s)) recuerdo(s, h, `${a.nombre} está creciendo`, 8, 24);
}
const ACCION_HIJO = { jugarConPerro: 'Jugando con el perro', jugarConGato: 'Persiguiendo al gato', aprender: 'Mirando cómo se trabaja', seguir: 'Acompañando a sus padres', jugar: 'Jugando afuera', jugarDentro: 'Jugando en la casa', dormir: 'Durmiendo', comer: 'Comiendo', beber: 'Tomando agua', recogerHuevos: 'Recogiendo huevos', alimentar: 'Dando de comer a las mascotas', regar: 'Regando' };
const AYUDA_HIJO = ['recogerHuevos', 'alimentar', 'regar', 'beber', 'comer'];
function comportamientoHijo(s, a, d) {
  const et = etapaDe(s, a), n = a.n;
  if (et !== a.etapa) { const antes = a.etapa; a.etapa = et; if (antes) crecer(s, a, et); }
  if (et === 'bebe') {   // en la cuna: duerme a ratos y llora cuando necesita algo
    a.dentro = true; a.pos = { ...LUGAR.puerta };
    const llora = n.comida < 40 || n.agua < 40 || n.social < 28, debil = n.salud < 60;
    const duerme = !llora && (debil || n.energia < 70 || esNoche(s) || hora(s) % 3 < 1.6);   // débil: duerme mucho y así se repone
    if (duerme) { if (a.tarea?.tipo !== 'dormir') a.tarea = { tipo: 'dormir', fase: 'trabajo', inicio: s.t }; } else a.tarea = null;
    if (duerme && n.energia >= 100 && !esNoche(s) && !debil) a.tarea = null;
    a.accion = llora ? 'Llorando 😭' : debil ? 'Débil, durmiendo en la cuna' : duerme ? 'Durmiendo en la cuna' : 'Despierto en la cuna';
    return;
  }
  if (a.tarea && lloviendo(s) && esAfuera(a.tarea)) soltarTarea(s, a);
  if (a.tarea && !['beber', 'comer', 'dormir'].includes(a.tarea.tipo) && ((n.agua < 20 && (s.rec.potable >= 1 || s.rec.cruda >= 1)) || (n.comida < 20 && comidaTotal(s) >= 1))) soltarTarea(s, a);
  if (!a.tarea) elegirTareaHijo(s, a, et);
  const T = a.tarea; if (!T) return;
  a.accion = ACCION_HIJO[T.tipo] || ACCION[T.tipo] || 'Jugando';
  if (T.fase === 'camino') {
    if (a.dentro && !T.dentro) { a.dentro = false; a.pos = { ...LUGAR.puerta }; }
    if (a.dentro && T.dentro) { T.fase = 'trabajo'; return; }
    if (mover(a, T.destino, d)) { if (T.ruta && T.ruta.length) { T.destino = T.ruta.shift(); return; } T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  if (T.tipo === 'dormir') { const [dd, dp] = SUENO_HIJO[et], h = hora(s); if (!(h >= dd || h < dp) && n.energia >= 95) soltarTarea(s, a); return; }
  const o = T.con && s.agentes.find((x) => x.id === T.con && x.vivo);
  if (T.tipo === 'jugarConPerro' || T.tipo === 'jugarConGato') {
    const m = s.agentes.find((x) => x.tipo === (T.tipo === 'jugarConPerro' ? 'perro' : 'gato') && x.vivo);
    if (m) { m.n.diversion = Math.min(100, m.n.diversion + d); if (!m.tarea || m.tarea.tipo !== 'jugar') { m.tarea = { tipo: 'jugar', fase: 'trabajo', trabajo: T.trabajo, con: a.id }; m.dentro = false; } }
    n.diversion = Math.min(100, n.diversion + 1.2 * d); n.social = Math.min(100, n.social + 0.5 * d);
  } else if (T.tipo === 'aprender') {
    if (o && o.tarea?.fase === 'trabajo' && AREA[o.tarea.tipo]) {
      const area = AREA[o.tarea.tipo], antes = nivel(a.xp[area]);
      a.xp[area] = (a.xp[area] || 0) + d * 0.35 * mod(a, 'aprende');
      if (nivel(a.xp[area]) > antes) log(s, `📚 ${a.nombre} aprendió de ${o.nombre}: ${HABILIDADES[area].toLowerCase()} nivel ${nivel(a.xp[area])}.`, 'logro');
    } else T.trabajo = Math.min(T.trabajo, 2);
    n.social = Math.min(100, n.social + 0.8 * d); n.diversion = Math.min(100, n.diversion + 0.3 * d);
  } else if (T.tipo === 'seguir') {
    n.social = Math.min(100, n.social + 1.5 * d);
    if (o && !o.dentro && Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) > 4) { soltarTarea(s, a); tareaHijo(s, a, 'seguir', { con: o.id }); return; }
  } else if (T.tipo === 'jugar') n.diversion = Math.min(100, n.diversion + 1.0 * d);
  else if (T.tipo === 'jugarDentro') n.diversion = Math.min(100, n.diversion + 0.6 * d);
  T.trabajo -= d;
  if (T.trabajo > 0) return;
  if (AYUDA_HIJO.includes(T.tipo)) {
    completar(s, a, T);
    if (['recogerHuevos', 'alimentar', 'regar'].includes(T.tipo)) { const ar = AREA[T.tipo]; if (ar) a.xp[ar] = (a.xp[ar] || 0) + 15; for (const h of humanos(s)) recuerdo(s, h, `${a.nombre} ayudó en la granja`, 3, 8); }
  }
  if (a.tarea === T) soltarTarea(s, a);
}
function elegirTareaHijo(s, a, et) {
  const n = a.n, R = s.rec, [dd, dp] = SUENO_HIJO[et], h = hora(s), noche = h >= dd || h < dp;
  if (n.agua < 45 && (R.potable >= 1 || R.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.comida < 45 && comidaTotal(s) >= 1) return crearTarea(s, a, 'comer');
  if (noche || n.energia < 20) return crearTarea(s, a, 'dormir');
  if (lloviendo(s) || (frio(s) && rng(s) < 0.5)) return tareaHijo(s, a, 'jugarDentro');
  const padres = humanos(s), perro = s.agentes.find((x) => x.tipo === 'perro' && x.vivo && !x.dentro), gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo && !x.dentro && !x.trepado);
  const op = [];
  if (et !== 'nino') {
    if (R.nido >= 1 && !yaHaceAlguien(s, a, 'recogerHuevos')) op.push([3, 'recogerHuevos']);
    if ((R.comedero < 0.5 || R.bebedero < 2) && comidaTotal(s) >= 1 && !yaHaceAlguien(s, a, 'alimentar') && s.agentes.some((x) => esMascota(x) && x.vivo)) op.push([3, 'alimentar']);
    const p = s.parcelas.find((q) => !q.reservada && q.estado === 'creciendo' && q.agua < 45);
    if (p && R.cruda >= 12) op.push([et === 'adulto' ? 4 : 2, 'regar', { parcela: p.id }]);
  }
  if (perro && n.diversion < 85) op.push([tiene(a, 'jugueton') ? 3 : 2, 'jugarConPerro']);
  if (gato && n.diversion < 85) op.push([1.5, 'jugarConGato']);
  const trabaja = padres.find((x) => !x.dentro && x.tarea?.fase === 'trabajo' && AREA[x.tarea.tipo]);
  if (trabaja && et !== 'adulto') op.push([et === 'nino' ? 2.5 : 1.5, 'aprender', { con: trabaja.id }]);
  const afuera = padres.find((x) => !x.dentro && !x.nadando);
  if (afuera && n.social < 80) op.push([2, 'seguir', { con: afuera.id }]);
  op.push([1.5, 'jugar']);
  let r = rng(s) * op.reduce((t, x) => t + x[0], 0);
  for (const [w, tipo, extra] of op) if ((r -= w) <= 0) return tareaHijo(s, a, tipo, extra);
  return tareaHijo(s, a, 'jugar');
}
function tareaHijo(s, a, tipo, extra = {}) {
  if (['recogerHuevos', 'alimentar', 'regar'].includes(tipo)) return crearTarea(s, a, tipo, extra);
  if (tipo === 'jugarDentro') { if (a.dentro) { a.tarea = { tipo, fase: 'trabajo', trabajo: 40, inicio: s.t, dentro: true }; return a.tarea; } const t = crearTarea(s, a, 'deambular', { destino: { ...LUGAR.puerta }, trabajo: 40 }); Object.assign(t, { tipo, dentro: true }); return t; }
  const o = extra.con && s.agentes.find((x) => x.id === extra.con);
  const m = tipo === 'jugarConPerro' ? s.agentes.find((x) => x.tipo === 'perro' && x.vivo) : tipo === 'jugarConGato' ? s.agentes.find((x) => x.tipo === 'gato' && x.vivo) : null;
  const base = o ? o.pos : m ? m.pos : { x: LUGAR.banca.x + (rng(s) - 0.5) * 8, z: LUGAR.banca.z + 2 + rng(s) * 4 };
  const destino = { x: base.x + 1.1 + (rng(s) - 0.5) * 0.6, z: base.z + 0.8 + (rng(s) - 0.5) * 0.6 };
  const t = crearTarea(s, a, 'deambular', { destino, trabajo: { aprender: 30, seguir: 25, jugar: 30, jugarConPerro: 25, jugarConGato: 20 }[tipo] || 25 });
  t.tipo = tipo; Object.assign(t, extra);
  return t;
}

// ---------------------------------------------------------------- partida nueva
const placeresNuevos = () => ({ parras: PARRAS.slice(0, PARRAS_BASE).map((q, i) => ({ id: i, ...q, uvas: 0 })), matas: MATAS.map((q, i) => ({ id: i, ...q, crec: 0.2, estado: 'creciendo' })), barricas: [], curado: [] });
// (arrancan con algunos ahorros y el comerciante llega pronto)
const comercioNuevo = (t) => ({ proxima: Math.floor(t / MIN_DIA) + 3, visita: null, monedas: 150, vendido: {}, ultimo: null, visitas: 0, herramientas: [] });
const placerNuevo = () => ({ vino: { tol: 0, dep: 0, ult: -1e9, usos: 0 }, hierba: { tol: 0, dep: 0, ult: -1e9, usos: 0 } });
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
    ...(humano ? { placer: placerNuevo(), deseoSex: 40, forma: (p.rasgos || []).includes('atletico') ? 72 : (p.rasgos || []).includes('fuerte') ? 55 : 40 } : {}),
  };
}
const ZONA = (tipo) => (tipo === 'vaca' || tipo === 'oveja' ? CORRAL : GALLINERO);
export const esAve = (tipo) => tipo === 'gallina' || tipo === 'gallo' || tipo === 'pollito';
const CRECER_DIAS = { vaca: 112, oveja: 56, pollito: 28 };
const CUPO = { corral: 18, gallinero: 24 };   // crece con el establo y el gallinero grandes (aplicarProyectos)
// árboles de sombra dentro de los potreros: con calor el ganado se reparte entre el establo y estos
export const SOMBRAS = { corral: [{ x: -26, z: 12 }, { x: -25.5, z: -18.5 }], aves: [{ x: 26.5, z: -16.5 }] };
// el rebaño se mueve como rebaño: una zona de pastoreo que va recorriendo todo el potrero durante el día,
// y cada animal pasta suelto alrededor de ella, en su propio lugar (algunos se van a explorar lejos)
// lugares donde el gato se trepa: [x, z, altura ('techo' = la cumbre de la casa, la calcula la escena), base para subir, nombre]
export const TREPADEROS = [
  ...FRUTALES.map((f) => ({ x: f.x + 0.2, z: f.z, alto: 3.35, base: { x: f.x + 1.0, z: f.z + 0.5 }, nombre: f.tipo === 'manzano' ? 'a un manzano' : 'a un naranjo', arbol: true })),
  ...SOMBRAS.corral.concat(SOMBRAS.aves).map((q) => ({ x: q.x + 0.3, z: q.z, alto: 7.6, base: { x: q.x + 1.1, z: q.z + 0.6 }, nombre: 'a un árbol del potrero', arbol: true })),
  { x: 0, z: 0, alto: 'techo', base: { x: 6.9, z: 3.2 }, nombre: 'al techo de la casa', techo: true },
  { x: LUGAR.caseta.x, z: LUGAR.caseta.z, alto: 1.75, base: { x: LUGAR.caseta.x + 1.2, z: LUGAR.caseta.z + 0.4 }, nombre: `a la caseta del perro` },
  { x: LUGAR.gallinero.x, z: LUGAR.gallinero.z, alto: 2.95, base: { x: LUGAR.gallinero.x - 2.0, z: LUGAR.gallinero.z + 1.6 }, nombre: 'al techo del gallinero' },
  { x: LUGAR.pozo.x, z: LUGAR.pozo.z, alto: 2.7, base: { x: LUGAR.pozo.x + 1.3, z: LUGAR.pozo.z }, nombre: 'al techito del pozo' },
];
const trepaderoCerca = (a, soloArboles) => TREPADEROS.map((q, i) => [q, i]).filter(([q]) => !soloArboles || q.arbol || q.techo)
  .sort((x, y) => Math.hypot(x[0].base.x - a.pos.x, x[0].base.z - a.pos.z) - Math.hypot(y[0].base.x - a.pos.x, y[0].base.z - a.pos.z))[0][1];
function focoRebano(s, aves) {
  const F = (s.granja.foco ||= {}), k = aves ? 'aves' : 'corral', Z = aves ? GALLINERO : CORRAL;
  if (!F[k] || s.t >= F[k].hasta) F[k] = { ...puntoEn(s, Z, aves ? 3 : 4.5), hasta: s.t + 90 + rng(s) * 120, id: (F[k]?.id || 0) + 1 };
  return F[k];
}
function metaAnimal(s, g, aves) {
  const f = focoRebano(s, aves), Z = aves ? GALLINERO : CORRAL;
  if (g.focoId !== f.id) { g.focoId = f.id; const a = rng(s) * Math.PI * 2, r = (0.35 + Math.sqrt(rng(s)) * 0.65) * (aves ? 6.5 : 12); g.ofs = { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
  return { x: Math.max(Z.x0 + 1, Math.min(Z.x1 - 1, f.x + g.ofs.x)), z: Math.max(Z.z0 + 1, Math.min(Z.z1 - 1, f.z + g.ofs.z)) };
}
const AREA_PASTO = 2.6;   // el potrero es más grande: cada animal gasta menos porcentaje del pasto
function puntoEn(s, R, margen = 1.2) { return { x: R.x0 + margen + rng(s) * (R.x1 - R.x0 - 2 * margen), z: R.z0 + margen + rng(s) * (R.z1 - R.z0 - 2 * margen) }; }
// ---------------------------------------------------------------- genética del ganado
// cada animal lleva genes cerca de 1.0 (0.6 = muy malo, 1.4 = excelente)
export const GENES = { leche: 'Leche', lana: 'Lana', huevos: 'Huevos', resistencia: 'Resistencia', crecimiento: 'Crecimiento' };
const adnFundador = (s) => Object.fromEntries(Object.keys(GENES).map((k) => [k, Math.round((0.85 + rng(s) * 0.3) * 100) / 100]));
const parientes = (s, a, b) => {
  // ¿comparten madre o padre, o uno es hijo del otro?
  if (!a || !b) return false;
  if (a.madre && a.madre === b.madre) return true;
  if (a.padre && a.padre === b.padre) return true;
  return a.madre === b.id || a.padre === b.id || b.madre === a.id || b.padre === a.id;
};
function adnCria(s, madre, padre) {
  const adn = {};
  const cons = parientes(s, madre, padre) ? 0.25 : 0;
  for (const k of Object.keys(GENES)) {
    const m = madre.adn?.[k] ?? 1, p = padre?.adn?.[k] ?? 1;
    let v = (m + p) / 2 + (rng(s) - 0.5) * 0.14;                  // herencia + mutación
    if (cons) v -= k === 'resistencia' ? 0.12 : 0.05;               // depresión por consanguinidad
    adn[k] = Math.round(Math.max(0.5, Math.min(1.5, v)) * 100) / 100;
  }
  return { adn, consang: Math.min(1, cons + ((madre.consang || 0) + (padre?.consang || 0)) / 2 * 0.5) };
}
export const gen = (g, k) => g.adn?.[k] ?? 1;
function nuevoAnimalGranja(s, g) {
  return { id: g.id, tipo: g.tipo, sexo: g.sexo || (g.tipo === 'gallo' ? 'm' : 'h'), crec: 1, madre: null, padre: null, generacion: 0, adn: adnFundador(s), consang: 0, estres: 10, ultimoParto: -1, empolla: 0,
    nombre: g.nombre, vivo: true, pos: puntoEn(s, ZONA(g.tipo), 2), dest: null, espera: 0,
    hambre: 80, sed: 80, salud: 100, enfermo: 0, ubre: g.tipo === 'vaca' ? 4 : 0, lana: g.tipo === 'oveja' ? 40 : 0, edad: { vaca: 4, oveja: 2, gallina: 1, gallo: 1 }[g.tipo] ?? 2, comiendo: false, refugio: false, quieta: 0 };
}
export function nuevaPartida({ semilla = Date.now(), inicio = 6 * 60, generacion = 1 } = {}) {
  const s = {
    version: VERSION, config: CONFIG, rng: semilla | 0, generacion,
    t: inicio, t0: inicio,
    clima: { lluvia: false, lluviaHoy: null, arcoiris: 0 },
    rec: { potable: 30, cruda: 120, raciones: 45, comedero: 2, bebedero: 6, semillas: { lechuga: 8, papa: 6, frijol: 6, maiz: 4 },
      leche: 0, huevos: 4, lana: 2, heno: 150, abrigos: 2, grano: 2, pesebre: 6, bebederoGanado: 30, nido: 0,
      uvas: 0, vino: 6, hierba: 3, medicina: 1, libros: 0 },
    granja: { pasto: 80 },
    casa: { limpieza: 80, estado: 100, estilo: null, mejoras: [], obra: null, turno: 0 },
    desbloqueos: [], zorro: null,
    pareja: { afinidad: 70, tension: 0, pendiente: null, discusiones: 0, charlas: 0, intimidad: 0, ultimaCena: -1, ultimaIntimidad: -1, recetaNueva: false },
    parcelas: PARCELAS.map((p, i) => ({ id: i, x: p.x, z: p.z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null, ...sueloNuevo() })),
    frutales: FRUTALES.map((f, i) => ({ id: i, ...f, fruta: 0 })),
    jardines: JARDINES.map((j, i) => ({ id: i, x: j.x, z: j.z, flor: j.flor, cuidado: 0.3, flores: 0 })),
    obras: OBRAS.map(([id, nombre, horas]) => ({ id, nombre, horas, progreso: 0 })), esculturas: 0, avanceEscultura: 0, belleza: 10,
    ...placeresNuevos(), familia: familiaNueva(), caminos: caminosNuevos(), comercio: comercioNuevo(inicio), ...jugadorNuevo(), narrador: narradorNuevo(inicio), fuegos: [], prioridades: {}, ahorrosIniciales: true,
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
  if (!(minutos > 0) || !Number.isFinite(minutos)) return;
  if (s !== sCaminos) refrescarCaminos(s);
  while (minutos > 1e-9 && !s.fin) {
    const d = Math.min(1, minutos);
    try {
      tick(s, d);
      if (s.fallosSeguidos) s.fallosSeguidos = 0;
    } catch (e) {
      // un error en un minuto no puede congelar la granja: se anota, se repara y el tiempo sigue
      s.errores = (s.errores || 0) + 1; s.fallosSeguidos = (s.fallosSeguidos || 0) + 1;
      s.ultimoError = { t: s.t, msg: String(e?.message || e).slice(0, 200), pila: String(e?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 400) };
      if (typeof console !== 'undefined' && s.fallosSeguidos === 1) console.warn('[granja] error en la simulación, se repara y sigue:', e);
      for (const a of s.agentes || []) { try { soltarTarea(s, a); } catch { a.tarea = null; } }
      sanear(s, true);
      if (s.fallosSeguidos > 20) s.t += d;   // si sigue fallando, al menos el reloj avanza
    }
    minutos -= d;
  }
}

// ---------------------------------------------------------------- motor robusto: vigilante y saneamiento
const fin = (v, def) => (Number.isFinite(v) ? v : def);
const acotar = (v, lo, hi, def = lo) => Math.max(lo, Math.min(hi, fin(v, def)));
const radioTerreno = (p) => Math.hypot(p.x - (BLOQUE.x0 + BLOQUE.x1) / 2, p.z - (BLOQUE.z0 + BLOQUE.z1) / 2);
// cuánto puede durar como máximo cada tarea antes de considerarla atascada (minutos de juego)
const MAX_TAREA = { dormir: 16 * 60, dormirCon: 16 * 60, pasearPerro: 4 * 60, nadar: 3 * 60, refugio: 14 * 60 };
function vigilar(s) {
  // tareas que no avanzan: se sueltan para que el agente elija otra
  for (const a of s.agentes) {
    if (!a.vivo || !a.tarea) continue;
    const T = a.tarea;
    T.inicio ??= s.t;
    const max = MAX_TAREA[T.tipo] ?? Math.max(5 * 60, (DURACION[T.tipo] ?? 60) * 6);
    const camino = T.fase === 'camino' && (!T.destino || !Number.isFinite(T.destino.x) || !Number.isFinite(T.destino.z));
    // atascado caminando: no se ha movido en una hora con fase de camino
    const p = a._vig, quieto = T.fase === 'camino' && p && s.t - T.inicio >= 60 && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 0.05 && s.t - p.t >= 60;
    if (camino || quieto || s.t - T.inicio > max) {
      s.stats.rescates = (s.stats.rescates || 0) + 1;
      if (quieto && !a.dentro) a.pos = { ...LUGAR.puerta };
      try { soltarTarea(s, a); } catch { a.tarea = null; }
      if (esMascota(a)) a.dentro = false;
    }
    if (!p || Math.hypot(a.pos.x - p.x, a.pos.z - p.z) >= 0.05) a._vig = { x: a.pos.x, z: a.pos.z, t: s.t };
  }
  // ganado que no llega a su destino
  for (const g of s.ganado) {
    if (!g.vivo) continue;
    const p = g._vig;
    if (g.dest && !g.refugio && p && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 0.05 && s.t - p.t >= 90) { g.dest = null; g.espera = 0; s.stats.rescates = (s.stats.rescates || 0) + 1; }
    if (!p || Math.hypot(g.pos.x - p.x, g.pos.z - p.z) >= 0.05) g._vig = { x: g.pos.x, z: g.pos.z, t: s.t };
  }
  // reservas de parcelas huérfanas (alguien reservó y ya no está en esa tarea)
  for (const q of s.parcelas) if (q.reservada && !s.agentes.some((a) => a.vivo && a.id === q.reservada && a.tarea?.parcela === q.id)) q.reservada = null;
}
// arregla números rotos (NaN, infinitos, fuera de rango) y poda lo que crece sin límite
export function sanear(s, tras = false) {
  let arreglos = 0;
  const num = (o, k, lo, hi, def) => { if (!o) return; const v = o[k]; const w = acotar(v, lo, hi, def); if (w !== v) { o[k] = w; arreglos++; } };
  const pos = (o, def) => { if (!o.pos || !Number.isFinite(o.pos.x) || !Number.isFinite(o.pos.z) || radioTerreno(o.pos) > 49) { o.pos = { ...def }; arreglos++; } };
  if (!Number.isFinite(s.t)) { s.t = s.t0 || 0; arreglos++; }
  for (const a of s.agentes) {
    for (const k of ['comida', 'agua', 'energia', 'salud', 'social', 'diversion']) num(a.n, k, 0, 100, 60);
    num(a, 'animo', 0, 100, 60); num(a, 'edad', 0, 200, 30); num(a, 'enfermo', 0, 60, 0);
    pos(a, a.tipo === 'perro' ? LUGAR.caseta : LUGAR.puerta);
    if (a.tipo === 'humano') {
      a.placer ??= placerNuevo();
      for (const k of ['vino', 'hierba']) { const P = a.placer[k] ??= placerNuevo()[k]; num(P, 'tol', 0, 2, 0); num(P, 'dep', 0, 1, 0); num(P, 'ult', -1e9, s.t, -1e9); }
      num(a, 'deseoSex', 0, 100, 40);
      for (const k of Object.keys(a.xp || {})) num(a.xp, k, 0, 1e7, 0);
      // poda: los recuerdos vencidos y la costumbre de hace mucho no sirven
      a.recuerdos = (a.recuerdos || []).filter((r) => r && r.hasta > s.t && Number.isFinite(r.valor)).slice(-40);
      if (a.costumbre) for (const [k, c] of Object.entries(a.costumbre)) if (!c || s.t - c.t > 25 * MIN_DIA) delete a.costumbre[k];
    }
    if (a.vinculo) for (const k of Object.keys(a.vinculo)) num(a.vinculo, k, 0, 100, 50);
    if (a.tarea && typeof a.tarea !== 'object') { a.tarea = null; arreglos++; }
  }
  for (const [k, v] of Object.entries(s.rec)) {
    if (k === 'semillas') { for (const c of Object.keys(v)) num(v, c, 0, 999, 2); continue; }
    if (typeof v === 'number') num(s.rec, k, 0, 1e6, 0);
  }
  num(s.rec, 'cruda', 0, TANQUE_MAX, 50);
  num(s.granja, 'pasto', 0, 100, 50);
  num(s.casa, 'limpieza', 0, 100, 60); num(s.casa, 'estado', 0, 100, 80);
  num(s.pareja, 'afinidad', 0, 100, 50); num(s.pareja, 'tension', 0, 100, 0);
  num(s, 'belleza', 0, 100, 10);
  for (const q of s.parcelas) {
    for (const k of ['N', 'P', 'K']) num(q, k, 0, 100, 50);
    num(q, 'ph', 4, 9, 6.5); num(q, 'salud', 0, 100, 100); num(q, 'plaga', 0, 1, 0); num(q, 'agua', 0, 100, 60); num(q, 'crec', 0, 999, 0);
    if (q.cultivo && !CULTIVOS[q.cultivo]) { Object.assign(q, { cultivo: null, crec: 0, estado: 'vacia' }); arreglos++; }
  }
  for (const g of s.ganado) {
    for (const k of ['hambre', 'sed', 'salud', 'estres']) num(g, k, 0, 100, 60);
    num(g, 'crec', 0, 1, 1); num(g, 'edad', 0, 100, 1); num(g, 'consang', 0, 1, 0);
    pos(g, puntoEn(s, ZONA(g.tipo), 2));
    if (g.dest && (!Number.isFinite(g.dest.x) || !Number.isFinite(g.dest.z))) { g.dest = null; arreglos++; }
  }
  // los animales muertos hace mucho ya no se guardan (el árbol familiar sigue por los ids)
  const antes = s.ganado.length;
  s.ganado = s.ganado.filter((g) => g.vivo || s.t - (g.murio ?? s.t) < 120 * MIN_DIA);
  for (const g of s.ganado) if (!g.vivo) g.murio ??= s.t;
  arreglos += 0 * (antes - s.ganado.length);
  if (s.efectos?.length > 24) s.efectos = s.efectos.slice(-24);
  if (s.diario?.length > 250) s.diario.length = 250;
  if (arreglos) { s.stats.reparaciones = (s.stats.reparaciones || 0) + arreglos; if (tras) s.ultimoError && (s.ultimoError.arreglos = arreglos); }
  return arreglos;
}

function tick(s, d) {
  const diaAntes = dia(s);
  s.t += d;
  if (dia(s) !== diaAntes) nuevoDia(s);
  if (s.efectos.length && s.t - s.efectos[0].t >= 8) s.efectos = s.efectos.filter((e) => s.t - e.t < 8);   // (sin crear arreglos cada minuto)
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
    s.rec.cruda = Math.min(TANQUE_MAX, s.rec.cruda + (mejora(s, 'canaletas') ? 0.8 : 0.5) * (casaTiene(s, 'solar') ? 1.3 : 1) * d);
    s.stats.litrosLluvia += s.rec.cruda - antes;
    s.rec.bebederoGanado = Math.min(60, s.rec.bebederoGanado + 0.05 * d);
    for (const p of s.parcelas) p.agua = 100;
  }
  const esc = Math.floor(s.t / 10) !== Math.floor((s.t - d) / 10) ? escasez(s) : s.escasez;   // se revisa cada 10 minutos
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
  if (s.fuegos?.length || s.lobos || s.ladron || s.forastero) crisisTick(s, d);
  if (s.comercio?.visita) comercioTick(s);
  if (Math.floor(s.t / 30) !== Math.floor((s.t - d) / 30)) { vigilar(s); revisarDilemas(s); dilemasDelMomento(s); heridasTick(s); quiebres(s); familiaTick(s); }
  if (s.caminos && Math.floor(s.t / 10) !== Math.floor((s.t - d) / 10)) pisadas(s);
}

function nuevoDia(s) {
  sanear(s);
  if (s.sequia > 0 && --s.sequia === 0) log(s, 'Terminó la sequía.', 'clima');
  decidirClima(s);
  // lo guardado se echa a perder; mientras más se acumula, más se pudre (no cabe todo en la despensa)
  const R0 = s.rec.raciones, frio = obra(s, 'bodega') ? 0.5 : 1;   // la bodega fría reduce a la mitad lo que se pierde
  s.rec.raciones *= 1 - ((mejora(s, 'conservas') ? 0.003 : 0.008) + (R0 > 150 ? 0.006 : 0) + (R0 > 350 ? 0.012 : 0)) * frio - (R0 > 500 ? 0.02 : 0);
  s.rec.conservas = (s.rec.conservas || 0) * 0.9995; s.rec.queso = (s.rec.queso || 0) * 0.997; s.rec.secos = (s.rec.secos || 0) * 0.999;
  s.rec.leche *= obra(s, 'bodega') ? 0.88 : mejora(s, 'conservas') ? 0.8 : 0.7;        // la leche se corta rápido
  s.rec.huevos *= mejora(s, 'conservas') ? 0.98 : 0.95;
  // la casa se desgasta (más con las lluvias); hay que repararla
  s.casa.estado = Math.max(0, (s.casa.estado ?? 100) - (1.1 + (s.clima.lluviaHoy ? 0.8 : 0)) * (casaTiene(s, 'techo') ? 0.6 : 1));
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
  placeresDelDia(s);
  comercioDelDia(s);
  dilemasDelDia(s);
  familiaDelDia(s);
  narradorDelDia(s);
  for (const a of humanos(s)) a.forma = Math.max(10, (a.forma ?? 40) - 0.45);   // sin entrenar se pierde
  aplicarProyectos(s);
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
const LONGEVIDAD = { nino: 70, humano: 70, perro: 13, gato: 16, vaca: 18, oveja: 12, gallina: 8, gallo: 8, pollito: 8 };
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
    else if (a.tipo === 'humano' && rng(s) < 0.004 * (1 + Math.max(0, a.edad - 45) / 15) * (a.n.salud < 60 ? 2 : 1) * (sinAbrigo ? 2 : 1) * mod(a, 'enfermar') * (tiene(a, 'alergia') && e === 0 ? 1.6 : 1) * (1.25 - (a.forma ?? 40) / 200)) {
      a.enfermo = Math.ceil((3 + Math.floor(rng(s) * 5)) * (mejora(s, 'remedios') ? 0.5 : 1) * (s.rec.medicina >= 1 ? 0.5 : 1));
      if (s.rec.medicina >= 1) { s.rec.medicina -= 1; log(s, `💊 ${a.nombre} tomó medicina del comerciante: sanará más rápido.`, 'info'); }
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
    const L = LONGEVIDAD[g.tipo] * (0.8 + 0.2 * gen(g, 'resistencia')), sobra = g.edad - L * 0.85;
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
  s.belleza = Math.round(Math.min(100, flores * 8 + (s.esculturas || 0) * 5 + (obra(s, 'pergola') ? 6 : 0) + (obra(s, 'fuente') ? 9 : 0) + (obra(s, 'invernadero') ? 3 : 0) + (s.comercio?.lujos?.length || 0) * 3 + (casaTiene(s, 'fachada') ? 5 : 0) + (casaTiene(s, 'ventanales') ? 8 : 0) + (casaTiene(s, 'ampliacion') ? 3 : 0) + (casaTiene(s, 'piscina') ? 5 : 0) + (casaTiene(s, 'azotea') ? 6 : 0) + s.casa.limpieza * 0.05 + (s.casa.estado ?? 100) * 0.05));
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
    else if (rng(s) < 0.006 * (frio(s) ? 2 : 1) * (2 - gen(g, 'resistencia')) * (1 + (g.estres || 0) / 80) * (1 + (g.consang || 0))) { g.enfermo = 3 + Math.floor(rng(s) * 4); log(s, `${g.nombre} amaneció enfermo (${g.tipo}): hay que curarlo.`, 'aviso'); }
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
    for (const g of aves) if (g.vivo) g.estres = Math.min(100, (g.estres || 0) + 40);
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
  const padre = s.ganado.filter((x) => adulto(x) && x.sexo === 'm' && (esAve(tipo) ? x.tipo === 'gallo' : x.tipo === tipo)).sort((x, y) => (parientes(s, madre, x) ? 1 : 0) - (parientes(s, madre, y) ? 1 : 0))[0];
  const { adn, consang } = adnCria(s, madre, padre);
  const tipoCria = esAve(tipo) ? 'pollito' : tipo;
  const nombre = nombreCria(s, esAve(tipo) ? 'gallina' : tipo, sexo);
  const g = { id: `cria${s.sigCria++}`, tipo: tipoCria, sexo, crec: 0, madre: madre.id, padre: padre?.id || null, generacion: Math.max(madre.generacion || 0, padre?.generacion || 0) + 1, adn, consang, estres: 10, ultimoParto: -1, empolla: 0, nombre, vivo: true,
    pos: { x: madre.pos.x + (rng(s) - 0.5) * 1.2, z: madre.pos.z + (rng(s) - 0.5) * 1.2 }, dest: null, espera: 0,
    hambre: 85, sed: 85, salud: 100, enfermo: 0, ubre: 0, lana: tipo === 'oveja' ? 10 : 0, edad: 0, comiendo: false, refugio: false, quieta: 0 };
  s.ganado.push(g); s.stats.nacimientos += 1;
  // lo que se nota de la cría
  const rasgo = tipo === 'vaca' && sexo === 'h' && adn.leche > 1.1 ? 'buena lechera' : tipo === 'oveja' && adn.lana > 1.1 ? 'de lana abundante' : esAve(tipo) && sexo === 'h' && adn.huevos > 1.1 ? 'buena ponedora'
    : adn.resistencia > 1.12 ? 'muy fuerte' : consang > 0.2 ? 'débil (sus padres son parientes)' : null;
  if (rasgo) g.rasgo = rasgo;
  if (consang > 0.2 && !s.avisoConsang) { s.avisoConsang = true; log(s, `🧬 ${g.nombre} nació de padres emparentados: la sangre del rebaño se está cerrando.`, 'aviso'); }
  return g;
}
function reproduccion(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION, año = anio(s);
  const macho = (tipo) => s.ganado.some((g) => adulto(g) && g.tipo === tipo && g.sexo === 'm');
  // partos de vacas y ovejas en primavera
  if (e === 0 && dE >= 4 && dE <= 22) {
    for (const g of s.ganado.filter((x) => adulto(x) && x.sexo === 'h' && (x.tipo === 'vaca' || x.tipo === 'oveja'))) {
      if (g.ultimoParto === año || !macho(g.tipo) || enCorral(s) >= CUPO.corral) continue;
      const mult = { muchas: 1.8, normal: 1, pocas: 0.4, ninguna: 0 }[s.politica?.crias || 'normal'];
      if (rng(s) > (g.tipo === 'vaca' ? 0.05 : 0.07) * (1 - (g.estres || 0) / 120) * mult) continue;
      if (s.politica?.noParientes && !s.ganado.some((m) => adulto(m) && m.sexo === 'm' && m.tipo === g.tipo && !parientes(s, g, m))) continue;   // se espera sangre nueva
      g.ultimoParto = año;
      const n = g.tipo === 'oveja' && rng(s) < 0.3 && enCorral(s) + 2 <= CUPO.corral ? 2 : 1;
      const crias = Array.from({ length: n }, () => nacer(s, g.tipo, g));
      const que = g.tipo === 'vaca' ? (n > 1 ? 'terneros' : 'un ternero') : (n > 1 ? 'dos corderos' : 'un cordero');
      log(s, `¡${g.nombre} tuvo ${que}! ${crias.map((c) => `${c.nombre} (${c.sexo === 'h' ? 'hembra' : 'macho'}${c.rasgo ? ', ' + c.rasgo : ''})`).join(' y ')}. 🍼`, 'logro');
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
    if ((e === 0 || e === 1) && macho('gallo') && enGallinero(s) < CUPO.gallinero - 1 && rng(s) < 0.02 * ({ muchas: 1.8, normal: 1, pocas: 0.4, ninguna: 0 }[s.politica?.crias || 'normal'])) {
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
    if (s.politica?.cultivo === k && s.politica.cultivoEst === e) p *= 2.2;   // lo que decidió el jugador
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
const VEL = { nino: 1.15, humano: 1.35, perro: 2.6, gato: 2.2, vaca: 0.55, oveja: 0.7, gallina: 0.9, gallo: 0.9, pollito: 0.75 };   // unidades por minuto de juego
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
      g.crec = Math.min(1, g.crec + d / ((CRECER_DIAS[g.tipo] || 56) * MIN_DIA) * gen(g, 'crecimiento'));
      if (g.crec >= 1) {
        if (g.tipo === 'pollito') g.tipo = g.sexo === 'm' ? 'gallo' : 'gallina';
        const que = { vaca: g.sexo === 'm' ? 'un toro' : 'una vaca', oveja: g.sexo === 'm' ? 'un carnero' : 'una oveja', gallina: 'una gallina', gallo: 'un gallo' }[g.tipo];
        log(s, `${g.nombre} ya creció: ahora es ${que} adulto${g.sexo === 'h' ? 'a' : ''}.`, 'info');
      }
    }
    g.hambre = Math.max(0, g.hambre - HAMBRE_G[g.tipo] * k);
    g.sed = Math.max(0, g.sed - 3.5 * k);
    // refugio: de noche o con lluvia se meten al establo / gallinero
    const debeRefugio = noche || lloviendo(s) || (s.lobos && s.politica?.lobos === 'encerrar') || ((s.clima.temp ?? 15) > 30 && h > 11 && h < 17);   // con calor fuerte buscan sombra
    if (debeRefugio && !g.refugio) {
      g.refugio = true; g.comiendo = false;
      const calorRef = !noche && !lloviendo(s);
      const sitios = calorRef ? [aves ? LUGAR.gallinero : LUGAR.establo, ...SOMBRAS[aves ? 'aves' : 'corral']] : [aves ? LUGAR.gallinero : LUGAR.establo];
      const grupo = s.ganado.filter((x) => x.vivo && esAve(x.tipo) === aves), idx = Math.max(0, grupo.indexOf(g));
      const base = sitios[idx % sitios.length], k = Math.floor(idx / sitios.length);
      const ang = k * 2.4, r = (aves ? 0.6 : 1.0) + (aves ? 0.38 : 0.8) * Math.sqrt(k);   // espiral: nadie se monta encima de otro
      g.dest = { x: base.x + Math.cos(ang) * r, z: base.z + Math.sin(ang) * r };
    } else if (!debeRefugio && g.refugio && !g.empolla) { g.refugio = false; g.dest = null; }
    if (g.empolla && !g.refugio) { g.refugio = true; g.dest = { x: LUGAR.gallinero.x + (rng(s) - 0.5) * 1.6, z: LUGAR.gallinero.z }; }   // la clueca no sale del nido
    // las crías siguen a su madre
    const madre = g.crec < 1 && g.madre ? s.ganado.find((m) => m.id === g.madre && m.vivo) : null;
    if (madre && !g.refugio && Math.hypot(madre.pos.x - g.pos.x, madre.pos.z - g.pos.z) > 2.2) g.dest = { x: madre.pos.x + (rng(s) - 0.5) * 1.4, z: madre.pos.z + (rng(s) - 0.5) * 1.4 };
    if (g.quieta > s.t) { g.comiendo = false; continue; }            // la están ordeñando o esquilando
    // comer y beber
    g.comiendo = false;
    // con histéresis: el que empieza a beber o a comer sigue hasta saciarse (si no, quedan amarrados al bebedero)
    if (g.bebiendo && (g.sed >= 95 || R.bebederoGanado < 1)) g.bebiendo = false;
    if (g.sed < 50) g.bebiendo = true;
    if (g.pastando && g.hambre >= 95) g.pastando = false;
    if (g.hambre < 60) g.pastando = true;
    if ((!g.refugio || (g.sed < 30 && !lloviendo(s))) && g.bebiendo && R.bebederoGanado >= 1 && !aves) {
      if (g.refugio) { g.refugio = false; g.dest = null; }   // con sed sale a beber aunque esté a la sombra
      const b = LUGAR.bebederoGanado;
      if (Math.hypot(g.pos.x - b.x, g.pos.z - b.z) > 1.4) { if (!g.dest || g.dest.para !== 'beber') g.dest = { x: b.x - 0.9, z: b.z + (rng(s) - 0.5) * 1.6, para: 'beber' }; }
      else { g.sed = Math.min(100, g.sed + 70 * k); R.bebederoGanado = Math.max(0, R.bebederoGanado - (g.tipo === 'vaca' ? 0.12 : 0.05) * (g.crec < 1 ? 0.5 : 1) * 70 * k); g.dest = null; g.comiendo = true; }
    } else if (aves && g.sed < 55) {   // (las aves beben en su nido-bebedero: no caminan)
      g.sed = Math.min(100, g.sed + 40 * k);   // beben del bebedero del gallinero (se llena con la lluvia y al alimentarlas)
    } else if (g.pastando) {
      if (aves) {
        if (e !== 3) { g.hambre = Math.min(100, g.hambre + 18 * k); g.comiendo = !g.refugio; if (!g.refugio && rng(s) < 0.08 * d) { const m = metaAnimal(s, g, true), dx = m.x - g.pos.x, dz = m.z - g.pos.z, dd = Math.hypot(dx, dz) || 1, paso = Math.min(dd, 2.5); g.dest = { x: Math.max(Z.x0 + 0.8, Math.min(Z.x1 - 0.8, g.pos.x + dx / dd * paso + (rng(s) - 0.5) * 1.5)), z: Math.max(Z.z0 + 0.8, Math.min(Z.z1 - 0.8, g.pos.z + dz / dd * paso + (rng(s) - 0.5) * 1.5)) }; } }   // picotean bichos caminando
        else if (R.grano > 0.02) { g.hambre = Math.min(100, g.hambre + 30 * k); R.grano = Math.max(0, R.grano - 0.004 * 30 * k); g.comiendo = true; }
      } else if (!g.refugio && G.pasto > 6 && (e !== 3 || R.pesebre < 0.5)) {   // en invierno el pasto no crece, pero lo que queda se come
        g.hambre = Math.min(100, g.hambre + 26 * k); G.pasto = Math.max(0, G.pasto - (g.tipo === 'vaca' ? 0.06 : 0.03) * (g.crec < 1 ? 0.5 : 1) * 26 * k / AREA_PASTO); g.comiendo = true;
        // pasta caminando despacio, mordisco a mordisco
        if (!g.pastoreo || Math.hypot(g.pastoreo.x - g.pos.x, g.pastoreo.z - g.pos.z) < 0.15) { const m = metaAnimal(s, g, false), lejos = Math.hypot(m.x - g.pos.x, m.z - g.pos.z) > 2.5; const a = lejos ? Math.atan2(m.z - g.pos.z, m.x - g.pos.x) + (rng(s) - 0.5) * 1.2 : rng(s) * Math.PI * 2; g.pastoreo = { x: Math.max(Z.x0 + 1, Math.min(Z.x1 - 1, g.pos.x + Math.cos(a) * 1.5)), z: Math.max(Z.z0 + 1, Math.min(Z.z1 - 1, g.pos.z + Math.sin(a) * 1.5)) }; }
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
        if (rng(s) < 0.7) { const m = metaAnimal(s, g, aves); g.dest = { x: Math.max(Z.x0 + 1, Math.min(Z.x1 - 1, m.x + (rng(s) - 0.5) * 3)), z: Math.max(Z.z0 + 1, Math.min(Z.z1 - 1, m.z + (rng(s) - 0.5) * 3)) }; }
        else g.dest = puntoEn(s, Z);
        g.espera = 3 + rng(s) * 12;
      }
    }
    if (g.dest) {
      const dx = g.dest.x - g.pos.x, dz = g.dest.z - g.pos.z, dist = Math.hypot(dx, dz), v = VEL[g.tipo] * d;
      if (dist <= v) { g.pos.x = g.dest.x; g.pos.z = g.dest.z; if (!g.refugio) g.dest = null; }
      else { g.pos.x += (dx / dist) * v; g.pos.z += (dz / dist) * v; }
    }
    // producción
    // bienestar: el estrés sube con hambre, sed, agua escasa, hacinamiento, calor sin sombra, frío a la intemperie y enfermedad
    {
      const dens = aves ? enGallinero(s) / CUPO.gallinero : enCorral(s) / CUPO.corral;
      const temp = s.clima.temp ?? 15;
      let obj = 5;
      if (g.hambre < 35) obj += 30 * (1 - g.hambre / 35);
      if (g.sed < 35) obj += 30 * (1 - g.sed / 35);
      if (!aves && R.bebederoGanado < 5) obj += 10;
      if (dens > 0.75) obj += (dens - 0.75) * 120;
      if (temp > 29 && !g.refugio) obj += (temp - 29) * 6;
      if (temp < 2 && !g.refugio) obj += (2 - temp) * 5;
      if (g.enfermo) obj += 20;
      if (g.cepillado > s.t) obj -= 15;
      g.estres = Math.max(0, Math.min(100, (g.estres ?? 10) + (obj - (g.estres ?? 10)) * Math.min(1, 0.02 * d)));
      if (g.estres > 80) g.salud = Math.max(0, g.salud - 0.3 * k);
    }
    const bien = g.hambre > 35 && g.sed > 35 && !g.enfermo;
    const prod = 1 - (g.estres || 0) / 150;   // el estrés baja la producción
    if (g.tipo === 'vaca' && g.sexo === 'h' && g.crec >= 1 && bien) g.ubre = Math.min(14, g.ubre + (9 / MIN_DIA) * d * gen(g, 'leche') * prod);
    if (g.tipo === 'oveja' && bien) g.lana = Math.min(100, g.lana + (1.2 / MIN_DIA) * d * gen(g, 'lana') * prod);
    if (g.tipo === 'gallina' && g.crec >= 1 && !g.empolla && bien) R.nido = Math.min(30, R.nido + ((e === 3 ? 0.35 : 0.8) / MIN_DIA) * d * gen(g, 'huevos') * prod);
    if (g.tipo === 'gallo' && h >= 5.5 && h < 5.5 + d / 60 + 0.001) {
      efecto(s, 'kikiriki', g.pos.x, g.pos.z);
      if (dia(s) % 14 === 0) log(s, `${g.nombre} cantó al amanecer. 🐓`, 'info');
    }
    // salud
    g.salud = Math.max(0, Math.min(100, g.salud + (g.hambre <= 0 || g.sed <= 0 ? -3 : g.enfermo ? -0.35 : 0.5) * k));
    if (g.salud <= 0) morirAnimal(s, g, g.hambre <= 0 ? 'de hambre' : g.sed <= 0 ? 'de sed' : g.estres > 80 ? 'debilitado por el estrés' : 'enfermo');
  }
}
function morirAnimal(s, g, causa) {
  g.vivo = false; g.causa = causa; g.murio = s.t;
  log(s, `${g.nombre} (${g.tipo}) murió ${causa}.`, 'muerte');
  humanos(s).forEach((a) => { recuerdo(s, a, `Murió ${g.nombre}`, causa.includes('lobos') ? -14 : -8, 72); if (causa === 'atacada por un zorro') memoria(s, a, `El zorro se llevó a ${g.nombre}`, -1); });
}

// ---------------------------------------------------------------- necesidades y muerte
const TASA = {
  humano: { comida: 2.2, agua: 4, energia: 4 },
  perro: { comida: 2.0, agua: 3.5, energia: 3 },
  gato: { comida: 1.6, agua: 2.5, energia: 2.5 },
  nino: { comida: 2.4, agua: 3.6, energia: 4.2 },
};
function necesidades(s, a, d) {
  const T = TASA[a.tipo], n = a.n, k = d / 60, est = estres(s, a);
  n.comida = Math.max(0, n.comida - T.comida * mod(a, 'hambre') * (est === 'raciona' ? 0.9 : 1) * (a.colocadoHasta > s.t ? 1.9 : 1) * k);   // la hierba da antojos
  n.agua = Math.max(0, n.agua - T.agua * mod(a, 'sed') * (calor(s) ? 1.3 : 1) * k);
  const durmiendo = a.tarea && ['dormir', 'dormirCon'].includes(a.tarea.tipo) && a.tarea.fase === 'trabajo';
  const trabajando = a.tarea && a.tarea.fase === 'trabajo' && (AREA[a.tarea.tipo] || a.tarea.tipo === 'guardia');
  const frioSinAbrigo = a.tipo === 'humano' && frio(s) && !a.dentro && s.rec.abrigos < humanos(s).length;
  if (durmiendo) n.energia = Math.min(100, n.energia + 15 * k);
  else n.energia = Math.max(0, n.energia - (T.energia + (trabajando ? 4 : 0)) * mod(a, 'cansancio') * (est === 'trabaja' && trabajando ? 1.25 : 1) * (frioSinAbrigo ? 1.25 : 1) * k);
  if (!durmiendo) {
    n.social = Math.max(0, n.social - (a.tipo === 'humano' ? 2 + P5(a, 'extraversion') * 3 : 1.5) * k);
    n.diversion = Math.max(0, n.diversion - (a.tipo === 'humano' ? 3 * mod(a, 'aburrimiento') : 2.5 * (mejora(s, 'juguetes') ? 0.6 : 1)) * (trabajando ? 1.4 : 1) * k);
  }
  let dS = 0;
  if (n.comida <= 0) dS -= 4;
  if (n.agua <= 0) dS -= 6;
  if (n.energia <= 0) dS -= 1;
  if (a.enfermo > 0) dS -= 0.85;
  const vejez = Math.max(0, (a.edad - LONGEVIDAD[a.tipo] * 0.7) / (LONGEVIDAD[a.tipo] * 0.3));
  if (n.comida > 40 && n.agua > 40 && n.energia > 15) dS += 0.6 * (1 - 0.7 * Math.min(1, vejez));
  n.salud = Math.min(100, Math.max(0, n.salud + dS * k));
  if (a.embarazada && !durmiendo) n.energia = Math.max(0, n.energia - 0.9 * k);   // el embarazo cansa
  if (a.tipo === 'humano') calcularAnimo(s, a);
  else if (a.tipo === 'nino') { const m = (n.comida + n.agua + n.energia + n.salud + n.social + n.diversion) / 6; a.animo += (m - a.animo) * Math.min(1, 0.05 * k); }
  if (n.salud <= 0) morir(s, a);
}

function morir(s, a, causa) {
  a.vivo = false; a.murio = s.t; a.dentro = false; a.nadando = false;
  a.causa = causa || (a.n.agua <= 0 ? 'de sed' : a.n.comida <= 0 ? 'de hambre' : a.enfermo > 0 ? 'de una enfermedad' : 'de agotamiento');
  soltarTarea(s, a);
  a.accion = 'Murió';
  log(s, `${a.nombre} murió ${a.causa}. 🕯️`, 'muerte');
  const hijoX = a.tipo === 'nino';
  for (const o of humanos(s)) { recuerdo(s, o, `Duelo por ${a.nombre}`, hijoX ? -50 : a.tipo === 'humano' ? -35 : -18, hijoX ? 24 * 24 : a.tipo === 'humano' ? 24 * 14 : 24 * 5); memoria(s, o, `La partida de ${a.nombre}`, hijoX ? -8 : a.tipo === 'humano' ? -5 : -3); }
  if (a.embarazada && s.familia?.embarazo) { s.familia.embarazo = null; a.embarazada = false; }
  if (s.agentes.filter((x) => x.tipo === 'humano').every((h) => !h.vivo) && heredar(s)) return;
  if (s.agentes.filter((x) => x.tipo === 'humano').every((h) => !h.vivo)) {
    if (hijos(s).length) { log(s, `Los niños (${hijos(s).map((k) => k.nombre).join(', ')}) se fueron a vivir con sus tíos al pueblo.`, 'muerte'); for (const k of hijos(s)) { k.vivo = false; k.seFue = true; k.causa = 'se fue al pueblo'; k.accion = 'Se fue al pueblo'; } }
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
const DENTRO = ['cuidarBebe', 'comer', 'beber', 'dormir', 'filtrar', 'cocinar', 'cenar', 'limpiarCasa', 'hacerConservas', 'hacerQueso', 'hornear', 'reposo'];
const AFUERA_URGENTE = ['filtrar'];
const DURACION = {
  empedrar: 60, cuidarBebe: 20, comer: 30, beber: 3, dormir: 60, filtrar: 60, sacarAgua: 60, regar: 12, sembrar: 20, cosechar: 30, limpiar: 15, alimentar: 10,
  descansar: 40, leer: 60, tallar: 50, contemplar: 35, jugarGato: 25, pasearPerro: 0, conversar: 25, cocinar: 45, cenar: 35, limpiarCasa: 40, siesta: 50,
  ordenar: 20, recogerHuevos: 10, esquilar: 30, segar: 60, alimentarGanado: 15, tejer: 80, nadar: 40,
  reparar: 70, curar: 25, reconciliar: 20, recogerFlores: 30, jugarPerro: 20, recogerFruta: 30,
  cepillar: 20, fumigar: 20, arrancar: 25, abonar: 20, voltearCompost: 30,
  construir: 90, esculpir: 80, cuidarJardin: 45, hacerConservas: 60, hacerQueso: 50, secar: 40,
  vendimia: 60, pisarUva: 50, cosecharHierba: 30, tomarVino: 45, fumar: 30, comerciar: 40, renovar: 90, entrenar: 40, hornear: 50, beberPiscina: 4, apagarFuego: 8, guardia: 600, repararPozo: 90, reposo: 120, curarHerida: 30, deambular: 40,
};
const COMIDAS = [['desayuno', 6.5, 9, 20], ['almuerzo', 12, 13.5, 30], ['cena', 19, 20.5, 45]];   // [comida, desde, hasta, minutos de cocina]
const OCIOS = ['esculpir', 'cuidarJardin', 'descansar', 'leer', 'tallar', 'contemplar', 'siesta', 'tejer', 'nadar', 'recogerFlores', 'jugarPerro', 'tomarVino', 'fumar', 'entrenar', 'hornear'];
const vaca = (s) => s.ganado.filter((g) => g.vivo && g.tipo === 'vaca' && g.sexo === 'h' && g.crec >= 1).sort((a, b) => b.ubre - a.ubre)[0];
function crearTarea(s, a, tipo, extra = {}) {
  const t = { tipo, fase: 'camino', trabajo: DURACION[tipo] ?? 30, inicio: s.t, ...extra };
  if (tipo === 'deambular' && extra.destino) { const pasos = planRuta(a.dentro ? LUGAR.puerta : a.pos, extra.destino); t.destino = pasos.shift(); t.ruta = pasos; a.tarea = t; return t; }
  const izq = a.id === s.agentes[0].id;
  const adentroOcio = ((tipo === 'leer' || tipo === 'tejer' || tipo === 'entrenar') && (lloviendo(s) || esNoche(s) || hora(s) >= 19.5 || (frio(s) && rng(s) < 0.6)))
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
  else if (tipo === 'empedrar') { const c = CAMINOS.find((x) => x.id === t.tramo), q = puntoCamino(c, s.caminos[t.tramo].progreso + 0.02); t.destino = { x: q.x + 0.75, z: q.z + 0.45 }; }
  else if (tipo === 'voltearCompost') t.destino = { x: LUGAR.compost.x + 1.2, z: LUGAR.compost.z + 0.4 };
  else if (tipo === 'esculpir') t.destino = { x: LUGAR.taller.x - 0.4, z: LUGAR.taller.z + 1.0 };
  else if (tipo === 'cuidarJardin') { const j = s.jardines[t.jardin]; t.destino = { x: j.x - 2.1, z: j.z + 0.3 }; }
  else if (tipo === 'secar') { const o = OBRAS.find((x) => x[0] === 'secadero'); t.destino = { x: o[3] + 1.2, z: o[4] + 1.0 }; }
  else if (tipo === 'recogerFruta') { const f = s.frutales[t.arbol]; t.destino = { x: f.x + 1.3, z: f.z + 0.6 }; }
  else if (tipo === 'recogerFlores') { const j = [...(s.jardines || [])].sort((x, y) => y.flores - x.flores)[0]; t.destino = j && j.flores > 0.4 ? { x: j.x + 2.1, z: j.z + 0.3 } : { x: LUGAR.mirador.x + 3 + (rng(s) - 0.5) * 3, z: LUGAR.mirador.z - 2 + (rng(s) - 0.5) * 2 }; }
  else if (tipo === 'cepillar') { const g = s.ganado.find((x) => x.id === t.animal); t.destino = g ? { x: g.pos.x + 1.0, z: g.pos.z + 0.4 } : { ...LUGAR.establo }; }
  else if (tipo === 'curar') { const g = s.ganado.find((x) => x.id === t.animal); t.destino = g ? { x: g.pos.x + 1.0, z: g.pos.z + 0.4 } : { ...LUGAR.establo }; }
  else if (tipo === 'vendimia') { const q = [...s.parras].sort((x, y) => y.uvas - x.uvas)[0]; t.destino = { x: q.x, z: q.z - 1.4 }; }
  else if (tipo === 'pisarUva') t.destino = { ...LUGAR.lagar };
  else if (tipo === 'renovar') t.destino = sitioProyecto(s);
  else if (tipo === 'deambular' && t.destino) { /* destino ya dado */ }
  else if (tipo === 'apagarFuego') { const F = (s.fuegos || []).find((x) => x.id === t.fuego) || s.fuegos?.[0]; t.destino = F ? { x: F.x + 1.4 + (rng(s) - 0.5), z: F.z + 1.4 } : { ...LUGAR.puerta }; }
  else if (tipo === 'guardia') t.destino = { x: CORRAL.x0 + 3 + rng(s) * 4, z: -4 + rng(s) * 8 };
  else if (tipo === 'beberPiscina') t.destino = { ...LUGAR.piscina };
  else if (tipo === 'repararPozo') t.destino = { x: LUGAR.pozo.x + 1.2, z: LUGAR.pozo.z };
  else if (tipo === 'curarHerida') { const p = s.agentes.find((x) => x.id === t.paciente); t.destino = p ? (p.dentro ? { ...LUGAR.puerta } : { x: p.pos.x + 0.8, z: p.pos.z + 0.4 }) : { ...LUGAR.puerta }; if (p?.dentro) t.dentro = true; }
  else if (tipo === 'entrenar') t.destino = { x: LUGAR_GYM.x + (izq ? -0.8 : 0.8), z: LUGAR_GYM.z + 0.6 };
  else if (tipo === 'cosecharHierba') { const m = s.matas.find((x) => x.estado === 'lista') || s.matas[0]; t.destino = { x: m.x - 1.2, z: m.z }; }
  else if (tipo === 'comerciar') t.destino = { x: LUGAR.carreta.x - 1.6, z: LUGAR.carreta.z + 0.4 };
  else if (tipo === 'fumar') t.destino = rng(s) < 0.5 ? { x: LUGAR.mirador.x + (izq ? -0.6 : 0.6), z: LUGAR.mirador.z } : { x: LUGAR.banca.x + (izq ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
  else if (tipo === 'tomarVino') t.destino = { x: LUGAR.banca.x + (izq ? -0.7 : 0.7), z: LUGAR.banca.z + 0.6 };
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
  const dx = destino.x - a.pos.x, dz = destino.z - a.pos.z, dist = Math.hypot(dx, dz), v = VEL[a.tipo] * d * (cojea(a) ? 0.55 : 1)   // cojea con la pierna herida
    * (caminosHechos.length && !a.dentro && caminosHechos.some((c) => distCamino(a.pos, c) < 1.1) ? 1.35 : 1);   // por el camino empedrado se anda más rápido
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

const yaHaceAlguien = (s, a, tipo) => s.agentes.some((x) => x !== a && x.tarea?.tipo === tipo);
function elegirTarea(s, a) {
  const n = a.n, R = s.rec, est = estres(s, a), resp = P5(a, 'responsabilidad'), h = hora(s);
  const otro = pareja(s, a), llueve = lloviendo(s);
  if (a.quiebre && n.agua > 25 && n.comida > 20) { const tq = tareaDeQuiebre(s, a); if (tq) return tq; }   // aun quebrado, toma agua y come
  if (n.agua < 40 && (R.potable >= 1 || R.cruda >= 1)) return crearTarea(s, a, 'beber');
  if (n.agua < 25) return crearTarea(s, a, 'beberPiscina');   // sin agua guardada: de la piscina
  if (n.comida < (est === 'raciona' ? 25 : 40) && comidaTotal(s) >= 1) return crearTarea(s, a, 'comer');
  if (n.energia < 18) return crearTarea(s, a, 'dormir');
  { const b = bebeQueNecesita(s); if (b && n.energia > 10 && !s.agentes.some((x) => x !== a && x.tarea?.tipo === 'cuidarBebe')) return crearTarea(s, a, 'cuidarBebe', { bebe: b.id }); }
  if (s.fuegos?.length && s.politica?.incendio !== 'dejar' && n.energia > 8 && n.agua > 25 && (R.cruda >= 55 || R.bebederoGanado >= 25)) return crearTarea(s, a, 'apagarFuego', { fuego: s.fuegos[0].id });
  if (s.fuegos?.some((F) => F.lugar === 'casa' && F.intensidad > 0.3)) { if (a.dentro || (a.tarea?.dentro)) return crearTarea(s, a, 'deambular', { trabajo: 30, destino: { x: LUGAR.banca.x, z: LUGAR.banca.z + 1.5 } }); }   // la casa arde: afuera
  if (s.lobos && s.politica?.lobos === 'guardia' && s.t >= s.lobos.llegan - 60 && n.energia > 10 && !yaHaceAlguien(s, a, 'guardia')) return crearTarea(s, a, 'guardia');
  if (horaDeDormir(s, a) && n.energia < 92) return crearTarea(s, a, 'dormir');
  // herido grave: reposo (si no hay quien lo cure, se cura solo como pueda)
  if (severidad(a) > 0.6 && !(a.heridas || []).some((h) => h.sev > 0.5 && !h.tratada && !otro)) return crearTarea(s, a, 'reposo', { trabajo: 90 });

  // todas las comidas se cocinan y se comen en la mesa: desayuno, almuerzo y cena
  for (const [comida, h0, h1, mins] of COMIDAS) {
    if (h < h0 || h >= h1 || s.pareja['ultima_' + comida] === dia(s) || comidaTotal(s) < 2 || (comida !== 'cena' && n.comida > 90)) continue;   // la cena es un ritual: siempre
    const otroCocina = otro && despierto(s, otro) && !otro.nadando;
    const cocinero = !otroCocina ? a : comida === 'desayuno'
      ? [a, otro].sort((x, y) => (HAB(y).cronotipo === 'madrugador' ? 1 : 0) - (HAB(x).cronotipo === 'madrugador' ? 1 : 0))[0]
      : [a, otro].sort((x, y) => (nivel(y.xp.casa) + P5(y, 'apertura') * 3 + (tiene(y, 'chef') ? 3 : 0)) - (nivel(x.xp.casa) + P5(x, 'apertura') * 3 + (tiene(x, 'chef') ? 3 : 0)))[0];
    if (cocinero === a && !ocupadoEn(otro, ['cocinar'])) { s.pareja['ultima_' + comida] = dia(s); return crearTarea(s, a, 'cocinar', { comida, trabajo: mins * (casaTiene(s, 'cocina') ? 0.75 : 1) }); }
  }

  // trabajo por urgencia (con lluvia solo lo de adentro o lo muy urgente)
  const libre = (p) => !p.reservada;
  const opcionesUrgentes = [];
  // crisis: el fuego primero, la guardia contra los lobos, el pozo roto
  if (s.fuegos?.length && s.politica?.incendio !== 'dejar' && (s.politica?.incendio !== 'uno' || !s.agentes.some((x) => x !== a && x.tarea?.tipo === 'apagarFuego')) && (R.cruda >= 55 || R.bebederoGanado >= 25)) opcionesUrgentes.push([99, 'apagarFuego', { fuego: s.fuegos[0].id }]);
  if (s.lobos && s.politica?.lobos === 'guardia' && !yaHaceAlguien(s, a, 'guardia') && s.t >= s.lobos.llegan - 60) opcionesUrgentes.push([98, 'guardia']);
  if (s.pozoRoto && (s.pozoRoto.autorizado || s.t - s.pozoRoto.desde > 10 * MIN_DIA) && !yaHaceAlguien(s, a, 'repararPozo')) opcionesUrgentes.push([R.cruda < 60 ? 93 : 70, 'repararPozo']);
  { // curar a quien esté herido (también a las mascotas); sin compañía, se cura a sí mismo
    const pac = s.agentes.filter((x) => x.vivo && porCurar(s, x) && (x !== a || !otro || !despierto(s, otro))).sort((x, y) => severidad(y) - severidad(x))[0];
    if (pac && !s.agentes.some((x) => x !== a && x.tarea?.tipo === 'curarHerida' && x.tarea.paciente === pac.id)) opcionesUrgentes.push([severidad(pac) > 0.5 || (pac.heridas || []).some((h) => h.infeccion > 0.3) ? 97 : 70, 'curarHerida', { paciente: pac.id }]);
  }
  const yaHace = (tipo) => otro && otro.tarea && otro.tarea.tipo === tipo;
  const umbralRiego = 30 + resp * 25, e = estacion(s);
  const opciones = [];
  if (R.potable < Math.max(8, consumoAgua(s)) && R.cruda >= 5 && !yaHace('filtrar')) opciones.push([100, 'filtrar']);
  { const p = s.parcelas.find((p) => p.estado === 'lista' && libre(p)); if (p) opciones.push([90, 'cosechar', { parcela: p.id }]); }
  if (R.cruda >= (s.sequia > 0 ? 60 : 8)) { const p = s.parcelas.find((p) => p.estado === 'creciendo' && p.agua < umbralRiego && libre(p)); if (p) opciones.push([85, 'regar', { parcela: p.id }]); }
  const sedGanado = s.ganado.some((g) => g.vivo && !esAve(g.tipo) && g.sed < 35);
  if ((R.cruda < 60 || (s.sequia > 0 && R.cruda < 200)) && !yaHace('sacarAgua')) opciones.push([s.sequia > 0 || sedGanado ? 91 : 80, 'sacarAgua']);
  const v = vaca(s);
  if (v && !yaHace('ordenar') && v.ubre >= (h >= 5 && h < 11 ? 6 : 12)) opciones.push([75, 'ordenar']);
  const animalesGranja = s.ganado.some((g) => g.vivo);
  const reservaHumana = 30 + humanos(s).length * 28;   // las personas primero: comida para ~20 días
  const hambreGranja = s.ganado.some((g) => g.vivo && g.hambre < 30 && !esAve(g.tipo));
  if (animalesGranja && !yaHace('alimentarGanado') && ((R.pesebre < 3 && (e === 3 || s.granja.pasto < 25 || hambreGranja) && (R.heno >= 2 || (hambreGranja && R.raciones > reservaHumana))) || (R.bebederoGanado < 15 && R.cruda >= (sedGanado ? 5 : 20)) || (e === 3 && R.grano < 0.5 && R.raciones >= 1)))
    opciones.push([hambreGranja || (sedGanado && R.bebederoGanado < 15) ? 94 : 72, 'alimentarGanado']);
  { const p = s.parcelas.find((p) => p.estado === 'vacia' && libre(p) && (elegirCultivo(s, a) || (obra(s, 'invernadero') && p.id >= 9))); const c = p && elegirCultivo(s, a, obra(s, 'invernadero') && p.id >= 9, p); if (p && c) opciones.push([comidaTotal(s) > 300 ? 28 : 70, 'sembrar', { parcela: p.id, cultivo: c }]); }
  if ((R.comedero < 0.5 || R.bebedero < 2) && (comidaTotal(s) >= 1 || R.cruda >= 3) && !yaHace('alimentar') && s.agentes.some((x) => esMascota(x) && x.vivo)) opciones.push([65, 'alimentar']);
  { const p = s.parcelas.find((p) => p.estado === 'muerta' && libre(p)); if (p) opciones.push([60, 'limpiar', { parcela: p.id }]); }
  // sanidad vegetal: quien tiene mano verde ve la plaga antes
  { const ve = tiene(a, 'manoVerde') ? 0.12 : 0.3;
    const p = s.parcelas.filter((q) => q.estado === 'creciendo' && q.plaga > ve && libre(q)).sort((x, y) => y.plaga - x.plaga)[0];
    if (p) opciones.push(p.plaga > 0.85 && p.salud < 30 ? [84, 'arrancar', { parcela: p.id }] : [p.prioridad > s.t ? 93 : 80, 'fumigar', { parcela: p.id }]); }
  { const p = s.parcelas.find((q) => (q.estado === 'vacia' || q.estado === 'creciendo') && Math.min(q.N, q.P, q.K) < 40 && libre(q));
    if (p && (R.compost || 0) >= 4 && !yaHace('abonar')) opciones.push([57, 'abonar', { parcela: p.id }]); }
  if ((R.pila || 0) > 15 && dia(s) - (s.ultimoVolteo ?? -99) >= 5 && !yaHace('voltearCompost')) opciones.push([40, 'voltearCompost']);
  if (R.nido >= 2 && !yaHace('recogerHuevos')) opciones.push([55, 'recogerHuevos']);
  { const o = s.ganado.find((g) => g.vivo && g.tipo === 'oveja' && g.crec >= 1 && g.lana >= 70); if (o && (e === 0 || e === 1) && !yaHace('esquilar')) opciones.push([52, 'esquilar', { oveja: o.id }]); }
  if (s.casa.limpieza < 25 + resp * 35 && !yaHace('limpiarCasa')) opciones.push([45 + resp * 15, 'limpiarCasa']);
  if (R.lana >= 4 && R.abrigos < humanos(s).length + (e >= 2 ? 0 : -1) && !yaHace('tejer')) opciones.push([e >= 2 ? 48 : 30, 'tejer']);
  if (R.potable < consumoAgua(s) * (3 + resp * 4) && R.cruda >= 30 && !yaHace('filtrar')) opciones.push([40, 'filtrar']);
  { const g = s.ganado.filter((x) => x.vivo && (x.estres || 0) > 45 && !x.enfermo && !esAve(x.tipo) && !(x.cepillado > s.t)).sort((x, y) => y.estres - x.estres)[0]; if (g && !yaHace('cepillar')) opciones.push([s.politica?.cepillarHasta > s.t ? 88 : g.estres > 70 ? 74 : 48, 'cepillar', { animal: g.id }]); }
  { const g = s.ganado.find((x) => x.vivo && x.enfermo > 0); if (g && !yaHace('curar')) opciones.push([g.salud < 50 ? 88 : 62, 'curar', { animal: g.id }]); }
  { const f = (s.frutales || []).filter((x) => x.fruta >= 6).sort((x, y) => y.fruta - x.fruta)[0]; if (f && !yaHace('recogerFruta')) opciones.push([f.fruta >= 11 ? 68 : 54, 'recogerFruta', { arbol: f.id }]); }
  { const uvas = s.parras.reduce((t, q) => t + q.uvas, 0); if (uvas >= 14 && !yaHace('vendimia')) opciones.push([uvas >= 40 ? 70 : 52, 'vendimia']); }
  if (R.uvas >= 10 && !yaHace('pisarUva') && !dilemaDe(s, 'uva')) opciones.push([R.uvas >= 30 ? 64 : 46, 'pisarUva']);
  if (s.matas.some((m) => m.estado === 'lista') && !yaHace('cosecharHierba')) opciones.push([58, 'cosecharHierba']);
  { const V = s.comercio.visita; if (V && V.llego && !V.hecho && h >= 8 && h < 17 && !yaHace('comerciar') && !dilemaDe(s, 'venta')) opciones.push([62 + (tiene(a, 'ahorradora') ? 10 : 0) + P5(a, 'extraversion') * 8, 'comerciar']); }
  // conservar la comida
  // (la despensa tiene un límite: frascos, quesos y secos solo hasta llenarla)
  if (R.leche >= 6 && (R.queso || 0) < CAPACIDAD.queso && !yaHace('hacerQueso')) opciones.push([58, 'hacerQueso']);
  if (R.raciones > 70 && (e === 2 || R.raciones > 140) && (R.conservas || 0) < CAPACIDAD.conservas && !yaHace('hacerConservas')) opciones.push([44 + (e === 2 ? 10 : 0), 'hacerConservas']);
  if (obra(s, 'secadero') && R.raciones > 50 && (R.secos || 0) < CAPACIDAD.secos && e !== 3 && !llueve && h > 8 && h < 16 && !yaHace('secar')) opciones.push([36, 'secar']);
  // la obra de la casa: la hace quien sepa (con ayuda de quien esté libre)
  if (s.casa.obra && !yaHace('renovar')) opciones.push([46 + (tiene(a, 'manitas') ? 16 : 0), 'renovar']);
  // obras de Andrés (o de quien tenga el oficio)
  { const o = (s.obras || []).find((x) => x.id === s.politica?.obra && x.progreso < 1) || (s.obras || []).find((x) => x.progreso < 1);
    if (o && !yaHace('construir') && (tiene(a, 'manitas') || nivel(a.xp.carpinteria) >= 3)) opciones.push([34 + (tiene(a, 'manitas') ? 14 : 0) + (o.id === 'bodega' && R.raciones > 120 ? 10 : 0), 'construir', { obra: o.id }]); }
  // caminos: Andrés (o quien sepa) empiedra donde más se camina
  { const c = caminoPendiente(s); if (c && !llueve && h >= 7 && h < 18 && e !== 3 && diasVividos(s) >= 3 && !yaHace('empedrar') && (tiene(a, 'manitas') || a.heredero))   // es cosa de Andrés (el manitas)
    opciones.push([24 + Math.min(12, (s.caminos[c.id].uso || 0) / 25), 'empedrar', { tramo: c.id }]); }
  // jardines de María
  { const j = (s.jardines || []).filter((x) => x.cuidado < 0.85).sort((x, y) => x.cuidado - y.cuidado)[0];
    if (j && e !== 3 && !yaHace('cuidarJardin') && (tiene(a, 'manoVerde') || tiene(a, 'romantico'))) opciones.push([30 + (tiene(a, 'manoVerde') ? 12 : 0) + (j.cuidado < 0.3 ? 12 : 0), 'cuidarJardin', { jardin: j.id }]); }
  if (s.casa.estado < 55 + resp * 20 && !yaHace('reparar')) opciones.push([s.casa.estado < 35 ? 82 : 46 + (tiene(a, 'manitas') ? 14 : 0), 'reparar']);
  const henoMeta = 50 + 32 * enCorral(s);
  if (s.granja.pasto >= 50 && (e === 1 || e === 2) && R.heno < henoMeta && !yaHace('segar')) opciones.push([R.heno < henoMeta * 0.75 && e === 2 ? 66 : 40, 'segar']);
  if (R.cruda < 150 + resp * 200 && !yaHace('sacarAgua') && e !== 0) opciones.push([35, 'sacarAgua']);
  opciones.push(...opcionesUrgentes);
  if (s.pozoRoto) for (let i = opciones.length - 1; i >= 0; i--) if (opciones[i][1] === 'sacarAgua') opciones.splice(i, 1);   // con el pozo roto no se saca agua
  const trabajoValido = opciones.filter((o) => (!llueve || ['filtrar', 'limpiarCasa', 'tejer', 'reparar'].includes(o[1]) || o[0] >= 92) && (!(a.diaLibre > s.t) || o[0] >= 90));

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
    if ((e !== 3 || casaTiene(s, 'jacuzzi')) && h >= 9 && h < 19) ocio.push([necesitaOcio * gusto('nadar') * (calor(s) ? 2.2 : 0.8) * exterior, 'nadar']);
  }
  if (otro && libreParaPareja(s, otro) && !irritable(a)) ocio.push([necesitaSocial * 1.2, 'conversar']);
  if (h >= 13 && h < 15.5 && n.energia < 60) ocio.push([(60 - n.energia) * (calor(s) ? 1.6 : 1) * (tiene(a, 'hiperactivo') ? 0.3 : 1), 'siesta']);
  // arte: Andrés talla esculturas en su tiempo libre; María cuida sus flores por gusto
  if (tiene(a, 'manitas') && exterior && (s.esculturas || 0) < ESCULTURAS.length) ocio.push([necesitaOcio * 1.2, 'esculpir']);
  if (tiene(a, 'manoVerde') && exterior && e !== 3) { const j = [...(s.jardines || [])].sort((x, y) => x.cuidado - y.cuidado)[0]; if (j) ocio.push([necesitaOcio * 1.3, 'cuidarJardin', j.id]); }
  // alma romántica: recoge flores para regalar (primavera y verano)
  if (tiene(a, 'romantico') && otro && exterior && e <= 1 && s.t - (a.ultimoRegalo || -1e9) > 7 * MIN_DIA) ocio.push([20 + (100 - s.pareja.afinidad) * 0.5 + (otro.deseo?.id === 'regalo' ? 25 : 0), 'recogerFlores']);
  // entrenar (la forma física se gana y se pierde) y hornear (con cocina moderna u horno)
  if (n.energia > 45 && h >= 6.5 && h < 20) ocio.push([necesitaOcio * gusto('entrenar') * (0.35 + (100 - (a.forma ?? 40)) / 200) * (casaTiene(s, 'gimnasio') ? 1.2 : 1), 'entrenar']);
  if ((casaTiene(s, 'cocina') || obra(s, 'horno')) && R.raciones >= 40 && s.ultimoHorneo !== dia(s) && h >= 9 && h < 20) ocio.push([necesitaOcio * gusto('hornear') * 0.9, 'hornear']);
  // placeres: vino al atardecer y en la noche; la hierba en cualquier rato libre (nunca de madrugada ni con hambre)
  for (const k of ['vino', 'hierba']) {
    const P = a.placer?.[k], gustoP = HAB(a).placeres?.[k] ?? 0;
    if (!P || gustoP <= 0 || (R[k] || 0) < (k === 'vino' ? 0.25 : 0.5) || n.comida < 30) continue;
    if (k === 'vino' && a.tomarHoy && h >= 18.5 && h < 23) { a.tomarHoy = false; ocio.push([200, 'tomarVino']); continue; }
    const horaOk = k === 'vino' ? h >= 18.5 && h < 23 : h >= 10 && h < 23;
    if (!horaOk) continue;
    const dias = (s.t - P.ult) / MIN_DIA;
    let ganas = Math.min(1.5, dias / 2) + P.dep;
    if (a.animo < 58) ganas += (58 - a.animo) / 18;                    // tomar (o fumar) para olvidar
    else if (dias < 1.5 && P.dep < 0.5) ganas *= 1 - resp * 0.5;     // autocontrol: ayer ya tomó, hoy no
    if (P.pausa > dia(s)) ganas *= 0.12;                                // lo está dejando (puede recaer)
    const animoBajo = a.animo < 45 ? 1.8 : a.animo < 60 ? 1.3 : 1;   // con el ánimo bajo dan más ganas: la espiral
    ocio.push([(necesitaOcio * 0.9 + necesitaSocial * (k === 'vino' ? 0.6 : 0.2) + 34) * gustoP * ganas * animoBajo * (s.comercio.visita && k === 'vino' ? 0.7 : 1), k === 'vino' ? 'tomarVino' : 'fumar']);
  }
  ocio.sort((x, y) => y[0] - x[0]);

  const rol = HAB(a).rol, rolOtro = otro && HAB(otro).rol;
  const otroLibre = otro && despierto(s, otro) && (!otro.tarea || OCIOS.includes(otro.tarea.tipo));
  trabajoValido.forEach((o) => {
    if (rol && AREA[o[1]] === rol) o[0] += 25;
    else if (otroLibre && rolOtro && AREA[o[1]] === rolOtro && o[0] < 95) o[0] -= 30;
  });
  const prio = s.prioridades?.[a.id];
  if (prio) for (let i = trabajoValido.length - 1; i >= 0; i--) {
    const o = trabajoValido[i], area = AREA[o[1]] || (['curarHerida'].includes(o[1]) ? 'cuidado' : ['apagarFuego', 'guardia'].includes(o[1]) ? null : null);
    const v = area ? prio[area] ?? 3 : 3;
    if (v === 0 && o[0] < 95) trabajoValido.splice(i, 1);
    else o[0] += { 1: 30, 2: 15, 3: 0, 4: -20 }[v] ?? 0;
  }
  trabajoValido.sort((x, y) => y[0] - x[0]);
  const trabajo = trabajoValido[0], gana = ocio[0];
  if (gana && gana[0] > 18 && (!trabajo || gana[0] > trabajo[0] * (0.55 + resp * 0.6))) {
    if (gana[1] === 'conversar') { if (invitar(s, a, 'conversar')) return a.tarea; }
    else if (gana[1] === 'tomarVino' || gana[1] === 'fumar') {
      const k = gana[1] === 'tomarVino' ? 'vino' : 'hierba', b = otro;
      // se invita a la pareja si también le gusta (el vino casi siempre se comparte)
      if (b && (HAB(b).placeres?.[k] ?? 0) > 0.3 && rng(s) < (k === 'vino' ? 0.75 : 0.4) && invitar(s, a, gana[1])) { a.ultimoOcio = gana[1]; return a.tarea; }
      a.ultimoOcio = gana[1]; return crearTarea(s, a, gana[1]);
    }
    else if (gana[1] !== a.ultimoOcio || gana[0] > 45) { a.ultimoOcio = gana[1]; if (gana[1] === 'cuidarJardin') return crearTarea(s, a, 'cuidarJardin', { jardin: gana[2] }); return iniciarOcio(s, a, gana[1]); }
  }
  if (trabajo) { const [, tipo, extra] = trabajo; return crearTarea(s, a, tipo, extra); }

  if (n.agua < 65 && R.potable >= 1) return crearTarea(s, a, 'beber');
  if (n.comida < 55 && comidaTotal(s) >= 1 && est !== 'raciona' && h > 11.5 && h < 13.5) return crearTarea(s, a, 'comer');
  const libres = ocio.filter((o) => !['conversar', 'siesta', 'cuidarJardin', 'tomarVino', 'fumar'].includes(o[1]));
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
  tejer: 'Tejiendo un abrigo', nadar: 'Nadando', reparar: 'Reparando la casa', curar: 'Curando a un animal', recogerFruta: 'Recogiendo fruta', construir: 'Construyendo', empedrar: 'Empedrando un camino', cepillar: 'Cepillando y calmando un animal', fumigar: 'Tratando una plaga', arrancar: 'Arrancando plantas enfermas', abonar: 'Abonando la tierra', voltearCompost: 'Volteando el compost', esculpir: 'Tallando una escultura', cuidarJardin: 'Cuidando el jardín', hacerConservas: 'Haciendo conservas', hacerQueso: 'Haciendo queso', secar: 'Secando fruta al sol', jugarJuntos: 'Jugando a perseguirse', explorar: 'Explorando', reconciliar: 'Haciendo las paces',
  recogerFlores: 'Recogiendo flores', jugarPerro: 'Jugando a la pelota', beberPiscina: 'Tomando agua de la piscina', apagarFuego: 'Apagando el fuego', guardia: 'Haciendo guardia', repararPozo: 'Reparando el pozo', defender: 'Defendiendo el ganado', reposo: 'Haciendo reposo', curarHerida: 'Curando una herida', deambular: 'Caminando sin rumbo', vendimia: 'Vendimiando', renovar: 'Construyendo un proyecto', entrenar: 'Entrenando', hornear: 'Horneando', pisarUva: 'Pisando uva en el lagar', cosecharHierba: 'Cosechando la hierba', tomarVino: 'Tomando vino', fumar: 'Fumando', comerciar: 'Haciendo trueque con el comerciante', vigilar: 'Vigilando el gallinero', pelota: 'Trae la pelota', regazo: 'En un regazo',
  seguir: 'Acompañando a la pareja', robarComida: 'Robando comida', beberPiscina: 'Tomando agua de la piscina', defender: 'Defendiendo el ganado', trepar: 'Trepado mirando todo', huir: 'Huyendo', molestarGallinas: 'Persiguiendo gallinas', perseguir: 'Persiguiendo al gato', pelea: 'Peleando', ladrar: 'Ladrando', cazar: 'Cazando ratones', dormirCon: 'Durmiendo acurrucado', pedir: 'Pidiendo atención', jugar: 'Jugando', pasear: 'De paseo', refugio: 'Refugiado de la lluvia',
};
const VA_A = {
  comer: 'Va a comer', beber: 'Va a beber', dormir: 'Va a dormir', filtrar: 'Va a filtrar agua', sacarAgua: 'Va al pozo',
  regar: 'Va a regar', sembrar: 'Va a sembrar', cosechar: 'Va a cosechar', limpiar: 'Va a limpiar una parcela', alimentar: 'Va a alimentar a las mascotas',
  descansar: 'Va a la banca', leer: 'Va a leer', tallar: 'Va a tallar madera', contemplar: 'Va a mirar el paisaje', jugarGato: 'Va a jugar con el gato',
  pasearPerro: 'Paseando al perro', conversar: 'Va a conversar', cocinar: 'Va a cocinar', cenar: 'Va a cenar', limpiarCasa: 'Va a limpiar la casa', siesta: 'Va a la siesta',
  ordenar: 'Va a ordeñar', recogerHuevos: 'Va al gallinero', esquilar: 'Va a esquilar', segar: 'Va a segar', alimentarGanado: 'Va al pesebre', tejer: 'Va a tejer', nadar: 'Va a la piscina',
  reparar: 'Va al taller a reparar', curar: 'Va a curar un animal', recogerFruta: 'Va a los frutales', construir: 'Va a la obra', cepillar: 'Va a calmar un animal', fumigar: 'Va a tratar una plaga', abonar: 'Va a abonar', voltearCompost: 'Va al compost', esculpir: 'Va al taller a esculpir', cuidarJardin: 'Va al jardín', secar: 'Va al secadero', reconciliar: 'Va a hacer las paces', recogerFlores: 'Va a recoger flores', jugarPerro: 'Va a jugar con el perro', apagarFuego: 'Corre a apagar el fuego', guardia: 'Va a hacer guardia', repararPozo: 'Va a reparar el pozo', curarHerida: 'Va a curar a alguien', deambular: 'Se va caminando', vendimia: 'Va al viñedo', renovar: 'Va a la obra', entrenar: 'Va a entrenar', hornear: 'Va a hornear', pisarUva: 'Va al lagar', cosecharHierba: 'Va a la huerta de hierbas', tomarVino: 'Va a servir vino', fumar: 'Va a fumar', comerciar: 'Va a la carreta del comerciante',
};

const OCIO_LLENA = { entrenar: 0.8, hornear: 0.8, tomarVino: 0.9, fumar: 1.0, cuidarJardin: 0.7, esculpir: 0.6, leer: 0.7, tallar: 0.75, contemplar: 0.8, jugarGato: 1.1, descansar: 0.35, siesta: 0.3, tejer: 0.6, nadar: 1.1, recogerFlores: 0.8, jugarPerro: 1.2 };
function comportamiento(s, a, d) {
  if (a.tipo === 'nino') return comportamientoHijo(s, a, d);
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
  if (a.resacaDesde && s.t >= a.resacaDesde && despierto(s, a)) {
    const fuerte = a.resacaCopas >= 4;
    recuerdo(s, a, 'Resaca', fuerte ? -12 : -7, 8);
    a.n.agua = Math.max(0, a.n.agua - 15); a.resacaHasta = s.t + (fuerte ? 7 : 4) * 60; a.resacaDesde = 0;
    log(s, `🥴 ${a.nombre} amaneció con resaca${fuerte ? ' fuerte' : ''}: hoy rinde menos.`, 'malo');
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
      if (T.tipo === 'cepillar') { const g = s.ganado.find((x) => x.id === T.animal); if (g) g.quieta = s.t + T.trabajo + 2; }
      if (T.tipo === 'esquilar') { const o = s.ganado.find((g) => g.id === T.oveja); if (o) o.quieta = s.t + T.trabajo + 2; }
    }
    return;
  }
  if (T.tipo === 'dormir') {
    // el bebé llora de noche: se levanta quien tenga el turno (una noche cada uno)
    const llora = bebeLlora(s);
    if (llora && turnoNoche(s) === a && !s.agentes.some((x) => x.tarea?.tipo === 'cuidarBebe')) { soltarTarea(s, a); crearTarea(s, a, 'cuidarBebe', { bebe: llora.id, desvelo: true }); return; }
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
  const vel = area ? mod(a, area) * (1 + 0.06 * nivel(a.xp[area])) * (estres(s, a) === 'trabaja' ? 1.2 : 1) * (a.enfermo > 0 ? 0.6 : 1) * animoVel * (a.animo_buff > s.t ? 1.15 : 1)
    * (T.tipo === 'tejer' ? mod(a, 'tejer') : 1) * (1 - Math.min(0.6, severidad(a) * 0.6)) * (a.resacaHasta > s.t ? 0.7 : 1) * (a.colocadoHasta > s.t ? 0.8 : 1) * (herramienta(s, area) ? 1.12 : 1) * (0.92 + (a.forma ?? 40) / 600) : 1;
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
  if (OCIO_LLENA[T.tipo]) a.n.diversion = Math.min(100, a.n.diversion + OCIO_LLENA[T.tipo] * d * ((HAB(a).ocio || []).includes(T.tipo) ? 1.3 : 1) * (casaTiene(s, 'ampliacion') && ['leer', 'tejer', 'tallar'].includes(T.tipo) ? 1.2 : 1));
  if (T.tipo === 'siesta') a.n.energia = Math.min(100, a.n.energia + 0.2 * d);
  if (T.tipo === 'conversar' || T.tipo === 'cenar' || T.tipo === 'reconciliar' || (T.tipo === 'tomarVino' && T.cita != null) || T.tipo === 'comerciar') a.n.social = Math.min(100, a.n.social + 2.2 * d);
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
const herramienta = (s, area) => (s.comercio?.herramientas || []).some((h) => HERRAMIENTAS[h]?.[0] === area);
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
  accidente(s, a, T.tipo);
  switch (T.tipo) {
    case 'beberPiscina': a.n.agua = Math.min(100, a.n.agua + 35); if (rng(s) < 0.35 * mod(a, 'enfermar')) herir(s, a, 'intoxicacion', 0.2, 'cuerpo', 'por tomar agua de la piscina'); else if (rng(s) < 0.2) log(s, `${a.nombre} tuvo que tomar agua de la piscina: no queda otra.`, 'aviso'); break;
    case 'beber':
      if (R.potable >= 1) { R.potable -= 1; a.n.agua = Math.min(100, a.n.agua + 35); }
      else if (R.cruda >= 1) {
        R.cruda -= 1; a.n.agua = Math.min(100, a.n.agua + 35);
        if (rng(s) < 0.4 * mod(a, 'enfermar')) { a.n.salud = Math.max(1, a.n.salud - 15); log(s, `${a.nombre} tomó agua sin filtrar y se enfermó del estómago.`, 'malo'); }
      }
      break;
    case 'comer': {
      if (T.atracon) { for (let i = 0; i < 3; i++) consumirComida(s, a, 25); a.n.comida = Math.min(100, a.n.comida + 10); break; }
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
      const deChef = (chef && tiene(chef, 'chef') ? 2 : 0) + (casaTiene(s, 'cocina') ? 2 : 0);
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
        + (s.pareja.tension || 0) / 350 + (grunon ? 0.14 : 0) + ([a, otro].some((x) => tiene(x, 'malgenio')) ? 0.07 : 0) - ([a, otro].some((x) => tiene(x, 'tranquilo')) ? 0.05 : 0) - (casaTiene(s, 'terraza') ? 0.03 : 0) + ([a, otro].some((x) => x.borrachoHasta > s.t) ? 0.12 : 0) + ([a, otro].some((x) => x.resacaHasta > s.t) ? 0.05 : 0) + ([a, otro].some((x) => (x.deseoSex || 0) > 85) ? 0.04 : 0);
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
    case 'filtrar': { const l = Math.min((mejora(s, 'filtroDoble') ? 40 : 25) + (casaTiene(s, 'solar') ? 10 : 0), R.cruda); R.cruda -= l; R.potable += l; break; }
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
    case 'cepillar': { const g = s.ganado.find((x) => x.id === T.animal && x.vivo); if (g) { g.estres = Math.max(0, (g.estres || 0) - 25); g.cepillado = s.t + 12 * 60; g.quieta = 0; recuerdo(s, a, `Calmó a ${g.nombre}`, 3, 8); } break; }
    case 'fumigar': if (p) { const tipo = p.plagaTipo; p.plaga = Math.max(0, p.plaga - 0.55); if (!p.plaga) p.plagaTipo = null; log(s, `${a.nombre} trató la parcela ${p.id + 1} con ${tipo === 'hongo' ? 'caldo de ceniza' : 'purín de ortiga'}.`, 'info'); } break;
    case 'arrancar': if (p) { p.estado = 'muerta'; p.ultimo = p.cultivo; p.plaga = 0; log(s, `${a.nombre} arrancó las plantas enfermas de la parcela ${p.id + 1} para que no contagien.`, 'aviso'); recuerdo(s, a, 'Tuvo que arrancar plantas enfermas', -4, 12); } break;
    case 'abonar': if (p && (R.compost || 0) >= 4) { R.compost -= 4; p.N = Math.min(100, p.N + 20); p.P = Math.min(100, p.P + 7); p.K = Math.min(100, p.K + 18); if ((R.ceniza || 0) >= 2 && p.ph < 6.3) { R.ceniza -= 2; p.ph = Math.min(7.2, p.ph + 0.35); } } break;
    case 'voltearCompost': s.ultimoVolteo = dia(s); recuerdo(s, a, 'Olor a tierra buena', 1, 4); break;
    case 'alimentar':
      if (R.comedero < 2) {   // si no hay fresco, de lo guardado (secos, conservas, queso, huevos)
        let falta = 2 - R.comedero;
        for (const k of ['raciones', 'secos', 'conservas', 'huevos', 'queso']) { const c = Math.min(falta, R[k] || 0); if (c > 0) { R[k] -= c; R.comedero += c; falta -= c; } if (falta <= 0) break; }
      }
      if (R.cruda >= 1 && R.bebedero < 6) { const l = Math.min(6 - R.bebedero, R.cruda); R.cruda -= l; R.bebedero += l; }
      for (const m of s.agentes) if (m.vivo && esMascota(m)) vincular(s, m, a, 0.5);
      break;
    case 'ordenar': { const v = vaca(s); if (v) { const l = Math.round(v.ubre * (mejora(s, 'ordenoExperto') ? 12 : 10)) / 10; R.leche += l; s.stats.leche += l; v.ubre = 0; v.quieta = 0; log(s, `${a.nombre} ordeñó a ${v.nombre}: ${l.toFixed(1)} L de leche.`, 'bueno'); } break; }
    case 'cuidarBebe': {
      const b = s.agentes.find((x) => x.id === T.bebe && x.vivo); if (!b) break;
      // solo se gasta comida y agua si el bebé de verdad tiene hambre o sed (si no, son mimos)
      if (b.n.comida < 75 && !consumirComida(s, b, 50)) log(s, `${a.nombre} no tuvo con qué alimentar a ${b.nombre}: no queda comida.`, 'aviso');
      if (b.n.agua < 75) { if (R.potable >= 0.5) { R.potable -= 0.5; b.n.agua = Math.min(100, b.n.agua + 55); } else if (R.cruda >= 0.5) { R.cruda -= 0.5; b.n.agua = Math.min(100, b.n.agua + 45); } }
      b.n.social = Math.min(100, b.n.social + 50); b.n.diversion = Math.min(100, b.n.diversion + 35);
      a.xp.cuidado = (a.xp.cuidado || 0) + 10; a.n.social = Math.min(100, a.n.social + 10);
      recuerdo(s, a, `Cuidó a ${b.nombre}`, 5, 8);
      if (T.desvelo) { a.n.energia = Math.max(0, a.n.energia - 6); recuerdo(s, a, `Desvelo con ${b.nombre}`, -3, 10); }
      break;
    }
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
    case 'empedrar': {
      const c = CAMINOS.find((x) => x.id === T.tramo), C = s.caminos?.[T.tramo]; if (!c || !C || C.progreso >= 1) break;
      if (C.progreso === 0) log(s, `🪨 ${a.nombre} empezó a empedrar ${c.nombre}${C.uso > 30 ? ': es por donde más pasan' : ''}.`, 'info');
      C.progreso = Math.min(1, C.progreso + (DURACION.empedrar / 480) / largoCamino(c) *   // ~8 horas de trabajo por cada metro de camino: cada uno le lleva varios días
         mod(a, 'carpinteria') * (1 + 0.05 * nivel(a.xp.carpinteria)));
      if (C.progreso >= 1) {
        log(s, `🪨 ${a.nombre} terminó ${c.nombre}: ahora por ahí se camina más rápido y sin barro.`, 'logro');
        recuerdo(s, a, `Terminó ${c.nombre}`, 8, 24); memoria(s, a, `Empedró ${c.nombre}`, 1);
        for (const h of humanos(s)) if (h !== a) recuerdo(s, h, `${a.nombre} hizo ${c.nombre}`, 4, 12);
        refrescarCaminos(s);
      }
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
          const quedan = s.obras.filter((x) => x.progreso < 1).slice(0, 3);
          if (quedan.length > 2) proponer(s, 'obra', '¿Qué construye Andrés ahora?', 'Terminó una obra. Elige la próxima.', [...quedan.map((x) => ({ k: x.id, txt: x.nombre[0].toUpperCase() + x.nombre.slice(1), pista: OBRAS.find((y) => y[0] === x.id)[5] })), { k: 'libre', txt: 'La que él quiera', pista: '' }], 'libre', {}, 12, 3);
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
      if (R.cruda >= 80 && !s.sequia) R.cruda -= 4;   // riega (con el tanque bajo o en sequía, no)
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
    case 'vendimia': {
      const n = Math.round(s.parras.reduce((t, q) => t + q.uvas, 0) * (1 + 0.03 * nivel(a.xp.huerto)));
      s.parras.forEach((q) => { q.uvas = 0; });
      R.uvas += n; s.stats.uvas = (s.stats.uvas || 0) + n;
      log(s, `🍇 ${a.nombre} hizo la vendimia: ${n} canastos de uva.`, 'bueno'); recuerdo(s, a, 'La vendimia', 5, 12);
      if (R.uvas >= 20) proponer(s, 'uva', `Vendimia: ${Math.round(R.uvas)} canastos de uva`, 'La uva se pisa para vino (un mes de fermentación) o se aprovecha de otra forma.', [
        { k: 'vino', txt: 'Todo para vino', pista: 'para tomar y vender' },
        { k: 'fresca', txt: 'Mitad fresca para comer', pista: 'más comida ahora, menos vino' },
        { k: 'pasas', txt: 'Mitad en pasas', pista: 'duran todo el invierno' },
      ], 'vino', {}, 6, 20);
      break;
    }
    case 'pisarUva': {
      const rinde = casaTiene(s, 'bodegaVino') ? 2.0 : 2.5, botellas = Math.floor(R.uvas / rinde);
      if (botellas > 0) {
        R.uvas -= botellas * rinde;
        s.barricas.push({ botellas, listo: dia(s) + 30 });
        log(s, `🦶 ${a.nombre} pisó la uva en el lagar: el mosto fermentará un mes (${botellas} botellas).`, 'info');
        recuerdo(s, a, 'Pisó uva en el lagar', 5, 10);
      }
      break;
    }
    case 'cosecharHierba': {
      const m = s.matas.filter((x) => x.estado === 'lista');
      const cant = Math.round(m.length * (4 + rng(s) * 3) * (1 + 0.03 * nivel(a.xp.huerto)) * (casaTiene(s, 'cultivoPro') ? 1.3 : 1));
      m.forEach((x) => { x.estado = 'vacia'; x.crec = 0; });
      s.curado.push({ cant, listo: dia(s) + (casaTiene(s, 'cultivoPro') ? 10 : 14) });
      log(s, `🌿 ${a.nombre} cosechó las matas y colgó los cogollos a secar (${cant} porciones, dos semanas).`, 'info');
      break;
    }
    case 'tomarVino': case 'fumar': consumirPlacer(s, a, T); if (a.borrachera) { a.borrachera = false; consumirPlacer(s, a, T); } break;
    case 'curarHerida': {
      const p = s.agentes.find((x) => x.id === T.paciente && x.vivo); if (!p) break;
      const conMedicina = false;   // la medicina se usa solo si el jugador lo decide (dilema de tratamiento)
      if (conMedicina) R.medicina -= 1;
      const habil = 0.6 + nivel(a.xp.cuidado) * 0.06 + (conMedicina ? 0.3 : 0) - (p === a ? 0.2 : 0);
      for (const h of p.heridas || []) { h.curadaT = s.t; if (h.tipo !== 'fiebre') h.tratada = true; h.infeccion = Math.max(0, h.infeccion - 0.25 * habil); }   // vendan y limpian; la fiebre necesita algo más
      log(s, `🩹 ${a.nombre} ${p === a ? 'se curó a sí mismo' : `curó a ${p.nombre}`}${conMedicina ? ' con medicina' : ' con lo que había'}.`, 'bueno');
      if (p !== a) { if (p.tipo === 'humano') { recuerdo(s, p, `${a.nombre} me cuidó`, 6, 24); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 2); } else vincular(s, p, a, 5); }
      break;
    }
    case 'apagarFuego': {
      const F = (s.fuegos || []).find((x) => x.id === T.fuego) || s.fuegos?.[0]; if (!F) break;
      const fuente = R.cruda >= 55 ? 'cruda' : R.bebederoGanado >= 25 ? 'bebederoGanado' : null;
      if (!fuente) { if (!s.avisoSinAgua) { s.avisoSinAgua = true; log(s, '🔥 No queda agua de sobra para apagar el fuego: hay que guardarla para beber.', 'aviso'); } break; }
      R[fuente] = Math.max(0, R[fuente] - 15);
      F.intensidad = Math.max(0, F.intensidad - 0.28 * (1 + nivel(a.xp.agua) * 0.05));
      if (rng(s) < 0.05 * F.intensidad) herir(s, a, 'quemadura', 0.2 + 0.25 * F.intensidad, 'brazo', 'apagando el fuego');
      if (F.intensidad > 0 && (R.cruda >= 55 || R.bebederoGanado >= 25)) { crearTarea(s, a, 'apagarFuego', { fuego: F.id }); return; }   // sigue con el próximo balde
      break;
    }
    case 'guardia': if (s.lobos) { crearTarea(s, a, 'guardia'); return; } break;
    case 'repararPozo': if (s.pozoRoto) { s.pozoRoto.avance += 0.25 * mod(a, 'carpinteria'); if (s.pozoRoto.avance >= 1) { s.pozoRoto = false; log(s, `🔧 ${a.nombre} reparó el pozo: ya se puede sacar agua.`, 'bueno'); recuerdo(s, a, 'Arreglé el pozo', 6, 24); } } break;
    case 'reposo': if (T.quiebre) a.n.diversion = Math.min(100, a.n.diversion + 5); break;
    case 'deambular': a.n.diversion = Math.min(100, a.n.diversion + 8); break;
    case 'entrenar': {
      const gym = casaTiene(s, 'gimnasio');
      a.forma = Math.min(100, (a.forma ?? 40) + 1.4 * (gym ? 1.4 : 1) * (1 - (a.forma ?? 40) / 140)); s.stats.entreno = (s.stats.entreno || 0) + 1;
      a.n.energia = Math.max(0, a.n.energia - 12); a.n.salud = Math.min(100, a.n.salud + 1.5);
      recuerdo(s, a, 'Entrenó', 3 + (gym ? 1 : 0), 8);
      if (a.forma >= 80 && !a.avisoForma) { a.avisoForma = true; log(s, `💪 ${a.nombre} está en muy buena forma.`, 'logro'); }
      break;
    }
    case 'hornear': {
      if (R.raciones < 2) break;
      R.raciones -= 2; if (R.huevos >= 1) R.huevos -= 1; if (R.leche >= 0.5) R.leche -= 0.5; s.ultimoHorneo = dia(s);
      const que = ['pan', 'un pastel de manzana', 'galletas', 'un bizcocho', 'empanadas'][Math.floor(rng(s) * 5)];
      for (const h2 of humanos(s)) { h2.n.comida = Math.min(100, h2.n.comida + 10); recuerdo(s, h2, h2 === a ? 'Horneó algo rico' : `${a.nombre} horneó algo rico`, 3, 10); }
      if (rng(s) < 0.35) log(s, `🥧 ${a.nombre} horneó ${que}: la casa huele delicioso.`, 'info');
      break;
    }
    case 'renovar': {
      const O = s.casa.obra; if (!O) break;
      const M = MEJORAS_CASA.find((x) => x[0] === O.id) || ['reforma', 'la reforma de estilo', 0, 90, 'la granja cambia de estilo', []];
      O.progreso = Math.min(1, O.progreso + (DURACION.renovar / 60) / M[3] * mod(a, 'carpinteria') * (1 + 0.05 * nivel(a.xp.carpinteria)) * (herramienta(s, 'carpinteria') ? 1.12 : 1));
      if (O.progreso >= 1) {
        if (O.id !== 'reforma') s.casa.mejoras.push(O.id); s.casa.obra = null;
        if (O.id === 'vinedo') for (let i = s.parras.length; i < PARRAS.length; i++) s.parras.push({ id: i, ...PARRAS[i], uvas: 0 });
        if (O.id === 'cultivoCaseta') s.matas.forEach((m) => { if (m.estado === 'vacia') { m.estado = 'creciendo'; m.crec = 0; } });
        if (O.id === 'reforma' && O.estilo) { s.casa.estilo = O.estilo; log(s, `🎨 La granja ahora es de estilo ${ESTILOS[O.estilo].nombre.toLowerCase()}.`, 'logro'); }
        aplicarProyectos(s);
        log(s, `🏠 Terminaron ${M[1]}: ${M[4]}.${DE_CASA.includes(O.id) ? ` La casa va en la etapa ${etapaCasa(s)} de 4.` : ''}`, 'logro');
        for (const h of humanos(s)) { recuerdo(s, h, `Estrenaron ${M[1]}`, 10, 48); memoria(s, h, `Construyeron ${M[1]}`, 0.5); }
      }
      break;
    }
    case 'comerciar': comerciar(s, a); break;
    case 'nadar': a.nadando = false; a.pos = { ...LUGAR.piscina }; recuerdo(s, a, casaTiene(s, 'jacuzzi') && estacion(s) === 3 ? 'Jacuzzi caliente en invierno' : 'Un buen chapuzón', 5 + (casaTiene(s, 'piscina') ? 2 : 0) + (casaTiene(s, 'jacuzzi') ? 2 : 0), 8); break;
    case 'leer': case 'tallar': case 'contemplar': {
      if (T.tipo === 'leer' && R.libros > (a.librosLeidos || 0)) { a.librosLeidos = (a.librosLeidos || 0) + 0.25; recuerdo(s, a, 'Un libro nuevo', 5, 12); }
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

// ---------------------------------------------------------------- placeres: vino y hierba, con tolerancia, resaca y dependencia
function consumirPlacer(s, a, T) {
  const R = s.rec, vino = T.tipo === 'tomarVino', k = vino ? 'vino' : 'hierba', P = a.placer[k];
  const otro = pareja(s, a), juntos = T.cita != null && otro?.tarea?.cita === T.cita;
  let dosis;
  if (vino) {
    // copas: más si está triste, si depende o si se anima la noche
    const copas = 1 + (rng(s) < 0.55 ? 1 : 0) + (a.animo < 45 ? 1 : 0) + (P.dep > 0.5 ? 1 : 0) + (rng(s) < 0.12 + P.dep * 0.2 ? 1 : 0);
    dosis = Math.min(copas, Math.floor(R.vino / 0.25));
    if (dosis <= 0) return;
    R.vino -= dosis * 0.25;
    if (dosis >= 3) { a.resacaDesde = s.t + 7 * 60; a.resacaCopas = dosis; a.borrachoHasta = s.t + 150; }
    if (dosis >= 4) a.n.salud = Math.max(1, a.n.salud - 3);
    a.vinoT = s.t;
  } else {
    dosis = 1;
    if (R.hierba < 0.5) return;
    R.hierba -= 0.5;
    a.colocadoHasta = s.t + 180;
  }
  const dias = (s.t - P.ult) / MIN_DIA;
  const efecto = (vino ? (juntos ? 12 : 8) + Math.min(3, dosis) : 12) / (1 + P.tol);
  if (!vino && P5(a, 'neuroticismo') > 0.5 && rng(s) < 0.12 + P.tol * 0.05) {
    recuerdo(s, a, 'Se puso paranoico', -6, 4);
    if (rng(s) < 0.5) log(s, `😵‍💫 A ${a.nombre} la hierba le cayó mal: le dio paranoia un rato.`, 'malo');
  } else recuerdo(s, a, vino ? (juntos ? 'Vino en pareja' : 'Una copa de vino') : 'Fumó y se relajó', Math.round(efecto), vino ? 8 : 6);
  a.n.diversion = Math.min(100, a.n.diversion + (vino ? 15 : 25));
  // tolerancia y dependencia: crecen con el uso frecuente, la tristeza y la ansiedad
  P.tol = Math.min(2, P.tol + (vino ? 0.06 * dosis : 0.12));
  P.dep = Math.min(1, P.dep + 0.013 * (HAB(a).placeres?.[k] ?? 0.5) * (dias < 2 ? 1.4 : 0.4) * (a.animo < 45 ? 2.4 : a.animo < 58 ? 1.7 : 1) * (0.6 + P5(a, 'neuroticismo')) * (vino ? Math.max(1, dosis / 2) : 1));
  P.ult = s.t; P.usos += 1; s.stats[k] = (s.stats[k] || 0) + 1;
  if (P.pausa > dia(s)) { P.pausa = 0; P.recaidas = (P.recaidas || 0) + 1; log(s, `${a.nombre} recayó: volvió ${vino ? 'al vino' : 'a fumar'}.`, 'malo'); recuerdo(s, a, 'Recayó', -6, 24); }
  if (juntos && s.pareja.placerResuelto !== T.cita) { s.pareja.placerResuelto = T.cita; s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1); }
  if (vino && dosis >= 4 && rng(s) < 0.6) log(s, `🍷 ${a.nombre} se tomó ${dosis} copas${juntos ? '' : ' a solas'}: mañana lo va a sentir.`, 'aviso');
  else if (rng(s) < 0.25) log(s, vino ? `🍷 ${juntos ? `${a.nombre} y ${otro.nombre} se tomaron una copa juntos` : `${a.nombre} se sirvió una copa de vino`}.` : `🌿 ${a.nombre} se fumó un porro${juntos ? ` con ${otro.nombre}` : ''} y se relajó.`, 'info');
}
function placeresDelDia(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION, R = s.rec;
  // viñedo: las uvas pintan a fin de verano y maduran en otoño; si nadie vendimia, se pasan
  for (const q of s.parras) {
    if ((e === 1 && dE >= 14) || (e === 2 && dE < 16)) q.uvas = Math.min(16, q.uvas + (0.9 + rng(s) * 0.6) * (1 + polinizacion(s) * 0.2) * (s.sequia > 0 ? 0.6 : 1));
    else q.uvas *= 0.7;
  }
  R.uvas *= 0.93;   // la uva cosechada se pudre si no se pisa
  // matas: crecen en primavera y verano, florecen en otoño; el invierno las mata
  for (const m of s.matas) {
    const caseta = casaTiene(s, 'cultivoCaseta'), pro = casaTiene(s, 'cultivoPro');
    if ((e === 0 && dE === 0 || caseta) && m.estado === 'vacia') { m.estado = 'creciendo'; m.crec = 0; }
    if (m.estado === 'creciendo' && (e === 0 || e === 1 || caseta)) m.crec = Math.min(1, m.crec + 1 / 44 * (s.sequia > 0 && !caseta ? 0.6 : 1) * (pro ? 1.4 : 1));
    if (m.estado === 'creciendo' && (e === 2 || caseta) && m.crec >= (caseta ? 1 : 0.9)) { m.estado = 'lista'; log(s, '🌿 Las matas de la huerta de hierbas florecieron: ya se pueden cosechar.', 'info'); }
    if (e === 3 && m.estado !== 'vacia' && !caseta) { if (m.estado === 'lista') log(s, 'Las heladas quemaron las matas que nadie cosechó.', 'aviso'); m.estado = 'vacia'; m.crec = 0; }
  }
  // fermentación y secado
  for (const b of s.barricas.filter((x) => dia(s) >= x.listo)) { R.vino = Math.min(120, R.vino + b.botellas); log(s, `🍷 El vino terminó de fermentar: ${b.botellas} botellas nuevas en la bodega.`, 'bueno'); }
  s.barricas = s.barricas.filter((x) => dia(s) < x.listo);
  for (const c of s.curado.filter((x) => dia(s) >= x.listo)) { R.hierba = Math.min(80, R.hierba + c.cant); log(s, `🌿 La hierba quedó seca y curada: ${c.cant} porciones guardadas.`, 'info'); }
  s.curado = s.curado.filter((x) => dia(s) < x.listo);
  // en las personas: la tolerancia baja, la dependencia se cura sola si pasan días sin consumir… o pide más
  for (const a of humanos(s)) {
    for (const k of ['vino', 'hierba']) {
      const P = a.placer[k], dias = (s.t - P.ult) / MIN_DIA;
      P.tol *= 0.9;
      P.dep = Math.max(0, P.dep - (dias > 3 ? 0.025 : 0.006));
      // la pareja nota el exceso y lo habla; a veces decide dejarlo un tiempo
      const b = pareja(s, a);
      if (P.dep > 0.45 && !(P.pausa > dia(s)) && b && rng(s) < 0.05 * (P5(a, 'responsabilidad') + P5(b, 'amabilidad'))) {
        P.pausa = dia(s) + 14 + Math.floor(rng(s) * 21);
        log(s, `${b.nombre} habló con ${a.nombre} sobre ${k === 'vino' ? 'el trago' : 'la hierba'}: ${a.nombre} decidió dejarlo por un tiempo.`, 'info');
        recuerdo(s, b, 'Le preocupa, pero hablaron', -2, 24); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1);
      }
      if (P.dep > 0.3 && dias > 1.5) {
        recuerdo(s, a, `Ganas de ${k === 'vino' ? 'un trago' : 'fumar'}`, -Math.round(P.dep * 14), 24);
        if ((R[k] || 0) < 0.5 && P.dep > 0.5 && rng(s) < 0.3) log(s, `${a.nombre} anda con ansiedad: no queda ${k === 'vino' ? 'vino' : 'hierba'} y le hace falta.`, 'aviso');
      }
      if (P.dep > 0.6 && !P.aviso) {
        P.aviso = true;
        log(s, `⚠️ ${a.nombre} ya depende ${k === 'vino' ? 'del vino' : 'de la hierba'}: consume casi a diario.`, 'malo');
        const b = pareja(s, a);
        if (b) { recuerdo(s, b, `Preocupación por ${a.nombre}`, -8, 72); s.pareja.tension = Math.min(100, (s.pareja.tension || 0) + 15); }
      }
      if (P.dep < 0.3) P.aviso = false;
      if (k === 'vino' && P.dep > 0.6) a.n.salud = Math.max(1, a.n.salud - 1.5);   // el hígado lo resiente
    }
    // deseo sexual: crece con los días, con la afinidad; la tensión lo apaga
    a.deseoSex = Math.max(0, Math.min(100, (a.deseoSex ?? 40) + 9 * (HAB(a).libido ?? 1) * (0.5 + s.pareja.afinidad / 100) - (s.pareja.tension || 0) / 10));
    if (a.deseoSex > 85 && s.pareja.afinidad > 30) recuerdo(s, a, 'Deseo insatisfecho', -5, 24);
  }
}

// ---------------------------------------------------------------- el comerciante: llega cada dos semanas y hace trueque
export const COMERCIANTE = 'Don Ramiro';
function comercioDelDia(s) {
  const C = s.comercio, d = dia(s), e = estacion(s);
  if (C.visita && C.visita.dia < d) { C.visita = null; C.proxima = d + 6 + Math.floor(rng(s) * 4); }   // (por si quedó abierta)
  if (!C.visita && d === C.proxima - 1) log(s, `🛒 Mañana a las 8 llega ${COMERCIANTE} con su carreta.`, 'info');
  if (C.visita || d < C.proxima) return;
  if (e === 3 && rng(s) < 0.4) { C.proxima = d + 7; log(s, `El camino está helado: ${COMERCIANTE} no pudo venir esta semana.`, 'clima'); return; }
  // precios del día: base × estación × (lo que ya le vendieron) × azar
  for (const k of Object.keys(C.vendido)) C.vendido[k] *= 0.6;
  const precios = {};
  for (const [k, m] of Object.entries(MERCADO)) precios[k] = Math.round(m.base * m.est[e] / (1 + (C.vendido[k] || 0) / 25) * (0.8 + rng(s) * 0.4) * 100) / 100;
  C.visita = { dia: d, llega: d * MIN_DIA + 8 * 60, sale: d * MIN_DIA + 17 * 60, precios, hecho: false, bolsa: Math.round(90 + rng(s) * 80) }; C.visitas += 1;
  const caro = Object.entries(precios).sort((x, y) => y[1] / MERCADO[y[0]].base - x[1] / MERCADO[x[0]].base)[0][0];
  C.visita.caro = caro;
}
function comercioTick(s) {
  const C = s.comercio, V = C.visita; if (!V) return;
  if (V.llega && s.t >= V.llega && !V.llego) {
    V.llego = true; const caro = V.caro, precios = V.precios;
  log(s, `🛒 Llegó ${COMERCIANTE} con su carreta. Hoy paga bien ${MERCADO[caro].nombre}.`, 'info');
  proponer(s, 'venta', `${COMERCIANTE} llegó a la granja`, `Hoy paga bien ${MERCADO[caro].nombre} (${precios[caro]} monedas). Vino a ${precios.vino}, hierba a ${precios.hierba}. Tienen ${Math.round(C.monedas)} monedas ahorradas.`, [
    { k: 'normal', txt: 'Vender lo que sobra', pista: 'guardan lo que la casa necesita' },
    { k: 'todo', txt: 'Vender todo lo posible', pista: 'más monedas, menos reservas' },
    { k: 'renta', txt: 'Solo vino y hierba', pista: 'la comida se queda en casa' },
    { k: 'guardar', txt: 'No vender nada', pista: 'solo comprar con los ahorros' },
  ], 'normal', {}, 3, 0);
  }
  if (V.sale && s.t >= V.sale) { log(s, `${COMERCIANTE} se fue con su carreta${V.hecho ? '' : ': nadie alcanzó a negociar'}.`, 'info'); C.visita = null; C.proxima = dia(s) + 6 + Math.floor(rng(s) * 4); }
}
function animalDeFuera(s, tipo, sexo) {
  const t = tipo === 'gallo' ? 'gallo' : tipo;
  const g = nuevoAnimalGranja(s, { id: `fuera${s.sigCria++}`, tipo: t, sexo, nombre: nombreCria(s, esAve(t) ? 'gallina' : t, sexo) });
  Object.assign(g, { edad: { vaca: 2, oveja: 1 }[t] ?? 1, generacion: 0, pos: { x: LUGAR.carreta.x - 3, z: LUGAR.carreta.z }, rasgo: 'de otra granja' });
  for (const k of Object.keys(g.adn)) g.adn[k] = Math.round(Math.min(1.4, g.adn[k] + 0.04) * 100) / 100;
  s.ganado.push(g);
  return g;
}
function comerciar(s, a) {
  const C = s.comercio, V = C.visita, R = s.rec;
  if (!V || V.hecho) return;
  V.hecho = true;
  const regatea = tiene(a, 'ahorradora') ? 1.1 : 1 + (P5(a, 'extraversion') - 0.5) * 0.1;
  const vivos = humanos(s).length;
  // 1) lo que sobra: se guarda lo que la casa necesita y se ofrece el resto
  const modo = V.modo || 'normal', Pol = s.politica;
  const reserva = { raciones: 30 + vivos * 28, conservas: 18, queso: 5, secos: 12, huevos: 10, lana: 8, abrigos: vivos + 1, vino: 12 + Math.max(...humanos(s).map((x) => x.placer.vino.dep)) * 20, hierba: 5 + Math.max(...humanos(s).map((x) => x.placer.hierba.dep)) * 10 };
  const vende = [];
  let ganado = 0;
  C.ganancias ||= {};
  if (modo === 'todo') for (const k of Object.keys(reserva)) reserva[k] *= k === 'raciones' ? 0.6 : 0.4;
  if (Pol.venderPlacer) { reserva[Pol.venderPlacer] = 0; Pol.venderPlacer = null; }
  for (const k of ['vino', 'hierba', 'queso', 'abrigos', 'lana', 'conservas', 'secos', 'huevos', 'raciones']) {   // primero lo que más deja
    if (modo === 'guardar' || (modo === 'renta' && k !== 'vino' && k !== 'hierba')) continue;
    const precio = V.precios[k] * regatea * (k === 'vino' && casaTiene(s, 'bodegaVino') ? 1.25 : 1);
    const sobra = Math.min(TOPE[k], Math.floor(((R[k] || 0) - reserva[k]) * (k === 'raciones' ? 0.5 : 0.7)), Math.floor((V.bolsa - ganado) / precio));
    if (sobra < (k === 'raciones' || k === 'huevos' ? 6 : 1)) continue;
    const m = Math.round(sobra * precio * 10) / 10;
    R[k] -= sobra; C.vendido[k] = (C.vendido[k] || 0) + sobra; ganado += m; C.ganancias[k] = Math.round(((C.ganancias[k] || 0) + m) * 10) / 10;
    vende.push(`${sobra} ${MERCADO[k].nombre}`);
  }
  // animales: si el corral está lleno se vende el más consanguíneo (sin dejar el rebaño sin macho)
  for (const tipo of ['vaca', 'oveja']) {
    const corral = enCorral(s), del = s.ganado.filter((g) => g.vivo && g.tipo === tipo && g.crec >= 1);
    if ((corral < CUPO.corral - 1 && !Pol.venderEstresados) || modo === 'guardar' || del.length < 4 || V.bolsa - ganado < TIENDA[tipo] * 0.7) continue;
    const machos = del.filter((g) => g.sexo === 'm').length;
    const g = del.filter((x) => x.sexo === 'h' || machos > 1).sort((x, y) => Pol.venderEstresados ? (y.estres || 0) - (x.estres || 0) : (y.consang || 0) - (x.consang || 0) || y.edad - x.edad)[0];
    if (!g) continue;
    s.ganado.splice(s.ganado.indexOf(g), 1); ganado += TIENDA[tipo] * 0.7;
    vende.push(`${g.nombre} (${tipo})`);
  }
  Pol.venderEstresados = false;
  C.monedas = Math.round((C.monedas + ganado) * 10) / 10;
  // 2) lo que se necesita, en orden de urgencia
  const compra = [];
  const paga = (precio) => { const p = Math.round(precio / regatea * 10) / 10; if (C.monedas - p < (tiene(a, 'ahorradora') ? 5 : 0)) return false; C.monedas = Math.round((C.monedas - p) * 10) / 10; return true; };
  if ((humanos(s).some((x) => x.enfermo > 0) || R.medicina < 1) && paga(TIENDA.medicina)) { R.medicina += 1; compra.push('medicina'); }
  // sangre nueva: si el rebaño está emparentado o falta un macho
  for (const [tipo, hembra, macho] of [['vaca', 'vaca', 'vaca'], ['oveja', 'oveja', 'oveja'], ['gallina', 'gallina', 'gallo']]) {
    const del = s.ganado.filter((g) => g.vivo && (tipo === 'gallina' ? esAve(g.tipo) : g.tipo === tipo));
    if (!del.length) continue;
    const machos = del.filter((g) => g.sexo === 'm' && g.crec >= 1).length;
    const cons = del.reduce((t, g) => t + (g.consang || 0), 0) / del.length;
    const cabe = tipo === 'gallina' ? del.length < CUPO.gallinero : enCorral(s) < CUPO.corral;
    if (!cabe || (machos > 0 && cons < 0.07) || dia(s) - (C['sangre_' + tipo] ?? -99) < 50) continue;
    if (!paga(TIENDA[tipo === 'gallina' ? 'gallo' : tipo])) continue;
    const g = animalDeFuera(s, tipo === 'gallina' ? 'gallo' : macho, 'm');
    C['sangre_' + tipo] = dia(s);
    compra.push(`${g.nombre}, ${tipo === 'gallina' ? 'un gallo' : `un ${tipo === 'vaca' ? 'toro' : 'carnero'}`} de otra granja (sangre nueva)`);
  }
  // reponer un animal si la especie está casi extinguida
  for (const tipo of ['vaca', 'oveja', 'gallina']) {
    const hembras = s.ganado.filter((g) => g.vivo && g.sexo === 'h' && (tipo === 'gallina' ? esAve(g.tipo) : g.tipo === tipo)).length;
    if (hembras < (tipo === 'gallina' ? 2 : 1) && paga(TIENDA[tipo])) { const g = animalDeFuera(s, tipo, 'h'); compra.push(`${g.nombre} (${tipo})`); }
  }
  for (const [c, n] of Object.entries(R.semillas)) if (n < 3 && paga(TIENDA.semilla * 2)) { R.semillas[c] += 4; compra.push(`semillas de ${CULTIVOS[c].nombre.toLowerCase()}`); }
  const falta = Object.keys(HERRAMIENTAS).find((h) => !C.herramientas.includes(h));
  if (falta && C.monedas > TIENDA[falta] + 10 && paga(TIENDA[falta])) { C.herramientas.push(falta); compra.push(HERRAMIENTAS[falta][1]); }
  // si alguien depende y no queda, se gasta en eso
  for (const k of ['vino', 'hierba']) {
    const quiere = humanos(s).some((x) => x.placer[k].dep > 0.45) && (R[k] || 0) < 1;
    if (quiere && paga(MERCADO[k].base * 1.3 * 3)) { R[k] += 3; compra.push(`3 ${MERCADO[k].nombre}`); }
  }
  { const l = LUJOS.find(([id]) => !(C.lujos ||= []).includes(id)); if (l && (s.casa.mejoras || []).length >= 5 && !s.casa.obra && C.monedas > l[2] + 150 && paga(l[2])) { C.lujos.push(l[0]); compra.push(l[1]); humanos(s).forEach((x) => { recuerdo(s, x, `Estrenaron ${l[1]}`, 10, 72); memoria(s, x, `Compraron ${l[1]}`, 0.4); }); } }
  if ((s.casa.estado ?? 100) < 70 && paga(TIENDA.materiales)) { s.casa.estado = Math.min(100, s.casa.estado + 25); compra.push('tejas y tablas para la casa'); }
  const sobra = C.monedas > 220 || (s.casa.mejoras || []).length >= 4;   // primero la casa
  if (sobra && P5(a, 'apertura') > 0.45 && paga(TIENDA.libro)) { R.libros += 1; compra.push('un libro'); }
  { const b = pareja(s, a); if (b && (sobra ? C.monedas > 25 : C.monedas > 60 && s.pareja.afinidad < 50) && (s.pareja.afinidad < 75 || s.pareja.tension > 20 || rng(s) < 0.3) && paga(TIENDA.regalo)) {
    const cosa = ['una pañoleta', 'un perfume', 'unos aretes', 'una navaja', 'un sombrero', 'un cuaderno'][Math.floor(rng(s) * 6)];
    recuerdo(s, b, `Un regalo de ${a.nombre}`, 10, 48); s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 3); s.pareja.tension = Math.max(0, (s.pareja.tension || 0) - 10);
    s.stats.regalos = (s.stats.regalos || 0) + 1; cumplirDeseo(s, b, 'regalo'); compra.push(`${cosa} para ${b.nombre}`); } }
  if (sobra && rng(s) < 0.5 && paga(TIENDA.golosinas)) { humanos(s).forEach((x) => recuerdo(s, x, 'Chocolate del comerciante', 4, 24)); compra.push('chocolate'); }
  if (sobra && rng(s) < 0.2 && paga(TIENDA.juguete)) { s.agentes.filter((x) => x.vivo && (x.tipo === 'perro' || x.tipo === 'gato')).forEach((x) => { x.n.diversion = 100; }); compra.push('un juguete para las mascotas'); }
  C.ultimo = { dia: dia(s), quien: a.nombre, vende, compra, monedas: C.monedas };
  recuerdo(s, a, compra.length ? 'Buen trueque' : 'Charló con el comerciante', compra.length ? 5 : 2, 12);
  a.n.social = Math.min(100, a.n.social + 25);
  log(s, `🛒 ${a.nombre} negoció con ${COMERCIANTE}${vende.length ? `: entregó ${vende.join(', ')}` : ''}${compra.length ? `${vende.length ? ' y' : ':'} se trajo ${compra.join(', ')}` : vende.length ? '' : ', pero no había nada que cambiar'}. Quedan ${Math.round(C.monedas)} monedas.`, compra.length || vende.length ? 'bueno' : 'info');
}

// ---------------------------------------------------------------- el jugador: dilemas, consejos e influencia
// el jugador es el "espíritu del orbe": no controla, influye. Si no responde a tiempo, ellos deciden solos.
const jugadorNuevo = () => ({
  jugador: { influencia: 3, max: 6, confianza: Object.fromEntries(PERSONAJES.filter((p) => p.tipo === 'humano').map((p) => [p.id, 50])), decididas: 0, solos: 0, consejos: 0, rechazos: 0 },
  dilemas: [], politica: {}, enfriar: {}, sigDilema: 1,
});
const HORAS_DILEMA = 8;
function proponer(s, tipo, titulo, texto, opciones, defecto, datos = {}, horas = HORAS_DILEMA, enfria = 2) {
  s.dilemas ||= [];
  const clave = tipo + (datos.quien || '');
  if (s.dilemas.some((d) => d.clave === clave) || s.dilemas.length >= 4) return null;
  if ((s.enfriar[clave] || -1e9) > s.t) return null;
  const d = { id: s.sigDilema++, clave, tipo, titulo, texto, opciones, defecto, datos, creado: s.t, vence: s.t + horas * 60 };
  s.dilemas.push(d); s.enfriar[clave] = s.t + enfria * MIN_DIA;
  return d;
}
const dilemaDe = (s, tipo) => (s.dilemas || []).find((d) => d.tipo === tipo);
// el jugador responde
export const AREAS_TRABAJO = { agua: 'Agua', huerto: 'Huerto', cuidado: 'Cuidado y curación', casa: 'Cocina y casa', granja: 'Granja', carpinteria: 'Construcción' };
export function setPrioridad(s, id, area, v) { (s.prioridades ||= {})[id] ||= {}; s.prioridades[id][area] = v; }
// alertas tipo RimWorld: lo que necesita atención ahora
export function alertas(s) {
  const L = [], R = s.rec, H = humanos(s);
  const consumo = H.length * 1.4 + hijos(s).length * 0.9 + s.agentes.filter((a) => a.vivo && esMascota(a)).length * 0.5;
  const diasComida = consumo ? comidaTotal(s) / consumo : 99;
  if (diasComida < 3) L.push(['rojo', `Comida para ${Math.max(0, Math.floor(diasComida))} días`]); else if (diasComida < 7) L.push(['amarillo', `Comida para ${Math.floor(diasComida)} días`]);
  if (R.potable + R.cruda < H.length * 10) L.push(['rojo', 'Casi sin agua']);
  for (const F of s.fuegos || []) L.push(['rojo', `🔥 Incendio en ${F.nombre}`]);
  if (s.lobos) L.push(['rojo', `🐺 ${s.lobos.n} lobos rondan el potrero`]);
  if (s.ladron) L.push(['amarillo', '🕵️ Un extraño ronda la granja']);
  for (const k of hijos(s)) { if (k.n.comida < 25 || k.n.agua < 25) L.push(['rojo', `👶 ${k.nombre} tiene ${k.n.comida < k.n.agua ? 'hambre' : 'sed'}`]); else if (k.n.salud < 50) L.push(['rojo', `👶 ${k.nombre} está débil`]); }
  if (s.familia?.embarazo) { const dd = Math.ceil((s.familia.embarazo.fin - s.t) / MIN_DIA); if (dd <= 3) L.push(['amarillo', `🤰 El bebé llega en ${dd} día${dd === 1 ? '' : 's'}`]); }
  if (s.pozoRoto) L.push(['amarillo', '🚱 El pozo está roto']);
  if (s.comercio?.visita?.llego) L.push(['amarillo', `🛒 ${COMERCIANTE} está en la granja hasta las 5`]);
  for (const a of s.agentes.filter((x) => x.vivo)) {
    const sev = severidad(a), inf = (a.heridas || []).some((h) => h.infeccion > 0.3), fiebre = (a.heridas || []).find((h) => h.tipo === 'fiebre');
    if (inf) L.push(['rojo', `${a.nombre}: herida infectada`]);
    else if (fiebre && fiebre.sev > 0.7 && !fiebre.tratada) L.push(['rojo', `${a.nombre}: fiebre crítica`]);
    else if (sev > 0.5) L.push(['amarillo', `${a.nombre} está herido`]);
    if (a.tipo === 'humano') {
      if (a.quiebre) L.push(['rojo', `${a.nombre}: ${QUIEBRE[a.quiebre.tipo][0]}`]);
      else if (a.animo < 25) L.push(['rojo', `${a.nombre} al borde del quiebre`]);
      else if (a.animo < 35) L.push(['amarillo', `${a.nombre} está mal de ánimo`]);
      if (a.n.comida < 15) L.push(['rojo', `${a.nombre} tiene hambre`]);
    }
  }
  if (s.ganado.some((g) => g.vivo && !esAve(g.tipo) && (g.hambre < 20 || g.sed < 20))) L.push(['amarillo', 'Ganado con hambre o sed']);
  if (frio(s) && R.abrigos < H.length) L.push(['amarillo', 'Falta abrigo para el invierno']);
  if (R.medicina < 1) L.push(['amarillo', 'No hay medicina']);
  if ((s.casa.estado ?? 100) < 35) L.push(['amarillo', 'La casa se está cayendo']);
  return L;
}
export function decidir(s, id, k) {
  const d = (s.dilemas || []).find((x) => x.id === id);
  if (!d || !d.opciones.some((o) => o.k === k)) return false;
  s.dilemas = s.dilemas.filter((x) => x !== d);
  s.jugador.decididas += 1;
  resolver(s, d, k, true);
  return true;
}
function revisarDilemas(s) {
  for (const d of [...(s.dilemas || [])]) {
    if (s.t < d.vence) continue;
    s.dilemas = s.dilemas.filter((x) => x !== d);
    s.jugador.solos += 1;
    resolver(s, d, d.defecto, false);
  }
}
// ¿la persona sigue el consejo? depende de cuánto confía en el espíritu y de su carácter
function aceptaConsejo(s, a) {
  const c = s.jugador.confianza[a.id] ?? 50;
  const agobio = s.t - (a.ultimoConsejo ?? -1e9) < 6 * 60 ? 0.25 : 0;   // consejos seguidos: lo agobias
  const ok = rng(s) < 0.35 + c / 160 + P5(a, 'amabilidad') * 0.15 - (irritable(a) ? 0.15 : 0) - (tiene(a, 'grunon') ? 0.08 : 0) - agobio;
  a.ultimoConsejo = s.t;
  s.jugador.confianza[a.id] = Math.max(0, Math.min(100, c + (ok ? 1 : -3) - (agobio ? 1 : 0)));
  if (ok) s.jugador.consejos += 1; else s.jugador.rechazos += 1;
  return ok;
}
function resolver(s, d, k, jugador) {
  const op = d.opciones.find((o) => o.k === k) || d.opciones[0];
  const pre = jugador ? '🕯️ Decidiste' : '🤷 Sin tu consejo, decidieron';
  const P = s.politica, R = s.rec;
  const quien = d.datos.quien ? s.agentes.find((x) => x.id === d.datos.quien && x.vivo) : null;
  // consejos a una persona: los puede rechazar
  if (jugador && quien && d.tipo !== 'perdon' && k !== 'nada') {
    if (!aceptaConsejo(s, quien)) { log(s, `🕯️ Le aconsejaste a ${quien.nombre} «${op.txt.toLowerCase()}», pero no te hizo caso.`, 'decision'); return; }
    log(s, `🕯️ ${quien.nombre} siguió tu consejo: ${op.txt.toLowerCase()}.`, 'decision');
  } else log(s, `${pre}: ${d.titulo.toLowerCase()} → ${op.txt.toLowerCase()}.`, 'decision');
  switch (d.tipo) {
    case 'crias': P.crias = k; break;
    case 'hijo': s.familia.plan = k; if (k === 'esperar') s.familia.planHasta = dia(s) + 28; break;
    case 'parto': { const F = s.familia; if (k === 'partera' && s.comercio.monedas >= 80) { s.comercio.monedas -= 80; F.parto = 'partera'; log(s, '🧑‍⚕️ La partera del pueblo vendrá para el parto (80 monedas).', 'info'); } else { F.parto = 'casa'; if (k === 'partera') log(s, 'No alcanzó el dinero para la partera: el parto será en casa.', 'aviso'); } break; }
    case 'nombre': { const h = s.agentes.find((x) => x.id === d.datos.hijo); if (h && h.nombre !== k) { log(s, `Le pusieron ${k} (antes le decían ${h.nombre}).`, 'info'); h.nombre = k; } break; }
    case 'mayoria': { const h = s.agentes.find((x) => x.id === d.datos.hijo && x.vivo); if (h && k === 'estudiar') irseAlPueblo(s, h); break; }
    case 'incendio': case 'lobos': case 'ladron': case 'fiebre': case 'forastero': case 'pozo': case 'langostas': case 'tratamiento': resolverCrisis(s, d, k); break;
    case 'estilo': s.casa.estilo = k; s.casa.diaEstilo = dia(s); empezarMejora(s, 'fachada'); break;
    case 'reforma': if (k !== 'no' && s.comercio.monedas >= 300) { s.comercio.monedas -= 300; s.casa.obra = { id: 'reforma', progreso: 0, estilo: k }; s.casa.diaEstilo = dia(s); log(s, `🎨 Empieza la reforma a estilo ${ESTILOS[k].nombre.toLowerCase()} (300 monedas).`, 'logro'); } break;
    case 'inversion': if (k !== 'ahorrar') empezarMejora(s, k); break;
    case 'parientes': P.noParientes = k === 'esperar'; break;
    case 'cultivo': P.cultivo = k === 'libre' ? null : k; P.cultivoEst = estacion(s); break;
    case 'venta': if (s.comercio.visita) s.comercio.visita.modo = k; break;
    case 'uva': P.uva = k; aplicarUva(s, k); break;
    case 'obra': P.obra = k === 'libre' ? null : k; break;
    case 'plaga': { const q = s.parcelas[d.datos.parcela]; if (!q) break; if (k === 'arrancar' && q.estado === 'creciendo') { q.estado = 'muerta'; q.ultimo = q.cultivo; q.plaga = 0; } if (k === 'fumigar') q.prioridad = s.t + MIN_DIA; break; }
    case 'estresAnimal': if (k === 'cepillar') P.cepillarHasta = s.t + MIN_DIA; if (k === 'vender') P.venderEstresados = true; break;
    case 'estres': {
      if (!quien) break;
      if (k === 'libre') { quien.diaLibre = s.t + MIN_DIA * 0.7; soltarTarea(s, quien); recuerdo(s, quien, 'Un día libre', 8, 18); }
      if (k === 'vino' && R.vino >= 0.5) { quien.tomarHoy = true; }
      if (k === 'hablar') { soltarTarea(s, quien); if (invitar(s, quien, 'conversar')) recuerdo(s, quien, 'Desahogarse', 5, 12); }
      if (k === 'dormir') { soltarTarea(s, quien); crearTarea(s, quien, 'siesta'); }
      break;
    }
    case 'placer': {
      if (!quien) break;
      const kk = d.datos.placer;
      if (k === 'hablar') { const Pq = quien.placer[kk]; Pq.pausa = dia(s) + 21; s.pareja.tension = Math.min(100, (s.pareja.tension || 0) + 5); recuerdo(s, quien, 'Decidió cuidarse', 3, 24); }
      if (k === 'vender') P.venderPlacer = kk;
      break;
    }
    case 'perdon': {
      const x = s.agentes.find((y) => y.id === k && y.vivo);
      if (x && s.pareja.pendiente) { s.pareja.pendiente.perdon = true; soltarTarea(s, x); if (invitar(s, x, 'reconciliar')) log(s, `${x.nombre} fue a buscar a su pareja para hacer las paces.`, 'info'); }
      break;
    }
  }
}
function aplicarUva(s, k) {
  const R = s.rec;
  if (k === 'fresca' && R.uvas >= 2) { const n = Math.floor(R.uvas * 0.5); R.uvas -= n; R.raciones += Math.round(n * 0.7); log(s, `🍇 La mitad de la uva (${n} canastos) se comió fresca: +${Math.round(n * 0.7)} raciones.`, 'info'); }
  if (k === 'pasas' && R.uvas >= 2) { const n = Math.floor(R.uvas * 0.5); R.uvas -= n; R.secos = (R.secos || 0) + Math.round(n * 0.4); log(s, `🍇 La mitad de la uva se secó como pasas: +${Math.round(n * 0.4)} secos.`, 'info'); }
}
// las ocasiones en que la granja te pide una decisión
function dilemasDelDia(s) {
  const e = estacion(s), dE = dia(s) % DIAS_ESTACION, R = s.rec;
  s.jugador.influencia = Math.min(s.jugador.max, (s.jugador.influencia || 0) + 3);
  dilemasCasa(s);
  // qué sembrar esta estación
  if (dE === 0 && e !== 3) {
    const ops = Object.entries(CULTIVOS).filter(([, C]) => C.estaciones.includes(e)).map(([k, C]) => ({ k, txt: `Priorizar ${C.nombre.toLowerCase()}`, pista: k === 'frijol' ? 'devuelve nitrógeno al suelo' : `${C.raciones} raciones en ${C.dias} días` }));
    proponer(s, 'cultivo', `Comienza ${ESTACIONES[e].toLowerCase()}: ¿qué sembrar?`, 'El huerto se planea para la estación. Puedes inclinar la siembra hacia un cultivo.', [...ops, { k: 'libre', txt: 'Que decidan ellos', pista: 'rotación según su experiencia' }], 'libre', {}, 12, 20);
  }
  // temporada de crías
  if (e === 0 && dE === 2) {
    const corral = enCorral(s);
    proponer(s, 'crias', 'Temporada de crías', `En el potrero hay ${corral} de ${CUPO.corral} lugares. ¿Cuántas crías buscar este año?`, [
      { k: 'muchas', txt: 'Muchas crías', pista: 'el rebaño crece; más pasto y heno' },
      { k: 'normal', txt: 'Lo normal', pista: 'lo que la naturaleza dé' },
      { k: 'pocas', txt: 'Pocas', pista: 'menos bocas, más descanso para el pasto' },
      { k: 'ninguna', txt: 'Ninguna este año', pista: 'se separan los machos' },
    ], corral > CUPO.corral - 3 ? 'pocas' : 'normal', {}, 16, 20);
  }
  // sangre cerrada
  const vivos = s.ganado.filter((g) => g.vivo), cons = vivos.length ? vivos.reduce((t, g) => t + (g.consang || 0), 0) / vivos.length : 0;
  if (e === 0 && dE === 3 && cons > 0.08) proponer(s, 'parientes', 'La sangre del rebaño se cierra', `La consanguinidad promedio es ${Math.round(cons * 100)} %. ¿Dejar que se crucen parientes?`, [
    { k: 'esperar', txt: 'No cruzar parientes', pista: 'menos crías, más sanas' },
    { k: 'permitir', txt: 'Que se crucen igual', pista: 'más crías, más débiles' },
  ], 'permitir', {}, 16, 30);
  // animales estresados
  const est = vivos.length ? vivos.reduce((t, g) => t + (g.estres || 0), 0) / vivos.length : 0;
  if (est > 48) proponer(s, 'estresAnimal', 'Los animales están estresados', `El estrés promedio del rebaño está en ${Math.round(est)}. Rinden menos y enferman más.`, [
    { k: 'cepillar', txt: 'Dedicar el día a calmarlos', pista: 'se cepillan antes que otras tareas' },
    { k: 'vender', txt: 'Vender los más estresados', pista: 'al próximo comerciante' },
    { k: 'nada', txt: 'Esperar a que pase', pista: '' },
  ], 'nada', {}, 10, 6);
  // dependencia
  for (const a of humanos(s)) for (const k of ['vino', 'hierba']) {
    const Pq = a.placer?.[k];
    if (Pq && Pq.dep > 0.4 && !(Pq.pausa > dia(s))) proponer(s, 'placer', `${a.nombre} está ${k === 'vino' ? 'tomando' : 'fumando'} demasiado`, `Ya ${k === 'vino' ? 'toma' : 'fuma'} casi todos los días (dependencia ${Math.round(Pq.dep * 100)} %).`, [
      { k: 'hablar', txt: 'Que lo hablen ahora', pista: 'puede dejarlo un tiempo; algo de tensión' },
      { k: 'vender', txt: `Vender ${k === 'vino' ? 'el vino' : 'la hierba'} al comerciante`, pista: 'si no hay, no hay' },
      { k: 'nada', txt: 'No intervenir', pista: '' },
    ], 'nada', { quien: a.id, placer: k }, 10, 8);
  }
  // plagas graves
  const q = s.parcelas.find((x) => x.estado === 'creciendo' && x.plaga > 0.5);
  if (q) proponer(s, 'plaga', `Plaga fuerte en la parcela ${q.id + 1}`, `${q.plagaTipo === 'hongo' ? 'Un hongo' : 'Insectos'} atacan ${CULTIVOS[q.cultivo]?.nombre.toLowerCase()} (${Math.round(q.plaga * 100)} %). Se puede contagiar a las vecinas.`, [
    { k: 'fumigar', txt: 'Tratarla ya', pista: 'puede salvarse' },
    { k: 'arrancar', txt: 'Arrancarla', pista: 'se pierde, pero protege las demás' },
    { k: 'nada', txt: 'Que ellos vean', pista: '' },
  ], 'nada', { parcela: q.id }, 8, 3);
}
function dilemasCasa(s) {
  const C = s.comercio, K = s.casa, plata = C?.monedas || 0;
  if (!K.estilo) {
    if (plata >= 140) {
      const [x, y] = humanos(s);
      const gusto = { tomas: 'nordica', lucia: 'mediterranea' };
      const def = (rng(s) < 0.5 ? x : y)?.id;
      proponer(s, 'estilo', 'La casa necesita renovarse', `Tienen ${Math.round(plata)} monedas ahorradas. Antes de invertir, ¿qué estilo de casa quieren construir con los años?`,
        Object.entries(ESTILOS).map(([k, E]) => ({ k, txt: E.nombre, pista: E.pista })), gusto[def] || 'tropical', {}, 16, 5);
    }
    return;
  }
  if (K.obra) return;
  if (casaTiene(s, 'fachada') && etapaCasa(s) >= 2 && plata >= 450 && dia(s) - (K.diaEstilo ?? 0) > DIAS_ANIO && rng(s) < 0.15) {
    const ops = Object.entries(ESTILOS).filter(([k]) => k !== K.estilo).map(([k, E]) => ({ k, txt: `Reformar a ${E.nombre.toLowerCase()} · 300`, pista: E.pista }));
    if (proponer(s, 'reforma', '¿Cambiar el estilo de la granja?', `Llevan tiempo con el estilo ${ESTILOS[K.estilo].nombre.toLowerCase()}. Una reforma cambia la casa y todas las construcciones.`, [...ops, { k: 'no', txt: 'Nos gusta como está', pista: '' }], 'no', {}, 16, 60)) return;
  }
  const disp = MEJORAS_CASA.filter(([id, , costo, , , req]) => !casaTiene(s, id) && req.every((r) => casaTiene(s, r)) && costo + 20 <= plata);
  if (!disp.length) return;
  const vivos = humanos(s); if (!vivos.length) return;
  const quien = vivos[(K.turno || 0) % vivos.length], pref = PREFIERE[quien.id] || [];
  const orden = [...disp].sort((a, b) => (pref.indexOf(a[0]) + 99) % 99 - (pref.indexOf(b[0]) + 99) % 99).slice(0, 3);
  proponer(s, 'inversion', `¿En qué invertir? (${Math.round(plata)} monedas)`, `${quien.nombre} quiere ${orden[0][1]}. La casa va en la etapa ${etapaCasa(s)} de 4.`,
    [...orden.map(([id, nombre, costo, , efecto]) => ({ k: id, txt: `${nombre[0].toUpperCase() + nombre.slice(1)} · ${costo}`, pista: efecto })), { k: 'ahorrar', txt: 'Seguir ahorrando', pista: 'pueden invertir más adelante' }],
    orden[0][0], { quien: null }, 14, 4);
}
// dónde se trabaja en cada proyecto
function sitioProyecto(s) {
  const id = s.casa.obra?.id, j = () => (rng(s) - 0.5) * 2;
  if (id === 'vinedo' || id === 'bodegaVino') return { x: 16 + j(), z: 28.6 };
  if (id === 'cultivoCaseta' || id === 'cultivoPro') return { x: 31.6, z: 27 + j() };
  if (id === 'piscina' || id === 'jacuzzi') return { x: 22.4, z: 14 + j() };
  if (id === 'gimnasio') return { x: LUGAR_GYM.x + j(), z: LUGAR_GYM.z - 1.2 };
  if (id === 'establo2') return { x: -9.2, z: -9 + j() };
  if (id === 'gallinero2') return { x: 13.4, z: -10 + j() };
  return { x: 2 + rng(s) * 8, z: 7.6 + rng(s) * 0.6 };
}
function empezarMejora(s, id) {
  const M = MEJORAS_CASA.find((x) => x[0] === id); if (!M) return;
  const C = s.comercio;
  if (C.monedas < M[2]) { log(s, `No alcanzaron las monedas para ${M[1]}.`, 'aviso'); return; }
  C.monedas = Math.round((C.monedas - M[2]) * 10) / 10;
  s.casa.obra = { id, progreso: 0 };
  s.casa.turno = (s.casa.turno || 0) + 1;
  log(s, `🏠 Encargaron materiales a ${COMERCIANTE} para ${M[1]} (${M[2]} monedas). Empieza la obra.`, 'logro');
}
// estrés de las personas y peleas: se revisa cada media hora
function dilemasDelMomento(s) {
  const h = hora(s);
  for (const a of humanos(s)) {
    if (!despierto(s, a) || h < 8 || h > 20) continue;
    if (a.animo < 42 || (a.n.energia < 22 && h < 17)) {
      const ops = [{ k: 'libre', txt: 'Tómate el día', pista: 'deja el trabajo que no sea urgente' }, { k: 'hablar', txt: 'Habla con tu pareja', pista: 'desahogarse ayuda' }];
      if (s.rec.vino >= 0.5) ops.push({ k: 'vino', txt: 'Una copa esta noche', pista: 'alegra… y tiene sus riesgos' });
      if (a.n.energia < 40) ops.push({ k: 'dormir', txt: 'Échate una siesta', pista: 'recupera energía' });
      ops.push({ k: 'nada', txt: 'Que siga', pista: '' });
      proponer(s, 'estres', `${a.nombre} está ${a.n.energia < 22 ? 'agotado' : 'de mal ánimo'}`, `Ánimo ${Math.round(a.animo)} · energía ${Math.round(a.n.energia)}. ¿Qué le aconsejas?`, ops, 'nada', { quien: a.id }, 5, 2);
    }
  }
  const pend = s.pareja.pendiente, [x, y] = humanos(s);
  if (pend && x && y && s.t - pend.t > 30 && !pend.preguntado && (pend.preguntado = true)) proponer(s, 'perdon', 'Discutieron', `${x.nombre} y ${y.nombre} siguen enojados. ¿Quién debería dar el primer paso?`, [
    { k: x.id, txt: `${x.nombre}`, pista: 'pide perdón' }, { k: y.id, txt: `${y.nombre}`, pista: 'pide perdón' }, { k: 'tiempo', txt: 'Que se den espacio', pista: 'se enfría, pero puede quedar rencor' },
  ], 'tiempo', {}, 4, 1);
}
// las acciones directas (cuestan influencia)
export const ACCIONES = {
  animar: { txt: 'Darle ánimo', costo: 1, pista: 'un empujón de alegría' },
  descansar: { txt: 'Sugerir un descanso', costo: 1, pista: 'deja lo que hace y descansa' },
  hablar: { txt: 'Que busque a su pareja', costo: 1, pista: 'una buena conversación' },
  deseo: { txt: 'Impulsar su deseo', costo: 2, pista: 'puede que lo logre' },
  calmar: { txt: 'Ayudarle a calmarse', costo: 1, pista: 'baja la tensión y las ganas de tomar' },
};
export function actuar(s, id, accion) {
  const a = s.agentes.find((x) => x.id === id && x.vivo && x.tipo === 'humano'), A = ACCIONES[accion], J = s.jugador;
  if (!a || !A || J.influencia < A.costo) return { ok: false, msg: !A ? '' : J.influencia < A.costo ? 'No te queda influencia: se recarga cada día.' : '' };
  J.influencia -= A.costo;
  if (!aceptaConsejo(s, a)) { log(s, `🕯️ Intentaste ${A.txt.toLowerCase()} a ${a.nombre}, pero no te hizo caso.`, 'decision'); return { ok: true, acepto: false }; }
  switch (accion) {
    case 'animar': recuerdo(s, a, 'Sintió compañía', 8, 12); if (a.quiebre && a.quiebre.tipo !== 'huida') { a.quiebre.hasta = s.t; log(s, `${a.nombre} se calmó: sintió que alguien lo acompañaba.`, 'bueno'); } break;
    case 'descansar': soltarTarea(s, a); crearTarea(s, a, a.n.energia < 50 ? 'siesta' : 'descansar'); break;
    case 'hablar': soltarTarea(s, a); invitar(s, a, 'conversar'); break;
    case 'calmar': s.pareja.tension = Math.max(0, (s.pareja.tension || 0) - 12); for (const k of ['vino', 'hierba']) a.placer[k].ult = s.t; recuerdo(s, a, 'Respiró hondo', 4, 8); break;
    case 'deseo': {
      const de = a.deseo?.id;
      if (de === 'nocheRomantica' || de === 'regalo') { s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 3); (pareja(s, a) || {}).deseoSex = 90; a.deseoSex = 90; }
      else if (de === 'paseo' && s.agentes.some((x) => x.tipo === 'perro' && x.vivo)) { soltarTarea(s, a); crearTarea(s, a, 'pasearPerro'); }
      else if (de === 'nadarJuntos' && estacion(s) !== 3) { soltarTarea(s, a); iniciarOcio(s, a, 'nadar'); }
      else if (de === 'casaImpecable') { soltarTarea(s, a); crearTarea(s, a, 'limpiarCasa'); }
      else if (de === 'abrigo' && s.rec.lana >= 4) { soltarTarea(s, a); crearTarea(s, a, 'tejer'); }
      else if (de === 'arcoiris' || de === 'cenaEspecial' || de === 'nacimiento' || de === 'subirNivel' || de === 'cosecharFavorito') recuerdo(s, a, 'Con ilusión por su deseo', 5, 24);
      break;
    }
  }
  log(s, `🕯️ ${a.nombre}: ${A.txt.toLowerCase()}.`, 'decision');
  return { ok: true, acepto: true };
}

// ---------------------------------------------------------------- salud con heridas (estilo RimWorld)
// cada herida: tipo, parte del cuerpo, severidad (0 a 1), si ya se curó/vendó, e infección que crece si no se trata
const NOMBRE_HERIDA = { parto: 'complicaciones en el parto', corte: 'un corte', quemadura: 'una quemadura', mordida: 'una mordida', golpe: 'un golpe', fractura: 'una fractura', fiebre: 'fiebre alta', intoxicacion: 'una intoxicación' };
export function herir(s, a, tipo, sev, parte, causa) {
  if (!a || !a.vivo) return;
  a.heridas ||= [];
  sev = Math.max(0.05, Math.min(1, sev));
  a.heridas.push({ tipo, parte, sev, tratada: false, infeccion: 0, desde: s.t });
  const grave = sev > 0.5;
  log(s, `🩸 ${a.nombre} sufrió ${NOMBRE_HERIDA[tipo] || 'una herida'}${parte && parte !== 'cuerpo' ? ` en ${parte === 'pierna' ? 'la pierna' : parte === 'mano' ? 'la mano' : parte === 'brazo' ? 'el brazo' : 'la cabeza'}` : ''}${causa ? ` ${causa}` : ''}${grave ? ': es grave, necesita curación y reposo' : ''}.`, grave ? 'malo' : 'aviso');
  if (grave && tipo !== 'fiebre') proponerTratamiento(s, a);   // grave: tú decides si se usa medicina o médico
  if (a.tipo === 'humano') { recuerdo(s, a, 'Herido', -Math.round(4 + sev * 8), 24); const b = pareja(s, a); if (b) recuerdo(s, b, `Preocupación por ${a.nombre}`, -Math.round(2 + sev * 6), 24); }
  else humanos(s).forEach((h) => recuerdo(s, h, `${a.nombre} está herido`, -3, 24));
}
function proponerTratamiento(s, a) {
  const R = s.rec;
  proponer(s, 'tratamiento', `${a.nombre} está grave`, `${(a.heridas || []).map((h) => NOMBRE_HERIDA[h.tipo]).join(', ')}${(a.heridas || []).some((h) => h.infeccion > 0.3) ? ' con infección' : ''}. ${R.medicina >= 1 ? `Hay ${Math.floor(R.medicina)} medicina.` : 'No hay medicina.'}`, [
    { k: 'medicina', txt: 'Usar medicina', pista: R.medicina >= 1 ? 'detiene la infección' : 'no hay' },
    { k: 'medico', txt: 'Traer al médico', pista: '120 monedas' },
    { k: 'vendar', txt: 'Solo vendar y esperar', pista: 'gratis; la infección puede seguir' },
  ], 'vendar', { quien: null, paciente: a.id }, 6, 1);
}
const severidad = (a) => (a.heridas || []).reduce((t, h) => t + h.sev, 0);
const herido = (a, min = 0.3) => (a.heridas || []).some((h) => h.sev >= min && h.tipo !== 'fiebre' && h.tipo !== 'intoxicacion' && (!h.tratada || h.infeccion > 0.3));
const porCurar = (s, a) => (a.heridas || []).some((h) => h.sev >= 0.2 && !['fiebre', 'intoxicacion'].includes(h.tipo) && (!h.tratada || h.infeccion > 0.3) && s.t - (h.curadaT ?? -1e9) > 6 * 60);
const cojea = (a) => (a.heridas || []).some((h) => h.parte === 'pierna' && h.sev > 0.3);
function heridasTick(s) {   // cada media hora
  for (const a of s.agentes) {
    if (!a.vivo || !a.heridas?.length) continue;
    const reposo = a.tarea && ['dormir', 'reposo', 'siesta', 'descansar', 'dormirCon'].includes(a.tarea.tipo);
    for (const h of a.heridas) {
      // sin tratar, las heridas abiertas se infectan; tratadas, la infección cede
      if (['corte', 'mordida', 'quemadura', 'fractura'].includes(h.tipo) && h.sev > 0.2 && (!h.tratada || (h.infeccion > 0.35 && !h.medicada))) h.infeccion = Math.min(1.2, h.infeccion + (h.tratada ? 0.006 : 0.012) * h.sev);
      else h.infeccion = Math.max(0, h.infeccion - 0.01);
      if (h.infeccion > 0.45 && !h.avisoInf) { h.avisoInf = true; log(s, `🦠 La herida de ${a.nombre} se infectó: hay que curarla ya.`, 'malo'); proponerTratamiento(s, a); }
      // se curan con el tiempo: más rápido si están tratadas y si descansa
      h.sev = Math.max(0, h.sev - (h.tratada ? 0.0045 : 0.0015) * (reposo ? 1.8 : 1) * (h.infeccion > 0.3 ? 0.2 : 1));
      if (h.infeccion > 0.45) a.n.salud = Math.max(0, a.n.salud - 0.9 * h.infeccion);
      if ((h.tipo === 'fiebre' || h.tipo === 'intoxicacion') && !h.tratada) a.n.salud = Math.max(0, a.n.salud - (h.sev > 0.85 ? 1.4 : 0.35) * h.sev);
      if (h.tipo === 'fiebre' && !h.tratada && !h.casero) { h.sev = Math.min(1, h.sev + 0.006); if (h.sev > 0.85 && !h.avisoCritico) { h.avisoCritico = true; log(s, `🤒 La fiebre de ${a.nombre} es crítica: sin medicina o médico puede morir.`, 'malo'); proponerTratamiento(s, a); } }
      if (h.tipo === 'intoxicacion') a.n.energia = Math.max(0, a.n.energia - 1);
      if (h.sev > 0.6 && !h.tratada) a.n.salud = Math.max(0, a.n.salud - 0.25);
    }
    const antes = a.heridas.length;
    for (const h of a.heridas.filter((x) => x.sev <= 0.02)) { log(s, `${a.nombre} se recuperó de ${NOMBRE_HERIDA[h.tipo] || 'la herida'}.`, 'bueno'); if (a.tipo === 'humano' && h.desdeGrave) memoria(s, a, `Sobrevivió a ${NOMBRE_HERIDA[h.tipo]}`, 0.5); }
    a.heridas = a.heridas.filter((x) => x.sev > 0.02);
    if (a.tipo === 'humano' && a.heridas.length) { const sv = severidad(a); if (sv > 0.15) recuerdo(s, a, 'Dolor', -Math.round(Math.min(14, sv * 10)), 1); }
    for (const h of a.heridas) if (h.sev > 0.5) h.desdeGrave = true;
    if (a.n.salud <= 0) morir(s, a, a.heridas.some((h) => h.infeccion > 0.45) ? 'de una infección' : 'por sus heridas');
  }
}
// accidentes de trabajo: herramientas, caídas, animales, cocina (más probables con resaca, efecto o poca experiencia)
const RIESGO = { construir: ['golpe', 'mano', 0.004], renovar: ['golpe', 'mano', 0.005], reparar: ['corte', 'mano', 0.004], segar: ['corte', 'pierna', 0.005], esculpir: ['corte', 'mano', 0.003], tallar: ['corte', 'mano', 0.003],
  ordenar: ['golpe', 'pierna', 0.0025], esquilar: ['corte', 'mano', 0.003], cocinar: ['quemadura', 'mano', 0.002], hornear: ['quemadura', 'mano', 0.003], sacarAgua: ['golpe', 'brazo', 0.0015], vendimia: ['corte', 'mano', 0.002] };
function accidente(s, a, tipo) {
  const R0 = RIESGO[tipo]; if (!R0 || a.tipo !== 'humano') return;
  const area = AREA[tipo] || XP_OCIO[tipo];
  const p = R0[2] * (1 - Math.min(0.6, nivel(a.xp[area] || 0) * 0.06)) * (a.resacaHasta > s.t ? 2 : 1) * (a.colocadoHasta > s.t ? 1.6 : 1) * (a.borrachoHasta > s.t ? 3 : 1) * (a.n.energia < 25 ? 1.8 : 1);
  if (rng(s) > p) return;
  const caida = (tipo === 'renovar' || tipo === 'construir') && rng(s) < 0.25;
  if (caida) herir(s, a, 'fractura', 0.6 + rng(s) * 0.3, 'pierna', tipo === 'renovar' ? 'al caerse del andamio' : 'al caerse de la obra');
  else herir(s, a, R0[0], 0.15 + rng(s) * 0.45, R0[1], 'trabajando');
}

// ---------------------------------------------------------------- el narrador (estilo RimWorld, equilibrado)
// reparte crisis por ciclos: calma → tensión → crisis. Mientras mejor va la granja, más aprieta; si va mal, da respiro.
const narradorNuevo = (t) => ({ tension: 0, proxima: Math.floor(t / MIN_DIA) + 8, historial: [] });
function riqueza(s) { return Math.min(2, 0.6 + (s.comercio?.monedas || 0) / 1500 + s.ganado.filter((g) => g.vivo).length / 60 + diasVividos(s) / (DIAS_ANIO * 3)); }
const CRISIS = {
  incendio: { peso: (s) => (estacion(s) === 1 ? 2 : 1) * (s.sequia > 0 ? 2 : 1), ok: (s) => true },
  lobos: { peso: (s) => (estacion(s) === 3 ? 2.2 : 1), ok: (s) => s.ganado.some((g) => g.vivo) },
  ladron: { peso: (s) => 0.6 + (s.comercio?.monedas || 0) / 400, ok: (s) => true },
  fiebre: { peso: (s) => (estacion(s) === 3 ? 1.8 : 0.8), ok: (s) => humanos(s).length > 0 },
  pozo: { peso: () => 0.45, ok: (s) => !s.pozoRoto },
  forastero: { peso: () => 0.8, ok: (s) => !s.forastero },
  intoxicacion: { peso: (s) => ((s.rec.conservas || 0) > 10 ? 1 : 0.5), ok: (s) => humanos(s).length > 0 },
  langostas: { peso: (s) => (estacion(s) === 1 || estacion(s) === 2 ? 1.2 : 0), ok: (s) => s.parcelas.filter((p) => p.estado === 'creciendo').length >= 3 },
};
function narradorDelDia(s) {
  const N = (s.narrador ||= narradorNuevo(s.t)), d = dia(s);
  N.tension = Math.max(0, N.tension * 0.88 - 2);
  const animoMedio = humanos(s).reduce((t, a) => t + a.animo, 0) / (humanos(s).length || 1);
  if (d < N.proxima || N.tension > 40 || animoMedio < 30) return;   // da respiro si están mal
  const ops = Object.entries(CRISIS).filter(([k, c]) => c.ok(s) && N.historial.slice(-2).indexOf(k) < 0).map(([k, c]) => [c.peso(s), k]);
  let r = rng(s) * ops.reduce((t, o) => t + o[0], 0), k = ops[0]?.[1];
  for (const [w, kk] of ops) { if ((r -= w) <= 0) { k = kk; break; } }
  if (!k) return;
  const fuerza = riqueza(s) * (0.8 + rng(s) * 0.4);
  N.historial.push(k); if (N.historial.length > 20) N.historial.shift();
  N.tension += 25 + fuerza * 15; N.proxima = d + 5 + Math.floor(rng(s) * 7);   // equilibrado: una crisis cada 5 a 11 días
  s.stats.crisis = (s.stats.crisis || 0) + 1;
  lanzarCrisis(s, k, fuerza);
}
function lanzarCrisis(s, k, f) {
  const R = s.rec, H = humanos(s);
  switch (k) {
    case 'incendio': {
      const lugares = [];
      if (R.heno > 15) lugares.push({ lugar: 'heno', x: LUGAR.heno.x, z: LUGAR.heno.z, nombre: 'el heno del establo' });
      lugares.push({ lugar: 'casa', x: -3.4, z: -4.6, nombre: 'la cocina de la casa' });
      if (s.casa.obra) lugares.push({ lugar: 'obra', x: 9, z: 7.2, nombre: 'la obra' });
      lugares.push({ lugar: 'arbol', x: SOMBRAS.corral[0].x, z: SOMBRAS.corral[0].z, nombre: 'un árbol del potrero (le cayó un rayo)' });
      const L = lugares[Math.floor(rng(s) * lugares.length)];
      s.fuegos = [...(s.fuegos || []), { ...L, intensidad: 0.25 + 0.1 * f, id: s.t }];
      log(s, `🔥 ¡Incendio en ${L.nombre}! Hay que apagarlo con agua antes de que crezca.`, 'malo');
      proponer(s, 'incendio', `¡Incendio en ${L.nombre}!`, `El fuego crece cada minuto. Apagarlo gasta agua del tanque y quien se acerca se puede quemar.`, [
        { k: 'apagar', txt: 'Todos a apagarlo', pista: 'gasta agua; riesgo de quemaduras' },
        { k: 'uno', txt: 'Que lo apague uno solo', pista: 'más lento, el otro sigue con lo suyo' },
        { k: 'dejar', txt: 'Dejar que se consuma', pista: L.lugar === 'casa' ? 'la casa sufre mucho' : 'se pierde lo que se quema' },
      ], 'dejar', {}, 2, 0);   // si no decides, nadie organiza nada y el fuego avanza
      break;
    }
    case 'lobos': {
      const n = Math.max(2, Math.min(4, Math.round(1.5 + f)));
      const llegan = s.t + ((22 - hora(s) + 24) % 24) * 60;   // esta noche a las 22
      s.lobos = { n, x: CORRAL.x0 - 6, z: CORRAL.z0 + 4, llegan, hasta: llegan + 8 * 60, heridos: 0, presa: null, huyendo: false };
      log(s, `🐺 Se oyen aullidos: una manada de ${n} lobos ronda el potrero. Esta noche van a buscar al ganado.`, 'malo');
      proponer(s, 'lobos', `${n} lobos rondan el potrero`, `Esta noche van a atacar. Berlín los va a enfrentar, pero solo no puede con todos.`, [
        { k: 'guardia', txt: 'Hacer guardia toda la noche', pista: 'no duermen, se cansan; espantan a los lobos' },
        { k: 'encerrar', txt: 'Encerrar el ganado', pista: 'los lobos casi no pueden entrar al establo' },
        { k: 'berlin', txt: 'Confiar en Berlín', pista: 'puede salir herido, y perderse algún animal' },
      ], 'berlin', {}, 8, 0);   // sin decisión, Berlín queda solo
      break;
    }
    case 'ladron': {
      const llega = s.t + (26 - hora(s)) * 60;   // la madrugada siguiente
      s.ladron = { x: BLOQUE.x1 - 2, z: BLOQUE.z1 - 4, llega, hasta: llega + 3 * 60, modo: null };
      log(s, `🕵️ Alguien estuvo mirando la granja desde el camino. Algo trama.`, 'aviso');
      proponer(s, 'ladron', 'Un extraño ronda la granja', `Parece que esta noche va a intentar robar. Hay ${Math.round(s.comercio?.monedas || 0)} monedas, vino y conservas guardadas.`, [
        { k: 'enfrentar', txt: 'Esperarlo y enfrentarlo', pista: 'lo espantan, pero alguien puede salir golpeado' },
        { k: 'perro', txt: 'Dejar suelto a Berlín', pista: 'casi siempre lo espanta; Berlín se arriesga' },
        { k: 'esconder', txt: 'Esconder lo valioso y trancar', pista: 'nadie se arriesga; algo se va a llevar' },
      ], 'esconder', {}, 8, 0);   // sin decisión: se encierran y el ladrón roba
      break;
    }
    case 'fiebre': {
      const a = H[Math.floor(rng(s) * H.length)];
      herir(s, a, 'fiebre', 0.55 + 0.2 * f, 'cuerpo', 'por una infección que agarró');
      proponer(s, 'fiebre', `${a.nombre} tiene fiebre muy alta`, `Sin tratamiento empeora cada día. ${R.medicina >= 1 ? `Queda ${Math.floor(R.medicina)} medicina.` : 'No queda medicina.'}`, [
        { k: 'medicina', txt: 'Usar la medicina', pista: R.medicina >= 1 ? 'baja la fiebre rápido' : 'no hay: se hará con remedios' },
        { k: 'medico', txt: 'Traer al médico del pueblo', pista: '120 monedas; cura segura' },
        { k: 'caseros', txt: 'Remedios caseros y reposo', pista: 'gratis, más lento y riesgoso' },
        { k: 'nada', txt: 'Esperar a que pase', pista: 'puede empeorar… y matar' },
      ], 'nada', { quien: null, enfermo: a.id }, 8, 0);
      break;
    }
    case 'pozo': {
      s.pozoRoto = { avance: 0 };
      log(s, `🚱 Se rompió la bomba del pozo: no se puede sacar agua hasta repararlo. El tanque tiene ${Math.round(R.cruda)} L.`, 'malo');
      s.pozoRoto.desde = s.t;
      proponer(s, 'pozo', 'Se rompió el pozo', `No se puede sacar agua. El tanque tiene ${Math.round(R.cruda)} L y la lluvia no es segura.`, [
        { k: 'reparar', txt: 'Repararlo ya', pista: '40 monedas en repuestos y un día de trabajo' },
        { k: 'esperar', txt: 'Esperar y racionar', pista: 'el agua se acaba; los animales sufren' },
      ], 'esperar', {}, 8, 0);
      break;
    }
    case 'forastero': {
      proponer(s, 'forastero', 'Un forastero pide refugio', 'Un viajero herido y con hambre llegó por el camino. Pide quedarse unos días.', [
        { k: 'acoger', txt: 'Acogerlo unos días', pista: 'gasta comida; suele agradecer… casi siempre' },
        { k: 'comida', txt: 'Darle comida y que siga', pista: 'algo de comida y la conciencia tranquila' },
        { k: 'rechazar', txt: 'Que siga su camino', pista: 'nada se pierde… salvo un poco de corazón' },
      ], 'rechazar', {}, 8, 0);
      break;
    }
    case 'intoxicacion': {
      const a = H[Math.floor(rng(s) * H.length)];
      if ((R.conservas || 0) >= 2) R.conservas -= 2;
      herir(s, a, 'intoxicacion', 0.2 + 0.12 * f, 'cuerpo', 'por comer conservas en mal estado');
      break;
    }
    case 'langostas': {
      let n = 0;
      for (const q of s.parcelas) if (q.estado === 'creciendo' && rng(s) < 0.75) { q.plaga = Math.max(q.plaga || 0, 0.7 + 0.15 * f); q.plagaTipo = 'insecto'; q.langosta = true; n++; }
      log(s, `🦗 Llegó una nube de langostas: atacan ${n} parcelas. Hay que tratarlas pronto o se pierde la cosecha.`, 'malo');
      proponer(s, 'langostas', 'Nube de langostas', `Atacan ${n} parcelas y se multiplican rápido.`, [
        { k: 'fumigar', txt: 'Dejar todo y fumigar', pista: 'salva la mayoría; se atrasa lo demás' },
        { k: 'humo', txt: 'Quemar hojas para ahuyentarlas', pista: 'rápido; se pierde una parcela' },
        { k: 'nada', txt: 'Que sigan con lo suyo', pista: 'se comen la cosecha' },
      ], 'nada', {}, 6, 0);
      break;
    }
  }
}
function resolverCrisis(s, d, k) {
  const R = s.rec;
  switch (d.tipo) {
    case 'incendio': s.politica.incendio = k; break;
    case 'pozo': if (k === 'reparar' && s.pozoRoto) { s.pozoRoto.autorizado = true; s.comercio.monedas = Math.max(0, (s.comercio.monedas || 0) - 40); log(s, '🔧 Compraron repuestos para el pozo (40 monedas).', 'info'); } break;
    case 'langostas': {
      const L = s.parcelas.filter((q) => q.langosta && q.estado === 'creciendo');
      if (k === 'fumigar') L.forEach((q) => { q.prioridad = s.t + 2 * MIN_DIA; q.plaga = Math.max(0, q.plaga - 0.25); });
      if (k === 'humo') { const peor = L.sort((x, y) => y.plaga - x.plaga)[0]; if (peor) { peor.estado = 'muerta'; peor.ultimo = peor.cultivo; } L.forEach((q) => { q.plaga = Math.max(0, q.plaga - 0.5); }); log(s, '🦗 Quemaron hojas y el humo ahuyentó a las langostas; se perdió una parcela.', 'info'); }
      break;
    }
    case 'tratamiento': {
      const a = s.agentes.find((x) => x.id === d.datos.paciente && x.vivo); if (!a) break;
      if (k === 'medicina' && R.medicina >= 1) { R.medicina -= 1; for (const h of a.heridas || []) { h.tratada = true; h.medicada = true; h.infeccion = 0; if (h.tipo === 'fiebre') h.sev *= 0.6; } log(s, `💊 Trataron a ${a.nombre} con medicina.`, 'bueno'); }
      else if (k === 'medico' && (s.comercio?.monedas || 0) >= 120) { s.comercio.monedas -= 120; for (const h of a.heridas || []) { h.tratada = true; h.medicada = true; h.infeccion = 0; h.sev *= 0.5; } log(s, `👨‍⚕️ El médico del pueblo atendió a ${a.nombre} (120 monedas).`, 'bueno'); }
      else log(s, `${a.nombre} solo recibió vendas y paciencia.`, 'info');
      break;
    }
    case 'lobos': s.politica.lobos = k; break;
    case 'ladron': if (s.ladron) s.ladron.modo = k; break;
    case 'fiebre': {
      const a = s.agentes.find((x) => x.id === d.datos.enfermo && x.vivo); if (!a) break;
      const h = (a.heridas || []).find((x) => x.tipo === 'fiebre'); if (!h) break;
      if (k === 'medicina' && R.medicina >= 1) { R.medicina -= 1; h.tratada = true; h.sev *= 0.6; log(s, `💊 Le dieron medicina a ${a.nombre}: la fiebre empieza a bajar.`, 'bueno'); }
      else if (k === 'medico' && (s.comercio?.monedas || 0) >= 120) { s.comercio.monedas -= 120; h.tratada = true; h.sev *= 0.4; log(s, `👨‍⚕️ Vino el médico del pueblo y atendió a ${a.nombre} (120 monedas).`, 'bueno'); }
      else { h.casero = true; log(s, `🍵 ${a.nombre} se cuida con remedios caseros y reposo.`, 'info'); if (rng(s) < 0.6) h.tratada = true; }
      break;
    }
    case 'forastero': {
      if (k === 'acoger') { s.forastero = { hasta: s.t + (3 + Math.floor(rng(s) * 3)) * MIN_DIA, bueno: rng(s) < 0.78 }; log(s, '🧳 El forastero se quedará unos días en la granja.', 'info'); humanos(s).forEach((x) => recuerdo(s, x, 'Ayudamos a un forastero', 4, 48)); }
      else if (k === 'comida') { for (let i = 0; i < 5; i++) consumirComida(s, humanos(s)[0] || s.agentes[0], 0); log(s, '🧳 Le dieron comida al forastero y siguió su camino agradecido.', 'info'); humanos(s).forEach((x) => recuerdo(s, x, 'Fuimos generosos', 3, 24)); }
      else { log(s, '🧳 El forastero siguió su camino.', 'info'); humanos(s).forEach((x) => { if (P5(x, 'amabilidad') > 0.55) recuerdo(s, x, 'Le negamos ayuda a alguien', -4, 48); }); }
      break;
    }
  }
}
// lo que pasa minuto a minuto durante las crisis
function crisisTick(s, d) {
  const R = s.rec;
  // incendios: crecen, queman lo que tienen cerca; la lluvia ayuda
  for (const F of s.fuegos || []) {
    F.intensidad = Math.min(2, F.intensidad + d * (0.0025 * (s.sequia > 0 ? 1.6 : 1) * (calor(s) ? 1.3 : 1)) - (s.clima.lluvia ? 0.03 * d : 0));
    if (s.politica?.incendio === 'dejar') F.intensidad -= 0.0012 * d * (F.consumido || 0);
    F.consumido = (F.consumido || 0) + F.intensidad * d / 60;
    if (F.lugar === 'heno') R.heno = Math.max(0, R.heno - 0.25 * F.intensidad * d);
    if (!F.golpe && F.intensidad > 1) { F.golpe = true; humanos(s).forEach((x) => recuerdo(s, x, `El fuego arrasó ${F.nombre}`, -12, 96)); }
    if (F.lugar === 'casa') { s.casa.estado = Math.max(0, s.casa.estado - 0.03 * F.intensidad * d); s.casa.limpieza = Math.max(0, s.casa.limpieza - 0.05 * F.intensidad * d); }
    if (F.lugar === 'obra' && s.casa.obra) s.casa.obra.progreso = Math.max(0, s.casa.obra.progreso - 0.0008 * F.intensidad * d);
    if (F.consumido > (F.lugar === 'casa' ? 10 : 6)) F.intensidad -= 0.01 * d;   // ya no queda qué quemar
    for (const a of s.agentes) if (a.vivo && !a.dentro && Math.hypot(a.pos.x - F.x, a.pos.z - F.z) < 1.2 + F.intensidad && a.tarea?.tipo !== 'apagarFuego' && rng(s) < 0.002 * d * F.intensidad) herir(s, a, 'quemadura', 0.2 + 0.2 * F.intensidad, 'brazo', 'por acercarse al fuego');
    if (F.lugar === 'casa' && F.intensidad > 0.3) for (const a of s.agentes) if (a.vivo && a.dentro) { if (rng(s) < 0.0015 * d * F.intensidad) herir(s, a, 'quemadura', 0.25, 'brazo', 'por el humo y las llamas'); if (a.tipo === 'humano' && a.tarea && a.tarea.tipo !== 'apagarFuego') { soltarTarea(s, a); a.dentro = false; a.pos = { ...LUGAR.puerta }; } }
  }
  if (s.fuegos?.length) {
    for (const F of s.fuegos.filter((x) => x.intensidad <= 0)) log(s, `🔥 Se apagó el fuego en ${F.nombre}.`, 'bueno');
    s.fuegos = s.fuegos.filter((x) => x.intensidad > 0);
    if (!s.fuegos.length) s.politica.incendio = null;
  }
  // lobos: llegan de noche, buscan una presa; Berlín y la guardia los espantan
  const W = s.lobos;
  if (W) {
    if (s.t > W.hasta || W.n <= 0) { if (!W.huyendo) log(s, '🐺 Los lobos se fueron con el amanecer.', 'info'); s.lobos = null; s.politica.lobos = null; }
    else if (s.t >= W.llegan) {
      const presas = s.ganado.filter((g) => g.vivo && !esAve(g.tipo) && (s.politica?.lobos !== 'encerrar' || rng(s) < 0.002));
      if (!W.presa || !presas.includes(s.ganado.find((g) => g.id === W.presa))) W.presa = presas.sort((x, y) => (x.crec - y.crec) || (x.salud - y.salud))[0]?.id;
      const presa = s.ganado.find((g) => g.id === W.presa);
      const destino = W.huyendo ? { x: CORRAL.x0 - 12, z: CORRAL.z0 - 6 } : presa ? presa.pos : { x: CORRAL.x0 + 4, z: 0 };
      const dx = destino.x - W.x, dz = destino.z - W.z, dist = Math.hypot(dx, dz), v = 2.3 * d;
      if (dist > v) { W.x += dx / dist * v; W.z += dz / dist * v; }
      if (W.huyendo && dist < 1) { s.lobos = null; s.politica.lobos = null; }
      else if (!W.huyendo) {
        // defensores: Berlín (protector) y quien haga guardia
        const perro = s.agentes.find((a) => a.vivo && a.tipo === 'perro');
        const guardias = humanos(s).filter((a) => a.tarea?.tipo === 'guardia' && a.tarea.fase === 'trabajo');
        if (perro && !herido(perro, 0.5) && (!perro.tarea || perro.tarea.tipo !== 'defender')) perro.tarea = { tipo: 'defender', fase: 'trabajo', trabajo: 600 };
        const defensa = (perro && !herido(perro, 0.5) ? 0.45 : 0) + guardias.length * 1.6;
        const cerca = (x) => Math.hypot(x.pos.x - W.x, x.pos.z - W.z) < 3;
        if (defensa > 0 && rng(s) < 0.012 * d * defensa / W.n) {
          W.huyendo = true;
          log(s, `🐺 ${guardias.length ? guardias.map((x) => x.nombre).join(' y ') + (perro ? ` y ${perro.nombre}` : '') : perro.nombre} espantaron a los lobos.`, 'bueno');
          for (const g of guardias) recuerdo(s, g, 'Espantamos a los lobos', 8, 48);
        }
        if (perro && cerca(perro) && rng(s) < 0.004 * d * W.n) herir(s, perro, 'mordida', 0.3 + rng(s) * 0.4, 'pierna', 'peleando con los lobos');
        for (const g of guardias) if (cerca(g) && rng(s) < 0.0015 * d * W.n) herir(s, g, 'mordida', 0.3 + rng(s) * 0.3, 'pierna', 'espantando a los lobos');
        if (presa && dist < 1.2 && rng(s) < 0.05 * d) {
          morirAnimal(s, presa, 'atacado por los lobos');
          W.huyendo = true;
        }
      }
    }
  }
  // ladrón: llega de madrugada
  const Lr = s.ladron;
  if (Lr && s.t >= Lr.llega) {
    const objetivo = { x: 4, z: 8 }, dx = objetivo.x - Lr.x, dz = objetivo.z - Lr.z, dist = Math.hypot(dx, dz);
    if (dist > 1.8 * d) { Lr.x += dx / dist * 1.8 * d; Lr.z += dz / dist * 1.8 * d; }
    else if (!Lr.hecho) {
      Lr.hecho = true;
      const perro = s.agentes.find((a) => a.vivo && a.tipo === 'perro');
      const modo = Lr.modo || 'perro';
      const H = humanos(s);
      if (modo === 'enfrentar' && rng(s) < 0.85) {
        log(s, `🕵️ ${H.map((x) => x.nombre).join(' y ')} sorprendieron al ladrón y salió corriendo.`, 'bueno');
        if (rng(s) < 0.3 && H[0]) herir(s, H[Math.floor(rng(s) * H.length)], 'golpe', 0.3 + rng(s) * 0.3, 'cabeza', 'forcejeando con el ladrón');
        H.forEach((x) => recuerdo(s, x, 'Espantamos al ladrón', 6, 48));
      } else if (modo === 'perro' && perro && rng(s) < 0.8) {
        log(s, `🕵️ ${perro.nombre} se le tiró encima al ladrón y lo hizo huir.`, 'bueno');
        if (rng(s) < 0.2) herir(s, perro, 'golpe', 0.3, 'cuerpo', 'defendiendo la casa');
        vincular(s, perro, H[0], 5); vincular(s, perro, H[1], 5);
      } else {
        const robo = [];
        const m = Math.round((s.comercio?.monedas || 0) * (modo === 'esconder' ? 0.15 : 0.4)); if (m > 0) { s.comercio.monedas -= m; robo.push(`${m} monedas`); }
        if (R.vino >= 2) { const v = Math.min(R.vino, modo === 'esconder' ? 2 : 6); R.vino -= v; robo.push(`${Math.round(v)} botellas de vino`); }
        if ((R.conservas || 0) >= 4) { R.conservas -= 4; robo.push('4 conservas'); }
        log(s, `🕵️ Entró un ladrón de madrugada y se llevó ${robo.join(', ') || 'casi nada'}.`, 'malo');
        H.forEach((x) => recuerdo(s, x, 'Nos robaron', -14, 96));
      }
      s.ladron = null;
    }
  }
  if (Lr && s.ladron && s.t > Lr.hasta) s.ladron = null;
  // forastero: al irse agradece (o roba)
  const Fo = s.forastero;
  if (Fo && s.t >= Fo.hasta) {
    if (Fo.bueno) {
      const regalo = rng(s) < 0.5 ? (s.comercio.monedas += 60, '60 monedas') : (Object.keys(R.semillas).forEach((c) => { R.semillas[c] += 3; }), 'semillas de todo tipo');
      log(s, `🧳 El forastero se despidió muy agradecido y les dejó ${regalo}.`, 'bueno'); humanos(s).forEach((x) => recuerdo(s, x, 'El forastero agradeció', 6, 48));
    } else { const m = Math.round((s.comercio?.monedas || 0) * 0.3); s.comercio.monedas -= m; log(s, `🧳 El forastero se fue de madrugada… y con él ${m} monedas.`, 'malo'); humanos(s).forEach((x) => recuerdo(s, x, 'Nos engañó el forastero', -8, 72)); }
    s.forastero = null;
  }
  if (Fo && s.forastero && rng(s) < d / MIN_DIA * 2) consumirComida(s, s.agentes[0], 0);   // come con ellos
}

// ---------------------------------------------------------------- quiebres mentales (cuando el ánimo toca fondo)
const QUIEBRE = {
  atracon: ['un atracón', 'se puso a comer sin parar', 'menor'], llanto: ['un ataque de llanto', 'se encerró a llorar', 'menor'], deambular: ['un ataque de angustia', 'se fue a caminar sin rumbo', 'menor'],
  portazos: ['un ataque de mal genio', 'anda dando portazos y gritándole a todo', 'menor'],
  borrachera: ['una borrachera', 'se puso a tomar sin control', 'mayor'], berrinche: ['un berrinche', 'rompió cosas de la casa', 'mayor'], huida: ['una huida', 'se fue al monte y no quiere volver por ahora', 'mayor'],
  colapso: ['un colapso', 'no se puede levantar de la cama', 'extremo'],
};
function quiebres(s) {   // cada media hora
  for (const a of humanos(s)) {
    if (a.quiebre || !despierto(s, a) || a.nadando) continue;
    const ani = a.animo, nivelQ = ani < 6 ? 'extremo' : ani < 15 ? 'mayor' : ani < 25 ? 'menor' : null;
    if (!nivelQ) continue;
    const p = { menor: 0.02, mayor: 0.03, extremo: 0.05 }[nivelQ] * (0.5 + P5(a, 'neuroticismo')) * (tiene(a, 'tranquilo') ? 0.5 : 1);
    if (rng(s) > p) continue;
    const ops = Object.entries(QUIEBRE).filter(([k, q]) => q[2] === nivelQ || (nivelQ === 'extremo' && q[2] === 'mayor'))
      .filter(([k]) => (k !== 'borrachera' || (s.rec.vino >= 1 && (HAB(a).placeres?.vino ?? 0) > 0.3)) && (k !== 'atracon' || comidaTotal(s) > 10) && (k !== 'portazos' || tiene(a, 'malgenio')));
    const peso = ([k]) => (k === 'berrinche' || k === 'portazos' ? (tiene(a, 'malgenio') ? 3 : 1) : k === 'huida' ? (tiene(a, 'hiperactivo') ? 2 : 1) : k === 'borrachera' ? 1 + (HAB(a).placeres?.vino ?? 0) * 2 : 1);
    let r = rng(s) * ops.reduce((t, o) => t + peso(o), 0), elegido = ops[0];
    for (const o of ops) { if ((r -= peso(o)) <= 0) { elegido = o; break; } }
    empezarQuiebre(s, a, elegido[0]);
  }
}
function empezarQuiebre(s, a, k) {
  const q = QUIEBRE[k], horas = { atracon: 2, llanto: 4, deambular: 3, portazos: 3, borrachera: 3, berrinche: 1.5, huida: 18, colapso: 20 }[k];
  a.quiebre = { tipo: k, hasta: s.t + horas * 60 };
  soltarTarea(s, a);
  log(s, `⚠️ ${a.nombre} tuvo ${q[0]}: ${q[1]}.`, 'malo');
  efecto(s, k === 'llanto' || k === 'colapso' ? 'llanto' : k === 'borrachera' ? 'borrachera' : 'quiebre', a.pos.x, a.pos.z, { dentro: a.dentro });
  const b = pareja(s, a); if (b) recuerdo(s, b, `${a.nombre} se quebró`, -5, 24);
  s.stats.quiebres = (s.stats.quiebres || 0) + 1;
  if (k === 'berrinche') {
    const roto = (s.comercio?.lujos || []).length && rng(s) < 0.4 ? s.comercio.lujos.splice(Math.floor(rng(s) * s.comercio.lujos.length), 1)[0] : null;
    if (roto) log(s, `En el berrinche se rompió ${LUJOS.find((l) => l[0] === roto)?.[1] || 'algo valioso'}.`, 'malo');
    else { s.casa.estado = Math.max(0, s.casa.estado - 8); s.casa.limpieza = Math.max(0, s.casa.limpieza - 25); }
  }
  if (k === 'portazos') { s.pareja.tension = Math.min(100, (s.pareja.tension || 0) + 15); }
}
function tareaDeQuiebre(s, a) {
  const Q = a.quiebre;
  if (s.t >= Q.hasta) {
    a.quiebre = null;
    recuerdo(s, a, 'Catarsis', 12, 48);   // después de quebrarse, se siente liviano un tiempo (como en RimWorld)
    log(s, `${a.nombre} se repuso del ${QUIEBRE[Q.tipo][0].replace(/^un |^una /, '')}.`, 'info');
    return null;
  }
  const quedan = Q.hasta - s.t;
  switch (Q.tipo) {
    case 'atracon': if (comidaTotal(s) >= 1) return crearTarea(s, a, 'comer', { trabajo: 20, atracon: true }); break;
    case 'llanto': case 'colapso': return crearTarea(s, a, 'reposo', { trabajo: Math.min(quedan, 120), quiebre: true });
    case 'deambular': case 'huida': {
      const ang = rng(s) * Math.PI * 2, r = Q.tipo === 'huida' ? 40 + rng(s) * 6 : 10 + rng(s) * 20;
      return crearTarea(s, a, 'deambular', { trabajo: Math.min(quedan, Q.tipo === 'huida' ? 180 : 40), destino: { x: 2 + Math.cos(ang) * r, z: 6 + Math.sin(ang) * r } });
    }
    case 'borrachera': if (s.rec.vino >= 0.25) { a.borrachera = true; return crearTarea(s, a, 'tomarVino', { trabajo: 30 }); } break;
    case 'portazos': case 'berrinche': return crearTarea(s, a, 'deambular', { trabajo: 30, destino: { ...LUGAR.puerta } });
  }
  return crearTarea(s, a, 'reposo', { trabajo: Math.min(quedan, 60), quiebre: true });
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
    && [a, b].every((x) => x.n.energia > 30 && x.n.comida > 35 && x.n.agua > 35 && x.animo > ((x.deseoSex || 0) > 70 ? 40 : 52) && x.tarea?.tipo === 'dormir')
    && s.pareja.afinidad > 60 && s.casa.limpieza > 40) {
    s.pareja.ultimaIntimidad = dia(s);
    const prob = 0.06 + (s.pareja.afinidad - 60) / 260 + (s.pareja.recetaNueva ? 0.05 : 0) + Math.min(0.1, (dia(s) - (s.pareja.diaIntimo ?? -99)) / 100) + ([a, b].some((x) => tiene(x, 'romantico')) ? 0.025 : 0) - (s.pareja.tension || 0) / 300
      + ((a.deseoSex || 0) + (b.deseoSex || 0)) / 500 + ([a, b].some((x) => s.t - (x.vinoT || -1e9) < 300 && !(x.borrachoHasta > s.t)) ? 0.08 : 0);
    if (rng(s) > prob) return;
    concebir(s);
    const iniciativa = [a, b].sort((x, y) => (P5(y, 'extraversion') - P5(y, 'neuroticismo')) - (P5(x, 'extraversion') - P5(x, 'neuroticismo')))[0];
    const gato = s.agentes.find((x) => x.tipo === 'gato' && x.vivo && x.dentro);
    if (gato && rng(s) < 0.4) {
      log(s, `Un momento romántico entre ${a.nombre} y ${b.nombre}… hasta que ${gato.nombre} saltó a la cama. 🐈‍⬛`, 'info');
      [a, b].forEach((x) => recuerdo(s, x, 'El gato interrumpió', 3, 8));
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 1);
    } else {
      s.pareja.diaIntimo = dia(s);
      log(s, `${iniciativa.nombre} tomó la iniciativa: ${a.nombre} y ${b.nombre} pasaron un rato a solas. 💞`, 'bueno');
      // hacer el amor: el mayor alegrón del día, relaja y borra tensiones
      [a, b].forEach((x) => { recuerdo(s, x, 'Noche romántica', 18, 30); recuerdo(s, x, 'Relajado y en paz', 4, 14); cumplirDeseo(s, x, 'nocheRomantica'); x.deseoSex = 0; x.n.diversion = Math.min(100, x.n.diversion + 25); x.n.social = 100; });
      s.pareja.afinidad = Math.min(100, s.pareja.afinidad + 6); s.pareja.intimidad += 1; s.pareja.tension = Math.max(0, (s.pareja.tension || 0) - 20);
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
  if (a.trepado && a.tarea?.tipo !== 'trepar') { const q = TREPADEROS[a.trepado.sitio]; if (q) a.pos = { ...q.base }; a.trepado = null; }   // se baja
  if (!a.tarea) {
    const cocinando = humanos(s).find((h) => h.tarea?.tipo === 'cocinar' && h.tarea.fase === 'trabajo');
    if (n.agua < 45 && R.bebedero >= 0.5) a.tarea = { tipo: 'beber', fase: 'camino', destino: { x: LUGAR.comedero.x - 0.5, z: LUGAR.comedero.z + 0.4 }, trabajo: 3 };
    else if (n.comida < 22 && R.comedero < 0.3 && (R.raciones >= 1 || (R.secos || 0) >= 1)) a.tarea = { tipo: 'robarComida', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 4 };
    else if (n.agua < 30) a.tarea = { tipo: 'beberPiscina', fase: 'camino', destino: { x: LUGAR.piscina.x - 0.3, z: LUGAR.piscina.z }, trabajo: 3 };   // sin agua en el plato: de la piscina
    else if (n.comida < 45 && R.comedero >= 0.3) a.tarea = { tipo: 'comer', fase: 'camino', destino: { x: LUGAR.comedero.x + 0.3, z: LUGAR.comedero.z + 0.6 }, trabajo: 10 };
    else if (gato && cocinando && rng(s) < 0.02) a.tarea = { tipo: 'pedir', fase: 'camino', destino: { ...LUGAR.puerta }, trabajo: 30, dentro: true };
    // juegan entre ellos: el perro persigue al gato (de día, si los dos están libres)
    else if (!esNoche(s) && n.energia > 30 && rng(s) < 0.05 && (() => { const o = s.agentes.find((x) => x !== a && x.vivo && esMascota(x)); return o && (!o.tarea || ['siesta', 'seguir', 'explorar'].includes(o.tarea.tipo)) && !o.dentro && !a.dentro; })()) {
      const o = s.agentes.find((x) => x !== a && x.vivo && esMascota(x));
      const lugar = { x: 8 + (rng(s) - 0.5) * 14, z: 22 + (rng(s) - 0.5) * 8 };
      a.tarea = { tipo: 'jugarJuntos', fase: 'camino', destino: { ...lugar }, trabajo: 15 + rng(s) * 20, centro: lugar, con: o.id };
      o.tarea = { tipo: 'jugarJuntos', fase: 'camino', destino: { x: lugar.x + 1.5, z: lugar.z }, trabajo: a.tarea.trabajo, centro: lugar, con: a.id };
      if (rng(s) < 0.25) log(s, `${a.nombre} y ${o.nombre} jugaron a perseguirse por el jardín.`, 'info');
    }
    // el gato se trepa por todos lados: árboles, techo de la casa, caseta, gallinero, pozo
    else if (gato && !esNoche(s) && n.energia > 30 && rng(s) < 0.09 * (tiene(a, 'trepador') ? 1.6 : 1)) {
      const i = Math.floor(rng(s) * TREPADEROS.length), q = TREPADEROS[i];
      a.tarea = { tipo: 'trepar', fase: 'camino', destino: { ...q.base }, trabajo: 25 + rng(s) * 50, sitio: i };
    }
    // y se mete al gallinero a molestar a las gallinas
    else if (gato && tiene(a, 'travieso') && !esNoche(s) && n.energia > 35 && rng(s) < 0.05 && s.ganado.some((g) => g.vivo && esAve(g.tipo) && !g.refugio)) {
      a.tarea = { tipo: 'molestarGallinas', fase: 'camino', destino: puntoEn(s, GALLINERO, 2), trabajo: 10 + rng(s) * 12 };
    }
    // el perro molesta al gato: lo persigue (el gato huye a trepar) y a veces se pelean
    else if (perro && !esNoche(s) && n.energia > 35 && rng(s) < 0.05 * (tiene(a, 'jugueton') ? 1.5 : 1) && (() => { const c = s.agentes.find((x) => x.tipo === 'gato' && x.vivo); return c && !c.dentro && !c.trepado && !['dormir', 'dormirCon', 'regazo', 'huir', 'pelea'].includes(c.tarea?.tipo) && Math.hypot(c.pos.x - a.pos.x, c.pos.z - a.pos.z) < 25; })()) {
      const c = s.agentes.find((x) => x.tipo === 'gato' && x.vivo);
      const i = trepaderoCerca(c, true);
      c.tarea = { tipo: 'huir', fase: 'camino', destino: { ...TREPADEROS[i].base }, trabajo: 1, sitio: i };
      a.tarea = { tipo: 'perseguir', fase: 'trabajo', trabajo: 10, con: c.id };
      if (rng(s) < 0.35) log(s, `${a.nombre} salió corriendo detrás de ${c.nombre}.`, 'info');
    }
    // protector: le ladra a los extraños (el comerciante)
    else if (perro && tiene(a, 'protector') && s.comercio?.visita && !s.comercio.visita.ladrado && hora(s) > 7) {
      s.comercio.visita.ladrado = true;
      a.tarea = { tipo: 'ladrar', fase: 'camino', destino: { x: LUGAR.carreta.x - 2.6, z: LUGAR.carreta.z + 0.6 }, trabajo: 6 };
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
    if (mover(a, T.destino, d * (T.tipo === 'huir' ? 1.35 : 1))) { T.fase = 'trabajo'; if (T.dentro) a.dentro = true; }
    return;
  }
  if (T.tipo === 'defender') {
    if (!s.lobos) { a.tarea = null; return; }
    mover(a, { x: s.lobos.x + 1, z: s.lobos.z }, d * 1.1);
    return;
  }
  if (T.tipo === 'huir') {   // llegó al árbol: se trepa
    a.tarea = { tipo: 'trepar', fase: 'trabajo', destino: { ...T.destino }, trabajo: 18 + rng(s) * 30, sitio: T.sitio, huyendo: true };
    return;
  }
  if (T.tipo === 'trepar') {
    const q = TREPADEROS[T.sitio] || TREPADEROS[0];
    if (!T.arriba) {
      T.arriba = true; a.trepado = { alto: q.alto, sitio: T.sitio }; a.pos = { x: q.x, z: q.z };
      if (!T.huyendo && rng(s) < 0.2) log(s, `🐈‍⬛ ${a.nombre} se trepó ${q.nombre} y mira todo desde arriba.`, 'info');
      if (q.arbol && rng(s) < 0.05) {
        const h = favorito(s, a) || humanos(s)[0];
        T.trabajo += 40;
        if (h) { log(s, `${a.nombre} se subió ${q.nombre} y no sabía bajar: ${h.nombre} tuvo que bajarlo.`, 'info'); vincular(s, a, h, 4); recuerdo(s, h, `Bajó a ${a.nombre} del árbol`, 3, 8); }
      }
    }
    n.diversion = Math.min(100, n.diversion + 0.6 * d); n.energia = Math.min(100, n.energia + 0.04 * d);
    T.trabajo -= d;
    if (T.trabajo <= 0) { a.trepado = null; a.pos = { ...T.destino }; a.tarea = null; }
    return;
  }
  if (T.tipo === 'molestarGallinas') {
    const aves = s.ganado.filter((g) => g.vivo && esAve(g.tipo) && !g.refugio);
    const presa = aves.sort((x, y) => Math.hypot(x.pos.x - a.pos.x, x.pos.z - a.pos.z) - Math.hypot(y.pos.x - a.pos.x, y.pos.z - a.pos.z))[0];
    if (!T.aviso) { T.aviso = true; efecto(s, 'alboroto', a.pos.x, a.pos.z); if (rng(s) < 0.5) log(s, `🐔 ${a.nombre} se metió al gallinero a perseguir gallinas: alboroto general.`, 'info'); }
    if (presa) mover(a, presa.pos, d * 1.2);
    for (const g of aves) {
      const dx = g.pos.x - a.pos.x, dz = g.pos.z - a.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 3) continue;
      g.estres = Math.min(100, (g.estres || 0) + 0.8 * d);   // las gallinas se asustan y huyen
      g.dest = { x: Math.max(GALLINERO.x0 + 0.8, Math.min(GALLINERO.x1 - 0.8, g.pos.x + dx / (dist || 1) * 3)), z: Math.max(GALLINERO.z0 + 0.8, Math.min(GALLINERO.z1 - 0.8, g.pos.z + dz / (dist || 1) * 3)) };
      g.espera = 0; g.comiendo = false;
      if (g.tipo === 'gallo' && dist < 1.4 && rng(s) < 0.03 * d) {   // el gallo lo saca a picotazos
        log(s, `🐓 ${g.nombre} le dio un picotazo a ${a.nombre} y lo sacó corriendo del gallinero.`, 'info');
        const i = trepaderoCerca(a, false);
        a.tarea = { tipo: 'huir', fase: 'camino', destino: { ...TREPADEROS[i].base }, trabajo: 1, sitio: i };
        return;
      }
    }
    if (!T.huevo && s.rec.nido >= 1 && rng(s) < 0.01 * d) { T.huevo = true; s.rec.nido -= 1; log(s, `${a.nombre} rompió un huevo del nido.`, 'info'); }
    n.diversion = Math.min(100, n.diversion + 1.2 * d);
    T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null;
    return;
  }
  if (T.tipo === 'perseguir') {
    const c = s.agentes.find((x) => x.id === T.con && x.vivo);
    if (!c || c.dentro) { a.tarea = null; return; }
    if (c.trepado) {   // el gato ya está arriba: le ladra desde abajo
      if (!T.ladro) { T.ladro = true; efecto(s, 'ladrido', a.pos.x, a.pos.z); }
      mover(a, { x: c.pos.x + 0.9, z: c.pos.z + 0.5 }, d);
    } else {
      mover(a, c.pos, d * 1.1);
      if (!T.pelea && Math.hypot(c.pos.x - a.pos.x, c.pos.z - a.pos.z) < 0.8) {
        T.pelea = true;
        if (rng(s) < 0.5) {   // lo alcanzó: se pelean (casi siempre jugando)
          const centro = { x: (a.pos.x + c.pos.x) / 2, z: (a.pos.z + c.pos.z) / 2 };
          a.tarea = { tipo: 'pelea', fase: 'trabajo', trabajo: 2.5, centro, con: c.id };
          c.tarea = { tipo: 'pelea', fase: 'trabajo', trabajo: 2.5, centro, con: a.id };
          const enSerio = rng(s) < 0.1;   // casi siempre es juego; de vez en cuando se pone seria
          a.tarea.enSerio = c.tarea.enSerio = enSerio;
          efecto(s, 'pelea', centro.x, centro.z);
          a.n.diversion = Math.min(100, a.n.diversion + 15); c.n.diversion = Math.min(100, c.n.diversion + 8);
          if (enSerio) {
            a.n.salud = Math.max(1, a.n.salud - 2); c.n.salud = Math.max(1, c.n.salud - 2);
            log(s, `💥 ${a.nombre} y ${c.nombre} se pelearon en serio: pelos y bufidos por todos lados.`, 'malo');
            const h = humanos(s).find((x) => !x.dentro && Math.hypot(x.pos.x - centro.x, x.pos.z - centro.z) < 12);
            if (h) { recuerdo(s, h, 'Tuvo que separar a Berlín y Axel', -2, 6); log(s, `${h.nombre} tuvo que separarlos.`, 'info'); }
          } else if (rng(s) < 0.3) {
            log(s, `${a.nombre} y ${c.nombre} se revolcaron jugando a pelear. 🐕🐈‍⬛`, 'info');
            const h = humanos(s).find((x) => !x.dentro && Math.hypot(x.pos.x - centro.x, x.pos.z - centro.z) < 15);
            if (h) recuerdo(s, h, 'Se rió viendo a Berlín y Axel', 2, 4);
          }
          return;
        }
      }
    }
    n.diversion = Math.min(100, n.diversion + 1.5 * d); n.energia = Math.max(0, n.energia - 0.15 * d);
    T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null;
    return;
  }
  if (T.tipo === 'pelea') {
    // dan vueltas peleando un momento; después el gato huye a trepar
    const ang = s.t * 3 + (gato ? Math.PI : 0);
    a.pos.x = T.centro.x + Math.cos(ang) * 0.45; a.pos.z = T.centro.z + Math.sin(ang) * 0.45;
    T.trabajo -= d;
    if (T.trabajo <= 0) {
      if (gato) { const i = trepaderoCerca(a, true); a.tarea = { tipo: 'huir', fase: 'camino', destino: { ...TREPADEROS[i].base }, trabajo: 1, sitio: i }; }
      else a.tarea = null;
    }
    return;
  }
  if (T.tipo === 'ladrar') {
    if (!T.aviso) { T.aviso = true; efecto(s, 'ladrido', a.pos.x, a.pos.z); log(s, `🐕 ${a.nombre} le ladró a ${COMERCIANTE} hasta que lo calmaron: nadie se acerca a su gente sin permiso.`, 'info'); }
    T.trabajo -= d; if (T.trabajo <= 0) a.tarea = null;
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
  if (T.tipo === 'beberPiscina') n.agua = Math.min(100, n.agua + 45);
  if (T.tipo === 'robarComida') { const k = R.raciones >= 1 ? 'raciones' : 'secos'; R[k] = Math.max(0, R[k] - 1); n.comida = Math.min(100, n.comida + 40); if (rng(s) < 0.4) log(s, `${a.nombre} tenía el plato vacío y se robó comida de la cocina.`, 'info'); }
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
export function guardar(s) {
  try {
    s.guardadoReal = Date.now();
    const txt = JSON.stringify(s);
    if (!txt || txt.length < 100) return false;
    // la partida anterior queda como respaldo antes de sobrescribirla
    const prev = localStorage.getItem(CLAVE);
    if (prev && validar(prev)) localStorage.setItem(CLAVE + '-respaldo', prev);
    localStorage.setItem(CLAVE, txt);
    return true;
  } catch { return false; }
}
function validar(txt) {
  try { const s = typeof txt === 'string' ? JSON.parse(txt) : txt; return !!(s && Array.isArray(s.agentes) && s.agentes.length && Array.isArray(s.parcelas) && s.rec && Number.isFinite(s.t)) && s; } catch { return false; }
}
export function cargar() {
  // si la partida está dañada, se usa el respaldo
  let s = null;
  try { s = validar(localStorage.getItem(CLAVE)); } catch { s = null; }
  if (!s) { try { s = validar(localStorage.getItem(CLAVE + '-respaldo')); if (s) s.recuperada = true; } catch { s = null; } }
  return migrar(s);
}
function migrar(s) {
  try {
    if (!(s && s.version === VERSION && s.config === CONFIG)) return null;
    // los nombres salen siempre de las fichas: cambiarlos no reinicia la partida
    for (const a of s.agentes) {
      const p = PERSONAJES.find((x) => x.id === a.id);
      if (p) { a.nombre = p.nombre; a.rasgos = [...p.rasgos]; }   // nombres y rasgos salen siempre de las fichas
      a.memorias ??= []; a.xp.carpinteria ??= 0;
      if (esMascota(a)) a.vinculo ??= Object.fromEntries(PERSONAJES.filter((h) => h.tipo === 'humano').map((h) => [h.id, Math.round((h.habitos?.animales?.[a.id] ?? 0.5) * 100)]));
    }
    for (let i = s.parcelas.length; i < PARCELAS.length; i++) s.parcelas.push({ id: i, x: PARCELAS[i].x, z: PARCELAS[i].z, cultivo: null, crec: 0, agua: 60, estado: 'vacia', secoMin: 0, listaMin: 0, reservada: null });
    for (const p of s.parcelas) for (const [k, v] of Object.entries(sueloNuevo())) p[k] ??= v;
    for (const [id, nombre, horas] of OBRAS) if (!s.obras?.some((o) => o.id === id)) (s.obras ||= []).splice(OBRAS.findIndex((o) => o[0] === id), 0, { id, nombre, horas, progreso: 0 });
    s.frutales ??= FRUTALES.map((f, i) => ({ id: i, ...f, fruta: 0 }));
    s.jardines ??= JARDINES.map((j, i) => ({ id: i, x: j.x, z: j.z, flor: j.flor, cuidado: 0.3, flores: 0 }));
    s.obras ??= OBRAS.map(([id, nombre, horas]) => ({ id, nombre, horas, progreso: 0 })); s.esculturas ??= 0; s.avanceEscultura ??= 0; s.belleza ??= 10;
    s.casa.estado ??= 100; s.casa.mejoras ??= []; s.casa.estilo ??= null; s.casa.obra ??= null; s.casa.turno ??= 0; s.desbloqueos ??= []; s.pareja.tension ??= 0; s.pareja.pendiente ??= null;
    { const n = placeresNuevos(); s.parras ??= n.parras; s.matas ??= n.matas; s.barricas ??= []; s.curado ??= [];
      for (let i = s.parras.length; i < PARRAS_BASE; i++) s.parras.push(n.parras[i]); for (let i = s.matas.length; i < MATAS.length; i++) s.matas.push(n.matas[i]); }
    s.comercio ??= comercioNuevo(s.t);
    if (!s.ahorrosIniciales) { s.ahorrosIniciales = true; s.comercio.monedas = (s.comercio.monedas || 0) + 150; s.comercio.proxima = Math.min(s.comercio.proxima, dia(s) + 2); log(s, '🪙 Encontraron 150 monedas ahorradas en una lata vieja: alcanza para empezar a arreglar la casa.', 'bueno'); }
    s.narrador ??= narradorNuevo(s.t); s.fuegos ??= []; s.prioridades ??= {}; s.familia ??= familiaNueva(); s.caminos ??= caminosNuevos(); for (const c of CAMINOS) s.caminos[c.id] ??= { progreso: 0, uso: 0 };
    // fichas nuevas (2026-10-05): las mascotas toman la afinidad que el usuario definió (una sola vez)
    if ((s.fichaVersion || 1) < 2) { s.fichaVersion = 2; for (const m of s.agentes) if (m.vinculo) for (const h of PERSONAJES.filter((x) => x.tipo === 'humano')) m.vinculo[h.id] = Math.round((h.habitos?.animales?.[m.id] ?? 0.5) * 100); }
    if (!s.jugador) Object.assign(s, jugadorNuevo());
    for (const k of ['uvas', 'vino', 'hierba', 'medicina', 'libros']) s.rec[k] ??= { vino: 6, hierba: 3, medicina: 1 }[k] ?? 0;
    for (const a of s.agentes) if (a.tipo === 'humano') { a.placer ??= placerNuevo(); a.deseoSex ??= 40; a.forma ??= a.rasgos.includes('fuerte') ? 60 : 40; }
    aplicarProyectos(s);
    for (const g of s.ganado) { g.enfermo ??= 0; g.adn ??= adnFundador(s); g.consang ??= 0; g.estres ??= 10; g.generacion ??= 0; g.padre ??= null; }
    s.stats ??= {}; s.efectos ??= []; s.diario ??= [];
    for (const a of s.agentes) if (a.tarea && a.tarea.fase === 'camino' && !a.tarea.destino) a.tarea = null;
    sanear(s);
    if (s.recuperada) { log(s, 'La partida guardada estaba dañada: se recuperó la copia de respaldo.', 'aviso'); delete s.recuperada; }
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
