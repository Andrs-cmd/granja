// =====================================================================
// Civilizaciones — dibuja el estado de la simulación con three (no decide nada: solo mira E).
// Presupuesto de llamadas de dibujo: terreno, agua, fronteras, árboles, rocas, ruinas = 6; ciudades =
// UNA malla fundida por civilización (≤ 9); tropas = un InstancedMesh por tipo de unidad (~22);
// partículas = 2; velo, mira y monstruos unas pocas más. Total < ~60 (más la pasada de sombras).
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BIOMAS, B, TAM, PASO, celdaCercana } from './sim.js';
import { ESTILOS } from './facciones.js';
import { PODERES } from './poderes.js';
import { crearTropas } from './tropas.js';

const _o = new THREE.Object3D(), _c = new THREE.Color(), _c2 = new THREE.Color(), _p = new THREE.Vector3();
export const eraVis = (era) => (era <= 1 ? 0 : era <= 3 ? 1 : era === 4 ? 2 : 3); // chozas → castillos → fuertes → fábricas
const azarito = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// ---------------------------------------------------------------- ciudades low-poly según tamaño, era y estilo del pueblo
function partesCiudad(nivel, ev, colorCiv, id, capital, era, estilo, brecha, ox, oy, oz) {
  const R = azarito(id * 977 + 13), P = [], civ = new THREE.Color(colorCiv), osc = civ.clone().multiplyScalar(0.62).getHex(), cv = civ.getHex(), S = ESTILOS[estilo] || ESTILOS.piedra;
  const piedra = S.muro, madera = 0x8a6440, paja = 0xd9bb62, crema = S.casa, ladrillo = estilo === 'mecanico' ? 0x6a7076 : 0xa4573c, concreto = 0x9aa0a6, vidrio = 0x7fb0cc;
  const nCasas = [4, 8, 13, 20][nivel] + (capital ? 2 : 0), radio = [0.62, 0.95, 1.3, 1.65][nivel];
  const sitio = (k, n, r0 = 0.28) => { const a = k * 2.399 + R() * 0.5, r = r0 + Math.sqrt((k + 0.5) / n) * (radio - r0); return [Math.cos(a) * r, Math.sin(a) * r, a]; };
  const techo = (x, y, z, w, a) => {
    if (S.techo === 'plano') P.push([GEO.caja, osc, x, y - 0.03, z, w * 1.05, 0.04, w * 1.05, 0, a]);
    else if (S.techo === 'cupula') P.push([GEO.esfera, S.techo === 'cupula' && estilo === 'hielo' ? 0xf4f8fb : osc, x, y - 0.06, z, w * 0.6, w * 0.5, w * 0.6]);
    else if (S.techo === 'pincho') P.push([GEO.cono, osc, x, y + 0.05, z, w * 0.5, 0.32, w * 0.5, 0, a]);
    else if (S.techo === 'piramide') P.push([GEO.cono, 0xe2c46a, x, y, z, w * 0.8, 0.22, w * 0.8, 0, a + Math.PI / 4]);
    else P.push([GEO.cono, osc, x, y, z, w * 0.85, 0.18, w * 0.85, 0, a + Math.PI / 4]);
  };
  for (let k = 0; k < nCasas; k++) {
    const [x, z, a] = sitio(k, nCasas);
    if (ev === 0) { if (estilo === 'hielo' || estilo === 'organico') P.push([GEO.esfera, crema, x, 0.05, z, 0.17, 0.15, 0.17]); else P.push([GEO.cil, estilo === 'adobe' ? crema : madera, x, 0.1, z, 0.13, 0.2, 0.13], [GEO.cono, paja, x, 0.28, z, 0.19, 0.18, 0.19]); }
    else if (ev === 1) { const w = 0.2 + R() * 0.08; P.push([GEO.caja, crema, x, 0.11, z, w, 0.22, w * 1.1, 0, a]); techo(x, 0.3, z, w, a); }
    else if (ev === 2) { const w = 0.22 + R() * 0.06, h = 0.28 + R() * 0.14; P.push([GEO.caja, R() < 0.5 ? crema : ladrillo, x, h / 2, z, w, h, w, 0, a]); techo(x, h + 0.08, z, w, a); }
    else { const w = 0.2 + R() * 0.1, h = (0.25 + R() * 0.35) * (1 + nivel * 0.25) * (era >= 6 ? 1.3 : 1); P.push([GEO.caja, R() < 0.5 ? concreto : ladrillo, x, h / 2, z, w, h, w, 0, a]); }
  }
  if (ev === 0) {
    P.push([GEO.cono, 0xff8a3a, 0, 0.08, 0, 0.08, 0.16, 0.08]);
    if (nivel >= 1) P.push([GEO.caja, piedra, 0, 0.12, 0, 0.5, 0.24, 0.5], [GEO.caja, piedra, 0, 0.32, 0, 0.34, 0.18, 0.34], [GEO.caja, piedra, 0, 0.48, 0, 0.18, 0.14, 0.18]);
    if (nivel >= 2) for (let k = 0; k < 22; k++) { if (brecha && k % 3 === 0) continue; const a = (k / 22) * Math.PI * 2; P.push([GEO.cil, madera, Math.cos(a) * (radio + 0.12), 0.14, Math.sin(a) * (radio + 0.12), 0.035, 0.28, 0.035]); }
  } else if (ev === 1 || ev === 2) {
    const tk = nivel >= 2 ? 0.42 : 0.3, alto = 0.5 + nivel * 0.18;
    if (estilo === 'dorado') P.push([GEO.caja, piedra, 0, 0.12, 0, 0.6, 0.24, 0.6], [GEO.caja, piedra, 0, 0.34, 0, 0.42, 0.2, 0.42], [GEO.caja, piedra, 0, 0.52, 0, 0.26, 0.18, 0.26], [GEO.caja, cv, 0, 0.66, 0, 0.12, 0.1, 0.12]);
    else {
      P.push([GEO.caja, piedra, 0, alto / 2, 0, tk, alto, tk]);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push([GEO.cil, piedra, sx * tk * 0.6, alto * 0.6, sz * tk * 0.6, 0.08, alto * 1.2, 0.08], [estilo === 'oscuro' ? GEO.cono : GEO.cono, cv, sx * tk * 0.6, alto * 1.2 + (estilo === 'oscuro' ? 0.18 : 0.08), sz * tk * 0.6, 0.11, estilo === 'oscuro' ? 0.45 : 0.18, 0.11]);
    }
    if (ev === 2 && nivel >= 1) P.push([GEO.esfera, 0xd8d2c4, 0.55, 0.42, 0.2, 0.2, 0.2, 0.2], [GEO.caja, crema, 0.55, 0.18, 0.2, 0.36, 0.36, 0.36]);
    if (nivel >= 2) {
      const lados = ev === 2 ? 5 : 10, rr = radio + 0.15;
      for (let k = 0; k < lados; k++) {
        if (brecha && k % 3 === 1) continue; // brecha: faltan tramos de muralla
        const a0 = (k / lados) * Math.PI * 2, a1 = ((k + 1) / lados) * Math.PI * 2, mx = (Math.cos(a0) + Math.cos(a1)) / 2 * rr, mz = (Math.sin(a0) + Math.sin(a1)) / 2 * rr, lar = 2 * rr * Math.sin(Math.PI / lados);
        P.push([GEO.caja, piedra, mx, 0.13, mz, lar, 0.26, 0.07, 0, -(a0 + a1) / 2 + Math.PI / 2]);
        if (ev === 2) P.push([GEO.cono, piedra, Math.cos(a0) * rr, 0.14, Math.sin(a0) * rr, 0.22, 0.28, 0.22, 0, a0, 0]);
        else P.push([GEO.cil, piedra, Math.cos(a0) * rr, 0.2, Math.sin(a0) * rr, 0.07, 0.4, 0.07]);
      }
    }
  } else {
    const nf = nivel >= 1 ? 1 + (nivel >= 3 ? 1 : 0) : 0;
    for (let f = 0; f < nf; f++) { const a = f * 2.4 + 1, x = Math.cos(a) * radio * 0.7, z = Math.sin(a) * radio * 0.7; P.push([GEO.caja, ladrillo, x, 0.16, z, 0.5, 0.32, 0.3, 0, a], [GEO.cil, 0x6a4a3a, x + 0.12, 0.5, z, 0.05, 0.7, 0.05], [GEO.cil, 0x6a4a3a, x - 0.1, 0.45, z + 0.05, 0.05, 0.6, 0.05]); }
    const nt = nivel >= 2 ? (nivel - 1) * 3 + (era >= 6 ? 3 : 0) : 0;
    for (let k = 0; k < nt; k++) { const [x, z] = sitio(k, nt + 1, 0.05), h = (0.9 + R() * 1.1) * (era >= 6 ? 1.5 : 1) * (nivel === 3 ? 1.2 : 0.8); P.push([GEO.caja, R() < 0.5 ? vidrio : concreto, x * 0.6, h / 2, z * 0.6, 0.22, h, 0.22], [GEO.caja, cv, x * 0.6, h + 0.03, z * 0.6, 0.24, 0.06, 0.24]); }
    if (nivel === 0) P.push([GEO.caja, crema, 0, 0.15, 0, 0.3, 0.3, 0.3]);
  }
  const hb = (ev === 3 ? 1.4 : 1.0) + nivel * 0.25 + (capital ? 0.3 : 0), fb = capital ? 1.4 : 1;
  P.push([GEO.cil, 0x5a5048, 0.05, hb / 2, 0.05, 0.02, hb, 0.02], [GEO.caja, cv, 0.05 + 0.17 * fb, hb - 0.1 * fb, 0.05, 0.32 * fb, 0.2 * fb, 0.015]);
  if (capital) P.push([GEO.esfera, 0xf1c40f, 0.05, hb + 0.04, 0.05, 0.05, 0.05, 0.05]);
  for (const p of P) { p[2] = (p[2] || 0) + ox; p[3] = (p[3] || 0) + oy; p[4] = (p[4] || 0) + oz; }
  return P;
}
function chimeneas(nivel, ev) { if (ev !== 3 || nivel < 1) return []; const radio = [0.62, 0.95, 1.3, 1.65][nivel], l = []; for (let f = 0; f < 1 + (nivel >= 3 ? 1 : 0); f++) { const a = f * 2.4 + 1; l.push([Math.cos(a) * radio * 0.7 + 0.12, 0.85, Math.sin(a) * radio * 0.7]); } return l; }

// ---------------------------------------------------------------- partículas (humo, fuego, chispas): una llamada por sistema
function crearParticulas(max, aditivo) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 4), tam = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uEsc: { value: 400 } },
    vertexShader: 'uniform float uEsc; attribute vec4 aCol; attribute float aTam; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aTam * uEsc / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(.5, .12, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  const P = [];
  return {
    obj: pts, mat,
    emitir(p) { if (P.length < max) P.push({ t: 0, grav: 0, crece: 0, ...p }); },
    actualizar(dt) {
      let n = 0;
      for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += dt; if (p.t >= p.vida) { P[i] = P[P.length - 1]; P.pop(); } }
      for (const p of P) {
        p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = 1 - p.t / p.vida;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; col[n * 4] = p.r; col[n * 4 + 1] = p.g; col[n * 4 + 2] = p.b; col[n * 4 + 3] = p.a * Math.min(1, k * 2.2) * Math.min(1, p.t * 8);
        tam[n] = p.tam * (1 + p.crece * (1 - k)); n++;
      }
      geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = geo.attributes.aCol.needsUpdate = geo.attributes.aTam.needsUpdate = true;
    },
    get n() { return P.length; },
  };
}

// ---------------------------------------------------------------- monstruos (grupos con pocas mallas)
function crearDragon() {
  const g = new THREE.Group(), cuerpo = new THREE.Mesh(fundirGeo([[GEO.capsula, 0x8a1e1e, 0, 0, 0, 0.5, 1.4, 0.5, Math.PI / 2, 0, 0], [GEO.esfera, 0x8a1e1e, 0, 0.15, 0.95, 0.32, 0.28, 0.4], [GEO.cono, 0xf2e2b0, -0.15, 0.4, 0.85, 0.05, 0.25, 0.05], [GEO.cono, 0xf2e2b0, 0.15, 0.4, 0.85, 0.05, 0.25, 0.05],
    [GEO.cono, 0x5a1010, 0, 0, -1.3, 0.2, 1.2, 0.2, -Math.PI / 2, 0, 0], ...[0, 1, 2, 3].map((k) => [GEO.cono, 0xd4a020, 0, 0.42, 0.5 - k * 0.35, 0.08, 0.2, 0.08])]), MAT_VERTICE);
  const ala = (s) => { const w = new THREE.Mesh(fundirGeo([[GEO.caja, 0x6a1414, s * 0.9, 0, 0, 1.8, 0.04, 1, 0, 0, 0]]), MAT_VERTICE); const p = new THREE.Group(); p.add(w); p.position.set(s * 0.3, 0.2, 0.1); g.add(p); return p; };
  g.add(cuerpo); const alas = [ala(-1), ala(1)]; cuerpo.castShadow = true; g.userData.alas = alas; return g;
}
function crearKraken() {
  const g = new THREE.Group(); g.add(new THREE.Mesh(fundirGeo([[GEO.esfera, 0x5a2a6a, 0, 0.3, 0, 0.7, 0.6, 0.7], [GEO.esfera, 0xf2e26a, -0.25, 0.55, 0.55, 0.12, 0.12, 0.08], [GEO.esfera, 0xf2e26a, 0.25, 0.55, 0.55, 0.12, 0.12, 0.08]]), MAT_VERTICE));
  const t = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, p = new THREE.Group(); p.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); p.add(new THREE.Mesh(fundirGeo([[GEO.cono, 0x6a3a7a, 0, 0.9, 0, 0.18, 1.8, 0.18]]), MAT_VERTICE)); g.add(p); t.push(p); }
  g.userData.tent = t; return g;
}

// ---------------------------------------------------------------- la escena
export function crearEscena(O, { etiquetas = null } = {}) {
  const raiz = new THREE.Group(); O.mundo.add(raiz);
  let M = null, E = null, verTerreno = null, verMapa = -1;
  const geoHex = new THREE.CylinderGeometry(TAM * 0.985, TAM * 0.985, 1, 6); geoHex.translate(0, 0.5, 0);
  const matHex = new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true });
  let terreno = null, arboles = null, rocas = null, fronteras = null, velo = null, ruinas = null;
  const grupoCiud = new THREE.Group(); raiz.add(grupoCiud);
  const geoCiu = new Map(), mallaCiv = new Map(); let civSucias = new Set(), tCiud = 0;
  const agua = new THREE.Mesh(new THREE.CircleGeometry(O.R + 0.3, 72), new THREE.MeshStandardMaterial({ color: 0x2f78a8, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, depthWrite: false }));
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.3; agua.renderOrder = 1; raiz.add(agua);
  const humo = crearParticulas(1400, false), fuego = crearParticulas(1400, true); raiz.add(humo.obj, fuego.obj);
  const alturaCelda = (i) => M.h[i] - (M.rio[i] && M.bioma[i] > 1 ? 0.12 : 0);
  const tope = (i) => (M.bioma[i] <= 1 ? 0.3 : alturaCelda(i));
  const topeXZ = (x, z) => { const i = celdaCercana(M, x, z); return i < 0 ? 0.3 : tope(i); };
  const posCelda = (i) => new THREE.Vector3(M.x[i], tope(i), M.z[i]);
  function chispas(x, y, z, n, col = [1, 0.8, 0.3]) { for (let i = 0; i < n; i++) fuego.emitir({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, grav: 6, vida: 0.35 + Math.random() * 0.35, tam: 0.12, r: col[0], g: col[1], b: col[2], a: 1 }); }
  function llamas(x, y, z, fuerte) {
    fuego.emitir({ x: x + (Math.random() - 0.5) * (fuerte ? 1.6 : 0.8), y: y + 0.2, z: z + (Math.random() - 0.5) * (fuerte ? 1.6 : 0.8), vx: 0, vy: 1.2 + Math.random(), vz: 0, vida: 0.6 + Math.random() * 0.5, tam: fuerte ? 0.55 : 0.4, crece: -0.5, r: 1, g: 0.45 + Math.random() * 0.25, b: 0.1, a: 0.9 });
    if (Math.random() < 0.5) humo.emitir({ x: x + (Math.random() - 0.5), y: y + 0.8, z: z + (Math.random() - 0.5), vx: 0.25, vy: 0.9, vz: 0.1, vida: 3, tam: 0.6, crece: 2.5, r: 0.12, g: 0.11, b: 0.1, a: 0.5 });
  }
  const tropas = crearTropas(raiz, { chispas, humo, fuego, tope: (x, z) => topeXZ(x, z) });
  const meteoros = [], monstruos = new Map(), etqs = new Map();
  const geoMeteoro = new THREE.IcosahedronGeometry(1, 0), matMeteoro = new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: 0xff5a1a, emissiveIntensity: 1.5, flatShading: true });
  let temblor = 0, ultimoEf = -1, eclipse = 0, olas = [];
  // mira para apuntar poderes: anillo + disco pulsante
  const mira = new THREE.Group(); mira.visible = false; raiz.add(mira);
  const miraAnillo = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
  const miraDisco = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthTest: false }));
  for (const m of [miraAnillo, miraDisco]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 20; mira.add(m); }
  const geoOla = new THREE.RingGeometry(0.9, 1, 64), matOla = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });

  // ------------------------------------------------------------ terreno, árboles, rocas, ruinas
  function construirTerreno() {
    for (const m of [terreno, arboles, rocas]) if (m) { raiz.remove(m); if (m.geometry !== geoHex) m.geometry.dispose(); m.dispose?.(); }
    terreno = new THREE.InstancedMesh(geoHex, matHex, M.n); terreno.receiveShadow = true; terreno.castShadow = true;
    for (let i = 0; i < M.n; i++) { _o.position.set(M.x[i], -0.35, M.z[i]); _o.scale.set(1, alturaCelda(i) + 0.35, 1); _o.rotation.set(0, 0, 0); _o.updateMatrix(); terreno.setMatrixAt(i, _o.matrix); terreno.setColorAt(i, _c.set(0xffffff)); }
    raiz.add(terreno);
    const lista = [];
    for (let i = 0; i < M.n; i++) { const b = M.bioma[i]; const k = b === B.BOSQUE || b === B.SELVA ? 2 : b === B.TUNDRA && (i * 7) % 3 === 0 ? 1 : 0; for (let j = 0; j < k; j++) lista.push([i, j]); }
    arboles = new THREE.InstancedMesh(fundirGeo([[GEO.cil, 0x6a4a30, 0, 0.18, 0, 0.06, 0.36, 0.06], [GEO.cono, 0x3f7a3a, 0, 0.62, 0, 0.32, 0.62, 0.32], [GEO.cono, 0x4f8a40, 0, 0.9, 0, 0.22, 0.42, 0.22]]), MAT_VERTICE, Math.max(1, lista.length));
    arboles.userData.lista = lista; arboles.castShadow = true;
    const R = azarito(E.semilla);
    lista.forEach(([i, j], k) => {
      const a = R() * 6.28, r = 0.25 + R() * 0.45, s = 0.42 + R() * 0.35;
      _o.position.set(M.x[i] + Math.cos(a + j * 3) * r, alturaCelda(i), M.z[i] + Math.sin(a + j * 3) * r); _o.scale.setScalar(s * (M.bioma[i] === B.TUNDRA ? 0.8 : 1)); _o.rotation.set(0, a, 0); _o.updateMatrix(); arboles.setMatrixAt(k, _o.matrix);
      arboles.setColorAt(k, _c.set(M.bioma[i] === B.SELVA ? 0x8fc08a : M.bioma[i] === B.TUNDRA ? 0xc8d8cc : 0xffffff));
    });
    arboles.count = lista.length; arboles.userData.mat0 = arboles.instanceMatrix.array.slice(); raiz.add(arboles);
    const picos = []; for (let i = 0; i < M.n; i++) if (M.bioma[i] === B.MONTANA || (M.bioma[i] === B.NIEVE && M.a[i] > 0.7)) picos.push(i);
    rocas = new THREE.InstancedMesh(fundirGeo([[new THREE.ConeGeometry(1, 1, 5), 0x8a8378, 0, 0.5, 0, 1, 1, 1]]), MAT_VERTICE, Math.max(1, picos.length)); rocas.castShadow = true;
    picos.forEach((i, k) => { const s = 0.6 + Math.max(0, M.a[i] - 0.7) * 2.2; _o.position.set(M.x[i], alturaCelda(i) - 0.05, M.z[i]); _o.scale.set(TAM * 0.8, s * 1.6, TAM * 0.8); _o.rotation.set(0, i, 0); _o.updateMatrix(); rocas.setMatrixAt(k, _o.matrix); rocas.setColorAt(k, _c.set(M.bioma[i] === B.NIEVE ? 0xf4f7fa : 0xffffff)); });
    rocas.count = picos.length; raiz.add(rocas);
    verTerreno = null;
  }
  function pintarTerreno() {
    for (let i = 0; i < M.n; i++) {
      const b = M.bioma[i]; _c.set(BIOMAS[b].c); const v = ((i * 2654435761) >>> 24) / 255 * 0.08 - 0.04; _c.offsetHSL(0, 0, v);
      if (M.rio[i] && b > 1) _c.lerp(_c2.set(0x3f8fb0), 0.55);
      const d = E.dueno[i];
      if (d >= 0 && E.civs[d]) { let borde = false; for (const j of M.vec[i]) if (E.dueno[j] !== d) { borde = true; break; } _c.lerp(_c2.set(E.civs[d].color), b <= 1 ? 0.22 : borde ? 0.45 : 0.22); }
      terreno.setColorAt(i, _c);
    }
    terreno.instanceColor.needsUpdate = true;
    construirFronteras();
  }
  function construirFronteras() {
    if (fronteras) { raiz.remove(fronteras); fronteras.geometry.dispose(); }
    const pos = [], col = [];
    for (let i = 0; i < M.n; i++) {
      const d = E.dueno[i]; if (d < 0 || !E.civs[d]) continue; _c.set(E.civs[d].color).offsetHSL(0, 0.1, 0.08);
      for (const j of M.vec[i]) {
        if (E.dueno[j] === d) continue;
        const ang = Math.atan2(M.z[j] - M.z[i], M.x[j] - M.x[i]), y = tope(i) + 0.03, rc = TAM * 0.985, ri = rc - 0.3;
        const p = (a, r) => [M.x[i] + Math.cos(a) * r, y, M.z[i] + Math.sin(a) * r];
        const a1 = ang - Math.PI / 6, a2 = ang + Math.PI / 6, q1 = p(a1, rc), q2 = p(a2, rc), q3 = p(a2, ri), q4 = p(a1, ri);
        for (const q of [q1, q2, q3, q1, q3, q4]) { pos.push(...q); col.push(_c.r, _c.g, _c.b); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fronteras = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); fronteras.renderOrder = 2; raiz.add(fronteras);
  }
  function construirVelo() {
    if (velo) { raiz.remove(velo); velo.geometry.dispose(); velo = null; }
    if (!E.velo || E.año >= E.velo + 4) return;
    const pos = [], uv = [];
    for (let i = 0; i < M.n; i++) for (const j of M.vec[i]) {
      if (j < i || E.zona[i] === E.zona[j]) continue;
      const ang = Math.atan2(M.z[j] - M.z[i], M.x[j] - M.x[i]), rc = TAM * 0.985, a1 = ang - Math.PI / 6, a2 = ang + Math.PI / 6;
      const x1 = M.x[i] + Math.cos(a1) * rc, z1 = M.z[i] + Math.sin(a1) * rc, x2 = M.x[i] + Math.cos(a2) * rc, z2 = M.z[i] + Math.sin(a2) * rc, H = 9;
      pos.push(x1, 0, z1, x2, 0, z2, x2, H, z2, x1, 0, z1, x2, H, z2, x1, H, z1); uv.push(x1, 0, x2, 0, x2, 1, x1, 0, x2, 1, x1, 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform float uT, uA; varying vec2 vU; varying vec3 vP; void main(){ float o = sin(vP.x * .7 + uT * 1.3) * .5 + sin(vP.z * .9 - uT) * .5; float a = (1. - vU.y) * (.35 + .25 * o) * smoothstep(0., .15, vU.y + .02); gl_FragColor = vec4(vec3(.75, .72, 1.) * a * uA, 1.); }' });
    velo = new THREE.Mesh(g, mat); velo.renderOrder = 6; raiz.add(velo);
  }
  function construirRuinas() {
    if (ruinas) { raiz.remove(ruinas); ruinas.geometry.dispose(); ruinas.dispose(); }
    const l = E.ruinas || []; ruinas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0x5a5550, 0.2, 0.08, 0.1, 0.3, 0.16, 0.2, 0, 0.4], [GEO.caja, 0x4a4540, -0.2, 0.12, -0.15, 0.22, 0.24, 0.22, 0, 1], [GEO.cil, 0x6a6560, 0.05, 0.2, -0.3, 0.06, 0.4, 0.06, 0.3, 0, 0.2], [GEO.caja, 0x3a3530, -0.1, 0.05, 0.3, 0.4, 0.1, 0.25]]), MAT_VERTICE, Math.max(1, l.length));
    l.forEach((r, k) => { _o.position.set(M.x[r.celda], tope(r.celda), M.z[r.celda]); _o.scale.setScalar(1.5); _o.rotation.set(0, k, 0); _o.updateMatrix(); ruinas.setMatrixAt(k, _o.matrix); });
    ruinas.count = l.length; ruinas.userData.n = l.length; ruinas.userData.ult = l[l.length - 1]?.celda; raiz.add(ruinas);
  }

  // ------------------------------------------------------------ ciudades: geometría por ciudad (en caché), fundidas por civilización
  function sincronizarCiudades(forzar = false) {
    const vivos = new Set();
    for (const ci of E.ciudades) {
      vivos.add(ci.id); const civ = E.civs[ci.civ]; if (!civ) continue; const ev = eraVis(civ.era), q = ci.fuego > 0, brecha = (ci.muralla ?? 1) < 0.4;
      const clave = `${ci.civ}|${ci.nivel}|${ev}|${civ.color}|${q ? 1 : 0}|${ci.capital ? 1 : 0}|${civ.era >= 6 ? 1 : 0}|${brecha ? 1 : 0}|${civ.estilo}|${ci.celda}|${M.h[ci.celda]}`;
      const c = geoCiu.get(ci.id);
      if (!c || c.clave !== clave) {
        if (c) { c.geo.dispose(); civSucias.add(c.civ); }
        const partes = partesCiudad(ci.nivel, ev, civ.color, ci.id, ci.capital, civ.era, civ.estilo, brecha, M.x[ci.celda], tope(ci.celda), M.z[ci.celda]);
        if (q) for (const p of partes) p[1] = new THREE.Color(p[1]).multiplyScalar(0.32).getHex();
        geoCiu.set(ci.id, { geo: fundirGeo(partes), clave, civ: ci.civ, chim: chimeneas(ci.nivel, ev) }); civSucias.add(ci.civ);
        if (arboles) despejarArboles();
      }
    }
    for (const [id, c] of geoCiu) if (!vivos.has(id)) { c.geo.dispose(); geoCiu.delete(id); civSucias.add(c.civ); despejarArboles(); }
    if (!civSucias.size || (!forzar && tCiud < 0.25)) return;
    tCiud = 0;
    for (const cid of civSucias) {
      const vieja = mallaCiv.get(cid); if (vieja) { grupoCiud.remove(vieja); vieja.geometry.dispose(); mallaCiv.delete(cid); }
      const geos = [...geoCiu.values()].filter((c) => c.civ === cid).map((c) => c.geo); if (!geos.length) continue;
      const m = new THREE.Mesh(geos.length === 1 ? geos[0].clone() : mergeGeometries(geos), MAT_VERTICE); m.castShadow = m.receiveShadow = true; m.userData.civ = cid; grupoCiud.add(m); mallaCiv.set(cid, m);
    }
    civSucias = new Set();
  }
  function despejarArboles() {
    const a = arboles.instanceMatrix.array, a0 = arboles.userData.mat0;
    arboles.userData.lista.forEach(([i], k) => {
      let tala = false; for (const ci of E.ciudades) { const dx = M.x[ci.celda] - M.x[i], dz = M.z[ci.celda] - M.z[i], r = [1.0, 1.4, 1.9, 2.3][ci.nivel]; if (dx * dx + dz * dz < r * r) { tala = true; break; } }
      for (let q = 0; q < 16; q++) a[k * 16 + q] = tala ? 0 : a0[k * 16 + q];
    });
    arboles.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ efectos nuevos de la simulación (batallas, caídas, poderes…)
  const lluvia = (x, y, z, r, n, col, vy = -6) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; fuego.emitir({ x: x + Math.cos(a) * d, y: y + 5 + Math.random() * 3, z: z + Math.sin(a) * d, vx: 0, vy, vz: 0, vida: 1, tam: 0.1, r: col[0], g: col[1], b: col[2], a: 0.8 }); } };
  const nube = (x, y, z, r, n, col, a = 0.4, vida = 3) => { for (let k = 0; k < n; k++) { const ang = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; humo.emitir({ x: x + Math.cos(ang) * d, y: y + 0.3 + Math.random(), z: z + Math.sin(ang) * d, vx: 0, vy: 0.3, vz: 0, vida, tam: 0.8, crece: 2, r: col[0], g: col[1], b: col[2], a }); } };
  function procesarEfectos() {
    for (const f of E.efectos) {
      if (f.id <= ultimoEf) continue; ultimoEf = f.id;
      const i = f.celda; if (i == null || i < 0 || i >= M.n) continue; const x = M.x[i], y = tope(i), z = M.z[i], R = (f.radio || 3) * PASO;
      const col = f.civ != null && E.civs[f.civ] ? new THREE.Color(E.civs[f.civ].color) : null;
      switch (f.t) {
        case 'batalla': chispas(x, y + 0.5, z, 24); nube(x, y, z, 1, 8, [0.55, 0.52, 0.48], 0.45, 2.5); break;
        case 'fin_batalla': chispas(x, y + 0.6, z, 12, [1, 0.95, 0.6]); break;
        case 'caida': for (let k = 0; k < (f.arrasada ? 40 : 18); k++) llamas(x, y, z, true); chispas(x, y + 1, z, 30); break;
        case 'refugiados': if (f.a != null) tropas.refugiados(posCelda(i), posCelda(f.a), f.n || 100, E.civs[f.civ]?.color || '#888'); break;
        case 'saqueo': for (let k = 0; k < 8; k++) llamas(x, y, z, false); break;
        case 'traicion': nube(x, y, z, 1.2, 14, [0.1, 0.08, 0.12], 0.6); break;
        case 'plaga': case 'poder_plaga': nube(x, y, z, 2.5, 22, [0.45, 0.6, 0.2], 0.4, 4); break;
        case 'contacto': case 'velo': case 'senal': case 'poder_senal': {
          const ca = f.a != null && E.civs[f.a] ? new THREE.Color(E.civs[f.a].color) : new THREE.Color(0xd8d0ff), cb = f.b != null && E.civs[f.b] ? new THREE.Color(E.civs[f.b].color) : ca;
          const destino = f.otra != null ? posCelda(f.otra) : null;
          for (let k = 0; k < 90; k++) { const q = k % 2 ? ca : cb; if (destino) { const u = k / 90, px = x + (destino.x - x) * u, pz = z + (destino.z - z) * u, py = y + Math.sin(Math.PI * u) * 6; const arco = new THREE.Color().setHSL(u, 0.8, 0.6); fuego.emitir({ x: px, y: py, z: pz, vx: 0, vy: 0.1, vz: 0, vida: 4, tam: 0.35, r: arco.r, g: arco.g, b: arco.b, a: 1 }); } else { const a = Math.random() * 6.28, r = Math.random() * (f.t === 'velo' ? 30 : 3); fuego.emitir({ x: x + Math.cos(a) * r, y: y + 0.3 + Math.random() * 2, z: z + Math.sin(a) * r, vx: 0, vy: 0.8 + Math.random(), vz: 0, vida: 2.5 + Math.random() * 1.5, tam: 0.25, r: q.r, g: q.g, b: q.b, a: 1 }); } }
          break;
        }
        case 'fundacion': nube(x, y, z, 0.5, 6, [0.8, 0.75, 0.6], 0.35, 1.4); break;
        case 'monstruo_muere': chispas(x, y + 1, z, 60, [1, 0.9, 0.5]); nube(x, y, z, 1.5, 16, [0.3, 0.25, 0.3], 0.5); break;
        case 'poder_meteorito': { const m = new THREE.Mesh(geoMeteoro, matMeteoro); m.scale.setScalar(0.9); m.position.set(x + 30, 60, z - 20); raiz.add(m); meteoros.push({ m, x, y, z, t: 0 }); break; }
        case 'poder_terremoto': temblor = 1.8; nube(x, y, z, R, 40, [0.6, 0.52, 0.4], 0.4); break;
        case 'poder_volcan': temblor = 1.5; for (let k = 0; k < 80; k++) fuego.emitir({ x, y: y + 1.5, z, vx: (Math.random() - 0.5) * 4, vy: 4 + Math.random() * 5, vz: (Math.random() - 0.5) * 4, grav: 5, vida: 2 + Math.random(), tam: 0.3, r: 1, g: 0.35 + Math.random() * 0.3, b: 0.05, a: 1 }); nube(x, y + 2, z, 1, 40, [0.18, 0.16, 0.15], 0.6, 6); break;
        case 'poder_tsunami': olas.push({ x, z, t: 0, R: R + 2 }); break;
        case 'poder_glaciacion': lluvia(x, y, z, R, 160, [0.95, 0.97, 1], -2); break;
        case 'poder_incendio': for (let k = 0; k < 60; k++) { const a = Math.random() * 6.28, d = Math.random() * R; llamas(x + Math.cos(a) * d, y, z + Math.sin(a) * d, true); } break;
        case 'poder_fertil': case 'poder_sembrar': case 'poder_cosecha': case 'poder_natalidad': case 'poder_curacion': for (let k = 0; k < 70; k++) { const a = Math.random() * 6.28, d = Math.random() * Math.max(2, R); fuego.emitir({ x: x + Math.cos(a) * d, y: y + Math.random() * 2, z: z + Math.sin(a) * d, vx: 0, vy: 0.6, vz: 0, vida: 2.5, tam: 0.18, r: f.t === 'poder_cosecha' ? 1 : 0.5, g: 0.95, b: f.t === 'poder_cosecha' ? 0.4 : 0.35, a: 1 }); } break;
        case 'poder_lluvia': lluvia(x, y, z, R, 220, [0.6, 0.8, 1]); break;
        case 'poder_sequia': nube(x, y, z, R, 40, [0.85, 0.6, 0.3], 0.35, 4); break;
        case 'poder_langostas': for (let k = 0; k < 160; k++) { const a = Math.random() * 6.28, d = Math.random() * R; humo.emitir({ x: x + Math.cos(a) * d, y: y + 0.5 + Math.random() * 1.5, z: z + Math.sin(a) * d, vx: (Math.random() - 0.5) * 2, vy: 0.1, vz: (Math.random() - 0.5) * 2, vida: 4, tam: 0.08, r: 0.15, g: 0.12, b: 0.05, a: 0.9 }); } break;
        case 'poder_genio': case 'poder_profeta': case 'poder_regalo': case 'poder_heroe': for (let k = 0; k < 90; k++) fuego.emitir({ x: x + (Math.random() - 0.5) * 0.5, y: y + Math.random() * 10, z: z + (Math.random() - 0.5) * 0.5, vx: 0, vy: 1, vz: 0, vida: 2.5, tam: 0.25, r: 1, g: 0.9, b: f.t === 'poder_genio' || f.t === 'poder_regalo' ? 1 : 0.5, a: 1 }); break;
        case 'poder_fanatismo': case 'poder_discordia': chispas(x, y + 1, z, 50, f.t === 'poder_discordia' ? [0.7, 0.4, 1] : [1, 0.25, 0.15]); break;
        case 'poder_paz': for (let k = 0; k < 40; k++) fuego.emitir({ x: x + (Math.random() - 0.5) * 3, y: y + 1, z: z + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5), vy: 1.5, vz: (Math.random() - 0.5), vida: 3, tam: 0.22, r: 1, g: 1, b: 1, a: 1 }); break;
        case 'poder_eclipse': eclipse = 4; break;
        case 'poder_isla': case 'poder_estrecho': temblor = 1; nube(x, y, z, R, 30, [0.7, 0.85, 1], 0.4); break;
        default: if (col) chispas(x, y + 1, z, 20, [col.r, col.g, col.b]);
      }
    }
  }
  // zonas activas (lluvias, sequías, langostas, ceniza, incendios): un goteo de partículas
  function efectosDeZonas(dt) {
    for (const zn of E.zonas || []) {
      const x = M.x[zn.celda], z = M.z[zn.celda], y = tope(zn.celda), R = zn.r * PASO;
      if (zn.tipo === 'lluvia' && Math.random() < dt * 20) lluvia(x, y, z, R, 4, [0.6, 0.8, 1]);
      else if (zn.tipo === 'sequia' && Math.random() < dt * 3) nube(x, y, z, R, 1, [0.85, 0.6, 0.3], 0.25, 4);
      else if (zn.tipo === 'langostas' && Math.random() < dt * 25) nube(x, y + 0.5, z, R, 2, [0.15, 0.12, 0.05], 0.8, 2);
      else if (zn.ceniza && Math.random() < dt * 4) nube(x, y + 2, z, 1, 1, [0.2, 0.18, 0.17], 0.5, 6);
      else if (zn.incendio && Math.random() < dt * 14) { const a = Math.random() * 6.28, d = Math.random() * R; llamas(x + Math.cos(a) * d, y, z + Math.sin(a) * d, false); }
    }
  }
  function dibujarMonstruos(frac, t, dt) {
    const vivos = new Set();
    for (const mo of E.monstruos || []) {
      vivos.add(mo.id); let g = monstruos.get(mo.id);
      if (!g) { g = mo.tipo === 'kraken' ? crearKraken() : crearDragon(); raiz.add(g); monstruos.set(mo.id, g); }
      const tr = mo.tray?.length > 1 ? mo.tray : [mo.celda], f = Math.min(0.999, frac) * (tr.length - 1), k = Math.floor(f), a = posCelda(tr[k]), b = posCelda(tr[Math.min(tr.length - 1, k + 1)]);
      const p = a.lerp(b, f - k);
      if (mo.tipo === 'kraken') { g.position.set(p.x, 0.1 + Math.sin(t * 1.5) * 0.1, p.z); g.scale.setScalar(1.3); g.userData.tent.forEach((q, i) => { q.rotation.x = Math.sin(t * 2 + i) * 0.5; q.rotation.z = Math.cos(t * 1.7 + i) * 0.5; }); }
      else { const vuelo = mo.ataca >= 0 ? 2.2 : 4; g.position.set(p.x + Math.sin(t * 0.8) * 0.8, p.y + vuelo + Math.sin(t * 2) * 0.3, p.z + Math.cos(t * 0.8) * 0.8); g.rotation.y = t * 0.8 + Math.PI / 2; g.scale.setScalar(1.2); const al = Math.sin(t * 6) * 0.6; g.userData.alas[0].rotation.z = al; g.userData.alas[1].rotation.z = -al;
        if (mo.ataca >= 0 && Math.random() < dt * 30) { const o = E.ciudades.find((c) => c.id === mo.ataca); if (o) { const q = posCelda(o.celda); fuego.emitir({ x: g.position.x, y: g.position.y, z: g.position.z, vx: (q.x - g.position.x) * 1.5, vy: (q.y - g.position.y) * 1.5, vz: (q.z - g.position.z) * 1.5, vida: 0.6, tam: 0.5, crece: 1, r: 1, g: 0.5, b: 0.1, a: 1 }); } } }
    }
    for (const [id, g] of monstruos) if (!vivos.has(id)) { raiz.remove(g); monstruos.delete(id); }
  }
  function pintarEtiquetas() {
    if (!etiquetas || !E) return;
    const max = innerWidth < 640 ? 5 : 12, lista = [...E.ciudades].sort((a, b) => (b.capital - a.capital) || b.pob - a.pob).slice(0, max), vivos = new Set();
    for (const ci of lista) {
      vivos.add(ci.id); let el = etqs.get(ci.id);
      if (!el) { el = document.createElement('div'); el.className = 'etq'; etiquetas.append(el); etqs.set(ci.id, el); }
      const civ = E.civs[ci.civ], txt = `${ci.capital ? '👑 ' : ''}${ci.nombre}${ci.fuego > 0 ? ' 🔥' : ci.sitiada > 0 ? ' 🏹' : ''}`;
      if (el._t !== txt) { el.textContent = txt; el._t = txt; } if (el._c !== civ.color) { el.style.borderBottom = `2px solid ${civ.color}`; el._c = civ.color; }
      const p = O.proyectar(_p.set(M.x[ci.celda], tope(ci.celda) + 1.6 + ci.nivel * 0.4, M.z[ci.celda]));
      el.style.display = p.visible ? '' : 'none'; el.style.left = `${p.x.toFixed(0)}px`; el.style.top = `${p.y.toFixed(0)}px`;
    }
    for (const [id, el] of etqs) if (!vivos.has(id)) { el.remove(); etqs.delete(id); }
  }

  let tChim = 0;
  return {
    montar(estado) {
      E = estado; M = E.mapa; ultimoEf = E.efectos.length ? Math.max(...E.efectos.map((f) => f.id)) : -1; verMapa = E.verMapa || 0;
      for (const [, c] of geoCiu) c.geo.dispose(); geoCiu.clear(); for (const [, m] of mallaCiv) { grupoCiud.remove(m); m.geometry.dispose(); } mallaCiv.clear();
      for (const [, el] of etqs) el.remove(); etqs.clear();
      construirTerreno(); pintarTerreno(); verTerreno = E.dueno.slice(); construirVelo(); construirRuinas(); sincronizarCiudades(true); despejarArboles();
    },
    actualizar(estado, frac, dt, t) {
      if (estado !== E) this.montar(estado);
      if ((E.verMapa || 0) !== verMapa) { verMapa = E.verMapa || 0; construirTerreno(); verTerreno = null; for (const [, c] of geoCiu) c.clave = ''; sincronizarCiudades(true); despejarArboles(); }
      let cambio = !verTerreno; if (!cambio) for (let i = 0; i < M.n; i++) if (verTerreno[i] !== E.dueno[i]) { cambio = true; break; }
      if (cambio) { pintarTerreno(); verTerreno = E.dueno.slice(); }
      if ((E.ruinas?.length || 0) !== ruinas?.userData.n || (E.ruinas?.length && E.ruinas[E.ruinas.length - 1].celda !== ruinas.userData.ult)) construirRuinas();
      tCiud += dt; sincronizarCiudades();
      if (velo) { velo.material.uniforms.uT.value = t; const k = E.año >= E.velo ? Math.max(0, velo.material.uniforms.uA.value - dt * 0.6) : 1; velo.material.uniforms.uA.value = k; if (k <= 0) { raiz.remove(velo); velo.geometry.dispose(); velo = null; } }
      else if (E.velo && E.año < E.velo) construirVelo();
      procesarEfectos(); efectosDeZonas(dt);
      tChim += dt;
      for (const ci of E.ciudades) {
        const x = M.x[ci.celda], y = tope(ci.celda), z = M.z[ci.celda];
        if (ci.fuego > 0 && Math.random() < dt * (8 + ci.fuego)) llamas(x, y, z, ci.fuego > 6);
        if (ci.sitiada > 0 && (ci.muralla ?? 1) < 0.5 && Math.random() < dt * 3) llamas(x, y, z, false);
        const c = geoCiu.get(ci.id);
        if (c?.chim.length && tChim > 0.12) for (const [cx, cy, cz] of c.chim) humo.emitir({ x: x + cx, y: y + cy, z: z + cz, vx: 0.3, vy: 0.7, vz: 0.1, vida: 3.5, tam: 0.3, crece: 3, r: 0.42, g: 0.42, b: 0.44, a: 0.4 });
      }
      if (tChim > 0.12) tChim = 0;
      tropas.actualizar(E, M, frac, dt, t, posCelda);
      dibujarMonstruos(frac, t, dt);
      for (let k = meteoros.length - 1; k >= 0; k--) {
        const m = meteoros[k]; m.t += dt / 1.1; const q = Math.min(1, m.t);
        m.m.position.set(m.x + 30 * (1 - q), m.y + 60 * (1 - q), m.z - 20 * (1 - q)); m.m.rotation.x += dt * 5;
        fuego.emitir({ x: m.m.position.x, y: m.m.position.y, z: m.m.position.z, vx: 0, vy: 0, vz: 0, vida: 0.5, tam: 1.2, crece: -0.6, r: 1, g: 0.5, b: 0.15, a: 1 });
        if (q >= 1) { raiz.remove(m.m); meteoros.splice(k, 1); temblor = 1.2; chispas(m.x, m.y + 0.5, m.z, 80, [1, 0.6, 0.2]); for (let j = 0; j < 40; j++) llamas(m.x, m.y, m.z, true); }
      }
      for (let k = olas.length - 1; k >= 0; k--) { const o = olas[k]; if (!o.m) { o.m = new THREE.Mesh(geoOla, matOla.clone()); o.m.rotation.x = -Math.PI / 2; raiz.add(o.m); } o.t += dt / 2.2; const r = 0.5 + o.t * o.R; o.m.scale.setScalar(r); o.m.position.set(o.x, 0.45 + Math.sin(o.t * Math.PI) * 0.4, o.z); o.m.material.opacity = 0.8 * (1 - o.t); if (o.t >= 1) { raiz.remove(o.m); o.m.material.dispose(); olas.splice(k, 1); } }
      if (temblor > 0) { temblor -= dt; const a = Math.min(1, temblor) * 0.35; raiz.position.set((Math.random() - 0.5) * a, 0, (Math.random() - 0.5) * a); } else raiz.position.set(0, 0, 0);
      if (eclipse > 0) eclipse = Math.max(0, eclipse - dt);
      if (mira.visible) { const s = 1 + Math.sin(t * 5) * 0.04; miraAnillo.scale.setScalar(s); miraDisco.material.opacity = 0.14 + Math.sin(t * 5) * 0.06; }
      const h = O.renderer.domElement.height; humo.mat.uniforms.uEsc.value = fuego.mat.uniforms.uEsc.value = h / (2 * Math.tan((O.camera.fov * Math.PI) / 360));
      humo.actualizar(dt); fuego.actualizar(dt);
      queueMicrotask(pintarEtiquetas);
    },
    // qué tocó el usuario: { ciudad, celda } o { celda }
    tocar(ev) {
      const r = O.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), O.camera);
      const hc = ray.intersectObjects(grupoCiud.children, false)[0], ht = ray.intersectObject(terreno)[0];
      let celda = ht ? ht.instanceId : null;
      const punto = hc && (!ht || hc.distance < ht.distance) ? hc.point : ht?.point; if (!punto) return null;
      if (celda == null) celda = celdaCercana(M, punto.x, punto.z);
      let mejor = null, md = hc ? 2.4 : 1.6; for (const ci of E.ciudades) { const d = Math.hypot(M.x[ci.celda] - punto.x, M.z[ci.celda] - punto.z) / PASO; if (d < md) { md = d; mejor = ci.id; } }
      return mejor != null ? { ciudad: mejor, celda } : { celda };
    },
    // vista previa de un poder: anillo con su radio (o resaltado del territorio si apunta a una civ)
    apuntar(celda, tipo) {
      if (celda == null || !tipo) { mira.visible = false; return; }
      const P = PODERES[tipo], r = Math.max(1.2, (P.radio || 1.6)) * PASO, col = { naturaleza: 0x7cc36a, vida: 0xe0574f, mente: 0xb48ae0, cielo: 0x8ab4ff, creacion: 0xffe08a }[P.cat] || 0xffe08a;
      mira.visible = true; mira.position.set(M.x[celda], tope(celda) + 0.08, M.z[celda]); mira.scale.setScalar(r); miraAnillo.material.color.set(col); miraDisco.material.color.set(col);
    },
    posCiudad(id) { const c = E.ciudades.find((x) => x.id === id); return c ? posCelda(c.celda) : null; },
    posCelda,
    posEjercito: (id) => tropas.centro(id),
    get eclipse() { return eclipse; },
    get soldados() { return tropas.soldados; },
  };
}
