# Design

## Context

`App.svelte` steuert Navigation und OAuth; `FollowerPage.svelte` bietet Accountwahl und Follower-Verlauf. Der öffentliche Statusabruf ist auf vier Seiten begrenzt; die normale Reichweitenanalyse hat eigene Request-Limits. `PostReach.interactions` ist nicht identisch mit der Reportdefinition. Einzelheiten und Motivation stehen im Proposal.

## Goals / Non-Goals

**Goals:** Bericht für einen Account und ein Kalenderjahr mit wiederverwendeter Analyse, sichtbarer Abdeckung und lokalem Export. Bestehende Analyse, OAuth-Sicherheit und Follower-Verlauf erhalten.

**Non-Goals:** Views, Klicks, automatische Hintergrundsammlung, Serverdienst, direkte XLSX-Bearbeitung und Änderung der Reichweitenformel.

## Decisions

- `reports` wird kanonische Navigation, `follower` ein rückwärtskompatibler Alias. Bestehende OAuth-Snapshots und Handshakes werden mitgelesen statt ungültig zu werden.
- Separater Report-Lader paginiert bis zur erforderlichen Kalendergrenze; vorhandene Thread- und Reichweitenlogik wird wiederverwendet. Status- und Booster-Abdeckung werden getrennt verfolgt. Alternative: 80-Thread-Auswahl wiederverwenden; für Jahresberichte ungeeignet.
- Reine Aggregation ordnet Postings nach Startzeit in Europe/Berlin zu. Likes, Boosts, Antworten und verfügbare Quotes werden explizit addiert; `PostReach.interactions` bleibt unverändert. Auf Teilstände und abgeschnittene Threads wird hingewiesen.
- Zeiträume werden als halb offene Grenzen verarbeitet. Mehrteilige Threads an Jahresgrenzen benötigen ausreichenden Kontext; fehlender Kontext wird als unvollständig gekennzeichnet.
- Followerstände sind datierte Beobachtungen; monatliches Netto-Wachstum benötigt vergleichbare Monatsendstände. Follow- und Follow-Request-Benachrichtigungen ersetzen keine Netto-Änderung.
- Dexie/IndexedDB speichert auf ausdrückliche Aktion versionierte, account- und jahresgebundene aggregierte Snapshots und datierte Followerstände, keine Tokens oder Roh-Benachrichtigungen. Alternative flüchtiger Speicher genügt nicht für spätere Monatsvergleiche. Speicherung, Ersetzung und vorhandene Stände sollen transparent sein; die Aktionsleiste bleibt deshalb sichtbar und ein Jahreswechsel lädt automatisch neu.
- Kopieren als TSV, Download als CSV; Tabellenexport neutralisiert gefährliche Formelanführungen. Alternative XLSX-Generierung ist für erste Übertragung nicht erforderlich.
- Die App hält den ausgewählten Account als gemeinsame Auswahl für Analyse und Reports. Ein Snapshot des analysierten Accounts hat Vorrang vor einer abweichenden OAuth-Sitzung; eine Sitzung liefert nur Kennzahlen für exakt diesen Account. Alternative: Reports liest ausschließlich die Sitzung; dann müsste der Accountwechsel die Analyse verdecken.
- Pro Browser-Tab besteht genau eine Instanzverbindung. Ein Wechsel startet einen neuen Login für den gewählten Account und ersetzt die Sitzung erst nach erfolgreicher Verifikation; die alte Sitzung wird anschließend widerrufen. Schlägt der Wechsel fehl, bleibt die bisherige Sitzung nutzbar. Alternative: mehrere Sitzungen parallel; für einen Account-Kontext nicht erforderlich.
- Jedes Monatsdiagramm zeigt zusätzlich den Mittelwert der sichtbaren Monate als gestrichelte violette Linie; der Wert steht rechts oben in der Diagrammkarte statt an der Linie und überdeckt so keine Balken. Fehlende Monate zählen dabei wie im Balken als 0; die Linie nutzt dieselbe Achsenskala wie die Balken. Beim absoluten Follower-Stand entfällt der Mittelwert, weil die Monatsstände dort kaum schwanken und die Linie wenig Aussage hätte; Wachstum, Reichweite und Interaktionen zeigen den Mittelwert als ganze Zahl. Alternative: separater Mittelwert nur in der Tabelle; dort fehlt der visuelle Vergleich.

## Risks / Trade-offs

- [Viele API-Abfragen und teilweise Boosterlisten] → Fortschritt, Abbruch, Budgets und getrennte Abdeckungskennzeichnung.
- [Zähler ändern sich nach Veröffentlichung] → Abrufzeit und gespeicherte Snapshots angeben.
- [Keine historischen Follower-Stichtage] → fehlende Werte offen lassen; keine Rückrechnung aus Follow-Anfragen.
- [Browserdaten gelöscht oder Speicher gesperrt] → klare Fehlermeldung, Export bleibt nutzbar.
- [Modellierte Reichweite ist keine gemessene Personenzahl] → Kennzeichnung in Ansicht und Export.

## Migration Plan

Neue Navigation akzeptiert alte Links und OAuth-Rücksprungdaten; bestehende Browserdaten bleiben unberührt. Rollback erfolgt über Rücknahme des App-Builds; gespeicherte Reportdaten bleiben lokal und werden vom alten Build ignoriert.
