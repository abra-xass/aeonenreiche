# Äonenreiche — Grafiksystem

Ein einheitlicher moderner Strategiestil: gemalter Realismus, warmes Streiflicht auf Stein und Metall, tiefes Blaugrün für Flächen und dezente Messingfarbe für aktive Bedienelemente. Generiert mit der eingebauten OpenAI-Bildfunktion, anschließend für den Browser in WebP konvertiert.

| Datei | Motiv und Generierungsbriefing |
| --- | --- |
| `assets/settlement.webp` | Cinematisches Panorama einer frühen Siedlung im Gebirgstal, seitliches Morgenlicht und dunkler Vordergrund für UI-Überlagerungen. |
| `assets/buildings.webp` | 6 × 4 isometrische Gebäudeminiaturen von Acker und Tauschplatz bis Labor und Orbitalwerft mit einheitlichem Blickwinkel. |
| `assets/units.webp` | 6 × 4 freigestellt wirkende historische und futuristische Einheiten und Fahrzeuge, mit antikem Drachenmotiv. |
| `assets/peoples.webp` | 4 × 4 Porträts der acht Völker und ihre einzigartigen Eliteeinheiten, mit getrennten Fraktionsakzenten. |
| `assets/knowledge.webp` | 4 × 3 Stillleben für Zeitalter, Regierung, Glauben, Diplomatie und Handel. |
| `assets/technology.webp` | 6 × 5 Technikmotive in der Reihenfolge der Forschungsdaten: von Steinwerkzeugen und Getreide bis Chip und Orbitalrakete. |
| `assets/terrain.webp` | 3 × 3 Landschaftsmaterialien. Die Karte verwendet die Texturen mit geringer Farbtönung und kurzen Übergängen. Gras, Sand und Fels bilden Savanne, Steppe und Hochland. Schnee beginnt oberhalb der klimatisch bestimmten Schneegrenze im Gebirge. |
| `assets/interface.webp` | 6 × 4 kompakte Bronze- und Messingminiaturen für Vorräte, Weltkarte, Navigation, Tempo, Zoom, Hilfe, Drachen und Schätze. |
| `assets/settlements.webp` | 4 × 2 steil-isometrische Siedlungsmarker, von Holzpalisade über Industrie bis Zukunftsstadt, plus Lager und Festung. |
| `assets/cultures.webp` | 4 × 4 Bausilhouetten, unter anderem Sternentürme, Baumhallen, Basaltfestung und zwergisches Bergtor. |
| `assets/newfolk.webp` | 5 × 2 Abraxianer, Andromedaner, Matrixianer, Avatarer und Zwerge, mit je einem Heldenporträt und einer Eliteeinheit. |
| `assets/guards.webp` | 4 × 4 frühe Fußtruppen, mit einer klar unterscheidbaren Startwache je Volk. |
| `assets/epochs.webp` | 2 × 4 Stadtpanoramen desselben Tals: vom schlichten Hüttendorf bis zur Raumfahrtstadt. |
| `assets/primitive.webp` | 3 × 3 handgemalte Steinzeitgebäude aus Holz, Lehm, Stroh und einfachen Feldsteinen. |
| `assets/specialists.webp` | Angeheftetes 4 × 4 Motivblatt für Signatureinheiten und die dazugehörigen Technologie-Knoten. |
| `assets/special-sites.webp` | 4 × 4 exklusive Ausbildungshöfe, Werkstätten und Heiligtümer. |
| `assets/folk-barracks.webp`, `assets/folk-markets.webp`, `assets/folk-spears.webp` | Drei generierte 4 × 4 Bögen mit je 13 Volksvarianten für Kasernen, Märkte und Speerwachen. Kleineres bronzezeitliches Bauvolumen, dunkles Blaugrün und warme Lichtkanten. |

Territorien, Ortsmarker, Seewege und Kriegsnebel bleiben eigene interaktive Ebenen. Ortskoordinaten und Spiellogik hängen nicht von den Bilddateien ab. Die Weltkarte benutzt weiterhin Reliefschattierung, kein frei drehbares 3D-Terrain.

**Hinweis Insektoiden:** Das 14. Volk (Insektoiden) hat noch keine eigenen Bildmotive. Porträt, Kaserne, Markt, Speerwache, Signaturgebäude, Signatureinheit und Stadtbild verwenden vorübergehend die Motive der Abraxianer (siehe `folkIndex` in `app.js`). Für eigene Motive müssen die Bildbögen um eine 14. Zelle ergänzt und `peoplePortrait` sowie `folkIndex` angepasst werden. Die Fraktionsfarbe (#b9d43c) und das Symbol (❂) sind bereits eigenständig.
