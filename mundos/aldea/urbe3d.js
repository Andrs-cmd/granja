// =====================================================================
// La aldea · arquitectura por eras: las formas base (arquetipos) de los edificios, fundidas con color
// por vértice, y la regla que decide cómo se ve cada celda según su uso, su nivel y la era en que se
// construyó. La misma vivienda pasa de choza a casa de barro, de piedra, de ladrillo, a bloque de
// concreto, torre de vidrio y aguja futurista (o cúpula bio-cristal si la sociedad eligió fe o naturaleza).
// Todas las formas miden 1 de lado; la escena las escala por celda (una InstancedMesh por arquetipo).
// =====================================================================
import { THREE, fundirGeo, GEO } from '../motor/orbe3d.js';

const CONO4 = new THREE.ConeGeometry(1, 1, 4), CIL6 = new THREE.CylinderGeometry(1, 1, 1, 6), CUP = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), TOR = new THREE.TorusGeometry(1, 0.12, 6, 18), AGU = new THREE.CylinderGeometry(0.45, 1, 1, 6);
const B = 0xf2efe8, OSC = 0x4a3a2e, TECHO = 0x8a8079;   // blanco teñible, oscuro y techo neutro (el color de la instancia los tiñe)

// cada arquetipo: { cuerpo: [partes], ventanas: [partes] } en coordenadas de 1×1 (y de 0 a ~1)
const DEF = {
  choza: { c: [[GEO.cil, B, 0, 0.25, 0, 0.42, 0.5, 0.42], [GEO.cono, 0xd8c08a, 0, 0.72, 0, 0.55, 0.5, 0.55], [GEO.caja, OSC, 0, 0.18, 0.41, 0.16, 0.3, 0.05]] },
  casa: {
    c: [[GEO.caja, B, 0, 0.3, 0, 0.86, 0.6, 0.74], [CONO4, TECHO, 0, 0.82, 0, 0.68, 0.45, 0.58, 0, Math.PI / 4, 0], [GEO.caja, OSC, 0, 0.2, 0.375, 0.16, 0.36, 0.02], [GEO.caja, 0x6a6560, 0.25, 0.95, -0.15, 0.1, 0.3, 0.1]],
    v: [[GEO.caja, B, -0.25, 0.36, 0.375, 0.14, 0.13, 0.02], [GEO.caja, B, 0.25, 0.36, 0.375, 0.14, 0.13, 0.02], [GEO.caja, B, -0.25, 0.36, -0.375, 0.14, 0.13, 0.02], [GEO.caja, B, 0.25, 0.36, -0.375, 0.14, 0.13, 0.02]],
  },
  bloque: {
    c: [[GEO.caja, B, 0, 0.5, 0, 0.88, 1, 0.88], [GEO.caja, TECHO, 0, 1.01, 0, 0.92, 0.03, 0.92], [GEO.caja, 0x777777, 0.2, 1.05, 0.15, 0.2, 0.06, 0.2]],
    v: [...[-0.25, 0.05, 0.3].flatMap((x) => [[GEO.caja, B, x, 0.52, 0.445, 0.14, 0.86, 0.01], [GEO.caja, B, x, 0.52, -0.445, 0.14, 0.86, 0.01], [GEO.caja, B, 0.445, 0.52, x, 0.01, 0.86, 0.14], [GEO.caja, B, -0.445, 0.52, x, 0.01, 0.86, 0.14]])],
  },
  torre: {
    c: [[GEO.caja, B, 0, 0.5, 0, 0.72, 1, 0.72], [GEO.caja, TECHO, 0, 1.01, 0, 0.6, 0.02, 0.6], [GEO.cil, 0x999999, 0, 1.04, 0, 0.02, 0.06, 0.02]],
    v: [...[-0.22, 0, 0.22].flatMap((x) => [[GEO.caja, B, x, 0.5, 0.365, 0.12, 0.94, 0.01], [GEO.caja, B, x, 0.5, -0.365, 0.12, 0.94, 0.01], [GEO.caja, B, 0.365, 0.5, x, 0.01, 0.94, 0.12], [GEO.caja, B, -0.365, 0.5, x, 0.01, 0.94, 0.12]])],
  },
  aguja: {
    c: [[AGU, B, 0, 0.5, 0, 0.4, 1, 0.4], [GEO.esfera, 0xdfe8f0, 0, 1.03, 0, 0.12, 0.08, 0.12], [GEO.caja, B, 0, 0.04, 0, 0.9, 0.08, 0.9]],
    v: [[TOR, B, 0, 0.3, 0, 0.36, 0.36, 0.36, Math.PI / 2, 0, 0], [TOR, B, 0, 0.62, 0, 0.29, 0.29, 0.29, Math.PI / 2, 0, 0], [TOR, B, 0, 0.88, 0, 0.22, 0.22, 0.22, Math.PI / 2, 0, 0]],
  },
  cupula: {
    c: [[GEO.cil, B, 0, 0.22, 0, 0.42, 0.44, 0.42], [CUP, TECHO, 0, 0.44, 0, 0.42, 0.42, 0.42], [GEO.caja, B, 0, 0.03, 0, 0.95, 0.06, 0.95]],
    v: [[GEO.cil, B, 0, 0.3, 0, 0.425, 0.08, 0.425]],
  },
  nave: {
    c: [[GEO.caja, B, 0, 0.22, 0, 0.92, 0.44, 0.8], ...[-0.3, 0, 0.3].map((x) => [GEO.caja, TECHO, x, 0.5, 0, 0.3, 0.12, 0.8, 0, 0, 0.5]), [GEO.cil, 0x6a5a50, 0.36, 0.6, -0.28, 0.06, 0.9, 0.06]],
    v: [[GEO.caja, B, 0, 0.27, 0.405, 0.75, 0.08, 0.01], [GEO.caja, B, 0, 0.27, -0.405, 0.75, 0.08, 0.01]],
  },
  mina: { c: [[GEO.caja, 0x5e3b22, -0.15, 0.4, 0, 0.05, 0.85, 0.05, 0, 0, 0.25], [GEO.caja, 0x5e3b22, 0.15, 0.4, 0, 0.05, 0.85, 0.05, 0, 0, -0.25], [TOR, 0x3a3a3a, 0, 0.8, 0, 0.12, 0.12, 0.12], [GEO.cono, 0x6a6058, 0.25, 0.15, 0.25, 0.25, 0.3, 0.25], [GEO.caja, B, -0.25, 0.15, 0.25, 0.3, 0.3, 0.3], [GEO.caja, 0x2a2420, 0, 0.12, -0.25, 0.25, 0.24, 0.05]] },
  puestos: { c: [...[[-0.25, -0.2, 0xc0502a], [0.25, -0.15, 0x2a7a8a], [0, 0.25, 0xd0a030]].flatMap(([x, z, col]) => [[GEO.caja, 0x7a5a3a, x, 0.15, z, 0.3, 0.3, 0.22], [CONO4, col, x, 0.42, z, 0.24, 0.2, 0.2, 0, Math.PI / 4, 0]]), [GEO.cil, 0x9a968c, 0, 0.02, 0, 0.48, 0.04, 0.48]] },
  templo: {
    c: [[GEO.caja, B, 0, 0.25, -0.08, 0.6, 0.5, 0.74], [CONO4, TECHO, 0, 0.62, -0.08, 0.5, 0.3, 0.6, 0, Math.PI / 4, 0], [GEO.caja, B, 0, 0.5, 0.36, 0.24, 1, 0.24], [CONO4, TECHO, 0, 1.12, 0.36, 0.2, 0.26, 0.2, 0, Math.PI / 4, 0], [GEO.caja, OSC, 0, 0.15, 0.485, 0.12, 0.26, 0.01]],
    v: [[GEO.caja, B, 0.305, 0.3, -0.1, 0.01, 0.22, 0.08], [GEO.caja, B, -0.305, 0.3, -0.1, 0.01, 0.22, 0.08], [GEO.cil, B, 0, 0.78, 0.485, 0.06, 0.01, 0.06, Math.PI / 2, 0, 0]],
  },
  menhir: { c: [...Array(7)].map((_, i) => { const a = (i / 7) * 6.28; return [GEO.caja, 0x8f8a80, Math.cos(a) * 0.36, 0.22, Math.sin(a) * 0.36, 0.09, 0.44, 0.06, 0, -a, 0]; }).concat([[GEO.caja, 0x6e6a62, 0, 0.08, 0, 0.22, 0.16, 0.14]]) },
  pila: { c: [...Array(5)].map((_, i) => [GEO.cil, 0x8a5a34, -0.2 + (i % 3) * 0.2, 0.08 + Math.floor(i / 3) * 0.15, -0.2, 0.08, 0.6, 0.08, 0, 0, Math.PI / 2]).concat([[GEO.caja, 0x9a968c, 0.15, 0.1, 0.22, 0.25, 0.2, 0.2], [GEO.caja, 0xa8a49c, -0.15, 0.08, 0.25, 0.2, 0.16, 0.18]]) },
  solar: { c: [...Array(6)].map((_, i) => [GEO.caja, 0x2a3a6a, -0.28 + (i % 3) * 0.28, 0.14, -0.2 + Math.floor(i / 3) * 0.4, 0.24, 0.02, 0.3, -0.5, 0, 0]).concat([[GEO.caja, 0x9a9a9a, 0, 0.03, 0, 0.95, 0.06, 0.95]]) },
  puerto: { c: [[GEO.cil, 0x8a8a90, 0, 0.04, 0, 0.48, 0.08, 0.48], [GEO.caja, 0xb04030, 0.28, 0.6, 0, 0.08, 1.2, 0.08], [GEO.caja, 0xb04030, 0.22, 1, 0, 0.14, 0.03, 0.06], [GEO.cil, 0xf0f0f0, 0, 0.62, 0, 0.09, 1.0, 0.09], [GEO.cono, 0xd04030, 0, 1.22, 0, 0.09, 0.22, 0.09], [GEO.cono, 0x3a3a40, 0, 0.16, 0, 0.16, 0.18, 0.16]] },
  fogata: { c: [...Array(8)].map((_, i) => { const a = (i / 8) * 6.28; return [GEO.esfera, 0x6e6a62, Math.cos(a) * 0.22, 0.04, Math.sin(a) * 0.22, 0.07, 0.05, 0.07]; }).concat([[GEO.cil, 0x5e3b22, 0, 0.05, 0, 0.03, 0.35, 0.03, 0, 0, 1.3], [GEO.cil, 0x5e3b22, 0, 0.05, 0, 0.03, 0.35, 0.03, 1.3, 0, 0]]).concat([...Array(4)].map((_, i) => { const a = (i / 4) * 6.28 + 0.4; return [GEO.cil, 0x8a5a34, Math.cos(a) * 0.42, 0.05, Math.sin(a) * 0.42, 0.05, 0.3, 0.05, 0, -a, Math.PI / 2]; })) },
  ruina: { c: [[GEO.caja, B, -0.2, 0.15, 0, 0.4, 0.3, 0.7], [GEO.caja, B, 0.25, 0.25, -0.2, 0.3, 0.5, 0.3], [GEO.caja, B, 0.1, 0.05, 0.25, 0.6, 0.1, 0.3, 0.2, 0.3, 0]] },
};
export const ARQ = Object.keys(DEF);
export function geometrias() {
  const out = {};
  for (const [k, d] of Object.entries(DEF)) out[k] = { cuerpo: fundirGeo(d.c), ventanas: d.v ? fundirGeo(d.v) : null };
  return out;
}

// paleta por era (vivienda): madera → barro → piedra → ladrillo → ladrillo industrial → concreto → vidrio → blanco futuro
const MURO = [0x9a7a56, 0xc8a070, 0xb8b0a0, 0xc07850, 0xa85a40, 0xb8b8b0, 0x7aa0c8, 0xe8f0f8];
const col = (h) => new THREE.Color(h);
// cómo se ve una celda: { a: arquetipo, sx, sy, sz, color, brillo (0..1 de las ventanas) } o null si es plana (campo, parque)
export function aspecto(s, c, eraCiv) {
  const e = Math.min(7, c.o && !c.u ? c.o.e : c.e), n = Math.max(1, c.n), u = c.u || c.o?.u, verde = s.ejes.ni < -15 || s.destino?.tipo === 'gaia', fe = s.ejes.cf < -20 || s.destino?.tipo === 'trascendencia';
  if (!u || u === 'campo' || u === 'parque') return null;
  const W = 2.6, piso = 0.95;
  let a = 'casa', sx = W, sy = 2.4, sz = W, color = MURO[e], giro = 0;
  if (c.fogata && e <= 1) return { a: 'fogata', sx: W, sy: 1.2, sz: W, color: col(0xffffff) };
  switch (u) {
    case 'vivienda':
      if (e === 0) { a = 'choza'; sy = 2.2; sx = sz = 2.3; }
      else if (e <= 2) { a = 'casa'; sy = 2.3 + (n - 1) * 1.2; }
      else if (e === 3) { a = n >= 3 ? 'bloque' : 'casa'; sy = a === 'bloque' ? n * piso * 1.1 : 2.6 + (n - 1) * 1.1; }
      else if (e === 4) { a = 'bloque'; sy = n * piso; }
      else if (e === 5) { a = n > 9 ? 'torre' : 'bloque'; sy = n * piso; }
      else if (e === 6) { a = 'torre'; sy = Math.max(3, n * piso); }
      else { a = fe || verde ? 'cupula' : 'aguja'; sy = a === 'cupula' ? 2.6 + n * 0.12 : Math.max(4, n * piso * 1.1); color = fe ? col(0xd8c8f0) : verde ? col(0xb8dca8) : col(MURO[7]); }
      break;
    case 'cantera': a = e >= 4 ? 'nave' : 'pila'; color = e >= 4 ? 0x9a948a : 0xffffff; sy = e >= 4 ? 2 : 1.6; break;
    case 'mina': a = 'mina'; color = 0xffffff; sy = 3; break;
    case 'central': a = e >= 7 ? 'cupula' : e >= 6 ? 'solar' : 'nave'; color = e >= 7 ? 0xf0f8ff : e >= 6 ? 0xffffff : 0x6a6058; sy = e >= 7 ? 3.2 : e >= 6 ? 1.5 : 2.6; break;
    case 'taller': a = e >= 6 ? 'bloque' : e >= 4 ? 'nave' : 'casa'; color = e >= 6 ? 0xdde4ea : e >= 4 ? 0xa85a40 : MURO[e]; sy = e >= 6 ? n * piso : e >= 4 ? 2.4 : 2.2; break;
    case 'escuela': a = e === 0 ? 'choza' : e <= 2 ? 'casa' : e <= 4 ? 'cupula' : e === 5 ? 'bloque' : e === 6 ? 'torre' : 'cupula'; color = e <= 2 ? MURO[e] : e <= 4 ? 0xd8d0c0 : e === 6 ? 0x8ab0d0 : 0xf0f4f8; sy = a === 'bloque' || a === 'torre' ? Math.max(3, n * piso) : a === 'cupula' ? 2.8 : 2.4; break;
    case 'templo': a = e === 0 ? 'menhir' : e >= 7 && fe ? 'aguja' : e >= 6 ? 'cupula' : 'templo'; color = e >= 7 && fe ? 0xc8a8ff : e >= 3 ? 0xe0d8c8 : MURO[e]; sy = a === 'menhir' ? 2.4 : a === 'templo' ? 3 + Math.min(4, n) * 0.5 + (e >= 3 ? 1.5 : 0) : a === 'aguja' ? 9 + n : 3.4; break;
    case 'hospital': a = e <= 2 ? 'casa' : 'bloque'; color = 0xf4f2ee; sy = a === 'bloque' ? Math.max(2.5, n * piso) : 2.4; break;
    case 'mercado': a = e <= 3 ? 'puestos' : e >= 6 ? 'torre' : 'bloque'; color = e <= 3 ? 0xffffff : e >= 6 ? 0x9ab8d8 : 0xd8c8a8; sy = a === 'puestos' ? 2.4 : Math.max(2.5, n * piso); break;
    case 'cuartel': a = e <= 2 ? 'casa' : 'bloque'; color = e <= 2 ? 0x8a7a66 : 0x8a8a80; sy = a === 'bloque' ? Math.max(2.4, n * piso * 0.8) : 2.2; break;
    case 'teatro': a = e <= 1 ? 'fogata' : e <= 4 ? 'puestos' : 'cupula'; color = e >= 5 ? 0xe8d8f0 : 0xffffff; sy = a === 'cupula' ? 3 : a === 'fogata' ? 1.2 : 2.4; break;
    case 'palacio': a = e <= 3 ? 'templo' : e <= 5 ? 'cupula' : 'torre'; color = 0xe8d090; sy = a === 'torre' ? Math.max(6, n * piso * 1.2) : a === 'cupula' ? 4 : 3.6; sx = sz = W * 1.05; break;
    case 'puerto': a = 'puerto'; color = 0xffffff; sy = 9; sx = sz = 2.8; break;
  }
  if (c.ru) { a = 'ruina'; sy = Math.min(sy, 2.2) * 0.8; color = 0x5a5650; }
  return { a, sx, sy, sz, color: color instanceof THREE.Color ? color : col(color), giro };
}
// ropa según la era y la clase
const ROPA_ERA = [[0x8a6a4a, 0x7a5a3a, 0x9a7a5a, 0x6a5040], [0xb8a882, 0x8a7a5a, 0xa08a6a, 0x9a8a6a], [0x7a4a3a, 0x4a5a7a, 0x6a7a4a, 0x8a6a3a], [0x6a3a6a, 0x3a5a8a, 0x8a3a2a, 0x2a6a5a], [0x3a3a40, 0x4a4038, 0x5a5048, 0x2a3040], [0x2a4a8a, 0xc04a3a, 0x3a8a5a, 0xd8b04a], [0x2a2a30, 0x6a8ab0, 0xe0e0e0, 0x9a3a6a], [0xe8eef4, 0xb8c8d8, 0x8ae0e8, 0xf0f0f0]];
export function ropaDe(era, a) { const l = ROPA_ERA[Math.min(7, era)]; let c = l[Math.floor(a.ap.tono * l.length) % l.length]; if (a.clase === 'alta' && era >= 2) c = [0x6a2a6a, 0x8a6a1a, 0x2a2a6a][a.id % 3]; return c; }
