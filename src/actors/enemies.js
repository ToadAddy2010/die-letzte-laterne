import { G, emit } from '../game/state.js';
import { makeModel, animate, setFlash } from './models.js';
import { ENEMIES, BOSSES, PACKS, ROAM, WORLD_BOSSES } from '../data/enemies.js';
import { POIS, POI, REGIONS } from '../data/world.js';
import { ITEMS } from '../data/items.js';
import { angDiff, clamp, damp, RNG, TAU } from '../core/util.js';
import { resolve } from '../world/collision.js';
import { heightAt, regionAt, blockedAt } from '../world/terrain.js';
import { groundY } from '../game/fx.js';

const TOWNS = POIS.filter(p => p.type === 'town');
const CAMPS = POIS.filter(p => p.type === 'camp');
let nextId = 0;
const FREE_BOSSES = ['krumnase', 'ossian', 'solgar', 'hrimgar', 'uhrmacher'];
export const inTown = (x, z, pad = 0) => !G.inDungeon && TOWNS.some(t => Math.hypot(t.x - x, t.z - z) < t.r + pad);

class Enemy {
  constructor(type, x, z, o = {}) {
    const bossDef = BOSSES[type], d = bossDef || ENEMIES[type];
    this.id = o.id ?? ++nextId; this.type = type; this.d = d; this.boss = !!bossDef; this.x = x; this.z = z; this.y = groundY(x, z); this.hx = x; this.hz = z;
    const lv = Math.max(d.lv, o.lv || 0), sc = 1 + (lv - d.lv) * .13;
    this.lv = lv;
    const hpMul = bossDef ? 2.4 + clamp(d.lv / 25) * 2.6 : 1.25, dmgMul = bossDef ? 1.3 + clamp(d.lv / 25) * .5 : 1.2;
    const team = !o.id && G.net?.active ? (bossDef ? 1.6 : 1.45) : 1; // Zu zweit halten Gegner mehr aus.
    // Die Flammen-Bosse passen sich an, damit jede Reihenfolge machbar bleibt. Hilfe aus den Städten schwächt sie.
    const fair = FREE_BOSSES.includes(type) && G.player ? clamp((G.player.level + 5) / d.lv, .5, 1) : 1, weak = G.flags[`weak_${type}`] ? 1 : 0;
    this.maxHp = this.hp = Math.round(d.hp * sc * hpMul * team * fair * (weak ? .8 : 1)); this.dmg = d.dmg * (1 + (lv - d.lv) * .09) * dmgMul * (.45 + fair * .55) * (weak ? .9 : 1); this.xp = Math.round(d.xp * (1 + (lv - d.lv) * .1));
    this.model = makeModel(d.model); this.rad = clamp((d.model.scale || 1) * (d.model.kind === 'dragon' ? 3.2 : d.model.kind === 'scorpion' ? 1.1 : d.model.kind === 'spider' ? 1 : .68), .55, 5.5);
    this.yaw = Math.random() * TAU; this.state = 'idle'; this.t = Math.random() * 2; this.anim = Math.random() * 9; this.atk = -1; this.cool = 1 + Math.random(); this.wanderX = x; this.wanderZ = z;
    this.vx = 0; this.vz = 0; this.slow = 0; this.flash = 0; this.dead = false; this.deadT = 0; this.camp = o.camp || null; this.aggro = !!o.aggro; this.phase = 1; this.moveI = 0; this.moveT = 2.2; this.summoned = !!o.summoned;
    this.spd = d.spd * (.92 + Math.random() * .16);
    G.scene.add(this.model.root);
  }
  remove() { G.scene.remove(this.model.root); }
  hurt(dmg, o = {}) {
    if (this.dead) return;
    if (this.boss && this.intro) return;
    dmg = Math.max(1, Math.round(dmg));
    if (G.net?.isGuest) {
      G.net.sendHit(this, dmg, o); this.flash = .1;
      G.ui.floatText(this.x, this.y + this.model.height + .3, this.z, `${dmg}`, o.crit ? 'crit' : o.spell ? 'spell' : 'dmg');
      G.fx.burst(this.x, this.y + this.model.height * .55, this.z, this.bloodColor(), o.crit ? 16 : 8, 7, .2, .42);
      G.audio?.enemyHit();
      return;
    }
    this.hp -= dmg; this.flash = .1; this.aggro = true;
    if (o.slow) this.slow = Math.max(this.slow, o.slow);
    if (o.knock && !this.boss) { this.vx += (o.kx || 0) * o.knock * 2.2; this.vz += (o.kz || 0) * o.knock * 2.2; if (this.state === 'wind' && o.knock > 5) { this.state = 'chase'; this.atk = -1; this.t = .4; } }
    G.ui.floatText(this.x, this.y + this.model.height + .3, this.z, `${dmg}`, o.crit ? 'crit' : o.spell ? 'spell' : 'dmg');
    G.fx.burst(this.x, this.y + this.model.height * .55, this.z, this.bloodColor(), o.crit ? 16 : 8, 7, .2, .42);
    G.audio?.enemyHit();
    if (this.d.ai === 'dummy') { this.hp = this.maxHp; G.tutorial?.onHit(); return; }
    if (this.hp <= 0) this.die();
    else if (this.boss && this.phase === 1 && this.hp < this.maxHp * .5) {
      this.phase = 2; this.spd *= 1.14; G.ui.toast(`${this.d.n} wird wütend!`, 'warn'); G.fx.ring(this.x, this.y, this.z, 12, this.d.bolt, 50); G.audio?.roar();
    }
  }
  bloodColor() { const k = this.d.model.kind; return this.d.model.skull ? 0xe8e2cc : k === 'ghost' ? (this.d.model.c1 ?? 0x7ff2c8) : k === 'shroom' ? 0xff9ad8 : k === 'spider' ? 0xf0bd5a : k === 'imp' ? 0xff9a30 : this.d.model.noFace ? 0xf0bd5a : 0x8affb0; }
  die() {
    this.dead = true; this.state = 'dead'; this.deadT = 0; this.atk = -1;
    const P = G.player, d = this.d;
    P.addXp(this.xp); G.stats.kills++; G.killed[this.type] = (G.killed[this.type] || 0) + 1;
    if (d.gold) P.addGold(Math.round(d.gold * (.7 + Math.random() * .6)), !this.boss);
    if (this.boss) {
      G.bossDead[this.type] = 1;
      for (const id of d.loot || []) P.addItem(id);
      if (G.enemies.boss === this) G.enemies.boss = null;
      G.ui.bossBar(null); G.ui.banner(`${d.n} besiegt`, 'Großer Feind gefallen'); G.audio?.victory();
      G.fx.ring(this.x, this.y, this.z, 16, d.bolt, 70); G.fx.burst(this.x, this.y + 3, this.z, d.bolt, 90, 16, .4, 1.4);
      for (const e of G.enemies.list) if (e.summoned && !e.dead) e.hurt(1e6);
      G.net?.onEnemyDied(this);
      if (G.inDungeon && G.dungeon.active?.poi?.boss === this.type) G.interact.addBossExit();
      emit('boss', this.type);
      G.game?.autosave();
    } else if (!this.summoned) {
      for (const [id, p] of d.drops || []) if (p > 0 && Math.random() < p) P.addItem(id, 1, true);
    }
    if (!this.boss) G.net?.onEnemyDied(this);
    emit('kill', this.type);
    G.audio?.enemyDie();
  }
  face(x, z, rate, dt) { this.yaw += angDiff(this.yaw, Math.atan2(x - this.x, z - this.z)) * Math.min(1, rate * dt); }
  move(x, z, sp, dt) {
    const dx = x - this.x, dz = z - this.z, l = Math.hypot(dx, dz) || 1;
    this.tx = dx / l * sp * (this.slow > 0 ? .55 : 1); this.tz = dz / l * sp * (this.slow > 0 ? .55 : 1);
    this.face(x, z, 8, dt);
  }
  bolt(dirX, dirZ, opts = {}) {
    const d = this.d, h = this.model.height * .62;
    G.fx.bolt({ x: this.x + dirX * (this.rad + .6), y: this.y + h, z: this.z + dirZ * (this.rad + .6), vy: opts.vy ?? 0, dx: dirX, dz: dirZ, speed: opts.speed ?? 23, dmg: opts.dmg ?? this.dmg, owner: 'e', color: d.bolt ?? 0xff5a4a, slow: d.slow, size: opts.size ?? 1 });
  }
  aimBolt(P, spread = 0, opts = {}) {
    const h = this.model.height * .62, dx = P.x + P.vx * .22 - this.x, dz = P.z + P.vz * .22 - this.z, l = Math.hypot(dx, dz) || 1, a = Math.atan2(dx, dz) + spread, sp = opts.speed ?? 23;
    this.bolt(Math.sin(a), Math.cos(a), { ...opts, vy: clamp((P.y + 1.5 - (this.y + h)) / (l / sp), -14, 14) });
  }
  strike(reachMul = 1, arc = 1.15) {
    const P = this.target ?? G.player, dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz);
    if (d > (this.d.reach ?? 2.6) * reachMul + .75 || Math.abs(P.y - this.y) > 4 + this.model.height * .3) return;
    if (Math.acos(clamp((dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (d || 1), -1, 1)) > arc) return;
    P.hurt(this.dmg, this);
  }
  update(dt) {
    this.anim += dt; this.slow = Math.max(0, this.slow - dt);
    if (this.flash > 0) { this.flash -= dt; setFlash(this.model, this.flash > 0); }
    if (this.dead) {
      this.deadT += dt;
      animate(this.model, { t: this.anim, speed: 0, attack: -1, dead: Math.min(1, this.deadT / 1.1) });
      this.sync();
      return;
    }
    this.tx = 0; this.tz = 0;
    const P = this.target = G.net?.active ? G.net.targetFor(this) : G.player, dx = P.x - this.x, dz = P.z - this.z, dist = Math.hypot(dx, dz);
    if (P === G.player ? G.mode === 'play' && !P.dead : true) { this.boss ? this.bossAI(dt, P, dist) : this.ai(dt, P, dist); }
    const k = 1 - Math.exp(-9 * dt);
    this.vx += (this.tx - this.vx) * k; this.vz += (this.tz - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;
    if (dist < this.rad + .8 && dist > .01 && !this.d.float) { const push = (this.rad + .8 - dist); this.x -= dx / dist * push * .5; this.z -= dz / dist * push * .5; }
    resolve(this, Math.min(this.rad, 2.2));
    const g = groundY(this.x, this.z);
    this.y = g;
    animate(this.model, { t: this.anim, speed: Math.hypot(this.vx, this.vz), attack: this.atk });
    this.sync();
  }
  /** Beim Mitspieler rechnet der Gastgeber: Hier wird nur die Bewegung weich nachgezogen. */
  updatePuppet(dt) {
    this.anim += dt;
    if (this.flash > 0) { this.flash -= dt; setFlash(this.model, this.flash > 0); }
    if (this.dead) { this.deadT += dt; animate(this.model, { t: this.anim, speed: 0, attack: -1, dead: Math.min(1, this.deadT / 1.1) }); this.sync(); return; }
    const ox = this.x, oz = this.z;
    this.x = damp(this.x, this.nx ?? this.x, 11, dt); this.z = damp(this.z, this.nz ?? this.z, 11, dt);
    this.yaw += angDiff(this.yaw, this.nyaw ?? this.yaw) * Math.min(1, dt * 12);
    this.y = groundY(this.x, this.z);
    animate(this.model, { t: this.anim, speed: dt > 0 ? Math.hypot(this.x - ox, this.z - oz) / dt : 0, attack: this.atk });
    this.sync();
  }
  sync() { const r = this.model.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw; }
  safe(x, z) { return inTown(x, z, 4); }
  ai(dt, P, dist) {
    const d = this.d, ai = d.ai;
    if (ai === 'dummy') return;
    if (this.treasure) { if (dist < 42) this.move(this.x - (P.x - this.x), this.z - (P.z - this.z), this.spd * 1.3, dt); return; }
    this.cool -= dt; this.t -= dt;
    if (this.state === 'idle') {
      if (this.t <= 0) { const a = Math.random() * TAU, r = 3 + Math.random() * 10; this.wanderX = this.hx + Math.cos(a) * r; this.wanderZ = this.hz + Math.sin(a) * r; this.t = 2 + Math.random() * 4; }
      if (Math.hypot(this.wanderX - this.x, this.wanderZ - this.z) > 1.2 && this.t > 1 && !this.safe(this.wanderX, this.wanderZ)) this.move(this.wanderX, this.wanderZ, this.spd * .35, dt);
      const see = this.aggro ? 90 : 26;
      if (dist < see && !inTown(P.x, P.z, 2) && (!G.inDungeon || G.dungeon.lineClear(this.x, this.z, P.x, P.z))) { this.state = 'chase'; this.aggro = true; G.enemies.alert(this); }
      return;
    }
    if (inTown(P.x, P.z, 3) || (!G.inDungeon && Math.hypot(this.x - this.hx, this.z - this.hz) > 95 && !this.summoned) || dist > 75) {
      if (this.state !== 'return') { this.state = 'return'; this.aggro = false; this.atk = -1; }
    }
    if (this.state === 'return') {
      if (!inTown(P.x, P.z, 3) && dist < 22) { this.state = 'chase'; return; }
      if (Math.hypot(this.hx - this.x, this.hz - this.z) < 2.5) { this.state = 'idle'; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .4); return; }
      this.move(this.hx, this.hz, this.spd, dt);
      return;
    }
    if (this.state === 'wind') {
      this.face(P.x, P.z, d.windup ? 3.4 : 5, dt);
      const w = d.windup ?? .46;
      this.atk = clamp(.32 * (1 - this.t / w), 0, .32);
      if (this.t <= 0) {
        this.state = 'swing'; this.t = .3; this.atk = .36;
        if (d.lunge) { this.vx += Math.sin(this.yaw) * 20; this.vz += Math.cos(this.yaw) * 20; }
        this.strike();
      }
      return;
    }
    if (this.state === 'swing') {
      this.atk = Math.min(1, .36 + (.3 - this.t) / .3 * .64);
      if (this.t <= 0) { this.state = 'chase'; this.atk = -1; this.cool = .9 + Math.random() * .7; }
      return;
    }
    if (this.state === 'shoot') {
      this.face(P.x, P.z, 7, dt);
      this.atk = clamp(.32 * (1 - this.t / .55), 0, .32);
      if (this.t <= 0) {
        this.atk = -1; this.state = 'chase'; this.cool = 1.5 + Math.random() * 1.1;
        if (ai === 'caster' && Math.random() < .42) {
          const px = P.x + P.vx * .4, pz = P.z + P.vz * .4, dmg = this.dmg * 1.15, col = d.bolt;
          G.fx.tele(px, pz, 3.6, .85, col, () => { G.fx.burst(px, groundY(px, pz) + .5, pz, col, 18, 8, .26, .5); if (Math.hypot(P.x - px, P.z - pz) < 4.3) P.hurt(dmg, { x: px, z: pz }); });
        } else this.aimBolt(P);
        G.audio?.enemyShot();
      }
      return;
    }
    const reach = (d.reach ?? 2.6) + P.level * 0;
    if (ai === 'ranged' || ai === 'caster') {
      const range = d.range ?? 18;
      const clear = !G.inDungeon || G.dungeon.lineClear(this.x, this.z, P.x, P.z);
      if (dist > range || !clear) this.move(P.x, P.z, this.spd, dt);
      else if (dist < range * .45) { const ax = this.x - (P.x - this.x), az = this.z - (P.z - this.z); this.move(ax, az, this.spd * .8, dt); this.face(P.x, P.z, 8, dt); }
      else { this.face(P.x, P.z, 7, dt); const side = Math.sin(this.anim * .6 + this.hx) > 0 ? 1 : -1; this.tx = Math.cos(this.yaw) * side * this.spd * .3; this.tz = -Math.sin(this.yaw) * side * this.spd * .3; }
      if (this.cool <= 0 && dist < range * 1.2 && clear) { this.state = 'shoot'; this.t = .55; }
    } else {
      const orbit = dist < reach * 1.8 && this.cool > 0;
      if (orbit) { const side = Math.sin(this.anim * .9 + this.hz) > 0 ? 1 : -1; this.face(P.x, P.z, 8, dt); this.tx = Math.cos(this.yaw) * side * this.spd * .45; this.tz = -Math.sin(this.yaw) * side * this.spd * .45; }
      else if (dist > reach * .85) this.move(P.x, P.z, this.spd, dt);
      if (dist < reach + this.rad * .6 + .4 && this.cool <= 0) { this.state = 'wind'; this.t = d.windup ?? .46; this.atk = 0; }
    }
  }
  bossAI(dt, P, dist) {
    const d = this.d;
    if (!this.aggro) {
      this.t -= dt;
      const trigger = d.world ? 46 : 34;
      if (dist < trigger) { this.aggro = true; G.enemies.engageBoss(this); }
      return;
    }
    if (this.intro) return;
    if (d.world && (dist > 120)) { this.aggro = false; this.hp = this.maxHp; this.phase = 1; if (G.enemies.boss === this) { G.enemies.boss = null; G.ui.bossBar(null); } this.x = this.hx; this.z = this.hz; return; }
    if (this.action) { this.action(dt); return; }
    this.moveT -= dt * (this.phase === 2 ? 1.3 : 1);
    if (dist > (d.reach ?? 4) * .95 + this.rad * .4) this.move(P.x, P.z, this.spd, dt); else this.face(P.x, P.z, 6, dt);
    if (this.moveT <= 0) {
      const list = d.moves;
      let m = list[this.moveI++ % list.length];
      if (dist < (d.reach ?? 4) + 2 && Math.random() < .36) m = list.includes('slash') ? 'slash' : list.includes('slam') ? 'slam' : m;
      if (m === 'summon' && G.enemies.list.filter(e => e.summoned && !e.dead).length >= 3) m = list[this.moveI++ % list.length];
      if (m === 'summon' && !d.summon) m = 'volley';
      this.start(m, P);
    }
  }
  start(m, P) {
    const d = this.d, D = this.dmg, rage = this.phase === 2, col = d.bolt ?? 0xff5a4a, end = wait => { this.action = null; this.atk = -1; this.moveT = wait * (rage ? .78 : 1); };
    let T = 0, fired = false;
    if (m === 'slash') {
      this.action = dt => {
        T += dt; this.face(P.x, P.z, T < .4 ? 5 : 0, dt); this.atk = T < .55 ? T / .55 * .32 : Math.min(1, .36 + (T - .55) / .35 * .64);
        if (!fired && T >= .55) { fired = true; this.strike(1.25, 1.35); G.audio?.swing(); G.fx.ring(this.x + Math.sin(this.yaw) * this.rad, this.y, this.z + Math.cos(this.yaw) * this.rad, 3.4, col, 16); }
        if (T > .95) end(1.2);
      };
    } else if (m === 'slam') {
      const R = Math.max(7, (d.reach ?? 4) * 1.75), cx = this.x, cz = this.z;
      G.fx.tele(cx, cz, R, 1, col, () => { G.fx.ring(cx, this.y, cz, R, col, 46); G.audio?.boom(); P.shake(.55); if (Math.hypot(P.x - cx, P.z - cz) < R + .6 && Math.abs(P.y - groundY(cx, cz)) < 3.2) P.hurt(D * 1.35, { x: cx, z: cz }); });
      this.action = dt => { T += dt; this.atk = T < .95 ? T / .95 * .32 : Math.min(1, .36 + (T - .95) / .3 * .64); if (T > 1.3) end(1.5); };
    } else if (m === 'charge') {
      let dirX = 0, dirZ = 0, hit = false;
      this.action = dt => {
        T += dt;
        if (T < .7) { this.face(P.x, P.z, 5, dt); this.atk = T / .7 * .32; if (Math.random() < .5) G.fx.burst(this.x, this.y + .5, this.z, col, 2, 3, .2, .4); dirX = Math.sin(this.yaw); dirZ = Math.cos(this.yaw); return; }
        if (T < 1.4) {
          this.atk = .4; this.tx = dirX * this.spd * 4; this.tz = dirZ * this.spd * 4; this.vx = this.tx; this.vz = this.tz;
          if (!hit && Math.hypot(P.x - this.x, P.z - this.z) < this.rad + 1.6) { hit = true; P.hurt(D * 1.2, this); }
          if (Math.random() < .7) G.fx.burst(this.x, this.y + .4, this.z, 0xc8c0b0, 2, 3, .3, .5);
          return;
        }
        if (T > 1.85) end(1.3);
      };
    } else if (m === 'volley') {
      const n = rage ? 9 : 6, shots = rage ? 3 : 2;
      this.action = dt => {
        T += dt; this.face(P.x, P.z, 5, dt); this.atk = .28;
        const due = Math.floor((T - .45) / .42) + 1;
        while ((this.shot ?? 0) < Math.min(due, shots)) { this.shot = (this.shot ?? 0) + 1; for (let i = 0; i < n; i++) this.aimBolt(P, (i - (n - 1) / 2) * .17, { dmg: D * .7, speed: 22, size: 1.15 }); G.audio?.enemyShot(); }
        if (T > .6 + shots * .42) { this.shot = 0; end(1.5); }
      };
    } else if (m === 'rain') {
      const n = rage ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = i === 0 ? 0 : Math.random() * TAU, r = i === 0 ? 0 : 3 + Math.random() * 13, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (G.inDungeon && G.dungeon.isWall(x, z)) continue;
        setTimeout(() => {
          if (G.enemies.boss !== this || this.dead) return;
          G.fx.tele(x, z, 3.8, .85, col, () => { G.fx.beam(x, groundY(x, z), z, 3.2, col, .25); G.audio?.boom(); if (Math.hypot(P.x - x, P.z - z) < 4.3) P.hurt(D * .9, { x, z }); });
        }, i * 130);
      }
      this.action = dt => { T += dt; this.atk = .28; if (T > 1.2) end(1.7); };
    } else if (m === 'nova') {
      const R = 15, cx = this.x, cz = this.z;
      G.fx.tele(cx, cz, R, 1.25, col, () => { G.fx.ring(cx, this.y, cz, R, col, 76); G.audio?.boom(); P.shake(.6); if (Math.hypot(P.x - cx, P.z - cz) < R + .4) P.hurt(D * 1.15, { x: cx, z: cz }); });
      this.action = dt => { T += dt; this.atk = .3; if (T > 1.5) end(1.7); };
    } else if (m === 'summon') {
      const n = rage ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + Math.random(), q = { x: this.x + Math.cos(a) * (this.rad + 5), z: this.z + Math.sin(a) * (this.rad + 5) };
        resolve(q, 1);
        G.fx.burst(q.x, groundY(q.x, q.z) + 1, q.z, col, 22, 6, .24, .7);
        const e = new Enemy(d.summon, q.x, q.z, { aggro: true, summoned: true, lv: this.lv - 1 });
        e.state = 'chase'; G.enemies.list.push(e);
      }
      G.audio?.roar();
      this.action = dt => { T += dt; this.atk = .2; if (T > .9) end(1.8); };
    }
  }
}

export class Enemies {
  constructor() { this.list = []; this.byId = new Map(); this.tick = 0; this.camps = {}; this.boss = null; this.inCombat = false; this.rng = RNG(9931); }
  clear() { for (const e of this.list) { e.remove(); e.dead = true; } this.list = []; this.byId.clear(); this.boss = null; G.ui.bossBar(null); }
  /** Übernimmt den Gegnerstand des Gastgebers. Meldet zurück, wenn ein Gegner fehlt. */
  applySnapshot(m) {
    for (const [id, type, maxHp, lv] of Array.isArray(m.n) ? m.n : []) {
      if (this.byId.has(id) || !(BOSSES[type] || ENEMIES[type])) continue;
      const e = new Enemy(type, 0, 0, { id, lv }); e.maxHp = maxHp; e.hp = maxHp; e.placed = false;
      this.list.push(e); this.byId.set(id, e);
    }
    const live = new Set(); let boss = null, missing = false;
    for (const [id, x, z, yaw, hp, atk, fl] of Array.isArray(m.s) ? m.s : []) {
      const e = this.byId.get(id);
      if (!e) { missing = true; continue; }
      live.add(id);
      if (!e.placed) { e.x = x; e.z = z; e.yaw = yaw; e.y = groundY(x, z); e.placed = true; }
      e.nx = x; e.nz = z; e.nyaw = yaw; e.hp = hp; e.atk = atk; e.aggro = !!(fl & 8);
      if (fl & 1 && !e.dead) { e.dead = true; e.deadT = 0; e.atk = -1; G.audio?.enemyDie(); }
      e.state = e.dead ? 'dead' : e.aggro ? 'chase' : 'idle';
      if (fl & 4) boss = e;
    }
    for (let i = this.list.length - 1; i >= 0; i--) { const e = this.list[i]; if (!live.has(e.id)) { e.remove(); e.dead = true; this.byId.delete(e.id); this.list.splice(i, 1); } }
    if (boss !== this.boss) { this.boss = boss; G.ui.bossBar(boss); if (boss) { G.ui.banner(boss.d.n, boss.d.title); G.audio?.roar(); } }
    return missing;
  }
  spawn(type, x, z, o) { const e = new Enemy(type, x, z, o); this.list.push(e); return e; }
  removeEnemy(e) { const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); e.dead = true; e.remove(); if (G.player.lock === e) G.player.lock = null; }
  alert(src) { for (const e of this.list) if (!e.boss && !e.dead && e.state === 'idle' && Math.hypot(e.x - src.x, e.z - src.z) < 15) { e.aggro = true; e.state = 'chase'; } }
  nearestFront(P, range) {
    let best = null, bs = 1e9; const fx = -Math.sin(P.camYaw), fz = -Math.cos(P.camYaw);
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > range) continue;
      const dot = (dx * fx + dz * fz) / (d || 1); if (dot < .15) continue;
      const score = d - dot * 6; if (score < bs) { bs = score; best = e; }
    }
    return best;
  }
  nearestAny(P, range) { let best = null, bd = range; for (const e of this.list) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = e; } } return best; }
  damageArea(x, z, r, dmg) { for (const e of this.list) if (!e.dead && Math.hypot(e.x - x, e.z - z) < r + e.rad) e.hurt(dmg * (.92 + Math.random() * .16), { spell: 1 }); G.net?.pvpArea(x, z, r, dmg); }
  engageBoss(e) {
    this.boss = e;
    G.ui.bossBar(e); G.audio?.roar(); G.audio?.setBattle(3);
    if (e.type === 'morvane' && !G.flags.morvaneMet) {
      G.flags.morvaneMet = 1; e.intro = true;
      G.cut.play('morvane', () => { e.intro = false; }, { stay: true });
    } else G.ui.banner(e.d.n, e.d.title);
  }
  enterDungeon(a) {
    this.clear();
    const lv = a.poi.lvl;
    for (const s of a.spawns) this.spawn(s.type, s.x, s.z, { lv });
    if (!G.bossDead[a.poi.boss]) { const b = this.spawn(a.poi.boss, a.boss.x, a.boss.z); b.yaw = 0; }
  }
  updateWorld(P) {
    const anchors = G.net?.active ? G.net.worldAnchors(P) : [P], near = (x, z) => Math.min(...anchors.map(a => Math.hypot(a.x - x, a.z - z)));
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i], d = near(e.x, e.z);
      if (d > 235 && !(e.boss && this.boss === e)) { e.remove(); this.list.splice(i, 1); if (e.camp) { const c = this.camps[e.camp]; if (c) c.live = Math.max(0, c.live - 1); } }
    }
    for (const c of CAMPS) {
      const d = near(c.x, c.z), st = this.camps[c.id] ??= { live: 0, next: 0, spawned: false };
      if (d < 175) {
        if (!st.spawned && G.t >= st.next) {
          st.spawned = true; st.live = 0;
          const pack = PACKS[c.pack], reg = regionAt(c.x, c.z);
          for (let i = 0; i < c.n; i++) { const a = i / c.n * TAU + .4, r = 9 + (i % 3) * 3; this.spawn(pack[i % pack.length], c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { camp: c.id, lv: reg.lvl }); st.live++; }
        }
      } else if (d > 260 && st.spawned && st.live <= 0) { st.spawned = false; st.next = Math.min(st.next, G.t); }
    }
    for (const [pid, bid] of Object.entries(WORLD_BOSSES)) {
      if (G.bossDead[bid] || this.list.some(e => e.type === bid)) continue;
      const p = POI[pid];
      if (near(p.x, p.z) < 170) { const a = pid === 'l_altarm' ? [0, 26] : pid === 'l_riese' ? [26, 0] : [24, 0]; this.spawn(bid, p.x + a[0], p.z + a[1]); }
    }
    const A = anchors[Math.floor(this.rng() * anchors.length)], reg = regionAt(A.x, A.z), night = G.sky.day < .4, list = ROAM[reg.id][night ? 'night' : 'day'], want = (night ? 9 : 6) + (G.moonGaze > 0 ? 4 : 0);
    const roamers = this.list.filter(e => !e.camp && !e.boss && !e.dead).length;
    if (roamers < want * anchors.length && this.list.length < 34 + (anchors.length - 1) * 14) {
      for (let t = 0; t < 6; t++) {
        const a = this.rng() * TAU, r = 72 + this.rng() * 70, x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
        if (Math.abs(x) > 1520 || Math.abs(z) > 1520 || heightAt(x, z) < .9 || inTown(x, z, 18) || blockedAt(x, z)) continue;
        if (regionAt(x, z) !== reg) continue;
        const type = list[Math.floor(this.rng() * list.length)], pack = ENEMIES[type].lv >= 8 ? 1 : (this.rng() < .45 ? 2 : 1);
        for (let n = 0; n < pack; n++) this.spawn(type, x + n * 3.2, z + n * 2.2, { lv: reg.lvl });
        break;
      }
    }
  }
  update(dt) {
    const P = G.player;
    if (G.net?.isGuest) { for (const e of this.list) e.updatePuppet(dt); this.afterUpdate(P); return; }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]; e.update(dt);
      if (e.dead && e.deadT > 1.5) {
        if (e.camp) { const c = this.camps[e.camp]; if (c) { c.live--; if (c.live <= 0) { c.spawned = false; c.next = G.t + 200; } } }
        e.remove(); this.list.splice(i, 1);
      }
    }
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) {
      const a = this.list[i], b = this.list[j]; if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dz = b.z - a.z, min = a.rad + b.rad; if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz) || .01; if (d >= min) continue;
      const k = (min - d) * .5 / d, wa = a.boss ? .1 : 1, wb = b.boss ? .1 : 1;
      a.x -= dx * k * wa; a.z -= dz * k * wa; b.x += dx * k * wb; b.z += dz * k * wb;
    }
    this.afterUpdate(P);
    if ((G.mode === 'play' || G.net?.active) && !G.inDungeon) { this.tick -= dt; if (this.tick <= 0) { this.tick = .8; this.updateWorld(P); } }
  }
  afterUpdate(P) {
    const foes = this.list.filter(e => !e.dead && e.aggro && e.state !== 'idle' && e.state !== 'return' && Math.hypot(e.x - P.x, e.z - P.z) < 34).length;
    this.inCombat = !!this.boss || foes > 0;
    G.audio?.setBattle(this.boss ? 3 : foes >= 3 ? 2 : foes ? 1 : 0);
    if (this.boss) G.ui.bossBar(this.boss);
  }
}
export { REGIONS, ITEMS };
