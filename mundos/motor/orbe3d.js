// =====================================================================
// La base común de los orbes: el cristal, la base de madera, el suelo, el cielo con su ciclo de día y noche,
// la cámara (girar, acercar, desplazarse, seguir a alguien, volar a un punto) y la calidad de imagen.
// Además: un fundidor de mallas con color por vértice y personas low-poly animables (pocas llamadas de dibujo).
// Cada mundo pone su contenido en `orbe.mundo` y registra lo que hace en cada cuadro con `orbe.cada(fn)`.
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const suave = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const angLerp = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;

// ---------------------------------------------------------------- calidad: nítida (resolución de la pantalla, nunca menos de 1)
export function leerCalidad() { try { return localStorage.getItem('orbes-calidad') || 'auto'; } catch { return 'auto'; } }
export function guardarCalidad(m) { try { localStorage.setItem('orbes-calidad', m); } catch { /* sin almacenamiento */ } }

export function crearOrbe(host, opts = {}) {
  const R = opts.radio ?? 46, modo = opts.calidad || leerCalidad();
  const tactil = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.max(1, Math.min(devicePixelRatio * (modo === 'ultra' ? 1.25 : 1), modo === 'ultra' ? 2.5 : 2)));
  renderer.shadowMap.enabled = opts.sombras !== false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 1200);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: true, screenSpacePanning: false, minDistance: opts.minDist ?? 6, maxDistance: opts.maxDist ?? 360, maxPolarAngle: Math.PI * 0.47, zoomToCursor: true, panSpeed: 1.1, keyPanSpeed: 24 });
  controls.listenToKeyEvents?.(window);
  const cam0 = opts.camara || {};
  controls.target.copy(cam0.target || V(0, 2, 0)); camera.position.copy(cam0.pos || V(R * 1.3, R * 1.5, R * 2.4));
  // no salir del orbe al desplazarse
  controls.addEventListener('change', () => { const t = controls.target, d = Math.hypot(t.x, t.z), lim = R * 0.95; if (d > lim) { const k = lim / d, dx = t.x * (1 - k), dz = t.z * (1 - k); t.x -= dx; t.z -= dz; camera.position.x -= dx; camera.position.z -= dz; } });

  // ------------------------------------------------------------ luz
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.15); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 3);
  sol.castShadow = opts.sombras !== false; const tamS = tactil && modo === 'auto' ? 2048 : 4096; sol.shadow.mapSize.set(tamS, tamS);
  Object.assign(sol.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: R * 6 }); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.04;
  scene.add(sol, sol.target);
  const luna = new THREE.DirectionalLight(0x9fb4ff, 0); scene.add(luna, luna.target);

  // ------------------------------------------------------------ cielo, cristal, base y suelo
  const cieloMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uTop, uHor; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-0.1, 0.7, vP.y)), 1.); }' });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(R + 5, 40, 24), cieloMat); cielo.position.y = 4; cielo.renderOrder = -2; scene.add(cielo);
  const cristal = new THREE.Mesh(new THREE.SphereGeometry(R + 5.4, 56, 32), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false }));
  cristal.position.y = 4; cristal.renderOrder = 10; scene.add(cristal);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 6, R + 8, 6, 72), new THREE.MeshStandardMaterial({ color: opts.colorBase ?? 0x2b2420, roughness: 0.6 })); base.position.y = -3.4; base.receiveShadow = true; scene.add(base);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(R + 6.1, 0.18, 8, 96), new THREE.MeshStandardMaterial({ color: 0xc9a35a, metalness: 0.7, roughness: 0.3 })); aro.rotation.x = Math.PI / 2; aro.position.y = -0.4; scene.add(aro);
  const suelo = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.4, 96), new THREE.MeshStandardMaterial({ color: opts.colorSuelo ?? 0x7a9a5a, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  suelo.position.y = -0.2; suelo.receiveShadow = true; scene.add(suelo);
  const mundo = new THREE.Group(); scene.add(mundo);

  // ------------------------------------------------------------ ciclo de día y noche
  const PAL = [
    { e: -1, top: 0x050a1f, hor: 0x16204a }, { e: -0.05, top: 0x1f2860, hor: 0x8a5a86 }, { e: 0.1, top: 0x4a66a6, hor: 0xffab7a }, { e: 0.35, top: 0x4a8ad8, hor: 0xcfe8f7 }, { e: 1, top: 0x3a7ad0, hor: 0xbfe0f5 },
  ].map((k) => ({ e: k.e, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor) }));
  const cTop = new THREE.Color(), cHor = new THREE.Color();
  let luz = { dia: 1, noche: 0 };
  // h: hora del día (0-24). Devuelve cuánto es de día (0-1) y de noche (0-1) para que el mundo encienda sus luces
  function setHora(h, { nublado = 0 } = {}) {
    const ph = (((h - 6) / 24) % 1 + 1) % 1, th = ph * Math.PI * 2, e = Math.sin(th);
    const dia = suave(e, -0.04, 0.22), noche = 1 - suave(e, -0.22, 0);
    sol.position.set(Math.cos(th) * R * 2.2, Math.max(4, e * R * 2.6), R * 0.9); sol.target.position.set(0, 0, 0);
    sol.intensity = 3.1 * dia * (1 - nublado * 0.55); sol.color.setHSL(0.09, 0.6 * (1 - suave(e, 0.1, 0.5)), 0.6 + 0.4 * suave(e, 0.05, 0.5));
    luna.position.set(-Math.cos(th) * R * 2, R * 2, -R); luna.intensity = noche * 0.6;
    hemi.intensity = 0.35 + 0.85 * dia; hemi.color.setHSL(0.6, 0.35, 0.55 + 0.4 * dia);
    let a = PAL[0], b = PAL[PAL.length - 1];
    for (let i = 0; i < PAL.length - 1; i++) if (e >= PAL[i].e && e <= PAL[i + 1].e) { a = PAL[i]; b = PAL[i + 1]; break; }
    const k = (e - a.e) / Math.max(1e-6, b.e - a.e);
    cTop.copy(a.top).lerp(b.top, k); cHor.copy(a.hor).lerp(b.hor, k);
    if (nublado) { cTop.lerp(new THREE.Color(0x6a7280), nublado * 0.6 * dia); cHor.lerp(new THREE.Color(0x9aa2ac), nublado * 0.6 * dia); }
    cieloMat.uniforms.uTop.value.copy(cTop); cieloMat.uniforms.uHor.value.copy(cHor);
    renderer.toneMappingExposure = 1.1 + noche * 0.5;
    luz = { dia, noche }; return luz;
  }
  setHora(10);

  // ------------------------------------------------------------ cámara: seguir y volar
  let vuelo = null, seguido = null; const pSeg = V(), dSeg = V();
  function volar(objetivo, dist = null) {
    const off = camera.position.clone().sub(controls.target); if (dist) off.setLength(dist);
    if (off.y < off.length() * 0.35) off.y = off.length() * 0.45;
    vuelo = { t: 0, de: [controls.target.clone(), camera.position.clone()], a: [objetivo.clone(), objetivo.clone().add(off)] };
  }
  // fn: devuelve un Vector3 (o null) con la posición a seguir; null deja de seguir
  function seguir(fn, dist = 18) { seguido = fn || null; if (seguido) { const p = seguido(); if (p) volar(p, Math.min(dist, camera.position.distanceTo(controls.target))); } }

  // ------------------------------------------------------------ tamaño, cuadros y calidad adaptativa (solo sombras; la resolución no se toca)
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 32 + Math.min(1, (h / w - 1) / 1.2) * 16 : 32; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  const fns = []; let t = 0, ultimo = performance.now(), acum = 0, n = 0, pasoCal = 0;
  const PASOS = modo === 'ultra' ? [] : [() => { renderer.shadowMap.type = THREE.PCFShadowMap; sol.shadow.map?.dispose(); sol.shadow.map = null; }, () => { sol.shadow.mapSize.set(2048, 2048); sol.shadow.map?.dispose(); sol.shadow.map = null; }];
  function cuadro() {
    requestAnimationFrame(cuadro);
    if (document.hidden) { ultimo = performance.now(); return; }
    const ahora = performance.now(), dt = Math.min(0.1, (ahora - ultimo) / 1000); ultimo = ahora; t += dt;
    for (const f of fns) f(dt, t);
    if (vuelo) { vuelo.t = Math.min(1, vuelo.t + dt / 0.6); const k = vuelo.t * vuelo.t * (3 - 2 * vuelo.t); controls.target.lerpVectors(vuelo.de[0], vuelo.a[0], k); camera.position.lerpVectors(vuelo.de[1], vuelo.a[1], k); if (vuelo.t >= 1) vuelo = null; }
    else if (seguido) { const p = seguido(); if (p) { dSeg.copy(p).sub(controls.target).multiplyScalar(Math.min(1, dt * 4)); controls.target.add(dSeg); camera.position.add(dSeg); } else seguido = null; }
    controls.update();
    renderer.render(scene, camera);
    if (pasoCal < PASOS.length && t > 6) { acum += dt; n++; if (acum > 4) { if (acum / n > 1 / 26) PASOS[pasoCal++](); acum = 0; n = 0; } }
  }
  requestAnimationFrame(cuadro);

  // ------------------------------------------------------------ utilidades
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), plano = new THREE.Plane(V(0, 1, 0), 0);
  // punto del suelo bajo el cursor (o null si cae fuera del orbe)
  function sueloEn(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    const p = V(); if (!ray.ray.intersectPlane(plano, p)) return null; return Math.hypot(p.x, p.z) < R ? p : null;
  }
  // objeto tocado entre `lista` (devuelve el primero que tenga userData.id en su cadena)
  function tocar(ev, lista) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    for (const h of ray.intersectObjects(lista, true)) { for (let o = h.object; o; o = o.parent) if (o.userData?.id != null) return o.userData.id; }
    return null;
  }
  // un toque/clic que no fue arrastre
  function alTocar(fn) {
    let de = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { de = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => { if (de && Math.hypot(e.clientX - de[0], e.clientY - de[1]) < (e.pointerType === 'touch' ? 14 : 6)) fn(e); de = null; });
  }
  function proyectar(p) { const v = p.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, visible: v.z < 1 }; }

  return { THREE, renderer, scene, camera, controls, mundo, R, sol, hemi, suelo, setHora, get luz() { return luz; }, cada: (f) => fns.push(f), volar, seguir, get siguiendo() { return !!seguido; }, sueloEn, tocar, alTocar, proyectar, enOrbe: (x, z, m = 0) => Math.hypot(x, z) < R - m, modo, resize };
}

// ---------------------------------------------------------------- mallas fundidas con color por vértice (una llamada de dibujo por pieza)
export const MAT_VERTICE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
// partes: [geometría, color, x, y, z, sx, sy, sz, rx, ry, rz]
export function fundirGeo(partes) {
  return mergeGeometries(partes.map(([geo, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(_m.compose(V(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), V(sx, sy, sz)));
    _c.set(c); const n = g.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) _c.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
  }));
}
export function fundir(partes, mat = MAT_VERTICE) { const m = new THREE.Mesh(fundirGeo(partes), mat); m.castShadow = true; m.receiveShadow = true; return m; }
export const GEO = { esfera: new THREE.IcosahedronGeometry(1, 1), esferaFina: new THREE.IcosahedronGeometry(1, 2), caja: new THREE.BoxGeometry(1, 1, 1), cono: new THREE.ConeGeometry(1, 1, 6), cil: new THREE.CylinderGeometry(1, 1, 1, 8), capsula: new THREE.CapsuleGeometry(0.5, 1, 3, 8) };

// ---------------------------------------------------------------- personas low-poly animables (cabeza, torso, brazos y piernas: 6 mallas)
// c: { piel, ropa, pantalon, pelo, zapatos, alto (1 = adulto ~1,8), ancho, pelo: color | null, peinado: 'corto'|'largo'|'calvo' }
export function crearPersona(c = {}) {
  const piel = c.piel ?? 0xd9a77a, ropa = c.ropa ?? 0x4a6a9a, pant = c.pantalon ?? 0x3a3a46, pelo = c.pelo ?? 0x3a2a1e, zap = c.zapatos ?? 0x2a2420, an = c.ancho ?? 1;
  const g = new THREE.Group(), cuerpo = new THREE.Group(); g.add(cuerpo);
  const torso = fundir([[GEO.capsula, ropa, 0, 0, 0, 0.42 * an, 0.42, 0.26], [GEO.esfera, piel, 0, 0.42, 0, 0.08, 0.06, 0.08]]); torso.position.y = 1.18; cuerpo.add(torso);
  const cab = new THREE.Group(); cab.position.y = 1.62; cuerpo.add(cab);
  const partesCab = [[GEO.esferaFina, piel, 0, 0.12, 0, 0.15, 0.17, 0.155], [GEO.esfera, 0x1a1a1a, -0.055, 0.14, 0.135, 0.018, 0.022, 0.012], [GEO.esfera, 0x1a1a1a, 0.055, 0.14, 0.135, 0.018, 0.022, 0.012]];
  if (c.peinado !== 'calvo' && pelo != null) partesCab.push([GEO.esferaFina, pelo, 0, 0.19, -0.02, 0.16, 0.12, 0.16]);
  if (c.peinado === 'largo') partesCab.push([GEO.caja, pelo, 0, 0.04, -0.1, 0.3, 0.32, 0.08]);
  if (c.extraCab) partesCab.push(...c.extraCab);
  cab.add(fundir(partesCab));
  const brazo = (sg) => { const p = new THREE.Group(); p.position.set(sg * 0.27 * an, 1.5, 0); cuerpo.add(p); p.add(fundir([[GEO.capsula, ropa, 0, -0.16, 0, 0.12, 0.2, 0.12], [GEO.capsula, piel, 0, -0.44, 0, 0.1, 0.22, 0.1], [GEO.esfera, piel, 0, -0.62, 0, 0.06, 0.07, 0.06]])); return p; };
  const pierna = (sg) => { const p = new THREE.Group(); p.position.set(sg * 0.11, 0.92, 0); cuerpo.add(p); p.add(fundir([[GEO.capsula, pant, 0, -0.42, 0, 0.15, 0.62, 0.15], [GEO.caja, zap, 0, -0.86, 0.05, 0.13, 0.08, 0.24]])); return p; };
  const brazos = [brazo(-1), brazo(1)], piernas = [pierna(-1), pierna(1)];
  if (c.extra) cuerpo.add(fundir(c.extra));
  g.scale.setScalar(c.alto ?? 1);
  return { g, cuerpo, torso, cab, brazos, piernas, fase: Math.random() * 6 };
}
// modo: 'quieto' | 'camina' | 'corre' | 'trabaja' | 'golpe' | 'zombi' | 'sentado' | 'muerto' | 'baila'; vel: rapidez (u/s) para el paso
export function animarPersona(p, modo, dt, vel = 1.4) {
  p.fase += dt * (modo === 'corre' ? 11 : modo === 'camina' || modo === 'zombi' ? 3 + vel * 2.2 : 3);
  const f = p.fase, [bl, br] = p.brazos, [pl, pr] = p.piernas;
  p.cuerpo.rotation.set(0, 0, 0); p.cuerpo.position.set(0, 0, 0); p.cab.rotation.set(0, 0, 0); p.torso.rotation.set(0, 0, 0);
  for (const x of [bl, br, pl, pr]) x.rotation.set(0, 0, 0);
  if (modo === 'camina' || modo === 'corre') {
    const a = modo === 'corre' ? 0.95 : 0.55;
    pl.rotation.x = Math.sin(f) * a; pr.rotation.x = -Math.sin(f) * a; bl.rotation.x = -Math.sin(f) * a * 0.9; br.rotation.x = Math.sin(f) * a * 0.9;
    p.cuerpo.position.y = Math.abs(Math.cos(f)) * (modo === 'corre' ? 0.08 : 0.04); if (modo === 'corre') p.cuerpo.rotation.x = 0.18;
  } else if (modo === 'zombi') {
    pl.rotation.x = Math.sin(f) * 0.35; pr.rotation.x = -Math.sin(f) * 0.35; bl.rotation.x = -1.45 + Math.sin(f * 1.3) * 0.12; br.rotation.x = -1.35 + Math.cos(f * 1.1) * 0.12;
    p.cuerpo.rotation.z = Math.sin(f * 0.5) * 0.12; p.cab.rotation.z = 0.35 + Math.sin(f * 0.7) * 0.1; p.cuerpo.position.y = Math.abs(Math.cos(f)) * 0.03;
  } else if (modo === 'trabaja') {
    bl.rotation.x = -0.9 + Math.sin(f * 2) * 0.6; br.rotation.x = -0.9 + Math.sin(f * 2 + 0.4) * 0.6; p.cuerpo.rotation.x = 0.25 + Math.sin(f * 2) * 0.08;
  } else if (modo === 'golpe') {
    const k = (Math.sin(f * 3) + 1) / 2; br.rotation.x = -1.6 * k; bl.rotation.x = -0.5; p.cuerpo.rotation.y = 0.3 * k;
  } else if (modo === 'sentado') {
    pl.rotation.x = -1.5; pr.rotation.x = -1.5; p.cuerpo.position.y = -0.45; bl.rotation.x = -0.4; br.rotation.x = -0.4;
  } else if (modo === 'muerto') {
    p.cuerpo.rotation.x = -Math.PI / 2; p.cuerpo.position.y = 0.15; bl.rotation.z = 0.6; br.rotation.z = -0.6;
  } else if (modo === 'baila') {
    bl.rotation.z = 2.4 + Math.sin(f * 2) * 0.4; br.rotation.z = -2.4 - Math.sin(f * 2) * 0.4; p.cuerpo.position.y = Math.abs(Math.sin(f * 2)) * 0.15; p.cuerpo.rotation.y = Math.sin(f) * 0.4;
  } else { bl.rotation.z = 0.06; br.rotation.z = -0.06; p.torso.scale.y = 1 + Math.sin(f) * 0.015; }
}
