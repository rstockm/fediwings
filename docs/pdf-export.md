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
Ausnahme sind fehlende Bildfelder in älteren V2-Ständen: Sie werden beim Öffnen
einmalig best-effort nachgeladen, ohne Kennzahlen, Texte oder Rangfolge zu ändern.
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

Die Monatstabelle führt Community- und Kennzahlenwerte in einer Übersicht
zusammen: Follower-Stand, Veränderung, Reichweite,
Interaktionen, Threads und Engagement-Rate stehen nebeneinander. Beim Follower-
Zuwachs erscheint genau ein Wert, ohne Follow-Ereignisse oder Datumszahlen als
kleine zweite Zeile. Die eingebettete Schrift unterstützt `tnum`: Alle Ziffern
haben damit dieselbe Breite, die Zahlenspalten bleiben rechtsbündig.
Differenzen zwischen erfassten Monatsendständen sind
echte Nettoveränderungen. Mit `~` markierte Werte stammen aus dem rekonstruierten
Follower-Verlauf, enthalten keine Unfollows und sind deshalb keine belastbare
Nettoveränderung.

Die Monats- und Jahressummen der Interaktionen stammen unverändert aus
demselben Report-Datenstand wie die Online-Tabelle. Sie zählen verfügbare
eingehende Benachrichtigungen nach Berliner Ereignismonat, auch für ältere
Beiträge. Fehlende Werte bleiben offen, Teilsummen sind markiert. Die
Engagement-Rate bleibt auf gestartete Threads und die Top‑5-Kennzahl auf
Beitragszähler bezogen. Alte gespeicherte Stände tragen ihre alte Definition.

Spaltenbreiten und Schriftgrad skalieren gemeinsam mit dem längsten Wert einer
Spalte. Dadurch bleiben auch sehr große Zahlen und lange Spaltenköpfe innerhalb
der Seitenränder, ohne dass schmale Spalten unnötig Platz verlieren; lange
Bindestrichwörter wie „Engagement-Rate“ brechen am Bindestrich um.

Avatar und Beitragsbilder werden vor dem Satz im Browser geladen und als
Data-URL eingebettet; pdfmake erhält keinen Remote-URL-Zugriff. Der Avatar
stammt aus `avatar_static`, das Beitragsbild bevorzugt aus `preview_url` des
Thread-Roots. Sensible Beiträge und Beiträge mit Inhaltswarnung erhalten kein
Bild. Ladefehler, CORS-Sperren, zu große Dateien und Zeitüberschreitungen
werden still übergangen: Dann erscheinen Initialen beziehungsweise nur der
Text. Die Bilder werden vor der Einbettung verkleinert (Avatar 96 px rund,
Beitragsbild 240 × 180 px), damit der Bericht kompakt bleibt.

Ältere gespeicherte Stände, die noch keine Bildfelder enthielten, werden beim
Öffnen ergänzt: Der Avatar kommt aus dem aktuellen Account, die Beitragsbilder
werden über die Status-API nachgeladen (mit Zeitlimit). Kennzahlen, Texte und
Auswahl der Top 5 bleiben unverändert; scheitert das Nachladen, wird der Bericht
wie bisher mit Initialen und ohne Beitragsbild dargestellt. Die PDF-Engine
komprimiert Datenströme in einem erzeugten Blob-Worker; die CSP erlaubt dafür
`worker-src 'self' blob:`, sonst bliebe die Erstellung mit Bildern hängen.

### Voraussetzungen und Fehlersuche bei Bildern

- Live-Reports übernehmen sichere HTTPS-Medien-URLs aus Account und Top-Threads.
  Fehlende URLs werden auch unmittelbar beim PDF-Start nachgeladen, unabhängig
  davon, ob zuvor ein gespeicherter Stand geöffnet wurde. Sowohl fehlende Felder
  als auch `null` erlauben einen erneuten Versuch; Kennzahlen und Texte bleiben
  eingefroren. Legacy-V1-Reports ohne Top-Beitragsdaten bleiben ausgenommen.
- Sensible Beiträge und Inhaltswarnungen sind grundsätzlich ausgeschlossen,
  auch bei gespeicherten Bild-URLs. Beiträge ohne Bildanhang bleiben ohne Bild.
- Medienserver müssen CORS erlauben. Sichtbarkeit im HTML-`img` genügt nicht:
  Für die PDF-Einbettung muss der Browser die Bildbytes lesen dürfen.
  Der Abruf erfolgt ohne Cookies und ohne Browsercache (`cache: no-store`),
  damit vorherige Nicht-CORS-Bildaufrufe die Klickstrecke nicht beeinflussen.
- Jede URL erhält bei einem fehlgeschlagenen Abruf einen zweiten Versuch.
  Pro Versuch gelten 6 Sekunden und maximal 8 MB. Avatar und Beitragsbilder
  starten parallel. Dauerhafte CORS-Sperren werden dadurch nicht umgangen.
- Zulässig sind PNG, JPEG, WebP, GIF und AVIF mit passendem MIME-Typ und
  erfolgreicher Browser-Decodierung. SVG, falscher MIME-Typ, HTTP-Fehler,
  abgelaufene URLs, Offlinebetrieb, Timeout oder Canvas-Fehler führen weiterhin
  zu Initialen beziehungsweise reinem Text.

Die berichtete Erfolgsquote ist ohne konkrete betroffene URLs nicht reproduziert.
Die bisherigen Codepfade konnten fehlende Metadaten je nach Klickstrecke anders
behandeln; ein Cache/CORS-Konflikt ist eine weitere mögliche, nicht am Live-Fall
nachgewiesene Ursache. Browsertests prüfen den direkten Live-Export und
gespeicherte Stände mit fehlenden Feldern und `null`; Unit-Tests prüfen
Cachemodus, Wiederholung und Ausschlüsse.

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
lesbare Fortsetzungsseiten erzeugen. Die PDF-Dateien liegen mit Farbverläufen
und eingebetteten Demo-Medien bei rund 60–100 KB.
PDF-Engine im separaten lazy Chunk: rund 790 KB unkomprimiert / 296 KB gzip;
zusätzliche lokale PDF-Fonts zusammen rund 116 KB. Kein Engine-Download beim
normalen Report-Laden.

Browser-Regressionsprüfung: **165 bestanden, 3 bewusst übersprungene optionale
Live-Screenshot-Tests** auf Desktop, Pixel-7-Profil und 320 CSS-Pixel Breite.
Der PDF-Ablauf prüft auch die Wiederherstellung eines gespeicherten Stands,
während der Live-Abruf inzwischen andere Beiträge liefert. Die gespeicherten
Top-Beiträge bleiben dabei unverändert. Die Community-Seite wurde zusätzlich
in Graustufen visuell geprüft.

Abschluss nach Titel-, Farb-, Achsen- und Medien-Ergänzungen: `make check` erfolgreich, **215 Unit-/Komponententests**,
SBOM-/Audit-Regressionstests und Produktionsbuild erfolgreich. Die zusätzlichen
PDF-Fixtures für sehr große Zahlen und lange Texte wurden auf Satz und vollständige
Tabellen geprüft; sämtliche aktuellen Rasterreferenzen stimmen überein.
Das Audit-Gate besteht mit der bereits genehmigten, befristeten
Picomatch-Entwicklungsausnahme; keine neue Audit-Ausnahme wurde hinzugefügt.
