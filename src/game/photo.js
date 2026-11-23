// Fotomodus: Die Welt friert ein, die Kamera fliegt frei, Bilder landen als PNG im Download-Ordner.
import { G } from './state.js';
import { Input as I } from '../core/input.js';

export class Photo {
  constructor() {
    const d = this.hint = document.createElement('div');
    d.id = 'photoHint';
    d.textContent = 'Fotomodus · WASD fliegen · Maus schauen · Q/E hoch und runter · Shift schnell · Mausrad Zoom · Enter Foto speichern · H Hinweis · O beenden';
    d.style.display = 'none'; document.body.appendChild(d);
    this.on = false; this.want = false;
  }
  toggle() {
    if (this.on) return this.stop();
    if (G.mode !== 'play' || G.net?.active || G.player.dead) { G.ui.toast('Der Fotomodus geht nur allein und außerhalb von Menüs', 'warn'); G.audio?.deny(); return; }
    const c = G.camera, e = c.rotation;
    this.on = true; this.fov = c.fov; this.yaw = Math.atan2(c.matrixWorld.elements[8], c.matrixWorld.elements[10]); this.pitch = Math.asin(Math.max(-1, Math.min(1, -c.matrixWorld.elements[9]))); void e;
    G.mode = 'photo'; G.ui.show(false); this.hint.style.display = 'block'; G.audio?.tick(); I.lock?.();
  }
  stop() {
    this.on = false; this.hint.style.display = 'none';
    const c = G.camera; c.fov = this.fov; c.rotation.order = 'XYZ'; c.updateProjectionMatrix();
    G.mode = 'play'; G.ui.show(true); G.game.resumeLock(); G.audio?.tick();
  }
  update(dt) {
    const c = G.camera;
    if (I.hit('KeyO') || I.hit('Escape')) { this.stop(); return; }
    if (I.hit('KeyH')) this.hint.style.display = this.hint.style.display === 'none' ? 'block' : 'none';
    if (I.hit('Enter')) this.want = true;
    const sens = .0021 * G.settings.sens;
    this.yaw -= I.mdx * sens; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - I.mdy * sens * (G.settings.invertY ? -1 : 1)));
    if (I.wheel) { c.fov = Math.max(14, Math.min(100, c.fov + I.wheel * 2.4)); c.updateProjectionMatrix(); }
    c.rotation.order = 'YXZ'; c.rotation.set(this.pitch, this.yaw, 0);
    const f = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0), s = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0), u = (I.down('KeyE') ? 1 : 0) - (I.down('KeyQ') ? 1 : 0), v = (I.down('ShiftLeft') ? 34 : 11) * dt;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    c.position.x += (-sy * cp * f + cy * s) * v; c.position.y += (sp * f + u) * v; c.position.z += (-cy * cp * f - sy * s) * v;
    const P = G.player;
    const dx = c.position.x - P.x, dz = c.position.z - P.z, dy = c.position.y - P.y, d = Math.hypot(dx, dy, dz);
    if (d > 90) { c.position.x = P.x + dx / d * 90; c.position.y = P.y + dy / d * 90; c.position.z = P.z + dz / d * 90; }
    c.updateMatrixWorld();
  }
  /** Muss direkt nach dem Zeichnen laufen, solange das Bild noch im Puffer liegt. */
  capture(canvas) {
    if (!this.want) return;
    this.want = false;
    canvas.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a'), url = URL.createObjectURL(b);
      a.href = url; a.download = `Letzte-Laterne-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      G.audio?.chime();
    }, 'image/png');
  }
}
