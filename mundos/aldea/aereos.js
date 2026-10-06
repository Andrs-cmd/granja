// =====================================================================
// La aldea · el cielo de cada era (solo dibujo, no decide nada).
//  mercantil: globos aerostáticos · industrial: globos y zepelines · moderna: aviones de hélice y
//  helicópteros · información: jets, drones y los primeros cohetes · futura: naves, enjambres de
//  drones y lanzamientos frecuentes · destino estelar: la flota entera despega.
// Una InstancedMesh por tipo de aparato: pocas llamadas de dibujo aunque el cielo se llene.
// =====================================================================
import { THREE, fundir, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const PI = Math.PI;
const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const suave = (k) => k * k * (3 - 2 * k);

// cuántos aparatos de cada tipo hay en cada era (0 tribu … 7 futura)
const FLOTA = {
  globo:    [0, 0, 0, 3, 5, 2, 0, 0],
  zepelin:  [0, 0, 0, 0, 2, 2, 0, 0],
  avion:    [0, 0, 0, 0, 0, 5, 3, 0],
  heli:     [0, 0, 0, 0, 0, 3, 4, 2],
  jet:      [0, 0, 0, 0, 0, 0, 6, 5],
  dron:     [0, 0, 0, 0, 0, 0, 14, 30],
  nave:     [0, 0, 0, 0, 0, 0, 0, 28],
};

export function crearAereos(M, alt) {
  const geos = {
    globo: fundirGeo([
      [GEO.esferaFina, 0xffffff, 0, 2.3, 0, 1.3, 1.45, 1.3], [GEO.cil, 0xf2c84a, 0, 2.3, 0, 1.33, 0.4, 1.33], [GEO.cil, 0xf2f0e8, 0, 3.1, 0, 1.0, 0.25, 1.0],
      [GEO.cono, 0xffffff, 0, 0.95, 0, 0.75, 0.9, 0.75, PI, 0, 0], [GEO.caja, 0x7a5232, 0, 0, 0, 0.5, 0.4, 0.5],
    ]),
    zepelin: fundirGeo([
      [GEO.esferaFina, 0xc9ccd0, 0, 0, 0, 0.95, 0.95, 3.3], [GEO.cil, 0x9aa0a8, 0, 0, 0.6, 0.97, 0.12, 0.97, PI / 2, 0, 0],
      [GEO.caja, 0x3a3a40, 0, -1.0, 0.5, 0.42, 0.32, 1.3], [GEO.caja, 0x9a3a30, 0, 0, -2.9, 0.06, 1.6, 0.8], [GEO.caja, 0x9a3a30, 0, 0, -2.9, 1.6, 0.06, 0.8],
    ]),
    avion: fundirGeo([
      [GEO.capsula, 0xf2f2f0, 0, 0, 0, 0.3, 1.7, 0.3, PI / 2, 0, 0], [GEO.caja, 0xf2f2f0, 0, 0, 0.25, 3.4, 0.06, 0.55], [GEO.caja, 0xc8402e, 0, 0.38, -1.35, 0.06, 0.7, 0.45],
      [GEO.caja, 0xf2f2f0, 0, 0.05, -1.35, 1.2, 0.05, 0.32], [GEO.cil, 0x333333, 0, 0, 1.05, 0.08, 0.1, 0.08, PI / 2, 0, 0], [GEO.caja, 0x444444, 0, 0, 1.12, 0.9, 0.04, 0.08],
    ]),
    jet: fundirGeo([
      [GEO.capsula, 0xe8ecf2, 0, 0, 0, 0.28, 2.6, 0.28, PI / 2, 0, 0], [GEO.caja, 0xdfe4ea, 0.85, 0, -0.1, 1.9, 0.05, 0.5, 0, 0.55, 0], [GEO.caja, 0xdfe4ea, -0.85, 0, -0.1, 1.9, 0.05, 0.5, 0, -0.55, 0],
      [GEO.caja, 0x2a5a9a, 0, 0.45, -1.6, 0.06, 0.8, 0.5, -0.4, 0, 0], [GEO.caja, 0xdfe4ea, 0, 0.05, -1.65, 1.1, 0.04, 0.3, 0, 0, 0],
      [GEO.cil, 0x6a7078, 0.85, -0.18, 0.1, 0.12, 0.6, 0.12, PI / 2, 0, 0], [GEO.cil, 0x6a7078, -0.85, -0.18, 0.1, 0.12, 0.6, 0.12, PI / 2, 0, 0],
    ]),
    heli: fundirGeo([
      [GEO.esferaFina, 0x2f6a4a, 0, 0, 0.1, 0.55, 0.5, 0.8], [GEO.esferaFina, 0x9ad0e8, 0, 0.08, 0.55, 0.38, 0.3, 0.32], [GEO.caja, 0x2f6a4a, 0, 0.12, -1.1, 0.12, 0.14, 1.4],
      [GEO.caja, 0x2f6a4a, 0, 0.35, -1.75, 0.05, 0.5, 0.25], [GEO.caja, 0x333333, 0.32, -0.55, 0.1, 0.05, 0.05, 1.1], [GEO.caja, 0x333333, -0.32, -0.55, 0.1, 0.05, 0.05, 1.1],
      [GEO.cil, 0x333333, 0, 0.55, 0.1, 0.06, 0.2, 0.06],
    ]),
    rotor: fundirGeo([[GEO.caja, 0x222222, 0, 0, 0, 3.2, 0.03, 0.12], [GEO.caja, 0x222222, 0, 0, 0, 0.12, 0.03, 3.2]]),
    dron: fundirGeo([
      [GEO.caja, 0x2a2e36, 0, 0, 0, 0.3, 0.1, 0.3], [GEO.caja, 0x2a2e36, 0, 0, 0, 0.75, 0.04, 0.05, 0, PI / 4, 0], [GEO.caja, 0x2a2e36, 0, 0, 0, 0.75, 0.04, 0.05, 0, -PI / 4, 0],
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [GEO.cil, 0x9aa4b0, a * 0.27, 0.05, b * 0.27, 0.16, 0.015, 0.16]), [GEO.esfera, 0x40e0ff, 0, -0.07, 0.12, 0.05, 0.05, 0.05],
    ]),
    nave: fundirGeo([
      [GEO.esferaFina, 0xe8eef6, 0, 0, 0, 1.2, 0.22, 1.2], [GEO.esferaFina, 0x5ad8ff, 0, 0.16, 0.15, 0.5, 0.32, 0.55], [GEO.cil, 0x8090a8, 0, -0.12, 0, 0.8, 0.12, 0.8],
      [GEO.caja, 0xe8eef6, 0, 0, -1.0, 0.08, 0.35, 0.6], [GEO.esfera, 0x7af0ff, 0.6, -0.05, -0.85, 0.16, 0.1, 0.22], [GEO.esfera, 0x7af0ff, -0.6, -0.05, -0.85, 0.16, 0.1, 0.22],
    ]),
    cohete: fundirGeo([
      [GEO.cil, 0xf2f2f2, 0, 2.2, 0, 0.45, 4.4, 0.45], [GEO.cil, 0x2a2a2e, 0, 3.4, 0, 0.46, 0.3, 0.46], [GEO.cono, 0xd04030, 0, 5.0, 0, 0.45, 1.2, 0.45],
      ...[0, 1, 2, 3].map((i) => [GEO.caja, 0x3a3a40, Math.cos((i * PI) / 2) * 0.5, 0.5, Math.sin((i * PI) / 2) * 0.5, 0.06, 1.0, 0.45, 0, -(i * PI) / 2, 0]),
      [GEO.cil, 0x55555a, 0, -0.15, 0, 0.32, 0.3, 0.32],
    ]),
  };
  // las naves y los drones brillan un poco de noche
  const matLuz = MAT_VERTICE.clone(); matLuz.emissive = new THREE.Color(0x2a7aff); matLuz.emissiveIntensity = 0.25;
  const mk = (geo, n, mat = MAT_VERTICE, sombra = true) => { const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.frustumCulled = false; im.castShadow = sombra; M.add(im); return im; };
  const I = {
    globo: mk(geos.globo, 8), zepelin: mk(geos.zepelin, 4), avion: mk(geos.avion, 8), jet: mk(geos.jet, 12), heli: mk(geos.heli, 6), rotor: mk(geos.rotor, 6, MAT_VERTICE, false),
    dron: mk(geos.dron, 40, matLuz, false), nave: mk(geos.nave, 60, matLuz), cohete: mk(geos.cohete, 8),
  };
  // cada globo de un color (el tinte de la instancia pinta la tela; la canasta sigue oscura)
  ['#d8483a', '#3a7ad8', '#e0a830', '#3aa86a', '#a84ad0', '#e06a9a', '#f0f0f0', '#e07a30'].forEach((c, i) => I.globo.setColorAt(i, new THREE.Color(c)));
  const matFuego = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const fuegos = mk(new THREE.ConeGeometry(0.42, 1, 8).rotateX(PI).translate(0, -0.5, 0), 8, matFuego, false);
  // plataforma de lanzamiento: losa, torre y brazo
  const plataforma = fundir([
    [GEO.cil, 0x7a7e86, 0, 0.15, 0, 2.2, 0.3, 2.2], [GEO.caja, 0xb84a30, 1.4, 3.6, 0, 0.35, 7, 0.35], [GEO.caja, 0xb84a30, 1.4, 3.6, 0.45, 0.06, 7, 0.06],
    [GEO.caja, 0x8a8e96, 0.9, 5.2, 0, 1.0, 0.12, 0.2], [GEO.caja, 0x8a8e96, 0.9, 2.6, 0, 1.0, 0.12, 0.2], [GEO.caja, 0x5a5e66, -1.6, 0.6, 1.2, 0.8, 1.2, 0.8],
  ]); plataforma.visible = false; M.add(plataforma);

  let firma = '', edif = [], ciudades = [], sitio = null;
  // dónde están los edificios, las ciudades y la plataforma (se recalcula solo si la ciudad cambia)
  function preparar(s) {
    const f = `${s.vc}:${s.era}`; if (f === firma) return; firma = f;
    edif = s.celdas.filter((c) => c.u && !['campo', 'parque'].includes(c.u) && !c.ru);
    ciudades = s.ciudades.filter((C) => !C.vacia); if (!ciudades.length) ciudades = [s.ciudades[0]];
    const C0 = ciudades[0], puerto = s.celdas.find((c) => c.u === 'puerto' && !c.ru);
    if (puerto) sitio = puerto;
    else {
      // un lote libre en el borde de la capital, con sus vecinos libres (la plataforma ocupa más que una celda)
      const libre = (c) => c && !c.u && !c.o && ['p', 'b', 'r'].includes(c.t);
      const m = new Map(s.celdas.map((c) => [c.k, c])), NG = 31;
      let mejor = null, md = 1e9;
      for (const c of s.celdas) {
        if (!libre(c) || Math.hypot(c.x, c.z) > 38) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([di, dj]) => libre(m.get(c.k + di * NG + dj)))) continue;
        const d = Math.hypot(c.x - C0.x, c.z - C0.z) + (c.t === 'b' ? 5 : 0); if (d < md) { md = d; mejor = c; }
      }
      if (!sitio || !libre(sitio) || (mejor && md < Math.hypot(sitio.x - C0.x, sitio.z - C0.z) - 6)) sitio = mejor;
    }
  }
  const poner = (im, i, x, y, z, rotY, esc = 1, banco = 0, cabeceo = 0) => { _e.set(cabeceo, rotY, banco, 'YXZ'); _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.setScalar(esc)); im.setMatrixAt(i, _m); };
  const fin = (im, n) => { im.count = n; im.instanceMatrix.needsUpdate = true; };
  // vuelo recto que cruza el orbe de borde a borde (aparece pequeño, se agranda, se aleja)
  function cruce(im, i, n, tt, vel, yBase, esc, semilla) {
    const h = hash(semilla + i * 17) * PI * 2, off = (hash(semilla + i * 29) - 0.5) * 50, L = 150, k = ((tt * vel) / L + hash(semilla + i * 7)) % 1, a = (k - 0.5) * L;
    const dx = Math.sin(h), dz = Math.cos(h), x = dx * a + dz * off, z = dz * a - dx * off, borde = Math.min(1, (1 - Math.abs(k - 0.5) * 2) * 5);
    poner(im, i, x, yBase + (i % 4) * 3, z, h, esc * borde);
  }

  // devuelve los puntos de humo (estelas de cohetes) para el sistema de humo de la escena
  function actualizar(s, dt, tt, D, noche = 0) {
    preparar(s);
    const era = Math.min(7, s.era), tipo = D?.tipo, trafico = !D || tipo === 'estelar' || tipo === 'colmena';
    const mega = s.mega?.k === 'estelar' ? s.mega.prog : 0, estelar = tipo === 'estelar';
    const cuantos = (k) => (trafico ? FLOTA[k][era] : 0);
    const C0 = ciudades[0], humo = [];
    // globos: suben y derivan despacio con el viento
    let n = cuantos('globo');
    for (let i = 0; i < n; i++) { const a = i * 2.4 + tt * 0.012 * (i % 2 ? 1 : -1), r = 10 + ((i * 7) % 24), y = 13 + (i % 3) * 4 + Math.sin(tt * 0.3 + i) * 0.8; poner(I.globo, i, C0.x + Math.cos(a) * r, y, C0.z + Math.sin(a) * r, tt * 0.05 + i, 0.9 + (i % 2) * 0.3); }
    fin(I.globo, n);
    // zepelines: rondas largas alrededor de la ciudad
    n = cuantos('zepelin');
    for (let i = 0; i < n; i++) { const a = tt * 0.03 + i * PI, r = 26 + i * 6, d = i % 2 ? 1 : -1, x = Math.cos(a * d) * r, z = Math.sin(a * d) * r; poner(I.zepelin, i, x, 24 + i * 3, z, Math.atan2(-Math.sin(a * d) * d, Math.cos(a * d) * d), 1.1); }
    fin(I.zepelin, n);
    // aviones de hélice y jets: cruzan el cielo
    n = cuantos('avion'); for (let i = 0; i < n; i++) cruce(I.avion, i, n, tt, 7, 24, 1, 11); fin(I.avion, n);
    n = cuantos('jet') + (estelar ? 4 : 0); for (let i = 0; i < n; i++) cruce(I.jet, i, n, tt, 16, 34, 1.1, 53); fin(I.jet, n);
    // helicópteros: rondan sobre los edificios, el rotor gira
    n = cuantos('heli');
    for (let i = 0; i < n; i++) {
      const b = edif[Math.floor(hash(i * 41 + 3) * edif.length)] || C0, a = tt * (0.25 + (i % 3) * 0.07) + i * 2, r = 4 + (i % 3) * 2, x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r, y = 13 + (i % 3) * 3 + Math.sin(tt * 0.7 + i) * 0.6;
      poner(I.heli, i, x, y, z, -a, 1, 0.12); _m.compose(_p.set(x, y + 0.58, z), _q.setFromAxisAngle(_s.set(0, 1, 0), tt * 22 + i), _s.set(1, 1, 1)); I.rotor.setMatrixAt(i, _m);
    }
    fin(I.heli, n); fin(I.rotor, n);
    // drones: saltan de edificio en edificio a baja altura
    n = edif.length ? cuantos('dron') + (tipo === 'colmena' ? 10 : 0) : 0;
    for (let i = 0; i < n; i++) {
      const T = 3 + (i % 4), u = tt / T + hash(i * 13), seg = Math.floor(u), k = suave(u - seg), A = edif[Math.floor(hash(i * 31 + seg) * edif.length)], B = edif[Math.floor(hash(i * 31 + seg + 1) * edif.length)];
      const x = A.x + (B.x - A.x) * k, z = A.z + (B.z - A.z) * k, y = Math.max(alt(A.x, A.z), alt(B.x, B.z)) + 6 + (i % 3) * 1.5 + Math.sin(k * PI) * 3;
      poner(I.dron, i, x, y, z, Math.atan2(B.x - A.x, B.z - A.z), 1.3, 0, 0.15);
    }
    fin(I.dron, n);
    // naves: carriles entre ciudades y rondas sobre la capital; en el destino estelar la flota se va al espacio
    n = cuantos('nave') + (estelar ? 30 : 0) + Math.round(mega * 10);
    for (let i = 0; i < n; i++) {
      let x, y, z, rot, esc = 1;
      if (estelar && i >= n - 30) { const j = i - (n - 30), k = ((tt * 0.05 + j / 30) % 1), a = j * 2.399 + k * 2; x = Math.cos(a) * (8 + k * 40); z = Math.sin(a) * (8 + k * 40); y = 12 + k * k * 160; rot = -a; esc = 1.4; }
      else if (i % 3 === 0 && ciudades.length > 1) { const T = 9, u = tt / T + hash(i * 19), seg = Math.floor(u), k = suave(u - seg), A = ciudades[(seg + i) % ciudades.length], B = ciudades[(seg + i + 1) % ciudades.length]; x = A.x + (B.x - A.x) * k; z = A.z + (B.z - A.z) * k; y = 16 + (i % 4) * 2 + Math.sin(k * PI) * 6; rot = Math.atan2(B.x - A.x, B.z - A.z); }
      else { const r = 6 + (i % 6) * 3.5, d = i % 2 ? 1 : -1, a = tt * (0.15 + (i % 4) * 0.05) * d + i; x = C0.x + Math.cos(a) * r; z = C0.z + Math.sin(a) * r; y = 10 + (i % 5) * 3; rot = Math.atan2(-Math.sin(a) * d, Math.cos(a) * d); }
      poner(I.nave, i, x, y, z, rot, esc, 0);
    }
    fin(I.nave, n);
    // cohetes: desde la era de la información hay lanzamientos; más seguidos con la era y con el megaproyecto
    const lanz = !sitio || (D && !estelar) ? 0 : estelar ? 6 : era >= 6 ? (era === 6 ? 1 : 2) + Math.round(mega * 4) : 0;
    plataforma.visible = lanz > 0 || (era >= 6 && !!sitio && trafico);
    let nc = 0, nf = 0;
    if (sitio && plataforma.visible) {
      const by = alt(sitio.x, sitio.z), x0 = sitio.x, z0 = sitio.z, P = estelar ? 8 : era >= 7 ? 16 : 28, G = 2.2;   // a escala de los rascacielos
      plataforma.position.set(x0, by, z0); plataforma.scale.setScalar(G * 0.6);
      let espera = false;
      for (let j = 0; j < lanz; j++) {
        const k = (tt / P + j / lanz) % 1, dir = hash(j * 7 + Math.floor(tt / P + j / lanz)) * PI * 2;
        if (k < 0.3) { espera = true; continue; }   // en la plataforma, esperando turno
        const u = (k - 0.3) / 0.7, sube = u * u * 200, lat = u * u * 40, x = x0 + Math.cos(dir) * lat, z = z0 + Math.sin(dir) * lat, inc = Math.min(0.9, u * 1.4);
        if (sube > 190) continue;
        _e.set(0, -dir, 0, 'YXZ'); _q.setFromEuler(_e); _q2.setFromAxisAngle(_s.set(0, 0, 1), -inc); _q.multiply(_q2);
        _m.compose(_p.set(x, by + 0.3 + sube, z), _q, _s.setScalar(G)); I.cohete.setMatrixAt(nc++, _m);
        _m.compose(_p.set(x, by + 0.3 + sube, z), _q, _s.set(G, G * (2 + Math.sin(tt * 40 + j) * 0.4 + u * 3), G)); fuegos.setMatrixAt(nf++, _m);
        if (u < 0.45) humo.push([x, by + sube, z, 3]);
      }
      if (espera || lanz === 0) poner(I.cohete, nc++, x0, by + 0.3 * G, z0, 0, G);
    }
    fin(I.cohete, nc); fin(fuegos, nf);
    matLuz.emissiveIntensity = 0.25 + noche * 0.9;
    return humo;
  }
  return { actualizar, get sitio() { return sitio; } };
}
