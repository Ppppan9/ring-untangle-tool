import { glyphPolys, glyphNearest, LETTERS } from './glyphs.js';
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
// 字母型解锁参考关卡（letters_ref.mp4 第 5 关 LUNCH，38.5 s 截帧量取；参考 592 宽 → 设计 720 宽 x+64）
// 扣子 = 米色珠套在被扣字母 g 的笔画上（x,y），黑色细杆连到主人字母 o 的笔画（rx,ry）
export const LETTER_LEVEL = {
  name: '字母参考关卡 LUNCH', theme: 'letters', word: 'LUNCH',
  rings: [
    { c: 'yellow', ch: 'C', x: 224, y: 605, rot: 180, h: 140 }, { c: 'pink', ch: 'H', x: 424, y: 572, rot: 0, h: 142 },
    { c: 'teal', ch: 'U', x: 259, y: 838, rot: 0, h: 140 }, { c: 'orange', ch: 'L', x: 404, y: 828, rot: 0, h: 136 }, { c: 'purple', ch: 'N', x: 514, y: 840, rot: 0, h: 136 },
  ],
  clips: [{ o: 1, g: 0, x: 284, y: 604, rx: 382, ry: 604 }, { o: 2, g: 0, x: 222, y: 664, rx: 222, ry: 770 }, { o: 3, g: 2, x: 292, y: 826, rx: 371, ry: 826 }, { o: 3, g: 4, x: 474, y: 860, rx: 371, ry: 860 }],
};
// 扣子吸附：珠吸到被扣字母笔画上，杆端吸到主人字母笔画上（避免"没接上"的悬空杆）
export function snapLetterClips(L) {
  for (const c of L.clips) { const o = L.rings[c.o], g = L.rings[c.g]; if (!o || !g || !o.ch || !g.ch) continue;
    const qg = glyphNearest(glyphPolys(g.ch, g.h || 140, g.rot || 0), c.x - g.x, c.y - g.y); c.x = Math.round(g.x + qg.x); c.y = Math.round(g.y + qg.y);
    const tx = c.rx ?? c.x, ty = c.ry ?? c.y, qo = glyphNearest(glyphPolys(o.ch, o.h || 140, o.rot || 0), tx - o.x, ty - o.y); c.rx = Math.round(o.x + qo.x); c.ry = Math.round(o.y + qo.y); }
  return L;
}
// 解密单词 → 参考风格互锁布局：字母排成 1–2 行，相邻字母用 珠+杆 连接（随机生成树 + 额外边），
// 方向随机；要求可解、开局被卡住的字母 ≥ 一半、含 C/G 时 C 必须被扣住（需要转动脱扣），否则换种子重试
export function wordLevel(word, seed = 1, S = {}) {
  const w = (String(word || 'CAKE').toUpperCase().replace(/[^A-Z]/g, '') || 'CAKE').slice(0, 8), n = w.length, H = 140;
  const cols = n <= 4 ? n : Math.ceil(n / 2), rows = n <= 4 ? 1 : 2, sx = n <= 4 ? 150 : 150, sy = 210;
  const pal = ['yellow', 'pink', 'teal', 'orange', 'purple', 'blue', 'green', 'red'];
  for (let tr = 0; tr < 400; tr++) {
    let r = (seed * 7919 + tr * 104729) % 2147483647 || 1; const rnd = () => (r = r * 16807 % 2147483647) / 2147483647;
    const rings = [...w].map((ch, i) => { const row = rows === 1 ? 0 : (i < cols ? 0 : 1), col = rows === 1 ? i : (i < cols ? i : i - cols), nc = row === 0 ? cols : n - cols;
      return { c: pal[(i + seed) % pal.length], ch, x: Math.round(360 - (nc - 1) * sx / 2 + col * sx + (rnd() - 0.5) * 20 + (row ? (rnd() - 0.5) * 40 : 0)), y: Math.round(640 + (row - (rows - 1) / 2) * sy + (rnd() - 0.5) * 30), rot: ch === 'C' || ch === 'G' ? 0 : 0, h: H }; });
    // 候选边：距离近的字母对
    const E = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const d = Math.hypot(rings[a].x - rings[b].x, rings[a].y - rings[b].y); if (d < 260) E.push([a, b, d + rnd() * 80]); }
    E.sort((p, q) => p[2] - q[2]); const par = [...Array(n).keys()], f = x => par[x] === x ? x : (par[x] = f(par[x])), pick = [];
    for (const e of E) { if (f(e[0]) !== f(e[1])) { par[f(e[0])] = f(e[1]); pick.push(e); } else if (rnd() < 0.25 && pick.length < n + 1) pick.push(e); }
    if (pick.length < n - 1) continue;
    const clips = pick.map(([a, b]) => { const [o, g] = rnd() < 0.5 ? [a, b] : [b, a], A = rings[o], B = rings[g], mx = (A.x + B.x) / 2 + (rnd() - 0.5) * 30, my = (A.y + B.y) / 2 + (rnd() - 0.5) * 40; return { o, g, x: mx, y: my, rx: mx, ry: my }; });
    // C 必须被扣住；C 的缺口朝向背离所有珠
    for (let i = 0; i < n; i++) if (rings[i].ch === 'C') { const cl = clips.filter(c => c.g === i), oc = clips.filter(c => c.o === i); oc.forEach(c => { const t = c.o; c.o = c.g; c.g = t; }); }
    const L = snapLetterClips({ name: '解密单词 ' + w, theme: 'letters', word: w, rings, clips });
    for (let i = 0; i < n; i++) if (rings[i].ch === 'C') { const cl = clips.filter(c => c.g === i); if (cl.length) { const ax = cl.reduce((s2, c) => s2 + c.x - rings[i].x, 0), ay = cl.reduce((s2, c) => s2 + c.y - rings[i].y, 0); rings[i].rot = Math.round((Math.atan2(ay, ax) * 180 / Math.PI + 180 + (rnd() - 0.5) * 60 + 360) % 360); snapLetterClips(L); } }
    const NL = normalizeLevel(L), sv = solveLevel(NL), gone = NL.rings.map(() => false), blocked = NL.rings.filter((_, i) => !canFree(NL, gone, i)).length;
    const hasC = rings.some(q => q.ch === 'C'), cOk = !hasC || rings.every((q, i) => q.ch !== 'C' || clips.some(c => c.g === i));
    if (sv.solvable && blocked >= Math.floor(n / 2) && cOk) return NL;
  }
  return normalizeLevel(LETTER_LEVEL);
}
// CAKE 参考关（letters_ref.mp4 12–23 s Level 3；参考 x+64）：C 居中缺口朝左，A 上、K 右、E 下
export const CAKE_LEVEL = {
  name: '字母参考关卡 CAKE', theme: 'letters', word: 'CAKE',
  rings: [{ c: 'orange', ch: 'C', x: 294, y: 682, rot: 180, h: 140 }, { c: 'teal', ch: 'A', x: 364, y: 520, rot: 0, h: 145 }, { c: 'purple', ch: 'K', x: 454, y: 712, rot: 0, h: 140 }, { c: 'yellow', ch: 'E', x: 300, y: 905, rot: 0, h: 140 }],
  clips: [{ o: 1, g: 0, x: 314, y: 620, rx: 322, ry: 585 }, { o: 2, g: 0, x: 354, y: 685, rx: 418, ry: 685 }, { o: 0, g: 3, x: 270, y: 840, rx: 294, ry: 742 }],
};
export const WORD_REFS = { LUNCH: LETTER_LEVEL, CAKE: CAKE_LEVEL };
export const isLetters = L => !!(L && L.theme === 'letters');
export function normalizeLevel(j) {
  const L = { name: j.name || '自定义关卡', rings: [], clips: [], errors: [], theme: j.theme === 'letters' ? 'letters' : 'rings', word: j.word || '' };
  (j.rings || []).forEach(r => { if (r && isFinite(r.x) && isFinite(r.y)) L.rings.push({ c: COLORS.includes(r.c) || /^#[0-9a-f]{6}$/i.test(r.c) ? r.c : 'red', x: +r.x, y: +r.y, gap: isFinite(r.gap) ? +r.gap : 90, ...(r.ch ? { ch: String(r.ch).toUpperCase().slice(0, 1), rot: +r.rot || 0, h: +r.h || 140 } : {}) }); else L.errors.push(r); });
  (j.clips || []).forEach(c => { if (c && L.rings[c.o] && L.rings[c.g] && c.o !== c.g) L.clips.push({ o: c.o | 0, g: c.g | 0, x: isFinite(c.x) ? +c.x : (L.rings[c.o].x + L.rings[c.g].x) / 2, y: isFinite(c.y) ? +c.y : (L.rings[c.o].y + L.rings[c.g].y) / 2, ...(isFinite(c.rx) ? { rx: +c.rx, ry: +c.ry } : {}) }); else L.errors.push(c); });
  return L;
}
export const levelKey = S => S.theme === 'letters' ? 'levelJsonL' : 'levelJson';
export function levelFromSettings(S) {
  const j = S[levelKey(S)], lt = S.theme === 'letters';
  if (j && j.trim()) { try { const L = normalizeLevel({ ...JSON.parse(j), ...(lt ? { theme: 'letters' } : {}) }); if (L.rings.length) return L; } catch (e) { console.warn('关卡 JSON 无效，使用参考关卡', e); } }
  if (lt) { const w = (S.word || 'CAKE').toUpperCase(); return WORD_REFS[w] && !S.wordSeed ? normalizeLevel(snapLetterClips(JSON.parse(JSON.stringify(WORD_REFS[w])))) : wordLevel(w, (S.wordSeed | 0) + 1, S); }
  return normalizeLevel(REF_LEVEL);
}
// 可解性：反复取下“可取下”的环
export function canFree(L, gone, i, gripLimit = 0) {
  if (gone[i]) return false;
  for (const c of L.clips) if (c.o === i && !gone[c.g] && !c.rel) return false;
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
  blockers(i) { const g = this.gone(); return this.L.clips.map((c, k) => (c.o === i && !g[c.g] && !c.rel) ? k : -1).filter(k => k >= 0); }
  grips(i) { const g = this.gone(); return this.L.clips.filter(c => c.g === i && !g[c.o] && !c.rel); }
  get lt() { return isLetters(this.L); }
  polys(i) { const b = this.L.rings[i]; return glyphPolys(b.ch, b.h || 140, (b.rot || 0) + this.rings[i].rot); }
  // 字母主题：飞入顶部单词槽的位置
  slotOf(i) { const w = (this.L.word || '').toUpperCase(), used = this.rings.filter(r => r.slot != null).map(r => r.slot); let k = -1; for (let j = 0; j < w.length; j++) if (w[j] === this.L.rings[i].ch && !used.includes(j)) { k = j; break; } if (k < 0) k = used.length; return k; }
  slotXY(k) { const S = this.S, n = Math.max(1, (this.L.word || '').length), w = S.slotW, gp = S.slotGap, x0 = 360 - (n * w + (n - 1) * gp) / 2; return [x0 + k * (w + gp) + w / 2, S.slotY + S.slotH / 2]; }
  // 环 i 当前的屏幕变换（中心 / 旋转° / 缩放 / 不透明度）
  xf(i) {
    const r = this.rings[i], b = this.L.rings[i];
    let rot = r.rot, cx = b.x, cy = b.y, sc = 1, op = 1;
    if (r.shake) { const u = (this.t - r.shake.t0) / r.shake.dur; if (u < 1) rot += this.S.shakeDeg * Math.sin(u * Math.PI * 5) * (1 - u); }
    const a = rad(rot), dx = b.x - r.px, dy = b.y - r.py; cx = r.px + dx * Math.cos(a) - dy * Math.sin(a); cy = r.py + dx * Math.sin(a) + dy * Math.cos(a);
    if (r.fly && r.fly.slot == null) { const S = this.S, u = clamp((this.t - r.fly.t0 - (S.flyDelay || 0) / 1000) / r.fly.dur, 0, 1), e = 1 - Math.pow(1 - u, 2.2); cx += r.fly.dx * S.flyDist * e; cy += r.fly.dy * S.flyDist * e - S.flyLift * e; rot += r.fly.spin * e; sc = 1 + (S.flyScale - 1) * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2); op = 1 - clamp(u / 0.9, 0, 1); }
    if (r.fly && r.fly.slot != null) { const S = this.S, u = clamp((this.t - r.fly.t0 - (S.flyDelay || 0) / 1000) / r.fly.dur, 0, 1), e = u * u * (3 - 2 * u), [sx, sy] = this.slotXY(r.fly.slot), b0 = this.L.rings[i];
      const lift = Math.sin(u * Math.PI) * S.letterArc; cx = b0.x + (sx - b0.x) * e; cy = b0.y + (sy - b0.y) * e - lift; sc = 1 + (S.slotScale - 1) * e; rot = r.rot * (1 - e); op = 1; }
    if (r.state === 'gone') op = 0;
    return { x: cx, y: cy, rot, sc, op };
  }
  hitTest(x, y, R, tube, pad) {
    let best = -1, bd = 1e9;
    if (this.lt) { for (const r of this.rings) { if (r.state !== 'idle') continue; const b = this.L.rings[r.i], q = glyphNearest(this.polys(r.i), x - b.x, y - b.y); if (q.d < this.S.letterTube + pad + 10 && q.d < bd) { bd = q.d; best = r.i; } } return best; }
    for (const r of this.rings) { if (r.state !== 'idle') continue; const f = this.xf(r.i), d = Math.hypot(x - f.x, y - f.y), e = Math.abs(d - R); if (e < tube + pad && e < bd) { bd = e; best = r.i; } }
    if (best < 0) for (const r of this.rings) { if (r.state !== 'idle') continue; const f = this.xf(r.i), d = Math.hypot(x - f.x, y - f.y); if (d < R && d < bd) { bd = d; best = r.i; } }
    return best;
  }
  press(i, x, y) {
    const r = this.rings[i]; if (!r || r.state !== 'idle') return null;
    const free = this.isFree(i), gr = this.grips(i);
    if (this.lt) { r.px = this.L.rings[i].x; r.py = this.L.rings[i].y; } else if (free && gr.length) { r.px = gr.reduce((s, c) => s + c.x, 0) / gr.length; r.py = gr.reduce((s, c) => s + c.y, 0) / gr.length; } else { r.px = this.L.rings[i].x; r.py = this.L.rings[i].y; }
    r.shake = null; this.drag = { i, free, a0: Math.atan2(y - r.py, x - r.px), x0: x, y0: y, moved: 0, base: r.rot, cum: 0, last: Math.atan2(y - r.py, x - r.px), rel: 0 };
    this.events.push({ type: 'grab', i }); return this.drag;
  }
  move(x, y) {
    const D = this.drag; if (!D) return; const r = this.rings[D.i];
    D.moved = Math.max(D.moved, Math.hypot(x - D.x0, y - D.y0));
    let da = Math.atan2(y - r.py, x - r.px) - D.a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    if (this.lt) { // 字母：可连续旋转（C 转到缺口对准米珠即可脱扣）；其他字母只做小幅晃动
      const an = Math.atan2(y - r.py, x - r.px); let d = an - D.last; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; D.last = an; D.cum += d;
      const b = this.L.rings[D.i], spin = b.ch === 'C' || b.ch === 'O'; const mx = spin ? 1e9 : (D.free ? this.S.dragMaxDeg : this.S.blockMaxDeg);
      r.rot = D.base + clamp(D.cum * 180 / Math.PI * (spin ? 1 : this.S.dragFollow), -mx, mx);
      if (b.ch === 'C') this.L.clips.forEach((c, k) => { if (c.g !== D.i || c.rel || this.gone()[c.o]) return; const phi = Math.atan2(c.y - b.y, c.x - b.x) * 180 / Math.PI, gd = (b.rot || 0) + r.rot; let df = ((phi - gd) % 360 + 540) % 360 - 180; if (Math.abs(df) < this.S.releaseDeg) { c.rel = true; D.rel++; this.events.push({ type: 'release', k }); } });
      return;
    }
    const mx = D.free ? this.S.dragMaxDeg : this.S.blockMaxDeg; r.rot = clamp(da * 180 / Math.PI * this.S.dragFollow, -mx, mx);
  }
  release() {
    const D = this.drag; if (!D) return null; this.drag = null; const r = this.rings[D.i];
    if (this.lt && D.rel) return { ok: true, i: D.i, rel: true }; // 本次旋转只脱开了扣子：停在当前角度
    if (this.lt && this.L.rings[D.i].ch === 'C' && this.isFree(D.i) && this.grips(D.i).length) return { ok: true, i: D.i, rel: false };
    if (this.lt && this.isFree(D.i)) { r.slot = this.slotOf(D.i); r.state = 'fly'; r.fly = { t0: this.t, dur: this.S.letterFlyDur / 1000, slot: r.slot }; this.events.push({ type: 'pop', i: D.i }); return { ok: true, i: D.i }; }
    if (D.free && this.isFree(D.i)) {
      const b = this.L.rings[D.i], f = this.xf(D.i); let dx = f.x - r.px, dy = f.y - r.py;
      { const c = this.centroid(); dx = b.x - c[0]; dy = b.y - c[1]; } // 参考：沿远离画面中心方向弹出
      const n = Math.hypot(dx, dy) || 1, sgn = r.rot >= 0 ? 1 : -1;
      r.state = 'fly'; r.fly = { t0: this.t, dur: this.S.flyDur / 1000, dx: dx / n, dy: dy / n, spin: this.S.flySpin * sgn };
      this.events.push({ type: 'pop', i: D.i }); return { ok: true, i: D.i };
    }
    r.rot = this.lt ? D.base : 0; r.shake = { t0: this.t, dur: this.S.shakeDur / 1000 };
    if (this.S.blockFlash) for (const k of this.blockers(D.i)) this.clipFlash[k] = this.t;
    this.events.push({ type: 'block', i: D.i }); return { ok: false, i: D.i };
  }
  centroid() { const a = this.L.rings; return [a.reduce((s, r) => s + r.x, 0) / a.length, a.reduce((s, r) => s + r.y, 0) / a.length]; }
  update(dt) {
    this.t += dt;
    for (const r of this.rings) {
      if (r.state === 'fly' && this.t - r.fly.t0 >= r.fly.dur + (this.S.flyDelay || 0) / 1000) { r.state = 'gone'; if (r.slot != null) this.events.push({ type: 'slot', i: r.i, k: r.slot }); }
      if (r.shake && this.t - r.shake.t0 >= r.shake.dur) r.shake = null;
      if (!this.drag || this.drag.i !== r.i) { if (r.state === 'idle' && !r.shake && r.rot && !this.lt) r.rot *= Math.exp(-dt * 14); }
    }
    if (this.winT == null && this.rings.every(r => r.state === 'gone')) { this.winT = this.t; this.events.push({ type: 'win' }); }
  }
}
