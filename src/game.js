// 解环核玩工具 —— 关卡数据 / 规则 / 动画状态（与渲染无关，确定性）
// 关卡：rings = [{c:颜色键, x, y, gap:缺口朝向(°，屏幕坐标 0=右 90=下)}]，clips = [{o:扣的主人(环索引), g:被扣住的环, x, y}]
// 规则（来自参考视频：被取下的环留下的扣子仍挂在主人环上）：一个环自己身上没有仍扣着别的环的扣子 → 可以从别人的扣子里滑出取下；否则被卡住。
export const COLORS = ['red', 'pink', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'];
export const COLOR_ZH = { red: '红', pink: '粉红', orange: '橙', yellow: '黄', green: '绿', teal: '深绿', blue: '蓝', purple: '紫' };
const K = 4 / 3; // 参考视频 540 宽抽帧坐标 → 720 设计坐标
const P = (x, y) => [Math.round(x * K), Math.round(y * K)];
const RR = (c, x, y, gap) => { const [a, b] = P(x, y); return { c, x: a, y: b, gap }; };
const CC = (o, g, x, y) => { const [a, b] = P(x, y); return { o, g, x: a, y: b }; };
// 从参考视频第 0.5 秒 / 第 7.6 秒逐个量出的 11 个环、12 个扣（扣的颜色 = 主人环的颜色）
// v1.1：环中心 = 参考视频第 6 秒 1080p 原图按颜色分割后最小二乘拟合圆心（设计坐标 720×1280）；左上绿环取第 0.5 秒估计
const D = (c, x, y, gap) => ({ c, x, y, gap });
const REF_RINGS = [
  D('green', 173, 447, -115), D('orange', 532, 460, -90), D('pink', 350, 566, 150), D('yellow', 175, 665, -145), D('teal', 513, 663, 0), D('green', 356, 786, -90),
  D('blue', 196, 901, 0), D('purple', 518, 915, 25), D('red', 171, 1111, 90), D('orange', 354, 1029, 90), D('yellow', 538, 1121, 90),
];
// 扣子：套在被扣住环的管子上（吸附到被扣住环的中心线圆上，取与主人环圆最近的交点）；离主人环远的 = 带短柱的扣子
function snapClip(o, g, x, y, R = 85) {
  const A = REF_RINGS[o], B = REF_RINGS[g], dx = A.x - B.x, dy = A.y - B.y, d = Math.hypot(dx, dy);
  if (d < 2 * R) { const h = Math.sqrt(R * R - d * d / 4), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; const c = [[mx + h * (-dy / d), my + h * (dx / d)], [mx - h * (-dy / d), my - h * (dx / d)]].sort((p, q) => Math.hypot(p[0] - x, p[1] - y) - Math.hypot(q[0] - x, q[1] - y))[0]; if (Math.hypot(c[0] - x, c[1] - y) < 80) return { o, g, x: Math.round(c[0]), y: Math.round(c[1]) }; }
  const stemClip = Math.hypot(x - A.x, y - A.y) > R + 40, a = stemClip ? Math.atan2(y - B.y, x - B.x) : Math.atan2(A.y - B.y, A.x - B.x); return { o, g, x: Math.round(B.x + R * Math.cos(a)), y: Math.round(B.y + R * Math.sin(a)) };
}
export const REF_LEVEL = {
  name: '参考关卡',
  rings: REF_RINGS,
  clips: [
    CC(3, 0, 130, 408), CC(3, 2, 210, 455), CC(4, 2, 318, 455), CC(4, 1, 398, 405),
    CC(3, 5, 212, 555), CC(4, 5, 322, 555), CC(6, 5, 215, 615), CC(7, 5, 318, 628),
    CC(6, 9, 220, 725), CC(7, 9, 315, 733), CC(6, 8, 132, 765), CC(7, 10, 400, 775),
  ].map(c => snapClip(c.o, c.g, c.x, c.y)),
};
export function normalizeLevel(j) {
  const L = { name: j.name || '自定义关卡', rings: [], clips: [], errors: [] };
  (j.rings || []).forEach(r => { if (r && isFinite(r.x) && isFinite(r.y)) L.rings.push({ c: COLORS.includes(r.c) || /^#[0-9a-f]{6}$/i.test(r.c) ? r.c : 'red', x: +r.x, y: +r.y, gap: isFinite(r.gap) ? +r.gap : 90 }); else L.errors.push(r); });
  (j.clips || []).forEach(c => { if (c && L.rings[c.o] && L.rings[c.g] && c.o !== c.g) L.clips.push({ o: c.o | 0, g: c.g | 0, x: isFinite(c.x) ? +c.x : (L.rings[c.o].x + L.rings[c.g].x) / 2, y: isFinite(c.y) ? +c.y : (L.rings[c.o].y + L.rings[c.g].y) / 2 }); else L.errors.push(c); });
  return L;
}
export function levelFromSettings(S) {
  if (S.levelJson && S.levelJson.trim()) { try { const L = normalizeLevel(JSON.parse(S.levelJson)); if (L.rings.length) return L; } catch (e) { console.warn('关卡 JSON 无效，使用参考关卡', e); } }
  return normalizeLevel(REF_LEVEL);
}
// 可解性：反复取下“可取下”的环
export function canFree(L, gone, i, gripLimit = 0) {
  if (gone[i]) return false;
  for (const c of L.clips) if (c.o === i && !gone[c.g]) return false;
  if (gripLimit > 0) { let n = 0; for (const c of L.clips) if (c.g === i && !gone[c.o]) n++; if (n > gripLimit) return false; }
  return true;
}
export function solveLevel(L, gripLimit = 0, gone0 = null) {
  const gone = gone0 ? gone0.slice() : L.rings.map(() => false), order = [];
  for (let k = 0; k < L.rings.length; k++) { let f = -1; for (let i = 0; i < L.rings.length; i++) if (canFree(L, gone, i, gripLimit)) { f = i; break; } if (f < 0) break; gone[f] = true; order.push(f); }
  const stuck = L.rings.map((_, i) => i).filter(i => !gone[i]);
  return { solvable: stuck.length === 0, order, stuck };
}
// 两圆交点（扣子位置）
export function circleX(a, b, R, side = 1) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 1e-6 || d >= 2 * R) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const h = Math.sqrt(R * R - d * d / 4), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return { x: mx + side * h * (-dy / d), y: my + side * h * (dx / d) };
}
// 🎲 随机关卡：网格错位排布 + 随机“取下顺序”保证可解（扣的主人 = 顺序靠后的环）
export function randomLevel(S, rnd = Math.random) {
  const cols = S.randCols | 0 || 3, rows = S.randRows | 0 || 4, R = S.ringR, sp = R * 1.55;
  const rings = [], W = (cols - 1) * sp, H = (rows - 1) * sp * 0.92;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (rnd() < 0.12 && rings.length > 2) continue;
    rings.push({ c: COLORS[Math.floor(rnd() * COLORS.length)], x: Math.round(360 - W / 2 + c * sp + (r % 2 ? sp * 0.18 : -sp * 0.18) * (cols > 2 ? 1 : 0)), y: Math.round(780 - H / 2 + r * sp * 0.92), gap: [0, 90, 180, -90, 45, 135, -45, -135][Math.floor(rnd() * 8)] });
  }
  const order = rings.map((_, i) => i).sort(() => rnd() - 0.5), rank = []; order.forEach((i, k) => rank[i] = k);
  const clips = [];
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) {
    const d = Math.hypot(rings[i].x - rings[j].x, rings[i].y - rings[j].y); if (d > sp * 1.25 || d < 1) continue;
    if (rnd() < 0.25) continue;
    const o = rank[i] > rank[j] ? i : j, g = o === i ? j : i, p = circleX(rings[o], rings[g], R, rnd() < 0.5 ? 1 : -1);
    clips.push({ o, g, x: Math.round(p.x), y: Math.round(p.y) });
  }
  // 缺口避开扣子
  rings.forEach((r, i) => { const angs = clips.filter(c => c.o === i || c.g === i).map(c => Math.atan2(c.y - r.y, c.x - r.x) * 180 / Math.PI); let best = r.gap, bd = -1; for (let a = -180; a < 180; a += 15) { const m = Math.min(999, ...angs.map(b => Math.abs(((a - b + 540) % 360) - 180))); if (m > bd + 1e-6) { bd = m; best = a; } } r.gap = best; });
  return normalizeLevel({ name: '随机关卡', rings, clips });
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rad = d => d * Math.PI / 180;
export class Game {
  constructor(L, S) {
    this.L = L; this.S = S; this.t = 0; this.events = []; this.winT = null; this.drag = null;
    this.rings = L.rings.map((r, i) => ({ i, state: 'idle', rot: 0, px: r.x, py: r.y, fly: null, shake: null, flash: 0 }));
    this.clipFlash = L.clips.map(() => -9);
  }
  gone() { return this.rings.map(r => r.state === 'gone' || r.state === 'fly'); }
  isFree(i) { return canFree(this.L, this.gone(), i, this.S.gripLimit); }
  freeIds() { return this.rings.filter(r => r.state === 'idle' && this.isFree(r.i)).map(r => r.i); }
  idleIds() { return this.rings.filter(r => r.state === 'idle').map(r => r.i); }
  left() { return this.rings.filter(r => r.state !== 'gone' && r.state !== 'fly').length; }
  blockers(i) { const g = this.gone(); return this.L.clips.map((c, k) => (c.o === i && !g[c.g]) ? k : -1).filter(k => k >= 0); }
  grips(i) { const g = this.gone(); return this.L.clips.filter(c => c.g === i && !g[c.o]); }
  // 环 i 当前的屏幕变换（中心 / 旋转° / 缩放 / 不透明度）
  xf(i) {
    const r = this.rings[i], b = this.L.rings[i];
    let rot = r.rot, cx = b.x, cy = b.y, sc = 1, op = 1;
    if (r.shake) { const u = (this.t - r.shake.t0) / r.shake.dur; if (u < 1) rot += this.S.shakeDeg * Math.sin(u * Math.PI * 5) * (1 - u); }
    const a = rad(rot), dx = b.x - r.px, dy = b.y - r.py; cx = r.px + dx * Math.cos(a) - dy * Math.sin(a); cy = r.py + dx * Math.sin(a) + dy * Math.cos(a);
    if (r.fly) { const S = this.S, u = clamp((this.t - r.fly.t0) / r.fly.dur, 0, 1), e = 1 - Math.pow(1 - u, 2.2); cx += r.fly.dx * S.flyDist * e; cy += r.fly.dy * S.flyDist * e - S.flyLift * e; rot += r.fly.spin * e; sc = 1 + (S.flyScale - 1) * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2); op = 1 - clamp(u / 0.9, 0, 1); }
    if (r.state === 'gone') op = 0;
    return { x: cx, y: cy, rot, sc, op };
  }
  hitTest(x, y, R, tube, pad) {
    let best = -1, bd = 1e9;
    for (const r of this.rings) { if (r.state !== 'idle') continue; const f = this.xf(r.i), d = Math.hypot(x - f.x, y - f.y), e = Math.abs(d - R); if (e < tube + pad && e < bd) { bd = e; best = r.i; } }
    if (best < 0) for (const r of this.rings) { if (r.state !== 'idle') continue; const f = this.xf(r.i), d = Math.hypot(x - f.x, y - f.y); if (d < R && d < bd) { bd = d; best = r.i; } }
    return best;
  }
  press(i, x, y) {
    const r = this.rings[i]; if (!r || r.state !== 'idle') return null;
    const free = this.isFree(i), gr = this.grips(i);
    if (free && gr.length) { r.px = gr.reduce((s, c) => s + c.x, 0) / gr.length; r.py = gr.reduce((s, c) => s + c.y, 0) / gr.length; } else { r.px = this.L.rings[i].x; r.py = this.L.rings[i].y; }
    r.shake = null; this.drag = { i, free, a0: Math.atan2(y - r.py, x - r.px), x0: x, y0: y, moved: 0 };
    this.events.push({ type: 'grab', i }); return this.drag;
  }
  move(x, y) {
    const D = this.drag; if (!D) return; const r = this.rings[D.i];
    D.moved = Math.max(D.moved, Math.hypot(x - D.x0, y - D.y0));
    let da = Math.atan2(y - r.py, x - r.px) - D.a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const mx = D.free ? this.S.dragMaxDeg : this.S.blockMaxDeg; r.rot = clamp(da * 180 / Math.PI * this.S.dragFollow, -mx, mx);
  }
  release() {
    const D = this.drag; if (!D) return null; this.drag = null; const r = this.rings[D.i];
    if (D.free && this.isFree(D.i)) {
      const b = this.L.rings[D.i], f = this.xf(D.i); let dx = f.x - r.px, dy = f.y - r.py;
      { const c = this.centroid(); dx = b.x - c[0]; dy = b.y - c[1]; } // 参考：沿远离画面中心方向弹出
      const n = Math.hypot(dx, dy) || 1, sgn = r.rot >= 0 ? 1 : -1;
      r.state = 'fly'; r.fly = { t0: this.t, dur: this.S.flyDur / 1000, dx: dx / n, dy: dy / n, spin: this.S.flySpin * sgn };
      this.events.push({ type: 'pop', i: D.i }); return { ok: true, i: D.i };
    }
    r.rot = 0; r.shake = { t0: this.t, dur: this.S.shakeDur / 1000 };
    if (this.S.blockFlash) for (const k of this.blockers(D.i)) this.clipFlash[k] = this.t;
    this.events.push({ type: 'block', i: D.i }); return { ok: false, i: D.i };
  }
  centroid() { const a = this.L.rings; return [a.reduce((s, r) => s + r.x, 0) / a.length, a.reduce((s, r) => s + r.y, 0) / a.length]; }
  update(dt) {
    this.t += dt;
    for (const r of this.rings) {
      if (r.state === 'fly' && this.t - r.fly.t0 >= r.fly.dur) r.state = 'gone';
      if (r.shake && this.t - r.shake.t0 >= r.shake.dur) r.shake = null;
      if (!this.drag || this.drag.i !== r.i) { if (r.state === 'idle' && !r.shake && r.rot) r.rot *= Math.exp(-dt * 14); }
    }
    if (this.winT == null && this.rings.every(r => r.state === 'gone')) { this.winT = this.t; this.events.push({ type: 'win' }); }
  }
}
