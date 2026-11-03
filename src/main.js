// 解环核玩工具 —— 主程序：游戏循环 / 3D 渲染合成 / 输入（按住拖动环）/ 自动通关（参考序列 + 求解）/ 关卡编辑器 / 录制 / AE·3D·H5 导出 / 设置面板
import { GROUPS, DEFS, loadSettings, saveSettings, migrate, exportJSON, APP_ID, APP_VERSION } from './settings.js';
import { Game, layoutIssues, levelKey, LETTER_LEVEL, levelFromSettings, solveLevel, normalizeLevel, randomLevel, REF_LEVEL, COLORS, COLOR_ZH, circleX } from './game.js';
import { Scene3D, colorOf } from './scene3d.js';
import { glyphPolys, glyphNearest, segGlyphDist } from './glyphs.js';
import { Sfx } from './audio.js';
import { REF_SEQ, REF_HAND0, LETTER_SEQS, LETTER_HAND0 } from './refseq.js';
import { createAERecorder } from './ae/recorder.js';
import { makeZip } from './ae/zip.js';
import { DEFAULT_HAND } from './default_hand.js';
import { exportH5PlayableFromPage, applyPlayableMode, isPlayableNoHand, applyH5DevicePresetToSettings, markH5DeviceCustomIfSizeEdited, bindEditorDevicePreview } from './h5/index.js';

const DW = 720, DH = 1280, BCX = 360, BCY = 780;
const H5_NO_HAND = isPlayableNoHand();
let S = loadSettings();
const cv = document.getElementById('stage'); const ctx = cv.getContext('2d');
const sfx = new Sfx(), S3 = new Scene3D();
const now = () => window.__vclock != null ? window.__vclock : performance.now();
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const easeIO = t => { t = clamp01(t); return -(Math.cos(Math.PI * t) - 1) / 2; };
const lerp = (a, b, u) => a + (b - a) * u;
const status = t => { const el = document.getElementById('status'); if (el) el.textContent = t; };
let G, level, L, view, K = 1, lastT = 0, acc = 0;
let auto = null, editor = null;
const hand = { x: REF_HAND0.x, y: REF_HAND0.y, press: 0, pressT0: null, img: null, visible: false, follow: null };
const ripples = []; let winSfx = false;
window.__finished = false;

// ---------- 视口 / 关卡变换 ----------
function computeView() { const cw = S.canvasW, ch = S.canvasH; K = Math.min(cw / DW, ch / DH); const w = cw / K, h = ch / K; view = { x0: DW / 2 - w / 2, y0: DH / 2 - h / 2, w, h }; }
const bs = () => S.boardScale;
const BX = x => BCX + (x - BCX) * bs() + S.boardX, BY = y => BCY + (y - BCY) * bs() + S.boardY;
const IBX = x => (x - S.boardX - BCX) / bs() + BCX, IBY = y => (y - S.boardY - BCY) / bs() + BCY;
const geoS = () => ({ ...S, ringR: S.ringR * bs(), tubeR: S.tubeR * bs(), clipSize: S.clipSize * bs() });
function placeLevel(lv) { return { name: lv.name, rings: lv.rings.map(r => ({ ...r, x: BX(r.x), y: BY(r.y) })), clips: lv.clips.map(c => ({ ...c, x: BX(c.x), y: BY(c.y), ...(c.rx != null ? { rx: BX(c.rx), ry: BY(c.ry) } : {}) })), theme: lv.theme, word: lv.word }; }
const isRefLevel = () => { const j = S[levelKey(S)]; return !(j && j.trim()) && (S.theme !== 'letters' || (!!LETTER_SEQS[String(S.word).toUpperCase()] && !S.wordSeed)); };
const LT = () => !!(L && L.theme === 'letters');
function rebuild() {
  if (cv.width !== S.canvasW || cv.height !== S.canvasH) { cv.width = S.canvasW; cv.height = S.canvasH; }
  if (!document.documentElement.classList.contains('h5-playable')) cv.style.aspectRatio = `${S.canvasW}/${S.canvasH}`;
  computeView(); S3.setSize(cv.width * S.ssaa, cv.height * S.ssaa);
}
function newGame(lv = null) {
  stopAuto(); rebuild(); level = lv || levelFromSettings(S); L = placeLevel(level);
  G = new Game(L, S); lastT = now(); acc = 0; ripples.length = 0; winSfx = false; pd = null;
  { const h0 = LT() ? LETTER_HAND0 : REF_HAND0; hand.x = h0.x; hand.y = h0.y; } window.__finished = false; finishStopT = null;
  const sv = solveLevel(level, S.gripLimit); G.solvable = sv.solvable;
  status(`v${APP_VERSION} · ${level.name || '自定义关卡'} · ${level.rings.length} 个环 · ${level.clips.length} 个扣 · ${sv.solvable ? '可全部解开' : `⚠ 不可解（${sv.stuck.length} 个环卡死）`}`);
}
const ended = () => !!(G && G.winT != null);

// ---------- 推进（固定 120Hz） ----------
function step(t) {
  let dt = Math.min(0.25, (t - lastT) / 1000); lastT = t; if (dt <= 0) return;
  acc += dt; const h = 1 / 120;
  while (acc >= h) { acc -= h; if (editor) continue; directorStep(h); G.update(h); handleEvents(); }
}
function handleEvents() {
  for (const e of G.events) {
    if (e.type === 'grab') sfx.play('grab', S);
    else if (e.type === 'pop') sfx.play('pop', S);
    else if (e.type === 'block') sfx.play('block', S);
    else if (e.type === 'release') sfx.play('grab', S);
    else if (e.type === 'win') { window.__finished = true; status(`全部解开！用时 ${G.t.toFixed(1)} 秒`); onFinish(); }
  }
  G.events.length = 0;
  if (!winSfx && G.winT != null && G.t >= G.winT + 0.15) { winSfx = true; sfx.play('win', S); }
}

// ---------- 自动通关：参考序列（含试探）→ 求解 ----------
let rngS = 1; const rnd = (a = 0, b = 1) => { rngS = (rngS * 16807) % 2147483647; return a + (rngS / 2147483647) * Math.max(0, b - a); };
function startAuto() {
  newGame(level); rngS = 12345;
  auto = { mode: S.autoMode === 'ref' && isRefLevel() && S.boardScale === 1 && S.boardX === 0 && S.boardY === 0 && S.gripLimit === 0 ? 'ref' : 'solver', t0: G.t, idx: 0, plan: null, lastEnd: 0 };
  hand.visible = true; { const h0 = LT() ? LETTER_HAND0 : REF_HAND0; hand.x = h0.x; hand.y = h0.y; }
  if (auto.mode !== 'ref') { hand.x = view.x0 + view.w * 0.78; hand.y = view.y0 + view.h * 0.86; }
  updAutoBtn(); sfx.resume();
  if (S.autoRec && !rec) startRec(); // 默认关：自动通关不会自动开始录制
}
function stopAuto() { if (!auto) return; if (G && G.drag) G.release(); auto = null; hand.visible = false; hand.follow = null; hand.pressT0 = null; updAutoBtn(); }
function autoSolve() { if (auto) { stopAuto(); return; } startAuto(); }
function grabPoint(i, ga) { const f = G.xf(i), R = LT() ? (L.rings[i].ch === 'C' ? 0.42 : 0.3) * (L.rings[i].h || 140) * bs() : S.ringR * bs(); return [f.x + R * Math.cos(ga * Math.PI / 180), f.y + R * Math.sin(ga * Math.PI / 180)]; }
function bestGrab(i) { // 求解模式：抓离扣子最远、靠近手的位置
  const b = L.rings[i], gr = G.grips(i); let best = 90, bd = -1e9;
  for (let a = -180; a < 180; a += 15) { const p = [b.x + Math.cos(a * Math.PI / 180), b.y + Math.sin(a * Math.PI / 180)], gap = ((a - b.gap + 540) % 360) - 180; if (Math.abs(gap) < S.gapDeg * 0.7) continue; let s = gr.length ? Math.min(...gr.map(c => Math.hypot(c.x - b.x - Math.cos(a * Math.PI / 180) * S.ringR, c.y - b.y - Math.sin(a * Math.PI / 180) * S.ringR))) : 0; s += Math.sin(a * Math.PI / 180) * 20 + Math.cos(a * Math.PI / 180) * 30; void p; if (s > bd) { bd = s; best = a; } }
  return best;
}
function directorStep(h) {
  if (!auto) return; const sp = S.autoSpeed, tau = G.t - auto.t0;
  if (G.winT != null) return;
  if (!auto.plan) {
    let st = null;
    if (auto.mode === 'ref') { const SEQ = LT() ? LETTER_SEQS[String(S.word).toUpperCase()] || [] : REF_SEQ; if (auto.idx < SEQ.length) { const q = SEQ[auto.idx++]; st = { ...q, at: q.t / sp, d: q.d / sp }; } else auto.mode = 'solver'; }
    if (auto.mode === 'solver') {
      if (G.rings.some(r => r.state === 'fly')) return;
      const free = G.freeIds(); if (!free.length) { status('⚠ 没有可取下的环（关卡卡死）'); stopAuto(); return; }
      const i = free.slice().sort((a, b) => Math.hypot(L.rings[a].x - hand.x, L.rings[a].y - hand.y) - Math.hypot(L.rings[b].x - hand.x, L.rings[b].y - hand.y))[0];
      const gap = (rnd(S.delayMin, S.delayMax) + (rnd() < S.thinkChance ? rnd(0, S.thinkMax) : 0)) / 1000 / sp;
      const mv = rnd(S.moveMin, S.moveMax) / 1000 / sp;
      if (LT()) { const b = L.rings[i]; st = { i, ga: b.ch === 'C' ? 90 : -60, dir: 1, sw: b.ch === 'C' && G.grips(i).length ? 300 : 20, at: Math.max(tau + mv, auto.lastEnd + gap + mv), d: (b.ch === 'C' && G.grips(i).length ? 2.4 : 0.35) / sp }; }
      else st = { i, ga: bestGrab(i), dir: rnd() < 0.5 ? 1 : -1, at: Math.max(tau + mv, auto.lastEnd + gap + mv), d: S.dragDur / 1000 / sp };
    }
    const [gx, gy] = LT() && auto.mode === 'ref' ? grabPoint(st.i, st.ga) : grabPoint(st.i, st.ga), j = auto.mode === 'solver' ? [(rnd() - 0.5) * S.jitter, (rnd() - 0.5) * S.jitter] : [0, 0];
    auto.plan = { ...st, from: [hand.x, hand.y], tgt: [gx + j[0], gy + j[1]], moveT0: Math.max(tau, st.at - Math.max(0.15 / sp, Math.min(st.at - tau, (S.moveMax / 1000) / sp * 1.4))), pressed: false, bend: [(rnd() - 0.5) * 60, 10 + rnd() * 30] };
  }
  const P = auto.plan;
  if (!P.pressed) {
    if (tau >= P.moveT0) { const u = clamp01((tau - P.moveT0) / Math.max(1e-3, P.at - P.moveT0)), e = easeIO(u), [x0, y0] = P.from, [x1, y1] = P.tgt, cx = (x0 + x1) / 2 + P.bend[0], cy = (y0 + y1) / 2 + P.bend[1]; hand.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1; hand.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1; }
    if (tau >= P.at) {
      hand.x = P.tgt[0]; hand.y = P.tgt[1]; if (S.tapRipple) ripples.push({ x: hand.x, y: hand.y, t0: G.t });
      if (G.rings[P.i].state !== 'idle') { auto.plan = null; return; }
      G.press(P.i, hand.x, hand.y); P.pressed = true; P.t1 = tau; hand.follow = 1; if (S.pressEnabled) hand.pressT0 = G.t;
      const r = G.rings[P.i]; P.piv = [r.px, r.py]; P.a0 = Math.atan2(hand.y - r.py, hand.x - r.px); P.rr = Math.hypot(hand.x - r.px, hand.y - r.py);
      P.sweep = P.sw != null ? P.sw * Math.PI / 180 * P.dir : (G.drag.free ? S.dragMaxDeg : S.blockMaxDeg * 2.2) / Math.max(0.05, S.dragFollow) * Math.PI / 180 * P.dir;
    }
    return;
  }
  const u = clamp01((tau - P.t1) / P.d), e = easeIO(u), wob = P.blocked ? Math.sin(u * Math.PI * 3) * 0.6 : 1, a = P.a0 + P.sweep * (P.blocked ? wob * 0.5 : e);
  hand.x = P.piv[0] + P.rr * Math.cos(a); hand.y = P.piv[1] + P.rr * Math.sin(a); G.move(hand.x, hand.y);
  if (u >= 1) { G.release(); hand.follow = null; hand.pressT0 = null; auto.lastEnd = tau; auto.plan = null; }
}
function onFinish() { if (rec && S.autoStop && auto) { finishStopT = G.t + (S.endCard ? S.endDelay / 1000 + 0.4 : 0) + S.tailSec; } }
let finishStopT = null;
function updAutoBtn() { const b = document.getElementById('btnAuto'); if (b) { b.textContent = auto ? '■ 停止' : '▶ 自动通关'; b.classList.toggle('on', !!auto); } }

// ---------- 渲染 ----------
function xfs() { return G.rings.map((r, i) => r.state === 'gone' ? null : G.xf(i)); }
function flashes() { return G.clipFlash.map(t0 => { const d = G.t - t0; return d >= 0 && d < 0.5 ? Math.max(0, Math.sin(d / 0.5 * Math.PI * 3)) * (1 - d / 0.5) : 0; }); }
function drawBg(g) {
  const gr = g.createLinearGradient(0, 0, 0, cv.height); gr.addColorStop(0, LT() ? S.lbgTop : S.bgTop); gr.addColorStop(1, LT() ? S.lbgBottom : S.bgBottom); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  const rg = g.createRadialGradient(cv.width * 0.55, cv.height * 0.55, 10, cv.width * 0.55, cv.height * 0.55, cv.height * 0.6); rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, cv.width, cv.height);
}
function drawSlots(g) { // 字母主题：顶部单词槽（参考：浅色圆角底板 + 灰色圆角格，取下的字母飞入后显示为彩色字）
  if (!LT() || !L.word) return; g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K);
  const n = L.word.length, w = S.slotW, gp = S.slotGap, x0 = 360 - (n * w + (n - 1) * gp) / 2, y = S.slotY, rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  g.fillStyle = 'rgba(235,240,250,0.75)'; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; rr(x0 - 12, y - 10, n * w + (n - 1) * gp + 24, S.slotH + 20, 14); g.fill(); g.stroke();
  for (let k = 0; k < n; k++) { g.fillStyle = '#d6dbe4'; rr(x0 + k * (w + gp), y, w, S.slotH, 10); g.fill(); }
  g.font = `900 ${Math.round(S.slotH * 0.62)}px "Arial Rounded MT Bold","Arial Black",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  G.rings.forEach((r, i) => { if (r.state === 'gone' && r.slot != null) { g.fillStyle = S.whiteModel ? '#cfcfcf' : colorOf(S, L.rings[i].c); g.fillText(L.rings[i].ch, x0 + r.slot * (w + gp) + w / 2, y + S.slotH / 2 + 2); } });
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawTitle(g) {
  if (LT()) { if (S.lvTitle) { g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K); g.fillStyle = '#2a3346'; g.font = `800 ${S.lvTitleSize}px "Arial Rounded MT Bold","Arial",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.lvTitle, 360, S.lvTitleY); g.setTransform(1, 0, 0, 1, 0, 0); } return drawSlots(g); }
  if (!S.titleShow) return; g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K);
  g.fillStyle = S.titleBar; g.fillRect(view.x0 - 2, S.titleY, view.w + 4, S.titleH);
  g.fillStyle = S.titleColor; g.font = `900 ${S.titleSize}px "Arial Black","Arial Rounded MT Bold","Noto Sans CJK SC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.translate(DW / 2, S.titleY + S.titleH / 2 + S.titleSize * 0.04 + (S.titleDY || 0)); g.scale(S.titleSX || 1, 1); g.fillText(S.titleText, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
}
const _tmp = {}; const tmpC = (k, w, h) => { let c = _tmp[k]; if (!c) c = _tmp[k] = document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; };
let grainTile = null;
function drawGrain(g, W, H) { if (S.grain <= 0) return; if (!grainTile) { grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 256; const gg = grainTile.getContext('2d'), d = gg.createImageData(256, 256); let r = 99; for (let i = 0; i < d.data.length; i += 4) { r = (r * 16807) % 2147483647; const v = 128 + ((r / 2147483647) - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } gg.putImageData(d, 0, 0); }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = S.grain; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grainTile, 'repeat'); g.fillRect(0, 0, W, H); g.restore(); }
function drawRings(g, only = -1, X = null) {
  S3.build(L, geoS()); const c3 = S3.render(S, view, X || xfs(), flashes(), only), W = cv.width, H = cv.height;
  // 暖色剪影（投影 / 接触 AO 共用）
  const sil = tmpC('sil', W, H), sg = sil.getContext('2d'); sg.imageSmoothingQuality = 'high'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; sg.globalCompositeOperation = 'copy'; sg.drawImage(c3, 0, 0, W, H); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = S.shadowColor; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over';
  if (S.shadowAlpha > 0) { g.save(); g.globalAlpha = S.shadowAlpha; g.filter = `blur(${S.shadowBlur * K}px)`; g.drawImage(sil, S.shadowDX * K, S.shadowDY * K); g.restore(); }
  if (S.aoAmount > 0) { g.save(); g.globalAlpha = S.aoAmount; g.filter = `blur(${S.aoBlur * K}px)`; g.drawImage(sil, 0, S.aoBlur * K * 0.4); g.restore(); }
  if (S.depthBlur > 0) { // 上方景深：上半部分用模糊版，向下渐变到清晰
    const bl = tmpC('bl', W, H), bg2 = bl.getContext('2d'); bg2.globalCompositeOperation = 'copy'; bg2.filter = `blur(${S.depthBlur * K}px)`; bg2.drawImage(c3, 0, 0, W, H); bg2.filter = 'none';
    const y1 = (S.depthBlurY - view.y0) * K, gr = bg2.createLinearGradient(0, 0, 0, Math.max(1, y1)); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    const sh = tmpC('sh', W, H), shg = sh.getContext('2d'); shg.globalCompositeOperation = 'copy'; shg.drawImage(c3, 0, 0, W, H); shg.globalCompositeOperation = 'destination-out'; shg.fillStyle = gr; shg.fillRect(0, 0, W, Math.max(1, y1)); shg.globalCompositeOperation = 'source-over';
    bg2.globalCompositeOperation = 'destination-in'; bg2.fillStyle = gr; bg2.fillRect(0, 0, W, Math.max(1, y1)); bg2.fillStyle = '#000'; bg2.globalCompositeOperation = 'destination-out'; bg2.fillRect(0, Math.max(1, y1), W, H); bg2.globalCompositeOperation = 'source-over';
    g.drawImage(sh, 0, 0); g.drawImage(bl, 0, 0);
  } else g.drawImage(c3, 0, 0, W, H);
}
// 弹出动态模糊：飞行中的环从主渲染剔除，按快门时间多次采样平均叠加（参考视频飞出有明显拖影）
function drawRingsMB(g) {
  const fly = G.rings.filter(r => r.state === 'fly' && S.mblur > 0).map(r => r.i);
  if (!fly.length) return drawRings(g);
  const X = xfs(); fly.forEach(i => X[i] = null); drawRings(g, -1, X);
  const N = Math.max(2, S.mblurN | 0), t0 = G.t, W = cv.width, H = cv.height, acc = tmpC('mb', W, H), ag = acc.getContext('2d'); ag.globalCompositeOperation = 'copy';
  for (let k = 0; k < N; k++) {
    G.t = t0 - S.mblur / 1000 * k / (N - 1); const Y = G.rings.map(() => null); fly.forEach(i => { if (G.rings[i].fly && G.t >= G.rings[i].fly.t0) Y[i] = G.xf(i); else Y[i] = X[i] || null; });
    const c3 = S3.render(S, view, Y, flashes()); ag.globalAlpha = 1 / (k + 1); ag.drawImage(c3, 0, 0, W, H); ag.globalCompositeOperation = 'source-over';
  }
  G.t = t0; g.drawImage(acc, 0, 0);
}
function draw() {
  const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  drawBg(g); drawRingsMB(g); drawGrain(g, cv.width, cv.height); drawTitle(g);
  g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K);
  if (editor) drawEditor(g);
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i], u = (G.t - r.t0) / 0.45; if (u > 1) { ripples.splice(i, 1); continue; } g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - u)})`; g.lineWidth = 5; g.beginPath(); g.arc(r.x, r.y, 12 + 40 * u, 0, 7); g.stroke(); }
  const ea = endAlpha(); if (ea > 0) drawEnd(g, ea);
  const hs = handState(); if (hs) drawHand(g, hs);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function endAlpha() { if (!G || G.winT == null || !S.endCard) return 0; const d = (G.t - G.winT) * 1000 - S.endDelay; return d > 0 ? Math.min(1, d / 400) : 0; }
function endButton() { return { x: DW / 2 - 170, y: 820, w: 340, h: 110 }; }
function drawEnd(g, a) {
  g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(view.x0, view.y0, view.w, view.h);
  g.fillStyle = '#fff'; g.font = '900 64px "Arial Black","Noto Sans CJK SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.endTitle, DW / 2, 560);
  const b = endButton(); g.fillStyle = S.titleColor; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 55); g.fill(); g.fillStyle = '#111'; g.font = '900 52px "Noto Sans CJK SC",sans-serif'; g.fillText(S.endBtn, DW / 2, b.y + b.h / 2 + 2); g.restore();
}

// ---------- 手指 ----------
function handScaleOf() { return hand.img ? S.handSize * DW / hand.img.width : 1; }
const handHidden = () => (!S.endCardHand && endAlpha() > 0);
function handState() { if (H5_NO_HAND || editor || !S.handShow || !hand.img || !hand.visible || handHidden()) return null; if (!auto && !S.manualHand) return null; return { x: hand.x, y: hand.y, s: handScaleOf() * (1 - S.pressDepth * hand.press) }; }
function drawHand(g, h) { const im = hand.img, w = im.width * h.s, hh = im.height * h.s; g.save(); g.translate(h.x, h.y); g.rotate(S.handRotation * Math.PI / 180); if (S.handFlip) g.scale(-1, 1); g.drawImage(im, -S.handAnchorX * w, -S.handAnchorY * hh, w, hh); g.restore(); }
function handCursorHidden() { return !H5_NO_HAND && !editor && !!(S.hideCursor && S.handShow && hand.img && !handHidden() && (auto ? hand.visible : S.manualHand && hand.visible)); }
function updateCursor() { const c = editor ? 'crosshair' : handCursorHidden() ? 'none' : 'pointer'; if (cv.style.cursor !== c) cv.style.cursor = c; }
function updPress() { if (!S.pressEnabled || hand.pressT0 == null) { hand.press = hand.follow && S.pressEnabled ? 1 : 0; return; } const p = (G.t - hand.pressT0) / 0.12; hand.press = p > 1 ? (hand.follow ? 1 : 0) : Math.sin(Math.PI / 2 * clamp01(p)); if (p > 1 && !hand.follow) hand.pressT0 = null; }
function loadHand() { if (H5_NO_HAND) { hand.img = null; return; } const im = new Image(); im.onload = () => { hand.img = im; }; im.onerror = () => { hand.img = null; }; im.src = S.handImage || DEFAULT_HAND; }

// ---------- 输入：按住环拖动，松手判定 ----------
function evtDesign(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width / K + view.x0, (e.clientY - r.top) / r.height * cv.height / K + view.y0]; }
function pressDesign(x, y) {
  sfx.resume();
  if (endAlpha() > 0) { const b = endButton(); if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && window.__h5Install) window.__h5Install(); return -1; }
  if (ended()) { if (window.__h5Install && document.documentElement.classList.contains('h5-playable')) window.__h5Install(); return -1; }
  const i = G.hitTest(x, y, S.ringR * bs(), S.tubeR * bs(), S.hitPad); if (S.tapRipple) ripples.push({ x, y, t0: G.t });
  if (i >= 0) G.press(i, x, y); return i;
}
let pd = null;
cv.addEventListener('pointerdown', e => {
  sfx.resume(); const [x, y] = evtDesign(e);
  if (editor) { editorDown(x, y); try { cv.setPointerCapture(e.pointerId); } catch (_) { } return; }
  if (auto) return;
  hand.x = x; hand.y = y; hand.visible = true; hand.follow = 1; if (S.pressEnabled) hand.pressT0 = G.t;
  pd = { i: pressDesign(x, y) }; try { cv.setPointerCapture(e.pointerId); } catch (_) { }
});
cv.addEventListener('pointermove', e => { const [x, y] = evtDesign(e); if (editor) { editorMove(x, y); return; } if (auto) return; hand.x = x; hand.y = y; hand.visible = true; if (pd && G.drag) G.move(x, y); });
cv.addEventListener('pointerup', () => { if (editor) { editorUp(); return; } if (auto) return; hand.follow = null; hand.pressT0 = null; if (G.drag) G.release(); pd = null; });
cv.addEventListener('pointercancel', () => { pd = null; hand.follow = null; if (G && G.drag) G.release(); });
cv.addEventListener('pointerleave', () => { if (!auto && !pd) hand.visible = false; });

// ---------- 关卡编辑器 ----------
const ED_TOOLS_L = [['move', '拖动字母(靠近套管自动穿入)'], ['rodS', '短杆+套管'], ['rodL', '长杆+套管'], ['gap', '旋转15°'], ['color', '改色'], ['erase', '删除']];
const ED_TOOLS = [['move', '移动环/扣'], ['add', '加环'], ['gap', '旋转缺口'], ['color', '改色'], ['link', '连扣(先点主人再点被扣)'], ['erase', '删除']];
function openEditor() { stopAuto(); newGame(); editor = { tool: 'move', color: 'red', lv: JSON.parse(JSON.stringify({ name: level.name, rings: level.rings, clips: level.clips, theme: level.theme, word: level.word })), ch: 'A', drag: null, link: -1 }; buildEditBar(); toast('关卡编辑器：拖动环或扣子移动；工具栏切换加环 / 缺口 / 改色 / 连扣 / 删除', 3000); }
function closeEditor(save = true) { if (!editor) return; const lv = editor.lv; editor = null; const bar = document.getElementById('editBar'); if (bar) bar.remove(); if (save) { S[levelKey(S)] = JSON.stringify({ name: lv.name && lv.name !== '参考关卡' ? lv.name : '自定义关卡', rings: lv.rings, clips: lv.clips, theme: lv.theme, word: lv.word }); saveSettings(S); buildPanel(); } newGame(); }
function edRefresh() { level = normalizeLevel(editor.lv); L = placeLevel(level); G = new Game(L, S); const n = document.getElementById('edInfo'); if (n) { const s = solveLevel(level, S.gripLimit); editor.stuck = s.stuck; n.textContent = `${level.rings.length} 个环 · ${level.clips.length} 个扣 · ${s.solvable ? '✔ 可全部解开（顺序 ' + s.order.join('→') + '）' : `✖ 不可解：${s.stuck.length} 个环卡死（红圈）`}`; } }
function edHitRing(x, y) { const lx = IBX(x), ly = IBY(y); if (editor.lv.theme === 'letters') { let b = -1, bd = S.letterTube + 14; editor.lv.rings.forEach((r, i) => { const q = glyphNearest(glyphPolys(r.ch, r.h || 140, r.rot || 0), lx - r.x, ly - r.y); if (q.d < bd) { bd = q.d; b = i; } }); return b; } let best = -1, bd = S.ringR + S.tubeR + 10; editor.lv.rings.forEach((r, i) => { const d = Math.abs(Math.hypot(lx - r.x, ly - r.y) - S.ringR); if (d < S.tubeR + 14 && d < bd) { bd = d; best = i; } }); if (best < 0) editor.lv.rings.forEach((r, i) => { const d = Math.hypot(lx - r.x, ly - r.y); if (d < S.ringR * 0.8 && d < bd) { bd = d; best = i; } }); return best; }
function edHitClip(x, y) { const lx = IBX(x), ly = IBY(y); let best = -1, bd = S.clipSize * 0.9; editor.lv.clips.forEach((c, k) => { const d = Math.hypot(lx - c.x, ly - c.y); if (d < bd) { bd = d; best = k; } }); return best; }
// ---------- 字母关卡编辑：输入字母生成 3D 字母；杆件面板（短/长杆）拖到字母上 → 半透明吸附预览 → 松手固定杆端；
// 另一端为套管，拖动别的字母靠近 → 判断该字母有笔画能穿过套管（距离/方向）→ 绿色预览，松手自动穿入；否则红色提示
const edPolys = r => glyphPolys(r.ch, r.h || 140, r.rot || 0);
function edAddLetters(txt) { const lv = editor.lv, w = String(txt || '').toUpperCase().replace(/[^A-Z]/g, ''); if (!w) return toast('请输入 A–Z 字母');
  [...w].forEach((ch, k) => lv.rings.push({ c: ['yellow', 'pink', 'teal', 'orange', 'purple', 'blue', 'green', 'red'][lv.rings.length % 8], ch, x: Math.round(360 - (w.length - 1) * 75 + k * 150), y: 640 + (lv.rings.length >= 4 ? 220 : 0), rot: 0, h: 140 }));
  lv.word = lv.word || lv.rings.map(r => r.ch).join(''); edRefresh(); toast(`已生成 ${w.length} 个字母`); }
function edRodGhost(lx, ly, len) { const lv = editor.lv; let best = null; lv.rings.forEach((r, i) => { const q = glyphNearest(edPolys(r), lx - r.x, ly - r.y); if (q.d < 60 && (!best || q.d < best.d)) best = { i, q, d: q.d, r }; });
  if (!best) return { ok: false, x: lx, y: ly, bx: lx + len, by: ly };
  const { q, r } = best, ax = r.x + q.x, ay = r.y + q.y; let nx = -Math.sin(q.ang), ny = Math.cos(q.ang); if ((lx - ax) * nx + (ly - ay) * ny < 0) { nx = -nx; ny = -ny; } if (Math.hypot(lx - ax, ly - ay) < 4) { nx = Math.cos(q.ang + Math.PI / 2); ny = Math.sin(q.ang + Math.PI / 2); }
  const bx = ax + nx * len, by = ay + ny * len, hit = lv.rings.some((q2, j) => j !== best.i && segGlyphDist(ax, ay, bx, by, edPolys(q2), q2.x, q2.y) < S.letterTube * 2 + 2 && glyphNearest(edPolys(q2), bx - q2.x, by - q2.y).d > S.letterTube * S.beadR * 1.6);
  return { ok: !hit, hit, o: best.i, x: ax, y: ay, bx, by, ang: Math.atan2(ny, nx) }; }
function edThreadCheck(i) { // 字母 i 是否有笔画能穿过某个空珠：笔画到套管中心距离 < 套管半径，且笔画方向与杆方向夹角 > 35°（能从套管里穿过）
  const lv = editor.lv, r = lv.rings[i], sr = S.letterTube * S.beadR; let best = null;
  lv.clips.forEach((c, k) => { if (c.g >= 0 || c.o === i) return; const q = glyphNearest(edPolys(r), c.x - r.x, c.y - r.y); if (q.d > sr * 3.2) return; const rodA = Math.atan2(c.y - c.ry, c.x - c.rx); let da = Math.abs(((q.ang - rodA) * 180 / Math.PI % 180 + 180) % 180); da = Math.min(da, 180 - da);
    const ok = q.d < sr * 1.6 && da > 35; if (!best || q.d < best.q.d) best = { k, q, ok, dx: c.x - (r.x + q.x), dy: c.y - (r.y + q.y) }; });
  return best; }
function editorDown(x, y) {
  if (editor.lv.theme === 'letters' && (editor.tool === 'rodS' || editor.tool === 'rodL')) { const len = editor.tool === 'rodS' ? 60 : (editor.rodLen || 130); editor.rod = { len, ghost: edRodGhost(IBX(x), IBY(y), len) }; return; }
  const T = editor.tool, lv = editor.lv, lx = IBX(x), ly = IBY(y);
  const LTE = lv.theme === 'letters';
  if (T === 'add' && LTE) { lv.rings.push({ c: editor.color, ch: (editor.ch || 'A').toUpperCase(), x: Math.round(lx), y: Math.round(ly), rot: 0, h: 140 }); lv.word = lv.rings.map(r => r.ch).join(''); edRefresh(); return; }
  if (T === 'add') { lv.rings.push({ c: editor.color, x: Math.round(lx), y: Math.round(ly), gap: 90 }); edRefresh(); return; }
  const k = edHitClip(x, y), i = edHitRing(x, y);
  if (T === 'move') { if (k >= 0) editor.drag = { k, dx: lv.clips[k].x - lx, dy: lv.clips[k].y - ly }; else if (i >= 0) editor.drag = { i, x0: lx, y0: ly, r0: { x: lv.rings[i].x, y: lv.rings[i].y }, c0: lv.clips.map(c => c.o === i ? [c.x, c.y, c.rx, c.ry] : null) }; return; }
  if (T === 'erase') { if (k >= 0) lv.clips.splice(k, 1); else if (i >= 0) { lv.rings.splice(i, 1); lv.clips = lv.clips.filter(c => c.o !== i && c.g !== i).map(c => ({ ...c, o: c.o > i ? c.o - 1 : c.o, g: c.g > i ? c.g - 1 : c.g })); } edRefresh(); return; }
  if (i < 0) return;
  if (T === 'gap' && LTE) { lv.rings[i].rot = ((lv.rings[i].rot || 0) + 45) % 360; }
  else if (T === 'link' && LTE) { if (editor.link < 0) { editor.link = i; toast('已选主人字母（连杆一端），再点被扣住的字母（米珠位置）'); return; } if (editor.link !== i) { const a = lv.rings[editor.link], b = lv.rings[i], qb = glyphNearest(glyphPolys(b.ch, b.h || 140, b.rot || 0), lx - b.x, ly - b.y), bx = b.x + qb.x, by = b.y + qb.y, qa = glyphNearest(glyphPolys(a.ch, a.h || 140, a.rot || 0), bx - a.x, by - a.y); lv.clips.push({ o: editor.link, g: i, x: Math.round(bx), y: Math.round(by), rx: Math.round(a.x + qa.x), ry: Math.round(a.y + qa.y) }); } editor.link = -1; }
  else if (T === 'gap') { lv.rings[i].gap = ((lv.rings[i].gap + 45 + 180) % 360) - 180; }
  else if (T === 'color') lv.rings[i].c = editor.color;
  else if (T === 'link') { if (editor.link < 0) { editor.link = i; toast('已选主人环，再点被扣住的环'); return; } if (editor.link !== i) { const a = lv.rings[editor.link], b = lv.rings[i], p1 = circleX(a, b, S.ringR, 1), p2 = circleX(a, b, S.ringR, -1), p = Math.hypot(p1.x - lx, p1.y - ly) < Math.hypot(p2.x - lx, p2.y - ly) ? p1 : p2; lv.clips = lv.clips.filter(c => !((c.o === editor.link && c.g === i) || (c.o === i && c.g === editor.link))); lv.clips.push({ o: editor.link, g: i, x: Math.round(p.x), y: Math.round(p.y) }); } editor.link = -1; }
  edRefresh();
}
function editorMove(x, y) {
  if (editor && editor.rod) { editor.rod.ghost = edRodGhost(IBX(x), IBY(y), editor.rod.len); return; }
  const D = editor && editor.drag; if (!D) return; const lv = editor.lv, lx = IBX(x), ly = IBY(y); if (D.k != null) { lv.clips[D.k].x = Math.round(lx + D.dx); lv.clips[D.k].y = Math.round(ly + D.dy); } else { const dx = lx - D.x0, dy = ly - D.y0; lv.rings[D.i].x = Math.round(D.r0.x + dx); lv.rings[D.i].y = Math.round(D.r0.y + dy); lv.clips.forEach((c, k) => { if (D.c0[k]) { c.x = Math.round(D.c0[k][0] + dx); c.y = Math.round(D.c0[k][1] + dy); if (D.c0[k][2] != null) { c.rx = Math.round(D.c0[k][2] + dx); c.ry = Math.round(D.c0[k][3] + dy); } } else if (lv.theme === 'letters' && c.g === D.i && Math.hypot(dx, dy) > 30) c.g = -1; }); if (lv.theme === 'letters') editor.thread = edThreadCheck(D.i); } level = normalizeLevel(lv); L = placeLevel(level); G = new Game(L, S); }
function editorUp() {
  if (editor && editor.rod) { const g = editor.rod.ghost; editor.rod = null; if (g.ok) { editor.lv.clips.push({ o: g.o, g: -1, rx: Math.round(g.x), ry: Math.round(g.y), x: Math.round(g.bx), y: Math.round(g.by) }); toast('杆端已固定在 ' + editor.lv.rings[g.o].ch + '，拖动另一个字母穿入珠子'); } else toast(g.hit ? '✖ 杆会穿过其他字母，换个位置/方向' : '⚠ 请把杆拖到字母笔画上'); edRefresh(); return; }
  if (editor && editor.drag) { const D = editor.drag; editor.drag = null; editor.thread = null;
    if (editor.lv.theme === 'letters' && D.i != null) { const lv = editor.lv, t = edThreadCheck(D.i); if (t && t.ok) { lv.rings[D.i].x = Math.round(lv.rings[D.i].x + t.dx); lv.rings[D.i].y = Math.round(lv.rings[D.i].y + t.dy); lv.clips[t.k].g = D.i; toast(`✔ ${lv.rings[D.i].ch} 已穿入套管`); } else if (t) toast('✖ 该位置笔画无法穿过珠子（方向/距离不合适）');
      const ov = layoutIssues(normalizeLevel(lv), S.letterTube).list.filter(x => x[0] === 'overlap' && (x[1] === D.i || x[2] === D.i)); if (ov.length) { const dx = D.r0.x - lv.rings[D.i].x, dy = D.r0.y - lv.rings[D.i].y; lv.rings[D.i].x = D.r0.x; lv.rings[D.i].y = D.r0.y; lv.clips.forEach((c, k) => { if (D.c0[k]) { c.x += dx; c.y += dy; if (c.rx != null) { c.rx += dx; c.ry += dy; } } }); toast('✖ 字母重叠，已退回原位'); } }
    edRefresh(); } }
function drawEditor(g) {
  g.lineWidth = 3;
  if (editor.lv.theme === 'letters') { const sr = S.letterTube * S.beadR, P = (x, y) => [BX(x), BY(y)];
    const rodDraw = (ax, ay, bx, by, col, a) => { g.save(); g.globalAlpha = a; g.strokeStyle = col === S.beadColor ? S.rodColor : col; g.lineCap = 'round'; g.lineWidth = S.rodR * 2.4 * bs(); g.beginPath(); g.moveTo(...P(ax, ay)); g.lineTo(...P(bx, by)); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(...P(bx, by), sr * bs(), 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(...P(bx, by), sr * 0.55 * bs(), 0, 7); g.stroke(); g.restore(); };
    editor.lv.clips.forEach(c => { if (c.g < 0) rodDraw(c.rx, c.ry, c.x, c.y, S.beadColor, 0.95); });
    if (editor.rod) { const q = editor.rod.ghost; rodDraw(q.x, q.y, q.bx, q.by, q.ok ? S.beadColor : '#ff3b3b', 0.4); }
    if (editor.thread) { const t = editor.thread, c = editor.lv.clips[t.k]; g.save(); g.strokeStyle = t.ok ? '#18c95a' : '#ff3b3b'; g.lineWidth = 5; g.setLineDash([8, 6]); g.beginPath(); g.arc(...P(c.x, c.y), sr * 1.9 * bs(), 0, 7); g.stroke(); g.restore(); }
    return; }
  L.clips.forEach(c => { const o = L.rings[c.o], gg = L.rings[c.g]; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(c.x, c.y); g.lineTo(gg.x, gg.y); g.stroke(); g.setLineDash([]); });
  L.rings.forEach((r, i) => { g.fillStyle = 'rgba(0,0,0,0.55)'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i), r.x, r.y); if (editor.stuck && editor.stuck.includes(i)) { g.strokeStyle = '#ff2d3d'; g.beginPath(); g.arc(r.x, r.y, S.ringR * bs() + S.tubeR * bs() + 6, 0, 7); g.stroke(); } if (editor.link === i) { g.strokeStyle = '#ffd54a'; g.lineWidth = 5; g.beginPath(); g.arc(r.x, r.y, S.ringR * bs() + 20, 0, 7); g.stroke(); g.lineWidth = 3; } });
}
function buildEditBar() {
  let bar = document.getElementById('editBar'); if (bar) bar.remove(); bar = document.createElement('div'); bar.id = 'editBar';
  bar.innerHTML = `<b>✏ 关卡编辑</b> <span class="seg" id="edTools">${(L.theme === 'letters' ? ED_TOOLS_L : ED_TOOLS).map(([k, t]) => `<button data-t="${k}" class="${k === 'move' ? 'on' : ''}">${t}</button>`).join('')}</span>
  <span class="seg" id="edCols">${COLORS.map(c => `<button data-c="${c}" class="${c === 'red' ? 'on' : ''}" style="color:${S['col_' + c]}">●${COLOR_ZH[c]}</button>`).join('')}</span>
  ${L.theme === 'letters' ? `生成字母<input id="edCh" maxlength="8" placeholder="输入字母" style="width:80px"><button id="edGen">＋生成</button> 杆长<input id="edRod" type="number" value="130" style="width:50px"> 单词<input id="edWord" value="${L.word || ''}" style="width:90px">` : ''}<button id="edClear">清空</button><button id="edDone" class="primary">✔ 完成并试玩</button><button id="edCancel">取消</button><div id="edInfo"></div>`;
  document.getElementById('stageWrap').append(bar);
  bar.querySelectorAll('#edTools button').forEach(b => b.onclick = () => { editor.tool = b.dataset.t; editor.link = -1; bar.querySelectorAll('#edTools button').forEach(x => x.classList.toggle('on', x === b)); });
  bar.querySelectorAll('#edCols button').forEach(b => b.onclick = () => { editor.color = b.dataset.c; bar.querySelectorAll('#edCols button').forEach(x => x.classList.toggle('on', x === b)); });
  const ec = bar.querySelector('#edCh'), ew = bar.querySelector('#edWord'); const eg = bar.querySelector('#edGen'), er = bar.querySelector('#edRod'); if (eg) eg.onclick = () => edAddLetters(ec.value); if (er) er.onchange = () => editor.rodLen = +er.value || 130; if (ew) ew.onchange = () => { editor.lv.word = ew.value.toUpperCase(); edRefresh(); };
  bar.querySelector('#edClear').onclick = () => { if (confirm('清空所有环？')) { editor.lv.rings = []; editor.lv.clips = []; edRefresh(); } };
  bar.querySelector('#edDone').onclick = () => closeEditor(true); bar.querySelector('#edCancel').onclick = () => closeEditor(false);
  edRefresh();
}
function levelCheck() { const lv = levelFromSettings(S), s = solveLevel(lv, S.gripLimit); toast(s.solvable ? `✔ 可全部解开（${lv.rings.length} 个环，顺序 ${s.order.join('→')}）` : `✖ 不可解：${s.stuck.length} 个环卡死`, 3000); return s; }
function levelExport() { const lv = levelFromSettings(S); download(new Blob([JSON.stringify({ app: APP_ID, level: { name: lv.name, rings: lv.rings, clips: lv.clips, theme: lv.theme, word: lv.word } }, null, 1)], { type: 'application/json' }), 'ring-untangle-level.json'); }
function levelImport() { const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(t => { const j = JSON.parse(t), lv = normalizeLevel(j.level || j); if (!lv.rings.length) throw new Error('没有有效的环'); S[levelKey(S)] = JSON.stringify({ name: lv.name || file.name, rings: lv.rings, clips: lv.clips, theme: lv.theme, word: lv.word }); saveSettings(S); buildPanel(); newGame(); toast(`已导入 ${lv.rings.length} 个环`); }).catch(e => toast('导入失败：' + e.message)); }; f.click(); }
function doRandom() { const lv = randomLevel(S); S[levelKey(S)] = JSON.stringify({ name: lv.name, rings: lv.rings, clips: lv.clips, theme: lv.theme, word: lv.word }); saveSettings(S); buildPanel(); newGame(); toast(`随机关卡：${lv.rings.length} 个环、${lv.clips.length} 个扣（「画布与关卡」可恢复参考关卡）`, 2200); }
function reseed() { S.wordSeed = ((S.wordSeed | 0) + 1) % 1000; S.levelJsonL = ''; saveSettings(S); buildPanel(); newGame(); toast(`已重新生成「${S.word}」布局（种子 ${S.wordSeed}）`); }
function levelRef() { S[levelKey(S)] = ''; saveSettings(S); buildPanel(); newGame(); toast('已恢复参考关卡'); }

// ---------- 录制（只由“⏺ 开始录制”或 autoRec 触发）----------
let rec = null, recChunks = [], recT0 = 0;
function pickMime() { const mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'], webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; const list = S.recFormat === 'webm' ? webm : S.recFormat === 'mp4' ? mp4 : mp4.concat(webm); return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''; }
function startRec() {
  if (!window.MediaRecorder) { status('浏览器不支持录制'); return; }
  sfx.ensure(); const vs = cv.captureStream(S.recFps), tracks = [...vs.getVideoTracks()]; if (sfx.recDest) tracks.push(...sfx.recDest.stream.getAudioTracks());
  const mime = pickMime(); rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime || undefined, videoBitsPerSecond: S.recBitrate * 1e6 });
  recChunks = []; rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => { const type = rec.mimeType || mime || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm', blob = new Blob(recChunks, { type }); download(blob, `ring-untangle_${stampNow()}.${ext}`); window.__lastRec = { size: blob.size, type }; rec = null; updRecBtn(); if (aeByRec && aeActive()) aeStopAndExport().catch(e => console.error(e)); aeByRec = false; };
  rec.start(250); recT0 = now(); updRecBtn(); aeByRec = false; if (S.aeWithRec && !aeActive()) { recStart(); aeByRec = true; }
}
function stopRec() { finishStopT = null; if (rec && rec.state !== 'inactive') rec.stop(); }
function updRecBtn() { const b = document.getElementById('btnRec'); if (!b) return; b.textContent = rec ? '■ 停止录制' : '⏺ 开始录制'; b.classList.toggle('on', !!rec); }
const stampNow = () => { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = `⬇ ${name} (${(blob.size / 1e6).toFixed(2)}MB)`; const l = document.getElementById('recList'); if (l) l.prepend(a); a.click(); (window.__downloads || (window.__downloads = [])).push({ name, size: blob.size }); }

// ---------- AE 导出 ----------
function sceneItems() {
  const items = []; const X = xfs();
  X.forEach((f, i) => { if (f && f.op > 0.002) items.push({ id: 'ring_' + i, asset: 'ring_' + i, x: (f.x - view.x0) * K, y: (f.y - view.y0) * K, sc: f.sc, rot: f.rot, op: f.op, z: i }); });
  const hs = handState(); if (hs) items.push({ id: 'hand', asset: 'hand', x: (hs.x - view.x0) * K, y: (hs.y - view.y0) * K, sc: 1 - S.pressDepth * hand.press, rot: S.handRotation, op: 1, z: 1000 });
  const ea = endAlpha(); if (ea > 0) items.push({ id: 'end_card', asset: 'end_card', x: cv.width / 2, y: cv.height / 2, sc: 1, rot: 0, op: ea, z: 900 });
  return items;
}
function makeAssets() {
  const A = {}, mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  { const c = mk(cv.width, cv.height), g = c.getContext('2d'), sv = ctx; void sv; const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, S.bgTop); gr.addColorStop(1, S.bgBottom); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); drawGrain(g, c.width, c.height); A.background = { c, ax: 0, ay: 0 }; }
  if (S.titleShow) { const c = mk(cv.width, cv.height), g = c.getContext('2d'); g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K); g.fillStyle = S.titleBar; g.fillRect(view.x0 - 2, S.titleY, view.w + 4, S.titleH); g.fillStyle = S.titleColor; g.font = `900 ${S.titleSize}px "Arial Black","Noto Sans CJK SC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(DW / 2, S.titleY + S.titleH / 2 + S.titleSize * 0.04 + (S.titleDY || 0)); g.scale(S.titleSX || 1, 1); g.fillText(S.titleText, 0, 0); A.title = { c, ax: 0, ay: 0 }; }
  const rest = L.rings.map(r => ({ x: r.x, y: r.y, rot: 0, sc: 1, op: 1 })), Rm = (S.ringR + S.tubeR) * bs();
  L.rings.forEach((r, i) => {
    let ext = Rm; L.clips.forEach(c => { if (c.o === i) ext = Math.max(ext, Math.hypot(c.x - r.x, c.y - r.y) + S.clipSize * bs()); });
    ext += S.shadowBlur * 2 + Math.max(Math.abs(S.shadowDX), Math.abs(S.shadowDY)) + 6;
    const full = mk(cv.width, cv.height), fg = full.getContext('2d'); drawRings(fg, i, rest);
    const cx = (r.x - view.x0) * K, cy = (r.y - view.y0) * K, e = ext * K, c = mk(2 * e, 2 * e); c.getContext('2d').drawImage(full, cx - e, cy - e, 2 * e, 2 * e, 0, 0, 2 * e, 2 * e);
    A['ring_' + i] = { c, ax: e, ay: e };
  });
  if (hand.img) { const s = handScaleOf() * K, w = hand.img.width * s, h = hand.img.height * s, c = mk(w, h), g = c.getContext('2d'); if (S.handFlip) { g.translate(w, 0); g.scale(-1, 1); } g.drawImage(hand.img, 0, 0, w, h); A.hand = { c, ax: S.handFlip ? (1 - S.handAnchorX) * w : S.handAnchorX * w, ay: S.handAnchorY * h }; }
  { const c = mk(cv.width, cv.height), g = c.getContext('2d'); g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K); drawEnd(g, 1); A.end_card = { c, ax: c.width / 2, ay: c.height / 2 }; }
  return A;
}
function layerName(id, zh) { if (id === 'hand') return zh ? '手指' : 'Hand'; if (id === 'end_card') return zh ? '结束页' : 'End card'; const i = +id.split('_')[1], c = L.rings[i] ? L.rings[i].c : ''; return (zh ? '环_' : 'Ring_') + (i + 1) + '_' + (zh ? (COLOR_ZH[c] || c) : c); }
const aeRec = createAERecorder({ sfx, now, env: () => ({ L, S, items: sceneItems(), canvas: cv }), assets: () => makeAssets(), layerName });
let recClosed = false, aeLastRec = null, aeByRec = false;
function recStart() { aeRec.start(); recClosed = false; updateAEButtons(); toast('开始记录 AE 时间轴'); }
function aeActive() { return !!aeRec.rec && !recClosed; }
function aeStop() { const r = aeRec.rec; recClosed = true; updateAEButtons(); if (r && r.frames > 1) aeLastRec = r; return r && r.frames > 1 ? r : null; }
async function aeStopAndExport() { const r = aeStop(); if (!r) { toast('没有记录到内容'); return null; } return doExportAE(true, r); }
const curRec = () => aeActive() ? aeRec.rec : aeLastRec;
function updateAEButtons() { const b = document.getElementById('btn_aeToggle'); if (!b) return; b.textContent = aeActive() ? `■ 停止并导出（${((now() - (aeRec.rec.t0 || now())) / 1000).toFixed(1)}s）` : '● 开始记录'; b.classList.toggle('on', aeActive()); }
async function doExportAE(save = true, r0 = curRec()) { if (!r0) { toast('请先用“● 开始记录”记录一段（自动通关或手动游玩）'); return null; } status('正在生成 AE 工程…'); const r = await aeRec.exportZip(r0); window.__aeLast = r; if (save) download(r.blob, r.name); status(`AE 工程：${r.stats.layers} 图层，${r.stats.keys} 关键帧`); return r; }

// ---------- 3D 导出（glTF：每个环一个节点，扣子为子节点；动画 = 记录的位置/旋转/缩放）----------
async function doExport3D() {
  const r0 = curRec(); if (!r0) { toast('请先用“● 开始记录”记录一段'); return null; }
  status('正在生成 glTF…');
  const THREE = await import('three'); const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const fps = +S.export3dFps || 30, scene = new THREE.Scene(), tracks = [], u = 0.01; // 1px = 1cm
  S3.build(L, geoS());
  const nodes = S3.groups.map((g0, i) => { const g = g0.clone(true); g.name = 'Ring_' + (i + 1) + '_' + L.rings[i].c; g.traverse(o => { if (o.isMesh && o !== g) o.name = g.name + '_part'; }); g.position.set(L.rings[i].x * u, -L.rings[i].y * u, 0); g.scale.setScalar(u); g.rotation.set(0, 0, 0); scene.add(g); return g; });
  for (const [id, tr] of r0.tracks) {
    if (!id.startsWith('ring_')) continue; const i = +id.split('_')[1], n = nodes[i]; if (!n) continue;
    const s = tr.s, T = [], P = [], Q = [], Sc = []; const q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1);
    const pts = s.filter((e, k) => k === 0 || k === s.length - 1 || Math.round(e[0] * fps) !== Math.round(s[k - 1][0] * fps));
    for (const e of pts) { T.push(e[0]); P.push((e[1] / K + view.x0) * u, -(e[2] / K + view.y0) * u, 0); q.setFromAxisAngle(ax, -e[4] * Math.PI / 180); Q.push(q.x, q.y, q.z, q.w); const sc = e[3] * (e[5] > 0.01 ? 1 : 0) * u; Sc.push(sc, sc, sc); }
    const last = s[s.length - 1]; T.push(last[0] + 1 / fps); P.push(P[P.length - 3], P[P.length - 2], P[P.length - 1]); Q.push(...Q.slice(-4)); Sc.push(0, 0, 0);
    tracks.push(new THREE.VectorKeyframeTrack(n.name + '.position', T, P), new THREE.QuaternionKeyframeTrack(n.name + '.quaternion', T, Q), new THREE.VectorKeyframeTrack(n.name + '.scale', T, Sc));
  }
  const clip = new THREE.AnimationClip('RingUntangle', -1, tracks);
  const cam = new THREE.OrthographicCamera(-DW / 2 * u, DW / 2 * u, DH / 2 * u, -DH / 2 * u, 0.1, 100); cam.name = 'Camera'; cam.position.set(DW / 2 * u, -DH / 2 * u, 20); scene.add(cam);
  const glb = await new Promise((res, rej) => new GLTFExporter().parse(scene, res, rej, { binary: true, animations: [clip] }));
  const enc = new TextEncoder(), meta = { tool: APP_ID, format: 'export3d/1', fps, duration: r0.lastT, frames: Math.ceil(r0.lastT * fps), width: DW, height: DH, units: '1 px = 1 cm（Y 向上，场景在 XY 平面，相机沿 -Z 看）', nodes: nodes.map(n => n.name), level: { rings: L.rings, clips: L.clips }, note: '透明度淡出在 glTF 里用缩放→0 表示（glTF 不支持材质透明度动画）' };
  const files = [{ name: 'scene.glb', data: new Uint8Array(glb) }, { name: 'scene3d.json', data: enc.encode(JSON.stringify(meta, null, 1)) }, { name: 'README_3D.md', data: enc.encode('# 解环 · 3D 动画导出\n\n- `scene.glb`：glTF 2.0（Blender / UE5 / C4D 直接导入），每个环一个节点（扣子是子网格），动画名 RingUntangle。\n- `scene3d.json`：帧率、时长、关卡数据。\n- 本版本仅导出 glTF（未生成 FBX / blender_import.py）。\n') }];
  const blob = makeZip(files), name = `ring-untangle-tool_3d_export_${stampNow()}.zip`; download(blob, name); window.__3dLast = { name, size: blob.size, tracks: tracks.length }; status(`3D 导出：${nodes.length} 个节点，${tracks.length} 条动画轨道`); return window.__3dLast;
}
async function doExportH5() { try { return await exportH5PlayableFromPage({ toolId: APP_ID, S, stripDataUrls: [DEFAULT_HAND], status, toast }); } catch (e) { status('H5 导出失败：' + e.message); console.error(e); return null; } }
const PANEL_ACTIONS = { reseed: () => reseed(), aeToggle: () => aeActive() ? aeStopAndExport() : recStart(), aeExport: () => doExportAE(), export3d: () => doExport3D(), exportH5: () => doExportH5(), levelEdit: openEditor, levelCheck, levelExport, levelImport, levelRef };

// ---------- 主循环 ----------
function frameTick(t) { step(t); updPress(); draw(); if (aeActive()) aeRec.sample(t); if (finishStopT != null && G.t >= finishStopT) { finishStopT = null; stopRec(); } }
function loop() {
  updateCursor();
  if (window.__vclock != null) { requestAnimationFrame(loop); return; }
  const t = now(); frameTick(t);
  if (aeActive() && t - (loop.aeBtnT || 0) > 250) { loop.aeBtnT = t; updateAEButtons(); }
  const ri = document.getElementById('recInfo'); if (ri) ri.textContent = rec ? `录制中 ${((t - recT0) / 1000).toFixed(1)}s` : '';
  requestAnimationFrame(loop);
}

// ---------- 设置面板 ----------
const NEWGAME_KEYS = /^(canvas|levelJson|board|gripLimit|theme|word)/;
function applyChange(k) {
  if (k === 'h5DeviceW' || k === 'h5DeviceH') markH5DeviceCustomIfSizeEdited(S);
  if (k === 'h5Device' || k === 'h5DeviceW' || k === 'h5DeviceH') { try { if (window.__h5EditorDeviceFit) window.__h5EditorDeviceFit(); } catch (e) { } }
  saveSettings(S);
  if (/^hand/.test(k)) loadHand();
  if (k === 'ssaa') rebuild(); if (NEWGAME_KEYS.test(k)) newGame(); else if (/^(ringR|tubeR)/.test(k)) { L = placeLevel(level); G.L = L; }
}
function buildPanel() {
  const body = document.getElementById('panelBody'); if (!body) return;
  const openTitles = new Set([...body.querySelectorAll('details[open] summary')].map(s => s.textContent)); body.innerHTML = '';
  GROUPS.forEach(([title, items], gi) => {
    const det = document.createElement('details'); if (gi < 1 || openTitles.has(title)) det.open = true; det.innerHTML = `<summary>${title}</summary>`;
    items.forEach(([k, label, type, def, a, b, step2]) => {
      const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<label title="${k}">${label}</label>`;
      if (type === 'range') { const r = document.createElement('input'); r.type = 'range'; r.min = a; r.max = b; r.step = step2; r.value = S[k]; r.id = 'rng_' + k; const n = document.createElement('input'); n.type = 'number'; n.className = 'val'; n.step = step2; n.value = S[k]; r.oninput = () => { S[k] = +r.value; n.value = r.value; applyChange(k); }; n.onchange = () => { S[k] = +n.value; r.value = n.value; applyChange(k); }; row.append(r, n); }
      else if (type === 'color') { const c = document.createElement('input'); c.type = 'color'; c.value = S[k]; c.id = 'col_' + k; c.oninput = () => { S[k] = c.value; applyChange(k); }; row.append(c); }
      else if (type === 'bool') { row.classList.add('t-switch'); const l = document.createElement('label'); l.className = 'switch'; l.innerHTML = `<input type="checkbox" class="switch-input" id="chk_${k}" ${S[k] ? 'checked' : ''}><span class="slider"></span>`; l.querySelector('input').onchange = e => { S[k] = e.target.checked; applyChange(k); }; row.append(l); }
      else if (type === 'select') { const s = document.createElement('select'); s.id = 'sel_' + k; a.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }); s.value = S[k]; s.onchange = () => { S[k] = s.value; if (k === 'h5Device') { applyH5DevicePresetToSettings(S); buildPanel(); } applyChange(k); }; row.append(s); }
      else if (type === 'text') { const t = document.createElement('input'); t.type = 'text'; t.value = S[k]; t.id = 'txt_' + k; t.onchange = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'textarea') { const t = document.createElement('textarea'); t.rows = 3; t.value = S[k]; t.id = 'txt_' + k; t.placeholder = '留空 = 内置参考关卡。格式：{"rings":[{"c":"red","x":360,"y":600,"gap":90}],"clips":[{"o":0,"g":1,"x":400,"y":640}]}，o = 扣的主人环，g = 被扣住的环'; t.style.fontFamily = 'monospace'; t.style.fontSize = '11px'; t.onchange = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'button') { const bt = document.createElement('button'); bt.id = 'btn' + k; bt.textContent = a; bt.onclick = () => Promise.resolve(PANEL_ACTIONS[def] && PANEL_ACTIONS[def]()).catch(e => { status('操作失败：' + e.message); console.error(e); }); row.append(bt); }
      else if (type === 'file') { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/webp,image/jpeg,image/*'; f.id = 'file_' + k; f.onchange = () => { const file = f.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => { S[k] = fr.result; applyChange(k); }; fr.readAsDataURL(file); }; const x = document.createElement('button'); x.textContent = k === 'handImage' ? '恢复默认 hand.png' : '清除'; x.onclick = () => { S[k] = ''; f.value = ''; applyChange(k); }; row.append(f, x); }
      det.append(row);
    });
    if (title.startsWith('画布')) det.insertAdjacentHTML('beforeend', '<div class="tip">玩法：按住一个环拖一下再松手。环自己身上的扣子（同色方块）已经没有扣着别的环 → 它会从别人的扣子里滑出、飞走淡出；否则被卡住抖动（挡路的扣闪红）。参考关卡 = 参考视频里逐个量出的 11 个环 / 12 个扣。</div>');
    if (title.startsWith('手指')) det.insertAdjacentHTML('beforeend', '<div class="tip">默认手指 = 其它核玩工具同款 hand.png（指尖锚点 0.2204 / 0.0367）；上传透明 PNG 覆盖。“参考视频顺序”= 逐拍还原的 0–20.6 秒（左上绿 → 右上橙 → 中间三次试探卡住 → 右下黄 → 左下红），之后自动求解到全部解开。自动通关不会自动开始录制（除非打开“自动录制”）。</div>');
    if (title.startsWith('导出 H5')) det.insertAdjacentHTML('beforeend', '<div class="tip">试玩由玩家自己玩：导出包不含手指、默认不自动演示。须用 http 打开本工具才能导出。</div>');
    body.append(det);
  });
}
let toastT = 0;
function toast(t, dur = 1600) { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(toastT); if (dur > 0) toastT = setTimeout(() => el.classList.remove('show'), dur); }
const $ = id => document.getElementById(id) || {};
$('btnAuto').onclick = autoSolve;
$('btnNew').onclick = () => { if (editor) closeEditor(false); newGame(); };
$('btnRandom').onclick = () => { if (editor) closeEditor(false); doRandom(); };
$('btnEdit').onclick = () => editor ? closeEditor(true) : openEditor();
$('btnRec').onclick = () => rec ? stopRec() : startRec();
$('btnShot').onclick = () => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'ring-untangle_shot.png'; a.click(); };
$('btnExport').onclick = () => download(new Blob([exportJSON(S)], { type: 'application/json' }), 'ring-untangle-tool-settings.json');
$('btnImport').onclick = () => document.getElementById('importFile').click();
$('importFile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { S = migrate(JSON.parse(t)); saveSettings(S); buildPanel(); loadHand(); newGame(); toast('已导入设置'); }).catch(() => toast('导入失败')); };
$('btnReset').onclick = () => { if (!confirm('恢复全部默认设置？')) return; S = { ...DEFS }; saveSettings(S); buildPanel(); loadHand(); newGame(); };
{ const v = document.getElementById('ver'); if (v) v.textContent = 'v' + APP_VERSION; }
const __h5 = applyPlayableMode({
  applySettings: ps => { Object.assign(S, migrate({ version: 1, settings: { ...S, ...ps } })); },
  autoPlay: () => { try { startAuto(); } catch (e) { } },
  state: () => { try { return G.rings.map(r => r.state[0]).join('') + (G.drag ? 'd' : ''); } catch (e) { return ''; } },
  isEnded: () => { try { return ended(); } catch (e) { return false; } },
  onResize: () => { },
});
if (!__h5) bindEditorDevicePreview(() => S);
window.__game = {
  renderAt: t => { window.__vclock = t; frameTick(t); },
  get G() { return G; }, get S() { return S; }, get L() { return L; }, get view() { return view; }, get hand() { return hand; }, get auto() { return auto; }, get editor() { return editor; },
  autoSolve, startAuto, stopAuto, newGame, pressDesign, solveLevel, levelFromSettings, xfs,
  set(k, v) { S[k] = v; applyChange(k); buildPanel(); }, setMany(o) { Object.assign(S, o); saveSettings(S); buildPanel(); loadHand(); newGame(); },
  openEditor, closeEditor, editorDown, editorMove, editorUp, levelCheck, levelRef, doRandom, get editLevel() { return editor && editor.lv; }, setEditorTool(t) { editor.tool = t; },
  doExportAE, doExport3D, doExportH5, aeStart: () => recStart(), aeStop: () => aeStop(), aeActive: () => aeActive(), startRec, stopRec, get mediaRec() { return rec; }, migrate, APP_ID, APP_VERSION,
};
buildPanel(); loadHand(); newGame(); window.__ready = true; requestAnimationFrame(loop);
