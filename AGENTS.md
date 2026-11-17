# FediWings

Statische Svelte-/Vite-App; Node.js >=22. `npm ci`, `make check`;
Browserprüfungen separat mit `make test-browser`.

SBOM-Generator ist in npm 10.9.8 integriert (`packageManager`); npm-Version für
lokale SBOM-Arbeit entsprechend bereitstellen. `npm run test:sbom` prüft Regressionen.
Bei Änderungen an Lockfile, Generator, Schemas oder Fonts: `make sbom`, danach
`make sbom-check`. Generierte SBOM nicht manuell bearbeiten. Inventarumfang und
Lizenzbefund stehen in `compliance/README.md`; keine Projektlizenz ohne Entscheidung
der Rechteinhaber festlegen. Keine Pushes oder Deployments ohne Auftrag.
