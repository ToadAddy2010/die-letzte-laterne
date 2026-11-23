import { G } from '../game/state.js';

const CS = 60, grid = new Map();
const key = (x, z) => Math.floor(x / CS) * 100000 + Math.floor(z / CS);
const put = (x0, z0, x1, z1, o) => {
  for (let x = Math.floor(x0 / CS); x <= Math.floor(x1 / CS); x++) for (let z = Math.floor(z0 / CS); z <= Math.floor(z1 / CS); z++) {
    const k = x * 100000 + z;
    (grid.get(k) || grid.set(k, []).get(k)).push(o);
  }
};
let ox = 0, oz = 0;
export const setOffset = (x, z) => { ox = x; oz = z; };
export const addBox = (cx, cz, hw, hd) => { cx += ox; cz += oz; put(cx - hw, cz - hd, cx + hw, cz + hd, { b: 1, x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd }); };
export const addCircle = (x, z, r) => { x += ox; z += oz; put(x - r, z - r, x + r, z + r, { x, z, r }); };

function pushCircle(p, c, r) {
  const dx = p.x - c.x, dz = p.z - c.z, min = r + c.r, d2 = dx * dx + dz * dz;
  if (d2 >= min * min || d2 < 1e-6) return;
  const d = Math.sqrt(d2), k = (min - d) / d;
  p.x += dx * k; p.z += dz * k;
}
function pushBox(p, b, r) {
  const nx = Math.max(b.x0, Math.min(p.x, b.x1)), nz = Math.max(b.z0, Math.min(p.z, b.z1));
  const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; return; }
  const l = p.x - b.x0, R = b.x1 - p.x, u = p.z - b.z0, D = b.z1 - p.z, m = Math.min(l, R, u, D);
  if (m === l) p.x = b.x0 - r; else if (m === R) p.x = b.x1 + r; else if (m === u) p.z = b.z0 - r; else p.z = b.z1 + r;
}

/** Steht ein Punkt in einem Haus oder festen Bau? Bäume zählen hier nicht. */
export function inBuilt(x, z, r = .4) {
  const seen = grid.get(key(x, z));
  if (!seen) return false;
  for (const o of seen) {
    if (o.b) { if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return true; }
    else if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true;
  }
  return false;
}

export function resolve(p, r) {
  if (G.inDungeon) return G.dungeon.collide(p, r);
  const seen = grid.get(key(p.x, p.z));
  if (seen) for (const o of seen) o.b ? pushBox(p, o, r) : pushCircle(p, o, r);
  if (G.props) for (const c of G.props.colliders(p.x, p.z)) pushCircle(p, c, r);
  const L = 1560;
  p.x = Math.max(-L, Math.min(L, p.x)); p.z = Math.max(-L, Math.min(L, p.z));
}
