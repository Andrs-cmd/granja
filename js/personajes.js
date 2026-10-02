// =====================================================================
// Fichas de los habitantes de la granja.
// Para darles rasgos nuevos se edita este archivo (y se cambia CONFIG para
// que arranque una generación nueva con las fichas actualizadas).
//
// RASGOS: cada uno modifica números concretos de la simulación.
//   hambre, sed, cansancio → qué tan rápido baja esa necesidad (1 = normal)
//   huerto, agua, cuidado   → velocidad de trabajo en esa área
//   pozo                    → litros que saca del pozo
//   cosecha                 → raciones de cada cosecha
//   aprende                 → qué tan rápido sube sus habilidades
//   enfermar                → probabilidad de enfermar con agua sin filtrar
//   leal / cazador          → comportamientos especiales de los animales
//
// FICHA de cada personaje:
//   fisico.andar      'zancada' (pasos largos, balanceo de hombros) · 'cadera' (paso fluido, balanceo de cadera)
//   fisico.detalles   accesorios visibles: 'sombrero', 'barba', 'pecas', 'diadema', 'collar', 'pañuelo'
//   psique.motivacion qué lo impulsa (se muestra en su ficha)
//   psique.rol        área que prefiere cuando hay varias tareas: 'agua' · 'huerto' · 'cuidado'
//   psique.estres     cómo reacciona cuando escasea la comida o el agua:
//                       'trabaja'  → trabaja 20 % más rápido pero se cansa 25 % más
//                       'raciona'  → aguanta más antes de comer y le da 10 % menos hambre
//   psique.voz        estilo de comunicación (descriptivo, para su ficha)
// =====================================================================

export const CONFIG = '2026-10-02b';   // cambiarlo reinicia la granja con las fichas nuevas

export const RASGOS = {
  fuerte: { nombre: 'Fuerte', desc: 'Saca 50 % más agua del pozo.', mod: { pozo: 1.5 } },
  comilon: { nombre: 'Comilón', desc: 'Le da hambre 20 % más rápido.', mod: { hambre: 1.2 } },
  manoVerde: { nombre: 'Mano verde', desc: 'Trabaja el huerto 40 % más rápido y cosecha 15 % más.', mod: { huerto: 1.4, cosecha: 1.15 } },
  ahorradora: { nombre: 'Ahorradora', desc: 'Le da hambre 15 % más lento.', mod: { hambre: 0.85 } },
  leal: { nombre: 'Leal', desc: 'Sigue a la pareja a todas partes.', mod: { leal: 1 } },
  cazador: { nombre: 'Cazador', desc: 'Caza ratones en el huerto cuando tiene hambre.', mod: { cazador: 1 } },
};

export const PERSONAJES = [
  {
    id: 'tomas', tipo: 'humano', nombre: 'Tomás', rasgos: ['fuerte', 'comilon'],
    fisico: { andar: 'zancada', detalles: ['sombrero', 'barba'] },
    psique: {
      motivacion: 'Proteger a su familia y que nunca falte el agua.',
      rol: 'agua', estres: 'trabaja',
      voz: 'Grave y pausada; postura abierta, habla poco y actúa.',
    },
  },
  {
    id: 'lucia', tipo: 'humano', nombre: 'Lucía', rasgos: ['manoVerde', 'ahorradora'],
    fisico: { andar: 'cadera', detalles: ['pecas', 'diadema'] },
    psique: {
      motivacion: 'Que el huerto prospere y siempre haya reservas.',
      rol: 'huerto', estres: 'raciona',
      voz: 'Cálida y rápida; planifica en voz alta.',
    },
  },
  {
    id: 'nube', tipo: 'perro', nombre: 'Nube', rasgos: ['leal'],
    fisico: { detalles: ['collar'] },
    psique: { motivacion: 'Estar cerca de su gente.', rol: null, estres: null, voz: 'Ladridos cortos y cola inquieta.' },
  },
  {
    id: 'esmoquin', tipo: 'gato', nombre: 'Esmoquin', rasgos: ['cazador'],
    fisico: { detalles: [] },
    psique: { motivacion: 'Su independencia (y los ratones).', rol: null, estres: null, voz: 'Silencioso; maúlla solo si tiene hambre.' },
  },
];
