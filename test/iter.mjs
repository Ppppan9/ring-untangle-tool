import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
const ov = JSON.parse(process.argv[2] || '{}'), pre = process.argv[3] || '/tmp/it', times = (process.argv[4] || '6,10').split(',').map(Number);
await p.evaluate((ov) => { __game.setMany({ canvasW: 1080, canvasH: 1920, ...ov }); __game.startAuto(); }, ov);
let t = 0; for (const T of times) { await advance(p, T - t); t = T; await shot(p, `${pre}_${T}.png`); }
console.log('errs', errs.length); await b.close();
