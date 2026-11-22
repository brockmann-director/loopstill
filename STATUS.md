# Loopstill – Stand (22.11.2026)

Übergabe für neue Chats. Alles Wichtige steht hier, im README und im Code auf `main`.

## Wo es läuft

- Live: https://loopstill.thisisjan.com (CNAME bei Strato: `loopstill` → `brockmann-director.github.io.`, HTTPS erzwungen)
- GitHub Pages aus `main` / root, öffentliches Repo (AGPL-3.0 wegen gifski). Pages-Builds kosten keine Actions-Minuten.
- Aktuelle Version: **0.9** (22.11.2026, 11:39), Anzeige unten rechts.
- Zielgruppe: Jans Kollege, der in der Firma keine Apps installieren darf. Mehrere Leute können es gleichzeitig nutzen, alles läuft lokal im Browser, nichts wird hochgeladen.

## Arbeitsweise

- Vor jedem Push nach `main`: `python3 tools/version.py` (zählt 0.x hoch, setzt Build-Zeit und die `?v=`-Cache-Schlüssel).
- Kein Build-Schritt, keine CDNs, keine externen Schriften (Firmennetze blocken so etwas). Schrift Space Mono liegt in `schrift/` (OFL).
- UI-Texte auf Deutsch. Design-Änderungen erst als Screenshots zeigen, dann live schalten.
- Testen: lokal `python3 -m http.server` + Playwright/Chromium (headless). Echte Testdatei war ein Handy-Schnitt (IMG_9450.MOV, 9 Schnitte).

## Was drin ist (Versionen 0.1–0.9)

- Video ablegen, Analyse **nur auf Knopfdruck** („Schnitte erkennen“ / „Frames finden“), nicht automatisch beim Laden.
- Schneller Pfad: mp4box.js + WebCodecs im Worker (`analyse-worker.js`), inkl. zweitem Durchlauf, wenn der moov-Atom am Dateiende liegt. Fallback über das Video-Element mit Halbierung auf Frame-Genauigkeit (z. B. ProRes in Safari, WebM).
- Schnitterkennung (`analyse-core.js` → `detectCuts`): Spitze über dem lokalen Median (±8 Frames), Empfindlichkeit und kürzeste Einstellung einstellbar. Ersetzt den alten festen Schwellwert aus FrameReel, der bei echtem Material zu wenige/falsche Schnitte fand.
- GIFs: Timeline mit Filmstreifen-Vorschau, In/Out (I/O), Markierung aufheben (G oder ⌥X), Teilen (B), Verbinden, Clips dürfen überlappen, In/Out über Nachbar-Clips ziehbar, Clip-Loop als Schalter (Abspielen läuft sonst durch den Film), Häkchen + Papierkorb zum Löschen, Presets, Ping-Pong, gifski-WASM im Worker.
- Screengrabs: Vorschläge (Top N) nach Schärfe/Kontrast/Farbe/Belichtung/Bildaufbau, Dubletten raus, eigene mit S, frameweise korrigieren, JPEG/PNG.
- Export: eine Datei direkt, mehrere als ZIP; in Chrome/Edge wählbarer Zielordner.
- Workers + gifski werden beim Seitenaufruf vorgeladen, danach geht es offline.
- 0.9: Retro-8-Bit-Design nach Jans Moodboards: warmes Grau `#8e8889`, cremefarbene Fenster, Titelleisten orange/blau/gelb je Bereich, dicke dunkle Linien mit harten Schatten, farbige Icons mit Outline (`ICONS` in `app.js`), bunte Tasten-Kappen im Footer, LCD-Timecode.

## Bekannte Grenzen

- ProRes nur in Safari, kein MXF, keine Dailies/Bibliothek (das bleibt FrameReel vorbehalten).
- Ohne Hardware-Dekodierung dauert 4K länger (60 s 4K ≈ 40 s Analyse).

## Offene Ideen

Keine offenen Punkte. Neue Wünsche einfach in einem neuen Chat nennen und auf diese Datei verweisen.
