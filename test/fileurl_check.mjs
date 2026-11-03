import { openPage, advance } from './lib.mjs';
const { b, p, errs } = await openPage('file:///workspace/out/ring-untangle-v1.13.html');
const reqs = []; p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) reqs.push(r.url()); });
await p.evaluate(() => { __game.setMany({ theme: 'letters', letterStyle: 'candy', connStyle: 'clasp', word: 'CAKE', wordSeed: 0, autoMode: 'ref' }); __game.startAuto(); });
let lr; for (let i = 0; i < 30; i++) { lr = await advance(p, 1); if (lr.win != null) break; }
console.log('file:// win', lr.win != null, lr.t, 'net', reqs, 'errs', errs); await b.close();
