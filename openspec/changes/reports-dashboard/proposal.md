# Proposal

## Why

Die ZLB benötigt eine monatliche und jährliche Mastodon-Bilanz, die sich in ihre bestehende Social-Media-Auswertung übernehmen lässt. Fediwings verfügt bereits über viele der dafür benötigten Kennzahlen und eine optionale Instanzverbindung.

## What Changes

- Der Reiter „Follower“ wird zu „Reports“; der bisherige Follower-Verlauf und die Instanzverbindung bleiben erhalten.
- Jahresberichte zeigen Monats- und Jahreswerte für Follower, Wachstum, modellierte Reichweite, Interaktionen, Engagement und Threads.
- Zeitraumbezogener Abruf, Fortschritt, Vollständigkeit und lokale Speicherung ergänzen die bestehende Analyse.
- Tabellen lassen sich für Excel kopieren und als CSV herunterladen. Views und Klicks sind nicht Bestandteil.
- Der bisherige Follower-Direktlink und OAuth-Rücksprünge bleiben kompatibel.

## Capabilities

### New Capabilities

- `reports-dashboard`: Monats- und Jahresreports einschließlich Datenabruf, Kennzahlen, lokaler Speicherung und Export.

### Modified Capabilities

Keine bestehenden OpenSpec-Fähigkeiten vorhanden.

## Impact

Betroffen sind Svelte-Navigation und Follower-Komponente, OAuth-Rücksprünge, Mastodon-Abruf und Thread-Auswertung, Übersetzungen, Tests und Dokumentation. Lokale IndexedDB-Speicherung über Dexie erfordert eine Abhängigkeit und SBOM-/Lizenzprüfung. Keine Änderung an der bestehenden Reichweitenformel oder am Betriebsprofil.
