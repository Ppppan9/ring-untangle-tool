// 解环核玩工具 —— three.js 3D 渲染（v1.1 材质/建模复刻）
// 环 = 沿 C 形曲线的圆截面管（TubeGeometry，带半球圆头），在没有扣子的交叉处按上下层做真实 z 起伏（互相穿插）；
// 扣子 = 圆角套管（LatheGeometry，圆角矩形截面绕轴旋转），套在“被扣住”的环管上，颜色 = 主人环颜色；离主人环较远的扣子用短柱连到主人环。
// 材质 = MeshPhysicalMaterial（哑光塑料 + 轻清漆 + 绒光），RoomEnvironment PMREM 环境光 + 柔和主光，ACES / AgX 色调映射。
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glyphPolys, glyphNearest, LTUBE } from './glyphs.js';
// 材质主题轴（与模型风格独立）：目前只有当前光泽金属漆；以后新增材质在此表里加一项（覆盖 mkMat 参数）
export const MATERIAL_THEMES = { gloss: { zh: '光泽金属漆', ring: {}, conn: {} },
  candy: { zh: '糖果软胶', ring: { metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0, iridescence: 0, specularIntensity: 0.55, envMapIntensity: 0.5 }, conn: {} } };
export const matTheme = S => MATERIAL_THEMES[S.materialTheme] ? S.materialTheme : (S.letterStyle === 'candy' ? 'candy' : 'gloss');
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
const rad = d => d * Math.PI / 180;
export function colorOf(S, c) { return /^#/.test(c) ? c : (S.theme === 'letters' && S.letterStyle === 'candy' && S['candy_' + c]) || S['col_' + c] || '#888888'; }
export function clipColor(S, c) { const col = new THREE.Color(colorOf(S, c)), hsl = {}; if (c === 'yellow' || c === 'orange') col.lerp(new THREE.Color(S.col_gold || '#b8903a'), S.clipGold); col.getHSL(hsl); const k = S.clipTint; col.setHSL((hsl.h + (c === 'green' || c === 'teal' ? 0.05 * k * 3 : 0)) % 1, Math.min(1, hsl.s * (1 - k * 0.3)), Math.min(0.85, hsl.l + k * 0.35)); return col; }
const TONE = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping || THREE.ACESFilmicToneMapping, none: THREE.NoToneMapping, neutral: THREE.LinearToneMapping };
// 每个环上的交叉点：与别的环相交、且附近没有扣子 → 上/下层起伏
function crossings(L, R, clipR) {
  const out = L.rings.map(() => []);
  for (let i = 0; i < L.rings.length; i++) for (let j = i + 1; j < L.rings.length; j++) {
    const a = L.rings[i], b = L.rings[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= 2 * R || d < 1) continue;
    const h = Math.sqrt(R * R - d * d / 4), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    for (const s of [1, -1]) {
      const px = mx + s * h * (-dy / d), py = my + s * h * (dx / d);
      if (L.clips.some(c => Math.hypot(c.x - px, c.y - py) < clipR * 2.2)) continue;
      const over = ((i + j + (s > 0 ? 1 : 0)) % 2) ? i : j; // 交替上下
      out[i].push({ ang: Math.atan2(-(py - a.y), px - a.x), dir: over === i ? 1 : -1 });
      out[j].push({ ang: Math.atan2(-(py - b.y), px - b.x), dir: over === j ? 1 : -1 });
    }
  }
  return out;
}
class CCurve extends THREE.Curve {
  constructor(R, a0, arc, bumps, depth, width) { super(); Object.assign(this, { R, a0, arc, bumps, depth, width }); }
  zAt(a) { let z = 0; for (const b of this.bumps) { let d = a - b.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); z += b.dir * this.depth * Math.exp(-(d * d) / (2 * this.width * this.width)); } return z; }
  getPoint(t, v = new THREE.Vector3()) { const a = this.a0 + this.arc * t; return v.set(this.R * Math.cos(a), this.R * Math.sin(a), this.zAt(a)); }
}
function sleeveGeom(r, hl, bev, seg) { // 圆角矩形截面（半径 r，半长 hl，倒角 bev）绕 Y 轴旋转，中空
  const pts = [], ri = r * 0.55, n = 6;
  pts.push(new THREE.Vector2(ri, -hl));
  for (let k = 0; k <= n; k++) { const a = -Math.PI / 2 + k / n * Math.PI / 2; pts.push(new THREE.Vector2(r - bev + bev * Math.cos(a), -hl + bev + bev * Math.sin(a))); }
  for (let k = 0; k <= n; k++) { const a = k / n * Math.PI / 2; pts.push(new THREE.Vector2(r - bev + bev * Math.cos(a), hl - bev + bev * Math.sin(a))); }
  pts.push(new THREE.Vector2(ri, hl));
  return new THREE.LatheGeometry(pts, seg);
}
export class Scene3D {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.root = new THREE.Group(); this.scene.add(this.root);
    this.pm = new THREE.PMREMGenerator(this.renderer); this.envKey = '';
    this.amb = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1); this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = true; this.scene.add(this.sun); this.scene.add(this.sun.target);
    const sc = this.sun.shadow.camera; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 1; sc.far = 4000; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 1.5;
    this.fill = new THREE.DirectionalLight(0xffffff, 0.5); this.scene.add(this.fill);
    this.cam = new THREE.OrthographicCamera(0, 720, 0, -1280, -3000, 3000); this.cam.position.z = 1500;
    this.groups = []; this.key = '';
  }
  build(L, S) {
    const key = JSON.stringify([L.rings, L.clips, L.theme, ['whiteModel', 'whiteColor', 'letterTube', 'letterStyle', 'connStyle', 'candyTube', 'candyRough', 'candyGlow', 'claspR', 'claspLen', 'claspRodR', 'candy_teal', 'candy_orange', 'candy_purple', 'candy_yellow', 'candy_red', 'candy_pink', 'candy_green', 'candy_blue', 'thickTube', 'collarR', 'collarLen', 'collarRodR', 'collarColor', 'collarRough', 'materialTheme', 'beadColor', 'beadTube', 'beadRough', 'rodColor', 'rodR', 'beadR', 'beadLen', 'hl_pink', 'hl_red', 'hl_orange', 'hl_yellow', 'hl_green', 'hl_teal', 'hl_blue', 'hl_purple', 'ringR', 'tubeR', 'gapDeg', 'clipSize', 'roughness', 'clearcoat', 'clearcoatRough', 'sheen', 'envInt', 'clipTint', 'sleeveR', 'sleeveLen', 'sleeveBevel', 'clipRough', 'clipMetal', 'clipClearcoat', 'clipClearcoatRough', 'clipEnvInt', 'metalness', 'specInt', 'specTint', 'iridescence', 'stemMin', 'clipGold', 'crossDepth', 'crossWidth', 'meshQuality', 'sss'].map(k => S[k]), ['red', 'pink', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'].map(k => S['col_' + k])]);
    if (key === this.key) return; this.key = key;
    for (const g of this.groups) { this.root.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    this.groups = []; this.clipMeshes = [];
    const R = S.ringR, r = S.tubeR, gap = rad(S.gapDeg), arc = Math.PI * 2 - gap, q = S.meshQuality || 1;
    const sr = r * S.sleeveR, sl = r * S.sleeveLen, sleeve = sleeveGeom(sr, sl / 2, Math.min(sr, sl / 2) * S.sleeveBevel, Math.round(40 * q)), cap = new THREE.SphereGeometry(r, Math.round(40 * q), Math.round(24 * q)), stem = new THREE.CylinderGeometry(r * 0.92, r * 0.92, 1, Math.round(24 * q));
    const cross = crossings(L, R, sr);
    const W = S.whiteModel, wc = S.whiteColor || '#eeeeee';
    const mkMat = (col, clip = false, hk = 1) => (W && (col = wc), new THREE.MeshPhysicalMaterial({ color: col, roughness: clip ? S.clipRough : S.roughness, metalness: clip ? S.clipMetal : S.metalness, clearcoat: clip ? S.clipClearcoat : S.clearcoat, clearcoatRoughness: clip ? S.clipClearcoatRough : S.clearcoatRough,
      sheen: S.sheen, sheenRoughness: 0.7, sheenColor: new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.55), specularIntensity: S.specInt * hk, specularColor: new THREE.Color('#ffffff').lerp(new THREE.Color(col), S.specTint),
      iridescence: S.iridescence, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500], envMapIntensity: clip ? S.clipEnvInt : S.envInt * (0.5 + 0.5 * hk), emissive: new THREE.Color(col), emissiveIntensity: S.sss }));
    if (L.theme === 'letters') return this.buildLetters(L, S, mkMat, q, W, wc);
    L.rings.forEach((b, i) => {
      const g = new THREE.Group(); g.userData.i = i;
      const mat = mkMat(colorOf(S, b.c), false, S['hl_' + b.c] ?? 1); const a0 = -rad(b.gap) + gap / 2;
      const curve = new CCurve(R, a0, arc, cross[i], r * S.crossDepth, S.crossWidth);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.round(200 * q), r, Math.round(40 * q), false), mat); m.castShadow = m.receiveShadow = true; g.add(m);
      for (const t of [0, 1]) { const c = new THREE.Mesh(cap, mat); c.position.copy(curve.getPoint(t)); c.castShadow = c.receiveShadow = true; g.add(c); }
      g.userData.mats = [mat];
      L.clips.forEach((c, k) => {
        if (c.o !== i) return;
        const cm = mkMat(clipColor(S, b.c), true); cm.emissive = new THREE.Color(W ? wc : colorOf(S, b.c)); g.userData.mats.push(cm); this.clipMeshes[k] = cm;
        const lx = c.x - b.x, ly = -(c.y - b.y), d = Math.hypot(lx, ly), phi = Math.atan2(ly, lx);
        const gb = L.rings[c.g], psi = Math.atan2(-(c.y - gb.y), c.x - gb.x); // 套管轴 = 被扣住环在该点的切线
        const mb = new THREE.Mesh(sleeve, cm); mb.position.set(lx, ly, 0); mb.rotation.z = psi; mb.castShadow = mb.receiveShadow = true; g.add(mb);
        if (d > R + r * S.stemMin) { const len = d - R - sr * 0.5; if (len > 1) { const st = new THREE.Mesh(stem, cm); st.scale.y = len; st.position.set(Math.cos(phi) * (R + len / 2), Math.sin(phi) * (R + len / 2), 0); st.rotation.z = phi - Math.PI / 2; st.castShadow = true; g.add(st); } }
      });
      g.position.set(b.x, -b.y, 0); this.root.add(g); this.groups.push(g);
    });
  }
  // 字母主题：每个字母 = 若干管状笔画（直线 / 圆弧，端点与拐角用球补圆）；扣子 = 米色珠（套在被扣字母笔画上）+ 黑色细杆（连到主人字母）
  buildLetters(L, S, mkMat, q, W, wc) {
    const mtk = matTheme(S), MT = MATERIAL_THEMES[mtk], CS = S.connStyle || 'beadRod', thick = CS === 'collar', clasp = CS === 'clasp';
    const r = LTUBE(S), cap = new THREE.SphereGeometry(r, Math.round(32 * q), Math.round(20 * q));
    const sr = r * S.beadR, bead = new THREE.TorusGeometry((sr + r * 1.02) / 2, (sr - r * 1.02) / 2, Math.round(24 * q), Math.round(48 * q)), rod = new THREE.CylinderGeometry(S.rodR, S.rodR, 1, 20);
    bead.scale(1, 1, S.beadLen); bead.rotateX(Math.PI / 2); // 圆润甜甜圈珠：轴 = 局部 y
    const ball = new THREE.SphereGeometry(r * 0.75, 24, 16);
    L.rings.forEach((b, i) => {
      const g = new THREE.Group(); g.userData.i = i; const mat = mkMat(colorOf(S, b.c), false, S['hl_' + b.c] ?? 1); Object.assign(mat, MT.ring); if (mtk === 'candy') { mat.roughness = S.candyRough; mat.emissiveIntensity = W ? 0 : S.candyGlow; } g.userData.mats = [mat];
      const P = glyphPolys(b.ch, b.h || 140, b.rot || 0);
      for (const pl of P) {
        const pts = pl.map(([x, y]) => new THREE.Vector3(x, -y, 0)), curve = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length === 2 ? 2 : Math.round(pts.length * 3 * q), r, Math.round(32 * q), false), mat); m.castShadow = m.receiveShadow = true; g.add(m);
        for (const v of [pts[0], pts[pts.length - 1]]) { const c = new THREE.Mesh(cap, mat); c.position.copy(v); c.castShadow = true; g.add(c); }
      }
      g.position.set(b.x, -b.y, 0); this.root.add(g); this.groups.push(g);
    });
    // 扣子挂在主人字母组里（随主人移动/飞走）；珠轴 = 被扣字母该点切线
    L.clips.forEach((c, k) => {
      const o = L.rings[c.o], gb = L.rings[c.g], go = this.groups[c.o]; if (!go) return;
      const bm = new THREE.MeshPhysicalMaterial({ color: W ? wc : S.beadColor, roughness: S.beadRough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color('#fff6dc'), envMapIntensity: 1.1, emissive: new THREE.Color(W ? wc : S.beadColor), emissiveIntensity: 0 }); go.userData.mats.push(bm); this.clipMeshes[k] = bm; // 参考：米色圆珠 + 深色细杆
      const rm = new THREE.MeshPhysicalMaterial({ color: W ? wc : S.rodColor, roughness: 0.3, metalness: 0.5, clearcoat: 0.6, envMapIntensity: 0.9 }); go.userData.mats.push(rm);
      const tg = glyphNearest(glyphPolys(gb.ch, gb.h || 140, gb.rot || 0), c.x - gb.x, c.y - gb.y), qo = glyphNearest(glyphPolys(o.ch, o.h || 140, o.rot || 0), (c.rx ?? c.x) - o.x, (c.ry ?? c.y) - o.y);
      if (clasp) { // 同色方扣细杆：主人同色细杆从主人笔画伸出，末端圆角方扣包住被扣字母笔画
        const cm = go.userData.mats[0].clone(); go.userData.mats.push(cm); this.clipMeshes[k] = cm;
        const h = r * S.claspR, box = new RoundedBoxGeometry(h * 2, r * S.claspLen, h * 2, 4, Math.min(h, r * S.claspLen / 2) * 0.45), rodT = new THREE.CylinderGeometry(r * S.claspRodR, r * S.claspRodR, 1, 20);
        const bx = c.x - o.x, by = -(c.y - o.y), ax = qo.x, ay = -qo.y, m = new THREE.Mesh(box, cm); m.position.set(bx, by, 0); m.rotation.z = -tg.ang - Math.PI / 2; m.castShadow = m.receiveShadow = true; go.add(m);
        const dx = ax - bx, dy = ay - by, len = Math.hypot(dx, dy); if (len > 1) { const st = new THREE.Mesh(rodT, cm); st.scale.y = len; st.position.set((ax + bx) / 2, (ay + by) / 2, 0); st.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; st.castShadow = true; go.add(st); }
        return; }
      if (thick) { // 粗管套筒：拉丝金属圆柱套筒包住两端笔画（被扣字母 + 主人字母），中间短细金属杆
        const cm = new THREE.MeshPhysicalMaterial({ color: W ? wc : S.collarColor, metalness: 1, roughness: S.collarRough, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 1.3, emissive: new THREE.Color(W ? wc : '#000000'), emissiveIntensity: 0, ...MT.conn }); go.userData.mats.push(cm); this.clipMeshes[k] = cm;
        const cr = r * S.collarR, cl = r * S.collarLen, col = sleeveGeom(cr, cl / 2, Math.min(cr, cl / 2) * 0.12, Math.round(40 * q)), rodT = new THREE.CylinderGeometry(r * S.collarRodR, r * S.collarRodR, 1, 24);
        const put = (x, y, ang) => { const m = new THREE.Mesh(col, cm); m.position.set(x, y, 0); m.rotation.z = -ang - Math.PI / 2; m.castShadow = m.receiveShadow = true; go.add(m); };
        const bx = c.x - o.x, by = -(c.y - o.y), ax = qo.x, ay = -qo.y; put(bx, by, tg.ang); put(ax, ay, qo.ang);
        const dx = ax - bx, dy = ay - by, len = Math.hypot(dx, dy); if (len > 1) { const st = new THREE.Mesh(rodT, cm); st.scale.y = len; st.position.set((ax + bx) / 2, (ay + by) / 2, 0); st.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; st.castShadow = true; go.add(st); }
        return; }
      const lx = c.x - o.x, ly = -(c.y - o.y), mb = new THREE.Mesh(bead, bm); mb.position.set(lx, ly, 0); mb.rotation.z = -tg.ang - Math.PI / 2; mb.castShadow = mb.receiveShadow = true; go.add(mb);
      const ex = qo.x, ey = -qo.y, dx = ex - lx, dy = ey - ly, len = Math.hypot(dx, dy);
      if (len > 1) { const st = new THREE.Mesh(rod, rm); st.scale.y = len + r * 0.6; st.position.set((lx + ex) / 2, (ly + ey) / 2, 0); st.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; st.castShadow = true; go.add(st); }
    });
  }
  // 影棚环境：暗底 + 发光柔光箱条（顶部长条 / 左右竖条 / 暖色地面反光）→ PMREM，让金属管沿长度出现明亮清晰的反光条和暗带
  makeEnv(S) {
    const key = [S.envMode, S.envBoxes, S.envDark, S.envWarm, S.envBoxH].join(); if (key === this.envKey) return; this.envKey = key;
    let sc;
    if (S.envMode === 'room') sc = new RoomEnvironment();
    else {
      sc = new THREE.Scene(); const dk = new THREE.Color(S.envDark); sc.background = dk;
      const box = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
      const B = S.envBoxes;
      box(14, S.envBoxH, 0, 7, 4, '#ffffff', 3.2 * B * 3.2 / S.envBoxH);   // 顶部长柔光箱（管顶亮条）
      box(3 * S.envBoxH / 3.2, 12, -8, 1, 5, '#ffffff', 2.0 * B * 3.2 / S.envBoxH);    // 左侧竖条（左上主光）
      box(2.2, 10, 8, 0, 3, '#ffffff', 1.1 * B);   // 右侧竖条（边缘轮廓光）
      box(10, 2, 0, 2, 9, '#ffffff', 1.4 * B);     // 正前方（相机侧）软光
      box(16, 6, 0, -7, 2, S.envWarm, 0.9 * B);    // 暖色地面反光（下沿暖色）
    }
    if (this.envTex) this.envTex.dispose(); this.envTex = this.pm.fromScene(sc, 0.03).texture; this.scene.environment = this.envTex;
  }
  setSize(w, h) { if (this.canvas.width !== w || this.canvas.height !== h) this.renderer.setSize(w, h, false); }
  render(S, view, xfs, flash, only = -1) {
    this.makeEnv(S);
    const c = this.cam; c.left = view.x0; c.right = view.x0 + view.w; c.top = -view.y0; c.bottom = -(view.y0 + view.h); c.updateProjectionMatrix();
    const R = this.renderer; R.toneMapping = (S.theme === 'letters' && matTheme(S) === 'candy' && !S.whiteModel) ? TONE.neutral : TONE[S.toneMap] ?? THREE.ACESFilmicToneMapping; // 糖果：中性色调映射，保留高饱和 R.toneMappingExposure = S.exposure;
    this.amb.intensity = S.ambInt; this.sun.intensity = S.lightInt; this.fill.intensity = S.fillInt;
    const la = rad(S.lightAz), le = rad(S.lightEl), cx = 360, cy = -760;
    this.sun.position.set(cx + 1500 * Math.cos(le) * Math.cos(la), cy + 1500 * Math.cos(le) * Math.sin(la), 1500 * Math.sin(le)); this.sun.target.position.set(cx, cy, 0);
    this.fill.position.set(cx - 1000 * Math.cos(la), cy - 1000 * Math.sin(la), 800);
    this.sun.shadow.radius = S.selfShadowSoft; this.sun.castShadow = S.selfShadow;
    this.root.rotation.x = rad(S.tiltDeg);
    this.groups.forEach((g, i) => {
      const f = xfs[i]; g.visible = !!f && f.op > 0.002 && (only < 0 || only === i); if (!f) return;
      g.position.set(f.x, -f.y, f.z || (f.op < 1 ? 80 : 0)); g.rotation.z = -rad(f.rot); g.scale.setScalar(f.sc);
      for (const m of g.userData.mats) { const tr = f.op < 0.999; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = f.op; m.depthWrite = !tr; }
    });
    if (this.clipMeshes) this.clipMeshes.forEach((m, k) => { if (m) { const fl = flash[k] || 0; m.emissive.set(fl > 0.01 ? '#ff2020' : m.userData.em || (m.userData.em = '#' + m.emissive.getHexString())); m.emissiveIntensity = fl > 0.01 ? fl * 0.9 : S.sss; } });
    R.render(this.scene, this.cam);
    return this.canvas;
  }
}
