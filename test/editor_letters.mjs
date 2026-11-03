// 字母编辑器：输入字母生成 → 长杆拖到 H 上（吸附预览）→ 拖 C 靠近套管（穿入预览）→ 松手穿入 → 可解校验 → 保存试玩
import { openPage, advance, shot, ok } from './lib.mjs';
const { b, p, errs } = await openPage();
await p.evaluate((ST) => { __game.setMany({ theme: 'letters', word: 'CAKE', wordSeed: 0, canvasW: 720, canvasH: 1280, ...ST }); __game.openEditor(); __game.editLevel.rings = []; __game.editLevel.clips = []; __game.editLevel.word = 'HI'; }, JSON.parse(process.env.STYLE || '{}'));
await p.evaluate(() => { document.getElementById('edCh').value = 'HI'; document.getElementById('edGen').click(); });
const lv = await p.evaluate(() => __game.editLevel.rings.map(r => [r.ch, r.x, r.y]));
ok(lv.length === 2 && lv[0][0] === 'H' && lv[1][0] === 'I', '编辑器：输入 HI 生成 2 个字母 ' + JSON.stringify(lv));
const H = lv[0], I = lv[1];
// 长杆：按在 H 右竖上方一点 → 预览 → 截图 → 松手固定
await p.evaluate(() => __game.setEditorTool('rodL'));
await p.evaluate(([x, y]) => { __game.editorDown(x, y); __game.editorMove(x + 20, y); }, [H[1] + 42 + 10, H[2] - 30]);
await advance(p, 0.05); await shot(p, 'screenshots/editor_rod_preview.png');
await p.evaluate(() => __game.editorUp());
const c0 = await p.evaluate(() => __game.editLevel.clips[0]); ok(c0 && c0.o === 0 && c0.g === -1, '编辑器：杆端固定在 H，另一端为空套管 ' + JSON.stringify(c0));
// 拖 I 靠近套管
await p.evaluate(() => __game.setEditorTool('move'));
await p.evaluate(([ix, iy, sx, sy]) => { __game.editorDown(ix, iy); __game.editorMove(sx + 6, sy); }, [I[1], I[2] + 20, c0.x, c0.y + 20]);
await advance(p, 0.05); await shot(p, 'screenshots/editor_thread_preview.png');
const th = await p.evaluate(() => __game.editor.thread); ok(th && th.ok, '编辑器：I 的竖笔画可穿过套管 → 绿色预览');
await p.evaluate(() => __game.editorUp()); await advance(p, 0.05);
const c1 = await p.evaluate(() => __game.editLevel.clips[0]); ok(c1.g === 1, '编辑器：松手后 I 自动穿入套管（g=1）');
await shot(p, 'screenshots/editor_threaded.png');
await p.evaluate(() => { document.getElementById('edDone').click(); });
ok(await p.evaluate(() => __game.L.clips.length === 1 && __game.solveLevel(__game.levelFromSettings(__game.S)).solvable), '编辑器：保存后关卡可解并可试玩');
await p.evaluate(() => __game.startAuto()); let r; for (let k = 0; k < 20; k++) { r = await advance(p, 1); if (r.win != null) break; }
ok(r.win != null, '编辑器关卡：自动通关 ' + r.t.toFixed(1) + ' 秒');
ok(errs.length === 0, '无报错 ' + JSON.stringify(errs)); await b.close();
