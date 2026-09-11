# FediWings

FediWings ist eine statische Webanwendung zur Analyse der Netto-Reichweite öffentlicher Fediverse-Beiträge auf unterstützten API-kompatiblen Servern. Die App lädt Daten direkt aus dem Browser von der Heimatinstanz des analysierten Accounts und speichert keine Analyseergebnisse.

Die Oberfläche ist zweisprachig (Deutsch/Englisch, Umschalter in der Kopfzeile, ADR-0004). Ohne weiteren Hinweis startet die App auf Deutsch; die Browsersprache dient als Vorschlag.

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

## Sicherheit und Datenschutz

- Die App ist eine Static App ohne Backend, Accounts, Cookies oder eigene Persistenz. Analysedaten bleiben ausschließlich im Arbeitsspeicher der laufenden Browser-Sitzung.
- Der „Follower“-Tab bietet einen optionalen Login am kompatiblen Fediverse-Server (OAuth mit PKCE, Scope `read:notifications`) für den persönlichen Follower-Verlauf. Der Access-Token liegt im `sessionStorage` des Tabs und überlebt damit Neuladen und Ansichtswechsel innerhalb der Tab-Sitzung; beim Abmelden, bei HTTP 401 und beim Schließen des Tabs wird er gelöscht. Der kurzlebige Login-Handshake liegt ebenfalls transient im `sessionStorage` und wird nach dem Token-Austausch gelöscht (ADR-0003).
- Eine restriktive Content-Security-Policy wird beim Build eingebettet (`default-src 'none'`; Scripts und Styles nur vom eigenen Origin; Details in `docs/adr/0002-externe-origins-und-csp.md`).
- Erlaubte ausgehende HTTPS-Ziele (nutzerinduziert):
  - Heimatinstanz des eingegebenen Handles (`https://<domain>/api/...`)
  - NodeInfo-Endpunkte derselben Domain (`.well-known/nodeinfo` und Profil-Link)
  - WebFinger-Endpunkt derselben Domain (`.well-known/webfinger`)
  - Instanz, die ein WebFinger-`self`-Link angibt
  - Nur im „Follower“-Tab nach ausdrücklichem Login: OAuth-Endpunkte derselben Instanz (`/api/v1/apps`, `/oauth/authorize`, `/oauth/token`, `/api/v1/notifications`)
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

Die Netto-Reichweite ist der zentrale Wert der App. Sie überträgt eine Regression aus Instagram-Story-Daten heuristisch auf Beiträge im Fediverse. Der Faktor `2 × Boosts` unterstellt einen höheren Boost-Wert in der nicht algorithmisch sortierten Timeline; er ist nicht mit Fediverse-Impressionsdaten kalibriert. Die Schätzung wird an der ergänzend ausgewiesenen Brutto-Reichweite gedeckelt und fällt nie unter die Summe aus Likes und Boosts, da jede reagierende Person den Beitrag nachweislich gesehen hat. Die Brutto-Reichweite ist keine Impressionenzahl und enthält Überschneidungen zwischen Followerkreisen. Details zur Einordnung stehen in `UMSETZUNGSPLAN.md` und in den ADRs unter `docs/adr/`.

Die Ergebnisübersicht vergleicht Beiträge aus den letzten 30 Kalendertagen mit den 30 Tagen davor und gruppiert die Werte nach Veröffentlichungsdatum. An erster Stelle steht die Summe der bereits pro Thread berechneten Netto-Reichweiten; wegen möglicher Zielgruppenüberschneidungen ist sie keine Schätzung eindeutig erreichter Personen. Die weiteren Karten verwenden direkt gemeldete Postingzähler: Likes und Boosts sowie Likes, Boosts und Antworten zusammen als Interaktionen. Die Zähler zeigen den Stand zum Analysezeitpunkt, nicht den Zeitpunkt einzelner Reaktionen. Reicht die geladene Historie oder die Auswahl der 80 analysierten Threads nicht bis zum Beginn eines Zeitfensters, zeigt FediWings dafür weder eine Teilsumme noch eine irreführende Kurve. Eine Prozentabweichung entfällt außerdem, wenn die Vorperiodensumme null ist.

Standardmäßig werden bis zu 80 Threads analysiert. Antworten auf fremde Beiträge werden bereits beim Laden verworfen; Selbst-Antworten bleiben erhalten und werden mit dem eigenen Ausgangsbeitrag zu einem Thread gruppiert.

## Architekturentscheidungen

Begründete Abweichungen vom Referenz-Stack (Svelte 5, handgeschriebenes Token-CSS statt Tailwind, svelte-check als Typecheck, keine IndexedDB) sind in `docs/adr/0001-begruendete-stack-abweichungen.md` dokumentiert.
