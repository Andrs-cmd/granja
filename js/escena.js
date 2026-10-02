// =====================================================================
// Escena 3D de la granja: orbe de vidrio con la casa, el huerto, el pozo,
// el tanque y los personajes. Solo DIBUJA el estado de la simulación.
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIN_DIA, CULTIVOS, LUGAR, TANQUE_MAX, PERSONAJES, caraAnimo } from './sim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = THREE.MathUtils.smoothstep;
const ease = (t) => t * t * (3 - 2 * t);
const rand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const angLerp = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
const yawTo = (dx, dz) => Math.atan2(-dz, dx);

export function crearEscena(host, { onParcela } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  // capa de etiquetas flotantes (datos) encima del lienzo
  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  labelRenderer.domElement.className = 'etiquetas';
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  const CENTER = V(2.5, 1.0, 6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 30; controls.maxDistance = 170; controls.maxPolarAngle = Math.PI * 0.46;
  controls.target.set(CENTER.x, 3, CENTER.z);
  camera.position.set(52, 40, 80);

  const root = new THREE.Group(); scene.add(root);

  // ------------------------------------------------------------ luces y paleta
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.castShadow = true; key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 100 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target); key.target.position.copy(CENTER);
  const KEYS = [
    { e: -1.0, top: '#050a1f', hor: '#16204a', hs: '#2c3f78', hg: '#141a28' },
    { e: -0.2, top: '#070d28', hor: '#1d2a55', hs: '#33477f', hg: '#161c2a' },
    { e: -0.04, top: '#1f2860', hor: '#8a5a86', hs: '#5a5a8e', hg: '#262230' },
    { e: 0.08, top: '#4a66a6', hor: '#ffab7a', hs: '#d7a58a', hg: '#4a3b2a' },
    { e: 0.3, top: '#4a8ad8', hor: '#cfe8f7', hs: '#cfe6ff', hg: '#5f6b45' },
    { e: 1.0, top: '#3f84d6', hor: '#d6ecf8', hs: '#d8ecff', hg: '#66744a' },
  ];
  KEYS.forEach((k) => { for (const f of ['top', 'hor', 'hs', 'hg']) k[f] = new THREE.Color(k[f]); });
  const pal = { top: new THREE.Color(), hor: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
  const RAIN_TOP = new THREE.Color('#5d6878'), RAIN_HOR = new THREE.Color('#9aa3ad');
  function palette(e, lluvia) {
    let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = THREE.MathUtils.clamp((e - a.e) / (b.e - a.e), 0, 1);
    for (const f in pal) pal[f].copy(a[f]).lerp(b[f], t);
    if (lluvia > 0) { pal.top.lerp(RAIN_TOP, lluvia * 0.6 * Math.max(0, e + 0.2)); pal.hor.lerp(RAIN_HOR, lluvia * 0.6 * Math.max(0, e + 0.2)); }
  }
  const SUN_LOW = new THREE.Color('#ffad73'), SUN_HIGH = new THREE.Color('#fff3e2'), MOON = new THREE.Color('#8ea6ff');

  function glowTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, inner); grd.addColorStop(0.35, outer); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ------------------------------------------------------------ bloque de tierra
  const BW = 24, BD = 33;
  {
    const layer = (h, inset, y, color, r) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(BW - inset, h, BD - inset, 3, r), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      m.position.set(CENTER.x, y, CENTER.z); m.receiveShadow = true; m.castShadow = true; root.add(m); return m;
    };
    layer(0.8, 0, -0.4, 0x6f9a44, 0.28);
    layer(3.3, 0.35, -2.35, 0x7a4b2b, 0.22);
    layer(1.6, 0.8, -4.55, 0x5d5751, 0.3);
    const geos = [];
    for (let i = 0; i < 60; i++) {
      const side = Math.floor(rand() * 4), g = new THREE.IcosahedronGeometry(0.18 + rand() * 0.22, 0);
      const y = -1.2 - rand() * 3.2, u = (rand() - 0.5) * 0.9;
      if (side === 0) g.translate(CENTER.x + u * BW, y, CENTER.z + (BD - 0.35) / 2);
      if (side === 1) g.translate(CENTER.x + u * BW, y, CENTER.z - (BD - 0.35) / 2);
      if (side === 2) g.translate(CENTER.x + (BW - 0.35) / 2, y, CENTER.z + u * BD);
      if (side === 3) g.translate(CENTER.x - (BW - 0.35) / 2, y, CENTER.z + u * BD);
      geos.push(g);
    }
    root.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x8b847c, roughness: 1, flatShading: true })));
  }

  // ------------------------------------------------------------ orbe de vidrio, cielo interior y pedestal
  const ORB_C = V(CENTER.x, 5.5, CENTER.z), ORB_R = 24.5, PED_TOP = -5.6;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
    vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uTop, uHor; varying float vY; void main(){ gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-2., 26., vY)), .97); }`,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(ORB_R - 0.05, 64, 40), skyMat); m.position.copy(ORB_C); m.renderOrder = -1; root.add(m); }
  {
    const glassMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW; varying vec3 vN;
        void main(){ vec3 v = normalize(cameraPosition - vW); float fres = pow(1. - max(dot(vN, v), 0.), 3.);
          vec3 r = reflect(-v, vN); float h1 = smoothstep(.93, .975, dot(r, normalize(vec3(-.55,.75,.35)))); float h2 = smoothstep(.985, .995, dot(r, normalize(vec3(.7,.25,.45)))) * .7;
          gl_FragColor = vec4(mix(vec3(.82,.93,1.), vec3(1.), h1 + h2), .015 + fres * .5 + h1 * .35 + h2 * .3); }`,
    });
    const g = new THREE.Mesh(new THREE.SphereGeometry(ORB_R, 64, 40), glassMat); g.position.copy(ORB_C); g.renderOrder = 10; root.add(g);
    const rTop = Math.sqrt(ORB_R * ORB_R - (ORB_C.y - PED_TOP) ** 2) + 0.6;
    const wood2 = new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: 0.55 }), gold = new THREE.MeshStandardMaterial({ color: 0xc9a35a, roughness: 0.3, metalness: 0.9 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop + 2.4, 5, 96), wood2); ped.position.set(ORB_C.x, PED_TOP - 2.5, ORB_C.z); root.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.05, 0.28, 12, 120), gold); ring.rotation.x = Math.PI / 2; ring.position.set(ORB_C.x, PED_TOP, ORB_C.z); root.add(ring);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(rTop + 2.6, rTop + 2.9, 1.2, 96), wood2); foot.position.set(ORB_C.x, PED_TOP - 5.6, ORB_C.z); root.add(foot);
  }

  // sol, luna y estrellas
  const ORBIT_C = V(2.5, 12.5, 2), ORBIT_R = 10, ORBIT_H = 9;
  const sun = new THREE.Group();
  {
    sun.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 2), new THREE.MeshBasicMaterial({ color: 0xffcf3f })));
    const rays = new THREE.Group(); sun.add(rays); sun.userData.rays = rays;
    const rm = new THREE.MeshBasicMaterial({ color: 0xffb52e });
    for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 4), rm), a = i / 12 * Math.PI * 2; r.position.set(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0); r.rotation.z = a - Math.PI / 2; rays.add(r); }
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,140,.9)', 'rgba(255,170,60,.35)'), blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(9); sun.add(h);
  }
  root.add(sun);
  const moon = new THREE.Group();
  {
    moon.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), new THREE.MeshStandardMaterial({ color: 0xe9e6da, emissive: 0xb8c4e0, emissiveIntensity: 0.55, roughness: 1, flatShading: true })));
    const cm = new THREE.MeshStandardMaterial({ color: 0xbdb8aa, emissive: 0x8a93aa, emissiveIntensity: 0.35, flatShading: true });
    [[0.5, 0.4, 0.85, 0.28], [-0.45, -0.2, 0.95, 0.22], [0.1, -0.6, 0.85, 0.18]].forEach(([x, y, z, r]) => { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cm); c.position.set(x, y, z).setLength(1.08); moon.add(c); });
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(200,215,255,.6)', 'rgba(120,140,220,.18)'), blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(7); moon.add(h);
  }
  root.add(moon);
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
  {
    const p = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) { const v = V(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize().multiplyScalar(14 + rand() * 8.5); p.set([ORB_C.x + v.x, ORB_C.y + 4 + v.y, ORB_C.z + v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); root.add(new THREE.Points(g, starMat));
  }

  // lluvia
  const RAIN = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN * 6), rainV = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) {
    const x = CENTER.x + (rand() - 0.5) * (BW - 1), z = CENTER.z + (rand() - 0.5) * (BD - 1), y = rand() * 24;
    rainPos.set([x, y, z, x, y - 0.6, z], i * 6); rainV[i] = 18 + rand() * 8;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat); root.add(rain);

  // ------------------------------------------------------------ casa
  const windows = [];
  const interior = [[1.0, 2.6, 1.5], [-1.0, 6.2, 0]].map(([x, y, z]) => { const pl = new THREE.PointLight(0xffb36b, 0, 11, 2); pl.position.set(x, y, z); root.add(pl); return pl; });
  const porch = new THREE.PointLight(0xffbf7a, 0, 9, 2); porch.position.set(-1.8, 3.1, 6.6); root.add(porch);
  const RAIL_K = 1.2 / 1.95, RAIL_TOP = 4.26 + 1.95 * RAIL_K;
  {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.4, metalness: 0.6 });
    [[8.665, 5.765, 6.05, 0.3], [11.54, 0, 0.3, 11.95], [8.665, -5.81, 6.05, 0.3]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), metal); m.position.set(x, RAIL_TOP + 0.035, z); root.add(m); });
  }
  let cargada = false;
  new GLTFLoader().load('modelo/casa.glb', (gltf) => {
    const house = gltf.scene, rail = [];
    house.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const name = o.material.name;
      if (name === 'Vidrio') {
        o.material = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45, emissive: 0xffb45e, emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false });
        o.castShadow = false; windows.push({ mat: o.material, on: -0.02 - rand() * 0.12 });
      } else if (name === 'Puerta' || name === 'Marco') { o.material.side = THREE.DoubleSide; if (name === 'Marco') o.material.color.set(0x2b2d31); }
      else if (o.name === 'baranda_terraza') {
        o.updateWorldMatrix(true, false); o.geometry.applyMatrix4(o.matrixWorld);
        o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, 4.26 + (pos.getY(i) - 4.26) * RAIL_K);
        pos.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere();
        o.material = new THREE.MeshStandardMaterial({ color: 0xcfe8ef, roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
        o.castShadow = false; rail.push(o);
      } else if (name === 'Pared') o.material.color.set(0xf1e8d6);
      else if (name === 'Columna') o.material.color.set(0xf6f2ea);
      else if (name === 'Techo') { o.material.color.set(0x3b3e45); o.material.roughness = 0.7; }
      else if (name === 'Losa') o.material.color.set(0xe2ddd2);
    });
    rail.forEach((o) => root.add(o));
    root.add(house); cargada = true;
  });

  // ------------------------------------------------------------ granja: huerto, pozo, tanque, comedero, caseta, banca
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2b, roughness: 0.8, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.45, metalness: 0.6 });
  const box = (w, h, d, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // camino de piedras
  {
    const geos = [];
    const pathX = (z) => -2.6 + Math.sin(z * 0.22) * 0.5;
    for (let z = 7.6; z < 15.0; z += 0.95) { const g = new THREE.CylinderGeometry(0.42 + rand() * 0.08, 0.46, 0.08, 7); g.rotateY(rand() * 3); g.translate(pathX(z), 0.03, z); geos.push(g); }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xbdb7aa, roughness: 0.95, flatShading: true })); m.receiveShadow = true; root.add(m);
  }

  // huerto: 6 parcelas con cerca baja
  const parcelas = [];
  const soilDry = new THREE.Color(0x9a7650), soilWet = new THREE.Color(0x4a3220);
  {
    const fence = new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.9, flatShading: true });
    const fx0 = -3.8, fx1 = 9.8, fz0 = 15.2, fz1 = 21.0;
    for (let x = fx0; x <= fx1 + 0.01; x += 1.36) for (const z of [fz0, fz1]) if (!(z === fz0 && x > -3.5 && x < -1.5)) box(0.1, 0.7, 0.1, fence, x, 0.35, z);
    for (let z = fz0; z <= fz1 + 0.01; z += 1.45) for (const x of [fx0, fx1]) box(0.1, 0.7, 0.1, fence, x, 0.35, z);
    box(fx1 - fx0, 0.07, 0.06, fence, (fx0 + fx1) / 2, 0.55, fz1);
    box(fx1 + 1.5 - 0.0, 0.07, 0.06, fence, (fx1 - 1.5) / 2 + 2.1, 0.55, fz0);
    for (const x of [fx0, fx1]) box(0.06, 0.07, fz1 - fz0, fence, x, 0.55, (fz0 + fz1) / 2);
  }
  const PLOT_W = 3.6, PLOT_D = 2.2;
  function crearParcela(i, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const soilMat = new THREE.MeshStandardMaterial({ color: soilDry.clone(), roughness: 1 });
    const soil = new THREE.Mesh(new RoundedBoxGeometry(PLOT_W, 0.22, PLOT_D, 2, 0.05), soilMat);
    soil.position.y = 0.06; soil.receiveShadow = true; soil.userData.parcela = i; g.add(soil);
    // surcos
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(PLOT_W - 0.3, 0.06, 0.12), soilMat); f.position.set(0, 0.18, -0.6 + k * 0.6); g.add(f); }
    const sel = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false }));
    sel.rotation.set(-Math.PI / 2, 0, Math.PI / 4); sel.scale.set(PLOT_W * 0.78, PLOT_D * 0.78, 1); sel.position.y = 0.2; g.add(sel);
    const plants = new THREE.Group(); g.add(plants);
    parcelas.push({ g, soil, soilMat, plants, sel, key: '' });
  }
  // (las posiciones vienen del estado en la primera actualización)

  // plantas por cultivo
  const LEAF = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true });
  const MAT = { lechuga: LEAF(0x8fd16a), papa: LEAF(0x4f8a34), frijol: LEAF(0x5c9a3a), maiz: LEAF(0x6fa848), seco: LEAF(0x8a6a3a), muerto: LEAF(0x5b4630),
    tallo: LEAF(0x9a7a4a), flor: LEAF(0xf4f0d8), vaina: LEAF(0x9cc75a), mazorca: LEAF(0xf2c94c) };
  function planta(cultivo) {
    const p = new THREE.Group();
    if (cultivo === 'lechuga') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), MAT.lechuga); m.scale.set(1, 0.7, 1); m.position.y = 0.2; p.add(m); p.userData.hojas = [m]; }
    if (cultivo === 'papa') {
      p.userData.hojas = [];
      for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), MAT.papa); m.position.set((k - 1) * 0.16, 0.3 + (k % 2) * 0.12, (k % 2 - 0.5) * 0.15); p.add(m); p.userData.hojas.push(m); }
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), MAT.flor); f.position.y = 0.55; p.add(f); p.userData.fruto = f;
    }
    if (cultivo === 'frijol') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 5), MAT.tallo); st.position.y = 0.75; p.add(st);
      p.userData.hojas = [];
      for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), MAT.frijol); m.position.set(Math.cos(k * 2) * 0.12, 0.35 + k * 0.3, Math.sin(k * 2) * 0.12); p.add(m); p.userData.hojas.push(m); }
      const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 2, 5), MAT.vaina); v.position.set(0.14, 0.8, 0); p.add(v); p.userData.fruto = v;
    }
    if (cultivo === 'maiz') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 5), MAT.maiz); st.position.y = 1.1; p.add(st);
      p.userData.hojas = [st];
      for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.9, 3), MAT.maiz); l.position.set(0, 0.6 + k * 0.45, 0); l.rotation.z = (k % 2 ? 1 : -1) * 0.9; p.add(l); p.userData.hojas.push(l); }
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 2, 6), MAT.mazorca); c.position.set(0.1, 1.2, 0); c.rotation.z = -0.4; p.add(c); p.userData.fruto = c;
    }
    p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return p;
  }

  // pozo
  {
    const g = new THREE.Group(); g.position.set(LUGAR.pozo.x, 0, LUGAR.pozo.z); root.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: 0x9c968c, roughness: 1, flatShading: true });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.0, 14, 1, true), stone); ring.position.y = 0.5; ring.material.side = THREE.DoubleSide; ring.castShadow = true; g.add(ring);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.12, 6, 14), stone); lip.rotation.x = Math.PI / 2; lip.position.y = 1.0; g.add(lip);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.9, 14), new THREE.MeshStandardMaterial({ color: 0x1d4f6b, roughness: 0.2 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; g.add(water);
    for (const sx of [-1, 1]) box(0.12, 2.0, 0.12, woodMat, sx * 0.95, 1.0, 0, g);
    box(2.2, 0.08, 0.08, woodMat, 0, 1.75, 0, g);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x8a3f2a, roughness: 0.8, flatShading: true })); roof.position.y = 2.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8), darkMat); bucket.position.set(0, 1.3, 0); g.add(bucket); g.userData.bucket = bucket;
    var pozoGrupo = g;
  }

  // tanque de lluvia con nivel visible
  const tankLevel = (() => {
    const g = new THREE.Group(); g.position.set(LUGAR.tanque.x, 0, LUGAR.tanque.z); root.add(g);
    const H = 2.6, R = 1.0;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.15, R + 0.15, 0.25, 20), darkMat); base.position.y = 0.12; g.add(base);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe0f0, roughness: 0.15, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    shell.position.y = 0.25 + H / 2; g.add(shell);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.12, 24), darkMat); lid.position.y = 0.25 + H + 0.06; lid.castShadow = true; g.add(lid);
    for (const y of [0.9, 1.9]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.04, 6, 24), darkMat); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; g.add(hoop); }
    const water = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.06, 1, 24), new THREE.MeshStandardMaterial({ color: 0x3f9fc8, roughness: 0.2, transparent: true, opacity: 0.85 }));
    g.add(water);
    // canaleta desde el techo
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.6, 8), darkMat); pipe.position.set(-1.05, 3.1, -1.6); pipe.rotation.x = 0.35; g.add(pipe);
    return (k) => { const h = Math.max(0.02, k * (H - 0.1)); water.scale.y = h; water.position.y = 0.3 + h / 2; };
  })();

  // comedero y bebedero
  const comida = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xc58b45, flatShading: true }));
  const aguaBowl = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), new THREE.MeshStandardMaterial({ color: 0x4aa3d0, roughness: 0.2 }));
  {
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xc94f4f, roughness: 0.5 });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.18, 14, 1, true), bowlMat); b1.material.side = THREE.DoubleSide; b1.position.set(LUGAR.comedero.x, 0.09, LUGAR.comedero.z); root.add(b1);
    const b2 = b1.clone(); b2.material = new THREE.MeshStandardMaterial({ color: 0x3f6fb6, side: THREE.DoubleSide }); b2.position.x -= 0.9; root.add(b2);
    comida.position.set(LUGAR.comedero.x, 0.12, LUGAR.comedero.z); comida.scale.set(1.2, 0.5, 1.2); root.add(comida);
    aguaBowl.rotation.x = -Math.PI / 2; aguaBowl.position.set(LUGAR.comedero.x - 0.9, 0.14, LUGAR.comedero.z); root.add(aguaBowl);
  }
  // caseta del perro
  {
    const g = new THREE.Group(); g.position.set(LUGAR.caseta.x, 0, LUGAR.caseta.z); g.rotation.y = -Math.PI / 2; root.add(g);
    const wall = new THREE.MeshStandardMaterial({ color: 0xb5643a, roughness: 0.85, flatShading: true });
    box(1.8, 1.2, 1.6, wall, 0, 0.6, 0, g);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.35, 0.8, 4, 1), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, flatShading: true })); roof.rotation.y = Math.PI / 4; roof.position.y = 1.6; roof.scale.set(1, 1, 0.95); roof.castShadow = true; g.add(roof);
    box(0.7, 0.75, 0.05, new THREE.MeshStandardMaterial({ color: 0x1b1410 }), 0, 0.4, 0.81, g);
  }
  // banca (mira al huerto)
  {
    const b = new THREE.Group(); b.position.set(LUGAR.banca.x, 0, LUGAR.banca.z); root.add(b);
    box(3.4, 0.12, 0.85, woodMat, 0, 0.78, 0, b); box(3.4, 0.6, 0.1, woodMat, 0, 1.25, -0.4, b);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.12, 0.78, 0.12, woodMat, sx * 1.5, 0.39, sz * 0.34, b);
  }
  // árboles y arbustos
  const trees = [];
  const LEAFS = [0x5f8f34, 0x7faa3f, 0x9cc04f, 0x4d7a2b, 0x8bb848].map((c) => LEAF(c));
  const bark = new THREE.MeshStandardMaterial({ color: 0x6b5644, roughness: 1, flatShading: true });
  function makeTree(x, z, s) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); root.add(t);
    const tr = new THREE.CylinderGeometry(0.12, 0.22, 4.2, 6); tr.translate(0, 2.1, 0); const tm = new THREE.Mesh(tr, bark); tm.castShadow = true; t.add(tm);
    const crown = new THREE.Group(); crown.position.y = 4.4; t.add(crown);
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 2.3, y = (rand() - 0.35) * 2.2;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.55, 0), LEAFS[Math.floor(rand() * LEAFS.length)]);
      m.position.set(Math.cos(a) * r, y + (2.3 - r) * 0.35, Math.sin(a) * r * 0.85); m.castShadow = true; crown.add(m);
    }
    trees.push({ crown, phase: rand() * 6.28 });
  }
  makeTree(-7.4, -6.8, 1.15); makeTree(12.7, -8.2, 1.25); makeTree(12.6, 14.5, 0.85);
  for (const [x, z, s] of [[-7.6, 7.2, 0.9], [-7.0, -1.5, 1.0], [12.9, 2.5, 0.9], [-1.0, -7.2, 0.9], [4.5, -7.4, 1.0], [12.4, 20.8, 1.0], [-7.4, 20.5, 0.9]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 1), LEAFS[Math.floor(rand() * LEAFS.length)]); m.position.set((rand() - 0.5) * 1.1, 0.45 + rand() * 0.35, (rand() - 0.5) * 1.1); m.scale.y = 0.85; m.castShadow = true; g.add(m); }
  }
  // tronco para tallar madera (con virutas) y mirador de piedras
  {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9, flatShading: true }));
    tronco.position.set(LUGAR.taller.x, 0.25, LUGAR.taller.z + 0.9); tronco.castShadow = true; root.add(tronco);
    const anillo = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), new THREE.MeshStandardMaterial({ color: 0xc9a46c })); anillo.rotation.x = -Math.PI / 2; anillo.position.set(LUGAR.taller.x, 0.51, LUGAR.taller.z + 0.9); root.add(anillo);
    const virutas = [];
    for (let i = 0; i < 14; i++) { const g = new THREE.BoxGeometry(0.12, 0.02, 0.05); g.rotateY(rand() * 3); g.translate(LUGAR.taller.x + (rand() - 0.5) * 1.4, 0.03, LUGAR.taller.z + 0.9 + (rand() - 0.5) * 1.4); virutas.push(g); }
    root.add(new THREE.Mesh(mergeGeometries(virutas), new THREE.MeshStandardMaterial({ color: 0xe0c08a })));
    const piedra = new THREE.MeshStandardMaterial({ color: 0xa8a29a, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + rand() * 0.15, 0), piedra); const ang = i / 7 * Math.PI * 2; m.position.set(LUGAR.mirador.x + Math.cos(ang) * 1.3, 0.12, LUGAR.mirador.z + Math.sin(ang) * 1.3); m.castShadow = true; root.add(m); }
  }
  // postes de luz
  const lamps = [];
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,150,.85)', 'rgba(255,170,80,.25)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
  for (const [x, z, rot] of [[-5.4, 13.8, 0.4], [11.4, 11.2, Math.PI - 0.4]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 10), darkMat); pole.position.y = 2.3; pole.castShadow = true; g.add(pole);
    box(1.1, 0.08, 0.08, darkMat, 0.5, 4.6, 0, g);
    const lm = new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffc677, emissiveIntensity: 0 });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), lm); l.position.set(1.0, 4.3, 0); g.add(l);
    const s = new THREE.Sprite(haloMat); s.position.set(1.0, 4.3, 0); s.scale.setScalar(3.2); g.add(s);
    const pl = new THREE.PointLight(0xffc27a, 0, 22, 1.6); pl.position.set(1.0, 4.0, 0); g.add(pl);
    lamps.push({ pl, lm });
  }

  // ------------------------------------------------------------ personajes
  function makePerson({ top, bottom, skin, hair, dress, longHair, h, detalles = [] }) {
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true });
    const mTop = mat(top), mBottom = mat(bottom), mSkin = mat(skin), mHair = mat(hair), mShoe = mat(0x2a2422);
    const g = new THREE.Group(), add = (m, p) => { m.castShadow = true; p.add(m); return m; };
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0, 1.0, s * 0.12); g.add(hip);
      const th = new THREE.CylinderGeometry(0.095, 0.08, 0.5, 8); th.translate(0, -0.25, 0); add(new THREE.Mesh(th, dress ? mSkin : mBottom), hip);
      const knee = new THREE.Group(); knee.position.y = -0.5; hip.add(knee);
      const sh = new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8); sh.translate(0, -0.25, 0); add(new THREE.Mesh(sh, dress ? mSkin : mBottom), knee);
      const shoe = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.14), mShoe), knee); shoe.position.set(0.06, -0.48, 0);
      legs.push({ hip, knee });
    }
    const upper = new THREE.Group(); upper.position.y = 1.0; g.add(upper);
    if (dress) { const sk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.78, 12), mTop), upper); sk.position.y = -0.1; }
    const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.4, 4, 10), mTop), upper); torso.position.y = 0.5; torso.scale.set(0.78, 1, 1);
    const head = new THREE.Group(); head.position.y = 1.0; upper.add(head);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 2), mSkin), head);
    const hr = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.205, 2), mHair), head); hr.position.set(-0.035, 0.05, 0); hr.scale.set(1, 0.92, 1.03);
    if (longHair) { const lh = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 4, 8), mHair), head); lh.position.set(-0.1, -0.2, 0); lh.scale.set(0.7, 1, 1.1); }
    // detalles distintivos de la ficha
    if (detalles.includes('sombrero')) {
      const straw = mat(0xd8b56a);
      const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 16), straw), head); brim.position.y = 0.13;
      const crown = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.17, 12), straw), head); crown.position.y = 0.22;
      const band = add(new THREE.Mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.04, 12), mat(0x6b3a22)), head); band.position.y = 0.165;
    }
    if (detalles.includes('barba')) { const b = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), mHair), head); b.position.set(0.06, -0.1, 0); b.scale.set(0.9, 0.7, 1.05); }
    if (detalles.includes('pecas')) {
      const pm = mat(0xb5704a);
      for (const [y, z] of [[0.0, 0.07], [0.02, 0.1], [-0.02, 0.09], [0.0, -0.07], [0.02, -0.1], [-0.02, -0.09]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), pm); d.position.set(0.18, y, z); head.add(d); }
    }
    if (detalles.includes('diadema')) { const d = add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 6, 20, Math.PI), mat(0xf2c94c)), head); d.position.set(0.0, 0.06, 0); d.rotation.set(0, Math.PI / 2, 0); }
    if (detalles.includes('pañuelo')) { const k = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 3), mat(0xc0392b)), head); k.position.set(-0.05, -0.2, 0); k.rotation.z = Math.PI; }
    const arms = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(0, 0.78, s * 0.3); upper.add(p);
      const ag = new THREE.CylinderGeometry(0.07, 0.06, 0.68, 8); ag.translate(0, -0.34, 0); add(new THREE.Mesh(ag, mTop), p);
      const hand = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), mSkin), p); hand.position.y = -0.72;
      arms.push(p);
    }
    const libro = add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.34), mat(0x8a2f2f)), upper); libro.position.set(0.42, 0.42, 0); libro.rotation.z = 0.9; libro.visible = false;
    const pieza = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.24, 6), mat(0xc79a5a)), upper); pieza.position.set(0.44, 0.3, 0); pieza.rotation.x = Math.PI / 2; pieza.visible = false;
    g.scale.setScalar(h); root.add(g);
    return { g, legs, arms, upper, head, h, kind: 'humano', libro, pieza };
  }
  function makeDog() {
    const fur = LEAF(0xf5f2ec), white = LEAF(0xffffff), dark = LEAF(0x2a2220), earM = LEAF(0xebe3d6);
    const g = new THREE.Group(); root.add(g);
    const torso = new THREE.Group(); torso.position.set(-0.28, 0.5, 0); g.add(torso);
    const sp = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, p = torso) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; p.add(o); return o; };
    sp(0.24, fur, 0.3, 0.06, 0, 1.75, 0.95, 0.95); sp(0.17, white, 0.5, -0.02, 0, 1.2, 0.8, 0.8);
    const head = new THREE.Group(); head.position.set(0.72, 0.32, 0); torso.add(head);
    sp(0.17, fur, 0, 0, 0, 1.05, 1, 1, head); sp(0.1, white, 0.17, -0.06, 0, 1.4, 0.8, 0.9, head); sp(0.04, dark, 0.3, -0.03, 0, 1, 0.8, 1, head);
    for (const s of [-1, 1]) { const e = sp(0.09, earM, -0.02, 0.0, s * 0.14, 0.6, 1.4, 0.35, head); e.position.y = 0.02; const ey = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), dark); ey.position.set(0.13, 0.06, s * 0.07); head.add(ey); }
    const legs = [], lg = new THREE.CylinderGeometry(0.06, 0.05, 0.5, 6); lg.translate(0, -0.25, 0);
    for (const [x, front] of [[0.6, 1], [0.02, 0]]) for (const s of [-1, 1]) {
      const piv = new THREE.Group(); const l = new THREE.Mesh(lg, front ? white : fur); l.castShadow = true; piv.add(l);
      if (front) { piv.position.set(x, -0.02, s * 0.12); torso.add(piv); } else { piv.position.set(-0.28 + x, 0.5, s * 0.12); g.add(piv); }
      legs.push({ piv, front, side: s });
    }
    const tail = new THREE.Group(); tail.position.set(-0.08, 0.15, 0); torso.add(tail);
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 6), fur); m.position.y = 0.21; tail.add(m); }
    if ((PERSONAJES.find((p) => p.tipo === 'perro')?.fisico?.detalles || []).includes('collar')) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 16), LEAF(0xc0392b)); c.position.set(0.6, 0.22, 0); c.rotation.y = Math.PI / 2; torso.add(c); }
    g.scale.setScalar(2.2);
    return { g, torso, head, legs, tail, kind: 'perro' };
  }
  function makeCat() {
    const fur = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.7, flatShading: true }), white = LEAF(0xf3f0ea);
    const g = new THREE.Group(); root.add(g);
    const torso = new THREE.Group(); torso.position.set(-0.2, 0.36, 0); g.add(torso);
    const sp = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, p = torso) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; p.add(o); return o; };
    sp(0.2, fur, 0.2, 0.06, 0, 1.65, 0.85, 0.85); sp(0.15, fur, 0.44, 0.13, 0, 1, 1, 0.95); sp(0.11, white, 0.5, 0.06, 0, 1, 1.15, 0.85);
    const head = new THREE.Group(); head.position.set(0.6, 0.3, 0); torso.add(head);
    sp(0.15, fur, 0, 0, 0, 1.05, 0.92, 1.08, head); sp(0.075, white, 0.12, -0.045, 0, 1, 0.75, 1.1, head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 4), fur); ear.position.set(0, 0.15, s * 0.075); head.add(ear); }
    const legs = [], lg = new THREE.CylinderGeometry(0.042, 0.034, 0.36, 6); lg.translate(0, -0.18, 0);
    for (const [x, front] of [[0.44, 1], [0.0, 0]]) for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.add(new THREE.Mesh(lg, fur)); const paw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.048, 1), white); paw.position.y = -0.34; piv.add(paw);
      if (front) { piv.position.set(x, 0, s * 0.085); torso.add(piv); } else { piv.position.set(-0.2 + x, 0.36, s * 0.085); g.add(piv); }
      legs.push({ piv, front, side: s });
    }
    const tail = new THREE.Group(); tail.position.set(-0.12, 0.1, 0); torso.add(tail);
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 5), fur); m.position.set(-0.3, 0.1, 0); m.rotation.z = Math.PI / 2 + 0.6; tail.add(m); }
    g.scale.setScalar(1.8);
    return { g, torso, head, legs, tail, kind: 'gato' };
  }

  // lápidas
  const tombMat = new THREE.MeshStandardMaterial({ color: 0x9d9a94, roughness: 0.9 });
  const TOMBS = { tomas: [-7.9, 16.0], lucia: [-7.9, 17.6], nube: [-6.6, 16.6], esmoquin: [-6.6, 18.1] };

  const LOOK = {
    tomas: { top: 0x3d6fb6, bottom: 0x2b2d3a, skin: 0xe0b08a, hair: 0x3b2a1e, h: 1.5 },
    lucia: { top: 0xd64b6b, bottom: 0xd64b6b, skin: 0xf1c3a0, hair: 0x5a2e1a, dress: true, longHair: true, h: 1.41 },
  };
  const vis = {};
  for (const p of PERSONAJES) {
    if (p.tipo === 'humano') vis[p.id] = makePerson({ ...(LOOK[p.id] || { top: 0x6a8f4e, bottom: 0x3a3a40, skin: 0xe0b08a, hair: 0x2b2018, h: 1.45 }), detalles: p.fisico?.detalles || [] });
    else if (p.tipo === 'perro') vis[p.id] = makeDog();
    else vis[p.id] = makeCat();
    vis[p.id].ficha = p;
  }
  for (const id in vis) {
    const v = vis[id];
    Object.assign(v, { last: V(0, 0, 0), yaw: 0, moving: 0, ready: false });
    const [tx, tz] = TOMBS[id] || [-6.6 + Object.keys(TOMBS).length * 0.1, 19.4];
    const tomb = new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.0, 0.25, 2, 0.12), tombMat); tomb.position.set(tx, 0.5, tz); tomb.visible = false; tomb.castShadow = true; root.add(tomb);
    v.tomb = tomb;
  }

  function poseAgente(a, v, s, t, dt) {
    if (!a.vivo) {
      const dias = (s.t - a.murio) / MIN_DIA;
      v.tomb.visible = dias > 0.5;
      v.g.visible = dias <= 0.5;
      if (v.g.visible) { v.g.position.set(a.pos.x, 0.25, a.pos.z); v.g.rotation.set(0, v.yaw, v.kind === 'humano' ? -Math.PI / 2 : 0); v.g.rotation.x = v.kind === 'humano' ? 0 : Math.PI / 2; }
      return;
    }
    v.tomb.visible = false;
    const T = a.tarea, trabajando = T && T.fase === 'trabajo';
    const hidden = a.dentro;
    v.g.visible = !hidden;
    // movimiento real entre cuadros → camina
    if (!v.ready || !v.vp) { v.vp = V(a.pos.x, 0, a.pos.z); v.ready = true; v.walkPh = 0; }
    const tx = a.pos.x - v.vp.x, tz = a.pos.z - v.vp.z, lejos = Math.hypot(tx, tz);
    if (hidden || lejos > 9) v.vp.set(a.pos.x, 0, a.pos.z);                 // entrar/salir de casa o saltos grandes: sin arrastrarse
    else { const k = 1 - Math.exp(-dt * 9); v.vp.x += tx * k; v.vp.z += tz * k; }
    const dx = v.vp.x - v.last.x, dz = v.vp.z - v.last.z, d = Math.hypot(dx, dz);
    const rapidez = dt > 0 ? d / dt : 0;                                     // unidades por segundo en pantalla
    const moving = rapidez > 0.25 && d < 3;
    v.moving += ((moving ? 1 : 0) - v.moving) * Math.min(1, dt * 8);
    v.walkPh += Math.min(rapidez, 8) * dt * (v.kind === 'humano' ? 2.6 : 3.4);   // el paso sigue a la velocidad real
    if (moving) v.yaw = angLerp(v.yaw, yawTo(dx, dz), Math.min(1, dt * 8));
    // hacia dónde mira según lo que hace
    const otroH = s.agentes.find((x) => x !== a && x.tipo === 'humano' && x.vivo && !x.dentro);
    const abrazando = a.abrazo && s.t - a.abrazo < 4 && otroH && !moving;
    if ((trabajando || abrazando) && !moving) {
      let f = null;
      const tp = T?.tipo;
      if (abrazando || tp === 'conversar') f = otroH ? otroH.pos : null;
      else if (T.parcela != null) f = s.parcelas[T.parcela];
      else if (tp === 'sacarAgua') f = LUGAR.pozo;
      else if (tp === 'jugarGato') f = s.agentes.find((x) => x.tipo === 'gato')?.pos;
      else if (tp === 'alimentar' || ((tp === 'comer' || tp === 'beber') && v.kind !== 'humano')) f = LUGAR.comedero;
      else if (['descansar', 'leer', 'siesta', 'tallar'].includes(tp)) v.yaw = angLerp(v.yaw, -Math.PI / 2, Math.min(1, dt * 5));
      else if (tp === 'contemplar') v.yaw = angLerp(v.yaw, -Math.PI / 4, Math.min(1, dt * 4));
      else if (v.kind !== 'humano' && tp === 'jugar') { const hh = s.agentes.find((x) => x.id === T.con); if (hh) f = hh.pos; }
      if (f) v.yaw = angLerp(v.yaw, yawTo(f.x - a.pos.x, f.z - a.pos.z), Math.min(1, dt * 6));
    }
    v.last.copy(v.vp);
    v.g.position.set(v.vp.x, 0, v.vp.z);
    v.g.rotation.set(0, v.yaw, 0);
    const w = v.moving, ph = v.walkPh;
    if (v.kind === 'humano') {
      const tipo = trabajando ? T.tipo : null;
      const sit = ['descansar', 'leer', 'siesta', 'tallar'].includes(tipo) ? 1 : 0;
      const asiento = tipo === 'tallar' ? 0.5 : 0.85;
      const agachado = tipo === 'jugarGato';
      const bend = ['regar', 'sembrar', 'cosechar', 'limpiar', 'sacarAgua', 'alimentar', 'jugarGato'].includes(tipo) ? 1 : 0;
      v.g.position.y = -sit * (v.h - asiento) + Math.abs(Math.sin(ph)) * 0.04 * w;
      // forma de andar de su ficha: zancada (pasos largos, hombros) o cadera (paso fluido, balanceo de cadera)
      const zancada = v.ficha.fisico?.andar !== 'cadera';
      const amp = (zancada ? 0.6 : 0.45) * (a.enfermo > 0 ? 0.6 : 1);
      const viejo = Math.max(0, Math.min(1, (a.edad - 55) / 20));
      v.legs.forEach((l, j) => {
        const sw = Math.sin(ph + j * Math.PI) * w;
        l.hip.rotation.z = sw * amp + sit * Math.PI / 2 + bend * (agachado ? 0.9 : 0.25);
        l.knee.rotation.z = -Math.max(0, -sw) * 0.7 - sit * Math.PI / 2 - bend * (agachado ? 1.6 : 0.45);
      });
      v.g.position.y -= bend * (agachado ? 0.3 : 0.12) * v.h;
      if (!zancada) v.g.rotation.x = Math.sin(ph) * 0.06 * w;   // balanceo de cadera
      const encorvado = viejo * 0.25 + (a.enfermo > 0 ? 0.15 : 0) + (a.animo < 30 ? 0.12 : 0);
      const lee = tipo === 'leer' || tipo === 'tallar';
      const inclin = tipo === 'sembrar' || tipo === 'cosechar' || tipo === 'limpiar' ? 0.75 : agachado ? 0.2 : lee ? 0.25 : 0.35;
      v.upper.rotation.set(zancada ? 0 : -Math.sin(ph) * 0.05 * w, zancada ? Math.sin(ph) * 0.14 * w : 0, -(bend || lee ? inclin : 0) - encorvado);
      const work = Math.sin(t * (tipo === 'sacarAgua' ? 3 : 6));
      const habla = tipo === 'conversar' ? Math.max(0, Math.sin(t * 1.3 + a.id.length)) : 0;
      v.arms.forEach((arm, j) => {
        const sw = -Math.sin(ph + j * Math.PI) * 0.45 * w;
        let z = sw + sit * 0.5, x = 0;
        if (bend) z += tipo === 'regar' ? 0.9 : tipo === 'sacarAgua' ? 1.6 + work * 0.6 * (j ? 1 : -1) : agachado ? 0.7 + Math.max(0, Math.sin(t * 5)) * 0.6 * j : 0.9 + work * 0.35 * (j ? 1 : -1);
        if (tipo === 'leer') z = 1.0;
        if (tipo === 'tallar') z = 0.9 + (j ? Math.sin(t * 7) * 0.25 : 0);
        if (tipo === 'contemplar') { z = -0.35; x = (j ? 1 : -1) * 0.15; }   // manos atrás
        if (tipo === 'conversar' && j) z = 0.5 + habla * 0.7;              // gesticula al hablar
        if (abrazando) { z = 1.35; x = (j ? -1 : 1) * 0.45; }
        arm.rotation.set(x, 0, z);
      });
      v.libro.visible = tipo === 'leer';
      v.pieza.visible = tipo === 'tallar';
      v.head.rotation.set(0, 0, bend ? -0.3 : lee ? -0.35 : tipo === 'contemplar' ? 0.15 : tipo === 'siesta' ? -0.45 : 0);
    } else {
      const tipo = trabajando ? T.tipo : null;
      const sleep = tipo === 'dormir' ? 1 : 0, sit = !w && !sleep ? 1 : 0, eat = tipo === 'comer' || tipo === 'beber' ? 1 : 0;
      const juega = a.tarea?.tipo === 'jugar' ? 1 : 0;
      v.g.position.y = Math.abs(Math.sin(ph)) * 0.05 * w - sleep * 0.25 + juega * Math.max(0, Math.sin(t * 5)) * 0.45;
      v.torso.rotation.z = sit * (eat ? -0.25 : 0.5) * (1 - sleep);
      v.head.rotation.set(0, 0, eat ? -0.5 : sit * -0.25);
      v.legs.forEach((l) => {
        let r = w * Math.sin(ph + (l.front ? 0 : Math.PI) + (l.side > 0 ? Math.PI : 0)) * 0.6;
        if (!l.front) r += -sit * (eat ? 0.2 : 1.2) - sleep * 1.4; else r += -sit * (eat ? -0.1 : 0.5) - sleep * 1.3;
        l.piv.rotation.z = r;
      });
      v.tail.rotation.x = Math.sin(t * (v.kind === 'perro' ? 9 : 2.5)) * (sleep ? 0.05 : 0.35);
    }
  }

  // ------------------------------------------------------------ selección de parcela con el mouse
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null, seleccion = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(parcelas.map((p) => p.soil))[0];
    if (hit && onParcela) onParcela(hit.object.userData.parcela);
  });

  // ------------------------------------------------------------ tamaño
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); labelRenderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  camera.position.sub(controls.target).setLength(108 * Math.max(1, 1.2 / camera.aspect)).add(controls.target);

  // ------------------------------------------------------------ actualización por cuadro
  const sunPos = V(0, 0, 0), moonPos = V(0, 0, 0), dir = V(0, 0, 0);
  let lluviaK = 0;
  function update(s, t, dt) {
    if (parcelas.length === 0) s.parcelas.forEach((p, i) => crearParcela(i, p.x, p.z));
    const minDia = s.t % MIN_DIA, ph = (((minDia / 60 - 6) / 24) % 1 + 1) % 1;
    const th = ph * Math.PI * 2, sn = Math.sin(th), cs = Math.cos(th), e = sn;
    const day = smooth(e, -0.04, 0.22), night = 1 - smooth(e, -0.22, 0.0);
    lluviaK += ((s.clima.lluvia ? 1 : 0) - lluviaK) * Math.min(1, dt * 1.5);

    sunPos.set(ORBIT_C.x + cs * ORBIT_R, ORBIT_C.y + sn * ORBIT_H, ORBIT_C.z);
    moonPos.set(ORBIT_C.x - cs * ORBIT_R, ORBIT_C.y - sn * ORBIT_H, ORBIT_C.z);
    sun.position.copy(sunPos); moon.position.copy(moonPos);
    sun.scale.setScalar(0.7 * Math.max(0.001, smooth(e, -0.18, 0.05)));
    moon.scale.setScalar(0.75 * Math.max(0.001, smooth(-e, -0.18, 0.05)));
    sun.userData.rays.rotation.z = t * 0.25; sun.quaternion.copy(camera.quaternion);

    palette(e, lluviaK);
    skyMat.uniforms.uTop.value.copy(pal.top); skyMat.uniforms.uHor.value.copy(pal.hor);
    hemi.color.copy(pal.hs); hemi.groundColor.copy(pal.hg); hemi.intensity = 0.65 + day * 0.55;
    const sunUp = e > -0.02;
    dir.copy(sunUp ? sunPos : moonPos).sub(CENTER).normalize();
    key.position.copy(CENTER).addScaledVector(dir, 45);
    if (sunUp) { key.color.copy(SUN_LOW).lerp(SUN_HIGH, smooth(e, 0.02, 0.45)); key.intensity = 3.2 * smooth(e, -0.02, 0.2) * (1 - lluviaK * 0.55); }
    else { key.color.copy(MOON); key.intensity = 0.95 * night * (1 - lluviaK * 0.6); }
    renderer.toneMappingExposure = 1.0 + night * 0.2;
    starMat.opacity = night * (1 - lluviaK) * (0.75 + 0.25 * Math.sin(t * 2));

    // luces
    for (const w of windows) w.mat.emissiveIntensity = 1.6 * (1 - smooth(e, w.on, w.on + 0.08));
    const homeOn = 1 - smooth(e, -0.06, 0.04);
    interior.forEach((pl) => { pl.intensity = 22 * homeOn; });
    porch.intensity = 14 * homeOn;
    for (const l of lamps) { l.pl.intensity = 60 * homeOn; l.lm.emissiveIntensity = 4 * homeOn; }
    haloMat.opacity = homeOn;

    // lluvia
    rainMat.opacity = lluviaK * 0.55;
    rain.visible = lluviaK > 0.02;
    if (rain.visible) {
      const pa = rainGeo.attributes.position;
      for (let i = 0; i < RAIN; i++) {
        let y = pa.getY(i * 2) - rainV[i] * dt;
        if (y < 0.1) y = 22 + Math.random() * 2;
        pa.setY(i * 2, y); pa.setY(i * 2 + 1, y - 0.6);
      }
      pa.needsUpdate = true;
    }

    // huerto
    s.parcelas.forEach((p, i) => {
      const v = parcelas[i];
      v.soilMat.color.copy(soilDry).lerp(soilWet, Math.min(1, p.agua / 70));
      v.sel.material.opacity = seleccion === i ? 0.35 + Math.sin(t * 4) * 0.1 : 0;
      const k = `${p.cultivo}|${p.estado === 'muerta' ? 'm' : 'v'}`;
      if (v.key !== k) {
        v.key = k; v.plants.clear();
        if (p.cultivo) for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
          const pl = planta(p.cultivo); pl.position.set(-1.25 + c * 0.83, 0.17, -0.45 + r * 0.9); pl.rotation.y = rand() * 6; v.plants.add(pl);
        }
      }
      if (!p.cultivo) return;
      const C = CULTIVOS[p.cultivo];
      const g = p.estado === 'lista' ? 1 : Math.min(1, p.crec / C.dias);
      const dead = p.estado === 'muerta', dry = Math.max(0, 1 - p.agua / 25);
      v.plants.children.forEach((pl, j) => {
        pl.scale.set(0.25 + g * 0.75, (0.15 + g * 0.85) * (dead ? 0.35 : 1 - dry * 0.15), 0.25 + g * 0.75);
        pl.rotation.z = Math.sin(t * 1.2 + j) * 0.04;
        if (pl.userData.fruto) pl.userData.fruto.visible = p.estado === 'lista';
        for (const hm of pl.userData.hojas || []) hm.material = dead ? MAT.muerto : dry > 0.6 ? MAT.seco : MAT[p.cultivo];
      });
    });

    tankLevel(s.rec.cruda / TANQUE_MAX);
    comida.visible = s.rec.comedero > 0.05; comida.scale.set(1.2, 0.3 + Math.min(1, s.rec.comedero / 2) * 0.5, 1.2);
    aguaBowl.visible = s.rec.bebedero > 0.2;
    for (const tr of trees) { tr.crown.rotation.z = Math.sin(t * 0.9 + tr.phase) * 0.02 * (1 + lluviaK); }

    for (const a of s.agentes) poseAgente(a, vis[a.id], s, t, dt);
    etiquetas(s, dt);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // ------------------------------------------------------------ datos flotantes
  let datos = true, refresco = 0, hudVisible = true;
  const NECS = [['comida', '🍽'], ['agua', '💧'], ['energia', '⚡'], ['salud', '❤']];
  const ICONO_CULTIVO = { lechuga: '🥬', papa: '🥔', frijol: '🫘', maiz: '🌽' };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const etiquetasAg = {};
  for (const id in vis) {
    const div = el('div', 'tag'), inner = el('div', 'in'), name = el('b'), act = el('span', 'act'), bars = el('div', 'bars');
    const ems = {};
    for (const [k, ic] of NECS) {
      const cell = el('i'); cell.title = k; const track = el('u'), em = el('em'); track.append(em); cell.append(el('small', null, ic), track); ems[k] = em; bars.append(cell);
    }
    inner.append(name, act, bars); div.append(inner);
    const obj = new CSS2DObject(div); root.add(obj);
    etiquetasAg[id] = { div, inner, name, act, bars, ems, obj, off: 0 };
  }
  const etiquetasPar = [];
  // evita que las etiquetas se tapen: si se cruzan en pantalla, las de atrás suben
  const tmpV = new THREE.Vector3();
  function acomodar() {
    const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    const items = Object.values(etiquetasAg).filter((e) => e.obj.visible).map((e) => {
      e.obj.getWorldPosition(tmpV).project(camera);
      return { e, x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H, w: e.w || 150, h: e.h || 46 };
    }).sort((a, b) => b.y - a.y);
    const puestos = [];
    const choca = (x, y, it) => puestos.some((p) => Math.abs(x - p.x) < (it.w + p.w) / 2 + 4 && Math.abs(y - p.y) < (it.h + p.h) / 2 + 4);
    for (const it of items) {
      // prueba primero en su sitio, luego a los lados y luego más arriba (sin chocar con otras ni con la tarjeta de datos)
      let best = [0, 0];
      busqueda: for (let fila = 0; fila < 5; fila++) for (const lado of [0, 1, -1]) {
        const dx = lado * (it.w + 8), dy = -fila * (it.h + 6);
        const x = it.x + dx, y = it.y + dy;
        if (y - it.h - 30 < 0 || (x - it.w / 2 < 260 && y - it.h - 30 < 230 && hudVisible) || x - it.w / 2 < 4 || x + it.w / 2 > W - 4) continue;
        if (!choca(x, y, it)) { best = [dx, dy]; break busqueda; }
      }
      it.e.offX = (it.e.offX || 0) + (best[0] - (it.e.offX || 0)) * 0.25;
      it.e.off += (best[1] - it.e.off) * 0.25;
      it.e.inner.style.transform = `translate(${it.e.offX.toFixed(1)}px, ${it.e.off.toFixed(1)}px)`;
      puestos.push({ x: it.x + best[0], y: it.y + best[1], w: it.w, h: it.h });
    }
  }
  // efectos flotantes: corazones, charla, discusión
  const efectosVis = new Map();
  const EMOJI_EF = { corazones: '💞', charla: '💬', discusion: '💢' };
  let tReal = 0;
  function efectos(s, dt) {
    tReal += dt;
    for (const e of s.efectos) {
      const k = `${e.tipo}${e.t}`;
      if (efectosVis.has(k)) continue;
      const div = el('div', 'fx', EMOJI_EF[e.tipo] || '✨');
      const obj = new CSS2DObject(div);
      const y0 = e.techo ? 12.5 : e.dentro ? 9.5 : 3.6;
      obj.position.set(e.techo || e.dentro ? 0.5 : e.x, y0, e.techo || e.dentro ? 0 : e.z);
      root.add(obj); efectosVis.set(k, { obj, div, nace: tReal, y0 });
    }
    for (const [k, f] of efectosVis) {
      const edad = tReal - f.nace;
      if (edad > 3.5) { root.remove(f.obj); f.div.remove(); efectosVis.delete(k); continue; }
      f.obj.position.y = f.y0 + edad * 0.9;
      f.div.style.opacity = String(Math.min(1, edad * 3) * (1 - Math.max(0, edad - 2.5)));
    }
  }
  function etiquetas(s, dt) {
    efectos(s, dt);
    for (const k in etiquetasAg) etiquetasAg[k].obj.visible = datos;
    etiquetasPar.forEach((e) => { e.obj.visible = datos && e.div.textContent !== ''; });
    if (!datos) return;
    // posición: sobre la cabeza; si está en casa, junto a la puerta; si murió, sobre su lápida
    let dentro = 0;
    for (const a of s.agentes) {
      const e = etiquetasAg[a.id], v = vis[a.id];
      if (!a.vivo) { e.obj.position.set(v.tomb.position.x, 1.6, v.tomb.position.z); }
      else if (a.dentro) { e.obj.position.set(LUGAR.puerta.x - 1.6 + dentro * 3.2, 4.2, LUGAR.puerta.z - 0.6); dentro++; }
      else { const p = v.vp || a.pos; e.obj.position.set(p.x, (v.kind === 'humano' ? v.h * 2.25 : 1.9) + (v.g.position.y || 0), p.z); }
    }
    acomodar();
    refresco -= dt;
    if (refresco > 0) return;
    refresco = 0.25;
    for (const k in etiquetasAg) { const e = etiquetasAg[k]; if (e.obj.visible) { e.w = e.div.offsetWidth || e.w; e.h = e.div.offsetHeight || e.h; } }
    for (const a of s.agentes) {
      const e = etiquetasAg[a.id];
      e.div.classList.toggle('muerto', !a.vivo);
      e.div.classList.toggle('animal', a.tipo !== 'humano');
      e.name.textContent = a.vivo ? `${a.tipo === 'humano' ? caraAnimo(a.animo) + ' ' : ''}${a.nombre}${a.enfermo > 0 ? ' 🤒' : ''}` : `† ${a.nombre}`;
      e.act.textContent = a.vivo ? (a.dentro ? `En casa · ${a.accion.toLowerCase()}` : a.accion) : a.causa ? `murió ${a.causa}` : '';
      e.bars.style.display = a.vivo ? '' : 'none';
      for (const [k] of NECS) {
        const val = Math.max(0, Math.min(100, a.n[k]));
        e.ems[k].style.width = val + '%';
        e.ems[k].className = val < 25 ? 'low' : val < 50 ? 'mid' : '';
      }
    }
    // parcelas
    s.parcelas.forEach((p, i) => {
      if (!etiquetasPar[i]) {
        const div = el('div', 'ptag'); const obj = new CSS2DObject(div); obj.position.set(p.x, 0.9, p.z + 0.2); root.add(obj);
        etiquetasPar[i] = { div, obj };
      }
      const e = etiquetasPar[i];
      if (!p.cultivo) { e.div.textContent = ''; return; }
      const C = CULTIVOS[p.cultivo];
      e.div.className = 'ptag ' + p.estado;
      e.div.textContent = p.estado === 'lista' ? `${ICONO_CULTIVO[p.cultivo]} lista` : p.estado === 'muerta' ? `${ICONO_CULTIVO[p.cultivo]} perdida`
        : `${ICONO_CULTIVO[p.cultivo]} ${Math.floor(Math.min(1, p.crec / C.dias) * 100)}%${p.agua < 30 ? ' · seca' : ''}`;
    });
  }

  return {
    update,
    seleccionar(i) { seleccion = i; },
    set datos(v) { datos = v; hudVisible = v; },
    get datos() { return datos; },
    get cargada() { return cargada; },
  };
}
