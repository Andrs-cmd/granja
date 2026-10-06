// =====================================================================
// La aldea en 3D: dibuja la civilización dentro del orbe (no decide nada de la vida).
//  - el suelo es un lienzo pintado celda a celda (pradera, bosque, campos, calles, contaminación, ruinas)
//    sobre una malla con relieve (la montaña que las minas van excavando)
//  - los edificios son una InstancedMesh por arquetipo (choza, casa, bloque, torre, aguja, cúpula…)
//    y otra por arquetipo para las ventanas que brillan de noche: pocas llamadas de dibujo
//  - la gente sigue un horario (casa → trabajo → plaza → casa); las 12 más cercanas a la cámara
//    tienen cuerpo articulado, el resto son figuras instanciadas vestidas según la era
//  - autos, humo, faroles y los efectos de cada destino (cohetes, luz, colmena, hongo nuclear);
//    el tráfico aéreo de cada era (globos → zepelines → aviones → jets, drones y naves, y cohetes) vive en aereos.js
// =====================================================================
import { THREE, fundir, fundirGeo, GEO, MAT_VERTICE, crearPersona, animarPersona, angLerp } from '../motor/orbe3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geometrias, aspecto, ropaDe, ARQ } from './urbe3d.js';
import * as U from './ciudad.js';
import { crearAereos } from './aereos.js';
import { crearMultitud } from './multitud.js';
import { crearEfectos } from './efectos.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler(), UP = V(0, 1, 0);
const NDET = 12, MAXP = 260;
const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

export function crearEscenaAldea(O, s0) {
  const M = O.mundo;
  let s = s0;
  // ------------------------------------------------------------ suelo pintado con relieve
  const TAM = 92, RES = 276, lienzo = document.createElement('canvas'); lienzo.width = lienzo.height = RES;
  const ctx = lienzo.getContext('2d'), tex = new THREE.CanvasTexture(lienzo); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geoSuelo = new THREE.PlaneGeometry(TAM, TAM, 92, 92).rotateX(-Math.PI / 2);
  const suelo = new THREE.Mesh(geoSuelo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  suelo.receiveShadow = true; M.add(suelo);
  const alt = (x, z) => U.altura(s, x, z);
  function relieve() {
    const p = geoSuelo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.03 + alt(p.getX(i), p.getZ(i)));
    p.needsUpdate = true; geoSuelo.computeVertexNormals();
  }
  const px = (x) => ((x + TAM / 2) / TAM) * RES;
  const SUELO_EST = ['#7fa35a', '#8ea552', '#a48c4c', '#dfe5ea'], CALLE = ['#8a7656', '#8a7656', '#8f8a80', '#8a857c', '#5e5a54', '#4a4c50', '#3e4146', '#c9d2dc'];
  const mezclar = (a, b, k) => { const A = new THREE.Color(a), Bc = new THREE.Color(b); return '#' + A.lerp(Bc, Math.max(0, Math.min(1, k))).getHexString(); };
  function pintar() {
    const est = Math.floor((s.dia % 24) / 6), cel = (U.CEL / TAM) * RES;
    ctx.clearRect(0, 0, RES, RES);
    ctx.save(); ctx.beginPath(); ctx.arc(RES / 2, RES / 2, (45.6 / TAM) * RES, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = SUELO_EST[est]; ctx.fillRect(0, 0, RES, RES);
    for (const c of s.celdas) {
      let col = SUELO_EST[est];
      if (c.t === 'b') col = est === 3 ? '#cfd8d0' : '#5f7f43';
      if (c.t === 'r') col = '#8a8478'; if (c.t === 'm') col = c.h > 5.5 && est === 3 ? '#eef2f4' : mezclar('#857a6a', '#a89e90', c.h / 8);
      if (c.t === 'a') col = '#c9b37a'; if (c.t === 'v') col = '#4a7a98'; if (c.t === 'c') col = '#6a7a4a';
      if (c.u === 'campo') col = c.e >= 6 ? '#5aa08a' : ['#9ab04a', '#8aa83a', '#d8b04a', '#8a7454'][est];
      else if (c.u === 'parque') col = '#4f8a3a';
      else if (c.u) col = c.fogata && c.e <= 1 ? '#8c7a56' : CALLE[Math.min(7, c.e)] === '#c9d2dc' && (s.ejes.ni < -15 || s.destino?.tipo === 'gaia') ? '#7a9a6a' : mezclar(CALLE[Math.min(7, c.e)], '#a8a29a', 0.35);
      if (c.o && !c.u) col = '#9a8460';
      if (c.ru) col = '#4a4640';
      if (c.cr) col = mezclar(col, '#2a221c', c.cr);   // cráter de meteorito: tierra quemada
      if (c.cont > 0.05) col = mezclar(col, '#2e2a26', c.cont * 0.8);
      ctx.fillStyle = col; ctx.fillRect(px(c.x - 1.5), px(c.z - 1.5), cel + 0.6, cel + 0.6);
      if (c.u === 'campo' && est !== 3) { ctx.fillStyle = 'rgba(70,50,30,.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(px(c.x - 1.3), px(c.z - 1.1 + k * 0.7), cel * 0.85, 1); }
    }
    // calles: los bordes de las manzanas construidas
    const e = s.era; ctx.strokeStyle = CALLE[Math.min(7, e)]; ctx.lineWidth = e >= 5 ? 2.2 : 1.4;
    ctx.beginPath();
    for (const c of s.celdas) if (c.u && !['campo', 'parque'].includes(c.u) && !c.ru) { const x0 = px(c.x - 1.5), z0 = px(c.z - 1.5); ctx.rect(x0, z0, cel, cel); }
    if (e >= 1) ctx.stroke();
    ctx.restore();
    tex.needsUpdate = true;
  }
  // ------------------------------------------------------------ agua: lago y río (más turbios con la contaminación)
  const agua = new THREE.MeshStandardMaterial({ color: 0x3f86b0, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.9 });
  {
    const L = s.lago, g1 = new THREE.CircleGeometry(L.r, 48).rotateX(-Math.PI / 2).translate(L.x, 0.09, L.z).toNonIndexed(); g1.deleteAttribute('uv');
    const pos = [], pts = s.rio.filter(([x, z]) => Math.hypot(x, z) < 45.8);
    for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = (-dz / l) * 1.1, nz = (dx / l) * 1.1; pos.push(x0 - nx, 0.08, z0 - nz, x1 - nx, 0.08, z1 - nz, x1 + nx, 0.08, z1 + nz, x0 - nx, 0.08, z0 - nz, x1 + nx, 0.08, z1 + nz, x0 + nx, 0.08, z0 + nz); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.computeVertexNormals();
    const m = new THREE.Mesh(mergeGeometries([g1, g2]), agua); m.receiveShadow = true; M.add(m);
  }
  const borde = new THREE.Mesh(new THREE.TorusGeometry(s.lago.r + 0.1, 0.22, 6, 48).rotateX(Math.PI / 2).translate(s.lago.x, 0.1, s.lago.z), new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9 })); borde.visible = false; M.add(borde);

  // ------------------------------------------------------------ árboles, rocas y tumbas
  const geoPino = fundirGeo([[GEO.cil, 0x6a4a2e, 0, 0.7, 0, 0.22, 1.4, 0.22], [GEO.cono, 0xffffff, 0, 2.2, 0, 1.4, 2.2, 1.4], [GEO.cono, 0xffffff, 0, 3.3, 0, 1, 1.8, 1]]);
  const geoRoble = fundirGeo([[GEO.cil, 0x6a4a2e, 0, 0.9, 0, 0.26, 1.8, 0.26], [GEO.esfera, 0xffffff, 0, 2.6, 0, 1.5, 1.3, 1.5], [GEO.esfera, 0xffffff, 0.6, 2.2, 0.3, 0.9, 0.8, 0.9]]);
  const nA = s.maxArboles || s.arboles.length + 260;
  const pinos = new THREE.InstancedMesh(geoPino, MAT_VERTICE, nA), robles = new THREE.InstancedMesh(geoRoble, MAT_VERTICE, nA);
  for (const im of [pinos, robles]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; for (let i = 0; i < nA; i++) im.setColorAt(i, _c.setRGB(1, 1, 1)); M.add(im); }
  const rocas = new THREE.InstancedMesh(fundirGeo([[new THREE.DodecahedronGeometry(1, 0), 0x8f8b84, 0, 0.5, 0, 1.2, 0.9, 1.1]]), MAT_VERTICE, s.rocas.length); rocas.castShadow = true; M.add(rocas);
  const tumbas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0x8a867c, 0, 0.45, 0, 0.55, 0.9, 0.16]]), MAT_VERTICE, 81); tumbas.count = 0; M.add(tumbas);
  const COPA = { pino: ['#3f6a3a', '#386236', '#3a5e36', '#c4ccd0'], roble: ['#5c8a3e', '#4f7a34', '#c8782c', '#cfd6dc'] };
  let firmaA = '';
  function bosque() {
    const est = Math.floor((s.dia % 24) / 6), muerto = s.destino?.tipo === 'destruccion' && ['nuclear', 'eco'].includes(s.destino.causa);
    const f = `${s.arboles.length}:${s.arboles.reduce((n, t, i) => n + (t.c < 0 ? 0 : Math.round(t.c * 5) + 1) * ((i % 7) + 1), 0)}:${est}:${muerto}`;
    if (f === firmaA) return; firmaA = f;
    let np = 0, nr = 0;
    s.arboles.forEach((t, i) => {
      if (t.c <= 0) return;
      const esc = (0.3 + 0.7 * t.c) * (0.85 + ((i * 37) % 10) / 30), im = t.v ? robles : pinos, k = t.v ? nr++ : np++;
      _m.compose(_p.set(t.x, alt(t.x, t.z), t.z), _q.setFromAxisAngle(UP, (i * 2.399) % 6.28), _s.setScalar(esc)); im.setMatrixAt(k, _m);
      im.setColorAt(k, _c.set(muerto ? '#5a4a3a' : (t.v ? COPA.roble : COPA.pino)[est]));
    });
    pinos.count = np; robles.count = nr;
    for (const im of [pinos, robles]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    s.rocas.forEach((r, i) => { _m.compose(_p.set(r.x, alt(r.x, r.z) - 0.1, r.z), _q.setFromAxisAngle(UP, r.t * 6), _s.setScalar(0.8)); rocas.setMatrixAt(i, _m); }); rocas.instanceMatrix.needsUpdate = true;
    tumbas.count = Math.min(81, s.tumbas.length); s.tumbas.slice(0, 81).forEach((t, i) => { _m.compose(_p.set(t.x, 0, t.z), _q.setFromAxisAngle(UP, s.cementerio.ang + Math.PI / 2), _s.setScalar(1)); tumbas.setMatrixAt(i, _m); }); tumbas.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ edificios por arquetipo (cuerpo + ventanas), cultivos, parques y obras
  const GEOS = geometrias();
  const matVent = new THREE.MeshStandardMaterial({ color: 0x3a4250, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.4, metalness: 0.2 });
  const CAP = 420, arq = {};
  for (const k of ARQ) {
    const cu = new THREE.InstancedMesh(GEOS[k].cuerpo, MAT_VERTICE, CAP); cu.castShadow = cu.receiveShadow = true; cu.frustumCulled = false; cu.count = 0; for (let i = 0; i < CAP; i++) cu.setColorAt(i, _c.setRGB(1, 1, 1)); M.add(cu);
    let ve = null; if (GEOS[k].ventanas) { ve = new THREE.InstancedMesh(GEOS[k].ventanas, matVent, CAP); ve.frustumCulled = false; ve.count = 0; M.add(ve); }
    arq[k] = { cu, ve, n: 0 };
  }
  const geoCultivo = fundirGeo([...Array(4)].flatMap((_, i) => [...Array(5)].map((_, j) => [GEO.cono, 0xffffff, -0.36 + j * 0.18, 0.12, -0.3 + i * 0.2, 0.06, 0.24, 0.06])));
  const cultivos = new THREE.InstancedMesh(geoCultivo, MAT_VERTICE, 400); cultivos.count = 0; cultivos.castShadow = true; for (let i = 0; i < 400; i++) cultivos.setColorAt(i, _c.setRGB(1, 1, 1)); M.add(cultivos);
  const geoParque = fundirGeo([[GEO.cil, 0x6a4a2e, 0, 0.4, 0, 0.12, 0.8, 0.12], [GEO.esfera, 0x4f8a3a, 0, 1.1, 0, 0.6, 0.55, 0.6]]);
  const parques = new THREE.InstancedMesh(geoParque, MAT_VERTICE, 400); parques.count = 0; parques.castShadow = true; M.add(parques);
  const geoAndamio = fundirGeo([[GEO.caja, 0x5e3b22, -0.45, 0.5, -0.45, 0.04, 1, 0.04], [GEO.caja, 0x5e3b22, 0.45, 0.5, -0.45, 0.04, 1, 0.04], [GEO.caja, 0x5e3b22, -0.45, 0.5, 0.45, 0.04, 1, 0.04], [GEO.caja, 0x5e3b22, 0.45, 0.5, 0.45, 0.04, 1, 0.04], [GEO.caja, 0xb08a5a, 0, 0.5, 0.45, 0.94, 0.03, 0.12], [GEO.caja, 0xb08a5a, 0, 0.5, -0.45, 0.94, 0.03, 0.12], [GEO.caja, 0xb08a5a, 0, 0.95, 0.45, 0.94, 0.03, 0.12]]);
  const andamios = new THREE.InstancedMesh(geoAndamio, MAT_VERTICE, 60); andamios.count = 0; M.add(andamios);
  const gruas = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0xe0b030, 0, 0.5, 0, 0.05, 1, 0.05], [GEO.caja, 0xe0b030, 0.25, 1.0, 0, 0.7, 0.04, 0.05], [GEO.caja, 0x555555, -0.12, 0.98, 0, 0.12, 0.08, 0.12]]), MAT_VERTICE, 60); gruas.count = 0; gruas.castShadow = true; M.add(gruas);
  let firmaC = '', ruinasFuego = [];
  function ciudad() {
    const f = `${s.vc}:${s.era}:${Math.floor((s.dia % 24) / 6)}:${s.destino?.tipo || ''}:${s.ejes.ni < -15}:${s.ejes.cf < -20}`;
    if (f === firmaC) return false; firmaC = f;
    for (const k of ARQ) arq[k].n = 0;
    let nc = 0, np = 0, na = 0, ng = 0; ruinasFuego = [];
    const est = Math.floor((s.dia % 24) / 6), CULT = ['#7cc04a', '#8ab03a', '#e0b84a', '#8a7454'];
    for (const c of s.celdas) {
      const y = alt(c.x, c.z);
      if (c.u === 'campo' && !c.ru) { if (nc < 400) { _m.compose(_p.set(c.x, y, c.z), _q.identity(), _s.set(2.8, est === 3 ? 0.3 : 1, 2.8)); cultivos.setMatrixAt(nc, _m); cultivos.setColorAt(nc++, _c.set(c.e >= 6 ? '#3ab0a0' : CULT[est])); } continue; }
      if (c.u === 'parque') { for (let k = 0; k < 3 && np < 400; k++) { const a = k * 2.1 + c.k; _m.compose(_p.set(c.x + Math.cos(a) * 0.8, y, c.z + Math.sin(a) * 0.8), _q.identity(), _s.setScalar(1 + (k % 2) * 0.3)); parques.setMatrixAt(np++, _m); } continue; }
      const A = aspecto(s, c, s.era); if (!A) continue;
      const enObra = c.o && !c.u, R = arq[A.a]; if (!R || R.n >= CAP) continue;
      const sy = A.sy * (enObra ? 0.1 + 0.9 * c.o.p : 1), rot = (c.k % 4) * (Math.PI / 2);
      _m.compose(_p.set(c.x, y, c.z), _q.setFromAxisAngle(UP, rot), _s.set(A.sx, sy, A.sz));
      R.cu.setMatrixAt(R.n, _m); R.cu.setColorAt(R.n, A.color); if (R.ve) R.ve.setMatrixAt(R.n, _m); R.n++;
      if (c.o && na < 60) { const h = Math.max(2.5, (c.o.u === 'vivienda' && c.o.e >= 4 ? c.o.n * 0.95 : A.sy) * Math.max(0.3, c.o.p) + 0.5); _m.compose(_p.set(c.x, y, c.z), _q.identity(), _s.set(2.8, h, 2.8)); andamios.setMatrixAt(na++, _m); if (c.o.e >= 4 && ng < 60) { _m.compose(_p.set(c.x + 1.2, y, c.z - 1.2), _q.setFromAxisAngle(UP, c.k), _s.set(4, h + 3, 4)); gruas.setMatrixAt(ng++, _m); } }
      if (c.ru && ruinasFuego.length < 30 && (c.k % 3 === 0)) ruinasFuego.push([c.x, y, c.z]);
    }
    for (const k of ARQ) { const R = arq[k]; R.cu.count = R.n; R.cu.visible = R.n > 0; R.cu.instanceMatrix.needsUpdate = true; R.cu.instanceColor.needsUpdate = true; if (R.ve) { R.ve.count = R.n; R.ve.visible = R.n > 0; R.ve.instanceMatrix.needsUpdate = true; } }
    cultivos.count = nc; cultivos.instanceMatrix.needsUpdate = true; cultivos.instanceColor.needsUpdate = true;
    parques.count = np; parques.instanceMatrix.needsUpdate = true;
    andamios.count = na; andamios.instanceMatrix.needsUpdate = true; gruas.count = ng; gruas.instanceMatrix.needsUpdate = true;
    redVial();
    return true;
  }
  // ------------------------------------------------------------ calles para los autos: las esquinas de las manzanas
  let nodos = [], aristas = new Map();
  function redVial() {
    const m = new Map(), add = (a, b) => { const ka = `${a[0]},${a[1]}`, kb = `${b[0]},${b[1]}`; if (!m.has(ka)) m.set(ka, { p: a, v: new Set() }); if (!m.has(kb)) m.set(kb, { p: b, v: new Set() }); m.get(ka).v.add(kb); m.get(kb).v.add(ka); };
    for (const c of s.celdas) if (c.u && !['campo', 'parque'].includes(c.u) && !c.ru) { const x0 = c.x - 1.5, x1 = c.x + 1.5, z0 = c.z - 1.5, z1 = c.z + 1.5; add([x0, z0], [x1, z0]); add([x1, z0], [x1, z1]); add([x1, z1], [x0, z1]); add([x0, z1], [x0, z0]); }
    aristas = m; nodos = [...m.keys()];
  }
  // ------------------------------------------------------------ vehículos de tierra: autos (era moderna en adelante); los del cielo están en aereos.js
  const autos = new THREE.InstancedMesh(fundirGeo([[GEO.caja, 0xffffff, 0, 0.18, 0, 0.32, 0.18, 0.62], [GEO.caja, 0x2a3440, 0, 0.33, -0.04, 0.28, 0.14, 0.32]]), MAT_VERTICE, 70); autos.count = 0; for (let i = 0; i < 70; i++) autos.setColorAt(i, _c.setHSL((i * 0.137) % 1, 0.5, 0.5)); M.add(autos);
  const aereos = crearAereos(M, (x, z) => alt(x, z));
  const multitud = crearMultitud(M, (x, z) => alt(x, z)), efectos = crearEfectos(M, (x, z) => alt(x, z));
  const carros = [...Array(70)].map((_, i) => ({ de: null, a: null, t: 0, v: 3 + (i % 5) }));
  function moverAutos(dt, mult) {
    const n = s.era >= 5 && !s.destino ? Math.min(70, Math.floor(nodos.length / 6)) : 0;
    autos.count = n;
    for (let i = 0; i < n; i++) {
      const c = carros[i];
      if (!c.de || !aristas.get(c.de) || !aristas.get(c.a)) { c.de = nodos[Math.floor(hash(i * 13 + s.dia) * nodos.length)]; const vs = [...(aristas.get(c.de)?.v || [])]; c.a = vs[i % Math.max(1, vs.length)] || c.de; c.t = 0; }
      c.t += (dt * c.v * Math.min(4, 1 + mult / 200)) / 3;
      if (c.t >= 1) { const vs = [...aristas.get(c.a).v].filter((k) => k !== c.de); c.de = c.a; c.a = vs.length ? vs[Math.floor(hash(i * 7 + Math.floor(c.t * 100) + s.dia) * vs.length)] : c.de; c.t = 0; }
      const A = aristas.get(c.de).p, B = aristas.get(c.a).p, x = A[0] + (B[0] - A[0]) * c.t, z = A[1] + (B[1] - A[1]) * c.t;
      _m.compose(_p.set(x, alt(x, z), z), _q.setFromAxisAngle(UP, Math.atan2(B[0] - A[0], B[1] - A[1])), _s.setScalar(1)); autos.setMatrixAt(i, _m);
    }
    autos.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ fuego, humo y faroles
  const matLlama = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a10, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
  const llamas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.45, 1.2, 7), matLlama, 96); llamas.count = 0; llamas.frustumCulled = false; M.add(llamas);
  const luzF = new THREE.PointLight(0xffa04a, 0, 26, 1.6); M.add(luzF);
  const humoTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const NH = 260, humoPos = new Float32Array(NH * 3).fill(-50), humoVida = new Float32Array(NH).fill(-1), humoGeo = new THREE.BufferGeometry(); humoGeo.setAttribute('position', new THREE.BufferAttribute(humoPos, 3));
  const matHumo = new THREE.PointsMaterial({ color: 0xbdb8b0, size: 2.6, map: humoTex, transparent: true, opacity: 0.45, depthWrite: false });
  const humo = new THREE.Points(humoGeo, matHumo); humo.frustumCulled = false; M.add(humo);
  const NF = 400, farPos = new Float32Array(NF * 3), farGeo = new THREE.BufferGeometry(); farGeo.setAttribute('position', new THREE.BufferAttribute(farPos, 3));
  const faroles = new THREE.Points(farGeo, new THREE.PointsMaterial({ color: 0xffd890, size: 0.9, map: humoTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); faroles.frustumCulled = false; M.add(faroles);
  function ponerFaroles() { let n = 0; for (let i = 0; i < nodos.length && n < NF; i += 2) { const p = aristas.get(nodos[i]).p; farPos.set([p[0], alt(p[0], p[1]) + 1.6, p[1]], n * 3); n++; } farGeo.setDrawRange(0, n); farGeo.attributes.position.needsUpdate = true; }
  // ------------------------------------------------------------ lluvia y nieve
  const NL = 400, lluPos = new Float32Array(NL * 6), lluGeo = new THREE.BufferGeometry(); lluGeo.setAttribute('position', new THREE.BufferAttribute(lluPos, 3));
  for (let i = 0; i < NL; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 42, x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.random() * 40; lluPos.set([x, y, z, x + 0.1, y + 1.1, z], i * 6); }
  const lluvia = new THREE.LineSegments(lluGeo, new THREE.LineBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: 0.5 })); lluvia.frustumCulled = false; lluvia.visible = false; M.add(lluvia);

  // ------------------------------------------------------------ destinos: cohetes, ascensor y estación; luz; red neural; hongo nuclear
  const destino = new THREE.Group(); M.add(destino);
  const matBrillo = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(52, 40, 24), matBrillo); halo.position.y = 4; destino.add(halo);
  const ascensor = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xdde4ee, emissive: 0x88aaff, emissiveIntensity: 0.4 })); ascensor.visible = false; destino.add(ascensor);
  const estacion = new THREE.Mesh(new THREE.TorusGeometry(9, 0.7, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe8eef6, emissive: 0x4488ff, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.3 })); estacion.rotation.x = Math.PI / 2; estacion.visible = false; destino.add(estacion);
  const geoCohete = fundirGeo([[GEO.cil, 0xf2f2f2, 0, 1.2, 0, 0.35, 2.4, 0.35], [GEO.cono, 0xd04030, 0, 2.7, 0, 0.35, 0.7, 0.35], [GEO.cono, 0xffa030, 0, -0.2, 0, 0.3, 0.8, 0.3, Math.PI, 0, 0]]);
  const cohetes = new THREE.InstancedMesh(geoCohete, MAT_VERTICE, 24); cohetes.count = 0; destino.add(cohetes);
  const NLZ = 300, luzPos = new Float32Array(NLZ * 3), luzGeo = new THREE.BufferGeometry(); luzGeo.setAttribute('position', new THREE.BufferAttribute(luzPos, 3));
  const luces = new THREE.Points(luzGeo, new THREE.PointsMaterial({ color: 0xfff2c0, size: 1.4, map: humoTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); luces.frustumCulled = false; luces.visible = false; destino.add(luces);
  const red = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x3ac8ff, transparent: true, opacity: 0.35 })); red.visible = false; red.frustumCulled = false; destino.add(red);
  const hongo = fundir([[GEO.cil, 0xc8a080, 0, 6, 0, 1.6, 12, 1.6], [GEO.esferaFina, 0xd8b090, 0, 13, 0, 6, 3.6, 6], [GEO.esferaFina, 0xa88060, 0, 12, 0, 4, 2.4, 4], [GEO.esferaFina, 0xe8c8a0, 0, 2, 0, 5, 1.2, 5]]); hongo.visible = false; destino.add(hongo);
  let firmaRed = '';
  function hacerRed() {
    const cs = s.celdas.filter((c) => c.u && !['campo', 'parque'].includes(c.u) && !c.ru), pts = [];
    for (let i = 0; i < cs.length; i += 2) { const b = cs[(i * 7 + 13) % cs.length]; if (b === cs[i]) continue; pts.push(cs[i].x, 8 + (i % 5), cs[i].z, b.x, 8 + ((i + 1) % 5), b.z); }
    red.geometry.dispose(); red.geometry = new THREE.BufferGeometry(); red.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }

  // ------------------------------------------------------------ gente
  const figGeo = fundirGeo([[GEO.capsula, 0xffffff, 0, 1.05, 0, 0.42, 0.9, 0.3], [GEO.esferaFina, 0xe8c8a8, 0, 1.78, 0, 0.17, 0.19, 0.17], [GEO.capsula, 0x555555, -0.12, 0.42, 0, 0.15, 0.6, 0.15], [GEO.capsula, 0x555555, 0.12, 0.42, 0, 0.15, 0.6, 0.15]]);
  const matFig = MAT_VERTICE;
  const figuras = new THREE.InstancedMesh(figGeo, matFig, MAXP); figuras.count = 0; figuras.castShadow = true; figuras.frustumCulled = false; for (let i = 0; i < MAXP; i++) figuras.setColorAt(i, _c.setRGB(1, 1, 1)); M.add(figuras);
  const vis = new Map(), gruposDet = [];
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe7c46a, transparent: true, opacity: 0.85, depthWrite: false })); anillo.visible = false; M.add(anillo);
  let sel = null;
  const centro = (k) => U.mapa(s).get(k);
  // dónde está cada quien a esta hora (horario propio, un poco distinto para cada persona)
  function lugar(a, h, C) {
    const fase = (hash(a.id) - 0.5) * 1.4, hh = (((h - fase) % 24) + 24) % 24, casa = centro(a.hogar), trab = centro(a.trabajo), plaza = C ? { x: C.x, z: C.z } : { x: 0, z: 0 };
    const jit = (k, r) => [(hash(a.id * 7 + k) - 0.5) * r, (hash(a.id * 11 + k) - 0.5) * r];
    const P = (c, k, r = 2) => { if (!c) { const [jx, jz] = jit(k, 6); return [plaza.x + jx, plaza.z + jz]; } const [jx, jz] = jit(k, r); return [c.x + jx, c.z + jz]; };
    const enCasa = P(casa, 1, 1.2), enTrab = a.edad < 14 ? P(centro(a.hogar), 5, 7) : P(trab, 2, 2.6), enPlaza = P(null, 3);
    // ir de A a B por las calles (las líneas entre manzanas), no atravesando edificios; desde la era moderna
    // los trayectos largos se hacen en auto (y en la futura, en nave): la persona desaparece en el tráfico
    const viaje = (A, B, k) => { const r = ruta(A, B, k); return { p: r.p, modo: 'camina', dentro: s.era >= 5 && r.largo > 16 && k > 0.06 && k < 0.94 }; };
    if (a.edad < 3) return { p: enCasa, dentro: hh < 7 || hh > 19, modo: 'quieto' };
    if (hh < 6 || hh >= 22) return { p: enCasa, dentro: true, modo: 'quieto' };
    if (hh < 7.3) return viaje(enCasa, enTrab, (hh - 6) / 1.3);
    if (hh < 17) { if (a.edad >= 70 || !a.oficio) return { p: P(casa, 4, 3.5), modo: 'sentado' }; return { p: enTrab, modo: a.edad < 14 ? 'corre' : hh > 12 && hh < 13 ? 'sentado' : MODO[a.oficio] || 'trabaja' }; }
    if (hh < 18.3) return viaje(enTrab, a.p.ext > 0.45 ? enPlaza : enCasa, (hh - 17) / 1.3);
    if (hh < 21) return { p: a.p.ext > 0.45 ? enPlaza : P(casa, 6, 3), modo: s.fiesta && s.dia <= s.fiesta ? 'baila' : 'quieto' };
    return viaje(a.p.ext > 0.45 ? enPlaza : enCasa, enCasa, hh - 21);
  }
  // camino en "L" por la cuadrícula de calles (x y z ≡ 1,5 módulo 3): A → calle → esquina → calle → B
  const calle = (v) => Math.round((v - 1.5) / 3) * 3 + 1.5;
  function ruta(A, B, k) {
    const P = [A, [calle(A[0]), A[1]], [calle(A[0]), calle(B[1])], [B[0], calle(B[1])], B], L = [];
    let tot = 0; for (let i = 1; i < P.length; i++) { const d = Math.abs(P[i][0] - P[i - 1][0]) + Math.abs(P[i][1] - P[i - 1][1]); L.push(d); tot += d; }
    let q = Math.max(0, Math.min(1, k)) * tot;
    for (let i = 0; i < L.length; i++) { if (q <= L[i] || i === L.length - 1) { const u = L[i] ? Math.min(1, q / L[i]) : 1; return { p: [P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u], largo: tot }; } q -= L[i]; }
    return { p: B, largo: tot };
  }
  const MODO = { comida: 'trabaja', materiales: 'golpe', metal: 'golpe', energia: 'trabaja', bienes: 'trabaja', ciencia: 'quieto', fe: 'sentado', salud: 'trabaja', comercio: 'quieto', seguridad: 'quieto', cultura: 'baila', construir: 'trabaja' };
  function hacerPersona(a) {
    const pelo = a.edad >= 64 ? 0xe4e2dc : a.edad >= 52 ? 0x9a968e : a.ap.pelo;
    const p = crearPersona({ piel: a.ap.piel, ropa: ropaDe(s.era, a), pantalon: s.era >= 4 ? 0x2a2e38 : 0x4a3a2a, pelo, peinado: a.ap.peinado, ancho: a.ap.ancho });
    p.g.userData.id = a.id;
    p.g.traverse((o) => { if (o.isMesh) o.castShadow = o.parent === p.torso || o === p.torso; });
    return p;
  }

  // ------------------------------------------------------------ cada cuadro
  let tLento = 1, firmaFar = '', vh = -1;
  function actualizar(s1, dt, mult) {
    s = s1;
    const hr = (s.t % 1440) / 60, L = O.luz, tt = performance.now() / 1000, D = s.destino, fase = D?.fase || 0;
    tLento += dt;
    if (tLento > 0.5) {
      tLento = 0;
      if (s.vh !== vh) { vh = s.vh; relieve(); }
      const cambio = ciudad(); if (cambio) { pintar(); ponerFaroles(); } else if (s.dia % 6 === 0 && firmaFar !== `${s.dia}`) { firmaFar = `${s.dia}`; pintar(); }
      bosque();
      borde.visible = s.era >= 3;
      const cont = s.contaminacion;
      agua.color.set(cont > 0.25 ? '#5a6a50' : Math.floor((s.dia % 24) / 6) === 3 ? '#a8c4d4' : '#3f86b0');
      if (!O.scene.fog) O.scene.fog = new THREE.Fog(0x9a948a, 400, 900);
      O.scene.fog.near = 200 - cont * 170; O.scene.fog.far = 420 - cont * 260;
      O.scene.fog.color.set(D?.tipo === 'destruccion' ? '#4a3a30' : cont > 0.3 ? '#7a7060' : '#b8c0c8');
      if (D?.tipo === 'colmena' && firmaRed !== s.vc) { firmaRed = s.vc; hacerRed(); }
    }
    // ventanas y faroles de noche (más luz en las eras eléctricas)
    matVent.emissiveIntensity = L.noche * (s.era >= 5 ? 1.8 : s.era >= 1 ? 1.1 : 0.5) + (hr > 17 && hr < 21 ? 0.25 : 0);
    matVent.color.set(s.era >= 6 ? '#8aa8c8' : '#7d8fa3');
    faroles.visible = s.era >= 4 && L.noche > 0.3 && !(D?.tipo === 'destruccion'); faroles.material.opacity = L.noche;
    // fogatas (eras tempranas) y ruinas que arden
    let nl = 0;
    const fog = s.era <= 1 ? s.celdas.filter((c) => c.fogata && !c.ru) : [];
    for (const c of fog) if (nl < 48) { const k = 1 + Math.sin(tt * 11 + c.k) * 0.15; _m.compose(_p.set(c.x, alt(c.x, c.z) + 0.6, c.z), _q.identity(), _s.set(k, k * (1 + L.noche * 0.3), k)); llamas.setMatrixAt(nl++, _m); }
    if (fog[0]) { luzF.position.set(fog[0].x, 2, fog[0].z); luzF.intensity = (6 + L.noche * 50) * (0.9 + Math.sin(tt * 17) * 0.1); } else luzF.intensity = 0;
    const arde = (D?.tipo === 'destruccion' && fase < 0.8) || s.guerra;
    if (arde) for (const [x, y, z] of ruinasFuego) if (nl < 48) { const k = 0.8 + Math.sin(tt * 9 + x) * 0.3; _m.compose(_p.set(x, y + 1, z), _q.identity(), _s.set(k * 1.6, k * 2.2, k * 1.6)); llamas.setMatrixAt(nl++, _m); }
    const ef = efectos.actualizar(s, dt);   // meteoritos, terremotos, incendios, inundaciones y rayos del espíritu
    for (const [x, y, z, k] of ef.fuego) if (nl < 96) { const kk = k * (0.85 + Math.sin(tt * 10 + x * 3) * 0.2); _m.compose(_p.set(x, y + 0.6 * kk, z), _q.identity(), _s.set(kk, kk * 1.8, kk)); llamas.setMatrixAt(nl++, _m); }
    llamas.count = nl; llamas.instanceMatrix.needsUpdate = true;
    // humo: fogatas, chimeneas de fábricas y centrales (eras 4-5), incendios
    const emis = [];
    for (const c of fog) emis.push([c.x, 1.2, c.z, 1]);
    if (!D) for (const c of s.celdas) if (!c.ru && ((c.u === 'taller' && c.e >= 4 && c.e <= 5) || (c.u === 'central' && c.e >= 4 && c.e <= 5))) emis.push([c.x + 0.9, alt(c.x, c.z) + 3.2, c.z - 0.7, c.u === 'central' ? 2 : 1]);
    if (arde) for (const r of ruinasFuego.slice(0, 10)) emis.push([r[0], r[1] + 2, r[2], 2]);
    for (const e of aereos.actualizar(s, dt, tt, D, L.noche)) emis.push(e);
    for (const e of ef.humo) emis.push(e);   // globos, aviones, drones, naves y estelas de cohetes
    matHumo.color.set(s.era >= 4 ? '#6a645c' : '#c8c4bc');
    const tot = emis.reduce((n, e) => n + e[3], 0); let nuevos = Math.min(6, Math.round(dt * 60));
    for (let i = 0; i < NH; i++) {
      if (humoVida[i] < 0) { if (!emis.length || nuevos <= 0) continue; nuevos--; let r = Math.random() * tot, e = emis[0]; for (const x of emis) { r -= x[3]; if (r <= 0) { e = x; break; } } humoVida[i] = 0; humoPos.set([e[0] + (Math.random() - 0.5) * 0.4, e[1], e[2] + (Math.random() - 0.5) * 0.4], i * 3); }
      else { humoVida[i] += dt; humoPos[i * 3 + 1] += dt * 1.6; humoPos[i * 3] += dt * 0.3 * Math.sin(i + tt * 0.3); if (humoVida[i] > 5) { humoVida[i] = -1; humoPos[i * 3 + 1] = -50; } }
    }
    humoGeo.attributes.position.needsUpdate = true;
    lluvia.visible = s.clima.lluvia > 0 && Math.floor((s.dia % 24) / 6) !== 3;
    if (lluvia.visible) { for (let i = 0; i < NL; i++) { let y = lluPos[i * 6 + 1] - dt * 30; if (y < 0) y += 40; lluPos[i * 6 + 1] = y; lluPos[i * 6 + 4] = y + 1.1; } lluGeo.attributes.position.needsUpdate = true; }
    moverAutos(dt, mult);
    multitud.actualizar(s, dt, hr, { nodos, aristas }, D, mult);
    efectosDestino(D, fase, tt, dt);
    gente(dt, hr, D, fase);
  }
  function efectosDestino(D, fase, tt, dt) {
    const mega = s.mega, puerto = s.celdas.find((c) => c.u === 'puerto' && !c.ru);
    // estelar: el ascensor crece con el megaproyecto; en el epílogo despegan las naves
    const est = (mega?.k === 'estelar' ? mega.prog : 0) || (D?.tipo === 'estelar' ? 1 : 0);
    ascensor.visible = est > 0.05 && !!puerto; estacion.visible = est > 0.4;
    if (puerto && ascensor.visible) { ascensor.position.set(puerto.x, alt(puerto.x, puerto.z), puerto.z); ascensor.scale.set(1, 10 + est * 70, 1); estacion.position.set(puerto.x, 10 + est * 70, puerto.z); estacion.rotation.z = tt * 0.1; }
    let nc = 0;
    if (D?.tipo === 'estelar' && puerto) for (let i = 0; i < 24; i++) { const k = ((tt * 0.12 + i / 24) % 1), y = alt(puerto.x, puerto.z) + k * k * 120; if (y > 115) continue; _m.compose(_p.set(puerto.x + Math.sin(i * 2.3) * (2 + k * 12), y, puerto.z + Math.cos(i * 2.3) * (2 + k * 12)), _q.identity(), _s.setScalar(1 + (i % 3) * 0.3)); cohetes.setMatrixAt(nc++, _m); }
    cohetes.count = nc; cohetes.instanceMatrix.needsUpdate = true;
    // trascendencia: el orbe brilla; la gente sube como luces
    const tras = D?.tipo === 'trascendencia' ? fase : mega?.k === 'trascendencia' ? mega.prog * 0.25 : 0;
    const gaia = D?.tipo === 'gaia' ? fase : 0, colm = D?.tipo === 'colmena' ? fase : mega?.k === 'colmena' ? mega.prog * 0.5 : 0, nuc = D?.tipo === 'destruccion' && D.causa === 'nuclear' ? fase : 0, ia = D?.tipo === 'destruccion' && D.causa === 'ia';
    matBrillo.opacity = tras * 0.22 + gaia * 0.12 + colm * 0.08 + (nuc > 0 && nuc < 0.08 ? (1 - nuc / 0.08) * 0.8 : 0) + (ia ? 0.1 : 0);
    matBrillo.color.set(tras ? '#ffe8a0' : gaia ? '#9cf09a' : colm ? '#6ae8ff' : ia ? '#ff3030' : '#ffffff');
    luces.visible = tras > 0;
    if (luces.visible) { for (let i = 0; i < NLZ; i++) { const a = i * 2.399, r = (i % 40) * 0.9 + 2, k = ((tt * 0.05 + i / NLZ) % 1); luzPos.set([Math.cos(a) * r, k * 60 * (0.3 + tras), Math.sin(a) * r], i * 3); } luzGeo.attributes.position.needsUpdate = true; luces.material.opacity = Math.min(1, tras * 2); }
    red.visible = colm > 0.05; if (red.visible) red.material.opacity = 0.15 + Math.sin(tt * 3) * 0.08 + colm * 0.2;
    hongo.visible = nuc > 0 && nuc < 0.85; if (hongo.visible) { const C = s.ciudades[0]; hongo.position.set(C.x, 0, C.z); hongo.scale.setScalar(0.4 + Math.min(1, nuc * 4) * 1.2); }
  }
  function gente(dt, hr, D, fase) {
    const C0 = O.controls.target, lejos = O.camera.position.distanceTo(C0) > 150, ix = [];
    for (const a of s.gente) ix.push([a, (vis.get(a.id)?.x ?? 0) - C0.x, (vis.get(a.id)?.z ?? 0) - C0.z]);
    ix.sort((x, y) => x[1] * x[1] + x[2] * x[2] - y[1] * y[1] - y[2] * y[2]);
    let nf = 0; gruposDet.length = 0; const vivos = new Set();
    const brillo = D?.tipo === 'trascendencia' ? fase : 0, colm = D?.tipo === 'colmena';
    ix.forEach(([a], i) => {
      vivos.add(a.id);
      const C = s.ciudades[a.al], L = lugar(a, colm ? 19 : hr, C);
      let v = vis.get(a.id); if (!v) { v = { x: L.p[0], z: L.p[1], rot: 0, p: null, k: '' }; vis.set(a.id, v); }
      const dx = L.p[0] - v.x, dz = L.p[1] - v.z, d = Math.hypot(dx, dz);
      if (d > 6) { v.x = L.p[0]; v.z = L.p[1]; } else { const k = 1 - Math.exp(-dt * 6); v.x += dx * k; v.z += dz * k; }
      if (d > 0.05) v.rot = angLerp(v.rot, Math.atan2(dx, dz), Math.min(1, dt * 8));
      const modo = L.dentro ? 'quieto' : d > 0.3 ? 'camina' : colm ? 'quieto' : L.modo;
      v.dentro = !!L.dentro && !brillo; v.modo = modo;
      const y = alt(v.x, v.z) + brillo * (hash(a.id) * 25);
      const esc = a.ap.alto * (a.edad < 15 ? 0.36 + 0.64 * Math.min(1, a.edad / 15) : 1) * (0.9 + Math.min(7, s.era) * 0.018);   // cada era come mejor: la gente es más alta
      const det = !lejos && i < NDET && !v.dentro;
      if (det) {
        const k = `${s.era}:${a.clase}:${a.edad >= 64 ? 'b' : a.edad >= 52 ? 'g' : 'n'}`;
        if (!v.p || v.k !== k) { if (v.p) M.remove(v.p.g); v.p = hacerPersona(a); v.k = k; M.add(v.p.g); }
        v.p.g.visible = true; v.p.g.position.set(v.x, y, v.z); v.p.g.rotation.y = v.rot; v.p.g.scale.setScalar(esc);
        animarPersona(v.p, modo, dt, 1.4); gruposDet.push(v.p.g);
      } else {
        if (v.p) v.p.g.visible = false;
        if (!v.dentro && nf < MAXP) { _m.compose(_p.set(v.x, y, v.z), _q.setFromAxisAngle(UP, v.rot), _s.setScalar(esc)); figuras.setMatrixAt(nf, _m); figuras.setColorAt(nf, _c.setHex(colm ? 0x6ae8ff : brillo ? 0xfff2c0 : ropaDe(s.era, a))); nf++; }
      }
    });
    figuras.count = nf; figuras.instanceMatrix.needsUpdate = true; figuras.instanceColor.needsUpdate = true;
    for (const [id, v] of vis) if (!vivos.has(id)) { if (v.p) M.remove(v.p.g); vis.delete(id); }
    const vs = sel != null && vis.get(sel);
    anillo.visible = !!vs && !vs.dentro; if (anillo.visible) { anillo.position.set(vs.x, alt(vs.x, vs.z) + 0.06, vs.z); anillo.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.08); }
  }
  // persona tocada: rayo sobre los cuerpos; si no, la más cercana al punto del suelo
  function personaEn(ev) {
    const id = O.tocar(ev, gruposDet); if (id != null) return id;
    const p = O.sueloEn(ev); if (!p) return null;
    let mejor = null, md = 2.4; for (const a of s.gente) { const v = vis.get(a.id); if (!v || v.dentro) continue; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < md) { md = d; mejor = a.id; } }
    return mejor;
  }
  function celdaEn(ev) { const p = O.sueloEn(ev); return p ? U.celdaEn(s, p.x, p.z) : null; }
  function posDe(id) { const v = vis.get(id); return v ? V(v.x, alt(v.x, v.z) + 1.2, v.z) : null; }
  relieve(); pintar(); ciudad(); bosque(); ponerFaroles();
  return { actualizar, personaEn, celdaEn, posDe, elegir(id) { sel = id; }, get elegido() { return sel; }, estaDentro: (id) => !!vis.get(id)?.dentro, reiniciar(s2) { s = s2; firmaC = ''; firmaA = ''; vh = -1; } };
}
