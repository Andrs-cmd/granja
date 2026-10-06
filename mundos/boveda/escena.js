// =====================================================================
// Bóveda genética — dibuja el estado (no decide nada).
// Terreno: un InstancedMesh de bloques con su altura y el color del clima de cada celda.
// Plantas: un InstancedMesh por forma (pasto, flor, arbusto, árbol, cactus, cereal, mata, conífera);
// las piezas magenta toman el color de cada especie. Bóveda en la montaña, aldeas con sus campos y el clima a la vista.
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';
import { CEL, FORMAS, climaCelda, celdaCercana } from './sim.js';

const _o = new THREE.Object3D(), _c = new THREE.Color(), _c2 = new THREE.Color();
const T = 0xff00ff; // pieza que toma el color de la especie
const VERDE = 0x4f8a3a, TALLO = 0x5a7a3a, TRONCO = 0x6a4a30;
// (formas a ~1 de alto; miran a +y)
const PIEZAS = {
  pasto: [[GEO.cono, T, -0.08, 0.18, 0, 0.05, 0.36, 0.05, 0, 0, 0.2], [GEO.cono, T, 0.07, 0.2, 0.04, 0.05, 0.4, 0.05, 0, 0, -0.25], [GEO.cono, T, 0, 0.16, -0.07, 0.05, 0.32, 0.05, 0.25, 0, 0]],
  flor: [[GEO.cil, TALLO, 0, 0.18, 0, 0.012, 0.36, 0.012], [GEO.esfera, VERDE, 0.04, 0.08, 0, 0.06, 0.03, 0.04], [GEO.esfera, T, 0, 0.38, 0, 0.08, 0.05, 0.08], [GEO.esfera, 0xf2d24c, 0, 0.4, 0, 0.03, 0.03, 0.03]],
  arbusto: [[GEO.esfera, T, 0, 0.22, 0, 0.26, 0.22, 0.26], [GEO.esfera, T, 0.15, 0.3, 0.05, 0.16, 0.14, 0.16], [GEO.esfera, 0xf2f0e6, 0.1, 0.4, 0.12, 0.03, 0.03, 0.03]],
  arbol: [[GEO.cil, TRONCO, 0, 0.35, 0, 0.06, 0.7, 0.06], [GEO.esfera, T, 0, 0.9, 0, 0.38, 0.34, 0.38], [GEO.esfera, T, 0.18, 0.78, 0.1, 0.22, 0.2, 0.22]],
  cactus: [[GEO.capsula, T, 0, 0.35, 0, 0.12, 0.45, 0.12], [GEO.capsula, T, 0.13, 0.42, 0, 0.06, 0.16, 0.06, 0, 0, -0.9], [GEO.capsula, T, -0.12, 0.36, 0, 0.06, 0.12, 0.06, 0, 0, 0.9]],
  cereal: [[GEO.cil, T, -0.05, 0.22, 0, 0.012, 0.44, 0.012], [GEO.cil, T, 0.05, 0.24, 0.03, 0.012, 0.48, 0.012], [GEO.capsula, 0xd9b44a, -0.05, 0.47, 0, 0.03, 0.08, 0.03], [GEO.capsula, 0xd9b44a, 0.05, 0.51, 0.03, 0.03, 0.08, 0.03]],
  mata: [[GEO.esfera, VERDE, 0, 0.14, 0, 0.2, 0.14, 0.2], [GEO.esfera, T, 0.08, 0.24, 0.05, 0.05, 0.05, 0.05], [GEO.esfera, T, -0.07, 0.22, -0.06, 0.05, 0.05, 0.05]],
  conifera: [[GEO.cil, TRONCO, 0, 0.18, 0, 0.05, 0.36, 0.05], [GEO.cono, T, 0, 0.6, 0, 0.32, 0.6, 0.32], [GEO.cono, T, 0, 0.92, 0, 0.22, 0.42, 0.22]],
};
const ESC_FORMA = { pasto: 2.0, flor: 2.2, arbusto: 1.8, arbol: 2.5, cactus: 2.0, cereal: 2.1, mata: 2.1, conifera: 2.6 };
const MAX = 2600;

function matEspecie() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
#if defined(USE_COLOR) && defined(USE_INSTANCING_COLOR)
  vColor.xyz = (color.r > 0.98 && color.g < 0.02 && color.b > 0.98) ? instanceColor.xyz : color.xyz;
#endif`); };
  m.customProgramCacheKey = () => 'especie-v1'; return m;
}
function particulas(max, aditivo) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(max * 3), col = new Float32Array(max * 4), tam = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uEsc: { value: 400 } },
    vertexShader: 'uniform float uEsc; attribute vec4 aCol; attribute float aTam; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aTam * uEsc / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(.5, .12, r)); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; const P = [];
  return { obj: pts, mat, emitir(p) { if (P.length < max) P.push({ t: 0, grav: 0, crece: 0, ...p }); },
    actualizar(dt) { let n = 0; for (let i = P.length - 1; i >= 0; i--) { P[i].t += dt; if (P[i].t >= P[i].vida) { P[i] = P[P.length - 1]; P.pop(); } }
      for (const p of P) { p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = 1 - p.t / p.vida; pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; col[n * 4] = p.r; col[n * 4 + 1] = p.g; col[n * 4 + 2] = p.b; col[n * 4 + 3] = p.a * Math.min(1, k * 2) * Math.min(1, p.t * 6); tam[n] = p.tam * (1 + p.crece * (1 - k)); n++; }
      geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = geo.attributes.aCol.needsUpdate = geo.attributes.aTam.needsUpdate = true; } };
}

export function crearEscena(O) {
  const raiz = new THREE.Group(); O.mundo.add(raiz);
  let E = null, M = null, terreno = null, verMapa = '';
  const alto = (i) => (M.agua[i] ? 0.12 : 0.3 + M.elev[i] * 4.2);
  const geoBloque = new THREE.BoxGeometry(CEL * 0.99, 1, CEL * 0.99); geoBloque.translate(0, 0.5, 0);
  const matBloque = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const agua = new THREE.Mesh(new THREE.CircleGeometry(O.R - 0.6, 72), new THREE.MeshStandardMaterial({ color: 0x2f78a8, transparent: true, opacity: 0.72, roughness: 0.15 }));
  agua.rotation.x = -Math.PI / 2; agua.position.y = 0.38; raiz.add(agua);
  const matE = matEspecie(), plantas = {};
  for (const f of FORMAS) { const m = new THREE.InstancedMesh(fundirGeo(PIEZAS[f]), matE, MAX); m.count = 0; m.castShadow = true; m.frustumCulled = false; m.setColorAt(0, _c.set(0xffffff)); plantas[f] = m; raiz.add(m); }
  const humo = particulas(1200, false), luz = particulas(1600, true); raiz.add(humo.obj, luz.obj);
  // la bóveda: un búnker de concreto en la ladera, con su puerta encendida
  const boveda = new THREE.Group(); raiz.add(boveda);
  boveda.add(new THREE.Mesh(fundirGeo([[GEO.caja, 0x9aa0a6, 0, 0.9, 0, 2.6, 1.8, 2.2], [GEO.caja, 0x7a8086, 0, 1.95, -0.2, 2.8, 0.3, 2.4], [GEO.caja, 0x6a7076, 0, 1.2, 1.25, 1.2, 2.4, 0.5], [GEO.caja, 0xb0b6bc, 0.9, 0.3, 1.4, 0.2, 0.6, 0.2], [GEO.caja, 0xb0b6bc, -0.9, 0.3, 1.4, 0.2, 0.6, 0.2]]), MAT_VERTICE));
  const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6fc8ff, emissiveIntensity: 1.2 })); puerta.position.set(0, 0.95, 1.52); boveda.add(puerta);
  const luzB = new THREE.PointLight(0x8fd0ff, 0, 10, 1.6); luzB.position.set(0, 2.5, 2.5); boveda.add(luzB);
  boveda.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const aldeasG = new THREE.Group(); raiz.add(aldeasG);
  const casa = fundirGeo([[GEO.caja, 0xe8dcc0, 0, 0.3, 0, 0.6, 0.6, 0.6], [GEO.cono, 0xa4573c, 0, 0.78, 0, 0.55, 0.4, 0.55, 0, Math.PI / 4, 0]]);
  const casaAband = fundirGeo([[GEO.caja, 0x5a5550, 0, 0.18, 0, 0.6, 0.36, 0.6], [GEO.caja, 0x3a3530, 0.15, 0.4, 0, 0.3, 0.1, 0.5, 0, 0, 0.4]]);
  const mira = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
  mira.rotation.x = -Math.PI / 2; mira.scale.setScalar(CEL * 0.78); mira.visible = false; mira.renderOrder = 20; raiz.add(mira);
  const brillo = (x, y, z, n, col, r = 0.8, vy = 1.4) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, d = Math.random() * r; luz.emitir({ x: x + Math.cos(a) * d, y: y + Math.random() * 0.5, z: z + Math.sin(a) * d, vx: 0, vy: vy * (0.5 + Math.random()), vz: 0, vida: 1.6 + Math.random(), tam: 0.22, r: col[0], g: col[1], b: col[2], a: 1 }); } };
  let ultEf = -1;

  function construirTerreno() {
    if (terreno) { raiz.remove(terreno); terreno.dispose(); }
    terreno = new THREE.InstancedMesh(geoBloque, matBloque, M.n); terreno.receiveShadow = true;
    for (let i = 0; i < M.n; i++) { _o.position.set(M.x[i], -0.4, M.z[i]); _o.scale.set(1, alto(i) + 0.4, 1); _o.updateMatrix(); terreno.setMatrixAt(i, _o.matrix); terreno.setColorAt(i, _c.set(0xffffff)); }
    raiz.add(terreno);
    // la bóveda va en la celda más alta del norte que no sea agua
    let mejor = 0, mv = -1; for (let i = 0; i < M.n; i++) { const v = M.elev[i] * 0.6 - M.z[i] / 60 - Math.hypot(M.x[i], M.z[i] + 26) / 40; if (!M.agua[i] && Math.hypot(M.x[i], M.z[i]) < 36 && v > mv) { mv = v; mejor = i; } }
    boveda.position.set(M.x[mejor], alto(mejor), M.z[mejor]); boveda.userData.celda = mejor;
    verMapa = E.semilla;
  }
  function pintarTerreno() {
    const plagas = E.eventos.filter((v) => v.tipo === 'plaga');
    const campos = new Set(E.aldeas.filter((a) => a.viva).flatMap((a) => a.campos));
    let tot = new Float32Array(M.n); for (const s of E.especies) if (s.extinta == null) for (let i = 0; i < M.n; i++) tot[i] += s.b[i];
    for (let i = 0; i < M.n; i++) {
      if (M.agua[i]) { terreno.setColorAt(i, _c.set(0x2a6a90)); continue; }
      const [t, h] = climaCelda(E, i);
      if (t < -2) _c.set(0xf2f5f8); else if (t < 4) _c.set(0xc8ccb8).lerp(_c2.set(0x8a9a6a), h);
      else if (h < 0.25) _c.set(t > 22 ? 0xe2c48a : 0xc8b07a); else _c.set(0x9a8a5a).lerp(_c2.set(t > 22 ? 0x3f7a3a : 0x5a8a3a), Math.min(1, h * 1.3));
      _c.lerp(_c2.set(0x3f6a2a), Math.min(0.5, tot[i] * 0.4));   // vegetación
      if (M.elev[i] > 0.75) _c.lerp(_c2.set(t < 4 ? 0xffffff : 0x8a8378), 0.5);
      if (campos.has(i)) _c.set(0x7a5a3a);
      for (const p of plagas) if (Math.hypot(M.x[i] - M.x[p.celda], M.z[i] - M.z[p.celda]) < p.r * CEL) { _c.lerp(_c2.set(0x6a4a7a), 0.25); break; }
      terreno.setColorAt(i, _c);
    }
    terreno.instanceColor.needsUpdate = true;
  }
  // plantas: las 2 especies con más presencia en cada celda; más biomasa, más plantas
  function pintarPlantas() {
    const usados = {}; for (const f of FORMAS) usados[f] = 0;
    const vivas = E.especies.filter((s) => s.extinta == null);
    const top = new Int32Array(M.n * 2).fill(-1), tb = new Float32Array(M.n * 2);
    vivas.forEach((s, k) => { for (let i = 0; i < M.n; i++) { const b = s.b[i]; if (b < 0.05) continue; if (b > tb[i * 2]) { tb[i * 2 + 1] = tb[i * 2]; top[i * 2 + 1] = top[i * 2]; tb[i * 2] = b; top[i * 2] = k; } else if (b > tb[i * 2 + 1]) { tb[i * 2 + 1] = b; top[i * 2 + 1] = k; } } });
    for (let i = 0; i < M.n; i++) for (let q = 0; q < 2; q++) {
      const k = top[i * 2 + q]; if (k < 0) continue; const s = vivas[k], n = Math.min(4, Math.round(tb[i * 2 + q] * 4)); if (!n) continue;
      const f = s.forma, m = plantas[f]; if (!m) continue;
      _c.setHSL(s.forma === 'flor' || (s.forma === 'mata' && s.flor >= 0) ? (s.flor >= 0 ? s.flor : s.hue) : s.hue, s.forma === 'flor' ? 0.7 : 0.45, s.forma === 'flor' ? 0.6 : s.forma === 'cereal' ? 0.55 : 0.36);
      for (let j = 0; j < n; j++) {
        if (usados[f] >= MAX) break;
        const sem = (i * 7 + j * 3 + q * 11 + s.id) % 97, a = sem * 2.4, r = 0.25 + (sem % 5) * 0.14;
        _o.position.set(M.x[i] + Math.cos(a) * r, alto(i), M.z[i] + Math.sin(a) * r); _o.rotation.set(0, a, 0); _o.scale.setScalar(ESC_FORMA[f] * (0.75 + (sem % 4) * 0.1));
        _o.updateMatrix(); m.setMatrixAt(usados[f], _o.matrix); m.setColorAt(usados[f], _c); usados[f]++;
      }
    }
    for (const f of FORMAS) { const m = plantas[f]; m.count = usados[f]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  function pintarAldeas() {
    aldeasG.clear();
    for (const a of E.aldeas) {
      const g = new THREE.Group(), x = M.x[a.celda], z = M.z[a.celda], y = alto(a.celda); g.position.set(x, y, z);
      for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(a.viva ? casa : casaAband, MAT_VERTICE); const an = k * 1.05; m.position.set(Math.cos(an) * 0.9, 0, Math.sin(an) * 0.9); m.rotation.y = an; m.castShadow = true; g.add(m); }
      aldeasG.add(g);
    }
    aldeasG.userData.clave = E.aldeas.map((a) => a.viva).join();
  }
  function procesarEfectos() {
    for (const f of E.efectos) {
      if (f.id <= ultEf) continue; ultEf = f.id; const i = f.celda;
      if (f.t === 'apagon') { puerta.userData.apagon = 2; continue; }
      if (i == null || i < 0 || i >= M.n) continue; const x = M.x[i], y = alto(i), z = M.z[i];
      if (f.t === 'siembra') brillo(x, y, z, 40, [0.5, 1, 0.4], 1.6);
      else if (f.t === 'recolecta') brillo(x, y, z, 26, [1, 0.85, 0.4], 0.8);
      else if (f.t === 'mutacion') brillo(x, y, z, 30, [0.4, 0.95, 1], 0.8);
      else if (f.t === 'entrega' || f.t === 'peticion') brillo(x, y, z, 50, f.t === 'entrega' ? [1, 0.85, 0.3] : [1, 0.5, 0.3], 2);
      else if (f.t === 'abandono') for (let k = 0; k < 40; k++) humo.emitir({ x: x + (Math.random() - 0.5) * 2, y: y + 0.5, z: z + (Math.random() - 0.5) * 2, vx: 0.2, vy: 0.6, vz: 0, vida: 4, tam: 0.8, crece: 2, r: 0.3, g: 0.28, b: 0.26, a: 0.5 });
    }
  }
  function climaVisible(dt) {
    const C = E.clima, frio = C.T < 6, lluvioso = C.lluvia > 1.15;
    if ((frio || lluvioso) && Math.random() < dt * 40) for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 40; luz.emitir({ x: Math.cos(a) * d, y: 14 + Math.random() * 4, z: Math.sin(a) * d, vx: 0, vy: frio ? -2 : -9, vz: 0, vida: frio ? 6 : 1.6, tam: frio ? 0.16 : 0.08, r: frio ? 1 : 0.6, g: frio ? 1 : 0.8, b: 1, a: frio ? 0.9 : 0.6 }); }
    for (const v of E.eventos) if (v.tipo === 'incendio' && Math.random() < dt * 20) { const i = v.celda, a = Math.random() * 6.28, d = Math.random() * v.r * CEL; luz.emitir({ x: M.x[i] + Math.cos(a) * d, y: alto(i) + 0.3, z: M.z[i] + Math.sin(a) * d, vx: 0, vy: 1.5, vz: 0, vida: 0.8, tam: 0.5, crece: -0.5, r: 1, g: 0.5, b: 0.1, a: 0.9 }); }
    for (const v of E.eventos) if (v.tipo === 'plaga' && Math.random() < dt * 10) { const i = v.celda, a = Math.random() * 6.28, d = Math.random() * v.r * CEL; humo.emitir({ x: M.x[i] + Math.cos(a) * d, y: alto(i) + 0.5, z: M.z[i] + Math.sin(a) * d, vx: (Math.random() - 0.5), vy: 0.2, vz: (Math.random() - 0.5), vida: 3, tam: 0.12, r: 0.2, g: 0.15, b: 0.25, a: 0.9 }); }
  }

  let tPint = 0, añoPint = -1;
  return {
    montar(estado) { E = estado; M = E.mapa; ultEf = E.efectos.reduce((m, f) => Math.max(m, f.id), -1); construirTerreno(); pintarTerreno(); pintarPlantas(); pintarAldeas(); añoPint = E.año; },
    actualizar(estado, dt, t, noche) {
      if (estado !== E || verMapa !== estado.semilla) this.montar(estado);
      tPint += dt; if (E.año !== añoPint && tPint > 0.25) { tPint = 0; añoPint = E.año; pintarTerreno(); pintarPlantas(); }
      if (aldeasG.userData.clave !== E.aldeas.map((a) => a.viva).join()) pintarAldeas();
      procesarEfectos(); climaVisible(dt);
      // la bóveda: luz de noche, parpadeo en los apagones
      const ap = puerta.userData.apagon || 0; if (ap > 0) puerta.userData.apagon = ap - dt;
      puerta.material.emissiveIntensity = ap > 0 ? (Math.sin(t * 30) > 0 ? 0.1 : 1) : 0.6 + noche * 1.2; luzB.intensity = ap > 0 ? 0 : noche * 6;
      if (mira.visible) mira.material.opacity = 0.7 + Math.sin(t * 6) * 0.25;
      const h = O.renderer.domElement.height; humo.mat.uniforms.uEsc.value = luz.mat.uniforms.uEsc.value = h / (2 * Math.tan((O.camera.fov * Math.PI) / 360));
      humo.actualizar(dt); luz.actualizar(dt);
    },
    tocar(ev) {
      const r = O.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), O.camera);
      const h = ray.intersectObject(terreno)[0]; if (h) return h.instanceId;
      const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), p) ? celdaCercana(M, p.x, p.z) : -1;
    },
    marcar(i) { if (i == null || i < 0) { mira.visible = false; return; } mira.visible = true; mira.position.set(M.x[i], alto(i) + 0.06, M.z[i]); },
    posCelda: (i) => new THREE.Vector3(M.x[i], alto(i), M.z[i]),
    get celdaBoveda() { return boveda.userData.celda; },
  };
}
