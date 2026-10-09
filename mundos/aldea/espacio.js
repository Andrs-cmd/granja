// =====================================================================
// Mapa espacial de la escala de Kardashev para «La aldea».
// Tres escalas que se abren según K: el planeta natal (K < 1,2), el sistema solar (1,2 a 2) y la galaxia (≥ 2).
// Vive en su propio <div> a pantalla completa con su propio renderer; el bucle solo corre mientras se ve.
//   crearEspacio(host, getEstado) → { alternar(), mostrar(bool), get visible }
// getEstado() se lee en cada cuadro y de forma defensiva (partidas viejas pueden no traer nada).
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const suav = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 2) => x.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
function azar(semilla) { let s = semilla >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const gauss = (r) => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) / 0.577; };

// ---------------------------------------------------------------- lectura defensiva del estado
const PLANETAS = 6; // colonias[].planeta: 0..5 = los otros seis mundos del sistema (el natal no cuenta)
function leer(s) {
  s = s && typeof s === 'object' ? s : {};
  const e = s.espacio && typeof s.espacio === 'object' ? s.espacio : {};
  const K = clamp(num(s.kard, num(e.k, 0)), 0, 3.5);
  const d = s.destino;
  const destino = d && typeof d === 'object' ? d.tipo || null : typeof d === 'string' ? d : null;
  const col = new Array(PLANETAS).fill(0);
  if (Array.isArray(e.colonias)) for (const c of e.colonias) {
    const p = Math.floor(num(c && typeof c === 'object' ? c.planeta : c, -1));
    if (p >= 0 && p < PLANETAS) col[p] = 1;
  }
  return {
    K, era: clamp(num(s.era, 0), 0, 8), destino, especie: typeof s.especie === 'string' ? s.especie : '',
    sat: clamp(num(e.satelites, 0), 0, 30), base: e.lunaBase ? 1 : 0, col,
    dyson: clamp(num(e.dyson, 0)), naves: Math.max(0, num(e.naves, 0)),
    estrellas: Math.max(0, num(e.estrellas, 0)), galaxia: clamp(num(e.galaxia, 0)),
    hitos: Array.isArray(e.hitos) ? e.hitos : [],
  };
}

const LUZ_ESPECIE = { primates: 0xffc46b, corvidos: 0xc9a6ff, canidos: 0xffd896, felinos: 0xff9f6b, reptiles: 0xa6ff8a, insectos: 0x8affe6 };
const TIPOS = [
  { n: 'Tipo 0', t: 'civilización planetaria en desarrollo', f: 'Usa solo una parte de la energía que le llega a su mundo: fuego, combustibles, viento y algo de sol.' },
  { n: 'Tipo I', t: 'domina la energía de su planeta', f: 'Aprovecha toda la potencia disponible en su planeta, cerca de 10¹⁶ W: clima, océanos, volcanes y la luz que recibe.' },
  { n: 'Tipo II', t: 'la energía de su estrella', f: 'Captura la potencia entera de su sol, unos 10²⁶ W, con enjambres de colectores alrededor de la estrella.' },
  { n: 'Tipo III', t: 'la de su galaxia', f: 'Usa la energía de miles de millones de estrellas, unos 10³⁶ W, repartida por toda la galaxia.' },
];
const DESTINOS = { estelar: 'Expansión estelar', trascendencia: 'Trascendencia', gaia: 'Gaia', colmena: 'Mente colmena', destruccion: 'Autodestrucción' };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

const ESCALAS = ['P', 'S', 'G'];
const NOMBRE_ESC = { P: 'Planeta', S: 'Sistema', G: 'Galaxia' };
const autoEscala = (K) => (K < 1.2 ? 'P' : K < 2 ? 'S' : 'G');
const CAM = {
  P: { pos: new THREE.Vector3(1.5, 2.0, 7.4), min: 1.7, max: 14, near: 0.02 },
  S: { pos: new THREE.Vector3(0, 58, 112), min: 14, max: 360, near: 0.3 },
  G: { pos: new THREE.Vector3(0, 135, 185), min: 25, max: 560, near: 1 },
};

// ---------------------------------------------------------------- shaders
const RUIDO = /* glsl */`
float h3(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
`;
const VERT_PLANETA = /* glsl */`
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vP = position; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const FRAG_PLANETA = /* glsl */`
uniform vec3 uSol; uniform vec3 uLuz; uniform float uCiudad, uDorado, uVerde, uOscuro, uT;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
${RUIDO}
void main(){
  vec3 p = normalize(vP);
  float n = fbm(p*1.7 + 3.0);
  float mar = 0.5 - uVerde*0.07;
  float tierra = smoothstep(mar, mar + 0.025, n);
  float alt = fbm(p*4.0 + 11.0);
  vec3 agua = mix(vec3(0.02,0.07,0.2), vec3(0.05,0.24,0.4), smoothstep(mar - 0.12, mar, n));
  vec3 suelo = mix(vec3(0.17,0.33,0.11), vec3(0.47,0.38,0.22), smoothstep(0.42, 0.66, alt));
  suelo = mix(suelo, vec3(0.07,0.45,0.13), uVerde*0.85);
  agua = mix(agua, vec3(0.03,0.22,0.24), uVerde*0.5);
  vec3 col = mix(agua, suelo, tierra);
  float hielo = smoothstep(0.8, 0.88, abs(p.y) + (alt - 0.5)*0.18) * (1.0 - uVerde*0.6);
  col = mix(col, vec3(0.86,0.9,0.95), hielo*(1.0 - uOscuro));
  col = mix(col, mix(vec3(0.05,0.045,0.04), vec3(0.15,0.11,0.09), tierra), uOscuro);
  vec3 N = normalize(vN); vec3 V = normalize(vV);
  float dif = dot(N, uSol);
  float spec = pow(max(dot(reflect(-uSol, N), V), 0.0), 40.0) * (1.0 - tierra) * 0.45 * (1.0 - uOscuro) * step(0.0, dif);
  vec3 c = col*(0.035 + 1.1*max(dif, 0.0)) + spec*vec3(1.0,0.95,0.8);
  float noche = 1.0 - smoothstep(-0.05, 0.25, dif);
  float pob = fbm(p*6.0 + 5.0);
  float pun = vn(p*70.0);
  float ciudades = tierra*(1.0 - hielo) * smoothstep(0.80, 0.92, pob*0.9 + pun*0.38 + uCiudad*0.4 - 0.08) * step(0.01, uCiudad);
  c += uLuz * ciudades * (noche*1.7 + 0.06) * (0.35 + uCiudad) * (1.0 - uOscuro);
  float r = 1.0 - abs(fbm(p*3.0 + 20.0)*2.0 - 1.0);
  float grieta = smoothstep(0.94, 0.99, r) * uOscuro;
  c += vec3(1.0,0.3,0.06) * grieta * (0.55 + 0.45*sin(uT*1.3 + p.x*9.0)) * 1.3;
  vec3 oro = vec3(1.0,0.78,0.32)*(0.5 + 0.6*max(dif, 0.0)) + vec3(1.0,0.9,0.55)*pow(pun, 3.0)*0.7*(0.6+0.4*sin(uT*2.0+p.y*20.0));
  c = mix(c, oro, uDorado*0.85);
  gl_FragColor = vec4(c, 1.0);
}`;
const FRAG_ATM = /* glsl */`
uniform vec3 uSol; uniform vec3 uCol; uniform float uFuerza;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vec3 N = normalize(vN), V = normalize(vV);
  float f = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float d = smoothstep(-0.45, 0.5, dot(N, uSol));
  gl_FragColor = vec4(uCol * f * (0.12 + d) * uFuerza, 1.0); }`;
const VERT_PUNTOS = /* glsl */`
attribute float aTam; attribute vec3 aCol; varying vec3 vC; uniform float uPx, uEsc;
void main(){ vC = aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = max(1.0, aTam*uPx*uEsc/-mv.z); gl_Position = projectionMatrix*mv; }`;
const FRAG_PUNTOS = /* glsl */`
varying vec3 vC; uniform float uAlfa; uniform vec3 uTinte;
void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC*uTinte*a*uAlfa, 1.0); }`;
const VERT_DISCO = /* glsl */`varying vec2 vXZ; void main(){ vXZ = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FRAG_TERRITORIO = /* glsl */`
uniform vec2 uHome; uniform float uReach, uR, uT, uA; uniform vec3 uCol; varying vec2 vXZ;
void main(){
  float s = 3.4; vec2 uv = vXZ / s;
  vec2 r = vec2(1.0, 1.732); vec2 h = r*0.5;
  vec2 a = mod(uv, r) - h; vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a,a) < dot(b,b) ? a : b;
  vec2 c = (uv - gv)*s;
  float dc = length(c - uHome);
  float dentro = 1.0 - step(uReach, dc);
  vec2 q = abs(gv); float hd = max(dot(q, normalize(vec2(1.0,1.732))), q.x);
  float borde = smoothstep(0.43, 0.5, hd);
  float disco = 1.0 - smoothstep(uR*0.82, uR*1.02, length(vXZ));
  float frente = (1.0 - smoothstep(0.0, s*1.4, abs(dc - uReach))) * step(dc, uReach + s*0.5);
  float al = dentro*(0.06 + borde*0.3) + frente*0.22*(0.65 + 0.35*sin(uT*2.2));
  gl_FragColor = vec4(uCol*al*disco*uA, 1.0);
}`;

function texturaBrillo(tam = 128, nucleo = 0.0) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15 + nucleo, 'rgba(255,255,255,.55)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, tam, tam);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaAnillo(tam = 128) {
  const c = document.createElement('canvas'); c.width = c.height = tam; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = tam * 0.05; g.beginPath(); g.arc(tam / 2, tam / 2, tam * 0.36, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.arc(tam / 2, tam / 2, tam * 0.07, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
const sprite = (tex, color, escala, opacidad = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(escala); return s;
};
function materialPuntos(px, escala, alfa = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: px }, uEsc: { value: escala }, uAlfa: { value: alfa }, uTinte: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: VERT_PUNTOS, fragmentShader: FRAG_PUNTOS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
const uniformesPlaneta = () => ({
  uSol: { value: new THREE.Vector3(1, 0, 0) }, uLuz: { value: new THREE.Color(0xffc46b) }, uCiudad: { value: 0.1 },
  uDorado: { value: 0 }, uVerde: { value: 0 }, uOscuro: { value: 0 }, uT: { value: 0 },
});

// ---------------------------------------------------------------- estilos de la capa
const CSS = `
.esp-capa{position:fixed;inset:0;z-index:60;background:#000 radial-gradient(ellipse at 50% 40%,#0b1020 0%,#000 75%);display:none;overflow:hidden;font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e8ecf6;-webkit-user-select:none;user-select:none;touch-action:none}
.esp-capa canvas{display:block;width:100%;height:100%;transition:filter .5s}
.esp-velo{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.esp-etq{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.esp-etq span{position:absolute;left:0;top:0;transform:translate(-50%,-140%);font-size:11px;padding:2px 7px;border-radius:9px;background:rgba(10,14,28,.72);border:1px solid rgba(160,200,255,.28);color:#cfe2ff;white-space:nowrap;letter-spacing:.02em}
.esp-arriba{position:absolute;top:calc(8px + env(safe-area-inset-top));left:8px;right:8px;display:flex;gap:6px;align-items:center;justify-content:space-between;pointer-events:none}
.esp-esc{display:flex;gap:2px;background:rgba(14,17,30,.85);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:3px;pointer-events:auto}
.esp-esc button{border:0;background:transparent;color:#aeb8d0;font:inherit;font-size:12px;padding:7px 9px;border-radius:11px;cursor:pointer;min-height:34px}
.esp-esc button.on{background:#2b3a66;color:#fff}
.esp-esc button.bloq{opacity:.45}
.esp-cerrar{pointer-events:auto;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(14,17,30,.85);color:#fff;font-size:18px;cursor:pointer;flex:none}
.esp-panel{position:absolute;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));background:rgba(12,15,28,.86);border:1px solid rgba(255,255,255,.13);border-radius:16px;padding:10px 12px;max-height:40vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:pan-y}
.esp-k{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.esp-k b{font-size:19px;letter-spacing:.01em}
.esp-k small{color:#9aa6c4;font-size:11px;text-align:right}
.esp-regla{position:relative;height:30px;margin:6px 4px 2px}
.esp-pista{position:absolute;left:0;right:0;top:8px;height:6px;border-radius:3px;background:linear-gradient(90deg,#1d2a44,#22304e)}
.esp-lleno{position:absolute;left:0;top:8px;height:6px;border-radius:3px;background:linear-gradient(90deg,#3a7bd5,#7fd0ff 45%,#ffd36b 75%,#ff8ad8)}
.esp-marca{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;box-shadow:0 0 10px #9fd8ff,0 0 3px #fff}
.esp-tick{position:absolute;top:17px;transform:translateX(-50%);font-size:10px;color:#8f9bb8}
.esp-tick:before{content:'';position:absolute;left:50%;top:-11px;width:1px;height:8px;background:rgba(255,255,255,.35)}
.esp-tipo{font-weight:600;margin-top:4px;color:#fff}
.esp-frase{color:#c2cbe0;font-size:12px;margin-top:2px}
.esp-pot{color:#8f9bb8;font-size:11px;margin-top:4px}
.esp-dest{display:inline-block;margin-top:5px;font-size:11px;padding:2px 8px;border-radius:9px;background:rgba(255,211,107,.14);color:#ffd36b}
.esp-hitos{margin:6px 0 0;padding:6px 0 0;list-style:none;border-top:1px solid rgba(255,255,255,.1);font-size:12px;color:#cdd5e8}
.esp-hitos li{padding:2px 0}
.esp-hitos li i{font-style:normal;color:#7fd0ff;font-size:11px;margin-right:4px}
.esp-hitos summary{cursor:pointer;color:#9aa6c4;font-size:11px}
.esp-aviso{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;background:rgba(10,12,22,.8);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 14px;font-size:13px;display:none;max-width:80vw}
@media (min-width:760px){.esp-panel{left:16px;right:auto;top:64px;bottom:auto;width:330px;max-height:calc(100vh - 90px)}.esp-arriba{left:16px;right:16px}}
`;

// =====================================================================
export function crearEspacio(host, getEstado) {
  const capa = document.createElement('div');
  capa.className = 'esp-capa';
  capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-label', 'Mapa espacial de Kardashev');
  if (!document.getElementById('esp-css')) { const st = document.createElement('style'); st.id = 'esp-css'; st.textContent = CSS; document.head.appendChild(st); }
  capa.innerHTML = `
    <div class="esp-velo"></div><div class="esp-etq"></div>
    <div class="esp-aviso"></div>
    <div class="esp-arriba">
      <div class="esp-esc"><button data-e="auto" class="on">Auto</button><button data-e="P">Planeta</button><button data-e="S">Sistema</button><button data-e="G">Galaxia</button></div>
      <button class="esp-cerrar" aria-label="Cerrar mapa espacial" title="Cerrar">✕</button>
    </div>
    <div class="esp-panel">
      <div class="esp-k"><b>Kardashev 0,00</b><small></small></div>
      <div class="esp-regla"><div class="esp-pista"></div><div class="esp-lleno"></div><div class="esp-marca"></div>
        <span class="esp-tick" style="left:0%">0</span><span class="esp-tick" style="left:33.33%">I</span><span class="esp-tick" style="left:66.66%">II</span><span class="esp-tick" style="left:100%">III</span></div>
      <div class="esp-tipo"></div><div class="esp-frase"></div><div class="esp-pot"></div><div class="esp-destino"></div>
      <details class="esp-hitos" open><summary>Últimos hitos</summary><ul style="margin:4px 0 0;padding:0;list-style:none"></ul></details>
    </div>`;
  host.appendChild(capa);
  const $ = (q) => capa.querySelector(q);
  const velo = $('.esp-velo'), capaEtq = $('.esp-etq'), aviso = $('.esp-aviso');
  const ui = { k: $('.esp-k b'), sig: $('.esp-k small'), lleno: $('.esp-lleno'), marca: $('.esp-marca'), tipo: $('.esp-tipo'), frase: $('.esp-frase'), pot: $('.esp-pot'), dest: $('.esp-destino'), hitos: $('.esp-hitos ul'), hitosBox: $('.esp-hitos') };

  let visible = false, raf = 0, construido = false, primerCuadro = true;
  let manual = null, escala = 'P', trans = null, ultimaUI = 0, cacheUI = {};
  let mundo = null; // todo lo de three se crea al abrir la primera vez (no gasta un contexto WebGL si nunca se abre)

  $('.esp-cerrar').addEventListener('click', () => mostrar(false));
  for (const b of capa.querySelectorAll('.esp-esc button')) b.addEventListener('click', () => { manual = b.dataset.e === 'auto' ? null : b.dataset.e; });
  addEventListener('keydown', (e) => { if (visible && e.key === 'Escape') mostrar(false); });
  addEventListener('resize', () => { if (visible) redimensionar(); });
  let altoPanel = 0;
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { const a = $('.esp-panel').offsetHeight; if (visible && Math.abs(a - altoPanel) > 8) { altoPanel = a; redimensionar(); } }).observe($('.esp-panel'));
  if (innerHeight < 700) $('.esp-hitos').open = false;

  // ---------------------------------------------------------------- construcción de la escena (una vez)
  function construir() {
    construido = true;
    const tactil = matchMedia('(pointer: coarse)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !tactil || devicePixelRatio < 2, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    capa.insertBefore(renderer.domElement, capa.firstChild);
    const px = renderer.getPixelRatio();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 4000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.rotateSpeed = 0.6;
    const brillo = texturaBrillo(), anilloTex = texturaAnillo();
    const r = azar(7331);

    // fondo de estrellas: sigue a la cámara
    const NF = tactil ? 1600 : 2600;
    const fpos = new Float32Array(NF * 3), fcol = new Float32Array(NF * 3), ftam = new Float32Array(NF);
    for (let i = 0; i < NF; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      fpos.set([Math.cos(a) * s * 1500, u * 1500, Math.sin(a) * s * 1500], i * 3);
      const t = r(); const c = t < 0.15 ? [1, 0.85, 0.7] : t < 0.35 ? [0.75, 0.85, 1] : [1, 1, 1];
      const b = 0.35 + r() * 0.65; fcol.set([c[0] * b, c[1] * b, c[2] * b], i * 3); ftam[i] = 1.5 + r() * r() * 5;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('aCol', new THREE.BufferAttribute(fcol, 3)); fg.setAttribute('aTam', new THREE.BufferAttribute(ftam, 1));
    const fondo = new THREE.Points(fg, materialPuntos(px, 1500)); fondo.frustumCulled = false; fondo.renderOrder = -10;
    scene.add(fondo);

    // ================================================================ ESCALA PLANETA
    const P = new THREE.Group(); scene.add(P);
    const solDir = new THREE.Vector3(1, 0.22, 0.45).normalize();
    P.add(new THREE.AmbientLight(0x8899bb, 0.12));
    const solLuz = new THREE.DirectionalLight(0xfff1dd, 2.4); solLuz.position.copy(solDir).multiplyScalar(10); P.add(solLuz);
    const solP = sprite(brillo, 0xffe2a0, 26); solP.position.copy(solDir).multiplyScalar(120); P.add(solP);
    const solP2 = sprite(brillo, 0xfff6e0, 8); solP2.position.copy(solP.position); P.add(solP2);

    const uPl = uniformesPlaneta(); uPl.uSol.value.copy(solDir);
    const planeta = new THREE.Mesh(new THREE.SphereGeometry(1, tactil ? 64 : 96, tactil ? 40 : 64), new THREE.ShaderMaterial({ uniforms: uPl, vertexShader: VERT_PLANETA, fragmentShader: FRAG_PLANETA }));
    planeta.rotation.z = 0.35; P.add(planeta);
    const uAtm = { uSol: { value: solDir.clone() }, uCol: { value: new THREE.Color(0x5fa8ff) }, uFuerza: { value: 1.4 } };
    const atm = new THREE.Mesh(new THREE.SphereGeometry(1.045, 64, 40), new THREE.ShaderMaterial({ uniforms: uAtm, vertexShader: VERT_PLANETA, fragmentShader: FRAG_ATM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    P.add(atm);
    const halo = sprite(brillo, 0x5fa8ff, 3.6, 0); P.add(halo); // halo dorado/verde según destino

    // luna
    const LUNA_R = 3.0;
    const orbLuna = new THREE.LineLoop(circulo(LUNA_R, 128), new THREE.LineBasicMaterial({ color: 0x5a6a90, transparent: true, opacity: 0.35 }));
    P.add(orbLuna);
    const luna = new THREE.Mesh(new THREE.SphereGeometry(0.27, 40, 24), new THREE.MeshStandardMaterial({ color: 0x9a9894, roughness: 0.95 }));
    P.add(luna);
    const baseG = new THREE.Group(); luna.add(baseG);
    const baseDir = new THREE.Vector3(-0.5, 0.55, 0.65).normalize();
    baseG.position.copy(baseDir).multiplyScalar(0.27); baseG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), baseDir);
    const domo = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8e4f0, emissive: 0x334455, metalness: 0.3, roughness: 0.4 }));
    baseG.add(domo);
    const NB = 14, bpos = new Float32Array(NB * 3), bcol = new Float32Array(NB * 3), btam = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { const a = r() * 6.28, d = 0.02 + r() * 0.06; bpos.set([Math.cos(a) * d, 0.004, Math.sin(a) * d], i * 3); bcol.set([1, 0.82, 0.5], i * 3); btam[i] = 3 + r() * 4; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bg.setAttribute('aCol', new THREE.BufferAttribute(bcol, 3)); bg.setAttribute('aTam', new THREE.BufferAttribute(btam, 1));
    const baseLuces = new THREE.Points(bg, materialPuntos(px, 6)); baseG.add(baseLuces);
    const anclaBase = new THREE.Object3D(); anclaBase.position.y = 0.05; baseG.add(anclaBase);

    // satélites (instanciados)
    const SATS = 30;
    const satGeo = mergeGeometries([new THREE.BoxGeometry(0.032, 0.024, 0.024), new THREE.BoxGeometry(0.12, 0.003, 0.032)]);
    const satMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ef, metalness: 0.55, roughness: 0.35, emissive: 0x1d2a3a });
    const sats = new THREE.InstancedMesh(satGeo, satMat, SATS); sats.count = 0; sats.frustumCulled = false; P.add(sats);
    const satD = Array.from({ length: SATS }, () => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 2.4, r() * 6.28, (r() - 0.5) * 1.2));
      const rad = 1.3 + r() * 0.75; return { q, rad, fase: r() * 6.28, vel: 0.9 / Math.pow(rad, 1.5) * (0.7 + r() * 0.4), giro: r() * 6.28 };
    });
    const satPos = Array.from({ length: SATS }, () => new THREE.Vector3());

    // naves (planeta ↔ luna, planeta → espacio)
    const NAVES_P = 24;
    const naveGeo = new THREE.ConeGeometry(0.016, 0.07, 6); naveGeo.rotateX(Math.PI / 2);
    const naveMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
    const naves = new THREE.InstancedMesh(naveGeo, naveMat, NAVES_P); naves.count = 0; naves.frustumCulled = false; P.add(naves);
    const naveD = Array.from({ length: NAVES_P }, (_, i) => {
      const dir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.8, r() - 0.5).normalize();
      const fuera = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).normalize().multiplyScalar(5 + r() * 3);
      return { dir, fuera, fase: r(), vel: 0.05 + r() * 0.06, aLuna: i % 2 === 0 };
    });

    // mente colmena: red de líneas
    const CIUD = Array.from({ length: 14 }, () => new THREE.Vector3(r() - 0.5, (r() - 0.5) * 1.2, r() - 0.5).normalize().multiplyScalar(1.005));
    const MAXSEG = SATS * 2 + CIUD.length + 4;
    const redPos = new Float32Array(MAXSEG * 6);
    const redGeo = new THREE.BufferGeometry(); redGeo.setAttribute('position', new THREE.BufferAttribute(redPos, 3));
    const red = new THREE.LineSegments(redGeo, new THREE.LineBasicMaterial({ color: 0x5ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    red.frustumCulled = false; P.add(red);

    // ================================================================ ESCALA SISTEMA
    const S = new THREE.Group(); scene.add(S);
    S.add(new THREE.AmbientLight(0x8899bb, 0.08));
    const solLuzS = new THREE.PointLight(0xfff2dd, 3.2, 0, 0); S.add(solLuzS);
    const solMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
    const sol = new THREE.Mesh(new THREE.SphereGeometry(4.2, 40, 24), solMat); S.add(sol);
    const solG1 = sprite(brillo, 0xffd27a, 26), solG2 = sprite(brillo, 0xffb050, 60, 0.55); S.add(solG1, solG2);
    // órbitas: una sola llamada
    const ORB = [11, 15.5, 21, 28, 37, 49, 62]; // índice 2 = natal
    const NATAL = 2;
    { const pts = []; for (const R of ORB) for (let i = 0; i < 128; i++) { const a = (i / 128) * 6.283, b = ((i + 1) / 128) * 6.283; pts.push(Math.cos(a) * R, 0, Math.sin(a) * R, Math.cos(b) * R, 0, Math.sin(b) * R); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      S.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x40507a, transparent: true, opacity: 0.4 }))); }
    const DEF_PL = [ // los seis otros mundos (índices 0..5 de colonias[].planeta), en orden de órbita sin el natal
      { orb: 0, tam: 0.7, col: 0xb98a6a, n: 'Ígneo' }, { orb: 1, tam: 1.05, col: 0xe3c48c, n: 'Nuboso' },
      { orb: 3, tam: 0.85, col: 0xc0583a, n: 'Rojo' }, { orb: 4, tam: 2.8, col: 0xd9a66b, n: 'Gigante' },
      { orb: 5, tam: 2.2, col: 0xe8d7a0, n: 'Anillado', anillo: true }, { orb: 6, tam: 1.5, col: 0x9fd3e8, n: 'Helado' },
    ];
    const esfera = new THREE.SphereGeometry(1, 28, 18);
    const toroGeo = new THREE.TorusGeometry(1.75, 0.05, 6, 56);
    const plS = DEF_PL.map((d, i) => {
      const g = new THREE.Group(); S.add(g);
      const m = new THREE.Mesh(esfera, new THREE.MeshStandardMaterial({ color: d.col, roughness: 0.85, emissive: 0x000000 })); m.scale.setScalar(d.tam); g.add(m);
      if (d.anillo) { const an = new THREE.Mesh(new THREE.RingGeometry(d.tam * 1.4, d.tam * 2.2, 48), new THREE.MeshBasicMaterial({ color: 0xcdbb8a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })); an.rotation.x = -1.2; g.add(an); }
      const toro = new THREE.Mesh(toroGeo, new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      toro.scale.setScalar(d.tam); toro.rotation.x = Math.PI / 2 - 0.25; g.add(toro);
      const ancla = new THREE.Object3D(); ancla.position.y = d.tam * 1.3; g.add(ancla);
      return { g, m, toro, ancla, fase: i * 1.7 + 0.4, R: ORB[d.orb], vel: 0.9 / Math.pow(ORB[d.orb], 1.5) * 6, f: 0, d };
    });
    const uNat = uniformesPlaneta();
    const natal = new THREE.Group(); S.add(natal);
    const natalM = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), new THREE.ShaderMaterial({ uniforms: uNat, vertexShader: VERT_PLANETA, fragmentShader: FRAG_PLANETA })); natal.add(natalM);
    const natAtm = new THREE.Mesh(new THREE.SphereGeometry(1.16, 32, 20), new THREE.ShaderMaterial({ uniforms: { uSol: uNat.uSol, uCol: uAtm.uCol, uFuerza: { value: 1.6 } }, vertexShader: VERT_PLANETA, fragmentShader: FRAG_ATM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    natal.add(natAtm);
    const lunaS = new THREE.Mesh(esfera, luna.material); lunaS.scale.setScalar(0.3); natal.add(lunaS);
    const anclaNatal = new THREE.Object3D(); anclaNatal.position.y = 1.6; natal.add(anclaNatal);
    const natalVel = 0.9 / Math.pow(ORB[NATAL], 1.5) * 6;

    // enjambre de Dyson: 4 bandas inclinadas (4 llamadas de dibujo en total)
    const DYS_BANDAS = 4, DYS_N = tactil ? 600 : 900;
    const panelGeo = new THREE.PlaneGeometry(0.42, 0.3);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.35, emissive: 0x3a2a08, side: THREE.DoubleSide });
    const dummy = new THREE.Object3D();
    const bandas = Array.from({ length: DYS_BANDAS }, (_, b) => {
      const grupo = new THREE.Group(); grupo.rotation.set((r() - 0.5) * 1.6, r() * 6.28, (r() - 0.5) * 1.6); if (b === 0) grupo.rotation.set(0.1, 0, 0.05); S.add(grupo);
      const im = new THREE.InstancedMesh(panelGeo, panelMat, DYS_N); im.frustumCulled = false; grupo.add(im);
      const orden = Array.from({ length: DYS_N }, (_, i) => i); for (let i = DYS_N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
      for (let k = 0; k < DYS_N; k++) {
        const i = orden[k], a = (i / DYS_N) * 6.283 + (r() - 0.5) * 0.02, R = 7.2 + r() * 1.8 + b * 0.35;
        dummy.position.set(Math.cos(a) * R, (r() - 0.5) * 1.1, Math.sin(a) * R); dummy.lookAt(0, 0, 0); dummy.rotateZ(r() * 0.6); dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.count = 0; return { grupo, im, vel: (0.05 + r() * 0.05) * (b % 2 ? -1 : 1) };
    });
    const anclaDyson = new THREE.Object3D(); anclaDyson.position.set(0, 9.6, 0); S.add(anclaDyson);

    // naves del sistema: puntos brillantes
    const NAVES_S = 80;
    const nsPos = new Float32Array(NAVES_S * 3), nsCol = new Float32Array(NAVES_S * 3), nsTam = new Float32Array(NAVES_S);
    for (let i = 0; i < NAVES_S; i++) { nsCol.set([0.75, 0.92, 1], i * 3); nsTam[i] = 5 + r() * 3; }
    const nsGeo = new THREE.BufferGeometry(); nsGeo.setAttribute('position', new THREE.BufferAttribute(nsPos, 3)); nsGeo.setAttribute('aCol', new THREE.BufferAttribute(nsCol, 3)); nsGeo.setAttribute('aTam', new THREE.BufferAttribute(nsTam, 1));
    const navesS = new THREE.Points(nsGeo, materialPuntos(px, 120)); navesS.frustumCulled = false; S.add(navesS);
    const nsD = Array.from({ length: NAVES_S }, () => ({ fase: r(), vel: 0.04 + r() * 0.05, dest: Math.floor(r() * 997), lat: (r() - 0.5) * 3 }));

    // ================================================================ ESCALA GALAXIA
    const G = new THREE.Group(); scene.add(G);
    const GR = 100, NG = tactil ? 20000 : 34000, BRAZOS = 4;
    const gpos = new Float32Array(NG * 3), gcol = new Float32Array(NG * 3), gtam = new Float32Array(NG);
    const cN = new THREE.Color(0xffe3a8), cB = new THREE.Color(0x9db8ff), cW = new THREE.Color(0xffffff), cR = new THREE.Color(0xff8fb8), tmp = new THREE.Color();
    const brazo = (rad, k) => k * (Math.PI * 2 / BRAZOS) + Math.log(rad / 6) * 2.1;
    for (let i = 0; i < NG; i++) {
      let x, y, z, rad;
      if (i < NG * 0.22) { rad = Math.abs(gauss(r)) * 11; const a = r() * 6.283; x = Math.cos(a) * rad; z = Math.sin(a) * rad; y = gauss(r) * 3.2 * (1 - rad / 30); tmp.copy(cN).lerp(cW, r() * 0.3); }
      else {
        rad = GR * (0.08 + 0.92 * Math.pow(r(), 0.85)); const k = Math.floor(r() * BRAZOS);
        const disp = (0.32 * (1 - rad / GR) + 0.1) * gauss(r) * 0.6;
        const a = brazo(rad, k) + disp; const jit = gauss(r) * 1.4;
        x = Math.cos(a) * rad + jit; z = Math.sin(a) * rad + gauss(r) * 1.4; y = gauss(r) * 1.3 * (1 - rad / GR * 0.6);
        const t = rad / GR; tmp.copy(cN).lerp(r() < 0.6 ? cB : cW, clamp(t * 1.6)); if (r() < 0.025) tmp.copy(cR);
      }
      const b = 0.45 + r() * 0.55; gpos.set([x, y, z], i * 3); gcol.set([tmp.r * b, tmp.g * b, tmp.b * b], i * 3); gtam[i] = 0.9 + r() * r() * 2.6;
    }
    const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); gGeo.setAttribute('aCol', new THREE.BufferAttribute(gcol, 3)); gGeo.setAttribute('aTam', new THREE.BufferAttribute(gtam, 1));
    const gMat = materialPuntos(px, 150, 0.55);
    const estrellas = new THREE.Points(gGeo, gMat); G.add(estrellas);
    const nucleo = sprite(brillo, 0xffd9a0, 70, 0.7); G.add(nucleo);
    const nucleo2 = sprite(brillo, 0xfff0d0, 22, 0.9); G.add(nucleo2);
    // estrella natal
    const homeR = GR * 0.56, homeA = brazo(homeR, 1);
    const home = new THREE.Vector3(Math.cos(homeA) * homeR, 0, Math.sin(homeA) * homeR);
    const marca = new THREE.Sprite(new THREE.SpriteMaterial({ map: anilloTex, color: 0x7fe3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    marca.position.copy(home); marca.scale.setScalar(6); G.add(marca);
    const anclaHome = new THREE.Object3D(); anclaHome.position.copy(home).add(new THREE.Vector3(0, 2.5, 0)); G.add(anclaHome);
    // estrellas colonizadas: todas ordenadas por distancia a la natal; se dibujan las primeras N
    const ordenG = Array.from({ length: NG }, (_, i) => i);
    const dG = new Float32Array(NG); for (let i = 0; i < NG; i++) dG[i] = Math.hypot(gpos[i * 3] - home.x, gpos[i * 3 + 1] - home.y, gpos[i * 3 + 2] - home.z);
    ordenG.sort((a, b) => dG[a] - dG[b]);
    const cpos = new Float32Array(NG * 3), ccol = new Float32Array(NG * 3), ctam = new Float32Array(NG), cdist = new Float32Array(NG);
    for (let k = 0; k < NG; k++) { const i = ordenG[k]; cpos.set([gpos[i * 3], gpos[i * 3 + 1], gpos[i * 3 + 2]], k * 3); ccol.set([1, 1, 1], k * 3); ctam[k] = 2.2 + r() * 1.5; cdist[k] = dG[i]; }
    const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3)); cGeo.setAttribute('aCol', new THREE.BufferAttribute(ccol, 3)); cGeo.setAttribute('aTam', new THREE.BufferAttribute(ctam, 1));
    cGeo.setDrawRange(0, 0);
    const cMat = materialPuntos(px, 170, 1); const coloniasG = new THREE.Points(cGeo, cMat); coloniasG.frustumCulled = false; G.add(coloniasG);
    // territorio: cuantil de área del disco medido desde la natal
    const muestras = []; { const rr = azar(99); for (let i = 0; i < 3000; i++) { const a = rr() * 6.283, d = Math.sqrt(rr()) * GR * 0.92; muestras.push(Math.hypot(Math.cos(a) * d - home.x, Math.sin(a) * d - home.z)); } muestras.sort((a, b) => a - b); }
    const uTer = { uHome: { value: new THREE.Vector2(home.x, -home.z) }, uReach: { value: 0 }, uR: { value: GR }, uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(0x5fe0ff) } };
    const territorio = new THREE.Mesh(new THREE.CircleGeometry(GR * 1.02, 96), new THREE.ShaderMaterial({ uniforms: uTer, vertexShader: VERT_DISCO, fragmentShader: FRAG_TERRITORIO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    territorio.rotation.x = -Math.PI / 2; territorio.position.y = -0.2; G.add(territorio);
    const anclaTer = new THREE.Object3D(); G.add(anclaTer);

    // ---------------------------------------------------------------- etiquetas 2D
    const etiquetas = [];
    const etiqueta = (texto, obj, esc, vis) => { const el = document.createElement('span'); el.textContent = texto; el.style.display = 'none'; capaEtq.appendChild(el); const e = { el, obj, esc, vis, on: false }; etiquetas.push(e); return e; };
    etiqueta('Base lunar', anclaBase, 'P', () => sm.base > 0.5);
    etiqueta('Tu mundo', anclaNatal, 'S', () => true);
    etiqueta('Enjambre de Dyson', anclaDyson, 'S', () => sm.dyson > 0.02);
    for (const p of plS) etiqueta('Colonia', p.ancla, 'S', () => p.f > 0.5);
    etiqueta('Sol natal', anclaHome, 'G', () => true);
    const etTer = etiqueta('Territorio', anclaTer, 'G', () => uTer.uA.value > 0.3 && uTer.uReach.value > 8);

    mundo = { renderer, scene, camera, controls, fondo, P, S, G, planeta, uPl, uAtm, atm, halo, luna, orbLuna, baseG, baseLuces, domo, sats, satD, satPos, naves, naveD, red, redPos, redGeo, CIUD,
      sol, solMat, solG1, solG2, solLuzS, plS, natal, uNat, natalM, lunaS, natalVel, bandas, navesS, nsPos, nsGeo, nsD, nsCol,
      estrellas, gMat, home, marca, coloniasG, cGeo, cMat, cdist, muestras, uTer, territorio, anclaTer, etiquetas, etTer, NG, GR, dummy, solDir };
  }

  function circulo(R, n) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push(Math.cos(a) * R, 0, Math.sin(a) * R); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; }

  // ---------------------------------------------------------------- estado suavizado
  const sm = { K: 0, sat: 0, base: 0, dyson: 0, naves: 0, estr: 0, gal: 0, ciudad: 0.1, dorado: 0, verde: 0, colmena: 0, destr: 0, col: new Array(PLANETAS).fill(0) };
  const luz = new THREE.Color(0xffc46b), luzObj = new THREE.Color();
  function suavizar(d, dt, de_golpe) {
    const k = de_golpe ? 1 : 1 - Math.exp(-dt * 2.2);
    const ciudad = clamp(0.06 + (d.era / 8) * 0.5 + d.K * 0.28);
    const obj = { K: d.K, sat: d.sat, base: d.base, dyson: d.dyson, naves: d.naves, estr: d.estrellas, gal: d.galaxia, ciudad,
      dorado: d.destino === 'trascendencia' ? 1 : 0, verde: d.destino === 'gaia' ? 1 : 0, colmena: d.destino === 'colmena' ? 1 : 0, destr: d.destino === 'destruccion' ? 1 : 0 };
    for (const key in obj) sm[key] = lerp(sm[key], obj[key], k);
    for (let i = 0; i < PLANETAS; i++) sm.col[i] = lerp(sm.col[i], d.col[i], k);
    luzObj.setHex(LUZ_ESPECIE[d.especie] ?? 0xffc46b);
    if (d.destino === 'colmena') luzObj.setHex(0x7ff6ff);
    luz.lerp(luzObj, k);
  }

  // ---------------------------------------------------------------- escalas y cámara
  const alcanzada = (e, d) => e === 'P' || (e === 'S' && (d.K >= 1 || d.col.some(Boolean) || d.dyson > 0)) || (e === 'G' && (d.K >= 2 || d.estrellas > 0 || d.galaxia > 0));
  function aplicarEscala(e) {
    const m = mundo; escala = e;
    m.P.visible = e === 'P'; m.S.visible = e === 'S'; m.G.visible = e === 'G';
    const c = CAM[e]; m.camera.near = c.near; m.camera.updateProjectionMatrix();
    m.controls.minDistance = c.min; m.controls.maxDistance = c.max; m.controls.target.set(0, 0, 0);
  }
  // en pantallas verticales la cámara se aleja un poco para que el sistema y la galaxia quepan a lo ancho
  const lejos = (e) => { const a = mundo.camera.aspect || 1; const f = a < 1 ? clamp(0.8 / a, 1, 2) : 1; return e === 'P' ? Math.sqrt(f) : f; };
  function camaraPorDefecto(e) { mundo.camera.position.copy(CAM[e].pos).multiplyScalar(lejos(e)); mundo.controls.target.set(0, 0, 0); mundo.controls.update(); }

  function redimensionar() {
    if (!mundo) return;
    const w = capa.clientWidth || innerWidth, h = capa.clientHeight || innerHeight;
    mundo.renderer.setSize(w, h, false);
    mundo.camera.aspect = w / h;
    mundo.camera.fov = w < h ? 58 : 45; // vertical en móvil: más campo para que quepa todo
    // si el panel va abajo (pantallas angostas), el centro de la escena sube para que no quede tapado
    const pan = $('.esp-panel'), abajo = !matchMedia('(min-width: 760px)').matches;
    const dsp = abajo ? Math.min(pan.offsetHeight, h * 0.5) * 0.5 : 0;
    if (dsp > 1) mundo.camera.setViewOffset(w, h, 0, dsp, w, h); else mundo.camera.clearViewOffset();
    mundo.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- cuadro
  let tPrev = 0, tiempo = 0;
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), off0 = new THREE.Vector3(), cT = new THREE.Color();
  function cuadro(ahora) {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, tPrev ? (ahora - tPrev) / 1000 : 0.016); tPrev = ahora; tiempo += dt;
    let s = null; try { s = getEstado && getEstado(); } catch { s = null; }
    const d = leer(s);
    suavizar(d, dt, primerCuadro);
    const m = mundo;

    // escala objetivo + transición
    const obj = manual || autoEscala(d.K);
    if (primerCuadro) { aplicarEscala(obj); camaraPorDefecto(obj); }
    primerCuadro = false;
    if (!trans && obj !== escala) {
      trans = { de: escala, a: obj, t: 0, dir: ESCALAS.indexOf(obj) > ESCALAS.indexOf(escala) ? 1 : -1, cambiado: false };
      off0.copy(m.camera.position).sub(m.controls.target); m.controls.enabled = false;
    }
    if (trans) {
      trans.t += dt / 1.5;
      const t = trans.t;
      if (t < 0.5) {
        const e = suav(t * 2); m.camera.position.copy(m.controls.target).addScaledVector(off0, trans.dir > 0 ? lerp(1, 3.2, e) : lerp(1, 0.4, e));
        velo.style.opacity = String(suav((t - 0.15) / 0.35));
      } else {
        if (!trans.cambiado) { trans.cambiado = true; aplicarEscala(trans.a); off0.copy(CAM[trans.a].pos).multiplyScalar(lejos(trans.a)); }
        const e = suav((t - 0.5) * 2); m.camera.position.copy(off0).multiplyScalar(trans.dir > 0 ? lerp(0.45, 1, e) : lerp(2.6, 1, e));
        velo.style.opacity = String(1 - suav((t - 0.5) / 0.35));
      }
      m.camera.lookAt(m.controls.target);
      if (t >= 1) { trans = null; velo.style.opacity = '0'; m.controls.enabled = true; m.controls.update(); }
    } else m.controls.update();

    // vistas aún no alcanzadas: difusas
    const bloq = !alcanzada(escala, d);
    const filtro = bloq ? 'blur(7px) saturate(.35) brightness(.7)' : '';
    if (m.renderer.domElement.style.filter !== filtro) m.renderer.domElement.style.filter = filtro;
    const msj = bloq ? (escala === 'S' ? 'Escala del sistema solar: se abre al llegar a Kardashev 1 (Tipo I).' : 'Escala galáctica: se abre al llegar a Kardashev 2 (Tipo II).') : '';
    if (aviso.textContent !== msj) { aviso.textContent = msj; aviso.style.display = msj ? 'block' : 'none'; }

    m.fondo.position.copy(m.camera.position);
    if (escala === 'P') cuadroPlaneta(dt); else if (escala === 'S') cuadroSistema(dt); else cuadroGalaxia(dt);

    m.renderer.render(m.scene, m.camera);
    etiquetasCuadro(bloq);
    if (ahora - ultimaUI > 250) { ultimaUI = ahora; pintarUI(d, bloq); }
  }

  function aplicarPlaneta(u) {
    u.uCiudad.value = sm.ciudad * (1 - sm.destr * 0.95); u.uLuz.value.copy(luz);
    u.uDorado.value = sm.dorado; u.uVerde.value = sm.verde; u.uOscuro.value = sm.destr; u.uT.value = tiempo;
  }
  function colorAtm(c) {
    c.setRGB(0.37, 0.66, 1);
    c.lerp(cT.setRGB(1, 0.8, 0.35), sm.dorado).lerp(cT.setRGB(0.45, 1, 0.55), sm.verde * 0.7).lerp(cT.setRGB(0.5, 0.32, 0.25), sm.destr * 0.85).lerp(cT.setRGB(0.4, 1, 1), sm.colmena * 0.4);
  }

  function cuadroPlaneta(dt) {
    const m = mundo;
    m.planeta.rotation.y += dt * 0.06;
    aplicarPlaneta(m.uPl); colorAtm(m.uAtm.uCol.value);
    m.uAtm.uFuerza.value = 1.4 + sm.dorado * 1.2 - sm.destr * 0.6;
    m.halo.material.opacity = sm.dorado * (0.55 + 0.1 * Math.sin(tiempo * 2)) + sm.verde * 0.18;
    m.halo.material.color.setRGB(1, 0.82, 0.4).lerp(cT.setRGB(0.4, 1, 0.5), sm.verde);
    // luna
    const la = tiempo * 0.07 + 0.6;
    m.luna.position.set(Math.cos(la) * 3.0, Math.sin(la) * 0.2, Math.sin(la) * 3.0);
    m.luna.rotation.y = -la + 2.2; // misma cara hacia el planeta
    m.baseG.visible = sm.base > 0.02; m.baseG.scale.setScalar(Math.max(0.001, sm.base));
    m.baseLuces.material.uniforms.uAlfa.value = sm.base * (0.75 + 0.25 * Math.sin(tiempo * 5));
    // satélites
    const n = Math.min(30, Math.ceil(sm.sat - 0.02));
    const muertos = sm.destr;
    m.sats.count = n;
    m.dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const sd = m.satD[i];
      sd.fase += dt * sd.vel * (1 - muertos * 0.85);
      v.set(Math.cos(sd.fase) * sd.rad, 0, Math.sin(sd.fase) * sd.rad).applyQuaternion(sd.q);
      if (muertos > 0.01) v.multiplyScalar(1 + muertos * 0.25 * ((i % 5) / 5)); // se dispersan
      m.satPos[i].copy(v);
      m.dummy.position.copy(v);
      m.dummy.lookAt(0, 0, 0);
      sd.giro += dt * muertos * (0.6 + (i % 3));
      if (muertos > 0.01) m.dummy.rotateX(sd.giro);
      const esc = i === n - 1 ? clamp(sm.sat - (n - 1)) : 1;
      m.dummy.scale.setScalar(Math.max(0.001, esc));
      m.dummy.updateMatrix(); m.sats.setMatrixAt(i, m.dummy.matrix);
    }
    m.dummy.scale.setScalar(1);
    m.sats.instanceMatrix.needsUpdate = true;
    m.sats.material.color.setRGB(0.9, 0.92, 0.94).lerp(cT.setRGB(0.22, 0.19, 0.17), muertos);
    m.sats.material.emissive.setRGB(0.11, 0.16, 0.23).lerp(cT.setRGB(0.4, 0.95, 1), sm.colmena * 0.45).multiplyScalar(1 - muertos);
    // naves
    const nn = Math.min(24, Math.round(sm.naves * (1 - muertos)));
    m.naves.count = nn;
    const baseMundo = v2; m.baseG.getWorldPosition(baseMundo);
    for (let i = 0; i < nn; i++) {
      const nd = m.naveD[i];
      const u = (tiempo * nd.vel + nd.fase) % 1, w = u < 0.5 ? u * 2 : 2 - u * 2, ida = u < 0.5;
      const destino = nd.aLuna && sm.base > 0.5 ? baseMundo : nd.fuera;
      posNave(nd, destino, suav(w), v); posNave(nd, destino, suav(clamp(w + (ida ? 0.01 : -0.01))), v3);
      m.dummy.position.copy(v); m.dummy.lookAt(v3);
      m.dummy.scale.setScalar(Math.max(0.001, suav(w / 0.06) * (nd.aLuna ? 1 : 1 - suav((w - 0.85) / 0.15))));
      m.dummy.updateMatrix(); m.naves.setMatrixAt(i, m.dummy.matrix);
    }
    m.dummy.scale.setScalar(1);
    m.naves.instanceMatrix.needsUpdate = true;
    m.naves.material.color.copy(luz).lerp(cT.setRGB(0.8, 0.95, 1), 0.6);
    // red de la mente colmena
    const red = m.red; red.visible = sm.colmena > 0.01;
    if (red.visible) {
      let k = 0; const P = m.redPos;
      const seg = (a, b) => { P[k++] = a.x; P[k++] = a.y; P[k++] = a.z; P[k++] = b.x; P[k++] = b.y; P[k++] = b.z; };
      const ciud = m.CIUD.map((c) => c.clone().applyMatrix4(m.planeta.matrixWorld));
      for (let i = 0; i < ciud.length; i++) seg(ciud[i], ciud[(i + 1) % ciud.length]);
      for (let i = 0; i < n; i++) {
        let mj = -1, md = 1e9, mc = 0, mcd = 1e9;
        for (let j = 0; j < n; j++) if (j !== i) { const dd = m.satPos[i].distanceToSquared(m.satPos[j]); if (dd < md) { md = dd; mj = j; } }
        for (let j = 0; j < ciud.length; j++) { const dd = m.satPos[i].distanceToSquared(ciud[j]); if (dd < mcd) { mcd = dd; mc = j; } }
        if (mj >= 0) seg(m.satPos[i], m.satPos[mj]);
        seg(m.satPos[i], ciud[mc]);
      }
      m.redGeo.setDrawRange(0, k / 3); m.redGeo.attributes.position.needsUpdate = true;
      red.material.opacity = sm.colmena * (0.55 + 0.25 * Math.sin(tiempo * 3));
    }
  }
  function posNave(nd, destino, w, out) {
    // curva cuadrática desde la superficie hacia el destino, elevándose primero
    const a = v3.copy(nd.dir).multiplyScalar(1.0); const ax = a.x, ay = a.y, az = a.z;
    const cx = ax * 2.2 + destino.x * 0.4, cy = ay * 2.2 + destino.y * 0.4, cz = az * 2.2 + destino.z * 0.4;
    const t1 = 1 - w;
    out.set(t1 * t1 * ax + 2 * t1 * w * cx + w * w * destino.x, t1 * t1 * ay + 2 * t1 * w * cy + w * w * destino.y, t1 * t1 * az + 2 * t1 * w * cz + w * w * destino.z);
    return out;
  }

  function cuadroSistema(dt) {
    const m = mundo;
    // sol: se atenúa y enrojece con la fracción capturada
    const dy = sm.dyson;
    m.solMat.color.setRGB(1, 0.9, 0.63).lerp(cT.setRGB(1, 0.55, 0.32), dy * 0.65).multiplyScalar(1 - dy * 0.25);
    m.solG1.material.opacity = 1 - dy * 0.55; m.solG2.material.opacity = 0.55 * (1 - dy * 0.6);
    m.solG1.material.color.setRGB(1, 0.82, 0.48).lerp(cT.setRGB(1, 0.5, 0.3), dy * 0.6);
    m.solLuzS.intensity = 3.2 * (1 - dy * 0.35);
    // planetas y colonias
    for (let i = 0; i < m.plS.length; i++) {
      const p = m.plS[i]; p.fase += dt * p.vel * 0.02;
      p.g.position.set(Math.cos(p.fase) * p.R, 0, Math.sin(p.fase) * p.R);
      p.m.rotation.y += dt * 0.2;
      p.f = sm.col[i];
      p.toro.material.opacity = p.f * (0.7 + 0.3 * Math.sin(tiempo * 2 + i));
      p.toro.material.color.copy(luz);
      p.toro.rotation.z += dt * 0.4;
      p.m.material.emissive.copy(luz).multiplyScalar(p.f * 0.28);
    }
    const fn = tiempo * m.natalVel * 0.02 + 1.1;
    m.natal.position.set(Math.cos(fn) * 21, 0, Math.sin(fn) * 21);
    m.natalM.rotation.y += dt * 0.25;
    m.uNat.uSol.value.copy(m.natal.position).negate().normalize();
    aplicarPlaneta(m.uNat);
    m.lunaS.position.set(Math.cos(tiempo * 0.5) * 2, 0.1, Math.sin(tiempo * 0.5) * 2);
    // enjambre
    for (const b of m.bandas) { b.im.count = Math.round(dy * b.im.instanceMatrix.count); b.grupo.children[0].rotation.y += dt * b.vel; }
    m.bandas[0].im.material.emissive.setRGB(0.23, 0.16, 0.03).multiplyScalar(0.7 + dy * 0.9);
    // naves
    const nn = Math.min(80, Math.round(sm.naves * (1 - sm.destr)));
    const cols = []; for (let i = 0; i < PLANETAS; i++) if (sm.col[i] > 0.5) cols.push(i);
    const P = m.nsPos;
    for (let i = 0; i < nn; i++) {
      const nd = m.nsD[i];
      const u = (tiempo * nd.vel + nd.fase) % 1, w = suav(u < 0.5 ? u * 2 : 2 - u * 2);
      let dest;
      if (cols.length) dest = m.plS[cols[nd.dest % cols.length]].g.position;
      else dest = m.plS[nd.dest % 2 === 0 ? 2 : 1].g.position; // exploración cercana
      const a = m.natal.position;
      const lat = Math.sin(w * Math.PI) * nd.lat;
      P[i * 3] = lerp(a.x, dest.x, w) + lat; P[i * 3 + 1] = Math.sin(w * Math.PI) * 1.5 + lat * 0.2; P[i * 3 + 2] = lerp(a.z, dest.z, w) - lat;
    }
    m.nsGeo.setDrawRange(0, nn); m.nsGeo.attributes.position.needsUpdate = true;
    m.navesS.material.uniforms.uTinte.value.copy(luz).lerp(cT.setRGB(1, 1, 1), 0.5);
  }

  function cuadroGalaxia(dt) {
    const m = mundo;
    m.G.rotation.y += dt * 0.012;
    m.marca.material.opacity = 0.7 + 0.3 * Math.sin(tiempo * 3);
    m.marca.scale.setScalar(5 + Math.sin(tiempo * 3) * 0.8);
    // colonizadas: estrellas reales + fracción de galaxia
    const nPorFrac = sm.gal * m.NG;
    const n = Math.min(m.NG, Math.round(Math.max(Math.min(sm.estr, m.NG), nPorFrac)));
    m.cGeo.setDrawRange(0, n);
    m.cMat.uniforms.uTinte.value.copy(luz).lerp(cT.setRGB(0.5, 0.95, 1), 0.55);
    m.cMat.uniforms.uAlfa.value = 0.8 + 0.2 * Math.sin(tiempo * 2.5);
    // territorio
    const qi = Math.floor(clamp(sm.gal) * (m.muestras.length - 1));
    const alcance = Math.max(sm.gal > 0.001 ? m.muestras[qi] : 0, n > 0 ? m.cdist[Math.max(0, n - 1)] + 1.5 : 0);
    m.uTer.uReach.value = alcance; m.uTer.uT.value = tiempo;
    m.uTer.uA.value = clamp(alcance / 6) * (1 - sm.destr * 0.7);
    m.uTer.uCol.value.copy(luz).lerp(cT.setRGB(0.37, 0.88, 1), 0.6);
    // ancla de la etiqueta de territorio: en el frente de expansión, del lado de la cámara
    v.copy(m.home).normalize().multiplyScalar(-1);
    m.anclaTer.position.copy(m.home).addScaledVector(v, Math.min(alcance * 0.7, m.home.length() * 0.8)).setY(1.5);
  }

  function etiquetasCuadro(bloq) {
    const m = mundo; const w = capa.clientWidth, h = capa.clientHeight;
    for (const e of m.etiquetas) {
      let on = !trans && !bloq && e.esc === escala && e.vis();
      if (on) {
        e.obj.getWorldPosition(v); v.project(m.camera);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) on = false;
        else e.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-140%)`;
      }
      if (on !== e.on) { e.on = on; e.el.style.display = on ? 'block' : 'none'; }
    }
  }

  // ---------------------------------------------------------------- panel
  function pon(clave, el, prop, valor) { if (cacheUI[clave] !== valor) { cacheUI[clave] = valor; el[prop] = valor; } }
  function pintarUI(d, bloq) {
    const K = d.K, ti = TIPOS[Math.min(3, Math.floor(K))];
    pon('k', ui.k, 'textContent', `Kardashev ${fmt(K)}`);
    const sig = K < 3 ? `Tipo ${['I', 'II', 'III'][Math.floor(K)]} en K ${Math.floor(K) + 1} · faltan ${fmt(Math.floor(K) + 1 - K)}` : 'Escala completa';
    pon('sig', ui.sig, 'textContent', sig);
    const pct = `${(clamp(K / 3) * 100).toFixed(2)}%`;
    pon('lleno', ui.lleno.style, 'width', pct); pon('marca', ui.marca.style, 'left', pct);
    pon('tipo', ui.tipo, 'textContent', `${ti.n}: ${ti.t}`);
    pon('frase', ui.frase, 'textContent', ti.f);
    const ex = 10 * K + 6, ent = Math.floor(ex), man = Math.pow(10, ex - ent);
    pon('pot', ui.pot, 'textContent', `Potencia ≈ ${fmt(man, 1)} × 10${sup(ent)} W · Sagan: K = (log₁₀ P − 6) / 10`);
    pon('dest', ui.dest, 'innerHTML', d.destino && DESTINOS[d.destino] ? `<span class="esp-dest">Destino: ${esc(DESTINOS[d.destino])}</span>` : '');
    const hs = d.hitos.slice(-4).reverse().filter((h) => h && typeof h === 'object' || typeof h === 'string');
    const html = hs.length ? hs.map((h) => {
      if (typeof h === 'string') return `<li>${esc(h)}</li>`;
      const k = typeof h.k === 'number' ? `K ${fmt(h.k, 1)}` : ''; const an = h.anio != null ? `año ${esc(h.anio)}` : '';
      const pre = [k, an].filter(Boolean).join(' · ');
      return `<li>${pre ? `<i>${pre}</i>` : ''}${esc(h.texto ?? '')}</li>`;
    }).join('') : '<li style="color:#8f9bb8">Aún no hay hitos espaciales. Mira al cielo y espera.</li>';
    pon('hitos', ui.hitos, 'innerHTML', html);
    for (const b of capa.querySelectorAll('.esp-esc button')) {
      const e = b.dataset.e, on = e === 'auto' ? manual === null : manual === e;
      b.classList.toggle('on', on);
      const bl = e !== 'auto' && !alcanzada(e, d); b.classList.toggle('bloq', bl);
      b.title = bl ? 'Aún no alcanzada' : e === 'auto' ? 'La cámara sigue el nivel de la civilización' : `Ver ${NOMBRE_ESC[e].toLowerCase()}`;
    }
    void bloq;
  }

  // ---------------------------------------------------------------- API
  function mostrar(si) {
    si = !!si;
    if (si === visible) return;
    visible = si;
    if (si) {
      if (!construido) construir();
      capa.style.display = 'block';
      redimensionar();
      primerCuadro = true; trans = null; tPrev = 0; velo.style.opacity = '0'; mundo.controls.enabled = true; cacheUI = {}; ultimaUI = 0;
      raf = requestAnimationFrame(cuadro);
    } else {
      cancelAnimationFrame(raf); raf = 0;
      capa.style.display = 'none';
    }
  }
  return {
    alternar() { mostrar(!visible); },
    mostrar,
    get visible() { return visible; },
  };
}
