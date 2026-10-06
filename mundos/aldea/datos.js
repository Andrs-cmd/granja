// =====================================================================
// La aldea · catálogos (datos puros, sin lógica): eras, tecnologías, oficios, usos del suelo,
// decisiones de la sociedad, destinos y poderes del espíritu. Todo lo que cambia con la era sale de aquí.
// =====================================================================
export const MIN_DIA = 1440, DIAS_EST = 6, DIAS_ANIO = 24;
export const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];

// repr: cuántos habitantes representa cada ciudadano simulado; pisos: altura máxima de los edificios
export const ERAS = [
  { n: 'Tribu', i: '🔥', repr: 1, pisos: 1, pob: 0, d: 'Cazadores y recolectores alrededor del fuego. Mitos, chozas y supervivencia.' },
  { n: 'Aldea agrícola', i: '🌾', repr: 2, pisos: 1, pob: 12, d: 'Campos sembrados, animales en corrales, las primeras casas de barro y madera.' },
  { n: 'Villa medieval', i: '🏰', repr: 4, pisos: 2, pob: 18, d: 'Hierro, piedra y moneda. Murallas, templos, señores y siervos.' },
  { n: 'Ciudad mercantil', i: '⚓', repr: 10, pisos: 3, pob: 26, d: 'Comercio, imprenta, universidades y arte: el renacimiento.' },
  { n: 'Era industrial', i: '🏭', repr: 30, pisos: 5, pob: 34, d: 'Vapor, carbón y fábricas. Chimeneas, obreros, huelgas y humo.' },
  { n: 'Era moderna', i: '🏙', repr: 90, pisos: 14, pob: 44, d: 'Electricidad, acero y motores. Rascacielos, autos, radio… y la bomba.' },
  { n: 'Era de la información', i: '💻', repr: 250, pisos: 28, pob: 56, d: 'Computadores, redes, genética y cohetes. Todo se acelera.' },
  { n: 'Era futura', i: '🛸', repr: 700, pisos: 44, pob: 70, d: 'Inteligencia artificial, fusión, nanotecnología: el umbral del destino.' },
  { n: 'Destino', i: '⭐', repr: 700, pisos: 44, pob: 999, d: 'La civilización alcanzó su destino.' },
];

// costo base de investigación por era (los puntos crecen con la población, la educación y las tecnologías)
export const costoEra = (e) => Math.round(70 * Math.pow(2.55, e));
// tecnologías: t = 'c' (ciencia) | 'f' (fe); mult = multiplicadores de producción; ejes = empuje al destino
export const TEC = {
  // Tribu
  agricultura: { n: 'Agricultura', era: 0, t: 'c', mult: { comida: 1.4 }, d: 'Sembrar en vez de solo recolectar.' },
  ganaderia: { n: 'Ganadería', era: 0, t: 'c', mult: { comida: 1.15 }, d: 'Cabras, ovejas y gallinas en corrales.' },
  alfareria: { n: 'Alfarería', era: 0, t: 'c', mult: { bienes: 1.3 }, d: 'Vasijas para guardar grano: la comida dura más.' },
  herbolaria: { n: 'Herbolaria', era: 0, t: 'c', mult: { salud: 1.3 }, d: 'Plantas que curan.' },
  mitos: { n: 'Mitos del fuego', era: 0, t: 'f', mult: { fe: 1.3, cultura: 1.2 }, ejes: { cf: -3 }, d: 'Historias del espíritu del orbe alrededor del fuego.' },
  // Aldea agrícola
  escritura: { n: 'Escritura', era: 1, t: 'c', req: ['agricultura'], mult: { ciencia: 1.35 }, d: 'Lo que se sabe ya no muere con los viejos.' },
  rueda: { n: 'La rueda', era: 1, t: 'c', mult: { materiales: 1.3, comercio: 1.2 }, d: 'Carretas, molinos y alfareros más rápidos.' },
  bronce: { n: 'Bronce', era: 1, t: 'c', mult: { metal: 1.5, seguridad: 1.3 }, d: 'El primer metal: herramientas y armas.' },
  irrigacion: { n: 'Irrigación', era: 1, t: 'c', req: ['agricultura'], mult: { comida: 1.3 }, d: 'Canales del río a los campos.' },
  calendario: { n: 'Calendario sagrado', era: 1, t: 'f', req: ['mitos'], mult: { fe: 1.25, comida: 1.05 }, ejes: { cf: -3 }, d: 'Los astros dicen cuándo sembrar.' },
  // Villa medieval
  hierro: { n: 'Hierro', era: 2, t: 'c', req: ['bronce'], mult: { metal: 1.5, materiales: 1.15, seguridad: 1.4 }, d: 'Arados y espadas de hierro.' },
  arquitectura: { n: 'Arquitectura', era: 2, t: 'c', mult: { materiales: 1.3 }, d: 'Arcos, bóvedas y casas de piedra de dos pisos.' },
  moneda: { n: 'Moneda', era: 2, t: 'c', req: ['rueda'], mult: { comercio: 1.6 }, ejes: { ic: 4 }, d: 'El trueque da paso al dinero… y a los ricos.' },
  filosofia: { n: 'Filosofía', era: 2, t: 'c', req: ['escritura'], mult: { ciencia: 1.2, cultura: 1.2 }, ejes: { cf: 3 }, d: 'Preguntarse el porqué de todo.' },
  teologia: { n: 'Teología', era: 2, t: 'f', req: ['calendario'], mult: { fe: 1.5 }, ejes: { cf: -5 }, d: 'Templos de piedra y una fe organizada.' },
  // Ciudad mercantil
  imprenta: { n: 'Imprenta', era: 3, t: 'c', req: ['escritura'], mult: { ciencia: 1.4, cultura: 1.3 }, d: 'Libros para todos: las ideas vuelan.' },
  banca: { n: 'Banca', era: 3, t: 'c', req: ['moneda'], mult: { comercio: 1.5 }, ejes: { ic: 5, aa: 3 }, d: 'Préstamos, deudas y grandes fortunas.' },
  navegacion: { n: 'Navegación', era: 3, t: 'c', mult: { comida: 1.1, comercio: 1.2 }, ejes: { aa: 3 }, d: 'Barcos, mapas y el deseo de ir más allá.' },
  metodo: { n: 'Método científico', era: 3, t: 'c', req: ['filosofia'], mult: { ciencia: 1.5 }, ejes: { cf: 8 }, d: 'Observar, medir, probar: la ciencia moderna nace.' },
  medicina: { n: 'Medicina', era: 3, t: 'c', req: ['herbolaria'], mult: { salud: 1.5 }, d: 'Médicos que entienden el cuerpo.' },
  polvora: { n: 'Pólvora', era: 3, t: 'c', req: ['hierro'], mult: { seguridad: 2 }, ejes: { aa: 6 }, armas: true, d: 'Cañones y mosquetes: la guerra cambia.' },
  mistica: { n: 'Mística', era: 3, t: 'f', req: ['teologia'], mult: { fe: 1.4, cultura: 1.15 }, ejes: { cf: -6, aa: -3 }, d: 'Monjes que buscan al espíritu dentro de sí.' },
  // Era industrial
  vapor: { n: 'Máquina de vapor', era: 4, t: 'c', req: ['metodo'], mult: { bienes: 1.6, energia: 1.5 }, ejes: { ni: 6 }, d: 'El vapor mueve telares, barcos y trenes.' },
  carbon: { n: 'Carbón', era: 4, t: 'c', req: ['hierro'], mult: { energia: 1.6, metal: 1.3 }, ejes: { ni: 8 }, sucio: 1, d: 'Minas profundas y cielos negros.' },
  ferrocarril: { n: 'Ferrocarril', era: 4, t: 'c', req: ['vapor'], mult: { materiales: 1.4, comercio: 1.3 }, d: 'Las ciudades se unen con rieles.' },
  fabricas: { n: 'Fábricas', era: 4, t: 'c', req: ['vapor'], mult: { bienes: 1.6 }, ejes: { ni: 8, ic: 3 }, sucio: 1, d: 'Producción en masa y obreros en turnos de doce horas.' },
  vacunas: { n: 'Vacunas', era: 4, t: 'c', req: ['medicina'], mult: { salud: 1.6 }, ejes: { cf: 4 }, d: 'Las plagas pierden su poder.' },
  renovacion: { n: 'Renovación espiritual', era: 4, t: 'f', req: ['mistica'], mult: { fe: 1.4, cultura: 1.2 }, ejes: { cf: -5, ic: -3 }, d: 'Movimientos de fe que piden justicia y sentido.' },
  // Era moderna
  electricidad: { n: 'Electricidad', era: 5, t: 'c', req: ['vapor'], mult: { energia: 1.8, ciencia: 1.15 }, d: 'Luz eléctrica: la noche se ilumina.' },
  combustion: { n: 'Motor de combustión', era: 5, t: 'c', req: ['carbon'], mult: { materiales: 1.3, comercio: 1.2 }, ejes: { ni: 6 }, sucio: 1, d: 'Autos, camiones y carreteras.' },
  acero: { n: 'Acero y concreto', era: 5, t: 'c', req: ['ferrocarril'], mult: { materiales: 1.5 }, d: 'Rascacielos.' },
  antibioticos: { n: 'Antibióticos', era: 5, t: 'c', req: ['vacunas'], mult: { salud: 1.6 }, d: 'Se vive el doble.' },
  radio: { n: 'Radio', era: 5, t: 'c', req: ['electricidad'], mult: { cultura: 1.4 }, d: 'Una voz llega a todas las casas (también la del líder).' },
  fision: { n: 'Fisión nuclear', era: 5, t: 'c', req: ['electricidad'], mult: { energia: 2 }, ejes: { aa: 6 }, armas: true, d: 'Energía enorme… y la posibilidad de la bomba.' },
  meditacion: { n: 'Meditación profunda', era: 5, t: 'f', req: ['renovacion'], mult: { fe: 1.5, salud: 1.1 }, ejes: { cf: -6, aa: -5 }, d: 'Escuelas de silencio y conciencia.' },
  // Era de la información
  computacion: { n: 'Computación', era: 6, t: 'c', req: ['electricidad'], mult: { ciencia: 1.8 }, ejes: { cf: 6 }, d: 'Máquinas que calculan millones de veces más rápido.' },
  internet: { n: 'Internet', era: 6, t: 'c', req: ['computacion'], mult: { cultura: 1.4, comercio: 1.4, ciencia: 1.2 }, d: 'Todos conectados con todos.' },
  genetica: { n: 'Genética', era: 6, t: 'c', req: ['antibioticos'], mult: { comida: 1.5, salud: 1.4 }, ejes: { cf: 5 }, d: 'Leer y editar la vida.' },
  solar: { n: 'Energía solar', era: 6, t: 'c', req: ['electricidad'], mult: { energia: 1.4 }, ejes: { ni: -10 }, limpio: 1, d: 'Energía sin humo.' },
  cohetes: { n: 'Cohetes', era: 6, t: 'c', req: ['combustion'], mult: { ciencia: 1.1 }, ejes: { aa: 6 }, d: 'Salir del orbe por primera vez.' },
  ecologia: { n: 'Ecología', era: 6, t: 'c', req: ['genetica'], mult: { comida: 1.1 }, ejes: { ni: -12 }, limpio: 1, d: 'Entender y sanar el bosque.' },
  despertar: { n: 'Despertar colectivo', era: 6, t: 'f', req: ['meditacion'], mult: { fe: 1.6, cultura: 1.2 }, ejes: { cf: -8, ic: -6 }, d: 'Millones meditan a la vez y algo se siente.' },
  // Era futura
  ia: { n: 'Inteligencia artificial', era: 7, t: 'c', req: ['internet'], mult: { ciencia: 2.2, bienes: 1.5 }, ejes: { cf: 8 }, d: 'Mentes que no son humanas.' },
  fusion: { n: 'Fusión', era: 7, t: 'c', req: ['fision'], mult: { energia: 3 }, limpio: 1, d: 'Un sol en una botella.' },
  nanotec: { n: 'Nanotecnología', era: 7, t: 'c', req: ['computacion'], mult: { materiales: 2, metal: 2 }, d: 'Construir átomo por átomo.' },
  viaje: { n: 'Viaje interestelar', era: 7, t: 'c', req: ['cohetes', 'fusion'], ejes: { aa: 10 }, destino: 'estelar', d: 'Naves capaces de cruzar el cristal y llegar a las estrellas.' },
  neural: { n: 'Red neural', era: 7, t: 'c', req: ['ia', 'internet'], ejes: { ic: -10 }, destino: 'colmena', d: 'Conectar las mentes entre sí.' },
  gaia: { n: 'Pacto de Gaia', era: 7, t: 'c', req: ['ecologia'], ejes: { ni: -12, aa: -6 }, destino: 'gaia', d: 'Ciudades que son bosque y bosque que es ciudad.' },
  conciencia: { n: 'Conciencia pura', era: 7, t: 'f', req: ['despertar'], ejes: { cf: -12 }, destino: 'trascendencia', d: 'La mente se libera del cuerpo.' },
};
for (const [k, T] of Object.entries(TEC)) { T.k = k; T.req ||= []; T.costo = Math.round(costoEra(T.era) * (T.destino ? 1.6 : 1) * (T.t === 'f' ? 0.35 : 1)); }   // la fe produce menos puntos que la ciencia: sus caminos cuestan menos

// categorías de trabajo: dónde se trabaja, qué se produce y cómo se llama el oficio en cada era
export const OFICIOS = {
  comida: { uso: 'campo', base: 3.1, ing: 0.8, t: ['Recolector', 'Campesino', 'Labrador', 'Granjero', 'Agricultor', 'Agrónomo', 'Ingeniero agrícola', 'Cultivador hidropónico'] },
  materiales: { uso: 'cantera', base: 2, ing: 1, t: ['Leñador', 'Cantero', 'Albañil', 'Constructor', 'Obrero de la construcción', 'Operario de concreto', 'Operador de grúas', 'Ensamblador de nanomateriales'] },
  metal: { uso: 'mina', base: 1, ing: 1.2, era: 1, t: ['', 'Fundidor de bronce', 'Herrero', 'Minero', 'Minero del carbón', 'Metalúrgico', 'Ingeniero metalúrgico', 'Técnico de nanometales'] },
  energia: { uso: 'central', base: 3, ing: 1.3, era: 4, t: ['', '', '', '', 'Fogonero', 'Electricista', 'Técnico de energía', 'Ingeniero de fusión'] },
  bienes: { uso: 'taller', base: 1.3, ing: 1.1, t: ['Artesano', 'Alfarero', 'Artesano', 'Tejedor', 'Obrero de fábrica', 'Operario', 'Técnico', 'Diseñador de impresión 3D'] },
  ciencia: { uso: 'escuela', base: 0.45, ing: 1.6, t: ['Sabio', 'Escriba', 'Maestro', 'Sabio', 'Científico', 'Investigador', 'Programador', 'Ingeniero de IA'] },
  fe: { uso: 'templo', base: 0.8, ing: 0.8, t: ['Chamán', 'Sacerdote', 'Monje', 'Predicador', 'Pastor', 'Guía espiritual', 'Maestro de meditación', 'Místico'] },
  salud: { uso: 'hospital', base: 1, ing: 1.5, t: ['Curandero', 'Curandero', 'Boticario', 'Médico', 'Médico', 'Médico', 'Biomédico', 'Bioingeniero'] },
  comercio: { uso: 'mercado', base: 1, ing: 2.4, era: 1, t: ['', 'Trocador', 'Mercader', 'Banquero', 'Empresario', 'Comerciante', 'Financista', 'Gestor de redes'] },
  seguridad: { uso: 'cuartel', base: 1, ing: 1.2, t: ['Guerrero', 'Guardián', 'Soldado', 'Soldado', 'Soldado', 'Policía', 'Agente', 'Operador de drones'] },
  cultura: { uso: 'teatro', base: 0.8, ing: 1.1, t: ['Cuentacuentos', 'Cantor', 'Juglar', 'Artista', 'Escritor', 'Artista', 'Creador digital', 'Artista inmersivo'] },
  construir: { uso: null, base: 1, ing: 1, t: ['Constructor', 'Constructor', 'Maestro de obra', 'Arquitecto', 'Obrero', 'Constructor', 'Ingeniero civil', 'Arquitecto de nanoestructuras'] },
};
export const tituloOficio = (cat, era, sexo) => { const t = OFICIOS[cat]?.t[Math.min(7, era)] || OFICIOS[cat]?.t.find(Boolean) || 'Sin oficio'; return sexo === 'f' ? feminizar(t) : t; };
function feminizar(t) { return t.split(' ').map((w, i) => (i ? w : w.replace(/or$/, 'ora').replace(/ero$/, 'era').replace(/ano$/, 'ana').replace(/ino$/, 'ina').replace(/ico$/, 'ica').replace(/o$/, 'a'))).join(' ').replace(/Guíaa/, 'Guía').replace(/Chamána/, 'Chamana').replace(/Agentea/, 'Agente').replace(/Artistaa/, 'Artista'); }

// usos del suelo (celdas de la cuadrícula): capacidad por nivel y costo de obra
export const USOS = {
  vivienda: { n: 'Viviendas', cap: 4, obra: 5, mat: 3 },
  campo: { n: 'Campos', cap: 7, obra: 2, mat: 1, plano: true },
  cantera: { n: 'Cantera y aserradero', cap: 6, obra: 4, mat: 1 },
  mina: { n: 'Mina', cap: 6, obra: 6, mat: 2 },
  central: { n: 'Central de energía', cap: 8, obra: 16, mat: 8 },
  taller: { n: 'Talleres y fábricas', cap: 7, obra: 7, mat: 4 },
  escuela: { n: 'Escuela, universidad o laboratorio', cap: 6, obra: 10, mat: 5 },
  templo: { n: 'Templo', cap: 6, obra: 12, mat: 6 },
  hospital: { n: 'Casa de salud', cap: 6, obra: 9, mat: 5 },
  mercado: { n: 'Mercado', cap: 7, obra: 6, mat: 3 },
  cuartel: { n: 'Cuartel', cap: 7, obra: 7, mat: 4 },
  teatro: { n: 'Teatro y plaza de las artes', cap: 6, obra: 8, mat: 4 },
  palacio: { n: 'Casa de gobierno', cap: 4, obra: 14, mat: 8 },
  parque: { n: 'Parque', cap: 0, obra: 2, mat: 0, plano: true },
  puerto: { n: 'Puerto espacial', cap: 10, obra: 40, mat: 30 },
};

// gobiernos: quién decide y cuánta libertad hay (autoridad 0 = libre, 1 = autoritario)
export const GOBIERNOS = {
  consejo: { n: 'Consejo de ancianos', voto: 'mayores', autoridad: 0.3 },
  jefatura: { n: 'Jefatura', voto: 'lider', autoridad: 0.6 },
  monarquia: { n: 'Monarquía', voto: 'lider', autoridad: 0.7 },
  teocracia: { n: 'Teocracia', voto: 'fieles', autoridad: 0.7 },
  republica: { n: 'República', voto: 'ricos', autoridad: 0.35 },
  democracia: { n: 'Democracia', voto: 'todos', autoridad: 0.15 },
  dictadura: { n: 'Dictadura', voto: 'lider', autoridad: 0.95 },
  comuna: { n: 'Comuna', voto: 'todos', autoridad: 0.3 },
  tecnocracia: { n: 'Tecnocracia', voto: 'sabios', autoridad: 0.5 },
};

// decisiones: w = pesos sobre la persona (valores 0..1 centrados, 'o.tema' opiniones -1..1, 'rico' riqueza relativa)
export const DECISIONES = {
  tierra: { era: 1, t: 'La tierra', q: 'Ya sembramos y cosechamos. ¿De quién es la tierra?', ops: [
    { k: 'comunal', n: 'De todos', d: 'La cosecha se reparte. Menos desigualdad, menos ambición; la gente se cuida entre sí.', w: { empatia: 1.2, 'o.igualdad': 1, codicia: -1 }, ejes: { ic: -14, aa: -6 }, ley: { tierra: 'comunal' } },
    { k: 'familias', n: 'De cada familia', d: 'Quien trabaja más, tiene más. Nace la propiedad… y los ricos y los pobres.', w: { ambicion: 1, codicia: 1, 'o.igualdad': -0.8 }, ejes: { ic: 14, aa: 6 }, ley: { tierra: 'privada' } },
    { k: 'jefe', n: 'Del jefe', d: 'El jefe reparte la tierra. Orden y obediencia, poder concentrado.', w: { lealtad: 1.2, miedo: 0.8, 'o.lider': 1 }, ejes: { ic: 4, aa: 10 }, gob: 'jefatura' }] },
  gobierno: { era: 2, t: '¿Quién gobierna?', q: 'La villa creció y las disputas también. ¿Quién debe mandar?', ops: [
    { k: 'consejo', n: 'Un consejo de vecinos', d: 'República: los que tienen tierra eligen. Más libertad, decisiones más lentas.', w: { curiosidad: 0.6, empatia: 0.4, 'o.lider': -0.6, rico: 0.5 }, ejes: { ic: 6, aa: -4 }, gob: 'republica' },
    { k: 'rey', n: 'Un rey', d: 'Monarquía: un solo mando, nobles y siervos. Orden, guerras de conquista.', w: { lealtad: 1, ambicion: 0.6, 'o.lider': 1, miedo: 0.4 }, ejes: { aa: 12, ic: 8 }, gob: 'monarquia' },
    { k: 'sacerdotes', n: 'Los sacerdotes', d: 'Teocracia: la fe por encima de todo. Templos enormes, la ciencia vigilada.', w: { fe: 1.6, 'o.religion': 1, curiosidad: -0.5 }, ejes: { cf: -20, ic: -6 }, gob: 'teocracia' }] },
  dudas: { era: 3, t: 'Los que dudan', q: 'Unos sabios dicen que el mundo no es como cuentan los templos. ¿Qué hacemos con ellos?', ops: [
    { k: 'tolerar', n: 'Dejarlos hablar', d: 'Libertad de pensamiento: la ciencia avanza, la fe se divide.', w: { curiosidad: 1, empatia: 0.4, 'o.ciencia': 0.8 }, ejes: { cf: 12, ic: 6 } },
    { k: 'perseguir', n: 'Callarlos', d: 'Censura: la fe se mantiene unida pero el saber se frena (y crece el rencor).', w: { fe: 1.2, 'o.religion': 1, miedo: 0.6, curiosidad: -0.8 }, ejes: { cf: -18, aa: 6 }, ley: { censura: true } },
    { k: 'academias', n: 'Fundar academias', d: 'Universidades por toda la ciudad: la ciencia se dispara; los fieles se sienten desplazados.', w: { curiosidad: 1.4, 'o.ciencia': 1, fe: -0.6 }, ejes: { cf: 24 }, ley: { academias: true } }] },
  bosque: { era: 4, t: 'El bosque y las fábricas', q: 'Las máquinas piden carbón y madera. ¿Cuánto bosque sacrificamos?', ops: [
    { k: 'talar', n: 'Todo lo necesario', d: 'Industria a toda máquina: riqueza rápida, humo y bosques arrasados.', w: { ambicion: 1, codicia: 0.8, 'o.tecnologia': 1, 'o.naturaleza': -1 }, ejes: { ni: 24, aa: 5 }, ley: { verde: 0 } },
    { k: 'reservas', n: 'Dejar reservas', d: 'Se tala, pero se protegen algunos bosques.', w: { lealtad: 0.4, 'o.naturaleza': 0.3, 'o.tecnologia': 0.3 }, ejes: { ni: 6 }, ley: { verde: 1 } },
    { k: 'proteger', n: 'Proteger el bosque', d: 'Leyes verdes: industria más lenta, aire limpio, bosque vivo.', w: { empatia: 0.6, 'o.naturaleza': 1.4, codicia: -0.6 }, ejes: { ni: -22, aa: -4 }, ley: { verde: 2 } }] },
  huelga: { era: 5, t: 'La gran huelga', q: 'Los obreros paran las fábricas: piden jornadas humanas y salarios justos.', ops: [
    { k: 'derechos', n: 'Dar derechos', d: 'Democracia y leyes laborales: menos desigualdad, algo menos de producción.', w: { empatia: 1, 'o.igualdad': 1.2, rico: -0.8 }, ejes: { ic: -10, aa: -8 }, gob: 'democracia' },
    { k: 'mano', n: 'Mano dura', d: 'Se reprime la huelga: orden, miedo y un líder con todo el poder.', w: { miedo: 0.6, lealtad: 0.8, 'o.igualdad': -1, rico: 1 }, ejes: { aa: 15, ic: 8 }, gob: 'dictadura', muertos: 0.04 },
    { k: 'coop', n: 'Fábricas de los obreros', d: 'Comuna: los trabajadores son dueños. Igualdad radical; los ricos se van o protestan.', w: { empatia: 0.8, 'o.igualdad': 1.6, rico: -1.4, codicia: -0.8 }, ejes: { ic: -24 }, gob: 'comuna' }] },
  bomba: { era: 6, t: 'La bomba', q: 'Los científicos saben partir el átomo y pueden hacer un arma capaz de borrar ciudades.', ops: [
    { k: 'construir', n: 'Construirla', d: 'Disuasión: nadie se atreverá a atacarnos… mientras nadie la use.', w: { ambicion: 1, miedo: 0.6, 'o.guerra': 1.2, empatia: -0.6 }, ejes: { aa: 20 }, ley: { bomba: true } },
    { k: 'pacifica', n: 'Solo energía', d: 'El átomo para las centrales, nunca para la guerra.', w: { curiosidad: 0.6, 'o.tecnologia': 0.8, 'o.guerra': -0.6 }, ejes: { aa: -6, cf: 4 } },
    { k: 'prohibir', n: 'Prohibir el átomo', d: 'Ni bombas ni centrales: más seguro, menos energía.', w: { empatia: 0.8, 'o.naturaleza': 0.8, 'o.tecnologia': -0.8, miedo: 0.6 }, ejes: { aa: -14, ni: -6 }, ley: { atomo: false } }] },
  ia: { era: 7, t: 'La máquina que piensa', q: 'Una inteligencia artificial empieza a pensar por sí sola. ¿Qué libertad le damos?', ops: [
    { k: 'libre', n: 'Libertad total', d: 'La IA lo acelera todo: ciencia sin límite… y un riesgo que nadie entiende.', w: { curiosidad: 1, ambicion: 0.8, 'o.tecnologia': 1.4, miedo: -0.8 }, ejes: { cf: 18, ic: -6 }, ley: { ia: 'libre' } },
    { k: 'control', n: 'Bajo control humano', d: 'Avance más lento y más seguro.', w: { lealtad: 0.6, 'o.tecnologia': 0.5, miedo: 0.3 }, ejes: { cf: 8 }, ley: { ia: 'control' } },
    { k: 'prohibir', n: 'Apagarla', d: 'Nada de mentes artificiales: lo humano primero.', w: { fe: 0.8, miedo: 0.8, 'o.tecnologia': -1, 'o.naturaleza': 0.5 }, ejes: { cf: -12, ni: -8 }, ley: { ia: 'no' } }] },
  // crisis (cuando las condiciones las provocan)
  guerra: { crisis: true, t: 'Vientos de guerra', q: '{B} y {A} se odian. ¿Guerra o paz?', ops: [
    { k: 'atacar', n: 'Atacar primero', d: 'Guerra: muertos, botín y gloria (o derrota).', w: { ambicion: 1.2, 'o.guerra': 1.4, empatia: -0.8, miedo: -0.5 }, ejes: { aa: 10 }, guerra: true },
    { k: 'negociar', n: 'Negociar la paz', d: 'Se cede algo, se evita la sangre.', w: { empatia: 1, 'o.guerra': -1.2, miedo: 0.4 }, ejes: { aa: -8 } },
    { k: 'muralla', n: 'Armarse y esperar', d: 'Más soldados y murallas: paz tensa.', w: { miedo: 0.8, lealtad: 0.6 }, ejes: { aa: 4 }, ley: { armado: true } }] },
  epidemia: { crisis: true, t: 'La epidemia', q: 'Una enfermedad se extiende por {A}.', ops: [
    { k: 'cuarentena', n: 'Cuarentena', d: 'Todos en casa: se salvan vidas, se pierde producción.', w: { empatia: 0.8, 'o.ciencia': 0.8, miedo: 0.6 }, ejes: { ic: -4, cf: 4 }, ley: { cuarentena: 30 } },
    { k: 'rezar', n: 'Rezar al espíritu', d: 'La fe consuela; la enfermedad sigue su curso.', w: { fe: 1.4, 'o.religion': 1 }, ejes: { cf: -8 } },
    { k: 'seguir', n: 'Seguir trabajando', d: 'La economía no se detiene; mueren más.', w: { codicia: 1, ambicion: 0.6, empatia: -0.6, rico: 0.6 }, ejes: { ic: 6, aa: 4 } }] },
  contaminacion: { crisis: true, t: 'El aire negro', q: 'El humo enferma a los niños y oscurece el cielo de {A}.', ops: [
    { k: 'verdes', n: 'Leyes verdes', d: 'Menos fábricas sucias: aire limpio, crecimiento más lento.', w: { empatia: 0.6, 'o.naturaleza': 1.4, codicia: -0.6 }, ejes: { ni: -14 }, ley: { verde: 2 } },
    { k: 'seguir', n: 'El progreso no para', d: 'Más riqueza, más humo, más enfermos.', w: { ambicion: 0.8, codicia: 0.8, 'o.tecnologia': 1, 'o.naturaleza': -1 }, ejes: { ni: 10 }, ley: { verde: 0 } }] },
  revolucion: { crisis: true, t: 'La revolución', q: 'El movimiento «{M}» tiene a media ciudad en la calle contra el gobierno.', ops: [
    { k: 'ceder', n: 'Ceder', d: 'Cambia el gobierno según lo que pide el movimiento.', w: { empatia: 0.6, 'o.lider': -1.2, 'o.igualdad': 0.6 }, ejes: { ic: -4 }, revolucion: 'ceder' },
    { k: 'reprimir', n: 'Reprimir', d: 'Soldados en las calles: muertos, miedo y rencor (puede fallar).', w: { lealtad: 1, 'o.lider': 1.2, miedo: 0.4, rico: 0.6 }, ejes: { aa: 12 }, revolucion: 'reprimir' }] },
  desigualdad: { crisis: true, t: 'Ricos y pobres', q: 'Unos pocos lo tienen casi todo en {A}. ¿Qué se hace?', ops: [
    { k: 'impuestos', n: 'Impuestos a los ricos', d: 'Se reparte: menos pobreza, los ricos se quejan.', w: { empatia: 1, 'o.igualdad': 1.4, rico: -1.2 }, ejes: { ic: -10 }, ley: { impuestos: true } },
    { k: 'mercado', n: 'Que el mercado decida', d: 'Libertad económica: más riqueza total, más distancia entre clases.', w: { codicia: 1, ambicion: 0.8, 'o.igualdad': -1, rico: 1.2 }, ejes: { ic: 10, aa: 4 }, ley: { impuestos: false } }] },
  cisma: { crisis: true, t: 'Una nueva fe', q: 'El movimiento «{M}» predica otra forma de creer y gana fieles.', ops: [
    { k: 'reconocer', n: 'Reconocerla', d: 'Libertad de culto: la fe se renueva.', w: { empatia: 0.6, curiosidad: 0.6 }, ejes: { ic: 6, cf: -4 } },
    { k: 'perseguir', n: 'Perseguirla', d: 'Una sola fe verdadera: unidad a la fuerza.', w: { lealtad: 0.8, 'o.religion': 0.6, miedo: 0.6, curiosidad: -0.6 }, ejes: { aa: 8, cf: -6 }, muertos: 0.02 }] },
};

// destinos: la tecnología que los abre, el megaproyecto y lo que se necesita para terminarlo
export const DESTINOS = {
  estelar: { n: 'Imperio estelar', i: '🚀', tec: 'viaje', mega: 'Flota estelar', costo: { energia: 9000, metal: 5000, ciencia: 9000 }, w: { ambicion: 1.2, curiosidad: 1, 'o.tecnologia': 1, 'o.ciencia': 0.8, fe: -0.4 }, d: 'Naves que cruzan el cristal: la civilización sale del orbe a conquistar las estrellas.' },
  trascendencia: { n: 'Trascendencia', i: '✨', tec: 'conciencia', mega: 'Templo de cristal', costo: { fe: 9000, cultura: 3000 }, w: { fe: 1.6, empatia: 0.8, 'o.religion': 1, ambicion: -0.6 }, d: 'La gente se vuelve luz: la conciencia deja el cuerpo y el orbe brilla.' },
  gaia: { n: 'Utopía de Gaia', i: '🌿', tec: 'gaia', mega: 'Jardín de Gaia', costo: { materiales: 6000, ciencia: 5000, cultura: 2000 }, w: { empatia: 1, 'o.naturaleza': 1.6, codicia: -0.8 }, d: 'Ciudad y bosque se funden: una sociedad en paz con la naturaleza.' },
  colmena: { n: 'Mente colmena', i: '🧠', tec: 'neural', mega: 'Red neural total', costo: { energia: 7000, ciencia: 9000 }, w: { 'o.tecnologia': 1.2, lealtad: 0.8, curiosidad: 0.4, 'o.igualdad': 0.6, ambicion: -0.2 }, d: 'Todas las mentes conectadas en una sola. ¿Utopía o fin del individuo?' },
  destruccion: { n: 'Destrucción', i: '💀', d: 'La civilización se destruyó a sí misma.' },
};
export const CAUSAS = {
  nuclear: { n: 'Guerra nuclear', t: 'Las bombas caen sobre las ciudades. Un hongo de fuego se levanta dentro del orbe.' },
  ia: { n: 'IA descontrolada', t: 'La inteligencia artificial decide que la humanidad sobra.' },
  eco: { n: 'Colapso ecológico', t: 'El bosque murió, el agua se envenenó, las cosechas fallan una tras otra.' },
  plaga: { n: 'Plaga artificial', t: 'Un virus creado en un laboratorio escapa y lo arrasa todo.' },
  civil: { n: 'Guerra civil', t: 'Hermanos contra hermanos: la ciudad arde por dentro.' },
  hambre: { n: 'Hambruna', t: 'No queda qué comer.' },
};

// poderes del espíritu del orbe
// poderes del espíritu del orbe: el jugador no gobierna, solo bendice o castiga (t: 'b' bendición, 'c' catástrofe, 'p' a una persona)
// poderes del espíritu del orbe: el jugador no gobierna, solo bendice o castiga (t: 'b' bendición, 'c' catástrofe, 'p' a una persona)
// poderes del espíritu del orbe: el jugador no gobierna, solo bendice o castiga (t: 'b' bendición, 'c' catástrofe, 'p' a una persona)
export const PODERES = {
  aconsejar: { n: 'Aconsejar', costo: 1, d: 'Susurra a favor de una opción de la decisión pendiente.' },   // (ya no se ofrece: decide la sociedad)
  forzar: { n: 'Imponer', costo: 3, d: 'La opción elegida gana sí o sí.' },                              // (ya no se ofrece)
  lluvia: { t: 'b', i: '🌧', n: 'Lluvia', costo: 1, d: 'Termina la sequía y riega los campos.' },
  cosecha: { t: 'b', i: '🌾', n: 'Cosecha abundante', costo: 1, d: 'Los graneros se llenan y el hambre se va.' },
  bendicion: { t: 'b', i: '💛', n: 'Sanación', costo: 2, d: 'Sana a todos y levanta el ánimo.' },
  fertilidad: { t: 'b', i: '👶', n: 'Fertilidad', costo: 2, d: 'Nacen niños en muchas familias.' },
  bosque: { t: 'b', i: '🌳', n: 'Bosque renace', costo: 1, d: 'Brotan árboles y el aire se limpia.' },
  chispa: { t: 'b', i: '💡', n: 'Chispa de genio', costo: 2, d: 'Un descubrimiento inesperado: avanza la ciencia.' },
  revelacion: { t: 'b', i: '🌟', n: 'Revelación', costo: 2, d: 'Una visión del espíritu: la fe crece en todo el orbe.' },
  calma: { t: 'b', i: '🕊', n: 'Calma', costo: 2, d: 'Apacigua odios, guerras y revueltas.' },
  errantes: { t: 'b', i: '🧳', n: 'Llamar errantes', costo: 2, d: 'Guía a viajeros hasta el orbe (también si quedó vacío).' },
  inspirar: { t: 'p', i: '✨', n: 'Inspirar', costo: 1, d: 'La persona elegida tiene una idea que la cambia (y tal vez a todos).' },
  rayo: { t: 'c', i: '⚡', n: 'Rayo', costo: 1, d: 'Cae un rayo sobre la ciudad y algo arde.' },
  sequia: { t: 'c', i: '☀', n: 'Sequía', costo: 1, d: 'Deja de llover: los campos se secan.' },
  plaga: { t: 'c', i: '🦠', n: 'Plaga', costo: 1, d: 'Una fiebre se extiende por una ciudad.' },
  incendio: { t: 'c', i: '🔥', n: 'Incendio', costo: 2, d: 'El fuego arrasa un bosque y los edificios cercanos.' },
  inundacion: { t: 'c', i: '🌊', n: 'Inundación', costo: 2, d: 'El lago se desborda y se lleva campos y casas de la orilla.' },
  terremoto: { t: 'c', i: '🌋', n: 'Terremoto', costo: 3, d: 'La tierra tiembla: edificios en ruinas y víctimas.' },
  meteorito: { t: 'c', i: '☄', n: 'Meteorito', costo: 4, d: 'Una roca del cielo abre un cráter donde caiga.' },
};

export const NOM_M = ['Tomás', 'Mateo', 'Joaquín', 'Elías', 'Simón', 'Gabriel', 'Andrés', 'Lucas', 'Martín', 'Julián', 'Esteban', 'Ramiro', 'Bruno', 'Iván', 'Félix', 'Gonzalo', 'Hernán', 'Ismael', 'Lorenzo', 'Nicolás', 'Pablo', 'Rodrigo', 'Samuel', 'Vicente', 'Emilio', 'Fabián', 'Germán', 'Hugo', 'Ciro', 'Dante', 'Abel', 'Benjamín', 'Camilo', 'Damián', 'Eusebio', 'Facundo', 'Jacinto', 'León', 'Marcos', 'Octavio', 'Rafael', 'Salvador', 'Tadeo', 'Ulises', 'Aurelio', 'Baltasar', 'Cristóbal', 'Darío', 'Evaristo', 'Fermín', 'Gael', 'Leandro', 'Matías', 'Renato', 'Thiago', 'Iker', 'Joel', 'Kai', 'Nilo', 'Orión'];
export const NOM_F = ['Lucía', 'Elena', 'Inés', 'Rosa', 'Marta', 'Clara', 'Ana', 'Sara', 'Julia', 'Irene', 'Laura', 'Olga', 'Paula', 'Valeria', 'Carmen', 'Alba', 'Teresa', 'Nora', 'Lía', 'Adela', 'Beatriz', 'Celia', 'Dora', 'Eva', 'Flor', 'Gloria', 'Helena', 'Isabel', 'Jimena', 'Luz', 'Mila', 'Noemí', 'Pilar', 'Raquel', 'Sofía', 'Violeta', 'Amparo', 'Blanca', 'Candela', 'Delia', 'Estela', 'Fátima', 'Graciela', 'Matilde', 'Otilia', 'Remedios', 'Salomé', 'Tránsito', 'Úrsula', 'Ximena', 'Aitana', 'Iris', 'Luna', 'Maia', 'Nara', 'Selene', 'Vera', 'Zoe', 'Abril', 'Gala'];
export const APELLIDOS = ['del Río', 'Montes', 'Arango', 'Salazar', 'Cárdenas', 'Restrepo', 'Ortiz', 'Vargas', 'Peña', 'Quintero', 'Rojas', 'Mejía', 'Duque', 'Toro', 'Henao', 'Zuluaga', 'Ospina', 'Giraldo', 'Valencia', 'Londoño', 'Cuervo', 'Pardo', 'Serna', 'Aguirre', 'Bermúdez', 'Luna', 'Sol', 'Bosque', 'Piedra', 'Arcos'];
export const NOMBRES_CIUDAD = ['Valle Hondo', 'Buenavista', 'El Claro', 'Santa Rita', 'Río Manso', 'La Esperanza', 'El Remanso', 'Las Garzas', 'Aguas Claras', 'Los Robles', 'El Pinar', 'La Pedrera', 'Piedra Alta', 'Las Lajas', 'Monte Oscuro', 'Nueva Aurora', 'Puerto Cristal'];
export const NOMBRES_MOV = {
  huelga: ['Unión de los Brazos Caídos', 'Frente Obrero', 'La Gran Huelga', 'Sindicato del Humo'],
  secta: ['Hijos de la Luz', 'Los del Cristal', 'Orden del Fuego Antiguo', 'Hermandad del Silencio', 'Guardianes del Espíritu'],
  revolucion: ['Revolución del Pan', 'Frente de Liberación', 'Los Sin Rey', 'Movimiento del Alba'],
  ecologista: ['Raíz Viva', 'Guardianes del Bosque', 'Movimiento Verde', 'Hijos de Gaia'],
  tecno: ['Futuristas', 'Sociedad del Mañana', 'Club de los Cohetes', 'Red Libre'],
  renacimiento: ['Academia de las Luces', 'Círculo de los Curiosos', 'Renacimiento'],
  pacifista: ['Manos Abiertas', 'Paz Ahora', 'Liga de las Madres'],
};
