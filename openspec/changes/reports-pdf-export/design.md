# Design

## Context

Motivation und Umfang stehen in `proposal.md`. Der vorhandene Report aggregiert `PostReach[]` über `reports.ts`; `ReportsPanel.svelte` übernimmt bislang die Aggregate, nicht die Einzelbeiträge. `reportExport.ts` enthält nur formatierte CSV-/TSV-Daten und einen zusammengesetzten Modellhinweis. Gespeicherte Reports enthalten in Version 1 Aggregate und Zeitstempel, aber keine Top-Beiträge oder eingefrorene Followerquellen.

`PostReach.interactions` ist nicht die Report-Interaktionssumme: Für den PDF-Bericht gelten wie in `reports.ts` Likes + Boosts + Antworten + verfügbare Quotes über den Thread. Followerwerte werden aktuell aus Stichtagen und Verlaufsdaten ergänzt; die Herkunft muss für das PDF erhalten bleiben. Die normale Diagrammlogik behandelt Lücken als null und wird deshalb nicht als Datenquelle des PDFs verwendet.

Die Anwendung bleibt statisch und lokal. Vorhandene Änderungen im Arbeitsbaum, insbesondere am gemeinsamen Laden und Cache, sind laufende Nutzerarbeit und dürfen bei der Umsetzung nicht überschrieben werden.

## Goals / Non-Goals

**Goals:** Fachliche Daten, redaktionelle Aussagen und PDF-Rendering trennen; Vorschau und Download aus demselben Stand; hochwertige, testbare Pagination; rückwärtskompatible Speicherung.

**Non-Goals:** Kein allgemeines Dokumentenframework, kein HTML-Screenshot, keine Änderung der bestehenden Bildschirmdiagramme oder Tabellenexporte, keine zusätzlichen API-Abfragen beim Live-Report. Ausnahme sind ältere gespeicherte Stände ohne Bildfelder: Sie werden beim Öffnen einmalig und best-effort um Avatar und Beitragsbilder ergänzt, ohne Kennzahlen oder Text zu verändern.

## Decisions

### 1. Kleines PDF-Modul mit drei klaren Schichten

Vorgesehene Struktur, an bestehende TypeScript-Konventionen angepasst:

- `src/lib/reportPdf/model.ts`: versionierter `ReportPdfSnapshot`, Herkunft, Zeitbasis und Feldvalidierung.
- `src/lib/reportPdf/prepare.ts`: reine Ableitung aus Report, geladenen Threads und Followerquellen; Top-5-Auswahl und fachliche Konsistenz.
- `src/lib/reportPdf/insights.ts`: deterministische Kernaussagen aus vergleichbaren Monaten.
- `src/lib/reportPdf/document.ts`: redaktionelle Dokumentstruktur unabhängig von der Engine.
- `src/lib/reportPdf/render.ts`: lokaler Renderer, Fontinitialisierung, Seitenlayout und PDF-Blob.
- `src/components/ReportPdfDialog.svelte`: Eingaben, Erstellung, Vorschau, Download und Fehlerzustände.
- Redaktionelle Sprachschlüssel unter `reports.pdf` in den vorhandenen Sprachdateien.

Das PDF erhält keine bereits formatierten CSV-Zeilen. So bleiben Einheiten, Datenlücken und Quellen maschinenlesbar. Keine gemeinsame Export-Abstraktion auf Vorrat; CSV und TSV bleiben unverändert.

### 2. Direkte PDF-Engine hinter kleinem Adapter

Eine browserfähige, lazy geladene Engine übernimmt Textsatz, Tabellen und Seitenumbrüche. Bevorzugter Prüfkandidat ist pdfmake; die genaue verfügbare Version und ihre Fähigkeiten werden bei der Umsetzung geprüft, nicht hier behauptet. Ein begrenzter Layoutnachweis prüft fünf Referenzseiten, lokale Fonts, SVG/Vektoren, Unicode, sichere Links, Bundle-Splitting und Dokumentzugänglichkeit. Wird ein Muss-Kriterium nicht erfüllt, wird eine andere direkte PDF-Engine hinter derselben Schnittstelle bewertet und die Entscheidung dokumentiert.

Alternative `window.print()`: kein verlässlicher Direktdownload und browserabhängiger Satz. Alternative Canvas-/HTML-Screenshot: unscharf, große Dateien, nicht durchsuchbarer Text. Alternative Server: unnötiger Betrieb und Datenübertragung.

Kein neuer interaktiver Chartstack: PDF-spezifische Vektoren mit verpflichtender vollständiger Datentabelle für jede Grafik. Textuelle Einordnungen ergänzen diese Tabellen, ersetzen sie aber nicht. Die Engine-Auswahl wird vor der fachlichen Umsetzung abgeschlossen; wesentliche Frameworkabweichungen erhalten ein ADR.

### 3. Eingefrorener, minimaler Export-Snapshot

Der Snapshot enthält:

- Schema-/Modellversion, Account-Handle, Anzeigename und optionale Avatar-URL, Berichtsjahr, Datenstand, Erstellungszeit und Zeitzone.
- Vorhandene Monats-/Jahresaggregate mit `counterComplete` und `reachComplete`.
- Monatsstatus: abgeschlossen, laufend, zukünftig; Datenabdeckung getrennt von diesen Kalenderzuständen.
- Followerzellen mit Wert, Quelle, Veränderung zum Vormonat samt Berechnungsbasis und Beobachtungsdatum; Follow-Ereignisse getrennt von Nettoveränderung.
- Bis zu fünf vorbereitete öffentliche Thread-Kurzdatensätze: ID, Datum, sicherer Link, optionales Beitragsbild, Klartextauszug oder Inhaltswarnung, Reichweite, Report-Interaktionssumme und Vollständigkeit.
- Herkunft des gesamten Stands: live, neuer gespeicherter Exportstand oder Legacy-Report.

Die Top-5-Ableitung läuft unmittelbar aus `loadReport(...).posts`, bevor das Panel diese Daten verwirft. Es werden nicht alle Rohtexte gespeichert. Titel, Organisation und Sprache gehören zur Exportkonfiguration; der Erstellungszeitpunkt wird je Erstellung eingefroren. Ein Wechsel dieser Konfiguration erzeugt einen neuen Blob; bloßer Download verwendet den vorhandenen Vorschau-Blob.

Ein Generierungs-Token entwertet verspätete Ergebnisse nach Account-/Jahreswechsel oder Dialogschluss. Blob-URLs werden beim Ersetzen/Schließen freigegeben. Kein dauerhafter PDF-Cache.

### 4. Fünfseitige Editorial-Referenz

| Seite | Satz und Inhalt |
| --- | --- |
| 1 | Markenkennung, Titel, Organisation/Handle, Zeitraum; fünf Kennzahlen für Follower, Threads, Interaktionen, Reichweitensumme und Engagement mit farbigen Veränderungsindikatoren; maximal drei Kernaussagen |
| 2 | Drei großzügige Monatsdiagramme für Reichweite, Interaktionen und Threads, jeweils mit kurzer sachlicher Einordnung |
| 3 | Community-Verlauf mit Quellenkennzeichnung; vollständige Monatstabelle, Monate als Zeilen und Kennzahlen als Spalten für lesbares Hochformat |
| 4 | Top 5 als fünf kompakte Editorial-Einträge: Rang/Datum, Auszug, Reichweite, Interaktionssumme mit Einzelwerten für Antworten, Boosts, Likes und Zitate, Original-Link |
| 5 | Prägnante Kennzahlendefinitionen, Methodik und Datenherkunft, Modellversion und Methodik-Link |

Regelfall fünf Seiten, nicht starres Maximum. Fehlende Abschnitte werden kompakt benannt und mit nachfolgenden Inhalten zusammengeführt. Tabellen dürfen kontrolliert fortgesetzt werden; Top-Einträge werden nicht zerrissen. Die vollständige Tabellenabdeckung aller Grafiken hat Vorrang vor dem fünfseitigen Referenzumfang.

Jede datenführende Grafik und ihre Tabelle werden aus derselben strukturierten Datenbeschreibung erzeugt: Reihenbezeichnung, Zeitraum, Einheit, Wert, Monatsstatus, Herkunft und Vollständigkeit. Auch grafisch gezeigte Referenzwerte, etwa Mittelwerte oder Vergleichswerte, werden tabellarisch ausgewiesen. Dekorative Markenelemente ohne Daten benötigen keine Tabelle.

Die Monatstabelle auf Seite 3 darf die drei Monatsdiagramme gemeinsam abdecken, sofern jede Reihe und jeder Wert vollständig enthalten sind. Community-Reihen erhalten zusätzliche eindeutig benannte Spalten oder eigene Tabellen, insbesondere bei unterschiedlichen Followerquellen. Grafiken und räumlich getrennte Tabellen erhalten wechselseitige Verweise mit Titel und tatsächlicher Seitenzahl; diese werden nach der Pagination aufgelöst. Zusätzliche Grafiken benötigen ebenfalls eine zugeordnete vollständige Tabelle.

Keine Reduktion auf ausgewählte Monate, keine Umdeutung von Datenlücken in null und kein Ersatz durch Fließtext. Bei Platzbedarf folgen zusätzliche Tabellenseiten mit wiederholten Köpfen und mindestens 9 pt Schrift. Tabellen enthalten nachvollziehbar formatierte Zahlen statt bloß grafischer Kurzformen wie „1,2 Mio.“.

Gestaltung: 18–20 mm Seitenrand, helle Papieroptik, dunkler Text, Violett als Leitfarbe für Typografie; keine vollflächigen dunklen Seiten. Auf ausdrücklichen Nutzerwunsch übernehmen die Diagrammbalken die Online-Farblogik: Grün bei steigenden beziehungsweise gleichen, Orange bei fallenden Monatswerten; Intensität relativ zum größten Monatsunterschied, inklusive Januarvergleich gegen null. Die Berechnung verwendet die bestehende Online-Funktion und dieselben Grün-/Orange-Tokens, ohne Datenlücken in der PDF-Darstellung in echte Nullwerte umzudeuten. Eine Legende erläutert die Farblogik. Jedes Diagramm erhält eine gerundete, beschriftete Werteachse mit Gitterlinien. Der Follower-Stand wird auf den Jahresbereich vergrößert skaliert und ausdrücklich als nicht bei null beginnend gekennzeichnet; die Tabelle bleibt die verbindliche Quelle der Absolutwerte. Zentrale Gestaltungswerte werden aus `tokens.css` über einen kleinen Exportadapter übernommen; druckspezifische Maße liegen zentral im Layoutprofil. Keine unabhängigen Farbhardcodierungen.

Überschriften in Inter Tight, sofern die Engine geeignete Einbettung erlaubt; lokale, gegebenenfalls statische TTF-/OTF-Varianten mit geprüften Rechten statt Annahme, die vorhandenen variablen WOFF2-Dateien seien direkt PDF-kompatibel. Fließtext 10,5–11 pt, Tabellen mindestens 9 pt, Metadaten mindestens 8,5 pt. Zahlen tabellarisch ausrichten. Kopf-/Fußzeilen, wiederholte Tabellenköpfe und kontrollierte Abstände sind verbindlich. Tabellenköpfe stehen über Zahlenspalten rechtsbündig. Positive/negative Änderungen werden nicht allein durch Farbe transportiert.

### 5. Souveräne Redaktion mit einer kompakten Methodik

Die frühere Idee eines allgemeinen Warnhinweises auf Seite 1 entfällt. Kennzahlbezeichnung: **„FediWings-Reichweite“**, Zusatz **„Summe im Berichtszeitraum“**. Engagement: **„Engagement-Rate“**, Definition am Berichtende. Keine ungeprüften Aussagen über Validierungsstudien oder Messgenauigkeit.

Verbindliche deutsche Textlinie:

> **Einleitung:** Dieser Bericht zeigt, wie sich die Fediverse-Kommunikation von [Organisation/Handle] im Berichtszeitraum entwickelt hat. Er verbindet Veröffentlichungsaktivität, Resonanz und FediWings-Reichweite zu einem kompakten Gesamtbild.

> **Reichweite:** Die FediWings-Reichweite wird nach dem FediWings-Modell aus dem Verbreitungspotenzial und den Interaktionssignalen der Threads berechnet. Der Bericht summiert die Reichweiten der im Zeitraum gestarteten Threads. Mehrfachkontakte über verschiedene Threads sind möglich; die Kennzahl beschreibt keine gemessenen Aufrufe oder eindeutigen Personen.

> **Interaktionen:** Interaktionen umfassen Likes, Boosts, Antworten und verfügbare Quotes der berücksichtigten Threads zum angegebenen Datenstand.

> **Engagement:** Die Engagement-Rate setzt die Interaktionen ins Verhältnis zur FediWings-Reichweite. Gesamtwerte werden aus den Gesamtsummen berechnet.

> **Zeitbasis:** Threads zählen zum Monat ihres Starts in Europe/Berlin. Die Interaktionszähler bilden den Stand des Datenabrufs ab.

> **Teilstand, nur bei tatsächlicher Lücke:** Für [betroffener Bereich] liegt ein Teilstand vor. Die verfügbaren Werte sind ausgewiesen.

Die englischen Texte werden gleichwertig redigiert, nicht dynamisch übersetzt. Maximal drei regelbasierte Aussagen in fester Priorität: Interaktionsspitze und Anteil, Reichweitenentwicklung zum vorherigen abgeschlossenen Monat, Aktivitätsvergleich zweier abgeschlossener Dreimonatsfenster. Nur bei ausreichender vollständiger Basis; kein prozentualer Vergleich gegen null, keine Prognosen oder Kausalbehauptungen. Bei Gleichständen werden gleichrangige Spitzen sachlich benannt oder die Aussage entfällt. Summen/Anteile nutzen ungerundete Werte.

### 6. Top 5 mit optionalen Medien

Rangfolge nach Reichweite, dann Report-Interaktionen, dann Veröffentlichungszeit absteigend, dann ID lexikografisch aufsteigend. Deduplizierung nach Thread-Root-ID; Kalenderzuordnung entspricht der Aggregation. Öffentliche Threads werden anhand `visibility === 'public'` ausgewählt; nicht öffentliche oder nicht gelistete Inhalte erscheinen nicht als Beitragstexte im PDF. Aggregate behalten ihre bestehende Semantik.

Auszüge aus dem Root-Beitrag: HTML in Klartext umwandeln, Absatzabstände normalisieren, Steuerzeichen entfernen, auf höchstens 240 Unicode-Zeichen und die vorgesehene Zeilenhöhe begrenzen, Kürzung markieren. Bei Inhaltswarnung nur deren Text; bei markiert sensiblen Inhalten ohne Warntext neutraler Hinweis statt Auszug. Remote-Fonts bleiben ausgeschlossen.

Avatar und Beitragsbilder sind optional und werden ausschließlich als vorab geladene Data-URLs in das PDF eingebettet; pdfmake behält die Sperre für Remote-URL-Zugriff. Der Avatar stammt aus `avatar_static`, das Beitragsbild bevorzugt aus `preview_url` des Thread-Roots. Sensible Beiträge und Beiträge mit Inhaltswarnung erhalten kein Bild. CORS-Fehler, Netzwerkfehler, übergroße Dateien und Zeitüberschreitungen führen still zum Rückfall auf Initialen beziehungsweise Text, damit der Export nie an Medien scheitert. Vor der Einbettung werden die Bilder verkleinert (Avatar 96 px rund, Beitragsbild 240 × 180 px).

Gespeicherte V2-Stände aus der Zeit vor den Bildfeldern werden beim Öffnen ergänzt: Avatar aus dem aktuellen Account, Beitragsbilder über die Status-API mit Zeitlimit. Nur fehlende Felder werden nachgeladen; Kennzahlen, Texte und Top-5-Auswahl bleiben unverändert, und ein Fehlschlag lässt den Stand ohne Bild. Der Dialog wartet auf diesen einmaligen Nachlauf, damit ein direkt gestarteter Export keine halben Medien sieht.

Die PDF-Engine von pdfmake komprimiert Datenströme über einen aus dem eigenen Bundle erzeugten Blob-Worker. Die CSP erlaubt deshalb `worker-src 'self' blob:`; ohne diese Direktive blockiert der Browser den Worker und die Erstellung mit Bildern bleibt ohne Ergebnis. Externe Worker-Quellen bleiben ausgeschlossen.

Links nur aus vorhandenen validierten HTTP-/HTTPS-URLs ohne Zugangsdaten; fehlen sie, entfällt die Aktion. Keine abgeleiteten Fantasie-URLs. Für Teilstände wird der Ranglistentitel auf den vorhandenen Datenstand begrenzt.

### 7. Additive Speicherung und Legacy-Verhalten

Neue Datensätze als `StoredReport` Version 2 mit versioniertem PDF-Snapshot zusätzlich zu den bestehenden Aggregaten; Reader unterstützt Version 1 und 2. Dexie-Indizes bleiben unverändert, sofern keine Implementierungsnotwendigkeit entsteht. Speichern bleibt explizit und erhält den Snapshot desselben Reportstands.

Version-1-Reports erhalten keinen heimlichen Live-Nachabruf und keine aus aktuellen Beobachtungen behauptete historische Community. PDF nutzt alte Aggregate; fehlende Top-Beiträge/Herkünfte werden als „In diesem gespeicherten Stand nicht enthalten“ benannt. Live-Aktualisierung ersetzt den gesamten Stand erst auf Nutzeraktion.

Damit löst der PDF-Pfad den Widerspruch zwischen der ursprünglichen Netto-Wachstums-Spec und aktuellen Follower-Fallbacks durch getrennte Quellendarstellung, ohne die bestehende Bildschirm-/CSV-Semantik in diesem Change umzuschreiben.

Veränderungen zum Vormonat werden aus demselben effektiven Followerstand berechnet, der in der gemeinsamen Monatstabelle steht: erfasste Monatsendstände haben Vorrang, sonst der rekonstruierte Verlauf. Die Berechnungsbasis bleibt je Zelle erhalten. Differenzen zwischen zwei erfassten Monatsendständen gelten als Nettoveränderung; sobald ein rekonstruierter Wert beteiligt ist, kennzeichnet `~` die Veränderung als Näherung ohne Unfollows. Der Snapshot speichert die Basis optional, ältere Stände ohne dieses Feld werden als beobachtet gelesen. Community- und Kennzahlenwerte stehen in einer einzigen Monatstabelle; Follow-Ereignisse erscheinen nur dann als eigene zweite Zeile, wenn sie sich von der Veränderung unterscheiden. Spaltenbreiten und Schriftgrad skalieren mit dem längsten Spaltenwert, damit auch große Zahlen im Satzspiegel bleiben.

### 8. Qualität als funktionale und visuelle Prüfung

Ergänzung auf Nutzerwunsch: Follower und Engagement vergleichen Januar mit Dezember beziehungsweise dem letzten abgeschlossenen Monat. Reichweite, Interaktionen und Threads vergleichen die Gesamtsummen mit dem Vorjahr; bei laufenden Jahren wird der Vorjahreszeitraum auf das entsprechende Berliner Datum begrenzt. Ein optionaler Snapshot-Zusatz erhält datierte aktuelle Followerstände und Vorjahresaggregate rückwärtskompatibel. Das Vorjahr wird ausschließlich beim expliziten PDF-Start geladen, nicht beim normalen Reportabruf. Der Dialog zeigt den Ladezustand; Schließen verwirft/stoppt den Abruf. Bereits vorhandene Vergleichsdaten werden wiederverwendet und nur auf „Report speichern“ persistiert. Alte gespeicherte Stände werden nicht heimlich mit Live-Vorjahresdaten vermischt.

Referenzfixtures mit festem Datum: vollständiges Jahr, laufendes Jahr, leerer Report, Teilstand, Legacy, Follower-Mischquellen, lange Texte, Unicode und große Zahlen. PDF-Prüfung über Text-/Metadatenextraktion, Linkinspektion und gerasterte Seiten in reproduzierbarer Testumgebung. Binärvergleich allein ist wegen PDF-Metadaten ungeeignet.

Automatische Abdeckungsprüfung: Jede datenführende Grafik muss mindestens einer Tabelle zugeordnet sein. Tests vergleichen sämtliche Grafikreihen und Referenzwerte mit den Tabellen nach Zeitraum, Einheit, Wert und Status. PDF-Extraktion und Layouttests bestätigen, dass die Tabellen tatsächlich vollständig ausgegeben werden, und prüfen Titel-/Seitenverweise auch nach zusätzlichen Fortsetzungsseiten.

Dokumentzugänglichkeit im Engine-Nachweis prüfen: Sprache, Titel, Textreihenfolge, nach Möglichkeit Tags und Überschriftenstruktur. Keine PDF/UA-Konformität behaupten, solange sie nicht separat validiert ist. Vollständige Tabellen für alle datenführenden Grafiken sind Muss; Textalternativen allein genügen nicht. Tastaturführung, Fokus-Rückgabe und Statusmeldungen im Dialog mit Browser-A11y-Checks ergänzen.

Keine speziellen PDF-Reader-Features für den Download voraussetzen: Wenn eine eingebettete native PDF-Vorschau mobil nicht verfügbar ist, zeigt der Dialog eine zugängliche Inhaltsübersicht mit „PDF öffnen“ und unverändertem Direktdownload desselben Blobs.

## Risks / Trade-offs

- [PDF-Engine vergrößert Bundle] → dynamischer Import erst bei PDF-Aktion, Messung und Dokumentation des separaten Chunks.
- [Fonts oder Unicode fehlen] → lokaler Einbettungstest einschließlich Umlauten, englischer Texte und Fallback für nicht unterstützte Zeichen; keine unsichtbar fehlenden Glyphen.
- [Lange Eingaben sprengen Satz] → Titel maximal 120, Organisation maximal 100 Unicode-Zeichen; Umbruchregeln, begrenzte Auszüge und Fortsetzungsseiten.
- [Top-Beiträge fehlen in alten Ständen] → ehrlicher kompakter Hinweis statt Vermischung mit neuem Abruf.
- [Gespeicherte Auszüge erweitern lokale Datenhaltung] → maximal fünf öffentliche Kurztexte, explizites Speichern, keine Roh-Benachrichtigungen oder Tokens.
- [Visuelle Tests sind umgebungsabhängig] → Fonts, PDF-Rasterizer und Testdaten fixieren; Reviewer prüft Änderungen an Referenzseiten.
- [Neue Engine oder Fonts bringen Lizenzpflichten] → vor Aufnahme prüfen, notwendige Notices/Fontlizenzen beilegen, SBOM automatisiert erneuern.

## Migration Plan

1. Layout-/Engine-Nachweis samt lokaler Fonts und dokumentierter Auswahl abschließen.
2. Snapshot und V1-/V2-Reader mit Kompatibilitätstests einführen; keine automatische Umschreibung vorhandener Datensätze.
3. PDF-Dialog und lazy Renderer ergänzen, bestehende Exporte unverändert lassen.
4. Referenz-PDFs, Browserprüfungen, SBOM und README vor Freigabe aktualisieren.
5. Rollback: PDF-Aktion/Build zurücknehmen; keine Daten löschen. Vor Rückkehr auf einen älteren Build prüfen, ob dessen Reader zusätzliche Datensatzfelder/Versionen toleriert; andernfalls kompatiblen Reader beibehalten. Keine Veröffentlichung ohne gesonderten Auftrag.
