# Bibliotheksfunktionen

| Datei | Zweck |
| --- | --- |
| `api.ts` | Mastodon-API mit validierten Antworten; `getReportStatuses` lädt paginiert bis zur Berliner Jahresgrenze und kennzeichnet Teilstände. |
| `deepLink.test.ts` | Prüft Handle-Normalisierung, Längen, Parameter-Ambiguität, Injection-Payloads, lokale Ziele, strikt einmaliges `autostart=1` und Vorrang von OAuth/Share/anderen Ansichten. |
| `deepLink.ts` | `readDeepLinkHandle` prüft untrusted Querywerte strikt; `shouldAutostartDeepLink` akzeptiert genau ein `autostart=1` nur mit gültigem Handle; reine Parser ohne Requests/HTML-Ausgabe; keine DNS-Sandbox. |
| `reports.ts` | `aggregateReport` gruppiert Thread-Kennzahlen und datierte Interaktionen getrennt nach Berliner Kalendermonat; Reichweite und Engagement bleiben am Thread-Start, Interaktionsabdeckung wird separat geführt. |
| `reportInteractions.ts` | Lädt Benachrichtigungen des verbundenen Accounts paginiert und begrenzt; übergibt nur Zeitpunkte und beobachtete Historiengrenze an das Aggregat. Alte oder nicht verfügbare Historie zählt nicht als null. |
| `reports.test.ts` | Prüft Berliner Monatswechsel, Report-Interaktionen einschließlich Quotes sowie Null und Teilstände. |
| `reportIntegration.test.ts` | Prüft Thread-Zuordnung über Jahresgrenzen und unvollständige Reichweite im Report. |
| `reportLoader.ts` | `loadReport` verbindet Jahresabruf, Thread-Gruppierung und Reichweitenmodell; fünfminütiger, sitzungsgebundener In-Memory-Cache für Beiträge und vollständige Jahresanalysen; ältere Jahre setzen vorhandene Paginierung fort, explizites Aktualisieren verwirft den Cache. |
| `reportExport.ts` | Formelsicherer TSV-/CSV-Export inklusive Metadaten und lokalisierter Zahlen. |
| `reportPdf/` | Lokaler Executive-PDF-Export: versionierter Snapshot, Top 5, regelbasierte Texte, Vektorgrafiken mit vollständigen Tabellen, lokale Fonts und lazy pdfmake-Engine; Tests/Fixtures prüfen Quellen und Zahlenkonsistenz. |
| `reportCharts.ts` | Berechnet gerundete Achsenskalen, Balkenpositionen, den Mittelwert der sichtbaren Monate und die auf den größten Monatsunterschied normierte Farbrichtung und Intensität. |
| `reportFollowers.ts` | Übernimmt vorhandene Follow-Monatswerte und verankerte Followerkurve unverändert in das gewählte Reportjahr. |
| `reportStorage.ts` | Dexie-Snapshots und datierte Follower-Stände je Account; Monatsendstände nur am letzten Kalendertag. |
| `reportLoader.test.ts` | Prüft Report-Paginierung, Grenzen, Abbruch und API-Fehler. |
