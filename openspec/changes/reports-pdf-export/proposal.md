# Proposal

## Why

Der vorhandene CSV-/TSV-Export dient der Weiterverarbeitung, nicht der Kommunikation an Geschäftsführung und Leitungsgremien. Ein hochwertiger, lokal erzeugter PDF-Bericht soll die fundierten FediWings-Kennzahlen zu einer eigenständig verständlichen Managementpublikation verdichten.

## What Changes

- Zusätzlicher PDF-Export im Reports-Bereich mit Vorschau, optionalem Organisationsnamen und Berichtstitel sowie deutscher und englischer Ausgabe.
- Editorial gestalteter A4-Bericht: Executive Summary, Monatsentwicklung, Community und Detailtabelle, Top 5 Beiträge sowie kompakte Methodik. Regelfall fünf Seiten, ohne leere Schmuckseiten.
- Jede datenführende Grafik erhält zusätzlich eine vollständige, eindeutig zugeordnete Tabelle im PDF: alle dargestellten Werte, Zeiträume, Einheiten und Datenlücken. Zusätzliche Seiten haben Vorrang vor verkleinerter Schrift; reine Textalternativen genügen nicht.
- Souveräne, regelbasierte Erläuterungen: Reichweite als fundierte FediWings-Kennzahl, knappe methodische Einordnung gebündelt am Berichtende; tatsächliche Teilstände werden konkret ausgewiesen.
- Top 5 öffentliche Threads nach FediWings-Reichweite mit Textauszug, Datum, Reichweite, Interaktionen und Original-Link.
- Unveränderlicher PDF-Datenstand mit strukturierten Herkunfts- und Vollständigkeitsinformationen; fehlende Werte bleiben von null unterscheidbar.
- Ergänzung auf Nutzerwunsch: Online-Farblogik Grün/Orange, Follower als fünfte Titelkennzahl und farbige Veränderungsindikatoren. Reichweite/Interaktionen/Threads vergleichen Summen mit dem Vorjahr (YTD: gleicher Zeitraum), Follower/Engagement Januar bis Dezember. Vorjahresdaten werden erst beim PDF-Start geladen.
- Neue gespeicherte Reports erhalten die für reproduzierbare PDFs erforderlichen Exportdaten einschließlich Top-5-Auszügen; bestehende lokale Reports bleiben lesbar.
- Bestehende CSV-/TSV-Ausgabe, Reichweitenformel, Ladeablauf und Instanzverbindung bleiben erhalten.

## Capabilities

### New Capabilities

- `reports-pdf-export`: Lokaler Executive-PDF-Export einschließlich Redaktion, Layout, Top-5-Auswahl, Export-Snapshot, Kompatibilität, Vorschau und Qualitätsprüfung.

### Modified Capabilities

Keine. Die Hauptspecs sind noch leer; `reports-dashboard` liegt als abgeschlossener, nicht archivierter Change vor. Dessen Anforderungen werden als Kontext erhalten, nicht durch diesen Change umgeschrieben oder vorzeitig archiviert.

## Impact

- Integration in `src/components/ReportsPanel.svelte`; eigene Dialog-/Vorschaukomponente und abgegrenztes PDF-Modul unter `src/lib/`.
- Wiederverwendung von `reports.ts`, `reportLoader.ts`, `reportFollowers.ts` und `reportStorage.ts`; additive Versionierung gespeicherter Exportdaten und Tests für alte Datensätze.
- Zusätzliche lokale Texte in `src/lib/i18n/de.ts` und `en.ts`; keine KI- oder PDF-Serveranbindung.
- Eine dedizierte, lazy geladene PDF-Engine und gegebenenfalls geeignete lokale Fontdateien; Auswahl nach Layoutnachweis, Lizenzprüfung und Prüfung der Dokumentzugänglichkeit. SBOM und Fremdkomponentenhinweise werden bei Einführung aktualisiert.
- Unit-, Integrations-, Browser- und visuelle PDF-Prüfungen; README, versioniertes Demo-PDF und Desktop-/Mobilaufnahmen des Exportablaufs.

## Non-goals

Keine Änderung des Reichweitenmodells, keine Views/Klicks/ROI-Zuschreibungen, kein XLSX-Modul, keine neue interaktive Diagrammbibliothek, kein externer Dienst, kein Logo-Upload, kein freier Berichtseditor und keine automatische Veröffentlichung.
