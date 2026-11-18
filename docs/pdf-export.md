# PDF-Export

## Engine-Entscheidung und Layoutnachweis

pdfmake 0.3.14 (MIT) erzeugt das PDF direkt im Browser. Ein fünfseitiger
Layoutnachweis am 18.11.2026 bestätigte A4, Vektoren, Tabellen, sichere Links,
auslesbaren Text, Umlaute, Dokumenttitel/-sprache und eingebettete Inter Tight.
`pdfinfo` meldet fünf A4-Seiten und „Tagged: yes“; `pdffonts` bestätigt
eingebettete Unicode-TrueType-Subsets. Die gerasterte Seite wurde visuell geprüft.
Das ist **kein Nachweis einer PDF/UA-Konformität**.

Die PDF-Schriften sind statische Inter-Tight-TTFs (400/700), am 18.11.2026 aus
Google Fonts CSS `https://fonts.googleapis.com/css?family=Inter+Tight:400,600,700`
bezogen. Quellen:

- Regular: `https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mjDw-aWy5X.ttf`
- Bold: `https://fonts.gstatic.com/s/intertight/v9/NGSnv5HMAFg6IuGlBNMjxJEL2VmU3NS7Z2mj6AiaWy5X.ttf`

Lizenz: SIL OFL 1.1, siehe `public/fonts/OFL.txt`. Die URL-Version ist kein
behaupteter interner Fontversionsstand; die SBOM identifiziert Dateien per SHA-256.
Im Betrieb werden keine Google-Ressourcen abgerufen.

## Satzregeln

18–20 mm Rand; Inter Tight für Überschriften und Fließtext; 11 pt Grundschrift,
mindestens 9 pt in Tabellen und 8,5 pt in Metadaten. Farben stammen aus den
App-Tokens. Jede Datengrafik hat eine vollständige Tabelle; bei Platzbedarf
entstehen weitere Seiten statt kleinerer Schrift. Tabellen/Grafiken beziehen sich
auf denselben unveränderlichen Exportstand.

## Daten und Speicherung

Nur „Report speichern“ persistiert den Exportstand: Aggregate, datierte
Followerquellen und maximal fünf öffentliche Beitragsauszüge. Vorschau und
Download speichern nichts dauerhaft. Version 1 bleibt lesbar; fehlende
Zusatzdaten werden benannt, nicht durch heimliche Live-Abfragen ergänzt.
Version 2 ergänzt einen PDF-Snapshot ohne Änderung der IndexedDB-Indizes.
Für Rollbacks einen V1/V2-kompatiblen Reader beibehalten; keine lokalen Daten löschen.

## Bedienung und Grenzen

Nach Abschluss des Report-Ladens „PDF-Bericht erstellen“ wählen, Titel/Organisation
und Sprache festlegen und „Vorschau erstellen“ ausführen. Download und Öffnen
verwenden dieselbe Blob-Datei. Jede Eingabeänderung verwirft die alte Vorschau.
Mobil wird statt eines eingebetteten Readers die Inhaltsübersicht mit Direktlinks
angeboten. CSV/Excel-Kopie bleiben unabhängig von PDF-Fehlern verfügbar.

Die Titelseite enthält fünf Kennzahlen einschließlich Follower-Stand.
Farbige Pfeil-Badges nennen Veränderungsrate und Vergleichsbasis:
Follower/Engagement Januar bis Dezember beziehungsweise letzter abgeschlossener
Monat; Reichweite/Interaktionen/Threads als Summen gegenüber dem Vorjahr.
Bei laufendem Jahr endet der Vorjahreszeitraum am entsprechenden Berliner Datum
und Zeitpunkt (YTD). Fehlende Startwerte, Nullnenner oder Teilstände liefern keine
erfundene Rate. Sämtliche Veränderungswerte stehen zusätzlich in einer Tabelle.

**Bedarfsgerechter Abruf:** Erst „PDF-Bericht erstellen“ lädt bei einem Live-Stand
die benötigte Vorjahresanalyse. Währenddessen zeigt der Dialog den Status;
Schließen bricht den Zusatzabruf ab. Bereits verfügbare Vergleichsdaten werden
wiederverwendet. Die eigentliche PDF-Erstellung und ein normaler Seitenaufruf
lösen keinen Vorjahresabruf aus. Alte gespeicherte Stände werden nicht mit
aktuellen Vorjahresdaten vermischt; neue Stände speichern vorhandene Vergleiche
auf ausdrückliche Speicheraktion mit.

Die Diagramme nutzen `reportChanges` aus der Online-Version und dieselben
Grün-/Orange-Tokens einschließlich sRGB-Mischung und vertikalem Verlauf.
Fehlende Werte bleiben im PDF ohne Balken; zukünftige Monate beeinflussen
die relative Intensität nicht. Eine Legende erklärt die Farblogik.

Alle Diagramme tragen beschriftete, gerundete Werteachsen mit Gitterlinien.
Kleine Werte erscheinen vollständig, große mit lokalisierten Kürzeln
(Tsd./Mio./Mrd./Bio. beziehungsweise k/M/B/T). Der Follower-Stand wird nicht
ab null, sondern im Jahresbereich skaliert, damit auch kleine Veränderungen
sichtbar bleiben; die Achse ist als „Achse nicht bei null“ gekennzeichnet und
die Datentabelle nennt weiterhin jeden absoluten Stand. Die Top-5-Beiträge
weisen Antworten, Boosts, Likes und Zitate einzeln aus; ihre Summe entspricht
der ausgewiesenen Interaktionszahl. Tabellenköpfe mit Zahlen stehen rechtsbündig
über ihren Spalten.

Die PDF-TTFs decken Latin-Zeichen ab. Andere Zeichen erscheinen sichtbar als
`[U+…]`; Original-Links und Metadaten werden nicht als Schriftzeichenersatz verändert.
Das ist kein mehrsprachiger Universalschriftsatz. PDF-Tags und Sprache sind gesetzt,
die Tabellendaten sind auswählbar; vollständige PDF/UA-Konformität ist nicht geprüft.

## Prüfungen und Referenzen

```sh
make check
make test-browser
npm run test:pdf
# Nach bewusst geprüfter Layoutänderung:
npm run test:pdf -- --update-demo --update-reference
# Exportdialog mit kontrollierter Demo-Sitzung aufnehmen:
PDF_SCREENSHOTS=1 npx playwright test tests/e2e/report-pdf.spec.ts
```

`test:pdf` benötigt `pdfinfo`, `pdffonts`, `pdftotext` und `pdftoppm`
(Poppler **26.01.0**, passend zum versionierten Raster-Hashmanifest).
Die festen Fixtures prüfen Deutsch/Englisch, laufendes Jahr, Teilstände, leere
und ältere Reports sowie lange Texte. Alle Grafikwerte werden im extrahierten
PDF gesucht; Unit-Tests prüfen Datenreihen und Tabellenzuordnung. Bounding-Box-
Prüfungen erkennen Überläufe, eine Seitenprüfung erkennt leere Seiten.
Raster-Hashes liegen in `tests/fixtures/pdf-reference.json`.

Die CI installiert Poppler aus der Runner-Distribution und führt
`npm run test:pdf -- --semantic-only` aus; sie prüft Inhalte, Fonts, Grenzen
und leere Seiten und archiviert PDF-/Rasterdateien. Der pixelgenaue Vergleich
bleibt an die dokumentierte lokale Poppler-Version gebunden, damit ein
Runner-Update nicht als Layoutänderung ausgegeben wird.

Referenzprüfung am 18.11.2026: lokale Schrift-Einbettung, deutsche/englische
Lesereihenfolge, Tabellen, Seitenverweise und Original-Links geprüft.
Demo-Werte sind synthetisch, keine echten Login-Daten.
Die vollständigen Standardberichte haben fünf Seiten; lange Inhalte können
lesbare Fortsetzungsseiten erzeugen. Die PDF-Dateien liegen mit Farbverläufen bei rund 70 KB.
PDF-Engine im separaten lazy Chunk: rund 790 KB unkomprimiert / 296 KB gzip;
zusätzliche lokale PDF-Fonts zusammen rund 116 KB. Kein Engine-Download beim
normalen Report-Laden.

Browser-Regressionsprüfung: **162 bestanden, 3 bewusst übersprungene optionale
Live-Screenshot-Tests** auf Desktop, Pixel-7-Profil und 320 CSS-Pixel Breite.
Der PDF-Ablauf prüft auch die Wiederherstellung eines gespeicherten Stands,
während der Live-Abruf inzwischen andere Beiträge liefert. Die gespeicherten
Top-Beiträge bleiben dabei unverändert. Die Community-Seite wurde zusätzlich
in Graustufen visuell geprüft.

Abschluss nach Titel-, Farb- und Achsen-Ergänzungen: `make check` erfolgreich, **207 Unit-/Komponententests**,
SBOM-/Audit-Regressionstests und Produktionsbuild erfolgreich. Die zusätzlichen
PDF-Fixtures für sehr große Zahlen und lange Texte wurden auf Satz und vollständige
Tabellen geprüft; sämtliche aktuellen Rasterreferenzen stimmen überein.
Das Audit-Gate besteht mit der bereits genehmigten, befristeten
Picomatch-Entwicklungsausnahme; keine neue Audit-Ausnahme wurde hinzugefügt.
