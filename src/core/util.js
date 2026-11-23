export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function RNG(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 4; i++) f();
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(f.range(a, b + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  return f;
}
export function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function hash(x, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const NT = new Float32Array(65536);
for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) NT[j << 8 | i] = hash(i, j);
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  let tx = x - xi, tz = z - zi;
  tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const i0 = xi & 255, j0 = (zi & 255) << 8, i1 = (xi + 1) & 255, j1 = ((zi + 1) & 255) << 8;
  const a = NT[j0 | i0], b = NT[j0 | i1], c = NT[j1 | i0], d = NT[j1 | i1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
export function fbm(x, z, oct = 5) {
  let a = .5, v = 0, n = 0;
  for (let i = 0; i < oct; i++) { v += a * vnoise(x, z); n += a; x = x * 2.03 + 13.7; z = z * 2.03 - 7.3; a *= .5; }
  return v / n;
}
export function ridged(x, z, oct = 4) {
  let a = .5, v = 0, n = 0;
  for (let i = 0; i < oct; i++) { v += a * (1 - Math.abs(vnoise(x, z) * 2 - 1)); n += a; x = x * 2.1 + 3.1; z = z * 2.1 + 9.2; a *= .5; }
  return v / n;
}
export const fmtTime = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const yieldQueue = [], yieldChannel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
if (yieldChannel) yieldChannel.port1.onmessage = () => yieldQueue.shift()?.();
export const nextFrame = () => new Promise(r => { if (yieldChannel) { yieldQueue.push(r); yieldChannel.port2.postMessage(0); } else setTimeout(r, 0); });
