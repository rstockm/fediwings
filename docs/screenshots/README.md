# README-Screenshots

Stand: **08.11.2026**. Echte Chromium-Aufnahmen der FediWings-Oberfläche mit
öffentlichen Daten von [rstockm@chaos.social](https://chaos.social/@rstockm).
Keine API-Mocks, erfundenen Kennzahlen oder angemeldeten Sitzungen.

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

## Aktualisieren

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
