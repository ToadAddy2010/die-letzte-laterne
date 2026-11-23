export const WORLD = 3200;

export const REGIONS = [
  { id: 'pilz', name: 'Die Pilzmark', c: [0, 180], base: 16, amp: 20, ridge: 6, dune: 0, low: 0x1c6a50, high: 0x2f8a63, alt: 0x27507f, rock: 0x4a4677, fogN: 0x1a1a58, fogD: 0x5a78bc, lvl: 2, music: 0,
    props: { shroomBig: 13, shroomSmall: 30, treeBlue: 16, flowerBlue: 150, flowerPink: 80, grass: 170, rock: 5, glowcap: 18 } },
  { id: 'forest', name: 'Der Düsterforst', c: [-820, 200], base: 22, amp: 32, ridge: 16, dune: 0, low: 0x123f3a, high: 0x1c5a45, alt: 0x1c2e5e, rock: 0x34325a, fogN: 0x0e1636, fogD: 0x35637a, lvl: 6, music: 1,
    props: { pine: 50, treeTwist: 12, grass: 120, flowerBlue: 34, flowerPink: 14, shroomSmall: 9, rock: 7, stump: 4, glowcap: 10 } },
  { id: 'moor', name: 'Das Knochenmoor', c: [-240, 1080], base: 2, amp: 5.5, ridge: 0, dune: 0, low: 0x2e3a36, high: 0x4c4a38, alt: 0x3b2c5a, rock: 0x3c3350, fogN: 0x171a38, fogD: 0x5f6655, lvl: 10, music: 2,
    props: { treeDead: 13, reed: 46, grave: 6, rock: 3, bones: 4, glowcap: 16, grass: 30 } },
  { id: 'desert', name: 'Die Glutwüste', c: [900, 430], base: 18, amp: 15, ridge: 6, dune: 12, low: 0xc98a3c, high: 0xe4ae55, alt: 0xa8602e, rock: 0x8a4630, fogN: 0x2a1a50, fogD: 0xe0a062, lvl: 13, music: 3,
    props: { cactus: 8, rockRed: 8, dryGrass: 18, bones: 2, obelisk: .35 } },
  { id: 'frost', name: 'Der Frostkamm', c: [-120, -920], base: 48, amp: 42, ridge: 58, dune: 0, low: 0x8ba6e8, high: 0xd6e4ff, alt: 0x5f7fd0, rock: 0x3e4a8c, fogN: 0x1c2c72, fogD: 0x93b4ea, lvl: 16, music: 4,
    props: { pineSnow: 18, iceSpike: 12, crystal: 9, rockIce: 6 } },
  { id: 'clock', name: 'Die Uhrwerkhöhen', c: [900, -760], base: 34, amp: 24, ridge: 24, dune: 0, low: 0x6a4a3c, high: 0x8c6a42, alt: 0x4a3a66, rock: 0x4a3550, fogN: 0x1e1444, fogD: 0xa07260, lvl: 19, music: 5,
    props: { gear: 3, pillar: 2.5, rock: 5, copperTree: 6, dryGrass: 22, crystal: 1 } },
  { id: 'ash', name: 'Die Aschenöde', c: [-860, -820], base: 30, amp: 22, ridge: 32, dune: 0, low: 0x221a30, high: 0x3a2a42, alt: 0x4a1c2a, rock: 0x181428, fogN: 0x120824, fogD: 0x4f2340, lvl: 23, music: 6,
    props: { spike: 14, treeDead: 9, ember: 18, rockDark: 7, bones: 2 } },
];

const T = (id, name, x, z, r = 88) => ({ id, type: 'town', name, x, z, r });
const D = (id, name, x, z, theme, rooms, lvl, boss, main = false) => ({ id, type: 'dungeon', name, x, z, r: 20, theme, rooms, lvl, boss, main });
const S = (id, name, x, z) => ({ id, type: 'shrine', name, x, z, r: 9 });
const L = (id, name, x, z, kind, r = 24, lore = null) => ({ id, type: 'landmark', name, x, z, r, kind, lore });
const C = (id, name, x, z, pack, n = 5) => ({ id, type: 'camp', name, x, z, r: 26, pack, n });

export const POIS = [
  T('hutdorf', 'Morgenkappe', 0, 180, 92), T('rindenheim', 'Rindenheim', -790, 210), T('totenfurt', 'Totenfurt', -230, 1060, 80),
  T('goldoase', 'Goldoase', 900, 440, 92), T('eiswacht', 'Eiswacht', -120, -900), T('tickholm', 'Tickholm', 900, -740), T('aschenrast', 'Aschenrast', -700, -640, 72),

  D('pilzgrotte', 'Die Sporengrotte', 235, 40, 'cave', 6, 2, 'sporenfuerst', true),
  D('wurzelgang', 'Der Wurzelgang', -560, 430, 'root', 6, 5, 'wurzelmutter'),
  D('goblinfeste', 'Krumnases Feste', -985, 30, 'goblin', 9, 8, 'krumnase', true),
  D('moorkapelle', 'Die Versunkene Kapelle', 205, 1185, 'bone', 7, 10, 'kantor'),
  D('knochengruft', 'Die Knochengruft', -525, 1240, 'bone', 9, 12, 'ossian', true),
  D('skorpionbau', 'Der Skorpionbau', 720, 765, 'sun', 7, 13, 'skorpina'),
  D('sonnengrab', 'Das Sonnengrab', 1235, 525, 'sun', 10, 15, 'solgar', true),
  D('spiegelgrotte', 'Die Spiegelgrotte', -425, -1120, 'ice', 7, 16, 'eisbraut'),
  D('frostfeste', 'Die Frostfeste', 185, -1240, 'ice', 10, 18, 'hrimgar', true),
  D('uhrwerk', 'Das Große Uhrwerk', 1200, -1005, 'clock', 10, 20, 'uhrmacher'),
  D('mondkrypta', 'Die Mondkrypta', -1045, -520, 'shadow', 8, 22, 'mondwaechter'),
  D('zitadelle', 'Die Schwarze Zitadelle', -1180, -1180, 'shadow', 12, 25, 'morvane', true),

  S('s_hutdorf', 'Laterne von Morgenkappe', 20, 150), S('s_kreuz', 'Laterne am Kreuzweg', 40, -310), S('s_pilzsee', 'Laterne am Sporensee', 330, 300),
  S('s_rinden', 'Laterne von Rindenheim', -760, 170), S('s_nebel', 'Laterne im Nebelhain', -430, 110), S('s_krumm', 'Laterne am Krummen Pass', -880, -180),
  S('s_toten', 'Laterne von Totenfurt', -200, 1020), S('s_sumpf', 'Laterne am Irrlichtsteg', -40, 720), S('s_gruft', 'Laterne der Gräber', -430, 1180),
  S('s_gold', 'Laterne von Goldoase', 930, 400), S('s_duene', 'Laterne der Hohen Düne', 560, 290), S('s_grab', 'Laterne am Sonnenweg', 1120, 610),
  S('s_eis', 'Laterne von Eiswacht', -90, -860), S('s_pass', 'Laterne am Schneepass', 10, -610), S('s_kamm', 'Laterne am Eisernen Kamm', 120, -1120),
  S('s_tick', 'Laterne von Tickholm', 930, -700), S('s_zahn', 'Laterne am Zahnradweg', 560, -520), S('s_werk', 'Laterne der Großen Feder', 1110, -930),
  S('s_asche', 'Laterne von Aschenrast', -670, -610), S('s_oede', 'Laterne der Öde', -880, -860), S('s_zit', 'Letzte Laterne vor der Zitadelle', -1090, -1080),

  L('l_riesenpilz', 'Der Urpilz', -130, 400, 'bigmushroom', 26, 'urpilz'),
  L('l_mondbrunnen', 'Der Mondbrunnen', 300, 520, 'moonwell', 16, 'mondbrunnen'),
  L('l_zauberer', 'Statue des Ersten Magiers', 420, -80, 'statue', 18, 'erstermagier'),
  L('l_altarm', 'Der Trollstein', -620, -60, 'skullrock', 24, 'trollstein'),
  L('l_hexenhaus', 'Hexenhütte im Moos', -1120, 420, 'witchhut', 16, 'hexe'),
  L('l_weltbaum', 'Die Alte Eiche', -1250, 150, 'greattree', 26, 'eiche'),
  L('l_turmmoor', 'Der Schiefe Turm', 120, 900, 'tower', 16, 'schieferturm'),
  L('l_riese', 'Das Skelett des Riesen', -620, 880, 'bonegiant', 34, 'riese'),
  L('l_friedhof', 'Der Friedhof der Namenlosen', -60, 1320, 'graveyard', 30, 'namenlose'),
  L('l_sonnenstein', 'Der Sonnenstein', 1140, 180, 'sunstone', 18, 'sonnenstein'),
  L('l_bogen', 'Der Bogen der Könige', 650, 590, 'arch', 18, 'bogen'),
  L('l_schiff', 'Das Sandschiff', 1330, 300, 'sandship', 26, 'sandschiff'),
  L('l_eiskrone', 'Die Eiskrone', -360, -760, 'icecrown', 24, 'eiskrone'),
  L('l_drachenruh', 'Drachenruh', 420, -1010, 'dragonbones', 30, 'drachenruh'),
  L('l_gletscher', 'Der Gefrorene Ritter', -60, -1320, 'statue', 18, 'ritter'),
  L('l_uhrturm', 'Der Stumme Uhrturm', 680, -880, 'clocktower', 20, 'uhrturm'),
  L('l_zahnrad', 'Das Gefallene Zahnrad', 1060, -560, 'gearwreck', 30, 'zahnrad'),
  L('l_observat', 'Das Sternenobservatorium', 1330, -720, 'observatory', 20, 'sternwarte'),
  L('l_mondtor', 'Das Mondtor', -860, -1000, 'arch', 18, 'mondtor'),
  L('l_schwerter', 'Das Feld der Schwerter', -560, -880, 'swords', 28, 'schwerter'),
  L('l_turmasche', 'Der Hohle Turm', -1270, -760, 'tower', 16, 'hohlturm'),

  C('c_gob1', 'Goblinlager am Bach', 150, 330, 'goblins1', 4), C('c_gob2', 'Sporenräuber', -250, 60, 'goblins1', 5), C('c_wolf1', 'Wolfshügel', 320, -170, 'wolves', 4),
  C('c_shroom', 'Lichtung der Pilzlinge', -300, 300, 'shrooms', 6), C('c_gob3', 'Holzfällerlager', -640, 100, 'goblins2', 6), C('c_gob4', 'Späherposten', -1040, 300, 'goblins2', 5),
  C('c_gob5', 'Kriegslager', -880, -40, 'goblins3', 7), C('c_wolf2', 'Rudelsenke', -520, 280, 'wolves', 5), C('c_troll', 'Trollbrücke', -700, 480, 'trolls', 2),
  C('c_skel1', 'Alte Wachstube', -90, 860, 'skeletons1', 5), C('c_skel2', 'Knochenlager', -420, 950, 'skeletons1', 6), C('c_skel3', 'Grabräuberhügel', 90, 1080, 'skeletons2', 6), C('c_zomb', 'Faulsteg', -660, 1120, 'bog', 6),
  C('c_cult1', 'Lager der Glutjünger', 640, 390, 'cult', 5), C('c_cult2', 'Sonnenaltar', 1020, 650, 'cult', 6), C('c_skorp', 'Stachelsenke', 880, 690, 'scorpions', 5), C('c_imp', 'Feuerspalte', 1260, 400, 'imps', 6),
  C('c_frost1', 'Heulender Grat', -260, -640, 'frostwolves', 5), C('c_frost2', 'Geisterschlucht', 250, -820, 'wraiths', 5), C('c_yeti', 'Hornwacht', -240, -1160, 'yetis', 2),
  C('c_clock1', 'Rostwerkstatt', 720, -640, 'clockwork', 5), C('c_clock2', 'Kolbenfeld', 1050, -830, 'clockwork', 6), C('c_clock3', 'Zahnspinnennest', 1220, -600, 'gears', 6),
  C('c_ash1', 'Zirkel der Hohlen', -820, -720, 'mages', 5), C('c_ash2', 'Schattenwacht', -980, -950, 'shadows', 6), C('c_ash3', 'Aschenkessel', -610, -1030, 'shadows', 6), C('c_ash4', 'Blutaltar', -1260, -960, 'mages', 6),
];
export const POI = Object.fromEntries(POIS.map(p => [p.id, p]));

export const ROADS = [
  ['hutdorf', [-180, 150], [-430, 110], [-620, 180], 'rindenheim'],
  ['hutdorf', [40, 420], [-40, 720], [-150, 900], 'totenfurt'],
  ['hutdorf', [240, 230], [560, 290], [760, 400], 'goldoase'],
  ['hutdorf', [60, -60], [40, -310], [10, -610], [-60, -760], 'eiswacht'],
  [[40, -310], [320, -400], [560, -520], [760, -650], 'tickholm'],
  ['goldoase', [1010, 160], [1000, -200], [960, -520], 'tickholm'],
  ['rindenheim', [-860, -60], [-880, -180], [-800, -430], 'aschenrast'],
  ['eiswacht', [-330, -810], [-540, -720], 'aschenrast'],
  ['aschenrast', [-800, -760], [-880, -860], [-1000, -990], [-1090, -1080], 'zitadelle'],
  ['hutdorf', [150, 90], 'pilzgrotte'],
  ['rindenheim', [-880, 130], 'goblinfeste'],
  ['totenfurt', [-380, 1160], 'knochengruft'],
  ['totenfurt', [20, 1130], 'moorkapelle'],
  ['goldoase', [1120, 610], 'sonnengrab'],
  ['goldoase', [800, 640], 'skorpionbau'],
  ['eiswacht', [50, -1080], [120, -1120], 'frostfeste'],
  ['eiswacht', [-300, -1020], 'spiegelgrotte'],
  ['tickholm', [1110, -930], 'uhrwerk'],
  ['aschenrast', [-880, -580], 'mondkrypta'],
  ['rindenheim', [-650, 330], 'wurzelgang'],
];

export const REGION_INFO = {
  pilz: 'Sanfte Hügel, leuchtende Blumen und Pilze, größer als Häuser. Hier hat die Nacht am wenigsten Macht.',
  forest: 'Ein Wald, der nicht mehr schläft. Goblinbanden halten die Pässe, und die Bäume erinnern sich.',
  moor: 'Nebel, Irrlichter und die Knochen eines alten Krieges. Bei Nacht stehen sie wieder auf.',
  desert: 'Ein Meer aus rotem Sand unter einer Sonne, die zornig geworden ist.',
  frost: 'Ewiges Eis und Geister, die vergessen haben, dass sie tot sind.',
  clock: 'Die Reste eines Reiches, das die Zeit bauen wollte. Seine Maschinen laufen noch.',
  ash: 'Das verbrannte Herz des Reiches. Hier herrscht Morvane, der Hohle.',
};
