import { openPage, advance } from './lib.mjs';
const { b, p, errs } = await openPage();
await p.evaluate(() => { __game.setMany({ theme: 'rings', autoMode: 'ref' }); __game.startAuto(); }); let lr; for (let s = 0; s < 0; s++) { lr = await advance(p, 1); if (lr.win != null) break; } console.log('rings', JSON.stringify(lr));
await p.evaluate(() => { __game.setMany({ theme: 'letters', word: 'CAKE', wordSeed: 0, autoMode: 'ref' }); __game.startAuto(); }); for (let s = 0; s < 60; s++) { lr = await advance(p, 1); if (lr.win != null) break; } console.log('cake', JSON.stringify(lr), errs); await b.close();
