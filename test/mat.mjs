// 材质/建模对比：1080×1920 渲染第 6 秒，与参考同坐标裁切并排
import { openPage, advance, shot } from './lib.mjs';
import { execSync } from 'child_process';
const tag = process.argv[2] || 'x';
const { b, p, errs } = await openPage();
await p.evaluate(() => { __game.setMany({ canvasW: 1080, canvasH: 1920 }); __game.startAuto(); });
await advance(p, 6.0); await shot(p, '/tmp/tool6.png');
execSync('ffmpeg -v error -y -ss 6 -i /workspace/ring-ref/ref.mp4 -frames:v 1 /tmp/ref6.png');
const C = { full: null, yellow: '520:520:60:800', center: '420:420:330:1000', clip: '200:200:440:860', interlock: '360:360:330:560', bottom: '520:420:60:1400' };
for (const [k, c] of Object.entries(C)) {
  const f = c ? `crop=${c},scale=600:-1` : 'scale=540:960';
  execSync(`ffmpeg -v error -y -i /tmp/ref6.png -i /tmp/tool6.png -filter_complex "[0]${f}[a];[1]${f}[b];[a][b]hstack" screenshots/side_v14_${k}${tag === 'x' ? '' : '_' + tag}.png && cp screenshots/side_v14_${k}${tag === 'x' ? '' : '_' + tag}.png /tmp/m_${k}_${Date.now()}.png`);
}
console.log('errors', errs); await b.close();
