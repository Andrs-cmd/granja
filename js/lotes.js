// Agrupador automático de piezas quietas: junta en una sola malla (por material) todo lo que no se mueve,
// para dibujar unas pocas cientos de mallas en vez de miles. Las piezas originales siguen en la escena
// (la lógica las puede tocar como siempre) pero se apartan a la capa 1, que la cámara no dibuja.
// Si una pieza agrupada se mueve, cambia de material o se oculta/muestra, se la devuelve a dibujarse sola
// y su lote se rehace sin ella. Lo que aparece después (obras, mejoras) se agrupa cuando lleva un rato quieto.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CAPA_OCULTA = 1, ZONA = 30;   // lotes por cuadrantes de 30 m: rehacer uno no traba

export function crearLotes(scene, { excluir = () => false } = {}) {
  const grupo = new THREE.Group(); grupo.name = 'lotes'; scene.add(grupo);
  const fichas = new Map();      // malla original -> { m: matriz, vis, mat, geo, ver, lote }
  const dinamicas = new WeakSet(); // las que ya demostraron moverse: nunca se agrupan
  const lotes = new Map();       // clave -> { malla, miembros: Set }
  const sucios = new Set();
  let cuadro = 0, pendientes = new Map(), ultimoBarrido = -1e9, reloj = 0;

  const visible = (o) => { for (; o; o = o.parent) { if (!o.visible || o.userData.agente || o.userData.sinLote) return false; if (o === scene) return true; } return false; };
  const apta = (o) => o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && !o.isLote && !Array.isArray(o.material) && !o.material.transparent
    && !o.morphTargetInfluences && o.geometry.attributes.position && !dinamicas.has(o) && o.matrixWorld.determinant() > 0 && !excluir(o);
  const firma = (g) => Object.keys(g.attributes).sort().join(',') + (g.index ? '#i' : '#n');
  const v3 = new THREE.Vector3();
  const zona = (o) => { v3.setFromMatrixPosition(o.matrixWorld); return `${Math.floor(v3.x / ZONA)},${Math.floor(v3.z / ZONA)}`; };
  // apariencia del material: piezas con materiales distintos pero iguales a la vista van al mismo lote
  let cacheFirma = new Map();
  const hex = (c) => (c ? c.getHex() : -1);
  function aspecto(m) {
    let f = cacheFirma.get(m); if (f) return f;
    f = [m.type, hex(m.color), hex(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid, m.normalMap?.uuid, m.roughnessMap?.uuid,
      m.side, m.flatShading, m.vertexColors, m.alphaTest, m.transparent, m.opacity, m.wireframe, m.fog, m.depthWrite, m.polygonOffset, m.visible, m.customProgramCacheKey?.()].join('|');
    cacheFirma.set(m, f); return f;
  }
  const claveDe = (o) => `${zona(o)}|${aspecto(o.material)}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${firma(o.geometry)}`;
  const foto = (o) => ({ m: Float32Array.from(o.matrixWorld.elements), vis: visible(o), mat: aspecto(o.material), geo: o.geometry, ver: o.geometry.attributes.position.version });
  function igual(o, f) {
    if (aspecto(o.material) !== f.mat || o.geometry !== f.geo || o.geometry.attributes.position.version !== f.ver) return false;
    const e = o.matrixWorld.elements; for (let i = 0; i < 16; i++) if (Math.abs(e[i] - f.m[i]) > 1e-5) return false;
    return visible(o) === f.vis;
  }

  function construir(clave) {
    const L = lotes.get(clave); if (!L) return;
    if (L.malla) { grupo.remove(L.malla); L.malla.geometry.dispose(); L.malla = null; }
    if (!L.miembros.size) { lotes.delete(clave); return; }
    for (const o of [...L.miembros]) if (!visible(o)) soltar(o, false);   // quitada de la escena u oculta: fuera del lote
    sucios.delete(clave);
    if (!L.miembros.size) { lotes.delete(clave); return; }
    const geos = []; let ejemplo = null;
    for (const o of L.miembros) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k]; geos.push(g); ejemplo = o; }
    const geo = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    if (!geo) { for (const o of [...L.miembros]) soltar(o, true); lotes.delete(clave); return; }
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, ejemplo.material);
    m.isLote = true; m.castShadow = ejemplo.castShadow; m.receiveShadow = ejemplo.receiveShadow;
    m.matrixAutoUpdate = false; m.raycast = () => {};
    grupo.add(m); L.malla = m;
    // recién ahora se apartan los originales: nunca hay un cuadro sin la pieza (ni con la pieza dos veces)
    for (const o of L.miembros) o.layers.set(CAPA_OCULTA);
  }

  function agrupar(o) {
    const clave = claveDe(o);
    let L = lotes.get(clave); if (!L) lotes.set(clave, (L = { malla: null, miembros: new Set() }));
    L.miembros.add(o); o.userData._capas = o.layers.mask;
    fichas.set(o, { ...foto(o), lote: clave }); sucios.add(clave);
  }
  // si cambia una vez (crece, se construye), vuelve a agruparse cuando se aquiete; si cambia seguido, queda suelta
  function soltar(o, marcarDinamica) {
    const f = fichas.get(o); if (!f) return;
    if (marcarDinamica && reloj - (o.userData._cambio ?? -1e9) > 30) { marcarDinamica = false; o.userData._cambio = reloj; }
    fichas.delete(o); o.layers.mask = o.userData._capas ?? 1;
    const L = lotes.get(f.lote); if (L) { L.miembros.delete(o); sucios.add(f.lote); }
    if (marcarDinamica) dinamicas.add(o);
  }

  // busca piezas nuevas y quietas: las anota y, si al siguiente barrido siguen igual, las agrupa
  function barrer() {
    const vistas = new Map();
    scene.traverse((o) => {
      if (o === grupo || !apta(o) || fichas.has(o)) return;
      const p = pendientes.get(o);
      if (p && igual(o, p)) { if (p.vis) agrupar(o); else vistas.set(o, p); }
      else if (p && reloj - (o.userData._cambio ?? -1e9) < 30) dinamicas.add(o);   // cambia seguido: es de las que se mueven
      else { if (p) o.userData._cambio = reloj; vistas.set(o, foto(o)); }
    });
    pendientes = vistas;
  }

  return {
    grupo,
    // se llama después de dibujar (las matrices del mundo ya están al día)
    revisar(dt = 0.016) {
      reloj += dt; cuadro++;
      if (cuadro % 12 === 0) cacheFirma = new Map();
      if (cuadro % 12 === 0) {
        const antes = new Set(sucios); sucios.clear();
        for (const [o, f] of fichas) if (!igual(o, f)) soltar(o, true);
        for (const c of sucios) construir(c);   // lo que se soltó se rehace ya: la pieza no queda dibujada dos veces
        sucios.clear(); for (const c of antes) sucios.add(c);
      }
      if (reloj - ultimoBarrido > (lotes.size ? 8 : 2.5)) { ultimoBarrido = reloj; cacheFirma = new Map(); barrer(); }
      // rehace pocos lotes por cuadro para no trabar
      let n = 0; for (const c of sucios) { sucios.delete(c); construir(c); if (++n >= 3) break; }
    },
    // (depuración) piezas agrupadas que ya no están en la escena o se ocultaron
    fantasmas() { let n = 0; for (const o of fichas.keys()) if (!visible(o)) n++; return n; },
    get info() { let piezas = 0; for (const L of lotes.values()) piezas += L.miembros.size; return { lotes: lotes.size, piezas }; },
  };
}
