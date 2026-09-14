# FediWings

FediWings ist eine statische Webanwendung zur Analyse der Netto-Reichweite öffentlicher Fediverse-Beiträge auf unterstützten API-kompatiblen Servern. Die App lädt Daten direkt aus dem Browser von der Heimatinstanz des analysierten Accounts und speichert keine Analyseergebnisse.

Die Oberfläche ist zweisprachig (Deutsch/Englisch, Umschalter in der Kopfzeile). Ohne weiteren Hinweis startet die App auf Deutsch; die Browsersprache dient als Vorschlag.

## Entwicklung

Voraussetzung ist Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Der lokale Server ist anschließend unter `http://127.0.0.1:5173` erreichbar.

## Prüfen

Einheitlicher Prüfeinstieg (läuft lokal und in GitHub Actions identisch):

```bash
make check
```

Einzelne Schritte:

```bash
make audit          # Abhängigkeiten auf kritische Schwachstellen
make format         # Quellcode formatieren
make lint           # ESLint
make typecheck      # svelte-check
make test           # Unit- und Integrationstests
make test-browser   # Playwright-Smoke-Tests (Desktop, Mobile, 320px, axe)
make build          # Produktions-Build
```

## Unterstützte Server

FediWings analysiert Beiträge aus verschiedenen Teilen des Fediverse. Die App erkennt über NodeInfo die Software des Heimat-Servers und unterstützt Mastodon-API-kompatible Implementierungen direkt: **Mastodon**, **Pixelfed**, **Pleroma**, **Akkoma**, **GoToSocial**, **Friendica**, **Glitch-Soc** und **Hometown**. Die erkannte Software wird im Analyseergebnis angezeigt.

**Misskey**, **Sharkey**, **Firefish** und **Iceshrimp** werden ebenfalls über NodeInfo erkannt. Ihre Auswertung funktioniert derzeit jedoch nur auf Instanzen, die die verwendeten Mastodon-API-Endpunkte kompatibel bereitstellen. Für Pixelfed nutzt FediWings automatisch den anonymen Pixelfed-API-Pfad (`/api/pixelfed/v1/...`); da Pixelfed keine öffentlichen Booster-Listen bereitstellt, basiert die Brutto-Reichweite dort auf den Autor-Followern. Server ohne öffentliche Booster-Liste liefern ein gekennzeichnetes Teilergebnis. PeerTube (eigene Video-Sicht mit echten Views) ist als späteres Modul geplant.

### Bluesky / AT Protocol

Neben dem Fediverse unterstützt FediWings **Bluesky** und andere AT-Protocol-Accounts. Die Unterscheidung erfolgt allein an der Eingabeform, ein Umschalter ist nicht nötig:

| Eingabe | Backend |
| --- | --- |
| `@name@server.social` | Fediverse (Mastodon-API) |
| `name.bsky.social`, `@dracoblue.de` | AT Protocol |
| `did:plc:…`, `did:web:…` | AT Protocol |

Eine nackte Domain wird zuerst als AT-Proto-Handle aufgelöst; scheitert das, greift der bisherige Fediverse-Pfad. Der Ablauf: Handle → DID (`com.atproto.identity.resolveHandle`) → DID-Dokument (`plc.directory` bzw. `/.well-known/did.json`) → Personal Data Server. Der PDS wird als Heimat-Server angezeigt — auch wenn er nicht von Bluesky betrieben wird (z. B. `eurosky.social`).

Die Analysedaten selbst kommen aus der öffentlichen AppView `public.api.bsky.app`, weil der PDS `app.bsky.*` nur mit Login beantwortet. `app.bsky.feed.getRepostedBy` liefert Reposter ohne Followerzahlen; diese lädt FediWings in Blöcken von 25 Konten über `app.bsky.actor.getProfiles` nach, sodass die Brutto-Reichweite wie im Fediverse vollständig aufgelöst wird. Bluesky-Zitate werden erfasst, fließen aber nicht in die Netto-Formel ein, damit die Werte zwischen den Protokollen vergleichbar bleiben.

Der „Follower“-Tab bleibt Fediverse-only: Er setzt einen Mastodon-OAuth-Login voraus, den AT Protocol so nicht kennt.

## Sicherheit und Datenschutz

- Die FediWings-App ist eine Static App ohne eigene Accounts oder Cookies. Analysedaten bleiben im Browser; nur bewusst erstellte Share-Karten werden an den separaten Card Service übertragen.
- Der „Follower“-Tab bietet einen optionalen Login am kompatiblen Fediverse-Server (OAuth mit PKCE, Scopes `read:accounts read:notifications`) für den persönlichen Follower-Verlauf. Nach dem Login bestätigt FediWings den eigenen Account über `verify_credentials`; ein Login mit einem anderen als dem ausgewählten Account wird verworfen. Access-Token, feste Server-Origin und OAuth-Client liegen gemeinsam im `sessionStorage` des Tabs. Beim Abmelden wird der Token beim Server widerrufen und lokal gelöscht; bei HTTP 401 und beim Schließen des Tabs wird er lokal gelöscht.
- Beim Teilen kann die App einen separaten Card Service verwenden. Dorthin gehen ausschließlich der bewusst ausgelöste öffentliche Snapshot (Post-URL, Anzeigename, Handle, Avatar-URL, bereinigter Textanriss, Kennzahlen und Analysezeitpunkt) sowie ein optionales öffentliches Thumbnail. Der Dienst speichert den Snapshot und die daraus gerenderte PNG als öffentliche Share-URL; die entfernten Quellbilder werden nicht gespeichert. Content Warnings und sensible Medien übertragen weder Thumbnail noch verborgenen Text. Ist der Dienst nicht erreichbar, bleibt der fragmentbasierte direkte Share-Link nutzbar.
- Eine restriktive Content-Security-Policy wird beim Build eingebettet (`default-src 'none'`; Scripts und Styles nur vom eigenen Origin).
- Erlaubte ausgehende HTTPS-Ziele (nutzerinduziert):
  - Heimatinstanz des eingegebenen Handles (`https://<domain>/api/...`)
  - NodeInfo-Endpunkte derselben Domain (`.well-known/nodeinfo` und Profil-Link)
  - WebFinger-Endpunkt derselben Domain (`.well-known/webfinger`)
  - Instanz, die ein WebFinger-`self`-Link angibt
  - Bei AT-Protocol-Handles: `https://public.api.bsky.app/xrpc/...` (Handle-Auflösung, Profil, Beiträge, Reposts), `https://plc.directory/<did>` bzw. `https://<domain>/.well-known/did.json` für das DID-Dokument
  - Bilder und Avatare von `https://cdn.bsky.app` (nur Darstellung, per `img-src`)
  - Nur im „Follower“-Tab nach ausdrücklichem Login: OAuth-Endpunkte derselben Instanz (`/api/v1/apps`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, `/api/v1/accounts/verify_credentials`, `/api/v1/notifications`)
  - Nur nach Aktivierung der Share-Funktion: konfigurierte HTTPS-Domain des FediWings Card Service für Request-Token und Snapshot-Erstellung
  - Keine Abfragen an die Heimatserver der Booster, keine Tracking- oder Analyseanbieter.
- Alle API-Antworten werden gegen feste Schemas validiert; Beitrags-HTML wird vor der Darstellung mit einer engen Allowlist sanitisiert (DOMPurify).
- Es werden keine Secrets oder Zugangsdaten im Build benötigt.

## Methodik

```text
Interaktionen = Likes + Antworten

Netto-Reichweite = min(
  Brutto-Reichweite,
  max(
    0,0165 × Brutto-Reichweite × (1 + 2 × Boosts)^0,7314 × (1 + Interaktionen)^0,2214,
    Likes + Boosts
  )
)

Brutto-Reichweite = Autor-Follower + Summe der Follower öffentlicher Booster
```

Die Netto-Reichweite ist der zentrale Wert der App. Sie überträgt eine Regression aus Instagram-Story-Daten heuristisch auf Beiträge im Fediverse. Der Faktor `2 × Boosts` unterstellt einen höheren Boost-Wert in der nicht algorithmisch sortierten Timeline; er ist nicht mit Fediverse-Impressionsdaten kalibriert. Die Schätzung wird an der ergänzend ausgewiesenen Brutto-Reichweite gedeckelt und fällt nie unter die Summe aus Likes und Boosts, da jede reagierende Person den Beitrag nachweislich gesehen hat. Die Brutto-Reichweite ist keine Impressionenzahl und enthält Überschneidungen zwischen Followerkreisen. Details zur Einordnung stehen auf der Methodik-Seite der App.

Die Ergebnisübersicht vergleicht Beiträge aus den letzten 30 Kalendertagen mit den 30 Tagen davor und gruppiert die Werte nach Veröffentlichungsdatum. An erster Stelle steht die Summe der bereits pro Thread berechneten Netto-Reichweiten; wegen möglicher Zielgruppenüberschneidungen ist sie keine Schätzung eindeutig erreichter Personen. Die weiteren Karten verwenden direkt gemeldete Postingzähler: Likes und Boosts sowie Likes, Boosts und Antworten zusammen als Interaktionen. Die Zähler zeigen den Stand zum Analysezeitpunkt, nicht den Zeitpunkt einzelner Reaktionen. Reicht die geladene Historie oder die Auswahl der 80 analysierten Threads nicht bis zum Beginn eines Zeitfensters, zeigt FediWings dafür weder eine Teilsumme noch eine irreführende Kurve. Eine Prozentabweichung entfällt außerdem, wenn die Vorperiodensumme null ist.

Standardmäßig werden bis zu 80 Threads analysiert. Antworten auf fremde Beiträge werden bereits beim Laden verworfen; Selbst-Antworten bleiben erhalten und werden mit dem eigenen Ausgangsbeitrag zu einem Thread gruppiert.

## Architekturentscheidungen

Begründete Abweichungen vom Referenz-Stack (Svelte 5, handgeschriebenes Token-CSS statt Tailwind, svelte-check als Typecheck, keine IndexedDB) sind in der internen Architekturdokumentation des Projekts festgehalten, die nicht Teil dieses öffentlichen Repos ist.
