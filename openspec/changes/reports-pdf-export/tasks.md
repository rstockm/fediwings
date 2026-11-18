# Tasks

## 1. PDF-Engine und Editorial-Grundlage

- [x] 1.1 Layoutnachweis mit dem Prüfkandidaten pdfmake und lokalen Fonts erstellen; anhand eines fünfseitigen Demo-Berichts Vektoren, Textauswahl, Unicode, sichere Links, Tabellenumbruch, Titel/Sprache und Textreihenfolge prüfen und die Engine-Entscheidung dokumentieren.
- [x] 1.2 Gewählte Engine lazy einbinden und geeignete Fonts samt Lizenz-/NOTICE-Dateien aufnehmen; separaten Produktions-Chunk mit `npm run build` nachweisen, Komponentenbefund in `compliance/README.md` festhalten und `make sbom`, `make sbom-check` sowie `npm run test:sbom` ausführen.
- [x] 1.3 Zentrales PDF-Layoutprofil und Adapter auf bestehende Design-Tokens anlegen; Referenzseite auf Ränder, Mindestschriftgrößen, Graustufenlesbarkeit und Markenkonsistenz prüfen und die Satzregeln in der Moduldokumentation festhalten.

## 2. Fachlicher Exportstand und Top 5

- [x] 2.1 Versioniertes PDF-Datenmodell mit Monatsstatus, Herkunft, Vollständigkeit und getrennten Zeitstempeln definieren; Unit-Tests für abgeschlossenes/laufendes Jahr, fehlende Werte, null und Berliner Jahresgrenzen ergänzen.
- [x] 2.2 Reine Vorbereitung aus vorhandenen Report-Aggregaten und Followerquellen implementieren; Tests weisen unveränderte Reichweiten-/Interaktionssummen, gewichtetes Gesamt-Engagement und Trennung von Nettoveränderung und Follow-Ereignissen nach.
- [x] 2.3 Top-5-Auswahl aus den bereits geladenen öffentlichen Threads implementieren; Tests prüfen Thread-Deduplizierung, alle Gleichstandsregeln, null/einen/vier/fünf Beiträge, Jahreszuordnung und vollständige Report-Interaktionsdefinition einschließlich Quotes.
- [x] 2.4 Begrenzte Klartextauszüge, Inhaltswarnungsbehandlung und sichere Links vorbereiten; Tests mit HTML-Payloads, Steuerzeichen, Unicode, sensiblen Inhalten und unsicheren/fehlenden URLs ergänzen.
- [x] 2.5 PDF-Snapshot an der bestehenden Ladegrenze im Panel bereitstellen, ohne Cache-/Ladearbeit zu überschreiben; Integrationstest bestätigt, dass Top 5 keine zusätzlichen Instanzabfragen auslösen.

## 3. Redaktion und regelbasierte Kernaussagen

- [x] 3.1 Deutsche und englische PDF-Texte unter den vorhandenen Sprachschlüsseln ergänzen; redaktioneller Review bestätigt souveräne Reichweitenkommunikation, gebündelte Methodik und tatsächliche Teilstandhinweise statt pauschaler Warnblöcke.
- [x] 3.2 Maximal drei priorisierte Kernaussagen gemäß Design ableiten; Unit-Tests prüfen vollständige abgeschlossene Monate, Dreimonatsfenster, Gleichstände, Nullnenner, Teilstände und das Ausbleiben von Kausalbehauptungen.
- [x] 3.3 Engine-unabhängige Dokumentstruktur für fünf Referenzseiten und erforderliche Fortsetzungsseiten einschließlich Leer-/Legacy-Fällen erstellen; Strukturtests prüfen alle Pflichtkennzahlen, Metadaten, Top-Beiträge und die vollständige Zuordnung jeder datenführenden Grafik zu einer Tabelle.

## 4. Kompatible lokale Speicherung

- [x] 4.1 Reader für gespeicherte Versionen 1 und 2 sowie explizites Speichern des minimalen Export-Snapshots implementieren; Storage-Tests bestätigen Erhalt alter Aggregate, maximal fünf Kurztexte und Abwesenheit von Tokens/Roh-Benachrichtigungen.
- [x] 4.2 Wiederherstellung des PDF-Stands ohne Vermischung mit aktuellen Follower-/Beitragsdaten implementieren; Integrationstests prüfen V2-Reproduktion und V1-Export mit sachlichem Hinweis auf fehlende Zusatzdaten ohne versteckten Nachabruf.
- [x] 4.3 Speicherumfang und Legacy-/Rollback-Verhalten in der Nutzungs-/Moduldokumentation erläutern; bestehende Speicher-, Lösch- und Exporttests müssen unverändert erfolgreich bleiben.

## 5. PDF-Satz und Dokumentprüfung

- [x] 5.1 Executive Summary und Monatsentwicklung mit lokalen Vektordiagrammen und vollständiger tabellarischer Abdeckung setzen; Text-/Metadatenextraktion und gerasterte Referenzseiten prüfen Hauptkennzahlen, Lücken, laufenden Monat und scharfe Diagramme.
- [x] 5.2 Community-Seite und hochformatgerechte Tabellen für sämtliche Grafikreihen und Referenzwerte mit wiederholten Köpfen setzen; Referenztests mit Follower-Mischquellen, großen Zahlen und langen Beschriftungen prüfen Quellenzuordnung, wechselseitige Titel-/Seitenverweise und lesbare Fortsetzungsseiten statt verkleinerter Schrift.
- [x] 5.3 Top-5-Seite und kompakte Methodik setzen; PDF-Tests prüfen Rangfolge, Auszüge, echte Linkziele, vollständige Definitionen sowie Zusammenführung kurzer/fehlender Abschnitte ohne leere Seiten.
- [x] 5.4 Wiederholbaren PDF-Prüfpfad mit fixierten Fixtures, Fonts und Rasterizer einrichten; Referenzen für vollständigen, laufenden, leeren, unvollständigen und Legacy-Report aufbauen und die Prüfkommandos dokumentieren.
- [x] 5.5 Dokumentzugänglichkeit und Satz manuell prüfen: Lesereihenfolge, verpflichtende vollständige Tabellen für alle Datengrafiken, Graustufen, eingebettete Fonts und keine abgeschnittenen Inhalte; Ergebnis und gegebenenfalls nicht erreichte PDF/UA-Abdeckung dokumentieren.
- [x] 5.6 Automatischen Grafik-/Tabellenabgleich ergänzen; Tests prüfen jede Datenreihe und jeden grafischen Referenzwert nach Zeitraum, Einheit, Wert, Datenlücke und Teilstand und weisen per PDF-Extraktion nach, dass keine Tabellenwerte beim Satz verloren gehen.

## 6. Exportdialog und Vorschau

- [x] 6.1 PDF-Aktion und Dialog mit Titel-/Organisationsgrenzen, Sprache, Lade-/Fehlerzustand und Wiederholung integrieren; Komponententests prüfen Freigabezustände, Eingaben und unveränderte CSV-/TSV-Aktionen.
- [x] 6.2 Vorschau und Direktdownload aus demselben Blob samt mobilem Fallback umsetzen; Tests prüfen passende Metadaten und den Download ohne notwendige Reader-Erweiterung.
- [x] 6.3 Entwertung veralteter Ergebnisse und Freigabe der Blob-URLs implementieren; Tests simulieren Account-/Jahreswechsel, Dialogschluss, erneute Erstellung und verspätete Engine-Antworten.
- [x] 6.4 Desktop-/Mobil-Browserablauf mit Tastatur, Fokus-Rückgabe und A11y-Checks testen; Netzwerkprüfung belegt ausschließlich lokale App-Ressourcen beim Export, keinen Dienstaufruf und keine zusätzliche dauerhafte Speicherung.
- [x] 6.5 README und Screenshot-Dokumentation aktualisieren; versionierte Desktop-/Mobilaufnahmen und ein klar gekennzeichnetes Demo-PDF mit synthetischen Daten relativ verlinken, ohne authentifizierte Live-Abdeckung vorzutäuschen.

## 7. Integrationsfreigabe

- [x] 7.1 `make check` und `make test-browser` ausführen; Regressionen von Report-Laden, gespeicherten Ständen, Accountwechsel, CSV/TSV und PDF-Download ausschließen und Prüfergebnisse festhalten.
- [x] 7.2 Finalen deutschen und englischen Referenzbericht visuell gegen die Executive-Qualitätskriterien prüfen; Zahlen gegen Fixtures abgleichen, Chunk-/Dateigrößen dokumentieren und den Diff auf Scope sowie unberührte Nutzerarbeit prüfen, ohne Push oder Deployment.

## 8. Gewünschte Übernahme der Online-Farblogik

- [x] 8.1 Grün/Orange und relative Intensität der Online-Monatsdiagramme im PDF wiederverwenden, inklusive Legende; Tests prüfen Anstieg, Rückgang, Gleichstand und unveränderte Datenlücken. Demo-PDFs und Rasterreferenzen aktualisieren, Diagrammseite visuell prüfen und lokalen Bericht erneut öffnen.
- [x] 8.2 Follower als fünfte Titelkennzahl und farbige Veränderungsindikatoren ergänzen: Follower/Engagement Januar–Dezember, Reichweite/Interaktionen/Threads als Summen gegen das Vorjahr (laufendes Jahr: gleicher Zeitraum). Vorjahresdaten ausschließlich beim PDF-Start laden und im Snapshot erhalten; Nullnenner, fehlende Werte, Teilstände und Legacy testen. Vergleiche tabellieren und PDF-/Screenshotreferenzen aktualisieren.
- [ ] 8.3 Nach grünen lokalen Prüfungen und Diff-Review den genehmigten GitHub-Pages-Deploy ausführen; Workflow-Ergebnis und Live-Erreichbarkeit prüfen.

## 9. Nachschärfung von Diagrammen und Beitragsdetails

- [x] 9.1 Alle PDF-Diagramme mit gerundeten, beschrifteten Werteachsen und Gitterlinien versehen; große Werte lokalisiert kürzen, den Follower-Stand auf den Jahresbereich vergrößern und als nicht bei null beginnend kennzeichnen. Tests prüfen Achsengrenzen, Tick-Abstände, eindeutige Beschriftungen und die Kennzeichnung; Rasterreferenzen aktualisieren.
- [x] 9.2 Interaktionen der Top-5-Beiträge nach Antworten, Boosts, Likes und Zitaten einzeln ausweisen, ohne die Summenlogik zu ändern; Schema bleibt rückwärtskompatibel, Tests prüfen Aufschlüsselung, Summe und Legacy-Stände.
- [x] 9.3 Tabellenköpfe über Zahlenspalten rechtsbündig setzen, Textspalten linksbündig lassen; Tests prüfen Monats-, Community- und Methodiktabelle und die gerasterte Seite.

## 10. Kopfaktionen, Follower-Veränderungen und Medien

- [x] 10.1 PDF-, Excel- und CSV-Export im Reportkopf bündeln, ohne Aufklappmenü alle Formate direkt sichtbar halten und das Löschen des gespeicherten Stands an dessen Datumszeile verschieben; Komponenten- und Browsertests prüfen Reihenfolge, Erreichbarkeit und mobile Darstellung.
- [x] 10.2 Veränderungen zum Vormonat aus dem effektiven Followerstand berechnen: erfasste Monatsendstände als Nettoveränderung, rekonstruierte Werte mit `~` gekennzeichnet; Snapshot-Feld rückwärtskompatibel ergänzen, Tests und Tabellenfußnote anpassen, Demo-PDF und Screenshot aktualisieren.
- [x] 10.3 Avatar- und Beitragsbild-URLs rückwärtskompatibel im Snapshot ergänzen, sensible beziehungsweise Inhaltswarnungs-Beiträge ausschließen und Medien vor dem Satz als verkleinerte Data-URLs laden; CORS-, Netzwerk- und Größenfehler still auf Initialen beziehungsweise Text zurückfallen lassen. Avatar auf der Titelseite und Beitragsbild in den Top-5-Karten layouten; Fixtures, Fehlerfall und Legacy-Stände testen.
- [x] 10.4 Doku, OpenSpec, Demo-PDFs und Raster-Screenshots auf den neuen Medienstand aktualisieren.
- [x] 10.5 Gespeicherte V2-Stände ohne Bildfelder beim Öffnen best-effort um Avatar und Beitragsbilder ergänzen (Zeitlimit, keine Änderung an Kennzahlen/Texten) und die CSP für den PDF-Kompressionsworker um `worker-src 'self' blob:` erweitern; Browsertest prüft die Data-URL-Pipeline und die tatsächlich eingebetteten Bilder im PDF.
- [ ] 10.6 `make check` und `make test-browser` ausführen, Rastervergleich und mobile Ansicht prüfen sowie den genehmigten Deploy erst nach grünem Ergebnis und Diff-Review ausführen.
