import * as THREE from '../../vendor/three.module.js';
import { G } from './state.js';
import { heightAt } from '../world/terrain.js';

const MAXP = 900, _m = new THREE.Matrix4(), _c = new THREE.Color();
const boltGeo = new THREE.OctahedronGeometry(.42), boltMats = new Map();
const boltMat = c => boltMats.get(c) || boltMats.set(c, new THREE.MeshBasicMaterial({ color: c, fog: false })).get(c);
const circle = new THREE.RingGeometry(.86, 1, 32), disc = new THREE.CircleGeometry(1, 32);
circle.rotateX(-Math.PI / 2); disc.rotateX(-Math.PI / 2);
const beamGeo = new THREE.CylinderGeometry(1, 1, 90, 8, 1, true);

export const groundY = (x, z) => (G.inDungeon ? 0 : Math.max(heightAt(x, z), -.4));

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), MAXP);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = []; this.bolts = []; this.teles = []; this.temp = [];
  }
  burst(x, y, z, color, n = 10, speed = 6, size = .22, life = .6, grav = 9) {
    for (let i = 0; i < n && this.p.length < MAXP; i++) {
      const a = Math.random() * 6.283, b = Math.random() * 1.3 - .25, s = speed * (.35 + Math.random() * .75);
      this.p.push({ x, y, z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + speed * .25, vz: Math.sin(a) * Math.cos(b) * s, l: life * (.6 + Math.random() * .6), L: life, s: size * (.6 + Math.random() * .8), c: color, g: grav });
    }
  }
  ring(x, y, z, r, color, n = 30) {
    for (let i = 0; i < n && this.p.length < MAXP; i++) {
      const a = i / n * 6.283;
      this.p.push({ x: x + Math.cos(a) * r * .15, y: y + .3, z: z + Math.sin(a) * r * .15, vx: Math.cos(a) * r * 2.4, vy: Math.random() * 2, vz: Math.sin(a) * r * 2.4, l: .42, L: .42, s: .34, c: color, g: 2 });
    }
  }
  beam(x, y, z, r, color, t = .34, ghost = false) {
    if (!ghost) G.net?.vfx('m', { x, y, z, r, color, time: t });
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(x, y + 45, z); m.scale.set(r * .55, 1, r * .55);
    this.scene.add(m);
    this.temp.push({ m, l: t, L: t });
    this.burst(x, y + .5, z, color, 26, 11, .3, .6);
  }
  bolt(o) {
    const m = new THREE.Mesh(boltGeo, boltMat(o.color));
    m.position.set(o.x, o.y, o.z); m.scale.setScalar(o.size ?? 1);
    this.scene.add(m);
    this.bolts.push({ ...o, m, l: o.life ?? 2.6, vy: o.vy ?? 0, hit: new Set() });
    if (!o.ghost) G.net?.vfx('b', o);
  }
  tele(x, z, r, time, color, done, ghost = false) {
    if (!ghost) G.net?.vfx('t', { x, z, r, time, color });
    const y = groundY(x, z) + .3, mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .34, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }),
      edge = new THREE.Mesh(circle, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false })), fill = new THREE.Mesh(disc, mat);
    edge.position.set(x, y, z); fill.position.set(x, y, z); edge.scale.setScalar(r); fill.scale.setScalar(.01);
    edge.renderOrder = fill.renderOrder = 7;
    this.scene.add(edge, fill);
    const t = { x, y, z, r, t: time, T: time, edge, fill, done, color };
    this.teles.push(t);
    return t;
  }
  clear() {
    for (const b of this.bolts) this.scene.remove(b.m);
    for (const t of this.teles) { this.scene.remove(t.edge, t.fill); t.edge.material.dispose(); t.fill.material.dispose(); }
    for (const t of this.temp) { this.scene.remove(t.m); t.m.material.dispose(); }
    this.bolts = []; this.teles = []; this.temp = []; this.p = [];
  }
  update(dt) {
    const pl = G.player;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.l -= dt;
      const steps = Math.ceil(b.speed * dt / 1.1);
      let gone = b.l <= 0;
      for (let s = 0; s < steps && !gone; s++) {
        const q = dt / steps;
        b.x += b.dx * b.speed * q; b.z += b.dz * b.speed * q; b.y += b.vy * q;
        if (G.inDungeon ? G.dungeon.isWall(b.x, b.z) : b.y < groundY(b.x, b.z) + .1) { gone = true; break; }
        if (b.owner === 'e') {
          for (const t of G.net?.active ? G.net.boltTargets() : [pl]) {
            if (gone || t.dead || Math.hypot(b.x - t.x, b.z - t.z) >= 1.25 || Math.abs(b.y - (t.y + 1.4)) >= 2.2) continue;
            if (t.hurt(b.dmg, b, { slow: b.slow })) gone = true; else if (t.rolling <= 0) gone = true;
          }
        } else if (b.owner === 'p') {
          if (G.net?.duelOn && G.net.pvpBolt(b) && !b.pierce) { gone = true; break; }
          for (const e of G.enemies.list) {
            if (e.dead || b.hit.has(e)) continue;
            if (Math.hypot(b.x - e.x, b.z - e.z) < e.rad + .9 && Math.abs(b.y - (e.y + e.model.height * .5)) < e.model.height * .7 + 1) {
              b.hit.add(e);
              if (b.aoe) { gone = true; break; }
              e.hurt(b.dmg, { spell: 1, slow: b.slow, from: b });
              if (!b.pierce) { gone = true; break; }
            }
          }
        }
      }
      b.m.position.set(b.x, b.y, b.z); b.m.rotation.x += dt * 9; b.m.rotation.y += dt * 11;
      if (Math.random() < .75) this.burst(b.x, b.y, b.z, b.color, 1, 1, .17, .3, 0);
      if (gone) {
        if (b.aoe && b.owner === 'p') {
          this.burst(b.x, b.y, b.z, b.color, 24, 10, .3, .6);
          G.audio?.boom();
          for (const e of G.enemies.list) if (!e.dead && Math.hypot(b.x - e.x, b.z - e.z) < b.aoe + e.rad) e.hurt(b.dmg, { spell: 1, from: b });
          if (!b.hitPeer) G.net?.pvpArea(b.x, b.z, b.aoe, b.dmg);
        } else this.burst(b.x, b.y, b.z, b.color, 7, 5, .2, .35);
        this.scene.remove(b.m);
        this.bolts.splice(i, 1);
      }
    }
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i]; t.t -= dt;
      const k = 1 - Math.max(0, t.t) / t.T;
      t.fill.scale.setScalar(Math.max(.01, t.r * k));
      if (t.t <= 0) {
        this.scene.remove(t.edge, t.fill); t.edge.material.dispose(); t.fill.material.dispose();
        this.teles.splice(i, 1);
        t.done?.(t);
      }
    }
    for (let i = this.temp.length - 1; i >= 0; i--) {
      const t = this.temp[i]; t.l -= dt;
      t.m.material.opacity = Math.max(0, t.l / t.L) * .8;
      if (t.l <= 0) { this.scene.remove(t.m); t.m.material.dispose(); this.temp.splice(i, 1); }
    }
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i]; q.l -= dt;
      if (q.l <= 0) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const s = q.s * Math.min(1, q.l / q.L * 1.8);
      _m.makeScale(s, s, s); _m.setPosition(q.x, q.y, q.z);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, _c.set(q.c));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
