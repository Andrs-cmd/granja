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
import { MIN_DIA, CULTIVOS, LUGAR, TANQUE_MAX, PERSONAJES, BLOQUE, CORRAL, GALLINERO, PISCINA, GANADO, FRUTALES, JARDINES, OBRAS, ESCULTURAS } from './sim.js';

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
  const CENTER = V((BLOQUE.x0 + BLOQUE.x1) / 2, 1.0, (BLOQUE.z0 + BLOQUE.z1) / 2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 16; controls.maxDistance = 380;   // se puede acercar hasta ver adentro de la casa controls.maxPolarAngle = Math.PI * 0.46;
  controls.target.set(CENTER.x, 3, CENTER.z);
  camera.position.set(78, 60, 120);

  const root = new THREE.Group(); scene.add(root);

  // ------------------------------------------------------------ luces y paleta
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -54, right: 54, top: 54, bottom: -54, near: 1, far: 200 });
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

  // ------------------------------------------------------------ terreno circular, del ancho del orbe
  const BW = BLOQUE.x1 - BLOQUE.x0, BD = BLOQUE.z1 - BLOQUE.z0;
  const RT = 50;   // radio del terreno
  const enTerreno = (x, z, m = 0) => Math.hypot(x - CENTER.x, z - CENTER.z) < RT - m;
  {
    const capa = (r0, r1, h, y, color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 128), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      m.position.set(CENTER.x, y, CENTER.z); m.receiveShadow = true; m.castShadow = true; root.add(m); return m;
    };
    {
      const forma = new THREE.Shape(); forma.absarc(CENTER.x, -CENTER.z, RT - 0.12, 0, Math.PI * 2, false);
      const hueco = new THREE.Path(), b = 0.12;
      hueco.moveTo(PISCINA.x0 - b, -(PISCINA.z0 - b)); hueco.lineTo(PISCINA.x1 + b, -(PISCINA.z0 - b)); hueco.lineTo(PISCINA.x1 + b, -(PISCINA.z1 + b)); hueco.lineTo(PISCINA.x0 - b, -(PISCINA.z1 + b)); hueco.lineTo(PISCINA.x0 - b, -(PISCINA.z0 - b));
      forma.holes.push(hueco);
      const g = new THREE.ExtrudeGeometry(forma, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 96 });
      g.rotateX(-Math.PI / 2); g.translate(0, -0.67, 0);
      const pasto = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6f9a44, roughness: 1 }));
      pasto.receiveShadow = true; pasto.castShadow = true; root.add(pasto);
    }
    capa(RT - 0.2, RT - 0.4, 3.3, -2.35, 0x7a4b2b);
    capa(RT - 0.5, RT - 0.9, 1.6, -4.55, 0x5d5751);
    const geos = [];
    for (let i = 0; i < 220; i++) {
      const ang = rand() * Math.PI * 2, g = new THREE.IcosahedronGeometry(0.18 + rand() * 0.22, 0);
      g.translate(CENTER.x + Math.cos(ang) * (RT - 0.25), -1.2 - rand() * 3.2, CENTER.z + Math.sin(ang) * (RT - 0.25)); geos.push(g);
    }
    root.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x8b847c, roughness: 1, flatShading: true })));
  }

  // ------------------------------------------------------------ orbe de vidrio, cielo interior y pedestal
  const ORB_C = V(CENTER.x, 9, CENTER.z), ORB_R = 52, PED_TOP = -5.6;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
    vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uTop, uHor; varying float vY; void main(){ if (vY < -5.4) discard; gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-2., 54., vY)), .97); }`,
  });
  { const m = new THREE.Mesh(new THREE.SphereGeometry(ORB_R - 0.05, 64, 40), skyMat); m.position.copy(ORB_C); m.renderOrder = -1; root.add(m); }
  {
    const glassMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW; varying vec3 vN;
        void main(){ if (vW.y < -5.4) discard; vec3 v = normalize(cameraPosition - vW); float fres = pow(1. - max(dot(vN, v), 0.), 3.);
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
  const ORBIT_C = V(2, 25, 6), ORBIT_R = 24, ORBIT_H = 19;
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
    const p = new Float32Array(320 * 3);
    for (let i = 0; i < 320; i++) { const v = V(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize().multiplyScalar(32 + rand() * 16); p.set([ORB_C.x + v.x, ORB_C.y + 7 + v.y, ORB_C.z + v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); root.add(new THREE.Points(g, starMat));
  }

  // lluvia
  const RAIN = 3200;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN * 6), rainV = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) {
    const ang = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * (RT - 1), x = CENTER.x + Math.cos(ang) * rr, z = CENTER.z + Math.sin(ang) * rr, y = rand() * 42;
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
  let cargada = false, casaK = 0;
  const transparentables = [];   // paredes, techo, losa, puertas y marcos: se desvanecen cuando hay alguien adentro
  const MIN_OPAC = { Techo: 0, Pared: 0.16, Losa: 0.45, Puerta: 0.25, Marco: 0.3 };
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
    const vistos = new Set();
    house.traverse((o) => {
      if (!o.isMesh) return;
      const nombre = o.material.name, min = MIN_OPAC[nombre];
      if (min == null) return;
      if (!vistos.has(o.material)) { vistos.add(o.material); transparentables.push({ mat: o.material, min, mallas: [] }); }
      transparentables.find((x) => x.mat === o.material).mallas.push(o);
    });
    root.add(house); cargada = true;
  });

  // ------------------------------------------------------------ interior de la casa
  const PISO = [0.04, 4.31];
  const ESCALERA = [V(-4.75, PISO[0], 4.7), V(-4.75, PISO[1], 0.9)];   // pie (planta baja) y cima (planta alta)
  let fuego = null, hornillas = null;
  {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    const madera = M(0x9a6b42), blanco = M(0xf2efe8, { roughness: 0.5 }), acero = M(0xc9ced4, { roughness: 0.3, metalness: 0.6 }), oscuro = M(0x2b2d31, { roughness: 0.5 });
    const bx = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; root.add(m); return m; };
    const y0 = PISO[0], y1 = PISO[1];
    // cocina (al fondo, a la izquierda)
    bx(3.3, 0.9, 0.7, blanco, -2.65, y0 + 0.45, -5.45);
    bx(3.3, 0.06, 0.74, M(0x6d5a4a, { roughness: 0.4 }), -2.65, y0 + 0.93, -5.45);
    bx(0.7, 0.04, 0.55, acero, -3.5, y0 + 0.95, -5.45);                       // lavaplatos
    bx(0.8, 0.05, 0.6, oscuro, -1.7, y0 + 0.97, -5.45);                       // estufa
    hornillas = new THREE.MeshStandardMaterial({ color: 0x331a10, emissive: 0xff5a1a, emissiveIntensity: 0 });
    for (const dx of [-0.18, 0.18]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12), hornillas); h.position.set(-1.7 + dx, y0 + 1.0, -5.45); root.add(h); }
    bx(0.9, 2.0, 0.8, M(0xe8e6e1, { roughness: 0.35 }), -5.0, y0 + 1.0, -5.1);   // nevera
    bx(3.3, 0.7, 0.4, madera, -2.65, y0 + 2.35, -5.6);                        // alacena
    // comedor
    bx(2.2, 0.08, 1.2, madera, -1.2, y0 + 0.8, -1.6);
    for (const [x, z] of [[-2.1, -2.1], [-0.3, -2.1], [-2.1, -1.1], [-0.3, -1.1]]) bx(0.08, 0.8, 0.08, madera, x, y0 + 0.4, z);
    for (const [x, z] of [[-1.9, -2.65], [-0.5, -2.65], [-1.9, -0.55], [-0.5, -0.55]]) { bx(0.5, 0.06, 0.5, madera, x, y0 + 0.5, z); bx(0.5, 0.6, 0.06, madera, x, y0 + 0.8, z + (z < -1.6 ? -0.24 : 0.24)); }
    // sala: tapete, sofá, sillón, mesa de centro, chimenea
    const tapete = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), M(0xb5523b, { roughness: 1 })); tapete.rotation.x = -Math.PI / 2; tapete.position.set(2.6, y0 + 0.02, 2.3); tapete.receiveShadow = true; root.add(tapete);
    const tela = M(0x5a6f8f, { roughness: 0.95 });
    bx(3.0, 0.45, 0.9, tela, 2.6, y0 + 0.3, 4.6); bx(3.0, 0.7, 0.25, tela, 2.6, y0 + 0.75, 5.05);
    for (const sx of [-1, 1]) bx(0.25, 0.6, 0.9, tela, 2.6 + sx * 1.55, y0 + 0.5, 4.6);
    bx(1.0, 0.45, 0.9, M(0x8a5a3a, { roughness: 0.9 }), 4.75, y0 + 0.3, 0.6); bx(0.25, 0.7, 0.9, M(0x8a5a3a), 5.25, y0 + 0.75, 0.6);
    bx(1.2, 0.35, 0.7, madera, 2.6, y0 + 0.2, 2.5);
    bx(1.6, 1.4, 0.6, M(0x8c8780, { roughness: 1, flatShading: true }), 1.2, y0 + 0.7, -5.6);
    fuego = new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff7a2a, emissiveIntensity: 0 });
    { const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.1), fuego); f.position.set(1.2, y0 + 0.45, -5.28); root.add(f); }
    // escalera (de la sala al dormitorio)
    for (let k = 0; k < 12; k++) { const u = (k + 0.5) / 12; bx(1.0, 0.18, 0.42, madera, -4.75, y0 + u * (y1 - y0) - 0.09, 4.7 - u * 3.8); }
    // planta alta: dormitorio y estudio
    bx(2.2, 0.45, 2.6, madera, 0.2, y1 + 0.22, -4.2);
    bx(2.1, 0.12, 2.4, M(0x7a9cc6, { roughness: 1 }), 0.2, y1 + 0.5, -4.0);         // cobija
    for (const dx of [-0.5, 0.5]) bx(0.8, 0.14, 0.45, blanco, 0.2 + dx, y1 + 0.58, -5.2);   // almohadas
    bx(2.2, 1.1, 0.12, madera, 0.2, y1 + 0.6, -5.5);                              // cabecera
    for (const sx of [-1, 1]) bx(0.5, 0.55, 0.45, madera, 0.2 + sx * 1.5, y1 + 0.28, -5.3);
    bx(2.0, 2.2, 0.4, madera, 3.5, y1 + 1.1, -5.6);                               // biblioteca
    const libros = [0xc0392b, 0x2e6da4, 0xe2b33c, 0x3e8e5b, 0x8e44ad];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) bx(0.16, 0.38, 0.28, M(libros[(r * 3 + k) % 5]), 2.7 + k * 0.2, y1 + 0.35 + r * 0.52, -5.5);
    bx(1.0, 0.45, 0.9, M(0x6f8f5a, { roughness: 0.95 }), 4.6, y1 + 0.3, 3.4); bx(0.25, 0.7, 0.9, M(0x6f8f5a), 5.1, y1 + 0.75, 3.4);
  }
  // dónde se ubica cada uno según lo que hace: [piso, x, z, mirar x, mirar z, pose]
  const SITIO = {
    estufa: [0, -1.7, -4.75, -1.7, -6, 'trabajo'], fregadero: [0, -3.5, -4.75, -3.5, -6, 'trabajo'],
    silla0: [0, -1.9, -2.65, -1.9, 0, 'sentado'], silla1: [0, -0.5, -0.55, -0.5, -3, 'sentado'],
    sofa0: [0, 2.0, 4.45, 2.0, 0, 'sentado'], sofa1: [0, 3.2, 4.45, 3.2, 0, 'sentado'],
    sillon: [0, 4.65, 0.6, 0, 0.6, 'sentado'], tapete: [0, 2.6, 2.3, 2.6, 0, 'quieto'],
    sala0: [0, 0.8, 2.0, 2.6, 2.3, 'quieto'], sala1: [0, 1.6, 0.6, 2.6, 2.3, 'quieto'],
    cama0: [1, -0.3, -4.0, -0.3, -6, 'acostado'], cama1: [1, 0.7, -4.0, 0.7, -6, 'acostado'],
    pieCama: [1, 0.2, -3.1, 0.2, 0, 'acostado'], sillonAlto: [1, 4.5, 3.4, 0, 3.4, 'sentado'], biblioteca: [1, 3.5, -4.7, 3.5, -6, 'quieto'],
  };
  const LIMPIAR = ['sala0', 'fregadero', 'tapete', 'biblioteca', 'sillon'];

  // ------------------------------------------------------------ granja: huerto, pozo, tanque, comedero, caseta, banca
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2b, roughness: 0.8, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.45, metalness: 0.6 });
  const box = (w, h, d, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // camino de piedras
  {
    const geos = [];
    const pathX = (z) => -2.6 + Math.sin(z * 0.22) * 0.5;
    for (let z = 7.6; z < 28.4; z += 0.95) { if (z > 15.2 && z < 21.2) continue; const g = new THREE.CylinderGeometry(0.42 + rand() * 0.08, 0.46, 0.08, 7); g.rotateY(rand() * 3); g.translate(pathX(z), 0.03, z); geos.push(g); }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xbdb7aa, roughness: 0.95, flatShading: true })); m.receiveShadow = true; root.add(m);
  }

  // huerto: 6 parcelas con cerca baja
  const parcelas = [];
  const soilDry = new THREE.Color(0x9a7650), soilWet = new THREE.Color(0x4a3220);
  for (const [fz0, fz1] of [[15.2, 21.0], [28.2, 34.0]]) {
    const fence = new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.9, flatShading: true });
    const fx0 = -3.8, fx1 = 9.8;
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
  makeTree(-6.8, -12.0, 1.2); makeTree(8.5, -12.6, 1.3); makeTree(-17.5, 26.5, 1.05); makeTree(22.6, 4.8, 1.0); makeTree(6.0, 25.5, 0.9); makeTree(1.0, -13.5, 1.1);
  // el anillo nuevo (fuera del rectángulo de la granja): un bosque en el borde
  const fueraGranja = (x, z) => x < BLOQUE.x0 + 1 || x > BLOQUE.x1 - 1 || z < BLOQUE.z0 + 1 || z > BLOQUE.z1 - 1;
  const ESTANQUE = { x: -16, z: 47, rx: 7, rz: 3.6 };
  for (let k = 0; k < 70; k++) {
    const ang = rand() * Math.PI * 2, r = 38 + rand() * 9.5;
    const x = CENTER.x + Math.cos(ang) * r, z = CENTER.z + Math.sin(ang) * r;
    if (!fueraGranja(x, z) || !enTerreno(x, z, 3) || Math.hypot((x - ESTANQUE.x) / (ESTANQUE.rx + 3), (z - ESTANQUE.z) / (ESTANQUE.rz + 3)) < 1) continue;
    makeTree(x, z, 0.8 + rand() * 0.6);
  }
  // estanque con juncos y piedras
  {
    const agua = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x3a8fb7, roughness: 0.15, metalness: 0.1 }));
    agua.rotation.x = -Math.PI / 2; agua.scale.set(ESTANQUE.rx, ESTANQUE.rz, 1); agua.position.set(ESTANQUE.x, 0.02, ESTANQUE.z); root.add(agua);
    const orilla = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 40), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
    orilla.rotation.x = -Math.PI / 2; orilla.scale.set(ESTANQUE.rx, ESTANQUE.rz, 1); orilla.position.set(ESTANQUE.x, 0.03, ESTANQUE.z); root.add(orilla);
    const junco = LEAF(0x5c8a3a), geos = [];
    for (let k = 0; k < 60; k++) { const a = rand() * Math.PI * 2, g = new THREE.CylinderGeometry(0.03, 0.04, 0.8 + rand() * 0.6, 4); g.translate(ESTANQUE.x + Math.cos(a) * ESTANQUE.rx * (1.02 + rand() * 0.12), 0.45, ESTANQUE.z + Math.sin(a) * ESTANQUE.rz * (1.02 + rand() * 0.12)); geos.push(g); }
    root.add(new THREE.Mesh(mergeGeometries(geos), junco));
    for (let k = 0; k < 4; k++) { const n = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), LEAF(0x4f8a34)); n.rotation.x = -Math.PI / 2; n.position.set(ESTANQUE.x + (rand() - 0.5) * 8, 0.04, ESTANQUE.z + (rand() - 0.5) * 3); root.add(n); }   // nenúfares
  }
  // praderas de flores silvestres en el anillo
  {
    const colores = [0xf2f0e6, 0xf2c94c, 0xe4507a, 0x9b6ad8].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    const porColor = colores.map(() => []);
    for (let k = 0; k < 900; k++) {
      const ang = rand() * Math.PI * 2, r = 36 + rand() * 13, x = CENTER.x + Math.cos(ang) * r, z = CENTER.z + Math.sin(ang) * r;
      if (!fueraGranja(x, z) || !enTerreno(x, z, 1)) continue;
      const g = new THREE.IcosahedronGeometry(0.09, 0); g.translate(x, 0.18 + rand() * 0.12, z); porColor[k % 4].push(g);
    }
    porColor.forEach((gs, i) => { if (gs.length) root.add(new THREE.Mesh(mergeGeometries(gs), colores[i])); });
  }
  // bordes del terreno ampliado
  for (const [x, z, sc] of [[-31, 32, 1.2], [-24, 37, 1.0], [16, 37.5, 1.1], [27, 36.5, 1.25], [36, 30, 1.0], [36, 14, 1.15], [35.5, -6, 1.0], [34, -24, 1.2], [21, -25.5, 1.05],
    [-13, -26, 1.1], [-20, 33, 0.95], [-30.5, 27, 0.9]]) makeTree(x, z, sc);
  for (const [x, z, s] of [[-7.6, 7.2, 0.9], [30, 25, 1.0], [24, 31, 0.9], [-12, 36, 1.0], [35, 4, 0.9], [-2, -27, 0.9], [12, -27, 1.0], [-7.0, -1.5, 1.0], [12.9, 2.5, 0.9], [-1.0, -8.6, 0.9], [4.5, -9.0, 1.0], [22.6, 22.0, 1.0], [-8.4, 18.5, 0.9], [11.0, 26.0, 0.9], [-3.0, 26.0, 1.0], [23.0, 9.0, 0.8]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 1), LEAFS[Math.floor(rand() * LEAFS.length)]); m.position.set((rand() - 0.5) * 1.1, 0.45 + rand() * 0.35, (rand() - 0.5) * 1.1); m.scale.y = 0.85; m.castShadow = true; g.add(m); }
  }
  // huerto de frutales: la fruta aparece en la copa según lo que haya madurado
  const frutales = FRUTALES.map((f) => {
    const t = new THREE.Group(); t.position.set(f.x, 0, f.z); root.add(t);
    const tr = new THREE.CylinderGeometry(0.12, 0.2, 1.9, 6); tr.translate(0, 0.95, 0); const tm = new THREE.Mesh(tr, bark); tm.castShadow = true; t.add(tm);
    const copa = new THREE.Group(); copa.position.y = 2.3; t.add(copa);
    const hoja = LEAF(f.tipo === 'naranjo' ? 0x3f7a35 : 0x5d9a3c);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.3, 0), hoja); const a = rand() * 6.28, r = rand() * 0.9; m.position.set(Math.cos(a) * r, (rand() - 0.3) * 0.8, Math.sin(a) * r); m.castShadow = true; copa.add(m); }
    const fm = new THREE.MeshStandardMaterial({ color: f.tipo === 'naranjo' ? 0xf28c1e : 0xd2342c, roughness: 0.5 });
    const frutas = [];
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), fm); const a = i * 2.4, r = 0.85 + (i % 3) * 0.2; m.position.set(Math.cos(a) * r, -0.3 + (i % 4) * 0.3, Math.sin(a) * r); copa.add(m); frutas.push(m); }
    // cerco bajo alrededor del tronco
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 5, 14), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 })); anillo.rotation.x = Math.PI / 2; anillo.position.y = 0.06; t.add(anillo);
    return { copa, frutas, fase: rand() * 6 };
  });

  // ------------------------------------------------------------ jardines de María: canteros con flores
  const jardinesVis = JARDINES.map((j) => {
    const g = new THREE.Group(); g.position.set(j.x, 0, j.z); root.add(g);
    const tierra = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.22, 2.4, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x5e4029, roughness: 1 }));
    tierra.position.y = 0.08; tierra.receiveShadow = true; g.add(tierra);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 4, 24), new THREE.MeshStandardMaterial({ color: 0xbdb7aa, roughness: 1 })); borde.rotation.x = Math.PI / 2; borde.scale.set(1, 0.68, 1); borde.position.y = 0.14; g.add(borde);
    const tallo = LEAF(0x4f8a34), petalo = new THREE.MeshStandardMaterial({ color: j.flor, roughness: 0.6 }), centro = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.6 });
    const flores = [];
    for (let k = 0; k < 26; k++) {
      const f = new THREE.Group(); f.position.set(-1.5 + (k % 7) * 0.5 + (rand() - 0.5) * 0.15, 0.18, -0.9 + Math.floor(k / 7) * 0.6 + (rand() - 0.5) * 0.15); g.add(f);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4), tallo); st.position.y = 0.22; f.add(st);
      const cab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), petalo); cab.position.y = 0.48; cab.scale.set(1, 0.6, 1); f.add(cab);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), centro); c.position.y = 0.52; f.add(c);
      flores.push(f);
    }
    return { flores, fase: rand() * 6 };
  });

  // ------------------------------------------------------------ obras de Andrés: se ven en construcción hasta quedar listas
  const piedraObra = new THREE.MeshStandardMaterial({ color: 0x9d968b, roughness: 1, flatShading: true });
  const barro = new THREE.MeshStandardMaterial({ color: 0xb06a42, roughness: 1, flatShading: true });
  const andamioMat = new THREE.MeshStandardMaterial({ color: 0xc9a46c, roughness: 0.9 });
  const obrasVis = {};
  for (const [id, , , x, z] of OBRAS) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const cuerpo = new THREE.Group(); g.add(cuerpo);
    const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; cuerpo.add(m); return m; };
    if (id === 'bodega') {
      add(new THREE.BoxGeometry(3.2, 2.0, 3.0), piedraObra, 0, 1.0, 0);
      const techo = add(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 1 }), 0, 2.0, 0); techo.rotation.set(0, 0, Math.PI / 2); techo.rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(0.9, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a3020 }), 0, 0.7, 1.52);
    } else if (id === 'secadero') {
      for (const dz of [-0.8, 0, 0.8]) { add(new THREE.BoxGeometry(2.4, 0.05, 0.5), andamioMat, 0, 1.0, dz); for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshStandardMaterial({ color: [0xd2342c, 0xf28c1e, 0xf2c94c][k % 3] }), -1 + k * 0.4, 1.06, dz); }
      for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) add(new THREE.BoxGeometry(0.08, 1.1, 0.08), andamioMat, px, 0.55, pz);
    } else if (id === 'pergola') {
      for (const [px, pz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) add(new THREE.BoxGeometry(0.18, 2.8, 0.18), andamioMat, px, 1.4, pz);
      for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(3.8, 0.1, 0.12), andamioMat, 0, 2.85, k * 0.85);
      for (let k = 0; k < 14; k++) add(new THREE.IcosahedronGeometry(0.3 + rand() * 0.2, 0), LEAF(0x4d7a2b), (rand() - 0.5) * 3.6, 2.95, (rand() - 0.5) * 3.6);
      for (let k = 0; k < 10; k++) add(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshStandardMaterial({ color: 0xc36bd8 }), (rand() - 0.5) * 3.4, 2.75, (rand() - 0.5) * 3.4);
    } else if (id === 'horno') {
      add(new THREE.CylinderGeometry(1.3, 1.4, 0.6, 14), piedraObra, 0, 0.3, 0);
      add(new THREE.SphereGeometry(1.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), barro, 0, 0.6, 0);
      add(new THREE.BoxGeometry(0.5, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: 0x1a120c }), 0, 0.85, 1.05);
      add(new THREE.CylinderGeometry(0.14, 0.16, 0.8, 8), barro, -0.4, 1.8, -0.3);
    } else if (id === 'invernadero') {
      const vidrio = new THREE.MeshStandardMaterial({ color: 0xcfeef7, roughness: 0.05, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
      const caja = new THREE.Mesh(new THREE.BoxGeometry(13.4, 2.4, 3.2), vidrio); caja.position.y = 1.2; cuerpo.add(caja);
      for (let k = -3; k <= 3; k++) for (const pz of [-1.6, 1.6]) add(new THREE.BoxGeometry(0.08, 2.4, 0.08), andamioMat, k * 2.2, 1.2, pz);
      for (const pz of [-1.6, 1.6]) add(new THREE.BoxGeometry(13.4, 0.08, 0.08), andamioMat, 0, 2.4, pz);
    } else if (id === 'fuente') {
      add(new THREE.CylinderGeometry(1.5, 1.6, 0.5, 18, 1, true), piedraObra, 0, 0.25, 0).material.side = THREE.DoubleSide;
      const agua = new THREE.Mesh(new THREE.CircleGeometry(1.45, 18), new THREE.MeshStandardMaterial({ color: 0x4aa3d0, roughness: 0.1 })); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.38; cuerpo.add(agua);
      add(new THREE.CylinderGeometry(0.18, 0.25, 1.5, 10), piedraObra, 0, 0.75, 0);
      add(new THREE.CylinderGeometry(0.55, 0.3, 0.2, 14), piedraObra, 0, 1.5, 0);
      const chorro = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.55, roughness: 0.1 })); chorro.position.y = 1.95; chorro.rotation.x = Math.PI; cuerpo.add(chorro);
    }
    // andamio mientras está en obra
    const andamio = new THREE.Group(); g.add(andamio);
    for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 0.1), andamioMat); m.position.set(px * (id === 'invernadero' ? 3.6 : 1), 1.5, px === 0 ? 0 : pz); andamio.add(m); }
    obrasVis[id] = { g, cuerpo, andamio };
  }

  // ------------------------------------------------------------ esculturas de Andrés
  const marmol = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.55 });
  const esculturasVis = ESCULTURAS.map((e) => {
    const g = new THREE.Group(); g.position.set(e.x, 0, e.z); g.rotation.y = rand() * 6; g.visible = false; root.add(g);
    const add = (geo, px, py, pz, mat = marmol) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(0.9, 0.7, 0.9), 0, 0.35, 0, piedraObra);
    if (e.tipo === 'buho') { add(new THREE.SphereGeometry(0.42, 12, 10), 0, 1.1, 0).scale.set(1, 1.2, 1); add(new THREE.SphereGeometry(0.3, 12, 10), 0, 1.7, 0); for (const sz of [-1, 1]) add(new THREE.ConeGeometry(0.08, 0.25, 5), 0, 2.0, sz * 0.15); }
    if (e.tipo === 'espiral') add(new THREE.TorusKnotGeometry(0.4, 0.1, 64, 8, 2, 3), 0, 1.3, 0);
    if (e.tipo === 'figura') { add(new THREE.CapsuleGeometry(0.22, 0.9, 4, 10), 0, 1.4, 0); add(new THREE.SphereGeometry(0.2, 10, 8), 0, 2.15, 0); }
    if (e.tipo === 'caballo') { add(new THREE.BoxGeometry(1.0, 0.45, 0.35), 0, 1.35, 0); add(new THREE.BoxGeometry(0.25, 0.6, 0.25), 0.55, 1.7, 0).rotation.z = -0.4; for (const [px, pz] of [[-0.4, -0.12], [-0.4, 0.12], [0.4, -0.12], [0.4, 0.12]]) add(new THREE.BoxGeometry(0.1, 0.6, 0.1), px, 0.95, pz); }
    if (e.tipo === 'pareja') { add(new THREE.CapsuleGeometry(0.2, 0.9, 4, 10), -0.14, 1.4, 0).rotation.z = 0.12; add(new THREE.CapsuleGeometry(0.18, 0.8, 4, 10), 0.14, 1.35, 0).rotation.z = -0.12; add(new THREE.SphereGeometry(0.17, 10, 8), -0.2, 2.1, 0); add(new THREE.SphereGeometry(0.16, 10, 8), 0.18, 1.98, 0); }
    if (e.tipo === 'gato') { add(new THREE.SphereGeometry(0.35, 12, 10), 0, 1.0, 0).scale.set(1, 1.3, 1); add(new THREE.SphereGeometry(0.22, 10, 8), 0, 1.55, 0); for (const sz of [-1, 1]) add(new THREE.ConeGeometry(0.07, 0.18, 4), 0, 1.75, sz * 0.12); add(new THREE.TorusGeometry(0.3, 0.05, 6, 12, Math.PI), -0.2, 0.85, 0); }
    return g;
  });

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
  for (const [x, z, rot] of [[-5.4, 13.8, 0.4], [11.4, 11.2, Math.PI - 0.4], [13.0, 18.6, Math.PI / 2], [-5.4, 26.6, 0.4]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 10), darkMat); pole.position.y = 2.3; pole.castShadow = true; g.add(pole);
    box(1.1, 0.08, 0.08, darkMat, 0.5, 4.6, 0, g);
    const lm = new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffc677, emissiveIntensity: 0 });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), lm); l.position.set(1.0, 4.3, 0); g.add(l);
    const s = new THREE.Sprite(haloMat); s.position.set(1.0, 4.3, 0); s.scale.setScalar(3.2); g.add(s);
    const pl = new THREE.PointLight(0xffc27a, 0, 22, 1.6); pl.position.set(1.0, 4.0, 0); g.add(pl);
    lamps.push({ pl, lm });
  }

  // ------------------------------------------------------------ corral, establo, gallinero
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9a7350, roughness: 0.9, flatShading: true });
  function cerca(R, puertaZ, lado, alto = 0.9) {
    // postes y dos travesaños alrededor del rectángulo, dejando el hueco de la puerta en el lado indicado
    const seg = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.6));
      for (let i = 0; i <= n; i++) box(0.12, alto, 0.12, fenceMat, x0 + (x1 - x0) * i / n, alto / 2, z0 + (z1 - z0) * i / n);
      for (const y of [alto * 0.45, alto * 0.85]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.06), fenceMat);
        r.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); r.rotation.y = -Math.atan2(z1 - z0, x1 - x0); r.castShadow = true; root.add(r);
      }
    };
    const xg = lado < 0 ? R.x1 : R.x0;
    seg(R.x0, R.z0, R.x1, R.z0); seg(R.x0, R.z1, R.x1, R.z1);
    seg(lado < 0 ? R.x0 : R.x1, R.z0, lado < 0 ? R.x0 : R.x1, R.z1);
    seg(xg, R.z0, xg, puertaZ - 1.1); seg(xg, puertaZ + 1.1, xg, R.z1);
  }
  cerca(CORRAL, CORRAL.puerta.z, -1);
  cerca(GALLINERO, GALLINERO.puerta.z, 1, 0.75);
  // pasto del corral: su color sigue al estado del pasto
  const pastoMat = new THREE.MeshStandardMaterial({ color: 0x7fae4a, roughness: 1 });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CORRAL.x1 - CORRAL.x0 - 0.4, CORRAL.z1 - CORRAL.z0 - 0.4), pastoMat);
    m.rotation.x = -Math.PI / 2; m.position.set((CORRAL.x0 + CORRAL.x1) / 2, 0.02, (CORRAL.z0 + CORRAL.z1) / 2); m.receiveShadow = true; root.add(m);
    const geos = [];
    for (let i = 0; i < 520; i++) { const g = new THREE.ConeGeometry(0.1, 0.35 + rand() * 0.3, 4); g.translate(CORRAL.x0 + 0.5 + rand() * (CORRAL.x1 - CORRAL.x0 - 1), 0.2, CORRAL.z0 + 0.5 + rand() * (CORRAL.z1 - CORRAL.z0 - 1)); geos.push(g); }
    var matas = new THREE.Mesh(mergeGeometries(geos), pastoMat); root.add(matas);
  }
  const rojoGranero = new THREE.MeshStandardMaterial({ color: 0xa63b2c, roughness: 0.8, flatShading: true });
  const tejado = new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 0.8, flatShading: true });
  {
    // establo abierto hacia el corral
    const g = new THREE.Group(); g.position.set(LUGAR.establo.x, 0, LUGAR.establo.z); root.add(g);
    box(0.2, 3.2, 4.6, rojoGranero, -2.2, 1.6, 0, g);
    box(4.6, 3.2, 0.2, rojoGranero, 0, 1.6, -2.3, g);
    box(4.6, 3.2, 0.2, rojoGranero, 0, 1.6, 2.3, g).scale.x = 0.25;
    g.children.at(-1).position.x = -1.7;
    for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 2.8), tejado); r.position.set(0, 3.75, sz * 1.25); r.rotation.x = sz * 0.5; r.castShadow = true; g.add(r); }
    const paja = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 4.4), new THREE.MeshStandardMaterial({ color: 0xd8c27a, roughness: 1 })); paja.position.y = 0.05; g.add(paja);
  }
  // heno guardado (crece con las reservas)
  const henoMat = new THREE.MeshStandardMaterial({ color: 0xd9bf6a, roughness: 1, flatShading: true });
  const pacas = [];
  for (let i = 0; i < 9; i++) { const m = box(1.1, 0.6, 0.7, henoMat, LUGAR.heno.x + (i % 3) * 1.15 - 1.15, 0.3 + Math.floor(i / 3) * 0.62, LUGAR.heno.z); pacas.push(m); }
  // pesebre y bebedero del ganado
  const pesebreHeno = box(2.0, 0.4, 0.6, henoMat, LUGAR.pesebre.x, 0.55, LUGAR.pesebre.z);
  box(2.3, 0.5, 0.85, fenceMat, LUGAR.pesebre.x, 0.25, LUGAR.pesebre.z);
  box(2.3, 0.45, 0.85, new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.5, metalness: 0.4 }), LUGAR.bebederoGanado.x, 0.22, LUGAR.bebederoGanado.z);
  const aguaGanado = box(2.0, 0.05, 0.6, new THREE.MeshStandardMaterial({ color: 0x4a9fd0, roughness: 0.2 }), LUGAR.bebederoGanado.x, 0.4, LUGAR.bebederoGanado.z);
  {
    // gallinero sobre patas, con rampa
    const g = new THREE.Group(); g.position.set(LUGAR.gallinero.x, 0, LUGAR.gallinero.z); root.add(g);
    const madera = new THREE.MeshStandardMaterial({ color: 0xc9a46c, roughness: 0.85, flatShading: true });
    for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) box(0.14, 0.8, 0.14, fenceMat, x, 0.4, z, g);
    box(3.0, 1.6, 2.4, madera, 0, 1.6, 0, g);
    box(0.5, 0.6, 0.06, new THREE.MeshStandardMaterial({ color: 0x2a2018 }), -1.0, 1.3, 1.22, g);
    for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.6), rojoGranero); r.position.set(0, 2.75, sz * 0.7); r.rotation.x = sz * 0.55; r.castShadow = true; g.add(r); }
    const rampa = box(0.6, 0.06, 1.6, madera, -1.0, 0.45, 1.85, g); rampa.rotation.x = -0.55;
  }
  box(1.2, 0.18, 0.6, fenceMat, LUGAR.grano.x, 0.15, LUGAR.grano.z);
  const granoMat = new THREE.MeshStandardMaterial({ color: 0xe8c24a, roughness: 1 });
  const granos = box(1.0, 0.06, 0.45, granoMat, LUGAR.grano.x, 0.27, LUGAR.grano.z);

  // ------------------------------------------------------------ piscina
  const PW = PISCINA.x1 - PISCINA.x0 - 0.02, PD = PISCINA.z1 - PISCINA.z0 - 0.02;
  const POOL_C = V((PISCINA.x0 + PISCINA.x1) / 2, 0, (PISCINA.z0 + PISCINA.z1) / 2);
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d');
    g2.fillStyle = '#8fd3df'; g2.fillRect(0, 0, 128, 128); g2.strokeStyle = '#6cbccb'; g2.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) { g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 128); g2.stroke(); g2.beginPath(); g2.moveTo(0, i); g2.lineTo(128, i); g2.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 3);
    const liner = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.66, PD), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, side: THREE.BackSide }));
    liner.position.set(POOL_C.x, -0.33, POOL_C.z); liner.receiveShadow = true; root.add(liner);
    const stone = new THREE.MeshStandardMaterial({ color: 0xe7e1d4, roughness: 0.85 });
    const W = 0.7, H = 0.1;
    [[POOL_C.x, PISCINA.z0 - W / 2, PW + 2 * W, W], [POOL_C.x, PISCINA.z1 + W / 2, PW + 2 * W, W], [PISCINA.x0 - W / 2, POOL_C.z, W, PD], [PISCINA.x1 + W / 2, POOL_C.z, W, PD]]
      .forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 2, 0.03), stone); m.position.set(x, H / 2 - 0.01, z); m.castShadow = m.receiveShadow = true; root.add(m); });
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.25 });
    for (const dz of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 6, 16, Math.PI), steel); r.position.set(PISCINA.x0 + 0.05, 0.1, POOL_C.z + dz); root.add(r); }
  }
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uDay, uNight; uniform vec3 uTop, uHor, uSun; varying vec3 vW;
      void main(){ vec2 p = vW.xz; float t = uTime;
        float w = sin(p.x*2.1 + t*1.3)*.5 + sin(p.y*2.7 - t*1.1)*.5 + sin((p.x+p.y)*3.3 + t*1.7)*.3;
        float dx = cos(p.x*2.1 + t*1.3)*1.05 + cos((p.x+p.y)*3.3 + t*1.7)*.99, dz = cos(p.y*2.7 - t*1.1)*1.35 + cos((p.x+p.y)*3.3 + t*1.7)*.99;
        vec3 n = normalize(vec3(-dx*.05, 1., -dz*.05)); vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1. - max(dot(n, v), 0.), 3.);
        vec3 base = mix(vec3(.38,.82,.86), vec3(.05,.48,.6), .45 + .15*w);
        float c = pow(abs(sin(p.x*4.5 + sin(p.y*3.7 + t)*1.6 + t*.6) * sin(p.y*5.2 + sin(p.x*3.1 - t*.8)*1.6)), 5.);
        vec3 col = base * (.35 + .65*uDay) + vec3(c) * .28 * (uDay + uNight*.8);
        col = mix(col, mix(uHor, uTop, .5), fres * .55);
        vec3 r = reflect(-normalize(uSun), n); col += vec3(1., .95, .85) * pow(max(dot(r, v), 0.), 90.) * 1.4 * uDay;
        col = mix(col, vec3(.12,.78,.9) * (.75 + .12*w) + vec3(c)*.25, uNight * .75);
        gl_FragColor = vec4(col, .88); }`,
  });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), waterMat); m.rotation.x = -Math.PI / 2; m.position.set(POOL_C.x, -0.14, POOL_C.z); root.add(m); }
  const poolLight = new THREE.PointLight(0x3fd8ff, 0, 10, 2); poolLight.position.set(POOL_C.x, 0.3, POOL_C.z); root.add(poolLight);

  // ------------------------------------------------------------ arcoíris (aparece al terminar de llover)
  const arcoiris = new THREE.Group(); arcoiris.position.set(CENTER.x, -3, -13); root.add(arcoiris);
  const arcMats = ['#ff4d4d', '#ff9f3a', '#ffe14d', '#5fd36a', '#4aa8ff', '#9a6bff'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  arcMats.forEach((m, i) => { const t2 = new THREE.Mesh(new THREE.TorusGeometry(24 - i * 0.7, 0.34, 6, 64, Math.PI), m); arcoiris.add(t2); });
  arcoiris.visible = false;

  // ------------------------------------------------------------ animales de granja
  function makeVaca(toro) {
    const g = new THREE.Group(); root.add(g);
    const blanco = LEAF(toro ? 0x7a4a2a : 0xf2efe8), mancha = LEAF(toro ? 0x2a1a12 : 0x3b2a20), rosa = LEAF(toro ? 0x3a2a24 : 0xe7a3a0), cuerno = LEAF(0xe8dcc0);
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.1, 1.05, 2, 0.25), blanco); body.position.y = 1.35; body.castShadow = true; g.add(body);
    for (const [x, y, z, w, h] of [[0.4, 1.6, 0.5, 0.7, 0.5], [-0.6, 1.3, -0.5, 0.8, 0.6], [-0.2, 1.75, 0.0, 0.6, 0.12]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mancha); m.position.set(x, y, z); g.add(m); }
    const head = new THREE.Group(); head.position.set(1.3, 1.65, 0); g.add(head);
    const hm = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.62, 0.55, 2, 0.12), blanco); hm.position.set(0.25, 0, 0); hm.castShadow = true; head.add(hm);
    const hocico = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.36, 0.5, 2, 0.08), rosa); hocico.position.set(0.62, -0.1, 0); head.add(hocico);
    for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(toro ? 0.09 : 0.06, toro ? 0.5 : 0.28, 5), cuerno); c.position.set(0.1, 0.38, sz * (toro ? 0.3 : 0.22)); c.rotation.x = sz * (toro ? -1.1 : -0.6); head.add(c);
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.28), mancha); o.position.set(0.05, 0.18, sz * 0.36); head.add(o);
    }
    const ubre = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), rosa); ubre.position.set(-0.6, 0.8, 0); ubre.visible = !toro; g.add(ubre);
    const legs = [];
    for (const [x, sz] of [[0.9, -1], [0.9, 1], [-0.9, -1], [-0.9, 1]]) {
      const piv = new THREE.Group(); piv.position.set(x, 0.9, sz * 0.35); g.add(piv);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.9, 6), blanco); l.position.y = -0.45; l.castShadow = true; piv.add(l);
      const pz = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), mancha); pz.position.y = -0.88; piv.add(pz);
      legs.push(piv);
    }
    const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), blanco); cola.position.set(-1.25, 1.35, 0); cola.rotation.z = 0.25; g.add(cola);
    return { g, head, legs, cola, ubre, kind: 'vaca' };
  }
  function makeOveja(carnero) {
    const g = new THREE.Group(); root.add(g);
    const lanaM = LEAF(0xf4f1ea), cara = LEAF(0x3a3632);
    const lanaG = new THREE.Group(); lanaG.position.y = 0.95; g.add(lanaG);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36 + rand() * 0.12, 1), lanaM); m.position.set((i % 3 - 1) * 0.4, (rand() - 0.3) * 0.25, (Math.floor(i / 3) - 1) * 0.28); m.castShadow = true; lanaG.add(m); }
    const pelada = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 3, 8), LEAF(0xe6dccb)); pelada.rotation.z = Math.PI / 2; pelada.position.y = 0.95; g.add(pelada);
    const head = new THREE.Group(); head.position.set(0.72, 1.1, 0); g.add(head);
    const hm = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.38, 0.32, 2, 0.1), cara); hm.position.x = 0.15; head.add(hm);
    for (const sz of [-1, 1]) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.22), cara); o.position.set(0.05, 0.12, sz * 0.24); o.rotation.x = sz * 0.5; head.add(o); }
    if (carnero) for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 6, 12, Math.PI * 1.6), LEAF(0xcdb68a)); c.position.set(0.02, 0.1, sz * 0.2); c.rotation.set(0, sz > 0 ? 0 : Math.PI, 0.3); head.add(c); }
    const legs = [];
    for (const [x, sz] of [[0.4, -1], [0.4, 1], [-0.4, -1], [-0.4, 1]]) {
      const piv = new THREE.Group(); piv.position.set(x, 0.65, sz * 0.18); g.add(piv);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.65, 5), cara); l.position.y = -0.32; piv.add(l); legs.push(piv);
    }
    return { g, head, legs, lanaG, pelada, kind: 'oveja' };
  }
  function makeAve(gallo, color) {
    const g = new THREE.Group(); root.add(g);
    const plum = LEAF(color), cresta = LEAF(0xd8332b), pico = LEAF(0xf2b33d);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), plum); body.scale.set(1.25, 1, 0.95); body.position.y = 0.55; body.castShadow = true; g.add(body);
    const head = new THREE.Group(); head.position.set(0.3, 0.85, 0); g.add(head);
    head.add(Object.assign(new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), plum)));
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, gallo ? 0.16 : 0.08, 0.04), cresta); c.position.set(0, 0.16, 0); head.add(c);
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), pico); b.rotation.z = -Math.PI / 2; b.position.set(0.17, -0.02, 0); head.add(b);
    if (gallo) for (const [i, col] of [[0, 0x2a6b3a], [1, 0x1f3f8a], [2, 0x7a2a1a]]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 4), LEAF(col)); f.position.set(-0.38, 0.75 + i * 0.05, (i - 1) * 0.07); f.rotation.z = 0.9 + i * 0.15; g.add(f); }
    const legs = [];
    for (const sz of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(0, 0.32, sz * 0.1); g.add(piv); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 4), pico); l.position.y = -0.16; piv.add(l); legs.push(piv); }
    g.scale.setScalar(gallo ? 1.25 : 1.05);
    return { g, head, legs, kind: gallo ? 'gallo' : 'gallina' };
  }
  function makePollito() {
    const g = new THREE.Group(); root.add(g);
    const amarillo = LEAF(0xffd84a), pico = LEAF(0xf28c28);
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), amarillo); body.position.y = 0.3; body.castShadow = true; g.add(body);
    const head = new THREE.Group(); head.position.set(0.16, 0.48, 0); g.add(head);
    head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), amarillo));
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), pico); b.rotation.z = -Math.PI / 2; b.position.set(0.14, -0.01, 0); head.add(b);
    const legs = [];
    for (const sz of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(0, 0.16, sz * 0.07); g.add(piv); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 4), pico); l.position.y = -0.08; piv.add(l); legs.push(piv); }
    return { g, head, legs, kind: 'pollito' };
  }
  const COLOR_AVE = [0xf2efe8, 0xb5652d, 0xe9d7a6, 0x8a5a3a];
  const granjaVis = {};
  let colorAve = 0;
  function crearVisGanado(a) {
    const v = a.tipo === 'vaca' ? makeVaca(a.sexo === 'm') : a.tipo === 'oveja' ? makeOveja(a.sexo === 'm') : a.tipo === 'pollito' ? makePollito()
      : makeAve(a.tipo === 'gallo', a.tipo === 'gallo' ? 0xc8442a : COLOR_AVE[colorAve++ % COLOR_AVE.length]);
    Object.assign(v, { vp: null, last: V(0, 0, 0), yaw: rand() * 6, moving: 0, walkPh: rand() * 6, tipoVis: a.tipo, base: v.g.scale.x });
    return v;
  }
  function poseGanado(s, t, dt) {
    for (const a of s.ganado) {
      let v = granjaVis[a.id];
      if (v && v.tipoVis !== a.tipo) { root.remove(v.g); const vp = v.vp; v = granjaVis[a.id] = crearVisGanado(a); v.vp = vp; }   // el pollito ya es gallina o gallo
      if (!v) v = granjaVis[a.id] = crearVisGanado(a);
      const aves = v.kind === 'gallina' || v.kind === 'gallo' || v.kind === 'pollito';
      v.g.scale.setScalar(v.base * (a.crec < 1 ? (aves ? 0.75 : 0.45) + (aves ? 0.25 : 0.55) * a.crec : 1));
      const enCasa = aves && (a.refugio || a.empolla) && Math.hypot(a.pos.x - LUGAR.gallinero.x, a.pos.z - LUGAR.gallinero.z) < 1.8;
      v.g.visible = a.vivo && !enCasa;
      if (!v.g.visible) continue;
      if (!v.vp) v.vp = V(a.pos.x, 0, a.pos.z);
      const tx = a.pos.x - v.vp.x, tz = a.pos.z - v.vp.z;
      if (Math.hypot(tx, tz) > 9) v.vp.set(a.pos.x, 0, a.pos.z); else { const k = 1 - Math.exp(-dt * 6); v.vp.x += tx * k; v.vp.z += tz * k; }
      const dx = v.vp.x - v.last.x, dz = v.vp.z - v.last.z, d = Math.hypot(dx, dz), rap = dt > 0 ? d / dt : 0;
      const moving = rap > 0.12;
      v.moving += ((moving ? 1 : 0) - v.moving) * Math.min(1, dt * 6);
      if (moving) v.yaw = angLerp(v.yaw, yawTo(dx, dz), Math.min(1, dt * 4));
      v.walkPh += Math.min(rap, 4) * dt * (aves ? 9 : 3.2);
      v.last.copy(v.vp);
      v.g.position.set(v.vp.x, aves && v.moving > 0.3 ? Math.abs(Math.sin(v.walkPh)) * 0.05 : 0, v.vp.z);
      v.g.rotation.set(0, v.yaw, 0);
      v.legs.forEach((l, j) => { l.rotation.z = Math.sin(v.walkPh + (j % 2 ? Math.PI : 0) + (j > 1 ? Math.PI / 2 : 0)) * (a.comiendo ? 0.22 : 0.45) * v.moving; });
      if (a.crec < 1 && !aves && !moving) v.g.position.y += Math.max(0, Math.sin(t * 3 + a.pos.x)) * 0.06;   // las crías brincan
      const come = a.comiendo;   // pastan caminando con la cabeza abajo
      if (aves) v.head.rotation.z = come ? -0.9 + Math.max(0, Math.sin(t * 9 + a.pos.x)) * 0.6 : Math.sin(t * 2 + a.pos.z) * 0.15;
      else v.head.rotation.z = come ? -0.75 + Math.sin(t * 1.5) * 0.08 : Math.sin(t * 0.7 + a.pos.x) * 0.1;
      if (v.kind === 'vaca' && a.sexo !== 'm') { v.ubre.scale.setScalar(0.7 + Math.min(1, a.ubre / 12) * 0.7); v.cola.rotation.x = Math.sin(t * 2 + a.pos.z) * 0.3; }
      if (v.kind === 'oveja') { const k2 = Math.min(1, a.lana / 60); v.lanaG.scale.setScalar(0.45 + 0.6 * k2); v.lanaG.visible = a.lana > 6; }
    }
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

  function sitioDe(a, s, t) {
    const T = a.tarea, tp = T?.tipo, i = a.id === 'tomas' ? 0 : 1;
    if (a.tipo === 'humano') {
      if (tp === 'dormir') return SITIO['cama' + i];
      if (tp === 'cocinar' || tp === 'hacerConservas') return SITIO.estufa;
      if (tp === 'hacerQueso') return SITIO.fregadero;
      if (tp === 'cenar' || tp === 'comer') return SITIO['silla' + i];
      if (tp === 'beber' || tp === 'filtrar') return SITIO.fregadero;
      if (tp === 'leer') return i === 0 ? SITIO.sofa0 : SITIO.sillonAlto;
      if (tp === 'tejer') return SITIO.sillon;
      if (tp === 'siesta') return { ...SITIO['sofa' + i], 5: 'siesta' };
      if (tp === 'conversar' || tp === 'reconciliar') return SITIO['sofa' + i];
      if (tp === 'limpiarCasa') return { ...SITIO[LIMPIAR[Math.floor(t / 6 + i * 2) % LIMPIAR.length]], 5: 'limpiar' };
      return SITIO['sala' + i];
    }
    const perro = a.tipo === 'perro';
    if (tp === 'dormir' || tp === 'dormirCon') {
      if (perro) return { ...SITIO.tapete, 5: 'dormido' };
      const h = T.con && s.agentes.find((x) => x.id === T.con);
      return h ? { ...SITIO[h.id === 'tomas' ? 'cama0' : 'cama1'], 2: -3.2, 5: 'dormido' } : { ...SITIO.pieCama, 5: 'dormido' };
    }
    if (tp === 'pedir') return { ...SITIO.estufa, 2: -3.9, 5: 'quieto' };
    if (tp === 'regazo') { const h = s.agentes.find((x) => x.id === T.con); if (h && vis[h.id]?.ip) return { 0: vis[h.id].ip.y > 2 ? 1 : 0, 1: vis[h.id].ip.x + 0.25, 2: vis[h.id].ip.z, 3: 0, 4: 0, 5: 'regazo' }; }
    return perro ? { ...SITIO.tapete, 5: 'quieto' } : { ...SITIO.sofa1, 5: 'quieto' };
  }
  function poseInterior(a, v, s, t, dt) {
    v.g.visible = true;
    const sp = sitioDe(a, s, t), piso = sp[0], destino = V(sp[1], PISO[piso], sp[2]);
    if (!v.dentroAntes) { v.dentroAntes = true; v.ip = V(-3.3, PISO[0], 5.1); v.ruta = []; v.sitioKey = null; }
    const key = destino.toArray().map((n) => n.toFixed(1)).join('|');
    if (key !== v.sitioKey) {
      v.sitioKey = key;
      const actual = v.ip.y > 2 ? 1 : 0;
      v.ruta = actual === piso ? [destino] : [ESCALERA[actual].clone(), ESCALERA[piso].clone(), destino];
    } else if (v.ruta.length) v.ruta[v.ruta.length - 1] = destino;
    let paso = dt * (v.kind === 'humano' ? 2.3 : 3.0), mov = 0;
    while (v.ruta.length && paso > 1e-4) {
      const obj = v.ruta[0], d = v.ip.distanceTo(obj);
      const dx = obj.x - v.ip.x, dz = obj.z - v.ip.z;
      if (Math.hypot(dx, dz) > 0.02) v.yaw = angLerp(v.yaw, yawTo(dx, dz), Math.min(1, dt * 10));
      if (d <= paso) { v.ip.copy(obj); v.ruta.shift(); paso -= d; mov += d; }
      else { v.ip.addScaledVector(obj.clone().sub(v.ip).normalize(), paso); mov += paso; paso = 0; }
    }
    const moving = mov > 1e-3;
    v.moving += ((moving ? 1 : 0) - v.moving) * Math.min(1, dt * 8);
    v.walkPh += (moving ? 2.3 : 0) * dt * (v.kind === 'humano' ? 2.6 : 3.4);
    const w = v.moving, ph = v.walkPh, quieto = !moving && !v.ruta.length;
    let pose = quieto ? sp[5] : 'camina';
    if (quieto && sp[3] != null && pose !== 'acostado' && pose !== 'dormido' && pose !== 'siesta') {
      let lx = sp[3], lz = sp[4];
      const otro = a.tarea && ['conversar', 'reconciliar'].includes(a.tarea.tipo) && s.agentes.find((x) => x !== a && x.tipo === 'humano');
      if (otro && vis[otro.id]?.ip) { lx = vis[otro.id].ip.x; lz = vis[otro.id].ip.z; }
      v.yaw = angLerp(v.yaw, yawTo(lx - v.ip.x, lz - v.ip.z), Math.min(1, dt * 6));
    }
    v.g.position.copy(v.ip); v.g.rotation.set(0, v.yaw, 0);
    if (v.kind === 'humano') {
      v.libro.visible = false; v.pieza.visible = false;
      v.upper.rotation.set(0, 0, 0); v.head.rotation.set(0, 0, 0);
      if (pose === 'acostado' || pose === 'siesta') {
        // tendido: en la cama con la cabeza hacia la cabecera; la siesta, a lo largo del sofá
        const cama = pose === 'acostado';
        const yaw = cama ? Math.PI / 2 : 0, fwd = cama ? V(0, 0, -1) : V(1, 0, 0);
        v.g.position.set(cama ? v.ip.x : 1.35, PISO[piso] + (cama ? 0.66 : 0.62), cama ? -5.15 + v.h : 4.5).addScaledVector(fwd, cama ? 0 : 0);
        v.g.rotation.set(0, yaw, -Math.PI / 2);
        v.legs.forEach((l) => { l.hip.rotation.z = 0; l.knee.rotation.z = 0; });
        v.arms.forEach((arm, j) => arm.rotation.set(0, 0, 0.15));
        v.head.rotation.set(0, 0, 0.3);
        return;
      }
      const sentado = pose === 'sentado' ? 1 : 0;
      v.g.position.y = PISO[piso] - sentado * (v.h - 0.85) + Math.abs(Math.sin(ph)) * 0.04 * w;
      v.legs.forEach((l, j) => {
        const sw = Math.sin(ph + j * Math.PI) * w;
        l.hip.rotation.z = sw * 0.55 + sentado * Math.PI / 2 + (pose === 'limpiar' ? 0.25 : 0);
        l.knee.rotation.z = -Math.max(0, -sw) * 0.7 - sentado * Math.PI / 2 - (pose === 'limpiar' ? 0.45 : 0);
      });
      const tp = a.tarea?.tipo;
      const trabaja = pose === 'trabajo' || pose === 'limpiar';
      v.upper.rotation.set(0, 0, trabaja ? -0.25 : sentado && (tp === 'leer' || tp === 'tejer') ? -0.2 : 0);
      if (pose === 'limpiar') v.upper.rotation.z = -0.55;
      v.arms.forEach((arm, j) => {
        let z = -Math.sin(ph + j * Math.PI) * 0.45 * w + sentado * 0.5;
        if (trabaja) z = 0.9 + Math.sin(t * 6 + j * Math.PI) * 0.3;
        if (sentado && (tp === 'cenar' || tp === 'comer') && j) z = 0.9 + Math.max(0, Math.sin(t * 3)) * 0.5;   // lleva el tenedor a la boca
        if (sentado && tp === 'leer') z = 1.0;
        if (sentado && tp === 'tejer') z = 1.0 + Math.sin(t * 8 + j * Math.PI) * 0.12;
        if (sentado && (tp === 'conversar' || tp === 'reconciliar') && j) z = 0.5 + Math.max(0, Math.sin(t * 1.3 + a.id.length)) * 0.7;
        arm.rotation.set(0, 0, z);
      });
      v.libro.visible = quieto && tp === 'leer';
      v.head.rotation.set(0, 0, sentado && (tp === 'leer' || tp === 'tejer') ? -0.35 : trabaja ? -0.3 : 0);
    } else {
      const dormido = pose === 'dormido', sentado = pose === 'quieto' || pose === 'regazo';
      const sobre = pose === 'regazo' ? 0.55 : dormido && a.tipo === 'gato' && piso === 1 ? 0.62 : 0;   // en el regazo o sobre la cama
      v.g.position.y = PISO[piso] + sobre + Math.abs(Math.sin(ph)) * 0.05 * w - (dormido ? 0.25 : 0);
      v.torso.rotation.z = sentado && !dormido ? 0.5 : 0;
      v.head.rotation.set(0, 0, sentado ? -0.25 : 0);
      v.legs.forEach((l) => {
        let r = w * Math.sin(ph + (l.front ? 0 : Math.PI) + (l.side > 0 ? Math.PI : 0)) * 0.6;
        if (!l.front) r += -(sentado ? 1.2 : 0) - (dormido ? 1.4 : 0); else r += -(sentado ? 0.5 : 0) - (dormido ? 1.3 : 0);
        l.piv.rotation.z = r;
      });
      v.tail.rotation.x = Math.sin(t * (v.kind === 'perro' ? 9 : 2.5)) * (dormido ? 0.05 : 0.35);
    }
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
    if (a.dentro) { poseInterior(a, v, s, t, dt); return; }   // adentro: se ve a través de la casa transparente
    if (v.dentroAntes) { v.dentroAntes = false; v.vp = V(a.pos.x, 0, a.pos.z); }
    const hidden = false;
    v.g.visible = true;
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
      if (abrazando || tp === 'conversar' || tp === 'reconciliar') f = otroH ? otroH.pos : null;
      else if (tp === 'ordenar') f = s.ganado.find((g) => g.tipo === 'vaca')?.pos;
      else if (tp === 'esquilar') f = s.ganado.find((g) => g.id === T.oveja)?.pos;
      else if (tp === 'alimentarGanado') f = LUGAR.pesebre;
      else if (tp === 'recogerHuevos') f = LUGAR.gallinero;
      else if (T.parcela != null) f = s.parcelas[T.parcela];
      else if (tp === 'sacarAgua') f = LUGAR.pozo;
      else if (tp === 'jugarGato') f = s.agentes.find((x) => x.tipo === 'gato')?.pos;
      else if (tp === 'jugarPerro') f = s.agentes.find((x) => x.tipo === 'perro')?.pos;
      else if (tp === 'curar') f = s.ganado.find((g) => g.id === T.animal)?.pos;
      else if (tp === 'reparar') f = LUGAR.taller;
      else if (tp === 'recogerFruta') f = s.frutales?.[T.arbol];
      else if (tp === 'construir') { const o = OBRAS.find((x) => x[0] === T.obra); if (o) f = { x: o[3], z: o[4] }; }
      else if (tp === 'cuidarJardin') f = s.jardines?.[T.jardin];
      else if (tp === 'secar') { const o = OBRAS.find((x) => x[0] === 'secadero'); f = { x: o[3], z: o[4] }; }
      else if (tp === 'alimentar' || ((tp === 'comer' || tp === 'beber') && v.kind !== 'humano')) f = LUGAR.comedero;
      else if (['descansar', 'leer', 'siesta', 'tallar', 'tejer'].includes(tp)) v.yaw = angLerp(v.yaw, -Math.PI / 2, Math.min(1, dt * 5));
      else if (tp === 'contemplar') v.yaw = angLerp(v.yaw, -Math.PI / 4, Math.min(1, dt * 4));
      else if (v.kind !== 'humano' && tp === 'jugar') { const hh = s.agentes.find((x) => x.id === T.con); if (hh) f = hh.pos; }
      if (f) v.yaw = angLerp(v.yaw, yawTo(f.x - a.pos.x, f.z - a.pos.z), Math.min(1, dt * 6));
    }
    v.last.copy(v.vp);
    v.g.position.set(v.vp.x, 0, v.vp.z);
    v.g.rotation.set(0, v.yaw, 0);
    const w = v.moving, ph = v.walkPh;
    if (v.kind === 'humano' && a.nadando) {
      const fwd = V(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
      v.g.position.set(v.vp.x, -0.32, v.vp.z).addScaledVector(fwd, -1.05 * v.h);
      v.g.rotation.set(0, v.yaw, -Math.PI / 2);
      const brazada = t * 5 + a.id.length;
      v.arms[0].rotation.set(0, 0, brazada); v.arms[1].rotation.set(0, 0, brazada + Math.PI);
      v.legs.forEach((l, j) => { l.hip.rotation.z = Math.sin(t * 10 + j * Math.PI) * 0.3; l.knee.rotation.z = 0; });
      v.upper.rotation.set(0, 0, 0); v.head.rotation.set(0, 0, 0.5);
      v.libro.visible = v.pieza.visible = false;
      return;
    }
    if (v.kind === 'humano') {
      const tipo = trabajando ? T.tipo : null;
      const sit = ['descansar', 'leer', 'siesta', 'tallar', 'tejer', 'esculpir'].includes(tipo) ? 1 : 0;
      const asiento = tipo === 'tallar' || tipo === 'esculpir' ? 0.5 : 0.85;
      const agachado = tipo === 'jugarGato' || tipo === 'ordenar' || tipo === 'jugarPerro' || tipo === 'curar';
      const bend = ['construir', 'cuidarJardin', 'secar', 'recogerFruta', 'regar', 'sembrar', 'cosechar', 'limpiar', 'sacarAgua', 'alimentar', 'jugarGato', 'ordenar', 'esquilar', 'segar', 'alimentarGanado', 'recogerHuevos', 'reparar', 'curar', 'recogerFlores', 'jugarPerro'].includes(tipo) ? 1 : 0;
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
      const lee = tipo === 'leer' || tipo === 'tallar' || tipo === 'tejer';
      const inclin = tipo === 'sembrar' || tipo === 'cosechar' || tipo === 'limpiar' ? 0.75 : agachado ? 0.2 : lee ? 0.25 : 0.35;
      v.upper.rotation.set(zancada ? 0 : -Math.sin(ph) * 0.05 * w, zancada ? Math.sin(ph) * 0.14 * w : 0, -(bend || lee ? inclin : 0) - encorvado);
      const work = Math.sin(t * (tipo === 'sacarAgua' ? 3 : 6));
      const habla = tipo === 'conversar' || tipo === 'reconciliar' ? Math.max(0, Math.sin(t * 1.3 + a.id.length)) : 0;
      v.arms.forEach((arm, j) => {
        const sw = -Math.sin(ph + j * Math.PI) * 0.45 * w;
        let z = sw + sit * 0.5, x = 0;
        if (bend) z += tipo === 'regar' ? 0.9 : tipo === 'sacarAgua' ? 1.6 + work * 0.6 * (j ? 1 : -1) : agachado ? 0.7 + Math.max(0, Math.sin(t * 5)) * 0.6 * j : 0.9 + work * 0.35 * (j ? 1 : -1);
        if (tipo === 'leer') z = 1.0;
        if (tipo === 'tallar' || tipo === 'esculpir') z = 0.9 + (j ? Math.sin(t * 7) * 0.25 : 0);
        if (tipo === 'contemplar') { z = -0.35; x = (j ? 1 : -1) * 0.15; }   // manos atrás
        if ((tipo === 'conversar' || tipo === 'reconciliar') && j) z = 0.5 + habla * 0.7;              // gesticula al hablar
        if (abrazando) { z = 1.35; x = (j ? -1 : 1) * 0.45; }
        arm.rotation.set(x, 0, z);
      });
      if (tipo === 'tejer') v.arms.forEach((arm, j) => arm.rotation.set(0, 0, 1.0 + Math.sin(t * 8 + j * Math.PI) * 0.12));
      v.libro.visible = tipo === 'leer';
      v.pieza.visible = tipo === 'tallar' || tipo === 'esculpir';
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
  camera.position.sub(controls.target).setLength(150 * Math.max(1, 1.2 / camera.aspect)).add(controls.target);

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
    key.position.copy(CENTER).addScaledVector(dir, 60);
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
        if (y < 0.1) y = 40 + Math.random() * 3;
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
    poseGanado(s, t, dt);
    pastoMat.color.setHSL(0.18 + Math.min(1, s.granja.pasto / 100) * 0.1, 0.45, 0.28 + Math.min(1, s.granja.pasto / 100) * 0.08);
    matas.scale.y = 0.3 + Math.min(1, s.granja.pasto / 100) * 0.9;
    pacas.forEach((m, i) => { m.visible = s.rec.heno > i * 22; });
    pesebreHeno.scale.y = Math.max(0.05, Math.min(1, s.rec.pesebre / 10)); pesebreHeno.visible = s.rec.pesebre > 0.2;
    aguaGanado.visible = s.rec.bebederoGanado > 2;
    granos.visible = s.rec.grano > 0.1;
    waterMat.uniforms.uTime.value = t; waterMat.uniforms.uTop.value.copy(pal.top); waterMat.uniforms.uHor.value.copy(pal.hor);
    waterMat.uniforms.uDay.value = day; waterMat.uniforms.uNight.value = night; waterMat.uniforms.uSun.value.copy(sunPos).sub(POOL_C).normalize();
    poolLight.intensity = 9 * night;
    const arco = s.clima.arcoiris > s.t ? Math.min(1, (s.clima.arcoiris - s.t) / 30) * Math.min(1, (100 - (s.clima.arcoiris - s.t)) / 15) : 0;
    arcoiris.visible = arco > 0.01; arcMats.forEach((m) => { m.opacity = arco * 0.55; });
    comida.visible = s.rec.comedero > 0.05; comida.scale.set(1.2, 0.3 + Math.min(1, s.rec.comedero / 2) * 0.5, 1.2);
    aguaBowl.visible = s.rec.bebedero > 0.2;
    for (const tr of trees) { tr.crown.rotation.z = Math.sin(t * 0.9 + tr.phase) * 0.02 * (1 + lluviaK); }
    (s.jardines || []).forEach((j, i) => {
      const v = jardinesVis[i]; if (!v) return;
      const f = Math.max(0, Math.min(1, j.flores));
      v.flores.forEach((fl, k) => { const umbral = (k % 13) / 13; const vivo = f > umbral * 0.9; fl.visible = vivo; if (vivo) fl.scale.setScalar(0.4 + f * 0.8); fl.rotation.z = Math.sin(t * 1.4 + k + v.fase) * 0.08; });
    });
    for (const o of s.obras || []) {
      const v = obrasVis[o.id]; if (!v) continue;
      v.g.visible = o.progreso > 0.001;
      v.andamio.visible = o.progreso > 0 && o.progreso < 1;
      v.cuerpo.scale.set(1, Math.max(0.05, o.progreso), 1);
    }
    esculturasVis.forEach((g, i) => { g.visible = i < (s.esculturas || 0); });
    (s.frutales || []).forEach((f, i) => { const v = frutales[i]; if (!v) return; v.frutas.forEach((m, k) => { m.visible = k < Math.floor(f.fruta); }); v.copa.rotation.z = Math.sin(t * 0.9 + v.fase) * 0.02 * (1 + lluviaK); });

    // la casa se vuelve transparente cuando hay alguien adentro
    const adentro = s.agentes.some((x) => x.vivo && x.dentro);
    casaK += ((adentro ? 1 : 0) - casaK) * Math.min(1, dt * 3);
    for (const tr of transparentables) {
      const op = 1 - casaK * (1 - tr.min), trans = op < 0.995;
      if (tr.mat.transparent !== trans) { tr.mat.transparent = trans; tr.mat.depthWrite = !trans; tr.mat.needsUpdate = true; }
      tr.mat.opacity = op;
      for (const m of tr.mallas) { m.visible = op > 0.02; m.castShadow = op > 0.6; }
    }
    const cocinando = s.agentes.some((x) => x.tarea?.tipo === 'cocinar' && x.dentro);
    if (hornillas) hornillas.emissiveIntensity = cocinando ? 1.6 + Math.sin(t * 9) * 0.3 : 0;
    if (fuego) fuego.emissiveIntensity = (night > 0.4 || s.clima.lluvia || (s.t / MIN_DIA / 28 | 0) % 4 === 3) ? 1.8 + Math.sin(t * 7) * 0.4 + Math.sin(t * 13) * 0.2 : 0;
    for (const a of s.agentes) poseAgente(a, vis[a.id], s, t, dt);
    efectos(s, dt);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // ------------------------------------------------------------ efectos flotantes: corazones, charla, discusión, kikirikí
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const efectosVis = new Map();
  const EMOJI_EF = { corazones: '💞', charla: '💬', discusion: '💢', kikiriki: '🐓', ladrido: '🐕💥' };
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

  // encuadre: deja espacio a los lados para las columnas de datos
  function encuadrar(margenIzq, margenDer, margenAbajo = 0) {
    const W = renderer.domElement.clientWidth || innerWidth, H = renderer.domElement.clientHeight || innerHeight;
    camera.clearViewOffset();
    if (margenIzq || margenDer || margenAbajo) camera.setViewOffset(W, H, (margenDer - margenIzq) / 2, margenAbajo / 2, W, H);
    camera.updateProjectionMatrix();
    const utilW = Math.max(0.35, (W - margenIzq - margenDer) / W), utilH = Math.max(0.35, (H - margenAbajo) / H);
    const halfV = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * utilH);
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * utilW);
    const dist = (ORB_R + 6) / Math.sin(Math.min(halfV, halfH));
    camera.position.sub(controls.target).setLength(dist).add(controls.target);
  }


  return {
    update,
    seleccionar(i) { seleccion = i; },
    encuadrar,
    get cargada() { return cargada; },
  };
}
