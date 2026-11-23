export const LORE = {
  urpilz: ['Der Urpilz', 'Die Bauern von Morgenkappe sagen, alle Pilze der Mark seien nur seine Finger. Niemand hat je nachgesehen, was unter ihm liegt.'],
  mondbrunnen: ['Der Mondbrunnen', 'Als der Mond zum letzten Mal weinte, fiel eine einzige Träne auf diese Wiese. Das Wasser ist seitdem nicht gesunken.'],
  erstermagier: ['Der Erste Magier', 'In den Sockel gemeißelt: „Er lehrte uns, das Licht zu tragen. Er vergaß, uns zu lehren, es wieder abzustellen.“'],
  trollstein: ['Der Trollstein', 'Kein Schädel. Das sagen die Trolle. Es sei nur ein Stein, der aussieht wie ein Schädel, und wer anderes behaupte, werde gern zum Stein.'],
  hexe: ['Moosas Haushaltsbuch', '„Montag: drei Kröten. Dienstag: zwei Kröten, eine Kröte ist weggelaufen. Mittwoch: Der Laternenträger kommt bald. Mehr Kröten.“'],
  eiche: ['Die Alte Eiche', 'Sie war schon alt, als der Mond noch schlief. In ihre Rinde sind die Namen aller Laternenträger geritzt. Der letzte ist noch frisch.'],
  schieferturm: ['Der Schiefe Turm', 'Gebaut von einem Baumeister, der nicht ans Moor glaubte. Das Moor glaubte dafür umso mehr an ihn.'],
  riese: ['Das Skelett des Riesen', 'König Harmund, der die Erde selbst für sein Volk trug. Er fiel im Kampf gegen Morvane und liegt seither, wie er gefallen ist.'],
  namenlose: ['Friedhof der Namenlosen', 'Odos Großvater wusste noch alle Namen. Dann kam die Nacht, die nicht endete, und niemand hatte mehr Zeit zum Erinnern.'],
  sonnenstein: ['Der Sonnenstein', 'Hier betete das alte Volk um Morgen. Die Sonne hörte zu, damals, als sie noch nicht wütend war.'],
  bogen: ['Der Bogen der Könige', 'Zwölf Könige zogen hier hindurch, um die Sonne um Gnade zu bitten. Elf kamen zurück. Der zwölfte ist jetzt Sand.'],
  sandschiff: ['Das Sandschiff', 'Einst lag hier ein Meer. Die Sonne trank es in einem einzigen zornigen Sommer aus.'],
  eiskrone: ['Die Eiskrone', 'Die Runen im Eis erzählen von einer Flamme, die friert, statt zu brennen. Runa meint, das sei die traurigste Sache der Welt.'],
  drachenruh: ['Drachenruh', 'Hier gingen die Eisdrachen hin, um zu sterben. Hrimgar ist der Einzige, dem man das verboten hat.'],
  ritter: ['Der Gefrorene Ritter', 'Sein Gesicht ist unter dem Eis noch zu erkennen. Er sieht nicht ängstlich aus, nur sehr, sehr müde.'],
  uhrturm: ['Der Stumme Uhrturm', 'Er schlug einst die Stunde für das ganze Reich. Dann fiel der Klöppel, und niemand wusste mehr, wie spät es ist.'],
  zahnrad: ['Das Gefallene Zahnrad', 'Ein Teil des Großen Uhrwerks. Niemand weiß, warum die Maschine ohne dieses Rad weiterläuft. Das macht allen Sorgen.'],
  sternwarte: ['Das Observatorium', 'Letzter Eintrag: „Der Mond hat heute genau wie gestern nicht geblinzelt. Jahr 1000. Ich glaube, er sieht uns an.“'],
  mondtor: ['Das Mondtor', 'Früher ging der Mond durch dieses Tor schlafen. Es ist viel zu klein dafür, aber in Märchen stört das niemanden.'],
  schwerter: ['Das Feld der Schwerter', 'Die letzte Schlacht gegen Morvane. Jedes Schwert hier ist ein Grab, und es sind sehr viele Schwerter.'],
  hohlturm: ['Der Hohle Turm', 'Hier studierte der junge Morvane. Auf einem Tisch steht noch immer ein Becher mit dem Tee seiner Mutter. Er ist nie kalt geworden.'],
};

// Jede Szene ist eine Liste von Einstellungen. poi = Blickziel, orbit oder dolly = Kamera, say = Text.
export const SCENES = {
  intro: [
    { sky: 22, poi: 'l_mondbrunnen', orbit: [130, 62, 2.2, 2.7], moon: 0, say: [null, 'Einst teilten sich Sonne und Mond den Himmel. Sie liebte den Tag. Er behütete die Nacht.'] },
    { poi: 'l_riesenpilz', orbit: [90, 40, .8, 1.5], say: [null, 'Jeden Morgen schloss der Mond die Augen, und die Welt durfte schlafen und erwachen.'] },
    { poi: 'zitadelle', orbit: [210, 90, -.5, .4], moonOpen: 1, say: [null, 'Dann stahl der Magier Morvane dem Mond den Schlaf. Das ist nun tausend Jahre her.'] },
    { body: 'moon', moonOpen: 1, say: [null, 'Seither starrt er auf uns herab. Er kann die Augen nicht mehr schließen.'] },
    { poi: 'l_zauberer', orbit: [70, 26, 3.5, 4.3], moonOpen: 0, say: [null, 'Die Sonne wurde zornig. Die Toten standen auf. Die Goblins kamen aus den Wäldern.'] },
    { poi: 'hutdorf', orbit: [80, 34, 1.2, 2.2], say: [null, 'Nur eine einzige Laterne hielt die ewige Nacht noch fern. Und auch sie erlischt.'] },
    { player: 1, dolly: [[8, 5, 9], [4, 3.2, 6]], say: ['Mirel', 'Wach auf. Du hast lange genug geschlafen. Wach auf!'] },
  ],
  borke: [
    { mount: 1, orbit: [13, 3.4, .5, 1.25], say: [null, 'Zwischen den Riesenpilzen steht etwas Großes und atmet. Auf seinem Geweih wächst ein kleiner Garten.'] },
    { mount: 1, orbit: [8, 1.6, 2.2, 2.75], say: [null, 'Der Elch hebt den Kopf, schnaubt und riecht lange an deiner Laterne.'] },
    { mount: 1, saddle: 1, orbit: [10, 3, 3.7, 4.3], say: [null, 'Du legst ihm den Sattel auf. Er bleibt stehen. Von jetzt an seid ihr zu zweit unterwegs.'] },
  ],
  flammen: [
    { poi: 'goblinfeste', orbit: [120, 60, 1, 1.7], say: ['Mirel', 'Die Waldflamme, im Westen, in den Händen eines Goblinkönigs.'] },
    { poi: 'knochengruft', orbit: [90, 40, 2, 2.6], say: ['Mirel', 'Die Moorflamme, bei einem Grafen, der nicht sterben wollte.'] },
    { poi: 'sonnengrab', orbit: [140, 64, 3.8, 4.5], say: ['Mirel', 'Die Sonnenflamme, im Grab eines Priesters, der den Himmel verbrennen will.'] },
    { poi: 'frostfeste', orbit: [150, 70, 5.5, 6.1], say: ['Mirel', 'Die Frostflamme, unter den Klauen des letzten Eisdrachen.'] },
    { poi: 'zitadelle', orbit: [230, 100, .2, .8], moonOpen: 1, say: ['Mirel', 'Morvane, der dem Mond den Schlaf gestohlen hat, sitzt dort. Mit allen vier Flammen kannst du ihn aufhalten. Hol sie dir, in welcher Reihenfolge du willst.'] },
  ],
  flamme1: [{ player: 1, orbit: [8, 3.5, 0, 1.2], flame: 0x57f0a0, say: [null, 'Die Waldflamme springt in deine Laterne. Das Licht wird grün wie junges Laub.'] }, { body: 'moon', moonOpen: .4, say: [null, 'Hoch oben zuckt ein Lid. Zum ersten Mal seit tausend Jahren.'] }],
  flamme2: [{ player: 1, orbit: [8, 3.5, 2, 3.2], flame: 0x7ff2c8, say: ['Graf Ossian', 'Vesper? Ist es schon Morgen? Ich bin so müde.'] }, { player: 1, orbit: [10, 4.5, 3.2, 4], flame: 0x7ff2c8, say: [null, 'Die Moorflamme gleitet in deine Laterne. Sie ist kalt und friedlich.'] }],
  flamme3: [{ player: 1, orbit: [8, 3.5, 4, 5.2], flame: 0xffc445, say: ['Solgar', 'Sie wird ihn verbrennen. Sie wird ihn... warum weint sie?'] }, { body: 'sun', say: [null, 'Die Sonne blickt auf dich herab. Sie sieht nicht mehr wütend aus. Nur verlassen.'] }],
  flamme4: [{ player: 1, orbit: [11, 5, 1, 2.2], flame: 0x9fe4ff, say: ['Hrimgar', 'Endlich. Ich danke dir, kleine Flamme. Lass mich nun schlafen gehen.'] }, { player: 1, orbit: [9, 4, 2.2, 3], flame: 0x9fe4ff, say: [null, 'Die Frostflamme sinkt in deine Laterne. Sie brennt kalt und ganz still.'] }],
  alle_flammen: [{ player: 1, orbit: [9, 4, 2.2, 3], flame: 0xffffff, say: [null, 'Vier Flammen brennen nun in der Letzten Laterne. Im Norden beginnt die Zitadelle zu dröhnen.'] }, { poi: 'zitadelle', orbit: [200, 90, .4, 1], moonOpen: 1, say: ['Morvane', 'Ich sehe dich, kleines Licht.'] }, { poi: 'tickholm', orbit: [120, 52, 2, 2.7], moonOpen: 0, say: ['Mirel', 'Sein Tor öffnet nur die Zeitfeder. Sie steckt im Großen Uhrwerk bei Tickholm.'] }],
  wahrheit: [{ poi: 'hutdorf', orbit: [80, 34, 1.2, 2], say: ['Mirel', 'Du hast den Brief gelesen. Ja. Morvane ist mein Bruder.'] }, { body: 'moon', moonOpen: .6, say: ['Mirel', 'Er wollte nur nicht, dass unsere Mutter stirbt. Also stahl er die Nacht, damit ihr letzter Morgen niemals kommt. Sie starb trotzdem. Er hat es nie geglaubt.'] }, { poi: 'zitadelle', orbit: [200, 86, 2, 2.7], moonOpen: 1, say: ['Mirel', 'Ich bin tausend Jahre alt und habe nie den Mut gehabt, ihn aufzuhalten. Du hast ihn.'] }],
  brief: [{ player: 1, dolly: [[3, 3, 5], [2, 2.6, 3.6]], say: ['Morvanes Brief', '„Liebste Mirel, heute Abend hat Mutter nach dir gefragt. Ich habe die Nacht festgehalten, so wie ich es versprochen habe.“'] }, { player: 1, dolly: [[2, 2.6, 3.6], [1.6, 2.6, 3]], say: ['Morvanes Brief', '„Solange es nicht Morgen wird, kann sie nicht sterben. Komm nach Hause. Du wirst sehen, dass ich recht hatte. Dein Bruder.“'] }],
  zitadelle: [
    { poi: 'zitadelle', orbit: [130, 42, 3.1, 3.5], moonOpen: 1, say: [null, 'Die Zeitfeder dreht sich von selbst in deiner Hand. Das Tor der Zitadelle öffnet sich knirschend.'] },
    { body: 'moon', moonOpen: 1, say: ['Der Mond', 'Bitte...'] },
  ],
  morvane: [
    { boss: 1, orbit: [18, 8, 0, .8], say: ['Morvane', 'Du bist also das Licht, das sie geschickt hat. Weißt du, was du da trägst? Das ist der Morgen. Der Morgen, der sie töten wird.'] },
    { boss: 1, orbit: [14, 6, .8, 1.5], say: ['Morvane', 'Ich habe tausend Jahre lang am Bett meiner Mutter gewacht. Geh. Weck sie nicht auf.'] },
    { player: 1, dolly: [[4, 3, 6], [3, 2.8, 4.5]], say: [null, 'In der Ecke des Saals steht ein leeres Bett. Niemand liegt darin. Schon sehr lange nicht mehr.'] },
  ],
  finale: [
    { player: 1, orbit: [10, 4, 0, 1], flame: 0xffffff, say: ['Morvane', 'Mutter? Ich habe doch... ich habe es doch festgehalten.'] },
    { player: 1, orbit: [8, 3.4, 1, 1.8], flame: 0xffffff, say: [null, 'Der Hohle zerfällt zu Asche. Der gestohlene Schlaf des Mondes strömt in deine Laterne.'] },
    { body: 'moon', moonOpen: 1, say: ['Der Mond', 'Kleines Licht. Du hältst meinen Schlaf in den Händen. Was tust du nun damit?'], ending: 1 },
  ],
  end_morgen: [
    { body: 'moon', moonOpen: 0, say: [null, 'Du öffnest die Laterne. Der Schlaf steigt auf, und der Mond schließt nach tausend Jahren die Augen.'] },
    { sky: 7, poi: 'hutdorf', orbit: [110, 46, .4, 1.2], say: [null, 'Und dann, ganz langsam, kommt der Morgen.'] },
    { body: 'sun', say: ['Die Sonne', 'Da bist du ja wieder.'] },
    { poi: 'hutdorf', orbit: [60, 20, 3, 3.6], say: ['Mirel', 'Endlich. Ich glaube, ich lege mich jetzt auch ein wenig hin. Lass die Laterne ruhig aus.'] },
  ],
  end_waechter: [
    { body: 'moon', moonOpen: .5, say: [null, 'Du behältst den Schlaf für dich. Jemand muss ihn hüten, damit ihn nie wieder jemand stiehlt.'] },
    { sky: 5.5, poi: 'zitadelle', orbit: [160, 70, 1, 1.8], say: [null, 'Der Mond schläft nur noch, wenn du es erlaubst. Die Morgen kommen wieder, Tag für Tag.'] },
    { player: 1, orbit: [8, 3.5, 2, 3], say: [null, 'Du aber schläfst nie mehr. Die Laterne brennt in deinen Händen, und sie wird noch tausend Jahre brennen.'] },
  ],
  end_nacht: [
    { body: 'moon', moonOpen: 1, say: [null, 'Du zerschlägst die Laterne. Der Schlaf des Mondes verweht für immer.'] },
    { sky: 0, poi: 'zitadelle', orbit: [160, 80, 2, 2.8], moonOpen: 1, say: ['Der Mond', 'Dann schauen wir eben gemeinsam zu.'] },
    { player: 1, orbit: [8, 3.4, 3, 4], moonOpen: 1, say: [null, 'Die Nacht bleibt. Aber sie gehört jetzt dir, und du hast keine Angst mehr vor ihr.'] },
  ],
};

export const ENDINGS = [
  { id: 'end_morgen', t: 'Die Laterne öffnen und den Mond schlafen lassen', title: 'Der Erste Morgen' },
  { id: 'end_waechter', t: 'Den Schlaf behalten und selbst Wächter werden', title: 'Der Ewige Wächter' },
  { id: 'end_nacht', t: 'Die Laterne zerschlagen', title: 'Die Nacht Bleibt' },
];

export const TIPS = [
  'Rolle durch Angriffe hindurch. Dabei bist du kurz unverwundbar.',
  'Wenn der Mond die Augen öffnet, werden alle Feinde stärker. Sei dann vorsichtig.',
  'Entzünde Laternensäulen. Über die Weltkarte kannst du zwischen ihnen reisen.',
  'Fünf Mondsplitter erhöhen dauerhaft dein Leben und Mana.',
  'Rote Kreise am Boden zeigen, wo gleich etwas einschlägt.',
  'Halte Blocken gedrückt, um Treffer mit der Waffe abzufangen.',
  'Wirte heilen dich gegen ein paar Münzen vollständig.',
  'Nachts kriechen Untote aus dem Boden, tagsüber ist das Moor etwas sicherer.',
  'Überflüssige Beute lässt sich bei jedem Händler verkaufen.',
  'Leuchtende Säulen am Horizont sind Mondprüfungen. Jede schenkt dir einen Mondsplitter.',
  'Die vier Flammen kannst du in jeder Reihenfolge holen. Wer in den Städten hilft, schwächt ihre Wächter.',
  'Im Galopp reitet Borke kleine Gegner einfach um. Harte Treffer können dich aber aus dem Sattel werfen.',
  'Hirtin Wenke in Morgenkappe vermisst ihren Elch. Wer ihr hilft, muss nie wieder laufen.',
];
