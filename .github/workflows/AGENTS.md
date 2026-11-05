# GitHub-Actions-Workflows

| Datei | Zweck |
| --- | --- |
| `deploy.yml` | Prüft Secrets, Audit, Format, Lint, Typen, Unit-/Browsertests und Build vor Pages-Deployment; Secrets-Scan erhält vollständige Git-Historie (`fetch-depth: 0`), damit Mehrfach-Commit-Pushes geprüft werden können. |
