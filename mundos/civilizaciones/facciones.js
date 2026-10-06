// =====================================================================
// Civilizaciones — datos de las facciones (puro: sin three ni DOM).
// Rasgos (con presupuesto de puntos), rasgos especiales con pros y contras, doctrinas de guerra,
// tipos de unidad y arquetipos. La simulación (sim.js) los lee; la interfaz los muestra.
// =====================================================================

// ---------------------------------------------------------------- rasgos: [clave, nombre, emoji, grupo, qué hace]
export const RASGOS = [
  ['fertilidad', 'Natalidad', '👶', 'Sociedad', 'Crecen más rápido sus ciudades.'],
  ['salud', 'Salud', '🩺', 'Sociedad', 'Resisten mejor las plagas.'],
  ['cohesion', 'Cohesión', '🤝', 'Sociedad', 'Unidad interna: menos cismas, más defensa.'],
  ['lealtad', 'Lealtad', '🛡️', 'Sociedad', 'Menos rebeliones y traiciones de generales.'],
  ['tolerancia', 'Tolerancia', '🫂', 'Sociedad', 'Asimilan mejor a los conquistados; imperios grandes sin perder unidad.'],
  ['fe', 'Religiosidad', '🙏', 'Sociedad', 'Moral y cohesión; guerras santas con pueblos de otra fe.'],
  ['ciencia', 'Ciencia', '🔬', 'Saber', 'Avanzan de era más rápido (mejores armas y murallas).'],
  ['innovacion', 'Innovación', '💡', 'Saber', 'Más saber, pero menos tradición (cohesión).'],
  ['comercio', 'Comercio', '💰', 'Saber', 'Rutas comerciales: saber, comida y oro.'],
  ['espionaje', 'Espionaje', '🕵️', 'Saber', 'Roban saber y sabotean la moral enemiga.'],
  ['agresividad', 'Agresividad', '⚔️', 'Guerra', 'Declaran más guerras y reclutan más tropas.'],
  ['disciplina', 'Disciplina', '🎖️', 'Guerra', 'Ejércitos más eficaces y que aguantan la moral.'],
  ['movilidad', 'Movilidad', '🏇', 'Guerra', 'Más caballería y marchas rápidas.'],
  ['ingenieria', 'Ingeniería', '🏗️', 'Guerra', 'Máquinas de asedio y murallas fuertes.'],
  ['crueldad', 'Crueldad', '💀', 'Guerra', 'Saquean, arrasan y aterran; todos los odian.'],
  ['diplomacia', 'Diplomacia', '🕊️', 'Política', 'Alianzas, comercio y paces tempranas.'],
  ['honor', 'Honor', '📜', 'Política', 'Cumplen tratados; con poco honor atacan a traición.'],
  ['expansion', 'Expansión', '🧭', 'Política', 'Colonizan y ocupan tierra más rápido.'],
  ['calor', 'Desierto y calor', '🔥', 'Tierra', 'Comida y combate en desierto y selva.'],
  ['frio', 'Nieve y frío', '❄️', 'Tierra', 'Comida y combate en tundra y nieve.'],
  ['agua', 'Mar y costa', '🌊', 'Tierra', 'Pesca, navegación temprana y flotas.'],
  ['bosque', 'Bosque', '🌲', 'Tierra', 'Comida y emboscadas en el bosque.'],
  ['montana', 'Montaña', '⛰️', 'Tierra', 'Comida y defensa en las montañas.'],
];
export const CLAVES = RASGOS.map((r) => r[0]);
export const GRUPOS = ['Sociedad', 'Saber', 'Guerra', 'Política', 'Tierra'];
// presupuesto: todos en 50 = 1150 puntos; se permiten 150 de más para especializarse
export const PRESUPUESTO = CLAVES.length * 50 + 150;
export const costo = (r) => CLAVES.reduce((s, k) => s + (+r[k] || 0), 0);
// si un conjunto de rasgos se pasa del presupuesto, baja proporcionalmente lo que está por encima de 50
export function ajustarPresupuesto(r) {
  const o = {}; for (const k of CLAVES) o[k] = Math.max(0, Math.min(100, Math.round(+(r[k] ?? 50))));
  let exceso = costo(o) - PRESUPUESTO;
  for (let vuelta = 0; exceso > 0 && vuelta < 30; vuelta++) {
    const altos = CLAVES.filter((k) => o[k] > 50); if (!altos.length) break;
    const sobre = altos.reduce((s, k) => s + (o[k] - 50), 0);
    for (const k of altos) { const baja = Math.ceil(exceso * (o[k] - 50) / sobre); o[k] = Math.max(50, o[k] - baja); }
    exceso = costo(o) - PRESUPUESTO;
  }
  return o;
}

// ---------------------------------------------------------------- rasgos especiales (máximo 2 por civilización)
// mod: multiplicadores (1 = nada) o sumas que la simulación entiende; pro/contra se muestran tal cual
export const ESPECIALES = {
  montana: { n: 'Nacidos en la montaña', e: '⛰️', pro: 'Doble comida y +40 % defensa en montaña', contra: '−15 % de natalidad', mod: { comida: { 8: 2, 9: 1.5 }, defMontana: 1.4, crec: 0.85 } },
  sangre: { n: 'Juramento de sangre', e: '🩸', pro: 'No retroceden nunca; +20 % moral', contra: '−20 diplomacia; sufren más bajas', mod: { moral: 0.2, sinRetirada: true, diplo: -20, bajas: 1.2 } },
  seda: { n: 'Ruta de la seda', e: '🐫', pro: '+40 % de saber por comercio; comercian hasta con rivales', contra: 'Los vecinos codician su oro (−8 relaciones)', mod: { comercioTec: 1.4, comercioTodos: true, diplo: -8 } },
  biblioteca: { n: 'Biblioteca eterna', e: '📚', pro: '+25 % de saber', contra: '−10 % de fuerza militar', mod: { tec: 1.25, ataque: 0.9 } },
  horda: { n: 'Horda inagotable', e: '🐎', pro: '+50 % de tropas', contra: '−20 % de saber', mod: { ejercito: 1.5, tec: 0.8 } },
  marea: { n: 'Marea negra', e: '🏴‍☠️', pro: '+60 % en el mar y saqueos costeros', contra: '−10 % en tierra; todos desconfían', mod: { naval: 1.6, saqueo: true, ataque: 0.9, diplo: -10 } },
  colmena: { n: 'Mente colmena', e: '🐝', pro: 'Nunca se divide; +30 cohesión', contra: '−20 % saber, −20 diplomacia', mod: { cisma: 0, cohesion: 30, tec: 0.8, diplo: -20 } },
  noche: { n: 'Hijos de la noche', e: '🦇', pro: 'Aterran: −25 % moral del rival', contra: '−15 % de comida', mod: { terror: 0.25, cap: 0.85 } },
  profetas: { n: 'Profetas', e: '📿', pro: 'Convierten lo conquistado; +15 fe', contra: 'Más guerras santas', mod: { asimila: 1.5, fe: 15, guerraSanta: true } },
  automatas: { n: 'Autómatas', e: '⚙️', pro: '+60 % asedio y +40 % murallas', contra: '−30 % de natalidad', mod: { asedio: 1.6, muralla: 1.4, crec: 0.7 } },
  bosque: { n: 'Pacto del bosque', e: '🌳', pro: 'Doble comida en el bosque; emboscadas +50 %', contra: '−25 % de combate en llanos y desierto', mod: { comida: { 4: 2, 5: 1.6 }, emboscada: 1.5, llanos: 0.75 } },
  mercenarios: { n: 'Oro mercenario', e: '💰', pro: 'Su comercio paga mercenarios (+40 % tropas)', contra: '−10 cohesión; los mercenarios desertan si pierden', mod: { mercenarios: true, cohesion: -10 } },
  espias: { n: 'Red de espías', e: '🕵️', pro: 'Roban saber y siembran discordia', contra: 'Nadie confía en ellos (−6 relaciones)', mod: { espia: true, diplo: -6 } },
  jinetes: { n: 'Pueblo jinete', e: '🏇', pro: '+40 % caballería y marchas más rápidas', contra: '−30 % en asedios', mod: { cab: 0.4, vel: 1, asedio: 0.7 } },
  longevos: { n: 'Longevos', e: '🧙', pro: 'Líderes que viven más y saben más (bono ×1,6)', contra: '−25 % de natalidad', mod: { liderVida: 0.4, liderBono: 1.6, crec: 0.75 } },
  madre: { n: 'Tierra madre', e: '🌾', pro: '+35 % de natalidad', contra: '+30 % de muertes en plagas', mod: { crec: 1.35, plagaSev: 1.3 } },
  sol: { n: 'Hijos del sol', e: '☀️', pro: 'Edades de oro el doble de probables', contra: 'Los desastres y eclipses los hunden', mod: { oro: 2, desastre: 1.5 } },
  cazadores: { n: 'Cazadores', e: '🏹', pro: '+30 % arqueros; comida en bosque y tundra', contra: '−15 % de capacidad de sus ciudades', mod: { arq: 0.3, comida: { 4: 1.4, 7: 1.6 }, cap: 0.85 } },
  hielo: { n: 'Corazón de hielo', e: '🐻‍❄️', pro: 'No sufren el frío; osos de guerra', contra: '−30 % en el calor', mod: { comida: { 7: 1.5, 9: 2 }, bestia: 'oso', calorPen: 0.7 } },
  bestias: { n: 'Domadores de bestias', e: '🐘', pro: 'Bestias de guerra de su tierra (+15 % del ejército)', contra: '−10 % de saber', mod: { bestiaExtra: 0.15, tec: 0.9 } },
  murallas: { n: 'Mil murallas', e: '🏯', pro: '+60 % de defensa en ciudades', contra: '−20 % de expansión', mod: { muralla: 1.6, exp: 0.8 } },
  embajadores: { n: 'Embajadores', e: '🎩', pro: '+20 relaciones; sobornan generales enemigos', contra: '−15 % de ataque', mod: { diplo: 20, soborno: true, ataque: 0.85 } },
};

// ---------------------------------------------------------------- doctrinas de guerra: cómo pelea cada pueblo
// mod lo usa la simulación; forma la usa la escena (formación de las tropas)
export const DOCTRINAS = {
  asalto: { n: 'Asalto', e: '⚔️', d: 'Choque frontal y asaltos rápidos a las murallas. Más bajas propias.', mod: { ataque: 1.15, bajas: 1.15, asaltoRapido: true }, forma: 'bloque' },
  oleadas: { n: 'Oleadas', e: '🐎', d: 'Jinetes en oleadas: rápidos y flanquean, malos en asedios.', mod: { vel: 1, flanqueo: 1.2, asedio: 0.75 }, forma: 'cuña' },
  asedio: { n: 'Asedio', e: '🏗️', d: 'Máquinas de asedio y paciencia: rompen murallas.', mod: { asedio: 1.5, vel: -0.5 }, forma: 'columna' },
  desgaste: { n: 'Desgaste', e: '🛡️', d: 'Defensa tenaz: el invasor se desangra en su tierra.', mod: { defensa: 1.25, desgaste: 0.04 }, forma: 'cuadro' },
  emboscada: { n: 'Emboscada', e: '🌲', d: 'Guerrilla y trampas en bosques y montañas.', mod: { emboscada: 1.4, abierto: 0.9 }, forma: 'disperso' },
  naval: { n: 'Naval', e: '⛵', d: 'Flotas y desembarcos: dominan el mar.', mod: { naval: 1.4, desembarco: 1.25 }, forma: 'linea' },
  terror: { n: 'Terror', e: '💀', d: 'Saqueo y miedo: ciudades que se rinden sin pelear.', mod: { terror: 0.2, rendicion: true, diplo: -15 }, forma: 'caos' },
  cruzada: { n: 'Cruzada', e: '✝️', d: 'Fanáticos que no retroceden y queman templos.', mod: { moral: 0.25, sinRetirada: true }, forma: 'columna' },
  diplomacia: { n: 'Diplomacia', e: '🕊️', d: 'Evitan la guerra; sobornan generales y firman paces pronto.', mod: { soborno: true, ataque: 0.9, pazPronta: true }, forma: 'cuadro' },
};
// la doctrina "natural" de un pueblo según sus rasgos y especiales
export function doctrinaDe(r, esp = []) {
  const s = {
    asalto: r.agresividad * 0.8 + r.disciplina * 0.7,
    oleadas: r.movilidad * 1.2 + r.expansion * 0.3 + (esp.includes('jinetes') || esp.includes('horda') ? 40 : 0),
    asedio: r.ingenieria * 1.25 + r.ciencia * 0.3 + (esp.includes('automatas') ? 40 : 0),
    desgaste: r.cohesion * 0.6 + r.honor * 0.3 + (100 - r.agresividad) * 0.45 + (esp.includes('murallas') ? 30 : 0),
    emboscada: r.bosque * 0.8 + r.espionaje * 0.6 + r.montana * 0.3 + (esp.includes('bosque') ? 40 : 0),
    naval: r.agua * 1.3 + (esp.includes('marea') ? 40 : 0),
    terror: r.crueldad * 1.4 + (esp.includes('noche') ? 40 : 0),
    cruzada: r.fe * 1.2 + r.agresividad * 0.25 + (esp.includes('profetas') ? 30 : 0),
    diplomacia: r.diplomacia * 1.1 + r.honor * 0.3 - r.agresividad * 0.5 + (esp.includes('embajadores') ? 40 : 0),
  };
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

// ---------------------------------------------------------------- unidades (piedra-papel-tijera) y su nombre según la era
export const UNIDADES = ['inf', 'arq', 'cab', 'asedio', 'bestia'];
// VENTAJA[a][b]: cuánto rinde a de más contra b (caballería > arqueros > infantería > caballería; bestias rompen infantería)
export const VENTAJA = {
  inf: { inf: 0, arq: -0.25, cab: 0.4, asedio: 0.3, bestia: -0.3 },
  arq: { inf: 0.25, arq: 0, cab: -0.4, asedio: 0.3, bestia: 0.25 },
  cab: { inf: -0.4, arq: 0.4, cab: 0, asedio: 0.4, bestia: -0.1 },
  asedio: { inf: -0.3, arq: -0.3, cab: -0.4, asedio: 0, bestia: -0.3 },
  bestia: { inf: 0.3, arq: -0.25, cab: 0.1, asedio: 0.3, bestia: 0 },
};
export function nombreUnidad(t, era, bestia) {
  if (t === 'inf') return era >= 4 ? 'fusileros' : era >= 2 ? 'legionarios' : 'lanceros';
  if (t === 'arq') return era >= 4 ? 'mosqueteros' : era >= 2 ? 'ballesteros' : 'arqueros';
  if (t === 'cab') return era >= 5 ? 'tanques' : era >= 2 ? 'caballeros' : 'jinetes';
  if (t === 'asedio') return era >= 5 ? 'artillería' : era >= 4 ? 'cañones' : era >= 2 ? 'catapultas' : 'arietes';
  return era >= 6 ? 'aviones' : { camello: 'camellos', elefante: 'elefantes', oso: 'osos de guerra', lobo: 'lobos', cabra: 'carneros de montaña' }[bestia] || 'bestias';
}

// ---------------------------------------------------------------- estilos de edificios (paleta y forma de techos)
export const ESTILOS = {
  piedra: { n: 'Piedra', muro: 0xb9b1a0, casa: 0xe8dcc0, techo: 'cono' },
  madera: { n: 'Madera', muro: 0x8a6440, casa: 0xc9a77a, techo: 'cono' },
  adobe: { n: 'Adobe', muro: 0xd8b07a, casa: 0xe6c99a, techo: 'plano' },
  hielo: { n: 'Hielo', muro: 0xdfeaf2, casa: 0xf2f7fa, techo: 'cupula' },
  oscuro: { n: 'Obsidiana', muro: 0x3a3440, casa: 0x5a5060, techo: 'pincho' },
  dorado: { n: 'Dorado', muro: 0xe2c46a, casa: 0xf2e2b0, techo: 'piramide' },
  mecanico: { n: 'Metal', muro: 0x8a9096, casa: 0xb0b6bc, techo: 'plano' },
  organico: { n: 'Colmena', muro: 0xb88a3a, casa: 0xd9a84a, techo: 'cupula' },
};

// ---------------------------------------------------------------- arquetipos (presets)
const P = (nombre, emblema, color, t, r, especiales, estilo, desc) => ({ nombre, emblema, color, t, r: ajustarPresupuesto(r), especiales, estilo, desc });
export const PRESETS = {
  guerrero: P('Imperio de Karth', '⚔️', '#c0392b', 'Imperio guerrero', { agresividad: 88, disciplina: 85, cohesion: 68, expansion: 72, fertilidad: 62, ingenieria: 60, ciencia: 40, diplomacia: 14, honor: 55, comercio: 30, crueldad: 55, espionaje: 30, bosque: 40, agua: 30 }, ['sangre', 'horda'], 'piedra', 'Legiones en bloque con escudos: atacan de frente y no paran.'),
  sabios: P('Sabios de Elwen', '🌳', '#27ae60', 'Sabios del bosque', { ciencia: 88, innovacion: 70, bosque: 85, cohesion: 72, diplomacia: 70, agresividad: 20, honor: 70, salud: 60, crueldad: 10, movilidad: 35, espionaje: 55 }, ['bosque', 'biblioteca'], 'madera', 'Guerrilla en el bosque y saber que crece siglo tras siglo.'),
  mercaderes: P('Liga de Saltmar', '⛵', '#2e86de', 'Mercaderes del mar', { comercio: 92, agua: 92, diplomacia: 75, ciencia: 60, agresividad: 30, crueldad: 15, tolerancia: 70, honor: 60, frio: 30, montana: 30 }, ['seda', 'mercenarios'], 'piedra', 'Flotas, oro y mercenarios: compran la guerra que no quieren pelear.'),
  fanaticos: P('Califato de Zahr', '🔥', '#e67e22', 'Fanáticos del desierto', { fe: 96, calor: 92, cohesion: 86, agresividad: 72, fertilidad: 72, crueldad: 55, ciencia: 30, diplomacia: 20, frio: 15, agua: 20, tolerancia: 15, lealtad: 75 }, ['profetas', 'sangre'], 'adobe', 'Cruzadas de fanáticos sobre camellos que no retroceden.'),
  hielo: P('Clanes de Vinterhal', '❄️', '#7fb3d5', 'Clanes del hielo', { frio: 95, agresividad: 62, cohesion: 76, disciplina: 60, montana: 60, lealtad: 70, calor: 10, ciencia: 45, comercio: 30 }, ['hielo', 'cazadores'], 'hielo', 'Clanes con osos de guerra y esquíes; inmunes al invierno.'),
  horda: P('Horda de Tumur', '🐎', '#8e44ad', 'Horda nómada', { movilidad: 96, expansion: 95, agresividad: 82, fertilidad: 82, crueldad: 60, ciencia: 20, cohesion: 40, diplomacia: 18, agua: 15, ingenieria: 20, lealtad: 40 }, ['jinetes', 'horda'], 'madera', 'Oleadas de jinetes: llegan rápido y arrasan los llanos.'),
  republica: P('República de Aurea', '🕊️', '#f1c40f', 'República pacífica', { diplomacia: 95, honor: 90, ciencia: 70, comercio: 72, tolerancia: 85, agresividad: 10, crueldad: 5, cohesion: 62, salud: 65 }, ['embajadores', 'murallas'], 'piedra', 'Paz, alianzas y murallas; sobornan a los generales enemigos.'),
  tecno: P('Tecnarquía de Ix', '⚙️', '#95a5a6', 'Tecnócratas', { ciencia: 98, innovacion: 90, ingenieria: 85, comercio: 62, agua: 62, fe: 10, fertilidad: 35, cohesion: 62, salud: 70 }, ['automatas', 'biblioteca'], 'mecanico', 'Máquinas de asedio, artillería y luego tanques y aviones.'),
  solar: P('Teocracia de Inti', '☀️', '#f39c12', 'Teocracia solar', { fe: 92, cohesion: 82, lealtad: 85, calor: 70, ingenieria: 65, agresividad: 50, ciencia: 50, tolerancia: 30, montana: 60 }, ['sol', 'profetas'], 'dorado', 'Pirámides de oro y cruzadas al amanecer.'),
  colmena: P('Enjambre de Zzyr', '🐝', '#d4ac0d', 'Enjambre de colmena', { fertilidad: 95, cohesion: 95, lealtad: 95, expansion: 80, disciplina: 70, innovacion: 15, diplomacia: 10, tolerancia: 10, salud: 40 }, ['colmena', 'madre'], 'organico', 'Millones que obedecen: oleadas que nunca se dividen.'),
  piratas: P('Hermandad del Coral', '🏴‍☠️', '#34495e', 'Piratas', { agua: 96, movilidad: 70, crueldad: 70, comercio: 65, agresividad: 70, honor: 10, lealtad: 35, espionaje: 60, diplomacia: 20 }, ['marea', 'mercenarios'], 'madera', 'Flotas negras que saquean costas y desembarcan de noche.'),
  nomadas: P('Caravanas de Qadir', '🐫', '#c08a3a', 'Nómadas del desierto', { calor: 96, movilidad: 85, comercio: 75, expansion: 70, agresividad: 55, salud: 60, ingenieria: 25, frio: 10 }, ['seda', 'bestias'], 'adobe', 'Caravanas de camellos: comercian en paz y golpean rápido.'),
  druidas: P('Círculo de Brann', '🌿', '#1e8449', 'Druidas', { bosque: 96, fe: 80, salud: 80, cohesion: 75, espionaje: 60, ciencia: 50, agresividad: 30, crueldad: 15, ingenieria: 15 }, ['bosque', 'bestias'], 'madera', 'Lobos y trampas: el bosque entero pelea por ellos.'),
  automatas: P('Forja de Kessel', '🤖', '#7f8c8d', 'Ingenieros autómatas', { ingenieria: 98, ciencia: 85, disciplina: 85, innovacion: 70, montana: 70, fertilidad: 20, fe: 5, diplomacia: 30 }, ['automatas', 'murallas'], 'mecanico', 'Fortalezas de metal y artillería que muele murallas.'),
  nocturnos: P('Corte de Morvane', '🦇', '#6c3483', 'Nocturnos', { crueldad: 92, espionaje: 85, longevidad: 80, lealtad: 70, agresividad: 65, fertilidad: 25, salud: 80, diplomacia: 25, honor: 15 }, ['noche', 'longevos'], 'oscuro', 'Señores inmortales y terror: los pueblos se rinden antes de pelear.'),
  cazadores: P('Tribu de Ahanu', '🏹', '#a04000', 'Tribu de cazadores', { bosque: 85, frio: 65, movilidad: 70, disciplina: 55, salud: 70, ciencia: 25, ingenieria: 20, comercio: 30, tolerancia: 60 }, ['cazadores', 'bestias'], 'madera', 'Arqueros invisibles entre los árboles.'),
  imperioHielo: P('Imperio de Nordheim', '🏔️', '#5dade2', 'Imperio del hielo', { frio: 90, montana: 85, disciplina: 80, ingenieria: 70, cohesion: 75, agresividad: 60, calor: 5, comercio: 35 }, ['montana', 'murallas'], 'hielo', 'Fortalezas en las cumbres: imposibles de tomar.'),
  espias: P('Sombra de Vey', '👁️', '#2c3e50', 'Reino de espías', { espionaje: 98, diplomacia: 60, comercio: 65, ciencia: 65, honor: 15, lealtad: 60, agresividad: 40, crueldad: 40 }, ['espias', 'embajadores'], 'oscuro', 'Ganan guerras antes de que empiecen: roban, sobornan y dividen.'),
};
export const EMBLEMAS = ['⚔️', '🌳', '⛵', '🔥', '❄️', '🐎', '🕊️', '⚙️', '☀️', '🐝', '🏴‍☠️', '🐫', '🌿', '🤖', '🦇', '🏹', '🏔️', '👁️', '🦁', '🐉', '🌙', '🦅', '🐺', '🌊', '💀', '👑', '🐍', '🦂'];
export const COLORES = ['#c0392b', '#27ae60', '#2e86de', '#e67e22', '#8e44ad', '#f1c40f', '#16a085', '#d35d9b', '#7fb3d5', '#95a5a6', '#a04000', '#34495e'];
