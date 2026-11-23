import { G } from './state.js';
import { Input } from '../core/input.js';
import { QUESTS } from '../data/quests.js';

export class Dialog {
  constructor() { this.npc = null; }
  open(n) {
    this.npc = n; n.talking = true;
    G.mode = 'dialog'; Input.unlock(); Input.clear();
    G.audio?.talk();
    const pending = G.quests.talkSteps(n.id);
    if (pending.length) this.playStep(pending[0]);
    else this.root(this.line());
  }
  line() { const t = this.npc.d.talk; return t[Math.floor(Math.random() * t.length)]; }
  show(text, options) { G.ui.dialog(this.npc.d.n, this.npc.d.role, text, options, G.audio?.voiceFor(this.npc)); }
  root(text) {
    const n = this.npc, d = n.d, o = [];
    for (const id of G.quests.talkSteps(n.id)) o.push({ t: `◆ ${QUESTS[id].title}`, cls: 'q', fn: () => this.playStep(id) });
    for (const Q of G.quests.offers(n.id)) o.push({ t: `${Q.type === 'main' ? '★' : '!'} ${Q.title}`, cls: Q.type === 'main' ? 'main' : 'q', fn: () => this.offer(Q) });
    if (d.shop) o.push({ t: 'Zeig mir deine Waren', fn: () => { this.close(false); G.ui.openShop(n); } });
    if (d.inn) { const cost = 8 + G.player.level * 3; o.push({ t: `Übernachten (${cost} Gold)`, fn: () => this.rest(cost) }); }
    o.push({ t: 'Was gibt es Neues?', fn: () => this.root(this.line()) });
    o.push({ t: 'Auf Wiedersehen', cls: 'bye', fn: () => this.close() });
    this.show(text, o);
  }
  rest(cost) {
    const P = G.player;
    if (P.gold < cost) return this.root('Ohne Geld gibt es hier nur den Fußboden.');
    P.gold -= cost; P.hp = P.maxHp; P.mp = P.maxMp; P.st = P.maxSt;
    G.hour = (G.hour + 8) % 24; G.audio?.chime(); G.game.autosave();
    G.ui.fadeFlash();
    this.root('Gut geschlafen? Du siehst schon viel lebendiger aus.');
  }
  offer(Q) {
    const lines = Q.offer || [Q.desc];
    this.lines(lines, () => this.show(lines[lines.length - 1], [
      { t: 'Ich übernehme das.', cls: 'main', fn: () => { G.quests.accept(Q.id); this.after(); } },
      { t: 'Vielleicht später.', cls: 'bye', fn: () => this.root(this.line()) },
    ]));
  }
  lines(list, done) {
    let i = 0;
    const next = () => {
      if (i >= list.length - 1) return done();
      this.show(list[i++], [{ t: 'Weiter', cls: 'cont', fn: next }]);
    };
    next();
  }
  playStep(id) {
    const s = G.quests.step(id);
    if (!s) return this.root(this.line());
    const lines = s.lines || ['...'];
    const finish = choice => {
      G.quests.finishTalk(id, choice);
      if (choice?.say) this.show(choice.say, [{ t: 'Weiter', cls: 'cont', fn: () => this.after() }]);
      else this.after();
    };
    this.lines(lines, () => {
      const last = lines[lines.length - 1];
      if (s.choice) this.show(last, s.choice.map(c => ({ t: c.t, cls: 'main', fn: () => finish(c) })));
      else this.show(last, [{ t: 'Weiter', cls: 'cont', fn: () => finish() }]);
    });
  }
  after() {
    if (!this.npc) return;
    const n = this.npc, pending = G.quests.talkSteps(n.id);
    if (G.quests.pendingScene) return this.close();
    if (pending.length) return this.playStep(pending[0]);
    const main = G.quests.offers(n.id).find(Q => Q.type === 'main');
    if (main) return this.offer(main);
    this.root(this.line());
  }
  close(resume = true) {
    if (this.npc) this.npc.talking = false;
    this.npc = null;
    G.ui.dialog(null);
    if (resume) { G.mode = 'play'; G.game.resumeLock(); }
  }
}
