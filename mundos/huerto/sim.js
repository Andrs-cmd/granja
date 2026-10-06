// =====================================================================
// Banco de semillas — simulación de cultivo (pura: sin three ni DOM; determinista con semilla).
// Cada cama tiene UNA planta que vive día a día: agua del suelo, nutrientes (N, P, K), pH, temperatura del
// piso térmico, luz, plagas y hongos, poda y tutor; pasa por sus etapas, florece, cuaja frutos, madura y se cosecha.
// Lo que haces (o dejas de hacer) tiene consecuencias, y cada error o acierto deja una lección.
// =====================================================================
import { azar } from '../motor/azar.js';
import { CULTIVOS, PISOS, ETAPAS, ABONOS, REMEDIOS, PLAGAS } from './cultivos.js';
export { CULTIVOS, PISOS, ETAPAS, ABONOS, REMEDIOS, PLAGAS };

export const N_CAMAS = 4;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const ORDEN = ['germ', 'plantula', 'veg', 'flor', 'fruto', 'cosecha'];
const nombreEtapa = (k) => ETAPAS.find((e) => e[0] === k)?.[1] || k;

// ---------------------------------------------------------------- creación
export function crearHuerto(piso = 'templado', semilla = Date.now() % 99991) {
  return { v: 1, semilla: semilla >>> 0 || 1, dia: 60, piso, clima: { T: PISOS[piso].t, lluvia: 0, temporada: 'lluvias' }, camas: Array(N_CAMAS).fill(null), diario: [], lecciones: {}, cosechas: [], historial: [], sig: 1, ef: [], sigEf: 1 };
}
function log(E, texto, tipo = '', cama = null) { E.diario.unshift({ d: E.dia, texto, tipo, cama }); if (E.diario.length > 250) E.diario.length = 250; }
function leccion(E, k, texto) { if (!E.lecciones[k]) { E.lecciones[k] = { texto, dia: E.dia }; log(E, `💡 Aprendiste: ${texto}`, 'logro'); } }
function efecto(E, t, cama, extra = {}) { E.ef.push({ id: E.sigEf++, t, cama, ...extra }); if (E.ef.length > 40) E.ef.shift(); }
export const etapaDe = (p) => ORDEN[p.etapa];
const ciclos = (c) => ORDEN.slice(0, 5).filter((k) => (c.ciclo[k] || 0) > 0);

export function sembrar(E, cama, clave) {
  const c = CULTIVOS[clave]; if (!c) return 'Cultivo desconocido.'; if (E.camas[cama]) return 'Esa cama ya tiene una planta: cosecha o arráncala primero.';
  const p = { id: E.sig++, cult: clave, cama, dia: 0, etapa: c.ciclo.germ ? 0 : 1, prog: 0, altura: c.ciclo.germ ? 0 : 0.04, bio: c.ciclo.germ ? 0.02 : 0.08, salud: 100, agua: 60, N: 55, P: 50, K: 50, ph: 6.3,
    plaga: null, hongo: 0, chupones: 0, tutor: false, luz: 'sol', acame: false, frutos: [], flores: 0, cosechado: 0, nCosechas: 0, podrido: 0, estres: 0, exceso: 0, viva: true, causa: null,
    riegos: 0, abonos: 0, tratamientos: 0, podas: 0, errores: [], ciclosPerenne: 0, espigada: false, prod: 0, sano: 0, dias: 0, saludSum: 0 };
  E.camas[cama] = p;
  log(E, `🌰 Sembraste ${c.e} ${c.n} en la cama ${cama + 1}. ${c.guia.siembra}`, 'bueno', cama);
  const t = PISOS[E.piso].t; if (t < c.temp[1] - 3 || t > c.temp[2] + 3) log(E, `⚠️ Ojo: tu piso térmico (${PISOS[E.piso].n}, ~${t} °C) no es el ideal para ${c.n} (${c.temp[1]}–${c.temp[2]} °C). Va a sufrir.`, 'malo', cama);
  efecto(E, 'siembra', cama); return null;
}
export function arrancar(E, cama) { const p = E.camas[cama]; if (!p) return 'No hay planta.'; cerrar(E, p, p.viva ? 'arrancada' : p.causa); E.camas[cama] = null; return null; }
function cerrar(E, p, motivo) {
  const c = CULTIVOS[p.cult];
  E.historial.unshift({ cult: p.cult, piso: E.piso, dias: p.dia, kg: Math.round(p.cosechado * 100) / 100, salud: Math.round(p.saludSum / Math.max(1, p.dias)), motivo, errores: [...new Set(p.errores)].slice(0, 6), esperado: c.rinde, cosechas: p.nCosechas });
  if (E.historial.length > 60) E.historial.length = 60;
}

// ---------------------------------------------------------------- el clima del día (temporadas de lluvia de Colombia: marzo–mayo y septiembre–noviembre)
function climaDia(E, R) {
  const d = E.dia % 365, P = PISOS[E.piso], lluvias = (d >= 60 && d < 150) || (d >= 243 && d < 334);
  E.clima.temporada = lluvias ? 'lluvias' : 'seco';
  E.clima.T = Math.round((P.t + (lluvias ? -0.8 : 0.8) + (R() - 0.5) * P.osc) * 10) / 10;
  E.clima.lluvia = R() < (lluvias ? 0.55 : 0.14) ? Math.round(8 + R() * 22) : 0;
}

// ---------------------------------------------------------------- cuánto le sirve cada cosa (0..1)
export function fTemp(c, t) { const [mn, o1, o2, mx] = c.temp; if (t <= mn || t >= mx) return 0.05; if (t < o1) return 0.2 + 0.8 * (t - mn) / (o1 - mn); if (t > o2) return 0.2 + 0.8 * (mx - t) / (mx - o2); return 1; }
export function fAgua(a) { return a < 15 ? 0.05 : a < 35 ? 0.3 + (a - 15) / 20 * 0.6 : a <= 82 ? 1 : a <= 95 ? 0.75 : 0.5; }
function necesidad(c, p) { const k = etapaDe(p); return c.nutr[k] || c.nutr.veg || [0.5, 0.5, 0.5]; }
function disponible(p) { const fph = p.ph < 5.2 ? 0.55 : p.ph < 5.8 ? 0.8 : p.ph > 7.8 ? 0.6 : p.ph > 7.3 ? 0.85 : 1; return [p.N / 100 * fph, p.P / 100 * fph, p.K / 100 * fph]; }
function fNutr(c, p) { const w = necesidad(c, p), d = disponible(p); let f = 1; for (let i = 0; i < 3; i++) f = Math.min(f, cl(d[i] / (0.25 * w[i] + 0.12), 0.15, 1)); return f; }
function fLuz(c, p, t) { if (c.luz === 'pleno' && p.luz === 'sombra') return 0.6; if (c.luz === 'media' && p.luz === 'sol' && t > c.temp[2] - 1) return 0.8; return 1; }
function fPh(c, p) { const [a, b] = c.ph; return p.ph < a ? cl(1 - (a - p.ph) * 0.35, 0.4) : p.ph > b ? cl(1 - (p.ph - b) * 0.35, 0.4) : 1; }

// ---------------------------------------------------------------- un día
export function paso(E) {
  const R = azar(hash(E.semilla, E.dia + 1)); E.dia++; climaDia(E, R);
  for (const p of E.camas) if (p && p.viva) diaPlanta(E, R, p);
}
function diaPlanta(E, R, p) {
  const c = CULTIVOS[p.cult], t = E.clima.T, k = etapaDe(p);
  p.dia++; p.dias++;
  // agua: llueve, se evapora (más con calor, sol y planta grande), y si sobra se encharca
  if (E.clima.lluvia) p.agua += E.clima.lluvia * 0.8;
  p.agua -= (3 + p.bio * 6) * c.agua * cl(t / 20, 0.5, 1.6) * (p.luz === 'sol' ? 1 : 0.7);
  if (p.agua > 72) p.agua -= (p.agua - 72) * 0.45;   // drenaje: lo que pasa de la capacidad del suelo se filtra hacia abajo
  p.exceso = p.agua > 86 ? p.exceso + 1 : Math.max(0, p.exceso - 1);
  p.agua = cl(p.agua, 0, 100);
  if (E.clima.lluvia > 15) { p.N = Math.max(0, p.N - 1.2); p.K = Math.max(0, p.K - 0.6); }   // la lluvia lava nutrientes
  const fa = fAgua(p.agua), ft = fTemp(c, t), fn = fNutr(c, p), fl = fLuz(c, p, t), fph = fPh(c, p), fs = 0.35 + 0.65 * p.salud / 100;
  const vigor = fa * ft * fn * fl * fph * fs;
  // estrés y salud
  const malo = [];
  if (fa < 0.5) malo.push(p.agua < 35 ? 'sed' : 'encharcado'); if (ft < 0.5) malo.push(t < c.temp[1] ? 'frio' : 'calor'); if (fn < 0.5) malo.push('hambre'); if (fph < 0.8) malo.push('ph');
  p.estres = cl(p.estres * 0.85 + (1 - Math.min(fa, ft, fn)) * 0.3);
  let dS = vigor > 0.7 ? 0.6 : 0;
  if (p.agua < 15) dS -= 4; else if (p.agua < 28) dS -= 1.2;
  if (ft < 0.2) dS -= 3; else if (ft < 0.5) dS -= 0.8;
  if (p.exceso > 4) { dS -= 1.5; if (R() < 0.08) p.hongo = Math.max(p.hongo, 0.15); }
  if (fn < 0.35) dS -= 0.6;
  if (p.plaga) dS -= p.plaga.nivel * 2.5; if (p.hongo) dS -= p.hongo * 2.2;
  if (p.acame) dS -= 0.4;
  p.salud = cl(p.salud + dS, 0, 100); p.saludSum += p.salud; if (p.salud > 70) p.sano++;
  // lecciones según lo que pase
  if (p.agua < 15) { leccion(E, 'sed', 'Sin agua la planta se marchita y se muere en pocos días; el suelo seco a 3 cm de profundidad es señal de regar.'); p.errores.push('sed'); }
  if (p.exceso > 6) { leccion(E, 'encharcar', 'Regar de más encharca el suelo: las raíces se ahogan y aparecen hongos. Riega cuando la superficie esté seca.'); p.errores.push('exceso de agua'); }
  if (ft < 0.3) { leccion(E, `clima_${p.cult}`, `${c.n} no se da bien en clima ${PISOS[E.piso].n.toLowerCase()}: necesita ${c.temp[1]}–${c.temp[2]} °C.`); p.errores.push('clima'); }
  if (fph < 0.8) leccion(E, 'ph', 'Con el pH fuera de rango la planta no puede absorber los nutrientes aunque estén en el suelo (cal sube el pH, azufre lo baja).');
  // muerte
  if (p.salud <= 0) { p.viva = false; p.causa = malo[0] === 'sed' ? 'se secó' : malo[0] === 'encharcado' ? 'pudrición de raíz' : malo[0] === 'frio' ? 'el frío' : malo[0] === 'calor' ? 'el calor' : p.plaga ? `la plaga (${PLAGAS[p.plaga.tipo].n.toLowerCase()})` : p.hongo > 0.3 ? 'hongos' : 'debilidad'; log(E, `🥀 Murió el ${c.n} de la cama ${p.cama + 1}: ${p.causa}.`, 'malo', p.cama); efecto(E, 'muere', p.cama); cerrar(E, p, `murió: ${p.causa}`); return; }
  // desarrollo: avanza de etapa (más lento con estrés)
  const dur = c.ciclo[k] || 0, dev = 0.35 + 0.65 * Math.min(fa, ft, 1) * (0.6 + 0.4 * fn);
  if (k !== 'cosecha' && dur > 0) { p.prog += dev / dur; if (p.prog >= 1) avanzarEtapa(E, p, c); }
  else if (k !== 'cosecha' && !dur) avanzarEtapa(E, p, c);
  // crecimiento (biomasa y altura) y consumo de nutrientes
  const crece = 0.018 * vigor * (k === 'germ' ? 0.3 : k === 'fruto' ? 0.5 : 1);
  p.bio = cl(p.bio + crece * (1 - p.bio * 0.85), 0, 1.2);
  const hMax = altoMax(c); p.altura = Math.min(hMax, p.altura + crece * hMax * 1.4 * (p.tutor || hMax < 0.8 ? 1 : 0.9));
  const w = necesidad(c, p); p.N = Math.max(0, p.N - w[0] * (0.35 + crece * 18) * (c.fijaN ? 0.35 : 1)); p.P = Math.max(0, p.P - w[1] * (0.25 + crece * 12)); p.K = Math.max(0, p.K - w[2] * (0.3 + crece * 14));
  if (c.fijaN && k !== 'germ') p.N = Math.min(100, p.N + 0.25);   // las leguminosas fijan nitrógeno del aire
  // poda: brotes que roban fuerza
  if (c.poda !== 'ninguna' && ['veg', 'flor', 'fruto', 'cosecha'].includes(k) && R() < (c.poda === 'chupones' || c.poda === 'estolones' ? 0.2 : 0.08)) p.chupones = Math.min(12, p.chupones + 1);
  // tutor: las que lo necesitan se caen al crecer
  if (c.tutor && !p.tutor && !p.acame && p.altura > 0.5 && R() < 0.05) { p.acame = true; log(E, `🪵 El ${c.n} de la cama ${p.cama + 1} se acostó en el suelo por falta de tutor: sus frutos se pudren al tocar la tierra.`, 'malo', p.cama); p.errores.push('sin tutor'); leccion(E, 'tutor', `Las plantas como el ${c.n.toLowerCase()} necesitan tutor (estaca, malla o cuerda) antes de crecer.`); }
  // plagas y hongos
  const pr = 0.004 + p.estres * 0.02 + (E.clima.temporada === 'lluvias' ? 0.004 : 0) + p.chupones * 0.0015 + (p.acame ? 0.004 : 0);
  if (!p.plaga && k !== 'germ' && R() < pr) { const tipos = c.plagas.filter((x) => x !== 'hongo'); if (tipos.length) { const tp = tipos[Math.floor(R() * tipos.length)]; p.plaga = { tipo: tp, nivel: 0.08 }; log(E, `${PLAGAS[tp].e} Apareció ${PLAGAS[tp].n.toLowerCase()} en el ${c.n} de la cama ${p.cama + 1}: ${PLAGAS[tp].d}`, 'malo', p.cama); efecto(E, 'plaga', p.cama); } }
  if (p.plaga) p.plaga.nivel = cl(p.plaga.nivel + 0.025 + p.estres * 0.02 + (p.plaga.tipo === 'acaro' && t > 24 && !E.clima.lluvia ? 0.02 : 0) + (p.plaga.tipo === 'babosa' && E.clima.lluvia ? 0.02 : 0));
  if (c.plagas.includes('hongo') && (p.exceso > 2 || (E.clima.lluvia && p.chupones > 3)) && R() < 0.05) p.hongo = Math.max(p.hongo, 0.1);
  if (p.hongo) p.hongo = cl(p.hongo + (p.exceso > 2 || E.clima.lluvia ? 0.025 : -0.01) + p.chupones * 0.002);
  // flores y frutos
  floresYFrutos(E, R, p, c, vigor, ft);
  // hojas: listas para cosechar; con calor se espigan
  if (c.cosecha === 'hojas' && k === 'cosecha') { p.prod = cl(p.prod + 0.01); if (t > c.temp[2] && R() < 0.03 && !p.espigada) { p.espigada = true; log(E, `🌾 El ${c.n} de la cama ${p.cama + 1} se espigó (floreció por el calor): sus hojas se ponen duras y amargas. Cosecha ya.`, 'malo', p.cama); leccion(E, 'espigar', 'Las hortalizas de hoja se espigan con calor o si no se cosechan a tiempo: pierden calidad.'); } }
}
function altoMax(c) { return { tallo: 1.6, trepadora: 1.9, roseta: 0.3, graminea: 2.1, raiz: 0.5, arbol: 3.2, platano: 3.4, rastrera: 0.6, girasol: 2.2, arbusto: 0.9 }[c.forma] || 1; }
function avanzarEtapa(E, p, c) {
  const k0 = etapaDe(p); let i = p.etapa + 1;
  while (i < 5 && !(c.ciclo[ORDEN[i]] > 0)) i++;
  p.etapa = Math.min(5, i); p.prog = 0;
  const k = etapaDe(p);
  if (k !== k0) { log(E, `${nombreEtapa(k).split(' ')[0]} El ${c.n} de la cama ${p.cama + 1} pasa a ${nombreEtapa(k).replace(/^\S+ /, '').toLowerCase()}.`, k === 'cosecha' ? 'logro' : '', p.cama); efecto(E, 'etapa', p.cama, { k }); }
  if (k === 'cosecha' && (c.cosecha === 'unica' || c.cosecha === 'hojas')) log(E, `🧺 ¡El ${c.n} de la cama ${p.cama + 1} está listo para cosechar! ${c.guia.cosecha}`, 'logro', p.cama);
}
function floresYFrutos(E, R, p, c, vigor, ft) {
  const k = etapaDe(p);
  if (c.cosecha === 'hojas') return;
  const [, Pd, Kd] = disponible(p), excesoN = p.N > 75 && (k === 'flor' || k === 'fruto');
  if (excesoN) { leccion(E, 'excesoN', 'Demasiado nitrógeno en floración da mucha hoja y poco fruto: en esa etapa la planta pide fósforo y potasio.'); if (R() < 0.05) p.errores.push('exceso de nitrógeno'); }
  const poda = 1 - Math.min(0.45, p.chupones * 0.04);
  if (k === 'flor' || (k === 'fruto' && c.cosecha === 'continua') || (k === 'cosecha' && c.cosecha === 'continua')) {
    p.flores = cl(p.flores + vigor * 0.25 * (0.4 + Pd) - 0.05, 0, 14);
    if (p.flores > 1 && R() < 0.12 * vigor * (0.5 + Pd) * (excesoN ? 0.4 : 1) * poda * ft) { p.flores -= 1; const max = c.cosecha === 'unica' ? (c.forma === 'graminea' || c.forma === 'girasol' || c.forma === 'platano' ? 1 : 4) : 18; if (p.frutos.length < max) p.frutos.push({ m: 0, t: 0.25, d: E.dia, caido: p.acame }); }
  }
  if (c.subterraneo && (k === 'veg' || k === 'flor' || k === 'fruto') && p.frutos.length < (c.nSub || 6) && R() < 0.1 * vigor) p.frutos.push({ m: 0, t: 0.3, d: E.dia, sub: true });
  // los frutos engordan (potasio, agua) y maduran
  const dF = c.ciclo.fruto || 30;
  for (const f of p.frutos) {
    if (f.m < 1) { f.m = Math.min(1, f.m + (1 / dF) * (0.4 + 0.6 * ft)); f.t = Math.min(1.3, f.t + 0.02 * vigor * (0.4 + Kd) * poda * (p.agua > 30 ? 1 : 0.4)); if (p.agua > 92 && R() < 0.01 && !f.sub) { f.rajado = true; leccion(E, 'rajado', 'Los riegos irregulares (seco y luego mucha agua) rajan los frutos.'); } }
    else { f.listo = (f.listo || 0) + 1; if (!f.sub && f.listo > (c.cosecha === 'continua' ? 10 : 25)) f.podrido = true; }
    if (p.acame && !f.sub && R() < 0.02) f.podrido = true;
  }
  const antes = p.frutos.length; p.frutos = p.frutos.filter((f) => !f.podrido);
  if (antes > p.frutos.length) { p.podrido += antes - p.frutos.length; if (R() < 0.3) log(E, `🪰 Se pudrieron ${antes - p.frutos.length} ${c.unidad} del ${c.n} (cama ${p.cama + 1}) por no cosechar a tiempo${p.acame ? ' o por estar en el suelo' : ''}.`, 'malo', p.cama); leccion(E, 'cosechaTarde', 'Si no cosechas a tiempo, los frutos se pudren y la planta produce menos.'); }
  // fin del ciclo: las continuas se agotan; las perennes rebrotan
  if (c.cosecha === 'continua' && k === 'cosecha' && (p.dia > ciclos(c).reduce((s, x) => s + c.ciclo[x], 0) + 100 || p.salud < 15) && !p.agotada) { p.agotada = true; log(E, `🍂 El ${c.n} de la cama ${p.cama + 1} terminó su vida productiva. Arráncalo y siembra otra cosa (rota el cultivo).`, '', p.cama); }
  if (k === 'fruto' && c.cosecha !== 'continua' && p.frutos.length && p.frutos.every((f) => f.m >= 1)) avanzarEtapa(E, p, c);
  if (k === 'fruto' && c.cosecha === 'continua' && p.frutos.some((f) => f.m >= 1)) avanzarEtapa(E, p, c);
}

// ---------------------------------------------------------------- tus cuidados
const PLANTA = (E, cama) => { const p = E.camas[cama]; if (!p) return [null, 'No hay planta en esa cama.']; if (!p.viva) return [null, 'Esa planta murió: arráncala.']; return [p, null]; };
export function regar(E, cama, cant = 'normal') {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult], antes = p.agua, q = { poco: 12, normal: 25, mucho: 45 }[cant] || 25;
  p.agua = Math.min(100, p.agua + q); p.riegos++; efecto(E, 'riego', cama, { q });
  let msg = `💧 Regaste el ${c.n}.`;
  if (antes > 75) { msg = `💧 El suelo ya estaba húmedo (${Math.round(antes)} %): no hacía falta regar. Cuidado con encharcar.`; p.errores.push('riego innecesario'); }
  else if (antes < 30) msg = `💧 ¡Justo a tiempo! El suelo estaba seco (${Math.round(antes)} %).`;
  if (E.clima.lluvia > 10) leccion(E, 'lluvia', 'Cuando llueve no hace falta regar: revisa la humedad del suelo antes.');
  return { ok: msg };
}
export function abonar(E, cama, tipo) {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult], A = ABONOS[tipo]; if (!A) return { err: 'Abono desconocido.' };
  const k = etapaDe(p), w = necesidad(c, p);
  p.N = Math.min(140, p.N + A.npk[0] * 100); p.P = Math.min(140, p.P + A.npk[1] * 100); p.K = Math.min(140, p.K + A.npk[2] * 100); p.ph = cl(p.ph + A.ph, 4, 9); p.abonos++; efecto(E, 'abono', cama, { tipo });
  let msg = `${A.e} Abonaste el ${c.n} con ${A.n.toLowerCase()}.`;
  // exceso: quema raíces
  if (p.N > 120 || p.P > 120 || p.K > 120) { p.salud = Math.max(0, p.salud - 12); msg += ' ⚠️ Te pasaste: el exceso de abono quema las raíces.'; p.errores.push('exceso de abono'); leccion(E, 'quema', 'Más abono no es mejor: el exceso quema las raíces. Abona poco y seguido.'); }
  const mayor = A.npk.indexOf(Math.max(...A.npk)), pide = w.indexOf(Math.max(...w));
  if (tipo === 'nitrogeno' && (k === 'flor' || k === 'fruto')) msg += ' En esta etapa pide más fósforo y potasio que nitrógeno.';
  else if (A.npk[mayor] > 0.3 && mayor === pide) msg += ` 👍 Es lo que más necesita ahora (${['nitrógeno', 'fósforo', 'potasio'][pide]}).`;
  if (tipo === 'cal') msg += ` pH: ${p.ph.toFixed(1)} (ideal ${c.ph[0]}–${c.ph[1]}).`; if (tipo === 'azufre') msg += ` pH: ${p.ph.toFixed(1)} (ideal ${c.ph[0]}–${c.ph[1]}).`;
  return { ok: msg };
}
export function podar(E, cama) {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult];
  if (c.poda === 'ninguna') { p.salud = Math.max(0, p.salud - 5); p.errores.push('poda innecesaria'); return { ok: `✂️ El ${c.n} no necesita poda: le quitaste hojas que le servían.` }; }
  const n = p.chupones; p.chupones = 0; p.podas++; if (p.hongo) p.hongo = Math.max(0, p.hongo - 0.15); efecto(E, 'poda', cama);
  const que = { chupones: 'los chupones', estolones: 'los estolones', despunte: 'las puntas y las flores', deshije: 'los hijos sobrantes', guia: 'los brotes laterales', formacion: 'las ramas mal ubicadas' }[c.poda];
  if (n) leccion(E, `poda_${c.poda}`, `${c.guia.poda}`);
  return { ok: n ? `✂️ Podaste ${que} del ${c.n} (${n}). Ahora la planta concentra la fuerza en dar fruto y ventila mejor.` : `✂️ No había mucho que podar todavía.` };
}
export function tutorar(E, cama) {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult];
  if (p.tutor) return { err: 'Ya tiene tutor.' }; p.tutor = true; if (p.acame) { p.acame = false; p.salud = Math.max(0, p.salud - 5); } efecto(E, 'tutor', cama);
  return { ok: c.tutor ? `🪵 Pusiste tutor al ${c.n}. ${c.guia.poda}` : `🪵 Pusiste tutor, aunque el ${c.n} no lo necesita mucho.` };
}
export function tratar(E, cama, rem) {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult], T = REMEDIOS[rem]; if (!T) return { err: 'Remedio desconocido.' };
  p.tratamientos++; efecto(E, 'trata', cama, { rem });
  const sirveP = p.plaga && T.contra.includes(p.plaga.tipo), sirveH = p.hongo > 0 && T.contra.includes('hongo');
  if (sirveP) { p.plaga.nivel -= T.fuerza; if (p.plaga.nivel <= 0.02) { const pl = PLAGAS[p.plaga.tipo]; p.plaga = null; leccion(E, `rem_${rem}_${pl.n}`, `${T.n} sirve contra ${pl.n.toLowerCase()}.`); return { ok: `${T.e} ¡Controlaste ${pl.n.toLowerCase()} con ${T.n.toLowerCase()}!` }; } }
  if (sirveH) { p.hongo = Math.max(0, p.hongo - T.fuerza); if (!p.hongo) leccion(E, 'hongo', 'Los hongos se controlan con caldo bordelés y, sobre todo, evitando el exceso de agua y podando para ventilar.'); }
  if (!p.plaga && !p.hongo) { p.salud = Math.max(0, p.salud - 2); return { ok: `${T.e} La planta no tenía plagas: fumigar sin necesidad gasta y estresa la planta.` }; }
  if (!sirveP && !sirveH) { const que = p.plaga ? PLAGAS[p.plaga.tipo].n.toLowerCase() : 'el hongo'; leccion(E, `noSirve_${rem}`, `${T.n}: ${T.d}`); return { ok: `${T.e} ${T.n} no sirve contra ${que}. ${T.d}` }; }
  return { ok: `${T.e} Aplicaste ${T.n.toLowerCase()}: la plaga bajó. Repite en unos días.` };
}
export function cambiarLuz(E, cama) { const [p, err] = PLANTA(E, cama); if (err) return { err }; p.luz = p.luz === 'sol' ? 'sombra' : 'sol'; const c = CULTIVOS[p.cult]; return { ok: p.luz === 'sombra' ? `⛱️ Pusiste polisombra al ${c.n}. ${c.luz === 'pleno' ? 'Ojo: necesita sol pleno.' : 'Le gusta la media sombra.'}` : `☀️ El ${c.n} queda a pleno sol.` }; }
export function cosechar(E, cama) {
  const [p, err] = PLANTA(E, cama); if (err) return { err }; const c = CULTIVOS[p.cult], k = etapaDe(p);
  let kg = 0, n = 0;
  if (c.cosecha === 'hojas') {
    if (k !== 'cosecha' && p.bio < 0.35) return { err: 'Todavía está muy pequeña: espera a que crezca.' };
    kg = c.pesoFruto * (0.4 + p.bio) * (p.espigada ? 0.5 : 1) * (0.5 + p.salud / 200); n = 1;
    if (c.n === 'Lechuga' || c.n === 'Espinaca' || c.n === 'Cilantro' || c.n === 'Albahaca' || c.n === 'Cebolla larga') { p.bio *= 0.45; p.etapa = Math.min(p.etapa, 2); p.prog = 0.5; p.espigada = false; }
  } else {
    if (c.cosecha !== 'continua' && k !== 'cosecha') return { err: `Aún no: ${c.guia.cosecha}` };
    const listos = p.frutos.filter((f) => f.m >= 1 || (c.cosecha !== 'continua' && f.m > 0.85));
    if (!listos.length) return { err: p.frutos.length ? 'Los frutos aún no están maduros.' : 'Todavía no hay nada para cosechar.' };
    for (const f of listos) { kg += c.pesoFruto * f.t * (f.rajado ? 0.6 : 1); n++; }
    p.frutos = p.frutos.filter((f) => !listos.includes(f));
    if (c.subterraneo || c.cosecha === 'unica') { kg *= 1 + p.bio * 0.5; }
  }
  kg = Math.round(kg * 1000) / 1000; p.cosechado += kg; p.nCosechas++; efecto(E, 'cosecha', cama, { n });
  E.cosechas.unshift({ d: E.dia, cult: p.cult, kg, n }); if (E.cosechas.length > 100) E.cosechas.length = 100;
  log(E, `🧺 Cosechaste ${n} ${c.unidad} de ${c.n} (${kg >= 1 ? `${kg.toFixed(2)} kg` : `${Math.round(kg * 1000)} g`}). Total: ${p.cosechado.toFixed(2)} kg.`, 'logro', cama);
  // las de cosecha única terminan; los árboles rebrotan para la próxima temporada
  if (c.cosecha === 'unica' && !c.perenne) { cerrar(E, p, 'cosechada'); E.camas[cama] = null; return { ok: `🧺 ¡Cosecha completa! ${n} ${c.unidad}: ${kg.toFixed(2)} kg. La cama queda libre.`, fin: true }; }
  if (c.perenne && p.frutos.length === 0) { p.etapa = ORDEN.indexOf('veg'); p.prog = 0.6; p.ciclosPerenne++; }
  return { ok: `🧺 Cosechaste ${n} ${c.unidad} (${kg >= 1 ? `${kg.toFixed(2)} kg` : `${Math.round(kg * 1000)} g`}).` };
}

// ---------------------------------------------------------------- diagnóstico: qué le pasa y qué hacer
export function diagnostico(E, cama) {
  const p = E.camas[cama]; if (!p) return []; const c = CULTIVOS[p.cult], k = etapaDe(p), L = [], t = E.clima.T, w = necesidad(c, p), d = disponible(p);
  if (!p.viva) return [['mal', `🥀 Murió por ${p.causa}. Arráncala y vuelve a intentar con lo aprendido.`]];
  if (p.agua < 30) L.push(['mal', `💧 Suelo seco (${Math.round(p.agua)} %): las hojas se ponen mustias. Riega ya.`, 'regar']);
  else if (p.agua > 86) L.push(['mal', `🌊 Suelo encharcado (${Math.round(p.agua)} %): las raíces se ahogan y vienen hongos. No riegues por unos días.`]);
  else if (p.agua < 45 && !E.clima.lluvia) L.push(['ojo', `💧 El suelo se está secando (${Math.round(p.agua)} %): pronto habrá que regar.`]);
  const nom = ['nitrógeno', 'fósforo', 'potasio'], sint = ['hojas de abajo amarillas y crecimiento lento', 'pocas flores, raíces débiles y hojas moradas', 'frutos pequeños y bordes de las hojas quemados'], abn = ['nitrogeno', 'fosforo', 'potasio'];
  for (let i = 0; i < 3; i++) if (d[i] < 0.25 * w[i] + 0.12 && k !== 'germ') L.push(['mal', `🧪 Falta ${nom[i]}: ${sint[i]}. Abona con ${ABONOS[abn[i]].n.toLowerCase()} o compost.`, abn[i]]);
  if (p.N > 75 && (k === 'flor' || k === 'fruto')) L.push(['ojo', '🟢 Mucho nitrógeno en floración: dará mucha hoja y poco fruto. No le eches más nitrógeno.']);
  if (fPh(c, p) < 1) L.push(['ojo', `⚗️ pH ${p.ph.toFixed(1)} fuera del ideal (${c.ph[0]}–${c.ph[1]}): ${p.ph < c.ph[0] ? 'echa cal agrícola' : 'echa azufre'} para que pueda absorber los nutrientes.`, p.ph < c.ph[0] ? 'cal' : 'azufre']);
  const ft = fTemp(c, t); if (ft < 0.6) L.push(['ojo', `🌡️ ${t < c.temp[1] ? 'Hace frío' : 'Hace calor'} para el ${c.n.toLowerCase()} (${t} °C; ideal ${c.temp[1]}–${c.temp[2]} °C). En tu piso térmico ${PISOS[E.piso].n.toLowerCase()} le cuesta.`]);
  if (c.luz === 'pleno' && p.luz === 'sombra') L.push(['ojo', '⛱️ Necesita sol pleno: quítale la polisombra.', 'luz']);
  if (c.luz === 'media' && p.luz === 'sol' && t > c.temp[2] - 1) L.push(['ojo', '☀️ El sol fuerte la estresa: ponle media sombra.', 'luz']);
  if (c.tutor && !p.tutor && p.altura > 0.3) L.push([p.acame ? 'mal' : 'ojo', p.acame ? '🪵 Está acostada en el suelo: ponle tutor.' : '🪵 Ya necesita tutor antes de que se caiga.', 'tutor']);
  if (c.poda !== 'ninguna' && p.chupones >= 3) L.push(['ojo', `✂️ Tiene ${p.chupones} brotes por podar (${c.poda}): le roban fuerza al fruto y quitan ventilación.`, 'podar']);
  if (p.plaga) { const pl = PLAGAS[p.plaga.tipo], rs = Object.entries(REMEDIOS).filter(([, r]) => r.contra.includes(p.plaga.tipo)).sort((a, b) => b[1].fuerza - a[1].fuerza).slice(0, 2); L.push(['mal', `${pl.e} ${pl.n} (${Math.round(p.plaga.nivel * 100)} %): ${pl.d} Usa ${rs.map(([, r]) => r.n.toLowerCase()).join(' o ')}.`, 'tratar']); }
  if (p.hongo > 0.05) L.push(['mal', `🍄 Hongos (${Math.round(p.hongo * 100)} %): menos riego, poda para ventilar y caldo bordelés.`, 'tratar']);
  const listos = c.cosecha === 'continua' || c.cosecha === 'temporada' ? p.frutos.filter((f) => f.m >= 1).length : 0;
  if (listos) L.push(['bien', `🧺 Hay ${listos} ${c.unidad} listos para cosechar.`, 'cosechar']);
  if (k === 'cosecha' && (c.cosecha === 'hojas' || c.cosecha === 'unica') && !listos) L.push(['bien', `🧺 Lista para cosechar. ${c.guia.cosecha}`, 'cosechar']);
  if (p.agotada) L.push(['ojo', '🍂 Terminó su vida productiva: arráncala y rota el cultivo.']);
  if (!L.some((x) => x[0] !== 'bien')) L.unshift(['bien', `✅ El ${c.n.toLowerCase()} está sano. ${k === 'germ' ? 'Está germinando: mantén el suelo húmedo.' : 'Sigue así.'}`]);
  return L;
}
// ¿qué se da en este piso térmico?
export function aptitudPiso(piso) { const t = PISOS[piso].t; return Object.entries(CULTIVOS).map(([k, c]) => [k, fTemp(c, t)]).sort((a, b) => b[1] - a[1]); }
export function exportar(E) { return JSON.parse(JSON.stringify(E)); }
export function importar(o) { return o && o.v === 1 && Array.isArray(o.camas) ? o : null; }
