// =====================================================================
// Ciudad zombi — la simulación (lógica PURA: sin three ni DOM, para probarla en Node).
// La ciudad no existe guardada: cada trozo (celda de una manzana) se genera igual siempre a partir de la
// semilla y sus coordenadas. Lo único que se guarda es lo que TÚ cambiaste: qué saqueaste, dónde barricaste,
// qué zombis siguen en pie. El tiempo corre así: 1 s de simulación = 1 minuto de juego (un día = 1440 s).
// =====================================================================
import { azar, ruido2D } from '../motor/azar.js';

export const P = 30, CALLE = 8, ACERA = 1.6, B0 = CALLE / 2 + ACERA, B1 = P - B0; // manzana local [5,6 – 24,4]
export const MIN_DIA = 1440;
const hyp = (x, z) => Math.sqrt(x * x + z * z); // más rápido que Math.hypot (se llama miles de veces por paso)
const clamp = (v, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => hyp(a.x - b.x, a.z - b.z);
// hash entero estable (FNV con mezcla): misma entrada → mismo trozo de ciudad
export const hash = (...v) => { let h = 0x811c9dc5; for (const n of v) { h = Math.imul(h ^ (n | 0), 0x01000193); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); } return (h ^ (h >>> 13)) >>> 0; };
// azar de la partida: el estado vive en S.rs para que se guarde en JSON y la partida sea reproducible
function rnd(S) { const a = (S.rs = (S.rs + 0x6d2b79f5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (S, l) => l[Math.floor(rnd(S) * l.length)];

// ---------------------------------------------------------------- catálogos
export const RASGOS = {
  fuerte: { n: 'Fuerte', ic: '💪', d: '+40 % de daño cuerpo a cuerpo' },
  sigiloso: { n: 'Sigiloso', ic: '🥷', d: 'lo ven de más cerca y hace menos ruido' },
  rapido: { n: 'Rápido', ic: '⚡', d: 'camina y corre 20 % más rápido; correr le cansa menos' },
  medico: { n: 'Médico', ic: '⚕️', d: 'cura el doble y la infección le avanza más lento' },
  mecanico: { n: 'Mecánico', ic: '🔧', d: 'barrica sin tablas y sus armas duran más' },
  cobarde: { n: 'Cobarde', ic: '😰', d: 'huye antes y el miedo le baja el ánimo' },
  valiente: { n: 'Valiente', ic: '🦁', d: 'pelea más y aguanta mejor el ánimo' },
};
export const ITEMS = {
  comida: { n: 'Comida enlatada', ic: '🥫' }, agua: { n: 'Agua', ic: '💧' }, vendaje: { n: 'Vendaje', ic: '🩹' }, botiquin: { n: 'Botiquín', ic: '🧰' },
  analgesico: { n: 'Analgésicos', ic: '💊' }, antiviral: { n: 'Antiviral', ic: '💉' }, tablas: { n: 'Tablas', ic: '🪵' }, herramientas: { n: 'Herramientas', ic: '🛠️' },
  radio: { n: 'Radio', ic: '📻' }, balas: { n: 'Balas', ic: '🔹', mun: true }, cartuchos: { n: 'Cartuchos', ic: '🔸', mun: true },
};
export const ARMAS = {
  punos: { n: 'Puños', ic: '✊', dmg: 7, alc: 1.45, cd: 0.9, dur: 0, ruido: 3 },
  bate: { n: 'Bate', ic: '🏏', dmg: 21, alc: 1.75, cd: 0.95, dur: 60, ruido: 4 },
  tubo: { n: 'Tubo', ic: '🔩', dmg: 17, alc: 1.75, cd: 0.9, dur: 80, ruido: 5 },
  machete: { n: 'Machete', ic: '🔪', dmg: 30, alc: 1.65, cd: 0.8, dur: 75, ruido: 3 },
  hacha: { n: 'Hacha', ic: '🪓', dmg: 44, alc: 1.75, cd: 1.15, dur: 65, ruido: 4 },
  pistola: { n: 'Pistola', ic: '🔫', dmg: 50, alc: 14, cd: 0.7, dur: 300, ruido: 42, mun: 'balas' },
  escopeta: { n: 'Escopeta', ic: '💥', dmg: 85, alc: 9, cd: 1.3, dur: 200, ruido: 60, mun: 'cartuchos', cono: 0.5 },
};
export const TIPOS = {
  casa: { n: 'Casa', ic: '🏠', botin: [2, 3], dentro: 0.12, dur: 12 },
  edificio: { n: 'Edificio', ic: '🏢', botin: [3, 5], dentro: 0.3, dur: 20 },
  tienda: { n: 'Tienda', ic: '🏪', botin: [2, 4], dentro: 0.15, dur: 12 },
  farmacia: { n: 'Farmacia', ic: '💊', botin: [2, 4], dentro: 0.2, dur: 14 },
  supermercado: { n: 'Supermercado', ic: '🛒', botin: [4, 6], dentro: 0.35, dur: 24 },
  comisaria: { n: 'Comisaría', ic: '🚓', botin: [2, 4], dentro: 0.35, dur: 18 },
  hospital: { n: 'Hospital', ic: '🏥', botin: [3, 5], dentro: 0.6, dur: 26 },
  gasolinera: { n: 'Gasolinera', ic: '⛽', botin: [2, 3], dentro: 0.15, dur: 10 },
  ferreteria: { n: 'Ferretería', ic: '🔨', botin: [2, 4], dentro: 0.15, dur: 14 },
};
// qué hay en cada tipo de edificio (peso relativo)
const BOTIN = {
  casa: { comida: 3, agua: 3, vendaje: 2, analgesico: 1, tablas: 2, herramientas: 1, bate: 0.7, machete: 0.3, radio: 0.35, mochila: 0.35, balas: 0.25 },
  edificio: { comida: 3, agua: 3, vendaje: 1.5, analgesico: 1, tablas: 1.5, bate: 0.5, radio: 0.4, mochila: 0.4, pistola: 0.15, balas: 0.4 },
  tienda: { comida: 4, agua: 4, analgesico: 0.6, mochila: 0.6, tablas: 0.5 },
  farmacia: { vendaje: 3, botiquin: 1.5, analgesico: 2, antiviral: 1.3, agua: 1 },
  supermercado: { comida: 5, agua: 5, vendaje: 0.6, mochila: 0.5, tablas: 0.5 },
  comisaria: { pistola: 1.4, balas: 2.5, escopeta: 0.6, cartuchos: 1.4, radio: 1.2, vendaje: 1, botiquin: 0.4 },
  hospital: { botiquin: 2, vendaje: 2, antiviral: 1.6, analgesico: 1.5, agua: 1 },
  gasolinera: { agua: 3, comida: 3, herramientas: 1.5, tubo: 1, mochila: 0.3 },
  ferreteria: { hacha: 1, machete: 1.2, tubo: 1, herramientas: 2.5, tablas: 3 },
};
const NOMBRES = ['Andrés', 'María', 'Camila', 'Julián', 'Valentina', 'Santiago', 'Laura', 'Mateo', 'Daniela', 'Sebastián', 'Paula', 'Felipe', 'Natalia', 'Juan David', 'Sara', 'Esteban', 'Carolina', 'Diego', 'Manuela', 'Óscar', 'Luisa', 'Camilo', 'Mariana', 'Jorge'];
const ZT = { // [vel deambula, vel persigue, vida, daño, recarga, mordida]
  lento: [0.45, 1.05, 45, 6, 1.6, 0.08], corredor: [0.6, 3.0, 30, 4, 1.2, 0.11], gordo: [0.35, 0.75, 120, 12, 2.0, 0.05],
};

// ---------------------------------------------------------------- la ciudad por trozos
const ruidos = new Map();
const ruidoDe = (sem) => { let f = ruidos.get(sem); if (!f) { f = ruido2D(sem); ruidos.set(sem, f); } return f; };
// la zona de evacuación: siempre la misma para una semilla, lejos (2,3–3,2 km) en una dirección al azar
export function objetivoDe(sem) {
  const r = azar(hash(sem, 777)), a = r() * Math.PI * 2, d = 2300 + r() * 900;
  const i = Math.floor((Math.cos(a) * d) / P), j = Math.floor((Math.sin(a) * d) / P);
  return { i, j, x: (i + 0.5) * P, z: (j + 0.5) * P };
}
const cache = new Map(); let semCache = null;
// devuelve la celda (i, j): manzana, edificios, objetos de la calle y quién vivía ahí. Memorizada (LRU) porque se consulta mucho
export function celda(sem, i, j) {
  if (semCache !== sem) { cache.clear(); semCache = sem; }
  const k = (i + 32768) * 65536 + (j + 32768);
  let c = cache.get(k);
  if (!c) { c = generarCelda(sem, i, j); cache.set(k, c); if (cache.size > 700) cache.delete(cache.keys().next().value); }
  return c;
}
export function generarCelda(sem, i, j) {
  const r = azar(hash(sem, i, j)), ra = azar(hash(sem, i, j, 31)), ox = i * P, oz = j * P, ev = objetivoDe(sem);
  const n = ruidoDe(sem)(i * 0.16 + 0.5, j * 0.16 + 0.5);
  const distrito = n > 0.64 ? 'centro' : n > 0.47 ? 'comercial' : n > 0.25 ? 'residencial' : 'afueras';
  const C = { i, j, ox, oz, distrito, tipo: 'lotes', edif: [], props: [], sol: [], zs: [], npc: null, evac: false, fauna: [] };
  const bx0 = ox + B0, bx1 = ox + B1, bz0 = oz + B0, bz1 = oz + B1, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const cerca = (x, z, m) => hyp(x - P / 2, z) < m; // el punto de partida (P/2, 0) queda despejado
  const solido = (x0, z0, x1, z1) => C.sol.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  // edificio sobre un lote; `lados` son los lados que dan a la calle (0:-z, 1:+z, 2:-x, 3:+x) y la puerta va en uno
  const edif = (tipo, x0, z0, x1, z1, lados, ins, h) => {
    const e = { k: `${i},${j},${C.edif.length}`, tipo, x0: x0 + ins, z0: z0 + ins, x1: x1 - ins, z1: z1 - ins, h, v: r(), lado: lados[Math.floor(r() * lados.length)] };
    const mx = (e.x0 + e.x1) / 2, mz = (e.z0 + e.z1) / 2;
    [e.px, e.pz] = [[mx, e.z0 - 0.9], [mx, e.z1 + 0.9], [e.x0 - 0.9, mz], [e.x1 + 0.9, mz]][e.lado];
    C.edif.push(e); solido(e.x0, e.z0, e.x1, e.z1); return e;
  };
  // ningún obstáculo frente a una puerta: si tapa una, simplemente no se pone
  const tapa = (x0, z0, x1, z1) => C.edif.some((e) => e.px > Math.min(x0, x1) - 1.1 && e.px < Math.max(x0, x1) + 1.1 && e.pz > Math.min(z0, z1) - 1.1 && e.pz < Math.max(z0, z1) + 1.1);
  const pon = (p, x0, z0, x1, z1) => { if (tapa(x0, z0, x1, z1)) return false; C.props.push(p); solido(x0, z0, x1, z1); return true; };
  const arbol = (x, z) => { const s = 0.8 + r() * 0.6; pon({ t: 'arbol', x, z, s }, x - 0.45, z - 0.45, x + 0.45, z + 0.45); };
  const banca = (x, z, rot) => C.props.push({ t: 'banca', x, z, rot });
  const q = r(), mx = cx + (r() - 0.5) * 3, mz = cz + (r() - 0.5) * 3;
  const cuatro = (tipos, ins, alt) => { // manzana partida en 4 lotes (casas, tiendas)
    const L = [[bx0, bz0, mx, mz, [0, 2]], [mx, bz0, bx1, mz, [0, 3]], [bx0, mz, mx, bz1, [1, 2]], [mx, mz, bx1, bz1, [1, 3]]];
    for (const [x0, z0, x1, z1, lados] of L) {
      const t = tipos[Math.floor(r() * tipos.length)];
      if (t === 'vacio') { if (r() < 0.6) arbol((x0 + x1) / 2, (z0 + z1) / 2); continue; }
      const i2 = t === 'casa' ? ins + r() * 0.8 : 0.5;
      edif(t, x0, z0, x1, z1, lados, i2, t === 'casa' ? 3.2 + r() * 1.2 : alt[0] + r() * (alt[1] - alt[0]));
    }
  };
  const dos = (tipos, alt) => { // manzana partida en 2 (edificios altos, ferretería + tienda)
    edif(tipos[0], bx0, bz0, mx, bz1, [0, 1, 2], 0.6, alt[0] + r() * (alt[1] - alt[0]));
    edif(tipos[1], mx, bz0, bx1, bz1, [0, 1, 3], 0.6, alt[0] + r() * (alt[1] - alt[0]));
  };
  const parque = (plaza) => {
    C.tipo = plaza ? 'plaza' : 'parque';
    if (plaza) { C.props.push({ t: 'fuente', x: cx, z: cz }); solido(cx - 1.8, cz - 1.8, cx + 1.8, cz + 1.8); }
    const nA = plaza ? 4 : 6 + Math.floor(r() * 5);
    for (let a = 0; a < nA; a++) {
      const x = bx0 + 1.5 + r() * (bx1 - bx0 - 3), z = bz0 + 1.5 + r() * (bz1 - bz0 - 3);
      if (Math.abs(x - cx) < 2.2 || Math.abs(z - cz) < 2.2) continue; // los senderos en cruz quedan libres
      arbol(x, z);
    }
    banca(cx + 4, cz - 1.6, 0); banca(cx - 4, cz + 1.6, Math.PI);
  };
  if (i === ev.i && j === ev.j) { // zona de evacuación: helipuerto, carpas y sacos de arena con entradas en cada lado
    C.evac = true; C.tipo = 'evac';
    const pared = (x0, z0, x1, z1) => { C.props.push({ t: 'sacos', x0, z0, x1, z1 }); solido(x0, z0, x1, z1); };
    for (const s of [-1, 1]) {
      pared(bx0, s < 0 ? bz0 : bz1 - 0.8, cx - 2.5, s < 0 ? bz0 + 0.8 : bz1); pared(cx + 2.5, s < 0 ? bz0 : bz1 - 0.8, bx1, s < 0 ? bz0 + 0.8 : bz1);
      pared(s < 0 ? bx0 : bx1 - 0.8, bz0 + 0.8, s < 0 ? bx0 + 0.8 : bx1, cz - 2.5); pared(s < 0 ? bx0 : bx1 - 0.8, cz + 2.5, s < 0 ? bx0 + 0.8 : bx1, bz1 - 0.8);
    }
    for (const [x, z] of [[bx0 + 3.2, bz0 + 3.2], [bx1 - 3.2, bz1 - 3.2]]) { C.props.push({ t: 'carpa', x, z }); solido(x - 1.8, z - 1.4, x + 1.8, z + 1.4); }
    C.props.push({ t: 'helipuerto', x: cx, z: cz });
  } else if (distrito === 'afueras') { if (q < 0.45) parque(false); else cuatro(['casa', 'casa', 'casa', 'vacio'], 1.6, [3, 4]); }
  else if (distrito === 'residencial') {
    if (q < 0.1) parque(false); else if (q < 0.22) dos([r() < 0.5 ? 'farmacia' : 'tienda', 'casa'], [3.5, 5]);
    else cuatro(['casa', 'casa', 'casa', 'casa', 'tienda', 'vacio'], 1.4, [3.5, 5]);
  } else if (distrito === 'comercial') {
    if (q < 0.15) { // supermercado con parqueadero al frente
      edif('supermercado', bx0, bz0 + 5, bx1, bz1, [0], 0.8, 5 + r());
      for (let a = 0; a < 2; a++) if (r() < 0.7) { const x = bx0 + 3 + a * 7 + r() * 3, z = bz0 + 2.4; pon({ t: 'auto', x, z, rot: Math.PI / 2, c: Math.floor(r() * 6) }, x - 1, z - 2.1, x + 1, z + 2.1); }
    } else if (q < 0.26) { // gasolinera: tienda atrás, marquesina y surtidores adelante
      const e = edif('gasolinera', bx0 + 1.5, bz1 - 6.5, bx0 + 9.5, bz1 - 0.8, [0], 0, 3.6); e.lado = 0; e.pz = e.z0 - 0.9; e.px = (e.x0 + e.x1) / 2;
      C.props.push({ t: 'marquesina', x: cx + 1.5, z: cz - 2, w: 11, d: 7 });
      for (const dx of [-2.5, 2.5]) { const x = cx + 1.5 + dx, z = cz - 2; pon({ t: 'surtidor', x, z }, x - 0.35, z - 0.6, x + 0.35, z + 0.6); }
    } else if (q < 0.36) dos(['ferreteria', r() < 0.5 ? 'tienda' : 'farmacia'], [4, 6.5]);
    else cuatro(['tienda', 'tienda', 'farmacia', 'casa', 'ferreteria', 'tienda'], 1.2, [3.6, 7]);
  } else { // centro
    if (q < 0.11) edif('hospital', bx0, bz0, bx1, bz1, [0, 1, 2, 3], 1.2, 15 + r() * 6);
    else if (q < 0.22) edif('comisaria', bx0, bz0, bx1, bz1, [0, 1, 2, 3], 2.2, 7 + r() * 2);
    else if (q < 0.3) parque(true);
    else if (q < 0.7) dos(['edificio', r() < 0.3 ? 'tienda' : 'edificio'], [10, 22]);
    else cuatro(['edificio', 'tienda', 'farmacia', 'edificio'], 0.8, [6, 14]);
  }
  // ---- la calle: cada celda es dueña del tramo horizontal (z = oz) y vertical (x = ox) de su esquina baja
  const lejosEvac = Math.abs(i - ev.i) > 1 || Math.abs(j - ev.j) > 1, denso = distrito === 'centro' || distrito === 'comercial';
  for (const eje of [0, 1]) { // 0: tramo horizontal, 1: vertical
    const P2 = (t, u) => (eje === 0 ? [ox + t, oz + u] : [ox + u, oz + t]); // t: a lo largo, u: a lo ancho
    const nA = r() < (denso ? 0.75 : 0.5) ? 1 + Math.floor(r() * 2.4) : 0;
    for (let a = 0; a < nA; a++) {
      const t = 6 + (a / Math.max(1, nA)) * 16 + r() * 4, choque = r() < 0.25, u = choque ? (r() - 0.5) * 2 : (r() < 0.5 ? -2 : 2);
      const [x, z] = P2(t, u); if (cerca(x, z, 9)) continue;
      const rot = (eje === 0 ? Math.PI / 2 : 0) + (choque ? (r() - 0.5) * 1.4 : (r() - 0.5) * 0.12), fuego = r() < 0.12;
      const quemado = fuego || r() < 0.15, ex = choque ? 1.9 : eje === 0 ? 2.15 : 1.0, ez = choque ? 1.9 : eje === 0 ? 1.0 : 2.15;
      pon({ t: 'auto', x, z, rot, c: Math.floor(r() * 6), quemado, fuego, alarma: !quemado && ra() < 0.3 }, x - ex, z - ez, x + ex, z + ez);
    }
    if (r() < 0.07 && lejosEvac) { // barricada atravesada con un paso de 2,6 m a un lado
      const t = 8 + r() * 12, lado = r() < 0.5 ? -1 : 1, u0 = lado < 0 ? -4 : -1.4, u1 = lado < 0 ? 1.4 : 4;
      const [x0, z0] = P2(t - 0.5, u0), [x1, z1] = P2(t + 0.5, u1);
      if (!cerca((x0 + x1) / 2, (z0 + z1) / 2, 10)) { pon({ t: 'barricada', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), eje }, x0, z0, x1, z1); }
    }
    if (r() < 0.12) { const [x, z] = P2(4 + r() * 20, 4.8); if (!cerca(x, z, 6)) { pon({ t: 'barril', x, z }, x - 0.35, z - 0.35, x + 0.35, z + 0.35); } }
    const nB = Math.floor(r() * 3.2); for (let a = 0; a < nB; a++) { const [x, z] = P2(4 + r() * 20, 4.6 + r() * 0.6); C.props.push({ t: 'basura', x, z, s: 0.25 + r() * 0.2 }); }
    if (r() < 0.35) { const [x, z] = P2(5 + r() * 18, (r() - 0.5) * 6); C.props.push({ t: 'sangre', x, z, s: 0.6 + r() * 1.2 }); }
    if (r() < 0.5) { const [x, z] = P2(5, 4.9); C.props.push({ t: 'poste', x, z }); }
  }
  if (r() < 0.07 && lejosEvac && !cerca(ox, oz, 10)) { const rot = r() * 3; pon({ t: 'auto', x: ox, z: oz, rot, c: Math.floor(r() * 6), quemado: true, fuego: r() < 0.5 }, ox - 1.9, oz - 1.9, ox + 1.9, oz + 1.9); }
  // ---- quién rondaba aquí al empezar (zombis y, a veces, un sobreviviente)
  const base = { centro: 2.2, comercial: 1.7, residencial: 1.1, afueras: 0.7 }[distrito] + C.edif.reduce((s, e) => s + ({ hospital: 3, supermercado: 1.5, comisaria: 1.5 }[e.tipo] || 0), 0) + (C.evac ? 2 : 0);
  const nZ = Math.round(base * (0.3 + r() * 0.75) * (1 + Math.min(1, hyp(ox, oz) / 2500) * 0.6));
  const libreAqui = (x, z) => !C.sol.some((s) => x > s[0] - 0.5 && x < s[2] + 0.5 && z > s[1] - 0.5 && z < s[3] + 0.5);
  const lugar = () => { for (let a = 0; a < 8; a++) { const x = ox - 3.5 + r() * (P - 2.5), z = oz - 3.5 + r() * (P - 2.5); if (libreAqui(x, z)) return [x, z]; } return null; };
  for (let a = 0; a < nZ; a++) { const p = lugar(), q2 = r(); if (p) C.zs.push({ x: p[0], z: p[1], tipo: q2 < 0.14 ? 'corredor' : q2 < 0.26 ? 'gordo' : 'lento' }); }
  if (r() < 0.1 && Math.abs(i) + Math.abs(j) > 2) {
    const p = lugar(), q3 = r();
    if (p) C.npc = { x: p[0], z: p[1], nombre: NOMBRES[Math.floor(r() * NOMBRES.length)], rasgo: Object.keys(RASGOS)[Math.floor(r() * 7)], actitud: q3 < 0.5 ? 'amable' : q3 < 0.75 ? 'desconfiado' : 'hostil', ropa: Math.floor(r() * 8) };
  }
  // fauna: perros callejeros y bandadas de cuervos (azar aparte: no cambia el trazado de la ciudad)
  if (ra() < 0.1 && Math.abs(i) + Math.abs(j) > 1) C.fauna.push({ t: 'perro', x: ox + 2 + ra() * 4, z: oz + 8 + ra() * 14 });
  if (ra() < 0.22) { const s = C.props.find((p) => p.t === 'sangre' || p.t === 'basura'); if (s) C.fauna.push({ t: 'cuervos', x: s.x, z: s.z, n: 3 + Math.floor(ra() * 4) }); }
  return C;
}

// ---------------------------------------------------------------- colisiones, línea de vista y rutas
// ¿choca un círculo de radio `rad` en (x, z)? Solo mira la celda y, si está cerca del borde alto, sus vecinas:
// los objetos de una celda solo se salen 4 m hacia sus vecinas de abajo (su tramo de calle)
export function bloqueado(sem, x, z, rad = 0.35) {
  const ci = Math.floor(x / P), cj = Math.floor(z / P), lx = x - ci * P, lz = z - cj * P, bx = lx > P - 5, bz = lz > P - 5;
  const prueba = (c) => { for (const s of c.sol) if (x > s[0] - rad && x < s[2] + rad && z > s[1] - rad && z < s[3] + rad) return true; return false; };
  return prueba(celda(sem, ci, cj)) || (bx && prueba(celda(sem, ci + 1, cj))) || (bz && prueba(celda(sem, ci, cj + 1))) || (bx && bz && prueba(celda(sem, ci + 1, cj + 1)));
}
export function lineaLibre(sem, x0, z0, x1, z1, rad = 0) {
  const d = hyp(x1 - x0, z1 - z0), n = Math.ceil(d / 0.6);
  for (let k = 1; k < n; k++) { const t = k / n; if (bloqueado(sem, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, rad)) return false; }
  return true;
}
// A* sobre una rejilla de 1,5 m (perezosa: solo pregunta las casillas que visita) + alisado por línea libre
export function buscarRuta(sem, x0, z0, x1, z1, rad = 0.4) {
  const G = 1.5, M = 12, minx = Math.min(x0, x1) - M, minz = Math.min(z0, z1) - M;
  const W = Math.ceil((Math.max(x0, x1) + M - minx) / G) + 1, H = Math.ceil((Math.max(z0, z1) + M - minz) / G) + 1, N = W * H;
  if (N > 20000) return null;
  const bloq = new Int8Array(N).fill(-1);
  const libre = (n) => { if (bloq[n] < 0) bloq[n] = bloqueado(sem, minx + (n % W) * G, minz + Math.floor(n / W) * G, rad) ? 1 : 0; return bloq[n] === 0; };
  const id = (x, z) => clamp(Math.round((x - minx) / G), 0, W - 1) + clamp(Math.round((z - minz) / G), 0, H - 1) * W;
  const cercano = (n) => { if (libre(n)) return n; const cx = n % W, cz = Math.floor(n / W); for (let r = 1; r < 5; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < W && z < H && libre(x + z * W)) return x + z * W; } return -1; };
  const s = cercano(id(x0, z0)), g = cercano(id(x1, z1)); if (s < 0 || g < 0) return null;
  const gx = g % W, gz = Math.floor(g / W), hh = (n) => { const dx = Math.abs(n % W - gx), dz = Math.abs(Math.floor(n / W) - gz); return dx + dz - 0.586 * Math.min(dx, dz); };
  const gS = new Float32Array(N).fill(1e9), de = new Int32Array(N).fill(-1), cerr = new Uint8Array(N);
  const heap = [], f = new Float32Array(N); // montículo binario de nodos ordenado por f
  const push = (n) => { heap.push(n); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  gS[s] = 0; f[s] = hh(s); push(s); let exp = 0, ok = false;
  while (heap.length && exp++ < 9000) {
    const n = pop(); if (n === g) { ok = true; break; } if (cerr[n]) continue; cerr[n] = 1;
    const nx = n % W, nz = Math.floor(n / W);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const x = nx + dx, z = nz + dz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
      const m = x + z * W; if (cerr[m] || !libre(m)) continue;
      if (dx && dz && (!libre(nx + dx + nz * W) || !libre(nx + (nz + dz) * W))) continue; // sin cortar esquinas
      const c = gS[n] + (dx && dz ? 1.414 : 1); if (c < gS[m]) { gS[m] = c; de[m] = n; f[m] = c + hh(m); push(m); }
    }
  }
  if (!ok) return null;
  const pts = []; for (let n = g; n >= 0; n = de[n]) pts.push([minx + (n % W) * G, minz + Math.floor(n / W) * G]);
  pts.reverse(); if (!bloqueado(sem, x1, z1, rad)) pts[pts.length - 1] = [x1, z1];
  const out = [[x0, z0]]; let a = 0; // alisado: salta puntos mientras se pueda ir en línea recta
  for (let k = 2; k < pts.length; k++) if (!lineaLibre(sem, out[out.length - 1][0], out[out.length - 1][1], pts[k][0], pts[k][1], rad * 0.9)) { out.push(pts[k - 1]); a = k - 1; }
  out.push(pts[pts.length - 1]); out.shift(); void a;
  return out;
}
// edificios en un radio (para saquear, dormir, mostrar marcas)
export function edificiosCerca(sem, x, z, rad) {
  const out = [], i0 = Math.floor((x - rad) / P), i1 = Math.floor((x + rad) / P), j0 = Math.floor((z - rad) / P), j1 = Math.floor((z + rad) / P);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const e of celda(sem, i, j).edif) { const d = hyp(e.px - x, e.pz - z); if (d <= rad) out.push({ e, d }); }
  return out.sort((a, b) => a.d - b.d);
}
export function edificioEn(sem, x, z, m = 0) { for (const e of celda(sem, Math.floor(x / P), Math.floor(z / P)).edif) if (x > e.x0 - m && x < e.x1 + m && z > e.z0 - m && z < e.z1 + m) return e; return null; }
export function buscarEdificio(sem, k) { const [i, j, n] = k.split(',').map(Number); return celda(sem, i, j).edif[n] || null; }

// ---------------------------------------------------------------- partida
export function crearPersonaje(sem) {
  const r = azar(hash(sem, 1234)), L = Object.keys(RASGOS), a = L[Math.floor(r() * L.length)];
  let b = a; while (b === a || (a === 'cobarde' && b === 'valiente') || (a === 'valiente' && b === 'cobarde')) b = L[Math.floor(r() * L.length)];
  return { nombre: NOMBRES[Math.floor(r() * NOMBRES.length)], rasgos: [a, b], ropa: Math.floor(r() * 6), arma: r() < 0.5 ? 'bate' : 'tubo' };
}
// dificultad: z = cuántos zombis, d = cuánto muerden, inf = horas de infección, botin = objetos extra
export const DIFICULTAD = { facil: { n: 'Fácil', z: 0.72, d: 0.7, inf: 1.4, botin: 1, mord: 0.6 }, normal: { n: 'Normal', z: 1, d: 1, inf: 1, botin: 0, mord: 1 }, dificil: { n: 'Difícil', z: 1.2, d: 1.2, inf: 0.85, botin: 0, mord: 1.15 } };
const DIF = (S) => DIFICULTAD[S.dif] || DIFICULTAD.normal;
// el primer día es más amable y la ciudad se va poniendo peor: menos zombis y casi sin corredores al principio
export const rigor = (S) => DIF(S).z * Math.min(1.45, 0.55 + 0.2 * (diaDe(S) - 1));
const pCorredor = (S) => Math.min(1, 0.25 + 0.25 * (diaDe(S) - 1)) * (S.dif === 'dificil' ? 1.3 : 1);
export const horaDe = (S) => (8 + S.t / 60) % 24;
export const diaDe = (S) => Math.floor((8 * 60 + S.t) / MIN_DIA) + 1;
export const esNoche = (h) => h >= 20.5 || h < 5.5;
const sello = (S) => { const h = horaDe(S); return `D${diaDe(S)} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
function log(S, texto, tipo = '', aviso = false) { S.diario.unshift({ texto, tipo, d: sello(S) }); if (S.diario.length > 90) S.diario.length = 90; if (aviso) S.avisos.push(texto); }
const tiene = (S, r) => S.pj.rasgos.includes(r);

export function nuevaPartida(semilla, pers = null, dif = 'normal') {
  const sem = semilla >>> 0, p = pers || crearPersonaje(sem), obj = objetivoDe(sem);
  const S = {
    v: 1, sem, rs: hash(sem, 99) | 0, t: 0, auto: true, sigId: 1, dif: DIFICULTAD[dif] ? dif : 'normal',
    pj: { nombre: p.nombre, rasgos: p.rasgos, ropa: p.ropa, x: P / 2, z: 0, dir: 0, salud: 100, hambre: 80, sed: 80, energia: 90, animo: 65, inf: 0,
      inv: { comida: 1, agua: 1, vendaje: 1 }, armas: [{ id: p.arma, dur: ARMAS[p.arma].dur }], eq: 0, cap: 12,
      plan: null, accion: null, cola: [], dentro: null, mando: null, cd: 0, golpeT: 0, causa: '', corriendo: false, vel: 0, quieto: 0, uPos: [P / 2, 0] },
    zs: [], npcs: [], grupo: [], saq: {}, ref: {}, vistas: {}, npcVis: {}, diario: [], avisos: [], ruidos: [],
    obj: { x: obj.x, z: obj.z }, est: null, revelada: false, evac: null, fin: null, pregunta: null,
    stats: { abatidos: 0, dist: 0, saqueos: 0, mordidas: 0 }, tIA: 0, tCel: 0, tHorda: 60, tRadio: -999, tFrase: 40,
    anim: [], faunaVis: {}, alarmas: {}, clima: { lluvia: 0, meta: 0, t: 300, agua: false }, tAmb: 0,
  };
  const a = rnd(S) * Math.PI * 2, e = 380 + rnd(S) * 160; // la radio oficial da una ubicación aproximada
  S.est = { x: S.obj.x + Math.cos(a) * e, z: S.obj.z + Math.sin(a) * e, err: e };
  log(S, `${p.nombre} sale del apartamento. La radio habla de una evacuación a ~${(hyp(S.est.x, S.est.z) / 1000).toFixed(1)} km.`, 'logro');
  activarCeldas(S, true);
  return S;
}
// carga un estado guardado (o null si no sirve)
export function cargar(obj) {
  if (!obj || obj.v !== 1 || !obj.pj || !Number.isFinite(obj.t)) return null; obj.avisos = []; obj.ruidos = [];
  // partidas guardadas antes de la vida ambiental
  obj.dif ??= 'normal'; obj.anim ??= []; obj.faunaVis ??= {}; obj.alarmas ??= {}; obj.clima ??= { lluvia: 0, meta: 0, t: 300, agua: false }; obj.tAmb ??= 0;
  return obj;
}

// ---------------------------------------------------------------- órdenes desde la interfaz (o la IA)
export function setAuto(S, v) { S.auto = !!v; if (!v) { S.pj.plan = null; } log(S, v ? 'Modo automático: decide solo.' : 'Modo manual: tú mandas.'); }
export function irA(S, x, z, opc = {}) {
  const pj = S.pj; if (pj.accion?.tipo === 'duerme') despertar(S, 'Te levantas.');
  pj.accion = null; pj.cola = []; pj.dentro = null;
  const ruta = buscarRuta(S.sem, pj.x, pj.z, x, z) || [[x, z]];
  pj.plan = { ruta, idx: 0, correr: !!opc.correr, al: opc.al || null, motivo: opc.motivo || 'ir', t0: S.t };
  return ruta;
}
export function mandar(S, dx, dz, correr) { const pj = S.pj; const m = hyp(dx, dz); if (m < 0.05) { pj.mando = null; return; } if (pj.accion && pj.accion.tipo !== 'duerme') { pj.accion = null; pj.cola = []; pj.dentro = null; } if (pj.accion?.tipo === 'duerme') despertar(S, 'Te levantas.'); pj.mando = { dx: dx / Math.max(1, m), dz: dz / Math.max(1, m), correr: !!correr }; pj.plan = null; }
export function ordenSaquear(S, k) { const e = buscarEdificio(S.sem, k); if (!e) return; irA(S, e.px, e.pz, { al: { tipo: 'saquear', k }, correr: S.pj.plan?.correr }); }
export function ordenAtacar(S, id) { const z = S.zs.find((z) => z.id === id && z.est !== 'muerto'); if (!z) return; irA(S, z.x, z.z, { al: { tipo: 'atacar', id } }); }
export function ordenRefugio(S, k, barricar = true) { const e = buscarEdificio(S.sem, k); if (!e) return; irA(S, e.px, e.pz, { al: { tipo: 'refugio', k, barricar } }); }
export function parar(S) { const pj = S.pj; if (pj.accion?.tipo === 'duerme') despertar(S, 'Te levantas.'); pj.accion = null; pj.cola = []; pj.plan = null; pj.dentro = null; }
export function edificioPuerta(S, m = 3.5) { const l = edificiosCerca(S.sem, S.pj.x, S.pj.z, m); return l.length ? l[0].e : null; }
export const puedeBarricar = (S) => (S.pj.inv.tablas || 0) > 0 || tiene(S, 'mecanico');
export function cargaDe(S) { const pj = S.pj; let n = pj.armas.length; for (const [k, v] of Object.entries(pj.inv)) if (!ITEMS[k]?.mun) n += v; return n; }

function empezar(S, tipo, k) {
  const pj = S.pj, e = buscarEdificio(S.sem, k); if (!e) return;
  pj.plan = null; pj.x = e.px; pj.z = e.pz;
  if (tipo === 'saquear') {
    if (S.saq[k]) { log(S, `${TIPOS[e.tipo].n}: ya lo revisaste, no queda nada.`); pj.accion = null; return siguiente(S); }
    const dur = TIPOS[e.tipo].dur * (tiene(S, 'rapido') ? 0.85 : 1) * (pj.animo < 20 ? 1.3 : 1);
    pj.accion = { tipo, k, prog: 0, dur }; pj.dentro = k;
    ruido(S, e.px, e.pz, tiene(S, 'sigiloso') ? 4 : 8);
    if (rnd(S) < TIPOS[e.tipo].dentro) { // sorpresa: había zombis adentro
      const n = e.tipo === 'hospital' ? 2 + Math.floor(rnd(S) * 2) : 1 + (rnd(S) < 0.3 ? 1 : 0);
      for (let a = 0; a < n; a++) { const z = nuevoZombi(S, e.px + (rnd(S) - 0.5) * 1.5, e.pz + (rnd(S) - 0.5) * 1.5, rnd(S) < 0.2 ? 'gordo' : 'lento'); z.est = 'persigue'; z.obj = 'pj'; z.cd = 1.2; }
      pj.accion = null; pj.dentro = null; pj.cola = [];
      log(S, `¡Había ${n === 1 ? 'un zombi' : n + ' zombis'} adentro de la ${TIPOS[e.tipo].n.toLowerCase()}!`, 'malo', true);
    }
  } else if (tipo === 'barricar') {
    if (S.ref[k]) return siguiente(S);
    if (!puedeBarricar(S)) { log(S, 'No tienes tablas para barricar.', '', true); return siguiente(S); }
    pj.accion = { tipo, k, prog: 0, dur: tiene(S, 'mecanico') ? 14 : 22 }; pj.dentro = null; ruido(S, e.px, e.pz, 10);
  } else if (tipo === 'esconde') { pj.accion = { tipo, k, prog: 0, dur: 1 }; pj.dentro = k; log(S, `${pj.nombre} se esconde en ${TIPOS[e.tipo].n.toLowerCase()}.`);
  } else if (tipo === 'duerme') { pj.accion = { tipo, k, prog: 0, dur: 1 }; pj.dentro = k; pj.mando = null; log(S, `${pj.nombre} se acuesta${S.ref[k] ? ' en su refugio barricado' : ' (sin barricada: riesgoso)'}.`); }
}
function siguiente(S) { const pj = S.pj; pj.accion = null; pj.dentro = null; const s = pj.cola.shift(); if (s) empezar(S, s[0], s[1]); }
export function accionAqui(S, tipo) { // botones contextuales: buscar / barricar / dormir junto a la puerta más cercana
  const e = edificioPuerta(S, 4); if (!e) return false; const pj = S.pj; pj.mando = null; pj.plan = null; pj.cola = [];
  if (tipo === 'dormir') { if (!S.ref[e.k] && puedeBarricar(S)) pj.cola.push(['duerme', e.k]), empezar(S, 'barricar', e.k); else empezar(S, 'duerme', e.k); }
  else empezar(S, tipo, e.k);
  return true;
}
function despertar(S, msg) { const pj = S.pj; if (pj.accion?.tipo !== 'duerme') return; pj.accion = null; pj.dentro = null; pj.cola = []; if (msg) log(S, msg, msg.startsWith('¡') ? 'malo' : '', msg.startsWith('¡')); }

// usar un objeto del inventario (de la interfaz o de la IA). Devuelve true si se usó
export function usar(S, id, quien = null) {
  const pj = S.pj, inv = pj.inv; if (!(inv[id] > 0)) return false;
  const med = tiene(S, 'medico') ? 1.7 : 1;
  if (quien != null) { // dárselo a un compañero
    const g = S.grupo.find((g) => g.id === quien); if (!g) return false;
    if (id === 'antiviral') { if (!g.inf) return false; g.inf = 0; log(S, `Le inyectas el antiviral a ${g.nombre}. Se salva.`, 'bueno', true); }
    else if (id === 'vendaje' || id === 'botiquin') { g.salud = clamp(g.salud + (id === 'vendaje' ? 25 : 55) * med); }
    else if (id === 'comida' || id === 'agua') g.hambre = clamp(g.hambre + 40);
    else return false;
    inv[id]--; g.lealtad = clamp(g.lealtad + 8); return true;
  }
  if (id === 'comida') { pj.hambre = clamp(pj.hambre + 35); pj.animo = clamp(pj.animo + 3); pj.energia = clamp(pj.energia + 5); }
  else if (id === 'agua') pj.sed = clamp(pj.sed + 45);
  else if (id === 'vendaje') pj.salud = clamp(pj.salud + 20 * med);
  else if (id === 'botiquin') pj.salud = clamp(pj.salud + 45 * med);
  else if (id === 'analgesico') { pj.salud = clamp(pj.salud + 8); pj.animo = clamp(pj.animo + 12); }
  else if (id === 'antiviral') { if (!pj.inf) return false; pj.inf = 0; log(S, 'Te inyectas el antiviral. La fiebre cede: estás limpio.', 'logro', true); }
  else if (id === 'radio') { escucharRadio(S, true); return true; }
  else return false;
  inv[id]--; if (!inv[id]) delete inv[id];
  return true;
}
export function equipar(S, idx) { const pj = S.pj; if (idx < -1 || idx >= pj.armas.length) return; pj.eq = idx; }
export function soltar(S, id) {
  const pj = S.pj;
  if (typeof id === 'number') { const a = pj.armas.splice(id, 1)[0]; if (!a) return; if (pj.eq === id) pj.eq = -1; else if (pj.eq > id) pj.eq--; log(S, `Dejas ${ARMAS[a.id].n.toLowerCase()}.`); return; }
  if (pj.inv[id] > 0) { pj.inv[id]--; if (!pj.inv[id]) delete pj.inv[id]; }
}
export function responder(S, si) {
  const q = S.pregunta; if (!q) return; S.pregunta = null;
  const n = S.npcs.find((n) => n.id === q.id); if (!n || n.est === 'muerto') return;
  if (si && S.grupo.length < 3) {
    S.npcs.splice(S.npcs.indexOf(n), 1);
    S.grupo.push({ id: n.id, nombre: n.nombre, rasgo: n.rasgo, ropa: n.ropa, x: n.x, z: n.z, dir: 0, salud: n.salud, hambre: 70, lealtad: 55 + (n.rasgo === 'valiente' ? 10 : 0), inf: 0, cd: 0, golpeT: 0, vel: 0 });
    S.pj.animo = clamp(S.pj.animo + 12); log(S, `${n.nombre} (${RASGOS[n.rasgo].n.toLowerCase()}) se une al grupo.`, 'logro', true);
  } else { n.est = 'se_va'; log(S, `${n.nombre} sigue su camino.`); }
}

// ---------------------------------------------------------------- el paso de la simulación
export function paso(S, dt) {
  if (S.fin) return;
  while (dt > 1e-6) { const h = Math.min(0.25, dt); dt -= h; paso1(S, h); if (S.fin) return; }
}
function paso1(S, dt) {
  S.t += dt;
  const hora = horaDe(S), noche = esNoche(hora);
  necesidades(S, dt, noche); if (S.fin) return;
  S.tCel -= dt; if (S.tCel <= 0) { S.tCel = 1; activarCeldas(S, false); limpiar(S); }
  hordas(S, dt, noche);
  if (S.auto) { S.tIA -= dt; if (S.tIA <= 0) { S.tIA = 0.5; ia(S, noche); } }
  accionPJ(S, dt, hora);
  moverPJ(S, dt);
  combatePJ(S, dt);
  zombis(S, dt, noche); if (S.fin) return;
  moverGrupo(S, dt, noche);
  moverNpcs(S, dt);
  evacuacion(S, dt);
  ambiente(S, dt, hora, noche);
  if (S.ruidos.length && S.t - S.ruidos[0].t > 2) S.ruidos.shift();
}
function ruido(S, x, z, r) { S.ruidos.push({ x, z, r, t: S.t }); if (S.ruidos.length > 24) S.ruidos.shift(); }
function fin(S, tipo, motivo) {
  const pj = S.pj; pj.accion = null; pj.plan = null; pj.mando = null; pj.dentro = null;
  S.fin = { tipo, motivo, dia: diaDe(S), horas: Math.round(S.t / 60), dist: Math.round(S.stats.dist), abatidos: S.stats.abatidos, saqueos: S.stats.saqueos, grupo: S.grupo.map((g) => g.nombre) };
  log(S, motivo, tipo === 'escape' ? 'logro' : 'malo', true);
}

function necesidades(S, dt, noche) {
  const pj = S.pj, h = dt / 60, duerme = pj.accion?.tipo === 'duerme', ref = duerme && S.ref[pj.accion.k];
  pj.hambre = clamp(pj.hambre - 2.3 * h); pj.sed = clamp(pj.sed - (3.6 * (1 - 0.3 * S.clima.lluvia) + (pj.corriendo ? 5 : 0)) * h);
  if (duerme) pj.energia = clamp(pj.energia + (ref ? 16 : 11) * h);
  else if (pj.corriendo) pj.energia = clamp(pj.energia - (tiene(S, 'rapido') ? 0.55 : 0.8) * dt);
  else pj.energia = clamp(pj.energia + (pj.vel > 0.1 ? -2.6 : pj.accion || pj.dentro ? 4 : 2) * h); // quieto, recupera un poco el aliento
  if (pj.hambre <= 0) { pj.salud -= 4 * h; pj.causa = 'hambre'; }
  if (pj.sed <= 0) { pj.salud -= 8 * h; pj.causa = 'sed'; }
  if (pj.hambre > 35 && pj.sed > 35 && !pj.inf) pj.salud = clamp(pj.salud + (duerme ? 4 : 1.2) * h);
  if (pj.inf > 0) {
    pj.inf -= h * (tiene(S, 'medico') ? 0.7 : 1);
    if (pj.inf < 12) { pj.salud -= 2.5 * h; pj.animo -= 2 * h; pj.causa = 'infeccion'; }
    if (pj.inf <= 0) { pj.inf = 0; return fin(S, 'convertido', `La fiebre ganó. ${pj.nombre} se convirtió en uno de ellos.`); }
  }
  // el ánimo vuelve despacio a 50; la noche sin compañía, el hambre y el miedo lo hunden
  let da = (50 - pj.animo) * 0.02 + S.grupo.length * 0.6;
  if (noche && !S.grupo.length && !duerme) da -= tiene(S, 'valiente') ? 0.5 : 1.5;
  if (pj.hambre < 20 || pj.sed < 20) da -= 2; if (pj.salud < 35) da -= 1.5; if (tiene(S, 'cobarde') && pj.corriendo) da -= 3;
  pj.animo = clamp(pj.animo + da * h);
  pj.salud = Math.min(100, pj.salud);
  if (pj.salud <= 0) {
    pj.salud = 0;
    const M = { zombis: `${pj.nombre} cayó bajo los zombis.`, hambre: `${pj.nombre} murió de hambre.`, sed: `${pj.nombre} murió de sed.`, infeccion: `La infección acabó con ${pj.nombre}.` };
    fin(S, 'muerte', M[pj.causa] || `${pj.nombre} no sobrevivió.`);
  }
  const h24 = horaDe(S); // de día se levanta descansado; si ya va a anochecer, sigue en el refugio hasta el amanecer
  if (duerme && ((pj.energia >= 97 && h24 >= 5.5 && h24 < 17.5) || (pj.energia > 70 && h24 >= 5.5 && h24 < 7) || pj.hambre < 6 || pj.sed < 6)) despertar(S, `${pj.nombre} se despierta${pj.energia >= 97 ? ' descansado' : ' con hambre'}.`);
}

// ---------------------------------------------------------------- aparición de zombis, sobrevivientes y hordas
function nuevoZombi(S, x, z, tipo) { const T = ZT[tipo]; const zz = { id: S.sigId++, x, z, tipo, hp: T[2], est: 'deambula', tx: x, tz: z, tT: 0, cd: 0, dir: rnd(S) * 6.28, obj: null, vel: 0, golpeT: 0, tm: 0, rv: S.t, tP: rnd(S) * 0.4, atasco: 0 }; S.zs.push(zz); return zz; }
const vivos = (S) => S.zs.reduce((n, z) => n + (z.est !== 'muerto'), 0);
function activarCeldas(S, inicio) {
  const pj = S.pj, ci = Math.floor(pj.x / P), cj = Math.floor(pj.z / P);
  for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
    const c = celda(S.sem, i, j), d = hyp((i + 0.5) * P - pj.x, (j + 0.5) * P - pj.z); if (d > 78) continue;
    const k = `${i},${j}`, v = S.vistas[k];
    if (v == null || S.t - v > 600) {
      S.vistas[k] = S.t;
      c.zs.forEach((q, n) => { // al volver tras 10 h reaparece la mitad: la ciudad se vuelve a llenar
        if (v != null && n % 2) return; if (vivos(S) > 55) return;
        const dz = hyp(q.x - pj.x, q.z - pj.z); if (dz < (inicio ? 16 : 47) || bloqueado(S.sem, q.x, q.z, 0.3)) return;
        // la dificultad decide cuántos de los que vivían ahí siguen en pie (y si los corredores ya despertaron)
        const rg = rigor(S); if (rnd(S) > rg) return;
        const tipo = q.tipo === 'corredor' && rnd(S) > pCorredor(S) ? 'lento' : q.tipo;
        nuevoZombi(S, q.x, q.z, tipo); if (rg > 1 && rnd(S) < rg - 1) nuevoZombi(S, q.x + 0.8, q.z + 0.6, 'lento');
      });
    }
    if (!S.faunaVis[k]) { S.faunaVis[k] = 1; for (const f of c.fauna) if (hyp(f.x - pj.x, f.z - pj.z) > (inicio ? 12 : 40)) S.anim.push({ id: S.sigId++, t: f.t, x: f.x, z: f.z, n: f.n || 1, dir: rnd(S) * 6.28, vel: 0, est: f.t === 'perro' ? 'vaga' : 'suelo', tE: 0, y: 0, ladro: false }); }
    if (c.npc && !S.npcVis[k] && hyp(c.npc.x - pj.x, c.npc.z - pj.z) > 28) {
      S.npcVis[k] = 1; const n = c.npc;
      S.npcs.push({ id: S.sigId++, nombre: n.nombre, rasgo: n.rasgo, actitud: n.actitud, ropa: n.ropa, x: n.x, z: n.z, x0: n.x, z0: n.z, est: 'espera', salud: 70, dir: 0, cd: 0, vel: 0, golpeT: 0, tm: 0 });
    }
  }
}
function limpiar(S) {
  const pj = S.pj;
  S.zs = S.zs.filter((z) => (z.est === 'muerto' ? S.t - z.tm < 150 && hyp(z.x - pj.x, z.z - pj.z) < 70 : hyp(z.x - pj.x, z.z - pj.z) < (z.est === 'persigue' ? 110 : 85)));
  S.npcs = S.npcs.filter((n) => hyp(n.x - pj.x, n.z - pj.z) < 90 && !(n.est === 'muerto' && S.t - n.tm > 200));
  if (S.pregunta && (S.t - S.pregunta.t0 > 45 || !S.npcs.some((n) => n.id === S.pregunta.id))) { const q = S.pregunta; S.pregunta = null; const n = S.npcs.find((n) => n.id === q.id); if (n) n.est = 'se_va'; }
}
function lugarLibreAnillo(S, r0, r1) {
  const pj = S.pj; for (let a = 0; a < 10; a++) { const ang = rnd(S) * Math.PI * 2, r = r0 + rnd(S) * (r1 - r0), x = pj.x + Math.cos(ang) * r, z = pj.z + Math.sin(ang) * r; if (!bloqueado(S.sem, x, z, 0.4)) return [x, z]; }
  return null;
}
function hordas(S, dt, noche) {
  S.tHorda -= dt; if (S.tHorda > 0) return;
  const d = diaDe(S); S.tHorda = S.evac ? 14 : noche ? 90 + rnd(S) * 60 : 200 + rnd(S) * 120;
  if (vivos(S) > (S.evac ? 50 : 35) || rnd(S) > (S.evac ? 1 : noche ? 0.6 : 0.35)) return;
  const n = Math.max(1, Math.round(((noche ? 3 + Math.floor(rnd(S) * 5) : 2 + Math.floor(rnd(S) * 3)) + Math.min(4, Math.floor(d / 2))) * Math.max(0.6, rigor(S)))), p = lugarLibreAnillo(S, 50, 60); if (!p) return;
  for (let a = 0; a < n; a++) { const q = rnd(S), z = nuevoZombi(S, p[0] + (rnd(S) - 0.5) * 4, p[1] + (rnd(S) - 0.5) * 4, q < (noche ? 0.25 : 0.12) * pCorredor(S) ? 'corredor' : q < 0.35 ? 'gordo' : 'lento'); if (bloqueado(S.sem, z.x, z.z, 0.3)) { z.x = p[0]; z.z = p[1]; } z.est = 'investiga'; z.tx = S.pj.x + (rnd(S) - 0.5) * 30; z.tz = S.pj.z + (rnd(S) - 0.5) * 30; }
  if (noche || S.evac) log(S, S.evac ? 'Más zombis llegan atraídos por la bengala.' : 'Se oyen gemidos: una horda ronda cerca.', 'malo');
}

// ---------------------------------------------------------------- el protagonista: moverse, acciones y pelea
function moverCon(sem, e, dx, dz, rad) {
  if (bloqueado(sem, e.x, e.z, rad * 0.5)) { e.x += dx; e.z += dz; return hyp(dx, dz); } // si quedó atrapado, que salga
  const nx = e.x + dx, nz = e.z + dz;
  if (!bloqueado(sem, nx, nz, rad)) { e.x = nx; e.z = nz; return hyp(dx, dz); }
  if (Math.abs(dx) > 1e-4 && !bloqueado(sem, nx, e.z, rad)) { e.x = nx; return Math.abs(dx); }
  if (Math.abs(dz) > 1e-4 && !bloqueado(sem, e.x, nz, rad)) { e.z = nz; return Math.abs(dz); }
  return 0;
}
function velPJ(S, correr) { const pj = S.pj; return (correr && pj.energia > 4 ? 3.5 : 1.6) * (tiene(S, 'rapido') ? 1.2 : 1) * (pj.energia < 10 ? 0.75 : 1) * (pj.salud < 25 ? 0.8 : 1); }
function moverPJ(S, dt) {
  const pj = S.pj; let vx = 0, vz = 0, correr = false;
  if (!pj.accion) {
    if (pj.mando) { vx = pj.mando.dx; vz = pj.mando.dz; correr = pj.mando.correr; }
    else if (pj.plan) {
      const pl = pj.plan;
      if (pl.al?.tipo === 'atacar') { const z = S.zs.find((z) => z.id === pl.al.id && z.est !== 'muerto'); if (!z) pj.plan = null; else { const d = hyp(z.x - pj.x, z.z - pj.z); if (d < armaActiva(S).def.alc * 0.85) pl.ruta = [[pj.x, pj.z]]; else pl.ruta = [[z.x, z.z]]; pl.idx = 0; } }
      if (pj.plan) {
        const p = pl.ruta[pl.idx]; const dx = p[0] - pj.x, dz = p[1] - pj.z, d = hyp(dx, dz);
        if (d < 0.35) { pl.idx++; if (pl.idx >= pl.ruta.length) { if (pl.al?.tipo !== 'atacar') llegar(S); } }
        else { vx = dx / d; vz = dz / d; correr = pl.correr; const v = velPJ(S, correr) * dt; if (v > d) { vx *= d / v; vz *= d / v; } }
      }
    }
  }
  const v = velPJ(S, correr), m = (vx || vz) ? moverCon(S.sem, pj, vx * v * dt, vz * v * dt, 0.35) : 0;
  pj.vel = m / dt; pj.corriendo = correr && m > 0.01;
  if (m > 0.001) { pj.dir = Math.atan2(vx, vz); S.stats.dist += m; }
  if (pj.corriendo && rnd(S) < dt * 2) ruido(S, pj.x, pj.z, tiene(S, 'sigiloso') ? 5 : 9);
  // atasco: si un plan no avanza en 12 s, se descarta (la IA elegirá otro camino)
  pj.quieto = (pj.plan && m < 0.005) ? pj.quieto + dt : 0;
  if (pj.quieto > 12 && pj.plan) { pj.plan = null; pj.quieto = 0; }
}
function llegar(S) {
  const pj = S.pj, al = pj.plan?.al; pj.plan = null; if (!al) return;
  if (al.tipo === 'saquear') empezar(S, 'saquear', al.k);
  else if (al.tipo === 'esconde') {
    pj.cola = []; const cerca = S.zs.some((z) => z.est !== 'muerto' && hyp(z.x - pj.x, z.z - pj.z) < 5);
    if (al.barricar && !S.ref[al.k] && puedeBarricar(S) && !cerca) pj.cola.push(['barricar', al.k]);
    pj.cola.push(['esconde', al.k]); siguiente(S);
  }
  else if (al.tipo === 'refugio') {
    pj.cola = []; if (!S.saq[al.k] && S.auto) pj.cola.push(['saquear', al.k]);
    if (al.barricar && !S.ref[al.k] && puedeBarricar(S)) pj.cola.push(['barricar', al.k]);
    pj.cola.push(['duerme', al.k]); siguiente(S);
  }
}
function accionPJ(S, dt) {
  const pj = S.pj, a = pj.accion; if (!a) return;
  if (a.tipo === 'duerme') {
    return;
  }
  if (a.tipo === 'esconde') { // escondido: sale cuando lleva 20 min sin que nadie lo busque
    const busca = S.zs.some((z) => z.est !== 'muerto' && hyp(z.x - pj.x, z.z - pj.z) < 12 && (z.est === 'persigue' || z.est === 'investiga'));
    a.t = (a.t || 0) + dt; a.prog = busca ? 0 : a.prog + dt / 20; if (a.prog >= 1) { log(S, `${pj.nombre} sale de su escondite.`); pj.tEsc = S.t; siguiente(S); } return;
  }
  a.prog += dt / a.dur; if (a.prog < 1) return;
  const e = buscarEdificio(S.sem, a.k);
  if (a.tipo === 'saquear') { S.saq[a.k] = 1; S.stats.saqueos++; botin(S, e); }
  else if (a.tipo === 'barricar') {
    if (pj.inv.tablas > 0) { pj.inv.tablas--; if (!pj.inv.tablas) delete pj.inv.tablas; }
    S.ref[a.k] = { hp: tiene(S, 'mecanico') ? 450 : 300 }; log(S, `Barricas la puerta de ${TIPOS[e.tipo].n.toLowerCase()}: ahora es un refugio.`, 'bueno');
  }
  siguiente(S);
}
function agregar(S, id, n = 1) {
  const pj = S.pj;
  if (ARMAS[id]) {
    const nueva = { id, dur: Math.round(ARMAS[id].dur * (tiene(S, 'mecanico') ? 1.5 : 1)) };
    const valor = (a) => (ARMAS[a.id].mun ? 120 : ARMAS[a.id].dmg / ARMAS[a.id].cd);
    if (pj.armas.some((a) => a.id === id && !ARMAS[id].mun)) { const a = pj.armas.find((a) => a.id === id); a.dur = Math.max(a.dur, nueva.dur); return `${ARMAS[id].ic}`; }
    if (pj.armas.length >= 3) { let peor = 0; pj.armas.forEach((a, k) => { if (valor(a) < valor(pj.armas[peor])) peor = k; }); if (valor(pj.armas[peor]) >= valor(nueva)) return null; pj.armas.splice(peor, 1); if (pj.eq === peor) pj.eq = -1; else if (pj.eq > peor) pj.eq--; }
    else if (cargaDe(S) >= pj.cap) return null;
    pj.armas.push(nueva); if (pj.eq < 0 || (!ARMAS[pj.armas[pj.eq].id].mun && !ARMAS[id].mun && valor(nueva) > valor(pj.armas[pj.eq]))) pj.eq = pj.armas.length - 1;
    return `${ARMAS[id].ic} ${ARMAS[id].n.toLowerCase()}`;
  }
  if (id === 'mochila') { if (pj.cap >= 22) return null; pj.cap += 10; return '🎒 mochila (+10 de carga)'; }
  if (id === 'radio' && pj.inv.radio) return null;
  if (!ITEMS[id].mun && cargaDe(S) + n > pj.cap) n = Math.max(0, pj.cap - cargaDe(S));
  if (!n) return null;
  pj.inv[id] = (pj.inv[id] || 0) + n; return `${ITEMS[id].ic} ${n > 1 ? n + ' ' : ''}${ITEMS[id].n.toLowerCase()}`;
}
function botin(S, e) {
  const T = TIPOS[e.tipo], r = azar(hash(S.sem, ...e.k.split(',').map(Number), 5)); // el contenido de cada edificio es fijo por semilla
  const tabla = Object.entries(BOTIN[e.tipo]), tot = tabla.reduce((s, x) => s + x[1], 0);
  const n = T.botin[0] + Math.floor(r() * (T.botin[1] - T.botin[0] + 1)) + DIF(S).botin + (diaDe(S) === 1 ? 1 : 0), got = [], perdido = []; // el primer día hay más a mano
  for (let a = 0; a < n; a++) {
    let q = r() * tot, id = tabla[0][0]; for (const [k, w] of tabla) { q -= w; if (q <= 0) { id = k; break; } }
    const cant = id === 'balas' ? 4 + Math.floor(r() * 9) : id === 'cartuchos' ? 2 + Math.floor(r() * 5) : 1;
    const txt = agregar(S, id, cant); if (txt) got.push(txt); else perdido.push((ITEMS[id] || ARMAS[id] || { n: id }).n.toLowerCase());
  }
  if (e.tipo === 'comisaria' && !got.some((g) => g.includes('bala'))) { const t = agregar(S, 'balas', 6); if (t) got.push(t); }
  log(S, `${T.ic} ${T.n}: ${got.length ? got.join(', ') : 'nada útil'}${perdido.length ? ` (no cupo: ${perdido.join(', ')})` : ''}.`, got.length ? 'bueno' : '');
  S.pj.animo = clamp(S.pj.animo + (got.length ? 3 : -2));
}
export function armaActiva(S) {
  const pj = S.pj, a = pj.armas[pj.eq];
  if (a && (!ARMAS[a.id].mun || (pj.inv[ARMAS[a.id].mun] || 0) > 0)) return { def: ARMAS[a.id], a, idx: pj.eq };
  let mej = -1; pj.armas.forEach((x, k) => { if (!ARMAS[x.id].mun && (mej < 0 || ARMAS[x.id].dmg / ARMAS[x.id].cd > ARMAS[pj.armas[mej].id].dmg / ARMAS[pj.armas[mej].id].cd)) mej = k; });
  return mej >= 0 ? { def: ARMAS[pj.armas[mej].id], a: pj.armas[mej], idx: mej } : { def: ARMAS.punos, a: null, idx: -1 };
}
function matarZombi(S, z, quien) {
  z.est = 'muerto'; z.tm = S.t; z.hp = 0; S.stats.abatidos++;
  if (quien === 'pj') { S.pj.animo = clamp(S.pj.animo + 1.5); if (S.stats.abatidos % 25 === 0) log(S, `${S.stats.abatidos} zombis abatidos.`, 'logro'); }
}
function combatePJ(S, dt) {
  const pj = S.pj; pj.cd -= dt; pj.golpeT = Math.max(0, pj.golpeT - dt);
  if (pj.cd > 0 || (pj.dentro && !S.ref[pj.dentro]) || pj.accion?.tipo === 'duerme') return; // desde un refugio se pelea entre las tablas
  const ar = armaActiva(S), fuego = !!ar.def.mun, alc = ar.def.alc;
  const fijo = pj.plan?.al?.tipo === 'atacar' ? pj.plan.al.id : null;
  let obj = null, mejor = 1e9;
  for (const z of S.zs) {
    if (z.est === 'muerto') continue; const d = hyp(z.x - pj.x, z.z - pj.z); if (d > alc) continue;
    const amenaza = z.id === fijo || (z.est === 'persigue' && z.obj === 'pj') || d < 2.2;
    if (!amenaza) continue;
    if (fuego && !S.auto && z.id !== fijo && d > 7) continue; // en manual, disparar solo de cerca (salvo que lo señales)
    if (fuego && d > 2 && !lineaLibre(S.sem, pj.x, pj.z, z.x, z.z, 0)) continue;
    const s = d - (z.id === fijo ? 50 : 0); if (s < mejor) { mejor = s; obj = z; }
  }
  if (!obj) return;
  pj.dir = Math.atan2(obj.x - pj.x, obj.z - pj.z); pj.golpeT = 0.45;
  pj.cd = ar.def.cd * (tiene(S, 'rapido') ? 0.85 : 1) * (pj.energia < 10 ? 1.3 : 1);
  ruido(S, pj.x, pj.z, ar.def.ruido * (tiene(S, 'sigiloso') && !fuego ? 0.5 : 1));
  if (ar.a) { ar.a.dur--; if (ar.a.dur <= 0) { const i = pj.armas.indexOf(ar.a); pj.armas.splice(i, 1); if (pj.eq === i) pj.eq = -1; else if (pj.eq > i) pj.eq--; log(S, `Se rompió ${ar.def.n.toLowerCase()}.`, 'malo', true); } }
  if (fuego && !--pj.inv[ar.def.mun]) { delete pj.inv[ar.def.mun]; log(S, `Sin ${ar.def.mun} para ${ar.def.n.toLowerCase()}.`, 'malo', true); }
  const prec = (fuego ? 0.8 : 0.88) * (pj.animo < 20 ? 0.8 : 1);
  const objetivos = ar.def.cono ? S.zs.filter((z) => z.est !== 'muerto' && hyp(z.x - pj.x, z.z - pj.z) < alc && Math.abs(((Math.atan2(z.x - pj.x, z.z - pj.z) - pj.dir + 9.42) % 6.283) - 3.14) < ar.def.cono) : [obj];
  for (const z of objetivos) {
    if (rnd(S) > prec) continue;
    const dmg = ar.def.dmg * (!fuego && tiene(S, 'fuerte') ? 1.4 : 1) * (0.85 + rnd(S) * 0.3);
    z.hp -= dmg; z.est = 'persigue'; z.obj = 'pj'; z.tx = pj.x; z.tz = pj.z; z.cd = Math.max(z.cd, fuego ? 0.3 : 0.55); // el golpe lo aturde
    if (!fuego) { const d = hyp(z.x - pj.x, z.z - pj.z) || 1; moverCon(S.sem, z, (z.x - pj.x) / d * 0.35, (z.z - pj.z) / d * 0.35, 0.3); } // empujón
    if (z.hp <= 0) matarZombi(S, z, 'pj');
  }
}

// ---------------------------------------------------------------- los zombis: ven, oyen, persiguen y muerden
function blancoDe(S, id) { if (id === 'pj') return S.fin ? null : S.pj; return S.grupo.find((g) => g.id === id) || S.npcs.find((n) => n.id === id && n.est !== 'muerto' && n.est !== 'fuera') || null; }
function zombis(S, dt, noche) {
  const pj = S.pj, sig = tiene(S, 'sigiloso') ? 0.65 : 1, ll = S.clima.lluvia, vistaBase = (noche ? 8.5 : 13) * (1 - 0.25 * ll), oido = (noche ? 1.35 : 1) * (1 - 0.35 * ll); // la lluvia tapa el ruido y la vista
  const cand = [{ id: 'pj', e: pj, oculto: !!pj.dentro, mod: sig }];
  for (const g of S.grupo) cand.push({ id: g.id, e: g, oculto: pj.dentro && pj.accion?.tipo === 'duerme', mod: 1 });
  for (const n of S.npcs) if (n.est !== 'muerto') cand.push({ id: n.id, e: n, oculto: false, mod: 1 });
  for (const z of S.zs) {
    if (z.est === 'muerto') continue;
    const T = ZT[z.tipo]; z.golpeT = Math.max(0, z.golpeT - dt); z.cd -= dt; z.tP -= dt;
    if (z.tP <= 0) { // percepción cada 0,4 s: ver y oír
      z.tP = 0.4; let mejor = null, md = 1e9;
      const vista = vistaBase * (z.tipo === 'corredor' ? 1.15 : 1);
      for (const c of cand) {
        if (c.oculto && z.ignora > S.t) continue;
        const d = hyp(c.e.x - z.x, c.e.z - z.z), alcance = c.oculto ? 2.2 : vista * c.mod;
        if (d < alcance && d < md && (d < 2.5 || lineaLibre(S.sem, z.x, z.z, c.e.x, c.e.z, 0))) { md = d; mejor = c; }
      }
      if (mejor) { z.est = 'persigue'; z.obj = mejor.id; z.tx = mejor.e.x; z.tz = mejor.e.z; }
      else if (z.est === 'persigue') { z.est = 'investiga'; }
      if (z.est !== 'persigue') for (const r of S.ruidos) if (r.t > z.rv && hyp(r.x - z.x, r.z - z.z) < r.r * oido) { z.est = 'investiga'; z.tx = r.x + (rnd(S) - 0.5) * 3; z.tz = r.z + (rnd(S) - 0.5) * 3; }
      z.rv = S.t;
    }
    let tx = z.tx, tz = z.tz, rapido = false;
    if (z.est === 'persigue') { const b = blancoDe(S, z.obj); if (!b) z.est = 'deambula'; else { tx = z.tx = b.x; tz = z.tz = b.z; rapido = true; } }
    else if (z.est === 'investiga') { rapido = z.tipo !== 'corredor'; if (hyp(tx - z.x, tz - z.z) < 1.5) z.est = 'deambula'; }
    if (z.est === 'deambula') { z.tT -= dt; if (z.tT <= 0) { z.tT = 5 + rnd(S) * 8; const a = rnd(S) * 6.28, r = 3 + rnd(S) * 8; z.tx = z.x + Math.cos(a) * r; z.tz = z.z + Math.sin(a) * r; } tx = z.tx; tz = z.tz; }
    const dx = tx - z.x, dz = tz - z.z, d = hyp(dx, dz);
    // morder si está encima del blanco
    if (z.est === 'persigue' && d < 1.05) {
      z.vel = 0; z.dir = Math.atan2(dx, dz);
      if (!z.encima) { z.encima = true; z.cd = Math.max(z.cd, 0.6); } // se prepara antes del primer mordisco: da tiempo a reaccionar
      if (z.cd <= 0) { z.cd = T[4] * (noche ? 0.85 : 1); z.golpeT = 0.5; morder(S, z, blancoDe(S, z.obj), T, noche); if (S.fin) return; }
      continue;
    }
    z.encima = false;
    const v = (rapido ? T[1] : T[0]) * (noche ? 1.2 : 1) * (z.est === 'investiga' && z.tipo === 'corredor' ? 0.6 : 1);
    if (d > 0.2) {
      let mx = dx / d, mz = dz / d;
      if (z.atasco > 0) { z.atasco -= dt; const s = z.id % 2 ? 1 : -1; [mx, mz] = [mx * 0.3 - mz * s, mz * 0.3 + mx * s]; } // rodear el obstáculo un rato
      const m = moverCon(S.sem, z, mx * v * dt, mz * v * dt, 0.3);
      if (m < v * dt * 0.3 && z.atasco <= 0) { z.atasco = 1 + rnd(S); if (z.est === 'deambula') z.tT = 0; }
      z.vel = m / dt; z.dir = Math.atan2(mx, mz);
    } else z.vel = 0;
  }
  // separación: que no se amontonen en el mismo punto
  for (let a = 0; a < S.zs.length; a++) { const z = S.zs[a]; if (z.est === 'muerto') continue; for (let b = a + 1; b < S.zs.length; b++) { const w = S.zs[b]; if (w.est === 'muerto') continue; const dx = w.x - z.x, dz = w.z - z.z; if (dx > 0.65 || dx < -0.65 || dz > 0.65 || dz < -0.65) continue; const d = hyp(dx, dz); if (d < 0.65 && d > 1e-4) { const k = (0.65 - d) / d * 0.5; moverCon(S.sem, z, -dx * k, -dz * k, 0.3); moverCon(S.sem, w, dx * k, dz * k, 0.3); } } }
}
function morder(S, z, b, T, noche) {
  if (!b) return; const dmg = T[3] * (noche ? 1.15 : 1) * DIF(S).d * (0.8 + rnd(S) * 0.4);
  if (b === S.pj && S.pj.dentro && S.ref[S.pj.dentro]) { // la barricada aguanta los golpes… un tiempo
    const r = S.ref[S.pj.dentro]; r.hp -= dmg;
    if (rnd(S) < 0.12) { z.est = 'deambula'; z.ignora = S.t + 45; z.tT = 0; } // se aburre de la puerta y se va if (S.pj.accion?.tipo === 'duerme') despertar(S, '¡Golpes en la puerta! Te despiertas.');
    if (r.hp <= 0) { delete S.ref[S.pj.dentro]; log(S, '¡Rompieron la barricada!', 'malo', true); } return;
  }
  if (b === S.pj) {
    const pj = S.pj; if (pj.accion) { if (pj.accion.tipo === 'duerme') despertar(S, '¡Un zombi te ataca mientras duermes!'); else { pj.accion = null; pj.cola = []; } pj.dentro = null; pj.tEsc = S.t; }
    pj.salud -= dmg; pj.causa = 'zombis'; pj.animo = clamp(pj.animo - (tiene(S, 'cobarde') ? 3 : 1.5));
    if (!pj.inf && rnd(S) < T[5] * DIF(S).mord) { pj.inf = Math.round((tiene(S, 'medico') ? 46 : 36) * DIF(S).inf); S.stats.mordidas++; log(S, `¡Te mordieron! La infección avanza: tienes ~${pj.inf} h para encontrar antiviral.`, 'malo', true); }
    if (pj.salud <= 0) fin(S, 'muerte', `${pj.nombre} cayó bajo los zombis${S.grupo.length ? ', frente a su grupo' : ''}.`);
  } else {
    b.salud -= dmg;
    if (b.inf != null && !b.inf && rnd(S) < T[5]) { b.inf = 20; log(S, `¡Mordieron a ${b.nombre}!`, 'malo', true); }
    if (b.salud <= 0) {
      const g = S.grupo.indexOf(b);
      if (g >= 0) { S.grupo.splice(g, 1); S.pj.animo = clamp(S.pj.animo - 20); log(S, `${b.nombre} murió defendiendo al grupo.`, 'malo', true); S.npcs.push({ ...b, est: 'muerto', tm: S.t, actitud: 'amable' }); }
      else { b.est = 'muerto'; b.tm = S.t; }
      z.est = 'deambula';
    }
  }
}

// ---------------------------------------------------------------- compañeros y otros sobrevivientes
function moverGrupo(S, dt, noche) {
  const pj = S.pj, h = dt / 60;
  [...S.grupo].forEach((g, k) => {
    g.cd -= dt; g.golpeT = Math.max(0, g.golpeT - dt); g.hambre = clamp(g.hambre - 2.3 * h);
    if (g.hambre < 35) { if (pj.inv.comida > 0) { usar(S, 'comida', g.id); } else if (pj.inv.agua > 0) { usar(S, 'agua', g.id); } else g.lealtad = clamp(g.lealtad - 4 * h); }
    else g.lealtad = clamp(g.lealtad + 0.4 * h);
    if (g.hambre <= 0) g.salud -= 3 * h;
    if (g.inf > 0) { g.inf -= h; if (g.inf <= 0) { // se convierte delante de todos
      S.grupo.splice(S.grupo.indexOf(g), 1); const z = nuevoZombi(S, g.x, g.z, 'lento'); z.est = 'persigue'; z.obj = 'pj'; S.pj.animo = clamp(S.pj.animo - 25);
      log(S, `${g.nombre} se convirtió. Ahora es uno de ellos.`, 'malo', true); return; } }
    if (g.salud <= 0) return;
    // traición: con lealtad baja, de noche, se lleva cosas y se va
    if (noche && g.lealtad < 18 && rnd(S) < dt / 400) {
      const robado = []; for (const id of ['comida', 'agua', 'botiquin', 'antiviral', 'vendaje']) if (pj.inv[id] > 0 && robado.length < 3) { pj.inv[id]--; if (!pj.inv[id]) delete pj.inv[id]; robado.push(ITEMS[id].n.toLowerCase()); }
      S.grupo.splice(S.grupo.indexOf(g), 1); S.npcs.push({ ...g, actitud: 'hostil', est: 'se_va', x0: g.x, z0: g.z, tm: 0 });
      pj.animo = clamp(pj.animo - 15); log(S, `${g.nombre} te traicionó: se fue en la noche${robado.length ? ' llevándose ' + robado.join(', ') : ''}.`, 'malo', true); return;
    }
    // pelear: el zombi vivo más cercano a 7 m del protagonista o de sí mismo
    let obj = null, md = 7; for (const z of S.zs) { if (z.est === 'muerto') continue; const d = Math.min(hyp(z.x - g.x, z.z - g.z), hyp(z.x - pj.x, z.z - pj.z)); if (d < md) { md = d; obj = z; } }
    let tx, tz, v = 1.7;
    if (obj && !(pj.accion?.tipo === 'duerme')) {
      const d = hyp(obj.x - g.x, obj.z - g.z); tx = obj.x; tz = obj.z; v = 2.6;
      if (d < 1.6) { tx = g.x; tz = g.z; g.dir = Math.atan2(obj.x - g.x, obj.z - g.z); if (g.cd <= 0) { g.cd = 1; g.golpeT = 0.45; obj.hp -= (g.rasgo === 'fuerte' ? 22 : 15) * (0.8 + rnd(S) * 0.4); obj.est = 'persigue'; obj.obj = g.id; if (obj.hp <= 0) matarZombi(S, obj, g.id); } }
    } else { // seguir detrás, en abanico
      const a = pj.dir + Math.PI + (k - (S.grupo.length - 1) / 2) * 0.7; tx = pj.x + Math.sin(a) * 2.2; tz = pj.z + Math.cos(a) * 2.2; v = Math.max(1.7, pj.vel * 1.1);
    }
    const dx = tx - g.x, dz = tz - g.z, d = hyp(dx, dz);
    if (d > 60) { g.x = pj.x; g.z = pj.z; } // si se quedó muy atrás, te alcanza
    if (d > 0.4) { const m = moverCon(S.sem, g, dx / d * Math.min(v * dt, d), dz / d * Math.min(v * dt, d), 0.3); g.vel = m / dt; if (m > 0.001) g.dir = Math.atan2(dx, dz); } else g.vel = 0;
  });
}
function moverNpcs(S, dt) {
  const pj = S.pj;
  for (const n of S.npcs) {
    if (n.est === 'muerto') continue; n.golpeT = Math.max(0, n.golpeT - dt);
    const dpj = hyp(pj.x - n.x, pj.z - n.z);
    if (n.est === 'espera' && dpj < 4 && !S.fin && !pj.dentro) encuentro(S, n);
    let tx = n.x0, tz = n.z0, v = 1.3;
    if (n.est === 'espera' && dpj < 24 && !pj.dentro) { tx = pj.x; tz = pj.z; v = 1.5; } // te vio: se acerca a hablar (o a robarte)
    if (n.est === 'se_va' || n.est === 'huye') { const d = dpj || 1; tx = n.x + (n.x - pj.x) / d * 10; tz = n.z + (n.z - pj.z) / d * 10; v = n.est === 'huye' ? 3 : 1.5; }
    else if (n.est === 'habla') { tx = n.x; tz = n.z; n.dir = Math.atan2(pj.x - n.x, pj.z - n.z); }
    const dx = tx - n.x, dz = tz - n.z, d = hyp(dx, dz);
    if (d > 0.5) { const m = moverCon(S.sem, n, dx / d * v * dt, dz / d * v * dt, 0.3); n.vel = m / dt; n.dir = Math.atan2(dx, dz); } else n.vel = 0;
  }
}
function encuentro(S, n) {
  const pj = S.pj, armado = pj.armas.some((a) => ARMAS[a.id].mun && pj.inv[ARMAS[a.id].mun] > 0);
  if (n.actitud === 'amable') {
    if (S.grupo.length >= 3) { n.est = 'se_va'; log(S, `${n.nombre} ve que tu grupo ya es grande y sigue solo.`); return; }
    n.est = 'habla';
    if (S.auto) { const si = tiene(S, 'cobarde') || S.grupo.length < 2 || (pj.inv.comida || 0) >= 3; S.pregunta = { tipo: 'unirse', id: n.id, t0: S.t }; responder(S, si); }
    else { S.pregunta = { tipo: 'unirse', id: n.id, t0: S.t, texto: `${n.nombre} (${RASGOS[n.rasgo].ic} ${RASGOS[n.rasgo].n.toLowerCase()}) pide unirse a tu grupo.` }; S.avisos.push(`${n.nombre} quiere unirse.`); }
  } else if (n.actitud === 'desconfiado') {
    n.est = 'se_va'; const e = S.est; if (!S.revelada) { const k = 0.55; e.err *= k; e.x = S.obj.x + (e.x - S.obj.x) * k; e.z = S.obj.z + (e.z - S.obj.z) * k; }
    log(S, `${n.nombre}, desconfiado, solo te dice por dónde vio pasar helicópteros${S.revelada ? '' : ' (la pista mejora)'}.`, 'bueno', true);
  } else {
    if (armado || tiene(S, 'fuerte') || S.grupo.length >= 2) { n.est = 'huye'; log(S, `Un saqueador, ${n.nombre}, te ve armado y se aleja.`, '', true); return; }
    const robado = []; for (const id of ['comida', 'agua', 'vendaje', 'botiquin']) if (pj.inv[id] > 0 && robado.length < 2) { pj.inv[id]--; if (!pj.inv[id]) delete pj.inv[id]; robado.push(ITEMS[id].n.toLowerCase()); }
    n.est = 'huye'; pj.animo = clamp(pj.animo - 10);
    log(S, `${n.nombre} te amenaza con un cuchillo${robado.length ? ' y se lleva ' + robado.join(' y ') : ', pero no tienes nada'}.`, 'malo', true);
  }
}

// ---------------------------------------------------------------- la evacuación y la radio
function escucharRadio(S, aMano) {
  const e = S.est; if (S.revelada) { if (aMano) log(S, '📻 La radio repite: «zona de evacuación activa, sigan el humo verde».'); return; }
  if (aMano && S.t - S.tRadio < 240) { log(S, '📻 Solo estática. Vuelve a intentar en unas horas.'); return; }
  S.tRadio = S.t; const k = 0.5; e.err = Math.max(25, e.err * k); e.x = S.obj.x + (e.x - S.obj.x) * k + (rnd(S) - 0.5) * 20; e.z = S.obj.z + (e.z - S.obj.z) * k + (rnd(S) - 0.5) * 20;
  log(S, `📻 La radio da coordenadas más precisas (±${Math.round(e.err)} m).`, 'bueno', aMano);
}
function evacuacion(S, dt) {
  const pj = S.pj, d = hyp(S.obj.x - pj.x, S.obj.z - pj.z);
  if (pj.inv.radio && S.t - S.tRadio > 360) escucharRadio(S, false); // con radio, cada 6 h llega una transmisión
  if (!S.revelada && d < 230) { S.revelada = true; S.est = { x: S.obj.x, z: S.obj.z, err: 0 }; log(S, '¡Columna de humo verde! Ahí está la zona de evacuación.', 'logro', true); }
  if (!S.revelada && hyp(S.est.x - pj.x, S.est.z - pj.z) < 30) { // llegaste al punto estimado y no hay nada: la pista se corrige
    const e = S.est, k = 0.45; e.err = Math.max(25, e.err * k); e.x = S.obj.x + (e.x - S.obj.x) * k; e.z = S.obj.z + (e.z - S.obj.z) * k;
    if (hyp(e.x - pj.x, e.z - pj.z) < 40) { const a = Math.atan2(S.obj.z - pj.z, S.obj.x - pj.x); e.x = pj.x + Math.cos(a) * 120; e.z = pj.z + Math.sin(a) * 120; }
    log(S, 'Aquí no hay nada… unas pintas militares en la pared señalan otra dirección.', '', true);
  }
  if (S.revelada && !S.evac && d < 7) { S.evac = { resta: 90, total: 90 }; S.tHorda = 5; ruido(S, pj.x, pj.z, 90); log(S, 'Disparas la bengala. ¡El helicóptero viene! Aguanta 1 h y media en la zona.', 'logro', true); }
  if (S.evac) { if (d < 26) S.evac.resta -= dt; if (S.evac.resta <= 0) fin(S, 'escape', `¡${pj.nombre} subió al helicóptero${S.grupo.length ? ' con ' + S.grupo.map((g) => g.nombre).join(' y ') : ''}! Escapó de la ciudad.`); }
}

// ---------------------------------------------------------------- la IA: qué haría el personaje según sus rasgos
const NECESIDAD = { comida: ['supermercado', 'tienda', 'casa', 'edificio', 'gasolinera'], medicina: ['farmacia', 'hospital', 'casa', 'edificio'], arma: ['comisaria', 'ferreteria', 'casa', 'edificio'], antiviral: ['farmacia', 'hospital'], tablas: ['ferreteria', 'casa', 'edificio'] };
function autoConsumir(S) {
  const pj = S.pj, inv = pj.inv;
  if (pj.inf && inv.antiviral) return usar(S, 'antiviral');
  if (pj.salud < 45 && (inv.botiquin || inv.vendaje)) return usar(S, inv.botiquin && pj.salud < 30 ? 'botiquin' : inv.vendaje ? 'vendaje' : 'botiquin');
  if (pj.salud < 70 && pj.animo < 35 && inv.analgesico) return usar(S, 'analgesico');
  if (pj.hambre < 45 && inv.comida) return usar(S, 'comida');
  if (pj.sed < 50 && inv.agua) return usar(S, 'agua');
  for (const g of S.grupo) { if (g.inf && inv.antiviral && !pj.inf && (tiene(S, 'medico') || inv.antiviral > 1 || g.lealtad > 50)) return usar(S, 'antiviral', g.id); if (g.salud < 40 && inv.vendaje > 1) return usar(S, 'vendaje', g.id); }
}
function ia(S, noche) {
  const pj = S.pj; if (S.fin) return;
  autoConsumir(S);
  const amen = [], ar = armaActiva(S);
  for (const z of S.zs) { if (z.est === 'muerto') continue; const d = hyp(z.x - pj.x, z.z - pj.z); if (d < 4.5 || (z.est === 'persigue' && z.obj === 'pj' && d < 16)) amen.push({ z, d }); } // a los que no lo han visto, mejor pasarlos de largo
  if (pj.accion && (pj.accion.tipo === 'esconde' || pj.accion.tipo === 'duerme')) { // asedio: con sed, hambre o la barricada cediendo, toca salir a la fuerza
    const r = S.ref[pj.accion.k], larga = pj.accion.tipo === 'esconde' && pj.accion.t > 150;
    if (larga || pj.sed < 22 || pj.hambre < 18 || (r && r.hp < 70 && amen.length)) { if (pj.accion.tipo === 'duerme') despertar(S, ''); pj.accion = null; pj.cola = []; pj.dentro = null; pj.tEsc = S.t; log(S, `${pj.nombre} decide salir del encierro.`, '', true); if (amen.length) return pelearOHuir(S, amen, ar); return; }
  }
  if (pj.accion) { if (pj.accion.tipo === 'duerme' || pj.accion.tipo === 'esconde' || S.ref[pj.accion.k] || !amen.some((a) => a.d < 4)) return; pj.accion = null; pj.cola = []; pj.dentro = null; }
  if (amen.length) return pelearOHuir(S, amen, ar);
  if (pj.plan?.motivo === 'huye') pj.plan = null;
  if (S.evac) { if (hyp(S.obj.x - pj.x, S.obj.z - pj.z) > 5 && !pj.plan) irA(S, S.obj.x, S.obj.z, { motivo: 'evac' }); return; }
  if (pj.plan && ['saquea', 'refugio', 'esconde'].includes(pj.plan.motivo)) return;
  // de noche o agotado: a un refugio
  if ((noche && pj.energia < 85) || pj.energia < 22) {
    const ref = edificiosCerca(S.sem, pj.x, pj.z, 70).find(({ e }) => S.ref[e.k]) || edificiosCerca(S.sem, pj.x, pj.z, 45).find(({ e }) => !['hospital', 'supermercado'].includes(e.tipo));
    if (ref) { const r = irA(S, ref.e.px, ref.e.pz, { al: { tipo: 'refugio', k: ref.e.k, barricar: true }, motivo: 'refugio' }); return void r; }
  }
  // abastecerse según lo que falte (más lejos si es urgente)
  const inv = pj.inv, falta = [];
  if (pj.inf && !inv.antiviral) falta.push(['antiviral', 140]);
  if ((inv.comida || 0) + (inv.agua || 0) < 3 || pj.hambre < 40 || pj.sed < 40) falta.push(['comida', pj.hambre < 25 || pj.sed < 25 ? 90 : 45]);
  if (!pj.armas.some((a) => !ARMAS[a.id].mun && a.dur > 8)) falta.push(['arma', pj.armas.length ? 40 : 70]);
  if (!inv.vendaje && !inv.botiquin) falta.push(['medicina', 35]);
  if (!inv.tablas && !tiene(S, 'mecanico') && diaDe(S) >= 1 && horaDe(S) > 15) falta.push(['tablas', 30]);
  const carga = cargaDe(S) < pj.cap;
  for (const [nec, rad] of falta) {
    const e = edificiosCerca(S.sem, pj.x, pj.z, rad).find(({ e }) => !S.saq[e.k] && NECESIDAD[nec].includes(e.tipo));
    if (e && carga) { irA(S, e.e.px, e.e.pz, { al: { tipo: 'saquear', k: e.e.k }, motivo: 'saquea' }); return; }
  }
  // de paso: revisar lo que quede muy a mano
  if (carga && cargaDe(S) < pj.cap - 3) { const e = edificiosCerca(S.sem, pj.x, pj.z, 12).find(({ e }) => !S.saq[e.k] && e.tipo !== 'hospital'); if (e) { irA(S, e.e.px, e.e.pz, { al: { tipo: 'saquear', k: e.e.k }, motivo: 'saquea' }); return; } }
  // y si no, avanzar hacia la evacuación por las calles
  if (!pj.plan || pj.plan.motivo !== 'viaje' || pj.plan.idx >= pj.plan.ruta.length || S.t - pj.plan.t0 > 40) planViaje(S);
}
function planViaje(S) {
  const pj = S.pj, e = S.revelada ? S.obj : S.est, dx = e.x - pj.x, dz = e.z - pj.z, d = hyp(dx, dz) || 1;
  for (let k = 0; k < 6; k++) {
    let tx, tz;
    if (S.revelada && d < 45) { tx = S.obj.x; tz = S.obj.z; }
    else {
      const a = Math.atan2(dz, dx) + (k ? (rnd(S) - 0.5) * k * 0.8 : 0), l = Math.min(42, d);
      tx = pj.x + Math.cos(a) * l; tz = pj.z + Math.sin(a) * l;
      const sx = Math.round(tx / P) * P, sz = Math.round(tz / P) * P; if (Math.abs(tx - sx) < Math.abs(tz - sz)) tx = sx; else tz = sz; // a la calle más cercana
    }
    const ruta = buscarRuta(S.sem, pj.x, pj.z, tx, tz);
    if (ruta) { pj.plan = { ruta, idx: 0, correr: false, al: null, motivo: 'viaje', t0: S.t }; return; }
  }
  pj.plan = null;
}
function pelearOHuir(S, amen, ar) {
  const pj = S.pj;
  const peligro = amen.reduce((s, { z, d }) => s + (z.hp / 45) * (z.tipo === 'gordo' ? 1.3 : z.tipo === 'corredor' ? 1.25 : 1) * (d < 4 ? 1.2 : 0.8), 0);
  // elegir arma: de fuego si el grupo es grande (y hay munición); cuerpo a cuerpo para pocos (ahorra balas y no hace ruido)
  const fuegoIdx = pj.armas.findIndex((a) => ARMAS[a.id].mun && pj.inv[ARMAS[a.id].mun] > 0), meleeIdx = pj.armas.reduce((m, a, k) => (!ARMAS[a.id].mun && (m < 0 || ARMAS[a.id].dmg / ARMAS[a.id].cd > ARMAS[pj.armas[m].id].dmg / ARMAS[pj.armas[m].id].cd) ? k : m), -1);
  if (fuegoIdx >= 0 && (peligro > 2.2 || meleeIdx < 0)) pj.eq = fuegoIdx; else if (meleeIdx >= 0) pj.eq = meleeIdx;
  const a2 = armaActiva(S), dps = a2.def.dmg / a2.def.cd * (!a2.def.mun && tiene(S, 'fuerte') ? 1.4 : 1);
  const coraje = tiene(S, 'valiente') ? 1.5 : tiene(S, 'cobarde') ? 0.55 : 1;
  const capacidad = (dps / 20) * (0.3 + pj.salud / 100) * coraje * (1 + S.grupo.length * 0.6) * (pj.energia < 15 ? 0.7 : 1) * (pj.animo < 20 ? 0.8 : 1);
  const puedeHuir = pj.energia > 6 || !amen.some(({ z }) => z.tipo === 'corredor');
  let pelear = peligro <= capacidad * 2 || !puedeHuir;
  if (pj.tactica && S.t - pj.tactica.t < 4) pelear = pj.tactica.modo === 'pelea' || !puedeHuir; // no cambiar de idea cada medio segundo
  else pj.tactica = { modo: pelear ? 'pelea' : 'huye', t: S.t };
  if (S.evac && pj.salud > 15 && hyp(S.obj.x - pj.x, S.obj.z - pj.z) < 20) pelear = true; // en la zona se aguanta: irse para el conteo
  if (pelear) { // pelear: al más cercano
    const c = amen.reduce((m, a) => (a.d < m.d ? a : m)).z;
    if (a2.def.mun) { const d = hyp(c.x - pj.x, c.z - pj.z); if (d > a2.def.alc * 0.8 || !lineaLibre(S.sem, pj.x, pj.z, c.x, c.z, 0)) pj.plan = { ruta: [[c.x, c.z]], idx: 0, correr: false, al: null, motivo: 'pelea', t0: S.t }; else if (d < 2.5 && meleeIdx >= 0 && peligro < 3) pj.eq = meleeIdx; else pj.plan = null; }
    else pj.plan = { ruta: [[c.x, c.z]], idx: 0, correr: false, al: { tipo: 'atacar', id: c.id }, motivo: 'pelea', t0: S.t };
    return;
  }
  // huir: lejos del centro de la amenaza, con algo de rumbo hacia la evacuación
  if ((pj.plan?.motivo === 'huye' || pj.plan?.motivo === 'esconde') && pj.plan.idx < pj.plan.ruta.length && S.t - pj.plan.t0 < 6) return;
  // de noche, cansado, sigiloso o ante muchos: mejor meterse en un edificio que correr a campo abierto
  if ((esNoche(horaDe(S)) || pj.energia < 40 || tiene(S, 'sigiloso') || amen.length >= 4) && S.t - (pj.tEsc ?? -999) > 90) {
    const esc = edificiosCerca(S.sem, pj.x, pj.z, 14).find(({ e }) => amen.every(({ z }) => hyp(z.x - e.px, z.z - e.pz) > 4.5));
    if (esc) { irA(S, esc.e.px, esc.e.pz, { al: { tipo: 'esconde', k: esc.e.k, barricar: true }, motivo: 'esconde', correr: pj.energia > 4 }); return; }
  }
  let cx = 0, cz = 0; for (const { z } of amen) { cx += z.x; cz += z.z; } cx /= amen.length; cz /= amen.length;
  const urge = amen.some(({ z, d }) => z.tipo === 'corredor' || d < 3.5); // de los lentos basta con alejarse caminando
  const base = Math.atan2(pj.z - cz, pj.x - cx), meta = Math.atan2(S.est.z - pj.z, S.est.x - pj.x);
  const dif = ((meta - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI, a0 = base + dif * 0.3;
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const a = a0 + off, tx = pj.x + Math.cos(a) * 16, tz = pj.z + Math.sin(a) * 16;
    if (!bloqueado(S.sem, tx, tz, 0.4) && lineaLibre(S.sem, pj.x, pj.z, tx, tz, 0.35)) { pj.plan = { ruta: [[tx, tz]], idx: 0, correr: pj.energia > 4 && urge, al: null, motivo: 'huye', t0: S.t }; if (tiene(S, 'cobarde') && rnd(S) < 0.1) log(S, `${pj.nombre} sale corriendo, muerto de miedo.`); return; }
  }
  const r = buscarRuta(S.sem, pj.x, pj.z, pj.x + Math.cos(a0) * 18, pj.z + Math.sin(a0) * 18);
  pj.plan = r ? { ruta: r, idx: 0, correr: pj.energia > 4 && urge, al: null, motivo: 'huye', t0: S.t } : null;
}

// ---------------------------------------------------------------- la ciudad viva: clima, radio, perros, cuervos y alarmas
const RADIO = ['📻 «…a todos los sobrevivientes: no se acerquen al hospital central, repito, no se acerquen…»', '📻 «…el último convoy sale cuando el humo verde esté encendido…»', '📻 Una voz cansada lee nombres de gente que llegó a la zona segura.', '📻 «…si los oyen de noche, no corran: escóndanse y barriquen…»', '📻 Música vieja, y luego estática.', '📻 «…helicópteros de evacuación cada pocas horas. Lleguen a la zona.»'];
const LEJOS = ['A lo lejos suena un disparo, y después nada.', 'Una sirena se enciende y se apaga en otra calle.', 'Se oye un vidrio romperse en algún piso alto.', 'Un helicóptero pasa muy alto, sin detenerse.', 'Alguien grita lejos. Luego, gemidos.', 'El viento arrastra papeles por la avenida vacía.', 'Una luz parpadea en una ventana y se apaga.'];
function ambiente(S, dt) {
  const pj = S.pj, c = S.clima;
  // clima: chubascos de vez en cuando; con lluvia los zombis oyen y ven menos
  c.t -= dt; if (c.t <= 0) { c.t = 120 + rnd(S) * 300; const antes = c.meta; c.meta = rnd(S) < 0.22 ? 0.6 + rnd(S) * 0.4 : 0; if (c.meta && !antes) { log(S, '🌧️ Empieza a llover. La lluvia tapa tus pasos.'); c.agua = false; } else if (!c.meta && antes) log(S, 'Deja de llover.'); }
  c.lluvia += (c.meta - c.lluvia) * Math.min(1, dt / 20);
  if (c.lluvia > 0.5 && !c.agua && (pj.accion || pj.vel < 0.1) && cargaDe(S) < pj.cap) { c.agua = true; pj.inv.agua = (pj.inv.agua || 0) + 1; log(S, '💧 Recoges agua de lluvia en una botella.', 'bueno'); }
  // radio y sonidos lejanos: la ciudad sigue pasando aunque no la veas
  S.tFrase -= dt; if (S.tFrase <= 0) { S.tFrase = 150 + rnd(S) * 200; if (pj.inv.radio && rnd(S) < 0.6) log(S, pick(S, RADIO), '', true); else log(S, pick(S, LEJOS)); }
  S.tAmb -= dt; if (S.tAmb > 0) return; S.tAmb = 0.5;
  // alarmas de autos: si pasas pegado a uno con alarma, chilla media hora y llama a todo lo que oiga
  const ci = Math.floor(pj.x / P), cj = Math.floor(pj.z / P), roce = tiene(S, 'sigiloso') ? 1.4 : 2.1;
  if (!pj.dentro) for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) celda(S.sem, i, j).props.forEach((p, n) => {
    if (p.t !== 'auto' || !p.alarma) return; const k = `${i},${j},${n}`; if (S.alarmas[k]) return;
    if (hyp(p.x - pj.x, p.z - pj.z) < roce + 1.2) { S.alarmas[k] = { x: p.x, z: p.z, t: S.t }; log(S, '🚨 ¡Rozaste un auto y saltó la alarma! Todo lo que oiga viene para acá.', 'malo', true); }
  });
  for (const a of Object.values(S.alarmas)) if (S.t - a.t < 30 && hyp(a.x - pj.x, a.z - pj.z) < 140) ruido(S, a.x, a.z, 38);
  // animales
  S.anim = S.anim.filter((a) => a.est !== 'fuera' && hyp(a.x - pj.x, a.z - pj.z) < 95);
  for (const a of S.anim) {
    const dp = hyp(a.x - pj.x, a.z - pj.z);
    if (a.t === 'cuervos') {
      if (a.est === 'suelo') {
        let susto = dp < (tiene(S, 'sigiloso') ? 4 : 7); for (const z of S.zs) if (!susto && z.est !== 'muerto' && hyp(z.x - a.x, z.z - a.z) < 3) susto = true;
        if (susto) { a.est = 'vuela'; a.tE = 0; ruido(S, a.x, a.z, 11); if (dp < 12) log(S, 'Una bandada de cuervos alza el vuelo graznando… y delata dónde estás.'); }
      } else { a.tE += 0.5; a.y = a.tE * 3; a.x += Math.cos(a.dir) * 2; a.z += Math.sin(a.dir) * 2; if (a.tE > 8) a.est = 'fuera'; }
      continue;
    }
    // perro callejero: vaga, huye de los zombis, te ladra al verte (ruido) y a veces te sigue y gruñe cuando algo se acerca
    let zc = null, zd = 9; for (const z of S.zs) { if (z.est === 'muerto') continue; const d = hyp(z.x - a.x, z.z - a.z); if (d < zd) { zd = d; zc = z; } }
    if (!a.ladro && dp < 9 && !pj.dentro) {
      a.ladro = true; ruido(S, a.x, a.z, 16); const amigo = rnd(S) < 0.45 || (pj.inv.comida || 0) > 2; a.est = amigo ? 'sigue' : 'vaga';
      log(S, amigo ? '🐕 Un perro callejero te ladra, mueve la cola y empieza a seguirte.' : '🐕 Un perro flaco te ladra desde lejos y se va.', amigo ? 'bueno' : '', amigo); if (amigo) pj.animo = clamp(pj.animo + 6);
    }
    let tx = a.x, tz = a.z, v = 1.2;
    if (zc && zd < 6) { tx = a.x + (a.x - zc.x) * 3; tz = a.z + (a.z - zc.z) * 3; v = 4.5; if (a.est === 'sigue' && rnd(S) < 0.15) { ruido(S, a.x, a.z, 8); if (rnd(S) < 0.3) log(S, '🐕 El perro gruñe hacia la calle: algo se acerca.'); } }
    else if (a.est === 'sigue') { if (dp > 3) { tx = pj.x - Math.sin(pj.dir) * 2; tz = pj.z - Math.cos(pj.dir) * 2; v = Math.max(1.8, pj.vel * 1.15); } if (dp > 50) a.est = 'vaga'; }
    else { a.tE -= 0.5; if (a.tE <= 0) { a.tE = 3 + rnd(S) * 6; a.rumbo = rnd(S) * 6.28; } tx = a.x + Math.cos(a.rumbo || 0) * 3; tz = a.z + Math.sin(a.rumbo || 0) * 3; }
    const dx = tx - a.x, dz = tz - a.z, d = hyp(dx, dz);
    if (d > 0.3) { const m = moverCon(S.sem, a, dx / d * Math.min(v * 0.5, d), dz / d * Math.min(v * 0.5, d), 0.25); a.vel = m / 0.5; if (m > 0.01) a.dir = Math.atan2(dx, dz); } else a.vel = 0;
    if (zc && zd < 1 && rnd(S) < 0.08) { a.est = 'fuera'; log(S, '🐕 Los zombis alcanzaron al perro. Se oye un aullido corto.', 'malo'); pj.animo = clamp(pj.animo - 5); }
  }
}
