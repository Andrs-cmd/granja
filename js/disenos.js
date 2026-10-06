// Diseños por objeto: cada construcción de la granja (establo, gallinero, caseta, pozo) se puede hacer
// en cualquiera de los estilos, sin depender de los demás. Cada estilo cambia la forma del techo,
// los colores y algunos detalles. Las medidas se mantienen para que los personajes sigan usándolas igual.
import * as THREE from 'three';

// colores y forma por estilo
export const ESTILO_OBJ = {
  rustico: { muro: 0xb5643a, granero: 0xa63b2c, techo: 0x4a3a32, madera: 0x7a4e2b, piedra: 0x9c968c, borde: 0x6b4a2b, techoForma: 'dosAguas', pend: 0.55, alero: 0.35 },
  mediterranea: { muro: 0xf3efe6, granero: 0xeee8dc, techo: 0xc4683a, madera: 0x9a7a58, piedra: 0xece6da, borde: 0x2f5d8a, techoForma: 'plano', alero: 0.15 },
  nordica: { muro: 0x3b3f44, granero: 0x7a2a22, techo: 0x232528, madera: 0x5a4636, piedra: 0x55595e, borde: 0xc9a274, techoForma: 'dosAguas', pend: 1.0, alero: 0.25 },
  tropical: { muro: 0xa86f3e, granero: 0xb2ada2, techo: 0xb89a5a, madera: 0x9b6b3d, piedra: 0x8a7a64, borde: 0x5a3d22, techoForma: 'paja', alero: 0.9 },
  asiatica: { muro: 0xe9dfcc, granero: 0x8a3a22, techo: 0x2f3a3a, madera: 0x6b3a26, piedra: 0x8f938c, borde: 0xa8321f, techoForma: 'pagoda', alero: 0.7 },
  americana: { muro: 0xf2efe8, granero: 0xa3322a, techo: 0x4b4f55, madera: 0x8a6a4a, piedra: 0xa0503a, borde: 0xf4f2ec, techoForma: 'dosAguas', pend: 0.75, alero: 0.4, ribete: true },
};

const mats = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o })); return mats.get(k); };
function caja(g, w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; }

// techo sobre un cuerpo de w (x) por d (z) cuya parte de arriba está en y
function techo(g, E, w, d, y, colorTecho, colorHastial) {
  const T = mat(colorTecho), a = E.alero ?? 0.3;
  if (E.techoForma === 'plano') {   // losa plana con baranda (mediterránea)
    caja(g, w + 2 * a, 0.18, d + 2 * a, mat(E.muro), 0, y + 0.09, 0);
    for (const [ww, dd, x, z] of [[w + 2 * a, 0.12, 0, (d / 2 + a)], [w + 2 * a, 0.12, 0, -(d / 2 + a)], [0.12, d + 2 * a, (w / 2 + a), 0], [0.12, d + 2 * a, -(w / 2 + a), 0]]) caja(g, ww, 0.32, dd, mat(E.muro), x, y + 0.34, z);
    caja(g, w * 0.9, 0.05, d * 0.9, T, 0, y + 0.2, 0);   // tejas / terraza
    return y + 0.5;
  }
  if (E.techoForma === 'paja' || E.techoForma === 'pagoda') {   // a cuatro aguas: paja gruesa (tropical) o aleros curvos en dos pisos (asiática)
    const R = Math.hypot(w / 2 + a, d / 2 + a), h = E.techoForma === 'paja' ? 0.75 + w * 0.08 : 0.45;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(R, h, 4, 1), T); c1.rotation.y = Math.PI / 4; c1.scale.set(1, 1, (d + 2 * a) / (w + 2 * a)); c1.position.y = y + h / 2; c1.castShadow = true; g.add(c1);
    if (E.techoForma === 'pagoda') {
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(R * 0.62, h * 1.3, 4, 1), T); c2.rotation.y = Math.PI / 4; c2.scale.copy(c1.scale); c2.position.y = y + h + h * 0.55; c2.castShadow = true; g.add(c2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = caja(g, 0.1, 0.1, 0.32, mat(E.borde), sx * (w / 2 + a * 0.9), y + 0.12, sz * (d / 2 + a * 0.9)); p.rotation.x = sz * 0.6; }   // puntas levantadas
      return y + h * 2.2;
    }
    return y + h;
  }
  // a dos aguas (cumbrera a lo largo de x): hastial macizo (prisma) y dos faldones encima
  const pend = E.pend ?? 0.6, ang = Math.atan(pend), alto = (d / 2) * pend, largo = (d / 2 + a) / Math.cos(ang);
  const forma = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, alto)]);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
  const hast = new THREE.Mesh(geo, mat(colorHastial)); hast.position.y = y; hast.castShadow = hast.receiveShadow = true; g.add(hast);
  const run = d / 2 + a;
  for (const sz of [-1, 1]) { const r = caja(g, w + 2 * a, 0.12, largo, T, 0, y + alto - (run / 2) * pend + 0.07, sz * run / 2); r.rotation.x = sz * ang; }
  if (E.ribete) for (const sz of [-1, 1]) { const b = caja(g, w + 2 * a + 0.04, 0.06, 0.1, mat(E.borde), 0, y + alto - run * pend + 0.03, sz * run); b.castShadow = false; }
  return y + alto;
}

export function construirDiseno(objeto, est) {
  const E = ESTILO_OBJ[est] || ESTILO_OBJ.rustico, g = new THREE.Group();
  if (objeto === 'caseta') {
    caja(g, 1.8, 1.2, 1.6, mat(E.muro), 0, 0.6, 0);
    techo(g, E, 1.8, 1.6, 1.2, E.techo, E.muro);
    caja(g, 0.7, 0.75, 0.05, mat(0x1b1410), 0, 0.4, 0.81);
    caja(g, 0.82, 0.08, 0.08, mat(E.borde), 0, 0.8, 0.83);
    if (est === 'asiatica') for (const sx of [-1, 1]) caja(g, 0.1, 1.2, 0.1, mat(E.borde), sx * 0.95, 0.6, 0.85);
    if (est === 'americana') caja(g, 1.1, 0.25, 0.04, mat(0xf4f2ec), 0, 1.0, 0.82);
  } else if (objeto === 'pozo') {
    const piedra = mat(E.piedra), madera = mat(E.madera);
    const anillo = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.0, est === 'mediterranea' || est === 'americana' ? 20 : 12, 1, true), mat(E.piedra, { side: THREE.DoubleSide })); anillo.position.y = 0.5; anillo.castShadow = true; g.add(anillo);
    const labio = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.12, 6, 16), piedra); labio.rotation.x = Math.PI / 2; labio.position.y = 1.0; g.add(labio);
    const agua = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), mat(0x1d4f6b, { roughness: 0.2, flatShading: false })); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.3; g.add(agua);
    for (const sx of [-1, 1]) caja(g, 0.12, 2.0, 0.12, madera, sx * 0.95, 1.0, 0);
    caja(g, 2.2, 0.08, 0.08, madera, 0, 1.75, 0);
    if (est === 'tropical') for (let i = 0; i < 8; i++) { const b = caja(g, 0.07, 1.0, 0.07, mat(0x9b8a4a), Math.cos(i / 8 * 6.28) * 1.08, 0.5, Math.sin(i / 8 * 6.28) * 1.08); b.castShadow = false; }   // bambú
    techo(g, E, 1.9, 1.3, 1.95, E.techo, E.madera);
    const balde = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.28, 8), mat(0x24262b, { metalness: 0.6, roughness: 0.45 })); balde.position.set(0, 1.3, 0); g.add(balde); g.userData.bucket = balde;
  } else if (objeto === 'gallinero') {
    const cuerpo = mat(E.muro), patas = mat(E.madera);
    for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) caja(g, 0.14, 0.8, 0.14, patas, x, 0.4, z);
    caja(g, 3.0, 1.6, 2.4, cuerpo, 0, 1.6, 0);
    caja(g, 0.5, 0.6, 0.06, mat(0x2a2018), -1.0, 1.3, 1.22);
    for (const y of [0.85, 2.35]) caja(g, 3.04, 0.08, 2.44, mat(E.borde), 0, y, 0);
    if (est === 'mediterranea' || est === 'americana') caja(g, 0.7, 0.45, 0.04, mat(0x9fc4d8, { roughness: 0.1 }), 0.8, 1.75, 1.22);   // ventanita
    techo(g, E, 3.0, 2.4, 2.4, E.granero, E.muro);
    const rampa = caja(g, 0.6, 0.06, 1.6, patas, -1.0, 0.45, 1.85); rampa.rotation.x = -0.55;
  } else if (objeto === 'establo') {
    const pared = mat(E.granero);
    caja(g, 0.2, 3.2, 4.6, pared, -2.2, 1.6, 0);
    caja(g, 4.6, 3.2, 0.2, pared, 0, 1.6, -2.3);
    caja(g, 1.15, 3.2, 0.2, pared, -1.7, 1.6, 2.3);
    for (const [x, z] of [[2.2, 2.3], [2.2, -2.3], [0.5, 2.3]]) caja(g, 0.2, 3.2, 0.2, mat(E.madera), x, 1.6, z);
    if (est === 'americana' || est === 'rustico') for (const x of [-2.31, -2.31]) { const c = caja(g, 0.04, 2.0, 0.12, mat(0xf4f2ec), x, 1.4, 0); c.rotation.x = 0.6; const c2 = caja(g, 0.04, 2.0, 0.12, mat(0xf4f2ec), x, 1.4, 0); c2.rotation.x = -0.6; }   // la cruz blanca del granero
    if (est === 'nordica') for (let i = -2; i <= 2; i++) caja(g, 0.06, 3.2, 0.04, mat(0x2a2c30), i * 0.9, 1.6, -2.42);   // tablas verticales
    techo(g, E, 4.8, 4.8, 3.2, E.techo, E.granero);
    const paja = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 4.4), mat(0xd8c27a, { roughness: 1 })); paja.position.y = 0.05; g.add(paja);
  }
  return g;
}
