# Spec: Dynamische Social Preview Cards

- Status: Entwurf
- Datum: 2026-09-10
- Betroffene Projekte: FediWings Static App und neuer FediWings Card Service
- Risikostufe: Riskant, da ein externer Laufzeitdienst, Persistenz und ein neues Deployment eingeführt werden
- Verantwortlich: Projektverantwortlicher

## 1. Ziel

Geteilte FediWings-Analysen sollen im Fediverse und auf anderen Diensten eine individuelle Link-Vorschau anzeigen. Die Vorschau bildet den Stand zum Zeitpunkt des Teilens ab und zeigt mindestens:

- Accountbild des Beitragsautors
- Anzeigename und vollständigen föderierten Handle
- Netto-Reichweite als zentralen Wert
- Likes und Boosts
- einen Textanriss des Beitrags
- bei normalen Posts ein vorhandenes Beitragsbild als Thumbnail
- den Analysezeitpunkt
- FediWings-Branding

Der bestehende FediWings-Dienst bleibt eine statische Svelte-App auf GitHub Pages. Individuelle OpenGraph-Metadaten und Vorschaubilder liefert eine separate Django Service App auf Cloudron.

## 2. Ausgangslage

Aktuelle Share-Links verwenden ein URL-Fragment:

```text
https://<github-pages>/#share=<kodierte-post-url>
```

Das Fragment wird bei HTTP-Anfragen nicht an den Server übertragen. Social-Preview-Crawler erhalten deshalb immer dasselbe statische `index.html` und können weder den geteilten Beitrag noch seine Kennzahlen erkennen. Die clientseitige Aktualisierung des Dokumenttitels reicht nicht aus, weil die relevanten Crawler JavaScript typischerweise nicht ausführen.

Der aktuelle Share-Link enthält außerdem nur die Original-Post-URL. Kennzahlen, Accountdaten und Analysezeit werden beim späteren Öffnen neu geladen und sind kein Snapshot.

## 3. Verbindliche Entscheidungen

1. FediWings bleibt eine Static App auf GitHub Pages.
2. Der Card Service wird als separates Projekt mit dem Service-App-Profil umgesetzt.
3. Der Card Service verwendet Python, Django, Django Templates, SQLite, Pillow und Cloudron.
4. Die Share-URL verweist auf eine serverseitig gerenderte Snapshot-Landingpage des Card Service.
5. Die Landingpage leitet nicht automatisch weiter. Sie enthält einen klaren Link zur aktuellen Live-Analyse auf GitHub Pages.
6. Die vom Browser berechneten Kennzahlen werden pragmatisch übernommen und nicht serverseitig neu berechnet.
7. Der Dienst validiert Schema, Wertebereiche und fachliche Grundinvarianten, garantiert aber keine kryptografische Herkunft der Kennzahlen.
8. Accountbild und optionales Thumbnail werden beim Erstellen geladen und in eine fertige PNG gerendert.
9. Heruntergeladene Ausgangsbilder werden nicht dauerhaft gespeichert.
10. Posts mit Content Warning oder als sensibel markierten Medien zeigen weder Thumbnail noch verborgenen Text.
11. Auf Card und Snapshot-Landingpage werden keine relativierenden Begriffe wie „geschätzt“, „Näherung“ oder „Modellschätzung“ verwendet.
12. Bestehende fragmentbasierte Share-Links bleiben gültig und dienen bei Ausfall des Card Service als Fallback.
13. Statische, pro Share neu erzeugte GitHub-Pages-Builds werden verworfen. Diese Alternative ist für einen unmittelbaren anonymen Share-Flow zu langsam und benötigt einen sicheren Schreibzugriff auf das Repository.

## 4. Nicht-Ziele

- keine Migration der gesamten FediWings-App nach Cloudron
- keine serverseitige Neuberechnung der Reichweite
- keine Übernahme vollständiger Boosterlisten in den Card Service
- keine Speicherung des vollständigen Beitrags-HTML
- keine Archivierung der heruntergeladenen Avatar- oder Beitragsbilder
- keine automatische Aktualisierung einer bereits veröffentlichten Card
- keine Bot-Erkennung oder User-Agent-basierte Weiterleitung
- keine garantierte Kontrolle über externe Social-Media-Caches
- keine Preview Cards für den Follower-Verlauf in dieser Ausbaustufe

## 5. Systemarchitektur

```text
Fediverse-Instanz
       |
       | bestehende anonyme Browseranalyse
       v
FediWings auf GitHub Pages
       |
       | POST eines kleinen öffentlichen Snapshots
       v
FediWings Card Service auf Cloudron
       |                       |
       | SQLite                | fertige PNG unter /app/data/cards
       v                       v
Snapshot-Landingpage <---- OpenGraph- und Twitter-Card-Crawler
       |
       | „Aktuelle Analyse öffnen“
       v
GitHub-Pages-Ansicht #share=<post-url>
```

Die Projekte bleiben fachlich gekoppelt, aber technisch getrennt:

- FediWings behält das Static-App-Profil.
- Der Card Service erhält das Service-App-Profil.
- Die Schnittstelle wird versioniert und in beiden Projekten dokumentiert.
- Der Card Service kennt die öffentliche FediWings-Basis-URL aus seiner Laufzeitkonfiguration und übernimmt keine frei wählbare Redirect-URL vom Client.

## 6. Nutzerablauf

1. Eine Analyse ist für einen Post oder Thread abgeschlossen oder als Teilergebnis verfügbar.
2. Die Person aktiviert „Beitrag teilen“.
3. Ein modaler Share-Dialog öffnet sich sofort und startet die Card-Erstellung.
4. FediWings fordert einen kurzlebigen Request-Token vom Card Service an.
5. FediWings sendet den validierten Snapshot mit einer Idempotency-ID an den Card Service.
6. Der Dienst lädt das Accountbild und, sofern zulässig, das erste geeignete Beitragsbild.
7. Der Dienst rendert eine PNG mit 1200 × 630 Pixeln, speichert Snapshot und PNG und antwortet mit der öffentlichen Share-URL.
8. Der Dialog zeigt die Card-Vorschau und die Aktionen „Teilen“ und „Link kopieren“.
9. „Teilen“ ruft `navigator.share()` direkt aus einer erneuten Nutzeraktion auf.
10. Ist Web Share nicht verfügbar, wird der Link kopiert.
11. Schlägt die Card-Erstellung fehl, bietet der Dialog den bisherigen direkten GitHub-Pages-Link an.

Der Dialog vermeidet, dass die für `navigator.share()` notwendige transiente Nutzeraktivierung während eines längeren Netzwerkaufrufs verloren geht.

## 7. Snapshot-Vertrag

### 7.1 Anfrage

`POST /api/v1/cards/`

```json
{
  "version": 1,
  "sourceUrl": "https://openbiblio.social/@zlb_berlin/117224140235899609",
  "account": {
    "url": "https://openbiblio.social/@zlb_berlin",
    "displayName": "ZLB Berlin",
    "handle": "@zlb_berlin@openbiblio.social",
    "avatarUrl": "https://openbiblio.social/system/accounts/avatars/.../original/example.png"
  },
  "content": {
    "excerpt": "Ein kurzer bereinigter Textanriss des Beitrags …",
    "thumbnailUrl": "https://openbiblio.social/system/media_attachments/files/.../small/example.jpg",
    "contentWarning": "",
    "sensitive": false
  },
  "metrics": {
    "netReach": 12450,
    "grossReach": 18200,
    "likes": 126,
    "boosts": 34
  },
  "analysisState": "complete",
  "analyzedAt": "2026-09-10T18:45:00.000Z",
  "algorithmVersion": "net-reach-v1"
}
```

Zusätzliche Header:

```text
Content-Type: application/json
Origin: https://<github-pages-origin>
X-FediWings-Token: <kurzlebiger-origin-gebundener-token>
Idempotency-Key: <uuid>
```

### 7.2 Antwort

Status `201 Created`, bei idempotenter Wiederholung `200 OK`:

```json
{
  "id": "7Yp2mK9q",
  "url": "https://<cloudron-app-domain>/s/7Yp2mK9q/",
  "imageUrl": "https://<cloudron-app-domain>/s/7Yp2mK9q/card.png",
  "createdAt": "2026-09-10T18:45:03.000Z"
}
```

### 7.3 Grenzen

Initiale, über Umgebungsvariablen anpassbare Grenzen:

| Eingabe | Grenze |
| --- | ---: |
| JSON-Request | 16 KiB |
| Anzeigename | 100 Zeichen |
| Handle | 255 Zeichen |
| Textanriss | 280 Zeichen |
| Content Warning | 200 Zeichen |
| URL | 2.048 Zeichen |
| Avatar-Download | 5 MiB |
| Thumbnail-Download | 10 MiB |
| dekodierte Bildfläche | 20 Megapixel |
| Download-Timeout | 5 Sekunden |
| Redirects pro Bild | 2 |
| Card-Erstellungen | initial 20 pro Stunde und Client-IP |

Zahlen sind nichtnegativ und ganzzahlig. `netReach` darf `grossReach` nicht überschreiten. Zulässige Analysezustände sind `complete` und `partial`.

## 8. Inhaltserzeugung in FediWings

FediWings erzeugt den Snapshot aus bereits vorhandenen Daten:

- `account` liefert Anzeigename, Account-URL und Avatar.
- Der vollständige Handle wird als `@username@hostname` gebildet, falls `account.acct` keine Domain enthält.
- `PostReach` liefert Netto-Reichweite, Brutto-Reichweite, Likes, Boosts und Thumbnail.
- Ein neuer Analysezeitpunkt wird beim Abschluss der Analyse gespeichert und für alle daraus erzeugten Cards verwendet.
- Der Textanriss entsteht im Browser aus dem Post-HTML als reiner Text.
- Whitespace wird zusammengezogen und der Text auf 280 Zeichen begrenzt.
- Alt-Texte von Custom-Emoji-Bildern sollen beim Konvertieren erhalten bleiben.
- Rohes HTML wird nicht an den Card Service übertragen.

Das Statusschema wird um das von den unterstützten Fediverse-APIs gelieferte Feld `sensitive` ergänzt. Bei `sensitive: true` oder einer nichtleeren `spoiler_text` gilt:

- `thumbnailUrl` wird nicht übertragen.
- `excerpt` enthält ausschließlich `CW: <spoiler_text>`.
- Fehlt ein CW-Text, wird `Sensibler Inhalt` verwendet.

## 9. Card-Layout

Die Card wird als PNG mit 1200 × 630 Pixeln erzeugt. Verwendet werden die bestehenden FediWings-Farben:

- Hintergrund: `#17181b`
- Haupttext: `#f3f0e8`
- Lime-Akzent: `#c7f36b`
- Violett-Akzent: `#8b7cff`

Eine lizenzierte Schrift wird mit dem Service gebündelt, damit das Rendering unabhängig vom Basis-Image reproduzierbar bleibt.

### 9.1 Variante mit Thumbnail

- rechte Bildfläche mit ungefähr 40 Prozent der Card-Breite
- zugeschnittenes Thumbnail mit `cover`-Semantik
- Accountbild als runder Avatar links oben
- Anzeigename und vollständiger Handle neben dem Avatar
- große Reichweitenzahl in Lime
- Bezeichnung `Netto-Reichweite`
- Textanriss mit maximal drei Zeilen
- Likes, Boosts und Analysezeitpunkt im unteren Bereich
- kleines FediWings-Branding

### 9.2 Variante ohne Thumbnail

- Accountbild und Identität bleiben unverändert sichtbar
- Textanriss erhält mehr Breite und maximal vier Zeilen
- Reichweitenzahl wird größer dargestellt
- eine zurückhaltende FediWings-Grafik ersetzt die Bildfläche

### 9.3 Bildfehler

- Kann der Avatar nicht geladen oder dekodiert werden, wird eine typografische Initialen-Darstellung verwendet.
- Kann das Thumbnail nicht geladen werden, wird automatisch die Variante ohne Thumbnail verwendet.
- Ein Bildfehler verhindert die Card-Erstellung nicht.
- SVG wird als Remote-Bildformat zunächst nicht verarbeitet; bei einem SVG-Avatar greift die Initialen-Darstellung.

## 10. Snapshot-Landingpage

`GET /s/<share-id>/` liefert ohne clientseitiges JavaScript eine vollständige, barrierearme HTML-Seite. Sie enthält:

- dieselben Account- und Kennzahlinformationen wie die Card
- den Textanriss oder die Content Warning
- die erzeugte Card als sichtbare Vorschau
- den Analysezeitpunkt
- einen Link zum Originalpost
- den primären Link `Aktuelle Analyse öffnen`
- einen kurzen Link zur Methodik, aber keine relativierende Formulierung direkt an der Reichweitenzahl

Die Ziel-URL für die aktuelle Analyse wird serverseitig aus `FEDIWINGS_PUBLIC_URL` und `sourceUrl` erzeugt:

```text
<FEDIWINGS_PUBLIC_URL>#share=<encodeURIComponent(sourceUrl)>
```

Es gibt keine automatische Weiterleitung und keine unterschiedliche Antwort für Bots und Menschen.

## 11. OpenGraph- und Twitter-Metadaten

Mindestens folgende Tags werden serverseitig ausgeliefert:

```text
og:type=article
og:title=<formatierte Reichweite> Netto-Reichweite · <vollständiger Handle>
og:description=<Textanriss oder CW> · <Likes> Likes · <Boosts> Boosts
og:image=<absolute Card-PNG-URL>
og:image:width=1200
og:image:height=630
og:image:type=image/png
og:image:alt=<zugängliche Beschreibung der Card>
og:url=<absolute Snapshot-URL>
og:site_name=FediWings
og:locale=de_DE
twitter:card=summary_large_image
twitter:title=<wie og:title>
twitter:description=<wie og:description>
twitter:image=<absolute Card-PNG-URL>
```

Die Seite setzt außerdem einen Canonical-Link auf ihre eigene Snapshot-URL und `robots=noindex,follow`. Social-Preview-Crawler dürfen die Seite und das Bild ohne Anmeldung abrufen.

## 12. Persistenz und Datenmodell

SQLite speichert pro Card:

```text
id
schema_version
source_url
account_url
author_name
author_handle
post_excerpt
content_warning
sensitive
net_reach
gross_reach
likes
boosts
analysis_state
analyzed_at
algorithm_version
image_path
idempotency_key
created_at
deleted_at
```

Persistente Pfade:

```text
/app/data/db.sqlite3
/app/data/cards/<share-id>.png
/app/data/.secret_key
```

Für das MVP werden Snapshots aufbewahrt, bis sie administrativ gelöscht werden. Django Admin erlaubt Suche, Anzeige und Löschung. Gelöschte Snapshot-URLs liefern `410 Gone`. Datenbank, PNG-Dateien und Secret-Key werden gemeinsam durch Cloudron gesichert.

Eine spätere automatische Aufbewahrungsgrenze benötigt eine dokumentierte Produktentscheidung. Bereits von sozialen Plattformen gecachte Inhalte können durch eine Löschung im Card Service nicht zuverlässig zurückgerufen werden.

## 13. Bildabruf und Sicherheitsgrenzen

Avatar- und Thumbnail-URLs sind externe, nicht vertrauenswürdige Eingaben. Der Card Service muss deshalb:

- ausschließlich HTTPS akzeptieren
- Hostnamen vor jedem Abruf auflösen
- Loopback-, private, Link-Local-, Multicast- und reservierte IP-Bereiche ablehnen
- Redirects manuell und begrenzt verfolgen
- das Redirect-Ziel erneut vollständig prüfen
- feste Connect- und Read-Timeouts verwenden
- Antwortgröße bereits beim Streamen begrenzen
- MIME-Typ und tatsächliche Bildsignatur prüfen
- nur JPEG, PNG, WebP und das erste Einzelbild eines GIF akzeptieren
- Pillow-Decompression-Bomb-Schutz aktiv lassen
- EXIF- und sonstige Quellmetadaten beim Rendern verwerfen
- Bilder vor der Komposition in einen kontrollierten RGB- oder RGBA-Modus konvertieren

Der Dienst protokolliert Fehlerklasse, Share-ID und Zielhost, aber keine vollständigen Snapshot-Payloads oder Bildpfade mit sensitiven Query-Parametern.

## 14. Request-Schutz

Der Card Service ist öffentlich, akzeptiert Erstellungsanfragen aber nur vom konfigurierten FediWings-Origin.

Vorgesehen ist ein kurzlebiger, origin-gebundener Request-Token:

1. `GET /api/v1/share-token/` prüft den `Origin`-Header gegen eine exakte Allowlist.
2. Der Dienst liefert einen HMAC-signierten Token mit Origin und Ablaufzeit.
3. `POST /api/v1/cards/` erwartet den Token in `X-FediWings-Token` und denselben Origin.
4. CORS erlaubt nur den produktiven FediWings-Origin und explizite lokale Entwicklungsorigins.
5. Ein fremder Browser-Origin kann den Token wegen CORS nicht lesen und keinen zugelassenen Preflight durchführen.

Der Token ist kein Authentifizierungsnachweis für Kennzahlen. Er schützt den mutierenden Browserablauf gegen fremde Origins. Nichtbrowser-Clients werden zusätzlich durch Rate Limit, Größenlimits und technische Validierung begrenzt.

## 15. Änderungen im FediWings-Projekt

Voraussichtlich betroffene Bereiche:

- `src/lib/types.ts`: `sensitive`, Snapshot- und Serviceantwort-Typen
- `src/lib/schemas.ts`: API- und Card-Service-Schemata
- `src/lib/share.ts`: alter Direktlink bleibt erhalten; neue Snapshot-Erzeugung und Card-Service-Aufruf
- `src/components/PostCard.svelte`: Share-Dialog öffnen und Accountkontext übergeben
- neue Komponente `src/components/ShareDialog.svelte`
- `src/app/App.svelte`: Account, Origin und Analysezeitpunkt an Post-Cards weiterreichen
- `vite.config.ts`: öffentliche Card-Service-Konfiguration und CSP prüfen
- `README.md`: Card-Service, Datenschutz, Fallback und erlaubte Netzwerkziele dokumentieren
- `docs/adr/0004-cloudron-social-preview-service.md`: Architekturentscheidung
- Unit- und Playwright-Tests für den vollständigen Ablauf

Die Service-URL wird als öffentliche Buildvariable konfiguriert:

```text
VITE_CARD_SERVICE_URL=https://<cloudron-app-domain>
```

Ist die Variable nicht gesetzt, verwendet FediWings ausschließlich den bestehenden direkten Share-Link. So bleiben lokale Entwicklung und Notbetrieb ohne Card Service möglich.

## 16. Card-Service-Projekt

Das neue Projekt folgt dem Framework-Service-App-Profil:

```text
config/
apps/cards/
templates/cards/
static/src/
tests/
docs/adr/
specs/social-preview-cards/
CloudronManifest.json
Dockerfile
start.sh
manage.py
pyproject.toml
uv.lock
```

Erforderliche Laufzeitkonfiguration:

```text
DJANGO_ALLOWED_HOSTS
DJANGO_CSRF_TRUSTED_ORIGINS
FEDIWINGS_ALLOWED_ORIGINS
FEDIWINGS_PUBLIC_URL
CARD_CREATE_RATE_LIMIT
CARD_MAX_AVATAR_BYTES
CARD_MAX_THUMBNAIL_BYTES
CARD_IMAGE_TIMEOUT_SECONDS
```

Das Cloudron-Paket muss mindestens erfüllen:

- `manifestVersion: 2` und Semver-Version
- explizites Speicherlimit
- Healthcheck unter `/health/`
- `localstorage`-Addon für `/app/data`
- SQLite-Pfad im Manifest für konsistente Backups
- per Digest gepinnte Basis-Images
- Server-Build gemäß `Framework/CLOUDRON-GUIDE.md`
- Initialisierung und Migrationen vor Gunicorn-Start
- langlebiger Prozess als unprivilegierter Benutzer
- Logs ausschließlich auf stdout und stderr

## 17. Fehlerverhalten

| Situation | Verhalten |
| --- | --- |
| Card Service nicht konfiguriert | direkter GitHub-Pages-Link |
| Token-Anfrage fehlgeschlagen | verständliche Meldung und direkter Link |
| Snapshot abgelehnt | Feldfehler im Dialog und direkter Link |
| Rate Limit erreicht | Wartehinweis und direkter Link |
| Avatar nicht ladbar | Initialen-Avatar |
| Thumbnail nicht ladbar | Textlayout ohne Thumbnail |
| Datenbank- oder Renderfehler | keine halbfertige Card; direkter Link |
| Snapshot gelöscht | HTTP 410 mit neutraler Fehlerseite |
| Originalpost später nicht erreichbar | Snapshot bleibt sichtbar; Live-Analyse kann fehlschlagen |

PNG und Datenbankeintrag werden transaktional beziehungsweise mit kompensierender Bereinigung erstellt. Ein fehlgeschlagener Vorgang darf weder verwaiste Dateien noch einen öffentlich sichtbaren unvollständigen Snapshot hinterlassen.

## 18. Tests und Verifikation

### 18.1 FediWings

- Unit-Test für vollständigen föderierten Handle
- Unit-Test für HTML-zu-Klartext-Konvertierung und Längenbegrenzung
- Unit-Test für Custom-Emoji-Alt-Texte
- Unit-Test für CW- und Sensitive-Logik
- Unit-Test für Snapshot-Schema und Card-Service-Antwort
- Component- oder Browser-Test für Loading, Success und Error des Share-Dialogs
- Browser-Test für Web Share mit Card-URL
- Browser-Test für Clipboard-Fallback
- Browser-Test für Ausfall des Card Service und direkten Legacy-Link
- Browser-Test bei 320 Pixeln, Mobile und Desktop
- Accessibility-Test für Dialog, Fokusführung und Statusmeldungen

### 18.2 Card Service

- pytest für das vollständige Snapshot-Schema
- Negativtests für Größen, Wertebereiche und unbekannte Felder
- Tests für Origin, Request-Token und Rate Limit
- Tests für Idempotency-Key-Wiederholungen
- Tests für HTML-Escaping in Titel, Beschreibung und sichtbarer Landingpage
- Test aller OpenGraph- und Twitter-Tags
- Test für PNG-MIME-Typ und exakt 1200 × 630 Pixel
- Tests für Layout mit Thumbnail, ohne Thumbnail und mit CW
- Tests für Avatar- und Thumbnail-Fallback
- Tests für Größenlimit, ungültige Bildsignatur und Decompression Bomb
- Tests gegen Loopback, private IPs, DNS-Wechsel und unsichere Redirects
- Test für Löschung und HTTP 410
- Test für `/health/`
- `manage.py check --deploy`
- Browser-Smoke-Test der sichtbaren Snapshot-Landingpage

### 18.3 Manuelle Preview-Prüfung

Vor der allgemeinen Aktivierung werden mindestens geprüft:

- Quelltext enthält individuelle Metadaten ohne JavaScript-Ausführung.
- Card-PNG ist öffentlich ohne Cookies erreichbar.
- Ein unterstützter Fediverse-Dienst erzeugt eine große individuelle Link-Vorschau.
- Mindestens ein weiterer relevanter Preview-Crawler zeigt Titel, Beschreibung und Bild.
- Eine Card mit CW zeigt kein verborgenes Medium und keinen verborgenen Text.
- Ein Klick führt auf die Snapshot-Landingpage und von dort zur aktuellen GitHub-Pages-Analyse.

## 19. Akzeptanzkriterien

Die Funktion gilt als umgesetzt, wenn:

1. FediWings weiterhin vollständig als GitHub Page gebaut und betrieben wird.
2. Ein abgeschlossener Post über den Share-Dialog eine kurze Cloudron-URL erhält.
3. Der HTML-Quelltext dieser URL Account, Reichweite und individuelle OpenGraph-Tags enthält.
4. Die zugehörige PNG exakt 1200 × 630 Pixel groß ist.
5. Das Accountbild sichtbar ist oder bei technischem Abruffehler ein klarer Avatar-Fallback erscheint.
6. Ein normales Beitragsbild als Thumbnail erscheint.
7. Ohne Beitragsbild ein eigenständiges Textlayout verwendet wird.
8. CW und sensible Medien weder Thumbnail noch verborgenen Text offenlegen.
9. Card und Landingpage keine Formulierung enthalten, die die Reichweite als Schätzung relativiert.
10. Die Landingpage den gespeicherten Stand und Links zu Originalpost und aktueller Analyse zeigt.
11. Ein Ausfall des Card Service den bisherigen Share-Link nicht verhindert.
12. Alle Unit-, Browser-, Sicherheits- und Buildprüfungen beider Projekte erfolgreich sind.
13. Cloudron-Healthcheck und Backup-Test erfolgreich sind.
14. Mindestens ein Fediverse-Dienst und ein weiterer Crawler die individuelle Card darstellen.

## 20. Rollout

1. Diese Spec fachlich freigeben.
2. ADR in FediWings als `Proposed` anlegen und durch den Projektverantwortlichen akzeptieren lassen.
3. Separates Card-Service-Projekt mit eigener Spec und ADR initialisieren.
4. Card Service einschließlich Tests lokal implementieren.
5. FediWings-Integration gegen einen lokalen beziehungsweise gemockten Card Service implementieren.
6. Beide Projekte vollständig prüfen und unabhängig reviewen.
7. Card Service nach ausdrücklicher Freigabe auf der Cloudron-App-Domain installieren.
8. Healthcheck, zentrale Abläufe und Cloudron-Backup testen.
9. Card Service zunächst nur für eine lokale oder nichtproduktive FediWings-Konfiguration aktivieren.
10. Reale Preview-Crawler prüfen.
11. `VITE_CARD_SERVICE_URL` im produktiven GitHub-Pages-Build setzen.
12. FediWings deployen und den End-to-End-Share-Flow prüfen.
13. Bei Problemen die Buildvariable entfernen und FediWings erneut deployen; der direkte Share-Link bleibt erhalten.

## 21. Betrieb und Rollback

- Der Card Service veröffentlicht einen Healthcheck ohne Datenbankinhalte.
- Fehler sind anhand Share-ID und Fehlerklasse nachvollziehbar.
- Speicherverbrauch von SQLite und `/app/data/cards` wird beobachtet.
- Vor Updates mit Datenmodelländerungen wird ein Cloudron-Backup erstellt.
- Rollback verwendet das letzte bekannte funktionierende Image und bei inkompatiblen Migrationen das zugehörige Backup.
- Die statische FediWings-App kann den Card Service jederzeit durch Entfernen von `VITE_CARD_SERVICE_URL` deaktivieren.
- Bereits veröffentlichte Snapshot-Links bleiben unabhängig von dieser FediWings-Konfiguration erreichbar.

## 22. Erforderliche ADR-Entscheidungen

Das FediWings-ADR muss mindestens festhalten:

- externer Card Service statt dynamischer GitHub-Pages-Metadaten
- Trennung in Static App und separate Service App
- Übernahme clientseitig berechneter Kennzahlen
- persistenter Snapshot zum Zeitpunkt des Teilens
- CW- und Sensitive-Regel
- Legacy-Link als Fallback
- verwarfene GitHub-Actions-Share-Seiten

Das Card-Service-ADR muss mindestens festhalten:

- Django und SQLite gemäß Service-App-Profil
- Speicherung der fertigen PNG statt der entfernten Quellbilder
- Aufbewahrung bis zur administrativen Löschung
- öffentliche Landingpages ohne Login
- technische Grenzen für externe Bildabrufe
- Cloudron Custom App als Deploymentziel

## 23. Offene Deploymentwerte

Vor dem produktiven Deployment müssen nur noch konkrete Betriebswerte eingesetzt werden:

- endgültige Cloudron-App-Domain
- endgültige öffentliche GitHub-Pages-URL
- produktiver FediWings-Origin für CORS
- Cloudron-Speicherlimit
- genaue Rate-Limit-Werte nach einem kurzen Lasttest
- lizenzierte, im Image gebündelte Schriftdatei

Diese Werte ändern die beschlossene Architektur nicht.
