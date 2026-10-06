// Generador pseudoaleatorio con semilla (mulberry32) y utilidades de azar. Sin dependencias: sirve en el navegador y en Node.
export function azar(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];
export const entre = (r, a, b) => a + r() * (b - a);
// ruido de valor 2D suave (para terrenos y ciudades procedurales): devuelve f(x, z) en [0, 1]
export function ruido2D(semilla) {
  const h = (x, z) => { let n = (x * 374761393 + z * 668265263 + semilla * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const s = (t) => t * t * (3 - 2 * t);
  return (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), fx = s(x - xi), fz = s(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; };
}
