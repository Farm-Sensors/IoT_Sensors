import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/login/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errs = [];
for (const [n, w, h, mob, scheme] of [['d-claro', 1366, 800, false, 'light'], ['d-oscuro', 1366, 800, false, 'dark'], ['m-claro', 390, 844, true, 'light'], ['t', 900, 800, false, 'light']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, colorScheme: scheme }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.waitForSelector('h1'); await p.waitForTimeout(800);
  if (n === 'd-oscuro') { await p.getByRole('button', { name: 'Cambiar a tema oscuro' }).click().catch(() => {}); await p.waitForTimeout(300); }
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(n, 'h1s', await p.locator('h1').count(), 'desborde', ov);
  await p.screenshot({ path: `${OUT}${n}.jpg`, type: 'jpeg', quality: 60 }); await ctx.close(); }
await b.close(); console.log('errores JS', errs.length);
