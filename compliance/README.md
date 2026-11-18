# Softwareinventar und Lizenzbefund

## SBOM pflegen

```sh
npm ci
make sbom        # Snapshot neu erzeugen
make sbom-check  # Schema, Lockfile-Abdeckung, Lizenzangaben und Aktualität prüfen
```

`sbom.cdx.json` ist ein reproduzierbarer CycloneDX-1.5-Snapshot. Der in npm
eingebaute Generator (`npm sbom`) benötigt kein zusätzliches Generatorpaket.
`packageManager` fixiert npm auf 10.9.8; CI installiert diese Version explizit.
Lokal bei abweichender Version zunächst `npm install --global npm@10.9.8`
ausführen (bewusst, nicht automatisch durch das Skript). Zufalls-UUID und Zeitstempel
werden entfernt, der Rootname wird aus `package.json` statt dem Ordnernamen übernommen.
Die Validierung nutzt Ajv 6.15.0, bereits zuvor transitiv vorhanden und jetzt als
direktes Entwicklungswerkzeug deklariert: keine zusätzlichen npm-Paketinstanzen.
Die offiziellen Schemadateien liegen unter `schemas/` mit Herkunft und Lizenz;
Validierung und Erzeugung benötigen nach `npm ci` keinen Netzwerkzugriff.
Die optionalen Draft-07-Formatannotationen für internationale IRIs und E-Mail-
Adressen werden von Ajv 6 nicht geprüft; Schema-Struktur, Typen, SPDX-Lizenz-IDs,
Abdeckung und Referenzen werden geprüft. Die CI
erzeugt das Inventar erneut zum Vergleich, validiert es und archiviert den
Snapshot als `sbom-<Commit-SHA>` vor jedem Pages-Deployment. Git-Historie und
Artefaktname ordnen das Inventar dem Quellstand zu; die App-Version allein genügt
dafür nicht. CI-Artefakte haben begrenzte Aufbewahrung, der Git-Snapshot bleibt
die dauerhafte Quelle. Bei separaten Releases den Snapshot zusätzlich anhängen.

Bei Änderungen an `package-lock.json`, Generator oder Webfonts neu erzeugen.
Nicht manuell editieren. `make check` enthält die Aktualitätsprüfung.

### Umfang und Grenzen

- Vollständiges npm-Lockfile: direkte/transitive Laufzeit-, Build- und Testpakete,
  einschließlich optionaler Plattformpakete. Die npm-Einstufung `dev` bleibt als
  Metadatum erhalten, ist aber keine Aussage darüber, was im Browser landet.
  Insbesondere Svelte und Teile seiner Abhängigkeiten werden mit ausgeliefert.
- Zwei lokale Inter-Tight-Webfonts mit OFL-Lizenztext und SHA-256. Ihre genaue
  Upstream-Version ist nicht dokumentiert; es wird keine Version erfunden.
- Stand nach Verschlankung, 2026-11-08: 351 npm-Paketinstanzen, zwei Fontdateien
  und drei gehashte Validierungsschemas (nur Entwicklungswerkzeuge). Der zuvor
  eingeführte externe Generator mit 153 zusätzlichen Paketinstanzen wurde entfernt.
  Alle Fremdkomponenten haben deklarierte
  Lizenzangaben. Das belegt keine vollständige rechtliche Prüfung jedes Inhalts.
- Das Inventar ist ein Quell-/Build-Inventar, keine exakte Liste der vom
  Tree-Shaking übriggelassenen Bundlebestandteile. npm-Lizenzangaben stammen aus
  dem Lockfile; License-/NOTICE-Texte müssen bei Weitergabe separat erhalten werden.
- Keine Betriebssystem-/Browserinventarisierung für die statische App. Der
  separat betriebene Card Service ist nicht Teil dieses Repositories und benötigt
  ein eigenes Inventar. Logos, Screenshots und andere Projektbilder sind keine
  npm-Komponenten; ihre Herkunft und Nutzungsrechte sind gesondert zu klären.
- Node.js und npm selbst gehören zur externen Buildumgebung, nicht zum
  Projekt-Lockfile; npm ist als Generator mit Version in den SBOM-Metadaten erfasst,
  aber sein eigener interner Paketbaum wird nicht zusätzlich inventarisiert.
- `npm run test:sbom` testet reproduzierbare Ausgabe in einem anderen Verzeichnis,
  eindeutige Referenzen sowie die Ablehnung veralteter Snapshots, geänderter Fonts,
  fehlender Lizenzangaben und ungültiger Schemadaten. Läuft in `make check` und CI.

## Befristete Audit-Ausnahme

`make audit` / `npm run audit` wertet weiterhin den vollständigen npm-Auditbericht
aus und blockiert alle nicht genehmigten hohen und kritischen Befunde. Netz-,
Parser- und unvollständige Berichtsdaten führen ebenfalls zu einem Fehler.
Moderate Befunde bleiben wie bisher unterhalb der Deployment-Schwelle und werden
in der Zusammenfassung ausgewiesen.

Am **18.11.2026** hat der Projektverantwortliche die Ausnahme für
**GHSA-fc5q-39xc-vjpf / CVE-2026-112366** ausdrücklich genehmigt, befristet
**bis ausschließlich 18.12.2026**. Die maschinenlesbare Freigabe steht in
`audit-exceptions.json`; `scripts/audit.mjs` prüft Advisory-URL, Paketname,
Schweregrad, Gültigkeit und die `dev`-Markierung aller betroffenen Lockfile-Pfade.
Auch indirekte npm-`via`-Referenzen werden auf die tatsächlichen Advisories
aufgelöst. Ein neuer Befund im selben Paket, eine kritische Eskalation oder ein
Produktionspfad erhält diese Ausnahme nicht. Acht Regressionstests sichern die
Grenzen ab (`npm run test:audit`, auch in `make check` und CI).

**Risikoabwägung:** Picomatch kann bei speziell präparierten wiederholten
Extglob-Mustern durch exponentielles Regex-Backtracking einen Node-Prozess
blockieren (ReDoS). Hier wird es ausschließlich von Entwicklungswerkzeugen
verwendet; die Dateimuster sind projektkontrolliert und werden nicht aus
öffentlichen Account-/API-Eingaben erzeugt. Stand 18.11.2026 existiert auch für
die aktuelle Version 4.0.7 kein veröffentlichter Patch. Die npm-Empfehlung eines
erzwungenen Vite-Downgrades behebt die zugrunde liegende ungepatchte Bibliothek
nicht verlässlich und wird nicht übernommen. Die Ausnahme ist kein allgemeines
Abschalten des Audits. Nach Veröffentlichung eines Patches Abhängigkeiten und
SBOM aktualisieren und die Ausnahme entfernen; bei Erreichen des Ablaufdatums
blockiert der weiterhin vorhandene Befund wieder.

Quelle: [GitHub Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
Der npm-Bericht vom 18.11.2026 enthält neun hohe Einträge entlang dieser
Abhängigkeitsketten und neun weitere moderate Einträge; letztere sind nicht
Gegenstand der Ausnahme.

## Bedeutung für die Lizenz von FediWings

**Befund: Die geprüften Abhängigkeiten erzwingen keine bestimmte Lizenz für den
eigenen Anwendungscode.** Das Repository enthält bislang keine Projekt-LICENSE
und kein `license`-Feld in `package.json`. `private: true` verhindert nur eine
versehentliche npm-Veröffentlichung und ist keine Lizenz. Ein öffentliches
GitHub-Repository ist allein keine allgemeine Erlaubnis zur Weiterverwendung;
Plattformrechte und gesetzliche Ausnahmen bleiben unberührt.

Es wurde keine Projektlizenz festgelegt. Dafür müssen die Rechteinhaber entscheiden
und gegebenenfalls Beiträge Dritter berücksichtigen. MIT oder Apache-2.0 sind für
den eigenen Code nach diesem Abhängigkeitsbefund grundsätzlich mögliche Optionen;
keine davon überschreibt die Bedingungen der eingebundenen Fremdkomponenten.

### Wesentliche Bibliotheken und Assets

| Komponente (aufgelöste Version) | Lizenz / Auswirkung |
| --- | --- |
| Svelte 5.57.0, svelte-i18n 4.0.1, Zod 4.6.7 | MIT: Copyright- und Lizenztexte bei Weitergabe erhalten; kein Copyleft für FediWings. |
| DOMPurify 3.4.17 | `(MPL-2.0 OR Apache-2.0)`: Wahlrecht, nicht beide gleichzeitig zwingend. Für eine permissive Distribution bietet sich Apache-2.0 an: Lizenz beilegen, relevante Hinweise und ggf. NOTICE übernehmen, eigene Änderungen kennzeichnen. Bei Wahl von MPL gelten dateibezogene Quellcodepflichten, nicht pauschal für die ganze App. Die Wahl ist vor Veröffentlichung der Notices festzuhalten. |
| Dexie 4.4.7 | Apache-2.0: Lizenz und den mitgelieferten NOTICE-Hinweis von David Fahlander bei Weitergabe berücksichtigen; Änderungen an Dexie selbst wären zu kennzeichnen. Der allgemeine offene Punkt zur vollständigen JavaScript-Notice-Sammlung gilt auch hier. |
| intl-messageformat 10.7.18 (transitiv über svelte-i18n) | BSD-3-Clause: Lizenz-/Copyright-/Haftungshinweise erhalten, kein Werben mit Namen der Autoren ohne Erlaubnis. |
| Inter Tight (`public/fonts/*.woff2`) | OFL-1.1: Fonts bleiben unter OFL, Copyright und Lizenz mitliefern; keine OFL-Pflicht für den Anwendungscode. Bei Änderungen ggf. reservierte Fontnamen beachten; Fonts nicht allein verkaufen. `public/fonts/OFL.txt` wird bereits in den Build kopiert. |
| @axe-core/playwright und axe-core 4.13.0 | MPL-2.0, reine Testwerkzeuge: ihre Verwendung zum Testen macht die App nicht MPL-pflichtig. Falls diese Werkzeuge oder Änderungen daran selbst weitergegeben werden, gelten ihre eigenen Pflichten. |
| TypeScript, Playwright und vendorte Validierungsschemas | Apache-2.0, Entwicklungswerkzeuge: keine automatische Umlizenzierung ihres Outputs; bei Weitergabe der Werkzeuge deren Bedingungen beachten. |
| Ajv 6.15.0 | MIT, bereits vorhandenes Entwicklungswerkzeug zur Schemavalidierung. |

Weitere im Gesamtinventar deklarierte Lizenzen: MIT-0, ISC, BSD-2-Clause, 0BSD,
BlueOak-1.0.0. Diese enthalten hier
keinen Zwang, den eigenen App-Code unter Copyleft zu stellen. Hinweise und
Lizenzbedingungen bleiben trotzdem relevant. Die CC-BY-3.0-lizenzierte
Datensammlung `spdx-exceptions` war nur durch den entfernten Generator eingebunden
und ist nicht mehr Teil des Projekt-Lockfiles.

In den deklarierten Paketlizenzen wurde kein GPL-/AGPL-Zwang gefunden. Apache-2.0
ist jedoch nicht mit GPL-2.0-only kombinierbar; eine spätere Projektlizenzwahl
sollte deshalb ausdrücklich gegen die dann gewählten Lizenzpfade geprüft werden.

## Noch zu entscheiden / vor Distribution zu erledigen

1. Projektlizenz durch Rechteinhaber wählen und als LICENSE sowie SPDX-Angabe in
   `package.json` dokumentieren; anschließend SBOM aktualisieren.
2. Vollständige Drittanbieter-Lizenz-/Copyright-/NOTICE-Beigaben für das tatsächlich
   ausgelieferte Browserbundle erstellen und mit ausliefern. Eine SBOM mit
   SPDX-Kennungen allein erfüllt diese Pflichten nicht. Aktuell ist nur der
   Font-Lizenztext als separate Beigabe im Build vorhanden; für die JavaScript-
   Bibliotheken wurde keine vollständige Notice-Sammlung nachgewiesen.
3. Herkunft/Rechte der Projektbilder und etwaiger übernommener Codeausschnitte
   separat prüfen. Paketmetadaten können darüber keine Auskunft geben.

Grundlage: aktuelles `package-lock.json`, deklarierte Paketlizenzen, lokal
installierter DOMPurify-Lizenztext (Apache-2.0) und `public/fonts/OFL.txt`.
Dies ist eine technische Lizenzbestandsaufnahme, keine Rechtsberatung oder
Garantie vollständiger Lizenzkonformität.
