import { openPage, advance, shot, ok } from './lib.mjs';
const { b, p, errs } = await openPage();
const T = (process.argv[2] || '0,1.5,2.8,4.5,5.5,6.2,7.2,9').split(',').map(Number);
await p.evaluate(() => { __game.setMany({ theme: 'letters', canvasW: 720, canvasH: 1280 }); __game.startAuto(); });
await advance(p, 0.05); let t = 0; for (const x of T) { const r = await advance(p, x - t); t = x; await shot(p, `/tmp/lt/t_${x}.png`); console.log(x, JSON.stringify(r), await p.evaluate(() => __game.G.rings.map(r => r.state[0] + (r.rot | 0)).join(' '))); }
console.log('errs', errs); await b.close();
// 白模截图（两种主题）
import { execSync } from 'child_process';
