/* Bildanalyse für Schnitterkennung und Screengrab-Vorschläge.
   Läuft im Worker (importScripts) und im Hauptfenster (Fallback).
   Entspricht SceneDetector.swift / StillScorer.swift aus FrameReel. */
(function (root) {
  'use strict';

  const SIG_W = 64, SIG_H = 36;     // Raster für Schnitterkennung
  const STILL_W = 320;              // Breite für die Bildbewertung

  /** Farbhistogramm (48 Klassen) + Helligkeitsraster eines 64×36-Bildes. */
  function signature(data) {
    const n = SIG_W * SIG_H;
    const hist = new Float32Array(48);
    const luma = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      hist[r >> 4]++; hist[16 + (g >> 4)]++; hist[32 + (b >> 4)]++;
      luma[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    for (let i = 0; i < 48; i++) hist[i] /= n;
    return { hist, luma };
  }

  /** 0 = identisch, ~0.3+ = typischer harter Schnitt. */
  function difference(a, b) {
    let h = 0;
    for (let i = 0; i < 48; i++) h += Math.abs(a.hist[i] - b.hist[i]);
    h /= 6;
    let l = 0;
    const n = a.luma.length;
    for (let i = 0; i < n; i++) l += Math.abs(a.luma[i] - b.luma[i]);
    l /= Math.max(1, n);
    return Math.min(1, 0.5 * h + l);
  }

  /** Schnitte aus den Frame-Differenzen (times[i] = erstes Frame nach dem Vergleich). */
  function detectCuts(times, values, sensitivity, minSceneLength, duration) {
    const threshold = 0.45 - 0.35 * sensitivity;
    const cuts = [];
    let lastCut = 0;
    const count = values.length;
    for (let i = 0; i < count; i++) {
      const lo = Math.max(0, i - 6), hi = Math.min(count - 1, i + 6);
      let sum = 0, k = 0;
      for (let j = lo; j <= hi; j++) if (j !== i) { sum += values[j]; k++; }
      const localMean = k ? sum / k : 0;
      const v = values[i], t = times[i];
      if (v > threshold && v > localMean * 2 && t - lastCut >= minSceneLength) {
        cuts.push(i);
        lastCut = t;
      }
    }
    if (cuts.length && duration - times[cuts[cuts.length - 1]] < minSceneLength) cuts.pop();
    return cuts; // Indizes in times/values
  }

  /** Kennzahlen eines verkleinerten Frames (RGBA, w×h). */
  function stillMetrics(data, w, h) {
    const n = w * h;
    const luma = new Float32Array(n);
    let sumL = 0, sumL2 = 0, clipped = 0;
    let sRG = 0, sRG2 = 0, sYB = 0, sYB2 = 0;
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      luma[i] = l; sumL += l; sumL2 += l * l;
      if (l < 0.02 || l > 0.98) clipped++;
      const rg = r - g, yb = 0.5 * (r + g) - b;
      sRG += rg; sRG2 += rg * rg; sYB += yb; sYB2 += yb * yb;
    }
    const mean = sumL / n;
    const contrast = Math.sqrt(Math.max(0, sumL2 / n - mean * mean));
    const mRG = sRG / n, mYB = sYB / n;
    const dRG = Math.sqrt(Math.max(0, sRG2 / n - mRG * mRG));
    const dYB = Math.sqrt(Math.max(0, sYB2 / n - mYB * mYB));
    const colorfulness = (Math.sqrt(dRG * dRG + dYB * dYB) + 0.3 * Math.sqrt(mRG * mRG + mYB * mYB)) / 255;

    // Schärfe (Varianz des Laplace-Filters) + Kantenenergie je Block für den Bildaufbau.
    const BX = 12, BY = 7;
    const energy = new Float32Array(BX * BY);
    let lap = 0, lap2 = 0;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w, by = Math.min(BY - 1, (y * BY / h) | 0);
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        const v = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w];
        lap += v; lap2 += v * v;
        energy[by * BX + Math.min(BX - 1, (x * BX / w) | 0)] += Math.abs(v);
      }
    }
    const lc = (w - 2) * (h - 2);
    const lm = lap / lc;
    const sharpness = lap2 / lc - lm * lm;

    // 16×9-Helligkeitsraster für Einstellungswechsel und Dubletten.
    const sig = new Float32Array(144), cnt = new Float32Array(144);
    for (let y = 0; y < h; y++) {
      const cy = Math.min(8, (y * 9 / h) | 0);
      for (let x = 0; x < w; x++) {
        const c = cy * 16 + Math.min(15, (x * 16 / w) | 0);
        sig[c] += luma[y * w + x]; cnt[c]++;
      }
    }
    for (let i = 0; i < 144; i++) sig[i] /= Math.max(1, cnt[i]);

    let exposure = 1 - Math.min(1, Math.abs(mean - 0.42) / 0.4);
    exposure *= 1 - Math.min(1, clipped / n * 2);

    return { sharpness, contrast, colorfulness, exposure, composition: composition(energy, BX, BY), mean, sig };
  }

  /** Wo liegt das Hauptmotiv? Schwerpunkt der stärksten Detailzone, Drittelpunkte und Mitte zählen. */
  function composition(energy, BX, BY) {
    let total = 0;
    for (let i = 0; i < energy.length; i++) total += energy[i];
    if (total <= 0) return 0.5;
    let best = -1, bx = 0, by = 0;
    for (let y = 0; y <= BY - 3; y++) for (let x = 0; x <= BX - 3; x++) {
      let s = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s += energy[(y + j) * BX + x + i];
      if (s > best) { best = s; bx = x; by = y; }
    }
    // Detail gleichmäßig verteilt (z. B. Totale, Textur): neutral
    if (best / total < 0.22) return 0.5;
    let wx = 0, wy = 0, ws = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const e = energy[(by + j) * BX + bx + i];
      wx += e * (bx + i + 0.5); wy += e * (by + j + 0.5); ws += e;
    }
    const cx = wx / ws / BX, cy = wy / ws / BY;
    const targets = [[1 / 3, 1 / 3, 1], [2 / 3, 1 / 3, 1], [1 / 3, 2 / 3, 1], [2 / 3, 2 / 3, 1], [0.5, 0.5, 0.85]];
    let score = 0;
    for (const [tx, ty, wt] of targets) {
      const d = Math.hypot(cx - tx, cy - ty);
      score = Math.max(score, wt * Math.max(0, 1 - d / 0.3));
    }
    return score;
  }

  function sigDistance(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }

  /** Bester Frame je Einstellung, Dubletten raus, Top N (0 = alle Einstellungen). */
  function pickStills(samples, count) {
    if (!samples.length) return [];
    samples = samples.slice().sort((a, b) => a.t - b.t);
    const shots = [[0]];
    for (let i = 1; i < samples.length; i++) {
      if (sigDistance(samples[i - 1].m.sig, samples[i].m.sig) > 0.14) shots.push([i]);
      else shots[shots.length - 1].push(i);
    }
    const global = samples.map(s => s.m.sharpness).sort((a, b) => a - b);
    const pct = (v, sorted) => {
      if (sorted.length < 2) return 0.5;
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
      return lo / (sorted.length - 1);
    };
    const best = [];
    for (const shot of shots) {
      const idx = shot.length > 2 ? shot.slice(1) : shot;
      const local = idx.map(i => samples[i].m.sharpness).sort((a, b) => a - b);
      let top = null;
      for (const i of idx) {
        const m = samples[i].m;
        if (m.mean < 0.03) continue;
        const sharp = 0.5 * pct(m.sharpness, local) + 0.5 * pct(m.sharpness, global);
        const score = 0.30 * sharp + 0.20 * Math.min(1, m.contrast / 0.25) + 0.15 * Math.min(1, m.colorfulness / 0.35)
          + 0.15 * m.exposure + 0.20 * m.composition;
        if (!top || score > top.score) top = { t: samples[i].t, score, sig: m.sig };
      }
      if (top) best.push(top);
    }
    best.sort((a, b) => b.score - a.score);
    const chosen = [];
    for (const e of best) {
      if (count > 0 && chosen.length >= count) break;
      if (chosen.some(c => sigDistance(c.sig, e.sig) < 0.05)) continue;
      chosen.push(e);
    }
    return chosen.map(c => ({ t: c.t, score: c.score })).sort((a, b) => a.t - b.t);
  }

  root.Analyse = { SIG_W, SIG_H, STILL_W, signature, difference, detectCuts, stillMetrics, pickStills };
})(typeof self !== 'undefined' ? self : this);
