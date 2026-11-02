import { openPage, advance, shot } from './lib.mjs';
const { b, p, errs } = await openPage();
await advance(p, 0.2); await shot(p, 'screenshots/t0.png');
console.log(errs); await b.close();
