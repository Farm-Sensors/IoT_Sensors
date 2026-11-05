import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob, scheme] of [['d', 1366, 500, false, 'light'], ['dd', 1366, 500, false, 'dark'], ['m', 390, 500, true, 'light']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, colorScheme: scheme })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(1500);
  await p.goto(B + '/cliente/area/1'); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}${n}-miga.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'DEMO - Rancho Norte' }).click(); await p.waitForURL('**/cliente/predio/1');
  await p.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'Mis predios' }).click(); await p.waitForURL('**/cliente');
  console.log(n, 'volver predio y portada ok; errores', errs.length, 'desborde', await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
}
await b.close();
