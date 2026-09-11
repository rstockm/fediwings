# ADR-0003: OAuth-Login fuer den Follower-Verlauf

- Status: Accepted
- Datum: 2026-09-09
- Verantwortlich: Projektverantwortlicher FediWings
- Betroffene Guideline: `SECURITY-GUIDELINES.md` (Authentifizierung, Secrets), `OPERATIONS-GUIDELINES.md` Abschnitt 2 (Static Apps)
- Ersetzt: keines
- Ersetzt durch: keines

## Kontext

FediWings ist bislang strikt login-frei. Der neue Follower-Verlauf
benoetigt however datierte Follow-Ereignisse; die einzige Quelle im
Mastodon-API ist `GET /api/v1/notifications` und verlangt einen
Access-Token des eigenen Accounts. Fuer fremde Accounts existiert keine
rueckwirkende Quelle.

## Entscheidung

1. Eigener Tab „Follower“ trennt sichtbar: ohne Login (aktuelle Zahlen)
   und mit Login (Verlauf).
2. OAuth Authorization-Code-Flow mit PKCE (S256), vollstaendig im
   Browser: dynamische App-Registrierung pro Instanz ueber
   `POST /api/v1/apps` (anonym moeglich), Redirect-URI ist die eigene
   App-URL, Rueckkehr im gleichen Tab ueber Query-Parameter.
3. Scope minimiert auf `read:notifications`.
4. Access-Token und Client-Credentials leben ausschliesslich im
   Arbeitsspeicher; keine Persistenz in localStorage/IndexedDB.
5. Nur der laufende OAuth-Handshake (state, PKCE-Verifier, client_id/
   client_secret, Account-Referenz) liegt transient in sessionStorage und
   wird nach dem Token-Austausch sofort geloescht; Grund: der gleiche-Tab-
   Redirect laedt die SPA neu.
6. Abrufbudget: 40 Notifications-Seiten (je 80 Ereignisse) pro Ladevorgang;
   das Ergebnis ist als gekuerzt gekennzeichnet.
7. Fehlerzustände (abgebrochener Login, State-Mismatch, abgelaufene
   Sitzung) werden verstaendlich gemeldet; bei State-Mismatch wird der
   Handshake verworfen.

## Alternativen

- Redirect in einem Popup-Fenster: vermeidet den Neustart der SPA, aber
  Popup-Blocker und schlechtere mobile Bedienbarkeit.
- Token in localStorage: bequeme Wiederverwendung, aber ein dauerhaft
  gespeichertes Credential widerspricht dem Datenschutzversprechen.
- Follower-Historie ohne Login (z. B. `/followers`): liefert keine
  Zeitstempel, ist fuer eine Zeitreihe unbrauchbar.

## Konsequenzen

- Bruch mit der bisherigen „Kein Login, Token“-Aussage: README,
  Umsetzungsplan und Methodikseite wurden entsprechend angepasst.
- Nach Sitzungsende ist der Token weg; ein erneuter Verlaufsaabruf
  erfordert einen neuen Login.
- Server ohne OAuth/PKCE-Unterstuetzung (Pixelfed) liefern einen
  verstaendlichen Fehler statt Teilfunktionen.

## Verifikation

- Unit-Tests: PKCE-Paar, State-Validierung, Token-Exchange,
  Handshake-Roundtrip im sessionStorage.
- Browser-Tests: voller Flow gegen gemockte Endpunkte inklusive
  abgebrochenem Login.

## Ablösung

Bei Einführung dauerhafter Logins (z. B. eigener Kleinstserver) ist
dieses ADR zu überarbeiten und die Speicherentscheidung neu zu bewerten.
