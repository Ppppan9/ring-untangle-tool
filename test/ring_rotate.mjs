// 环形：单击可取下的环不应直接脱出；绕扣子拖转够角度后才脱出；自动通关可完成
import { openPage, advance, ok } from './lib.mjs';
const { b, p, errs } = await openPage();
const r = await p.evaluate(() => { __game.setMany({ theme: 'rings', autoMode: 'ref' }); const G = __game.G, free = G.freeIds().filter(i => G.grips(i).length); const i = free[0], L = G.L.rings[i];
  G.press(i, L.x + 80, L.y); const tap = G.release(); const st1 = G.rings[i].state;
  G.press(i, L.x + 80, L.y); const px = G.rings[i].px, py = G.rings[i].py, rr = Math.hypot(L.x + 80 - px, L.y - py), a0 = Math.atan2(L.y - py, L.x + 80 - px);
  for (let k = 1; k <= 20; k++) { const a = a0 + k * 0.05; G.move(px + rr * Math.cos(a), py + rr * Math.sin(a)); } const rot = G.rings[i].rot; const dr = G.release();
  return { i, tap, st1, rot, dr, st2: G.rings[i].state, pivotIsClip: G.grips(i).some(c => Math.hypot(c.x - px, c.y - py) < 1) || G.grips(i).length > 1 }; });
ok(r.tap.ok === false && r.st1 === 'idle', '环形：单击可取下的环不会直接脱出（需转动）' + JSON.stringify(r.tap));
ok(r.pivotIsClip, '环形：拖动时绕扣子(枢轴)旋转');
ok(r.dr.ok && r.st2 === 'fly', `环形：绕扣子转 ${r.rot.toFixed(0)}° 后脱出`);
await p.evaluate(() => __game.startAuto()); let lr; for (let s = 0; s < 90; s++) { lr = await advance(p, 1); if (lr.win != null) break; }
ok(lr.win != null, `环形：参考序列自动通关（含可见旋转）${lr.t.toFixed(1)} 秒`);
await p.evaluate(() => { __game.setMany({ autoMode: 'solver', boardSeed: 7 }); __game.startAuto(); }); for (let s = 0; s < 120; s++) { lr = await advance(p, 1); if (lr.win != null) break; }
ok(lr.win != null, `环形：求解自动通关 ${lr.t.toFixed(1)} 秒`);
ok(errs.length === 0, '无报错 ' + JSON.stringify(errs)); await b.close();
