// 字母型解锁：管状字母字形（单位高 1，中心为原点，y 向下）。笔画 = 直线 ['l',x1,y1,x2,y2] / 圆弧 ['a',cx,cy,r,a0,a1]（度，屏幕坐标顺时针）
const l = (a, b, c, d) => ['l', a, b, c, d], a = (cx, cy, r, a0, a1) => ['a', cx, cy, r, a0, a1];
export const GLYPHS = {
  A: [l(-0.32, 0.5, 0, -0.5), l(0, -0.5, 0.32, 0.5), l(-0.19, 0.1, 0.19, 0.1)],
  B: [l(-0.28, -0.5, -0.28, 0.5), l(-0.28, -0.5, 0.02, -0.5), a(0.02, -0.25, 0.25, -90, 90), l(0.02, 0, -0.28, 0), l(-0.28, 0, 0.04, 0), a(0.04, 0.25, 0.25, -90, 90), l(0.04, 0.5, -0.28, 0.5)],
  C: [a(0, 0, 0.42, 40, 320)],
  D: [l(-0.28, -0.5, -0.28, 0.5), l(-0.28, -0.5, -0.05, -0.5), a(-0.05, 0, 0.5, -90, 90), l(-0.05, 0.5, -0.28, 0.5)],
  E: [l(-0.26, -0.5, -0.26, 0.5), l(-0.26, -0.5, 0.26, -0.5), l(-0.26, 0, 0.18, 0), l(-0.26, 0.5, 0.26, 0.5)],
  F: [l(-0.24, -0.5, -0.24, 0.5), l(-0.24, -0.5, 0.26, -0.5), l(-0.24, 0, 0.18, 0)],
  G: [a(0, 0, 0.42, 35, 330), l(0.36, 0.22, 0.36, 0.04), l(0.36, 0.04, 0.08, 0.04)],
  H: [l(-0.3, -0.5, -0.3, 0.5), l(0.3, -0.5, 0.3, 0.5), l(-0.3, 0, 0.3, 0)],
  I: [l(0, -0.5, 0, 0.5)],
  J: [l(0.2, -0.5, 0.2, 0.25), a(-0.05, 0.25, 0.25, 0, 180)],
  K: [l(-0.26, -0.5, -0.26, 0.5), l(0.28, -0.5, -0.26, 0.08), l(-0.08, -0.08, 0.3, 0.5)],
  L: [l(-0.24, -0.5, -0.24, 0.5), l(-0.24, 0.5, 0.28, 0.5)],
  M: [l(-0.36, 0.5, -0.36, -0.5), l(-0.36, -0.5, 0, 0.15), l(0, 0.15, 0.36, -0.5), l(0.36, -0.5, 0.36, 0.5)],
  N: [l(-0.3, 0.5, -0.3, -0.5), l(-0.3, -0.5, 0.3, 0.5), l(0.3, 0.5, 0.3, -0.5)],
  O: [a(0, 0, 0.42, 0, 360)],
  P: [l(-0.26, 0.5, -0.26, -0.5), l(-0.26, -0.5, 0.02, -0.5), a(0.02, -0.24, 0.26, -90, 90), l(0.02, 0.02, -0.26, 0.02)],
  Q: [a(0, 0, 0.42, 0, 360), l(0.12, 0.18, 0.4, 0.5)],
  R: [l(-0.26, 0.5, -0.26, -0.5), l(-0.26, -0.5, 0.02, -0.5), a(0.02, -0.24, 0.26, -90, 90), l(0.02, 0.02, -0.26, 0.02), l(0.0, 0.02, 0.3, 0.5)],
  S: [a(0.0, -0.25, 0.25, 340, 90), a(0.0, 0.25, 0.25, 270, 520)],
  T: [l(-0.32, -0.5, 0.32, -0.5), l(0, -0.5, 0, 0.5)],
  U: [l(-0.28, -0.5, -0.28, 0.22), a(0, 0.22, 0.28, 180, 0), l(0.28, 0.22, 0.28, -0.5)],
  V: [l(-0.32, -0.5, 0, 0.5), l(0, 0.5, 0.32, -0.5)],
  W: [l(-0.4, -0.5, -0.2, 0.5), l(-0.2, 0.5, 0, -0.1), l(0, -0.1, 0.2, 0.5), l(0.2, 0.5, 0.4, -0.5)],
  X: [l(-0.3, -0.5, 0.3, 0.5), l(0.3, -0.5, -0.3, 0.5)],
  Y: [l(-0.3, -0.5, 0, 0), l(0.3, -0.5, 0, 0), l(0, 0, 0, 0.5)],
  Z: [l(-0.28, -0.5, 0.28, -0.5), l(0.28, -0.5, -0.28, 0.5), l(-0.28, 0.5, 0.28, 0.5)],
};
export const LETTERS = Object.keys(GLYPHS);
// 'a' 圆弧在屏幕坐标中：角度 θ 点 = (cx + r cosθ, cy + r sinθ)，从 a0 走到 a1（a1<a0 时逆向）
// 采样成折线（设计像素，h = 字高；C 的开口方向由 gapDeg 旋转）
export function glyphPolys(ch, h, rotDeg = 0) {
  const st = GLYPHS[ch] || GLYPHS.I, out = [], cr = Math.cos(rotDeg * Math.PI / 180), sr = Math.sin(rotDeg * Math.PI / 180);
  const P = (x, y) => [h * (x * cr - y * sr), h * (x * sr + y * cr)];
  for (const s of st) {
    if (s[0] === 'l') out.push([P(s[1], s[2]), P(s[3], s[4])]);
    else { const [, cx, cy, r, a0, a1] = s, n = Math.max(8, Math.round(Math.abs(a1 - a0) / 6)), pts = []; for (let k = 0; k <= n; k++) { const t = (a0 + (a1 - a0) * k / n) * Math.PI / 180; pts.push(P(cx + r * Math.cos(t), cy + r * Math.sin(t))); } out.push(pts); }
  }
  return out;
}
// 点到字形的最近距离与该处切线角（局部坐标）
export function glyphNearest(polys, x, y) {
  let bd = 1e9, ang = 0, px = 0, py = 0;
  for (const p of polys) for (let k = 0; k + 1 < p.length; k++) {
    const [ax, ay] = p[k], [bx, by] = p[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(x - qx, y - qy);
    if (d < bd) { bd = d; ang = Math.atan2(dy, dx); px = qx; py = qy; }
  }
  return { d: bd, ang, x: px, y: py };
}
// 两个字形（各自偏移）之间的最近点对
export function glyphClosest(PA, ax, ay, PB, bx, by) {
  let best = { d: 1e9 };
  for (const p of PA) for (let k = 0; k < p.length; k++) { const n = k + 1 < p.length ? 3 : 1; for (let s = 0; s < n; s++) { const t = s / n, x = ax + (k + 1 < p.length ? p[k][0] + (p[k + 1][0] - p[k][0]) * t : p[k][0]), y = ay + (k + 1 < p.length ? p[k][1] + (p[k + 1][1] - p[k][1]) * t : p[k][1]); const q = glyphNearest(PB, x - bx, y - by); if (q.d < best.d) best = { d: q.d, ax: x, ay: y, bx: bx + q.x, by: by + q.y, ang: q.ang }; } }
  return best;
}
// 线段到字形（偏移）的最近距离
export function segGlyphDist(x1, y1, x2, y2, P, ox, oy) { let d = 1e9; for (let k = 0; k <= 12; k++) { const t = k / 12; d = Math.min(d, glyphNearest(P, x1 + (x2 - x1) * t - ox, y1 + (y2 - y1) * t - oy).d); } return d; }
export function segCross(a, b, c, d) { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; }
// 三条独立轴：字母风格（几何/管径） × 连接件风格 × 材质主题
export const LETTER_STYLES = { ref: { zh: '参考视频（细管）', tube: S => S.letterTube }, thick: { zh: '粗管', tube: S => S.thickTube }, candy: { zh: '糖果软胶（粗管亮色）', tube: S => S.candyTube } };
export const CONN_STYLES = { beadRod: { zh: '珠杆（米色圆珠+深色细杆）', k: S => S.beadR }, collar: { zh: '金属套筒短杆', k: S => S.collarR }, clasp: { zh: '同色方扣细杆', k: S => S.claspR } };
export const LSTYLE = S => LETTER_STYLES[S.letterStyle] ? S.letterStyle : 'ref';
export const CSTYLE = S => CONN_STYLES[S.connStyle] ? S.connStyle : 'beadRod';
export const LTUBE = S => LETTER_STYLES[LSTYLE(S)].tube(S);
export const LCONN = S => LTUBE(S) * CONN_STYLES[CSTYLE(S)].k(S);
