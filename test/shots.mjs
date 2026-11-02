// 参考节拍截图 + 与参考帧并排对比
import { openPage, advance, shot } from './lib.mjs';
import { execSync } from 'child_process';
const BEATS = [0.5, 2.0, 2.8, 6.0, 7.6, 10.0, 15.5, 18.0, 20.0];
const { b, p, errs } = await openPage();
await p.evaluate(() => __game.startAuto());
let t = 0;
for (const bt of BEATS) { await advance(p, bt - t); t = bt; await shot(p, `screenshots/tool_${bt}.png`); }
for (const bt of BEATS) {
  execSync(`ffmpeg -v error -y -ss ${bt} -i /workspace/ring-ref/ref.mp4 -frames:v 1 -vf scale=720:1280 /tmp/ref_${bt}.png`);
  execSync(`ffmpeg -v error -y -i /tmp/ref_${bt}.png -i screenshots/tool_${bt}.png -filter_complex "[0]scale=540:960,drawtext=text='REF ${bt}s':x=10:y=930:fontsize=26:fontcolor=red[a];[1]scale=540:960,drawtext=text='TOOL ${bt}s':x=10:y=930:fontsize=26:fontcolor=red[b];[a][b]hstack" screenshots/side_${String(bt).replace('.', '_')}.png`);
}
console.log('errors:', errs); await b.close();
