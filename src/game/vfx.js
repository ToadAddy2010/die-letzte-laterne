// Waffenspuren, Druckwellen, Treffer-Blitze und Lichtsäulen für legendäre Beute.
import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';

const N = 16, LEN = { sword: 1.68, great: 2.62, dagger: .82, axe: 1.42, club: 1.66, mace: 1.4, spear: 2.95, scythe: 2.6, staff: 2.2, hammer: 1.7 };
const A = new THREE.Vector3(), B = new THREE.Vector3(), C0 = new THREE.Color();
const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false };

class Trail {
  constructor(scene) {
    this.p = new Float32Array(N * 6); this.a = new Float32Array(N * 2); this.age = new Float32Array(N).fill(9);
    const idx = []; for (let i = 0; i < N - 1; i++) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = this.g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('al', new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      ...add, uniforms: { c: { value: new THREE.Color(0xfff0d0) } },
      vertexShader: 'attribute float al; varying float v; void main(){ v = al; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 c; varying float v; void main(){ gl_FragColor = vec4(c * v * v * 1.7, v); }',
    });
    this.m = new THREE.Mesh(g, this.mat); this.m.frustumCulled = false; this.m.renderOrder = 6; this.m.visible = false; scene.add(this.m);
  }
  push(a, b) {
    this.p.copyWithin(6, 0, (N - 1) * 6); this.age.copyWithin(1, 0, N - 1);
    this.p[0] = a.x; this.p[1] = a.y; this.p[2] = a.z; this.p[3] = b.x; this.p[4] = b.y; this.p[5] = b.z; this.age[0] = 0;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < N; i++) {
      this.age[i] += dt;
      const v = Math.max(0, 1 - this.age[i] / .17) * (1 - i / N);
      this.a[i * 2] = v * .12; this.a[i * 2 + 1] = v; if (v > 0) any = true;
    }
    this.m.visible = any;
    if (any) { this.g.attributes.position.needsUpdate = true; this.g.attributes.al.needsUpdate = true; }
  }
}

const ringGeo = new THREE.RingGeometry(.9, 1, 56).rotateX(-Math.PI / 2), slashGeo = new THREE.RingGeometry(.74, 1, 26, 1, -1, 2);
const pillarGeo = new THREE.CylinderGeometry(.62, 1.15, 60, 16, 1, true).translate(0, 30, 0);

export class VFX {
  constructor(scene) {
    this.scene = scene; this.me = new Trail(scene); this.peer = new Trail(scene); this.fxs = [];
    this.rings = Array.from({ length: 12 }, () => this.make(ringGeo)); this.slashes = Array.from({ length: 10 }, () => this.make(slashGeo));
    this.pillars = [];
  }
  make(geo) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...add, opacity: 0 })); m.visible = false; m.frustumCulled = false; m.renderOrder = 7; m.userData = { life: 0, max: 1, r: 1 }; this.scene.add(m); return m; }
  take(list) { let best = list[0]; for (const m of list) { if (!m.visible) return m; if (m.userData.life < best.userData.life) best = m; } return best; }
  shock(x, y, z, r, color, t = .46) { const m = this.take(this.rings); m.position.set(x, y + .14, z); m.material.color.set(color); m.userData = { life: t, max: t, r }; m.visible = true; }
  slash(x, y, z, color = 0xfff0d0, s = 1.9) {
    const m = this.take(this.slashes), c = G.camera;
    m.position.set(x, y, z); if (c) m.lookAt(c.position); m.rotateZ(Math.random() * 6.283);
    m.material.color.set(color); m.userData = { life: .15, max: .15, r: s }; m.visible = true;
  }
  pillar(x, y, z, color, life = 7) {
    const mat = new THREE.ShaderMaterial({
      ...add, uniforms: { c: { value: new THREE.Color(color) }, k: { value: 1 } },
      vertexShader: 'varying float h; void main(){ h = position.y / 60.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 c; uniform float k; varying float h; void main(){ float a = pow(1. - h, 2.6) * .7 * k; gl_FragColor = vec4(c * a * 1.5, a); }',
    });
    const m = new THREE.Mesh(pillarGeo, mat); m.position.set(x, y, z); m.frustumCulled = false; m.renderOrder = 5; this.scene.add(m);
    this.pillars.push({ m, life, max: life, x, y, z, color });
  }
  clear() { for (const q of this.pillars) { this.scene.remove(q.m); q.m.material.dispose(); } this.pillars = []; for (const m of [...this.rings, ...this.slashes]) m.visible = false; }
  weapon(model, trail, atk, color) {
    const s = model?.wSock, L = LEN[model?.wType];
    if (!s || !L || !(atk >= .14 && atk <= .78) || !model.root.visible) return;
    const up = ['staff', 'spear', 'scythe'].includes(model.wType), dx = up ? -.867 : 0, dz = up ? .5 : 1;
    s.localToWorld(A.set(dx * L * .25, 0, dz * L * .25)); s.localToWorld(B.set(dx * L, 0, dz * L));
    trail.mat.uniforms.c.value.copy(C0.set(color ?? 0xfff0d0)).lerp(C0.clone().set(0xffffff), .35);
    trail.push(A, B);
  }
  update(dt) {
    const P = G.player;
    if (P) this.weapon(P.model, this.me, P.atkT, P.heavy ? 0xffc445 : P.flame ?? undefined);
    const R = G.net?.remote;
    if (R?.model) this.weapon(R.model, this.peer, R.atk);
    this.me.update(dt); this.peer.update(dt);
    for (const m of this.rings) { if (!m.visible) continue; const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } const k = 1 - u.life / u.max, e = 1 - (1 - k) ** 3; m.scale.setScalar(.3 + e * u.r); m.material.opacity = (1 - k) * .9; }
    for (const m of this.slashes) { if (!m.visible) continue; const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } const k = 1 - u.life / u.max; m.scale.setScalar(u.r * (.7 + k * .7)); m.material.opacity = (1 - k) * 1.2; }
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const q = this.pillars[i]; q.life -= dt;
      if (q.life <= 0) { this.scene.remove(q.m); q.m.material.dispose(); this.pillars.splice(i, 1); continue; }
      q.m.material.uniforms.k.value = Math.min(1, q.life / 1.6) * Math.min(1, (q.max - q.life) * 3) * (.82 + Math.sin(G.t * 5) * .18);
      if (Math.random() < dt * 16) G.fx.burst(q.x + (Math.random() - .5) * 1.6, q.y + .4, q.z + (Math.random() - .5) * 1.6, q.color, 1, 1.4, .17, 1.1, -3.4);
    }
  }
}
