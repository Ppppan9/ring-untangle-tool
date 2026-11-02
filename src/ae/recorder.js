// 解环 · AE 时间轴记录器：每帧采样每个环（中心/旋转/缩放/不透明度）、手指、结束页；导出 timeline.json + jsx + PNG 精灵 + 音频
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav, SFX_NAMES, SFX_DUR } from '../audio.js';
const r3 = v => Math.round(v * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000, rnd = v => Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100) : Math.round(v * 100) / 100;
export function createAERecorder(api) {
  let R = null;
  function start() { const E = api.env(); R = { t0: api.now(), lastT: 0, frames: 0, tracks: new Map(), sfx: [], L: E.L, S: { ...E.S } }; api.sfx.hook = name => { if (R) R.sfx.push({ t: Math.max(0, (api.now() - R.t0) / 1000), name }); }; }
  function stop() { const r = R; R = null; return r; }
  function sample(now) {
    if (!R) return; const E = api.env(); if (E.L !== R.L) { R = null; return; }
    const t = Math.max(R.lastT + 1e-4 * (R.frames > 0), (now - R.t0) / 1000), f = R.frames;
    for (const it of E.items) { let tr = R.tracks.get(it.id); if (!tr) { tr = { id: it.id, asset: it.asset, z: it.z, s: [] }; R.tracks.set(it.id, tr); } tr.s.push([t, r3(it.x), r3(it.y), r3(it.sc), r3(it.rot), r3(it.op), f]); }
    R.lastT = t; R.frames++;
  }
  async function exportZip(rec = R, So = null) {
    if (!rec || rec.frames < 2) throw new Error('没有可导出的记录：请先自动通关或手动游玩');
    const E = api.env(), S = So ? { ...rec.S, ...So } : rec.S, fps = +S.aeFps || 30, bake = S.aeSampling === 'bake', zh = S.aeNames !== 'en';
    const CW = E.canvas.width, CH = E.canvas.height, A = api.assets(rec);
    const D = Math.max(1 / fps, Math.ceil((rec.lastT + 1 / fps) * fps - 1e-6) / fps);
    const assets = [], files = [], pending = [], used = new Set();
    const toPng = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
    const folders = [{ id: 'root', name: zh ? '解环_AE工程' : 'RingUntangle_AE' }, { id: 'img', name: zh ? '素材' : 'Assets', parent: 'root' }, { id: 'rings', name: zh ? '环' : 'Rings', parent: 'img' }, { id: 'ui', name: zh ? '界面' : 'UI', parent: 'img' }, { id: 'aud', name: zh ? '音频' : 'Audio', parent: 'root' }, { id: 'pre', name: zh ? '预合成' : 'Precomps', parent: 'root' }];
    const asset = id => { const a = A[id]; if (!used.has(id)) { used.add(id); const file = 'assets/' + id + '.png'; assets.push({ id, file, folder: id.startsWith('ring') ? 'rings' : 'ui', w: a.c.width, h: a.c.height, name: id + '.png' }); pending.push(toPng(a.c).then(data => files.push({ name: file, data }))); } return a; };
    function resample(s) { const f0 = Math.round(s[0][0] * fps), f1 = Math.max(f0, Math.round(s[s.length - 1][0] * fps)), out = []; let j = 0; for (let f = f0; f <= f1; f++) { const tau = f / fps; while (j < s.length - 2 && s[j + 1][0] <= tau + 1e-9) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0; out.push({ t: tau, v: a.map((x, i) => i === 0 ? tau : x + (b[i] - x) * u) }); } return { f0, f1, list: out }; }
    function prop(fr, get, tol) {
      const t = fr.list.map(o => o.t), vv = fr.list.map(o => get(o.v)), same = (a, b, e) => Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= e) : Math.abs(a - b) <= e;
      if (vv.every(x => same(x, vv[0], 1e-6))) return rnd(vv[0]);
      let keep; if (bake) keep = vv.map((_, i) => i); else { keep = [0]; let a = 0; for (let b = 2; b < vv.length; b++) { let ok = true; for (let m = a + 1; m < b && ok; m++) { const u = (t[m] - t[a]) / (t[b] - t[a]); const lin = Array.isArray(vv[a]) ? vv[a].map((x, i) => x + (vv[b][i] - x) * u) : vv[a] + (vv[b] - vv[a]) * u; ok = same(lin, vv[m], tol); } if (!ok) { keep.push(b - 1); a = b - 1; } } if (vv.length > 1) keep.push(vv.length - 1); }
      return { t: keep.map(i => r4(t[i])), v: keep.map(i => rnd(vv[i])) };
    }
    const layers = [], markers = [], comps = [];
    { const a = asset('background'); layers.push({ name: zh ? '背景' : 'Background', src: { asset: 'background' }, label: 15, tr: { anchor: [0, 0], position: [0, 0], scale: [100, 100] } }); void a; }
    const tracks = [...rec.tracks.values()].sort((p, q) => p.z - q.z);
    for (const tr of tracks) {
      // 拆成连续出现段
      let a0 = 0; const segs = []; for (let i = 1; i <= tr.s.length; i++) if (i === tr.s.length || tr.s[i][6] !== tr.s[i - 1][6] + 1) { segs.push(tr.s.slice(a0, i)); a0 = i; }
      segs.forEach((s, n) => {
        const a = asset(tr.asset), fr = resample(s), tin = fr.f0 / fps, last = s[s.length - 1], tout = Math.min(D, Math.max(tin + 1 / fps, Math.round((rec.frames - 1 > last[6] ? last[0] + 1 / fps : D) * fps) / fps));
        layers.push({ name: api.layerName(tr.id, zh) + (segs.length > 1 ? ` #${n + 1}` : ''), src: { asset: tr.asset }, in: r4(tin), out: r4(tout), label: tr.id.startsWith('ring') ? 9 : tr.id === 'hand' ? 12 : 5, tr: {
          anchor: rnd([a.ax, a.ay]), position: prop(fr, e => [e[1], e[2]], 0.25), scale: prop(fr, e => [e[3] * 100 * (a.k || 1), e[3] * 100 * (a.k || 1)], 0.25), rotation: prop(fr, e => e[4], 0.2), opacity: prop(fr, e => Math.max(0, Math.min(100, e[5] * 100)), 0.5) } });
      });
      if (tr.id === 'ring_0' || (tracks.indexOf(tr) === tracks.findIndex(x => x.id.startsWith('ring')) + E.L.rings.length - 1)) { }
    }
    // 标题条在环之上、手指之下
    { const hi = layers.findIndex(l => l.name === (zh ? '手指' : 'Hand')); if (A.title) { asset('title'); const L = { name: zh ? '标题条' : 'Title bar', src: { asset: 'title' }, label: 15, tr: { anchor: [0, 0], position: [0, 0], scale: [100, 100] } }; if (hi >= 0) layers.splice(hi, 0, L); else layers.push(L); } }
    const audioFiles = [], ZH = n => (SFX_NAMES[n] || [0, n])[1];
    if (S.aeAudio !== 'none' && rec.sfx.length) {
      try {
        if (S.aeAudio === 'both' || S.aeAudio === 'mixed') { const buf = await renderSfxOffline(rec.sfx, D, S); if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); layers.push({ name: zh ? '混合音轨' : 'Mixed audio', src: { asset: 'mix' }, label: 16 }); } }
        if (S.aeAudio === 'both' || S.aeAudio === 'events') {
          const kinds = [...new Set(rec.sfx.map(e => e.name))];
          for (const k of kinds) { const buf = await renderSfxOffline([{ t: 0, name: k }], (SFX_DUR[k] || 0.4) + 0.2, S); if (!buf) continue; audioFiles.push({ name: `audio/sfx_${k}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + k, file: `audio/sfx_${k}.wav`, folder: 'aud', name: `sfx_${k}.wav` }); }
          const al = rec.sfx.map((e, i) => { const st = r4(e.t); return { name: (zh ? '音效 ' : 'SFX ') + (i + 1) + ' ' + (zh ? ZH(e.name) : e.name), src: { asset: 'sfx_' + e.name }, start: st, in: st, label: 16 }; });
          comps.push({ id: 'sfx', name: zh ? '音效_逐事件' : 'SFX events', w: CW, h: CH, duration: D, fps, folder: 'pre', layers: al });
          layers.push({ name: zh ? '音效_逐事件' : 'SFX events', src: { comp: 'sfx' }, label: 16 });
        }
      } catch (e) { console.warn('audio export', e); }
    }
    for (const e of rec.sfx) markers.push([r4(e.t), zh ? ZH(e.name) : e.name]);
    const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: zh ? '主合成_解环' : 'Main_RingUntangle', w: CW, h: CH, duration: D, fps, folder: 'root', bg: [0, 0, 0], layers, markers });
    // AE 合成尺寸
    const [CW2, CH2] = S.aeSize && S.aeSize !== 'canvas' ? S.aeSize.split('x').map(Number) : [CW, CH], K = Math.round(Math.min(CW2 / CW, CH2 / CH) * 1e6) / 1e6;
    if (K !== 1) { const mul = (P, f) => P == null ? P : Array.isArray(P) ? P.map(x => x * f) : P.t ? { ...P, v: P.v.map(x => Array.isArray(x) ? x.map(y => y * f) : x * f) } : P; for (const c of comps) { c.w = CW2; c.h = CH2; for (const l of c.layers) if (l.tr) { l.tr.position = mul(l.tr.position, K); l.tr.scale = mul(l.tr.scale, K); } } }
    const stats = { comps: comps.length, layers: 0, keys: 0, perComp: {}, rings: E.L.rings.length, sfx: rec.sfx.length };
    for (const c of comps) { stats.perComp[c.id] = c.layers.length; stats.layers += c.layers.length; for (const l of c.layers) if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const p = l.tr[k]; if (p && p.t && p.t.length > 1) stats.keys += p.t.length; } }
    const timeline = { meta: { tool: 'ring-untangle-tool', format: 1, created: d.toISOString(), fps, width: CW2, height: CH2, duration: D, canvas: [CW, CH], scale: K, sampling: bake ? 'bake' : 'reduce', names: zh ? 'zh' : 'en', saveAep: S.aeSaveAep !== false, aepName: `ring-untangle-tool_${stamp}.aep`, newProject: true, stats, level: { rings: E.L.rings, clips: E.L.clips }, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素（合成坐标）；缩放为百分比' }, folders, assets, comps, mainComp: 'main' };
    await Promise.all(pending);
    const enc = new TextEncoder();
    const all = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...files.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(all), name: `ring-untangle-tool_ae_export_${stamp}.zip`, timeline, stats, files: all.length, fileList: all.map(f => f.name) };
  }
  return { start, stop, sample, exportZip, get rec() { return R; } };
}
