# Spec Delta

## Purpose

Reports lassen sich als hochwertige, eigenständig verständliche PDF-Managementberichte mit FediWings-Kennzahlen, Monatsentwicklung und den fünf reichweitenstärksten Beiträgen lokal exportieren.

## ADDED Requirements

### Requirement: PDF-Aktion und Exportdialog

Das System SHALL zusätzlich zu CSV und Excel-Kopie einen PDF-Export für den ausgewählten Account und das ausgewählte Jahr anbieten. Der Dialog SHALL einen vorbelegten Berichtstitel, einen optionalen Organisationsnamen, Deutsch/Englisch, Vorschau und Download anbieten. Der Ablauf SHALL bei 320 CSS-Pixel Breite und per Tastatur nutzbar sein.

#### Scenario: Verfügbarer Report
- **WHEN** ein Report fertig geladen oder aus einem gespeicherten Stand geöffnet ist
- **THEN** ist der PDF-Export ohne erneutes Speichern verfügbar und übernimmt Account, Jahr und Datenstand.

#### Scenario: Noch kein Report
- **WHEN** kein Report vorliegt oder der Report noch geladen wird
- **THEN** ist die PDF-Aktion deaktiviert und startet keine zusätzliche Analyse.

#### Scenario: Fehler bei PDF-Erstellung
- **WHEN** PDF-Modul, Fonts oder Generierung fehlschlagen
- **THEN** erscheint eine verständliche Meldung mit Wiederholungsmöglichkeit, während Report, CSV und Excel-Kopie unverändert nutzbar bleiben.

### Requirement: Eigenständiger Executive-Bericht

Das PDF SHALL im A4-Hochformat Executive Summary, Monatsentwicklung, Community und Kennzahlentabelle, Top-Beiträge sowie Methodik enthalten. Es SHALL Account, tatsächlichen Berichtszeitraum, Datenstand, Erstellungszeitpunkt, Sprache, Modellversion und Seitenzahlen ausweisen. Die erste Seite SHALL fünf Hauptkennzahlen einschließlich Follower-Stand und höchstens drei datenbasierte Kernaussagen ohne separate Schmuck-Titelseite enthalten.

#### Scenario: Regulärer Jahresreport
- **WHEN** ein vollständiger Report mit Community-Historie und fünf Top-Beiträgen exportiert wird
- **THEN** entsteht ein in der Referenzgestaltung fünfseitiges Dokument mit klarer Lesehierarchie, fünf Hauptkennzahlen und vollständiger Monatstabelle.

#### Scenario: Wenige oder keine Daten
- **WHEN** keine Beiträge oder keine Community-Historie vorliegen
- **THEN** nennt der Bericht den Sachverhalt knapp, erfindet keine Ergebnisse und erzeugt keine leeren Diagramm- oder Schmuckseiten.

### Requirement: Professionelle Dokumentqualität

Das PDF SHALL eingebettete Schriften, auswählbaren und durchsuchbaren Text, scharfe Vektordiagramme mit gerundeten, beschrifteten Werteachsen, funktionierende sichere Links und vollständige Tabellen ohne abgeschnittene Inhalte enthalten. Es SHALL auch in Graustufen verständlich sein, Informationen nicht allein über Farben vermitteln und Dokumenttitel sowie Dokumentsprache setzen.

#### Scenario: Lange Inhalte
- **WHEN** lange Handles, Organisationsnamen, große Zahlen oder lange deutsche Beschriftungen vorkommen
- **THEN** bleiben Seitenränder, Zahlenzuordnung und Lesbarkeit erhalten; kontrollierte Fortsetzungsseiten ersetzen Überläufe und Schriftverkleinerung unter die festgelegte Mindestgröße.

#### Scenario: Diagrammachsen
- **WHEN** ein Diagramm Werte über mehrere Größenordnungen oder einen engen Follower-Bereich zeigt
- **THEN** trägt es eine gerundete, beschriftete Werteachse mit verständlichen Kürzeln; der Follower-Bereich ist vergrößert und als nicht bei null beginnend gekennzeichnet, während die Tabelle alle Absolutwerte nennt.

### Requirement: Vollständige Tabellen für alle Grafiken

Das PDF SHALL jede datenführende Grafik zusätzlich durch eine vollständige Tabelle innerhalb desselben Dokuments ausweisen. Die Tabelle SHALL sämtliche dargestellten Datenreihen, Werte, Zeiträume, Einheiten und Datenlücken enthalten sowie relevante Quellen- und Teilstandkennzeichnungen übernehmen. Dargestellte numerische Referenzwerte, etwa Mittelwerte oder Vergleichswerte, SHALL ebenfalls tabellarisch enthalten sein. Eine Textzusammenfassung SHALL die Tabelle nicht ersetzen.

#### Scenario: Diagramm und Tabelle
- **WHEN** ein Monats-, Community- oder anderes Datendiagramm ausgegeben wird
- **THEN** enthält das PDF eine eindeutig zugeordnete Tabelle aus demselben Datenstand und mit derselben fachlichen Bedeutung; Diagramm und Tabelle verweisen bei räumlicher Trennung mit Titel und Seitenzahl aufeinander.

#### Scenario: Gemeinsame Tabelle
- **WHEN** eine Tabelle mehrere Diagramme abdeckt
- **THEN** sind die zugehörigen Diagrammtitel und sämtliche Datenreihen eindeutig zugeordnet und alle grafisch dargestellten Werte einschließlich Referenzwerten enthalten.

#### Scenario: Datenlücken und laufender Zeitraum
- **WHEN** eine Grafik fehlende, zukünftige, laufende oder unvollständige Monatswerte enthält
- **THEN** unterscheidet auch ihre Tabelle diese Zustände von einem vorhandenen Nullwert und übernimmt die betreffenden Kennzeichnungen.

#### Scenario: Zusätzlicher Platzbedarf
- **WHEN** vollständige Tabellen nicht in das fünfseitige Referenzlayout passen
- **THEN** ergänzt das PDF lesbare Fortsetzungsseiten mit wiederholten Tabellenköpfen, statt Werte wegzulassen oder die Mindestschriftgröße zu unterschreiten.

#### Scenario: Zahlenkolumnen
- **WHEN** eine Tabelle Zahlenspalten enthält
- **THEN** stehen die zugehörigen Überschriften rechtsbündig über den Werten; Textspalten wie Monat oder Quelle bleiben linksbündig.

### Requirement: Farblogik wie in der Online-Version

Die PDF-Monatsdiagramme SHALL die Grün-/Orange-Farblogik der Online-Version mit identischer relativer Intensität übernehmen. Grün SHALL einen höheren oder gleichen Wert, Orange einen niedrigeren Wert zum direkten Vormonat kennzeichnen; die Intensität SHALL sich am größten absoluten Monatsunterschied der betrachteten Reihe orientieren. Eine Legende SHALL die Bedeutung erläutern. Fehlende und zukünftige Werte SHALL weiterhin ohne erfundene Balken und tabellarisch korrekt ausgewiesen bleiben.

#### Scenario: Monatsänderung und Intensität
- **WHEN** eine vollständige Monatsreihe steigt, fällt oder gleich bleibt
- **THEN** stimmen Farbrichtung und relative Intensität mit der Online-Version überein, einschließlich des Januarvergleichs gegen null.

#### Scenario: Datenlücke
- **WHEN** ein Monatswert fehlt oder in der Zukunft liegt
- **THEN** bleibt die entsprechende Stelle im PDF ohne Datenbalken; die Farblogik verändert weder Werte noch Tabellenstatus.

### Requirement: Souveräne und korrekte Redaktion

Der Bericht SHALL Reichweite als fundiert hergeleitete FediWings-Kennzahl darstellen und die kurze methodische Einordnung im Methodikabschnitt bündeln, statt auf jeder Seite allgemeine Warnungen zu wiederholen. Er SHALL die Reichweitensumme als Summe der Thread-Reichweiten, nicht als eindeutige Personenzahl oder gemessene Views, beschreiben. Tatsächliche Datenlücken SHALL bei den betroffenen Werten erkennbar bleiben.

#### Scenario: Vollständige Daten
- **WHEN** vollständige Daten vorliegen
- **THEN** heißen Kennzahl und Kurve „FediWings-Reichweite“ mit Aggregationszusatz „Summe“; es erscheint kein pauschaler Unsicherheitswarnblock.

#### Scenario: Teilstand
- **WHEN** Beiträge, Interaktionszähler oder Reichweitendaten tatsächlich unvollständig erfasst wurden
- **THEN** kennzeichnet der Bericht die betroffenen Kennzahlen als Teilstand und unterdrückt daraus abgeleitete Rang- oder Trendbehauptungen, die Vollständigkeit voraussetzen.

#### Scenario: Methodische Einordnung
- **WHEN** der Methodikabschnitt ausgegeben wird
- **THEN** erläutert er knapp Modellbezug, mögliche Mehrfachkontakte in der Summe, Thread-Zuordnung nach Europe/Berlin und Zählerstand zum Abrufzeitpunkt.

### Requirement: Zahlenkonsistenz und Monatsstatus

Das PDF SHALL vorhandene Report-Aggregate ohne Änderung der Reichweitenformel verwenden. Fehlende Werte SHALL als „—“ statt null erscheinen, zukünftige Monate leer bleiben und laufende Monate gekennzeichnet sein. Engagement SHALL aus den Gesamtsummen berechnet und nicht aus Monatsraten gemittelt werden.

#### Scenario: Vergleich abgeschlossener Monate
- **WHEN** regelbasierte Kernaussagen Monatsvergleiche nennen
- **THEN** werden nur abgeschlossene, vollständig erfasste Monate gleicher Zeitbasis verglichen; bei fehlendem oder nullwertigem Nenner wird keine Prozentveränderung erfunden.

#### Scenario: Unterschiedliche Followerquellen
- **WHEN** Stichtagsdifferenzen, verankerte Followerwerte und Follow-Benachrichtigungen vorliegen
- **THEN** zeigt die gemeinsame Monatstabelle pro Monat genau einen Follower-Zuwachs; Nettoveränderungen aus erfassten Monatsendständen bleiben unmarkiert, rekonstruierte Veränderungen tragen `~`. Kleine Zweitwerte für Follow-Ereignisse oder Datumszahlen entfallen. Tabellenziffern sind gleich breit. Eine gemischte Jahressumme wird nicht als Netto-Wachstum bezeichnet.

### Requirement: Top 5 Beiträge

Das PDF SHALL bis zu fünf öffentliche Threads des Berichtszeitraums nach FediWings-Reichweite absteigend darstellen. Ein Thread SHALL einmal zählen. Bei Gleichstand entscheiden höhere Interaktionssumme, jüngeres Datum und lexikografische Thread-ID. Jeder Eintrag SHALL Rang, Datum, Klartextauszug, Reichweite, Interaktionssumme mit Einzelwerten sowie bei sicherer URL den Original-Link enthalten; ein vorhandenes, unbedenkliches Beitragsbild SHALL zusätzlich erscheinen.

#### Scenario: Rangliste
- **WHEN** mindestens fünf auswertbare öffentliche Threads vorliegen
- **THEN** zeigt das PDF genau die fünf höchstplatzierten mit derselben Interaktionsdefinition wie der Jahresreport, einschließlich Likes, Boosts, Antworten und verfügbarer Quotes, und schlüsselt diese vier Werte je Beitrag einzeln auf.

#### Scenario: Weniger als fünf Threads
- **WHEN** nur ein bis vier öffentliche Threads vorliegen
- **THEN** werden ausschließlich diese Beiträge ohne Platzhalter oder erfundene Beiträge gezeigt.

#### Scenario: Unvollständige Ranggrundlage
- **WHEN** die Beitragshistorie oder Reichweitenanalyse nicht vollständig ist
- **THEN** lautet die Einordnung „Reichweitenstärkste Beiträge im vorliegenden Datenstand“ statt einer uneingeschränkten Top-5-Aussage über das gesamte Jahr.

#### Scenario: Inhaltswarnung und fehlender Link
- **WHEN** ein Beitrag eine Inhaltswarnung hat oder keine sichere Original-URL besitzt
- **THEN** ersetzt die Inhaltswarnung den sensiblen Auszug beziehungsweise entfällt der Link, ohne eine URL zu erfinden.

#### Scenario: Beitragsbild
- **WHEN** ein gelisteter Beitrag ein sicheres Vorschaubild besitzt und weder sensibel noch mit Inhaltswarnung versehen ist
- **THEN** zeigt der Eintrag das Bild neben dem Auszug; bei fehlendem Bild bleibt der Text allein stehen.

### Requirement: Account-Avatar und Medienzugriff

Das PDF SHALL auf der Titelseite den Avatar des berichteten Accounts einbetten, sofern eine sichere Bildquelle vorhanden ist. Ohne nutzbares Bild SHALL eine Initialenfläche erscheinen. Avatar und Beitragsbilder SHALL vor dem Satz als Data-URLs geladen werden; die PDF-Engine SHALL keinen Remote-URL-Zugriff erhalten. Nicht abrufbare oder übergroße Medien SHALL den Export nicht verhindern.

#### Scenario: Avatar nicht verfügbar
- **WHEN** die Bildquelle fehlt, CORS den Abruf verhindert oder der Abruf fehlschlägt
- **THEN** bricht der Export nicht ab, sondern zeigt die Initialen des Anzeigenamens beziehungsweise Handles.

#### Scenario: Kein Remote-Bildzugriff
- **WHEN** das PDF gesetzt wird
- **THEN** enthält es keine aktiven Remote-Bildverweise; Medien sind eingebettet oder entfallen.

### Requirement: Konsistenter und rückwärtskompatibler Exportstand

Vorschau und Download SHALL denselben eingefrorenen Datenstand verwenden. Neu gespeicherte Reports SHALL die zur späteren PDF-Erstellung erforderlichen Exportdaten einschließlich ausgewählter Top-Beiträge lokal erhalten. Alte Reports ohne diese Daten SHALL weiterhin exportierbar bleiben, ohne aktuelle Daten unbemerkt mit historischen Werten zu mischen.

#### Scenario: Geänderte Auswahl
- **WHEN** Account oder Jahr während einer PDF-Erstellung wechseln
- **THEN** wird das bisherige Exportergebnis verworfen und erst ein zur neuen Auswahl gehörender Stand angeboten.

#### Scenario: Alter gespeicherter Report
- **WHEN** ein älterer Report keine Top-Beiträge oder Herkunftsinformationen enthält
- **THEN** exportiert das System die vorhandenen Aggregate, bezeichnet die fehlenden Zusatzdaten sachlich und lädt nur nach ausdrücklicher Live-Aktualisierung einen neuen Reportstand.

#### Scenario: Älterer V2-Stand ohne Medienfelder
- **WHEN** ein gespeicherter V2-Stand noch keine Avatar- oder Beitragsbildfelder enthält und der PDF-Export geöffnet wird
- **THEN** ergänzt das System fehlende Medien einmalig und best-effort aus dem aktuellen Account und der Status-API, ohne Kennzahlen, Texte oder Rangfolge zu verändern; scheitert der Abruf, bleibt der Stand ohne Bild und weiterhin exportierbar.

#### Scenario: Wiederhergestellter neuer Report
- **WHEN** ein neuer gespeicherter Report geöffnet wird
- **THEN** stammen Kennzahlen, Followerdaten und Top-Beiträge aus seinem gespeicherten Exportstand und nicht aus einem späteren API-Abruf.

### Requirement: Lokale und sichere Verarbeitung

Die PDF-Erstellung SHALL ausschließlich im Browser mit lokal ausgelieferten Ressourcen erfolgen und SHALL keine Tokens, Sitzungsschlüssel oder Roh-Benachrichtigungen übernehmen. Fremdtexte SHALL als Klartext behandelt und Linkziele auf sichere HTTP-/HTTPS-Adressen ohne Zugangsdaten beschränkt werden. Ein expliziter PDF-Start SHALL Vorjahresdaten bei Bedarf nachladen dürfen; normaler Seitenaufruf und Rendern SHALL keinen weiteren Abruf auslösen.

#### Scenario: Manipulierter Beitragsinhalt
- **WHEN** Beitragstext oder Organisationsname HTML, Steuerzeichen oder ausführbare Linkschemata enthalten
- **THEN** entstehen weder HTML-Ausführung noch aktive unsichere PDF-Links.

#### Scenario: Explizites Speichern
- **WHEN** nur eine PDF-Vorschau oder ein Download erstellt wird
- **THEN** werden keine neuen Reportdaten dauerhaft gespeichert; dauerhafte Speicherung bleibt an „Report speichern“ gebunden.

#### Scenario: Bedarfsweiser Vorjahresabruf
- **WHEN** ein Live-Report geöffnet und ein PDF-Export gestartet wird
- **THEN** wird das Vorjahr höchstens einmal über die vorhandene Instanzanalyse geladen; vorhandene Vergleichsdaten werden wiederverwendet und das Rendern löst keine weiteren Instanz- oder Dienstabrufe aus.

#### Scenario: Keine Geheimnisse im Dokument
- **WHEN** ein PDF oder Export-Snapshot erzeugt wird
- **THEN** enthalten Dokument, Metadaten und Snapshot weder Tokens noch Sitzungsschlüssel oder Roh-Benachrichtigungen.

### Requirement: Veränderungsindikatoren auf der Titelseite

Die fünf Titelkennzahlen SHALL farbige Veränderungen mit Richtungssymbol und Prozentwert ausweisen, sofern vollständige Ausgangsdaten mit positivem Nenner vorliegen. Reichweite, Interaktionen und Threads SHALL als Jahressummen gegen das Vorjahr verglichen werden, Follower und Engagement dagegen Januar/Dezember. Vergleichsbasis und Zeitraum SHALL erkennbar und alle Werte zusätzlich tabelliert sein.

#### Scenario: Follower und Engagement
- **WHEN** ein abgeschlossenes Berichtsjahr vorliegt
- **THEN** vergleicht die Titelseite Follower und Engagement anhand von Januar und Dezember beziehungsweise dem letzten abgeschlossenen Monat, nicht anhand von Jahressummen.

#### Scenario: Jahressummen
- **WHEN** ein abgeschlossener Jahresreport und vollständige Vorjahresdaten vorliegen
- **THEN** entsprechen die Veränderungen von Reichweite, Interaktionen und Threads jeweils `(Jahressumme − Vorjahressumme) / Vorjahressumme × 100`.

#### Scenario: Teiljahr
- **WHEN** ein laufendes Jahr exportiert wird
- **THEN** reicht der Vorjahreszeitraum bis zum entsprechenden Berliner Datum und Zeitpunkt; der Bericht kennzeichnet YTD und weist beide Zeiträume aus.

#### Scenario: Follower-Stand und fehlende Vergleiche
- **WHEN** aktuelle oder historische Followerdaten vorliegen
- **THEN** zeigt die Titelseite einen datierten, dem Berichtsjahr zugehörigen Stand; fehlende, unvollständige oder nullwertige Ausgangsdaten ergeben „Vergleich nicht verfügbar“ statt einer erfundenen Rate.

#### Scenario: Vorjahr bedarfsgerecht laden
- **WHEN** ein Live-Report geöffnet und erst später der PDF-Export gestartet wird
- **THEN** beginnt der Vorjahresabruf erst beim PDF-Start, zeigt einen Ladezustand und lässt sich durch Schließen abbrechen; ein Fehler verhindert nicht den Export der vorhandenen Werte.
