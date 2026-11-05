# Bibliotheksfunktionen

| Datei | Zweck |
| --- | --- |
| `deepLink.test.ts` | Prüft Handle-Normalisierung, Längen, Parameter-Ambiguität, Injection-Payloads, lokale Ziele, strikt einmaliges `autostart=1` und Vorrang von OAuth/Share/anderen Ansichten. |
| `deepLink.ts` | `readDeepLinkHandle` prüft untrusted Querywerte strikt; `shouldAutostartDeepLink` akzeptiert genau ein `autostart=1` nur mit gültigem Handle; reine Parser ohne Requests/HTML-Ausgabe; keine DNS-Sandbox. |
