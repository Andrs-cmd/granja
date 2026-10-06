// =====================================================================
// Banco de semillas — la huerta en el orbe: cuatro camas elevadas y cada planta generada según su forma,
// etapa, altura, hojas, flores, frutos (que cambian de color al madurar), tutor, chupones, plagas y salud.
// Cada planta es UNA malla fundida (se rehace solo cuando cambia algo visible).
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';
import { CULTIVOS, N_CAMAS, etapaDe } from './sim.js';

const ESC = 6;   // 1 metro = 6 unidades
export const POS_CAMAS = [[-10.5, -8], [10.5, -8], [-10.5, 12], [10.5, 12]];
const _c = new THREE.Color(), _c2 = new THREE.Color();
const mezcla = (a, b, k) => _c.set(a).lerp(_c2.set(b), Math.max(0, Math.min(1, k))).getHex();
const rnd = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// color de las hojas según la salud y lo que le falta (amarillo = falta nitrógeno / sed; café = hongo)
function verdeDe(p, base = 0x4f8f3a) {
  let c = base;
  if (p.salud < 70) c = mezcla(c, 0xc8b84a, (70 - p.salud) / 90);
  if (p.N < 20) c = mezcla(c, 0xd8d070, 0.35);
  if (p.hongo > 0.2) c = mezcla(c, 0x8a7a5a, p.hongo * 0.6);
  if (!p.viva) c = 0x7a5a3a;
  return c;
}
function colorFruto(c, f) { const [a, b] = c.colorFruto; return mezcla(a, b, Math.max(0, (f.m - 0.55) / 0.45)); }

// ---------------------------------------------------------------- generadores por forma (devuelven partes para fundirGeo)
function hojaPartes(P, x, y, z, ang, tam, col, inclina = 0.5) {
  const dx = Math.cos(ang), dz = Math.sin(ang);
  P.push([GEO.esfera, col, x + dx * tam * 0.55, y, z + dz * tam * 0.55, tam * 0.55, tam * 0.08, tam * 0.28, 0, -ang, inclina * (dx > 0 ? -1 : 1) * 0.3]);
}
function generar(p) {
  const c = CULTIVOS[p.cult], k = etapaDe(p), R = rnd(p.id * 7919 + 13), P = [], H = Math.max(0.05, p.altura) * ESC, verde = verdeDe(p), tallo = mezcla(0x5a7a3a, verde, 0.3);
  if (k === 'germ') {
    P.push([GEO.esfera, 0x5a3a24, 0, 0.05, 0, 0.35, 0.12, 0.35]);
    if (p.prog > 0.4) { const h = 0.4 + p.prog * 0.6; P.push([GEO.cil, 0x8ac85a, 0, h / 2, 0, 0.03, h, 0.03], [GEO.esfera, 0x8ac85a, -0.12, h, 0, 0.14, 0.04, 0.08], [GEO.esfera, 0x8ac85a, 0.12, h, 0, 0.14, 0.04, 0.08]); }
    return P;
  }
  const nH = Math.round(3 + p.bio * 16), f = c.forma;
  const frutos = (fn) => p.frutos.forEach((fr, i) => fn(fr, i, colorFruto(c, fr)));
  if (f === 'tallo' || f === 'arbusto') {
    const g = f === 'arbusto' ? 0.7 : 1;
    P.push([GEO.cil, tallo, 0, H / 2, 0, 0.07 + p.bio * 0.06, H, 0.07 + p.bio * 0.06]);
    for (let i = 0; i < nH; i++) { const y = H * (0.18 + 0.8 * i / nH), a = i * 2.4; hojaPartes(P, 0, y, 0, a, (0.7 + R() * 0.4) * (1.1 - i / nH * 0.4) * (0.6 + p.bio) * g, verde); }
    for (let i = 0; i < p.chupones; i++) { const y = H * (0.25 + 0.5 * R()), a = R() * 6.28; P.push([GEO.cil, tallo, Math.cos(a) * 0.25, y + 0.2, Math.sin(a) * 0.25, 0.03, 0.5, 0.03, Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6]); hojaPartes(P, Math.cos(a) * 0.4, y + 0.45, Math.sin(a) * 0.4, a, 0.35, verde); }
    for (let i = 0; i < Math.round(p.flores); i++) { const a = R() * 6.28, y = H * (0.5 + R() * 0.45); P.push([GEO.esfera, c.colorFlor, Math.cos(a) * 0.4, y, Math.sin(a) * 0.4, 0.09, 0.07, 0.09]); }
    frutos((fr, i, col) => { const a = i * 2.1 + R(), y = H * (0.3 + (i % 5) * 0.11), r = 0.18 + fr.t * 0.18; if (c.n === 'Pimentón') P.push([GEO.capsula, col, Math.cos(a) * 0.45, y - 0.15, Math.sin(a) * 0.45, r * 0.9, r * 1.4, r * 0.9]); else P.push([GEO.esfera, col, Math.cos(a) * 0.45, y - 0.1, Math.sin(a) * 0.45, r, r * 0.92, r]); });
  } else if (f === 'trepadora') {
    const sube = p.tutor;
    for (let i = 0; i < nH * 1.4; i++) {
      const u = i / (nH * 1.4), y = sube ? H * u : 0.15 + Math.sin(u * 6) * 0.05, x = sube ? Math.sin(u * 12) * 0.25 : Math.cos(u * 3) * H * u * 0.6, z = sube ? 0 : Math.sin(u * 3) * H * u * 0.6;
      P.push([GEO.esfera, tallo, x, y, z, 0.05, 0.05, 0.05]);
      if (i % 2 === 0) hojaPartes(P, x, y, z, i * 2.2, (0.45 + p.bio * 0.5), verde, 0.2);
    }
    for (let i = 0; i < Math.round(p.flores); i++) { const u = R(), y = sube ? H * (0.3 + u * 0.6) : 0.25; P.push([GEO.esfera, c.colorFlor, (R() - 0.5) * 0.9, y, (R() - 0.5) * (sube ? 0.3 : H), 0.1, 0.08, 0.1]); }
    frutos((fr, i, col) => { const y = sube ? H * (0.25 + (i % 6) * 0.11) : 0.12, x = (i % 2 ? 0.4 : -0.4), z = sube ? 0.15 : (i - 3) * 0.3, lar = c.n === 'Pepino' ? 0.25 + fr.t * 0.6 : c.n === 'Maracuyá' ? 0 : 0.18 + fr.t * 0.25;
      if (c.n === 'Maracuyá') P.push([GEO.esfera, col, x, y - 0.2, z, 0.22 * (0.5 + fr.t), 0.25 * (0.5 + fr.t), 0.22 * (0.5 + fr.t)]); else P.push([GEO.capsula, col, x, y - lar / 2, z, 0.07 + fr.t * 0.05, lar, 0.07 + fr.t * 0.05, 0, 0, sube ? 0 : Math.PI / 2]); });
  } else if (f === 'roseta') {
    const n = Math.round(5 + p.bio * 22), cebolla = c.n === 'Cebolla larga', fresa = c.n === 'Fresa', cil = c.n === 'Cilantro';
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, rr = 0.15 + (i / n) * (0.5 + p.bio * 1.1), y = 0.12 + (1 - i / n) * 0.35 * (0.4 + p.bio);
      if (cebolla) P.push([GEO.cil, mezcla(verde, 0x9ad87a, 0.3), Math.cos(a) * 0.15, (0.4 + p.bio * 1.6) / 2, Math.sin(a) * 0.15, 0.05, 0.4 + p.bio * 1.6 * (0.7 + R() * 0.3), 0.05, Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1]);
      else if (cil) { P.push([GEO.cil, tallo, Math.cos(a) * rr * 0.5, 0.25 + p.bio * 0.4, Math.sin(a) * rr * 0.5, 0.015, 0.5 + p.bio * 0.8, 0.015, Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4]); P.push([GEO.esfera, verde, Math.cos(a) * rr, 0.45 + p.bio * 0.7, Math.sin(a) * rr, 0.14, 0.04, 0.14]); }
      else hojaPartes(P, Math.cos(a) * rr * 0.4, y, Math.sin(a) * rr * 0.4, a, 0.35 + p.bio * 0.55 + (fresa ? 0 : (1 - i / n) * 0.2), i < n * 0.35 && !fresa ? mezcla(verde, 0xb8e08a, 0.4) : verde, 0.9);
    }
    if (p.espigada) P.push([GEO.cil, tallo, 0, 1, 0, 0.04, 2, 0.04], [GEO.esfera, c.colorFlor, 0, 2.05, 0, 0.18, 0.12, 0.18]);
    if (fresa) { for (let i = 0; i < Math.round(p.flores); i++) { const a = R() * 6.28; P.push([GEO.esfera, c.colorFlor, Math.cos(a) * 0.7, 0.35, Math.sin(a) * 0.7, 0.1, 0.06, 0.1]); }
      frutos((fr, i, col) => { const a = i * 1.7, r = 0.8 + (i % 3) * 0.15; P.push([GEO.cono, col, Math.cos(a) * r, 0.14, Math.sin(a) * r, 0.1 + fr.t * 0.07, 0.2 + fr.t * 0.1, 0.1 + fr.t * 0.07, Math.PI, 0, 0]); });
      for (let i = 0; i < p.chupones; i++) { const a = R() * 6.28; P.push([GEO.cil, tallo, Math.cos(a) * 1.1, 0.06, Math.sin(a) * 1.1, 0.02, 1.4, 0.02, Math.PI / 2, -a, 0], [GEO.esfera, verde, Math.cos(a) * 1.8, 0.1, Math.sin(a) * 1.8, 0.18, 0.06, 0.18]); } }
  } else if (f === 'graminea') {
    const quinua = c.n === 'Quinua';
    P.push([GEO.cil, mezcla(tallo, 0x9ab85a, 0.3), 0, H / 2, 0, 0.09, H, 0.09]);
    for (let i = 0; i < nH * 0.7; i++) { const y = H * (0.12 + 0.75 * i / (nH * 0.7)), a = i * Math.PI + R() * 0.4; P.push([GEO.esfera, verde, Math.cos(a) * 0.65, y + 0.1, Math.sin(a) * 0.65, quinua ? 0.35 : 0.85, 0.03, quinua ? 0.22 : 0.12, 0, -a, Math.cos(a) * 0.4]); }
    if (k === 'flor' || k === 'fruto' || k === 'cosecha') { if (quinua) P.push([GEO.esfera, p.frutos[0] ? colorFruto(c, p.frutos[0]) : c.colorFlor, 0, H + 0.4, 0, 0.35, 0.7, 0.35]); else P.push([GEO.cono, c.colorFlor, 0, H + 0.35, 0, 0.18, 0.7, 0.18]); }
    if (!quinua) frutos((fr, i, col) => { const a = i * 2.5 + 0.5, y = H * 0.55; P.push([GEO.capsula, mezcla(0x9ac25a, 0xb8a060, fr.m), Math.cos(a) * 0.28, y, Math.sin(a) * 0.28, 0.17, 0.45 * (0.6 + fr.t * 0.5), 0.17, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], [GEO.esfera, col, Math.cos(a) * 0.3, y + 0.05, Math.sin(a) * 0.3, 0.12, 0.3 * (0.6 + fr.t * 0.5), 0.12]); });
  } else if (f === 'raiz') {
    const papa = c.n === 'Papa', zan = c.n === 'Zanahoria';
    const nh = Math.round(4 + p.bio * (papa ? 18 : 12));
    for (let i = 0; i < nh; i++) { const a = i * 2.4, rr = 0.1 + R() * (papa ? 0.7 : 0.3), y = (papa ? H * (0.3 + R() * 0.7) : 0.25 + R() * (0.4 + p.bio * 1.4)); if (zan) P.push([GEO.cil, verde, Math.cos(a) * 0.1, y / 2, Math.sin(a) * 0.1, 0.015, y, 0.015, Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3], [GEO.esfera, verde, Math.cos(a) * 0.25, y, Math.sin(a) * 0.25, 0.18, 0.05, 0.12]); else hojaPartes(P, Math.cos(a) * rr, y, Math.sin(a) * rr, a, 0.35 + p.bio * 0.4, verde); }
    if (papa) P.push([GEO.cil, tallo, 0, H / 2, 0, 0.06, H, 0.06]);
    for (let i = 0; i < Math.round(p.flores); i++) P.push([GEO.esfera, c.colorFlor, (R() - 0.5) * 0.8, H + 0.1, (R() - 0.5) * 0.8, 0.09, 0.06, 0.09]);
    // el hombro de la raíz asoma; las papas se ven al cosechar
    if (zan || c.n === 'Rábano') frutos((fr, i, col) => P.push([GEO.cono, col, 0, 0.05, 0, 0.12 + fr.t * 0.1, 0.25, 0.12 + fr.t * 0.1, Math.PI, 0, 0]));
  } else if (f === 'arbol') {
    const T = Math.max(0.2, H * 0.45);
    P.push([GEO.cil, 0x6a4a30, 0, T / 2, 0, 0.1 + p.bio * 0.12, T, 0.1 + p.bio * 0.12]);
    const nC = 3 + Math.round(p.bio * 5);
    for (let i = 0; i < nC; i++) { const a = i * 2.4, r = (i ? 0.5 + p.bio * 0.6 : 0), y = T + (H - T) * (0.3 + R() * 0.5); P.push([GEO.esfera, mezcla(verde, 0x2f6a2a, 0.3), Math.cos(a) * r, y, Math.sin(a) * r, 0.5 + p.bio * 0.7, 0.45 + p.bio * 0.55, 0.5 + p.bio * 0.7]); }
    for (let i = 0; i < Math.round(p.flores); i++) { const a = R() * 6.28; P.push([GEO.esfera, c.colorFlor, Math.cos(a) * (0.6 + p.bio * 0.8), T + (H - T) * 0.6, Math.sin(a) * (0.6 + p.bio * 0.8), 0.08, 0.08, 0.08]); }
    frutos((fr, i, col) => { const a = i * 2.3, r = 0.7 + p.bio * 0.7, s = c.n === 'Café' ? 0.06 : 0.12 + fr.t * 0.1; P.push([GEO.esfera, col, Math.cos(a) * r, T + (H - T) * (0.2 + (i % 4) * 0.15), Math.sin(a) * r, s, s * (c.n === 'Aguacate' ? 1.4 : 1), s]); });
  } else if (f === 'platano') {
    const T = H * 0.65; P.push([GEO.cil, mezcla(tallo, 0x8a9a5a, 0.4), 0, T / 2, 0, 0.18 + p.bio * 0.08, T, 0.18 + p.bio * 0.08]);
    for (let i = 0; i < 4 + p.bio * 6; i++) { const a = i * 2.2; P.push([GEO.caja, i < 2 && p.salud < 80 ? mezcla(verde, 0x9a8a4a, 0.6) : verde, Math.cos(a) * 0.9, T + 0.3 + (i % 3) * 0.25, Math.sin(a) * 0.9, 2.2 * (0.5 + p.bio * 0.6), 0.03, 0.55, 0, -a, -0.35]); }
    if (p.frutos.length) { const fr = p.frutos[0], col = colorFruto(c, fr); for (let j = 0; j < 7; j++) P.push([GEO.capsula, col, 0.35, T - 0.3 - j * 0.18, 0, 0.14, 0.3, 0.14, 0, j, 0.6]); P.push([GEO.cono, c.colorFlor, 0.35, T - 1.7, 0, 0.12, 0.35, 0.12, Math.PI, 0, 0]); }
    for (let i = 0; i < p.chupones; i++) { const a = i * 2 + 1; P.push([GEO.cil, verde, Math.cos(a) * 0.7, 0.3, Math.sin(a) * 0.7, 0.07, 0.6, 0.07]); }
  } else if (f === 'rastrera') {
    for (let i = 0; i < nH * 1.5; i++) { const u = i / (nH * 1.5), a = u * 7, r = u * (1 + p.bio * 3.5); P.push([GEO.esfera, tallo, Math.cos(a) * r, 0.1, Math.sin(a) * r, 0.05, 0.05, 0.05]); if (i % 2 === 0) hojaPartes(P, Math.cos(a) * r, 0.3, Math.sin(a) * r, a + 1, 0.6 + p.bio * 0.5, verde, 0.1); }
    for (let i = 0; i < Math.round(p.flores); i++) { const a = R() * 6.28, r = R() * 2; P.push([GEO.cono, c.colorFlor, Math.cos(a) * r, 0.35, Math.sin(a) * r, 0.15, 0.25, 0.15, Math.PI, 0, 0]); }
    frutos((fr, i, col) => { const a = i * 2.4 + 1, r = 1 + i * 0.6, s = 0.25 + fr.t * 0.45; P.push([GEO.esfera, col, Math.cos(a) * r, s * 0.8, Math.sin(a) * r, s * 1.2, s * 0.85, s * 1.2]); });
  } else if (f === 'girasol') {
    P.push([GEO.cil, tallo, 0, H / 2, 0, 0.07, H, 0.07]);
    for (let i = 0; i < nH * 0.6; i++) hojaPartes(P, 0, H * (0.2 + 0.7 * i / (nH * 0.6)), 0, i * 2.4, 0.7 * (0.6 + p.bio), verde);
    if (k === 'flor' || k === 'fruto' || k === 'cosecha') { const s = 0.4 + p.bio * 0.35, cen = p.frutos[0] ? colorFruto(c, p.frutos[0]) : 0x6a4a2a; P.push([GEO.cil, cen, 0, H, 0.15, s, 0.12, s, Math.PI / 2 - 0.3, 0, 0]); for (let j = 0; j < 14; j++) { const a = (j / 14) * Math.PI * 2; P.push([GEO.esfera, k === 'cosecha' ? 0xc8a050 : c.colorFlor, Math.cos(a) * s * 1.35, H + Math.sin(a) * s * 1.35 * 0.95, 0.15 + Math.sin(a) * s * 0.4, 0.22, 0.12, 0.05, 0, 0, a]); } }
  }
  // plagas: puntitos en las hojas; hongo: manchas claras
  if (p.plaga) for (let i = 0; i < Math.round(p.plaga.nivel * 26); i++) P.push([GEO.esfera, p.plaga.tipo === 'mosca' ? 0xf8f8f8 : p.plaga.tipo === 'acaro' ? 0xc83a2a : 0x2a2a2a, (R() - 0.5) * 1.4, 0.3 + R() * Math.max(0.5, H), (R() - 0.5) * 1.4, 0.04, 0.04, 0.04]);
  if (p.hongo > 0.1) for (let i = 0; i < Math.round(p.hongo * 16); i++) P.push([GEO.esfera, 0xe8e2d0, (R() - 0.5) * 1.2, 0.3 + R() * Math.max(0.5, H * 0.8), (R() - 0.5) * 1.2, 0.08, 0.02, 0.08]);
  return P;
}
function tutorPartes(p, c) {
  const H = Math.max(1.5, CULTIVOS[p.cult].forma === 'trepadora' ? 2 * ESC * 0.95 : p.altura * ESC * 1.15 + 0.6);
  if (c.forma === 'trepadora') return [[GEO.cil, 0x8a6a40, -1, H / 2, -0.3, 0.06, H, 0.06], [GEO.cil, 0x8a6a40, 1, H / 2, -0.3, 0.06, H, 0.06], ...[0.25, 0.5, 0.75, 0.98].map((u) => [GEO.cil, 0xe8e2d0, 0, H * u, -0.3, 0.012, 2, 0.012, 0, 0, Math.PI / 2])];
  return [[GEO.cil, 0x8a6a40, 0.2, H / 2, 0.15, 0.05, H, 0.05], [GEO.cil, 0xe8e2d0, 0.1, H * 0.4, 0.08, 0.1, 0.03, 0.1], [GEO.cil, 0xe8e2d0, 0.1, H * 0.75, 0.08, 0.1, 0.03, 0.1]];
}
function firma(p) { return [p.cult, p.etapa, Math.round(p.altura * 20), Math.round(p.bio * 20), Math.round(p.flores), p.frutos.map((f) => `${Math.round(f.m * 6)}${Math.round(f.t * 4)}`).join(''), p.tutor, p.acame, p.chupones, Math.round(p.salud / 15), p.plaga ? Math.round(p.plaga.nivel * 8) : -1, Math.round(p.hongo * 8), p.espigada, p.viva, p.N < 20, Math.round(p.prog * 4)].join('|'); }

// ---------------------------------------------------------------- la escena
export function crearEscena(O) {
  const raiz = new THREE.Group(); O.mundo.add(raiz);
  const camas = POS_CAMAS.map(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); raiz.add(g);
    const marco = new THREE.Mesh(fundirGeo([[GEO.caja, 0x8a6440, 0, 0.6, -6.6, 13.6, 1.2, 0.5], [GEO.caja, 0x8a6440, 0, 0.6, 6.6, 13.6, 1.2, 0.5], [GEO.caja, 0x7a5434, -6.6, 0.6, 0, 0.5, 1.2, 13.6], [GEO.caja, 0x7a5434, 6.6, 0.6, 0, 0.5, 1.2, 13.6]]), MAT_VERTICE); marco.castShadow = true; marco.receiveShadow = true; g.add(marco);
    const tierra = new THREE.Mesh(new THREE.BoxGeometry(12.7, 1, 12.7), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 1 })); tierra.position.y = 0.5; tierra.receiveShadow = true; g.add(tierra);
    const planta = new THREE.Mesh(new THREE.BufferGeometry(), MAT_VERTICE); planta.castShadow = true; planta.position.y = 1; g.add(planta);
    const tutor = new THREE.Mesh(new THREE.BufferGeometry(), MAT_VERTICE); tutor.castShadow = true; tutor.position.y = 1; g.add(tutor);
    const sombra = new THREE.Mesh(fundirGeo([[GEO.cil, 0x6a5a4a, -5.5, 4, -5.5, 0.12, 8, 0.12], [GEO.cil, 0x6a5a4a, 5.5, 4, -5.5, 0.12, 8, 0.12], [GEO.cil, 0x6a5a4a, -5.5, 4, 5.5, 0.12, 8, 0.12], [GEO.cil, 0x6a5a4a, 5.5, 4, 5.5, 0.12, 8, 0.12]]), MAT_VERTICE); sombra.visible = false; g.add(sombra);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 11.6), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); tela.rotation.x = -Math.PI / 2; tela.position.y = 8; sombra.add(tela);
    const sel = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.6, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); sel.rotation.x = -Math.PI / 2; sel.position.y = 0.05; sel.visible = false; g.add(sel);
    return { g, tierra, planta, tutor, sombra, sel, firma: '', i };
  });
  // gotas, abono, chispas
  const P = [], geo = new THREE.BufferGeometry(), pos = new Float32Array(1500 * 3), col = new Float32Array(1500 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })); pts.frustumCulled = false; raiz.add(pts);
  const emitir = (x, y, z, n, c, vy = -4, abre = 3) => { for (let i = 0; i < n && P.length < 1500; i++) P.push({ x: x + (Math.random() - 0.5) * abre, y: y + Math.random(), z: z + (Math.random() - 0.5) * abre, vx: 0, vy: vy * (0.6 + Math.random() * 0.6), vz: 0, t: 0, vida: 1.2 + Math.random(), c }); };
  let ultEf = 0;
  return {
    actualizar(E, dt, t, selec) {
      for (const cm of camas) {
        const p = E.camas[cm.i]; cm.sel.visible = selec === cm.i; if (cm.sel.visible) cm.sel.material.opacity = 0.55 + Math.sin(t * 4) * 0.3;
        cm.tierra.material.color.set(p ? mezcla(0x8a6a4a, 0x3a2414, p.agua / 100) : 0x6a4a30);
        cm.sombra.visible = !!p && p.luz === 'sombra';
        const f = p ? firma(p) : '';
        if (f !== cm.firma) {
          cm.firma = f; cm.planta.geometry.dispose(); cm.tutor.geometry.dispose();
          const partes = p ? generar(p) : [];
          cm.planta.geometry = partes.length ? fundirGeo(partes) : new THREE.BufferGeometry();
          cm.planta.rotation.set(p?.acame ? 1.2 : 0, p ? p.id : 0, 0);
          cm.tutor.geometry = p?.tutor ? fundirGeo(tutorPartes(p, CULTIVOS[p.cult])) : new THREE.BufferGeometry();
        }
        if (p && p.viva && !p.acame) cm.planta.rotation.z = Math.sin(t * 1.2 + cm.i) * 0.015;   // la brisa
      }
      for (const f of E.ef) {
        if (f.id <= ultEf) continue; ultEf = f.id; const [x, z] = POS_CAMAS[f.cama] || [0, 0];
        if (f.t === 'riego') emitir(x, 9, z, 40 + (f.q || 25) * 2, [0.55, 0.78, 1], -7);
        else if (f.t === 'abono') emitir(x, 4, z, 60, f.tipo === 'cal' ? [0.95, 0.95, 0.95] : f.tipo === 'azufre' ? [0.95, 0.85, 0.3] : [0.5, 0.35, 0.2], -3);
        else if (f.t === 'cosecha') emitir(x, 2, z, 50, [1, 0.85, 0.3], 3);
        else if (f.t === 'trata') emitir(x, 3, z, 70, [0.75, 0.95, 0.75], -1, 4);
        else if (f.t === 'siembra') emitir(x, 2, z, 30, [0.5, 1, 0.4], 2, 1.5);
        else if (f.t === 'poda') emitir(x, 3, z, 25, [0.4, 0.7, 0.3], -2, 2);
        else if (f.t === 'etapa') emitir(x, 3, z, 30, [0.9, 1, 0.6], 2, 2);
        else if (f.t === 'muere') emitir(x, 2, z, 30, [0.4, 0.3, 0.2], 1, 2);
      }
      let n = 0;
      for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; q.t += dt; if (q.t > q.vida) { P[i] = P[P.length - 1]; P.pop(); continue; } q.y += q.vy * dt; if (q.y < 1) { q.y = 1; q.vy = 0; } }
      for (const q of P) { pos[n * 3] = q.x; pos[n * 3 + 1] = q.y; pos[n * 3 + 2] = q.z; col[n * 3] = q.c[0]; col[n * 3 + 1] = q.c[1]; col[n * 3 + 2] = q.c[2]; n++; }
      geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
    tocar(ev) {
      const r = O.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), O.camera);
      const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), p)) return -1;
      let m = -1, md = 9; POS_CAMAS.forEach(([x, z], i) => { const d = Math.max(Math.abs(p.x - x), Math.abs(p.z - z)); if (d < md) { md = d; m = i; } }); return m;
    },
    centro: (i, E) => { const [x, z] = POS_CAMAS[i], p = E.camas[i]; return new THREE.Vector3(x, 1 + (p ? Math.min(6, p.altura * ESC * 0.45) : 0.5), z); },
  };
}
export { N_CAMAS };
