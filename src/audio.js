// WebAudio 音效（程序合成，无外部素材）：抓起“咔”、取下“啵”、卡住“嗒嗒”、全部解开
export const SFX_NAMES = { grab: ['sfxGrab', '抓起'], pop: ['sfxPop', '取下'], block: ['sfxBlock', '卡住'], win: ['sfxWin', '全部解开'] };
export const SFX_DUR = { grab: 0.08, pop: 0.35, block: 0.3, win: 1.3 };
export class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { this.ctx = new C(); } catch (e) { return null; }
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    try { this.recDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.recDest); } catch (e) { }
    this.makeNoise(); return this.ctx;
  }
  makeNoise() { const len = Math.round(this.ctx.sampleRate * 1.5), b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0); let s = 7; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } this.noise = b; }
  now() { return this._t != null ? this._t : this.ctx.currentTime; }
  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  play(name, S, o = {}) {
    const [k] = SFX_NAMES[name] || []; if (!k || S.sfxMute || !S[k]) return;
    if (this.hook && this._t == null) try { this.hook(name, o); } catch (e) { }
    if (!this.ensure()) return;
    const v = S.sfxVolume; if (v <= 0) return; this['_' + name](this.now() + (o.delay || 0), v, o);
  }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  osc(t, type, f0, f1, dur, vol, a = 0.004) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); this.env(g, t, a, vol, dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dur + 0.05); }
  nz(t, type, f0, f1, q, dur, vol, a = 0.004) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q; const g = c.createGain(); this.env(g, t, a, vol, dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, 0.1); s.stop(t + a + dur + 0.05); }
  _grab(t, v) { this.nz(t, 'bandpass', 2600, 1800, 3, 0.04, v * 0.4, 0.001); this.osc(t, 'triangle', 900, 600, 0.04, v * 0.15, 0.001); }
  _pop(t, v) { this.osc(t, 'sine', 380, 900, 0.12, v * 0.5, 0.003); this.nz(t + 0.02, 'bandpass', 2000, 5000, 1.2, 0.22, v * 0.25, 0.02); }
  _block(t, v) { [0, 0.09].forEach(d => { this.nz(t + d, 'bandpass', 1300, 900, 4, 0.05, v * 0.45, 0.001); this.osc(t + d, 'square', 180, 140, 0.06, v * 0.08, 0.002); }); }
  _win(t, v) { [523, 659, 784, 1047, 1319].forEach((f, i) => { this.osc(t + i * 0.09, 'sine', f, f, 0.55, v * 0.2, 0.006); this.osc(t + i * 0.09, 'triangle', f * 2, f * 2, 0.2, v * 0.04, 0.006); }); }
}
export async function renderSfxOffline(events, dur, S) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  const sr = 44100, oc = new C(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const x = new Sfx(); x.ctx = oc; x.master = oc.createGain(); x.master.connect(oc.destination); x.makeNoise();
  const S2 = { ...S, sfxMute: false }; for (const k in SFX_NAMES) S2[SFX_NAMES[k][0]] = true;
  for (const e of events) { x._t = e.t; x.play(e.name, S2, {}); }
  return await oc.startRendering();
}
export function encodeWav(buf) {
  const ch = buf.getChannelData(0), n = ch.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(dv.buffer);
}
