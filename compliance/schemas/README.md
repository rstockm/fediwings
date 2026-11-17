# Vendorte CycloneDX-Validierungsschemas

Unveränderte Dateien aus `CycloneDX/specification`, Tag `1.5`, Commit
`c320fc0f0b46873864927d9d5684eea7ba439728`:

- `schema/bom-1.5.schema.json`
- `schema/spdx.schema.json`
- `schema/jsf-0.82.schema.json`
- `LICENSE` (Apache-2.0)

Quelle: <https://github.com/CycloneDX/specification/tree/c320fc0f0b46873864927d9d5684eea7ba439728>.
Copyright-/Autorenhinweise in den Schemas bleiben unverändert erhalten.

Sie dienen ausschließlich der lokalen/CI-Validierung, werden nicht in die
Browser-App kopiert und vermeiden Netzwerkzugriffe während der SBOM-Prüfung.
Die SHA-256-Hashes der drei JSON-Dateien stehen selbst in der SBOM.
Upgrades bewusst aus festem Upstream-Commit übernehmen, Lizenz und Schema-
Kompatibilität prüfen, Tests ausführen und `make sbom` neu erzeugen.
