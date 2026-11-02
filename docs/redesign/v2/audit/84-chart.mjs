import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob, scheme] of [['d', 1366, 900, false, 'light'], ['dd', 1366, 900, false, 'dark'], ['m', 390, 844, true, 'light']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, colorScheme: scheme })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/predio/1'); await p.waitForTimeout(3000);
  const chart = p.getByRole('img', { name: /Humedad del suelo por área/ }); await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox(); if (!mob) await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.4); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}${n}-chart.jpg`, type: 'jpeg', quality: 60 });
  console.log(n, 'errores', errs.length, 'desborde', await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
}
await b.close();
