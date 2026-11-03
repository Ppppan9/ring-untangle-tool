// 全流程测试：加载无报错 / 鼠标手动解完 / 自动通关解完（不自动录制）/ AE·3D·H5 导出 / H5 包冒烟
import { openPage, advance, shot, ok, URL0 } from './lib.mjs';
import fs from 'fs'; import { execSync } from 'child_process';
fs.mkdirSync('test/out', { recursive: true });
const { b, p, errs } = await openPage();
ok(errs.length === 0, '加载无 console/page error ' + JSON.stringify(errs));
// 1) 手动：用真实鼠标事件拖动每个可取下的环
const box = await p.$eval('#stage', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const toScr = async (x, y) => p.evaluate(([x, y]) => { const v = __game.view, c = document.getElementById('stage'), r = c.getBoundingClientRect(), K = Math.min(c.width / 720, c.height / 1280); return [r.left + (x - v.x0) * K / c.width * r.width, r.top + (y - v.y0) * K / c.height * r.height]; }, [x, y]);
// 先试一个被卡住的环（左黄 3）
{ const r = await p.evaluate(() => __game.L.rings[3]); const [sx, sy] = await toScr(r.x + 90, r.y); await p.mouse.move(sx, sy); await p.mouse.down(); await advance(p, 0.1); await p.mouse.move(sx, sy + 40, { steps: 4 }); await p.mouse.up(); await advance(p, 0.6); ok(await p.evaluate(() => __game.G.rings[3].state === 'idle'), '手动：被卡住的环不会取下（抖动）'); }
let n = 0;
for (let k = 0; k < 20; k++) {
  const tgt = await p.evaluate(() => { const G = __game.G, f = G.freeIds(); if (!f.length) return null; const i = f[0], x = G.xf(i); return { i, x: x.x + 90 * Math.cos(2.2), y: x.y + 90 * Math.sin(2.2) }; });
  if (!tgt) break; const [sx, sy] = await toScr(tgt.x, tgt.y);
  await p.mouse.move(sx, sy); await p.mouse.down(); await advance(p, 0.05); await p.mouse.move(sx + 30, sy - 25, { steps: 5 }); await advance(p, 0.05); await p.mouse.up(); await advance(p, 0.8); n++;
  if (k === 0) await shot(p, 'screenshots/manual_after_first.png');
}
const man = await advance(p, 0.3);
ok(man.left === 0 && man.win != null, `手动（鼠标拖动）解完全部环：${n} 次拖动，剩余 ${man.left}`);
// 2) 自动通关
await p.evaluate(() => __game.newGame()); await p.evaluate(() => __game.startAuto());
ok(await p.evaluate(() => __game.mediaRec === null), '自动通关不会自动开始录制');
await p.evaluate(() => __game.aeStart());
let r = null; for (let s = 0; s < 60; s++) { r = await advance(p, 1); if (r.win != null) break; }
ok(r.win != null && r.left === 0, `自动通关全部解开（用时 ${r.t.toFixed(1)} 秒）`);
ok(await p.evaluate(() => __game.hand.img && __game.hand.visible !== undefined), '默认手指 hand.png 已加载');
await advance(p, 1);
await p.evaluate(() => __game.aeStop());
// 3) 导出
const grab = async (fn, name) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 600000 }), p.evaluate(fn)]); const f = 'test/out/' + d.suggestedFilename(); await d.saveAs(f); ok(fs.statSync(f).size > 1000, `${name}：${f} (${(fs.statSync(f).size / 1e6).toFixed(2)} MB)`); return f; };
const ae = await grab(() => __game.doExportAE(), 'AE 导出');
const lst = execSync(`unzip -l ${ae}`).toString(); ok(/build_ae_project\.jsx/.test(lst) && /timeline\.json/.test(lst) && /assets\/ring_0\.png/.test(lst) && /audio\/mix\.wav/.test(lst), 'AE ZIP 含 jsx / timeline / 环素材 / 音频');
const tl = JSON.parse(execSync(`unzip -p ${ae} timeline.json`).toString()); ok(tl.comps.find(c => c.id === 'main').layers.length >= 14, `AE 主合成图层 ${tl.meta.stats.layers}，关键帧 ${tl.meta.stats.keys}`);
await grab(() => __game.doExport3D(), '3D 导出(glTF)');
const h5 = await grab(() => __game.doExportH5(), 'H5 导出');
const hl = execSync(`unzip -l ${h5}`).toString(); ok(/tiktok\/index\.html/.test(hl) && /tiktok\/config\.json/.test(hl) && /generic\/index\.html/.test(hl), 'H5 ZIP 含各渠道 index.html + tiktok/config.json');
// 4) 录制按钮
await p.evaluate(() => { window.__vclock = null; __game.newGame(); __game.startAuto(); __game.startRec(); });
await p.waitForTimeout(3000);
const rv = await grab(() => __game.stopRec(), '录制视频（含同步 AE 导出）');
// 5) H5 冒烟
execSync(`rm -rf test/out/h5 && mkdir -p test/out/h5 && cd test/out/h5 && unzip -q ../../../${h5}`);
const errs2 = []; const q = await b.newPage({ viewport: { width: 390, height: 844 } }); q.on('pageerror', e => errs2.push(String(e))); q.on('console', m => m.type() === 'error' && errs2.push(m.text()));
await q.goto(URL0.replace('index.html', 'test/out/h5/generic/index.html')); await q.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await q.waitForTimeout(800);
const info = await q.evaluate(() => ({ hand: !!__game.hand.img, auto: !!__game.auto, panel: getComputedStyle(document.getElementById('panel')).display, st: window.__h5State() }));
ok(!info.hand && !info.auto && info.panel === 'none', 'H5：无手指、不自动演示、无编辑面板 ' + JSON.stringify(info));
const s0 = info.st; const rr = await q.evaluate(() => { const G = __game.G, i = G.freeIds()[0], x = G.xf(i), c = document.getElementById('stage'), r = c.getBoundingClientRect(), v = __game.view, K = Math.min(c.width / 720, c.height / 1280); return [r.left + (x.x + 90 - v.x0) * K / c.width * r.width, r.top + (x.y - v.y0) * K / c.height * r.height]; });
await q.mouse.move(rr[0], rr[1]); await q.mouse.down(); await q.mouse.move(rr[0], rr[1] + 30, { steps: 3 }); await q.mouse.up(); await q.waitForTimeout(900);
ok(await q.evaluate(s => window.__h5State() !== s, s0), 'H5：点击拖动改变游戏状态');
await q.screenshot({ path: 'screenshots/h5_generic_390x844.png' });
ok(errs2.length === 0, 'H5 无报错 ' + JSON.stringify(errs2));
// 5) 字母型解锁主题：LUNCH / CAKE 参考关 + 随机单词生成
for (const [w, n] of [['LUNCH', 5], ['CAKE', 4]]) {
  await p.evaluate(w => { __game.setMany({ theme: 'letters', word: w, wordSeed: 0, autoMode: 'ref', canvasW: 360, canvasH: 640, ssaa: 1 }); }, w);
  ok(await p.evaluate(n => __game.L.theme === 'letters' && __game.L.rings.length === n && __game.solveLevel(__game.levelFromSettings(__game.S)).solvable, n), `字母主题：${w} 参考关卡 ${n} 个字母，可解`);
  await p.evaluate(() => { window.__T = 200000; __game.renderAt(window.__T); __game.startAuto(); });
  let lr = null; for (let s2 = 0; s2 < 30; s2++) { lr = await advance(p, 1); if (lr.win != null) break; }
  ok(lr.win != null && lr.left === 0 && await p.evaluate(() => __game.G.rings.every(r => r.slot != null)), `字母主题 ${w}：参考序列自动通关（转 C 脱扣），用时 ${lr.t.toFixed(1)} 秒，全部入槽`);
}
ok(await p.evaluate(() => __game.L.clips.every(c => { const o = __game.L.rings[c.o]; return c.rx != null && Math.hypot(c.rx - o.x, c.ry - o.y) < 120; })), '字母主题：每根杆端都接在主人字母上（无悬空杆）');
for (const w of ['MONEY', 'QUIZ', 'BRIGHTS', 'JAVELIN', 'ABCDEFGH']) { const is = await p.evaluate(w => { const L = __game.wordLevel(w, 4); return __game.layoutIssues(L); }, w); ok(is.total === 0, `字母主题：${w} 生成布局整洁（重叠 ${is.overlap} / 杆穿字 ${is.rodHit} / 杆交叉 ${is.cross}）`); }
for (const w of ['MONEY', 'QUIZ', 'BRIGHTS', 'JAVELIN', 'SKY']) {
  await p.evaluate(w => { __game.setMany({ word: w, wordSeed: 3, autoMode: 'solver' }); __game.startAuto(); }, w);
  let lr = null; for (let s2 = 0; s2 < 60; s2++) { lr = await advance(p, 1); if (lr.win != null) break; }
  ok(lr.win != null, `字母主题：随机单词 ${w}（${await p.evaluate(() => __game.L.clips.length)} 个扣）求解自动通关 ${lr.t.toFixed(1)} 秒`);
}
await p.evaluate(() => { __game.setMany({ word: 'CAKE', wordSeed: 0, autoMode: 'ref', whiteModel: true }); __game.startAuto(); __game.aeStart(); }); await advance(p, 12); await p.evaluate(() => __game.aeStop());
await grab(() => __game.doExportAE(), '字母主题 CAKE AE 导出（白模）');
await grab(() => __game.doExportH5(), '字母主题 CAKE H5 导出（白模）');
await grab(() => __game.doExport3D(), '字母主题 CAKE 3D 导出（白模）');
// 6) 字母风格 × 连接件风格 组合
for (const [ls, cs] of [['thick', 'collar'], ['candy', 'clasp'], ['ref', 'clasp'], ['candy', 'beadRod'], ['thick', 'clasp']]) {
  const tube = { ref: 9.5, thick: 20, candy: 17 }[ls];
  await p.evaluate(([ls, cs]) => { __game.setMany({ letterStyle: ls, connStyle: cs, whiteModel: false, word: 'CAKE', wordSeed: 0, autoMode: 'ref' }); __game.startAuto(); }, [ls, cs]);
  { let lr = null; for (let s2 = 0; s2 < 30; s2++) { lr = await advance(p, 1); if (lr.win != null) break; } ok(lr.win != null, `${ls}+${cs}：CAKE 参考序列自动通关 ${lr.t.toFixed(1)} 秒`); }
  const w = 'MONEY', is = await p.evaluate(([w, t]) => { __game.setMany({ word: w, wordSeed: 3, autoMode: 'solver' }); return __game.layoutIssues(__game.L, t); }, [w, tube]); ok(is.overlap === 0, `${ls}+${cs}：${w} 布局无字母重叠（杆穿字 ${is.rodHit} / 交叉 ${is.cross}）`);
  await p.evaluate(() => __game.startAuto()); let lr = null; for (let s2 = 0; s2 < 60; s2++) { lr = await advance(p, 1); if (lr.win != null) break; } ok(lr.win != null, `${ls}+${cs}：${w} 求解自动通关 ${lr.t.toFixed(1)} 秒`);
}
await p.evaluate(() => { __game.setMany({ letterStyle: 'candy', connStyle: 'clasp', word: 'CAKE', wordSeed: 0, autoMode: 'ref', whiteModel: true }); __game.startAuto(); __game.aeStart(); }); await advance(p, 12); await p.evaluate(() => __game.aeStop());
await grab(() => __game.doExportAE(), '糖果+方扣 CAKE AE 导出（白模）'); await grab(() => __game.doExportH5(), '糖果+方扣 CAKE H5 导出（白模）'); await grab(() => __game.doExport3D(), '糖果+方扣 CAKE 3D 导出（白模）');
await p.evaluate(() => __game.setMany({ theme: 'rings', whiteModel: false, letterStyle: 'ref', connStyle: 'beadRod' }));
ok(errs.length === 0, '全程无 console/page error ' + JSON.stringify(errs));
await b.close();
