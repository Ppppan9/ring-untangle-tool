import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
const ov = JSON.parse(process.argv[2] || '{}');
await p.evaluate((ov) => { __game.setMany({ canvasW: 1080, canvasH: 1920, ...ov }); __game.startAuto(); }, ov);
await advance(p, 6.0); await shot(p, process.argv[3] || '/tmp/it.png'); console.log('errs', errs.length); await b.close();
