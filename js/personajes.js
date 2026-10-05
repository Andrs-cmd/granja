// =====================================================================
// Fichas de los habitantes de la granja.
// Para darles rasgos nuevos se edita este archivo (y se cambia CONFIG para
// que arranque una generación nueva con las fichas actualizadas).
//
// RASGOS: modifican números concretos de la simulación.
//   hambre, sed, cansancio → qué tan rápido baja esa necesidad (1 = normal)
//   huerto, agua, cuidado, casa → velocidad de trabajo en esa área
//   pozo · cosecha · aprende · enfermar → litros del pozo, raciones por cosecha, aprendizaje, riesgo de enfermar
//   carpinteria · aprende_<oficio> → velocidad en carpintería / aprende ese oficio más rápido
//   los rasgos sin número (gruñón, romántico, alergia, chef, juguetón, guardián, travieso, mimoso…) activan comportamientos
//   (los rasgos se leen siempre de esta ficha: cambiarlos NO reinicia la granja)
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
//   ocio       actividades favoritas: 'leer' · 'tallar' · 'contemplar' · 'jugarGato' · 'pasearPerro' · 'nadar' · 'tejer'
//   comida     cultivo favorito: comerlo le sube el ánimo
//   animales   afinidad con cada mascota (0 a 1)
//   estres     cuando escasean las reservas: 'trabaja' (más rápido, se cansa más) · 'raciona' (aguanta más sin comer)
//   rol        área que prefiere cuando hay varias tareas: 'agua' · 'huerto' · 'cuidado' · 'casa' · 'granja'
//   placeres   gusto por el vino y la hierba (0 a 1): más alto = más ganas (y más riesgo de dependencia)
//   libido     ritmo con que crece el deseo sexual (1 = normal)
//
// FÍSICO: andar 'zancada' o 'cadera'; detalles 'sombrero' 'barba' 'pecas' 'diadema' 'collar' 'pañuelo'
// =====================================================================

export const CONFIG = '2026-10-03b';   // cambiarlo reinicia la granja con las fichas nuevas

export const RASGOS = {
  fuerte: { nombre: 'Fuerte', desc: 'Saca 50 % más agua del pozo.', mod: { pozo: 1.5 } },
  comilon: { nombre: 'Comilón', desc: 'Le da hambre 20 % más rápido.', mod: { hambre: 1.2 } },
  manoVerde: { nombre: 'Mano verde', desc: 'Trabaja el huerto 40 % más rápido y cosecha 15 % más.', mod: { huerto: 1.4, cosecha: 1.15 } },
  ahorradora: { nombre: 'Ahorradora', desc: 'Le da hambre 15 % más lento.', mod: { hambre: 0.85 } },
  leal: { nombre: 'Leal', desc: 'Sigue a la pareja a todas partes y espanta plagas.', mod: { leal: 1 } },
  cazador: { nombre: 'Cazador', desc: 'Caza ratones en el huerto cuando tiene hambre.', mod: { cazador: 1 } },
  // personas
  manitas: { nombre: 'Manitas', desc: 'Repara y talla 40 % más rápido, aprende carpintería 50 % más rápido y a veces regala lo que talla.', mod: { carpinteria: 1.4, aprende_carpinteria: 1.5, manitas: 1 } },
  grunon: { nombre: 'Gruñón mañanero', desc: 'Antes de las 9:00 se irrita fácil: más riesgo de discutir.', mod: { grunon: 1 } },
  chef: { nombre: 'Cocina de chef', desc: 'Cocina 30 % más rápido y sus cenas alegran el doble.', mod: { casa: 1.3, chef: 1 } },
  romantico: { nombre: 'Alma romántica', desc: 'Busca más abrazos, recoge flores para regalar y propicia noches románticas.', mod: { romantico: 1 } },
  alergia: { nombre: 'Alergia al polen', desc: 'En primavera estornuda afuera y se enferma con más facilidad.', mod: { alergia: 1 } },
  // mascotas
  jugueton: { nombre: 'Juguetón', desc: 'Trae la pelota para que jueguen con él.', mod: { jugueton: 1 } },
  guardian: { nombre: 'Guardián', desc: 'De noche espanta a los zorros que rondan el gallinero.', mod: { guardian: 1 } },
  travieso: { nombre: 'Travieso', desc: 'Tumba cosas en la casa y se roba algún huevo.', mod: { travieso: 1 } },
  mimoso: { nombre: 'Mimoso', desc: 'Se sube al regazo de quien lee o teje y consuela a quien está triste.', mod: { mimoso: 1 } },
};

export const PERSONAJES = [
  {
    id: 'tomas', tipo: 'humano', nombre: 'Andrés', rasgos: ['fuerte', 'comilon', 'manitas', 'grunon'],
    personalidad: { apertura: 0.35, responsabilidad: 0.8, extraversion: 0.4, amabilidad: 0.6, neuroticismo: 0.45 },
    habitos: { cronotipo: 'madrugador', ocio: ['tallar', 'entrenar', 'pasearPerro', 'nadar', 'contemplar'], comida: 'papa', animales: { nube: 0.9, esmoquin: 0.5 }, estres: 'trabaja', rol: 'granja', placeres: { vino: 0.5, hierba: 0.6 }, libido: 1.0 },
    fisico: { andar: 'zancada', detalles: ['sombrero', 'barba'] },
    motivacion: 'Proteger a su familia y que nunca falte el agua.',
    voz: 'Grave y pausada; postura abierta, habla poco y actúa.',
  },
  {
    id: 'lucia', tipo: 'humano', nombre: 'María', rasgos: ['manoVerde', 'ahorradora', 'chef', 'romantico', 'alergia'],
    personalidad: { apertura: 0.8, responsabilidad: 0.55, extraversion: 0.75, amabilidad: 0.75, neuroticismo: 0.55 },
    habitos: { cronotipo: 'noctambulo', ocio: ['leer', 'hornear', 'tejer', 'jugarGato', 'nadar', 'contemplar'], comida: 'lechuga', animales: { nube: 0.6, esmoquin: 0.95 }, estres: 'raciona', rol: 'huerto', placeres: { vino: 0.7, hierba: 0.35 }, libido: 1.15 },
    fisico: { andar: 'cadera', detalles: ['pecas', 'diadema'] },
    motivacion: 'Que el huerto prospere y siempre haya reservas.',
    voz: 'Cálida y rápida; planifica en voz alta.',
  },
  {
    id: 'nube', tipo: 'perro', nombre: 'Berlín', rasgos: ['leal', 'jugueton', 'guardian'],
    fisico: { detalles: ['collar'] },
    motivacion: 'Estar cerca de su gente (y salir a pasear).',
  },
  {
    id: 'esmoquin', tipo: 'gato', nombre: 'Axel', rasgos: ['cazador', 'travieso', 'mimoso'],
    fisico: { detalles: [] },
    motivacion: 'Su independencia, los ratones y dormir con quien más lo necesite.',
  },
];

// Animales de granja: viven en el corral (vacas y ovejas) y en el gallinero (gallinas y gallo).
//   vaca → leche cada mañana (hay que ordeñarla) · oveja → lana (se esquila en primavera/verano)
//   gallina → huevos en el nido · gallo → canta al amanecer
//   sexo 'h' / 'm': con macho y hembra adultos, se reproducen (terneros, corderos, pollitos)
export const GANADO = [
  { id: 'canela', tipo: 'vaca', sexo: 'h', nombre: 'Canela' },
  { id: 'tronco', tipo: 'vaca', sexo: 'm', nombre: 'Tronco' },
  { id: 'algodon', tipo: 'oveja', sexo: 'h', nombre: 'Algodón' },
  { id: 'nieve', tipo: 'oveja', sexo: 'h', nombre: 'Nieve' },
  { id: 'copito', tipo: 'oveja', sexo: 'm', nombre: 'Copito' },
  { id: 'pinta', tipo: 'gallina', sexo: 'h', nombre: 'Pinta' },
  { id: 'rubia', tipo: 'gallina', sexo: 'h', nombre: 'Rubia' },
  { id: 'copo', tipo: 'gallina', sexo: 'h', nombre: 'Copo' },
  { id: 'clueca', tipo: 'gallina', sexo: 'h', nombre: 'Clueca' },
  { id: 'kiko', tipo: 'gallo', sexo: 'm', nombre: 'Kiko' },
];

// nombres para las crías que vayan naciendo
export const NOMBRES_CRIAS = {
  vaca: { h: ['Luna', 'Manchas', 'Perla', 'Rosita', 'Nata', 'Toffee', 'Galleta', 'Miel'], m: ['Bravo', 'Bruno', 'Tizón', 'Roble', 'Sansón'] },
  oveja: { h: ['Lanita', 'Pompón', 'Bolita', 'Nubecita', 'Algodina', 'Borla'], m: ['Rizos', 'Copete', 'Merino', 'Ovillo'] },
  gallina: { h: ['Pía', 'Ramona', 'Paca', 'Kika', 'Lola', 'Pepa', 'Chispa', 'Canela Chica', 'Plumita'], m: ['Pancho', 'Rojo', 'Kiko Jr', 'Espolón', 'Gallardo'] },
};
