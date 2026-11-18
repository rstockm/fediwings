# GitHub-Actions-Workflows

| Datei | Zweck |
| --- | --- |
| `deploy.yml` | Prüft Secrets, Audit mit advisorygenauer befristeter Ausnahme sowie dessen Regressionstests, Format, Lint, Typen, Unit-/Browser-/SBOM-Tests und Build vor Pages-Deployment; pinnt npm 10.9.8, validiert SBOM und archiviert sie mit Commit-SHA; Secrets-Scan erhält vollständige Git-Historie (`fetch-depth: 0`). |
