# Wartungsskripte

| Datei | Zweck |
| --- | --- |
| `sbom.mjs` | Nutzt npm 10.9.8 für reproduzierbare CycloneDX-1.5-SBOM; ergänzt Font-/Schemahashes, validiert offline mit vorhandenem Ajv, prüft Lockfile-Abdeckung und Snapshot mit `--check`. |
| `sbom.test.mjs` | Prüft Erzeugung in isoliertem Verzeichnis, Reproduzierbarkeit, eindeutige Referenzen und Fehlerfälle; läuft mit `npm run test:sbom`. |
