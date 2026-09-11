# Analyse und Schätzung der Instagram-Reichweite

Stand: 9. September 2026

## Kurzfazit

Aus den vorliegenden Daten lässt sich eine brauchbare **grobe Schätzung**, aber keine verlässliche Vorhersage für einen einzelnen Post ableiten. Das beste der getesteten einfachen Modelle ist:

$$
\widehat{Reach} = 140{,}66 \times (1 + B)^{0{,}7314} \times (1 + I)^{0{,}2214}
$$

Dabei gilt:

- $B$ = `Shares` als Instagram-Entsprechung zu Boosts
- $I$ = `Likes + Replies`; Shares sind hier bewusst nicht nochmals enthalten
- Ergebnis auf eine ganze erreichte Person runden

Für den aktuell angegebenen Accountstand von 8.525 Followern kann dieselbe Formel in der gewünschten Form geschrieben werden als:

$$
\widehat{Reach} = 0{,}01650 \times F \times (1 + B)^{0{,}7314} \times (1 + I)^{0{,}2214}
$$

mit $F = 8\,525$.

**Wichtig:** Der Faktor `0,01650 × F` ist nur eine Umrechnung der Konstanten `140,66` für diesen Account. Da in allen Zeilen dieselbe Followerzahl von 8.525 verwendet wird, kann der Einfluss der Followerzahl aus diesem Datensatz statistisch nicht bestimmt werden. Die Formel darf daher nicht mit der Followerzahl eines anderen Accounts verwendet werden.

Im Test auf jeweils zurückgehaltenen Daten lag der typische absolute Fehler bei rund **50 Reach**, der mittlere absolute Fehler wegen einiger großer Ausreißer aber bei **112 Reach**. Nur **52 %** der Schätzungen lagen innerhalb von ±25 % des echten Wertes. Die Formel eignet sich damit eher als Größenordnung oder Bandbreite als als präzise Prognose.

## Datengrundlage

Quelle ist `Dec-31-2025_Sep-09-2026_825725067265984.csv`.

| Merkmal | Wert |
|---|---:|
| Zeilen in der Datei | 520 |
| Verwendete Stories | 510 |
| Unterschiedliche Veröffentlichungstage | 188 |
| Zeitraum der verwendeten Daten | 5. Januar bis 7. September 2026 |
| Followerzahl | 8.525 |
| Mittlere Reach | 311 |
| Median der Reach | 223 |
| Mittlere 50 % der Reach-Werte | 171 bis 300 |
| Minimum / Maximum | 106 / 3.739 |
| Stories ohne Share | 358 beziehungsweise 70,2 % |

Ausgeschlossen wurden eine Zeile mit ausgewiesenem Berechnungsfehler sowie die Stories vom 8. und 9. September. Letztere waren beim Export am 9. September noch nicht sicher über ihren vollständigen 24-Stunden-Lebenszyklus gelaufen.

### Inhaltliche Einschränkung der Datei

Alle Datensätze haben den Typ `IG story`. Die Ergebnisse gelten deshalb für **Stories dieses Accounts**, nicht automatisch für Feed-Posts, Reels oder Karussells. In der Datei gibt es außerdem keine Spalten namens `Boosts` oder `Interactions`. Für die Rechnung wurden deshalb nachvollziehbare Stellvertreter gebildet:

$$
B = Shares
$$

$$
I = Likes + Replies
$$

Ein breiterer Interaction-Wert aus Likes, Replies, Profilbesuchen, Sticker-Taps, Link-Klicks und Follows wurde ebenfalls getestet. Er schnitt leicht schlechter ab. `Navigation` wurde nicht einbezogen, weil Vorwärts-, Zurück- und Exit-Aktionen keine eindeutig positiven Interaktionen sind.

## Vorgehen

Verglichen wurden vier Ansätze:

1. Eine einfache Baseline, die unabhängig von Boosts und Interaktionen immer den Median der Trainingsdaten ausgibt.
2. Eine lineare Regression auf Reach.
3. Eine ausreißerrobustere lineare Huber-Regression.
4. Eine Regression auf logarithmierter Reach sowie logarithmierten Boosts und Interaktionen.

Zur Bewertung wurde eine zehnfache Kreuzvalidierung verwendet. Alle Stories desselben Kalendertages lagen dabei gemeinsam entweder in den Trainings- oder Testdaten. Das reduziert den sonst besonders problematischen Informationsaustausch zwischen mehreren Stories derselben Veranstaltung oder Story-Sequenz.

Die folgende Tabelle enthält ausschließlich Vorhersagen für Zeilen, mit denen das jeweilige Modell nicht trainiert wurde.

## Modellvergleich

| Modell | MAE | Median absoluter Fehler | RMSE | $R^2$ | MAPE | innerhalb ±25 % | innerhalb ±50 % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Nur Follower / Median-Baseline | 142 | 59 | 325 | -0,09 | 34,3 % | 43,9 % | 75,1 % |
| Lineare Regression | 116 | 53 | **225** | **0,48** | 35,9 % | 51,8 % | 79,6 % |
| Robuste Huber-Regression | 116 | **49** | 242 | 0,40 | 30,7 % | 52,0 % | 82,8 % |
| Logarithmische Regression | **112** | 50 | 238 | 0,41 | **30,1 %** | **52,2 %** | **83,5 %** |

MAE ist der mittlere absolute Fehler in Reach-Einheiten. MAPE ist der mittlere absolute prozentuale Fehler. RMSE gewichtet große Fehler besonders stark. Deshalb gewinnt das lineare Modell bei RMSE und $R^2$, während das logarithmische Modell für den typischen Story-Fall günstiger ist.

Die logarithmische Formel wurde als Hauptformel gewählt, weil sie:

- den niedrigsten MAE und MAPE erreicht,
- keine negativen Reach-Werte erzeugen kann,
- den abnehmenden Zusatznutzen weiterer Interaktionen plausibler abbildet,
- weniger stark von wenigen viralen Stories bestimmt wird.

## Beispielrechnungen

Alle Beispiele verwenden 8.525 Follower.

| Boosts $B$ | Interaktionen $I$ | Geschätzte Reach |
|---:|---:|---:|
| 0 | 0 | 141 |
| 0 | 5 | 209 |
| 1 | 5 | 347 |
| 2 | 10 | 534 |
| 3 | 10 | 659 |
| 5 | 15 | 964 |
| 10 | 15 | 1.501 |

Beispiel für zwei Boosts und zehn Interaktionen:

$$
\widehat{Reach} = 140{,}66 \times 3^{0{,}7314} \times 11^{0{,}2214} \approx 534
$$

## Unsicherheit der Schätzung

Die Kreuzvalidierungsfehler ergeben für das Hauptmodell folgende empirische Bandbreiten:

- Rund 80 % der echten Reach-Werte lagen zwischen dem **0,65-Fachen und 1,54-Fachen** der jeweiligen Schätzung.
- Rund 90 % lagen zwischen dem **0,56-Fachen und 2,07-Fachen** der jeweiligen Schätzung.

Eine Punktschätzung von 500 sollte praktisch also eher als grobe Bandbreite von ungefähr **325 bis 770** interpretiert werden. Selbst ein Bereich von etwa **280 bis 1.035** deckte in den Testdaten nur ungefähr 90 % der Fälle ab. Das sind empirische Fehlerbereiche dieses Datensatzes, keine formalen Garantien.

Eine zusätzliche zeitliche Prüfung bestätigt das Bild: Trainiert auf Januar bis Juni und getestet auf Juli bis 7. September erreichte die logarithmische Formel einen MAE von **156**, einen medianen absoluten Fehler von **56**, einen MAPE von **31,0 %** und ein $R^2$ von **0,39**. Die Größenordnung bleibt also stabil, die großen Einzelabweichungen bleiben jedoch bestehen.

## Wie stark streuen einzelne Stories?

Stories mit exakt denselben Eingabewerten können sehr unterschiedliche Reach-Werte erzielen:

| Boosts | Interaktionen | Anzahl | kleinste Reach | Median | größte Reach | Verhältnis Maximum zu Minimum |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 11 | 147 | 263 | 1.526 | 10,4 |
| 1 | 3 | 9 | 144 | 222 | 1.497 | 10,4 |
| 1 | 4 | 13 | 142 | 248 | 1.311 | 9,2 |
| 2 | 6 | 8 | 197 | 606 | 1.424 | 7,2 |

Das ist der deutlichste Hinweis darauf, dass Boosts und Interaktionen allein keine enge Einzelwertprognose zulassen. Für `B = 1` und `I = 2` liefert die Hauptformel beispielsweise etwa 298 Reach; tatsächlich liegen die elf vergleichbaren Stories zwischen 147 und 1.526.

Trotzdem enthalten die Variablen ein klares Signal:

| Boosts | Anzahl Stories | mittlere Reach | Median-Reach | Spannweite |
|---:|---:|---:|---:|---:|
| 0 | 358 | 211 | 194 | 106 bis 615 |
| 1 | 83 | 375 | 294 | 142 bis 1.526 |
| 2 | 42 | 607 | 579 | 167 bis 1.520 |
| 3 oder mehr | 27 | 986 | 709 | 244 bis 3.739 |

Die lineare Korrelation zwischen Boosts und Reach beträgt `0,71`, die Rangkorrelation `0,57`. Für Interaktionen betragen die Werte `0,29` und `0,50`. Boosts sind damit das stärkere der beiden Signale, aber auch bei identischem Boost-Count bleibt viel Streuung.

## Alternative lineare Formel

Wenn besonders hohe Reach-Werte stärker gewichtet werden sollen, ist die lineare Regression eine Alternative:

$$
\widehat{Reach}_{linear} = 0{,}02202 \times F + 188{,}73 \times B + 3{,}82 \times I
$$

Bei 8.525 Followern entspricht das:

$$
\widehat{Reach}_{linear} = 187{,}73 + 188{,}73 \times B + 3{,}82 \times I
$$

Diese Formel hat den besseren RMSE und das bessere $R^2$, ist aber für den typischen Einzelpost prozentual ungenauer. Vor allem ist ihr Boost-Koeffizient instabil: Entfernt man nur die oberen 5 % der Reach-Werte, fällt er von etwa `189` auf `79`. Beim logarithmischen Modell sinkt der Boost-Exponent im selben Test von `0,73` auf `0,50` und reagiert damit ebenfalls deutlich, aber weniger extrem.

Die oberen 5 % der Stories beginnen hier oberhalb von 775 Reach und vereinen bereits rund **22 % der gesamten gemessenen Reach** auf sich. Wenige Ausreißer beeinflussen eine einfache Formel daher stark.

## Interpretation und Grenzen

### Keine echte Vorhersage vor Veröffentlichung

Boosts, Likes und Replies entstehen erst, nachdem eine Story ausgespielt wurde. Die Formel kann daher bei bereits bekannten Engagement-Zahlen eine nicht verfügbare Reach **schätzen**. Vor Veröffentlichung kann sie die Reach nicht vorhersagen, solange Boosts und Interaktionen selbst unbekannt sind.

Außerdem sind Interaktionen nicht nur Ursache weiterer Ausspielung, sondern auch Folge einer bereits hohen Ausspielung. Die Koeffizienten sind deshalb keine kausalen Aussagen. Aus `188,73 × Boosts` darf insbesondere nicht geschlossen werden, dass ein zusätzlicher Share immer 189 zusätzliche Personen erreicht.

### Follower-Effekt ist nicht messbar

In allen Beobachtungen ist $F = 8\,525$. Mathematisch ist `a × F` damit nicht von einer gewöhnlichen Konstanten zu unterscheiden. Um einen belastbaren Follower-Faktor zu lernen, wären Daten nötig, die entweder:

- historische Followerzahlen je Veröffentlichungszeitpunkt enthalten oder
- mehrere vergleichbare Accounts mit unterschiedlichen Followerzahlen umfassen.

### Fehlende Einflussgrößen

Wahrscheinlich relevante, aber in der Formel nicht enthaltene Faktoren sind unter anderem:

- Position innerhalb einer Story-Sequenz und Zahl vorheriger Stories,
- Veröffentlichungszeit, Wochentag und bisherige Aktivität des Tages,
- Foto, Video, Textmenge und Story-Dauer,
- Erwähnungen, Reposts durch andere Accounts und externe Verlinkungen,
- Thema, Aktualität, Veranstaltung und beteiligte bekannte Personen,
- organische gegenüber bezahlter Verbreitung,
- Alter der Story zum Zeitpunkt des Exports.

Die Häufung sehr hoher Werte an einzelnen Veranstaltungstagen spricht dafür, dass solche Kontextfaktoren einen großen Teil der verbleibenden Streuung erklären.

## Empfehlung

1. Die logarithmische Formel nur als groben Schätzer verwenden und immer mindestens das 80-%-Band von ungefähr `0,65 × Schätzung` bis `1,54 × Schätzung` mitkommunizieren.
2. Für offizielle Auswertungen weiterhin den von Instagram gelieferten Reach-Wert verwenden.
3. Stories, Reels und Feed-Posts getrennt modellieren. Für die eigentliche Analyse von „Postings“ wird ein Export dieser Post-Typen benötigt.
4. Künftig je Story historische Followerzahl, Story-Position, Format, Veröffentlichungszeit, Erwähnungen, bezahlte Ausspielung und Ereigniszugehörigkeit erfassen.
5. Das Modell regelmäßig auf einem späteren, vollständig abgeschlossenen Zeitraum nachtesten. Ein rein zufälliges Aufteilen einzelner Stories sollte vermieden werden; ganze Tage oder Ereignisse müssen zusammenbleiben.
6. Falls die Eingaben `Boosts` und `Interactions` von Mastodon und nicht aus derselben Instagram-Story stammen, werden paarweise zugeordnete Mastodon-/Instagram-Postdaten benötigt. Die hier gefundene Formel ist auf plattformübergreifende Counts nicht übertragbar.

## Gesamturteil

Eine Formel aus Boosts und Interaktionen ist klar besser als eine reine Follower-Baseline. Sie reduziert den MAE in der Kreuzvalidierung von etwa 142 auf 112 Reach, also um rund **21 %**. Gleichzeitig bleiben bei identischen Eingabewerten Unterschiede bis zum Faktor zehn und ein MAPE von rund 30 % bestehen.

Damit ist die Antwort zweigeteilt:

- **Ja**, für Größenordnung, Monitoring und eine grobe Ersatzschätzung ist die Formel nützlich.
- **Nein**, für eine verlässliche Vorhersage der Reach eines einzelnen Postings reichen Follower, Boosts und Interaktionen nicht aus. Die Streuung ist dafür deutlich zu hoch.
