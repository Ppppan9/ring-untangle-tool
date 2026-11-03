import { openPage, advance } from './lib.mjs';
const { b, p, errs } = await openPage(undefined, { width: 1500, height: 1400 });
await p.evaluate(() => __game.setMany({ theme: 'letters', letterStyle: 'thick', connStyle: 'collar' })); await advance(p, 0.1);
const el = await p.evaluateHandle(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'collar')); return s.closest('details,fieldset,section,div.group') || s.parentElement.parentElement; });
await el.evaluate(e => { e.open = true; e.scrollIntoView(); }); await el.screenshot({ path: 'screenshots/settings_v110_model_material.png' }); console.log(errs); await b.close();
