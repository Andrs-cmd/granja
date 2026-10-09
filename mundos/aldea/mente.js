// =====================================================================
// La aldea · la mente de cada ciudadano: personalidad (los «cinco grandes»), valores, opiniones
// sobre los grandes temas, recuerdos que las explican, sueños de vida y pensamientos propios.
// Puro (sin DOM ni three). Las opiniones cambian por lo que cada quien vive y por la gente que le rodea.
// =====================================================================
import { tituloOficio, ERAS } from './datos.js';

export const BIG5 = [['ape', 'Apertura', 'curiosa', 'tradicional'], ['res', 'Responsabilidad', 'disciplinada', 'despreocupada'], ['ext', 'Extraversión', 'sociable', 'reservada'], ['ama', 'Amabilidad', 'amable', 'dura'], ['neu', 'Neuroticismo', 'ansiosa', 'serena']];
export const VALORES = [['fe', 'Fe'], ['ambicion', 'Ambición'], ['empatia', 'Empatía'], ['curiosidad', 'Curiosidad'], ['lealtad', 'Lealtad'], ['codicia', 'Codicia'], ['miedo', 'Miedo']];
export const TEMAS = { ciencia: ['la ciencia', 'Ciencia'], religion: ['la religión', 'Religión'], guerra: ['la guerra', 'Guerra'], tecnologia: ['la tecnología', 'Tecnología'], naturaleza: ['la naturaleza', 'Naturaleza'], lider: ['el gobierno', 'Gobierno'], igualdad: ['la igualdad', 'Igualdad'] };
export const SUENOS = {
  familia: 'Formar una familia grande y verla crecer',
  riqueza: 'Hacerse rico y que nadie le falte nada',
  saber: 'Descubrir algo que nadie sabía',
  fe: 'Acercarse al espíritu del orbe',
  poder: 'Llegar a guiar a su gente',
  aventura: 'Ver lo que hay más allá del horizonte',
  arte: 'Crear algo bello que la recuerden',
  paz: 'Vivir en paz con todos',
};
const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const r2 = (v) => Math.round(v * 100) / 100;

// nueva mente: herencia (padres), cultura de su ciudad (promedios) y azar
export function nuevaMente(R, padres = [], cultura = null) {
  const g = () => (R() + R() + R()) / 3;   // forma de campana
  const her = (f) => (padres.length ? padres.reduce((n, p) => n + f(p), 0) / padres.length : null);
  const p = {};
  for (const [k] of BIG5) { const h = her((x) => x.p[k]); p[k] = r2(cl(h == null ? g() : h * 0.45 + g() * 0.55)); }
  const ruido = () => (R() - 0.5) * 0.35;
  const v = {
    fe: cl(0.5 + (p.ama - 0.5) * 0.3 + (0.5 - p.ape) * 0.35 + ruido()),
    ambicion: cl(0.2 + p.ext * 0.3 + (1 - p.ama) * 0.3 + p.res * 0.2 + ruido()),
    empatia: cl(0.15 + p.ama * 0.65 + ruido()),
    curiosidad: cl(0.1 + p.ape * 0.75 + ruido()),
    lealtad: cl(0.15 + p.res * 0.4 + p.ama * 0.3 + ruido()),
    codicia: cl(0.1 + (1 - p.ama) * 0.45 + ruido()),
    miedo: cl(0.1 + p.neu * 0.65 + ruido()),
  };
  // la fe se hereda bastante (se cría en ella) y la cultura de la ciudad empuja
  const fp = her((x) => x.v.fe); if (fp != null) v.fe = cl(v.fe * 0.5 + fp * 0.5);
  if (cultura) v.fe = cl(v.fe * 0.7 + cultura.fe * 0.3);
  for (const k of Object.keys(v)) v[k] = r2(v[k]);
  const op = opinionesBase(v);
  if (cultura) for (const k of Object.keys(op)) op[k] = r2(Math.max(-1, Math.min(1, op[k] * 0.5 + (cultura.op[k] ?? 0) * 0.5)));
  return { p, v, op };
}
export function opinionesBase(v) {
  const c = (x) => r2(Math.max(-1, Math.min(1, x)));
  return { ciencia: c(v.curiosidad * 1.3 - 0.55 - v.fe * 0.35), religion: c(v.fe * 1.5 - 0.7), guerra: c((v.ambicion - v.empatia) * 1.1 - v.miedo * 0.3), tecnologia: c(v.curiosidad * 0.7 + v.ambicion * 0.4 - 0.5), naturaleza: c(v.empatia * 0.6 + (1 - v.codicia) * 0.5 - 0.55), lider: c(0.15 + v.lealtad * 0.5 - 0.25), igualdad: c(v.empatia * 0.9 - v.codicia * 0.8) };
}
// sueño de vida según el carácter
export function elegirSueno(R, a) {
  const v = a.v, p = a.p, op = [['familia', 0.6 + p.ama * 0.4], ['riqueza', v.codicia * 1.2], ['saber', v.curiosidad * 1.1], ['fe', v.fe * 1.1], ['poder', v.ambicion * 1.1], ['aventura', p.ape * 0.6 + p.ext * 0.4], ['arte', p.ape * 0.7 + (1 - p.res) * 0.3], ['paz', v.empatia * 0.6 + (1 - v.ambicion) * 0.5]];
  let tot = op.reduce((n, x) => n + x[1] * x[1], 0), r = R() * tot;
  for (const [k, w] of op) { r -= w * w; if (r <= 0) return k; }
  return 'familia';
}

// valor de una persona para una clave de pesos: 'fe' (valor), 'o.tema' (opinión), 'rico', 'ape' (rasgo)
export function rasgo(a, k) {
  if (k.startsWith('o.')) return a.op[k.slice(2)] ?? 0;
  if (k === 'rico') return a.rank != null ? a.rank * 2 - 1 : 0;
  if (a.v[k] != null) return (a.v[k] - 0.5) * 2;
  if (a.p[k] != null) return (a.p[k] - 0.5) * 2;
  return 0;
}
export function atractivo(a, w) { let n = 0; for (const [k, x] of Object.entries(w || {})) n += rasgo(a, k) * x; return n; }
// el porqué de un voto: el rasgo que más pesó
export function motivoVoto(a, w) {
  let mejor = null, mv = 0, signo = 1;
  for (const [k, x] of Object.entries(w || {})) { const c = rasgo(a, k) * x; if (c > mv) { mv = c; mejor = k; signo = Math.sign(x); } }
  if (!mejor) return 'no tiene una razón muy clara';
  if (mejor.startsWith('o.')) return `por lo que piensa de ${TEMAS[mejor.slice(2)][0]}`;
  // si pesó un rasgo con peso negativo, la razón es la falta de ese rasgo
  const T = signo > 0 ? { fe: 'por su fe', ambicion: 'por ambición', empatia: 'porque le importan los demás', curiosidad: 'por curiosidad', lealtad: 'por lealtad', codicia: 'por interés propio', miedo: 'por miedo', rico: 'porque le conviene a su bolsillo' }
    : { fe: 'porque la fe no la mueve', ambicion: 'porque no es ambiciosa', empatia: 'porque no se deja llevar por la compasión', curiosidad: 'porque desconfía de lo nuevo', lealtad: 'porque no le debe lealtad a nadie', codicia: 'porque no le importa el dinero', miedo: 'porque no tiene miedo', rico: 'porque es pobre y no tiene nada que perder' };
  const r = T[mejor] || 'por su manera de ser';
  return a.sexo === 'f' ? r : r.replace('ambiciosa', 'ambicioso').replace('no la mueve', 'no lo mueve');
}

// recuerdos: lo vivido deja huella en el ánimo y en las opiniones (y sirve para explicarlas)
export function recordar(a, d, txt, peso = 0, tema = null, delta = 0) {
  a.mem.unshift({ d, txt, peso, tema, delta: r2(delta) });
  if (a.mem.length > 10) { a.mem.sort((x, y) => Math.abs(y.peso) + Math.abs(y.delta) * 20 - Math.abs(x.peso) - Math.abs(x.delta) * 20); a.mem.length = 10; }
  if (tema && delta) a.op[tema] = r2(Math.max(-1, Math.min(1, a.op[tema] + delta)));
}
// influencia social: se acercan las opiniones de quienes se aprecian (y se alejan las de quienes se detestan)
export function influir(a, b, afin) {
  const k = afin > 0 ? 0.02 * (0.5 + b.p.ext) * (0.6 + a.p.ape * 0.6) * Math.min(1, afin / 50) : -0.012;
  for (const t of Object.keys(a.op)) { const d = (b.op[t] - a.op[t]) * k; a.op[t] = r2(Math.max(-1, Math.min(1, a.op[t] + d))); }
}
export function porQueOpina(a, tema) {
  const m = a.mem.filter((x) => x.tema === tema && x.delta).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0];
  if (m) return `${m.delta > 0 ? 'Desde que' : 'Desde que'} ${m.txt.charAt(0).toLowerCase()}${m.txt.slice(1)}`;
  const v = a.v, o = a.op[tema];
  const base = { ciencia: o > 0 ? 'Es curios' : 'Desconfía de lo que no se ve con fe', religion: o > 0 ? 'Creció en la fe' : 'Nunca le convencieron los templos', guerra: o > 0 ? 'Cree que la fuerza da respeto' : 'Le duele la violencia', tecnologia: o > 0 ? 'Le fascinan los inventos' : 'Prefiere lo de siempre', naturaleza: o > 0 ? 'Ama el bosque y el lago' : 'Cree que la naturaleza está para usarla', lider: o > 0 ? 'Confía en quienes mandan' : 'Desconfía del poder', igualdad: o > 0 ? 'Le importa que nadie se quede atrás' : 'Cree que cada quien tiene lo que merece' }[tema];
  return base.endsWith('Es curios') ? `${base}${a.sexo === 'f' ? 'a' : 'o'} por naturaleza` : base + (tema === 'ciencia' && o > 0 && v.curiosidad < 0.5 ? ' (aunque no es muy curios' + (a.sexo === 'f' ? 'a' : 'o') + ')' : '');
}
export function describir(a) {
  const ad = [];
  for (const [k, , alto, bajo] of BIG5) { if (a.p[k] > 0.66) ad.push(alto); else if (a.p[k] < 0.34) ad.push(bajo); }
  const f = (w) => (a.sexo === 'f' ? w : w.replace(/a$/, 'o').replace(/sociablo/, 'sociable').replace(/amablo/, 'amable').replace(/serenao/, 'sereno').replace(/durao/, 'duro'));
  const l = ad.slice(0, 3).map(f);
  return l.length ? (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0]) : f('equilibrada');
}

// ---------------------------------------------------------------- pensamientos y diálogo interno
const g = (a, m, f) => (a.sexo === 'f' ? f : m);
export function pensar(s, a, ctx = {}) {
  const o = g(a, 'o', 'a'), E = s.era, ciudad = s.ciudades[a.al], ap = a.animo, interno = [];
  const linea = (t) => interno.push(t);
  let txt = null;
  // en la prehistoria todavía no hay palabras: solo instintos e imágenes
  if (s.evo != null && s.evo < 4) {
    const L = [['Hambre… fruta… allá arriba.', 'Ruido en la hierba. ¿Peligro?', 'Calor del sol. Bueno.', 'La manada está cerca. Bien.'], ['Esta piedra corta. La guardo.', 'Si golpeo así… se rompe distinto.', 'Mi cría me imita. Aprende.', 'Otra piedra, más filosa.'], ['El fuego calienta. El fuego asusta a los otros.', 'La carne sobre el fuego sabe mejor.', 'Noche, pero hay luz.', 'Hay que cuidar la brasa.'], ['Quiero decirle que hay agua detrás del cerro.', 'Esa forma de sonido quiere decir "peligro".', '¿Cómo se llama esto?', 'Cuento lo que pasó y me escuchan.']][s.evo];
    return { txt: a.salud < 30 ? 'Dolor… frío…' : ciudad?.hambre > 0.2 ? 'Hambre. Mucha hambre.' : L[(a.id + s.dia) % L.length], interno: [] };
  }
  // lo urgente primero
  if (a.edad < 3) return { txt: '¡Ba-ba!', interno: [] };
  if (s.destino?.tipo === 'trascendencia') txt = 'Siento que me disuelvo en luz… no tengo miedo.';
  else if (s.destino?.tipo === 'estelar') txt = 'Mañana subimos a la nave. Nunca más veré este cielo de cristal.';
  else if (s.destino?.tipo === 'colmena') txt = 'Somos uno. Pensamos juntos. Ya no recuerdo cómo era estar sol' + o + '.';
  else if (s.destino?.tipo === 'gaia') txt = 'El bosque respira con nosotros.';
  else if (a.salud < 30) txt = 'Me duele todo… no sé si salga de esta.';
  else if (a.hambre) txt = 'Hoy tampoco hubo suficiente para comer.';
  else if (s.guerra && (s.guerra.a === a.al || s.guerra.b === a.al)) txt = a.op.guerra > 0.3 ? '¡Que aprendan a respetarnos!' : 'Otra vez la guerra… ¿por qué no paramos?';
  else if (a.enf) txt = 'Tengo fiebre. Ojalá los médicos sepan qué hacer.';
  // la decisión del momento
  const D = s.decision;
  if (!txt && D && ctx.voto) txt = `Voy a apoyar «${ctx.voto.n}»: ${ctx.voto.motivo}.`;
  // el recuerdo que más pesa
  const m = [...a.mem].sort((x, y) => Math.abs(y.peso) - Math.abs(x.peso))[0];
  const min1 = (x) => x.charAt(0).toLowerCase() + x.slice(1);
  if (!txt && m && Math.abs(m.peso) >= 12) txt = m.peso < 0 ? `No dejo de pensar en eso: ${min1(m.txt)}.` : `Todavía sonrío cuando recuerdo que ${min1(m.txt)}.`;
  // su sueño
  if (!txt && a.sueno && !a.sueno.ok && (s.dia + a.id) % 3 === 0) {
    txt = { familia: 'Quiero ver mi casa llena de niños.', riqueza: 'Un día voy a tener la casa más grande de la ciudad.', saber: 'Hay algo que nadie ha descubierto… y quiero ser yo.', fe: 'Siento que el espíritu me llama.', poder: 'Yo podría guiar esta ciudad mejor que cualquiera.', aventura: '¿Qué habrá más allá del cristal?', arte: 'Tengo una canción en la cabeza que nadie ha oído.', paz: 'Solo pido que no haya más peleas.' }[a.sueno.k];
  }
  // opinión fuerte sobre la época
  if (!txt) {
    const fuerte = Object.entries(a.op).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
    const [t, v] = fuerte;
    const F = {
      ciencia: v > 0 ? (E >= 6 ? 'Los datos no mienten.' : 'Si lo podemos medir, lo podemos entender.') : 'Tanto saber nos está alejando del espíritu.',
      religion: v > 0 ? 'El espíritu del orbe nos mira; hay que estar a la altura.' : 'Los templos solo sirven para dar miedo.',
      guerra: v > 0 ? 'Un pueblo débil es un pueblo muerto.' : 'Ninguna guerra vale lo que cuesta.',
      tecnologia: v > 0 ? (E >= 4 ? '¡Cada año hay una máquina nueva!' : 'Con mejores herramientas todo sería más fácil.') : 'Antes la vida era más sencilla.',
      naturaleza: v > 0 ? (s.contaminacion > 0.3 ? 'Ya no se ve el cielo de tanto humo. Esto no está bien.' : 'Me gusta caminar entre los árboles.') : 'El bosque está para usarlo.',
      lider: v > 0 ? 'Quienes mandan saben lo que hacen.' : 'Los de arriba solo piensan en ellos.',
      igualdad: v > 0 ? (a.clase === 'baja' ? '¿Por qué ellos tienen tanto y nosotros tan poco?' : 'Nadie debería quedarse sin techo.') : 'Cada quien tiene lo que se ganó.',
    };
    txt = F[t];
  }
  // diálogo interno: dos voces que tiran para lados distintos
  if (a.v.fe > 0.55 && a.op.ciencia > 0.3) linea('Una parte de mí cree en el espíritu… y otra quiere pruebas.');
  if (a.v.ambicion > 0.6 && a.v.empatia > 0.6) linea('Quiero llegar lejos, pero no a costa de los demás.');
  if (a.v.codicia > 0.6 && a.clase === 'baja') linea('Me merezco más de lo que tengo. Y lo voy a conseguir.');
  if (a.v.miedo > 0.65) linea(E >= 5 ? 'A veces me despierto pensando que todo esto puede acabar en un segundo.' : 'Me asusta lo que viene.');
  if (a.op.lider < -0.4 && a.v.lealtad > 0.6) linea('Siempre he sido leal… pero este gobierno no se lo merece.');
  if (a.mov != null) { const M = s.movimientos.find((x) => x.id === a.mov); if (M) linea(`Con «${M.nombre}» siento que por fin tengo voz.`); }
  if (a.sueno?.ok) linea(`Cumplí mi sueño: ${SUENOS[a.sueno.k].toLowerCase()}.`);
  if (ap < 30) linea('No sé cuánto más aguante aquí.');
  else if (ap > 78) linea('La vida es buena.');
  if (ciudad && a.clase === 'alta' && a.v.empatia > 0.6) linea('Tengo más de lo que necesito… ¿no debería compartirlo?');
  return { txt, interno: interno.slice(0, 3) };
}
export const oficioDe = (s, a) => (a.edad < 14 ? g(a, 'Niño', 'Niña') : a.edad >= 65 ? g(a, 'Anciano', 'Anciana') + (a.oficio ? ` (fue ${tituloOficio(a.oficio, s.era, a.sexo).toLowerCase()})` : '') : a.oficio ? tituloOficio(a.oficio, s.era, a.sexo) : 'Sin oficio');
export const eraNombre = (e) => ERAS[e]?.n || '';
