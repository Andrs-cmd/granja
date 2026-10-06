// Construcciones por tipo de lugar. Cada constructor recibe el lugar de la ficha y devuelve:
//   { grupo, puntos: { nombreDelPunto: [{ x, y, z, ry, pose }] }, ventanas: [materiales que se encienden de noche], techos: [mallas que se aclaran al mirar de cerca] }
// pose: 'pie' | 'sentado' | 'acostado' | 'trabajo' (de pie haciendo algo) | 'barra' (de pie frente a un mostrador)
// Medidas en metros (una persona mide ~1,8).
import * as THREE from 'three';

const cache = new Map();
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o })); return cache.get(k); };
function caja(g, w, h, d, m, x, y, z, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; }
function cil(g, r, h, m, x, y, z, seg = 12) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; }
const vidrio = () => new THREE.MeshStandardMaterial({ color: 0xa8cde0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const luzVentana = () => new THREE.MeshStandardMaterial({ color: 0x2a3440, emissive: 0xffc27a, emissiveIntensity: 0, roughness: 0.3 });

// muebles reutilizables (en coordenadas locales del grupo g; mirando hacia +z)
function sofa(g, x, z, ry, color = 0x5a6f8f) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); caja(s, 2.0, 0.42, 0.85, mat(color), 0, 0.21, 0); caja(s, 2.0, 0.55, 0.2, mat(color), 0, 0.6, -0.33); for (const sx of [-1, 1]) caja(s, 0.18, 0.55, 0.85, mat(color), sx * 0.98, 0.32, 0); return s; }
function cama(g, x, z, ancho = 1.6, color = 0x7a9cc6) { caja(g, ancho, 0.42, 2.1, mat(0x9a6b42), x, 0.21, z); caja(g, ancho - 0.06, 0.12, 1.9, mat(color), x, 0.48, z + 0.08); caja(g, ancho, 0.9, 0.08, mat(0x8a5a32), x, 0.45, z - 1.05); for (const dx of ancho > 1.2 ? [-0.38, 0.38] : [0]) caja(g, 0.6, 0.12, 0.35, mat(0xf2efe8), x + dx, 0.58, z - 0.82); }
function mesa(g, x, z, sillas = 2, color = 0x9a6b42) { caja(g, 1.1, 0.05, 0.8, mat(color), x, 0.75, z); for (const [dx, dz] of [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]]) caja(g, 0.05, 0.75, 0.05, mat(color), x + dx, 0.375, z + dz); const pts = []; for (let i = 0; i < sillas; i++) { const sz = i % 2 ? 1 : -1, sx = sillas > 2 ? (i < 2 ? -0.3 : 0.3) : 0; caja(g, 0.42, 0.05, 0.42, mat(0x6b4a2b), x + sx, 0.46, z + sz * 0.62); caja(g, 0.42, 0.45, 0.04, mat(0x6b4a2b), x + sx, 0.7, z + sz * 0.82); pts.push({ x: x + sx, y: 0, z: z + sz * 0.62, ry: sz > 0 ? Math.PI : 0, pose: 'sentado', asiento: 0.48 }); } return pts; }
function planta(g, x, z, alto = 0.9) { cil(g, 0.18, 0.35, mat(0xb86a3a), x, 0.17, z, 10); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0x4f8f3a, { flatShading: true })); c.position.set(x, 0.35 + alto * 0.4, z); c.scale.y = alto * 1.3; c.castShadow = true; g.add(c); }
function arbol(g, x, z, s = 1) { cil(g, 0.15 * s, 2.4 * s, mat(0x6b5644), x, 1.2 * s, z, 6); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.0 + (i % 2) * 0.3) * s, 0), mat([0x4d7a2b, 0x5f8f34, 0x6f9a44][i % 3], { flatShading: true })); c.position.set(x + Math.cos(i * 1.7) * 0.6 * s, (2.8 + (i % 2) * 0.6) * s, z + Math.sin(i * 1.7) * 0.6 * s); c.castShadow = true; g.add(c); } }
function farol(g, x, z, luces) { cil(g, 0.07, 4.2, mat(0x2b2d31, { metalness: 0.6 }), x, 2.1, z, 8); const lm = new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffc677, emissiveIntensity: 0 }); const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lm); l.position.set(x, 4.25, z); g.add(l); luces.push(lm); }

// ---------------------------------------------------------------- la calle en anillo, aceras, cruces y faroles
export function construirCalle(F) {
  const g = new THREE.Group(), luces = [];
  const A = F.acera, x0 = Math.min(...A.map((p) => p.x)), x1 = Math.max(...A.map((p) => p.x)), z0 = Math.min(...A.map((p) => p.z)), z1 = Math.max(...A.map((p) => p.z));
  const asfalto = mat(0x3a3d42, { roughness: 0.95 }), linea = mat(0xf2e9c8), anden = mat(0xbdb6a8, { roughness: 1 });
  const ancho = 5, m = 1.3;   // calzada y anden
  // calzada (cuatro tramos) y anden exterior e interior
  const tramo = (cx, cz, w, d, mm) => { const o = caja(g, w, 0.06, d, mm, cx, 0.03, cz); o.castShadow = false; return o; };
  const ix0 = x0 + m + ancho, ix1 = x1 - m - ancho, iz0 = z0 + m + ancho, iz1 = z1 - m - ancho;
  tramo((x0 + x1) / 2, z0 + m + ancho / 2, x1 - x0 - 2 * m, ancho, asfalto); tramo((x0 + x1) / 2, z1 - m - ancho / 2, x1 - x0 - 2 * m, ancho, asfalto);
  tramo(x0 + m + ancho / 2, (z0 + z1) / 2, ancho, z1 - z0 - 2 * m - 2 * ancho, asfalto); tramo(x1 - m - ancho / 2, (z0 + z1) / 2, ancho, z1 - z0 - 2 * m - 2 * ancho, asfalto);
  for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0 + m / 2, x1 - x0 + 2 * m, m * 2], [(x0 + x1) / 2, z1 - m / 2, x1 - x0 + 2 * m, m * 2], [x0 + m / 2, (z0 + z1) / 2, m * 2, z1 - z0], [x1 - m / 2, (z0 + z1) / 2, m * 2, z1 - z0]]) { const o = caja(g, w, 0.16, d, anden, cx, 0.08, cz); o.castShadow = false; }
  // líneas del centro (discontinuas) y cebras
  const lineaH = (z, a, b) => { for (let x = a; x < b; x += 3) { const o = caja(g, 1.6, 0.02, 0.14, linea, x + 0.8, 0.07, z); o.castShadow = false; } };
  const lineaV = (x, a, b) => { for (let z = a; z < b; z += 3) { const o = caja(g, 0.14, 0.02, 1.6, linea, x, 0.07, z + 0.8); o.castShadow = false; } };
  lineaH(z0 + m + ancho / 2, x0 + 3, x1 - 3); lineaH(z1 - m - ancho / 2, x0 + 3, x1 - 3); lineaV(x0 + m + ancho / 2, iz0, iz1); lineaV(x1 - m - ancho / 2, iz0, iz1);
  for (const [cx, cz, vertical] of [[0, z1 - m - ancho / 2, true], [0, z0 + m + ancho / 2, true], [x0 + m + ancho / 2, 0, false], [x1 - m - ancho / 2, 0, false]]) for (let k = -2; k <= 2; k++) { const o = vertical ? caja(g, 0.5, 0.02, ancho - 0.6, linea, cx + k * 0.9, 0.075, cz) : caja(g, ancho - 0.6, 0.02, 0.5, linea, cx, 0.075, cz + k * 0.9); o.castShadow = false; }
  for (let x = x0 + 4; x <= x1 - 4; x += 10) for (const z of [z0 - 0.4, z1 + 0.4]) farol(g, x, z, luces);
  for (let z = z0 + 8; z <= z1 - 8; z += 10) for (const x of [x0 - 0.4, x1 + 0.4]) farol(g, x, z, luces);
  return { grupo: g, luces, carriles: { x0: x0 + m + ancho * 0.25, x1: x1 - m - ancho * 0.25, z0: z0 + m + ancho * 0.25, z1: z1 - m - ancho * 0.25, x0b: x0 + m + ancho * 0.75, x1b: x1 - m - ancho * 0.75, z0b: z0 + m + ancho * 0.75, z1b: z1 - m - ancho * 0.75 } };
}

// ---------------------------------------------------------------- edificio de apartamentos (fachada de vidrio: se ve la vida adentro)
export function construirTorre(L, F) {
  const g = new THREE.Group(), puntos = {}, ventanas = [], techos = [];
  const W = L.tam.w, D = L.tam.d, PB = 3.6, HP = 3.2, N = L.tam.pisos;
  g.position.set(L.pos.x, 0, L.pos.z);
  const muro = mat(0xe9e2d4), losa = mat(0xcfc6b6), oscuro = mat(0x3a3e44), madera = mat(0x9a6b42);
  const fz = D / 2;   // la fachada mira a +z
  // planta baja: lobby con puerta de vidrio y escritorio del portero
  caja(g, W, 0.3, D, losa, 0, 0.15, 0);
  caja(g, W, PB, 0.25, muro, 0, PB / 2, -fz + 0.12);
  for (const sx of [-1, 1]) caja(g, 0.25, PB + N * HP, D, muro, sx * (W / 2 - 0.12), (PB + N * HP) / 2, 0);
  for (const sx of [-1, 1]) caja(g, W / 2 - 2, PB, 0.2, muro, sx * (W / 4 + 1), PB / 2, fz - 0.1);
  { const p = caja(g, 4, PB - 0.6, 0.06, vidrio(), 0, (PB - 0.6) / 2 + 0.3, fz - 0.05); p.castShadow = false; }
  caja(g, 4.4, 0.4, 0.3, oscuro, 0, PB - 0.2, fz);
  caja(g, 1.8, 1.0, 0.7, madera, -3, 0.5, -1.2);   // escritorio del portero
  puntos.porteria = [{ x: -3, y: 0.3, z: -2.0, ry: 0, pose: 'sentado', asiento: 0.48 }];
  puntos.lobby = [{ x: 1.5, y: 0.3, z: 0.5, ry: 0, pose: 'pie' }, { x: 3, y: 0.3, z: 1.2, ry: -0.6, pose: 'pie' }];
  caja(g, 2.2, PB + N * HP, 2.2, mat(0xb8b0a2), 5.6, (PB + N * HP) / 2, -fz + 1.4);   // ascensor y escalera
  // pisos con dos apartamentos (A a la izquierda, B a la derecha)
  for (let p = 1; p <= N; p++) {
    const y = PB + (p - 1) * HP;
    { const sl = caja(g, W, 0.25, D + 1.4, losa, 0, y, 0.7); }
    caja(g, W, HP, 0.25, muro, 0, y + HP / 2, -fz + 0.12);
    caja(g, 0.2, HP, D, muro, 0, y + HP / 2, 0);   // muro entre A y B
    for (const u of ['A', 'B']) {
      const sx = u === 'A' ? -1 : 1, ux = sx * W / 4, k = (x) => ux + sx * x, ry = 0;   // k: espejo para el B
      const yy = y + 0.13;
      const gU = new THREE.Group(); gU.position.y = yy; g.add(gU);
      // fachada de vidrio con marcos y balcón
      { const v = caja(g, W / 2 - 0.4, HP - 0.35, 0.05, vidrio(), ux, y + HP / 2, fz - 0.05); v.castShadow = false; }
      for (const dx of [-W / 4 + 0.2, 0, W / 4 - 0.2]) caja(g, 0.08, HP - 0.3, 0.1, oscuro, ux + dx, y + HP / 2, fz);
      caja(g, W / 2 - 0.4, 0.08, 0.1, oscuro, ux, y + HP - 0.2, fz);
      { const b = caja(g, W / 2 - 0.6, 0.9, 0.05, vidrio(), ux, y + 0.6, fz + 1.35); b.castShadow = false; }
      caja(g, W / 2 - 0.6, 0.05, 0.06, oscuro, ux, y + 1.06, fz + 1.35);
      const lv = luzVentana(); const tira = caja(g, W / 2 - 0.6, 0.06, 0.06, lv, ux, y + HP - 0.32, fz - 0.15); tira.castShadow = false; ventanas.push({ mat: lv, lugar: `apto${p}${u}` });
      // muebles (vista desde la fachada: los de atrás se ven de frente)
      cama(gU, k(2.2), -fz + 1.4, 1.6, u === 'A' ? 0x7a9cc6 : 0xc8a0b8);
      sofa(gU, k(-1.2), -0.6, 0);
      { const tv = caja(gU, 0.06, 0.7, 1.2, mat(0x1a1a20, { emissive: 0x3a5a8a, emissiveIntensity: 0.25 }), k(-W / 4 + 0.15), 1.35, 0.5); tv.rotation.y = sx * 0.5; }   // televisor en la pared del costado (no tapa a los del sofá)
      caja(gU, 0.65, 0.92, 2.6, mat(0xf2efe8), k(-W / 4 + 0.55), 0.46, -fz + 2.2);   // cocina contra el muro
      const sillas = mesa(gU, k(1.6), 1.3, 2);
      caja(gU, 1.3, 2.2, 1.3, mat(0xe8e2d6), k(-W / 4 + 0.9), 1.1, -fz + 0.9);   // baño
      planta(gU, k(W / 4 - 0.6), fz + 0.9); planta(gU, k(W / 4 - 1.3), fz + 1.0, 0.6);
      const P = (x, z, r, pose, extra = {}) => ({ x: ux + sx * x, y: yy, z, ry: r, pose, ...extra });
      const id = `apto${p}${u}`;
      puntos[id] = {
        cama: [P(1.82, -fz + 1.45, 0, 'acostado', { cabecera: -fz + 0.55, colchon: yy + 0.55 }), P(2.58, -fz + 1.45, 0, 'acostado', { cabecera: -fz + 0.55, colchon: yy + 0.55 })],
        sofa: [P(-1.6, -0.55, 0, 'sentado', { asiento: 0.44 }), P(-0.8, -0.55, 0, 'sentado', { asiento: 0.44 })],
        cocina: [P(-W / 4 + 1.25, -fz + 2.2, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 'trabajo')],
        mesa: sillas.map((q) => ({ ...q, y: yy })),
        bano: [P(-W / 4 + 0.9, -fz + 1.9, Math.PI, 'pie')],
        balcon: [P(1.0, fz + 0.75, Math.PI, 'trabajo'), P(-0.3, fz + 0.75, Math.PI, 'pie')],
        suelo: [P(0.4, 0.4, 0, 'pie'), P(-0.6, 1.0, 0, 'pie')],
        mascota: [P(0.6, 0.2, 0, 'mascota'), P(-2.1, -1.2, 0, 'mascota')],
      };
    }
  }
  const techo = caja(g, W + 0.2, 0.4, D + 0.2, mat(0x6b6560), 0, PB + N * HP + 0.2, 0); techos.push(techo);
  caja(g, 3, 1.2, 2, mat(0x8a8a8a), -4, PB + N * HP + 1, -1.5);   // máquinas en la azotea
  // los puntos se armaron en coordenadas del edificio: se pasan al mundo
  const aMundo = (q) => { q.x += L.pos.x; q.z += L.pos.z; if (q.cabecera != null) q.cabecera += L.pos.z; };
  for (const v of Object.values(puntos)) { if (Array.isArray(v)) v.forEach(aMundo); else for (const l of Object.values(v)) l.forEach(aMundo); }
  return { grupo: g, puntos, ventanas, techos };
}

// ---------------------------------------------------------------- locales con vitrina (café, bar, taller, super, gimnasio, oficina, clínica)
const LOCAL = {
  cafe: { pared: 0xd8b48a, toldo: 0x2f6a4a, letrero: '☕' }, bar: { pared: 0x5a3a2a, toldo: 0x8a2a2a, letrero: '🍷' }, taller: { pared: 0xe7d6e6, toldo: 0x8a4a8a, letrero: '🧵' },
  super: { pared: 0xe8e8e0, toldo: 0xd83a2a, letrero: '🛒' }, gym: { pared: 0x3a3e46, toldo: 0xe2a13a, letrero: '🏋' }, oficina: { pared: 0x8aa0b4, toldo: 0x2a3a5a, letrero: '🏢' }, clinica: { pared: 0xf2f2f2, toldo: 0x3a8ac8, letrero: '➕' },
};
export function construirLocal(L) {
  const g = new THREE.Group(), puntos = {}, ventanas = [], techos = [], C = LOCAL[L.tipo] || LOCAL.cafe;
  const W = L.tam.w, D = L.tam.d, Hh = L.tam.h || 4.5, fz = D / 2;
  g.position.set(L.pos.x, 0, L.pos.z); g.rotation.y = L.rot || 0;
  const pared = mat(C.pared);
  caja(g, W, 0.04, D, mat(0xd8d2c4), 0, 0.02, 0);
  caja(g, W, Hh, 0.25, pared, 0, Hh / 2, -fz + 0.12);
  for (const sx of [-1, 1]) caja(g, 0.25, Hh, D, pared, sx * (W / 2 - 0.12), Hh / 2, 0);
  { const v = caja(g, W - 0.5, Hh - 1.1, 0.06, vidrio(), 0, (Hh - 1.1) / 2 + 0.2, fz - 0.05); v.castShadow = false; }
  caja(g, W, 0.8, 0.25, pared, 0, Hh - 0.4, fz - 0.12);
  const toldo = caja(g, W + 0.2, 0.08, 1.4, mat(C.toldo), 0, Hh - 1.0, fz + 0.6); toldo.rotation.x = 0.25;
  const lv = luzVentana(); const tira = caja(g, W - 0.8, 0.08, 0.08, lv, 0, Hh - 0.15, fz - 0.3); ventanas.push({ mat: lv, lugar: L.id, siempre: true });
  const techo = caja(g, W + 0.3, 0.3, D + 0.3, mat(0x5a5650), 0, Hh + 0.15, 0); techos.push(techo);
  // letrero con ícono (lienzo)
  { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x2 = cv.getContext('2d'); x2.fillStyle = '#1b1a17'; x2.fillRect(0, 0, 256, 64); x2.font = 'bold 34px system-ui, sans-serif'; x2.fillStyle = '#f2e9c8'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(`${C.letrero} ${L.nombre.replace(/^(el|la) /, '').slice(0, 18)}`, 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W - 1, 6), 1.4), new THREE.MeshBasicMaterial({ map: t })); m.position.set(0, Hh - 0.4, fz + 0.01); g.add(m); }
  const P = (x, z, ry, pose, extra = {}) => { const v = new THREE.Vector3(x, 0.02, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), L.rot || 0); return { x: L.pos.x + v.x, y: 0.02, z: L.pos.z + v.z, ry: ry + (L.rot || 0), pose, ...extra }; };
  const local = (pts) => pts.map((q) => P(q.x, q.z, q.ry, q.pose, q.asiento != null ? { asiento: q.asiento } : {}));
  if (L.tipo === 'cafe' || L.tipo === 'bar') {
    caja(g, W - 2, 1.05, 0.7, mat(0x6b4a2b), 0, 0.52, -fz + 1.4);   // barra
    if (L.tipo === 'bar') for (let i = 0; i < 6; i++) cil(g, 0.08, 0.3, mat([0x7a1a2a, 0x2a6a3a, 0xc8a04a][i % 3]), -2 + i * 0.8, 1.2, -fz + 1.4, 8);
    const sillas = [...mesa(g, -W / 4, 0.8, 2), ...mesa(g, W / 4, 0.8, 2), ...mesa(g, 0, fz - 1.4, 2)];
    puntos.mesa = local(sillas); puntos.trabajo = local([{ x: -1, z: -fz + 0.7, ry: 0, pose: 'trabajo' }, { x: 1.2, z: -fz + 0.7, ry: 0, pose: 'trabajo' }]);
    puntos.barra = local([{ x: -0.6, z: -fz + 2.1, ry: Math.PI, pose: 'pie' }, { x: 0.8, z: -fz + 2.1, ry: Math.PI, pose: 'pie' }]);
  } else if (L.tipo === 'gym') {
    for (const x of [-W / 3, 0, W / 3]) { caja(g, 0.7, 0.12, 1.9, mat(0x2b2d31), x, 0.45, -1.5); cil(g, 0.03, 1.6, mat(0xb9bec4, { metalness: 0.7 }), x, 1.15, -1.5, 8).rotation.z = Math.PI / 2; }
    caja(g, W - 1, 0.04, 3.2, mat(0x2a6a3a), 0, 0.22, 1.6);   // tapete
    puntos.trabajo = local([{ x: -1.5, z: 0.8, ry: 0.4, pose: 'pie' }, { x: 1.8, z: 1.2, ry: -0.4, pose: 'pie' }]);
    puntos.entrenar = local([{ x: -2.5, z: 1.8, ry: 0, pose: 'entrenar' }, { x: 0, z: 2.0, ry: 0, pose: 'entrenar' }, { x: 2.5, z: 1.8, ry: 0, pose: 'entrenar' }]);
  } else if (L.tipo === 'taller' || L.tipo === 'oficina') {
    const pts = [];
    for (const [x, z] of [[-W / 4, -0.8], [W / 4, -0.8], [-W / 4, 1.6], [W / 4, 1.6]]) { caja(g, 1.5, 0.05, 0.8, mat(L.tipo === 'taller' ? 0xc8a07a : 0xe8e8e8), x, 0.78, z); caja(g, 1.4, 0.75, 0.05, mat(0x8a8a8a), x, 0.4, z - 0.35); if (L.tipo === 'taller') caja(g, 0.4, 0.3, 0.25, mat(0x2b2d31), x, 0.95, z); else caja(g, 0.6, 0.4, 0.04, mat(0x1a1a20, { emissive: 0x3a5a8a, emissiveIntensity: 0.4 }), x, 1.05, z - 0.2); pts.push({ x, z: z + 0.6, ry: Math.PI, pose: 'sentado', asiento: 0.48 }); }
    if (L.tipo === 'taller') for (let i = 0; i < 3; i++) caja(g, 0.4, 1.6, 0.4, mat([0xc8553d, 0x3a6ab8, 0xe2c04a][i]), -W / 2 + 1 + i * 0.7, 0.8, -fz + 0.8);   // maniquíes
    puntos.trabajo = local(pts); puntos.mesa = local(pts);
  } else if (L.tipo === 'super') {
    for (const x of [-W / 3, 0, W / 3]) { caja(g, 0.9, 1.6, D - 4, mat(0xd8d2c4), x, 0.8, -0.5); for (let i = 0; i < 5; i++) caja(g, 0.95, 0.06, D - 4.2, mat([0xd83a2a, 0x3a8a3a, 0xe2c04a, 0x3a6ab8][i % 4]), x, 0.3 + i * 0.32, -0.5); }
    caja(g, 2, 1, 0.7, mat(0x6b6560), W / 2 - 1.6, 0.5, fz - 1.4);   // caja registradora
    puntos.trabajo = local([{ x: W / 2 - 1.6, z: fz - 2.0, ry: 0, pose: 'trabajo' }]);
    puntos.pasillo = local([{ x: -W / 6, z: -1, ry: Math.PI / 2, pose: 'trabajo' }, { x: W / 6, z: 0.5, ry: -Math.PI / 2, pose: 'trabajo' }, { x: -W / 6, z: 1.6, ry: Math.PI / 2, pose: 'trabajo' }]);
  } else if (L.tipo === 'clinica') {
    caja(g, 2.2, 0.6, 0.9, mat(0xf2f2f2), -W / 4, 0.5, -1); caja(g, 1.6, 1.0, 0.6, mat(0xd8e8f2), W / 4, 0.5, -fz + 1);
    puntos.trabajo = local([{ x: W / 4, z: -fz + 1.7, ry: Math.PI, pose: 'trabajo' }, { x: -W / 4 + 1.4, z: -1, ry: -Math.PI / 2, pose: 'pie' }]);
  }
  puntos.adentro = local([{ x: -1, z: 1.5, ry: 0, pose: 'pie' }, { x: 1, z: 1, ry: 0, pose: 'pie' }]);
  return { grupo: g, puntos, ventanas, techos };
}

// ---------------------------------------------------------------- parque central: pasto, senderos, árboles, bancas, fuente y juegos
export function construirParque(L) {
  const g = new THREE.Group(), puntos = {};
  g.position.set(L.pos.x, 0, L.pos.z);
  const W = L.tam.w, D = L.tam.d;
  { const p = caja(g, W, 0.1, D, mat(0x6f9a44, { roughness: 1 }), 0, 0.05, 0); p.castShadow = false; }
  const sendero = mat(0xd8cdb5, { roughness: 1 });
  const anillo = new THREE.Mesh(new THREE.RingGeometry(5.2, 6.4, 48), sendero); anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.11; anillo.receiveShadow = true; g.add(anillo);
  for (const [w, d, x, z] of [[1.2, D / 2 - 6, 0, D / 4 + 3], [1.2, D / 2 - 6, 0, -D / 4 - 3]]) { const o = caja(g, w, 0.02, d, sendero, x, 0.11, z); o.castShadow = false; }
  cil(g, 1.6, 0.5, mat(0xbdb6a8), 0, 0.25, 0, 24); cil(g, 1.4, 0.05, mat(0x5aa0c8, { roughness: 0.1 }), 0, 0.5, 0, 24); cil(g, 0.2, 1.2, mat(0xbdb6a8), 0, 0.8, 0, 10);
  for (const [x, z, s] of [[-9, -6, 1], [9, -6, 1.1], [-10, 5, 0.9], [10, 6, 1], [-4, -8, 0.8], [5, 8, 0.85]]) arbol(g, x, z, s);
  const bancas = [];
  for (const [x, z, ry] of [[-6.5, 2.5, Math.PI / 2], [6.5, -2.5, -Math.PI / 2], [-2.5, -7.3, 0], [2.5, 7.3, Math.PI]]) { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); caja(b, 1.8, 0.08, 0.5, mat(0x9a6b42), 0, 0.45, 0); caja(b, 1.8, 0.4, 0.06, mat(0x9a6b42), 0, 0.7, -0.24); for (const sx of [-0.8, 0.8]) caja(b, 0.06, 0.45, 0.45, mat(0x2b2d31), sx, 0.22, 0); for (const dx of [-0.4, 0.4]) bancas.push({ x: L.pos.x + x + Math.cos(ry) * dx, y: 0, z: L.pos.z + z - Math.sin(ry) * dx, ry, pose: 'sentado', asiento: 0.47 }); }
  // juegos para niños
  caja(g, 0.1, 2.2, 0.1, mat(0xc8553d), 7, 1.1, 3); caja(g, 0.1, 2.2, 0.1, mat(0xc8553d), 9, 1.1, 3); caja(g, 2.1, 0.1, 0.1, mat(0xc8553d), 8, 2.2, 3);
  puntos.banca = bancas;
  puntos.recorrido = [{ x: L.pos.x, z: L.pos.z, r: 5.8 }];   // los que pasean o trotan dan vueltas por el sendero
  puntos.adentro = [{ x: L.pos.x + 2, y: 0.1, z: L.pos.z + 7.5, ry: Math.PI, pose: 'pie' }];
  return { grupo: g, puntos, ventanas: [], techos: [] };
}
