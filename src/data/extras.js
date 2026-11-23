// Elite-Monster, Talente und Erfolge.
export const ELITES = {
  flamme: { n: 'der Glut', c: 0xff7a28, d: 'Explodiert beim Tod' },
  frost: { n: 'des Frosts', c: 0x9fe4ff, d: 'Treffer verlangsamen' },
  vampir: { n: 'des Blutes', c: 0xff3a4a, d: 'Heilt sich durch Treffer' },
  schatten: { n: 'der Schatten', c: 0x9a5aff, d: 'Springt hinter dich' },
  rasend: { n: 'der Raserei', c: 0xffd24a, spd: 1.42, d: 'Sehr schnell' },
  fels: { n: 'aus Stein', c: 0xc8cfe8, post: 2, hp: 1.35, d: 'Lässt sich kaum aus dem Tritt bringen' },
};
export const ELITE_IDS = Object.keys(ELITES);

export const TREES = ['Klinge', 'Laterne', 'Schatten'];
export const TALENTS = [
  { id: 'klinge', tree: 0, n: 'Scharfe Klinge', d: '+12 % Nahkampfschaden' },
  { id: 'wucht', tree: 0, n: 'Schwerer Arm', d: 'Wuchtschläge machen 35 % mehr Schaden' },
  { id: 'bruch', tree: 0, n: 'Haltungsbrecher', d: 'Gegner geraten 30 % schneller ins Taumeln' },
  { id: 'henker', tree: 0, n: 'Henker', d: 'Todesstöße machen 50 % mehr Schaden' },
  { id: 'glut', tree: 1, n: 'Laternenglut', d: '+12 % Zauberkraft' },
  { id: 'docht', tree: 1, n: 'Langer Docht', d: 'Mana füllt sich 50 % schneller' },
  { id: 'waerme', tree: 1, n: 'Warmes Licht', d: 'Leben kehrt langsam von selbst zurück' },
  { id: 'flamme', tree: 1, n: 'Zweite Flamme', d: 'Überlebe alle 90 Sekunden einen tödlichen Treffer' },
  { id: 'leicht', tree: 2, n: 'Leichtfuß', d: 'Rollen kostet 30 % weniger Ausdauer' },
  { id: 'schritt', tree: 2, n: 'Schattenschritt', d: 'Perfektes Ausweichen und Parieren gelingen leichter' },
  { id: 'konter', tree: 2, n: 'Konterschlag', d: 'Konter machen 40 % mehr Schaden' },
  { id: 'blut', tree: 2, n: 'Blutdurst', d: '5 % des Nahkampfschadens heilen dich' },
];
export const TALENT = Object.fromEntries(TALENTS.map(t => [t.id, t]));

export const LEGENDS = ['funkenbrecher', 'wolfsauge', 'nachtsplitter', 'herzglut', 'aschenmantel', 'wintereid', 'eisenwille', 'totenkerze', 'grabgesang', 'blutharnisch', 'sonnenbrecher'];

const F = (id, n, d, stat, need) => ({ id, n, d, stat, need });
export const FEATS = [
  F('kill1', 'Erstes Blut', 'Besiege einen Gegner', 'kills', 1),
  F('kill100', 'Hundert Gefallene', 'Besiege 100 Gegner', 'kills', 100),
  F('kill500', 'Schrecken der Mark', 'Besiege 500 Gegner', 'kills', 500),
  F('parry1', 'Stahl auf Stahl', 'Pariere einen Angriff', 'parries', 1),
  F('parry50', 'Meister der Parade', 'Pariere 50 Angriffe', 'parries', 50),
  F('dodge1', 'Knapp daneben', 'Weiche perfekt aus', 'perfects', 1),
  F('dodge50', 'Schatten im Wind', 'Weiche 50-mal perfekt aus', 'perfects', 50),
  F('fin1', 'Todesstoß', 'Beende einen taumelnden Gegner', 'finishers', 1),
  F('fin50', 'Scharfrichter', 'Setze 50 Todesstöße', 'finishers', 50),
  F('heavy25', 'Mit voller Wucht', 'Triff mit 25 Wuchtschlägen', 'heavies', 25),
  F('elite1', 'Kein gewöhnlicher Feind', 'Besiege ein Elite-Monster', 'elites', 1),
  F('elite25', 'Elitejäger', 'Besiege 25 Elite-Monster', 'elites', 25),
  F('rift1', 'Riss geschlossen', 'Schließe einen Mondriss', 'rifts', 1),
  F('rift10', 'Hüter der Grenze', 'Schließe 10 Mondrisse', 'rifts', 10),
  F('legend1', 'Legendär', 'Finde einen legendären Gegenstand', 'legends', 1),
  F('legend5', 'Sammler der Sagen', 'Finde 5 legendäre Gegenstände', 'legends', 5),
  F('blood1', 'Unter rotem Mond', 'Besiege 10 Gegner im Blutmond', 'bloodKills', 10),
  F('boss1', 'Riesentöter', 'Besiege einen großen Feind', '_boss', 1),
  F('boss8', 'Schrecken der Schrecken', 'Besiege 8 große Feinde', '_boss', 8),
  F('boss15', 'Letztes Licht', 'Besiege alle 15 großen Feinde', '_boss', 15),
  F('lvl10', 'Erfahren', 'Erreiche Stufe 10', '_level', 10),
  F('lvl25', 'Veteran', 'Erreiche Stufe 25', '_level', 25),
  F('lvl50', 'Lebende Legende', 'Erreiche Stufe 50', '_level', 50),
];
