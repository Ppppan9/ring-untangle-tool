import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
const word = process.argv[2] || 'CAKE', T = (process.argv[3] || '0,13').split(',').map(Number), pre = process.argv[4] || '/tmp/lt/' + word, extra = JSON.parse(process.argv[5] || '{}');
await p.evaluate(([w, e]) => { __game.setMany({ theme: 'letters', word: w, wordSeed: 0, canvasW: 720, canvasH: 1280, ...e }); __game.startAuto(); }, [word, extra]);
await advance(p, 0.05); let t = 0; for (const x of T) { const r = await advance(p, x - t); t = x; await shot(p, `${pre}_${x}.png`); console.log(word, x, JSON.stringify(r)); }
console.log('errs', errs); await b.close();
