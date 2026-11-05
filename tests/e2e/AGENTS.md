# Browser-Tests

| Datei | Zweck |
| --- | --- |
| `app.spec.ts` | App-Flows inkl. Analyse, Thread-Aufklappen, Teilen, Sprache und Accessibility; prüft 50/50-Aktionen sowie Long-Tail-Vorschau, CTA und Austausch nach OAuth; Deep Links befüllen nur validierte Handles, Requests erst nach Klick, kein HTML-Payload-Rendering. |
| `typography.spec.ts` | Prüft geladenes Inter-Tight-Latin-Subset und echte Glyphenbreite gegen Google-Fonts-Referenz; erkennt stillen Schrift-Fallback. |
