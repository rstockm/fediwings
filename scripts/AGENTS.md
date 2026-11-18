# Wartungsskripte

| Datei | Zweck |
| --- | --- |
| `sbom.mjs` | Nutzt npm 10.9.8 für reproduzierbare CycloneDX-1.5-SBOM; ergänzt Font-/Schemahashes, validiert offline mit vorhandenem Ajv, prüft Lockfile-Abdeckung und Snapshot mit `--check`. |
| `sbom.test.mjs` | Prüft Erzeugung in isoliertem Verzeichnis, Reproduzierbarkeit, eindeutige Referenzen und Fehlerfälle; läuft mit `npm run test:sbom`. |
| `audit.mjs` | Wertet vollständiges npm-Audit aus; blockiert nicht freigegebene hohe/kritische Befunde, prüft befristete, advisorygenaue Ausnahmen ausschließlich für dev-Lockfile-Pfade und löst transitive Referenzen auf. |
| `audit.test.mjs` | Prüft Ausnahmengrenzen, Ablauf, kritische Eskalation, Produktionspfade, Referenzzyklen und fehlerhafte Berichte. |
