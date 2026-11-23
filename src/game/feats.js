// Erfolge. Sie liegen in G.flags und werden dadurch automatisch mitgespeichert.
import { G, on } from './state.js';
import { FEATS } from '../data/extras.js';

export class Feats {
  constructor() { this.t = 0; on('kill', () => { if (G.bloodMoon) this.bump('bloodKills'); }); }
  bump(stat, n = 1) { G.stats[stat] = (G.stats[stat] || 0) + n; this.t = 0; }
  value(f) { return f.stat === '_boss' ? Object.keys(G.bossDead).length : f.stat === '_level' ? G.player.level : G.stats[f.stat] || 0; }
  has(f) { return !!G.flags[`feat_${f.id}`]; }
  count() { return FEATS.filter(f => this.has(f)).length; }
  update(dt) {
    if (G.mode !== 'play') return;
    this.t -= dt; if (this.t > 0) return;
    this.t = 1.2;
    for (const f of FEATS) {
      if (this.has(f) || this.value(f) < f.need) continue;
      G.flags[`feat_${f.id}`] = 1;
      G.ui.questPop('Erfolg freigeschaltet', f.n); G.audio?.shard();
      G.player.addGold(25 + f.need * 3, true);
      break;
    }
  }
}
