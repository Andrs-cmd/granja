// =====================================================================
// La aldea en 3D: dibuja el estado de sim.js dentro del orbe. No decide nada de la vida.
// Para no pasar de ~300 llamadas de dibujo: árboles, rocas, arbustos y tumbas son InstancedMesh;
// las construcciones terminadas se funden en UNA malla (y sus ventanas en otra); los campos en otra;
// solo las ~22 personas más cerca de la cámara usan cuerpo articulado, el resto son figuras instanciadas.
// =====================================================================
import { THREE, fundir, fundirGeo, GEO, MAT_VERTICE, crearPersona, animarPersona, angLerp } from '../motor/orbe3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TIPOS, ANIM, PASO, horaDe, fecha, DIAS_EST } from './sim.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = { madera: 0x8a5a34, maderaO: 0x5e3b22, paja: 0xd2b25e, barro: 0xb89a72, piedra: 0x9a968c, piedraO: 0x6e6a62, teja: 0x9a4a32, blanco: 0xe6dcc6, puerta: 0x4a2e1a, verde: 0x4f7a3a, rojo: 0x8a3a28 };
const CONO4 = new THREE.ConeGeometry(1, 1, 4), CIL6 = new THREE.CylinderGeometry(1, 1, 1, 6), DODE = new THREE.DodecahedronGeometry(1, 0);
const NDET = 22;   // personas con cuerpo articulado

// ---------------------------------------------------------------- diseños de construcciones (frente hacia +z; ventanas aparte para que brillen de noche)
function diseno(tipo) {
  const P = [], W = [];
  const techo2 = (an, la, y, col) => { P.push([GEO.caja, col, 0, y, -la * 0.24, an, 0.18, la * 0.56, -0.62, 0, 0], [GEO.caja, col, 0, y, la * 0.24, an, 0.18, la * 0.56, 0.62, 0, 0]); };
  switch (tipo) {
    case 'fogata':
      for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; P.push([GEO.esfera, C.piedraO, Math.cos(a) * 0.95, 0.15, Math.sin(a) * 0.95, 0.28, 0.2, 0.28]); }
      P.push([GEO.cil, C.maderaO, 0, 0.2, 0, 0.12, 1.4, 0.12, 0, 0, 1.3], [GEO.cil, C.maderaO, 0, 0.2, 0, 0.12, 1.4, 0.12, 1.3, 0, 0]);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + 0.4; P.push([GEO.cil, C.madera, Math.cos(a) * 2.1, 0.22, Math.sin(a) * 2.1, 0.22, 1.3, 0.22, 0, -a, Math.PI / 2]); }
      break;
    case 'choza':
      P.push([GEO.cil, C.barro, 0, 0.75, 0, 1.7, 1.5, 1.7], [GEO.cono, C.paja, 0, 2.3, 0, 2.2, 1.8, 2.2], [GEO.caja, C.puerta, 0, 0.6, 1.62, 0.65, 1.2, 0.2]);
      W.push([GEO.caja, 0xffffff, 1.2, 1, 1.15, 0.35, 0.3, 0.12, 0, 0.8, 0]);
      break;
    case 'casa':
      P.push([GEO.caja, C.piedra, 0, 0.2, 0, 4.4, 0.4, 3.6], [GEO.caja, C.blanco, 0, 1.4, 0, 4.2, 2.1, 3.4], [CONO4, C.teja, 0, 3.25, 0, 3.4, 1.7, 2.9, 0, Math.PI / 4, 0],
        [GEO.caja, C.piedraO, 1.2, 3.5, -0.6, 0.5, 1.4, 0.5], [GEO.caja, C.puerta, 0, 0.95, 1.72, 0.8, 1.5, 0.1]);
      for (const x of [-2.08, 2.08]) for (const z of [-1.68, 1.68]) P.push([GEO.caja, C.maderaO, x, 1.4, z, 0.16, 2.2, 0.16]);
      W.push([GEO.caja, 0xffffff, -1.3, 1.5, 1.72, 0.6, 0.55, 0.08], [GEO.caja, 0xffffff, 1.3, 1.5, 1.72, 0.6, 0.55, 0.08], [GEO.caja, 0xffffff, 2.12, 1.5, 0, 0.08, 0.55, 0.7], [GEO.caja, 0xffffff, -2.12, 1.5, 0, 0.08, 0.55, 0.7]);
      break;
    case 'granero':
      P.push([GEO.caja, C.rojo, 0, 1.5, 0, 5, 3, 4], [GEO.caja, C.blanco, 0, 1.1, 2.02, 1.8, 2.2, 0.08]);
      techo2(5.4, 4.6, 3.55, C.maderaO);
      P.push([GEO.caja, C.rojo, 0, 3.3, 2.01, 3.2, 0.9, 0.06], [GEO.caja, C.blanco, 0, 1.1, 2.07, 2.2, 0.14, 0.04, 0, 0, 0.88], [GEO.caja, C.blanco, 0, 1.1, 2.07, 2.2, 0.14, 0.04, 0, 0, -0.88]);
      W.push([GEO.caja, 0xffffff, 0, 3.1, 2.05, 0.6, 0.5, 0.06]);
      break;
    case 'pozo':
      P.push([GEO.cil, C.piedra, 0, 0.45, 0, 0.85, 0.9, 0.85], [GEO.cil, 0x2a3a4a, 0, 0.91, 0, 0.6, 0.04, 0.6], [GEO.caja, C.maderaO, -0.75, 1.3, 0, 0.12, 1.8, 0.12], [GEO.caja, C.maderaO, 0.75, 1.3, 0, 0.12, 1.8, 0.12],
        [CONO4, C.teja, 0, 2.5, 0, 1.3, 0.7, 1.1, 0, Math.PI / 4, 0], [GEO.cil, C.maderaO, 0, 1.9, 0, 0.06, 1.5, 0.06, 0, 0, Math.PI / 2], [GEO.cil, C.madera, 0, 1.5, 0, 0.18, 0.3, 0.18]);
      break;
    case 'aserradero':
      for (const x of [-1.8, 1.8]) for (const z of [-1.3, 1.3]) P.push([GEO.caja, C.maderaO, x, 1.3, z, 0.2, 2.6, 0.2]);
      P.push([GEO.caja, C.madera, 0, 2.75, 0, 4.4, 0.18, 3.4, 0.12, 0, 0], [GEO.caja, C.maderaO, 0, 0.8, 0, 2.6, 0.15, 0.8], [GEO.cil, 0xc0c0c0, 0, 1.05, 0, 0.45, 0.04, 0.45, Math.PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) P.push([GEO.cil, C.madera, -1.2 + (i % 3) * 0.55, 0.3 + Math.floor(i / 3) * 0.5, 2.3, 0.26, 2.2, 0.26, 0, 0, Math.PI / 2]);
      for (let i = 0; i < 4; i++) P.push([GEO.caja, 0xb08a5a, 1.6, 0.15 + i * 0.16, -2.3, 2, 0.14, 0.6]);
      break;
    case 'herreria':
      P.push([GEO.caja, C.piedra, 0, 1.2, -0.4, 3.6, 2.4, 2.4], [CONO4, C.piedraO, 0, 3, -0.4, 2.8, 1.2, 2.1, 0, Math.PI / 4, 0], [GEO.caja, C.piedraO, -1.2, 3.6, -1, 0.7, 2.2, 0.7],
        [GEO.caja, C.maderaO, 0, 2.2, 1.6, 3.6, 0.15, 1.6, -0.15, 0, 0], [GEO.caja, C.maderaO, -1.7, 1.1, 2.3, 0.16, 2.2, 0.16], [GEO.caja, C.maderaO, 1.7, 1.1, 2.3, 0.16, 2.2, 0.16],
        [GEO.caja, 0x3a3a3e, 0.6, 0.55, 1.6, 0.8, 0.3, 0.4], [GEO.caja, 0x3a3a3e, 0.6, 0.3, 1.6, 0.3, 0.6, 0.3], [GEO.caja, C.puerta, 0, 0.9, 0.82, 0.9, 1.6, 0.08]);
      W.push([GEO.caja, 0xffffff, -1.2, 0.8, 0.84, 0.8, 0.6, 0.06], [GEO.caja, 0xffffff, 1.2, 1.5, 0.84, 0.5, 0.45, 0.06]);
      break;
    case 'enfermeria':
      P.push([GEO.caja, C.piedra, 0, 0.2, 0, 4.2, 0.4, 3.4], [GEO.caja, 0xf0ece0, 0, 1.4, 0, 4, 2.1, 3.2], [CONO4, C.verde, 0, 3.2, 0, 3.2, 1.6, 2.7, 0, Math.PI / 4, 0], [GEO.caja, C.puerta, 0, 0.95, 1.62, 0.8, 1.5, 0.1]);
      for (let i = 0; i < 3; i++) P.push([GEO.caja, 0x6a4a2a, -1.4 + i * 1.4, 0.15, 2.6, 1, 0.3, 0.7], [GEO.esfera, 0x5aa04a, -1.4 + i * 1.4, 0.45, 2.6, 0.4, 0.25, 0.3]);
      W.push([GEO.caja, 0xffffff, -1.3, 1.5, 1.62, 0.6, 0.55, 0.08], [GEO.caja, 0xffffff, 1.3, 1.5, 1.62, 0.6, 0.55, 0.08]);
      break;
    case 'templo':
      P.push([GEO.caja, C.piedraO, 0, 0.3, 0, 4.8, 0.6, 7], [GEO.caja, C.piedra, 0, 2.3, -0.3, 4, 3.6, 6], [CONO4, C.teja, 0, 4.9, -0.3, 3.4, 1.8, 4.6, 0, Math.PI / 4, 0],
        [GEO.caja, C.piedra, 0, 3, 2.8, 1.6, 6, 1.6], [CONO4, C.teja, 0, 6.8, 2.8, 1.3, 1.8, 1.3, 0, Math.PI / 4, 0], [GEO.caja, C.puerta, 0, 1.2, 3.62, 0.9, 1.8, 0.08], [GEO.esfera, 0xc9a35a, 0, 5.3, 2.8, 0.3, 0.35, 0.3]);
      W.push([GEO.caja, 0xffffff, 2.02, 2.6, -1.5, 0.06, 1.3, 0.5], [GEO.caja, 0xffffff, 2.02, 2.6, 0.8, 0.06, 1.3, 0.5], [GEO.caja, 0xffffff, -2.02, 2.6, -1.5, 0.06, 1.3, 0.5], [GEO.caja, 0xffffff, -2.02, 2.6, 0.8, 0.06, 1.3, 0.5], [GEO.cil, 0xffffff, 0, 4.4, 3.61, 0.35, 0.06, 0.35, Math.PI / 2, 0, 0]);
      break;
    case 'plaza': {
      P.push([GEO.cil, 0xa8a090, 0, 0.06, 0, 4.2, 0.12, 4.2], [GEO.cil, C.piedra, 0, 0.35, 0, 0.9, 0.5, 0.9], [GEO.cil, 0x4a7aa0, 0, 0.62, 0, 0.7, 0.05, 0.7], [GEO.cil, C.piedra, 0, 0.9, 0, 0.15, 1, 0.15]);
      const tela = [0xc0502a, 0x2a7a8a, 0xd0a030];
      for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + 0.5, x = Math.cos(a) * 2.8, z = Math.sin(a) * 2.8; P.push([GEO.caja, C.maderaO, x, 0.5, z, 1.4, 0.9, 0.7, 0, -a, 0], [GEO.caja, tela[i], x, 1.75, z, 1.7, 0.1, 1.1, 0.15, -a, 0], [GEO.caja, C.maderaO, x, 1.2, z, 0.08, 1.2, 0.08], [GEO.esfera, [0xd04a2a, 0x7ab03a, 0xe0b040][i], x, 1.05, z, 0.35, 0.18, 0.25]); }
      break;
    }
    case 'monumento':
      P.push([GEO.caja, C.piedraO, 0, 0.5, 0, 1.6, 1, 1.6], [GEO.caja, C.piedra, 0, 1.3, 0, 1.1, 0.6, 1.1], [GEO.capsula, 0xc8c2b4, 0, 2.5, 0, 0.6, 1.1, 0.45], [GEO.esfera, 0xc8c2b4, 0, 3.55, 0, 0.32, 0.36, 0.32], [GEO.capsula, 0xc8c2b4, 0.45, 3.3, 0, 0.18, 0.9, 0.18, 0, 0, -0.5]);
      break;
  }
  return { geo: P.length ? fundirGeo(P) : null, ven: W.length ? fundirGeo(W) : null };
}
const DIS = {};
const dis = (t) => DIS[t] || (DIS[t] = diseno(t));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color(), UP = V(0, 1, 0);
const colocar = (geo, x, z, rot, sy = 1) => geo.clone().applyMatrix4(_m.compose(_p.set(x, 0, z), _q.setFromAxisAngle(UP, rot), _s.set(1, sy, 1)));

export function crearEscenaAldea(O, s0) {
  const M = O.mundo, scene = O.scene;
  // ------------------------------------------------------------ agua, orillas, tierra de la aldea y cementerio
  const agua = new THREE.MeshStandardMaterial({ color: 0x3f86b0, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9 });
  {
    const L = s0.lago, g1 = new THREE.CircleGeometry(L.r, 48).rotateX(-Math.PI / 2).translate(L.x, 0.06, L.z);
    const pos = [], pts = s0.rio.filter(([x, z]) => Math.hypot(x, z) < 45.8);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = (-dz / l) * 1.1, nz = (dx / l) * 1.1, w0 = 1 + (i === 0 ? 0.6 : 0);
      pos.push(x0 - nx * w0, 0.05, z0 - nz * w0, x1 - nx, 0.05, z1 - nz, x1 + nx, 0.05, z1 + nz, x0 - nx * w0, 0.05, z0 - nz * w0, x1 + nx, 0.05, z1 + nz, x0 + nx * w0, 0.05, z0 + nz * w0);
    }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.computeVertexNormals();
    const g1n = g1.toNonIndexed(); g1n.deleteAttribute('uv');
    const m = new THREE.Mesh(mergeGeometries([g1n, g2]), agua); m.receiveShadow = true; M.add(m);
    const arena = new THREE.Mesh(new THREE.RingGeometry(L.r - 0.2, L.r + 1.4, 48).rotateX(-Math.PI / 2).translate(L.x, 0.035, L.z), new THREE.MeshStandardMaterial({ color: 0xc9b37a, roughness: 1 })); arena.receiveShadow = true; M.add(arena);
    // cementerio: cerca baja
    const Cm = s0.cementerio, partes = [], ux = -Math.sin(Cm.ang), uz = Math.cos(Cm.ang), vx = -Math.cos(Cm.ang), vz = -Math.sin(Cm.ang);
    for (let i = -6; i <= 6; i++) for (const sg of [-1, 1]) { partes.push([GEO.caja, C.maderaO, Cm.x + ux * i * 0.95 + vx * sg * 5.2, 0.4, Cm.z + uz * i * 0.95 + vz * sg * 5.2, 0.12, 0.8, 0.12]); partes.push([GEO.caja, C.maderaO, Cm.x + vx * i * 0.85 + ux * sg * 5.9, 0.4, Cm.z + vz * i * 0.85 + uz * sg * 5.9, 0.12, 0.8, 0.12]); }
    partes.push([GEO.cil, 0x6a7a4a, Cm.x, 0.02, Cm.z, 6, 0.04, 6]);
    M.add(fundir(partes));
  }
  const tierra = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c7a56, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  tierra.position.y = 0.012; tierra.receiveShadow = true; M.add(tierra);

  // ------------------------------------------------------------ árboles, tocones, rocas, arbustos y tumbas (instanciados)
  const geoPino = fundirGeo([[GEO.cil, 0x6a4a2e, 0, 0.7, 0, 0.22, 1.4, 0.22], [GEO.cono, 0xffffff, 0, 2.2, 0, 1.4, 2.2, 1.4], [GEO.cono, 0xffffff, 0, 3.3, 0, 1, 1.8, 1]]);
  const geoRoble = fundirGeo([[GEO.cil, 0x6a4a2e, 0, 0.9, 0, 0.26, 1.8, 0.26], [GEO.esfera, 0xffffff, 0, 2.6, 0, 1.5, 1.3, 1.5], [GEO.esfera, 0xffffff, 0.6, 2.2, 0.3, 0.9, 0.8, 0.9]]);
  // la copa es blanca: el color de la estación lo pone instanceColor (el tronco queda oscuro igual)
  const nA = s0.arboles.length;
  const pinos = new THREE.InstancedMesh(geoPino, MAT_VERTICE, nA), robles = new THREE.InstancedMesh(geoRoble, MAT_VERTICE, nA), tocones = new THREE.InstancedMesh(fundirGeo([[GEO.cil, 0x7a5a3a, 0, 0.2, 0, 0.28, 0.4, 0.28], [GEO.cil, 0xc9a874, 0, 0.41, 0, 0.26, 0.02, 0.26]]), MAT_VERTICE, nA);
  for (const im of [pinos, robles, tocones]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; M.add(im); }
  const rocas = new THREE.InstancedMesh(fundirGeo([[DODE, 0x8f8b84, 0, 0.5, 0, 1.2, 0.9, 1.1], [DODE, 0x7a766e, 0.8, 0.35, 0.4, 0.7, 0.55, 0.7]]), MAT_VERTICE, s0.rocas.length); rocas.castShadow = rocas.receiveShadow = true; M.add(rocas);
  const nB = s0.arbustos.length, arbustos = new THREE.InstancedMesh(fundirGeo([[GEO.esfera, 0x3f6a2e, 0, 0.5, 0, 0.9, 0.6, 0.9], [GEO.esfera, 0x4a7a34, 0.5, 0.4, 0.3, 0.6, 0.45, 0.6]]), MAT_VERTICE, nB);
  const bayas = new THREE.InstancedMesh(fundirGeo([...Array(7)].map((_, i) => [GEO.esfera, 0xc0283a, Math.cos(i * 2.3) * 0.7, 0.55 + (i % 3) * 0.18, Math.sin(i * 2.3) * 0.65, 0.11, 0.11, 0.11])), MAT_VERTICE, nB);
  for (const im of [arbustos, bayas]) { im.castShadow = true; M.add(im); }
  const tumbas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0x8a867c, 0, 0.45, 0, 0.55, 0.9, 0.16], [GEO.caja, 0x5a6a3a, 0, 0.04, 0.5, 0.6, 0.08, 1]]), MAT_VERTICE, 48); tumbas.castShadow = true; tumbas.count = 0; M.add(tumbas);

  // ------------------------------------------------------------ construcciones: una malla fundida + ventanas + obras + campos + empalizada
  const matVent = new THREE.MeshStandardMaterial({ color: 0x2a2418, emissive: 0xffbf62, emissiveIntensity: 0, roughness: 0.6 });
  let estaticas = null, ventanas = null, campos = null, muralla = null, firmaE = '', firmaC = '', firmaM = '';
  const obras = new Map();
  const andamioGeo = fundirGeo([[GEO.caja, C.maderaO, -1, 1.3, -1, 0.1, 2.6, 0.1], [GEO.caja, C.maderaO, 1, 1.3, -1, 0.1, 2.6, 0.1], [GEO.caja, C.maderaO, -1, 1.3, 1, 0.1, 2.6, 0.1], [GEO.caja, C.maderaO, 1, 1.3, 1, 0.1, 2.6, 0.1],
    [GEO.caja, 0xb08a5a, 0, 1.3, 1, 2.1, 0.08, 0.35], [GEO.caja, 0xb08a5a, 0, 1.3, -1, 2.1, 0.08, 0.35], [GEO.caja, C.maderaO, 0, 2.5, 1, 2.1, 0.08, 0.08, 0, 0, 0.3], [GEO.caja, 0xb08a5a, 1.6, 0.25, 1.6, 0.9, 0.5, 0.6], [GEO.caja, 0x9a968c, -1.6, 0.25, 1.6, 0.7, 0.5, 0.7]]);
  function rehacerEstaticas(s) {
    const lista = s.edificios.filter((b) => b.hecho && !['campo', 'muralla'].includes(b.tipo));
    const f = lista.map((b) => b.id).join(',');
    if (f === firmaE) return; firmaE = f;
    for (const m of [estaticas, ventanas]) if (m) { M.remove(m); m.geometry.dispose(); }
    const gs = [], vs = [];
    for (const b of lista) { const d = dis(b.tipo); if (d.geo) gs.push(colocar(d.geo, b.x, b.z, b.rot)); if (d.ven) vs.push(colocar(d.ven, b.x, b.z, b.rot)); }
    estaticas = gs.length ? new THREE.Mesh(mergeGeometries(gs), MAT_VERTICE) : null;
    ventanas = vs.length ? new THREE.Mesh(mergeGeometries(vs), matVent) : null;
    if (estaticas) { estaticas.castShadow = estaticas.receiveShadow = true; M.add(estaticas); }
    if (ventanas) M.add(ventanas);
    gs.concat(vs).forEach((x) => x.dispose());
  }
  function rehacerCampos(s) {
    const l = s.edificios.filter((b) => b.tipo === 'campo');
    const f = l.map((b) => `${b.id}${b.hecho ? b.campo.e[0] : 'o' + Math.round(b.p * 4)}${Math.round(b.campo.c * 6)}`).join(',');
    if (f === firmaC) return; firmaC = f;
    if (campos) { M.remove(campos); campos.geometry.dispose(); campos = null; }
    if (!l.length) return;
    const gs = l.map((b) => {
      const P = [[GEO.caja, 0x6a4a2e, 0, 0.07, 0, 5.2, 0.14, 4.2]], C2 = b.campo, prog = b.hecho ? 1 : b.p;
      for (let i = 0; i < 5; i++) P.push([GEO.caja, 0x4e3420, 0, 0.15, -1.7 + i * 0.85, 4.8 * prog + 0.1, 0.05, 0.22]);
      for (const [x, z] of [[-2.6, -2.1], [2.6, -2.1], [-2.6, 2.1], [2.6, 2.1]]) P.push([GEO.caja, C.maderaO, x, 0.4, z, 0.1, 0.8, 0.1]);
      if (b.hecho && C2.e !== 'barbecho') {
        const k = C2.e === 'maduro' ? 1 : Math.max(0.15, C2.c), col = C2.e === 'maduro' ? 0xd8b04a : C2.c > 0.7 ? 0x9ab040 : 0x5a9a3a;
        for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) P.push([GEO.cono, col, -2.1 + j * 0.7, 0.15 + 0.45 * k, -1.7 + i * 0.85, 0.18, 0.9 * k, 0.18]);
      }
      return colocar(fundirGeo(P), b.x, b.z, b.rot);
    });
    campos = new THREE.Mesh(mergeGeometries(gs), MAT_VERTICE); campos.receiveShadow = campos.castShadow = true; M.add(campos);
  }
  function rehacerMuralla(s) {
    const b = s.edificios.find((x) => x.tipo === 'muralla'), f = b ? `${b.radio}:${Math.round(b.p * 20)}` : '';
    if (f === firmaM) return; firmaM = f;
    if (muralla) { M.remove(muralla); muralla.geometry.dispose(); muralla = null; }
    if (!b) return;
    const P = [], R = b.radio, n = Math.round((Math.PI * 2 * R) / 0.6), L = s.lago;
    for (let i = 0; i < n * b.p; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (Math.hypot(x - L.x, z - L.z) < L.r + 0.8 || i % Math.round(n / 4) < 4) continue;   // el lago y cuatro portones
      const h = 2 + ((i * 7) % 5) * 0.08;
      P.push([GEO.cil, 0x7a5434, x, h / 2, z, 0.28, h, 0.28], [GEO.cono, 0x6a4a2e, x, h + 0.25, z, 0.28, 0.5, 0.28]);
    }
    if (!P.length) return;
    muralla = fundir(P); M.add(muralla);
  }
  function actualizarObras(s) {
    const vivas = new Set();
    for (const b of s.edificios) {
      if (b.hecho || ['campo', 'muralla'].includes(b.tipo)) continue;
      vivas.add(b.id);
      let o = obras.get(b.id);
      if (!o) {
        const d = dis(b.tipo), g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.rot;
        const cuerpo = d.geo ? new THREE.Mesh(d.geo, MAT_VERTICE) : new THREE.Group(); cuerpo.castShadow = true; g.add(cuerpo);
        const and = new THREE.Mesh(andamioGeo, MAT_VERTICE); const r = TIPOS[b.tipo].radio; and.scale.set(r * 0.85, 1.2, r * 0.85); and.castShadow = true; g.add(and);
        M.add(g); o = { g, cuerpo }; obras.set(b.id, o);
      }
      o.cuerpo.scale.set(1, 0.08 + 0.92 * b.p, 1);
    }
    for (const [id, o] of obras) if (!vivas.has(id)) { M.remove(o.g); obras.delete(id); }
  }

  // ------------------------------------------------------------ fuego: fogata, incendios, luz y humo
  const matLlama = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a10, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
  const llama = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 7), matLlama); llama.position.y = 0.65; M.add(llama);
  const luzF = new THREE.PointLight(0xffa04a, 0, 26, 1.6); luzF.position.y = 1.6; M.add(luzF);
  const llamas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.6, 1.8, 6), matLlama, 40); llamas.count = 0; M.add(llamas);
  const humoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const NH = 180, humoPos = new Float32Array(NH * 3), humoVida = new Float32Array(NH).fill(-1), humoGeo = new THREE.BufferGeometry(); humoGeo.setAttribute('position', new THREE.BufferAttribute(humoPos, 3));
  const humo = new THREE.Points(humoGeo, new THREE.PointsMaterial({ color: 0xc8c4bc, size: 2.4, map: humoTex, transparent: true, opacity: 0.45, depthWrite: false })); humo.frustumCulled = false; M.add(humo);
  // lluvia y nieve
  const NL = 500, lluPos = new Float32Array(NL * 6), lluGeo = new THREE.BufferGeometry(); lluGeo.setAttribute('position', new THREE.BufferAttribute(lluPos, 3));
  for (let i = 0; i < NL; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.random() * 40; lluPos.set([x, y, z, x + 0.1, y + 1.1, z], i * 6); }
  const lluvia = new THREE.LineSegments(lluGeo, new THREE.LineBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: 0.5 })); lluvia.frustumCulled = false; lluvia.visible = false; M.add(lluvia);
  const NN = 700, niePos = new Float32Array(NN * 3), nieGeo = new THREE.BufferGeometry(); nieGeo.setAttribute('position', new THREE.BufferAttribute(niePos, 3));
  for (let i = 0; i < NN; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 43; niePos.set([Math.cos(a) * r, Math.random() * 40, Math.sin(a) * r], i * 3); }
  const nieve = new THREE.Points(nieGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, map: humoTex, transparent: true, depthWrite: false })); nieve.frustumCulled = false; nieve.visible = false; M.add(nieve);

  // ------------------------------------------------------------ personas
  const figGeo = fundirGeo([[GEO.capsula, 0xffffff, 0, 1.05, 0, 0.42, 0.9, 0.3], [GEO.esferaFina, 0xe8c8a8, 0, 1.78, 0, 0.17, 0.19, 0.17], [GEO.capsula, 0x555555, -0.12, 0.42, 0, 0.15, 0.6, 0.15], [GEO.capsula, 0x555555, 0.12, 0.42, 0, 0.15, 0.6, 0.15]]);
  const figuras = new THREE.InstancedMesh(figGeo, MAT_VERTICE, 260); figuras.count = 0; figuras.castShadow = true; figuras.frustumCulled = false; M.add(figuras);
  const vis = new Map();   // id → { x, z, rot, p (persona o null), clave, modo }
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe7c46a, transparent: true, opacity: 0.85, depthWrite: false })); anillo.position.y = 0.05; anillo.visible = false; M.add(anillo);
  const gruposDet = [];
  function claveAspecto(a) { return `${a.edad >= 64 ? 'b' : a.edad >= 52 ? 'g' : 'n'}${a.edad < 15 ? 'k' : ''}`; }
  function hacerPersona(a) {
    const k = claveAspecto(a), pelo = a.edad >= 64 ? 0xe4e2dc : a.edad >= 52 ? 0x9a968e : a.ap.pelo;
    const p = crearPersona({ piel: a.ap.piel, ropa: a.ap.ropa, pantalon: a.ap.pantalon, pelo, peinado: a.edad < 15 && a.ap.peinado === 'calvo' ? 'corto' : a.ap.peinado, ancho: a.ap.ancho });
    p.g.userData.id = a.id;
    p.g.traverse((o) => { if (o.isMesh) o.castShadow = o.parent === p.torso || o === p.torso || o.parent === p.cab; });
    return { p, k };
  }

  // ------------------------------------------------------------ lobos y bandidos
  const geoLobo = fundirGeo([[GEO.capsula, 0x6a6660, 0, 0.75, 0, 0.5, 0.9, 0.45, Math.PI / 2, 0, 0], [GEO.esfera, 0x5a5650, 0, 0.95, 0.75, 0.28, 0.26, 0.34], [GEO.cono, 0x4a4640, 0, 0.92, 1.1, 0.14, 0.3, 0.14, Math.PI / 2, 0, 0], [GEO.cono, 0x4a4640, 0.12, 1.2, 0.7, 0.07, 0.18, 0.07], [GEO.cono, 0x4a4640, -0.12, 1.2, 0.7, 0.07, 0.18, 0.07],
    ...[[0.18, 0.4], [-0.18, 0.4], [0.18, -0.4], [-0.18, -0.4]].map(([x, z]) => [GEO.cil, 0x5a5650, x, 0.3, z, 0.07, 0.6, 0.07]), [GEO.cono, 0x6a6660, 0, 0.8, -0.75, 0.1, 0.5, 0.1, -Math.PI / 2.4, 0, 0]]);
  const lobos = [...Array(4)].map(() => { const m = new THREE.Mesh(geoLobo, MAT_VERTICE); m.castShadow = true; m.visible = false; M.add(m); return m; });
  const bandidos = [...Array(6)].map((_, i) => { const p = crearPersona({ ropa: 0x3a1a1a, pantalon: 0x1a1a1a, pelo: 0x1a1210, piel: [0xc68c5c, 0xa8714a, 0xe0ac7e][i % 3], extraCab: [[GEO.esferaFina, 0x2a1410, 0, 0.2, -0.01, 0.18, 0.14, 0.18]] }); p.g.visible = false; M.add(p.g); return p; });

  // ------------------------------------------------------------ estaciones
  const SUELO = [0x7fa35a, 0x8ea552, 0xa48c4c, 0xdfe5ea].map((c) => new THREE.Color(c));
  const COPA = { pino: [[0.26, 0.45, 0.26], [0.22, 0.4, 0.22], [0.22, 0.38, 0.22], [0.74, 0.8, 0.82]], roble: [[0.4, 0.62, 0.26], [0.32, 0.52, 0.2], [0.82, 0.42, 0.14], [0.8, 0.84, 0.88]] };
  let firmaA = '', ultEst = -1, tAcum = 0;
  function mezcla(arr, e, k) { const a = arr[e], b = arr[(e + 1) % 4]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function actualizarBosque(s, forzar) {
    const f = fecha(s), kE = Math.max(0, (f.dia - 1 + f.hora / 24 - (DIAS_EST - 1.5)) / 1.5);   // transición en el último día y medio
    const firma = s.arboles.reduce((n, t, i) => n + (t.c < 0 ? -1 : t.c === 0 ? 0.5 : Math.round(t.c * 8)) * ((i % 13) + 1), 0) + ':' + f.est + ':' + Math.round(kE * 6);
    if (firma === firmaA && !forzar) return; firmaA = firma;
    const cp = mezcla(COPA.pino, f.est, Math.min(1, kE)), cr = mezcla(COPA.roble, f.est, Math.min(1, kE));
    s.arboles.forEach((t, i) => {
      const vivo = t.c > 0, esc = vivo ? 0.3 + 0.7 * t.c : 0, rot = (i * 2.399) % 6.28, base = 0.85 + ((i * 37) % 10) / 30;
      _m.compose(_p.set(t.x, 0, t.z), _q.setFromAxisAngle(UP, rot), _s.setScalar(vivo ? esc * base : 0));
      (t.v ? robles : pinos).setMatrixAt(i, _m); (t.v ? pinos : robles).setMatrixAt(i, _m.makeScale(0, 0, 0));
      _m.compose(_p.set(t.x, 0, t.z), _q.setFromAxisAngle(UP, rot), _s.setScalar(t.c === 0 || (t.c > 0 && t.c < 0.25) ? base : 0)); tocones.setMatrixAt(i, _m);
      (t.v ? robles : pinos).setColorAt(i, _c.setRGB(...(t.v ? cr : cp), THREE.SRGBColorSpace));
      (t.v ? pinos : robles).setColorAt(i, _c.setRGB(1, 1, 1));
    });
    for (const im of [pinos, robles, tocones]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    O.suelo.material.color.copy(SUELO[f.est]).lerp(SUELO[(f.est + 1) % 4], Math.min(1, kE));
    agua.color.setHex(f.est === 3 && kE < 0.5 ? 0xb8d4e4 : 0x3f86b0); agua.roughness = f.est === 3 ? 0.5 : 0.12;
  }
  function actualizarRecursos(s) {
    s.rocas.forEach((r, i) => { _m.compose(_p.set(r.x, -0.1, r.z), _q.setFromAxisAngle(UP, r.t * 6), _s.setScalar(r.q > 0 ? 0.55 + Math.min(1, r.q / 60) * 0.7 : 0)); rocas.setMatrixAt(i, _m); });
    rocas.instanceMatrix.needsUpdate = true;
    const inv = fecha(s).est === 3;
    s.arbustos.forEach((b, i) => { _m.compose(_p.set(b.x, 0, b.z), _q.identity(), _s.setScalar(inv ? 0.8 : 1)); arbustos.setMatrixAt(i, _m); _m.compose(_p.set(b.x, 0, b.z), _q.identity(), _s.setScalar(b.b >= 1 ? 0.5 + b.b / 16 : 0)); bayas.setMatrixAt(i, _m); });
    arbustos.instanceMatrix.needsUpdate = bayas.instanceMatrix.needsUpdate = true;
    tumbas.count = Math.min(48, s.tumbas.length);
    s.tumbas.slice(-48).forEach((t, i) => { _m.compose(_p.set(t.x, 0, t.z), _q.setFromAxisAngle(UP, s.cementerio.ang + Math.PI / 2), _s.setScalar(1)); tumbas.setMatrixAt(i, _m); });
    tumbas.instanceMatrix.needsUpdate = true;
    // tierra pisada: crece con la aldea
    const r = Math.max(6, ...s.edificios.filter((b) => b.tipo !== 'muralla' && b.tipo !== 'campo').map((b) => Math.hypot(b.x, b.z) + TIPOS[b.tipo].radio * 0.6));
    tierra.scale.setScalar(Math.min(30, r * 0.9));
  }

  // ------------------------------------------------------------ cada cuadro
  let sel = null, tHumo = 0;
  const camPos = V();
  function actualizar(s, dt, mult) {
    const alfa = Math.min(1, s.resto / PASO), hr = horaDe(s), L = O.luz;
    tAcum += dt;
    if (tAcum > 0.35 || ultEst < 0) { tAcum = 0; ultEst = 1; actualizarBosque(s); actualizarRecursos(s); rehacerEstaticas(s); rehacerCampos(s); rehacerMuralla(s); actualizarObras(s); }
    matVent.emissiveIntensity = 0.05 + L.noche * 1.8 + (hr > 17 && hr < 21 ? 0.4 : 0);
    // fogata
    const F = s.edificios.find((b) => b.tipo === 'fogata'), tt = performance.now() / 1000;
    llama.visible = !!F && s.gente.length > 0; if (F) { llama.position.set(F.x, 0.65, F.z); llama.scale.set(1 + Math.sin(tt * 13) * 0.1, 1 + Math.sin(tt * 9) * 0.18 + L.noche * 0.3, 1 + Math.cos(tt * 11) * 0.1); luzF.position.set(F.x, 1.6, F.z); }
    luzF.intensity = llama.visible ? (8 + L.noche * 60) * (0.85 + Math.sin(tt * 17) * 0.08 + Math.sin(tt * 7) * 0.07) : 0;
    // incendios
    let nl = 0;
    for (const b of s.edificios) if (b.fuego > 0 && nl < 36) { const r = TIPOS[b.tipo].radio || 2; for (let i = 0; i < 6 && nl < 40; i++) { const a = i * 1.7 + tt * 0.3, k = 0.7 + Math.sin(tt * 10 + i * 3) * 0.3; _m.compose(_p.set(b.x + Math.cos(a) * r * 0.5, 1 + (i % 3) * 0.7, b.z + Math.sin(a) * r * 0.5), _q.identity(), _s.set(k, k * (1.2 + (i % 2) * 0.5), k)); llamas.setMatrixAt(nl++, _m); } }
    llamas.count = nl; llamas.instanceMatrix.needsUpdate = true;
    // humo: fogata, chimeneas al amanecer y al anochecer (y todo el invierno), herrería trabajando, incendios
    tHumo += dt;
    const emis = [];
    if (F && llama.visible) emis.push([F.x, 1.2, F.z, 1]);
    const cocinan = (hr > 5.5 && hr < 8.5) || (hr > 17 && hr < 21) || fecha(s).est === 3;
    for (const b of s.edificios) {
      if (!b.hecho) continue;
      if (b.tipo === 'casa' && cocinan) { const c = Math.cos(b.rot), sn = Math.sin(b.rot); emis.push([b.x + 1.2 * c + -0.6 * sn, 4.3, b.z - 1.2 * sn + -0.6 * c, 0.5]); }
      if (b.tipo === 'herreria' && s.gente.some((a) => a.acc?.tipo === 'forjar' && a.acc.llego)) { const c = Math.cos(b.rot), sn = Math.sin(b.rot); emis.push([b.x - 1.2 * c - 1 * sn, 4.8, b.z + 1.2 * sn - 1 * c, 1]); }
      if (b.fuego > 0) emis.push([b.x, 3, b.z, 3]);
    }
    const tot = emis.reduce((n, e) => n + e[3], 0);
    let nuevos = Math.min(4, Math.round(dt * 40 + Math.random() * 0.6));
    for (let i = 0; i < NH; i++) {
      if (humoVida[i] < 0) {
        if (!emis.length || nuevos <= 0) continue;
        nuevos--;
        let r = Math.random() * tot, e = emis[0]; for (const x of emis) { r -= x[3]; if (r <= 0) { e = x; break; } }
        humoVida[i] = 0; humoPos.set([e[0] + (Math.random() - 0.5) * 0.4, e[1], e[2] + (Math.random() - 0.5) * 0.4], i * 3);
      } else {
        humoVida[i] += dt; humoPos[i * 3 + 1] += dt * 1.6; humoPos[i * 3] += dt * 0.25 * Math.sin(i + tt * 0.3); humoPos[i * 3 + 2] += dt * 0.15;
        if (humoVida[i] > 5) { humoVida[i] = -1; humoPos[i * 3 + 1] = -50; }
      }
    }
    humoGeo.attributes.position.needsUpdate = true;
    // lluvia y nieve
    const est = fecha(s).est;
    lluvia.visible = s.clima.lluvia > 0 && est !== 3;
    nieve.visible = s.clima.nieve > 0 && est === 3;
    if (lluvia.visible) { for (let i = 0; i < NL; i++) { let y = lluPos[i * 6 + 1] - dt * 30; if (y < 0) y += 40; lluPos[i * 6 + 1] = y; lluPos[i * 6 + 4] = y + 1.1; } lluGeo.attributes.position.needsUpdate = true; }
    if (nieve.visible) { for (let i = 0; i < NN; i++) { let y = niePos[i * 3 + 1] - dt * 2.2; if (y < 0) y += 40; niePos[i * 3 + 1] = y; niePos[i * 3] += Math.sin(tt + i) * dt * 0.3; } nieGeo.attributes.position.needsUpdate = true; }
    // lobos: salen del bosque, rondan y se van
    const Lb = s.lobos && s.t < s.lobos.hasta ? s.lobos : null;
    lobos.forEach((m, i) => {
      m.visible = !!Lb; if (!Lb) return;
      const k = (s.t + s.resto - Lb.t) / (Lb.hasta - Lb.t), ida = Math.sin(Math.min(1, k) * Math.PI), a0 = Math.atan2(Lb.z, Lb.x) + (i - 1.5) * 0.12, r = 34 - ida * 12;
      const x = Math.cos(a0 + Math.sin(tt * 0.4 + i) * 0.05) * r, z = Math.sin(a0 + Math.sin(tt * 0.4 + i) * 0.05) * r;
      m.rotation.y = Math.atan2(-Math.cos(a0) * (k < 0.5 ? 1 : -1), -Math.sin(a0) * (k < 0.5 ? 1 : -1)); m.position.set(x, Math.abs(Math.sin(tt * 8 + i)) * 0.08, z);
    });
    // bandidos: avanzan hacia el punto de ataque y pelean
    const Am = s.amenaza?.tipo === 'bandidos' ? s.amenaza : null;
    bandidos.forEach((p, i) => {
      p.g.visible = !!Am && i < Math.min(6, Am.n); if (!p.g.visible) return;
      const k = Math.min(1, (s.t + s.resto - (Am.hasta - 12 * 60)) / (2 * 60)), a0 = Math.atan2(Am.z, Am.x) + (i - 2.5) * 0.05, r = 44 - (44 - Math.hypot(Am.x, Am.z) - 1.5) * k;
      p.g.position.set(Math.cos(a0) * r, 0, Math.sin(a0) * r); p.g.rotation.y = Math.atan2(-Math.cos(a0), -Math.sin(a0));
      animarPersona(p, k < 1 ? 'corre' : 'golpe', dt);
    });
    // personas: las cercanas a la cámara con cuerpo, el resto como figuras
    camPos.copy(O.controls.target);
    const lejos = O.camera.position.distanceTo(O.controls.target) > 150;
    const orden = s.gente.map((a) => [a, (a.x - camPos.x) ** 2 + (a.z - camPos.z) ** 2]).sort((x, y) => x[1] - y[1]);
    const vivos = new Set(); let nf = 0; gruposDet.length = 0;
    const ix = new Map(s.gente.map((a) => [a.id, a]));
    orden.forEach(([a], i) => {
      vivos.add(a.id);
      let v = vis.get(a.id);
      const tx = a.px + (a.x - a.px) * alfa, tz = a.pz + (a.z - a.pz) * alfa;
      if (!v) { v = { x: tx, z: tz, rot: 0, p: null, k: '' }; vis.set(a.id, v); }
      const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
      if (d > 10) { v.x = tx; v.z = tz; } else { const kk = 1 - Math.exp(-dt * 14); v.x += dx * kk; v.z += dz * kk; }
      const c = a.acc, moviendo = a.ruta.length > 0 && d > 0.002;
      if (moviendo) v.rot = angLerp(v.rot, Math.atan2(dx, dz), Math.min(1, dt * 10));
      else if (c?.ox != null) v.rot = angLerp(v.rot, Math.atan2(c.ox - v.x, c.oz - v.z), Math.min(1, dt * 6));
      let modo = moviendo ? (c?.prisa ? 'corre' : 'camina') : ANIM[c?.tipo] || 'quieto';
      if (!moviendo && c?.tipo === 'dormir' && !a.dentro) modo = 'muerto';
      v.modo = modo;
      const escala = a.ap.alto * (a.edad < 15 ? 0.36 + 0.64 * Math.min(1, a.edad / 15) : a.edad > 70 ? 0.96 : 1);
      let y = 0;
      if (a.edad < 3) { const m = a.padres.map((id) => ix.get(id)).find((p) => p && p.edad >= 3), vm = m && vis.get(m.id); if (vm && !a.dentro) { v.x = vm.x + Math.sin(vm.rot + 1.6) * 0.32; v.z = vm.z + Math.cos(vm.rot + 1.6) * 0.32; v.rot = vm.rot; y = vm.modo === 'sentado' ? 0.35 : 0.85; modo = 'sentado'; } }
      v.y = y;
      const det = !lejos && i < NDET && !a.dentro;
      if (det) {
        const k = claveAspecto(a);
        if (!v.p || v.k !== k) { if (v.p) M.remove(v.p.g); const h = hacerPersona(a); v.p = h.p; v.k = h.k; M.add(v.p.g); }
        v.p.g.visible = true; v.p.g.position.set(v.x, y, v.z); v.p.g.rotation.y = v.rot; v.p.g.scale.setScalar(escala);
        animarPersona(v.p, modo, dt, 1.4);
        gruposDet.push(v.p.g);
      } else {
        if (v.p) v.p.g.visible = false;
        if (!a.dentro && nf < 260) { _m.compose(_p.set(v.x, y, v.z), _q.setFromEuler(_e.set(modo === 'muerto' ? -Math.PI / 2 : 0, v.rot, 0)), _s.setScalar(escala)); if (modo === 'muerto') _m.setPosition(v.x, 0.2, v.z); figuras.setMatrixAt(nf, _m); figuras.setColorAt(nf, _c.setHex(a.ap.ropa)); nf++; }
      }
    });
    figuras.count = nf; figuras.instanceMatrix.needsUpdate = true; if (figuras.instanceColor) figuras.instanceColor.needsUpdate = true;
    for (const [id, v] of vis) if (!vivos.has(id)) { if (v.p) M.remove(v.p.g); vis.delete(id); }
    // anillo bajo la persona elegida
    const vs = sel != null && vis.get(sel), aSel = sel != null && ix.get(sel);
    anillo.visible = !!vs && !aSel?.dentro; if (anillo.visible) { anillo.position.set(vs.x, 0.05, vs.z); anillo.scale.setScalar(1 + Math.sin(tt * 4) * 0.08); }
  }

  // persona tocada: primero por rayo sobre los cuerpos; si no, la más cercana al punto del suelo
  function personaEn(ev, s) {
    const id = O.tocar(ev, gruposDet); if (id != null) return id;
    const p = O.sueloEn(ev); if (!p) return null;
    let mejor = null, md = 2.4;
    for (const a of s.gente) { const v = vis.get(a.id); if (!v || a.dentro) continue; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < md) { md = d; mejor = a.id; } }
    return mejor;
  }
  function edificioEn(ev, s) { const p = O.sueloEn(ev); if (!p) return null; return s.edificios.find((b) => b.tipo !== 'muralla' && Math.hypot(b.x - p.x, b.z - p.z) < (TIPOS[b.tipo].radio || 2) * 0.9)?.id ?? null; }
  function posDe(id) { const v = vis.get(id); return v ? V(v.x, 1.2 + (v.y || 0), v.z) : null; }
  return { actualizar, personaEn, edificioEn, posDe, elegir(id) { sel = id; }, get elegido() { return sel; }, contarLlamadas: () => O.renderer.info.render.calls };
}
