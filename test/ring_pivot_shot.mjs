// 截图：环绕自身重心旋转到一半（红十字 = 环重心枢轴）
import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
const info = await p.evaluate(() => { __game.setMany({ theme: 'rings', autoMode: 'ref' }); const G = __game.G, i = G.freeIds().filter(i => G.grips(i).length)[0], L = G.L.rings[i];
  G.press(i, L.x + 80, L.y); const px = G.rings[i].px, py = G.rings[i].py, need = G.ringNeed(i), a0 = Math.atan2(0, 80); for (let k = 1; k <= 20; k++) { const a = a0 + need / 2 * Math.PI / 180 * k / 20; G.move(px + 80 * Math.cos(a), py + 80 * Math.sin(a)); }
  return { i, px, py, ring: [L.x, L.y], rot: G.rings[i].rot, need }; });
await advance(p, 0.03); await shot(p, '/tmp/pivot_raw.png'); console.log(JSON.stringify(info), errs); await b.close();
