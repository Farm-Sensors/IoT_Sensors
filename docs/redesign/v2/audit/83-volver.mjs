import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(2000);
  await p.goto(B + '/cliente/predio/1'); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}${n}-predio.jpg`, type: 'jpeg', quality: 60, fullPage: n === 'm' });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await p.getByRole('link', { name: 'Abrir DEMO - Nogal Norte' }).click(); await p.waitForURL('**/cliente/area/1'); await p.waitForTimeout(800);
  await p.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'DEMO - Rancho Norte' }).click(); await p.waitForURL('**/cliente/predio/1');
  console.log(n, 'área -> miga del predio ->', new URL(p.url()).pathname, 'desborde', ov, 'errores', errs.length);
}
await b.close();
