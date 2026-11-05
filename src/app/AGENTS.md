# App

| Datei | Zweck |
| --- | --- |
| `App.svelte` | App-Zustand, Analyse und OAuth-Verbindung; bietet nicht verbundenen Post-Karten `openConnection` als Long-Tail-CTA an; übernimmt geprüfte Deep-Link-Handles, startet nur bei explizitem `autostart=1` einmalig; entfernt Flag vor Analyse, OAuth/Share haben Vorrang. |
