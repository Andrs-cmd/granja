// =====================================================================
// La aldea · lo que se ve cuando el espíritu del orbe actúa (solo dibujo).
//  meteorito: bola de fuego que cae, destello, temblor y cráter en llamas
//  terremoto: el orbe tiembla y se levanta polvo · incendio: llamas y humo en la zona
//  inundación: el lago crece y vuelve a su sitio · rayo: descarga, destello y fuego
// La simulación deja s.efecto = { k, x, z, t, r }; aquí se anima unos segundos de tiempo real.
// =====================================================================
import { THREE } from '../motor/orbe3d.js';

const DUR = { meteorito: 12, terremoto: 5, incendio: 12, inundacion: 9, rayo: 5 };
const hash = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

export function crearEfectos(M, alt) {
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffc070 })); bola.visible = false; M.add(bola);
  const matDestello = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const destello = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), matDestello); destello.visible = false; M.add(destello);
  const luz = new THREE.PointLight(0xffa050, 0, 90, 1.4); M.add(luz);
  const rayoGeo = new THREE.BufferGeometry(); rayoGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
  const rayo = new THREE.Line(rayoGeo, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true })); rayo.visible = false; rayo.frustumCulled = false; M.add(rayo);
  const matAgua = new THREE.MeshStandardMaterial({ color: 0x3f86b0, transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.1 });
  const crecida = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), matAgua); crecida.visible = false; M.add(crecida);
  let actual = null, clave = '';

  // devuelve { fuego: [[x,y,z,escala]], humo: [[x,y,z,peso]] } para el fuego y el humo de la escena
  function actualizar(s, dt) {
    const e = s.efecto, fuego = [], humo = [];
    if (e && `${e.k}:${e.t}` !== clave) { clave = `${e.k}:${e.t}`; if (s.t - e.t < 600) actual = { ...e, t0: performance.now() / 1000 }; }   // un efecto viejo (de una partida cargada) no se repite
    bola.visible = destello.visible = rayo.visible = crecida.visible = false; luz.intensity = 0; M.position.set(0, 0, 0);
    if (!actual) return { fuego, humo };
    const t = performance.now() / 1000 - actual.t0, { k, x, z, r } = actual, y0 = alt(x, z);
    if (t > DUR[k]) { actual = null; return { fuego, humo }; }
    const temblar = (fuerza) => M.position.set((Math.random() - 0.5) * fuerza, (Math.random() - 0.5) * fuerza * 0.4, (Math.random() - 0.5) * fuerza);
    const llamasEn = (n, rad, esc, sem) => { for (let i = 0; i < n; i++) { const a = hash(sem + i) * 6.28, d = Math.sqrt(hash(sem + i * 7)) * rad, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; fuego.push([px, alt(px, pz), pz, esc * (0.7 + hash(i * 3 + sem) * 0.6)]); if (i % 3 === 0) humo.push([px, alt(px, pz) + 1.5, pz, 2]); } };
    if (k === 'meteorito') {
      const caida = 1.8;
      if (t < caida) { const u = t / caida, sx = x + 70 * (1 - u), sy = y0 + 140 * (1 - u), sz = z + 40 * (1 - u); bola.visible = true; bola.position.set(sx, sy, sz); bola.scale.setScalar(1 + u * 0.6); luz.position.copy(bola.position); luz.intensity = 40 + u * 80; humo.push([sx, sy, sz, 4]); }
      else {
        const u = t - caida;
        if (u < 1.2) { destello.visible = true; destello.position.set(x, y0, z); destello.scale.setScalar(2 + u * r * 3); matDestello.opacity = Math.max(0, 1 - u / 1.2); luz.position.set(x, y0 + 4, z); luz.intensity = 300 * (1 - u / 1.2); }
        if (u < 2.5) temblar(1.4 * (1 - u / 2.5));
        llamasEn(Math.round(14 * Math.max(0.2, 1 - u / 10)), r, 1.6, 101);
      }
    } else if (k === 'terremoto') {
      temblar(0.9 * Math.min(1, t * 3) * Math.max(0, 1 - t / DUR[k]));
      for (let i = 0; i < 6; i++) { const a = hash(i * 9 + 3) * 6.28, d = hash(i * 5) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; humo.push([px, alt(px, pz) + 0.5, pz, 2]); }
    } else if (k === 'incendio') {
      llamasEn(Math.round(18 * Math.max(0.15, 1 - t / DUR[k])), r, 1.8, 211);
      luz.position.set(x, y0 + 5, z); luz.intensity = 60 * Math.max(0, 1 - t / DUR[k]);
    } else if (k === 'inundacion') {
      const u = t / DUR[k], sube = u < 0.3 ? u / 0.3 : Math.max(0, 1 - (u - 0.3) / 0.7);
      crecida.visible = true; crecida.position.set(x, 0.2 + sube * 0.5, z); crecida.scale.setScalar(Math.max(1, (s.lago?.r || 8) + sube * (r - (s.lago?.r || 8))));
    } else if (k === 'rayo') {
      if (t < 0.6) {
        const p = rayoGeo.attributes.position; for (let i = 0; i < 16; i++) { const h = 1 - i / 15; p.setXYZ(i, x + (i && i < 15 ? (Math.random() - 0.5) * 3 : 0), y0 + h * 90, z + (i && i < 15 ? (Math.random() - 0.5) * 3 : 0)); } p.needsUpdate = true;
        rayo.visible = Math.random() > 0.25; luz.position.set(x, y0 + 10, z); luz.intensity = 400 * (1 - t / 0.6);
      }
      llamasEn(4, 1.4, 1.3, 307);
    }
    return { fuego, humo };
  }
  return { actualizar, get activo() { return actual; } };
}
