// 环形：绕谜题中心旋转；单击不脱出；转到缺口对准扣子才脱出；自动通关。字母：单击不取下，直线字母沿杆拖出，C 转出
import { openPage, advance, ok } from './lib.mjs';
const { b, p, errs } = await openPage();
const r = await p.evaluate(() => { __game.setMany({ theme: 'rings', autoMode: 'ref' }); const G = __game.G, i = G.freeIds().filter(i => G.grips(i).length)[0], L = G.L.rings[i];
  G.press(i, L.x + 80, L.y); const tap = G.release(), st1 = G.rings[i].state;
  G.press(i, L.x + 80, L.y); const px = G.rings[i].px, py = G.rings[i].py, c = G.centroid(), need = G.ringNeed(i), rr = Math.hypot(L.x + 80 - px, L.y - py), a0 = Math.atan2(L.y - py, L.x + 80 - px);
  const n = 40; for (let k = 1; k <= n; k++) { const a = a0 + need * Math.PI / 180 * k / n; G.move(px + rr * Math.cos(a), py + rr * Math.sin(a)); } const rot = G.rings[i].rot, dr = G.release();
  return { tap, st1, need, rot, dr, st2: G.rings[i].state, center: Math.hypot(px - c[0], py - c[1]) < 1 }; });
ok(r.tap.ok === false && r.st1 === 'idle', '环形：单击不脱出 ' + JSON.stringify(r.tap));
ok(r.center, '环形：拖动枢轴 = 谜题中心');
ok(r.dr.ok && r.st2 === 'fly', `环形：绕中心转 ${r.rot.toFixed(0)}°（缺口对准扣子需 ${r.need.toFixed(0)}°）后脱出`);
await p.evaluate(() => __game.startAuto()); let lr; for (let s = 0; s < 120; s++) { lr = await advance(p, 1); if (lr.win != null) break; }
ok(lr.win != null, `环形：参考关自动通关（可见中心旋转）${lr.t.toFixed(1)} 秒`);
const q = await p.evaluate(() => { __game.setMany({ theme: 'letters', word: 'CAKE', wordSeed: 0, autoMode: 'ref' }); const G = __game.G, E = 3, L = G.L.rings[E];
  G.press(E, L.x, L.y); const tap = G.release(); const [ux, uy] = G.slideDir(E); G.press(E, L.x, L.y); for (let k = 1; k <= 20; k++) G.move(L.x + ux * k * 4, L.y + uy * k * 4); const sl = G.release();
  return { tap, sl, st: G.rings[E].state }; });
ok(q.tap.ok === false, '字母：E 单击不取下 ' + JSON.stringify(q.tap)); ok(q.sl.ok && q.st === 'fly', '字母：E 沿杆拖出后取下');
await p.evaluate(() => __game.startAuto()); for (let s = 0; s < 60; s++) { lr = await advance(p, 1); if (lr.win != null) break; } ok(lr.win != null, `字母 CAKE：自动通关（C 旋转 + 直线拖出）${lr.t.toFixed(1)} 秒`);
ok(errs.length === 0, '无报错 ' + JSON.stringify(errs)); await b.close();
