import fs from 'fs'; import { openPage, advance, ok } from './lib.mjs';
const { b, p, errs } = await openPage();
const grab = async (fn, name) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 600000 }), p.evaluate(fn)]); const f = 'test/out/' + d.suggestedFilename(); await d.saveAs(f); ok(fs.statSync(f).size > 1000, `${name}：${f}`); return f; };
const src = fs.readFileSync('test/play.mjs', 'utf8'); const part = src.slice(src.indexOf('// 5) 字母型解锁主题'), src.indexOf("ok(errs.length === 0, '全程无"));
await eval(`(async () => {${part}})()`);
ok(errs.length === 0, '字母主题无报错 ' + JSON.stringify(errs)); await b.close();
