// =====================================================================
// Utilidades de interfaz comunes a los orbes (sin dependencias): velocidades, avisos, paneles, diario y gráficas.
// =====================================================================
import { leerCalidad, guardarCalidad } from './orbe3d.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// barra de velocidades: velocidades = [['⏸', 0], ['×1', 1], ...]; onCambio(multiplicador). Devuelve { get mult, barra }
export function barraVelocidades(el, velocidades, clave, inicial = 1, onCambio = () => {}) {
  let i = inicial; try { const v = localStorage.getItem(clave); if (v != null) i = Math.max(0, Math.min(velocidades.length - 1, +v)); } catch { /* sin almacenamiento */ }
  const bs = velocidades.map(([txt], k) => { const b = document.createElement('button'); b.textContent = txt; b.onclick = () => elegir(k); el.append(b); return b; });
  function elegir(k) { i = k; bs.forEach((b, j) => b.classList.toggle('on', j === i)); try { localStorage.setItem(clave, i); } catch { /* sin almacenamiento */ } onCambio(velocidades[i][1]); }
  elegir(i);
  return { get mult() { return velocidades[i][1]; }, elegir, get indice() { return i; } };
}
// botón de calidad HD (auto / alta / ultra): recarga la página
export function botonCalidad(el, antes = () => {}) {
  const NOM = { auto: 'HD auto', alta: 'HD alta', ultra: 'HD ultra' }, SIG = { auto: 'alta', alta: 'ultra', ultra: 'auto' }, m = leerCalidad();
  const b = document.createElement('button'); b.textContent = NOM[m] || NOM.auto; b.title = 'Calidad de imagen';
  b.onclick = () => { antes(); guardarCalidad(SIG[m] || 'auto'); location.reload(); }; el.append(b); return b;
}
export function boton(el, txt, fn, titulo = '') { const b = document.createElement('button'); b.textContent = txt; if (titulo) b.title = titulo; b.onclick = fn; el.append(b); return b; }

// avisos flotantes arriba (se van solos)
let caja = null;
export function aviso(txt, ms = 3800) {
  if (!caja) { caja = document.createElement('div'); caja.className = 'avisos'; document.body.append(caja); }
  const d = document.createElement('div'); d.textContent = txt; caja.prepend(d);
  while (caja.children.length > 3) caja.lastChild.remove();
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 600); }, ms);
}
// panel: abre/cierra; el contenido lo pinta quien lo use. Cierra con el botón [data-cerrar]
export function panel(el, { alCerrar } = {}) {
  el.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  function cerrar() { el.classList.add('off'); alCerrar?.(); }
  return { abrir() { el.classList.remove('off'); }, cerrar, get abierto() { return !el.classList.contains('off'); }, alternar() { el.classList.contains('off') ? el.classList.remove('off') : cerrar(); } };
}
// pinta solo si cambió (para no perder clics ni el scroll)
export function pintarSi(el, html) { if (el._html !== html) { el.innerHTML = html; el._html = html; } }
// diario: [{ texto, tipo, d }] → <ul>
export function htmlDiario(lista, n = 40) { return `<ul class="diario">${lista.slice(0, n).map((l) => `<li class="${l.tipo || ''}">${l.d != null ? `<span class="d">${esc(l.d)}</span>` : ''}${esc(l.texto)}</li>`).join('')}</ul>`; }
// barra con valor 0-100
export function htmlBarra(etq, v, max = 100) { const p = Math.max(0, Math.min(100, v / max * 100)); return `<div class="barraV"><span>${etq}</span><u><i class="${p < 25 ? 'low' : p < 50 ? 'mid' : ''}" style="width:${p.toFixed(0)}%"></i></u></div>`; }
// gráfica de líneas: series = [{ datos: [n...], color }]
export function htmlGrafica(series, alto = 54) {
  const todos = series.flatMap((s) => s.datos); if (todos.length < 2) return `<svg class="graf"></svg>`;
  const mn = Math.min(...todos), mx = Math.max(...todos), r = mx - mn || 1, W = 300;
  return `<svg class="graf" viewBox="0 0 ${W} ${alto}" preserveAspectRatio="none">${series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="2" vector-effect="non-scaling-stroke" points="${s.datos.map((v, i) => `${(i / Math.max(1, s.datos.length - 1) * W).toFixed(1)},${(alto - 4 - (v - mn) / r * (alto - 8)).toFixed(1)}`).join(' ')}"/>`).join('')}</svg>`;
}
// guardar y cargar con respaldo (JSON)
export function guardarJSON(clave, obj) { try { const prev = localStorage.getItem(clave); if (prev) localStorage.setItem(clave + '-respaldo', prev); localStorage.setItem(clave, JSON.stringify(obj)); return true; } catch { return false; } }
export function cargarJSON(clave) { for (const k of [clave, clave + '-respaldo']) { try { const t = localStorage.getItem(k); if (t) return JSON.parse(t); } catch { /* dañado: probar el respaldo */ } } return null; }
// el azar con semilla vive en azar.js (sin dependencias, para probar las simulaciones en Node)
export { azar } from './azar.js';
