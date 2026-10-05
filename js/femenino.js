// Andar y postura femeninos para María: se suman sobre la animación (después de mixer.update).
// La cadera se mece y gira con cada paso, los hombros contrarrestan y los brazos van más pegados al cuerpo.
import * as THREE from 'three';

const Q = THREE.Quaternion, V3 = THREE.Vector3;
export function montarFemenino(modelo, ajuste = {}) {
  const hueso = (n) => modelo.getObjectByName(n);
  const H = { pelvis: hueso('pelvis'), pecho: hueso('spine_03'), brazoL: hueso('upperarm_l'), brazoR: hueso('upperarm_r'), cabeza: hueso('Head') };
  const A = { cadera: 0.14, giro: 0.12, hombros: 0.1, brazos: 0.24, signoBrazos: -1, ...ajuste };
  const pq = new Q(), qw = new Q(), mq = new Q();
  const up = new V3(), fw = new V3();
  function rotar(b, eje, ang) {
    if (!b || !ang) return;
    b.parent.getWorldQuaternion(pq);
    qw.setFromAxisAngle(eje, ang);
    b.quaternion.premultiply(pq.clone().invert().multiply(qw).multiply(pq));
    b.updateMatrixWorld(true);
  }
  return {
    ajuste: A,
    // fase: de 0 a 2π a lo largo del ciclo de caminar; anda: 0 a 1 (cuánto camina)
    aplicar(fase, anda, dePie = true) {
      modelo.updateMatrixWorld(true);
      modelo.getWorldQuaternion(mq);
      up.set(0, 1, 0).applyQuaternion(mq); fw.set(0, 0, 1).applyQuaternion(mq);
      const sn = Math.sin(fase), cs = Math.cos(fase);
      rotar(H.pelvis, fw, A.cadera * sn * anda);          // la cadera baja de un lado a otro
      rotar(H.pelvis, up, A.giro * cs * anda);            // y gira con el paso
      rotar(H.pecho, up, -A.hombros * cs * anda);         // los hombros contrarrestan
      rotar(H.pecho, fw, -A.cadera * 0.4 * sn * anda);
      if (dePie) { rotar(H.brazoL, fw, A.brazos * A.signoBrazos); rotar(H.brazoR, fw, -A.brazos * A.signoBrazos); }   // brazos más pegados al cuerpo
    },
  };
}
