# App

| Datei | Zweck |
| --- | --- |
| `App.svelte` | App-Zustand, Analyse und OAuth-Verbindung; hält den ausgewählten Account (`reportsSelection`) für Analyse und Reports, erlaubt Kontowechsel und ersetzt die Sitzung erst nach erfolgreichem Login; `reports` zeigt den Follower-Bereich, `follower` bleibt Alias für alte Links und OAuth-Zustände; validiert Deep-Link-Autostart und bewahrt OAuth/Share-Vorrang. |
