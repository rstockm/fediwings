# Umsetzungsplan: FediWings Fediverse-Reichweitenanalyse

## 1. Ziel

Es soll eine moderne, interaktive und vollstaendig statische Webanwendung entstehen, mit der die Netto-Reichweite oeffentlicher Beitraege im Fediverse analysiert werden kann.

Die Anwendung wird auf GitHub Pages betrieben und benoetigt in der ersten Ausbaustufe weder Backend noch Datenbank, Benutzerkonto oder OAuth-Authentifizierung. Alle Daten werden bei Bedarf direkt im Browser von der Heimatinstanz des untersuchten Fediverse-Accounts geladen und nur fuer die Dauer der laufenden Browsersitzung verarbeitet.

Das zentrale Ergebnis wird ausdruecklich als **geschaetzte Netto-Reichweite** und nicht als tatsaechlich gemessene Reichweite oder Zahl eindeutiger Personen bezeichnet. Die Brutto-Reichweite wird nur als ergaenzende Obergrenze ausgewiesen. Die unterstuetzten Fediverse-Dienste stellen keine einheitlichen Impressionen, Aufrufe oder verlaesslich deduplizierten Empfaengerzahlen bereit.

## 2. Ziele und Nicht-Ziele

### Ziele

- Eingabe eines vollstaendigen Fediverse-Handles wie `@name@server.example`
- Ermittlung der zustaendigen Fediverse-Instanz
- Anzeige der letzten eigenen Beitraege des Accounts
- Anzeige von Likes, Boosts und der Followerzahl des Autors
- Ermittlung der oeffentlich sichtbaren Booster eines Beitrags
- Verwendung der von der Heimatinstanz bereits gelieferten Followerzahlen der Booster
- Berechnung einer transparent beschriebenen Netto-Reichweite mit ergaenzender Brutto-Obergrenze
- Sichtbare Kennzeichnung unvollstaendiger oder nur teilweise auswertbarer Ergebnisse
- Schonender Umgang mit den APIs der beteiligten Instanzen
- Gute Bedienbarkeit auf Desktop- und Mobilgeraeten
- Vollstaendige statische Auslieferung ueber GitHub Pages

### Nicht-Ziele der ersten Version

- Messung tatsaechlicher Impressionen oder eindeutiger erreichter Personen
- Analyse privater oder nur fuer Follower sichtbarer Beitraege
- Abruf vollstaendiger Followerlisten
- Aufloesung von Ueberschneidungen zwischen Followerkreisen
- Persistente Speicherung von Analysen oder Boosterprofilen
- Historische Followerzahlen zum Zeitpunkt eines Beitrags oder Boosts
- Account-Rankings, Nutzertracking oder serverseitige Telemetrie
- Vollstaendige Beruecksichtigung von Quote-Posts
- Unterstuetzung von Instanzen, die anonymen API-Zugriff vollstaendig deaktiviert haben

## 3. Zielarchitektur

### Technologiestack

- **Svelte 5** fuer die interaktive Benutzeroberflaeche
- **TypeScript** fuer API-Modelle und robuste Anwendungslogik
- **Vite** fuer Entwicklung und statischen Produktionsbuild
- **Zod** fuer die Validierung nicht vertrauenswuerdiger API-Antworten
- **DOMPurify** fuer die sichere Darstellung von HTML-Inhalten aus Beitraegen
- **Vitest** fuer Unit- und Integrationstests
- **Testing Library** fuer komponentennahe Oberflaechentests
- **Playwright** fuer Browser-, Responsive- und GitHub-Pages-Tests
- **ESLint und Prettier** fuer statische Analyse und einheitliche Formatierung
- **GitHub Actions** fuer Build, Tests und Deployment auf GitHub Pages

### Architekturprinzipien

- Die Anwendung ist eine statische Single-Page-Anwendung ohne clientseitigen Router.
- Alle Fediverse-API-Anfragen erfolgen direkt aus dem Browser.
- Alle fuer eine Analyse benoetigten Interaktionsdaten werden von der Heimatinstanz des untersuchten Accounts geladen.
- Boosterprofile werden nicht nochmals von ihren jeweiligen Heimatservern abgefragt.
- Geladene Daten werden nur im Arbeitsspeicher gehalten.
- Der regulaere HTTP-Cache des Browsers darf genutzt werden; es gibt keinen eigenen persistenten Anwendungscache.
- Berechnungslogik, API-Zugriff und Darstellung bleiben voneinander getrennt.
- API-IDs werden immer als undurchsichtige Strings behandelt.

## 4. Datenfluss

### 4.1 Account aufloesen

Die Anwendung erwartet in der ersten Version einen vollstaendigen Handle:

```text
@name@server.example
```

Der Handle wird normalisiert und validiert. Anschliessend wird zuerst versucht, die API direkt auf der Handle-Domain zu erreichen:

```http
GET https://server.example/api/v2/instance
```

Falls Handle-Domain und Web-Domain voneinander abweichen, wird WebFinger als Fallback verwendet:

```http
GET https://server.example/.well-known/webfinger
    ?resource=acct:name@server.example
```

Aus dem `self`-Link der WebFinger-Antwort wird der wahrscheinliche API-Origin abgeleitet. Scheitert auch dieser Zugriff, kann die Anwendung eine erweiterte manuelle Eingabe der Instanzadresse anbieten.

Es werden ausschliesslich HTTPS-Origins ohne eingebettete Zugangsdaten akzeptiert.

### 4.2 Accountdaten laden

Auf der Heimatinstanz wird der Account ueber den oeffentlichen Lookup-Endpunkt geladen:

```http
GET /api/v1/accounts/lookup?acct=name
```

Relevante Felder sind:

- `id`
- `acct`
- `display_name`
- `url`
- `avatar_static`
- `followers_count`
- `hide_collections`

Die Followerzahl des lokalen Accounts stammt direkt von seiner Heimatinstanz.

### 4.3 Beitraege laden

Die letzten eigenen Beitraege werden ueber folgenden Endpunkt geladen:

```http
GET /api/v1/accounts/:id/statuses
    ?limit=20
    &exclude_reblogs=true
```

Die erste Version verwendet standardmaessig 20 Beitraege. Optional kann spaeter eine Auswahl zwischen 10, 20 und 40 Beitraegen angeboten werden.

Eigene Boosts werden ausgeschlossen. Fuer Antworten wird eine Oberflaechenoption vorgesehen:

- Antworten einbeziehen
- Nur eigenstaendige Beitraege und Selbst-Threads analysieren

Relevante Statusfelder sind:

- `id`
- `created_at`
- `url`
- `content`
- `visibility`
- `favourites_count`
- `reblogs_count`
- `replies_count`
- `quotes_count`, falls von der Instanz unterstuetzt

Likes und gemeldete Boosts koennen direkt aus dem Statusobjekt uebernommen werden. Dafuer sind keine zusaetzlichen API-Aufrufe erforderlich.

### 4.4 Booster laden

Nur fuer Beitraege mit `reblogs_count > 0` wird die Liste der oeffentlich sichtbaren Booster geladen:

```http
GET /api/v1/statuses/:id/reblogged_by?limit=80
```

Der Endpunkt liefert vollstaendige Accountobjekte einschliesslich `followers_count`. Diese Followerzahlen sind auf der Heimatinstanz des Autors bereits als foederierte Profildaten vorhanden.

Weitere Seiten werden ausschliesslich ueber den HTTP-Header `Link` mit der Relation `rel="next"` geladen. Vom Client werden keine Cursorwerte selbst konstruiert.

Die Accounts werden seitenweise verarbeitet. Pro Beitrag wird nur eine Menge bereits gesehener stabiler Accountkennungen gehalten, um Doppelzaehlungen zu vermeiden. Nach Abschluss der Aggregation werden die Accountobjekte verworfen.

### 4.5 Ergebnis berechnen

Die Brutto-Reichweite bildet zunaechst die transparente Obergrenze:

```text
Brutto-Reichweite =
  aktuelle Followerzahl des Autors
  + Summe der aktuellen Followerzahlen aller auswertbaren Booster
```

Diese Formel bildet eine geschaetzte Brutto-Reichweite ab und enthaelt insbesondere Ueberschneidungen zwischen den Followerkreisen.

Als zentraler Wert wird daraus die Netto-Reichweite berechnet. Sie uebertraegt die logarithmische Regression aus `INSTAGRAM_REACH_ANALYSE.md` heuristisch auf das Fediverse:

```text
Interaktionen = Likes + Antworten

Netto-Reichweite = min(
  Brutto-Reichweite,
  max(
    0,0165 * Brutto-Reichweite
      * (1 + 2 * Boosts)^0,7314
      * (1 + Interaktionen)^0,2214,
    Likes + Boosts
  )
)
```

Die Brutto-Reichweite ersetzt dabei die Instagram-Followerzahl als konkret ermitteltes Verteilungspotenzial des Autor- und Booster-Netzes. Der Faktor `2 * Boosts` ist eine transparente, aber nicht empirisch mit Fediverse-Impressionsdaten kalibrierte Annahme: Ein Boost wird wegen der chronologisch gepraegten Timeline staerker als ein Instagram-Share gewichtet. Die Deckelung verhindert, dass die Netto-Reichweite das bekannte Brutto-Potenzial uebersteigt.

Zusaetzlich gilt eine harte Untergrenze: Die Netto-Reichweite faellt nie unter die Summe aus Likes und Boosts, weil jede reagierende Person den Beitrag nachweislich gesehen hat. Antworten zaehlen bewusst nicht in diese Untergrenze, da Antworten von Accounts stammen koennen, die den Beitrag nur indirekt sahen.

Likes und Antworten wirken daneben ueber den schwachen Interaktionsexponenten. Beide Reichweitenwerte bleiben Schaetzungen.

Die Formel wird hinter einer kleinen, reinen Schnittstelle gekapselt. Dadurch kann spaeter eine gewichtete Schaetzung ergaenzt werden, ohne API- oder UI-Code umzubauen.

```ts
interface ReachFormula {
  id: string;
  label: string;
  calculate(input: ReachInput): ReachResult;
}
```

## 5. Datenqualitaet

Zu jedem analysierten Beitrag werden mindestens folgende Werte ausgewiesen:

- Follower des Autors
- Likes
- Von der Heimatinstanz gemeldete Boosts
- Anzahl auswertbarer oeffentlicher Booster
- Summe der Follower dieser Booster
- Geschaetzte Netto-Reichweite als Hauptwert
- Brutto-Reichweite als ergaenzende Obergrenze
- Status der Datenabdeckung

Beispiel:

```text
Gemeldete Boosts: 35
Auswertbare oeffentliche Booster: 31
Nicht zuordenbare Boosts: mindestens 4
Geschaetzte Netto-Reichweite: ca. 12.100
Brutto-Reichweite: ca. 12.400
Likes: 76
```

Die Differenz zwischen `reblogs_count` und der Zahl geladener Booster kann unter anderem durch private Boosts, Moderation, geloeschte oder gesperrte Accounts sowie Federationseinschraenkungen entstehen.

### Follower-Cache

Mastodon uebernimmt bei der Verarbeitung fremder Profile den Wert `totalItems` der ActivityPub-Follower-Collection als `followers_count`. Im Mastodon-Quellcode ist fuer fremde Profile ein Hintergrund-Aktualisierungsintervall von etwa einer Woche mit zusaetzlicher zufaelliger Verzoegerung vorgesehen.

Das ist keine garantierte maximale Datenalterung. Die REST-API liefert keinen Zeitstempel der letzten Profilaktualisierung. Die Anwendung darf daher kein exaktes Alter behaupten, kann den Wert aber als hinreichend aktuelle foederierte Schaetzung verwenden.

### Bekannte Unschaerfen

- Followerkreise von Autor und Boostern koennen sich stark ueberschneiden.
- Followerzahlen beziehen sich auf den Analysezeitpunkt, nicht auf den Zeitpunkt des Beitrags.
- Nicht jeder Follower sieht oder liest einen zugestellten Beitrag.
- Stummschaltungen, Filter und Domainblocks sind unbekannt.
- Federation kann verspaetet sein oder fehlschlagen.
- Likes sind keine zusaetzliche Ausspielung.
- Die Netto-Formel wurde aus Instagram-Story-Daten abgeleitet und nicht gegen echte Fediverse-Impressionsdaten validiert.
- Die doppelte Boost-Gewichtung ist eine Produkthypothese, keine gemessene Plattformkonstante.
- Quote-Posts koennen zwar als Zaehler vorhanden sein, ihre Autorenliste erfordert bei aktuellen Mastodon-Versionen einen User-Token.
- Andere Fediverse-Implementierungen koennen Mastodon-Endpunkte oder Felder abweichend implementieren.

## 6. Good-Fediverse-Citizen

Die Anwendung minimiert Last und Datenverarbeitung durch folgende verbindliche Regeln:

- Eine Analyse startet nur nach einer ausdruecklichen Benutzeraktion.
- Standardmaessig werden hoechstens 20 Beitraege geladen.
- Es laufen maximal zwei API-Aufrufe gleichzeitig.
- Beitraege ohne Boosts verursachen keinen `reblogged_by`-Aufruf.
- Ergebnisse werden progressiv dargestellt; es wird nicht auf den letzten Request gewartet.
- Dieselbe URL wird innerhalb einer Analyse nicht mehrfach geladen.
- Der native Browsercache wird nicht durch Cache-Buster umgangen.
- Pagination folgt dem vom Server gelieferten `Link`-Header.
- `X-RateLimit-Remaining`, `X-RateLimit-Limit` und `X-RateLimit-Reset` werden ausgewertet.
- Bei HTTP `429` pausiert die Queue bis zum gemeldeten Reset-Zeitpunkt.
- Bei wiederholten Netzwerkfehlern wird nicht aggressiv neu angefragt.
- Eine laufende Analyse kann jederzeit ueber `AbortController` beendet werden.
- Bei sehr grossen Beitraegen darf die Analyse als Teilergebnis beendet werden.
- Es werden keine Followerlisten geladen.
- Es werden keine separaten Profilanfragen an die Heimatserver der Booster gesendet.
- Boosteridentitaeten werden nicht persistiert, fuer Rankings genutzt oder exportiert.
- Es gibt keine automatische Hintergrundaktualisierung.
- Es gibt kein Tracking und keine externen Analysedienste.

Der Mastodon-Standardwert von 300 API-Aufrufen in fuenf Minuten pro IP-Adresse wird nur als Ausgangswert betrachtet. Die Anwendung verlaesst sich auf die tatsaechlich gelieferten Rate-Limit-Header.

Eine typische Analyse mit 20 Beitraegen und hoechstens einer Booster-Seite pro Beitrag benoetigt ungefaehr:

```text
1 Instanzpruefung
1 Account-Lookup
1 Beitragsliste
bis zu 20 Booster-Abfragen
= maximal etwa 23 Requests
```

## 7. Zustandsmodell

Die Anwendung verwendet explizite Analysezustaende:

- `idle`: Noch keine Eingabe verarbeitet
- `resolving`: Handle und Instanz werden aufgeloest
- `account-ready`: Account und Beitraege sind geladen
- `analyzing`: Booster werden geladen und aggregiert
- `rate-limited`: Die Queue wartet auf den Reset
- `partial`: Ein verwertbares, aber unvollstaendiges Ergebnis liegt vor
- `complete`: Alle vorgesehenen Seiten wurden verarbeitet
- `cancelled`: Die Analyse wurde durch den Benutzer beendet
- `error`: Die Analyse konnte nicht verwertbar gestartet oder fortgesetzt werden

Fehler werden fachlich unterschieden und nicht nur als generische Netzwerkfehler angezeigt:

- Handle ungueltig
- Instanz nicht erreichbar
- Kein Mastodon-kompatibler API-Endpunkt
- Anonymer API-Zugriff deaktiviert
- Account nicht gefunden
- CORS-Zugriff nicht erlaubt
- Rate Limit erreicht
- Antwortformat ungueltig
- Analyse teilweise fehlgeschlagen

Bereits berechnete Teilergebnisse bleiben bei spaeteren Fehlern sichtbar.

## 8. Oberflaechenkonzept

### Visuelle Richtung

Die Anwendung soll wie ein eigenstaendiges, redaktionelles Analysewerkzeug wirken und nicht wie ein generisches Admin-Dashboard.

- Dunkle, ruhige Grundflaeche
- Helle, klar abgegrenzte Analyseflaechen
- Eine kraeftige Akzentfarbe mit Bezug zum Fediverse
- Tabellarische Ziffern fuer Zaehler und Reichweitenwerte
- Horizontale Reichweitenindikatoren statt dekorativer Tortendiagramme
- Klare typografische Hierarchie und grosszuegige Abstaende
- Gebuendelte, lokal ausgelieferte Schriftdateien oder ein hochwertiger System-Font-Stack
- Keine zur Laufzeit geladenen Drittanbieter-Fonts

### Hauptbereiche

1. **Accountsuche** mit Handle-Eingabe und kurzer Datenschutzerklaerung
2. **Accountkopf** mit Avatar, Handle und aktueller Followerzahl
3. **Analyseoptionen** fuer Beitragszahl und Antworten
4. **Gesamtstatus** mit Fortschritt, Requestbudget und Abbruchaktion
5. **Beitragsliste** mit Inhalt, Datum, Likes, Boosts und geschaetzter Reichweite
6. **Methodenhinweis** mit Formel, Unschaerfen und Abdeckungsstatus

### Interaktion

- Beitraege erscheinen sofort nach dem ersten API-Aufruf.
- Reichweitenwerte werden pro Beitrag aktualisiert, sobald Booster-Seiten verarbeitet wurden.
- Sortieroptionen: Datum, Likes, Boosts und Reichweite.
- Detailinformationen werden per aufklappbarem Bereich angeboten.
- Ein laufender Fortschrittsindikator zeigt analysierte Beitraege und geladene Booster-Seiten.
- Sehr grosse Zaehler werden lokalisiert und lesbar formatiert.
- Fehler einzelner Beitraege blockieren nicht die restliche Analyse.

### Responsive Verhalten

- Auf Desktop wird eine kompakte, tabellenaehnliche Beitragsliste verwendet.
- Auf Mobilgeraeten werden dieselben Informationen als gut lesbare Karten angeordnet.
- Primaeraktionen bleiben auch bei langen Analysen erreichbar.
- Es gibt keine horizontalen Pflicht-Scrollbereiche.

### Barrierefreiheit

- Vollstaendige Tastaturbedienung
- Sichtbare Fokusmarkierungen
- Semantische Formulare, Tabellen und Fortschrittsanzeigen
- Ausreichende Farbkontraste
- Statusaktualisierungen ueber zurueckhaltende ARIA-Live-Regionen
- Keine ausschliesslich farbliche Kennzeichnung von Datenqualitaet
- Animationen werden bei `prefers-reduced-motion` reduziert oder deaktiviert
- Statusinhalte werden vor der Darstellung sanitisiert

## 9. Geplante Projektstruktur

```text
.github/
  workflows/
    deploy.yml
src/
  components/
    AccountHeader.svelte
    AccountSearch.svelte
    AnalysisProgress.svelte
    PostCard.svelte
    ReachSummary.svelte
  lib/
    analysis.ts
    handle.ts
    mastodon.ts
    pagination.ts
    reach.ts
    schemas.ts
    types.ts
  App.svelte
  app.css
  main.ts
index.html
package.json
tsconfig.json
vite.config.ts
README.md
UMSETZUNGSPLAN.md
```

Die Struktur soll klein bleiben. Weitere Komponenten oder Hilfsdateien werden nur angelegt, wenn sie eine klar getrennte Verantwortung besitzen oder mehrfach verwendet werden.

## 10. Module und Verantwortlichkeiten

### `handle.ts`

- Handle normalisieren
- Benutzername und Domain validieren
- Direkten API-Origin bestimmen
- WebFinger-Fallback ausfuehren
- Ausschliesslich sichere HTTPS-Origins zurueckgeben

### `mastodon.ts`

- GET-Anfragen an die Mastodon-REST-API
- JSON-Antworten validieren
- HTTP-Fehler in fachliche Fehler ueberfuehren
- Rate-Limit-Header auslesen
- `AbortSignal` durchreichen

### `pagination.ts`

- `Link`-Header robust auswerten
- Ausschliesslich `rel="next"` verfolgen
- Zirkulaere oder fremde Pagination-Links ablehnen
- Request- und Seitenlimits durchsetzen

### `analysis.ts`

- Analyse-Queue mit maximal zwei parallelen Anfragen
- Progressive Verarbeitung der Beitraege
- Pause und Fortsetzung bei Rate Limits
- Abbruch laufender Requests
- Aggregation und Verwerfen transienter Boosterprofile

### `reach.ts`

- Reine, testbare Reichweitenformeln
- Abdeckungsstatus berechnen
- Zahlen fuer die Darstellung vorbereiten
- Spaetere gewichtete Formel ermoeglichen

### `schemas.ts`

- Minimale Zod-Schemas fuer verwendete API-Felder
- Toleranz gegen zusaetzliche Felder neuer Mastodon-Versionen
- Klare Fehler bei fehlenden Pflichtfeldern

## 11. Sicherheit und Datenschutz

- Alle eingegebenen Domains und abgeleiteten URLs werden validiert.
- Es werden keine HTTP-URLs oder URLs mit eingebetteten Zugangsdaten akzeptiert.
- Pagination darf den bestaetigten API-Origin nicht unbemerkt verlassen.
- Status-HTML wird mit einer engen Allowlist sanitisiert.
- API-IDs werden nicht in JavaScript-Zahlen umgewandelt.
- Es werden keine Tokens, Secrets oder Client-Credentials in den Build aufgenommen.
- Boosteraccounts werden nur fuer die Aggregation im Arbeitsspeicher gehalten.
- Es gibt kein `localStorage`, IndexedDB, Cookies oder Service-Worker-Datencache fuer Analysedaten.
- Es werden keine Nutzereingaben oder Ergebnisse an GitHub, Analyseanbieter oder andere Drittanbieter uebertragen.
- Die Dokumentation weist darauf hin, dass GitHub Pages als Hostinganbieter technisch eigene Zugriffslogs fuehren kann.

## 12. GitHub-Pages-Deployment

Vite wird so konfiguriert, dass Assets sowohl unter einer Projektseite als auch spaeter unter einer eigenen Domain funktionieren koennen.

Fuer eine Projektseite wird der Repository-Name als `base` verwendet. Die Build-Konfiguration liest den Wert aus einer Umgebungsvariable, damit lokale Entwicklung und Deployment denselben Buildpfad verwenden koennen.

Der GitHub-Actions-Workflow fuehrt folgende Schritte aus:

1. Repository auschecken
2. Aktuelle LTS-Version von Node.js einrichten
3. Abhaengigkeiten reproduzierbar mit `npm ci` installieren
4. Linting und Typecheck ausfuehren
5. Unit- und Integrationstests ausfuehren
6. Produktionsbuild erzeugen
7. Buildartefakt mit `actions/upload-pages-artifact` bereitstellen
8. Mit `actions/deploy-pages` auf GitHub Pages deployen

Da kein clientseitiger Router verwendet wird, ist keine spezielle `404.html`-Weiterleitung erforderlich.

## 13. Teststrategie

### Unit-Tests

- Normalisierung gueltiger Handles
- Ablehnung ungueltiger oder unsicherer Domains
- WebFinger-Auswertung
- `Link`-Header mit einer und mehreren Relationen
- Reichweitenformel
- Abdeckungsberechnung
- Zahlenformatierung
- Auswertung der Rate-Limit-Header

### Integrationstests mit gemockter API

- Account ohne Beitraege
- Beitrag ohne Likes oder Boosts
- Beitrag mit weniger als 80 Boostern
- Beitrag mit mehreren Booster-Seiten
- Abweichung zwischen `reblogs_count` und geladenen Accounts
- Doppelte Accounts ueber mehrere Seiten
- Private oder nicht auflistbare Boosts
- HTTP `401`, `404` und `429`
- Ungueltiges JSON oder fehlende Pflichtfelder
- CORS- und Netzwerkfehler
- Pause bis zum Rate-Limit-Reset
- Abbruch einer laufenden Analyse
- Teilergebnis nach Fehler eines einzelnen Beitrags

### Komponenten- und Accessibility-Tests

- Formularbedienung per Tastatur
- Fokusmanagement bei Fehlern
- Progressive Ergebnisaktualisierung
- Statusmeldungen fuer Screenreader
- Darstellung partieller Ergebnisse
- Reduzierte Bewegung

### Browser-Tests

- Desktop- und Mobilansicht
- Produktionsbuild unter einem GitHub-Pages-Unterpfad
- Direkter Seitenaufruf ohne Router-Fehler
- Analyse mit komplett gemockten API-Antworten
- Abbruch und Neustart einer Analyse

Automatisierte Tests greifen nicht auf echte Fediverse-Instanzen zu. Live-Smoke-Tests werden manuell und mit wenigen Requests gegen ausgewaehlte Instanzen durchgefuehrt.

## 14. Umsetzungsschritte

### Phase 1: Projektgrundlage

- Svelte-5-Projekt mit Vite und TypeScript initialisieren
- ESLint, Prettier, Vitest und Playwright einrichten
- Basispfad fuer GitHub Pages konfigurieren
- Grundlegende Designvariablen und responsive Layoutstruktur erstellen

### Phase 2: API-Grundlage

- Handle-Parser implementieren
- Direkte Instanzpruefung implementieren
- WebFinger-Fallback implementieren
- Minimale API-Schemas definieren
- Account- und Statusabruf implementieren

### Phase 3: Analyse-Engine

- `reblogged_by`-Pagination implementieren
- Request-Queue mit Parallelitaetslimit entwickeln
- Rate-Limit-Steuerung ergaenzen
- Abbruch und Teilergebnisse implementieren
- Netto-Reichweitenformel, Brutto-Obergrenze und Abdeckungsstatus implementieren

### Phase 4: Benutzeroberflaeche

- Accountsuche und Validierungsfeedback erstellen
- Accountkopf und Analyseoptionen umsetzen
- Progressive Beitragsliste entwickeln
- Fortschritt, Rate-Limit-Pause und Abbruch darstellen
- Methoden- und Unschaerfehinweise integrieren
- Responsive und barrierefreie Darstellung fertigstellen

### Phase 5: Qualitaet

- Unit- und Integrationstests vervollstaendigen
- Browser- und Accessibility-Tests ausfuehren
- Fehlertexte und leere Zustaende pruefen
- Produktionsbuild auf Bundlegroesse und Netzwerkanfragen kontrollieren
- Manuelle Smoke-Tests gegen mehrere Fediverse-Instanzen durchfuehren

### Phase 6: Deployment und Dokumentation

- GitHub-Actions-Workflow einrichten
- GitHub Pages konfigurieren
- README mit lokaler Entwicklung, Build und Deployment ergaenzen
- Datenschutz und methodische Grenzen dokumentieren
- Live-Deployment pruefen

## 15. Abnahmekriterien

Die erste Version gilt als fertig, wenn alle folgenden Kriterien erfuellt sind:

- Die Anwendung wird erfolgreich als statische GitHub-Pages-Seite ausgeliefert.
- Ein oeffentlicher Account auf einem unterstuetzten Fediverse-Server kann ohne Anmeldung analysiert werden.
- Die letzten eigenen Beitraege werden korrekt geladen und eigene Boosts ausgeschlossen.
- Likes und gemeldete Boosts werden direkt aus den Statusobjekten angezeigt.
- Oeffentliche Booster werden vollstaendig oder klar als Teilergebnis paginiert verarbeitet.
- Die bereits gelieferten Followerzahlen der Booster werden ohne zusaetzliche Heimatserverabfragen aggregiert.
- Das Ergebnis wird als geschaetzte Netto-Reichweite und nicht als tatsaechlich gemessene Reichweite bezeichnet; die Brutto-Reichweite bleibt ergaenzend.
- Abweichungen zwischen gemeldeten und auswertbaren Boosts sind sichtbar.
- Eine typische Analyse mit 20 Beitraegen bleibt deutlich unter dem Standardlimit der Instanz.
- HTTP `429` fuehrt zu einer kontrollierten Pause.
- Eine laufende Analyse kann abgebrochen werden.
- Fehler einzelner Beitraege verhindern nicht die Anzeige anderer Ergebnisse.
- Es werden keine Analysedaten persistent gespeichert.
- Die Anwendung funktioniert auf aktuellen Desktop- und Mobilbrowsern.
- Tastaturbedienung, Fokusdarstellung und reduzierte Bewegung funktionieren.
- Linting, Typecheck, Tests und Produktionsbuild laufen erfolgreich durch.

## 16. Spaetere Ausbaustufen

Moegliche Erweiterungen werden erst nach Bewertung des statischen MVP umgesetzt:

- Gewichtete Reichweitenformeln
- Vergleich mehrerer eigener Beitraege oder Zeitraeume
- Export einer rein aggregierten Analyse als CSV oder Bild
- Optionale lokale Speicherung ausdruecklich durch den Benutzer
- Beruecksichtigung von Quote-Posts mit passendem User-Token
- Eigene kleine Middleware nur fuer Instanzen mit erzwungener Authentifizierung

Umgesetzt ist inzwischen der Follower-Verlauf im eigenen Tab „Follower“ (ADR-0003): OAuth mit PKCE und minimalem Scope `read:notifications`, Token nur im Arbeitsspeicher, Rueckkehr im gleichen Tab. Der Verlauf baut aus Follow-Benachrichtigungen zwei Kurven (neue Follower pro Monat, kumuliert am aktuellen Stand verankert). Unfollows und geloeschte Benachrichtigungen sind nicht sichtbar und werden ausgewiesen. Das restliche OAuth-Potenzial (private eigene Beitraege) bleibt eine spaetere Ausbaustufe.

Eine Middleware soll nur eingefuehrt werden, wenn ein konkreter Anwendungsfall nicht sicher und instanzschonend im Browser geloest werden kann.

### PeerTube-Modul (geplant)

PeerTube bleibt ein eigenes spaeteres Modul und wird nicht in die bestehende Analyse eingepresst: Videos foederieren nicht als boostbare Statuses, und die PeerTube-API liefert mit gemessenen Video-Views erstmals echte Impressions statt Schaetzwerte. Das Modul wird eine eigene Sicht (Handle → Videos mit Views, Likes, Kommentaren) und ein eigenes Methodik-Kapitel benoetigen. Die bestehende Fediverse-Beitragsanalyse bleibt davon unberuehrt.

Umgesetzt ist inzwischen die Basis-Unterstuetzung verschiedener Fediverse-Server: FediWings erkennt ueber NodeInfo die Server-Software und unterstuetzt Mastodon-API-kompatible Implementierungen direkt (Mastodon, Pixelfed, Pleroma, Akkoma, GoToSocial, Friendica, Glitch-Soc, Hometown). Server ohne oeffentliche Booster-Liste liefern ein gekennzeichnetes Teilergebnis statt eines Fehlers.

## 17. Referenzen

- [Mastodon Accounts API](https://docs.joinmastodon.org/methods/accounts/)
- [Mastodon Statuses API](https://docs.joinmastodon.org/methods/statuses/)
- [Mastodon Account Entity](https://docs.joinmastodon.org/entities/Account/)
- [Mastodon Status Entity](https://docs.joinmastodon.org/entities/Status/)
- [Mastodon API Guidelines](https://docs.joinmastodon.org/api/guidelines/)
- [Mastodon Rate Limits](https://docs.joinmastodon.org/api/rate-limits/)
- [Mastodon CORS-Konfiguration](https://github.com/mastodon/mastodon/blob/main/config/initializers/cors.rb)
- [ActivityPub W3C Recommendation](https://www.w3.org/TR/activitypub/)
