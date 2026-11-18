/* GIF-Encoding mit gifski (WebAssembly) in einem eigenen Thread. */
import encode from './vendor/gifski/dist/encode.js';

let frames = [];

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'reset') { frames = []; return; }
  if (msg.type === 'frame') { frames.push(new Uint8Array(msg.buffer)); return; }
  if (msg.type === 'encode') {
    try {
      let list = frames;
      if (msg.pingPong && list.length > 2) list = list.concat(list.slice(1, -1).reverse());
      if (list.length < 2) list = [list[0], list[0]];
      const gif = await encode({
        frames: list,
        width: msg.width,
        height: msg.height,
        fps: msg.fps,
        quality: msg.quality,
        repeat: 0,
      });
      frames = [];
      let out = gif instanceof Uint8Array ? gif : new Uint8Array(gif);
      if (out.byteOffset !== 0 || out.byteLength !== out.buffer.byteLength) out = out.slice();
      self.postMessage({ type: 'done', buffer: out.buffer }, [out.buffer]);
    } catch (err) {
      frames = [];
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
  }
};
