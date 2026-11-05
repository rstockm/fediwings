# Bibliotheksfunktionen

| Datei | Zweck |
| --- | --- |
| `deepLink.test.ts` | Prüft Handle-Normalisierung, Längen, Parameter-Ambiguität, Injection-Payloads, lokale Ziele und Vorrang von OAuth/Share/anderen Ansichten. |
| `deepLink.ts` | `readDeepLinkHandle` prüft untrusted Querywerte strikt; liefert nur kanonischen Handle oder null, keine Requests/HTML-Ausgabe; DNS-Auflösung bleibt außerhalb dieser syntaktischen Prüfung. |
