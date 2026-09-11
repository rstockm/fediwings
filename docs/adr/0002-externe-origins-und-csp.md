# ADR-0002: Externe Fediverse-Origins und Content-Security-Policy

- Status: Proposed
- Datum: 2026-09-05
- Verantwortlich: Projektverantwortlicher FediWings
- Betroffene Guideline: `OPERATIONS-GUIDELINES.md` Abschnitt 2 (Static Apps)
- Ersetzt: keines
- Ersetzt durch: keines

## Kontext

FediWings analysiert öffentliche Fediverse-Accounts über die kompatible API der
jeweiligen Heimatinstanz. Welche Instanz das ist, entscheidet der Nutzer
durch den eingegebenen Handle zur Laufzeit. Der gebaute Build kann die
Ziel-Origins also nicht im Voraus kennen.

Die Operations-Guidelines verlangen für Static Apps eine restriktive
Content-Security-Policy und dokumentierte, begrenzte ausgehende
Netzwerkzugriffe.

## Entscheidung

1. Die CSP wird per Vite-Plugin als `<meta http-equiv=...>` in den Build
   eingebettet:

   ```text
   default-src 'none';
   script-src 'self';
   style-src 'self';
   img-src 'self' https: data:;
   connect-src 'self' https:;
   object-src 'none';
   base-uri 'self';
   form-action 'none'
   ```

   `frame-ancestors` wird bewusst nicht als `<meta>`-Direktive gesetzt: Der
   Browser ignoriert sie in Meta-Elementen (Konsolenwarnung), und GitHub
   Pages sendet keinen `X-Frame-Options`-Header. Da die App öffentlich,
   zustandslos und ohne privilegierte Aktionen ist, besteht kein
   Clickjacking-Risiko. Bei einem künftigen Deployment mit HTTP-Headern
   ist `frame-ancestors 'none'` ergänzend zu setzen.

   Im Dev-Modus erlaubt das Plugin zusätzlich `style-src 'unsafe-inline'`
   und WebSocket-Endpunkte für Vite HMR; der Produktions-Build enthält
   diese Lockerungen nicht.

2. `connect-src https:` erlaubt HTTPS-Aufrufe an beliebige Fediverse-
   Instanzen, die der Nutzer explizit angibt. Nicht-HTTPS-Verbindungen,
   WebSocket-/WebRTC-Ausweichrouten, iframes, Plugins, Formular-Posts und
   Laufzeit-Scripts bleiben gesperrt.

3. Die zulässigen ausgehenden Ziele werden im README dokumentiert:
   Heimatinstanz (Handle-Domain), WebFinger-Endpunkt derselben Domain
   sowie Instanz, die der WebFinger `self`-Link eines Accounts ergibt.
   Booster-Heimatserver werden bewusst nie abgefragt.

## Alternativen

- **Strikte Origin-Whitelist:** Bei nutzerseitig gewählten Instanzen
  unmöglich, ohne die Instanzauswahl auf eine feste Liste einzuschränken.
- **Eigene Middleware/Proxy:** Verstößt gegen das Static-App-Profil und
  wäre bei Mastodons globalem Rate-Limit-Modell kontraproduktiv.
- **Keine CSP:** Schnell, aber ohne Baseline-Schutz bei XSS.

## Konsequenzen

- Positiv: harte `default-src 'none'`-Baseline, kein Inline-Script,
  kein Drittanbieter-JavaScript, doppelte Absicherung der HTML-Ausgabe
  zusätzlich durch Zod-Schemas und DOMPurify-Whitelist.
- Negativ: HTTPS-Verbindungen zu beliebigen Hosts sind zulässig. Die
  App validiert allerdings jede Antwort gegen feste Schemas, behandelt
  Inhalte als Daten und führt keinerlei Code aus.

## Verifikation

- Browser-Smoke-Tests laufen unter der Produktions-CSP (Playwright nutzt
  den gebauten `dist`-Ordner via `vite preview`).
- Die Konsolenlog-Prüfung der Browser-Tests meldet keine
  `Content-Security-Policy`-Verletzungen.
- README nennt die erlaubten ausgehenden Ziele.

## Ablösung

Erneut bewerten, falls FediWings plötzlich andere Targets benötigt (z. B.
Quote-Posts mit OAuth), ein eigener Proxy eingeführt wird oder Mastodon
Origin-übergreifende Endpunkte nicht mehr über HTTPS anbietet.
