# Browser-Tests

| Datei | Zweck |
| --- | --- |
| `app.spec.ts` | App-Flows inkl. Analyse, Thread-Aufklappen, Teilen, Sprache und Accessibility; prüft 50/50-Aktionen sowie Long-Tail-Vorschau, CTA und Austausch nach OAuth; Deep Links befüllen validierte Handles, starten mit explizitem Flag einmalig, kein Neustart nach Reload und keine Requests für Injection-/lokale Ziele. |
| `follower.spec.ts` | Gemeinsames Laden von Reports/Followern, OAuth, öffentliche und verbundene Ansicht, Kontowechsel mit Sitzungsersetzung, stabiler Account-Durchreichung zwischen Analyse und Reports sowie Reports-Direktlink und alter Follower-Alias. |
| `typography.spec.ts` | Prüft geladenes Inter-Tight-Latin-Subset und echte Glyphenbreite gegen Google-Fonts-Referenz; erkennt stillen Schrift-Fallback. |
