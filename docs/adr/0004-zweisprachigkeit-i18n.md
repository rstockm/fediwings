# ADR-0004: Zweisprachige Oberfläche mit svelte-i18n

- Status: Proposed
- Datum: 2026-09-11
- Verantwortlich: Projektverantwortlicher FediWings
- Betroffene Guideline: `GUIDELINES.md` Abschnitt 2 (Abhängigkeiten), Abschnitt 4 (Frontend), `OPERATIONS-GUIDELINES.md` Abschnitt 2 (Static Apps)
- Ersetzt: keines
- Ersetzt durch: keines

## Kontext

FediWings soll deutsch und englisch bedienbar sein. Die App ist eine
statische Single-Page-Anwendung auf GitHub Pages ohne Backend. Die
Sprache muss deshalb vollständig clientseitig erkannt, gespeichert und
umschaltbar sein. Alle Nutzendentexte (einschließlich Fehlermeldungen
aus der Logikschicht) werden zweisprachig benötigt; Dokumentation bleibt
deutsch.

## Entscheidung

1. **svelte-i18n** (v4) wird als i18n-Framework eingesetzt. Es ist
   store-basiert, funktioniert mit Svelte 5 Runes über `$`-Präfix,
   bringt Intl-Zahlen-/Datumsformate pro Sprache mit und hat keinen
   Serverbezug. Die Runtime ist klein; die App bleibt eine Static App
   auf GitHub Pages.
2. Nachrichten liegen als flache TypeScript-Dictionarys in
   `src/lib/i18n/de.ts` (Referenz, typtragend) und `src/lib/i18n/en.ts`
   (`satisfies`-geprüft). Kein separater Übersetzungsservice.
3. Spracherkennung beim Start: gespeicherte Wahl
   (`localStorage: fediscope:locale-v1`) → Browser-Hinweis
   (`navigator.language`, `de*` → Deutsch, `en*` → Englisch) →
   **Deutsch** als Vorgabe.
4. Umschalter „DE/EN“ (Gruppe mit `aria-pressed`) in der Kopfzeile; die
   Wahl wird persistiert, `<html lang>` wird mitgesetzt und der
   Seitentitel reagiert reaktiv.
5. Fehlermeldungen aus `src/lib/` (API, Handle, OAuth, Share, Follower,
   Analyse) werden über `msg()` (imperativ, aktueller Locale-Stand)
   übersetzt; Komponenten nutzen `$_(...)` und die `number`/`date`-
   Formatter Stores von svelte-i18n.
6. Unit-Tests erzwingen Deutsch über `src/test-setup.ts`; Browser-Tests
   laufen mit Playwright-`locale: 'de-DE'` und prüfen zusätzlich den
   Wechsel nach Englisch inklusive Persistenz.

## Alternativen

- **Handgeschriebenes Modul ohne Abhängigkeit:** minimal, aber ohne
  ICU-Interpolation, Formatter-Handling und fehlender Community-Prüfung;
  Langzeitpflege schwieriger.
- **inlang/paraglide:** moderner Kompilieransatz, benötigt aber
  Build-Pipeline-Integration und ein Projektdatei-Setup, das für zwei
  Sprachen und einen kleinen Textumfang unverhältnismäßig ist.
- **SSR/Prerendering pro Sprache:** widerspricht dem Static-App-Profil.

## Konsequenzen

- Positiv: vollständige DE/EN-Oberfläche inklusive Fehlermeldungen,
  korrekte Zahlen-/Datumsformate pro Sprache, kein Serverbedarf,
  typsichere Dictionarys (fehlende englische Schlüssel brechen den Build).
- Negativ: zusätzliche Laufzeitabhängigkeit (svelte-i18n und transitiv
  intl-messageformat); Bundle wächst um rund 88 kB gzip (inklusive
  Dictionarys); englische Texte müssen bei jeder Änderung mitgepflegt
  werden.
- Statisches `index.html` bleibt deutsch (Vorgabe); Crawlersicht der
  Startseite ändert sich nicht.

## Verifikation

- `make check` grün; svelte-check zwingt beide Dictionarys auf dieselben
  Schlüssel.
- Unit-Tests: 53/53 (Deutsch erzwungen).
- Browser-Tests: 57/57, davon ein Test für Umschalter, `<html lang>`,
  Englischer Startansicht und Reload-Persistenz.
- Manuell: Umschalter bedienbar per Tastatur, `aria-pressed` korrekt.

## Ablösung

Erneut bewerten, wenn mehr als zwei Sprachen, maschinelle Übersetzungs-
workflows oder serverseitig lokalisierter Inhalt (z. B. individuelle
Social-Cards mit eigener Sprachwahl) benötigt werden.
