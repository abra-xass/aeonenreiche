# Äonenreiche — Balance-Durchläufe

## Ressourcenrunden und Expansion

- Standard verrechnet Erträge alle sechs statt alle zwei Sekunden Spielzeit. Ursprüngliche Menschen-Startprovinzen ohne neue Aufträge nach neun Minuten: 378 Nahrung, 281 Holz, 266 Stein, 22 Metall, 260 Kronen und 210 Wissen. Vorräte bleiben unter den jeweiligen Grenzen; ungewöhnlich hohe ältere Bestände werden nicht rückwirkend gelöscht.
- Gleicher KI-Seed 42, neun Minuten: Das größte KI-Reich hielt 20 Provinzen auf Entspannt, 31 auf Standard und 42 auf Veteran. Die Mindestpause zwischen neutralen Gebietszügen beginnt bei 32/22/12 Sekunden und steigt mit der Reichsgröße. Alle 13 KIs erreichten in diesem Kontrolllauf die Bronzezeit. Damit ist das Tempo der Eröffnung gemessen, keine globale Balance bewiesen.

## 13 Völker und KI-Stufen

Alle 13 Startpositionen haben sieben Provinzen und identische Startvorräte. Ein Kontrolllauf mit Seed 42 bis Takt 180 ergab 392 kontrollierte Provinzen auf Entspannt, 479 auf Standard und 453 auf Veteran. Das stärkste Reich hielt je nach Stufe 38, 47 bzw. 51 Provinzen. Keine Fraktion schied in diesen kurzen Läufen aus. Mehr Aggression führt nicht zwangsläufig zu mehr Land; vollständige Gleichheit der Siegchancen ist nicht belegt.

## Audit vor der Erweiterung auf 13 Völker

Zwei Standardläufe mit 13 Völkern bis Takt 420 erreichten keinen Sieg. Im Schnitt hielten Avatarer 33,5 und Spirits 72,5 Provinzen; alle Hauptstädte blieben bei ihren Startvölkern. Die KI-Partien belegen keinen Vorteil für menschliche Spieler derselben Völker.

Gleiche Seeds, 600 Takte: Die neue Siedlungsökonomie gibt Land ohne Ratshaus nur einen Nahrungspunkt plus Gelände. Besetzte Gebiete liefern bis zur Stabilisierung nichts. Die KI sammelt mehr Truppen vor entdeckten gegnerischen Hauptstädten. Ø Provinzen in der neuen Runde: Menschen 113, Elben 53,7, Orks 109,7, Hobbits 40, Spirits 104, Ents 104,3, Goa Uhls 102, Pampegons 126. Der Abstand zwischen größtem und kleinstem Reich sank von 111,7 auf 86 Provinzen. Trotzdem hielten alle acht Völker in allen drei Läufen ihre eigenen Hauptstädte; die neue Runde belegt **keine** bessere Siegquote. Alle erreichten erneut das siebte Zeitalter. Das ist ein Indiz für zu geringe Hürden im späten Spiel, kein Nachweis, dass jedes Volk gleich stark ist.

## Vergleich vor dem Audit

Reproduzieren: `node balance.js 3 600`. Alle acht Fraktionen sind KI-gesteuert. Die Seeds 1–3 verwenden identische Startregeln und variieren die Zufallsentscheidungen bei Kämpfen und Zielwahl. 600 Takte entsprechen bei 1× 20 Minuten Spielzeit.

| Volk | Ø Provinzen | Ø Versorgungspunkte | Gehaltene Hauptstädte (über alle drei Partien) |
| --- | ---: | ---: | ---: |
| Menschen | 124,7 | 525,0 | 3 |
| Elben | 60,0 | 342,3 | 4 |
| Orks | 101,0 | 509,7 | 3 |
| Hobbits | 31,0 | 152,0 | 2 |
| Spirits | 94,3 | 460,0 | 3 |
| Ents | 99,3 | 475,3 | 3 |
| Goa Uhls | 92,3 | 446,7 | 3 |
| Pampegons | 142,7 | 830,0 | 3 |

Alle Völker erreichten in diesen Läufen das siebte Zeitalter. Eine Hauptstadt wechselte den Besitzer; die Siegvorgabe von drei Hauptstädten wurde nicht erreicht. Zum Vergleich: In fünf Läufen mit der vorherigen KI erreichten die Reiche bei Takt 600 jeweils 13–56 Provinzen, ebenfalls ohne Sieger. Mehr eroberte Provinzen bedeuten hier mehr Aktivität, nicht automatisch bessere Balance.

Nächste Prüfgrößen: Startlagen und Doktrinen getrennt testen (besonders Grünmeer gegenüber Ostland), messen, wann Ressourcen knapp werden, und prüfen, wie eine KI mehrere Armeen gegen ein befestigtes Ziel zusammenführt. Die drei Seeds reichen nicht, um gleiche Siegchancen oder die Balance gegen menschliche Spieler zu belegen.

## Überarbeitung: Sieg durch Vernichtung und Kampfbalance

- **Sieg:** Nur noch Vernichtung aller anderen Völker. Ein Volk ist vernichtet, wenn es keine Stadt (Ratshaus) mehr hält; seine Dörfer werden unbesetzte Barbarendörfer. Die KI greift jede gegnerische Stadt als Ziel an.
- **Kampf:** Verteidigerbonus 1,04, Gelände halbiert, Mauer +8 % je Stufe, Mauerwerk +5 %. Forschungs- und Regierungsboni (halbiert) gelten für Angreifer **und** Verteidiger; Hunger schwächt beide. Flankenhilfe: je Nachbar 30 % der Garnison (bis zu zwei). Messung mit `node duel.js` (Angreifer für 50 % Siegchance gegen 20 Verteidiger): Ebene ohne Mauer 1,1–1,25×, Mauer 1,2–1,35×, mit Mauer und einer Flanke 1,55–1,7×, Festung im Gebirge mit zwei Flanken 2,5–2,7×. Alltag liegt damit bei rund 1,5×.
- **Tempo:** Forschungsdauer je Zeitalter 24/44/75/115/170/240/320 Takte (Deckel 420), Märsche 5/7/10 Takte, Heldenfähigkeit 30 Takte Abklingzeit.
- **Nicht gemessen:** Ein vollständiger KI-Durchlauf bis zum Sieg wurde nicht abgeschlossen (1500 Takte: zwei Völker vernichtet, kein Sieger).

### Zweite Überarbeitungsrunde
- **Versorgung:** Hunger lässt je Wirtschaftsrunde ca. 6 % der größten Truppe jeder Garnison desertieren. Überfüllung zählt doppelt für den Unterhalt: Dorf ab 30 Truppen, Stadt ab 50 + 25 je Ratshausstufe.
- **Städte:** Infrastruktur-Erträge einer Stadt skalieren mit unterstützenden Dörfern (70 % + 5 % je Dorf, Höchstwert 100 %).
- **Ausbildung:** Trainingszeit verdoppelt (Automatisierung −2). Bis zu drei Super-Einheiten je Volk. Manöver kosten 10 + 2·Garnison Nahrung und 8 + Garnison Kronen.
- **Völker:** Signatureinheiten Angriff 18 / Schutz 17 (Kosten 40/16/12), Spezialgebäude +3 Ressourcen je Stufe.
- **Diplomatie:** Kein Krieg gegen Verbündete, 24 Takte Friedensbindung, KI-Frieden erst nach 30 Takten Krieg und nicht, wenn sie sich überlegen fühlt.
- Nicht umgesetzt: mehrere parallele Forschungsplätze, Seekrieg, taktische Schlachten. Raubzüge sind aktiver Spielcode und blieben erhalten.

### Langlauf 12 Stunden (nur KI, Seed 7, Standard)
- **Gefundener Fehler:** Die KI-Reiche hatten fast keine Kronen (Einnahmen 1–4, Unterhalt höher) und konnten deshalb nicht forschen; die meisten blieben im 2. Zeitalter. Behoben: Rathaus +3 Kronen statt +1, Markt +4, Münze +5, Kronenunterhalt je Truppe um ein Viertel gesenkt. Desertion gibt es nur noch bei Hunger.
- **Tempo:** Zeitalterdauer 90/190/360/600/950/1500/2100 Takte (Deckel 2400). Bei 1× entspricht ein Takt 2 Sekunden, 12 Stunden sind 21.600 Takte. Die KI erreicht das 6. Zeitalter nach etwa 9 Stunden, das 7. nicht innerhalb von 12 Stunden.
- **Expansion:** Nach 5000 Takten halten die großen KI-Reiche 80–170 Provinzen, nach 6 Stunden 5–45 Städte je Reich.
- **Kriege:** Bei 9,4 Stunden waren erst 4 von 13 Völkern vernichtet. Die KI wird mit der Zeit mutiger (bis 16 % niedrigere Angriffsschwelle ab Takt 2500), erobert aber zu langsam, um allein alle Völker zu besiegen. Ein menschlicher Spieler muss den Sieg erzwingen; bei 2×–4× Tempo sind das 3–6 Stunden. Ein vollständiger Durchlauf mit Sieger wurde nicht beobachtet, ob 12 Stunden für den Gesamtsieg reichen, ist daher nicht belegt.

### Audit und Perfektionierung (Einheiten, Völker, Startpositionen)
- **Datenprüfung (Skript):** 13 Völker, 32 Einheiten, 35 Gebäude, 39 Technologien, 2.254 Provinzen. Alle Verknüpfungen (Voraussetzungen, Gebäude, Einheiten-Technologien) verweisen auf vorhandene Einträge; kein Eintrag ist unerreichbar. Vier Grundtechnologien (cultivation, carpentry, barter, prospectingEarly) haben bewusst keine Voraussetzung.
- **Einheiten-Effizienz:** Spätere Einheiten waren vorher schlechter pro Kosten als frühe (Panzer 0,31 gegenüber Linieninfanterie 0,43 Stärke je Kosteneinheit). Jetzt steigt die Kurve von 0,30 (Steinzeit) auf rund 0,49 (Weltraumzeitalter). Panzer, Drohne, Orbitallegion, Exogarde, Mech, Artillerie, Spähfahrzeug und Trebuchet sind stärker und teils günstiger. Unterhalt je Einheit: mobil und schwer 3, Belagerung 4, Luft 5 (vorher 4/4/5/6). Elite-Einheiten sind stärker (Stufe früh 96/78, spät 190/150) und günstiger.
- **Volkseinheiten:** Angriff 21 / Schutz 20 bei Kosten 32/12/10, damit sie besser sind als die Grundeinheit der Bronzezeit. Spezialgebäude: +3 Ressourcen je Stufe, bei Wissen/Kronen +2, bei Einfluss +1. Pampegon-Späher erhalten +12 % Angriff.
- **Startpositionen:** Die Landschaft um die Hauptstädte war ungleich (Elben Nahrung 8 gegenüber Abraxianern 87 im Umkreis von fünf Feldern, Zwerge Nahrung 7). Gelände liefert jetzt Nebenerträge (Wälder Nahrung, Steppe Holz und Stein usw.). Weiterhin ungleich: Spirits liegen 1170 Einheiten von der nächsten Hauptstadt entfernt, die übrigen 350–510. Das ist Kartengeometrie und nicht geändert.
- **Anti-Schneeball:** Ertragsdämpfung ab 8 Städten (vorher 12), Hauptstädte verteidigen mit +10 %, die KI greift bis Takt 3000 keine Städte an.
- **Messung (4 Seeds, Takt 8000, KI-Läufe):** Provinzen im Schnitt: Spirits 248, Pampegons 194, Orks 176, Menschen 166, Goa Uhls 162, Ents 141, Elben 135, Andromedaner 122, Abraxianer 109, Zwerge 109, Hobbits 101, Avatarer 85, Matrixianer 52 (in einem von vier Läufen vernichtet). Vorher (6 Seeds) hatten Matrixianer 31, Avatarer 48, 6 von 24 Völkerläufen endeten mit Vernichtung. Das ist besser, aber **nicht ausgeglichen**: Spirits sind durch ihre Lage klar im Vorteil, Matrixianer im Nachteil.

### Startpositionen: Zwischenstand (Spirits und Matrixianer)
- **Ursache:** Die Spirits sind das einzige Volk auf ihrem Kontinent (Frostheim, 235 Felder). Alle anderen teilen sich einen Kontinent mit einem zweiten Volk (139–193 Felder je Volk) und führen von Spielbeginn an Krieg miteinander. Der Verlierer eines solchen Zweikampfs, bisher meist die Matrixianer gegen die Pampegons, wird vernichtet.
- **Maßnahmen:** Neutrale Dörfer auf Frostheim sind stärker besetzt (Barbaren 8+4 statt 4+2 Einheiten, Nachschub bis 12 statt 7), Matrixianer erhalten +36 % für mobile und schwere Truppen sowie +8 % für alle übrigen, ihre Schildnetz-Sentinels +28 % gegen Belagerung.
- **Messung (4 Seeds, Takt 8000):** Spirits 225 Provinzen (vorher 248), Pampegons 174, Orks 181, Matrixianer 26 (in 3 von 4 Läufen vernichtet, vorher 1 von 4), Avatarer 63. Die Maßnahmen haben die Spirits etwas gebremst, die Matrixianer aber nicht gerettet; bei vier Läufen ist die Streuung groß.
- **Offen:** Das Problem ist Kartengeometrie. Mögliche Lösungen: den Kontinent der Spirits verkleinern, ein zweites Volk dazusetzen oder Startfrieden für Zweikämpfe einführen. Das habe ich nicht gemacht, weil es die Karte und damit bestehende Spielstände verändert.

### 14. Volk: Insektoiden
- **Lage:** Hauptstadt Schwarmhort auf Frostheim (Feld 46/16, Ebene), neun Spalten westlich der Spirits. Der Kontinent wird damit geteilt (je ca. 117 Felder), die zusätzliche Härtung der neutralen Dörfer auf Frostheim ist wieder entfernt.
- **Spielweise:** Schwarmstaat, KI-Neigung Ausbau (Farm) und Infanterie. Held Königin Zzyra (Schwarmgeist): Infanterie und Speertruppen +34 %, übrige +12 %. Signatureinheit Schwarmkrieger (Infanterie, Brutkammer, +25 % Stärke in Heeren ab 10 Einheiten). Elite: Chitinkoloss. Startwache: Brutwächter.
- **Messung (4 Seeds, Takt 8000, 14 Völker, vor der letzten Feinabstimmung):** Pampegons 197, Spirits 165 (vorher 225), Orks 164, Menschen 142, Zwerge 135, Goa Uhls 147, Elben 128, Andromedaner 121, Abraxianer 116, Hobbits 105, Ents 86, Avatarer 77, Insektoiden 62, Matrixianer 30 (2 von 4 vernichtet). Danach wurden Insektoiden-Boni leicht erhöht (+30 auf +34 %) und der Pampegon-Bonus gesenkt (+15 auf +12 %); diese Feinabstimmung ist nicht erneut gemessen.
- **Grafik:** Die Insektoiden verwenden vorübergehend die Motive der Abraxianer.
- **Spielstände:** Bestehende Spielstände kennen das 14. Volk nicht; bitte eine neue Partie starten.

### Völker-Abgleich (14 Völker)
- **Messwerkzeug:** `node strength.js` lässt jedes Volk mit dem gleichen Heer (20 Einheiten, gleiche Technik, eigene Signatureinheit, Heldensegen) auf fünf Geländearten gegen eine Referenz kämpfen, einmal im Angriff und einmal in der Verteidigung. Ergebnis ist ein Index (Mittel = 1,00). Vorher 0,91 bis 1,09, nach den Anpassungen 0,94 bis 1,04.
- **Heldenwerte angepasst:** Menschen +24 %, Elben +34/12 %, Orks +33/10 %, Hobbits Fernkampf +52 %, Ents +27 % Verteidigung/+14 % Angriff, Goa Uhls +16 %, Pampegons +13 %, Abraxianer Belagerung +55 %, Andromedaner Luft +45 %/Fernkampf +42 %, Avatarer Wald +38 %/+28 %, Zwerge +30 % (Gebirge +40 %). Die Beschreibungen im Spiel sind angepasst. Hinweis: Luft- und späte Einheiten fließen in den Index kaum ein; die Werte der Andromedaner und Spirits sind dort ungeprüft.
- **Wirtschaft:** Spezialgebäude liefern jetzt wertgleich: 3 Nahrung/Holz/Stein, 2 Metall, 2 Kronen, 2 Wissen, 1 Einfluss je Stufe. Alle Völker starten mit demselben Vorrat und derselben Technologie-Auswahl; Unterschiede bestehen nur im Spezialzweig (Gebäude, Technologie, Einheit, Held).
- **KI-Charakter:** Angriffsneigung der Orks (0,69 auf 0,76) und Abraxianer (0,70 auf 0,74) angehoben, Hobbits und Ents (0,83 auf 0,80) gesenkt, Andromedaner 0,78 auf 0,75, damit das Ergebnis nicht an der Persönlichkeit der KI hängt.
- **Aufholmechanismus:** Ein Volk, das weniger als 40 % der Provinzen des größten Volkes hält, verteidigt mit +12 %.
- **Startfrieden:** Die zwei Völker eines Kontinents (Nordmark, Elyndra, Sonnenlande, Grünmeer, Ostland, Südmark, Frostheim) beginnen im Frieden; eine Kriegserklärung ist bis Takt 2400 (80 Minuten bei 1×) nicht möglich.
- **Messung (4 Seeds, Takt 8000, mit Startfrieden, vor der letzten Orks-Absenkung):** Provinzen im Schnitt: Orks 188, Abraxianer 137, Pampegons 135, Elben 134, Spirits 127, Zwerge 115, Hobbits 113, Goa Uhls 104, Avatarer 101, Menschen 97, Ents 92, Insektoiden 92, Andromedaner 81, Matrixianer 77. Größter zu kleinstem Wert 2,4 (vorher bis 10), kein Volk vernichtet. Die Orks liegen weiter vorn (daher die Absenkung), die Andromedaner hinten. Die letzte Feinabstimmung ist nicht erneut gemessen, und vier Läufe sind eine kleine Stichprobe.

### Größerer Messlauf (6 neue Seeds, Takt 8000, 14 Völker)
Provinzen im Schnitt (Spanne): Orks 168 (148–202), Pampegons 157 (117–204), Spirits 133, Goa Uhls 130, Andromedaner 129, Menschen 128, Hobbits 120, Elben 112, Ents 107, Zwerge 106, Abraxianer 95 (in 1 von 6 Läufen vernichtet), Avatarer 88, Insektoiden 73 (38–89), Matrixianer 35 (in 2 von 6 vernichtet). Größter zu kleinster Wert 4,9.
**Folgerung:** Orks und Pampegons liegen stetig vorn, Insektoiden und Matrixianer stetig hinten. Anpassung danach: Orks Held +33/10 auf +28/8 %, Pampegons +13 auf +10 %, Insektoiden +34/12 auf +40/14 %, Matrixianer +36/8 auf +42/12 %. **Diese Anpassung ist nicht erneut gemessen.** Die Streuung zwischen den Läufen ist mit 40–200 Provinzen pro Volk groß; ein Teil der Unterschiede ist Zufall und Kartenlage.

### Ursachenanalyse und neue Hauptstadtlagen
- **Befund (`node placement.js`):** Die Verlierer-Völker lagen auf ihrem Kontinent ungünstig. Landanteil gegenüber dem Nachbarvolk (näher an der eigenen als an der fremden Hauptstadt): Spirits 78 % gegen Insektoiden 22 %, Menschen 64 % gegen Avatarer 36 %, Orks 64 % gegen Andromedaner 36 %, Pampegons 64 % gegen Matrixianer 36 %, Goa Uhls 56 % gegen Abraxianer 44 %. Auch die Ressourcen im Umkreis waren ungleich (Insektoiden: Stein 6, Zwerge: Nahrung 47 gegenüber bis zu 111).
- **Maßnahme:** Alle 14 Hauptstädte wurden neu gesetzt. Je Kontinent wurde die Paarung gesucht, die den Landanteil auf etwa 50 % bringt, 7–8 Felder Abstand hält, kaum Küste und Gebirge enthält und ähnliche Erträge in sechs Feldern Umkreis liefert. Neue Anteile: 49–51 % für alle Paare. Die Hauptstadtnamen sind unverändert, die Kontinente ebenfalls. Alte Spielstände sind damit unbrauchbar.
- **Messung (6 Seeds, Takt 8000, 14 Völker):** Provinzen im Schnitt: Orks 146, Elben 145, Abraxianer 141, Menschen 140, Pampegons 138, Ents 135, Zwerge 131, Insektoiden 121, Matrixianer 110, Avatarer 91, Hobbits 89, Spirits 86 (1 Vernichtung), Goa Uhls 85 (2 Vernichtungen), Andromedaner 79. Größter zu kleinster Wert 1,8 (vorher 4,9).
- **Feinabstimmung danach (nicht erneut gemessen):** Goa Uhls +16 auf +20 %, Andromedaner übrige Einheiten +6 %, Hobbits übrige +5 %, Avatarer außerhalb des Waldes +5 %, Spirits Abschwächung des Gegners 30/12 auf 32/14 %. Luftvölker (Spirits, Goa Uhls, Andromedaner) liegen stetig hinten, weil ihre starken Einheiten spät kommen.
- **Weiterhin ungleich:** Kontinentgröße je Volk 117 (Frostheim) bis 194 Felder (Sonnenlande). Werkzeug: `placement.js`.

### Luftvölker und kleine Kontinente
- **Unterhalt der Signatureinheiten:** Die Signatureinheiten von Spirits, Goa Uhls und Andromedanern (Luft, Unterhalt 5) und Abraxianern (Belagerung, 4) kosteten bei gleichen Werten das Doppelte bis Zweieinhalbfache an Versorgung. Jetzt haben alle Signatureinheiten Unterhalt 2.
- **Kontinente:** Frostheim 235 auf 320 Felder, Südmark 277 auf 332. Land je Volk nun 154 (Grünmeer) bis 194 (Sonnenlande), vorher 117 bis 194. Die Karte hat 2.394 Provinzen (vorher 2.254). Hauptstädte neu gesetzt (Landanteil 49–51 % je Paar, `node placement.js`). Alte Spielstände sind unbrauchbar.
- **Messung (6 Seeds, Takt 8000):** Provinzen im Schnitt: Elben 162, Orks 154, Pampegons 147, Insektoiden 125, Ents 124, Matrixianer 114, Menschen 111, Abraxianer 111, Goa Uhls 110, Zwerge 108, Avatarer 105, Spirits 98, Hobbits 93, Andromedaner 70. Keine Vernichtung in 84 Völkerläufen. Größter zu kleinster Wert 2,3, ohne die Andromedaner 1,7.
- **Danach (nicht erneut gemessen):** Andromedaner: KI baut Farmen und Fernkämpfer statt Observatorium und Luft. Elben Bonus +34/12 auf +30/10 %, Insektoiden +40/14 auf +36/13 %.
- **Stärke-Index (`node strength.js`):** 0,95 bis 1,08.
