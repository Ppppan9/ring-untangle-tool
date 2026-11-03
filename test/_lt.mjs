import { openPage, advance, ok } from './lib.mjs';
const { b, p, errs } = await openPage(); let lr;
const q = await p.evaluate(() => { __game.setMany({ theme: 'letters', word: 'CAKE', wordSeed: 0, autoMode: 'ref' }); const G = __game.G, E = 3, L = G.L.rings[E];
  G.press(E, L.x, L.y); const tap = G.release(); const [ux, uy] = G.slideDir(E); G.press(E, L.x, L.y); for (let k = 1; k <= 20; k++) G.move(L.x + ux * k * 4, L.y + uy * k * 4); const sl = G.release();
  return { tap, sl, st: G.rings[E].state }; });
ok(q.tap.ok === false, '字母：E 单击不取下 ' + JSON.stringify(q.tap)); ok(q.sl.ok && q.st === 'fly', '字母：E 沿杆拖出后取下');
await p.evaluate(() => __game.startAuto()); for (let s = 0; s < 60; s++) { lr = await advance(p, 1); if (lr.win != null) break; } ok(lr.win != null, `字母 CAKE：自动通关（C 旋转 + 直线拖出）${lr.t.toFixed(1)} 秒`);
ok(errs.length === 0, '无报错 ' + JSON.stringify(errs)); await b.close();
