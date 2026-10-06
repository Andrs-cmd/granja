// =====================================================================
// Arena de quimeras: lógica PURA (sin three ni DOM), determinista por semilla.
// Criaturas → estadísticas → combate 1 vs 1 por pasos fijos → consecuencias (experiencia, heridas, muerte, fama) → torneos.
// La escena solo LEE el combate (posiciones, estados, eventos); así lo mismo corre en Node para medir el balance.
// =====================================================================
import { ANIMALES, PARTES, RANURAS, HAB, TECNICAS, HERIDAS, parte, animalDe } from './partes.js';
import { azar, elegir, entre } from '../motor/azar.js';
export * from './partes.js';
export { azar };

export const ST = ['vida', 'fuerza', 'defensa', 'velocidad', 'agilidad', 'alcance'];
const BASE = [60, 6, 4, 3, 8, 1.0];
const MIN = [30, 2, 0, 1, 1, 0.5];
export const ARENA = 11; // radio del ruedo (unidades de la escena)
export const TICK = 0.1; // paso fijo: el mismo resultado a ×1 que a ×4 o en Node
export const LIMITE = 75;
export const SANGRE = 35; // desde aquí los golpes duelen más cada segundo // si nadie cae, gana quien conserve más vida

// ---------------------------------------------------------------- nombres
export function nombreQuimera(p) {
  const a = ANIMALES[p.cabeza]; let suf;
  if (p.cabeza !== p.torso) suf = ANIMALES[p.torso].suf;
  else { const c = animalDe('patas', p.patas); if (!c || c === p.cabeza) return a.nom + ' puro'; suf = ANIMALES[c].suf; }
  let n = a.pre.toLowerCase(), s = suf.toLowerCase();
  if (n.at(-1) === s[0]) s = s.slice(1); // «Leo»+«oso» = Leoso, no Leooso
  n += s; return n[0].toUpperCase() + n.slice(1);
}

// ---------------------------------------------------------------- estadísticas
export function estadisticas(cr) {
  const s = BASE.slice(), habs = new Set(['golpe']);
  for (const r of RANURAS) { const p = parte(r, cr.partes[r]); p.s.forEach((v, i) => { s[i] += v; }); p.hab.forEach((h) => habs.add(h)); }
  const n = cr.nivel || 1, kn = 1 + 0.06 * (n - 1);
  s[0] *= kn; s[1] *= kn; s[2] *= kn; s[4] *= 1 + 0.02 * (n - 1);
  (cr.bonus || []).forEach((v, i) => { s[i] += v; });
  const tec = new Set(cr.tecnicas || []);
  if (tec.has('pielCurtida')) s[2] *= 1.15;
  // una cicatriz resta un poco del atributo pero curte el cuero: las viejas glorias aguantan más
  for (const c of cr.cicatrices || []) { const h = HERIDAS[c]; if (h.stat !== 'vuelo') s[ST.indexOf(h.stat)] *= 0.96; s[2] += 1; }
  for (const h of cr.heridas || []) { const H = HERIDAS[h.tipo]; if (H.stat === 'vuelo') habs.delete('vuelo'); else s[ST.indexOf(H.stat)] *= H.k; }
  s.forEach((v, i) => { s[i] = Math.max(MIN[i], v); });
  const e = Object.fromEntries(ST.map((k, i) => [k, s[i]]));
  e.vida *= 1.7; // peleas de 20-60 s: con menos vida todo se resolvía en un parpadeo
  e.habs = [...habs]; e.activas = e.habs.filter((h) => HAB[h].tipo !== 'pasiva');
  e.pas = new Set(e.habs.filter((h) => HAB[h].tipo === 'pasiva')); e.tec = tec; e.vuela = habs.has('vuelo');
  return e;
}
// número orientativo para el público y las cuotas rápidas (no decide nada)
export function potencia(cr) { const e = estadisticas(cr); return Math.round(e.vida / 8 + e.fuerza * 2.2 + e.defensa * 1.2 + e.velocidad * 1.5 + e.agilidad + e.alcance * 4 + e.activas.length * 3 + e.pas.size * 2); }

// ---------------------------------------------------------------- criaturas
export const xpPara = (n) => 50 + 35 * n;
export function nuevaCriatura(est, partes, temp, dueno = 'tú') {
  return { id: est.sig++, nombre: nombreQuimera(partes), apodo: '', partes: { ...partes }, temp, nivel: 1, xp: 0, v: 0, d: 0, kos: 0, fama: 0, heridas: [], cicatrices: [], tecnicas: [], bonus: [0, 0, 0, 0, 0, 0], viva: true, nacio: est.jornada, dueno };
}
export function partesAzar(r) {
  const p = {};
  for (const k of RANURAS) {
    const L = PARTES[k];
    // las alas y los extras son raros: si todas tuvieran, el cielo estaría lleno
    if (k === 'alas') p[k] = r() < 0.55 ? 'ninguna' : elegir(r, L.slice(1)).id;
    else if (k === 'extra') p[k] = r() < 0.4 ? 'ninguno' : elegir(r, L.slice(1)).id;
    else if (k === 'cola') p[k] = r() < 0.2 ? 'ninguna' : elegir(r, L.slice(1)).id;
    else p[k] = elegir(r, L).id;
  }
  return p;
}
export const TEMPS = ['agresivo', 'cauteloso', 'astuto'];
export function aleatoria(est, r, nivel = 1, dueno = 'tú') {
  const c = nuevaCriatura(est, partesAzar(r), elegir(r, TEMPS), dueno);
  while (c.nivel < nivel) subirNivel(c, r);
  return c;
}
export const nombreDe = (c) => c.apodo ? `${c.apodo} (${c.nombre})` : c.nombre;
export const corto = (c) => c.apodo || c.nombre;

// ---------------------------------------------------------------- combate
export function crearCombate(a, b, semilla = 1) {
  const c = { r: azar(semilla), t: 0, acc: 0, L: [luchador(a, 0), luchador(b, 1)], ev: [], fin: null, emocion: 0 };
  c.L[0].rival = c.L[1]; c.L[1].rival = c.L[0];
  return c;
}
function luchador(cr, lado) {
  const e = estadisticas(cr);
  return { cr, lado, nom: corto(cr), temp: cr.temp, e, hp: e.vida, max: e.vida, x: lado ? 6 : -6, z: 0, vx: 0, vz: 0, rap: 0,
    ang: lado ? -Math.PI / 2 : Math.PI / 2, cd: {}, atkT: 1 + lado * 0.35, ef: {}, giro: lado ? 1 : -1, giroT: 3, carga: null,
    anim: 'quieto', animT: 0, hab: null, hecho: 0, crits: 0, esq: 0, golpes: 0, aliento: false, dot: 0 };
}
export function pasoCombate(c, dt) { c.acc += dt; while (c.acc >= TICK && !c.fin) { c.acc -= TICK; tick(c); } return c; }
export function resolverCombate(a, b, semilla = 1) { const c = crearCombate(a, b, semilla); while (!c.fin) { pasoCombate(c, 5); c.ev.length = 0; } return c; }
// probabilidad de que gane `a` (para las cuotas): pocas peleas simuladas en silencio
export function probVictoria(a, b, n = 24, semilla = 7) { let g = 0; for (let i = 0; i < n; i++) if (resolverCombate(a, b, semilla + i * 131).fin.ganador === 0) g++; return (g + 1) / (n + 2); }

const evento = (c, e) => { e.t = c.t; c.ev.push(e); };
const dur = (L, t) => t * (L.e.tec.has('aguante') ? 0.6 : 1);
const intervalo = (L) => 1.55 / (1 + L.e.agilidad / 45);
const alcance = (L) => 2 + L.e.alcance * 0.8;

function tick(c) {
  c.t += TICK;
  for (const L of c.L) estados(c, L);
  if (finSi(c)) return;
  ia(c, c.L[0], c.L[1]); ia(c, c.L[1], c.L[0]);
  separar(c.L[0], c.L[1]);
  if (finSi(c)) return;
  if (c.t >= LIMITE) { const [A, B] = c.L; terminar(c, A.hp / A.max >= B.hp / B.max ? 0 : 1, 'tiempo'); }
  if (!c.sangre && c.t > SANGRE) { c.sangre = true; evento(c, { tipo: 'sangre', texto: '¡El público pide sangre! Los golpes duelen cada vez más.' }); }
  c.emocion *= 0.985;
}

function estados(c, L) {
  const ef = L.ef;
  for (const k in ef) { ef[k].t -= TICK; if (ef[k].t <= 0) { delete ef[k]; if (k === 'vuelo') L.picada = true; if (k === 'atrapado') L.rival.ef.agarrando && delete L.rival.ef.agarrando; } }
  if (ef.veneno) danar(c, L, ef.veneno.dps * TICK, L.rival, 'veneno');
  if (ef.sangrado) danar(c, L, ef.sangrado.dps * TICK, L.rival, 'sangrado');
  if (ef.atrapado && ef.atrapado.dps) danar(c, L, ef.atrapado.dps * TICK, L.rival, 'apretón');
  if (L.e.pas.has('regeneracion')) curar(L, L.max * 0.0035 * TICK);
  if (ef.escudo) curar(L, L.max * 0.02 * TICK);
  const k = L.e.tec.has('cazador') ? 1.15 : 1;
  for (const h in L.cd) L.cd[h] -= TICK * k;
  L.atkT -= TICK; L.animT -= TICK;
  if (L.animT <= 0 && L.anim !== 'cae' && L.anim !== 'celebra') L.anim = 'quieto';
}
function curar(L, v) { L.hp = Math.min(L.max, L.hp + v); }
function danar(c, L, d, fuente, tipo) {
  if (!(d > 0) || c.fin) return;
  L.hp -= d; if (fuente) fuente.hecho += d;
  if (tipo) { L.dot += d; if (L.dot >= 4) { evento(c, { tipo: 'dot', a: L.lado, dano: Math.round(L.dot), estado: tipo }); L.dot = 0; } }
}
function finSi(c) {
  for (const L of c.L) if (L.hp <= 0 && L.e.tec.has('segundoAliento') && !L.aliento) {
    L.aliento = true; L.hp = L.max * 0.25; evento(c, { tipo: 'aliento', a: L.lado, texto: `${L.nom} se niega a caer: ¡segundo aliento!` });
  }
  const [A, B] = c.L;
  if (A.hp <= 0 || B.hp <= 0) { terminar(c, A.hp <= 0 && B.hp <= 0 ? (A.hp > B.hp ? 0 : 1) : A.hp <= 0 ? 1 : 0, 'ko'); return true; }
  return false;
}
function terminar(c, g, motivo) {
  if (c.fin) return;
  const G = c.L[g], P = c.L[1 - g];
  c.fin = { ganador: g, motivo, t: c.t, vida: c.L.map((L) => L.hp / L.max), hecho: c.L.map((L) => Math.round(L.hecho)), crits: c.L.map((L) => L.crits), esq: c.L.map((L) => L.esq), remate: P.hp < -P.max * 0.12 };
  G.anim = 'celebra'; P.anim = motivo === 'rendicion' ? 'miedo' : 'cae'; P.ef = {}; G.ef = {};
  const txt = motivo === 'ko' ? `¡${P.nom} cae! Gana ${G.nom}.` : motivo === 'rendicion' ? `${P.nom} se rinde. Gana ${G.nom}.` : `¡Tiempo! ${G.nom} gana por puntos.`;
  evento(c, { tipo: 'fin', de: g, a: 1 - g, texto: txt });
  c.emocion = 1.5;
}

const PESO = {
  agresivo: { ataque: 1.25, carga: 1.4, grito: 1, vuelo: 0.6, escudo: 0.5, distancia: 0.8, agarre: 1.1 },
  cauteloso: { ataque: 1, carga: 0.8, grito: 1, vuelo: 1.4, escudo: 1.5, distancia: 1.2, agarre: 0.9 },
  astuto: { ataque: 0.95, carga: 1, grito: 1.3, vuelo: 1, escudo: 1, distancia: 1.5, agarre: 1.4 },
};
function ia(c, A, B) {
  if (A.hp <= 0 || c.fin) return;
  const r = c.r, dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 0.001, ux = dx / d, uz = dz / d, alc = alcance(A);
  let vel = 0.7 + A.e.velocidad * 0.3; if (A.ef.lento) vel *= 0.45;
  A.ang = Math.atan2(ux, uz);
  if (A.ef.aturdido) { A.anim = 'aturdido'; A.animT = 0.2; A.carga = null; mover(A, 0, 0); return; }
  if (A.ef.atrapado) { A.anim = 'atrapado'; A.animT = 0.2; mover(A, 0, 0); if (A.atkT <= 0 && d <= alc + 0.3) golpear(c, A, B, 'golpe'); return; }
  // cauteloso al borde de la muerte: tirar la toalla le salva la vida
  if (A.temp === 'cauteloso' && A.hp < A.max * 0.1 && B.hp > B.max * 0.35 && r() < 0.03) { terminar(c, B.lado, 'rendicion'); return; }
  if (A.carga) {
    A.carga.t += TICK; mover(A, ux * vel * 2.6, uz * vel * 2.6); A.anim = 'carga'; A.animT = 0.2;
    if (d <= alc + 0.4) { golpear(c, A, B, A.carga.h); A.carga = null; } else if (A.carga.t > 1.8 || B.ef.vuelo) A.carga = null;
    return;
  }
  if (A.picada) { A.picada = false; if (d <= alc + 2.5) golpear(c, A, B, 'vuelo'); }
  if (A.ef.miedo) {
    A.ang = Math.atan2(-ux, -uz); A.anim = 'miedo'; A.animT = 0.2;
    mover(A, (-ux - uz * 0.5 * A.giro) * vel, (-uz + ux * 0.5 * A.giro) * vel);
    if (d < alc && A.atkT <= 0 && r() < 0.3) golpear(c, A, B, 'golpe'); // acorralado, lanza un manotazo
    return;
  }
  if (A.atkT <= 0 && !A.ef.vuelo) { const h = elegirHab(c, A, B, d, alc); if (h) usar(c, A, B, h, d); }
  if (A.ef.agarrando) { mover(A, 0, 0); return; }
  // distancia deseada según el temperamento: así cada uno pelea distinto
  const listo = A.atkT < 0.35; let obj;
  if (A.ef.vuelo) obj = alc + 1.2;
  else if (A.temp === 'agresivo') obj = alc * 0.75;
  else if (A.temp === 'cauteloso') obj = listo ? alc * 0.85 : alc + 2.2;
  else { const debil = B.ef.aturdido || B.ef.atrapado || B.ef.ceguera || B.ef.lento || B.ef.miedo || B.ef.veneno; obj = debil || (listo && B.atkT > 0.6) ? alc * 0.8 : alc + 1.6; }
  const err = d - obj, rad = Math.max(-1, Math.min(1, err / 1.5)), tan = (Math.abs(err) < 1.5 ? 0.6 : 0.25) * A.giro;
  A.giroT -= TICK; if (A.giroT <= 0) { if (r() < 0.5) A.giro *= -1; A.giroT = entre(r, 1.5, 4); }
  mover(A, (ux * rad - uz * tan) * vel, (uz * rad + ux * tan) * vel);
  if (A.anim === 'quieto' && A.rap > 0.4) A.anim = A.ef.vuelo ? 'vuela' : 'camina';
  if (A.ef.vuelo) A.anim = 'vuela';
}
function mover(A, vx, vz) {
  A.vx += (vx - A.vx) * 0.35; A.vz += (vz - A.vz) * 0.35;
  A.x += A.vx * TICK; A.z += A.vz * TICK; A.rap = Math.hypot(A.vx, A.vz);
  const d = Math.hypot(A.x, A.z), lim = ARENA - 1.2; if (d > lim) { A.x *= lim / d; A.z *= lim / d; }
}
function separar(A, B) {
  if (A.ef.vuelo || B.ef.vuelo) return;
  const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 0.001, m = 1.7;
  if (d < m) { const k = (m - d) / 2 / d; A.x -= dx * k; A.z -= dz * k; B.x += dx * k; B.z += dz * k; }
}
function elegirHab(c, A, B, d, alc) {
  let mejor = null, mv = 0;
  for (const h of A.e.activas) {
    if (h === 'golpe' || (A.cd[h] || 0) > 0) continue;
    const H = HAB[h]; let u = 0;
    switch (H.tipo) {
      case 'ataque': if (d <= alc + (H.alc || 0)) u = H.mult + (H.sangrado || 0) * 0.6 + (H.veneno ? (B.ef.veneno ? 0.2 : 1.2) : 0) + (H.aturdir ? H.aturdir[0] : 0) + (H.crit || 0) + (H.robo && A.hp < A.max * 0.75 ? 0.8 : 0) + (H.atrapar && !B.ef.atrapado ? 0.5 : 0); break;
      case 'carga': if (d > 3.2 && d < 9 && !B.ef.vuelo) u = H.mult + 0.4; break;
      case 'grito': if (H.miedo && !B.ef.miedo && d < 7 && !B.e.pas.has('melena')) u = 1.6; if (H.furia && !A.ef.furia && d < 6) u = Math.max(u, 1.4); break;
      case 'vuelo': if (d < alc + 2 && A.hp < A.max * 0.85) u = 1.3 + (1 - A.hp / A.max); break;
      case 'escudo': if (A.hp < A.max * 0.65 && d < alcance(B) + 1.5) u = 1.6; break;
      case 'distancia': if (d < 6.5 && !B.ef[H.ceguera ? 'ceguera' : 'lento'] && !(H.ceguera && B.e.pas.has('ecolocacion'))) u = 1.5; break;
      case 'agarre': if (d <= alc + 0.3 && !B.ef.atrapado && !B.ef.vuelo) u = 1.7; break;
    }
    if (!u) continue;
    u *= PESO[A.temp][H.tipo] * (0.75 + c.r() * 0.5);
    if (u > mv) { mv = u; mejor = h; }
  }
  return mv > 1.05 ? mejor : d <= alc ? 'golpe' : null;
}
function usar(c, A, B, h, d) {
  const H = HAB[h], r = c.r;
  switch (H.tipo) {
    case 'ataque': golpear(c, A, B, h); return;
    case 'carga': A.carga = { h, t: 0 }; A.cd[h] = H.cd; evento(c, { tipo: 'carga', de: A.lado, h, texto: `${A.nom} toma impulso: ¡${H.nom.toLowerCase()}!` }); return;
    case 'grito': {
      A.cd[h] = H.cd; A.atkT = 0.8; A.anim = 'grito'; A.animT = 0.9;
      if (H.furia) A.ef.furia = { t: H.furia };
      const asusta = H.miedo && !B.e.pas.has('melena') && r() < 0.85 - (B.cr.nivel - A.cr.nivel) * 0.08;
      if (asusta) { B.ef.miedo = { t: dur(B, H.miedo) }; B.carga = null; }
      evento(c, { tipo: 'grito', de: A.lado, h, texto: `${A.nom} lanza ${H.nom.toLowerCase()}${asusta ? ` y ${B.nom} retrocede asustado` : H.furia ? ': ¡se enardece!' : ', pero no impresiona'}.` });
      return;
    }
    case 'vuelo': A.cd[h] = H.cd; A.atkT = 0.5; A.ef.vuelo = { t: H.dur }; evento(c, { tipo: 'vuelo', de: A.lado, texto: `${A.nom} alza el vuelo.` }); return;
    case 'escudo': A.cd[h] = H.cd; A.atkT = 0.6; A.ef.escudo = { t: H.dur }; A.anim = 'escudo'; A.animT = H.dur; evento(c, { tipo: 'escudo', de: A.lado, texto: `${A.nom} se encierra en su caparazón.` }); return;
    case 'distancia': case 'agarre': {
      A.cd[h] = H.cd; A.atkT = intervalo(A); A.anim = 'ataca'; A.animT = 0.4; A.hab = h;
      const acierta = r() < 0.85 - B.e.agilidad / (B.e.agilidad + 120) - (B.ef.vuelo ? 0.4 : 0);
      if (!acierta) { evento(c, { tipo: 'esquiva', de: A.lado, a: B.lado, h, texto: `${B.nom} esquiva ${H.nom.toLowerCase()}.` }); return; }
      if (H.ceguera) B.ef.ceguera = { t: dur(B, H.ceguera) };
      if (H.lento) B.ef.lento = { t: dur(B, H.lento) };
      if (H.atrapar) { B.ef.atrapado = { t: dur(B, H.atrapar), dps: A.e.fuerza * H.mult }; A.ef.agarrando = { t: dur(B, H.atrapar) }; B.carga = null; delete B.ef.vuelo; }
      evento(c, { tipo: 'estado', de: A.lado, a: B.lado, h, texto: `${A.nom} usa ${H.nom.toLowerCase()} sobre ${B.nom}.` });
    }
  }
}
function golpear(c, A, B, h) {
  const H = HAB[h], r = c.r, pas = A.e.pas;
  if (H.cd) A.cd[h] = H.cd;
  A.atkT = intervalo(A); A.anim = 'ataca'; A.animT = 0.4; A.hab = h; A.golpes++;
  let pAc = 0.94 + (pas.has('ecolocacion') ? 0.04 : 0);
  if (A.ef.ceguera && !pas.has('ecolocacion')) pAc -= 0.45;
  if (A.ef.lento) pAc -= 0.1;
  let esq = (B.e.agilidad + B.e.velocidad * 1.5) / (B.e.agilidad + B.e.velocidad * 1.5 + 85) + (B.e.pas.has('sabiduria') ? 0.06 : 0) + (B.e.tec.has('finta') ? 0.06 : 0) + (B.temp === 'cauteloso' ? 0.02 : 0);
  if (B.ef.lento) esq *= 0.5;
  if (B.ef.aturdido || B.ef.atrapado) esq = 0;
  if (B.ef.vuelo && h !== 'vuelo' && A.e.alcance < 2.2) esq = Math.max(esq, 0.75); // al que vuela casi no se le alcanza desde el suelo
  if (r() > pAc * (1 - esq)) {
    B.esq++; evento(c, { tipo: 'esquiva', de: A.lado, a: B.lado, h, texto: H.cd ? `${B.nom} esquiva ${H.nom.toLowerCase()}.` : null });
    if (B.e.tec.has('contraataque') && r() < 0.45 && Math.hypot(A.x - B.x, A.z - B.z) <= alcance(B) + 0.5 && !B.ef.vuelo) { B.atkT = 0; golpear(c, B, A, 'golpe'); }
    return;
  }
  const crit = 0.05 + A.e.agilidad / 500 + (H.crit || 0) + (pas.has('vistaAguda') ? 0.08 : 0) + (A.e.tec.has('instinto') ? 0.1 : 0) + (A.temp === 'astuto' && (B.ef.aturdido || B.ef.atrapado || B.ef.ceguera) ? 0.25 : 0);
  const esCrit = r() < crit;
  let dmg = A.e.fuerza * (H.mult || 1) * (0.85 + r() * 0.3) * (esCrit ? 1.75 : 1);
  if (A.ef.furia) dmg *= 1.3; if (A.ef.miedo) dmg *= 0.7; if (A.ef.atrapado) dmg *= 0.6;
  if (A.temp === 'agresivo') dmg *= 1.12;
  if (c.t > SANGRE) dmg *= 1 + (c.t - SANGRE) / 12; // el público pide sangre: las peleas largas se aceleran
  if (A.e.tec.has('furiaFinal') && A.hp < A.max * 0.3) dmg *= 1.3;
  if (pas.has('frenesi') && B.ef.sangrado) dmg *= 1.25;
  const def = B.e.defensa * (B.temp === 'agresivo' ? 0.9 : 1);
  dmg *= 1 - def / (def + 45);
  if (B.ef.escudo) dmg *= 0.3;
  if (B.e.pas.has('melena') && esCrit) dmg *= 0.8;
  danar(c, B, dmg, A); if (esCrit) A.crits++;
  const ef = [];
  if (H.sangrado && r() < H.sangrado + 0.1) { B.ef.sangrado = { t: dur(B, 5), dps: Math.min(A.e.fuerza * 0.4, (B.ef.sangrado?.dps || 0) + A.e.fuerza * 0.18) }; ef.push('sangra'); }
  if (H.veneno) { B.ef.veneno = { t: dur(B, 6), dps: Math.min(A.e.fuerza * H.veneno * 0.13, (B.ef.veneno?.dps || 0) + A.e.fuerza * H.veneno * 0.07) }; ef.push('envenenado'); }
  if (H.aturdir && r() < H.aturdir[0] && !B.ef.escudo) { B.ef.aturdido = { t: dur(B, H.aturdir[1]) }; B.carga = null; ef.push('aturdido'); }
  if (H.atrapar && !B.ef.atrapado) { B.ef.atrapado = { t: dur(B, H.atrapar), dps: 0 }; ef.push('atrapado'); }
  if (H.empuje) { const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 1; B.x += dx / d * H.empuje * 0.6; B.z += dz / d * H.empuje * 0.6; mover(B, 0, 0); }
  if (H.robo) curar(A, dmg * H.robo);
  if (B.e.pas.has('puas') && h !== 'vuelo') danar(c, A, dmg * 0.2, B);
  if (h === 'vuelo') delete A.ef.vuelo;
  B.anim = 'golpeado'; B.animT = 0.3;
  c.emocion = Math.min(2, c.emocion + dmg / B.max * (esCrit ? 4 : 2));
  const nom = h === 'golpe' ? null : h === 'vuelo' ? 'cae en picada' : H.nom.toLowerCase();
  evento(c, { tipo: 'golpe', de: A.lado, a: B.lado, h, dano: Math.round(dmg), crit: esCrit, ef,
    texto: nom || esCrit || ef.length ? `${A.nom} ${nom ? (h === 'vuelo' ? nom : `usa ${nom}`) : 'acierta'}${esCrit ? ' ¡CRÍTICO!' : ''} (−${Math.round(dmg)})${ef.length ? ` · ${B.nom} ${ef.join(', ')}` : ''}` : null });
}

// ---------------------------------------------------------------- progreso y consecuencias
const PREF = { agresivo: [1, 3, 1, 1, 1, 1], cauteloso: [2, 1, 2, 1, 2, 0], astuto: [1, 1, 1, 2, 3, 1] };
const PASO = [7, 1.2, 1, 0.25, 1.2, 0.06];
const TEC_PREF = { agresivo: ['furiaFinal', 'instinto', 'cazador'], cauteloso: ['pielCurtida', 'aguante', 'finta'], astuto: ['contraataque', 'finta', 'cazador'] };
export function subirNivel(cr, r) {
  cr.nivel++;
  const w = PREF[cr.temp], tot = w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < 2; k++) { let x = r() * tot, i = 0; while (x > w[i]) x -= w[i++]; cr.bonus[i] = +(cr.bonus[i] + PASO[i]).toFixed(2); }
  if (cr.nivel % 2 === 0) {
    const faltan = Object.keys(TECNICAS).filter((t) => !cr.tecnicas.includes(t));
    if (faltan.length) { const pref = faltan.filter((t) => TEC_PREF[cr.temp].includes(t)); const t = elegir(r, pref.length && r() < 0.7 ? pref : faltan); cr.tecnicas.push(t); return t; }
  }
  return null;
}
// aplica lo que deja una pelea; devuelve líneas para el diario. opc: { muerte: bool, bolsa: monedas para el ganador }
export function aplicarResultado(est, c, r, opc = {}) {
  const f = c.fin, G = c.L[f.ganador].cr, P = c.L[1 - f.ganador].cr, out = [];
  const lin = (texto, tipo = '') => out.push({ texto, tipo });
  G.v++; P.d++; if (f.motivo === 'ko') G.kos++;
  const famaP = P.fama;
  G.fama += 3 + Math.round(Math.sqrt(famaP)) + (f.motivo === 'ko' ? 1 : 0); // raíz: vencer a un famoso sube mucho, sin desbocarse P.fama = Math.max(0, P.fama - (f.motivo === 'rendicion' ? 3 : 1));
  const xpG = 30 + 8 * Math.max(0, P.nivel - G.nivel + 1), xpP = 12 + (f.motivo === 'tiempo' ? 8 : 0) + Math.round(c.L[1 - f.ganador].hecho / 25);
  lin(`Experiencia: ${corto(G)} +${xpG} · ${corto(P)} +${xpP}.`);
  for (const [cr, xp] of [[G, xpG], [P, xpP]]) {
    cr.xp += xp;
    while (cr.xp >= xpPara(cr.nivel)) { cr.xp -= xpPara(cr.nivel); const t = subirNivel(cr, r); lin(`${corto(cr)} sube a nivel ${cr.nivel}${t ? ` y aprende «${TECNICAS[t].nom}»` : ''}.`, 'logro'); }
  }
  // primero se decide la muerte: un caído no queda «cojo»
  if (f.motivo === 'ko' && opc.muerte !== false) {
    const p = 0.1 + 0.08 * P.heridas.length + (f.remate ? 0.15 : 0) - Math.min(0.06, P.nivel * 0.01) + (opc.extraMuerte || 0);
    if (r() < p) { P.viva = false; P.murio = { j: est.jornada, por: corto(G) }; G.fama += 4; lin(`☠ ${corto(P)} muere en la arena a manos de ${corto(G)}.`, 'malo'); }
  }
  // heridas: quien terminó muy maltrecho puede salir lesionado (el ganador también)
  c.L.forEach((L, i) => {
    const cr = L.cr, frac = f.vida[i], perdio = i !== f.ganador;
    if (cr.viva && frac < 0.35 && r() < (perdio ? 0.55 : 0.25)) {
      const tipos = Object.keys(HERIDAS).filter((t) => t !== 'ala' || cr.partes.alas !== 'ninguna'), t = elegir(r, tipos);
      if (cr.heridas.some((h) => h.tipo === t)) { cr.heridas = cr.heridas.filter((h) => h.tipo !== t); cr.cicatrices.push(t); lin(`${corto(cr)}: la herida «${HERIDAS[t].nom}» se agrava y deja cicatriz.`, 'malo'); }
      else { cr.heridas.push({ tipo: t, restan: 2 + Math.floor(r() * 3) }); lin(`${corto(cr)} queda con ${HERIDAS[t].nom.toLowerCase()}.`, 'malo'); }
    }
  });
  if (opc.bolsa && G.dueno === 'tú') { est.monedas += opc.bolsa; lin(`Bolsa del combate: +${opc.bolsa} monedas.`, 'bueno'); }
  return out;
}
// pasa un día: sanan heridas, los rivales entrenan y pelean entre ellos (el mundo sigue sin ti)
const DUENOS = ['Doña Remedios', 'El Mono Quintero', 'Tía Chepa', 'Don Aurelio', 'La Flaca Ruiz', 'Profe Gutiérrez', 'Mancho Ospina', 'Nena Cárdenas', 'Don Evelio', 'La Mona Restrepo'];
export function avanzarJornada(est, r) {
  est.jornada++; const out = [];
  for (const cr of [...est.establo, ...est.rivales]) {
    if (!cr.viva) continue;
    for (const h of cr.heridas) h.restan--;
    for (const h of cr.heridas.filter((x) => x.restan <= 0)) {
      if (r() < 0.3) { cr.cicatrices.push(h.tipo); if (cr.dueno === 'tú') out.push({ texto: `${corto(cr)} sanó, pero le quedó cicatriz (${HERIDAS[h.tipo].nom.toLowerCase()}).`, tipo: '' }); }
      else if (cr.dueno === 'tú') out.push({ texto: `${corto(cr)} se recuperó de ${HERIDAS[h.tipo].nom.toLowerCase()}.`, tipo: 'bueno' });
    }
    cr.heridas = cr.heridas.filter((x) => x.restan > 0);
  }
  let vivos = est.rivales.filter((x) => x.viva);
  // los rivales entrenan poco y las leyendas se retiran: así la arena no se vuelve inalcanzable para tu establo
  const nm = nivelRef(est);
  for (const cr of vivos) {
    if (cr.nivel > nm + 3 && r() < 0.15) { cr.viva = false; cr.retirado = true; cr.murio = { j: est.jornada, por: 'el retiro' }; out.push({ texto: `${corto(cr)} (nv ${cr.nivel}, ${cr.v}-${cr.d}) se retira como leyenda de ${cr.dueno}.`, tipo: 'logro', rival: true }); continue; }
    cr.xp += Math.floor(r() * 10); while (cr.xp >= xpPara(cr.nivel)) { cr.xp -= xpPara(cr.nivel); subirNivel(cr, r); } }
  vivos = vivos.filter((x) => x.viva);
  if (vivos.length >= 2) {
    const a = elegir(r, vivos), b = elegir(r, vivos.filter((x) => x !== a)), c = resolverCombate(a, b, Math.floor(r() * 1e9));
    const g = c.L[c.fin.ganador].cr, p = c.L[1 - c.fin.ganador].cr;
    aplicarResultado(est, c, r, { muerte: true, extraMuerte: -0.05 });
    out.push({ texto: `En otra jaula: ${corto(g)} (de ${g.dueno}) venció a ${corto(p)}${p.viva ? '' : ', que murió'}.`, tipo: '', rival: true });
    est.historial.unshift(resumen(est, c, 'jaula'));
    if (!p.viva) registrarCaido(est, p);
  }
  // reponer rivales caídos con novatos al nivel de tu establo
  est.rivales = est.rivales.filter((x) => x.viva || est.jornada - x.murio.j < 6);
  while (est.rivales.filter((x) => x.viva).length < 10) {
    const nv = Math.max(1, Math.round(nivelRef(est) + entre(r, -1, 1.5))), cr = aleatoria(est, r, nv, elegir(r, DUENOS));
    est.rivales.push(cr); out.push({ texto: `Llega a la arena ${corto(cr)} (nv ${cr.nivel}), de ${cr.dueno}.`, tipo: '' });
  }
  est.historial.length = Math.min(est.historial.length, 80);
  return out;
}
// salón de los caídos: toda muerte (vista o en otra jaula) queda en la memoria del coliseo
export function registrarCaido(est, cr) {
  est.caidos ||= [];
  if (est.caidos.some((x) => x.id === cr.id)) return;
  est.caidos.unshift({ id: cr.id, nombre: nombreDe(cr), dueno: cr.dueno, nivel: cr.nivel, v: cr.v, d: cr.d, j: est.jornada, por: cr.murio?.por || '¿?', partes: cr.partes });
  est.cronica.unshift({ j: est.jornada, tipo: 'muerte', texto: `☠ Cayó ${nombreDe(cr)} (nv ${cr.nivel}, ${cr.v}-${cr.d}) de ${cr.dueno}, a manos de ${cr.murio?.por || '¿?'}.` });
  est.caidos.length = Math.min(est.caidos.length, 60);
}
export const nivelMedio = (est) => { const v = est.establo.filter((x) => x.viva); return v.length ? v.reduce((a, x) => a + x.nivel, 0) / v.length : 1; };
// nivel de referencia de la arena: se acerca a tu mejor quimera para que siempre haya rivales a su altura
export const nivelRef = (est) => { const v = est.establo.filter((x) => x.viva); return v.length ? Math.max(nivelMedio(est), Math.max(...v.map((x) => x.nivel)) - 2) : 1; };
export function resumen(est, c, tipo = 'amistoso') {
  const f = c.fin, [A, B] = c.L;
  return { j: est.jornada, tipo, a: corto(A.cr), b: corto(B.cr), ia: A.cr.id, ib: B.cr.id, g: f.ganador, m: f.motivo, t: Math.round(f.t), murio: !c.L[1 - f.ganador].cr.viva };
}

// ---------------------------------------------------------------- estado inicial y torneo
export function estadoInicial(semilla = 1) {
  const r = azar(semilla), est = { v: 1, semilla, sig: 1, jornada: 1, monedas: 150, peleas: 0, establo: [], rivales: [], historial: [], cronica: [], torneo: null, caidos: [], opc: { muerte: true, cine: true } };
  for (let i = 0; i < 2; i++) est.establo.push(aleatoria(est, r, 1, 'tú'));
  for (let i = 0; i < 10; i++) est.rivales.push(aleatoria(est, r, 1 + Math.floor(r() * 3), elegir(r, DUENOS)));
  est.cronica.push({ j: 1, tipo: 'inicio', texto: 'Abres tu establo en la Arena de quimeras con dos crías.' });
  return est;
}
export const COPAS = ['Copa de la Luna Roja', 'Torneo del Colmillo', 'Copa Sangre y Arena', 'Gran Premio del Coliseo', 'Copa de las Mil Garras', 'Torneo del Eclipse'];
export function crearTorneo(est, ids, r) {
  const L = ids.slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
  const pares = []; for (let i = 0; i < L.length; i += 2) pares.push({ a: L[i], b: L[i + 1], g: null });
  return { nombre: elegir(r, COPAS) + ` · jornada ${est.jornada}`, rondas: [pares], ronda: 0, idx: 0, campeon: null };
}
export const peleaActual = (T) => (T.campeon == null ? T.rondas[T.ronda][T.idx] : null);
export function registrarPelea(T, ganador) {
  T.rondas[T.ronda][T.idx].g = ganador; T.idx++;
  if (T.idx >= T.rondas[T.ronda].length) {
    const gs = T.rondas[T.ronda].map((p) => p.g);
    if (gs.length === 1) T.campeon = gs[0];
    else { const pares = []; for (let i = 0; i < gs.length; i += 2) pares.push({ a: gs[i], b: gs[i + 1], g: null }); T.rondas.push(pares); T.ronda++; T.idx = 0; }
  }
}
export const NOM_RONDA = (n, total) => (total - n === 1 ? 'Final' : total - n === 2 ? 'Semifinal' : 'Cuartos');
export const buscar = (est, id) => est.establo.find((x) => x.id === id) || est.rivales.find((x) => x.id === id);
