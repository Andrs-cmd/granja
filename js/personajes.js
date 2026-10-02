// =====================================================================
// Fichas de los habitantes de la granja.
// Para darles rasgos nuevos se edita este archivo (y se cambia CONFIG para
// que arranque una generación nueva con las fichas actualizadas).
//
// RASGOS: modifican números concretos de la simulación.
//   hambre, sed, cansancio → qué tan rápido baja esa necesidad (1 = normal)
//   huerto, agua, cuidado, casa → velocidad de trabajo en esa área
//   pozo · cosecha · aprende · enfermar → litros del pozo, raciones por cosecha, aprendizaje, riesgo de enfermar
//
// PERSONALIDAD (Big Five, de 0 a 1):
//   apertura         → prueba cultivos y recetas nuevas; las comidas nuevas le alegran más
//   responsabilidad  → riega antes de que la tierra se seque, mantiene reservas y la casa limpia
//   extraversion     → necesita compañía más seguido y busca a su pareja para conversar
//   amabilidad       → evita discusiones y comparte la comida cuando escasea
//   neuroticismo     → cuánto le afectan las malas noticias, el hambre y el cansancio
//
// HÁBITOS:
//   cronotipo  'madrugador' (5:30 a 21:30) · 'normal' (6:30 a 22:30) · 'noctambulo' (8:00 a 00:30)
//   ocio       actividades favoritas: 'leer' · 'tallar' · 'contemplar' · 'jugarGato' · 'pasearPerro'
//   comida     cultivo favorito: comerlo le sube el ánimo
//   animales   afinidad con cada mascota (0 a 1)
//   estres     cuando escasean las reservas: 'trabaja' (más rápido, se cansa más) · 'raciona' (aguanta más sin comer)
//   rol        área que prefiere cuando hay varias tareas: 'agua' · 'huerto' · 'cuidado' · 'casa'
//
// FÍSICO: andar 'zancada' o 'cadera'; detalles 'sombrero' 'barba' 'pecas' 'diadema' 'collar' 'pañuelo'
// =====================================================================

export const CONFIG = '2026-10-02c';   // cambiarlo reinicia la granja con las fichas nuevas

export const RASGOS = {
  fuerte: { nombre: 'Fuerte', desc: 'Saca 50 % más agua del pozo.', mod: { pozo: 1.5 } },
  comilon: { nombre: 'Comilón', desc: 'Le da hambre 20 % más rápido.', mod: { hambre: 1.2 } },
  manoVerde: { nombre: 'Mano verde', desc: 'Trabaja el huerto 40 % más rápido y cosecha 15 % más.', mod: { huerto: 1.4, cosecha: 1.15 } },
  ahorradora: { nombre: 'Ahorradora', desc: 'Le da hambre 15 % más lento.', mod: { hambre: 0.85 } },
  leal: { nombre: 'Leal', desc: 'Sigue a la pareja a todas partes y espanta plagas.', mod: { leal: 1 } },
  cazador: { nombre: 'Cazador', desc: 'Caza ratones en el huerto cuando tiene hambre.', mod: { cazador: 1 } },
};

export const PERSONAJES = [
  {
    id: 'tomas', tipo: 'humano', nombre: 'Tomás', rasgos: ['fuerte', 'comilon'],
    personalidad: { apertura: 0.35, responsabilidad: 0.8, extraversion: 0.4, amabilidad: 0.6, neuroticismo: 0.45 },
    habitos: { cronotipo: 'madrugador', ocio: ['tallar', 'pasearPerro', 'contemplar'], comida: 'papa', animales: { nube: 0.9, esmoquin: 0.5 }, estres: 'trabaja', rol: 'agua' },
    fisico: { andar: 'zancada', detalles: ['sombrero', 'barba'] },
    motivacion: 'Proteger a su familia y que nunca falte el agua.',
    voz: 'Grave y pausada; postura abierta, habla poco y actúa.',
  },
  {
    id: 'lucia', tipo: 'humano', nombre: 'Lucía', rasgos: ['manoVerde', 'ahorradora'],
    personalidad: { apertura: 0.8, responsabilidad: 0.55, extraversion: 0.75, amabilidad: 0.75, neuroticismo: 0.55 },
    habitos: { cronotipo: 'noctambulo', ocio: ['leer', 'jugarGato', 'contemplar'], comida: 'lechuga', animales: { nube: 0.6, esmoquin: 0.95 }, estres: 'raciona', rol: 'huerto' },
    fisico: { andar: 'cadera', detalles: ['pecas', 'diadema'] },
    motivacion: 'Que el huerto prospere y siempre haya reservas.',
    voz: 'Cálida y rápida; planifica en voz alta.',
  },
  {
    id: 'nube', tipo: 'perro', nombre: 'Nube', rasgos: ['leal'],
    fisico: { detalles: ['collar'] },
    motivacion: 'Estar cerca de su gente (y salir a pasear).',
  },
  {
    id: 'esmoquin', tipo: 'gato', nombre: 'Esmoquin', rasgos: ['cazador'],
    fisico: { detalles: [] },
    motivacion: 'Su independencia, los ratones y dormir con quien más lo necesite.',
  },
];
