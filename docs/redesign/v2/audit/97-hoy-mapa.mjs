import { chromium } from './lib-axe.mjs';
const B = 'http://localhost:5173'; const OUT = new URL('./results/audit-admin-hoy/', import.meta.url).pathname;
const b = await chromium.launch();
for (const [n, w, h, mob] of [['d', 1366, 900, false], ['m', 390, 844, true]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: mob })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(B + '/'); await p.getByLabel('Correo Electrónico').fill('admin@sensores.com'); await p.getByLabel('Contraseña', { exact: true }).fill('admin123'); await p.getByRole('button', { name: 'Iniciar Sesión' }).click(); await p.waitForURL('**/admin'); await p.waitForTimeout(6000);
  const pins = async () => (await p.locator('.map-pin').allInnerTexts()).map((t) => t.replace(/\n/g, ' / '));
  console.log(n, 'pines:', JSON.stringify(await pins()));
  await p.screenshot({ path: `${OUT}${n}-mapa.jpg`, type: 'jpeg', quality: 60, fullPage: mob });
  await p.locator('.map-pin').first().click({ force: true }); await p.waitForTimeout(1500);
  console.log(n, 'filtrado:', (await p.locator('#pendientes-h').locator('xpath=..').innerText()).replace(/\n/g, ' | '), '| enlaces Abrir predio:', await p.getByRole('link', { name: /Abrir predio/ }).count());
  await p.screenshot({ path: `${OUT}${n}-filtro.jpg`, type: 'jpeg', quality: 60 });
  await p.getByRole('button', { name: /todos los predios/ }).click(); await p.waitForTimeout(500);
  console.log(n, 'quitar filtro ok; errores', errs.length, 'desborde', await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1));
}
await b.close();
