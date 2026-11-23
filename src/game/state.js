// Gemeinsamer Spielzustand. Die Systeme hängen sich beim Start hier ein.
export const G = {
  mode: 'boot',       // boot, menu, play, dialog, cutscene, panel, dead, end
  t: 0, dt: 0, hour: 19.5, day: 1,
  inDungeon: null,
  moonGaze: 0, moonGazeT: 180,
  flags: {}, discovered: {}, opened: {}, shards: {}, tablets: {}, killed: {}, bossDead: {},
  stats: { kills: 0, deaths: 0, played: 0, gold: 0, quests: 0 },
  settings: { lines: 540, gfx: 2, volume: .7, music: .55, sens: 1, invertY: false, shake: true },
};
export const emit = (ev, data) => { for (const fn of (G.listeners?.[ev] || [])) fn(data); };
export const on = (ev, fn) => { G.listeners ??= {}; (G.listeners[ev] ??= []).push(fn); };
