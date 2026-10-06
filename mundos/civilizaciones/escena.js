// =====================================================================
// Civilizaciones — dibuja el estado de la simulación con three (no decide nada: solo mira E).
// Presupuesto: el terreno, los árboles, las rocas, las fronteras, los soldados y las partículas son
// UNA llamada de dibujo cada uno (InstancedMesh / geometría fundida); solo las ciudades tienen malla propia.
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';
import { BIOMAS, B, TAM, PASO, ERAS } from './sim.js';

const _o = new THREE.Object3D(), _c = new THREE.Color(), _c2 = new THREE.Color();
const hexColor = (s) => new THREE.Color(s);
const eraVis = (era) => (era <= 1 ? 0 : era <= 3 ? 1 : era === 4 ? 2 : 3); // chozas → castillos → fuertes → fábricas
const azarito = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// ---------------------------------------------------------------- ciudades low-poly según tamaño y era
function partesCiudad(nivel, ev, colorCiv, id, capital, era) {
  const R = azarito(id * 977 + 13), P = [], civ = new THREE.Color(colorCiv), osc = civ.clone().multiplyScalar(0.62).getHex(), cv = civ.getHex();
  const piedra = 0xb9b1a0, madera = 0x8a6440, paja = 0xd9bb62, crema = 0xe8dcc0, ladrillo = 0xa4573c, concreto = 0x9aa0a6, vidrio = 0x7fb0cc;
  const nCasas = [4, 8, 13, 20][nivel] + (capital ? 2 : 0), radio = [0.62, 0.95, 1.3, 1.65][nivel];
  const sitio = (k, n, r0 = 0.28) => { const a = k * 2.399 + R() * 0.5, r = r0 + Math.sqrt((k + 0.5) / n) * (radio - r0); return [Math.cos(a) * r, Math.sin(a) * r, a]; };
  for (let k = 0; k < nCasas; k++) {
    const [x, z, a] = sitio(k, nCasas);
    if (ev === 0) { P.push([GEO.cil, madera, x, 0.1, z, 0.13, 0.2, 0.13], [GEO.cono, paja, x, 0.28, z, 0.19, 0.18, 0.19]); }
    else if (ev === 1) { const w = 0.2 + R() * 0.08; P.push([GEO.caja, crema, x, 0.11, z, w, 0.22, w * 1.1, 0, a], [GEO.cono, osc, x, 0.3, z, w * 0.85, 0.18, w * 0.85, 0, a + Math.PI / 4]); }
    else if (ev === 2) { const w = 0.22 + R() * 0.06, h = 0.28 + R() * 0.14; P.push([GEO.caja, R() < 0.5 ? crema : ladrillo, x, h / 2, z, w, h, w, 0, a], [GEO.cono, osc, x, h + 0.08, z, w * 0.8, 0.16, w * 0.8, 0, a + Math.PI / 4]); }
    else { const w = 0.2 + R() * 0.1, h = (0.25 + R() * 0.35) * (1 + nivel * 0.25) * (era >= 6 ? 1.3 : 1); P.push([GEO.caja, R() < 0.5 ? concreto : ladrillo, x, h / 2, z, w, h, w, 0, a]); }
  }
  // centro: el corazón cambia con la era
  if (ev === 0) {
    P.push([GEO.cono, 0xff8a3a, 0, 0.08, 0, 0.08, 0.16, 0.08]); // hoguera
    if (nivel >= 1) P.push([GEO.caja, piedra, 0, 0.12, 0, 0.5, 0.24, 0.5], [GEO.caja, piedra, 0, 0.32, 0, 0.34, 0.18, 0.34], [GEO.caja, piedra, 0, 0.48, 0, 0.18, 0.14, 0.18]);
    if (nivel >= 2) for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; P.push([GEO.cil, madera, Math.cos(a) * (radio + 0.12), 0.14, Math.sin(a) * (radio + 0.12), 0.035, 0.28, 0.035]); }
  } else if (ev === 1 || ev === 2) {
    // castillo / fortaleza con torres; templo
    const tk = nivel >= 2 ? 0.42 : 0.3, alto = 0.5 + nivel * 0.18;
    P.push([GEO.caja, piedra, 0, alto / 2, 0, tk, alto, tk]);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push([GEO.cil, piedra, sx * tk * 0.6, alto * 0.6, sz * tk * 0.6, 0.08, alto * 1.2, 0.08], [GEO.cono, cv, sx * tk * 0.6, alto * 1.2 + 0.08, sz * tk * 0.6, 0.11, 0.18, 0.11]);
    if (ev === 2 && nivel >= 1) P.push([GEO.esfera, 0xd8d2c4, 0.55, 0.42, 0.2, 0.2, 0.2, 0.2], [GEO.caja, crema, 0.55, 0.18, 0.2, 0.36, 0.36, 0.36]); // cúpula
    if (nivel >= 2) {
      const lados = ev === 2 ? 5 : 10, rr = radio + 0.15;
      for (let k = 0; k < lados; k++) {
        const a0 = (k / lados) * Math.PI * 2, a1 = ((k + 1) / lados) * Math.PI * 2, mx = (Math.cos(a0) + Math.cos(a1)) / 2 * rr, mz = (Math.sin(a0) + Math.sin(a1)) / 2 * rr, lar = 2 * rr * Math.sin(Math.PI / lados);
        P.push([GEO.caja, piedra, mx, 0.13, mz, lar, 0.26, 0.07, 0, -(a0 + a1) / 2 + Math.PI / 2]);
        if (ev === 2) P.push([GEO.cono, piedra, Math.cos(a0) * rr, 0.14, Math.sin(a0) * rr, 0.22, 0.28, 0.22, 0, a0, 0]); // baluartes
        else P.push([GEO.cil, piedra, Math.cos(a0) * rr, 0.2, Math.sin(a0) * rr, 0.07, 0.4, 0.07]);
      }
    }
  } else {
    // era industrial y moderna: fábricas con chimeneas y rascacielos
    const nf = nivel >= 1 ? 1 + (nivel >= 3 ? 1 : 0) : 0;
    for (let f = 0; f < nf; f++) { const a = f * 2.4 + 1, x = Math.cos(a) * radio * 0.7, z = Math.sin(a) * radio * 0.7; P.push([GEO.caja, ladrillo, x, 0.16, z, 0.5, 0.32, 0.3, 0, a], [GEO.cil, 0x6a4a3a, x + 0.12, 0.5, z, 0.05, 0.7, 0.05], [GEO.cil, 0x6a4a3a, x - 0.1, 0.45, z + 0.05, 0.05, 0.6, 0.05]); }
    const nt = nivel >= 2 ? (nivel - 1) * 3 + (era >= 6 ? 3 : 0) : 0;
    for (let k = 0; k < nt; k++) { const [x, z] = sitio(k, nt + 1, 0.05), h = (0.9 + R() * 1.1) * (era >= 6 ? 1.5 : 1) * (nivel === 3 ? 1.2 : 0.8); P.push([GEO.caja, R() < 0.5 ? vidrio : concreto, x * 0.6, h / 2, z * 0.6, 0.22, h, 0.22], [GEO.caja, cv, x * 0.6, h + 0.03, z * 0.6, 0.24, 0.06, 0.24]); }
    if (nivel === 0) P.push([GEO.caja, crema, 0, 0.15, 0, 0.3, 0.3, 0.3]);
  }
  // bandera en el centro (más grande en la capital)
  const hb = (ev === 3 ? 1.4 : 1.0) + nivel * 0.25 + (capital ? 0.3 : 0), fb = capital ? 1.4 : 1;
  P.push([GEO.cil, 0x5a5048, 0.05, hb / 2, 0.05, 0.02, hb, 0.02], [GEO.caja, cv, 0.05 + 0.17 * fb, hb - 0.1 * fb, 0.05, 0.32 * fb, 0.2 * fb, 0.015]);
  if (capital) P.push([GEO.esfera, 0xf1c40f, 0.05, hb + 0.04, 0.05, 0.05, 0.05, 0.05]);
  return P;
}
// posiciones de chimeneas (para el humo) con la misma lógica que arriba
function chimeneas(nivel, ev) { if (ev !== 3 || nivel < 1) return []; const radio = [0.62, 0.95, 1.3, 1.65][nivel], l = []; for (let f = 0; f < 1 + (nivel >= 3 ? 1 : 0); f++) { const a = f * 2.4 + 1; l.push([Math.cos(a) * radio * 0.7 + 0.12, 0.85, Math.sin(a) * radio * 0.7]); } return l; }

// ---------------------------------------------------------------- partículas (humo, fuego, chispas): una llamada por sistema
function crearParticulas(max, aditivo) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 4), tam = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uEsc: { value: 400 } },
    vertexShader: 'uniform float uEsc; attribute vec4 aCol; attribute float aTam; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aTam * uEsc / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(.5, .12, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  const P = []; // { x,y,z, vx,vy,vz, t, vida, tam, crece, r,g,b,a, grav }
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

// ---------------------------------------------------------------- la escena
export function crearEscena(O, { etiquetas = null } = {}) {
  const raiz = new THREE.Group(); O.mundo.add(raiz);
  let M = null, E = null, verTerreno = null, verMods = -1;
  const geoHex = new THREE.CylinderGeometry(TAM * 0.985, TAM * 0.985, 1, 6); geoHex.translate(0, 0.5, 0);
  const matHex = new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true });
  let terreno = null, arboles = null, rocas = null, fronteras = null, velo = null, ruinas = null;
  const ciudades = new THREE.Group(); raiz.add(ciudades);
  const cacheCiu = new Map(); // id → { mesh, clave, chim }
  // agua: un disco translúcido sobre las celdas de mar
  const agua = new THREE.Mesh(new THREE.CircleGeometry(O.R + 0.3, 72), new THREE.MeshStandardMaterial({ color: 0x2f78a8, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1, depthWrite: false }));
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.3; agua.renderOrder = 1; raiz.add(agua);
  // soldados (cuerpo teñido + cabeza/arma sin teñir), banderas y barcos
  const MAXS = 420, MAXB = 48;
  const matT = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const soldCuerpo = new THREE.InstancedMesh(fundirGeo([[GEO.capsula, 0xffffff, 0, 0.32, 0, 0.2, 0.24, 0.14], [GEO.caja, 0xffffff, 0.09, 0.3, 0.07, 0.03, 0.2, 0.16]]), matT, MAXS);
  const soldCabeza = new THREE.InstancedMesh(fundirGeo([[GEO.esfera, 0xd9a77a, 0, 0.6, 0, 0.075, 0.08, 0.075], [GEO.esfera, 0x6a6a72, 0, 0.64, 0, 0.08, 0.05, 0.08], [GEO.caja, 0x8a7a66, -0.11, 0.45, 0.02, 0.018, 0.75, 0.018], [GEO.cono, 0xcfd3d6, -0.11, 0.86, 0.02, 0.03, 0.08, 0.03]]), MAT_VERTICE, MAXS);
  const astas = new THREE.InstancedMesh(fundirGeo([[GEO.cil, 0x4a3a2a, 0, 0.7, 0, 0.025, 1.4, 0.025], [GEO.esfera, 0xd4af37, 0, 1.42, 0, 0.05, 0.05, 0.05]]), MAT_VERTICE, MAXB);
  const telas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0xffffff, 0.24, 1.18, 0, 0.46, 0.32, 0.02]]), new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), MAXB);
  const barcos = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0x6a4a2a, 0, 0.08, 0, 1.3, 0.16, 0.5], [GEO.cono, 0x6a4a2a, 0.75, 0.08, 0, 0.25, 0.4, 0.16, 0, 0, -Math.PI / 2], [GEO.cil, 0x4a3a2a, 0, 0.6, 0, 0.03, 1, 0.03], [GEO.caja, 0xf2ead8, 0.05, 0.62, 0, 0.04, 0.6, 0.6]]), MAT_VERTICE, MAXB);
  for (const m of [soldCuerpo, soldCabeza, astas, telas, barcos]) { m.castShadow = true; m.count = 0; m.frustumCulled = false; raiz.add(m); }
  soldCuerpo.setColorAt(0, _c.set(0xffffff)); telas.setColorAt(0, _c.set(0xffffff));
  const humo = crearParticulas(900, false), fuego = crearParticulas(900, true); raiz.add(humo.obj, fuego.obj);
  // meteoritos en vuelo
  const meteoros = [];
  const geoMeteoro = new THREE.IcosahedronGeometry(1, 0), matMeteoro = new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: 0xff5a1a, emissiveIntensity: 1.5, flatShading: true });
  let temblor = 0, ultimoEf = -1;
  const etqs = new Map();

  const alturaCelda = (i) => M.h[i] - (M.rio[i] && M.bioma[i] > 1 ? 0.12 : 0);
  const tope = (i) => (M.bioma[i] <= 1 ? 0.3 : alturaCelda(i));

  // ------------------------------------------------------------ terreno, árboles, rocas, ruinas
  function construirTerreno() {
    for (const m of [terreno, arboles, rocas]) if (m) { raiz.remove(m); m.geometry !== geoHex && m.geometry.dispose(); m.dispose?.(); }
    terreno = new THREE.InstancedMesh(geoHex, matHex, M.n); terreno.receiveShadow = true; terreno.castShadow = true;
    for (let i = 0; i < M.n; i++) { _o.position.set(M.x[i], -0.35, M.z[i]); _o.scale.set(1, alturaCelda(i) + 0.35, 1); _o.rotation.set(0, 0, 0); _o.updateMatrix(); terreno.setMatrixAt(i, _o.matrix); terreno.setColorAt(i, _c.set(0xffffff)); }
    raiz.add(terreno);
    // árboles: bosque y selva (2 por celda), tundra (1 pino escaso)
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
    arboles.userData.mat0 = arboles.instanceMatrix.array.slice(); raiz.add(arboles);
    // picos: montañas y nieve alta
    const picos = []; for (let i = 0; i < M.n; i++) if (M.a[i] > 0.7) picos.push(i);
    rocas = new THREE.InstancedMesh(fundirGeo([[new THREE.ConeGeometry(1, 1, 5), 0x8a8378, 0, 0.5, 0, 1, 1, 1]]), MAT_VERTICE, Math.max(1, picos.length)); rocas.castShadow = true;
    picos.forEach((i, k) => { const s = 0.6 + (M.a[i] - 0.7) * 2.2; _o.position.set(M.x[i], alturaCelda(i) - 0.05, M.z[i]); _o.scale.set(TAM * 0.8, s * 1.6, TAM * 0.8); _o.rotation.set(0, i, 0); _o.updateMatrix(); rocas.setMatrixAt(k, _o.matrix); rocas.setColorAt(k, _c.set(M.bioma[i] === B.NIEVE ? 0xf4f7fa : 0xffffff)); });
    raiz.add(rocas);
    verTerreno = null;
  }
  function pintarTerreno() {
    // color de bioma con un leve ruido; teñido con el color del dueño y más fuerte en el borde
    for (let i = 0; i < M.n; i++) {
      const b = M.bioma[i]; _c.set(BIOMAS[b].c); const v = ((i * 2654435761) >>> 24) / 255 * 0.08 - 0.04; _c.offsetHSL(0, 0, v);
      if (M.rio[i] && b > 1) _c.lerp(_c2.set(0x3f8fb0), 0.55);
      const d = E.dueno[i];
      if (d >= 0) { let borde = false; for (const j of M.vec[i]) if (E.dueno[j] !== d) { borde = true; break; } _c.lerp(_c2.set(E.civs[d].color), b <= 1 ? 0.22 : borde ? 0.45 : 0.22); }
      terreno.setColorAt(i, _c);
    }
    terreno.instanceColor.needsUpdate = true;
    construirFronteras();
  }
  // cintas planas sobre el borde interior de cada territorio (las líneas de 1 px no se ven)
  function construirFronteras() {
    if (fronteras) { raiz.remove(fronteras); fronteras.geometry.dispose(); }
    const pos = [], col = [];
    for (let i = 0; i < M.n; i++) {
      const d = E.dueno[i]; if (d < 0) continue; _c.set(E.civs[d].color).offsetHSL(0, 0.1, 0.08);
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
  // el velo: cortinas de niebla en los límites entre zonas, que se desvanecen cuando cae
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
    if (ruinas) { raiz.remove(ruinas); ruinas.dispose(); }
    const l = E.ruinas || []; ruinas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0x5a5550, 0.2, 0.08, 0.1, 0.3, 0.16, 0.2, 0, 0.4], [GEO.caja, 0x4a4540, -0.2, 0.12, -0.15, 0.22, 0.24, 0.22, 0, 1], [GEO.cil, 0x6a6560, 0.05, 0.2, -0.3, 0.06, 0.4, 0.06, 0.3, 0, 0.2], [GEO.caja, 0x3a3530, -0.1, 0.05, 0.3, 0.4, 0.1, 0.25]]), MAT_VERTICE, Math.max(1, l.length));
    l.forEach((r, k) => { _o.position.set(M.x[r.celda], tope(r.celda), M.z[r.celda]); _o.scale.setScalar(1.5); _o.rotation.set(0, k, 0); _o.updateMatrix(); ruinas.setMatrixAt(k, _o.matrix); });
    ruinas.count = l.length; ruinas.userData.n = l.length; raiz.add(ruinas);
  }

  // ------------------------------------------------------------ ciudades
  function sincronizarCiudades() {
    const vivos = new Set();
    for (const ci of E.ciudades) {
      vivos.add(ci.id); const civ = E.civs[ci.civ], ev = eraVis(civ.era), q = ci.fuego > 0;
      const clave = `${ci.nivel}|${ev}|${civ.color}|${q ? 1 : 0}|${ci.capital ? 1 : 0}|${civ.era >= 6 ? 1 : 0}`;
      let c = cacheCiu.get(ci.id);
      if (!c || c.clave !== clave) {
        if (c) { ciudades.remove(c.mesh); c.mesh.geometry.dispose(); }
        const partes = partesCiudad(ci.nivel, ev, civ.color, ci.id, ci.capital, civ.era);
        if (q) for (const p of partes) p[1] = new THREE.Color(p[1]).multiplyScalar(0.32).getHex(); // quemada: todo ennegrecido
        const mesh = new THREE.Mesh(fundirGeo(partes), MAT_VERTICE); mesh.castShadow = mesh.receiveShadow = true;
        mesh.position.set(M.x[ci.celda], tope(ci.celda), M.z[ci.celda]); mesh.rotation.y = (ci.id * 1.7) % 6.28; mesh.userData.id = ci.id;
        ciudades.add(mesh); c = { mesh, clave, chim: chimeneas(ci.nivel, ev) }; cacheCiu.set(ci.id, c);
        if (arboles) despejarArboles();
      }
    }
    for (const [id, c] of cacheCiu) if (!vivos.has(id)) { ciudades.remove(c.mesh); c.mesh.geometry.dispose(); cacheCiu.delete(id); despejarArboles(); }
  }
  function despejarArboles() {
    // los árboles se talan alrededor de las ciudades (y crecen de nuevo si la ciudad desaparece)
    const a = arboles.instanceMatrix.array, a0 = arboles.userData.mat0;
    arboles.userData.lista.forEach(([i], k) => {
      let tala = false; for (const ci of E.ciudades) { const dx = M.x[ci.celda] - M.x[i], dz = M.z[ci.celda] - M.z[i], r = [1.0, 1.4, 1.9, 2.3][ci.nivel]; if (dx * dx + dz * dz < r * r) { tala = true; break; } }
      for (let q = 0; q < 16; q++) a[k * 16 + q] = tala ? 0 : a0[k * 16 + q];
    });
    arboles.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ ejércitos (posición interpolada dentro del año)
  const posCelda = (i, out) => out.set(M.x[i], tope(i), M.z[i]);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
  function posEjercito(ej, frac, out) {
    const t = ej.tray && ej.tray.length > 1 ? ej.tray : [ej.celda]; const f = Math.min(0.999, frac) * (t.length - 1), k = Math.floor(f);
    posCelda(t[k], _a); posCelda(t[Math.min(t.length - 1, k + 1)], _b); out.lerpVectors(_a, _b, f - k);
    if (ej.sitio >= 0) { const o = E.ciudades.find((c) => c.id === ej.sitio); if (o) { posCelda(o.celda, _b); out.lerp(_b, 0.35); } }
    return t.length > 1 ? Math.atan2(_b.x - _a.x, _b.z - _a.z) : null;
  }
  const rumbos = new Map();
  function dibujarEjercitos(frac, t, dt) {
    let ns = 0, nb = 0, nbar = 0;
    for (const ej of E.ejercitos) {
      if (nb >= MAXB) break;
      const civ = E.civs[ej.civ]; const dir = posEjercito(ej, frac, _p);
      let rumbo = rumbos.get(ej.id) ?? 0; if (dir != null) rumbo = dir; else if (ej.sitio >= 0) { const o = E.ciudades.find((c) => c.id === ej.sitio); if (o) rumbo = Math.atan2(M.x[o.celda] - _p.x, M.z[o.celda] - _p.z); } rumbos.set(ej.id, rumbo);
      const enAgua = M.bioma[ej.tray?.[Math.round(Math.min(0.999, frac) * ((ej.tray?.length || 1) - 1))] ?? ej.celda] <= 1;
      const pelea = ej.combate > 0 || ej.sitio >= 0, n = Math.max(3, Math.min(12, Math.round(Math.sqrt(ej.fuerza) / 5)));
      _c.set(civ.color);
      if (enAgua) { _o.position.set(_p.x, 0.3, _p.z); _o.rotation.set(0, rumbo - Math.PI / 2, 0); _o.scale.setScalar(1.3); _o.updateMatrix(); barcos.setMatrixAt(nbar++, _o.matrix); }
      for (let k = 0; k < n && ns < MAXS; k++) {
        const fila = Math.floor(k / 4), col = (k % 4) - 1.5, ox = col * 0.26, oz = -fila * 0.3 - 0.2, cs = Math.cos(rumbo), sn = Math.sin(rumbo);
        const brinco = pelea ? Math.abs(Math.sin(t * 9 + k * 1.7)) * 0.12 : Math.abs(Math.sin(t * 6 + k)) * 0.05;
        _o.position.set(_p.x + ox * cs + oz * sn, (enAgua ? 0.45 : _p.y) + brinco, _p.z - ox * sn + oz * cs);
        _o.rotation.set(pelea ? Math.sin(t * 10 + k) * 0.25 : 0, rumbo, 0); _o.scale.setScalar(enAgua ? 0.8 : 1.15); _o.updateMatrix();
        soldCuerpo.setMatrixAt(ns, _o.matrix); soldCabeza.setMatrixAt(ns, _o.matrix); soldCuerpo.setColorAt(ns, _c); ns++;
      }
      // bandera al frente, ondeando
      _o.position.set(_p.x + Math.sin(rumbo) * 0.35, (enAgua ? 0.45 : _p.y), _p.z + Math.cos(rumbo) * 0.35); _o.rotation.set(0, rumbo - Math.PI / 2 + Math.sin(t * 3 + ej.id) * 0.25, 0); _o.scale.setScalar(ej.general ? 1.35 : 1.1); _o.updateMatrix();
      astas.setMatrixAt(nb, _o.matrix); telas.setMatrixAt(nb, _o.matrix); telas.setColorAt(nb, _c); nb++;
      // chispas y polvo cuando pelea
      if (pelea && Math.random() < dt * 14) chispas(_p.x + (Math.random() - 0.5) * 0.8, _p.y + 0.5, _p.z + (Math.random() - 0.5) * 0.8, 3);
      else if (!enAgua && dir != null && Math.random() < dt * 3) humo.emitir({ x: _p.x, y: _p.y + 0.1, z: _p.z, vx: 0, vy: 0.2, vz: 0, vida: 1.2, tam: 0.35, crece: 1.5, r: 0.7, g: 0.62, b: 0.5, a: 0.35 });
    }
    soldCuerpo.count = soldCabeza.count = ns; astas.count = telas.count = nb; barcos.count = nbar;
    for (const m of [soldCuerpo, soldCabeza, astas, telas, barcos]) m.instanceMatrix.needsUpdate = true;
    if (soldCuerpo.instanceColor) soldCuerpo.instanceColor.needsUpdate = true; if (telas.instanceColor) telas.instanceColor.needsUpdate = true;
  }
  function chispas(x, y, z, n, col = [1, 0.8, 0.3]) { for (let i = 0; i < n; i++) fuego.emitir({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3, grav: 6, vida: 0.35 + Math.random() * 0.35, tam: 0.12, r: col[0], g: col[1], b: col[2], a: 1 }); }
  function llamas(x, y, z, fuerte) {
    fuego.emitir({ x: x + (Math.random() - 0.5) * (fuerte ? 1.6 : 0.8), y: y + 0.2, z: z + (Math.random() - 0.5) * (fuerte ? 1.6 : 0.8), vx: 0, vy: 1.2 + Math.random(), vz: 0, vida: 0.6 + Math.random() * 0.5, tam: fuerte ? 0.55 : 0.4, crece: -0.5, r: 1, g: 0.45 + Math.random() * 0.25, b: 0.1, a: 0.9 });
    if (Math.random() < 0.5) humo.emitir({ x: x + (Math.random() - 0.5), y: y + 0.8, z: z + (Math.random() - 0.5), vx: 0.25, vy: 0.9, vz: 0.1, vida: 3, tam: 0.6, crece: 2.5, r: 0.12, g: 0.11, b: 0.1, a: 0.5 });
  }

  // ------------------------------------------------------------ efectos nuevos de la simulación
  function procesarEfectos() {
    for (const f of E.efectos) {
      if (f.id <= ultimoEf) continue; ultimoEf = f.id;
      const i = f.celda; if (i == null || i < 0 || i >= M.n) continue; const x = M.x[i], y = tope(i), z = M.z[i];
      if (f.t === 'batalla') { chispas(x, y + 0.5, z, 18); for (let k = 0; k < 6; k++) humo.emitir({ x: x + (Math.random() - 0.5) * 1.5, y: y + 0.3, z: z + (Math.random() - 0.5) * 1.5, vx: 0, vy: 0.5, vz: 0, vida: 2.5, tam: 0.6, crece: 2, r: 0.55, g: 0.52, b: 0.48, a: 0.45 }); }
      else if (f.t === 'caida') { for (let k = 0; k < (f.arrasada ? 40 : 18); k++) llamas(x, y, z, true); chispas(x, y + 1, z, 30); }
      else if (f.t === 'plaga') for (let k = 0; k < 16; k++) humo.emitir({ x: x + (Math.random() - 0.5) * 2, y: y + 0.4, z: z + (Math.random() - 0.5) * 2, vx: 0, vy: 0.3, vz: 0, vida: 4, tam: 0.8, crece: 2, r: 0.45, g: 0.6, b: 0.2, a: 0.4 });
      else if (f.t === 'bendicion') for (let k = 0; k < 40; k++) fuego.emitir({ x: x + (Math.random() - 0.5) * 3, y: y + Math.random() * 3, z: z + (Math.random() - 0.5) * 3, vx: 0, vy: 0.6, vz: 0, vida: 2.5, tam: 0.18, r: 1, g: 0.85, b: 0.35, a: 1 });
      else if (f.t === 'meteorito') { const m = new THREE.Mesh(geoMeteoro, matMeteoro); m.scale.setScalar(0.9); m.position.set(x + 30, 60, z - 20); raiz.add(m); meteoros.push({ m, x, y, z, t: 0 }); }
      else if (f.t === 'terremoto') { temblor = 1.6; for (let k = 0; k < 30; k++) humo.emitir({ x: x + (Math.random() - 0.5) * 10, y: y + 0.2, z: z + (Math.random() - 0.5) * 10, vx: 0, vy: 0.4, vz: 0, vida: 3, tam: 0.8, crece: 2, r: 0.6, g: 0.52, b: 0.4, a: 0.4 }); }
      else if (f.t === 'contacto' || f.t === 'velo') { const ca = f.a != null ? new THREE.Color(E.civs[f.a]?.color || '#fff') : _c.set(0xd8d0ff), cb = f.b != null ? new THREE.Color(E.civs[f.b]?.color || '#fff') : ca; for (let k = 0; k < 70; k++) { const q = k % 2 ? ca : cb, a = Math.random() * 6.28, r = Math.random() * (f.t === 'velo' ? 30 : 3); fuego.emitir({ x: x + Math.cos(a) * r, y: y + 0.3 + Math.random() * 2, z: z + Math.sin(a) * r, vx: 0, vy: 0.8 + Math.random(), vz: 0, vida: 2.5 + Math.random() * 1.5, tam: 0.25, r: q.r, g: q.g, b: q.b, a: 1 }); } }
      else if (f.t === 'fundacion') for (let k = 0; k < 6; k++) humo.emitir({ x, y: y + 0.1, z, vx: (Math.random() - 0.5), vy: 0.4, vz: (Math.random() - 0.5), vida: 1.4, tam: 0.4, crece: 1.5, r: 0.8, g: 0.75, b: 0.6, a: 0.35 });
    }
  }

  // ------------------------------------------------------------ etiquetas de ciudades importantes
  function pintarEtiquetas() {
    if (!etiquetas) return;
    const max = innerWidth < 640 ? 6 : 14, lista = [...E.ciudades].sort((a, b) => (b.capital - a.capital) || b.pob - a.pob).slice(0, max), vivos = new Set();
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

  // ------------------------------------------------------------ API
  let tChim = 0;
  return {
    // nuevo mundo (o mundo cargado): rehace todo lo que depende del mapa
    montar(estado) {
      E = estado; M = E.mapa; ultimoEf = E.efectos.length ? Math.max(...E.efectos.map((f) => f.id)) : -1;
      for (const [, c] of cacheCiu) { ciudades.remove(c.mesh); c.mesh.geometry.dispose(); } cacheCiu.clear();
      for (const [, el] of etqs) el.remove(); etqs.clear();
      construirTerreno(); pintarTerreno(); verTerreno = E.dueno.slice(); verMods = Object.keys(E.mods).length; construirVelo(); construirRuinas(); sincronizarCiudades(); despejarArboles();
    },
    // cada cuadro: frac = fracción del año en curso (para interpolar marchas)
    actualizar(estado, frac, dt, t) {
      if (estado !== E) this.montar(estado);
      if (Object.keys(E.mods).length !== verMods) { verMods = Object.keys(E.mods).length; construirTerreno(); verTerreno = null; sincronizarCiudades(); despejarArboles(); for (const [, c] of cacheCiu) c.mesh.position.y = tope(E.ciudades.find((x) => x.id === c.mesh.userData.id)?.celda ?? 0); }
      let cambio = !verTerreno; if (!cambio) for (let i = 0; i < M.n; i++) if (verTerreno[i] !== E.dueno[i]) { cambio = true; break; }
      if (cambio) { pintarTerreno(); verTerreno = E.dueno.slice(); }
      if ((E.ruinas?.length || 0) !== ruinas?.userData.n || (E.ruinas?.length && E.ruinas[E.ruinas.length - 1].celda !== ruinas.userData.ult)) { construirRuinas(); ruinas.userData.ult = E.ruinas[E.ruinas.length - 1]?.celda; }
      sincronizarCiudades();
      // velo: se desvanece al caer
      if (velo) { velo.material.uniforms.uT.value = t; const k = E.año >= E.velo ? Math.max(0, velo.material.uniforms.uA.value - dt * 0.6) : 1; velo.material.uniforms.uA.value = k; if (k <= 0) { raiz.remove(velo); velo.geometry.dispose(); velo = null; } }
      else if (E.velo && E.año < E.velo) construirVelo();
      procesarEfectos();
      // fuego en ciudades que arden, humo de fábricas
      tChim += dt;
      for (const ci of E.ciudades) {
        const x = M.x[ci.celda], y = tope(ci.celda), z = M.z[ci.celda];
        if (ci.fuego > 0 && Math.random() < dt * (8 + ci.fuego)) llamas(x, y, z, ci.fuego > 6);
        if (ci.sitiada > 0 && Math.random() < dt * 4) chispas(x + (Math.random() - 0.5) * 1.6, y + 0.6, z + (Math.random() - 0.5) * 1.6, 2, [1, 0.6, 0.2]);
        const c = cacheCiu.get(ci.id);
        if (c?.chim.length && tChim > 0.12) for (const [cx, cy, cz] of c.chim) { const r = c.mesh.rotation.y, px = cx * Math.cos(r) + cz * Math.sin(r), pz = -cx * Math.sin(r) + cz * Math.cos(r); humo.emitir({ x: x + px, y: y + cy, z: z + pz, vx: 0.3, vy: 0.7, vz: 0.1, vida: 3.5, tam: 0.3, crece: 3, r: 0.42, g: 0.42, b: 0.44, a: 0.4 }); }
      }
      if (tChim > 0.12) tChim = 0;
      dibujarEjercitos(frac, t, dt);
      // meteoritos
      for (let k = meteoros.length - 1; k >= 0; k--) {
        const m = meteoros[k]; m.t += dt / 1.1; const q = Math.min(1, m.t);
        m.m.position.set(m.x + 30 * (1 - q), m.y + 60 * (1 - q), m.z - 20 * (1 - q)); m.m.rotation.x += dt * 5;
        fuego.emitir({ x: m.m.position.x, y: m.m.position.y, z: m.m.position.z, vx: 0, vy: 0, vz: 0, vida: 0.5, tam: 1.2, crece: -0.6, r: 1, g: 0.5, b: 0.15, a: 1 });
        if (q >= 1) { raiz.remove(m.m); meteoros.splice(k, 1); temblor = 1.2; chispas(m.x, m.y + 0.5, m.z, 80, [1, 0.6, 0.2]); for (let j = 0; j < 40; j++) llamas(m.x, m.y, m.z, true); }
      }
      if (temblor > 0) { temblor -= dt; const a = Math.min(1, temblor) * 0.35; raiz.position.set((Math.random() - 0.5) * a, 0, (Math.random() - 0.5) * a); } else raiz.position.set(0, 0, 0);
      const h = O.renderer.domElement.height; humo.mat.uniforms.uEsc.value = fuego.mat.uniforms.uEsc.value = h / (2 * Math.tan((O.camera.fov * Math.PI) / 360));
      humo.actualizar(dt); fuego.actualizar(dt);
      // las etiquetas se pintan después del render de este mismo cuadro (microtarea): así siguen a la cámara sin retraso
      queueMicrotask(pintarEtiquetas);
    },
    // qué tocó el usuario: { ciudad } o { celda }
    tocar(ev) {
      const id = O.tocar(ev, ciudades.children); if (id != null) return { ciudad: id };
      const r = O.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), O.camera);
      const h = ray.intersectObject(terreno)[0]; if (!h) return null; const celda = h.instanceId;
      let mejor = null, md = 1.6; for (const ci of E.ciudades) { const d = Math.hypot(M.x[ci.celda] - M.x[celda], M.z[ci.celda] - M.z[celda]) / PASO; if (d < md) { md = d; mejor = ci.id; } }
      return mejor != null ? { ciudad: mejor, celda } : { celda };
    },
    posCiudad(id) { const c = E.ciudades.find((x) => x.id === id); return c ? new THREE.Vector3(M.x[c.celda], tope(c.celda), M.z[c.celda]) : null; },
    posCelda(i) { return new THREE.Vector3(M.x[i], tope(i), M.z[i]); },
    get llamadas() { return O.renderer.info.render.calls; },
    eraVis, ERAS,
  };
}
