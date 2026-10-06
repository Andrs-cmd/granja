// =====================================================================
// Ciudad zombi — el dibujo con three. El orbe es una «ventana» circular centrada en el protagonista:
// el mundo entero se corre bajo sus pies (orbe.mundo.position = −ancla) y lo que cae fuera del círculo
// se recorta en el sombreador (discard), así los edificios del borde se ven cortados como en una maqueta.
// Cada manzana es UNA malla fundida (más una de fuego/letreros y otra de ventanas encendidas): pocas llamadas.
// =====================================================================
import { THREE, fundirGeo, GEO, crearPersona, animarPersona } from '../motor/orbe3d.js';
import { P, celda, edificiosCerca, horaDe, esNoche } from './sim.js';

const PIR4 = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4); // techo a cuatro aguas alineado con los ejes
const C_ACERA = 0x8a8680, C_PASTO = 0x5d6f45, C_PLAZA = 0x86817a, C_AMAR = 0xc9a63a, C_BLANCO = 0xd6d3cc, C_VIDRIO = 0x262c34, C_TABLA = 0x7a5a3a;
const MUROS = [0xd2c2a4, 0xc39c76, 0xa6b49c, 0xb2a0b2, 0xcfae88, 0x9cacbc], TECHOS = [0x7a3a2a, 0x5a4a44, 0x6a5038, 0x46505a];
const CONCRETO = [0x9a948a, 0x868b92, 0xa28a74, 0x7a8276, 0xb0a898], AUTOS = [0x8a2a2a, 0x2a4a7a, 0xc9c4b8, 0x3a3a3a, 0x6a7a4a, 0xb08a2a];
export const ROPAS = [0xc8742a, 0x3a6a9a, 0x8a3a3a, 0x4a7a4a, 0x6a4a8a, 0xb0a040, 0x5a6a7a, 0x9a5a7a];

export function crearEscena(O) {
  const R = O.R, mundo = O.mundo, tactil = matchMedia('(pointer: coarse)').matches;
  const MAX_Z = tactil ? 18 : 28, SOMBRA_R = tactil ? 30 : 99; // en celular: menos zombis dibujados y solo las manzanas cercanas proyectan sombra
  // ---------------------------------------------------------------- materiales con recorte circular (y bajo la cúpula)
  const uR = { value: R - 0.25 }, uD = { value: R + 5.0 };
  function recortar(mat) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uR = uR; sh.uniforms.uD = uD;
      sh.vertexShader = 'varying vec3 vMundoZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 pZ = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\npZ = instanceMatrix * pZ;\n#endif\nvMundoZ = (modelMatrix * pZ).xyz;');
      sh.fragmentShader = 'varying vec3 vMundoZ;\nuniform float uR, uD;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  float dZ = length(vMundoZ.xz);\n  if (dZ > uR || vMundoZ.y > 3.6 + sqrt(max(0.0, uD * uD - dZ * dZ))) discard;');
    };
    mat.customProgramCacheKey = () => 'recorte-zombi-' + mat.type;
    return mat;
  }
  const MAT = recortar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }));
  const MAT_F = recortar(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const MAT_L = recortar(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  const PROF = recortar(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

  // ---------------------------------------------------------------- geometría de una manzana (coordenadas locales a la celda)
  function geoCelda(C) {
    const B = [], F = [], L = [], ox = C.ox, oz = C.oz;
    const caja = (a, c, x, y, z, sx, sy, sz, ry = 0) => a.push([GEO.caja, c, x - ox, y, z - oz, sx, sy, sz, 0, ry, 0]);
    const pieza = (a, g, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => a.push([g, c, x - ox, y, z - oz, sx, sy, sz, rx, ry, rz]);
    const rot = (x, z, r, dx, dz) => [x + dx * Math.cos(r) + dz * Math.sin(r), z - dx * Math.sin(r) + dz * Math.cos(r)];
    const cx = ox + P / 2, cz = oz + P / 2;
    // suelo: acera, interior de la manzana, rayas y cebras
    caja(B, C_ACERA, cx, 0.08, cz, P - 8, 0.16, P - 8);
    const interior = C.tipo === 'parque' ? C_PASTO : C.tipo === 'plaza' || C.tipo === 'evac' ? C_PLAZA : C.distrito === 'residencial' || C.distrito === 'afueras' ? 0x66704a : 0x77736c;
    caja(B, interior, cx, 0.1, cz, P - 11.2, 0.2, P - 11.2);
    if (C.tipo === 'parque') { caja(B, 0x9a8f78, cx, 0.205, cz, P - 11.2, 0.01, 2.2); caja(B, 0x9a8f78, cx, 0.205, cz, 2.2, 0.01, P - 11.2); }
    for (let t = 6; t < P - 4; t += 4) { caja(B, C_AMAR, ox + t, 0.012, oz, 2, 0.02, 0.16); caja(B, C_AMAR, ox, 0.012, oz + t, 0.16, 0.02, 2); }
    for (let k = -3; k <= 3; k++) { caja(B, C_BLANCO, ox + 5.3, 0.012, oz + k * 1.1, 1.5, 0.02, 0.5); caja(B, C_BLANCO, ox + k * 1.1, 0.012, oz + 5.3, 0.5, 0.02, 1.5); }
    // edificios
    for (const e of C.edif) {
      const w = e.x1 - e.x0, d = e.z1 - e.z0, mx = (e.x0 + e.x1) / 2, mz = (e.z0 + e.z1) / 2, h = e.h, v = e.v;
      const cara = (a, lado, u, y, an, al, pr, c) => { // caja pegada a una fachada (u: desplazamiento a lo largo)
        if (lado === 0) caja(a, c, mx + u, y, e.z0 - pr / 2, an, al, pr); else if (lado === 1) caja(a, c, mx + u, y, e.z1 + pr / 2, an, al, pr);
        else if (lado === 2) caja(a, c, e.x0 - pr / 2, y, mz + u, pr, al, an); else caja(a, c, e.x1 + pr / 2, y, mz + u, pr, al, an);
      };
      const largo = (lado) => (lado < 2 ? w : d);
      const ventanas = (y0, alto, pisos, cada) => { // ventanas en las 4 caras; algunas tapiadas, otras encendidas de noche
        for (let p = 0; p < pisos; p++) for (let lado = 0; lado < 4; lado++) {
          const n = Math.max(1, Math.floor(largo(lado) / cada));
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) * largo(lado) / n - largo(lado) / 2, y = y0 + p * alto, q = (v * 997 + p * 31 + lado * 7 + k * 13) % 1;
            if (lado === e.lado && p === 0 && Math.abs(u) < 1.2) continue;
            if (q < 0.18) { cara(B, lado, u, y, 1.1, 0.12, 0.1, C_TABLA); cara(B, lado, u, y + 0.3, 1.1, 0.12, 0.1, C_TABLA); cara(B, lado, u, y - 0.3, 1.1, 0.12, 0.1, C_TABLA); }
            else if (q > 0.9) cara(L, lado, u, y, 0.9, 0.9, 0.06, 0xffcf7a);
            else cara(B, lado, u, y, 0.9, 0.9, 0.06, C_VIDRIO);
          }
        }
      };
      const puerta = (c = 0x3a2a20) => cara(B, e.lado, 0, 1.05, 1.1, 2.1, 0.08, c);
      if (e.tipo === 'casa') {
        const muro = MUROS[Math.floor(v * MUROS.length)], techo = TECHOS[Math.floor(v * 7) % TECHOS.length], rh = 1.4 + v;
        caja(B, muro, mx, h / 2 + 0.2, mz, w, h, d);
        pieza(B, PIR4, techo, mx, h + 0.2 + rh / 2, mz, (w / 2 + 0.35) / 0.707, rh, (d / 2 + 0.35) / 0.707);
        puerta(); ventanas(1.7, 3, 1, 3);
      } else if (e.tipo === 'edificio' || e.tipo === 'hospital') {
        const muro = e.tipo === 'hospital' ? 0xdedcd4 : CONCRETO[Math.floor(v * CONCRETO.length)], pisos = Math.max(2, Math.floor(h / 3));
        caja(B, muro, mx, h / 2 + 0.2, mz, w, h, d); caja(B, 0x55534e, mx, h + 0.35, mz, w + 0.3, 0.3, d + 0.3);
        puerta(0x2a2a2a); ventanas(1.8, 3, pisos, 2.6);
        if (e.tipo === 'hospital') { // cruz roja en la azotea y franja
          caja(F, 0xe02a2a, mx, h + 2.2, mz, 3.2, 1, 0.3); caja(F, 0xe02a2a, mx, h + 2.2, mz, 1, 3.2, 0.3); caja(B, 0x6a6a66, mx, h + 0.9, mz, 0.3, 1.2, 0.3);
          caja(B, 0xb03030, mx, 3.6, mz, w + 0.1, 0.5, d + 0.1);
        } else if (v > 0.5) { caja(B, 0x6a5a4a, mx + w * 0.2, h + 1.2, mz, 1.6, 1.6, 1.6); }
      } else {
        const T = { tienda: [MUROS[Math.floor(v * MUROS.length)], [0xb03a3a, 0x3a7ab0, 0x3a9a5a, 0xc08a2a][Math.floor(v * 4)]], farmacia: [0xd8dbd4, 0x2fbf62], supermercado: [0xc9c2b4, 0xc0302a], comisaria: [0x56657e, 0xe8e8e8], gasolinera: [0xe0ddd6, 0xc8302a], ferreteria: [0xa8774a, 0xe08a2a] }[e.tipo];
        caja(B, T[0], mx, h / 2 + 0.2, mz, w, h, d); caja(B, 0x55534e, mx, h + 0.3, mz, w + 0.25, 0.25, d + 0.25);
        puerta(0x22262c); cara(B, e.lado, largo(e.lado) * 0.25, 1.4, largo(e.lado) * 0.3, 1.6, 0.07, C_VIDRIO); cara(B, e.lado, -largo(e.lado) * 0.25, 1.4, largo(e.lado) * 0.3, 1.6, 0.07, C_VIDRIO);
        if (h > 5) ventanas(4.4, 3, Math.floor((h - 3) / 3), 2.8);
        cara(B, e.lado, 0, 2.75, largo(e.lado) * 0.92, 0.18, 1.3, T[1]); // toldo / alero
        cara(e.tipo === 'tienda' ? B : F, e.lado, 0, Math.min(h - 0.3, 3.6), largo(e.lado) * 0.55, 0.6, 0.15, T[1]); // letrero (los de servicios siguen encendidos)
        if (e.tipo === 'farmacia') { cara(F, e.lado, largo(e.lado) * 0.36, 3.2, 0.9, 0.3, 0.2, 0x3aff7a); cara(F, e.lado, largo(e.lado) * 0.36, 3.2, 0.3, 0.9, 0.2, 0x3aff7a); }
        if (e.tipo === 'comisaria') { caja(B, 0xe8e8e8, mx, h * 0.55, mz, w + 0.08, 0.5, d + 0.08); caja(F, 0xff2a2a, mx - 0.5, h + 0.6, mz, 0.8, 0.3, 0.4); caja(F, 0x2a5aff, mx + 0.5, h + 0.6, mz, 0.8, 0.3, 0.4); caja(B, 0x888888, e.x0 + 0.6, 4, e.z0 + 0.6, 0.12, 8, 0.12); caja(B, 0xf2d23a, e.x0 + 1.2, 7.4, e.z0 + 0.6, 1.1, 0.7, 0.04); }
      }
    }
    // objetos de la calle y del parque
    for (const p of C.props) {
      if (p.t === 'auto') {
        const col = p.quemado ? 0x2b2522 : AUTOS[p.c], r = p.rot, x = p.x, z = p.z;
        pieza(B, GEO.caja, col, x, 0.62, z, 1.85, 0.62, 4.1, 0, r, 0);
        const [cx2, cz2] = rot(x, z, r, 0, -0.25); pieza(B, GEO.caja, p.quemado ? 0x1a1816 : C_VIDRIO, cx2, 1.18, cz2, 1.6, 0.55, 2.1, 0, r, 0);
        for (const [dx, dz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) { const [wx, wz] = rot(x, z, r, dx, dz); pieza(B, GEO.cil, 0x181818, wx, 0.34, wz, 0.34, 0.24, 0.34, 0, r, Math.PI / 2); }
        if (p.quemado) { const [rx, rz] = rot(x, z, r, 0, 1.4); pieza(B, GEO.caja, 0x5a3a26, rx, 0.95, rz, 1.7, 0.08, 1.1, 0, r, 0); }
        if (p.fuego) { pieza(F, GEO.cono, 0xff6a1a, x, 1.9, z, 0.7, 1.4, 0.7); pieza(F, GEO.cono, 0xffc040, x, 1.7, z, 0.4, 0.9, 0.4); }
      } else if (p.t === 'barricada') {
        const lx = p.x1 - p.x0, lz = p.z1 - p.z0, n = Math.max(2, Math.round(Math.max(lx, lz) / 1.1));
        for (let k = 0; k < n; k++) for (let f = 0; f < 3; f++) {
          const t = (k + 0.5 + (f % 2) * 0.5) / (n + 0.5), x = p.eje === 0 ? (p.x0 + p.x1) / 2 : p.x0 + lx * t, z = p.eje === 0 ? p.z0 + lz * t : (p.z0 + p.z1) / 2;
          pieza(B, GEO.capsula, 0xb5a27a, x, 0.22 + f * 0.32, z, 0.5, 0.3, 0.5, 0, 0, Math.PI / 2);
        }
        const mx2 = (p.x0 + p.x1) / 2, mz2 = (p.z0 + p.z1) / 2; pieza(B, GEO.caja, C_TABLA, mx2, 1.3, mz2, p.eje === 0 ? 0.12 : lx * 0.9, 0.15, p.eje === 0 ? lz * 0.9 : 0.12, 0, 0, 0.3);
      } else if (p.t === 'barril') { pieza(B, GEO.cil, 0x6a3a22, p.x, 0.62, p.z, 0.32, 0.9, 0.32); pieza(F, GEO.cono, 0xff7a1a, p.x, 1.4, p.z, 0.32, 0.8, 0.32); pieza(F, GEO.cono, 0xffd050, p.x, 1.25, p.z, 0.18, 0.5, 0.18); }
      else if (p.t === 'basura') pieza(B, GEO.esfera, 0x1d1e21, p.x, 0.2 + p.s * 0.6, p.z, p.s, p.s * 0.8, p.s);
      else if (p.t === 'sangre') pieza(B, GEO.cil, 0x4a0e0e, p.x, 0.012, p.z, p.s, 0.012, p.s * 0.7);
      else if (p.t === 'poste') { pieza(B, GEO.cil, 0x55585c, p.x, 2.6, p.z, 0.07, 5.2, 0.07); pieza(B, GEO.caja, 0x55585c, p.x + 0.6, 5.15, p.z, 1.3, 0.08, 0.1); pieza(B, GEO.caja, 0x2a2a2a, p.x + 1.15, 5.05, p.z, 0.4, 0.12, 0.25); }
      else if (p.t === 'arbol') { const s = p.s, seco = (p.x * 7 + p.z * 3) % 5 < 1; pieza(B, GEO.cil, 0x4a3628, p.x, 1.1 * s, p.z, 0.16 * s, 2.2 * s, 0.16 * s); pieza(B, GEO.esfera, seco ? 0x6a5a3a : 0x3f5a30, p.x, 2.9 * s, p.z, 1.3 * s, 1.5 * s, 1.3 * s); }
      else if (p.t === 'banca') { const [ax, az] = rot(p.x, p.z, p.rot, 0, 0); pieza(B, GEO.caja, 0x6a4a30, ax, 0.5, az, 1.8, 0.1, 0.5, 0, p.rot, 0); pieza(B, GEO.caja, 0x6a4a30, ax, 0.8, az, 1.8, 0.4, 0.08, 0, p.rot, 0); }
      else if (p.t === 'fuente') { pieza(B, GEO.cil, 0x9a968e, p.x, 0.45, p.z, 1.8, 0.5, 1.8); pieza(B, GEO.cil, 0x2a3a40, p.x, 0.66, p.z, 1.55, 0.06, 1.55); pieza(B, GEO.cil, 0x9a968e, p.x, 1.3, p.z, 0.25, 1.4, 0.25); }
      else if (p.t === 'marquesina') {
        caja(B, 0xe6e2da, p.x, 4.4, p.z, p.w, 0.35, p.d); caja(B, 0xc8302a, p.x, 4.2, p.z, p.w + 0.05, 0.12, p.d + 0.05);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) caja(B, 0xcfcac2, p.x + sx * (p.w / 2 - 0.5), 2.2, p.z + sz * (p.d / 2 - 0.5), 0.3, 4.4, 0.3);
      } else if (p.t === 'surtidor') { caja(B, 0xc8302a, p.x, 0.75, p.z, 0.6, 1.5, 1.0); caja(B, 0xeeeeee, p.x, 1.2, p.z, 0.62, 0.3, 0.7); }
      else if (p.t === 'carpa') { caja(B, 0x4a5a34, p.x, 0.9, p.z, 3.4, 1.8, 2.6); pieza(B, PIR4, 0x56663a, p.x, 2.4, p.z, 2.6, 1.2, 2.0); }
      else if (p.t === 'sacos') { const lx = p.x1 - p.x0, lz = p.z1 - p.z0; caja(B, 0xb5a27a, (p.x0 + p.x1) / 2, 0.55, (p.z0 + p.z1) / 2, lx, 1.1, lz); }
      else if (p.t === 'helipuerto') {
        pieza(B, GEO.cil, 0x2a2c30, p.x, 0.22, p.z, 5.2, 0.04, 5.2);
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; caja(B, C_AMAR, p.x + Math.cos(a) * 4.6, 0.25, p.z + Math.sin(a) * 4.6, 0.3, 0.02, 1.6, -a); }
        caja(B, C_BLANCO, p.x - 1, 0.25, p.z, 0.45, 0.02, 3); caja(B, C_BLANCO, p.x + 1, 0.25, p.z, 0.45, 0.02, 3); caja(B, C_BLANCO, p.x, 0.25, p.z, 2, 0.02, 0.45);
        for (const [sx, sz] of [[-1, -1], [1, 1]]) caja(F, 0x9aff6a, p.x + sx * 6.5, 0.4, p.z + sz * 6.5, 0.3, 0.3, 0.3);
      }
    }
    return { b: fundirGeo(B), f: F.length ? fundirGeo(F) : null, l: L.length ? fundirGeo(L) : null, fuegos: C.props.filter((p) => p.fuego || p.t === 'barril').map((p) => [p.x, p.z]) };
  }

  // ---------------------------------------------------------------- celdas visibles: caché de geometrías + piscina de mallas
  const geos = new Map(), activas = new Map(), piscina = [];
  function malla() {
    const m = piscina.pop(); if (m) return m;
    const b = new THREE.Mesh(undefined, MAT); b.castShadow = true; b.receiveShadow = true; b.customDepthMaterial = PROF;
    const f = new THREE.Mesh(undefined, MAT_F), l = new THREE.Mesh(undefined, MAT_L);
    return { b, f, l };
  }
  function geoDe(C, k) {
    let g = geos.get(k); if (g) { geos.delete(k); geos.set(k, g); return g; } // al final = recién usado
    g = geoCelda(C); geos.set(k, g);
    if (geos.size > 90) for (const [k2, g2] of geos) { if (activas.has(k2)) continue; g2.b.dispose(); g2.f?.dispose(); g2.l?.dispose(); geos.delete(k2); if (geos.size <= 80) break; }
    return g;
  }
  let sem = null, noche = 0;
  function celdasVisibles(ax, az, todas) {
    const need = new Set(), i0 = Math.floor((ax - R - 5) / P), i1 = Math.floor((ax + R + 5) / P), j0 = Math.floor((az - R - 5) / P), j1 = Math.floor((az + R + 5) / P);
    const lista = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const x0 = i * P - 5, z0 = j * P - 5, dx = Math.max(x0 - ax, 0, ax - (x0 + P + 5)), dz = Math.max(z0 - az, 0, az - (z0 + P + 5));
      if (Math.hypot(dx, dz) > R + 1) continue; const k = `${i},${j}`; need.add(k); if (!activas.has(k)) lista.push([i, j, k, Math.hypot((i + 0.5) * P - ax, (j + 0.5) * P - az)]);
    }
    for (const [k, m] of activas) if (!need.has(k)) { mundo.remove(m.b, m.f, m.l); piscina.push(m); activas.delete(k); }
    lista.sort((a, b) => a[3] - b[3]);
    let presupuesto = todas ? 999 : 2; // construir pocas por cuadro para no dar tirones
    for (const [i, j, k] of lista) {
      if (!geos.has(k) && presupuesto-- <= 0) continue;
      const C = celda(sem, i, j), g = geoDe(C, k), m = malla();
      m.b.geometry = g.b; m.b.position.set(C.ox, 0, C.oz); mundo.add(m.b);
      if (g.f) { m.f.geometry = g.f; m.f.position.copy(m.b.position); mundo.add(m.f); }
      if (g.l) { m.l.geometry = g.l; m.l.position.copy(m.b.position); mundo.add(m.l); }
      m.g = g; activas.set(k, m);
    }
  }

  // ---------------------------------------------------------------- personas: protagonista, zombis (piscina por tipo) y humanos
  const ocultarSombra = (p) => p.g.traverse((o) => { if (o.isMesh) o.castShadow = o === p.torso; }); // sombra solo del torso: ahorra llamadas
  let pj = null, armasPj = {};
  function crearPj(S) {
    if (pj) mundo.remove(pj.g);
    pj = crearPersona({ ropa: ROPAS[S.pj.ropa % ROPAS.length], pantalon: 0x2f3a4a, pelo: 0x2a1e14, peinado: S.pj.ropa % 2 ? 'largo' : 'corto', extra: [[GEO.caja, 0x4a3a2a, 0, 1.25, -0.24, 0.42, 0.5, 0.2]] });
    mundo.add(pj.g); armasPj = {};
    const mano = pj.brazos[1], A = (partes) => { const m = new THREE.Group(); const f = fundirGeo(partes); m.add(new THREE.Mesh(f, MAT)); m.position.set(0, -0.66, 0.02); m.visible = false; mano.add(m); return m; };
    armasPj.bate = A([[GEO.cil, 0x9a6a3a, 0, 0, 0.45, 0.05, 0.9, 0.05, Math.PI / 2, 0, 0], [GEO.cil, 0x9a6a3a, 0, 0, 0.85, 0.08, 0.4, 0.08, Math.PI / 2, 0, 0]]);
    armasPj.tubo = A([[GEO.cil, 0x7a7d82, 0, 0, 0.5, 0.04, 1.1, 0.04, Math.PI / 2, 0, 0]]);
    armasPj.machete = A([[GEO.caja, 0x2a2a2a, 0, 0, 0.08, 0.05, 0.05, 0.2], [GEO.caja, 0xc8ccd0, 0, 0, 0.55, 0.02, 0.1, 0.75]]);
    armasPj.hacha = A([[GEO.cil, 0x6a4a2a, 0, 0, 0.45, 0.04, 0.9, 0.04, Math.PI / 2, 0, 0], [GEO.caja, 0x9aa0a6, 0, 0.12, 0.82, 0.03, 0.3, 0.2]]);
    armasPj.pistola = A([[GEO.caja, 0x1e1e1e, 0, 0.02, 0.12, 0.06, 0.08, 0.26], [GEO.caja, 0x1e1e1e, 0, -0.06, 0.02, 0.05, 0.14, 0.07]]);
    armasPj.escopeta = A([[GEO.caja, 0x5a3a22, 0, 0, -0.05, 0.07, 0.1, 0.4], [GEO.cil, 0x2a2a2a, 0, 0.02, 0.5, 0.035, 0.8, 0.035, Math.PI / 2, 0, 0]]);
  }
  const zPool = { lento: [], corredor: [], gordo: [] }, zUsa = new Map();
  const PIEL_Z = [0x7d9a6a, 0x8aa07a, 0x6f8a5f, 0x9aa88a], ROPA_Z = [0x5a4a3a, 0x4a5a6a, 0x6a3a3a, 0x4a4a42, 0x6a6a5a, 0x3a4a3a];
  function zombiNuevo(tipo) {
    const i = zPool[tipo].length + zUsa.size, sangre = [[GEO.esfera, 0x5a0e0e, 0.12, 1.28, 0.21, 0.13, 0.12, 0.04], [GEO.esfera, 0x5a0e0e, -0.15, 1.0, 0.2, 0.08, 0.1, 0.04]];
    const p = crearPersona({ piel: tipo === 'corredor' ? 0x9aa88a : PIEL_Z[i % 4], ropa: ROPA_Z[i % 6], pantalon: ROPA_Z[(i + 2) % 6], pelo: i % 3 ? 0x2a2a22 : null, peinado: i % 3 ? (i % 2 ? 'largo' : 'corto') : 'calvo', ancho: tipo === 'gordo' ? 1.55 : tipo === 'corredor' ? 0.85 : 1, alto: tipo === 'gordo' ? 1.05 : tipo === 'corredor' ? 0.97 : 0.95 + (i % 5) * 0.03, extra: sangre });
    ocultarSombra(p); p.tipo = tipo; mundo.add(p.g); return p;
  }
  const humanos = new Map();
  function humano(h) {
    let p = humanos.get(h.id); if (p) return p;
    p = crearPersona({ ropa: ROPAS[(h.ropa + 1) % ROPAS.length], pantalon: [0x2a3a5a, 0x4a3a2a, 0x3a3a3a][h.id % 3], pelo: [0x2a1e14, 0x5a3a1a, 0x1a1a1a, 0x8a6a3a][h.id % 4], peinado: h.id % 2 ? 'largo' : 'corto', alto: 0.94 + (h.id % 4) * 0.03 });
    ocultarSombra(p); p.g.userData.id = 'n:' + h.id; mundo.add(p.g); humanos.set(h.id, p); return p;
  }

  // ---------------------------------------------------------------- marcas: botín pendiente, refugios, ruido, ruta, humo y helicóptero
  const COL_T = { farmacia: 0x3aff7a, hospital: 0xff4a4a, comisaria: 0x5a8aff, supermercado: 0xffd24a, tienda: 0xffe08a, ferreteria: 0xff9a3a, gasolinera: 0xff9a3a, casa: 0xeeeeee, edificio: 0xcfd6e0 };
  const marcas = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.28), recortar(new THREE.MeshBasicMaterial({ toneMapped: false })), 90); marcas.setColorAt(0, new THREE.Color(1, 1, 1)); marcas.count = 0; marcas.frustumCulled = false; mundo.add(marcas); // el color por instancia debe existir antes de compilar
  const tablas = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.16, 0.08), recortar(new THREE.MeshStandardMaterial({ color: C_TABLA })), 60); tablas.count = 0; tablas.frustumCulled = false; mundo.add(tablas);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
  const anillos = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.visible = false; mundo.add(m); return m; });
  const lineaGeo = new THREE.BufferGeometry(); lineaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
  const linea = new THREE.Line(lineaGeo, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.55 })); linea.frustumCulled = false; mundo.add(linea);
  const meta = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe6a0, toneMapped: false })); mundo.add(meta);
  const humo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), recortar(new THREE.MeshBasicMaterial({ color: 0x6aff7a, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false })), 12); humo.frustumCulled = false; mundo.add(humo);
  const heli = new THREE.Group(); {
    heli.add(new THREE.Mesh(fundirGeo([[GEO.esferaFina, 0x3a4a2e, 0, 0, 0, 1.4, 1.1, 2.2], [GEO.caja, 0x3a4a2e, 0, 0.3, -3, 0.3, 0.35, 3], [GEO.caja, 0x3a4a2e, 0, 0.9, -4.4, 0.1, 1.2, 0.6], [GEO.esfera, 0x1a2028, 0, 0.25, 1.4, 0.9, 0.6, 0.8], [GEO.caja, 0x222222, -0.9, -1.2, 0, 0.08, 0.08, 3], [GEO.caja, 0x222222, 0.9, -1.2, 0, 0.08, 0.08, 3], [GEO.caja, 0x222222, -0.9, -0.85, 0, 0.06, 0.7, 0.06], [GEO.caja, 0x222222, 0.9, -0.85, 0, 0.06, 0.7, 0.06], [GEO.cil, 0x222222, 0, 1.25, 0, 0.12, 0.4, 0.12]]), MAT));
    const rotor = new THREE.Mesh(fundirGeo([[GEO.caja, 0x1a1a1a, 0, 0, 0, 9, 0.06, 0.3], [GEO.caja, 0x1a1a1a, 0, 0, 0, 0.3, 0.06, 9]]), MAT); rotor.position.y = 1.5; heli.add(rotor); heli.userData.rotor = rotor;
    heli.children[0].castShadow = true; heli.visible = false; mundo.add(heli);
  }
  // luces: la linterna del protagonista y el resplandor del fuego más cercano (siempre existen: cambiar el número de luces recompila sombreadores)
  const linterna = new THREE.PointLight(0xffe2b0, 0, 16, 1.3); mundo.add(linterna);
  const fogata = new THREE.PointLight(0xff8a3a, 0, 14, 1.4); mundo.add(fogata);

  // ---------------------------------------------------------------- vida ambiental: perros, cuervos, alarmas y lluvia
  const perros = new Map();
  function perro(a) {
    let p = perros.get(a.id); if (p) return p;
    const c = [0x7a5a3a, 0x3a3230, 0xb09a7a, 0x5a4a3a][a.id % 4];
    p = new THREE.Group(); const cuerpo = new THREE.Mesh(fundirGeo([[GEO.capsula, c, 0, 0.5, 0, 0.32, 0.5, 0.32, Math.PI / 2, 0, 0], [GEO.esfera, c, 0, 0.68, 0.42, 0.17, 0.16, 0.2], [GEO.caja, 0x2a2420, 0, 0.66, 0.6, 0.08, 0.06, 0.1], [GEO.cono, c, -0.08, 0.84, 0.4, 0.05, 0.12, 0.05], [GEO.cono, c, 0.08, 0.84, 0.4, 0.05, 0.12, 0.05], [GEO.cil, c, 0, 0.62, -0.42, 0.03, 0.3, 0.03, -0.8, 0, 0]]), MAT);
    const patas = new THREE.Mesh(fundirGeo([[GEO.cil, c, -0.1, -0.2, 0.25, 0.04, 0.4, 0.04], [GEO.cil, c, 0.1, -0.2, 0.25, 0.04, 0.4, 0.04], [GEO.cil, c, -0.1, -0.2, -0.25, 0.04, 0.4, 0.04], [GEO.cil, c, 0.1, -0.2, -0.25, 0.04, 0.4, 0.04]]), MAT);
    patas.position.y = 0.42; cuerpo.castShadow = true; p.add(cuerpo, patas); p.userData.patas = patas; mundo.add(p); perros.set(a.id, p); return p;
  }
  const cuervos = new THREE.InstancedMesh(fundirGeo([[GEO.esfera, 0x141414, 0, 0, 0, 0.1, 0.08, 0.16], [GEO.caja, 0x141414, 0, 0.02, 0, 0.42, 0.02, 0.12]]), MAT, 80); cuervos.count = 0; cuervos.frustumCulled = false; mundo.add(cuervos);
  const alarmas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.12, 0.25), recortar(new THREE.MeshBasicMaterial({ color: 0xffa020, toneMapped: false })), 12); alarmas.count = 0; alarmas.frustumCulled = false; mundo.add(alarmas);
  const N_LL = tactil ? 260 : 520, gotas = [];
  const lluvia = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.1, 0.03), recortar(new THREE.MeshBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: 0.45, depthWrite: false })), N_LL); lluvia.count = 0; lluvia.frustumCulled = false; mundo.add(lluvia);
  for (let i = 0; i < N_LL; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; gotas.push([Math.cos(a) * r, Math.random() * 30, Math.sin(a) * r]); }
  function vidaAmbiental(dt, S) {
    const vivos = new Set(); let nc = 0;
    for (const a of S.anim) {
      if (!dentroVentana(a.x, a.z, 0.8)) continue;
      if (a.t === 'perro') {
        const p = perro(a); vivos.add(a.id); p.visible = true; p.position.set(a.x, altura(a.x, a.z), a.z); p.rotation.y = a.dir;
        const f = tAcum * (4 + a.vel * 3); p.userData.patas.rotation.x = a.vel > 0.1 ? Math.sin(f) * 0.5 : 0; p.children[0].position.y = a.vel > 0.1 ? Math.abs(Math.sin(f)) * 0.05 : 0;
      } else for (let k = 0; k < a.n && nc < 80; k++) { // cada cuervo picotea o aletea según la bandada
        const vuela = a.est === 'vuela', ang = k * 2.4 + a.id;
        _v.set(a.x + Math.cos(ang) * (0.6 + k * 0.25) + (vuela ? Math.cos(ang) * a.tE : 0), 0.12 + (vuela ? a.y + Math.sin(tAcum * 3 + k) * 0.5 : Math.abs(Math.sin(tAcum * 6 + k)) * 0.06), a.z + Math.sin(ang) * (0.6 + k * 0.25) + (vuela ? Math.sin(ang) * a.tE : 0));
        _q.setFromEuler(_e.set(0, ang + (vuela ? 0 : Math.sin(tAcum + k)), 0)); _s.set(vuela ? 1 : 0.35, 1, 1).multiplyScalar(1 + (vuela ? Math.sin(tAcum * 18 + k) * 0.3 : 0));
        cuervos.setMatrixAt(nc++, _m.compose(_v, _q, _s));
      }
    }
    _s.set(1, 1, 1); cuervos.count = nc; cuervos.instanceMatrix.needsUpdate = true;
    for (const [id, p] of perros) if (!vivos.has(id)) { p.visible = false; if (!S.anim.some((a) => a.id === id)) { mundo.remove(p); perros.delete(id); } }
    // alarmas que chillan: luces naranja intermitentes
    let na = 0; const on = Math.sin(tAcum * 12) > 0;
    for (const a of Object.values(S.alarmas)) if (S.t - a.t < 30 && on && na < 12 && dentroVentana(a.x, a.z)) { for (const s2 of [-1, 1]) if (na < 12) { _v.set(a.x + s2 * 0.7, 0.75, a.z); alarmas.setMatrixAt(na++, _m.compose(_v, _q.identity(), _s)); } }
    alarmas.count = na; alarmas.instanceMatrix.needsUpdate = true;
    // lluvia: gotas que caen alrededor del protagonista (se recortan con el círculo)
    const ll = S.clima?.lluvia || 0, n = Math.round(N_LL * Math.min(1, ll * 1.2)); lluvia.count = n;
    if (n) { for (let i = 0; i < n; i++) { const g = gotas[i]; g[1] -= dt * 22; if (g[1] < 0) g[1] += 30; _v.set(ancla.x + g[0], g[1], ancla.z + g[2]); lluvia.setMatrixAt(i, _m.compose(_v, _q.set(0.08, 0, 0, 1).normalize(), _s)); } lluvia.instanceMatrix.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- estado de la ventana
  const ancla = { x: 0, z: 0 }; let ultRuido = -1, tAcum = 0, primera = true;
  function reiniciar(S) {
    sem = S.sem; ancla.x = S.pj.x; ancla.z = S.pj.z; primera = true; ultRuido = S.t;
    for (const [, m] of activas) { mundo.remove(m.b, m.f, m.l); piscina.push(m); } activas.clear();
    for (const [, g] of geos) { g.b.dispose(); g.f?.dispose(); g.l?.dispose(); } geos.clear();
    for (const [, p] of humanos) mundo.remove(p.g); humanos.clear();
    for (const [, p] of zUsa) { p.g.visible = false; zPool[p.tipo].push(p); } zUsa.clear();
    for (const [, p] of perros) mundo.remove(p); perros.clear();
    crearPj(S); heli.visible = false;
  }
  const dentroVentana = (x, z, m = 0.6) => Math.hypot(x - ancla.x, z - ancla.z) < R - m;
  // sobre la acera o la manzana se pisa 18 cm más arriba que en la calle
  const altura = (x, z) => { const lx = x - Math.floor(x / P) * P, lz = z - Math.floor(z / P) * P; return lx > 4 && lx < P - 4 && lz > 4 && lz < P - 4 ? 0.18 : 0; };
  function animar(p, x, z, dir, modo, dt, vel) { p.g.position.set(x, altura(x, z), z); p.g.rotation.y = dir; animarPersona(p, modo, dt, vel); }

  function actualizar(dt, S) {
    if (S.sem !== sem) reiniciar(S);
    tAcum += dt;
    const P0 = S.pj, k = Math.min(1, dt * 3.5);
    // el ancla persigue al protagonista con suavidad (si saltó lejos, de una)
    if (Math.hypot(P0.x - ancla.x, P0.z - ancla.z) > 25) { ancla.x = P0.x; ancla.z = P0.z; } else { ancla.x += (P0.x - ancla.x) * k; ancla.z += (P0.z - ancla.z) * k; }
    mundo.position.set(-ancla.x, 0, -ancla.z);
    celdasVisibles(ancla.x, ancla.z, primera); primera = false;
    if (SOMBRA_R < 99) for (const [, m] of activas) m.b.castShadow = Math.hypot(m.b.position.x + P / 2 - ancla.x, m.b.position.z + P / 2 - ancla.z) < SOMBRA_R + P * 0.7;
    // noche: ventanas encendidas, linterna y fuego
    const h = horaDe(S), nn = esNoche(h) ? 1 : h > 18.5 ? (h - 18.5) / 2 : h < 7 ? (7 - h) / 1.5 : 0; noche += (Math.min(1, nn) - noche) * Math.min(1, dt * 2);
    MAT_L.visible = noche > 0.35; const fl = 0.82 + 0.18 * Math.sin(tAcum * 17) * Math.sin(tAcum * 7.3); MAT_F.color.setScalar(fl);
    linterna.position.set(P0.x, 2.4, P0.z); linterna.intensity = noche * 22 * (P0.dentro ? 0 : 1);
    let fx = null, fd = 1e9; for (const [, m] of activas) for (const [x, z] of m.g.fuegos) { const d = Math.hypot(x - ancla.x, z - ancla.z); if (d < fd && d < R) { fd = d; fx = [x, z]; } }
    if (fx) { fogata.position.set(fx[0], 2, fx[1]); fogata.intensity = (8 + noche * 30) * fl; } else fogata.intensity = 0;
    // protagonista
    if (!pj) crearPj(S);
    const ar = S.pj.armas[S.pj.eq]; for (const [id, m] of Object.entries(armasPj)) m.visible = !!ar && ar.id === id;
    const ac = P0.accion?.tipo, oculto = !!P0.dentro && ac !== 'barricar';
    pj.g.visible = !oculto || !!S.fin;
    const modoPj = S.fin ? (S.fin.tipo === 'escape' ? 'baila' : 'muerto') : P0.golpeT > 0 ? 'golpe' : ac === 'barricar' ? 'trabaja' : P0.vel > 2.5 ? 'corre' : P0.vel > 0.05 ? 'camina' : 'quieto';
    if (!(S.fin?.tipo === 'escape' && S.fin)) animar(pj, P0.x, P0.z, P0.dir, modoPj, dt, P0.vel);
    if (S.fin?.tipo === 'escape') pj.g.visible = false;
    // zombis: los más cercanos dentro de la ventana, cada uno con una persona de su tipo (piscina)
    const vis = []; for (const z of S.zs) if (dentroVentana(z.x, z.z)) vis.push(z);
    if (vis.length > MAX_Z) { vis.sort((a, b) => Math.hypot(a.x - ancla.x, a.z - ancla.z) - Math.hypot(b.x - ancla.x, b.z - ancla.z)); vis.length = MAX_Z; }
    const ids = new Set(vis.map((z) => z.id));
    for (const [id, p] of zUsa) if (!ids.has(id)) { p.g.visible = false; zPool[p.tipo].push(p); zUsa.delete(id); }
    for (const z of vis) {
      let p = zUsa.get(z.id); if (!p) { p = zPool[z.tipo].pop() || zombiNuevo(z.tipo); p.g.visible = true; p.g.userData.id = 'z:' + z.id; zUsa.set(z.id, p); }
      animar(p, z.x, z.z, z.dir, z.est === 'muerto' ? 'muerto' : z.golpeT > 0 ? 'golpe' : 'zombi', dt * (z.est === 'muerto' ? 0 : 1), Math.max(0.3, z.vel));
      if (z.est !== 'muerto' && z.golpeT > 0) { p.brazos[0].rotation.x = -1.5; } // muerde con los brazos al frente
    }
    // humanos: compañeros y otros sobrevivientes
    const vivosH = new Set();
    for (const hmn of [...S.grupo, ...S.npcs]) {
      if (!dentroVentana(hmn.x, hmn.z)) continue; const p = humano(hmn); vivosH.add(hmn.id); p.g.visible = true;
      const muerto = hmn.est === 'muerto', oc = S.grupo.includes(hmn) && P0.dentro && ac === 'duerme';
      animar(p, hmn.x, hmn.z, hmn.dir, muerto ? 'muerto' : hmn.golpeT > 0 ? 'golpe' : oc ? 'sentado' : hmn.vel > 2.2 ? 'corre' : hmn.vel > 0.05 ? 'camina' : hmn.est === 'habla' ? 'trabaja' : 'quieto', dt * (muerto ? 0 : 1), hmn.vel);
    }
    for (const [id, p] of humanos) if (!vivosH.has(id)) { p.g.visible = false; if (![...S.grupo, ...S.npcs].some((h) => h.id === id)) { mundo.remove(p.g); humanos.delete(id); } }
    // marcas de botín (rombos sobre las puertas sin revisar) y tablas en los refugios
    let n = 0, nt = 0;
    for (const { e } of edificiosCerca(sem, ancla.x, ancla.z, R - 1)) {
      if (!S.saq[e.k] && n < 90) { _v.set(e.px, 2.6 + Math.sin(tAcum * 2 + e.px) * 0.15, e.pz); _q.setFromEuler(_e.set(0, tAcum, 0)); marcas.setMatrixAt(n, _m.compose(_v, _q, _s)); marcas.setColorAt(n, _c.set(COL_T[e.tipo] || 0xffffff)); n++; }
      if (S.ref[e.k] && nt < 58) for (const a of [0.5, -0.5]) { _v.set(e.px, 1.1, e.pz); _q.setFromEuler(_e.set(0, e.lado < 2 ? 0 : Math.PI / 2, a)); tablas.setMatrixAt(nt++, _m.compose(_v, _q, _s)); }
    }
    marcas.count = n; marcas.instanceMatrix.needsUpdate = true; if (marcas.instanceColor) marcas.instanceColor.needsUpdate = true;
    tablas.count = nt; tablas.instanceMatrix.needsUpdate = true;
    // anillos de ruido (disparos, carreras, golpes): muestran hasta dónde se oyó
    for (const r of S.ruidos) if (r.t > ultRuido && r.r >= 6) { ultRuido = r.t; const a = anillos.find((m) => !m.visible) || anillos[0]; a.visible = true; a.userData = { t: 0, r: r.r }; a.position.set(r.x, 0.3, r.z); }
    if (S.ruidos.length) ultRuido = Math.max(ultRuido, S.ruidos[S.ruidos.length - 1].t);
    for (const a of anillos) if (a.visible) { a.userData.t += dt; const t = a.userData.t / 0.9; if (t >= 1) { a.visible = false; continue; } a.scale.setScalar(Math.max(0.01, a.userData.r * t)); a.material.opacity = 0.55 * (1 - t); }
    // ruta planeada (en manual ayuda a ver por dónde va)
    const pl = P0.plan, arr = lineaGeo.attributes.position.array; let np = 0;
    if (pl && pl.ruta && !S.fin) { arr[0] = P0.x; arr[1] = 0.3; arr[2] = P0.z; np = 1; for (let i = pl.idx; i < pl.ruta.length && np < 64; i++, np++) { arr[np * 3] = pl.ruta[i][0]; arr[np * 3 + 1] = 0.3; arr[np * 3 + 2] = pl.ruta[i][1]; } }
    lineaGeo.setDrawRange(0, np); lineaGeo.attributes.position.needsUpdate = true; linea.visible = np > 1 && !S.auto;
    meta.visible = linea.visible; if (meta.visible) { meta.position.set(arr[(np - 1) * 3], 0.3, arr[(np - 1) * 3 + 2]); meta.scale.setScalar(1 + Math.sin(tAcum * 5) * 0.15); }
    // humo verde de la zona y el helicóptero
    const ox = S.obj.x, oz = S.obj.z, cerca = S.revelada && Math.hypot(ox - ancla.x, oz - ancla.z) < R + 30;
    humo.count = cerca ? 12 : 0;
    if (cerca) for (let i = 0; i < 12; i++) { const t = (tAcum * 0.12 + i / 12) % 1; _v.set(ox + 6.5 + Math.sin(i * 2.1 + tAcum * 0.3) * t * 2, 0.5 + t * 22, oz + 6.5 + Math.cos(i * 1.7) * t * 2); _s.setScalar(0.6 + t * 2.6); humo.setMatrixAt(i, _m.compose(_v, _q.identity(), _s)); }
    _s.set(1, 1, 1); humo.instanceMatrix.needsUpdate = true;
    if (S.evac || S.fin?.tipo === 'escape') {
      heli.visible = true; const ev = S.evac || { resta: 0, total: 90 }, baja = Math.max(0, ev.resta / ev.total);
      heli.userData.sube = S.fin?.tipo === 'escape' ? (heli.userData.sube || 0) + dt : 0;
      heli.position.set(ox, 3 + baja * 34 + heli.userData.sube * heli.userData.sube * 1.5, oz - 1); heli.rotation.y = tAcum * 0.05; heli.userData.rotor.rotation.y += dt * 25;
    } else heli.visible = false;
    vidaAmbiental(dt, S);
  }
  // lo que se puede tocar (zombis y humanos) para O.tocar
  function tocables() { const l = []; for (const [, p] of zUsa) if (p.g.visible) l.push(p.g); for (const [, p] of humanos) if (p.g.visible) l.push(p.g); return l; }
  // posición de pantalla de un punto del mundo (para etiquetas)
  const _p = new THREE.Vector3();
  function pantalla(x, y, z) { return O.proyectar(_p.set(x - ancla.x, y, z - ancla.z)); }
  return { actualizar, reiniciar, tocables, pantalla, ancla, get celdas() { return activas.size; }, aEscena: (x, z, y = 1) => _p.set(x - ancla.x, y, z - ancla.z) };
}
