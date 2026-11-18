/* Loopstill – GIFs und Screengrabs aus Filmen, komplett im Browser. */
(() => {
'use strict';
const A = window.Analyse;
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad = (n, l = 2) => String(n).padStart(l, '0');

// ---------- Icons ----------
const ICONS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  play: '<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 18M8 15.5L20 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  expand: '<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4h4"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  target: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  unmark: '<path d="M8 5H5v14h3M16 5h3v14h-3"/><path d="M10 9.5l4 5M14 9.5l-4 5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = svg(el.dataset.icon); });
}
function setIcon(el, name) { el.dataset.icon = name; el.innerHTML = svg(name); }

// ---------- Einstellungen ----------
const ASPECTS = [['original', 'Original', null], ['square', '1:1', 1], ['portrait45', '4:5', 4 / 5], ['story916', '9:16', 9 / 16], ['wide169', '16:9', 16 / 9], ['scope239', '2.39:1', 2.39]];
const WIDTHS = [320, 480, 640, 800, 960, 1080, 1280, 1600, 1920];
const FPS = [10, 12, 15, 20, 25, 30];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const DURATIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15];
const PLAYBACK = [['forward', 'Vorwärts'], ['reverse', 'Rückwärts'], ['pingPong', 'Ping-Pong']];
const DEFAULT_GIF = { aspect: 'original', width: 640, fps: 15, speed: 1, playback: 'forward', maxDuration: 0, quality: 90 };
const PRESETS = [
  ['Max. Qualität (1920 px, 25 fps)', { aspect: 'original', width: 1920, fps: 25, quality: 100 }],
  ['Pitch-Deck (16:9, 960 px)', { aspect: 'wide169', width: 960, fps: 20 }],
  ['Instagram Feed (4:5)', { aspect: 'portrait45', width: 1080, fps: 15, maxDuration: 6 }],
  ['Story (9:16)', { aspect: 'story916', width: 640, fps: 15, maxDuration: 6 }],
  ['Quadrat Loop (1:1)', { aspect: 'square', width: 640, fps: 15, playback: 'pingPong', maxDuration: 4 }],
  ['Klein für Mail/Slack', { aspect: 'original', width: 480, fps: 12, maxDuration: 4 }],
];
const STILL_FORMATS = [['jpeg', 'JPEG'], ['png', 'PNG']];
const MAX_WIDTHS = [0, 3840, 2560, 1920, 1280];
const COUNTS = [10, 25, 50, 100, 0];

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem('loopstill.' + key)); return v && typeof v === 'object' ? Object.assign({}, fallback, v) : Object.assign({}, fallback); }
  catch { return Object.assign({}, fallback); }
}
function save(key, value) { try { localStorage.setItem('loopstill.' + key, JSON.stringify(value)); } catch {} }

// ---------- Zustand ----------
const S = {
  mode: 'gifs',
  file: null, url: null, base: 'Film', gen: 0,
  duration: 0, vw: 0, vh: 0, fps: 25, fpsKnown: false,
  clips: [], activeClip: null,
  stills: [], activeStill: null,
  view: { a: 0, b: 1 },
  gif: load('gif', DEFAULT_GIF),
  still: load('still', { format: 'jpeg', quality: 92, maxWidth: 0, count: 25 }),
  detect: load('detect', { sensitivity: 0.5, minLen: 0.5 }),
  ana: null,
  exporting: null,
  dir: null,
};
let uid = 1;
const newId = () => uid++;

// ---------- Video-Elemente ----------
const player = $('player');
const grabV = makeHiddenVideo();   // Export
const thumbV = makeHiddenVideo();  // Vorschaubilder
function makeHiddenVideo() {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.className = 'offscreen';
  v.setAttribute('aria-hidden', 'true');
  document.body.appendChild(v);
  return v;
}
function once(el, ok, fail = 'error', timeout = 0) {
  return new Promise((resolve, reject) => {
    let timer;
    const clean = () => { el.removeEventListener(ok, onOk); el.removeEventListener(fail, onFail); clearTimeout(timer); };
    const onOk = () => { clean(); resolve(); };
    const onFail = () => { clean(); reject(new Error('Video-Fehler')); };
    el.addEventListener(ok, onOk); el.addEventListener(fail, onFail);
    if (timeout) timer = setTimeout(() => { clean(); resolve(); }, timeout);
  });
}
async function ensureLoaded(v) {
  if (v.src !== S.url) { v.src = S.url; }
  if (v.readyState < 2) await once(v, 'loadeddata', 'error', 20000);
}
/** Springt exakt auf t und wartet, bis das Bild da ist. */
async function seek(v, t) {
  await ensureLoaded(v);
  t = clamp(t, 0, Math.max(0, (v.duration || S.duration) - 0.001));
  const p = once(v, 'seeked', 'error', 8000);
  v.currentTime = t;
  await p;
  if (v.readyState < 2) await once(v, 'canplay', 'error', 3000);
}

// ---------- Zeit ----------
const fpsRound = () => Math.max(1, Math.round(S.fps));
const frameDur = () => 1 / S.fps;
const frameIndex = (t) => Math.floor(t * S.fps + 1e-4);
function tc(t) {
  const fr = fpsRound();
  const f = Math.max(0, Math.floor(t * S.fps + 1e-4));
  const ff = f % fr;
  const s = Math.floor(f / fr);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(sec) + ':' + pad(ff);
}
const secs = (d) => d.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
const fileTc = (t) => tc(t).replace(/:/g, '-');
function bytes(n) {
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
}

function toast(text, ms = 3200) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Datei öffnen ----------
const fileInput = $('fileInput');
$('openBtn').onclick = () => fileInput.click();
$('dropzone').onclick = () => fileInput.click();
$('dropzone').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
fileInput.onchange = () => { if (fileInput.files[0]) openFile(fileInput.files[0]); fileInput.value = ''; };
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('dropzone').classList.add('over'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropzone').classList.remove('over'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('dropzone').classList.remove('over');
  const f = [...(e.dataTransfer.files || [])].find((x) => /^video\//.test(x.type) || /\.(mov|mp4|m4v|webm|mkv|mxf)$/i.test(x.name));
  if (f) openFile(f); else if (e.dataTransfer.files.length) toast('Das ist keine Videodatei.');
});

function showOpenError(msg) {
  $('emptyView').hidden = false; $('studio').hidden = true;
  const el = $('openError'); el.textContent = msg; el.hidden = false;
}

async function openFile(file) {
  if (/\.mxf$/i.test(file.name)) {
    showOpenError('MXF kann kein Browser lesen. Bitte vorher in MOV oder MP4 wandeln (z. B. mit FrameReel oder Resolve).');
    return;
  }
  cancelAnalysis(); cancelExport();
  const gen = ++S.gen;
  if (S.url) URL.revokeObjectURL(S.url);
  thumbCache.clear(); thumbQueue.length = 0; stripImgs.clear();
  S.file = file; S.url = URL.createObjectURL(file);
  S.base = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_') || 'Film';
  S.fps = 25; S.fpsKnown = false; S.clipsEdited = false; S.wantCuts = false; S.wantStills = false;
  cancelAnalysis(); S.ana = null;
  $('openError').hidden = true;
  player.src = S.url;
  try {
    await once(player, 'loadedmetadata', 'error', 0);
    if (player.readyState < 2) await once(player, 'loadeddata', 'error', 15000);
  } catch {
    if (gen !== S.gen) return;
    showOpenError(unsupportedText(file));
    return;
  }
  if (gen !== S.gen) return;
  if (!player.videoWidth || !isFinite(player.duration) || player.duration <= 0) {
    showOpenError(unsupportedText(file));
    return;
  }
  S.duration = player.duration; S.vw = player.videoWidth; S.vh = player.videoHeight;
  S.clips = [{ id: newId(), start: 0, end: S.duration, o0: 0, o1: S.duration, sel: true }];
  S.activeClip = S.clips[0].id;
  S.stills = []; S.activeStill = null;
  S.view = { a: 0, b: S.duration };
  clearResults();
  grabV.src = S.url; thumbV.src = S.url;
  $('fileName').textContent = file.name;
  $('fileName').title = `${file.name} · ${S.vw}×${S.vh} · ${bytes(file.size)}`;
  $('emptyView').hidden = true; $('studio').hidden = false;
  document.title = file.name + ' – Loopstill';
  player.currentTime = 0;
  renderAll();
}

function unsupportedText(file) {
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  let msg = `„${file.name}“ kann dieser Browser nicht abspielen.`;
  if (/\.mov$/i.test(file.name) && !safari) msg += ' Ist es ProRes? Das klappt nur in Safari auf dem Mac.';
  else msg += ' Am sichersten sind MP4/MOV mit H.264.';
  return msg;
}

// ---------- Analyse ----------
// Worker und Encoder gleich beim Laden holen: danach braucht die Seite kein Netz mehr.
let spareWorker = null;
function prepareSpare() { try { if (!spareWorker) spareWorker = new Worker('analyse-worker.js'); } catch {} }
function stillInterval() { return Math.max(0.5, S.duration / 5000); }

function startAnalysis() {
  const gen = S.gen;
  const ana = S.ana = { gen, running: true, progress: 0, exact: false, slow: false, times: null, values: null, samples: null, refined: new Map(), worker: null, cancelled: false };
  renderAnalysis();
  let worker;
  try { worker = spareWorker || new Worker('analyse-worker.js'); } catch { worker = null; }
  spareWorker = null;
  setTimeout(prepareSpare, 0);
  if (!worker) { fallbackAnalysis(ana); return; }
  ana.worker = worker;
  worker.onmessage = (e) => {
    const m = e.data;
    if (ana.cancelled) return;
    if (m.type === 'progress') { ana.progress = m.p; renderAnalysisProgress(); }
    else if (m.type === 'done') {
      worker.terminate(); ana.worker = null;
      if (m.fps > 1 && m.fps < 241) { S.fps = m.fps; S.fpsKnown = true; }
      finishAnalysis(ana, m.times, m.values, m.samples, true);
    } else if (m.type === 'unsupported') {
      worker.terminate(); ana.worker = null;
      console.info('Loopstill: schneller Analysemodus nicht verfügbar:', m.reason);
      fallbackAnalysis(ana);
    }
  };
  worker.onerror = (e) => { e.preventDefault(); worker.terminate(); ana.worker = null; if (!ana.cancelled) fallbackAnalysis(ana); };
  worker.postMessage({ type: 'start', file: S.file, stillInterval: stillInterval() });
}

function cancelAnalysis() {
  const ana = S.ana;
  if (!ana) return;
  ana.cancelled = true; ana.running = false;
  if (ana.worker) { ana.worker.terminate(); ana.worker = null; }
  if (ana.video) { ana.video.removeAttribute('src'); ana.video.load(); ana.video.remove(); ana.video = null; }
}

function stopAnalysisByUser() {
  const ana = S.ana;
  if (!ana || !ana.running) return;
  cancelAnalysis();
  ana.stopped = true;
  renderAnalysis();
}

/** Langsamer Weg über das Video-Element (z. B. ProRes in Safari, WebM, ältere Browser). */
async function fallbackAnalysis(ana) {
  ana.slow = true; ana.progress = 0; renderAnalysis();
  const v = ana.video = makeHiddenVideo();
  const sigC = document.createElement('canvas'); sigC.width = A.SIG_W; sigC.height = A.SIG_H;
  const sigX = sigC.getContext('2d', { willReadFrequently: true });
  const sh = Math.max(2, Math.round(A.STILL_W * S.vh / S.vw));
  const stC = document.createElement('canvas'); stC.width = A.STILL_W; stC.height = sh;
  const stX = stC.getContext('2d', { willReadFrequently: true });
  const step = Math.max(0.25, S.duration / 4000);
  const stillEvery = Math.max(1, Math.round(stillInterval() / step));
  const times = [], values = [], samples = [], sampleTimes = [];
  let prev = null;
  try {
    v.src = S.url;
    await ensureLoaded(v);
    let i = 0;
    for (let t = step / 2; t < S.duration; t += step, i++) {
      if (ana.cancelled) return;
      await seek(v, t);
      sigX.drawImage(v, 0, 0, A.SIG_W, A.SIG_H);
      const sig = A.signature(sigX.getImageData(0, 0, A.SIG_W, A.SIG_H).data);
      if (prev) { times.push(t); values.push(A.difference(prev, sig)); sampleTimes.push(t - step); }
      prev = sig;
      if (i % stillEvery === 0) {
        stX.drawImage(v, 0, 0, A.STILL_W, sh);
        samples.push({ t, m: A.stillMetrics(stX.getImageData(0, 0, A.STILL_W, sh).data, A.STILL_W, sh) });
      }
      ana.progress = t / S.duration;
      if (i % 4 === 0) renderAnalysisProgress();
    }
  } catch (err) {
    if (ana.cancelled) return;
    console.warn(err);
  }
  if (ana.cancelled) return;
  ana.prevTimes = sampleTimes;
  finishAnalysis(ana, Float64Array.from(times), Float32Array.from(values), samples, false);
}

function finishAnalysis(ana, times, values, samples, exact) {
  if (ana.cancelled || ana.gen !== S.gen) return;
  Object.assign(ana, { running: false, progress: 1, times, values, samples, exact });
  if (S.wantCuts) applyCuts();
  if (S.wantStills) applySuggestions(true);
  renderAll();
  if (S.wantCuts && S.mode === 'gifs') announce('cuts');
  if (S.wantStills && S.mode === 'stills') announce('stills');
  if (!exact) refineCuts(ana);
}

function cutTimes() {
  const ana = S.ana;
  if (!ana || !ana.times) return [];
  const idx = A.detectCuts(ana.times, ana.values, S.detect.sensitivity, S.detect.minLen, S.duration);
  return idx.map((i) => ({ i, t: ana.refined.has(i) ? ana.refined.get(i) : ana.times[i] }));
}

function applyCuts() {
  if (!S.ana || !S.ana.times) return;
  const cuts = cutTimes().map((c) => c.t);
  const bounds = [0, ...cuts, S.duration];
  const old = new Map(S.clips.map((c) => [Math.round(c.start * 100), c.sel]));
  S.clips = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    if (bounds[k + 1] - bounds[k] < 0.02) continue;
    const start = bounds[k];
    S.clips.push({ id: newId(), start, end: bounds[k + 1], o0: start, o1: bounds[k + 1], sel: old.has(Math.round(start * 100)) ? old.get(Math.round(start * 100)) : true });
  }
  const t = player.currentTime;
  S.activeClip = (S.clips.find((c) => t >= c.start && t < c.end) || S.clips[0]).id;
}

/** Im langsamen Modus liegen Schnitte nur ungefähr: per Halbierung aufs Frame genau suchen. */
async function refineCuts(ana) {
  if (ana.refining) return;
  ana.refining = true;
  const v = ana.video;
  if (!v) { ana.refining = false; return; }
  const c = document.createElement('canvas'); c.width = A.SIG_W; c.height = A.SIG_H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const sigAt = async (t) => { await seek(v, t); x.drawImage(v, 0, 0, A.SIG_W, A.SIG_H); return A.signature(x.getImageData(0, 0, A.SIG_W, A.SIG_H).data); };
  try {
    for (;;) {
      const todo = cutTimes().filter((cut) => !ana.refined.has(cut.i));
      if (!todo.length || ana.cancelled) break;
      for (const cut of todo) {
        if (ana.cancelled) return;
        let lo = ana.prevTimes[cut.i], hi = ana.times[cut.i];
        let sLo = await sigAt(lo), sHi = await sigAt(hi);
        while (hi - lo > frameDur() * 1.01) {
          const mid = (lo + hi) / 2;
          const sMid = await sigAt(mid);
          if (A.difference(sLo, sMid) > A.difference(sMid, sHi)) { hi = mid; sHi = sMid; } else { lo = mid; sLo = sMid; }
        }
        // Erstes Frame der neuen Einstellung, auf Frame-Anfang gerundet
        ana.refined.set(cut.i, Math.min(S.duration, (frameIndex(hi)) / S.fps));
      }
      while (S.exporting && !ana.cancelled) await new Promise((r) => setTimeout(r, 300));
      if (ana.cancelled) return;
      if (!S.clipsEdited && S.wantCuts) { applyCuts(); renderClips(); renderTimeline(); renderAnalysis(); }
    }
  } catch (err) { console.warn(err); }
  ana.refining = false;
}

function applySuggestions(fresh) {
  if (!S.ana || !S.ana.samples) return;
  const picks = A.pickStills(S.ana.samples, S.still.count, cutTimes().map((c) => c.t));
  const manual = S.stills.filter((s) => s.manual);
  const oldSel = new Map(S.stills.map((s) => [Math.round(s.t * 10), s.sel]));
  const auto = picks
    .filter((p) => !manual.some((m) => Math.abs(m.t - p.t) < 0.5))
    .map((p) => ({ id: newId(), t: p.t, score: p.score, manual: false, sel: !fresh && oldSel.has(Math.round(p.t * 10)) ? oldSel.get(Math.round(p.t * 10)) : true }));
  S.stills = [...manual, ...auto].sort((a, b) => a.t - b.t);
  if (!S.stills.some((s) => s.id === S.activeStill)) S.activeStill = null;
}

// ---------- Vorschaubilder ----------
const thumbCache = new Map();
const stripImgs = new Map();
let stripGen = 0;
const thumbQueue = [];
let thumbBusy = false;
const thumbCanvas = document.createElement('canvas');
const thumbKey = (t) => t.toFixed(2);
const thumbObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    thumbObserver.unobserve(e.target);
    requestThumb(parseFloat(e.target.dataset.t));
  }
}, { rootMargin: '200px' });

function thumbImg(t, cls = 'thumb') {
  const img = document.createElement('img');
  img.className = cls; img.alt = ''; img.decoding = 'async';
  img.dataset.thumb = thumbKey(t); img.dataset.t = String(t);
  const cached = thumbCache.get(thumbKey(t));
  if (cached) img.src = cached; else thumbObserver.observe(img);
  return img;
}
function requestThumb(t, strip) {
  const key = thumbKey(t);
  if (thumbCache.has(key)) return;
  const queued = thumbQueue.find((j) => j.key === key);
  if (queued) { if (strip) { queued.strip = true; queued.gen = stripGen; } return; }
  thumbQueue.push({ t, key, strip: !!strip, gen: stripGen });
  pumpThumbs();
}
async function pumpThumbs() {
  if (thumbBusy) return;
  thumbBusy = true;
  const gen = S.gen;
  try {
    while (thumbQueue.length) {
      const job = thumbQueue.pop(); // zuletzt sichtbar zuerst
      if (thumbCache.has(job.key)) continue;
      const wanted = (job.strip && job.gen === stripGen) || document.querySelector(`img[data-thumb="${job.key}"]`);
      if (!wanted) continue;
      await seek(thumbV, job.t);
      if (gen !== S.gen) return;
      const w = 320, h = Math.max(2, Math.round(w * S.vh / S.vw));
      thumbCanvas.width = w; thumbCanvas.height = h;
      const x = thumbCanvas.getContext('2d');
      x.drawImage(thumbV, 0, 0, w, h);
      const url = thumbCanvas.toDataURL('image/jpeg', 0.8);
      thumbCache.set(job.key, url);
      document.querySelectorAll(`img[data-thumb="${job.key}"]`).forEach((img) => { img.src = url; });
      if (job.strip) { const im = new Image(); im.onload = renderTimeline; im.src = url; stripImgs.set(job.key, im); }
      renderTimeline();
    }
  } catch (err) { console.warn(err); }
  finally { thumbBusy = false; }
}

// ---------- Darstellung ----------
function renderAll() {
  document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== S.mode; });
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  $('zoomBtn').title = S.mode === 'gifs' ? 'Auf den Clip zoomen' : 'Hineinzoomen';
  renderAnalysis();
  renderClips();
  renderStills();
  renderGifSettings();
  renderStillSettings();
  renderDest();
  renderTimeline();
  renderTime();
}

function analysisHTML() {
  const ana = S.ana;
  if (!ana) return '';
  if (ana.running) {
    const label = ana.slow ? 'Analysiere (langsamer Modus)' : 'Analysiere Frames';
    return `<div style="display:flex;align-items:center;gap:10px"><div class="progress"><i class="anaBar" style="width:${(ana.progress * 100).toFixed(1)}%"></i></div>
      <button class="icon" data-act="stopAna" title="Analyse abbrechen" data-icon="close"></button></div>
      <div class="note"><span class="anaLabel">${label} … ${Math.round(ana.progress * 100)} %</span>${ana.slow ? '<br>Dieser Browser kann das Video nicht direkt dekodieren, deshalb dauert es länger.' : ''}</div>`;
  }
  if (ana.stopped) return `<div class="note">Analyse abgebrochen. <button class="btn link" data-act="restartAna" style="padding:0">Neu starten</button></div>`;
  if (!ana.times) return '';
  if (S.mode === 'gifs') {
    if (!S.wantCuts) return '';
    const n = cutTimes().length;
    return `<div class="note">${n === 0 ? 'Keine Schnitte gefunden.' : `${n} Schnitt${n === 1 ? '' : 'e'} gefunden, ${S.clips.length} Clips.`}${ana.slow && ana.refining ? ' Schnitte werden noch aufs Frame genau gesetzt …' : ''}</div>`;
  }
  if (!S.wantStills) return '';
  const auto = S.stills.filter((s) => !s.manual).length;
  return `<div class="note">${auto} Vorschl${auto === 1 ? 'ag' : 'äge'} aus ${S.ana.samples.length} bewerteten Frames.</div>`;
}
function renderAnalysis() {
  for (const id of ['anaBlockG', 'anaBlockS']) {
    const el = $(id);
    el.innerHTML = analysisHTML();
    el.hidden = !el.innerHTML.trim();
    paintIcons(el);
  }
  renderFindButton();
}
function renderAnalysisProgress() {
  const ana = S.ana;
  if (!ana) return;
  document.querySelectorAll('.anaBar').forEach((b) => { b.style.width = (ana.progress * 100).toFixed(1) + '%'; });
  document.querySelectorAll('.anaLabel').forEach((l) => { l.textContent = `${ana.slow ? 'Analysiere (langsamer Modus)' : 'Analysiere Frames'} … ${Math.round(ana.progress * 100)} %`; });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'stopAna') stopAnalysisByUser();
  if (b.dataset.act === 'restartAna') startAnalysis();
  if (b.dataset.act === 'cancelExport') cancelExport();
  if (b.dataset.act === 'pickDir') pickDir();
  if (b.dataset.act === 'clearDir') { S.dir = null; renderDest(); }
});

// Clips
const activeClip = () => S.clips.find((c) => c.id === S.activeClip) || S.clips[0];
function renderClips() {
  const list = $('clipList');
  list.textContent = '';
  const frag = document.createDocumentFragment();
  S.clips.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'clip' + (c.id === S.activeClip ? ' active' : '');
    row.dataset.id = c.id;
    const chk = document.createElement('button');
    chk.className = 'check' + (c.sel ? ' on' : '');
    chk.title = c.sel ? 'Nicht exportieren' : 'Exportieren';
    chk.innerHTML = svg('check');
    chk.onclick = (e) => { e.stopPropagation(); c.sel = !c.sel; renderClips(); renderTimeline(); renderGifSettings(); };
    const info = document.createElement('div');
    info.innerHTML = `<div class="t1">${S.clips.length === 1 && c.start < 0.01 && c.end > S.duration - 0.01 ? 'Ganzer Film' : 'Clip ' + (i + 1)}</div>
      <div class="t2 mono">${tc(c.start)} – ${tc(c.end)} · ${secs(c.end - c.start)}</div>`;
    row.append(chk, thumbImg(c.start + Math.min(0.4, (c.end - c.start) / 2)), info);
    row.onclick = () => selectClip(c, true);
    frag.appendChild(row);
  });
  list.appendChild(frag);
  if (!S.clips.length) list.innerHTML = '<div class="empty-note"><b>Keine Clips</b>Mit ↺ unter Schnitterkennung kommt der ganze Film zurück.</div>';
  const sel = S.clips.filter((c) => c.sel).length;
  $('clipCount').textContent = `${S.clips.length} Clip${S.clips.length === 1 ? '' : 's'} · ${sel} ausgewählt`;
  renderExportButtons();
}
function selectClip(c, seekToStart) {
  S.activeClip = c.id;
  if (seekToStart) setTime(c.start + 0.001);
  if (c.start < S.view.a || c.end > S.view.b) { if (S.view.b - S.view.a < S.duration) zoomToClip(); }
  document.querySelectorAll('.clip').forEach((r) => r.classList.toggle('active', Number(r.dataset.id) === c.id));
  renderTimeline(); renderGifSettings();
}

// Screengrabs
const activeStill = () => S.stills.find((s) => s.id === S.activeStill);
function renderStills() {
  const grid = $('stillGrid');
  grid.textContent = '';
  if (!S.stills.length) {
    const running = S.ana && S.ana.running;
    grid.innerHTML = `<div class="empty-note"><b>${running ? 'Suche die stärksten Bilder …' : 'Noch keine Screengrabs'}</b>${running ? 'Die Vorschläge erscheinen, sobald die Analyse durch ist.' : '„Frames finden“ schlägt die stärksten Bilder des Films vor. Eigene Screengrabs setzt du mit S an der Playhead-Position.'}</div>`;
  } else {
    const g = document.createElement('div');
    g.className = 'grid';
    g.style.setProperty('--ar', `${S.vw}/${S.vh}`);
    for (const s of S.stills) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (s.id === S.activeStill ? ' active' : '') + (s.sel ? '' : ' off');
      cell.dataset.id = s.id;
      const pic = document.createElement('div'); pic.className = 'pic';
      const chk = document.createElement('button');
      chk.className = 'check' + (s.sel ? ' on' : ''); chk.innerHTML = svg('check');
      chk.title = s.sel ? 'Nicht exportieren' : 'Exportieren';
      chk.onclick = (e) => { e.stopPropagation(); s.sel = !s.sel; renderStills(); renderTimeline(); };
      pic.append(thumbImg(s.t, ''), chk);
      const cap = document.createElement('div'); cap.className = 'cap';
      cap.innerHTML = `<span class="mono">${tc(s.t)}</span><span>${s.manual ? 'manuell' : Math.round(s.score * 100) + ' %'}</span>`;
      cell.append(pic, cap);
      cell.onclick = () => selectStill(s);
      g.appendChild(cell);
    }
    grid.appendChild(g);
  }
  const sel = S.stills.filter((s) => s.sel).length;
  $('stillCount').textContent = `${S.stills.length} Screengrab${S.stills.length === 1 ? '' : 's'} · ${sel} ausgewählt`;
  renderStillEditor();
  renderExportButtons();
}
function selectStill(s) {
  S.activeStill = s.id;
  setTime(s.t);
  document.querySelectorAll('.cell').forEach((c) => c.classList.toggle('active', Number(c.dataset.id) === s.id));
  renderStillEditor(); renderTimeline();
}
function renderStillEditor() {
  const s = activeStill();
  $('stillEditor').hidden = !s;
  if (!s) return;
  $('stillKind').textContent = s.manual ? 'Manuell gesetzt' : 'Vorschlag';
  $('stillTime').textContent = tc(s.t);
}
function updateStill(s, t) {
  s.t = clamp(t, 0, S.duration - 0.001);
  setTime(s.t);
  S.stills.sort((a, b) => a.t - b.t);
  renderStills(); renderTimeline();
}
function addStillAtPlayhead() {
  const t = player.currentTime;
  const exist = S.stills.find((s) => Math.abs(s.t - t) < frameDur() / 2);
  if (exist) { selectStill(exist); return; }
  const s = { id: newId(), t, score: 0, manual: true, sel: true };
  S.stills.push(s); S.stills.sort((a, b) => a.t - b.t);
  S.activeStill = s.id;
  renderStills(); renderTimeline();
  if (S.mode !== 'stills') toast(`Screengrab bei ${tc(t)} gesetzt`);
}
function removeStill(s) {
  S.stills = S.stills.filter((x) => x !== s);
  if (S.activeStill === s.id) S.activeStill = null;
  renderStills(); renderTimeline();
}

// GIF-Einstellungen
function fillSelect(sel, options, value) {
  sel.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.value = String(value);
}
function fillSeg(el, options, value, onPick) {
  el.innerHTML = options.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(value) ? 'on' : ''}">${l}</button>`).join('');
  el.onclick = (e) => { const b = e.target.closest('button'); if (b) onPick(b.dataset.v); };
}
function gifSize() {
  const g = S.gif;
  if (!S.vw) return { w: 0, h: 0 };
  const ratio = (ASPECTS.find((a) => a[0] === g.aspect) || ASPECTS[0])[2] || S.vw / S.vh;
  const maxW = Math.min(S.vw, S.vh * ratio);
  const width = Math.min(g.width > 0 ? g.width : Infinity, Math.floor(maxW));
  const even = (x) => Math.max(2, Math.round(x / 2) * 2);
  return { w: even(width), h: even(width / ratio) };
}
function gifTimes(clip) {
  const g = S.gif;
  const len = clip.end - clip.start;
  const span = g.maxDuration > 0 ? Math.min(len, g.maxDuration * g.speed) : len;
  const out = span / g.speed;
  const n = Math.max(1, Math.round(out * g.fps));
  const step = span / n;
  return Array.from({ length: n }, (_, k) => clip.start + (k + 0.5) * step);
}
function gifFrameCount(clip) {
  const n = gifTimes(clip).length;
  return S.gif.playback === 'pingPong' && n > 2 ? n * 2 - 2 : Math.max(2, n);
}
function renderGifSettings() {
  const g = S.gif;
  fillSelect($('preset'), [['', 'Presets'], ...PRESETS.map((p, i) => [String(i), p[0]])], '');
  fillSelect($('aspect'), ASPECTS.map((a) => [a[0], a[1]]), g.aspect);
  fillSelect($('width'), [...WIDTHS.map((w) => [w, w + ' px']), [0, 'Original']], g.width);
  fillSelect($('fps'), FPS.map((f) => [f, f + ' fps']), g.fps);
  fillSelect($('speed'), SPEEDS.map((s) => [s, String(s).replace('.', ',') + '×']), g.speed);
  fillSelect($('maxDur'), [[0, 'Ganzer Clip'], ...DURATIONS.map((d) => [d, d + ' s'])], g.maxDuration);
  fillSeg($('playback'), PLAYBACK, g.playback, (v) => { g.playback = v; saveGif(); });
  $('quality').value = g.quality;
  $('qualityVal').textContent = String(g.quality);
  $('sens').value = Math.round(S.detect.sensitivity * 100);
  $('sensVal').textContent = Math.round(S.detect.sensitivity * 100) + ' %';
  $('minLen').value = S.detect.minLen;
  const { w, h } = gifSize();
  const c = activeClip();
  let info = `Ausgabe: ${w} × ${h} px`;
  if (c) {
    const frames = gifFrameCount(c);
    const est = estimateGifBytes(w, h, frames);
    info += ` · Clip ${S.clips.indexOf(c) + 1}: ${frames} Frames, ${secs(frames / g.fps)}, etwa ${bytes(est)}`;
    if (w * h * 4 * frames > GIF_MEMORY_LIMIT) info += '<br><span class="warn">Zu groß für den Browser: kleinere Breite oder kürzere Länge wählen.</span>';
  }
  $('gifInfo').innerHTML = info;
}
// Grobe Schätzung, gifski liegt je nach Motiv meist bei 0,3–1 Byte pro Pixel und Frame.
function estimateGifBytes(w, h, frames) { return w * h * frames * (0.25 + 0.55 * (S.gif.quality - 50) / 50); }
const GIF_MEMORY_LIMIT = 900 * 1024 * 1024;
function saveGif() { save('gif', S.gif); renderGifSettings(); }

$('preset').onchange = (e) => {
  const p = PRESETS[Number(e.target.value)];
  if (!p) return;
  S.gif = Object.assign({}, DEFAULT_GIF, p[1]);
  saveGif();
  toast('Preset: ' + p[0]);
};
$('aspect').onchange = (e) => { S.gif.aspect = e.target.value; saveGif(); renderTimeline(); };
$('width').onchange = (e) => { S.gif.width = Number(e.target.value); saveGif(); };
$('fps').onchange = (e) => { S.gif.fps = Number(e.target.value); saveGif(); };
$('speed').onchange = (e) => { S.gif.speed = Number(e.target.value); saveGif(); };
$('maxDur').onchange = (e) => { S.gif.maxDuration = Number(e.target.value); saveGif(); };
$('quality').oninput = (e) => { S.gif.quality = Number(e.target.value); $('qualityVal').textContent = e.target.value; };
$('quality').onchange = () => saveGif();
$('sens').oninput = (e) => {
  S.detect.sensitivity = Number(e.target.value) / 100;
  $('sensVal').textContent = e.target.value + ' %';
  if (S.wantCuts && S.ana && S.ana.times) { applyCuts(); S.clipsEdited = false; renderClips(); renderTimeline(); renderAnalysis(); if (!S.ana.exact) refineCuts(S.ana); }
};
$('sens').onchange = () => save('detect', S.detect);
$('minLen').onchange = (e) => {
  S.detect.minLen = clamp(Number(e.target.value) || 0.5, 0.2, 5);
  e.target.value = S.detect.minLen;
  save('detect', S.detect);
  if (S.wantCuts && S.ana && S.ana.times) { applyCuts(); S.clipsEdited = false; renderClips(); renderTimeline(); renderAnalysis(); if (!S.ana.exact) refineCuts(S.ana); }
};
$('resetClips').onclick = () => {
  S.clips = [{ id: newId(), start: 0, end: S.duration, o0: 0, o1: S.duration, sel: true }];
  S.activeClip = S.clips[0].id; S.clipsEdited = true;
  showWhole(); renderClips(); renderAnalysis();
};
$('clipsAll').onclick = () => { S.clips.forEach((c) => (c.sel = true)); renderClips(); renderTimeline(); };
$('clipsDelete').onclick = () => {
  const n = S.clips.filter((c) => c.sel).length;
  if (!n) { toast('Keine Clips ausgewählt'); return; }
  removeClips(S.clips.filter((c) => c.sel));
  toast(`${n} Clip${n === 1 ? '' : 's'} gelöscht. Mit ↺ unter Schnitterkennung kommt der ganze Film zurück.`, 4000);
};
function removeClips(list) {
  S.clips = S.clips.filter((c) => !list.includes(c));
  S.clipsEdited = true;
  if (!S.clips.some((c) => c.id === S.activeClip)) S.activeClip = S.clips.length ? S.clips[0].id : null;
  renderClips(); renderTimeline(); renderGifSettings(); renderAnalysis();
}
$('clipsNone').onclick = () => { S.clips.forEach((c) => (c.sel = false)); renderClips(); renderTimeline(); };

// Screengrab-Einstellungen
function renderStillSettings() {
  const st = S.still;
  fillSeg($('stillFormat'), STILL_FORMATS, st.format, (v) => { st.format = v; save('still', st); renderStillSettings(); });
  $('jpegQualityRow').hidden = st.format !== 'jpeg';
  $('jpegQuality').value = st.quality;
  $('jpegQualityVal').textContent = st.quality;
  fillSelect($('maxWidth'), MAX_WIDTHS.map((w) => [w, w ? w + ' px' : `Original${S.vw ? ' (' + S.vw + ' px)' : ''}`]), st.maxWidth);
  fillSelect($('count'), COUNTS.map((c) => [c, c ? 'Top ' + c : 'Bester jeder Einstellung']), st.count);
}
$('jpegQuality').oninput = (e) => { S.still.quality = Number(e.target.value); $('jpegQualityVal').textContent = e.target.value; };
$('jpegQuality').onchange = () => save('still', S.still);
$('maxWidth').onchange = (e) => { S.still.maxWidth = Number(e.target.value); save('still', S.still); };
$('count').onchange = (e) => { S.still.count = Number(e.target.value); save('still', S.still); if (S.wantStills) applySuggestions(); renderStills(); renderTimeline(); renderAnalysis(); };
$('stillsAll').onclick = () => { S.stills.forEach((s) => (s.sel = true)); renderStills(); renderTimeline(); };
$('stillsNone').onclick = () => { S.stills.forEach((s) => (s.sel = false)); renderStills(); renderTimeline(); };
$('stillsClear').onclick = () => { if (!S.stills.length) return; S.stills = []; S.activeStill = null; renderStills(); renderTimeline(); renderAnalysis(); };
$('stillDelete').onclick = () => { const s = activeStill(); if (s) removeStill(s); };
$('stillPrev').onclick = () => { const s = activeStill(); if (s) updateStill(s, (frameIndex(s.t) - 1 + 0.5) / S.fps); };
$('stillNext').onclick = () => { const s = activeStill(); if (s) updateStill(s, (frameIndex(s.t) + 1 + 0.5) / S.fps); };
$('stillToPlayhead').onclick = () => { const s = activeStill(); if (s) updateStill(s, player.currentTime); };

// Tabs
$('tabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.mode === S.mode) return;
  S.mode = b.dataset.mode;
  player.pause();
  renderAll();
};

// ---------- Player & Transport ----------
function setTime(t) {
  player.currentTime = clamp(t, 0, Math.max(0, S.duration - 0.001));
  renderTime(); renderTimeline();
}
function renderTime() {
  $('tc').textContent = tc(player.currentTime || 0);
  setIcon($('playBtn'), player.paused ? 'play' : 'pause');
  $('playBtn').title = player.paused ? 'Abspielen (Leertaste)' : 'Pause (Leertaste)';
}
function togglePlay() {
  if (!S.url) return;
  if (player.paused) {
    const c = activeClip();
    if (S.mode === 'gifs' && c && (player.currentTime < c.start || player.currentTime >= c.end - 0.02)) player.currentTime = c.start + 0.001;
    player.play().catch(() => {});
  } else player.pause();
}
player.onclick = togglePlay;
player.onplay = () => { renderTime(); tick(); };
player.onpause = renderTime;
player.onseeked = () => { renderTime(); renderTimeline(); };
let fpsProbe = null;
function tick() {
  if (player.paused) return;
  const c = activeClip();
  if (S.mode === 'gifs' && c && player.currentTime >= c.end - 0.01) player.currentTime = c.start + 0.001; // Clip loopen
  renderTime(); renderTimeline();
  requestAnimationFrame(tick);
}
// Framerate aus dem Player schätzen, falls die Analyse sie nicht kennt.
if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
  const probe = (now, meta) => {
    if (!S.fpsKnown && !player.paused && player.playbackRate === 1) {
      if (fpsProbe && meta.presentedFrames > fpsProbe.frames && meta.mediaTime > fpsProbe.time) {
        const d = (meta.mediaTime - fpsProbe.time) / (meta.presentedFrames - fpsProbe.frames);
        if (d > 0.004 && d < 0.2) {
          fpsProbe.samples.push(d);
          if (fpsProbe.samples.length >= 20) {
            const sorted = fpsProbe.samples.sort((a, b) => a - b);
            const fps = 1 / sorted[Math.floor(sorted.length / 2)];
            const common = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
            S.fps = common.reduce((best, f) => (Math.abs(f - fps) < Math.abs(best - fps) ? f : best), common[0]);
            S.fpsKnown = true;
          }
        }
      }
      fpsProbe = { frames: meta.presentedFrames, time: meta.mediaTime, samples: fpsProbe ? fpsProbe.samples : [] };
    }
    player.requestVideoFrameCallback(probe);
  };
  player.requestVideoFrameCallback(probe);
}

function stepFrame(n) {
  player.pause();
  setTime((frameIndex(player.currentTime) + n + 0.5) / S.fps);
}
$('playBtn').onclick = togglePlay;
$('prevFrame').onclick = () => stepFrame(-1);
$('nextFrame').onclick = () => stepFrame(1);

function setEdge(edge) {
  const c = activeClip();
  if (!c) return;
  const i = S.clips.indexOf(c);
  const f = frameIndex(player.currentTime);
  // In/Out dürfen über die Nachbar-Clips hinaus (Clips können sich überlappen).
  if (edge === 'in') {
    const t = f / S.fps;
    if (t >= c.end) c.end = Math.min(S.duration, t + frameDur() * Math.max(1, Math.round((c.end - c.start) * S.fps)));
    c.start = clamp(t, 0, c.end - frameDur());
  } else {
    const t = (f + 1) / S.fps;
    if (t <= c.start) c.start = Math.max(0, t - (c.end - c.start));
    c.end = clamp(t, c.start + frameDur(), S.duration);
  }
  S.clipsEdited = true;
  sortClips();
  renderClips(); renderTimeline(); renderGifSettings();
}
function sortClips() { S.clips.sort((a, b) => a.start - b.start || a.end - b.end); }
/** In/Out des Clips aufheben: zurück auf die ursprüngliche Einstellung (bzw. den ganzen Film). */
function clearMarks() {
  const c = activeClip();
  if (!c) return;
  const o0 = c.o0 != null ? c.o0 : 0, o1 = c.o1 != null ? c.o1 : S.duration;
  if (Math.abs(c.start - o0) < 1e-6 && Math.abs(c.end - o1) < 1e-6) { toast('Keine Markierung gesetzt'); return; }
  c.start = o0; c.end = o1;
  sortClips();
  renderClips(); renderTimeline(); renderGifSettings();
  toast(S.clips.length === 1 ? 'Markierung aufgehoben: ganzer Film' : 'Markierung aufgehoben: ganze Einstellung');
}
function splitAtPlayhead() {
  const t = frameIndex(player.currentTime) / S.fps;
  const c = S.clips.find((x) => t > x.start + frameDur() / 2 && t < x.end - frameDur() / 2);
  if (!c) return;
  const i = S.clips.indexOf(c);
  const right = { id: newId(), start: t, end: c.end, o0: t, o1: c.o1 != null ? Math.max(t, c.o1) : c.end, sel: c.sel };
  c.end = t; c.o1 = t;
  S.clips.splice(i + 1, 0, right);
  S.activeClip = right.id; S.clipsEdited = true;
  renderClips(); renderTimeline(); renderGifSettings(); renderAnalysis();
}
function mergeWithNext() {
  const c = activeClip();
  const i = S.clips.indexOf(c);
  if (i < 0 || i >= S.clips.length - 1) return;
  c.end = S.clips[i + 1].end; c.o1 = S.clips[i + 1].o1 != null ? S.clips[i + 1].o1 : c.end;
  S.clips.splice(i + 1, 1);
  S.clipsEdited = true;
  renderClips(); renderTimeline(); renderGifSettings(); renderAnalysis();
}
$('inBtn').onclick = () => setEdge('in');
$('outBtn').onclick = () => setEdge('out');
$('clearBtn').onclick = clearMarks;
$('splitBtn').onclick = splitAtPlayhead;
$('mergeBtn').onclick = mergeWithNext;
$('grabBtn').onclick = addStillAtPlayhead;
$('grabBtn2').onclick = addStillAtPlayhead;
function announce(kind) {
  if (kind === 'cuts') { const n = cutTimes().length; toast(n ? `${n} Schnitt${n === 1 ? '' : 'e'} gefunden, ${S.clips.length} Clips` : 'Keine Schnitte gefunden'); }
  else { const n = S.stills.filter((x) => !x.manual).length; toast(n ? `${n} Vorschl${n === 1 ? 'ag' : 'äge'} gefunden` : 'Keine passenden Frames gefunden'); }
}
// Analyse nur auf Knopfdruck. Sie liefert Schnitte und Screengrab-Kandidaten in einem Durchgang.
function runAnalysisFor(kind) {
  if (!S.url) return;
  if (kind === 'cuts') S.wantCuts = true; else S.wantStills = true;
  if (S.ana && S.ana.running) { renderAnalysis(); return; }
  if (S.ana && S.ana.times) {
    if (kind === 'cuts') { applyCuts(); if (!S.ana.exact) refineCuts(S.ana); } else applySuggestions(true);
    renderAll(); announce(kind);
    return;
  }
  startAnalysis();
}
$('findStills').onclick = () => runAnalysisFor('stills');
$('detectCuts').onclick = () => { S.clipsEdited = false; runAnalysisFor('cuts'); };
function renderFindButton() {
  const running = !!(S.ana && S.ana.running);
  $('findStills').disabled = running;
  $('detectCuts').disabled = running;
  $('findStillsLabel').textContent = running ? 'Film wird analysiert …' : 'Frames finden';
  $('detectCutsLabel').textContent = running ? 'Film wird analysiert …' : 'Schnitte erkennen';
}
function showWhole() { S.view = { a: 0, b: S.duration }; renderTimeline(); }
function zoomToClip() {
  if (S.mode === 'gifs') {
    const c = activeClip();
    if (!c) return;
    const pad = Math.max(0.2, (c.end - c.start) * 0.15);
    S.view = { a: Math.max(0, c.start - pad), b: Math.min(S.duration, c.end + pad) };
  } else {
    const t = player.currentTime, span = Math.max(2, (S.view.b - S.view.a) / 4);
    S.view = { a: Math.max(0, t - span / 2), b: Math.min(S.duration, t + span / 2) };
  }
  renderTimeline();
}
$('wholeBtn').onclick = showWhole;
$('zoomBtn').onclick = zoomToClip;

// ---------- Timeline ----------
const tl = $('timeline');
const tlx = tl.getContext('2d');
function tlX(t) { return ((t - S.view.a) / (S.view.b - S.view.a)) * tl.clientWidth; }
function tlT(x) { return S.view.a + (x / tl.clientWidth) * (S.view.b - S.view.a); }
let tlRaf = 0;
function renderTimeline() { if (!tlRaf) tlRaf = requestAnimationFrame(drawTimeline); }
/** Vorschaubilder entlang der sichtbaren Timeline (wie in FrameReel). */
let stripKeyPrev = '';
function drawFilmstrip(x, top, h, W) {
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, top, W, h);
  if (!S.vw) return;
  const tileW = Math.max(24, h * S.vw / S.vh);
  const n = Math.ceil(W / tileW);
  const span = S.view.b - S.view.a;
  const q = span / n;
  const viewKey = n + ':' + q.toFixed(4);
  if (viewKey !== stripKeyPrev) { stripKeyPrev = viewKey; stripGen++; }
  const t0 = Math.floor(S.view.a / q);
  x.save();
  x.beginPath(); x.rect(0, top, W, h); x.clip();
  const missing = [];
  for (let k = t0; k * q < S.view.b; k++) {
    const t = Math.min(S.duration - 0.01, (k + 0.5) * q);
    const key = thumbKey(t);
    const px = tlX(k * q), pw = tlX((k + 1) * q) - px;
    const im = stripImgs.get(key);
    if (im && im.complete && im.naturalWidth) {
      const ar = im.naturalWidth / im.naturalHeight;
      let dw = pw, dh = pw / ar;
      if (dh < h) { dh = h; dw = h * ar; }
      x.drawImage(im, px + (pw - dw) / 2, top + (h - dh) / 2, dw, dh);
    } else if (thumbCache.has(key)) {
      const img = new Image(); img.onload = renderTimeline; img.src = thumbCache.get(key); stripImgs.set(key, img);
    } else missing.push(t);
  }
  x.restore();
  // Mitte zuerst laden, Rand zuletzt (Warteschlange arbeitet von hinten)
  missing.reverse().forEach((t) => requestThumb(t, true));
}
function drawTimeline() {
  tlRaf = 0;
  if (!S.duration || $('studio').hidden) return;
  const dpr = window.devicePixelRatio || 1;
  const W = tl.clientWidth, H = tl.clientHeight;
  if (tl.width !== Math.round(W * dpr) || tl.height !== Math.round(H * dpr)) { tl.width = Math.round(W * dpr); tl.height = Math.round(H * dpr); }
  const x = tlx;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#18181a'; x.fillRect(0, 0, W, H);
  // Zeitskala
  const span = S.view.b - S.view.a;
  const steps = [0.04, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
  const tick = steps.find((s) => (s / span) * W > 70) || 3600;
  x.fillStyle = 'rgba(255,255,255,.28)'; x.font = '10px ' + getComputedStyle(document.body).fontFamily;
  for (let t = Math.ceil(S.view.a / tick) * tick; t <= S.view.b; t += tick) {
    const px = tlX(t);
    x.fillRect(px, 0, 1, 5);
    x.fillText(tc(t), px + 3, 10);
  }
  const top = 14, h = H - top - 2;
  drawFilmstrip(x, top, h, W);
  if (S.mode === 'gifs') {
    S.clips.forEach((c, i) => {
      const x0 = tlX(c.start), x1 = tlX(c.end);
      if (x1 < 0 || x0 > W) return;
      if (!c.sel) { x.fillStyle = 'rgba(15,15,16,.72)'; x.fillRect(x0, top, x1 - x0, h); }
      if (i > 0) { x.fillStyle = '#18181a'; x.fillRect(x0 - 1, top, 2, h); }
    });
    const c = activeClip();
    if (c) {
      const x0 = tlX(c.start), x1 = tlX(c.end);
      x.strokeStyle = '#faf5e8'; x.lineWidth = 2;
      x.strokeRect(x0 + 1, top + 1, Math.max(2, x1 - x0 - 2), h - 2);
      x.fillStyle = '#faf5e8';
      x.fillRect(x0, top, 5, h); x.fillRect(x1 - 5, top, 5, h);
      x.fillStyle = '#18181a';
      x.fillRect(x0 + 2, top + h / 2 - 6, 1, 12); x.fillRect(x1 - 3, top + h / 2 - 6, 1, 12);
    }
  } else {
    x.fillStyle = 'rgba(15,15,16,.35)'; x.fillRect(0, top, W, h);
    // Schnitte zur Orientierung
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (const ct of cutTimes()) x.fillRect(tlX(ct.t), top, 1, h);
    for (const s of S.stills) {
      const px = tlX(s.t);
      if (px < -4 || px > W + 4) continue;
      const active = s.id === S.activeStill;
      x.fillStyle = active ? '#faf5e8' : s.sel ? 'rgba(250,245,232,.75)' : 'rgba(255,255,255,.3)';
      x.fillRect(px - (active ? 2 : 1), top + 4, active ? 4 : 2, h - 8);
    }
  }
  // Playhead
  const p = tlX(player.currentTime || 0);
  x.fillStyle = '#fc5400';
  x.fillRect(p - 1, 0, 2, H);
  x.beginPath(); x.moveTo(p - 5, 0); x.lineTo(p + 5, 0); x.lineTo(p, 6); x.fill();
  // Info
  const c = activeClip();
  if (S.mode === 'gifs' && c) {
    $('tlLeft').textContent = `In ${tc(c.start)}  ·  Out ${tc(c.end)}  ·  ${secs(c.end - c.start)}`;
  } else {
    $('tlLeft').textContent = `${S.stills.length} Screengrabs`;
  }
  $('tlRight').textContent = `${tc(player.currentTime || 0)} / ${tc(S.duration)}${S.fpsKnown ? ' · ' + (Math.round(S.fps * 1000) / 1000).toString().replace('.', ',') + ' fps' : ''}`;
}
window.addEventListener('resize', renderTimeline);

let drag = null;
tl.addEventListener('pointerdown', (e) => {
  if (!S.duration) return;
  const r = tl.getBoundingClientRect();
  const px = e.clientX - r.left;
  const t = tlT(px);
  tl.setPointerCapture(e.pointerId);
  player.pause();
  if (S.mode === 'gifs') {
    const ac = activeClip();
    const order = ac ? [ac, ...S.clips.filter((x) => x !== ac)] : S.clips;
    for (const c of order) {
      const ds = Math.abs(px - tlX(c.start)), de = Math.abs(px - tlX(c.end));
      if (Math.min(ds, de) >= 8) continue;
      // An einer Schnittkante: links davon greift das Out des linken Clips, rechts das In des rechten
      let kind = ds < de ? 'start' : 'end';
      if (c !== ac && ds < 8 && de >= 8 && px < tlX(c.start)) continue;
      if (c !== ac && de < 8 && ds >= 8 && px > tlX(c.end)) continue;
      if (c !== ac) selectClip(c, false);
      drag = { kind, c };
      return;
    }
    const hit = S.clips.find((x) => t >= x.start && t < x.end);
    if (hit && hit.id !== S.activeClip) selectClip(hit, false);
  } else {
    let best = null, bd = 7;
    for (const s of S.stills) { const d = Math.abs(tlX(s.t) - px); if (d < bd) { bd = d; best = s; } }
    if (best) { selectStill(best); drag = { kind: 'still', s: best, moved: false }; return; }
  }
  drag = { kind: 'scrub' };
  setTime(t);
});
tl.addEventListener('pointermove', (e) => {
  const r = tl.getBoundingClientRect();
  const px = e.clientX - r.left;
  if (!drag) {
    let cur = 'pointer';
    const c = S.mode === 'gifs' && activeClip();
    if (c && S.clips.some((x) => Math.abs(px - tlX(x.start)) < 8 || Math.abs(px - tlX(x.end)) < 8)) cur = 'ew-resize';
    tl.style.cursor = cur;
    return;
  }
  const t = clamp(tlT(px), 0, S.duration);
  if (drag.kind === 'scrub') setTime(t);
  else if (drag.kind === 'start' || drag.kind === 'end') {
    const c = drag.c, i = S.clips.indexOf(c);
    const ft = Math.round(t * S.fps) / S.fps;
    if (drag.kind === 'start') { c.start = clamp(ft, 0, c.end - frameDur()); setTime(c.start + 0.001); }
    else { c.end = clamp(ft, c.start + frameDur(), S.duration); setTime(c.end - frameDur() / 2); }
    S.clipsEdited = true;
    $('tlLeft').textContent = `In ${tc(c.start)}  ·  Out ${tc(c.end)}  ·  ${secs(c.end - c.start)}`;
  } else if (drag.kind === 'still') {
    drag.moved = true;
    drag.s.t = t; setTime(t);
  }
});
const endDrag = () => {
  if (!drag) return;
  if (drag.kind === 'start' || drag.kind === 'end') { sortClips(); renderClips(); renderGifSettings(); }
  if (drag.kind === 'still' && drag.moved) { S.stills.sort((a, b) => a.t - b.t); renderStills(); }
  drag = null;
};
tl.addEventListener('pointerup', endDrag);
tl.addEventListener('pointercancel', endDrag);
tl.addEventListener('wheel', (e) => {
  if (!S.duration) return;
  e.preventDefault();
  const span = S.view.b - S.view.a;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    const dt = (e.deltaX / tl.clientWidth) * span;
    const a = clamp(S.view.a + dt, 0, S.duration - span);
    S.view = { a, b: a + span };
  } else {
    const r = tl.getBoundingClientRect();
    const anchor = tlT(e.clientX - r.left);
    const k = Math.exp(e.deltaY * 0.0025);
    const ns = clamp(span * k, Math.min(S.duration, 0.5), S.duration);
    const f = (anchor - S.view.a) / span;
    const a = clamp(anchor - f * ns, 0, S.duration - ns);
    S.view = { a, b: a + ns };
  }
  renderTimeline();
}, { passive: false });

// ---------- Tastatur ----------
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); fileInput.click(); return; }
  if (S.url && S.mode === 'gifs' && e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyX') { e.preventDefault(); clearMarks(); return; }
  if (!S.url || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' && e.target.type !== 'range' || tag === 'textarea') return;
  if (tag === 'select') return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? setTime(player.currentTime - 1) : stepFrame(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? setTime(player.currentTime + 1) : stepFrame(1); }
  else if (k === 'i' && S.mode === 'gifs') setEdge('in');
  else if (k === 'o' && S.mode === 'gifs') setEdge('out');
  else if (k === 'b' && S.mode === 'gifs') splitAtPlayhead();
  else if (k === 'g' && S.mode === 'gifs') clearMarks();
  else if ((e.key === 'Backspace' || e.key === 'Delete') && S.mode === 'gifs') { const c = S.clips.find((x) => x.id === S.activeClip); if (c) { e.preventDefault(); removeClips([c]); } }
  else if (k === 's') addStillAtPlayhead();
  else if ((e.key === 'Backspace' || e.key === 'Delete') && S.mode === 'stills') { const s = activeStill(); if (s) { e.preventDefault(); removeStill(s); } }
});

// ---------- Ziel ----------
const canPickDir = typeof window.showDirectoryPicker === 'function';
function renderDest() {
  document.querySelectorAll('.row.dest').forEach((row) => {
    if (!canPickDir) { row.innerHTML = '<span class="lbl">Ziel</span><span class="muted">Downloads (mehrere als ZIP)</span>'; return; }
    row.innerHTML = S.dir
      ? `<span class="lbl">Ziel</span><span class="mono" title="Ordner">${escapeHTML(S.dir.name)}</span><button class="icon" data-act="clearDir" title="Wieder in Downloads speichern" data-icon="close"></button><button class="icon" data-act="pickDir" title="Anderen Ordner wählen" data-icon="folder"></button>`
      : `<span class="lbl">Ziel</span><span class="muted">Downloads</span><button class="icon" data-act="pickDir" title="Zielordner wählen" data-icon="folder"></button>`;
    paintIcons(row);
  });
}
async function pickDir() {
  try { S.dir = await window.showDirectoryPicker({ id: 'loopstill', mode: 'readwrite' }); }
  catch (err) { if (err && err.name !== 'AbortError') toast('Ordner konnte nicht geöffnet werden.'); }
  renderDest();
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function deliver(files, zipName) {
  if (S.dir) {
    try {
      if ((await S.dir.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await S.dir.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Keine Schreibrechte');
      for (const f of files) {
        let name = f.name, n = 2;
        for (;;) {
          try { await S.dir.getFileHandle(name); name = f.name.replace(/(\.[^.]+)$/, `_${n++}$1`); } catch { break; }
        }
        const fh = await S.dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(f.blob); await w.close();
        f.savedAs = name;
      }
      return `${files.length === 1 ? 'Gespeichert' : files.length + ' Dateien gespeichert'} in „${S.dir.name}“`;
    } catch (err) {
      console.warn(err);
      toast('Ordner nicht beschreibbar, lade stattdessen herunter.');
    }
  }
  if (files.length === 1) { download(files[0].blob, files[0].name); return 'Heruntergeladen'; }
  const zip = await makeZip(files);
  download(zip, zipName);
  return `${files.length} Dateien als ZIP heruntergeladen (${bytes(zip.size)})`;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// ZIP ohne Kompression (GIF/JPEG/PNG sind schon komprimiert)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

// ---------- Export ----------
let gifWorker = null;
function getGifWorker() {
  if (!gifWorker) gifWorker = new Worker('gif-worker.js', { type: 'module' });
  return gifWorker;
}
function cancelExport() {
  const ex = S.exporting;
  if (!ex) return;
  ex.cancelled = true;
  if (gifWorker) { gifWorker.terminate(); gifWorker = null; }
  if (ex.reject) ex.reject(new Error('abgebrochen'));
}
function renderExportButtons() {
  const gifN = S.clips.filter((c) => c.sel).length;
  const stillN = S.stills.filter((s) => s.sel).length;
  $('exportGifsLabel').textContent = `${gifN} GIF${gifN === 1 ? '' : 's'} exportieren`;
  $('exportStillsLabel').textContent = `${stillN} Screengrab${stillN === 1 ? '' : 's'} exportieren`;
  const busy = !!S.exporting;
  $('exportGifs').disabled = busy || !gifN;
  $('exportStills').disabled = busy || !stillN;
  $('exportGifs').hidden = busy && S.exporting.kind === 'gifs';
  $('exportStills').hidden = busy && S.exporting.kind === 'stills';
}
function statusEl(kind) { return document.querySelector(`[data-show="${kind}"] .exportStatus`); }
function setStatus(kind, text, p) {
  const el = statusEl(kind);
  if (text == null) { el.innerHTML = ''; return; }
  const bar = p == null ? '' : `<div style="display:flex;align-items:center;gap:10px;margin-top:2px"><div class="progress${p < 0 ? ' busy' : ''}"><i style="width:${(Math.max(0, p) * 100).toFixed(1)}%"></i></div>
    <button class="icon" data-act="cancelExport" title="Abbrechen" data-icon="close"></button></div>`;
  el.innerHTML = bar + `<div class="note">${text}</div>`;
  paintIcons(el);
}
let resultURLs = [];
function clearResults() {
  resultURLs.forEach((u) => URL.revokeObjectURL(u)); resultURLs = [];
  $('gifResults').innerHTML = ''; $('stillResults').innerHTML = '';
  setStatus('gifs', null); setStatus('stills', null);
}
function showResults(el, files, isGif) {
  el.innerHTML = '';
  for (const f of files.slice(0, 30)) {
    const url = URL.createObjectURL(f.blob); resultURLs.push(url);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; a.title = 'Nochmal herunterladen';
    a.innerHTML = `<img src="${url}" alt=""><span class="mono small">${escapeHTML(f.savedAs || f.name)}</span><span class="sz small">${bytes(f.blob.size)}</span>`;
    el.appendChild(a);
  }
  if (files.length > 30) el.insertAdjacentHTML('beforeend', `<div class="note">… und ${files.length - 30} weitere</div>`);
}

function drawFill(ctx, v, w, h) {
  const iw = v.videoWidth, ih = v.videoHeight;
  const k = Math.max(w / iw, h / ih);
  const dw = iw * k, dh = ih * k;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

$('exportGifs').onclick = async () => {
  const clips = S.clips.filter((c) => c.sel);
  if (!clips.length || S.exporting) return;
  const { w, h } = gifSize();
  for (const c of clips) {
    if (w * h * 4 * gifFrameCount(c) > GIF_MEMORY_LIMIT) {
      toast(`Clip ${S.clips.indexOf(c) + 1} ist zu groß für den Browser. Bitte kleinere Breite oder kürzere Max. Länge wählen.`, 5000);
      return;
    }
  }
  const ex = S.exporting = { kind: 'gifs', cancelled: false };
  player.pause();
  $('gifResults').innerHTML = '';
  renderExportButtons();
  const files = [];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const g = Object.assign({}, S.gif);
  const names = clips.map((c) => (clips.length === 1 && S.clips.length === 1 ? `${S.base}.gif` : `${S.base}_Clip${pad(S.clips.indexOf(c) + 1)}.gif`));
  try {
    for (let n = 0; n < clips.length; n++) {
      const c = clips[n];
      const label = clips.length > 1 ? `GIF ${n + 1} von ${clips.length}: ` : '';
      let times = gifTimes(c);
      if (g.playback === 'reverse') times = times.slice().reverse();
      const worker = getGifWorker();
      worker.postMessage({ type: 'reset' });
      for (let k = 0; k < times.length; k++) {
        if (ex.cancelled) throw new Error('abgebrochen');
        await seek(grabV, times[k]);
        ctx.clearRect(0, 0, w, h);
        drawFill(ctx, grabV, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        worker.postMessage({ type: 'frame', buffer: data.buffer }, [data.buffer]);
        if (k % 2 === 0) setStatus('gifs', `${label}Frames holen … ${k + 1}/${times.length}`, ((n + (k / times.length) * 0.6) / clips.length));
      }
      setStatus('gifs', `${label}gifski rechnet … (${w} × ${h}, ${gifFrameCount(c)} Frames)`, -1);
      const buffer = await new Promise((resolve, reject) => {
        ex.reject = reject;
        worker.onmessage = (e) => { if (e.data.type === 'done') resolve(e.data.buffer); else reject(new Error(e.data.message)); };
        worker.onerror = (e) => { e.preventDefault(); reject(new Error(e.message || 'GIF-Encoder konnte nicht starten')); };
        worker.postMessage({ type: 'encode', width: w, height: h, fps: g.fps, quality: g.quality, pingPong: g.playback === 'pingPong' });
      });
      ex.reject = null;
      files.push({ name: names[n], blob: new Blob([buffer], { type: 'image/gif' }) });
    }
    setStatus('gifs', 'Speichere …', 1);
    const msg = await deliver(files, `${S.base}_GIFs.zip`);
    const total = files.reduce((s, f) => s + f.blob.size, 0);
    setStatus('gifs', `${msg}${files.length > 1 ? ' · zusammen ' + bytes(total) : ''}`);
    showResults($('gifResults'), files, true);
  } catch (err) {
    if (ex.cancelled) setStatus('gifs', 'Export abgebrochen.');
    else { console.error(err); setStatus('gifs', `<span class="warn">Export fehlgeschlagen: ${escapeHTML(err.message || err)}</span>`); }
    if (gifWorker && !ex.cancelled) { gifWorker.terminate(); gifWorker = null; }
  } finally {
    S.exporting = null;
    renderExportButtons();
  }
};

$('exportStills').onclick = async () => {
  const stills = S.stills.filter((s) => s.sel);
  if (!stills.length || S.exporting) return;
  const ex = S.exporting = { kind: 'stills', cancelled: false };
  player.pause();
  $('stillResults').innerHTML = '';
  renderExportButtons();
  const st = Object.assign({}, S.still);
  const w = st.maxWidth > 0 ? Math.min(st.maxWidth, S.vw) : S.vw;
  const h = Math.round(w * S.vh / S.vw);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const type = st.format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = st.format === 'png' ? 'png' : 'jpg';
  const files = [];
  try {
    for (let k = 0; k < stills.length; k++) {
      if (ex.cancelled) throw new Error('abgebrochen');
      setStatus('stills', `Screengrab ${k + 1} von ${stills.length} …`, k / stills.length);
      await seek(grabV, stills[k].t);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(grabV, 0, 0, w, h);
      const blob = await new Promise((r) => canvas.toBlob(r, type, st.quality / 100));
      if (!blob) throw new Error('Bild konnte nicht erzeugt werden');
      let name = `${S.base}_${fileTc(stills[k].t)}.${ext}`;
      if (files.some((f) => f.name === name)) name = name.replace(`.${ext}`, `_${k + 1}.${ext}`);
      files.push({ name, blob });
    }
    setStatus('stills', 'Speichere …', 1);
    const msg = await deliver(files, `${S.base}_Screengrabs.zip`);
    setStatus('stills', msg);
    showResults($('stillResults'), files, false);
  } catch (err) {
    if (ex.cancelled) setStatus('stills', 'Export abgebrochen.');
    else { console.error(err); setStatus('stills', `<span class="warn">Export fehlgeschlagen: ${escapeHTML(err.message || err)}</span>`); }
  } finally {
    S.exporting = null;
    renderExportButtons();
  }
};

// ---------- Start ----------
prepareSpare();
try { getGifWorker().postMessage({ type: 'init' }); } catch {}
paintIcons();
renderStillSettings();
renderGifSettings();
renderDest();
if (location.protocol === 'file:') {
  const el = $('openError');
  el.hidden = false;
  el.textContent = 'Hinweis: Direkt als Datei geöffnet laufen Analyse und GIF-Encoder nicht. Bitte die Online-Version benutzen.';
}
window.Loopstill = { S, openFile };
})();
