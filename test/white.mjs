import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
for (const th of ['rings', 'letters']) { await p.evaluate(th => { __game.setMany({ theme: th, whiteModel: true, canvasW: 720, canvasH: 1280 }); }, th); await advance(p, 0.2); await shot(p, `screenshots/white_model_${th}.png`); }
await p.evaluate(() => __game.setMany({ whiteModel: false, theme: 'rings' })); console.log('errs', errs); await b.close();
