// =====================================================================
// La aldea · la multitud (solo dibujo). Los ciudadanos simulados son una muestra; cada uno representa
// a muchos habitantes. La multitud son esos habitantes: caminan por las calles entre los edificios y
// trabajan en campos, minas y canteras. Su cantidad sigue a la ciudad (más celdas construidas, más gente),
// su ropa y su estatura siguen a la era, y de noche la mayoría se queda en casa.
// Dos InstancedMesh (cuerpos y cabezas): unas 900 personas en dos llamadas de dibujo.
// =====================================================================
import { THREE, fundirGeo, GEO, MAT_VERTICE } from '../motor/orbe3d.js';
import { ropaDe } from './urbe3d.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const MAX = 900;
// personas en la calle por cada celda construida, según la era (la tribu ya está toda simulada)
const DENS = [0, 0.35, 0.55, 0.75, 0.95, 1.15, 1.35, 1.5];
const PIEL = [0xf1c9a5, 0xd9a77a, 0xb98058, 0x8a5a3a, 0xe8b890, 0x6a4028];

export function crearMultitud(M, alt, especie = null) {
  const pieles = especie?.piel || PIEL;   // la gente de la calle tiene el pelaje, las plumas o las escamas de su especie
  const cuerpo = new THREE.InstancedMesh(fundirGeo([
    [GEO.capsula, 0xffffff, 0, 1.02, 0, 0.36, 0.62, 0.25], [GEO.capsula, 0xbdbdbd, -0.1, 0.4, 0, 0.12, 0.5, 0.12], [GEO.capsula, 0xbdbdbd, 0.1, 0.4, 0, 0.12, 0.5, 0.12],
  ]), MAT_VERTICE, MAX);
  const cabeza = new THREE.InstancedMesh(fundirGeo([[GEO.esfera, 0xffffff, 0, 1.62, 0, 0.16, 0.18, 0.16]]), MAT_VERTICE, MAX);
  for (const im of [cuerpo, cabeza]) { im.count = 0; im.frustumCulled = false; M.add(im); }
  for (let i = 0; i < MAX; i++) cabeza.setColorAt(i, _c.setHex(pieles[Math.floor(hash(i * 3 + 1) * pieles.length)]));
  const andan = [...Array(MAX)].map((_, i) => ({ de: null, a: null, t: hash(i * 5), v: 0.9 + hash(i * 11) * 0.7 }));
  let firmaColor = '', firmaLug = '', lugares = [], urb = 0;

  // s, dt, hr (hora), red vial { nodos, aristas }, D destino; mult (velocidad del tiempo)
  function actualizar(s, dt, hr, red, D, mult) {
    const era = Math.min(7, s.era), tt = performance.now() / 1000;
    const tipo = D?.tipo, apagada = tipo === 'destruccion' || (tipo === 'trascendencia' && (D.fase || 0) > 0.3) || s.fin;
    // trabajadores en campos, minas y canteras (de día; en las eras futuras las máquinas hacen casi todo)
    const fl = `${s.vc}:${era}`;
    if (fl !== firmaLug) { firmaLug = fl; lugares = s.celdas.filter((c) => (c.u === 'campo' || c.u === 'mina' || c.u === 'cantera') && !c.ru); urb = s.celdas.filter((c) => c.u && !c.ru && !['campo', 'parque'].includes(c.u)).length; }
    const dia = hr >= 6.5 && hr < 20 ? 1 : hr >= 5.5 && hr < 22 ? 0.55 : 0.12;
    const nCalle = apagada || !red.nodos.length ? 0 : Math.min(MAX - 160, Math.round(urb * DENS[era] * dia));
    const porLugar = era === 0 || apagada || hr < 6.5 || hr > 17.5 ? 0 : era >= 6 ? 0.5 : 2;
    const nCampo = Math.min(160, Math.floor(lugares.length * porLugar));
    // ropa de la era (cambia cuando cambia la era o el destino)
    const fc = `${era}:${tipo || ''}`;
    if (fc !== firmaColor) { firmaColor = fc; for (let i = 0; i < MAX; i++) cuerpo.setColorAt(i, _c.setHex(tipo === 'colmena' ? 0x6ae8ff : ropaDe(era, { ap: { tono: hash(i * 7 + 2) }, clase: hash(i * 13) < 0.12 ? 'alta' : 'media', id: i }))); cuerpo.instanceColor.needsUpdate = true; }
    const alto = 0.9 + era * 0.018, paso = Math.min(3, 1 + (mult || 0) / 300);   // la gente crece con la nutrición de cada era
    let n = 0;
    const { nodos, aristas } = red;
    for (let i = 0; i < nCalle; i++) {
      const w = andan[i];
      if (!w.de || !aristas.get(w.de) || !aristas.get(w.a)) { w.de = nodos[Math.floor(hash(i * 17 + s.dia) * nodos.length)]; const vs = [...(aristas.get(w.de)?.v || [])]; w.a = vs[i % Math.max(1, vs.length)] || w.de; }
      w.t += (dt * w.v * paso) / 3;
      if (w.t >= 1) { const vs = [...aristas.get(w.a).v].filter((k) => k !== w.de); w.de = w.a; w.a = vs.length ? vs[Math.floor(hash(i * 7 + Math.floor(tt * 3) + s.dia) * vs.length)] : w.de; w.t = 0; }
      const A = aristas.get(w.de).p, B = aristas.get(w.a).p, dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz) || 1, lado = (i % 2 ? 0.32 : -0.32) + (hash(i) - 0.5) * 0.2;
      const x = A[0] + dx * w.t - (dz / L) * lado, z = A[1] + dz * w.t + (dx / L) * lado, y = alt(x, z) + Math.abs(Math.sin(tt * 7 * w.v + i)) * 0.06;
      _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, Math.atan2(dx, dz)), _s.setScalar(alto * (0.92 + hash(i * 19) * 0.16)));
      cuerpo.setMatrixAt(n, _m); cabeza.setMatrixAt(n, _m); n++;
    }
    for (let i = 0; i < nCampo; i++) {
      const c = lugares[i % lugares.length], k = Math.floor(i / lugares.length), x = c.x + (hash(i * 23 + k) - 0.5) * 2.4, z = c.z + (hash(i * 29 + k) - 0.5) * 2.4;
      const agacha = 0.85 + Math.abs(Math.sin(tt * 2 + i)) * 0.15;   // se agachan y se levantan: siembran, cavan
      _m.compose(_p.set(x, alt(x, z), z), _q.setFromAxisAngle(UP, hash(i * 31) * 6.28), _s.set(alto, alto * agacha, alto));
      cuerpo.setMatrixAt(n, _m); cabeza.setMatrixAt(n, _m); n++;
    }
    cuerpo.count = cabeza.count = n; cuerpo.instanceMatrix.needsUpdate = true; cabeza.instanceMatrix.needsUpdate = true;
    return n;
  }
  return { actualizar };
}
