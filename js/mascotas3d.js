// Berlín y Axel con cuerpo real (Animals Asset Pack de Styloo, CC0).
// El perro trae animaciones; el gato no, así que se le mueven los huesos por código (a partir de su pose de reposo).
import * as THREE from 'three';

const ESTADOS_PERRO = { quieto: 'iddle', camina: 'walk', corre: 'run', juega: 'jump', pelea: 'attack1', sentado: 'iddle', dormido: 'iddle', trepado: 'iddle' };

// ------------------------------------------------------------ perro
const TINTE_PERRO = { cafe: 0xb07a4a, negro: 0x4a4a4e, dorado: 0xe8b860 };
export function armarPerro(gltf, alto = 0.75, opts = {}) {
  const m = gltf.scene;
  const box = new THREE.Box3().setFromObject(m), k = alto / (box.max.y - box.min.y);
  const raiz = new THREE.Group(); raiz.add(m);
  m.scale.setScalar(k); m.rotation.y = -Math.PI / 2;   // mira hacia +x (como el resto de las mascotas)
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (/icosphere/i.test(o.name)) o.visible = false; else if (TINTE_PERRO[opts.pelaje]) { o.material = o.material.clone(); o.material.color.setHex(TINTE_PERRO[opts.pelaje]); } } });
  const mixer = new THREE.AnimationMixer(m), acc = {};
  for (const c of gltf.animations) acc[c.name] = mixer.clipAction(c);
  let actual = null;
  return {
    raiz,
    estado(nombre, ts = 1) {
      const clip = ESTADOS_PERRO[nombre] || 'iddle', a = acc[clip]; if (!a) return;
      a.timeScale = nombre === 'dormido' ? 0.25 : ts;
      // echado: más bajo y de lado
      m.position.y = nombre === 'dormido' ? alto * 0.02 : nombre === 'sentado' ? -alto * 0.12 : 0;
      m.rotation.z = nombre === 'dormido' ? 1.2 : 0;
      if (actual === clip) return;
      a.reset().fadeIn(0.25).play(); if (actual && acc[actual]) acc[actual].fadeOut(0.25); actual = clip;
    },
    update(dt) { mixer.update(dt); },
  };
}

// ------------------------------------------------------------ gato
const PELAJE_GATO = { esmoquin: ['0.045, 0.045, 0.05', '0.95, 0.94, 0.92'], naranja: ['0.78, 0.42, 0.14', '0.98, 0.86, 0.66'], gris: ['0.36, 0.37, 0.4', '0.82, 0.82, 0.84'], negro: ['0.035, 0.035, 0.04', '0.13, 0.13, 0.14'], calico: ['0.62, 0.33, 0.12', '0.96, 0.94, 0.9'] };
export function armarGato(gltf, alto = 0.36, opts = {}) {
  const [oscuro, claro] = PELAJE_GATO[opts.pelaje] || PELAJE_GATO.esmoquin;
  const m = gltf.scene;
  const box = new THREE.Box3().setFromObject(m), k = alto / (box.max.y - box.min.y);
  const raiz = new THREE.Group(), cuerpo = new THREE.Group(); raiz.add(cuerpo); cuerpo.add(m);
  m.scale.setScalar(k); m.rotation.y = Math.PI / 2;    // mira hacia +x
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    if (/icosphere/i.test(o.name)) { o.visible = false; return; }
    // pelaje de esmoquin: negro con pecho, panza, patas y hocico blancos (según la pose de reposo)
    const mat = o.material.clone(); mat.map = null; mat.color.set(0xffffff); mat.roughness = 0.85;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRep;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRep = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRep;').replace('#include <color_fragment>', `#include <color_fragment>
        // vRep: x = ancho, y = alto (0 a 0.32), z = largo (adelante +)
        float blanco = 0.0;
        blanco = max(blanco, 1.0 - smoothstep(0.035, 0.06, vRep.y));                                          // patas
        blanco = max(blanco, (1.0 - smoothstep(0.11, 0.14, vRep.y)) * (1.0 - smoothstep(0.03, 0.05, abs(vRep.x))) * step(-0.12, vRep.z) * (1.0 - step(0.15, vRep.z)));   // panza
        blanco = max(blanco, smoothstep(0.08, 0.1, vRep.z) * (1.0 - smoothstep(0.2, 0.23, vRep.y)) * (1.0 - smoothstep(0.035, 0.055, abs(vRep.x))));                     // pecho
        blanco = max(blanco, smoothstep(0.17, 0.19, vRep.z) * step(0.17, vRep.y) * (1.0 - smoothstep(0.22, 0.245, vRep.y)));                                         // hocico
        diffuseColor.rgb = mix(vec3(${oscuro}), vec3(${claro}), blanco);`);
    };
    o.material = mat;
  });
  // huesos que se mueven: se guarda la pose de reposo
  const hueso = {};
  m.traverse((o) => { if (o.isBone) hueso[o.name] = o; });
  const reposo = new Map();
  for (const b of Object.values(hueso)) reposo.set(b, b.quaternion.clone());
  const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  // (three le quita los puntos a los nombres de los huesos)
  const girar = (n, ang, eje = X) => { const b = hueso[n] || hueso[THREE.PropertyBinding.sanitizeNodeName(n)]; if (!b) return; b.quaternion.copy(reposo.get(b)).multiply(q.setFromAxisAngle(eje, ang)); };
  const PATAS = [['DEF-front_thigh.L', 'DEF-front_shin.L', 0], ['DEF-front_thigh.R', 'DEF-front_shin.R', Math.PI], ['DEF-thigh.L', 'DEF-shin.L', Math.PI], ['DEF-thigh.R', 'DEF-shin.R', 0]];
  const COLA = ['DEF-spine', 'DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003'];
  let est = 'quieto', vel = 1, fase = 0, t = 0;
  return {
    raiz,
    estado(nombre, ts = 1) { est = nombre; vel = ts; },
    update(dt) {
      t += dt;
      const anda = est === 'camina' || est === 'corre';
      fase += dt * (anda ? 9 * vel * (est === 'corre' ? 1.5 : 1) : 0);
      const amp = est === 'corre' ? 0.75 : 0.5;
      const sentado = est === 'sentado' || est === 'trepado', dormido = est === 'dormido';
      for (const [muslo, canilla, des] of PATAS) {
        const atras = !muslo.includes('front');
        let a = anda ? Math.sin(fase + des) * amp : 0, b = anda ? Math.max(0, Math.sin(fase + des + 1.2)) * 0.6 : 0;
        if (sentado && atras) { a = 1.1; b = -1.9; }          // se sienta sobre las patas de atrás
        if (dormido) { a = atras ? 1.2 : -1.2; b = atras ? -2.0 : 1.6; }   // echado con las patas recogidas
        girar(muslo, a); girar(canilla, b);
      }
      const ola = est === 'pelea' ? 14 : anda ? 6 : 1.6;
      COLA.forEach((n, i) => girar(n, Math.sin(t * ola - i * 0.7) * (dormido ? 0.15 : 0.35), Z));
      girar('DEF-spine.011', Math.sin(t * 0.7) * 0.12, Z);   // mueve la cabeza mirando
      // cuerpo: sentado se inclina hacia arriba; echado baja; peleando se arquea
      cuerpo.rotation.z = sentado ? 0.45 : 0;
      cuerpo.position.y = dormido ? -alto * 0.35 : sentado ? -alto * 0.12 : est === 'pelea' ? Math.abs(Math.sin(t * 12)) * alto * 0.25 : 0;
    },
  };
}
