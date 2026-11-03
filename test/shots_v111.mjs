// v1.11 截图：3x3 组合网格 + 编辑器风格选择器 + 设置截图
import { openPage, advance, shot } from './lib.mjs';
import fs from 'fs';
fs.mkdirSync('/tmp/v111g', { recursive: true });
const { b, p, errs } = await openPage(undefined, { width: 1500, height: 1400 });
for (const ls of ['ref', 'thick', 'candy']) for (const cs of ['beadRod', 'collar', 'clasp']) {
  await p.evaluate(([ls, cs]) => __game.setMany({ theme: 'letters', letterStyle: ls, connStyle: cs, whiteModel: false, word: 'CAKE', wordSeed: 0, canvasW: 720, canvasH: 1280, autoMode: 'ref' }), [ls, cs]);
  await advance(p, 0.05); await shot(p, `/tmp/v111g/${ls}_${cs}.png`);
}
await p.evaluate(() => { __game.setMany({ letterStyle: 'candy', connStyle: 'clasp' }); __game.openEditor(); }); await advance(p, 0.1);
await p.screenshot({ path: 'screenshots/editor_v111_style_pickers.png' });
const el = await p.evaluateHandle(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'clasp') && !x.closest('#editBar')); return s.closest('details,fieldset,section,div.group') || s.parentElement.parentElement; });
await el.evaluate(e => { e.open = true; e.scrollIntoView(); }); await el.screenshot({ path: 'screenshots/settings_v111_styles.png' });
console.log('errs', errs); await b.close();
