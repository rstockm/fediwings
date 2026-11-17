# Spec Delta

## Purpose

Fediwings erstellt übertragbare Monats- und Jahresberichte für die Social-Media-Auswertung von Fediverse-Accounts.

## ADDED Requirements

### Requirement: Reports-Navigation und Verbindung

Das System SHALL den bisherigen Follower-Reiter als „Reports“ anbieten, den bisherigen Follower-Verlauf und die optionale Instanzverbindung erhalten sowie alte Follower-Direktlinks und OAuth-Rücksprünge unterstützen.

#### Scenario: Alter Link
- **WHEN** ein alter Link mit `view=follower` geöffnet wird
- **THEN** zeigt das System Reports an.

#### Scenario: Verbindung als einziger Einstieg
- **WHEN** Reports ohne verbundene eigene Instanz geöffnet wird
- **THEN** bietet die Seite ein Handle-Feld und genau eine Aktion „Eigene Instanz verbinden“, aber keinen „Laden“-Button und keine Statistiken.

#### Scenario: Gemeinsames Laden nach Verbindung
- **WHEN** die eigene Instanz erfolgreich verbunden ist
- **THEN** laden Report und Follower-Verlauf automatisch gemeinsam.

#### Scenario: Verbindung trennen
- **WHEN** die Verbindung getrennt wird
- **THEN** verschwinden alle Statistiken einschließlich gespeicherter Reportansichten von der Seite.

#### Scenario: Account wechseln
- **WHEN** in Reports ein anderer Account eingegeben wird, obwohl bereits eine Instanz verbunden ist
- **THEN** bleibt das Handle-Feld bedienbar, Reports zeigt den neu gewählten Account mit Verbindungsangebot, und nach erfolgreichem Login ersetzt dieser Account die bisherige Sitzung.

#### Scenario: Alte Sitzung ersetzen
- **WHEN** der Login für den neuen Account gelingt
- **THEN** widerruft das System die vorherige Sitzung erst danach; scheitert der Login, bleibt die bisherige Sitzung erhalten und der Fehler wird erklärt.

#### Scenario: Auswahl aus der Analyse
- **WHEN** in der Analyse ein anderer Account geladen und anschließend Reports geöffnet wird
- **THEN** zeigt Reports den analysierten Account statt der Kennzahlen einer weiterhin verbundenen fremden Sitzung.

#### Scenario: Auswahl aus Reports
- **WHEN** in Reports ein Account gewählt wurde und anschließend die Analyse geöffnet wird
- **THEN** ist dessen Handle dort vorausgefüllt; veraltete Ergebnisse eines anderen Accounts werden nicht weiter angezeigt.

### Requirement: Monats- und Jahreskennzahlen

Das System SHALL für ein wählbares Jahr Monats- und Jahreswerte für Followerstand, Netto-Followerwachstum, modellierte Netto-Reichweitensumme, Interaktionen, Engagement Rate und gestartete Postings anbieten. Views und Klicks sind ausgeschlossen.

#### Scenario: Vollständiger Monat
- **WHEN** die Daten eines Monats vollständig geladen sind
- **THEN** zeigt das System Kennzahlen für Postings mit Start im Monat nach Zeitzone Europe/Berlin und den Abrufzeitpunkt.

#### Scenario: Berechnung
- **WHEN** Kennzahlen aggregiert werden
- **THEN** entsprechen Interaktionen Likes plus Boosts plus Antworten plus verfügbaren Quotes und Engagement der Interaktionssumme geteilt durch die modellierte Reichweitensumme.

#### Scenario: Null oder fehlender Wert
- **WHEN** die Reichweite null oder die Datengrundlage nicht vorhanden ist
- **THEN** zeigt das System keine erfundene Engagement Rate beziehungsweise keine als null dargestellte fehlende Kennzahl.

#### Scenario: Laufendes Jahr
- **WHEN** das laufende Jahr angezeigt wird
- **THEN** ist der aktuelle Monat als laufend gekennzeichnet und zukünftige Monate bleiben leer.

#### Scenario: Jahresauswahl
- **WHEN** der Report geöffnet ist
- **THEN** bietet eine Auswahlliste genau die Jahre 2006 bis zum laufenden Jahr an; eine Auswahl lädt den Report automatisch neu.

#### Scenario: Mittelwert im Diagramm
- **WHEN** ein Diagramm mindestens einen Monatswert zeigt
- **THEN** zeichnet das System eine gestrichelte Linie auf Höhe des arithmetischen Mittels der gezeigten Monatswerte und nennt den Wert rechts oben in der Diagrammkarte, ohne Balken zu überdecken.

#### Scenario: Mittelwert beim Follower-Stand
- **WHEN** das Diagramm die absoluten Follower-Zahlen zeigt
- **THEN** entfällt der Mittelwert samt Linie.

#### Scenario: Ganzzahlige Mittelwerte
- **WHEN** das Diagramm Follower-Wachstum, Reichweite oder Interaktionen zeigt
- **THEN** wird der Mittelwert auf eine ganze Zahl gerundet; Engagement und Postings behalten eine Nachkommastelle.

### Requirement: Zeitraumabruf und Datenabdeckung

Das System SHALL die Beitragshistorie für den Berichtszeitraum unabhängig von der Thread-Auswahl der normalen Analyse laden, Fortschritt anzeigen und Abbruch ermöglichen. Unvollständige Ergebnisse SHALL als Teilstand gekennzeichnet werden.

#### Scenario: Abrufbegrenzung
- **WHEN** ein Serverfehler oder ein Request-Limit vollständigen Abruf verhindert
- **THEN** bleiben verfügbare Ergebnisse sichtbar und betroffene Kennzahlen sind als unvollständig erkennbar.

### Requirement: Follower-Stichtage und lokale Reports

Das System SHALL Reports und Followerstände auf ausdrückliche Aktion lokal speichern und gespeicherte Reports anzeigen und löschen können. Es SHALL das tatsächliche Erfassungsdatum ausweisen und keine heutigen Followerstände als historische Monatsendstände ausgeben.

#### Scenario: Jahreswechsel
- **WHEN** im Report ein anderes gültiges Jahr gewählt wird
- **THEN** lädt das System den Live-Report für dieses Jahr automatisch neu.

#### Scenario: Speichern vor dem Laden
- **WHEN** noch kein Live-Report geladen ist
- **THEN** ist „Report speichern“ sichtbar, aber deaktiviert, und ein Hinweis erklärt die Voraussetzung.

#### Scenario: Gespeicherter Stand
- **WHEN** für Account und Jahr ein lokaler Stand existiert
- **THEN** weist die Ansicht ihn mit Speicherdatum aus und bietet das Öffnen und Löschen an.

#### Scenario: Kein gespeicherter Stand
- **WHEN** für Account und Jahr kein lokaler Stand existiert
- **THEN** kennzeichnet die Ansicht das ausdrücklich; das Öffnen verändert die angezeigten Live-Daten nicht.

#### Scenario: Monatswachstum
- **WHEN** vergleichbare gespeicherte Monatsendstände für zwei aufeinanderfolgende Monate vorliegen
- **THEN** zeigt das System deren Differenz als Netto-Followerwachstum.

#### Scenario: Speicherfehler
- **WHEN** der lokale Speicher nicht verfügbar ist
- **THEN** bleiben aktuelle Ergebnisse und Export nutzbar und der Fehler wird angezeigt.

### Requirement: Excel-kompatibler Export

Das System SHALL Reporttabellen zum Kopieren und als CSV anbieten, einschließlich Account, Berichtsjahr, Abrufstand und Modellhinweis.

#### Scenario: Übernahme
- **WHEN** eine Nutzerin die Tabelle kopiert oder als CSV lädt
- **THEN** enthält der Export die angezeigten Monats- und Jahreswerte, unterscheidet fehlende Werte von null und schützt Textfelder vor Formelausführung.

#### Scenario: Rückmeldung
- **WHEN** das Kopieren gelingt oder scheitert
- **THEN** erscheint die Meldung direkt unter der Aktionsleiste, ohne dass zur Meldung am Seitenkopf gescrollt werden muss.

### Requirement: Transparente Darstellung

Das System SHALL modellierte Reichweite und daraus berechnetes Engagement kennzeichnen, die Oberfläche deutsch und englisch anbieten und auf mobilen und Desktop-Bildschirmen bedienbar halten.

#### Scenario: Mobile Tabelle
- **WHEN** der Bildschirm 320 CSS-Pixel breit ist
- **THEN** bleiben Navigation und Aktionen bedienbar und eine breite Tabelle ist innerhalb ihres Bereichs scrollbar.
