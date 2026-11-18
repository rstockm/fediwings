# Softwareinventar und Lizenzprüfung

| Datei | Zweck |
| --- | --- |
| `README.md` | Beschreibt npm-basierte SBOM ohne zusätzliche Paketinstanzen, Offline-Validierung, Umfang, Lizenzbefund und offene Rechtefragen. |
| `sbom.cdx.json` | Generierter CycloneDX-1.5-Snapshot aller npm-Lockfile-Komponenten, lokalen Webfonts und Validierungsschemas; nur mit `npm run sbom` aktualisieren. |
| `audit-exceptions.json` | Ausdrücklich genehmigte, befristete Picomatch-Ausnahme für ein bestimmtes Advisory und ausschließlich dev-Pfade; Risikoabwägung und Entfernungskriterien in README. |
