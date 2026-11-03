import { openPage, advance, shot } from './lib.mjs';
const { b, p } = await openPage();
await p.evaluate(() => { __game.setMany({ canvasW: 1080, canvasH: 1920 }); __game.startAuto(); });
await advance(p, 2.3); for (let i = 0; i < 10; i++) { await shot(p, `/tmp/rf/t${i}.png`); await advance(p, 0.1); } await b.close();
