# Recherche: Ähnliche Projekte

Stand der Recherche: 31.08.2026. Durchsucht wurden GitHub (Repository-Suche), DuckDuckGo (Websuche) sowie die Projektseiten der wichtigsten Treffer. Suchbegriffe unter anderem: `mastodon analytics`, `mastodon stats`, `fediverse analytics`, `mastodon reach boosters follower`.

## 1. Kernfrage

Gibt es bereits Projekte, die die **Reichweite von Mastodon-Beiträgen** schätzen, insbesondere über die Followerzahlen der Booster?

**Kurzantwort:** Die einzelne Idee „Followerzahlen der Booster auswerten“ existiert bereits (Rankle). Die Kombination aus statischer GitHub-Pages-App, Login-freier Analyse **fremder** öffentlicher Accounts, Aggregation zu einer geschätzten Brutto-Reichweite und datensparsamer Live-Umgebung ohne Speicherung wurde jedoch in keinem gefundenen Projekt umgesetzt.

## 2. Am nächsten am eigenen Konzept

### unixbigot/rankle

- Quelle: <https://github.com/unixbigot/rankle>
- Python-CLI-Skript, untersucht eigene Toots und listet die Booster mit den höchsten Followerzahlen („followed by N follows“).
- Motivation laut README: herausfinden, warum ein Toot „viral“ ging, indem die Followerzahlen der Booster inspiziert werden.
- **Gemeinsame Kernidee:** Booster-Followerzahlen als Reichweitensignal.
- **Unterschiede zu FediWings:**
  - Nur eigene Konten, `read`-API-Token (OAuth) erforderlich
  - Kommandozeilen-Skript, keine Weboberfläche
  - Liest und speichert Toots (Archiv-Funktion für Hugo-Blogs)
  - Keine Aggregation/Summe, kein geschätzter Reichweitenwert, keine Web-App

### blazer82/analytodon (Analytodon)

- Quelle: <https://github.com/blazer82/analytodon> · <https://www.analytodon.com>
- Open Source (25 Sterne), als gehosteter Dienst und zum Self-Hosting verfügbar.
- Funktionen: Follower-Verlauf, Engagement-Trends (Boosts/Favoriten/Antworten), Top-Posts, Hashtag-Analyse, Wöchentlich-Mails, CSV-Export, Multi-Account.
- **Unterschiede zu FediWings:**
  - Erfordert Registrierung bzw. OAuth-Anbindung des eigenen Kontos und persistente Speicherung (Datenbank)
  - Zeitreihen- und Trendfokus statt Einzelmessung des Booster-Netzes
  - Keine Berechnung einer geschätzten Reichweite aus Booster-Followern
  - Keine rein statische, speicherlose Live-Analyse fremder Accounts

### arseniiarsenii/mastodon-meter

- Quelle: <https://github.com/arseniiarsenii/mastodon-meter>
- „Open analytics and report generation tool for Mastodon federated social network“.
- Ausrichtung auf Berichte/Reports, nicht auf eine login-freie Einzelmessung mit Booster-Aggregation.

## 3. Kommerzielle SaaS-Angebote (mit Account-Anmeldung)

Diese Dienste bieten Mastodon-Analytics als Teil größerer Plattformen; alle setzen Authentifizierung und persistentes Speichern der Accountdaten voraus:

| Dienst | Angebot |
| --- | --- |
| [MastoMetrics](https://mastometrics.com/) | Account- und Post-Analytics für Mastodon (kommerziell) |
| [Viraly](https://viraly.io/mastodon-analytics-tool) | Gratis-/Freemium-Analytics, Berichte, Exporte |
| [Nuelink](https://nuelink.com/features/analytics/mastodon-analytics) | Scheduling-Suite mit Mastodon-Analytics |
| [Publer](https://publer.com/integrations/mastodon) | Scheduling mit Engagement-Tracking |

Keines dieser Angebote arbeitet anonym, statisch oder ohne Datenhaltung; keines berechnet eine geschätzte Reichweite über Booster-Follower.

## 4. Weitere Open-Source-Werkzeuge (Randbereiche)

| Projekt | Beschreibung | Abgrenzung |
| --- | --- | --- |
| [rollecode/mastodon-user-analytics](https://github.com/rollecode/mastodon-user-analytics) | „Privacy-first analytics for your Mastodon account“ | Eigenes Konto, kein Booster-Fokus |
| [usssiemer/fedi-follow-force-graph](https://github.com/usssiemer/fedi-follow-force-graph) | Force-Graph der Follow-Beziehungen | Visualisierung statt Reichweite |
| [InfoWorld: Mastodon relationship graphs](https://www.infoworld.com/article/2337898/mastodon-relationship-graphs.html) | Steampipe/SQL-Analyse von Tootern und Boostern | Ad-hoc-Datenanalyse, kein Tool für Endnutzer |
| [zegl/mastodon-stats](https://github.com/zegl/mastodon-stats) | Instanz-Statistiken und -Discovery | Instanzebene, nicht Beitragsebene |
| Fediverse Observer / `instance-stats`-Bots | Instanz- und Netzwerkstatistiken | Instanzebene, nicht Beitragsebene |
| [LAMIAE-ELHOSNI/Mastodon_Social_Analytics_with_Hadoop_and_HBase](https://github.com/LAMIAE-ELHOSNI/Mastodon_Social_Analytics_with_Hadoop_and_HBase), [RuipuCui/Mastodon-Data-Analytics](https://github.com/RuipuCui/Mastodon-Data-Analytics) | Batch-Analyse großer Mastodon-Datensätze (HPC/Hadoop) | Offline-Forschung, kein Live-Tool |
| Mastodon-Admin-Analytics (ab Mastodon 4.3) | Eingebaute Realtime-Analytics für Instanz-Admins | Nur Admins, Instanzebene, keine Booster-Reichweite |

## 5. Einordnung und Differenzierung von FediWings

Keines der gefundenen Projekte kombiniert die Eigenschaften von FediWings:

1. **Login-frei und fremdkompatibel:** Analyse beliebiger *öffentlicher* Accounts, nicht nur des eigenen. Alle gefundenen Analytics-Tools (Analytodon, MastoMetrics, Viraly, Nuelink, Publer) binden ein Konto per OAuth an.
2. **Vollständig statisch:** Läuft ohne Backend, Datenbank oder Serverkomponente direkt auf GitHub Pages. Analytodon & Co. benötigen Serverinfrastruktur.
3. **Reichweitenformel:** `Autor-Follower + Σ Follower öffentlicher Booster` als transparent geschätzte Brutto-Reichweite. Rankle zeigt die Einzelwerte der Booster, summiert sie aber nicht zu einer Kennzahl.
4. **Keine Persistenz:** Kein Tracking, keine Datenbank, keine Boosterprofile über die Sitzung hinaus. Die SaaS-Angebote basieren gerade auf persistenter Speicherung.
5. **Schonender API-Umgang:** Maximal 2 parallele Requests, Rate-Limit-Pause, Pagination nur über `Link`-Header, keine Abfragen an die Heimatserver der Booster.

### Risiken und Erkenntnisse aus der Konkurrenz

- **Rankle** belegt, dass die Kernidee nachvollziehbar und gewünscht ist; er hat aber keine Weboberfläche und braucht einen Token. Die Lücke „sofort nutzbar im Browser“ bleibt offen.
- **Analytodon** ist der reifste Vergleichsmaßstab (Features, Datenschutzseite, DE/EN). Für Differenzierung wichtig: FediWings sollte bewusst *nicht* Verlaufsspeicherung anbieten, sondern die Nische „schnelle, anonyme Einzelmessung“ besetzen.
- Mehrere SaaS-Seiten positionieren „Mastodon Analytics“ als Marketingbegriff; eine klare Kennzeichnung als **geschätzte Reichweite** ist ein erkennbares Differenzierungsmerkmal gegenüber Impressions-Versprechen.

## 6. Empfehlung

- Weiterführung des MVP ist sinnvoll; es existiert kein direkter funktionaler Vorläufer als statische Web-App.
- In README und Methodik-Hinweis explizit auf **Rankle** als verwandtes Werkzeug und auf **Analytodon** für Verlaufsanalytics verweisen (gute Fediverse-Netiquette und Abgrenzung).
- Mögliche Optimierung gegen bestehende Tools: CSV-Export der Aggregatwerte (bei Analytodon beliebt), Vergleich mehrerer Zeitpunkte rein im Arbeitsspeicher.

## Suchprotokoll

- GitHub Repository-Suche: `mastodon analytics`, `mastodon stats`, `fediverse analytics` (unauthenticated API, 31.08.2026)
- Websuche (DuckDuckGo): „mastodon post reach analytics tool boosts followers“, „mastodon estimate reach boosters follower count tool“
- Detail gelesen: Analytodon-Featureseite, Rankle-README
- Nicht gefunden: ein Projekt mit identischer Formel (Autor-Follower + Σ Booster-Follower) als statische Web-App
