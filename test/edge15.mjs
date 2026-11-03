import { chromium } from 'playwright-core'; import fs from 'fs'; import { execSync } from 'child_process';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const dpr of [2, 3]) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: dpr }); const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.evaluate(() => { window.__T = 1e5; __game.renderAt(window.__T); });
  await p.locator('#stage').screenshot({ path: `/tmp/edge_dpr${dpr}.png` }); await ctx.close();
}
// H5: newest exported zip
const z = fs.readdirSync('test/out').filter(f => /h5_playable/.test(f)).sort().pop(); execSync(`rm -rf /tmp/h5x && mkdir /tmp/h5x && cd /tmp/h5x && unzip -q /workspace/ring-untangle-tool/test/out/${z}`);
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); const p = await ctx.newPage();
await p.goto('file:///tmp/h5x/generic/index.html'); await p.waitForTimeout(15000); await p.screenshot({ path: '/tmp/edge_h5.png' }); await b.close();
