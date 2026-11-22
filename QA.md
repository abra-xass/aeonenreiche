# Äonenreiche — Funktionsaudit

## Abgedeckte Spielabläufe

Ressourcenrunde: sechs Aufstiege mit Teilvoraussetzungen und atomarer Zahlung, Lagergrenzen, Taktung aller drei Schwierigkeiten, Marktpreis und Kapazitätsprüfung. Karte: Live-Vorschau für Vereinigung, exakte Trennung einer Teiltruppe per Zahlenfeld und 25-%-Vorlage, gemeinsame Veteranenstufe nach Ankunft. Raubzüge: kein Ziel, kein Besitzwechsel, Rückkehr bei Takt 150 mit Erfahrung, Beute oder Verlusten; fremde Spieler sehen sie im LAN nicht.

Große Weltkarte: 2.394 erreichbare Provinzen (Frostheim und Südmark vergrößert; alte Spielstände unbrauchbar), 967 alte IDs behalten, symmetrische Nachbarschaften und korrekte Grenzen der Reliefgrafik geprüft. Fortschritt: 13 exklusive Bau-Forschungs-Rekrutierungsketten und Zeitgrenzen von 60/1.800 Sekunden. Browser: Hauptmenü nach verlorenem Autosave, bestätigter Neustart mit sieben Startprovinzen und ohne alten Bauauftrag, Zeitalter-Szenen, Truppenporträts, Auswahlvorlagen und Rückruf.

Mit 13 Völkern zusätzlich geprüft: Wahl von Zwergen und Veteran, je sieben Startprovinzen, Klick auf einen Garnisons- und Heermarker, Manöverabschluss, manuelles Speichern/Neustart/Laden mit gespeichertem Pausenzustand, Raubzugbeute und Beuteschutz, Helden-EP durch Gefechte und Akademie sowie sofortiges Ausscheiden samt Auflösung laufender Märsche.

| Bereich | Geprüft |
| --- | --- |
| Browser | Völkerauswahl, Stadt und Bauplatz, Klick über einen Simulations-Takt hinweg, Ressourcenkarten, Eilauftrag, Markt, Einheitenliste und Forschungsansicht; Desktop und 390 px. |
| Einzelspieler | Lokaler Spielstand nach Neuladen, bewahrtes Pausentempo, angebrochener Takt bei Tempoänderung. |
| Fortschritt | Alle sechs Aufstiege bis zum Weltraumzeitalter, Orbitalwerft, Voraussetzungen jeder Einheit des Menschenvolkes. Sperre gegen Doppelaufträge und zu frühe Bauten. |
| Wirtschaft | Markt in der Steinzeit, Kauf und Verkauf, Nahrungsunterhalt, Heereslogistik, Nahrungsknappheit, eroberte Provinzen und Wiederaufbauphase. |
| Staatsrat | Regierung vor Aufstieg gesperrt, Handelsrepublik nach Aufstieg, Glaube erst mit Heiligtum, Heldenabklingzeit. |
| Welt und Kampf | Kriegserklärung, Belohnungen bei Drachen und Schätzen, maritime Erkundung, Rückzug nach Frieden und kein Rückzug in weit entfernte Provinzen. |
| Diplomatie und Spionage | Angebot, Annahme, Ablehnung, Rücknahme und Ablauf. Aufklärung und Sabotage. |
| LAN | Host/Beitritt, belegter Platz, getrennte Fraktionssicht, gleiche Kampfprognose für sichtbare Boni, versteckte Informationen für unentdeckte Gebiete, serverseitiges Fertigstellen eines Bauauftrags. |
| Ende | Letztes verbliebenes Reich gewinnt. Ein Volk ohne Stadt wird vernichtet, seine Dörfer fallen an Barbaren. |

Die Regeltests verwendeten kontrollierte Startstände für seltene Situationen. Die Balancepartien liefen ohne solche Eingriffe. Getestet wurde in Edge und lokal gegen die LAN-Schnittstelle; keine Freigabe für öffentliche Server und kein plattformübergreifender Langzeittest.

## Nächste Ausbaustufen

1. **Partien zuverlässig zum Abschluss bringen.** Kapitaloffensiven mit mehreren Wellen und Belagerungsnachschub testen. Ein klar angekündigtes alternatives Siegziel wäre sinnvoll; nicht einfach den größten Landbesitzer zum Sieger erklären.
2. **Startlagen und Versorgung kalibrieren.** Dieselbe KI-Doktrin auf unterschiedlichen Startplätzen testen, mehr Seeds und menschliche Testpartien nutzen. Erträge und Forschungskosten in frühen und späten Zeitaltern getrennt abstimmen.
3. **Stadtverwaltung vertiefen.** Auftragswarteschlange, Aufträge abbrechen, Rückerstattung und Vergleich von Gebäudestufen. Bevölkerung und Handelsrouten als getrennte Erweiterung, nicht als weiterer passiver Bonus.
4. **LAN robuster machen.** Dauerhafte Spielstände, Plätze aktiv freigeben, Lobbys mit Bereitschaft und Wiederverbindung ohne Neuladen. Der Server speichert Räume bisher nur im Arbeitsspeicher.
5. **Später:** taktische Schlachten und echte frei drehbare 3D-Karte. Beides sind neue Systeme, keine Fehlerkorrekturen.
