# Tasks

## 1. Navigation und Verbindung

- [x] 1.1 Reports-Navigation, alten Follower-Alias und OAuth-Rücksprung implementieren; Unit- und Browser-Tests für Direktlinks und Rücksprung bestehen.
- [x] 1.2 Follower-Verlauf und bestehende Instanzverbindung in Reports integrieren; Tests prüfen öffentlichen und verbundenen Zustand.
- [x] 1.3 Kontowechsel stabilisieren: Handle-Feld bleibt mit Sitzung bedienbar, Analyse- und Reports-Auswahl werden durchgereicht, neue Sitzung ersetzt die alte erst nach erfolgreichem Login; Browser-Tests prüfen Wechsel, Analyse-zu-Reports und fehlgeschlagenen Wechsel.

## 2. Datenabruf und Kennzahlen

- [x] 2.1 Zeitraumbezogene Paginierung mit Fortschritt, Abbruch und Abdeckungsstatus implementieren; API-Tests prüfen Grenzen, Fehler und Rate Limits.
- [x] 2.2 Thread-Gruppierung und bestehende Reichweitenberechnung für Jahresberichte integrieren; Tests prüfen Jahresgrenzen, abgeschnittene Threads und Teilstände.
- [x] 2.3 Reine Monats-/Jahresaggregation mit Berliner Zeitzone und eigener Interaktionsdefinition erstellen; Tests prüfen Zeitzonenwechsel, Quotes, Null und Jahreswerte.

## 3. Speicherung und Export

- [x] 3.1 Framework-Vorgabe 9.4 prüfen, Dexie ergänzen, Lizenzprüfung dokumentieren und SBOM erzeugen; `make sbom-check` und `npm run test:sbom` bestehen.
- [x] 3.2 Versionierte lokale Report-Snapshots und datierte Followerstände mit explizitem Speichern, Laden und Löschen umsetzen; Tests prüfen Kontotrennung, Wachstum und Speicherfehler.
- [x] 3.3 TSV-Kopieren und CSV-Download mit Metadaten und Formelschutz implementieren; Exporttests prüfen Sonderzeichen, Null, fehlende Werte und gefährliche Eingaben.

## 4. Reports-Oberfläche und Dokumentation

- [x] 4.1 Jahresauswahl, Fortschritt, Monats-/Jahrestabelle, Teilstände und Aktionen zweisprachig umsetzen; Komponententests prüfen Zustände und Kennzeichnungen.
- [x] 4.2 Responsive und tastaturbedienbare Darstellung einschließlich 320px und  Follower-Verlauf prüfen; Playwright- und Accessibility-Tests bestehen.
- [x] 4.3 README, Methodik und relevante Komponenten-/Bibliotheksdokumentation aktualisieren; Desktop- und Mobil-Screenshots mit öffentlichen Daten erstellen und verlinken.
- [x] 4.4 Mittelwertlinie je Monatsdiagramm mit Wertanzeige ergänzen; Unit- und Komponententests prüfen Berechnung, Position und Leerzustand.
- [x] 4.7 Mittelwert beim Follower-Stand ausblenden, Wachstum/Reichweite/Interaktionen ganzzahlig runden und den Wert rechts oben in die Diagrammkarte verschieben; Komponententests prüfen Rundung, Ausblenden und Position.
- [x] 4.5 Rückmeldung für Kopieren und Löschen direkt an der Aktionsleiste anzeigen; Komponenten- und Browsertest prüfen Erfolg, Fehler und Sichtbarkeit.
- [x] 4.6 Jahres-Spinner durch eine klar bedienbare Auswahlliste ersetzen; Komponententest prüft den gültigen Jahresbereich.

## 5. Integration

- [x] 5.1 Gesamtablauf mit öffentlichem Account, OAuth-Rückkehr und Export prüfen; `make check` und `make test-browser` bestehen oder Abweichungen sind dokumentiert.
