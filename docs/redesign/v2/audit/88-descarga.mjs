import { chromium } from './lib-axe.mjs';
import { mkdirSync } from 'node:fs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-historial/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
for (const [n, w, h, mob, scheme] of [['d', 1366, 800, false, 'light'], ['dd', 1366, 800, false, 'dark'], ['m', 390, 800, true, 'light']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, colorScheme: scheme, acceptDownloads: true }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/area/1/historial'); await p.waitForTimeout(3000);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'CSV' }).click()]);
  await p.getByRole('dialog').waitFor(); await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}${n}-descarga-a.jpg`, type: 'jpeg', quality: 60 });
  await p.waitForTimeout(1100); await p.screenshot({ path: `${OUT}${n}-descarga-b.jpg`, type: 'jpeg', quality: 60 });
  console.log(n, 'archivo', dl.suggestedFilename(), 'errores', errs.length);
  await p.waitForTimeout(3300); console.log(n, 'se cerró sola:', (await p.getByRole('dialog').count()) === 0);
  await ctx.close();
}
await b.close();
