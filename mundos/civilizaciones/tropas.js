// =====================================================================
// Civilizaciones — tropas en tiempo real (solo dibujo; la batalla la decide sim.js).
// Cada tipo de unidad es UN InstancedMesh (cientos de soldados en una llamada de dibujo). Las piezas
// pintadas de magenta en la geometría toman el color de la civilización de cada instancia (shader),
// el resto conserva su color propio (piel, madera, acero…).
// Cada ejército se dibuja con su composición (infantería, arqueros, caballería, asedio, bestias),
// la era (lanzas → fusiles, jinetes → tanques, arietes → artillería, bestias → aviones) y la
// formación de su doctrina (bloque, cuña, columna, cuadro, disperso, línea, caos).
// =====================================================================
import { THREE, fundirGeo, GEO } from '../motor/orbe3d.js';
import { DOCTRINAS } from './facciones.js';

const T = 0xff00ff; // marca de "color del equipo"
const PIEL = 0xd9a77a, ACERO = 0xb8bec6, OSCURO = 0x3a3a40, MADERA = 0x7a5532, CUERO = 0x6a4a2a, ORO = 0xd4af37;
const _o = new THREE.Object3D(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

function matEquipo() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
  // las piezas magenta toman el color de la instancia; las demás su color de vértice
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
#if defined(USE_COLOR) && defined(USE_INSTANCING_COLOR)
  vColor.xyz = (color.r > 0.98 && color.g < 0.02 && color.b > 0.98) ? instanceColor.xyz : color.xyz;
#endif`);
  };
  m.customProgramCacheKey = () => 'equipo-v1';
  return m;
}
const cilX = (c, x, y, z, r, l) => [GEO.cil, c, x, y, z, r, l, r, Math.PI / 2, 0, 0]; // cilindro tendido hacia adelante
const pata = (c, x, z, alto = 0.12, r = 0.018) => [GEO.cil, c, x, alto / 2, z, r, alto, r];
// geometrías (miran hacia +z; ~0,45 de alto una persona)
const PIEZAS = {
  lancero: [[GEO.capsula, T, 0, 0.17, 0, 0.1, 0.12, 0.08], [GEO.esfera, PIEL, 0, 0.31, 0, 0.045, 0.05, 0.045], [GEO.cono, ACERO, 0, 0.35, 0, 0.05, 0.05, 0.05],
    [GEO.caja, T, -0.065, 0.17, 0.05, 0.02, 0.14, 0.1], [GEO.cil, MADERA, 0.07, 0.25, 0.03, 0.008, 0.48, 0.008], [GEO.cono, ACERO, 0.07, 0.51, 0.03, 0.016, 0.05, 0.016]],
  arquero: [[GEO.capsula, T, 0, 0.17, 0, 0.09, 0.12, 0.07], [GEO.esfera, PIEL, 0, 0.31, 0, 0.045, 0.05, 0.045], [GEO.cono, CUERO, 0, 0.36, -0.01, 0.055, 0.07, 0.055],
    [GEO.caja, MADERA, 0.07, 0.22, 0.05, 0.012, 0.26, 0.012, 0, 0, 0.25], [GEO.cil, CUERO, -0.03, 0.22, -0.06, 0.025, 0.14, 0.025]],
  fusilero: [[GEO.capsula, T, 0, 0.17, 0, 0.09, 0.12, 0.07], [GEO.esfera, PIEL, 0, 0.31, 0, 0.045, 0.05, 0.045], [GEO.caja, OSCURO, 0, 0.355, 0, 0.08, 0.03, 0.08],
    [GEO.caja, OSCURO, 0.06, 0.22, 0.07, 0.015, 0.015, 0.28, -0.4, 0, 0]],
  jinete: [[GEO.caja, CUERO, 0, 0.17, 0, 0.1, 0.1, 0.26], ...[-1, 1].flatMap((sx) => [pata(CUERO, sx * 0.035, 0.09), pata(CUERO, sx * 0.035, -0.09)]), [GEO.caja, CUERO, 0, 0.24, 0.14, 0.05, 0.1, 0.07, -0.5, 0, 0],
    [GEO.caja, T, 0, 0.21, 0, 0.11, 0.04, 0.16], [GEO.capsula, T, 0, 0.33, -0.01, 0.075, 0.1, 0.065], [GEO.esfera, PIEL, 0, 0.44, -0.01, 0.04, 0.045, 0.04], [GEO.cono, ACERO, 0, 0.475, -0.01, 0.045, 0.04, 0.045],
    cilX(MADERA, 0.06, 0.34, 0.12, 0.008, 0.45), [GEO.cono, ACERO, 0.06, 0.34, 0.35, 0.015, 0.05, 0.015, Math.PI / 2, 0, 0]],
  tanque: [[GEO.caja, T, 0, 0.1, 0, 0.24, 0.09, 0.34], [GEO.caja, OSCURO, -0.13, 0.06, 0, 0.05, 0.08, 0.36], [GEO.caja, OSCURO, 0.13, 0.06, 0, 0.05, 0.08, 0.36],
    [GEO.caja, T, 0, 0.18, -0.02, 0.14, 0.07, 0.15], cilX(OSCURO, 0, 0.18, 0.17, 0.015, 0.24)],
  ariete: [cilX(MADERA, 0, 0.1, 0, 0.045, 0.46), [GEO.cono, ACERO, 0, 0.1, 0.25, 0.05, 0.06, 0.05, Math.PI / 2, 0, 0], [GEO.caja, T, 0, 0.19, 0, 0.18, 0.03, 0.32],
    ...[-1, 1].flatMap((sx) => [[GEO.cil, MADERA, sx * 0.1, 0.05, 0.12, 0.05, 0.02, 0.05, 0, 0, Math.PI / 2], [GEO.cil, MADERA, sx * 0.1, 0.05, -0.12, 0.05, 0.02, 0.05, 0, 0, Math.PI / 2]])],
  catapulta: [[GEO.caja, MADERA, 0, 0.05, 0, 0.2, 0.04, 0.32], [GEO.caja, MADERA, -0.08, 0.14, 0, 0.03, 0.18, 0.03], [GEO.caja, MADERA, 0.08, 0.14, 0, 0.03, 0.18, 0.03],
    [GEO.caja, MADERA, 0, 0.2, -0.05, 0.03, 0.03, 0.38, -0.7, 0, 0], [GEO.esfera, 0x8a8378, 0, 0.32, -0.19, 0.04, 0.04, 0.04], [GEO.caja, T, 0, 0.08, 0.1, 0.2, 0.03, 0.05]],
  canon: [cilX(OSCURO, 0, 0.11, 0.06, 0.03, 0.3), ...[-1, 1].map((sx) => [GEO.cil, MADERA, sx * 0.07, 0.07, -0.02, 0.07, 0.02, 0.07, 0, 0, Math.PI / 2]), [GEO.caja, MADERA, 0, 0.07, -0.12, 0.05, 0.04, 0.2], [GEO.caja, T, 0, 0.13, -0.08, 0.08, 0.02, 0.06]],
  artilleria: [cilX(OSCURO, 0, 0.16, 0.08, 0.035, 0.44), [GEO.caja, OSCURO, 0, 0.08, -0.05, 0.2, 0.08, 0.26], [GEO.caja, T, 0, 0.13, -0.05, 0.21, 0.03, 0.27]],
  camello: [[GEO.caja, 0xc8a06a, 0, 0.22, 0, 0.09, 0.09, 0.26], [GEO.esfera, 0xc8a06a, 0, 0.29, -0.02, 0.06, 0.06, 0.07], ...[-1, 1].flatMap((sx) => [pata(0xc8a06a, sx * 0.035, 0.09, 0.18), pata(0xc8a06a, sx * 0.035, -0.09, 0.18)]),
    [GEO.cil, 0xc8a06a, 0, 0.3, 0.15, 0.022, 0.16, 0.022, 0.5, 0, 0], [GEO.caja, 0xc8a06a, 0, 0.38, 0.2, 0.04, 0.04, 0.08], [GEO.caja, T, 0, 0.33, -0.02, 0.1, 0.03, 0.12], [GEO.capsula, T, 0, 0.42, -0.02, 0.06, 0.08, 0.05], [GEO.esfera, PIEL, 0, 0.51, -0.02, 0.035, 0.04, 0.035]],
  elefante: [[GEO.esfera, 0x8a8a90, 0, 0.26, 0, 0.17, 0.15, 0.23], [GEO.esfera, 0x8a8a90, 0, 0.3, 0.2, 0.1, 0.1, 0.09], [GEO.cil, 0x8a8a90, 0, 0.18, 0.28, 0.025, 0.2, 0.025, 0.3, 0, 0],
    [GEO.cono, 0xf2ead8, -0.05, 0.22, 0.27, 0.015, 0.1, 0.015, 1.2, 0, 0], [GEO.cono, 0xf2ead8, 0.05, 0.22, 0.27, 0.015, 0.1, 0.015, 1.2, 0, 0],
    ...[-1, 1].flatMap((sx) => [pata(0x8a8a90, sx * 0.08, 0.1, 0.16, 0.04), pata(0x8a8a90, sx * 0.08, -0.1, 0.16, 0.04)]), [GEO.caja, T, 0, 0.43, -0.02, 0.18, 0.08, 0.2], [GEO.cono, ORO, 0, 0.51, -0.02, 0.12, 0.06, 0.12, 0, Math.PI / 4, 0]],
  oso: [[GEO.esfera, 0x4a3426, 0, 0.15, 0, 0.12, 0.11, 0.18], [GEO.esfera, 0x4a3426, 0, 0.2, 0.17, 0.07, 0.065, 0.07], [GEO.esfera, 0x2a1a12, 0, 0.19, 0.24, 0.03, 0.025, 0.03],
    ...[-1, 1].flatMap((sx) => [pata(0x4a3426, sx * 0.06, 0.08, 0.08, 0.03), pata(0x4a3426, sx * 0.06, -0.08, 0.08, 0.03)]), [GEO.caja, T, 0, 0.25, -0.02, 0.16, 0.04, 0.18]],
  lobo: [[GEO.caja, 0x7a7a80, 0, 0.12, 0, 0.07, 0.07, 0.22], [GEO.caja, 0x7a7a80, 0, 0.16, 0.13, 0.06, 0.06, 0.07], [GEO.caja, 0x7a7a80, 0, 0.145, 0.18, 0.03, 0.03, 0.05],
    [GEO.cono, 0x7a7a80, -0.02, 0.21, 0.12, 0.012, 0.03, 0.012], [GEO.cono, 0x7a7a80, 0.02, 0.21, 0.12, 0.012, 0.03, 0.012], ...[-1, 1].flatMap((sx) => [pata(0x7a7a80, sx * 0.025, 0.07, 0.09, 0.012), pata(0x7a7a80, sx * 0.025, -0.07, 0.09, 0.012)]),
    [GEO.caja, T, 0, 0.16, 0.09, 0.075, 0.02, 0.03]],
  cabra: [[GEO.caja, 0xe8e2d4, 0, 0.16, 0, 0.09, 0.09, 0.22], [GEO.caja, 0xe8e2d4, 0, 0.23, 0.12, 0.05, 0.07, 0.07], [GEO.cono, 0x6a5a4a, -0.03, 0.29, 0.1, 0.012, 0.09, 0.012, -0.6, 0, 0], [GEO.cono, 0x6a5a4a, 0.03, 0.29, 0.1, 0.012, 0.09, 0.012, -0.6, 0, 0],
    ...[-1, 1].flatMap((sx) => [pata(0xe8e2d4, sx * 0.03, 0.07, 0.12), pata(0xe8e2d4, sx * 0.03, -0.07, 0.12)]), [GEO.capsula, T, 0, 0.3, -0.01, 0.06, 0.08, 0.05], [GEO.esfera, PIEL, 0, 0.39, -0.01, 0.035, 0.04, 0.035]],
  avion: [cilX(T, 0, 0, 0, 0.04, 0.42), [GEO.caja, 0xd8dce0, 0, 0, 0.02, 0.5, 0.012, 0.1], [GEO.caja, 0xd8dce0, 0, 0.04, -0.18, 0.16, 0.01, 0.06], [GEO.caja, T, 0, 0.06, -0.18, 0.01, 0.08, 0.06], [GEO.cono, OSCURO, 0, 0, 0.23, 0.03, 0.05, 0.03, Math.PI / 2, 0, 0]],
  barco: [[GEO.caja, 0x6a4a2a, 0, 0.08, 0, 0.3, 0.14, 0.8], [GEO.cono, 0x6a4a2a, 0, 0.08, 0.5, 0.15, 0.22, 0.07, Math.PI / 2, 0, 0], [GEO.cil, MADERA, 0, 0.5, 0, 0.02, 0.8, 0.02],
    [GEO.caja, T, 0, 0.55, 0.02, 0.5, 0.42, 0.02], [GEO.caja, 0xf2ead8, 0, 0.88, 0, 0.22, 0.14, 0.015]],
  estandarte: [[GEO.cil, 0x4a3a2a, 0, 0.45, 0, 0.012, 0.9, 0.012], [GEO.caja, T, 0.13, 0.76, 0, 0.26, 0.17, 0.01], [GEO.esfera, ORO, 0, 0.91, 0, 0.025, 0.025, 0.025]],
  caido: [[GEO.capsula, T, 0, 0.04, 0, 0.09, 0.12, 0.07, Math.PI / 2, 0, 0], [GEO.esfera, PIEL, 0, 0.04, 0.17, 0.04, 0.04, 0.04]],
  refugiado: [[GEO.capsula, 0x8a6a4a, 0, 0.14, 0, 0.07, 0.1, 0.06], [GEO.esfera, PIEL, 0, 0.26, 0, 0.038, 0.042, 0.038], [GEO.caja, 0xb89a6a, 0, 0.2, -0.06, 0.08, 0.08, 0.05]],
  escalera: [[GEO.caja, MADERA, -0.06, 0.35, 0, 0.015, 0.7, 0.015], [GEO.caja, MADERA, 0.06, 0.35, 0, 0.015, 0.7, 0.015], ...[0.1, 0.25, 0.4, 0.55].map((y) => [GEO.caja, MADERA, 0, y, 0, 0.12, 0.012, 0.012])],
  flecha: [[GEO.cil, 0x5a4a3a, 0, 0, 0, 0.006, 0.16, 0.006], [GEO.cono, ACERO, 0, 0.09, 0, 0.012, 0.025, 0.012]],
  bala: [[GEO.esfera, 0x2a2a2a, 0, 0, 0, 0.04, 0.04, 0.04]],
};
const MAX = { lancero: 700, arquero: 450, fusilero: 700, jinete: 380, tanque: 160, ariete: 40, catapulta: 50, canon: 60, artilleria: 50, camello: 140, elefante: 80, oso: 120, lobo: 160, cabra: 120, avion: 60, barco: 80, estandarte: 70, caido: 420, refugiado: 260, escalera: 40, flecha: 260, bala: 140 };
const GIRA_BALA = new Set(['flecha']);

// formaciones: devuelve desplazamientos [lateral, adelante] de cada puesto, del frente hacia atrás
function formacion(forma, n, semilla) {
  const s = [], rnd = (k) => { const x = Math.sin(semilla * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const filas = (ancho, sep = 0.24, sepF = 0.26) => { for (let k = 0; k < n; k++) { const f = Math.floor(k / ancho), c = k % ancho, w = Math.min(ancho, n - f * ancho); s.push([(c - (w - 1) / 2) * sep, -f * sepF]); } };
  if (forma === 'cuña') { let k = 0; for (let f = 0; k < n; f++) for (let c = 0; c <= f * 2 && k < n; c++, k++) s.push([(c - f) * 0.26, -f * 0.3]); }
  else if (forma === 'columna') filas(3, 0.24, 0.24);
  else if (forma === 'linea') filas(14, 0.22, 0.3);
  else if (forma === 'cuadro') { const l = Math.max(2, Math.ceil(Math.sqrt(n))); filas(l, 0.25, 0.25); }
  else if (forma === 'disperso' || forma === 'caos') for (let k = 0; k < n; k++) { const a = rnd(k) * 6.28, r = Math.sqrt(rnd(k + 99)) * (0.4 + Math.sqrt(n) * 0.13); s.push([Math.cos(a) * r, Math.sin(a) * r * 0.8 - 0.3]); }
  else filas(8, 0.22, 0.24); // bloque
  return s;
}
// orden de las filas según la doctrina (quién va al frente)
const ORDEN = { cuña: ['cab', 'bestia', 'inf', 'arq', 'asedio'], bloque: ['inf', 'bestia', 'cab', 'arq', 'asedio'], columna: ['cab', 'inf', 'bestia', 'arq', 'asedio'], linea: ['inf', 'arq', 'cab', 'bestia', 'asedio'], cuadro: ['inf', 'arq', 'bestia', 'cab', 'asedio'], disperso: ['arq', 'inf', 'bestia', 'cab', 'asedio'], caos: ['cab', 'inf', 'bestia', 'arq', 'asedio'] };
function tipoVisual(u, era, bestia) {
  if (u === 'inf') return era >= 4 ? 'fusilero' : 'lancero';
  if (u === 'arq') return era >= 4 ? 'fusilero' : 'arquero';
  if (u === 'cab') return era >= 5 ? 'tanque' : 'jinete';
  if (u === 'asedio') return era >= 5 ? 'artilleria' : era >= 4 ? 'canon' : era >= 2 ? 'catapulta' : 'ariete';
  return era >= 6 ? 'avion' : bestia || 'lobo';
}

export function crearTropas(raiz, { chispas, humo, fuego, tope }) {
  const mat = matEquipo(), mallas = {};
  for (const [k, partes] of Object.entries(PIEZAS)) {
    const m = new THREE.InstancedMesh(fundirGeo(partes), mat, MAX[k]); m.count = 0; m.frustumCulled = false; m.castShadow = !['flecha', 'bala', 'caido', 'refugiado', 'escalera'].includes(k);
    m.setColorAt(0, _c.set(0xffffff)); mallas[k] = m; raiz.add(m);
  }
  const usados = {}; for (const k in mallas) usados[k] = 0;
  const poner = (k, x, y, z, ry, rx = 0, rz = 0, esc = 1, color = null) => {
    const m = mallas[k]; if (usados[k] >= MAX[k]) return; const i = usados[k]++;
    _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz, 'YXZ'); _o.scale.setScalar(esc); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); if (color) m.setColorAt(i, color);
  };
  const caidos = [], proyectiles = [], refugiados = [], ultFuerza = new Map(), centros = new Map(), rumbos = new Map();
  let tFuego = 0;

  function lanzar(tipo, x0, y0, z0, x1, y1, z1, arco = 1) { if (proyectiles.length > 240) return; const d = Math.hypot(x1 - x0, z1 - z0); proyectiles.push({ tipo, x0, y0, z0, x1, y1, z1, t: 0, dur: tipo === 'bala' && arco < 0.5 ? 0.25 + d * 0.04 : 0.5 + d * 0.12, h: arco * (0.4 + d * 0.3) }); }

  return {
    // centro interpolado de cada ejército (para la cámara de guerra)
    centro: (id) => centros.get(id) || null,
    refugiados(de, a, n, color) { const k = Math.min(16, 4 + Math.round(Math.sqrt(n) / 3)); refugiados.push({ de, a, k, t: 0, dur: 7, color: new THREE.Color(color).lerp(new THREE.Color(0x8a6a4a), 0.6) }); },
    actualizar(E, M, frac, dt, t, posCelda) {
      for (const k in usados) usados[k] = 0;
      const vivos = new Set();
      // 1) dónde está cada ejército (interpolado a lo largo de su marcha del año)
      const pos = new Map();
      for (const ej of E.ejercitos) {
        const tr = ej.tray && ej.tray.length > 1 ? ej.tray : [ej.celda], f = Math.min(0.999, frac) * (tr.length - 1), k = Math.floor(f), a = posCelda(tr[k]), b = posCelda(tr[Math.min(tr.length - 1, k + 1)]);
        const p = a.clone().lerp(b, f - k); let dir = tr.length > 1 ? Math.atan2(b.x - a.x, b.z - a.z) : null;
        pos.set(ej.id, { p, dir, agua: M.bioma[tr[Math.round(f)]] <= 1 });
      }
      const porId = new Map(E.ejercitos.map((e) => [e.id, e])), combDe = new Map(E.combates.map((c) => [c.id, c]));
      for (const ej of E.ejercitos) {
        const civ = E.civs[ej.civ]; if (!civ) continue; vivos.add(ej.id);
        const info = pos.get(ej.id), col = _c.set(civ.color).clone(); let { p } = info, rumbo = rumbos.get(ej.id) ?? 0;
        let pelea = false, objetivo = null;
        // trabado en combate: los dos frentes se acercan al punto medio
        if (ej.comb >= 0) {
          const cb = combDe.get(ej.comb), otro = cb && porId.get(cb.a === ej.id ? cb.b : cb.a);
          if (otro) { const q = pos.get(otro.id).p; objetivo = q; p = p.clone().lerp(q, 0.32); rumbo = Math.atan2(q.x - p.x, q.z - p.z); pelea = true; }
        } else if (ej.sitio >= 0) {
          const o = E.ciudades.find((c) => c.id === ej.sitio);
          if (o) { const q = posCelda(o.celda), d = p.distanceTo(q); objetivo = q; if (d > 0.01) { const r0 = 1.5 + o.nivel * 0.25; p = q.clone().add(p.clone().sub(q).setY(0).normalize().multiplyScalar(r0)); p.y = tope(p.x, p.z); } rumbo = Math.atan2(q.x - p.x, q.z - p.z); pelea = true; }
        } else if (info.dir != null) rumbo = info.dir;
        rumbos.set(ej.id, rumbo); centros.set(ej.id, p);
        const cs = Math.cos(rumbo), sn = Math.sin(rumbo);
        // bajas: si bajó la fuerza desde el último cuadro, caen soldados
        const ant = ultFuerza.get(ej.id), n = Math.max(6, Math.min(60, Math.round(Math.sqrt(ej.fuerza) * 0.95)));
        if (ant != null && ant - ej.fuerza > 1) { const muertos = Math.min(10, Math.ceil((ant - ej.fuerza) / Math.max(1, ej.fuerza / n))); for (let k = 0; k < muertos && caidos.length < 400; k++) { const ox = (Math.random() - 0.5) * 1.6, oz = Math.random() * 0.5; caidos.push({ x: p.x + ox * cs + oz * sn, z: p.z - ox * sn + oz * cs, ry: Math.random() * 6.28, t: 0, color: col.clone().multiplyScalar(0.6) }); } }
        ultFuerza.set(ej.id, ej.fuerza);
        // en el mar: barcos
        if (info.agua) {
          const nb = Math.max(1, Math.min(6, Math.round(n / 9)));
          for (let k = 0; k < nb; k++) { const ox = (k % 3 - 1) * 0.7, oz = -Math.floor(k / 3) * 1.1, bob = Math.sin(t * 2 + k) * 0.04; poner('barco', p.x + ox * cs + oz * sn, 0.28 + bob, p.z - ox * sn + oz * cs, rumbo, Math.sin(t * 1.7 + k) * 0.05, Math.sin(t * 1.3 + k) * 0.06, 1.2, col); }
          if (pelea && Math.random() < dt * 6) chispas(p.x, 0.7, p.z, 4);
          continue;
        }
        // reparto por tipo de unidad según la composición
        const comp = ej.comp || { inf: 1 }, forma = DOCTRINAS[ej.doc]?.forma || 'bloque', orden = ORDEN[forma] || ORDEN.bloque, lista = [];
        const cuenta = {}; let resto = n;
        for (const u of ['asedio', 'bestia', 'cab', 'arq']) { let c = Math.round((comp[u] || 0) * n); if (u === 'asedio') c = comp.asedio > 0.03 ? Math.max(1, Math.min(4, Math.round(comp.asedio * n * 0.5))) : 0; c = Math.min(c, resto); cuenta[u] = c; resto -= c; }
        cuenta.inf = resto;
        for (const u of orden) for (let k = 0; k < (cuenta[u] || 0); k++) lista.push(u);
        const puestos = formacion(forma, lista.length, ej.id % 97);
        const esc = 1.25, rapido = forma === 'cuña' || forma === 'caos';
        lista.forEach((u, k) => {
          const tv = tipoVisual(u, ej.era ?? civ.era, ej.bestia || civ.bestia), [lx, lz0] = puestos[k] || [0, 0], fila = -lz0 / 0.26;
          let lz = lz0, y = 0, rx = 0;
          if (pelea && fila < 2.2 && u !== 'asedio') { lz += Math.max(0, Math.sin(t * (rapido ? 9 : 6) + k * 1.9)) * 0.1; rx = Math.sin(t * 8 + k) * 0.18; }
          const x = p.x + lx * esc * cs + lz * esc * sn, z = p.z - lx * esc * sn + lz * esc * cs;
          if (tv === 'avion') { const a = t * 0.9 + k * 1.3, r = 1.2 + (k % 3) * 0.3; poner('avion', p.x + Math.cos(a) * r, p.y + 2.4 + (k % 2) * 0.3, p.z + Math.sin(a) * r, a + Math.PI, 0, -0.35, 1.6, col); if (pelea && Math.random() < dt * 0.8) lanzar('bala', p.x + Math.cos(a) * r, p.y + 2.3, p.z + Math.sin(a) * r, (objetivo || p).x + (Math.random() - 0.5), (objetivo || p).y, (objetivo || p).z + (Math.random() - 0.5), 0.05); return; }
          y = tope(x, z) + (pelea ? 0 : Math.abs(Math.sin(t * (rapido ? 10 : 6) + k)) * 0.03);
          poner(tv, x, y, z, rumbo, rx, 0, esc, col);
          // disparos: arqueros/fusileros y máquinas en combate o sitio
          if (pelea && objetivo) {
            if (u === 'arq' && Math.random() < dt * (tv === 'fusilero' ? 1.2 : 0.7)) { const ox = (Math.random() - 0.5) * 1.4, oz = (Math.random() - 0.5) * 1.4; if (tv === 'fusilero') { lanzar('bala', x, y + 0.25, z, objetivo.x + ox, objetivo.y + 0.2, objetivo.z + oz, 0.05); humo.emitir({ x, y: y + 0.28, z, vx: 0, vy: 0.3, vz: 0, vida: 1, tam: 0.18, crece: 2, r: 0.85, g: 0.85, b: 0.85, a: 0.4 }); } else lanzar('flecha', x, y + 0.3, z, objetivo.x + ox, objetivo.y + 0.1, objetivo.z + oz, 1); }
            if (u === 'asedio' && Math.random() < dt * 0.35) { lanzar('bala', x, y + 0.25, z, objetivo.x + (Math.random() - 0.5) * 0.9, objetivo.y + 0.3, objetivo.z + (Math.random() - 0.5) * 0.9, tv === 'catapulta' || tv === 'ariete' ? 1.4 : 0.35); if (tv !== 'catapulta' && tv !== 'ariete') { humo.emitir({ x, y: y + 0.2, z, vx: 0, vy: 0.4, vz: 0, vida: 1.6, tam: 0.35, crece: 2.5, r: 0.8, g: 0.8, b: 0.8, a: 0.5 }); fuego.emitir({ x, y: y + 0.2, z, vx: 0, vy: 0, vz: 0, vida: 0.15, tam: 0.35, r: 1, g: 0.7, b: 0.3, a: 1 }); } }
          }
        });
        // estandartes (más en cruzadas) y el del general
        const nEst = forma === 'columna' && ej.doc === 'cruzada' ? 3 : 1;
        for (let k = 0; k < nEst; k++) { const lx = (k - (nEst - 1) / 2) * 0.6, lz = 0.25; poner('estandarte', p.x + lx * cs + lz * sn, tope(p.x, p.z), p.z - lx * sn + lz * cs, rumbo - Math.PI / 2 + Math.sin(t * 3 + ej.id + k) * 0.3, 0, 0, ej.general ? 1.5 : 1.15, col); }
        // escaleras contra la muralla en los asaltos
        if (ej.sitio >= 0 && objetivo && (ej.era ?? 0) <= 3) for (let k = 0; k < 3; k++) { const a = rumbo + Math.PI + (k - 1) * 0.35, r0 = 0.9, x = objetivo.x + Math.sin(a) * r0, z = objetivo.z + Math.cos(a) * r0; poner('escalera', x, tope(x, z), z, a + Math.PI, -0.35, 0, 1.2); }
        // polvo al marchar; chispas en el frente
        if (pelea && ej.comb >= 0 && Math.random() < dt * 10) { const fx = objetivo ? (p.x + objetivo.x) / 2 : p.x, fz = objetivo ? (p.z + objetivo.z) / 2 : p.z; chispas(fx + (Math.random() - 0.5) * 1.2, tope(fx, fz) + 0.3, fz + (Math.random() - 0.5) * 1.2, 3); }
        else if (!pelea && info.dir != null && Math.random() < dt * (rapido ? 6 : 3)) humo.emitir({ x: p.x - sn * 0.8, y: p.y + 0.08, z: p.z - cs * 0.8, vx: 0, vy: 0.2, vz: 0, vida: 1.4, tam: 0.45, crece: 1.6, r: 0.72, g: 0.64, b: 0.5, a: 0.3 });
        // terror: antorchas
        if (forma === 'caos' && Math.random() < dt * 6) fuego.emitir({ x: p.x + (Math.random() - 0.5) * 1.5, y: p.y + 0.5, z: p.z + (Math.random() - 0.5) * 1.5, vx: 0, vy: 0.8, vz: 0, vida: 0.4, tam: 0.18, r: 1, g: 0.5, b: 0.15, a: 1 });
      }
      for (const id of [...ultFuerza.keys()]) if (!vivos.has(id)) { ultFuerza.delete(id); centros.delete(id); rumbos.delete(id); }
      // 2) caídos: se desploman y se hunden en la tierra
      for (let i = caidos.length - 1; i >= 0; i--) {
        const c = caidos[i]; c.t += dt; if (c.t > 9) { caidos.splice(i, 1); continue; }
        const y = tope(c.x, c.z) - Math.max(0, c.t - 7) * 0.08; poner('caido', c.x, y, c.z, c.ry, -Math.min(1, c.t / 0.4) * 0.2, 0, 1.2, c.color);
      }
      // 3) proyectiles en arco (flechas, piedras, balas)
      for (let i = proyectiles.length - 1; i >= 0; i--) {
        const q = proyectiles[i]; q.t += dt / q.dur; if (q.t >= 1) { if (q.tipo === 'bala' && q.h > 0.3) { chispas(q.x1, q.y1 + 0.1, q.z1, 6, [1, 0.6, 0.25]); humo.emitir({ x: q.x1, y: q.y1 + 0.1, z: q.z1, vx: 0, vy: 0.4, vz: 0, vida: 1.5, tam: 0.5, crece: 2, r: 0.5, g: 0.45, b: 0.4, a: 0.5 }); } proyectiles.splice(i, 1); continue; }
        const k = q.t, x = q.x0 + (q.x1 - q.x0) * k, z = q.z0 + (q.z1 - q.z0) * k, y = q.y0 + (q.y1 - q.y0) * k + Math.sin(Math.PI * k) * q.h;
        if (GIRA_BALA.has(q.tipo)) { const vx = q.x1 - q.x0, vz = q.z1 - q.z0, vy = q.y1 - q.y0 + Math.cos(Math.PI * k) * Math.PI * q.h; _v.set(vx, vy, vz).normalize(); _q.setFromUnitVectors(_up, _v); _o.position.set(x, y, z); _o.quaternion.copy(_q); _o.scale.setScalar(1.4); _o.updateMatrix(); if (usados.flecha < MAX.flecha) mallas.flecha.setMatrixAt(usados.flecha++, _o.matrix); }
        else poner('bala', x, y, z, 0, 0, 0, q.h > 0.3 ? 1.6 : 0.6);
      }
      // 4) columnas de refugiados que huyen de la ciudad caída
      tFuego += dt;
      for (let i = refugiados.length - 1; i >= 0; i--) {
        const r = refugiados[i]; r.t += dt; if (r.t > r.dur) { refugiados.splice(i, 1); continue; }
        for (let k = 0; k < r.k; k++) {
          const f = Math.min(1, Math.max(0, r.t / r.dur - k * 0.025)); if (f <= 0) continue;
          const x = r.de.x + (r.a.x - r.de.x) * f + Math.sin(k * 2.1) * 0.25, z = r.de.z + (r.a.z - r.de.z) * f + Math.cos(k * 1.7) * 0.25, ry = Math.atan2(r.a.x - r.de.x, r.a.z - r.de.z);
          poner('refugiado', x, tope(x, z) + Math.abs(Math.sin(t * 7 + k)) * 0.02, z, ry, 0, 0, 1.2, r.color);
        }
      }
      for (const k in mallas) { const m = mallas[k]; m.count = usados[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    },
    get soldados() { let s = 0; for (const k in mallas) if (!['flecha', 'bala', 'escalera', 'refugiado', 'caido'].includes(k)) s += mallas[k].count; return s; },
  };
}
