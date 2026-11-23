export const ITEMS = {};
const add = (id, o) => { ITEMS[id] = { id, ...o }; };
const W = (id, n, w, dmg, price, tier, c, d, x = {}) => add(id, { n, t: 'weapon', w, dmg, price, tier, c, d, ...x });
const A = (id, n, def, price, tier, look, d, x = {}) => add(id, { n, t: 'armor', def, price, tier, look, d, ...x });
const R = (id, n, price, tier, fx, d) => add(id, { n, t: 'trinket', price, tier, fx, d });
const P = (id, n, price, tier, heal, mana, d, x = {}) => add(id, { n, t: 'potion', price, tier, heal, mana, d, ...x });
const J = (id, n, price, d) => add(id, { n, t: 'junk', price, d });
const Q = (id, n, d) => add(id, { n, t: 'quest', price: 0, d });

W('holzschwert', 'Holzschwert', 'sword', 5, 5, 0, 0xa8784c, 'Pipp hat es geschnitzt. Es ist besser als nichts.');
W('rostschwert', 'Rostiges Schwert', 'sword', 8, 40, 1, 0xa87858, 'Hat schon mehr Goblins gesehen als ein Goblin.');
W('eisenschwert', 'Eisenschwert', 'sword', 12, 120, 1, 0xc8cfe8, 'Solide Arbeit aus Broms Schmiede.');
W('wanderstab', 'Wanderstab', 'staff', 9, 130, 1, 0x4fc2ff, 'Ein Stab, der leise summt.', { sp: 5 });
W('goblinhacker', 'Goblinhacker', 'axe', 16, 200, 2, 0xa0a0a0, 'Grob, schwer und erstaunlich scharf.');
W('waldklinge', 'Waldklinge', 'sword', 20, 340, 2, 0x72e0a8, 'Aus dem Holz eines Baumes, der nicht fallen wollte.');
W('runenkeule', 'Runenkeule', 'mace', 24, 460, 3, 0x7f8cff, 'Die Runen bedeuten vermutlich „Autsch“.');
W('moorstab', 'Stab der Irrlichter', 'staff', 20, 560, 3, 0x7ff2c8, 'Ein Irrlicht wohnt in seiner Spitze.', { sp: 14 });
W('knochensaebel', 'Knochensäbel', 'sword', 29, 640, 3, 0xe8e2cc, 'Geschnitzt aus der Rippe eines Riesen.');
W('totenbeil', 'Totenbeil', 'axe', 34, 820, 4, 0x8affd8, 'Wer es führt, hört leises Flüstern.');
W('sonnenklinge', 'Sonnenklinge', 'sword', 40, 1050, 4, 0xffc445, 'Sie bleibt immer ein wenig zu warm.');
W('glutspeer', 'Glutspeer', 'spear', 45, 1300, 5, 0xff7a28, 'Seine Spitze wurde in der Glutwüste gehärtet.');
W('sternenstab', 'Sternenstab', 'staff', 36, 1450, 5, 0xc8a0ff, 'Samira schwört, er zeige nach Norden.', { sp: 28 });
W('frostzahn', 'Frostzahn', 'sword', 52, 1750, 5, 0x9fe4ff, 'Der Zahn eines Eisdrachen, zu einer Klinge geschliffen.');
W('eisgross', 'Großschwert des Winters', 'great', 62, 2300, 6, 0xc6e6ff, 'Schwer wie ein langer Winter.');
W('zahnradhammer', 'Zahnradhammer', 'hammer', 70, 2900, 6, 0xf0bd5a, 'Jeder Schlag klingt wie ein Glockenschlag.');
W('uhrwerkklinge', 'Uhrwerkklinge', 'sword', 76, 3500, 7, 0xffd98a, 'Sie schlägt immer zur rechten Zeit.');
W('aschenstab', 'Aschenstab', 'staff', 62, 3900, 7, 0xff5a2a, 'Aus dem letzten Baum der Öde.', { sp: 46 });
W('mondsichel', 'Mondsichel', 'scythe', 88, 4600, 8, 0xbfd0ff, 'Geschmiedet in einer Nacht ohne Ende.');
W('schattenklinge', 'Schattenklinge', 'great', 96, 5400, 8, 0x8a4adf, 'Sie wirft keinen Schatten. Sie ist einer.');
W('laternenschwert', 'Schwert der Letzten Laterne', 'great', 120, 0, 9, 0xffe08a, 'Geschmiedet aus allen Flammen des Reiches.', { sp: 30 });

const look = (top, top2, hat, hatColor, x = {}) => ({ robe: true, top, top2, hat, hatColor, ...x });
A('wanderrobe', 'Wanderrobe', 2, 10, 0, look(0x1c35b8, 0x2f52e0, 'wizard', 0x1c35b8, { stars: 14 }), 'Sternenbestickt und schon oft geflickt.');
A('lederwams', 'Lederwams', 6, 90, 1, { top: 0x7a5230, top2: 0x5a3c24, bottom: 0x3c2c28, hat: 'hood', hatColor: 0x5a3c24 }, 'Riecht nach Regen.');
A('waldmantel', 'Waldmantel', 11, 300, 2, look(0x1f6b50, 0x2f9a70, 'hood', 0x174d3c), 'Im Unterholz fast unsichtbar.', { hp: 10 });
A('kettenhemd', 'Kettenhemd', 16, 520, 3, { top: 0x6c7490, armor: 0x8a92b0, bottom: 0x34344c, hat: 'helm', hatColor: 0x8a92b0 }, 'Schwer, aber ehrlich.', { hp: 20 });
A('moorrobe', 'Robe der Irrlichter', 15, 680, 3, look(0x2a6a70, 0x7ff2c8, 'wizard', 0x1f4c52), 'Sie leuchtet schwach im Dunkeln.', { mp: 30 });
A('wuestengarn', 'Wüstengarn', 22, 980, 4, look(0xd9a766, 0xb8302c, 'turban', 0xc23a3a), 'Hält die Glut draußen.', { hp: 30 });
A('sonnenharnisch', 'Sonnenharnisch', 30, 1500, 5, { top: 0xa86a30, armor: 0xffc445, bottom: 0x6a3c24, hat: 'horns', hatColor: 0xd8a33c, cape: 0xb8302c }, 'Glänzt, auch wenn niemand hinsieht.', { hp: 45 });
A('frostpelz', 'Frostpelz', 34, 1900, 5, { top: 0x6a78b0, armor: 0xe8e4f4, bottom: 0x3a4478, hat: 'fur' }, 'Von einem Yeti, der das nicht gut fand.', { hp: 60 });
A('runenrobe', 'Runenrobe', 28, 2200, 6, look(0x3a2fae, 0x8a6dff, 'wizard', 0x2a2088, { stars: 18 }), 'Jede Naht ist ein Zauberspruch.', { mp: 70 });
A('uhrwerkpanzer', 'Uhrwerkpanzer', 46, 3300, 7, { top: 0x7a4f40, armor: 0xc98a33, bottom: 0x3c2830, hat: 'gear', cape: 0x3f9e88 }, 'Tickt beim Gehen leise.', { hp: 90 });
A('mondgewand', 'Gewand des Mondes', 48, 4400, 8, look(0x202878, 0x8ea2ff, 'wizard', 0x161c5c, { stars: 22 }), 'Gewebt aus dem Licht zwischen zwei Nächten.', { hp: 70, mp: 80 });
A('schattenplatte', 'Schattenplatte', 62, 5200, 8, { top: 0x241c30, armor: 0x4a3a60, bottom: 0x18121f, hat: 'horns', hatColor: 0x2a2238, cape: 0x5a1c3a }, 'Die Rüstung der Zitadellenwache.', { hp: 130 });

R('kupferring', 'Kupferring', 80, 1, { kraft: 2 }, '+2 Kraft');
R('kraeuterband', 'Kräuterband', 90, 1, { regen: 1 }, 'Heilt langsam Wunden.');
R('wolfszahn', 'Wolfszahnkette', 240, 2, { crit: .06 }, '+6 % kritischer Treffer');
R('hexenauge', 'Hexenauge', 400, 3, { geist: 5 }, '+5 Geist');
R('knochenring', 'Knochenring', 560, 3, { hp: 40 }, '+40 Leben');
R('sonnenamulett', 'Sonnenamulett', 1100, 5, { kraft: 7, hp: 30 }, '+7 Kraft, +30 Leben');
R('eisherz', 'Eisherz', 1500, 5, { mp: 60, geist: 6 }, '+60 Mana, +6 Geist');
R('zahnradring', 'Rastlose Feder', 2600, 7, { speed: .1, ausdauer: 6 }, '+10 % Tempo, +6 Ausdauer');
R('mondstein', 'Mondstein', 3800, 8, { crit: .12, geist: 8 }, '+12 % kritisch, +8 Geist');
R('sonnenmond', 'Band von Sonne und Mond', 0, 9, { kraft: 12, geist: 12, hp: 80, mp: 60 }, 'Zwei Feinde, in einem Ring vereint.');

P('trank1', 'Kleiner Heiltrank', 18, 0, 55, 0, 'Schmeckt nach nasser Wiese.');
P('trank2', 'Heiltrank', 55, 2, 150, 0, 'Schmeckt nach Moos und Hoffnung.');
P('trank3', 'Großer Heiltrank', 150, 5, 380, 0, 'Brennt kurz, hilft lange.');
P('mana1', 'Kleiner Manatrank', 20, 0, 0, 45, 'Blau, kalt und kribbelig.');
P('mana2', 'Manatrank', 60, 2, 0, 110, 'Leuchtet im Dunkeln.');
P('mana3', 'Großer Manatrank', 160, 5, 0, 240, 'Man hört danach Farben.');
P('elixier', 'Laternenelixier', 420, 7, 700, 400, 'Das Beste, was je in eine Flasche passte.');

J('kupfer', 'Kupfermünzen-Beutel', 12, 'Klimpert angenehm.');
J('goblinohr', 'Goblinohr', 6, 'Händler fragen nicht, warum.');
J('sporen', 'Leuchtsporen', 9, 'Kitzeln in der Nase.');
J('wolfsfell', 'Wolfsfell', 16, 'Warm und ein wenig streng.');
J('knochen', 'Alter Knochen', 8, 'Gehörte einmal jemandem.');
J('ektoplasma', 'Ektoplasma', 24, 'Klebrig und kalt.');
J('chitin', 'Skorpionpanzer', 30, 'Hart wie Stein.');
J('glutstein', 'Glutstein', 38, 'Wärmt die Tasche.');
J('eissplitter', 'Ewiges Eis', 44, 'Schmilzt niemals.');
J('zahnrad', 'Messingzahnrad', 52, 'Dreht sich manchmal von allein.');
J('schattenstaub', 'Schattenstaub', 70, 'Fällt nach oben, wenn niemand hinsieht.');
J('edelstein', 'Rohedelstein', 120, 'Ein kleines Vermögen.');
J('goldbarren', 'Goldbarren', 300, 'Ein größeres Vermögen.');

for (const [id, n, d] of [
  ['laterne', 'Die Letzte Laterne', 'Sie brennt seit tausend Jahren. Nun brennt sie nur noch schwach.'],
  ['waldflamme', 'Waldflamme', 'Grün und lebendig. Eine von vier Flammen.'], ['moorflamme', 'Moorflamme', 'Fahl wie ein Irrlicht. Eine von vier Flammen.'],
  ['sonnenflamme', 'Sonnenflamme', 'Sie brennt durch jedes Tuch. Eine von vier Flammen.'], ['frostflamme', 'Frostflamme', 'Eine kalte Flamme. Eine von vier Flammen.'],
  ['zeitfeder', 'Die Zeitfeder', 'Das Herz des Großen Uhrwerks. Sie öffnet das Tor der Zitadelle.'],
  ['kriegsbanner', 'Goblinbanner', 'Krumnases Zeichen: eine krumme Nase.'], ['weihwasser', 'Geweihtes Moorwasser', 'Vesper hat es gesegnet.'],
  ['grabmuenze', 'Fährmünze', 'Bezahlt die Überfahrt der Toten.'], ['sonnenscherbe', 'Sonnenscherbe', 'Ein Bruchstück des alten Sonnenaltars.'],
  ['eisrune', 'Eisrune', 'Runa kann sie lesen.'], ['mondkarte', 'Sternkarte des Mondes', 'Zeigt den Weg, den der Mond einst ging.'],
  ['morvanebrief', 'Morvanes Brief', 'An seine Schwester. Nie abgeschickt.'], ['leuchtpilz', 'Leuchtpilz', 'Nessa braucht davon sechs.'],
  ['schnurrli', 'Schnurrli', 'Eine Katze. Sehr beleidigt.'], ['brief_marla', 'Brief an Marla', 'Mit Herzchen versiegelt.'], ['mondwasser', 'Mondwasser', 'Es scheint von innen.'],
  ['sattelzeug', 'Wenkes Sattelzeug', 'Altes Leder. Riecht nach Moos und ein bisschen nach Goblin.'], ['baumstamm', 'Gestohlenes Holz', 'Hakons beste Stämme.'], ['moosblatt', 'Mondmoos', 'Wächst nur im Schatten der Alten Eiche.'], ['hexentrank', 'Moosas Trank', 'Riecht fürchterlich.'],
  ['ahnenbein', 'Ahnengebein', 'Es soll zurück in seine Gruft.'], ['ehering', 'Annas Ehering', 'Innen steht: Für immer.'], ['riesenzahn', 'Zahn des Riesen', 'So groß wie ein Unterarm.'],
  ['wasserschlauch', 'Wasserschlauch', 'Voll und sehr schwer.'], ['ware', 'Geraubte Karawanenware', 'Gewürze und Seide.'], ['logbuch', 'Logbuch des Sandschiffs', 'Die letzte Seite ist voller Sand.'],
  ['ritterschild', 'Schild des Gefrorenen', 'Das Wappen ist kaum noch zu erkennen.'], ['yetihorn', 'Yetihorn', 'Eirik wettet darauf.'], ['drachenschuppe', 'Drachenschuppe', 'Blau wie ein Gletscher.'],
  ['ersatzteil', 'Ersatzteil', 'Nock braucht es für sein Herz.'], ['sternlinse', 'Sternenlinse', 'Durch sie sieht man den Mond blinzeln.'], ['glockenkloeppel', 'Glockenklöppel', 'Gehört in den Stummen Uhrturm.'],
  ['schwertname', 'Namenstafel', 'Ein Name für ein Schwert ohne Träger.'], ['deserteurmarke', 'Marke der Zitadelle', 'Elins Bruder trug sie.'], ['aschenrose', 'Aschenrose', 'Die einzige Blume der Öde.'],
  ['trollzahn', 'Trollzahn', 'Riecht wie ein Sumpf nach dem Frühstück.'], ['sporenkern', 'Sporenkern', 'Das Herz des Sporenfürsten.'],
]) Q(id, n, d);

export const SPELLS = {
  feuerball: { n: 'Feuerball', cost: 14, cd: 1.1, dmg: 20, kind: 'bolt', color: 0xff7a28, speed: 42, aoe: 4, d: 'Ein Ball aus Feuer, der beim Aufprall explodiert.' },
  frostlanze: { n: 'Frostlanze', cost: 12, cd: .8, dmg: 16, kind: 'bolt', color: 0x9fe4ff, speed: 60, slow: 2.5, d: 'Durchbohrt den Gegner und verlangsamt ihn.' },
  heilung: { n: 'Laternenlicht', cost: 24, cd: 5, heal: 60, kind: 'heal', color: 0xffd070, d: 'Warmes Licht schließt deine Wunden.' },
  mondblitz: { n: 'Mondblitz', cost: 26, cd: 3.2, dmg: 46, kind: 'strike', color: 0xbfd0ff, r: 6, d: 'Ruft einen Lichtstrahl des Mondes auf dein Ziel.' },
  sonnenring: { n: 'Sonnenring', cost: 34, cd: 5.5, dmg: 42, kind: 'nova', color: 0xffc445, r: 11, d: 'Eine Welle aus Sonnenfeuer rund um dich.' },
  schattenschritt: { n: 'Schattenschritt', cost: 16, cd: 3, kind: 'blink', color: 0x8a4adf, dist: 15, d: 'Ein Sprung durch den Schatten nach vorn.' },
};

export const SHOPS = {
  general: ['trank1', 'mana1', 'trank2', 'mana2', 'trank3', 'mana3', 'elixier', 'kupferring', 'kraeuterband', 'wolfszahn', 'knochenring', 'zahnradring'],
  smith: ['rostschwert', 'eisenschwert', 'goblinhacker', 'waldklinge', 'runenkeule', 'knochensaebel', 'totenbeil', 'sonnenklinge', 'glutspeer', 'frostzahn', 'eisgross', 'zahnradhammer', 'uhrwerkklinge', 'mondsichel', 'schattenklinge', 'lederwams', 'kettenhemd', 'sonnenharnisch', 'frostpelz', 'uhrwerkpanzer', 'schattenplatte'],
  magic: ['trank1', 'mana1', 'mana2', 'mana3', 'wanderstab', 'moorstab', 'sternenstab', 'aschenstab', 'waldmantel', 'moorrobe', 'wuestengarn', 'runenrobe', 'mondgewand', 'hexenauge', 'sonnenamulett', 'eisherz', 'mondstein'],
};
export const TOWN_TIER = { hutdorf: 2, rindenheim: 3, totenfurt: 4, goldoase: 5, eiswacht: 6, tickholm: 7, aschenrast: 8 };

export const CHEST_LOOT = [
  ['trank1', 'mana1', 'kupfer', 'kupfer', 'rostschwert', 'lederwams', 'kupferring'],
  ['trank1', 'trank2', 'mana1', 'wolfsfell', 'goblinhacker', 'wolfszahn', 'waldmantel'],
  ['trank2', 'mana2', 'ektoplasma', 'knochen', 'runenkeule', 'knochenring', 'moorstab'],
  ['trank2', 'mana2', 'glutstein', 'edelstein', 'sonnenklinge', 'wuestengarn', 'sonnenamulett'],
  ['trank3', 'mana2', 'eissplitter', 'edelstein', 'frostzahn', 'frostpelz', 'eisherz'],
  ['trank3', 'mana3', 'zahnrad', 'goldbarren', 'zahnradhammer', 'runenrobe', 'zahnradring'],
  ['trank3', 'mana3', 'elixier', 'schattenstaub', 'goldbarren', 'mondsichel', 'mondstein'],
];

// Legendäre Beute: Sie fällt nur bei Elite-Monstern, Bossen und aus Mondrissen.
const L = o => Object.assign(o, { rare: 1 });
W('funkenbrecher', 'Funkenbrecher', 'sword', 24, 700, 2, 0xff9a3a, 'Bei jedem Schlag stieben Funken, die nie ganz erlöschen.', { fx: { crit: .08, kraft: 3 } });
R('wolfsauge', 'Wolfsauge', 900, 3, { crit: .1, speed: .05 }, '+10 % kritisch, +5 % Tempo. Es blinzelt manchmal.');
W('nachtsplitter', 'Nachtsplitter', 'dagger', 42, 1400, 4, 0x9a5aff, 'Eine Klinge aus dem dunkelsten Teil der Nacht.', { fx: { crit: .16, speed: .06 } });
R('herzglut', 'Herzglut', 1500, 4, { regen: 3, hp: 50 }, '+50 Leben und ständige Heilung. Das Amulett ist warm.');
A('aschenmantel', 'Mantel der Asche', 34, 2100, 5, { top: 0x3a2a2a, armor: 0x6a4a3a, bottom: 0x241a1a, hat: 'hood', hatColor: 0x2a1c1c, cape: 0xc2401c, cape2: 0xff9a30 }, 'Er glimmt an den Säumen und brennt doch nie ab.', { hp: 70, fx: { speed: .07 } });
W('wintereid', 'Wintereid', 'great', 74, 2800, 6, 0xbfe8ff, 'Wer ihn schwört, friert nie wieder. Wer ihn bricht, sofort.', { fx: { kraft: 6, ausdauer: 4 } });
R('eisenwille', 'Eisenwille', 3000, 6, { kraft: 8, ausdauer: 8 }, '+8 Kraft, +8 Ausdauer. Ein schwerer, ehrlicher Ring.');
R('totenkerze', 'Totenkerze', 3400, 7, { geist: 10, mp: 60 }, '+10 Geist, +60 Mana. Sie brennt mit kaltem Licht.');
W('grabgesang', 'Grabgesang', 'scythe', 98, 4600, 7, 0x7ff2c8, 'Die Sense summt leise, wenn jemand in der Nähe stirbt.', { sp: 18, fx: { geist: 8, regen: 2 } });
A('blutharnisch', 'Blutharnisch', 70, 5600, 8, { top: 0x3a1018, armor: 0x8a1c2c, bottom: 0x20090e, hat: 'horns', hatColor: 0x3a1018, cape: 0x6a1020 }, 'Geschmiedet unter dem Blutmond.', { hp: 170, fx: { kraft: 5 } });
W('sonnenbrecher', 'Sonnenbrecher', 'hammer', 128, 6400, 8, 0xffc445, 'Ein Hammer, der einst eine Sonne aufhielt.', { fx: { kraft: 10, crit: .06 } });
for (const id of ['funkenbrecher', 'wolfsauge', 'nachtsplitter', 'herzglut', 'aschenmantel', 'wintereid', 'eisenwille', 'totenkerze', 'grabgesang', 'blutharnisch', 'sonnenbrecher']) L(ITEMS[id]);
