// =====================================================================
// Civilizaciones — catálogo de poderes del espíritu del orbe (puro: solo datos).
// costo: energía (el orbe junta 0,5 por año, máximo 100). radio: en hexágonos (0 = apunta a una civilización).
// obj: 'tierra' | 'agua' | 'civ' | 'cualquiera' | 'guerra' (civ que esté en guerra). La simulación los aplica en sim.js.
// =====================================================================
export const CATEGORIAS = [
  ['naturaleza', '🌿 Naturaleza'], ['vida', '🧬 Vida'], ['mente', '🧠 Mente'], ['cielo', '🌌 Cielo'], ['creacion', '✨ Creación'],
];
export const PODERES = {
  // naturaleza
  lluvia: { n: 'Lluvias', e: '🌧️', cat: 'naturaleza', costo: 12, radio: 5, obj: 'cualquiera', d: 'Treinta años de cosechas abundantes en la región; apaga incendios.' },
  sequia: { n: 'Sequía', e: '🏜️', cat: 'naturaleza', costo: 18, radio: 6, obj: 'cualquiera', d: 'Veinte años de comida escasa: hambre, migración y rabia.' },
  terremoto: { n: 'Terremoto', e: '🌋', cat: 'naturaleza', costo: 28, radio: 6, obj: 'tierra', d: 'Derrumba ciudades y murallas de la región.' },
  volcan: { n: 'Volcán', e: '🌋', cat: 'naturaleza', costo: 42, radio: 2, obj: 'tierra', d: 'Nace una montaña de fuego; luego la ceniza fertiliza los alrededores.' },
  tsunami: { n: 'Tsunami', e: '🌊', cat: 'naturaleza', costo: 38, radio: 7, obj: 'cualquiera', d: 'Una ola gigante barre las costas y hunde las flotas.' },
  glaciacion: { n: 'Glaciación', e: '🧊', cat: 'naturaleza', costo: 34, radio: 4, obj: 'tierra', d: 'La región se congela para siempre: tundra y nieve.' },
  incendio: { n: 'Incendio forestal', e: '🔥', cat: 'naturaleza', costo: 18, radio: 4, obj: 'tierra', d: 'Los bosques arden y quedan llanos; los ejércitos allí sufren.' },
  fertil: { n: 'Tierra fértil', e: '🌱', cat: 'naturaleza', costo: 24, radio: 3, obj: 'tierra', d: 'Desiertos y tundras se vuelven praderas con río.' },
  // vida
  plaga: { n: 'Plaga', e: '☣️', cat: 'vida', costo: 25, radio: 0, obj: 'civ', d: 'Una enfermedad que se contagia a socios y enemigos.' },
  curacion: { n: 'Curación', e: '💊', cat: 'vida', costo: 16, radio: 0, obj: 'civ', d: 'Termina su plaga, +10 % de gente e inmunidad por 40 años.' },
  cosecha: { n: 'Bendición', e: '🌟', cat: 'vida', costo: 28, radio: 0, obj: 'civ', d: 'Edad de oro: saber, comercio y cohesión.' },
  natalidad: { n: 'Explosión demográfica', e: '👶', cat: 'vida', costo: 22, radio: 0, obj: 'civ', d: '+25 % de gente en todas sus ciudades (y más hambre).' },
  langostas: { n: 'Langostas', e: '🦗', cat: 'vida', costo: 18, radio: 5, obj: 'tierra', d: 'Un enjambre devora las cosechas: hambre por diez años.' },
  monstruo: { n: 'Monstruo', e: '🐉', cat: 'vida', costo: 40, radio: 1, obj: 'cualquiera', d: 'Un dragón (o un kraken en el mar) ataca ciudades y ejércitos.' },
  // mente
  genio: { n: 'Genio', e: '💡', cat: 'mente', costo: 24, radio: 0, obj: 'civ', d: 'Nace un genio: salto de saber y +10 de ciencia.' },
  profeta: { n: 'Profeta', e: '📿', cat: 'mente', costo: 28, radio: 0, obj: 'civ', d: 'Funda una religión nueva: fe y cohesión, recelo de los vecinos.' },
  fanatismo: { n: 'Fanatismo', e: '😡', cat: 'mente', costo: 24, radio: 0, obj: 'civ', d: '+20 agresividad y fe: buscan una guerra santa.' },
  discordia: { n: 'Discordia', e: '⚡', cat: 'mente', costo: 34, radio: 0, obj: 'civ', d: 'Guerra civil: el pueblo se parte en dos.' },
  paz: { n: 'Paz forzada', e: '🕊️', cat: 'mente', costo: 32, radio: 0, obj: 'civ', d: 'Termina todas sus guerras y da 40 años de tregua.' },
  traicion: { n: 'Traición', e: '🗡️', cat: 'mente', costo: 28, radio: 0, obj: 'guerra', d: 'Su mayor ejército se pasa al enemigo.' },
  heroe: { n: 'Héroe legendario', e: '🦸', cat: 'mente', costo: 28, radio: 0, obj: 'civ', d: 'Un general legendario por 60 años (+50 % a su ejército).' },
  // cielo
  meteorito: { n: 'Meteorito', e: '☄️', cat: 'cielo', costo: 40, radio: 2.6, obj: 'cualquiera', d: 'Arrasa un punto y deja un cráter.' },
  eclipse: { n: 'Eclipse', e: '🌑', cat: 'cielo', costo: 12, radio: 0, obj: 'civ', d: 'El cielo se oscurece: pánico, −moral y −cohesión; sube la fe.' },
  senal: { n: 'Señal divina', e: '🌈', cat: 'cielo', costo: 30, radio: 0, obj: 'civ', d: 'Une a este pueblo con su vecino más cercano: paz y alianza.' },
  // creación
  isla: { n: 'Crear isla', e: '🏝️', cat: 'creacion', costo: 32, radio: 2, obj: 'agua', d: 'El mar se levanta en una isla fértil.' },
  estrecho: { n: 'Abrir estrecho', e: '🌊', cat: 'creacion', costo: 32, radio: 1.5, obj: 'tierra', d: 'La tierra se hunde y el mar la cruza.' },
  sembrar: { n: 'Sembrar bosque', e: '🌳', cat: 'creacion', costo: 14, radio: 3, obj: 'tierra', d: 'Crece un bosque nuevo (comida y emboscadas).' },
  regalo: { n: 'Regalar saber', e: '📜', cat: 'creacion', costo: 38, radio: 0, obj: 'civ', d: 'Le das la siguiente era de golpe.' },
};
export const ENERGIA_MAX = 100, ENERGIA_AÑO = 0.5;
