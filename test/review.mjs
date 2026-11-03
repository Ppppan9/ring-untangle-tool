import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
await p.evaluate(() => { __game.setMany({ canvasW: 1080, canvasH: 1920 }); __game.startAuto(); });
const T = [0.5, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 6, 10, 15, 18, 20]; let t = 0;
for (const x of T) { await advance(p, x - t); t = x; await shot(p, `/tmp/rv/t_${x}.png`); }
console.log('errs', errs); await b.close();
