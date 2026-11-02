import { chromium } from 'playwright-core';
import fs from 'fs';
export const URL0 = process.env.URL || 'http://localhost:8765/index.html';
export async function openPage(url = URL0, vp = { width: 1300, height: 1000 }) {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await p.evaluate(() => { window.__T = 100000; __game.renderAt(window.__T); });
  return { b, p, errs };
}
export async function advance(p, secs, fps = 30) { return p.evaluate(async ([n, dt]) => { for (let i = 0; i < n; i++) { window.__T += dt; __game.renderAt(window.__T); } const G = __game.G; return { t: G.t, left: G.left(), win: G.winT }; }, [Math.round(secs * fps), 1000 / fps]); }
export async function shot(p, file) { const u = await p.evaluate(() => document.getElementById('stage').toDataURL('image/png')); fs.mkdirSync('screenshots', { recursive: true }); fs.writeFileSync(file, Buffer.from(u.split(',')[1], 'base64')); }
export const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
