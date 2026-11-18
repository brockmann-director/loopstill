# Loopstill

GIFs und Screengrabs aus Filmen, direkt im Browser. Die Browser-Schwester der Mac-App FrameReel (nur die Reiter GIFs und Screengrabs), für alle, die keine Apps installieren dürfen.

**Online:** https://brockmann-director.github.io/loopstill/

Alles läuft lokal im Browser. Das Video wird nirgendwohin hochgeladen, auch die Analyse und das GIF-Encoding passieren auf dem eigenen Rechner.

## Was es kann

- Video ablegen (MP4/MOV mit H.264 oder HEVC; ProRes nur in Safari)
- **GIFs:** Schnitte automatisch erkennen (Empfindlichkeit, kürzeste Einstellung), Clips in der Timeline trimmen (In/Out, Teilen, Verbinden), Format, Breite, Framerate, Tempo, Max. Länge, Vorwärts/Rückwärts/Ping-Pong, Qualität, Presets. Encoder: gifski (WebAssembly).
- **Screengrabs:** die stärksten Bilder über den ganzen Film vorschlagen (Schärfe, Kontrast, Farbe, Belichtung, Bildaufbau, Dubletten raus), eigene mit `S` setzen, frameweise korrigieren, Export als JPEG oder PNG in voller Auflösung.
- Mehrere Dateien kommen als ZIP. In Chrome/Edge kann man stattdessen einen Zielordner wählen.

Tasten: Leertaste, ← → (mit ⇧ 1 s), I, O, B, S, ⌫.

## Technik

- `index.html` + `app.js`: Oberfläche, Timeline, Export
- `analyse-worker.js`: schneller Pfad, zerlegt MP4/MOV mit mp4box.js und dekodiert jedes Frame per WebCodecs
- `analyse-core.js`: Schnitterkennung und Bildbewertung (wie in FrameReel)
- Fallback, wenn der Browser das Video nicht direkt dekodieren kann (z. B. ProRes in Safari): Abtasten über das Video-Element, Schnitte danach per Halbierung aufs Frame genau
- `gif-worker.js`: gifski als WebAssembly in einem eigenen Thread
- Kein Build-Schritt, keine externen Server oder Schriften. GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

## Lizenzen

Loopstill steht unter der GNU AGPL 3.0 (`LICENSE.md`), weil es gifski nutzt.
Enthalten: [gifski-wasm](https://github.com/jamsinclair/gifski-wasm) 2.2.0 (AGPL-3.0, `vendor/gifski`), [mp4box.js](https://github.com/gpac/mp4box.js) 0.5.4 (BSD-3-Clause, `vendor/mp4box-LICENSE.txt`).
