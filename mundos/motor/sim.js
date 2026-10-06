// =====================================================================
// Motor genérico de mundos en miniatura.
// Un mundo es una FICHA (datos + algunas funciones): lugares, necesidades, acciones, rasgos,
// personajes, trabajos y eventos. El motor no sabe nada de ciudades, zombis ni guerras:
// solo hace vivir a los personajes según lo que diga la ficha.
//   - cada personaje tiene necesidades que bajan con el tiempo (según sus rasgos)
//   - cuando queda libre, elige la acción más útil (necesidades, gustos, horario, plata, distancia)
//   - va caminando al lugar (por la acera), la hace, y la acción cambia sus necesidades y recursos
//   - se relacionan: conversan, se hacen amigos, discuten, se enamoran
//   - el jugador decide en los dilemas que plantea la ficha
// =====================================================================
export const MIN_DIA = 1440;

// ---------------------------------------------------------------- azar reproducible
export function rng(s) { s.rng = (s.rng * 1664525 + 1013904223) >>> 0; return s.rng / 4294967296; }
const elegir = (s, arr) => arr[Math.floor(rng(s) * arr.length)];
export const dia = (s) => Math.floor(s.t / MIN_DIA);
export const hora = (s) => (s.t % MIN_DIA) / 60;
export const diaSemana = (s) => dia(s) % 7;   // 0 = lunes … 6 = domingo
const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export function fechaTxt(s) { const h = hora(s); return `Día ${dia(s) + 1} · ${NOMBRE_DIA[diaSemana(s)]} · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- mundo nuevo
export function crearMundo(F, { semilla = Date.now(), inicio = 7 * 60 } = {}) {
  const s = {
    mundo: F.id, version: F.version || 1, rng: semilla >>> 0, t: inicio, t0: inicio,
    agentes: F.personajes.map((p) => nuevoAgente(F, p)),
    hogares: Object.fromEntries((F.hogares || []).map((h) => [h.id, { dinero: h.dinero ?? 500, despensa: h.despensa ?? 10, limpieza: 80, ruido: 0, deuda: 0 }])),
    rel: {}, diario: [], dilemas: [], sigDilema: 1, enfriar: {}, efectos: [], stats: {}, clima: { lluvia: false }, banderas: {}, jugador: { influencia: 3, max: 6, decididas: 0 },
  };
  for (const [a, b, v] of F.relacionesIniciales || []) Object.assign(relacion(s, a, b), typeof v === 'object' ? v : { afinidad: v }, { conocidos: true });
  F.alCrear?.(s, API(F));
  log(s, F.textoInicio || `Empieza la vida en ${F.nombre}.`, 'info');
  return s;
}
function nuevoAgente(F, p) {
  const n = Object.fromEntries(Object.entries(F.necesidades).map(([k, N]) => [k, N.inicial ?? 75]));
  const L = F.lugares.find((l) => l.id === (p.empieza || p.hogarLugar || F.hogares?.find((h) => h.id === p.hogar)?.lugar));
  return {
    id: p.id, nombre: p.nombre, especie: p.especie || 'persona', sexo: p.sexo, edad: p.edad, rasgos: [...(p.rasgos || [])], hogar: p.hogar, trabajo: p.trabajo ? { ...p.trabajo, faltas: 0 } : null,
    n, animo: 70, salud: 100, vivo: true, recuerdos: [], lugar: L ? L.id : null, pos: L ? { ...L.entrada } : { x: 0, z: 0 },
    tarea: null, ruta: null, accion: 'Despertando', duenos: p.duenos || null,
  };
}

// ---------------------------------------------------------------- relaciones (simétricas)
const claveRel = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export function relacion(s, a, b) { const k = claveRel(a, b); return (s.rel[k] ||= { afinidad: 0, pareja: false, romance: 0, conocidos: false, ultima: -1e9 }); }
export const afinidad = (s, a, b) => s.rel[claveRel(a, b)]?.afinidad ?? 0;

// ---------------------------------------------------------------- diario y recuerdos
export function log(s, texto, tipo = 'info', quien = null) { s.diario.unshift({ t: s.t, texto, tipo, quien }); if (s.diario.length > 300) s.diario.length = 300; }
export function recuerdo(s, a, texto, valor, horas = 12) {
  if (!a || a.especie !== 'persona') return;
  const r = a.recuerdos.find((x) => x.texto === texto);
  if (r) { r.hasta = s.t + horas * 60; r.valor = valor; } else a.recuerdos.push({ texto, valor, hasta: s.t + horas * 60 });
  if (a.recuerdos.length > 30) a.recuerdos.shift();
}
function efecto(s, tipo, x, z, extra = {}) { s.efectos.push({ tipo, x, z, t: s.t, ...extra }); if (s.efectos.length > 30) s.efectos.shift(); }

// ---------------------------------------------------------------- rasgos
export const mod = (F, a, clave) => a.rasgos.reduce((m, r) => m * (F.rasgos[r]?.mod?.[clave] ?? 1), 1);
export const tiene = (F, a, r) => a.rasgos.includes(r);

// ---------------------------------------------------------------- lugares y caminos (por la acera)
export const lugar = (F, id) => F.lugares.find((l) => l.id === id);
function proyectarAcera(F, p) {   // posición (u) sobre la acera cerrada más cercana a p
  const A = F.acera, L = A.length; let mejor = null, acum = 0;
  for (let i = 0; i < L; i++) {
    const a = A[i], b = A[(i + 1) % L], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, l = Math.sqrt(l2);
    const u = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    const d = Math.hypot(p.x - a.x - dx * u, p.z - a.z - dz * u);
    if (!mejor || d < mejor.d) mejor = { d, u: acum + u * l, x: a.x + dx * u, z: a.z + dz * u };
    acum += l;
  }
  return { ...mejor, total: acum };
}
function puntoAcera(F, u) {
  const A = F.acera, L = A.length; let acum = 0;
  for (let i = 0; i < L; i++) { const a = A[i], b = A[(i + 1) % L], l = Math.hypot(b.x - a.x, b.z - a.z); if (u <= acum + l) { const k = l ? (u - acum) / l : 0; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }; } acum += l; }
  return { ...A[0] };
}
// ruta de un punto a otro: salir a la acera, caminar por el lado más corto y entrar
export function planRuta(F, desde, hasta) {
  if (!F.acera) return [hasta];
  const a = proyectarAcera(F, desde), b = proyectarAcera(F, hasta), T = a.total;
  let d = b.u - a.u; if (Math.abs(d) > T / 2) d -= Math.sign(d) * T;
  const pasos = [{ x: a.x, z: a.z }], n = Math.ceil(Math.abs(d) / 3);
  for (let i = 1; i < n; i++) pasos.push(puntoAcera(F, ((a.u + (d * i) / n) % T + T) % T));
  pasos.push({ x: b.x, z: b.z }, { ...hasta });
  return pasos;
}
const largoRuta = (desde, pasos) => pasos.reduce((t, p, i) => t + Math.hypot(p.x - (i ? pasos[i - 1].x : desde.x), p.z - (i ? pasos[i - 1].z : desde.z)), 0);
const abierto = (F, s, L) => { if (!L.horario) return true; const h = hora(s), [a, b] = L.horario; return (b > 24 ? h >= a || h < b - 24 : h >= a && h < b) && (!L.dias || L.dias.includes(diaSemana(s))); };   // (horarios que pasan la medianoche: [16, 26])

// ---------------------------------------------------------------- lo que la ficha puede usar en sus funciones
const API = (F) => ({ rng, elegir, dia, hora, diaSemana, log, recuerdo, relacion, afinidad, hacer: (s, a, accion, lugarId, extra) => hacer(F, s, a, accion, lugarId, extra), mod: (a, k) => mod(F, a, k), tiene: (a, r) => tiene(F, a, r), lugar: (id) => lugar(F, id), proponer: (s, d) => proponer(s, d), efecto, hogarDe: (s, a) => s.hogares[a.hogar], agente: (s, id) => s.agentes.find((x) => x.id === id) });

// ---------------------------------------------------------------- tiempo
export function avanzar(F, s, minutos) {
  if (!(minutos > 0)) return;
  const api = API(F);
  while (minutos > 1e-9) {
    const d = Math.min(1, minutos); minutos -= d;
    try { tick(F, s, d, api); } catch (e) { s.errores = (s.errores || 0) + 1; s.ultimoError = String(e?.stack || e).slice(0, 300); if (s.errores < 3) console.warn('[mundo] error, sigue:', e); for (const a of s.agentes) { a.tarea = null; a.ruta = null; } s.t += d; }
  }
}
function tick(F, s, d, api) {
  const diaAntes = dia(s), horaAntes = Math.floor(hora(s));
  s.t += d;
  if (dia(s) !== diaAntes) nuevoDia(F, s, api);
  if (Math.floor(hora(s)) !== horaAntes) { F.cadaHora?.(s, api); revisarDilemas(F, s, api); }
  for (const a of s.agentes) if (a.vivo) { necesidades(F, s, a, d); comportamiento(F, s, a, d, api); }
  if (s.efectos.length && s.t - s.efectos[0].t > 10) s.efectos = s.efectos.filter((e) => s.t - e.t < 10);
}
function nuevoDia(F, s, api) {
  for (const a of s.agentes) { a.recuerdos = a.recuerdos.filter((r) => r.hasta > s.t); }
  for (const h of Object.values(s.hogares)) h.limpieza = clamp(h.limpieza - 6);
  F.cadaDia?.(s, api);
  for (const E of F.eventos || []) if ((!E.cuando || E.cuando(s, api)) && rng(s) < (E.prob ?? 0.05) && !(s.enfriar[E.id] > s.t)) { s.enfriar[E.id] = s.t + (E.enfria ?? 3) * MIN_DIA; E.pasa(s, api); }
}

// ---------------------------------------------------------------- necesidades y ánimo
function necesidades(F, s, a, d) {
  const T = a.tarea, k = d / 60;
  for (const [nk, N] of Object.entries(F.necesidades)) {
    if (N.especies && !N.especies.includes(a.especie)) continue;
    const durmiendo = T && T.fase === 'haciendo' && F.acciones[T.accion]?.duerme;
    let baja = (N.baja ?? 3) * mod(F, a, 'baja_' + nk) * (durmiendo && N.dormido != null ? N.dormido : 1);
    a.n[nk] = clamp(a.n[nk] - baja * k);
  }
  // la acción en curso sube (o baja) necesidades mientras se hace
  if (T && T.fase === 'haciendo') {
    const A = F.acciones[T.accion];
    for (const [nk, v] of Object.entries(A.efectos || {})) if (a.n[nk] != null) a.n[nk] = clamp(a.n[nk] + v * k * (v > 0 ? mod(F, a, 'gusto_' + T.accion) : 1));
  }
  // salud: sufre si una necesidad vital llega a cero
  let ds = 0; for (const [nk, N] of Object.entries(F.necesidades)) if (N.vital && a.n[nk] != null && a.n[nk] <= 0) ds -= N.vital;
  a.salud = clamp(a.salud + (ds || (a.salud < 100 ? 0.4 : 0)) * k);
  if (a.salud <= 0) { a.vivo = false; a.accion = 'Murió'; log(s, `${a.nombre} murió.`, 'muerte'); }
  // ánimo: necesidades + recuerdos
  if (a.especie === 'persona') {
    const ns = Object.entries(F.necesidades).filter(([nk, N]) => a.n[nk] != null && !N.noAnimo);
    const base = ns.reduce((t, [nk]) => t + a.n[nk], 0) / Math.max(1, ns.length);
    const recs = a.recuerdos.reduce((t, r) => t + (r.hasta > s.t ? r.valor : 0), 0);
    a.animo += (clamp(base + recs) - a.animo) * Math.min(1, k * 0.8);
  }
}

// ---------------------------------------------------------------- elegir qué hacer (utilidad)
// cada acción de la ficha: { en: 'hogar'|'trabajo'|tipo de lugar|'aqui', dur, efectos, costo, requiere(), utilidad(), alTerminar() }
function dondeHacer(F, s, a, A) {
  if (A.en === 'aqui') return a.lugar ? [lugar(F, a.lugar)] : [];
  if (A.en === 'hogar') { const h = F.hogares.find((x) => x.id === a.hogar); return h ? [lugar(F, h.lugar)] : []; }
  if (A.en === 'trabajo') return a.trabajo ? [lugar(F, a.trabajo.lugar)] : [];
  return F.lugares.filter((L) => (L.tipo === A.en || L.id === A.en) && abierto(F, s, L));
}
export function enHorario(s, a) { const T = a.trabajo; if (!T) return false; const h = hora(s); return (T.dias || [0, 1, 2, 3, 4]).includes(diaSemana(s)) && h >= T.entrada && h < T.salida; }
function utilidad(F, s, a, nombre, A, L, api) {
  let u = A.base ?? 0;
  for (const [nk, v] of Object.entries(A.efectos || {})) {
    if (a.n[nk] == null || v <= 0) continue;
    const falta = (100 - a.n[nk]) / 100;
    u += falta * falta * v * (F.necesidades[nk].peso ?? 1);
  }
  u *= mod(F, a, 'gusto_' + nombre);
  if (A.utilidad) u = A.utilidad(s, a, u, api, L);
  // camino: cuanto más lejos, menos ganas
  if (L && a.lugar !== L.id) u -= Math.hypot(L.entrada.x - a.pos.x, L.entrada.z - a.pos.z) * 0.03 * (A.lejosImporta ?? 1);
  return u + rng(s) * 0.6;
}
function elegirAccion(F, s, a, api) {
  let mejor = null;
  for (const [nombre, A] of Object.entries(F.acciones)) {
    if (A.especies && !A.especies.includes(a.especie)) continue;
    if (!A.especies && a.especie !== 'persona') continue;
    if (A.requiere && !A.requiere(s, a, api)) continue;
    if (A.costo && (s.hogares[a.hogar]?.dinero ?? 0) < A.costo) continue;
    if (A.siFalta && (a.n[A.siFalta] ?? 0) > (A.umbral ?? 70)) continue;   // no se come si no hay hambre (ni se duerme sin sueño…)
    for (const L of dondeHacer(F, s, a, A)) {
      if (!L) continue;
      const u = utilidad(F, s, a, nombre, A, L, api);
      if (!mejor || u > mejor.u) mejor = { u, nombre, A, L };
    }
  }
  return mejor;
}
function empezar(F, s, a, nombre, L, extra = {}) {
  const A = F.acciones[nombre];
  const dur = typeof A.dur === 'function' ? A.dur(s, a) : Array.isArray(A.dur) ? A.dur[0] + rng(s) * (A.dur[1] - A.dur[0]) : (A.dur ?? 30);
  a.tarea = { accion: nombre, lugar: L.id, fase: a.lugar === L.id ? 'haciendo' : 'yendo', resta: dur, inicio: s.t, ...extra };
  if (a.tarea.fase === 'yendo') { a.ruta = planRuta(F, a.lugar ? lugar(F, a.lugar).entrada : a.pos, L.entrada); a.lugar = null; }
  else A.alEmpezar?.(s, a, API(F), a.tarea);
  return a.tarea;
}
export function soltar(F, s, a) { a.tarea = null; a.ruta = null; }

// ---------------------------------------------------------------- vivir
function comportamiento(F, s, a, d, api) {
  if (!a.tarea) {
    const m = elegirAccion(F, s, a, api);
    if (!m) { a.accion = 'Sin nada que hacer'; return; }
    empezar(F, s, a, m.nombre, m.L);
    m.A.alElegir?.(s, a, api, a.tarea);
    // las acciones de a dos invitan a alguien que esté en el mismo lugar
    if (m.A.conOtro) invitar(F, s, a, m.nombre, api);
    if (!a.tarea) return;
  }
  const T = a.tarea, A = F.acciones[T.accion];
  if (!A) { soltar(F, s, a); return; }
  const L = lugar(F, T.lugar);
  if (T.fase === 'yendo') {
    a.accion = A.yendo ? A.yendo(s, a, L) : L.tipo === 'apto' && F.hogares?.find((h) => h.id === a.hogar)?.lugar === L.id ? 'Vuelve a casa' : `Va ${/^el /.test(L.nombre) ? 'al ' + L.nombre.slice(3) : 'a ' + L.nombre}`;
    let paso = (F.velocidad?.[a.especie] ?? 1.2) * d * (a.ruta && a.ruta.length > 2 ? 1 : 0.8);
    while (paso > 1e-6 && a.ruta?.length) {
      const p = a.ruta[0], dx = p.x - a.pos.x, dz = p.z - a.pos.z, dist = Math.hypot(dx, dz);
      if (dist <= paso) { a.pos = { ...p }; a.ruta.shift(); paso -= dist; } else { a.pos.x += (dx / dist) * paso; a.pos.z += (dz / dist) * paso; paso = 0; }
    }
    if (!a.ruta?.length) { a.lugar = L.id; a.pos = { ...L.entrada }; T.fase = 'haciendo'; T.inicio = s.t; a.ruta = null; A.alEmpezar?.(s, a, api, T); if (!a.tarea) return; }
    return;
  }
  a.accion = A.texto ? (typeof A.texto === 'function' ? A.texto(s, a, T, api) : A.texto) : T.accion;
  if (T.con) { const o = s.agentes.find((x) => x.id === T.con); if (!o || !o.vivo || o.lugar !== a.lugar || o.tarea?.con !== a.id) { if (s.t - T.inicio > 3) { soltar(F, s, a); return; } } }
  A.mientras?.(s, a, d, api, T);
  if (!a.tarea) return;
  T.resta -= d;
  // urgencias cortan lo que no sea urgente (no se cortan el trabajo ni el dormir salvo emergencia)
  if (!A.noCortar) for (const [nk, N] of Object.entries(F.necesidades)) if (N.urgente != null && a.n[nk] != null && a.n[nk] < N.urgente && !(A.efectos?.[nk] > 0)) { T.resta = 0; T.cortada = true; break; }
  if (T.resta > 0) return;
  if (!T.cortada) A.alTerminar?.(s, a, api, T);
  if (a.tarea === T) soltar(F, s, a);
}
function invitar(F, s, a, nombre, api) {
  const A = F.acciones[nombre], T = a.tarea;
  const cand = s.agentes.filter((o) => o !== a && o.vivo && o.especie === 'persona' && (!A.conQuien || A.conQuien(s, a, o, api)) && (!o.tarea || F.acciones[o.tarea.accion]?.interrumpible));
  if (!cand.length) { soltar(F, s, a); return; }
  cand.sort((x, y) => afinidad(s, a.id, y.id) - afinidad(s, a.id, x.id) + (rng(s) - 0.5) * 30);
  const o = cand[0];
  T.con = o.id;
  empezar(F, s, o, nombre, lugar(F, T.lugar), { con: a.id, resta: T.resta });
}
export function hacer(F, s, a, nombre, lugarId, extra) { soltar(F, s, a); return empezar(F, s, a, nombre, lugar(F, lugarId), extra); }

// ---------------------------------------------------------------- dilemas (el jugador decide)
export function proponer(s, { clave, titulo, texto, opciones, defecto, horas = 6, datos = {} }) {
  if (s.dilemas.some((d) => d.clave === clave) || s.dilemas.length >= 4) return null;
  const d = { id: s.sigDilema++, clave, titulo, texto, opciones, defecto, datos, creado: s.t, vence: s.t + horas * 60 };
  s.dilemas.push(d); return d;
}
export function decidir(F, s, id, k) {
  const d = s.dilemas.find((x) => x.id === id); if (!d) return false;
  s.dilemas = s.dilemas.filter((x) => x !== d); s.jugador.decididas++;
  resolver(F, s, d, k, true); return true;
}
function revisarDilemas(F, s, api) { for (const d of [...s.dilemas]) if (s.t >= d.vence) { s.dilemas = s.dilemas.filter((x) => x !== d); resolver(F, s, d, d.defecto, false); } }
function resolver(F, s, d, k, jugador) {
  const op = d.opciones.find((o) => o.k === k) || d.opciones[0];
  log(s, `${jugador ? '🕯️ Decidiste' : '🤷 Sin tu consejo, decidieron'}: ${d.titulo.toLowerCase()} → ${op.txt.toLowerCase()}.`, 'decision');
  (F.dilemas?.[d.clave.split(':')[0]] || op.efecto)?.(s, k, API(F), d);
}

// ---------------------------------------------------------------- guardar y cargar
export function guardar(s, clave) { try { localStorage.setItem(clave, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
export function cargar(F, clave) {
  try { const s = JSON.parse(localStorage.getItem(clave)); if (s && s.mundo === F.id && s.version === (F.version || 1) && Array.isArray(s.agentes)) return s; } catch { /* dañada */ }
  return null;
}
