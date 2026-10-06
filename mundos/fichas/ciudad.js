// =====================================================================
// Mundo: «Barrio Los Almendros» — Andrés y María viven en el 3B de un edificio con vecinos,
// trabajan, pagan arriendo, hacen mercado, salen, conversan y discuten. Berlín y Axel viven con ellos.
// Esta ficha es solo datos y reglas: el motor (../motor/sim.js) hace el resto.
// =====================================================================
const H = (n) => n * 60;

// ---------------------------------------------------------------- el barrio (vista desde arriba; +z hacia el frente)
const ACERA = [{ x: -21.5, z: -17.5 }, { x: 21.5, z: -17.5 }, { x: 21.5, z: 17.5 }, { x: -21.5, z: 17.5 }];
const TORRE = { x: 0, z: -26 };
const apto = (piso, u) => ({ id: `apto${piso}${u}`, nombre: `el ${piso}${u}`, tipo: 'apto', edificio: 'torre', piso, unidad: u, pos: { x: TORRE.x + (u === 'A' ? -4 : 4), z: TORRE.z }, entrada: { x: 0, z: -18.6 } });
const LUGARES = [
  { id: 'torre', nombre: 'el edificio Los Almendros', tipo: 'torre', pos: TORRE, tam: { w: 17, d: 9, pisos: 4 }, entrada: { x: 0, z: -18.6 }, decorado: true },
  { id: 'lobby', nombre: 'el lobby', tipo: 'lobby', edificio: 'torre', piso: 0, pos: TORRE, entrada: { x: 0, z: -18.6 } },
  ...[1, 2, 3, 4].flatMap((p) => ['A', 'B'].map((u) => apto(p, u))),
  { id: 'super', nombre: 'el supermercado', tipo: 'super', pos: { x: -30, z: -6 }, tam: { w: 10, d: 12, h: 5 }, rot: Math.PI / 2, entrada: { x: -22.6, z: -6 }, horario: [7, 22] },
  { id: 'taller', nombre: 'el taller de costura Hilos', tipo: 'taller', pos: { x: -29, z: 10 }, tam: { w: 8, d: 8, h: 4.5 }, rot: Math.PI / 2, entrada: { x: -22.6, z: 10 }, horario: [8, 19], dias: [0, 1, 2, 3, 4, 5] },
  { id: 'cafe', nombre: 'el café La Esquina', tipo: 'cafe', pos: { x: 29, z: -8 }, tam: { w: 9, d: 8, h: 4.5 }, rot: -Math.PI / 2, entrada: { x: 22.6, z: -8 }, horario: [6, 20] },
  { id: 'gym', nombre: 'el gimnasio Fuerza Urbana', tipo: 'gym', pos: { x: 30, z: 8 }, tam: { w: 10, d: 10, h: 6 }, rot: -Math.PI / 2, entrada: { x: 22.6, z: 8 }, horario: [6, 22] },
  { id: 'bar', nombre: 'el bar El Farol', tipo: 'bar', pos: { x: 12, z: 26 }, tam: { w: 10, d: 8, h: 4.5 }, rot: Math.PI, entrada: { x: 12, z: 18.6 }, horario: [16, 26] },
  { id: 'oficina', nombre: 'la torre de oficinas', tipo: 'oficina', pos: { x: -12, z: 27 }, tam: { w: 10, d: 9, h: 18 }, rot: Math.PI, entrada: { x: -12, z: 18.6 }, horario: [7, 20], dias: [0, 1, 2, 3, 4] },
  { id: 'clinica', nombre: 'la clínica', tipo: 'clinica', pos: { x: 29, z: 24 }, tam: { w: 9, d: 8, h: 6 }, rot: -Math.PI * 0.75, entrada: { x: 23, z: 19.5 } },
  { id: 'parque', nombre: 'el parque', tipo: 'parque', pos: { x: 0, z: 0 }, tam: { w: 26, d: 20 }, entrada: { x: 0, z: 9.6 }, horario: [5, 23] },
];

// ---------------------------------------------------------------- necesidades (bajan por hora; los rasgos cambian el ritmo)
const NECESIDADES = {
  hambre: { nombre: 'Hambre', icono: '🍽', baja: 4.2, dormido: 0.4, vital: 2, urgente: 12, peso: 1.3 },
  energia: { nombre: 'Energía', icono: '⚡', baja: 3.6, dormido: 0, peso: 1.2, urgente: 6 },
  higiene: { nombre: 'Higiene', icono: '🚿', baja: 2.2, dormido: 0.5, peso: 0.9, especies: ['persona'] },
  diversion: { nombre: 'Diversión', icono: '🎈', baja: 3.0, dormido: 0, peso: 1.0 },
  social: { nombre: 'Social', icono: '💬', baja: 2.3, dormido: 0, peso: 1.0 },
};

// ---------------------------------------------------------------- rasgos (multiplican necesidades y gustos)
const RASGOS = {
  atletico: { nombre: 'Atlético', mod: { gusto_entrenar: 2.2, gusto_correr: 2.2, baja_energia: 0.9 } },
  hiperactivo: { nombre: 'Hiperactivo', mod: { baja_diversion: 1.35, gusto_dormir: 0.85, gusto_verTV: 0.6 } },
  tranquilo: { nombre: 'Tranquilo', mod: { gusto_leer: 1.4, gusto_pasear: 1.3 }, calma: 0.6 },
  escultor: { nombre: 'Escultor', mod: { gusto_esculpir: 3 } },
  vino: { nombre: 'Le gusta el vino', mod: { gusto_tomarAlgo: 1.6 } },
  costurera: { nombre: 'Costurera', mod: { gusto_coser: 3 } },
  jardinera: { nombre: 'Mano verde', mod: { gusto_plantas: 3, gusto_pasear: 1.2 } },
  malgeniada: { nombre: 'Malgeniada', mod: {}, discute: 2.2 },
  fiestero: { nombre: 'Fiestero', mod: { gusto_tomarAlgo: 2.4, gusto_dormir: 0.75, baja_social: 1.3 } },
  chismosa: { nombre: 'Chismosa', mod: { gusto_conversar: 2.0, baja_social: 1.3 } },
  hogareno: { nombre: 'Hogareño', mod: { gusto_verTV: 1.6, gusto_tomarAlgo: 0.4, gusto_cocinar: 1.3 } },
  musico: { nombre: 'Músico', mod: { gusto_tocar: 3 }, ruidoso: true },
  ordenado: { nombre: 'Ordenado', mod: { gusto_limpiar: 2.2 } },
  desordenado: { nombre: 'Desordenado', mod: { gusto_limpiar: 0.3 } },
  dormilon: { nombre: 'Dormilón', mod: { baja_energia: 1.2, gusto_dormir: 1.3 } },
  cocinero: { nombre: 'Cocina rico', mod: { gusto_cocinar: 2.2 } },
  estudioso: { nombre: 'Estudioso', mod: { gusto_leer: 2 } },
  gatos: { nombre: 'Ama a los gatos', mod: {} },
  celoso: { nombre: 'Celoso', mod: {}, discute: 1.6 },
  trabajadora: { nombre: 'Trabajadora', mod: { baja_energia: 1.05 } },
  // mascotas
  leal: { nombre: 'Leal', mod: {} }, jugueton: { nombre: 'Juguetón', mod: { baja_diversion: 1.3 } }, trepador: { nombre: 'Trepador', mod: { gusto_trepar: 2.5 } },
};

// ---------------------------------------------------------------- utilidades para las acciones
const deNoche = (h) => h >= 22 || h < 6.5;
const hogarDe = (s, a) => s.hogares[a.hogar];
const companeros = (s, a) => s.agentes.filter((o) => o !== a && o.vivo && o.hogar === a.hogar && o.especie === 'persona');
const libre = (o) => !o.tarea || ['verTV', 'leer', 'pasear', 'tomarCafe', 'tomarAlgo', 'descansar', 'coser', 'esculpir', 'tocar', 'plantas'].includes(o.tarea.accion);

// ---------------------------------------------------------------- acciones
const ACCIONES = {
  dormir: { en: 'hogar', duerme: true, noCortar: true, dur: (s, a) => { const h = (s.t % 1440) / 60; return deNoche(h) ? Math.max(60, ((7 - h + 24) % 24) * 60 + 20) : 150; }, efectos: { energia: 15 },
    texto: 'Durmiendo', utilidad: (s, a, u, api) => { const h = api.hora(s); return deNoche(h) ? 20 + (100 - a.n.energia) / 5 : a.n.energia < 15 ? 25 : -50; } },
  siesta: { en: 'hogar', duerme: true, dur: [35, 70], efectos: { energia: 12 }, texto: 'Haciendo una siesta', utilidad: (s, a, u, api) => (deNoche(api.hora(s)) || a.n.energia > 45 ? -50 : u) },
  cocinar: { en: 'hogar', siFalta: 'hambre', dur: 40, efectos: { hambre: 85 }, texto: 'Cocinando y comiendo', requiere: (s, a) => hogarDe(s, a)?.despensa >= 1 && !s.banderas.sinLuz,
    alTerminar: (s, a, api) => { const h = hogarDe(s, a); h.despensa = Math.max(0, h.despensa - 1); for (const o of companeros(s, a)) if (o.lugar === a.lugar && o.n.hambre < 70) { o.n.hambre = Math.min(100, o.n.hambre + 40); api.recuerdo(s, o, `${a.nombre} cocinó`, 4, 6); } } },
  pedirDomicilio: { en: 'hogar', siFalta: 'hambre', umbral: 55, dur: 55, efectos: { hambre: 70 }, costo: 30, texto: 'Comiendo a domicilio', alTerminar: (s, a) => { hogarDe(s, a).dinero -= 30; },
    utilidad: (s, a, u) => (hogarDe(s, a)?.despensa >= 1 && !s.banderas.sinLuz ? u * 0.3 : u * 0.9) },
  comerFuera: { en: 'cafe', siFalta: 'hambre', umbral: 60, dur: 45, efectos: { hambre: 85, social: 25, diversion: 10 }, costo: 25, texto: 'Almorzando en el café', alTerminar: (s, a) => { hogarDe(s, a).dinero -= 25; }, utilidad: (s, a, u) => u * 0.75 },
  ducharse: { en: 'hogar', siFalta: 'higiene', umbral: 75, dur: 15, efectos: { higiene: 300 }, texto: 'Bañándose' },
  limpiar: { en: 'hogar', dur: 40, efectos: { diversion: -5 }, base: 0, texto: 'Ordenando y limpiando el apartamento', utilidad: (s, a, u) => { const h = hogarDe(s, a); return h ? (100 - h.limpieza) / 6 * (u > 0 ? 1 : 1) * (a.rasgos.includes('ordenado') ? 2.2 : a.rasgos.includes('desordenado') ? 0.3 : 1) - 3 : -50; },
    alTerminar: (s, a) => { const h = hogarDe(s, a); h.limpieza = Math.min(100, h.limpieza + 45); } },
  verTV: { en: 'hogar', dur: [40, 90], efectos: { diversion: 28 }, texto: 'Viendo series', requiere: (s) => !s.banderas.sinLuz },
  leer: { en: 'hogar', dur: [30, 70], efectos: { diversion: 20 }, texto: 'Leyendo' },
  coser: { en: 'hogar', dur: [40, 80], efectos: { diversion: 32 }, texto: 'Cosiendo en la máquina', requiere: (s, a) => a.rasgos.includes('costurera') },
  esculpir: { en: 'hogar', dur: [40, 90], efectos: { diversion: 34 }, texto: 'Tallando en el balcón', requiere: (s, a) => a.rasgos.includes('escultor') },
  tocar: { en: 'hogar', dur: [30, 70], efectos: { diversion: 35 }, texto: 'Tocando la guitarra eléctrica', requiere: (s, a) => a.rasgos.includes('musico'),
    mientras: (s, a, d, api) => { const h = api.hora(s); if (h >= 22 || h < 7) s.banderas.ruido = s.t + 30; } },
  plantas: { en: 'hogar', dur: [20, 40], efectos: { diversion: 22 }, texto: 'Cuidando las plantas del balcón', requiere: (s, a) => a.rasgos.includes('jardinera') },
  entrenar: { en: 'gym', dur: [45, 75], efectos: { diversion: 30, energia: -10, higiene: -30 }, costo: 0, texto: 'Entrenando', requiere: (s, a, api) => !(a.trabajo?.lugar === 'gym' && api.hora(s) < (a.trabajo?.salida ?? 0) && api.hora(s) >= (a.trabajo?.entrada ?? 0)) },
  correr: { en: 'parque', dur: [30, 50], efectos: { diversion: 28, energia: -12, higiene: -35 }, texto: 'Trotando en el parque' },
  pasear: { en: 'parque', dur: [30, 60], efectos: { diversion: 16, social: 6 }, texto: 'Paseando por el parque' },
  tomarCafe: { en: 'cafe', dur: 30, efectos: { energia: 18, social: 18, diversion: 10 }, costo: 6, texto: 'Tomando un café', alTerminar: (s, a) => { hogarDe(s, a).dinero -= 6; } },
  tomarAlgo: { en: 'bar', dur: [60, 130], efectos: { social: 45, diversion: 38, energia: -6 }, costo: 18, texto: 'Tomando algo en el bar', alTerminar: (s, a) => { hogarDe(s, a).dinero -= 18; },
    utilidad: (s, a, u, api) => { const h = api.hora(s); return h >= 18 || h < 1.5 ? u : -50; } },
  comprar: { en: 'super', dur: 30, efectos: {}, costo: 70, texto: 'Haciendo mercado', utilidad: (s, a) => { const h = hogarDe(s, a); return h && !s.agentes.some((o) => o !== a && o.hogar === a.hogar && o.tarea?.accion === 'comprar') ? (h.despensa < 3 ? 30 : h.despensa < 6 ? 7 : -40) : -50; },
    alTerminar: (s, a, api) => { const h = hogarDe(s, a); h.dinero -= 70; h.despensa += 12; } },
  comprarPoco: { en: 'super', dur: 20, efectos: {}, costo: 22, texto: 'Comprando lo justo', utilidad: (s, a) => { const h = hogarDe(s, a); return h && h.dinero < 70 && h.despensa < 2 ? 32 : -50; },
    alTerminar: (s, a, api) => { const h = hogarDe(s, a); h.dinero -= 22; h.despensa += 4; api.log(s, `${a.nombre} solo alcanzó a comprar lo justo en el super.`, 'aviso', a.id); } },
  trabajar: { en: 'trabajo', noCortar: true, dur: (s, a) => Math.max(10, (a.trabajo.salida - (s.t % 1440) / 60) * 60), efectos: { social: 12, diversion: -1, energia: -2 }, lejosImporta: 0,
    texto: (s, a) => a.trabajo.texto || 'Trabajando', yendo: (s, a) => `Va al trabajo`,
    utilidad: (s, a, u, api) => { const T = a.trabajo, h = api.hora(s); if (!T || !(T.dias || [0, 1, 2, 3, 4]).includes(api.diaSemana(s)) || h < T.entrada - 0.75 || h >= T.salida - 0.25) return -99; if (s.hoyTrabajo?.[a.id] === api.dia(s)) return -99; return 60; },
    alEmpezar: (s, a, api, T) => { T.llego = s.t; if (api.hora(s) > a.trabajo.entrada + 0.5) { a.trabajo.tardes = (a.trabajo.tardes || 0) + 1; api.recuerdo(s, a, 'Llegó tarde al trabajo', -4, 10); } },
    alTerminar: (s, a, api, T) => { const pago = Math.round(a.trabajo.sueldo * Math.min(1, (s.t - (T.llego ?? s.t)) / 60 / (a.trabajo.salida - a.trabajo.entrada))); hogarDe(s, a).dinero += pago; (s.hoyTrabajo ||= {})[a.id] = api.dia(s); } },
  conversar: { en: 'aqui', conOtro: true, dur: [15, 35], efectos: { social: 70, diversion: 12 }, base: 2, texto: (s, a, T) => `Conversando con ${s.agentes.find((o) => o.id === T.con)?.nombre || 'alguien'}`,
    conQuien: (s, a, o) => o.lugar === a.lugar && a.lugar && o.especie === 'persona' && libre(o) && !(o.tarea?.con),
    requiere: (s, a) => s.agentes.some((o) => o !== a && o.vivo && o.especie === 'persona' && o.lugar === a.lugar && a.lugar && libre(o) && !o.tarea?.con),
    utilidad: (s, a, u, api) => (deNoche(api.hora(s)) ? u * 0.3 : u + (s.agentes.some((o) => o.lugar === a.lugar && api.relacion(s, a.id, o.id).pareja) ? 4 : 0)),
    alTerminar: (s, a, api, T) => conversacion(s, a, s.agentes.find((o) => o.id === T.con), api) },
  // la pareja: un rato juntos en el sofá al final del día (y, a veces, algo más)
  acurrucarse: { en: 'hogar', conOtro: true, dur: [30, 60], efectos: { social: 60, diversion: 35, energia: 3 }, base: 4, texto: (s, a, T) => `Acurrucados con ${s.agentes.find((o) => o.id === T.con)?.nombre || 'su pareja'}`,
    conQuien: (s, a, o, api) => api.relacion(s, a.id, o.id).pareja && o.lugar === a.lugar && libre(o),
    requiere: (s, a, api) => { const h = api.hora(s); return h >= 19 && h < 23.5 && s.agentes.some((o) => o.lugar === a.lugar && api.relacion(s, a.id, o.id).pareja && libre(o)); },
    alTerminar: (s, a, api, T) => { const o = s.agentes.find((x) => x.id === T.con); if (!o) return; const R = api.relacion(s, a.id, o.id); R.romance = Math.min(100, (R.romance || 0) + 4); R.afinidad = Math.min(100, R.afinidad + 1.5); api.recuerdo(s, a, `Un rato con ${o.nombre}`, 8, 12); api.recuerdo(s, o, `Un rato con ${a.nombre}`, 8, 12); api.efecto(s, 'corazones', a.pos.x, a.pos.z); } },
  // mascotas (el perro sale con su dueño; el gato no sale)
  comerMascota: { en: 'hogar', especies: ['perro', 'gato'], dur: 15, efectos: { hambre: 200 }, texto: 'Comiendo de su plato' },
  dormirMascota: { en: 'hogar', especies: ['perro', 'gato'], duerme: true, dur: [60, 180], efectos: { energia: 16 }, texto: 'Durmiendo', utilidad: (s, a, u, api) => u + (deNoche(api.hora(s)) ? 10 : 0) },
  jugarMascota: { en: 'hogar', especies: ['perro', 'gato'], dur: [15, 40], efectos: { diversion: 40, social: 15 }, texto: 'Jugando por la casa' },
  trepar: { en: 'hogar', especies: ['gato'], dur: [20, 60], efectos: { diversion: 30 }, texto: 'Trepado en la biblioteca, mirando todo' },
  esperarDueno: { en: 'hogar', especies: ['perro'], dur: 30, efectos: { social: 10 }, texto: 'Esperando en la puerta', utilidad: (s, a, u) => (s.agentes.some((o) => a.duenos?.includes(o.id) && o.lugar === a.lugar) ? -50 : u + 2) },
  paseoPerro: { en: 'parque', especies: ['perro'], dur: [30, 45], efectos: { diversion: 60, social: 30, energia: -8 }, texto: 'De paseo en el parque', utilidad: () => -99 },
  pasearPerro: { en: 'parque', dur: [30, 45], efectos: { diversion: 18, social: 8 }, texto: 'Paseando a Berlín',
    requiere: (s, a) => s.agentes.some((p) => p.especie === 'perro' && p.vivo && p.duenos?.includes(a.id) && p.lugar === a.lugar && p.tarea?.accion !== 'paseoPerro'),
    utilidad: (s, a, u, api) => { const p = s.agentes.find((x) => x.especie === 'perro' && x.vivo && x.duenos?.includes(a.id)); return p ? u + (100 - p.n.diversion) / 4 + (p.n.social < 40 ? 6 : 0) - (deNoche(api.hora(s)) ? 15 : 0) : -50; },
    alElegir: (s, a, api, T) => { const p = s.agentes.find((x) => x.especie === 'perro' && x.vivo && x.duenos?.includes(a.id)); if (p) { api.hacer(s, p, 'paseoPerro', 'parque', { resta: T.resta + 10 }); T.perro = p.id; } } },
};

// ---------------------------------------------------------------- conversaciones: amistad, chismes, discusiones y romance
function conversacion(s, a, b, api) {
  if (!b) return;
  const R = api.relacion(s, a.id, b.id), compat = (a.rasgos.filter((r) => b.rasgos.includes(r)).length * 3) + (api.rng(s) - 0.4) * 8;
  const enojo = (RASGOS.malgeniada.discute * (a.rasgos.includes('malgeniada') ? 1 : 0)) + (a.rasgos.includes('celoso') ? 1 : 0);
  const pelea = api.rng(s) < 0.04 + (a.animo < 40 ? 0.12 : 0) + enojo * 0.05 - (a.rasgos.includes('tranquilo') ? 0.03 : 0) - R.afinidad / 1000;
  R.conocidos = true; R.ultima = s.t;
  if (pelea) {
    R.afinidad = Math.max(-100, R.afinidad - 8 - api.rng(s) * 6);
    api.recuerdo(s, a, `Discutió con ${b.nombre}`, -10, 12); api.recuerdo(s, b, `Discutió con ${a.nombre}`, -10, 12);
    api.log(s, `💢 ${a.nombre} y ${b.nombre} discutieron${R.pareja ? ' (cosas de pareja)' : ''}.`, 'malo');
    api.efecto(s, 'enojo', a.pos.x, a.pos.z);
    if (R.pareja && R.afinidad < 35) api.proponer(s, { clave: 'crisisPareja', titulo: `${a.nombre} y ${b.nombre} están distanciados`, texto: `Discuten seguido y la afinidad bajó a ${Math.round(R.afinidad)}.`, defecto: 'nada', horas: 10, datos: { a: a.id, b: b.id },
      opciones: [{ k: 'cena', txt: 'Que salgan a cenar', pista: '−40 monedas; reconcilia' }, { k: 'hablar', txt: 'Que hablen con calma', pista: 'puede salir bien o mal' }, { k: 'nada', txt: 'Dejar que se les pase', pista: 'puede empeorar' }] });
    return;
  }
  R.afinidad = Math.min(100, R.afinidad + 2 + compat * 0.4);
  if (R.pareja) { R.romance = Math.min(100, (R.romance || 0) + 3); api.recuerdo(s, a, `Momento con ${b.nombre}`, 6, 10); api.recuerdo(s, b, `Momento con ${a.nombre}`, 6, 10); if (api.rng(s) < 0.25) api.efecto(s, 'corazones', a.pos.x, a.pos.z); }
  else if (R.afinidad > 40 && !R.amigos) { R.amigos = true; api.log(s, `🤝 ${a.nombre} y ${b.nombre} ya son amigos.`, 'bueno'); }
  // chismes: quien es chismosa cuenta lo último que pasó en el edificio
  if ((a.rasgos.includes('chismosa') || b.rasgos.includes('chismosa')) && api.rng(s) < 0.3 && s.banderas.chisme !== api.dia(s)) { const chis = s.diario.find((l) => l.tipo === 'malo' && s.t - l.t < 1440); if (chis) { s.banderas.chisme = api.dia(s); api.log(s, `🗣 ${a.rasgos.includes('chismosa') ? a.nombre : b.nombre} le contó a ${a.rasgos.includes('chismosa') ? b.nombre : a.nombre} el chisme del día: ${chis.texto.replace(/^[^ ]+ /, '').toLowerCase()}`, 'info'); } }
}

// ---------------------------------------------------------------- personajes
const PERSONAJES = [
  { id: 'andres', nombre: 'Andrés', sexo: 'h', edad: 31, hogar: '3B', cuerpo: 'andres', rasgos: ['atletico', 'hiperactivo', 'tranquilo', 'escultor', 'vino'],
    trabajo: { lugar: 'gym', entrada: 7, salida: 15, dias: [0, 1, 2, 3, 4], sueldo: 95, texto: 'Entrenando a sus clientes' }, aspecto: {} },
  { id: 'maria', nombre: 'María', sexo: 'm', edad: 29, hogar: '3B', cuerpo: 'maria', rasgos: ['costurera', 'jardinera', 'atletico', 'malgeniada'],
    trabajo: { lugar: 'taller', entrada: 9, salida: 17, dias: [0, 1, 2, 3, 4, 5], sueldo: 85, texto: 'Cosiendo en el taller' }, aspecto: {} },
  { id: 'berlin', nombre: 'Berlín', especie: 'perro', hogar: '3B', duenos: ['andres', 'maria'], rasgos: ['leal', 'jugueton'] },
  { id: 'axel', nombre: 'Axel', especie: 'gato', hogar: '3B', duenos: ['andres', 'maria'], rasgos: ['trepador'] },
  { id: 'rosa', nombre: 'Doña Rosa', sexo: 'm', edad: 72, hogar: '1B', cuerpo: 'maria', rasgos: ['chismosa', 'hogareno', 'gatos', 'cocinero'], aspecto: { camisa: 0x8a6a9a, pantalon: 0x4a4a52, pelo: 0xd8d8d8, alto: 0.92 } },
  { id: 'arturo', nombre: 'Don Arturo', sexo: 'h', edad: 58, hogar: '1A', cuerpo: 'andres', rasgos: ['ordenado', 'tranquilo', 'trabajadora'], aspecto: { camisa: 0x2f4a6a, pantalon: 0x2a2a30, pelo: 0x9a9a9a, alto: 0.97 },
    trabajo: { lugar: 'lobby', entrada: 7, salida: 15, dias: [0, 1, 2, 3, 4, 5], sueldo: 70, texto: 'Atendiendo la portería' } },
  { id: 'camila', nombre: 'Camila', sexo: 'm', edad: 34, hogar: '2A', cuerpo: 'maria', rasgos: ['trabajadora', 'celoso', 'ordenado'], aspecto: { camisa: 0x4aa3a0, pantalon: 0x34405a, pelo: 0x6b3a22 },
    trabajo: { lugar: 'clinica', entrada: 13, salida: 21, dias: [0, 2, 4, 5], sueldo: 105, texto: 'De turno en la clínica' } },
  { id: 'esteban', nombre: 'Esteban', sexo: 'h', edad: 37, hogar: '2A', cuerpo: 'andres', rasgos: ['hogareno', 'desordenado', 'dormilon'], aspecto: { camisa: 0xd8d2c4, pantalon: 0x3a3a46, pelo: 0x2a1e16 },
    trabajo: { lugar: 'oficina', entrada: 8, salida: 17, dias: [0, 1, 2, 3, 4], sueldo: 110, texto: 'En la oficina, frente al computador' } },
  { id: 'tomas', nombre: 'Tomás', sexo: 'h', edad: 44, hogar: '2B', cuerpo: 'andres', rasgos: ['cocinero', 'vino', 'tranquilo'], aspecto: { camisa: 0xf0f0f0, pantalon: 0x2a2a2a, pelo: 0x3a2a1e },
    trabajo: { lugar: 'bar', entrada: 16, salida: 24, dias: [1, 2, 3, 4, 5, 6], sueldo: 90, texto: 'Cocinando en el bar' } },
  { id: 'valeria', nombre: 'Valeria', sexo: 'm', edad: 28, hogar: '3A', cuerpo: 'maria', rasgos: ['fiestero', 'chismosa', 'desordenado'], aspecto: { camisa: 0xe2a13a, pantalon: 0x1e2430, pelo: 0xc8743a },
    trabajo: { lugar: 'oficina', entrada: 10, salida: 18, dias: [0, 1, 2, 3, 4], sueldo: 120, texto: 'Diseñando en la oficina' } },
  { id: 'julian', nombre: 'Julián', sexo: 'h', edad: 23, hogar: '4A', cuerpo: 'andres', rasgos: ['musico', 'fiestero', 'estudioso', 'dormilon'], aspecto: { camisa: 0x2a2a2a, pantalon: 0x4a5a7a, pelo: 0x1a1410, alto: 0.98 },
    trabajo: { lugar: 'cafe', entrada: 7, salida: 13, dias: [0, 1, 2, 3, 4, 5], sueldo: 58, texto: 'Preparando cafés' } },
];
const HOGARES = [
  { id: '3B', lugar: 'apto3B', nombre: 'Andrés y María', dinero: 1400, despensa: 10, alquiler: 900 },
  { id: '1A', lugar: 'apto1A', nombre: 'Don Arturo', dinero: 700, despensa: 8, alquiler: 500 },
  { id: '1B', lugar: 'apto1B', nombre: 'Doña Rosa', dinero: 1100, despensa: 12, alquiler: 600, pension: 260 },
  { id: '2A', lugar: 'apto2A', nombre: 'Camila y Esteban', dinero: 1600, despensa: 8, alquiler: 900 },
  { id: '2B', lugar: 'apto2B', nombre: 'Tomás', dinero: 800, despensa: 6, alquiler: 650 },
  { id: '3A', lugar: 'apto3A', nombre: 'Valeria', dinero: 900, despensa: 4, alquiler: 700 },
  { id: '4A', lugar: 'apto4A', nombre: 'Julián', dinero: 600, despensa: 5, alquiler: 420 },
];

// ---------------------------------------------------------------- eventos del barrio (algunos te piden una decisión)
const EVENTOS = [
  { id: 'fiesta', prob: 0.35, cuando: (s, api) => [4, 5].includes(api.diaSemana(s)), pasa: (s, api) => { s.banderas.fiesta = { desde: s.t + (23 - api.hora(s)) * 60, hasta: s.t + (27 - api.hora(s)) * 60 }; api.log(s, '🎸 Julián anunció una fiesta en el 4A esta noche.', 'aviso');
    api.proponer(s, { clave: 'fiesta', titulo: 'Fiesta ruidosa en el 4A', texto: 'Julián hará una fiesta esta noche. El 3B queda justo debajo: si hay ruido, Andrés y María duermen mal.', defecto: 'aguantar', horas: 10,
      opciones: [{ k: 'ir', txt: 'Ir a la fiesta', pista: 'diversión y amigos; se acuestan tarde' }, { k: 'quejarse', txt: 'Quejarse con Don Arturo', pista: 'se acaba el ruido; Julián se ofende' }, { k: 'aguantar', txt: 'Aguantar el ruido', pista: 'duermen mal y amanecen de mal genio' }] }); } },
  { id: 'ascensor', prob: 0.06, pasa: (s, api) => { s.banderas.ascensor = s.t + 2 * 1440; api.log(s, '🛗 Se dañó el ascensor: hay que subir por las escaleras dos días.', 'malo'); } },
  { id: 'galletas', prob: 0.12, pasa: (s, api) => { const r = api.agente(s, 'rosa'); if (!r?.vivo) return; const v = api.elegir(s, s.agentes.filter((o) => o.especie === 'persona' && o !== r && o.vivo)); api.relacion(s, r.id, v.id).afinidad += 6; api.recuerdo(s, v, 'Doña Rosa le llevó galletas', 6, 24); api.log(s, `🍪 Doña Rosa le llevó galletas a ${v.nombre}.`, 'bueno'); } },
  { id: 'apagon', prob: 0.05, pasa: (s, api) => { s.banderas.sinLuz = true; s.banderas.luzVuelve = s.t + 6 * 60; api.log(s, '💡 Se fue la luz en el barrio: sin cocina ni televisión por unas horas.', 'malo'); } },
  { id: 'pared', prob: 0.15, cuando: (s, api) => api.relacion(s, 'camila', 'esteban').afinidad < 55, pasa: (s, api) => {
    api.log(s, '🔊 Se oye a Camila y Esteban discutiendo por la pared.', 'malo');
    api.proponer(s, { clave: 'pared', titulo: 'Pelea en el 2A', texto: 'Camila y Esteban discuten fuerte. María los escucha desde el pasillo.', defecto: 'ignorar', horas: 4,
      opciones: [{ k: 'tocar', txt: 'Que María toque la puerta', pista: 'puede calmarlos… o meterse en problemas' }, { k: 'arturo', txt: 'Avisarle a Don Arturo', pista: 'él media' }, { k: 'ignorar', txt: 'No meterse', pista: 'la pelea sigue' }] }); } },
  { id: 'alza', prob: 0.04, cuando: (s, api) => api.dia(s) % 30 > 20, pasa: (s, api) => api.proponer(s, { clave: 'alza', titulo: 'El dueño quiere subir el arriendo', texto: 'El dueño del edificio avisa que el arriendo del 3B subirá 120 al mes.', defecto: 'aceptar', horas: 24,
    opciones: [{ k: 'negociar', txt: 'Negociar', pista: 'puede quedar en la mitad… o no' }, { k: 'aceptar', txt: 'Aceptar', pista: '+120 al mes' }, { k: 'buscar', txt: 'Amenazar con irse', pista: 'arriesgado' }] }) },
];
const DILEMAS = {
  fiesta: (s, k, api) => {
    const A = api.agente(s, 'andres'), M = api.agente(s, 'maria'), J = api.agente(s, 'julian');
    if (k === 'ir') { s.banderas.vamosFiesta = true; for (const x of [A, M]) { api.recuerdo(s, x, 'Fiesta con los vecinos', 12, 24); x.n.diversion = Math.min(100, x.n.diversion + 30); x.n.social = Math.min(100, x.n.social + 35); x.n.energia = Math.max(0, x.n.energia - 15); api.relacion(s, x.id, J.id).afinidad += 10; } api.log(s, '🎉 Andrés y María subieron a la fiesta de Julián: conocieron a medio edificio.', 'bueno'); }
    if (k === 'quejarse') { s.banderas.fiesta = null; for (const x of [A, M]) api.relacion(s, x.id, J.id).afinidad -= 12; api.log(s, '👮 Don Arturo subió al 4A y se acabó la fiesta. Julián quedó resentido.', 'aviso'); }
  },
  pared: (s, k, api) => {
    const C = api.relacion(s, 'camila', 'esteban'), M = api.agente(s, 'maria');
    if (k === 'tocar') { if (api.rng(s) < 0.6) { C.afinidad += 10; api.relacion(s, 'maria', 'camila').afinidad += 8; api.log(s, '🚪 María tocó la puerta del 2A: se calmaron y Camila se lo agradeció.', 'bueno'); } else { api.relacion(s, 'maria', 'esteban').afinidad -= 10; api.log(s, '🚪 María tocó la puerta del 2A y Esteban le contestó feo.', 'malo'); api.recuerdo(s, M, 'Esteban le contestó feo', -8, 24); } }
    if (k === 'arturo') { C.afinidad += 5; api.log(s, '🧑‍💼 Don Arturo habló con Camila y Esteban.', 'info'); }
    if (k === 'ignorar') C.afinidad -= 4;
  },
  alza: (s, k, api) => {
    const H3 = s.hogares['3B'];
    if (k === 'aceptar') H3.alquilerExtra = (H3.alquilerExtra || 0) + 120;
    if (k === 'negociar') { if (api.rng(s) < 0.6) { H3.alquilerExtra = (H3.alquilerExtra || 0) + 60; api.log(s, '🤝 Negociaron: el arriendo sube solo 60.', 'bueno'); } else { H3.alquilerExtra = (H3.alquilerExtra || 0) + 120; api.log(s, 'El dueño no quiso negociar: sube 120.', 'malo'); } }
    if (k === 'buscar') { if (api.rng(s) < 0.4) api.log(s, '😌 El dueño se echó para atrás: el arriendo queda igual.', 'bueno'); else { H3.alquilerExtra = (H3.alquilerExtra || 0) + 160; api.log(s, '😠 Al dueño no le gustó la amenaza: sube 160.', 'malo'); } }
  },
  crisisPareja: (s, k, api, d) => {
    const R = api.relacion(s, d.datos.a, d.datos.b), h = s.hogares[api.agente(s, d.datos.a).hogar];
    if (k === 'cena' && h.dinero >= 40) { h.dinero -= 40; R.afinidad += 18; R.romance += 10; api.log(s, '🕯️ Salieron a cenar y se reconciliaron.', 'bueno'); }
    else if (k === 'hablar') { if (api.rng(s) < 0.65) { R.afinidad += 12; api.log(s, 'Hablaron con calma y se entendieron.', 'bueno'); } else { R.afinidad -= 6; api.log(s, 'La conversación terminó en otra pelea.', 'malo'); } }
    else R.afinidad -= 5;
  },
};

// ---------------------------------------------------------------- la ficha
export default {
  id: 'ciudad', version: 1, nombre: 'Barrio Los Almendros', emoji: '🏙', descripcion: 'Andrés y María viven en el 3B de un edificio con vecinos: trabajo, arriendo, mercado, amigos y peleas.',
  textoInicio: 'Empieza un lunes en el barrio Los Almendros. Andrés y María viven en el 3B, con Berlín y Axel.',
  necesidades: NECESIDADES, rasgos: RASGOS, acciones: ACCIONES, personajes: PERSONAJES, hogares: HOGARES, lugares: LUGARES, acera: ACERA, eventos: EVENTOS, dilemas: DILEMAS,
  velocidad: { persona: 1.3, perro: 1.6, gato: 1.0 },
  relacionesIniciales: [
    ['andres', 'maria', { afinidad: 78, pareja: true, romance: 70 }], ['camila', 'esteban', { afinidad: 52, pareja: true, romance: 40 }],
    ['maria', 'valeria', 35], ['andres', 'julian', 15], ['maria', 'rosa', 25], ['andres', 'arturo', 20], ['tomas', 'andres', 18], ['rosa', 'arturo', 30], ['valeria', 'julian', 30],
  ],
  cadaHora: (s, api) => {
    // la fiesta: ruido de 23 a 3; quienes duermen cerca descansan menos
    const F = s.banderas.fiesta;
    if (F && s.t >= F.desde && s.t < F.hasta) s.banderas.ruido = s.t + 61;
    if (F && s.t >= F.hasta) s.banderas.fiesta = null;
    if (s.banderas.ruido > s.t) for (const a of s.agentes) if (a.vivo && a.especie === 'persona' && ['apto3A', 'apto3B', 'apto4B'].includes(a.lugar) && a.tarea?.accion === 'dormir' && !s.banderas.vamosFiesta) { a.n.energia = Math.max(0, a.n.energia - 6); api.recuerdo(s, a, 'No lo dejaron dormir', -6, 10); }
    if (s.banderas.sinLuz && s.t >= s.banderas.luzVuelve) { s.banderas.sinLuz = false; api.log(s, '💡 Volvió la luz.', 'info'); }
  },
  cadaDia: (s, api) => {
    s.banderas.vamosFiesta = false;
    // el arriendo, cada 30 días; la pensión de Doña Rosa, cada semana
    if (api.dia(s) % 30 === 0 && api.dia(s) > 0) for (const h of HOGARES) { const H2 = s.hogares[h.id], monto = h.alquiler + (H2.alquilerExtra || 0); H2.dinero -= monto; if (H2.dinero < 0) { api.log(s, `💸 ${h.nombre} no alcanzó a pagar el arriendo (quedan en ${Math.round(H2.dinero)}).`, 'malo'); for (const a of s.agentes) if (a.hogar === h.id) api.recuerdo(s, a, 'Deudas', -15, 72); } else api.log(s, `🏠 ${h.nombre} ${h.nombre.includes(' y ') ? 'pagaron' : 'pagó'} el arriendo (−${monto}).`, 'info'); }
    if (api.diaSemana(s) === 0) for (const h of HOGARES) if (h.pension) s.hogares[h.id].dinero += h.pension;
    // Don Arturo arregla el ascensor
    if (s.banderas.ascensor && s.t >= s.banderas.ascensor) { s.banderas.ascensor = 0; api.log(s, '🛗 Don Arturo hizo arreglar el ascensor.', 'bueno'); }
  },
};
