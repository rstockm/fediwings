# ADR-0001: Begründete Abweichungen vom Static-App-Referenz-Stack

- Status: Proposed
- Datum: 2026-09-05
- Verantwortlich: Projektverantwortlicher FediWings
- Betroffene Guideline: `GUIDELINES.md` Abschnitt 3.1, 4.1, 6.1, 9.3
- Ersetzt: keines
- Ersetzt durch: keines

## Kontext

FediWings ist eine Static App (GitHub Pages, TypeScript, Vite, Vitest,
Playwright). Der Referenz-Stack in Abschnitt 3.1 nennt zusätzlich Tailwind
CSS und IndexedDB über Dexie.js. Die App ist eine bewusst
datensparsame Einzelmessung: Sie speichert absichtlich nichts dauerhaft und
besitzt keine Datenbestände.

## Entscheidung

1. **Svelte 5** wird als UI-Library zusätzlich zu TypeScript und Vite
   eingesetzt. Die Guidelines schreiben kein konkretes UI-Framework vor; die
   Wahl fiel auf Svelte wegen kleinen Bundle, reaktivem Zustandsmodell und
   geringer Abstraktionsdichte.
2. **Handgeschriebenes CSS auf Basis von Design-Tokens** ersetzt Tailwind
   CSS. Die Tokens werden verbindlich als CSS Custom Properties in
   `src/styles/tokens.css` gepflegt (`--ink`, `--paper`, `--violet`, ...).
   Der komplette Stylesheet-Umfang liegt unter ca. 12 KB und wird durch
   Tailwind nicht wesentlich reduziert. Damit entfällt ein zusätzlicher
   Laufzeit-Build-Schritt, eine weitere Abhängigkeit und ein Doppelsystem
   aus Tokens und Utilities (vgl. Abhängigkeitsregel §2.6).
3. **svelte-check** ist der verbindliche Typecheck. `.svelte`-Dateien können
   von `tsc` nicht direkt verarbeitet werden; `svelte-check` übernimmt die
   Typprüfung von `*.svelte` und `*.ts` und wird über `npm run typecheck`
   sowie `make check` ausgeführt.
4. **Keine IndexedDB/Dexie-Persistenz.** Die App verarbeitet ausschließlich
   flüchtige Sitzungsdaten. Die Guidelines-Anforderung für lokale
   Browserdaten greift nach dem Prinzip der kleinsten tragfähigen Lösung
   nicht, weil keine Daten dauerhaft abgelegt werden.

   **Ergänzung (2026-09-05):** Für die auf Wunsch persistierten
   „zuletzt analysierten Handles" wird bewusst `localStorage` statt
   IndexedDB/Dexie verwendet. Es werden ausschließlich bis zu drei
   Handles samt Zeitstempel gespeichert; keine Tokens, keine Profildaten,
   keine Analyseergebnisse. Die Nutzung ist durch die Checkbox „Merken"
   im Handle-Feld explizit aktivierbar und standardmäßig deaktiviert.
5. **Projektstruktur** folgt Abschnitt 6.1 mit `src/app/`,
   `src/components/`, `src/styles/`, `tests/` und `docs/adr/`. Für reine
   Logik ohne Datenbestände wird `src/lib/` verwendet statt eines leeren
   `src/data/`.

## Alternativen

- **Tailwind CSS übernehmen:** Standardkonform, aber ohne messbaren Vorteil
  für diese kleine Oberfläche; würde Tokens duplizieren statt sie nur als
  Quelle zu nutzen.
- **React/Vue:** Größeres Ökosystem, aber höherer Zustands- und
  Laufzeitoverhead ohne fachlichen Gewinn.
- **`tsc --noEmit` allein:** Für Svelte-Projekte nicht aussagekräftig, da
  Svelte-Templates nicht von `tsc` geparst werden können.
- **IndexedDB-Cache:** Erwogen, verworfen, weil zwischengespeicherte
  Analyseergebnisse teils mehrdeutig veralten und die App bewusst
  „keine Speicherung" kommuniziert.

## Konsequenzen

- Positiv: kleines Bundle (ca. 56 kB gzip), reproduzierbare Styles über
  Tokens, keine veralteten Caches, klare Trennung UI/Logik.
- Negativ: Abweichungen müssen beim Template-Upgrade erneut geprüft werden;
  Svelte-Kenntnisse sind für Beitragende nötig; CSS-Pflege erfolgt manuell.
- Betriebliche Pflicht: `make check` als einheitlicher Prüfeinstieg liefen
  lokal und in GitHub Actions identisch.

## Verifikation

- `make check` ist grün (Lint, Format-Check, Typecheck, Unit-Tests, Build).
- Browser-Smoke-Tests laufen auf Desktop, Mobile und bei 320px Breite.
- Ein automatisierter axe-Check findet keine serious/critical
  Accessibility-Violations.

## Ablösung

Diese Entscheidung muss erneut bewertet werden, wenn FediWings Daten
dauerhaft speichert, eine gemeinsame Komponentenbibliothek übernimmt oder
das Template verbindliche Framework-Vorgaben erhält.
