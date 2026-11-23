import * as THREE from '../../vendor/three.module.js';
import { G, emit } from '../game/state.js';
import { Input as I } from '../core/input.js';
import { makeModel, animate, setFlash } from './models.js';
import { ITEMS, SPELLS } from '../data/items.js';
import { clamp, damp, angDiff } from '../core/util.js';
import { resolve } from '../world/collision.js';
import { heightAt } from '../world/terrain.js';
import { groundY } from '../game/fx.js';

export const xpFor = l => Math.floor(40 * Math.pow(l, 1.45));
/** Aussehen einer Spielfigur. Der Mitspieler trägt die Startrobe in Rot, damit man euch unterscheiden kann. */
export function playerSpec(equip, guest = false) {
  const a = ITEMS[equip.armor], w = ITEMS[equip.weapon], look = { ...(a?.look || {}) };
  if (guest && equip.armor === 'wanderrobe') Object.assign(look, { top: 0xa32638, top2: 0xd8483f, hatColor: 0xa32638 });
  return { kind: 'human', skin: guest ? 0xc99a78 : 0xd8b48e, hair: guest ? 0xd8a24a : 0x4a2c20, ...look, weapon: w?.w, weaponColor: w?.c, lantern: true };
}
const TRINKETS = ['trinket1', 'trinket2'];

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.light = new THREE.PointLight(0xffb060, 10, 26, 1.8);
    scene.add(this.light);
    this.reset();
    this.rebuild();
  }
  reset() {
    Object.assign(this, {
      x: 0, y: 8, z: 200, vx: 0, vz: 0, vy: 0, yaw: Math.PI, camYaw: 0, camPitch: .22, camDist: 8.5, onGround: true,
      level: 1, xp: 0, pts: 0, kraft: 5, geist: 5, ausdauer: 5, hp: 100, mp: 40, st: 100, gold: 25,
      inv: { trank1: 2 }, equip: { weapon: 'holzschwert', armor: 'wanderrobe', trinket1: null, trinket2: null },
      spells: [], cds: {}, potionCd: 0, atkT: -1, atkDur: .44, combo: 0, comboWindow: 0, hitDone: false, rolling: 0, rollX: 0, rollZ: 0, rollCd: 0,
      invuln: 0, blocking: false, slowT: 0, cast: 0, flash: 0, dead: false, downed: false, downT: 0, sprintOn: false, sprintLatch: false, shiftT: 0, shiftWas: false, shiftIgnore: false, idleT: 0, lunge: 0, dashHit: false, lock: null, lastShrine: 's_hutdorf', regenT: 0, anim: 0, flame: null, shardBonus: 0,
    });
    this.recalc(); this.hp = this.maxHp; this.mp = this.maxMp; this.st = this.maxSt;
  }
  gear() { return ['weapon', 'armor', ...TRINKETS].map(s => ITEMS[this.equip[s]]).filter(Boolean); }
  fx(key) { return this.gear().reduce((a, i) => a + (i.fx?.[key] || 0), 0); }
  recalc() {
    const a = ITEMS[this.equip.armor], w = ITEMS[this.equip.weapon], sb = Math.floor(Object.keys(G.shards).length / 5);
    this.shardBonus = sb;
    this.kraftT = this.kraft + this.fx('kraft'); this.geistT = this.geist + this.fx('geist'); this.ausdT = this.ausdauer + this.fx('ausdauer');
    this.maxHp = 80 + this.level * 12 + this.ausdT * 8 + (a?.hp || 0) + this.fx('hp') + sb * 30;
    this.maxMp = 40 + this.level * 4 + this.geistT * 6 + (a?.mp || 0) + this.fx('mp') + sb * 15;
    this.maxSt = 80 + this.ausdT * 4;
    this.atk = (w?.dmg || 2) + this.kraftT * 1.6;
    this.sp = (w?.sp || 0) + this.geistT * 2.1 + this.level * .5;
    this.def = (a?.def || 0);
    this.crit = .05 + this.fx('crit');
    this.speedMul = 1 + this.fx('speed');
    this.hp = Math.min(this.hp, this.maxHp); this.mp = Math.min(this.mp, this.maxMp); this.st = Math.min(this.st, this.maxSt);
  }
  rebuild() {
    if (this.model) this.scene.remove(this.model.root);
    this.model = makeModel(playerSpec(this.equip, !!G.net?.isGuest));
    this.scene.add(this.model.root);
    this.syncModel();
    G.net?.sendLook();
    if (G.mount?.riding) { G.mount.seat(); animate(this.model, { t: this.anim, speed: 0, attack: -1, ride: true }); }
  }
  syncModel() { const r = this.model.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw; }
  place(x, z, y) { this.x = x; this.z = z; this.y = y ?? groundY(x, z); this.vx = this.vz = this.vy = 0; this.syncModel(); }
  count(id) { return this.inv[id] || 0; }
  addItem(id, n = 1, quiet = false) {
    if (!ITEMS[id]) return;
    this.inv[id] = (this.inv[id] || 0) + n;
    if (!quiet) { G.ui.toast(`${ITEMS[id].n}${n > 1 ? ` ×${n}` : ''}`, 'item'); G.audio?.item(ITEMS[id]); }
    emit('item', id);
  }
  removeItem(id, n = 1) { if (!this.inv[id]) return; this.inv[id] -= n; if (this.inv[id] <= 0) delete this.inv[id]; }
  addGold(n, quiet) { this.gold += n; G.stats.gold += n; if (!quiet && n) { G.ui.toast(`+${n} Gold`, 'gold'); G.audio?.coins(n); } }
  addXp(n) {
    this.xp += n;
    let up = false;
    while (this.level < 50 && this.xp >= xpFor(this.level)) { this.xp -= xpFor(this.level); this.level++; this.pts += 2; up = true; }
    if (up) {
      this.recalc(); this.hp = this.maxHp; this.mp = this.maxMp; this.st = this.maxSt;
      G.ui.levelUp(this.level); G.audio?.levelup(); G.fx.ring(this.x, this.y, this.z, 8, 0xffd070, 44); G.fx.burst(this.x, this.y + 2, this.z, 0xffd070, 40, 9, .3, 1);
    }
  }
  equipItem(id) {
    const it = ITEMS[id]; if (!it) return;
    if (it.t === 'weapon') this.equip.weapon = id;
    else if (it.t === 'armor') this.equip.armor = id;
    else if (it.t === 'trinket') {
      if (this.equip.trinket1 === id || this.equip.trinket2 === id) return;
      if (!this.equip.trinket1) this.equip.trinket1 = id; else if (!this.equip.trinket2) this.equip.trinket2 = id; else { this.equip.trinket2 = this.equip.trinket1; this.equip.trinket1 = id; }
    }
    this.recalc(); this.rebuild(); G.audio?.equip(it);
  }
  unequip(slot) { if (slot === 'weapon' || slot === 'armor') return; this.equip[slot] = null; this.recalc(); G.audio?.equip(); }
  isEquipped(id) { return Object.values(this.equip).includes(id); }
  usePotion(kind) {
    if (this.potionCd > 0 || this.dead) return false;
    const list = Object.keys(this.inv).filter(id => ITEMS[id]?.t === 'potion' && (kind === 'hp' ? ITEMS[id].heal : ITEMS[id].mana)).sort((a, b) => (kind === 'hp' ? ITEMS[a].heal - ITEMS[b].heal : ITEMS[a].mana - ITEMS[b].mana));
    if (!list.length) { G.ui.toast(kind === 'hp' ? 'Keine Heiltränke' : 'Keine Manatränke', 'warn'); return false; }
    const need = kind === 'hp' ? this.maxHp - this.hp : this.maxMp - this.mp;
    if (need <= 0) return false;
    const best = list.find(id => (kind === 'hp' ? ITEMS[id].heal : ITEMS[id].mana) >= need) || list[list.length - 1];
    return this.drink(best);
  }
  drink(id) {
    const it = ITEMS[id]; if (!it || it.t !== 'potion' || !this.inv[id]) return false;
    this.hp = Math.min(this.maxHp, this.hp + (it.heal || 0)); this.mp = Math.min(this.maxMp, this.mp + (it.mana || 0));
    this.removeItem(id); this.potionCd = 1.2;
    G.fx.burst(this.x, this.y + 1.6, this.z, it.heal ? 0x6dff8a : 0x5a9fff, 16, 3, .18, .8, -2); G.audio?.drink(it);
    return true;
  }
  knowSpell(id) { if (!this.spells.includes(id)) { this.spells.push(id); G.ui.toast(`Neuer Zauber: ${SPELLS[id].n}`, 'spell'); G.audio?.chime(); } }
  forward() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  aimDir() {
    if (this.lock && !this.lock.dead) { const dx = this.lock.x - this.x, dz = this.lock.z - this.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; }
    return [-Math.sin(this.camYaw), -Math.cos(this.camYaw)];
  }
  castSpell(i) {
    const id = this.spells[i]; if (!id || this.dead) return;
    const s = SPELLS[id];
    if ((this.cds[id] || 0) > 0) return;
    if (this.mp < s.cost) { G.ui.toast('Nicht genug Mana', 'warn'); G.audio?.deny(); return; }
    this.mp -= s.cost; this.cds[id] = s.cd; this.cast = .4;
    const [dx, dz] = this.aimDir(), dmg = (s.dmg || 0) + this.sp * (s.kind === 'nova' || s.kind === 'strike' ? 1.25 : 1), riding = !!G.mount?.riding;
    if (!riding) this.yaw = Math.atan2(dx, dz);
    if (s.kind === 'bolt') { G.fx.bolt({ x: this.x + dx * (riding ? 2.6 : 1.2), y: this.y + (riding ? 4.2 : 2.1), z: this.z + dz * (riding ? 2.6 : 1.2), dx, dz, speed: s.speed, dmg, owner: 'p', color: s.color, aoe: s.aoe, slow: s.slow, pierce: !!s.slow, size: id === 'feuerball' ? 1.5 : 1 }); G.audio?.cast(id); }
    else if (s.kind === 'heal') { const h = s.heal + this.sp * 1.8; this.hp = Math.min(this.maxHp, this.hp + h); G.fx.burst(this.x, this.y + 1.5, this.z, s.color, 34, 5, .22, 1, -3); G.ui.floatText(this.x, this.y + 3, this.z, `+${Math.round(h)}`, 'heal'); G.audio?.chime(); }
    else if (s.kind === 'strike') {
      const t = this.lock && !this.lock.dead ? this.lock : G.enemies.nearestFront(this, 34);
      const px = t ? t.x : this.x + dx * 15, pz = t ? t.z : this.z + dz * 15;
      G.fx.tele(px, pz, s.r, .22, s.color, () => { G.fx.beam(px, groundY(px, pz), pz, s.r, s.color); G.audio?.boom(); G.enemies.damageArea(px, pz, s.r, dmg); });
    } else if (s.kind === 'nova') { G.fx.ring(this.x, this.y, this.z, s.r, s.color, 60); G.audio?.boom(); G.enemies.damageArea(this.x, this.z, s.r, dmg); this.shake(.35); }
    else if (s.kind === 'blink') {
      G.fx.burst(this.x, this.y + 1.5, this.z, s.color, 24, 6, .24, .6);
      const n = 10; let ox = this.x, oz = this.z;
      for (let q = 1; q <= n; q++) {
        const p = { x: ox + dx * s.dist / n, z: oz + dz * s.dist / n }; resolve(p, .7);
        if (G.inDungeon && G.dungeon.isWall(p.x, p.z)) break;
        ox = p.x; oz = p.z;
      }
      this.x = ox; this.z = oz; this.invuln = Math.max(this.invuln, .3); this.y = Math.max(this.y, groundY(ox, oz));
      G.fx.burst(this.x, this.y + 1.5, this.z, s.color, 24, 6, .24, .6); G.audio?.cast('blink');
    }
  }
  shake(v) { if (G.settings.shake) G.shake = Math.max(G.shake || 0, v); }
  startAttack() {
    if (this.atkT >= 0 || this.rolling > 0 || this.st < 7) { if (this.st < 7) G.audio?.deny(); return; }
    this.combo = this.comboWindow > 0 ? (this.combo + 1) % 3 : 0;
    this.st -= 8; this.atkT = 0; this.hitDone = false;
    this.dashHit = !G.mount?.riding && this.sprintOn && Math.hypot(this.vx, this.vz) > 11;
    if (this.dashHit) this.lunge = .17;
    this.atkDur = (ITEMS[this.equip.weapon]?.w === 'great' || ITEMS[this.equip.weapon]?.w === 'hammer') ? .58 : ITEMS[this.equip.weapon]?.w === 'dagger' ? .34 : .44;
    if (G.mount?.riding) { G.audio?.swing(); return; }
    if (this.lock && !this.lock.dead) this.yaw = Math.atan2(this.lock.x - this.x, this.lock.z - this.z);
    else { const e = G.enemies.nearestFront(this, 6.5) ?? G.enemies.nearestAny(this, I.touch ? 6.5 : 4.4); if (e) this.yaw = Math.atan2(e.x - this.x, e.z - this.z); else if (!I.stick.on && !(I.down('KeyW') || I.down('KeyA') || I.down('KeyS') || I.down('KeyD'))) this.yaw = this.camYaw + Math.PI; }
    G.audio?.swing();
  }
  doHit() {
    const M = G.mount, riding = !!M?.riding, w = ITEMS[this.equip.weapon], long = w?.w === 'great' || w?.w === 'spear' || w?.w === 'scythe', R = (long ? 5 : 4) + (riding ? 2.2 : 0), arc = riding ? 1.4 : this.combo === 2 ? .75 : 1.15;
    let fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (riding) {
      const t = this.lock && !this.lock.dead ? this.lock : G.enemies.nearestFront(this, R + 2);
      if (t) { const dx = t.x - this.x, dz = t.z - this.z, l = Math.hypot(dx, dz) || 1; fx = dx / l; fz = dz / l; } else [fx, fz] = this.aimDir();
    }
    const charge = riding ? 1 + Math.min(.5, M.speed / 62) : this.dashHit ? 1.35 : 1;
    let any = false;
    for (const e of G.enemies.list) {
      if (e.dead) continue;
      const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz);
      if (d > R + e.rad) continue;
      if (d > .4 && Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)) > arc) continue;
      if (Math.abs(e.y - this.y) > 5 + e.model.height * .5) continue;
      const crit = Math.random() < this.crit, dmg = this.atk * charge * (this.combo === 2 ? 1.5 : 1) * (.92 + Math.random() * .16) * (crit ? 2 : 1);
      e.hurt(dmg, { crit, kx: fx, kz: fz, knock: this.combo === 2 ? 7 : 3 });
      any = true;
    }
    if (G.net?.duelOn && G.net.pvpMelee(this, fx, fz, R, arc, this.atk * charge * (this.combo === 2 ? 1.5 : 1))) any = true;
    if (any) { G.hitstop = .045; this.shake(.14); G.audio?.hit(); }
  }
  hurt(amount, src, o = {}) {
    if (this.dead || this.invuln > 0 || G.mode !== 'play') return false;
    if (this.rolling > 0) { G.audio?.dodge(); return false; }
    let dmg = amount * (G.moonGaze > 0 ? 1.2 : 1) * 100 / (100 + this.def * 3);
    if (this.blocking && src) {
      const sx = src.x - this.x, sz = src.z - this.z, l = Math.hypot(sx, sz) || 1;
      if ((sx * Math.sin(this.yaw) + sz * Math.cos(this.yaw)) / l > .15 && this.st > 4) {
        this.st = Math.max(0, this.st - Math.min(30, dmg * .9)); dmg *= .22;
        G.fx.burst(this.x + sx / l, this.y + 1.9, this.z + sz / l, 0xffe9a8, 12, 8, .17, .3); G.audio?.block();
        G.ui.floatText(this.x, this.y + 3, this.z, 'Geblockt', 'block');
      }
    }
    dmg = Math.max(1, Math.round(dmg));
    const lostDuel = !!o.pvp && this.hp - dmg < 1;
    if (lostDuel) dmg = Math.max(0, Math.ceil(this.hp) - 1);
    this.hp -= dmg; this.invuln = .34; this.flash = .12;
    if (o.slow) this.slowT = Math.max(this.slowT, o.slow);
    G.ui.floatText(this.x, this.y + 3.1, this.z, `-${dmg}`, 'hurt'); G.retro.u.hurt.value = Math.min(1, G.retro.u.hurt.value + .6);
    G.fx.burst(this.x, this.y + 1.6, this.z, 0xff3a2a, 10, 6, .2, .45); G.audio?.hurt(); this.shake(.3);
    if (lostDuel) { G.net?.duelLost(); return true; }
    if (this.hp <= 0) { this.hp = 0; G.mount?.dismount(); this.dead = true; this.deadT = 0; G.stats.deaths++; if (!G.net?.goDown()) G.game.onDeath(); }
    else if (G.mount?.riding && dmg >= this.maxHp * .2) G.mount.throwOff(src);
    return true;
  }
  update(dt) {
    this.anim += dt;
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] -= dt;
    this.potionCd = Math.max(0, this.potionCd - dt); this.rollCd = Math.max(0, this.rollCd - dt); this.invuln = Math.max(0, this.invuln - dt); this.slowT = Math.max(0, this.slowT - dt); this.cast = Math.max(0, this.cast - dt); this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (this.flash > 0) { this.flash -= dt; setFlash(this.model, this.flash > 0); }
    if (this.dead) { this.deadT += dt; G.net?.tickDown(dt); animate(this.model, { t: this.anim, speed: 0, attack: -1, dead: Math.min(1, this.deadT / 1.1) }); return; }
    const play = G.mode === 'play', M = G.mount;
    let riding = !!M?.riding;
    if (riding && play && I.hit('KeyC')) { M.dismount(); riding = false; }
    const stick = play && I.stick.on;
    const f = stick ? -I.stick.y : play ? (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0) : 0;
    const s = stick ? I.stick.x : play ? (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0) : 0;
    if (play) {
      const sens = .0023 * G.settings.sens;
      this.camYaw -= I.mdx * sens;
      this.camPitch = clamp(this.camPitch + I.mdy * sens * (G.settings.invertY ? -1 : 1), -.5, 1.25);
      this.camDist = clamp(this.camDist + I.wheel * .8, 4.5, 15);
      // Am Handy dreht die Kamera beim Laufen sanft mit.
      if (stick && !I.camDrag && !riding && !this.lock && f > -.35) this.camYaw += angDiff(this.camYaw, this.yaw + Math.PI) * Math.min(1, dt * .95) * Math.abs(s);
      if (I.lmbP || I.hit('KeyX')) this.startAttack();
      this.blocking = !riding && I.rmb && this.atkT < 0 && this.rolling <= 0 && this.st > 2;
      if (riding) {
        M.idleMouse = I.mdx || I.mdy ? 0 : M.idleMouse + dt;
        if (!this.lock && f >= 0 && M.speed > 6 && M.idleMouse > .7) this.camYaw += angDiff(this.camYaw, this.yaw + Math.PI) * Math.min(1, dt * 1.5);
      }
      for (let i = 0; i < 6; i++) if (I.hit(`Digit${i + 1}`)) this.castSpell(i);
      if (I.hit('KeyR')) this.usePotion('hp');
      if (I.hit('KeyT')) this.usePotion('mp');
      if (I.hit('KeyF')) this.toggleLock();
    } else this.blocking = false;
    if (this.lock && (this.lock.dead || Math.hypot(this.lock.x - this.x, this.lock.z - this.z) > 46)) this.lock = null;
    if (this.lock) this.camYaw += angDiff(this.camYaw, Math.atan2(this.x - this.lock.x, this.z - this.lock.z)) * Math.min(1, dt * 9);

    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    let mx = -sin * f + cos * s, mz = -cos * f - sin * s;
    const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
    const h = groundY(this.x, this.z), raw = G.inDungeon ? 1 : heightAt(this.x, this.z), wet = !G.inDungeon && raw < .25;
    this.updateSprint(play, ml > 0, dt);
    const sprint = !riding && play && this.sprintOn && ml > 0 && this.st > 1 && !this.blocking && this.atkT < 0;
    let speed = (sprint ? 16.5 : 10.5) * this.speedMul;
    if (stick) speed *= clamp(I.stick.m * 1.15, .4, 1);
    if (wet) speed *= .58;
    if (this.slowT > 0) speed *= .62;
    if (this.blocking) speed *= .42;
    if (this.atkT >= 0) speed *= .28;
    if (riding) M.drive(this, dt, mx, mz, ml, play);
    else {
      if (play && I.hit('KeyC') && this.rolling <= 0 && this.rollCd <= 0 && this.st >= 14) {
        this.st -= 14; this.rolling = .46; this.rollCd = .62; this.atkT = -1;
        if (ml > 0) { this.rollX = mx; this.rollZ = mz; } else { this.rollX = Math.sin(this.yaw); this.rollZ = Math.cos(this.yaw); }
        this.yaw = Math.atan2(this.rollX, this.rollZ); G.audio?.roll();
      }
      if (this.rolling > 0) { this.rolling -= dt; this.vx = this.rollX * 20; this.vz = this.rollZ * 20; }
      else if (this.lunge > 0) { this.lunge -= dt; this.vx = Math.sin(this.yaw) * 21; this.vz = Math.cos(this.yaw) * 21; }
      else {
        const k = 1 - Math.exp(-(this.onGround ? 15 : 3.6) * dt);
        this.vx += (mx * speed - this.vx) * k; this.vz += (mz * speed - this.vz) * k;
        if (ml > 0 && this.atkT < 0) { const target = this.lock && !sprint ? Math.atan2(this.lock.x - this.x, this.lock.z - this.z) : Math.atan2(mx, mz); this.yaw += angDiff(this.yaw, target) * Math.min(1, dt * 13); }
        else if (this.lock && this.atkT < 0) this.yaw += angDiff(this.yaw, Math.atan2(this.lock.x - this.x, this.lock.z - this.z)) * Math.min(1, dt * 11);
      }
      if (play && I.hit('Space') && this.onGround && !wet && this.rolling <= 0 && this.st >= 6) { this.vy = 11.6; this.onGround = false; this.st -= 6; G.audio?.jump(); }
      this.vy -= 30 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      resolve(this, .72);
      const g = groundY(this.x, this.z);
      if (this.y <= g + (this.onGround ? .5 : 0) && this.vy <= 0) { this.y = g; this.vy = 0; this.onGround = true; } else if (this.y > g + .6) this.onGround = false;
    }
    if (this.atkT >= 0) {
      this.atkT += dt / this.atkDur;
      if (!this.hitDone && this.atkT >= .36) { this.hitDone = true; this.doHit(); }
      if (this.atkT >= 1) { this.atkT = -1; this.comboWindow = .36; }
    }
    if (sprint) this.st -= 15 * dt;
    else if (riding && M.gallop) this.st -= 6 * dt;
    else if (this.atkT < 0 && this.rolling <= 0 && !this.blocking) this.st = Math.min(this.maxSt, this.st + 30 * dt);
    this.mp = Math.min(this.maxMp, this.mp + (1.4 + this.geistT * .08) * dt);
    const regen = this.fx('regen');
    if (regen) this.hp = Math.min(this.maxHp, this.hp + regen * 1.6 * dt);
    if (!G.enemies.inCombat) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * .012 * dt);
    this.st = Math.max(0, this.st);
    const hsp = Math.hypot(this.vx, this.vz);
    animate(this.model, { t: this.anim, speed: riding || this.atkT >= 0 ? 0 : hsp, attack: this.atkT, combo: this.combo, cast: this.cast, block: this.blocking, ride: riding, air: !this.onGround && !riding, roll: this.rolling > 0 ? 1 - this.rolling / .46 : 0 });
    if (!riding && hsp > 5 && this.onGround && Math.random() < dt * 8 && !G.inDungeon) G.fx.burst(this.x, this.y + .1, this.z, wet ? 0x8fb8ff : 0xb0a8a0, 1, 1, .12, .3, 0);
    this.syncModel();
    if (riding) this.light.position.set(this.x - Math.sin(this.yaw) * 2.8, this.y + 8, this.z - Math.cos(this.yaw) * 2.8);
    else this.light.position.set(this.x + Math.sin(this.yaw + .9) * 2.5, this.y + (G.house ? 3.2 : 4.5), this.z + Math.cos(this.yaw + .9) * 2.5);
    this.light.intensity = (G.house ? 6 : G.inDungeon ? 22 : 1.5 + (1 - (G.sky?.day ?? 0)) * 10.5) * (riding ? 1.25 : 1) * (1 + Math.sin(this.anim * 11) * .05 + Math.sin(this.anim * 4.3) * .04);
    if (this.flame) this.light.color.set(this.flame); else this.light.color.set(0xffa83e);
  }
  /** Shift antippen lässt dich weiterrennen, Shift halten funktioniert wie gewohnt. So bleiben Finger und Tasten frei. */
  updateSprint(play, moving, dt) {
    const down = play && (I.down('ShiftLeft') || I.down('ShiftRight')), tap = play && (I.hit('ShiftLeft') || I.hit('ShiftRight'));
    if (I.touch) { this.sprintOn = down; return; }
    if (tap) {
      if (this.sprintLatch) { this.sprintOn = false; this.sprintLatch = false; this.shiftIgnore = true; }
      else { this.sprintOn = true; this.shiftT = 0; }
    }
    if (down && !this.shiftIgnore) { this.shiftT += dt; if (moving && this.st > 5) this.sprintOn = true; }
    if (!down && this.shiftWas) {
      if (!this.shiftIgnore) { if (this.shiftT < .28) this.sprintLatch = true; else this.sprintOn = false; }
      this.shiftIgnore = false;
    }
    this.shiftWas = down;
    this.idleT = moving ? 0 : this.idleT + dt;
    if (this.idleT > .25 || this.st <= 1 || !play) { this.sprintOn = false; this.sprintLatch = false; }
  }
  toggleLock() {
    if (this.lock) { this.lock = null; return; }
    let best = null, bd = 44;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    for (const e of G.enemies.list) {
      if (e.dead) continue;
      const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz);
      if ((dx * fx + dz * fz) / (d || 1) < .2) continue;
      if (G.inDungeon && !G.dungeon.lineClear(this.x, this.z, e.x, e.z)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    this.lock = best;
    if (best) G.audio?.tick();
  }
  updateCamera(cam, dt) {
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.3);
    const riding = !!G.mount?.riding, p = this.camPitch, cp = Math.cos(p), d = G.house ? Math.min(this.camDist, 6.4) : this.camDist + (riding ? 2.8 : 0), sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw), tx = this.x, ty = this.y + (riding ? 4.3 : 2.45), tz = this.z;
    const fov = 62 + (G.mount?.gallop ? 7 : 0);
    if (Math.abs(cam.fov - fov) > .02) { cam.fov = damp(cam.fov, fov, 5, dt); cam.updateProjectionMatrix(); }
    let dist = d;
    if (G.inDungeon) { for (let q = 1; q <= 16; q++) { const k = q / 16 * d; if (G.dungeon.isWall(tx + sy * cp * k, tz + cy * cp * k)) { dist = Math.max(.25, k - .6); break; } } }
    this.model.root.visible = !G.inDungeon || dist > 2.35;
    let x = tx + sy * cp * dist, y = ty + Math.sin(p) * dist, z = tz + cy * cp * dist;
    const g = (G.inDungeon ? 0 : heightAt(x, z)) + .7;
    if (y < g) y = g;
    if (G.inDungeon) y = Math.min(y, G.dungeon.ceil);
    this.camY = damp(this.camY ?? y, y, 18, dt);
    const s = G.shake || 0;
    cam.position.set(x + (Math.random() - .5) * s, this.camY + (Math.random() - .5) * s, z + (Math.random() - .5) * s);
    if (this.lock && !this.lock.dead) {
      const L = this.lock, lh = L.y + Math.min(4, L.model.height * .55);
      cam.lookAt((tx * 2 + L.x) / 3, (ty * 2 + lh) / 3, (tz * 2 + L.z) / 3);
    } else cam.lookAt(tx, ty + (p < 0 ? -p * 2.2 : 0), tz);
  }
}
