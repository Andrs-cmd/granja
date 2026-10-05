// Utilería que los personajes llevan en la mano según la tarea (medidas en metros del modelo).
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const madera = M(0x8a5a32, { roughness: 0.8 }), metal = M(0xb9bec4, { metalness: 0.7, roughness: 0.35 }), mimbre = M(0xb88a4a, { roughness: 0.9 });
function malla(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m; }
const cil = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);

// cada objeto se arma con el mango a lo largo de +Y (como si la mano lo agarrara desde abajo)
const HACER = {
  regadera: () => [malla(cil(0.09, 0.18), M(0x3f8a5a, { metalness: 0.4 }), 0, 0.12, 0.06), malla(cil(0.015, 0.22, 6), M(0x3f8a5a), 0, 0.18, 0.2, 1.0, 0, 0), malla(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI), M(0x3f8a5a), 0, 0.22, 0.06)],
  balde: () => [malla(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 14, 1, true), M(0x8a8f96, { metalness: 0.5, side: THREE.DoubleSide }), 0, -0.14, 0), malla(new THREE.TorusGeometry(0.11, 0.008, 6, 14, Math.PI), metal, 0, -0.04, 0)],
  cesta: () => [malla(new THREE.CylinderGeometry(0.15, 0.12, 0.13, 14, 1, true), M(0xb88a4a, { side: THREE.DoubleSide, roughness: 0.9 }), 0, -0.16, 0), malla(new THREE.TorusGeometry(0.14, 0.01, 6, 14, Math.PI), mimbre, 0, -0.05, 0), malla(new THREE.SphereGeometry(0.05, 8, 6), M(0xc0392b), 0.04, -0.12, 0.03), malla(new THREE.SphereGeometry(0.05, 8, 6), M(0x7fae4a), -0.04, -0.12, -0.02)],
  pala: () => [malla(cil(0.012, 0.2, 6), madera, 0, 0.08, 0), malla(new THREE.BoxGeometry(0.07, 0.12, 0.01), metal, 0, 0.22, 0)],
  martillo: () => [malla(cil(0.014, 0.3, 6), madera, 0, 0.1, 0), malla(new THREE.BoxGeometry(0.12, 0.045, 0.045), M(0x4a4d52, { metalness: 0.7 }), 0, 0.25, 0)],
  libro: () => [malla(new THREE.BoxGeometry(0.16, 0.22, 0.035), M(0x9b2d2d), 0, 0.06, 0.05), malla(new THREE.BoxGeometry(0.15, 0.21, 0.03), M(0xf2ead8), 0.006, 0.06, 0.05)],
  agujas: () => [malla(cil(0.004, 0.3, 4), metal, 0, 0.1, 0, 0, 0, 0.3), malla(cil(0.004, 0.3, 4), metal, 0, 0.1, 0, 0, 0, -0.3), malla(new THREE.SphereGeometry(0.06, 10, 8), M(0xd8c26a, { roughness: 1 }), 0, 0.02, 0.1)],
  copa: () => [malla(cil(0.006, 0.08, 6), M(0xdfeff5, { transparent: true, opacity: 0.6 }), 0, 0.05, 0.04), malla(new THREE.CylinderGeometry(0.04, 0.02, 0.07, 12), M(0xdfeff5, { transparent: true, opacity: 0.45 }), 0, 0.12, 0.04), malla(new THREE.CylinderGeometry(0.034, 0.022, 0.035, 12), M(0x6a1028, { roughness: 0.2 }), 0, 0.11, 0.04)],
  porro: () => [malla(cil(0.006, 0.08, 6), M(0xf4f1e8), 0.02, 0.04, 0.03, 0, 0, 1.3), malla(new THREE.SphereGeometry(0.008, 6, 4), M(0xff6a1a, { emissive: 0xff4a0a, emissiveIntensity: 2 }), 0.06, 0.05, 0.03)],
  sarten: () => [malla(cil(0.012, 0.18, 6), M(0x2b2d31), 0, 0.08, 0), malla(new THREE.CylinderGeometry(0.13, 0.11, 0.035, 16), M(0x2b2d31, { metalness: 0.6 }), 0, 0.26, 0.0, Math.PI / 2, 0, 0)],
  guadana: () => [malla(cil(0.016, 1.3, 6), madera, 0, 0.35, 0), malla(new THREE.BoxGeometry(0.55, 0.06, 0.008), metal, 0.25, 0.98, 0, 0, 0, -0.2)],
  tijeras: () => [malla(new THREE.BoxGeometry(0.02, 0.16, 0.012), metal, 0.01, 0.08, 0, 0, 0, 0.12), malla(new THREE.BoxGeometry(0.02, 0.16, 0.012), metal, -0.01, 0.08, 0, 0, 0, -0.12)],
};
// qué lleva en la mano en cada tarea: [objeto, mano]
export const UTILERIA_DE = {
  apagarFuego: ['balde', 'r'], repararPozo: ['martillo', 'r'], guardia: ['pala', 'r'],
  regar: ['regadera', 'r'], sacarAgua: ['balde', 'r'], ordenar: ['balde', 'l'], alimentar: ['balde', 'r'], alimentarGanado: ['balde', 'r'],
  recogerHuevos: ['cesta', 'l'], recogerFruta: ['cesta', 'l'], vendimia: ['cesta', 'l'], cosecharHierba: ['cesta', 'l'], cosechar: ['cesta', 'l'], recogerFlores: ['cesta', 'l'],
  sembrar: ['pala', 'r'], limpiar: ['pala', 'r'], abonar: ['pala', 'r'], arrancar: ['pala', 'r'], fumigar: ['regadera', 'r'], cuidarJardin: ['pala', 'r'],
  construir: ['martillo', 'r'], reparar: ['martillo', 'r'], renovar: ['martillo', 'r'], esculpir: ['martillo', 'r'], tallar: ['martillo', 'r'],
  leer: ['libro', 'r'], tejer: ['agujas', 'r'], tomarVino: ['copa', 'r'], fumar: ['porro', 'r'],
  cocinar: ['sarten', 'r'], hornear: ['sarten', 'r'], hacerConservas: ['sarten', 'r'], segar: ['guadana', 'r'], esquilar: ['tijeras', 'r'], cepillar: ['tijeras', 'r'],
};
// cómo queda el objeto en la palma (en metros, ejes del hueso de la mano)
export const AJUSTE = { r: { pos: [0.05, -0.02, 0], rot: [Math.PI / 2, 0, 0] }, l: { pos: [-0.05, 0.02, 0], rot: [-Math.PI / 2, 0, 0] } };   // el mango atraviesa el puño
// arma toda la utilería colgada de las manos de un modelo (oculta hasta que se use)
export function montarUtileria(modelo, ajuste = {}) {
  const manos = { r: modelo.getObjectByName('hand_r'), l: modelo.getObjectByName('hand_l') };
  const piezas = {};
  for (const [nombre, hacer] of Object.entries(HACER)) for (const lado of ['r', 'l']) {
    const mano = manos[lado]; if (!mano) continue;
    const g = new THREE.Group(); hacer().forEach((m) => g.add(m)); g.visible = false;
    // la mano mira con el eje x hacia los dedos: el objeto se acomoda en la palma
    const a = ajuste[lado] || AJUSTE[lado];
    // el esqueleto puede venir en otra escala: medidas y desplazamiento se pasan a metros del modelo
    const s = new THREE.Vector3(); mano.getWorldScale(s); const sm = new THREE.Vector3(); modelo.getWorldScale(sm);
    const f = sm.x / s.x;
    g.position.set(a.pos[0] * f, a.pos[1] * f, a.pos[2] * f); g.rotation.set(...a.rot); g.scale.setScalar(f);
    mano.add(g); piezas[nombre + '_' + lado] = g;
  }
  let visible = null;
  return {
    piezas,
    mostrar(tarea) {
      const u = UTILERIA_DE[tarea], clave = u ? u[0] + '_' + u[1] : null;
      if (clave === visible) return;
      if (visible && piezas[visible]) piezas[visible].visible = false;
      if (clave && piezas[clave]) piezas[clave].visible = true;
      visible = clave;
    },
  };
}
