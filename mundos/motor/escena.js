// =====================================================================
// Escena 3D genérica de un mundo en miniatura: el orbe, el cielo, los lugares de la ficha
// (armados por tipo en construcciones.js) y los personajes con cuerpos reales y animaciones.
// Solo DIBUJA el estado; la vida la decide el motor (sim.js).
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { construirCalle, construirTorre, construirLocal, construirParque } from './construcciones.js';
import { armarPerro, armarGato } from '../../js/mascotas3d.js';
import { montarFemenino } from '../../js/femenino.js';
import { crearLotes } from '../../js/lotes.js';
import { MIN_DIA, hora } from './sim.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angLerp = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
const BASE = '../';   // los cuerpos y animaciones se comparten con la granja

export function crearEscena(host, F, { onAgente } = {}) {
  const tactil = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tactil ? 1.6 : 1.25));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: true, screenSpacePanning: false, minDistance: 6, maxDistance: 320, maxPolarAngle: Math.PI * 0.47, zoomToCursor: true });
  controls.target.set(0, 2, 0); camera.position.set(60, 70, 110);
  const R = F.radio || 46;
  const lotes = crearLotes(scene);

  // ------------------------------------------------------------ luz, cielo y orbe
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.2); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 3); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 260 }); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.04;
  scene.add(sol, sol.target);
  const cieloMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uTop, uHor; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-0.1, 0.7, vP.y)), 1.); }' });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(R + 5, 32, 20), cieloMat); cielo.position.y = 4; scene.add(cielo);
  { const vid = new THREE.Mesh(new THREE.SphereGeometry(R + 5.4, 48, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0, side: THREE.FrontSide, depthWrite: false })); vid.position.y = 4; vid.renderOrder = 10; scene.add(vid); }
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 6, R + 8, 6, 64), new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6 })); base.position.y = -3.4; scene.add(base);
    const suelo = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 0.4, 64), new THREE.MeshStandardMaterial({ color: F.suelo ?? 0x7a9a5a, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 })); suelo.position.y = -0.2; suelo.receiveShadow = true; scene.add(suelo); }
  const PAL = [
    { e: -1, top: 0x050a1f, hor: 0x16204a }, { e: -0.05, top: 0x1f2860, hor: 0x8a5a86 }, { e: 0.1, top: 0x4a66a6, hor: 0xffab7a }, { e: 0.35, top: 0x4a8ad8, hor: 0xcfe8f7 }, { e: 1, top: 0x3f84d6, hor: 0xd6ecf8 },
  ].map((k) => ({ e: k.e, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor) }));

  // ------------------------------------------------------------ lugares
  const puntos = {}, ventanas = [], techos = [], lucesCalle = [];
  let carriles = null;
  if (F.acera) { const c = construirCalle(F); scene.add(c.grupo); lucesCalle.push(...c.luces); carriles = c.carriles; }
  for (const L of F.lugares) {
    let r = null;
    if (L.tipo === 'torre') r = construirTorre(L, F);
    else if (L.tipo === 'parque') r = construirParque(L);
    else if (['cafe', 'bar', 'taller', 'super', 'gym', 'oficina', 'clinica'].includes(L.tipo)) r = construirLocal(L);
    if (!r) continue;
    scene.add(r.grupo); ventanas.push(...r.ventanas); techos.push(...r.techos);
    if (L.tipo === 'torre') { for (const [k, p] of Object.entries(r.puntos)) if (k.startsWith('apto')) puntos[k] = p; puntos.lobby = { trabajo: r.puntos.porteria, adentro: r.puntos.lobby }; }
    else puntos[L.id] = r.puntos;
  }
  // los techos se aclaran al acercarse (para ver la vida adentro)
  const techoMats = [...new Set(techos.map((m) => m.material))].map((m) => { const c = m.clone(); c.transparent = true; return c; });
  techos.forEach((t) => { t.material = techoMats.find((m) => m.color.equals(t.material.color)); t.userData.sinLote = true; });

  // ------------------------------------------------------------ tráfico (adorno): autos dando la vuelta
  const autos = [];
  if (carriles) {
    const colores = [0xc8553d, 0x3a6ab8, 0xe2c04a, 0xf2efe8, 0x2b2d31, 0x4a8a5a];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(); g.userData.sinLote = true; scene.add(g);
      const c = colores[i]; const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 1.7), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 })); cuerpo.position.y = 0.6; cuerpo.castShadow = true; g.add(cuerpo);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.5), new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.1 })); cab.position.set(-0.2, 1.25, 0); g.add(cab);
      for (const [x, z] of [[1.1, 0.85], [-1.1, 0.85], [1.1, -0.85], [-1.1, -0.85]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); w.rotation.x = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
      const faro = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xfff2c8, emissiveIntensity: 0 }); for (const z of [-0.55, 0.55]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.3), faro); f.position.set(1.81, 0.7, z); g.add(f); }
      autos.push({ g, faro, u: i / 6, vel: 0.010 + (i % 3) * 0.002, carril: i % 2 });
    }
  }
  const recorrido = (k, u) => {   // vuelta al anillo de calles (k = carril)
    const C = carriles, x0 = k ? C.x0b : C.x0, x1 = k ? C.x1b : C.x1, z0 = k ? C.z0b : C.z0, z1 = k ? C.z1b : C.z1, W = x1 - x0, D = z1 - z0, P = 2 * (W + D);
    let d = ((k ? 1 - u : u) % 1 + 1) % 1 * P;
    if (d < W) return [x0 + d, z0, 0]; d -= W; if (d < D) return [x1, z0 + d, Math.PI / 2]; d -= D; if (d < W) return [x1 - d, z1, Math.PI]; d -= W; return [x0, z1 - d, -Math.PI / 2];
  };

  // ------------------------------------------------------------ personajes
  const vis = {};
  const qDePie = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  const qAcostado = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
  let plantillas = null, cargada = false;
  const L = new GLTFLoader(), cargar = (u) => new Promise((ok, mal) => L.load(u, ok, undefined, mal));
  Promise.all([cargar(BASE + 'modelo/animaciones.glb'), cargar(BASE + 'modelo/andres.glb'), cargar(BASE + 'modelo/maria.glb'), cargar(BASE + 'modelo/perro.glb'), cargar(BASE + 'modelo/gato.glb')])
    .then(([anim, andres, maria, perro, gato]) => { plantillas = { anim, andres, maria, perro, gato }; cargada = true; })
    .catch((e) => { console.warn('[mundo] no se pudieron cargar los cuerpos', e); cargada = true; });
  const ALTO = { andres: 1.81, maria: 1.767 };
  function crearCuerpo(a) {
    const p = F.personajes.find((x) => x.id === a.id) || {}, raiz = new THREE.Group(); raiz.userData.agente = true; scene.add(raiz);
    const v = { raiz, yaw: 0, pos: V(a.pos.x, 0.2, a.pos.z), especie: a.especie };
    if (a.especie === 'perro' || a.especie === 'gato') {
      const ctrl = a.especie === 'perro' ? armarPerro({ scene: SkeletonUtils.clone(plantillas.perro.scene), animations: plantillas.perro.animations }, 0.55) : armarGato({ scene: SkeletonUtils.clone(plantillas.gato.scene), animations: [] }, 0.28);
      raiz.add(ctrl.raiz); v.mascota = ctrl; return v;
    }
    const cuerpo = p.cuerpo || (a.sexo === 'm' ? 'maria' : 'andres'), A = p.aspecto || {};
    const m = SkeletonUtils.clone(plantillas[cuerpo].scene), k = (A.alto || 1) * (p.edad > 65 ? 0.97 : 1);
    m.scale.setScalar(k); m.quaternion.copy(qDePie);
    m.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (/Beard/i.test(o.name) && A.sinBarba !== false && a.id !== 'andres') o.visible = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nuevos = mats.map((mt) => { if (!mt) return mt; const n = mt.clone();
        if (A.camisa != null && /camiseta|polera/i.test(mt.name)) n.color.setHex(A.camisa);
        if (A.pantalon != null && /pantalon|calzas/i.test(mt.name)) n.color.setHex(A.pantalon);
        if (A.pelo != null && /pelo|Hair/i.test(mt.name)) n.color.setHex(A.pelo);
        return n; });
      o.material = nuevos.length === 1 ? nuevos[0] : nuevos;
    });
    raiz.add(m);
    Object.assign(v, { modelo: m, k, mixer: new THREE.AnimationMixer(m), acciones: {}, clip: null, femenino: cuerpo === 'maria' ? montarFemenino(m) : null, alto: ALTO[cuerpo] * k });
    for (const c of plantillas.anim.animations) v.acciones[c.name] = v.mixer.clipAction(c);
    animar(v, 'Idle_Loop');
    return v;
  }
  function animar(v, nombre, ts = 1) {
    const a = v.acciones?.[nombre]; if (!a) return; a.timeScale = ts;
    if (v.clip === nombre) return;
    const prev = v.clip && v.acciones[v.clip];
    a.reset().setEffectiveWeight(1).fadeIn(0.3).play(); if (prev) prev.fadeOut(0.3);
    v.clip = nombre;
  }
  // qué punto usa cada acción (la ficha puede cambiarlo con F.puntoDe)
  const PUNTO = { dormir: 'cama', siesta: 'cama', verTV: 'sofa', leer: 'sofa', acurrucarse: 'sofa', coser: 'mesa', cocinar: 'cocina', pedirDomicilio: 'mesa', ducharse: 'bano', esculpir: 'balcon', plantas: 'balcon', tocar: 'balcon', limpiar: 'suelo',
    trabajar: 'trabajo', tomarCafe: 'mesa', comerFuera: 'mesa', tomarAlgo: 'mesa', comprar: 'pasillo', comprarPoco: 'pasillo', entrenar: 'entrenar', pasear: 'recorrido', correr: 'recorrido', pasearPerro: 'recorrido', paseoPerro: 'recorrido',
    comerMascota: 'mascota', dormirMascota: 'mascota', jugarMascota: 'suelo', trepar: 'mascota', esperarDueno: 'suelo', conversar: 'sofa', ...(F.puntoDe || {}) };
  function puntoDe(s, a) {
    const T = a.tarea; if (!T || T.fase !== 'haciendo' || !a.lugar) return null;
    const P = puntos[a.lugar]; if (!P) return null;
    let nombre = PUNTO[T.accion] || 'adentro';
    if (T.accion === 'conversar' && !P.sofa) nombre = P.mesa ? 'mesa' : P.banca ? 'banca' : 'adentro';
    if (T.accion === 'conversar' && P.sofa) { const o = s.agentes.find((x) => x.id === T.con); if (o?.tarea?.accion === 'cocinar') nombre = 'cocina'; }
    if (!P[nombre]) nombre = P.banca && nombre === 'mesa' ? 'banca' : P.adentro ? 'adentro' : P.suelo ? 'suelo' : Object.keys(P)[0];
    const lista = P[nombre]; if (!lista?.length) return null;
    // cada quien en su puesto: se reparten por orden entre los que usan el mismo punto
    const mismos = s.agentes.filter((x) => x.vivo && x.lugar === a.lugar && x.tarea?.fase === 'haciendo' && (PUNTO[x.tarea.accion] || 'adentro') === (PUNTO[T.accion] || 'adentro') && (x.especie === 'persona') === (a.especie === 'persona'));
    const i = Math.max(0, mismos.indexOf(a));
    return { ...lista[i % lista.length], nombre, extra: i >= lista.length ? i - lista.length + 1 : 0 };
  }
  // acostarse: el cuerpo real se mide una vez y se apoya sobre el colchón con la cabeza en la almohada
  const _p = V(), _q = V(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qr = new THREE.Quaternion();
  function enderezarPiernas(v) {
    v.modelo.updateMatrixWorld(true);
    for (const lado of ['l', 'r']) {
      const th = v.modelo.getObjectByName('thigh_' + lado), pie = v.modelo.getObjectByName('foot_' + lado); if (!th || !pie) continue;
      th.getWorldPosition(_p); pie.getWorldPosition(_q); const dir = _q.sub(_p); const hor = Math.hypot(dir.x, dir.z); if (hor < 1e-4) continue;
      _qr.setFromUnitVectors(dir.normalize(), V(dir.x / hor, -0.06, dir.z / hor).normalize()); th.parent.getWorldQuaternion(_qp);
      th.quaternion.premultiply(_qa.copy(_qp).invert().multiply(_qr).multiply(_qp)); th.updateMatrixWorld(true);
    }
  }
  function medirAcostado(v, sp) {
    v.modelo.updateMatrixWorld(true);
    let z0 = 1e9; v.modelo.traverse((o) => { if (!o.isSkinnedMesh || !o.visible) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 11) { o.getVertexPosition(i, _p); o.localToWorld(_p); z0 = Math.min(z0, _p.z); } });
    const pel = v.modelo.getObjectByName('pelvis'); pel.getWorldPosition(_p);
    v.ajusteCama = { clave: `${sp.x}|${sp.z}`, dz: (sp.cabecera + 0.25) - z0, dy: (sp.colchon + 0.06) - _p.y };
  }

  // ------------------------------------------------------------ efectos (corazones, enojo) como globos que suben
  const globos = [];
  const texturaEmoji = (e) => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.font = '72px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 48, 54); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const EMO = { corazones: texturaEmoji('💕'), enojo: texturaEmoji('💢') };
  const vistos = new Set();

  // ------------------------------------------------------------ cuadro a cuadro
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null, seleccion = null, vuelo = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > (e.pointerType === 'touch' ? 14 : 6)) return;
    const r = renderer.domElement.getBoundingClientRect(); let mejor = null, dmin = e.pointerType === 'touch' ? 56 : 44;
    for (const [id, v] of Object.entries(vis)) { if (!v.raiz.visible || v.especie !== 'persona') continue; const w = V(); v.raiz.getWorldPosition(w); w.y += 1.0; w.project(camera); const sx = (w.x + 1) / 2 * r.width + r.left, sy = (1 - w.y) / 2 * r.height + r.top, d = Math.hypot(sx - e.clientX, sy - e.clientY); if (w.z < 1 && d < dmin) { dmin = d; mejor = id; } }
    if (mejor && onAgente) onAgente(mejor);
  });
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 32 + Math.min(1, (h / w - 1) / 1.2) * 16 : 32; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  function update(s, t, dt) {
    // cielo y sol
    const h = hora(s), ang = ((h - 6) / 24) * Math.PI * 2, e = Math.sin(ang), dia = smooth(e, -0.05, 0.25), noche = 1 - smooth(e, -0.2, 0.02);
    let k0 = PAL[0], k1 = PAL[PAL.length - 1]; for (let i = 0; i < PAL.length - 1; i++) if (e >= PAL[i].e && e <= PAL[i + 1].e) { k0 = PAL[i]; k1 = PAL[i + 1]; }
    const u = (e - k0.e) / Math.max(1e-6, k1.e - k0.e);
    cieloMat.uniforms.uTop.value.copy(k0.top).lerp(k1.top, u); cieloMat.uniforms.uHor.value.copy(k0.hor).lerp(k1.hor, u);
    hemi.intensity = 0.55 + dia * 0.9 + noche * 0.35; hemi.color.setHSL(0.6, 0.3, 0.5 + dia * 0.4);
    const dir = e > -0.02 ? V(Math.cos(ang), Math.max(0.15, Math.sin(ang)), 0.35) : V(-Math.cos(ang), Math.max(0.2, -Math.sin(ang)), 0.35);
    sol.position.copy(dir.normalize().multiplyScalar(110)); sol.intensity = e > -0.02 ? 3.2 * smooth(e, -0.02, 0.35) + 0.3 : 0.7 * noche; sol.color.set(e > -0.02 ? 0xfff1dc : 0x9ab0ff);
    renderer.toneMappingExposure = 1.05 + noche * 0.5;
    for (const m of lucesCalle) m.emissiveIntensity = 3 * noche;
    for (const w of ventanas) { const gente = w.siempre ? (s.agentes.some((a) => a.lugar === w.lugar)) : s.agentes.some((a) => a.lugar === w.lugar && a.vivo && a.especie === 'persona' && a.tarea?.accion !== 'dormir'); w.mat.emissiveIntensity = (gente ? 1.6 : 0.05) * noche; }
    const dCam = camera.position.distanceTo(controls.target);
    for (const m of techoMats) m.opacity = THREE.MathUtils.clamp((dCam - 30) / 40, 0.12, 1);
    // autos
    for (const A of autos) { A.u = (A.u + A.vel * dt * 0.6) % 1; const [x, z, r] = recorrido(A.carril, A.u); A.g.position.set(x, 0.06, z); A.g.rotation.y = -r + (A.carril ? Math.PI : 0); A.faro.emissiveIntensity = 2.5 * noche; }
    // personajes
    if (plantillas) for (const a of s.agentes) {
      let v = vis[a.id]; if (!v) v = vis[a.id] = crearCuerpo(a);
      v.raiz.visible = a.vivo;
      if (!a.vivo) continue;
      posar(s, a, v, t, dt);
    }
    // globos de efectos
    for (const ef of s.efectos) { const k = `${ef.tipo}${ef.t}${ef.x}`; if (vistos.has(k) || !EMO[ef.tipo]) continue; vistos.add(k); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: EMO[ef.tipo], transparent: true, depthTest: false })); sp.position.set(ef.x, 2.2, ef.z); sp.scale.setScalar(0.9); sp.renderOrder = 30; scene.add(sp); globos.push({ sp, vida: 0 }); }
    for (const g of [...globos]) { g.vida += dt; g.sp.position.y += dt * 0.5; g.sp.material.opacity = 1 - g.vida / 2.5; if (g.vida > 2.5) { scene.remove(g.sp); globos.splice(globos.indexOf(g), 1); } }
    if (vuelo) { vuelo.t = Math.min(1, vuelo.t + dt / 0.6); const k = vuelo.t * vuelo.t * (3 - 2 * vuelo.t); controls.target.lerpVectors(vuelo.de[0], vuelo.a[0], k); camera.position.lerpVectors(vuelo.de[1], vuelo.a[1], k); if (vuelo.t >= 1) vuelo = null; }
    { const t0 = controls.target, d = Math.hypot(t0.x, t0.z); if (d > R - 6) { const kk = (R - 6) / d, nx = t0.x * kk, nz = t0.z * kk; camera.position.x += nx - t0.x; camera.position.z += nz - t0.z; t0.x = nx; t0.z = nz; } t0.y = THREE.MathUtils.clamp(t0.y, 0, 18); }
    controls.update();
    const near = THREE.MathUtils.clamp(dCam * 0.02, 0.2, 6); if (Math.abs(near - camera.near) > 0.05) { camera.near = near; camera.far = dCam + 260; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
    if (cargada) lotes.revisar(dt);
  }

  function posar(s, a, v, t, dt) {
    const sp = puntoDe(s, a), T = a.tarea;
    let destino, pose = 'pie', ry = null, recorrer = null;
    if (sp && sp.r == null) { destino = V(sp.x + (sp.extra || 0) * 0.5, sp.y ?? 0.2, sp.z); pose = sp.pose; ry = sp.ry; }
    else if (sp && sp.r != null) {   // paseo/trote alrededor del sendero del parque
      const vel = T.accion === 'correr' ? 0.32 : 0.12, fase = (a.id.charCodeAt(0) % 7) * 0.9, ang = t * vel + fase;
      destino = V(sp.x + Math.cos(ang) * sp.r, 0.12, sp.z + Math.sin(ang) * sp.r); recorrer = T.accion === 'correr' ? 'trote' : 'paseo';
    } else destino = V(a.pos.x, 0.2, a.pos.z);
    // mascotas: se pegan a su dueño cuando pasean
    if (a.especie !== 'persona' && T?.accion === 'paseoPerro' && T.fase === 'haciendo') { const d = s.agentes.find((x) => a.duenos?.includes(x.id) && x.tarea?.accion === 'pasearPerro'); if (d && vis[d.id]) destino = vis[d.id].pos.clone().add(V(0.8, 0, 0.6)); }
    const dist = v.pos.distanceTo(destino);
    if (dist > 6 || Math.abs(v.pos.y - destino.y) > 1.2) v.pos.copy(destino);   // ascensor, puerta o salto: aparece en su lugar
    const antes = v.pos.clone(); v.pos.lerp(destino, 1 - Math.exp(-dt * (recorrer ? 12 : 4)));
    const mov = v.pos.distanceTo(antes) / Math.max(dt, 1e-4);
    const camina = mov > 0.25;
    if (camina) v.yaw = angLerp(v.yaw, Math.atan2(-(v.pos.z - antes.z), v.pos.x - antes.x), Math.min(1, dt * 8));
    else if (ry != null) v.yaw = angLerp(v.yaw, -ry + Math.PI / 2, Math.min(1, dt * 6));
    if (T?.con && !camina && T.accion === 'conversar') { const o = vis[T.con]; if (o) v.yaw = angLerp(v.yaw, Math.atan2(-(o.pos.z - v.pos.z), o.pos.x - v.pos.x), Math.min(1, dt * 6)); }
    v.raiz.position.copy(v.pos); v.raiz.rotation.set(0, v.yaw, 0);
    // mascotas
    if (v.mascota) {
      let e = 'quieto'; if (camina) e = mov > 2.2 ? 'corre' : 'camina'; else if (T?.fase === 'haciendo' && /dormir/i.test(T.accion)) e = 'dormido'; else if (T?.accion === 'jugarMascota') e = 'juega'; else if (T?.accion === 'esperarDueno' || T?.accion === 'trepar') e = 'sentado';
      v.mascota.estado(e, camina ? THREE.MathUtils.clamp(mov / 1.4, 0.6, 2) : 1);
      v.mascota.raiz.position.y = T?.accion === 'trepar' && !camina ? 1.6 : 0;
      v.mascota.update(dt); return;
    }
    // personas: animación según la pose
    const m = v.modelo; m.quaternion.copy(qDePie); m.position.set(0, 0, 0); v.acostado = false;
    let clip = 'Idle_Loop', ts = 1;
    if (camina) { clip = recorrer === 'trote' ? 'Jog_Fwd_Loop' : 'Walk_Loop'; ts = THREE.MathUtils.clamp(mov / (recorrer === 'trote' ? 3.2 : 1.25), 0.6, 2); }
    else if (pose === 'sentado') { clip = T?.con || ['tomarAlgo', 'tomarCafe'].includes(T?.accion) ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop'; m.position.y = (sp.asiento ?? 0.46) - 0.46 * v.k; }
    else if (pose === 'acostado') {
      v.acostado = true; v.raiz.rotation.set(0, Math.PI / 2, 0); m.quaternion.copy(qAcostado); m.position.y = -0.05;
      if (v.ajusteCama?.clave === `${sp.x}|${sp.z}`) { v.raiz.position.y += v.ajusteCama.dy; v.raiz.position.z += v.ajusteCama.dz; } else v.medir = sp;
      animar(v, 'Idle_Loop', 0.25);
    }
    else if (pose === 'trabajo') clip = 'Interact';
    else if (pose === 'entrenar') clip = ['Punch_Jab', 'Jump_Loop', 'Punch_Cross'][Math.floor(t / 5 + a.id.length) % 3];
    else if (T?.con || T?.accion === 'trabajar') clip = 'Idle_Talking_Loop';
    if (!v.acostado) animar(v, clip, ts);
    v.mixer.update(dt);
    if (v.acostado) { enderezarPiernas(v); if (v.medir) { medirAcostado(v, v.medir); v.medir = null; } }
    if (v.femenino && !v.acostado) { const w = v.acciones.Walk_Loop, anda = v.clip === 'Walk_Loop' && w ? Math.min(1, w.getEffectiveWeight()) : 0; v.femenino.aplicar(w ? (w.time / w.getClip().duration) * Math.PI * 2 : 0, anda, ['Walk_Loop', 'Idle_Loop', 'Idle_Talking_Loop'].includes(v.clip)); }
  }

  return {
    update,
    get cargada() { return cargada; },
    seleccionar(id) { seleccion = id; },
    proyectar(id) { const v = vis[id]; if (!v) return null; const r = renderer.domElement.getBoundingClientRect(), w = V(); v.raiz.getWorldPosition(w); w.y += 1.0; w.project(camera); return { x: (w.x + 1) / 2 * r.width + r.left, y: (1 - w.y) / 2 * r.height + r.top }; },
    enfocar(id) { const v = vis[id]; if (!v) return; const t = v.pos.clone(); t.y += 1; const off = camera.position.clone().sub(controls.target).setLength(16); vuelo = { t: 0, de: [controls.target.clone(), camera.position.clone()], a: [t, t.clone().add(off)] }; },
    encuadrar(margenIzq = 0, margenDer = 0, margenAbajo = 0) {
      const W = renderer.domElement.clientWidth || innerWidth, H = renderer.domElement.clientHeight || innerHeight;
      camera.clearViewOffset(); if (margenIzq || margenDer || margenAbajo) camera.setViewOffset(W, H, (margenDer - margenIzq) / 2, margenAbajo / 2, W, H); camera.updateProjectionMatrix();
      const uW = Math.max(0.35, (W - margenIzq - margenDer) / W), uH = Math.max(0.35, (H - margenAbajo) / H);
      const hv = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * uH), hh = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * uW);
      const dist = (R + 7) / Math.sin(Math.min(hv, hh)); controls.maxDistance = Math.max(320, dist * 1.25);
      camera.position.sub(controls.target).setLength(dist).add(controls.target);
    },
    _escena: scene, _vis: vis, _camara: camera, _controles: controls, _renderer: renderer,
  };
}
