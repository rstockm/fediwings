# Komponenten

| Datei | Zweck |
| --- | --- |
| `BoostTimelinePreview.svelte` | Graue, dekorative Long-Tail-Beispielkurve ohne Messdaten; aktiver `onconnect`-CTA öffnet bestehende Instanzverbindung. |
| `PostCard.svelte` | Post-Karte; verbundene 50/50-Aktionen; aufgeklappt echte Boost-Historie oder Vorschau bei angebotenem `onconnect`. |
| `ReportCharts.svelte` | Responsive Monatsbalken mit gerundeter Achse, relativ zur Vormonatsänderung skalierter Grün-/Orange-Farbe und gestrichelter Mittelwertlinie; der Mittelwert steht rechts oben in der Diagrammkarte, entfällt beim absoluten Follower-Stand und erscheint für Wachstum, Reichweite und Interaktionen ganzzahlig; beim Überfahren zeigen Führungslinie und Tooltip Monat und Wert, fehlende Monate zählen als 0, genaue Werte stehen in der zugänglichen Tabelle. |
| `ReportCharts.test.ts` | Prüft Farbrichtung, relative Intensität, Nullbehandlung fehlender Monate, Mittelwertlinie samt Wertanzeige, Rundung, Ausblenden beim Follower-Stand, den Hover-Tooltip und die zugängliche Farblegende. |
| `FollowerPage.svelte` | Zeigt Statistiken nur für den ausgewählten Account; stellt die konkrete Server-Software nach OAuth/Reload aus vorhandenen Metadaten oder NodeInfo wieder her und kennzeichnet fehlgeschlagene Erkennung. Handle-Feld bleibt mit Sitzung bedienbar; Auswahl wird in alle Views durchgereicht. |
| `ReportsPanel.svelte` | Koordiniert Report und Follower-Verlauf mit gemeinsamem Fortschritt, AbortSignal und Ergebnisfreigabe; nutzt kurzlebigen Accountcache; explizites Live-Laden aktualisiert beide Quellen. Jahresauswahl lädt automatisch; Speichern/Export erst nach Abschluss; Aktionsmeldungen direkt an der Leiste. |
| `ReportsPanel.test.ts` | Prüft automatischen Reportabruf, Jahreswechsel, Speicherzustand und Kennzeichnung unvollständiger Daten. |
| `ReportPdfDialog.svelte` | Lokaler PDF-Export mit Titel, Organisation, Sprache, Vorschau und identischem Download-Blob; verwirft veraltete Ergebnisse und gibt Blob-URLs frei. |
| `ReportPdfDialog.test.ts` | Prüft Fehler/Wiederholung, Blob-Lebensdauer, Eingabeänderung sowie Account-/Jahreswechsel während der Erstellung. |
