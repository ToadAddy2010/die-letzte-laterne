import * as THREE from '../../vendor/three.module.js';
import { Kit, MAT, GFX } from '../core/gfx.js';
import { clamp, damp, lerp, smooth, TAU } from '../core/util.js';
import { G } from '../game/state.js';

class Face {
  constructor(kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.open = 0;
    const moon = kind === 'moon', skin = moon ? 0x34409f : 0xcf2f18, skin2 = moon ? 0x8ea2ff : 0xffa42c, lip = moon ? 0x221d6e : 0x7a1410, line = moon ? 0x171356 : 0x5e0e08;
    const k = new Kit(moon ? 11 : 22);
    k.blob(30, 0, 0, 0, skin, { c2: skin2, j: .13 });
    k.ball(29.6, 0, 0, 0, skin, { c2: skin2, seg: 14, j: .1 });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996, r = 8 + i * .85, x = Math.cos(a) * r, y = Math.sin(a) * r;
      k.ball(1 + (i % 4) * .55, x, y, Math.sqrt(Math.max(1, 880 - x * x - y * y)), moon ? 0x28307f : 0xb12612, { seg: 5, sz: .35 });
    }
    k.ball(4.8, 0, -2.5, 29, skin, { c2: skin2, sy: 1.25, seg: 8 });
    k.ball(6, -14, -8, 24, skin, { c2: skin2, sz: .55, seg: 7 });
    k.ball(6, 14, -8, 24, skin, { c2: skin2, sz: .55, seg: 7 });
    k.torus(9, 1.5, 0, -8, 27.2, lip, { arc: Math.PI, rz: Math.PI, sy: .4, seg: 10 });
    k.box(16, .9, 1, 0, -12.2, 27, line, {});
    if (moon) {
      k.torus(7.4, .55, -24, 15, 12, 0x6a7cf0, { ry: -1.1 });
      k.torus(4.4, .4, 20, -19, 13, 0x6a7cf0, { ry: 1.1 });
    } else {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU, long = i % 2 === 0, L = long ? 22 : 13, R = 30 + L / 2 - 2;
        k.cone(long ? 6.2 : 4.3, L, Math.cos(a) * R, Math.sin(a) * R, -3, long ? 0xff7a1e : 0xffc445, { rz: a - Math.PI / 2, seg: 4, c2: 0xffe680 });
      }
    }
    this.group.add(new THREE.Mesh(k.build(), MAT.glow));

    this.eyeMat = new THREE.MeshBasicMaterial({ color: moon ? 0xffc928 : 0xfff2b0, fog: false });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x120c34, fog: false });
    const lidMat = new THREE.MeshBasicMaterial({ color: moon ? 0x4a58c8 : 0xe2541f, fog: false });
    const lashMat = new THREE.MeshBasicMaterial({ color: line, fog: false });
    this.lids = []; this.pupils = []; this.lashes = []; this.brows = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 11.5, 7, 24.5);
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), this.eyeMat));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), pupilMat);
      pupil.scale.set(.6, moon ? 1.3 : .9, .35); pupil.position.z = 5.6;
      const lid = new THREE.Mesh(new THREE.SphereGeometry(6.4, 14, 8, 0, TAU, 0, Math.PI / 2), lidMat);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(4.5, .5, 5, 12, Math.PI), lashMat);
      lash.rotation.z = Math.PI; lash.position.set(0, 1.2, 5.3);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(12, 1.7, 1.5), lashMat);
      brow.position.set(0, 8.2, 2.8);
      eye.add(pupil, lid, lash, brow);
      this.lids.push(lid); this.pupils.push(pupil); this.lashes.push(lash); this.brows.push({ m: brow, side });
      this.group.add(eye);
    }
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), rad = g.createRadialGradient(64, 64, 18, 64, 64, 64);
    rad.addColorStop(0, moon ? 'rgba(130,140,255,.7)' : 'rgba(255,170,70,.75)');
    rad.addColorStop(1, moon ? 'rgba(50,30,160,0)' : 'rgba(255,70,20,0)');
    g.fillStyle = rad; g.fillRect(0, 0, 128, 128);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.scale.setScalar(moon ? 130 : 170);
    this.halo.position.z = -12;
    this.group.add(this.halo);
    this.group.scale.setScalar(moon ? 4.4 : 3.6);
    this.group.traverse(o => { o.renderOrder = -5; });
    this.setOpen(0);
  }
  setOpen(v) {
    this.open = v;
    for (const l of this.lids) l.rotation.x = lerp(Math.PI * .5, -.42, v);
    for (const p of this.pupils) p.visible = v > .16;
    for (const l of this.lashes) l.visible = v <= .16;
    for (const b of this.brows) b.m.rotation.z = b.side * lerp(-.14, .34, v);
  }
  update(dt, t, pos, cam, goal, angry) {
    this.setOpen(damp(this.open, goal, goal > this.open ? 7 : 3, dt));
    this.group.position.copy(pos);
    this.group.lookAt(cam.position);
    this.group.rotateZ(Math.sin(t * .22) * .05);
    if (this.kind === 'moon') this.eyeMat.color.lerp(new THREE.Color(angry ? 0xff3a22 : 0xffc928), 1 - Math.exp(-5 * dt));
    const lx = Math.sin(t * .9) * .9;
    for (const p of this.pupils) p.position.x = lx;
  }
}

const skyFrag = /* glsl */`
varying vec3 d;
uniform vec3 top, mid, horizon;
uniform float night, time;
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,v=0.; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.1; a*=.5; } return v; }
void main(){
  vec3 v = normalize(d);
  float y = clamp(v.y, -.1, 1.);
  vec3 c = mix(horizon, mid, smoothstep(.0,.2,y));
  c = mix(c, top, smoothstep(.14,.72,y));
  float cl = fbm(v * 3.3 + vec3(time*.006,0.,time*.003));
  float wisps = smoothstep(.5,.8,fbm(vec3(v.x*2.2, v.y*8., v.z*2.2) + 3. + time*.004));
  c += mix(vec3(.02,.03,.05), vec3(.17,.03,.3), night) * smoothstep(.44,.82,cl) * smoothstep(-.02,.2,y);
  c += mix(vec3(.12,.07,.05), vec3(.015,.07,.2), night) * wisps * smoothstep(0.,.25,y);
  vec3 g = floor(v * 240.);
  float s = step(.9958, h(g));
  c += s * night * smoothstep(.02,.2,y) * (.55 + .45*sin(time*2.+h(g+1.)*40.)) * mix(vec3(1.,.82,.5), vec3(.6,.75,1.), h(g+2.));
  vec3 g2 = floor(v * 96.);
  c += step(.9985, h(g2+5.)) * night * smoothstep(.02,.2,y) * vec3(1.,.9,.7) * 1.6;
  gl_FragColor = vec4(c, 1.);
}`;

const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
const col = { nTop: new THREE.Color(0x040420), nMid: new THREE.Color(0x12104e), dTop: new THREE.Color(0x2c4fa8), dMid: new THREE.Color(0x7e8ed2), dusk: new THREE.Color(0xf07a3a) };

export class Sky {
  constructor(scene, group) {
    this.uni = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, night: { value: 1 }, time: { value: 0 } };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2300, 28, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uni, fragmentShader: skyFrag,
      vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    }));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    this.sun = new Face('sun'); this.moon = new Face('moon');
    group.add(this.dome, this.sun.group, this.moon.group);
    this.hemi = new THREE.HemisphereLight(0x8d9cff, 0x1a1036, 1.6);
    this.dir = new THREE.DirectionalLight(0xa9b4ff, 2);
    scene.add(this.hemi, this.dir, this.dir.target);
    this.dir.castShadow = !G.settings.low;
    this.dir.shadow.mapSize.set(2048, 2048);
    Object.assign(this.dir.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 10, far: 900 });
    this.dir.shadow.camera.updateProjectionMatrix();
    this.dir.shadow.bias = -.0006; this.dir.shadow.normalBias = .16; this.dir.shadow.radius = 2.2;
    scene.fog = new THREE.FogExp2(0x151650, .0034);
    this.fogTarget = new THREE.Color(0x151650);
    this.day = 0; this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
  }
  dir3(hour, v, sign = 1) {
    const a = (hour - 6) / 24 * TAU;
    return v.set(Math.cos(a) * sign, Math.sin(a) * sign * .66, -.62).normalize();
  }
  update(dt, hour, cam, region, target, snap) {
    this.dir3(hour, this.sunDir); this.dir3(hour, this.moonDir, -1);
    const s = this.sunDir.y, day = smooth(-.1, .26, s), dusk = smooth(.42, .02, Math.abs(s)) * (1 - smooth(.3, .5, s));
    this.day = day;
    const u = this.uni;
    u.top.value.copy(col.nTop).lerp(col.dTop, day);
    u.mid.value.copy(col.nMid).lerp(col.dMid, day);
    u.night.value = 1 - day;
    u.time.value = G.t;
    const fogN = new THREE.Color(region.fogN), fogD = new THREE.Color(region.fogD), f = fogN.lerp(fogD, day).lerp(col.dusk, dusk * .32);
    const k = snap ? 1 : 1 - Math.exp(-1.2 * dt);
    this.fogTarget.lerp(f, k);
    if (!G.inDungeon) G.scene.fog.color.copy(this.fogTarget);
    u.horizon.value.copy(this.fogTarget);
    u.mid.value.lerp(col.dusk, dusk * .4);
    this.dome.position.copy(cam.position);
    const P = this.tmp;
    this.sun.group.visible = s > -.34; this.moon.group.visible = s < .34;
    if (this.sun.group.visible) this.sun.update(dt, G.t, P.copy(cam.position).addScaledVector(this.sunDir, 1700), cam, day > .1 ? .85 : 0, false);
    const gaze = G.moonGaze > 0;
    if (this.moon.group.visible) this.moon.update(dt, G.t, P.copy(cam.position).addScaledVector(this.moonDir, 1500), cam, gaze ? 1 : G.forceMoonOpen ?? .0, gaze);
    this.hemi.color.set(0x7a86f4).lerp(new THREE.Color(0xffe6c8), day);
    this.hemi.groundColor.set(0x1a1036).lerp(new THREE.Color(0x4a3a4a), day);
    this.hemi.intensity = lerp(2.4, 2.5, day);
    const main = s > 0 ? this.sunDir : this.moonDir;
    this.dir.color.set(0xa9b4ff).lerp(new THREE.Color(0xffd2a0), day);
    this.dir.intensity = lerp(2.3, 2.7, day);
    // Das Schattenraster rastet ein, damit Schattenkanten beim Laufen nicht flimmern.
    const snapG = 170 / 2048;
    this.dir.target.position.set(Math.round(target.x / snapG) * snapG, Math.round(target.y / snapG) * snapG, Math.round(target.z / snapG) * snapG);
    this.dir.position.copy(this.dir.target.position).addScaledVector(main, 400);
    G.retro.u.warm.value = day;
    const W = MAT.water.uniforms;
    W.uSky.value.copy(this.fogTarget).lerp(u.top.value, .35); W.uDeep.value.set(0x0a1f64).lerp(tmpC.set(0x1250b4), day);
    W.uSun.value.copy(main); W.uGlint.value.set(0xc8d4ff).lerp(tmpC.set(0xffdca0), day);
    GFX.rimColor.value.copy(this.fogTarget).lerp(u.top.value, .4).multiplyScalar(1.5); GFX.rim.value = G.inDungeon ? .28 : lerp(.62, .36, day);
    const R = G.retro.u, shaftDir = s > -.05 ? this.sunDir : this.moonDir;
    P.copy(cam.position).addScaledVector(shaftDir, 1000).project(cam);
    const front = cam.getWorldDirection(tmpV).dot(shaftDir), onScreen = Math.abs(P.x) < 1.35 && Math.abs(P.y) < 1.35 && P.z < 1;
    R.sunPos.value.set(P.x * .5 + .5, P.y * .5 + .5);
    R.shaft.value = !G.inDungeon && front > .15 && onScreen ? smooth(.15, .6, front) * (s > -.05 ? lerp(.55, 1, day) : .42) : 0;
    R.shaftC.value.set(0xaab8ff).lerp(tmpC.set(0xffd2a0), s > -.05 ? 1 : 0);
  }
}
