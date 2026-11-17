# Komponenten

| Datei | Zweck |
| --- | --- |
| `BoostTimelinePreview.svelte` | Graue, dekorative Long-Tail-Beispielkurve ohne Messdaten; aktiver `onconnect`-CTA öffnet bestehende Instanzverbindung. |
| `PostCard.svelte` | Post-Karte; verbundene 50/50-Aktionen; aufgeklappt echte Boost-Historie oder Vorschau bei angebotenem `onconnect`. |
| `ReportCharts.svelte` | Responsive Monatsbalken mit gerundeter Achse, relativ zur Vormonatsänderung skalierter Grün-/Orange-Farbe und gestrichelter Mittelwertlinie; der Mittelwert steht rechts oben in der Diagrammkarte, entfällt beim absoluten Follower-Stand und erscheint für Wachstum, Reichweite und Interaktionen ganzzahlig; fehlende Monate zählen als 0, genaue Werte in der zugänglichen Tabelle. |
| `ReportCharts.test.ts` | Prüft Farbrichtung, relative Intensität, Nullbehandlung fehlender Monate, Mittelwertlinie samt Wertanzeige, Rundung, Ausblenden beim Follower-Stand und die zugängliche Farblegende. |
| `FollowerPage.svelte` | Zeigt Statistiken nur für den ausgewählten Account; das Handle-Feld bleibt auch mit Sitzung bedienbar, ein anderer Account ersetzt die Verbindung und die Auswahl wird in alle Views durchgereicht. |
| `ReportsPanel.svelte` | Lädt Jahresreports automatisch, auch nach Jahreswechsel; Jahresauswahl als Liste statt Zahlen-Spinner; feste Aktionsleiste mit deaktiviertem Speichern vor dem Laden, sichtbarem gespeicherten Stand und Export; Kopier- und Löschmeldungen erscheinen direkt unter der Aktionsleiste. |
| `ReportsPanel.test.ts` | Prüft automatischen Reportabruf, Jahreswechsel, Speicherzustand und Kennzeichnung unvollständiger Daten. |
