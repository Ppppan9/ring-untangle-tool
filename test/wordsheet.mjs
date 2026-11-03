import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
for (const w of ['MONEY', 'QUIZ', 'BRIGHTS']) { await p.evaluate(w => __game.setMany({ theme: 'letters', word: w, wordSeed: 3, canvasW: 720, canvasH: 1280, lvTitle: w }), w); await advance(p, 0.1); await shot(p, `/tmp/lt/ws_${w}.png`); }
// 26 字母：三行
for (const [k, w] of [['A', 'ABCDEFGHI'], ['J', 'JKLMNOPQR'], ['S', 'STUVWXYZ']]) { await p.evaluate(w => { __game.setMany({ theme: 'letters', levelJsonL: JSON.stringify({ theme: 'letters', word: w, rings: [...w].map((ch, i) => ({ c: ['yellow', 'pink', 'teal', 'orange', 'purple', 'blue', 'green', 'red'][i % 8], ch, x: 60 + i * 75, y: 640, rot: 0, h: 100 })), clips: [] }), lvTitle: '' }); }, w); await advance(p, 0.1); await shot(p, `/tmp/lt/gl_${k}.png`); }
await p.evaluate(() => __game.setMany({ levelJsonL: '', whiteModel: true, word: 'CAKE', wordSeed: 0, lvTitle: 'Level 3' })); await advance(p, 0.1); await shot(p, 'screenshots/white_model_CAKE.png');
console.log(errs); await b.close();
