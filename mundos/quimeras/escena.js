// =====================================================================
// Arena de quimeras: el coliseo dentro del orbe, el público y las criaturas armadas por partes.
// Cada quimera son pocas mallas fundidas (torso, cabeza, cola, 2 alas y sus patas) para no pasar de ~15 llamadas de dibujo.
// La escena no decide nada: copia lo que dice la simulación y lo vuelve movimiento.
// =====================================================================
import { THREE, fundir, fundirGeo, GEO, MAT_VERTICE, angLerp } from '../motor/orbe3d.js';
import { ANIMALES, parte, ARENA } from './sim.js';

const { esfera: E, esferaFina: EF, caja: C, cono: K, cil: Y, capsula: P } = GEO;
const H = Math.PI / 2, NEG = 0x141210, BL = 0xf4efe2, HUESO = 0xe8dcc0, ROJO = 0xb8281e, AMA = 0xe8b830;
const col = (id, i = 0) => ANIMALES[id]?.c[i] ?? 0x888888;
const tono = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
const ojos = (x, y, z, s = 0.065, c = NEG) => [[E, c, -x, y, z, s, s, s], [E, c, x, y, z, s, s, s]];
// un «palo» (cápsula o cono) de un punto a otro: patas articuladas, colas curvas, astas, dedos de ala
const _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3();
function palo(c, a, b, t, geo = P) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _v.length() || 0.01; _q.setFromUnitVectors(_Y, _v.normalize()); _eu.setFromQuaternion(_q);
  const k = geo === P ? 1 : 0.5;
  return [geo, c, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t * k, geo === P ? L / 2 : L, t * k, _eu.x, _eu.y, _eu.z];
}

// ---------------------------------------------------------------- cabezas (origen en el cuello, mirando a +z)
const CABEZAS = {
  leon: (a) => [[EF, a, 0, 0.15, 0.3, 0.42, 0.4, 0.42], [EF, tono(a, 1.25), 0, 0.03, 0.64, 0.24, 0.2, 0.24], [E, NEG, 0, 0.12, 0.86, 0.07, 0.05, 0.05], ...ojos(0.16, 0.3, 0.62), [E, a, -0.3, 0.5, 0.22, 0.1, 0.12, 0.06], [E, a, 0.3, 0.5, 0.22, 0.1, 0.12, 0.06]],
  aguila: (a, b) => [[EF, b, 0, 0.2, 0.3, 0.38, 0.4, 0.42], [K, AMA, 0, 0.12, 0.82, 0.13, 0.4, 0.13, H + 0.25], [E, AMA, 0, 0.0, 0.92, 0.06, 0.06, 0.06], ...ojos(0.2, 0.3, 0.56, 0.06, 0x2a1a08), [E, a, 0, 0.0, 0.0, 0.32, 0.3, 0.3]],
  toro: (a, b) => [[C, a, 0, 0.12, 0.42, 0.56, 0.52, 0.74], [C, tono(a, 1.4), 0, -0.02, 0.86, 0.46, 0.36, 0.2], [E, NEG, -0.1, 0.0, 0.97, 0.04, 0.04, 0.03], [E, NEG, 0.1, 0.0, 0.97, 0.04, 0.04, 0.03], ...ojos(0.29, 0.28, 0.6), [K, b, -0.36, 0.42, 0.34, 0.06, 0.28, 0.06, 0, 0, 1.1], [K, b, 0.36, 0.42, 0.34, 0.06, 0.28, 0.06, 0, 0, -1.1], [E, a, -0.36, 0.25, 0.3, 0.15, 0.06, 0.1], [E, a, 0.36, 0.25, 0.3, 0.15, 0.06, 0.1]],
  serpiente: (a, b) => [[EF, a, 0, 0.05, 0.42, 0.34, 0.2, 0.52], [EF, b, 0, -0.05, 0.42, 0.28, 0.12, 0.46], ...ojos(0.2, 0.16, 0.6, 0.06, AMA), [C, ROJO, 0, -0.02, 1.02, 0.03, 0.02, 0.32], [C, ROJO, -0.04, -0.02, 1.2, 0.02, 0.02, 0.1, 0, 0.5], [C, ROJO, 0.04, -0.02, 1.2, 0.02, 0.02, 0.1, 0, -0.5]],
  lobo: (a, b) => [[EF, a, 0, 0.16, 0.26, 0.36, 0.34, 0.38], [C, a, 0, 0.06, 0.7, 0.24, 0.22, 0.5], [C, b, 0, -0.04, 0.68, 0.22, 0.1, 0.48], [E, NEG, 0, 0.14, 0.96, 0.06, 0.05, 0.05], ...ojos(0.14, 0.28, 0.5, 0.05, 0xd8a020), [K, a, -0.2, 0.55, 0.2, 0.1, 0.32, 0.07], [K, a, 0.2, 0.55, 0.2, 0.1, 0.32, 0.07]],
  oso: (a, b) => [[EF, a, 0, 0.16, 0.3, 0.48, 0.44, 0.46], [EF, tono(a, 1.35), 0, 0.03, 0.72, 0.24, 0.2, 0.22], [E, NEG, 0, 0.1, 0.92, 0.08, 0.06, 0.05], ...ojos(0.2, 0.3, 0.68), [E, a, -0.34, 0.54, 0.2, 0.13, 0.13, 0.07], [E, a, 0.34, 0.54, 0.2, 0.13, 0.13, 0.07]],
  escorpion: (a, b) => [[EF, a, 0, 0.05, 0.36, 0.42, 0.2, 0.42], ...ojos(0.08, 0.2, 0.6, 0.05, 0x55e0ff), ...ojos(0.2, 0.17, 0.52, 0.04, NEG), [K, b, -0.12, -0.08, 0.76, 0.06, 0.28, 0.06, H], [K, b, 0.12, -0.08, 0.76, 0.06, 0.28, 0.06, H]],
  murcielago: (a, b) => [[EF, a, 0, 0.15, 0.3, 0.32, 0.3, 0.32], [K, a, -0.22, 0.6, 0.24, 0.13, 0.5, 0.06, 0, 0, 0.3], [K, a, 0.22, 0.6, 0.24, 0.13, 0.5, 0.06, 0, 0, -0.3], [K, b, -0.22, 0.58, 0.27, 0.07, 0.36, 0.03, 0, 0, 0.3], [K, b, 0.22, 0.58, 0.27, 0.07, 0.36, 0.03, 0, 0, -0.3], [E, b, 0, 0.1, 0.6, 0.12, 0.1, 0.1], ...ojos(0.13, 0.24, 0.55, 0.05, ROJO), [K, BL, -0.06, -0.06, 0.58, 0.025, 0.12, 0.025, Math.PI], [K, BL, 0.06, -0.06, 0.58, 0.025, 0.12, 0.025, Math.PI]],
  cocodrilo: (a, b) => [[C, a, 0, 0.12, 0.62, 0.44, 0.2, 1.2], [C, b, 0, -0.04, 0.6, 0.4, 0.12, 1.1], [C, BL, 0, 0.03, 0.62, 0.42, 0.04, 1.08], [E, a, -0.14, 0.28, 0.24, 0.1, 0.08, 0.1], [E, a, 0.14, 0.28, 0.24, 0.1, 0.08, 0.1], ...ojos(0.14, 0.32, 0.27, 0.05, AMA), [E, a, 0, 0.14, 1.2, 0.12, 0.08, 0.08]],
  tiburon: (a, b) => [[EF, a, 0, 0.12, 0.45, 0.42, 0.36, 0.72], [EF, b, 0, -0.04, 0.48, 0.36, 0.22, 0.62], [C, NEG, 0, -0.06, 0.82, 0.3, 0.06, 0.12], [C, BL, 0, -0.02, 0.84, 0.3, 0.03, 0.1], ...ojos(0.3, 0.2, 0.62, 0.05)],
  rinoceronte: (a, b) => [[C, a, 0, 0.12, 0.45, 0.5, 0.46, 0.84], [C, b, 0, 0.0, 0.86, 0.38, 0.3, 0.22], [K, HUESO, 0, 0.42, 0.78, 0.12, 0.6, 0.12, -0.3], [K, HUESO, 0, 0.42, 0.5, 0.08, 0.28, 0.08, -0.2], ...ojos(0.26, 0.22, 0.56, 0.04), [K, a, -0.22, 0.5, 0.1, 0.07, 0.22, 0.05], [K, a, 0.22, 0.5, 0.1, 0.07, 0.22, 0.05]],
  arana: (a, b) => [[EF, a, 0, 0.08, 0.32, 0.36, 0.3, 0.38], ...ojos(0.08, 0.3, 0.62, 0.06, ROJO), ...ojos(0.2, 0.26, 0.56, 0.045, ROJO), ...ojos(0.12, 0.16, 0.66, 0.04, NEG), [K, b, -0.1, -0.2, 0.62, 0.06, 0.3, 0.06, Math.PI - 0.4], [K, b, 0.1, -0.2, 0.62, 0.06, 0.3, 0.06, Math.PI - 0.4]],
  mantis: (a, b) => [[K, a, 0, 0.1, 0.4, 0.32, 0.5, 0.18, Math.PI], [E, b, -0.28, 0.28, 0.42, 0.13, 0.15, 0.13], [E, b, 0.28, 0.28, 0.42, 0.13, 0.15, 0.13], palo(a, [-0.06, 0.32, 0.45], [-0.3, 0.9, 0.8], 0.025, Y), palo(a, [0.06, 0.32, 0.45], [0.3, 0.9, 0.8], 0.025, Y), [E, tono(a, 0.6), 0, -0.14, 0.42, 0.08, 0.06, 0.06]],
  gorila: (a, b) => [[EF, a, 0, 0.2, 0.28, 0.44, 0.44, 0.42], [EF, b, 0, 0.12, 0.58, 0.3, 0.28, 0.16], [C, a, 0, 0.36, 0.56, 0.42, 0.1, 0.14], ...ojos(0.12, 0.26, 0.68, 0.045), [E, NEG, 0, 0.1, 0.74, 0.08, 0.04, 0.03], [EF, a, 0, 0.5, 0.1, 0.3, 0.2, 0.3]],
  pulpo: (a, b) => [[EF, a, 0, 0.45, 0.1, 0.42, 0.62, 0.44, -0.4], [E, tono(a, 1.25), 0, 0.68, -0.05, 0.08, 0.08, 0.08], [E, b, -0.2, 0.75, 0.15, 0.06, 0.06, 0.06], ...ojos(0.3, 0.2, 0.36, 0.1, AMA), ...ojos(0.32, 0.2, 0.42, 0.05, NEG), ...[-0.2, -0.07, 0.07, 0.2].map((x) => [K, a, x, -0.12, 0.42, 0.06, 0.32, 0.06, Math.PI])],
  ciervo: (a, b) => [[EF, a, 0, 0.18, 0.28, 0.28, 0.3, 0.32], [C, a, 0, 0.08, 0.62, 0.22, 0.22, 0.44], [E, NEG, 0, 0.1, 0.86, 0.07, 0.06, 0.05], [E, b, 0, 0.0, 0.66, 0.15, 0.08, 0.3], ...ojos(0.17, 0.3, 0.42, 0.05), [EF, a, -0.32, 0.4, 0.15, 0.2, 0.08, 0.06, 0, 0, 0.4], [EF, a, 0.32, 0.4, 0.15, 0.2, 0.08, 0.06, 0, 0, -0.4], palo(HUESO, [-0.12, 0.42, 0.22], [-0.2, 0.62, 0.18], 0.05), palo(HUESO, [0.12, 0.42, 0.22], [0.2, 0.62, 0.18], 0.05)],
  tortuga: (a, b) => [[EF, a, 0, 0.1, 0.36, 0.3, 0.28, 0.42], [K, tono(b, 0.6), 0, 0.04, 0.78, 0.12, 0.16, 0.08, H + 0.4], ...ojos(0.2, 0.22, 0.58, 0.05), [P, a, 0, 0.02, 0.02, 0.36, 0.25, 0.34, H]],
  buho: (a, b) => [[EF, a, 0, 0.25, 0.25, 0.5, 0.46, 0.44], [EF, b, -0.18, 0.24, 0.52, 0.2, 0.22, 0.12], [EF, b, 0.18, 0.24, 0.52, 0.2, 0.22, 0.12], ...ojos(0.18, 0.26, 0.62, 0.11, AMA), ...ojos(0.18, 0.26, 0.7, 0.06, NEG), [K, 0x3a3020, 0, 0.1, 0.66, 0.06, 0.16, 0.06, Math.PI], [K, a, -0.3, 0.72, 0.18, 0.08, 0.28, 0.06, 0, 0, 0.35], [K, a, 0.3, 0.72, 0.18, 0.08, 0.28, 0.06, 0, 0, -0.35]],
};
// extras que se montan en la cabeza
const EXTRA_CAB = {
  cuernos: () => [palo(HUESO, [-0.3, 0.42, 0.34], [-0.75, 0.6, 0.45], 0.14), palo(HUESO, [-0.75, 0.6, 0.45], [-0.82, 0.95, 0.7], 0.09, K), palo(HUESO, [0.3, 0.42, 0.34], [0.75, 0.6, 0.45], 0.14), palo(HUESO, [0.75, 0.6, 0.45], [0.82, 0.95, 0.7], 0.09, K)],
  cuernoRino: () => [palo(HUESO, [0, 0.35, 0.8], [0, 1.0, 1.15], 0.3, K)],
  astas: () => { const a = 0x8a6a48, out = []; for (const s of [-1, 1]) { out.push(palo(a, [s * 0.14, 0.42, 0.2], [s * 0.45, 0.95, 0.05], 0.07), palo(a, [s * 0.45, 0.95, 0.05], [s * 0.8, 1.35, -0.1], 0.05), palo(a, [s * 0.3, 0.72, 0.13], [s * 0.3, 1.1, 0.35], 0.045), palo(a, [s * 0.62, 1.15, -0.02], [s * 0.6, 1.5, 0.2], 0.04), palo(a, [s * 0.5, 1.05, 0.0], [s * 0.85, 1.05, 0.25], 0.04)); } return out; },
  melena: () => { const c = 0x7a3e16, out = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; out.push([EF, i % 2 ? c : tono(c, 1.3), Math.cos(a) * 0.48, 0.2 + Math.sin(a) * 0.48, 0.12, 0.26, 0.26, 0.22]); } out.push([EF, c, 0, 0.2, -0.05, 0.55, 0.55, 0.3]); return out; },
};

// ---------------------------------------------------------------- torsos: [largo, alto, ancho]
const TORSO_DIM = { leon: [2.0, 1.0, 0.95], aguila: [1.4, 1.05, 0.95], toro: [2.3, 1.3, 1.2], serpiente: [2.6, 0.6, 0.6], lobo: [1.9, 0.85, 0.75], oso: [2.1, 1.3, 1.2], escorpion: [1.9, 0.6, 1.05], murcielago: [1.2, 0.95, 0.8], cocodrilo: [2.4, 0.6, 1.0], tiburon: [2.3, 1.0, 0.9], rinoceronte: [2.4, 1.3, 1.25], arana: [1.7, 1.0, 1.1], mantis: [2.0, 0.5, 0.5], gorila: [1.7, 1.35, 1.25], pulpo: [1.3, 1.3, 1.2], ciervo: [1.9, 0.85, 0.7], tortuga: [1.8, 0.9, 1.4], buho: [1.2, 1.25, 1.0] };
function torsoPartes(id, l, h, w) {
  const a = col(id), b = col(id, 1), base = [[P, a, 0, 0, 0, w, l / 2, h, H], [P, b, 0, -h * 0.16, 0.05, w * 0.82, l * 0.4, h * 0.72, H]];
  switch (id) {
    case 'toro': return [...base, [EF, a, 0, h * 0.35, l * 0.22, w * 0.42, h * 0.32, l * 0.22]];
    case 'aguila': case 'buho': case 'murcielago': return [[EF, a, 0, 0, 0, w / 2, h / 2, l / 2], [EF, b, 0, -0.04, l * 0.2, w * 0.38, h * 0.4, l * 0.32], ...(id === 'buho' ? [0, 1, 2].map((i) => [E, tono(a, 0.7), (i - 1) * 0.18, -0.1, l * 0.48, 0.05, 0.04, 0.02]) : [])];
    case 'serpiente': return [0, 1, 2, 3].flatMap((i) => [[EF, i % 2 ? tono(a, 0.85) : a, 0, 0, l * (0.38 - i * 0.25), w * 0.5, h * 0.5, l * 0.17], [EF, b, 0, -h * 0.18, l * (0.38 - i * 0.25), w * 0.4, h * 0.34, l * 0.15], [E, tono(a, 0.55), 0, h * 0.4, l * (0.38 - i * 0.25), 0.1, 0.05, 0.12]]);
    case 'escorpion': return [0, 1, 2, 3].flatMap((i) => [[EF, i % 2 ? tono(a, 1.25) : a, 0, 0, l * (0.36 - i * 0.24), w * (0.52 - i * 0.04), h * 0.5, l * 0.16], [C, b, 0, h * 0.42, l * (0.36 - i * 0.24), w * 0.6, 0.04, 0.06]]);
    case 'tiburon': return [[EF, a, 0, 0, 0, w / 2, h / 2, l / 2], [EF, b, 0, -h * 0.17, 0.05, w * 0.42, h * 0.33, l * 0.45], [K, a, 0, h * 0.62, -0.05, 0.12, 0.75, 0.42, -0.45], [C, a, -w * 0.55, -h * 0.2, l * 0.15, 0.6, 0.05, 0.3, 0, 0.3, -0.3], [C, a, w * 0.55, -h * 0.2, l * 0.15, 0.6, 0.05, 0.3, 0, -0.3, 0.3], ...[0, 1, 2].map((i) => [C, tono(a, 0.6), w * 0.48, h * 0.05, l * (0.3 - i * 0.07), 0.02, 0.22, 0.03])];
    case 'arana': return [[EF, a, 0, 0, l * 0.22, w * 0.38, h * 0.32, l * 0.26], [EF, a, 0, h * 0.12, -l * 0.22, w * 0.55, h * 0.5, l * 0.36], [C, b, 0, h * 0.62, -l * 0.22, 0.14, 0.04, 0.32], [C, b, 0, h * 0.6, -l * 0.22, 0.28, 0.04, 0.1]];
    case 'tortuga': return [[P, a, 0, -h * 0.05, 0, w * 0.85, l / 2, h * 0.7, H], [EF, b, 0, h * 0.18, 0, w * 0.58, h * 0.55, l * 0.56], ...[[0, 0.5, 0], [-0.32, 0.4, 0.28], [0.32, 0.4, 0.28], [-0.32, 0.4, -0.28], [0.32, 0.4, -0.28], [0, 0.42, 0.5], [0, 0.42, -0.5]].map(([x, y, z]) => [E, tono(b, 1.4), x * w, h * y, z * l * 0.6, 0.18, 0.06, 0.18]), [C, tono(b, 0.8), 0, h * 0.0, 0, w * 1.14, 0.08, l * 0.9]];
    case 'pulpo': return [[EF, a, 0, h * 0.05, -0.05, w * 0.5, h * 0.55, l * 0.55], ...[[0.3, 0.3, 0.1], [-0.25, 0.4, -0.2], [0.1, 0.5, -0.3], [-0.35, 0.1, 0.2]].map(([x, y, z]) => [E, b, x * w, y * h, z * l, 0.08, 0.08, 0.08])];
    case 'gorila': return [...base, [EF, a, 0, h * 0.15, l * 0.2, w * 0.55, h * 0.48, l * 0.3], [EF, b, 0, h * 0.3, -l * 0.15, w * 0.4, h * 0.22, l * 0.3], [EF, tono(b, 0.7), 0, h * 0.0, l * 0.43, w * 0.32, h * 0.3, 0.12]];
    case 'cocodrilo': return [...base, ...[-0.3, -0.1, 0.1, 0.3].flatMap((z) => [[C, tono(a, 0.7), -0.16, h * 0.46, z * l, 0.12, 0.1, 0.18], [C, tono(a, 0.7), 0.16, h * 0.46, z * l, 0.12, 0.1, 0.18]])];
    case 'rinoceronte': return [...base, ...[-0.25, 0.05, 0.3].map((z) => [P, tono(a, 0.8), 0, 0, z * l, w * 1.03, 0.06, h * 1.03, H])];
    case 'mantis': return [[P, a, 0, 0, l * 0.2, w * 0.7, l * 0.25, h * 0.8, H], ...[0, 1, 2].map((i) => [EF, i % 2 ? b : a, 0, h * 0.05, -l * (0.12 + i * 0.16), w * (0.5 - i * 0.06), h * 0.55, l * 0.13])];
    case 'oso': return [...base, [EF, a, 0, h * 0.32, l * 0.2, w * 0.45, h * 0.3, l * 0.25]];
    case 'leon': case 'lobo': case 'ciervo': return [...base, [EF, b, 0, -h * 0.1, l * 0.38, w * 0.35, h * 0.36, l * 0.15]];
    default: return base;
  }
}
const EXTRA_TORSO = {
  caparazon: (l, h, w) => [[EF, 0x5a4428, 0, h * 0.3, 0, w * 0.62, h * 0.62, l * 0.5], ...[[0, 0.9, 0], [-0.4, 0.7, 0.3], [0.4, 0.7, 0.3], [-0.4, 0.7, -0.3], [0.4, 0.7, -0.3]].map(([x, y, z]) => [E, 0x8a6a38, x * w, h * y, z * l, 0.22, 0.07, 0.22])],
  puas: (l, h, w) => { const out = []; for (let i = 0; i < 14; i++) { const z = (i / 13 - 0.5) * l * 0.8, x = ((i % 3) - 1) * w * 0.25; out.push(palo(i % 2 ? 0xe8e0d0 : 0x4a3a2a, [x, h * 0.35, z], [x * 1.8, h * 0.35 + 0.75, z - 0.35], 0.09, K)); } return out; },
  pinzas: (l, h, w) => { const c = 0x2a2a30, out = []; for (const s of [-1, 1]) out.push(palo(c, [s * w * 0.4, -h * 0.1, l * 0.35], [s * w * 0.65, -h * 0.05, l * 0.75], 0.16), [EF, 0xb8642a, s * w * 0.65, -h * 0.02, l * 0.92, 0.22, 0.14, 0.3], [K, c, s * w * 0.55, -h * 0.02, l * 1.18, 0.07, 0.35, 0.05, H], [K, c, s * w * 0.75, -h * 0.02, l * 1.15, 0.06, 0.28, 0.05, H]); return out; },
  aleta: (l, h) => [[K, 0x6a7f92, 0, h * 0.62, -0.1, 0.1, 0.85, 0.45, -0.45]],
};

// ---------------------------------------------------------------- colas (origen en la grupa, hacia −z)
const COLAS = {
  leon: (a) => [palo(a, [0, 0, 0], [0, -0.3, -0.9], 0.1), palo(a, [0, -0.3, -0.9], [0, -0.2, -1.4], 0.08), [EF, 0x4a2a14, 0, -0.18, -1.48, 0.12, 0.12, 0.16]],
  toro: (a) => [palo(a, [0, 0, 0], [0, -0.6, -0.5], 0.09), [EF, NEG, 0, -0.72, -0.55, 0.1, 0.16, 0.1]],
  serpiente: (a, b) => [palo(a, [0, 0, 0], [0, -0.1, -0.8], 0.4), palo(a, [0, -0.1, -0.8], [0.15, -0.2, -1.5], 0.28), palo(b, [0.15, -0.2, -1.5], [0.05, -0.25, -2.1], 0.15)],
  lobo: (a, b) => [palo(a, [0, 0, 0], [0, -0.2, -0.8], 0.28), [EF, b, 0, -0.26, -0.95, 0.13, 0.13, 0.2]],
  escorpion: (a, b) => { const out = []; let ant = [0, 0, 0]; for (let i = 1; i <= 6; i++) { const t = i / 6 * 3.5, p = [0, 0.95 * (1 - Math.cos(t)), -0.95 * Math.sin(t)]; out.push([EF, i % 2 ? a : tono(a, 1.3), p[0], p[1], p[2], 0.22 - i * 0.015, 0.22 - i * 0.015, 0.22]); ant = p; } out.push([EF, b, ant[0], ant[1] + 0.05, ant[2] + 0.2, 0.18, 0.15, 0.2], palo(NEG, [ant[0], ant[1], ant[2] + 0.3], [0, ant[1] - 0.35, ant[2] + 0.55], 0.12, K)); return out; },
  cocodrilo: (a) => [palo(a, [0, 0, 0], [0, -0.15, -1.0], 0.55), palo(a, [0, -0.15, -1.0], [0, -0.3, -1.9], 0.32), palo(a, [0, -0.3, -1.9], [0, -0.38, -2.5], 0.14), ...[0.4, 1.0, 1.6].map((z) => [C, tono(a, 0.7), 0, 0.2 - z * 0.12, -z, 0.08, 0.12, 0.2])],
  tiburon: (a) => [palo(a, [0, 0, 0], [0, 0, -0.9], 0.4), [C, a, 0, 0.35, -1.1, 0.08, 0.8, 0.3, -0.6], [C, a, 0, -0.25, -1.05, 0.08, 0.55, 0.25, 0.7]],
  ciervo: (a, b) => [[EF, b, 0, 0.05, -0.1, 0.12, 0.16, 0.1]],
  oso: (a) => [[EF, a, 0, 0, -0.05, 0.14, 0.13, 0.12]],
};

// ---------------------------------------------------------------- alas (origen en el hombro; s = −1 izquierda, 1 derecha)
const ALAS = {
  aguila: (s, a, b) => [palo(a, [0, 0, 0], [s * 1.6, 0.05, 0.05], 0.14), [EF, a, s * 0.85, 0, -0.3, 0.9, 0.05, 0.45], ...[0, 1, 2, 3].map((i) => [C, tono(a, 0.65), s * (1.2 + i * 0.18), 0, -0.45 - i * 0.05, 0.16, 0.03, 0.8, 0, s * (0.15 - i * 0.12)])],
  murcielago: (s, a, b) => [palo(a, [0, 0, 0], [s * 0.8, 0.1, 0.1], 0.08), palo(a, [s * 0.8, 0.1, 0.1], [s * 1.9, 0.05, 0.25], 0.05), palo(a, [s * 0.8, 0.1, 0.1], [s * 1.7, 0, -0.45], 0.05), palo(a, [s * 0.8, 0.1, 0.1], [s * 1.1, 0, -0.85], 0.05), [EF, b, s * 1.0, 0, -0.25, 1.0, 0.03, 0.6], [K, HUESO, s * 0.82, 0.18, 0.12, 0.03, 0.12, 0.03]],
  buho: (s, a, b) => [palo(a, [0, 0, 0], [s * 1.3, 0.05, 0], 0.13), [EF, a, s * 0.8, 0, -0.32, 0.85, 0.06, 0.55], ...[0.4, 0.8, 1.2].map((x) => [E, b, s * x, 0.05, -0.4, 0.09, 0.03, 0.07])],
  mantis: (s, a, b) => [[EF, tono(b, 1.1), s * 0.25, 0, -0.75, 0.3, 0.02, 0.9, 0, s * 0.15], [EF, tono(a, 1.2), s * 0.35, -0.02, -0.6, 0.25, 0.02, 0.8, 0, s * 0.3]],
};

// ---------------------------------------------------------------- patas
function largoPata(p) { if (p.tipo === 'reptar') return 0; if (p.tipo === 'aracnido') return 0.75; if (p.tipo === 'tentaculos') return 0.75; return p.corto ? 0.55 : p.largo ? 1.35 : p.tipo === 'bipedo' ? 1.05 : 0.95; }
const GROSOR = { leon: 0.24, toro: 0.26, lobo: 0.17, oso: 0.32, cocodrilo: 0.24, ciervo: 0.12, rinoceronte: 0.36, tortuga: 0.3, aguila: 0.16, gorila: 0.28 };
function pataPartes(p, len, delantera, s) {
  const id = p.id, a = col(id), b = col(id, 1), t = GROSOR[id] || 0.2;
  if (p.tipo === 'cuadrupedo') {
    const pie = ['toro', 'ciervo', 'rinoceronte'].includes(id) ? [[Y, NEG, 0, -len + 0.06, 0.02, t * 0.55, 0.14, t * 0.6]] : ['leon', 'oso', 'lobo'].includes(id) ? [[EF, tono(a, 1.1), 0, -len + 0.06, 0.08, t * 0.62, 0.1, t * 0.8], ...[-1, 0, 1].map((k) => [K, BL, k * t * 0.3, -len + 0.06, t * 0.75 + 0.04, 0.03, 0.12, 0.03, H])] : [[EF, tono(a, 0.85), 0, -len + 0.05, 0.1, t * 0.7, 0.08, t * 0.9]];
    return [[P, a, 0, -len * 0.42, 0, t * 1.15, len * 0.4, t * 1.15], [P, tono(a, 0.9), 0, -len * 0.62, 0, t, len * 0.36, t], ...pie];
  }
  if (p.tipo === 'bipedo') return [[EF, a, 0, -0.25, 0, 0.22, 0.32, 0.22], palo(AMA, [0, -0.4, 0], [0, -len + 0.06, 0.05], 0.1), ...[-0.5, 0, 0.5].map((r) => palo(NEG, [0, -len + 0.06, 0.05], [Math.sin(r) * 0.28, -len + 0.03, 0.05 + Math.cos(r) * 0.28], 0.05, K)), palo(NEG, [0, -len + 0.06, 0], [0, -len + 0.03, -0.22], 0.05, K)];
  if (p.tipo === 'brazos') return delantera ? [palo(a, [0, 0, 0], [s * 0.15, -len * 0.5, 0.1], 0.32), palo(a, [s * 0.15, -len * 0.5, 0.1], [s * 0.05, -len + 0.12, 0.15], 0.28), [EF, b, s * 0.05, -len + 0.1, 0.18, 0.18, 0.12, 0.18]] : [palo(a, [0, 0, 0], [0, -len + 0.08, 0.05], 0.3), [C, b, 0, -len + 0.04, 0.12, 0.2, 0.08, 0.32]];
  if (p.tipo === 'aracnido') { const c = id === 'arana' ? a : tono(a, 1.2), rod = [s * 0.65, 0.35, 0], pie = [s * 1.05, -len, 0]; return [palo(c, [0, 0, 0], rod, 0.12), palo(c, rod, pie, 0.09), [E, b, rod[0], rod[1], 0, 0.08, 0.08, 0.08]]; }
  if (p.tipo === 'tentaculos') { const pts = [[0, 0, 0], [s * 0.3, -0.35, 0.1], [s * 0.6, -len + 0.08, 0.15], [s * 1.05, -len + 0.05, 0.05]], out = []; for (let i = 0; i < 3; i++) out.push(palo(i === 2 ? b : a, pts[i], pts[i + 1], 0.24 - i * 0.06)); out.push([E, b, s * 0.45, -len * 0.75, 0.22, 0.05, 0.05, 0.03], [E, b, s * 0.75, -len + 0.08, 0.15, 0.04, 0.03, 0.04]); return out; }
  if (p.tipo === 'mantis') { if (delantera) return [palo(a, [0, 0, 0], [0, 0.55, 0.35], 0.12), palo(b, [0, 0.55, 0.35], [0, 0.0, 0.7], 0.09), palo(tono(a, 1.2), [0, 0.0, 0.7], [0, 0.3, 0.98], 0.06, K)]; const rod = [s * 0.45, 0.2, 0]; return [palo(a, [0, 0, 0], rod, 0.08), palo(a, rod, [s * 0.7, -len, 0], 0.06)]; }
  return [];
}
function posPatas(p, l, h, w) {
  const yh = -h * 0.32;
  switch (p.tipo) {
    case 'cuadrupedo': return [[-1, yh, 1], [1, yh, 1], [-1, yh, -1], [1, yh, -1]].map(([s, y, f]) => ({ x: s * w * 0.33, y, z: f * l * 0.3, s, del: f > 0, fase: (s * f > 0 ? 0 : Math.PI) }));
    case 'bipedo': return [-1, 1].map((s) => ({ x: s * w * 0.28, y: yh, z: -l * 0.05, s, del: false, fase: s > 0 ? 0 : Math.PI }));
    case 'brazos': return [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([s, f]) => ({ x: s * w * (f > 0 ? 0.55 : 0.3), y: f > 0 ? h * 0.05 : yh, z: f * l * 0.3, s, del: f > 0, fase: (s * f > 0 ? 0 : Math.PI) }));
    case 'aracnido': { const n = p.n / 2, out = []; for (let i = 0; i < n; i++) for (const s of [-1, 1]) out.push({ x: s * w * 0.35, y: -h * 0.1, z: l * (0.3 - i / Math.max(1, n - 1) * 0.55), s, del: false, fase: i * 1.6 + (s > 0 ? Math.PI : 0), rotY: s * (0.5 - i / Math.max(1, n - 1)) * 0.9 }); return out; }
    case 'tentaculos': return [0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2 + 0.5; return { x: Math.cos(a) * w * 0.25, y: -h * 0.35, z: Math.sin(a) * l * 0.25, s: 1, del: false, fase: i * 1.1, rotY: -a }; });
    case 'mantis': return [[-1, 1, true], [1, 1, true], [-1, 0], [1, 0], [-1, -1], [1, -1]].map(([s, f, d]) => ({ x: s * w * 0.35, y: d ? 0 : yh * 0.4, z: f * l * 0.3, s, del: !!d, guadana: !!d, fase: (s + f) % 2 ? 0 : Math.PI }));
    default: return [];
  }
}

// ---------------------------------------------------------------- armar la quimera
export function crearModelo(cr) {
  const p = cr.partes, mat = MAT_VERTICE.clone(); mat.emissive = new THREE.Color(0);
  const fus = (partes) => (partes.length ? fundir(partes, mat) : null);
  const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo);
  const [l, h, w] = TORSO_DIM[p.torso], pat = parte('patas', p.patas), len = largoPata(pat);
  const y0 = pat.tipo === 'reptar' ? h * 0.5 : len + h * 0.32;
  const torso = new THREE.Group(); torso.position.y = y0; cuerpo.add(torso);
  const tp = torsoPartes(p.torso, l, h, w); if (EXTRA_TORSO[p.extra]) tp.push(...EXTRA_TORSO[p.extra](l, h, w));
  torso.add(fus(tp));
  const cab = new THREE.Group(); cab.position.set(0, h * 0.28, l * 0.42); torso.add(cab);
  const cp = CABEZAS[p.cabeza](col(p.cabeza), col(p.cabeza, 1)); if (EXTRA_CAB[p.extra]) cp.push(...EXTRA_CAB[p.extra]());
  cab.add(fus(cp));
  let cola = null; if (COLAS[p.cola]) { cola = new THREE.Group(); cola.position.set(0, h * 0.12, -l * 0.46); cola.add(fus(COLAS[p.cola](col(p.cola), col(p.cola, 1)))); torso.add(cola); }
  const alas = []; if (ALAS[p.alas]) for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * w * 0.32, h * 0.36, l * 0.12); a.add(fus(ALAS[p.alas](s, col(p.alas), col(p.alas, 1)))); a.userData.s = s; torso.add(a); alas.push(a); }
  const patas = posPatas(pat, l, h, w).map((d) => {
    const lg = pat.tipo === 'brazos' && d.del ? len + h * 0.37 : len, q = new THREE.Group(), m = new THREE.Group();
    q.position.set(d.x, d.y, d.z); if (d.rotY) q.rotation.y = d.rotY; q.add(m); m.add(fus(pataPartes(pat, lg, d.del, d.s))); torso.add(q);
    return { q: m, ...d };
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, cuerpo, torso, cab, cola, alas, patas, mat, tipo: pat.tipo, y0, h, l, w, alto: y0 + h * 0.6 + 0.9, cab0: cab.position.clone(), fase: Math.random() * 6, alt: 0, flash: 0, caida: 0, aleteo: 0, abierto: 0 };
}
export function liberarModelo(M) { M.g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); M.mat.dispose(); M.g.removeFromParent(); }

// s: { anim, animT, rap, vuela, hab, t }
export function animarModelo(M, s, dt) {
  const an = s.anim, t = s.t;
  M.fase += dt * (2.2 + Math.min(7, (s.rap || 0) * 2.6) + (an === 'carga' ? 7 : 0));
  const f = M.fase, cu = M.cuerpo, cab = M.cab, anda = an === 'camina' || an === 'carga' || an === 'miedo' || (s.rap || 0) > 0.4;
  cu.position.set(0, 0, 0); cu.rotation.set(0, 0, 0); cab.rotation.set(0, 0, 0); cab.position.copy(M.cab0); M.torso.rotation.set(0, 0, 0);
  M.alt += ((s.vuela ? 3.4 : 0) - M.alt) * Math.min(1, dt * 3);
  const amp = an === 'carga' ? 0.95 : anda ? 0.55 : 0, k = Math.max(0, (s.animT || 0) / 0.4), golpe = Math.sin((1 - Math.min(1, k)) * Math.PI);
  // patas
  for (const p of M.patas) {
    const q = p.q; q.rotation.set(0, 0, 0);
    if (M.tipo === 'aracnido') { q.rotation.y = Math.sin(f * 1.4 + p.fase) * amp * 0.5; q.rotation.z = p.s * Math.max(0, Math.cos(f * 1.4 + p.fase)) * 0.3 * amp; }
    else if (M.tipo === 'tentaculos') { q.rotation.x = Math.sin(t * 2 + p.fase + f) * 0.22; q.rotation.z = Math.cos(t * 1.7 + p.fase) * 0.2; }
    else if (p.guadana) q.rotation.x = -0.15 + Math.sin(t * 2 + p.fase) * 0.05;
    else q.rotation.x = Math.sin(f + p.fase) * amp;
    if (M.alt > 0.5) q.rotation.x = 0.7; // en vuelo las patas se recogen
  }
  cu.position.y = Math.abs(Math.sin(f)) * 0.07 * amp + M.alt;
  if (M.tipo === 'reptar') M.torso.rotation.y = Math.sin(f) * 0.12;
  if (!anda && an === 'quieto') M.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.02; else M.torso.scale.y = 1;
  if (M.cola) { M.cola.rotation.set(Math.sin(t * 1.3) * 0.08, Math.sin(t * 1.8 + 1) * 0.3 + Math.sin(f) * 0.25 * amp, 0); }
  // alas: plegadas en tierra, aletean en vuelo, se abren al celebrar o gritar
  M.abierto += ((s.vuela ? 1 : an === 'celebra' || an === 'grito' ? 0.8 : an === 'carga' ? 0.4 : 0) - M.abierto) * Math.min(1, dt * 5);
  M.aleteo += dt * (s.vuela ? 13 : an === 'celebra' ? 8 : 2);
  for (const a of M.alas) { const sg = a.userData.s, o = M.abierto; a.rotation.set(0, sg * 1.35 * (1 - o), sg * (0.05 * (1 - o) + o * Math.sin(M.aleteo) * 0.75)); }
  // estados
  switch (an) {
    case 'ataca': {
      cu.position.z = golpe * 0.65; cab.rotation.x = golpe * 0.35; cab.position.z += golpe * 0.2;
      if (['zarpazo', 'punetazo', 'guadana', 'pinzas'].includes(s.hab)) for (const p of M.patas) if (p.del) p.q.rotation.x = -golpe * 1.5;
      if (s.hab === 'coletazo') cu.rotation.y = golpe * 2.2;
      if (s.hab === 'aguijon' && M.cola) M.cola.rotation.x = golpe * 0.9;
      if (s.hab === 'constriccion' || s.hab === 'giroMortal') cu.rotation.z = golpe * 0.6;
      break;
    }
    case 'golpeado': cu.rotation.x = -0.25 * k; cu.position.z = -0.35 * k; M.flash = Math.max(M.flash, 0.9 * k); break;
    case 'aturdido': cab.rotation.z = Math.sin(t * 7) * 0.35; cu.rotation.z = Math.sin(t * 3.5) * 0.1; break;
    case 'atrapado': cu.position.x = Math.sin(t * 45) * 0.05; break;
    case 'miedo': cu.position.y -= 0.18; cab.rotation.x = 0.35; if (M.cola) M.cola.rotation.x = 0.7; break;
    case 'grito': cab.rotation.x = -0.65 + Math.sin(t * 30) * 0.05; break;
    case 'escudo': cu.position.y -= M.y0 * 0.45; cab.position.z -= 0.3; for (const p of M.patas) p.q.rotation.x = 1.2; break;
    case 'carga': cab.rotation.x = 0.4; cu.rotation.x = 0.1; break;
    case 'celebra': cu.position.y += Math.abs(Math.sin(t * 6)) * 0.45; cab.rotation.x = -0.45; break;
  }
  M.caida += ((an === 'cae' ? 1 : 0) - M.caida) * Math.min(1, dt * 4);
  if (M.caida > 0.01) { cu.rotation.z = M.caida * H; cu.position.y = M.caida * M.w * 0.5 + (1 - M.caida) * cu.position.y; cu.position.x = M.caida * M.y0 * 0.3; }
  M.flash = Math.max(0, M.flash - dt * 4); M.mat.emissive.setRGB(M.flash * 0.9, M.flash * 0.15, M.flash * 0.05);
}

// ---------------------------------------------------------------- el coliseo
export function crearArena(O) {
  const grupo = new THREE.Group(); O.mundo.add(grupo);
  const AR = ARENA, arena = [], piedra = 0xb8a88a, piedraOsc = 0x8a7a62;
  arena.push([Y, 0xd9bd86, 0, 0.02, 0, AR + 0.7, 0.08, AR + 0.7]);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 2 + (i * 1.7) % (AR - 3); arena.push([Y, i % 2 ? 0xd2b47e : 0xdec48f, Math.cos(a) * r, 0.03, Math.sin(a) * r, 1.4 + (i % 3), 0.08, 1 + (i % 2)]); }
  // muro del ruedo, gradas, columnas y portones
  const N = 44;
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, r = AR + 0.9; arena.push([C, i % 2 ? piedra : piedraOsc, Math.cos(a) * r, 0.85, Math.sin(a) * r, 0.5, 1.7, 2 * Math.PI * r / N + 0.05, 0, -a]); arena.push([C, 0x7a2a22, Math.cos(a) * (r - 0.26), 1.45, Math.sin(a) * (r - 0.26), 0.04, 0.3, 2 * Math.PI * r / N + 0.05, 0, -a]); }
  for (let k = 0; k < 4; k++) { const r = AR + 2.2 + k * 1.8, n = 40 + k * 6; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) * Math.cos(a) > 0.9) continue; arena.push([C, k % 2 ? piedra : 0xc8b898, Math.cos(a) * r, 1.0 + k * 1.1, Math.sin(a) * r, 1.8, 2 + k * 2.2, 2 * Math.PI * r / n + 0.06, 0, -a]); } }
  const rc = AR + 10.4;
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; arena.push([Y, piedra, Math.cos(a) * rc, 4.2, Math.sin(a) * rc, 0.45, 8.4, 0.45], [C, piedraOsc, Math.cos(a) * rc, 8.5, Math.sin(a) * rc, 0.8, 0.4, 0.8], [C, i % 2 ? 0x9a2a22 : 0xd8a838, Math.cos(a) * (rc - 0.5), 6.6, Math.sin(a) * (rc - 0.5), 0.05, 2.2, 0.9, 0, -a]); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; arena.push([C, piedraOsc, Math.cos(a) * rc, 8.9, Math.sin(a) * rc, 0.6, 0.4, 2 * Math.PI * rc / 36 + 0.1, 0, -a]); }
  for (const s of [-1, 1]) arena.push([C, 0x3a2a1e, s * (AR + 0.95), 1.2, 0, 0.6, 2.4, 2.6], [C, 0x6a5a48, s * (AR + 0.95), 2.5, 0, 0.8, 0.4, 3.2], [C, s < 0 ? 0x2a5aa8 : 0xa83a2a, s * (AR + 1.3), 3.4, 0, 0.05, 1.4, 1.6]);
  grupo.add(fundir(arena));
  // palco de honor
  grupo.add(fundir([[C, 0x7a2a22, 0, 5.4, -(AR + 4.2), 6, 0.3, 3], [C, 0xd8a838, 0, 7.6, -(AR + 4.6), 6.4, 0.25, 3.4], [Y, 0xd8a838, -2.8, 6.5, -(AR + 3.2), 0.12, 2.2, 0.12], [Y, 0xd8a838, 2.8, 6.5, -(AR + 3.2), 0.12, 2.2, 0.12]]));
  // braseros con fuego (material sin luz para que brillen de noche)
  const brasas = [], fuego = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, r = AR + 0.9; brasas.push([Y, 0x3a3430, Math.cos(a) * r, 1.95, Math.sin(a) * r, 0.32, 0.25, 0.32]); fuego.push([K, 0xffa030, Math.cos(a) * r, 2.35, Math.sin(a) * r, 0.24, 0.55, 0.24], [K, 0xffe070, Math.cos(a) * r, 2.25, Math.sin(a) * r, 0.13, 0.35, 0.13]); }
  grupo.add(fundir(brasas));
  const matFuego = new THREE.MeshBasicMaterial({ vertexColors: true }), llamas = new THREE.Mesh(fundirGeo(fuego), matFuego); grupo.add(llamas);
  const luces = [0, Math.PI].map((a) => { const L = new THREE.PointLight(0xff9a40, 0, 30, 1.6); L.position.set(Math.cos(a + 0.2) * 9, 4, Math.sin(a + 0.2) * 9); grupo.add(L); return L; });
  // manchas de sangre: quedan en la arena después de cada pelea dura (las consecuencias se ven)
  const mMancha = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x5a0e0a, roughness: 0.6, transparent: true, opacity: 0.8 }), 16);
  mMancha.count = 0; mMancha.receiveShadow = true; grupo.add(mMancha); let nMancha = 0; const _mm = new THREE.Matrix4();
  function mancha(x, z, s = 1) { _mm.compose(new THREE.Vector3(x, 0.08, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), new THREE.Vector3(s * (0.6 + Math.random() * 0.5), 1, s * (0.4 + Math.random() * 0.4))); mMancha.setMatrixAt(nMancha % 16, _mm); nMancha++; mMancha.count = Math.min(16, nMancha); mMancha.instanceMatrix.needsUpdate = true; }
  // público: dos mallas instanciadas (cuerpos y cabezas) = 2 llamadas de dibujo para cientos de personas
  const asientos = [];
  for (let k = 0; k < 4; k++) { const r = AR + 2.2 + k * 1.8, n = 46 + k * 8; for (let i = 0; i < n; i++) { const a = (i + Math.random() * 0.4) / n * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.14 && Math.cos(a) ** 2 > 0.9) continue; if (Math.random() < 0.18) continue; asientos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 2 + k * 2.2, ry: -a - H, fase: Math.random() * 6, ner: 0.6 + Math.random() * 0.8 }); } }
  const nP = asientos.length, gCuerpo = fundirGeo([[P, 0xffffff, 0, 0.45, 0, 0.42, 0.32, 0.3]]), gCab = fundirGeo([[EF, 0xffffff, 0, 1.0, 0, 0.17, 0.19, 0.17], [EF, 0xffffff, 0, 1.13, -0.03, 0.18, 0.1, 0.18]]);
  const mat2 = MAT_VERTICE.clone(), cuerpos = new THREE.InstancedMesh(gCuerpo, mat2, nP), cabezas = new THREE.InstancedMesh(gCab, mat2, nP);
  const ROPA = [0x9a3a2a, 0x2a5a8a, 0xd8a838, 0x4a7a3a, 0x7a4a8a, 0xe8e0d0, 0x3a3a46, 0xc86a2a], PIEL = [0xe0b08a, 0xc8905e, 0x8a5a3a, 0x5a3a26, 0xf0c8a0];
  const cc = new THREE.Color();
  asientos.forEach((s, i) => { cuerpos.setColorAt(i, cc.set(ROPA[i % ROPA.length])); cabezas.setColorAt(i, cc.set(PIEL[(i * 7) % PIEL.length])); });
  cuerpos.castShadow = cabezas.castShadow = false; grupo.add(cuerpos, cabezas);
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _qq = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
  let ola = 0;
  function animar(dt, t, emocion, noche) {
    // de noche se encienden las llamas; siempre parpadean
    const fl = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07; llamas.scale.set(1, fl, 1);
    luces.forEach((L, i) => { L.intensity = (0.3 + noche * 2.6) * (0.9 + Math.sin(t * 11 + i) * 0.1); });
    if (ola > 0) ola -= dt;
    const amp = 0.04 + Math.min(1.6, emocion) * 0.35;
    for (let i = 0; i < nP; i++) {
      const s = asientos[i], aOla = ola > 0 ? Math.max(0, Math.cos(Math.atan2(s.z, s.x) - (3 - ola) * 3)) ** 8 : 0;
      const salto = Math.max(0, Math.sin(t * (5 + s.ner * 3) + s.fase)) * amp * s.ner + aOla * 0.9;
      _p.set(s.x, s.y + salto, s.z); _qq.setFromEuler(_e.set(0, s.ry, Math.sin(t * 2 + s.fase) * 0.06)); _m.compose(_p, _qq, _s);
      cuerpos.setMatrixAt(i, _m); cabezas.setMatrixAt(i, _m);
    }
    cuerpos.instanceMatrix.needsUpdate = true; cabezas.instanceMatrix.needsUpdate = true;
  }
  return { grupo, animar, mancha, ola: () => { ola = 3; }, nPublico: nP };
}
