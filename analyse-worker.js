/* Schneller Analyse-Pfad: MP4/MOV mit mp4box.js zerlegen, jedes Frame mit WebCodecs
   dekodieren (meist per Hardware) und für Schnitte + Screengrab-Bewertung auswerten.
   Klappt etwas nicht (Codec, Container, alter Browser), meldet der Worker „unsupported“
   und das Hauptfenster analysiert langsamer über das Video-Element. */
importScripts('vendor/mp4box.all.min.js', 'analyse-core.js');

const A = self.Analyse;
let cancelled = false;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'cancel') { cancelled = true; return; }
  if (msg.type !== 'start') return;
  cancelled = false;
  try {
    const result = await run(msg.file, msg.stillInterval || 0.5);
    if (!cancelled) self.postMessage(Object.assign({ type: 'done' }, result));
  } catch (err) {
    if (cancelled) return;
    self.postMessage({ type: 'unsupported', reason: String((err && err.message) || err) });
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function codecDescription(mp4, trackId) {
  const trak = mp4.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.av1C;
    if (box) {
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // ohne Box-Kopf
    }
  }
  return undefined;
}

async function run(file, stillInterval) {
  if (typeof VideoDecoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('WebCodecs nicht verfügbar');
  }

  const mp4 = MP4Box.createFile();
  let track = null;
  let parseError = null;
  mp4.onError = (err) => { parseError = err || 'mp4box'; };
  mp4.onReady = (info) => { track = info.videoTracks && info.videoTracks[0]; if (!track) parseError = 'keine Videospur'; };

  // Kleine GPU-Leinwände: Skalierung auf der Grafikkarte, zurückgelesen werden nur wenige Pixel.
  const sigCanvas = new OffscreenCanvas(A.SIG_W, A.SIG_H);
  const sigCtx = sigCanvas.getContext('2d', { willReadFrequently: false });
  let stillCanvas = null, stillCtx = null, stillH = 180;

  const times = [], values = [], samples = [];
  let prevSig = null, firstTs = null, nextStillT = 0, decodedFrames = 0;
  let duration = 0, lastProgress = -1, decodeError = null;

  const decoder = new VideoDecoder({
    output(frame) {
      try {
        if (firstTs === null) firstTs = frame.timestamp;
        const t = (frame.timestamp - firstTs) / 1e6;
        sigCtx.drawImage(frame, 0, 0, A.SIG_W, A.SIG_H);
        const sig = A.signature(sigCtx.getImageData(0, 0, A.SIG_W, A.SIG_H).data);
        if (prevSig) { times.push(t); values.push(A.difference(prevSig, sig)); }
        prevSig = sig;
        if (t >= nextStillT) {
          nextStillT = t + stillInterval;
          stillCtx.drawImage(frame, 0, 0, A.STILL_W, stillH);
          const m = A.stillMetrics(stillCtx.getImageData(0, 0, A.STILL_W, stillH).data, A.STILL_W, stillH);
          samples.push({ t, m });
        }
        decodedFrames++;
        if (duration > 0) {
          const p = Math.min(1, t / duration);
          if (p - lastProgress > 0.005) { lastProgress = p; self.postMessage({ type: 'progress', p }); }
        }
      } finally {
        frame.close();
      }
    },
    error(err) { decodeError = err; },
  });

  let configured = false, extracted = 0;
  async function configure() {
    const config = {
      codec: track.codec.startsWith('vp08') ? 'vp8' : track.codec,
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      description: codecDescription(mp4, track.id),
      optimizeForLatency: false,
    };
    const support = await VideoDecoder.isConfigSupported(config);
    if (!support.supported) throw new Error('Codec ' + track.codec + ' wird vom Browser nicht dekodiert');
    decoder.configure(config);
    duration = track.duration / track.timescale;
    stillH = Math.max(2, Math.round(A.STILL_W * track.video.height / track.video.width));
    stillCanvas = new OffscreenCanvas(A.STILL_W, stillH);
    stillCtx = stillCanvas.getContext('2d', { willReadFrequently: false });
    mp4.onSamples = (id, user, list) => {
      extracted += list.length;
      for (const s of list) {
        decoder.decode(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * s.cts) / s.timescale,
          duration: (1e6 * s.duration) / s.timescale,
          data: s.data,
        }));
      }
      if (list.length) mp4.releaseUsedSamples(id, list[list.length - 1].number + 1);
    };
    mp4.setExtractionOptions(track.id, null, { nbSamples: 50 });
    mp4.start();
    configured = true;
  }

  const CHUNK = 4 * 1024 * 1024;
  let offset = 0, steps = 0;
  while (offset < file.size) {
    if (cancelled) throw new Error('abgebrochen');
    if (++steps > 1e6) throw new Error('Datei lässt sich nicht lesen');
    const buf = await file.slice(offset, offset + CHUNK).arrayBuffer();
    buf.fileStart = offset;
    const next = mp4.appendBuffer(buf, offset + buf.byteLength >= file.size);
    if (parseError) throw new Error(String(parseError));
    if (track && !configured) await configure();
    if (decodeError) throw decodeError;
    while (decoder.decodeQueueSize > 24) {
      if (cancelled) throw new Error('abgebrochen');
      await sleep(4);
    }
    offset = (typeof next === 'number' && next !== offset) ? next : offset + buf.byteLength;
  }
  if (!track) throw new Error('kein MP4/MOV');
  // Liegt der Index (moov) am Dateiende, hat mp4box die Bilddaten davor übersprungen:
  // dann die Daten ab dem ersten Frame noch einmal der Reihe nach einlesen.
  if (extracted < track.nb_samples) {
    const trak = mp4.getTrackById(track.id);
    const first = trak.samples && trak.samples.length ? trak.samples[extracted] || trak.samples[0] : null;
    offset = first ? first.offset : 0;
    while (offset < file.size && extracted < track.nb_samples) {
      if (cancelled) throw new Error('abgebrochen');
      const buf = await file.slice(offset, offset + CHUNK).arrayBuffer();
      buf.fileStart = offset;
      mp4.appendBuffer(buf, offset + buf.byteLength >= file.size);
      if (parseError) throw new Error(String(parseError));
      if (decodeError) throw decodeError;
      while (decoder.decodeQueueSize > 24) {
        if (cancelled) throw new Error('abgebrochen');
        await sleep(4);
      }
      offset += buf.byteLength;
    }
  }
  mp4.flush();
  await decoder.flush();
  if (decodeError) throw decodeError;
  decoder.close();
  if (decodedFrames < 2) throw new Error('keine Frames dekodiert');

  const fps = track.nb_samples > 1 && duration > 0 ? track.nb_samples / duration : 25;
  return {
    times: Float64Array.from(times),
    values: Float32Array.from(values),
    samples,
    fps,
    exact: true,
  };
}
