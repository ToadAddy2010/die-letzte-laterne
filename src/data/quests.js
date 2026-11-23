export const QUESTS = {};
const q = (id, title, type, giver, o) => { QUESTS[id] = { id, title, type, giver, ...o }; };
const talk = (npc, hint, lines, x = {}) => ({ k: 'talk', npc, hint, lines, ...x });
const kill = (what, n, hint, x = {}) => ({ k: 'kill', what: [].concat(what), n, hint, ...x });
const boss = (id, hint) => ({ k: 'boss', id, hint });
const get = (item, n, at, hint) => ({ k: 'get', item, n, at, hint });
const drop = (item, from, n, chance, hint) => ({ k: 'drop', item, from: [].concat(from), n, chance, hint });
const go = (poi, hint, lines) => ({ k: 'go', poi, hint, lines });
const scene = id => ({ k: 'scene', id });

// ─────────────── Hauptgeschichte ───────────────
// Nach dem ersten Dungeon ist die Welt offen. Die vier Flammen gehen in jeder Reihenfolge.
const voice = (n, ...lines) => ({ n, lines });
q('m01', 'Die Letzte Laterne', 'main', 'mirel', {
  auto: true, desc: 'Älteste Mirel hat dich geweckt. Die Laterne des Reiches erlischt.',
  steps: [
    talk('mirel', 'Sprich mit Ältester Mirel auf dem Dorfplatz', ['Endlich bist du wach. Du hast drei Tage geschlafen, und das ist heutzutage ein Kunststück.', 'Niemand schläft mehr gut, seit der Mond nicht mehr schläft. Tausend Jahre hält er nun die Augen offen.', 'Dies ist die Letzte Laterne. Sie hat das Reich vor der ewigen Nacht bewahrt, und sie geht aus.', 'Ich bin zu alt. Du bist es nicht. Nimm sie.'], { give: 'laterne' }),
    go('s_hutdorf', 'Entzünde die Laternensäule von Morgenkappe', ['Die Laterne flackert auf. Die Säule antwortet ihr.']),
  ],
  outro: voice('Mirel', 'Sie hat dich angenommen. Säulen wie diese stehen überall im Land. Entzünde sie, und du kannst zwischen ihnen reisen.', 'Und hör gut zu: Die Laterne trägt auch Stimmen. Wem du hilfst, der dankt dir durch sie. Du musst also nie extra zurücklaufen.'),
  reward: { xp: 60, gold: 30, items: ['trank1', 'trank1'] },
});
q('m02', 'Stahl und Goblins', 'main', 'brom', {
  auto: true, req: ['m01'], desc: 'Schmied Brom will sehen, ob du eine echte Waffe verdienst.',
  intro: voice('Schmied Brom', 'Mirel sagt, du trägst jetzt die Laterne. Mit dem Holzschwert? Am Bach im Süden lagern Goblins. Erledige drei, dann hast du eine echte Klinge verdient.'),
  steps: [kill(['goblin', 'goblin_archer'], 3, 'Besiege 3 Goblins, zum Beispiel am Bach im Süden', { at: 'c_gob1' })],
  outro: voice('Schmied Brom', 'Du lebst noch. Das ist mehr, als ich gewettet hatte. Die Klinge liegt schon in deinem Beutel. Frag nicht, wie.'),
  reward: { xp: 90, gold: 40, items: ['rostschwert'] },
});
q('m03', 'Die Sporengrotte', 'main', 'mirel', {
  auto: true, req: ['m02'], desc: 'Eine Sporenkrankheit breitet sich von der Grotte im Osten aus.',
  intro: voice('Mirel', 'Hörst du den Husten im Dorf? Aus der Sporengrotte im Osten quillt giftiger Nebel. Etwas ist dort unten erwacht.'),
  steps: [boss('sporenfuerst', 'Besiege den Herrn der Sporengrotte im Osten')],
  outro: { n: 'Mirel', lines: ['Ich spüre es bis hierher: Der Sporenfürst ist gefallen. Er hatte Angst, aber nicht vor dir. Vor etwas aus dem Norden.', 'Jeder Laternenträger beginnt mit Feuer. Nimm die erste Flamme.'], take: ['sporenkern', 1] },
  reward: { xp: 240, gold: 90, spell: 'feuerball' },
});
q('m04', 'Vier Flammen', 'main', 'mirel', {
  auto: true, req: ['m03'], desc: 'Um die Laterne zu retten, brauchst du die vier Flammen des Reiches.',
  steps: [scene('flammen')],
  outro: voice('Mirel', 'Wald, Moor, Sonne und Frost. Die Reihenfolge ist ganz allein deine Sache.', 'Du kannst sofort losziehen. Oder du hörst dich erst in den Städten um, dort wartet viel Arbeit und manche Hilfe. Die Welt ist offen.'),
  reward: { xp: 180, gold: 70, items: ['trank1', 'mana1'] },
});
q('m05', 'Die Waldflamme', 'main', 'yrsa', {
  auto: true, req: ['m04'], desc: 'König Krumnase hält die Waldflamme in seiner Goblinfeste im Düsterforst für einen hübschen Kerzenständer.',
  steps: [boss('krumnase', 'Waldflamme: Besiege König Krumnase in seiner Feste im Westen'), scene('flamme1')],
  outro: voice('Waldhüterin Yrsa', 'Die Waldflamme. Sie riecht nach Regen auf Moos. Ich hatte vergessen, wie das ist.'),
  reward: { xp: 620, gold: 260, items: ['waldklinge', 'trank2'], spell: 'heilung' },
});
q('m07', 'Die Moorflamme', 'main', 'vesper', {
  auto: true, req: ['m04'], desc: 'Graf Ossian wollte nicht sterben. Seine Gruft im Knochenmoor hütet die Moorflamme.',
  steps: [boss('ossian', 'Moorflamme: Besiege Graf Ossian in der Knochengruft im Süden'), scene('flamme2')],
  outro: voice('Priesterin Vesper', 'Er ist fort. Der Nebel ist heute dünner. Danke.'),
  reward: { xp: 1100, gold: 460, items: ['knochenring', 'trank2', 'mana2'], spell: 'frostlanze' },
});
q('m09', 'Die Sonnenflamme', 'main', 'zahra', {
  auto: true, req: ['m04'], desc: 'Der Hohepriester Solgar bewacht die Sonnenflamme im großen Grab der Glutwüste.',
  steps: [boss('solgar', 'Sonnenflamme: Besiege Solgar im Sonnengrab im Osten'), scene('flamme3')],
  outro: voice('Sultana Zahra', 'Es ist vorbei? Die Sonne sah kurz so aus, als würde sie weinen. Sie und der Mond waren einmal ein Paar.'),
  reward: { xp: 1700, gold: 720, items: ['sonnenamulett', 'trank3'], spell: 'sonnenring' },
});
q('m11', 'Die Frostflamme', 'main', 'sigrun', {
  auto: true, req: ['m04'], desc: 'Hrimgar, der letzte Eisdrache, wurde dazu verflucht, die Frostflamme zu bewachen.',
  steps: [boss('hrimgar', 'Frostflamme: Stelle dich Hrimgar in der Frostfeste im Norden'), scene('flamme4')],
  outro: voice('Hauptfrau Sigrun', 'Der Drache ist tot? Dann schulde ich dir ein Fass Met.'),
  reward: { xp: 2400, gold: 900, items: ['eisherz', 'trank3'], spell: 'mondblitz' },
});
q('m12', 'Das Herz der Zeit', 'main', 'kinne', {
  auto: true, req: ['m05', 'm07', 'm09', 'm11'], desc: 'Die Zeitfeder im Großen Uhrwerk öffnet das Tor zur Zitadelle.',
  steps: [scene('alle_flammen'), go('tickholm', 'Reise nach Tickholm im Nordosten'), talk('kinne', 'Sprich mit Meisterin Kinne', ['Vier Minuten zu spät. Trotzdem willkommen.', 'Der Uhrmacher baute das Große Uhrwerk für Morvane, damit diese eine Nacht niemals endet. Er ist längst selbst ein Teil davon.']), boss('uhrmacher', 'Hol die Zeitfeder: Besiege den Uhrmacher im Großen Uhrwerk')],
  outro: voice('Meisterin Kinne', 'Hörst du das? Zum ersten Mal seit tausend Jahren geht eine Uhr in Tickholm nach. Behalte die Feder. Die Rebellen in Aschenrast warten auf dich.'),
  reward: { xp: 3400, gold: 1200, items: ['uhrwerkklinge'], spell: 'schattenschritt' },
});
q('m13', 'Aschenrast', 'main', 'varek', {
  auto: true, req: ['m12'], desc: 'Schließe dich den letzten Rebellen in der Aschenöde an.',
  steps: [go('aschenrast', 'Reise nach Aschenrast in der Aschenöde'), talk('varek', 'Sprich mit Rebell Varek', ['Also bist du es wirklich. Hier, nimm das. Das haben wir einem seiner Boten abgenommen. Lies es.'], { give: 'morvanebrief' }), scene('brief'), kill(['dark_wizard', 'shadow_knight', 'shadow_hound'], 8, 'Lichte die Reihen der Zitadelle (8 Feinde)')],
  outro: voice('Rebell Varek', 'Die Straße zur Zitadelle ist frei. Aber deine Laterne flackert. Ich glaube, da will jemand mit dir reden.'),
  reward: { xp: 2600, gold: 1000, items: ['elixier', 'elixier'] },
});
q('m14', 'Schwester und Bruder', 'main', 'mirel', {
  auto: true, req: ['m13'], desc: 'Mirel hat dir etwas verschwiegen.',
  steps: [scene('wahrheit')],
  outro: { n: 'Mirel', lines: ['Das Schwert aus allen vier Flammen liegt jetzt in deinem Beutel. Geh. Und wenn du ihn siehst, sag ihm, seine Schwester ist immer noch wütend. Und dass sie ihn vermisst.'], take: ['morvanebrief', 1] },
  reward: { xp: 1200, gold: 500, items: ['laternenschwert'] },
});
q('m15', 'Die Schwarze Zitadelle', 'main', 'mirel', {
  auto: true, req: ['m14'], desc: 'Beende, was vor tausend Jahren begann.',
  steps: [go('s_zit', 'Erreiche die letzte Laterne vor der Zitadelle'), scene('zitadelle'), boss('morvane', 'Besiege Morvane den Hohlen'), { ...scene('finale'), now: true }],
  reward: { xp: 5000, gold: 2000 },
});

// ─────────────── Morgenkappe ───────────────
q('s_borke', 'Der Elch mit dem Garten', 'side', 'wenke', { lvl: 2, req: ['m01'], region: 'pilz', desc: 'Wenkes Moos-Elch Borke ist fort, und die Sporenräuber haben sein Sattelzeug gestohlen.', offer: ['Du siehst aus, als hättest du schon mal einen Goblin verhauen. Gut.', 'Die Sporenräuber im Westen haben meine Weide überfallen und Borkes Sattelzeug mitgenommen. Borke ist vor Schreck bis zum Urpilz gerannt.', 'Hol den Sattel und bring ihn Borke. Wenn er dich mag, darfst du ihn behalten. Ich bin zu alt zum Reiten.'], steps: [get('sattelzeug', 1, 'c_gob2', 'Hol Wenkes Sattelzeug bei den Sporenräubern'), go('l_riesenpilz', 'Such Borke beim Urpilz', ['Hinter dem Urpilz schnaubt etwas sehr Großes.']), { ...scene('borke'), mount: true }, talk('wenke', 'Reite auf Borke zurück zu Hirtin Wenke', ['Na also! Er trägt dich. Das hat er bei meinem Mann nie gemacht.', 'Gib ihm ab und zu einen Pilz. Und wenn du ihn brauchst, ruf einfach. Er hört dich über das halbe Land.'])], reward: { xp: 180, gold: 80, items: ['trank1', 'trank1'] } });
q('s_pilze', 'Sechs Leuchtpilze', 'side', 'nessa', { lvl: 1, region: 'pilz', offer: ['Mein Tee geht aus! Auf der Lichtung im Westen wachsen die besten Leuchtpilze. Bringst du mir sechs?'], steps: [get('leuchtpilz', 6, 'c_shroom', 'Pflücke 6 Leuchtpilze auf der Lichtung der Pilzlinge'), talk('nessa', 'Bring Nessa die Pilze', ['Oh, wie schön sie glühen. Davon bekommst du eine Tasse, sobald er nicht mehr blubbert.'], { take: ['leuchtpilz', 6] })], reward: { xp: 70, gold: 40, items: ['trank1', 'mana1', 'kraeuterband'] } });
q('s_katze', 'Schnurrli ist weg', 'side', 'ilse', { lvl: 1, region: 'pilz', offer: ['Meine Katze Schnurrli ist schon wieder abgehauen! Sie jagt immer am Urpilz. Holst du sie zurück? Pass auf, sie beißt.'], steps: [get('schnurrli', 1, 'l_riesenpilz', 'Finde Schnurrli am Urpilz'), talk('ilse', 'Bring Schnurrli zu Oma Ilse', ['Da bist du ja, du Mistvieh! Komm her. Au! Ja, sie ist es.', 'Hier, Kind. Das habe ich für meinen Mann aufgehoben, aber der ist seit vierzig Jahren tot.'], { take: ['schnurrli', 1] })], reward: { xp: 60, gold: 25, items: ['kupferring'] } });
q('s_brief', 'Ein Brief mit Herzchen', 'side', 'gorm', { lvl: 2, region: 'pilz', offer: ['Du gehst doch sicher mal nach Rindenheim. Könntest du das hier Wirtin Marla geben? Sag niemandem was. Besonders nicht meiner Frau. Ich habe keine Frau, aber trotzdem.'], steps: [talk('marla', 'Bring den Brief zu Marla in Rindenheim', ['Von Gorm? Dieser alte Geizhals. Hat er wirklich Herzchen gemalt? Oh.', 'Sag ihm, er soll selbst kommen, wenn er sich traut.'], { give: 'brief_marla', takeAfter: 'brief_marla' }), talk('gorm', 'Berichte Gorm in Morgenkappe', ['Sie hat „traut“ gesagt? Heißt das Ja? Hier, nimm das, bevor ich es mir anders überlege.'])], reward: { xp: 120, gold: 80, items: ['trank2'] } });
q('s_goblinplage', 'Räuber auf der Straße', 'side', 'alrik', { lvl: 2, region: 'pilz', offer: ['Die Sporenräuber im Westen überfallen unsere Händler. Mach acht von ihnen unschädlich.'], steps: [kill(['goblin', 'goblin_archer'], 8, 'Besiege 8 Goblins in der Pilzmark'), talk('alrik', 'Melde dich bei Wache Alrik', ['Gute Arbeit. Du könntest bei der Wache anfangen. Das Gehalt ist furchtbar.'])], reward: { xp: 150, gold: 90, items: ['lederwams'] } });
q('s_brunnen', 'Das Wasser des Mondes', 'side', 'lune', { lvl: 3, region: 'pilz', offer: ['Dieses Wasser ist die letzte Träne, die der Mond geweint hat, bevor er das Weinen verlernte. Bringst du Mirel eine Flasche? Sie wird wissen, warum.'], steps: [talk('mirel', 'Bring Mirel das Mondwasser', ['Mondwasser. Ich habe es seit Jahrhunderten nicht gerochen. Unsere Mutter hat damit...', 'Nein. Vergiss es. Danke, das bedeutet mir viel.'], { give: 'mondwasser', takeAfter: 'mondwasser' })], reward: { xp: 110, gold: 60, items: ['mana1', 'mana1'] } });
q('s_chronik', 'Die Chronik des Aurelius', 'side', 'aurelius', { lvl: 3, region: 'pilz', offer: ['Für Band 41 brauche ich Augenzeugen! Besuche die Alte Eiche, den Sonnenstein und die Eiskrone, und erzähle mir danach, wie sie wirklich aussehen.'], steps: [go('l_weltbaum', 'Besuche die Alte Eiche'), go('l_sonnenstein', 'Besuche den Sonnenstein'), go('l_eiskrone', 'Besuche die Eiskrone'), talk('aurelius', 'Berichte Aurelius an seiner Statue', ['Groß, sagst du? Sehr groß? Das ist ein Durchbruch für die Forschung!', 'Dein Name erscheint in Fußnote 912. Und das hier ist für deine Mühe.'])], reward: { xp: 1400, gold: 700, items: ['sternenstab'] } });

// ─────────────── Rindenheim ───────────────
q('s_wolf', 'Das Rudel in der Senke', 'side', 'ivo', { lvl: 4, region: 'forest', offer: ['In der Rudelsenke reißen Schattenwölfe unser Vieh. Erledige sechs.'], steps: [kill('wolf', 6, 'Jage 6 Schattenwölfe'), talk('ivo', 'Berichte Jäger Ivo', ['Sauber. Die Felle kannst du behalten. Die Kette auch.'])], reward: { xp: 220, gold: 120, items: ['wolfszahn'] } });
q('s_holz', 'Hakons Holz', 'side', 'hakon', { lvl: 4, region: 'forest', offer: ['Die Goblins im Holzfällerlager haben meine besten Stämme geklaut. Hol sie zurück, alle fünf!'], steps: [get('baumstamm', 5, 'c_gob3', 'Hole 5 Stämme aus dem Holzfällerlager'), talk('hakon', 'Bring Hakon sein Holz', ['Meine Schätze! Der da heißt Herbert.'], { take: ['baumstamm', 5] })], reward: { xp: 240, gold: 150, items: ['goblinhacker'] } });
q('s_troll', 'Die Trollbrücke', 'side', 'fenna', { lvl: 6, region: 'forest', offer: ['Zwei Trolle verlangen Zoll an der Brücke im Süden. Sie wollen vor allem Händler. Zum Essen.'], steps: [kill('troll', 2, 'Besiege die Trolle an der Trollbrücke', { at: 'c_troll' }), talk('fenna', 'Melde dich bei Fenna', ['Die Straße ist frei? Dann bekommst du Rabatt auf Lebenszeit. Also, auf deine.'])], reward: { xp: 460, gold: 260, items: ['trank2', 'trank2'] } });
q('s_hexe', 'Ein Trank für Moosa', 'side', 'moosa', { lvl: 5, region: 'forest', offer: ['Du siehst stark aus, Kleines. Pflücke mir vier Mondmoos an der Alten Eiche, dann koche ich dir etwas Feines.'], steps: [get('moosblatt', 4, 'l_weltbaum', 'Pflücke 4 Mondmoos an der Alten Eiche'), talk('moosa', 'Bring Moosa das Mondmoos', ['Perfekt. Ein Rührer, zwei Rührer, ein bisschen Spucke. Fertig.', 'Trink das nicht auf leeren Magen. Oder auf vollen.'], { take: ['moosblatt', 4], give: 'hexentrank' })], reward: { xp: 330, gold: 120, items: ['hexenauge', 'mana2'] } });
q('s_wurzel', 'Die Wurzel allen Übels', 'side', 'yrsa', { lvl: 5, region: 'forest', offer: ['Im Wurzelgang wächst etwas, das die Bäume krank macht. Die Wurzelmutter. Reiß sie aus.'], steps: [boss('wurzelmutter', 'Besiege die Wurzelmutter im Wurzelgang'), talk('yrsa', 'Berichte Yrsa', ['Ich spüre es. Der Saft fließt wieder. Der Wald dankt dir.'])], reward: { xp: 560, gold: 300, items: ['waldklinge'] } });
q('s_grimmbart', 'Grimmbart der Alte', 'side', 'ivo', { lvl: 9, region: 'forest', offer: ['Du glaubst, du bist stark? Am Trollstein schläft Grimmbart, der älteste Troll der Welt. Bring mir seinen Zahn, und ich nenne dich einen Jäger.'], steps: [boss('altertroll', 'Besiege Grimmbart am Trollstein'), talk('ivo', 'Bring Ivo den Trollzahn', ['Bei allen Pilzen. Du hast es wirklich getan. Ich schulde dir ein Bier und meine Hochachtung.'], { take: ['trollzahn', 1] })], reward: { xp: 900, gold: 500, items: ['runenkeule', 'edelstein'] } });

// ─────────────── Totenfurt ───────────────
q('s_gebeine', 'Zurück ins Grab', 'side', 'odo', { lvl: 8, region: 'moor', offer: ['Auf dem Friedhof der Namenlosen liegen die Ahnen wieder überall herum. Sammle fünf Gebeine ein, bevor sie Ideen bekommen.'], steps: [get('ahnenbein', 5, 'l_friedhof', 'Sammle 5 Ahnengebeine auf dem Friedhof'), talk('odo', 'Bring Odo die Gebeine', ['Danke. Das hier ist Großonkel Wilbert, das dort auch.'], { take: ['ahnenbein', 5] })], reward: { xp: 520, gold: 240, items: ['knochenring'] } });
q('s_anna', 'Für immer', 'side', 'anna', { lvl: 9, region: 'moor', offer: ['Mein Mann ist vor hundert Jahren zum Knochenlager gegangen. Er hatte meinen Ring dabei. Findest du ihn? Ich kann nicht gehen, bevor ich es weiß.'], steps: [get('ehering', 1, 'c_skel2', 'Finde Annas Ring im Knochenlager'), talk('anna', 'Bring Anna den Ring', ['Das ist er. Für immer. Er ist also nicht weggelaufen.', 'Soll ich jetzt gehen? Es ist so lange her.'], { take: ['ehering', 1], choice: [{ t: 'Du darfst gehen, Anna.', flag: 'anna_ruhe', say: 'Danke. Sag dem Mond, er darf auch.' }, { t: 'Bleib noch und bewache den Turm.', flag: 'anna_bleibt', say: 'Dann warte ich noch ein bisschen. Ich bin gut darin.' }] })], reward: { xp: 640, gold: 180, items: ['mana2', 'edelstein'] } });
q('s_irrlicht', 'Irrlichter am Steg', 'side', 'lorik', { lvl: 9, region: 'moor', offer: ['Die Irrgeister locken meine Passagiere ins Moor. Das ist schlecht fürs Geschäft. Vertreib sechs.'], steps: [kill('ghost', 6, 'Vertreibe 6 Irrgeister'), talk('lorik', 'Berichte Fährmann Lorik', ['Das Moor ist wieder langweilig. Herrlich.'])], reward: { xp: 560, gold: 260, items: ['trank2', 'mana2'] } });
q('s_kantor', 'Das Lied der Versunkenen', 'side', 'vesper', { lvl: 10, region: 'moor', offer: ['In der Versunkenen Kapelle singt jede Nacht der Kantor, und die Toten stehen auf, um mitzusingen. Bring ihn zum Schweigen.'], steps: [boss('kantor', 'Besiege den Kantor in der Kapelle'), talk('vesper', 'Berichte Vesper', ['Stille. Wunderbare, herrliche Stille. Nimm dies mit meinem Segen.'])], reward: { xp: 980, gold: 460, items: ['moorrobe'] } });
q('s_riese', 'Der Zahn des Riesen', 'side', 'rhea', { lvl: 14, region: 'moor', offer: ['Das Skelett im Westen ist nicht so tot, wie es aussieht. Bring mir einen Zahn von ihm. Daraus schmiede ich was Unerhörtes.'], steps: [boss('knochenriese', 'Besiege den Erwachten Riesen'), talk('rhea', 'Bring Rhea den Zahn', ['Bei der Esse. Der ist ja größer als mein Arm.', 'Hier. Das Beil war für den König bestimmt, aber der ist gerade tot.'], { take: ['riesenzahn', 1] })], reward: { xp: 2000, gold: 900, items: ['totenbeil'] } });

// ─────────────── Goldoase ───────────────
q('s_wasser', 'Wasser für die Wache', 'side', 'layla', { lvl: 11, region: 'desert', offer: ['Die Wache beim Bogen der Könige hat seit zwei Tagen nichts getrunken. Bring ihnen diesen Schlauch.'], steps: [go('l_bogen', 'Bring den Wasserschlauch zum Bogen der Könige', ['Du lässt den Schlauch am Bogen. Stumme Hände greifen dankbar danach.']), talk('layla', 'Berichte Layla', ['Du bist ein guter Mensch. Der Tee geht aufs Haus.'])], reward: { xp: 480, gold: 200, items: ['trank2'] } });
q('s_karawane', 'Die geraubte Karawane', 'side', 'hamid', { lvl: 12, region: 'desert', offer: ['Glutjünger haben meine Waren gestohlen. Sie liegen im Lager im Westen. Vier Kisten, bitte unbeschädigt.'], steps: [get('ware', 4, 'c_cult1', 'Hole 4 Kisten aus dem Lager der Glutjünger'), talk('hamid', 'Bring Hamid die Ware', ['Mein Safran! Meine Seide! Mein anderer Safran!'], { take: ['ware', 4] })], reward: { xp: 720, gold: 420, items: ['glutspeer'] } });
q('s_skorpina', 'Die Königin des Baus', 'side', 'tarek', { lvl: 13, region: 'desert', offer: ['Mein Freund! Eine riesige Skorpionkönigin frisst meine Lieferungen. Du tötest sie, ich zahle. Alles ganz ehrlich!'], steps: [boss('skorpina', 'Besiege Skorpina im Skorpionbau'), talk('tarek', 'Kassiere bei Tarek ab', ['Du lebst? Wie wunderbar! Und völlig unerwartet. Hier, dein Lohn. Zähl lieber nach.'])], reward: { xp: 1500, gold: 760, items: ['edelstein', 'trank3'] } });
q('s_sandschiff', 'Das Schiff in der Wüste', 'side', 'bartel', { lvl: 12, region: 'desert', offer: ['Dieses Schiff liegt hunderte Meilen vom Meer entfernt. Das Logbuch liegt irgendwo im Wrack. Bringst du es Samira? Sie kann die alte Schrift lesen.'], steps: [get('logbuch', 1, 'l_schiff', 'Finde das Logbuch im Sandschiff'), talk('samira', 'Bring Samira das Logbuch', ['„Tag 4000. Das Meer ist nicht zurückgekommen. Wir segeln trotzdem.“', 'Wie schön. Und wie furchtbar dumm.'], { take: ['logbuch', 1] })], reward: { xp: 760, gold: 380, items: ['mana3'] } });
q('s_kaeferwette', 'Nuris Skorpione', 'side', 'nuri', { lvl: 12, region: 'desert', offer: ['Ich wette, du schaffst keine fünf Skorpione! Wenn doch, kriegst du meinen Schatz!'], steps: [kill('scorpion', 5, 'Besiege 5 Riesenskorpione'), talk('nuri', 'Zeig es Nuri', ['WOW! Okay, hier ist mein Schatz. Es ist ein Stein. Aber ein guter Stein!'])], reward: { xp: 640, gold: 60, items: ['edelstein', 'goldbarren'] } });

// ─────────────── Eiswacht ───────────────
q('s_ritter', 'Der Gefrorene Ritter', 'side', 'hilde', { lvl: 15, region: 'frost', offer: ['Der Ritter im Eis steht dort seit Urzeiten. Man sagt, er hält ein Schild, das seinen Namen trägt. Findest du heraus, wer er war?'], steps: [get('ritterschild', 1, 'l_gletscher', 'Hole den Schild des Gefrorenen Ritters'), talk('runa', 'Lass Runa das Wappen lesen', ['Das Wappen von Morgenkappe. Das ist der erste Laternenträger.', 'Er ist so weit gekommen wie du. Und nur bis hierher.'], { take: ['ritterschild', 1] })], reward: { xp: 980, gold: 460, items: ['eisgross'] } });
q('s_wache', 'Heulen am Grat', 'side', 'sigrun', { lvl: 15, region: 'frost', offer: ['Frostwölfe greifen die Patrouillen am Heulenden Grat an. Sechs Stück, und du kriegst Sold.'], steps: [kill('frost_wolf', 6, 'Jage 6 Frostwölfe'), talk('sigrun', 'Melde dich bei Sigrun', ['Sauber. Du kämpfst wie jemand aus dem Norden. Das ist das höchste Lob, das ich habe.'])], reward: { xp: 1000, gold: 500, items: ['trank3'] } });
q('s_yeti', 'Eiriks Wette', 'side', 'eirik', { lvl: 16, region: 'frost', offer: ['Ich habe gewettet, dass ich ein Yetihorn bringe. Bring du es, und ich sag einfach, ich war es. Wir teilen den Gewinn.'], steps: [drop('yetihorn', 'yeti', 1, 1, 'Erbeute ein Yetihorn in der Hornwacht'), talk('eirik', 'Bring Eirik das Horn', ['Du bist mein Held. Aber das bleibt unter uns.'], { take: ['yetihorn', 1] })], reward: { xp: 1200, gold: 640, items: ['edelstein'] } });
q('s_spiegel', 'Die Braut im Eis', 'side', 'runa', { lvl: 16, region: 'frost', offer: ['In der Spiegelgrotte wartet eine Braut auf ihren Bräutigam. Seit dreihundert Jahren. Sie friert das ganze Tal ein. Sprich mit ihr. Oder tu das andere.'], steps: [boss('eisbraut', 'Stelle die Eisbraut in der Spiegelgrotte'), talk('runa', 'Berichte Runa', ['Der Bach taut wieder. Das tut mir leid für sie, und gut für uns.'])], reward: { xp: 1900, gold: 880, items: ['runenrobe'] } });
q('s_drache', 'Drachenruh', 'side', 'bjorn', { lvl: 21, region: 'frost', offer: ['In Drachenruh regt sich ein Knochendrache. Bring mir eine Schuppe, und ich schmiede dir einen Ring, der Feuer und Frost zugleich trägt.'], steps: [boss('knochendrache', 'Besiege den Knochendrachen bei Drachenruh'), talk('bjorn', 'Bring Björn die Schuppe', ['Das ist tatsächlich eine. Du bist komplett verrückt. Das mag ich.'], { take: ['drachenschuppe', 1] })], reward: { xp: 4800, gold: 1800, items: ['mondsichel'] } });

// ─────────────── Tickholm ───────────────
q('s_zahnraeder', 'Zwölf Zahnräder', 'side', 'zacharias', { lvl: 18, region: 'clock', offer: ['Meine Maschine braucht zwölf Zähne. Äh, Zahnräder. Die Spinnen und Ritter da draußen bestehen praktisch daraus.'], steps: [drop('zahnrad', ['gear_spider', 'clock_knight', 'clock_mage'], 6, .7, 'Erbeute 6 Messingzahnräder von Automaten'), talk('zacharias', 'Bring Zacharias die Zahnräder', ['Sechs reichen auch! Ich hab mich verzählt. Das passiert mir nie. Doch, immer.'], { take: ['zahnrad', 6] })], reward: { xp: 1300, gold: 720, items: ['zahnradring'] } });
q('s_nock', 'Nocks Herz', 'side', 'nock', { lvl: 18, region: 'clock', offer: ['MEIN HERZ MACHT TACK. BITTE ERSATZTEIL. ES LIEGT IN DER ROSTWERKSTATT. ICH HABE KEINE ANGST. BITTE BESTÄTIGEN.'], steps: [get('ersatzteil', 1, 'c_clock1', 'Hole Nocks Ersatzteil aus der Rostwerkstatt'), talk('nock', 'Bring Nock das Ersatzteil', ['TICK. TICK. TICK. ICH FÜHLE MICH SEHR MERKWÜRDIG.', 'FRAGE: IST DAS FREUDE?'], { take: ['ersatzteil', 1], choice: [{ t: 'Ja, Nock. Das ist Freude.', flag: 'nock_freude', say: 'ICH HABE DIES GESPEICHERT. FÜR IMMER.' }, { t: 'Nein, das ist nur Öl.', flag: 'nock_oel', say: 'VERSTANDEN. SCHADE.' }] })], reward: { xp: 1200, gold: 520, items: ['elixier'] } });
q('s_stern', 'Die Linse', 'side', 'ottilie', { lvl: 19, region: 'clock', offer: ['Meine beste Linse wurde ins Kolbenfeld verschleppt. Ohne sie kann ich den Mond nicht beobachten.'], steps: [get('sternlinse', 1, 'c_clock2', 'Hole die Sternenlinse aus dem Kolbenfeld'), talk('ottilie', 'Bring Ottilie die Linse', ['Wunderbar! Oh. Er hat in meine Richtung geschaut. Das hat er noch nie getan.'], { take: ['sternlinse', 1] })], reward: { xp: 1500, gold: 700, items: ['mondstein'] } });
q('s_glocke', 'Der Stumme Uhrturm', 'side', 'kinne', { lvl: 19, region: 'clock', offer: ['Der Uhrturm im Westen schweigt seit Jahrzehnten. Sein Klöppel liegt im Zahnspinnennest. Bring ihn zum Turm zurück.'], steps: [get('glockenkloeppel', 1, 'c_clock3', 'Hole den Klöppel aus dem Zahnspinnennest'), go('l_uhrturm', 'Bring den Klöppel zum Stummen Uhrturm', ['Du hängst den Klöppel ein. Ein einziger, gewaltiger Glockenschlag rollt über das Land.']), talk('kinne', 'Berichte Kinne', ['Das habe ich gehört. Alle haben das gehört. Es war vier Minuten zu spät. Es war wunderschön.'], { take: ['glockenkloeppel', 1] })], reward: { xp: 1900, gold: 980, items: ['uhrwerkpanzer'] } });

// ─────────────── Aschenrast ───────────────
q('s_schwerter', 'Namen für die Schwerter', 'side', 'gerd', { lvl: 21, region: 'ash', offer: ['Auf dem Feld der Schwerter liegen die Namenstafeln der Gefallenen. Bring mir drei. Niemand soll ohne Namen in der Erde bleiben.'], steps: [get('schwertname', 3, 'l_schwerter', 'Sammle 3 Namenstafeln auf dem Feld der Schwerter'), talk('gerd', 'Bring Gerd die Tafeln', ['Tomas. Berit. Der kleine Jon. Ich kannte sie.'], { take: ['schwertname', 3] })], reward: { xp: 2600, gold: 1200, items: ['schattenplatte'] } });
q('s_bruder', 'Elins Bruder', 'side', 'elin', { lvl: 22, region: 'ash', offer: ['Mein Bruder war bei der Schattenwacht. Bring mir seine Marke, damit ich weiß, was aus ihm wurde.'], steps: [get('deserteurmarke', 1, 'c_ash2', 'Finde die Marke in der Schattenwacht'), talk('elin', 'Bring Elin die Marke', ['Er hat sie zerkratzt. Sieh nur: „Nicht für ihn“. Er hat sich gewehrt. Bis zum Schluss.'], { take: ['deserteurmarke', 1] })], reward: { xp: 2900, gold: 1300, items: ['elixier', 'schattenstaub'] } });
q('s_rose', 'Die Aschenrose', 'side', 'asha', { lvl: 21, region: 'ash', offer: ['Am Blutaltar blühen drei Aschenrosen. Ich brauche sie für die Verwundeten. Sie sind unser einziges Heilmittel.'], steps: [get('aschenrose', 3, 'c_ash4', 'Pflücke 3 Aschenrosen am Blutaltar'), talk('asha', 'Bring Asha die Rosen', ['Das reicht für alle. Danke. Du hast heute mehr Leben gerettet, als du denkst.'], { take: ['aschenrose', 3] })], reward: { xp: 2500, gold: 1000, items: ['aschenstab'] } });
q('s_krypta', 'Der Schlaf des Mondes', 'side', 'varek', { lvl: 22, region: 'ash', offer: ['In der Mondkrypta bewacht ein Ritter die Sternkarte des Mondes. Sie zeigt, wohin sein Schlaf gegangen ist. Hol sie dir, bevor du zu Morvane gehst.'], steps: [boss('mondwaechter', 'Besiege den Mondwächter in der Krypta'), talk('varek', 'Berichte Varek', ['Dieser Ritter hat tausend Jahre lang gewartet, dass jemand kommt und ihn ablöst. Ich glaube, du hast ihm einen Gefallen getan.'])], reward: { xp: 4200, gold: 1500, items: ['mondkarte', 'mondgewand'] } });

// ─────────────── Freiwillige Hilfe gegen die Flammen-Bosse ───────────────
q('s_banner', 'Krumnases Banner', 'side', 'yrsa', { lvl: 6, region: 'forest', weaken: 'krumnase', offer: ['Du willst zur Goblinfeste? Dann nimm ihnen vorher die Moral. Stiehl drei Kriegsbanner aus dem großen Lager.', 'Ohne Banner wissen Goblins nicht mehr, auf wessen Seite sie sind. Krumnase wird es spüren.'], steps: [get('kriegsbanner', 3, 'c_gob5', 'Stiehl 3 Goblinbanner aus dem Kriegslager')], outro: { npc: 'yrsa', lines: ['Ausgezeichnet. Ihre Späher laufen schon im Kreis. Krumnase wird geschwächt sein.'], take: ['kriegsbanner', 3] }, reward: { xp: 260, gold: 120, items: ['trank2'] } });
q('s_weihwasser', 'Segen für die Toten', 'side', 'vesper', { lvl: 10, region: 'moor', weaken: 'ossian', offer: ['Ossian war der beste Mensch, den ich kannte. Dann bot Morvane ihm an, niemals zu sterben.', 'Vernichte sechs Wiedergänger und sammle drei Flaschen Weihwasser am Irrlichtsteg. Das schwächt seinen Fluch.'], steps: [kill(['skeleton', 'skeleton_archer', 'skeleton_knight', 'bog_zombie', 'ghost'], 6, 'Vernichte 6 Untote im Knochenmoor'), get('weihwasser', 3, 's_sumpf', 'Sammle 3 Flaschen Weihwasser am Irrlichtsteg')], outro: { npc: 'vesper', lines: ['Ich spüre den Segen. Wenn du ihn siehst, sag ihm, dass ich nicht böse bin.'], take: ['weihwasser', 3] }, reward: { xp: 520, gold: 220, items: ['mana2'] } });
q('s_scherben', 'Scherben der Sonne', 'side', 'zahra', { lvl: 13, region: 'desert', weaken: 'solgar', offer: ['Solgar, mein alter Lehrer, hat die Glutjünger gegen uns aufgehetzt. Er glaubt, die Sonne müsse den Mond verbrennen.', 'Bring vier Sonnenscherben vom Sonnenstein ins Licht, dann bricht das Siegel seiner Macht.'], steps: [get('sonnenscherbe', 4, 'l_sonnenstein', 'Sammle 4 Sonnenscherben am Sonnenstein')], outro: { npc: 'zahra', lines: ['Das Siegel ist gebrochen. Solgar wird es im Sonnengrab merken.'], take: ['sonnenscherbe', 4] }, reward: { xp: 620, gold: 300, items: ['wuestengarn'] } });
q('s_runen', 'Die Runen der Eiskrone', 'side', 'runa', { lvl: 16, region: 'frost', weaken: 'hrimgar', offer: ['An der Eiskrone stehen drei Runen, die vom Fluch des Eisdrachen erzählen. Bring sie mir, und ich lockere seine Ketten.'], steps: [get('eisrune', 3, 'l_eiskrone', 'Hole 3 Eisrunen von der Eiskrone')], outro: { npc: 'runa', lines: ['Hm. Hm. Oh. Hrimgar ist nicht Morvanes Diener, sondern sein Gefangener. Du kannst ihn nicht retten, aber ich habe den Fluch geschwächt.'], take: ['eisrune', 3] }, reward: { xp: 860, gold: 420, items: ['frostpelz'] } });

// Wer eine Aufgabe erledigt hat, muss nicht zurücklaufen: Der Auftraggeber dankt durch die Laterne.
for (const Q of Object.values(QUESTS)) {
  const last = Q.steps[Q.steps.length - 1];
  if (Q.type !== 'side' || Q.outro || Q.steps.length < 2 || last.k !== 'talk' || last.choice || last.npc !== Q.giver) continue;
  Q.steps.pop();
  Q.outro = { npc: last.npc, lines: last.lines, take: last.take, give: last.give };
}
