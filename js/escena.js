// =====================================================================
// Escena 3D de la granja: orbe de vidrio con la casa, el huerto, el pozo,
// el tanque y los personajes. Solo DIBUJA el estado de la simulación.
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { montarUtileria } from './utileria.js';
import { armarPerro, armarGato } from './mascotas3d.js';
import { montarFemenino } from './femenino.js';
import { crearLotes } from './lotes.js';
import { construirDiseno } from './disenos.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MIN_DIA, CULTIVOS, LUGAR, TANQUE_MAX, PERSONAJES, BLOQUE, CORRAL, GALLINERO, PISCINA, GANADO, FRUTALES, JARDINES, OBRAS, ESCULTURAS, PARRAS, MATAS, SOMBRAS, LUGAR_GYM, etapaDe, CAMINOS, largoCamino, puntoCamino } from './sim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = THREE.MathUtils.smoothstep;
const ease = (t) => t * t * (3 - 2 * t);
const rand = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const angLerp = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
const yawTo = (dx, dz) => Math.atan2(-dz, dx);

export function crearEscena(host, { onParcela, onAgente } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const tactil = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, tactil ? 1.6 : 1.25));   // en el celular las pantallas son densas: menos que esto se ve borroso
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; 
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
  controls.enableDamping = true;
  // desplazarse: arrastre con dos dedos (celular), clic derecho o Mayús + arrastre (computador) o flechas del teclado
  controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 1.1; controls.keyPanSpeed = 24;
  controls.listenToKeyEvents(window);
  controls.minDistance = 4; controls.maxDistance = 380; controls.zoomToCursor = true;   // acercarse hacia donde apunta el mouse, hasta ver a los personajes de cerca
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.target.set(CENTER.x, 3, CENTER.z);
  camera.position.set(78, 60, 120);

  const root = new THREE.Group(); scene.add(root);
  const lotes = crearLotes(scene);   // junta lo quieto en pocas mallas (menos llamadas de dibujo)

  // ------------------------------------------------------------ luces y paleta
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -54, right: 54, top: 54, bottom: -54, near: 1, far: 200 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
  scene.add(key, key.target); key.target.position.copy(CENTER);
  // anillo de luces de relleno en el borde del terreno (sin sombras): que las orillas del orbe no queden oscuras
  const relleno = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2, l = new THREE.PointLight(0xfff1dc, 0, 34, 1.6); l.position.set(CENTER.x + Math.cos(a) * 40, 11, CENTER.z + Math.sin(a) * 40); scene.add(l); return l; });
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
  const PASTO_BASE = new THREE.Color(0x6f9a44), ESCARCHA = new THREE.Color(0xd8e6ee);
  const pastoTerreno = new THREE.MeshStandardMaterial({ color: PASTO_BASE.clone(), roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 });
  const enTerreno = (x, z, m = 0) => Math.hypot(x - CENTER.x, z - CENTER.z) < RT - m;
  {
    const capa = (r0, r1, h, y, color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 128), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
      m.position.set(CENTER.x, y, CENTER.z); m.receiveShadow = true; root.add(m); return m;
    };
    {
      const forma = new THREE.Shape(); forma.absarc(CENTER.x, -CENTER.z, RT - 0.12, 0, Math.PI * 2, false);
      const hueco = new THREE.Path(), b = 0.12;
      hueco.moveTo(PISCINA.x0 - b, -(PISCINA.z0 - b)); hueco.lineTo(PISCINA.x1 + b, -(PISCINA.z0 - b)); hueco.lineTo(PISCINA.x1 + b, -(PISCINA.z1 + b)); hueco.lineTo(PISCINA.x0 - b, -(PISCINA.z1 + b)); hueco.lineTo(PISCINA.x0 - b, -(PISCINA.z0 - b));
      forma.holes.push(hueco);
      const g = new THREE.ExtrudeGeometry(forma, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 96 });
      g.rotateX(-Math.PI / 2); g.translate(0, -0.67, 0);
      const pasto = new THREE.Mesh(g, pastoTerreno);
      pasto.receiveShadow = true; root.add(pasto);   // sin castShadow: el suelo plano haciéndose sombra a sí mismo titila
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
  let cargada = false, casaK = 0, alturaTecho = 9.5;
  const transparentables = [];   // paredes, techo, losa, puertas y marcos: se desvanecen cuando hay alguien adentro
  const MIN_OPAC = { Techo: 0, Pared: 0.16, Losa: 0.45, Puerta: 0.25, Marco: 0.3 };

  // ------------------------------------------------------------ estilo: la casa y toda la granja adoptan el que se elija
  const PALETA = {
    rustico: { pared: 0xcdbb9c, techo: 0x6b5a4a, marco: 0x4a3020, losa: 0xd8cfbf, acento: 0x8a6a4a, forma: 'dosAguas', pend: 0.55, alero: 0.4, baranda: 'madera' },
    mediterranea: { pared: 0xf6f3ec, techo: 0xe6dfd2, marco: 0x2f5d8a, losa: 0xe9e3d6, acento: 0xc96f3b, forma: 'plano', alero: 0.15, baranda: 'vidrio' },
    nordica: { pared: 0x2f3337, techo: 0x1f2124, marco: 0xc9a274, losa: 0x3a3e43, acento: 0xb08a5c, forma: 'dosAguas', pend: 1.0, alero: 0.3, baranda: 'vidrio' },
    tropical: { pared: 0xbdb8ad, techo: 0x5a3d22, marco: 0x2b2d31, losa: 0xa9a49a, acento: 0x9b6b3d, forma: 'aleroPlano', alero: 1.6, baranda: 'vidrio' },
    asiatica: { pared: 0xeee6d4, techo: 0x2e3838, marco: 0x6b2a1a, losa: 0xd8cdb5, acento: 0x7a3a22, forma: 'pagoda', alero: 1.2, baranda: 'madera' },
    americana: { pared: 0xf1ede4, techo: 0x3f4348, marco: 0x2b2d31, losa: 0xe1dbcf, acento: 0xa3322a, forma: 'dosAguas', pend: 0.75, alero: 0.45, baranda: 'madera', porche: true },
  };
  const TEMA_GRANJA = {
    rustico: { muro: 0xb5643a, granero: 0xa63b2c, techo: 0x4a3a32, madera: 0x7a4e2b, cerca: 0x9a7350 },
    mediterranea: { muro: 0xf3efe6, granero: 0xeee8dc, techo: 0xc4683a, madera: 0x9a7a58, cerca: 0xefeadf },
    nordica: { muro: 0x3b3f44, granero: 0x7a2a22, techo: 0x232528, madera: 0x5a4636, cerca: 0x3a3e42 },
    tropical: { muro: 0xa86f3e, granero: 0xb2ada2, techo: 0x5a3d22, madera: 0x9b6b3d, cerca: 0x7a5a3a },
    asiatica: { muro: 0xe9dfcc, granero: 0x8a3a22, techo: 0x2f3a3a, madera: 0x6b3a26, cerca: 0x9a8a4a },
    americana: { muro: 0xf2efe8, granero: 0xa3322a, techo: 0x4b4f55, madera: 0x8a6a4a, cerca: 0xf4f2ec },
  };
  // materiales compartidos por todas las construcciones de la granja: al cambiar el estilo solo cambian de color
  const TEMA = Object.fromEntries(['muro', 'granero', 'techo', 'madera', 'cerca'].map((k) => [k, new THREE.MeshStandardMaterial({ color: TEMA_GRANJA.rustico[k], roughness: 0.85, flatShading: true })]));
  let temaActual = 'rustico';
  function aplicarTema(est) { temaActual = est; for (const [k, m] of Object.entries(TEMA)) m.color.set(TEMA_GRANJA[est]?.[k] ?? TEMA_GRANJA.rustico[k]); }

  // ------------------------------------------------------------ la casa por piezas: crece y se moderniza con cada mejora
  const casaRoot = new THREE.Group(); root.add(casaRoot);
  let casaClave = '';
  const HX0 = -6.2, HX1 = 6.2, HZ0 = -6.3, HZ1 = 6.3, Y1 = 4.05, Y2 = 4.31, Y3 = 8.1;
  const andamioCasa = new THREE.MeshStandardMaterial({ color: 0xc9a46c, roughness: 0.9 });
  function construirCasa(s) {
    const K = s.casa || {}, hechos = new Set(K.mejoras || []), obra = K.obra;
    const est = vistaPrevia.casa || (hechos.has('fachada') || s.diseno?.casa ? (K.estilo || 'rustico') : 'rustico'), P = PALETA[est] || PALETA.rustico;
    const parte = (id) => (hechos.has(id) ? 1 : obra?.id === id ? Math.max(0.06, obra.progreso) : 0);
    casaRoot.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    casaRoot.clear(); transparentables.length = 0; windows.length = 0;
    const mk = (nombre, color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }); m.name = nombre; return m; };
    const viejo = new THREE.Color(P.techo).lerp(new THREE.Color(0x6b5e52), 0.45).getHex();
    const mPared = mk('Pared', P.pared), mAcento = mk('Pared', P.acento), mTecho = mk('Techo', hechos.has('techo') || est === 'rustico' ? P.techo : viejo, { side: THREE.DoubleSide });
    const mLosa = mk('Losa', P.losa), mPuerta = mk('Puerta', P.acento, { side: THREE.DoubleSide }), mMarco = mk('Marco', P.marco, { side: THREE.DoubleSide });
    const caja = (w, h, d, mat, x, y, z, g = casaRoot) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    const vidrio = (op = 0.45) => { const m = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: op, emissive: 0xffb45e, emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false }); windows.push({ mat: m, on: -0.02 - rand() * 0.12 }); return m; };
    // ventana con marco sobre un muro (nx, nz: hacia dónde mira el muro)
    function ventana(x, y, z, w, h, nx, nz, g = casaRoot) {
      const q = new THREE.Group(); q.position.set(x + nx * 0.13, y, z + nz * 0.13); if (nx) q.rotation.y = Math.PI / 2; g.add(q);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), vidrio()); v.castShadow = false; q.add(v);
      for (const [fw, fh, fx, fy] of [[w + 0.16, 0.1, 0, h / 2], [w + 0.16, 0.1, 0, -h / 2], [0.1, h, -w / 2, 0], [0.1, h, w / 2, 0]]) caja(fw, fh, 0.1, mMarco, fx, fy, 0, q);
      if (w > 2.5) caja(0.07, h, 0.08, mMarco, 0, 0, 0, q);   // parteluz de los ventanales
    }
    // muros: planta baja y alta (cáscaras delgadas: el interior queda a la vista al desvanecerse)
    const muros = (y0, y1) => { const h = y1 - y0, yc = (y0 + y1) / 2; caja(HX1 - HX0, h, 0.2, mPared, 0, yc, HZ1); caja(HX1 - HX0, h, 0.2, mPared, 0, yc, HZ0); caja(0.2, h, HZ1 - HZ0, mPared, HX0, yc, 0); caja(0.2, h, HZ1 - HZ0, mPared, HX1, yc, 0); };
    muros(0, Y1); caja(HX1 - HX0 + 0.3, Y2 - Y1, HZ1 - HZ0 + 0.3, mLosa, 0, (Y1 + Y2) / 2, 0); muros(Y2, Y3);
    if (est === 'nordica' || est === 'tropical') for (let k = 0; k < 9; k++) caja(0.08, Y3 - 0.2, 0.06, mAcento, HX0 + 0.7 + k * 0.62, (Y3 - 0.2) / 2, HZ1 + 0.12);   // listones de madera
    if (est === 'americana') for (let y = 0.5; y < Y3; y += 0.45) caja(HX1 - HX0 + 0.06, 0.05, 0.05, mk('Pared', 0xd9d4c8), 0, y, HZ1 + 0.11);   // tablas horizontales
    // puertas
    caja(1.6, 3.2, 0.08, mPuerta, -3.3, 1.6, HZ1 + 0.13); caja(1.6, 3.2, 0.08, mPuerta, 3.7, 1.6, HZ0 - 0.13);
    // ventanas: pequeñas al principio; ventanales cuando se invierte en ellos
    const vent = parte('ventanales') >= 1;
    if (vent) { ventana(2.6, 1.75, HZ1, 4.4, 3.0, 0, 1); ventana(1.4, 6.2, HZ1, 6.2, 3.0, 0, 1); ventana(HX1, 6.2, 0, 7.0, 3.0, 1, 0); ventana(HX1, 1.9, 2.8, 4.2, 2.8, 1, 0); }
    else { for (const x of [0.8, 3.6]) ventana(x, 2.0, HZ1, 1.3, 1.5, 0, 1); for (const x of [-2.5, 1.5]) ventana(x, 6.1, HZ1, 1.3, 1.5, 0, 1); for (const z of [-3, 3]) { ventana(HX1, 2.0, z, 1.3, 1.5, 1, 0); ventana(HX1, 6.1, z, 1.3, 1.5, 1, 0); } }
    ventana(-1.5, 2.0, HZ0, 1.3, 1.5, 0, -1); ventana(HX0, 6.1, -1, 1.3, 1.5, -1, 0); ventana(HX0, 2.0, -2.2, 1.3, 1.5, -1, 0);
    // techo según el estilo
    const W = HX1 - HX0, D = HZ1 - HZ0, A = P.alero;
    let techoAlto = Y3 + 0.4, pendTecho = 0;
    if (P.forma === 'dosAguas') {
      const h = (D / 2) * P.pend, th = Math.atan(h / (D / 2)), hz = D / 2 + A, L = hz / Math.cos(th);
      for (const sg of [1, -1]) { const r = caja(W + 2 * A, 0.22, L, mTecho, 0, Y3 + h - (hz / 2) * Math.tan(th), sg * hz / 2); r.rotation.x = sg * th; }
      const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, h); tri.lineTo(-D / 2, 0);
      for (const x of [HX0, HX1]) { const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), mPared); m.rotation.y = Math.PI / 2; m.position.set(x, Y3, 0); m.material.side = THREE.DoubleSide; casaRoot.add(m); }
      techoAlto = Y3 + h; pendTecho = th;
      if (est === 'americana' || est === 'rustico') caja(0.7, 1.6, 0.7, mk('Pared', 0x8a5a44), -3.8, Y3 + h * 0.6 + 0.5, -2.2);   // chimenea
    } else if (P.forma === 'plano') {
      caja(W + 2 * A, 0.3, D + 2 * A, mTecho, 0, Y3 + 0.15, 0);
      for (const [w, d, x, z] of [[W + 0.3, 0.2, 0, HZ1], [W + 0.3, 0.2, 0, HZ0], [0.2, D, HX0, 0], [0.2, D, HX1, 0]]) caja(w, 0.7, d, mPared, x, Y3 + 0.65, z);
      techoAlto = Y3 + 0.3;
    } else if (P.forma === 'aleroPlano') {
      const r = caja(W + 2 * A, 0.24, D + 2 * A, mTecho, 0, Y3 + 0.35, 0); r.rotation.x = 0.06;
      caja(W + 2 * A, 0.32, 0.1, mAcento, 0, Y3 + 0.3, (D / 2 + A) * Math.cos(0.06) - 0.05);
      caja(W - 1, 0.5, D - 1, mPared, 0, Y3 + 0.0, 0);
      techoAlto = Y3 + 0.5;
    } else if (P.forma === 'pagoda') {
      const R = (D / 2 + A) * Math.SQRT2, hp = 3.2;
      const c = new THREE.Mesh(new THREE.ConeGeometry(R, hp, 4, 1, true), mTecho); c.rotation.y = Math.PI / 4; c.scale.set((W + 2 * A) / (D + 2 * A), 1, 1); c.position.set(0, Y3 + hp / 2, 0); c.castShadow = true; casaRoot.add(c);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 5), mTecho); k.position.set(sx * (W / 2 + A), Y3 + 0.3, sz * (D / 2 + A)); k.rotation.set(sz * 0.6, 0, -sx * 0.6); casaRoot.add(k); }   // aleros curvos
      caja(0.3, 0.6, 0.3, mAcento, 0, Y3 + hp + 0.1, 0);
      techoAlto = Y3 + hp; pendTecho = Math.atan(hp / (D / 2 + A));
    }
    alturaTecho = techoAlto + (P.forma === 'plano' ? 0.75 : 0.05);
    // porche de la granja americana
    if (P.porche) { caja(7.2, 0.12, 2.6, mLosa, -2.2, 0.06, HZ1 + 1.3); const r = caja(7.4, 0.14, 2.8, mTecho, -2.2, 3.4, HZ1 + 1.3); r.rotation.x = -0.12; for (const x of [-5.6, -2.2, 1.2]) caja(0.2, 3.3, 0.2, mPared, x, 1.65, HZ1 + 2.5); }
    // terraza alta (sobre el porche o el estudio)
    const kT = parte('terraza');
    if (kT) {
      const g = new THREE.Group(); g.position.y = Y1; g.scale.y = kT; casaRoot.add(g);
      caja(6.0, 0.26, D + 0.3, mLosa, 9.2, 0.13, 0, g);
      if (P.baranda === 'vidrio') { const mv = vidrio(0.3); for (const [w, d, x, z] of [[6, 0.05, 9.2, HZ1], [6, 0.05, 9.2, HZ0], [0.05, D, 12.2, 0]]) caja(w, 1.15, d, mv, x, 0.85, z, g).castShadow = false; }
      else for (const [w, d, x, z] of [[6, 0.1, 9.2, HZ1], [6, 0.1, 9.2, HZ0], [0.1, D, 12.2, 0]]) { caja(w, 0.1, d, mMarco, x, 1.35, z, g); caja(w, 0.08, d, mMarco, x, 0.75, z, g); }
      ventana(HX1, 2.2, 0, 2.0, 3.0, 1, 0, g);   // puerta de la terraza
      if (!hechos.has('ampliacion')) for (const z of [HZ0 + 0.2, 0, HZ1 - 0.2]) caja(0.35, Y1, 0.35, mPared, 11.9, Y1 / 2, z);   // columnas
    }
    // estudio bajo la terraza
    const kA = parte('ampliacion');
    if (kA) {
      const g = new THREE.Group(); g.scale.y = kA; casaRoot.add(g);
      caja(6.0, Y1, 0.2, mPared, 9.2, Y1 / 2, HZ1, g); caja(6.0, Y1, 0.2, mPared, 9.2, Y1 / 2, HZ0, g); caja(0.2, Y1, D, mPared, 12.2, Y1 / 2, 0, g);
      if (!kT) caja(6.3, 0.26, D + 0.3, mTecho, 9.2, Y1 + 0.13, 0, g);
      ventana(9.2, 1.8, HZ1, 3.6, 2.4, 0, 1, g); ventana(12.2, 1.9, -2, 3.0, 2.2, 1, 0, g); ventana(12.2, 1.9, 2.5, 3.0, 2.2, 1, 0, g);
      // adentro: escritorio, sillón y plantas
      const madera = new THREE.MeshStandardMaterial({ color: 0x9a6b42, roughness: 0.8 });
      caja(2.0, 0.08, 0.9, madera, 10.6, 0.8, -4.6, g); for (const [x, z] of [[9.7, -5], [11.5, -5], [9.7, -4.2], [11.5, -4.2]]) caja(0.07, 0.8, 0.07, madera, x, 0.4, z, g);
      caja(1.1, 0.5, 1.0, new THREE.MeshStandardMaterial({ color: 0x8f6a4a }), 10.8, 0.3, 3.8, g);
      for (const [x, z] of [[7, 5.4], [11.6, 0]]) { caja(0.5, 0.5, 0.5, mAcento, x, 0.25, z, g); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x4f8a34, flatShading: true })); pl.position.set(x, 0.95, z); g.add(pl); }
    }
    // paneles solares (y cisterna junto al tanque)
    const kS = parte('solar');
    if (kS) {
      const g = new THREE.Group(); casaRoot.add(g);
      const panel = new THREE.MeshStandardMaterial({ color: 0x1f3b63, roughness: 0.25, metalness: 0.4 }), marco = new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.7, roughness: 0.3 });
      const n = Math.max(1, Math.round(8 * kS));
      for (let i = 0; i < n; i++) { const x = -4.2 + (i % 4) * 2.2, z = Math.floor(i / 4) * 1.9; caja(2.0, 0.06, 1.7, panel, x, 0, z, g); caja(2.06, 0.03, 1.76, marco, x, -0.04, z, g); }
      if (pendTecho && P.forma !== 'pagoda') { g.rotation.x = -pendTecho; g.position.set(0, Y3 + (techoAlto - Y3) * 0.5 + 0.2, (D / 4) - 0.2); }
      else if (P.forma === 'pagoda') { g.rotation.x = -pendTecho; g.position.set(0, Y3 + 1.0, D / 4 + 0.3); g.scale.setScalar(0.7); }
      else { g.rotation.x = -0.3; g.position.set(-0.5, techoAlto + 0.5, -1.2); }
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.4 * kS, 20), new THREE.MeshStandardMaterial({ color: 0x6b7a84, roughness: 0.5, metalness: 0.3 })); c.position.set(10.9, 1.2 * kS, 8.9); c.castShadow = true; casaRoot.add(c);
    }
    // azotea: pérgola en los techos planos; buhardilla con balcón en los de dos aguas; linterna en la pagoda
    const kZ = parte('azotea');
    if (kZ) {
      const g = new THREE.Group(); g.scale.y = kZ; casaRoot.add(g);
      if (P.forma === 'plano' || P.forma === 'aleroPlano') {
        const y0 = techoAlto;
        g.position.y = y0;
        for (const [x, z] of [[-3.6, -3.4], [3.6, -3.4], [-3.6, 3.4], [3.6, 3.4]]) caja(0.18, 2.4, 0.18, mAcento, x, 1.2, z, g);
        for (let k = -3; k <= 3; k++) caja(7.6, 0.1, 0.12, mAcento, 0, 2.45, k * 1.1, g);
        for (const [x, z] of [[-4.5, 4.5], [4.5, 4.5], [-4.5, -4.5]]) { caja(0.6, 0.6, 0.6, mPared, x, 0.3, z, g); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0x4f8a34, flatShading: true })); pl.position.set(x, 1.1, z); g.add(pl); }
        caja(1.6, 0.4, 0.6, mAcento, 0, 0.3, 0, g);   // banca
      } else if (P.forma === 'pagoda') {
        g.position.y = techoAlto - 0.6;
        caja(2.4, 1.3, 2.4, mPared, 0, 0.65, 0, g);
        const c = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4), mTecho); c.rotation.y = Math.PI / 4; c.position.y = 1.9; g.add(c);
      } else {
        g.position.set(0, Y3, 0);
        caja(3.2, 2.0, 3.0, mPared, 1.5, 1.0, HZ1 - 2.2, g);
        const r = caja(3.6, 0.16, 3.4, mTecho, 1.5, 2.1, HZ1 - 2.0, g); r.rotation.x = -0.15;
        ventana(1.5, 1.0, HZ1 - 0.7, 2.4, 1.6, 0, 1, g);
        caja(3.2, 0.12, 1.2, mLosa, 1.5, 0.06, HZ1 - 0.1, g);
      }
    }
    // andamio mientras se trabaja en la casa
    if (obra && ['fachada', 'techo', 'ventanales', 'terraza', 'ampliacion', 'solar', 'azotea', 'cocina', 'bano', 'reforma'].includes(obra.id)) {
      for (const [x, z] of [[HX0 - 0.6, HZ1 + 0.7], [0, HZ1 + 0.7], [HX1 + 0.6, HZ1 + 0.7], [12.8, HZ1 + 0.7], [12.8, 0]]) caja(0.12, Y3 + 0.8, 0.12, andamioCasa, x, (Y3 + 0.8) / 2, z);
      for (const y of [Y1, Y3 - 0.2]) caja(19.6, 0.1, 0.8, andamioCasa, 3.3, y, HZ1 + 0.8);
    }
    // registra lo que se desvanece cuando hay alguien adentro
    const porMat = new Map();
    casaRoot.traverse((o) => { if (!o.isMesh) return; const min = MIN_OPAC[o.material.name]; if (min == null) return; if (!porMat.has(o.material)) porMat.set(o.material, { mat: o.material, min, mallas: [] }); porMat.get(o.material).mallas.push(o); });
    transparentables.push(...porMat.values());
    cargada = true;
  }
  aplicarTema('rustico');

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
    bx(2.8, 0.45, 3.3, madera, 0.2, y1 + 0.22, -3.85);
    bx(2.7, 0.12, 3.0, M(0x7a9cc6, { roughness: 1 }), 0.2, y1 + 0.5, -3.6);         // cobija
    for (const dx of [-0.65, 0.65]) bx(0.9, 0.14, 0.45, blanco, 0.2 + dx, y1 + 0.58, -5.2);   // almohadas
    bx(2.8, 1.1, 0.12, madera, 0.2, y1 + 0.6, -5.5);                              // cabecera
    for (const sx of [-1, 1]) bx(0.5, 0.55, 0.45, madera, 0.2 + sx * 1.75, y1 + 0.28, -5.3);
    bx(2.0, 2.2, 0.4, madera, 3.5, y1 + 1.1, -5.6);                               // biblioteca
    const libros = [0xc0392b, 0x2e6da4, 0xe2b33c, 0x3e8e5b, 0x8e44ad];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) bx(0.16, 0.38, 0.28, M(libros[(r * 3 + k) % 5]), 2.7 + k * 0.2, y1 + 0.35 + r * 0.52, -5.5);
    bx(1.0, 0.45, 0.9, M(0x6f8f5a, { roughness: 0.95 }), 4.6, y1 + 0.3, 3.4); bx(0.25, 0.7, 0.9, M(0x6f8f5a), 5.1, y1 + 0.75, 3.4);
  }
  // cuarto de los niños: cuna y dos camitas (aparecen cuando hay hijos)
  const cuartoNinos = new THREE.Group(); cuartoNinos.visible = false; root.add(cuartoNinos);
  const CUNA = { x: -2.4, z: -4.7 };
  {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    const add = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; cuartoNinos.add(o); return o; };
    const y1 = PISO[1], blanco = M(0xf6f1e6), madera = M(0xc89b6a), celeste = M(0x9cc7e8), rosa = M(0xe8a8b8);
    add(0.72, 0.06, 1.12, madera, CUNA.x, y1 + 0.45, CUNA.z); add(0.66, 0.08, 1.06, blanco, CUNA.x, y1 + 0.52, CUNA.z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(0.05, 0.95, 0.05, madera, CUNA.x + sx * 0.34, y1 + 0.47, CUNA.z + sz * 0.54);
    for (const sx of [-1, 1]) { add(0.03, 0.03, 1.1, madera, CUNA.x + sx * 0.34, y1 + 0.92, CUNA.z); for (let k = -4; k <= 4; k++) add(0.02, 0.38, 0.02, madera, CUNA.x + sx * 0.34, y1 + 0.72, CUNA.z + k * 0.12); }
    for (const sz of [-1, 1]) add(0.7, 0.03, 0.03, madera, CUNA.x, y1 + 0.92, CUNA.z + sz * 0.54);
    [[-3.0, celeste], [-2.0, rosa]].forEach(([x, cob]) => {
      add(0.9, 0.3, 2.9, madera, x, y1 + 0.16, -2.2); add(0.84, 0.1, 2.8, blanco, x, y1 + 0.36, -2.2); add(0.86, 0.06, 2.0, cob, x, y1 + 0.43, -1.8);
      add(0.55, 0.1, 0.32, blanco, x, y1 + 0.45, -3.38); add(0.9, 0.7, 0.08, madera, x, y1 + 0.36, -3.66);
    });
  }
  // obstáculos de la casa por piso [piso, x0, x1, z0, z1, (condición)]: para caminar rodeando los muebles
  const OBST = [
    [0, -4.3, -1.0, -5.9, -5.1], [0, -5.45, -4.55, -5.5, -4.7], [0, -2.3, -0.1, -2.2, -1.0],
    [0, -2.15, -1.65, -2.9, -2.4], [0, -0.75, -0.25, -2.9, -2.4], [0, -2.15, -1.65, -0.8, -0.3], [0, -0.75, -0.25, -0.8, -0.3],
    [0, 0.95, 4.25, 4.15, 5.2], [0, 4.25, 5.4, 0.15, 1.05], [0, 2.0, 3.2, 2.15, 2.85], [0, 0.4, 2.0, -5.9, -5.3], [0, -5.25, -4.25, 0.9, 4.4],
    [0, -3.7, -1.5, -4.2, -3.3, () => cocinaModerna.visible],
    [1, -1.2, 1.6, -5.6, -2.2], [1, -1.8, -1.3, -5.55, -5.05], [1, 1.7, 2.2, -5.55, -5.05], [1, 2.5, 4.5, -5.8, -5.4], [1, 4.1, 5.3, 2.95, 3.85], [1, -5.3, -4.2, 1.1, 4.8],
    [1, 3.3, 5.4, -3.2, -1.6, () => banoG.visible], [1, 5.15, 5.65, -4.45, -3.95, () => banoG.visible],
    [1, -2.8, -2.0, -5.3, -4.1, () => cuartoNinos.visible], [1, -3.45, -2.55, -3.7, -0.75, () => cuartoNinos.visible], [1, -2.45, -1.55, -3.7, -0.75, () => cuartoNinos.visible],
  ];
  const MARGEN_NAV = 0.3;
  const dentroR = (p, r) => p.x > r[0] && p.x < r[1] && p.z > r[2] && p.z < r[3];
  function cruzaR(a, b, r) {   // ¿el tramo a→b atraviesa el rectángulo? (Liang–Barsky)
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dz = b.z - a.z;
    for (const [pp, q] of [[-dx, a.x - r[0]], [dx, r[1] - a.x], [-dz, a.z - r[2]], [dz, r[3] - a.z]]) {
      if (Math.abs(pp) < 1e-9) { if (q < 0) return false; continue; }
      const u = q / pp; if (pp < 0) { if (u > t1) return false; if (u > t0) t0 = u; } else { if (u < t0) return false; if (u < t1) t1 = u; }
    }
    return t0 < t1;
  }
  // camino más corto rodeando los muebles (grafo de visibilidad entre las esquinas)
  function rutaInterior(desde, hasta, piso) {
    const y = PISO[piso];
    const rs = OBST.filter((o) => o[0] === piso && (!o[5] || o[5]())).map((o) => [o[1] - MARGEN_NAV, o[2] + MARGEN_NAV, o[3] - MARGEN_NAV, o[4] + MARGEN_NAV])
      .filter((r) => !dentroR(desde, r) && !dentroR(hasta, r));   // si empieza o termina dentro (una silla), ese mueble no estorba
    const libre = (a, b) => !rs.some((r) => cruzaR(a, b, r));
    if (libre(desde, hasta)) return [V(hasta.x, y, hasta.z)];
    const nodos = [desde, hasta];
    for (const r of rs) for (const [x, z] of [[r[0] - 0.02, r[2] - 0.02], [r[1] + 0.02, r[2] - 0.02], [r[0] - 0.02, r[3] + 0.02], [r[1] + 0.02, r[3] + 0.02]]) { const q = { x, z }; if (!rs.some((o) => dentroR(q, o))) nodos.push(q); }
    const N = nodos.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), hecho = new Array(N).fill(false); dist[0] = 0;
    for (;;) {
      let u = -1; for (let i = 0; i < N; i++) if (!hecho[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === 1) break; hecho[u] = true;
      for (let v2 = 0; v2 < N; v2++) if (!hecho[v2] && libre(nodos[u], nodos[v2])) { const d = dist[u] + Math.hypot(nodos[u].x - nodos[v2].x, nodos[u].z - nodos[v2].z); if (d < dist[v2]) { dist[v2] = d; prev[v2] = u; } }
    }
    if (prev[1] < 0) return [V(hasta.x, y, hasta.z)];
    const camino = []; for (let i = 1; i > 0; i = prev[i]) camino.unshift(V(nodos[i].x, y, nodos[i].z));
    return camino;
  }
  // mejoras del interior (se muestran cuando se construyen)
  const cocinaModerna = new THREE.Group(), banoG = new THREE.Group(); root.add(cocinaModerna, banoG);
  {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, ...o });
    const add = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const y0 = PISO[0], y1 = PISO[1];
    add(cocinaModerna, 2.2, 0.9, 0.8, M(0x2b2d31), -2.6, y0 + 0.45, -3.75);                 // isla
    add(cocinaModerna, 2.3, 0.06, 0.9, M(0xf2efe8, { roughness: 0.2 }), -2.6, y0 + 0.93, -3.75);
    for (const dx of [-0.7, 0, 0.7]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M(0xffd28a, { emissive: 0xffb45e, emissiveIntensity: 0.6 })); l.position.set(-2.6 + dx, y0 + 2.6, -3.75); cocinaModerna.add(l); }
    add(cocinaModerna, 3.4, 0.05, 0.02, M(0xd9b38c, { emissive: 0xffb45e, emissiveIntensity: 0.3 }), -2.65, y0 + 1.95, -5.38);   // luz bajo la alacena
    add(banoG, 1.9, 0.6, 0.9, M(0xf6f4ef, { roughness: 0.15 }), 4.4, y1 + 0.3, -2.4);       // tina
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.7), M(0x8fd3df, { roughness: 0.05 })); agua.rotation.x = -Math.PI / 2; agua.position.set(4.4, y1 + 0.55, -2.4); banoG.add(agua);
    add(banoG, 0.05, 2.0, 1.6, M(0xcfe8ef, { transparent: true, opacity: 0.3, roughness: 0.05 }), 3.35, y1 + 1.0, -2.4);   // mampara
    add(banoG, 0.5, 0.8, 0.5, M(0xf6f4ef), 5.4, y1 + 0.4, -4.2);                             // lavamanos
  }
  // dónde se ubica cada uno según lo que hace: [piso, x, z, mirar x, mirar z, pose]
  const SITIO = {
    estufa: [0, -1.7, -4.75, -1.7, -6, 'trabajo'], fregadero: [0, -3.5, -4.75, -3.5, -6, 'trabajo'],
    silla0: [0, -1.9, -2.65, -1.9, 0, 'sentado'], silla1: [0, -0.5, -0.55, -0.5, -3, 'sentado'],
    sofa0: [0, 2.0, 4.45, 2.0, 0, 'sentado'], sofa1: [0, 3.2, 4.45, 3.2, 0, 'sentado'],
    sillon: [0, 4.65, 0.6, 0, 0.6, 'sentado'], tapete: [0, 2.6, 2.3, 2.6, 0, 'quieto'],
    sala0: [0, 0.8, 2.0, 2.6, 2.3, 'quieto'], sala1: [0, 1.6, 0.6, 2.6, 2.3, 'quieto'],
    cama0: [1, -0.45, -3.6, -0.45, -6, 'acostado'], cama1: [1, 0.85, -3.6, 0.85, -6, 'acostado'],
    silla2: [0, -0.5, -2.65, -0.5, 0, 'sentado'], silla3: [0, -1.9, -0.55, -1.9, -3, 'sentado'],
    cuna: [1, -2.4, -3.85, -2.4, -6, 'trabajo'], camaNino0: [1, -3.0, -2.2, -3.0, -6, 'acostado'], camaNino1: [1, -2.0, -2.2, -2.0, -6, 'acostado'],
    juegoNino0: [0, 2.0, 1.7, 2.6, 2.3, 'quieto'], juegoNino1: [0, 3.3, 1.8, 2.6, 2.3, 'quieto'],
    pieCama: [1, 0.2, -3.1, 0.2, 0, 'acostado'], sillonAlto: [1, 4.5, 3.4, 0, 3.4, 'sentado'], biblioteca: [1, 3.5, -4.7, 3.5, -6, 'quieto'],
  };
  const LIMPIAR = ['sala0', 'fregadero', 'tapete', 'biblioteca', 'sillon'];

  // ------------------------------------------------------------ granja: huerto, pozo, tanque, comedero, caseta, banca
  const woodMat = TEMA.madera;
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.45, metalness: 0.6 });
  const box = (w, h, d, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // camino de piedras
  {
    const geos = [];
    const pathX = (z) => -2.6 + Math.sin(z * 0.22) * 0.5;
    for (let z = 7.6; z < 28.4; z += 0.95) { if (z > 15.2 && z < 21.2) continue; const g = new THREE.CylinderGeometry(0.42 + rand() * 0.08, 0.46, 0.08, 7); g.rotateY(rand() * 3); g.translate(pathX(z), 0.03, z); geos.push(g); }
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xbdb7aa, roughness: 0.95, flatShading: true })); m.receiveShadow = true; root.add(m);
  }

  // caminos que va empedrando Andrés: dos hileras de lajas que aparecen a medida que avanza
  const caminosVis = (() => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc4bcae, roughness: 0.95, flatShading: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    return CAMINOS.map((c) => {
      const largo = largoCamino(c), n = Math.max(2, Math.round(largo / 0.85)), piedras = [];
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n, p = puntoCamino(c, f), q = puntoCamino(c, Math.min(1, f + 0.01));
        const ang = Math.atan2(q.z - p.z, q.x - p.x), nx = -Math.sin(ang), nz = Math.cos(ang);
        for (const lado of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + rand() * 0.06, 0.33, 0.06, 6), mat);
          m.position.set(p.x + nx * lado * 0.34 + (rand() - 0.5) * 0.08, 0.035, p.z + nz * lado * 0.34 + (rand() - 0.5) * 0.08); m.rotation.y = rand() * 3;
          m.receiveShadow = true; m.visible = false; root.add(m); piedras.push(m);
        }
      }
      return { id: c.id, piedras, n: 0 };
    });
  })();

  // huerto: 6 parcelas con cerca baja
  const parcelas = [];
  const soilDry = new THREE.Color(0x9a7650), soilWet = new THREE.Color(0x4a3220);
  for (const [fz0, fz1] of [[15.2, 21.0], [28.2, 34.0]]) {
    const fence = TEMA.cerca;
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
    // charco cuando se encharca
    const charco = new THREE.Mesh(new THREE.PlaneGeometry(PLOT_W - 0.2, PLOT_D - 0.2), new THREE.MeshStandardMaterial({ color: 0x5a8fb0, roughness: 0.1, transparent: true, opacity: 0.7 }));
    charco.rotation.x = -Math.PI / 2; charco.position.y = 0.19; charco.visible = false; g.add(charco);
    // bichos o esporas revoloteando cuando hay plaga
    const bichos = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3)), new THREE.PointsMaterial({ color: 0x2a2018, size: 0.12 }));
    bichos.visible = false; g.add(bichos);
    parcelas.push({ g, soil, soilMat, plants, sel, charco, bichos, key: '' });
  }
  // (las posiciones vienen del estado en la primera actualización)

  // plantas por cultivo
  // viento en la tarjeta gráfica: hojas, flores y frutos se mecen según su altura y su lugar en el mundo,
  // así las plantas quedan quietas para la CPU y se pueden agrupar en lotes (antes se rotaban una por una)
  const uViento = { value: 0 }, uRafaga = { value: 1 }, conViento = new WeakSet();
  const conVientoShader = (sh) => {
    sh.uniforms.uViento = uViento; sh.uniforms.uRafaga = uRafaga;
    sh.vertexShader = `uniform float uViento;
uniform float uRafaga;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wv = modelMatrix * vec4(transformed, 1.0);
        float hv = 0.03 * min(wv.y, 1.5) + 0.006 * max(wv.y - 1.5, 0.0);
        float fv = uViento * 1.1 + wv.x * 0.37 + wv.z * 0.53;
        transformed.x += sin(fv) * hv * uRafaga;
        transformed.z += cos(fv * 0.8 + 1.3) * hv * 0.6 * uRafaga;`);
  };
  // la sombra se calcula con este material: así se mece igual que la hoja y no "parpadea" sobre ella
  const profViento = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  profViento.onBeforeCompile = conVientoShader; profViento.customProgramCacheKey = () => 'viento-prof';
  function viento(mat) {
    if (!mat || conViento.has(mat)) return mat; conViento.add(mat);
    mat.onBeforeCompile = conVientoShader;
    mat.customProgramCacheKey = () => 'viento';
    mat.userData.profundidad = profViento;
    return mat;
  }
  const LEAF = (c) => viento(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
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

  // pozo (su diseño se arma aparte: ver vestir())
  const pozoGrupo = new THREE.Group(); pozoGrupo.position.set(LUGAR.pozo.x, 0, LUGAR.pozo.z); root.add(pozoGrupo);

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
  const casetaG = new THREE.Group(); casetaG.position.set(LUGAR.caseta.x, 0, LUGAR.caseta.z); casetaG.rotation.y = -Math.PI / 2; root.add(casetaG);
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
  const libreAnillo = (x, z) => fueraGranja(x, z) && enTerreno(x, z, 2) && Math.hypot((x - ESTANQUE.x) / (ESTANQUE.rx + 2.5), (z - ESTANQUE.z) / (ESTANQUE.rz + 2.5)) >= 1;
  for (let k = 0; k < 12; k++) {   // pocos árboles: el anillo es sobre todo arbustos con flores
    const ang = rand() * Math.PI * 2, r = 40 + rand() * 7;
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
  // arbustos con flores, rocas con musgo, troncos caídos, hongos y colmenas
  {
    const verdes = [0x4d7a2b, 0x5f8f34, 0x6f9a44].map((c) => LEAF(c));
    const floresB = [0xe4507a, 0xf2c94c, 0xf5f1e6, 0x9b6ad8, 0xf28c3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const roca = new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 1, flatShading: true }), musgo = LEAF(0x5a8a3a);
    const tronco = new THREE.MeshStandardMaterial({ color: 0x6b5644, roughness: 1, flatShading: true });
    const hongo = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }), pie = new THREE.MeshStandardMaterial({ color: 0xf2efe8 });
    const punto = () => { for (let i = 0; i < 30; i++) { const ang = rand() * Math.PI * 2, r = 35 + rand() * 13.5, x = CENTER.x + Math.cos(ang) * r, z = CENTER.z + Math.sin(ang) * r; if (libreAnillo(x, z)) return [x, z]; } return null; };
    for (let k = 0; k < 95; k++) {   // arbustos floridos
      const p = punto(); if (!p) continue;
      const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); const sc = 1.1 + rand() * 0.9; g.scale.setScalar(sc); root.add(g);
      const c = floresB[Math.floor(rand() * floresB.length)];
      for (let i = 0; i < 3 + Math.floor(rand() * 3); i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + rand() * 0.3, 1), verdes[i % 3]); m.position.set((rand() - 0.5) * 1.1, 0.4 + rand() * 0.3, (rand() - 0.5) * 1.1); m.scale.y = 0.8; m.castShadow = true; g.add(m); }
      for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), c); const a = rand() * 6.28; f.position.set(Math.cos(a) * (0.5 + rand() * 0.3), 0.55 + rand() * 0.45, Math.sin(a) * (0.5 + rand() * 0.3)); g.add(f); }
    }
    for (let k = 0; k < 18; k++) {   // rocas con musgo
      const p = punto(); if (!p) continue;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rand() * 0.7, 0), roca); m.position.set(p[0], 0.25, p[1]); m.scale.y = 0.6; m.rotation.y = rand() * 6; m.castShadow = true; root.add(m);
      const mm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), musgo); mm.position.set(p[0] + 0.15, 0.5, p[1]); mm.scale.set(1, 0.35, 1); root.add(mm);
    }
    for (let k = 0; k < 6; k++) {   // troncos caídos con hongos
      const p = punto(); if (!p) continue;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.4 + rand(), 8), tronco); t.rotation.set(0, rand() * 6, Math.PI / 2); t.position.set(p[0], 0.28, p[1]); t.castShadow = true; root.add(t);
      for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(p[0] + (rand() - 0.5) * 1.6, 0, p[1] + (rand() - 0.5) * 1.6); root.add(g); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), pie); st.position.y = 0.11; g.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), hongo); cap.position.y = 0.2; g.add(cap); }
    }
    // colmenas junto al campo de flores (las abejas polinizan los jardines y el huerto)
    const madera = new THREE.MeshStandardMaterial({ color: 0xe0c08a, roughness: 0.8 }), tapa = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 });
    for (const [x, z] of [[38.5, -3], [40.5, 1], [39.5, 5]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
      for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.6), madera); m.position.y = 0.3 + i * 0.33; m.castShadow = true; g.add(m); }
      const tp = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.75), tapa); tp.position.y = 1.3; g.add(tp);
      const pt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.6), tapa); pt.position.y = 0.07; g.add(pt);
    }
    var abejas = (() => {   // puntitos que revolotean entre las flores
      const N = 24, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf2c94c, size: 0.18 }));
      root.add(pts);
      return { pts, pos, N };
    })();
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
  // (los bordes los cubre el anillo exterior: pocos árboles y muchos arbustos)
  for (const [x, z, s] of [[-7.6, 7.2, 0.9], [17, 33, 1.0], [38, 20, 0.9], [-12, 36, 1.0], [35, 4, 0.9], [-2, -27, 0.9], [12, -27, 1.0], [-7.0, -1.5, 1.0], [12.9, 2.5, 0.9], [-1.0, -8.6, 0.9], [4.5, -9.0, 1.0], [22.6, 22.0, 1.0], [-8.4, 18.5, 0.9], [11.0, 26.0, 0.9], [-3.0, 26.0, 1.0], [23.0, 9.0, 0.8]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 1), LEAFS[Math.floor(rand() * LEAFS.length)]); m.position.set((rand() - 0.5) * 1.1, 0.45 + rand() * 0.35, (rand() - 0.5) * 1.1); m.scale.y = 0.85; m.castShadow = true; g.add(m); }
  }
  // árboles de sombra dentro de los potreros (el ganado se refugia ahí con calor)
  for (const q of [...SOMBRAS.corral, ...SOMBRAS.aves]) makeTree(q.x, q.z, 1.25);
  // huerto de frutales: la fruta aparece en la copa según lo que haya madurado
  const frutales = FRUTALES.map((f) => {
    const t = new THREE.Group(); t.position.set(f.x, 0, f.z); root.add(t);
    const tr = new THREE.CylinderGeometry(0.12, 0.2, 1.9, 6); tr.translate(0, 0.95, 0); const tm = new THREE.Mesh(tr, bark); tm.castShadow = true; t.add(tm);
    const copa = new THREE.Group(); copa.position.y = 2.3; t.add(copa);
    const hoja = LEAF(f.tipo === 'naranjo' ? 0x3f7a35 : 0x5d9a3c);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rand() * 0.3, 0), hoja); const a = rand() * 6.28, r = rand() * 0.9; m.position.set(Math.cos(a) * r, (rand() - 0.3) * 0.8, Math.sin(a) * r); m.castShadow = true; copa.add(m); }
    const fm = viento(new THREE.MeshStandardMaterial({ color: f.tipo === 'naranjo' ? 0xf28c1e : 0xd2342c, roughness: 0.5 }));
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
    const tallo = LEAF(0x4f8a34), petalo = viento(new THREE.MeshStandardMaterial({ color: j.flor, roughness: 0.6 })), centro = viento(new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.6 }));
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
  const andamioMat = TEMA.madera;
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
    } else if (id === 'drenaje') {
      add(new THREE.BoxGeometry(15, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0x3d2c1e, roughness: 1 }), 0, 0.03, 0);
      for (let k = 0; k < 22; k++) add(new THREE.IcosahedronGeometry(0.16, 0), piedraObra, -7.2 + k * 0.68, 0.08, (k % 2 ? 0.42 : -0.42));
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

  // ------------------------------------------------------------ viñedo: espalderas con racimos que pintan según maduran
  const palo = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const hojaParra = LEAF(0x5f8f34), hojaOtono = LEAF(0xb8742c);
  const uvaMat = viento(new THREE.MeshStandardMaterial({ color: 0x4b2350, roughness: 0.35 }));
  const parrasVis = PARRAS.map((q) => {
    const g = new THREE.Group(); g.position.set(q.x, 0, q.z); root.add(g);
    for (const dx of [-1.4, 1.4]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), palo); m.position.set(dx, 0.8, 0); m.castShadow = true; g.add(m); }
    const alambre = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.025, 0.025), palo); alambre.position.y = 1.4; g.add(alambre);
    const hojas = [];
    for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + rand() * 0.12, 0), hojaParra); m.position.set(-1.3 + k * 0.33, 1.15 + rand() * 0.35, (rand() - 0.5) * 0.3); m.scale.set(1, 0.8, 0.6); m.castShadow = true; g.add(m); hojas.push(m); }
    const racimos = [];
    for (let k = 0; k < 8; k++) {
      const r = new THREE.Group(); r.position.set(-1.15 + k * 0.33, 0.95, (k % 2 ? 0.2 : -0.2)); g.add(r);
      for (let u = 0; u < 7; u++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), uvaMat); b.position.set((u % 3 - 1) * 0.06, -Math.floor(u / 3) * 0.08 - (u === 6 ? 0.08 : 0), 0); r.add(b); }
      racimos.push(r);
    }
    return { g, hojas, racimos };
  });
  // huerta de hierbas: matas de marihuana (crecen, florecen y se cortan en otoño)
  const hojaMata = LEAF(0x3f8a3a), cogollo = viento(new THREE.MeshStandardMaterial({ color: 0x9fb84a, roughness: 0.8, flatShading: true }));
  const matasVis = MATAS.map((m) => {
    const g = new THREE.Group(); g.position.set(m.x, 0, m.z); root.add(g);
    const tierra = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 })); tierra.position.y = 0.06; tierra.receiveShadow = true; g.add(tierra);
    const planta = new THREE.Group(); g.add(planta);
    const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.6, 5), LEAF(0x4f7a2c)); tallo.position.y = 0.8; planta.add(tallo);
    for (let k = 0; k < 6; k++) {   // pisos de hojas en abanico, más angostos hacia arriba
      const y = 0.4 + k * 0.22, r = 0.55 - k * 0.07;
      for (let h = 0; h < 5; h++) { const a = h * 1.26 + k * 0.6; const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, r, 3), hojaMata); f.position.set(Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5); f.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3); planta.add(f); }
    }
    const flores = new THREE.Group(); planta.add(flores);
    for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), cogollo); c.position.set((rand() - 0.5) * 0.5, 0.9 + rand() * 0.8, (rand() - 0.5) * 0.5); c.scale.y = 1.6; flores.add(c); }
    return { planta, flores, fase: rand() * 6 };
  });
  // colgadero donde se secan los cogollos (al lado de la huerta de hierbas)
  const colgadero = new THREE.Group(); colgadero.position.set(37.2, 0, 32.4); root.add(colgadero);
  for (const dx of [-0.9, 0.9]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), palo); m.position.set(dx, 0.85, 0); colgadero.add(m); }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.05), palo); m.position.y = 1.65; colgadero.add(m); }
  const colgados = new THREE.Group(); colgadero.add(colgados);
  for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 5), LEAF(0x7d8c3a)); c.position.set(-0.75 + k * 0.3, 1.38, 0); c.rotation.x = Math.PI; colgados.add(c); }
  // lagar (tina para pisar la uva) y barricas donde fermenta el vino
  const roble = new THREE.MeshStandardMaterial({ color: 0x7a4e2c, roughness: 0.85 }), aro = new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.5, metalness: 0.6 });
  {
    const tina = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.7, 16, 1, true), roble); tina.material.side = THREE.DoubleSide; tina.position.set(LUGAR.lagar.x, 0.35, LUGAR.lagar.z); tina.castShadow = true; root.add(tina);
    const mosto = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), new THREE.MeshStandardMaterial({ color: 0x5a1f3a, roughness: 0.3 })); mosto.rotation.x = -Math.PI / 2; mosto.position.set(LUGAR.lagar.x, 0.45, LUGAR.lagar.z); root.add(mosto);
    var mostoVis = mosto;
  }
  const barricasVis = [];
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Group(); b.position.set(LUGAR.lagar.x + 2.0 + (k % 2) * 1.05, 0.45 + Math.floor(k / 2) * 0.82, LUGAR.lagar.z - 0.3); b.rotation.x = Math.PI / 2; root.add(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14), roble); c.castShadow = true; b.add(c);
    for (const dy of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 4, 16), aro); r.rotation.x = Math.PI / 2; r.position.y = dy; b.add(r); }
    barricasVis.push(b);
  }
  // botellero junto al lagar: se llena con las botellas guardadas
  const botellas = [];
  { const vidrioV = new THREE.MeshStandardMaterial({ color: 0x2d4a2a, roughness: 0.2 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.4), palo); rack.position.set(LUGAR.lagar.x - 2.1, 0.55, LUGAR.lagar.z - 0.3); root.add(rack);
    for (let k = 0; k < 12; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 6), vidrioV); b.rotation.x = Math.PI / 2; b.position.set(LUGAR.lagar.x - 2.7 + (k % 6) * 0.24, 0.3 + Math.floor(k / 6) * 0.4 + 0.15, LUGAR.lagar.z - 0.05); root.add(b); botellas.push(b); } }

  // ------------------------------------------------------------ proyectos: bodega de vino, caseta de cultivo, deck, jacuzzi y gimnasio
  const proy = {};
  {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    const grupo = (id, x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.visible = false; root.add(g); proy[id] = g; return g; };
    const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    // bodega de vino (piedra y techo del estilo)
    { const g = grupo('bodegaVino', 29.5, 22.8), piedra = M(0x9d968b, { flatShading: true });
      add(g, B(3.2, 2.2, 2.4), piedra, 0, 1.1, 0); const r = add(g, B(3.6, 0.15, 2.8), TEMA.techo, 0, 2.35, 0); r.rotation.x = 0.1;
      add(g, B(0.9, 1.6, 0.08), TEMA.madera, -0.8, 0.8, 1.22);
      for (const dx of [0.6, 1.4]) { const b = add(g, new THREE.CylinderGeometry(0.38, 0.38, 0.8, 12), M(0x7a4e2c), dx, 0.4, 1.7); b.rotation.x = Math.PI / 2; } }
    // caseta de cultivo sobre las matas (paneles translúcidos; con luces moradas al mejorarla)
    { const g = grupo('cultivoCaseta', 34.8, 27.3), panel = M(0xf3f6f2, { transparent: true, opacity: 0.28, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
      for (const [x, z] of [[-2.5, -4.1], [2.5, -4.1], [-2.5, 4.1], [2.5, 4.1], [-2.5, 0], [2.5, 0]]) add(g, B(0.12, 2.6, 0.12), TEMA.madera, x, 1.3, z);
      for (const [w, d, x, z] of [[5.1, 0.04, 0, -4.1], [5.1, 0.04, 0, 4.1], [0.04, 8.2, -2.5, 0], [0.04, 8.2, 2.5, 0]]) add(g, B(w, 2.5, d), panel, x, 1.25, z).castShadow = false;
      add(g, B(5.6, 0.08, 8.8), panel, 0, 2.7, 0).castShadow = false;
      const luz = new THREE.Group(); g.add(luz); g.userData.luz = luz;
      for (const x of [-1.2, 1.2]) add(luz, B(0.12, 0.06, 7.6), M(0xd8a8ff, { emissive: 0xb04aff, emissiveIntensity: 1.4 }), x, 2.5, 0);
      const pl = new THREE.PointLight(0xb04aff, 6, 9, 2); pl.position.set(0, 2.2, 0); luz.add(pl); }
    // deck y tumbonas de la piscina
    { const g = grupo('piscina', (PISCINA.x0 + PISCINA.x1) / 2, (PISCINA.z0 + PISCINA.z1) / 2), deck = TEMA.madera;
      const W = PISCINA.x1 - PISCINA.x0, D = PISCINA.z1 - PISCINA.z0;
      for (const [w, d, x, z] of [[W + 4.4, 1.4, 0, -D / 2 - 1.4], [W + 4.4, 1.4, 0, D / 2 + 1.4], [1.4, D + 1.4, -W / 2 - 1.4, 0], [1.4, D + 1.4, W / 2 + 1.4, 0]]) add(g, B(w, 0.08, d), deck, x, 0.04, z);
      for (const dx of [-1.5, 0.5]) { add(g, B(0.8, 0.12, 2.0), M(0xf2efe8), dx, 0.35, D / 2 + 1.45); const r = add(g, B(0.8, 0.1, 0.8), M(0xf2efe8), dx, 0.62, D / 2 + 2.2); r.rotation.x = -0.9; }
      add(g, new THREE.CylinderGeometry(0.05, 0.05, 2.6), M(0x8a8a8a), 2.4, 1.3, D / 2 + 1.6); add(g, new THREE.ConeGeometry(1.4, 0.5, 10), M(0xe7c46a), 2.4, 2.6, D / 2 + 1.6); }
    // jacuzzi
    { const g = grupo('jacuzzi', 23.6, 14.2);
      add(g, new THREE.CylinderGeometry(1.15, 1.2, 0.7, 20), TEMA.madera, 0, 0.35, 0);
      const ag = add(g, new THREE.CircleGeometry(1.0, 20), M(0x6fd6e8, { emissive: 0x2fb8d8, emissiveIntensity: 0.5, roughness: 0.05 }), 0, 0.72, 0); ag.rotation.x = -Math.PI / 2;
      const burbujas = []; for (let k = 0; k < 14; k++) { const b = add(g, new THREE.SphereGeometry(0.05, 6, 4), M(0xffffff, { transparent: true, opacity: 0.7 }), 0, 0.74, 0); burbujas.push(b); } g.userData.burbujas = burbujas; }
    // gimnasio al aire libre
    { const g = grupo('gimnasio', LUGAR_GYM.x, LUGAR_GYM.z - 1.4), metal = M(0x2b2d31, { metalness: 0.6, roughness: 0.4 });
      add(g, B(4.6, 0.06, 3.0), M(0x3a3e42, { roughness: 1 }), 0, 0.03, 0);
      for (const x of [-2.0, -0.6]) add(g, B(0.1, 2.4, 0.1), metal, x, 1.2, -1.2); add(g, B(1.5, 0.08, 0.08), metal, -1.3, 2.35, -1.2);   // barra de dominadas
      add(g, B(0.5, 0.45, 1.5), M(0x5a2a2a), 0.9, 0.25, -0.6); add(g, new THREE.CylinderGeometry(0.03, 0.03, 1.8), metal, 0.9, 0.95, -0.9).rotation.z = Math.PI / 2;   // banca y barra
      for (const dx of [-0.85, 0.85]) add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), metal, 0.9 + dx, 0.95, -0.9).rotation.z = Math.PI / 2;
      add(g, B(0.08, 2.4, 0.08), metal, 2.0, 1.2, 0.8); add(g, B(0.8, 0.08, 0.08), metal, 1.65, 2.4, 0.8);
      const saco = add(g, new THREE.CylinderGeometry(0.25, 0.25, 1.0, 12), M(0x7a2a22), 1.3, 1.5, 0.8); g.userData.saco = saco;
      for (const dx of [-1.6, -1.2]) add(g, new THREE.SphereGeometry(0.16, 10, 8), metal, dx, 0.16, 1.0); }
    // andamio para las obras de la granja
    { const g = new THREE.Group(); g.visible = false; root.add(g); proy.andamio = g;
      const m = M(0xc9a46c);
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) add(g, B(0.1, 3.0, 0.1), m, x, 1.5, z);
      for (const y of [1.2, 2.6]) add(g, B(3.2, 0.08, 0.6), m, 0, y, 1.5);
      for (let k = 0; k < 4; k++) add(g, B(0.5, 0.35, 0.5), M(0xb06a42), -1 + k * 0.6, 0.18, -2.2); }
  }
  const SITIO_OBRA = { vinedo: [16, 32], bodegaVino: [29.5, 22.8], cultivoCaseta: [34.8, 27.3], cultivoPro: [34.8, 27.3], piscina: [17.5, 18.6], jacuzzi: [23.6, 14.2], gimnasio: [LUGAR_GYM.x, LUGAR_GYM.z - 1.4], establo2: [LUGAR.establo.x + 3.6, LUGAR.establo.z], gallinero2: [LUGAR.gallinero.x - 3.4, LUGAR.gallinero.z] };

  // ------------------------------------------------------------ la carreta de Don Ramiro (solo los días de visita)
  const carreta = new THREE.Group(); carreta.position.set(LUGAR.carreta.x, 0, LUGAR.carreta.z); carreta.rotation.y = -Math.PI / 2; carreta.visible = false; root.add(carreta);
  {
    const add = (geo, mat, x, y, z, g = carreta) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    const madera = new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.9 });
    add(new THREE.BoxGeometry(2.4, 0.5, 1.5), madera, 0, 0.95, 0);
    const lona = add(new THREE.CylinderGeometry(0.85, 0.85, 2.3, 14, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1, side: THREE.DoubleSide }), 0, 1.2, 0); lona.rotation.set(0, 0, Math.PI / 2); lona.rotation.y = Math.PI / 2; lona.rotation.z = Math.PI / 2;
    for (const [x, z] of [[-0.8, 0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8]]) { const r = add(new THREE.TorusGeometry(0.42, 0.06, 5, 14), new THREE.MeshStandardMaterial({ color: 0x4a3020 }), x, 0.45, z); }
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.35, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: [0xc9a46c, 0x8a5a3a, 0xd2342c, 0x6f8f5a, 0xf2c94c][k] }), -0.9 + k * 0.42, 1.36, 0.3 * (k % 2 ? 1 : -1));
    add(new THREE.BoxGeometry(1.4, 0.06, 0.06), madera, 1.85, 0.75, 0.35); add(new THREE.BoxGeometry(1.4, 0.06, 0.06), madera, 1.85, 0.75, -0.35);
    // la mula
    const mula = new THREE.Group(); mula.position.set(2.9, 0, 0); carreta.add(mula);
    const pelo = new THREE.MeshStandardMaterial({ color: 0x6a5444, roughness: 1 });
    add(new THREE.BoxGeometry(1.3, 0.6, 0.55), pelo, 0, 1.05, 0, mula);
    add(new THREE.BoxGeometry(0.35, 0.7, 0.3), pelo, 0.7, 1.45, 0, mula).rotation.z = -0.5;
    add(new THREE.BoxGeometry(0.5, 0.28, 0.26), pelo, 0.95, 1.78, 0, mula);
    for (const sz of [-0.08, 0.08]) add(new THREE.ConeGeometry(0.05, 0.3, 4), pelo, 0.82, 2.0, sz, mula);
    for (const [x, z] of [[-0.5, -0.18], [-0.5, 0.18], [0.5, -0.18], [0.5, 0.18]]) add(new THREE.BoxGeometry(0.12, 0.8, 0.12), pelo, x, 0.4, z, mula);
    // Don Ramiro, con sombrero y poncho, al lado de su carreta
    const dr = new THREE.Group(); dr.position.set(-0.4, 0, 1.25); carreta.add(dr);
    add(new THREE.CylinderGeometry(0.14, 0.16, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a46 }), 0, 0.4, 0, dr);
    add(new THREE.ConeGeometry(0.42, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0xa8432e, roughness: 1 }), 0, 1.15, 0, dr);
    add(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9946c }), 0, 1.62, 0, dr);
    add(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x5a4632 }), 0, 1.76, 0, dr);
    add(new THREE.CylinderGeometry(0.15, 0.18, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x5a4632 }), 0, 1.86, 0, dr);
    var ramiro = dr;
  }

  // pila de compost (crece con el estiércol)
  const compostVis = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1, flatShading: true }));
  compostVis.position.set(LUGAR.compost.x, 0, LUGAR.compost.z); compostVis.castShadow = true; root.add(compostVis);
  { const cerco = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 4, 16), new THREE.MeshStandardMaterial({ color: 0x9a7350 })); cerco.rotation.x = Math.PI / 2; cerco.position.set(LUGAR.compost.x, 0.25, LUGAR.compost.z); root.add(cerco); }
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
  const fenceMat = TEMA.cerca;
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
  const pastoPiso = new THREE.MeshStandardMaterial({ color: 0x7fae4a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CORRAL.x1 - CORRAL.x0 - 0.4, CORRAL.z1 - CORRAL.z0 - 0.4), pastoPiso);
    m.rotation.x = -Math.PI / 2; m.position.set((CORRAL.x0 + CORRAL.x1) / 2, 0.04, (CORRAL.z0 + CORRAL.z1) / 2); m.receiveShadow = true; root.add(m);
    const geos = [];
    for (let i = 0; i < 520; i++) { const g = new THREE.ConeGeometry(0.1, 0.35 + rand() * 0.3, 4); g.translate(CORRAL.x0 + 0.5 + rand() * (CORRAL.x1 - CORRAL.x0 - 1), 0.2, CORRAL.z0 + 0.5 + rand() * (CORRAL.z1 - CORRAL.z0 - 1)); geos.push(g); }
    var matas = new THREE.Mesh(mergeGeometries(geos), pastoMat); root.add(matas);
  }
  // establo abierto hacia el corral
  const establoG = new THREE.Group(); establoG.position.set(LUGAR.establo.x, 0, LUGAR.establo.z); root.add(establoG);
  // heno guardado (crece con las reservas)
  const henoMat = new THREE.MeshStandardMaterial({ color: 0xd9bf6a, roughness: 1, flatShading: true });
  const pacas = [];
  for (let i = 0; i < 9; i++) { const m = box(1.1, 0.6, 0.7, henoMat, LUGAR.heno.x + (i % 3) * 1.15 - 1.15, 0.3 + Math.floor(i / 3) * 0.62, LUGAR.heno.z); pacas.push(m); }
  // pesebre y bebedero del ganado
  const pesebreHeno = box(2.0, 0.4, 0.6, henoMat, LUGAR.pesebre.x, 0.55, LUGAR.pesebre.z);
  box(2.3, 0.5, 0.85, fenceMat, LUGAR.pesebre.x, 0.25, LUGAR.pesebre.z);
  box(2.3, 0.45, 0.85, new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.5, metalness: 0.4 }), LUGAR.bebederoGanado.x, 0.22, LUGAR.bebederoGanado.z);
  const aguaGanado = box(2.0, 0.05, 0.6, new THREE.MeshStandardMaterial({ color: 0x4a9fd0, roughness: 0.2 }), LUGAR.bebederoGanado.x, 0.4, LUGAR.bebederoGanado.z);
  // gallinero sobre patas, con rampa
  const gallineroG = new THREE.Group(); gallineroG.position.set(LUGAR.gallinero.x, 0, LUGAR.gallinero.z); root.add(gallineroG);
  box(1.2, 0.18, 0.6, fenceMat, LUGAR.grano.x, 0.15, LUGAR.grano.z);
  const granoMat = new THREE.MeshStandardMaterial({ color: 0xe8c24a, roughness: 1 });
  const granos = box(1.0, 0.06, 0.45, granoMat, LUGAR.grano.x, 0.27, LUGAR.grano.z);

  // ------------------------------------------------------------ diseño de cada construcción (catálogo)
  const ESTRUCTURAS = { pozo: pozoGrupo, caseta: casetaG, gallinero: gallineroG, establo: establoG };
  const vistaPrevia = {};   // objeto -> estilo que se está mirando en el catálogo (sin comprar)
  function vestir(obj, est) {
    const cont = ESTRUCTURAS[obj]; if (!cont) return;
    for (const c of [...cont.children]) { if (c.userData.diseno) { cont.remove(c); c.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); } }
    const d = construirDiseno(obj, est); d.userData.diseno = true; cont.add(d); cont.userData.est = est;
    if (d.userData.bucket) cont.userData.bucket = d.userData.bucket;
  }

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
    // los que ya no están (vendidos o de otra generación) se retiran de la escena
    if (Object.keys(granjaVis).length > s.ganado.length) {
      const ids = new Set(s.ganado.map((g) => g.id));
      for (const id of Object.keys(granjaVis)) if (!ids.has(id)) { root.remove(granjaVis[id].g); delete granjaVis[id]; }
    }
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
    g.scale.setScalar(1.5);   // perro de tamaño real junto a las personas
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
    g.scale.setScalar(1.2);   // gato de tamaño real
    return { g, torso, head, legs, tail, kind: 'gato' };
  }

  // lápidas
  const tombMat = new THREE.MeshStandardMaterial({ color: 0x9d9a94, roughness: 0.9 });
  const TOMBS = { tomas: [-7.9, 16.0], lucia: [-7.9, 17.6], nube: [-6.6, 16.6], esmoquin: [-6.6, 18.1] };

  const LOOK = {
    tomas: { top: 0x3d6fb6, bottom: 0x2b2d3a, skin: 0xe0b08a, hair: 0xd9b86a, longHair: true, h: 1.5 },
    lucia: { top: 0xc8553d, bottom: 0x3f4a32, skin: 0xe9b994, hair: 0x15120f, h: 1.41 },
  };
  const vis = {};
  // altura real de la copa o del techito donde se sube el gato: se mide una vez con un rayo hacia abajo
  const rayoT = new THREE.Raycaster(), altoSitio = {}; rayoT.layers.enableAll();
  const esAgente = (o) => { for (; o; o = o.parent) { if (o.userData.agente) return true; if (!o.visible) return true; } return false; };
  function alturaTrepadero(a) {
    const k = a.trepado.sitio + '|' + Math.floor(tReal / 60);
    if (altoSitio[k] != null) return altoSitio[k];
    rayoT.set(new THREE.Vector3(a.pos.x, 12, a.pos.z), new THREE.Vector3(0, -1, 0)); rayoT.far = 13;
    const mallas = []; scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !esAgente(o)) mallas.push(o); });
    const h = rayoT.intersectObjects(mallas, false).find((i) => i.point.y < 10);
    return (altoSitio[k] = h ? Math.max(a.trepado.alto * 0.7, h.point.y - 0.06) : a.trepado.alto);
  }
  let plantillas = null;   // cuerpos y animaciones cargados (para los hijos que nacen después)
  const COLOR_HIJO = { h: 0x4f8f5a, m: 0xd46a8c };
  function crearVisHijo(a) {
    const v = makePerson({ top: COLOR_HIJO[a.sexo] || 0x6a8f4e, bottom: 0x3a4a6a, skin: 0xe6b490, hair: 0x6b4a2b, h: 1.47 });
    v.g.children.forEach((c) => { c.visible = false; });
    v.esHijo = true; v.g.userData.agente = true;
    Object.assign(v, { last: V(0, 0, 0), yaw: 0, moving: 0, ready: false, walkPh: 0 });
    const tomb = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.75, 0.2, 2, 0.1), tombMat); tomb.position.set(-5.4 + Object.keys(vis).length * 0.9, 0.38, 19.4); tomb.visible = false; tomb.castShadow = true; root.add(tomb);
    v.tomb = tomb;
    // el bebé: un bultito envuelto en su manta
    const bulto = new THREE.Group(); bulto.visible = false;
    const manta = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 4, 10), new THREE.MeshStandardMaterial({ color: a.sexo === 'm' ? 0xf2c4d0 : 0xbcd8ef, roughness: 0.9 }));
    manta.rotation.z = Math.PI / 2; manta.castShadow = true; bulto.add(manta);
    const cara = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf0c4a0, roughness: 0.7 })); cara.position.set(0.24, 0.03, 0); bulto.add(cara);
    bulto.scale.setScalar(1 / 1.47); v.g.add(bulto); v.bulto = bulto;
    vis[a.id] = v;
    if (plantillas) cuerpoHijo(v, a);
    return v;
  }
  function cuerpoHijo(v, a) {
    // los niños usan el cuerpo de Andrés (sin barba); de grandes, las niñas el de María
    const deMaria = a.sexo === 'm' && ['joven', 'adulto'].includes(a.etapa);
    const base = deMaria ? plantillas.lucia : plantillas.tomas, alto = MODELOS[deMaria ? 'lucia' : 'tomas'][1];
    const m = SkeletonUtils.clone(base.scene), k = v.h * ESCALA_PERSONA / alto;
    m.scale.setScalar(k); m.quaternion.copy(qDePie);
    const tinte = { andres_camiseta: COLOR_HIJO[a.sexo], maria_polera: COLOR_HIJO[a.sexo] };
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (/Beard/i.test(o.name)) o.visible = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map((mt) => {
        if (!mt) return mt; const c = mt.clone();
        if (/pelo|Hair/i.test(mt.name)) c.color.setHex(0x8a6038);   // pelo castaño: mitad rubio, mitad negro
        if (tinte[mt.name] != null) c.color.setHex(tinte[mt.name]);
        return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    if (v.modelo) v.g.remove(v.modelo);
    v.g.add(m); m.updateMatrixWorld(true);
    Object.assign(v, { modelo: m, k0: k, k, mixer: new THREE.AnimationMixer(m), acciones: {}, clip: null, wPrev: null, uti: montarUtileria(m), femenino: deMaria ? montarFemenino(m) : null, etapaVis: null, cuerpoDe: deMaria ? 'lucia' : 'tomas' });
    v.huesoCabeza = m.getObjectByName('Head');
    for (const c of plantillas.anim.animations) v.acciones[c.name] = v.mixer.clipAction(c);
    animar(v, 'Idle_Loop');
  }
  function asegurarHijos(s) {
    let hay = false;
    for (const a of s.agentes) {
      if (a.tipo !== 'nino' && !vis[a.id]?.esHijo) continue;
      if (a.vivo && !a.seFue) hay = true;
      const v = vis[a.id] || crearVisHijo(a);
      if (plantillas && (!v.modelo || (v.cuerpoDe === 'tomas' && a.sexo === 'm' && ['joven', 'adulto'].includes(etapaDe(s, a))))) { a.etapa = etapaDe(s, a); cuerpoHijo(v, a); }
    }
    cuartoNinos.visible = hay;
  }
  for (const p of PERSONAJES) {
    if (p.tipo === 'humano') vis[p.id] = makePerson({ ...(LOOK[p.id] || { top: 0x6a8f4e, bottom: 0x3a3a40, skin: 0xe0b08a, hair: 0x2b2018, h: 1.45 }), detalles: p.fisico?.detalles || [] });
    else if (p.tipo === 'perro') vis[p.id] = makeDog();
    else vis[p.id] = makeCat();
    vis[p.id].ficha = p; vis[p.id].g.userData.agente = true;
  }
  for (const id in vis) {
    const v = vis[id];
    Object.assign(v, { last: V(0, 0, 0), yaw: 0, moving: 0, ready: false, walkPh: 0 });   // (sin walkPh, quien arrancaba adentro quedaba con posición NaN)
    const [tx, tz] = TOMBS[id] || [-6.6 + Object.keys(TOMBS).length * 0.1, 19.4];
    const tomb = new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.0, 0.25, 2, 0.12), tombMat); tomb.position.set(tx, 0.5, tz); tomb.visible = false; tomb.castShadow = true; root.add(tomb);
    v.tomb = tomb;
  }

  function sitioDe(a, s, t) {
    const T = a.tarea, tp = T?.tipo, i = a.id === 'tomas' ? 0 : 1;
    if (a.tipo === 'nino') {
      const k = Math.max(0, s.agentes.filter((x) => x.tipo === 'nino' && x.vivo).sort((x, y) => x.nacio - y.nacio).indexOf(a));
      if (tp === 'dormir') return SITIO['camaNino' + (k % 2)];
      if (tp === 'comer') return SITIO['silla' + (2 + (k % 2))];
      if (tp === 'beber') return SITIO.fregadero;
      return SITIO['juegoNino' + (k % 2)];
    }
    if (a.tipo === 'humano' && tp === 'cuidarBebe') return SITIO.cuna;
    if (a.tipo === 'humano') {
      if (tp === 'dormir' || tp === 'reposo') return SITIO['cama' + i];
      if (tp === 'cocinar' || tp === 'hacerConservas' || tp === 'hornear') return SITIO.estufa;
      if (tp === 'entrenar') return { ...SITIO['sala' + i], 5: 'entrenar' };
      if (tp === 'hacerQueso') return SITIO.fregadero;
      if (tp === 'cenar' || tp === 'comer') return SITIO['silla' + i];
      if (tp === 'beber' || tp === 'filtrar') return SITIO.fregadero;
      if (tp === 'leer') return i === 0 ? SITIO.sofa0 : SITIO.sillonAlto;
      if (tp === 'tejer') return SITIO.sillon;
      if (tp === 'siesta') return { ...SITIO['sofa' + i], 5: 'siesta' };
      if (tp === 'conversar' || tp === 'reconciliar' || tp === 'tomarVino' || tp === 'fumar') return SITIO['sofa' + i];
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
      v.ruta = actual === piso ? rutaInterior(v.ip, destino, piso) : [...rutaInterior(v.ip, ESCALERA[actual], actual), ESCALERA[piso].clone(), ...rutaInterior(ESCALERA[piso], destino, piso)];
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
        const cama = pose === 'acostado', camita = cama && sp[1] < -1.5;
        const yaw = cama ? Math.PI / 2 : 0;
        // lecho: altura de la superficie y dónde va la cabeza (las camas, hacia la cabecera; el sofá, hacia el brazo de la derecha)
        v.lecho = cama ? { arriba: PISO[piso] + (camita ? 0.47 : 0.57), eje: 'z', cabeza: camita ? -3.45 : -5.15 } : { arriba: PISO[piso] + 0.53, eje: 'x', cabeza: 3.95 };
        v.g.position.set(cama ? v.ip.x : 1.35, PISO[piso] + 0.7, cama ? (camita ? -2.2 : -3.6) : 4.55);
        if (v.ajusteLecho && v.ajusteLecho.clave === `${pose}${sp[1]}`) { v.g.position.x += v.ajusteLecho.dx; v.g.position.y += v.ajusteLecho.dy; v.g.position.z += v.ajusteLecho.dz; }
        else v.medirLecho = `${pose}${sp[1]}`;
        v.g.rotation.set(0, yaw, -Math.PI / 2);
        v.legs.forEach((l) => { l.hip.rotation.z = 0; l.knee.rotation.z = 0; });
        v.arms.forEach((arm, j) => arm.rotation.set(0, 0, 0.15));
        v.head.rotation.set(0, 0, 0.3);
        return;
      }
      const sentado = pose === 'sentado' ? 1 : 0;
      v.g.position.y = PISO[piso] - sentado * (v.h - 0.85) + Math.abs(Math.sin(ph)) * 0.04 * w + (pose === 'entrenar' ? Math.abs(Math.sin(t * 5)) * 0.18 : 0);
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
        if (pose === 'entrenar') z = Math.sin(t * 5) > 0 ? 2.9 : 0.15;
        if (sentado && (tp === 'cenar' || tp === 'comer') && j) z = 0.9 + Math.max(0, Math.sin(t * 3)) * 0.5;   // lleva el tenedor a la boca
        if (sentado && tp === 'leer') z = 1.0;
        if (sentado && tp === 'tejer') z = 1.0 + Math.sin(t * 8 + j * Math.PI) * 0.12;
        if (sentado && (tp === 'conversar' || tp === 'reconciliar') && j) z = 0.5 + Math.max(0, Math.sin(t * 1.3 + a.id.length)) * 0.7;
        if (sentado && (tp === 'tomarVino' || tp === 'fumar') && j) z = 0.8 + Math.max(0, Math.sin(t * 0.9 + a.id.length)) * 1.0;   // lleva la copa (o el porro) a la boca
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

  function poseAgenteBase(a, v, s, t, dt) {
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
      else if (tp === 'curar' || tp === 'cepillar') f = s.ganado.find((g) => g.id === T.animal)?.pos;
      else if (tp === 'reparar') f = LUGAR.taller;
      else if (tp === 'recogerFruta') f = s.frutales?.[T.arbol];
      else if (tp === 'construir') { const o = OBRAS.find((x) => x[0] === T.obra); if (o) f = { x: o[3], z: o[4] }; }
      else if (tp === 'cuidarJardin') f = s.jardines?.[T.jardin];
      else if (tp === 'secar') { const o = OBRAS.find((x) => x[0] === 'secadero'); f = { x: o[3], z: o[4] }; }
      else if (tp === 'alimentar' || ((tp === 'comer' || tp === 'beber') && v.kind !== 'humano')) f = LUGAR.comedero;
      else if (tp === 'vendimia' || tp === 'pisarUva') f = tp === 'pisarUva' ? LUGAR.lagar : s.parras?.reduce((m, q) => (q.uvas > (m?.uvas ?? -1) ? q : m), null);
      else if (tp === 'cosecharHierba') f = s.matas?.find((m) => m.estado === 'lista') || s.matas?.[0];
      else if (tp === 'comerciar') f = LUGAR.carreta;
      else if (['descansar', 'leer', 'siesta', 'tallar', 'tejer', 'tomarVino', 'fumar'].includes(tp)) v.yaw = angLerp(v.yaw, -Math.PI / 2, Math.min(1, dt * 5));
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
      const sit = ['descansar', 'leer', 'siesta', 'tallar', 'tejer', 'esculpir', 'tomarVino', 'fumar'].includes(tipo) ? 1 : 0;
      const asiento = tipo === 'tallar' || tipo === 'esculpir' ? 0.5 : 0.85;
      const agachado = tipo === 'jugarGato' || tipo === 'ordenar' || tipo === 'jugarPerro' || tipo === 'curar' || tipo === 'cepillar';
      const bend = ['cepillar', 'construir', 'cuidarJardin', 'secar', 'recogerFruta', 'regar', 'sembrar', 'cosechar', 'limpiar', 'sacarAgua', 'alimentar', 'jugarGato', 'ordenar', 'esquilar', 'segar', 'alimentarGanado', 'recogerHuevos', 'reparar', 'curar', 'recogerFlores', 'jugarPerro', 'vendimia', 'cosecharHierba', 'pisarUva', 'renovar'].includes(tipo) ? 1 : 0;
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
        if ((tipo === 'tomarVino' || tipo === 'fumar') && j) z = 0.8 + Math.max(0, Math.sin(t * 0.9 + a.id.length)) * 1.0;
        if (tipo === 'contemplar') { z = -0.35; x = (j ? 1 : -1) * 0.15; }   // manos atrás
        if ((tipo === 'conversar' || tipo === 'reconciliar') && j) z = 0.5 + habla * 0.7;              // gesticula al hablar
        if (abrazando) { z = 1.35; x = (j ? -1 : 1) * 0.45; }
        arm.rotation.set(x, 0, z);
      });
      if (tipo === 'tejer') v.arms.forEach((arm, j) => arm.rotation.set(0, 0, 1.0 + Math.sin(t * 8 + j * Math.PI) * 0.12));
      v.libro.visible = tipo === 'leer';
      v.pieza.visible = tipo === 'tallar' || tipo === 'esculpir';
      if (tipo === 'entrenar') { const up = Math.sin(t * 5 + a.id.length) > 0; v.arms.forEach((arm) => arm.rotation.set(0, 0, up ? 2.9 : 0.15)); v.g.position.y += Math.abs(Math.sin(t * 5 + a.id.length)) * 0.18; }   // saltos de tijera
      v.head.rotation.set(0, 0, bend ? -0.3 : lee ? -0.35 : tipo === 'contemplar' ? 0.15 : tipo === 'siesta' ? -0.45 : 0);
    } else {
      const tipo = trabajando ? T.tipo : null;
      const sleep = tipo === 'dormir' ? 1 : 0, sit = !w && !sleep ? 1 : 0, eat = tipo === 'comer' || tipo === 'beber' ? 1 : 0;
      const juega = a.tarea?.tipo === 'jugar' ? 1 : 0;
      v.g.position.y = Math.abs(Math.sin(ph)) * 0.05 * w - sleep * 0.25 + juega * Math.max(0, Math.sin(t * 5)) * 0.45;
      // trepado: sube de a poco hasta el árbol, el techo, la caseta o el gallinero
      const alto = a.trepado ? (a.trepado.alto === 'techo' ? alturaTecho : alturaTrepadero(a)) : 0;
      v.altura = (v.altura || 0) + (alto - (v.altura || 0)) * Math.min(1, dt * 2.2);
      v.g.position.y += v.altura;
      if (a.tarea?.tipo === 'pelea') { v.g.position.y += Math.abs(Math.sin(t * 14 + v.yaw)) * 0.25; v.g.rotation.z = Math.sin(t * 11) * 0.5; }
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
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); ray.layers.enableAll();   // también ve las piezas apartadas en lotes
  let planosListos = false;
  let downAt = null, seleccion = null, ultimoToque = null, vuelo = null, vistaLejos = null;
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), pTmp = new THREE.Vector3();
  function dobleToque(e, r) {
    const off = controls.target.clone().sub(camera.position), dist = off.length();
    if (!vistaLejos || dist > vistaLejos.dist * 0.6) {   // acercar
      if (!vistaLejos) vistaLejos = { dist, target: controls.target.clone(), pos: camera.position.clone() };
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      if (!ray.ray.intersectPlane(plano, pTmp) || pTmp.distanceTo(CENTER) > 50) return;
      const nuevoT = pTmp.clone(); nuevoT.y = 1.5;
      const nuevaD = Math.max(controls.minDistance * 3, dist * 0.32);
      vuelo = { t: 0, de: [controls.target.clone(), camera.position.clone()], a: [nuevoT, nuevoT.clone().sub(off.setLength(nuevaD))] };
    } else {   // volver a la vista completa
      vuelo = { t: 0, de: [controls.target.clone(), camera.position.clone()], a: [vistaLejos.target.clone(), vistaLejos.pos.clone()] };
      vistaLejos = null;
    }
  }
  function volar(dt) {
    if (!vuelo) return;
    vuelo.t = Math.min(1, vuelo.t + dt / 0.55); const k = vuelo.t * vuelo.t * (3 - 2 * vuelo.t);
    controls.target.lerpVectors(vuelo.de[0], vuelo.a[0], k); camera.position.lerpVectors(vuelo.de[1], vuelo.a[1], k);
    if (vuelo.t >= 1) vuelo = null;
  }
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > (e.pointerType === 'touch' ? 14 : 6)) return;
    const r = renderer.domElement.getBoundingClientRect();
    // doble toque: acerca la cámara a ese punto (y si ya está cerca, vuelve a la vista completa)
    const ahora = performance.now();
    if (e.pointerType === 'touch' && ultimoToque && ahora - ultimoToque.t < 320 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 40) {
      clearTimeout(ultimoToque.espera); ultimoToque = null; dobleToque(e, r); return;
    }
    if (e.pointerType !== 'touch') return toqueSimple(e, r);
    // con el dedo, el toque simple espera un instante: si llega un segundo toque era un doble toque
    const x = e.clientX, y = e.clientY;
    ultimoToque = { t: ahora, x, y, espera: setTimeout(() => { ultimoToque = null; toqueSimple({ clientX: x, clientY: y, pointerType: 'touch' }, r); }, 300) };
  });
  function toqueSimple(e, r) {
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    // ¿tocó a una persona? (se proyecta cada una a la pantalla: son pequeñas y así es fácil tocarlas)
    if (onAgente) {
      let mejor = null, dmin = e.pointerType === 'touch' ? 56 : 44;   // con el dedo se apunta menos fino
      for (const [id, v] of Object.entries(vis)) {
        if (v.kind !== 'humano' || !v.g.visible) continue;
        const w = new THREE.Vector3(); v.g.getWorldPosition(w); w.y += 0.9; w.project(camera);
        const sx = (w.x + 1) / 2 * r.width + r.left, sy = (1 - w.y) / 2 * r.height + r.top, dd = Math.hypot(sx - e.clientX, sy - e.clientY);
        if (w.z < 1 && dd < dmin) { dmin = dd; mejor = id; }
      }
      if (mejor) { onAgente(mejor); return; }
    }
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(parcelas.map((p) => p.soil))[0];
    if (hit && onParcela) onParcela(hit.object.userData.parcela);
  }

  // ------------------------------------------------------------ tamaño
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); labelRenderer.setSize(w, h); camera.aspect = w / h;
    // pantalla vertical (celular): lente más abierta para que el orbe quepa de lado a lado sin alejar tanto la cámara
    camera.fov = w < h ? 28 + Math.min(1, (h / w - 1) / 1.2) * 18 : 28;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  // calidad adaptativa: si el equipo no da (celulares, portátiles viejos), baja de a un paso la resolución y luego las sombras
  const PASOS = tactil ? [   // celular: baja pero nunca por debajo de 1 (se vería borroso)
    () => renderer.setPixelRatio(Math.min(devicePixelRatio, 1.3)),
    () => { renderer.shadowMap.type = THREE.PCFShadowMap; key.shadow.map?.dispose(); key.shadow.map = null; },
    () => renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0)),
    () => { key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = 0.09; key.shadow.map?.dispose(); key.shadow.map = null; },
  ] : [
    () => renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0)),
    () => { key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = 0.09; key.shadow.map?.dispose(); key.shadow.map = null; },
    () => renderer.setPixelRatio(Math.min(devicePixelRatio, 0.8)),
    () => { renderer.shadowMap.type = THREE.PCFShadowMap; key.shadow.map?.dispose(); key.shadow.map = null; },
    () => renderer.setPixelRatio(0.65),
  ];
  let paso = 0, acum = 0, nCal = 0, esperaCal = 4, ocupado = false;
  function calidad(dt) {
    if (paso >= PASOS.length || !cargada || document.hidden) return;
    if (ocupado) { acum = 0; nCal = 0; esperaCal = 2; return; }   // poniéndose al día: esos cuadros no cuentan
    if ((esperaCal -= dt) > 0) return;   // deja asentar la carga (y cada cambio) antes de medir
    acum += dt; nCal++;
    if (acum < 3) return;
    const prom = acum / nCal; acum = 0; nCal = 0;
    if (prom > 1 / 32) { PASOS[paso++](); esperaCal = 2; console.info('[granja] calidad baja un paso:', paso, (1 / prom).toFixed(0) + ' fps'); }
  }
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
    hemi.color.copy(pal.hs); hemi.groundColor.copy(pal.hg); hemi.intensity = 1.05 + day * 0.65 + night * 0.9;   // más luz en todo el orbe (también de noche)
    const sunUp = e > -0.02;
    dir.copy(sunUp ? sunPos : moonPos).sub(CENTER).normalize();
    key.position.copy(CENTER).addScaledVector(dir, 60);
    if (sunUp) { key.color.copy(SUN_LOW).lerp(SUN_HIGH, smooth(e, 0.02, 0.45)); key.intensity = 3.9 * smooth(e, -0.02, 0.2) * (1 - lluviaK * 0.5); }
    else { key.color.copy(MOON); key.intensity = 1.5 * night * (1 - lluviaK * 0.5); }
    renderer.toneMappingExposure = 1.12 + night * 0.55;
    relleno.forEach((l) => { l.intensity = 70 * day + 45 * night; l.color.set(night > 0.5 ? 0xb8c8ff : 0xfff1dc); });
    starMat.opacity = night * (1 - lluviaK) * (0.75 + 0.25 * Math.sin(t * 2));

    // luces
    for (const w of windows) w.mat.emissiveIntensity = 1.6 * (1 - smooth(e, w.on, w.on + 0.08));
    const homeOn = 1 - smooth(e, -0.06, 0.04);
    interior.forEach((pl) => { pl.intensity = 22 * homeOn; });
    porch.intensity = 14 * homeOn;
    for (const l of lamps) { l.pl.intensity = 95 * homeOn; l.lm.emissiveIntensity = 4.5 * homeOn; }
    haloMat.opacity = homeOn;

    // lluvia
    rainMat.opacity = lluviaK * (s.clima.granizando ? 0.95 : 0.55);
    rainMat.color.setHex(s.clima.granizando ? 0xffffff : 0xcfe2ff);
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
        v.hoja = p.cultivo ? viento(MAT[p.cultivo].clone()) : null;   // material propio: amarillea o se mancha según la salud y la plaga
      }
      // suelo pobre: tierra más pálida; encharcado: charco
      v.charco.visible = (p.encharcado || 0) > 90;
      if ((p.N ?? 60) < 35) v.soilMat.color.lerp(new THREE.Color(0xb59a74), 0.5);
      if (!p.cultivo) { v.bichos.visible = false; return; }
      if (v.hoja) {
        v.hoja.color.copy(MAT[p.cultivo].color);
        const malestar = Math.max(1 - (p.salud ?? 100) / 100, (p.plaga || 0) * 0.8);
        v.hoja.color.lerp(new THREE.Color(p.plagaTipo === 'hongo' ? 0xcfcfb8 : (p.plaga || 0) > 0.1 ? 0x8a6a3a : 0xc9b04a), Math.min(0.85, malestar));
      }
      v.bichos.visible = (p.plaga || 0) > 0.15;
      if (v.bichos.visible) {
        v.bichos.material.color.setHex(p.plagaTipo === 'hongo' ? 0xf2f0e6 : 0x2a2018);
        const pa = v.bichos.geometry.attributes.position;
        for (let k = 0; k < 12; k++) { const a = t * (1.5 + (k % 3)) + k * 2.1; pa.setXYZ(k, Math.cos(a) * (0.6 + (k % 4) * 0.35), 0.5 + Math.sin(a * 1.7 + k) * 0.25 + (k % 3) * 0.15, Math.sin(a * 0.8) * 0.8); }
        pa.needsUpdate = true;
      }
      const C = CULTIVOS[p.cultivo];
      const g = p.estado === 'lista' ? 1 : Math.round(Math.min(1, p.crec / C.dias) * 12) / 12;   // a saltos
      const dead = p.estado === 'muerta', dry = Math.round(Math.max(0, 1 - p.agua / 25) * 4) / 4;
      v.plants.children.forEach((pl, j) => {
        pl.scale.set(0.25 + g * 0.75, (0.15 + g * 0.85) * (dead ? 0.35 : 1 - dry * 0.15), 0.25 + g * 0.75);
        if (pl.userData.fruto) pl.userData.fruto.visible = p.estado === 'lista';
        for (const hm of pl.userData.hojas || []) hm.material = dead ? MAT.muerto : dry > 0.6 ? MAT.seco : v.hoja;
      });
    });

    const escarcha = Math.max(0, Math.min(1, -(s.clima.temp ?? 10) / 4 + 0.2)) * (night > 0.2 || (s.t % MIN_DIA) / 60 < 9 ? 1 : 0.3);
    pastoTerreno.color.copy(PASTO_BASE).lerp(ESCARCHA, escarcha * 0.7);
    compostVis.scale.set(1, Math.max(0.15, Math.min(1.6, (s.rec.pila || 0) / 60)), 1);
    tankLevel(s.rec.cruda / TANQUE_MAX);
    poseGanado(s, t, dt);
    pastoMat.color.setHSL(0.18 + Math.min(1, s.granja.pasto / 100) * 0.1, 0.45, 0.28 + Math.min(1, s.granja.pasto / 100) * 0.08); pastoPiso.color.copy(pastoMat.color);
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
    uViento.value = t; uRafaga.value = 1 + lluviaK;
    (s.jardines || []).forEach((j, i) => {
      const v = jardinesVis[i]; if (!v) return;
      const f = Math.max(0, Math.min(1, j.flores));
      v.flores.forEach((fl, k) => { const umbral = (k % 13) / 13; const vivo = f > umbral * 0.9; fl.visible = vivo; if (vivo) fl.scale.setScalar(0.4 + Math.round(f * 12) / 12 * 0.8); });   // crece a saltos: entre salto y salto queda quieta (y agrupada)
    });
    for (const o of s.obras || []) {
      const v = obrasVis[o.id]; if (!v) continue;
      v.g.visible = o.progreso > 0.001;
      v.andamio.visible = o.progreso > 0 && o.progreso < 1;
      v.cuerpo.scale.set(1, Math.max(0.05, o.progreso), 1);
    }
    esculturasVis.forEach((g, i) => { g.visible = i < (s.esculturas || 0); });
    // la casa y los proyectos: se reconstruye la casa solo cuando algo cambió
    {
      const K = s.casa || {}, hechos = K.mejoras || [], O = K.obra;
      const clave = `${vistaPrevia.casa || ''}${K.estilo}|${hechos.join(',')}|${O ? O.id + ':' + Math.floor(O.progreso * 10) : ''}`;
      if (clave !== casaClave) { casaClave = clave; construirCasa(s); }
      const estVis = hechos.includes('fachada') ? (K.estilo || 'rustico') : 'rustico';
      if (estVis !== temaActual) aplicarTema(estVis);
      for (const obj in ESTRUCTURAS) { const e = vistaPrevia[obj] || s.diseno?.[obj] || estVis; if (ESTRUCTURAS[obj].userData.est !== e) vestir(obj, e); }
      const k = (id) => (hechos.includes(id) ? 1 : O?.id === id ? Math.max(0.06, O.progreso) : 0);
      for (const id of ['bodegaVino', 'cultivoCaseta', 'piscina', 'jacuzzi', 'gimnasio']) { const g = proy[id], kk = k(id); g.visible = kk > 0; g.scale.y = kk || 1; }
      proy.cultivoCaseta.userData.luz.visible = hechos.includes('cultivoPro');
      if (proy.jacuzzi.visible) proy.jacuzzi.userData.burbujas.forEach((b, i) => { const a = t * 1.3 + i * 2.1, r = 0.2 + (i % 4) * 0.2; b.position.set(Math.cos(a) * r, 0.74 + Math.abs(Math.sin(t * 3 + i)) * 0.08, Math.sin(a) * r); });
      if (proy.gimnasio.visible) proy.gimnasio.userData.saco.rotation.z = Math.sin(t * 2.2) * 0.06;
      const so = O && SITIO_OBRA[O.id];
      proy.andamio.visible = !!so; if (so) proy.andamio.position.set(so[0], 0, so[1]);
      if (establoG) establoG.scale.set(hechos.includes('establo2') ? 1.35 : 1, 1, hechos.includes('establo2') ? 1.25 : 1);
      if (gallineroG) gallineroG.scale.setScalar(hechos.includes('gallinero2') ? 1.3 : 1);
      cocinaModerna.visible = hechos.includes('cocina'); banoG.visible = hechos.includes('bano');
      parrasVis.forEach((v, i) => { v.g.visible = i < (s.parras || []).length; });
    }
    {
      const est = Math.floor(s.t / MIN_DIA / 28) % 4;
      (s.parras || []).forEach((q, i) => { const v = parrasVis[i]; if (!v) return;
        v.racimos.forEach((r, k) => { r.visible = k < Math.round(q.uvas / 2); });
        v.hojas.forEach((h, k) => { h.visible = est !== 3 || k % 3 === 0; h.material = est === 2 && k % 2 ? hojaOtono : hojaParra; }); });
      (s.matas || []).forEach((m, i) => { const v = matasVis[i]; if (!v) return;
        v.planta.visible = m.estado !== 'vacia'; v.planta.scale.setScalar(0.3 + Math.round(Math.min(1, m.crec) * 12) / 12 * 1.25);
        v.flores.visible = m.estado === 'lista'; });
      colgados.visible = (s.curado || []).length > 0;
      barricasVis.forEach((b, i) => { b.visible = i < Math.min(4, (s.barricas || []).length * 2); });
      botellas.forEach((b, i) => { b.visible = i < Math.min(12, Math.ceil((s.rec.vino || 0) / 5)); });
      mostoVis.visible = (s.rec.uvas || 0) >= 3;
      // la carreta entra por el camino a las 8, se queda hasta las 5 y se va
      const V = s.comercio?.visita;
      const llega = V?.llega ?? -1e9, sale = V?.sale ?? -1e9;
      carreta.visible = !!V && s.t >= llega - 50 && s.t <= sale + 50;
      if (carreta.visible) {
        const k = s.t < llega ? (s.t - (llega - 50)) / 50 : s.t > sale ? 1 - (s.t - sale) / 50 : 1;   // 0 = en el borde, 1 = estacionada
        const ex = 47, ez = LUGAR.carreta.z + 2;
        carreta.position.set(ex + (LUGAR.carreta.x - ex) * k, 0, ez + (LUGAR.carreta.z - ez) * k);
        ramiro.rotation.y = k < 1 ? 0 : Math.sin(t * 0.5) * 0.4;
      }
    }
    abejas.pts.visible = day > 0.3 && !s.clima.lluvia && ((s.t / MIN_DIA / 28) | 0) % 4 !== 3;
    if (abejas.pts.visible) for (let i = 0; i < abejas.N; i++) { const a = t * (0.6 + (i % 5) * 0.13) + i * 1.7; abejas.pos.set([30 + Math.cos(a) * (4 + (i % 4) * 2) + Math.sin(a * 3.1) * 0.6, 0.9 + Math.sin(a * 2.3 + i) * 0.35, 3 + Math.sin(a * 0.9) * (3 + (i % 3)) + Math.cos(a * 2.7) * 0.5], i * 3); }
    abejas.pts.geometry.attributes.position.needsUpdate = true;
    (s.frutales || []).forEach((f, i) => { const v = frutales[i]; if (!v) return; v.frutas.forEach((m, k) => { m.visible = k < Math.floor(f.fruta); }); });

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
    asegurarHijos(s);
    for (const cv of caminosVis) {   // lajas puestas según el avance
      const k = Math.floor((s.caminos?.[cv.id]?.progreso || 0) * cv.piedras.length + 1e-6);
      if (k !== cv.n) { cv.n = k; cv.piedras.forEach((m, i) => { m.visible = i < k; }); }
    }
    for (const a of s.agentes) poseAgente(a, vis[a.id], s, t, dt);
    crisisVis(s, t, dt);
    efectos(s, dt);
    volar(dt);
    // el centro de la vista no se sale del terreno: se puede recorrer la granja pero no perderse fuera del orbe
    { const t0 = controls.target, dx = t0.x - CENTER.x, dz = t0.z - CENTER.z, d = Math.hypot(dx, dz), y = THREE.MathUtils.clamp(t0.y, 0.3, 14);
      if (d > 42 || y !== t0.y) { const k = d > 42 ? 42 / d : 1, nx = CENTER.x + dx * k, nz = CENTER.z + dz * k; camera.position.x += nx - t0.x; camera.position.z += nz - t0.z; camera.position.y += y - t0.y; t0.set(nx, y, nz); } }
    controls.update();
    calidad(dt);
    // profundidad: el plano cercano se aleja con la cámara (si no, de lejos las superficies casi pegadas titilan)
    const dCam = camera.position.distanceTo(controls.target), near = THREE.MathUtils.clamp(dCam * 0.02, 0.1, 8), far = dCam + 260;
    if (Math.abs(near - camera.near) > 0.02 * near || Math.abs(far - camera.far) > 5) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    renderer.shadowMap.needsUpdate = true;   // sombras en cada cuadro: saltearlas se ve como temblor
    renderer.render(scene, camera);
    if (cargada && !planosListos) {   // lo casi plano pegado al suelo (caminos, tablas, bordes) no proyecta sombra: se la haría a sí mismo y titila
      planosListos = true; const b = new THREE.Box3();
      scene.traverse((o) => { if (!o.isMesh || !o.castShadow) return; b.setFromObject(o); if (b.max.y - b.min.y < 0.1 && b.max.y < 0.4) o.castShadow = false; });
    }
    if (cargada) lotes.revisar(dt);
    // las etiquetas usan las matrices que ya se calcularon al dibujar: no recorrer la escena otra vez
    scene.matrixWorldAutoUpdate = false; labelRenderer.render(scene, camera); scene.matrixWorldAutoUpdate = true;
  }

  // ------------------------------------------------------------ efectos flotantes: corazones, charla, discusión, kikirikí
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const efectosVis = new Map();
  const EMOJI_EF = { corazones: '💞', charla: '💬', discusion: '💢', kikiriki: '🐓', ladrido: '🐕💥', pelea: '💥😾', alboroto: '🐔💨', llanto: '😢', borrachera: '🍷💫', quiebre: '💢😤' };
  let tReal = 0;
  // ------------------------------------------------------------ crisis a la vista: fuego, lobos y ladrón
  const fuegosVis = new Map();
  const llamaMat = new THREE.MeshStandardMaterial({ color: 0xff8a1a, emissive: 0xff5a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.85, depthWrite: false });
  const llamaMat2 = new THREE.MeshStandardMaterial({ color: 0xffd34a, emissive: 0xffb000, emissiveIntensity: 2.5, transparent: true, opacity: 0.8, depthWrite: false });
  const humoMat = new THREE.MeshStandardMaterial({ color: 0x55504a, transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 });
  function crearFuego(F) {
    const g = new THREE.Group(); root.add(g);
    const llamas = [];
    for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35 + Math.random() * 0.25, 1.2 + Math.random() * 0.8, 6), k % 2 ? llamaMat : llamaMat2); m.position.set((Math.random() - 0.5) * 1.6, 0.6, (Math.random() - 0.5) * 1.6); g.add(m); llamas.push(m); }
    const humo = []; for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), humoMat); g.add(m); humo.push({ m, f: Math.random() }); }
    const luz = new THREE.PointLight(0xff7a2a, 0, 14, 1.8); luz.position.y = 1.5; g.add(luz);
    const y = F.lugar === 'arbol' ? 3.6 : 0;
    g.position.set(F.x, y, F.z);
    return { g, llamas, humo, luz };
  }
  let lobosVis = null, plantillaPerro = null;
  const ladronVis = (() => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const capa = new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 1 });
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 10), capa); c.position.y = 0.9; c.castShadow = true; g.add(c);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 10), capa); cap.position.y = 1.85; g.add(cap);
    const saco = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a7350 })); saco.position.set(0.25, 1.2, -0.3); g.add(saco);
    return g;
  })();
  function crisisVis(s, t, dt) {
    // fuego
    const vivos = new Set();
    for (const F of s.fuegos || []) {
      vivos.add(F.id);
      let v = fuegosVis.get(F.id); if (!v) { v = crearFuego(F); fuegosVis.set(F.id, v); }
      const k = Math.max(0.15, F.intensidad);
      v.llamas.forEach((m, i) => { const fl = 0.75 + Math.sin(t * 9 + i * 1.7) * 0.18 + Math.sin(t * 15 + i) * 0.1; m.scale.set(k * fl, k * (1 + fl * 0.6), k * fl); m.position.y = 0.6 * k; });
      v.humo.forEach((h) => { h.f = (h.f + dt * 0.25) % 1; h.m.position.set(Math.sin(h.f * 9 + h.m.id) * 0.6 * k, 1 + h.f * 5 * k, Math.cos(h.f * 7 + h.m.id) * 0.6 * k); h.m.scale.setScalar(0.6 + h.f * 1.6 * k); });
      v.luz.intensity = 25 * k * (0.85 + Math.sin(t * 13) * 0.15);
    }
    for (const [id, v] of fuegosVis) if (!vivos.has(id)) { root.remove(v.g); fuegosVis.delete(id); }
    // lobos: una manada gris (el modelo del perro, más oscuro)
    const W = s.lobos;
    if (W && plantillaPerro && !lobosVis) {
      lobosVis = [];
      for (let i = 0; i < 4; i++) {
        const sc = SkeletonUtils.clone(plantillaPerro.scene);
        sc.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.set(0x6b665c); } });
        const ctrl = armarPerro({ scene: sc, animations: plantillaPerro.animations }, 0.85);
        root.add(ctrl.raiz); lobosVis.push({ ctrl, prev: null });
      }
    }
    if (lobosVis) lobosVis.forEach((L, i) => {
      const vis = !!W && i < W.n && s.t >= W.llegan - 30;
      L.ctrl.raiz.visible = vis; if (!vis) { L.prev = null; return; }
      const ang = i * 2.1 + t * 0.3, x = W.x + Math.cos(ang) * (1 + i * 0.4), z = W.z + Math.sin(ang) * (1 + i * 0.4);
      const prev = L.prev || { x, z }; const dx = x - prev.x, dz = z - prev.z;
      L.ctrl.raiz.position.set(x, 0, z); if (Math.hypot(dx, dz) > 1e-4) L.ctrl.raiz.rotation.y = Math.atan2(-dz, dx);
      L.ctrl.estado(Math.hypot(dx, dz) / Math.max(dt, 1e-3) > 0.5 ? 'corre' : 'quieto', 1.4); L.ctrl.update(dt); L.prev = { x, z };
    });
    // ladrón
    const Lr = s.ladron;
    ladronVis.visible = !!Lr && s.t >= Lr.llega;
    if (ladronVis.visible) { ladronVis.position.set(Lr.x, Math.abs(Math.sin(t * 8)) * 0.05, Lr.z); ladronVis.rotation.y = Math.atan2(-(8 - Lr.z), 4 - Lr.x); }
  }

  // ------------------------------------------------------------ cuerpos reales (Universal Base Characters de Quaternius, CC0) con animaciones
  // el muñeco de cajas sigue calculando dónde está cada uno y qué hace (queda invisible);
  // el cuerpo nuevo va montado encima y elige la animación según la tarea
  const MODELOS = { tomas: ['modelo/andres.glb', 1.81], lucia: ['modelo/maria.glb', 1.767] }, ESCALA_PERSONA = 1.3;
  const qDePie = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  const qAcostado = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));   // boca arriba, cabeza hacia +x
  {
    const L = new GLTFLoader();
    const cargar = (u) => new Promise((ok, mal) => L.load(u, ok, undefined, mal));
    Promise.all([cargar('modelo/animaciones.glb'), ...Object.values(MODELOS).map(([u]) => cargar(u))]).then(([anim, ...gs]) => {
      plantillas = { anim, tomas: gs[0], lucia: gs[1] };
      Object.keys(MODELOS).forEach((id, i) => {
        const v = vis[id]; if (!v) return;
        const m = gs[i].scene, k = v.h * ESCALA_PERSONA / MODELOS[id][1];   // más altos que el muñeco viejo: en proporción con los animales y la casa
        m.scale.setScalar(k); m.quaternion.copy(qDePie);
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
        v.g.children.forEach((c) => { c.visible = false; });
        v.g.add(m);
        m.updateMatrixWorld(true);
        Object.assign(v, { modelo: m, k, mixer: new THREE.AnimationMixer(m), acciones: {}, clip: null, wPrev: null, uti: montarUtileria(m), femenino: id === 'lucia' ? montarFemenino(m) : null });
        for (const c of anim.animations) v.acciones[c.name] = v.mixer.clipAction(c);
        animar(v, 'Idle_Loop');
      });
    }).catch((e) => console.warn('[granja] no se pudieron cargar los cuerpos nuevos; quedan los de siempre', e));
  }
  // Berlín y Axel (Animals Asset Pack de Styloo, CC0): el perro con sus animaciones, el gato movido por código
  {
    const L = new GLTFLoader(), cargar = (u) => new Promise((ok, mal) => L.load(u, ok, undefined, mal));
    const MASC = { nube: ['modelo/perro.glb', armarPerro, 0.78], esmoquin: ['modelo/gato.glb', armarGato, 0.38] };
    for (const [id, [u, armar, alto]] of Object.entries(MASC)) {
      cargar(u).then((g) => {
        const v = vis[id]; if (!v) return;
        if (id === 'nube') plantillaPerro = { scene: SkeletonUtils.clone(g.scene), animations: g.animations };
        const ctrl = armar(g, alto);
        v.g.children.forEach((c) => { c.visible = false; });
        v.g.add(ctrl.raiz); v.mascota = ctrl;
      }).catch((e) => console.warn('[granja] no se pudo cargar', u, e));
    }
  }
  function animar(v, nombre, ts = 1) {
    const a = v.acciones[nombre]; if (!a) return;
    a.timeScale = ts;
    if (v.clip === nombre) return;
    const prev = v.clip && v.acciones[v.clip];
    a.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    if (prev) prev.fadeOut(0.3);
    v.clip = nombre;
  }
  const RODILLA = ['empedrar', 'curarHerida', 'repararPozo', 'sembrar', 'cosechar', 'limpiar', 'cuidarJardin', 'recogerFlores', 'cosecharHierba', 'vendimia', 'regar', 'fumigar', 'arrancar', 'abonar', 'renovar', 'construir', 'reparar'];
  const AGACHADO = ['ordenar', 'cepillar', 'curar', 'jugarGato', 'jugarPerro', 'esquilar', 'recogerHuevos'];
  const CARGA = ['apagarFuego', 'sacarAgua', 'alimentarGanado', 'segar', 'alimentar', 'recogerFruta', 'voltearCompost', 'secar'];
  const SENTADO_FUERA = ['descansar', 'leer', 'siesta', 'tallar', 'tejer', 'esculpir', 'tomarVino', 'fumar'];
  const CHARLA = ['conversar', 'reconciliar', 'tomarVino', 'fumar', 'cenar'];
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qr = new THREE.Quaternion();
  function enderezarPiernas(v) {
    v.modelo.updateMatrixWorld(true);
    for (const lado of ['l', 'r']) {
      const th = v.modelo.getObjectByName('thigh_' + lado), pie = v.modelo.getObjectByName('foot_' + lado);
      if (!th || !pie) continue;
      th.getWorldPosition(_p); pie.getWorldPosition(_q);
      const dir = _q.sub(_p), largo = dir.length(); if (largo < 1e-4) continue;
      const hor = Math.hypot(dir.x, dir.z); if (hor < 1e-4) continue;
      const meta = new THREE.Vector3(dir.x / hor, -0.06, dir.z / hor).normalize();   // casi horizontal, apenas hacia abajo
      _qr.setFromUnitVectors(dir.normalize(), meta);
      th.parent.getWorldQuaternion(_qp);
      th.quaternion.premultiply(_qa.copy(_qp).invert().multiply(_qr).multiply(_qp));
      th.updateMatrixWorld(true);
    }
  }
  function medirLecho(v) {
    const clave = v.medirLecho; v.medirLecho = null;
    v.modelo.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, z0 = 1e9, z1 = -1e9;
    v.modelo.traverse((o) => {
      if (!o.isSkinnedMesh || !o.visible) return; const P = o.geometry.attributes.position;
      for (let i = 0; i < P.count; i += 9) { o.getVertexPosition(i, _p); o.localToWorld(_p); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); z0 = Math.min(z0, _p.z); z1 = Math.max(z1, _p.z); }
    });
    if (x0 > x1) return;
    const L = v.lecho, pel = v.modelo.getObjectByName('pelvis');
    let dy = L.arriba + 0.02 - y0;
    if (pel) {
      pel.getWorldPosition(_p); const py = _p.y, pz = _p.z, px = _p.x;
      // en la cama: tapado con la cobija (la cadera a la altura de la cobija); en el sofá: la espalda apoyada
      if (L.eje === 'z') dy = L.arriba + 0.04 - py;
      else { let ym = 1e9; v.modelo.traverse((o) => { if (!o.isSkinnedMesh || !o.visible) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 9) { o.getVertexPosition(i, _p); o.localToWorld(_p); if (Math.abs(_p.x - px) < 0.6 && _p.y < ym) ym = _p.y; } }); if (ym < 1e9) dy = L.arriba + 0.02 - ym; }
    }
    const dz = L.eje === 'z' ? L.cabeza - z0 : 0, dx = L.eje === 'x' ? L.cabeza - x1 : 0;   // la cabeza justo en la almohada (o en el brazo del sofá)
    v.ajusteLecho = { clave, dx, dy, dz };
  }
  // hijos: cuerpo según la edad (bebé en la cuna; después, cada vez más grande)
  const ESCALA_ETAPA = { bebe: 0.3, nino: 0.56, joven: 0.82, adulto: 0.96 }, CABEZA_ETAPA = { nino: 1.32, joven: 1.1 };
  function ajustarEdad(a, v, s) {
    const et = etapaDe(s, a);
    if (v.etapaVis === et || !v.modelo) return et;
    v.etapaVis = et; const f = ESCALA_ETAPA[et];
    v.modelo.scale.setScalar(v.k0 * f); v.k = v.k0 * f; v.cabeza = CABEZA_ETAPA[et] || 1; v.ajusteLecho = null;
    if (v.huesoCabeza && !CABEZA_ETAPA[et]) v.huesoCabeza.scale.setScalar(1);
    return et;
  }
  function poseBebe(a, v, s, t) {
    v.tomb.visible = false; v.g.visible = true;
    if (v.modelo) v.modelo.visible = false;
    v.bulto.visible = true;
    v.g.position.set(CUNA.x, PISO[1] + 0.56, CUNA.z); v.g.rotation.set(0, 0, 0);
    const llora = a.accion.startsWith('Llorando');
    v.bulto.rotation.set(0, Math.PI / 2, llora ? Math.sin(t * 11) * 0.12 : Math.sin(t * 0.8) * 0.02);
  }
  function poseAgente(a, v, s, t, dt) {
    if (!v) return;
    if (a.tipo === 'nino' || v.esHijo) {
      if (a.seFue) { v.g.visible = false; v.tomb.visible = false; return; }
      const et = a.vivo ? ajustarEdad(a, v, s) : null;
      if (et === 'bebe') { poseBebe(a, v, s, t); return; }
      v.bulto.visible = false; if (v.modelo) v.modelo.visible = true;
    }
    poseAgenteBase(a, v, s, t, dt);
    if (v.mascota) {
      // la pose de la mascota según lo que hace
      const T = a.tarea, tp = T?.tipo, fase = T?.fase;
      const w = v.g.getWorldPosition(new THREE.Vector3());
      const rap = v.wPrev && dt > 0 ? Math.hypot(w.x - v.wPrev.x, w.z - v.wPrev.z) / dt : 0; v.wPrev = w;
      v.rap = (v.rap ?? 0) + (Math.min(rap, 12) - (v.rap ?? 0)) * Math.min(1, dt * 6);
      let e = 'quieto', ts = 1;
      if (!a.vivo || (['dormir', 'dormirCon'].includes(tp) && fase === 'trabajo') || (tp === 'siesta' && fase === 'trabajo')) e = 'dormido';
      else if (tp === 'pelea') e = 'pelea';
      else if (a.trepado || (tp === 'regazo' && fase === 'trabajo') || (tp === 'ladrar' && fase === 'trabajo')) e = 'sentado';
      else if (v.rap > 0.25) { const prisa = ['perseguir', 'huir', 'jugarJuntos', 'jugar', 'pelota'].includes(tp) || v.rap > 3.2; e = prisa ? 'corre' : 'camina'; ts = THREE.MathUtils.clamp(v.rap / (prisa ? 3.0 : 1.4), 0.6, 2.2); }
      else if (['jugar', 'jugarJuntos'].includes(tp)) e = 'juega';
      v.mascota.estado(e, ts);
      v.g.rotation.x = 0; v.g.rotation.z = 0;
      v.mascota.raiz.position.y = (a.vivo ? (v.altura || 0) : 0) - v.g.position.y;
      v.mascota.update(dt);
      return;
    }
    if (!v.modelo) return;
    const m = v.modelo, T = a.tarea, tipo = T && T.fase === 'trabajo' ? T.tipo : null;
    // velocidad real en pantalla
    const w = v.g.getWorldPosition(new THREE.Vector3());
    const rap = v.wPrev && dt > 0 ? Math.hypot(w.x - v.wPrev.x, w.z - v.wPrev.z) / dt : 0; v.wPrev = w;
    v.rap = (v.rap ?? 0) + (Math.min(rap, 12) - (v.rap ?? 0)) * Math.min(1, dt * 6);
    m.quaternion.copy(qDePie); m.position.set(0, 0, 0); v.acostadoAhora = false;
    if (!a.vivo || Math.abs(v.g.rotation.z) > 0.5) {
      // acostado (cama, sofá o tumba): se endereza el grupo y se acuesta el cuerpo boca arriba
      const yaw = v.g.rotation.y; v.g.rotation.set(0, yaw, 0); m.quaternion.copy(qAcostado); v.acostadoAhora = true;
      m.position.y = a.vivo ? -0.05 : -0.2;
      animar(v, 'Idle_Loop', a.vivo ? 0.25 : 0);
    } else if (a.nadando) {
      v.g.rotation.set(0, v.g.rotation.y, 0); m.position.y = (-0.62 - v.g.position.y) / v.g.scale.y;
      animar(v, (T && T.tipo === 'nadar' && v.rap > 0.3) ? 'Swim_Fwd_Loop' : 'Swim_Idle_Loop');
    } else {
      v.g.rotation.x = 0;
      const dentro = a.dentro, piso = dentro && v.ip ? (v.ip.y > 2 ? 1 : 0) : 0, suelo = dentro ? PISO[piso] : 0;
      let base = suelo, clip = 'Idle_Loop', ts = 1;
      const quieto = dentro ? (!v.ruta || !v.ruta.length) && v.moving < 0.4 : v.moving < 0.4;
      const pose = dentro ? (quieto ? sitioDe(a, s, t)[5] : 'camina') : null;
      if (!quieto) { clip = 'Walk_Loop'; ts = THREE.MathUtils.clamp(v.rap / (1.25 * v.k), 0.6, 2.1); }   // siempre caminan (el paso sigue a la velocidad)
      else if (dentro ? pose === 'sentado' : SENTADO_FUERA.includes(tipo)) {
        clip = CHARLA.includes(tipo) ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
        const asiento = dentro ? suelo + 0.52 : tipo === 'tallar' || tipo === 'esculpir' ? 0.51 : 0.84;   // silla y sofá, tronco del taller, banca
        base = asiento - 0.46 * v.k * v.g.scale.y;   // 0,46 = de los pies a la cola al sentarse (medido), en la escala del mundo
      }
      else if (pose === 'entrenar' || tipo === 'entrenar') { clip = ['Punch_Jab', 'Jump_Loop', 'Punch_Cross'][Math.floor(t / 5 + a.id.length) % 3]; }
      else if (dentro && (pose === 'trabajo' || pose === 'limpiar')) clip = pose === 'limpiar' ? 'PickUp_Table' : 'Interact';
      else if (RODILLA.includes(tipo)) clip = 'Fixing_Kneeling';
      else if (AGACHADO.includes(tipo)) clip = 'Crouch_Idle_Loop';
      else if (CARGA.includes(tipo)) clip = 'PickUp_Table';
      else if (tipo === 'pisarUva') clip = 'Dance_Loop';
      else if (CHARLA.includes(tipo) || tipo === 'comerciar') clip = 'Idle_Talking_Loop';
      m.position.y = (base - v.g.position.y) / v.g.scale.y;
      animar(v, clip, ts);
    }
    // utilería en la mano según la tarea (también adentro: sartén, libro, agujas, copa…)
    v.uti.mostrar(a.vivo && !a.nadando && T && T.fase === 'trabajo' ? T.tipo : null);
    v.mixer.update(dt);
    if (v.cabeza && v.huesoCabeza) v.huesoCabeza.scale.setScalar(v.cabeza);   // los niños: cabeza más grande en proporción
    if (v.acostadoAhora) enderezarPiernas(v);   // acostado: las piernas apoyadas (la pose de pie trae la cadera flexionada)
    if (v.medirLecho && a.vivo && v.lecho && a.dentro) medirLecho(v);
    if (v.femenino) {   // María: cadera que se mece, hombros que contrarrestan, brazos pegados al cuerpo
      const w = v.acciones.Walk_Loop, anda = v.clip === 'Walk_Loop' && w ? Math.min(1, w.getEffectiveWeight()) : 0;
      const fase = w ? (w.time / w.getClip().duration) * Math.PI * 2 : 0;
      v.femenino.aplicar(fase, anda, ['Walk_Loop', 'Idle_Loop', 'Idle_Talking_Loop'].includes(v.clip));
    }
    v.uti.actualizar();
  }

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
  function encuadrar(margenIzq, margenDer, margenAbajo = 0, margenArriba = 0) {
    const W = renderer.domElement.clientWidth || innerWidth, H = renderer.domElement.clientHeight || innerHeight;
    camera.clearViewOffset();
    if (margenIzq || margenDer || margenAbajo || margenArriba) camera.setViewOffset(W, H, (margenDer - margenIzq) / 2, (margenAbajo - margenArriba) / 2, W, H);
    camera.updateProjectionMatrix();
    const utilW = Math.max(0.35, (W - margenIzq - margenDer) / W), utilH = Math.max(0.3, (H - margenAbajo - margenArriba) / H);
    const halfV = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * utilH);
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * utilW);
    const dist = (ORB_R + 6) / Math.sin(Math.min(halfV, halfH));
    controls.maxDistance = Math.max(380, dist * 1.25);
    camera.position.sub(controls.target).setLength(dist).add(controls.target);
  }


  return {
    update,
    seleccionar(i) { seleccion = i; },
    _vis: vis,   // (depuración)
    _fuegos: fuegosVis,
    _renderer: renderer, _scene: scene, _lotes: lotes, _camara: camera, _controles: controls,
    // dónde se ve cada persona en la pantalla (para tocarla y para depurar)
    proyectar(id) { const v = vis[id]; if (!v) return null; const r = renderer.domElement.getBoundingClientRect(), w = new THREE.Vector3(); v.g.getWorldPosition(w); w.y += 0.9; w.project(camera); return { x: (w.x + 1) / 2 * r.width + r.left, y: (1 - w.y) / 2 * r.height + r.top, visible: v.g.visible }; },
    encuadrar,
    // catálogo de diseños: mirar un estilo sin comprarlo, y llevar la cámara hasta la construcción
    previsualizar(obj, est) { if (est) vistaPrevia[obj] = est; else delete vistaPrevia[obj]; },
    enfocar(obj) {
      const P = { casa: { x: 0, z: 0, d: 34 }, pozo: { ...LUGAR.pozo, d: 14 }, caseta: { ...LUGAR.caseta, d: 12 }, gallinero: { ...LUGAR.gallinero, d: 18 }, establo: { ...LUGAR.establo, d: 22 } }[obj]; if (!P) return;
      const off = camera.position.clone().sub(controls.target); off.y = Math.max(off.y, off.length() * 0.45);
      const t = V(P.x, 1.5, P.z);
      vuelo = { t: 0, de: [controls.target.clone(), camera.position.clone()], a: [t, t.clone().add(off.setLength(P.d))] };
    },
    get cargada() { return cargada; },
    set ocupado(v) { ocupado = v; },
  };
}
