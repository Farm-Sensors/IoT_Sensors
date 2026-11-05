import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-home/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('alan2203mx@gmail.com'); await p.getByLabel('Contraseña', { exact: true }).fill('123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/cliente'); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}${n}-home.jpg`, type: 'jpeg', quality: 60 });
  // flujo real: clic en una parcela y en el detalle del predio
  await p.getByRole('link', { name: /Abrir DEMO - Nogal Norte/ }).click(); await p.waitForURL('**/cliente/area/**'); console.log(n, 'parcela ->', new URL(p.url()).pathname);
  await p.goBack(); await p.waitForTimeout(1500);
  await p.getByRole('link', { name: /detalle del predio DEMO - Rancho Norte/ }).click(); await p.waitForURL('**/cliente/predio/**'); await p.waitForTimeout(2500);
  console.log(n, 'predio ->', new URL(p.url()).pathname, 'h1s', await p.locator('h1').count(), 'desborde', await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
  await p.screenshot({ path: `${OUT}${n}-predio.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('link', { name: /Abrir DEMO - Alfalfa Este/ }).click(); await p.waitForURL('**/cliente/area/**'); console.log(n, 'fila ->', new URL(p.url()).pathname, 'errores', errs.length);
}
await b.close();
