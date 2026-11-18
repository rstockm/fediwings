# README-Screenshots

Stand: **08.11.2026**. Echte Chromium-Aufnahmen der FediWings-Oberfläche mit
öffentlichen Daten von [rstockm@chaos.social](https://chaos.social/@rstockm).
Diese älteren Live-Aufnahmen verwenden keine API-Mocks oder angemeldeten
Sitzungen. Die unten ausdrücklich als UI-Demo bezeichneten neueren Aufnahmen
verwenden dagegen kontrollierte Testdaten.

| Datei                   | Bereich                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `start.png`             | Startseite mit vorausgefülltem Handle, noch ohne Analyse                          |
| `analyse-desktop.png`   | Abgeschlossene öffentliche Analyse und Accountübersicht                           |
| `analyse-mobile.png`    | Dieselbe Analyse bei 390 Pixel Breite                                             |
| `posting-insights.png`  | Vier Kennzahlen im 30-Tage-Vergleich                                              |
| `thread-details.png`    | Aufgeklappter eigener Thread mit Folgebeitrag und Long-Tail-Vorschau              |
| `follower.png`          | Öffentliche Followerzahl und Login-Grenze                                         |
| `instanzverbindung.png` | Erklärung der optionalen OAuth-Verbindung, vor der Anmeldung                      |
| `methodik.png`          | Einstieg in die Methodikseite                                                     |
| `share-card.png`        | Echte, über den Card Service erzeugte Karte für einen öffentlichen FediPol-Thread |
| `reports-desktop.png`   | Reporttabelle mit öffentlichen ZLB-Daten; Desktop |
| `reports-mobile.png`    | Reporttabelle mit denselben öffentlichen ZLB-Daten; Mobilansicht |
| `reports-charts-desktop.png` | Balkendiagramme des ZLB-Jahresreports; Desktop |
| `reports-charts-mobile.png` | Balkendiagramme desselben Reports; Mobilansicht |
| `reports-connect-desktop.png` | Aktueller Reports-Einstieg ohne Verbindung und ohne Statistiken |
| `reports-connect-mobile.png` | Derselbe Einstieg mobil |
| `reports-loading-demo-desktop.png` | UI-Demo vom 18.11.2026: gemeinsamer Ladezustand, kontrollierte Antworten für alice@test.social; keine echte Anmeldung |
| `reports-loading-demo-mobile.png` | Dieselbe UI-Demo bei 390 Pixel Breite |
| `report-pdf-desktop.png` | PDF-Exportdialog, Desktop-UI-Demo vom 18.11.2026; kontrollierte Antworten und synthetische Sitzung, keine Live-Anmeldung |
| `report-pdf-mobile.png` | Derselbe Exportdialog mit mobilem Direktdownload |
| `report-pdf-page-1.png` | Gerasterte erste Seite des synthetischen PDF-Beispielberichts mit Account-Avatar, kein Live-Report |
| `report-pdf-charts.png` | Aktualisierte Demo-Diagrammseite mit Online-Farblogik Grün/Orange und vollständiger Tabellenzuordnung |
| `report-pdf-followers.png` | Demo-Seite mit vergrößerter Follower-Achse, rechtsbündigen Tabellenköpfen und zusammengeführter Monats- und Community-Tabelle |
| `report-pdf-top-posts.png` | Demo-Top-5-Seite mit Beitragsbildern, Einzelinteraktionen und Original-Links |

## Aktualisieren

PDF-Beispiele: `npm run test:pdf -- --update-demo --update-reference`;
die erste gerasterte Demoseite aus `test-results/pdf/complete-de-1.png`
als `report-pdf-page-1.png` übernehmen, die Community-Seite aus
`test-results/pdf/complete-de-3.png` als `report-pdf-followers.png` und die
Top-5-Seite aus `test-results/pdf/complete-de-4.png` als
`report-pdf-top-posts.png`. Den Dialog nach aktuellem Build mit
`PDF_SCREENSHOTS=1 npx playwright test tests/e2e/report-pdf.spec.ts` aufnehmen.
Die UI-Aufnahmen zeigen Chromium (1280 × 720) und das mobile Pixel-7-Testprofil.
Alle Inhalte sind kontrollierte Demo-Daten, keine authentifizierten Live-Bereiche.

Nach dem Zusammenführen von Community- und Kennzahlentabelle wurde die
Community-Seite am 18.11.2026 erneut gerastert. Zuvor, nach Ergänzung der
Follower-Titelkennzahl und Veränderungs-Badges, wurden
Titel- und Diagrammseite am 18.11.2026 erneut gerastert. Die Diagrammseite ist
`test-results/pdf/complete-de-2.png` und wird als `report-pdf-charts.png` übernommen.
Am selben Tag ergänzten Avatar und Beitragsbilder die Titelseite und die
Top-5-Seite; beide Raster wurden aktualisiert. Die Demo-Medien sind
deterministische, synthetische Platzhalter, keine echten Account- oder
Beitragsfotos.

Die Community-Seite wurde am 18.11.2026 nochmals mit vereinfachter Tabelle
aufgenommen: nur ein Zuwachswert je Monat, keine kleinen Zweitwerte und
gleich breite Tabellenziffern.

Die gemeinsamen Ladeanzeigen werden mit
`UPDATE_COMBINED_REPORT_SCREENSHOTS=1 npx playwright test tests/e2e/follower.spec.ts -g 'waehrend des Ladens' --project=chromium`
nach einem aktuellen Build aufgenommen (1440 × 1000 und 390 × 1100).
Der Test hält die Benachrichtigungsantwort gezielt zurück und prüft, dass genau
ein Fortschritt und ein Abbruch erscheinen und Ergebnisse bis zum Abschluss
verborgen bleiben. Die Aufnahmen sind UI-Demos, kein Nachweis eines Live-Logins.

Die aktuellen Einstieg-Aufnahmen entstehen nach einem Build mit
`LIVE_REPORT_SCREENSHOTS=1 npx playwright test tests/e2e/follower.spec.ts -g 'optionale öffentliche' --project=chromium`.
Die älteren Reports-/Diagrammaufnahmen vom 16.11.2026 verwenden öffentliche
ZLB-Daten und stammen vor der Verbindungspflicht, vor der aktuellen
Grün-/Orange-Farblogik, vor der heutigen Aktionsleiste am Kopf der
Reportansicht, vor der Mittelwertlinie in den Diagrammen, vor der heutigen
Wertanzeige rechts oben in der Diagrammkarte und vor der Jahresauswahl als
Liste. Sie bleiben als gekennzeichnete Darstellungsbeispiele erhalten.
Authentifizierte Live-Reports können ohne Anmeldung des Accountinhabers nicht
neu aufgenommen werden; sie werden nicht vorgetäuscht.
Die Methodikaufnahme vom 16.11.2026 entsteht mit
`UPDATE_REPORT_SCREENSHOTS=1 npx playwright test tests/e2e/app.spec.ts -g 'wechselt ueber die Reiter' --project=chromium`.
Sie zeigt die aktuelle Reports-Methodik und hat keinen zusätzlichen Außenrand.
Ältere Übersichtsaufnahmen zeigen teilweise noch die frühere Reiterbezeichnung
„Follower“.

1. Den zu dokumentierenden Stand bauen bzw. dessen Deployment überprüfen.
2. Deutsch wählen; Desktop-Viewport 1440 × 1000, Mobil-Viewport 390 × 1100,
   jeweils ohne Browserrahmen und mit geladenen lokalen Fonts.
3. `/?handle=rstockm%40chaos.social` für die Startseite verwenden, anschließend
   mit 80 Threads analysieren. Auf die abgeschlossene Analyse warten.
4. Accountübersicht, Posting Insights und einen aufgeklappten eigenen Thread
   aufnehmen. Die graue Long-Tail-Kurve nicht als echte Boost-Historie beschriften.
5. Im Follower-Tab die öffentlichen Daten laden; die Instanzverbindung nur bis
   zum Erklärdialog öffnen. Keine Tokens oder privaten Benachrichtigungen aufnehmen.
6. Eine Share-Card nur auf Auftrag erzeugen: Das Öffnen des Teilen-Dialogs
   veröffentlicht beim konfigurierten Card Service bereits den öffentlichen
   Snapshot. Für diese Dokumentation wurde auf ausdrücklichen Wunsch eine Karte
   des gezeigten FediPol-Threads erstellt; das erzeugte Kartenbild wird lokal
   versioniert und nicht nur vom Service eingebunden.
7. Methodikseite aufnehmen, alle Bilder visuell prüfen und Datum, Alt-Texte und
   README-Beschreibungen gemeinsam aktualisieren. Ausschnitte statt langer,
   unlesbarer Ganzseitenaufnahmen bevorzugen.
8. Allen Bildern einen ruhigen, zum Hintergrund passenden Außenrand geben:
   48 Pixel bei Desktop/Karte, 56 Pixel bei den Posting Insights und 24 Pixel
   mobil. Der Rand wird nach der Aufnahme ergänzt; App-Inhalte und Kennzahlen
   bleiben unverändert. Überschriften, Kartenrahmen und Schatten nicht am Rand
   abschneiden. Die Viewportgrößen oben verstehen sich ohne diesen Außenrand.

## Bewusst nicht abgebildet

- Authentifizierte Follower-Charts und echte Boost-Zeitverläufe: benötigen die
  ausdrückliche Anmeldung des Accountinhabers und eine Prüfung privater Inhalte.
- Share-Karten-Dialog mit Betriebssystem-/Clipboard-Aktionen: Stattdessen ist das
  tatsächliche Ergebnis als `share-card.png` abgebildet.

Die Bilder dienen der Dokumentation und werden nicht mit der App ausgeliefert.
Öffentliche Posts und eingebettete Medien behalten die Rechte ihrer jeweiligen
Urheber:innen; aus den Aufnahmen folgt keine zusätzliche Projekt-/Assetlizenz.
