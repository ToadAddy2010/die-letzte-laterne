export const Input = {
  keys: new Set(), pressed: new Set(), mdx: 0, mdy: 0, wheel: 0, lmb: false, rmb: false, lmbP: false, rmbP: false, locked: false, canvas: null,
  touch: false, camDrag: false, stick: { on: false, x: 0, y: 0, m: 0 }, typing: false, wantLock: false, lockedAt: 0, unlockedAt: -1e9, nextTry: 0,
  down(c) { return this.keys.has(c); },
  hit(c) { return this.pressed.has(c); },
  endFrame() { this.pressed.clear(); this.mdx = this.mdy = this.wheel = 0; this.lmbP = this.rmbP = false; },
  clear() { this.keys.clear(); this.pressed.clear(); this.lmb = this.rmb = false; this.lmbP = this.rmbP = false; this.mdx = this.mdy = 0; },
  // Browser sperren die Maus erst wieder, wenn Esc losgelassen ist, und blockieren kurz danach weitere Versuche.
  // Bis es klappt, läuft die Kamera mit der normalen Mausbewegung weiter.
  lock() {
    if (this.touch) return;
    this.wantLock = true;
    if (!this.canvas || document.pointerLockElement === this.canvas || this.keys.has('Escape')) return;
    const now = performance.now();
    if (now < this.nextTry) return;
    this.nextTry = now + 350;
    try { const p = this.canvas.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch { /* optional */ }
  },
  unlock() { this.wantLock = false; if (document.pointerLockElement) document.exitPointerLock(); },
  init(canvas, onUnlock) {
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (this.typing) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !/INPUT|SELECT|BUTTON/.test(e.target?.tagName || '')) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      // Dasselbe Esc, das gerade die Maus freigegeben hat, darf das Menü nicht sofort wieder schließen.
      if (e.code === 'Escape' && performance.now() - this.unlockedAt < 250) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code !== 'Escape' && this.wantLock && !this.locked) this.lock();
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.code);
      if (e.code === 'Escape' && this.wantLock && !this.locked) this.lock();
    });
    addEventListener('blur', () => this.clear());
    addEventListener('mousemove', e => {
      if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; }
      else if (this.wantLock && Math.abs(e.movementX) < 160 && Math.abs(e.movementY) < 160) { this.mdx += e.movementX; this.mdy += e.movementY; }
    });
    addEventListener('mousedown', e => {
      if (!this.locked) { if (this.wantLock) this.lock(); return; }
      if (e.button === 0) { this.lmb = true; this.lmbP = true; }
      if (e.button === 2) { this.rmb = true; this.rmbP = true; }
    });
    addEventListener('mouseup', e => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked, now = performance.now();
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this.lockedAt = now; return; }
      if (!was) return;
      this.lmb = this.rmb = false; this.unlockedAt = now; this.nextTry = now + 1300;
      // Geht die Maus direkt nach dem Fangen wieder verloren, war das kein neuer Wunsch nach dem Menü.
      if (this.wantLock && !this.typing && now - this.lockedAt > 500) onUnlock?.();
    });
  },
};
