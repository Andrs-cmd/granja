// =====================================================================
// La aldea · maravillas de cada época (solo dibujo). Una estructura enorme por era —círculo de piedras,
// pirámide o zigurat, coliseo, catedral o faro, torre de hierro, rascacielos icónico, cúpula de datos,
// arcología— que ocupa 2×2 o 3×3 celdas. Cada una es UNA malla fundida con color por vértice,
// teñida por la especie que la construyó; mientras se levanta crece desde el suelo con andamios,
// y si la ciudad cae queda en ruinas (baja, gris y ladeada).
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';

const CONO4 = new THREE.ConeGeometry(1, 1, 4), CONO6 = new THREE.ConeGeometry(1, 1, 6), CUP = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), TOR = new THREE.TorusGeometry(1, 0.08, 6, 32);
const mezcla = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

// cada modelo: partes en metros alrededor del centro (y desde el suelo); t = tinte de la especie
const MODELOS = {
  menhires: (t) => { const P = [], piedra = mezcla(0x8f8a80, t, 0.15); for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; P.push([GEO.caja, piedra, Math.cos(a) * 2.3, 1.3, Math.sin(a) * 2.3, 0.55, 2.6, 0.4, 0, -a, 0]); if (i % 2 === 0) { const b = a + 0.31; P.push([GEO.caja, piedra, Math.cos(b) * 2.3, 2.7, Math.sin(b) * 2.3, 1.6, 0.35, 0.45, 0, -b + Math.PI / 2, 0]); } } P.push([GEO.caja, mezcla(0x6e6a62, t, 0.1), 0, 0.4, 0, 1.2, 0.8, 0.7]); return P; },
  piramide: (t) => { const P = [], c = mezcla(0xd8c08a, t, 0.25); for (let i = 0; i < 7; i++) { const w = 8.4 - i * 1.15; P.push([GEO.caja, mezcla(c, 0xffffff, i * 0.02), 0, 0.5 + i * 0.95, 0, w, 0.95, w]); } P.push([CONO4, 0xe0c060, 0, 7.4, 0, 0.8, 1, 0.8, 0, Math.PI / 4, 0], [GEO.caja, mezcla(c, 0x000000, 0.25), 0, 0.6, 4.2, 1, 1.2, 0.2]); return P; },
  zigurat: (t) => { const P = [], c = mezcla(0xb88a5a, t, 0.25); [8, 6.2, 4.4, 2.8].forEach((w, i) => P.push([GEO.caja, mezcla(c, 0xffffff, i * 0.04), 0, 0.75 + i * 1.5, 0, w, 1.5, w])); P.push([GEO.caja, mezcla(c, 0x000000, 0.15), 0, 2.2, 3.4, 1.4, 4.4, 2.4, -0.6, 0, 0], [GEO.caja, 0xd8c8a0, 0, 6.7, 0, 1.8, 1.2, 1.8], [CONO4, 0x3a6aa0, 0, 7.7, 0, 1.4, 0.8, 1.4, 0, Math.PI / 4, 0]); return P; },
  coliseo: (t) => { const P = [], c = mezcla(0xd0c4a8, t, 0.2); for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.28; for (let k = 0; k < 3; k++) P.push([GEO.caja, mezcla(c, 0x000000, k * 0.06), Math.cos(a) * 3.9, 0.8 + k * 1.5, Math.sin(a) * 3.3, 0.45, 1.3, 0.45]); P.push([GEO.caja, c, Math.cos(a) * 3.9, 4.6, Math.sin(a) * 3.3, 0.95, 0.3, 0.7, 0, -a, 0]); } P.push([GEO.cil, 0xc8b080, 0, 0.05, 0, 3.4, 0.1, 2.8]); return P; },
  gran_templo: (t) => { const P = [], c = mezcla(0xe8e0d0, t, 0.2); P.push([GEO.caja, mezcla(c, 0x000000, 0.1), 0, 0.4, 0, 5.4, 0.8, 4.2]); for (let i = 0; i < 6; i++) for (const z of [-1.6, 1.6]) P.push([GEO.cil, c, -2.2 + i * 0.88, 2.3, z, 0.22, 3, 0.22]); P.push([GEO.caja, c, 0, 4, 0, 5.2, 0.5, 4], [CONO4, mezcla(c, 0xc04a2a, 0.3), 0, 4.8, 0, 3.8, 1.2, 2.9, 0, Math.PI / 4, 0]); return P; },
  catedral: (t) => { const P = [], c = mezcla(0xd8d0c0, t, 0.2); P.push([GEO.caja, c, 0, 2.6, -0.4, 3, 5.2, 4.4], [CONO4, 0x5a5a6a, 0, 6.2, -0.4, 2.2, 2, 3.2, 0, Math.PI / 4, 0], [GEO.cil, c, 0, 2, -2.8, 1.4, 4, 1.4]); for (const x of [-1.2, 1.2]) P.push([GEO.caja, c, x, 4.2, 2, 1.1, 8.4, 1.1], [CONO4, 0x5a5a6a, x, 9.4, 2, 0.8, 2.2, 0.8, 0, Math.PI / 4, 0]); P.push([GEO.cil, 0x8a3ac8, 0, 4.6, 2.56, 0.6, 0.05, 0.6, Math.PI / 2, 0, 0], [GEO.caja, 0x3a2a1a, 0, 1, 2.56, 0.8, 2, 0.05]); return P; },
  faro: (t) => { const P = [], c = mezcla(0xf0ece4, t, 0.15); P.push([GEO.cil, 0x8a8478, 0, 0.6, 0, 2.6, 1.2, 2.6]); for (let i = 0; i < 6; i++) P.push([GEO.cil, i % 2 ? 0xc0402a : c, 0, 1.8 + i * 1.6, 0, 1.3 - i * 0.12, 1.6, 1.3 - i * 0.12]); P.push([GEO.cil, 0x3a3a3a, 0, 11.4, 0, 0.9, 0.2, 0.9], [GEO.esfera, 0xffe08a, 0, 12.1, 0, 0.6, 0.6, 0.6], [CONO4, 0x3a3a3a, 0, 13, 0, 0.8, 0.8, 0.8, 0, Math.PI / 4, 0]); return P; },
  observatorio: (t) => { const P = [], c = mezcla(0xe8e4dc, t, 0.2); P.push([GEO.caja, mezcla(c, 0x000000, 0.1), 0, 0.5, 0, 5, 1, 5], [GEO.cil, c, 0, 2.2, 0, 1.9, 2.4, 1.9], [CUP, 0xb0b8c8, 0, 3.4, 0, 1.95, 1.9, 1.95], [GEO.caja, 0x2a2a32, 0, 4.3, 0.6, 0.5, 1.6, 1.4, -0.4, 0, 0], [GEO.cil, 0x6a6a7a, 0, 4.6, 1.2, 0.2, 1.8, 0.2, -0.9, 0, 0]); return P; },
  torre_hierro: (t) => { const P = [], c = mezcla(0x5a4a3e, t, 0.15); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push([GEO.caja, c, x * 1.55, 3, z * 1.55, 0.35, 6.4, 0.35, z * 0.32, 0, -x * 0.32]); P.push([GEO.caja, c, 0, 3.4, 0, 3, 0.25, 3], [GEO.caja, c, 0, 8, 0, 0.9, 7.5, 0.9], [GEO.caja, c, 0, 7, 0, 1.8, 0.2, 1.8], [GEO.cil, c, 0, 13.4, 0, 0.12, 3.4, 0.12], [GEO.esfera, 0xffd27a, 0, 11.8, 0, 0.35, 0.35, 0.35]); return P; },
  gran_fabrica: (t) => { const P = [], c = mezcla(0x9a4a32, t, 0.2); P.push([GEO.caja, c, 0, 1.6, 0, 8, 3.2, 6]); for (let i = 0; i < 4; i++) P.push([GEO.caja, 0x5a5048, -3 + i * 2, 3.6, 0, 1.9, 0.6, 6, 0, 0, 0.45]); for (let i = 0; i < 4; i++) P.push([GEO.cil, mezcla(c, 0x000000, 0.2), -3 + i * 2, 6, -2.4, 0.35, 6, 0.35]); return P; },
  rascacielos: (t) => { const P = [], c = mezcla(0x8aa8c8, t, 0.2); P.push([GEO.caja, c, 0, 7, 0, 4.4, 14, 4.4], [GEO.caja, mezcla(c, 0xffffff, 0.15), 0, 17.5, 0, 3.4, 7, 3.4], [GEO.caja, mezcla(c, 0xffffff, 0.3), 0, 23, 0, 2.2, 4, 2.2], [GEO.cil, 0xd8dde4, 0, 28, 0, 0.12, 6, 0.12]); for (let i = 0; i < 6; i++) P.push([GEO.caja, 0xf0e0a0, 0, 2 + i * 2.3, 2.22, 4, 0.12, 0.02]); return P; },
  estadio: (t) => { const P = [], c = mezcla(0xc8c8c8, t, 0.2); for (let i = 0; i < 30; i++) { const a = (i / 30) * 6.28; P.push([GEO.caja, c, Math.cos(a) * 3.8, 1.4, Math.sin(a) * 3, 1, 2.8, 0.5, Math.sin(a) * 0.5, -a + Math.PI / 2, Math.cos(a) * -0.5]); } P.push([GEO.cil, 0x4f9a3a, 0, 0.08, 0, 3, 0.16, 2.3], [GEO.caja, 0xffffff, 0, 0.18, 0, 0.05, 0.02, 3.6]); for (const [x, z] of [[-4, -3.4], [4, -3.4], [-4, 3.4], [4, 3.4]]) P.push([GEO.cil, 0x8a8a8a, x, 3, z, 0.1, 6, 0.1], [GEO.caja, 0xffffe0, x, 6.1, z, 0.6, 0.3, 0.2]); return P; },
  torre_com: (t) => { const P = [], c = mezcla(0xdde4ea, t, 0.15); P.push([GEO.cil, c, 0, 0.5, 0, 2.2, 1, 2.2], [GEO.cil, c, 0, 12, 0, 0.55, 24, 0.55], [GEO.cil, 0x6a8ab0, 0, 18, 0, 2.2, 1.4, 2.2], [GEO.cil, 0x8ab0d0, 0, 19, 0, 1.6, 0.6, 1.6], [GEO.cil, 0xe04040, 0, 27, 0, 0.08, 6, 0.08], [GEO.esfera, 0xff5050, 0, 30, 0, 0.25, 0.25, 0.25]); return P; },
  cupula_datos: (t) => { const P = [], c = mezcla(0xbfe0f0, t, 0.15); P.push([GEO.cil, 0x8a9aa8, 0, 0.4, 0, 4.3, 0.8, 4.3], [CUP, c, 0, 0.8, 0, 4, 4.2, 4], [TOR, 0x6ad8ff, 0, 2.6, 0, 4.1, 4.1, 4.1, Math.PI / 2, 0, 0], [TOR, 0x6ad8ff, 0, 0.9, 0, 4.4, 4.4, 4.4, Math.PI / 2, 0, 0]); return P; },
  arcologia: (t) => { const P = [], c = mezcla(0xe8eef4, t, 0.2); for (let i = 0; i < 6; i++) { const w = 4.4 - i * 0.65; P.push([CONO6, i % 2 ? 0x6aa85a : c, 0, 2 + i * 3.2, 0, w, 3.4, w]); P.push([GEO.cil, i % 2 ? c : 0x7ac06a, 0, 0.6 + i * 3.2, 0, w * 0.98, 1.2, w * 0.98]); } P.push([GEO.cil, 0xd8e8f4, 0, 21, 0, 0.1, 3, 0.1]); return P; },
  anillo: (t) => { const P = [], c = mezcla(0xd8dee6, t, 0.15); for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28; P.push([GEO.caja, c, Math.cos(a) * 3, 10, Math.sin(a) * 3, 0.7, 20, 0.7, Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1]); } P.push([TOR, 0x9ac8f0, 0, 20.5, 0, 3.6, 3.6, 3.6, Math.PI / 2, 0, 0], [GEO.cil, 0x4a5a6a, 0, 0.3, 0, 4, 0.6, 4], [GEO.cil, 0xe8f4ff, 0, 30, 0, 0.06, 18, 0.06]); return P; },
};
const ALTO = { menhires: 3.2, piramide: 8, zigurat: 8.2, coliseo: 5, gran_templo: 5.5, catedral: 10.5, faro: 13.5, observatorio: 5.4, torre_hierro: 15, gran_fabrica: 9, rascacielos: 31, estadio: 6.3, torre_com: 30, cupula_datos: 5, arcologia: 22.5, anillo: 39 };
const GEOM = new Map();
function geometria(k, tinte) { const key = `${k}:${tinte}`; if (!GEOM.has(key)) GEOM.set(key, fundirGeo((MODELOS[k] || MODELOS.menhires)(tinte))); return GEOM.get(key); }

// crea el dibujante de maravillas sobre el grupo M; alt(x, z) da la altura del terreno
export function crearMonumentos(M, alt) {
  const vivos = new Map();   // id → { mesh, firma }
  const matRuina = new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 1, flatShading: true });
  const andamio = new THREE.Mesh(fundirGeo([[GEO.caja, 0x5e3b22, -1, 0.5, -1, 0.05, 1, 0.05], [GEO.caja, 0x5e3b22, 1, 0.5, -1, 0.05, 1, 0.05], [GEO.caja, 0x5e3b22, -1, 0.5, 1, 0.05, 1, 0.05], [GEO.caja, 0x5e3b22, 1, 0.5, 1, 0.05, 1, 0.05], [GEO.caja, 0xb08a5a, 0, 0.5, 1, 2, 0.03, 0.1], [GEO.caja, 0xb08a5a, 0, 0.5, -1, 2, 0.03, 0.1], [GEO.caja, 0xb08a5a, 1, 0.5, 0, 0.1, 0.03, 2], [GEO.caja, 0xb08a5a, -1, 0.5, 0, 0.1, 0.03, 2]]), MAT_VERTICE);
  const andamios = new THREE.InstancedMesh(andamio.geometry, MAT_VERTICE, 8); andamios.count = 0; M.add(andamios);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  // s: estado; tintes: { especie: color }
  function actualizar(s, tintes, ruinaDe) {
    const lista = s.maravillas || [], ids = new Set();
    let na = 0;
    for (const Mv of lista) {
      ids.add(Mv.id);
      const ru = Mv.ru || ruinaDe(Mv), tinte = tintes[Mv.especie] ?? 0xffffff, firma = `${Mv.k}:${tinte}:${ru}:${Mv.hecha ? 1 : Math.round(Mv.p * 20)}`;
      let V = vivos.get(Mv.id);
      if (!V) { V = { mesh: new THREE.Mesh(geometria(Mv.k, tinte), MAT_VERTICE), firma: '' }; V.mesh.castShadow = V.mesh.receiveShadow = true; V.mesh.userData.maravilla = Mv.id; M.add(V.mesh); vivos.set(Mv.id, V); }
      if (V.firma !== firma) {
        V.firma = firma;
        const k = Mv.hecha ? 1 : Math.max(0.06, Mv.p);
        V.mesh.material = ru ? matRuina : MAT_VERTICE;
        V.mesh.position.set(Mv.x, alt(Mv.x, Mv.z), Mv.z);
        V.mesh.scale.set(1, ru ? 0.45 : k, 1);
        V.mesh.rotation.set(ru ? 0.08 : 0, 0, ru ? -0.06 : 0);
      }
      if (!Mv.hecha && !ru && na < 8) { const h = ALTO[Mv.k] * Math.max(0.15, Mv.p) + 1, w = Mv.tam * 1.5; _m.compose(_p.set(Mv.x, alt(Mv.x, Mv.z), Mv.z), _q.identity(), _s.set(w, h, w)); andamios.setMatrixAt(na++, _m); }
    }
    for (const [id, V] of vivos) if (!ids.has(id)) { M.remove(V.mesh); vivos.delete(id); }
    andamios.count = na; andamios.instanceMatrix.needsUpdate = true;
  }
  return { actualizar };
}
