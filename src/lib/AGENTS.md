# Bibliotheksfunktionen

| Datei | Zweck |
| --- | --- |
| `api.ts` | Mastodon-API mit validierten Antworten; `getReportStatuses` lädt paginiert bis zur Berliner Jahresgrenze und kennzeichnet Teilstände. |
| `deepLink.test.ts` | Prüft Handle-Normalisierung, Längen, Parameter-Ambiguität, Injection-Payloads, lokale Ziele, strikt einmaliges `autostart=1` und Vorrang von OAuth/Share/anderen Ansichten. |
| `deepLink.ts` | `readDeepLinkHandle` prüft untrusted Querywerte strikt; `shouldAutostartDeepLink` akzeptiert genau ein `autostart=1` nur mit gültigem Handle; reine Parser ohne Requests/HTML-Ausgabe; keine DNS-Sandbox. |
| `reports.ts` | In Entwicklung: `aggregateReport` gruppiert Thread-Kennzahlen nach Berliner Kalendermonat und berechnet Reichweitensumme und Engagement. |
| `reports.test.ts` | Prüft Berliner Monatswechsel, Report-Interaktionen einschließlich Quotes sowie Null und Teilstände. |
| `reportIntegration.test.ts` | Prüft Thread-Zuordnung über Jahresgrenzen und unvollständige Reichweite im Report. |
| `reportLoader.ts` | `loadReport` verbindet Jahresabruf, Thread-Gruppierung und bestehendes Reichweitenmodell. |
| `reportExport.ts` | Formelsicherer TSV-/CSV-Export inklusive Metadaten und lokalisierter Zahlen. |
| `reportCharts.ts` | Berechnet gerundete Achsenskalen, Balkenpositionen, den Mittelwert der sichtbaren Monate und die auf den größten Monatsunterschied normierte Farbrichtung und Intensität. |
| `reportFollowers.ts` | Übernimmt vorhandene Follow-Monatswerte und verankerte Followerkurve unverändert in das gewählte Reportjahr. |
| `reportStorage.ts` | Dexie-Snapshots und datierte Follower-Stände je Account; Monatsendstände nur am letzten Kalendertag. |
| `reportLoader.test.ts` | Prüft Report-Paginierung, Grenzen, Abbruch und API-Fehler. |
